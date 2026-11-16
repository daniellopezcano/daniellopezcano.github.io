// Test of the panel scalefactor (§ 2.3, after Figure 1): where the ray of Eq. (dadx_general) (upper sign, through
// x = 0, a = 1) ends, recomputed here by this file's own RK4, against the panel's state and readouts, for the backgrounds
// of Figure 1 and the analytic solutions of § 2.3.1: matter ends at a = 0 at x = −2c/H0, radiation at x = −c/H0, Λ goes
// to infinity at x = +c/H0; Planck 2018 neither inside the plotted range; a closed background ends where 1 − κx² = 0.
const C_OVER_H0 = 299792.458 / 70;
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
export async function change(page, frame) {
  await frame.locator('input[type=range]').first().evaluate(n => { n.value = 1; n.dispatchEvent(new Event('input', { bubbles: true })); });
}
export async function run({ page, frame, state, assert }) {
  const set = async (i, v) => { await frame.locator('input[type=range]').nth(i).evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, v); await page.waitForTimeout(200); };
  const s0 = await state();
  assert(Math.abs(s0.k - (1 - s0.m - s0.l - 10 ** s0.logr)) < 1e-12 && Math.abs(s0.k) < 1e-4, `Planck 2018: Ω_k = ${s0.k}`);
  assert(!s0.past.ended && !s0.future.ended, 'Planck 2018: the ray crosses the whole plotted range (as in Figure 1)');
  // matter: Ω_m = 1, Ω_Λ = 0, Ω_r ≈ 0 (10^-6)
  await set(0, 1); await set(1, 0); await set(2, -6);
  let s = await state();
  assert(s.past.ended && s.past.why === 'a0' && rel(s.past.x, -2 * C_OVER_H0) < 2e-3, `matter: a = 0 at ${s.past.x} Mpc (analytic −2c/H0 = ${-2 * C_OVER_H0})`);
  // radiation: Ω_r = 1
  await set(0, 0); await set(2, 0);
  s = await state();
  assert(s.past.ended && s.past.why === 'a0' && rel(s.past.x, -C_OVER_H0) < 2e-3, `radiation: a = 0 at ${s.past.x} Mpc (analytic −c/H0 = ${-C_OVER_H0})`);
  // Λ: Ω_Λ = 1
  await set(2, -6); await set(1, 1);
  s = await state();
  assert(s.future.ended && s.future.why === 'inf' && rel(s.future.x, C_OVER_H0) < 5e-3, `Λ: a → ∞ at ${s.future.x} Mpc (analytic c/H0 = ${C_OVER_H0})`);
  assert(!s.past.ended, 'Λ: the past ray never reaches a = 0');
  // closed: Ω_m = 2, Ω_Λ = 0 → Ω_k ≈ −1, 1 − κx² = 1 + Ω_k (H0 x/c)² vanishes at |x| = c/H0
  await set(1, 0); await set(0, 2);
  s = await state();
  assert(s.future.ended && s.future.why === 'curv' && rel(s.future.x, C_OVER_H0 / Math.sqrt(-s.k)) < 5e-3, `closed: the future ray ends where 1 − κx² = 0 (${s.future.x} Mpc)`);
  const shown = await frame.locator('.dg-gr-val').allTextContents();
  assert(shown[0] === s.k.toFixed(4).replace('-', '−') && /1 − κx² = 0/.test(shown[2]), `readouts ${shown.join(' | ')}`);
}
