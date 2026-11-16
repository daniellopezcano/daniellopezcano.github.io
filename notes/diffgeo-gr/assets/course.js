// Hand-written: behaviour of the course pages (web layer). Loaded as a module by every course page
// (the page shell is written by _port/convert/shell.py; DECISIONS D29-D33).
// Everything here is progressive enhancement: without it the pages still show the notes in full
// (footnotes at the foot of the page, cross-references as plain links, figures as images, the course
// tree in the page on wide screens).
//
//   1. popovers: footnotes below 1000 px (D11) and cross-reference previews (D25), one shared .dg-pop
//   2. links inside TikZ figures: <g class="dg-xref" data-label> in inlined SVGs -> <a> (D10c); inlineSvg and
//      linkify are exported for the interactive that shows Figure 10.3 step by step (ehsteps, D58)
//   3. figure viewer: click / Enter on a .dg-paper opens a zoom-and-pan <dialog> (D10e)
//   4. roadmaps inlined so their badges are links (landing page; chapter opening pages, lazily, with the
//      chapter's badges ringed, D38); cover decorations
//   5. interactive figures (D15)
//   6. page shell: course tree as a drawer, theme switch (D32), reading progress, outline scroll-spy,
//      sidenotes (D33), keyboard previous/next, site navbar toggle on phones
//   7. interface words and helpers of 8-11
//   8. appendix content in place: "open here" on references to Appendix B / C pages (D35)
//   9. copy LaTeX on display equations (D39)
//  10. search dialog, course index and site index (D36, D39)
//  11. map dialog: the master roadmap with the current chapter ringed (D39)
//  12. "read" marks: the toggle at the foot of a section page and the checks in the lists (D40)

export const ROOT = new URL('..', import.meta.url);          // URL of notes/diffgeo-gr/

/** Resolves once MathJax has typeset the page (or immediately if it never loads). */
export function mathReady() {
  return new Promise(resolve => {
    const done = () => document.documentElement.classList.contains('dg-math-ready');
    if (done()) return resolve();
    const t0 = Date.now();
    const timer = setInterval(() => { if (done() || Date.now() - t0 > 15000) { clearInterval(timer); resolve(); } }, 50);
  });
}

/** Typeset math inside an element that was added after page load. */
export async function typeset(el) {
  await mathReady();
  if (window.MathJax && MathJax.typesetPromise) await MathJax.typesetPromise([el]);
}

const SVGNS = 'http://www.w3.org/2000/svg';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** URL of a page without fragment, with directory URLs normalised to index.html. */
function pageKey(href) {
  const u = new URL(href, location.href);
  u.hash = ''; u.search = '';
  if (u.pathname.endsWith('/')) u.pathname += 'index.html';
  return u.href;
}

const pages = new Map();
/** The HTML of a course page, fetched once (math still as TeX source). */
function fetchPage(href) {
  const key = pageKey(href);
  if (!pages.has(key)) {
    pages.set(key, fetch(key)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(t => new DOMParser().parseFromString(t, 'text/html'))
      .catch(err => { pages.delete(key); throw err; }));
  }
  return pages.get(key);
}

/** Make a copied fragment safe to insert: no duplicate ids, links and images relative to `base`. */
function adopt(node, base) {
  for (const el of [node, ...node.querySelectorAll('*')]) {
    el.removeAttribute('id');
    if (!base) continue;
    for (const attr of ['src', 'href']) {
      const v = el.getAttribute(attr);
      if (v != null && !/^(#|[a-z]+:)/i.test(v)) el.setAttribute(attr, new URL(v, base).href);
      else if (v != null && v.startsWith('#') && attr === 'href') el.setAttribute(attr, base.split('#')[0] + v);
    }
  }
  node.querySelectorAll('.dg-interactive, .dg-anchor, script').forEach(n => n.remove());
  return node;
}

// ---- 1. popovers ----------------------------------------------------------------------------
// Footnote marks: <sup class="dg-fnref"><a href="#fn-N">; cross-references: <a class="dg-xref">; citations:
// <a class="dg-cite">, previewing their entry of the Bibliography page (D52).
// Mouse: hover (with a short delay, and the popover stays while the pointer is over it).
// Keyboard: focus. Touch: the first tap opens, the second follows the link; tap elsewhere closes.
// With sidenotes (margin from 1000 px), a footnote mark highlights its sidenote instead (section 6).
const TRIGGER = '.dg-fnref > a[href^="#"], a.dg-xref[href], a.dg-cite[href]';
const pop = { el: null, trigger: null, token: 0, showTimer: 0, hideTimer: 0 };
const previewCache = new Map();
let lastPointer = 'mouse';
let tapWasOpen = false;
const H = document.documentElement;
const sidenotesOn = () => H.classList.contains('dg-has-sidenotes');

function trigger(target) {
  const t = target && target.closest ? target.closest(TRIGGER) : null;
  if (!t || t.closest('.dg-pop, dialog')) return null;           // a modal dialog would cover the popover
  return sidenotesOn() && t.matches('.dg-fnref > a') ? null : t;
}

function popEl() {
  if (pop.el) return pop.el;
  const el = document.createElement('div');
  el.className = 'dg-pop dg-web';
  el.id = 'dg-pop';
  el.setAttribute('role', 'tooltip');
  el.hidden = true;
  el.addEventListener('pointerenter', () => clearTimeout(pop.hideTimer));
  el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') scheduleHide(); });
  el.addEventListener('focusout', e => { if (!el.contains(e.relatedTarget) && e.relatedTarget !== pop.trigger) scheduleHide(); });
  document.body.append(el);
  if (window.ResizeObserver) new ResizeObserver(() => place()).observe(el);
  return (pop.el = el);
}

function scheduleShow(t, delay = 140) {
  clearTimeout(pop.hideTimer); clearTimeout(pop.showTimer);
  if (pop.trigger === t && pop.el && !pop.el.hidden) return;
  pop.showTimer = setTimeout(() => show(t), delay);
}
function scheduleHide(delay = 220) {
  clearTimeout(pop.showTimer); clearTimeout(pop.hideTimer);
  pop.hideTimer = setTimeout(hide, delay);
}

function hide() {
  clearTimeout(pop.showTimer); clearTimeout(pop.hideTimer);
  pop.token++;
  if (pop.trigger && pop.trigger.getAttribute('aria-describedby') === 'dg-pop') pop.trigger.removeAttribute('aria-describedby');
  pop.trigger = null;
  if (pop.el) { pop.el.hidden = true; pop.el.replaceChildren(); }
}

async function show(t) {
  clearTimeout(pop.showTimer); clearTimeout(pop.hideTimer);
  if (pop.trigger === t && pop.el && !pop.el.hidden) return;
  hide();
  const token = pop.token;
  pop.trigger = t;
  let content = null;
  try { content = await popContent(t); } catch (err) { content = null; }
  if (token !== pop.token || !content) { if (token === pop.token) pop.trigger = null; return; }
  const el = popEl();
  el.dataset.kind = t.matches('a.dg-xref') ? (t.dataset.kind || 'xref') : t.matches('a.dg-cite') ? 'cite' : 'footnote';
  el.replaceChildren(content);
  el.hidden = false;
  if (t.matches('a.dg-xref, a.dg-cite')) t.setAttribute('aria-describedby', 'dg-pop');
  place();
  if (content.classList.contains('dg-pop-raw')) {
    try { await typeset(content); } catch (err) { /* the TeX source stays readable */ }
    content.classList.remove('dg-pop-raw');
    if (token !== pop.token) return;
    place();
  }
  // a wide equation is set a little smaller and then scrolls inside the preview, as in the text (D45 c)
  fitDisplayMath(content);
  place();
}

/** Builds (or reuses) the popover content for a trigger; null when there is nothing to show. */
async function popContent(t) {
  if (t.matches('.dg-fnref > a')) {
    const fn = document.getElementById(decodeURIComponent(t.hash.slice(1)));
    const body = fn && fn.querySelector('.dg-fn-body');
    if (!body) return null;
    await mathReady();                                   // the footnote is typeset with the page
    const box = document.createElement('div');
    box.className = 'dg-pop-fn';
    box.append(adopt(body.cloneNode(true), null));
    return box;
  }
  const href = new URL(t.getAttribute('href'), location.href).href;
  if (previewCache.has(href)) return previewCache.get(href);
  const doc = await fetchPage(href);
  const frag = extract(doc, decodeURIComponent(new URL(href).hash.slice(1)), pageKey(href));
  if (!frag) return null;
  frag.classList.add('dg-pop-preview', 'dg-pop-raw');
  previewCache.set(href, frag);                          // typeset once, reused on the next hover
  return frag;
}

/** The part of a fetched page that a cross-reference points to (see D25). */
function extract(doc, id, base) {
  const box = document.createElement('div');
  const add = el => { if (el) box.append(adopt(document.importNode(el, true), base)); };
  const firstParas = (root, after, n) => {
    const out = [];
    for (const p of root.querySelectorAll('p')) {
      if (out.length >= n) break;
      if (after && after.contains(p)) continue;
      if (p.closest('.dg-web, .dg-footnotes, .dg-head, figure, nav, .dg-motivation-title')) continue;
      if (!p.textContent.trim()) continue;
      out.push(p);
    }
    return out;
  };
  const main = doc.querySelector('main') || doc.body;
  if (!id) {                                             // a whole page: its title and opening lines
    const head = main.querySelector('.dg-head .dg-title');
    if (!head) return null;
    const h = document.createElement('p');
    h.className = 'dg-pop-title';
    h.append(...adopt(document.importNode(head, true), base).childNodes);
    box.append(h);
    firstParas(main, null, 2).forEach(add);
    return box;
  }
  let el = doc.getElementById(id);
  if (!el) return null;
  // an anchor, or a defined term (id term-<k>, the chips of the definitions page, D53): the block that holds it
  if (el.matches('.dg-anchor, a:empty, span:empty, .dg-term')) el = el.closest('h2, h3, h4, figure, li, .dg-fn-body, p') || el.parentElement;
  if (el && el.matches('h2, h3, h4')) {                  // a subsection: its heading and first lines
    const h = document.createElement('p');
    h.className = 'dg-pop-title';
    h.append(...adopt(document.importNode(el, true), base).childNodes);
    box.append(h);
    // the subsection runs until the next heading of the same or a higher level
    const level = +el.tagName[1], part = document.createElement('div');
    for (let n = el.nextElementSibling; n && !(/^H[1-4]$/.test(n.tagName) && +n.tagName[1] <= level); n = n.nextElementSibling) part.append(document.importNode(n, true));
    firstParas(part, null, 2).forEach(add);
    return box;
  }
  if (el.matches('.dg-fn')) el = el.querySelector('.dg-fn-body') || el;
  if (!el || el === doc.body || el === main) return null;
  add(el);
  return box;
}

function place() {
  const el = pop.el, t = pop.trigger;
  if (!el || el.hidden || !t || !t.isConnected) return;
  const rects = t.getClientRects();
  const r = rects.length ? rects[0] : t.getBoundingClientRect();
  const vw = document.documentElement.clientWidth, vh = window.innerHeight, m = 8, gap = 6;
  const mainR = (t.closest('main') || document.querySelector('main') || document.body).getBoundingClientRect();
  // a reference in a sidenote (margin column): the popover may use the text column and the margin
  const col = t.closest('.dg-sidenote') ? { left: mainR.left, right: vw - m, width: vw - m - mainR.left } : mainR;
  const header = document.getElementById('dg-bar');                 // the sticky course bar
  const hb = header ? header.getBoundingClientRect().bottom : 0;
  const topLimit = Math.max(m, hb > 0 ? hb + m : m);
  // a lone display equation lays out its tag against the box width: give it the column's width
  const eq = !!el.querySelector('.math.display') && !el.querySelector('p');
  const maxW = Math.floor(Math.max(200, Math.min(col.width, vw - 2 * m, eq ? 1e4 : 560)));
  el.style.maxWidth = `${maxW}px`;
  el.style.width = eq ? `${maxW}px` : '';
  const below = vh - r.bottom - gap - m, above = r.top - gap - topLimit;
  const maxH = Math.max(120, Math.min(vh * 0.6, Math.max(below, above)));
  el.style.maxHeight = `${maxH}px`;
  // a figure is scaled down until the preview (figure and caption) fits that height, so that it never has to
  // be scrolled to be seen whole; it scrolls only if it would have to shrink below 45 % of the preview (D45 c)
  const paper = el.querySelector('figure .dg-paper'), img = paper && paper.querySelector('img, svg');
  if (paper && img) {
    paper.style.maxWidth = '';
    const over = el.scrollHeight - el.clientHeight, ih = img.getBoundingClientRect().height;
    if (over > 1 && ih > 0) {
      const pw = paper.getBoundingClientRect().width;
      paper.style.maxWidth = `${Math.max(pw * 0.45, pw * (ih - over - 2) / ih)}px`;
    }
  }
  const w = el.offsetWidth, h = el.offsetHeight;
  let lo = Math.max(m, col.left), hi = Math.min(vw - m, col.right) - w;
  if (hi < lo - 2) { lo = m; hi = Math.max(m, vw - m - w); }          // wider than the column: the viewport
  else hi = Math.max(hi, lo);                                            // (sub-pixel widths)
  const left = clamp(r.left + r.width / 2 - w / 2, lo, hi);
  const top = (h <= below || below >= above) ? r.bottom + gap : r.top - gap - h;
  el.style.left = `${left + window.scrollX}px`;
  el.style.top = `${top + window.scrollY}px`;
}

function initPopovers() {
  // footnote marks are described by their footnote (always in the page, already typeset)
  for (const a of document.querySelectorAll('.dg-fnref > a[href^="#"]')) {
    const body = document.getElementById(decodeURIComponent(a.hash.slice(1)))?.querySelector('.dg-fn-body');
    if (!body) continue;
    body.id ||= `dg-${a.hash.slice(1)}-body`;
    a.setAttribute('aria-describedby', body.id);
  }
  document.addEventListener('pointerdown', e => {
    lastPointer = e.pointerType || 'mouse';
    const t = trigger(e.target);
    tapWasOpen = !!(t && pop.trigger === t && pop.el && !pop.el.hidden);
    if (pop.el && !pop.el.hidden && !pop.el.contains(e.target) && !(pop.trigger && pop.trigger.contains(e.target))) hide();
  }, true);
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const t = trigger(e.target);
    if (t) scheduleShow(t);
  });
  document.addEventListener('pointerout', e => {
    if (e.pointerType !== 'mouse') return;
    const t = trigger(e.target);
    if (t && !t.contains(e.relatedTarget) && !(pop.el && pop.el.contains(e.relatedTarget))) scheduleHide();
  });
  document.addEventListener('focusin', e => {
    const t = trigger(e.target);
    if (t && lastPointer !== 'touch') show(t);
  });
  document.addEventListener('focusout', e => {
    const t = trigger(e.target);
    if (t && !(pop.el && pop.el.contains(e.relatedTarget))) scheduleHide(120);
  });
  document.addEventListener('click', e => {
    const t = trigger(e.target);
    if (!t) return;
    if (e.detail !== 0 && (lastPointer === 'touch' || lastPointer === 'pen') && !tapWasOpen) {
      e.preventDefault();                                // first tap: preview; second tap: follow
      show(t);
    } else hide();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !pop.el || pop.el.hidden) return;
    const t = pop.trigger, inside = pop.el.contains(document.activeElement);
    hide();
    if (inside && t) t.focus();
  });
  window.addEventListener('resize', () => place());
}

