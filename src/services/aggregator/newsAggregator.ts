import type {
  AggregatedResult,
  Article,
  AggregatorCursor,
  NewsProvider,
  NewsService,
  SearchOptions,
  SearchParams,
  SourceCursor,
  SourceFailure,
  SourceId,
} from '@/domain/news';
import { AllSourcesFailedError, SourceExhaustedError, describeError } from '@/services/errors';
import { canonicalUrl, hasAnyAuthor, isWithinDateRange, titleKey } from '@/services/normalize';
import { compareNewest, dedupeArticles } from './dedupe';

export const ARTICLES_PER_PAGE = 24;
const MAX_ROUNDS = 8;
/**
 * With an author filter most fetched articles are discarded, so a page may not fill. Keep the
 * per-call budget small and let the next call (an explicit user action) continue the search.
 */
const MAX_ROUNDS_FILTERED = 3;

const publishedTime = (article: Article) => Date.parse(article.publishedAt);

/**
 * Merges the selected providers into one newest-first feed.
 *
 * Pagination is a k-way merge over per-source cursors, not "page N of every source":
 * an article is only emitted once no active source can still hold anything newer (the
 * "watermark"), so the feed stays globally ordered across pages.
 *
 * A source that cannot filter by author is scanned at most one page per call, so "find this
 * author" never fans out into fetching that source's whole archive.
 *
 * The cursor is never mutated, so retrying a failed page re-runs from the same cursor.
 */
export class NewsAggregator implements NewsService {
  constructor(private readonly providers: readonly NewsProvider[]) {}

  get providerSummaries() {
    return this.providers.map(({ id, name }) => ({ id, name }));
  }

  async search(
    { sources, ...params }: SearchParams & { sources?: SourceId[] },
    { cursor, signal }: SearchOptions = {},
  ): Promise<AggregatedResult> {
    const cursorsBySource = this.initCursors(cursor, sources, params);
    const failures: SourceFailure[] = [];
    const providersById = new Map(this.providers.map((provider) => [provider.id, provider]));

    const authors = params.authors?.length ? params.authors : undefined;
    const maxFetchRounds = authors ? MAX_ROUNDS_FILTERED : MAX_ROUNDS;
    // Sources that already spent their one scan page in this call (author filter only).
    const sourcesOutOfScanBudget = new Set<string>();
    const getFetchableSources = () =>
      Object.entries(cursorsBySource).filter(
        ([id, sourceCursor]) => sourceCursor.status === 'active' && !sourcesOutOfScanBudget.has(id),
      );

    const fetchSources = async (sourceIds: SourceId[]) => {
      const fetchResults = await Promise.allSettled(
        sourceIds.map((id) => {
          const sourceCursor = cursorsBySource[id]!;
          return providersById.get(id)!.search({ ...params, page: sourceCursor.page, signal });
        }),
      );
      signal?.throwIfAborted();
      fetchResults.forEach((result, index) => {
        const id = sourceIds[index]!;
        if (authors && !providersById.get(id)!.supportsAuthorFilter) {
          sourcesOutOfScanBudget.add(id);
        }
        const sourceCursor = cursorsBySource[id]!;
        if (result.status === 'fulfilled') {
          const matchingArticles = result.value.articles.filter(
            (article) =>
              isWithinDateRange(article.publishedAt, params.from, params.to) &&
              (!authors || hasAnyAuthor(article.authors, authors)),
          );
          sourceCursor.buffer = [...sourceCursor.buffer, ...matchingArticles].sort(compareNewest);
          sourceCursor.page += 1;
          sourceCursor.status = result.value.hasMore ? 'active' : 'done';
        } else if (result.reason instanceof SourceExhaustedError) {
          sourceCursor.status = 'done';
        } else {
          sourceCursor.status = 'failed';
          failures.push({
            source: id,
            sourceName: providersById.get(id)!.name,
            message: describeError(result.reason),
          });
        }
      });
    };

    let candidates: Article[] = [];
    for (let round = 0; round < maxFetchRounds; round += 1) {
      const fetchableSourceIds = getFetchableSources().map(([id]) => id as SourceId);
      const watermark = Math.max(
        -Infinity,
        ...fetchableSourceIds.map((id) => {
          const oldestBuffered = cursorsBySource[id]!.buffer.at(-1);
          return oldestBuffered ? publishedTime(oldestBuffered) : Infinity;
        }),
      );

      const bufferedArticles = Object.values(cursorsBySource).flatMap(
        (sourceCursor) => sourceCursor.buffer,
      );
      candidates = dedupeArticles(
        bufferedArticles
          .filter((article) => !fetchableSourceIds.length || publishedTime(article) >= watermark)
          .sort(compareNewest),
      );
      if (candidates.length >= ARTICLES_PER_PAGE || !fetchableSourceIds.length) break;

      // Only the sources holding the watermark can lift it; the rest already reach further back.
      const sourcesAtWatermark = fetchableSourceIds.filter((id) => {
        const oldestBuffered = cursorsBySource[id]!.buffer.at(-1);
        return !oldestBuffered || publishedTime(oldestBuffered) === watermark;
      });
      await fetchSources(sourcesAtWatermark);
    }

    // Round budget spent with every remaining source still stuck: show what we have rather than nothing.
    if (!candidates.length) {
      candidates = dedupeArticles(
        Object.values(cursorsBySource)
          .flatMap((sourceCursor) => sourceCursor.buffer)
          .sort(compareNewest),
      );
    }

    const pageArticles = candidates.slice(0, ARTICLES_PER_PAGE);
    this.removeEmittedFromBuffers(cursorsBySource, pageArticles);

    const selectedCursors = Object.values(cursorsBySource);
    // Nothing to show and something failed: surface it (the cursor stays retryable) rather
    // than resolving an empty page that the UI would read as "all caught up".
    if (!pageArticles.length && failures.length) throw new AllSourcesFailedError(failures);

    const hasRemaining = selectedCursors.some(
      (sourceCursor) => sourceCursor.status !== 'done' || sourceCursor.buffer.length > 0,
    );
    return {
      articles: pageArticles,
      failures,
      nextCursor: hasRemaining ? cursorsBySource : undefined,
    };
  }

