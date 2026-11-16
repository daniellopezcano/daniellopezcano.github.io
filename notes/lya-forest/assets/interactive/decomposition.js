// Hand-written (not generated): interactive after Eq. (xi1D_ensemble_L2_decomposition), § 5.3. Notebook
// notebooks/10_skewer_statistics.ipynb of SkewerJAX (Lyα DECISIONS L20, L25).
// The total ξ(Δ) of two transitions absorbed by the same toy gas, Lyα (j = 1) and Si III 1206 (j = 2), and the terms
// of Eq. (xi1D_ensemble_L2_decomposition), each divided by (1 + C_12)², in the colours the notes give them
// (\TextZero gray, \TextTwo green, \TextThree yellow, \TextFour orange; the boxes' hues, darkened for lines):
// decompstats.js computes them. The reader raises the density of the second absorber and sees the cross term
// ξ_12,sym grow a peak at the separation of the two lines on the spectral axis, Δ = c ln(λ_1/λ_2) (Appendix B.1), which
// the total ξ inherits; the order-3 and order-4 terms and C_12 stay small for weak absorption. Each group can be
// hidden; the total is the sum of all of them (and equals the correlation of δ = T/T̄ − 1 of T = T_1 T_2).
import { el, controls, slider, toggle, note, legend, fmt, Plot2D, palette } from './dg.js';
import { typeset } from '../course.js';
import { decompose, unitTaus, SHIFT, TOY } from './decompstats.js';

export const START = { logr: -1.5, o0: true, o2: true, o3: true, o4: true };
// the hues of the notes' colour boxes (gray, green, yellow, orange of xcolor), darkened so that a line reads on paper
const C = { total: palette.ink, c: '#7a7a7a', x11: '#2e8b3a', x22: '#2e8b3a', x12: '#2e8b3a', x1p: '#b38f00', x2p: '#b38f00', xpp: '#d9730d' };
const DASH = { x11: null, x22: '6 4', x12: '2 3', x1p: null, x2p: '6 4' };
const GROUP = { c: 'o0', x11: 'o2', x22: 'o2', x12: 'o2', x1p: 'o3', x2p: 'o3', xpp: 'o4' };

