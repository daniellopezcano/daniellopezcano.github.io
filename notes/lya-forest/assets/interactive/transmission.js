// Hand-written (not generated): interactive after Eq. (delta_j), § 3.6. Notebook notebooks/10_skewer_statistics.ipynb
// of SkewerJAX (Lyα DECISIONS L20, L25).
// The transmission T_j^(s) = exp(−τ_j^(s)) of Eq. (flux) (§ 3.5) on ENS toy sightlines (skewer.js; τ from Eq.
// (tau_straight_los), Lyα), the mean transmission T̄_j(Λ) = ⟨T_j^(s)⟩_ens at fixed Λ and the overflux
// δ_j^(s) = T_j^(s)/T̄_j − 1 of Eq. (delta_j). τ is linear in n̄ (the density, temperature and velocity of the toy gas
// do not depend on it), so the τ per unit n̄ of every sightline is computed once and n̄ only scales it. The reader
// raises n̄ and sees the strong absorbers saturate (T → 0 over a widening range) while T̄ falls; picks a sightline
// and sees that ⟨δ_j^(s)⟩_ens = 0 at every Λ while the mean of δ_j^(s) along one sightline is not zero (§ 3.6).
import { el, controls, slider, stepper, note, legend, fmt, Plot2D, palette } from './dg.js';
import { typeset } from '../course.js';
import { LINES, gas, pixels, tauUnit, aStart, vHubble } from './skewer.js';

export const START = { logn: Math.log10(5e-7), s: 2 };
export const ENS = 64, NPIX = 160, NSHOW = 4;
const C = { T: '#0a6a7b', Tbar: palette.ink, d: '#d68b02', sat: '#0a6a7b' };

let UNIT = null;                                           // τ per unit n̄ of the ENS sightlines, at the pixels
/** τ_j^(s) per unit n̄ for s = 1 … ENS (computed once; `chunk` sightlines per call of `step`, for the page). */
export function unitTaus() {
  if (UNIT) return UNIT;
  const u = pixels(0, vHubble(aStart()), NPIX);
  UNIT = { u, taus: Array.from({ length: ENS }, (_, s) => tauUnit(LINES.lya, gas(s + 1), u)) };
  return UNIT;
}
/** Everything the panel shows at (log10 n̄, s). */
export function compute(st) {
  const { u, taus } = unitTaus(), nb = 10 ** st.logn, m = u.length;
  const T = taus.map(t => Array.from(t, x => Math.exp(-nb * x)));
  const Tbar = u.map((_, i) => T.reduce((a, Ts) => a + Ts[i], 0) / ENS);
  const delta = T.map(Ts => Ts.map((x, i) => x / Tbar[i] - 1));
  const mean = a => a.reduce((p, q) => p + q, 0) / a.length;
  const ensDelta = u.map((_, i) => delta.reduce((a, d) => a + d[i], 0) / ENS);
  const tauMean = mean(taus.map(t => nb * mean(Array.from(t))));
  const one = T[st.s - 1];
  return { u, T: one, Tbar, delta: delta[st.s - 1], TbarMean: mean(Tbar), expTau: Math.exp(-tauMean), tauMean,
    dMean: mean(delta[st.s - 1]), ensMax: Math.max(...ensDelta.map(Math.abs)), sat: one.filter(x => x < 0.05).length / m };
}

