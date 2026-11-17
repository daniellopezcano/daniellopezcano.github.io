// Hand-written (not generated): interactive after Eq. (Pk3D_window_convolution), § 5.6. Notebook
// notebooks/08_toy_field_statistics.ipynb of SkewerJAX (Lyα DECISIONS L20).
// Everything is along the line of sight, one sightline per realization (so the per-sample 1D power spectrum is the
// per-sightline periodogram of Eq. (Pk3D_1D_per_sightline); the i, j of the notes are dropped: one field):
//   P̂^(s)(k_∥) = (1/L_Λ) |∫_{Λa}^{Λb} dΛ e^{−i k_∥ Λ} δ^(s)(Λ)|²,
// the 1D form of Eqs. (Pk3D_delta_tilde_sample)–(Pk3D_sample_definition), equal to Eq. (Pk3D_P1D_from_xi1D) (the
// transform of the tapered 2PCF). The integral is the sum over the n = L_Λ/dx cells of the interval, Λ_i = Λa + (i + ½) dx:
//   P̂^(s)(k_q) = (dx²/L_Λ) |Σ_i e^{−i k_q Λ_i} δ_i|²,  at the modes k_q = 2πq/L_Λ, q = 1, 2, … (k_q ≤ KMAX);
// computed with the Goertzel recurrence (the same numbers as the direct sum, to 10⁻¹⁰ relative), the phase of Λ_i
// dropping out of |·|². The average over N realizations is Eq. (Pk3D_ensemble_estimator_from_samples). The ensemble
// expectation is Eq. (Pk3D_window_convolution) in 1D, the true P convolved with the Fejér kernel:
//   ⟨P̂^(s)(k)⟩_ens = ∫ dq/(2π) 𝒲(k − q) P(q),  𝒲(k) = L_Λ sinc²(k L_Λ/2)  (∫ dk/(2π) 𝒲 = 1),
// computed by Simpson's rule on the grid q = j h, h = 2π/(24 L_Λ) (24 points per period of sin²(k L_Λ/2); the modes
// k_q are grid points), |q| ≤ QMAX = 8/ℓ, where P < 10⁻¹³ of its maximum. The cell sum makes the panel's expectation
// differ from this by the discrete Fejér kernel's tails, O(dx²/L_Λ): below 0.5 % of ⟨P̂⟩ at every mode shown.
// Toy field: Gaussian, stationary, δ(Λ) = [g(Λ) + β g(Λ − r₀)]/√(1 + β²) with g lya.js's Gaussian random field
// (ξ_g(Δ) = s² e^{−Δ²/(2ℓ²)}, prefix-consistent, not periodic), so that
//   ξ(Δ) = s² [e^{−Δ²/(2ℓ²)} + A (e^{−(Δ−r₀)²/(2ℓ²)} + e^{−(Δ+r₀)²/(2ℓ²)})],  A = β/(1 + β²),
//   P(k) = ∫ dΔ ξ(Δ) e^{+ikΔ} = s² √(2π) ℓ e^{−k²ℓ²/2} [1 + 2A cos(k r₀)]   (Eq. (Pk3D_ensemble_P1D)),
// a correlation peak at Δ = r₀ (like the cross-term peak of § 4.8) and oscillations of P with period 2π/r₀ in k.
// ℓ = 1 (Λ in units of ℓ), s = 1, r₀ = 6ℓ, A = 0.45 (β = 0.627; P ≥ 0 needs A ≤ 1/2): the period 2π/r₀ ≈ 1.05/ℓ is
// resolved by the Fejér width 2π/L_Λ at the largest L_Λ (0.03/ℓ at 200ℓ) and smeared out at the smallest (0.63/ℓ at 10ℓ).
// Realization s is drawn from the seed seed0 + s, once at the largest L_Λ (a shorter interval is a prefix: the same
// sightline cut shorter). The reader sees the window bias shrink as L_Λ grows while the scatter of one periodogram
// about ⟨P̂^(s)⟩ stays of order one (Var ≃ P², "Variance and averaging over modes"); averaging N realizations reduces
// it as N^−1/2.
import { el, controls, slider, toggle, note, legend, fmt, Plot2D } from './dg.js';
import { typeset } from '../course.js';
import { gaussField } from './lya.js';

