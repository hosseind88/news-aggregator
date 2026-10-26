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

    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({
      title: 'Markets edge higher',
      description: 'Investors cheer rate hopes.',
      url: 'https://www.theguardian.com/business/2024/may/02/markets',
      imageUrl: 'https://media.guim.co.uk/markets.jpg',
      author: 'John Writer',
      source: 'guardian',
      sourceName: 'The Guardian',
      category: 'Business',
      publishedAt: '2024-05-02T09:15:00Z',
    });
    expect(articles[1]).toMatchObject({ imageUrl: undefined, author: undefined });
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
