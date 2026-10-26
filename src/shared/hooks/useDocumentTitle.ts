import { useEffect } from 'react';

const APP_NAME = 'Newsroom';

/** Keeps the tab title and screen-reader page announcement in sync with the current route. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
