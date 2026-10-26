import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORIES, SOURCE_IDS, type Category, type SourceId } from '@/domain/news';
import type { ArticleFilters } from '@/features/articles/hooks/useArticles';

const isOneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: string): value is T =>
    (allowed as readonly string[]).includes(value);

const parseList = <T extends string>(raw: string | null, allowed: readonly T[]): T[] =>
  (raw?.split(',') ?? []).filter(isOneOf(allowed));

const toParam = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value.length ? value.join(',') : undefined;
  return typeof value === 'string' && value ? value : undefined;
};

/** Search filters stored in the URL query string, so results are shareable and survive reloads. */
export function useSearchFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<ArticleFilters>(
    () => ({
      keyword: params.get('q') ?? undefined,
      from: params.get('from') ?? undefined,
      to: params.get('to') ?? undefined,
      categories: parseList<Category>(params.get('categories'), CATEGORIES),
      sources: parseList<SourceId>(params.get('sources'), SOURCE_IDS),
    }),
    [params],
  );

  const setFilters = useCallback(
    (patch: Partial<ArticleFilters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          const keys = {
            keyword: 'q',
            from: 'from',
            to: 'to',
            categories: 'categories',
            sources: 'sources',
          } as const;
          (Object.keys(patch) as (keyof typeof keys)[]).forEach((key) => {
            const value = toParam(patch[key]);
            if (value) next.set(keys[key], value);
            else next.delete(keys[key]);
          });
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const reset = useCallback(() => setParams({}, { replace: true }), [setParams]);

  return { filters, setFilters, reset };
}
