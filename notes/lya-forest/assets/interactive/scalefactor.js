// Hand-written (not generated): interactive after Figure 1 (label fig:a_of_x), § 2.3. Notebook
// notebooks/02_cosmology.ipynb of SkewerJAX, which drew Figure 1 (Lyα DECISIONS L20, L25).
// a(x) along a ray through the observer (x = 0, a = 1) by RK4 on Eq. (dadx_general) with the upper sign, as in
// Figure 1 (ray.js trace), for a background the reader sets (Ω_r, Ω_m, Ω_Λ; Ω_k = 1 − Ω_r − Ω_m − Ω_Λ, Eq.
// (Hubble_a_background) at a = 1), drawn over the four backgrounds of Figure 1 with the analytic solutions of § 2.3.1
// (matter: a = (1 + H0 x/(2c))², radiation: a = 1 + H0 x/c; Λ: a = 1/(1 − H0 x/c), the solution of da/dx = (H0/c) a²
// that Figure 1 also draws). The reader sees where each component sets the shape: radiation and matter end the
// past ray at a = 0 at a finite distance, Λ sends a to infinity at a finite distance in the future, and curvature
// enters through 1 − κx², which can end the ray before either.
import { el, controls, slider, toggle, note, legend, fmt, Plot2D, palette } from './dg.js';
import { typeset } from '../course.js';
import { H0, C_OVER_H0, BACKGROUNDS, trace } from './ray.js';

export const START = { m: 0.3089, l: 0.6911, logr: Math.log10(9.1436e-5), refs: true };
export const XLIM = [-9000, 4500], YLIM = [-4, 3];        // x [Mpc], log10 a (Figure 1's ranges)
const C = { user: '#0a6a7b', radiation: '#d1323f', matter: '#3d6bd6', lambda: '#2c9a3a', planck: palette.ink };
const ANALYTIC = {
  radiation: x => 1 + x / C_OVER_H0,
  matter: x => (1 + x / (2 * C_OVER_H0)) ** 2,
  lambda: x => 1 / (1 - x / C_OVER_H0),
};

/** The ray through (0, 1) for the background om on [XLIM] (Mpc): past and future halves, where and why each ended. */
export function ray(om) {
  const half = x1 => {
    const r = trace(om, 0, 1, x1 / C_OVER_H0, { n: 900, amax: 1e4 });
    const [xe, ae] = r.pts[r.pts.length - 1];
    let why = null;
    if (r.ended) why = ae < 1e-2 ? 'a0' : ae > 1e2 ? 'inf' : 'curv';
    return { pts: r.pts.map(([x, a]) => [x * C_OVER_H0, a]), ended: r.ended, x: xe * C_OVER_H0, why };
  };
  return { past: half(XLIM[0]), future: half(XLIM[1]) };
}
export const omega = st => ({ r: 10 ** st.logr, m: st.m, l: st.l, k: 1 - 10 ** st.logr - st.m - st.l });

