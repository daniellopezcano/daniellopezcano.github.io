// Test of the panel aliasing (§ 6.7, after Figure 14): every number it shows against the notes' formulas, computed here
// independently at the panel's state. Eq. (DFT_ensemble) in 1D, P^alias(k) = Σ_c P(k + 2c k_Ny), k_Ny = π/d, summed here
// over |c| ≤ 40 (the panel stops at |c| ≤ 10: the truncation is checked), and the pixel window of the paragraph after
// Figure 14, each term times |W_pix|² = sinc²(k d/2) at its own wavenumber; the toy P(k) = e^{−(k/k_c)²}/(1 + (k/k_1)²)
// with the panel's k_c, k_1. The fractions are computed as (Σ_{c≠0} …)/P, which is (P^alias − P)/P without the
// rounding of a difference of nearly equal numbers. Checked: the readouts at k = k_Ny/2 (k_Ny, the aliased fraction, and with the pixel average
// the folded fraction and P^alias_pix/P), a sample of the drawn curves (the module's functions against this file's
// sums), and the claims: the aliasing at k_Ny/2 falls as d decreases (monotone over the slider), is below 1 % once
// k_Ny ≥ 2 k_c, and the pixel average reduces the folded power (every c ≠ 0 term is multiplied by sinc² < 1).
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const P = (st, k) => Math.exp(-((k / st.kc) ** 2)) / (1 + (k / st.k1) ** 2);
const W2 = (k, d) => { const x = k * d / 2; return x === 0 ? 1 : (Math.sin(x) / x) ** 2; };
const term = (st, k, c, d, pix) => { const q = k + 2 * c * Math.PI / d; return P(st, q) * (pix ? W2(q, d) : 1); };
const sum = (st, k, d, pix, C = 40, skip0 = false) => { let s = 0; for (let c = -C; c <= C; c++) if (!(skip0 && c === 0)) s += term(st, k, c, d, pix); return s; };
const pct = x => (100 * x < 0.005 ? '< 0.01 %' : `${(100 * x).toFixed(2).replace('-', '−')} %`);
function expect(st) {
  const d = 10 ** st.logd, kNy = Math.PI / d, k = kNy / 2, p = P(st, k);
  return { d, kNy, frac: sum(st, k, d, false, 40, true) / p, fpix: sum(st, k, d, true, 40, true) / (p * W2(k, d)), rpix: sum(st, k, d, true) / p };
}

