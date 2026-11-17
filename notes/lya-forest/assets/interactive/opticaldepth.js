// Hand-written (not generated): interactive after Figure 5 (label fig:optical_depth), § 3.4. Notebook
// notebooks/07_deposition_and_optical_depth.ipynb of SkewerJAX (Lyα DECISIONS L20, L25).
// The optical depth of Eq. (tau_straight_los) along one toy sightline (skewer.js: a(x) from Eq. (2.5), the local
// wavelength of Eq. (wavelength_cosmological_z_and_doppler), the exact velocity units of Eq.
// (velocity_units_normalized) as the spectral coordinate Λ = v_†, the profile V of § 3.3 with the widths of § 3.1.3).
// The reader scales the peculiar velocities, sets the temperature and the turbulent broadening, and sees each
// structure of the gas, drawn against v_H(x) = c ln(a_f/a(x)) (where it would absorb with no peculiar velocity),
// move and change width in τ(v_†): the redshift-space distortion of a single line of sight; with v = 0 (dashed) the
// absorption follows the density, broadened only thermally.
import { el, controls, slider, choice, note, legend, fmt, Plot2D, palette } from './dg.js';
import { typeset } from '../course.js';
import { LINES, SKEWER, gas, pixels, tauUnit, aStart, vHubble, vRedshift } from './skewer.js';

export const START = { line: 'lya', vs: 1, logT0: Math.log10(SKEWER.T0), bturb: 0 };
export const SEED = 1, NPIX = 256, NBAR = 5e-7;          // realization, pixels, n̄ [m⁻³] (mean transmission ≈ 0.8)
const C = { tau: '#0a6a7b', tau0: palette.ink, n: '#6c3fa0', v: '#d68b02' };
const LINE_KEYS = ['lya', 'lyb'];

/** Everything the panel shows at the state st (also used by its test). */
export function compute(st) {
  const G = gas(SEED, { T0: 10 ** st.logT0 }), line = LINES[st.line];
  const vmax = vHubble(aStart()), u = pixels(0, vmax, NPIX);
  const tau = tauUnit(line, G, u, { vscale: st.vs, bturb: st.bturb }).map(t => NBAR * t);
  const tau0 = tauUnit(line, G, u, { vscale: 0, bturb: st.bturb }).map(t => NBAR * t);
  const vh = G.a.map(a => vHubble(a)), vz = G.a.map((a, k) => vRedshift(a, st.vs * G.v[k]));
  const imax = tau.reduce((b, t, i) => (t > tau[b] ? i : b), 0);
  return { G, u, tau: Array.from(tau), tau0: Array.from(tau0), vh, vz, vmax, imax, max: tau[imax],
    max0: Math.max(...tau0), mean: tau.reduce((a, t) => a + t, 0) / NPIX };
}

