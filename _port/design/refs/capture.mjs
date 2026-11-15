// Reference-site study: screenshots + computed-style measurements of public pages.
//   node _port/design/refs/capture.mjs [siteKey ...]
// Writes <key>-*.jpg and data/<key>.json next to this file. Plain visits, default browser settings.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../tools/shot.mjs';

const OUT = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });

const SITES = {
  microbook: { home: 'https://darciogm.github.io/micro-book/', page: 'https://darciogm.github.io/micro-book/cap01/maximizacao/' },
  ila: { home: 'https://textbooks.math.gatech.edu/ila/', page: 'https://textbooks.math.gatech.edu/ila/vectors.html' },
  immersive: { home: 'https://immersivemath.com/ila/', page: 'https://immersivemath.com/ila/ch02_vectors/ch02.html' },
  distill: { home: 'https://distill.pub/', page: 'https://distill.pub/2017/momentum/' },
  seeing: { home: 'https://seeing-theory.brown.edu/', page: 'https://seeing-theory.brown.edu/basic-probability/index.html' },
  feynman: { home: 'https://www.feynmanlectures.caltech.edu/', page: 'https://www.feynmanlectures.caltech.edu/I_04.html' },
  d2l: { home: 'https://d2l.ai/', page: 'https://d2l.ai/chapter_linear-regression/linear-regression.html' },
  quantecon: { home: 'https://python.quantecon.org/', page: 'https://python.quantecon.org/linear_algebra.html' },
};

const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SITES);
const browser = await chromium.launch();

function kind(type, url, mime) {
  if (type === 'Document') return 'html';
  if (type === 'Stylesheet') return 'css';
  if (type === 'Script') return 'js';
  if (type === 'Font') return 'fonts';
  if (type === 'Image' || type === 'Media') return 'images';
  if (/font|woff|ttf|otf/.test(mime || '') || /\.(woff2?|ttf|otf)(\?|$)/.test(url)) return 'fonts';
  return 'other';
}

async function visit(url, { width, height, track = false }) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const net = new Map();
  const fontUrls = [];
  let cdp;
  if (track) {
    cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.responseReceived', e => { net.set(e.requestId, { url: e.response.url, type: e.type, mime: e.response.mimeType, bytes: 0, status: e.response.status }); });
    cdp.on('Network.loadingFinished', e => { const r = net.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
  }
  const t0 = Date.now();
  let loadMs = null, error = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    loadMs = Date.now() - t0;
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  } catch (e) { error = String(e.message).split('\n')[0]; }
  await page.waitForTimeout(1500);
  let netSummary = null;
  if (track) {
    const by = {}; let total = 0;
    for (const r of net.values()) {
      const k = kind(r.type, r.url, r.mime);
      by[k] ||= { n: 0, bytes: 0 }; by[k].n++; by[k].bytes += r.bytes; total += r.bytes;
      if (k === 'fonts') fontUrls.push(r.url);
      if (k === 'other' && r.bytes > 20000) (by.otherBig ||= []).push(r.url.slice(0, 120) + ' ' + r.bytes);
      if (r.bytes > 150000) (by.big ||= []).push(r.url.slice(0, 120) + ' ' + r.bytes);
    }
    netSummary = { requests: net.size, totalBytes: total, by, fontUrls, loadMs, finalUrl: page.url() };
  }
  return { ctx, page, error, loadMs, netSummary };
}

