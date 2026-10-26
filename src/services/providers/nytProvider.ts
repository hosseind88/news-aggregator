import { z } from 'zod';
import type { Article, Category, NewsProvider, SearchParams } from '@/domain/news';
import type { HttpClient } from '@/services/http/httpClient';
import { createArticle } from '@/services/normalize';
import { parseItems, supportedCategoriesOf } from './shared';

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
  }),
});

const pickImagePath = (multimedia: RawDoc['multimedia']): string | undefined => {
  if (!multimedia) return undefined;
  return Array.isArray(multimedia)
    ? (multimedia.find((m) => m.subtype === 'thumbnail') ?? multimedia[0])?.url
    : multimedia.default?.url;
};

/** NYT dates are `YYYYMMDD`. */
const toNytDate = (date?: string): string | undefined => date?.replaceAll('-', '');

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

  async search({ keyword, from, to, categories = [], page = 1 }: SearchParams): Promise<Article[]> {
    const sections = categories.map((category) => `"${SECTION_MAP[category]}"`).join(' ');
    const payload = await this.http.getJson('/api/nyt/articlesearch.json', {
      q: keyword,
      begin_date: toNytDate(from),
      end_date: toNytDate(to),
      fq: sections ? `section_name:(${sections})` : undefined,
      sort: 'newest',
      page: page - 1, // NYT pages are 0-based
    });
    const { response } = responseSchema.parse(payload);
    return parseItems(docSchema, response.docs).flatMap((item) => mapNytDoc(item) ?? []);
  }
}
