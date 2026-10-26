import { useMemo, type ReactNode } from 'react';
import type { Article } from '@/domain/news';
import { useInfiniteScroll } from '@/shared/hooks/useInfiniteScroll';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { GRID_CLASS, trimToFullRows } from '../gridLayout';
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
  const setSentinel = useInfiniteScroll({
    onLoadMore: () => void fetchNextPage(),
    hasNextPage,
    isFetching,
    disabled: isFetchNextPageError,
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

  if (isError) {
    return <ErrorState message={error.message} onRetry={() => void query.refetch()} />;
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
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
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
        isFetchingNextPage={isFetchingNextPage}
        isError={isFetchNextPageError}
        onRetry={() => void fetchNextPage()}
        setSentinel={setSentinel}
      />
    </>
  );
}
