// Hand-written (not generated): interactive companion of Figure 3.1 (label fig_chart_transition_maps, §3.2).
// The geometry is the figure's, read from the package notebook notebooks/2_1_charts.ipynb ("2D-mfd embedded in 3D")
// and the functions it calls: the surface M, the charts (U, X) (identity on the parameters) and (V, Y) (polar
// coordinates about (-1, -1)) and the 3D scale are in eggs.js (shared with tpm.js, whose notebook defines them
// identically). The colours are those of the figure image: U blue, V red, U ∩ V green (dotted boundary), the
// transition-map arrow green. The panels' ranges are the figure's: [-pi^2/3, pi^2/3]^2 for X, Y^1 in [-0.2, 5.5]
// and Y^2 in [-pi - 0.2, pi + 0.2] for Y, with the lines Y^1 = 0 and Y^2 = ±pi (the edges of the polar chart's range).
// One point p of U ∪ V, shown on M and, where it is defined, as X(p) and Y(p); the transition maps of §3.2,
// ᛖ_UV = Y o X^-1 : X(U ∩ V) -> Y(U ∩ V) and ᛖ_VU = X o Y^-1 : Y(U ∩ V) -> X(U ∩ V), relate the two labels.
import { el, readout, note, legend, setMath, fmt, Plot2D, Scene3D, tol } from './dg.js';
import { typeset } from '../course.js';
import { PI, A, U, V, Y, Yinv, inU, inV, bU, bV, bUV, NG, Z0, Z1, K, embed } from './eggs.js';
export { Y, Yinv, inU, inV };

const C = { M: tol.grey, U: tol.blue, V: tol.red, UV: tol.green, cut: '#888888' };
const P0 = [0.6, -0.3];                                   // starting point, in U ∩ V
/** The chart X (identity on the parameters) and the transition maps of §3.2. */
export const X = q => [q[0], q[1]], Xinv = a => [a[0], a[1]];
export const tUV = a => Y(Xinv(a));                       // ᛖ_UV = Y o X^-1
export const tVU = b => X(Yinv(b));                       // ᛖ_VU = X o Y^-1
/** Membership of chart coordinates in the chart images X(U) and Y(V) (Y: r > 0, theta in (-pi, pi]). */
export const inXU = a => inU(Xinv(a));
export const inYV = ([r, t]) => r > 0 && t > -PI && t <= PI && inV(Yinv([r, t]));
const inUorV = q => inU(q) || inV(q);
/** The point of the segment from -> to that is last inside `inside` (bisection; from is inside). */
function stop(inside, from, to) {
  if (inside(to) || !inside(from)) return inside(to) ? to : from;
  let lo = from, hi = to;
  for (let k = 0; k < 44; k++) { const m = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2]; if (inside(m)) lo = m; else hi = m; }
  return lo;
}
const regionColour = (x, y) => { const u = inU([x, y]), v = inV([x, y]); return u && v ? C.UV : u ? C.U : v ? C.V : C.M; };

