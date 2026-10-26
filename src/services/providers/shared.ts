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

/** Local calendar day -> instant (ISO-8601 UTC) for APIs that accept timestamps. */
export const dayStartInstant = (day?: string): string | undefined =>
  startOfLocalDay(day)?.toISOString();
export const dayEndInstant = (day?: string): string | undefined =>
  endOfLocalDay(day)?.toISOString();
