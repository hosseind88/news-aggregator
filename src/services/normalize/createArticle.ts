import { SOURCE_LABELS, type Article, type SourceId } from '@/domain/news';
import { normalizeAuthors } from './authors';
import { normalizeCategory } from './category';
import { normalizeDate } from './date';
import { DESCRIPTION_MAX_LENGTH, cleanText, stripPublisherSuffix } from './text';
import { normalizeUrl, stableId } from './url';

/** What an adapter extracts from its API payload; every field may still be dirty. */
export interface RawArticle {
  source: SourceId;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  /** Base for relative image paths. */
  imageBase?: string;
  author?: string | readonly string[] | null;
  /** Underlying outlet when the source is an aggregator (NewsAPI). */
  publisher?: string | null;
  /** Raw section names, most specific first. */
  categories?: (string | null | undefined)[];
  publishedAt?: string | null;
}

/**
 * The single place where raw API data becomes a normalised `Article`.
 * Returns undefined when the essentials (title, https URL, valid date) are missing,
 * so adapters can drop unusable records.
 */
export const createArticle = (raw: RawArticle): Article | undefined => {
  const publisher = cleanText(raw.publisher);
  const title = cleanText(raw.title);
  const url = normalizeUrl(raw.url);
  const publishedAt = normalizeDate(raw.publishedAt);
  if (!title || !url || !publishedAt) return undefined;

  const authors = normalizeAuthors(raw.author, [SOURCE_LABELS[raw.source], publisher]);

  return {
    id: stableId(raw.source, url),
    title: stripPublisherSuffix(title, publisher),
    description: cleanText(raw.description, { maxLength: DESCRIPTION_MAX_LENGTH }),
    url,
    imageUrl: normalizeUrl(raw.imageUrl, raw.imageBase),
    authors,
    source: raw.source,
    sourceName: SOURCE_LABELS[raw.source],
    publisher,
    category: normalizeCategory(...(raw.categories ?? [])),
    publishedAt,
  };
};
