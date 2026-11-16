// Hand-written (not generated): interactive companion of Figure 4.3 (label fig_TstarpM, §4.2.1). The geometry is the
// figure's, read from the package notebook notebooks/2_4_TstarpM.ipynb and the functions it calls (github.com/
// daniellopezcano/differential_geometry): the surface M, the charts (U, X), (V, Y) are those of Figures 3.1 and 4.2
// (eggs.js); the scalar field is the notebook's f (scalar_field_f), f(p) = z(p) · 2 √(x² + y² + 2) with z the height of M;
// p = (π/4, −π/8); γ the straight line X(γ(λ)) = X(p) + λ x_p (factory_curve_vertical: x_p = (0, 1)), whose velocity
// 𝒳_p = v_γ,p is the vector that can be dragged. Numbers (§4.2.1): 𝚡_i^p = ∂_i[f ∘ X⁻¹](X(p)) (X is the identity on the
// parameters, so the gradient of f in closed form), 𝚢_j^p = (∂X^i/∂Y^j)_p 𝚡_i^p, x^i_p, y^i_p = (∂Y^i/∂X^j)_p x^j_p and
// the pairing (df)_p(𝒳_p) = 𝚡_i^p x^i_p = 𝚢_i^p y^i_p. Drawn in each chart: the level sets f = f(p) + n·STEP (n integer:
// spacing fixed in the values of f, the one through p included); (df)_p as its stack, the lines (df)_p(w − p) = n·STEP in chart
// coordinates (the package's plot_covector_in_chart; the figure draws only the line through p, which (df)_p annihilates, thick);
// γ; 𝒳_p. The count shown is that of the lines of the stack 𝒳_p crosses, with sign (+1 towards larger values of (df)_p):
// exactly trunc((df)_p(𝒳_p)/STEP) in either chart. The level sets of f are context only (the stack is their linearization at
// p); their crossings are not counted, since they match (df)_p(𝒳_p)/STEP only for short vectors on this surface.
import { el, note, legend, matrix, readout, setMath, fmt, Plot2D, tol } from './dg.js';
import { typeset } from '../course.js';
import { PI, A, height, Y, Yinv, jacobian, inUV, bU, bV, bUV } from './eggs.js';
export { Y, Yinv, jacobian, inUV };

export const P0 = [PI / 4, -PI / 8], U0 = [0, 1], UMIN = 0.25, UMAX = 1.25, STEP = 0.25;
const C = { U: tol.blue, V: tol.red, ker: tol.green, ink: '#000000' };
const GREENS = ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'];   // matplotlib Greens

/** The notebook's scalar field f (scalar_field_f): the height of M times 2 √(x² + y² + 2). */
export const f = ([x, y]) => height(x, y) * 2 * Math.sqrt(x * x + y * y + 2);
/** 𝚡_i^p = ∂_i[f ∘ X⁻¹](X(p)): X is the identity on the parameters, so the gradient of f (closed form). */
export function grad([x, y]) {
  const E = Math.exp(-(x * x + y * y) / (2 * PI * PI)), S = Math.cos(x + y) / 2 + Math.sin(x - y + PI / 2) / 2 + 1, q = Math.sqrt(x * x + y * y + 2);
  const Sx = -Math.sin(x + y) / 2 + Math.cos(x - y + PI / 2) / 2, Sy = -Math.sin(x + y) / 2 - Math.cos(x - y + PI / 2) / 2;
  return [(-x / (PI * PI) * S + Sx) * E * 2 * q + E * S * 2 * x / q, (-y / (PI * PI) * S + Sy) * E * 2 * q + E * S * 2 * y / q];
}
export const inverse = J => { const d = J[0][0] * J[1][1] - J[0][1] * J[1][0]; return [[J[1][1] / d, -J[0][1] / d], [-J[1][0] / d, J[0][0] / d]]; };
/** Everything at p for the vector with components u = x^i_p: K[i][j] = (∂X^i/∂Y^j)_p, the components and the two pairings. */
export function at(p, u) {
  const J = jacobian(p), K = inverse(J), x = grad(p);
  const y = [0, 1].map(j => K[0][j] * x[0] + K[1][j] * x[1]);
  const vy = [J[0][0] * u[0] + J[0][1] * u[1], J[1][0] * u[0] + J[1][1] * u[1]];
  return { f: f(p), J, K, x, y, vx: u.slice(), vy, pairX: x[0] * u[0] + x[1] * u[1], pairY: y[0] * vy[0] + y[1] * vy[1] };
}
const box = pts => [0, 1].map(k => [Math.min(...pts.map(q => q[k])), Math.max(...pts.map(q => q[k]))]);
// panel limits: the chart images of U and V, and room for 𝒳_p drawn from any p of U ∩ V (|J| <= max(1, 1/r))
function limits(chart, reach) {
  const b = box([...bU, ...bV].map(chart)), o = box(bUV.map(chart));
  return [0, 1].map(k => [Math.min(b[k][0], o[k][0] - reach), Math.max(b[k][1], o[k][1] + reach)]).map(([a, c]) => [a - 0.03 * (c - a), c + 0.03 * (c - a)]);
}
const LX = limits(q => q, UMAX), LY = limits(Y, UMAX * Math.max(1, ...bUV.map(q => 1 / Y(q)[0])));

