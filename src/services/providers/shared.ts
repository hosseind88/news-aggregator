import { z } from 'zod';
import type { Category } from '@/domain/news';

/** Stable, URL-derived id so the same story keeps the same React key across fetches. */
export const hashId = (prefix: string, value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  return `${prefix}-${(hash >>> 0).toString(36)}`;
};

export const clean = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.replace(/<[^>]*>/g, '').trim();
  return trimmed ? trimmed : undefined;
};

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
