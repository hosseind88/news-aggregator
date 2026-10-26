import type { HttpClient } from '@/services/http/httpClient';
import fixture from './__fixtures__/guardian.json';
import { GuardianProvider } from './guardianProvider';

const setup = () => {
  const getJson = vi.fn<HttpClient['getJson']>().mockResolvedValue(fixture);
  return { getJson, provider: new GuardianProvider({ getJson }) };
};

const REQ = { page: 1 };

describe('GuardianProvider', () => {
  it('maps results into unified articles and skips malformed ones', async () => {
    const { provider } = setup();
    const { articles } = await provider.search(REQ);

    expect(articles).toHaveLength(4);
    expect(articles[0]).toMatchObject({
      title: 'Markets edge higher',
      description: 'Investors cheer rate hopes & more.',
      url: 'https://www.theguardian.com/business/2024/may/02/markets',
      imageUrl: 'https://media.guim.co.uk/markets.jpg',
      authors: ['John Writer', 'Ann Other'],
      source: 'guardian',
      sourceName: 'The Guardian',
      publisher: undefined,
      category: 'business',
      publishedAt: '2024-05-02T09:15:00.000Z',
    });
  });

  it('maps sections to our categories and leaves unknown ones undefined', async () => {
    const { provider } = setup();
    const { articles } = await provider.search(REQ);

    expect(articles.map((a) => a.category)).toEqual([
      'business',
      'world',
      'entertainment',
      undefined,
    ]);
    expect(articles[1]).toMatchObject({ imageUrl: undefined, authors: [] }); // "US news" -> world
  });

  it('converts offset timestamps to UTC', async () => {
    const { provider } = setup();
    const film = (await provider.search(REQ)).articles[2];
    expect(film?.publishedAt).toBe('2024-04-30T11:00:00.000Z');
  });

  it('maps unified filters to Guardian query params', async () => {
    const { provider, getJson } = setup();
    await provider.search({
      keyword: 'markets',
      from: '2024-05-01',
      to: '2024-05-03',
      categories: ['business', 'sports'],
      page: 3,
    });

    expect(getJson).toHaveBeenCalledWith(
      '/api/guardian/search',
      expect.objectContaining({
        q: 'markets',
        'from-date': '2024-05-01T00:00:00.000Z',
        'to-date': '2024-05-03T23:59:59.999Z',
        section: 'business|sport',
        page: 3,
      }),
      expect.anything(),
    );
  });

  it('omits the section filter when no category is selected', async () => {
    const { provider, getJson } = setup();
    await provider.search(REQ);
    expect(getJson.mock.calls[0]?.[1]).toMatchObject({ section: undefined });
  });

  it('reports whether further pages exist from the response envelope', async () => {
    const page = (currentPage: number, pages: number) => ({
      response: { currentPage, pages, results: fixture.response.results },
    });
    const getJson = vi
      .fn<HttpClient['getJson']>()
      .mockResolvedValueOnce(page(1, 2))
      .mockResolvedValueOnce(page(2, 2));
    const provider = new GuardianProvider({ getJson });

    expect((await provider.search({ page: 1 })).hasMore).toBe(true);
    expect((await provider.search({ page: 2 })).hasMore).toBe(false);
  });

  it('forwards the abort signal to the HTTP client', async () => {
    const { provider, getJson } = setup();
    const { signal } = new AbortController();
    await provider.search({ page: 1, signal });
    expect(getJson.mock.calls[0]?.[2]).toEqual({ signal });
  });

  it('searches bylines for followed authors and combines them with the keyword', async () => {
    const { provider, getJson } = setup();
    await provider.search({ page: 1, authors: ['Jane Doe', 'Sam "Q" (Lee)'], keyword: 'markets' });
    expect(getJson.mock.calls[0]?.[1]).toMatchObject({
      q: '("Jane Doe" OR "Sam  Q   Lee") AND (markets)',
      'query-fields': 'byline,headline,body',
    });
  });

  it('leaves the default query fields alone without authors', async () => {
    const { provider, getJson } = setup();
    await provider.search({ page: 1, keyword: 'markets' });
    expect(getJson.mock.calls[0]?.[1]).toMatchObject({
      q: 'markets',
      'query-fields': undefined,
    });
  });
});