// ---- 2. inline SVG and links inside TikZ figures ----------------------------------------------
const svgTexts = new Map();
let svgSeq = 0;
let labelsPromise = null;

function labels() {
  labelsPromise ||= fetch(new URL('assets/labels.json', ROOT))
    .then(r => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return labelsPromise;
}

/** Fetches one of our SVG figures and returns it as a DOM node for this document.
 *  Scripts and event attributes are dropped; ids get a per-copy prefix, because dvisvgm
 *  names its glyphs alike in every file (g0-42, ...) and two inlined copies would collide. */
export async function inlineSvg(url) {
  if (!svgTexts.has(url)) {
    svgTexts.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .catch(err => { svgTexts.delete(url); throw err; }));
  }
  const text = await svgTexts.get(url);
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('not an SVG');
  svg.querySelectorAll('script, foreignObject').forEach(n => n.remove());
  const p = `dgs${++svgSeq}-`;
  for (const el of svg.querySelectorAll('*')) {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name)) { el.removeAttribute(a.name); continue; }
      if (a.localName === 'id') el.setAttribute('id', p + a.value);
      else if (a.localName === 'href') {
        if (a.value.startsWith('#')) el.setAttributeNS(a.namespaceURI, a.name, `#${p}${a.value.slice(1)}`);
        else if (/^\s*javascript:/i.test(a.value)) el.removeAttributeNS(a.namespaceURI, a.localName);
      } else if (a.value.includes('url(#')) el.setAttribute(a.name, a.value.replace(/url\(#/g, `url(#${p}`));
    }
  }
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('focusable', 'false');
  return document.importNode(svg, true);
}

/** Turns every <g class="dg-xref" data-label> of an inlined, rendered SVG into a link. */
export async function linkify(svg) {
  const map = await labels();
  for (const g of svg.querySelectorAll('g.dg-xref[data-label]')) {
    const info = map[g.getAttribute('data-label')];
    if (!info || !info.url || g.parentNode.closest('a')) continue;   // page not converted yet: inert
    let own;
    try { own = g.getBBox(); } catch (err) { continue; }
    if (!own.width && !own.height) continue;
    const a = document.createElementNS(SVGNS, 'a');
    a.setAttribute('href', new URL(info.url, ROOT).href);
    a.setAttribute('class', 'dg-svg-link');
    const title = document.createElementNS(SVGNS, 'title');
    title.textContent = info.num;
    // hit area: the whole badge text ("Ch. 3", "Eq. (6.1)") when the reference sits in a short
    // text node of its own, otherwise the number itself; generous padding either way
    let box = own;
    const parent = g.parentNode;
    if (parent.querySelectorAll('g.dg-xref').length === 1) {
      const pb = parent.getBBox();
      if (pb.width <= own.width + 4.5 * own.height && pb.height <= 2 * own.height) box = pb;
    }
    const pad = Math.max(own.height * 0.5, 1.5);
    const rect = document.createElementNS(SVGNS, 'rect');
    rect.setAttribute('class', 'dg-svg-hit');
    rect.setAttribute('x', box.x - pad);
    rect.setAttribute('y', box.y - pad);
    rect.setAttribute('width', box.width + 2 * pad);
    rect.setAttribute('height', box.height + 2 * pad);
    rect.setAttribute('rx', pad);
    parent.insertBefore(a, g);
    a.append(title, rect, g);
  }
  return svg.querySelectorAll('a.dg-svg-link').length;
}

