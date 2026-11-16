// Hand-written (not generated): interactive after Figure 8.1 (label fig_integration_charts), the opening page of Chapter 8. No
// notebook. Figure 8.1 is a picture without formulas, so the panel uses the one worked example of the chapter with closed forms,
// the circle of Appendix C.7 (Appendices/examples_and_exercises/example_integration.tex, "Integral over the whole manifold"),
// drawn in Figure 8.1's colours (𝒰 and its chart blue, 𝒱 and its chart green, the volume element purple):
//   ℳ = {(a, b) | a² + b² = R²}, 𝒰 = ℳ \ {(R, 0)}, 𝒳⁻¹(α) = R (cos α, sin α), α ∈ (0, 2π); 𝒱 = ℳ \ {(−R, 0)}, 𝒴⁻¹(β) = R (cos β, sin β),
//   β ∈ (−π, π); the metric volume form, ω^g_𝒳 ∘ 𝒳⁻¹ = ω^g_𝒴 ∘ 𝒴⁻¹ = R; f = 1; ᚹ₁(p) := χ(a/R), ᚹ₂ := 1 − ᚹ₁ with χ : ℝ → [0, 1]
//   smooth, χ = 1 on (−∞, −1/2], χ = 0 on [1/2, ∞); and
//   ∫_ℳ Ω^g = ∫_0^{2π} dα R χ(cos α) + ∫_{−π}^{π} dβ R (1 − χ(cos β)) = 2πR,  whatever χ.
// The notes leave χ free within these conditions; the panel uses the standard smooth step (ours): χ = 1 for s <= s1, χ = 0 for
// s >= s2, χ(s) = 1 − S((s − s1)/(s2 − s1)) in between, S(t) = ψ(t)/(ψ(t) + ψ(1 − t)), ψ(t) = e^{−1/t} (t > 0), 0 (t <= 0), with
// −1/2 <= s1 < s2 <= 1/2 (s2 − s1 >= GAP) set by two sliders: ᚹ₁ = 1 for a/R <= s1, ᚹ₂ = 1 for a/R >= s2. Each term is
// integrated numerically (composite Simpson, 200 intervals on each of the five pieces between the angles where cos = s1, s2,
// on which the integrand is constant or one smooth transition): error < 1e-12. p = R (cos θ, sin θ) can be dragged along ℳ.
import { el, controls, slider, note, fmt, simpson, Plot2D } from './dg.js';
import { typeset } from '../course.js';

export const START = { R: 1, s1: -0.5, s2: 0.5, th: 100 };
export const GAP = 0.02, RR = [0.6, 1.5], N = 200;
const PI = Math.PI, TAU = 2 * PI, DEG = PI / 180;
// the notes' figure colours (main.tex): blue_1/2 (𝒰, 𝒳, ᚹ₁), green_1/2 (𝒱, 𝒴, ᚹ₂), purple_1 (the volume element); text: darker green
const C = { blue: '#3859bd', blue2: '#bdc9ed', green: '#2bac2b', green2: '#b8e7b8', greenT: '#1d841d', purple: '#6c026c', grey: '#9a9a9a', ink: '#222222' };
const RGB = { blue: [56, 89, 189], green: [43, 172, 43] };

const psi = t => t > 0 ? Math.exp(-1 / t) : 0;
/** The smooth step S: 0 for t <= 0, 1 for t >= 1. */
export const step = t => t <= 0 ? 0 : t >= 1 ? 1 : psi(t) / (psi(t) + psi(1 - t));
/** χ(s) for the transition [s1, s2]. */
export const chi = (s, s1, s2) => 1 - step((s - s1) / (s2 - s1));
/** ᚹ₁ and ᚹ₂ at the point of ℳ at angle θ (radians): a/R = cos θ. */
export const rho = (st, th) => { const r1 = chi(Math.cos(th), st.s1, st.s2); return [r1, 1 - r1]; };
/** The two terms of C.7 and their sum. */
export function terms({ R, s1, s2 }) {
  const a1 = Math.acos(s1), a2 = Math.acos(s2);
  const f1 = a => R * chi(Math.cos(a), s1, s2), f2 = b => R * (1 - chi(Math.cos(b), s1, s2));
  const c1 = [0, a2, a1, TAU - a1, TAU - a2, TAU], c2 = [-PI, -a1, -a2, a2, a1, PI];
  let I1 = 0, I2 = 0;
  for (let k = 0; k < 5; k++) { I1 += simpson(f1, c1[k], c1[k + 1], N); I2 += simpson(f2, c2[k], c2[k + 1], N); }
  return { I1, I2, sum: I1 + I2, closed: TAU * R };
}
/** 𝒳(p) and 𝒴(p) for p at the angle θ in degrees (null where p is not in the chart domain). */
export const coords = th => { const t = ((th % 360) + 360) % 360; return { alpha: t === 0 ? null : t * DEG, beta: t === 180 ? null : (t < 180 ? t : t - 360) * DEG }; };
const r2 = x => Math.round(x * 100) / 100;
/** −1/2 <= s1 < s2 <= 1/2, s2 − s1 >= GAP, on a grid of 0.01; `keep` is the slider that moved (the other one gives way). */
export function clampS(st, keep) {
  st.s1 = Math.min(0.5 - GAP, Math.max(-0.5, r2(st.s1))); st.s2 = Math.max(-0.5 + GAP, Math.min(0.5, r2(st.s2)));
  if (st.s2 - st.s1 < GAP - 1e-9) { if (keep === 's2') st.s1 = r2(st.s2 - GAP); else st.s2 = r2(st.s1 + GAP); }
  return st;
}
const mix = w => `rgb(${RGB.blue.map((c, i) => Math.round(c + (RGB.green[i] - c) * w)).join(',')})`;

