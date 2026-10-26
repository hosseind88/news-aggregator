import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { NotFoundPage } from '@/shared/layout/NotFoundPage';
import { AppLayout } from '@/shared/layout/AppLayout';
import { NewsServiceProvider } from '@/services/NewsServiceContext';

// Each page is its own chunk, so the first paint only ships the route being visited.
const FeedPage = lazy(() =>
  import('@/features/feed/FeedPage').then((m) => ({ default: m.FeedPage })),
);
const SearchPage = lazy(() =>
  import('@/features/search/SearchPage').then((m) => ({ default: m.SearchPage })),
);
const PreferencesPage = lazy(() =>
  import('@/features/preferences/PreferencesPage').then((m) => ({ default: m.PreferencesPage })),
);

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } },
  });

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <NewsServiceProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<FeedPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="preferences" element={<PreferencesPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </NewsServiceProvider>
    </QueryClientProvider>
  );
}
