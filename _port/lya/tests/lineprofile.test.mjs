// Test of the panel lineprofile (§ 3.3, after Figure 4): every number it shows against the notes' formulas, computed
// here independently at the panel's state (§ 3.1.3: b_th = √(2 k_B T/m), b = √(b_th² + b_turb²), σ = b/(√2 λ_j),
// γ = (A_j + A_coll)/(4π)), and the Gaussian/Lorentzian crossing against G = L solved here by bisection.
const KB_AMU = 8314.46262102654, LINES = { lya: [1215.6701, 6.265e8, 1.00794], lyb: [1025.7223, 1.897e8, 1.00794], si3: [1206.5, 2.48e9, 28.0855] };
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
function expect(s) {
  const [lambda, A, m] = LINES[s.line];
  const bth = Math.sqrt(2 * KB_AMU * 10 ** s.logT / m) / 1e3, b = Math.hypot(bth, s.bturb);
  const sigma = b * 1e3 / (Math.SQRT2 * lambda * 1e-10), gamma = (A + (10 ** s.logColl - 1) * A) / (4 * Math.PI);
  // G(ν) = L(ν) for ν > 0, outermost root: ln G − ln L is decreasing for large ν
  const lnG = v => -v * v / (2 * sigma * sigma) - Math.log(Math.sqrt(2 * Math.PI) * sigma);
  const lnL = v => Math.log(gamma / (Math.PI * (v * v + gamma * gamma)));
  let lo = 0, hi = 60 * sigma;
  for (let i = 0; i < 200; i++) { const v = (lo + hi) / 2; if (lnG(v) >= lnL(v)) lo = v; else hi = v; }
  const v = (lo + hi) / 2, c = 2.99792458e8;
  const dl = (1 / (1 / (lambda * 1e-10) + v / c) - lambda * 1e-10) * 1e10;     // ν = c(1/λ' − 1/λ_j) -> λ' − λ_j (blue side)
  return { bth, b, sigma, gamma, cross: Math.abs(dl) };
}
export async function change(page, frame) {
  const r = frame.locator('input[type=range]').first();
  await r.evaluate(n => { n.value = 6; n.dispatchEvent(new Event('input', { bubbles: true })); });
}
export async function run({ page, frame, state, assert }) {
  const set = async (i, v) => { await frame.locator('input[type=range]').nth(i).evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, v); await page.waitForTimeout(150); };
  const check = async tag => {
    const s = await state(), e = expect(s);
    for (const k of ['bth', 'b', 'sigma', 'gamma']) assert(rel(s[k], e[k]) < 1e-9, `${tag}: ${k} = ${s[k]} (expected ${e[k]})`);
    assert(s.cross != null && Math.abs(s.cross - e.cross) < 2e-3 * s.R, `${tag}: G = L at |λ'−λ_j| = ${s.cross} Å (expected ${e.cross})`);
  };
  await check('start');
  await set(0, 6); await check('T = 1e6 K');
  await set(1, 30); await check('b_turb = 30 km/s');
  await set(2, 3); await check('A_coll = 999 A_j');
  for (const [k, label] of [[1, 'Ly β'], [2, 'Si III']]) {
    await frame.locator('.dg-controls input[type=radio]').nth(k).check({ force: true });
    await page.waitForTimeout(150);
    await check(label);
  }
  // σ grows as √T, γ does not depend on T: the crossing moves out as T grows
  await set(2, 0);
  await set(0, 3); const lo = (await state()).cross;
  await set(0, 6); const hi = (await state()).cross;
  assert(hi > lo, `the Gaussian core widens with T (crossing ${lo} -> ${hi} Å)`);
}
