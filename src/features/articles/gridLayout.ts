/**
 * Single source of truth for the article grid's responsive columns.
 * Class names are literals so Tailwind's scanner finds them; `minWidth` mirrors
 * Tailwind's default `sm` (640px) and `lg` (1024px) breakpoints.
 */
const GRID_STEPS: { minWidth: number; columns: number; className: string }[] = [
  { minWidth: 0, columns: 1, className: 'grid-cols-1' },
  { minWidth: 640, columns: 2, className: 'sm:grid-cols-2' },
  { minWidth: 1024, columns: 3, className: 'lg:grid-cols-3' },
];

export const GRID_CLASS = `grid gap-4 ${GRID_STEPS.map((s) => s.className).join(' ')}`;

export const GRID_MEDIA_QUERIES = GRID_STEPS.filter((s) => s.minWidth > 0).map((s) => ({
  query: `(min-width: ${s.minWidth}px)`,
  columns: s.columns,
}));

export const DEFAULT_GRID_COLUMNS = 1;

/**
 * Hides a trailing partial row while more pages exist; the remainder is shown
 * once the next page is appended. Never hides the only (partial) row.
 */
export function trimToFullRows<T>(items: T[], columns: number, hasNextPage: boolean): T[] {
  if (!hasNextPage || columns <= 1) return items;
  const fullRows = Math.floor(items.length / columns) * columns;
  return fullRows === 0 ? items : items.slice(0, fullRows);
}