  private initCursors(
    cursor: AggregatorCursor | undefined,
    sources: SourceId[] | undefined,
    params: SearchParams,
  ): Record<string, SourceCursor> {
    if (cursor) {
      const copiedCursors = Object.fromEntries(
        Object.entries(cursor).map(([id, sourceCursor]) => [
          id,
          { ...sourceCursor, buffer: [...sourceCursor.buffer] },
        ]),
      );
      // A failed source is left alone while others can still fill pages (no hammering a
      // rate-limited API on every scroll), but once nothing else can serve, the next request
      // retries it, so "Retry" means something and a failure never silently ends the feed.
      const hasServableSource = Object.values(copiedCursors).some(
        (sourceCursor) => sourceCursor.status === 'active' || sourceCursor.buffer.length,
      );
      if (!hasServableSource) {
        Object.values(copiedCursors).forEach((sourceCursor) => {
          if (sourceCursor.status === 'failed') sourceCursor.status = 'active';
        });
      }
      return copiedCursors;
    }
    return Object.fromEntries(
      this.providers
        .filter((provider) => !sources?.length || sources.includes(provider.id))
        .filter((provider) => this.canServe(provider, params))
        .map((provider): [string, SourceCursor] => [
          provider.id,
          { page: 1, buffer: [], status: 'active' },
        ]),
    );
  }

  private removeEmittedFromBuffers(
    cursorsBySource: Record<string, SourceCursor>,
    emitted: Article[],
  ) {
    const emittedUrls = new Set(emitted.map((article) => canonicalUrl(article.url)));
    const emittedTitles = new Set(emitted.map((article) => titleKey(article.title)));
    for (const sourceCursor of Object.values(cursorsBySource)) {
      sourceCursor.buffer = sourceCursor.buffer.filter(
        (article) =>
          !emittedUrls.has(canonicalUrl(article.url)) &&
          !emittedTitles.has(titleKey(article.title)),
      );
    }
  }

  private canServe(provider: NewsProvider, { categories }: SearchParams): boolean {
    if (!categories?.length) return true;
    return categories.some((category) => provider.supportedCategories.includes(category));
  }
}
