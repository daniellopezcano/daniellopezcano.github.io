// Hand-written (not generated): interactive after Figure C.17 (label fig_Example_Newtonian_Tidal), Appendix C.8.3. No
// notebook. Everything comes from C.8.3 (Appendices/examples_and_exercises/example_newton_cartan.tex, "With Gravity: a Point
// Mass") and §9.5 (Chapters/Newtonian_Gravity.tex): the point mass M at the spatial origin, Φ(α) = −GM/|α|, the only
// non-vanishing coefficient functions in the chart at rest (𝒰, 𝒳) are (Γ_𝒳)^σ_00(α) = ∂σΦ(α) = GM ασ/|α|³; Newton II with
// f = 0 is  α̈^σ = −(Γ_𝒳)^σ_00(α)  (for the radial fall ζ = (t, r, 0, 0): r̈ = −GM/r²), integrated here with RK4; the notes'
// closed form for ζ released from rest at 2 r0:  t(r) = (2/ω)(√(x(1 − x)) + arccos √x), x = r/(2r0),  ṙ² = 2GM/r − GM/r0;
// Riem^σ_0κ0 = ∂κ∂σΦ = GM/|α|⁵ (|α|² δσκ − 3 ασ ακ), on ζ GM/r³ diag(−2, 1, 1) with GM/r³ = ω²/(8x³); the falling chart
// (𝒱, 𝒴) (θ = 0, b(t) = (r(t), 0, 0)) with (Γ_𝒴)^α_00(t, β) = GM (β + b)_α/|β + b|³ − (GM/r²) δ^α_1, which vanishes at β = 0,
// and the tidal acceleration of a second free particle  β̈_α = −(Γ_𝒴)^α_00(t, β) = −Riem^α_0κ0 β_κ + O(|β|²).
// Units r0 = ω = 1, so GM = r0³ω² = 1 (the notes assume ω² = GM/r0³ from the circular orbit γ on). The worldline ζ starts
// at t = 0 at r(0) = R with ṙ(0) = u (the notes': R = 2r0, u = 0); a ring of free particles is released at rest in the
// falling chart at t = 0 around ζ(0), at distance EPS, and followed with the same equation in 𝒳 (β = α − b(t)). A particle
// that comes within RMIN of the source stops the integration: the t slider ends where the first of them (or ζ) does.
import { el, controls, slider, note, legend, matrix, fmt, Plot2D, vibrant } from './dg.js';
import { typeset } from '../course.js';

export const GM = 1, R0 = 1, OMEGA = 1;
export const START = { R: 2, u: 0, t: 1.5 };
export const EPS = 0.1, NRING = 12, RMIN = 0.05, TLIM = 3.6;
const H = 0.004, CH = 0.01, DT = 0.9, RL = [1, 2.4], UL = [-1, 1], TL = [-3.7, 3.7], YL = [0, 2.6], FL = [[-0.42, 0.42], [-0.26, 0.26]], ARR = 0.5;
const C = { z: vibrant.orange, g: vibrant.blue, ref: '#9a9a9a', ring: '#222222', p1: vibrant.magenta, p2: vibrant.blue };
const PI = Math.PI;

/** (Γ_𝒳)^σ_00(α) = ∂σΦ(α) = GM ασ/|α|³ (spatial components; α in the plane α3 = 0). */
export const GammaX = a => { const r = Math.hypot(...a); return a.map(c => GM * c / r ** 3); };
/** (Γ_𝒴)^α_00(t, β) = ∂αΦ(β + b(t)) + b̈^α(t), b = (r, 0, 0), b̈ = (−GM/r², 0, 0). */
export const GammaY = (b, r) => { const g = GammaX([b[0] + r, b[1]]); return [g[0] - GM / (r * r), g[1]]; };
/** Riem^σ_0κ0(α) = ∂κ∂σΦ(α) = GM/|α|⁵ (|α|² δσκ − 3 ασ ακ), σ, κ = 1, 2, 3. */
export const Riem = a => { const r2 = a.reduce((s, c) => s + c * c, 0), k = GM / r2 ** 2.5; return a.map((s, i) => a.map((q, j) => k * ((i === j ? r2 : 0) - 3 * s * q))); };
/** The notes' closed form for ζ released from rest at 2 r0 (t >= 0). */
export const tOfR = r => { const x = r / (2 * R0); return 2 / OMEGA * (Math.sqrt(x * (1 - x)) + Math.acos(Math.sqrt(x))); };

