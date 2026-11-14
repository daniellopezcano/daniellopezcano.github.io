// Hand-written tool: behaviour checks of the course page script (notes/diffgeo-gr/assets/course.js)
// on the rendered site in docs/.   node _port/tools/test_page_script.mjs      (exit code 0 = all passed)
// Checks: footnote popover, cross-reference previews (equation, figure, page), figure viewer
// (open, zoom, Escape, focus restored), links in the inlined master roadmap of the landing page,
// no console errors at 1280 and 390 px, no horizontal page scroll at 390 px.
import { chromium, serveDocs } from './shot.mjs';

const C = 'notes/diffgeo-gr/';
const PAGES = ['index.html', 'introduction/roadmaps.html', 'vector-spaces/foundations-sets-maps.html',
  'metric/length-geodesics.html', 'metric/levi-civita-connection.html'];
const failures = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failures.push(msg); };

const { server, base: base0 } = await serveDocs();
// localhost, not 127.0.0.1: Quarto's link-external-newwindow treats only localhost and the site URL as internal
const base = base0.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();

async function open(path, width = 1280, opts = {}) {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, ...opts });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/${C}${path}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('dg-math-ready') || !window.MathJax, null, { timeout: 30000 }).catch(() => errors.push('math never ready'));
  await page.waitForTimeout(400);
  return { page, errors };
}
const popText = page => page.evaluate(() => { const p = document.getElementById('dg-pop'); return p && !p.hidden ? p.textContent.trim() : ''; });
const popMath = page => page.evaluate(() => document.querySelectorAll('#dg-pop:not([hidden]) mjx-container').length);
async function waitPop(page, pred = t => t.length > 0) {
  for (let i = 0; i < 40; i++) { const t = await popText(page); if (pred(t)) return t; await page.waitForTimeout(100); }
  return popText(page);
}

