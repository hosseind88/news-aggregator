import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { NewsService } from '@/domain/news';
import { usePreferencesStore } from '@/features/preferences/preferencesStore';
import { NewsServiceProvider } from '@/services/NewsServiceContext';
import { makeArticle } from '@/test/factories';
import { FeedPage } from './FeedPage';

const setup = () => {
  const search = vi.fn<NewsService['search']>().mockResolvedValue({
    articles: [
      makeArticle({ id: '1', title: 'Other story', url: 'https://x.com/1', authors: ['Someone'] }),
      makeArticle({
        id: '2',
        title: 'Followed story',
        url: 'https://x.com/2',
        authors: ['Jane Doe'],
      }),
    ],
    failures: [],
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewsServiceProvider service={{ providers: [], search }}>
        <MemoryRouter>
          <FeedPage />
        </MemoryRouter>
      </NewsServiceProvider>
    </QueryClientProvider>,
  );
  return { search };
};

beforeEach(() => usePreferencesStore.getState().reset());

describe('FeedPage', () => {
  it('shows latest news with a personalise prompt when no preferences are set', async () => {
    const { search } = setup();

    expect(await screen.findByRole('heading', { name: 'Latest news' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Personalise your feed' })).toHaveAttribute(
      'href',
      '/preferences',
    );
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ sources: undefined }),
      expect.anything(),
    );
  });

  it('queries with saved preferences and puts followed authors first', async () => {
    usePreferencesStore.setState({
      sources: ['nyt'],
      categories: ['science'],
      authors: ['Jane Doe'],
    });
    const { search } = setup();

    expect(await screen.findByRole('heading', { name: 'My Feed' })).toBeInTheDocument();
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ sources: ['nyt'], categories: ['science'] }),
      expect.anything(),
    );
    const titles = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent);
    expect(titles[0]).toMatch(/Followed story/);
    expect(screen.getByText('Followed author')).toBeInTheDocument();
  });
});
