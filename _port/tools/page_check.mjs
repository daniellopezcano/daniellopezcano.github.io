// Hand-written tool (DECISIONS D37, DESIGN § 4): the all-pages browser pass and the weight budget per page,
// on the rendered site in docs/ (served by a throw-away static server; MathJax and Lato come from their CDNs).
//   node _port/tools/page_check.mjs [--page <slug>]... [--jobs N] [--verbose]     (exit code 0 = all passed)
// For every course page (or the --page ones; a slug such as metric/length-geodesics, 'index' for the landing
// page, or a prefix ending in '/'):
//   * weight: loaded once at 1440×900 with an empty cache and no interaction, until the math is typeset
//     (html.dg-math-ready) and the network is idle; decoded body bytes summed by class:
//       own   = HTML + CSS + JS + fonts + data from the site            ≤ 700 kB
//       img   = images from the site loaded before any interaction       ≤ 500 kB (landing, chapter opening pages ≤ 900 kB)
//               (all of them: an <img loading="lazy"> that the browser fetches ahead of the viewport by its own
//               heuristic is downloaded all the same; how much of the total that is, is printed as "lazy")
//       third = everything off-site (MathJax and its fonts, Lato, …)     ≤ 1.6 MB
//     third-party hosts other than cdn.jsdelivr.net / fonts.googleapis.com / fonts.gstatic.com are listed.
//     Each URL counts once (a file requested twice, e.g. as <img> and by fetch(), is the same bytes).
//   * no console error, page error, failed request or HTTP status ≥ 400 (at 1440, 1280 and 390 px);
//   * no horizontal page overflow at 1280 and 390 px (documentElement.scrollWidth − innerWidth ≤ 1);
//   * every <img> has alt and explicit width and height attributes; no id twice in the page.
//   * (unit B7, at 1440 after the math is typeset) MathJax typeset everything: no error node, no undefined
//     macro, no .math element of <main> without output, no \( \) \[ \] left as text in <main> (code, pre, …
//     excepted); every in-page link (href="#…", links made by the page script included) has its id in the live
//     DOM, and every same-course link with a fragment has it in the live DOM of its target page when that page
//     is checked in the same run (links_check.py checks all links statically, before scripts); focusing the
//     first visible reference (a.dg-xref) of <main> opens its preview; every interactive frame
//     (.dg-interactive[data-module]) scrolled into view becomes .dg-ready (a module error is a console error).
//   * (D56, once per run) the interactive modules on disk, docs/notes/diffgeo-gr/assets/interactive/*.js (raw bytes):
//     dg.js (the shared library) <= 50 kB, every other module <= 20 kB.
// Output: a three-line weight summary (largest page per class), then one line per failing page.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, serveDocs } from './shot.mjs';
import { REPO, COURSE, selectPages, pool, ready, url, hasFlag } from './course_pages.mjs';

const args = process.argv.slice(2);
const jobs = +(args[args.indexOf('--jobs') + 1] || 0) || 6;
const verbose = hasFlag(args, '--verbose');
const pages = selectPages(args);
const KB = 1000;
const BUDGET = { own: 700 * KB, img: 500 * KB, imgWide: 900 * KB, imgAll: 2000 * KB, third: 1600 * KB };   // DECISIONS D42
const MODULE_BUDGET = { 'dg.js': 50 * KB, other: 20 * KB };                                             // DECISIONS D56
const KNOWN_HOSTS = new Set(['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']);

const { server, base: base0 } = await serveDocs();
const base = base0.replace('127.0.0.1', 'localhost');
const origin = new URL(base).origin;
const browser = await chromium.launch();
const t0 = Date.now();

const fmt = b => b >= 1e6 ? (b / 1e6).toFixed(2) + ' MB' : Math.round(b / KB) + ' kB';

