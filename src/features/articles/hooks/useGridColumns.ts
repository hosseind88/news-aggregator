import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { LG_QUERY, SM_QUERY, columnsFor } from '../gridLayout';

/** Current column count of the article grid, driven by the grid's own breakpoints. */
export function useGridColumns(): number {
  const sm = useMediaQuery(SM_QUERY);
  const lg = useMediaQuery(LG_QUERY);
  return columnsFor(sm, lg);
}
