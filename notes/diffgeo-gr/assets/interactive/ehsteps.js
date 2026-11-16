// Hand-written (not generated): interactive after Figure 10.3 (label fig_EH_chain_rule, §10.2), the flowchart of step 3 of
// the variation of the Einstein–Hilbert action, shown panel by panel (D58). Nothing of the figure is redrawn: the module
// inlines the figure's own SVG (the file the static figure shows, fetched and linked by course.js as the roadmaps are, so
// its \ref badges are links) and only changes what is seen: the viewBox, zoomed to the current panel with a margin, and a
// veil in the paper's colour with a hole over that panel, which dims the others. The panels are the figure's top-level
// TikZ `local bounding box` scopes; their rectangles come from the figure build (figures/<name>.boxes.json, figboxes.py),
// and the converter passes the order of the steps (the reading order the caption states, _port/interactives.json) as
// data-steps. The step shows the panel's own mark as the figure prints it: (A) … (H) for Abox … Hbox, the heading
// "(∗) of (E)" for Xbox, nothing for the first line (Sbox).
import { el, note } from './dg.js';
import { inlineSvg, linkify } from '../course.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const CM = 72 / 2.54;                    // the SVG's user unit is the PostScript point
export const MARGIN = 0.7 * CM;          // around the panel in the view (just clear of the column heads above the first panels)
export const HOLE = 0.5 * CM;            // the undimmed rectangle around the panel (its frame is drawn 0.42 cm out)
const MS = 320;                          // transition, only without prefers-reduced-motion
export const TAG = { Sbox: '', Xbox: '(∗) of (E)' };
export const tag = name => (name in TAG ? TAG[name] : /^[A-Z]box$/.test(name) ? `(${name[0]})` : '');

