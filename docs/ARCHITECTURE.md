# Architecture

Where the code lives and why. The README has the short version.

## Layers

```text
            ┌─────────────────────────── UI (React) ───────────────────────────┐
            │  FeedPage     SearchPage      PreferencesPage                    │
            │      └── ArticleResults (skeleton / error / empty / list / sentinel) │
            └───────────────┬──────────────────────────────────────────────────┘
                            │ useArticles(filters)  (TanStack useInfiniteQuery)
                            ▼
                  NewsService  ◄── injected via React context (NewsServiceProvider)
                            │
                  ┌─────────┴─────────┐
                  │   NewsAggregator  │  per-source cursors → k-way merge (watermark)
                  │                   │  → de-dupe → { articles, failures, nextCursor }
                  └───┬──────┬──────┬─┘
        «interface»   │      │      │      NewsProvider { id, name, supportedCategories, search() }
              ┌───────▼┐ ┌───▼────┐ ┌▼──────┐
              │NewsApi │ │Guardian│ │  Nyt  │   adapters: unified filters → API params,
              │Provider│ │Provider│ │Provider│  API payload → Article (payload validated with Zod)
              └───┬────┘ └───┬────┘ └───┬───┘
                  └──────────┴──────────┘
                       HttpClient (fetch)  ──►  /api/<source>/…  ──►  nginx / Vite proxy  ──►  real API
```

## The provider/adapter pattern

- **One domain model** (`src/domain/news.ts`): `Article`, `SearchParams`, `NewsProvider`. The UI never sees an API-specific shape.
- **One adapter per API** (`src/services/providers/*Provider.ts`). Each maps our filters (keyword, `from`/`to`, categories, page) to that API's quirks — e.g. NYT wants `YYYYMMDD` dates, a 0-based page and a `section_name` facet; the Guardian uses `from-date`/`section=a|b`; NewsAPI needs `everything` for date ranges but `top-headlines` for categories. It then validates the response with Zod and maps it to `Article`.
- **`NewsAggregator`** takes the providers through its constructor. It queries the selected sources in parallel with `Promise.allSettled`, skips sources that can't serve the requested categories, merges, **de-duplicates** (canonical URL or normalised title) and returns `{ articles, failures, nextCursor }`. A failing source never breaks the page — failures render as a small amber notice, and only if _every_ source fails is a full error state shown.

## Pagination: a cursor-based k-way merge

Each source keeps its own page position plus a buffer of fetched-but-unshown articles (the cursor, an immutable JSON object). An article is emitted only once no active source can still hold anything newer (the _watermark_), so the feed is **globally newest-first across pages** instead of "page N of every source". A source that returns `hasMore: false`, or hits its plan cap (NewsAPI `426`, NYT `429` on deep pages), is marked done and **never called again**. Infinite scroll (`IntersectionObserver` sentinel) fetches the next page; a failed page keeps its cursor so "Try again" resumes exactly there, and a failure can never silently end the feed ("You're all caught up" is shown only when every source is genuinely exhausted).

## Errors, timeouts and cancellation

- `HttpClient` applies a per-request timeout and forwards TanStack Query's `AbortSignal` to `fetch`, so superseded searches (fast filter changes, route changes) are actually cancelled in the browser.
- Failures are typed (`HttpError`, `RequestTimeoutError`, `AllSourcesFailedError`, …) and rendered through `describeError`, which produces short user-facing messages (rate limit, bad key, unexpected format). Raw Zod issues or stack traces never reach the UI.
- Filters are normalised (trim, lower-case, de-dupe, sort) before they become query keys, so equivalent searches share one cache entry. URL date parameters are checked with `isValidDay` (`useSearchFilters.ts`) and persisted preferences go through the hand-written `sanitizePreferences` (`preferencesStore.ts`); invalid values are dropped rather than sent upstream. Zod is used only for provider payloads.

## Dates

The date picker works in the user's **local days**; bounds are converted to the exact instants of local start/end of day, so the filter is correct in every timezone (previously a UTC mismatch returned 0 cards for users east of UTC). NYT only accepts calendar days, so it is queried with the widened UTC days and trimmed client-side.

## Data normalization

The three APIs disagree on almost everything, so adapters never build an `Article` by hand. They extract raw fields and pass them to **`createArticle`** (`src/services/normalize/`), the single place where raw data becomes the domain model. It is built from small pure functions, each unit-tested against edge cases seen in the live APIs:

