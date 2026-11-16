// Hand-written (not generated): interactive after Figure C.8 (label fig_Example_Fields_action), Appendix C.4. Notebook:
// notebooks/exercises_and_example_figures/exercise_C3.ipynb (it draws the panels of Figures C.5–C.8).
// Everything comes from Appendices/examples_and_exercises/example_fields.tex: M is the graph of h(a, b) = cos a cos b + 1,
// the charts X(p) = (a, b) on U = M and Y(p) = (√(a²+b²), atan2(b, a)) on V = M \ {a <= 0, b = 0}; the scalar field
// f(p) = c = cos a cos b + 1 and the components of (df)_p, x_i = (−sin a cos b, −cos a sin b) and
// y_i = (−(a sin a cos b + b cos a sin b)/√(a²+b²), b sin a cos b − a cos a sin b); the curves γ_x0(λ) = (x0, λ) and
// δ_r0(λ) = (r0 cos λ, r0 sin λ) whose velocities are the vector fields X (through p: x0 = a, λ0 = b) and Y (r0 = √(a²+b²),
// λ0 = atan2(b, a); at the origin δ_0 is constant and Y vanishes), with component functions X^i = (0, 1),
// Y^i = (b/√(a²+b²), a/(a²+b²)) for X and X̃^i = (−b, a), Ỹ^i = (0, 1) for Y; the actions X⌊f⌉ = −cos a sin b and
// Y⌊f⌉ = b sin a cos b − a cos a sin b, the chart-free (f∘γ_x0)'(λ0) = −cos x0 sin λ0 and (f∘δ_r0)'(λ0), and
// df⌈X⌋(p) = (df)_p(X(p)) = X_i(p) X^i(p) with X_i(p) = x_i^p. The drawing is the chart (U, X) of Figure C.8 (bottom):
// [−7, 7]², colour maps RdBu for f (as in C.6, C.8 top) and Paul Tol's BuRd for the actions (red: the field climbs f),
// symmetric ranges ±1 (X⌊f⌉) and ±6.5 (Y⌊f⌉, the figure's scale), level sets of f, the field's arrows normalized (as in
// Figures C.7–C.8: only directions are meaningful) in the figure's yellow (X) and light blue (Y). The colour map, the
// level sets and the field's arrows are one raster (an SVG <image>, redrawn only when the field, the colouring or the size
// changes); p, X_p, the integral curve through p and the branch cut of (V, Y) are SVG on top.
import { el, controls, choice, toggle, note, legend, setMath, fmt, Plot2D } from './dg.js';
import { typeset } from '../course.js';

const PI = Math.PI;
export const LIM = [-7, 7], SNAP = 0.12, SNAPKEY = 0.05, STEP = 0.1, ARROW = 1.5;
export const START = { field: 'X', colour: 'f', p: [2, Math.sqrt(PI * PI - 4)] };   // the point of Figure C.6
export const VMAX = { X: 1, Y: 6.5 };
const C = { X: '#CCBB44', Y: '#66CCEE', Xc: '#9a8a1a', Yc: '#1f88b8', ink: '#111111', cut: '#333333', level: [51, 51, 51] };
const RdBu = ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'];
const BuRd = ['#2166AC', '#4393C3', '#92C5DE', '#D1E5F0', '#F7F7F7', '#FDDBC7', '#F4A582', '#D6604D', '#B2182B'];
const LIGHT = { f: 0.3, act: 0.15 };                   // mixed with white, so that the curve, the arrows and p stay legible
const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
const RAMP = { f: RdBu.map(hex), act: BuRd.map(hex) };

