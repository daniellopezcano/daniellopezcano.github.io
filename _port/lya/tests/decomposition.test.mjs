// Test of the panel decomposition (§ 5.3, after Eq. (xi1D_ensemble_L2_decomposition)): from the module's τ per unit n̄
// of the two lines (checked against Eq. (tau_straight_los), skewer_ref.mjs, at a few pixels; the Si III line shifted by
// −c ln(λ_1/λ_2) on the axis of Lyα, Appendix B.2), this file recomputes T_j, T̄_j, δ_j (Eq. (delta_j)), C_12, the
// per-lag averages and the terms of Eq. (xi1D_ensemble_L2_decomposition); checks the state; checks that the sum of the
// terms is the correlation of the total overflux of T = T_1 T_2 (Eq. (total_overflux_compact)) up to the window edges;
// and what the panel shows: the cross term peaks at Δ = c ln(λ_1/λ_2) and grows with the density of the second line.
import { gasRef, tauRef, rel } from './skewer_ref.mjs';

const C_KMS = 299792.458, SHIFT = -C_KMS * Math.log(1215.6701 / 1206.5);
export async function change(page, frame) {
  await frame.locator('input[type=range]').first().evaluate(n => { n.value = -0.5; n.dispatchEvent(new Event('input', { bubbles: true })); });
}
export async function run({ page, frame, state, assert }) {
  const set = async v => { await frame.locator('input[type=range]').first().evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, v); await page.waitForTimeout(300); };
  const M = await page.evaluate(async () => {
    const m = await import(new URL('../assets/interactive/decompstats.js', location.href).href);
    const r = m.unitTaus(); return { u: r.u, taus: r.taus.map(([a, b]) => [Array.from(a), Array.from(b)]), TOY: m.TOY, SHIFT: m.SHIFT };
  });
  assert(rel(M.SHIFT, SHIFT) < 1e-12, `Si III sits at −c ln(λ_1/λ_2) = ${M.SHIFT} km/s on the Lyα axis`);
  const T = M.TOY;
  for (const s of [1, T.ens]) {
    const G = gasRef(s, { L: T.L, n: T.n });
    for (const i of [100, 500, 900]) {
      const t1 = tauRef('lya', G, M.u[i], { bturb: T.bturb }), t2 = tauRef('si3', G, M.u[i], { bturb: T.bturb, shift: SHIFT });
      // the module sums each profile within 15 Doppler widths (L25): 10⁻³ relative, or 10⁻³ absolute in τ at the largest n̄
      const tol = t => Math.max(1e-3 * t, 1e-3 / T.nbar1);
      assert(Math.abs(M.taus[s - 1][0][i] - t1) < tol(t1) && Math.abs(M.taus[s - 1][1][i] - t2) < tol(t2),
        `sightline ${s}, Λ = ${M.u[i].toFixed(0)} km/s: τ_1/n̄, τ_2/n̄ = ${M.taus[s - 1][0][i]}, ${M.taus[s - 1][1][i]} (expected ${t1}, ${t2})`);
    }
  }
  const expect = logr => {
    const n1 = T.nbar1, n2 = n1 * 10 ** logr, N = M.taus.length, n = M.u.length;
    const T1 = M.taus.map(([a]) => a.map(x => Math.exp(-n1 * x))), T2 = M.taus.map(([, b]) => b.map(x => Math.exp(-n2 * x)));
    const avg = X => X.flat().reduce((p, q) => p + q, 0) / (N * n);
    const Tb1 = avg(T1), Tb2 = avg(T2), d1 = T1.map(x => x.map(t => t / Tb1 - 1)), d2 = T2.map(x => x.map(t => t / Tb2 - 1));
    const P = d1.map((x, s) => x.map((v, i) => v * d2[s][i])), C = avg(P);
    const lagAvg = (A, B, k) => { let a = 0; for (let s = 0; s < N; s++) for (let i = 0; i + k < n; i++) a += A[s][i] * B[s][i + k]; return a / (N * (n - k)); };
    const at = k => { const f = 1 / (1 + C) ** 2;
      const terms = [-C * C, lagAvg(d1, d1, k), lagAvg(d2, d2, k), lagAvg(d1, d2, k) + lagAvg(d2, d1, k), lagAvg(d1, P, k) + lagAvg(P, d1, k),
        lagAvg(d2, P, k) + lagAvg(P, d2, k), lagAvg(P, P, k)].map(t => t * f);
      const TT = T1.map((x, s) => x.map((t, i) => t * T2[s][i])), Tb = avg(TT), d = TT.map(x => x.map(t => t / Tb - 1));
      return { sum: terms.reduce((p, q) => p + q, 0), cross: terms[3], direct: lagAvg(d, d, k) }; };
    const kSep = Math.round(-SHIFT / (T.du * T.stride)) * T.stride;
    return { C, Tb1, Tb2, sep: at(kSep), zero: at(0), far: at(Math.round(1000 / T.du)) };
  };
  const check = async tag => {
    const st = await state(), e = expect(st.logr);
    assert(rel(st.C, e.C) < 1e-9 && rel(st.Tb1, e.Tb1) < 1e-12 && rel(st.Tb2, e.Tb2) < 1e-12, `${tag}: C_12 = ${st.C}, T̄ = ${st.Tb1}, ${st.Tb2} (expected ${e.C}, ${e.Tb1}, ${e.Tb2})`);
    assert(rel(st.at, e.sep.sum) < 1e-9 && rel(st.cross, e.sep.cross) < 1e-9 && rel(st.xi0, e.zero.sum) < 1e-9, `${tag}: ξ and ξ_12,sym at the line separation, ξ(0)`);
    for (const [k, r] of [['0', e.zero], ['sep', e.sep], ['1000 km/s', e.far]])
      assert(Math.abs(r.sum - r.direct) < 1e-3 * Math.abs(e.zero.direct), `${tag}: Δ = ${k}: sum of the terms ${r.sum} = ξ of the total overflux ${r.direct}`);
    return st;
  };
  const s0 = await check('start');
  await set(-3); const lo = await check('n̄_2/n̄_1 = 1e-3');
  await set(-1); const hi = await check('n̄_2/n̄_1 = 1e-1');
  assert(hi.cross > 5 * lo.cross && hi.cross > 0, `ξ_12,sym at the separation grows with n̄_2 (${lo.cross} -> ${hi.cross})`);
  // the cross term peaks at the separation: larger there than 300 km/s away on either side
  const sideways = await page.evaluate(async logr => {
    const m = await import(new URL('../assets/interactive/decompstats.js', location.href).href);
    const r = m.decompose(logr), q = Math.round(-m.SHIFT / (m.TOY.du * m.TOY.stride)), w = Math.round(300 / (m.TOY.du * m.TOY.stride));
    return [r.terms.x12[q - w], r.terms.x12[q], r.terms.x12[q + w]];
  }, hi.logr);
  assert(sideways[1] > 2 * Math.max(sideways[0], sideways[2]), `ξ_12,sym peaks at c ln(λ_1/λ_2) (${sideways.map(x => x.toExponential(2)).join(', ')})`);
  for (const k of [0, 1, 2, 3]) { await frame.locator('.dg-controls .dg-toggle label').nth(k).click(); await page.waitForTimeout(100); }
  await page.waitForTimeout(200);
  const off = await state();
  assert(!off.o0 && !off.o2 && !off.o3 && !off.o4, 'every group of terms can be hidden');
  void s0;
}
