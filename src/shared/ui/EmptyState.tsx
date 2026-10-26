import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Page-level empty states (e.g. not found) are the page's h1. */
  as?: 'h1' | 'h2';
}

export function EmptyState({ title, description, action, as: Heading = 'h2' }: Props) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
      <Heading className="text-lg font-semibold">{title}</Heading>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-slate-600 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
