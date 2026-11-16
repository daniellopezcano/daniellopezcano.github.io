// Hand-written (not generated): interactive companion of Figure 4.2 (label
// fig_TpM_curves_velocities_and_chart_transitions, §4.1.1). The geometry is the figure's, read from the
// package notebook notebooks/2_3_TpM.ipynb and the functions it calls (github.com/daniellopezcano/
// differential_geometry): the surface M, the charts (U, X), (V, Y) and the 3D scale are in eggs.js (shared with
// charts.js, Figure 3.1, whose notebook defines them identically); p = (pi/4, 0).
// gamma is the straight line X(gamma(lambda)) = X(p) + lambda u (u = (0, 1): factory_curve_vertical), delta
// the circle about the origin through p (factory_curve_circle). Components (§4.1.1): in X, the derivative of
// the chart representative at lambda_0; in Y, the Jacobian (dY^k/dX^i)_p of Y o X^-1 at X(p) times those.
import { el, controls, choice, readout, note, legend, matrix, setMath, fmt, Plot2D, Scene3D, tol } from './dg.js';
import { typeset } from '../course.js';
import { PI, A, U, V, height, Y, Yinv, jacobian, ell, inUV, bU, bV, bUV, NG, Z0, Z1, K, embed } from './eggs.js';
export { height, Y, Yinv, jacobian, inUV };

const C = { M: tol.grey, U: tol.blue, V: tol.red, gamma: '#000000', delta: tol.yellow, plane: '#555555' };
const P0 = [PI / 4, 0], U0 = [0, 1], UMIN = 0.25, UMAX = 1.25;  // starting point and velocity; range of |u|

const mul = (J, u) => [J[0][0] * u[0] + J[0][1] * u[1], J[1][0] * u[0] + J[1][1] * u[1]];
/** Chart representatives in X, lambda -> X(curve(lambda)), with lambda_0 (curve(lambda_0) = p). */
export const curves = {
  gamma: (p, u) => ({ at: l => [p[0] + l * u[0], p[1] + l * u[1]], l0: 0 }),
  delta: p => { const R = Math.hypot(p[0], p[1]); return { at: l => [R * Math.cos(l), R * Math.sin(l)], l0: Math.atan2(p[1], p[0]) }; }
};
/** Components of the velocity at p in X (derivative of the chart representative) and in Y (§4.1.1 law). */
export function components(name, p, u) {
  const cU = name === 'gamma' ? u.slice() : [-p[1], p[0]];
  return { U: cU, V: mul(jacobian(p), cU) };
}

const box = pts => [[Math.min(...pts.map(q => q[0])), Math.max(...pts.map(q => q[0]))], [Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[1]))]];
// panel limits: the chart images of U and V, and room for the arrows drawn from any p of U ∩ V
function limits(chart, reach) {
  const [bx, by] = box([...bU, ...bV].map(chart)), [ox, oy] = box(bUV.map(chart));
  const lim = [[Math.min(bx[0], ox[0] - reach), Math.max(bx[1], ox[1] + reach)], [Math.min(by[0], oy[0] - reach), Math.max(by[1], oy[1] + reach)]];
  return lim.map(([a, b]) => [a - 0.04 * (b - a), b + 0.04 * (b - a)]);
}
const reachX = Math.max(UMAX, ...bUV.map(q => Math.hypot(...q)));
const LX = limits(q => q, reachX), LY = limits(Y, reachX * Math.max(1, ...bUV.map(q => 1 / Y(q)[0])));
// the colour of each part of M
const mix = (a, b) => '#' + [1, 3, 5].map(k => Math.round((parseInt(a.substr(k, 2), 16) + parseInt(b.substr(k, 2), 16)) / 2).toString(16).padStart(2, '0')).join('');
const C_UV = mix(C.U, C.V);
const regionColour = (x, y) => { const u = ell(U, [x, y]) < 1, v = ell(V, [x, y]) < 1; return u && v ? C_UV : u ? C.U : v ? C.V : C.M; };
/** Tangent vectors of the embedding at q: [d/dx, d/dy] (central differences). */
function frame3([x, y], h = 1e-5) {
  const zx = (height(x + h, y) - height(x - h, y)) / (2 * h), zy = (height(x, y + h) - height(x, y - h)) / (2 * h);
  return [[1, 0, K * zx], [0, 1, K * zy]];
}
/** Polyline split into the runs that stay inside the box [xl, yl] and do not jump (theta crossing its cut). */
function runs(pts, [xl, yl]) {
  const out = []; let cur = [];
  pts.forEach((q, k) => {
    const inside = q[0] >= xl[0] && q[0] <= xl[1] && q[1] >= yl[0] && q[1] <= yl[1];
    const jump = k && Math.abs(q[1] - pts[k - 1][1]) > PI;
    if (!inside || jump) { if (cur.length > 1) out.push(cur); cur = []; }
    if (inside) cur.push(q);
  });
  if (cur.length > 1) out.push(cur);
  return out;
}
/** Points of a curve (in X) on the drawn part of M, [-A, A]^2. */
function samples(name, p, u) {
  const c = name === 'gamma' ? curves.gamma(p, u) : curves.delta(p);
  let a = -PI, b = PI;
  if (name === 'gamma') {
    a = -Infinity; b = Infinity;
    for (const k of [0, 1]) if (u[k]) { const s = [(-A - p[k]) / u[k], (A - p[k]) / u[k]].sort((m, n) => m - n); a = Math.max(a, s[0]); b = Math.min(b, s[1]); }
  }
  return Array.from({ length: 241 }, (_, k) => c.at(a + (b - a) * k / 240));
}

