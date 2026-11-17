// Hand-written (not generated): interactive after Figure 4 (label fig:line_profile), § 3.3. Notebook
// notebooks/06_voigt_and_line_profiles.ipynb of SkewerJAX (Lyα DECISIONS L20).
// Everything comes from §§ 3.1.3 and 3.3: b_th = √(2 k_B T / m_i), b_i = √(b_th² + b_turb²), σ_ij = b_i / (√2 λ_j),
// γ_j = (A_j + A_coll) / (4π), ν_j = c (1/λ' − 1/λ_j), φ_ij = V(ν_j; σ_ij, γ_j), V the convolution of G(·; σ) and
// L(·; γ) computed from the Faddeeva function (lya.js). The three transitions and their data are those of Figure 4
// (SkewerJAX lines_table.dat). The reader sets T, b_turb and A_coll and sees the profile with its Gaussian and
// Lorentzian parts: the core is G, the wings are L, and the wavelength where L overtakes G (marked) moves out as
// T grows, since σ grows as √T while γ does not depend on T.
import { el, controls, slider, choice, toggle, note, legend, fmt, Plot2D } from './dg.js';
import { typeset } from '../course.js';
import { LINES, widths, voigt, gauss, lorentz, nu, C_KMS } from './lya.js';

export const START = { line: 'lya', logT: 4, bturb: 0, logColl: 0, log: true };
const C = { V: '#0a6a7b', G: '#d68b02', L: '#6c3fa0', mark: '#444' };
const NPTS = 400, DECADES = 12;

/** Δλ = λ' − λ_j [Å] -> φ_ij [ns] and its two parts, for the state st. */
export function profile(st) {
  const line = LINES[st.line];
  const Acoll = (10 ** st.logColl - 1) * line.A;
  const w = widths(line, 10 ** st.logT, st.bturb, Acoll);
  const dlD = line.lambda * w.b / C_KMS;                         // Doppler width in Å, b_i λ_j / c
  const R = Math.max(1.2, 8 * dlD);                              // half range of the plot [Å]
  const at = dl => { const v = nu(line.lambda + dl, line.lambda); return { V: voigt(v, w.sigma, w.gamma) * 1e9, G: gauss(v, w.sigma) * 1e9, L: lorentz(v, w.gamma) * 1e9 }; };
  // where the wings change from Gaussian to Lorentzian: the outermost Δλ in (0, R] where G = L (scanning inwards
  // from R for the first point where G >= L, then bisection). At the very centre the bare L(·; γ), a spike of height
  // 1/(πγ), can exceed G, so the crossing is looked for from the outside in.
  const d = dl => { const p = at(dl); return Math.log(p.G + 1e-300) - Math.log(p.L); };
  let cross = null;
  const N = 600;
  for (let i = N - 1; i >= 1; i--) {
    const a = R * i / N, b = R * (i + 1) / N;
    if (d(a) >= 0 && d(b) < 0) {
      let lo = a, hi = b;
      for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (d(m) >= 0) lo = m; else hi = m; }
      cross = (lo + hi) / 2;
      break;
    }
  }
  return { line, Acoll, w, R, at, cross, peak: at(0).V };
}

