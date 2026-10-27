import type { BrowserRouterProps } from 'react-router-dom';

/** Opt in to React Router v7 behaviour now; shared by the app and the test router. */
export const routerFuture: NonNullable<BrowserRouterProps['future']> = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};
