import type { ReactNode } from 'react';
import type { Article } from '@/domain/news';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import type { ArticlesQuery } from '../hooks/useArticles';
import { ArticleCard } from './ArticleCard';
import { ArticleCardSkeleton } from './ArticleCardSkeleton';
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
const gridClass = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3';

/** Renders every state of an articles query so pages stay declarative. */
export function ArticleResults({
  query,
  articles = query.articles,
  isFollowed,
  emptyTitle = 'No articles found',
  emptyDescription = 'Try adjusting your search or filters.',
  emptyAction,
}: Props) {
  const { failures, isPending, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage } =
    query;

  if (isPending) {
    return (
      <div className={gridClass} role="status" aria-label="Loading articles">
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
        <ul className={gridClass}>
          {articles.map((article) => (
            <li key={article.id}>
              <ArticleCard article={article} followed={isFollowed?.(article)} />
            </li>
          ))}
        </ul>
      )}
      {hasNextPage && (
        <div className="mt-8 text-center">
          <Button
            variant="secondary"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </>
  );
}