// ---------- in-page probes ----------
const MEASURE = () => {
  const cs = el => getComputedStyle(el);
  const firstFam = f => (f || '').split(',')[0].trim().replace(/["']/g, '');
  const vis = el => { const r = el.getBoundingClientRect(); const s = cs(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const rect = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  const out = {};
  out.title = document.title;
  out.viewport = { w: innerWidth, h: innerHeight };
  // typical paragraph: longest of the first visible paragraphs with >300 chars
  const okP = (p, n) => vis(p) && p.textContent.trim().length > n && !p.closest('nav,header,footer,aside');
  let ps = [...document.querySelectorAll('p')].filter(p => okP(p, 300));
  if (!ps.length) ps = [...document.querySelectorAll('p')].filter(p => okP(p, 150));
  if (!ps.length) ps = [...document.querySelectorAll('div, td, li')].filter(d => vis(d) && [...d.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim().length > 150);
  const p = ps.slice(0, 12).sort((a, b) => b.textContent.length - a.textContent.length)[Math.min(2, ps.length - 1)] || ps[0];
  if (p) {
    const s = cs(p);
    const range = document.createRange(); range.selectNodeContents(p);
    const rects = [...range.getClientRects()];
    const tops = [...new Set(rects.map(r => Math.round(r.top)))].sort((a, b) => a - b);
    // merge tops within 4px
    const lines = []; for (const t of tops) if (!lines.length || t - lines[lines.length - 1] > 4) lines.push(t);
    const nLines = lines.length || 1;
    const txt = p.textContent.replace(/\s+/g, ' ').trim();
    let bg = null; for (let e = p; e; e = e.parentElement) { const b = cs(e).backgroundColor; if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') { bg = b; break; } }
    // column = nearest ancestor that is a block wider than p or equal (main text container)
    let col = p.parentElement; while (col && col.parentElement && Math.abs(col.parentElement.getBoundingClientRect().width - p.getBoundingClientRect().width) < 2) col = col.parentElement;
    // plain text (math removed) and canvas-measured average glyph width -> characters per full line
    const clone = p.cloneNode(true);
    clone.querySelectorAll('mjx-container, .MathJax, .MathJax_SVG, .MathJax_Preview, .katex, script, math, d-math, svg').forEach(e => e.replaceWith(' x '));
    const plain = clone.textContent.replace(/\s+/g, ' ').trim();
    const ctx2 = document.createElement('canvas').getContext('2d');
    ctx2.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const avgW = ctx2.measureText(plain).width / Math.max(1, plain.length);
    const padL = parseFloat(s.paddingLeft) || 0, padR = parseFloat(s.paddingRight) || 0;
    // line count from text nodes only (math ignored)
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const tops2 = []; for (let n; (n = tw.nextNode());) { if (n.parentElement.closest('mjx-container, .MathJax, .MathJax_SVG, .katex, sup, sub')) continue; const r2 = document.createRange(); r2.selectNodeContents(n); for (const rr of r2.getClientRects()) tops2.push(Math.round(rr.bottom)); }
    tops2.sort((a, b) => a - b); const lines2 = []; for (const t of tops2) if (!lines2.length || t - lines2[lines2.length - 1] > parseFloat(s.fontSize) * 0.8) lines2.push(t);
    out.body = {
      cplCanvas: Math.round((p.getBoundingClientRect().width - padL - padR) / avgW), avgGlyphPx: +avgW.toFixed(2), textLines: lines2.length,
      sample: txt.slice(0, 80), fontFamily: s.fontFamily, firstFamily: firstFam(s.fontFamily), resolvedFamilyNote: null,
      fontSize: s.fontSize, lineHeight: s.lineHeight, color: s.color, background: bg || cs(document.body).backgroundColor,
      fontWeight: s.fontWeight, letterSpacing: s.letterSpacing, textAlign: s.textAlign, hyphens: s.hyphens,
      pWidth: Math.round(p.getBoundingClientRect().width), pLeft: Math.round(p.getBoundingClientRect().left),
      lines: nLines, chars: txt.length, charsPerLine: nLines > 1 ? Math.round(txt.length / (nLines - 0.5)) : txt.length,
      containerTag: col ? col.tagName + (col.id ? '#' + col.id : '') + (col.className && typeof col.className === 'string' ? '.' + col.className.trim().split(/\s+/).slice(0, 3).join('.') : '') : null,
    };
  }
  out.headings = {};
  for (const h of ['h1', 'h2', 'h3']) {
    const el = [...document.querySelectorAll(h)].find(vis);
    if (el) { const s = cs(el); out.headings[h] = { text: el.textContent.trim().slice(0, 60), family: firstFam(s.fontFamily), size: s.fontSize, weight: s.fontWeight, color: s.color, lineHeight: s.lineHeight, transform: s.textTransform }; }
  }
  // layout blocks
  const blocks = [];
  const seen = new Set();
  const sel = 'nav, aside, header, footer, main, article, [role=navigation], [role=banner], [role=main], [class*=sidebar], [class*=toc], [class*=Sidebar], [id*=sidebar], [id*=toc], [class*=navbar], [class*=margin], d-article, d-title, d-byline, d-contents';
  for (const el of document.querySelectorAll(sel)) {
    if (!vis(el) || seen.has(el)) continue; seen.add(el);
    const r = el.getBoundingClientRect(); if (r.width < 60) continue;
    const s = cs(el);
    blocks.push({ tag: el.tagName.toLowerCase(), id: el.id || '', cls: (typeof el.className === 'string' ? el.className : '').trim().slice(0, 60), ...rect(el), position: s.position, top: s.top, overflowY: s.overflowY });
  }
  out.blocks = blocks.slice(0, 40);
  // fixed/sticky elements
  const fixed = [];
  for (const el of document.querySelectorAll('body *')) {
    const s = cs(el); if ((s.position === 'fixed' || s.position === 'sticky') && vis(el)) {
      const r = el.getBoundingClientRect(); if (r.width > 40 && r.height > 20) fixed.push({ tag: el.tagName.toLowerCase(), id: el.id, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 50), position: s.position, ...rect(el) });
    }
  }
  out.fixedSticky = fixed.slice(0, 20);
  // math engine
  out.math = {
    mathjaxVersion: window.MathJax?.version || null,
    mathjaxV2: !!(window.MathJax && window.MathJax.Hub),
    katexVersion: window.katex?.version || null,
    mjxContainers: document.querySelectorAll('mjx-container').length,
    mjxDisplay: document.querySelectorAll('mjx-container[display=true], mjx-container[display="true"]').length,
    mjx2: document.querySelectorAll('.MathJax, .MathJax_Display, .MathJax_SVG, .MathJax_CHTML').length,
    katex: document.querySelectorAll('.katex').length,
    katexDisplay: document.querySelectorAll('.katex-display').length,
    mathml: document.querySelectorAll('math').length,
    imgMath: document.querySelectorAll('img[src*="tex"], img[src*="latex"], img[src*="math"], img.math, img[alt*="\\\\"]').length,
    scripts: [...document.scripts].map(s => s.src).filter(s => /mathjax|katex|tex-|mml/i.test(s)),
  };
  // display equation sample
  const disp = document.querySelector('mjx-container[display=true], .MathJax_Display, .katex-display, .math.notranslate.nohighlight, div.math, .displaymath, d-math[block]');
  if (disp && vis(disp)) {
    const s = cs(disp); const par = disp.parentElement;
    out.displayEq = { tag: disp.tagName.toLowerCase(), cls: (typeof disp.className === 'string' ? disp.className : ''), textAlign: s.textAlign, parentTextAlign: cs(par).textAlign, overflowX: s.overflowX, parentOverflowX: cs(par).overflowX, ...rect(disp), html: disp.outerHTML.slice(0, 300) };
  }
  out.eqNumbers = {
    mjxLabels: document.querySelectorAll('mjx-mlabeledtr, mjx-labels, .mjx-label, mjx-mtd[id^="mjx-eqn"]').length,
    eqno: document.querySelectorAll('.eqno, .eqn-num, .eqnum, .equation-number, .tag, .katex .tag').length,
    eqText: [...document.querySelectorAll('.eqno, .eqn-num, .tag, mjx-labels mjx-mtext, mjx-mlabeledtr > mjx-mtd:first-child')].slice(0, 3).map(e => e.textContent.trim()),
  };
  const en = [...document.querySelectorAll('.eqno, mjx-labels, mjx-mlabeledtr > mjx-mtd:first-child, .katex .tag')].find(vis);
  if (en) { const r = en.getBoundingClientRect(); out.eqNumberPos = { left: Math.round(r.left), right: Math.round(r.right), text: en.textContent.trim().slice(0, 20), float: cs(en).float, align: cs(en).textAlign }; }
  const count = q => { try { return document.querySelectorAll(q).length; } catch { return -1; } };
  out.features = {
    footnoteRefs: count('a.footnote-ref, a.footnote-reference, sup a[href^="#fn"], a[href^="#fn"], a[href*="footnote"], d-footnote, .footnote-ref, sup.footnote'),
    dFootnote: count('d-footnote'), dCite: count('d-cite'), sidenotes: count('.sidenote, .marginnote, .margin, aside, .margin-note, d-aside, .marginal'),
    footnotesSection: count('.footnotes, .footnote, section.footnotes, aside.footnote, dl.footnote'),
    details: count('details'), proofs: count('.proof, [class*=proof], .collapse, .toggle, .dropdown'),
    figures: count('figure'), figcaptions: count('figcaption, .caption'), imgs: count('img'), canvases: count('canvas'), svgs: count('svg'), iframes: count('iframe'),
    ranges: count('input[type=range]'), buttons: count('button'), inputs: count('input, select'),
    searchInputs: count('input[type=search], input[name=q], input[name=query], [class*=search] input, .md-search, form[role=search], [aria-label*="earch"]'),
    themeToggle: count('[aria-label*="theme" i], [title*="theme" i], [data-md-color-scheme], [class*=theme-switch], [class*=dark-mode], [aria-label*="dark" i], [title*="dark" i], [data-mode], .theme-toggle'),
    breadcrumbs: count('[aria-label*="readcrumb"], .breadcrumb, .breadcrumbs, nav.md-path, .md-path'),
    progress: count('progress, [class*=progress], .reading-progress'),
    codeBlocks: count('pre'),
    colab: count('a[href*="colab"], a[href*="ipynb"], a[href*="binder"], a[href*="jupyter"], [class*=launch]'),
    github: count('a[href*="github.com"]'),
    tooltips: count('[class*=tooltip], [class*=popover], [data-tippy], [class*=hover]'),
  };
  // prev/next links
  out.prevNext = [...document.querySelectorAll('a')].filter(a => vis(a) && (/^(rel=)?(prev|next)$/.test(a.rel) || /\b(previous|next|prev|anterior|próximo|seguinte)\b/i.test(a.textContent + ' ' + (a.getAttribute('aria-label') || '') + ' ' + a.className))).slice(0, 8).map(a => ({ text: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 60), cls: a.className.slice?.(0, 40), ...rect(a) }));
  // interactive candidates
  out.interactives = [...document.querySelectorAll('canvas, iframe, figure:has(input), figure:has(button), [class*=demo], [class*=mathbox], [class*=interactive], [class*=widget], d-figure, svg')].filter(vis).filter(e => e.getBoundingClientRect().width > 200 && e.getBoundingClientRect().height > 120).slice(0, 8).map(e => ({ tag: e.tagName.toLowerCase(), id: e.id, cls: (typeof e.className === 'string' ? e.className : e.className?.baseVal || '').slice(0, 60), ...rect(e) }));
  // fonts
  out.fontsLoaded = [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g, '') + ' ' + f.weight + (f.style !== 'normal' ? ' ' + f.style : '')))].slice(0, 40);
  out.scrollWidth = document.documentElement.scrollWidth;
  out.scrollHeight = document.documentElement.scrollHeight;
  out.overflow = document.documentElement.scrollWidth > innerWidth;
  // elements wider than viewport (for phone)
  out.wideEls = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 2 && r.width > 50 && vis(e); }).slice(0, 8).map(e => { const s = cs(e); let sc = null; for (let a = e.parentElement; a; a = a.parentElement) { const o = cs(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { sc = a.tagName.toLowerCase() + '.' + (typeof a.className === 'string' ? a.className.slice(0, 30) : '') + ' ' + o; break; } } return { tag: e.tagName.toLowerCase(), cls: (typeof e.className === 'string' ? e.className : '').slice(0, 40), right: Math.round(e.getBoundingClientRect().right), w: Math.round(e.getBoundingClientRect().width), clippedBy: sc }; });
  out.bodyBg = cs(document.body).backgroundColor; out.htmlBg = cs(document.documentElement).backgroundColor;
  return out;
};