export default async function mount(body) {
  const st = { p: P0.slice(), u: U0.slice(), sel: 'gamma' };
  const name = { gamma: '\\gamma', delta: '\\delta' };

  body.append(note('Drag \\(p\\) or the tip of the velocity of \\(\\gamma\\) in either chart; drag the surface to rotate it.'));
  const bar = controls(body);
  const cSel = choice({ options: [{ value: 'gamma', label: '\\(\\gamma\\)', aria: 'γ' }, { value: 'delta', label: '\\(\\delta\\)', aria: 'δ' }], value: st.sel, onChange: v => { st.sel = v; update(true); } });
  bar.append(cSel.el);

  const stage = el('div', { class: 'dg-tpm' });
  const top = el('div', { class: 'dg-tpm-scene' });
  const scene = new Scene3D(top, { aspect: 0.62, azimuth: -50, elevation: 40, zoom: 1.45, center: [0, 0, K * (Z0 + Z1) / 2], radius: Math.hypot(A, A, K * (Z1 - Z0) / 2), label: 'ℳ' });
  scene.surface((x, y) => embed([x, y]), { u: [-A, A, NG], v: [-A, A, NG], color: regionColour, alpha: 0.4 });
  for (const [b, col] of [[bU, C.U], [bV, C.V]]) scene.polyline(b.map(embed), { color: col, width: 1.4, dash: [6, 4] });
  top.append(legend([{ label: '\\(\\gamma\\)', color: C.gamma }, { label: '\\(\\delta\\)', color: C.delta },
    { label: '\\(T_p\\mathcal{M}\\)', color: C.plane, width: 8 }, { label: '\\(\\mathcal{U}\\)', color: C.U, width: 8 },
    { label: '\\(\\mathcal{V}\\)', color: C.V, width: 8 }, { label: '\\(\\mathcal{U} \\cap \\mathcal{V}\\)', color: C_UV, width: 8 }]));

  const two = el('div', { class: 'dg-two' });
  const left = el('div', { class: 'dg-panel' }), right = el('div', { class: 'dg-panel' });
  two.append(left, right);
  stage.append(top, two);
  body.append(stage);
  const margin = { l: 34, r: 10, t: 26, b: 30 };
  const charts = [
    { key: 'X', map: q => q, inv: q => q, lim: LX, title: '(\\mathcal{U}, \\mathscr{X})', ax: '\\mathscr{X}', name: '(𝒰, 𝒳)', parent: left },
    { key: 'Y', map: Y, inv: Yinv, lim: LY, title: '(\\mathcal{V}, \\mathscr{Y})', ax: '\\mathscr{Y}', name: '(𝒱, 𝒴)', parent: right }
  ];
  for (const ch of charts) {
    ch.plot = new Plot2D(ch.parent, { xlim: ch.lim[0], ylim: ch.lim[1], equal: true, margin, role: 'group', label: ch.name, draw: p => drawChart(p, ch) });
  }

  const outs = el('div', { class: 'dg-readouts' });
  const rX = readout({ label: '\\(\\mathscr{X}(p)\\)' }), rY = readout({ label: '\\(\\mathscr{Y}(p)\\)' });
  outs.append(rX.el, rY.el);
  const law = el('div', { class: 'dg-law' });
  const mV = matrix(2, 1), mJ = matrix(2, 2), mU = matrix(2, 1);
  const lawTex = el('div');
  law.append(lawTex, el('div', { class: 'dg-eqrow' }, mV.el, '=', mJ.el, '·', mU.el));
  body.append(outs, law);

  function setP(q) {                                      // p stays in U ∩ V: stop at its boundary
    if (!inUV(q)) {
      let lo = st.p, hi = q;
      for (let k = 0; k < 40; k++) { const m = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]; if (inUV(m)) lo = m; else hi = m; }
      q = lo;
    }
    st.p = q; update(false);
  }
  function setU(u) {
    const n = Math.hypot(u[0], u[1]);
    if (!n) return;
    const s = Math.max(UMIN, Math.min(UMAX, n)) / n;
    st.u = [u[0] * s, u[1] * s]; update(false);
  }

  function drawChart(pl, ch) {
    const { lim } = ch, bounds = [pl.o.xlim, pl.o.ylim];
    for (const [b, col, nm, low] of [[bU, C.U, 'U', true], [bV, C.V, 'V', false]]) {   // labels: below U, inside the right end of V
      const img = b.map(ch.map);
      pl.area(img, { fill: col, opacity: 0.3, color: col, dash: '5 4' });
      const at = img.reduce((m, q) => (low ? q[1] < m[1] : q[0] > m[0]) ? q : m);
      pl.label('r' + nm, at, `\\(${ch.ax}(\\mathcal{${nm}})\\)`, { anchor: low ? 'n' : 'e', dx: low ? 0 : -5, dy: low ? 3 : 0, color: col });
    }
    for (const c of ['gamma', 'delta']) for (const r of runs(samples(c, st.p, st.u).map(ch.map), bounds)) pl.line(r, { color: C[c], width: 2 });
    const P = ch.map(st.p), J = ch.key === 'X' ? null : jacobian(st.p);
    for (const c of st.sel === 'gamma' ? ['delta', 'gamma'] : ['gamma', 'delta']) {   // the selected curve's velocity on top
      const v = components(c, st.p, st.u)[ch.key === 'X' ? 'U' : 'V'];
      pl.arrow(P, [P[0] + v[0], P[1] + v[1]], { color: C[c], width: c === st.sel ? 2.8 : 1.6, head: c === st.sel ? 11 : 9, class: 'dg-inert' });
    }
    const w = J ? mul(J, st.u) : st.u;
    pl.handle([P[0] + w[0], P[1] + w[1]], { key: 'tip', r: 9, fill: 'transparent', stroke: C.gamma, strokeWidth: 1.5, ariaLabel: 'γ̇',
      onDrag: (x, y) => { const d = [x - P[0], y - P[1]]; setU(J ? mul(inverse(J), d) : d); } });
    pl.handle(P, { key: 'p', r: 6.5, fill: '#000', stroke: '#fff', strokeWidth: 1.5, ariaLabel: 'p', onDrag: (x, y) => setP(ch.inv([x, y])) });
    pl.label('x', [lim[0][1], pl.o.ylim[0]], `\\(${ch.ax}^1\\)`, { anchor: 'se', dx: -4, dy: -4, class: 'dg-axis-label' });
    pl.label('y', [pl.o.xlim[0], pl.o.ylim[1]], `\\(${ch.ax}^2\\)`, { anchor: 'nw', dx: 5, dy: 4, class: 'dg-axis-label' });
    pl.label('t', [(pl.o.xlim[0] + pl.o.xlim[1]) / 2, pl.o.ylim[1]], `\\(${ch.title}\\)`, { anchor: 's', dy: -5 });
  }
  const inverse = J => { const d = J[0][0] * J[1][1] - J[0][1] * J[1][0]; return [[J[1][1] / d, -J[0][1] / d], [-J[1][0] / d, J[0][0] / d]]; };

  function drawScene() {
    const P = embed(st.p), [ex, ey] = frame3(st.p), s = 1.6;  // the notebook's tangent plane: p + s e_x + t e_y, |s|, |t| <= 1.6
    scene.clear('c');
    scene.surface((a, b) => [0, 1, 2].map(k => P[k] + a * ex[k] + b * ey[k]), { u: [-s, s, 6], v: [-s, s, 6], color: C.plane, alpha: 0.2, tag: 'c' });
    for (const c of ['gamma', 'delta']) {
      scene.polyline(samples(c, st.p, st.u).map(embed), { color: C[c], width: 2.2, tag: 'c' });
      const v = components(c, st.p, st.u).U;
      scene.arrow(P, [0, 1, 2].map(k => P[k] + v[0] * ex[k] + v[1] * ey[k]), { color: C[c], width: c === st.sel ? 3 : 1.8, tag: 'c' });
    }
    scene.point(P, { r: 4.5, color: '#000', label: 'p', offset: [-8, -8], tag: 'c' });
    scene.render();
  }

  async function update(retex) {
    drawScene();
    for (const ch of charts) ch.plot.update();
    const c = components(st.sel, st.p, st.u), y = Y(st.p);
    rX.set(`(${fmt(st.p[0], 3)}, ${fmt(st.p[1], 3)})`);
    rY.set(`(${fmt(y[0], 3)}, ${fmt(y[1], 3)})`);
    mV.set([[c.V[0]], [c.V[1]]]); mJ.set(jacobian(st.p)); mU.set([[c.U[0]], [c.U[1]]]);
    stage.dataset.state = JSON.stringify(st);
    if (retex) {
      const g = name[st.sel];
      await setMath(lawTex, `\\(\\displaystyle \\dot{${g}}^k_{\\mathcal{V}}(\\lambda_0) = \\sum_{i=1}^{d} \\left( \\frac{\\partial \\mathscr{Y}^k}{\\partial \\mathscr{X}^i} \\right)_{p} \\cdot \\dot{${g}}^i_{\\mathcal{U}}(\\lambda_0)\\)`);
    }
  }
  await typeset(body);
  await update(true);
}
