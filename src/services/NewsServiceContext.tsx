import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { NewsService } from '@/domain/news';
import { createNewsService } from '@/services/providers/registry';

const NewsServiceContext = createContext<NewsService | null>(null);

interface Props {
  /** Override in tests; defaults to the real aggregator. */
  service?: NewsService;
  children: ReactNode;
}

export function NewsServiceProvider({ service, children }: Props) {
  const value = useMemo(() => service ?? createNewsService(), [service]);
  return <NewsServiceContext.Provider value={value}>{children}</NewsServiceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNewsService(): NewsService {
  const service = useContext(NewsServiceContext);
  if (!service) throw new Error('useNewsService must be used within <NewsServiceProvider>');
  return service;
}