try {
  // 1. footnote popover (hover, desktop)
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html');
    const mark = page.locator('.dg-fnref a#fnref-1').first();
    await mark.hover();
    const want = (await page.locator('#fn-1 .dg-fn-body').textContent()).trim().slice(0, 25);
    const t = await waitPop(page);
    ok(t.length > 20 && (await popMath(page)) > 0, 'footnote hover shows a popover with typeset math');
    ok(t.includes('Throughout these notes'), 'footnote popover holds the text of footnote 1');
    ok(await mark.getAttribute('aria-describedby') !== null, 'footnote mark has aria-describedby');
    await page.mouse.move(5, 500); await page.waitForTimeout(500);
    ok((await popText(page)) === '', 'footnote popover closes when the pointer leaves');
    await mark.focus();
    ok((await waitPop(page)).includes(want.slice(0, 15)), 'footnote popover opens on keyboard focus');
    await page.keyboard.press('Escape');
    ok((await popText(page)) === '', 'Escape closes the popover');
    // 2a. cross-reference to a figure on another page
    await page.locator('a.dg-xref[data-label="fig_vector_spaces_roadmap"]').first().hover();
    const f = await waitPop(page, t => t.includes('Figure 1.2'));
    ok(f.includes('Figure 1.2') && (await page.locator('#dg-pop figure img').count()) === 1, 'figure cross-reference preview shows the figure and its caption');
    const src = await page.locator('#dg-pop figure img').getAttribute('src');
    ok(/\/notes\/diffgeo-gr\/figures\/fig-vector-spaces-roadmap\.svg$/.test(src || ''), 'image URL in the preview is rebased to the target page');
    // 3. figure viewer
    await page.mouse.move(5, 500); await page.waitForTimeout(400);
    const paper = page.locator('#fig_maps_examples .dg-paper');
    await paper.scrollIntoViewIfNeeded();
    await paper.click();
    await page.waitForTimeout(300);
    ok(await page.locator('dialog.dg-viewer[open]').count() === 1, 'clicking a figure opens the viewer');
    await page.waitForFunction(() => document.querySelector('dialog.dg-viewer .dg-viewer-paper > svg'), null, { timeout: 5000 }).catch(() => {});
    ok(await page.locator('dialog.dg-viewer .dg-viewer-paper > svg').count() === 1, 'SVG figure is inlined in the viewer');
    const w0 = await page.evaluate(() => document.querySelector('.dg-viewer-paper').getBoundingClientRect().width);
    await page.keyboard.press('+'); await page.waitForTimeout(100);
    const w1 = await page.evaluate(() => document.querySelector('.dg-viewer-paper').getBoundingClientRect().width);
    ok(w1 > w0 * 1.1, 'the + key zooms in');
    await page.mouse.move(640, 450); await page.mouse.wheel(0, 400); await page.waitForTimeout(100);
    const w2 = await page.evaluate(() => document.querySelector('.dg-viewer-paper').getBoundingClientRect().width);
    ok(w2 < w1, 'the wheel zooms out');
    const labels = await page.$$eval('dialog.dg-viewer button', bs => bs.map(b => b.getAttribute('aria-label')));
    ok(labels.length === 4 && labels.every(Boolean), `viewer buttons have aria-labels (${labels.join(', ')})`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    ok(await page.locator('dialog.dg-viewer[open]').count() === 0, 'Escape closes the viewer');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.matches('#fig_maps_examples .dg-paper')), 'focus returns to the figure');
    await paper.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    ok(await page.locator('dialog.dg-viewer[open]').count() === 1, 'Enter on a focused figure opens the viewer');
    await page.locator('dialog.dg-viewer button[data-act="close"]').click(); await page.waitForTimeout(200);
    ok(await page.locator('dialog.dg-viewer[open]').count() === 0, 'the close button closes the viewer');
    await page.close();
  }
  // 2b. cross-reference to an equation on another page, and to a whole page
  {
    const { page } = await open('metric/levi-civita-connection.html');
    const x = page.locator('a.dg-xref[data-label="eq_geodesic"]').first();
    await x.scrollIntoViewIfNeeded(); await x.hover();
    await waitPop(page, t => t.length > 0);
    await page.waitForTimeout(1200);
    ok((await popMath(page)) > 0 && (await page.locator('#dg-pop .math.display').count()) === 1, 'equation cross-reference preview shows the typeset equation');
    ok((await x.getAttribute('aria-describedby')) === 'dg-pop', 'cross-reference is described by the popover while open');
    await page.mouse.move(5, 500); await page.waitForTimeout(400);
    for (const kind of ['section', 'subsection']) {
      const y = page.locator(`a.dg-xref[data-kind="${kind}"]`).first();
      ok(await y.count() === 1, `the page has a ${kind} cross-reference`);
      if (!(await y.count())) continue;
      await y.scrollIntoViewIfNeeded(); await y.hover();
      const t = await waitPop(page, s => s.length > 30);
      ok(t.length > 30 && (await page.locator('#dg-pop .dg-pop-title').count()) === 1, `${kind} cross-reference preview shows the title and opening lines`);
      await page.mouse.move(5, 500); await page.waitForTimeout(400);
    }
    await page.close();
  }
  // 1b. touch: first tap previews, tap elsewhere closes
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html', 390, { hasTouch: true, isMobile: true });
    const mark = page.locator('.dg-fnref a#fnref-1').first();
    await mark.scrollIntoViewIfNeeded();
    const y0 = await page.evaluate(() => scrollY);
    await mark.tap();
    const t = await waitPop(page);
    ok(t.includes('Throughout these notes') && (await page.evaluate(() => scrollY)) === y0, 'touch: first tap opens the footnote popover without jumping');
    const pw = await page.evaluate(() => { const r = document.getElementById('dg-pop').getBoundingClientRect(); return [r.left, r.right]; });
    ok(pw[0] >= 0 && pw[1] <= 390, 'touch: popover stays inside the viewport');
    await page.touchscreen.tap(200, 820); await page.waitForTimeout(200);
    ok((await popText(page)) === '', 'touch: tapping elsewhere closes the popover');
    await page.close();
  }
  // 4/5. landing page: the inlined roadmap and its links
  {
    const { page } = await open('index.html');
    await page.waitForFunction(() => document.querySelectorAll('.dg-landing-map svg a.dg-svg-link').length > 0, null, { timeout: 8000 }).catch(() => {});
    const links = await page.$$eval('.dg-landing-map svg a.dg-svg-link', as => as.map(a => a.getAttribute('href')));
    ok(links.length >= 20, `inline roadmap has ${links.length} links (>= 20)`);
    // The master roadmap has no "Ch. 2" badge (roadmap_master.tex: the first badge is \\mch{chapter_Topological_Manifolds});
    // the check uses its "Ch. 3" badge, at the top right.
    const ch3 = page.locator('.dg-landing-map svg a.dg-svg-link[href$="/topological-manifolds/index.html"]').first();
    ok(await ch3.count() === 1, 'the roadmap has a link to Chapter 3');
    await page.evaluate(() => document.querySelector('.dg-landing-map svg a.dg-svg-link[href$="/topological-manifolds/index.html"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => {
      const a = document.querySelector('.dg-landing-map svg a.dg-svg-link[href$="/topological-manifolds/index.html"]');
      const hit = a.querySelector('.dg-svg-hit').getBoundingClientRect(), num = a.querySelector('g.dg-xref').getBoundingClientRect();
      return { hit: hit.width, num: num.width, x: hit.left + hit.width * 0.15, y: hit.top + hit.height / 2 };
    });
    ok(box.hit > box.num * 2, 'the hit area covers the whole badge, not only the digits');
    await page.mouse.click(box.x, box.y);                    // the left part of the badge ("Ch.")
    await page.waitForURL(/topological-manifolds\/index\.html$/, { timeout: 8000 }).catch(() => {});
    ok(/\/notes\/diffgeo-gr\/topological-manifolds\/index\.html$/.test(page.url()), 'clicking the "Ch. 3" badge navigates to topological-manifolds/index.html');
    await page.goto(`${base}/${C}index.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.locator('.dg-expand').click(); await page.waitForTimeout(300);
    await page.waitForFunction(() => document.querySelectorAll('dialog.dg-viewer[open] a.dg-svg-link').length > 0, null, { timeout: 8000 }).catch(() => {});
    ok(await page.locator('dialog.dg-viewer[open] a.dg-svg-link').count() >= 20, 'the expand button opens the roadmap in the viewer, with working links');
    const ids = await page.evaluate(() => { const s = new Set(), d = []; for (const e of document.querySelectorAll('[id]')) { if (s.has(e.id)) d.push(e.id); s.add(e.id); } return d.length; });
    ok(ids === 0, 'no duplicate ids with two inlined copies of the roadmap');
    await page.keyboard.press('Escape');
    const btns = await page.$$eval('.dg-landing-actions a', as => as.map(a => [a.textContent.trim(), a.getAttribute('href')]));
    ok(btns.length === 3 && /\/introduction\/(index\.html)?$/.test(btns[0][1]), `landing buttons: ${btns.map(b => b[0]).join(' | ')}`);
    await page.close();
  }
  // console errors and horizontal overflow
  for (const width of [1280, 390]) {
    for (const p of PAGES) {
      const { page, errors } = await open(p, width);
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } });
      await page.waitForTimeout(800);
      ok(errors.length === 0, `${p} @${width}: no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
      if (width === 390) {
        const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        ok(sw <= iw, `${p} @390: no horizontal page scroll (scrollWidth ${sw}, innerWidth ${iw})`);
      }
      await page.close();
    }
  }
  // phone: the collapsed sidebar opens with its toggle
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html', 390);
    await page.locator('.quarto-secondary-nav .quarto-btn-toggle').click(); await page.waitForTimeout(600);
    ok(await page.locator('#quarto-sidebar').isVisible(), 'phone: the sidebar toggle opens the sidebar');
    await page.close();
  }
} catch (err) {
  ok(false, `exception: ${err.stack || err}`);
}

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PAGE-SCRIPT CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
