import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';

interface Props {
  children: ReactNode;
}

/** Last line of defence: a render error or failed lazy chunk shows a recoverable message, not a blank page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <ErrorState
          message="An unexpected error occurred. Reloading usually fixes it."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }
}
