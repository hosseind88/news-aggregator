/**
 * Shared logic for the Vercel functions under /api. Counterpart of docker/nginx/default.conf.template:
 * the browser calls /api/<source>/<endpoint>, the function forwards an allowlisted endpoint to the
 * real API with the secret key added server-side, so keys never reach the bundle.
 * (The underscore prefix keeps Vercel from exposing this file as a route.)
 */

// Same values as the nginx defaults (API_CACHE_TTL, proxy_read_timeout, proxy_cache inactive).
const CACHE_TTL_S = 60;
const STALE_WHILE_REVALIDATE_S = 600;
const UPSTREAM_TIMEOUT_MS = 12_000;

interface UpstreamSource {
  /** Only these endpoints are forwarded; anything else is a 404 (no open proxy). */
  endpoints: ReadonlySet<string>;
  upstream: string;
  /** Upstream path prefix, from the nginx `rewrite`. */
  basePath: string;
  keyEnv: 'NEWSAPI_KEY' | 'GUARDIAN_KEY' | 'NYT_KEY';
  /** NewsAPI takes the key as a header, the others as the `api-key` query param. */
  keyIn: 'header' | 'query';
}

export const SOURCES = {
  newsapi: {
    endpoints: new Set(['everything', 'top-headlines']),
    upstream: 'https://newsapi.org',
    basePath: '/v2/',
    keyEnv: 'NEWSAPI_KEY',
    keyIn: 'header',
  },
  guardian: {
    endpoints: new Set(['search']),
    upstream: 'https://content.guardianapis.com',
    basePath: '/',
    keyEnv: 'GUARDIAN_KEY',
    keyIn: 'query',
  },
  nyt: {
    endpoints: new Set(['articlesearch.json']),
    upstream: 'https://api.nytimes.com',
    basePath: '/svc/search/v2/',
    keyEnv: 'NYT_KEY',
    keyIn: 'query',
  },
} as const satisfies Record<string, UpstreamSource>;

export type SourceName = keyof typeof SOURCES;

const createPlainResponse = (status: number, body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain', ...headers } });

export async function proxy(name: SourceName, request: Request): Promise<Response> {
  const source: UpstreamSource = SOURCES[name];
  if (request.method !== 'GET')
    return createPlainResponse(405, 'Method Not Allowed', { Allow: 'GET' });

  const url = new URL(request.url);
  const endpoint = url.pathname.replace(`/api/${name}/`, '');
  if (!url.pathname.startsWith(`/api/${name}/`) || !source.endpoints.has(endpoint)) {
    return createPlainResponse(404, 'Not Found');
  }

  const target = new URL(source.basePath + endpoint, source.upstream);
  target.search = url.search;
  const key = process.env[source.keyEnv] ?? '';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (source.keyIn === 'header') headers['X-Api-Key'] = key;
  else target.searchParams.set('api-key', key);

  try {
    const upstreamResponse = await fetch(target, {
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    // Only successful answers are edge-cached, like `proxy_cache_valid 200`.
    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': upstreamResponse.headers.get('content-type') ?? 'application/json',
        'Cache-Control': upstreamResponse.ok
          ? `public, s-maxage=${CACHE_TTL_S}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_S}`
          : 'no-store',
      },
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return createPlainResponse(timedOut ? 504 : 502, timedOut ? 'Gateway Timeout' : 'Bad Gateway', {
      'Cache-Control': 'no-store',
    });
  }
}
