import { z } from 'zod';
import type { Article, Category, NewsProvider, SearchParams } from '@/domain/news';
import type { HttpClient } from '@/services/http/httpClient';
import { clean, hashId, parseItems, supportedCategoriesOf } from './shared';

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
  response: z.object({ docs: z.array(z.unknown()).default([]) }),
});

const pickImage = (multimedia: RawDoc['multimedia']): string | undefined => {
  if (!multimedia) return undefined;
  const url = Array.isArray(multimedia)
    ? (multimedia.find((m) => m.subtype === 'thumbnail') ?? multimedia[0])?.url
    : multimedia.default?.url;
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${IMAGE_HOST}${url}`;
};

/** NYT bylines look like "By Jane Doe and John Roe". */
const parseByline = (original?: string | null): string | undefined =>
  clean(original?.replace(/^by\s+/i, ''));

/** NYT dates are `YYYYMMDD`. */
const toNytDate = (date?: string): string | undefined => date?.replaceAll('-', '');

export const mapNytDoc = (raw: RawDoc): Article => ({
  id: hashId('nyt', raw._id),
  title: raw.headline.main,
  description: clean(raw.abstract ?? raw.snippet),
  url: raw.web_url,
  imageUrl: pickImage(raw.multimedia),
  author: parseByline(raw.byline?.original),
  source: 'nyt',
  sourceName: 'The New York Times',
  category: raw.section_name ?? undefined,
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
    return parseItems(docSchema, response.docs).map(mapNytDoc);
  }
}
