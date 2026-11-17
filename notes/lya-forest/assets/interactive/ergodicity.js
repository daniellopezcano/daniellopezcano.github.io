// Hand-written (not generated): interactive after Eq. (xi3D_ensemble_estimator_from_samples), § 4.6. Notebook
// notebooks/08_toy_field_statistics.ipynb of SkewerJAX (Lyα DECISIONS L20, L33).
// Everything comes from §§ 4.4–4.6 at zero transverse separation: the per-sightline 1D estimator of
// Eq. (xi3D_1D_per_sightline), ξ̂^(s),1D(x_⊥; Δ) = (L_Λ − Δ)⁻¹ ∫_{Λa}^{Λb−Δ} dΛ δ^(s)(x_⊥, Λ) δ^(s)(x_⊥, Λ + Δ), on cells
// of size dx: Δ = k dx, L_Λ − Δ = (n − k) dx, ξ̂^(s),1D(k dx) = (n − k)⁻¹ Σ_{i=0}^{n−1−k} δ_i δ_{i+k}; the per-sample 1D
// 2PCF of Eq. (xi3D_sample_zero_lag), ξ̂^(s)(Δ) = the average of the per-sightline estimators over the sightlines of
// the transverse domain (here M sightlines: the integral over A_⊥ / |A_⊥| becomes their mean); the average over N
// realizations, Eq. (xi3D_ensemble_estimator_from_samples) at r_⊥ = 0, ξ̂(Δ) = N⁻¹ Σ_s ξ̂^(s)(Δ); and the ensemble
// 2PCF of Eq. (xi3D_ensemble_translation_invariant), here known: the toy field δ^(s)(x_⊥, Λ) is lya.js's 1D Gaussian
// random field with ξ(Δ) = s² exp(−Δ²/(2ℓ²)) (ℓ = 1, s = 1: Λ in units of ℓ), sightline m of realization s drawn
// from the seed seed0 + s + mstride (m − 1). The sightlines are independent of each other (they stand for sightlines
// farther apart than the correlation length; the toy has no transverse correlation). The i, j of the notes are
// dropped (one field), as in Eq. (xi1D_ensemble_L2_decomposition). The reader sets N, M and L_Λ and sees the scatter
// of the per-sample estimates, its shrinking as N grows (the 1/N variance of § 4.6), the larger noise at large Δ
// where L_Λ − Δ is small, and that one realization (N = 1) also comes close to ξ when its domain is large: many
// sightlines or a long interval (the ergodicity of § 4.6). The fields are drawn once at the largest L_Λ (gaussField
// is prefix-consistent: a longer interval extends the same sightline), the estimates once per L_Λ, lazily up to
// N and M. The sums over i are computed with a zero-padded FFT (no wrap-around): the same numbers as the loop.
import { el, controls, slider, note, legend, fmt, Plot2D } from './dg.js';
import { typeset } from '../course.js';
import { gaussField } from './lya.js';

export const START = { N: 1, M: 1, L: 16 };
export const FIELD = { dx: 1 / 8, ell: 1, sig: 1, seed0: 1000, mstride: 100000 };
export const NS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300];
export const MS = [1, 2, 3, 4, 6, 8, 12];
export const LMIN = 4, LMAX = 40, NSHOW = 8;
const C = { mean: '#0a6a7b', sample: '#d68b02', ens: '#222222', delta: '#0a6a7b' };
const YLIM = [-1.2, 1.6], DLIM = [-3.2, 3.2];

/** Number of cells of the interval [Λa, Λb] of length L (in units of ℓ). */
export const cells = L => Math.round(L / FIELD.dx);
/** δ^(s) of sightline m on n cells (realization s = 1, 2, ..., sightline m = 1, 2, ...). */
export const field = (s, n, m = 1) => gaussField(n, FIELD.dx, FIELD.ell, FIELD.sig, FIELD.seed0 + s + FIELD.mstride * (m - 1));
/** The ensemble 2PCF of the toy field, ξ(Δ) = s² exp(−Δ²/(2ℓ²)). */
export const xiEns = D => FIELD.sig ** 2 * Math.exp(-D * D / (2 * FIELD.ell ** 2));
// in-place radix-2 FFT of (re, im), length a power of 2
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
/** Eq. (xi3D_1D_per_sightline) on the first n cells of d: ξ̂^(s),1D(k dx), k = 0 … n − 1, i.e.
 *  (n − k)⁻¹ Σ_{i=0}^{n−1−k} d_i d_{i+k}; the sums come from |FFT|² of d zero-padded to at least 2n (no wrap-around). */
