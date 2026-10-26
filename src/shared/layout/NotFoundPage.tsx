import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle';
import { EmptyState } from '@/shared/ui/EmptyState';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <EmptyState
      as="h1"
      title="Page not found"
      description="The page you are looking for does not exist."
      action={
        <Link className="font-medium text-blue-700 underline dark:text-blue-300" to="/">
          Back to your feed
        </Link>
      }
    />
  );
}
