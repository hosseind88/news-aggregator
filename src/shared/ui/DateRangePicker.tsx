import * as Popover from '@radix-ui/react-popover';
import { endOfMonth, format, isValid, parse, startOfMonth, startOfToday, subDays } from 'date-fns';
import { useState } from 'react';
import { DayPicker, type ClassNames, type DateRange as DayRange } from 'react-day-picker';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

export interface DateRange {
  from?: string;
  to?: string;
}

interface Props extends DateRange {
  onChange: (range: DateRange) => void;
}

const ISO = 'yyyy-MM-dd';
/** NewsAPI's free plan only serves roughly the last month. */
const NEWSAPI_WINDOW_DAYS = 30;

// ISO strings are parsed/formatted as local calendar dates so they never shift with the time zone.
const parseIsoDay = (iso?: string): Date | undefined => {
  if (!iso) return undefined;
  const date = parse(iso, ISO, new Date());
  return isValid(date) ? date : undefined;
};
const formatIsoDay = (date?: Date): string | undefined => (date ? format(date, ISO) : undefined);

const formatRangeLabel = (from?: Date, to?: Date): string => {
  if (!from && !to) return 'Any date';
  if (from && to) {
    const sameYear = from.getFullYear() === to.getFullYear();
    return `${format(from, sameYear ? 'MMM d' : 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`;
  }
  return from
    ? `From ${format(from, 'MMM d, yyyy')}`
    : `Until ${format(to as Date, 'MMM d, yyyy')}`;
};

const PRESETS: { name: string; range: (today: Date) => DateRange }[] = [
  { name: 'Today', range: (today) => ({ from: formatIsoDay(today), to: formatIsoDay(today) }) },
  {
    name: 'Last 7 days',
    range: (today) => ({ from: formatIsoDay(subDays(today, 6)), to: formatIsoDay(today) }),
  },
  {
    name: 'Last 30 days',
    range: (today) => ({ from: formatIsoDay(subDays(today, 29)), to: formatIsoDay(today) }),
  },
  {
    name: 'This month',
    range: (today) => ({
      from: formatIsoDay(startOfMonth(today)),
      to: formatIsoDay(endOfMonth(today) > today ? today : endOfMonth(today)),
    }),
  },
];

const dayClassNames: Partial<ClassNames> = {
  root: 'text-slate-900 dark:text-slate-100',
  months: 'relative flex flex-col gap-4 sm:flex-row',
  month: 'w-full',
  month_caption: 'flex h-9 items-center justify-center text-sm font-semibold',
  nav: 'absolute inset-x-0 top-0 flex h-9 items-center justify-between',
  button_previous:
    'z-10 inline-flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800',
  button_next:
    'z-10 inline-flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800',
  chevron: 'size-4 fill-current',
  month_grid: 'w-full border-collapse',
  weekday: 'size-9 text-xs font-medium text-slate-500 dark:text-slate-400',
  day: 'p-0 text-center text-sm',
  day_button:
    'size-9 rounded-md hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800',
  today: 'font-semibold [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-blue-600',
  outside: 'text-slate-400 opacity-60 dark:text-slate-600',
  disabled:
    'cursor-not-allowed text-slate-300 opacity-60 [&>button]:pointer-events-none dark:text-slate-700',
  range_start:
    'rounded-l-md bg-blue-100 dark:bg-blue-950 [&>button]:bg-blue-700 [&>button]:text-white [&>button:hover]:bg-blue-800 dark:[&>button]:bg-blue-500 dark:[&>button]:text-slate-950',
  range_end:
    'rounded-r-md bg-blue-100 dark:bg-blue-950 [&>button]:bg-blue-700 [&>button]:text-white [&>button:hover]:bg-blue-800 dark:[&>button]:bg-blue-500 dark:[&>button]:text-slate-950',
  range_middle: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
};

const CalendarIcon = () => (
  <svg
    viewBox="0 0 20 20"
    className="size-4 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <rect x="3" y="4.5" width="14" height="12" rx="2" />
    <path d="M3 8h14M7 2.5v3M13 2.5v3" strokeLinecap="round" />
  </svg>
);

const presetButton =
  'whitespace-nowrap rounded-md px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800';

export function DateRangePicker({ from, to, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const isWideViewport = useMediaQuery('(min-width: 768px)');

  const fromDate = parseIsoDay(from);
  const toDateValue = parseIsoDay(to);
  const today = startOfToday();
  const hasRange = Boolean(from || to);
  const summary = formatRangeLabel(fromDate, toDateValue);
  const newsApiCutoff = subDays(today, NEWSAPI_WINDOW_DAYS);
  const isBeyondNewsApiWindow = Boolean(fromDate && fromDate < newsApiCutoff);

  const applyRange = (range: DateRange) => onChange(range);

  const handleDaySelect = (selected: DayRange | undefined) => {
    const next = { from: formatIsoDay(selected?.from), to: formatIsoDay(selected?.to) };
    applyRange(next);
    if (next.from && next.to) setOpen(false);
  };

  return (
    <div>
      <span id="date-range-label" className="mb-2 block text-sm font-semibold">
        Date range
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <div className="relative">
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-labelledby="date-range-label date-range-value"
              className="flex w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 pr-9 text-left text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <CalendarIcon />
              <span
                id="date-range-value"
                className={`truncate ${hasRange ? '' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {summary}
              </span>
            </button>
          </Popover.Trigger>
          {hasRange && (
            <button
              type="button"
              aria-label="Clear date range"
              onClick={() => applyRange({})}
              className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={8}
            aria-label="Choose date range"
            className="z-50 max-h-[var(--radix-popover-content-available-height)] w-max max-w-[calc(100vw-1rem)] overflow-auto rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="flex flex-wrap gap-1 md:w-32 md:flex-col md:border-r md:border-slate-200 md:pr-3 dark:md:border-slate-700">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={presetButton}
                    onClick={() => {
                      applyRange(preset.range(today));
                      setOpen(false);
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
                <button
                  type="button"
                  className={presetButton}
                  onClick={() => {
                    applyRange({});
                    setOpen(false);
                  }}
                >
                  Clear
                </button>
              </div>
              <div>
                <DayPicker
                  mode="range"
                  numberOfMonths={isWideViewport ? 2 : 1}
                  defaultMonth={fromDate ?? today}
                  selected={
                    fromDate || toDateValue ? { from: fromDate, to: toDateValue } : undefined
                  }
                  onSelect={handleDaySelect}
                  disabled={{ after: today }}
                  endMonth={today}
                  classNames={dayClassNames}
                />
                <p
                  className={`mt-2 text-xs ${isBeyondNewsApiWindow ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  NewsAPI&apos;s free plan only covers about the last month; other sources are
                  unaffected.
                </p>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
