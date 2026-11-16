// Hand-written (not generated): interactive companion of Figure C.12 (label fig_Example_Variations_length,
// Appendix C.6). Everything comes from Appendices/examples_and_exercises/example_variations_euler_lagrange.tex:
// the paraboloid c = (a^2 + b^2)/4 with the charts X (cartesian) and Y (polar), the meridian gamma
// (lambda in [1, 3]) and the arc of parallel sigma (lambda in [pi/4, 3pi/4]), and for each curve the
// families of variations (i) (linear in X) and (ii) (linear in Y) built with
// phi(l) = (l - 1)(3 - l) and psi(l) = -cos 2l. Lengths are integrals of the speed written in the
// chart that defines each family:  s^2 = a'^2 + b'^2 + (a a' + b b')^2/4  in X,  s^2 = W r'^2 + r^2 th'^2,
// W = 1 + r^2/4,  in Y  (the metric induced by R^3).
import { el, controls, slider, choice, readout, note, legend, setMath, fmt, simpson, Plot2D, Scene3D, vibrant } from './dg.js';
import { typeset } from '../course.js';

const PI = Math.PI;
const phi = l => (l - 1) * (3 - l), dphi = l => 4 - 2 * l;
const psi = l => -Math.cos(2 * l), dpsi = l => 2 * Math.sin(2 * l);
const RUNE = '\\textrm{\\runic ᛊ}';
const TMAX = 1.2;                       // range of the deformation parameter in Figure C.12

// chart representative of each family: [chart, (lambda, t) -> [x1, x2, x1', x2']]
const FAM = {
  gamma: {
    1: ['X', (l, t) => [t * phi(l), l, t * dphi(l), 1]],
    2: ['Y', (l, t) => [l, PI / 2 + t * phi(l), 1, t * dphi(l)]]
  },
  sigma: {
    1: ['X', (l, t) => [2 * Math.cos(l), 2 * Math.sin(l) + t * psi(l), -2 * Math.sin(l), 2 * Math.cos(l) + t * dpsi(l)]],
    2: ['Y', (l, t) => [2 + t * psi(l), l, t * dpsi(l), 1]]
  }
};
const CURVE = {
  gamma: { lam: [1, 3], ends: [['A', [0, 1], [7, 4]], ['B', [0, 3], [7, -6]]],
    L: `L_{[1,3]}[\\gamma_{${RUNE}}]`, name: '\\gamma' },
  sigma: { lam: [PI / 4, 3 * PI / 4], ends: [['P', [Math.SQRT2, Math.SQRT2], [7, -6]], ['Q', [-Math.SQRT2, Math.SQRT2], [-7, -6]]],
    L: `L[\\sigma_{${RUNE}}]`, name: '\\sigma' }
};
const STYLE = { 1: { color: vibrant.blue, dash: null, dash3: null }, 2: { color: vibrant.orange, dash: '7 4', dash3: [7, 4] } };

const speedX = ([a, b, da, db]) => Math.sqrt(da * da + db * db + 0.25 * (a * da + b * db) ** 2);
const speedY = ([r, , dr, dth]) => Math.sqrt((1 + r * r / 4) * dr * dr + r * r * dth * dth);
/** Point of R^3 for a chart representative. */
const embed = (chart, [x1, x2]) => chart === 'X' ? [x1, x2, (x1 * x1 + x2 * x2) / 4] : [x1 * Math.cos(x2), x1 * Math.sin(x2), x1 * x1 / 4];

