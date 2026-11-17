// Hand-written (not generated): a toy sightline and its optical depth, shared by the panels opticaldepth (after
// Figure 5, § 3.4) and transmission (§ 3.6) of the Lyα course (Lyα DECISIONS L20, L25). Pure functions, no DOM.
// The optical depth is the notes' Eq. (tau_straight_los) on cells,
//   τ_ij(Λ) = C_j Σ_k n_com,k / a_k³ · φ_ij(x_k, Λ) · a_k Δx,   C_j = e² f_j / (4 ε0 m_e c),
// with Λ = v_† the exact velocity units of Eq. (velocity_units_normalized) (λ_† = λ_j, a_† = a_f): the photon
// labelled by v_† has at x_k the local wavelength λ'_j = λ_j exp(v_†/c) a(x_k)/a_f D⁻¹(x_k), Eq.
// (wavelength_cosmological_z_and_doppler), ν_j = c (1/λ' − 1/λ_j) and φ_ij = V(ν_j; σ_ij, γ_j) (§ 3.3), the widths of
// § 3.1.3. a(x) along the sightline is Eq. (2.5) for the Planck background of Figure 1 (lya.js dadx, RK4).
// The gas is a toy, not the notes' (they take n, T, v from a simulation, Figure 2): a lognormal density
// 1 + δ = exp(g − σ_g²/2) of a Gaussian field g (lya.js gaussField), n_com = n̄ (1 + δ)^1.6, T = T0 (1 + δ)^0.6,
// and the linear-theory peculiar velocity of the same field, ∂v/∂x = −a H f g (f = 1), mean removed.

import { C_KMS, C_MS, LINES, widths, voigt, hubble, dadx, gaussField } from './lya.js';

export const H0 = 70;                                   // [km/s/Mpc] (SkewerJAX phys.H0_km_s_mpc, as Figure 1)
export const PLANCK = { r: 9.1436e-5, m: 0.3089, k: 0, l: 0.6911 };
export const MPC_M = 3.0856775814913673e22;
const E2_4PIE0_MEC = 2.8179403262e-15 * C_MS;            // e²/(4π ε0 m_e c) · c = r_e c [m²/s]; C_j = π r_e c f_j
export const Cj = line => Math.PI * E2_4PIE0_MEC * line.f;  // e² f_j / (4 ε0 m_e c) [m²/s]

/** The sightline: n cells over a comoving length L [Mpc] ending at a_f (towards the observer). */
export const SKEWER = { n: 256, L: 40, af: 1 / 3.4, ell: 0.5, sigG: 0.7, nbar: 1e-5, T0: 1.5e4, seed0: 2000 };

/** a(x) at the cell centres x_k = (k + 1/2) Δx − L (x_f = 0), by RK4 on Eq. (2.5) from a(0) = a_f backwards. */
export function scaleFactors(n = SKEWER.n, L = SKEWER.L, af = SKEWER.af) {
  const toU = H0 / C_KMS, dx = L / n, out = new Float64Array(n);       // x in units of c/H0
  let a = af, x = 0, h = -dx / 2 * toU;
  const step = () => { const k1 = dadx(a, x, PLANCK), k2 = dadx(a + h * k1 / 2, x + h / 2, PLANCK);
    const k3 = dadx(a + h * k2 / 2, x + h / 2, PLANCK), k4 = dadx(a + h * k3, x + h, PLANCK);
    a += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; x += h; };
  step();                                                // to the centre of the last cell
  out[n - 1] = a; h = -dx * toU;
  for (let k = n - 2; k >= 0; k--) { step(); out[k] = a; }
  return out;
}
/** a at the start of the sightline (x_em = −L). */
export function aStart(L = SKEWER.L, af = SKEWER.af, n = 400) {
  const toU = H0 / C_KMS, h = -L / n * toU;
  let a = af, x = 0;
  for (let i = 0; i < n; i++) { const k1 = dadx(a, x, PLANCK), k2 = dadx(a + h * k1 / 2, x + h / 2, PLANCK);
    const k3 = dadx(a + h * k2 / 2, x + h / 2, PLANCK), k4 = dadx(a + h * k3, x + h, PLANCK);
    a += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6; x += h; }
  return a;
}