/** The colour (r, g, b) of the colouring `which` ('f' or 'act') at t in [0, 1]. */
export function cmap(which, t) {
  const s = RAMP[which], x = Math.max(0, Math.min(1, t)) * (s.length - 1), k = Math.min(s.length - 2, Math.floor(x)), u = x - k, w = LIGHT[which];
  return [0, 1, 2].map(i => Math.round((s[k][i] * (1 - u) + s[k + 1][i] * u) * (1 - w) + 255 * w));
}
/** f(p) = cos a cos b + 1. */
export const f = (a, b) => Math.cos(a) * Math.cos(b) + 1;
/** The action of the field on f (the notes' closed forms of C.4.6). */
export const action = (field, a, b) => field === 'X' ? -Math.cos(a) * Math.sin(b) : b * Math.sin(a) * Math.cos(b) - a * Math.cos(a) * Math.sin(b);
/** The value of the colouring at (a, b), mapped to [0, 1]. */
export const shade = (st, a, b) => st.colour === 'f' ? f(a, b) / 2 : (action(st.field, a, b) / VMAX[st.field] + 1) / 2;
/** p in V = M \ {a <= 0, b = 0}. */
export const inV = ([a, b]) => !(b === 0 && a <= 0);
/** The curve of the field's family through p and its parameter there: γ_x0 with x0 = a, λ0 = b; δ_r0 with r0 = √(a²+b²), λ0 = atan2(b, a). */
export function curveAt(field, [a, b]) {
  if (field === 'X') return { x0: a, l0: b, at: l => [a, l] };
  const r0 = Math.hypot(a, b);
  return { r0, l0: r0 > 0 ? Math.atan2(b, a) : null, at: l => [r0 * Math.cos(l), r0 * Math.sin(l)] };
}
/** Everything the panel shows at the state st. */
export function at(st) {
  const [a, b] = st.p, r2 = a * a + b * b, r = Math.sqrt(r2), sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b), v = inV(st.p);
  const cur = curveAt(st.field, st.p);
  const x = [-sa * cb, -ca * sb];                                        // 𝚡_i^p = 𝚇_i(p)
  const y = v ? [-(a * sa * cb + b * ca * sb) / r, b * sa * cb - a * ca * sb] : null;
  const A = st.field === 'X' ? [0, 1] : [-b, a];                         // X^i (X̃^i for 𝒴)
  const B = !v ? null : st.field === 'X' ? [b / r, a / r2] : [0, 1];      // Y^i (Ỹ^i for 𝒴)
  let dcur;
  if (st.field === 'X') dcur = -Math.cos(cur.x0) * Math.sin(cur.l0);
  else if (!(cur.r0 > 0)) dcur = 0;                                     // δ_0 is constant
  else { const r0 = cur.r0, l = cur.l0, u = r0 * Math.cos(l), w = r0 * Math.sin(l);
    dcur = r0 * Math.sin(l) * Math.sin(u) * Math.cos(w) - r0 * Math.cos(l) * Math.cos(u) * Math.sin(w); }
  return { inV: v, beta: v ? [r, Math.atan2(b, a)] : null, cur: { x0: cur.x0, r0: cur.r0, l0: cur.l0 }, A, x, B, y,
    vX: A[0] * x[0] + A[1] * x[1], vY: v ? B[0] * y[0] + B[1] * y[1] : null, vCurve: dcur, vDf: x[0] * A[0] + x[1] * A[1] };
}
/** p moved to (x, y): kept in the drawing; within `snap` of the branch cut {a <= 0, b = 0} it snaps onto it, near the origin onto the
 *  origin (drags: SNAP; arrow keys, which move on a grid of 0.01 by STEP: SNAPKEY = STEP / 2, so that a key always lands on the cut
 *  when it crosses it and can leave it again). */
export function place([x, y], snap = SNAP) {
  x = Math.max(LIM[0] + 0.1, Math.min(LIM[1] - 0.1, x)); y = Math.max(LIM[0] + 0.1, Math.min(LIM[1] - 0.1, y));
  if (Math.abs(y) <= snap && x <= snap) { y = 0; if (Math.abs(x) <= snap) x = 0; }
  return [x + 0, y + 0];                                                // no −0 (atan2(−0, a < 0) would be −π)
}