async function scrollToFeature(page, prefs) {
  return page.evaluate(prefs => {
    for (const q of prefs) {
      const els = [...document.querySelectorAll(q)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 30 && r.height > 10 && r.top + scrollY > 500; });
      if (els.length) { const e = els[0]; e.scrollIntoView({ block: 'center' }); return { q, y: Math.round(e.getBoundingClientRect().top + scrollY) }; }
    }
    window.scrollTo(0, 1400); return { q: null, y: 1400 };
  }, prefs);
}

const DEFAULT_PREFS = ['d-figure', 'figure:has(input)', 'canvas', 'iframe', 'mjx-container[display=true]', '.MathJax_Display', '.katex-display', 'div.math', 'figure', 'img'];
const PREFS = {
  microbook: ['mjx-container[display=true]', '.arithmatex', 'figure', 'img'],
  ila: ['.mathbox', '[class*=demo]', 'iframe', 'figure', 'mjx-container[display=true]', '.MathJax_Display'],
  immersive: ['canvas', 'iframe', 'figure', 'img'],
  distill: ['d-figure', 'figure', 'svg', 'canvas'],
  seeing: ['svg', 'canvas'],
  feynman: ['.MathJax_Display', 'mjx-container[display=true]', 'figure', 'img', '.figure'],
  d2l: ['mjx-container[display=true]', '.MathJax_Display', 'figure', 'img'],
  quantecon: ['mjx-container[display=true]', '.MathJax_Display', 'figure', 'img'],
};

