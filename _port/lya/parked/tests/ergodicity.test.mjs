// Test of the panel ergodicity (§ 5.3, after Eq. (xi1D_ensemble_estimator_from_samples)): every number it shows
// against the notes' definitions, computed here independently at the panel's state. The field values are the same
// (lya.js gaussField with the seeds and parameters the panel states: realization s from seed0 + s, drawn here directly
// on the n cells of the interval, which also checks that the panel's longer draws are prefix-consistent); the
// estimators are this file's own loops: Eq. (xi1D_sample_nonperiodic) on cells, ξ̂^(s)(k dx) = (n − k)⁻¹
// Σ_{i=0}^{n−1−k} δ_i δ_{i+k}, Eq. (xi1D_ensemble_estimator_from_samples) ξ̂ = N⁻¹ Σ_s ξ̂^(s), and the ensemble
// ξ(Δ) = s² exp(−Δ²/(2ℓ²)) of the toy field. Then the claims the panel makes visible: the r.m.s. deviation of ξ̂ from
// ξ shrinks about as 1/√N (on average over disjoint groups of realizations), and for one realization it shrinks as
// L_Λ grows (on average over realizations: the ergodic assumption of § 5.3).
import { gaussField } from '../../../notes/lya-forest/assets/interactive/lya.js';

const NS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300];
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

function perSample(d) {                                   // Eq. (xi1D_sample_nonperiodic) on n cells
  const n = d.length, out = [];
  for (let k = 0; k < n; k++) { let a = 0; for (let i = 0; i <= n - 1 - k; i++) a += d[i] * d[i + k]; out.push(a / (n - k)); }
  return out;
}
const average = xs => xs[0].map((_, k) => xs.reduce((a, x) => a + x[k], 0) / xs.length);   // Eq. (5.9)
const rms = (x, st) => Math.sqrt(x.reduce((a, v, k) => a + (v - st.sig ** 2 * Math.exp(-((k * st.dx) ** 2) / (2 * st.ell ** 2))) ** 2, 0) / x.length);
const fields = (st, n, N, from = 1) => Array.from({ length: N }, (_, s) => gaussField(n, st.dx, st.ell, st.sig, st.seed0 + from + s));

function expect(st) {
  const n = Math.round(st.L / st.dx);
  const xs = fields(st, n, st.N).map(perSample), mean = average(xs);
  return { n, xs, mean, rms1: rms(xs[0], st), rms: rms(mean, st), shown: Math.min(st.N, 8) };
}

export async function change(page, frame) {
  await frame.locator('input[type=range]').first().evaluate(n => { n.value = 12; n.dispatchEvent(new Event('input', { bubbles: true })); });
}

export async function run({ page, frame, state, assert }) {
  const set = async (i, v) => { await frame.locator('input[type=range]').nth(i).evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, v); await page.waitForTimeout(150); };
  const check = async tag => {
    const st = await state(), e = expect(st);
    assert(st.n === e.n, `${tag}: n = ${st.n} cells (expected ${e.n})`);
    assert(st.shown === e.shown, `${tag}: ${st.shown} per-sample curves drawn (expected ${e.shown})`);
    for (const k of ['rms1', 'rms']) assert(rel(st[k], e[k]) < 1e-9, `${tag}: ${k} = ${st[k]} (expected ${e[k]})`);
    const shown = await frame.locator('.dg-gr-val').allTextContents();
    assert(shown.join(' ') === [e.rms1, e.rms].map(x => x.toFixed(3)).join(' '), `${tag}: readouts ${shown.join(', ')}`);
    // the module's own estimates (what it draws) against this file's, cell by cell
    const m = await page.evaluate(async ([N, L]) => {
      const mod = await import(new URL('../assets/interactive/ergodicity.js', location.href).href);
      const r = mod.estimates(N, L);
      return { mean: Array.from(r.mean), s1: Array.from(r.samples[0]), sl: Array.from(r.samples[N - 1]) };
    }, [st.N, st.L]);
    const dev = (a, b) => Math.max(...a.map((v, k) => Math.abs(v - b[k])));
    assert(m.mean.length === e.n && dev(m.mean, e.mean) < 1e-12, `${tag}: ξ̂(Δ) of the module = Eq. (5.9) here (max |diff| ${dev(m.mean, e.mean)})`);
    assert(dev(m.s1, e.xs[0]) < 1e-12 && dev(m.sl, e.xs[st.N - 1]) < 1e-12, `${tag}: ξ̂^(1), ξ̂^(N) of the module = Eq. (5.2) here`);
    return st;
  };
  const s0 = await check('start');
  await set(0, 3); await check('N = 4');
  await set(0, 12); await check('N = 30');
  await set(1, 40); await check('N = 30, L = 40');
  await set(1, 4); await check('N = 30, L = 4');
  await set(1, s0.L); await set(0, 22); const s300 = await check('N = 300');
  assert(s300.rms < s0.rms / 5, `rms(ξ̂ − ξ) shrinks from N = 1 to 300: ${s0.rms} -> ${s300.rms}`);

  // 1/√N on average: mean square deviation over the disjoint groups of N of the 300 realizations, at the start L
  const n = Math.round(s0.L / s0.dx), all = fields(s0, n, 300).map(perSample), ms = [];
  for (const N of [1, 3, 10, 30, 100, 300]) {
    let a = 0, g = 0;
    for (let i = 0; i + N <= 300; i += N, g++) a += rms(average(all.slice(i, i + N)), s0) ** 2;
    ms.push([N, Math.sqrt(a / g)]);
  }
  for (let i = 1; i < ms.length; i++) assert(ms[i][1] < ms[i - 1][1], `rms(ξ̂ − ξ) decreases with N on average: N = ${ms[i - 1][0]}: ${ms[i - 1][1].toFixed(4)}, N = ${ms[i][0]}: ${ms[i][1].toFixed(4)}`);
  const slope = Math.log(ms[ms.length - 1][1] / ms[0][1]) / Math.log(300);
  assert(slope > -0.65 && slope < -0.35, `rms(ξ̂ − ξ) ∝ N^${slope.toFixed(3)} (about N^−1/2)`);

  // ergodicity: one realization, longer interval -> closer to ξ (mean square over realizations 1 … 100)
  const one = L => Math.sqrt(fields(s0, Math.round(L / s0.dx), 100).reduce((a, d) => a + rms(perSample(d), s0) ** 2, 0) / 100);
  const r8 = one(8), r40 = one(40);
  assert(r40 < r8, `rms(ξ̂^(s) − ξ) of one realization shrinks with L_Λ on average: L = 8: ${r8.toFixed(4)}, L = 40: ${r40.toFixed(4)}`);
  // the panel at N = 1: the same ordering is what a reader sees on average, not for every sample; only check that L moves it
  await set(0, 0); await set(1, 8); const a = (await state()).rms1; await set(1, 40); const b = (await state()).rms1;
  assert(a !== b, `L_Λ changes rms(ξ̂^(1) − ξ): ${a} -> ${b}`);
}
