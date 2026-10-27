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
 * filter hiding a whole page), `isBudgetExhausted` lets the caller stop and offer "search older".
 */
export function useAutoLoadBudget({ resetKey, count, minGain, pages }: Options) {
  const [fruitlessCount, setFruitlessCount] = useState(0);
  const lastSeen = useRef({ resetKey, count: 0, pages: 0 });

  useEffect(() => {
    const previousRender = lastSeen.current;
    // The first page of a search is the baseline, not part of the budget.
    const isBaseline = previousRender.resetKey !== resetKey || previousRender.pages === 0;
    lastSeen.current = { resetKey, count, pages };
    if (isBaseline) {
      setFruitlessCount(0);
      return;
    }
    if (pages === previousRender.pages) return;
    setFruitlessCount((currentCount) =>
      count - previousRender.count >= minGain ? 0 : currentCount + 1,
    );
  }, [resetKey, count, minGain, pages]);

  return { isBudgetExhausted: fruitlessCount >= MAX_FRUITLESS_PAGES };
}