const shot = (page, file) => page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 70 });

for (const key of keys) {
  const site = SITES[key];
  const data = { key, ...site };
  console.log('==', key);
  // 1. home desktop
  {
    const { ctx, page, error, loadMs } = await visit(site.home, { width: 1440, height: 900 });
    data.home = { error, loadMs, finalUrl: page.url(), title: await page.title().catch(() => null) };
    if (!error) await shot(page, `${key}-home-desktop-top.jpg`);
    console.log('home', error || 'ok', loadMs);
    await ctx.close();
  }
  // 2. content desktop with measurements + network
  {
    const { ctx, page, error, loadMs, netSummary } = await visit(site.page, { width: 1440, height: 900, track: true });
    data.desktop = { error, loadMs, net: netSummary };
    if (!error) {
      await shot(page, `${key}-page-desktop-top.jpg`);
      try { data.desktop.measure = await page.evaluate(MEASURE); } catch (e) { data.desktop.measureError = e.message; }
      data.desktop.scrolledTo = await scrollToFeature(page, PREFS[key] || DEFAULT_PREFS);
      await page.waitForTimeout(1200);
      data.desktop.fixedAfterScroll = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return (s.position === 'fixed' || s.position === 'sticky') && r.width > 40 && r.height > 20 && r.bottom > 0 && r.top < innerHeight; }).slice(0, 12).map(e => ({ tag: e.tagName.toLowerCase(), cls: (typeof e.className === 'string' ? e.className : '').slice(0, 50), pos: getComputedStyle(e).position, x: Math.round(e.getBoundingClientRect().left), y: Math.round(e.getBoundingClientRect().top), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })));
      await shot(page, `${key}-page-desktop-scrolled.jpg`);
    }
    console.log('page', error || 'ok', loadMs, netSummary && netSummary.totalBytes);
    await ctx.close();
  }
  // 3. content phone
  {
    const { ctx, page, error, loadMs } = await visit(site.page, { width: 390, height: 844 });
    data.phone = { error, loadMs };
    if (!error) {
      await shot(page, `${key}-page-phone-top.jpg`);
      try { data.phone.measure = await page.evaluate(MEASURE); } catch (e) { data.phone.measureError = e.message; }
    }
    console.log('phone', error || 'ok');
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'data', `${key}.json`), JSON.stringify(data, null, 1));
}
await browser.close();
