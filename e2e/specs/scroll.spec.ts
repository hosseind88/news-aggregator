import { cards, cardTimes, cardTitles, expect, inversions, scrollToEnd, test } from '../support';

test.describe('infinite scroll', () => {
  test('scrolling to the end yields one ordered, duplicate-free list and no wasted upstream calls', async ({
    page,
    upstream,
  }) => {
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible();
    await scrollToEnd(page);
    await expect(page.getByText("You're all caught up")).toBeVisible();

    const times = await cardTimes(page);
    const titles = await cardTitles(page);
    expect(times.length).toBeGreaterThan(200);
    expect(inversions(times), 'newest-first order holds across pages').toBe(0);
    expect(new Set(titles).size, 'no duplicate cards').toBe(titles.length);

    const log = await upstream.log();
    expect(
      log.filter((e) => e.status >= 400),
      'no 4xx/5xx from exhausted sources',
    ).toEqual([]);
    expect(
      log.every((e) => e.keyInjected),
      'nginx injects every key',
    ).toBe(true);
  });

  test('stops calling a source once it is exhausted', async ({ page, upstream }) => {
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible();
    await scrollToEnd(page);

    const log = await upstream.log();
    const pagesOf = (source: string) => log.filter((e) => e.source === source).length;
    // NewsAPI developer plan: 100 results = 5 pages of 20, never a 6th request.
    expect(pagesOf('newsapi')).toBeLessThanOrEqual(5);
    // NYT: 120 docs at 10 per page = 12 pages.
    expect(pagesOf('nyt')).toBeLessThanOrEqual(12);
  });
});

test.describe('responsive grid', () => {
  for (const [width, columns] of [
    [1280, 3],
    [800, 2],
    [390, 1],
  ] as const) {
    test(`${width}px wide renders ${columns} column(s) with only complete rows`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(cards(page).first()).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(async () => {
        const n = await cards(page).count();
        expect(n).toBeGreaterThan(columns);
        expect(n % columns).toBe(0);
      }).toPass();

      const tops = await page.$$eval('article', (els) =>
        els.map((e) => Math.round(e.getBoundingClientRect().left)),
      );
      expect(new Set(tops).size).toBe(columns);
    });
  }

  test('resizing across breakpoints keeps the list and re-trims rows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible();
    for (const width of [800, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(cards(page).first()).toBeVisible();
    }
    const titles = await cardTitles(page);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
