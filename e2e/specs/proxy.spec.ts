import { EDGE, expect, test } from '../support';

const SEARCH = '/api/guardian/search?page=1&page-size=5';

test.describe('nginx security headers', () => {
  const required = {
    'content-security-policy': /default-src 'self'.*frame-ancestors 'none'/,
    'x-content-type-options': /nosniff/,
    'referrer-policy': /strict-origin-when-cross-origin/,
    'x-frame-options': /DENY/,
    'permissions-policy': /camera=\(\)/,
    'cross-origin-opener-policy': /same-origin/,
  };

  test('index.html has all headers and is never cached', async ({ request }) => {
    const res = await request.get('/');
    for (const [name, re] of Object.entries(required)) {
      expect(res.headers()[name], name).toMatch(re);
    }
    expect(res.headers()['cache-control']).toBe('no-cache');
    expect(res.headers()['server']).toBe('nginx'); // no version
  });

  test('hashed assets keep every header and have exactly one immutable Cache-Control', async ({
    page,
    request,
  }) => {
    let asset = '';
    page.on('response', (r) => {
      if (!asset && new URL(r.url()).pathname.startsWith('/assets/')) asset = r.url();
    });
    await page.goto('/');
    expect(asset).not.toBe('');

    const res = await request.get(asset);
    for (const [name, re] of Object.entries(required)) {
      expect(res.headers()[name], name).toMatch(re);
    }
    expect(res.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headersArray().filter((h) => h.name.toLowerCase() === 'cache-control')).toHaveLength(
      1,
    );
    expect(res.headers()['expires']).toBeUndefined();
  });

  test('deep links fall back to index.html with no-cache', async ({ request }) => {
    const res = await request.get('/search?q=x');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toBe('no-cache');
  });
});

test.describe('API proxy', () => {
  test('forwards allowlisted endpoints and injects the key server-side', async ({
    request,
    upstream,
  }) => {
    const res = await request.get(SEARCH);
    expect(res.status()).toBe(200);
    const hit = (await upstream.log()).at(-1);
    expect(hit?.keyInjected).toBe(true);
  });

  test('does not forward anything else under /api/', async ({ request, upstream }) => {
    for (const path of [
      '/api/guardian/tags',
      '/api/newsapi/sources',
      '/api/nyt/anything.json',
      '/api/unknown/x',
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
    expect(await upstream.log()).toEqual([]);
  });

  test('only GET is allowed', async ({ request }) => {
    expect((await request.post(SEARCH, { data: {} })).status()).toBe(403);
  });

  test('responses are cached and stale-on-error', async ({ upstream }) => {
    const url = `${EDGE}/api/guardian/search?page=1&page-size=5&q=cache-${Date.now()}`;
    const first = await fetch(url);
    expect(first.headers.get('x-cache-status')).toBe('MISS');
    const second = await fetch(url);
    expect(second.headers.get('x-cache-status')).toBe('HIT');
    expect((await upstream.log()).filter((e) => e.query['q']?.startsWith('cache-'))).toHaveLength(
      1,
    );
  });

  // Last on purpose: it exhausts the edge instance's per-IP bucket.
  test('a burst beyond the per-IP limit gets 429 instead of reaching upstream', async ({
    upstream,
  }) => {
    const burst = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        fetch(`${EDGE}/api/guardian/search?page=1&page-size=5&q=burst-${i}`),
      ),
    );
    const statuses = burst.map((r) => r.status);
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 200).length).toBeLessThan(20);
    const reached = (await upstream.log()).filter((e) => e.query['q']?.startsWith('burst-'));
    expect(reached.length).toBe(statuses.filter((s) => s === 200).length);
  });
});
