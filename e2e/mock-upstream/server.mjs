// Mock of the three upstream news APIs, used only by the e2e stack (see docker-compose.e2e.yml).
// It mimics the real services' pagination, filtering and error behaviour closely enough to
// exercise the app end to end through the real nginx proxy, without spending real API quota:
//   NewsAPI   GET /v2/{top-headlines,everything}   page*pageSize capped at 100 -> HTTP 426
//   Guardian  GET /search                          `pages` / `currentPage` envelope
//   NYT       GET /svc/search/v2/articlesearch.json  10 docs per page, 0-based page, optional 5 req/min limit
// Test control plane (never reachable through the app's proxy):
//   POST /__control {source, mode, delayMs}   ok | error | slow | ratelimit | strict-rate | malformed
//   POST /__articles {source, articles}       replace one source's dataset (an article may set `author`)
//   POST /__reset                             back to defaults and clear the log
//   GET  /__log                               every upstream request since the last reset
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4010);
const SOURCES = ['newsapi', 'guardian', 'nyt'];
const NOW = Date.now();
const MIN = 60_000;

const TOPICS = [
  ['markets', 'business'],
  ['election', 'politics'],
  ['climate', 'science'],
  ['chips', 'technology'],
  ['vaccine', 'health'],
  ['league', 'sports'],
  ['festival', 'entertainment'],
  ['summit', 'world'],
];

// Each source publishes at its own rate, so a correct merge has to interleave them by date.
const DENSITY = {
  newsapi: { count: 160, step: 20 },
  guardian: { count: 300, step: 15 },
  nyt: { count: 120, step: 25 },
};
const LABEL = { newsapi: 'Wire', guardian: 'Guardian', nyt: 'Times' };

const generate = (source) => {
  const { count, step } = DENSITY[source];
  return Array.from({ length: count }, (_, i) => {
    const [topic, section] = TOPICS[(i + SOURCES.indexOf(source)) % TOPICS.length];
    return {
      title: `${LABEL[source]} ${String(i + 1).padStart(3, '0')}: ${topic} update`,
      section,
      topic,
      publishedAt: new Date(NOW - (i + 1) * step * MIN).toISOString(),
    };
  });
};

