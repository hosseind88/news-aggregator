import type { NewsProvider } from '@/domain/news';
import { NewsAggregator } from '@/services/aggregator/newsAggregator';
import { createHttpClient } from '@/services/http/httpClient';
import { GuardianProvider } from './guardianProvider';
import { NewsApiProvider } from './newsApiProvider';
import { NytProvider } from './nytProvider';

/**
 * The only place that knows which concrete sources exist.
 * To add a source: write one adapter implementing `NewsProvider`, then add it here
 * (and its id to `SOURCE_IDS`). No other code changes.
 */
export const createProviders = (): NewsProvider[] => {
  const http = createHttpClient();
  return [new NewsApiProvider(http), new GuardianProvider(http), new NytProvider(http)];
};

export const createNewsService = () => new NewsAggregator(createProviders());
