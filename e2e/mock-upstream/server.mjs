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
  datasets = Object.fromEntries(SOURCES.map((s) => [s, generate(s)]));
  modes = Object.fromEntries(SOURCES.map((s) => [s, { mode: 'ok', delayMs: 3000 }]));
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
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw ? JSON.parse(raw) : {}));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parseBound = (value, endOfDay) => {
  if (!value) return undefined;
  if (/^\d{8}$/.test(value)) value = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return Date.parse(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  }
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : t;
};

const SOURCE_BYLINE = {
  newsapi: (a) => a.author ?? `Reporter ${a.title.length % 5}`,
  guardian: (a) => a.author ?? `Staff Writer ${a.title.length % 4}`,
  nyt: (a) => `By ${a.author ?? `Desk Writer ${a.title.length % 3}`}`,
};

/**
 * Author search as the app sends it: `("A" OR "B")` optionally followed by ` AND (keyword)`.
 * Phrases match the byline (Guardian: when query-fields includes byline; NYT: always, as a
 * phrase search); anything else is a plain title keyword.
 */
const matchesQuery = (a, q, byline) => {
  if (!q) return true;
  const authorGroup = q.match(/^\(((?:"[^"]+"(?: OR )?)+)\)(?: AND \((.*)\))?$/);
  if (!authorGroup) return a.title.toLowerCase().includes(q.toLowerCase());
  const names = [...authorGroup[1].matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase());
  const keyword = authorGroup[2];
  if (keyword && !a.title.toLowerCase().includes(keyword.toLowerCase())) return false;
  return names.some((name) => byline.toLowerCase().includes(name));
};

const filter = (items, { q, from, to, section, byline }) =>
  items.filter((a) => {
    const t = Date.parse(a.publishedAt);
    if (!matchesQuery(a, q, byline?.(a) ?? '')) return false;
    if (section && !section.includes(a.section)) return false;
    if (from !== undefined && t < from) return false;
    if (to !== undefined && t > to) return false;
    return true;
  });

const host = (source) => `https://example.test/${source}`;
const slug = (a) => a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

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
    nytCalls = nytCalls.filter((t) => now - t < 60_000);
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
    const p = url.searchParams;
    const page = Number(p.get('page') ?? 1);
    const pageSize = Number(p.get('pageSize') ?? 20);
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
      q: p.get('q') === 'news' ? undefined : p.get('q'),
      from: parseBound(p.get('from')),
      to: parseBound(p.get('to'), true),
      section: headlines ? p.get('category') : undefined,
    });
    const slice = all.slice((page - 1) * pageSize, page * pageSize);
    send(res, 200, {
      status: 'ok',
      totalResults: all.length,
      articles: slice.map((a) => ({
        source: { id: null, name: ['BBC News', 'Reuters', 'CNN'][a.title.length % 3] },
        author: SOURCE_BYLINE.newsapi(a),
        title: `${a.title} - ${['BBC News', 'Reuters', 'CNN'][a.title.length % 3]}`,
        description: `Summary for ${a.title}. A reasonably long description so cards have realistic height.`,
        url: `${host('newsapi')}/${slug(a)}`,
        urlToImage: null,
        publishedAt: a.publishedAt,
      })),
    });
  },

  async guardian(url, _req, res) {
    const p = url.searchParams;
    if (!p.get('api-key')) return send(res, 401, { message: 'Invalid authentication credentials' });
    const page = Number(p.get('page') ?? 1);
    const pageSize = Number(p.get('page-size') ?? 10);
    const bylineSearch = p.get('query-fields')?.includes('byline');
    const all = filter(datasets.guardian, {
      byline: bylineSearch ? SOURCE_BYLINE.guardian : undefined,
      q: p.get('q'),
      from: parseBound(p.get('from-date')),
      to: parseBound(p.get('to-date'), true),
      section: p
        .get('section')
        ?.split('|')
        .map((s) => ({ society: 'health', sport: 'sports', culture: 'entertainment' })[s] ?? s),
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
        results: slice.map((a) => ({
          id: `${a.section}/${slug(a)}`,
          sectionId: a.section,
          sectionName: a.section,
          webPublicationDate: a.publishedAt,
          webTitle: a.title,
          webUrl: `${host('guardian')}/${slug(a)}`,
          fields: {
            trailText: `Summary for ${a.title}.`,
            byline: SOURCE_BYLINE.guardian(a),
          },
        })),
      },
    });
  },

  async nyt(url, _req, res) {
    const p = url.searchParams;
    if (!p.get('api-key'))
      return send(res, 401, { fault: { faultstring: 'Failed to resolve API Key variable' } });
    const page = Number(p.get('page') ?? 0);
    const sectionMatch = p.get('fq')?.match(/section_name:\((.*)\)/)?.[1];
    const sections = sectionMatch
      ? [...sectionMatch.matchAll(/"([^"]+)"/g)].map((m) => m[1].toLowerCase())
      : undefined;
    const all = filter(datasets.nyt, {
      byline: SOURCE_BYLINE.nyt,
      q: p.get('q'),
      from: parseBound(p.get('begin_date')),
      to: parseBound(p.get('end_date'), true),
      section: sections,
    });
    const slice = all.slice(page * 10, page * 10 + 10);
    send(res, 200, {
      status: 'OK',
      response: {
        docs: slice.length
          ? slice.map((a) => ({
              _id: `nyt://article/${slug(a)}`,
              web_url: `${host('nyt')}/${slug(a)}`,
              headline: { main: a.title },
              abstract: `Summary for ${a.title}.`,
              byline: { original: SOURCE_BYLINE.nyt(a) },
              section_name: a.section[0].toUpperCase() + a.section.slice(1),
              news_desk: a.section,
              pub_date: a.publishedAt.replace('Z', '+0000'),
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
    for (const s of source === '*' ? SOURCES : [source])
      modes[s] = { mode, delayMs: delayMs ?? 3000 };
    return send(res, 200, modes);
  }
  if (url.pathname === '/__articles') {
    const { source, articles } = await readBody(req);
    datasets[source] = articles.map((a) => ({ topic: 'custom', section: 'world', ...a }));
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
