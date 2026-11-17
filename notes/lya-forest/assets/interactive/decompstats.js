// Hand-written (not generated): the statistics of the panel decomposition (Lyα course, § 4.8, Lyα DECISIONS L25, L33),
// apart from its drawing so that they can be computed outside the page. Pure functions, no DOM.
// Two transitions, j = 1 Lyα and j = 2 Si III 1206, absorbed by the same toy gas (skewer.js) along ENS sightlines,
// on one spectral axis Λ: the velocity units of line 1 (Eq. (velocity_units_normalized) with λ_† = λ_1), on which
// line 2 sits shifted by −c ln(λ_1/λ_2) (Appendix B.2). In the window of Λ where both lines absorb:
//   T_j = exp(−τ_j), T̄_j the mean over the window and the sightlines (translation invariance, Eq. (xi3D_ensemble_translation_invariant), § 4.5),
//   δ_j = T_j/T̄_j − 1 (Eq. (delta_j)), C_12 = ⟨δ_1 δ_2⟩ (the one-point average of § 3.6, C for L = 2),
//   ξ_AB(Δ) = ⟨A(Λ) B(Λ + Δ)⟩ over the window pairs and the sightlines (Eqs. (xi3D_1D_per_sightline), (xi3D_sample_zero_lag),
//   (xi3D_ensemble_estimator_from_samples)), with A, B among δ_1, δ_2 and (12) = δ_1 δ_2,
// and the terms of Eq. (xi1D_ensemble_L2_decomposition), each divided by (1 + C_12)²; their sum is the total ξ of
// δ = T/T̄ − 1, T = T_1 T_2 (Eq. (total_overflux_compact)), computed directly as well.
import { C_KMS, LINES, gas, pixels, tauUnit, aStart, vHubble } from './skewer.js';

export const TOY = { L: 100, n: 512, ens: 24, du: 5, stride: 2, dmax: 3000, nbar1: 5e-7, bturb: 10 };
export const SHIFT = -C_KMS * Math.log(LINES.lya.lambda / LINES.si3.lambda);     // line 2 on the axis of line 1 [km/s]

let UNIT = null;
/** τ_1, τ_2 per unit n̄ on the window pixels of the ENS sightlines (computed once). */
export function unitTaus() {
  if (UNIT) return UNIT;
  const vmax = vHubble(aStart(TOY.L));
  const lo = SHIFT, hi = vmax, m = Math.round((hi - lo) / TOY.du);
  const u = pixels(lo, hi, m);
  const w0 = u.findIndex(x => x >= 0), w1 = u.findIndex(x => x > vmax + SHIFT);     // both lines absorb in [0, vmax + SHIFT]
  const win = [w0, w1 < 0 ? m : w1];
  const taus = Array.from({ length: TOY.ens }, (_, s) => {
    const G = gas(s + 1, { L: TOY.L, n: TOY.n });
    const t1 = tauUnit(LINES.lya, G, u, { bturb: TOY.bturb }), t2 = tauUnit(LINES.si3, G, u, { bturb: TOY.bturb, shift: SHIFT });
    return [t1.slice(win[0], win[1]), t2.slice(win[0], win[1])];
  });
  UNIT = { u: u.slice(win[0], win[1]), taus, vmax };
  return UNIT;
}

/** ⟨A(Λ) B(Λ + Δ)⟩ at the lags k·stride·du, over the pairs of each sightline (non-periodic) and the sightlines. */
export function corr(A, B, K, stride) {
  const out = new Float64Array(K + 1), n = A[0].length;
  for (let q = 0; q <= K; q++) {
    const k = q * stride;
    let acc = 0;
    for (let s = 0; s < A.length; s++) { const a = A[s], b = B[s]; for (let i = 0; i + k < n; i++) acc += a[i] * b[i + k]; }
    out[q] = acc / (A.length * (n - k));
  }
  return out;
}

/** Everything the panel shows for the Si III density n̄_2 = 10^logr n̄_1. */
export function decompose(logr) {
  const { u, taus } = unitTaus(), n1 = TOY.nbar1, n2 = n1 * 10 ** logr;
  const T1 = taus.map(([t]) => Array.from(t, x => Math.exp(-n1 * x))), T2 = taus.map(([, t]) => Array.from(t, x => Math.exp(-n2 * x)));
  const mean = X => X.reduce((a, x) => a + x.reduce((p, q) => p + q, 0), 0) / (X.length * X[0].length);
  const Tb1 = mean(T1), Tb2 = mean(T2);
  const d1 = T1.map(x => x.map(t => t / Tb1 - 1)), d2 = T2.map(x => x.map(t => t / Tb2 - 1));
  const P = d1.map((x, s) => x.map((v, i) => v * d2[s][i]));
  const C = mean(P);
  const K = Math.floor(TOY.dmax / (TOY.du * TOY.stride)), st = TOY.stride;
  const sym = (A, B) => { const x = corr(A, B, K, st), y = corr(B, A, K, st); return x.map((v, q) => v + y[q]); };
  const n = 1 / (1 + C) ** 2;
  const terms = {
    c: Array.from({ length: K + 1 }, () => -C * C * n),                 // −C_12 C_12 (order 0)
    x11: corr(d1, d1, K, st).map(v => v * n), x22: corr(d2, d2, K, st).map(v => v * n), x12: sym(d1, d2).map(v => v * n),   // order 2
    x1p: sym(d1, P).map(v => v * n), x2p: sym(d2, P).map(v => v * n),  // order 3
    xpp: corr(P, P, K, st).map(v => v * n),                           // order 4
  };
  const sum = terms.c.map((_, q) => Object.values(terms).reduce((a, t) => a + t[q], 0));
  // the total overflux of T = T_1 T_2 directly (Eq. (total_overflux_compact))
  const T = T1.map((x, s) => x.map((t, i) => t * T2[s][i])), Tb = mean(T), d = T.map(x => x.map(t => t / Tb - 1));
  const direct = corr(d, d, K, st);
  const lags = Array.from({ length: K + 1 }, (_, q) => q * st * TOY.du);
  return { lags, terms, sum, direct, C, Tb1, Tb2, Tb, n2 };
}
