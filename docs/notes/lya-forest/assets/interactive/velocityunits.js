// Hand-written (not generated): interactive at the end of § 3.2.4 (label subsubsec:approx_velocity_units). Notebook
// notebooks/12_comparison_fake_spectra_results.ipynb of SkewerJAX (Lyα DECISIONS L20, L25).
// The exact velocity coordinate of a gas element at rest, u_exact(x) = c ln(a_†/a(x)) (Appendix C, Eq.
// (velocity_line_scale_factor_appendix)), against the single-snapshot coordinate u_H(x) = H(z_box)/(1 + z_box)
// (x − x_†) of Eq. (velocity_units_snapshot_maintext) / (vj_snapshot_linear_appendix_new), across a box of comoving
// length L_box centred on x_† with a(x_†) = a_† = 1/(1 + z_box). a(x) is Eq. (dadx_general) (lower sign: a decreases
// as x grows away from the observer) for the Planck background of Figure 1 (ray.js). The reader changes z_box and
// L_box and sees the two coordinates agree at the centre and drift apart towards the edges of the box, the drift
// growing about as L_box², compared with the thermal width b_th of Lyα at 10⁴ K (§ 3.1.3).
import { el, controls, slider, note, legend, fmt, Plot2D, palette } from './dg.js';
import { typeset } from '../course.js';
import { C_KMS, LINES, widths, hubble } from './lya.js';
import { H0, C_OVER_H0, BACKGROUNDS, trace } from './ray.js';

export const START = { z: 2.4, logL: 2 };
const OM = BACKGROUNDS.planck, NPTS = 200;
export const BTH = widths(LINES.lya, 1e4, 0, 0).bth;     // b_th of Lyα at 10⁴ K [km/s]
const C = { exact: '#0a6a7b', approx: '#d68b02', diff: '#6c3fa0', band: '#0a6a7b', bandKey: '#b9dde3' };

/** u_exact and u_H [km/s] at NPTS + 1 points x − x_† in [−L/2, L/2] [Mpc], for z_box and L_box = 10^logL Mpc. */
export function coords(st) {
  const L = 10 ** st.logL, ad = 1 / (1 + st.z), slope = H0 * hubble(ad, OM) * ad;      // H(z)/(1 + z) [km/s/Mpc]
  const side = s => trace(OM, 0, ad, s * L / 2 / C_OVER_H0, { sign: -1, n: NPTS / 2 }).pts;
  const pts = [...side(-1).reverse(), ...side(1).slice(1)].map(([x, a]) => [x * C_OVER_H0, a]);
  const rows = pts.map(([x, a]) => ({ x, a, exact: C_KMS * Math.log(ad / a), approx: slope * x }));
  const diff = rows.map(r => r.approx - r.exact);
  const first = rows[0], last = rows[rows.length - 1];
  return { L, ad, slope, rows, maxDiff: Math.max(...diff.map(Math.abs)),
    umaxExact: last.exact - first.exact, umaxApprox: slope * L, aStart: last.a, aEnd: first.a };
}

