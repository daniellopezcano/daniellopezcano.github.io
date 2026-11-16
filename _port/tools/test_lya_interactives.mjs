// Hand-written tool: behaviour tests of the Lyα course's interactive panels in a headless browser (Lyα DECISIONS
// L20), on the rendered course in docs/notes/lya-forest/. The first course's panels are tested by
// test_interactives.mjs; this runner has the same generic checks (D55) and one test file per panel.
//   node _port/tools/test_lya_interactives.mjs [--module <name>] [--verbose]
// For every entry of _port/lya/interactives.json (module, label):
//   generic: the frame is on exactly one page, mounts (.dg-ready) with no console error, has one body and one
//   footer (Reset; the static-figure link when the panel follows a figure, whose text is the figure's number; the
//   Notebook link exactly when the entry has one); Reset restores the starting state (the module's root carries
//   its state as data-state, compared before and after a change made by the panel test and a Reset) and keeps
//   the focus on the button; at 390 px the page does not scroll sideways.
//   specific: _port/lya/tests/<module>.test.mjs exports `async function run({ page, frame, state, assert, log })`
//   (state(): the parsed data-state of the panel body) and optionally `change(page, frame)`, an action that changes
//   the state (used by the Reset check; default: move the first slider to its maximum).
// Exit code 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, serveDocs } from './shot.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const COURSE = 'notes/lya-forest';
const args = process.argv.slice(2);
const only = args.includes('--module') ? args[args.indexOf('--module') + 1] : null;
const verbose = args.includes('--verbose');
const entries = JSON.parse(fs.readFileSync(path.join(REPO, '_port', 'lya', 'interactives.json'), 'utf8')).interactives
  .filter(e => !only || e.module === only);

// the page that holds each panel: the generated pages in docs/ that carry data-module="<module>"
function pagesWith(module) {
  const out = [], root = path.join(REPO, 'docs', COURSE);
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else if (e.name.endsWith('.html') && fs.readFileSync(f, 'utf8').includes(`data-module="${module}"`)) out.push(path.relative(path.join(REPO, 'docs'), f)); } };
  walk(root);
  return out;
}

const failures = [];
const { server, base } = await serveDocs();
const browser = await chromium.launch();
for (const e of entries) {
  const name = e.module, fail = m => failures.push(`${name}: ${m}`), log = m => verbose && console.log(`  ${name}: ${m}`);
  const assert = (ok, m) => { if (!ok) fail(m); else log(`ok ${m}`); };
  const pages = pagesWith(name);
  if (pages.length !== 1) { fail(`on ${pages.length} pages (expected 1): ${pages.join(', ')}`); continue; }
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', x => errors.push(String(x)));
    await page.goto(`${base}/${pages[0]}`);
    const frame = page.locator(`.dg-interactive[data-module="${name}"]`);
    await frame.scrollIntoViewIfNeeded();
    const ready = await page.waitForFunction(m => document.querySelector(`.dg-interactive[data-module="${m}"]`)?.classList.contains('dg-ready'), name, { timeout: 20000 }).then(() => true, () => false);
    assert(ready, `${width}px: mounts (.dg-ready)`);
    if (!ready) { await page.close(); continue; }
    await page.waitForTimeout(600);
    const state = async () => JSON.parse(await frame.locator('.dg-interactive-body [data-state], .dg-interactive-body').first().evaluate(n => (n.dataset.state ? n : n.querySelector('[data-state]'))?.dataset.state || 'null'));
    if (width === 1440) {
      assert(await frame.locator('.dg-interactive-body').count() === 1, 'one body');
      const foot = frame.locator('.dg-interactive-foot');
      assert(await foot.count() === 1, 'one footer');
      const nb = await frame.locator('a', { hasText: 'Notebook' }).count();
      assert(nb === (e.notebook ? 1 : 0), `Notebook link ${e.notebook ? 'present' : 'absent'}`);
      const after = await frame.evaluate(f => f.previousElementSibling?.tagName === 'FIGURE' ? f.previousElementSibling.querySelector('.dg-fignum')?.textContent.replace(/:$/, '') : null);
      if (after) assert(await frame.locator('a', { hasText: after }).count() === 1, `static-figure link "${after}"`);
      const s0 = JSON.stringify(await state());
      let mod = null;
      const testFile = path.join(REPO, '_port', 'lya', 'tests', `${name}.test.mjs`);
      if (fs.existsSync(testFile)) mod = await import(testFile);
      else fail(`no test file _port/lya/tests/${name}.test.mjs`);
      if (mod) {
        try { await mod.run({ page, frame, state, assert, log }); } catch (x) { fail(`test threw: ${x.stack || x}`); }
      }
      // Reset: change something, press Reset, compare with the starting state; focus stays on the button
      if (mod && mod.change) await mod.change(page, frame);
      else { const r = frame.locator('input[type=range]').first(); if (await r.count()) await r.evaluate(n => { n.value = n.max; n.dispatchEvent(new Event('input', { bubbles: true })); }); }
      await page.waitForTimeout(300);
      const changed = JSON.stringify(await state());
      assert(changed !== s0, 'the change used for the Reset check changes the state');
      const reset = frame.locator('button', { hasText: 'Reset' });
      await reset.click();
      await page.waitForTimeout(900);
      assert(JSON.stringify(await state()) === s0, 'Reset restores the starting state');
      assert(await page.evaluate(() => document.activeElement?.textContent?.includes('Reset')), 'focus stays on Reset');
    } else {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert(!wide, '390px: no sideways scroll');
    }
    assert(errors.length === 0, `${width}px: no console error ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
    await page.close();
  }
  console.log(`${name}: done`);
}
await browser.close();
server.close();
if (failures.length) { console.log(`FAILED (${failures.length}):`); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
console.log(`LYA INTERACTIVES PASSED (${entries.length} panels)`);
