// Reference computations for the tests of the panels opticaldepth, transmission and decomposition (Lyα DECISIONS
// L25): the toy gas and the optical depth of Eq. (tau_straight_los), written here independently of skewer.js. Only
// the Gaussian random field (lya.js gaussField: the toy's input, with the seeds the panels state) and the Faddeeva
// function (lya.js voigt: checked against scipy, L20) are shared. Not a test file itself.
import { gaussField, voigt } from '../../../notes/lya-forest/assets/interactive/lya.js';

export const C_KMS = 299792.458, C_MS = 299792458, MPC = 3.0856775814913673e22, KB_AMU = 8314.46262102654;
export const LINE = { lya: { lambda: 1215.6701, f: 0.4164, A: 6.265e8, m: 1.00794 }, lyb: { lambda: 1025.7223, f: 0.07912, A: 1.897e8, m: 1.00794 },
  si3: { lambda: 1206.5, f: 1.63, A: 2.48e9, m: 28.0855 } };
const OM = { r: 9.1436e-5, m: 0.3089, l: 0.6911 }, H0 = 70;
const E = a => Math.sqrt(OM.r / a ** 4 + OM.m / a ** 3 + OM.l);
// e² f / (4 ε0 m_e c) in SI, from the constants themselves
const e = 1.602176634e-19, eps0 = 8.8541878128e-12, me = 9.1093837015e-31;
export const Cj = f => e * e * f / (4 * eps0 * me * C_MS);

/** a(x) for a flat background, da/dx = (H0/c) a² E(a) (Eq. (dadx_general), Ω_k = 0, upper sign), from a(0) = af at
 *  the end of the sightline, evaluated at x (x ≤ 0, Mpc), with fine RK4 steps. */
export function aAt(x, af) {
  const N = Math.max(50, Math.ceil(Math.abs(x) / 0.02)), h = x / N, f = a => H0 / C_KMS * a * a * E(a);
  let a = af;
  for (let i = 0; i < N; i++) { const k1 = f(a), k2 = f(a + h * k1 / 2), k3 = f(a + h * k2 / 2), k4 = f(a + h * k3); a += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; }
  return a;
}
/** The toy gas of realization s on n cells over L Mpc ending at af (the panels' stated model). */
export function gasRef(s, { n = 256, L = 40, af = 1 / 3.4, ell = 0.5, sigG = 0.7, T0 = 1.5e4, seed0 = 2000 } = {}) {
  const dx = L / n, g = gaussField(n, dx, ell, sigG, seed0 + s);
  const x = Array.from({ length: n }, (_, k) => (k + 0.5) * dx - L), a = x.map(xx => aAt(xx, af));
  const d = g.map(y => Math.exp(y - sigG * sigG / 2) - 1);
  let acc = 0;
  const v = g.map((y, k) => (acc += -a[k] * H0 * E(a[k]) * y * dx));
  const mv = v.reduce((p, q) => p + q, 0) / n;
  return { dx, a, nrel: d.map(z => (1 + z) ** 1.6), T: d.map(z => T0 * (1 + z) ** 0.6), v: v.map(z => z - mv), af };
}
/** τ per unit n̄ at the spectral coordinate u (velocity units of the line, a_† = a_f), every cell, full profile. */
export function tauRef(lineKey, G, u, { vscale = 1, bturb = 0, shift = 0 } = {}) {
  const L = LINE[lineKey];
  let t = 0;
  for (let k = 0; k < G.a.length; k++) {
    const bth = Math.sqrt(2 * KB_AMU * G.T[k] / L.m) / 1e3, b = Math.sqrt(bth * bth + bturb * bturb);
    const sigma = b * 1e3 / (Math.SQRT2 * L.lambda * 1e-10), gamma = L.A / (4 * Math.PI);
    const beta = vscale * G.v[k] / C_KMS, Dinv = Math.sqrt((1 + beta) / (1 - beta));
    const lp = L.lambda * Math.exp((u - shift) / C_KMS) * G.a[k] / G.af * Dinv;           // Eq. (velocity_units_normalized)
    const nu = C_MS * (1 / (lp * 1e-10) - 1 / (L.lambda * 1e-10));
    t += Cj(L.f) * G.nrel[k] / G.a[k] ** 3 * voigt(nu, sigma, gamma) * G.a[k] * G.dx * MPC;   // Eq. (tau_straight_los)
  }
  return t;
}
/** v_† range of the sightline: c ln(a_f / a(x_em)). */
export const vRange = (L = 40, af = 1 / 3.4) => C_KMS * Math.log(af / aAt(-L, af));
export const pixelsRef = (lo, hi, m) => Array.from({ length: m }, (_, i) => lo + (hi - lo) * (i + 0.5) / m);
export const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