export default async function mount(body) {
  const st = { ...START };
  body.append(note('Change the redshift of the snapshot and the comoving length of the box along the line of sight.'));
  const bar = controls(body);
  bar.append(slider({ label: '\\(z_{\\rm box}\\)', aria: 'z box', min: 0.1, max: 6, step: 0.05, value: st.z, format: v => fmt(v, 2), onInput: v => { st.z = v; update(); } }).el);
  bar.append(slider({ label: '\\(L_{\\rm box}\\)', aria: 'L box', min: 1, max: 3.3, step: 0.02, value: st.logL, format: v => `${fmt(10 ** v, 0)} Mpc`,
    onInput: v => { st.logL = v; update(); } }).el);

  let S = null;
  const margin = { l: 56, r: 12, t: 8, b: 28 };
  const ylab = (pl, t) => pl.label('y', [pl.o.xlim[0], pl.o.ylim[1]], t, { anchor: 'nw', dx: 4, dy: 2, class: 'dg-axis-label' });
  const xlab = pl => pl.label('x', [pl.o.xlim[1], pl.o.ylim[0]], '\\(x - x_\\dagger\\) [Mpc]', { anchor: 'se', dy: -3, dx: -4, class: 'dg-axis-label' });
  const boxU = el('div'), boxD = el('div');
  const pU = new Plot2D(boxU, { xlim: [-1, 1], ylim: [-1, 1], aspect: 0.4, maxWidth: 760, margin,
    label: 'Exact and single-snapshot velocity coordinates across the box', draw(pl) {
      if (!S) return;
      pl.line(S.rows.map(r => [r.x, r.approx]), { color: C.approx, width: 1.6, dash: '6 4' });
      pl.line(S.rows.map(r => [r.x, r.exact]), { color: C.exact, width: 2.2 });
      ylab(pl, '[km/s]'); xlab(pl);
    } });
  const pD = new Plot2D(boxD, { xlim: [-1, 1], ylim: [-1, 1], aspect: 0.28, maxWidth: 760, margin,
    label: 'Difference of the two coordinates, with the thermal width of Lyman-α at 10^4 K', draw(pl) {
      if (!S) return;
      const [x0, x1] = pl.o.xlim, b = Math.min(BTH, pl.o.ylim[1]);
      pl.area([[x0, -b], [x1, -b], [x1, b], [x0, b]], { fill: C.band, opacity: 0.12 });
      pl.line(S.rows.map(r => [r.x, r.approx - r.exact]), { color: C.diff, width: 2 });
      ylab(pl, '\\(u_H - u_{\\rm exact}\\) [km/s]'); xlab(pl);
    } });
  for (const [p, a, b] of [[pU, 0.4, 0.6], [pD, 0.28, 0.45]]) Object.defineProperty(p.o, 'aspect', { get: () => (p.wrap.clientWidth < 560 ? b : a) });
  const val = () => el('span', { class: 'dg-gr-val' });
  const v = { slope: val(), exact: val(), approx: val(), diff: val() };
  const pair = (t, x) => el('span', { class: 'dg-gr-pair' }, el('span', {}, `\\(${t}\\)`), x);
  const out = el('div', { class: 'dg-eqrow', style: 'gap: 0.4rem 1.6rem' });
  out.append(pair('\\tfrac{H(z_{\\rm box})}{1+z_{\\rm box}} =', v.slope), pair('c\\ln\\tfrac{a(x_\\dagger - L_{\\rm box}/2)}{a(x_\\dagger + L_{\\rm box}/2)} =', v.exact),
    pair('u_{\\max} \\approx', v.approx), pair('\\max|u_H - u_{\\rm exact}| =', v.diff));
  body.append(boxU, boxD, legend([{ label: '\\(u_{\\rm exact}(x)\\)', color: C.exact, width: 2.2 }, { label: '\\(u_H(x)\\)', color: C.approx, width: 1.6, dash: '6 4' },
    { label: '\\(\\pm b_{\\rm th}\\) (Ly\\(\\alpha\\), \\(10^4\\) K)', color: C.bandKey, width: 6 }]), out);

  function update() {
    S = coords(st);
    const h = S.L / 2, ue = Math.max(...S.rows.map(r => Math.abs(r.exact)), ...S.rows.map(r => Math.abs(r.approx)));
    pU.o.xlim = [-h, h]; pD.o.xlim = [-h, h];
    pU.o.ylim = [-1.08 * ue, 1.08 * ue];
    const dmax = Math.max(1.6 * BTH, 1.15 * S.maxDiff);
    pD.o.ylim = [-dmax, dmax];
    pU.update(); pD.update();
    v.slope.textContent = `${fmt(S.slope, 2)} km/s/Mpc`; v.exact.textContent = `${fmt(S.umaxExact, 1)} km/s`;
    v.approx.textContent = `${fmt(S.umaxApprox, 1)} km/s`;
    v.diff.textContent = `${S.maxDiff < 0.01 ? S.maxDiff.toExponential(1) : fmt(S.maxDiff, 2)} km/s = ${fmt(S.maxDiff / BTH, 2)} b_th`;
    body.dataset.state = JSON.stringify({ ...st, L: S.L, slope: S.slope, umaxExact: S.umaxExact, umaxApprox: S.umaxApprox, maxDiff: S.maxDiff });
  }
  update();
  await typeset(body);
}
