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
    ...over,
  }) as unknown as ArticlesQuery;

const renderResults = (query: ArticlesQuery) =>
  render(
    <MemoryRouter>
      <ArticleResults query={query} />
    </MemoryRouter>,
  );

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
