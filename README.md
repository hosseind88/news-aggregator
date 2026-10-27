# Newsroom: News Aggregator

A React + TypeScript single-page app that merges articles from NewsAPI.org, The Guardian and The New York Times into one searchable, filterable feed.

![Search with filters](docs/screenshots/search-desktop.png)

## Features

- Search by keyword, date range, category and source; filters live in the URL, so results are shareable.
- Personalised "My Feed": choose sources, categories and followed authors (saved in the browser).
- Followed authors are ranked first; "Only followed authors" isolates them.
- Infinite scroll with a stable newest-first order across all three sources.
- A failing source shows a notice instead of breaking the page; retry resumes where it stopped.
- Responsive layout, dark mode following the OS setting, keyboard navigation.

## Quick start (Docker)

```bash
cp .env.example .env      # fill in NEWSAPI_KEY, GUARDIAN_KEY, NYT_KEY
docker compose up --build
```

Open <http://localhost:3000>.

Without compose:

```bash
docker build -t news-aggregator .
docker run --rm -p 3000:80 --env-file .env news-aggregator
```

Keys are read at container start by nginx and never reach the browser bundle. A missing key disables only that source.

## Local development

```bash
npm ci && cp .env.example .env   # fill in keys
npm run dev                      # http://localhost:5173
npm test                         # unit and component tests (vitest)
npm run e2e:up && npm run e2e    # Playwright against the Docker image + mock APIs (then npm run e2e:down)
```

## Tech stack

- Vite, React 18, TypeScript (strict)
- TanStack Query
- React Router
- Zustand (persist)
- Zod (provider payloads)
- Tailwind CSS, react-day-picker, Radix Popover
- Vitest, Testing Library, Playwright
- ESLint, Prettier
- nginx, Docker

## Key decisions

- Provider/adapter pattern: one `NewsProvider` adapter per API, injected into `NewsAggregator`; the UI only sees the `Article` model.
- nginx reverse proxy (`/api/<source>/*`) injects the API keys at runtime, so keys stay out of the bundle and the image.
- Filters are synced to the URL query string; URL dates and saved preferences are validated by hand and invalid values dropped.
- Infinite pagination uses TanStack Query `useInfiniteQuery` with a per-source cursor and a k-way merge, so order is global and exhausted sources are not called again.
- SOLID, DRY and KISS: small interfaces, dependencies injected, shared UI and normalisation code, no component library.

## Project structure

```text
src/
├── domain/      # Article, SearchParams, NewsProvider
├── services/    # http client, providers, normalisation, aggregator
├── features/    # articles, feed, search, preferences
├── shared/      # ui components, hooks, layout, lib
└── test/        # setup and factories
docker/nginx/    # proxy and security header config
e2e/             # Playwright specs and mock upstream
```

More: [Architecture](docs/ARCHITECTURE.md) | [Review notes and limitations](docs/REVIEW_NOTES.md)
