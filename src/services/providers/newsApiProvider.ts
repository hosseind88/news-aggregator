import { z } from 'zod';
import type { Article, Category, NewsProvider, ProviderRequest, SourcePage } from '@/domain/news';
import { HttpError, SourceExhaustedError } from '@/services/errors';
import type { HttpClient } from '@/services/http/httpClient';
import { createArticle } from '@/services/normalize';
import { dayEndInstant, dayStartInstant, parseItems, supportedCategoriesOf } from './shared';

const PAGE_SIZE = 20;
/** The free plan serves at most 100 results per query; deeper pages answer HTTP 426. */
const RESULT_CAP = 100;

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

const responseSchema = z.object({
  status: z.string(),
  totalResults: z.number().optional(),
  articles: z.array(z.unknown()).default([]),
});

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

  async search({
    keyword,
    from,
    to,
    categories = [],
    page,
    signal,
  }: ProviderRequest): Promise<SourcePage> {
    const base = { pageSize: PAGE_SIZE, page };
    // The plan's cap is not an outage: once it is hit this source is simply finished.
    const get = async (path: string, params: Record<string, string | number | undefined>) => {
      try {
        return await this.http.getJson(path, params, { signal });
      } catch (error) {
        if (error instanceof HttpError && error.status === 426) throw new SourceExhaustedError();
        throw error;
      }
    };

    if (from || to) {
      const terms = [keyword, ...categories].filter(Boolean);
      const q = terms.length ? terms.join(' ') : 'news';
      const payload = await get('/api/newsapi/everything', {
        ...base,
        q,
        from: dayStartInstant(from),
        to: dayEndInstant(to),
        sortBy: 'publishedAt',
        language: 'en',
      });
      return this.map(payload, undefined, page);
    }

    const requests = (categories.length ? categories : [undefined]).map(async (category) => {
      const payload = await get('/api/newsapi/top-headlines', {
        ...base,
        q: keyword,
        country: 'us',
        category: category && CATEGORY_MAP[category],
      });
      return this.map(payload, category, page);
    });
    const pages = await Promise.all(requests);
    return {
      articles: pages.flatMap((result) => result.articles),
      hasMore: pages.some((result) => result.hasMore),
    };
  }

  private map(payload: unknown, category?: Category, page = 1): SourcePage {
    const { articles, totalResults } = responseSchema.parse(payload);
    const reachable = Math.min(totalResults ?? Infinity, RESULT_CAP);
    return {
      articles: parseItems(articleSchema, articles).flatMap(
        (item) => mapNewsApiArticle(item, category) ?? [],
      ),
      hasMore: articles.length > 0 && page * PAGE_SIZE < reachable,
    };
  }
}
