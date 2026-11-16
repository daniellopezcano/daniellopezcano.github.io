// Hand-written tool: behaviour checks of the course page script (notes/diffgeo-gr/assets/course.js)
// on the rendered site in docs/.   node _port/tools/test_page_script.mjs      (exit code 0 = all passed)
// Checks: sidenotes beside their mark from 1000 px (D33) and footnote popovers below, cross-reference
// previews (equation, figure, page, subsection), figure viewer (open, zoom, Escape, focus restored),
// links in the inlined master roadmap of the landing page, the page shell (theme switch persisted,
// course-tree drawer with the Contents button and Escape, outline scroll-spy, keyboard previous/next),
// no console errors at 1280 and 390 px, no horizontal page scroll at 390 px. Unit R7, at 1280 and 390 px:
// appendix content in place (from body text and from a footnote), copy LaTeX, the search dialog on both
// indexes (from a section page and from the landing page), the map dialog, and the no-JavaScript fallbacks.
// Unit R8, at 1280 and 390 px: chapter opening pages (D38): sections, related Appendix B / C items derived
// from the pages' own links, the lazy roadmap with the chapter's badges ringed, the Contents drawer at every
// width, back-links on the Appendix C page, no roadmap where the rule gives none, no console errors on all 13.
// Unit R10: "read" marks (D40: auto-mark at the end, toggle, tree / chapter page / landing, storage unavailable,
// no JavaScript), "open here" on the line of its reference, typeset search titles, the "Appendices" part title.
// Unit R10c: read marks after the delay (window.__dgReadDelay), the course tree scrolled to the current entry,
// previews inside the viewport, search snippets without raw TeX, and on every page at 1440 and 390 px no line
// break between a formula / reference and its punctuation (D44) and sidenote math within its note (D45).
// Unit B5 (D52): a citation previews its Bibliography entry; a List of Figures number previews its figure.
import { chromium, serveDocs } from './shot.mjs';

const C = 'notes/diffgeo-gr/';
const PAGES = ['index.html', 'introduction/roadmaps.html', 'vector-spaces/foundations-sets-maps.html',
  'metric/length-geodesics.html', 'metric/levi-civita-connection.html', 'examples/example-variations.html'];
const failures = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failures.push(msg); };

const { server, base: base0 } = await serveDocs();
const base = base0.replace('127.0.0.1', 'localhost');
const browser = await chromium.launch();

