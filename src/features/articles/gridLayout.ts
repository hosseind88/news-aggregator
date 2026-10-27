/**
 * Single source of truth for the article grid's responsive columns.
 * Class names are literals so Tailwind's scanner finds them; `minWidth` mirrors
 * Tailwind's default `sm` (640px) and `lg` (1024px) breakpoints.
 */
const SM_MIN_WIDTH = 640;
const LG_MIN_WIDTH = 1024;

const GRID_STEPS: { minWidth: number; className: string }[] = [
  { minWidth: 0, className: 'grid-cols-1' },
  { minWidth: SM_MIN_WIDTH, className: 'sm:grid-cols-2' },
  { minWidth: LG_MIN_WIDTH, className: 'lg:grid-cols-3' },
];

export const GRID_CLASS = `grid gap-4 ${GRID_STEPS.map((step) => step.className).join(' ')}`;

export const SM_QUERY = `(min-width: ${SM_MIN_WIDTH}px)`;
export const LG_QUERY = `(min-width: ${LG_MIN_WIDTH}px)`;

/** Columns of `GRID_CLASS` (1 / 2 / 3) for the viewport matched by the two queries above. */
export const getColumnCount = (isSmUp: boolean, isLgUp: boolean) => (isLgUp ? 3 : isSmUp ? 2 : 1);

/**
 * Hides a trailing partial row while more pages exist; the remainder is shown
 * once the next page is appended. Never hides the only (partial) row.
 */
export function trimToFullRows<T>(items: T[], columns: number, hasNextPage: boolean): T[] {
  if (!hasNextPage || columns <= 1) return items;
  const fullRows = Math.floor(items.length / columns) * columns;
  return fullRows === 0 ? items : items.slice(0, fullRows);
}