export default async function mount(body) {
  const st = { ...START };
  body.append(note('Scale the peculiar velocities of the gas, change its temperature and turbulent broadening, and compare the optical depth with the one the gas would give at rest (dashed).'));
  const bar = controls(body);
  bar.append(choice({ label: '', options: LINE_KEYS.map(k => ({ value: k, label: `\\(${LINES[k].tex}\\)`, aria: LINES[k].name })), value: st.line,
    onChange: v => { st.line = v; update(); } }).el);
  bar.append(slider({ label: '\\(v_{i\\,\\parallel}\\ \\times\\)', aria: 'peculiar velocity scale', min: 0, max: 2, step: 0.05, value: st.vs, format: v => fmt(v, 2),
    onInput: v => { st.vs = v; update(); } }).el);
  const bar2 = controls(body);
  bar2.append(slider({ label: '\\(\\log_{10} T_0\\)', aria: 'log10 T0', min: 3, max: 5.5, step: 0.05, value: st.logT0, format: v => fmt(v, 2),
    onInput: v => { st.logT0 = v; update(); } }).el);
  bar2.append(slider({ label: '\\(b_{i\\,\\rm turb}\\)', aria: 'b turb', min: 0, max: 40, step: 1, value: st.bturb, format: v => `${fmt(v, 0)} km/s`,
    onInput: v => { st.bturb = v; update(); } }).el);

  let S = null;
  const margin = { l: 50, r: 12, t: 8, b: 28 };
  const xlab = (pl, t) => pl.label('x', [pl.o.xlim[1], pl.o.ylim[0]], t, { anchor: 'se', dy: -3, dx: -4, class: 'dg-axis-label' });
  const ylab = (pl, t) => pl.label('y', [pl.o.xlim[0], pl.o.ylim[1]], t, { anchor: 'nw', dx: 4, dy: 2, class: 'dg-axis-label' });
  const boxN = el('div'), boxV = el('div'), boxT = el('div');
  const pN = new Plot2D(boxN, { xlim: [0, 1], ylim: [-1.5, 1.5], aspect: 0.2, maxWidth: 760, margin, yticks: [-1, 0, 1],
    label: 'Toy gas: log10 of n_com / n̄ against c ln(a_f / a(x))', draw(pl) {
      if (!S) return;
      pl.line(S.vh.map((x, k) => [x, Math.log10(S.G.nrel[k])]), { color: C.n, width: 1.4 });
      ylab(pl, '\\(\\log_{10}(n_{i\\,\\rm com}/\\bar n)\\)');
      xlab(pl, '\\(c\\ln(a_f/a(x))\\) [km/s]');
    } });
  const pV = new Plot2D(boxV, { xlim: [0, 1], ylim: [-500, 500], aspect: 0.2, maxWidth: 760, margin, yticks: [-400, 0, 400],
    label: 'Toy gas: peculiar velocity v along the sightline', draw(pl) {
      if (!S) return;
      pl.line(S.vh.map((x, k) => [x, st.vs * S.G.v[k]]), { color: C.v, width: 1.4 });
      ylab(pl, '\\(v_{i\\,\\parallel}\\) [km/s]');
      xlab(pl, '\\(c\\ln(a_f/a(x))\\) [km/s]');
    } });
  const pT = new Plot2D(boxT, { xlim: [0, 1], ylim: [0, 1], aspect: 0.42, maxWidth: 760, margin,
    label: 'Optical depth τ(v_†) with the peculiar velocities and at rest', draw(pl) {
      if (!S) return;
      const top = pl.o.ylim[1], clip = p => p.map(([x, y]) => [x, Math.min(y, top)]);
      pl.line(clip(S.u.map((x, i) => [x, S.tau0[i]])), { color: C.tau0, width: 1.3, dash: '5 4', opacity: 0.8 });
      pl.line(clip(S.u.map((x, i) => [x, S.tau[i]])), { color: C.tau, width: 2.2 });
      xlab(pl, '\\(v_\\dagger\\) [km/s]');
      ylab(pl, '\\(\\tau_{ij}\\)');
    } });
  const val = () => el('span', { class: 'dg-gr-val' });
  const v = { range: val(), max: val(), max0: val(), mean: val() };
  const pair = (t, x) => el('span', { class: 'dg-gr-pair' }, el('span', {}, `\\(${t}\\)`), x);
  const out = el('div', { class: 'dg-eqrow', style: 'gap: 0.4rem 1.6rem' });
  out.append(pair('v_\\dagger \\in', v.range), pair('\\max\\tau_{ij} =', v.max), pair('\\max\\tau_{ij}\\big|_{v=0} =', v.max0), pair('\\langle\\tau_{ij}\\rangle_{\\Lambda} =', v.mean));
  body.append(boxN, boxV, boxT, legend([{ label: '\\(\\tau_{ij}(v_\\dagger)\\)', color: C.tau, width: 2.2 },
    { label: '\\(\\tau_{ij}(v_\\dagger)\\), \\(v_{i\\,\\parallel} = 0\\)', color: 'currentColor', width: 1.3, dash: '5 4' }]), out);
  for (const [p, a, b] of [[pN, 0.2, 0.32], [pV, 0.2, 0.32], [pT, 0.42, 0.62]]) Object.defineProperty(p.o, 'aspect', { get: () => (p.wrap.clientWidth < 560 ? b : a) });

  function update() {
    S = compute(st);
    const xl = [0, S.vmax];
    const top = Math.max(1, 1.08 * Math.max(S.max, S.max0));
    pN.o.xlim = xl; pV.o.xlim = xl; pT.o.xlim = xl; pT.o.ylim = [0, Math.min(top, 12)];
    pN.update(); pV.update(); pT.update();
    v.range.textContent = `[0, ${fmt(S.vmax, 0)}] km/s`;
    v.max.textContent = fmt(S.max, 3); v.max0.textContent = fmt(S.max0, 3); v.mean.textContent = fmt(S.mean, 3);
    body.dataset.state = JSON.stringify({ ...st, vmax: S.vmax, imax: S.imax, max: S.max, max0: S.max0, mean: S.mean });
  }
  update();
  await typeset(body);
}
