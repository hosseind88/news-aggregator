import type { HttpClient } from '@/services/http/httpClient';
import fixture from './__fixtures__/nyt.json';
import { NytProvider } from './nytProvider';

const setup = () => {
  const getJson = vi.fn<HttpClient['getJson']>().mockResolvedValue(fixture);
  return { getJson, provider: new NytProvider({ getJson }) };
};

const REQ = { page: 1 };

describe('NytProvider', () => {
  it('returns no articles when NYT responds with docs: null (zero hits)', async () => {
    const getJson = vi.fn<HttpClient['getJson']>().mockResolvedValue({
      status: 'OK',
      response: { docs: null, metadata: { hits: 0 } },
    });
    const provider = new NytProvider({ getJson });

    await expect(provider.search({ ...REQ, keyword: 'nothing' })).resolves.toEqual({
      articles: [],
      hasMore: false,
    });
  });

  it('maps docs into unified articles', async () => {
    const { provider } = setup();
    const { articles } = await provider.search(REQ);

    expect(articles).toHaveLength(3);
    expect(articles[0]).toMatchObject({
      title: 'AI Tools Arrive',
      description: 'A new wave of AI tools.',
      url: 'https://www.nytimes.com/2024/05/02/technology/ai.html',
      imageUrl: 'https://www.nytimes.com/images/2024/05/02/thumb.jpg',
      authors: ['Ann Author', 'Bob Coauthor', 'Cy Third'],
      source: 'nyt',
      sourceName: 'The New York Times',
      category: 'technology',
      publishedAt: '2024-05-02T10:00:00.000Z',
    });
    expect(articles[1]).toMatchObject({
      description: 'Only a snippet.',
      imageUrl: undefined,
      authors: [],
      category: 'business', // "Business Day" is not a raw label we show
    });
  });

  it('keeps absolute image URLs, drops the NYT byline-as-author and maps Arts to entertainment', async () => {
    const { provider } = setup();
    const arts = (await provider.search(REQ)).articles[2];
    expect(arts).toMatchObject({
      imageUrl: 'https://static01.nyt.com/images/a.jpg',
      authors: [],
      category: 'entertainment',
    });
  });

  it('maps unified filters to NYT params (YYYYMMDD dates, fq facet, 0-based page)', async () => {
    const { provider, getJson } = setup();
    await provider.search({
      keyword: 'ai',
      from: '2024-05-01',
      to: '2024-05-03',
      categories: ['technology', 'entertainment'],
      page: 1,
    });

    expect(getJson).toHaveBeenCalledWith(
      '/api/nyt/articlesearch.json',
      expect.objectContaining({
        q: 'ai',
        begin_date: '20240501',
        end_date: '20240503',
        fq: 'section_name:("Technology" "Arts")',
        page: 0,
      }),
      expect.anything(),
    );
  });

  it('widens a local-day range to the UTC days it touches', async () => {
    process.env.TZ = 'Pacific/Auckland'; // UTC+13 in October: local Oct 27 starts on UTC Oct 26
    const { provider, getJson } = setup();
    await provider.search({ page: 1, from: '2026-10-27', to: '2026-10-27' });

    expect(getJson.mock.calls[0]?.[1]).toMatchObject({
      begin_date: '20261026',
      end_date: '20261027',
    });
  });

  it('stops paging at the end of the hits or the 1000-result cap', async () => {
    const withHits = (hits: number) => ({
      response: { docs: fixture.response.docs, meta: { hits } },
    });
    const getJson = vi
      .fn<HttpClient['getJson']>()
      .mockResolvedValueOnce(withHits(25))
      .mockResolvedValueOnce(withHits(25))
      .mockResolvedValueOnce(withHits(5000))
      .mockResolvedValueOnce(withHits(5000));
    const provider = new NytProvider({ getJson });

    expect((await provider.search({ page: 2 })).hasMore).toBe(true);
    expect((await provider.search({ page: 3 })).hasMore).toBe(false);
    expect((await provider.search({ page: 99 })).hasMore).toBe(true);
    expect((await provider.search({ page: 100 })).hasMore).toBe(false);
  });

  it('phrase-searches followed authors in q', async () => {
    const { provider, getJson } = setup();
    await provider.search({ page: 1, authors: ['Ann Author'] });
    expect(getJson.mock.calls[0]?.[1]).toMatchObject({ q: '("Ann Author")' });
  });
});
