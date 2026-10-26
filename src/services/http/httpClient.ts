export type QueryParams = Record<string, string | number | undefined>;

export interface HttpClient {
  getJson(path: string, params?: QueryParams): Promise<unknown>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const describeStatus = (status: number): string => {
  if (status === 401 || status === 403) return 'API key is missing or invalid';
  if (status === 429) return 'Rate limit reached, try again shortly';
  return `Request failed (HTTP ${status})`;
};

/** Thin fetch wrapper: builds the query string, drops undefined params, normalises errors. */
export const createHttpClient = (baseUrl = ''): HttpClient => ({
  async getJson(path, params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const query = search.toString();
    const response = await fetch(`${baseUrl}${path}${query ? `?${query}` : ''}`);
    if (!response.ok) throw new HttpError(response.status, describeStatus(response.status));
    return response.json();
  },
});
