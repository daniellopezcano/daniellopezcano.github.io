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