/** The raster under the drawing: colour map, level sets of f, the field's arrows (normalized). */
function raster(st, W, H, dpr) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data, S = LIM[1] - LIM[0], u = S / W, hw = 0.5 * dpr;
  const lut = Array.from({ length: 513 }, (_, k) => cmap(st.colour, k / 512));
  for (let j = 0; j < H; j++) {
    const b = LIM[1] - (j + 0.5) * S / H, sb = Math.sin(b), cb = Math.cos(b);
    for (let i = 0; i < W; i++) {
      const a = LIM[0] + (i + 0.5) * S / W, sa = Math.sin(a), ca = Math.cos(a), fv = ca * cb + 1;
      const c = lut[Math.round(Math.max(0, Math.min(1, shade(st, a, b))) * 512)];
      const L = Math.min(1.75, Math.max(0.25, Math.round(fv * 4) / 4)), g = Math.hypot(sa * cb, ca * sb) * u;
      const dist = Math.abs(fv - L) / (g + 1e-15), al = 0.45 * Math.max(0, Math.min(1, 1 - (dist - hw)));
      const k = 4 * (j * W + i);
      for (let m = 0; m < 3; m++) d[k + m] = Math.round(c[m] * (1 - al) + C.level[m] * al);
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const px = (a, b) => [(a - LIM[0]) / S * W, (LIM[1] - b) / S * H], sc = W / S, len = 0.62 * sc, head = 0.24 * sc;
  ctx.lineCap = 'round';
  for (let a = -6; a <= 6; a++) for (let b = -6; b <= 6; b++) {
    const v = st.field === 'X' ? [0, 1] : [-b, a], n = Math.hypot(...v);
    if (!n) continue;
    const [x, y] = px(a, b), ux = v[0] / n, uy = -v[1] / n;
    const x0 = x - ux * len / 2, y0 = y - uy * len / 2, x1 = x + ux * len / 2, y1 = y + uy * len / 2;
    for (const [col, wd] of [['rgba(0, 0, 0, 0.45)', 0.11 * sc], [C[st.field], 0.06 * sc]]) {
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * head * 0.8, y1 - uy * head * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - ux * head - uy * head * 0.45, y1 - uy * head + ux * head * 0.45);
      ctx.lineTo(x1 - ux * head + uy * head * 0.45, y1 - uy * head - ux * head * 0.45); ctx.closePath();
      if (col === C[st.field]) ctx.fill(); else { ctx.lineJoin = 'round'; ctx.stroke(); ctx.fill(); }
    }
  }
  return cv.toDataURL('image/png');
}

