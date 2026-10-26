import { useEffect, useRef, useState } from 'react';
import { ArticleResults } from '@/features/articles/components/ArticleResults';
import { useArticles } from '@/features/articles/hooks/useArticles';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { Button } from '@/shared/ui/Button';
import { TextInput } from '@/shared/ui/TextInput';
import { FilterPanel } from './FilterPanel';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { useSearchFilters } from './useSearchFilters';

export function SearchPage() {
  const { filters, setFilters, reset } = useSearchFilters();
  useDocumentTitle('Search');
  const [input, setInput] = useState(filters.keyword ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Push the debounced keyword into the URL; ignore re-runs caused by other URL changes.
  const debounced = useDebounce(input.trim());
  const committed = useRef(debounced);
  useEffect(() => {
    if (debounced === committed.current) return;
    committed.current = debounced;
    setFilters({ keyword: debounced });
  }, [debounced, setFilters]);

  const query = useArticles(filters);

  const handleReset = () => {
    setInput('');
    committed.current = '';
    reset();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold">Search</h1>

      <div role="search" className="flex items-end gap-2">
        <div className="flex-1">
          <TextInput
            type="search"
            label="Keyword"
            placeholder="Search headlines and articles…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          className="lg:hidden"
          aria-expanded={filtersOpen}
          aria-controls="search-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside
          id="search-filters"
          aria-label="Filters"
          className={`${filtersOpen ? 'block' : 'hidden'} h-fit rounded-lg border border-slate-200 bg-white p-4 lg:block dark:border-slate-800 dark:bg-slate-900`}
        >
          <FilterPanel filters={filters} onChange={setFilters} onReset={handleReset} />
        </aside>
        <section aria-label="Results" aria-live="polite">
          <ArticleResults
            query={query}
            emptyDescription="No articles match your keyword and filters. Try widening the date range or removing a filter."
            emptyAction={
              <Button variant="secondary" onClick={handleReset}>
                Clear all filters
              </Button>
            }
          />
        </section>
      </div>
    </div>
  );
}
