import { expect, test as base, type Page } from '@playwright/test';

export const MOCK = process.env.E2E_MOCK_URL ?? 'http://localhost:4010';
export const EDGE = process.env.E2E_EDGE_URL ?? 'http://localhost:3301';

export type Source = 'newsapi' | 'guardian' | 'nyt' | '*';
export type Mode = 'ok' | 'error' | 'slow' | 'ratelimit' | 'strict-rate' | 'malformed';

export interface UpstreamHit {
  source: string;
  path: string;
  query: Record<string, string>;
  status: number;
  ms: number;
  keyInjected: boolean;
}

const post = (path: string, body: unknown = {}) =>
  fetch(MOCK + path, { method: 'POST', body: JSON.stringify(body) });

export const mock = {
  reset: () => post('/__reset'),
  setMode: (source: Source, mode: Mode, delayMs?: number) =>
    post('/__control', { source, mode, delayMs }),
  setArticles: (source: Exclude<Source, '*'>, articles: unknown[]) =>
    post('/__articles', { source, articles }),
  log: async (): Promise<UpstreamHit[]> => (await fetch(MOCK + '/__log')).json(),
};

/** Every test starts from a pristine mock (all sources healthy, default datasets, empty log). */
export const test = base.extend<{ upstream: typeof mock }>({
  upstream: async ({}, use) => {
    await mock.reset();
    await use(mock);
  },
});
export { expect };

export const cards = (page: Page) => page.locator('article');

export const cardTimes = (page: Page) =>
  page.$$eval('article time', (els) => els.map((e) => e.getAttribute('datetime') ?? ''));

export const cardTitles = (page: Page) =>
  page.$$eval('article h3', (els) => els.map((e) => e.textContent?.trim() ?? ''));

/** Scrolls to the bottom until the end marker appears (or the list stops growing). */
export async function scrollToEnd(page: Page, maxSteps = 200) {
  const end = page.getByText("You're all caught up");
  let last = -1;
  let stalls = 0;
  for (let i = 0; i < maxSteps; i++) {
    if (await end.count()) return;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(150);
    const n = await cards(page).count();
    if (n === last) {
      if (++stalls > 30) return;
    } else {
      stalls = 0;
      last = n;
    }
  }
}

export const inversions = (isoTimes: string[]) =>
  isoTimes.filter((t, i) => i > 0 && Date.parse(t) > Date.parse(isoTimes[i - 1] ?? t)).length;
