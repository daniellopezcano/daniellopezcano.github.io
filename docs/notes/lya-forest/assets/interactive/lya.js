// Hand-written (not generated): physics shared by the interactive panels of the Lyα course (Lyα DECISIONS L20).
// Every formula is the notes' own (section and equation named at each function); the constants and the line data
// are those of SkewerJAX (skewerjax/core/constants.py, skewerjax/core/lines_table.dat), the package the notes
// accompany and that drew their figures. No dependency; imported by the panels, never by the pages.
//
//   C_KMS, KB_AMU, LINES          constants and the three transitions of the notes' Figure 4
//   faddeeva(x, y)                Re and Im of the Faddeeva function W(x + iy), y >= 0 (Humlicek 1982, W4)
//   voigt(x, sigma, gamma)        V(x; σ, γ) = Re W(z) / (√(2π) σ), z = (x + iγ) / (√2 σ)        (§ 3.3)
//   gauss(x, sigma), lorentz(x, gamma)                                                         (§ 3.3)
//   widths(line, T, bturb, Acoll) b_th, b, σ_ij, γ_j                                              (§ 3.1.3)
//   hubble(a, om), dadx(a, x, om) H(a)/H0 and the right-hand side of Eq. (2.5) in units H0/c     (§§ 2.1, 2.3)
//   solveA(om, x1, n, sign)       a(x) from a(0) = 1 by RK4 on Eq. (2.5); stops where a leaves (0, 50]
//   rng(seed), gaussField(...)    a seeded generator and a 1D Gaussian random field (toy sightlines)

export const C_KMS = 2.99792458e5;              // speed of light [km/s]
export const C_MS = 2.99792458e8;               // [m/s]
export const KB_AMU = 8314.46262102654;         // Boltzmann constant / atomic mass unit [m^2 s^-2 K^-1]
/** The transitions of Figure 4 (lines_table.dat): rest wavelength [Å], oscillator strength, A_j [1/s], mass [amu]. */
export const LINES = {
  lya: { name: 'Lyman-α', tex: '\\mathrm{Ly}\\alpha', lambda: 1215.6701, f: 0.4164, A: 6.265e8, mass: 1.00794 },
  lyb: { name: 'Lyman-β', tex: '\\mathrm{Ly}\\beta', lambda: 1025.7223, f: 0.07912, A: 1.897e8, mass: 1.00794 },
  si3: { name: 'Si III 1206', tex: '\\mathrm{SiIII}\\,1206', lambda: 1206.5, f: 1.63, A: 2.48e9, mass: 28.0855 },
};

/** W(z) = e^{-z^2} erfc(-iz) for z = x + iy, y >= 0, as [Re, Im]: Humlíček's W4 rational approximation
 *  (relative error below 1e-4 everywhere), the Faddeeva function of § 3.3. */
export function faddeeva(x, y) {
  const s = Math.abs(x) + y;
  // complex helpers on [re, im]
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sc = (a, k) => [a[0] * k, a[1] * k];
  const poly = (t, cs) => cs.reduceRight((acc, c) => add(mul(acc, t), [c, 0]), [0, 0]);   // c0 + t (c1 + t (...))
  const t = [y, -x];                              // t = y − i x
  if (s >= 15) return div(sc(t, 0.5641896), add([0.5, 0], mul(t, t)));
  if (s >= 5.5) {
    const u = mul(t, t);
    return div(mul(t, add([1.410474, 0], sc(u, 0.5641896))), add([0.75, 0], mul(u, add([3, 0], u))));
  }
  if (y >= 0.195 * Math.abs(x) - 0.176) {
    return div(poly(t, [16.4955, 20.20933, 11.96482, 3.778987, 0.5642236]),
               poly(t, [16.4955, 38.82363, 39.27121, 21.69274, 6.699398, 1]));
  }
  const u = mul(t, t);
  const num = poly(u, [36183.31, -3321.9905, 1540.787, -219.0313, 35.76683, -1.320522, 0.56419]);
  const den = poly(u, [32066.6, -24322.84, 9022.228, -2186.181, 364.2191, -61.57037, 1.841439, -1]);
  const e = Math.exp(u[0]);
  return add([e * Math.cos(u[1]), e * Math.sin(u[1])], sc(mul(t, div(num, den)), -1));
}

