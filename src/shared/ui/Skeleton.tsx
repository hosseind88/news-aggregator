interface Props {
  className?: string;
}

/** Decorative placeholder block; hidden from assistive tech. */
export function Skeleton({ className = '' }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-slate-200 dark:bg-slate-800 ${className}`}
    />
  );
}