// ---- 3. figure viewer -------------------------------------------------------------------------
const ICONS = {
  in: '<path d="M11 6v10M6 11h10"/><circle cx="11" cy="11" r="7.5"/><path d="M16.5 16.5L21 21"/>',
  out: '<path d="M6 11h10"/><circle cx="11" cy="11" r="7.5"/><path d="M16.5 16.5L21 21"/>',
  fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

const V = { dlg: null, stage: null, paper: null, w: 1, h: 1, s: 1, x: 0, y: 0, fit: 1, opener: null,
  pointers: new Map(), dragged: false, start: null, pinch: null, lastTap: null, raf: 0, seq: 0 };

function buildViewer() {
  const d = document.createElement('dialog');
  d.className = 'dg-viewer dg-web';
  d.innerHTML = `<div class="dg-viewer-stage" tabindex="-1"><div class="dg-viewer-paper"></div></div>
    <div class="dg-viewer-tools">
      <button type="button" class="dg-icon-btn" data-act="in" aria-label="Zoom in" title="Zoom in">${icon('in')}</button>
      <button type="button" class="dg-icon-btn" data-act="out" aria-label="Zoom out" title="Zoom out">${icon('out')}</button>
      <button type="button" class="dg-icon-btn" data-act="fit" aria-label="Fit to window" title="Fit to window">${icon('fit')}</button>
      <button type="button" class="dg-icon-btn" data-act="close" aria-label="Close" title="Close">${icon('close')}</button>
    </div>`;
  document.body.append(d);
  V.dlg = d;
  V.stage = d.querySelector('.dg-viewer-stage');
  V.paper = d.querySelector('.dg-viewer-paper');

  d.querySelector('.dg-viewer-tools').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act, c = center();
    if (act === 'in') zoomAt(1.4, c.x, c.y);
    else if (act === 'out') zoomAt(1 / 1.4, c.x, c.y);
    else if (act === 'fit') fitView();
    else d.close();
  });
  d.addEventListener('close', () => {
    document.documentElement.classList.remove('dg-viewer-open');
    V.paper.replaceChildren();
    V.seq++;
    const o = V.opener; V.opener = null;
    if (o && o.isConnected) o.focus({ preventScroll: true });
  });
  d.addEventListener('keydown', onViewerKey);
  // a link inside the figure: leave the viewer, then follow it (also for links into this page)
  V.paper.addEventListener('click', e => { if (!V.dragged && e.target.closest('a[href]')) d.close(); });

  const st = V.stage;
  st.addEventListener('wheel', e => {
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const f = Math.exp(-e.deltaY * k * (e.ctrlKey ? 0.01 : 0.0018));
    const p = local(e);
    zoomAt(f, p.x, p.y);
  }, { passive: false });
  st.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    V.pointers.set(e.pointerId, local(e));
    V.dragged = false;
    V.start = { ...local(e), x0: V.x, y0: V.y, t: Date.now() };
    if (V.pointers.size === 2) startPinch();
  });
  st.addEventListener('pointermove', e => {
    if (!V.pointers.has(e.pointerId)) return;
    const p = local(e);
    V.pointers.set(e.pointerId, p);
    if (V.pointers.size >= 2 && V.pinch) {
      const [a, b] = [...V.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      V.x += mid.x - V.pinch.mid.x; V.y += mid.y - V.pinch.mid.y;
      zoomAt(dist / V.pinch.dist, mid.x, mid.y);
      V.pinch = { dist, mid };
      V.dragged = true;
      return;
    }
    if (!V.start) return;
    if (!V.dragged && Math.hypot(p.x - V.start.x, p.y - V.start.y) > 4) {
      V.dragged = true;
      try { st.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      st.classList.add('dg-dragging');
    }
    if (V.dragged) { V.x = V.start.x0 + p.x - V.start.x; V.y = V.start.y0 + p.y - V.start.y; apply(); }
  });
  const end = e => {
    if (!V.pointers.has(e.pointerId)) return;
    const p = local(e);
    V.pointers.delete(e.pointerId);
    st.classList.remove('dg-dragging');
    if (V.pointers.size < 2) V.pinch = null;
    if (V.pointers.size === 1) { const q = [...V.pointers.values()][0]; V.start = { ...q, x0: V.x, y0: V.y }; return; }
    if (e.type === 'pointerup' && e.pointerType !== 'mouse' && !V.dragged) {        // double tap
      const now = Date.now(), l = V.lastTap;
      if (l && now - l.t < 320 && Math.hypot(p.x - l.x, p.y - l.y) < 30) { toggleZoom(p.x, p.y); V.lastTap = null; }
      else V.lastTap = { ...p, t: now };
    }
    V.start = null;
  };
  st.addEventListener('pointerup', end);
  st.addEventListener('pointercancel', end);
  st.addEventListener('click', e => { if (V.dragged) { e.preventDefault(); e.stopPropagation(); V.dragged = false; } }, true);
  st.addEventListener('dblclick', e => { if (lastPointer === 'mouse') { const p = local(e); toggleZoom(p.x, p.y); } });
  window.addEventListener('resize', () => { if (V.dlg && V.dlg.open) fitView(); });
}

function startPinch() {
  const [a, b] = [...V.pointers.values()];
  V.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
}
function local(e) { const r = V.stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function center() { return { x: V.stage.clientWidth / 2, y: V.stage.clientHeight / 2 }; }

function apply() {
  const W = V.stage.clientWidth, H = V.stage.clientHeight, cw = V.w * V.s, ch = V.h * V.s, keep = 60;
  V.x = clamp(V.x, Math.min(keep - cw, (W - cw) / 2), Math.max(W - keep, (W - cw) / 2));
  V.y = clamp(V.y, Math.min(keep - ch, (H - ch) / 2), Math.max(H - keep, (H - ch) / 2));
  if (V.raf) return;
  V.raf = requestAnimationFrame(() => {
    V.raf = 0;
    V.paper.style.width = `${V.w * V.s}px`;           // real size, not a CSS scale: vectors stay sharp
    V.paper.style.height = `${V.h * V.s}px`;
    V.paper.style.transform = `translate(${V.x}px, ${V.y}px)`;
  });
}
function zoomAt(f, px, py) {
  const s = clamp(V.s * f, V.fit * 0.5, Math.max(V.fit * 10, 4));
  const k = s / V.s;
  V.x = px - (px - V.x) * k; V.y = py - (py - V.y) * k; V.s = s;
  apply();
}
function fitView() {
  const W = V.stage.clientWidth, H = V.stage.clientHeight, m = W < 600 ? 12 : 40;
  V.fit = Math.max(0.01, Math.min((W - 2 * m) / V.w, (H - 2 * m) / V.h));
  V.s = V.fit; V.x = (W - V.w * V.s) / 2; V.y = (H - V.h * V.s) / 2;
  apply();
}
function toggleZoom(px, py) {
  if (Math.abs(V.s - V.fit) / V.fit < 0.05) zoomAt((2 * V.fit) / V.s, px, py); else fitView();
}

function onViewerKey(e) {
  const c = center(), step = 80;
  const keys = {
    '+': () => zoomAt(1.25, c.x, c.y), '=': () => zoomAt(1.25, c.x, c.y),
    '-': () => zoomAt(0.8, c.x, c.y), '_': () => zoomAt(0.8, c.x, c.y), '0': () => fitView(),
    ArrowLeft: () => { V.x += step; apply(); }, ArrowRight: () => { V.x -= step; apply(); },
    ArrowUp: () => { V.y += step; apply(); }, ArrowDown: () => { V.y -= step; apply(); },
  };
  if (keys[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); keys[e.key](); return; }
  if (e.key === 'Tab') {                                 // keep focus inside the viewer
    const f = [...V.dlg.querySelectorAll('button, a[href]')].filter(n => n.getClientRects().length);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], cur = document.activeElement;
    if (e.shiftKey && (cur === first || !V.dlg.contains(cur) || cur === V.stage)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
  }
}

/** Opens the viewer on a .dg-paper (an <img>, or an SVG already inlined in the page). */
async function openViewer(paper) {
  if (!V.dlg) buildViewer();
  const img = paper.querySelector('img');
  const src = paper.dataset.dgSrc || (img && (img.currentSrc || img.src));
  if (!src) return;
  const kind = paper.dataset.dgKind || (img && img.dataset.kind) || '';
  V.w = +(paper.dataset.dgW || (img && (img.getAttribute('width') || img.naturalWidth))) || 1000;
  V.h = +(paper.dataset.dgH || (img && (img.getAttribute('height') || img.naturalHeight))) || 750;
  const alt = paper.dataset.dgAlt ?? (img ? img.getAttribute('alt') : '');
  V.dlg.setAttribute('aria-label', alt || 'Figure');
  const pic = document.createElement('img');
  pic.src = src; pic.alt = alt || ''; pic.decoding = 'async';
  V.paper.replaceChildren(pic);
  V.opener = paper.matches('[tabindex], button') ? paper : (paper.querySelector('.dg-expand') || document.activeElement);
  if (!V.dlg.open) V.dlg.showModal();
  document.documentElement.classList.add('dg-viewer-open');
  V.stage.focus({ preventScroll: true });
  fitView();
  if (kind !== 'svg') return;
  const seq = ++V.seq;
  try {
    const svg = await inlineSvg(src);
    if (seq !== V.seq || !V.dlg.open) return;
    if (alt) { svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', alt); }   // 'group', not 'img': linkify() puts links inside
    V.paper.replaceChildren(svg);
    await linkify(svg);
  } catch (err) { /* the image stays */ }
}

/** Figure cards inside `root` become buttons that open the viewer. */
function enableFigures(root) {
  for (const paper of root.querySelectorAll('.dg-paper')) {
    if (paper.hasAttribute('data-map') || paper.closest('.dg-interactive') || paper.hasAttribute('role')) continue;
    const img = paper.querySelector('img');
    if (!img) continue;
    paper.tabIndex = 0;
    paper.setAttribute('role', 'button');
    const alt = img.getAttribute('alt');
    paper.setAttribute('aria-label', alt ? `Enlarge ${alt}` : 'Enlarge figure');
  }
}

function initFigures() {
  enableFigures(document.querySelector('main') || document.body);
  document.addEventListener('click', e => {
    const paper = e.target.closest && e.target.closest('.dg-paper[role="button"]');
    if (!paper || paper.closest('.dg-pop, .dg-viewer') || e.target.closest('a[href]')) return;
    e.preventDefault();
    openViewer(paper);
  });
  document.addEventListener('keydown', e => {
    if ((e.key !== 'Enter' && e.key !== ' ') || !e.target.matches || !e.target.matches('.dg-paper[role="button"]')) return;
    e.preventDefault();
    openViewer(e.target);
  });
}

// ---- 4. landing page and chapter opening pages ----------------------------------------------------
/** Roadmaps (.dg-paper[data-map]) are inlined in place, so that their badges are links on the page itself:
 *  the master roadmap of the landing page at once, the roadmap of a chapter opening page (data-map="lazy",
 *  D38) only when it comes near the viewport. With data-ring, the badges that point into the current
 *  chapter are ringed, as in the map dialog (section 11). */
function initMaps() {
  const papers = [...document.querySelectorAll('.dg-paper[data-map]')];
  const lazy = papers.filter(p => p.dataset.map === 'lazy');
  for (const paper of papers) if (paper.dataset.map !== 'lazy') liveMap(paper);
  if (!lazy.length) return;
  if (!('IntersectionObserver' in window)) { lazy.forEach(liveMap); return; }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); liveMap(e.target); }
  }, { rootMargin: '800px 0px' });
  lazy.forEach(p => io.observe(p));
}

