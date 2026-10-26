import type { HttpClient } from '@/services/http/httpClient';
import fixture from './__fixtures__/newsapi.json';
import { NewsApiProvider } from './newsApiProvider';

const setup = () => {
  const getJson = vi.fn<HttpClient['getJson']>().mockResolvedValue(fixture);
  return { getJson, provider: new NewsApiProvider({ getJson }) };
};

describe('NewsApiProvider', () => {
  it('maps the payload into unified articles and drops removed/malformed items', async () => {
    const { provider } = setup();
    const articles = await provider.search({});

    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({
      title: 'Chip makers rally on AI demand',
      description: 'Shares rose sharply.',
      url: 'https://www.bbc.co.uk/news/chips',
      imageUrl: 'https://img.example.com/chips.jpg',
      author: 'Jane Reporter',
      source: 'newsapi',
      sourceName: 'BBC News',
      publishedAt: '2024-05-02T08:30:00Z',
    });
    expect(articles[0]?.id).toMatch(/^newsapi-/);
    expect(articles[1]).toMatchObject({ sourceName: 'Wire', author: undefined });
  });

  it('uses top-headlines with keyword and category when no date range is given', async () => {
    const { provider, getJson } = setup();
    await provider.search({ keyword: 'chips', categories: ['technology'], page: 2 });

    expect(getJson).toHaveBeenCalledWith(
      '/api/newsapi/top-headlines',
      expect.objectContaining({ q: 'chips', category: 'technology', page: 2, country: 'us' }),
    );
  });

  it('issues one request per category and tags articles with it', async () => {
    const { provider, getJson } = setup();
    const articles = await provider.search({ categories: ['business', 'health'] });

    expect(getJson).toHaveBeenCalledTimes(2);
    expect(articles.map((a) => a.category)).toContain('health');
  });

  it('switches to the everything endpoint when a date range is given', async () => {
    const { provider, getJson } = setup();
    await provider.search({
      keyword: 'ai',
      categories: ['science'],
      from: '2024-05-01',
      to: '2024-05-03',
    });

    expect(getJson).toHaveBeenCalledOnce();
    expect(getJson).toHaveBeenCalledWith(
      '/api/newsapi/everything',
      expect.objectContaining({ q: 'ai science', from: '2024-05-01', to: '2024-05-03' }),
    );
  });

  it('rejects when the response envelope is invalid', async () => {
    const getJson = vi.fn().mockResolvedValue({ unexpected: true });
    await expect(new NewsApiProvider({ getJson }).search({})).rejects.toThrow();
  });
});
