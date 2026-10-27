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
  const { filters, setFilters, resetFilters } = useSearchFilters();
  useDocumentTitle('Search');
  const [searchText, setSearchText] = useState(filters.keyword ?? '');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Push the debounced keyword into the URL; ignore re-runs caused by other URL changes.
  const debouncedSearchText = useDebounce(searchText.trim());
  const committedSearchText = useRef(debouncedSearchText);
  useEffect(() => {
    if (debouncedSearchText === committedSearchText.current) return;
    committedSearchText.current = debouncedSearchText;
    setFilters({ keyword: debouncedSearchText });
  }, [debouncedSearchText, setFilters]);

  const query = useArticles(filters);

  const resetSearch = () => {
    setSearchText('');
    committedSearchText.current = '';
    resetFilters();
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
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          className="lg:hidden"
          aria-expanded={isFiltersOpen}
          aria-controls="search-filters"
          onClick={() => setIsFiltersOpen((open) => !open)}
        >
          Filters
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside
          id="search-filters"
          aria-label="Filters"
          className={`${isFiltersOpen ? 'block' : 'hidden'} h-fit rounded-lg border border-slate-200 bg-white p-4 lg:block dark:border-slate-800 dark:bg-slate-900`}
        >
          <FilterPanel filters={filters} onChange={setFilters} onReset={resetSearch} />
        </aside>
        <section aria-label="Results" aria-live="polite">
          <ArticleResults
            query={query}
            emptyDescription="No articles match your keyword and filters. Try widening the date range or removing a filter."
            emptyAction={
              <Button variant="secondary" onClick={resetSearch}>
                Clear all filters
              </Button>
            }
          />
        </section>
      </div>
    </div>
  );
}
