// Test of the panel velocityunits (end of § 3.2.4): the exact coordinate u_exact(x) = c ln(a_†/a(x)) (Appendix C) and
// the single-snapshot u_H(x) = H(z_box)/(1 + z_box) (x − x_†) across the box, recomputed here with this file's own
// RK4 on Eq. (dadx_general) (lower sign, Planck 2018 of Figure 1), against the panel's state; then what it shows:
// the two agree to first order (their slopes at x_† are equal, Eq. (dvjdx_appendix_new)), so their difference grows
// about as L_box² (×4 when L_box doubles).
const C = 299792.458, H0 = 70, OM = { r: 9.1436e-5, m: 0.3089, l: 0.6911 };
const E = a => Math.sqrt(OM.r / a ** 4 + OM.m / a ** 3 + OM.l);
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
function aAt(x, ad) {                                    // da/dx = −(H0/c) a² E(a), a(0) = a_†
  const N = Math.max(100, Math.ceil(Math.abs(x) / 0.05)), h = x / N, f = a => -H0 / C * a * a * E(a);
  let a = ad;
  for (let i = 0; i < N; i++) { const k1 = f(a), k2 = f(a + h * k1 / 2), k3 = f(a + h * k2 / 2), k4 = f(a + h * k3); a += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; }
  return a;
}
function expect(st) {
  const L = 10 ** st.logL, ad = 1 / (1 + st.z), slope = H0 * E(ad) * ad;
  let maxDiff = 0;
  for (let i = 0; i <= 200; i++) { const x = -L / 2 + L * i / 200; maxDiff = Math.max(maxDiff, Math.abs(slope * x - C * Math.log(ad / aAt(x, ad)))); }
  return { L, slope, maxDiff, umaxExact: C * Math.log(aAt(-L / 2, ad) / aAt(L / 2, ad)), umaxApprox: slope * L };
}
export async function change(page, frame) {
  await frame.locator('input[type=range]').nth(1).evaluate(n => { n.value = 3; n.dispatchEvent(new Event('input', { bubbles: true })); });
}
export async function run({ page, frame, state, assert }) {
  const set = async (i, v) => { await frame.locator('input[type=range]').nth(i).evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, v); await page.waitForTimeout(200); };
  const check = async tag => {
    const st = await state(), e = expect(st);
    assert(rel(st.slope, e.slope) < 1e-9, `${tag}: H/(1+z) = ${st.slope} (expected ${e.slope})`);
    assert(rel(st.umaxExact, e.umaxExact) < 1e-5, `${tag}: exact range ${st.umaxExact} km/s (expected ${e.umaxExact})`);
    assert(rel(st.umaxApprox, e.umaxApprox) < 1e-9, `${tag}: u_max ≈ ${st.umaxApprox} km/s (expected ${e.umaxApprox})`);
    assert(Math.abs(st.maxDiff - e.maxDiff) < 2e-3 * e.maxDiff + 1e-6, `${tag}: max |u_H − u_exact| = ${st.maxDiff} km/s (expected ${e.maxDiff})`);
    return st;
  };
  await check('start');
  await set(1, 2.5); const a = await check('L = 316 Mpc');
  await set(1, 2.5 + Math.log10(2)); const b = await check('L = 632 Mpc');
  assert(b.maxDiff / a.maxDiff > 3.5 && b.maxDiff / a.maxDiff < 4.6, `the difference grows about as L² (×${(b.maxDiff / a.maxDiff).toFixed(2)} for ×2 in L)`);
  await set(0, 5); await check('z = 5');
  await set(0, 0.5); await check('z = 0.5');
}
