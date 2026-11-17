// Test of the panel periodogram (§ 5.6, after Eq. (Pk3D_window_convolution)): every number it shows against the notes'
// definitions, computed here independently at the panel's state. The field values are the same (lya.js gaussField with
// the seeds and parameters the panel states, combined here as δ = [g(Λ) + β g(Λ − r₀)]/√(1 + β²), β from A, drawn
// directly on the n cells of the interval, which also checks that the panel's longer draws are prefix-consistent); the
// periodogram is this file's own direct sum, Eq. (Pk3D_1D_per_sightline) with the integral over the cells,
// P̂^(s)(k_q) = (1/L_Λ) |Σ_i dx e^{−i k_q Λ_i} δ_i|², Λ_i = (i + ½) dx (the panel uses the Goertzel recurrence); the
// average is Eq. (Pk3D_ensemble_estimator_from_samples); the expectation ⟨P̂^(s)⟩ is computed here in configuration space,
// Eq. (Pk3D_P1D_from_xi1D) with the ensemble ξ: 2 ∫_0^{L_Λ} dΔ (1 − Δ/L_Λ) ξ(Δ) cos(kΔ) (Simpson), the same function
// as the Fejér convolution of Eq. (Pk3D_window_convolution) that the panel computes in Fourier space (the two
// quadratures agree to 10⁻¹⁰; required: 10⁻⁸). The normalisation ∫ dk/(2π) 𝒲 = 1 of the Fejér kernel is checked
// numerically. Then the claims the panel makes visible: (a) the window bias max_k |⟨P̂⟩ − P|/P decreases as L_Λ grows;
// (b) the relative scatter of one periodogram about ⟨P̂⟩ is ≈ 1 whatever L_Λ (Var ≃ P², on average over realizations);
// (c) the average of N realizations reduces it about as N^−1/2.
import { gaussField } from '../../../notes/lya-forest/assets/interactive/lya.js';

const NS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200];
const LS = [10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200];
const KMAX = 3.2;
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const fx = x => x.toFixed(3);

const Ptrue = (st, k) => st.sig ** 2 * Math.sqrt(2 * Math.PI) * st.ell * Math.exp(-k * k * st.ell ** 2 / 2) * (1 + 2 * st.A * Math.cos(k * st.r0));
const xi = (st, D) => { const g = x => Math.exp(-x * x / (2 * st.ell ** 2)); return st.sig ** 2 * (g(D) + st.A * (g(D - st.r0) + g(D + st.r0))); };
const beta = A => (1 - Math.sqrt(1 - 4 * A * A)) / (2 * A);
function field(st, s, n) {
  const b = beta(st.A), n0 = Math.round(st.r0 / st.dx), g = gaussField(n + n0, st.dx, st.ell, st.sig, st.seed0 + s);
  return Array.from({ length: n }, (_, i) => (g[i + n0] + b * g[i]) / Math.sqrt(1 + b * b));
}
const modes = L => Math.floor(KMAX * L / (2 * Math.PI) + 1e-9);
// cos and sin of k_q Λ_i for the modes of L (one table per L)
const tables = new Map();
function table(st, L) {
  if (!tables.has(L)) {
    const n = Math.round(L / st.dx), Q = modes(L), t = [];
    for (let q = 1; q <= Q; q++) { const k = 2 * Math.PI * q / L; t.push([Float64Array.from({ length: n }, (_, i) => Math.cos(k * (i + 0.5) * st.dx)), Float64Array.from({ length: n }, (_, i) => Math.sin(k * (i + 0.5) * st.dx))]); }
    tables.set(L, t);
  }
  return tables.get(L);
}
function periodogram(st, d, L) {                          // Eq. (Pk3D_1D_per_sightline) on the cells, direct sum
  return table(st, L).map(([c, s]) => { let re = 0, im = 0; for (let i = 0; i < d.length; i++) { re += st.dx * c[i] * d[i]; im -= st.dx * s[i] * d[i]; } return (re * re + im * im) / L; });
}
function expected(st, k, L, m = 40000) {                  // Eq. (Pk3D_P1D_from_xi1D) with ξ: the expectation of P̂^(s)(k)
  const h = L / m; let a = 0;
  for (let i = 0; i <= m; i++) { const D = i * h; a += (i === 0 || i === m ? 1 : i % 2 ? 4 : 2) * (1 - D / L) * xi(st, D) * Math.cos(k * D); }
  return 2 * a * h / 3;
}
const relRms = (x, E) => Math.sqrt(x.reduce((a, v, q) => a + (v / E[q] - 1) ** 2, 0) / x.length);
const average = xs => xs[0].map((_, q) => xs.reduce((a, x) => a + x[q], 0) / xs.length);

