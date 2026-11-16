// Hand-written (not generated): the 2D manifold of the package notebooks notebooks/2_1_charts.ipynb ("2D-mfd embedded
// in 3D", Figure 3.1) and notebooks/2_3_TpM.ipynb (Figure 4.2), which define it identically (github.com/daniellopezcano/
// differential_geometry). Shared by the interactives charts.js (after Figure 3.1) and tpm.js (after Figure 4.2).
// M is the surface (x, y) -> (x, y, z(x, y)) with
//   z = (cos(x + y)/2 + sin(x - y + pi/2)/2 + 1) exp(-(x^2 + y^2)/(2 pi^2))   (factory_surface_embedding_gaussian_eggs)
// drawn on [-pi^2/3, pi^2/3]^2; the chart X is the identity on (x, y) (cartesian_chart_map) on U, the ellipse
// of centre (0.1, -0.7) and semi-axes (0.9, 1.5); the chart Y gives polar coordinates (r, theta) about
// (-1, -1) (polar_chart_map, theta = atan2 in (-pi, pi]) on V, the ellipse of centre (0.7, 0.3) and semi-axes (1.4, 0.9).
// The vertical scale of the 3D view follows the figures (matplotlib box aspect 1 : 1 : 0.8).
export const PI = Math.PI, A = PI * PI / 3;               // the notebooks' plotting range [-A, A]^2
export const U = { c: [0.1, -0.7], ax: [0.9, 1.5] }, V = { c: [0.7, 0.3], ax: [1.4, 0.9] }, POLE = [-1, -1];

export const height = (x, y) => (Math.cos(x + y) / 2 + Math.sin(x - y + PI / 2) / 2 + 1) * Math.exp(-(x * x + y * y) / (2 * PI * PI));
/** The chart Y (X is the identity on the parameters, X(q) = q). */
export const Y = ([x, y]) => [Math.hypot(x - POLE[0], y - POLE[1]), Math.atan2(y - POLE[1], x - POLE[0])];
export const Yinv = ([r, t]) => [POLE[0] + r * Math.cos(t), POLE[1] + r * Math.sin(t)];
/** (dY^k/dX^i)_p, the Jacobian of Y o X^-1 at X(p), as rows k. */
export function jacobian([x, y]) {
  const dx = x - POLE[0], dy = y - POLE[1], r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
  return [[dx / r, dy / r], [-dy / r2, dx / r2]];
}
/** < 1 inside the (open) ellipse R. */
export const ell = (R, [x, y]) => ((x - R.c[0]) / R.ax[0]) ** 2 + ((y - R.c[1]) / R.ax[1]) ** 2;
export const inU = q => ell(U, q) < 1, inV = q => ell(V, q) < 1;
export const inUV = q => inU(q) && inV(q);

/** Boundary of an ellipse, n + 1 points (closed). */
export const ellipse = (R, n = 180) => Array.from({ length: n + 1 }, (_, k) => [R.c[0] + R.ax[0] * Math.cos(2 * PI * k / n), R.c[1] + R.ax[1] * Math.sin(2 * PI * k / n)]);
export const bU = ellipse(U), bV = ellipse(V);
/** Boundary of U ∩ V: the arcs of each ellipse inside the other, as one closed polygon. */
export const bUV = (() => {
  const arc = (b, R) => { const k0 = b.findIndex(q => ell(R, q) > 1); const r = [...b.slice(k0, -1), ...b.slice(0, k0)]; return r.filter(q => ell(R, q) <= 1); };
  return [...arc(bU, V), ...arc(bV, U)];
})();

// vertical scale of the 3D view: z is stretched so that the drawn part of M has the figures' box aspect
export const NG = 56;
const zs = [];
for (let i = 0; i <= NG; i++) for (let j = 0; j <= NG; j++) zs.push(height(-A + 2 * A * i / NG, -A + 2 * A * j / NG));
export const Z0 = Math.min(...zs), Z1 = Math.max(...zs), K = 0.8 * 2 * A / (Z1 - Z0);
export const embed = ([x, y]) => [x, y, K * height(x, y)];
