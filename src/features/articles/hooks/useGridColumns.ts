import { useSyncExternalStore } from 'react';
import { DEFAULT_GRID_COLUMNS, GRID_MEDIA_QUERIES } from '../gridLayout';

const supported = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const getColumns = () =>
  supported()
    ? GRID_MEDIA_QUERIES.reduce(
        (columns, { query, columns: n }) => (window.matchMedia(query).matches ? n : columns),
        DEFAULT_GRID_COLUMNS,
      )
    : DEFAULT_GRID_COLUMNS;

function subscribe(onChange: () => void) {
  if (!supported()) return () => {};
  const lists = GRID_MEDIA_QUERIES.map(({ query }) => window.matchMedia(query));
  lists.forEach((mql) => mql.addEventListener('change', onChange));
  return () => lists.forEach((mql) => mql.removeEventListener('change', onChange));
}

/** Current column count of the article grid, driven by the grid's own breakpoints. */
export function useGridColumns(): number {
  return useSyncExternalStore(subscribe, getColumns, () => DEFAULT_GRID_COLUMNS);
}
