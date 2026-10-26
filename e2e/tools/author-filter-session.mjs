// Enables "Only followed authors" with an author that appears nowhere, waits for the app to
// settle and prints what a reviewer would see: upstream request count, which UI states are
// visible at once, and a screenshot. Usage: node author-filter-session.mjs <base> <tag> [ctl] [out]
import { chromium } from '@playwright/test';
const [base, tag, ctl = 'http://localhost:4010', outDir = 'docs/evidence'] = process.argv.slice(2);
const post = (p, body) => fetch(ctl + p, { method: 'POST', body: JSON.stringify(body ?? {}) });

await post('/__reset');
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await page.addInitScript(() =>
  localStorage.setItem(
    'news-aggregator:preferences',
    JSON.stringify({
      state: { sources: [], categories: [], authors: ['Nobody Known'] },
      version: 1,
    }),
  ),
);
await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
await page.locator('article').first().waitFor({ timeout: 20000 });
await post('/__reset'); // count only what the filter toggle causes
await page.getByLabel('Only followed authors').check();

const samples = [];
for (let i = 0; i < 12; i += 1) {
  await page.waitForTimeout(1000);
  samples.push((await (await fetch(ctl + '/__log')).json()).length);
}
const log = await (await fetch(ctl + '/__log')).json();
const bySource = {};
for (const e of log) bySource[e.source] = (bySource[e.source] ?? 0) + 1;
const text = await page.locator('main').innerText();
const states = {
  emptyState: /No articles from followed authors|No recent articles/.test(text),
  skeletonRow: (await page.locator('[class*="animate-pulse"]').count()) > 0,
  loadingBarActive: (await page.getByRole('progressbar').count()) > 0,
  searchOlderButton:
    (await page.getByRole('button', { name: 'Search older articles' }).count()) > 0,
  showAllButton: (await page.getByRole('button', { name: 'Show all articles' }).count()) > 0,
};
await page.screenshot({ path: `${outDir}/${tag}-author-filter.png` });
console.log(
  JSON.stringify(
    {
      tag,
      upstreamRequests: log.length,
      bySource,
      requestsAtEachSecond: samples,
      visibleStates: states,
    },
    null,
    1,
  ),
);
await browser.close();
