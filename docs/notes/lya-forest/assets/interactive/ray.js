// Hand-written (not generated): a(x) along a light ray, shared by the panels scalefactor (after Figure 1) and
// velocityunits (end of § 3.2.4) of the Lyα course (Lyα DECISIONS L20). Pure functions, no DOM.
// The equation is the notes' Eq. (2.5) (label dadx_general), da/dx = ± (H0/c) √((Ω_r + Ω_m a + Ω_k a² + Ω_Λ a⁴) /
// (1 − κ x²)), κ = −Ω_k H0²/c², whose right-hand side is lya.js: dadx (x in units of c/H0). The backgrounds and H0
// are those of SkewerJAX's notebooks/02_cosmology.ipynb, which drew Figure 1 (H0 = 70 km/s/Mpc, skewerjax/core/
// constants.py; Planck 2018: Ω_r = 9.1436e-5, Ω_m = 0.3089, Ω_Λ = 0.6911, Ω_k = 0).
//
//   H0, C_OVER_H0, BACKGROUNDS     H0 [km/s/Mpc], c/H0 [Mpc], the four backgrounds of Figure 1 ({r, m, k, l})
//   trace(om, x0, a0, x1, opt)     a(x) from a(x0) = a0 to x1 (units c/H0) by RK4 on Eq. (2.5); where a step fails
//                                  (a leaves (0, amax] or the right-hand side is not real) the step is halved until it is
//                                  below hmin, so the last point is the end of the solution to that precision.

import { C_KMS, dadx } from './lya.js';

export const H0 = 70;                                   // [km/s/Mpc], skewerjax phys.H0_km_s_mpc
export const C_OVER_H0 = C_KMS / H0;                    // c/H0 [Mpc]
export const BACKGROUNDS = {
  radiation: { r: 1, m: 0, k: 0, l: 0 },
  matter: { r: 0, m: 1, k: 0, l: 0 },
  lambda: { r: 0, m: 0, k: 0, l: 1 },
  planck: { r: 9.1436e-5, m: 0.3089, k: 0, l: 0.6911 },
};

/** RK4 on Eq. (2.5) from (x0, a0) towards x1 (x in c/H0), n steps of equal size where the solution is regular.
 *  opt: sign (+1 upper, −1 lower), n, amax, hmin. Returns { pts: [[x, a], ...], ended } where ended is true when
 *  the solution stopped before x1 (a → 0, a → ∞, or the right-hand side of Eq. (2.5) no longer real). */
export function trace(om, x0, a0, x1, { sign = 1, n = 600, amax = 1e4, hmin = 1e-9 } = {}) {
  const pts = [[x0, a0]], dir = Math.sign(x1 - x0);
  let h = (x1 - x0) / n, x = x0, a = a0, ended = false;
  const f = (xx, aa) => dadx(aa, xx, om, sign);
  while (dir * (x1 - x) > 1e-12) {
    if (dir * (x + h - x1) > 0) h = x1 - x;
    const k1 = f(x, a), k2 = f(x + h / 2, a + h * k1 / 2), k3 = f(x + h / 2, a + h * k2 / 2), k4 = f(x + h, a + h * k3);
    const an = a + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    if (an > 0 && an <= amax) { x += h; a = an; pts.push([x, a]); continue; }
    if (Math.abs(h) < hmin) { ended = true; break; }
    h /= 2;
  }
  return { pts, ended };
}
