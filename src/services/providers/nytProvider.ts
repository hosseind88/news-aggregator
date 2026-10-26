import { z } from 'zod';
import type { Article, Category, NewsProvider, ProviderRequest, SourcePage } from '@/domain/news';
import { endOfLocalDay, startOfLocalDay, toUtcDayStamp } from '@/services/normalize';
import type { HttpClient } from '@/services/http/httpClient';
import { createArticle } from '@/services/normalize';
import { parseItems, supportedCategoriesOf } from './shared';

const PAGE_SIZE = 10;
/** NYT serves at most 100 pages (1000 results) per query. */
const RESULT_CAP = 1000;

const IMAGE_HOST = 'https://www.nytimes.com/';

/** Our category -> NYT `section_name` facet value. */
const SECTION_MAP: Record<Category, string> = {
  world: 'World',
  politics: 'Politics',
  business: 'Business',
  technology: 'Technology',
  science: 'Science',
  health: 'Health',
  sports: 'Sports',
  entertainment: 'Arts',
};

const docSchema = z.object({
  _id: z.string(),
  web_url: z.string().url(),
  headline: z.object({ main: z.string().min(1) }),
  abstract: z.string().nullish(),
  snippet: z.string().nullish(),
  byline: z.object({ original: z.string().nullish() }).nullish(),
  section_name: z.string().nullish(),
  news_desk: z.string().nullish(),
  pub_date: z.string(),
  multimedia: z
    .union([
      z.array(z.object({ url: z.string(), subtype: z.string().nullish() })),
      z.object({ default: z.object({ url: z.string() }).nullish() }),
    ])
    .nullish(),
});
type RawDoc = z.infer<typeof docSchema>;

const responseSchema = z.object({
  // NYT returns `docs: null` (not []) when a query has no hits.
  response: z.object({
    docs: z
      .array(z.unknown())
      .nullish()
      .transform((docs) => docs ?? []),
    meta: z.object({ hits: z.number().optional() }).nullish(),
  }),
});

const pickImagePath = (multimedia: RawDoc['multimedia']): string | undefined => {
  if (!multimedia) return undefined;
  return Array.isArray(multimedia)
    ? (multimedia.find((m) => m.subtype === 'thumbnail') ?? multimedia[0])?.url
    : multimedia.default?.url;
};

/**
 * NYT only filters on whole UTC days (`YYYYMMDD`). Widen the user's local-day range to the UTC
 * days it touches; the aggregator trims the edges using exact timestamps.
 */
const utcDayStamp = (instant: Date | undefined): string | undefined =>
  instant && toUtcDayStamp(instant);

export const mapNytDoc = (raw: RawDoc): Article | undefined =>
  createArticle({
    source: 'nyt',
    title: raw.headline.main,
    description: raw.abstract ?? raw.snippet,
    url: raw.web_url,
    imageUrl: pickImagePath(raw.multimedia),
    imageBase: IMAGE_HOST,
    author: raw.byline?.original,
    categories: [raw.section_name, raw.news_desk],
    publishedAt: raw.pub_date,
  });

export class NytProvider implements NewsProvider {
  readonly id = 'nyt' as const;
  readonly name = 'The New York Times';
  readonly supportedCategories = supportedCategoriesOf(SECTION_MAP);

  constructor(private readonly http: HttpClient) {}

  async search({
    keyword,
    from,
    to,
    categories = [],
    page,
    signal,
  }: ProviderRequest): Promise<SourcePage> {
    const sections = categories.map((category) => `"${SECTION_MAP[category]}"`).join(' ');
    const payload = await this.http.getJson(
      '/api/nyt/articlesearch.json',
      {
        q: keyword,
        begin_date: utcDayStamp(startOfLocalDay(from)),
        end_date: utcDayStamp(endOfLocalDay(to)),
        fq: sections ? `section_name:(${sections})` : undefined,
        sort: 'newest',
        page: page - 1, // NYT pages are 0-based
      },
      { signal },
    );
    const { response } = responseSchema.parse(payload);
    const reachable = Math.min(response.meta?.hits ?? Infinity, RESULT_CAP);
    return {
      articles: parseItems(docSchema, response.docs).flatMap((item) => mapNytDoc(item) ?? []),
      hasMore: response.docs.length > 0 && page * PAGE_SIZE < reachable,
    };
  }
}
