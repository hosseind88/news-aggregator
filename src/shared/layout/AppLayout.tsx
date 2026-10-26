import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { LinearProgress } from '@/shared/ui/LinearProgress';

const NAV = [
  { to: '/', label: 'My Feed', end: true },
  { to: '/search', label: 'Search', end: false },
  { to: '/preferences', label: 'Preferences', end: false },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-600 ${
    isActive
      ? 'bg-blue-700 text-white dark:bg-blue-500 dark:text-slate-950'
      : 'text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-serif text-xl font-bold tracking-tight">Newsroom</span>
          <nav aria-label="Main" className="flex gap-1">
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={linkClass}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <ErrorBoundary>
          <Suspense fallback={<LinearProgress active label="Loading page" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
        Aggregating NewsAPI, The Guardian and The New York Times.
      </footer>
    </div>
  );
}