function expect(st) {
  const n = Math.round(st.L / st.dx), Q = modes(st.L);
  const ps = Array.from({ length: st.N }, (_, s) => periodogram(st, field(st, s + 1, n), st.L));
  const mean = average(ps), E = Array.from({ length: Q }, (_, q) => expected(st, 2 * Math.PI * (q + 1) / st.L, st.L));
  return { n, Q, ps, mean, E, rms1: relRms(ps[0], E), rms: relRms(mean, E) };
}

export async function change(page, frame) {
  await frame.locator('input[type=range]').nth(1).evaluate(n => { n.value = 0; n.dispatchEvent(new Event('input', { bubbles: true })); });
}

export async function run({ page, frame, state, assert, log }) {
  const set = async (i, v) => { await frame.locator('input[type=range]').nth(i).evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, v); await page.waitForTimeout(250); };
  const check = async tag => {
    const st = await state(), e = expect(st);
    assert(rel(st.beta, beta(st.A)) < 1e-14 && st.A <= 0.5, `${tag}: β = ${st.beta} for A = ${st.A} (P ≥ 0)`);
    assert(st.n === e.n && st.Q === e.Q, `${tag}: n = ${st.n} cells, Q = ${st.Q} modes (expected ${e.n}, ${e.Q})`);
    assert(rel(st.kf, 2 * Math.PI / st.L) < 1e-14, `${tag}: 2π/L_Λ = ${st.kf}`);
    assert(rel(st.rms1, e.rms1) < 1e-6 && rel(st.rms, e.rms) < 1e-6, `${tag}: rms = ${st.rms1}, ${st.rms} (expected ${e.rms1}, ${e.rms})`);
    const shown = await frame.locator('.dg-gr-val').allTextContents();
    const want = [fx(2 * Math.PI / st.L), fx(e.rms1), fx(e.rms), fx(1 / Math.sqrt(st.N))];
    assert(shown.join(' ') === want.join(' '), `${tag}: readouts ${shown.join(', ')} (expected ${want.join(', ')})`);
    // the module's own numbers (what it draws) against this file's, mode by mode
    const m = await page.evaluate(async ([N, L]) => {
      const mod = await import(new URL('../assets/interactive/periodogram.js', location.href).href);
      const r = mod.estimates(N, L);
      return { p1: Array.from(r.ps[0]), pl: Array.from(r.ps[N - 1]), mean: Array.from(r.mean), E: Array.from(r.E) };
    }, [st.N, st.L]);
    const dev = (a, b) => Math.max(...a.map((v, q) => rel(v, b[q])));
    assert(m.p1.length === e.Q && dev(m.p1, e.ps[0]) < 1e-8 && dev(m.pl, e.ps[st.N - 1]) < 1e-8, `${tag}: P̂^(1), P̂^(N) of the module = the direct sum here (max rel diff ${Math.max(dev(m.p1, e.ps[0]), dev(m.pl, e.ps[st.N - 1]))})`);
    assert(dev(m.mean, e.mean) < 1e-8, `${tag}: P̂ of the module = Eq. (Pk3D_ensemble_estimator_from_samples) here`);
    assert(dev(m.E, e.E) < 1e-8, `${tag}: ⟨P̂^(s)⟩ at the modes: Fejér convolution of the module = Eq. (Pk3D_P1D_from_xi1D) here (max rel diff ${dev(m.E, e.E)})`);
    return st;
  };
  const s0 = await check('start');
  assert(s0.log === true, 'start: log scale');
  await set(0, 5); await check('N = 6');
  await set(1, 0); await check('N = 6, L = 10');
  await set(1, LS.length - 1); await check('N = 6, L = 200');
  // a slider move with N = 200 at a new L_Λ (realizations drawn, periodograms and the Fejér convolution computed) and at a
  // visited one (cached), timed in the page
  const time = (i, v) => frame.locator('input[type=range]').nth(i).evaluate((n, v) => { const t = performance.now(); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); return performance.now() - t; }, v);
  const tN = await time(0, NS.length - 1), tL = await time(1, LS.length - 2), tB = await time(1, LS.length - 1);
  log(`slider moves: N 6 → 200 at L = 200: ${tN.toFixed(0)} ms; L → 150 (new): ${tL.toFixed(0)} ms; L → 200 (cached): ${tB.toFixed(0)} ms`);
  assert(tB < 60 && tL < 250, `slider moves stay interactive (cached ${tB.toFixed(0)} ms, new L_Λ ${tL.toFixed(0)} ms)`);
  await page.waitForTimeout(200);
  const s200 = await check('N = 200, L = 200');
  assert(s200.rms < 1.5 / Math.sqrt(200) && s200.rms > 0.5 / Math.sqrt(200), `the panel: rms of the average of 200 ≈ 200^−1/2 (${s200.rms})`);
  await frame.locator('input[type=checkbox]').click(); await page.waitForTimeout(200);
  assert((await state()).log === false, 'the toggle switches to a linear scale');
  await frame.locator('input[type=checkbox]').click(); await page.waitForTimeout(200);
  await set(0, 0); await set(1, LS.indexOf(s0.L));

  // the normalisation of the Fejér kernel: ∫_{−K}^{K} dk/(2π) L sinc²(kL/2) + the tail beyond ±K (2/(π L K)) = 1
  for (const L of [10, 200]) {
    const h = 2 * Math.PI / (64 * L), m = 64 * 1000, K = m * h; let a = 0;
    for (let i = 0; i <= m; i++) { const x = i * h * L / 2, w = i === 0 ? L : L * (Math.sin(x) / x) ** 2; a += (i === 0 || i === m ? 1 : i % 2 ? 4 : 2) * w; }
    const norm = 2 * a * h / 3 / (2 * Math.PI) + 2 / (Math.PI * L * K);
    assert(Math.abs(norm - 1) < 1e-6, `∫ dk/(2π) 𝒲(k) = 1 for L_Λ = ${L} (${norm})`);
  }
  // (a) the window bias shrinks as L_Λ grows: max over k ∈ [0.05, 3.2] of |⟨P̂^(s)⟩ − P|/P, for every L_Λ of the slider
  const bias = LS.map(L => { let b = 0; for (let k = 0.05; k <= KMAX + 1e-9; k += 0.05) b = Math.max(b, rel(expected(s0, k, L, 4000), Ptrue(s0, k))); return b; });
  assert(bias.every((b, i) => i === 0 || b < bias[i - 1]), `max_k |⟨P̂⟩ − P|/P decreases with L_Λ: ${bias.map(b => b.toFixed(3)).join(', ')}`);
  // (b) one periodogram: relative scatter about ⟨P̂⟩ ≈ 1 whatever L_Λ (r.m.s. over the modes and 100 realizations)
  const R = 100, single = {};
  for (const L of [10, 40, 200]) {
    const n = Math.round(L / s0.dx), E = Array.from({ length: modes(L) }, (_, q) => expected(s0, 2 * Math.PI * (q + 1) / L, L));
    let a = 0; for (let s = 1; s <= R; s++) a += relRms(periodogram(s0, field(s0, s, n), L), E) ** 2;
    single[L] = Math.sqrt(a / R);
    assert(single[L] > 0.85 && single[L] < 1.15, `one periodogram scatters about ⟨P̂⟩ by ≈ 1 at L_Λ = ${L}: ${single[L].toFixed(3)}`);
  }
  assert(single[200] > 0.85 * single[10], `the scatter of one periodogram does not shrink with L_Λ: ${single[10].toFixed(3)} (L = 10) -> ${single[200].toFixed(3)} (L = 200)`);
  // (c) averaging N realizations: about N^−1/2 (disjoint groups of the 200 realizations at L_Λ = 100)
  const L = 100, n = Math.round(L / s0.dx), E = Array.from({ length: modes(L) }, (_, q) => expected(s0, 2 * Math.PI * (q + 1) / L, L));
  const all = Array.from({ length: 200 }, (_, s) => periodogram(s0, field(s0, s + 1, n), L)), ms = [];
  for (const N of [1, 2, 5, 10, 20, 50, 100, 200]) {
    let a = 0, g = 0;
    for (let i = 0; i + N <= 200; i += N, g++) a += relRms(average(all.slice(i, i + N)), E) ** 2;
    ms.push([N, Math.sqrt(a / g)]);
  }
  for (let i = 1; i < ms.length; i++) assert(ms[i][1] < ms[i - 1][1], `the scatter of the average decreases with N: N = ${ms[i - 1][0]}: ${ms[i - 1][1].toFixed(4)}, N = ${ms[i][0]}: ${ms[i][1].toFixed(4)}`);
  const slope = Math.log(ms[ms.length - 1][1] / ms[0][1]) / Math.log(200);
  assert(slope > -0.6 && slope < -0.4, `the scatter of the average ∝ N^${slope.toFixed(3)} (about N^−1/2)`);
}
