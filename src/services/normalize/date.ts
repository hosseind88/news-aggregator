/** `+0000` (NYT) is not valid ISO-8601 extended; rewrite to `+00:00`. */
const fixOffset = (value: string) => value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

/** Any API timestamp -> ISO-8601 UTC (`2024-05-02T10:00:00.000Z`), or undefined if unparseable. */
export const normalizeDate = (raw: string | null | undefined): string | undefined => {
  if (!raw) return undefined;
  const time = Date.parse(fixOffset(raw.trim()));
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};

/** Inclusive UTC day bounds for `YYYY-MM-DD` filters, compared against normalised timestamps. */
export const isWithinDateRange = (iso: string, from?: string, to?: string): boolean => {
  const time = Date.parse(iso);
  if (from && time < Date.parse(`${from}T00:00:00.000Z`)) return false;
  if (to && time > Date.parse(`${to}T23:59:59.999Z`)) return false;
  return true;
};
