// Hand-written (not generated): shared library of the interactive figures of the course pages.
// One dependency-free ES module. Each interactive (assets/interactive/<name>.js) imports what it
// needs from here and exports `default async function mount(body, frame)` (see course.js, D15).
//
//   palette, tol, vibrant         colours: the page's --dg-* variables and the notes' figure colours
//   el(tag, attrs, ...children)   tiny DOM builder;  setMath(el, text)  (re)typeset TeX in an element
//   controls(parent)              a .dg-controls row
//   slider / choice / stepper / toggle / button / readout / note / legend     labelled native controls
//                                 (aria: plain-text accessible name when the visible label is only TeX, D56)
//   matrix(rows, cols)            numeric matrix or column vector in brackets (plain text; set(M) is cheap)
//   Plot2D                        SVG plot: data->pixel scales (equal: same scale on both axes), axes, lines,
//                                 filled areas, arrows, keyed draggable handles (hit area >= 24 px, D56)
//   Scene3D                       canvas-2D 3D scene: shaded surfaces (colour per quad), curves, points, arrows, drag to rotate;
//                                 project() (world -> canvas px) and grab (drag a picked object instead of rotating)
//   Touch (D56, interactive.css): drawings are touch-action pan-y pinch-zoom, so a vertical swipe scrolls the page;
//   draggable handles are touch-action none and cancel their touchstart; on touch the 3D view rotates only about the vertical.
//   dispose(root)                 stop the observers of the plots and scenes inside root (Reset re-mounts, D55)
import { typeset } from '../course.js';

// ---- colours -------------------------------------------------------------------------------
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
/** Page colours (dark surface), read from course.css. */
export const palette = {
  get bg() { return cssVar('--dg-bg') || '#0b1220'; },
  get surface() { return cssVar('--dg-surface') || '#111b2e'; },
  get text() { return cssVar('--dg-text') || '#e6edfb'; },
  get accent() { return cssVar('--dg-accent') || '#7aa2f7'; },
  get paper() { return cssVar('--dg-paper') || '#ffffff'; },
  ink: '#222222', muted: '#666666', grid: '#dddddd', axis: '#444444'
};
/** Paul Tol "bright" scheme. */
export const tol = { blue: '#4477AA', red: '#EE6677', green: '#228833', yellow: '#CCBB44', cyan: '#66CCEE', purple: '#AA3377', grey: '#BBBBBB' };
/** Paul Tol "vibrant" scheme (the curves of the plots in Appendix C, e.g. Figure C.12). */
export const vibrant = { blue: '#0077BB', orange: '#EE7733', cyan: '#33BBEE', magenta: '#EE3377', red: '#CC3311', teal: '#009988', grey: '#BBBBBB' };

// ---- lifecycle -----------------------------------------------------------------------------
// Plots and scenes observe their size. Reset (course.js, D55) empties the panel and mounts the
// module again, so the old ones must stop observing: they register here and dispose() ends them.
const live = new Set();
export function dispose(root) {
  for (const x of live) if (!x.wrap.isConnected || root.contains(x.wrap)) { x.ro.disconnect(); live.delete(x); }
}

// ---- DOM helpers ---------------------------------------------------------------------------
const SVGNS = 'http://www.w3.org/2000/svg';
let uid = 0;
export const newId = p => `dg-${p}-${++uid}`;

/** el('div', {class: 'x', onclick: f}, 'text', child) */
export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}
function sv(tag, attrs = {}) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  return e;
}

/** Replace the content of `e` by `text` (may contain \( ... \)) and typeset it. */
export async function setMath(e, text) {
  if (e.dataset.tex === text) return;
  e.dataset.tex = text;
  if (window.MathJax && MathJax.typesetClear) { try { MathJax.typesetClear([e]); } catch (_) { /* nothing typeset yet */ } }
  e.textContent = text;
  if (text.includes('\\(')) await typeset(e);
}
const mathSpan = (cls, text) => { const s = el('span', { class: cls }); s.textContent = text; s.dataset.tex = text; return s; };

/** Number formatting with a real minus sign. */
export const fmt = (x, d = 2) => (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d).replace('-', '−');

// ---- controls ------------------------------------------------------------------------------
// Every control returns {el, ...}; labels are TeX or text and are typeset when the module calls
// typeset(body) at the end of mount (or by setMath later).
export function controls(parent) { const c = el('div', { class: 'dg-controls' }); parent.append(c); return c; }

export function slider({ label, aria, min, max, step = 0.01, value, format = v => fmt(v), onInput }) {
  const id = newId('slider');
  const input = el('input', { type: 'range', id, min, max, step, value, 'aria-label': aria });
  const out = el('output', { for: id, class: 'dg-value' }, format(+value));
  const wrap = el('div', { class: 'dg-ctl dg-slider' }, el('label', { for: id }, mathSpan('dg-ctl-label', label)), input, out);
  const api = {
    el: wrap, input,
    get value() { return +input.value; },
    set(v, fire = true) { input.value = v; out.textContent = format(+input.value); if (fire && onInput) onInput(+input.value); }
  };
  input.addEventListener('input', () => { out.textContent = format(+input.value); onInput && onInput(+input.value); });
  return api;
}