export function xiSightline(d, n) {
  let size = 1; while (size < 2 * n) size <<= 1;
  const re = new Float64Array(size), im = new Float64Array(size);
  for (let i = 0; i < n; i++) re[i] = d[i];
  fft(re, im);
  for (let k = 0; k < size; k++) { re[k] = re[k] * re[k] + im[k] * im[k]; im[k] = 0; }
  fft(re, im);                                   // the power is real and even: a forward FFT gives size × the sums
  const out = new Float64Array(n);
  for (let k = 0; k < n; k++) out[k] = re[k] / size / (n - k);
  return out;
}
/** Eq. (xi3D_sample_zero_lag): the per-sample 1D 2PCF, the mean of the per-sightline estimators of the M sightlines. */
export function xiSample(ds, n) {
  const out = new Float64Array(n);
  for (const d of ds) { const x = xiSightline(d, n); for (let k = 0; k < n; k++) out[k] += x[k]; }
  for (let k = 0; k < n; k++) out[k] /= ds.length;
  return out;
}
/** Eq. (xi3D_ensemble_estimator_from_samples): the average of the first N per-sample estimates. */
export function xiMean(samples, N) {
  const n = samples[0].length, out = new Float64Array(n);
  for (let s = 0; s < N; s++) for (let k = 0; k < n; k++) out[k] += samples[s][k];
  for (let k = 0; k < n; k++) out[k] /= N;
  return out;
}
/** r.m.s. of x(k dx) − ξ(k dx) over the lags 0 ≤ Δ < L_Λ. */
export function rmsDev(x) {
  let a = 0;
  for (let k = 0; k < x.length; k++) a += (x[k] - xiEns(k * FIELD.dx)) ** 2;
  return Math.sqrt(a / x.length);
}
/** Everything the panel shows at (N, M, L), computed from scratch. */
export function estimates(N, M, L) {
  const n = cells(L), samples = Array.from({ length: N }, (_, s) =>
    xiSample(Array.from({ length: M }, (_, m) => field(s + 1, n, m + 1)), n));
  const mean = xiMean(samples, N);
  return { n, samples, mean, rms1: rmsDev(samples[0]), rms: rmsDev(mean) };
}

// a polyline cut to y in [lo, hi]: the runs inside, with the crossing points interpolated
function clipRuns(pts, lo, hi) {
  const runs = []; let cur = [];
  const inside = y => y >= lo && y <= hi;
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i > 0) {
      const [x0, y0] = pts[i - 1];
      for (const b of [lo, hi]) if ((y0 - b) * (y - b) < 0) {
        const p = [x0 + (x - x0) * (b - y0) / (y - y0), b];
        if (inside(y0)) { cur.push(p); runs.push(cur); cur = []; } else cur.push(p);
      }
    }
    if (inside(y)) cur.push([x, y]);
  }
  if (cur.length) runs.push(cur);
  return runs.filter(r => r.length > 1);
}

