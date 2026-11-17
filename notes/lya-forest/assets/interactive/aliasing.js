// Hand-written (not generated): interactive after Figure 14 (label fig:DFT_aliasing), § 6.7. Notebook
// notebooks/08_toy_field_statistics.ipynb of SkewerJAX (Lyα DECISIONS L20).
// Along the line of sight (1D), on a grid of spacing d (the notes' dΛ), k_Ny = π/d. Eq. (DFT_ensemble) in 1D:
//   P^alias(k) = Σ_c P(k + 2c k_Ny),  c ∈ ℤ,
// truncated at |c| ≤ CMAX = 10: for |k| ≤ k_Ny every omitted term has |k + 2c k_Ny| ≥ 21 k_Ny, and relative to P(k)
// they sum to less than 2 Σ_{c>10} e^{−4c(c−1)(k_Ny/k_c)²} < 10⁻²⁹ over the slider's range (k_Ny ≥ 0.39 k_c).
// The pixel average (the paragraph after Figure 14): each term multiplied by |W_pix|², W_pix(k) = sinc(k d/2):
//   P^alias_pix(k) = Σ_c P(k + 2c k_Ny) sinc²((k + 2c k_Ny) d/2).
// Toy spectrum (no random field): P(k) = e^{−(k/k_c)²} / (1 + (k/k_1)²), k_1 = k_c/2: flat at small k, then a
// small-scale cutoff (the shape of a 1D flux power spectrum, cut by thermal broadening); k in units of k_c. The reader
// changes d and sees the folded copies, negligible when k_Ny is a few k_c (the pixels resolve the cutoff) and growing
// with coarser pixels; with the pixel average, the folded terms shrink (each c ≠ 0 term is multiplied by
// sinc² < 1, which vanishes at k = 0) while the c = 0 term is tilted down near k_Ny (sinc²(π/2) = 0.405 there).
// Readouts at k = k_Ny/2: (P^alias − P)/P, and with the pixel average P^alias_pix/(P |W_pix|²) − 1 (the folded part)
// and P^alias_pix/P; the first two as (the terms c ≠ 0)/(the term c = 0), so that a tiny fraction is not lost to rounding.
import { el, controls, slider, toggle, note, legend, fmt, Plot2D, palette } from './dg.js';
import { typeset } from '../course.js';

export const TOY = { kc: 1, k1: 0.5 };
export const CMAX = 10, COPIES = [1, 2, 3];
export const LOGD = { min: -0.3, max: 0.9, step: 0.01 };
export const START = { logd: 0.6, pix: false };
const C = { P: '#222222', copy: '#d68b02', alias: '#0a6a7b', pix: '#6c3fa0', mark: '#444444' };
const XLIM = [-1.5, 1.2], YLIM = [-7, 1.5];

/** The toy power spectrum. */
export const P = k => Math.exp(-((k / TOY.kc) ** 2)) / (1 + (k / TOY.k1) ** 2);
/** |W_pix(k)|² = sinc²(k d/2). */
export const W2 = (k, d) => { const x = k * d / 2; return x === 0 ? 1 : (Math.sin(x) / x) ** 2; };
/** One term of the aliasing sum, P(k + 2c k_Ny), times |W_pix|² there when pix. */
export const term = (k, c, d, pix) => { const q = k + 2 * c * Math.PI / d; return P(q) * (pix ? W2(q, d) : 1); };
/** Eq. (DFT_ensemble) in 1D: Σ_{|c| ≤ CMAX} of the terms. */
export function alias(k, d, pix) { let s = 0; for (let c = -CMAX; c <= CMAX; c++) s += term(k, c, d, pix); return s; }
/** The folded part, the terms c ≠ 0 (summed apart so that a tiny fraction is not lost to rounding). */
export function folded(k, d, pix) { let s = 0; for (let c = 1; c <= CMAX; c++) s += term(k, -c, d, pix) + term(k, c, d, pix); return s; }
/** The readouts at k = k_Ny/2: (P^alias − P)/P, P^alias_pix/(P |W_pix|²) − 1 and P^alias_pix/P. */
export function readouts(d) {
  const k = Math.PI / d / 2, p = P(k);
  return { kNy: Math.PI / d, frac: folded(k, d, false) / p, fpix: folded(k, d, true) / (p * W2(k, d)), rpix: alias(k, d, true) / p };
}
/** A fraction as a percentage. */
export const pct = x => (100 * x < 0.005 ? '< 0.01 %' : `${fmt(100 * x, 2)} %`);