export default async function mount(body) {
  const st = JSON.parse(JSON.stringify(START));
  const S = () => (st.field === 'X' ? '\\mathcal{X}' : '\\mathcal{Y}');
  const ACT = { X: '𝒳⌊f⌉', Y: '𝒴⌊f⌉' };
  body.append(note('Choose \\(\\mathcal{X}\\) or \\(\\mathcal{Y}\\) and drag \\(p\\); switch the colouring from \\(f\\) to \\(\\mathcal{X} \\lfloor f \\rceil\\) or \\(\\mathcal{Y} \\lfloor f \\rceil\\).'));
  const bar = controls(body);
  const cField = choice({ options: [{ value: 'X', label: '\\(\\mathcal{X}\\)', aria: '𝒳' }, { value: 'Y', label: '\\(\\mathcal{Y}\\)', aria: '𝒴' }],
    value: st.field, onChange: v => { st.field = v; update(true); } });
  const tCol = toggle({ label: '\\(\\mathcal{X} \\lfloor f \\rceil\\)', aria: ACT.X, value: false, onChange: v => { st.colour = v ? 'act' : 'f'; update(true); } });
  bar.append(cField.el, tCol.el);

  const stage = el('div', { class: 'dg-fd' });
  const two = el('div', { class: 'dg-two' }), left = el('div', { class: 'dg-panel' }), right = el('div', { class: 'dg-panel' });
  two.append(left, right); stage.append(two); body.append(stage);

  // the numbers, beside the notes' formulas (TeX labels are re-typeset when the field changes)
  const tex = () => el('span', { class: 'dg-fd-tex' });
  const val = k => el('span', { class: 'dg-fd-val', 'data-k': k });
  const pair = (...c) => el('span', { class: 'dg-fd-pair' }, ...c);
  const row = (...c) => el('div', { class: 'dg-eqrow dg-fd-row' }, ...c);
  const t = { pX: tex(), pY: tex(), on: tex(), c1: tex(), c2: tex(), dcur: tex(), chX: tex(), chY: tex(), fX: tex(), fY: tex(), df: tex(), notV: tex(), notV2: tex() };
  const v = {}; for (const k of ['p', 'beta', 'c1', 'c2', 'dcur', 'A1', 'x1', 'A2', 'x2', 'vX', 'B1', 'y1', 'B2', 'y2', 'vY', 'df']) v[k] = val(k);
  const sum = (a1, x1, a2, x2, tot) => el('span', { class: 'dg-fd-val dg-fd-sum' }, a1, ' · (', x1, ') + ', a2, ' · (', x2, ') = ', tot);
  const pBeta = pair(t.pY, v.beta), pC2 = pair(t.c2, v.c2), ySum = pair(t.fY, sum(v.B1, v.y1, v.B2, v.y2, v.vY));
  right.append(el('div', { class: 'dg-fd-out' },
    row(pair(t.pX, v.p), pBeta, t.notV),
    row(t.on, pair(t.c1, v.c1), pC2),
    row(pair(t.dcur, v.dcur)),
    row(t.chX, pair(t.fX, sum(v.A1, v.x1, v.A2, v.x2, v.vX))),
    row(t.chY, ySum, t.notV2),
    row(pair(t.df, v.df))));

  // the drawing: chart (U, X)
  let bg = { key: '', url: '' };
  const clipBox = q => q[0] >= LIM[0] && q[0] <= LIM[1] && q[1] >= LIM[0] && q[1] <= LIM[1];
  function draw(pl) {
    const m = pl.o.margin, fw = pl.w - m.l - m.r, fh = pl.h - m.t - m.b;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.max(1, Math.round(fw * dpr)), H = Math.max(1, Math.round(fh * dpr));
    const key = `${W}x${H}|${st.field}|${st.colour}`;
    const im = pl.node('image', { x: m.l, y: m.t, width: fw, height: fh, preserveAspectRatio: 'none', class: 'dg-fd-bg' }, { key: 'bg', layer: 'grid' });
    if (bg.key !== key) { bg = { key, url: raster(st, W, H, dpr) }; im.setAttribute('href', bg.url); }
    pl.line([[0, 0], [LIM[0], 0]], { color: C.cut, width: 1.6, dash: '6 4', class: 'dg-fd-cut' });
    // the integral curve through p: γ_x0 (the line a = x0) or δ_r0 (the circle of radius r0), inside the drawing
    const cur = curveAt(st.field, st.p), runs = [];
    if (st.field === 'X') runs.push([[st.p[0], LIM[0]], [st.p[0], LIM[1]]]);
    else if (cur.r0 > 0) {
      let run = [];
      for (let k = 0; k <= 360; k++) { const q = cur.at(-PI + 2 * PI * k / 360); if (clipBox(q)) run.push(q); else { if (run.length > 1) runs.push(run); run = []; } }
      if (run.length > 1) runs.push(run);
      if (runs.length > 1 && clipBox(cur.at(-PI))) { const last = runs.pop(); runs[0] = last.concat(runs[0]); }
    }
    for (const r of runs) { pl.line(r, { color: '#fff', width: 5, opacity: 0.75 }); pl.line(r, { color: C[st.field + 'c'], width: 2.6, class: 'dg-fd-curve' }); }
    // 𝒳_p, normalized (as the arrows of Figures C.7–C.8)
    const A = at(st).A, n = Math.hypot(...A);
    if (n > 0) {
      const tip = [st.p[0] + ARROW * A[0] / n, st.p[1] + ARROW * A[1] / n];
      pl.arrow(st.p, tip, { color: '#fff', width: 5.5, head: 14, class: 'dg-inert dg-fd-casing' });
      pl.arrow(st.p, tip, { color: C.ink, width: 2.4, head: 11, class: 'dg-inert dg-fd-Xp' });
      pl.label('Xp', tip, `\\(${S()}_p\\)`, { anchor: A[0] / n > 0.3 ? 'w' : A[0] / n < -0.3 ? 'e' : 's', dx: A[0] / n > 0.3 ? 4 : A[0] / n < -0.3 ? -4 : 0, dy: Math.abs(A[0] / n) <= 0.3 ? (A[1] > 0 ? -3 : 22) : 0, class: 'dg-fd-halo' });
    }
    const KEY = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, STEP], ArrowDown: [0, -STEP] }, r2 = x => Math.round(x * 100) / 100;
    pl.handle(st.p, { key: 'p', r: 6.5, fill: '#000', stroke: '#fff', ariaLabel: 'p', onDrag: (x, y) => { st.p = place([x, y]); update(false); },
      onKey: e => { const d = KEY[e.key]; if (!d) return false; st.p = place([r2(st.p[0] + d[0]), r2(st.p[1] + d[1])], SNAPKEY); update(false); return true; } });
    const east = st.p[0] < LIM[1] - 1.5, up = n > 0 && A[1] / n < -0.5;
    pl.label('p', st.p, '\\(p\\)', { anchor: east ? (up ? 'sw' : 'nw') : (up ? 'se' : 'ne'), dx: east ? 7 : -7, dy: up ? -5 : 5, class: 'dg-fd-halo' });
    pl.label('x', [LIM[1], LIM[0]], '\\(\\mathscr{X}^1\\)', { anchor: 'se', dx: -4, dy: -4, class: 'dg-axis-label dg-fd-halo' });
    pl.label('y', [LIM[0], LIM[1]], '\\(\\mathscr{X}^2\\)', { anchor: 'nw', dx: 5, dy: 4, class: 'dg-axis-label dg-fd-halo' });
  }
  const T = [-6, -4, -2, 0, 2, 4, 6];
  const pl = new Plot2D(left, { xlim: LIM, ylim: LIM, equal: true, maxWidth: 420, xticks: T, yticks: T, grid: false, margin: { l: 26, r: 8, t: 8, b: 22 },
    role: 'group', label: '(𝒰, 𝒳)', draw });
  const cbar = el('div', { class: 'dg-fd-cbar', 'aria-hidden': 'true' }), cLab = tex(), lo = el('span', { class: 'dg-fd-val' }), hi = el('span', { class: 'dg-fd-val' });
  const ramp = el('span', { class: 'dg-fd-ramp' });
  cbar.append(cLab, lo, ramp, hi);
  const leg = el('div');
  left.append(cbar, leg);

  async function update(retex) {
    pl.update();
    const a = at(st), F = x => fmt(x, 3), P = x => (F(x)[0] === '−' ? `(${F(x)})` : F(x)), [pa, pb] = st.p;   // P: a negative factor in brackets
    v.p.textContent = `(${F(pa)}, ${F(pb)})`;
    pBeta.hidden = !a.inV; t.notV.hidden = a.inV; ySum.hidden = !a.inV; t.notV2.hidden = a.inV;
    if (a.inV) { v.beta.textContent = `(${F(a.beta[0])}, ${F(a.beta[1])})`; [v.B1.textContent, v.B2.textContent] = a.B.map(P); [v.y1.textContent, v.y2.textContent] = a.y.map(F); v.vY.textContent = F(a.vY); }
    if (st.field === 'X') { v.c1.textContent = F(a.cur.x0); v.c2.textContent = F(a.cur.l0); pC2.hidden = false; }
    else { v.c1.textContent = F(a.cur.r0); pC2.hidden = a.cur.l0 == null; if (a.cur.l0 != null) v.c2.textContent = F(a.cur.l0); }
    v.dcur.textContent = F(a.vCurve);
    [v.A1.textContent, v.A2.textContent] = a.A.map(P); [v.x1.textContent, v.x2.textContent] = a.x.map(F); v.vX.textContent = F(a.vX);
    v.df.textContent = F(a.vDf);
    stage.dataset.state = JSON.stringify(st);
    if (!retex) return;
    const s = S(), X = st.field === 'X', act = `${s} \\lfloor f \\rceil`, curve = X ? '\\gamma_{x_0}' : '\\delta_{r_0}';
    const [cA, cB] = X ? ['X', 'Y'] : ['\\tilde{X}', '\\tilde{Y}'];
    tCol.input.setAttribute('aria-label', ACT[st.field]);
    lo.textContent = st.colour === 'f' ? '0' : fmt(-VMAX[st.field], 1).replace(/\.0$/, '');
    hi.textContent = st.colour === 'f' ? '2' : fmt(VMAX[st.field], 1).replace(/\.0$/, '');
    ramp.style.background = `linear-gradient(to right, ${Array.from({ length: 11 }, (_, k) => `rgb(${cmap(st.colour, k / 10).join(', ')})`).join(', ')})`;
    await Promise.all([
      setMath(tCol.el.querySelector('.dg-ctl-label'), `\\(${act}\\)`), setMath(cLab, st.colour === 'f' ? '\\(f\\)' : `\\(${act}\\)`),
      setMath(t.pX, '\\(\\mathscr{X}(p) = (a, b) =\\)'), setMath(t.pY, '\\(\\mathscr{Y}(p) = (\\beta_1, \\beta_2) =\\)'),
      setMath(t.notV, '\\(p \\notin \\mathcal{V}\\)'), setMath(t.notV2, '\\(p \\notin \\mathcal{V}\\)'),
      setMath(t.on, `\\(p = ${curve}(\\lambda_0) :\\)`),
      setMath(t.c1, X ? '\\(x_0 = a =\\)' : '\\(r_0 = \\sqrt{a^2 + b^2} =\\)'), setMath(t.c2, X ? '\\(\\lambda_0 = b =\\)' : '\\(\\lambda_0 = \\operatorname{atan2}(b, a) =\\)'),
      setMath(t.dcur, `\\(${act}(p) = ${s}_p(f) = \\left( f \\circ ${curve} \\right)'(\\lambda_0) =\\)`),
      setMath(t.chX, '\\((\\mathcal{U}, \\mathscr{X}) :\\)'), setMath(t.chY, '\\((\\mathcal{V}, \\mathscr{Y}) :\\)'),
      setMath(t.fX, `\\(${act}(p) = ${cA}^i(p) \\cdot \\mathtt{x}_i^p =\\)`), setMath(t.fY, `\\(${act}(p) = ${cB}^i(p) \\cdot \\mathtt{y}_i^p =\\)`),
      setMath(t.df, `\\(df \\left\\lceil ${s} \\right\\rfloor(p) = (df)_p \\left( ${s}(p) \\right) =\\)`)]);
    leg.replaceChildren(legend([{ label: `\\(${s}\\)`, color: C[st.field], width: 2.5 }, { label: `\\(${curve}\\)`, color: C[st.field + 'c'], width: 2.6 },
      { label: `\\(${s}_p\\)`, color: 'currentColor', width: 2.4 }, { label: 'level sets of \\(f\\)', color: '#666', width: 1 },
      { label: '\\(\\{a \\leq 0, \\, b = 0\\}\\)', color: 'currentColor', width: 1.6, dash: '6 4' }]));
    await typeset(leg);
  }
  await update(true);
  await typeset(body);
}