let datasets;
let modes;
let log;
let nytCalls;
const reset = () => {
  datasets = Object.fromEntries(SOURCES.map((source) => [source, generate(source)]));
  modes = Object.fromEntries(SOURCES.map((source) => [source, { mode: 'ok', delayMs: 3000 }]));
  log = [];
  nytCalls = [];
};
reset();

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
  });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseBound = (value, endOfDay) => {
  if (!value) return undefined;
  if (/^\d{8}$/.test(value)) value = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return Date.parse(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : time;
};

const SOURCE_BYLINE = {
  newsapi: (article) => article.author ?? `Reporter ${article.title.length % 5}`,
  guardian: (article) => article.author ?? `Staff Writer ${article.title.length % 4}`,
  nyt: (article) => `By ${article.author ?? `Desk Writer ${article.title.length % 3}`}`,
};

/**
 * Author search as the app sends it: `("A" OR "B")` optionally followed by ` AND (keyword)`.
 * Phrases match the byline (Guardian: when query-fields includes byline; NYT: always, as a
 * phrase search); anything else is a plain title keyword.
 */
const matchesQuery = (article, q, byline) => {
  if (!q) return true;
  const authorGroup = q.match(/^\(((?:"[^"]+"(?: OR )?)+)\)(?: AND \((.*)\))?$/);
  if (!authorGroup) return article.title.toLowerCase().includes(q.toLowerCase());
  const names = [...authorGroup[1].matchAll(/"([^"]+)"/g)].map((match) => match[1].toLowerCase());
  const keyword = authorGroup[2];
  if (keyword && !article.title.toLowerCase().includes(keyword.toLowerCase())) return false;
  return names.some((name) => byline.toLowerCase().includes(name));
};

const filter = (items, { q, from, to, section, byline }) =>
  items.filter((article) => {
    const time = Date.parse(article.publishedAt);
    if (!matchesQuery(article, q, byline?.(article) ?? '')) return false;
    if (section && !section.includes(article.section)) return false;
    if (from !== undefined && time < from) return false;
    if (to !== undefined && time > to) return false;
    return true;
  });

const host = (source) => `https://example.test/${source}`;
const slug = (article) => article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Applies the per-source failure mode; returns true when the response was already sent. */
const applyMode = async (source, res) => {
  const { mode, delayMs } = modes[source];
  if (mode === 'slow') await sleep(delayMs);
  if (mode === 'error') return (send(res, 500, { message: 'Internal Server Error' }), true);
  if (mode === 'ratelimit')
    return (send(res, 429, { message: 'Too Many Requests' }, { 'retry-after': '60' }), true);
  if (mode === 'malformed') return (send(res, 200, { unexpected: true }), true);
  if (mode === 'strict-rate' && source === 'nyt') {
    const now = Date.now();
    nytCalls = nytCalls.filter((calledAt) => now - calledAt < 60_000);
    if (nytCalls.length >= 5) {
      return (
        send(res, 429, {
          fault: { faultstring: 'Rate limit quota violation. Quota limit exceeded.' },
        }),
        true
      );
    }
    nytCalls.push(now);
  }
  return false;
};

const handlers = {
  async newsapi(url, req, res) {
    if (!req.headers['x-api-key'])
      return send(res, 401, { status: 'error', code: 'apiKeyMissing' });
    const params = url.searchParams;
    const page = Number(params.get('page') ?? 1);
    const pageSize = Number(params.get('pageSize') ?? 20);
    if (page * pageSize > 100) {
      return send(res, 426, {
        status: 'error',
        code: 'maximumResultsReached',
        message:
          'You have requested too many results. Developer accounts are limited to a max of 100 results.',
      });
    }
    const headlines = url.pathname.endsWith('/top-headlines');
    const all = filter(datasets.newsapi, {
      q: params.get('q') === 'news' ? undefined : params.get('q'),
      from: parseBound(params.get('from')),
      to: parseBound(params.get('to'), true),
      section: headlines ? params.get('category') : undefined,
    });
    const slice = all.slice((page - 1) * pageSize, page * pageSize);
    send(res, 200, {
      status: 'ok',
      totalResults: all.length,
      articles: slice.map((article) => ({
        source: { id: null, name: ['BBC News', 'Reuters', 'CNN'][article.title.length % 3] },
        author: SOURCE_BYLINE.newsapi(article),
        title: `${article.title} - ${['BBC News', 'Reuters', 'CNN'][article.title.length % 3]}`,
        description: `Summary for ${article.title}. A reasonably long description so cards have realistic height.`,
        url: `${host('newsapi')}/${slug(article)}`,
        urlToImage: null,
        publishedAt: article.publishedAt,
      })),
    });
  },

  async guardian(url, _req, res) {
    const params = url.searchParams;
    if (!params.get('api-key'))
      return send(res, 401, { message: 'Invalid authentication credentials' });
    const page = Number(params.get('page') ?? 1);
    const pageSize = Number(params.get('page-size') ?? 10);
    const bylineSearch = params.get('query-fields')?.includes('byline');
    const all = filter(datasets.guardian, {
      byline: bylineSearch ? SOURCE_BYLINE.guardian : undefined,
      q: params.get('q'),
      from: parseBound(params.get('from-date')),
      to: parseBound(params.get('to-date'), true),
      section: params
        .get('section')
        ?.split('|')
        .map(
          (section) =>
            ({ society: 'health', sport: 'sports', culture: 'entertainment' })[section] ?? section,
        ),
    });
    const pages = Math.max(1, Math.ceil(all.length / pageSize));
    const slice = all.slice((page - 1) * pageSize, page * pageSize);
    send(res, 200, {
      response: {
        status: 'ok',
        total: all.length,
        pageSize,
        currentPage: page,
        pages,
        results: slice.map((article) => ({
          id: `${article.section}/${slug(article)}`,
          sectionId: article.section,
          sectionName: article.section,
          webPublicationDate: article.publishedAt,
          webTitle: article.title,
          webUrl: `${host('guardian')}/${slug(article)}`,
          fields: {
            trailText: `Summary for ${article.title}.`,
            byline: SOURCE_BYLINE.guardian(article),
          },
        })),
      },
    });
  },

  async nyt(url, _req, res) {
    const params = url.searchParams;
    if (!params.get('api-key'))
      return send(res, 401, { fault: { faultstring: 'Failed to resolve API Key variable' } });
    const page = Number(params.get('page') ?? 0);
    const sectionMatch = params.get('fq')?.match(/section_name:\((.*)\)/)?.[1];
    const sections = sectionMatch
      ? [...sectionMatch.matchAll(/"([^"]+)"/g)].map((match) => match[1].toLowerCase())
      : undefined;
    const all = filter(datasets.nyt, {
      byline: SOURCE_BYLINE.nyt,
      q: params.get('q'),
      from: parseBound(params.get('begin_date')),
      to: parseBound(params.get('end_date'), true),
      section: sections,
    });
    const slice = all.slice(page * 10, page * 10 + 10);
    send(res, 200, {
      status: 'OK',
      response: {
        docs: slice.length
          ? slice.map((article) => ({
              _id: `nyt://article/${slug(article)}`,
              web_url: `${host('nyt')}/${slug(article)}`,
              headline: { main: article.title },
              abstract: `Summary for ${article.title}.`,
              byline: { original: SOURCE_BYLINE.nyt(article) },
              section_name: article.section[0].toUpperCase() + article.section.slice(1),
              news_desk: article.section,
              pub_date: article.publishedAt.replace('Z', '+0000'),
              multimedia: [],
            }))
          : null,
        meta: { hits: all.length, offset: page * 10 },
      },
    });
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://mock');
  const started = Date.now();

  if (url.pathname === '/__reset') return (reset(), send(res, 200, { ok: true }));
  if (url.pathname === '/__log') return send(res, 200, log);
  if (url.pathname === '/__health') return send(res, 200, { ok: true });
  if (url.pathname === '/__control') {
    const { source, mode, delayMs } = await readBody(req);
    for (const sourceId of source === '*' ? SOURCES : [source])
      modes[sourceId] = { mode, delayMs: delayMs ?? 3000 };
    return send(res, 200, modes);
  }
  if (url.pathname === '/__articles') {
    const { source, articles } = await readBody(req);
    datasets[source] = articles.map((article) => ({
      topic: 'custom',
      section: 'world',
      ...article,
    }));
    return send(res, 200, { ok: true, count: datasets[source].length });
  }

  const source = url.pathname.startsWith('/v2/')
    ? 'newsapi'
    : url.pathname === '/search'
      ? 'guardian'
      : url.pathname.startsWith('/svc/search/v2/')
        ? 'nyt'
        : undefined;
  if (!source) return send(res, 404, { message: 'Not found' });

  let status = 0;
  const origEnd = res.end.bind(res);
  res.end = (...args) => {
    status = res.statusCode;
    log.push({
      t: started,
      source,
      path: url.pathname,
      query: Object.fromEntries([...url.searchParams].filter(([k]) => k !== 'api-key')),
      keyInjected: Boolean(req.headers['x-api-key'] || url.searchParams.get('api-key')),
      status,
      ms: Date.now() - started,
    });
    return origEnd(...args);
  };

  if (await applyMode(source, res)) return;
  await handlers[source](url, req, res);
});

server.listen(PORT, () => console.log(`mock upstream listening on :${PORT}`));
