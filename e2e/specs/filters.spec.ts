import { cards, expect, test } from '../support';

test.describe('date filter uses local days', () => {
  test.use({ timezoneId: 'Pacific/Auckland' });

  test('"Today" sends the local day boundaries and only returns articles from that local day', async ({
    page,
    upstream,
  }) => {
    await page.goto('/search');
    await expect(cards(page).first()).toBeVisible();
    await page.getByRole('button', { name: /date range/i }).click();
    await page.getByRole('button', { name: 'Today', exact: true }).click();

    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}/);
    const [from] = new URL(page.url()).searchParams.getAll('from');
    await expect(async () => {
      const guardian = (await upstream.log()).filter(
        (e) => e.source === 'guardian' && e.query['from-date'],
      );
      expect(guardian.length).toBeGreaterThan(0);
      // Local midnight in Auckland is not a UTC midnight: the request carries the exact instant.
      const sent = guardian.at(-1)?.query['from-date'] ?? '';
      expect(sent).not.toBe(`${from}T00:00:00.000Z`);
      expect(new Date(sent).getTime()).toBe(new Date(`${from}T00:00:00+13:00`).getTime());
    }).toPass();

    const published = await page.$$eval('article time', (els) =>
      els.map((e) => e.getAttribute('datetime') ?? ''),
    );
    const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA'));
    for (const iso of published) {
      expect(
        new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' }),
        'every result is from the selected local day',
      ).toBe(today);
    }
  });
});

test.describe('untrusted input', () => {
  test('invalid dates in the URL are dropped, not sent upstream', async ({ page, upstream }) => {
    await page.goto('/search?from=2024-13-45&to=not-a-date');
    await expect(cards(page).first()).toBeVisible();

    const log = await upstream.log();
    expect(log.length).toBeGreaterThan(0);
    for (const e of log) {
      expect(JSON.stringify(e.query)).not.toMatch(/2024-13|not-a-date|20241345/);
    }
  });

  test('corrupt persisted preferences fall back to defaults instead of crashing', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'news-aggregator:preferences',
        JSON.stringify({
          state: { sources: ['bogus', 42], categories: 'nope', authors: [{}, 7] },
          version: 1,
        }),
      );
    });
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Latest news' })).toBeVisible();
  });

  test('unparseable preferences JSON does not break the app', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('news-aggregator:preferences', '{oops'));
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible();
  });
});

test.describe('app shell', () => {
  test('routes are code-split and titled', async ({ page }) => {
    const scripts = new Set<string>();
    page.on('response', (r) => {
      if (r.url().endsWith('.js')) scripts.add(new URL(r.url()).pathname);
    });
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible();
    const afterFeed = scripts.size;
    await expect(page).toHaveTitle(/Latest news · Newsroom/);

    await page.getByRole('link', { name: 'Search', exact: true }).first().click();
    await expect(page.getByLabel('Keyword')).toBeVisible();
    expect(scripts.size, 'Search chunk loaded on demand').toBeGreaterThan(afterFeed);
    await expect(page).toHaveTitle(/Search · Newsroom/);
  });

  test('unknown routes show a titled not-found page', async ({ page }) => {
    await page.goto('/does/not/exist');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveTitle(/Newsroom/);
  });

  test('the CSP is not violated by the running app', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      if (/content security policy/i.test(m.text())) violations.push(m.text());
    });
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible();
    await page.goto('/search');
    await page.getByRole('button', { name: /date range/i }).click();
    await page.goto('/preferences');
    expect(violations).toEqual([]);
  });
});
