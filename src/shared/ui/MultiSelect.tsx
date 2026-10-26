import { useId } from 'react';

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  legend: string;
  options: readonly Option<T>[];
  selected: readonly T[];
  onChange: (selected: T[]) => void;
}

/** Accessible multi-select: a fieldset of checkboxes styled as toggle chips. */
export function MultiSelect<T extends string>({ legend, options, selected, onChange }: Props<T>) {
  const name = useId();
  const toggle = (value: T) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="checkbox"
              name={name}
              className="peer sr-only"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            <span className="inline-block rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 transition hover:bg-slate-100 peer-checked:border-blue-700 peer-checked:bg-blue-700 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:peer-checked:border-blue-500 dark:peer-checked:bg-blue-500 dark:peer-checked:text-slate-950">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