/** The toy gas of realization s: { g, delta, nrel (n_com/n̄), T [K], v [km/s] } on the cells. */
export function gas(s, opt = {}) {
  const o = { ...SKEWER, ...opt }, dx = o.L / o.n;
  const g = gaussField(o.n, dx, o.ell, o.sigG, o.seed0 + s);
  const a = scaleFactors(o.n, o.L, o.af);
  const delta = g.map(y => Math.exp(y - o.sigG * o.sigG / 2) - 1);
  const nrel = delta.map(d => (1 + d) ** 1.6);
  const T = delta.map(d => o.T0 * (1 + d) ** 0.6);
  const v = new Float64Array(o.n);
  let acc = 0;
  for (let k = 0; k < o.n; k++) { const aH = a[k] * H0 * hubble(a[k], PLANCK); acc += -aH * g[k] * dx; v[k] = acc; }
  const mean = v.reduce((p, q) => p + q, 0) / o.n;
  for (let k = 0; k < o.n; k++) v[k] -= mean;
  return { g, delta, nrel, T, v: Array.from(v), a: Array.from(a), dx };
}

/** The v_† pixels: m pixels over [vlo, vhi] [km/s]. */
export const pixels = (vlo, vhi, m) => Array.from({ length: m }, (_, i) => vlo + (vhi - vlo) * (i + 0.5) / m);

/** τ_ij at the uniform pixels u [km/s] of the gas, per unit n̄ (n̄ = 1 m⁻³): τ is linear in n̄, so τ(n̄) = n̄ · this.
 *  vscale multiplies the peculiar velocities (0: none). Each cell contributes V(ν_j; σ_ij, γ_j) to the pixels within
 *  `cut` Doppler widths b_i of its resonance (v_† = c ln(a_f D / a), vRedshift); what lies beyond (the Lorentzian
 *  wings, less than 10⁻⁵ of the profile's area for these lines and temperatures) is left out (L25). shift [km/s] moves the line on a common spectral axis
 *  (Appendix B.2: a line j placed on the axis of line 1 sits at v_† − c ln(λ_1/λ_j)). */
export function tauUnit(line, G, u, { vscale = 1, bturb = 0, af = SKEWER.af, cut = 15, shift = 0 } = {}) {
  const n = G.a.length, m = u.length, out = new Float64Array(m), C = Cj(line), dxm = G.dx * MPC_M;
  const u0 = u[0], du = (u[m - 1] - u[0]) / (m - 1);
  for (let k = 0; k < n; k++) {
    const w = widths(line, G.T[k], bturb, 0), beta = vscale * G.v[k] / C_KMS;
    const Dinv = Math.sqrt((1 + beta) / (1 - beta));
    const fac = C * G.nrel[k] / G.a[k] ** 2 * dxm;        // C_j n_com / a³ · a Δx (n̄ = 1 m⁻³)
    const base = line.lambda * G.a[k] / af * Dinv;          // λ'_j / exp(v_†/c)
    const vres = C_KMS * Math.log(af / (G.a[k] * Dinv)) + shift;
    const i0 = Math.max(0, Math.ceil((vres - cut * w.b - u0) / du)), i1 = Math.min(m - 1, Math.floor((vres + cut * w.b - u0) / du));
    for (let i = i0; i <= i1; i++) {
      const lp = base * Math.exp((u[i] - shift) / C_KMS);
      const x = C_MS * (1 / (lp * 1e-10) - 1 / (line.lambda * 1e-10));
      out[i] += fac * voigt(x, w.sigma, w.gamma);
    }
  }
  return out;
}
/** v_† of a gas element with no peculiar velocity: the resonance λ'_j = λ_j at x_k, v_† = c ln(a_f / a(x_k)). */
export const vHubble = (a, af = SKEWER.af) => C_KMS * Math.log(af / a);
/** v_† of the element with its peculiar velocity: λ_j e^{v/c} a/a_f D⁻¹ = λ_j ⇒ v_† = c ln(a_f D / a). */
export const vRedshift = (a, v, af = SKEWER.af) => { const b = v / C_KMS; return C_KMS * Math.log(af / a * Math.sqrt((1 - b) / (1 + b))); };
export { LINES, C_KMS };