// Runs in the page after the math is typeset (unit B7). Returns
//   mathErr: MathJax error nodes (merror / data-mjx-error), and undefined macros, which MathJax's noundefined
//            package sets as red text instead of an error; untyped: .math elements of <main> without output;
//   raw:     \( \) \[ \] left as text in <main> (outside the tags MathJax skips: code, pre, script, …);
//   missing: in-page links (href="#…", anywhere in the page, links made by the page script included) whose id
//            is not in the live DOM;
//   ids / out: every id of the page, and its same-course links with a fragment to another page (checked
//            against that page's live ids once all pages ran).
function liveDom() {
  const COURSE = '/notes/diffgeo-gr/';
  const out = { mathErr: [], untyped: 0, raw: [], missing: [], ids: [], out: [], formulas: 0 };
  const short = s => s.replace(/\s+/g, ' ').trim().slice(0, 60);
  for (const e of document.querySelectorAll('mjx-merror, .MathJax_Error, [data-mjx-error]')) out.mathErr.push(short(e.getAttribute('data-mjx-error') || e.textContent));
  const doc = window.MathJax && MathJax.startup && MathJax.startup.document;
  if (doc && doc.math) for (const m of doc.math) {
    if (!m.root || !m.root.walkTree) continue;
    out.formulas++;
    m.root.walkTree(n => {
      if (n.isKind('merror')) out.mathErr.push(short(m.math));
      else if (n.isKind('mtext') && n.attributes.get('mathcolor') === 'red') {
        const t = n.childNodes.map(c => (c.getText ? c.getText() : '')).join('');
        if (t.startsWith('\\')) out.mathErr.push(`undefined ${t} in ${short(m.math)}`);
      }
    });
  }
  const main = document.querySelector('main');
  if (main) {
    out.untyped = [...main.querySelectorAll('.math')].filter(e => !e.querySelector('mjx-container')).length;
    const SKIP = 'script, noscript, style, textarea, pre, code, annotation, annotation-xml, template, mjx-container';
    const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      if (!/\\[()[\]]/.test(n.data) || n.parentElement.closest(SKIP)) continue;
      out.raw.push(short(n.data.slice(Math.max(0, n.data.search(/\\[()[\]]/) - 20))));
    }
  }
  const has = id => !!(document.getElementById(id) || document.getElementsByName(id).length);
  for (const e of document.querySelectorAll('[id]')) out.ids.push(e.id);
  for (const e of document.querySelectorAll('a[name]')) out.ids.push(e.name);
  for (const a of document.querySelectorAll('a[href]')) {
    const raw = a.getAttribute('href');
    if (!raw.includes('#') || /^(mailto|javascript|data):/.test(raw)) continue;
    const u = new URL(raw, location.href), id = decodeURIComponent(u.hash.slice(1));
    if (!id) continue;
    if (u.origin === location.origin && u.pathname === location.pathname) { if (!has(id)) out.missing.push(raw); }
    else if (u.origin === location.origin && u.pathname.startsWith(COURSE)) {
      let p = u.pathname.slice(COURSE.length);
      if (p === '' || p.endsWith('/')) p += 'index.html';
      out.out.push({ href: raw, page: p.replace(/\.html$/, ''), id });
    }
  }
  return out;
}

