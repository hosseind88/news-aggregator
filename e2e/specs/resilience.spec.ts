import { cards, expect, scrollToEnd, test } from '../support';

test.describe('failing and slow sources', () => {
  test('one failing source shows a notice while the others still fill the feed', async ({
    page,
    upstream,
  }) => {
    await upstream.setMode('guardian', 'error');
    await page.goto('/');

    await expect(cards(page).first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'could not be loaded' })).toContainText(
      'The Guardian',
    );
    // The healthy sources run dry; the feed must not claim completeness while Guardian is down.
    await scrollToEnd(page);
    await expect(page.getByText('Could not load more articles.')).toBeVisible();
    await expect(page.getByText("You're all caught up")).toHaveCount(0);

    await upstream.reset();
    await page.getByRole('button', { name: 'Retry' }).click();
    await scrollToEnd(page);
    await expect(page.getByText("You're all caught up")).toBeVisible();
  });

  test('every source failing from the start shows an error with retry, never "all caught up"', async ({
    page,
    upstream,
  }) => {
    await upstream.setMode('*', 'error');
    await page.goto('/');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText("You're all caught up")).toHaveCount(0);

    await upstream.reset();
    await page.getByRole('button', { name: /try again/i }).click();
    await expect(cards(page).first()).toBeVisible();
  });

  test('every source failing mid-scroll keeps the feed and offers a footer retry', async ({
    page,
    upstream,
  }) => {
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible();
    const before = await cards(page).count();

    await upstream.setMode('*', 'error');
    // Scroll until a fetch is needed and fails.
    await expect(async () => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.getByText('Could not load more articles.')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 30_000 });

    expect(await cards(page).count()).toBeGreaterThanOrEqual(before);
    await expect(page.getByText("You're all caught up")).toHaveCount(0);

    await upstream.reset();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('Could not load more articles.')).toHaveCount(0);
  });

  test('a malformed upstream response shows a friendly message, not a raw validation error', async ({
    page,
    upstream,
  }) => {
    await upstream.setMode('*', 'malformed');
    await page.goto('/');

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(/zod|invalid_type|\bexpected\b/i);
    await expect(alert).toContainText(/unexpected format/i);
  });

  test('a rate-limited source is reported by name', async ({ page, upstream }) => {
    await upstream.setMode('nyt', 'ratelimit');
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'could not be loaded' })).toContainText(
      'The New York Times',
    );
  });

  test('a slow source does not block the others beyond the client timeout', async ({
    page,
    upstream,
  }) => {
    await upstream.setMode('nyt', 'slow', 25_000);
    const started = Date.now();
    await page.goto('/');
    await expect(cards(page).first()).toBeVisible({ timeout: 30_000 });
    // The request timeout is 10s; the feed must not wait for the 25s response.
    expect(Date.now() - started).toBeLessThan(20_000);
    await expect(page.getByRole('status').filter({ hasText: 'could not be loaded' })).toContainText(
      'The New York Times',
    );
  });

  test('changing filters quickly cancels the superseded requests', async ({ page, upstream }) => {
    await upstream.setMode('*', 'slow', 1500);
    const aborted: string[] = [];
    page.on('requestfailed', (request) => {
      if (request.url().includes('/api/') && request.failure()?.errorText.includes('ABORTED')) {
        aborted.push(request.url());
      }
    });
    await page.goto('/search');
    await page.getByLabel('Keyword').fill('markets');
    await page.waitForTimeout(700); // past the debounce: request in flight
    await page.getByLabel('Keyword').fill('election');
    await upstream.setMode('*', 'ok');

    await expect(cards(page).first()).toBeVisible({ timeout: 15_000 });
    await expect(cards(page).first()).toContainText(/election/i);
    expect(aborted.length).toBeGreaterThan(0);
  });
});
