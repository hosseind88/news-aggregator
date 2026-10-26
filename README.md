# Newsroom — News Aggregator

A React + TypeScript single-page app that merges articles from **NewsAPI.org**, **The Guardian** and **The New York Times** into one searchable, filterable and personalisable feed.

![CI](https://github.com/hosseind88/news-aggregator/actions/workflows/ci.yml/badge.svg)

## Review notes: problems found and how they were proven

The first version was run in Docker and driven like a user (Playwright), with hypotheses written down and checked **before** fixing. Raw evidence is in [`docs/evidence/`](docs/evidence).

| Problem                                                                         | Root cause                                                                        | Fix                                                                                                                  | Proof                                                                                     |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Unstable order, exhausted sources still called                                  | "Page N of every source" merge; no per-source state                               | Per-source cursors, watermark k-way merge, `done` sources never called                                               | Scroll session: 11 order inversions / 48 requests → **0 / 32** (same 520 articles)        |
| All sources failing shown as "You're all caught up" (and cached)                | Aggregator resolved an empty page as success                                      | `AllSourcesFailedError`; failed cursor stays retryable; sources revived when nothing else can serve                  | `before-probes.txt` H-A/H-B; e2e `resilience.spec.ts`                                     |
| `AbortSignal` unused, no timeouts                                               | Signal never reached `fetch`                                                      | Signal + timeout in `HttpClient`, forwarded by every adapter                                                         | 0 aborted requests before; e2e abort + timeout tests                                      |
| nginx open proxy, no CSP, headers lost in `/assets/`                            | `add_header` in a location drops inherited headers; no allowlist/limit/cache      | Allowlist, `limit_req`, cache + stale-on-error, headers in every location, `no-cache` index                          | `after-headers.txt` (`curl -I`), `proxy.spec.ts`                                          |
| Date filter off by a day / 0 results                                            | Local days in the picker vs UTC bounds                                            | Local-day bounds; NYT widened and trimmed client-side                                                                | Auckland timezone: 0 cards → correct cards (`filters.spec.ts`)                            |
| Routes eager, query keys unnormalised                                           | No code splitting; raw filters in keys and requests                               | Lazy routes (+ error boundary); normalised filters                                                                   | Build chunk listing in `after-checks.txt`; `q=+Markets+` no longer sent verbatim          |
| Persisted prefs / URL dates not validated                                       | Trusted `localStorage` and query string                                           | Zod-validated prefs and date params                                                                                  | `from=garbage` no longer reaches upstream (e2e)                                           |
| Raw ZodError shown to users                                                     | Error `message` rendered as-is                                                    | `describeError` maps to friendly text                                                                                | e2e malformed-upstream test                                                               |
| "Only followed authors" looped ~29 requests, showed "No articles" over a loader | Client-side filter hid every page, so the sentinel stayed in view and kept firing | Author filter pushed to Guardian/NYT, bounded scan elsewhere, auto-load budget, explicit "Search older" / "Show all" | **29 → 5** requests, then idle; `before/after-author-filter.{txt,png}`, `authors.spec.ts` |
| README mentioned "Load more"                                                    | Stale docs                                                                        | Rewritten                                                                                                            | —                                                                                         |

Before/after full scroll session (production image, mock upstream with 520 articles):

| Desktop before                               | Desktop after                               | Mobile before                               | Mobile after                               |
| -------------------------------------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------ |
| ![](docs/evidence/before-desktop-bottom.png) | ![](docs/evidence/after-desktop-bottom.png) | ![](docs/evidence/before-mobile-bottom.png) | ![](docs/evidence/after-mobile-bottom.png) |

Check output (prettier, lint, typecheck, 194 unit tests, build, 34 e2e tests): [`docs/evidence/after-checks.txt`](docs/evidence/after-checks.txt).

## Screenshots

> Captured against a local mock of the three APIs (sample headlines), so no real keys are needed to preview the UI.

| My Feed (mobile)                                    | Search with filters (desktop)                  |
| --------------------------------------------------- | ---------------------------------------------- |
| ![Feed on mobile](docs/screenshots/feed-mobile.png) | ![Search](docs/screenshots/search-desktop.png) |

![Preferences](docs/screenshots/preferences-desktop.png)

## Features (mapped to the requirements)

| #   | Requirement                                                     | Where / how                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Search & filter** by keyword, date range, category and source | `/search`. Debounced keyword input, `DateRangePicker`, category and source `MultiSelect`s. All filter state lives in the **URL query string** (`?q=&from=&to=&categories=&sources=`), so results are shareable and survive reloads.                                                                                                                          |
| 2   | **Personalised feed** (sources, categories, authors)            | `/preferences` + `/` (My Feed). Preferences are saved to `localStorage` (Zustand `persist`). Authors can be picked from the latest headlines or typed in; articles by followed authors are surfaced first and can be isolated with "Only followed authors". With no preferences the feed shows the latest news from all sources and a prompt to personalise. |
| 3   | **Responsive**                                                  | Mobile-first Tailwind layout: 1/2/3 column grid, filters collapse behind a toggle below `lg`, dark mode follows the OS setting.                                                                                                                                                                                                                              |
| 4   | **≥ 3 data sources**                                            | NewsAPI.org, The Guardian Open Platform, NYT Article Search — one adapter each.                                                                                                                                                                                                                                                                              |
| 5   | **React + TypeScript**                                          | React 18, TypeScript `strict` (+ `noUncheckedIndexedAccess`).                                                                                                                                                                                                                                                                                                |
| 6   | **Docker**                                                      | Multi-stage `Dockerfile` (Node build → nginx), `docker-compose.yml`, runtime key injection. See [Run with Docker](#run-with-docker-primary).                                                                                                                                                                                                                 |
| 7   | **DRY / KISS / SOLID**                                          | See [Architecture](#architecture).                                                                                                                                                                                                                                                                                                                           |

Also: loading skeletons, empty and error states, infinite scroll with globally ordered pagination, request timeouts and cancellation, a non-blocking notice when one source fails, article cards that open the original in a new tab, semantic HTML, labelled inputs, keyboard navigation and a skip link.

## Tech stack

| Choice                            | Why                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vite + React 18 + TS (strict)** | Fast dev loop, small static bundle that is trivial to serve from nginx.                                                                                |
| **TanStack Query**                | Caching, request de-duplication, `useInfiniteQuery` for infinite scroll, and loading/error state for free. Server state stays out of global stores.    |
| **React Router**                  | Routes plus `useSearchParams` for URL-synced filters.                                                                                                  |
| **Zustand (+ `persist`)**         | Tiny store for the only client state worth persisting (preferences); one line to sync with `localStorage`.                                             |
| **Zod**                           | Provider payloads are untrusted. Each adapter validates and normalises them at the boundary; malformed items are dropped instead of crashing the page. |
| **Tailwind CSS**                  | Consistent, mobile-first styling without a component-library dependency.                                                                               |
| **Vitest + Testing Library**      | Same toolchain as Vite; tests exercise behaviour, not implementation.                                                                                  |
| **ESLint + Prettier**             | Enforced in CI.                                                                                                                                        |
| **nginx**                         | Serves the SPA and acts as the API reverse proxy (see below).                                                                                          |

## Architecture

```
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
              │Provider│ │Provider│ │Provider│  API payload → Article (validated with Zod)
              └───┬────┘ └───┬────┘ └───┬───┘
                  └──────────┴──────────┘
                       HttpClient (fetch)  ──►  /api/<source>/…  ──►  nginx / Vite proxy  ──►  real API
```

### The provider/adapter pattern

- **One domain model** (`src/domain/news.ts`): `Article`, `SearchParams`, `NewsProvider`. The UI never sees an API-specific shape.
- **One adapter per API** (`src/services/providers/*Provider.ts`). Each maps our filters (keyword, `from`/`to`, categories, page) to that API's quirks — e.g. NYT wants `YYYYMMDD` dates, a 0-based page and a `section_name` facet; the Guardian uses `from-date`/`section=a|b`; NewsAPI needs `everything` for date ranges but `top-headlines` for categories. It then validates the response with Zod and maps it to `Article`.
- **`NewsAggregator`** takes the providers through its constructor. It queries the selected sources in parallel with `Promise.allSettled`, skips sources that can't serve the requested categories, merges, **de-duplicates** (canonical URL or normalised title) and returns `{ articles, failures, nextCursor }`. A failing source never breaks the page — failures render as a small amber notice, and only if _every_ source fails is a full error state shown.

### Pagination: a cursor-based k-way merge

Each source keeps its own page position plus a buffer of fetched-but-unshown articles (the cursor, an immutable JSON object). An article is emitted only once no active source can still hold anything newer (the _watermark_), so the feed is **globally newest-first across pages** instead of "page N of every source". A source that returns `hasMore: false`, or hits its plan cap (NewsAPI `426`, NYT `429` on deep pages), is marked done and **never called again**. Infinite scroll (`IntersectionObserver` sentinel) fetches the next page; a failed page keeps its cursor so "Try again" resumes exactly there, and a failure can never silently end the feed ("You're all caught up" is shown only when every source is genuinely exhausted).

### Errors, timeouts and cancellation

- `HttpClient` applies a per-request timeout and forwards TanStack Query's `AbortSignal` to `fetch`, so superseded searches (fast filter changes, route changes) are actually cancelled in the browser.
- Failures are typed (`HttpError`, `TimeoutError`, `AllSourcesFailedError`, …) and rendered through `describeError`, which produces short user-facing messages (rate limit, bad key, unexpected format). Raw Zod issues or stack traces never reach the UI.
- Filters are normalised (trim, lower-case, de-dupe, sort) before they become query keys, so equivalent searches share one cache entry. URL parameters and persisted preferences are validated; invalid values are dropped rather than sent upstream.

### Dates

The date picker works in the user's **local days**; bounds are converted to the exact instants of local start/end of day, so the filter is correct in every timezone (previously a UTC mismatch returned 0 cards for users east of UTC). NYT only accepts calendar days, so it is queried with the widened UTC days and trimmed client-side.

### Data normalization

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

### Adding a new source (open/closed)

1. Create `src/services/providers/bbcProvider.ts` implementing `NewsProvider`.
2. Add the instance to `createProviders()` in `src/services/providers/registry.ts` and its id to `SOURCE_IDS` in `src/domain/news.ts` (plus a label).
3. Add a nginx/Vite proxy entry for its host.

The aggregator, hooks, pages and filters need **no** changes — the source filters, preferences and results pick it up automatically.

### How the principles show up

| Principle                 | Examples                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S**ingle responsibility | Adapters only translate; the aggregator only orchestrates (cursor merge); `useArticles` only fetches; `FilterPanel` only renders; `useSearchFilters` only syncs URL ⇄ filters; the store only holds preferences.                                                                                                        |
| **O**pen/closed           | New source = new adapter + registration (above).                                                                                                                                                                                                                                                                        |
| **L**iskov                | Any `NewsProvider` is interchangeable inside the aggregator; tests use fake providers.                                                                                                                                                                                                                                  |
| **I**nterface segregation | Small interfaces: `HttpClient` (one method), `NewsService` (what the UI needs), `NewsProvider`.                                                                                                                                                                                                                         |
| **D**ependency inversion  | `NewsAggregator` depends on `NewsProvider[]`, adapters depend on `HttpClient`, and the UI depends on `NewsService` via context — all injected, so tests swap in fakes without mocking modules.                                                                                                                          |
| **DRY**                   | One `ArticleResults` renders every query state for both Feed and Search; shared `MultiSelect`, `TextInput`, `EmptyState`, `ErrorState`; one HTTP client; one normalization module used by every adapter (`createArticle`), a shared Zod helper (`parseItems`); one proxy contract (`/api/<source>/…`) for dev and prod. |
| **KISS**                  | No component library, no global state for server data, native `<input type="date">`, checkbox-based `MultiSelect` (accessible by default), plain `fetch`.                                                                                                                                                               |

## API keys

All three APIs are free. Put the keys in `.env` (see `.env.example`):

| Variable       | Where to get it                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------- |
| `NEWSAPI_KEY`  | Register at <https://newsapi.org/register>                                                         |
| `GUARDIAN_KEY` | Request a developer key at <https://open-platform.theguardian.com/access/>                         |
| `NYT_KEY`      | Create an app at <https://developer.nytimes.com/get-started> and enable the **Article Search API** |

A missing key only disables that source (the UI shows "API key is missing or invalid" for it); the rest keep working.

### Why a reverse proxy?

NewsAPI's free plan rejects browser requests from any origin other than `localhost`, and shipping keys in a client bundle would leak them anyway. So the browser only ever calls same-origin paths:

```
/api/newsapi/*   → https://newsapi.org/v2/*                        (key as X-Api-Key header)
/api/guardian/*  → https://content.guardianapis.com/*              (key as api-key query param)
/api/nyt/*       → https://api.nytimes.com/svc/search/v2/*         (key as api-key query param)
```

- **Docker/prod:** nginx (`docker/nginx/default.conf.template`) does this. The file is an `envsubst` template, so keys are supplied at **container runtime** (`-e NEWSAPI_KEY=…`) — no rebuild needed and keys are never baked into the image or the JS bundle.
- **Local dev:** Vite's `server.proxy` (`vite.config.ts`) does the same, reading `.env`.

The same approach is used for all three sources for consistency. Hardening in `docker/nginx/`:

- **Allowlist:** only the exact upstream paths the app uses are proxied, GET-only; anything else under `/api/` is a 404.
- **Rate limit:** `limit_req` per client IP (`API_RATE`, `API_BURST`), answered with `429`.
- **Cache:** identical searches are cached for `API_CACHE_TTL` (default 60s) and served stale when the upstream errors, which protects the free-tier quotas.
- **Headers:** CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` are included in **every** location (an `add_header` in a location silently drops inherited ones, which is why `/assets/` used to lose them). `index.html` is `no-cache`; hashed `/assets/*` are `immutable` for a year. Keys are never exposed to the browser.
- **Config (env, all optional):** `NEWSAPI_UPSTREAM`, `GUARDIAN_UPSTREAM`, `NYT_UPSTREAM`, `API_CACHE_TTL`, `API_RATE`, `API_BURST`, `WEB_PORT` (compose host port). A hostname in an `*_UPSTREAM` is resolved when nginx starts, so recreate the container if it changes.

Proof: [`docs/evidence/after-headers.txt`](docs/evidence/after-headers.txt).

## Run with Docker (primary)

```bash
cp .env.example .env      # then fill in the three keys
docker compose up --build
```

Open <http://localhost:3000>.

Without compose:

```bash
docker build -t news-aggregator .
docker run --rm -p 3000:80 \
  -e NEWSAPI_KEY=xxx -e GUARDIAN_KEY=xxx -e NYT_KEY=xxx \
  news-aggregator
```

The image is two stages: `node:22-alpine` runs `npm ci && npm run build`; `nginx:alpine` serves `dist/`, falls back to `index.html` for client-side routes and proxies `/api/*` as described above.

## Run locally (without Docker)

Requires Node 20+.

```bash
npm ci
cp .env.example .env      # fill in keys
npm run dev               # http://localhost:5173
```

Other scripts:

```bash
npm run typecheck      # app, node and e2e tsconfigs
npm run build          # type-check + production build (routes are lazy-loaded chunks)
npm run preview        # serve the production build (no API proxy keys; use Docker for that)
npm run lint
npm run format         # prettier --write (format:check in CI)
```

## Tests

```bash
npm test               # vitest run (watch: npm run test:watch)
```

- **Provider adapters** — mapping from fixture JSON (`__fixtures__/`), malformed-item handling and filter → query-param mapping, for all three providers.
- **Aggregator** — merge, sort, de-duplication, source selection, category skipping and partial/total failure.
- **Preferences store** — actions, de-duplication, persistence to and rehydration from `localStorage`; author helpers.
- **Components** — `SearchPage` (URL ⇄ filters, debounced keyword, clear, partial-failure notice) and `FeedPage` (personalise prompt, preference-driven query, followed authors first).

### End-to-end (Playwright)

The e2e suite runs the **production image** (nginx + built bundle) in front of a small mock upstream that can be told to fail, stall, rate-limit or return malformed JSON, so the real proxy, headers, cache and UI are exercised together:

```bash
npm run e2e:up         # docker compose -f docker-compose.e2e.yml up --build -d --wait
npm run e2e            # playwright test (34 tests: scroll, resilience, filters, authors, proxy)
npm run e2e:down
```

Covered: ordered infinite scroll to the real end, no calls to exhausted sources, single/total/mid-scroll source failure and retry, timeouts, friendly malformed-response message, filter normalisation and abort of superseded requests, timezone-correct date filtering, invalid URL/persisted values, security headers on `/` and `/assets/*`, allowlist, rate limit and stale-on-error cache, and the author filter (bounded requests for a non-matching author, one-batch "Search older", server-side match, no duplicate or looping requests, empty state never beside a loader).

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, unit tests, build, a Docker build and the e2e job.

## Project structure

```
src/
├── domain/                 # Article, SearchParams, NewsProvider, … (no dependencies)
├── services/
│   ├── http/               # HttpClient + fetch implementation, error normalisation
│   ├── providers/          # NewsApi / Guardian / Nyt adapters + registry (+ fixtures, tests)
│   ├── normalize/          # pure normalizers: category, authors, dates, text, URLs, createArticle
│   ├── aggregator/         # NewsAggregator, de-dupe/sort helpers
│   └── NewsServiceContext  # DI of NewsService into React
├── features/
│   ├── articles/           # useArticles, ArticleCard, ArticleResults, skeletons, failure notice
│   ├── feed/               # My Feed page
│   ├── search/             # Search page, FilterPanel, URL-synced useSearchFilters
│   └── preferences/        # Zustand store, usePreferences, author helpers, Preferences page
├── shared/
│   ├── ui/                 # Button, MultiSelect, DateRangePicker, TextInput, EmptyState, ErrorState, Skeleton
│   ├── hooks/              # useDebounce
│   ├── layout/             # AppLayout, NotFoundPage
│   └── lib/                # date formatting
└── test/                   # setup + factories
docker/nginx/               # default.conf.template, security-headers.conf, api-proxy.conf
e2e/                        # Playwright specs, mock upstream, scroll-session tool
```

## Trade-offs and limitations

- **NewsAPI filtering:** `everything` has dates but no category; `top-headlines` has category but no dates. With a date range, categories become keywords; `top-headlines` is limited to `country=us`. NewsAPI's free plan also caps results (~100) and delays articles by 24h.
- **Categories** are a unified list; sources without an equivalent (e.g. NewsAPI has no World/Politics) are skipped for that category rather than guessed.
- **Authors** — without "Only followed authors" they are a ranking signal (followed authors first). With it on, the filter is pushed down where the API can do it, behind `NewsProvider.supportsAuthorFilter`: Guardian searches the `byline` field (`q` + `query-fields`), NYT phrase-searches the name in `q`; NewsAPI has no author filter, so it is scanned client-side, at most one page per aggregator call. Whatever comes back is still matched against the normalised bylines, so precision does not depend on the upstream's fuzzy search. Auto-loading is bounded: after 2 consecutive pages that add less than a grid row of matches it stops and shows "No recent articles from your followed authors" with **Search older articles** (one explicit batch) and **Show all articles** (filter off). Loader, skeletons and empty state are mutually exclusive. For a non-matching author this takes ~5 upstream requests instead of ~29 (`docs/evidence/*-author-filter.txt`). Caveats: byline search is the upstream's text search, so spelling variants it does not index are missed, and an author who only wrote older pieces needs "Search older articles". The live NYT `fq` filters (including the existing category one) returned no results with the key used for testing, which is why authors use `q`; worth re-checking against a production key.
- **Pagination** is globally ordered (cursor merge above), but a source's own cap (NewsAPI free ~100 results) ends its contribution early; the feed then continues from the remaining sources.
- **NYT rate limit** (5 req/min on free keys) can cause that source to be reported as failed when filters change rapidly; TanStack Query caching mitigates this.
- The keyword input does not re-sync from the URL on browser back/forward (filters do).
- Dark mode follows `prefers-color-scheme`; there is no manual toggle.

## Future improvements

- A BFF to cache/merge upstream calls, enforce rate limits and index authors across sources.
- Virtualised lists for very long sessions.
- Manual theme toggle, saved searches, bookmarks.
- Contract tests against recorded real API responses.
- Persist preferences server-side per user account.