async function checkPage(slug) {
  const problems = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });   // fresh: empty cache
  const page = await context.newPage();
  let phase = '1440';
  page.on('console', m => { if (m.type() === 'error') problems.push(`console error at ${phase}: ${m.text().slice(0, 160)}`); });
  page.on('pageerror', e => problems.push(`page error at ${phase}: ${e.message.slice(0, 160)}`));
  page.on('requestfailed', r => { const f = r.failure(); if (!(f && /ERR_ABORTED/.test(f.errorText) && phase !== '1440')) problems.push(`request failed at ${phase}: ${r.url()} (${f && f.errorText})`); });
  const bodies = [];
  page.on('response', r => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} at ${phase}: ${r.url()}`);
    if (phase !== '1440') return;
    bodies.push((async () => {
      const u = new URL(r.url());
      if (u.protocol === 'data:' || (r.status() >= 300 && r.status() < 400)) return null;
      const len = await r.body().then(b => b.length, () => 0);
      const type = (r.headers()['content-type'] || '').split(';')[0];
      const cls = u.origin !== origin ? 'third' : (/^image\//.test(type) ? 'img' : 'own');
      return { cls, len, host: u.host, url: r.url(), rtype: r.request().resourceType() };
    })());
  });
  try {
    // 1. 1440×900, empty cache: weight, images, ids
    await page.goto(url(base, slug), { waitUntil: 'networkidle', timeout: 60000 });
    if (!(await ready(page))) problems.push('math never ready at 1440');
    const info = await page.evaluate(() => {
      const ids = {}; for (const e of document.querySelectorAll('[id]')) ids[e.id] = (ids[e.id] || 0) + 1;
      return {
        lazy: [...document.querySelectorAll('img[loading="lazy"]')].map(i => i.currentSrc || i.src),
        wide: document.body.classList.contains('dg-page-landing') || document.body.classList.contains('dg-page-chapter'),
        dup: Object.entries(ids).filter(([, n]) => n > 1).map(([k, n]) => `${k}×${n}`),
        imgs: [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt') || !i.getAttribute('width') || !i.getAttribute('height'))
          .map(i => (i.getAttribute('src') || '').split('/').pop() + ' [' + ['alt', 'width', 'height'].filter(a => !(a === 'alt' ? i.hasAttribute(a) : i.getAttribute(a))).join(',') + ' missing]'),
      };
    });
    phase = 'done-1440';
    const res = (await Promise.all(bodies)).filter(Boolean);
    const sum = { own: 0, img: 0, lazy: 0, third: 0 };
    const hosts = new Set(), byUrl = new Map(), lazySet = new Set(info.lazy);
    for (const r of res) {
      const o = byUrl.get(r.url) || { ...r, types: new Set() };
      o.len = Math.max(o.len, r.len); o.types.add(r.rtype); byUrl.set(r.url, o);
    }
    for (const r of byUrl.values()) {
      sum[r.cls] += r.len;
      if (r.cls === 'img' && lazySet.has(r.url) && [...r.types].every(t => t === 'image')) sum.lazy += r.len;
      if (r.cls === 'third' && !KNOWN_HOSTS.has(r.host)) hosts.add(r.host);
    }
    const imgBudget = info.wide ? BUDGET.imgWide : BUDGET.img;
    if (sum.own > BUDGET.own) problems.push(`own bytes ${fmt(sum.own)} > ${fmt(BUDGET.own)}`);
    // D42: the budget is on images that are not lazy; lazy ones the browser fetches ahead only have a ceiling
    if (sum.img - sum.lazy > imgBudget) problems.push(`eager images ${fmt(sum.img - sum.lazy)} > ${fmt(imgBudget)}`);
    if (sum.img > BUDGET.imgAll) problems.push(`all images before interaction ${fmt(sum.img)} > ${fmt(BUDGET.imgAll)}`);
    if (sum.third > BUDGET.third) problems.push(`third-party ${fmt(sum.third)} > ${fmt(BUDGET.third)}`);
    if (info.dup.length) problems.push(`duplicate ids: ${info.dup.slice(0, 6).join(', ')}${info.dup.length > 6 ? ', …' : ''}`);
    if (info.imgs.length) problems.push(`img without alt/width/height: ${info.imgs.slice(0, 4).join('; ')}`);
    if (verbose) console.log(`  ${slug}: own ${fmt(sum.own)}, img ${fmt(sum.img)} (lazy ${fmt(sum.lazy)}), third ${fmt(sum.third)}`);

    // 1b. still at 1440, after scripts ran (unit B7): math, live links, one preview, interactive frames
    phase = 'checks';
    const live = await page.evaluate(liveDom);
    if (live.mathErr.length) problems.push(`math errors: ${[...new Set(live.mathErr)].slice(0, 3).join('; ')}`);
    if (live.untyped) problems.push(`${live.untyped} .math element(s) in <main> not typeset`);
    if (live.raw.length) problems.push(`raw TeX left in <main>: ${live.raw.slice(0, 3).join('; ')}`);
    if (live.missing.length) problems.push(`in-page link to a missing id: ${[...new Set(live.missing)].slice(0, 4).join(', ')}`);
    const xref = page.locator('main a.dg-xref[href]:visible').first();
    if (await xref.count()) {
      const label = (await xref.getAttribute('data-label')) || (await xref.getAttribute('href'));
      await xref.focus();
      const shown = await page.waitForFunction(() => { const p = document.getElementById('dg-pop'); return p && !p.hidden && p.textContent.trim().length > 0; }, null, { timeout: 8000 })
        .then(() => true, () => false);
      if (!shown) problems.push(`no preview on focusing the first reference (${label})`);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
    }
    const frames = await page.$$eval('.dg-interactive[data-module]', fs => fs.map(f => f.dataset.module));
    for (let i = 0; i < frames.length; i++) {
      const frame = (await page.$$('.dg-interactive[data-module]'))[i];
      await frame.evaluate(f => f.scrollIntoView({ block: 'center' }));
      const ok = await page.waitForFunction(f => f.classList.contains('dg-ready'), frame, { timeout: 20000 }).then(() => true, () => false);
      if (!ok) problems.push(`interactive "${frames[i]}" never ready`);
    }
    if (verbose) console.log(`  ${slug}: ${live.formulas} formulas, ${live.ids.length} ids, ${live.out.length} links to other pages, frames [${frames.join(', ')}]`);
    phase = 'done-checks';

    // 2./3. 1280 and 390 px (cache now warm): no horizontal page overflow
    for (const w of [1280, 390]) {
      phase = String(w);
      await page.setViewportSize({ width: w, height: w < 600 ? 844 : 900 });
      await page.goto(url(base, slug), { waitUntil: 'networkidle', timeout: 60000 });
      if (!(await ready(page))) problems.push(`math never ready at ${w}`);
      const over = await page.evaluate(() => {
        const W = innerWidth, d = document.documentElement.scrollWidth - W;
        if (d <= 1) return null;
        // the outermost element that sticks out on the right and is not clipped by a scrolling/clipping box
        let worst = null;
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          if (!(b.width > 0 && b.right > W + 1)) continue;
          let a = el.parentElement, clipped = false;
          for (; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible' && a.getBoundingClientRect().right <= W + 1) { clipped = true; break; }
          if (clipped || (el.parentElement && el.parentElement !== document.body && el.parentElement.getBoundingClientRect().right > W + 1)) continue;
          worst = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ` (right edge ${Math.round(b.right)} px)`;
          break;
        }
        return `${d} px` + (worst ? `, from ${worst}` : '');
      });
      if (over) problems.push(`page scrolls sideways at ${w} px by ${over}`);
    }
    phase = 'end';
    return { slug, sum, wide: info.wide, hosts: [...hosts], problems, ids: new Set(live.ids), out: live.out };
  } catch (e) {
    problems.push(`check crashed: ${e.message.split('\n')[0]}`);
    return { slug, sum: { own: 0, img: 0, lazy: 0, third: 0 }, hosts: [], problems };
  } finally {
    await context.close();
  }
}

let results;
try {
  results = await pool(pages, jobs, checkPage);
} finally {
  await browser.close();
  server.close();
}

const max = cls => results.reduce((m, r) => (r.sum[cls] > m.sum[cls] ? r : m), results[0]);
const mo = max('own'), mi = max('img'), mt = max('third'), ml = max('lazy');
const iw = results.filter(r => !r.wide), ib = iw.length ? iw.reduce((m, r) => (r.sum.img > m.sum.img ? r : m), iw[0]) : null;
console.log(`weight (${results.length} pages, 1440×900, empty cache, decoded bytes):`);
console.log(`  own (HTML+CSS+JS+fonts) max ${fmt(mo.sum.own)} on ${mo.slug}   (budget ${fmt(BUDGET.own)})`);
console.log(`  images                  max ${fmt(mi.sum.img)} on ${mi.slug}` + (ib && ib !== mi ? `; section pages max ${fmt(ib.sum.img)} on ${ib.slug}` : '') + `   (budget ${fmt(BUDGET.img)}, landing/chapter ${fmt(BUDGET.imgWide)})`);
console.log(`    of which <img loading="lazy"> fetched ahead by the browser: max ${fmt(ml.sum.lazy)} on ${ml.slug}`);
console.log(`  third-party             max ${fmt(mt.sum.third)} on ${mt.slug}   (budget ${fmt(BUDGET.third)})`);
const hosts = [...new Set(results.flatMap(r => r.hosts))];
console.log(`  third-party hosts other than jsdelivr / Google Fonts: ${hosts.length ? hosts.join(', ') : 'none'}`);
// same-course links with a fragment to another page: the id must exist in that page's live DOM (when that page
// was checked in this run; the others are left to links_check.py, which checks every link statically)
const liveIds = new Map(results.filter(r => r.ids).map(r => [r.slug, r.ids]));
for (const r of results) {
  const miss = (r.out || []).filter(l => liveIds.has(l.page) && !liveIds.get(l.page).has(l.id)).map(l => l.href);
  if (miss.length) r.problems.push(`link to a missing id on another page: ${[...new Set(miss)].slice(0, 4).join(', ')}`);
}
const bad = results.filter(r => r.problems.length);
for (const r of bad) console.log(`FAIL ${r.slug}: ${[...new Set(r.problems)].join(' | ')}`);
// interactive modules on disk (D56): raw size of each .js under assets/interactive/
const IDIR = path.join(REPO, 'docs', COURSE, 'assets', 'interactive');
const mods = fs.existsSync(IDIR) ? fs.readdirSync(IDIR).filter(f => f.endsWith('.js')).sort().map(f => [f, fs.statSync(path.join(IDIR, f)).size]) : [];
const over = mods.filter(([f, n]) => n > (MODULE_BUDGET[f] || MODULE_BUDGET.other));
console.log(`interactive modules (raw, on disk; dg.js <= ${fmt(MODULE_BUDGET['dg.js'])}, others <= ${fmt(MODULE_BUDGET.other)}): ${mods.map(([f, n]) => `${f} ${(n / KB).toFixed(1)} kB`).join(', ')}`);
for (const [f, n] of over) console.log(`FAIL module budget: ${f} is ${(n / KB).toFixed(1)} kB > ${fmt(MODULE_BUDGET[f] || MODULE_BUDGET.other)}`);
console.log(`${results.length - bad.length} of ${results.length} pages pass (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(bad.length || over.length ? 1 : 0);
