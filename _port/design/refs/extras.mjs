// Second pass: targeted screenshots of a specific feature + a few DOM probes per content page.
//   node _port/design/refs/extras.mjs [key ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../tools/shot.mjs';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const T = {
  microbook: { url: 'https://darciogm.github.io/micro-book/cap01/maximizacao/', target: 'iframe.graph-iframe', shot: 'microbook-page-desktop-interactive.jpg' },
  distill: { url: 'https://distill.pub/2017/momentum/', target: 'margin', shot: 'distill-page-desktop-margin.jpg' },
  quantecon: { url: 'https://python.quantecon.org/linear_algebra.html', target: 'figure, img.align-center, .cell_output img', shot: 'quantecon-page-desktop-figure.jpg' },
  immersive: { url: 'https://immersivemath.com/ila/ch02_vectors/ch02.html', target: '#vectrans_canvas', shot: 'immersive-page-desktop-scrolled.jpg', wait: 15000 },
  d2l: { url: 'https://d2l.ai/chapter_linear-regression/linear-regression.html', target: 'figure, .figure', shot: 'd2l-page-desktop-figure.jpg' },
  ila: { url: 'https://textbooks.math.gatech.edu/ila/vectors.html', target: null, shot: null },
};
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(T);
const browser = await chromium.launch();
const res = {};
for (const k of keys) {
  const t = T[k];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(t.url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(t.wait || 2000);
  res[k] = await page.evaluate(() => {
    const cs = e => getComputedStyle(e);
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const o = {};
    // text right of the main column (margin notes)
    const main = [...document.querySelectorAll('p')].filter(vis).sort((a, b) => b.textContent.length - a.textContent.length)[0];
    const colR = main ? main.getBoundingClientRect().right : 0, colL = main ? main.getBoundingClientRect().left : 0;
    o.col = { left: Math.round(colL), right: Math.round(colR) };
    o.marginText = [...document.querySelectorAll('figcaption, aside, .marginnote, .sidenote, d-footnote, dt-fn, .margin, p, div')].filter(e => { const r = e.getBoundingClientRect(); return vis(e) && r.left >= colR + 10 && r.width > 80 && r.width < 400 && e.children.length < 6 && e.textContent.trim().length > 40; }).slice(0, 5).map(e => ({ tag: e.tagName.toLowerCase(), cls: (typeof e.className === 'string' ? e.className : '').slice(0, 40), left: Math.round(e.getBoundingClientRect().left), w: Math.round(e.getBoundingClientRect().width), y: Math.round(e.getBoundingClientRect().top + scrollY), fs: cs(e).fontSize, ff: cs(e).fontFamily.split(',')[0], text: e.textContent.trim().slice(0, 70) }));
    // footnotes
    const fn = document.querySelector('a.footnote-ref, a.footnote-reference, sup a[href^="#fn"], dt-fn, d-footnote');
    if (fn) o.footnoteRef = { tag: fn.tagName.toLowerCase(), cls: fn.className, href: fn.getAttribute('href'), title: fn.getAttribute('title'), text: fn.textContent.trim().slice(0, 30), dataAttrs: [...fn.attributes].map(a => a.name).join(',') };
    const fnl = document.querySelector('.footnote, .footnotes, aside.footnote-list, dl.footnote');
    if (fnl) o.footnoteList = { tag: fnl.tagName.toLowerCase(), cls: fnl.className, y: Math.round(fnl.getBoundingClientRect().top + scrollY), docH: document.documentElement.scrollHeight, text: fnl.textContent.trim().slice(0, 80) };
    // details / collapsibles
    o.details = [...document.querySelectorAll('details, .dropdown, .admonition, .knowl, a[data-knowl], [class*=collaps], .toggle')].slice(0, 6).map(e => ({ tag: e.tagName.toLowerCase(), cls: (typeof e.className === 'string' ? e.className : '').slice(0, 50), open: e.open, summary: (e.querySelector('summary, .admonition-title, .knowl-title') || e).textContent.trim().slice(0, 50) }));
    o.knowls = document.querySelectorAll('[data-knowl], .knowl').length;
    // figures
    o.figs = [...document.querySelectorAll('figure, .figure, img')].filter(vis).filter(e => e.getBoundingClientRect().width > 150).slice(0, 4).map(e => { const cap = e.querySelector?.('figcaption, .caption') || e.nextElementSibling; return { tag: e.tagName.toLowerCase(), cls: (typeof e.className === 'string' ? e.className : '').slice(0, 40), w: Math.round(e.getBoundingClientRect().width), left: Math.round(e.getBoundingClientRect().left), caption: cap ? cap.textContent.trim().slice(0, 80) : null, capFs: cap ? cs(cap).fontSize : null, capAlign: cap ? cs(cap).textAlign : null, inLink: !!e.closest('a') }; });
    // links to references / hover
    o.citeSample = [...document.querySelectorAll('a[href*="#"]')].filter(a => /\(\d|\[\d|\d\.\d/.test(a.textContent)).slice(0, 3).map(a => ({ text: a.textContent.trim().slice(0, 20), cls: a.className, title: a.getAttribute('title'), href: a.getAttribute('href') }));
    o.tippy = document.querySelectorAll('[data-tippy-content], [aria-describedby*=tippy], .tippy-box').length;
    o.buttonsText = [...document.querySelectorAll('button, [role=button], label.md-header__button, a.headerbtn')].filter(vis).map(b => (b.getAttribute('aria-label') || b.title || b.textContent).trim().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean).slice(0, 25);
    o.colorScheme = document.body.getAttribute('data-md-color-scheme') || document.documentElement.getAttribute('data-theme') || document.documentElement.getAttribute('data-mode') || null;
    o.eqOverflow = [...document.querySelectorAll('mjx-container[display=true], .katex-display, .MathJax_Display, div.math')].slice(0, 2).map(e => ({ ov: cs(e).overflowX, pov: cs(e.parentElement).overflowX, pcls: e.parentElement.className }));
    return o;
  });
  if (t.shot) {
    if (t.target === 'margin') {
      const y = res[k].marginText[1]?.y ?? res[k].marginText[0]?.y;
      if (y) await page.evaluate(y => window.scrollTo(0, y - 300), y);
    } else {
      await page.evaluate(q => { const e = [...document.querySelectorAll(q)].find(e => e.getBoundingClientRect().width > 150 && e.getBoundingClientRect().top + scrollY > 400); if (e) e.scrollIntoView({ block: 'center' }); }, t.target);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, t.shot), type: 'jpeg', quality: 70 });
  }
  await page.close();
  console.log(k, JSON.stringify(res[k], null, 0).slice(0, 4000));
}
fs.writeFileSync(path.join(OUT, 'data', 'extras.json'), JSON.stringify(res, null, 1));
await browser.close();
