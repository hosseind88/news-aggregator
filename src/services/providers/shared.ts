import type { z } from 'zod';
import type { Category } from '@/domain/news';
import { endOfLocalDay, startOfLocalDay } from '@/services/normalize';

/**
 * Validates an array of raw items one by one so a single malformed record
 * is dropped instead of failing the whole source.
 */
export const parseItems = <T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T>[] => {
  const items = Array.isArray(raw) ? raw : [];
  return items.flatMap((item) => {
    const result = schema.safeParse(item);
    return result.success ? [result.data as z.infer<T>] : [];
  });
};

export const supportedCategoriesOf = (map: Partial<Record<Category, unknown>>): Category[] =>
  Object.keys(map) as Category[];

/** Upstream URLs have a length limit, and a very long OR-list stops being a useful filter. */
const MAX_AUTHORS_PUSHED = 10;

/**
 * Full-text query that narrows a search to bylines (`"A" OR "B"`), optionally ANDed with the
 * user's keyword. Undefined when there is nothing to filter on.
 */
export const authorQuery = (authors: readonly string[] = [], keyword?: string) => {
  const names = authors
    .slice(0, MAX_AUTHORS_PUSHED)
    .map((name) => name.replace(/["()]/g, ' ').trim())
    .filter(Boolean)
    .map((name) => `"${name}"`);
  if (!names.length) return keyword;
  const byline = `(${names.join(' OR ')})`;
  return keyword ? `${byline} AND (${keyword})` : byline;
};

/** Local calendar day -> instant (ISO-8601 UTC) for APIs that accept timestamps. */
export const dayStartInstant = (day?: string): string | undefined =>
  startOfLocalDay(day)?.toISOString();
export const dayEndInstant = (day?: string): string | undefined =>
  endOfLocalDay(day)?.toISOString();
