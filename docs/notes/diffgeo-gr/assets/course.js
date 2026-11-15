// Hand-written: behaviour of the course pages (web layer). Loaded as a module by assets/_head.html.
// Everything here is progressive enhancement: without it the pages still show the notes in full
// (footnotes at the foot of the page, cross-references as plain links, figures as images).
//
//   1. popovers: footnotes (D11) and cross-reference previews (D25), one shared .dg-pop
//   2. figure viewer: click / Enter on a .dg-paper opens a zoom-and-pan <dialog> (D10e)
//   3. links inside TikZ figures: <g class="dg-xref" data-label> in inlined SVGs -> <a> (D10c)
//   4. landing page: the master roadmap is inlined so its badges are links; cover decorations
//   5. interactive figures (D15)

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
// Footnote marks: <sup class="dg-fnref"><a href="#fn-N">; cross-references: <a class="dg-xref">.
// Mouse: hover (with a short delay, and the popover stays while the pointer is over it).
// Keyboard: focus. Touch: the first tap opens, the second follows the link; tap elsewhere closes.
const TRIGGER = '.dg-fnref > a[href*="#"], a.dg-xref[href]';   // Quarto makes the #fn-N hrefs absolute
const pop = { el: null, trigger: null, token: 0, showTimer: 0, hideTimer: 0 };
const previewCache = new Map();
let lastPointer = 'mouse';
let tapWasOpen = false;

function trigger(target) {
  const t = target && target.closest ? target.closest(TRIGGER) : null;
  return t && !t.closest('.dg-pop, .dg-viewer') ? t : null;
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
  el.dataset.kind = t.matches('a.dg-xref') ? (t.dataset.kind || 'xref') : 'footnote';
  el.replaceChildren(content);
  el.hidden = false;
  if (t.matches('a.dg-xref')) t.setAttribute('aria-describedby', 'dg-pop');
  place();
  if (content.classList.contains('dg-pop-raw')) {
    try { await typeset(content); } catch (err) { /* the TeX source stays readable */ }
    content.classList.remove('dg-pop-raw');
    if (token === pop.token) place();
  }
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
      if (p.closest('.dg-web, .dg-footnotes, #title-block-header, .dg-head, figure, nav, .dg-motivation-title')) continue;
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
  if (el.matches('section')) {                           // a subsection: its heading and first lines
    const head = el.querySelector('h1, h2, h3, h4, h5, h6');
    if (head) {
      const h = document.createElement('p');
      h.className = 'dg-pop-title';
      h.append(...adopt(document.importNode(head, true), base).childNodes);
      box.append(h);
    }
    firstParas(el, head, 2).forEach(add);
    return box;
  }
  if (el.matches('.dg-anchor, a:empty, span:empty')) el = el.closest('figure, li, .dg-fn-body, p') || el.parentElement;
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
  const col = (t.closest('main') || document.querySelector('main') || document.body).getBoundingClientRect();
  const vw = document.documentElement.clientWidth, vh = window.innerHeight, m = 8, gap = 6;
  const header = document.getElementById('quarto-header');
  const hb = header ? header.getBoundingClientRect().bottom : 0;
  const topLimit = Math.max(m, hb > 0 ? hb + m : m);
  // a lone display equation lays out its tag against the box width: give it the column's width
  const eq = !!el.querySelector('.math.display') && !el.querySelector('p');
  const maxW = Math.max(200, Math.min(col.width, vw - 2 * m, eq ? 1e4 : 560));
  el.style.maxWidth = `${maxW}px`;
  el.style.width = eq ? `${maxW}px` : '';
  const below = vh - r.bottom - gap - m, above = r.top - gap - topLimit;
  el.style.maxHeight = `${Math.max(120, Math.min(vh * 0.6, Math.max(below, above)))}px`;
  const w = el.offsetWidth, h = el.offsetHeight;
  let lo = Math.max(m, col.left), hi = Math.min(vw - m, col.right) - w;
  if (hi < lo) { lo = m; hi = Math.max(m, vw - m - w); }
  const left = clamp(r.left + r.width / 2 - w / 2, lo, hi);
  const top = (h <= below || below >= above) ? r.bottom + gap : r.top - gap - h;
  el.style.left = `${left + window.scrollX}px`;
  el.style.top = `${top + window.scrollY}px`;
}

/** Quarto attaches its own tippy popup to a[role="doc-noteref"] (option footnotes-hover); ours replaces it. */
function dropQuartoFootnoteTips() {
  for (const a of document.querySelectorAll('.dg-fnref > a')) {
    if (a._tippy) { a._tippy.destroy(); a.removeAttribute('aria-expanded'); }
  }
}

