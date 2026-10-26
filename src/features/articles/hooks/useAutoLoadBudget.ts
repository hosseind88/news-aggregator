import { useEffect, useRef, useState } from 'react';

/** Consecutive auto-loaded pages that may add (almost) nothing before auto-loading stops. */
export const MAX_FRUITLESS_PAGES = 2;

interface Options {
  /** Changes when the search itself changes (filters); the budget starts over. */
  resetKey: string;
  /** Articles the user can see. */
  count: number;
  /** A page counts as fruitful only if it adds at least this many (one grid row). */
  minGain: number;
  /** Pages loaded so far; grows whenever a page lands, whether or not it added anything visible. */
  pages: number;
}

/**
 * Auto-loading is only worth its API calls while the user sees new content appear. After
 * `MAX_FRUITLESS_PAGES` loaded pages in a row that add (almost) nothing visible, e.g. a
 * client-side filter hiding a whole page, this reports `exhausted` so the caller can stop
 * the infinite scroll and offer an explicit "search older" action instead. A page that
 * adds content, including one the user asked for, starts the budget over.
 */
export function useAutoLoadBudget({ resetKey, count, minGain, pages }: Options) {
  const [fruitless, setFruitless] = useState(0);
  const seen = useRef({ resetKey, count: 0, pages: 0 });

  useEffect(() => {
    const prev = seen.current;
    // The first page of a search is the baseline, not part of the budget.
    const isBaseline = prev.resetKey !== resetKey || prev.pages === 0;
    seen.current = { resetKey, count, pages };
    if (isBaseline) {
      setFruitless(0);
      return;
    }
    if (pages === prev.pages) return;
    setFruitless((n) => (count - prev.count >= minGain ? 0 : n + 1));
  }, [resetKey, count, minGain, pages]);

  return { exhausted: fruitless >= MAX_FRUITLESS_PAGES };
}
