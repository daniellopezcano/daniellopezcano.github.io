#!/usr/bin/env node
// Hand-written tool: typeset time of the course pages in a headless browser, to compare math engines
// (DECISIONS D34). Each LABEL=DIR is a rendered site (a docs/ tree, e.g. a copy built with another
// MathJax) served on its own local port; every page is loaded once per site to warm the HTTP cache
// (so the network is excluded: own files are served with Cache-Control max-age, the CDN's are
// cacheable), then RUNS times per site, interleaved, and the time from navigation start to the class
// dg-math-ready on <html> (set by mathjax-config.js after the first typeset) is recorded.
//
//   node _port/tools/math_timing.mjs [--runs 3] [--pages 12 | --pages all | --page path ...] LABEL=DIR [LABEL=DIR ...]
//   e.g. node _port/tools/math_timing.mjs mj3=_port/.work/r6/docs3 mj4=docs
//
// Pages: by default the 5 with the most equations (from _port/.work/report.json) plus pages spread
// over the rest of the ranking, 12 in all. Prints a table of medians (ms) and, with two or more
// sites, the ratio of each site to the first; --max-ratio R makes the exit code 1 if any ratio > R.
// A run that reaches the 8 s fallback of mathjax-config.js (MathJax never finished) is marked '!'.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(REPO, '_port', '.work', 'pw');
const { chromium } = await import('playwright');
const COURSE = 'notes/diffgeo-gr';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const opts = { runs: 3, pages: '12', page: [], maxRatio: null, sites: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--runs') opts.runs = +argv[++i];
  else if (a === '--pages') opts.pages = argv[++i];
  else if (a === '--page') opts.page.push(argv[++i].replace(/^\/?(docs\/)?/, ''));
  else if (a === '--max-ratio') opts.maxRatio = +argv[++i];
  else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport')[0]); process.exit(0); }
  else if (/^[\w.-]+=/.test(a)) { const [label, dir] = a.split(/=(.*)/s); opts.sites.push({ label, root: path.resolve(REPO, dir) }); }
  else { console.error(`unknown argument ${a}`); process.exit(2); }
}
if (!opts.sites.length) { console.error('give at least one LABEL=DIR (see --help)'); process.exit(2); }

// ---------------------------------------------------------------- pages
function equationCounts() {
  const report = path.join(REPO, '_port', '.work', 'report.json');
  if (!fs.existsSync(report)) { console.error(`missing ${report}: run python3 _port/convert/build.py first`); process.exit(2); }
  const n = new Map();
  for (const { page } of JSON.parse(fs.readFileSync(report, 'utf8')).math) n.set(page, (n.get(page) || 0) + 1);
  return n;
}
function pageFile(key) {           // report keys are like 'metric/length-geodesics' or 'metric' (chapter page)
  const a = `${COURSE}/${key}.html`, b = `${COURSE}/${key}/index.html`;
  return fs.existsSync(path.join(opts.sites[0].root, a)) ? a : b;
}
const counts = equationCounts();
let pages;
if (opts.page.length) pages = opts.page.map((p) => ({ file: p, n: null }));
else {
  const ranked = [...counts].sort((x, y) => y[1] - x[1]).map(([k, n]) => ({ file: pageFile(k), n }));
  if (opts.pages === 'all') pages = ranked;
  else {
    const want = Math.max(5, +opts.pages), top = ranked.slice(0, 5), rest = ranked.slice(5);
    const k = want - 5, picked = [];
    for (let i = 0; i < k && rest.length; i++) picked.push(rest[Math.round(i * (rest.length - 1) / Math.max(1, k - 1))]);
    pages = [...top, ...new Set(picked)];
  }
}
pages = pages.filter((p) => opts.sites.every((s) => fs.existsSync(path.join(s.root, p.file))));

// ---------------------------------------------------------------- servers
function serve(root) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'max-age=3600' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, base: `http://127.0.0.1:${server.address().port}/` })));
}

// ---------------------------------------------------------------- measuring
// Records performance.now() (ms since navigation start) when <html> first gets dg-math-ready.
// Init scripts run before <html> exists, so the observer watches the document itself.
const PROBE = `(() => {
  const mark = () => { const h = document.documentElement;
    if (window.__dgReady == null && h && h.classList.contains('dg-math-ready')) window.__dgReady = performance.now(); };
  new MutationObserver(mark).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
})();`;

async function measure(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__dgReady != null, null, { timeout: 60000, polling: 50 });
  const t = await page.evaluate(() => window.__dgReady);
  await page.waitForLoadState('networkidle').catch(() => {});
  return t;
}

const browser = await chromium.launch();
for (const s of opts.sites) {
  Object.assign(s, await serve(s.root));
  s.ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await s.ctx.addInitScript(PROBE);
  s.page = await s.ctx.newPage();
}
const median = (xs) => { const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const rows = [];
for (const p of pages) {
  for (const s of opts.sites) await measure(s.page, s.base + p.file);          // warm the cache
  const times = Object.fromEntries(opts.sites.map((s) => [s.label, []]));
  for (let r = 0; r < opts.runs; r++) for (const s of opts.sites) times[s.label].push(await measure(s.page, s.base + p.file));
  rows.push({ ...p, times });
}
await browser.close();
for (const s of opts.sites) s.server.close();

// ---------------------------------------------------------------- report
const labels = opts.sites.map((s) => s.label);
const ref = labels[0];
let worst = 0;
const head = ['page', 'eqs', ...labels.map((l) => `${l} ms`), ...labels.slice(1).map((l) => `${l}/${ref}`)];
console.log(head.join('\t'));
for (const r of rows) {
  const med = labels.map((l) => median(r.times[l]));
  const ratios = med.slice(1).map((m) => m / med[0]);
  worst = Math.max(worst, ...ratios, 0);
  const flag = (l) => (r.times[l].some((t) => t >= 7990) ? '!' : '');
  console.log([r.file.replace(`${COURSE}/`, ''), r.n ?? '', ...labels.map((l, i) => Math.round(med[i]) + flag(l)), ...ratios.map((x) => x.toFixed(2))].join('\t'));
}
if (labels.length > 1) console.log(`worst ratio to ${ref}: ${worst.toFixed(2)} (${rows.length} pages, median of ${opts.runs} runs)`);
if (opts.maxRatio != null && worst > opts.maxRatio) process.exit(1);