async function liveMap(paper) {
  const img = paper.querySelector('img');
  if (!img) return;
  Object.assign(paper.dataset, { dgSrc: img.src, dgKind: img.dataset.kind || '', dgAlt: img.getAttribute('alt') || '',
    dgW: img.getAttribute('width') || '', dgH: img.getAttribute('height') || '' });
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dg-icon-btn dg-expand dg-web';
  btn.setAttribute('aria-label', 'Enlarge figure');
  btn.title = 'Enlarge figure';
  btn.innerHTML = icon('fit');
  btn.addEventListener('click', () => openViewer(paper));
  paper.after(btn);                                    // outside the figure: it hides no badge
  if (img.dataset.kind !== 'svg') return;
  try {
    const svg = await inlineSvg(img.src);
    const w = +img.getAttribute('width'), h = +img.getAttribute('height');
    if (w && h) svg.style.aspectRatio = `${w} / ${h}`;
    svg.setAttribute('class', 'dg-map-svg');
    if (img.getAttribute('alt')) { svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', img.getAttribute('alt')); }   // its badges are links
    img.replaceWith(svg);
    paper.classList.add('dg-map-live');
    await linkify(svg);
    if (paper.hasAttribute('data-ring')) ringChapter(svg, await labels());
  } catch (err) { /* the image stays; the viewer still opens */ }
}

/** Rings the linked badges of an inlined roadmap that point into the chapter of the current page
 *  (same directory of the course). Nothing is ringed outside a chapter directory. */
function ringChapter(svg, map) {
  const here = (coursePath(location.href) || '').split('/');
  const dir = here.length > 1 ? here[0] : null;
  if (!dir) return;
  for (const g of svg.querySelectorAll('a.dg-svg-link g.dg-xref[data-label]')) {
    const u = (map[g.getAttribute('data-label')] || {}).url || '';
    if (u.split('/')[0] === dir) g.closest('a.dg-svg-link').classList.add('dg-here');
  }
}

/** Decorations of the landing page drawn as on the notes' title and dedication pages
 *  (main.tex: the "dented" coordinate mesh with a geodesic, and the faded verse lines). */
function drawDecor() {
  const dent = (x, y) => -1.7 * Math.exp(-(x * x + y * y) / 1.3);
  const P = (x, y) => [(x + 0.45 * y) * 10, -(0.40 * y + dent(x, y)) * 10];
  const line = (f, a, b, n) => {
    let d = '';
    for (let i = 0; i <= n; i++) { const [x, y] = f(a + (b - a) * i / n); d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
    return d;
  };
  const range = (a, b, s) => { const r = []; for (let v = a; v <= b + 1e-9; v += s) r.push(+v.toFixed(2)); return r; };
  for (const svg of document.querySelectorAll('svg[data-dg-mesh]')) {
    let mesh = '';
    for (const yy of range(-3.2, 3.2, 0.4)) mesh += line(t => P(t, yy), -4.4, 4.4, 60);
    for (const xx of range(-4.4, 4.4, 0.4)) mesh += line(t => P(xx, t), -3.2, 3.2, 44);
    const gy = t => 1.1 - 0.75 * Math.exp(-t * t / 2.2);
    let html = `<path class="dg-mesh-grid" d="${mesh}"/>`;
    if (svg.dataset.dgMesh === 'cover') {
      const [cx, cy] = P(-1.6, gy(-1.6));
      html += `<path class="dg-mesh-geodesic" d="${line(t => P(t, gy(t)), -4.4, 4.4, 90)}"/><circle class="dg-mesh-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1"/>`;
    }
    svg.setAttribute('viewBox', '-60 -14 120 46');
    svg.innerHTML = html;
  }
  // \fadedline rows above (+) and below (-) the quote: offset (cm), opacity, bar height (pt), word widths (cm)
  const rows = [[0.95, .36, 3.6, [1.3, 2.4, 0.8, 1.9, 2.2, 1.1, 1.6]], [1.48, .22, 3.0, [2.0, 1.0, 2.6, 1.4, 1.8, 0.9]],
    [1.94, .12, 2.4, [1.5, 2.1, 0.8, 1.7, 1.2]], [2.34, .06, 1.8, [1.8, 1.1, 1.6, 0.9]],
    [-1.80, .36, 3.6, [2.1, 1.0, 1.7, 2.5, 0.9, 1.9, 1.3]], [-2.33, .22, 3.0, [1.2, 2.3, 1.6, 0.8, 2.2, 1.4]],
    [-2.79, .12, 2.4, [2.0, 0.9, 1.8, 1.4, 1.3]], [-3.19, .06, 1.8, [1.1, 1.9, 1.3, 1.4]]];
  for (const svg of document.querySelectorAll('svg[data-dg-verse]')) {
    const up = svg.dataset.dgVerse === 'above';
    let html = '';
    for (const [dy, op, hpt, words] of rows) {
      if ((dy > 0) !== up) continue;
      const h = hpt / 28.45, total = words.reduce((s, w) => s + w + 0.22, -0.22);
      let x = -total / 2;
      const y = up ? 2.6 - dy : -1.55 - dy;
      for (const w of words) { html += `<rect x="${x.toFixed(2)}" y="${(y - h / 2).toFixed(3)}" width="${w}" height="${h.toFixed(3)}" rx="${(h / 2).toFixed(3)}" opacity="${op}"/>`; x += w + 0.22; }
    }
    svg.setAttribute('viewBox', up ? '-7.5 0 15 2' : '-7.5 0 15 1.8');
    svg.innerHTML = html;
  }
}

// ---- narrow screens: inline formulas wider than their line --------------------------------------
// MathJax 3 cannot break an inline formula; one wider than the column would widen the whole page.
// Only those (measured after typesetting) scroll sideways in place, like the display equations.
// In a sidenote (D59) such a formula is first set smaller until it fits, never below 75 % of the note's
// text size; only one still too wide then scrolls in place (with the shadow cue of D45).
const MIN_SIDENOTE_SCALE = 0.75;
// font size of a formula scaled by s, on top of the size MathJax gave it (kept in data-dg-fs)
function scaleMath(m, s) {
  if (m.dataset.dgFs === undefined) m.dataset.dgFs = m.style.fontSize;
  const base = m.dataset.dgFs, pct = base.endsWith('%') ? parseFloat(base) : 100;
  m.style.fontSize = s === 1 ? base : (pct * s).toFixed(1) + '%';
}
function fitWideInlineMath(root = document.querySelector('main')) {
  if (!root) return;
  const all = root.querySelectorAll('mjx-container[jax="CHTML"]:not([display="true"])');
  all.forEach(m => { m.classList.remove('dg-math-wide'); m.style.maxWidth = ''; if (m.dataset.dgFs !== undefined) scaleMath(m, 1); });
  for (const m of all) {
    const block = m.closest('p, li, td, th, figcaption, div');
    if (!block || m.closest('.math.display, .dg-pop')) continue;
    // the run the converter glued around the formula (D44: brackets, punctuation, a footnote mark) has to
    // fit the line as a whole: the formula scrolls within what the rest of the run leaves
    const run = m.closest('.dg-nb');
    const measure = () => {
      const r = m.getBoundingClientRect(), rr = run ? run.getBoundingClientRect() : r, b = block.getBoundingClientRect();
      return { r, rr, b, wide: r.width && (rr.right > b.right + 0.5 || rr.left < b.left - 0.5) };
    };
    let { r, rr, b, wide } = measure();
    if (wide && m.closest('.dg-sidenote')) {
      const room = b.width - (rr.width - r.width) - 1;           // what the rest of the glued run leaves
      scaleMath(m, Math.max(MIN_SIDENOTE_SCALE, Math.min(1, room / r.width)));
      ({ r, rr, b, wide } = measure());
    }
    if (wide) {
      m.classList.add('dg-math-wide');
      const extra = Math.ceil(rr.width - r.width);
      if (run && extra > 0) m.style.maxWidth = `calc(100% - ${extra}px)`;
    }
  }
  // a formula that scrolls can be scrolled from the keyboard too (as the display equations)
  for (const m of all) {
    if (m.classList.contains('dg-math-wide') && m.scrollWidth > m.clientWidth + 1) { m.tabIndex = 0; m.dataset.dgTab = '1'; }
    else if (m.dataset.dgTab) { m.removeAttribute('tabindex'); delete m.dataset.dgTab; }
  }
}
// A display equation is set at the text size at every width (D59). One wider than its box is set smaller
// until it fits, never below 85 % of the text size (75 % in a sidenote); only what is still too wide scrolls
// inside its own box, which shows a soft shadow at the edge where more is hidden (D45; CSS only, course.css).
// Class dg-math-scroll marks it. Tables keep D48's rule (never below 80 %).
const MIN_DISPLAY_SCALE = 0.85, MIN_TABLE_SCALE = 0.8;
function fitDisplayMath(root = document.querySelector('main')) {
  if (!root) return;
  for (const d of root.querySelectorAll('.math.display')) {
    d.style.fontSize = '';
    const min = d.closest('.dg-sidenote') ? MIN_SIDENOTE_SCALE : MIN_DISPLAY_SCALE;
    let scale = 1;
    for (let k = 0; k < 3 && d.scrollWidth > d.clientWidth + 1 && d.clientWidth > 0 && scale > min; k++) {
      scale = Math.max(min, scale * (d.clientWidth - 2) / d.scrollWidth);      // rules and rounding: not exactly linear
      d.style.fontSize = (scale * 100).toFixed(1) + '%';
    }
    const scrolls = d.scrollWidth > d.clientWidth + 1;
    d.classList.toggle('dg-math-scroll', scrolls);
    if (scrolls) { d.tabIndex = 0; d.dataset.dgScroll = '1'; }        // keyboard users can scroll it too
    else if (d.dataset.dgScroll) { d.removeAttribute('tabindex'); delete d.dataset.dgScroll; }
  }
  for (const t of root.querySelectorAll('.dg-table-wrap')) {             // tables follow the same rule (D48)
    const tb = t.firstElementChild;
    tb.style.fontSize = '';
    let scale = 1;
    for (let k = 0; k < 4 && t.scrollWidth > t.clientWidth + 1 && t.clientWidth > 0 && scale > MIN_TABLE_SCALE; k++) {
      scale = Math.max(MIN_TABLE_SCALE, scale * (t.clientWidth - 2) / t.scrollWidth);    // rules and rounding: not exactly linear
      tb.style.fontSize = (scale * 100).toFixed(1) + '%';
    }
    if (t.scrollWidth > t.clientWidth + 1) { t.tabIndex = 0; t.dataset.dgScroll = '1'; }
    else if (t.dataset.dgScroll) { t.removeAttribute('tabindex'); delete t.dataset.dgScroll; }
  }
}
async function initWideMath() {
  await mathReady();
  fitDisplayMath();
  fitWideInlineMath();
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { fitDisplayMath(); fitWideInlineMath(); }, 150); });
}

// ---- 5. interactive figures ------------------------------------------------------------------
// The converter leaves <div class="dg-interactive" data-module="name"> frames where
// _port/interactives.json attaches one. The module assets/interactive/<name>.js is imported only
// when its frame comes near the viewport; it exports `default async function mount(body, frame)`.
// A frame becomes visible (class dg-ready) only after its module mounted without error.
// The panel (D55): badge bar, the module's body, and a footer built here: Reset (empties the body and
// mounts the module again, so every module gets it without code of its own), a link back to the static
// figure the panel accompanies (labelled with the figure's own number, read from its caption), and the
// notebook of the Python package (data-notebook, from _port/interactives.json) where there is one.
function panelFooter(frame, mount) {
  const body = frame.querySelector('.dg-interactive-body');
  const foot = document.createElement('div');
  foot.className = 'dg-interactive-foot';
  const reset = document.createElement('button');
  reset.type = 'button'; reset.className = 'dg-btn dg-ia-reset'; reset.textContent = 'Reset';
  reset.addEventListener('click', async () => {
    reset.disabled = true;
    try {
      const { dispose } = await import(new URL('assets/interactive/dg.js', ROOT));
      dispose(body);
      if (window.MathJax && MathJax.typesetClear) { try { MathJax.typesetClear([body]); } catch (_) { /* nothing typeset */ } }
      body.replaceChildren();
      await mount();
    } catch (err) {
      console.error(`interactive "${frame.dataset.module}" failed:`, err);
    } finally { reset.disabled = false; reset.focus(); }
  });
  foot.append(reset);
  const fig = frame.dataset.for && document.getElementById(frame.dataset.for);
  const num = fig && fig.matches('figure') && fig.querySelector('.dg-fignum');
  if (num) {
    const a = document.createElement('a');
    a.className = 'dg-ia-static'; a.href = '#' + fig.id;
    a.textContent = num.textContent.replace(/[:.\s]+$/, '');
    a.title = 'Static figure';
    a.addEventListener('click', e => { e.preventDefault(); fig.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); history.replaceState(null, '', '#' + fig.id); });
    foot.append(a);
  }
  if (frame.dataset.notebook) {
    const a = document.createElement('a');
    a.className = 'dg-ia-notebook'; a.href = frame.dataset.notebook;
    a.innerHTML = '<i class="dg-i dg-i-github" aria-hidden="true"></i> Notebook';
    a.title = decodeURIComponent(frame.dataset.notebook.split('/').pop());
    foot.append(a);
  }
  frame.append(foot);
}

