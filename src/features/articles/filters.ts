import {
  CATEGORIES,
  SOURCE_IDS,
  type Category,
  type SearchParams,
  type SourceId,
} from '@/domain/news';
import { isValidDay } from '@/services/normalize';

export type ArticleFilters = SearchParams & { sources?: SourceId[] };

const unique = <T extends string>(values: readonly T[] | undefined, allowed: readonly T[]) => {
  const kept = allowed.filter((value) => values?.includes(value));
  return kept.length ? kept : undefined;
};

/**
 * Canonical form of user filters: trimmed lower-cased keyword, valid days in order,
 * de-duplicated list filters, "all sources" and "no filter" collapsed to undefined.
 * Used for both the query key and the request, so equivalent filters share one cache entry
 * and garbage (hand-edited URLs, old persisted state) never reaches an upstream API.
 */
export const normalizeFilters = (filters: ArticleFilters): ArticleFilters => {
  const keyword = filters.keyword?.trim().replace(/\s+/g, ' ').toLowerCase() || undefined;
  let from = isValidDay(filters.from) ? filters.from : undefined;
  let to = isValidDay(filters.to) ? filters.to : undefined;
  if (from && to && from > to) [from, to] = [to, from];

  const sources = unique<SourceId>(filters.sources, SOURCE_IDS);
  return {
    keyword,
    from,
    to,
    categories: unique<Category>(filters.categories, CATEGORIES),
    sources: sources?.length === SOURCE_IDS.length ? undefined : sources,
  };
};
