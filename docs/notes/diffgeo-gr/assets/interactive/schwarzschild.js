// Hand-written (not generated): interactive after Figure C.19 (label fig_Example_Schwarzschild), Appendix C.9. No notebook.
// Everything comes from C.9 (Appendices/examples_and_exercises/example_GR.tex): r_S := 2 G_N M, ℳ = ℝ × (r_S, ∞) × S², the
// chart (t, r, θ, φ) with (g_ij) = diag(f, −1/f, −r², −r² sin²θ), f(r) = 1 − r_S/r; "What the coordinate r measures": the
// slice t = const, θ = π/2 drawn with the radius of each circle equal to its coordinate r (Figure C.19a), the length of a
// radial segment ∫_{r1}^{r2} dr √|g_11| = ∫ dr/√f > r2 − r1, whose ratio to r2 − r1 for a short segment is about 1/√f(r1),
// which diverges as r1 → r_S, while the length from r_S to any r2 stays finite; the components g_00 = f and −g_11 = 1/f
// (Figure C.19b). The integral is computed numerically (Simpson) after the substitution r = r_S + w², which removes the
// integrable 1/√(r − r_S) at r_S: ∫ dr/√f = ∫ 2 √(r_S + w²) dw. The circles (blue) are at equal radial distances ELL from
// each other, the first at ELL from r_S, as in Figure C.19a (whose circles are those of r_S = 1, ELL = 0.6, i.e. 0.6 r_S);
// the dashed grey circles are at r_S + k ELL, equal differences of the coordinate r. r1 and r2 are kept in (r_S, RD].
import { el, controls, slider, note, legend, fmt, simpson, Plot2D } from './dg.js';
import { typeset } from '../course.js';

export const START = { rS: 1, r1: 1.2, r2: 2.2 };
export const ELL = 0.6, RD = 4, RS = [0.2, 1.5], GAP = 0.01;
const ANG = 30 * Math.PI / 180, YB = [0, 3.2];
// the notes' figure colours (main.tex): blue_1 (circles, g_00), orange_1 (−g_11); text in the darker shades of course.css
const C = { blue: '#3859bd', orange: '#d68b02', orangeT: '#a16600', grey: '#9a9a9a', disc: '#e0e0e0', seg: '#6c026c' };

/** f(r) = 1 − r_S/r. */
export const f = (r, rS) => 1 - rS / r;
/** ∫_{r1}^{r2} dr/√f (r_S <= r1 <= r2), with r = r_S + w². */
export const dist = (rS, r1, r2) => simpson(w => 2 * Math.sqrt(rS + w * w), Math.sqrt(r1 - rS), Math.sqrt(r2 - rS), 200);
/** The r at radial distance D from r_S (bisection; the radial distance is at least r − r_S, so r <= r_S + D). */
export function radiusAt(rS, D) {
  let a = rS, b = rS + D;
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (dist(rS, rS, m) < D) a = m; else b = m; }
  return (a + b) / 2;
}
/** Radii of the blue circles (equal radial distances) and of the grey ones (equal coordinate differences) inside RD. */
export function circles(rS) {
  const blue = [], grey = [];
  for (let k = 1; ; k++) { const r = radiusAt(rS, k * ELL); if (r > RD) break; blue.push(r); }
  for (let k = 1; rS + k * ELL <= RD + 1e-9; k++) grey.push(rS + k * ELL);
  return { blue, grey };
}
const r2d = x => Math.round(x * 100) / 100;
/** r1, r2 inside (r_S, RD], r1 < r2, on a grid of 0.01. */
export function clampR(st) {
  const lo = r2d(st.rS + GAP + 0.004);
  st.r1 = Math.min(RD - GAP, Math.max(lo, r2d(st.r1)));
  st.r2 = Math.min(RD, Math.max(r2d(st.r1 + GAP), r2d(st.r2)));
  return st;
}
/** Everything the panel shows. */
export function at(st) {
  const { rS, r1, r2 } = st, L = dist(rS, r1, r2);
  return { f1: f(r1, rS), f2: f(r2, rS), dr: r2 - r1, L, ratio: L / (r2 - r1), inv1: 1 / Math.sqrt(f(r1, rS)), LS: dist(rS, rS, r2) };
}

