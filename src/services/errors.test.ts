import { z } from 'zod';
import {
  AllSourcesFailedError,
  describeError,
  HttpError,
  NetworkError,
  RequestTimeoutError,
} from './errors';

describe('describeError', () => {
  it('shows the message of our own error types', () => {
    expect(describeError(new HttpError(429, 'Rate limit reached'))).toBe('Rate limit reached');
    expect(describeError(new RequestTimeoutError())).toMatch(/too long/);
    expect(describeError(new NetworkError())).toMatch(/check your connection/);
    expect(
      describeError(
        new AllSourcesFailedError([{ source: 'nyt', sourceName: 'NYT', message: 'down' }]),
      ),
    ).toBe('NYT: down');
  });

  it('never leaks validation internals', () => {
    const zodError = z.object({ a: z.string() }).safeParse({}).error!;
    expect(describeError(zodError)).toBe('The source returned data in an unexpected format');
    expect(describeError(zodError)).not.toMatch(/invalid_type|path/);
  });

  it('falls back to a generic sentence for unknown throwables', () => {
    expect(describeError(new TypeError('x is not a function'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(describeError('boom')).toBe('Something went wrong. Please try again.');
  });
});
