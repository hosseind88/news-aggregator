import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { LG_QUERY, SM_QUERY, getColumnCount } from '../gridLayout';

/** Current column count of the article grid, driven by the grid's own breakpoints. */
export function useGridColumns(): number {
  const isSmUp = useMediaQuery(SM_QUERY);
  const isLgUp = useMediaQuery(LG_QUERY);
  return getColumnCount(isSmUp, isLgUp);
}
