import { HttpError, NetworkError, RequestTimeoutError } from '@/services/errors';
import { createHttpClient } from './httpClient';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('createHttpClient', () => {
  it('builds the query string and skips undefined/empty params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await createHttpClient('/base').getJson('/x', { a: 1, b: undefined, c: '', d: 'y z' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/base/x?a=1&d=y+z');
  });

  it('maps HTTP statuses to friendly HttpErrors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 429)));
    const error = await createHttpClient()
      .getJson('/x')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 429, message: expect.stringMatching(/Rate limit/) });
  });

  it('wraps network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(createHttpClient().getJson('/x')).rejects.toBeInstanceOf(NetworkError);
  });

  it('turns a non-JSON body into an HttpError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
    await expect(createHttpClient().getJson('/x')).rejects.toBeInstanceOf(HttpError);
  });

  const hangingFetch = () =>
    vi.fn((_url: string, init: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    });

  it('times out slow requests', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    await expect(createHttpClient('', 20).getJson('/x')).rejects.toBeInstanceOf(
      RequestTimeoutError,
    );
  });

  it('rethrows the caller abort untouched so it reads as a cancellation', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const controller = new AbortController();
    const request = createHttpClient('', 5_000).getJson('/x', {}, { signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });
});