function initPopovers() {
  // Quarto's handlers run on DOMContentLoaded, possibly after this module: undo them then too
  dropQuartoFootnoteTips();
  document.addEventListener('DOMContentLoaded', () => setTimeout(dropQuartoFootnoteTips, 0));
  window.addEventListener('load', dropQuartoFootnoteTips);
  // footnote marks are described by their footnote (always in the page, already typeset)
  for (const a of document.querySelectorAll('.dg-fnref > a[href*="#"]')) {
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
async function inlineSvg(url) {
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
async function linkify(svg) {
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
    if (alt) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', alt); }
    V.paper.replaceChildren(svg);
    await linkify(svg);
  } catch (err) { /* the image stays */ }
}

function initFigures() {
  for (const paper of document.querySelectorAll('main .dg-paper')) {
    if (paper.hasAttribute('data-map') || paper.closest('.dg-interactive')) continue;
    const img = paper.querySelector('img');
    if (!img) continue;
    paper.tabIndex = 0;
    paper.setAttribute('role', 'button');
    const alt = img.getAttribute('alt');
    paper.setAttribute('aria-label', alt ? `Enlarge ${alt}` : 'Enlarge figure');
  }
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

// ---- 4. landing page --------------------------------------------------------------------------
/** The master roadmap is inlined in place, so that its badges are links on the page itself. */
async function initMaps() {
  for (const paper of document.querySelectorAll('.dg-paper[data-map]')) {
    const img = paper.querySelector('img');
    if (!img) continue;
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
    if (img.dataset.kind !== 'svg') continue;
    try {
      const svg = await inlineSvg(img.src);
      const w = +img.getAttribute('width'), h = +img.getAttribute('height');
      if (w && h) svg.style.aspectRatio = `${w} / ${h}`;
      svg.setAttribute('class', 'dg-map-svg');
      if (img.getAttribute('alt')) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', img.getAttribute('alt')); }
      img.replaceWith(svg);
      paper.classList.add('dg-map-live');
      await linkify(svg);
    } catch (err) { /* the image stays; the viewer still opens */ }
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
function fitWideInlineMath() {
  const all = document.querySelectorAll('main mjx-container[jax="CHTML"]:not([display="true"])');
  all.forEach(m => m.classList.remove('dg-math-wide'));
  for (const m of all) {
    const block = m.closest('p, li, td, th, figcaption, div');
    if (!block || m.closest('.math.display, .dg-pop')) continue;
    const r = m.getBoundingClientRect(), b = block.getBoundingClientRect();
    if (r.width && (r.right > b.right + 0.5 || r.left < b.left - 0.5)) m.classList.add('dg-math-wide');
  }
}
// A display equation slightly wider than the column is set a little smaller so that it fits
// (never below 80% of the text size); only what is still too wide scrolls, with a fade at the
// edge where more is hidden (class dg-math-scroll / dg-math-end, styled in course.css).
const MIN_DISPLAY_SCALE = 0.8;
function fitDisplayMath() {
  for (const d of document.querySelectorAll('main .math.display')) {
    if (d.closest('.dg-pop')) continue;
    d.style.fontSize = '';
    const need = d.scrollWidth, have = d.clientWidth;
    if (need > have + 1 && have > 0) {
      d.style.fontSize = (Math.max(MIN_DISPLAY_SCALE, (have - 2) / need) * 100).toFixed(1) + '%';
    }
    const scrolls = d.scrollWidth > d.clientWidth + 1;
    d.classList.toggle('dg-math-scroll', scrolls);
    if (scrolls && !d.dataset.dgScroll) {
      d.dataset.dgScroll = '1';
      d.tabIndex = 0;                                   // keyboard users can scroll it too
      d.addEventListener('scroll', () => d.classList.toggle('dg-math-end', d.scrollLeft + d.clientWidth >= d.scrollWidth - 2), { passive: true });
    }
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
function loadInteractives() {
  const frames = document.querySelectorAll('.dg-interactive[data-module]');
  if (!frames.length) return;
  const start = async frame => {
    try {
      const mod = await import(new URL(`assets/interactive/${frame.dataset.module}.js`, ROOT));
      await mathReady();
      await mod.default(frame.querySelector('.dg-interactive-body'), frame);
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

function init() {
  const run = (name, f) => { try { const r = f(); if (r && r.catch) r.catch(err => console.warn(`${name}:`, err)); } catch (err) { console.warn(`${name}:`, err); } };
  run('decor', drawDecor);
  run('popovers', initPopovers);
  run('figures', initFigures);
  run('maps', initMaps);
  run('wide math', initWideMath);
  loadInteractives();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
