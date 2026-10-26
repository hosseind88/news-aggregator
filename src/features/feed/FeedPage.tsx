import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArticleResults } from '@/features/articles/components/ArticleResults';
import { useArticles } from '@/features/articles/hooks/useArticles';
import { isByAuthor, prioritiseAuthors } from '@/features/preferences/authors';
import { usePreferences } from '@/features/preferences/usePreferences';

export function FeedPage() {
  const { sources, categories, authors, hasPreferences } = usePreferences();
  const [onlyFollowed, setOnlyFollowed] = useState(false);

  const query = useArticles({
    sources: sources.length ? sources : undefined,
    categories: categories.length ? categories : undefined,
  });

  const visible = useMemo(() => {
    const ordered = prioritiseAuthors(query.articles, authors);
    return onlyFollowed ? ordered.filter((a) => isByAuthor(a, authors)) : ordered;
  }, [query.articles, authors, onlyFollowed]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">
            {hasPreferences ? 'My Feed' : 'Latest news'}
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {hasPreferences
              ? 'Based on your preferred sources, categories and authors.'
              : 'The newest stories from all sources.'}
          </p>
        </div>
        {authors.length > 0 && (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={onlyFollowed}
              onChange={(e) => setOnlyFollowed(e.target.checked)}
              className="size-4 accent-blue-700"
            />
            Only followed authors
          </label>
        )}
      </header>

      {!hasPreferences && (
        <aside className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
          Want news tailored to you?{' '}
          <Link to="/preferences" className="font-semibold underline">
            Personalise your feed
          </Link>
          .
        </aside>
      )}

      <ArticleResults
        query={query}
        articles={visible}
        isFollowed={(article) => isByAuthor(article, authors)}
        emptyTitle={onlyFollowed ? 'No articles from followed authors yet' : 'No articles found'}
        emptyDescription={
          onlyFollowed
            ? 'Turn off the filter to see all articles.'
            : 'Try different preferences or check back later.'
        }
      />
    </div>
  );
}
