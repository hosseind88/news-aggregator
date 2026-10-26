/** Unified domain model. Every provider adapter maps its payload into these types. */

export const SOURCE_IDS = ['newsapi', 'guardian', 'nyt'] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export const CATEGORIES = [
  'world',
  'politics',
  'business',
  'technology',
  'science',
  'health',
  'sports',
  'entertainment',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Article {
  id: string;
  title: string;
  description?: string;
  url: string;
  imageUrl?: string;
  /** Canonical, title-cased person names; empty when the byline is missing or not a person. */
  authors: string[];
  /** Which API the article came from. */
  source: SourceId;
  /** Display name of that API's brand (always `SOURCE_LABELS[source]`). */
  sourceName: string;
  /** Underlying outlet when the API aggregates others (NewsAPI: "BBC News"); otherwise undefined. */
  publisher?: string;
  /** Mapped onto our own taxonomy; undefined when the raw section has no equivalent. */
  category?: Category;
  /** ISO-8601 UTC, e.g. `2024-05-02T10:00:00.000Z`. */
  publishedAt: string;
}

/** Provider-agnostic filters. Dates are `YYYY-MM-DD`. */
export interface SearchParams {
  keyword?: string;
  from?: string;
  to?: string;
  categories?: Category[];
  page?: number;
}

export interface NewsProvider {
  readonly id: SourceId;
  readonly name: string;
  /** Categories this source can filter on; others are skipped by the aggregator. */
  readonly supportedCategories: readonly Category[];
  search(params: SearchParams): Promise<Article[]>;
}

export interface SourceFailure {
  source: SourceId;
  sourceName: string;
  message: string;
}

export interface AggregatedResult {
  articles: Article[];
  failures: SourceFailure[];
}

export interface NewsService {
  readonly providers: readonly Pick<NewsProvider, 'id' | 'name'>[];
  search(params: SearchParams & { sources?: SourceId[] }): Promise<AggregatedResult>;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  world: 'World',
  politics: 'Politics',
  business: 'Business',
  technology: 'Technology',
  science: 'Science',
  health: 'Health',
  sports: 'Sports',
  entertainment: 'Entertainment',
};

export const SOURCE_LABELS: Record<SourceId, string> = {
  newsapi: 'NewsAPI',
  guardian: 'The Guardian',
  nyt: 'The New York Times',
};
