import { Button } from '@/shared/ui/Button';
import { LinearProgress } from '@/shared/ui/LinearProgress';
import { GRID_CLASS } from '../gridLayout';
import { ArticleCardSkeleton } from './ArticleCardSkeleton';

interface Props {
  columns: number;
  loadedCount: number;
  hasNextPage: boolean;
  /** A page is loading or about to be (nothing else is rendered as loading). */
  isLoading: boolean;
  /** Auto-loading stopped; the next page only loads on request. */
  isPaused: boolean;
  onLoadOlder: () => void;
  isError: boolean;
  onRetry: () => void;
  setSentinel: (node: Element | null) => void;
}

/** Everything under the grid: scroll sentinel, loader, skeleton row, error and end states. */
export function InfiniteScrollFooter({
  columns,
  loadedCount,
  hasNextPage,
  isLoading,
  isPaused,
  onLoadOlder,
  isError,
  onRetry,
  setSentinel,
}: Props) {
  return (
    <div className="mt-6 space-y-4">
      {hasNextPage && !isPaused && <div ref={setSentinel} aria-hidden="true" />}

      <p aria-live="polite" className="sr-only">
        {isLoading ? 'Loading more articles' : `${loadedCount} articles loaded`}
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
      ) : isPaused ? (
        // With nothing loaded the empty state carries this action instead.
        loadedCount > 0 && (
          <div className="flex flex-col items-center gap-3 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>No more recent matches. Older articles may have more.</p>
            <Button variant="secondary" onClick={onLoadOlder}>
              Search older articles
            </Button>
          </div>
        )
      ) : hasNextPage ? (
        <LinearProgress active={isLoading} label="Loading more articles" />
      ) : (
        loadedCount > 0 && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            You&apos;re all caught up
          </p>
        )
      )}

      {isLoading && !isError && (
        <div className={GRID_CLASS}>
          {Array.from({ length: columns }, (_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}
        </div>
      )}
    </div>
  );
}