| Concern          | Rule                                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**     | `normalizeCategory` maps Guardian `sectionId`/`sectionName`, NYT `section_name`/`news_desk` and NewsAPI's requested category onto our `Category` union. Unknown sections (food, opinion, …) become `undefined`, never a raw string. Labels come from `CATEGORY_LABELS`.   |
| **Authors**      | `normalizeAuthors` → `authors: string[]`: strips "By ", splits "A and B" / "A, B" / "A & B", drops URLs, emails, "[Removed]", organisations and the publisher's own name, title-cases and de-duplicates. Preferences/filters compare with `authorKey` (case-insensitive). |
| **Source**       | `source` is the stable `SourceId`; `sourceName` its brand label. For NewsAPI the originating outlet ("BBC News") is kept separately in `publisher`, and the ` - BBC News` title suffix is stripped.                                                                       |
| **Dates**        | `normalizeDate` → ISO-8601 UTC (handles NYT's `+0000`, offsets, `Z`). Sorting and the date-range filter (`isWithinDateRange`, local days) use only the normalized value.                                                                                                  |
| **Text**         | `cleanText` decodes HTML entities, strips tags, collapses whitespace, drops placeholders and caps descriptions at 240 characters on a word boundary.                                                                                                                      |
| **URLs**         | `normalizeUrl` keeps absolute https only (upgrades http, resolves NYT relative image paths, rejects `javascript:`/`data:`).                                                                                                                                               |
| **IDs / dedupe** | `stableId` is derived from the canonical URL. The aggregator de-dupes by `canonicalUrl` (no scheme, `www`, query, hash or trailing slash) and `titleKey` (case/punctuation-insensitive).                                                                                  |

Records missing a title, https URL or valid date are dropped by `createArticle` rather than shown half-broken.

## Adding a new source (open/closed)

1. Create `src/services/providers/bbcProvider.ts` implementing `NewsProvider`.
2. Add the instance to `createProviders()` in `src/services/providers/registry.ts` and its id and label to `SOURCE_IDS` / `SOURCE_LABELS` in `src/domain/news.ts`.
3. Add a proxy entry for its host in `docker/nginx/default.conf.template` and `vite.config.ts`.

The aggregator, hooks and pages need no changes; source filters, preferences and results are driven by `SOURCE_IDS`.

## How the principles show up

| Principle                 | Examples                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S**ingle responsibility | Adapters only translate; the aggregator only orchestrates (cursor merge); `useArticles` only fetches; `FilterPanel` only renders; `useSearchFilters` only syncs URL ⇄ filters; the store only holds preferences.                                                                                                        |
| **O**pen/closed           | New source = new adapter + registration (above).                                                                                                                                                                                                                                                                        |
| **L**iskov                | Any `NewsProvider` is interchangeable inside the aggregator; tests use fake providers.                                                                                                                                                                                                                                  |
| **I**nterface segregation | Small interfaces: `HttpClient` (one method), `NewsService` (what the UI needs), `NewsProvider`.                                                                                                                                                                                                                         |
| **D**ependency inversion  | `NewsAggregator` depends on `NewsProvider[]`, adapters depend on `HttpClient`, and the UI depends on `NewsService` via context — all injected, so tests swap in fakes without mocking modules.                                                                                                                          |
| **DRY**                   | One `ArticleResults` renders every query state for both Feed and Search; shared `MultiSelect`, `TextInput`, `EmptyState`, `ErrorState`; one HTTP client; one normalization module used by every adapter (`createArticle`), a shared Zod helper (`parseItems`); one proxy contract (`/api/<source>/…`) for dev and prod. |
| **KISS**                  | No component library, no global state for server data, `react-day-picker` (via `DateRangePicker`), checkbox-based `MultiSelect` (accessible by default), plain `fetch`.                                                                                                                                                 |

## API keys and the reverse proxy

A missing key only disables that source (the UI shows "API key is missing or invalid" for it); the rest keep working.

NewsAPI's free plan rejects browser requests from any origin other than `localhost`, and shipping keys in a client bundle would leak them anyway. So the browser only ever calls same-origin paths:

```
/api/newsapi/*   → https://newsapi.org/v2/*                        (key as X-Api-Key header)
/api/guardian/*  → https://content.guardianapis.com/*              (key as api-key query param)
/api/nyt/*       → https://api.nytimes.com/svc/search/v2/*         (key as api-key query param)
```

- **Docker/prod:** nginx (`docker/nginx/default.conf.template`) does this. The file is an `envsubst` template, so keys are supplied at **container runtime** (`-e NEWSAPI_KEY=…`) — no rebuild needed and keys are never baked into the image (no `ENV` defaults, so no `SecretsUsedInArgOrEnv` build warning) or the JS bundle. `docker/nginx/05-default-keys.envsh` runs before the envsubst step and exports any missing key as empty, because envsubst skips unset variables and nginx would otherwise fail on a literal `${NYT_KEY}`.
- **Local dev:** Vite's `server.proxy` (`vite.config.ts`) does the same, reading `.env`.

The same approach is used for all three sources for consistency. Hardening in `docker/nginx/`:

- **Allowlist:** only the exact upstream paths the app uses are proxied, GET-only; anything else under `/api/` is a 404.
- **Rate limit:** `limit_req` per client IP (`API_RATE`, `API_BURST`), answered with `429`.
- **Cache:** identical searches are cached for `API_CACHE_TTL` (default 60s) and served stale when the upstream errors, which protects the free-tier quotas.
- **Headers:** CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` are included in **every** location (an `add_header` in a location silently drops inherited ones, which is why `/assets/` used to lose them). `index.html` is `no-cache`; hashed `/assets/*` are `immutable` for a year. Keys are never exposed to the browser.
- **Config (env, all optional):** `NEWSAPI_UPSTREAM`, `GUARDIAN_UPSTREAM`, `NYT_UPSTREAM`, `API_CACHE_TTL`, `API_RATE`, `API_BURST`, `WEB_PORT` (compose host port). A hostname in an `*_UPSTREAM` is resolved when nginx starts, so recreate the container if it changes.

## Deploy to Vercel

Docker/nginx stays the primary way to run the app. Vercel is an alternative that serves the same `/api/<source>/…` contract, so the frontend is unchanged.

- `api/{newsapi,guardian,nyt}/[endpoint].ts` are Node functions that mirror `default.conf.template`: same upstream rewrites, same allowlisted endpoints (404 otherwise), GET only (405 otherwise), key as `X-Api-Key` (NewsAPI) or `api-key` query param (Guardian, NYT). The shared logic lives in `api/_lib/proxy.ts`.
- Upstream timeout is 12s (nginx `proxy_read_timeout`), answered with `504`. Successful responses get `Cache-Control: public, s-maxage=60, stale-while-revalidate=600`, so Vercel's edge cache plays the role of `proxy_cache` (non-200 answers are not cached).
- `vercel.json` has the SPA fallback (everything except `/api/*` and `/assets/*` goes to `index.html`), `immutable` caching for `/assets/*`, `no-cache` for the rest, and the same security headers as `docker/nginx/security-headers.conf`. `connect-src 'self'` is enough because the browser only calls same-origin `/api/*`.
- **Env vars** (Project Settings → Environment Variables, server-side only, no `VITE_` prefix): `NEWSAPI_KEY`, `GUARDIAN_KEY`, `NYT_KEY`. A missing key disables only that source, as with Docker.
- **Not replicated: rate limiting.** nginx applies a per-IP `limit_req`; there is no equivalent on Vercel's free tier, so anyone can call `/api/*` as often as they like, limited only by the edge cache (identical queries within 60s hit upstream once) and the upstream free-tier quotas. Add Vercel's WAF rate limiting on a paid plan, or a limiter in front, if that matters.
- Also different: no `proxy_cache_lock` (concurrent identical misses in different regions can each reach the upstream), no serve-stale-on-upstream-error, and no `/healthz`.
- Local check: `vercel dev` with the same keys in `.env`.

## Unit tests

- **Provider adapters**: mapping from fixture JSON (`__fixtures__/`), malformed-item handling and filter to query-param mapping, for all three providers.
- **Aggregator**: merge, sort, de-duplication, source selection, category skipping and partial/total failure.
- **Preferences store**: actions, de-duplication, persistence to and rehydration from `localStorage`; author helpers.
- **Components**: `SearchPage` (URL and filters, debounced keyword, clear, partial-failure notice) and `FeedPage` (personalise prompt, preference-driven query, followed authors first).

## End-to-end tests (Playwright)

The e2e suite runs the **production image** (nginx + built bundle) in front of a small mock upstream that can be told to fail, stall, rate-limit or return malformed JSON, so the real proxy, headers, cache and UI are exercised together:

```bash
npm run e2e:up         # docker compose -f docker-compose.e2e.yml up --build -d --wait
npm run e2e            # playwright test (34 tests: scroll, resilience, filters, authors, proxy)
npm run e2e:down
```

Covered: ordered infinite scroll to the real end, no calls to exhausted sources, single/total/mid-scroll source failure and retry, timeouts, friendly malformed-response message, filter normalisation and abort of superseded requests, timezone-correct date filtering, invalid URL/persisted values, security headers on `/` and `/assets/*`, allowlist, rate limit and stale-on-error cache, and the author filter (bounded requests for a non-matching author, one-batch "Search older", server-side match, no duplicate or looping requests, empty state never beside a loader).

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, unit tests, build, a Docker build and the e2e job.
