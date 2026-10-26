import { Button } from './Button';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
