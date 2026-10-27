import type { NewsProvider } from '@/domain/news';
import { NewsAggregator } from '@/services/aggregator/newsAggregator';
import { createHttpClient } from '@/services/http/httpClient';
import { GuardianProvider } from './guardianProvider';
import { NewsApiProvider } from './newsApiProvider';
import { NytProvider } from './nytProvider';

/**
 * The only place that instantiates the concrete sources.
 * To add a source: write one adapter implementing `NewsProvider`, add it here, add its id and
 * label to `SOURCE_IDS` / `SOURCE_LABELS` in `domain/news.ts`, and add a proxy entry
 * (nginx template and `vite.config.ts`).
 */
export const createProviders = (): NewsProvider[] => {
  const http = createHttpClient();
  return [new NewsApiProvider(http), new GuardianProvider(http), new NytProvider(http)];
};

export const createNewsService = () => new NewsAggregator(createProviders());
