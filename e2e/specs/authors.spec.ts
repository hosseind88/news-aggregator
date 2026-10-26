import type { Page } from '@playwright/test';
import { cards, expect, mock, test } from '../support';

const prefs = (authors: string[]) =>
  JSON.stringify({ state: { sources: [], categories: [], authors }, version: 1 });

/** Upper bound for one filtered search: the first page plus the two fruitless extras. */
const MAX_REQUESTS = 12;

const EMPTY = 'No recent articles from your followed authors';

const follow = (page: Page, authors: string[]) =>
  page.addInitScript(
    (value) => localStorage.setItem('news-aggregator:preferences', value),
    prefs(authors),
  );

/** Loads the unfiltered feed, clears the log, then turns the filter on: only the toggle is counted. */
async function enableFilter(page: Page) {
  await page.goto('/');
  await expect(cards(page).first()).toBeVisible();
  await mock.reset();
  await page.getByLabel('Only followed authors').check();
}

/** Waits `ms` and returns how many upstream requests happened in that window. */
async function requestsDuring(ms: number) {
  const before = (await mock.log()).length;
  await new Promise((resolve) => setTimeout(resolve, ms));
  return (await mock.log()).length - before;
}

const searchOlder = (page: Page) => page.getByRole('button', { name: 'Search older articles' });

test.describe('only followed authors', () => {
  test('a non-matching author costs a bounded number of requests, then stops', async ({ page }) => {
    await follow(page, ['Nobody Known']);
    await enableFilter(page);

    await expect(page.getByText(EMPTY)).toBeVisible();
    expect(await requestsDuring(3000), 'idle once the scan gave up').toBe(0);
    const total = (await mock.log()).length;
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(MAX_REQUESTS);
  });

  test('the empty state, loader and skeletons are never visible together', async ({ page }) => {
    await follow(page, ['Nobody Known']);
    await enableFilter(page);

    for (let i = 0; i < 30; i += 1) {
      const empty = (await page.getByText(/^No (recent )?articles/).count()) > 0;
      const loading =
        (await page.getByRole('progressbar').count()) > 0 ||
        (await page.locator('main [class*="animate-pulse"]').count()) > 0;
      expect(empty && loading, `sample ${i}`).toBe(false);
      await page.waitForTimeout(100);
    }
    await expect(page.getByText(EMPTY)).toBeVisible();
    await expect(searchOlder(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show all articles' })).toBeVisible();
  });

  test('"Search older articles" loads one more batch, only when clicked', async ({ page }) => {
    await follow(page, ['Nobody Known']);
    await enableFilter(page);
    await expect(searchOlder(page)).toBeVisible();
    await requestsDuring(1000);
    const before = (await mock.log()).length;

    await searchOlder(page).click();
    await expect.poll(async () => (await mock.log()).length).toBeGreaterThan(before);
    await expect(searchOlder(page)).toBeVisible();

    expect(await requestsDuring(2500), 'the batch is one-off, not a loop').toBe(0);
    expect((await mock.log()).length - before).toBeLessThanOrEqual(MAX_REQUESTS);
  });

  test('"Show all articles" turns the filter off', async ({ page }) => {
    await follow(page, ['Nobody Known']);
    await enableFilter(page);

    await page.getByRole('button', { name: 'Show all articles' }).click();
    await expect(page.getByLabel('Only followed authors')).not.toBeChecked();
    await expect(cards(page).first()).toBeVisible();
  });

  test('a followed author is found server-side, even deep in the archive', async ({ page }) => {
    await follow(page, ['Jane Doe']);
    const day = 24 * 60 * 60_000;
    const archive = () =>
      Array.from({ length: 80 }, (_, i) => ({
        title: `Archive ${String(i).padStart(2, '0')}: markets`,
        publishedAt: new Date(Date.now() - (i + 1) * day).toISOString(),
        // Newest 60 are by someone else; a plain client-side scan would burn pages to reach these.
        ...(i >= 60 && i % 5 === 0 ? { author: 'Jane Doe' } : {}),
      }));
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible();
    await mock.reset();
    await mock.setArticles('guardian', archive());
    await page.getByLabel('Only followed authors').check();

    await expect(page.getByRole('heading', { name: /Archive 60/ })).toBeVisible();
    await expect(page.getByText(EMPTY)).toHaveCount(0);

    const guardian = (await mock.log()).filter((e) => e.source === 'guardian');
    expect(guardian[0]?.query['query-fields']).toContain('byline');
    expect(guardian[0]?.query.q).toContain('"Jane Doe"');
    expect(guardian.length, 'one pushed-down request, not a page-by-page scan').toBeLessThanOrEqual(
      2,
    );
  });

  test('keeping the sentinel in view does not loop or repeat requests', async ({ page }) => {
    await follow(page, ['Nobody Known']);
    await enableFilter(page);
    await expect(page.getByText(EMPTY)).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await requestsDuring(3000)).toBe(0);

    const keys = (await mock.log()).map((e) => `${e.source}|${JSON.stringify(e.query)}`);
    expect(new Set(keys).size, 'every upstream request is distinct').toBe(keys.length);
  });
});