/** Segmented radio group. options: [{value, label, aria}] (aria: plain-text name when the label is only TeX) */
export function choice({ label, options, value, onChange }) {
  const name = newId('choice');
  const group = el('div', { class: 'dg-ctl dg-choice', role: 'radiogroup' });
  if (label) { const l = mathSpan('dg-ctl-label', label); l.id = name + '-l'; group.setAttribute('aria-labelledby', l.id); group.append(l); }
  const seg = el('span', { class: 'dg-seg' });
  const inputs = options.map(o => {
    const id = newId('opt');
    const inp = el('input', { type: 'radio', name, id, value: o.value, 'aria-label': o.aria });
    if (String(o.value) === String(value)) inp.checked = true;
    inp.addEventListener('change', () => { if (inp.checked) { api.value = o.value; onChange && onChange(o.value); } });
    seg.append(inp, el('label', { for: id }, mathSpan('', o.label)));
    return inp;
  });
  group.append(seg);
  const api = {
    el: group, value,
    set(v, fire = true) { inputs.forEach(i => { i.checked = i.value === String(v); }); api.value = v; if (fire && onChange) onChange(v); }
  };
  return api;
}

/** Integer stepper: [label  −  n  +]  (aria: plain-text name of the group when the label is only TeX) */
export function stepper({ label, aria, min, max, value, onChange }) {
  const out = el('output', { class: 'dg-value', 'aria-live': 'polite' }, String(value));
  const lab = mathSpan('dg-ctl-label', label); lab.id = newId('stepl');
  const minus = el('button', { type: 'button', class: 'dg-btn dg-btn-icon', 'aria-label': '−' }, '−');
  const plus = el('button', { type: 'button', class: 'dg-btn dg-btn-icon', 'aria-label': '+' }, '+');
  const wrap = el('div', { class: 'dg-ctl dg-stepper', role: 'group', 'aria-labelledby': aria ? null : lab.id, 'aria-label': aria }, lab, minus, out, plus);
  const api = {
    el: wrap, value,
    set(v, fire = true) {
      v = Math.max(min, Math.min(max, v)); api.value = v; out.textContent = String(v);
      minus.disabled = v <= min; plus.disabled = v >= max;
      if (fire && onChange) onChange(v);
    }
  };
  minus.addEventListener('click', () => api.set(api.value - 1));
  plus.addEventListener('click', () => api.set(api.value + 1));
  api.set(value, false);
  return api;
}

/** Checkbox styled as a switch. */
export function toggle({ label, aria, value = false, onChange }) {
  const id = newId('tog');
  const input = el('input', { type: 'checkbox', id, 'aria-label': aria });
  input.checked = value;
  const wrap = el('div', { class: 'dg-ctl dg-toggle' }, input, el('label', { for: id }, mathSpan('dg-ctl-label', label)));
  input.addEventListener('change', () => onChange && onChange(input.checked));
  return {
    el: wrap, input,
    get value() { return input.checked; },
    set(v, fire = true) { input.checked = v; if (fire && onChange) onChange(v); },
    set disabled(d) { input.disabled = d; wrap.classList.toggle('dg-disabled', d); }
  };
}

export function button({ label, onClick, title, pressed }) {
  const b = el('button', { type: 'button', class: 'dg-btn', title }, mathSpan('', label));
  if (pressed != null) b.setAttribute('aria-pressed', String(pressed));
  b.addEventListener('click', e => onClick && onClick(e));
  return b;
}

/** "label = value": the label is TeX (setLabel re-typesets), the value plain text (set is cheap). */
export function readout({ label = '', value = '' }) {
  const l = mathSpan('dg-readout-label', label);
  const v = el('span', { class: 'dg-readout-value' }, value);
  const wrap = el('div', { class: 'dg-readout' }, l, el('span', { class: 'dg-readout-eq' }, '='), v);
  return { el: wrap, set(x) { v.textContent = x; }, setLabel(t) { return setMath(l, t); } };
}

/** Numeric matrix (cols = 1: column vector) in brackets; set(M) takes rows of numbers, M[i][j]. */
export function matrix(rows, cols, digits = 3) {
  const box = el('span', { class: 'dg-mat', style: `grid-template-columns: repeat(${cols}, auto)` });
  const cells = Array.from({ length: rows * cols }, () => box.appendChild(el('span')));
  return { el: box, set(M) { cells.forEach((c, k) => { c.textContent = fmt(M[Math.floor(k / cols)][k % cols], digits); }); } };
}

/** The one instruction line of an interactive. */
export const note = text => mathSpan('dg-note', text);

