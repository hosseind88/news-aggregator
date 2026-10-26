const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const HOUR = 3_600_000;

/** "3 hours ago" for the last day, otherwise "May 2, 2024". */
export const formatPublished = (iso: string, now = Date.now()): string => {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const age = now - time;
  if (age >= 0 && age < 24 * HOUR) {
    return age < HOUR
      ? relativeFormat.format(-Math.max(1, Math.round(age / 60_000)), 'minute')
      : relativeFormat.format(-Math.round(age / HOUR), 'hour');
  }
  return dateFormat.format(time);
};