export const FIELD = { dx: 1 / 8, ell: 1, sig: 1, r0: 6, A: 0.45, seed0: 2000 };
export const BETA = (1 - Math.sqrt(1 - 4 * FIELD.A ** 2)) / (2 * FIELD.A);
export const NS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200];
export const LS = [10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200];
export const START = { N: 1, L: 20, log: true };
export const KMAX = 3.2, QMAX = 8, PER = 24;
const C = { mean: '#0a6a7b', sample: '#d68b02', ens: '#222222', delta: '#0a6a7b' };
const YLOG = [-3.2, 1.2], YLIN = [0, 10], DLIM = [-3.6, 3.6];
const SQ2PI = Math.sqrt(2 * Math.PI);

/** The toy's ensemble P(k) and ξ(Δ). */
export const Pens = k => FIELD.sig ** 2 * SQ2PI * FIELD.ell * Math.exp(-k * k * FIELD.ell ** 2 / 2) * (1 + 2 * FIELD.A * Math.cos(k * FIELD.r0));
export const xiEns = D => { const g = x => Math.exp(-x * x / (2 * FIELD.ell ** 2)); return FIELD.sig ** 2 * (g(D) + FIELD.A * (g(D - FIELD.r0) + g(D + FIELD.r0))); };
/** Number of cells of an interval of length L; the shift r₀ in cells. */
export const cells = L => Math.round(L / FIELD.dx);
const N0 = Math.round(FIELD.r0 / FIELD.dx);
/** δ^(s) on the first n cells: [g(Λ_i) + β g(Λ_i − r₀)]/√(1 + β²), g drawn on n + r₀/dx cells from seed0 + s. */
export function field(s, n) {
  const g = gaussField(n + N0, FIELD.dx, FIELD.ell, FIELD.sig, FIELD.seed0 + s), out = new Float64Array(n), nrm = Math.sqrt(1 + BETA * BETA);
  for (let i = 0; i < n; i++) out[i] = (g[i + N0] + BETA * g[i]) / nrm;
  return out;
}
/** The modes k_q = 2πq/L, q = 1 … Q, with k_q ≤ KMAX. */
export const nModes = L => Math.floor(KMAX * L / (2 * Math.PI) + 1e-9);
/** P̂^(s)(k_q), q = 1 … Q, from the first n cells of d: (dx²/L) |Σ_i e^{−2πi q i/n} d_i|² (Goertzel, four modes per pass). */
export function periodogram(d, n, Q) {
  const out = new Float64Array(Q + 3), w = q => 2 * Math.cos(2 * Math.PI * q / n);
  for (let q = 1; q <= Q; q += 4) {
    const a = w(q), b = w(q + 1), c = w(q + 2), e = w(q + 3);
    let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, e1 = 0, e2 = 0;
    for (let i = 0; i < n; i++) {
      const v = d[i];
      const A = v + a * a1 - a2; a2 = a1; a1 = A;
      const B = v + b * b1 - b2; b2 = b1; b1 = B;
      const Cc = v + c * c1 - c2; c2 = c1; c1 = Cc;
      const E = v + e * e1 - e2; e2 = e1; e1 = E;
    }
    out[q - 1] = a1 * a1 + a2 * a2 - a * a1 * a2; out[q] = b1 * b1 + b2 * b2 - b * b1 * b2;
    out[q + 1] = c1 * c1 + c2 * c2 - c * c1 * c2; out[q + 2] = e1 * e1 + e2 * e2 - e * e1 * e2;
  }
  const f = FIELD.dx / n;                                  // dx²/L_Λ with L_Λ = n dx
  return Float64Array.from(out.subarray(0, Q), v => v * f);
}
/** Eq. (Pk3D_window_convolution) in 1D: ⟨P̂^(s)⟩ at k = j h (the given grid indices j), h = 2π/(PER L), by Simpson's
 *  rule over q = i h, |q| ≤ QMAX. Returns { h, at: Map j -> value }. */
