// Hand-written (not generated): interactive at the end of §2.3 (label section_Basis_Components_Transformations,
// "at": "end", D57). There is no figure and no notebook for it; the content is the section's own: a 2-dimensional
// vector space with two bases {x̂_i} and {ŷ_i}, related by  x̂_i = Σ_j J^j_i ŷ_j ; a fixed vector 𝒳 (components x^i,
// y^i) and a fixed covector 𝖷 (components 𝚡_i, 𝚢_i w.r.t. the dual bases {𝔵̂^i}, {𝔶̂^i}), drawn as its level lines.
// The laws of §2.3:  y^i = Σ_j J^i_j x^j  (contravariant),  𝚡_j = Σ_i J^i_j 𝚢_i  (covariant),  and the pairing
// 𝖷(𝒳) = Σ 𝚡_i x^i = Σ 𝚢_i y^i  does not depend on the basis.
// Everything is computed from the drawing (the plane's own coordinates, which are not shown): x^i = 𝔵̂^i(𝒳) by
// solving 𝒳 = Σ x^i x̂_i, 𝚡_i = 𝖷(x̂_i), J from x̂_i = Σ_j J^j_i ŷ_j, J⁻¹ from ŷ_i = Σ_j (J⁻¹)^j_i x̂_j; the
// laws are then shown as numbers (the test checks them against J and J⁻¹). A basis cannot degenerate: a tip
// stops where the two vectors would become (nearly) parallel or too short.
import { el, readout, note, legend, matrix, fmt, Plot2D } from './dg.js';
import { typeset } from '../course.js';

export const VEC = [2, 1];                 // 𝒳 in the plane's coordinates
export const COV = [0.5, 1];               // 𝖷(v) = COV · v: level lines 𝖷 = k are COV · v = k
export const START = { x: [[1, 0], [0, 1]], y: [[1.5, 0.5], [-0.5, 1]] };   // tips of x̂_1, x̂_2 and ŷ_1, ŷ_2
const LIM = [[-1.6, 3.4], [-1.25, 2.55]], PAD = 0.12, LMIN = 0.3, SMIN = 0.17;   // |sin angle| >= 0.17 (≈ 10°)
const C = { x: '#0077BB', y: '#CC3311', vec: '#222222', cov: '#AA3377' };
const SUB = ['₁', '₂'];

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
/** Components of v in the basis {b_1, b_2}: v = c^1 b_1 + c^2 b_2 (Cramer). */
export const solve = ([b1, b2], v) => { const d = cross(b1, b2); return [cross(v, b2) / d, cross(b1, v) / d]; };
/** A basis the panel accepts: both vectors at least LMIN long, |sin of the angle| at least SMIN. */
export const admissible = ([b1, b2]) => Math.hypot(...b1) >= LMIN && Math.hypot(...b2) >= LMIN
  && Math.abs(cross(b1, b2)) >= SMIN * Math.hypot(...b1) * Math.hypot(...b2);
/** Everything the panel shows, for bases x (= [x̂_1, x̂_2]) and y (= [ŷ_1, ŷ_2]). J[j][i] = J^j_i. */
export function laws(x, y) {
  const cx = solve(x, VEC), cy = solve(y, VEC);                       // x^i, y^i
  const kx = x.map(b => dot(COV, b)), ky = y.map(b => dot(COV, b));    // 𝚡_i = 𝖷(x̂_i), 𝚢_i = 𝖷(ŷ_i)
  const Jc = x.map(b => solve(y, b)), Ic = y.map(b => solve(x, b));    // columns: x̂_i in {ŷ_j}, ŷ_i in {x̂_j}
  const J = [[Jc[0][0], Jc[1][0]], [Jc[0][1], Jc[1][1]]], Jinv = [[Ic[0][0], Ic[1][0]], [Ic[0][1], Ic[1][1]]];
  return { cx, cy, kx, ky, J, Jinv, pair: [dot(kx, cx), dot(ky, cy)] };
}

/** The part of the line {v : p + t d} inside the box (Liang–Barsky), or null. */
function clipLine(p, d, [[x0, x1], [y0, y1]], t0 = -Infinity, t1 = Infinity) {
  for (const [q, lo, hi] of [[0, x0, x1], [1, y0, y1]]) {
    if (Math.abs(d[q]) < 1e-12) { if (p[q] < lo || p[q] > hi) return null; continue; }
    let a = (lo - p[q]) / d[q], b = (hi - p[q]) / d[q];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  }
  return t0 < t1 ? [[p[0] + t0 * d[0], p[1] + t0 * d[1]], [p[0] + t1 * d[0], p[1] + t1 * d[1]]] : null;
}
const seg = (a, b, box) => clipLine(a, [b[0] - a[0], b[1] - a[1]], box, 0, 1);

