import { TextInput } from './TextInput';

export interface DateRange {
  from?: string;
  to?: string;
}

interface Props extends DateRange {
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ from, to, onChange }: Props) {
  const emit = (patch: DateRange) => onChange({ from, to, ...patch });
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Date range</legend>
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          type="date"
          label="From"
          value={from ?? ''}
          max={to}
          onChange={(e) => emit({ from: e.target.value || undefined })}
        />
        <TextInput
          type="date"
          label="To"
          value={to ?? ''}
          min={from}
          onChange={(e) => emit({ to: e.target.value || undefined })}
        />
      </div>
    </fieldset>
  );
}
