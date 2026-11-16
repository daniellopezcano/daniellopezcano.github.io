// Hand-written (not generated): interactive after Figure C.15 (label fig_Example_Newtonian_Rotating), Appendix C.8.2.
// No notebook. Everything comes from the notes: the setup of C.8 (Appendices/examples_and_exercises/example_newton_cartan.tex,
// ℳ = ℝ⁴, the inertial chart (𝒰, 𝒳) with Γ_𝒳 = 0, C.8.2) and §9.4.2 (Chapters/Newtonian_Gravity.tex, "Pseudo-Forces"): the
// co-rotating chart (𝒱, 𝒴) is the chart of §9.4.2 with θ(t) = ωt and b = 0, whose transition maps are
//   ᛖ_𝒱𝒰: β ↦ α = (β1 cos θ − β2 sin θ, β1 sin θ + β2 cos θ, β3),   ᛖ_𝒰𝒱: α ↦ β = (α1 cos θ + α2 sin θ, −α1 sin θ + α2 cos θ, α3),
// with Jacobian rows (θ̇ β2, cos θ, sin θ), (−θ̇ β1, −sin θ, cos θ) for ∂𝒴^α/∂𝒳^s, and whose only non-vanishing coefficient
// functions are Γ¹02 = Γ¹20 = −θ̇, Γ²01 = Γ²10 = θ̇, Γ¹00(β) = −θ̇² β1 − θ̈ β2 + cos θ b̈¹ + sin θ b̈², Γ²00(β) = −θ̇² β2 + θ̈ β1
// − sin θ b̈¹ + cos θ b̈², Γ³00 = b̈³ (here θ̇ = ω, θ̈ = 0, b̈ = 0). A free worldline (Newton II with f = 0, the autoparallel
// equation) is a straight line in 𝒳 (χ̈_𝒰 = 0) and, in 𝒴, the solution of  χ̈^α_𝒱 = −Γ^α_00 − 2 Γ^α_0β χ̇^β_𝒱, i.e. the notes'
// Coriolis + centrifugal terms, integrated here with RK4. Everything is in the plane α3 = 0 = β3 (the projection the
// figures draw). The test checks the integrated χ_𝒱 against ᛖ_𝒰𝒱(χ_𝒰), the notes' involute of C.8.2 at their χ, and the
// coefficients against the transformation law applied to the transition map.
import { el, controls, slider, note, legend, matrix, Plot2D, vibrant } from './dg.js';
import { typeset } from '../course.js';

// p0 = χ(0), the same in both charts (θ(0) = 0); w0 = χ̇_𝒱(0), the velocity in the co-rotating chart at t = 0 (the notes'
// χ starts at rest there, at (r0, 0) with r0 = 1); the velocity in the inertial chart is χ̇_𝒰(0) = w0 + ω (−p0², p0¹).
export const START = { p0: [1, 0], w0: [0, 0], omega: 1, t: 1.5 };
const TMAX = 2.5, LIM = [-2.8, 2.8], H = 0.0025, ACC = 0.35, PMAX = 2.2, VMAX = 2, OM = [0.1, 2];
const C = { chi: vibrant.red, axes: '#8a8a8a', v: '#222222', cor: vibrant.teal, cen: '#555555', circ: '#999999' };

const cs = (w, t) => [Math.cos(w * t), Math.sin(w * t)];
/** ᛖ_𝒰𝒱 at time t: the spatial coordinates β of the point with spatial coordinates α in 𝒳. */
export const toY = (t, [a1, a2], w) => { const [c, s] = cs(w, t); return [a1 * c + a2 * s, -a1 * s + a2 * c]; };
/** ᛖ_𝒱𝒰 at time t: α from β. */
export const toX = (t, [b1, b2], w) => { const [c, s] = cs(w, t); return [b1 * c - b2 * s, b1 * s + b2 * c]; };
/** Velocity components in 𝒴 from those in 𝒳 at the point β (time component 1): (∂𝒴^α/∂𝒳^s) χ̇^s_𝒰. */
export const velY = (t, [b1, b2], [v1, v2], w) => { const [c, s] = cs(w, t); return [w * b2 + c * v1 + s * v2, -w * b1 - s * v1 + c * v2]; };
/** ... and back: (∂𝒳^α/∂𝒴^j) χ̇^j_𝒱. */
export const velX = (t, [b1, b2], [u1, u2], w) => { const [c, s] = cs(w, t);
  return [-w * (b1 * s + b2 * c) + c * u1 - s * u2, w * (b1 * c - b2 * s) + s * u1 + c * u2]; };