function loadInteractives() {
  const frames = document.querySelectorAll('.dg-interactive[data-module]');
  if (!frames.length) return;
  const start = async frame => {
    try {
      const mod = await import(new URL(`assets/interactive/${frame.dataset.module}.js`, ROOT));
      await mathReady();
      const body = frame.querySelector('.dg-interactive-body');
      const mount = () => mod.default(body, frame);
      await mount();
      panelFooter(frame, mount);
      frame.classList.add('dg-ready');
    } catch (err) {
      console.error(`interactive "${frame.dataset.module}" failed:`, err);
    }
  };
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); start(e.target); }
  }, { rootMargin: '600px 0px' });
  frames.forEach(f => io.observe(f));
}

// ---- 6. page shell ---------------------------------------------------------------------------
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Course tree: in the grid from 1360 px, a drawer below (opened by the Contents button of the course bar);
 *  a drawer at every width on chapter opening pages (D38).
 *  Opening moves the focus into it and keeps it there; Escape, a click outside or a link closes it and the
 *  focus returns to the button. */
function initDrawer() {
  const tree = document.getElementById('dg-tree'), btn = document.querySelector('.dg-bar-menu');
  if (!tree || !btn) return;
  const drawer = window.matchMedia(document.body.classList.contains('dg-page-chapter') ? 'all' : '(max-width: 1359.98px)');
  const isOpen = () => H.classList.contains('dg-nav-open');
  const open = () => {
    H.classList.add('dg-nav-open');
    btn.setAttribute('aria-expanded', 'true');
    revealCurrent(tree);
    requestAnimationFrame(() => (tree.querySelector('[aria-current="page"]') || tree.querySelector('a[href]'))?.focus());
  };
  const close = (restore = true) => {
    if (!isOpen()) return;
    const inside = tree.contains(document.activeElement);
    H.classList.remove('dg-nav-open');
    btn.setAttribute('aria-expanded', 'false');
    if (restore && inside) btn.focus();
  };
  btn.addEventListener('click', () => (isOpen() ? close() : open()));
  document.addEventListener('click', e => {
    if (!isOpen() || e.target.closest('.dg-bar-menu')) return;
    if (!tree.contains(e.target)) close(false);
    else if (e.target.closest('a[href]')) close(false);
  });
  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...tree.querySelectorAll(FOCUSABLE)].filter(n => n.getClientRects().length);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], cur = document.activeElement;
    if (e.shiftKey && (cur === first || !tree.contains(cur))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (cur === last || !tree.contains(cur))) { e.preventDefault(); first.focus(); }
  });
  drawer.addEventListener('change', () => { if (!drawer.matches) close(false); });
}

/** Scrolls the course tree (never the page) so that the current page's entry is in view: left alone if it is
 *  already within the part of the tree that can be seen, otherwise centred in it. Run on load (the sticky
 *  column and the closed drawer) and when the drawer opens. */
function revealCurrent(tree = document.getElementById('dg-tree')) {
  const cur = tree && tree.querySelector('[aria-current="page"]');
  if (!cur) return;
  const t = tree.getBoundingClientRect(), c = cur.getBoundingClientRect();
  const seen = Math.max(0, Math.min(tree.clientHeight, window.innerHeight - Math.max(t.top, 0)));   // the part of the tree on screen
  const top = c.top - t.top + tree.scrollTop - tree.clientTop;     // the entry's offset in the tree's content
  if (top >= tree.scrollTop && top + c.height <= tree.scrollTop + seen) return;
  tree.scrollTop = Math.max(0, top - (seen - c.height) / 2);
}

/** Light or dark (D32): the head script applies the stored choice before the first paint. */
function initTheme() {
  for (const b of document.querySelectorAll('[data-act="theme"]')) {
    b.addEventListener('click', () => {
      const t = H.dataset.theme === 'dark' ? 'light' : 'dark';
      H.dataset.theme = t;
      try { localStorage.setItem('dg-theme', t); } catch (err) { /* private mode: the choice lasts for this page */ }
    });
  }
}

/** Site navbar on phones: the toggle shows and hides the links. */
function initSiteNav() {
  const nav = document.getElementById('dg-sitenav'), b = nav && nav.querySelector('.dg-sitenav-toggle');
  if (!b) return;
  b.addEventListener('click', () => b.setAttribute('aria-expanded', String(nav.classList.toggle('dg-open'))));
}

/** Reading progress (the dark hairline of the course bar) and the outline entry of the heading being read. */
function initScroll() {
  const bar = document.querySelector('.dg-bar-progress b');
  const main = document.getElementById('dg-main');
  const links = [...document.querySelectorAll('.dg-tree-outline a')];
  const heads = main ? [...main.querySelectorAll(':scope > h2[id], :scope > h3[id]')] : [];
  let raf = 0;
  const update = () => {
    raf = 0;
    if (bar) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = `${(h > 0 ? Math.min(1, window.scrollY / h) : 0) * 100}%`;
    }
    if (!links.length || !heads.length) return;
    const limit = (document.getElementById('dg-bar')?.getBoundingClientRect().bottom || 0) + 80;
    let cur = null;
    for (const h of heads) { if (h.getBoundingClientRect().top < limit) cur = h.id; else break; }
    for (const a of links) {
      const on = a.getAttribute('href') === `#${cur}`;
      a.classList.toggle('dg-on', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    }
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}

/** Footnotes as sidenotes (D33): from 1000 px each footnote is copied into the margin at the height of
 *  its mark (pushed down when it would overlap the previous one); the list at the foot of the page is
 *  hidden then, and stays the form used below 1000 px, without JavaScript and in print. */
function initSidenotes() {
  const main = document.getElementById('dg-main');
  const notes = main ? [...main.querySelectorAll('.dg-footnotes .dg-fn')] : [];
  if (!notes.length || !document.body.classList.contains('dg-page-reading')) return;
  const wide = window.matchMedia('(min-width: 1000px)');
  let box = null;
  const mark = id => main.querySelector(`.dg-fnref > a[href="#${CSS.escape(id)}"]`);
  const build = () => {
    box = document.createElement('div');
    box.className = 'dg-sidenotes dg-web';
    for (const fn of notes) {
      const body = fn.querySelector('.dg-fn-body');
      if (!body) continue;
      const n = document.createElement('div');
      n.className = 'dg-sidenote';
      n.dataset.n = fn.querySelector('.dg-fn-num')?.textContent.trim() || '';
      n.dataset.for = fn.id;
      n.append(...adopt(body.cloneNode(true), null).childNodes);
      box.append(n);
    }
    main.append(box);
  };
  const layout = () => {
    if (!wide.matches) { H.classList.remove('dg-has-sidenotes'); return; }
    if (!box) build();
    H.classList.add('dg-has-sidenotes');
    // the math of the notes obeys D27 in the margin too (D45 a): displays scroll in their own box, inline
    // formulas wider than the note scroll in place; done before the heights are measured
    fitDisplayMath(box);
    fitWideInlineMath(box);
    const top0 = main.getBoundingClientRect().top;
    let floor = 0;
    for (const n of box.children) {
      const ref = mark(n.dataset.for);
      if (!ref) continue;
      const y = Math.max(ref.getBoundingClientRect().top - top0 - 4, floor);
      n.style.top = `${y}px`;
      floor = y + n.offsetHeight + 14;
    }
  };
  // a footnote mark points at its sidenote: highlighted while the mark is hovered or focused
  const note = a => box && box.querySelector(`.dg-sidenote[data-for="${CSS.escape(a.hash.slice(1))}"]`);
  const hot = (e, on) => {
    const a = e.target.closest && e.target.closest('.dg-fnref > a');
    if (a && sidenotesOn() && !a.closest('.dg-inline')) note(a)?.classList.toggle('dg-hot', on);
  };
  document.addEventListener('pointerover', e => hot(e, true));
  document.addEventListener('pointerout', e => hot(e, false));
  document.addEventListener('focusin', e => hot(e, true));
  document.addEventListener('focusout', e => hot(e, false));
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('.dg-fnref > a');
    if (a && sidenotesOn() && !a.closest('.dg-inline')) e.preventDefault();         // the note is beside the mark: no jump to the hidden list
  });
  let t = 0;
  const later = () => { clearTimeout(t); t = setTimeout(layout, 120); };
  mathReady().then(() => {
    layout();
    wide.addEventListener('change', layout);
    window.addEventListener('resize', later);
    if (window.ResizeObserver) new ResizeObserver(later).observe(main);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  });
}

/** ← / → go to the previous / next page, unless a field, an overlay, a scrollable formula or an
 *  interactive figure has the focus (they use the arrow keys themselves). */
function initKeys() {
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const f = document.activeElement;
    if (f && f !== document.body && (f.isContentEditable
      || f.closest('input, textarea, select, dialog, .dg-pop, .dg-interactive, .math.display'))) return;
    if (document.querySelector('dialog[open]') || H.classList.contains('dg-nav-open') || (pop.el && !pop.el.hidden)) return;
    const a = document.querySelector(`.dg-prevnext a[rel="${e.key === 'ArrowLeft' ? 'prev' : 'next'}"]`);
    if (a) { e.preventDefault(); window.location.href = a.href; }
  });
}

// ---- 7. web-layer words and small helpers of sections 8-11 -----------------------------------------
// Every word of interface text below is listed in _port/REVIEW.md.
const WORDS = {
  openHere: 'open here', openPage: 'open page', close: 'close', closeLabel: 'Close',
  copy: 'Copy LaTeX', copied: 'Copied',
  search: 'Search', searchNotes: 'Search the notes', searchSite: 'Search the site',
  scopeNotes: 'These notes', scopeSite: 'Whole site', results: 'Results', noResults: 'No results',
  map: 'Course map', enlarge: 'Enlarge figure', leftOut: '[…]',
};
const ICON = name => `<i class="dg-i dg-i-${name}" aria-hidden="true"></i>`;
const escHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const typing = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
/** The site root (the page shell writes it, relative to the page, in <body data-dg-site>). */
const siteRoot = () => new URL(document.body.dataset.dgSite || '../../', location.href);
/** Path of a course URL inside the course directory ('tangent-spaces/tangent-space.html'), or null. */
function coursePath(href) {
  const u = new URL(href, location.href);
  return u.origin === ROOT.origin && u.pathname.startsWith(ROOT.pathname) ? decodeURI(u.pathname.slice(ROOT.pathname.length)) : null;
}
let srEl = null;
/** Says `text` to screen readers (a polite live region). */
function announce(text) {
  if (!srEl) {
    srEl = document.createElement('div');
    srEl.className = 'dg-sr-only dg-web';
    srEl.setAttribute('role', 'status');
    document.body.append(srEl);
  }
  srEl.textContent = '';
  setTimeout(() => { srEl.textContent = text; }, 30);
}

// ---- 8. appendix content in place (D35) -----------------------------------------------------------
// A reference to a section page of Appendix B (proofs) or C (worked examples) gets an "open here" button.
// It opens the target page's content in a panel after the block that holds the reference (for a reference
// in a footnote: after the block that holds the footnote mark). Fetched at run time, never copied at build
// time, so the panel cannot disagree with the page. The buttons are copied with the footnotes into the
// sidenotes and the footnote popover; all of them work through one delegated click handler.
const APPENDIX_PAGE = /^(proofs-and-additional-material|examples)\/(?!index\.html$)[^/]+\.html$/;
const NOT_OPENABLE = 'h1, h2, h3, h4, h5, h6, .dg-head, .dg-kicker, .dg-prevnext, .dg-chapter-sections, .dg-inline, nav, .dg-web';
const panels = new Set();
let panelSeq = 0;

