import { z } from 'zod';
import type { Article, Category, NewsProvider, SearchParams } from '@/domain/news';
import type { HttpClient } from '@/services/http/httpClient';
import { clean, hashId, parseItems, supportedCategoriesOf } from './shared';

const PAGE_SIZE = 20;

/** Our category -> Guardian section id. */
const SECTION_MAP: Record<Category, string> = {
  world: 'world',
  politics: 'politics',
  business: 'business',
  technology: 'technology',
  science: 'science',
  health: 'society',
  sports: 'sport',
  entertainment: 'culture',
};

const resultSchema = z.object({
  id: z.string(),
  webTitle: z.string().min(1),
  webUrl: z.string().url(),
  webPublicationDate: z.string(),
  sectionName: z.string().nullish(),
  fields: z
    .object({
      thumbnail: z.string().nullish(),
      trailText: z.string().nullish(),
      byline: z.string().nullish(),
    })
    .nullish(),
});
type RawResult = z.infer<typeof resultSchema>;

const responseSchema = z.object({
  response: z.object({ results: z.array(z.unknown()).default([]) }),
});

export const mapGuardianResult = (raw: RawResult): Article => ({
  id: hashId('guardian', raw.id),
  title: raw.webTitle,
  description: clean(raw.fields?.trailText),
  url: raw.webUrl,
  imageUrl: raw.fields?.thumbnail ?? undefined,
  author: clean(raw.fields?.byline),
  source: 'guardian',
  sourceName: 'The Guardian',
  category: raw.sectionName ?? undefined,
  publishedAt: raw.webPublicationDate,
});

export class GuardianProvider implements NewsProvider {
  readonly id = 'guardian' as const;
  readonly name = 'The Guardian';
  readonly supportedCategories = supportedCategoriesOf(SECTION_MAP);

  constructor(private readonly http: HttpClient) {}

  async search({ keyword, from, to, categories = [], page = 1 }: SearchParams): Promise<Article[]> {
    const payload = await this.http.getJson('/api/guardian/search', {
      q: keyword,
      'from-date': from,
      'to-date': to,
      section: categories.map((category) => SECTION_MAP[category]).join('|') || undefined,
      'order-by': 'newest',
      'show-fields': 'thumbnail,trailText,byline',
      'page-size': PAGE_SIZE,
      page,
    });
    const { response } = responseSchema.parse(payload);
    return parseItems(resultSchema, response.results).map(mapGuardianResult);
  }
}