export default async function mount(body) {
  const st = clampR(JSON.parse(JSON.stringify(START)));
  body.append(note('Drag \\(r_1\\) or \\(r_2\\) along the radius, and change \\(r_S\\).'));
  const bar = controls(body);
  const sS = slider({ label: '\\(r_S\\)', aria: 'r_S', min: RS[0], max: RS[1], step: 0.05, value: st.rS, onInput: v => { st.rS = v; clampR(st); update(); } });
  sS.el.classList.add('dg-gr-rs');
  bar.append(sS.el);

  const stage = el('div', { class: 'dg-gr dg-sch' });
  const two = el('div', { class: 'dg-two' }), left = el('div', { class: 'dg-panel' }), right = el('div', { class: 'dg-panel' });
  two.append(left, right); stage.append(two); body.append(stage);
  const W = RD + 0.25;
  const tex = s => el('span', { class: 'dg-gr-tex' }, `\\(${s}\\)`);
  const val = () => el('span', { class: 'dg-gr-val' });
  const pair = (...c) => el('span', { class: 'dg-gr-pair' }, ...c);
  const row = (...c) => el('div', { class: 'dg-eqrow dg-gr-row' }, ...c);
  const v = { r1: val(), f1: val(), g1: val(), r2: val(), f2: val(), g2: val(), dr: val(), L: val(), ratio: val(), inv1: val(), LS: val() };
  const I = (a, b) => `\\int_{${a}}^{${b}} dr / \\sqrt{f}`;
  const boxB = el('div');
  right.append(boxB, el('div', { class: 'dg-gr-out' },
    row(pair(tex('r_1 ='), v.r1), pair(tex('g_{00}(r_1) ='), v.f1), pair(tex('g_{11}(r_1) ='), v.g1)),
    row(pair(tex('r_2 ='), v.r2), pair(tex('g_{00}(r_2) ='), v.f2), pair(tex('g_{11}(r_2) ='), v.g2)),
    row(pair(tex('r_2 - r_1 ='), v.dr), pair(tex(`\\int_{r_1}^{r_2} dr \\, \\sqrt{|g_{11}|} = ${I('r_1', 'r_2')} =`), v.L)),
    row(pair(tex(`\\frac{1}{r_2 - r_1} ${I('r_1', 'r_2')} =`), v.ratio), pair(tex('1 / \\sqrt{f(r_1)} ='), v.inv1)),
    row(pair(tex(`${I('r_S', 'r_2')} =`), v.LS))));

  const ray = r => [r * Math.cos(ANG), r * Math.sin(ANG)];
  const circ = r => Array.from({ length: 121 }, (_, k) => [r * Math.cos(k * Math.PI / 60), r * Math.sin(k * Math.PI / 60)]);
  // a drag on the slice: the radius of the pointer, projected on the ray
  const onR = k => (x, y) => { st[k] = Math.max(0, x * Math.cos(ANG) + y * Math.sin(ANG)); clampR(st); update(); };
  const keys = k => e => { const d = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05 }[e.key]; if (!d) return false; onR(k)(...ray(st[k] + d)); return true; };
  function drawA(pl) {
    const { blue, grey } = circles(st.rS);
    pl.area(circ(st.rS), { fill: C.disc, opacity: 1, color: C.grey, width: 1, dash: '4 3' });
    for (const r of grey) pl.line(circ(r), { color: C.grey, width: 1.2, dash: '4 3' });
    for (const r of blue) pl.line(circ(r), { color: C.blue, width: 1.4 });
    pl.line([ray(st.r1), ray(st.r2)], { color: C.orange, width: 5, opacity: 0.85 });
    pl.handle(ray(st.r1), { key: 'r1', r: 6, fill: '#222', stroke: '#fff', ariaLabel: 'r₁', onDrag: onR('r1'), onKey: keys('r1') });
    pl.handle(ray(st.r2), { key: 'r2', r: 6, fill: '#222', stroke: '#fff', ariaLabel: 'r₂', onDrag: onR('r2'), onKey: keys('r2') });
    pl.label('r1', ray(st.r1), '\\(r_1\\)', { anchor: 'nw', dx: 7, dy: 5, class: 'dg-gr-halo' });
    pl.label('r2', ray(st.r2), '\\(r_2\\)', { anchor: 'nw', dx: 7, dy: 5, class: 'dg-gr-halo' });
    pl.label('rS', st.rS >= 0.6 ? [0, 0] : [-0.72 * st.rS, -0.72 * st.rS], '\\(r_S\\)', { anchor: st.rS >= 0.6 ? 'c' : 'ne', dx: st.rS >= 0.6 ? 0 : -1, dy: st.rS >= 0.6 ? 0 : 1, class: st.rS >= 0.6 ? 'dg-gr-small' : 'dg-gr-small dg-gr-halo' });
    pl.label('M', [W - 0.2, W - 0.2], '\\(\\mathcal{M}\\)', { anchor: 'ne' });
  }
  function drawB(pl) {
    const { rS } = st, top = YB[1];
    pl.area([[0, 0], [rS, 0], [rS, top], [0, top]], { fill: C.disc, opacity: 1 });
    pl.line([[0, 1], [RD, 1]], { color: C.grey, width: 1, dash: '4 3' });
    pl.fn(r => f(r, rS), rS, RD, { color: C.blue, width: 2 });
    pl.fn(r => 1 / f(r, rS), rS / (1 - 1 / top), RD, { color: C.orange, width: 2 });
    for (const k of ['r1', 'r2']) {
      const r = st[k], fr = f(r, rS);
      pl.line([[r, 0], [r, top]], { color: '#444', width: 1, dash: '2 3' });
      pl.point([r, fr], { r: 3.5, fill: C.blue });
      if (1 / fr <= top) pl.point([r, 1 / fr], { r: 3.5, fill: C.orange });
      pl.label('x' + k, [r, top], `\\(${k[0]}_${k[1]}\\)`, { anchor: 'n', dy: 2, class: 'dg-gr-small' });
    }
    pl.label('rS', [rS, 0], '\\(r_S\\)', { anchor: 'sw', dx: 3, dy: -3, class: 'dg-gr-small dg-gr-halo' });
    pl.label('f', [RD, f(RD, rS)], '\\(g_{00} = f\\)', { anchor: 'ne', dx: -4, dy: 4, color: C.blue });
    pl.label('F', [RD, 1 / f(RD, rS) + 0.3], '\\(- g_{11} = 1/f\\)', { anchor: 'e', dx: -4, color: C.orangeT, class: 'dg-gr-halo' });
    pl.label('x', [RD, 0], '\\(r\\)', { anchor: 'sw', dx: 3, dy: -2, class: 'dg-axis-label' });
  }

  const pA = new Plot2D(left, { xlim: [-W, W], ylim: [-W, W], equal: true, maxWidth: 360, axes: false, grid: false, margin: { l: 6, r: 6, t: 6, b: 6 },
    role: 'group', label: 't = const, θ = π/2', draw: drawA });
  left.append(legend([{ label: `\\(\\int dr / \\sqrt{f}\\) in steps of ${ELL}`, color: C.blue, width: 1.6 }, { label: `\\(r\\) in steps of ${ELL}`, color: C.grey, width: 1.4, dash: '4 3' }]));
  const pB = new Plot2D(boxB, { xlim: [0, RD], ylim: YB, aspect: 0.56, maxWidth: 400, xticks: [0, 1, 2, 3, 4], yticks: [0, 1, 2, 3], grid: false,
    margin: { l: 30, r: 12, t: 10, b: 26 }, label: 'g₀₀, −g₁₁', draw: drawB });


  function update() {
    pA.update(); pB.update();
    const a = at(st), F = x => fmt(x, 3);
    v.r1.textContent = F(st.r1); v.r2.textContent = F(st.r2); v.f1.textContent = F(a.f1); v.f2.textContent = F(a.f2);
    v.g1.textContent = F(-1 / a.f1); v.g2.textContent = F(-1 / a.f2); v.dr.textContent = F(a.dr); v.L.textContent = F(a.L);
    v.ratio.textContent = F(a.ratio); v.inv1.textContent = F(a.inv1); v.LS.textContent = F(a.LS);
    stage.dataset.state = JSON.stringify(st);
  }
  update();
  await typeset(body);
}