function initPanels() {
  const main = document.getElementById('dg-main');
  if (!main) return;
  for (const a of main.querySelectorAll('a.dg-xref[data-kind="section"][href]')) {
    const path = coursePath(a.href);
    if (!path || !APPENDIX_PAGE.test(path) || a.closest(NOT_OPENABLE) || pageKey(a.href) === pageKey(location.href)) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dg-open-here dg-web';
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = `${ICON('expand')}<span>${WORDS.openHere}</span>`;
    const keep = document.createElement('span');          // the reference and its button stay on one line
    keep.className = 'dg-xref-open';
    a.before(keep);
    keep.append(a, b);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.dg-open-here');
    if (b) { e.preventDefault(); togglePanel(b); }
  });
}

/** The block after which the panel of button `b` goes (null if it cannot be found). */
function panelBlock(b) {
  const main = document.getElementById('dg-main');
  let from = b.previousElementSibling;
  const note = b.closest('.dg-sidenote, .dg-fn, .dg-pop');
  if (note) {                                            // a footnote: the block that holds its mark
    const id = note.matches('.dg-pop') ? (pop.trigger && pop.trigger.matches('.dg-fnref > a') ? decodeURIComponent(pop.trigger.hash.slice(1)) : '')
      : (note.dataset.for || note.id);
    from = id ? main.querySelector(`.dg-fnref > a[href="#${CSS.escape(id)}"]`) : null;
  }
  if (!from) return null;
  let block = from.closest('p, li, figcaption, td, th, blockquote, .dg-motivation, main') || from.parentElement;
  if (block.matches('figcaption')) block = block.closest('figure') || block;
  else if (block.matches('td, th')) block = block.closest('table') || block;
  return block === main ? from : block;
}

const panelTarget = b => pageKey(b.previousElementSibling.href);
const findPanel = (target, block) => [...panels].find(p => p.dgTarget === target && p.dgBlock === block);
function syncButtons() {
  for (const b of document.querySelectorAll('.dg-open-here')) {
    const block = panelBlock(b), box = block && findPanel(panelTarget(b), block);
    b.setAttribute('aria-expanded', String(!!box));
    if (box) b.setAttribute('aria-controls', box.id); else b.removeAttribute('aria-controls');
  }
}

function closePanel(box, focusTo) {
  panels.delete(box);
  box.remove();
  syncButtons();
  if (focusTo && focusTo.isConnected && focusTo.getClientRects().length) focusTo.focus({ preventScroll: true });
}

async function togglePanel(b) {
  const a = b.previousElementSibling;
  const block = panelBlock(b);
  if (!a || !block) { if (a) location.href = a.href; return; }
  const target = panelTarget(b);
  const open = findPanel(target, block);
  if (open) { closePanel(open, b.isConnected ? b : null); return; }
  if (b.dataset.busy) return;
  b.dataset.busy = '1';
  const far = !!b.closest('.dg-fn, .dg-pop');            // the panel opens away from the button
  let doc;
  try { doc = await fetchPage(target); } catch (err) { delete b.dataset.busy; location.href = a.href; return; }
  delete b.dataset.busy;
  if (findPanel(target, block)) return;
  const box = buildPanel(doc, target);
  box.dgTarget = target;
  box.dgBlock = block;
  let at = block;                                        // after the panels already open at this block
  while (at.nextElementSibling && at.nextElementSibling.matches('.dg-inline')) at = at.nextElementSibling;
  at.after(box);
  panels.add(box);
  box.dgOpener = b.closest('.dg-pop') ? pop.trigger : b;
  if (b.closest('.dg-pop')) hide();
  syncButtons();
  if (far) {
    box.scrollIntoView({ block: 'nearest' });
    box.focus({ preventScroll: true });
  }
  const body = box.querySelector('.dg-inline-body');
  keepTex(body);
  try { await typeset(box); } catch (err) { /* the TeX source stays readable */ }
  box.classList.remove('dg-inline-raw');
  enableFigures(body);
  initCopy(body);
  fitDisplayMath();
  fitWideInlineMath();
}

/** The panel: the item's kicker, number and title from its own page, "open page", "close", and the
 *  children of its <main> except the page header and previous/next (ids removed, URLs rebased). */
function buildPanel(doc, target) {
  const main = doc.querySelector('main') || doc.body;
  const id = `dg-inline-${++panelSeq}`;
  const box = document.createElement('div');
  box.className = 'dg-inline dg-inline-raw dg-web';
  box.id = id;
  box.tabIndex = -1;
  box.setAttribute('role', 'region');
  box.setAttribute('aria-labelledby', `${id}-t`);
  const head = document.createElement('div');
  head.className = 'dg-inline-head';
  const kicker = main.querySelector('.dg-head .dg-kicker');
  const title = main.querySelector('.dg-head .dg-title');
  const k = document.createElement('span');
  k.className = 'dg-inline-kicker';
  k.textContent = kicker ? kicker.textContent.replace(/\s+/g, ' ').trim() : '';
  const t = document.createElement('span');
  t.className = 'dg-inline-title';
  t.id = `${id}-t`;
  if (title) t.append(...adopt(document.importNode(title, true), target).childNodes);
  const tools = document.createElement('span');
  tools.className = 'dg-inline-tools';
  tools.innerHTML = `<a href="${escHtml(target)}">${WORDS.openPage}${ICON('arrow-up-right')}</a>`
    + `<button type="button">${WORDS.close}${ICON('x')}</button>`;
  tools.querySelector('button').addEventListener('click', () => closePanel(box, box.dgOpener));
  head.append(k, t, tools);
  const body = document.createElement('div');
  body.className = 'dg-inline-body';
  body.tabIndex = 0;                                      // it scrolls: keyboard users can scroll it too
  body.setAttribute('aria-labelledby', `${id}-t`);
  for (const el of main.children) {
    if (el.matches('.dg-head, .dg-prevnext, .dg-sidenotes, script')) continue;
    body.append(adopt(document.importNode(el, true), target));
  }
  box.append(head, body);
  return box;
}

// ---- 9. copy LaTeX (D39) ------------------------------------------------------------------------
// Every display equation gets a small button that copies its TeX as it stands in the notes: data-tex,
// written by the converter where it rewrote the source (\label -> \tag, \ref -> number) and kept by
// mathjax-config.js from the element's text before typesetting everywhere else. The button shows on
// hover and keyboard focus (one tab stop per display: at most ~60 on the longest page); on touch-only
// screens, when the equation is tapped.
/** Keeps the TeX of the display equations of a fragment that is about to be typeset. */
function keepTex(root) {
  for (const d of root.querySelectorAll('.math.display:not([data-tex])')) {
    if (!d.querySelector('mjx-container')) d.dataset.tex = d.textContent;
  }
}

function initCopy(root) {
  for (const d of root.querySelectorAll('.math.display')) {
    if (d.closest('.dg-pop, .dg-eq') || !(d.dataset.tex || !d.querySelector('mjx-container'))) continue;
    const w = document.createElement('span');
    w.className = 'dg-eq';
    d.before(w);
    w.append(d);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dg-copy dg-web';
    b.setAttribute('aria-label', WORDS.copy);
    b.title = WORDS.copy;
    b.innerHTML = `${ICON('clipboard')}${ICON('check')}<span class="dg-copy-msg" aria-hidden="true">${WORDS.copied}</span>`;
    w.append(b);
  }
}

function initCopyEvents() {
  const touchOnly = window.matchMedia('(hover: none)');
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.dg-copy');
    if (b) {
      const d = b.parentElement.querySelector('.math.display');
      const tex = d && (d.dataset.tex || d.textContent);
      if (!tex || !navigator.clipboard || !navigator.clipboard.writeText) return;     // silently: nothing to copy with
      navigator.clipboard.writeText(tex).then(() => {
        b.classList.add('dg-done');
        announce(WORDS.copied);
        clearTimeout(b.dgTimer);
        b.dgTimer = setTimeout(() => b.classList.remove('dg-done'), 1600);
      }).catch(() => { /* clipboard refused: silently */ });
      return;
    }
    if (!touchOnly.matches) return;
    const w = e.target.closest && e.target.closest('.dg-eq');
    for (const o of document.querySelectorAll('.dg-eq.dg-on')) if (o !== w) o.classList.remove('dg-on');
    if (w && !e.target.closest('a[href]')) w.classList.toggle('dg-on');
  });
}

async function initCopyButtons() {
  await mathReady();
  const main = document.getElementById('dg-main');
  if (main) initCopy(main);
}

// ---- 10. search (D36, D39) -----------------------------------------------------------------------
// One dialog, two indexes: "Search" in the course bar and the / key search the course's own index
// (assets/search.json); the search button of the site navbar searches the site's index (<site>/search.json,
// which post_render.py extends with the course), as it does on every other page of the site. Each index is
// loaded on first use. Every word of the query must occur (case and accents ignored); ranking: title, then
// section, then text. Results are grouped by page; the formulas of page titles and section names are typeset
// as in the course tree (R10); the text lines keep their short inline formulas whole and typeset them too, and
// never cut through a formula (snippet() below).
const S = { dlg: null, input: null, list: null, empty: null, scope: 'notes', idx: {}, opener: null, hits: [], active: -1, seq: 0, timer: 0, mathTimer: 0 };
const MAX_HITS = 30;
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function loadIndex(scope) {
  if (!S.idx[scope]) {
    const url = scope === 'site' ? new URL('search.json', siteRoot()) : new URL('assets/search.json', ROOT);
    S.idx[scope] = fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(list => list.map((e, i) => ({ e, i, t: fold(e.title || ''), s: fold(e.section || ''), x: fold(e.text || '') })))
      .catch(err => { delete S.idx[scope]; throw err; });
  }
  return S.idx[scope];
}

function rank(index, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const phrase = words.join(' ');
  const hits = [];
  for (const r of index) {
    let score = 0;
    for (const w of words) {
      const inT = r.t.includes(w), inS = r.s.includes(w), inX = r.x.includes(w);
      if (!inT && !inS && !inX) { score = -1; break; }
      score += (inT ? 100 : 0) + (inS ? 20 : 0) + (inX ? 1 : 0);
    }
    if (score < 0) continue;
    if (words.length > 1) score += r.t.includes(phrase) ? 50 : r.s.includes(phrase) ? 10 : r.x.includes(phrase) ? 2 : 0;
    hits.push({ r, score });
  }
  hits.sort((a, b) => b.score - a.score || a.r.i - b.r.i);
  // the best MAX_HITS, grouped by page (pages in the order of their best hit, sections in page order)
  const top = hits.slice(0, MAX_HITS), order = new Map();
  for (const h of top) { const k = h.r.e.href.split('#')[0]; if (!order.has(k)) order.set(k, order.size); }
  return top.sort((a, b) => order.get(a.r.e.href.split('#')[0]) - order.get(b.r.e.href.split('#')[0]) || a.r.i - b.r.i);
}

