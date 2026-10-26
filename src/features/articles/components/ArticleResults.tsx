import { useMemo, type ReactNode } from 'react';
import type { Article } from '@/domain/news';
import { describeError } from '@/services/errors';
import { useInfiniteScroll } from '@/shared/hooks/useInfiniteScroll';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { GRID_CLASS, trimToFullRows } from '../gridLayout';
import { useAutoLoadBudget } from '../hooks/useAutoLoadBudget';
import { useGridColumns } from '../hooks/useGridColumns';
import type { ArticlesQuery } from '../hooks/useArticles';
import { ArticleCard } from './ArticleCard';
import { ArticleCardSkeleton } from './ArticleCardSkeleton';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';
import { SourceFailureNotice } from './SourceFailureNotice';

interface Props {
  query: ArticlesQuery;
  /** Overrides the query's articles (e.g. after client-side filtering). */
  articles?: Article[];
  isFollowed?: (article: Article) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Shown instead of the empty state when auto-loading stopped before any match was found. */
  stalledTitle?: string;
  stalledDescription?: string;
}

const SKELETON_COUNT = 6;

/** Renders every state of an articles query so pages stay declarative. */
export function ArticleResults({
  query,
  articles = query.articles,
  isFollowed,
  emptyTitle = 'No articles found',
  emptyDescription = 'Try adjusting your search or filters.',
  emptyAction,
  stalledTitle = 'No recent matches',
  stalledDescription = 'The latest articles from every source did not include any. You can search older articles.',
}: Props) {
  const {
    failures,
    isPending,
    isError,
    error,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = query;

  const columns = useGridColumns();
  const visibleArticles = useMemo(
    () => trimToFullRows(articles, columns, hasNextPage),
    [articles, columns, hasNextPage],
  );
  const { exhausted } = useAutoLoadBudget({
    resetKey: query.filtersKey,
    count: articles.length,
    minGain: columns,
    pages: query.data?.pages.length ?? 0,
  });
  // Auto-loading stops after a few pages that showed nothing new; the user decides to go on.
  const stalled = exhausted && hasNextPage;
  // Nothing to show yet but the next page is already on its way: that is loading, not "empty".
  const scanning = articles.length === 0 && hasNextPage && !stalled;
  const setSentinel = useInfiniteScroll({
    onLoadMore: () => void fetchNextPage(),
    hasNextPage,
    isFetching,
    disabled: isFetchNextPageError || stalled,
    revision: query.dataUpdatedAt,
  });

  if (isPending) {
    return (
      <div className={GRID_CLASS} role="status" aria-label="Loading articles">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <ArticleCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // A failed *next* page keeps the loaded feed on screen; the footer offers the retry.
  if (isError && !query.data) {
    return <ErrorState message={describeError(error)} onRetry={() => void query.refetch()} />;
  }

  if (query.articles.length === 0 && failures.length > 0) {
    return (
      <ErrorState
        title="Could not load news"
        message={failures.map((f) => `${f.sourceName}: ${f.message}`).join(' · ')}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return (
    <>
      <SourceFailureNotice failures={failures} />
      {articles.length === 0 ? (
        scanning || isFetchingNextPage ? null : stalled ? (
          <EmptyState
            title={stalledTitle}
            description={stalledDescription}
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={() => void fetchNextPage()}>Search older articles</Button>
                {emptyAction}
              </div>
            }
          />
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        )
      ) : (
        <ul className={GRID_CLASS}>
          {visibleArticles.map((article) => (
            <li key={article.id}>
              <ArticleCard article={article} followed={isFollowed?.(article)} />
            </li>
          ))}
        </ul>
      )}
      <InfiniteScrollFooter
        columns={columns}
        loadedCount={articles.length}
        hasNextPage={hasNextPage}
        isLoading={isFetchingNextPage || scanning}
        paused={stalled && !isFetchingNextPage}
        onLoadOlder={() => void fetchNextPage()}
        isError={isFetchNextPageError}
        onRetry={() => void fetchNextPage()}
        setSentinel={setSentinel}
      />
    </>
  );
}
