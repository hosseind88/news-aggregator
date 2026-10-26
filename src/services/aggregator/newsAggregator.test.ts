import { makeArticle, makeProvider } from '@/test/factories';
import { NewsAggregator } from './newsAggregator';

describe('NewsAggregator', () => {
  it('merges results from all providers sorted newest first', async () => {
    const aggregator = new NewsAggregator([
      makeProvider({
        id: 'newsapi',
        search: async () => [
          makeArticle({
            id: '1',
            title: 'Old',
            url: 'https://a.com/1',
            publishedAt: '2024-01-01T00:00:00Z',
          }),
        ],
      }),
      makeProvider({
        id: 'guardian',
        search: async () => [
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
        ],
      }),
    ]);

    const { articles, failures } = await aggregator.search({});

    expect(articles.map((a) => a.title)).toEqual(['New', 'Mid', 'Old']);
    expect(failures).toEqual([]);
  });

  it('de-duplicates by canonical URL and by normalised title', async () => {
    const aggregator = new NewsAggregator([
      makeProvider({
        id: 'newsapi',
        search: async () => [
          makeArticle({ id: '1', title: 'Same story', url: 'https://www.site.com/a/?utm=x' }),
          makeArticle({ id: '2', title: 'Other story', url: 'https://site.com/b/' }),
        ],
      }),
      makeProvider({
        id: 'guardian',
        search: async () => [
          makeArticle({ id: '3', title: 'Different title', url: 'https://site.com/a' }),
          makeArticle({ id: '4', title: 'OTHER story!', url: 'https://elsewhere.com/z' }),
          makeArticle({ id: '5', title: 'Unique', url: 'https://elsewhere.com/u' }),
        ],
      }),
    ]);

    const { articles } = await aggregator.search({});

    expect(articles.map((a) => a.id).sort()).toEqual(['1', '2', '5']);
  });

  it('reports a failing provider without breaking the others', async () => {
    const aggregator = new NewsAggregator([
      makeProvider({
        id: 'newsapi',
        name: 'NewsAPI',
        search: async () => Promise.reject(new Error('boom')),
      }),
      makeProvider({ id: 'guardian', search: async () => [makeArticle({ id: 'ok' })] }),
    ]);

    const { articles, failures } = await aggregator.search({});

    expect(articles.map((a) => a.id)).toEqual(['ok']);
    expect(failures).toEqual([{ source: 'newsapi', sourceName: 'NewsAPI', message: 'boom' }]);
  });

  it('returns only failures when every provider fails', async () => {
    const aggregator = new NewsAggregator([
      makeProvider({ id: 'nyt', search: async () => Promise.reject('nope') }),
    ]);
    const result = await aggregator.search({});
    expect(result.articles).toEqual([]);
    expect(result.failures[0]?.message).toBe('Unknown error');
  });

  it('only queries the selected sources', async () => {
    const newsapi = vi.fn().mockResolvedValue([]);
    const guardian = vi.fn().mockResolvedValue([]);
    const aggregator = new NewsAggregator([
      makeProvider({ id: 'newsapi', search: newsapi }),
      makeProvider({ id: 'guardian', search: guardian }),
    ]);

    await aggregator.search({ sources: ['guardian'], keyword: 'x' });

    expect(newsapi).not.toHaveBeenCalled();
    expect(guardian).toHaveBeenCalledWith({ keyword: 'x' });
  });

  it('skips providers that support none of the requested categories', async () => {
    const business = vi.fn().mockResolvedValue([]);
    const sports = vi.fn().mockResolvedValue([]);
    const aggregator = new NewsAggregator([
      makeProvider({ id: 'newsapi', supportedCategories: ['business'], search: business }),
      makeProvider({ id: 'guardian', supportedCategories: ['sports'], search: sports }),
    ]);

    await aggregator.search({ categories: ['sports'] });

    expect(business).not.toHaveBeenCalled();
    expect(sports).toHaveBeenCalled();
  });
});