export default async function mount(body) {
  const st = { ...START };
  body.append(note('Change the density scale \\(\\bar n\\) of the absorbers and choose one of the first sightlines; the mean transmission is the average over all the sightlines at each \\(v_\\dagger\\).'));
  const bar = controls(body);
  bar.append(slider({ label: '\\(\\log_{10}\\bar n\\)', aria: 'log10 n bar', min: -8, max: -4, step: 0.05, value: st.logn, format: v => `${fmt(v, 2)}`,
    onInput: v => { st.logn = v; update(); } }).el);
  bar.append(stepper({ label: '\\(s\\)', aria: 'sightline', min: 1, max: NSHOW, value: st.s, onChange: v => { st.s = v; update(); } }).el);

  let S = null;
  const margin = { l: 50, r: 12, t: 8, b: 28 };
  const ylab = (pl, t) => pl.label('y', [pl.o.xlim[0], pl.o.ylim[1]], t, { anchor: 'nw', dx: 4, dy: 2, class: 'dg-axis-label' });
  const boxT = el('div'), boxD = el('div');
  const pT = new Plot2D(boxT, { xlim: [0, 1], ylim: [0, 1.08], aspect: 0.36, maxWidth: 760, margin, yticks: [0, 0.5, 1],
    label: 'Transmission of one sightline and the mean transmission', draw(pl) {
      if (!S) return;
      pl.line(S.u.map((x, i) => [x, S.Tbar[i]]), { color: C.Tbar, width: 1.4, dash: '5 4' });
      pl.line(S.u.map((x, i) => [x, S.T[i]]), { color: C.T, width: 2 });
      ylab(pl, `\\(T_j^{(${st.s})} = e^{-\\tau_j^{(${st.s})}}\\)`);
    } });
  const pD = new Plot2D(boxD, { xlim: [0, 1], ylim: [-1, 3], aspect: 0.3, maxWidth: 760, margin,
    label: 'Overflux of the sightline', draw(pl) {
      if (!S) return;
      pl.line([[pl.o.xlim[0], 0], [pl.o.xlim[1], 0]], { color: palette.axis, width: 1 });
      pl.line([[pl.o.xlim[0], S.dMean], [pl.o.xlim[1], S.dMean]], { color: C.d, width: 1, dash: '2 3' });
      pl.line(S.u.map((x, i) => [x, Math.min(pl.o.ylim[1], S.delta[i])]), { color: C.d, width: 1.8 });
      pl.label('x', [pl.o.xlim[1], pl.o.ylim[0]], '\\(v_\\dagger\\) [km/s]', { anchor: 'se', dy: -3, dx: -4, class: 'dg-axis-label' });
      ylab(pl, `\\(\\delta_j^{(${st.s})}\\)`);
    } });
  for (const [p, a, b] of [[pT, 0.36, 0.55], [pD, 0.3, 0.48]]) Object.defineProperty(p.o, 'aspect', { get: () => (p.wrap.clientWidth < 560 ? b : a) });
  const val = () => el('span', { class: 'dg-gr-val' });
  const v = { Tbar: val(), expTau: val(), dMean: val(), ens: val(), sat: val() };
  const pair = (t, x) => el('span', { class: 'dg-gr-pair' }, el('span', {}, `\\(${t}\\)`), x);
  const out = el('div', { class: 'dg-eqrow', style: 'gap: 0.4rem 1.6rem' });
  out.append(pair('\\langle \\bar T_j \\rangle_{\\Lambda} =', v.Tbar), pair('e^{-\\langle\\tau_j\\rangle} =', v.expTau),
    pair('\\langle \\delta_j^{(s)} \\rangle_{\\Lambda} =', v.dMean), pair('\\max_\\Lambda \\big|\\langle \\delta_j^{(s)} \\rangle_{\\rm ens}\\big| =', v.ens),
    pair('T_j^{(s)} < 0.05\\ \\text{on}', v.sat));
  body.append(boxT, boxD, legend([{ label: '\\(T_j^{(s)}(v_\\dagger)\\)', color: C.T, width: 2 },
    { label: '\\(\\bar T_j(v_\\dagger)\\)', color: 'currentColor', width: 1.4, dash: '5 4' }, { label: '\\(\\delta_j^{(s)}(v_\\dagger)\\)', color: C.d, width: 1.8 }]), out);

  function update() {
    S = compute(st);
    const xl = [0, S.u[S.u.length - 1] + S.u[0]];
    pT.o.xlim = xl; pD.o.xlim = xl;
    pD.o.ylim = [-1.05, Math.max(1, Math.min(8, 1.1 * Math.max(...S.delta)))];
    pT.update(); pD.update();
    v.Tbar.textContent = fmt(S.TbarMean, 3); v.expTau.textContent = fmt(S.expTau, 3); v.dMean.textContent = fmt(S.dMean, 3);
    v.ens.textContent = S.ensMax < 1e-12 ? '0' : S.ensMax.toExponential(1); v.sat.textContent = `${fmt(100 * S.sat, 0)} %`;
    body.dataset.state = JSON.stringify({ ...st, TbarMean: S.TbarMean, expTau: S.expTau, dMean: S.dMean, ensMax: S.ensMax, sat: S.sat });
  }
  update();
  await typeset(body);
}
