import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AggregatorCursor, SourceFailure, SourceId } from '@/domain/news';
import { dedupeArticles } from '@/services/aggregator/dedupe';
import { AllSourcesFailedError } from '@/services/errors';
import { useNewsService } from '@/services/NewsServiceContext';
import { normalizeFilters, type ArticleFilters } from '../filters';

export type { ArticleFilters };

/**
 * Infinite, cached query over the aggregator. Each page is the next slice of one globally
 * ordered feed; the cursor returned with a page is what fetches the one after it.
 */
export function useArticles(filters: ArticleFilters, { enabled = true } = {}) {
  const service = useNewsService();
  const normalized = useMemo(() => normalizeFilters(filters), [filters]);

  const query = useInfiniteQuery({
    queryKey: ['articles', normalized],
    queryFn: ({ pageParam, signal }) => service.search(normalized, { cursor: pageParam, signal }),
    initialPageParam: undefined as AggregatorCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Every source was already tried and failed; repeating the call just burns rate limits.
    retry: (count, error) => !(error instanceof AllSourcesFailedError) && count < 1,
    enabled,
  });

  const { articles, failures } = useMemo(() => {
    const pages = query.data?.pages ?? [];
    const bySource = new Map<SourceId, SourceFailure>();
    pages
      .flatMap((page) => page.failures)
      .forEach((failure) => bySource.set(failure.source, failure));
    return {
      articles: dedupeArticles(pages.flatMap((page) => page.articles)),
      failures: [...bySource.values()],
    };
  }, [query.data]);

  return { ...query, articles, failures, filtersKey: JSON.stringify(normalized) };
}

export type ArticlesQuery = ReturnType<typeof useArticles>;