export async function run({ page, frame, state, assert }) {
  const slider = frame.locator('input[type=range]').first();
  const lim = await slider.evaluate(n => ({ min: +n.min, max: +n.max, step: +n.step }));
  const set = async v => { await slider.evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }, v); await page.waitForTimeout(150); };
  const check = async tag => {
    const st = await state(), e = expect(st);
    assert(rel(st.d, e.d) < 1e-14 && rel(st.kNy, e.kNy) < 1e-14, `${tag}: d = ${st.d}, k_Ny = π/d = ${st.kNy}`);
    for (const k of ['frac', 'fpix', 'rpix']) assert(Math.abs(st[k] - e[k]) <= 1e-12 * Math.max(1, Math.abs(e[k])), `${tag}: ${k} = ${st[k]} (expected ${e[k]})`);
    const shown = await frame.locator('.dg-gr-val').allTextContents();
    const want = [e.kNy.toFixed(3), pct(e.frac), pct(e.fpix), e.rpix.toFixed(3)];
    assert(shown.join(' | ') === want.join(' | '), `${tag}: readouts ${shown.join(' | ')} (expected ${want.join(' | ')})`);
    const visible = await frame.locator('.dg-gr-pair').evaluateAll(ps => ps.map(p => p.offsetParent !== null));
    assert(visible.join() === [true, true, st.pix, st.pix].join(), `${tag}: the pixel-average readouts are shown exactly when the toggle is on`);
    // a sample of the drawn curves: the module's terms and sums against this file's
    const ks = Array.from({ length: 12 }, (_, i) => e.kNy * 10 ** (-1.5 * i / 11));
    const m = await page.evaluate(async ([ks, d]) => {
      const mod = await import(new URL('../assets/interactive/aliasing.js', location.href).href);
      return ks.map(k => [mod.alias(k, d, false), mod.alias(k, d, true), mod.term(k, -1, d, false), mod.term(k, 2, d, true), mod.P(k)]);
    }, [ks, e.d]);
    let dev = 0;
    ks.forEach((k, i) => {
      const own = [sum(st, k, e.d, false), sum(st, k, e.d, true), term(st, k, -1, e.d, false), term(st, k, 2, e.d, true), P(st, k)];
      own.forEach((v, j) => { dev = Math.max(dev, v === 0 ? Math.abs(m[i][j]) : rel(m[i][j], v)); });
    });
    assert(dev < 1e-12, `${tag}: P, the copies, P^alias and P^alias_pix of the module = this file's sums at 12 wavenumbers (max rel diff ${dev})`);
    return st;
  };
  const s0 = await check('start');
  assert(s0.pix === false, 'start: no pixel average');
  await frame.locator('input[type=checkbox]').click(); await page.waitForTimeout(200);
  const s1 = await check('pixel average');
  assert(s1.pix === true, 'the toggle switches the pixel average on');
  await set(lim.max); await check('pixel average, largest d');
  await set(lim.min); const sf = await check('pixel average, smallest d');
  assert(Math.abs(sf.rpix - 8 / Math.PI ** 2) < 1e-9, `finest pixels: P^alias_pix/P = sinc²(π/4) = 8/π² at k_Ny/2 (no folding left, only the tilt of the c = 0 term): ${sf.rpix}`);
  await frame.locator('input[type=checkbox]').click(); await page.waitForTimeout(200);
  await set(lim.max); await check('largest d');
  await set(s0.logd);

  // over every position of the slider
  const st = s0, pos = [];
  for (let v = lim.min; v <= lim.max + 1e-9; v += lim.step) pos.push(+v.toFixed(6));
  let trunc = 0, monotone = true, prev = Infinity, small = true, folded = true;
  for (const logd of pos.slice().reverse()) {             // from the coarsest pixels to the finest
    const d = 10 ** logd, kNy = Math.PI / d, e = expect({ ...st, logd });
    // truncation of the sum at |c| ≤ 10, against |c| ≤ 40, at k = 0, k_Ny/2 and k_Ny, with and without the pixel window
    for (const k of [0, kNy / 2, kNy]) for (const pix of [false, true]) trunc = Math.max(trunc, rel(sum(st, k, d, pix, s0.CMAX), sum(st, k, d, pix, 40)));
    if (!(e.frac < prev)) monotone = false;
    prev = e.frac;
    if (kNy >= 2 * st.kc && !(e.frac < 0.01)) small = false;
    // the pixel average multiplies each folded term by sinc² < 1: at 20 wavenumbers in (0, k_Ny]
    for (let i = 1; i <= 20; i++) {
      const k = kNy * i / 20;
      for (let c = -3; c <= 3; c++) if (c !== 0) { const a = term(st, k, c, d, false), b = term(st, k, c, d, true); if (a > 0 && !(b < a)) folded = false; }
      if (!(sum(st, k, d, true, 40, true) < sum(st, k, d, false, 40, true))) folded = false;
    }
    if (e.frac > 0 && !(e.fpix < e.frac)) folded = false;
  }
  assert(trunc < 1e-15, `the sum truncated at |c| ≤ ${s0.CMAX} equals the sum to |c| ≤ 40 (max rel diff ${trunc})`);
  assert(monotone, `(P^alias − P)/P at k_Ny/2 decreases as d decreases, over all ${pos.length} positions of the slider`);
  const coarse = expect({ ...st, logd: lim.max }).frac, fine = expect({ ...st, logd: lim.min }).frac;
  assert(coarse > 0.1 && fine < 1e-20, `aliasing at k_Ny/2: ${coarse.toFixed(3)} at the coarsest pixels, ${fine.toExponential(1)} at the finest`);
  assert(small, '(P^alias − P)/P at k_Ny/2 < 1 % whenever k_Ny ≥ 2 k_c');
  assert(folded, 'the pixel average reduces every folded term (c ≠ 0), their sum, and the folded fraction at k_Ny/2');
}
