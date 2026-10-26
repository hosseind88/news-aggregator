import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { SearchParams, SourceFailure, SourceId } from '@/domain/news';
import { dedupeArticles } from '@/services/aggregator/dedupe';
import { useNewsService } from '@/services/NewsServiceContext';

export type ArticleFilters = Omit<SearchParams, 'page'> & { sources?: SourceId[] };

/** Infinite, cached query over the aggregator. One "page" = one page from every selected source. */
export function useArticles(filters: ArticleFilters, { enabled = true } = {}) {
  const service = useNewsService();

  const query = useInfiniteQuery({
    queryKey: ['articles', filters],
    queryFn: ({ pageParam }) => service.search({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.articles.length > 0 ? pages.length + 1 : undefined,
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

  return { ...query, articles, failures };
}

export type ArticlesQuery = ReturnType<typeof useArticles>;
