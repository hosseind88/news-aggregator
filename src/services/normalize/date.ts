/** `+0000` (NYT) is not valid ISO-8601 extended; rewrite to `+00:00`. */
const fixOffset = (value: string) => value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

/** Any API timestamp -> ISO-8601 UTC (`2024-05-02T10:00:00.000Z`), or undefined if unparseable. */
export const normalizeDate = (raw: string | null | undefined): string | undefined => {
  if (!raw) return undefined;
  const time = Date.parse(fixOffset(raw.trim()));
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};

/**
 * Date filters are calendar days (`YYYY-MM-DD`) as the user sees them, i.e. in local time.
 * Returns undefined for anything that is not a real calendar day (`2024-02-31`, `garbage`).
 */
const parseDay = (day: string | undefined): [number, number, number] | undefined => {
  const match = day?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const [year, month, date] = match.slice(1).map(Number) as [number, number, number];
  const probe = new Date(year, month - 1, date);
  const real =
    probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === date;
  return real ? [year, month, date] : undefined;
};

export const isValidDay = (day: string | undefined): day is string => parseDay(day) !== undefined;

/** First instant of a local calendar day. */
export const startOfLocalDay = (day: string | undefined): Date | undefined => {
  const parts = parseDay(day);
  return parts && new Date(parts[0], parts[1] - 1, parts[2]);
};

/** Last millisecond of a local calendar day. */
export const endOfLocalDay = (day: string | undefined): Date | undefined => {
  const parts = parseDay(day);
  return parts && new Date(parts[0], parts[1] - 1, parts[2] + 1, 0, 0, 0, -1);
};

/** `YYYYMMDD` of an instant's UTC date, for APIs that only take whole UTC days (NYT). */
export const toUtcDayStamp = (date: Date): string =>
  date.toISOString().slice(0, 10).replaceAll('-', '');

/** Whether a normalised timestamp falls inside the inclusive local-day range. */
export const isWithinDateRange = (iso: string, from?: string, to?: string): boolean => {
  const time = Date.parse(iso);
  const start = startOfLocalDay(from);
  const end = endOfLocalDay(to);
  if (start && time < start.getTime()) return false;
  if (end && time > end.getTime()) return false;
  return true;
};