export function fejer(L, js) {
  const h = 2 * Math.PI / (PER * L), I = 2 * Math.ceil(QMAX / h / 2);
  const P = new Float64Array(2 * I + 1);
  for (let i = -I; i <= I; i++) P[i + I] = Pens(i * h) * (i === -I || i === I ? 1 : (i + I) % 2 ? 4 : 2) * h / 3;
  const jmax = Math.max(...js), W = new Float64Array(I + jmax + 1);
  for (let m = 0; m < W.length; m++) { const x = m * Math.PI / PER; W[m] = m === 0 ? L : L * (Math.sin(x) / x) ** 2; }   // 𝒲(m h)
  const at = new Map();
  for (const j of js) {
    let a = 0;
    for (let i = -I; i <= I; i++) a += W[Math.abs(j - i)] * P[i + I];
    at.set(j, a / (2 * Math.PI));
  }
  return { h, at };
}
/** r.m.s. over the modes of x_q/E_q − 1. */
export function relRms(x, E) {
  let a = 0;
  for (let q = 0; q < x.length; q++) a += (x[q] / E[q] - 1) ** 2;
  return Math.sqrt(a / x.length);
}
/** Everything the panel shows at (N, L), computed from scratch. */
export function estimates(N, L) {
  const n = cells(L), Q = nModes(L), ps = Array.from({ length: N }, (_, s) => periodogram(field(s + 1, n), n, Q));
  const mean = new Float64Array(Q);
  for (const p of ps) for (let q = 0; q < Q; q++) mean[q] += p[q] / N;
  const F = fejer(L, Array.from({ length: Q }, (_, q) => PER * (q + 1)));
  const E = Float64Array.from({ length: Q }, (_, q) => F.at.get(PER * (q + 1)));
  return { n, Q, ps, mean, E, rms1: relRms(ps[0], E), rms: relRms(mean, E) };
}

