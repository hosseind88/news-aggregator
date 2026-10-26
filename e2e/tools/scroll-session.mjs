// Drives a full scroll session and prints facts: cards, order inversions, upstream request counts.
import { chromium } from '@playwright/test';
const [base, tag, ctl = 'http://localhost:4010', outDir = 'docs/evidence'] = process.argv.slice(2);
const mode = process.env.MODE; // optional: e.g. "nyt=strict-rate"
const post = (p, body) => fetch(ctl + p, { method: 'POST', body: JSON.stringify(body ?? {}) });
await post('/__reset');
if (mode)
  for (const m of mode.split(',')) {
    const [s, v] = m.split('=');
    await post('/__control', { source: s, mode: v });
  }

const browser = await chromium.launch();
for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  await post('/__reset');
  if (mode)
    for (const m of mode.split(',')) {
      const [s, v] = m.split('=');
      await post('/__control', { source: s, mode: v });
    }
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const browserReqs = [];
  page.on('response', (r) => {
    if (r.url().includes('/api/')) browserReqs.push(r.status());
  });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('article').first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${outDir}/${tag}-${name}-top.png` });
  let last = -1,
    stalls = 0,
    steps = 0;
  while (steps++ < 150) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(250);
    const n = await page.locator('article').count();
    if (await page.getByText("You're all caught up").count()) break;
    if (n === last) {
      if (++stalls > 24) break;
    } else {
      stalls = 0;
      last = n;
    }
  }
  await page.waitForTimeout(500);
  const items = await page.$$eval('article time', (els) =>
    els.map((e) => e.getAttribute('datetime')),
  );
  const titles = await page.$$eval('article h3', (els) => els.map((e) => e.textContent.trim()));
  let inversions = 0;
  for (let i = 1; i < items.length; i++)
    if (Date.parse(items[i]) > Date.parse(items[i - 1])) inversions++;
  const endText = (await page.getByText("You're all caught up").count())
    ? 'caught-up'
    : 'no-end-marker';
  const alerts = await page.locator('[role=alert]').allInnerTexts();
  await page.screenshot({ path: `${outDir}/${tag}-${name}-bottom.png` });
  const log = await (await fetch(ctl + '/__log')).json();
  const by = {};
  for (const e of log) {
    const k = `${e.source}:${e.status}`;
    by[k] = (by[k] ?? 0) + 1;
  }
  console.log(
    JSON.stringify(
      {
        tag,
        name,
        cards: items.length,
        unique: new Set(titles).size,
        orderInversions: inversions,
        end: endText,
        alerts,
        upstreamRequests: log.length,
        upstreamByStatus: by,
        browserApiRequests: browserReqs.length,
        scrollSteps: steps,
      },
      null,
      1,
    ),
  );
  await ctx.close();
}
await browser.close();