export default async function mount(body) {
  const st = JSON.parse(JSON.stringify(START));
  body.append(note('The circle of Appendix C.7: reshape the partition of unity \\(\\{ \\textrm{\\runic ᚹ}_1, \\textrm{\\runic ᚹ}_2 \\}\\) or change \\(R\\) with the sliders, and drag \\(p\\) along \\(\\mathcal{M}\\).'));
  const bar = controls(body);
  const sR = slider({ label: '\\(R\\)', aria: 'R', min: RR[0], max: RR[1], step: 0.05, value: st.R, onInput: v => { st.R = v; update(); } });
  const sl = [['s1', '\\(\\textrm{\\runic ᚹ}_1 = 1\\) for \\(a/R \\le\\)', 'ᚹ₁ = 1 for a/R ≤'], ['s2', '\\(\\textrm{\\runic ᚹ}_2 = 1\\) for \\(a/R \\ge\\)', 'ᚹ₂ = 1 for a/R ≥']]
    .map(([k, label, aria]) => slider({ label, aria, min: -0.5, max: 0.5, step: 0.01, value: st[k], onInput: v => setS(k, v) }));
  sR.el.classList.add('dg-ig-r'); sl.forEach(s => s.el.classList.add('dg-ig-s'));
  bar.append(sR.el, ...sl.map(s => s.el));
  function setS(k, v) { st[k] = v; clampS(st, k); sl[0].set(st.s1, false); sl[1].set(st.s2, false); update(); }

  const stage = el('div', { class: 'dg-ig' });
  const top = el('div', { class: 'dg-two dg-ig-top' }), left = el('div', { class: 'dg-panel' }), right = el('div', { class: 'dg-panel dg-ig-out' });
  const bottom = el('div', { class: 'dg-two' }), cx = el('div', { class: 'dg-panel' }), cy = el('div', { class: 'dg-panel' });
  top.append(left, right); bottom.append(cx, cy); stage.append(top, bottom); body.append(stage);
  const tex = s => el('span', { class: 'dg-ig-tex' }, `\\(${s}\\)`);
  const val = k => el('span', { class: 'dg-ig-val', 'data-k': k });
  const pair = (...c) => el('span', { class: 'dg-ig-pair' }, ...c);
  const row = (...c) => el('div', { class: 'dg-eqrow dg-ig-row' }, ...c);
  const v = Object.fromEntries(['r1', 'r2', 'a', 'b', 'I1', 'I2', 'J1', 'J2', 'sum', 'closed'].map(k => [k, val(k)]));
  const W1 = '\\textrm{\\runic ᚹ}_1', W2 = '\\textrm{\\runic ᚹ}_2';
  const notA = el('span', { class: 'dg-ig-not', hidden: true }, '\\(p \\notin \\mathcal{U}\\)'), notB = el('span', { class: 'dg-ig-not', hidden: true }, '\\(p \\notin \\mathcal{V}\\)');
  const pa = pair(tex('\\mathscr{X}(p) ='), v.a), pb = pair(tex('\\mathscr{Y}(p) ='), v.b);
  right.append(
    row(tex(`${W1}(p) \\coloneqq \\chi(a / R), \\qquad ${W2} \\coloneqq 1 - ${W1}`)),
    row(pair(tex(`${W1}(p) =`), v.r1), pair(tex(`${W2}(p) =`), v.r2)),
    row(pa, notA, pb, notB),
    row(pair(tex('\\int_\\mathcal{M} \\Omega^g ='), v.I1, el('span', {}, '+'), v.I2, el('span', {}, '='), v.sum)),
    row(pair(tex('2 \\pi R ='), v.closed)));
  cx.append(el('div', { class: 'dg-eqrow dg-ig-term' }, pair(tex('\\int_{0}^{2\\pi} d\\alpha \\; R \\, \\chi(\\cos \\alpha) ='), v.J1)));
  cy.append(el('div', { class: 'dg-eqrow dg-ig-term' }, pair(tex('\\int_{-\\pi}^{\\pi} d\\beta \\; R \\, \\big( 1 - \\chi(\\cos \\beta) \\big) ='), v.J2)));

  // ---- ℳ, coloured by the partition of unity (as Figure C.13c: ᚹ₁ = 1, ᚹ₂ = 1, both in between), with p
  const WM = 2.35, at = (th, r = st.R) => [r * Math.cos(th), r * Math.sin(th)];
  const onP = (x, y) => { st.th = ((Math.round(Math.atan2(y, x) / DEG) % 360) + 360) % 360; update(); };
  const keyP = e => { const d = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5 }[e.key]; if (!d) return false; st.th = (((st.th + d) % 360) + 360) % 360; update(); return true; };
  function drawM(pl) {
    const { R } = st, n = 240;
    for (const [x, sgn, lab, y] of [[-R / 2, '-', 'a = -\\frac{R}{2}', 1.95], [R / 2, '', 'a = \\frac{R}{2}', -1.95]]) {
      pl.line([[x, -1.95], [x, 1.95]], { color: C.grey, width: 1, dash: '4 3' });
      pl.label('l' + sgn, [x, y], `\\(${lab}\\)`, { anchor: y > 0 ? 'n' : 's', dy: y > 0 ? 1 : -1, class: 'dg-ig-small dg-ig-halo' });
    }
    // runs of equal colour: one path each
    let run = [at(0)], col = mix(rho(st, 0.5 * TAU / n)[1]);
    for (let k = 1; k <= n; k++) {
      const c = k < n ? mix(rho(st, (k + 0.5) * TAU / n)[1]) : null;
      run.push(at(k * TAU / n));
      if (c !== col) { pl.line(run, { color: col, width: 5 }); run = [at(k * TAU / n)]; col = c; }
    }
    for (const x of [R, -R]) pl.point([x, 0], { r: 4, fill: '#fff', stroke: C.ink, strokeWidth: 1.5 });
    pl.label('nu', [R, 0], '\\(\\notin \\mathcal{U}\\)', { anchor: 'w', dx: 7, class: 'dg-ig-small' });
    pl.label('nv', [-R, 0], '\\(\\notin \\mathcal{V}\\)', { anchor: 'e', dx: -7, class: 'dg-ig-small' });
    pl.label('w1', at(155 * DEG), `\\(${W1} = 1\\)`, { anchor: 'se', dx: -6, dy: -4, color: C.blue, class: 'dg-ig-small dg-ig-halo' });
    pl.label('w2', at(25 * DEG), `\\(${W2} = 1\\)`, { anchor: 'sw', dx: 6, dy: -4, color: C.greenT, class: 'dg-ig-small dg-ig-halo' });
    pl.label('M', [-WM + 0.1, 1.9], '\\(\\mathcal{M}\\)', { anchor: 'nw' });
    const p = at(st.th * DEG);
    pl.handle(p, { key: 'p', r: 6, fill: C.ink, stroke: '#fff', ariaLabel: 'p', onDrag: onP, onKey: keyP });
    // outside the circle; inside it near (±R, 0), where the labels ∉ 𝒰, ∉ 𝒱 are
    pl.label('p', at(st.th * DEG, st.R + (Math.abs(Math.sin(st.th * DEG)) >= 0.35 ? 0.3 : -0.3)), '\\(p\\)', { anchor: 'c', class: 'dg-ig-halo' });
  }
  const pM = new Plot2D(left, { xlim: [-WM, WM], ylim: [-2.1, 2.1], equal: true, maxWidth: 330, axes: false, grid: false, margin: { l: 4, r: 4, t: 4, b: 4 },
    role: 'group', label: 'ℳ', draw: drawM });

  // ---- the two chart images: the term of each chart (solid), the other function of the partition (light), the density R
  const YT = 1.9;
  const charts = [
    { key: 'X', lim: [0, TAU], ticks: [[0, '0'], [PI, '\\pi'], [TAU, '2\\pi']], ax: '\\alpha', own: 0, coord: 'alpha', dom: 'U', title: '(\\mathcal{U}, \\mathscr{X})',
      name: '(𝒰, 𝒳)', dens: '\\omega^g_\\mathscr{X} \\circ \\mathscr{X}^{-1} = R', at: '\\mathscr{X}(p)', parent: cx },
    { key: 'Y', lim: [-PI, PI], ticks: [[-PI, '-\\pi'], [0, '0'], [PI, '\\pi']], ax: '\\beta', own: 1, coord: 'beta', dom: 'V', title: '(\\mathcal{V}, \\mathscr{Y})',
      name: '(𝒱, 𝒴)', dens: '\\omega^g_\\mathscr{Y} \\circ \\mathscr{Y}^{-1} = R', at: '\\mathscr{Y}(p)', parent: cy }
  ];
  function drawChart(pl, ch) {
    const { R } = st, [x0, x1] = ch.lim, n = 360, xs = Array.from({ length: n + 1 }, (_, k) => x0 + (x1 - x0) * k / n);
    const h1 = xs.map(x => R * rho(st, x)[0]);                       // R ᚹ₁ in this chart: the boundary between the two
    const low = ch.own === 0 ? h1 : h1.map(h => R - h);              // height of this chart's own term
    const own = ch.own === 0 ? { fill: C.blue2, line: C.blue } : { fill: C.green2, line: C.green }, other = ch.own === 0 ? C.green2 : C.blue2;
    pl.area([[x0, 0], ...xs.map((x, k) => [x, low[k]]), [x1, 0]], { fill: own.fill, opacity: 1 });
    pl.area([...xs.map((x, k) => [x, low[k]]), [x1, R], [x0, R]], { fill: other, opacity: 0.45 });
    pl.line(xs.map((x, k) => [x, low[k]]), { color: own.line, width: 1.6 });
    pl.line([[x0, R], [x1, R]], { color: C.purple, width: 1.8 });
    // axes
    pl.arrow([x0 - 0.25, 0], [x1 + 0.45, 0], { color: '#444', width: 1, head: 7, class: 'dg-inert' });
    pl.arrow([x0, 0], [x0, YT], { color: '#444', width: 1, head: 7, class: 'dg-inert' });
    for (const [t, s] of ch.ticks) { pl.line([[t, 0], [t, -0.06]], { color: '#444', width: 1 }); pl.label('t' + s, [t, -0.08], `\\(${s}\\)`, { anchor: 'n', class: 'dg-ig-small' }); }
    pl.label('ax', [x1 + 0.45, 0], `\\(${ch.ax}\\)`, { anchor: 'sw', dx: -8, dy: -3, class: 'dg-axis-label' });
    pl.label('title', [x0, YT], `\\(${ch.title}\\)`, { anchor: 'nw', dx: 8, class: 'dg-ig-small' });
    const xd = coords(st.th)[ch.coord];
    const dx = xd == null ? 0.5 : xd < (x0 + x1) / 2 ? 0.75 : 0.25;
    pl.label('dens', [x0 + (x1 - x0) * dx, R], `\\(${ch.dens}\\)`, { anchor: 's', dy: -2, color: C.purple, class: 'dg-ig-small dg-ig-halo' });
    if (xd == null) { pl.label('at', [x1, YT], `\\(p \\notin \\mathcal{${ch.dom}}\\)`, { anchor: 'ne', dx: -4, class: 'dg-ig-small' }); return; }
    const [w1] = rho(st, st.th * DEG), hb = ch.own === 0 ? R * w1 : R * (1 - w1);
    pl.line([[xd, 0], [xd, hb]], { color: own.line, width: 3.5 });
    pl.line([[xd, hb], [xd, R]], { color: ch.own === 0 ? C.green : C.blue, width: 3.5 });
    pl.point([xd, 0], { r: 3.5, fill: C.ink });
    pl.label('at', [xd, R], `\\(${ch.at}\\)`, { anchor: 's', dy: -3, class: 'dg-ig-small dg-ig-halo' });
  }
  for (const ch of charts) {
    ch.plot = new Plot2D(ch.parent, { xlim: [ch.lim[0] - 0.3, ch.lim[1] + 0.7], ylim: [-0.42, YT + 0.05], aspect: 0.44, maxWidth: 420, axes: false, grid: false,
      margin: { l: 4, r: 4, t: 4, b: 4 }, label: ch.name, draw: p => drawChart(p, ch) });
    ch.parent.insertBefore(ch.plot.wrap, ch.parent.firstChild);
  }

  function update() {
    pM.update(); charts.forEach(ch => ch.plot.update());
    const [w1, w2] = rho(st, st.th * DEG), t = terms(st), c = coords(st.th), F = x => fmt(x, 6);
    v.r1.textContent = fmt(w1, 3); v.r2.textContent = fmt(w2, 3);
    pa.hidden = c.alpha == null; notA.hidden = c.alpha != null; pb.hidden = c.beta == null; notB.hidden = c.beta != null;
    if (c.alpha != null) v.a.textContent = fmt(c.alpha, 3);
    if (c.beta != null) v.b.textContent = fmt(c.beta, 3);
    v.I1.textContent = v.J1.textContent = F(t.I1); v.I2.textContent = v.J2.textContent = F(t.I2);
    v.sum.textContent = F(t.sum); v.closed.textContent = F(t.closed);
    stage.dataset.state = JSON.stringify(st);
  }
  update();
  await typeset(body);
}
