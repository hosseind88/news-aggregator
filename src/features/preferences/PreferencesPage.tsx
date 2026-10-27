import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useState, type FormEvent } from 'react';
import { CATEGORIES, CATEGORY_LABELS, SOURCE_IDS, SOURCE_LABELS } from '@/domain/news';
import { authorKey } from '@/services/normalize';
import { useArticles } from '@/features/articles/hooks/useArticles';
import { Button } from '@/shared/ui/Button';
import { MultiSelect } from '@/shared/ui/MultiSelect';
import { TextInput } from '@/shared/ui/TextInput';
import { collectAuthors } from './authors';
import { usePreferences } from './usePreferences';
import { usePreferencesStore } from './preferencesStore';

const sourceOptions = SOURCE_IDS.map((value) => ({ value, label: SOURCE_LABELS[value] }));
const categoryOptions = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));

export function PreferencesPage() {
  useDocumentTitle('Preferences');
  const { sources, categories, authors, hasPreferences } = usePreferences();
  const { setSources, setCategories, addAuthor, removeAuthor, reset } =
    usePreferencesStore.getState();
  const [authorDraft, setAuthorDraft] = useState('');

  // Suggestions come from the latest articles (shares the cache with the home feed).
  const latestArticlesQuery = useArticles({});
  const suggestions = collectAuthors(latestArticlesQuery.articles).filter(
    (name) => !authors.some((followedAuthor) => authorKey(followedAuthor) === authorKey(name)),
  );

  const followDraftAuthor = (event: FormEvent) => {
    event.preventDefault();
    addAuthor(authorDraft);
    setAuthorDraft('');
  };

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-bold">Preferences</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Choose what shows up in My Feed. Changes are saved automatically in this browser. Leave a
          group empty to include everything.
        </p>
      </header>

      <section aria-labelledby="sources-heading" className="space-y-3">
        <h2 id="sources-heading" className="sr-only">
          Sources
        </h2>
        <MultiSelect
          legend="Preferred sources"
          options={sourceOptions}
          selected={sources}
          onChange={setSources}
        />
      </section>

      <section aria-labelledby="categories-heading" className="space-y-3">
        <h2 id="categories-heading" className="sr-only">
          Categories
        </h2>
        <MultiSelect
          legend="Preferred categories"
          options={categoryOptions}
          selected={categories}
          onChange={setCategories}
        />
      </section>

      <section aria-labelledby="authors-heading" className="space-y-3">
        <h2 id="authors-heading" className="text-sm font-semibold">
          Followed authors
        </h2>
        <form onSubmit={followDraftAuthor} className="flex items-end gap-2">
          <div className="flex-1">
            <TextInput
              label="Add an author"
              value={authorDraft}
              onChange={(e) => setAuthorDraft(e.target.value)}
              placeholder="e.g. Jane Doe"
            />
          </div>
          <Button type="submit" disabled={!authorDraft.trim()}>
            Add
          </Button>
        </form>

        {authors.length > 0 && (
          <ul aria-label="Followed authors" className="flex flex-wrap gap-2">
            {authors.map((author) => (
              <li
                key={author}
                className="flex items-center gap-1 rounded-full bg-blue-700 py-1 pl-3 pr-1 text-sm text-white dark:bg-blue-500 dark:text-slate-950"
              >
                {author}
                <button
                  type="button"
                  onClick={() => removeAuthor(author)}
                  aria-label={`Remove ${author}`}
                  className="rounded-full px-2 py-0.5 hover:bg-black/20 focus-visible:outline-2 focus-visible:outline-white"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {suggestions.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
              Authors in today&apos;s headlines:
            </p>
            <ul className="flex flex-wrap gap-2">
              {suggestions.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => addAuthor(name)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    + {name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Button variant="secondary" onClick={reset} disabled={!hasPreferences}>
        Reset all preferences
      </Button>
    </div>
  );
}
