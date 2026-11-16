// Hand-written tool (DECISIONS D37, DESIGN § 4 "Accessibility"): axe-core on the course pages and a keyboard pass,
// on the rendered site in docs/ (throw-away static server; MathJax and Lato from their CDNs).
//   node _port/tools/a11y_check.mjs [--page <slug>]... [--jobs N] [--no-keyboard | --keyboard] [--verbose]   (exit code 0 = passed)
// 1. axe-core (_port/node_modules/axe-core, default rule set) after the math is typeset:
//    every page (or the --page ones) at 1280×900 in the light and in the dark theme (localStorage 'dg-theme'),
//    and the pages of NARROW (landing, chapter opening pages, the heaviest section pages, appendix items)
//    and every page with an interactive panel at 390×844 in the light theme. A violation of impact "serious" or
//    "critical" fails; one line per page and rule, with the number of nodes and the first selector.
//    No exclusion is needed today; MathJax output is checked like everything else.
//    Panels (D56): a panel stays hidden until its module mounts (D15), so before axe runs every
//    .dg-interactive[data-module] is scrolled into view and must become .dg-ready within 20 s (else a failure);
//    axe then checks the mounted panels with the rest of the page, in every run of that page.
// 2. Keyboard (skipped with --page unless --keyboard is given, or with --no-keyboard) on KEYS: from the top of the page, Tab reaches the skip
//    link first, then the site navbar, the course-bar buttons, the course-tree links and the links of the
//    text, in that order; every element that receives focus shows a visible focus indicator (outline or
//    box-shadow, not transparent, element on screen); the search and the map dialogs open from the
//    keyboard, Esc closes them and focus returns to the button.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, serveDocs } from './shot.mjs';
import { REPO, COURSE, coursePages, selectPages, pool, ready, url, hasFlag } from './course_pages.mjs';

const args = process.argv.slice(2);
const jobs = +(args[args.indexOf('--jobs') + 1] || 0) || 6;
const verbose = hasFlag(args, '--verbose');
const filtered = args.includes('--page') && !args.includes('--keyboard');
const pages = selectPages(args);
const all = new Set(coursePages());
const NARROW = ['index', 'vector-spaces/index', 'metric/index', 'appendix-examples/index', 'examples/example-fields',
  'examples/example-connection-torsion-curvature', 'examples/example-variations', 'tangent-spaces/tangent-space',
  'proofs-and-additional-material/metric-properties', 'fields/vector-fields', 'gr/spacetime',
  'proofs-and-additional-material/proof-sylvester', 'vector-spaces/foundations-sets-maps', 'computational-ressources/index']
  .filter(s => all.has(s) && pages.includes(s));
// every page with an interactive panel is also checked at 390 px (D56); read from the rendered HTML
const PANELS = pages.filter(s => fs.readFileSync(path.join(REPO, 'docs', COURSE, s + '.html'), 'utf8').includes('data-module='));
for (const s of PANELS) if (!NARROW.includes(s)) NARROW.push(s);
const KEYS = ['metric/length-geodesics', 'index', 'fields/index'];
const AXE = path.join(REPO, '_port', 'node_modules', 'axe-core', 'axe.min.js');
const BAD = new Set(['serious', 'critical']);

const { server, base: base0 } = await serveDocs();
const base = base0.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();
const t0 = Date.now();
const failures = [];

async function withPage(width, theme, fn, extra = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, ...extra });
  if (theme === 'dark') await context.addInitScript(() => { try { localStorage.setItem('dg-theme', 'dark'); } catch (e) {} });
  const page = await context.newPage();
  try { return await fn(page); } finally { await context.close(); }
}

async function axe(slug, width, theme) {
  return withPage(width, theme, async page => {
    await page.goto(url(base, slug), { waitUntil: 'networkidle', timeout: 60000 });
    await ready(page);
    const tag = `${slug} @${width} ${theme}`;
    // mount every panel (D56): bring it into view and wait for .dg-ready (its labels are typeset by then)
    const frames = await page.$$('.dg-interactive[data-module]');
    for (const f of frames) {
      await f.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const ok = await page.waitForFunction(e => e.classList.contains('dg-ready'), f, { timeout: 20000 }).then(() => true, () => false);
      if (!ok) failures.push(`${tag}: interactive "${await f.getAttribute('data-module')}" never ready (20 s)`);
    }
    if (frames.length) { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(300); }
    await page.addScriptTag({ path: AXE });
    const res = await page.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ['violations'] });
      return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length,
        first: v.nodes[0] ? v.nodes[0].target.join(' ') : '', why: v.nodes[0] ? (v.nodes[0].failureSummary || '').split('\n').slice(1, 2).join(' ').trim() : '' }));
    });
    for (const v of res) {
      const line = `${tag}: [${v.impact}] ${v.id} (${v.n} node${v.n > 1 ? 's' : ''}) ${v.first.slice(0, 90)} — ${v.why.slice(0, 140)}`;
      if (BAD.has(v.impact)) failures.push(line); else if (verbose) console.log('  (minor) ' + line);
    }
    return res.filter(v => BAD.has(v.impact)).length;
  });
}

