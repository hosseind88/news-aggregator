import { HttpError, NetworkError, RequestTimeoutError } from '@/services/errors';

export type QueryParams = Record<string, string | number | undefined>;

export interface RequestOptions {
  /** Aborts the request, e.g. when the query that needed it is cancelled. */
  signal?: AbortSignal;
}

export interface HttpClient {
  getJson(path: string, params?: QueryParams, options?: RequestOptions): Promise<unknown>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

const describeStatus = (status: number): string => {
  if (status === 401 || status === 403) return 'API key is missing or invalid';
  if (status === 426) return 'Result limit of the current plan reached';
  if (status === 429) return 'Rate limit reached, try again shortly';
  return `Request failed (HTTP ${status})`;
};

/**
 * Thin fetch wrapper: builds the query string, drops undefined params, enforces a timeout
 * and normalises failures into `HttpError` / `RequestTimeoutError` / `NetworkError`.
 * A caller-initiated abort is rethrown untouched so query libraries can treat it as a cancel.
 */
export const createHttpClient = (baseUrl = '', timeoutMs = DEFAULT_TIMEOUT_MS): HttpClient => ({
  async getJson(path, params = {}, { signal } = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const query = search.toString();

    const timeout = AbortSignal.timeout(timeoutMs);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}${query ? `?${query}` : ''}`, {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw timeout.aborted ? new RequestTimeoutError() : new NetworkError();
    }

    if (!response.ok) throw new HttpError(response.status, describeStatus(response.status));
    try {
      return await response.json();
    } catch (error) {
      if (signal?.aborted) throw error;
      throw timeout.aborted ? new RequestTimeoutError() : new HttpError(502, 'Invalid response');
    }
  },
});