export default async function mount(body) {
  const st = { ...START };
  body.append(note('Choose a transition and change the temperature, the turbulent broadening and the collisional damping.'));
  const bar = controls(body);
  bar.append(choice({ label: '', options: Object.entries(LINES).map(([k, l]) => ({ value: k, label: `\\(${l.tex}\\)`, aria: l.name })), value: st.line,
    onChange: v => { st.line = v; update(); } }).el);
  const bar2 = controls(body);
  bar2.append(slider({ label: '\\(\\log_{10} T_i\\)', aria: 'log10 T', min: 0, max: 7, step: 0.05, value: st.logT, format: v => fmt(v, 2), onInput: v => { st.logT = v; update(); } }).el);
  bar2.append(slider({ label: '\\(b_{i\\,\\rm turb}\\)', aria: 'b turb', min: 0, max: 60, step: 0.5, value: st.bturb, format: v => `${fmt(v, 1)} km/s`, onInput: v => { st.bturb = v; update(); } }).el);
  const bar3 = controls(body);
  bar3.append(slider({ label: '\\(\\log_{10}(1 + A_{j\\,\\rm coll}/A_j)\\)', aria: 'log10(1 + A coll / A j)', min: 0, max: 4, step: 0.05, value: st.logColl, format: v => fmt(v, 2), onInput: v => { st.logColl = v; update(); } }).el);
  bar3.append(toggle({ label: 'log scale', value: st.log, onChange: v => { st.log = v; update(); } }).el);

  const out = el('div', { class: 'dg-eqrow' });
  const val = () => el('span', { class: 'dg-gr-val' });
  const v = { bth: val(), b: val(), sigma: val(), gamma: val() };
  const pair = (t, x) => el('span', { class: 'dg-gr-pair' }, el('span', {}, `\\(${t}\\)`), x);
  out.append(pair('b_{i\\,\\rm th} =', v.bth), pair('b_i =', v.b), pair('\\sigma_{ij} =', v.sigma), pair('\\gamma_j =', v.gamma));
  const plotBox = el('div');
  body.append(plotBox, legend([{ label: '\\(\\phi_{ij} = V\\)', color: C.V, width: 2.4 }, { label: '\\(G(\\,\\cdot\\,;\\sigma_{ij})\\)', color: C.G, width: 1.6, dash: '6 4' },
    { label: '\\(L(\\,\\cdot\\,;\\gamma_j)\\)', color: C.L, width: 1.6, dash: '2 3' }]), out);

  let P = profile(st);
  const ylog = y => Math.log10(Math.max(y, 1e-300));
  function draw(pl) {
    const { R, at, cross } = P;
    const xs = Array.from({ length: NPTS + 1 }, (_, i) => -R + 2 * R * i / NPTS);
    const pts = k => xs.map(x => [x, st.log ? ylog(at(x)[k]) : at(x)[k]]);
    // a curve is drawn only where it lies inside the plot: runs of points within [ymin, ymax] (the top clipped)
    const runs = (p, opt) => {
      let cur = [];
      const flush = () => { if (cur.length > 1) pl.line(cur, opt); cur = []; };
      for (const [x, y] of p) { if (y >= pl.o.ylim[0]) cur.push([x, Math.min(pl.o.ylim[1], y)]); else flush(); }
      flush();
    };
    runs(pts('G'), { color: C.G, width: 1.6, dash: '6 4' });
    runs(pts('L'), { color: C.L, width: 1.6, dash: '2 3' });
    runs(pts('V'), { color: C.V, width: 2.4 });
    if (cross != null) for (const s of [-1, 1]) pl.line([[s * cross, pl.o.ylim[0]], [s * cross, pl.o.ylim[1]]], { color: C.mark, width: 1, dash: '3 3' });
    pl.label('x', [R, pl.o.ylim[0]], '\\(\\lambda\' - \\lambda_j\\) [Å]', { anchor: 'se', dy: -4, dx: -4, class: 'dg-axis-label' });
    pl.label('y', [-R, pl.o.ylim[1]], st.log ? '\\(\\log_{10}\\phi_{ij}\\) [ns]' : '\\(\\phi_{ij}\\) [ns]', { anchor: 'nw', dx: 4, dy: 2, class: 'dg-axis-label' });
  }
  const plot = new Plot2D(plotBox, { xlim: [-1, 1], ylim: [0, 1], aspect: 0.55, maxWidth: 760, margin: { l: 50, r: 12, t: 10, b: 30 },
    label: 'Line profile φ_ij against λ′ − λ_j', draw });

  function update() {
    P = profile(st);
    const top = st.log ? ylog(P.peak) + 0.6 : P.peak * 1.12;
    plot.o.xlim = [-P.R, P.R];
    plot.o.ylim = st.log ? [top - DECADES, top] : [0, top];
    plot.update();
    const g = x => (x >= 1e9 ? `${fmt(x / 1e9, 3)} GHz` : x >= 1e6 ? `${fmt(x / 1e6, 3)} MHz` : `${fmt(x / 1e3, 3)} kHz`);
    v.bth.textContent = `${fmt(P.w.bth, 2)} km/s`; v.b.textContent = `${fmt(P.w.b, 2)} km/s`;
    v.sigma.textContent = g(P.w.sigma); v.gamma.textContent = g(P.w.gamma);
    body.dataset.state = JSON.stringify({ ...st, bth: P.w.bth, b: P.w.b, sigma: P.w.sigma, gamma: P.w.gamma, cross: P.cross, R: P.R });
  }
  update();
  await typeset(body);
}
