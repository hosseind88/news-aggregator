import { HttpError, SourceExhaustedError } from '@/services/errors';
import type { HttpClient } from '@/services/http/httpClient';
import fixture from './__fixtures__/newsapi.json';
import { NewsApiProvider } from './newsApiProvider';

const setup = () => {
  const getJson = vi.fn<HttpClient['getJson']>().mockResolvedValue(fixture);
  return { getJson, provider: new NewsApiProvider({ getJson }) };
};

const REQ = { page: 1 };

describe('NewsApiProvider', () => {
  it('maps the payload into unified articles and drops removed/malformed items', async () => {
    const { provider } = setup();
    const { articles } = await provider.search(REQ);

    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({
      title: 'Chip makers rally on AI demand',
      description: 'Shares & bonds rose sharply. Read more',
      url: 'https://www.bbc.co.uk/news/chips',
      imageUrl: 'https://img.example.com/chips.jpg',
      authors: ['Jane Reporter', "John O'Neil"],
      source: 'newsapi',
      sourceName: 'NewsAPI',
      publisher: 'BBC News',
      category: undefined,
      publishedAt: '2024-05-02T08:30:00.000Z',
    });
    expect(articles[0]?.id).toMatch(/^newsapi-/);
    expect(articles[1]).toMatchObject({
      title: 'No image & no fuss',
      publisher: 'Wire',
      authors: [],
      imageUrl: 'https://img.example.com/story.jpg?w=1',
    });
  });

  it('uses top-headlines with keyword and category when no date range is given', async () => {
    const { provider, getJson } = setup();
    await provider.search({ keyword: 'chips', categories: ['technology'], page: 2 });

    expect(getJson).toHaveBeenCalledWith(
      '/api/newsapi/top-headlines',
      expect.objectContaining({ q: 'chips', category: 'technology', page: 2, country: 'us' }),
      { signal: undefined },
    );
  });

  it('issues one request per category and tags articles with it', async () => {
    const { provider, getJson } = setup();
    const { articles } = await provider.search({ ...REQ, categories: ['business', 'health'] });

    expect(getJson).toHaveBeenCalledTimes(2);
    expect(articles.map((article) => article.category)).toContain('health');
  });

  it('switches to the everything endpoint when a date range is given', async () => {
    const { provider, getJson } = setup();
    await provider.search({
      ...REQ,
      keyword: 'ai',
      categories: ['science'],
      from: '2024-05-01',
      to: '2024-05-03',
    });

    expect(getJson).toHaveBeenCalledOnce();
    expect(getJson).toHaveBeenCalledWith(
      '/api/newsapi/everything',
      expect.objectContaining({
        q: 'ai science',
        from: '2024-05-01T00:00:00.000Z',
        to: '2024-05-03T23:59:59.999Z',
      }),
      { signal: undefined },
    );
  });

  it('rejects when the response envelope is invalid', async () => {
    const getJson = vi.fn().mockResolvedValue({ unexpected: true });
    await expect(new NewsApiProvider({ getJson }).search(REQ)).rejects.toThrow();
  });

  it('stops at the plan cap of 100 results and treats HTTP 426 as exhaustion, not failure', async () => {
    const capped = { ...fixture, totalResults: 160 };
    const getJson = vi
      .fn<HttpClient['getJson']>()
      .mockResolvedValueOnce(capped)
      .mockResolvedValueOnce(capped)
      .mockRejectedValueOnce(new HttpError(426, 'cap'));
    const provider = new NewsApiProvider({ getJson });

    expect((await provider.search({ page: 4 })).hasMore).toBe(true);
    expect((await provider.search({ page: 5 })).hasMore).toBe(false);
    await expect(provider.search({ page: 6 })).rejects.toBeInstanceOf(SourceExhaustedError);
  });

  it('sends the local day as exact instants in a non-UTC zone', async () => {
    process.env.TZ = 'America/Los_Angeles';
    const { provider, getJson } = setup();
    await provider.search({ page: 1, from: '2024-05-01', to: '2024-05-01' });

    expect(getJson.mock.calls[0]?.[1]).toMatchObject({
      from: '2024-05-01T07:00:00.000Z',
      to: '2024-05-02T06:59:59.999Z',
    });
  });
});
