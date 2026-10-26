import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makeArticle } from '@/test/factories';
import type { ArticlesQuery } from '../hooks/useArticles';
import { ArticleResults } from './ArticleResults';

const makeQuery = (over: Partial<ArticlesQuery> = {}) =>
  ({
    articles: [makeArticle({ id: '1', url: 'https://x.com/1' })],
    failures: [],
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage: vi.fn(),
    filtersKey: 'k',
    data: { pages: [{}] },
    ...over,
  }) as unknown as ArticlesQuery;

const renderResults = (
  query: ArticlesQuery,
  props: { articles?: ReturnType<typeof makeArticle>[] } = {},
) =>
  render(
    <MemoryRouter>
      <ArticleResults
        query={query}
        emptyTitle="Nothing"
        stalledTitle="No recent matches"
        emptyAction={<button>Show all</button>}
        {...props}
      />
    </MemoryRouter>,
  );

/** Re-renders the same tree with a newer query, as a loaded page would. */
const renderPaged = (initial: ArticlesQuery) => {
  const ui = (query: ArticlesQuery) => (
    <MemoryRouter>
      <ArticleResults
        query={query}
        articles={[]}
        emptyTitle="Nothing"
        stalledTitle="No recent matches"
      />
    </MemoryRouter>
  );
  const view = render(ui(initial));
  return (query: ArticlesQuery) => view.rerender(ui(query));
};
const pages = (n: number) =>
  ({
    data: { pages: Array.from({ length: n }, () => ({})), pageParams: [] },
  }) as unknown as Partial<ArticlesQuery>;

describe('ArticleResults footer', () => {
  it('shows the end message when there are no more pages', () => {
    renderResults(makeQuery());
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { hidden: true })).not.toBeInTheDocument();
  });

  it('shows the linear loader and a skeleton row while loading the next page', () => {
    renderResults(makeQuery({ hasNextPage: true, isFetching: true, isFetchingNextPage: true }));
    expect(screen.getByRole('progressbar', { name: 'Loading more articles' })).toBeInTheDocument();
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
  });

  it('replaces the bar with a retry button when loading more fails', async () => {
    const query = makeQuery({ hasNextPage: true, isFetchNextPageError: true });
    renderResults(query);

    expect(screen.queryByRole('progressbar', { hidden: true })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('has no "Load more" button', () => {
    renderResults(makeQuery({ hasNextPage: true }));
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });
});

describe('ArticleResults when nothing matches yet', () => {
  it('shows only the loader, never the empty state, while the next page loads', () => {
    renderResults(makeQuery({ hasNextPage: true, isFetching: true, isFetchingNextPage: true }), {
      articles: [],
    });
    expect(screen.queryByText('Nothing')).not.toBeInTheDocument();
    expect(screen.queryByText('No recent matches')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Loading more articles' })).toBeInTheDocument();
  });

  it('shows the plain empty state when the sources are exhausted', () => {
    renderResults(makeQuery(), { articles: [] });
    expect(screen.getByText('Nothing')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search older articles' })).not.toBeInTheDocument();
  });

  it('stops auto-loading after two fruitless pages and offers explicit actions', async () => {
    const base = { hasNextPage: true, fetchNextPage: vi.fn() };
    const rerender = renderPaged(makeQuery({ ...base, ...pages(1) }));
    rerender(makeQuery({ ...base, ...pages(2) }));
    expect(screen.queryByText('No recent matches')).not.toBeInTheDocument();
    rerender(makeQuery({ ...base, ...pages(3) }));

    expect(await screen.findByText('No recent matches')).toBeInTheDocument();
    expect(
      screen.queryByRole('progressbar', { name: 'Loading more articles' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Search older articles' }));
    expect(base.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('hides the stalled state again as soon as the explicit search starts loading', async () => {
    const base = { hasNextPage: true };
    const rerender = renderPaged(makeQuery({ ...base, ...pages(1) }));
    rerender(makeQuery({ ...base, ...pages(2) }));
    rerender(makeQuery({ ...base, ...pages(3) }));
    await screen.findByText('No recent matches');

    rerender(makeQuery({ ...base, ...pages(3), isFetching: true, isFetchingNextPage: true }));
    expect(screen.queryByText('No recent matches')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Loading more articles' })).toBeInTheDocument();
  });
});
