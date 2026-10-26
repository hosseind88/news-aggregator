import { CATEGORIES, CATEGORY_LABELS, SOURCE_IDS, SOURCE_LABELS } from '@/domain/news';
import type { ArticleFilters } from '@/features/articles/hooks/useArticles';
import { Button } from '@/shared/ui/Button';
import { DateRangePicker } from '@/shared/ui/DateRangePicker';
import { MultiSelect } from '@/shared/ui/MultiSelect';

const sourceOptions = SOURCE_IDS.map((value) => ({ value, label: SOURCE_LABELS[value] }));
const categoryOptions = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));

interface Props {
  filters: ArticleFilters;
  onChange: (patch: Partial<ArticleFilters>) => void;
  onReset: () => void;
}

/** Purely presentational: all state lives in the URL via `useSearchFilters`. */
export function FilterPanel({ filters, onChange, onReset }: Props) {
  return (
    <div className="space-y-6">
      <DateRangePicker from={filters.from} to={filters.to} onChange={onChange} />
      <MultiSelect
        legend="Category"
        options={categoryOptions}
        selected={filters.categories ?? []}
        onChange={(categories) => onChange({ categories })}
      />
      <MultiSelect
        legend="Source"
        options={sourceOptions}
        selected={filters.sources ?? []}
        onChange={(sources) => onChange({ sources })}
      />
      <Button variant="ghost" onClick={onReset}>
        Clear all filters
      </Button>
    </div>
  );
}