/** f on a grid over a chart's window (chart coordinates; NaN off the drawn part of M, [−A, A]²). */
function sample(lim, inv, nx = 96) {
  const [[x0, x1], [y0, y1]] = lim, ny = Math.round(nx * (y1 - y0) / (x1 - x0)), dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
  const v = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const q = inv([x0 + i * dx, y0 + j * dy]);
    v[j * (nx + 1) + i] = Math.abs(q[0]) <= A && Math.abs(q[1]) <= A ? f(q) : NaN;
  }
  return { nx, ny, v, x0, y0, dx, dy };
}
/** Marching squares: the segments of each level set f = fp + n·STEP, as Map n -> [[x, y], ...] (pairs of points). */
function contours(g, fp) {
  const out = new Map(), { nx, ny, v, x0, y0, dx, dy } = g, W = nx + 1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = [v[j * W + i], v[j * W + i + 1], v[(j + 1) * W + i + 1], v[(j + 1) * W + i]];
    if (c.some(Number.isNaN)) continue;
    const xy = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
    const lo = Math.ceil((Math.min(...c) - fp) / STEP), hi = Math.floor((Math.max(...c) - fp) / STEP);
    for (let n = lo; n <= hi; n++) {
      const L = fp + n * STEP, cut = [];
      for (let e = 0; e < 4; e++) {
        const a = c[e], b = c[(e + 1) % 4];
        if ((a > L) !== (b > L)) { const t = (L - a) / (b - a), P = xy[e], Q = xy[(e + 1) % 4]; cut.push([x0 + (P[0] + t * (Q[0] - P[0])) * dx, y0 + (P[1] + t * (Q[1] - P[1])) * dy]); }
      }
      if (cut.length < 2) continue;
      if (!out.has(n)) out.set(n, []);
      out.get(n).push(...cut.slice(0, 4 - (cut.length % 2)));
    }
  }
  return out;
}
const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
function green(L) {                                                    // Greens, as the figure's level sets, over f in [0, 7.5]
  const t = Math.max(0, Math.min(1, 0.3 + 0.5 * L / 7.5)) * (GREENS.length - 1), k = Math.min(GREENS.length - 2, Math.floor(t)), s = t - k;
  const a = hex(GREENS[k]), b = hex(GREENS[k + 1]);
  return `rgb(${a.map((x, m) => Math.round(x + (b[m] - x) * s)).join(', ')})`;
}

