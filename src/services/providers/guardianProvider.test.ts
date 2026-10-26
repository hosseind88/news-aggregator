import type { HttpClient } from '@/services/http/httpClient';
import fixture from './__fixtures__/guardian.json';
import { GuardianProvider } from './guardianProvider';

const setup = () => {
  const getJson = vi.fn<HttpClient['getJson']>().mockResolvedValue(fixture);
  return { getJson, provider: new GuardianProvider({ getJson }) };
};

describe('GuardianProvider', () => {
  it('maps results into unified articles and skips malformed ones', async () => {
    const { provider } = setup();
    const articles = await provider.search({});

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
    const articles = await provider.search({});

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
    const film = (await provider.search({}))[2];
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
        'from-date': '2024-05-01',
        'to-date': '2024-05-03',
        section: 'business|sport',
        page: 3,
      }),
    );
  });

  it('omits the section filter when no category is selected', async () => {
    const { provider, getJson } = setup();
    await provider.search({});
    expect(getJson.mock.calls[0]?.[1]).toMatchObject({ section: undefined });
  });
});