/** Legend for a drawing area. items: [{label, color, dash, width, marker}] */
export function legend(items) {
  const box = el('div', { class: 'dg-legend' });
  for (const it of items) {
    const sw = sv('svg', { width: 28, height: 12, viewBox: '0 0 28 12', 'aria-hidden': 'true' });
    if (it.marker) sw.append(sv('circle', { cx: 14, cy: 6, r: 4, fill: it.color }));
    else sw.append(sv('line', { x1: 1, y1: 6, x2: 27, y2: 6, stroke: it.color, 'stroke-width': it.width || 2, 'stroke-dasharray': it.dash || null }));
    box.append(el('span', { class: 'dg-legend-item' }, sw, mathSpan('', it.label)));
  }
  return box;
}

/** Nice tick values covering [a, b] with about n ticks. */
export function ticks(a, b, n = 5) {
  const raw = (b - a) / n, mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9 * step; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

/** Composite Simpson rule on [a, b] with n (even) intervals. */
export function simpson(f, a, b, n = 400) {
  n += n % 2;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let k = 1; k < n; k++) s += (k % 2 ? 4 : 2) * f(a + k * h);
  return s * h / 3;
}

// ---- Plot2D --------------------------------------------------------------------------------
/**
 * new Plot2D(parent, {xlim, ylim, aspect, equal, maxWidth, margin, axes, grid, xticks, yticks, draw, label})
 * equal: the height follows the width so that one unit has the same length on both axes (aspect ignored).
 * role: of the svg when it has a label, 'img' by default; 'group' when it holds focusable handles.
 * `draw(plot)` is called on every update() and on resize; it adds primitives with plot.line(...),
 * plot.arrow(...), etc. Primitives given a `key` keep their DOM node across updates (so focus and
 * pointer capture survive); the others are rebuilt. HTML labels (plot.label) hold typeset TeX.
 */
