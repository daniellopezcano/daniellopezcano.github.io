// Hand-written (not generated): interactive after Figure 10.1 (label fig_light_cones), the opening page of Chapter 10. No
// notebook. Everything comes from Chapter 10 (Chapters/GR.tex): the metric of the motivation box, special relativity on ℝ⁴
// in inertial coordinates, (η_ij) = diag(1, −1, −1, −1), here with one spatial dimension (Figure 10.1 suppresses one too:
// (η_ij) = diag(1, −1), coordinates α = (α⁰, α¹)); §10.1: a non-zero 𝒳_p is timelike, lightlike or spacelike as
// g_p(𝒳_p, 𝒳_p) > 0, = 0, < 0, and a causal one future (past) directed as g_p(ᛏ(p), 𝒳_p) > 0 (< 0), with ᛏ = ∂x₀ here;
// the worldline γ of a massive particle (v timelike and future directed) and its proper time
//   τ_[λ1, λ2][γ] = ∫ √(η_ij γ̇^i_𝒰 γ̇^j_𝒰) dλ;
// §10.1.1: an observer's frame at γ(λ3), e_0 = v_γ (γ parametrized by proper time: v/s_γ in any other parametrization), e_1
// with g(e_a, e_b) = η_ab, and the components measured by the observer, ε⁰(𝒳) = g(e_0, 𝒳), ε¹(𝒳) = −g(e_1, 𝒳), with
// g(𝒳, 𝒳) = (ε⁰(𝒳))² − (ε¹(𝒳))². The worldline is parametrized by λ = α⁰ (γ⁰_𝒰(λ) = λ) and γ¹_𝒰 is the cubic Hermite
// interpolation (Catmull–Rom tangents) of five draggable points at λ = 0, …, 4; a drag that would make |γ̇¹_𝒰| reach VMAX
// anywhere (so that v would no longer be safely timelike) is stopped where it still is not. Tangent vectors are drawn at
// their base point at the scale S of the drawing, as the figure draws them.
import { el, controls, slider, note, legend, matrix, fmt, simpson, Plot2D } from './dg.js';
import { typeset } from '../course.js';

export const START = { c: [-0.2, -0.45, -0.25, 0.35, 0.55], l1: 0.4, l2: 1.9, l3: 2.5, X: [0.4, 0.8] };
export const VMAX = 0.75, CMAX = 1.15, XL = [-0.8, 0.8], XR = [-1.1, 1.1], L3 = [0.6, 3.4], S = 0.75, SNAP = 0.03;
const N = 4, XLIM = [-2.4, 2.4], YLIM = [-0.4, 4.8], HC = 0.7;
// the notes' figure colours (main.tex), text in the darker shades of course.css (contrast on white)
const C = { wl: '#6c026c', v: '#d60202', e1: '#222222', T: '#2bac2b', Tt: '#1d841d', fut: '#bdc9ed', futE: '#3859bd', past: '#d9d9d9', pastE: '#8c8c8c',
  tau: '#d6d602', X: '#d68b02', Xt: '#a16600' };

