import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { routerFuture } from '@/shared/lib/routerFuture';

/** MemoryRouter with the app's future flags, so tests run on the same router behaviour. */
export const TestRouter = (props: MemoryRouterProps) => (
  <MemoryRouter future={routerFuture} {...props} />
);