export default async function mount(body) {
  const st = { p: P0.slice(), u: U0.slice() };
  let cur = null;                                         // the state's numbers, computed once per update

  body.append(note('Drag \\(p\\) or the tip of \\(\\mathcal{X}_p\\) in either chart, and count the lines of \\((df)_p\\) that \\(\\mathcal{X}_p\\) crosses.'));
  const stage = el('div', { class: 'dg-cot' });
  const two = el('div', { class: 'dg-two' });
  stage.append(two);
  body.append(stage);
  const margin = { l: 34, r: 10, t: 26, b: 30 };
  const charts = [
    { key: 'X', map: q => q, inv: q => q, lim: LX, title: '(\\mathcal{U}, \\mathscr{X})', ax: '\\mathscr{X}', aria: '(𝒰, 𝒳)' },
    { key: 'Y', map: Y, inv: Yinv, lim: LY, title: '(\\mathcal{V}, \\mathscr{Y})', ax: '\\mathscr{Y}', aria: '(𝒱, 𝒴)' }
  ];
  const countTex = [];
  for (const ch of charts) {
    ch.parent = el('div', { class: 'dg-panel' });
    two.append(ch.parent);
    ch.grid = sample(ch.lim, ch.inv);
    ch.plot = new Plot2D(ch.parent, { xlim: ch.lim[0], ylim: ch.lim[1], equal: true, margin, role: 'group', label: ch.aria, draw: p => drawChart(p, ch) });
    ch.k = el('span', { class: 'dg-cot-val', 'data-k': 'k' + ch.key });
    ch.r = el('span', { class: 'dg-cot-val', 'data-k': 'r' + ch.key });
    const t1 = el('span'), t3 = el('span', { class: 'dg-cot-tex' });
    countTex.push([t1, 'lines of \\((df)_p\\) crossed by \\(\\mathcal{X}_p\\), with sign:'], [t3, `\\((df)_p(\\mathcal{X}_p) / ${STEP} =\\)`]);
    ch.parent.append(el('div', { class: 'dg-cot-count' }, el('span', {}, t1, ' ', ch.k), el('span', {}, t3, ' ', ch.r)));
  }
  stage.append(legend([{ label: '\\(\\gamma\\)', color: 'currentColor', width: 1.4 }, { label: '\\(\\mathcal{X}_p\\)', color: 'currentColor', width: 2.6 },
    { label: `level sets of \\(f\\), \\(${STEP}\\) apart`, color: green(4), width: 1.2 }, { label: `lines of \\((df)_p\\), \\(${STEP}\\) apart`, color: C.ker, width: 2.2 }]));

  const outs = el('div', { class: 'dg-readouts dg-cot-readouts' });
  const rX = readout({ label: '\\(\\mathscr{X}(p)\\)' }), rY = readout({ label: '\\(\\mathscr{Y}(p)\\)' }), rF = readout({ label: '\\(f(p)\\)' });
  outs.append(rX.el, rY.el, rF.el);
  const m = { x: matrix(1, 2), x2: matrix(1, 2), y: matrix(1, 2), K: matrix(2, 2), x3: matrix(1, 2), u: matrix(2, 1), y3: matrix(1, 2), v: matrix(2, 1) };
  const vX = el('span', { class: 'dg-cot-val', 'data-k': 'pairX' }), vY = el('span', { class: 'dg-cot-val', 'data-k': 'pairY' });
  const tex = () => el('span', { class: 'dg-cot-tex' });
  const T = { def: tex(), law: tex(), pair: tex() };
  const row = (...c) => el('div', { class: 'dg-eqrow' }, ...c);
  const law = el('div', { class: 'dg-cot-law' },
    row(T.def, '=', m.x.el),
    row(T.law, el('span', { class: 'dg-cot-num' }, m.y.el, '=', m.x2.el, '·', m.K.el)),
    row(T.pair, el('span', { class: 'dg-cot-num' }, m.x3.el, '·', m.u.el, '=', vX), el('span', { class: 'dg-cot-num' }, m.y3.el, '·', m.v.el, '=', vY)));
  stage.append(outs, law);

  function setP(q) {                                      // p stays in U ∩ V: stop at its boundary
    if (!inUV(q)) {
      let lo = st.p, hi = q;
      for (let k = 0; k < 40; k++) { const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]; if (inUV(c)) lo = c; else hi = c; }
      q = lo;
    }
    st.p = q; update();
  }
  function setU(u) {
    const n = Math.hypot(u[0], u[1]);
    if (!n) return;
    const s = Math.max(UMIN, Math.min(UMAX, n)) / n;
    st.u = [u[0] * s, u[1] * s]; update();
  }

  function drawChart(pl, ch) {
    if (!cur) return;                                     // the plots draw once when they are made, before the first update
    const { lim } = ch, inside = q => q[0] >= lim[0][0] && q[0] <= lim[0][1] && q[1] >= lim[1][0] && q[1] <= lim[1][1];
    for (const [b, col, nm, low] of [[bU, C.U, 'U', true], [bV, C.V, 'V', false]]) {   // labels: below U, inside the right end of V
      const img = b.map(ch.map);
      pl.area(img, { fill: col, opacity: 0.22, color: col, dash: '5 4' });
      const q = img.reduce((a, c) => (low ? c[1] < a[1] : c[0] > a[0]) ? c : a);
      pl.label('r' + nm, q, `\\(${ch.ax}(\\mathcal{${nm}})\\)`, { anchor: low ? 'n' : 'e', dx: low ? 0 : -5, dy: low ? 3 : 0, color: col });
    }
    if (ch.fp !== cur.f) { ch.fp = cur.f; ch.lines = contours(ch.grid, cur.f); }  // the level sets move with f(p) only
    for (const [n, seg] of ch.lines) {
      let d = '';
      for (let k = 0; k < seg.length; k += 2) d += `M${pl.sx(seg[k][0]).toFixed(1)} ${pl.sy(seg[k][1]).toFixed(1)}L${pl.sx(seg[k + 1][0]).toFixed(1)} ${pl.sy(seg[k + 1][1]).toFixed(1)}`;
      pl.node('path', { d, fill: 'none', stroke: green(cur.f + n * STEP), 'stroke-width': n ? 0.9 : 1.4, 'stroke-linecap': 'round', class: 'dg-cot-level' });
    }
    // γ: the straight line through p along x_p in X, inside the drawn part of M and the window
    const runs = []; let r = [];
    for (let k = 0; k <= 400; k++) {
      const l = -10 + 20 * k / 400, q = [st.p[0] + l * st.u[0], st.p[1] + l * st.u[1]], c = ch.map(q);
      if (Math.abs(q[0]) <= A && Math.abs(q[1]) <= A && inside(c)) r.push(c); else { if (r.length > 1) runs.push(r); r = []; }
    }
    if (r.length > 1) runs.push(r);
    for (const g of runs) pl.line(g, { color: C.ink, width: 1.4, opacity: 0.8, class: 'dg-cot-gamma' });
    // (df)_p as its stack (plot_covector_in_chart): the lines (df)_p(w − p) = n·STEP in the chart, inside a disc about p a little
    // larger than 𝒳_p; the line through p, which (df)_p annihilates, thick as in the figure
    const P = ch.map(st.p), c = ch.key === 'X' ? cur.x : cur.y, cn = Math.hypot(...c), e = [c[0] / cn, c[1] / cn];
    const v = ch.key === 'X' ? cur.vx : cur.vy, tip = [P[0] + v[0], P[1] + v[1]], rho = Math.max(1.25 * Math.hypot(...v), 60 / (pl.sx(1) - pl.sx(0)));
    for (let n = -Math.floor(rho * cn / STEP); n <= Math.floor(rho * cn / STEP); n++) {
      const t = n * STEP / cn, h = Math.sqrt(rho * rho - t * t), o = [P[0] + t * e[0], P[1] + t * e[1]];
      pl.line([[o[0] + h * e[1], o[1] - h * e[0]], [o[0] - h * e[1], o[1] + h * e[0]]], { color: C.ker, width: n ? 1.5 : 3.5, class: n ? 'dg-cot-stack' : 'dg-cot-ker' });
    }
    pl.arrow(P, tip, { color: C.ink, width: 2.6, head: 11, class: 'dg-inert dg-cot-Xp' });
    const dir = [v[0] / Math.hypot(...v), v[1] / Math.hypot(...v)];
    pl.label('Xp', tip, '\\(\\mathcal{X}_p\\)', { anchor: dir[0] > 0.3 ? 'w' : dir[0] < -0.3 ? 'e' : dir[1] > 0 ? 's' : 'n', dx: dir[0] > 0.3 ? 12 : dir[0] < -0.3 ? -12 : 0, dy: Math.abs(dir[0]) <= 0.3 ? (dir[1] > 0 ? -12 : 12) : 0, class: 'dg-cot-halo' });
    pl.handle(tip, { key: 'tip', r: 9, fill: 'transparent', stroke: C.ink, strokeWidth: 1.5, ariaLabel: '𝒳ₚ',
      onDrag: (x, y) => { const e = [x - P[0], y - P[1]]; setU(ch.key === 'X' ? e : [cur.K[0][0] * e[0] + cur.K[0][1] * e[1], cur.K[1][0] * e[0] + cur.K[1][1] * e[1]]); } });
    pl.handle(P, { key: 'p', r: 6.5, fill: '#000', stroke: '#fff', strokeWidth: 1.5, ariaLabel: 'p', onDrag: (x, y) => setP(ch.inv([x, y])) });
    pl.label('p', P, '\\(p\\)', { anchor: dir[0] > 0 ? 'ne' : 'nw', dx: dir[0] > 0 ? -7 : 7, dy: 6, class: 'dg-cot-halo' });
    pl.label('x', [lim[0][1], pl.o.ylim[0]], `\\(${ch.ax}^1\\)`, { anchor: 'se', dx: -4, dy: -4, class: 'dg-axis-label dg-cot-halo' });
    pl.label('y', [pl.o.xlim[0], pl.o.ylim[1]], `\\(${ch.ax}^2\\)`, { anchor: 'nw', dx: 5, dy: 4, class: 'dg-axis-label dg-cot-halo' });
    pl.label('t', [(pl.o.xlim[0] + pl.o.xlim[1]) / 2, pl.o.ylim[1]], `\\(${ch.title}\\)`, { anchor: 's', dy: -5 });
  }

  const F = x => fmt(x, 3);
  function update() {
    cur = at(st.p, st.u);
    for (const ch of charts) {
      ch.plot.update();
      ch.lin = Math.trunc((ch.key === 'X' ? cur.pairX : cur.pairY) / STEP);   // lines of the stack crossed: (df)_p(𝒳_p) = n·STEP on the n-th
      ch.k.textContent = String(ch.lin).replace('-', '−');
      ch.r.textContent = F((ch.key === 'X' ? cur.pairX : cur.pairY) / STEP);
    }
    const y = Y(st.p);
    rX.set(`(${F(st.p[0])}, ${F(st.p[1])})`); rY.set(`(${F(y[0])}, ${F(y[1])})`); rF.set(F(cur.f));
    for (const k of ['x', 'x2', 'x3']) m[k].set([cur.x]);
    m.y.set([cur.y]); m.y3.set([cur.y]); m.K.set(cur.K); m.u.set(cur.vx.map(a => [a])); m.v.set(cur.vy.map(a => [a]));
    vX.textContent = F(cur.pairX); vY.textContent = F(cur.pairY);
    stage.dataset.state = JSON.stringify(st);
  }
  update();
  await Promise.all([...countTex.map(([e, t]) => setMath(e, t)),
    setMath(T.def, '\\(\\mathtt{x}_i^p = \\partial_i \\left[f \\circ \\mathscr{X}^{-1}\\right] (\\mathscr{X}(p))\\)'),
    setMath(T.law, '\\(\\displaystyle \\mathtt{y}_j^p = \\sum_{i=1}^{d} \\left( \\frac{\\partial \\mathscr{X}^i}{\\partial \\mathscr{Y}^j} \\right)_{p} \\cdot \\mathtt{x}_i^p\\)'),
    setMath(T.pair, '\\((df)_p(\\mathcal{X}_p) = \\mathtt{x}_i^p \\, x^i_p = \\mathtt{y}_i^p \\, y^i_p\\)')]);
  await typeset(body);
}
