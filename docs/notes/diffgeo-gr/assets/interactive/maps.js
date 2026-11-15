// Hand-written (not generated): interactive companion of Figure 2.1 (label fig_maps_examples, §2.1).
// Two finite sets M (left) and N (right) as in the figure; the student adds arrows (drag from an
// element of M to an element of N, or Enter / arrow keys / Enter on a focused element of M) and
// removes them (click an arrow, or Delete); the status line classifies the relation with the panel
// names of Figure 2.1. Presets reproduce the five panels.
import { el, controls, stepper, toggle, button, note, Plot2D, tol } from './dg.js';
import { typeset } from '../course.js';

// colours of fig_vector_spaces_map_examples.pdf
const C = { dom: '#3B4E87', tgt: '#5C80BF', arrow: '#323341', bad: tol.red, inv: tol.green, pick: '#7a7a85' };
const NAMES = { none: 'NOT a Function', gen: 'General Function', inj: 'Only Injective', sur: 'Only Surjective', bij: 'Bijective' };

// the five panels of Figure 2.1: [|M|, |N|, arrows [i in M, j in N]], elements counted from the top
const PRESETS = [
  ['none', 4, 5, [[0, 3], [0, 4], [1, 2], [2, 1], [3, 0]]],
  ['gen', 4, 5, [[0, 4], [1, 4], [2, 3], [3, 2]]],
  ['inj', 4, 5, [[0, 4], [1, 3], [2, 2], [3, 1]]],
  ['sur', 4, 3, [[0, 2], [1, 1], [2, 0], [3, 1]]],
  ['bij', 4, 4, [[0, 3], [1, 2], [2, 1], [3, 0]]]
];

/** Classification of a relation (list of [i, j]) between sets of sizes m and n. */
export function classify(m, n, arrows) {
  const out = Array(m).fill(0), hit = Array(n).fill(0);
  for (const [i, j] of arrows) { out[i]++; hit[j]++; }
  const offending = out.map((k, i) => (k === 1 ? -1 : i)).filter(i => i >= 0);
  if (offending.length) return { kind: 'none', offending };
  const inj = hit.every(k => k <= 1), sur = hit.every(k => k >= 1);
  return { kind: inj && sur ? 'bij' : inj ? 'inj' : sur ? 'sur' : 'gen', offending: [] };
}