// ---- keyboard ----------------------------------------------------------------------------------
async function keyboard(slug) {
  const fail = m => failures.push(`${slug} keyboard: ${m}`);
  // reduced motion: the page scrolls a focused element into view at once instead of smoothly (course.css),
  // so its position can be read right after each Tab
  return withPage(1440, 'light', async page => {
    await page.goto(url(base, slug), { waitUntil: 'networkidle', timeout: 60000 });
    await ready(page);
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
    const seq = [];
    for (let i = 0; i < 400; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return null;
        const s = getComputedStyle(e), b = e.getBoundingClientRect();
        const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1 && !/rgba\(.*,\s*0\)$|transparent/.test(s.outlineColor);
        const shadow = s.boxShadow !== 'none';
        // an SVG link (roadmap badge) shows focus on its hit area (course.css .dg-svg-link:focus-visible .dg-svg-hit)
        const hit = e.matches('.dg-svg-link') && e.querySelector('.dg-svg-hit') && getComputedStyle(e.querySelector('.dg-svg-hit')).stroke !== 'none';
        const group = e.matches('.dg-skiplink') ? 'skip' : e.closest('#dg-sitenav') ? 'sitenav' : e.closest('#dg-bar') ? 'bar'
          : e.closest('#dg-tree') ? 'tree' : e.closest('#dg-main') ? 'main' : 'other';
        return { group, desc: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '') + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30) + '"',
          visible: (outline || shadow || hit) && b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth };
      });
      if (!f) continue;
      seq.push(f);
      if (f.group === 'main' && seq.filter(x => x.group === 'main').length >= 25) break;
    }
    if (!seq.length) { fail('Tab focuses nothing'); return; }
    if (seq[0].group !== 'skip') fail(`first Tab stop is ${seq[0].desc}, not the skip link`);
    const first = g => seq.findIndex(x => x.group === g);
    const want = ['skip', 'sitenav', 'bar', ...(slug === 'metric/length-geodesics' ? ['tree'] : []), 'main'];
    let prev = -1;
    for (const g of want) {
      const k = first(g);
      if (k < 0) { fail(`Tab never reaches the ${g} group`); continue; }
      if (k < prev) fail(`the ${g} group comes before the previous group in Tab order`);
      prev = k;
    }
    const order = seq.map(x => x.group).filter((g, i, a) => g !== a[i - 1]);
    if (verbose) console.log(`  ${slug}: ${seq.length} Tab stops, groups in order: ${order.join(' > ')}`);
    const invisible = seq.filter(x => !x.visible);
    if (invisible.length) fail(`${invisible.length} focused element(s) without a visible focus indicator: ${[...new Set(invisible.map(x => x.desc))].slice(0, 4).join('; ')}`);
    // dialogs: open from the keyboard, Esc closes them, focus returns to the button
    // (on the landing page "Map" scrolls to the roadmap on the page instead: D39)
    for (const [sel, dlg] of [['#dg-bar [data-act="search"]', 'dialog.dg-search'], ['#dg-bar [data-act="map"]', 'dialog.dg-mapdlg']]) {
      if (!(await page.locator(sel).count()) || (slug === 'index' && dlg === 'dialog.dg-mapdlg')) continue;
      await page.focus(sel);
      await page.keyboard.press('Enter');
      const opened = await page.waitForSelector(`${dlg}[open]`, { timeout: 5000 }).then(() => true, () => false);
      if (!opened) { fail(`Enter on ${sel} opens no ${dlg}`); continue; }
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      if (await page.locator(`${dlg}[open]`).count()) fail(`Esc does not close ${dlg}`);
      else if (!(await page.evaluate(s => document.activeElement && document.activeElement.matches(s), sel))) fail(`focus does not return to ${sel} after Esc`);
    }
  }, { reducedMotion: 'reduce' });
}

try {
  const jobsList = [...pages.flatMap(s => [[s, 1280, 'light'], [s, 1280, 'dark']]), ...NARROW.map(s => [s, 390, 'light'])];
  const counts = await pool(jobsList, jobs, async ([s, w, t]) => {
    try { return await axe(s, w, t); } catch (e) { failures.push(`${s} @${w} ${t}: axe crashed: ${e.message.split('\n')[0]}`); return 1; }
  });
  console.log(`axe: ${jobsList.length} runs (${pages.length} pages × 2 themes at 1280 px + ${NARROW.length} at 390 px; panels mounted on ${PANELS.length} pages), ${counts.reduce((a, b) => a + b, 0)} serious/critical violations`);
  if (!filtered && !hasFlag(args, '--no-keyboard')) {
    for (const s of KEYS.filter(k => all.has(k))) {
      try { await keyboard(s); } catch (e) { failures.push(`${s} keyboard: crashed: ${e.message.split('\n')[0]}`); }
    }
    console.log(`keyboard: ${KEYS.length} pages`);
  }
} finally {
  await browser.close();
  server.close();
}
for (const f of failures) console.log('FAIL ' + f);
console.log(`${failures.length ? failures.length + ' failures' : 'all passed'} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(failures.length ? 1 : 0);
