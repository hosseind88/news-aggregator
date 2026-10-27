import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORIES, SOURCE_IDS, type Category, type SourceId } from '@/domain/news';
import type { ArticleFilters } from '@/features/articles/filters';
import { isValidDay } from '@/services/normalize';

const isOneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: string): value is T =>
    (allowed as readonly string[]).includes(value);

const parseList = <T extends string>(raw: string | null, allowed: readonly T[]): T[] =>
  (raw?.split(',') ?? []).filter(isOneOf(allowed));

const parseDayParam = (raw: string | null) =>
  isValidDay(raw ?? undefined) ? (raw ?? undefined) : undefined;

const toParamValue = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value.length ? value.join(',') : undefined;
  return typeof value === 'string' && value ? value : undefined;
};

/** Search filters stored in the URL query string, so results are shareable and survive reloads. */
export function useSearchFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ArticleFilters>(
    () => ({
      keyword: searchParams.get('q') ?? undefined,
      from: parseDayParam(searchParams.get('from')),
      to: parseDayParam(searchParams.get('to')),
      categories: parseList<Category>(searchParams.get('categories'), CATEGORIES),
      sources: parseList<SourceId>(searchParams.get('sources'), SOURCE_IDS),
    }),
    [searchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<ArticleFilters>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          const paramKeyByFilter = {
            keyword: 'q',
            from: 'from',
            to: 'to',
            categories: 'categories',
            sources: 'sources',
          } as const;
          (Object.keys(patch) as (keyof typeof paramKeyByFilter)[]).forEach((key) => {
            const value = toParamValue(patch[key]);
            if (value) next.set(paramKeyByFilter[key], value);
            else next.delete(paramKeyByFilter[key]);
          });
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);

  return { filters, setFilters, resetFilters };
}
