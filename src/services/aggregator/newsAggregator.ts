import type {
  AggregatedResult,
  NewsProvider,
  NewsService,
  SearchParams,
  SourceFailure,
  SourceId,
} from '@/domain/news';
import { isWithinDateRange } from '@/services/normalize';
import { dedupeArticles, sortByNewest } from './dedupe';

const errorMessage = (reason: unknown): string =>
  reason instanceof Error ? reason.message : 'Unknown error';

/**
 * Fans a search out to the selected providers in parallel and merges the results.
 * Depends only on the `NewsProvider` abstraction; concrete adapters are injected.
 * A provider that rejects is reported in `failures` and never breaks the others.
 */
export class NewsAggregator implements NewsService {
  constructor(private readonly registered: readonly NewsProvider[]) {}

  get providers() {
    return this.registered.map(({ id, name }) => ({ id, name }));
  }

  async search({
    sources,
    ...params
  }: SearchParams & { sources?: SourceId[] }): Promise<AggregatedResult> {
    const selected = this.registered
      .filter((provider) => !sources?.length || sources.includes(provider.id))
      .filter((provider) => this.canServe(provider, params));

    const settled = await Promise.allSettled(selected.map((provider) => provider.search(params)));

    const failures: SourceFailure[] = [];
    const collected = settled.flatMap((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      const provider = selected[index]!;
      failures.push({
        source: provider.id,
        sourceName: provider.name,
        message: errorMessage(result.reason),
      });
      return [];
    });

    // Every source has its own idea of date bounds; enforce the range on normalised UTC timestamps.
    const inRange = collected.filter((a) =>
      isWithinDateRange(a.publishedAt, params.from, params.to),
    );
    return { articles: sortByNewest(dedupeArticles(inRange)), failures };
  }

  /** A provider with no overlap with the requested categories has nothing to offer. */
  private canServe(provider: NewsProvider, { categories }: SearchParams): boolean {
    if (!categories?.length) return true;
    return categories.some((category) => provider.supportedCategories.includes(category));
  }
}
