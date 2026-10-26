import { useState } from 'react';
import { CATEGORY_LABELS, type Article } from '@/domain/news';
import { formatPublished } from '@/shared/lib/date';

interface Props {
  article: Article;
  /** Shown as a badge when the author is one the user follows. */
  followed?: boolean;
}

export function ArticleCard({ article, followed = false }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const {
    title,
    description,
    url,
    imageUrl,
    authors,
    sourceName,
    publisher,
    category,
    publishedAt,
  } = article;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition focus-within:ring-2 focus-within:ring-blue-600 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      {imageUrl && !imageFailed && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="aspect-video w-full object-cover"
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            {sourceName}
          </span>
          {publisher && <span>{publisher}</span>}
          {category && <span>{CATEGORY_LABELS[category]}</span>}
          {followed && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
              Followed author
            </span>
          )}
        </div>
        <h3 className="font-serif text-lg font-semibold leading-snug">
          {/* Stretched link: the whole card is clickable, but only the title is focusable. */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="after:absolute after:inset-0 focus:outline-none"
          >
            {title}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </h3>
        {description && (
          <p className="line-clamp-3 text-sm text-slate-700 dark:text-slate-300">{description}</p>
        )}
        <p className="mt-auto pt-2 text-xs text-slate-600 dark:text-slate-400">
          {authors.length > 0 && <span>By {authors.join(', ')} · </span>}
          <time dateTime={publishedAt}>{formatPublished(publishedAt)}</time>
        </p>
      </div>
    </article>
  );
}