/** `text` as HTML with every occurrence of the query words in <mark> (accents and case ignored). */
function marked(text, words) {
  let low = '';
  const map = [];
  for (let i = 0; i < text.length; i++) { const f = fold(text[i]); for (let j = 0; j < f.length; j++) map.push(i); low += f; }
  const spans = [];
  for (const w of words) {
    for (let k = low.indexOf(w); k >= 0; k = low.indexOf(w, k + w.length)) spans.push([map[k], map[k + w.length - 1] + 1]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  let out = '', at = 0;
  for (const [a, b] of spans) {
    if (a < at) continue;
    out += escHtml(text.slice(at, a)) + `<mark>${escHtml(text.slice(a, b))}</mark>`;
    at = b;
  }
  return out + escHtml(text.slice(at));
}

/** A page title or section name as HTML: its words marked as above, its formulas (\(..\), as in the index)
 *  left whole and unmarked so that MathJax can typeset them as the course tree shows them. */
function markedTitle(text, words) {
  return text.split(/(\\\(.*?\\\))/s).map((part, i) => (i % 2
    ? `<span class="math inline">${escHtml(part)}</span>` : marked(part, words))).join('');
}

/** Typesets the formulas of the result titles, section names and text lines, once the list has stopped changing; until then they are hidden. Without MathJax the TeX stays readable. */
function typesetHits(seq) {
  clearTimeout(S.mathTimer);
  const els = [...S.list.querySelectorAll('.dg-search-page, .dg-search-sec, .dg-search-text')].filter(el => el.querySelector('.math'));
  if (!els.length) { S.list.classList.remove('dg-search-raw'); return; }
  S.list.classList.add('dg-search-raw');
  S.mathTimer = setTimeout(async () => {
    await mathReady();
    if (seq !== S.seq) return;
    try { if (window.MathJax && MathJax.typesetPromise) await MathJax.typesetPromise(els); } catch (err) { /* the TeX stays */ }
    if (seq === S.seq) S.list.classList.remove('dg-search-raw');
  }, 60);
}

/** The formulas of an index text, whose math is its TeX source as in the notes (D36): [start, end, display],
 *  display for \[..\] and a top-level \begin{..}..\end{..}, inline for \(..\). */
function formulas(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const j = text.indexOf('\\', i);
    if (j < 0) break;
    let end = -1, display = false;
    if (text.startsWith('\\(', j)) { const e = text.indexOf('\\)', j + 2); end = e < 0 ? text.length : e + 2; }
    else if (text.startsWith('\\[', j)) { const e = text.indexOf('\\]', j + 2); end = e < 0 ? text.length : e + 2; display = true; }
    else if (text.startsWith('\\begin{', j)) {
      const name = text.slice(j + 7, text.indexOf('}', j + 7));
      const re = /\\(begin|end)\{([^}]*)\}/g;
      re.lastIndex = j;
      let depth = 0;
      for (let m; (m = re.exec(text));) {
        if (m[2] !== name) continue;
        depth += m[1] === 'begin' ? 1 : -1;
        if (!depth) { end = re.lastIndex; break; }
      }
      if (end < 0) end = text.length;
      display = true;
    }
    if (end < 0) { i = j + 1; continue; }
    out.push([j, end, display]);
    i = end;
  }
  return out;
}

const SNIPPET_MATH = 80;                                // inline formulas longer than this are left out ("[…]")
/** One line of `text` around the first match of the query words, as HTML. It never cuts through a formula: the
 *  window is moved outward to the formulas' boundaries. Inline formulas of up to SNIPPET_MATH characters are kept
 *  whole for MathJax (as in the titles: <mark> only outside math); a display, an environment or a longer formula
 *  becomes "[…]", unless the match lies inside it: then its TeX source is shown as it is, in a monospace span
 *  (around the match, if it is long). */
function snippet(text, words) {
  let low = '';
  const map = [];
  for (let i = 0; i < text.length; i++) { const f = fold(text[i]); for (let j = 0; j < f.length; j++) map.push(i); low += f; }
  let k = -1;
  for (const w of words) { const i = low.indexOf(w); if (i >= 0 && (k < 0 || map[i] < k)) k = map[i]; }
  const F = formulas(text), at = p => F.find(f => p > f[0] && p < f[1]);
  let a = k < 0 ? 0 : Math.max(0, k - 60), b = k < 0 ? Math.min(text.length, 160) : Math.min(text.length, k + 120);
  if (k >= 0 && a > 0) { const sp = text.indexOf(' ', a); a = sp >= 0 && sp < k ? sp + 1 : a; }
  if (k >= 0 && b < text.length) { const sp = text.lastIndexOf(' ', b); b = sp > k ? sp : b; }
  const fa = at(a), fb = at(b);
  if (fa) a = fa[0];
  if (fb) b = fb[1];
  const hit = k >= 0 ? F.find(f => k >= f[0] && k < f[1]) : null;
  let out = a > 0 ? '… ' : '', pos = a;
  for (const f of F) {
    if (f[1] <= a || f[0] >= b) continue;
    out += marked(text.slice(pos, f[0]), words);
    const src = text.slice(f[0], f[1]);
    if (!f[2] && src.length <= SNIPPET_MATH) out += `<span class="math inline">${escHtml(src)}</span>`;
    else if (f === hit) {
      const long = src.length > 160, s0 = long ? Math.max(0, k - f[0] - 60) : 0, s1 = long ? Math.min(src.length, k - f[0] + 100) : src.length;
      out += `<code class="dg-search-tex">${s0 > 0 ? '…' : ''}${marked(src.slice(s0, s1), words)}${s1 < src.length ? '…' : ''}</code>`;
    } else out += WORDS.leftOut;
    pos = f[1];
  }
  out += marked(text.slice(pos, b), words);
  return out + (b < text.length ? ' …' : '');
}

function buildSearch() {
  const d = document.createElement('dialog');
  d.className = 'dg-search dg-dlg dg-web';
  d.setAttribute('aria-label', WORDS.search);
  d.innerHTML = `<div class="dg-search-head">${ICON('search')}
      <input type="search" class="dg-search-input" role="combobox" aria-expanded="false" aria-controls="dg-search-list" aria-autocomplete="list" autocomplete="off" spellcheck="false">
      <button type="button" class="dg-icon-btn dg-dlg-close" aria-label="${WORDS.closeLabel}" title="${WORDS.closeLabel}">${ICON('x')}</button></div>
    <div class="dg-search-scope"><button type="button" data-scope="notes">${WORDS.scopeNotes}</button><button type="button" data-scope="site">${WORDS.scopeSite}</button></div>
    <ul class="dg-search-list" id="dg-search-list" role="listbox" aria-label="${WORDS.results}"></ul>
    <p class="dg-search-empty" hidden>${WORDS.noResults}</p>`;
  document.body.append(d);
  Object.assign(S, { dlg: d, input: d.querySelector('input'), list: d.querySelector('ul'), empty: d.querySelector('.dg-search-empty') });
  d.querySelector('.dg-dlg-close').addEventListener('click', () => d.close());
  d.querySelector('.dg-search-scope').addEventListener('click', e => {
    const b = e.target.closest('button[data-scope]');
    if (b && b.dataset.scope !== S.scope) { setScope(b.dataset.scope); S.input.focus(); }
  });
  d.addEventListener('click', e => {
    if (e.target === d) d.close();                       // a click on the backdrop
    else if (e.target.closest('a[href]')) d.close();     // a result: leave the dialog, follow the link
  });
  d.addEventListener('close', () => {
    const o = S.opener; S.opener = null;
    if (o && o.isConnected) o.focus({ preventScroll: true });
  });
  S.input.addEventListener('input', () => { clearTimeout(S.timer); S.timer = setTimeout(runSearch, 90); });
  S.input.addEventListener('keydown', e => {
    const opts = [...S.list.querySelectorAll('[role="option"]')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!opts.length) return;
      e.preventDefault();
      const n = S.active < 0 ? (e.key === 'ArrowDown' ? 0 : opts.length - 1)
        : (S.active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      setActive(n);
    } else if (e.key === 'Escape') {                    // a search field would clear itself first
      e.preventDefault();
      d.close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = opts[S.active >= 0 ? S.active : 0];
      const a = o && o.querySelector('a[href]');
      if (a) { d.close(); location.href = a.href; }
    }
  });
}

function setActive(n) {
  const opts = [...S.list.querySelectorAll('[role="option"]')];
  opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === n)));
  S.active = n;
  if (opts[n]) { S.input.setAttribute('aria-activedescendant', opts[n].id); opts[n].scrollIntoView({ block: 'nearest' }); }
  else S.input.removeAttribute('aria-activedescendant');
}

function setScope(scope) {
  S.scope = scope;
  const label = scope === 'site' ? WORDS.searchSite : WORDS.searchNotes;
  S.input.placeholder = label;
  S.input.setAttribute('aria-label', label);
  for (const b of S.dlg.querySelectorAll('.dg-search-scope button')) b.setAttribute('aria-pressed', String(b.dataset.scope === scope));
  runSearch();
}

async function runSearch() {
  const seq = ++S.seq, q = S.input.value.trim();
  if (!q) { renderHits([], ''); return; }
  let index;
  try { index = await loadIndex(S.scope); } catch (err) { index = []; }
  if (seq !== S.seq) return;
  renderHits(rank(index, q), q);
}

function renderHits(hits, q) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  const base = siteRoot();
  if (window.MathJax && MathJax.typesetClear) MathJax.typesetClear([S.list]);     // forget the formulas of the old list
  S.list.replaceChildren();
  let group = null, key = null, n = 0;
  for (const { r } of hits) {
    const e = r.e, k = e.href.split('#')[0];
    if (k !== key) {
      key = k;
      const li = document.createElement('li');
      li.className = 'dg-search-group';
      li.setAttribute('role', 'group');
      li.setAttribute('aria-labelledby', `dg-sr-g${n}`);
      li.innerHTML = `<div class="dg-search-page" id="dg-sr-g${n}">${markedTitle(e.title || '', words)}</div><ul role="presentation"></ul>`;
      S.list.append(li);
      group = li.querySelector('ul');
    }
    const text = snippet(e.text || '', words);
    const o = document.createElement('li');
    o.id = `dg-sr-${n++}`;
    o.setAttribute('role', 'option');
    o.setAttribute('aria-selected', 'false');
    o.innerHTML = `<a href="${escHtml(new URL(e.href, base).href)}" tabindex="-1">`
      + (e.section ? `<span class="dg-search-sec">${markedTitle(e.section, words)}</span>` : '')
      + `<span class="dg-search-text">${text}</span></a>`;
    group.append(o);
  }
  S.active = -1;
  S.input.removeAttribute('aria-activedescendant');
  S.input.setAttribute('aria-expanded', String(hits.length > 0));
  S.empty.hidden = !(q && !hits.length);
  typesetHits(S.seq);
}