export default async function mount(body) {
  const st = { p: P0.slice() };
  body.append(note('Drag \\(p\\) on the surface, or \\(\\mathscr{X}(p)\\) or \\(\\mathscr{Y}(p)\\) in the charts; drag elsewhere on the surface to rotate it.'));

  const stage = el('div', { class: 'dg-charts' });
  const top = el('div', { class: 'dg-charts-scene' });
  const scene = new Scene3D(top, { aspect: 0.5, azimuth: -50, elevation: 40, zoom: 1.7, center: [0, 0, K * (Z0 + Z1) / 2], radius: Math.hypot(A, A, K * (Z1 - Z0) / 2), label: 'ℳ', grab });
  scene.surface((x, y) => embed([x, y]), { u: [-A, A, NG], v: [-A, A, NG], color: regionColour, alpha: 0.4 });
  scene.polyline(bU.map(embed), { color: C.U, width: 1.4, dash: [6, 4] });
  scene.polyline(bV.map(embed), { color: C.V, width: 1.4, dash: [6, 4] });
  scene.polyline([...bUV, bUV[0]].map(embed), { color: C.UV, width: 2.6, dash: [0.5, 4.5] });
  top.append(legend([{ label: '\\(\\mathcal{U}\\)', color: C.U, width: 8 }, { label: '\\(\\mathcal{V}\\)', color: C.V, width: 8 },
    { label: '\\(\\mathcal{U} \\cap \\mathcal{V}\\)', color: C.UV, width: 8 }]));

  // the two charts with the transition maps between them, as the arrow between the charts of Figure 3.1
  const row = el('div', { class: 'dg-ch-row' });
  const left = el('div', { class: 'dg-panel' }), right = el('div', { class: 'dg-panel' });
  const T = (s, t) => `\\textstyle \\textrm{\\runic ᛖ}_{\\mathcal{${s}}\\mathcal{${t}}} = \\mathscr{${t === 'V' ? 'Y' : 'X'}} \\circ \\mathscr{${t === 'V' ? 'X' : 'Y'}}^{-1}`;
  const G = x => `{\\color{${C.UV}}${x}}`;
  const arrows = el('div', { class: 'dg-ch-arrows' },
    el('span', { class: 'dg-ch-h' }, `\\(\\overset{${T('U', 'V')}}{${G(`\\xrightarrow{\\hphantom{${T('U', 'V')}}}`)}}\\)`),
    el('span', { class: 'dg-ch-h' }, `\\(\\underset{${T('V', 'U')}}{${G(`\\xleftarrow{\\hphantom{${T('V', 'U')}}}`)}}\\)`),
    el('span', { class: 'dg-ch-v' }, `\\(${G('\\Big\\downarrow')}\\; ${T('U', 'V')} \\qquad ${T('V', 'U')} \\; ${G('\\Big\\uparrow')}\\)`));
  row.append(left, arrows, right);
  stage.append(top, row);
  body.append(stage);
  const margin = { l: 34, r: 12, t: 24, b: 22 };            // l + r = t + b: the plot areas are square
  const charts = [
    { key: 'X', map: X, inv: Xinv, inside: inXU, has: inU, lim: [[-A, A], [-A, A]], dom: 'U', title: '(\\mathcal{U}, \\mathscr{X})', ax: '\\mathscr{X}', name: '(𝒰, 𝒳)', aria: '𝒳(p)', parent: left },
    { key: 'Y', map: Y, inv: Yinv, inside: inYV, has: inV, lim: [[-0.2, 5.5], [-PI - 0.2, PI + 0.2]], dom: 'V', title: '(\\mathcal{V}, \\mathscr{Y})', ax: '\\mathscr{Y}', name: '(𝒱, 𝒴)', aria: '𝒴(p)', parent: right }
  ];
  for (const ch of charts) {
    ch.plot = new Plot2D(ch.parent, { xlim: ch.lim[0], ylim: ch.lim[1], equal: ch.key === 'X', aspect: 1, maxWidth: 360, margin, role: 'group', label: ch.name, draw: p => drawChart(p, ch) });
  }
  // under each chart, the label of p in it (or p ∉ its domain)
  const ends = charts.map(ch => {
    const r = readout({ label: `\\(${ch.ax}(p)\\)` }), out = el('span', { class: 'dg-ch-out', hidden: true });
    out.textContent = `\\(p \\notin \\mathcal{${ch.dom}}\\)`;
    ch.parent.append(el('div', { class: 'dg-ch-end' }, r.el, out));
    return { r, out };
  });

  function setP(q) { st.p = q; update(); }

  function drawChart(pl, ch) {
    const [xl, yl] = [pl.o.xlim, pl.o.ylim];
    if (ch.key === 'Y') {                                   // outside the range of the polar chart: r <= 0, |theta| >= pi
      for (const box of [[[xl[0], yl[0]], [0, yl[0]], [0, yl[1]], [xl[0], yl[1]]], [[0, PI], [xl[1], PI], [xl[1], yl[1]], [0, yl[1]]], [[0, yl[0]], [xl[1], yl[0]], [xl[1], -PI], [0, -PI]]])
        pl.area(box, { fill: C.cut, opacity: 0.18 });
      for (const l of [[[0, yl[0]], [0, yl[1]]], [[xl[0], PI], [xl[1], PI]], [[xl[0], -PI], [xl[1], -PI]]]) pl.line(l, { color: C.cut, width: 1, dash: '4 3' });
    }
    // the images of U, V and U ∩ V; labels below U, inside the right end of V, above U ∩ V (the figure: at its centre, where p starts)
    for (const [b, col, nm, at] of [[bU, C.U, '\\mathcal{U}', 'low'], [bV, C.V, '\\mathcal{V}', 'right'], [bUV, C.UV, '\\mathcal{U} \\cap \\mathcal{V}', 'mid']]) {
      const img = b.map(ch.map), uv = at === 'mid';
      pl.area(img, { fill: col, opacity: uv ? 0.35 : 0.3, color: col, dash: uv ? '1.5 3.5' : '5 4', width: uv ? 2.4 : 1.2 });
      const c = img.reduce((s, q) => [s[0] + q[0] / img.length, s[1] + q[1] / img.length], [0, 0]);
      const q = img.reduce((m, q) => (at === 'low' ? q[1] < m[1] : at === 'mid' ? q[1] > m[1] : q[0] > m[0]) ? q : m);
      pl.label('r' + at, at === 'mid' ? [c[0], q[1]] : q, `\\(${ch.ax}(${nm})\\)`, { anchor: at === 'low' ? 'n' : at === 'right' ? 'e' : 's', dx: at === 'right' ? -5 : 0, dy: at === 'low' ? 3 : at === 'mid' ? -2 : 0, color: uv ? '#1a6b28' : col });
    }
    if (ch.has(st.p)) {
      const P = ch.map(st.p);
      pl.handle(P, { key: 'p', r: 6.5, fill: '#000', stroke: '#fff', strokeWidth: 1.5, ariaLabel: ch.aria,
        onDrag: (x, y) => setP(ch.inv(stop(ch.inside, ch.map(st.p), [x, y]))) });
    } else pl.label('out', [xl[1], yl[1]], `\\(p \\notin \\mathcal{${ch.dom}}\\)`, { anchor: 'ne', dx: -6, dy: 5, class: 'dg-ch-plabel' });
    pl.label('x', [xl[1], yl[0]], `\\(${ch.ax}^1\\)`, { anchor: 'se', dx: -4, dy: -4, class: 'dg-axis-label' });
    pl.label('y', [xl[0], yl[1]], `\\(${ch.ax}^2\\)`, { anchor: 'nw', dx: 5, dy: 4, class: 'dg-axis-label' });
    pl.label('t', [(xl[0] + xl[1]) / 2, yl[1]], `\\(${ch.title}\\)`, { anchor: 's', dy: -4 });
  }

  // picking on the 3D view: the quads of the drawn mesh whose projection contains the pointer, the one nearest the
  // viewer, then Newton's method on proj(embed(q)) = pointer from the point found there
  function pick(x, y) {
    const { proj } = scene.view(), n = NG, P = [];
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) P.push([proj(embed([-A + 2 * A * i / n, -A + 2 * A * j / n])), [i, j]]);
    let best = null;
    const tri = (a, b, c) => {
      const [[ax, ay, az], ia] = a, [[bx, by, bz], ib] = b, [[cx, cy, cz], ic] = c;
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (!d) return;
      const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d, l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) return;
      const z = l1 * az + l2 * bz + l3 * cz;
      if (!best || z > best.z) best = { z, q: [0, 1].map(k => -A + 2 * A * (l1 * ia[k] + l2 * ib[k] + l3 * ic[k]) / n) };
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = P[i * (n + 1) + j], b = P[(i + 1) * (n + 1) + j], c = P[(i + 1) * (n + 1) + j + 1], d = P[i * (n + 1) + j + 1];
      tri(a, b, c); tri(a, c, d);
    }
    if (!best) return null;
    let q = best.q;
    const f = q => proj(embed(q)), h = 1e-6;
    for (let k = 0; k < 8; k++) {
      const s = f(q), ex = s[0] - x, ey = s[1] - y;
      if (Math.hypot(ex, ey) < 1e-4) break;
      const su = f([q[0] + h, q[1]]), sv = f([q[0], q[1] + h]);
      const a = (su[0] - s[0]) / h, b = (sv[0] - s[0]) / h, c = (su[1] - s[1]) / h, d = (sv[1] - s[1]) / h, det = a * d - b * c;
      if (!det) break;
      const nq = [q[0] - (d * ex - b * ey) / det, q[1] - (-c * ex + a * ey) / det];
      if (Math.hypot(nq[0] - best.q[0], nq[1] - best.q[1]) > 4 * A / n) break;   // stay on the sheet that was hit
      q = nq;
    }
    return q;
  }
  function grab(x, y) {
    const s = scene.project(embed(st.p));
    if (Math.hypot(s[0] - x, s[1] - y) > 14) return null;
    return (x, y) => { const q = pick(x, y); if (q) setP(stop(inUorV, st.p, q)); };
  }

  function drawScene() {
    scene.clear('p');
    scene.point(embed(st.p), { r: 5, color: '#000', label: 'p', offset: [-9, -9], tag: 'p' });
    scene.render();
  }

  function update() {
    drawScene();
    for (const ch of charts) ch.plot.update();
    const a = X(st.p), uIn = inU(st.p), vIn = inV(st.p);
    // the label in Y is the transition map applied to the label in X (both exist on U ∩ V); else Y(p) itself
    const b = uIn && vIn ? tUV(a) : Y(st.p);
    for (const [k, on, v] of [[0, uIn, a], [1, vIn, b]]) {
      ends[k].r.el.hidden = !on; ends[k].out.hidden = on;
      ends[k].r.set(`(${fmt(v[0], 3)}, ${fmt(v[1], 3)})`);
    }
    arrows.classList.toggle('dg-ch-off', !(uIn && vIn));
    const s = scene.project(embed(st.p));
    stage.dataset.state = JSON.stringify({ p: st.p, inU: uIn, inV: vIn, p3: [s[0], s[1]] });
  }
  await typeset(body);
  update();
}
