// Hand-written (not generated): interactive at the end of Appendix C.5 (label subsection_Example_Connections_curved,
// "at": "end", D57), after the third connection, so that the three can be compared. No figure and no notebook.
// Everything comes from Appendices/examples_and_exercises/example_connections_torsion_curvature.tex: M with the
// charts X = (a, b) and Y = (β1, β2) (polar), the connection coefficient functions in the chart X (Γ^i_jk, the
// LAST lower index the direction of differentiation) of
//   ∇^E: all zero;   ∇^W: Γ²11 = b/(a²+b²), Γ²12 = −a/(a²+b²), Γ¹21 = −b/(a²+b²), Γ¹22 = a/(a²+b²) (on M*);
//   ∇^κ: Γ¹22 = κ a;
// parallel transport along a curve,  ż^k + Γ^k_ji(γ(λ)) z^j γ̇^i = 0,  and the autoparallel equation,
// γ̈^k + Γ^k_ji γ̇^i γ̇^j = 0, both integrated here with RK4 in the chart X; the loops are the notes' circle δ_r0
// (X∘δ(λ) = (r0 cos λ, r0 sin λ), λ from −π to π) and the rectangle [x0, x1] × [b0, b0 + Δb], counterclockwise
// (unit speed on each side, so γ̇² = ±1 on the vertical sides as in the notes). Torsion T^i_12 = Γ^i_21 − Γ^i_12 and
// Riem^i_j12 = ∂1 Γ^i_j2 − ∂2 Γ^i_j1 + Γ^i_r1 Γ^r_j2 − Γ^i_r2 Γ^r_j1 (derivatives by central differences) at γ(λ).
// The closed forms the notes give (∇^E: cartesian components constant; ∇^W along δ_r0: polar components constant;
// ∇^κ around the rectangle: Δz¹ = −κ z² (x1 − x0) Δb) are shown next to the numbers; the test checks all of them.
import { el, controls, slider, choice, note, legend, matrix, setMath, fmt, Plot2D, vibrant } from './dg.js';
import { typeset } from '../course.js';

const PI = Math.PI, LIM = [-2.6, 2.6], PAD = 0.15, NSTEP = 400;   // λ slider: NSTEP steps over the loop
const H = 0.002;                                                   // RK4 step in λ for the transport
export const START = { conn: 'E', loop: 'delta', k: 300, z0: [0.5, 0.7], r0: 1, rect: [0.5, 2, -0.9, 1.6], kappa: 1 };
const R0 = [0.4, 2], ZN = [0.2, 1.6], XMIN = 0.25, SIDE = 0.3;      // r0 range; |𝒵| range; rectangle in a >= XMIN
const C = { loop: vibrant.orange, z0: '#222222', end: vibrant.magenta, cur: vibrant.blue, along: 'rgba(0, 119, 187, 0.38)', auto: vibrant.teal };

/** Γ^i_jk at q = (a, b) in the chart X, as G[i][j][k]. */
export function Gamma(conn, [a, b], kappa) {
  const G = [[[0, 0], [0, 0]], [[0, 0], [0, 0]]];
  if (conn === 'W') {
    const r2 = a * a + b * b;
    G[1][0][0] = b / r2; G[1][0][1] = -a / r2; G[0][1][0] = -b / r2; G[0][1][1] = a / r2;
  } else if (conn === 'k') G[0][1][1] = kappa * a;
  return G;
}
/** (Γ^k_ji u^j w^i)_k */
const contract = (G, u, w) => [0, 1].map(k => G[k][0][0] * u[0] * w[0] + G[k][0][1] * u[0] * w[1] + G[k][1][0] * u[1] * w[0] + G[k][1][1] * u[1] * w[1]);

/** The loop: segments {a, b, x(λ), v(λ)} on [l0, l1]; p = x(l0). */
export function loopOf(loop, r0, rect) {
  if (loop === 'delta') return { l0: -PI, l1: PI, segs: [{ a: -PI, b: PI, x: l => [r0 * Math.cos(l), r0 * Math.sin(l)], v: l => [-r0 * Math.sin(l), r0 * Math.cos(l)] }] };
  const [x0, x1, b0, db] = rect, w = x1 - x0;
  const sides = [[0, w, [x0, b0], [1, 0]], [w, w + db, [x1, b0], [0, 1]], [w + db, 2 * w + db, [x1, b0 + db], [-1, 0]], [2 * w + db, 2 * w + 2 * db, [x0, b0 + db], [0, -1]]];
  return { l0: 0, l1: 2 * w + 2 * db, segs: sides.map(([a, b, q, d]) => ({ a, b, x: l => [q[0] + (l - a) * d[0], q[1] + (l - a) * d[1]], v: () => d })) };
}
export const at = (L, l) => { const s = L.segs.find(s => l <= s.b) || L.segs[L.segs.length - 1]; return s.x(l); };

