// Hand-written tool: load pages of the LIVE site in a headless browser and report console errors.
//   node _port/tools/live_check.mjs [url ...]
import { chromium } from './shot.mjs';
const urls = process.argv.slice(2);
const browser = await chromium.launch();
let bad = 0;
for (const u of urls) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => errors.push('request failed: ' + r.url()));
  const resp = await page.goto(u, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({ title: document.title, h1: document.querySelector('h1, .dg-title')?.textContent.trim().slice(0, 80),
    math: document.querySelectorAll('mjx-container').length, navbar: [...document.querySelectorAll('.navbar .nav-link')].map(a => a.textContent.trim()).join(' | ') }));
  console.log(resp.status(), u, JSON.stringify(info), errors.length ? 'ERRORS: ' + errors.join(' ; ') : 'no errors');
  if (resp.status() !== 200 || errors.length) bad++;
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
