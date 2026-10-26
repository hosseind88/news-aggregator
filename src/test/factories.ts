import type { Article, NewsProvider } from '@/domain/news';

export const makeArticle = (overrides: Partial<Article> = {}): Article => ({
  id: 'a-1',
  title: 'Default headline',
  url: 'https://example.com/default',
  authors: [],
  source: 'newsapi',
  sourceName: 'Example',
  publishedAt: '2024-05-01T10:00:00.000Z',
  ...overrides,
});

export const makeProvider = (
  overrides: Partial<NewsProvider> & Pick<NewsProvider, 'id'>,
): NewsProvider => ({
  name: overrides.id,
  supportedCategories: ['business', 'technology'],
  search: async () => [],
  ...overrides,
});