/** Parallel transport of z0 (components in X at p) along the loop L: z (in X) at each λ of lams (ascending). */
export function transport(conn, L, z0, lams, kappa) {
  let z = z0.slice(), l = L.l0;
  const out = [];
  for (const t of lams) {
    while (l < t - 1e-13) {
      const s = L.segs.find(s => l < s.b - 1e-13) || L.segs[L.segs.length - 1];
      const end = Math.min(t, s.b), n = Math.max(1, Math.ceil((end - l) / H)), h = (end - l) / n;
      const f = (m, y) => contract(Gamma(conn, s.x(m), kappa), y, s.v(m)).map(c => -c);
      for (let i = 0; i < n; i++) {
        const m = l + i * h, k1 = f(m, z), k2 = f(m + h / 2, z.map((y, j) => y + h / 2 * k1[j]));
        const k3 = f(m + h / 2, z.map((y, j) => y + h / 2 * k2[j])), k4 = f(m + h, z.map((y, j) => y + h * k3[j]));
        z = z.map((y, j) => y + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      }
      l = end;
    }
    out.push(z.slice());
  }
  return out;
}

/** One RK4 step of the autoparallel equation for the state [a, b, ȧ, ḃ]. */
function apStep(conn, s, h, kappa) {
  const f = y => { const acc = contract(Gamma(conn, [y[0], y[1]], kappa), [y[2], y[3]], [y[2], y[3]]); return [y[2], y[3], -acc[0], -acc[1]]; };
  const add = (y, k, c) => y.map((v, j) => v + c * k[j]);
  const k1 = f(s), k2 = f(add(s, k1, h / 2)), k3 = f(add(s, k2, h / 2)), k4 = f(add(s, k3, h));
  return s.map((v, j) => v + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
}
/** The autoparallel with γ(0) = p, γ̇(0) = v, at λ (n RK4 steps): [a, b, ȧ, ḃ]. */
export function autoparallel(conn, p, v, lam, kappa, n = 2000) {
  let s = [p[0], p[1], v[0], v[1]];
  for (let i = 0; i < n; i++) s = apStep(conn, s, lam / n, kappa);
  return s;
}
/** Points of that autoparallel in the drawn box, both ways from p (steps of about 0.02 in the chart). */
function apPath(conn, p, v, kappa) {
  const half = dir => {
    let s = [p[0], p[1], dir * v[0], dir * v[1]], len = 0;
    const pts = [[p[0], p[1]]];
    for (let i = 0; i < 1500 && len < 30; i++) {
      const sp = Math.hypot(s[2], s[3]);
      if (!(sp > 1e-9)) break;
      s = apStep(conn, s, 0.02 / sp, kappa); len += 0.02;
      if (!s.every(Number.isFinite) || Math.abs(s[0]) > -LIM[0] + 0.3 || Math.abs(s[1]) > -LIM[0] + 0.3 || (conn === 'W' && Math.hypot(s[0], s[1]) < 0.06)) break;
      pts.push([s[0], s[1]]);
    }
    return pts;
  };
  return [...half(-1).reverse(), ...half(1).slice(1)];
}

/** Torsion T^i_12 and Riem^i_j12 (R[i][j]) at q in the chart X. */
export function torsionCurvature(conn, q, kappa, h = 1e-5) {
  const G = Gamma(conn, q, kappa);
  const dG = m => { const e = [0, 0]; e[m] = h; const P = Gamma(conn, [q[0] + e[0], q[1] + e[1]], kappa), M = Gamma(conn, [q[0] - e[0], q[1] - e[1]], kappa);
    return P.map((A, i) => A.map((B, j) => B.map((c, k) => (c - M[i][j][k]) / (2 * h)))); };
  const d1 = dG(0), d2 = dG(1);
  const T = [0, 1].map(i => G[i][1][0] - G[i][0][1]);
  const R = [0, 1].map(i => [0, 1].map(j => d1[i][j][1] - d2[i][j][0] + [0, 1].reduce((s, r) => s + G[i][r][0] * G[r][j][1] - G[i][r][1] * G[r][j][0], 0)));
  return { T, R };
}
/** Components in the chart Y of a vector with components z in X at q: (∂Y^i/∂X^l) z^l. */
export const toY = ([a, b], z) => { const r2 = a * a + b * b, r = Math.sqrt(r2); return [(a * z[0] + b * z[1]) / r, (-b * z[0] + a * z[1]) / r2]; };

export default async function mount(body) {
  const st = JSON.parse(JSON.stringify(START));
  const LOOP = { delta: '\\delta_{r_0}', rect: '\\gamma' };
  const cur = () => loopOf(st.loop, st.r0, st.rect);
  const lamOf = L => L.l0 + st.k * (L.l1 - L.l0) / NSTEP;
  const P = () => at(cur(), cur().l0);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  body.append(note('Choose a connection and a loop; drag \\(p\\), the tip of \\(\\mathcal{Z}\\) or the opposite corner, and move \\(\\lambda\\) along the loop.'));
  const bar = controls(body);
  const cConn = choice({ options: [{ value: 'E', label: '\\(\\nabla^{\\mathrm{E}}\\)', aria: '∇ᴱ' }, { value: 'W', label: '\\(\\nabla^{\\mathrm{W}}\\)', aria: '∇ᵂ' }, { value: 'k', label: '\\(\\nabla^{\\kappa}\\)', aria: '∇ᵏ' }],
    value: st.conn, onChange: v => { st.conn = v; update(true); } });
  const cLoop = choice({ options: [{ value: 'delta', label: '\\(\\delta_{r_0}\\)', aria: 'δᵣ₀' }, { value: 'rect', label: '\\([x_0, x_1] \\times [b_0, b_0 + \\Delta b]\\)', aria: '[x₀, x₁] × [b₀, b₀ + Δb]' }],
    value: st.loop, onChange: v => { st.loop = v; st.k = START.k; update(true); } });
  const sL = slider({ label: '\\(\\lambda\\)', aria: 'λ', min: -PI, max: PI, step: 2 * PI / NSTEP, value: 0, onInput: v => { const L = cur(); st.k = Math.round((v - L.l0) / (L.l1 - L.l0) * NSTEP); update(false); } });
  const sK = slider({ label: '\\(\\kappa\\)', aria: 'κ', min: 0.1, max: 2, step: 0.05, value: st.kappa, onInput: v => { st.kappa = v; update(false); } });
  sL.el.classList.add('dg-tr-lambda'); sK.el.classList.add('dg-tr-kappa');
  bar.append(cConn.el, cLoop.el, sL.el, sK.el);

  const stage = el('div', { class: 'dg-transport' });
  const two = el('div', { class: 'dg-two' });
  const left = el('div', { class: 'dg-panel' }), right = el('div', { class: 'dg-panel dg-tr-out' });
  two.append(left, right);
  stage.append(two);
  body.append(stage);
  const plot = new Plot2D(left, { xlim: LIM, ylim: LIM, equal: true, margin: { l: 30, r: 8, t: 8, b: 26 }, role: 'group', label: '(𝒰, 𝒳)', draw });
  const leg = el('div');
  left.append(leg);

  // numbers: components of 𝒵(λ) in both charts, Δz after the full loop, the notes' closed form, torsion and curvature
  const tex = () => el('span', { class: 'dg-tr-tex' });
  const row = (...c) => el('div', { class: 'dg-eqrow dg-tr-row' }, ...c);
  const mX = matrix(2, 1), mY = matrix(2, 1), mD = matrix(2, 1), mF = matrix(2, 1), mT = matrix(2, 1), mR = matrix(2, 2);
  const tX = tex(), tY = tex(), tD = tex(), tF = tex(), tT = tex(), tR = tex(), fVal = el('span', { class: 'dg-tr-val' });
  const pair = (...c) => el('span', { class: 'dg-tr-pair' }, ...c);   // a label and its numbers wrap together
  const rowF = row(tF, pair(mF.el, fVal));
  right.append(row(pair(tX, mX.el), pair(tY, mY.el)), row(el('span', { text: 'after the full loop:' }), pair(tD, mD.el)), rowF, row(pair(tT, mT.el), pair(tR, mR.el)));

  function setZ(d) {
    const n = Math.hypot(d[0], d[1]);
    if (!n) return;
    const s = clamp(n, ...ZN) / n;
    st.z0 = [d[0] * s, d[1] * s]; update(false);
  }
  function setCorner(which, [x, y]) {
    const [x0, x1, b0, db] = st.rect, top = b0 + db;
    if (which === 0) { const nx = clamp(x, XMIN, x1 - SIDE), nb = clamp(y, LIM[0] + PAD, top - SIDE); st.rect = [nx, x1, nb, top - nb]; }
    else { const nx = clamp(x, x0 + SIDE, LIM[1] - PAD), nt = clamp(y, b0 + SIDE, LIM[1] - PAD); st.rect = [x0, nx, b0, nt - b0]; }
    update(false);
  }

  function draw(pl) {
    const L = cur(), p = P(), lam = lamOf(L);
    const samples = Array.from({ length: 15 }, (_, m) => L.l0 + (m + 1) * (L.l1 - L.l0) / 16);
    const lams = [...new Set([...samples, lam, L.l1])].sort((u, w) => u - w);
    const Z = transport(st.conn, L, st.z0, lams, st.kappa), zAt = l => Z[lams.indexOf(l)];
    if (st.conn === 'W') pl.point([0, 0], { r: 3.5, fill: 'none', stroke: '#444', strokeWidth: 1.3 });   // ∇^W lives on M*
    pl.line(apPath(st.conn, p, st.z0, st.kappa), { color: C.auto, width: 1.4, dash: '6 4' });
    const pts = [];
    for (const s of L.segs) for (let i = 0; i <= 120; i++) pts.push(s.x(s.a + (s.b - s.a) * i / 120));
    pl.line(pts, { color: C.loop, width: 2.4 });
    const lm = L.l0 + 0.19 * (L.l1 - L.l0);                // orientation of the loop
    pl.arrow(at(L, lm - 0.02 * (L.l1 - L.l0)), at(L, lm), { color: C.loop, width: 0.01, head: 11, class: 'dg-inert' });
    for (const l of samples) { const q = at(L, l), z = zAt(l); pl.arrow(q, [q[0] + z[0], q[1] + z[1]], { color: C.along, width: 1.3, head: 7, class: 'dg-inert' }); }
    const zE = zAt(L.l1), q = at(L, lam), zl = zAt(lam), tip = [p[0] + st.z0[0], p[1] + st.z0[1]];
    pl.arrow(p, tip, { color: C.z0, width: 2.4, head: 11, class: 'dg-inert' });
    pl.arrow(p, [p[0] + zE[0], p[1] + zE[1]], { color: C.end, width: 2.2, head: 11, dash: '5 3', class: 'dg-inert' });
    pl.arrow(q, [q[0] + zl[0], q[1] + zl[1]], { color: C.cur, width: 2.6, head: 11, class: 'dg-inert' });
    pl.point(q, { r: 3.5, fill: C.cur });
    pl.label('p', p, '\\(p\\)', { anchor: st.loop === 'delta' ? 'e' : 'ne', dx: st.loop === 'delta' ? -9 : -7, dy: st.loop === 'delta' ? 0 : 7 });
    pl.label('x', [LIM[1], LIM[0]], '\\(a\\)', { anchor: 'se', dx: -4, dy: -4, class: 'dg-axis-label' });
    pl.label('y', [LIM[0], LIM[1]], '\\(b\\)', { anchor: 'nw', dx: 5, dy: 4, class: 'dg-axis-label' });
    pl.handle(tip, { key: 'tip', r: 9, fill: 'transparent', stroke: C.z0, strokeWidth: 1.5, ariaLabel: '𝒵', onDrag: (x, y) => setZ([x - p[0], y - p[1]]) });
    if (st.loop === 'delta') {
      // p = δ_r0(−π) = (−r0, 0): a drag sets r0 = |p|; ← and ↑ make the circle larger, → and ↓ smaller
      const KEY = { ArrowLeft: 0.05, ArrowUp: 0.05, ArrowRight: -0.05, ArrowDown: -0.05 };
      pl.handle(p, { key: 'p', r: 6.5, fill: '#000', stroke: '#fff', ariaLabel: 'p',
        onDrag: (x, y) => { st.r0 = clamp(Math.hypot(x, y), ...R0); update(false); },
        onKey: e => { if (!KEY[e.key]) return false; st.r0 = clamp(Math.round((st.r0 + KEY[e.key]) * 100) / 100, ...R0); update(false); return true; } });
    } else {
      const [x0, x1, b0, db] = st.rect;
      pl.handle(p, { key: 'p', r: 6.5, fill: '#000', stroke: '#fff', ariaLabel: 'p', onDrag: (x, y) => setCorner(0, [x, y]) });
      pl.handle([x1, b0 + db], { key: 'q', r: 6.5, fill: C.loop, stroke: '#fff', ariaLabel: '(x₁, b₀ + Δb)', onDrag: (x, y) => setCorner(1, [x, y]) });
    }
  }

  async function update(retex) {
    const L = cur(), lam = lamOf(L), q = at(L, lam), p = P();
    sL.input.min = L.l0; sL.input.max = L.l1; sL.input.step = (L.l1 - L.l0) / NSTEP; sL.set(lam, false);
    sK.input.disabled = st.conn !== 'k'; sK.el.classList.toggle('dg-disabled', st.conn !== 'k');
    plot.update();
    const [zl, zE] = transport(st.conn, L, st.z0, lam < L.l1 ? [lam, L.l1] : [L.l1, L.l1], st.kappa);
    const col = v => v.map(x => [x]);
    mX.set(col(zl)); mY.set(col(toY(q, zl))); mD.set(col([zE[0] - st.z0[0], zE[1] - st.z0[1]]));
    const { T, R } = torsionCurvature(st.conn, q, st.kappa);
    mT.set(col(T)); mR.set(R);
    // the closed form the notes give for this connection and loop
    let F = null, val = '', ftex = '';
    if (st.loop === 'delta' && st.conn === 'E') {
      const c = st.z0, r0 = st.r0;
      F = [c[0] * Math.cos(lam) + c[1] * Math.sin(lam), (-c[0] * Math.sin(lam) + c[1] * Math.cos(lam)) / r0];
      ftex = '\\(z^1(\\lambda) = c_1 \\cos \\lambda + c_2 \\sin \\lambda\\), \\(z^2(\\lambda) = (-c_1 \\sin \\lambda + c_2 \\cos \\lambda) / r_0\\)';
    } else if (st.loop === 'delta' && st.conn === 'W') {
      const [z1, z2] = toY(p, st.z0), r0 = st.r0;
      F = [z1 * Math.cos(lam) - r0 * z2 * Math.sin(lam), z1 * Math.sin(lam) + r0 * z2 * Math.cos(lam)];
      ftex = '\\(\\big( z^1 \\cos \\lambda - r_0 z^2 \\sin \\lambda, \\; z^1 \\sin \\lambda + r_0 z^2 \\cos \\lambda \\big)\\)';
    } else if (st.loop === 'rect' && st.conn === 'k') {
      const [x0, x1, , db] = st.rect;
      val = fmt(-st.kappa * st.z0[1] * (x1 - x0) * db, 3);
      ftex = '\\(\\Delta z^1 = -\\kappa \\, z^2 \\, (x_1 - x_0) \\, \\Delta b =\\)';
    } else if (st.loop === 'rect') ftex = '\\(\\Delta z = 0\\)';
    rowF.hidden = !ftex;
    mF.el.hidden = !F;
    if (F) mF.set(col(F));
    fVal.textContent = val;
    stage.dataset.state = JSON.stringify({ ...st, lam });
    if (retex) {
      const g = LOOP[st.loop];
      await Promise.all([
        setMath(tX, `\\(\\text{chart } \\mathscr{X}: \\; z^k(\\lambda) =\\)`), setMath(tY, `\\(\\text{chart } \\mathscr{Y}: \\; z^k(\\lambda) =\\)`),
        setMath(tD, '\\(\\Delta z^k =\\)'), setMath(tF, ftex && !val && F ? ftex.replace(/\\\)$/, ' =\\)') : ftex),
        setMath(tT, `\\(\\mathtt{T}^i_{12}\\big( ${g}(\\lambda) \\big) =\\)`), setMath(tR, `\\(\\mathrm{Riem}^i_{j12}\\big( ${g}(\\lambda) \\big) =\\)`)]);
      leg.replaceChildren(legend([{ label: `\\(${g}\\)`, color: C.loop, width: 2.4 }, { label: '\\(\\mathcal{Z}\\) at \\(p\\)', color: 'currentColor', width: 2.4 },
        { label: 'after the full loop', color: C.end, dash: '5 3', width: 2.2 }, { label: '\\(\\mathcal{Z}(\\lambda)\\)', color: C.cur, width: 2.6 },
        { label: 'autoparallel with velocity \\(\\mathcal{Z}\\) at \\(p\\)', color: C.auto, dash: '6 4', width: 1.4 }]));
      await typeset(leg);
    }
  }
  await update(true);
  await typeset(body);
}