export default async function mount(body) {
  const st = { x: START.x.map(v => v.slice()), y: START.y.map(v => v.slice()) };

  body.append(note('Drag the tips of \\(\\hat{x}_1, \\hat{x}_2\\) and \\(\\hat{y}_1, \\hat{y}_2\\): \\(\\mathcal{X}\\) and \\(\\mathsf{X}\\) stay the same, their components change.'));
  const stage = el('div', { class: 'dg-laws' });
  const two = el('div', { class: 'dg-two' });
  stage.append(two);
  const sides = [
    { key: 'x', hat: '\\hat{x}', dual: '\\hat{\\mathfrak{x}}', up: 'x', low: '\\mathtt{x}', aria: 'x̂' },
    { key: 'y', hat: '\\hat{y}', dual: '\\hat{\\mathfrak{y}}', up: 'y', low: '\\mathtt{y}', aria: 'ŷ' }
  ];
  for (const s of sides) {
    const box = el('div', { class: 'dg-panel' });
    two.append(box);
    s.plot = new Plot2D(box, { xlim: LIM[0], ylim: LIM[1], equal: true, axes: false, margin: { l: 6, r: 6, t: 28, b: 6 },
      role: 'group', label: `{${s.aria}ᵢ}`, draw: p => draw(p, s) });
    const outs = el('div', { class: 'dg-readouts dg-laws-comp' });
    s.rUp = readout({ label: `\\(${s.up}^i = ${s.dual}^i(\\mathcal{X})\\)` });
    s.rLow = readout({ label: `\\(${s.low}_i = \\mathsf{X}(${s.hat}_i)\\)` });
    outs.append(s.rUp.el, s.rLow.el);
    box.append(outs);
  }
  stage.append(legend([{ label: '\\(\\mathcal{X}\\)', color: 'currentColor', width: 2.5 }, { label: '\\(\\mathsf{X} = \\text{const}\\)', color: C.cov }]));

  // the laws of §2.3 (the notes' formulas) next to the same relations in numbers
  const mJ = matrix(2, 2), mI = matrix(2, 2), mJ2 = matrix(2, 2), mJ3 = matrix(2, 2);
  const my = matrix(2, 1), mx = matrix(2, 1), mkx = matrix(1, 2), mky = matrix(1, 2);
  const pX = el('span', { class: 'dg-laws-pair' }), pY = el('span', { class: 'dg-laws-pair' });
  const tex = t => el('div', { class: 'dg-laws-tex', text: t });
  const row = (...c) => el('div', { class: 'dg-eqrow' }, ...c);
  const sym = t => el('span', { class: 'dg-laws-sym', text: t });
  const eqs = el('div', { class: 'dg-laws-eqs' },
    tex('\\(\\hat{x}_i = \\sum_{j=1}^d J^j_{i} \\cdot \\hat{y}_j\\), \\(\\quad \\hat{y}_i = \\sum_{j=1}^d (J^{-1})^j_{i} \\cdot \\hat{x}_j\\)'),
    row(sym('\\(J =\\)'), mJ.el, sym('\\(\\;J^{-1} =\\)'), mI.el),
    tex('\\(y^i = \\sum_{j=1}^d J^i_{j} \\cdot x^j \\longrightarrow x^i = \\sum_{j=1}^d (J^{-1})^i_{j} \\cdot y^j\\)'),
    row(my.el, '=', mJ2.el, '·', mx.el),
    tex('\\(\\mathtt{x}_j = \\sum_{i=1}^d J^i_{j} \\cdot \\mathtt{y}_i \\longrightarrow \\mathtt{y}_j = \\sum_{i=1}^d (J^{-1})^i_{j} \\cdot \\mathtt{x}_i\\)'),
    row(mkx.el, '=', mky.el, '·', mJ3.el),
    tex('\\(\\mathsf{X}(\\mathcal{X}) = \\sum_{i=1}^d \\mathtt{x}_i \\cdot x^i = \\sum_{i=1}^d \\mathtt{y}_i \\cdot y^i\\)'),
    row(pX, '=', pY));
  stage.append(eqs);
  body.append(stage);

  /** Move the tip of basis vector i of side k to q (kept in the box); where the basis would degenerate the tip
   *  stops at the last admissible point on the way (a jump to an admissible point is taken as it is). */
  function setTip(k, i, q) {
    q = [Math.min(LIM[0][1] - PAD, Math.max(LIM[0][0] + PAD, q[0])), Math.min(LIM[1][1] - PAD, Math.max(LIM[1][0] + PAD, q[1]))];
    const with_ = v => st[k].map((b, j) => (j === i ? v : b));
    if (!admissible(with_(q))) {
      let lo = st[k][i], hi = q;
      for (let n = 0; n < 40; n++) { const m = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]; if (admissible(with_(m))) lo = m; else hi = m; }
      q = lo;
    }
    st[k][i] = q;
    update();
  }

  function draw(pl, s) {
    const box = [pl.o.xlim, pl.o.ylim], n = Math.hypot(...COV);
    const ks = [Math.ceil(Math.min(...[0, 1].flatMap(a => [0, 1].map(b => dot(COV, [box[0][a], box[1][b]]))))),
      Math.floor(Math.max(...[0, 1].flatMap(a => [0, 1].map(b => dot(COV, [box[0][a], box[1][b]])))))];
    for (let k = ks[0]; k <= ks[1]; k++) {             // level lines of 𝖷, numbered at their left end
      const L = clipLine([COV[0] * k / (n * n), COV[1] * k / (n * n)], [-COV[1], COV[0]], box);
      if (!L) continue;
      pl.line(L, { color: C.cov, width: k ? 1.1 : 1.6, opacity: 0.75 });
      const end = L[0][0] < L[1][0] ? L[0] : L[1], onTop = end[1] > box[1][1] - 1e-9;
      pl.text(end, fmt(k, 0), { dx: onTop ? 8 : 5, dy: onTop ? 13 : -5, anchor: 'start', color: C.cov, class: 'dg-svgtext dg-laws-level' });
    }
    const B = st[s.key], c = solve(B, VEC);
    const P = [[c[0] * B[0][0], c[0] * B[0][1]], [c[1] * B[1][0], c[1] * B[1][1]]];   // x^1 x̂_1 and x^2 x̂_2
    for (const [a, b] of [[[0, 0], P[0]], [P[0], VEC], [[0, 0], P[1]], [P[1], VEC]]) {
      const L = seg(a, b, box);
      if (L) pl.line(L, { color: C[s.key], width: 1, dash: '4 3', opacity: 0.9 });
    }
    pl.arrow([0, 0], VEC, { color: C.vec, width: 2.6, head: 12, class: 'dg-inert' });
    pl.label('X', VEC, '\\(\\mathcal{X}\\)', { anchor: 'w', dx: 7, dy: 2, color: C.vec });
    B.forEach((b, i) => {
      pl.arrow([0, 0], b, { color: C[s.key], width: 2, head: 10, class: 'dg-inert' });
      const L = Math.hypot(...b), u = [b[0] / L, -b[1] / L];                // direction in px (y down)
      pl.label('b' + i, b, `\\(${s.hat}_${i + 1}\\)`, { dx: 21 * u[0] + (u[0] < 0 ? -3 : 3), dy: 20 * u[1], color: C[s.key] });
      pl.handle(b, { key: 'h' + i, r: 8, fill: 'transparent', stroke: C[s.key], strokeWidth: 1.5, ariaLabel: s.aria + SUB[i],
        onDrag: (px, py) => setTip(s.key, i, [px, py]) });
    });
    pl.point([0, 0], { r: 2.5, fill: C.vec });
    pl.label('t', [(box[0][0] + box[0][1]) / 2, box[1][1]], `\\(\\{${s.hat}_i\\},\\ \\{${s.dual}^i\\}\\)`, { anchor: 's', dy: -6 });
  }

  function update() {
    for (const s of sides) s.plot.update();
    const r = laws(st.x, st.y);
    const pair = v => `(${fmt(v[0], 3)}, ${fmt(v[1], 3)})`;
    sides[0].rUp.set(pair(r.cx)); sides[0].rLow.set(pair(r.kx));
    sides[1].rUp.set(pair(r.cy)); sides[1].rLow.set(pair(r.ky));
    mJ.set(r.J); mI.set(r.Jinv); mJ2.set(r.J); mJ3.set(r.J);
    my.set([[r.cy[0]], [r.cy[1]]]); mx.set([[r.cx[0]], [r.cx[1]]]);
    mkx.set([r.kx]); mky.set([r.ky]);
    pX.textContent = fmt(r.pair[0], 3); pY.textContent = fmt(r.pair[1], 3);
    stage.dataset.state = JSON.stringify(st);
  }
  update();
  await typeset(body);
}