const SQ2PI = Math.sqrt(2 * Math.PI);
/** V(x; σ, γ) (§ 3.3): the convolution of G(x; σ) and L(x; γ), = Re W(z) / (√(2π) σ), z = (x + iγ)/(√2 σ). */
export function voigt(x, sigma, gamma) {
  return faddeeva(x / (Math.SQRT2 * sigma), gamma / (Math.SQRT2 * sigma))[0] / (SQ2PI * sigma);
}
/** G(x; σ) and L(x; γ) of § 3.3. */
export const gauss = (x, sigma) => Math.exp(-x * x / (2 * sigma * sigma)) / (SQ2PI * sigma);
export const lorentz = (x, gamma) => gamma / (Math.PI * (x * x + gamma * gamma));

/** § 3.1.3: b_th = √(2 k_B T / m) [km/s], b = √(b_th² + b_turb²) [km/s], σ_ij = b / (√2 λ_j) [Hz],
 *  γ_j = (A_j + A_coll) / (4π) [Hz]. T in K, bturb in km/s, Acoll in 1/s. */
export function widths(line, T, bturb, Acoll) {
  const bth = Math.sqrt(2 * KB_AMU * T / line.mass) / 1e3;
  const b = Math.hypot(bth, bturb);
  const sigma = b * 1e3 / (Math.SQRT2 * line.lambda * 1e-10);
  const gamma = (line.A + Acoll) / (4 * Math.PI);
  return { bth, b, sigma, gamma };
}
/** ν_j = c (1/λ' − 1/λ_j) [Hz] for λ' and λ_j in Å (§ 3.3). */
export const nu = (lambdaPrime, lambdaJ) => C_MS * (1 / (lambdaPrime * 1e-10) - 1 / (lambdaJ * 1e-10));

/** Eq. (2.2), H(a)/H0 = √(Ω_r a⁻⁴ + Ω_m a⁻³ + Ω_k a⁻² + Ω_Λ); om = {r, m, k, l}. */
export const hubble = (a, om) => Math.sqrt(om.r / a ** 4 + om.m / a ** 3 + om.k / a ** 2 + om.l);
/** Eq. (2.5) with x in units of c/H0: da/dx = ± √((Ω_r + Ω_m a + Ω_k a² + Ω_Λ a⁴) / (1 − κ x²)), κ x² = −Ω_k x². */
export function dadx(a, x, om, sign = 1) {
  const num = om.r + om.m * a + om.k * a * a + om.l * a ** 4, den = 1 + om.k * x * x;
  return num > 0 && den > 0 ? sign * Math.sqrt(num / den) : NaN;
}
/** a(x) on [0, x1] (x in c/H0; x1 may be negative) from a(0) = 1, RK4 with n steps; the curve stops where a
 *  leaves (0, amax] or the right-hand side is not real. Returns [[x, a], ...]. */
export function solveA(om, x1, n = 600, sign = 1, amax = 50) {
  const h = x1 / n, out = [[0, 1]];
  let a = 1, x = 0;
  for (let i = 0; i < n; i++) {
    const k1 = dadx(a, x, om, sign), k2 = dadx(a + h * k1 / 2, x + h / 2, om, sign);
    const k3 = dadx(a + h * k2 / 2, x + h / 2, om, sign), k4 = dadx(a + h * k3, x + h, om, sign);
    const an = a + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    if (!(an > 0 && an <= amax)) break;
    a = an; x += h;
    out.push([x, a]);
  }
  return out;
}

/** Seeded uniform generator in [0, 1) (mulberry32) and its Gaussian companion (Box–Muller). */
export function rng(seed) {
  let s = seed >>> 0;
  const u = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = () => { let a = u(); while (a === 0) a = u(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u()); };
  return { u, g };
}

/** A 1D Gaussian random field on n cells of size dx with correlation ξ(Δ) = s² exp(−Δ²/(2ℓ²)): white noise
 *  convolved with a Gaussian kernel of width ℓ/√2 (truncated at 4 widths), normalised to variance s². Non-periodic:
 *  the noise is drawn on a margin around the interval, so every cell has the same statistics. */
export function gaussField(n, dx, ell, s, seed) {
  const r = rng(seed), w = ell / Math.SQRT2, m = Math.ceil(4 * w / dx);
  const noise = Array.from({ length: n + 2 * m }, r.g);
  const ker = Array.from({ length: 2 * m + 1 }, (_, k) => Math.exp(-(((k - m) * dx) ** 2) / (2 * w * w)));
  const norm = Math.sqrt(ker.reduce((acc, v) => acc + v * v, 0));
  return Array.from({ length: n }, (_, i) => { let v = 0; for (let k = 0; k < ker.length; k++) v += ker[k] * noise[i + k]; return s * v / norm; });
}