export default async function mount(body) {
  const st = { ...START };
  body.append(note('Change the length \\(L_\\Lambda\\) of the interval and the number of realizations \\(N\\).'));
  const bar = controls(body);
  bar.append(slider({ label: '\\(N\\)', aria: 'N', min: 0, max: NS.length - 1, step: 1, value: NS.indexOf(st.N), format: i => String(NS[i]),
    onInput: i => { st.N = NS[i]; update(); } }).el);
  bar.append(slider({ label: '\\(L_\\Lambda\\)', aria: 'L Λ', min: 0, max: LS.length - 1, step: 1, value: LS.indexOf(st.L), format: i => String(LS[i]),
    onInput: i => { st.L = LS[i]; update(); } }).el);
  bar.append(toggle({ label: 'log scale', value: st.log, onChange: v => { st.log = v; plot.o.ylim = v ? YLOG : YLIN; plot.o.yticks = v ? [-3, -2, -1, 0, 1] : null; plot.update(); report(); } }).el);

  // the sightlines at the largest L_Λ (drawn when first needed); per L_Λ: the periodograms of the first realizations and
  // the Fejér-convolved P (curve and modes), kept for every L_Λ visited
  const NC = cells(LS[LS.length - 1]), fields = [], cache = new Map();
  const at = L => {
    if (!cache.has(L)) {
      const Q = nModes(L), h = 2 * Math.PI / (PER * L), J = Math.floor(KMAX / h + 1e-9), stride = Math.max(1, Math.round(J / 300));
      const js = new Set(Array.from({ length: Q }, (_, q) => PER * (q + 1)));
      for (let j = 0; j <= J; j += stride) js.add(j);
      js.add(J);
      const F = fejer(L, [...js]), curve = [...js].sort((a, b) => a - b).map(j => [j * h, F.at.get(j)]);
      cache.set(L, { n: cells(L), Q, ps: [], curve, E: Float64Array.from({ length: Q }, (_, q) => F.at.get(PER * (q + 1))) });
    }
    return cache.get(L);
  };
  const upTo = (N, c) => {
    while (fields.length < N) fields.push(field(fields.length + 1, NC));
    while (c.ps.length < N) c.ps.push(periodogram(fields[c.ps.length], c.n, c.Q));
  };

  const box1 = el('div'), box2 = el('div');
  let S = null;
  const margin = { l: 46, r: 12, t: 8, b: 28 };
  const y = v => (st.log ? Math.log10(v) : v);
  const top = new Plot2D(box1, { xlim: [0, st.L], ylim: DLIM, aspect: 0.2, maxWidth: 760, margin, yticks: [-2, 0, 2],
    label: 'The sightline of realization 1, δ⁽¹⁾(Λ) on [Λa, Λb]', draw(pl) {
      if (!S) return;
      pl.line(Array.from(S.d1, (v, i) => [(i + 0.5) * FIELD.dx, Math.max(DLIM[0], Math.min(DLIM[1], v))]), { color: C.delta, width: 1.2 });
      pl.label('x', [pl.o.xlim[1], DLIM[0]], '\\(\\Lambda - \\Lambda_a\\)', { anchor: 'se', dy: -3, dx: -4, class: 'dg-axis-label' });
      pl.label('y', [0, DLIM[1]], '\\(\\delta^{(1)}(\\Lambda)\\)', { anchor: 'nw', dx: 4, dy: 2, class: 'dg-axis-label' });
    } });
  const plot = new Plot2D(box2, { xlim: [0, KMAX], ylim: st.log ? YLOG : YLIN, yticks: st.log ? [-3, -2, -1, 0, 1] : null, aspect: 0.5, maxWidth: 760, margin,
    label: 'Periodograms at the modes, their average, the expected periodogram and the true power spectrum against k∥', draw(pl) {
      if (!S) return;
      const [lo, hi] = pl.o.ylim, inside = v => v >= lo && v <= hi;
      pl.fn(k => Math.max(lo, Math.min(hi, y(Pens(k)))), 0, KMAX, { color: C.ens, width: 1.4, dash: '6 4', n: 400 });
      pl.line(S.c.curve.map(([k, v]) => [k, Math.max(lo, Math.min(hi, y(v)))]), { color: C.ens, width: 1.9 });
      const dots = (arr, opt) => { for (let q = 0; q < S.c.Q; q++) { const v = y(arr[q]); if (inside(v)) pl.point([2 * Math.PI * (q + 1) / st.L, v], opt); } };
      dots(S.c.ps[0], { r: 2.6, fill: C.sample });
      if (st.N > 1) dots(S.mean, { r: 3.2, fill: C.mean, stroke: '#fff', strokeWidth: 0.8 });
      pl.label('x', [KMAX, hi], '\\(k_\\parallel\\)', { anchor: 'ne', dy: 3, dx: -6, class: 'dg-axis-label' });   // top right: the curves run along the bottom
      if (st.log) pl.label('y', [0, hi], '\\(\\log_{10}\\)', { anchor: 'nw', dx: 4, dy: 2, class: 'dg-axis-label' });
    } });
  // narrow screens (phones): taller drawings, the aspect read by Plot2D on every update (resize included)
  for (const [p, a, b] of [[top, 0.2, 0.34], [plot, 0.5, 0.75]]) Object.defineProperty(p.o, 'aspect', { get: () => (p.wrap.clientWidth < 560 ? b : a) });
  const val = () => el('span', { class: 'dg-gr-val' });
  const v = { kf: val(), rms1: val(), rms: val(), inv: val() };
  const pair = (t, x) => el('span', { class: 'dg-gr-pair' }, el('span', {}, `\\(${t}\\)`), x);
  const out = el('div', { class: 'dg-eqrow', style: 'gap: 0.4rem 1.6rem' });
  out.append(pair('2\\pi/L_\\Lambda =', v.kf),
    pair('\\mathrm{rms}_{k_\\parallel}\\big(\\widehat{P}^{(1)}/\\langle\\widehat{P}^{(s)}\\rangle_{\\rm ens} - 1\\big) =', v.rms1),
    pair('\\mathrm{rms}_{k_\\parallel}\\big(\\widehat{P}/\\langle\\widehat{P}^{(s)}\\rangle_{\\rm ens} - 1\\big) =', v.rms), pair('N^{-1/2} =', v.inv));
  body.append(box1, box2, legend([{ label: '\\(\\widehat{P}^{(1)}(k_\\parallel)\\)', color: C.sample, marker: true },
    { label: '\\(\\widehat{P}(k_\\parallel)\\), average of \\(N\\)', color: C.mean, marker: true },
    { label: '\\(\\langle\\widehat{P}^{(s)}(k_\\parallel)\\rangle_{\\rm ens}\\)', color: 'currentColor', width: 1.9 },
    { label: '\\(P(k_\\parallel)\\)', color: 'currentColor', width: 1.4, dash: '6 4' }]), out);

  function report() { body.dataset.state = JSON.stringify({ ...st, n: S.c.n, Q: S.c.Q, ...FIELD, beta: BETA, KMAX, kf: 2 * Math.PI / st.L, rms1: S.rms1, rms: S.rms }); }
  function update() {
    const c = at(st.L);
    upTo(st.N, c);
    const mean = new Float64Array(c.Q);
    for (let s = 0; s < st.N; s++) for (let q = 0; q < c.Q; q++) mean[q] += c.ps[s][q] / st.N;
    S = { c, mean, d1: fields[0].subarray(0, c.n), rms1: relRms(c.ps[0], c.E), rms: relRms(mean, c.E) };
    top.o.xlim = [0, st.L];
    top.update(); plot.update();
    v.kf.textContent = fmt(2 * Math.PI / st.L, 3); v.rms1.textContent = fmt(S.rms1, 3); v.rms.textContent = fmt(S.rms, 3); v.inv.textContent = fmt(1 / Math.sqrt(st.N), 3);
    report();
  }
  update();
  await typeset(body);
}
