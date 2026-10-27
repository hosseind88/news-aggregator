import { z } from 'zod';
import type { Article, Category, NewsProvider, ProviderRequest, SourcePage } from '@/domain/news';
import type { HttpClient } from '@/services/http/httpClient';
import { createArticle } from '@/services/normalize';
import {
  authorQuery,
  dayEndInstant,
  dayStartInstant,
  parseItems,
  supportedCategoriesOf,
} from './shared';

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
  sectionId: z.string().nullish(),
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
  response: z.object({
    pages: z.number().optional(),
    results: z.array(z.unknown()).default([]),
  }),
});

const mapGuardianResult = (raw: RawResult): Article | undefined =>
  createArticle({
    source: 'guardian',
    title: raw.webTitle,
    description: raw.fields?.trailText,
    url: raw.webUrl,
    imageUrl: raw.fields?.thumbnail,
    author: raw.fields?.byline,
    categories: [raw.sectionId, raw.sectionName],
    publishedAt: raw.webPublicationDate,
  });

export class GuardianProvider implements NewsProvider {
  readonly id = 'guardian' as const;
  readonly name = 'The Guardian';
  readonly supportedCategories = supportedCategoriesOf(SECTION_MAP);
  readonly supportsAuthorFilter = true;

  constructor(private readonly http: HttpClient) {}

  async search({
    keyword,
    from,
    to,
    categories = [],
    authors = [],
    page,
    signal,
  }: ProviderRequest): Promise<SourcePage> {
    const payload = await this.http.getJson(
      '/api/guardian/search',
      {
        q: authorQuery(authors, keyword),
        // Contributor tag slugs are not derivable from names, so search the byline field
        // (plus headline/body when a keyword has to match too).
        'query-fields': authors.length ? (keyword ? 'byline,headline,body' : 'byline') : undefined,
        'from-date': dayStartInstant(from),
        'to-date': dayEndInstant(to),
        section: categories.map((category) => SECTION_MAP[category]).join('|') || undefined,
        'order-by': 'newest',
        'show-fields': 'thumbnail,trailText,byline',
        'page-size': PAGE_SIZE,
        page,
      },
      { signal },
    );
    const { response } = responseSchema.parse(payload);
    return {
      articles: parseItems(resultSchema, response.results).flatMap(
        (item) => mapGuardianResult(item) ?? [],
      ),
      hasMore: response.results.length > 0 && page < (response.pages ?? page),
    };
  }
}
