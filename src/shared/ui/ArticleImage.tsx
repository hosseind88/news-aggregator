import { useState, type SyntheticEvent } from 'react';
import type { SourceId } from '@/domain/news';

interface Props {
  src?: string;
  /** Article title; used as alt text for real images only. */
  alt: string;
  source: SourceId;
  /** Small caption on the placeholder (source name or category). */
  label?: string;
}

/** Gradient tint per source, light and dark. */
export const SOURCE_TINTS: Record<SourceId, string> = {
  guardian:
    'from-blue-100 to-sky-200 text-blue-900 dark:from-blue-950 dark:to-sky-900 dark:text-blue-200',
  nyt: 'from-slate-200 to-zinc-300 text-slate-800 dark:from-slate-900 dark:to-zinc-800 dark:text-slate-300',
  newsapi:
    'from-amber-100 to-orange-200 text-amber-900 dark:from-amber-950 dark:to-orange-900 dark:text-amber-200',
};

const isHttpUrl = (value?: string): value is string => {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

// Anything this small is a tracking pixel or spacer, not a photo.
const MIN_SIZE = 2;

function Placeholder({ source, label }: Pick<Props, 'source' | 'label'>) {
  return (
    <div
      aria-hidden="true"
      data-source={source}
      className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${SOURCE_TINTS[source]}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-10 opacity-60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 5h13a1 1 0 0 1 1 1v13H6a2 2 0 0 1-2-2V5Z" />
        <path d="M18 9h2v8a2 2 0 0 1-2 2M7.5 9h7M7.5 12h7M7.5 15h4" />
      </svg>
      {label && <span className="text-xs font-medium opacity-80">{label}</span>}
    </div>
  );
}

export function ArticleImage({ src, alt, source, label }: Props) {
  // Track by src so a changed URL gets a fresh attempt, while a failed one is never retried.
  const [failedSrc, setFailedSrc] = useState<string>();
  const [loadedSrc, setLoadedSrc] = useState<string>();
  const valid = isHttpUrl(src);
  const failed = !valid || failedSrc === src;
  const loaded = valid && loadedSrc === src;

  const check = (img: HTMLImageElement) => {
    if (!img.complete) return;
    if (img.naturalWidth < MIN_SIZE || img.naturalHeight < MIN_SIZE) setFailedSrc(src);
    else setLoadedSrc(src);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
      {failed ? (
        <Placeholder source={source} label={label} />
      ) : (
        <>
          {!loaded && (
            <div
              aria-hidden="true"
              data-testid="image-skeleton"
              className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-700"
            />
          )}
          <img
            key={src}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            ref={(img) => {
              // Covers images already complete (cached) before React attached onLoad.
              if (img && !loaded) check(img);
            }}
            onLoad={(e: SyntheticEvent<HTMLImageElement>) => check(e.currentTarget)}
            onError={() => setFailedSrc(src)}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      )}
    </div>
  );
}
