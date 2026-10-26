import { useEffect, useRef, useState } from 'react';

interface Options {
  onLoadMore: () => void;
  hasNextPage: boolean;
  isFetching: boolean;
  /** Pause auto-loading, e.g. after an error, so it doesn't retry in a loop. */
  disabled?: boolean;
}

/**
 * Calls `onLoadMore` when the returned sentinel ref gets within 400px of the viewport.
 * The observer only exists while a load is possible, so it can't fire duplicate requests;
 * it is recreated after each fetch, which re-checks a sentinel that is still in view.
 */
export function useInfiniteScroll({ onLoadMore, hasNextPage, isFetching, disabled }: Options) {
  const [sentinel, setSentinel] = useState<Element | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });

  const active = hasNextPage && !isFetching && !disabled;

  useEffect(() => {
    if (!sentinel || !active || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMoreRef.current();
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, active]);

  return setSentinel;
}