const grow = ([x, y, w, h], m) => [x - m, y - m, w + 2 * m, h + 2 * m];
const fmt = r => r.map(v => +v.toFixed(3)).join(' ');
const ease = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default async function mount(body, frame) {
  const steps = (frame.dataset.steps || '').split(/\s+/).filter(Boolean);
  const fig = document.getElementById(frame.dataset.for || '');
  const img = fig && fig.querySelector('img');
  if (!steps.length || !img || img.dataset.kind !== 'svg') throw new Error('ehsteps: no steps or no SVG figure');
  const src = new URL(img.getAttribute('src'), document.baseURI).href;
  const [svg, data] = await Promise.all([inlineSvg(src),
    fetch(src.replace(/\.svg$/, '.boxes.json')).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })]);
  const missing = steps.filter(s => !data.boxes[s]);
  if (missing.length) throw new Error(`ehsteps: no box ${missing.join(', ')}`);
  const whole = data.viewBox, N = steps.length;
  const view = steps.map(s => grow(data.boxes[s], MARGIN)), hole = steps.map(s => grow(data.boxes[s], HOLE));

  body.append(note('Figure 10.3 one panel at a time, in the order of its caption: Previous and Next, or the arrow keys.'));
  const prev = el('button', { type: 'button', class: 'dg-btn dg-ehs-prev', onclick: () => go(st.k - 1) }, '← Previous');
  const pos = el('output', { class: 'dg-value dg-ehs-pos', 'aria-live': 'polite' });
  const next = el('button', { type: 'button', class: 'dg-btn dg-ehs-next', onclick: () => go(st.k + 1) }, 'Next →');
  const all = el('button', { type: 'button', class: 'dg-btn dg-ehs-whole', 'aria-pressed': 'false', onclick: () => setWhole(!st.whole) }, 'Whole figure');
  const root = el('div', { class: 'dg-ehs' });            // the keys and the state live here: Reset (D55) mounts a new one
  body.append(root);
  root.append(el('div', { class: 'dg-controls dg-ehs-bar' }, el('span', { class: 'dg-ctl dg-ehs-step' }, prev, pos, next), all));

  // the stage keeps the proportions of the tallest step, so the buttons above never move and the page below does not jump
  const tall = view.reduce((a, r) => (r[3] / r[2] > a[3] / a[2] ? r : a));
  const stage = el('div', { class: 'dg-paperbox dg-ehs-stage', style: `aspect-ratio: ${tall[2].toFixed(1)} / ${tall[3].toFixed(1)}` });
  root.append(stage);
  svg.setAttribute('class', 'dg-ehs-svg');
  svg.setAttribute('role', 'group');                       // it holds links (the \ref badges): 'group', not 'img' (D56)
  svg.setAttribute('aria-label', img.getAttribute('alt') || 'Figure');
  svg.setAttribute('tabindex', '0');                       // a click on the figure gives the panel the focus (arrow keys)
  const veil = document.createElementNS(SVGNS, 'path');
  veil.setAttribute('class', 'dg-ehs-veil');
  veil.setAttribute('fill-rule', 'evenodd');
  veil.setAttribute('aria-hidden', 'true');
  svg.append(veil);
  stage.append(svg);
  await linkify(svg);

  const outer = grow(whole, 4 * Math.max(whole[2], whole[3]));
  const rect = ([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}Z`;
  // The stage has the proportions of the tallest step, so a view is letterboxed along one axis. Its alignment
  // (preserveAspectRatio) is the one that keeps most of what is shown inside the figure (the first line: the space goes
  // below it, not above the figure); `shown` is the rectangle the stage then shows.
  const AL = ['Mid', 'Min', 'Max'];
  const ratio = () => { const r = svg.getBoundingClientRect(); return r.width && r.height ? r.height / r.width : tall[3] / tall[2]; };
  function fit([x, y, w, h]) {
    const A = ratio(), W = Math.max(w, h / A), H = Math.max(h, w * A);
    const pick = (a, len, L, lo, hi) => [a - (L - len) / 2, a, a - (L - len)].map((s, i) => ({ i, s, out: Math.max(0, lo - s) + Math.max(0, s + L - hi) }))
      .reduce((p, q) => (q.out < p.out - 1e-6 ? q : p));
    const px = pick(x, w, W, whole[0], whole[0] + whole[2]), py = pick(y, h, H, whole[1], whole[1] + whole[3]);
    return { align: `x${AL[px.i]}Y${AL[py.i]} meet`, shown: [px.s, py.s, W, H] };
  }
  const st = { k: 0, whole: false, vb: view[0], h: hole[0], shown: null };
  let anim = 0, moving = false;
  function draw(v, align, h, shown) {
    st.h = h; st.shown = shown;
    svg.setAttribute('viewBox', fmt(v));
    svg.setAttribute('preserveAspectRatio', align);
    veil.setAttribute('d', rect(outer.map(n => +n.toFixed(3))) + rect(h.map(n => +n.toFixed(3))));
  }
  // a transition runs through the shown rectangles (all of the stage's proportions, so the alignment does not matter on
  // the way) and ends on the step's own viewBox, the box with its margin, and alignment: nothing jumps at either end
  function show(animate) {
    const v = st.whole ? whole.slice() : view[st.k], h = st.whole ? grow(whole, 1) : hole[st.k], f = fit(v);
    const s0 = moving ? st.shown : fit(st.vb).shown, h0 = st.h;
    cancelAnimationFrame(anim);
    st.vb = v;
    const end = () => { moving = false; draw(v, f.align, h, f.shown); };
    if (!animate || reduced()) end();
    else {
      const t0 = performance.now(), mix = (a, b, s) => a.map((x, i) => x + (b[i] - x) * s);
      const tick = now => {
        const s = ease(Math.min(1, (now - t0) / MS));
        if (s >= 1) { end(); return; }
        const r = mix(s0, f.shown, s);
        draw(r, 'xMidYMid meet', mix(h0, h, s), r);
        anim = requestAnimationFrame(tick);
      };
      moving = true;
      anim = requestAnimationFrame(tick);
    }
    const t = tag(steps[st.k]);
    pos.textContent = `${st.k + 1} / ${N}` + (t ? ` ${t}` : '');
    prev.setAttribute('aria-disabled', String(st.k === 0 && !st.whole));      // not disabled: the focus stays on the button
    next.setAttribute('aria-disabled', String(st.k === N - 1 && !st.whole));
    all.setAttribute('aria-pressed', String(st.whole));
    root.dataset.state = JSON.stringify({ k: st.k, step: steps[st.k], whole: st.whole });
  }
  function go(k) {
    k = Math.max(0, Math.min(N - 1, k));
    if (k === st.k && !st.whole) return;
    st.k = k; st.whole = false;
    show(true);
  }
  function setWhole(w) { st.whole = w; show(true); }
  root.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!d) return;
    e.preventDefault();
    go(st.k + d);
  });
  show(false);
}
