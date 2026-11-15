// Hand-written tool: screenshot a URL (or a file under docs/ served by a throw-away static server).
//   node _port/tools/shot.mjs <path-under-docs or http url> <out.png> [--width 1280] [--height 900] [--full] [--wait ms] [--selector css] [--scale 2]
// Prints console errors and failed requests of the page to stdout.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(REPO, '_port', '.work', 'pw');   // project-local browser
export const { chromium } = await import('playwright');   // after the env var is set
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i === -1 ? dflt : args[i + 1]; };
const [target, out] = args;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.gif': 'image/gif', '.pdf': 'application/pdf' };

export function serveDocs() {
  const root = path.join(REPO, 'docs');
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, base } = await serveDocs();
  const url = /^https?:/.test(target) ? target : base + '/' + target.replace(/^\/?(docs\/)?/, '');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +opt('width', 1280), height: +opt('height', 900) }, deviceScaleFactor: +opt('scale', 1) });
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  page.on('requestfailed', r => console.log('REQUEST FAILED:', r.url()));
  page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('dg-math-ready') || !window.MathJax, null, { timeout: 30000 }).catch(() => console.log('TIMEOUT waiting for math'));
  await page.waitForTimeout(+opt('wait', 300));
  const sel = opt('selector', null);
  if (sel) await page.locator(sel).first().screenshot({ path: out });
  else await page.screenshot({ path: out, fullPage: args.includes('--full') });
  console.log('math errors:', await page.locator('mjx-merror, [data-mjx-error]').count(), '| saved', out);
  await browser.close();
  server.close();
}