/** L[curve_t] for family fam (1 = (i), 2 = (ii)) by Simpson's rule on n intervals. */
export function lengthOf(curve, fam, t, n = 600) {
  const [chart, rep] = FAM[curve][fam], [l0, l1] = CURVE[curve].lam;
  const s = chart === 'X' ? speedX : speedY;
  return simpson(l => s(rep(l, t)), l0, l1, n);
}
/** Same length measured as the euclidean length of the embedded polyline (independent check). */
export function embeddedLength(curve, fam, t, n = 20000) {
  const [chart, rep] = FAM[curve][fam], [l0, l1] = CURVE[curve].lam;
  let L = 0, q = embed(chart, rep(l0, t));
  for (let k = 1; k <= n; k++) { const p = embed(chart, rep(l0 + (l1 - l0) * k / n, t)); L += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); q = p; }
  return L;
}
/** Numerical first variation dL/dt at t = 0 (central difference). */
export const firstVariation = (curve, fam, h = 1e-4) => (lengthOf(curve, fam, h) - lengthOf(curve, fam, -h)) / (2 * h);

export default async function mount(body) {
  const st = { curve: 'gamma', fam: 1, t: 0.5 };
  const cache = {};
  const samples = curve => cache[curve] ||= [1, 2].map(f => {
    const pts = [];
    for (let k = -120; k <= 120; k++) { const t = k / 100; pts.push([t, lengthOf(curve, f, t)]); }
    return { pts, L0: lengthOf(curve, f, 0), dL: firstVariation(curve, f) };
  });

  body.append(note(`Choose a curve and a family of variations and move \\(${RUNE}\\); drag the surface to rotate it.`));
  const bar = controls(body);
  const cCurve = choice({ options: [{ value: 'gamma', label: '\\(\\gamma\\)', aria: 'γ' }, { value: 'sigma', label: '\\(\\sigma\\)', aria: 'σ' }], value: st.curve, onChange: v => { st.curve = v; update(true); } });
  const cFam = choice({ options: [{ value: 1, label: '(i)' }, { value: 2, label: '(ii)' }], value: st.fam, onChange: v => { st.fam = +v; update(true); } });
  const sT = slider({ label: `\\(${RUNE}\\)`, aria: 'ᛊ', min: -TMAX, max: TMAX, step: 0.01, value: st.t, onInput: v => { st.t = v; update(false); } });
  bar.append(cCurve.el, cFam.el, sT.el);

  const two = el('div', { class: 'dg-two' });
  const left = el('div', { class: 'dg-panel' }), right = el('div', { class: 'dg-panel' });
  two.append(left, right);
  body.append(two);

  // ---- left: the paraboloid with the curve and its variation
  const scene = new Scene3D(left, { aspect: 0.82, azimuth: -90, elevation: 24, zoom: 1.2, center: [0, 0, 2.2], label: 'M' });
  scene.surface((r, th) => [r * Math.cos(th), r * Math.sin(th), r * r / 4],
    { u: [0, 3.5, 14], v: [-PI + PI / 12, PI + PI / 12, 48],   // meridians of the mesh 15 deg off the curves' meridians
    color: '#cfcfcf', alpha: 0.28, mesh: { color: '#b8b8b8', width: 0.7, everyU: 2, everyV: 4 } });
  const leg3 = el('div');
  left.append(leg3);

  // ---- right: L against the deformation parameter, both families
  const plot = new Plot2D(right, { xlim: [-TMAX, TMAX], ylim: [2.5, 6], aspect: 0.82, margin: { l: 40, r: 10, t: 30, b: 32 }, role: 'group', label: 'Figure C.12', draw: drawPlot });
  const leg2 = el('div');
  right.append(leg2);

  const outs = el('div', { class: 'dg-readouts' });
  const rL = readout({}), rD = readout({});
  outs.append(rL.el, rD.el);
  body.append(outs);

  function drawPlot(p) {
    const S = samples(st.curve);
    p.line([[0, p.o.ylim[0]], [0, p.o.ylim[1]]], { color: '#000', width: 0.8 });
    for (const s of S) p.line([[-0.45, s.L0 - 0.45 * s.dL], [0.45, s.L0 + 0.45 * s.dL]], { color: '#777', width: 1 });   // tangent lines at 0
    if (st.curve === 'sigma') p.fn(t => PI + t + PI / 2 * t * t, -TMAX, TMAX, { color: '#000', width: 1, dash: '1.5 2.5' });
    S.forEach((s, f) => p.line(s.pts, { color: STYLE[f + 1].color, width: 2, dash: STYLE[f + 1].dash }));
    p.point([0, S[0].L0], { r: 3.5, fill: '#000' });
    p.label('x', [TMAX, p.o.ylim[0]], `\\(${RUNE}\\)`, { anchor: 'se', dx: -4, dy: -4, class: 'dg-axis-label' });
    p.label('y', [-TMAX, p.o.ylim[1]], `\\(${CURVE[st.curve].L}\\)`, { anchor: 'sw', dx: -34, dy: -4, class: 'dg-axis-label' });
    const L = lengthOf(st.curve, st.fam, st.t);
    p.handle([st.t, L], { key: 'marker', r: 6, fill: STYLE[st.fam].color, stroke: '#fff', strokeWidth: 2, ariaLabel: 'ᛊ', step: [0.01, 0],
      onDrag: x => sT.set(Math.round(Math.max(-TMAX, Math.min(TMAX, x)) * 100) / 100) });
  }

  function setYlim() {
    const ys = samples(st.curve).flatMap(s => s.pts.map(q => q[1]));
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (st.curve === 'sigma') hi = Math.max(hi, PI + TMAX + PI / 2 * TMAX * TMAX);
    const pad = 0.06 * (hi - lo);
    plot.o.ylim = [lo - pad, hi + pad];
  }

  function drawScene() {
    const c = CURVE[st.curve], [chart, rep] = FAM[st.curve][st.fam], [l0, l1] = c.lam, N = 160;
    const curve = t => { const pts = []; for (let k = 0; k <= N; k++) pts.push(embed(chart, rep(l0 + (l1 - l0) * k / N, t))); return pts; };
    scene.clear('c');
    scene.polyline(curve(0), { color: '#000', width: 2, tag: 'c' });
    if (st.t !== 0) scene.polyline(curve(st.t), { color: STYLE[st.fam].color, width: 2.4, dash: STYLE[st.fam].dash3, tag: 'c' });
    for (const [name, [a, b], off] of c.ends) scene.point([a, b, (a * a + b * b) / 4], { r: 3.5, color: '#000', label: name, offset: off, tag: 'c' });
    scene.render();
  }

  async function update(changedSet) {
    drawScene();
    if (changedSet) setYlim();
    plot.update();
    rL.set(fmt(lengthOf(st.curve, st.fam, st.t), 4));
    if (changedSet) {
      const c = CURVE[st.curve], fam = st.fam === 1 ? '(i)' : '(ii)';
      rD.set(fmt(samples(st.curve)[st.fam - 1].dL, 4));
      const s = STYLE[st.fam];
      leg3.replaceChildren(legend([{ label: `\\(${c.name}\\)`, color: '#000' }, { label: `\\(${c.name}_{${RUNE}}\\)`, color: s.color, dash: s.dash }]));
      const items = [{ label: '(i) linear in \\(\\mathscr{X}\\)', color: STYLE[1].color }, { label: '(ii) linear in \\(\\mathscr{Y}\\)', color: STYLE[2].color, dash: STYLE[2].dash }];
      if (st.curve === 'sigma') items.push({ label: '(ii), second-order expansion', color: '#000', dash: '1.5 2.5', width: 1.2 });
      leg2.replaceChildren(legend(items));
      await Promise.all([
        rL.setLabel(`\\(${c.L}\\)`),
        rD.setLabel(`\\(\\text{${fam}} \\;\\; \\frac{d}{d${RUNE}} ${c.L} \\Big|_{${RUNE}=0}\\)`),
        typeset(leg3), typeset(leg2)
      ]);
    }
  }
  await typeset(body);
  await update(true);
}