export default async function mount(body) {
  const st = { ...START };
  body.append(note('Set the density parameters of the background; \\(\\Omega_k\\) follows from them. The thin curves are the backgrounds of the figure, solid numerical and dashed analytic.'));
  const bar = controls(body);
  bar.append(slider({ label: '\\(\\Omega_m\\)', aria: 'Omega m', min: 0, max: 2, step: 0.01, value: st.m, format: v => fmt(v, 2), onInput: v => { st.m = v; update(); } }).el);
  bar.append(slider({ label: '\\(\\Omega_\\Lambda\\)', aria: 'Omega Lambda', min: -0.5, max: 1.5, step: 0.01, value: st.l, format: v => fmt(v, 2), onInput: v => { st.l = v; update(); } }).el);
  const bar2 = controls(body);
  bar2.append(slider({ label: '\\(\\log_{10}\\Omega_r\\)', aria: 'log10 Omega r', min: -6, max: 0, step: 0.05, value: st.logr, format: v => fmt(v, 2), onInput: v => { st.logr = v; update(); } }).el);
  bar2.append(toggle({ label: 'backgrounds of the figure', value: st.refs, onChange: v => { st.refs = v; update(); } }).el);

  // the four backgrounds of Figure 1 (fixed: computed once)
  const refs = Object.fromEntries(Object.entries(BACKGROUNDS).map(([k, om]) => [k, ray(om)]));
  let R = null;
  const lg = a => Math.log10(a);
  const curve = (pl, h, opt) => { const p = h.pts.filter(([, a]) => a > 0).map(([x, a]) => [x, lg(a)]).filter(([, y]) => y >= YLIM[0] - 1 && y <= YLIM[1] + 1);
    if (p.length > 1) pl.line(p.map(([x, y]) => [x, Math.max(YLIM[0], Math.min(YLIM[1], y))]), opt); };
  const box = el('div');
  const plot = new Plot2D(box, { xlim: XLIM, ylim: YLIM, aspect: 0.55, maxWidth: 760, margin: { l: 46, r: 12, t: 10, b: 30 },
    label: 'Scale factor a(x) along the ray, log scale', draw(pl) {
      if (!R) return;
      if (st.refs) for (const k of Object.keys(BACKGROUNDS)) {
        for (const h of [refs[k].past, refs[k].future]) curve(pl, h, { color: C[k], width: 1.1, opacity: 0.55 });
        if (ANALYTIC[k]) pl.fn(x => { const a = ANALYTIC[k](x); return a > 0 ? Math.max(YLIM[0], Math.min(YLIM[1], lg(a))) : YLIM[0]; },
          Math.max(XLIM[0], refs[k].past.x), Math.min(XLIM[1], refs[k].future.x), { color: C[k], width: 1.1, dash: '5 4', opacity: 0.7, n: 400 });
      }
      for (const h of [R.past, R.future]) curve(pl, h, { color: C.user, width: 2.6 });
      for (const h of [R.past, R.future]) if (h.ended) pl.line([[h.x, YLIM[0]], [h.x, YLIM[1]]], { color: C.user, width: 1, dash: '3 3' });
      pl.point([0, 0], { r: 3.5, fill: palette.ink });
      pl.label('x', [XLIM[1], YLIM[0]], '\\(x\\) [Mpc]', { anchor: 'se', dy: -3, dx: -4, class: 'dg-axis-label' });
      pl.label('y', [XLIM[0], YLIM[1]], '\\(\\log_{10} a\\)', { anchor: 'nw', dx: 4, dy: 2, class: 'dg-axis-label' });
    } });
  Object.defineProperty(plot.o, 'aspect', { get: () => (plot.wrap.clientWidth < 560 ? 0.8 : 0.55) });
  const val = () => el('span', { class: 'dg-gr-val' });
  const v = { k: val(), past: val(), future: val() };
  const pair = (t, x) => el('span', { class: 'dg-gr-pair' }, el('span', {}, `\\(${t}\\)`), x);
  const out = el('div', { class: 'dg-eqrow', style: 'gap: 0.4rem 1.6rem' });
  out.append(pair('\\Omega_k =', v.k), pair('\\text{past end:}', v.past), pair('\\text{future end:}', v.future));
  body.append(box, legend([{ label: 'this background', color: C.user, width: 2.6 }, { label: 'radiation', color: C.radiation, width: 1.4 },
    { label: 'matter', color: C.matter, width: 1.4 }, { label: '\\(\\Lambda\\)', color: C.lambda, width: 1.4 }, { label: 'Planck 2018', color: 'currentColor', width: 1.4 }]), out);

  const WHY = { a0: 'a = 0', inf: 'a → ∞', curv: '1 − κx² = 0' };
  const end = h => (h.ended ? `${WHY[h.why]} at ${fmt(h.x, 0)} Mpc` : `beyond ${fmt(h === R.past ? XLIM[0] : XLIM[1], 0)} Mpc`);
  function update() {
    const om = omega(st);
    R = ray(om);
    plot.update();
    v.k.textContent = fmt(om.k, 4); v.past.textContent = end(R.past); v.future.textContent = end(R.future);
    body.dataset.state = JSON.stringify({ ...st, k: om.k, past: { ended: R.past.ended, x: R.past.x, why: R.past.why },
      future: { ended: R.future.ended, x: R.future.x, why: R.future.why }, H0 });
  }
  update();
  await typeset(body);
}