export class Plot2D {
  constructor(parent, opt = {}) {
    this.o = Object.assign({ xlim: [0, 1], ylim: [0, 1], aspect: 0.75, maxWidth: Infinity, margin: { l: 44, r: 12, t: 12, b: 34 }, axes: true, grid: true }, opt);
    this.wrap = el('div', { class: 'dg-plot dg-paperbox' });
    this.svg = sv('svg', { class: 'dg-plot-svg', role: opt.label ? opt.role || 'img' : null, 'aria-label': opt.label || null });
    this.layers = {};
    for (const n of ['grid', 'axes', 'main', 'top', 'hits', 'handles']) { this.layers[n] = sv('g', { 'data-layer': n }); this.svg.append(this.layers[n]); }
    this.html = el('div', { class: 'dg-plot-labels' });
    this.wrap.append(this.svg, this.html);
    parent.append(this.wrap);
    this.keyed = new Map(); this.labels = new Map(); this.used = new Set();
    this.drag = null;
    this.ro = new ResizeObserver(() => this.update());
    this.ro.observe(this.wrap);
    live.add(this);
    this.update();
  }
  set(opt) { Object.assign(this.o, opt); this.update(); }
  get width() { return this.w; }
  sx(x) { const [a, b] = this.o.xlim, m = this.o.margin; return m.l + (x - a) / (b - a) * (this.w - m.l - m.r); }
  sy(y) { const [a, b] = this.o.ylim, m = this.o.margin; return this.h - m.b - (y - a) / (b - a) * (this.h - m.t - m.b); }
  px([x, y]) { return [this.sx(x), this.sy(y)]; }
  /** Pixel position (relative to the svg) -> data coordinates. */
  toData(px, py) {
    const [a, b] = this.o.xlim, [c, d] = this.o.ylim, m = this.o.margin;
    return [a + (px - m.l) / (this.w - m.l - m.r) * (b - a), c + (this.h - m.b - py) / (this.h - m.t - m.b) * (d - c)];
  }
  eventPx(e) { const r = this.svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  update() {
    const W = this.wrap.clientWidth || 300;
    this.w = Math.min(W, this.o.maxWidth);
    const m = this.o.margin, [a, b] = this.o.xlim, [c, d] = this.o.ylim;
    this.h = Math.round(this.o.equal ? (this.w - m.l - m.r) * (d - c) / (b - a) + m.t + m.b : this.w * this.o.aspect);
    this.svg.setAttribute('width', this.w); this.svg.setAttribute('height', this.h);
    this.svg.setAttribute('viewBox', `0 0 ${this.w} ${this.h}`);
    this.html.style.width = this.w + 'px'; this.html.style.height = this.h + 'px';
    for (const g of Object.values(this.layers)) for (const c of [...g.children]) if (!c.dataset.key) c.remove();
    this.used.clear();
    if (this.o.axes) this.drawAxes();
    this.o.draw && this.o.draw(this);
    for (const [k, n] of this.keyed) if (!this.used.has(k)) { n.remove(); this.keyed.delete(k); }
    for (const [k, n] of this.labels) if (!this.used.has('L' + k)) { n.remove(); this.labels.delete(k); }
  }

  node(tag, attrs, { key, layer = 'main' } = {}) {
    let n = key != null ? this.keyed.get(key) : null;
    if (!n) {
      n = sv(tag);
      if (key != null) { n.dataset.key = key; this.keyed.set(key, n); }
      this.layers[layer].append(n);
    }
    if (key != null) this.used.add(key);
    for (const [k, v] of Object.entries(attrs)) if (v == null) n.removeAttribute(k); else n.setAttribute(k, v);
    return n;
  }

  drawAxes() {
    const { xlim, ylim, grid } = this.o, m = this.o.margin;
    const xt = this.o.xticks || ticks(xlim[0], xlim[1], Math.max(3, Math.round(this.w / 80)));
    const yt = this.o.yticks || ticks(ylim[0], ylim[1], Math.max(3, Math.round(this.h / 60)));
    const x0 = m.l, x1 = this.w - m.r, y0 = this.h - m.b, y1 = m.t;
    for (const t of xt) {
      const x = this.sx(t);
      if (grid) this.node('line', { x1: x, x2: x, y1: y0, y2: y1, class: 'dg-grid' }, { layer: 'grid' });
      this.node('line', { x1: x, x2: x, y1: y0, y2: y0 + 4, class: 'dg-tick' }, { layer: 'axes' });
      this.node('text', { x, y: y0 + 16, 'text-anchor': 'middle', class: 'dg-ticklabel' }, { layer: 'axes' }).textContent = fmtTick(t, xt);
    }
    for (const t of yt) {
      const y = this.sy(t);
      if (grid) this.node('line', { x1: x0, x2: x1, y1: y, y2: y, class: 'dg-grid' }, { layer: 'grid' });
      this.node('line', { x1: x0 - 4, x2: x0, y1: y, y2: y, class: 'dg-tick' }, { layer: 'axes' });
      this.node('text', { x: x0 - 7, y: y + 4, 'text-anchor': 'end', class: 'dg-ticklabel' }, { layer: 'axes' }).textContent = fmtTick(t, yt);
    }
    this.node('rect', { x: x0, y: y1, width: x1 - x0, height: y0 - y1, class: 'dg-frame' }, { layer: 'axes' });
  }

  /** Polyline through data points. opt: color, width, dash, opacity, key, layer */
  line(pts, opt = {}) {
    const d = pts.map((p, i) => (i ? 'L' : 'M') + this.sx(p[0]).toFixed(1) + ' ' + this.sy(p[1]).toFixed(1)).join('');
    return this.node('path', { d, fill: 'none', stroke: opt.color || palette.ink, 'stroke-width': opt.width || 1.5, 'stroke-dasharray': opt.dash || null,
      opacity: opt.opacity, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: opt.class }, opt);
  }
  /** Closed filled polygon. opt: fill, opacity (of the fill), color (outline), width, dash, key, layer */
  area(pts, opt = {}) {
    const d = pts.map((p, i) => (i ? 'L' : 'M') + this.sx(p[0]).toFixed(1) + ' ' + this.sy(p[1]).toFixed(1)).join('') + 'Z';
    return this.node('path', { d, fill: opt.fill || palette.grid, 'fill-opacity': opt.opacity ?? 0.3, stroke: opt.color || 'none',
      'stroke-width': opt.width || 1.2, 'stroke-dasharray': opt.dash || null, class: opt.class }, opt);
  }
  /** Function graph y = f(x) on [a, b]. */
  fn(f, a, b, opt = {}) { const n = opt.n || 200, pts = []; for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; pts.push([x, f(x)]); } return this.line(pts, opt); }
  point(p, opt = {}) {
    const [x, y] = this.px(p);
    return this.node('circle', { cx: x, cy: y, r: opt.r || 4, fill: opt.fill || opt.color || palette.ink, stroke: opt.stroke || null, 'stroke-width': opt.strokeWidth || null, class: opt.class }, opt);
  }
  /** Plain SVG text (no TeX) at a data point, offset (dx, dy) in px. */
  text(p, str, opt = {}) {
    const [x, y] = this.px(p);
    const n = this.node('text', { x: x + (opt.dx || 0), y: y + (opt.dy || 0), 'text-anchor': opt.anchor || 'middle', fill: opt.color || palette.ink, class: opt.class || 'dg-svgtext' }, opt);
    n.textContent = str; return n;
  }
  /**
   * Arrow from data point p to q, optionally bent (quadratic curve; bend = offset of the control
   * point in px, perpendicular to p->q). shorten: [px at start, px at end]. A wide transparent
   * stroke makes it easy to hit; returns the <g> (pass key/onClick/tabindex to make it interactive).
   */
  arrow(p, q, opt = {}) {
    let [x0, y0] = this.px(p), [x1, y1] = this.px(q);
    const [s0, s1] = opt.shorten || [0, 0], head = opt.head ?? 9, bend = opt.bend || 0;
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    const cx = (x0 + x1) / 2 - uy * bend, cy = (y0 + y1) / 2 + ux * bend;
    const pull = (ax, ay, bx, by, s) => { const l = Math.hypot(bx - ax, by - ay) || 1; return [ax + (bx - ax) * s / l, ay + (by - ay) * s / l]; };
    [x0, y0] = pull(x0, y0, cx, cy, s0); [x1, y1] = pull(x1, y1, cx, cy, s1);
    const tl = Math.hypot(x1 - cx, y1 - cy) || 1, tx = (x1 - cx) / tl, ty = (y1 - cy) / tl;   // direction at the tip
    const bx = x1 - tx * head * 0.8, by = y1 - ty * head * 0.8;                              // shaft ends inside the head
    const d = bend ? `M${x0} ${y0}Q${cx} ${cy} ${bx} ${by}` : `M${x0} ${y0}L${bx} ${by}`;
    const color = opt.color || palette.ink, w = opt.width || 1.8;
    const g = this.node('g', { class: 'dg-arrow ' + (opt.class || ''), tabindex: opt.tabindex, role: opt.role, 'aria-label': opt.ariaLabel }, opt);
    if (!g.firstChild) g.append(sv('path', { class: 'dg-hit' }), sv('path', { class: 'dg-shaft' }), sv('path', { class: 'dg-head' }));
    const [hit, shaft, hd] = g.children;
    hit.setAttribute('d', d); hit.setAttribute('fill', 'none'); hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', 14);
    shaft.setAttribute('d', d); shaft.setAttribute('fill', 'none'); shaft.setAttribute('stroke', color); shaft.setAttribute('stroke-width', w);
    shaft.setAttribute('stroke-dasharray', opt.dash || ''); shaft.setAttribute('stroke-linecap', 'round');
    const nx = -ty, ny = tx, hb = head, hw = head * 0.42;
    hd.setAttribute('d', `M${x1} ${y1}L${x1 - tx * hb + nx * hw} ${y1 - ty * hb + ny * hw}L${x1 - tx * hb * 0.72} ${y1 - ty * hb * 0.72}L${x1 - tx * hb - nx * hw} ${y1 - ty * hb - ny * hw}Z`);
    hd.setAttribute('fill', color);
    if (opt.onClick && !g.dataset.wired) {
      g.dataset.wired = '1';
      g.addEventListener('click', e => g._onClick(e));
      g.addEventListener('keydown', e => { if (['Enter', ' ', 'Delete', 'Backspace'].includes(e.key)) { e.preventDefault(); g._onClick(e); } });
    }
    g._onClick = opt.onClick;
    return g;
  }
  /**
   * Focusable circle that keeps its node across updates. opt: key (required), r, fill, stroke,
   * ariaLabel, onDrag(x, y) (pointer drag and arrow keys; return nothing), step [dx, dy] for keys,
   * onKey(e) (return true if handled), onPointerDown(e). A handle that can be dragged (onDrag or
   * onPointerDown) and is drawn smaller than HIT gets a transparent disc of radius HIT under all the
   * handles (layer 'hits', class dg-handle-hit), which starts the same drag: hit area >= 24 px (D56).
   * A touch that starts on a draggable handle or its disc must drag it, not scroll the page: Chromium ignores
   * touch-action on SVG shapes (only the <svg> box counts, which is pan-y), so their touchstart is cancelled.
   */
  handle(p, opt) {
    const [x, y] = this.px(p), r = opt.r || 7, drags = o => !!(o.onDrag || o.onPointerDown);
    const n = this.node('circle', { cx: x, cy: y, r, fill: opt.fill || palette.ink, stroke: opt.stroke || '#fff', 'stroke-width': opt.strokeWidth ?? 1.5,
      tabindex: 0, role: opt.role || 'button', 'aria-label': opt.ariaLabel, class: 'dg-handle ' + (opt.class || '') }, { key: opt.key, layer: 'handles' });
    n._opt = opt; n._p = p;
    const down = e => {
      const o = n._opt;
      if (o.onPointerDown) return o.onPointerDown(e);
      if (!o.onDrag) return;
      e.preventDefault(); n.focus();
      this.svg.setPointerCapture(e.pointerId);
      this.drag = { node: n, id: e.pointerId };
    };
    if (drags(opt) && r < HIT) {
      const h = this.node('circle', { cx: x, cy: y, r: HIT, fill: 'transparent', class: 'dg-handle-hit', 'aria-hidden': 'true' }, { key: opt.key + '~hit', layer: 'hits' });
      if (!h.dataset.wired) {
        h.dataset.wired = '1';
        h.addEventListener('pointerdown', e => h._down(e));
        h.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
      }
      h._down = down;
    }
    if (!n.dataset.wired) {
      n.dataset.wired = '1';
      n.addEventListener('pointerdown', e => n._down(e));
      n.addEventListener('touchstart', e => { if (drags(n._opt)) e.preventDefault(); }, { passive: false });
      n.addEventListener('keydown', e => {
        const o = n._opt;
        if (o.onKey && o.onKey(e)) { e.preventDefault(); return; }
        if (!o.onDrag) return;
        const [dx, dy] = o.step || [(this.o.xlim[1] - this.o.xlim[0]) / 100, (this.o.ylim[1] - this.o.ylim[0]) / 100];
        const mv = { ArrowLeft: [-dx, 0], ArrowRight: [dx, 0], ArrowUp: [0, dy], ArrowDown: [0, -dy] }[e.key];
        if (mv) { e.preventDefault(); o.onDrag(n._p[0] + mv[0], n._p[1] + mv[1]); }
      });
      if (!this.svg.dataset.wired) {
        this.svg.dataset.wired = '1';
        this.svg.addEventListener('pointermove', e => {
          if (!this.drag || this.drag.id !== e.pointerId) return;
          const [x, y] = this.toData(...this.eventPx(e));
          this.drag.node._opt.onDrag(x, y);
        });
        const end = e => { if (this.drag && this.drag.id === e.pointerId) this.drag = null; };
        this.svg.addEventListener('pointerup', end);
        this.svg.addEventListener('pointercancel', end);
      }
    }
    n._down = down;
    return n;
  }
  /**
   * HTML label (TeX allowed) at a data point. anchor: one of c n s e w ne nw se sw (the side of
   * the text that touches the point); dx, dy in px. The text is typeset once and only moved later.
   */
  label(key, p, text, opt = {}) {
    let n = this.labels.get(key);
    if (!n) { n = el('span', { class: 'dg-plot-label ' + (opt.class || '') }); this.html.append(n); this.labels.set(key, n); }
    this.used.add('L' + key);
    const [x, y] = this.px(p);
    const a = opt.anchor || 'c';
    const tx = a.includes('e') ? '-100%' : a.includes('w') ? '0' : '-50%';
    const ty = a.includes('n') ? '0' : a.includes('s') ? '-100%' : '-50%';
    n.style.left = (x + (opt.dx || 0)) + 'px'; n.style.top = (y + (opt.dy || 0)) + 'px';
    n.style.transform = `translate(${tx}, ${ty})${opt.rotate ? ` rotate(${opt.rotate}deg)` : ''}`;
    if (opt.color) n.style.color = opt.color;
    if (n.dataset.tex !== text) setMath(n, text);
    return n;
  }
}
const HIT = 12;                                           // px: radius of the hit area of a draggable handle
function fmtTick(t, all) {
  const step = all.length > 1 ? Math.abs(all[1] - all[0]) : 1;
  const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return fmt(t, d);
}

