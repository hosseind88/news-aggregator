import { useEffect, useState } from 'react';

const isMatchMediaSupported = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** Tracks a CSS media query; false where matchMedia is unavailable (SSR, jsdom). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    isMatchMediaSupported() ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (!isMatchMediaSupported()) return;
    const mediaQueryList = window.matchMedia(query);
    const handleMediaChange = () => setMatches(mediaQueryList.matches);
    handleMediaChange();
    mediaQueryList.addEventListener('change', handleMediaChange);
    return () => mediaQueryList.removeEventListener('change', handleMediaChange);
  }, [query]);

  return matches;
}
