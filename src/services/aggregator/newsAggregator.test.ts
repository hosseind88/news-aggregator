import { z } from 'zod';
import type { Article, ProviderRequest, SourceId } from '@/domain/news';
import { AllSourcesFailedError, HttpError, SourceExhaustedError } from '@/services/errors';
import { makeArticle, makeProvider } from '@/test/factories';
import { ARTICLES_PER_PAGE, NewsAggregator } from './newsAggregator';

const page = (articles: Article[], hasMore = false) => ({ articles, hasMore });

/** A source that serves `count` articles, `step` minutes apart, newest first, `size` per page. */
const pagedSource = (
  id: SourceId,
  { count, step, size = 10 }: { count: number; step: number; size?: number },
  start = Date.parse('2024-06-01T12:00:00Z'),
) => {
  const all = Array.from({ length: count }, (_, i) =>
    makeArticle({
      id: `${id}-${i}`,
      title: `${id} story ${i}`,
      url: `https://${id}.example.com/${i}`,
      source: id,
      publishedAt: new Date(start - i * step * 60_000).toISOString(),
    }),
  );
  const search = vi.fn(async ({ page: n }: ProviderRequest) =>
    page(all.slice((n - 1) * size, n * size), n * size < count),
  );
  return { all, search, provider: makeProvider({ id, search }) };
};

const drain = async (aggregator: NewsAggregator, params = {}) => {
  const pages: Article[][] = [];
  let cursor;
  do {
    const result = await aggregator.search(params, { cursor });
    pages.push(result.articles);
    cursor = result.nextCursor;
  } while (cursor);
  return pages;
};

