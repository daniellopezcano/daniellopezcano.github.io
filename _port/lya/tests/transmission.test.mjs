// Test of the panel transmission (§ 3.6, after Eq. (delta_j)): T = e^{−τ} (Eq. (flux)), T̄_j = ⟨T_j^(s)⟩_ens at each
// pixel and δ_j^(s) = T_j^(s)/T̄_j − 1 (Eq. (delta_j)) from the module's τ per unit n̄, recomputed here; τ itself checked
// against Eq. (tau_straight_los) (skewer_ref.mjs) for sightlines 1 and 4 at a few pixels; then what the panel shows:
// ⟨δ_j⟩_ens = 0 at every pixel, the mean of δ_j along one sightline is not 0, T̄ falls and the saturated fraction grows
// with n̄, and T̄ differs from e^{−⟨τ⟩}.
import { gasRef, tauRef, vRange, pixelsRef, rel } from './skewer_ref.mjs';

const ENS = 64, NPIX = 160;
export async function change(page, frame) {
  await frame.locator('input[type=range]').first().evaluate(n => { n.value = -4.5; n.dispatchEvent(new Event('input', { bubbles: true })); });
}
export async function run({ page, frame, state, assert }) {
  const set = async v => { await frame.locator('input[type=range]').first().evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, v); await page.waitForTimeout(250); };
  const unit = await page.evaluate(async () => {
    const m = await import(new URL('../assets/interactive/transmission.js', location.href).href);
    const r = m.unitTaus(); return { u: r.u, taus: r.taus.map(t => Array.from(t)) };
  });
  assert(unit.taus.length === ENS && unit.u.length === NPIX, `${ENS} sightlines of ${NPIX} pixels`);
  const u = pixelsRef(0, vRange(), NPIX);
  for (const s of [1, 4]) {
    const G = gasRef(s);
    for (const i of [20, 80, 140]) { const t = tauRef('lya', G, u[i]); assert(Math.abs(unit.taus[s - 1][i] - t) < 1e-3 * t + 1e-3, `sightline ${s}: τ/n̄ at pixel ${i} = ${unit.taus[s - 1][i]} (expected ${t})`); }
  }
  const expect = st => {
    const nb = 10 ** st.logn, T = unit.taus.map(t => t.map(x => Math.exp(-nb * x)));
    const Tbar = u.map((_, i) => T.reduce((a, x) => a + x[i], 0) / ENS), d = T.map(x => x.map((y, i) => y / Tbar[i] - 1));
    const mean = a => a.reduce((p, q) => p + q, 0) / a.length;
    const ens = u.map((_, i) => d.reduce((a, x) => a + x[i], 0) / ENS);
    return { TbarMean: mean(Tbar), expTau: Math.exp(-mean(unit.taus.map(t => nb * mean(t)))), dMean: mean(d[st.s - 1]),
      ensMax: Math.max(...ens.map(Math.abs)), sat: T[st.s - 1].filter(x => x < 0.05).length / NPIX };
  };
  const check = async tag => {
    const st = await state(), e = expect(st);
    for (const k of ['TbarMean', 'expTau', 'dMean', 'sat']) assert(Math.abs(st[k] - e[k]) < 1e-9 * (1 + Math.abs(e[k])), `${tag}: ${k} = ${st[k]} (expected ${e[k]})`);
    assert(st.ensMax < 1e-12 && e.ensMax < 1e-12, `${tag}: ⟨δ_j⟩_ens = 0 at every pixel (max ${st.ensMax})`);
    return st;
  };
  const s0 = await check('start');
  assert(Math.abs(s0.dMean) > 1e-2, `the mean of δ_j along sightline ${s0.s} is not 0 (${s0.dMean})`);
  assert(Math.abs(s0.TbarMean - s0.expTau) > 0.05, `T̄ (${s0.TbarMean}) is not e^{−⟨τ⟩} (${s0.expTau})`);
  await set(-5); const s1 = await check('n̄ = 1e-5');
  assert(s1.TbarMean < s0.TbarMean && s1.sat > s0.sat, `T̄ falls and more pixels saturate as n̄ grows (${s0.TbarMean} -> ${s1.TbarMean}, ${s0.sat} -> ${s1.sat})`);
  await set(-8); const s2 = await check('n̄ = 1e-8');
  assert(s2.TbarMean > 0.99, `almost no absorption at n̄ = 1e-8 (T̄ = ${s2.TbarMean})`);
  await frame.locator('.dg-controls button').last().click(); await page.waitForTimeout(250);
  const s3 = await check('next sightline');
  assert(s3.s === 3, `the stepper chooses sightline 3 (${s3.s})`);
}
