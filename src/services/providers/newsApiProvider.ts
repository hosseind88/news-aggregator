import { z } from 'zod';
import type { Article, Category, NewsProvider, SearchParams } from '@/domain/news';
import type { HttpClient } from '@/services/http/httpClient';
import { createArticle } from '@/services/normalize';
import { parseItems, supportedCategoriesOf } from './shared';

const PAGE_SIZE = 20;

/** NewsAPI top-headlines categories; it has no world/politics bucket. */
const CATEGORY_MAP: Partial<Record<Category, string>> = {
  business: 'business',
  entertainment: 'entertainment',
  health: 'health',
  science: 'science',
  sports: 'sports',
  technology: 'technology',
};

const articleSchema = z.object({
  source: z.object({ name: z.string().nullish() }).nullish(),
  author: z.string().nullish(),
  title: z.string().min(1),
  description: z.string().nullish(),
  url: z.string().url(),
  urlToImage: z.string().nullish(),
  publishedAt: z.string(),
});
type RawArticle = z.infer<typeof articleSchema>;

const responseSchema = z.object({ status: z.string(), articles: z.array(z.unknown()).default([]) });

export const mapNewsApiArticle = (raw: RawArticle, category?: Category): Article | undefined =>
  createArticle({
    source: 'newsapi',
    title: raw.title,
    description: raw.description,
    url: raw.url,
    imageUrl: raw.urlToImage,
    author: raw.author,
    publisher: raw.source?.name,
    categories: [category],
    publishedAt: raw.publishedAt,
  });

/**
 * NewsAPI has two endpoints with different capabilities:
 *  - `top-headlines`: supports category, but not date ranges
 *  - `everything`:    supports date ranges, but not category
 * We use `everything` when a date range is requested (category becomes a keyword)
 * and `top-headlines` otherwise.
 */
export class NewsApiProvider implements NewsProvider {
  readonly id = 'newsapi' as const;
  readonly name = 'NewsAPI';
  readonly supportedCategories = supportedCategoriesOf(CATEGORY_MAP);

  constructor(private readonly http: HttpClient) {}

  async search({ keyword, from, to, categories = [], page = 1 }: SearchParams): Promise<Article[]> {
    const base = { pageSize: PAGE_SIZE, page };

    if (from || to) {
      const terms = [keyword, ...categories].filter(Boolean);
      const q = terms.length ? terms.join(' ') : 'news';
      const payload = await this.http.getJson('/api/newsapi/everything', {
        ...base,
        q,
        from,
        to,
        sortBy: 'publishedAt',
        language: 'en',
      });
      return this.map(payload);
    }

    const requests = (categories.length ? categories : [undefined]).map(async (category) => {
      const payload = await this.http.getJson('/api/newsapi/top-headlines', {
        ...base,
        q: keyword,
        country: 'us',
        category: category && CATEGORY_MAP[category],
      });
      return this.map(payload, category);
    });
    return (await Promise.all(requests)).flat();
  }

  private map(payload: unknown, category?: Category): Article[] {
    const { articles } = responseSchema.parse(payload);
    return parseItems(articleSchema, articles).flatMap(
      (item) => mapNewsApiArticle(item, category) ?? [],
    );
  }
}