describe('NewsAggregator', () => {
  it('merges results from all providers sorted newest first', async () => {
    const aggregator = new NewsAggregator([
      makeProvider({
        id: 'newsapi',
        search: async () =>
          page([
            makeArticle({
              id: '1',
              title: 'Old',
              url: 'https://a.com/1',
              publishedAt: '2024-01-01T00:00:00Z',
            }),
          ]),
      }),
      makeProvider({
        id: 'guardian',
        search: async () =>
          page([
            makeArticle({
              id: '2',
              title: 'New',
              url: 'https://b.com/2',
              publishedAt: '2024-03-01T00:00:00Z',
            }),
            makeArticle({
              id: '3',
              title: 'Mid',
              url: 'https://b.com/3',
              publishedAt: '2024-02-01T00:00:00Z',
            }),
          ]),
      }),
    ]);

    const { articles, failures, nextCursor } = await aggregator.search({});

    expect(articles.map((a) => a.title)).toEqual(['New', 'Mid', 'Old']);
    expect(failures).toEqual([]);
    expect(nextCursor).toBeUndefined();
  });

  it('de-duplicates by canonical URL and by normalised title', async () => {
    const aggregator = new NewsAggregator([
      makeProvider({
        id: 'newsapi',
        search: async () =>
          page([
            makeArticle({ id: '1', title: 'Same story', url: 'https://www.site.com/a/?utm=x' }),
            makeArticle({ id: '2', title: 'Other story', url: 'https://site.com/b/' }),
          ]),
      }),
      makeProvider({
        id: 'guardian',
        search: async () =>
          page([
            makeArticle({ id: '3', title: 'Different title', url: 'https://site.com/a' }),
            makeArticle({ id: '4', title: 'OTHER story!', url: 'https://elsewhere.com/z' }),
            makeArticle({ id: '5', title: 'Unique', url: 'https://elsewhere.com/u' }),
          ]),
      }),
    ]);

    const { articles } = await aggregator.search({});

    expect(articles.map((a) => a.id).sort()).toEqual(['1', '2', '5']);
  });

  it('breaks timestamp ties by id so the order is deterministic', async () => {
    const same = '2024-05-01T10:00:00.000Z';
    const aggregator = new NewsAggregator([
      makeProvider({
        id: 'newsapi',
        search: async () =>
          page([
            makeArticle({ id: 'b', title: 'B', url: 'https://x.com/b', publishedAt: same }),
            makeArticle({ id: 'a', title: 'A', url: 'https://x.com/a', publishedAt: same }),
          ]),
      }),
    ]);
    const { articles } = await aggregator.search({});
    expect(articles.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('reports a failing provider without breaking the others', async () => {
    const aggregator = new NewsAggregator([
      makeProvider({
        id: 'newsapi',
        name: 'NewsAPI',
        search: async () => Promise.reject(new HttpError(500, 'boom')),
      }),
      makeProvider({ id: 'guardian', search: async () => page([makeArticle({ id: 'ok' })]) }),
    ]);

    const { articles, failures } = await aggregator.search({});

    expect(articles.map((a) => a.id)).toEqual(['ok']);
    expect(failures).toEqual([{ source: 'newsapi', sourceName: 'NewsAPI', message: 'boom' }]);
  });

  it('throws AllSourcesFailedError instead of resolving empty when every provider fails', async () => {
    const aggregator = new NewsAggregator([
      makeProvider({ id: 'nyt', name: 'NYT', search: async () => Promise.reject('nope') }),
      makeProvider({
        id: 'guardian',
        search: async () => Promise.reject(new HttpError(503, 'down')),
      }),
    ]);

    const error = await aggregator.search({}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AllSourcesFailedError);
    expect((error as AllSourcesFailedError).failures.map((f) => f.message)).toEqual([
      'Something went wrong. Please try again.',
      'down',
    ]);
  });

  it('never leaks raw validation errors into per-source failure messages', async () => {
    const invalid = z.object({ status: z.string() }).safeParse({}).error;
    const aggregator = new NewsAggregator([
      makeProvider({ id: 'nyt', name: 'NYT', search: async () => Promise.reject(invalid) }),
      makeProvider({
        id: 'guardian',
        search: async () => ({ articles: [makeArticle()], hasMore: false }),
      }),
    ]);

    const { failures } = await aggregator.search({});

    expect(failures.map((f) => f.message)).toEqual([
      'The source returned data in an unexpected format',
    ]);
  });

  it('does not treat "no results" as a failure', async () => {
    const aggregator = new NewsAggregator([
      makeProvider({ id: 'nyt', search: async () => page([]) }),
    ]);
    await expect(aggregator.search({})).resolves.toMatchObject({ articles: [], failures: [] });
  });

  it('only queries the selected sources', async () => {
    const newsapi = vi.fn().mockResolvedValue(page([]));
    const guardian = vi.fn().mockResolvedValue(page([]));
    const aggregator = new NewsAggregator([
      makeProvider({ id: 'newsapi', search: newsapi }),
      makeProvider({ id: 'guardian', search: guardian }),
    ]);

    await aggregator.search({ sources: ['guardian'], keyword: 'x' });

    expect(newsapi).not.toHaveBeenCalled();
    expect(guardian).toHaveBeenCalledWith({ keyword: 'x', page: 1, signal: undefined });
  });

  it('skips providers that support none of the requested categories', async () => {
    const business = vi.fn().mockResolvedValue(page([]));
    const sports = vi.fn().mockResolvedValue(page([]));
    const aggregator = new NewsAggregator([
      makeProvider({ id: 'newsapi', supportedCategories: ['business'], search: business }),
      makeProvider({ id: 'guardian', supportedCategories: ['sports'], search: sports }),
    ]);

    await aggregator.search({ categories: ['sports'] });

    expect(business).not.toHaveBeenCalled();
    expect(sports).toHaveBeenCalled();
  });

  it('enforces the local-day date range on normalised timestamps', async () => {
    const aggregator = new NewsAggregator([
      makeProvider({
        id: 'newsapi',
        search: async () =>
          page([
            makeArticle({
              title: 'In',
              url: 'https://a.com/in',
              publishedAt: '2024-05-03T23:30:00.000Z',
            }),
            makeArticle({
              title: 'Out',
              url: 'https://a.com/out',
              publishedAt: '2024-05-04T00:30:00.000Z',
            }),
          ]),
      }),
    ]);

    const { articles } = await aggregator.search({ from: '2024-05-01', to: '2024-05-03' });
    expect(articles.map((a) => a.title)).toEqual(['In']);
  });

  describe('pagination', () => {
    const sources = () => ({
      newsapi: pagedSource('newsapi', { count: 40, step: 20 }),
      guardian: pagedSource('guardian', { count: 90, step: 7 }),
      nyt: pagedSource('nyt', { count: 25, step: 31 }),
    });

    it('yields one globally ordered, duplicate-free feed across pages', async () => {
      const s = sources();
      const aggregator = new NewsAggregator(Object.values(s).map((x) => x.provider));

      const pages = await drain(aggregator);
      const flat = pages.flat();

      expect(flat).toHaveLength(40 + 90 + 25);
      expect(new Set(flat.map((a) => a.id)).size).toBe(flat.length);
      const times = flat.map((a) => Date.parse(a.publishedAt));
      expect(times).toEqual([...times].sort((a, b) => b - a));
      pages.slice(0, -1).forEach((p) => expect(p).toHaveLength(ARTICLES_PER_PAGE));
    });

    it('never calls a source again once it reports hasMore: false', async () => {
      const s = sources();
      const aggregator = new NewsAggregator(Object.values(s).map((x) => x.provider));

      await drain(aggregator);

      expect(s.nyt.search).toHaveBeenCalledTimes(3); // 25 articles, 10 per page
      expect(s.newsapi.search).toHaveBeenCalledTimes(4);
      expect(s.guardian.search).toHaveBeenCalledTimes(9);
    });

    it('treats a source hitting its plan cap (SourceExhaustedError) as finished, not failed', async () => {
      const capped = pagedSource('newsapi', { count: 20, step: 5 });
      capped.search.mockImplementation(async ({ page: n }) => {
        if (n > 2) throw new SourceExhaustedError();
        return page(capped.all.slice((n - 1) * 10, n * 10), true);
      });
      const other = pagedSource('guardian', { count: 60, step: 30 });
      const aggregator = new NewsAggregator([capped.provider, other.provider]);

      const results = [];
      let cursor;
      do {
        const result = await aggregator.search({}, { cursor });
        results.push(result);
        cursor = result.nextCursor;
      } while (cursor);

      expect(results.flatMap((r) => r.failures)).toEqual([]);
      expect(results.flatMap((r) => r.articles)).toHaveLength(80);
      expect(capped.search).toHaveBeenCalledTimes(3);
    });

    it('keeps serving the rest when a source fails mid-scroll, then reports it instead of ending', async () => {
      const flaky = pagedSource('newsapi', { count: 60, step: 10 });
      flaky.search.mockImplementation(async ({ page: n }) => {
        if (n >= 2) throw new HttpError(429, 'rate limited');
        return page(flaky.all.slice(0, 10), true);
      });
      const steady = pagedSource('guardian', { count: 50, step: 10 });
      const aggregator = new NewsAggregator([flaky.provider, steady.provider]);

      const results = [];
      let cursor;
      let error: unknown;
      try {
        do {
          const result = await aggregator.search({}, { cursor });
          results.push(result);
          cursor = result.nextCursor;
        } while (cursor);
      } catch (e) {
        error = e;
      }

      expect(results.flatMap((r) => r.failures)).toHaveLength(1);
      expect(
        results.flatMap((r) => r.articles).filter((a) => a.source === 'guardian'),
      ).toHaveLength(50);
      // The failed source is not hammered while others serve; once they are done it is retried
      // and, still failing, the feed reports an error instead of claiming it is complete.
      expect(error).toBeInstanceOf(AllSourcesFailedError);
      expect(flaky.search).toHaveBeenCalledTimes(3);
    });

    it('throws when every source fails on a later page, leaving the cursor reusable', async () => {
      const a = pagedSource('newsapi', { count: 100, step: 10 });
      const b = pagedSource('guardian', { count: 100, step: 10 });
      const aggregator = new NewsAggregator([a.provider, b.provider]);
      const serve =
        (s: typeof a) =>
        async ({ page: n }: ProviderRequest) =>
          page(s.all.slice((n - 1) * 10, n * 10), n * 10 < 100);

      const first = await aggregator.search({});
      a.search.mockRejectedValue(new HttpError(503, 'down'));
      b.search.mockRejectedValue(new HttpError(503, 'down'));

      let cursor = first.nextCursor;
      let snapshot = JSON.stringify(cursor);
      let error: unknown;
      for (let i = 0; i < 6 && !error; i += 1) {
        try {
          const next = await aggregator.search({}, { cursor });
          cursor = next.nextCursor;
          snapshot = JSON.stringify(cursor);
        } catch (e) {
          error = e;
        }
      }
      expect(error).toBeInstanceOf(AllSourcesFailedError);
      expect(JSON.stringify(cursor)).toBe(snapshot); // the failed call left the cursor untouched

      a.search.mockImplementation(serve(a));
      b.search.mockImplementation(serve(b));
      const retried = await aggregator.search({}, { cursor });
      expect(retried.articles).toHaveLength(ARTICLES_PER_PAGE);
    });

    it('survives a JSON round-trip of the cursor', async () => {
      const s = sources();
      const aggregator = new NewsAggregator(Object.values(s).map((x) => x.provider));
      const first = await aggregator.search({});
      const revived = JSON.parse(JSON.stringify(first.nextCursor));

      const second = await aggregator.search({}, { cursor: revived });

      expect(second.articles[0]!.publishedAt <= first.articles.at(-1)!.publishedAt).toBe(true);
    });

    it('rethrows when the caller aborts instead of reporting source failures', async () => {
      const controller = new AbortController();
      const search = vi.fn(async ({ signal }: ProviderRequest) => {
        controller.abort();
        signal?.throwIfAborted();
        return page([]);
      });
      const aggregator = new NewsAggregator([makeProvider({ id: 'nyt', search })]);

      await expect(aggregator.search({}, { signal: controller.signal })).rejects.toMatchObject({
        name: 'AbortError',
      });
    });

    it('passes the signal through to providers', async () => {
      const { signal } = new AbortController();
      const s = pagedSource('nyt', { count: 3, step: 1 });
      await new NewsAggregator([s.provider]).search({}, { signal });
      expect(s.search).toHaveBeenCalledWith(expect.objectContaining({ signal }));
    });
  });
});
