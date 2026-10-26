import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { FeedPage } from '@/features/feed/FeedPage';
import { PreferencesPage } from '@/features/preferences/PreferencesPage';
import { SearchPage } from '@/features/search/SearchPage';
import { NotFoundPage } from '@/shared/layout/NotFoundPage';
import { AppLayout } from '@/shared/layout/AppLayout';
import { NewsServiceProvider } from '@/services/NewsServiceContext';

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
