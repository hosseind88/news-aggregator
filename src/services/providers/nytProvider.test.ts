import type { HttpClient } from '@/services/http/httpClient';
import fixture from './__fixtures__/nyt.json';
import { NytProvider } from './nytProvider';

const setup = () => {
  const getJson = vi.fn<HttpClient['getJson']>().mockResolvedValue(fixture);
  return { getJson, provider: new NytProvider({ getJson }) };
};

describe('NytProvider', () => {
  it('maps docs into unified articles', async () => {
    const { provider } = setup();
    const articles = await provider.search({});

    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({
      title: 'AI Tools Arrive',
      description: 'A new wave of AI tools.',
      url: 'https://www.nytimes.com/2024/05/02/technology/ai.html',
      imageUrl: 'https://www.nytimes.com/images/2024/05/02/thumb.jpg',
      author: 'Ann Author and Bob Coauthor',
      source: 'nyt',
      sourceName: 'The New York Times',
      category: 'Technology',
      publishedAt: '2024-05-02T10:00:00+0000',
    });
    expect(articles[1]).toMatchObject({
      description: 'Only a snippet.',
      imageUrl: undefined,
      author: undefined,
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
    );
  });
});
