import type { SourceFailure } from '@/domain/news';

interface Props {
  failures: SourceFailure[];
}

/** Non-blocking: other sources still render when some fail. */
export function SourceFailureNotice({ failures }: Props) {
  if (failures.length === 0) return null;
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <p className="font-medium">Some sources could not be loaded:</p>
      <ul className="mt-1 list-disc pl-5">
        {failures.map((failure) => (
          <li key={failure.source}>
            {failure.sourceName}: {failure.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
