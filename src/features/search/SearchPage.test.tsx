import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { format } from 'date-fns';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { TestRouter } from '@/test/TestRouter';
import type { NewsService } from '@/domain/news';
import { NewsServiceProvider } from '@/services/NewsServiceContext';
import { makeArticle } from '@/test/factories';
import { SearchPage } from './SearchPage';

const Location = () => <output data-testid="search">{useLocation().search}</output>;

const setup = (initialUrl = '/search') => {
  const search = vi.fn<NewsService['search']>().mockResolvedValue({
    articles: [makeArticle({ id: '1', title: 'Result headline', url: 'https://x.com/1' })],
    failures: [],
  });
  const service: NewsService = { providers: [], search };
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NewsServiceProvider service={service}>
        <TestRouter initialEntries={[initialUrl]}>
          <SearchPage />
          <Location />
        </TestRouter>
      </NewsServiceProvider>
    </QueryClientProvider>,
  );
  return { search };
};

const todayIso = format(new Date(), 'yyyy-MM-dd');

describe('SearchPage', () => {
  it('renders results for the initial filters read from the URL', async () => {
    const { search } = setup(
      '/search?q=climate&categories=science,health&sources=guardian&from=2024-05-01',
    );

    expect(await screen.findByRole('heading', { name: /Result headline/ })).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: 'climate',
        categories: ['science', 'health'],
        sources: ['guardian'],
        from: '2024-05-01',
      }),
      expect.anything(),
    );
    expect(screen.getByLabelText('Keyword')).toHaveValue('climate');
    expect(screen.getByRole('checkbox', { name: 'Science' })).toBeChecked();
  });

  it('debounces the keyword into the URL and re-queries', async () => {
    const user = userEvent.setup();
    const { search } = setup();
    await screen.findByRole('heading', { name: /Result headline/ });

    await user.type(screen.getByLabelText('Keyword'), 'chips');

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('?q=chips'));
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'chips' }),
        expect.anything(),
      ),
    );
    // Typing 5 characters must not trigger 5 searches.
    expect(search.mock.calls.filter(([p]) => p.keyword)).toHaveLength(1);
  });

  it('updates the URL and results when filters change', async () => {
    const user = userEvent.setup();
    const { search } = setup();
    await screen.findByRole('heading', { name: /Result headline/ });

    await user.click(screen.getByRole('checkbox', { name: 'Technology' }));
    await user.click(screen.getByRole('checkbox', { name: 'The Guardian' }));
    await user.click(screen.getByRole('button', { name: /Date range/ }));
    await user.click(screen.getByRole('button', { name: 'Today' }));

    const url = screen.getByTestId('search');
    await waitFor(() => {
      expect(url).toHaveTextContent('categories=technology');
      expect(url).toHaveTextContent('sources=guardian');
      expect(url).toHaveTextContent(`from=${todayIso}`);
    });
    await waitFor(() =>
      expect(search).toHaveBeenLastCalledWith(
        expect.objectContaining({
          categories: ['technology'],
          sources: ['guardian'],
          from: todayIso,
        }),
        expect.anything(),
      ),
    );
  });

  it('clears all filters', async () => {
    const user = userEvent.setup();
    setup('/search?q=abc&categories=health');
    await screen.findByRole('heading', { name: /Result headline/ });

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));

    await waitFor(() => expect(screen.getByTestId('search')).toBeEmptyDOMElement());
    expect(screen.getByLabelText('Keyword')).toHaveValue('');
  });

  it('shows a non-blocking notice when a source fails but others succeed', async () => {
    const search = vi.fn<NewsService['search']>().mockResolvedValue({
      articles: [makeArticle({ title: 'Still here' })],
      failures: [
        { source: 'nyt', sourceName: 'The New York Times', message: 'Rate limit reached' },
      ],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NewsServiceProvider service={{ providers: [], search }}>
          <TestRouter>
            <SearchPage />
          </TestRouter>
        </NewsServiceProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: /Still here/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('The New York Times: Rate limit reached');
  });
});