const fr = s => { const g = GammaX([s[0], s[1]]); return [s[2], s[3], -g[0], -g[1]]; };
function step(s, h) {
  const add = (k, c) => s.map((v, j) => v + c * k[j]);
  const k1 = fr(s), k2 = fr(add(k1, h / 2)), k3 = fr(add(k2, h / 2)), k4 = fr(add(k3, h));
  return s.map((v, j) => v + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
}
const hOf = s => Math.min(H, CH * Math.hypot(s[0], s[1]) ** 1.5);
/** The free particle with α(0) = a0, α̇(0) = v0 (RK4, steps shorter near the source): [α1, α2, α̇1, α̇2] at t (t may be
 *  negative), or null if it came within RMIN of the source. each(T, s) is called after every step. */
export function free(a0, v0, t, each) {
  let s = [...a0, ...v0], T = 0;
  const sg = t < 0 ? -1 : 1;
  while (T !== t) {
    const h = sg * hOf(s);
    if (Math.abs(t - T) <= Math.abs(h)) { s = step(s, t - T); T = t; } else { s = step(s, h); T += h; }
    if (!(Math.hypot(s[0], s[1]) >= RMIN)) return null;
    if (each && each(T, s) === false) return s;
  }
  return s;
}
/** The time at which that particle reaches RMIN going forwards (dir 1) or backwards (−1), or ±TLIM. */
function end(a0, v0, dir) {
  let last = 0;
  return free(a0, v0, dir * TLIM, T => { last = T; }) ? dir * TLIM : last;
}
export const ring = st => Array.from({ length: NRING }, (_, k) => [st.R + EPS * Math.cos(2 * PI * k / NRING), EPS * Math.sin(2 * PI * k / NRING)]);
/** The range of t in which ζ and every particle of the ring stay away from the source (multiples of 0.01, inwards). */
export function range(st) {
  const a0 = [[st.R, 0], ...ring(st)], v0 = [st.u, 0];
  const lo = Math.max(...a0.map(a => end(a, v0, -1))), hi = Math.min(...a0.map(a => end(a, v0, 1)));
  return [Math.ceil(lo * 100 - 1e-9) / 100, Math.floor(hi * 100 + 1e-9) / 100];
}
/** Everything the panel shows at time t. */
export function at(st, t) {
  const z = free([st.R, 0], [st.u, 0], t), r = z[0];
  const ps = ring(st).map(a => { const s = free(a, [st.u, 0], t); return [s[0] - r, s[1]]; });
  const acc = ps.map(b => GammaY(b, r).map(g => -g));                      // β̈_α = −(Γ_𝒴)^α_00(t, β)
  const Rm = Riem([r, 0, 0]);
  const tidal = ps.map(b => [0, 1].map(a => -(Rm[a][0] * b[0] + Rm[a][1] * b[1])));
  return { r, rd: z[2], rdd: -GammaX([r, 0])[0], gx: GammaX([r, 0])[0], gy0: GammaY([0, 0], r), Rm, k: GM / r ** 3, x: r / (2 * R0), ps, acc, tidal };
}
const notes = st => st.R === 2 * R0 && st.u === 0;

export default async function mount(body) {
  const st = JSON.parse(JSON.stringify(START));
  let rng = range(st);
  body.append(note('Drag \\(\\zeta(0)\\) or the tip of \\(\\dot{\\zeta}(0)\\) and move \\(t\\) along \\(\\zeta\\) \\((r_0 = \\omega = 1)\\).'));
  const bar = controls(body);
  const sT = slider({ label: '\\(t\\)', aria: 't', min: rng[0], max: rng[1], step: 0.01, value: st.t, onInput: v => { st.t = v; update(); } });
  bar.append(sT.el);

  const stage = el('div', { class: 'dg-nc' });
  const two = el('div', { class: 'dg-two' });
  const left = el('div', { class: 'dg-panel' }), right = el('div', { class: 'dg-panel' });
  two.append(left, right);
  stage.append(two);
  body.append(stage);
  const setStart = (R, u) => {
    st.R = Math.min(RL[1], Math.max(RL[0], Math.round(R * 100) / 100));
    st.u = Math.min(UL[1], Math.max(UL[0], Math.round(u * 100) / 100));
    rng = range(st);
    st.t = Math.min(rng[1], Math.max(rng[0], st.t));
    sT.input.min = rng[0]; sT.input.max = rng[1]; sT.set(st.t, false);
    update();
  };
  const keys = (e, f) => { const d = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05 }[e.key]; if (!d) return false; f(d); return true; };

  const pT = new Plot2D(left, { xlim: TL, ylim: YL, aspect: 0.62, maxWidth: 400, xticks: [], yticks: [], grid: false, margin: { l: 34, r: 10, t: 12, b: 24 }, role: 'group', label: 'r = |ζ_𝒰|', draw: drawT });
  const pF = new Plot2D(right, { xlim: FL[0], ylim: FL[1], equal: true, maxWidth: 400, margin: { l: 38, r: 10, t: 22, b: 24 }, label: 'falling chart', draw: drawF });
  stage.prepend(legend([{ label: '\\(\\zeta\\)', color: C.z, width: 2.4 }, { label: '\\(|\\gamma_\\mathcal{U}| = r_0\\)', color: C.g, width: 1.4, dash: '5 4' },
    { label: '\\(\\ddot{\\beta}_\\alpha\\)', color: C.z, width: 2 }]));

  // the numbers: under the (t, r) diagram ζ in the chart at rest, under the falling chart the coefficients and the tide
  const tex = s => el('span', { class: 'dg-nc-tex' }, `\\(${s}\\)`);
  const val = () => el('span', { class: 'dg-nc-val' });
  const pair = (...c) => el('span', { class: 'dg-nc-pair' }, ...c);
  const row = (...c) => el('div', { class: 'dg-eqrow dg-nc-row' }, ...c);
  const v = { r: val(), rd: val(), rdd: val(), x: val(), tr: val(), rd2: val(), k: val() };
  const GX = '\\left( \\Gamma_\\mathscr{X} \\right)', GY = '\\left( \\Gamma_\\mathscr{Y} \\right)';
  const closed = [row(pair(tex('x = \\frac{r}{2 r_0} ='), v.x), pair(tex('t(r) = \\frac{2}{\\omega} \\Big( \\sqrt{x (1 - x)} + \\arccos \\sqrt{x} \\Big) ='), v.tr)),
    row(pair(tex('\\dot{r}^2 = \\frac{2 G M}{r} - \\frac{G M}{r_0} ='), v.rd2))];
  left.append(el('div', { class: 'dg-nc-out' },
    row(pair(tex('r(t) ='), v.r), pair(tex('\\dot{r}(t) ='), v.rd)),
    row(pair(tex(`\\ddot{r} = - ${GX}^1_{00}\\big( \\zeta(t) \\big) = - \\frac{G M}{r^2} =`), v.rdd)), ...closed));
  const mG = matrix(2, 1), mR = matrix(3, 3);
  const tide = el('div', { class: 'dg-nc-tide' }, el('span'), tex('\\beta_\\alpha'), tex(`\\ddot{\\beta}_\\alpha = - ${GY}^\\alpha_{00}(t, \\beta)`), tex('- \\mathrm{Riem}^\\alpha_{0\\kappa0} \\, \\beta_\\kappa'));
  const tm = [C.p1, C.p2].map(c => {
    const ms = [matrix(2, 1, 4), matrix(2, 1, 4), matrix(2, 1, 4)];
    tide.append(el('span', { class: 'dg-nc-dot', style: `background:${c}`, 'aria-hidden': 'true' }), ...ms.map(x => x.el));
    return ms;
  });
  right.append(el('div', { class: 'dg-nc-out' },
    row(pair(tex(`${GY}^\\alpha_{00}(t, 0) =`), mG.el)),
    row(pair(tex('\\mathrm{Riem}^\\alpha_{0\\kappa0}\\big( \\zeta(t) \\big) ='), mR.el), pair(tex('\\frac{G M}{r^3} = \\frac{\\omega^2}{8 x^3} ='), v.k)),
    tide));

  function drawT(pl) {
    const ln = (p, q, color, dash, w = 1.2) => pl.line([p, q], { color, width: w, dash });
    ln([TL[0], 2 * R0], [TL[1], 2 * R0], C.ref, '4 3');
    for (const t of [-PI / OMEGA, 0, PI / OMEGA]) ln([t, 0], [t, YL[1]], C.ref, '4 3');
    ln([TL[0], R0], [TL[1], R0], C.g, '5 4', 1.4);
    // ζ, both ways from t = 0, until it comes within RMIN of the source or leaves the diagram
    for (const dir of [-1, 1]) {
      const pts = [[0, st.R]];
      free([st.R, 0], [st.u, 0], dir * TLIM, (T, s) => { if (s[0] > YL[1] + 0.05) return false; pts.push([T, s[0]]); });
      pl.line(pts, { color: C.z, width: 2.4 });
    }
    const z = free([st.R, 0], [st.u, 0], st.t);
    pl.point([st.t, z[0]], { r: 5, fill: C.z, stroke: '#222', strokeWidth: 1 });
    const tip = [DT, st.R + st.u * DT];
    pl.arrow([0, st.R], tip, { color: '#222', width: 2, head: 10, class: 'dg-inert' });
    pl.handle([0, st.R], { key: 'z0', r: 6.5, fill: '#000', stroke: '#fff', ariaLabel: 'ζ(0)', onDrag: (x, y) => setStart(y, st.u),
      onKey: e => keys(e, d => setStart(st.R + d, st.u)) });
    pl.handle(tip, { key: 'zv', r: 9, fill: 'transparent', stroke: '#222', strokeWidth: 1.5, ariaLabel: 'ζ̇(0)', onDrag: (x, y) => setStart(st.R, (y - st.R) / DT),
      onKey: e => keys(e, d => setStart(st.R, st.u + d)) });
    pl.label('z0', [0, st.R], '\\(\\zeta(0)\\)', { anchor: 'se', dx: -7, dy: -5 });
    for (const [t, s] of [[-PI, '- \\pi / \\omega'], [0, '0'], [PI, '\\pi / \\omega']]) pl.label('t' + t, [t, 0], `\\(${s}\\)`, { anchor: 'n', dy: 4, class: 'dg-nc-tick' });
    for (const [r, s] of [[R0, 'r_0'], [2 * R0, '2 r_0']]) pl.label('r' + r, [TL[0], r], `\\(${s}\\)`, { anchor: 'e', dx: -4, class: 'dg-nc-tick' });
    pl.label('x', [TL[1], 0], '\\(t\\)', { anchor: 'se', dx: -4, dy: -4, class: 'dg-axis-label' });
    pl.label('y', [TL[0], YL[1]], '\\(r\\)', { anchor: 'nw', dx: 5, dy: 4, class: 'dg-axis-label' });
  }

  function drawF(pl) {
    const a = at(st, st.t), [xl, yl] = FL;
    pl.line(Array.from({ length: 73 }, (_, k) => [EPS * Math.cos(k * PI / 36), EPS * Math.sin(k * PI / 36)]), { color: C.ref, width: 1.2, dash: '4 3' });
    pl.line([...a.ps, a.ps[0]], { color: C.z, width: 1.4 });
    a.ps.forEach((b, k) => {
      const d = a.acc[k].map(c => ARR * c / a.k);                               // the arrows: β̈ r³/(GM), scaled
      pl.arrow(b, [b[0] + d[0], b[1] + d[1]], { color: C.z, width: 1.8, head: 8, class: 'dg-inert' });
    });
    a.ps.forEach((b, k) => pl.point(b, { r: k === 0 || k === NRING / 4 ? 4.5 : 2.6, fill: k === 0 ? C.p1 : k === NRING / 4 ? C.p2 : C.ring }));
    pl.point([0, 0], { r: 4, fill: C.z, stroke: '#222', strokeWidth: 1 });
    pl.label('z', [0, 0], '\\(\\zeta\\)', { anchor: 'nw', dx: 5, dy: 3 });
    pl.arrow([xl[0] + 0.2, yl[0] + 0.05], [xl[0] + 0.05, yl[0] + 0.05], { color: '#777', width: 1.2, head: 7, class: 'dg-inert' });
    pl.label('m', [xl[0] + 0.125, yl[0] + 0.05], 'to \\(M\\)', { anchor: 's', dy: -2, class: 'dg-nc-tick' });
    pl.label('x', [xl[1], yl[0]], '\\(\\beta_1\\)', { anchor: 'se', dx: -4, dy: -4, class: 'dg-axis-label' });
    pl.label('y', [xl[0], yl[1]], '\\(\\beta_2\\)', { anchor: 'nw', dx: 5, dy: 4, class: 'dg-axis-label' });
    pl.label('t', [0, yl[1]], 'falling chart', { anchor: 's', dy: -3, class: 'dg-nc-title' });
  }

  function update() {
    pT.update(); pF.update();
    const a = at(st, st.t), f = x => fmt(x, 3);
    v.r.textContent = f(a.r); v.rd.textContent = f(a.rd); v.rdd.textContent = f(a.rdd); v.k.textContent = f(a.k);
    const nt = notes(st);
    closed.forEach(r => { r.hidden = !nt; });
    if (nt) { v.x.textContent = f(a.x); v.tr.textContent = f(tOfR(a.r)); v.rd2.textContent = f(2 * GM / a.r - GM / R0); }
    mG.set(a.gy0.map(c => [c])); mR.set(a.Rm);
    [0, NRING / 4].forEach((k, i) => { tm[i][0].set(a.ps[k].map(c => [c])); tm[i][1].set(a.acc[k].map(c => [c])); tm[i][2].set(a.tidal[k].map(c => [c])); });
    stage.dataset.state = JSON.stringify({ ...st, range: rng });
  }
  update();
  await typeset(body);
}