export default async function mount(body) {
  const st = { ...START };
  body.append(note('Change the pixel size \\(d\\) and switch the pixel average on or off.'));
  const bar = controls(body);
  bar.append(slider({ label: '\\(k_{\\rm c}\\,d\\)', aria: 'k c times d', min: LOGD.min, max: LOGD.max, step: LOGD.step, value: st.logd, format: v => fmt(10 ** v, 2),
    onInput: v => { st.logd = v; update(); } }).el);
  bar.append(toggle({ label: 'pixel average, \\(W_{\\rm pix}=\\mathrm{sinc}(kd/2)\\)', aria: 'pixel average', value: st.pix,
    onChange: v => { st.pix = v; update(); setLegend(); } }).el);

  let R = null;
  const lg = Math.log10, box = el('div');
  // a curve in (log10 k, log10 y): the runs of points inside the plot (the bottom cut off, the top clamped)
  const curve = (pl, f, a, b, opt, n = 300) => {
    let cur = [];
    const flush = () => { if (cur.length > 1) pl.line(cur, opt); cur = []; };
    for (let i = 0; i <= n; i++) {
      const x = lg(a) + (lg(b) - lg(a)) * i / n, v = f(10 ** x), y = v > 0 ? lg(v) : -Infinity;
      if (y >= YLIM[0]) cur.push([x, Math.min(YLIM[1], y)]); else flush();
    }
    flush();
  };
  const plot = new Plot2D(box, { xlim: XLIM, ylim: YLIM, yticks: [-6, -4, -2, 0], aspect: 0.55, maxWidth: 760, margin: { l: 46, r: 12, t: 10, b: 30 },
    label: 'The power spectrum, its copies shifted by multiples of 2 k_Ny and their sum on 0 < k ≤ k_Ny, log scales', draw(pl) {
      if (!R) return;
      const d = R.d, kNy = R.kNy, k0 = 10 ** XLIM[0], xNy = lg(kNy), xh = lg(kNy / 2);
      pl.area([[xNy, YLIM[0]], [XLIM[1], YLIM[0]], [XLIM[1], YLIM[1]], [xNy, YLIM[1]]], { fill: '#cfcfcf', opacity: 0.45 });
      pl.line([[xNy, YLIM[0]], [xNy, YLIM[1]]], { color: C.mark, width: 1, dash: '5 4' });
      pl.line([[xh, YLIM[0]], [xh, YLIM[1]]], { color: palette.muted, width: 1, dash: '2 3' });
      curve(pl, P, k0, 10 ** XLIM[1], { color: C.P, width: 1.5, dash: '6 4' }, 400);
      for (const c of COPIES) for (const s of [-1, 1]) curve(pl, k => term(k, s * c, d, st.pix), k0, kNy, { color: C.copy, width: 1.6, dash: '2 3' });
      curve(pl, k => alias(k, d, false), k0, kNy, { color: C.alias, width: 2.4 });
      if (st.pix) curve(pl, k => alias(k, d, true), k0, kNy, { color: C.pix, width: 2.4 });
      const dot = (v, color) => { const y = lg(v); if (y >= YLIM[0] && y <= YLIM[1]) pl.point([xh, y], { r: 3.5, fill: color, stroke: '#fff', strokeWidth: 1 }); };
      dot(alias(kNy / 2, d, false), C.alias);
      if (st.pix) dot(alias(kNy / 2, d, true), C.pix);
      pl.label('ny', [xNy, YLIM[1]], '\\(k_{\\rm Ny}\\)', { anchor: 'nw', dx: 4, dy: 3 });
      pl.label('ny2', [xh, YLIM[1]], '\\(k_{\\rm Ny}/2\\)', { anchor: 'ne', dx: -4, dy: 24 });
      pl.label('x', [XLIM[1], YLIM[0]], '\\(\\log_{10}(k/k_{\\rm c})\\)', { anchor: 'se', dy: -3, dx: -4, class: 'dg-axis-label' });
      pl.label('y', [XLIM[0], YLIM[1]], '\\(\\log_{10}P\\)', { anchor: 'nw', dx: 4, dy: 2, class: 'dg-axis-label' });
    } });
  Object.defineProperty(plot.o, 'aspect', { get: () => (plot.wrap.clientWidth < 560 ? 0.85 : 0.55) });

  const val = () => el('span', { class: 'dg-gr-val' });
  const v = { kNy: val(), frac: val(), fpix: val(), rpix: val() };
  const pair = (t, x) => el('span', { class: 'dg-gr-pair' }, el('span', {}, `\\(${t}\\)`), x);
  const pixPairs = [pair('\\big[P^{\\rm alias}_{\\rm pix}/(P\\,|W_{\\rm pix}|^2) - 1\\big]_{k_{\\rm Ny}/2} =', v.fpix), pair('\\big[P^{\\rm alias}_{\\rm pix}/P\\big]_{k_{\\rm Ny}/2} =', v.rpix)];
  const out = el('div', { class: 'dg-eqrow', style: 'gap: 0.4rem 1.6rem' });
  out.append(pair('k_{\\rm Ny}/k_{\\rm c} = \\pi/(k_{\\rm c}\\,d) =', v.kNy), pair('\\big[(P^{\\rm alias} - P)/P\\big]_{k_{\\rm Ny}/2} =', v.frac), ...pixPairs);
  const legendBox = el('div');
  body.append(box, legendBox, out);
  function legendFor(pix) {
    return legend([
      { label: '\\(P(k)=e^{-k^2/k_{\\rm c}^2}\\big/\\big(1+4k^2/k_{\\rm c}^2\\big)\\)', color: 'currentColor', width: 1.5, dash: '6 4' },
      { label: pix ? '\\((P\\,|W_{\\rm pix}|^2)(k+2ck_{\\rm Ny})\\), \\(c=\\pm1,\\pm2,\\pm3\\)' : '\\(P(k+2ck_{\\rm Ny})\\), \\(c=\\pm1,\\pm2,\\pm3\\)', color: C.copy, width: 1.6, dash: '2 3' },
      { label: '\\(P^{\\rm alias}=\\sum_c P(k+2ck_{\\rm Ny})\\)', color: C.alias, width: 2.4 },
      ...(pix ? [{ label: '\\(P^{\\rm alias}_{\\rm pix}=\\sum_c (P\\,|W_{\\rm pix}|^2)(k+2ck_{\\rm Ny})\\)', color: C.pix, width: 2.4 }] : [])]);
  }
  async function setLegend() { const l = legendFor(st.pix); legendBox.replaceChildren(l); await typeset(l); }

  function update() {
    const d = 10 ** st.logd;
    R = { d, ...readouts(d) };
    plot.update();
    v.kNy.textContent = fmt(R.kNy, 3); v.frac.textContent = pct(R.frac); v.fpix.textContent = pct(R.fpix); v.rpix.textContent = fmt(R.rpix, 3);
    for (const p of pixPairs) p.style.display = st.pix ? '' : 'none';
    body.dataset.state = JSON.stringify({ ...st, d, kNy: R.kNy, frac: R.frac, fpix: R.fpix, rpix: R.rpix, ...TOY, CMAX });
  }
  legendBox.append(legendFor(st.pix));
  update();
  await typeset(body);
}