function openSearch(scope, opener) {
  if (!S.dlg) buildSearch();
  S.opener = opener || document.activeElement;
  setScope(scope);
  if (!S.dlg.open) S.dlg.showModal();
  S.input.focus();
  S.input.select();
}

function initSearch() {
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-act="search"]');
    if (b && !b.closest('dialog')) { e.preventDefault(); openSearch(b.dataset.scope === 'site' ? 'site' : 'notes', b); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (typing(document.activeElement) || document.querySelector('dialog[open]') || H.classList.contains('dg-nav-open')) return;
    e.preventDefault();
    openSearch('notes', document.activeElement);
  });
}

// ---- 11. course map (D39) ------------------------------------------------------------------------
// "Map" in the course bar opens the master roadmap (the figure fig_roadmap_master of §1.1) in a dialog:
// fetched on first use with its caption from its own page, inlined so its badges are links (section 2),
// the badges that point into the current chapter ringed, and a link to the section that holds it.
// Without JavaScript "Map" stays a link to the roadmap on the landing page; on the landing page it scrolls
// to it, as the link does.
const M = { dlg: null, paper: null, opener: null, ready: null, w: 1423, h: 1588 };

function buildMap() {
  const d = document.createElement('dialog');
  d.className = 'dg-mapdlg dg-dlg dg-web';
  d.setAttribute('aria-label', WORDS.map);
  d.innerHTML = `<div class="dg-mapdlg-head"><span class="dg-mapdlg-sec"></span>
      <button type="button" class="dg-icon-btn dg-expand" aria-label="${WORDS.enlarge}" title="${WORDS.enlarge}">${icon('fit')}</button>
      <button type="button" class="dg-icon-btn dg-dlg-close" aria-label="${WORDS.closeLabel}" title="${WORDS.closeLabel}">${ICON('x')}</button></div>
    <div class="dg-mapdlg-body"><div class="dg-mapdlg-fig"><div class="dg-paper dg-mapdlg-paper"></div></div><div class="dg-mapdlg-cap"></div></div>`;
  document.body.append(d);
  M.dlg = d;
  M.paper = d.querySelector('.dg-mapdlg-paper');
  d.querySelector('.dg-dlg-close').addEventListener('click', () => d.close());
  d.querySelector('.dg-expand').addEventListener('click', () => { if (M.paper.dataset.dgSrc) openViewer(M.paper); });
  d.addEventListener('click', e => {
    if (e.target === d) d.close();
    else if (e.target.closest('a[href]') && !e.target.closest('.dg-viewer')) d.close();
  });
  d.addEventListener('close', () => {
    const o = M.opener; M.opener = null;
    if (o && o.isConnected) o.focus({ preventScroll: true });
  });
  window.addEventListener('resize', () => { if (d.open) fitMap(); });
}

/** Scales the roadmap to the space the dialog gives it (both dimensions). */
function fitMap() {
  const svg = M.paper.querySelector('svg, img');
  if (!svg) return;
  const fig = M.dlg.querySelector('.dg-mapdlg-fig'), body = M.dlg.querySelector('.dg-mapdlg-body');
  const side = getComputedStyle(body).gridTemplateColumns.split(' ').length > 1;
  const pad = 2 * (parseFloat(getComputedStyle(M.paper).paddingLeft) || 0) + 2;
  const W = fig.clientWidth - pad, Hh = (side ? fig.clientHeight : body.clientHeight - 12) - pad;
  const s = Math.max(0.05, Math.min(W / M.w, Hh / M.h));
  svg.style.width = `${Math.floor(M.w * s)}px`;
  svg.style.height = `${Math.floor(M.h * s)}px`;
}

async function fillMap() {
  const map = await labels();
  const info = map.fig_roadmap_master;
  if (!info || !info.url) throw new Error('fig_roadmap_master not in labels.json');
  const url = new URL(info.url, ROOT).href, page = pageKey(url);
  const doc = await fetchPage(url);
  const fig = doc.getElementById('fig_roadmap_master'), img = fig && fig.querySelector('img');
  if (!img) throw new Error('fig_roadmap_master has no image');
  const src = new URL(img.getAttribute('src'), page).href;
  M.w = +img.getAttribute('width') || M.w;
  M.h = +img.getAttribute('height') || M.h;
  Object.assign(M.paper.dataset, { dgSrc: src, dgKind: img.dataset.kind || '', dgAlt: img.getAttribute('alt') || '', dgW: String(M.w), dgH: String(M.h) });
  // the link to the section that holds the figure, with the notes' own number and title
  const title = doc.querySelector('.dg-head .dg-title');
  const sec = M.dlg.querySelector('.dg-mapdlg-sec');
  if (title) {
    const a = document.createElement('a');
    a.href = page;
    a.append(...adopt(document.importNode(title, true), page).childNodes);
    sec.replaceChildren(a);
  }
  const cap = fig.querySelector('figcaption');
  const capBox = M.dlg.querySelector('.dg-mapdlg-cap');
  if (cap) { capBox.replaceChildren(...adopt(document.importNode(cap, true), page).childNodes); keepTex(capBox); }
  const pic = document.createElement('img');
  pic.src = src; pic.alt = img.getAttribute('alt') || ''; pic.width = M.w; pic.height = M.h;
  M.paper.replaceChildren(pic);
  fitMap();
  typeset(capBox).catch(() => {}).then(() => fitMap());
  if (img.dataset.kind !== 'svg') return;
  const svg = await inlineSvg(src);
  svg.setAttribute('class', 'dg-map-svg');
  if (pic.alt) { svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', pic.alt); }   // its badges are links
  M.paper.replaceChildren(svg);
  fitMap();
  await linkify(svg);
  ringChapter(svg, map);                                // the badges that point into the current chapter
}

async function openMap(opener) {
  if (!M.dlg) buildMap();
  M.opener = opener;
  if (!M.dlg.open) M.dlg.showModal();
  M.dlg.querySelector('.dg-dlg-close').focus({ preventScroll: true });
  M.ready ||= fillMap().catch(err => { M.ready = null; throw err; });
  try { await M.ready; } catch (err) { M.dlg.close(); if (opener && opener.href) location.href = opener.href; return; }
  fitMap();
}

function initMapDialog() {
  if (document.body.classList.contains('dg-page-landing')) return;     // the roadmap is on the page: the link scrolls to it
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[data-act="map"]');
    if (!a || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openMap(a);
  });
}

// ---- 12. "read" marks (D40) ----------------------------------------------------------------------
// A section page counts as read once its previous/next block is in the viewport after at least 20 seconds on
// the page (D40 as amended), or when the toggle
// at its foot is pressed; pressing it again clears the mark, and then reaching the end does not set it again
// during this visit. Kept in this browser only: localStorage['dg-read'] = JSON array of page slugs (the page's
// path in the course without .html, <body data-dg-slug>). The checks after the section titles (tree, sections
// of the chapter opening pages, landing page's contents) are in the HTML, hidden; this only shows them.
const READ_KEY = 'dg-read';
const READ_DELAY = 20000;                              // ms on the page before the end can mark it (D40)
/** The stored slugs, or null when the storage cannot be read (private mode, blocked, corrupt). */
function readStored() {
  try {
    const v = JSON.parse(localStorage.getItem(READ_KEY) || '[]');
    return new Set(Array.isArray(v) ? v.filter(s => typeof s === 'string') : []);
  } catch (err) { return null; }
}
function storeRead(slug, on) {
  try {
    const s = readStored() || new Set();               // merged with what other tabs stored meanwhile
    if (on) s.add(slug); else s.delete(slug);
    localStorage.setItem(READ_KEY, JSON.stringify([...s]));
  } catch (err) { /* storage unavailable: the mark lasts for this page */ }
}
const slugOf = href => { const p = coursePath(href); return p && p.endsWith('.html') ? p.slice(0, -5) : null; };
function showReadMarks(set) {
  for (const m of document.querySelectorAll('.dg-readmark')) {
    const a = m.closest('a[href]'), s = a && slugOf(a.href);
    m.classList.toggle('dg-on', !!s && set.has(s));
  }
}

function initRead() {
  const read = readStored() || new Set();
  showReadMarks(read);
  window.addEventListener('pageshow', e => {           // back/forward cache: another page may have been read
    const s = e.persisted && readStored();
    if (s) { read.clear(); s.forEach(x => read.add(x)); showReadMarks(read); sync(); }
  });
  const btn = document.querySelector('.dg-readtoggle'), slug = document.body.dataset.dgSlug;
  const sync = () => { if (btn && slug) btn.setAttribute('aria-pressed', String(read.has(slug))); };
  if (!btn || !slug || !document.body.classList.contains('dg-page-reading')) return;
  let unmarked = false;                                // the reader cleared the mark during this visit
  const set = on => {
    if (on) read.add(slug); else read.delete(slug);
    storeRead(slug, on);
    sync();
    showReadMarks(read);
  };
  sync();
  btn.addEventListener('click', () => {
    const on = !read.has(slug);
    if (!on) unmarked = true;
    set(on);
  });
  // the automatic mark (D40 as amended): the end of the page in view AND at least READ_DELAY on the page (time
  // while the page is visible), whichever comes last; the toggle is not affected. Tests shorten the delay by
  // setting window.__dgReadDelay (milliseconds) before this script runs; nothing else uses it.
  const end = document.querySelector('#dg-main .dg-prevnext') || btn;
  if (!('IntersectionObserver' in window)) return;
  const delay = Number.isFinite(window.__dgReadDelay) ? window.__dgReadDelay : READ_DELAY;
  let inView = false, timeOk = false, spent = 0, timer = 0;
  let since = document.visibilityState === 'hidden' ? null : performance.now();
  const io = new IntersectionObserver(entries => {
    inView = entries.some(e => e.isIntersecting);
    check();
  });
  const check = () => {
    if (unmarked) { io.disconnect(); clearTimeout(timer); return; }
    if (inView && timeOk) { io.disconnect(); if (!read.has(slug)) set(true); }
  };
  const arm = () => {
    clearTimeout(timer);
    if (since === null || timeOk) return;
    timer = setTimeout(() => { timeOk = true; check(); }, Math.max(0, delay - spent));
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (since !== null) { spent += performance.now() - since; since = null; } clearTimeout(timer); }
    else if (since === null) { since = performance.now(); arm(); }
  });
  io.observe(end);
  arm();
}

function init() {
  const run =(name, f) => { try { const r = f(); if (r && r.catch) r.catch(err => console.warn(`${name}:`, err)); } catch (err) { console.warn(`${name}:`, err); } };
  run('drawer', initDrawer);
  run('tree', () => revealCurrent());
  run('theme', initTheme);
  run('site navbar', initSiteNav);
  run('scroll', initScroll);
  run('sidenotes', initSidenotes);
  run('keys', initKeys);
  run('decor', drawDecor);
  run('popovers', initPopovers);
  run('figures', initFigures);
  run('maps', initMaps);
  run('wide math', initWideMath);
  run('panels', initPanels);
  run('copy', initCopyEvents);
  run('copy buttons', initCopyButtons);
  run('search', initSearch);
  run('map', initMapDialog);
  run('read', initRead);
  loadInteractives();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
