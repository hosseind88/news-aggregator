import { useEffect, useRef, useState } from 'react';

export const MAX_FRUITLESS_PAGES = 2;

interface Options {
  resetKey: string;
  count: number;
  /** A page is fruitful only if it adds at least this many articles (one grid row). */
  minGain: number;
  pages: number;
}

/**
 * Auto-loading is only worth its API calls while the user sees new content appear. After
 * `MAX_FRUITLESS_PAGES` pages in a row that add (almost) nothing visible (e.g. a client-side
 * filter hiding a whole page), `exhausted` lets the caller stop and offer "search older".
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
