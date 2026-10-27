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

const time = (article: Article) => Date.parse(article.publishedAt);

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
  constructor(private readonly registered: readonly NewsProvider[]) {}

  get providers() {
    return this.registered.map(({ id, name }) => ({ id, name }));
  }

  async search(
    { sources, ...params }: SearchParams & { sources?: SourceId[] },
    { cursor, signal }: SearchOptions = {},
  ): Promise<AggregatedResult> {
    const state = this.start(cursor, sources, params);
    const failures: SourceFailure[] = [];
    const byId = new Map(this.registered.map((provider) => [provider.id, provider]));

    const authors = params.authors?.length ? params.authors : undefined;
    const maxRounds = authors ? MAX_ROUNDS_FILTERED : MAX_ROUNDS;
    // Sources that already spent their one scan page in this call (author filter only).
    const scanned = new Set<string>();
    const active = () =>
      Object.entries(state).filter(([id, c]) => c.status === 'active' && !scanned.has(id));

    const fetchFrom = async (ids: SourceId[]) => {
      const settled = await Promise.allSettled(
        ids.map((id) => {
          const sourceCursor = state[id]!;
          return byId.get(id)!.search({ ...params, page: sourceCursor.page, signal });
        }),
      );
      signal?.throwIfAborted();
      settled.forEach((result, index) => {
        const id = ids[index]!;
        if (authors && !byId.get(id)!.supportsAuthorFilter) scanned.add(id);
        const sourceCursor = state[id]!;
        if (result.status === 'fulfilled') {
          const inRange = result.value.articles.filter(
            (a) =>
              isWithinDateRange(a.publishedAt, params.from, params.to) &&
              (!authors || hasAnyAuthor(a.authors, authors)),
          );
          sourceCursor.buffer = [...sourceCursor.buffer, ...inRange].sort(compareNewest);
          sourceCursor.page += 1;
          sourceCursor.status = result.value.hasMore ? 'active' : 'done';
        } else if (result.reason instanceof SourceExhaustedError) {
          sourceCursor.status = 'done';
        } else {
          sourceCursor.status = 'failed';
          failures.push({
            source: id,
            sourceName: byId.get(id)!.name,
            message: describeError(result.reason),
          });
        }
      });
    };

    let candidates: Article[] = [];
    for (let round = 0; round < maxRounds; round += 1) {
      const live = active().map(([id]) => id as SourceId);
      const watermark = Math.max(
        -Infinity,
        ...live.map((id) => {
          const oldest = state[id]!.buffer.at(-1);
          return oldest ? time(oldest) : Infinity;
        }),
      );

      const buffered = Object.values(state).flatMap((c) => c.buffer);
      candidates = dedupeArticles(
        buffered.filter((a) => !live.length || time(a) >= watermark).sort(compareNewest),
      );
      if (candidates.length >= ARTICLES_PER_PAGE || !live.length) break;

      // Only the sources holding the watermark can lift it; the rest already reach further back.
      const limiting = live.filter((id) => {
        const oldest = state[id]!.buffer.at(-1);
        return !oldest || time(oldest) === watermark;
      });
      await fetchFrom(limiting);
    }

    // Round budget spent with every remaining source still stuck: show what we have rather than nothing.
    if (!candidates.length) {
      candidates = dedupeArticles(
        Object.values(state)
          .flatMap((c) => c.buffer)
          .sort(compareNewest),
      );
    }

    const page = candidates.slice(0, ARTICLES_PER_PAGE);
    this.consume(state, page);

    const selected = Object.values(state);
    // Nothing to show and something failed: surface it (the cursor stays retryable) rather
    // than resolving an empty page that the UI would read as "all caught up".
    if (!page.length && failures.length) throw new AllSourcesFailedError(failures);

    const hasRemaining = selected.some((c) => c.status !== 'done' || c.buffer.length > 0);
    return { articles: page, failures, nextCursor: hasRemaining ? state : undefined };
  }

  private start(
    cursor: AggregatorCursor | undefined,
    sources: SourceId[] | undefined,
    params: SearchParams,
  ): Record<string, SourceCursor> {
    if (cursor) {
      const copy = Object.fromEntries(
        Object.entries(cursor).map(([id, c]) => [id, { ...c, buffer: [...c.buffer] }]),
      );
      // A failed source is left alone while others can still fill pages (no hammering a
      // rate-limited API on every scroll), but once nothing else can serve, the next request
      // retries it, so "Retry" means something and a failure never silently ends the feed.
      const canServe = Object.values(copy).some((c) => c.status === 'active' || c.buffer.length);
      if (!canServe) {
        Object.values(copy).forEach((c) => {
          if (c.status === 'failed') c.status = 'active';
        });
      }
      return copy;
    }
    return Object.fromEntries(
      this.registered
        .filter((provider) => !sources?.length || sources.includes(provider.id))
        .filter((provider) => this.canServe(provider, params))
        .map((provider): [string, SourceCursor] => [
          provider.id,
          { page: 1, buffer: [], status: 'active' },
        ]),
    );
  }

  private consume(state: Record<string, SourceCursor>, emitted: Article[]) {
    const urls = new Set(emitted.map((a) => canonicalUrl(a.url)));
    const titles = new Set(emitted.map((a) => titleKey(a.title)));
    for (const sourceCursor of Object.values(state)) {
      sourceCursor.buffer = sourceCursor.buffer.filter(
        (a) => !urls.has(canonicalUrl(a.url)) && !titles.has(titleKey(a.title)),
      );
    }
  }

  private canServe(provider: NewsProvider, { categories }: SearchParams): boolean {
    if (!categories?.length) return true;
    return categories.some((category) => provider.supportedCategories.includes(category));
  }
}
