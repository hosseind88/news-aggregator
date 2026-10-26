import { Button } from '@/shared/ui/Button';
import { LinearProgress } from '@/shared/ui/LinearProgress';
import { GRID_CLASS } from '../gridLayout';
import { ArticleCardSkeleton } from './ArticleCardSkeleton';

interface Props {
  columns: number;
  loadedCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  onRetry: () => void;
  setSentinel: (node: Element | null) => void;
}

/** Everything under the grid: scroll sentinel, loader, skeleton row, error and end states. */
export function InfiniteScrollFooter({
  columns,
  loadedCount,
  hasNextPage,
  isFetchingNextPage,
  isError,
  onRetry,
  setSentinel,
}: Props) {
  return (
    <div className="mt-6 space-y-4">
      {hasNextPage && <div ref={setSentinel} aria-hidden="true" />}

      <p aria-live="polite" className="sr-only">
        {isFetchingNextPage ? 'Loading more articles' : `${loadedCount} articles loaded`}
      </p>

      {isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
        >
          Could not load more articles.
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : hasNextPage ? (
        <LinearProgress active={isFetchingNextPage} label="Loading more articles" />
      ) : (
        loadedCount > 0 && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            You&apos;re all caught up
          </p>
        )
      )}

      {isFetchingNextPage && !isError && (
        <div className={GRID_CLASS}>
          {Array.from({ length: columns }, (_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}
        </div>
      )}
    </div>
  );
}
