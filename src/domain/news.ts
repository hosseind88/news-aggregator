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
  source: SourceId;
  sourceName: string;
  /** Underlying outlet when the API aggregates others (NewsAPI: "BBC News"); otherwise undefined. */
  publisher?: string;
  /** Mapped onto our own taxonomy; undefined when the raw section has no equivalent. */
  category?: Category;
  /** ISO-8601 UTC, e.g. `2024-05-02T10:00:00.000Z`. */
  publishedAt: string;
}

/** Provider-agnostic filters. `from`/`to` are inclusive calendar days (`YYYY-MM-DD`) in the user's local time zone. */
export interface SearchParams {
  keyword?: string;
  from?: string;
  to?: string;
  categories?: Category[];
  /** Only articles bylined by one of these people (names as normalised by the adapters). */
  authors?: string[];
}

/** One page request to a single source. `page` is 1-based for every provider. */
export interface ProviderRequest extends SearchParams {
  page: number;
  signal?: AbortSignal;
}

export interface SourcePage {
  articles: Article[];
  hasMore: boolean;
}

export interface NewsProvider {
  readonly id: SourceId;
  readonly name: string;
  readonly supportedCategories: readonly Category[];
  /** True when the API can narrow a search to bylines, so the author filter is pushed upstream. */
  readonly supportsAuthorFilter?: boolean;
  search(request: ProviderRequest): Promise<SourcePage>;
}

export interface SourceFailure {
  source: SourceId;
  sourceName: string;
  message: string;
}

/** `buffer` holds fetched articles not yet shown (newest first). */
export interface SourceCursor {
  page: number;
  buffer: Article[];
  status: 'active' | 'done' | 'failed';
}

/** Opaque, JSON-serialisable position in an aggregated search; pass it back to fetch the next page. */
export type AggregatorCursor = Partial<Record<SourceId, SourceCursor>>;

export interface AggregatedResult {
  articles: Article[];
  failures: SourceFailure[];
  nextCursor?: AggregatorCursor;
}

export interface SearchOptions {
  cursor?: AggregatorCursor;
  signal?: AbortSignal;
}

export interface NewsService {
  readonly providers: readonly Pick<NewsProvider, 'id' | 'name'>[];
  search(
    params: SearchParams & { sources?: SourceId[] },
    options?: SearchOptions,
  ): Promise<AggregatedResult>;
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