async function open(path, width = 1280, opts = {}) {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, ...opts });
  return load(page, path);
}
async function load(page, path) {
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
  // 0. sidenotes (D33): at 1440 px footnote 1 sits in the margin level with its mark, and the mark
  //    highlights it instead of opening a popover; the list at the foot of the page is hidden
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html', 1440);
    await page.waitForFunction(() => document.documentElement.classList.contains('dg-has-sidenotes'), null, { timeout: 8000 }).catch(() => {});
    const pos = await page.evaluate(() => {
      const n = document.querySelector('.dg-sidenote[data-for="fn-1"]'), m = document.querySelector('.dg-fnref a#fnref-1');
      if (!n || !m) return null;
      const a = n.getBoundingClientRect(), b = m.getBoundingClientRect(), main = document.getElementById('dg-main').getBoundingClientRect();
      return { dy: Math.abs(a.top - b.top), right: a.left >= main.right - 1, visible: a.width > 0 && getComputedStyle(n).visibility !== 'hidden',
        list: getComputedStyle(document.querySelector('.dg-footnotes')).display };
    });
    ok(pos && pos.visible && pos.right, 'sidenote of footnote 1 is shown in the margin, right of the text column');
    ok(pos && pos.dy <= 30, `sidenote sits within 30 px of its mark (${pos && Math.round(pos.dy)} px)`);
    ok(pos && pos.list === 'none', 'the footnote list at the foot of the page is hidden while sidenotes are shown');
    await page.locator('.dg-fnref a#fnref-1').first().hover(); await page.waitForTimeout(500);
    ok(await page.locator('.dg-sidenote[data-for="fn-1"].dg-hot').count() === 1 && (await popText(page)) === '', 'hovering the mark highlights its sidenote and opens no popover');
    await page.close();
  }
  // 1. footnote popover (hover, desktop without margin)
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html', 900);
    ok(await page.locator('.dg-sidenote').count() === 0 || !(await page.evaluate(() => document.documentElement.classList.contains('dg-has-sidenotes'))), 'no sidenotes below 1000 px');
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
    await page.close();
  }
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html');
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
      const y = page.locator(`#dg-main a.dg-xref[data-kind="${kind}"]:visible`).first();   // not in the hidden footnote list
      ok(await y.count() === 1, `the page has a ${kind} cross-reference`);
      if (!(await y.count())) continue;
      await y.scrollIntoViewIfNeeded(); await y.hover();
      const t = await waitPop(page, s => s.length > 30);
      ok(t.length > 30 && (await page.locator('#dg-pop .dg-pop-title').count()) === 1, `${kind} cross-reference preview shows the title and opening lines`);
      await page.mouse.move(5, 500); await page.waitForTimeout(400);
    }
    await page.close();
  }
  // 2c (unit B5, D52). a citation previews its Bibliography entry; a List of Figures number previews the figure
  {
    const { page } = await open('gr/matter.html');
    const c = page.locator('a.dg-cite[href$="#bib-Landau_Lifshitz_1975"]').first();
    await c.scrollIntoViewIfNeeded(); await c.hover();
    const t = await waitPop(page, s => s.includes('Landau'));
    ok(t.startsWith('L.') && t.includes('The Classical Theory of Fields') && t.includes('1975.'), 'citation preview shows its Bibliography entry');
    ok((await c.getAttribute('aria-describedby')) === 'dg-pop', 'citation is described by the popover while open');
    await page.close();
    const { page: p2 } = await open('list-of-figures.html');
    const x = p2.locator('.dg-lof a.dg-xref[data-label="fig_maps_examples"]').first();
    await x.hover();
    const f = await waitPop(p2, s => s.includes('Figure 2.1'));
    ok(f.includes('Figure 2.1') && (await p2.locator('#dg-pop figure img').count()) === 1, 'List of Figures: the number previews its figure');
    await p2.close();
  }
  // 1b. touch: first tap previews, tap elsewhere closes
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html', 390, { hasTouch: true, isMobile: true });
    const mark = page.locator('.dg-fnref a#fnref-1').first();
    await mark.scrollIntoViewIfNeeded();
    const y0 = await page.evaluate(() => scrollY);
    await mark.tap();
    const t = await waitPop(page);
    ok(!(await page.evaluate(() => document.documentElement.classList.contains('dg-has-sidenotes'))) && await page.locator('.dg-sidenote:visible').count() === 0, 'phone: no sidenotes at 390 px');
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
    const btns = await page.$$eval('.dg-landing-actions a', as => as.map(a => [a.textContent.trim(), a.href]));
    ok(btns.length === 3 && /\/introduction\/(index\.html)?$/.test(btns[0][1]), `landing buttons: ${btns.map(b => b[0]).join(' | ')}`);
    await page.close();
  }
  // R7 (D35, D36, D39): appendix content in place, copy LaTeX, search dialog, map dialog, at 1280 and 390 px
  const dupIds = page => page.evaluate(() => { const s = new Set(), d = []; for (const e of document.querySelectorAll('[id]')) { if (s.has(e.id)) d.push(e.id); s.add(e.id); } return d; });
  const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  for (const width of [1280, 390]) {
    const W = `@${width}`;
    // panel from body text (§2.1 has its only Appendix reference in a footnote, so the body case uses §7.2)
    {
      const { page, errors } = await open('metric/length-geodesics.html', width);
      const b = page.locator('#dg-main > p .dg-open-here, #dg-main li .dg-open-here').filter({ visible: true }).first();
      ok(await b.count() === 1, `${W} body text: a reference to Appendix B has an "open here" button`);
      const target = await b.evaluate(x => x.previousElementSibling.href);
      await b.scrollIntoViewIfNeeded(); await b.click();
      await page.waitForSelector('#dg-main .dg-inline:not(.dg-inline-raw)', { timeout: 10000 }).catch(() => {});
      const info = await page.evaluate(() => {
        const box = document.querySelector('#dg-main .dg-inline'), b = document.querySelector('.dg-open-here[aria-expanded="true"]');
        return box && { after: box.previousElementSibling && box.previousElementSibling.contains(b), mjx: box.querySelectorAll('mjx-container').length,
          raw: [...box.querySelectorAll('.math')].filter(m => !m.querySelector('mjx-container')).length,
          head: box.querySelector('.dg-inline-head').textContent, link: box.querySelector('.dg-inline-tools a').href,
          inter: box.querySelectorAll('.dg-interactive').length, nested: box.querySelectorAll('.dg-open-here').length,
          scroll: getComputedStyle(box.querySelector('.dg-inline-body')).overflowY };
      });
      ok(info && info.after, `${W} body text: the panel opens right after the block that holds the reference`);
      ok(info && info.mjx > 10 && info.raw === 0, `${W} body text: the math in the panel is typeset (${info && info.mjx} formulas)`);
      ok(info && /^Appendix B/.test(info.head) && /B\.13/.test(info.head) && info.link === target, `${W} body text: the panel names the item (kicker, number, title) and links to its page`);
      ok(info && info.nested === 0 && info.inter === 0 && info.scroll === 'auto', `${W} body text: no nested "open here", no interactive, the panel body scrolls`);
      ok((await dupIds(page)).length === 0, `${W} body text: ids stay unique with the panel open`);
      ok((await overflow(page)) <= 0, `${W} body text: no horizontal page scroll with the panel open`);
      // a reference inside the panel keeps its preview
      if (width >= 1000) {
        const x = page.locator('#dg-main .dg-inline a.dg-xref').first();
        await x.scrollIntoViewIfNeeded(); await x.hover();
        ok((await waitPop(page, t => t.length > 0)).length > 0, `${W} body text: a reference inside the panel shows its preview`);
        await page.mouse.move(5, 500); await page.waitForTimeout(400);
      }
      await b.click(); await page.waitForTimeout(200);
      ok(await page.locator('#dg-main .dg-inline').count() === 0 && (await b.getAttribute('aria-expanded')) === 'false', `${W} body text: a second click closes the panel`);
      await b.click();
      await page.waitForSelector('#dg-main .dg-inline', { timeout: 10000 }).catch(() => {});
      await page.locator('#dg-main .dg-inline-tools button').click(); await page.waitForTimeout(200);
      ok(await page.locator('#dg-main .dg-inline').count() === 0 && await page.evaluate(() => document.activeElement && document.activeElement.matches('.dg-open-here')),
        `${W} body text: the close button closes the panel and the focus returns to "open here"`);
      ok(errors.length === 0, `${W} body text: no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
      await page.close();
    }
    // panel from a footnote (§2.1, footnote 1: sidenote at 1280, footnote list / popover at 390)
    {
      const { page, errors } = await open('vector-spaces/foundations-sets-maps.html', width, width < 600 ? { hasTouch: true, isMobile: true } : {});
      const sel = width >= 1000 ? '.dg-sidenote .dg-open-here' : '.dg-footnotes .dg-open-here';
      const b = page.locator(sel).first();
      ok(await b.count() === 1, `${W} footnote: the reference to B.1 in footnote 1 has an "open here" button`);
      await b.scrollIntoViewIfNeeded(); await b.click();
      await page.waitForSelector('#dg-main .dg-inline:not(.dg-inline-raw)', { timeout: 10000 }).catch(() => {});
      const info = await page.evaluate(() => {
        const box = document.querySelector('#dg-main .dg-inline'), mark = document.querySelector('#fnref-1');
        return box && { after: !!box.previousElementSibling && box.previousElementSibling.contains(mark), head: box.querySelector('.dg-inline-head').textContent };
      });
      ok(info && info.after && /B\.1/.test(info.head), `${W} footnote: the panel opens after the block that holds the footnote mark`);
      ok((await dupIds(page)).length === 0 && (await overflow(page)) <= 0, `${W} footnote: ids unique and no horizontal page scroll with the panel open`);
      if (width >= 1000) {
        const dy = await page.evaluate(() => { const n = document.querySelector('.dg-sidenote[data-for="fn-1"]'), m = document.getElementById('fnref-1'); return Math.abs(n.getBoundingClientRect().top - m.getBoundingClientRect().top); });
        ok(dy <= 30, `${W} footnote: the sidenote stays level with its mark with the panel open (${Math.round(dy)} px)`);
      }
      await b.click(); await page.waitForTimeout(200);
      ok(await page.locator('#dg-main .dg-inline').count() === 0, `${W} footnote: a second click closes the panel`);
      ok(errors.length === 0, `${W} footnote: no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
      await page.close();
    }
    // copy LaTeX: a numbered equation (source rewritten for the web, original in data-tex) and an unnumbered one
    {
      const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, ...(width < 600 ? { hasTouch: true, isMobile: true } : {}) });
      await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
      const { page, errors } = await load(await ctx.newPage(), 'metric/levi-civita-connection.html');
      const raw = await page.evaluate(async () => {                 // the page as the converter wrote it
        const doc = new DOMParser().parseFromString(await (await fetch(location.href)).text(), 'text/html');
        return { numbered: doc.getElementById('eq_christoffel_symbols').getAttribute('data-tex') };
      });
      const copy = async (loc) => {
        await loc.scrollIntoViewIfNeeded();
        if (width < 600) await loc.tap(); else await loc.hover();
        await page.waitForTimeout(200);
        const btn = loc.locator('xpath=following-sibling::button[contains(@class,"dg-copy")]');
        const visible = await btn.evaluate(b => getComputedStyle(b).opacity === '1');
        await btn.click(); await page.waitForTimeout(200);
        return { visible, text: await page.evaluate(() => navigator.clipboard.readText()), done: await btn.evaluate(b => b.classList.contains('dg-done')) };
      };
      const r1 = await copy(page.locator('#eq_christoffel_symbols'));
      ok(r1.visible, `${W} copy: the button shows on ${width < 600 ? 'tap' : 'hover'}`);
      ok(r1.text === raw.numbered && r1.text.startsWith('\\begin{equation}\\label{eq_christoffel_symbols}'), `${W} copy: a numbered equation copies its source as in the notes (with \\label, not \\tag)`);
      ok(r1.done, `${W} copy: the button confirms ("Copied")`);
      if (width >= 1000) {
        const n = await page.evaluate(() => { const b = document.querySelector('.dg-copy'); b.focus(); return getComputedStyle(b).opacity; });
        ok(n === '1', `${W} copy: the button shows on keyboard focus`);
      }
      ok((await overflow(page)) <= 0 && errors.length === 0, `${W} copy: no horizontal page scroll, no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
      // an unnumbered equation (§7.2): its TeX as the converter wrote it (= the notes' source)
      await load(page, 'metric/length-geodesics.html');
      const plain = await page.evaluate(async () => {
        const doc = new DOMParser().parseFromString(await (await fetch(location.href)).text(), 'text/html');
        const ds = [...doc.querySelectorAll('.math.display')], i = ds.findIndex(d => !d.hasAttribute('data-tex'));
        return { i, tex: i >= 0 ? ds[i].textContent : null };
      });
      const r2 = plain.i >= 0 ? await copy(page.locator('#dg-main .math.display').nth(plain.i)) : { text: '' };
      ok(plain.tex && r2.text === plain.tex, `${W} copy: an unnumbered equation copies the TeX the converter wrote`);
      await ctx.close();
    }
    // search: both indexes, from a section page and from the landing page
    {
      const want = /\/notes\/diffgeo-gr\/proofs-and-additional-material\/proof-length-reparametrization\.html$/;
      const cases = [
        ['metric/length-geodesics.html', 'bar', 'reparametrization invariance length', want],
        ['index.html', 'key', 'Reparametrization  INVARIANCE length', want],
        ['metric/length-geodesics.html', 'site', 'posters', /\/outreach\.html#posters$/],
        ['index.html', 'site', 'reparametrization invariance length', want],
      ];
      for (const [path, how, q, re] of cases) {
        const { page, errors } = await open(path, width);
        const opener = how === 'bar' ? page.locator('.dg-bar [data-act="search"]') : page.locator('.dg-sitenav [data-act="search"]');
        if (how === 'key') await page.keyboard.press('/'); else await opener.click();
        await page.waitForTimeout(200);
        const scope = await page.evaluate(() => document.querySelector('.dg-search-scope [aria-pressed="true"]')?.dataset.scope);
        ok(await page.locator('dialog.dg-search[open]').count() === 1 && scope === (how === 'site' ? 'site' : 'notes'), `${W} search (${path}, ${how}): the dialog opens on the ${how === 'site' ? 'site' : 'course'} index`);
        await page.keyboard.type(q);
        await page.waitForFunction(() => document.querySelectorAll('.dg-search-list [role="option"]').length > 0, null, { timeout: 8000 }).catch(() => {});
        const first = await page.evaluate(() => { const a = document.querySelector('.dg-search-list [role="option"] a'); return a && { href: a.href, marks: document.querySelectorAll('.dg-search-list mark').length }; });
        ok(first && re.test(first.href) && first.marks > 0, `${W} search (${path}, ${how}): "${q}" finds ${first && first.href.replace(/^.*?\/\/[^/]+/, '')} first, with the match marked`);
        if (how === 'bar' && width === 1280) {
          await page.keyboard.press('Escape'); await page.waitForTimeout(150);
          ok(await page.locator('dialog.dg-search[open]').count() === 0 && await page.evaluate(() => document.activeElement && document.activeElement.matches('.dg-bar [data-act="search"]')), `${W} search: Escape closes the dialog and the focus returns to the button`);
          await opener.click(); await page.waitForTimeout(150);
          await page.locator('.dg-search-scope [data-scope="site"]').click(); await page.waitForTimeout(400);
          ok(await page.evaluate(() => document.querySelector('.dg-search-input').getAttribute('aria-label')) === 'Search the site', `${W} search: the dialog offers the other index and switches to it`);
          await page.locator('.dg-search-scope [data-scope="notes"]').click(); await page.waitForTimeout(400);
          await page.locator('.dg-search-input').fill('zzqqxx'); await page.waitForTimeout(400);
          ok(await page.locator('.dg-search-empty').isVisible(), `${W} search: a query without hits says so`);
          await page.locator('.dg-search-input').fill(q);
          await page.waitForFunction(() => document.querySelectorAll('.dg-search-list [role="option"]').length > 0, null, { timeout: 8000 }).catch(() => {});
        }
        await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowDown');
        const sel = await page.evaluate(() => document.querySelector('.dg-search-input').getAttribute('aria-activedescendant'));
        await page.keyboard.press('Enter');
        await page.waitForURL(re, { timeout: 8000 }).catch(() => {});
        ok(sel === 'dg-sr-0' && re.test(page.url()), `${W} search (${path}, ${how}): ↓ selects, Enter opens ${page.url().replace(/^.*?\/\/[^/]+/, '')}`);
        ok(errors.length === 0, `${W} search (${path}, ${how}): no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
        await page.close();
      }
    }
    // map dialog: a Chapter 4 page has its badges ringed; Escape closes and the focus returns to "Map"
    {
      // (§4.1 and §4.2 are avoided: at 390 px they scroll sideways already, a problem the dialog does not touch)
      const { page, errors } = await open('tangent-spaces/tensor-space.html', width);
      await page.locator('.dg-bar a[data-act="map"]').click();
      await page.waitForFunction(() => document.querySelectorAll('dialog.dg-mapdlg[open] a.dg-svg-link').length > 0, null, { timeout: 10000 }).catch(() => {});
      const m = await page.evaluate(() => {
        const d = document.querySelector('dialog.dg-mapdlg[open]');
        if (!d) return null;
        const r = d.querySelector('svg').getBoundingClientRect(), dr = d.getBoundingClientRect();
        return { links: d.querySelectorAll('a.dg-svg-link').length, here: [...d.querySelectorAll('a.dg-here')].map(a => a.getAttribute('href')),
          fits: r.width <= dr.width + 1 && r.right <= dr.right + 1 && r.left >= dr.left - 1, cap: d.querySelector('.dg-mapdlg-cap').textContent.trim().slice(0, 11),
          sec: d.querySelector('.dg-mapdlg-sec a') && [d.querySelector('.dg-mapdlg-sec a').textContent.trim(), d.querySelector('.dg-mapdlg-sec a').href],
          capMath: d.querySelectorAll('.dg-mapdlg-cap mjx-container').length };
      });
      ok(m && m.links >= 20, `${W} map: the dialog shows the master roadmap with ${m && m.links} links (>= 20)`);
      ok(m && m.here.length > 0 && m.here.every(h => /\/tangent-spaces\//.test(h)), `${W} map: the badges into Chapter 4 are ringed (${m && m.here.length})`);
      ok(m && m.fits, `${W} map: the roadmap fits the dialog's width`);
      ok(m && m.cap === 'Figure 1.1:' && m.capMath > 0 && m.sec && /^1\.1\s+Roadmaps/.test(m.sec[0]) && /\/introduction\/roadmaps\.html$/.test(m.sec[1]), `${W} map: the notes' caption (typeset) and the link to §1.1`);
      ok((await overflow(page)) <= 0, `${W} map: no horizontal page scroll`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      ok(await page.locator('dialog.dg-mapdlg[open]').count() === 0 && await page.evaluate(() => document.activeElement && document.activeElement.matches('.dg-bar a[data-act="map"]')), `${W} map: Escape closes the dialog and the focus returns to "Map"`);
      ok(errors.length === 0, `${W} map: no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
      await page.close();
    }
  }
  {
    // outside the main chapters nothing is ringed; on the landing page "Map" just scrolls to the roadmap
    const { page } = await open('examples/example-variations.html');
    await page.locator('.dg-bar a[data-act="map"]').click();
    await page.waitForFunction(() => document.querySelectorAll('dialog.dg-mapdlg[open] a.dg-svg-link').length > 0, null, { timeout: 10000 }).catch(() => {});
    ok(await page.locator('dialog.dg-mapdlg[open] a.dg-here').count() === 0, 'map: nothing ringed on a page of Appendix C');
    await page.close();
    const { page: p2 } = await open('index.html');
    await p2.locator('.dg-bar a[data-act="map"]').click(); await p2.waitForTimeout(600);
    ok(await p2.locator('dialog.dg-mapdlg').count() === 0 && /#dg-roadmap$/.test(p2.url()), 'map: on the landing page "Map" scrolls to the roadmap (no dialog)');
    await p2.close();
  }
  // without JavaScript: no search buttons, "Map" is the link to the landing page's roadmap
  {
    const page = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    await page.goto(`${base}/${C}vector-spaces/foundations-sets-maps.html`);
    ok(await page.locator('[data-act="search"]:visible').count() === 0, 'no JavaScript: the search buttons are hidden');
    ok(/index\.html#dg-roadmap$/.test(await page.locator('.dg-bar a[data-act="map"]').getAttribute('href')), 'no JavaScript: "Map" links to the roadmap of the landing page');
    await page.close();
  }
  // R8 (D38): chapter opening pages. The expected related items are derived from the pages' own links: an
  // appendix item (section page of Appendix B or C) is connected with a main-text page when one of the two
  // links to the other (cross-references in <main>, web layer excluded).
  {
    const scanLinks = (page, urls) => page.evaluate(async urls => {
      const out = {};
      await Promise.all(urls.map(async u => {
        const doc = new DOMParser().parseFromString(await (await fetch(u)).text(), 'text/html');
        const set = new Set();
        for (const a of doc.querySelectorAll('#dg-main a.dg-xref[href]')) {
          if (a.closest('.dg-web')) continue;
          const t = new URL(a.getAttribute('href'), u); t.hash = '';
          set.add(t.href);
        }
        out[u] = [...set];
      }));
      return out;
    }, urls);
    // from the course tree: { number: { url, pages: [url of each converted section page] } }
    const treeOf = page => page.evaluate(() => {
      const out = {};
      for (const li of document.querySelectorAll('#dg-tree .dg-ch')) {
        const n = (li.querySelector(':scope > a .dg-n, :scope > .dg-pending .dg-n')?.textContent || '').trim();
        const a = li.querySelector(':scope > a');
        out[n] = { url: a ? a.href : null, pages: [...li.querySelectorAll(':scope > ol:not(.dg-tree-outline) > li > a')].map(x => x.href) };
      }
      return out;
    });
    const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
    for (const width of [1280, 390]) {
      const W = `@${width}`;
      const requests = [];
      const pg = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 } });
      pg.on('request', r => { if (r.resourceType() === 'fetch') requests.push(r.url()); });   // the script's fetches
      const { page, errors } = await load(pg, 'tangent-spaces/index.html');
      ok(await page.evaluate(() => document.body.classList.contains('dg-page-chapter')), `${W} chapter page: body class dg-page-chapter`);
      const tree = await treeOf(page);
      const secs = await page.$$eval('.dg-chapter-sections li a', as => as.map(a => a.href));
      ok(secs.length === 3 && sameSet(secs, tree['4'].pages), `${W} chapter page: the 3 sections of Chapter 4 are listed (${secs.length})`);
      // expected related items
      const items = ['B', 'C'].flatMap(n => tree[n].pages);
      const mine = [tree['4'].url, ...tree['4'].pages];
      const links = await scanLinks(page, [...items, ...mine]);
      const conn = (q, y) => links[q].includes(y) || links[y].includes(q);
      const want = {};
      for (const y of items) { const qs = mine.filter(q => conn(q, y)); if (qs.length) want[y] = qs; }
      const got = await page.evaluate(() => [...document.querySelectorAll('.dg-chapter-related li')].map(li => ({
        y: li.querySelector('a.dg-related-item')?.href || null,
        qs: [...li.querySelectorAll('.dg-related-pages a')].map(a => a.href).concat(li.querySelector('.dg-related-here') ? [location.href] : []),
        group: li.closest('nav').querySelector('h2 a')?.href || '' })));
      const groups = await page.$$eval('.dg-chapter-related h2', hs => hs.map(h => h.textContent.replace(/\s+/g, ' ').trim()));
      ok(groups.length === 2 && /^Appendix B\b/.test(groups[0]) && /^Appendix C\b/.test(groups[1]), `${W} chapter page: related groups headed by Appendix B, then C (${groups.join(' | ')})`);
      ok(got.every(g => g.y && /\/(proofs-and-additional-material|examples)\/index\.html$/.test(g.group)), `${W} chapter page: each group links to its appendix's opening page`);
      const gotMap = Object.fromEntries(got.map(g => [g.y, g.qs]));
      const diff = [...new Set([...Object.keys(want), ...Object.keys(gotMap)])]
        .filter(y => !want[y] || !gotMap[y] || !sameSet(want[y], gotMap[y])).map(y => y.replace(/^.*\/diffgeo-gr\//, ''));
      ok(Object.keys(want).length >= 4 && diff.length === 0, `${W} chapter page: related items and their page numbers match the pages' links (${Object.keys(want).length} items${diff.length ? '; differ: ' + diff.join(', ') : ''})`);
      ok(await page.locator('.dg-chapter-web .dg-open-here, .dg-chapter-map .dg-open-here').count() === 0, `${W} chapter page: no "open here" inside the lists or the roadmap`);
      // roadmap: lazy, inlined near the viewport, linked, the chapter's badges ringed
      const map = await page.evaluate(() => { const m = document.querySelector('.dg-chapter-map'); return m && { top: m.getBoundingClientRect().top, svg: !!m.querySelector('svg'),
        cap: m.querySelector('figcaption a.dg-fignum')?.href || '', num: m.querySelector('figcaption .dg-fignum')?.textContent || '' }; });
      ok(!!map, `${W} chapter page: the roadmap block is present`);
      if (map) {
        map.lazy = await page.evaluate(async () => new DOMParser().parseFromString(await (await fetch(location.href)).text(), 'text/html')
          .querySelector('.dg-chapter-map img')?.getAttribute('loading'));                       // the page as written, before the script
        ok(map.lazy === 'lazy' && /\/introduction\/roadmaps\.html#fig_roadmap_topology_to_fields$/.test(map.cap) && map.num === 'Figure 1.3:', `${W} roadmap: lazy image, number "${map.num}" links to the figure in §1.1`);
        // (the fallback <img loading="lazy"> is the browser's to load; the script fetches the SVG only within 800 px)
        if (map.top > (width < 600 ? 844 : 900) + 900) {
          ok(!map.svg && !requests.some(u => /fig-roadmap-topology-to-fields\.svg$/.test(u)), `${W} roadmap: not fetched by the script while far below the viewport (${Math.round(map.top)} px)`);
        }
        await page.evaluate(() => document.querySelector('.dg-chapter-map').scrollIntoView());
        await page.waitForFunction(() => document.querySelectorAll('.dg-chapter-map svg a.dg-svg-link').length > 0, null, { timeout: 10000 }).catch(() => {});
        const m = await page.evaluate(() => ({ links: document.querySelectorAll('.dg-chapter-map svg a.dg-svg-link').length,
          here: [...document.querySelectorAll('.dg-chapter-map svg a.dg-here')].map(a => a.getAttribute('href')),
          stroke: (() => { const h = document.querySelector('.dg-chapter-map svg a.dg-here .dg-svg-hit'); return h ? getComputedStyle(h).stroke : ''; })(),
          cap: getComputedStyle(document.querySelector('.dg-chapter-map figcaption')).fontFamily }));
        ok(m.links >= 10, `${W} roadmap: inlined after scrolling to it, ${m.links} links (>= 10)`);
        ok(m.here.length > 0 && m.here.every(h => /\/tangent-spaces\//.test(h)) && m.stroke && m.stroke !== 'none', `${W} roadmap: the badges into Chapter 4 are ringed (${m.here.length})`);
        ok(/NewCM/.test(m.cap), `${W} roadmap: the caption keeps the text face`);
        await page.locator('.dg-chapter-map .dg-expand').click(); await page.waitForTimeout(300);
        await page.waitForFunction(() => document.querySelectorAll('dialog.dg-viewer[open] a.dg-svg-link').length > 0, null, { timeout: 8000 }).catch(() => {});
        ok(await page.locator('dialog.dg-viewer[open] a.dg-svg-link').count() >= 10, `${W} roadmap: the expand button opens it in the viewer, with links`);
        await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      }
      ok((await overflow(page)) <= 0, `${W} chapter page: no horizontal page scroll`);
      ok((await dupIds(page)).length === 0, `${W} chapter page: ids stay unique with the roadmap inlined`);
      // the course tree is a drawer at every width on these pages
      await page.evaluate(() => scrollTo(0, 0));
      const btn = page.locator('.dg-bar-menu');
      ok(await btn.isVisible(), `${W} chapter page: the Contents button is shown`);
      await btn.click(); await page.waitForTimeout(400);
      ok(await page.evaluate(() => { const t = document.getElementById('dg-tree'), r = t.getBoundingClientRect(); return getComputedStyle(t).visibility === 'visible' && r.right > 50 && r.left >= -1; }),
        `${W} chapter page: the Contents drawer opens`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      ok(errors.length === 0, `${W} chapter page: no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
      // the opening page of Appendix C: each item carries the main-text pages connected with it
      if (width === 1280) {
        await load(page, 'examples/index.html');
        const t = await treeOf(page);
        const text = Object.entries(t).filter(([n]) => /^\d+$/.test(n)).flatMap(([, c]) => [c.url, ...c.pages]).filter(Boolean);
        const cs = t.C.pages;
        const lk = await scanLinks(page, [...cs, ...text]);
        const exp = {};
        for (const y of cs) { const qs = text.filter(q => lk[q].includes(y) || lk[y].includes(q)); if (qs.length) exp[y] = qs; }
        const back = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.dg-chapter-sections li')]
          .filter(li => li.querySelector('a.dg-related-item')).map(li => [li.querySelector('a.dg-related-item').href, [...li.querySelectorAll('.dg-related-pages a')].map(a => a.href)])
          .filter(([, qs]) => qs.length)));
        const d = [...new Set([...Object.keys(exp), ...Object.keys(back)])].filter(y => !exp[y] || !back[y] || !sameSet(exp[y], back[y]));
        ok(Object.keys(back).length >= 7 && d.length === 0, `Appendix C page: items carry back-links to the main-text pages connected with them (${Object.keys(back).length} items${d.length ? '; differ: ' + d.map(y => y.replace(/^.*\/diffgeo-gr\//, '')).join(', ') : ''})`);
        ok(await page.locator('.dg-chapter-related, .dg-chapter-map').count() === 0, 'Appendix C page: no related-items block of its own, no roadmap');
      }
      // no roadmap where the rule gives none; no error
      for (const p of ['introduction/index.html', 'computational-ressources/index.html']) {
        const { page: q, errors: e } = await open(p, width);
        await q.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } });
        await q.waitForTimeout(300);
        ok(await q.locator('.dg-chapter-map').count() === 0 && e.length === 0, `${W} ${p}: no roadmap block, no console errors${e.length ? ': ' + e.slice(0, 3).join(' / ') : ''}`);
        await q.close();
      }
      await page.close();
    }
    // all chapter opening pages: no console errors (scrolled through, so the roadmaps load)
    const { page: t0 } = await open('index.html');
    const chapters = await t0.$$eval('.dg-contents-chapter > a', as => as.map(a => a.getAttribute('href')));
    await t0.close();
    ok(chapters.length === 13, `the landing page lists ${chapters.length} chapter opening pages (13)`);
    for (const width of [1280, 390]) {
      for (const p of chapters) {
        const { page, errors } = await open(p, width);
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } });
        await page.waitForTimeout(600);
        ok(errors.length === 0, `${p} @${width}: no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
        await page.close();
      }
    }
  }
  // R10 (D40): "read" marks. One browser context, so that localStorage carries across the pages.
  {
    // D40 as amended: the end in view AND >= 20 s on the page. The tests shorten the 20 s through the hook the
    // script documents (window.__dgReadDelay, ms), set before the page's scripts run.
    const DELAY = 6000;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(d => { window.__dgReadDelay = d; }, DELAY);
    const t0 = Date.now();
    const { page, errors } = await load(await ctx.newPage(), 'metric/length-geodesics.html');
    const SLUG = 'metric/length-geodesics';
    const pressed = () => page.locator('.dg-readtoggle').getAttribute('aria-pressed');
    const stored = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('dg-read') || '[]'); } catch (e) { return null; } });
    const markOn = (sel) => page.evaluate(s => { const m = document.querySelector(s); return !!m && m.classList.contains('dg-on') && getComputedStyle(m).visibility === 'visible'; }, sel);
    const treeMark = '#dg-tree a[href$="length-geodesics.html"] .dg-readmark';
    ok(await page.locator('.dg-readtoggle').count() === 1 && (await pressed()) === 'false' && !(await markOn(treeMark)), 'read: a section page has the toggle (not pressed) and no mark yet');
    const box0 = await page.evaluate(s => { const a = document.querySelector(s).closest('a').getBoundingClientRect(); return [a.width, a.height]; }, treeMark);
    await page.evaluate(() => document.querySelector('.dg-prevnext').scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(500);
    const early = Date.now() - t0 < DELAY - 300;
    ok(early && (await pressed()) === 'false' && !(await stored()).includes(SLUG), `read: the end in view before the delay does not mark the page yet (${Date.now() - t0} ms of ${DELAY})`);
    await page.waitForFunction(() => document.querySelector('.dg-readtoggle').getAttribute('aria-pressed') === 'true', null, { timeout: DELAY + 3000 }).catch(() => {});
    ok((await pressed()) === 'true' && (await stored()).includes(SLUG) && Date.now() - t0 >= DELAY, 'read: with the end still in view, the page is marked once the delay has passed (toggle pressed, slug stored)');
    ok(await markOn(treeMark), 'read: the check shows in the course tree at once');
    const box1 = await page.evaluate(s => { const a = document.querySelector(s).closest('a').getBoundingClientRect(); return [a.width, a.height]; }, treeMark);
    ok(box0[0] === box1[0] && box0[1] === box1[1], `read: the check does not move the tree entry (${box0} -> ${box1})`);
    ok(await page.evaluate(s => document.querySelector(s).textContent.trim() === 'read', treeMark), 'read: the check has a hidden text alternative ("read")');
    await load(page, 'metric/metric.html');
    ok(await markOn(treeMark) && !(await markOn('#dg-tree a[href$="metric.html"] .dg-readmark')), 'read: after loading another page, 7.2 is marked in the tree and 7.1 is not');
    await load(page, 'metric/index.html');
    ok(await markOn('.dg-chapter-sections a[href$="length-geodesics.html"] .dg-readmark') && !(await markOn('.dg-chapter-sections a[href$="metric.html"] .dg-readmark')),
      'read: the chapter opening page marks 7.2 in its sections list');
    ok(await page.locator('.dg-readtoggle').count() === 0, 'read: no toggle on a chapter opening page');
    await load(page, 'index.html');
    ok(await markOn('.dg-contents a[href="metric/length-geodesics.html"] .dg-readmark') && await page.locator('.dg-contents .dg-readmark.dg-on').count() === 1,
      'read: the landing page marks 7.2 (and nothing else) in its contents');
    ok(await page.locator('.dg-readtoggle').count() === 0, 'read: no toggle on the landing page');
    // the toggle clears the mark, and reaching the end again during the visit does not set it back
    await load(page, 'metric/length-geodesics.html');
    ok((await pressed()) === 'true', 'read: the toggle shows the page as read on the next visit');
    await page.locator('.dg-readtoggle').click(); await page.waitForTimeout(200);
    ok((await pressed()) === 'false' && !(await stored()).includes(SLUG) && !(await markOn(treeMark)), 'read: pressing the toggle clears the mark');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('.dg-prevnext').scrollIntoView({ behavior: 'instant' })); await page.waitForTimeout(DELAY + 500);
    ok((await pressed()) === 'false' && !(await stored()).includes(SLUG), 'read: after clearing, the end in view past the delay does not mark the page again');
    await page.locator('.dg-readtoggle').click(); await page.waitForTimeout(200);
    ok((await pressed()) === 'true' && (await stored()).includes(SLUG), 'read: pressing the toggle again marks the page');
    ok(errors.length === 0, `read: no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
    await ctx.close();
    // storage unavailable: no error, the toggle still works for the visit
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx2.addInitScript(() => { window.__dgReadDelay = 0; Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); });
    const { page: p2, errors: e2 } = await load(await ctx2.newPage(), 'metric/length-geodesics.html');
    await p2.evaluate(() => document.querySelector('.dg-prevnext').scrollIntoView({ behavior: 'instant' })); await p2.waitForTimeout(500);
    const a1 = await p2.locator('.dg-readtoggle').getAttribute('aria-pressed');
    await p2.locator('.dg-readtoggle').click(); await p2.waitForTimeout(200);
    const a2 = await p2.locator('.dg-readtoggle').getAttribute('aria-pressed');
    ok(e2.length === 0 && a1 === 'true' && a2 === 'false', `read: without storage no error and the toggle still works (${a1} -> ${a2})${e2.length ? ': ' + e2.slice(0, 3).join(' / ') : ''}`);
    await ctx2.close();
    // without JavaScript the toggle is hidden and no check shows
    const p3 = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    await p3.goto(`${base}/${C}metric/length-geodesics.html`);
    ok(await p3.locator('.dg-readtoggle:visible').count() === 0 && await p3.evaluate(() => [...document.querySelectorAll('.dg-readmark')].every(m => getComputedStyle(m).visibility === 'hidden')),
      'read: without JavaScript no toggle and no check');
    await p3.close();
  }
  // R10: "open here" stays on the line of its reference number (§7.2)
  for (const width of [1440, 1280]) {
    const { page } = await open('metric/length-geodesics.html', width);
    const r = await page.evaluate(() => [...document.querySelectorAll('.dg-xref-open')].filter(k => k.offsetParent).map(k => {
      const ra = [...k.querySelector('a').getClientRects()].pop(), rb = k.querySelector('button').getBoundingClientRect();
      return Math.abs(ra.bottom - rb.bottom) < 12 && ra.right <= rb.left + 1;
    }));
    ok(r.length >= 3 && r.every(Boolean), `@${width} §7.2: every "open here" sits on the line of its reference (${r.filter(Boolean).length}/${r.length})`);
    await page.close();
  }
  // R10: search result titles and section names are typeset, never raw TeX; the match is still marked
  {
    const { page, errors } = await open('metric/metric.html', 1280);
    await page.keyboard.press('/');
    await page.keyboard.type('tangent space');
    await page.waitForFunction(() => document.querySelectorAll('.dg-search-page mjx-container').length > 0, null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);
    const s = await page.evaluate(() => {
      const ts = [...document.querySelectorAll('.dg-search-page, .dg-search-sec')];
      return { n: ts.length, raw: ts.filter(t => t.textContent.includes('\\(')).length, mjx: document.querySelectorAll('.dg-search-page mjx-container, .dg-search-sec mjx-container').length,
        marks: document.querySelectorAll('.dg-search-page mark').length, markInMath: document.querySelectorAll('.dg-search-list mjx-container mark, .dg-search-list mark mjx-container').length,
        hidden: [...document.querySelectorAll('.dg-search-page mjx-container')].some(m => getComputedStyle(m).visibility === 'hidden') };
    });
    ok(s.n > 0 && s.raw === 0 && s.mjx > 0 && !s.hidden, `search: titles and section names show typeset math, no "\\(" (${s.mjx} formulas in ${s.n} titles)`);
    ok(s.marks > 0 && s.markInMath === 0, 'search: words in titles are marked, no mark inside a formula');
    ok(errors.length === 0, `search titles: no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
    await page.close();
  }
  // R10: the notes' part title "Appendices" (main.tex) before Appendix A, in the tree and the landing contents
  {
    const { page } = await open('metric/metric.html', 1440);
    const t = await page.evaluate(() => { const p = document.querySelector('#dg-tree .dg-tree-part'); const n = p && p.nextElementSibling;
      return p && [p.textContent.trim(), (n && n.querySelector('.dg-n') || {}).textContent]; });
    ok(t && t[0] === 'Appendices' && t[1] === 'A', `tree: "Appendices" heads the appendices (${t})`);
    await load(page, 'index.html');
    const l = await page.evaluate(() => { const p = document.querySelector('.dg-contents .dg-contents-part'); const n = p && p.nextElementSibling;
      return p && [p.textContent.trim(), n && n.querySelector('.dg-contents-kicker').textContent.trim()]; });
    ok(l && l[0] === 'Appendices' && l[1] === 'Appendix A', `landing contents: "Appendices" heads the appendices (${l})`);
    await page.close();
  }
  // R10c: on load the course tree scrolls so that the current page's entry is in view; the page does not move
  for (const [path, width] of [['proofs-and-additional-material/proof-sylvester.html', 1440], ['examples/example-variations.html', 1440],
    ['proofs-and-additional-material/proof-sylvester.html', 390]]) {
    const { page } = await open(path, width);
    if (width < 1000) { await page.locator('.dg-bar-menu').click(); await page.waitForTimeout(400); }
    const r = await page.evaluate(() => {
      const t = document.getElementById('dg-tree'), a = t.querySelector('[aria-current="page"]');
      const tr = t.getBoundingClientRect(), ar = a.getBoundingClientRect();
      return { y: scrollY, scrolled: t.scrollTop, inTree: ar.top >= tr.top - 1 && ar.bottom <= tr.bottom + 1, onScreen: ar.top >= 0 && ar.bottom <= innerHeight };
    });
    ok(r.y === 0 && r.inTree && r.onScreen && r.scrolled > 0, `@${width} ${path}: the current entry of the course tree is in view on load (tree scrolled ${Math.round(r.scrolled)} px, page ${r.y})`);
    await page.close();
  }
  // R10c (D45 c): previews stay inside the viewport: a figure is scaled to fit, a wide equation scrolls inside
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html', 1440);
    const x = page.locator('a.dg-xref[data-label="fig_vector_spaces_roadmap"]').first();
    await x.scrollIntoViewIfNeeded(); await x.hover();
    await waitPop(page, t => t.includes('Figure 1.2'));
    await page.waitForTimeout(800);
    const f = await page.evaluate(() => { const p = document.getElementById('dg-pop'), r = p.getBoundingClientRect(), c = p.querySelector('figcaption').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: innerHeight, scrolls: p.scrollHeight > p.clientHeight + 1, cap: c.bottom <= r.bottom + 1 }; });
    ok(f.top >= 0 && f.bottom <= f.vh && !f.scrolls && f.cap, `@1440 figure preview fits the viewport whole, caption included (${Math.round(f.top)}–${Math.round(f.bottom)} of ${f.vh})`);
    await page.close();
    const { page: p2 } = await open('metric/levi-civita-connection.html', 390, { hasTouch: true, isMobile: true });
    const y = p2.locator('a.dg-xref[data-label="eq_geodesic"]').first();
    await y.scrollIntoViewIfNeeded(); await y.tap();
    await waitPop(p2, t => t.length > 0); await p2.waitForTimeout(1200);
    const e = await p2.evaluate(() => { const p = document.getElementById('dg-pop'), r = p.getBoundingClientRect(), d = p.querySelector('.math.display'), dr = d.getBoundingClientRect();
      return { l: r.left, r: r.right, vw: innerWidth, inside: dr.left >= r.left - 1 && dr.right <= r.right + 1, bg: getComputedStyle(d).backgroundImage.split('gradient').length > 4 }; });
    ok(e.l >= 0 && e.r <= e.vw && e.inside && e.bg, `@390 equation preview: inside the viewport, the equation within the preview (scrolls there, with the edge shadow)`);
    await p2.close();
  }
  // R10c: search snippets never show raw TeX: short inline formulas typeset, others "[…]" or, when the match is
  // inside, their source in a monospace span
  {
    const { page, errors } = await open('metric/metric.html', 1280);
    for (const q of ['geodesic equation', 'frac lambda']) {
      await page.keyboard.press('/');
      await page.locator('.dg-search-input').fill(q);
      await page.waitForFunction(() => document.querySelectorAll('.dg-search-list [role="option"]').length > 0, null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(700);
      const r = await page.evaluate(() => {
        const ts = [...document.querySelectorAll('.dg-search-text')];
        const raw = ts.filter(t => { const c = t.cloneNode(true); c.querySelectorAll('mjx-container, code.dg-search-tex').forEach(n => n.remove()); return /\\[([\[]|\\(begin|end)\{/.test(c.textContent); });
        return { n: ts.length, raw: raw.map(t => t.textContent.slice(0, 80)), mjx: document.querySelectorAll('.dg-search-text mjx-container').length,
          code: document.querySelectorAll('.dg-search-text code.dg-search-tex').length, markInMath: document.querySelectorAll('.dg-search-text mjx-container mark').length };
      });
      ok(r.n > 0 && r.raw.length === 0 && r.markInMath === 0, `search "${q}": no raw TeX in the text lines (${r.n} lines, ${r.mjx} typeset formulas, ${r.code} TeX sources)${r.raw.length ? ': ' + r.raw.slice(0, 2).join(' | ') : ''}`);
      if (q === 'frac lambda') ok(r.code > 0, `search "${q}": a match inside a formula shows that formula's source in a monospace span`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    }
    ok(errors.length === 0, `search snippets: no console errors${errors.length ? ': ' + errors.slice(0, 3).join(' / ') : ''}`);
    await page.close();
  }
  // R10c (D44, D45 a): on every page at 1440 and 390 px, no rendered line of the notes' text begins with , . ; : ) ]
  // or a hyphen right after an inline formula or a reference (or with a footnote mark after one), and none ends
  // with a lone ( or [ before one; at 1440, no math in a sidenote is wider than the note unless it is in a scroll box,
  // and no two sidenotes overlap. D59: a display of the text is at the text size or shrunk to fit, never below 85 %,
  // and scrolls only at 85 %; math in a sidenote is shrunk to fit, never below 75 %, and scrolls only at 75 %.
  {
    const { coursePages, pool } = await import('./course_pages.mjs');
    const all = coursePages();
    const audit = () => {
      const main = document.getElementById('dg-main'), out = { breaks: [], notes: [], sizes: [] };
      // D59: the scale course.js applied (display: its font-size; inline: over MathJax's own size, data-dg-fs)
      const scaleOf = m => m.matches('.math.display') ? (parseFloat(m.style.fontSize) || 100) / 100
        : (parseFloat(m.style.fontSize) || 100) / (parseFloat(m.dataset.dgFs) || 100);
      const sizeRule = (m, floor, where) => {
        const s = scaleOf(m), scrolls = (m.matches('.math.display') || m.classList.contains('dg-math-wide')) && m.scrollWidth > m.clientWidth + 1;
        if (s < floor - 0.002) out.sizes.push(`${where}: math at ${s.toFixed(3)} < ${floor}`);
        if (scrolls && s > floor + 0.002) out.sizes.push(`${where}: math scrolls at ${s.toFixed(3)} before reaching ${floor}`);
      };
      for (const d of main.querySelectorAll('.math.display')) {
        if (d.closest('.dg-sidenotes, .dg-pop') || !d.getBoundingClientRect().width) continue;
        sizeRule(d, 0.85, 'text display');
      }
      const BLOCK = 'p, li, div, h1, h2, h3, figcaption, td, th, blockquote';
      const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      const skipText = n => n.parentElement.closest('.dg-open-here') || !n.data.length;
      const next = el => { let l = el; while (l.lastChild) l = l.lastChild; tw.currentNode = l; for (let n; (n = tw.nextNode());) { if (skipText(n)) continue; return n.parentElement.closest('mjx-container') ? null : n; } return null; };
      const prev = el => { tw.currentNode = el; for (let n; (n = tw.previousNode());) { if (skipText(n)) continue; return n.parentElement.closest('mjx-container') ? null : n; } return null; };
      const charRect = (n, i) => { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); return r.getClientRects()[0]; };
      const words = el => `"${(el.matches('mjx-container') ? (el.querySelector('mjx-assistive-mml')?.textContent || 'formula') : el.textContent).replace(/\s+/g, ' ').slice(0, 40)}"`;
      for (const el of main.querySelectorAll('mjx-container:not([display="true"]), a.dg-xref, span.dg-xref-pending, a.dg-cite')) {
        const web = el.closest('.dg-web');
        if ((web && !web.classList.contains('dg-sidenotes')) || (el.matches('a') && el.closest('mjx-container')) || el.closest('.math.display')) continue;
        const rects = el.getClientRects();
        if (!rects.length || !rects[0].width) continue;
        const block = el.closest(BLOCK);
        const n = next(el);
        if (n && n.parentElement.closest(BLOCK) === block && /^[,.;:)\]\-–—]/.test(n.data) || n && n.parentElement.closest('.dg-fnref') && n.parentElement.closest(BLOCK) === block) {
          const c = charRect(n, 0), a = rects[rects.length - 1];
          if (c && c.width && c.left < a.right - 3 && c.bottom > a.bottom + 2) out.breaks.push(`line begins with "${n.data.slice(0, 12)}" after ${words(el)}`);
        }
        const q = prev(el);
        if (q && q.parentElement.closest(BLOCK) === block && /[(\[]$/.test(q.data)) {
          const c = charRect(q, q.data.length - 1), a = rects[0];
          if (c && c.width && c.right > a.left + 3 && c.top < a.top - 2) out.breaks.push(`line ends with a lone "${q.data.slice(-1)}" before ${words(el)}`);
        }
      }
      let last = null;
      for (const note of main.querySelectorAll('.dg-sidenote')) {
        const r = note.getBoundingClientRect();
        if (!r.width) continue;
        if (last && r.top < last.bottom - 1) out.notes.push(`sidenote ${note.dataset.n} overlaps the one before`);
        last = r;
        for (const m of note.querySelectorAll('mjx-container, .math.display')) {
          const box = m.closest('.math.display') || (m.matches('mjx-container.dg-math-wide') ? m : null);
          const mr = (box || m).getBoundingClientRect();
          if (mr.right > r.right + 1 || mr.left < r.left - 1) out.notes.push(`sidenote ${note.dataset.n}: math wider than the note${box ? ' (its scroll box too)' : ''}`);
          if (m.matches('.math.display') || (m.matches('mjx-container') && !m.closest('.math.display'))) sizeRule(m, 0.75, `sidenote ${note.dataset.n}`);
        }
      }
      return out;
    };
    for (const width of [1440, 390]) {
      const res = await pool(all, 6, async slug => {
        const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 } });
        await page.goto(`${base}/${C}${slug}.html`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.classList.contains('dg-math-ready'), null, { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(600);
        const r = await page.evaluate(audit);
        await page.close();
        return [slug, r];
      });
      const breaks = res.filter(([, r]) => r.breaks.length), notes = res.filter(([, r]) => r.notes.length);
      ok(!breaks.length, `@${width} D44: no line of the notes' text begins with punctuation after a formula or reference, or ends with a lone bracket before one (${all.length} pages)${breaks.length ? ': ' + breaks.slice(0, 6).map(([s, r]) => `${s}: ${r.breaks.slice(0, 2).join('; ')}`).join(' | ') : ''}`);
      if (width >= 1000) ok(!notes.length, `@${width} D45: sidenote math stays within its note (or scrolls in its own box), no overlapping sidenotes${notes.length ? ': ' + notes.slice(0, 6).map(([s, r]) => `${s}: ${r.notes.slice(0, 2).join('; ')}`).join(' | ') : ''}`);
      const sizes = res.filter(([, r]) => r.sizes.length);
      ok(!sizes.length, `@${width} D59: displays at the text size or shrunk to fit (floor 85 %, sidenotes 75 %), scrolling only at the floor${sizes.length ? ': ' + sizes.slice(0, 6).map(([s, r]) => `${s}: ${r.sizes.slice(0, 2).join('; ')}`).join(' | ') : ''}`);
    }
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
  // phone: the course tree is a drawer, opened by the Contents button, closed by Escape
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html', 390);
    const btn = page.locator('.dg-bar-menu');
    const shown = () => page.evaluate(() => { const t = document.getElementById('dg-tree'), r = t.getBoundingClientRect(); return getComputedStyle(t).visibility === 'visible' && r.right > 50; });
    ok(await btn.isVisible() && !(await shown()), 'phone: Contents button shown, tree closed');
    ok(await page.evaluate(() => getComputedStyle(document.getElementById('dg-tree')).boxShadow) === 'none', 'phone: the closed drawer casts no shadow');
    await btn.click(); await page.waitForTimeout(400);
    ok(await shown() && (await btn.getAttribute('aria-expanded')) === 'true', 'phone: the Contents button opens the course tree');
    ok(await page.evaluate(() => document.getElementById('dg-tree').contains(document.activeElement)), 'phone: the focus moves into the open tree');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    ok(!(await shown()) && (await btn.getAttribute('aria-expanded')) === 'false', 'phone: Escape closes the course tree');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.matches('.dg-bar-menu')), 'phone: the focus returns to the Contents button');
    await page.close();
  }
  // wide screen: the tree is in the page, no Contents button; the outline follows the reading position
  {
    const { page } = await open('metric/length-geodesics.html', 1440);
    ok(!(await page.locator('.dg-bar-menu').isVisible()) && await page.locator('#dg-tree').isVisible(), '1440: course tree in the page, Contents button hidden');
    await page.evaluate(() => { const h = document.querySelector('#dg-main > h2[id]'); scrollTo(0, h.getBoundingClientRect().top + scrollY - 60); });
    await page.waitForTimeout(400);
    const spy = await page.evaluate(() => { const h = document.querySelector('#dg-main > h2[id]'), a = document.querySelector('.dg-tree-outline a.dg-on'); return [h.id, a && a.getAttribute('href')]; });
    ok(spy[1] === `#${spy[0]}`, `outline marks the heading being read (${spy[1]})`);
    await page.close();
  }
  // theme switch: flips data-theme and the choice persists across a reload
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html', 1280);
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme || 'light');
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const t0 = await theme(), b0 = await bg();
    await page.locator('.dg-bar [data-act="theme"]').click(); await page.waitForTimeout(200);
    const t1 = await theme();
    ok(t0 === 'light' && t1 === 'dark' && (await bg()) !== b0, `theme switch flips data-theme (${t0} -> ${t1}) and the page colours`);
    await load(page, 'vector-spaces/foundations-sets-maps.html');
    ok((await theme()) === 'dark', 'the theme choice persists across a reload');
    await page.locator('.dg-bar [data-act="theme"]').click();
    await page.close();
  }
  // keyboard: → goes to the next page, ← to the previous one
  {
    const { page } = await open('vector-spaces/foundations-sets-maps.html', 1280);
    await page.keyboard.press('ArrowRight');
    await page.waitForURL(/vectors-duals-tensors\.html$/, { timeout: 8000 }).catch(() => {});
    ok(/vectors-duals-tensors\.html$/.test(page.url()), '→ goes to the next page (2.2)');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('ArrowLeft');
    await page.waitForURL(/foundations-sets-maps\.html$/, { timeout: 8000 }).catch(() => {});
    ok(/foundations-sets-maps\.html$/.test(page.url()), '← goes back to the previous page (2.1)');
    await page.close();
  }
} catch (err) {
  ok(false, `exception: ${err.stack || err}`);
}

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PAGE-SCRIPT CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