/** Γ_𝒴 at β: G0[α][β] = Γ^α_0β = Γ^α_β0 and G00[α] = Γ^α_00(β), the notes' formulas with θ̇ = ω, θ̈ = 0, b̈ = 0 (α, β = 1, 2). */
export function Gamma(w, [b1, b2], t = 0) {
  const th1 = w, th2 = 0, bdd = [0, 0], [c, s] = cs(w, t);
  return { G0: [[0, -th1], [th1, 0]],
    G00: [-th1 * th1 * b1 - th2 * b2 + c * bdd[0] + s * bdd[1], -th1 * th1 * b2 + th2 * b1 - s * bdd[0] + c * bdd[1]] };
}
/** The two Γ-terms of Newton II in 𝒴, moved to the right-hand side (per unit mass): Coriolis −2 Γ^α_0β χ̇^β, centrifugal −Γ^α_00. */
export function terms(w, b, u) {
  const { G0, G00 } = Gamma(w, b);
  return { cor: [0, 1].map(a => -2 * (G0[a][0] * u[0] + G0[a][1] * u[1])), cen: G00.map(g => -g) };
}
const f = (w, y) => { const { cor, cen } = terms(w, [y[0], y[1]], [y[2], y[3]]); return [y[2], y[3], cor[0] + cen[0], cor[1] + cen[1]]; };
function step(w, y, h) {
  const add = (k, c) => y.map((v, j) => v + c * k[j]);
  const k1 = f(w, y), k2 = f(w, add(k1, h / 2)), k3 = f(w, add(k2, h / 2)), k4 = f(w, add(k3, h));
  return y.map((v, j) => v + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
}
/** χ in the co-rotating chart at time t (RK4 from t = 0): [β1, β2, β̇1, β̇2]; with pts, also the points along the way. */
export function corotating(st, t, pts) {
  let y = [...st.p0, ...st.w0];
  const n = Math.max(1, Math.ceil(t / H)), h = t / n;
  if (pts) pts.push([y[0], y[1]]);
  for (let i = 0; i < n; i++) { y = step(st.omega, y, h); if (pts && (i % 4 === 3 || i === n - 1)) pts.push([y[0], y[1]]); }
  return y;
}
/** χ in the inertial chart, where Γ_𝒳 = 0: the straight line χ_𝒰(t) = χ(0) + t χ̇_𝒰(0); [α1, α2, α̇1, α̇2]. */
export function inertial(st, t) {
  const v = velX(0, st.p0, st.w0, st.omega);
  return [st.p0[0] + t * v[0], st.p0[1] + t * v[1], v[0], v[1]];
}
/** Pieces of a polyline inside the drawn box. */
function inBox(pts) {
  const out = [];
  let cur = null;
  for (const p of pts) {
    if (Math.abs(p[0]) <= LIM[1] && Math.abs(p[1]) <= LIM[1]) { if (!cur) out.push(cur = []); cur.push(p); } else cur = null;
  }
  return out;
}
const clampLen = (v, m) => { const n = Math.hypot(...v); return n > m ? v.map(c => c * m / n) : v; };

export default async function mount(body) {
  const st = JSON.parse(JSON.stringify(START));
  body.append(note('Drag \\(\\chi(0)\\) or the tip of \\(v\\), set \\(\\omega\\) and move \\(t\\) along \\(\\chi\\).'));
  const bar = controls(body);
  const sW = slider({ label: '\\(\\omega\\)', aria: 'ω', min: OM[0], max: OM[1], step: 0.05, value: st.omega, onInput: v => { st.omega = v; update(); } });
  const sT = slider({ label: '\\(t\\)', aria: 't', min: 0, max: TMAX, step: 0.01, value: st.t, onInput: v => { st.t = v; update(); } });
  sW.el.classList.add('dg-nc-omega');
  bar.append(sW.el, sT.el);

  const stage = el('div', { class: 'dg-nc' });
  const two = el('div', { class: 'dg-two' });
  const left = el('div', { class: 'dg-panel' }), right = el('div', { class: 'dg-panel' });
  two.append(left, right);
  stage.append(two);
  body.append(stage);
  const setP0 = ([x, y]) => { st.p0 = clampLen([x, y], PMAX); update(); };
  const setV = ([x, y]) => { const v = clampLen([x - st.p0[0], y - st.p0[1]], VMAX); st.w0 = velY(0, st.p0, v, st.omega); update(); };
  const corner = (pl, a, b) => {
    pl.label('x', [LIM[1], LIM[0]], `\\(${a}\\)`, { anchor: 'se', dx: -4, dy: -4, class: 'dg-axis-label' });
    pl.label('y', [LIM[0], LIM[1]], `\\(${b}\\)`, { anchor: 'nw', dx: 5, dy: 4, class: 'dg-axis-label' });
  };
  const path = (pl, pts) => { for (const run of inBox(pts)) pl.line(run, { color: C.chi, width: 2.4 }); };
  const start = (pl, anchor, dy) => {
    pl.handle(st.p0, { key: 'p0', r: 6.5, fill: '#000', stroke: '#fff', ariaLabel: 'χ(0)', onDrag: (x, y) => setP0([x, y]) });
    pl.label('p0', st.p0, '\\(\\chi(0)\\)', { anchor, dx: anchor === 'se' ? -7 : 0, dy });
  };

  const opt = { xlim: LIM, ylim: LIM, equal: true, maxWidth: 360, margin: { l: 30, r: 8, t: 22, b: 24 }, role: 'group' };
  const pX = new Plot2D(left, { ...opt, label: '(𝒰, 𝒳)', draw: drawX });
  const pY = new Plot2D(right, { ...opt, label: '(𝒱, 𝒴)', draw: drawY });
  stage.prepend(legend([{ label: '\\(\\chi\\)', color: C.chi, width: 2.4 }, { label: 'Coriolis', color: C.cor, width: 2.4 }, { label: 'centrifugal', color: C.cen, width: 2.4 }]));

  // the numbers: under each chart, the coefficient functions and the components of χ at t in that chart
  const M = () => matrix(2, 1);
  const tex = s => el('span', { class: 'dg-nc-tex' }, `\\(${s}\\)`);
  const pair = (...c) => el('span', { class: 'dg-nc-pair' }, ...c);
  const row = (...c) => el('div', { class: 'dg-eqrow dg-nc-row' }, ...c);
  const term = (m, cap) => el('span', { class: 'dg-nc-term' }, m.el, el('span', { class: 'dg-nc-cap' }, cap));
  const m = { xu: M(), vu: M(), au: M(), g0: matrix(2, 2), g00: M(), xv: M(), ev: M(), vv: M(), av: M(), cor: M(), cen: M() };
  const GX = '\\left( \\Gamma_\\mathscr{X} \\right)', GY = '\\left( \\Gamma_\\mathscr{Y} \\right)';
  left.append(el('div', { class: 'dg-nc-out' },
    row(tex(`${GX}^i_{jk} = 0`)),
    row(pair(tex('\\chi^\\alpha_\\mathcal{U}(t) ='), m.xu.el), pair(tex('\\dot{\\chi}^\\alpha_\\mathcal{U}(t) ='), m.vu.el), pair(tex('\\ddot{\\chi}^\\alpha_\\mathcal{U}(t) ='), m.au.el))));
  right.append(el('div', { class: 'dg-nc-out' },
    row(pair(tex(`${GY}^\\alpha_{0\\beta} = ${GY}^\\alpha_{\\beta0} =`), m.g0.el), pair(tex(`${GY}^\\alpha_{00}(\\beta) = - \\omega^2 \\beta_\\alpha =`), m.g00.el)),
    row(pair(tex('\\chi^\\alpha_\\mathcal{V}(t) ='), m.xv.el), pair(tex('\\textrm{\\runic ᛖ}_{\\mathcal{U}\\mathcal{V}} \\, \\chi_\\mathcal{U}(t) ='), m.ev.el), pair(tex('\\dot{\\chi}^\\alpha_\\mathcal{V}(t) ='), m.vv.el)),
    row(pair(tex('\\ddot{\\chi}^\\alpha_\\mathcal{V}(t) ='), m.av.el), pair(el('span', { text: '=' }), term(m.cor, 'Coriolis')), pair(el('span', { text: '+' }), term(m.cen, 'centrifugal')))));

  function drawX(pl) {
    const { omega: w, t } = st, [c, s] = cs(w, t), R = LIM[1] * 0.92;
    // the axes of the co-rotating chart at time t, θ = ωt
    for (const [d, k, nm] of [[[c, s], 'b1', '\\beta_1'], [[-s, c], 'b2', '\\beta_2']]) {
      pl.arrow([-R * d[0], -R * d[1]], [R * d[0], R * d[1]], { color: C.axes, width: 1, head: 8, class: 'dg-inert' });
      pl.label(k, [0.8 * R * d[0], 0.8 * R * d[1]], `\\(${nm}\\)`, { anchor: 'c', dx: 11 * d[1], dy: 11 * d[0], class: 'dg-nc-faint' });
    }
    const x0 = inertial(st, 0), xt = inertial(st, t);
    path(pl, [[x0[0], x0[1]], inertial(st, TMAX).slice(0, 2)]);
    pl.point([xt[0], xt[1]], { r: 4.5, fill: C.chi });
    const tip = [x0[0] + x0[2], x0[1] + x0[3]];
    pl.arrow(st.p0, tip, { color: C.v, width: 2.2, head: 10, class: 'dg-inert' });
    pl.label('v', tip, '\\(v\\)', { anchor: 'w', dx: 12 });
    start(pl, x0[3] >= 0 ? 'n' : 's', x0[3] >= 0 ? 9 : -9);
    pl.handle(tip, { key: 'v', r: 9, fill: 'transparent', stroke: C.v, strokeWidth: 1.5, ariaLabel: 'v', onDrag: (x, y) => setV([x, y]) });
    corner(pl, '\\alpha_1', '\\alpha_2');
    pl.label('t', [0, LIM[1]], '\\((\\mathcal{U}, \\mathscr{X})\\)', { anchor: 's', dy: -3 });
  }

  function drawY(pl) {
    const pts = [], { omega: w, t } = st;
    const y = corotating(st, t), r0 = Math.hypot(...st.p0);
    // the circle of radius |χ(0)| (Figure C.15: of radius r0, whose involute χ traces when it starts at rest in 𝒴)
    const circ = Array.from({ length: 121 }, (_, k) => [r0 * Math.cos(k * Math.PI / 60), r0 * Math.sin(k * Math.PI / 60)]);
    pl.line(circ, { color: C.circ, width: 1.2, dash: '5 4' });
    corotating(st, TMAX, pts);
    path(pl, pts);
    if (Math.hypot(...st.w0) > 0.02) pl.arrow(st.p0, [st.p0[0] + st.w0[0], st.p0[1] + st.w0[1]], { color: C.v, width: 1.6, head: 9, class: 'dg-inert' });
    const { cor, cen } = terms(w, [y[0], y[1]], [y[2], y[3]]), q = [y[0], y[1]];
    for (const [a, col] of [[cen, C.cen], [cor, C.cor]]) if (Math.hypot(...a) * ACC > 0.03) pl.arrow(q, [q[0] + ACC * a[0], q[1] + ACC * a[1]], { color: col, width: 2.4, head: 10, class: 'dg-inert' });
    pl.point(q, { r: 4.5, fill: C.chi });
    start(pl, 'se', -5);
    corner(pl, '\\beta_1', '\\beta_2');
    pl.label('t', [0, LIM[1]], '\\((\\mathcal{V}, \\mathscr{Y}), \\; \\theta = \\omega t\\)', { anchor: 's', dy: -3 });
  }

  function update() {
    const { omega: w, t } = st;
    pX.update(); pY.update();
    const x = inertial(st, t), y = corotating(st, t), { G0, G00 } = Gamma(w, [y[0], y[1]], t), { cor, cen } = terms(w, [y[0], y[1]], [y[2], y[3]]);
    const col = v => v.map(c => [c]);
    m.xu.set(col(x.slice(0, 2))); m.vu.set(col(x.slice(2))); m.au.set(col([0, 0]));
    m.g0.set(G0); m.g00.set(col(G00));
    m.xv.set(col(y.slice(0, 2))); m.ev.set(col(toY(t, x, w))); m.vv.set(col(y.slice(2)));
    m.av.set(col([cor[0] + cen[0], cor[1] + cen[1]])); m.cor.set(col(cor)); m.cen.set(col(cen));
    stage.dataset.state = JSON.stringify(st);
  }
  update();
  await typeset(body);
}