export default async function mount(body) {
  const st = { ...START };
  body.append(note('Change the density of the second absorber (Si III, relative to H I) and show or hide the terms of each order.'));
  const bar = controls(body);
  bar.append(slider({ label: '\\(\\log_{10}(\\bar n_{2}/\\bar n_{1})\\)', aria: 'log10 of the density ratio', min: -4, max: -0.5, step: 0.05, value: st.logr, format: v => fmt(v, 2),
    onInput: v => { st.logr = v; update(); } }).el);
  const bar2 = controls(body);
  for (const [k, t] of [['o0', 'order 0'], ['o2', 'order 2'], ['o3', 'order 3'], ['o4', 'order 4']]) {
    bar2.append(toggle({ label: t, value: st[k], onChange: v => { st[k] = v; plot.update(); report(); } }).el);
  }

  unitTaus();                                            // the sightlines (about a second, once)
  let S = null;
  const box = el('div');
  const plot = new Plot2D(box, { xlim: [0, TOY.dmax], ylim: [-0.02, 0.06], aspect: 0.5, maxWidth: 760, margin: { l: 56, r: 12, t: 10, b: 30 },
    label: 'Total 1D 2PCF and the terms of its L = 2 decomposition against the lag', draw(pl) {
      if (!S) return;
      const [lo, hi] = pl.o.ylim, clip = y => Math.max(lo, Math.min(hi, y));
      pl.line([[pl.o.xlim[0], 0], [pl.o.xlim[1], 0]], { color: palette.axis, width: 0.8 });
      const sep = -SHIFT;
      pl.line([[sep, lo], [sep, hi]], { color: palette.muted, width: 1, dash: '3 3' });
      for (const [k, t] of Object.entries(S.terms)) if (st[GROUP[k]]) pl.line(S.lags.map((x, q) => [x, clip(t[q])]), { color: C[k], width: 1.6, dash: DASH[k] });
      pl.line(S.lags.map((x, q) => [x, clip(S.sum[q])]), { color: C.total, width: 2.4 });
      pl.label('x', [pl.o.xlim[1], lo], '\\(\\Delta\\) [km/s]', { anchor: 'se', dy: -3, dx: -4, class: 'dg-axis-label' });
      pl.label('y', [pl.o.xlim[0], hi], '\\(\\xi(\\Delta)\\)', { anchor: 'nw', dx: 4, dy: 2, class: 'dg-axis-label' });
      pl.label('sep', [sep, hi], '\\(c\\ln(\\lambda_1/\\lambda_2)\\)', { anchor: 'ne', dx: -4, dy: 2, class: 'dg-axis-label' });
    } });
  Object.defineProperty(plot.o, 'aspect', { get: () => (plot.wrap.clientWidth < 560 ? 0.75 : 0.5) });
  const val = () => el('span', { class: 'dg-gr-val' });
  const v = { C: val(), Tb: val(), at: val(), cross: val() };
  const pair = (t, x) => el('span', { class: 'dg-gr-pair' }, el('span', {}, `\\(${t}\\)`), x);
  const out = el('div', { class: 'dg-eqrow', style: 'gap: 0.4rem 1.6rem' });
  out.append(pair('C_{12} =', v.C), pair('\\bar T_1,\\ \\bar T_2 =', v.Tb), pair('\\xi\\big(c\\ln\\tfrac{\\lambda_1}{\\lambda_2}\\big) =', v.at),
    pair('\\tfrac{\\xi_{12,\\mathrm{sym}}}{(1+C_{12})^2}\\big(c\\ln\\tfrac{\\lambda_1}{\\lambda_2}\\big) =', v.cross));
  body.append(box, legend([{ label: '\\(\\xi\\)', color: 'currentColor', width: 2.4 }, { label: '\\(-C_{12}C_{12}\\)', color: C.c, width: 1.6 },
    { label: '\\(\\xi_{11}\\)', color: C.x11, width: 1.6 }, { label: '\\(\\xi_{22}\\)', color: C.x22, width: 1.6, dash: DASH.x22 },
    { label: '\\(\\xi_{12,\\mathrm{sym}}\\)', color: C.x12, width: 1.6, dash: DASH.x12 }, { label: '\\(\\xi_{1(12),\\mathrm{sym}}\\)', color: C.x1p, width: 1.6 },
    { label: '\\(\\xi_{2(12),\\mathrm{sym}}\\)', color: C.x2p, width: 1.6, dash: DASH.x2p }, { label: '\\(\\xi_{(12)(12)}\\)', color: C.xpp, width: 1.6 }]), out);

  const at = (arr, x) => arr[Math.round(x / (TOY.du * TOY.stride))];
  function report() {
    body.dataset.state = JSON.stringify({ ...st, C: S.C, Tb1: S.Tb1, Tb2: S.Tb2, at: at(S.sum, -SHIFT), cross: at(S.terms.x12, -SHIFT), xi0: S.sum[0] });
  }
  function update() {
    S = decompose(st.logr);
    // the lag-0 value of the autos is far above the rest: the axis is set by Δ ≥ 200 km/s
    const far = S.lags.map((x, q) => (x >= 200 ? Math.max(Math.abs(S.sum[q]), ...Object.values(S.terms).map(t => Math.abs(t[q]))) : 0));
    const m = Math.max(0.01, ...far) * 1.25;
    plot.o.ylim = [-0.45 * m, m];
    plot.update();
    v.C.textContent = S.C.toExponential(2); v.Tb.textContent = `${fmt(S.Tb1, 3)}, ${fmt(S.Tb2, 3)}`;
    v.at.textContent = at(S.sum, -SHIFT).toExponential(2); v.cross.textContent = at(S.terms.x12, -SHIFT).toExponential(2);
    report();
  }
  update();
  await typeset(body);
}
