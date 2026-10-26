interface Props {
  /** Fades the bar in and out while keeping its space reserved. */
  active: boolean;
  label?: string;
}

/** Thin indeterminate progress bar; a static pulse under `prefers-reduced-motion`. */
export function LinearProgress({ active, label = 'Loading' }: Props) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-hidden={!active}
      className={`relative h-[3px] w-full overflow-hidden rounded-full bg-blue-100 transition-opacity duration-300 dark:bg-blue-950 ${active ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="absolute inset-y-0 w-2/5 animate-indeterminate rounded-full bg-gradient-to-r from-blue-700 via-sky-400 to-blue-700 motion-reduce:w-full motion-reduce:animate-pulse" />
    </div>
  );
}
