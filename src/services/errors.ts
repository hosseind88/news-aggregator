import { ZodError } from 'zod';
import type { SourceFailure } from '@/domain/news';

/** HTTP status from a source; `message` is already safe to show to users. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class RequestTimeoutError extends Error {
  constructor() {
    super('The source took too long to respond');
    this.name = 'RequestTimeoutError';
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Could not reach the source, check your connection');
    this.name = 'NetworkError';
  }
}

/** A source has nothing more to give for this search (e.g. a plan's result cap was reached). */
export class SourceExhaustedError extends Error {
  constructor() {
    super('No more results available from this source');
    this.name = 'SourceExhaustedError';
  }
}

/** Every source that was asked failed, so there is nothing to show. */
export class AllSourcesFailedError extends Error {
  constructor(readonly failures: SourceFailure[]) {
    super(failures.map((f) => `${f.sourceName}: ${f.message}`).join(' · '));
    this.name = 'AllSourcesFailedError';
  }
}

const SAFE_ERRORS = [HttpError, RequestTimeoutError, NetworkError, AllSourcesFailedError];

/**
 * Turns anything thrown into a sentence fit for the UI. Only our own error types carry
 * user-facing messages; validation errors and unknown failures never leak internals.
 */
export const describeError = (error: unknown): string => {
  if (SAFE_ERRORS.some((type) => error instanceof type)) return (error as Error).message;
  if (error instanceof ZodError) return 'The source returned data in an unexpected format';
  return 'Something went wrong. Please try again.';
};