export default async function mount(body) {
  const st = { m: 4, n: 4, arrows: PRESETS[4][3].map(a => a.slice()), showInv: false, pick: null, rubber: null };
  const ypos = (k, size) => (size - 1) / 2 - k;            // elements spaced 1 apart, centred
  const D = k => [0, ypos(k, st.m)], T = k => [1, ypos(k, st.n)];
  const has = (i, j) => st.arrows.some(a => a[0] === i && a[1] === j);
  const remove = (i, j) => { st.arrows = st.arrows.filter(a => !(a[0] === i && a[1] === j)); refresh(); };
  const add = (i, j) => { if (!has(i, j)) st.arrows.push([i, j]); refresh(); };

  body.append(note('Drag from an element of \\(\\mathcal{M}\\) to an element of \\(\\mathcal{N}\\) to add an arrow of \\(\\phi\\); click an arrow to remove it.'));
  const top = controls(body);
  const sM = stepper({ label: '\\(\\mathcal{M}\\)', min: 2, max: 5, value: st.m, onChange: v => { st.m = v; st.arrows = st.arrows.filter(a => a[0] < v); refresh(); } });
  const sN = stepper({ label: '\\(\\mathcal{N}\\)', min: 2, max: 5, value: st.n, onChange: v => { st.n = v; st.arrows = st.arrows.filter(a => a[1] < v); refresh(); } });
  const inv = toggle({ label: '\\(\\phi^{-1}\\)', onChange: v => { st.showInv = v; plot.update(); } });
  top.append(sM.el, sN.el, inv.el);

  const status = el('div', { class: 'dg-status', role: 'status', 'aria-live': 'polite' });
  const stage = el('div', { class: 'dg-maps-stage' });
  body.append(stage, status);

  const R = 9;                                            // dot radius in px, as in the figure
  const plot = new Plot2D(stage, {
    xlim: [-0.75, 1.75], ylim: [-2.6, 3.0], aspect: 0.85, maxWidth: 380, axes: false, margin: { l: 0, r: 0, t: 0, b: 0 },
    label: 'Figure 2.1', draw
  });
  function draw(p) {
    const cls = classify(st.m, st.n, st.arrows);
    p.label('M', [0, 2.62], '\\(\\mathcal{M}\\)', { color: C.dom });
    p.label('N', [1, 2.62], '\\(\\mathcal{N}\\)', { color: C.tgt });
    p.label('phi', [0.5, 2.62], '\\(\\phi\\)', { color: C.arrow });
    for (const [i, j] of st.arrows) {
      p.arrow(D(i), T(j), { key: `a${i}-${j}`, layer: 'main', color: C.arrow, shorten: [R + 1, R + 2], tabindex: 0, role: 'button',
        ariaLabel: `φ: ${i + 1} → ${j + 1}`, class: 'dg-removable', onClick: () => remove(i, j) });
    }
    if (st.showInv && cls.kind === 'bij') {
      for (const [i, j] of st.arrows) p.arrow(T(j), D(i), { color: C.inv, bend: 16, shorten: [R + 2, R + 3], width: 1.6, class: 'dg-inert' });
    }
    if (st.rubber) {
      const [i, q] = st.rubber;
      p.line([D(i), q], { color: C.pick, width: 1.6, dash: '5 4', layer: 'top' });
    }
    if (st.pick) p.arrow(D(st.pick[0]), T(st.pick[1]), { color: C.pick, dash: '5 4', shorten: [R + 1, R + 2], layer: 'top', class: 'dg-inert' });
    for (let k = 0; k < st.n; k++) {
      p.handle(T(k), { key: 't' + k, r: R, fill: C.tgt, stroke: 'none', role: 'img', ariaLabel: `𝒩 ${k + 1}`, class: 'dg-target' }).removeAttribute('tabindex');
    }
    for (let k = 0; k < st.m; k++) {
      const bad = cls.offending.includes(k);
      p.handle(D(k), {
        key: 'd' + k, r: R, fill: C.dom, stroke: bad ? C.bad : 'none', strokeWidth: bad ? 3.5 : 0, ariaLabel: `𝓜 ${k + 1}`, class: 'dg-domain' + (bad ? ' dg-bad' : ''),
        onPointerDown: e => startDrag(e, k), onKey: e => keyOn(e, k)
      });
    }
  }

  // --- drag from an element of M to an element of N
  function startDrag(e, i) {
    e.preventDefault();
    plot.svg.setPointerCapture(e.pointerId);
    st.rubber = [i, D(i)];
    const move = ev => { st.rubber = [i, plot.toData(...plot.eventPx(ev))]; plot.update(); };
    const up = ev => {
      plot.svg.removeEventListener('pointermove', move); plot.svg.removeEventListener('pointerup', up); plot.svg.removeEventListener('pointercancel', up);
      st.rubber = null;
      const [x, y] = plot.eventPx(ev);
      let best = -1, bd = 26;                             // px tolerance around a target element
      for (let k = 0; k < st.n; k++) { const [tx, ty] = plot.px(T(k)); const d = Math.hypot(tx - x, ty - y); if (d < bd) { bd = d; best = k; } }
      if (best >= 0) add(i, best); else plot.update();
    };
    plot.svg.addEventListener('pointermove', move); plot.svg.addEventListener('pointerup', up); plot.svg.addEventListener('pointercancel', up);
  }
  // --- keyboard: Enter starts, arrow keys choose the target, Enter confirms, Escape cancels; Delete removes the arrows of the element
  function keyOn(e, i) {
    const k = e.key;
    if (st.pick && st.pick[0] === i) {
      if (k === 'ArrowDown' || k === 'ArrowRight') st.pick[1] = (st.pick[1] + 1) % st.n;
      else if (k === 'ArrowUp' || k === 'ArrowLeft') st.pick[1] = (st.pick[1] + st.n - 1) % st.n;
      else if (k === 'Enter' || k === ' ') { const j = st.pick[1]; st.pick = null; add(i, j); return true; }
      else if (k === 'Escape' || k === 'Tab') { st.pick = null; plot.update(); return k !== 'Tab'; }
      else return false;
      plot.update(); return true;
    }
    if (k === 'Enter' || k === ' ') { const a = st.arrows.find(a => a[0] === i); st.pick = [i, a ? a[1] : 0]; plot.update(); return true; }
    if (k === 'Delete' || k === 'Backspace') { st.arrows = st.arrows.filter(a => a[0] !== i); refresh(); return true; }
    if (k === 'ArrowDown' || k === 'ArrowUp') { const nxt = plot.keyed.get('d' + (i + (k === 'ArrowDown' ? 1 : -1))); if (nxt) nxt.focus(); return true; }
    return false;
  }

  const presets = el('div', { class: 'dg-controls dg-presets', role: 'group', 'aria-label': 'Figure 2.1' });
  for (const [kind, m, n, arrows] of PRESETS) {
    presets.append(button({ label: NAMES[kind], onClick: () => { st.pick = null; st.m = m; st.n = n; sM.set(m, false); sN.set(n, false); st.arrows = arrows.map(a => a.slice()); refresh(); } }));
  }
  body.append(presets);

  function refresh() {
    const cls = classify(st.m, st.n, st.arrows);
    status.textContent = NAMES[cls.kind];
    status.dataset.kind = cls.kind;
    inv.disabled = cls.kind !== 'bij';
    plot.update();
  }
  refresh();
  await typeset(body);
}