/** Catmull–Rom tangents (one-sided at the ends) of the points c_k at λ = k. */
const tangents = c => c.map((_, k) => k === 0 ? c[1] - c[0] : k === N ? c[N] - c[N - 1] : (c[k + 1] - c[k - 1]) / 2);
const seg = l => Math.min(N - 1, Math.max(0, Math.floor(l)));
/** γ¹_𝒰(λ) and γ̇¹_𝒰(λ), λ in [0, 4]. */
export function curve(c, l) {
  const m = tangents(c), k = seg(l), s = l - k, d = c[k + 1] - c[k];
  const x = (2 * s ** 3 - 3 * s * s + 1) * c[k] + (s ** 3 - 2 * s * s + s) * m[k] + (-2 * s ** 3 + 3 * s * s) * c[k + 1] + (s ** 3 - s * s) * m[k + 1];
  const xd = 6 * s * (1 - s) * d + (3 * s * s - 4 * s + 1) * m[k] + (3 * s * s - 2 * s) * m[k + 1];
  return [x, xd];
}
/** max |γ̇¹_𝒰| on [0, 4]: on each segment γ̇¹ is a quadratic in s, so its extremes are at the ends or at the vertex. */
export function maxSpeed(c) {
  const m = tangents(c);
  let w = 0;
  for (let k = 0; k < N; k++) {
    const d = c[k + 1] - c[k], A = -6 * d + 3 * m[k] + 3 * m[k + 1], B = 6 * d - 4 * m[k] - 2 * m[k + 1], q = s => (A * s + B) * s + m[k];
    w = Math.max(w, Math.abs(q(0)), Math.abs(q(1)));
    if (A !== 0) { const s = -B / (2 * A); if (s > 0 && s < 1) w = Math.max(w, Math.abs(q(s))); }
  }
  return w;
}
/** The points with c_k moved towards v as far as the worldline stays inside |γ̇¹_𝒰| < VMAX (and |c_k| <= CMAX). */
export function moveKnot(c, k, v) {
  v = Math.max(-CMAX, Math.min(CMAX, v));
  const at = x => { const d = c.slice(); d[k] = x; return d; };
  if (maxSpeed(at(v)) < VMAX) return at(v);
  let a = c[k], b = v;                                       // a valid, b not
  for (let i = 0; i < 40; i++) { const h = (a + b) / 2; if (maxSpeed(at(h)) < VMAX) a = h; else b = h; }
  return at(a);
}
/** s_γ(λ) = √(η_ij γ̇^i_𝒰 γ̇^j_𝒰) with γ̇⁰_𝒰 = 1. */
export const sOf = u => Math.sqrt(1 - u * u);
/** τ_[λ1, λ2][γ] = ∫ s_γ dλ (Simpson on each piece between the points, where the integrand is smooth). */
export function tau(c, l1, l2) {
  const cuts = [l1, ...[1, 2, 3].filter(k => k > l1 && k < l2), l2];
  let t = 0;
  for (let i = 0; i + 1 < cuts.length; i++) t += simpson(l => sOf(curve(c, l)[1]), cuts[i], cuts[i + 1], 100);
  return t;
}
const g = (a, b) => a[0] * b[0] - a[1] * b[1];                                 // η_ij a^i b^j, components (α⁰, α¹)
/** The observer's frame at γ(λ3): e_0 = v/s_γ, e_1 with g(e_0, e_1) = 0, g(e_1, e_1) = −1 (pointing to growing α¹). */
export function frame(u) { const s = sOf(u); return [[1 / s, u / s], [u / s, 1 / s]]; }
/** Everything the panel shows. */
export function at(st) {
  const [x3, u] = curve(st.c, st.l3), s = sOf(u), e = frame(u), X = st.X, Q = g(X, X);
  const eps = [g(e[0], X), -g(e[1], X)];
  return { p: [st.l3, x3], u, s, e, ee: e.map(a => e.map(b => g(a, b))), tau: tau(st.c, st.l1, st.l2), dl: st.l2 - st.l1,
    Q, tX: X[0], eps, Qe: eps[0] ** 2 - eps[1] ** 2, kind: kind(X) };
}
/** The notes' words for 𝒳_p (non-zero): timelike / lightlike / spacelike, and future or past directed for causal vectors. */
export function kind(X) {
  const Q = g(X, X), c = Q > 0 ? 'timelike' : Q === 0 ? 'lightlike' : 'spacelike';
  return Q < 0 ? c : c + ', ' + (X[0] > 0 ? 'future directed' : 'past directed');
}
const r2 = x => Math.round(x * 100) / 100;
/** 𝒳_p from a dragged or stepped tip: inside the box, on the light cone when within SNAP of it, never zero. */
export function setX(X, x0, x1) {
  x0 = Math.max(XL[0], Math.min(XL[1], r2(x0))); x1 = Math.max(XR[0], Math.min(XR[1], r2(x1)));
  if (Math.abs(Math.abs(x0) - Math.abs(x1)) < SNAP) x1 = (x1 < 0 ? -1 : 1) * Math.abs(x0);
  return Math.abs(x0) < 0.05 && Math.abs(x1) < 0.05 ? X : [x0, x1];
}