export default async function mount(body) {
  const st = { ...START };
  body.append(note('Change the number of realizations \\(N\\), the number of sightlines \\(M\\) of each realization and the length \\(L_\\Lambda\\) of the interval.'));
  const bar = controls(body);
  bar.append(slider({ label: '\\(N\\)', aria: 'N', min: 0, max: NS.length - 1, step: 1, value: NS.indexOf(st.N), format: i => String(NS[i]),
    onInput: i => { st.N = NS[i]; update(); } }).el);
  bar.append(slider({ label: '\\(M\\)', aria: 'M', min: 0, max: MS.length - 1, step: 1, value: MS.indexOf(st.M), format: i => String(MS[i]),
    onInput: i => { st.M = MS[i]; update(); } }).el);
  bar.append(slider({ label: '\\(L_\\Lambda\\)', aria: 'L Λ', min: LMIN, max: LMAX, step: 1, value: st.L, format: v => String(v),
    onInput: v => { st.L = v; update(); } }).el);

  // the sightlines at the largest L_Λ (drawn when first needed): fields[s][m]; the per-sightline estimates of the
  // current L_Λ: est[s][m]; the per-sample estimates (means over the first M sightlines) are recomputed from them
  const NC = cells(LMAX), fields = [];
  let cacheL = null, est = [], samples = [];
  const sampleUpTo = (N, M, n) => {
    if (cacheL !== st.L) { cacheL = st.L; est = []; }
    for (let s = 0; s < N; s++) {
      fields[s] ??= []; est[s] ??= [];
      while (fields[s].length < M) fields[s].push(field(s + 1, NC, fields[s].length + 1));
      while (est[s].length < M) est[s].push(xiSightline(fields[s][est[s].length], n));
    }
    samples = est.slice(0, N).map(e => {
      const out = new Float64Array(n);
      for (let m = 0; m < M; m++) for (let k = 0; k < n; k++) out[k] += e[m][k];
      for (let k = 0; k < n; k++) out[k] /= M;
      return out;
    });
  };

  const box1 = el('div'), box2 = el('div');
  let S = null;
  const margin = { l: 46, r: 12, t: 8, b: 28 };
  const lines = (pl, pts, lim, opt) => { for (const r of clipRuns(pts, lim[0], lim[1])) pl.line(r, opt); };
  const top = new Plot2D(box1, { xlim: [0, st.L], ylim: DLIM, aspect: 0.22, maxWidth: 760, margin, yticks: [-2, 0, 2],
    label: 'One sightline of realization 1, δ⁽¹⁾(Λ) on [Λa, Λb]', draw(pl) {
      if (!S) return;
      lines(pl, Array.from(S.d1, (y, i) => [(i + 0.5) * FIELD.dx, y]), DLIM, { color: C.delta, width: 1.4 });
      pl.label('x', [pl.o.xlim[1], DLIM[0]], '\\(\\Lambda - \\Lambda_a\\)', { anchor: 'se', dy: -3, dx: -4, class: 'dg-axis-label' });
      pl.label('y', [0, DLIM[1]], '\\(\\delta^{(1)}(\\Lambda)\\)', { anchor: 'nw', dx: 4, dy: 2, class: 'dg-axis-label' });
    } });
  const plot = new Plot2D(box2, { xlim: [0, st.L], ylim: YLIM, aspect: 0.5, maxWidth: 760, margin,
    label: 'Estimates ξ̂⁽ˢ⁾(Δ), their average ξ̂(Δ) and the ensemble ξ(Δ)', draw(pl) {
      if (!S) return;
      const at = a => Array.from(a, (y, k) => [k * FIELD.dx, y]);
      for (let s = 0; s < S.shown; s++) lines(pl, at(samples[s]), YLIM, { color: C.sample, width: 1, opacity: 0.55 });
      pl.fn(xiEns, 0, pl.o.xlim[1], { color: C.ens, width: 1.6, dash: '6 4', n: 300 });
      lines(pl, at(S.mean), YLIM, { color: C.mean, width: 2.4 });
      pl.label('x', [pl.o.xlim[1], YLIM[0]], '\\(\\Delta\\)', { anchor: 'se', dy: -3, dx: -6, class: 'dg-axis-label' });
    } });
  // narrow screens (phones): taller drawings, the aspect read by Plot2D on every update (resize included)
  for (const [p, a, b] of [[top, 0.22, 0.36], [plot, 0.5, 0.7]]) Object.defineProperty(p.o, 'aspect', { get: () => (p.wrap.clientWidth < 560 ? b : a) });
  const val = () => el('span', { class: 'dg-gr-val' });
  const v = { rms1: val(), rms: val() };
  const pair = (t, x) => el('span', { class: 'dg-gr-pair' }, el('span', {}, `\\(${t}\\)`), x);
  const out = el('div', { class: 'dg-eqrow', style: 'gap: 0.4rem 1.6rem' });
  out.append(pair('\\mathrm{rms}_{\\Delta}\\big(\\widehat{\\xi}^{(1)} - \\xi\\big) =', v.rms1), pair('\\mathrm{rms}_{\\Delta}\\big(\\widehat{\\xi} - \\xi\\big) =', v.rms));
  body.append(box1, box2, legend([{ label: '\\(\\widehat{\\xi}^{(s)}(\\Delta),\\ s \\le 8\\)', color: C.sample, width: 1 },
    { label: '\\(\\widehat{\\xi}(\\Delta)\\)', color: C.mean, width: 2.4 }, { label: '\\(\\xi(\\Delta)\\)', color: 'currentColor', width: 1.6, dash: '6 4' }]), out);

  function update() {
    const n = cells(st.L);
    sampleUpTo(st.N, st.M, n);
    const mean = xiMean(samples, st.N);
    S = { n, mean, d1: fields[0][0].slice(0, n), shown: Math.min(st.N, NSHOW), rms1: rmsDev(samples[0]), rms: rmsDev(mean) };
    top.o.xlim = [0, st.L]; plot.o.xlim = [0, st.L];
    top.update(); plot.update();
    v.rms1.textContent = fmt(S.rms1, 3); v.rms.textContent = fmt(S.rms, 3);
    body.dataset.state = JSON.stringify({ ...st, n, ...FIELD, shown: S.shown, rms1: S.rms1, rms: S.rms });
  }
  update();
  await typeset(body);
}
