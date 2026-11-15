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
// Links (in-page and cross-page, with fragments) are checked statically by links_check.py.
// Output: a three-line weight summary (largest page per class), then one line per failing page.
import { chromium, serveDocs } from './shot.mjs';
import { selectPages, pool, ready, url, hasFlag } from './course_pages.mjs';

const args = process.argv.slice(2);
const jobs = +(args[args.indexOf('--jobs') + 1] || 0) || 6;
const verbose = hasFlag(args, '--verbose');
const pages = selectPages(args);
const KB = 1000;
const BUDGET = { own: 700 * KB, img: 500 * KB, imgWide: 900 * KB, imgAll: 2000 * KB, third: 1600 * KB };   // DECISIONS D42
const KNOWN_HOSTS = new Set(['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']);

const { server, base: base0 } = await serveDocs();
const base = base0.replace('127.0.0.1', 'localhost');
const origin = new URL(base).origin;
const browser = await chromium.launch();
const t0 = Date.now();

const fmt = b => b >= 1e6 ? (b / 1e6).toFixed(2) + ' MB' : Math.round(b / KB) + ' kB';

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
    return { slug, sum, wide: info.wide, hosts: [...hosts], problems };
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
const bad = results.filter(r => r.problems.length);
for (const r of bad) console.log(`FAIL ${r.slug}: ${[...new Set(r.problems)].join(' | ')}`);
console.log(`${results.length - bad.length} of ${results.length} pages pass (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(bad.length ? 1 : 0);