export default async function mount(body) {
  const st = JSON.parse(JSON.stringify(START));
  body.append(note('Drag the points of \\(\\gamma\\) or the tip of \\(\\mathcal{X}_p\\), and move \\(\\lambda_1\\), \\(\\lambda_2\\), \\(\\lambda_3\\) along \\(\\gamma\\).'));
  const bar = controls(body);
  const sl = ['l1', 'l2', 'l3'].map((k, i) => slider({ label: `\\(\\lambda_${i + 1}\\)`, aria: 'λ' + '₁₂₃'[i], min: k === 'l3' ? L3[0] : k === 'l1' ? 0 : 0.1,
    max: k === 'l3' ? L3[1] : k === 'l1' ? 3.9 : 4, step: 0.01, value: st[k], onInput: v => setL(k, v) }));
  bar.append(...sl.map(s => { s.el.classList.add('dg-gr-lam'); return s.el; }));
  function setL(k, v) {
    st[k] = v;
    if (k === 'l1' && st.l2 < v + 0.1) { st.l2 = r2(v + 0.1); sl[1].set(st.l2, false); }
    if (k === 'l2' && st.l1 > v - 0.1) { st.l1 = r2(v - 0.1); sl[0].set(st.l1, false); }
    update();
  }

  const stage = el('div', { class: 'dg-gr dg-lc' });
  const two = el('div', { class: 'dg-two' }), left = el('div', { class: 'dg-panel' }), right = el('div', { class: 'dg-panel' });
  two.append(left, right); stage.append(two); body.append(stage);
  const tex = s => el('span', { class: 'dg-gr-tex' }, `\\(${s}\\)`);
  const val = () => el('span', { class: 'dg-gr-val' });
  const pair = (...c) => el('span', { class: 'dg-gr-pair' }, ...c);
  const row = (...c) => el('div', { class: 'dg-eqrow dg-gr-row' }, ...c);
  const v = { tau: val(), dl: val(), u: val(), s: val(), Q: val(), tX: val(), Qe: val() };
  const m = { e0: matrix(2, 1), e1: matrix(2, 1), ee: matrix(2, 2, 2), X: matrix(2, 1, 2), eps: matrix(2, 1) };
  const status = el('div', { class: 'dg-gr-status', role: 'status', 'aria-live': 'polite' });
  const v3 = 'v_{\\gamma(\\lambda_3)}';
  right.append(el('div', { class: 'dg-gr-out' },
    row(pair(tex('\\tau_{[\\lambda_1, \\lambda_2]}[\\gamma] = \\int_{\\lambda_1}^{\\lambda_2} \\sqrt{ \\eta_{ij} \\, \\dot{\\gamma}^i_\\mathcal{U}(\\lambda) \\, \\dot{\\gamma}^j_\\mathcal{U}(\\lambda) } \\; d\\lambda ='), v.tau)),
    row(pair(tex('\\gamma^0_\\mathcal{U}(\\lambda) = \\lambda , \\quad \\lambda_2 - \\lambda_1 ='), v.dl)),
    row(pair(tex('p = \\gamma(\\lambda_3) : \\quad \\dot{\\gamma}^1_\\mathcal{U}(\\lambda_3) ='), v.u), pair(tex('s_\\gamma(\\lambda_3) ='), v.s)),
    row(pair(tex(`e_0 = \\frac{${v3}}{s_\\gamma(\\lambda_3)} =`), m.e0.el), pair(tex('e_1 ='), m.e1.el), pair(tex('\\big( g_p(e_a, e_b) \\big) ='), m.ee.el)),
    row(pair(tex('x^i_p ='), m.X.el), pair(tex('\\eta_{ij} \\, x^i_p \\, x^j_p ='), v.Q)),
    row(pair(tex('g_p\\big( \\textrm{\\runic ᛏ}(p), \\mathcal{X}_p \\big) ='), v.tX), status),
    row(pair(tex('\\epsilon^a(\\mathcal{X}_p) ='), m.eps.el), pair(tex('\\big( \\epsilon^0(\\mathcal{X}_p) \\big)^2 - \\big( \\epsilon^1(\\mathcal{X}_p) \\big)^2 ='), v.Qe))));

  const pt = l => [curve(st.c, l)[0], l];                                 // drawing coordinates: (α¹, α⁰)
  const vec = (p, a, k = S) => [p[0] + k * a[1], p[1] + k * a[0]];          // tip of the vector with components (a⁰, a¹) at p
  function cone(pl, p, h, full) {
    const [x, y] = p;
    pl.area([p, [x - h, y + h], [x + h, y + h]], { fill: C.fut, opacity: full ? 0.55 : 0.8, color: C.futE, width: 1 });
    pl.area([p, [x - h, y - h], [x + h, y - h]], { fill: C.past, opacity: full ? 0.5 : 0.8, color: C.pastE, width: 1 });
  }
  function draw(pl) {
    const a = at(st), p = [a.p[1], a.p[0]];
    // the light cone at p (large), and small ones at γ(λ1), γ(λ2)
    cone(pl, p, HC, true);
    for (const l of [st.l1, st.l2]) cone(pl, pt(l), 0.32);
    // the light ray towards which e_0 and e_1 tilt (dotted)
    const sg = a.u < 0 ? -1 : 1;
    // both null lines through p across the drawing (the light cone at p, of any size), the one of the tilt dotted on top
    const ray = (sg, opt) => { const t0 = Math.max(YLIM[0] - p[1], sg > 0 ? XLIM[0] - p[0] : p[0] - XLIM[1]), t1 = Math.min(YLIM[1] - p[1], sg > 0 ? XLIM[1] - p[0] : p[0] - XLIM[0]);
      pl.line([[p[0] + t0 * sg, p[1] + t0], [p[0] + t1 * sg, p[1] + t1]], opt); };
    ray(1, { color: C.futE, width: 1, opacity: 0.55, class: 'dg-lc-null' }); ray(-1, { color: C.futE, width: 1, opacity: 0.55, class: 'dg-lc-null' });
    ray(sg, { color: '#555', width: 1.2, dash: '1.5 3' });
    // the worldline, its proper-time segment underneath, velocities at γ(λ1), γ(λ2)
    const samp = (l0, l1, n) => Array.from({ length: n + 1 }, (_, i) => pt(l0 + (l1 - l0) * i / n));
    pl.line(samp(st.l1, st.l2, 80), { color: C.tau, width: 8, opacity: 0.75 });
    pl.line(samp(0, 3.9, 160), { color: C.wl, width: 2.4 });
    pl.arrow(pt(3.86), pt(4), { color: C.wl, width: 2.4, head: 11, class: 'dg-inert' });
    for (const l of [st.l1, st.l2]) {
      const q = pt(l), u = curve(st.c, l)[1];
      pl.arrow(q, vec(q, [1, u]), { color: C.v, width: 1.8, head: 8, class: 'dg-inert' });
      pl.point(q, { r: 3, fill: '#111' });
    }
    // at p: the time orientation, the observer's frame, 𝒳_p
    pl.arrow(p, vec(p, a.e[0]), { color: C.v, width: 2.4, head: 10, class: 'dg-inert' });
    pl.arrow(p, vec(p, [1, 0], 0.4), { color: C.T, width: 2, head: 8, class: 'dg-inert' });
    pl.arrow(p, vec(p, a.e[1]), { color: C.e1, width: 2.4, head: 10, class: 'dg-inert' });
    const tip = vec(p, st.X);
    pl.arrow(p, tip, { color: C.X, width: 2.2, head: 9, class: 'dg-inert' });
    pl.point(p, { r: 3.5, fill: '#111' });
    // handles: the points of γ (horizontal drags), the tip of 𝒳_p
    st.c.forEach((x, k) => pl.handle([x, k], { key: 'k' + k, r: 5.5, fill: '#fff', stroke: C.wl, strokeWidth: 2, ariaLabel: `γ(${k})`,
      onDrag: nx => { st.c = moveKnot(st.c, k, nx); update(); },
      onKey: e => { const d = { ArrowLeft: -0.05, ArrowRight: 0.05 }[e.key]; if (!d) return false; st.c = moveKnot(st.c, k, r2(st.c[k] + d)); update(); return true; } }));
    pl.handle(tip, { key: 'X', r: 6.5, fill: C.X, stroke: '#fff', ariaLabel: '𝒳ₚ',
      onDrag: (x, y) => { st.X = setX(st.X, (y - p[1]) / S, (x - p[0]) / S); update(); },
      onKey: e => { const d = { ArrowLeft: [0, -0.05], ArrowRight: [0, 0.05], ArrowUp: [0.05, 0], ArrowDown: [-0.05, 0] }[e.key]; if (!d) return false;
        st.X = setX(st.X, st.X[0] + d[0], st.X[1] + d[1]); update(); return true; } });
    // labels
    const side = q => (q[0] > 0.6 ? 'e' : 'w'), off = q => (side(q) === 'e' ? -9 : 9);
    for (const [k, l] of [['1', st.l1], ['2', st.l2]]) { const q = pt(l); pl.label('l' + k, q, `\\(\\gamma(\\lambda_${k})\\)`, { anchor: side(q), dx: off(q), class: 'dg-gr-small dg-gr-halo' }); }
    pl.label('p', p, '\\(p\\)', { anchor: a.u > 0 ? 'nw' : 'ne', dx: a.u > 0 ? 6 : -6, dy: 4, class: 'dg-gr-halo' });
    pl.label('e0', vec(p, a.e[0]), '\\(e_0\\)', { anchor: 'sw', dx: 3, dy: -2, color: '#b00000', class: 'dg-gr-halo' });
    pl.label('e1', vec(p, a.e[1]), '\\(e_1\\)', { anchor: 'nw', dx: 3, dy: 2, class: 'dg-gr-halo' });
    pl.label('X', tip, '\\(\\mathcal{X}_p\\)', { anchor: st.X[1] >= 0 ? 'w' : 'e', dx: st.X[1] >= 0 ? 10 : -10, color: C.Xt, class: 'dg-gr-halo' });
    pl.label('g', pt(4), '\\(\\gamma\\)', { anchor: 's', dy: -6, color: C.wl });
    pl.label('x', [XLIM[1], YLIM[0]], '\\(\\alpha^1\\)', { anchor: 'se', dx: -4, dy: -4, class: 'dg-axis-label' });
    pl.label('y', [XLIM[0], YLIM[1]], '\\(\\alpha^0\\)', { anchor: 'nw', dx: 5, dy: 4, class: 'dg-axis-label' });
  }

  const pl = new Plot2D(left, { xlim: XLIM, ylim: YLIM, equal: true, maxWidth: 400, axes: false, grid: false, margin: { l: 8, r: 8, t: 8, b: 8 },
    role: 'group', label: 'γ', draw });
  left.append(legend([{ label: '\\(\\gamma\\)', color: C.wl, width: 2.4 }, { label: '\\(\\tau_{[\\lambda_1, \\lambda_2]}[\\gamma]\\)', color: C.tau, width: 6 },
    { label: '\\(\\textrm{\\runic ᛏ}\\)', color: C.T, width: 2 }, { label: '\\(\\mathcal{X}_p\\)', color: C.X, width: 2 }]));


  function update() {
    pl.update();
    const a = at(st), f = x => fmt(x, 3);
    v.tau.textContent = f(a.tau); v.dl.textContent = f(a.dl); v.u.textContent = f(a.u); v.s.textContent = f(a.s);
    m.e0.set(a.e[0].map(c => [c])); m.e1.set(a.e[1].map(c => [c])); m.ee.set(a.ee); m.X.set(st.X.map(c => [c])); m.eps.set(a.eps.map(c => [c]));
    v.Q.textContent = f(a.Q); v.tX.textContent = f(a.tX); v.Qe.textContent = f(a.Qe);
    status.textContent = a.kind; status.dataset.kind = a.kind.split(',')[0];
    stage.dataset.state = JSON.stringify(st);
  }
  update();
  await typeset(body);
}
