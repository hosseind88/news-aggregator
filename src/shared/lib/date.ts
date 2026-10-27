const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const HOUR = 3_600_000;

/** "3 hours ago" for the last day, otherwise "May 2, 2024". */
export const formatPublished = (iso: string, now = Date.now()): string => {
  const timestampMs = Date.parse(iso);
  if (Number.isNaN(timestampMs)) return '';
  const ageMs = now - timestampMs;
  if (ageMs >= 0 && ageMs < 24 * HOUR) {
    return ageMs < HOUR
      ? relativeFormat.format(-Math.max(1, Math.round(ageMs / 60_000)), 'minute')
      : relativeFormat.format(-Math.round(ageMs / HOUR), 'hour');
  }
  return dateFormat.format(timestampMs);
};
