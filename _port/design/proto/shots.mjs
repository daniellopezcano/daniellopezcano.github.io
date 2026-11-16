// Hand-written (design study): screenshots of the design-direction prototypes at desktop and phone widths.
//   node _port/design/proto/shots.mjs [dirs=abc] [filter]     -> _port/design/shots/<dir>-<page>-<width>[-n].jpg
// Starts _port/design/preview.py itself. Prints console errors and horizontal overflow per page.
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../tools/shot.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const dirs = (process.argv[2] || 'abc').split(''), filter = process.argv[3] || '';
const PORT = 4390 + Math.floor(Math.random() * 500);
const srv = spawn('python3', [path.join(HERE, '..', 'preview.py'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
// page, name, [scroll positions as selectors or pixel offsets for extra desktop shots], action
const PAGES = [
  ['index', 'landing', [1500]],
  ['vector-spaces/index', 'chapter', []],
  ['vector-spaces/foundations-sets-maps', 'sec21', ['#fig_maps_examples', '.sidenote .dg-open-here, main p .dg-open-here']],
  ['tangent-spaces/tangent-space', 'sec41', ['figure.dg-figure']],
  ['proofs-and-additional-material/proof-euler-lagrange', 'proofB', [900]],
  ['examples/example-variations', 'exC6', ['.dg-interactive']],
];
const browser = await chromium.launch();
for (const d of dirs) for (const [slug, name, extra] of PAGES) {
  if (filter && !name.includes(filter)) continue;
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 600 ? 1.5 : 1 });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
    page.on('pageerror', e => errors.push(e.message.slice(0, 140)));
    await page.goto(`http://127.0.0.1:${PORT}/design/${d}/${slug}.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('dg-math-ready'), null, { timeout: 30000 }).catch(() => errors.push('math never ready'));
    await page.waitForTimeout(700);
    const shot = async suffix => page.screenshot({ path: path.join(OUT, `${d}-${name}-${w}${suffix}.jpg`), type: 'jpeg', quality: 60 });
    await shot('');
    let i = 1;
    for (const target of (w > 600 ? extra : extra.slice(0, 1))) {
      if (typeof target === 'number') await page.evaluate(y => scrollTo(0, y), target);
      else {
        // an interactive frame is collapsed until its module has mounted, so it is not "visible" yet
        const el = target === '.dg-interactive' ? page.locator(target).first() : page.locator(target).locator('visible=true').first();
        if (!(await el.count())) continue;
        await el.evaluate(e => { const r = e.getBoundingClientRect(); scrollTo(0, scrollY + r.top - 160); });
        if (target.includes('.dg-open-here')) { await el.click(); await page.waitForTimeout(1500); await page.locator('.dg-inline').first().evaluate(e => { const r = e.getBoundingClientRect(); scrollTo(0, scrollY + r.top - 320); }).catch(() => {}); }
        if (target === '.dg-interactive') await page.waitForTimeout(2500);
      }
      await page.waitForTimeout(500);
      await shot('-' + i++);
    }
    if (d === 'a' && name === 'sec21' && w > 600) {   // the reader-selectable dark theme of direction A
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; scrollTo(0, 0); });
      await page.waitForTimeout(400); await shot('-dark');
    }
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(`${d} ${name} ${w}: ${errors.length ? 'ERRORS ' + errors.join(' | ') : 'ok'}${over > 1 ? '  H-OVERFLOW ' + over + 'px' : ''}`);
    await page.close();
  }
}
await browser.close(); srv.kill();
