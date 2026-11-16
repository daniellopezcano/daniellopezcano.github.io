// Test of the panel opticaldepth (§ 3.4, after Figure 5): τ of Eq. (tau_straight_los) at the panel's state, recomputed
// here (skewer_ref.mjs: a(x) of Eq. (dadx_general), the toy gas, the local wavelength of Eq.
// (wavelength_cosmological_z_and_doppler) in the velocity units of Eq. (velocity_units_normalized), the full profile V
// of every cell) at the pixel of the maximum and at evenly spaced pixels, with and without the peculiar velocities;
// the readouts; and what the panel shows: with no peculiar velocities the two curves coincide, a hotter gas lowers
// and widens the absorption (the peak of the at-rest τ falls), Lyβ absorbs less than Lyα in the same gas.
import { gasRef, tauRef, vRange, pixelsRef, rel } from './skewer_ref.mjs';

const NBAR = 5e-7, NPIX = 256;
export async function change(page, frame) {
  await frame.locator('input[type=range]').first().evaluate(n => { n.value = 0; n.dispatchEvent(new Event('input', { bubbles: true })); });
}
export async function run({ page, frame, state, assert }) {
  const set = async (i, v) => { await frame.locator('input[type=range]').nth(i).evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, v); await page.waitForTimeout(250); };
  const mod = st => page.evaluate(async s => {
    const m = await import(new URL('../assets/interactive/opticaldepth.js', location.href).href);
    const r = m.compute(s); return { u: r.u, tau: r.tau, tau0: r.tau0, vmax: r.vmax };
  }, st);
  const check = async tag => {
    const st = await state(), m = await mod(st);
    const G = gasRef(1, { T0: 10 ** st.logT0 }), vmax = vRange();
    assert(rel(m.vmax, vmax) < 1e-6, `${tag}: v_† range [0, ${m.vmax}] km/s (expected ${vmax})`);
    const u = pixelsRef(0, vmax, NPIX);
    const idx = [st.imax, 13, 64, 128, 190, 250];
    for (const i of idx) {
      const t = NBAR * tauRef(st.line, G, u[i], { vscale: st.vs, bturb: st.bturb }), t0 = NBAR * tauRef(st.line, G, u[i], { vscale: 0, bturb: st.bturb });
      assert(Math.abs(m.tau[i] - t) < 1e-3 * t + 1e-6, `${tag}: τ at v_† = ${u[i].toFixed(1)} km/s is ${m.tau[i]} (expected ${t})`);
      assert(Math.abs(m.tau0[i] - t0) < 1e-3 * t0 + 1e-6, `${tag}: τ (v = 0) at v_† = ${u[i].toFixed(1)} km/s is ${m.tau0[i]} (expected ${t0})`);
    }
    assert(Math.max(...m.tau) === st.max && m.tau.indexOf(st.max) === st.imax && Math.max(...m.tau0) === st.max0, `${tag}: max τ readouts`);
    const shown = await frame.locator('.dg-gr-val').allTextContents();
    assert(shown[1] === st.max.toFixed(3) && shown[2] === st.max0.toFixed(3), `${tag}: readouts ${shown.join(' | ')}`);
    return st;
  };
  const s0 = await check('start');
  await set(0, 0); const s1 = await check('no peculiar velocities');
  assert(s1.max === s1.max0, 'with v = 0 the two optical depths are the same');
  await set(0, 2); await check('velocities doubled');
  await set(0, 1); await set(1, 5); const hot = await check('T0 = 1e5 K');
  assert(hot.max0 < s0.max0, `a hotter gas lowers the peak of τ (at rest: ${s0.max0} -> ${hot.max0})`);
  await set(1, s0.logT0); await set(2, 30); await check('b_turb = 30 km/s');
  await set(2, 0);
  await frame.locator('.dg-controls .dg-seg label').nth(1).click(); await page.waitForTimeout(250);
  const b = await check('Lyβ');
  assert(b.mean < s0.mean, `Lyβ absorbs less than Lyα in the same gas (mean τ ${b.mean} < ${s0.mean})`);
}