// ---- Scene3D -------------------------------------------------------------------------------
/**
 * new Scene3D(parent, {aspect, azimuth, elevation, perspective, zoom, center, radius, light, label})
 * World coordinates (x, y, z), z up; azimuth/elevation in degrees as in matplotlib (azimuth -90:
 * looking along +y, x to the right). perspective 0 = orthographic, else the camera distance in
 * units of the scene radius (weak perspective). Primitives (each may carry a `tag` so that
 * clear(tag) removes just those): surface, polyline, point, arrow. Call render() after changes;
 * it draws once on the next animation frame (no permanent loop). Drag / arrow keys rotate (on touch,
 * horizontal drags only: azimuth), double click or Home resets the view.
 * grab(x, y): optional; called with the canvas position (css px) of a pointer or touch that starts on the canvas.
 * If it returns a function, that function receives the positions of the drag (move(x, y)) instead of the view
 * rotating, and a touch that starts there does not scroll the page (D56). It must not change anything itself.
 */
export class Scene3D {
  constructor(parent, opt = {}) {
    this.o = Object.assign({ aspect: 0.8, azimuth: -90, elevation: 22, perspective: 0, zoom: 1, light: [-0.4, 0.7, 0.6] }, opt);
    this.view0 = [this.o.azimuth, this.o.elevation];
    this.prims = [];
    this.wrap = el('div', { class: 'dg-scene dg-paperbox' });
    this.canvas = el('canvas', { tabindex: 0, class: 'dg-canvas', role: 'img', 'aria-label': opt.label || null });
    this.wrap.append(this.canvas);
    parent.append(this.wrap);
    this.ctx = this.canvas.getContext('2d');
    this.queued = false;
    this.wire();
    this.ro = new ResizeObserver(() => this.render());
    this.ro.observe(this.wrap);
    live.add(this);
  }
  clear(tag) { this.prims = tag == null ? [] : this.prims.filter(p => p.tag !== tag); return this; }
  /**
   * Parametric surface f(u, v) -> [x, y, z] as a quad mesh. opt: u: [u0, u1, nu], v: [v0, v1, nv],
   * color (or a function (u, v) -> colour, called at the centre of each quad), alpha,
   * mesh: {color, width, alpha, everyU, everyV} (thin lines on every k-th grid line), tag.
   */
  surface(f, opt) {
    const [u0, u1, nu] = opt.u, [v0, v1, nv] = opt.v;
    const P = [];
    for (let i = 0; i <= nu; i++) { P.push([]); for (let j = 0; j <= nv; j++) P[i].push(f(u0 + (u1 - u0) * i / nu, v0 + (v1 - v0) * j / nv)); }
    const m = opt.mesh || null, eu = m ? m.everyU || 1 : 0, ev = m ? m.everyV || 1 : 0;
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const q = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]];
      // grid lines carried by this quad: v = const lines at j (and at j+1 on the last row), u = const at i (and i+1)
      const edges = [];
      if (m) {
        if (j % ev === 0) edges.push(0);                       // q0-q1 : v = v_j
        if (i % eu === 0) edges.push(3);                       // q3-q0 : u = u_i
        if (j === nv - 1 && (j + 1) % ev === 0) edges.push(2); // q2-q3 : v = v_{j+1}
        if (i === nu - 1 && (i + 1) % eu === 0) edges.push(1); // q1-q2 : u = u_{i+1}
      }
      const col = typeof opt.color === 'function' ? opt.color(u0 + (u1 - u0) * (i + 0.5) / nu, v0 + (v1 - v0) * (j + 0.5) / nv) : opt.color;
      this.prims.push({ type: 'quad', pts: q, color: col || '#d0d0d0', alpha: opt.alpha ?? 0.4, edges, mesh: m, tag: opt.tag, surf: true });
    }
    return this;
  }
  /** Polyline; bias (scene units, default 0.02 of the radius) brings it in front of the quads it lies on. */
  polyline(pts, opt = {}) {
    const line = {};                                      // shared by the segments: dashes follow the arc length
    for (let i = 0; i + 1 < pts.length; i++) this.prims.push({ type: 'seg', pts: [pts[i], pts[i + 1]], color: opt.color || palette.ink, width: opt.width || 2, dash: opt.dash, bias: opt.bias, tag: opt.tag, line });
    return this;
  }
  point(p, opt = {}) { this.prims.push({ type: 'pt', pts: [p], color: opt.color || palette.ink, r: opt.r || 3.5, label: opt.label, offset: opt.offset || [6, -6], tag: opt.tag }); return this; }
  arrow(p, q, opt = {}) { this.prims.push({ type: 'arrow', pts: [p, q], color: opt.color || palette.ink, width: opt.width || 1.8, tag: opt.tag }); return this; }

  setView(az, el) { this.o.azimuth = az; this.o.elevation = Math.max(-89, Math.min(89, el)); this.render(); }
  reset() { this.setView(...this.view0); }

  wire() {
    const c = this.canvas;
    let drag = null;
    const at = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const grab = e => this.o.grab && this.o.grab(...at(e));
    c.addEventListener('pointerdown', e => {
      const move = grab(e);
      if (move) e.preventDefault();
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId, move }; c.setPointerCapture(e.pointerId); c.classList.add('dg-grabbing');
    });
    c.addEventListener('touchstart', e => { if (e.touches.length === 1 && grab(e.touches[0])) e.preventDefault(); }, { passive: false });
    c.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      if (drag.move) { drag.move(...at(e)); return; }
      // on touch only horizontal drags rotate (azimuth): vertical swipes scroll the page (touch-action pan-y, D56)
      const dx = e.clientX - drag.x, dy = e.pointerType === 'touch' ? 0 : e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      this.setView(this.o.azimuth - dx * 0.5, this.o.elevation + dy * 0.5);
    });
    const end = () => { drag = null; c.classList.remove('dg-grabbing'); };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
    c.addEventListener('dblclick', () => this.reset());
    c.addEventListener('keydown', e => {
      const k = { ArrowLeft: [5, 0], ArrowRight: [-5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key];
      if (k) { e.preventDefault(); this.setView(this.o.azimuth + k[0], this.o.elevation + k[1]); }
      else if (e.key === 'Home') { e.preventDefault(); this.reset(); }
    });
  }

  bounds() {
    if (this.o.center && this.o.radius) return [this.o.center, this.o.radius];
    const src = this.prims.some(p => p.surf) ? this.prims.filter(p => p.surf) : this.prims;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of src) for (const q of p.pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); }
    const c = this.o.center || lo.map((v, k) => (v + hi[k]) / 2);
    let r = 0;
    for (const p of src) for (const q of p.pts) r = Math.max(r, Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]));
    return [c, this.o.radius || r || 1];
  }

  render() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => { this.queued = false; this.draw(); });
  }

  /** The current view: canvas size (css px), camera vectors and proj(p) -> [x, y, depth] (larger depth: nearer the viewer). */
  view() {
    const W = this.wrap.clientWidth || 300, H = Math.round(W * this.o.aspect);
    const az = this.o.azimuth * Math.PI / 180, elv = this.o.elevation * Math.PI / 180;
    const eye = [Math.cos(elv) * Math.cos(az), Math.cos(elv) * Math.sin(az), Math.sin(elv)];
    const right = [-Math.sin(az), Math.cos(az), 0];
    const up = [-Math.sin(elv) * Math.cos(az), -Math.sin(elv) * Math.sin(az), Math.cos(elv)];
    const [cen, R] = this.bounds();
    const scale = Math.min(W, H) / (2 * R) * this.o.zoom, D = this.o.perspective;
    const proj = p => {
      const d = [p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]];
      const z = dot3(d, eye), k = D ? D * R / (D * R - z) : 1;
      return [W / 2 + dot3(d, right) * scale * k, H / 2 - dot3(d, up) * scale * k, z];
    };
    return { W, H, eye, right, up, R, proj };
  }
  /** Canvas position (css px) and depth of the world point p in the current view. */
  project(p) { return this.view().proj(p); }

  /** Draw now (normally called through render()). */
  draw() {
    const { W, H, eye, right, up, R, proj } = this.view(), dpr = window.devicePixelRatio || 1;
    const c = this.canvas, ctx = this.ctx;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + 'px'; c.style.height = H + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    if (!this.prims.length) return;
    const dot = dot3;
    // light fixed relative to the viewer, given as [right, up, towards the viewer]
    const L = this.o.light, ln = Math.hypot(...L);
    const lw = [0, 1, 2].map(k => (L[0] * right[k] + L[1] * up[k] + L[2] * eye[k]) / ln);
    const list = [];
    const bias0 = 0.03 * R, run = new Map();
    for (const p of this.prims) {
      const s = p.pts.map(proj);
      let depth = s.reduce((a, q) => a + q[2], 0) / s.length;
      if (p.type !== 'quad') depth += p.bias ?? bias0;
      let off = 0;
      if (p.dash && p.line) { off = run.get(p.line) || 0; run.set(p.line, off + Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1])); }
      list.push({ p, s, depth, off });
    }
    list.sort((a, b) => a.depth - b.depth);
    const labels = [];
    for (const { p, s, off } of list) {
      if (p.type === 'quad') {
        const [a, b, cc, d] = p.pts;
        const u = [cc[0] - a[0], cc[1] - a[1], cc[2] - a[2]], v = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const nl = Math.hypot(...n) || 1;
        const shade = 0.72 + 0.28 * Math.abs(dot(n, lw) / nl);
        ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(s[k][0], s[k][1]); ctx.closePath();
        ctx.globalAlpha = p.alpha; ctx.fillStyle = shadeHex(p.color, shade); ctx.fill();
        // hide the hairline seams between neighbouring translucent quads
        ctx.lineWidth = 0.6; ctx.strokeStyle = ctx.fillStyle; ctx.globalAlpha = p.alpha * 0.5; ctx.stroke();
        if (p.edges.length) {
          ctx.globalAlpha = p.mesh.alpha ?? 0.8; ctx.strokeStyle = p.mesh.color || '#bbbbbb'; ctx.lineWidth = p.mesh.width || 0.6;
          ctx.beginPath();
          for (const e of p.edges) { const A = s[e], B = s[(e + 1) % 4]; ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (p.type === 'seg' || p.type === 'arrow') {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.width; ctx.lineCap = 'round';
        ctx.setLineDash(p.dash || []);
        ctx.lineDashOffset = off;
        ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); ctx.lineTo(s[1][0], s[1][1]); ctx.stroke();
        ctx.setLineDash([]);
        if (p.type === 'arrow') {
          const dx = s[1][0] - s[0][0], dy = s[1][1] - s[0][1], l = Math.hypot(dx, dy) || 1, tx = dx / l, ty = dy / l, h = 8;
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(s[1][0], s[1][1]);
          ctx.lineTo(s[1][0] - tx * h - ty * h * 0.4, s[1][1] - ty * h + tx * h * 0.4);
          ctx.lineTo(s[1][0] - tx * h + ty * h * 0.4, s[1][1] - ty * h - tx * h * 0.4); ctx.fill();
        }
      } else if (p.type === 'pt') {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(s[0][0], s[0][1], p.r, 0, 2 * Math.PI); ctx.fill();
        if (p.label) labels.push([p, s[0]]);
      }
    }
    // point labels last, always readable: italic serif with a white halo
    ctx.font = 'italic 15px "Latin Modern Roman", "CMU Serif", "Times New Roman", serif';
    ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const [p, q] of labels) {
      const x = q[0] + p.offset[0], y = q[1] + p.offset[1];
      ctx.textAlign = p.offset[0] < 0 ? 'right' : 'left';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(p.label, x, y);
      ctx.fillStyle = p.color; ctx.fillText(p.label, x, y);
    }
  }
}
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
