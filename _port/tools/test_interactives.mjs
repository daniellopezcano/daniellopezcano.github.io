// Hand-written tool: headless-browser test of the interactive figures (assets/interactive/*.js).
//   node _port/tools/test_interactives.mjs [--shots DIR]      exit code 0 = all checks passed, 1 = failures
// Serves docs/ (render the pages first), drives each interactive at 1280 px and 390 px, asserts that it
// mounts without console errors of its own and reacts to its controls, cross-checks the numbers of the
// variations module against the closed forms of Appendix C.6, those of the tpm module against the
// transformation law of §4.1.1 (finite differences of the chart maps) and those of the laws module against the laws
// of §2.3 (components through J and J⁻¹, the pairing over 200 random bases; its place at the end of §2.3, D57), those of the
// transport module against the closed forms of Appendix C.5 (parallel transport, autoparallels, torsion, curvature, the
// coefficients in the chart Y; its place at the end of C.5, D57), those of the charts module against the charts and
// transition maps of §3.2 (Figure 3.1: p on M, X(p) and Y(p) stay linked wherever p is dragged; membership in U, V), checks touch on a phone (D56: a swipe
// over a drawing scrolls the page, one that starts on a handle drags it, horizontal swipes rotate the 3D view),
// and checks that a module that fails to load leaves its frame hidden. --shots writes a screenshot of every frame.
import fs from 'node:fs';
import path from 'node:path';
import { serveDocs, chromium } from './shot.mjs';

const args = process.argv.slice(2);
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const MAPS = 'notes/diffgeo-gr/vector-spaces/foundations-sets-maps.html';
const VAR = 'notes/diffgeo-gr/examples/example-variations.html';
const TPM = 'notes/diffgeo-gr/tangent-spaces/tangent-space.html';
const LAWS = 'notes/diffgeo-gr/vector-spaces/basis-components-transformations.html';
const TR = 'notes/diffgeo-gr/examples/example-connection-torsion-curvature.html';
const CHARTS = 'notes/diffgeo-gr/topological-manifolds/charts-topological-manifolds.html';
// page errors that are not ours (MathJax config, being fixed elsewhere) and placeholder images
const IGNORE = [/Cannot set property Package/, /Failed to load resource/];

let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failures++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const num = s => parseFloat(String(s).replace('−', '-'));

const { server, base } = await serveDocs();
const browser = await chromium.launch();

async function open(url, width, { breakModule, touch } = {}) {
  const page = await browser.newPage({ viewport: { width, height: touch ? 844 : 900 }, deviceScaleFactor: 1, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.some(r => r.test(m.text()))) errors.push(m.text()); });
  page.on('pageerror', e => { if (!IGNORE.some(r => r.test(e.message))) errors.push(e.message); });
  if (breakModule) await page.route('**/assets/interactive/' + breakModule, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export default function () { throw new Error("broken on purpose"); }' }));
  await page.goto(base + '/' + url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('dg-math-ready'), null, { timeout: 30000 });
  // bring the figure the frame follows into view (the frame itself when it closes a section, D57: what comes
  // before it can be taller than the screen), so that course.js loads the module
  await page.evaluate(() => { const f = document.querySelector('.dg-interactive'), s = f.previousElementSibling; (s && s.matches('figure') ? s : f).scrollIntoView({ block: 'center', behavior: 'instant' }); });
  return { page, errors };
}
const ready = page => page.waitForSelector('.dg-interactive.dg-ready', { timeout: 20000 }).then(() => page.waitForTimeout(400));
// the mounted frame must not widen the page on a phone (D27: the page never scrolls sideways)
async function noSideScroll(page, width) {
  if (width >= 600) return;
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  check(sw <= iw, `no horizontal page scroll (scrollWidth ${sw}, innerWidth ${iw})`);
}
const shot = async (page, name) => { if (shots) await page.locator('.dg-interactive').screenshot({ path: path.join(shots, name) }); };
// mouse events outside the viewport are lost: bring the drawing area (svg / canvas) into view first
const center = async loc => {
  await loc.evaluate(e => (e.closest('svg, canvas') || e).scrollIntoView({ block: 'center', behavior: 'instant' }));
  const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2];
};

// the panel's footer (D55): Reset re-mounts (one body: one instruction line), the static-figure link names the
// figure and scrolls to it (figId null: a panel that is not attached to a figure has no such link, D57), the
// notebook link where interactives.json gives one
async function panelFoot(page, fr, figId, figName, notebook) {
  const foot = fr.locator('.dg-interactive-foot');
  check(await foot.count() === 1, 'panel footer present');
  const stat = foot.locator('a.dg-ia-static');
  if (figId) check(await stat.textContent() === figName && await stat.getAttribute('href') === '#' + figId, `static-figure link "${figName}" -> #${figId}`);
  else check(await stat.count() === 0, 'no static-figure link (the panel is not attached to a figure)');
  const nb = foot.locator('a.dg-ia-notebook');
  if (notebook) check(await nb.count() === 1 && (await nb.getAttribute('href')).endsWith('/' + notebook), `notebook link -> ${notebook}`);
  else check(await nb.count() === 0, 'no notebook link');
  await foot.locator('button.dg-ia-reset').click();
  await page.waitForFunction(f => !f.querySelector('.dg-ia-reset').disabled, await fr.elementHandle());
  await page.waitForTimeout(300);
  check(await fr.locator('.dg-interactive-body > .dg-note').count() === 1 && await fr.locator('.dg-interactive-foot').count() === 1, 'Reset leaves one body and one footer');
  check(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('dg-ia-reset')), 'focus stays on Reset');
  if (!figId) return;
  await stat.click();
  await page.waitForTimeout(700);
  const top = await page.locator('#' + figId).evaluate(e => e.getBoundingClientRect().top);
  check(top > -2 && top < 200, `static-figure link scrolls to the figure (top ${Math.round(top)} px)`);
}

async function testMaps(width) {
  console.log(`maps @ ${width}px`);
  const { page, errors } = await open(MAPS, width);
  await ready(page);
  const fr = page.locator('.dg-interactive');
  const status = () => fr.locator('.dg-status').textContent();
  const preset = name => fr.locator('.dg-presets button', { hasText: new RegExp(`^${name}$`) }).click();
  const box = await fr.boundingBox(), fig = await page.locator('#fig_maps_examples').boundingBox();
  check(box.width >= fig.width - 2, `frame spans the text column (${Math.round(box.width)} px vs figure ${Math.round(fig.width)} px)`);
  check(await status() === 'Bijective', 'starts as the Bijective panel');
  await shot(page, `maps-${width}.png`);
  const expect = { 'NOT a Function': 1, 'General Function': 0, 'Only Injective': 0, 'Only Surjective': 0, 'Bijective': 0 };
  for (const [name, bad] of Object.entries(expect)) {
    await preset(name);
    check(await status() === name, `preset "${name}" -> status "${await status()}"`);
    check(await fr.locator('.dg-domain.dg-bad').count() === bad, `  ${bad} offending element(s) marked`);
    check(await fr.locator('.dg-toggle input').isDisabled() === (name !== 'Bijective'), `  inverse toggle ${name === 'Bijective' ? 'enabled' : 'disabled'}`);
  }
  await fr.locator('.dg-toggle label').click();
  check(await fr.locator('.dg-arrow.dg-inert').count() === 4, 'inverse arrows drawn when the toggle is on');
  await shot(page, `maps-inverse-${width}.png`);
  await fr.locator('.dg-toggle label').click();
  // remove an arrow by clicking it, add it back by dragging
  const arrow = fr.locator('g.dg-removable').first();
  const key = await arrow.getAttribute('data-key');
  const [, i, j] = key.match(/a(\d+)-(\d+)/);
  await center(arrow);
  // click a quarter of the way along the arrow (in the middle all the arrows of the panel cross)
  const at = await arrow.locator('.dg-shaft').evaluate(p => { const q = p.getPointAtLength(p.getTotalLength() * 0.25), m = p.getScreenCTM(); return [m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f]; });
  await page.mouse.click(...at);
  check(await fr.locator(`[data-key="${key}"]`).count() === 0, `click removes arrow ${key}`);
  check(await status() === 'NOT a Function' && await fr.locator('.dg-domain.dg-bad').count() === 1, '  -> NOT a Function, one element marked');
  await shot(page, `maps-notfn-${width}.png`);
  const [x0, y0] = await center(fr.locator(`[data-key="d${i}"]`)), [x1, y1] = await center(fr.locator(`[data-key="t${j}"]`));
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 }); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up();
  check(await status() === 'Bijective', 'drag from M to N adds the arrow back -> Bijective');
  // keyboard: Delete removes the arrows of a focused element; Enter, arrow keys, Enter adds one
  await fr.locator('[data-key="d0"]').focus();
  await page.keyboard.press('Delete');
  check(await status() === 'NOT a Function', 'Delete on a focused element removes its arrow');
  await page.keyboard.press('Enter');
  for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowDown');          // bijective preset: element 0 -> 3
  await page.keyboard.press('Enter');
  check(await status() === 'Bijective', 'Enter, ArrowDown x3, Enter adds the arrow 1 -> 4 again');
  // set sizes
  await fr.locator('.dg-stepper').nth(1).locator('button', { hasText: '+' }).click();
  check(await status() === 'Only Injective' && await fr.locator('.dg-target').count() === 5, 'one more element of N -> Only Injective');
  await fr.locator('.dg-stepper').nth(0).locator('button', { hasText: '−' }).click();
  check(await fr.locator('.dg-domain').count() === 3 && await status() === 'Only Injective', 'one element of M fewer -> 3 elements, its arrow gone');
  await panelFoot(page, fr, 'fig_maps_examples', 'Figure 2.1', '1_vector_spaces.ipynb');
  check(await status() === 'Bijective' && await fr.locator('.dg-domain').count() === 4, 'Reset -> the starting state again (Bijective, 4 elements)');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  await page.close();
}

async function testVariations(width) {
  console.log(`variations @ ${width}px`);
  const { page, errors } = await open(VAR, width);
  await ready(page);
  const fr = page.locator('.dg-interactive');
  const L = async () => num(await fr.locator('.dg-readout-value').nth(0).textContent());
  const dL = async () => num(await fr.locator('.dg-readout-value').nth(1).textContent());
  const setT = v => fr.locator('input[type=range]').evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const pick = (group, k) => fr.locator('.dg-choice').nth(group).locator('label').nth(k).click();
  const canvasHash = () => fr.locator('canvas').evaluate(c => { const d = c.toDataURL(); let h = 0; for (let k = 0; k < d.length; k += 7) h = (h * 31 + d.charCodeAt(k)) | 0; return h; });
  await shot(page, `variations-${width}.png`);
  check(await fr.locator('.dg-slider .dg-ctl-label mjx-container').count() === 1, 'slider label typeset');
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  const panels = await fr.locator('.dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? panels[1] > panels[0] + 50 : Math.abs(panels[1] - panels[0]) < 2, width < 700 ? 'panels stacked' : 'panels side by side');
  const L05 = await L();
  await setT(0);
  check(near(await L(), 2.8587, 1e-4), `gamma, t = 0: L = ${await L()} (closed form 2.8587)`);
  check(L05 > await L(), `gamma (i): L(0.5) = ${L05} > L(0)`);
  check(near(await dL(), 0, 1e-4), `gamma (i): first variation ${await dL()} (notes: 0)`);
  const h0 = await canvasHash();
  await setT(1);
  check(await canvasHash() !== h0, 'the 3D view redraws when the deformation parameter changes');
  await pick(1, 1);
  check(near(await dL(), 0, 1e-4) && near(await L(), 5.1501, 1e-4), `gamma (ii): first variation ${await dL()}, L(1) = ${await L()}`);
  await pick(0, 1); await setT(0);
  check(near(await L(), Math.PI, 1e-4), `sigma, t = 0: L = ${await L()} (notes: pi)`);
  check(near(await dL(), 1, 1e-4), `sigma (ii): first variation ${await dL()} (notes: 1)`);
  await pick(1, 0);
  check(near(await dL(), 2 * Math.SQRT2 / 3, 1e-4), `sigma (i): first variation ${await dL()} (notes: 2 sqrt2/3 = 0.9428)`);
  await shot(page, `variations-sigma-${width}.png`);
  // keyboard on the slider, drag of the marker on the plot, rotation of the 3D view
  await fr.locator('input[type=range]').focus(); await page.keyboard.press('ArrowRight');
  check(near(num(await fr.locator('.dg-slider output').textContent()), 0.01, 1e-9), 'ArrowRight on the slider moves the parameter by 0.01');
  const mk = fr.locator('[data-key="marker"]');
  const [mx, my] = await center(mk);
  await page.mouse.move(mx, my); await page.mouse.down(); await page.mouse.move(mx - 60, my, { steps: 5 }); await page.mouse.up();
  const tNow = num(await fr.locator('.dg-slider output').textContent());
  check(tNow < -0.2, `dragging the marker on the plot changes the parameter (now ${tNow})`);
  const h1 = await canvasHash(), [cx, cy] = await center(fr.locator('canvas'));
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 80, cy + 20, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(100);
  check(await canvasHash() !== h1, 'dragging the 3D view rotates it');
  await fr.locator('canvas').dblclick(); await page.waitForTimeout(100);
  check(await canvasHash() === h1, 'double click resets the view');
  await panelFoot(page, fr, 'fig_Example_Variations_length', 'Figure C.12', null);
  check(near(num(await fr.locator('.dg-slider output').textContent()), 0.5, 1e-9) && near(await L(), L05, 1e-9), `Reset -> curve gamma, family (i), parameter 0.5 again (L = ${await L()})`);
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await crossChecks(page);
  await page.close();
}

async function crossChecks(page) {
  console.log('variations: numbers against Appendix C.6');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/variations.js');
    const out = {};
    for (const c of ['gamma', 'sigma']) for (const f of [1, 2]) for (const t of [0, 0.5, -1.2, 1.2]) {
      out[`${c}${f}@${t}`] = [m.lengthOf(c, f, t, 400), m.lengthOf(c, f, t, 4000), m.embeddedLength(c, f, t)];
    }
    for (const c of ['gamma', 'sigma']) for (const f of [1, 2]) out[`dL ${c}${f}`] = m.firstVariation(c, f);
    out.exp = [0.05, 0.1, -0.1].map(t => [t, m.lengthOf('sigma', 2, t), Math.PI + t + Math.PI / 2 * t * t]);
    let best = [0, 9];
    for (let k = -100; k <= 0; k++) { const v = m.lengthOf('sigma', 2, k / 200); if (v < best[1]) best = [k / 200, v]; }
    out.min = best;
    const h = 1e-3, L0 = m.lengthOf('gamma', 1, 0);
    out.I = (m.lengthOf('gamma', 1, h) + m.lengthOf('gamma', 1, -h) - 2 * L0) / (h * h);
    return out;
  });
  const Lg = (3 * Math.sqrt(13) - Math.sqrt(5)) / 4 + Math.asinh(1.5) - Math.asinh(0.5);
  check(near(r['gamma1@0'][0], Lg, 1e-9) && near(r['gamma2@0'][0], Lg, 1e-9), `L[gamma] = ${r['gamma1@0'][0].toFixed(10)} vs (3 sqrt13 - sqrt5)/4 + arsinh 3/2 - arsinh 1/2 = ${Lg.toFixed(10)}`);
  check(near(r['sigma1@0'][0], Math.PI, 1e-9), `L[sigma] = ${r['sigma1@0'][0].toFixed(10)} vs pi`);
  let worst = 0, worstQ = 0;
  for (const [k, v] of Object.entries(r)) if (k.includes('@')) { worst = Math.max(worst, Math.abs(v[0] - v[2])); worstQ = Math.max(worstQ, Math.abs(v[0] - v[1])); }
  check(worst < 1e-6, `chart formula vs euclidean length of the embedded curve in R^3: max difference ${worst.toExponential(2)}`);
  check(worstQ < 1e-9, `400 vs 4000 Simpson intervals: max difference ${worstQ.toExponential(2)}`);
  check(near(r['dL gamma1'], 0, 1e-7) && near(r['dL gamma2'], 0, 1e-7), `first variations of gamma: ${r['dL gamma1'].toExponential(1)}, ${r['dL gamma2'].toExponential(1)} (notes: 0, 0)`);
  check(near(r['dL sigma1'], 2 * Math.SQRT2 / 3, 1e-7), `first variation sigma (i): ${r['dL sigma1'].toFixed(8)} (notes: 2 sqrt2/3 = ${(2 * Math.SQRT2 / 3).toFixed(8)})`);
  check(near(r['dL sigma2'], 1, 1e-7), `first variation sigma (ii): ${r['dL sigma2'].toFixed(8)} (notes: 1)`);
  for (const [t, a, b] of r.exp) check(Math.abs(a - b) < 2 * Math.abs(t) ** 3, `sigma (ii) at ${t}: L = ${a.toFixed(6)}, pi + t + (pi/2) t^2 = ${b.toFixed(6)} (difference O(t^3))`);
  console.log(`  info  sigma (ii) minimum at ${r.min[0]} with L = ${r.min[1].toFixed(4)} (notes: near -1/pi = ${(-1 / Math.PI).toFixed(3)}, about pi - 1/(2pi) = ${(Math.PI - 1 / (2 * Math.PI)).toFixed(4)})`);
  console.log(`  info  gamma (i) second derivative at 0 = I = ${r.I.toFixed(4)} (> 0, notes: I > 0)`);
  check(r.I > 0, 'gamma (i): I > 0');
  for (const k of ['gamma1@1.2', 'gamma2@1.2', 'sigma1@1.2', 'sigma2@1.2', 'sigma1@-1.2', 'sigma2@-1.2'])
    console.log(`  info  L ${k} = ${r[k][0].toFixed(4)}`);
}

// ---- tpm (Figure 4.2): closed forms of the figure's geometry, written here independently of the module
const tpmY = ([x, y]) => [Math.hypot(x + 1, y + 1), Math.atan2(y + 1, x + 1)];                 // polar about (-1, -1)
const tpmJ = ([x, y]) => { const a = x + 1, b = y + 1, r2 = a * a + b * b, r = Math.sqrt(r2); return [[a / r, b / r], [-b / r2, a / r2]]; };
const tpmIn = ([x, y]) => ((x - 0.1) / 0.9) ** 2 + ((y + 0.7) / 1.5) ** 2 < 1 && ((x - 0.7) / 1.4) ** 2 + ((y - 0.3) / 0.9) ** 2 < 1;
// velocity components of the selected curve: in X the derivative of the chart representative, in Y by central differences of Y o curve
function tpmExpect({ p, u, sel }) {
  const h = 1e-6, R = Math.hypot(...p), l0 = Math.atan2(p[1], p[0]);
  const at = sel === 'gamma' ? l => [p[0] + l * u[0], p[1] + l * u[1]] : l => [R * Math.cos(l), R * Math.sin(l)];
  const L = sel === 'gamma' ? 0 : l0, d = f => [0, 1].map(k => (f(at(L + h))[k] - f(at(L - h))[k]) / (2 * h));
  return { U: d(q => q), V: d(tpmY), J: tpmJ(p), Yp: tpmY(p) };
}

async function testTpm(width) {
  console.log(`tpm @ ${width}px`);
  const { page, errors } = await open(TPM, width);
  await ready(page);
  const fr = page.locator('.dg-interactive');
  const state = async () => JSON.parse(await fr.locator('.dg-tpm').getAttribute('data-state'));
  const mats = () => fr.locator('.dg-mat').evaluateAll(ms => ms.map(m => [...m.children].map(c => parseFloat(c.textContent.replace('−', '-')))));
  const pair = async k => (await fr.locator('.dg-readout-value').nth(k).textContent()).match(/[−-]?\d+\.\d+/g).map(num);
  const panel = k => fr.locator('.dg-tpm .dg-panel').nth(k);
  const canvasHash = () => fr.locator('canvas').evaluate(c => { const d = c.toDataURL(); let h = 0; for (let k = 0; k < d.length; k += 7) h = (h * 31 + d.charCodeAt(k)) | 0; return h; });
  // every number on the panel against the closed forms at the module's exact state (display: 3 decimals)
  async function numbers(what) {
    const st = await state(), e = tpmExpect(st), [mV, mJ, mU] = await mats(), X = await pair(0), Yp = await pair(1);
    const err = Math.max(...[[X, st.p], [Yp, e.Yp], [mU, e.U], [mV, e.V], [mJ, e.J.flat()]].flatMap(([a, b]) => a.map((v, k) => Math.abs(v - b[k]))));
    check(err <= 5.1e-4 && tpmIn(st.p), `${what}: X(p) = (${X}), Y(p) = (${Yp}), components ${st.sel} U (${mU}) V (${mV}) = J (${mJ}) U; max deviation from the closed forms ${err.toExponential(1)}`);
    return st;
  }
  await shot(page, `tpm-${width}.png`);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  check(await fr.locator('.dg-law mjx-container').count() === 1, 'transformation law typeset');
  const tops = await fr.locator('.dg-tpm .dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? tops[1] > tops[0] + 50 : Math.abs(tops[1] - tops[0]) < 2, width < 700 ? 'chart panels stacked' : 'chart panels side by side');
  const st0 = await numbers('start');
  check(near(st0.p[0], Math.PI / 4, 1e-12) && st0.p[1] === 0 && st0.u[0] === 0 && st0.u[1] === 1, 'starts at the figure: p = (pi/4, 0), gamma vertical with velocity (0, 1)');
  // drag p in the X panel
  const h0 = await canvasHash();
  let [x, y] = await center(panel(0).locator('[data-key="p"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 30, y - 25, { steps: 5 }); await page.mouse.up();
  const st1 = await numbers('after dragging p in (U, X)');
  check(st1.p[0] < st0.p[0] - 0.05 && st1.p[1] > 0.05, `p moved to (${st1.p.map(v => v.toFixed(3))})`);
  check(await canvasHash() !== h0, 'the 3D view follows p');
  // drag p far outside U ∩ V in the Y panel: it stops on the boundary
  [x, y] = await center(panel(1).locator('[data-key="p"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 400, y + 300, { steps: 6 }); await page.mouse.up();
  const st2 = await numbers('after dragging p out of U ∩ V in (V, Y)');
  check(tpmIn(st2.p) && Math.hypot(st2.p[0] - st1.p[0], st2.p[1] - st1.p[1]) > 0.05, 'p stays in U ∩ V');
  // drag the tip of the velocity of gamma in the Y panel
  [x, y] = await center(panel(1).locator('[data-key="tip"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 20, y + 25, { steps: 5 }); await page.mouse.up();
  const st3 = await numbers('after dragging the tip in (V, Y)');
  check(Math.hypot(st3.u[0] - st2.u[0], st3.u[1] - st2.u[1]) > 0.05, `velocity of gamma changed to U (${st3.u.map(v => v.toFixed(3))})`);
  // keyboard: arrow keys on the handles of the X panel
  await panel(0).locator('[data-key="tip"]').focus(); await page.keyboard.press('ArrowLeft');
  const st4 = await numbers('ArrowLeft on the tip in (U, X)');
  check(st4.u[0] < st3.u[0] - 0.01 && near(st4.u[1], st3.u[1], 0.02), 'ArrowLeft moves the tip to the left');
  await panel(0).locator('[data-key="p"]').focus(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  const st5 = await numbers('ArrowUp x2 on p in (U, X)');
  check(st5.p[1] > st4.p[1] + 0.01 || !tpmIn([st5.p[0], st5.p[1] + 0.05]), 'ArrowUp moves p up (or p is on the boundary)');
  // the other curve
  await fr.locator('.dg-choice label').nth(1).click();
  await page.waitForFunction(f => /delta/.test(f.querySelector('.dg-law > div').dataset.tex || ''), await fr.elementHandle());
  const st6 = await numbers('delta selected');
  check(st6.sel === 'delta', 'the law shows the components of the velocity of delta');
  await shot(page, `tpm-delta-${width}.png`);
  const h1 = await canvasHash(), [cx, cy] = await center(fr.locator('canvas'));
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 80, cy + 20, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(100);
  check(await canvasHash() !== h1, 'dragging the 3D view rotates it');
  const h2 = await canvasHash();                                   // with a mouse, vertical drags still tilt the view (D56)
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx, cy + 40, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(100);
  check(await canvasHash() !== h2, 'a vertical mouse drag on the 3D view tilts it');
  await panelFoot(page, fr, 'fig_TpM_curves_velocities_and_chart_transitions', 'Figure 4.2', '2_3_TpM.ipynb');
  const st7 = await state();
  check(st7.sel === 'gamma' && near(st7.p[0], Math.PI / 4, 1e-12) && st7.p[1] === 0 && st7.u[1] === 1, 'Reset -> p = (pi/4, 0), gamma, velocity (0, 1) again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await tpmCrossChecks(page);
  await page.close();
}

async function tpmCrossChecks(page) {
  console.log('tpm: the module against the transformation law of §4.1.1');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/tpm.js');
    const pts = [];
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    while (pts.length < 200) { const p = [-0.8 + 1.9 * rnd(), -0.7 + 1.6 * rnd()]; if (m.inUV(p)) { const a = 2 * Math.PI * rnd(), n = 0.25 + rnd(); pts.push([p, [n * Math.cos(a), n * Math.sin(a)]]); } }
    return pts.map(([p, u]) => ({ p, u, gamma: m.components('gamma', p, u), delta: m.components('delta', p, u), J: m.jacobian(p), Y: m.Y(p), YY: m.Yinv(m.Y(p)),
      at: ['gamma', 'delta'].map(c => { const k = m.curves[c](p, u); return k.at(k.l0); }), h: m.height(p[0], p[1]) }));
  });
  let wU = 0, wV = 0, wJ = 0, wY = 0, wI = 0, wP = 0, wH = 0;
  const egg = ([x, y]) => (Math.cos(x + y) / 2 + Math.sin(x - y + Math.PI / 2) / 2 + 1) * Math.exp(-(x * x + y * y) / (2 * Math.PI * Math.PI));
  for (const q of r) {
    for (const sel of ['gamma', 'delta']) {
      const e = tpmExpect({ p: q.p, u: q.u, sel });
      wU = Math.max(wU, ...q[sel].U.map((v, k) => Math.abs(v - e.U[k])));
      wV = Math.max(wV, ...q[sel].V.map((v, k) => Math.abs(v - e.V[k])));
    }
    const h = 1e-6, fd = [0, 1].map(i => { const a = q.p.slice(), b = q.p.slice(); a[i] += h; b[i] -= h; return [0, 1].map(k => (tpmY(a)[k] - tpmY(b)[k]) / (2 * h)); });
    wJ = Math.max(wJ, ...[0, 1].flatMap(k => [0, 1].map(i => Math.abs(q.J[k][i] - fd[i][k]))));
    wY = Math.max(wY, ...q.Y.map((v, k) => Math.abs(v - tpmY(q.p)[k])));
    wI = Math.max(wI, ...q.YY.map((v, k) => Math.abs(v - q.p[k])));
    wP = Math.max(wP, ...q.at.flatMap(a => a.map((v, k) => Math.abs(v - q.p[k]))));
    wH = Math.max(wH, Math.abs(q.h - egg(q.p)));
  }
  check(wU < 1e-6, `components in X vs derivative of the chart representatives (200 points of U ∩ V, gamma and delta): max difference ${wU.toExponential(2)}`);
  check(wV < 1e-6, `components in Y (Jacobian times components in X) vs finite differences of Y o curve: max difference ${wV.toExponential(2)}`);
  check(wJ < 1e-6, `(dY^k/dX^i)_p vs finite differences of the polar chart about (-1, -1): max difference ${wJ.toExponential(2)}`);
  check(wY < 1e-12 && wI < 1e-12, `Y(p) vs closed form ${wY.toExponential(1)}; Y^-1 o Y = id ${wI.toExponential(1)}`);
  check(wP < 1e-12, `both curves pass through p at lambda_0: ${wP.toExponential(1)}`);
  check(wH < 1e-12, `embedding height vs the notebook's formula: ${wH.toExponential(1)}`);
}

// ---- charts (Figure 3.1): the figure's charts, written here independently of the module (eggs.js). X is the identity on
// the parameters, Y polar coordinates about (-1, -1); U, V the ellipses of the notebook 2_1_charts.ipynb.
const chU = q => ((q[0] - 0.1) / 0.9) ** 2 + ((q[1] + 0.7) / 1.5) ** 2, chV = q => ((q[0] - 0.7) / 1.4) ** 2 + ((q[1] - 0.3) / 0.9) ** 2;
const chY = tpmY, chYinv = ([r, t]) => [-1 + r * Math.cos(t), -1 + r * Math.sin(t)];
const CH_A = Math.PI * Math.PI / 3, CH_LIM = { X: [[-CH_A, CH_A], [-CH_A, CH_A]], Y: [[-0.2, 5.5], [-Math.PI - 0.2, Math.PI + 0.2]] };

async function testCharts(width) {
  console.log(`charts @ ${width}px`);
  const { page, errors } = await open(CHARTS, width);
  await ready(page);
  const fr = page.locator('.dg-interactive');
  const state = async () => JSON.parse(await fr.locator('.dg-charts').getAttribute('data-state'));
  const panel = k => fr.locator('.dg-ch-row .dg-panel').nth(k);
  const canvas = fr.locator('canvas');
  const canvasHash = () => canvas.evaluate(c => { const d = c.toDataURL(); let h = 0; for (let k = 0; k < d.length; k += 7) h = (h * 31 + d.charCodeAt(k)) | 0; return h; });
  // p on M, X(p) in (U, X) and Y(p) in (V, Y): the handles sit at the closed-form images of the module's p (pixel positions
  // from the plot frame and the figure's ranges), the readouts show the same numbers, or p ∉ U / p ∉ V where the chart is not defined
  async function linked(what) {
    const st = await state(), iu = chU(st.p) < 1, iv = chV(st.p) < 1, img = { X: st.p, Y: chY(st.p) };
    let err = 0, ok = st.inU === iu && st.inV === iv && (iu || iv);
    for (const [k, key, inside] of [[0, 'X', iu], [1, 'Y', iv]]) {
      const svg = panel(k).locator('svg'), h = svg.locator('[data-key="p"]');
      const end = panel(k).locator('.dg-ch-end'), shown = await end.locator('.dg-readout').isVisible(), out = await end.locator('.dg-ch-out').isVisible();
      ok = ok && (await h.count() === (inside ? 1 : 0)) && shown === inside && out === !inside;
      ok = ok && (await panel(k).locator('.dg-plot-label', { hasText: '∉' }).count() === (inside ? 0 : 1));
      if (!inside) continue;
      const f = await svg.locator('rect.dg-frame').evaluate(r => [+r.getAttribute('x'), +r.getAttribute('y'), +r.getAttribute('width'), +r.getAttribute('height')]);
      const [xl, yl] = CH_LIM[key], c = [+(await h.getAttribute('cx')), +(await h.getAttribute('cy'))];
      const px = [f[0] + (img[key][0] - xl[0]) / (xl[1] - xl[0]) * f[2], f[1] + f[3] - (img[key][1] - yl[0]) / (yl[1] - yl[0]) * f[3]];
      err = Math.max(err, Math.hypot(c[0] - px[0], c[1] - px[1]));
      const v = (await end.locator('.dg-readout-value').textContent()).match(/[−-]?\d+\.\d+/g).map(num);
      ok = ok && v.length === 2 && v.every((x, i) => Math.abs(x - img[key][i]) <= 5.1e-4);
    }
    ok = ok && await fr.locator('.dg-ch-arrows').evaluate(e => e.classList.contains('dg-ch-off')) === !(iu && iv);
    check(ok && err < 0.6, `${what}: p = (${st.p.map(v => v.toFixed(3))}), ${iu ? 'X(p) shown' : 'p ∉ U'}, ${iv ? 'Y(p) shown' : 'p ∉ V'}, transition maps ${iu && iv ? 'active' : 'faded'}; handles at the closed-form images (max ${err.toFixed(2)} px)`);
    return st;
  }
  // drag the handle of chart k to the chart point q (pixel position from the plot frame and the figure's ranges)
  async function dragTo(k, q) {
    const svg = panel(k).locator('svg'), h = svg.locator('[data-key="p"]');
    const [x, y] = await center(h), f = await svg.locator('rect.dg-frame').evaluate(r => [+r.getAttribute('x'), +r.getAttribute('y'), +r.getAttribute('width'), +r.getAttribute('height')]);
    const sb = await svg.boundingBox(), [xl, yl] = CH_LIM[k ? 'Y' : 'X'];
    const t = [sb.x + f[0] + (q[0] - xl[0]) / (xl[1] - xl[0]) * f[2], sb.y + f[1] + f[3] - (q[1] - yl[0]) / (yl[1] - yl[0]) * f[3]];
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(t[0], t[1], { steps: 8 }); await page.mouse.up();
  }
  const drag = async (loc, dx, dy) => { const [x, y] = await center(loc); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 6 }); await page.mouse.up(); };
  await shot(page, `charts-${width}.png`);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  check(await fr.locator('.dg-ch-arrows mjx-container').count() === 3, 'transition maps typeset (two arrows, and the vertical form for phones)');
  const fh = (await fr.boundingBox()).height;
  if (width >= 1000) check(fh <= 900, `panel height ${Math.round(fh)} px (<= 900)`);
  const boxes = await fr.locator('.dg-ch-row > *').evaluateAll(es => es.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right]; }));
  check(width < 768 ? boxes[1][1] > boxes[0][1] + 50 && boxes[2][1] > boxes[1][1] : Math.abs(boxes[2][1] - boxes[0][1]) < 2 && boxes[1][0] >= boxes[0][2] && boxes[1][2] <= boxes[2][0],
    width < 768 ? 'charts stacked, transition maps between them' : 'charts side by side, transition maps between them');
  const st0 = await linked('start');
  check(st0.p[0] === 0.6 && st0.p[1] === -0.3, 'starts at p = (0.6, -0.3)');
  // drag X(p) in (U, X)
  const h0 = await canvasHash();
  await drag(panel(0).locator('[data-key="p"]'), -25, -15);
  const st1 = await linked('after dragging X(p) in (U, X)');
  check(st1.p[0] < st0.p[0] - 0.1 && st1.p[1] > st0.p[1] + 0.05, 'X(p) followed the pointer');
  await page.waitForTimeout(100);
  check(await canvasHash() !== h0, 'the 3D view follows p');
  // drag X(p) far down: p leaves V (Y(p) disappears) and stops on the boundary of U
  await drag(panel(0).locator('[data-key="p"]'), 5, 600);
  const st2 = await linked('after dragging X(p) far out of U');
  check(chU(st2.p) < 1 && chU(st2.p) > 1 - 1e-6 && chV(st2.p) > 1, `p stopped on the boundary of U, outside V (ellipse values U ${chU(st2.p).toFixed(9)}, V ${chV(st2.p).toFixed(3)})`);
  await shot(page, `charts-outV-${width}.png`);
  // drag Y(p) is impossible now; drag p on the surface back into U ∩ V: the 3D point follows the pointer exactly
  await canvas.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  let cb = await canvas.boundingBox(), s = await state();
  let [x, y] = [cb.x + s.p3[0], cb.y + s.p3[1]];
  const tgt = [x + 12, y - 30];
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(tgt[0], tgt[1], { steps: 8 }); await page.mouse.up();
  const st3 = await linked('after dragging p on the surface');
  check(Math.hypot(cb.x + st3.p3[0] - tgt[0], cb.y + st3.p3[1] - tgt[1]) < 1 && Math.hypot(st3.p[0] - st2.p[0], st3.p[1] - st2.p[1]) > 0.05,
    `p on the surface is under the pointer (${(cb.x + st3.p3[0] - tgt[0]).toFixed(2)}, ${(cb.y + st3.p3[1] - tgt[1]).toFixed(2)}) px`);
  // a long drag on the surface: p stays in U ∪ V (stops on its boundary)
  s = st3; [x, y] = [cb.x + s.p3[0], cb.y + s.p3[1]];
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - Math.min(200, cb.width * 0.4), y + 40, { steps: 10 }); await page.mouse.up();
  const st4 = await linked('after a long drag on the surface');
  check(Math.min(chU(st4.p), chV(st4.p)) < 1 && Math.hypot(st4.p[0] - st3.p[0], st4.p[1] - st3.p[1]) > 0.05, 'p moved and stays in U ∪ V');
  // drag Y(p) in (V, Y) far to the right: it stops on the boundary of V
  await dragTo(0, [0.7, 0.3]);                                   // back into U ∩ V, at the centre of V
  const st5 = await linked('after dragging X(p) to (0.7, 0.3)');
  check(near(st5.p[0], 0.7, 0.02) && near(st5.p[1], 0.3, 0.02), 'X(p) is where it was dropped');
  await drag(panel(1).locator('[data-key="p"]'), 500, 0);
  const st6 = await linked('after dragging Y(p) far out of V');
  check(chV(st6.p) < 1 && chV(st6.p) > 1 - 1e-6 && chY(st6.p)[0] > chY(st5.p)[0], `p stopped on the boundary of V (ellipse value ${chV(st6.p).toFixed(9)})`);
  // keyboard on Y(p): ArrowLeft decreases Y^1 by 1/100 of its range, Y^2 unchanged
  await panel(1).locator('[data-key="p"]').focus(); await page.keyboard.press('ArrowLeft');
  const st7 = await linked('ArrowLeft on Y(p)');
  const y6 = chY(st6.p), y7 = chY(st7.p);
  check(near(y7[0], y6[0] - 0.057, 1e-9) && near(y7[1], y6[1], 1e-9), `ArrowLeft: Y(p) (${y6.map(v => v.toFixed(3))}) -> (${y7.map(v => v.toFixed(3))})`);
  // dragging the surface away from p rotates the view and leaves p
  const h1 = await canvasHash(), sp = (await state()).p;
  await canvas.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  cb = await canvas.boundingBox();
  const p3 = (await state()).p3, start = [cb.x + (p3[0] < cb.width / 2 ? 0.85 : 0.15) * cb.width, cb.y + 0.8 * cb.height];
  await page.mouse.move(...start); await page.mouse.down(); await page.mouse.move(start[0] + 60, start[1] + 10, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(100);
  check(await canvasHash() !== h1 && JSON.stringify((await state()).p) === JSON.stringify(sp), 'dragging the surface elsewhere rotates it and leaves p');
  await linked('after rotating the view');
  await panelFoot(page, fr, 'fig_chart_transition_maps', 'Figure 3.1', '2_1_charts.ipynb');
  const st8 = await state();
  check(st8.p[0] === 0.6 && st8.p[1] === -0.3, 'Reset -> p = (0.6, -0.3) again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await chartsCrossChecks(page);
  await page.close();
}

async function chartsCrossChecks(page) {
  console.log('charts: the module against the charts and transition maps of §3.2');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/charts.js');
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pts = [];
    while (pts.length < 500) { const p = [-0.8 + 1.9 * rnd(), -0.7 + 1.6 * rnd()]; if (m.inU(p) && m.inV(p)) pts.push(p); }
    const maps = pts.map(p => { const a = m.X(p), b = m.Y(p); return { p, a, b, uv: m.tUV(a), vu: m.tVU(b), back: m.tVU(m.tUV(a)) }; });
    // membership just inside / outside the boundaries (U and V are open), in the parameters and in chart coordinates
    const ell = (c, ax, s, t) => [c[0] + s * ax[0] * Math.cos(t), c[1] + s * ax[1] * Math.sin(t)];
    const bnd = [];
    for (let k = 0; k < 360; k++) {
      const t = 2 * Math.PI * (k + 0.5) / 360;
      for (const [nm, c, ax] of [['U', [0.1, -0.7], [0.9, 1.5]], ['V', [0.7, 0.3], [1.4, 0.9]]]) {
        const i = ell(c, ax, 1 - 1e-9, t), o = ell(c, ax, 1 + 1e-9, t);
        const f = nm === 'U' ? m.inU : m.inV, g = nm === 'U' ? q => m.inXU(m.X(q)) : q => m.inYV(m.Y(q));
        bnd.push([f(i), f(o), g(i), g(o)]);
      }
    }
    const polar = [m.inYV([-0.5, 0.5]), m.inYV([0, 0.5]), m.inYV([2, Math.PI + 0.01]), m.inYV([2, -Math.PI - 0.01])];
    return { maps, bnd, polar };
  });
  let wUV = 0, wVU = 0, wB = 0, wY = 0;
  for (const q of r.maps) {
    const e = chY(q.p);
    wUV = Math.max(wUV, ...q.uv.map((v, k) => Math.abs(v - e[k])));                 // ᛖ_UV(X(p)) = Y(p)
    wVU = Math.max(wVU, ...q.vu.map((v, k) => Math.abs(v - q.p[k])));               // ᛖ_VU(Y(p)) = X(p)
    wB = Math.max(wB, ...q.back.map((v, k) => Math.abs(v - q.a[k])));
    wY = Math.max(wY, ...q.b.map((v, k) => Math.abs(v - e[k])), ...chYinv(q.b).map((v, k) => Math.abs(v - q.p[k])));
  }
  check(wUV <= 1e-9, `ᛖ_UV = Y o X^-1 vs polar coordinates about (-1, -1) (500 random points of U ∩ V): max difference ${wUV.toExponential(2)}`);
  check(wVU <= 1e-9, `ᛖ_VU = X o Y^-1 vs (-1 + r cos θ, -1 + r sin θ): max difference ${wVU.toExponential(2)}`);
  check(wB <= 1e-9 && wY <= 1e-9, `ᛖ_VU o ᛖ_UV = id on X(U ∩ V): ${wB.toExponential(2)}; Y and its inverse: ${wY.toExponential(2)}`);
  check(r.bnd.every(([fi, fo, gi, go]) => fi && !fo && gi && !go), `membership at the boundaries of U and V (360 angles each, 1e-9 inside / outside), in M and in chart coordinates`);
  check(r.polar.every(v => !v), 'Y(V) excludes r <= 0 and |θ| > π');
}

// ---- laws (end of §2.3, D57): closed forms of §2.3, written here independently of the module. The plane's own
// coordinates: X = (2, 1), the covector X(v) = (1/2) v^1 + v^2; a basis is a pair of vectors (the columns of B).
const LAWS_VEC = [2, 1], LAWS_COV = [0.5, 1];
const m2 = {
  inv: ([[a, b], [c, d]]) => { const D = a * d - b * c; return [[d / D, -b / D], [-c / D, a / D]]; },
  mul: (A, B) => [0, 1].map(i => [0, 1].map(j => A[i][0] * B[0][j] + A[i][1] * B[1][j])),
  app: (A, v) => [0, 1].map(i => A[i][0] * v[0] + A[i][1] * v[1]),
  T: A => [[A[0][0], A[1][0]], [A[0][1], A[1][1]]],
  cols: ([b1, b2]) => [[b1[0], b2[0]], [b1[1], b2[1]]]
};
// J from  x̂_i = Σ_j J^j_i ŷ_j  (J = Y⁻¹ X); x^i from 𝒳 = Σ x^i x̂_i; 𝚡_i = 𝖷(x̂_i); then the laws of §2.3:
// y^i = Σ_j J^i_j x^j,  𝚢_j = Σ_i (J⁻¹)^i_j 𝚡_i  (i.e. 𝚡_j = Σ_i J^i_j 𝚢_i)
function lawsExpect({ x, y }) {
  const X = m2.cols(x), Y = m2.cols(y), J = m2.mul(m2.inv(Y), X), Jinv = m2.inv(J);
  const cx = m2.app(m2.inv(X), LAWS_VEC), kx = x.map(b => LAWS_COV[0] * b[0] + LAWS_COV[1] * b[1]);
  const cy = m2.app(J, cx), ky = m2.app(m2.T(Jinv), kx);
  return { J, Jinv, cx, kx, cy, ky, pair: [kx[0] * cx[0] + kx[1] * cx[1], ky[0] * cy[0] + ky[1] * cy[1]] };
}
const sinAngle = ([a, b]) => Math.abs(a[0] * b[1] - a[1] * b[0]) / (Math.hypot(...a) * Math.hypot(...b));

async function testLaws(width) {
  console.log(`laws @ ${width}px`);
  const { page, errors } = await open(LAWS, width);
  await ready(page);
  const fr = page.locator('.dg-interactive');
  // place (D57): after the last list of §2.3's text, before the footnotes, the "read" toggle and previous/next
  const place = await fr.evaluate(f => {
    const prev = f.previousElementSibling, next = f.nextElementSibling, all = [...document.querySelectorAll('main *')];
    const after = sel => { const e = document.querySelector(sel); return !!e && all.indexOf(e) > all.indexOf(f); };
    return { prev: prev && prev.matches('ul.dg-itemize') && /This generalizes the transformation rules previously seen for vectors/.test(prev.lastElementChild.textContent),
      next: next && next.matches('.dg-footnotes'), nav: after('.dg-prevnext'), frames: document.querySelectorAll('.dg-interactive').length, for: f.dataset.for,
      fnInside: !!f.querySelector('.dg-fn'), height: f.getBoundingClientRect().height };
  });
  check(place.prev && place.next && place.nav && place.frames === 1 && place.for === 'section_Basis_Components_Transformations' && !place.fnInside,
    `panel at the end of §2.3: after its last list item, before the footnotes and previous/next (${JSON.stringify(place)})`);
  if (width >= 1000) check(place.height <= 800, `panel height ${Math.round(place.height)} px <= 800 px`);
  const state = async () => JSON.parse(await fr.locator('.dg-laws').getAttribute('data-state'));
  const panel = k => fr.locator('.dg-laws .dg-panel').nth(k);
  const nums = s => (s.match(/[−-]?\d+\.\d+/g) || []).map(num);
  async function numbers(what) {
    const st = await state(), e = lawsExpect(st);
    const ro = (await fr.locator('.dg-readout-value').allTextContents()).map(nums);
    const ms = await fr.locator('.dg-laws-eqs .dg-mat').evaluateAll(ms => ms.map(m => [...m.children].map(c => c.textContent)));
    const mats = ms.map(m => m.map(num)), pr = (await fr.locator('.dg-laws-pair').allTextContents()).map(num);
    const text = (await fr.locator('.dg-interactive-body').textContent());
    // order on the panel: x^i, 𝚡_i | y^i, 𝚢_i ; J, J⁻¹ ; y = J x ; 𝚡 = 𝚢 J ; pairing, pairing
    const shown = [ro[0], ro[1], ro[2], ro[3], mats[0], mats[1], mats[2], mats[3], mats[4], mats[5], mats[6], mats[7], pr];
    const want = [e.cx, e.kx, e.cy, e.ky, e.J.flat(), e.Jinv.flat(), e.cy, e.J.flat(), e.cx, e.kx, e.ky, e.J.flat(), e.pair];
    const err = Math.max(...shown.flatMap((a, k) => a.length === want[k].length ? a.map((v, i) => Math.abs(v - want[k][i])) : [Infinity]));
    check(err <= 5.1e-4 && !/NaN|Infinity/.test(text) && sinAngle(st.x) > 0.169 && sinAngle(st.y) > 0.169,
      `${what}: x (${ro[0]}) ${'\u{1D6A1}'} (${ro[1]}) y (${ro[2]}) ${'\u{1D6A2}'} (${ro[3]}) J (${mats[0]}) pairing ${pr.join(' = ')}; max deviation from the closed forms ${err.toExponential(1)}`);
    return st;
  }
  await shot(page, `laws-${width}.png`);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  check(await fr.locator('.dg-laws-tex mjx-container').count() === 5, 'the laws of §2.3 and the pairing typeset (5 formulas)');
  const tops = await fr.locator('.dg-laws .dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? tops[1] > tops[0] + 50 : Math.abs(tops[1] - tops[0]) < 2, width < 700 ? 'basis panels stacked' : 'basis panels side by side');
  const st0 = await numbers('start');
  check(JSON.stringify(st0) === JSON.stringify({ x: [[1, 0], [0, 1]], y: [[1.5, 0.5], [-0.5, 1]] }), 'starts at x̂ = (1, 0), (0, 1); ŷ = (1.5, 0.5), (−0.5, 1)');
  // mouse: drag the tip of ŷ_1
  let [x, y] = await center(panel(1).locator('[data-key="h0"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y - 30, { steps: 5 }); await page.mouse.up();
  const st1 = await numbers('after dragging ŷ₁');
  check(st1.y[0][0] > st0.y[0][0] + 0.2 && st1.y[0][1] > st0.y[0][1] + 0.2 && JSON.stringify(st1.x) === JSON.stringify(st0.x), `ŷ₁ moved to (${st1.y[0].map(v => v.toFixed(3))}), x̂ unchanged`);
  // mouse: drag ŷ_2 onto the line of ŷ_1 (a degenerate basis): the tip stops before
  [x, y] = await center(panel(1).locator('[data-key="h1"]'));
  const [tx, ty] = await panel(1).locator('[data-key="h0"]').evaluate(h => { const b = h.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(tx, ty, { steps: 12 }); await page.mouse.up();
  const st2 = await numbers('after dragging ŷ₂ onto ŷ₁');
  check(sinAngle(st2.y) < 0.2 && Math.hypot(st2.y[1][0] - st1.y[1][0], st2.y[1][1] - st1.y[1][1]) > 0.2,
    `ŷ₂ stops where the basis would degenerate (|sin angle| ${sinAngle(st2.y).toFixed(3)}, the limit is 0.17)`);
  // mouse: x̂_2 too
  [x, y] = await center(panel(0).locator('[data-key="h1"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 35, y + 10, { steps: 5 }); await page.mouse.up();
  const st3 = await numbers('after dragging x̂₂');
  check(st3.x[1][0] < -0.2, `x̂₂ moved to (${st3.x[1].map(v => v.toFixed(3))})`);
  // keyboard: arrow keys on focused handles
  await panel(0).locator('[data-key="h0"]').focus(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  const st4 = await numbers('ArrowUp x2 on x̂₁');
  check(st4.x[0][1] > st3.x[0][1] + 0.05 && near(st4.x[0][0], st3.x[0][0], 1e-9), 'ArrowUp moves the tip of x̂₁ up');
  await panel(1).locator('[data-key="h1"]').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  const st5 = await numbers('ArrowLeft x3 on ŷ₂');
  check(st5.y[1][0] < st4.y[1][0] - 0.1, 'ArrowLeft moves the tip of ŷ₂ to the left');
  await shot(page, `laws-moved-${width}.png`);
  await panelFoot(page, fr, null, null, null);
  check(JSON.stringify(await state()) === JSON.stringify(st0), 'Reset -> the starting bases again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await lawsCrossChecks(page);
  await page.close();
}

async function lawsCrossChecks(page) {
  console.log('laws: the module against the laws of §2.3 (200 random bases)');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/laws.js');
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const vec = () => { const a = 2 * Math.PI * rnd(), n = 0.3 + 2.5 * rnd(); return [n * Math.cos(a), n * Math.sin(a)]; };
    const out = [];
    while (out.length < 200) { const x = [vec(), vec()], y = [vec(), vec()]; if (m.admissible(x) && m.admissible(y)) out.push({ x, y, r: m.laws(x, y) }); }
    return { out, VEC: m.VEC, COV: m.COV };
  });
  check(JSON.stringify(r.VEC) === JSON.stringify(LAWS_VEC) && JSON.stringify(r.COV) === JSON.stringify(LAWS_COV), '𝒳 and 𝖷 as in the test');
  let w = 0, wp = 0, wJ = 0;
  for (const { x, y, r: q } of r.out) {
    const e = lawsExpect({ x, y });
    for (const k of ['cx', 'kx', 'cy', 'ky']) w = Math.max(w, ...q[k].map((v, i) => Math.abs(v - e[k][i])));
    wJ = Math.max(wJ, ...[0, 1].flatMap(i => [0, 1].map(j => Math.max(Math.abs(q.J[i][j] - e.J[i][j]), Math.abs(q.Jinv[i][j] - e.Jinv[i][j])))));
    // the pairing does not depend on the basis: X(𝒳) = Σ 𝚡_i x^i = Σ 𝚢_i y^i = 2
    wp = Math.max(wp, Math.abs(q.pair[0] - q.pair[1]), Math.abs(q.pair[0] - 2), Math.abs(e.pair[1] - 2));
  }
  check(w < 1e-9, `components x^i, 𝚡_i, y^i = J^i_j x^j, 𝚢_j = (J⁻¹)^i_j 𝚡_i vs the module: max difference ${w.toExponential(2)}`);
  check(wJ < 1e-9, `J (x̂_i = J^j_i ŷ_j) and J⁻¹ vs the module: max difference ${wJ.toExponential(2)}`);
  check(wp < 1e-9, `pairing Σ 𝚡_i x^i = Σ 𝚢_i y^i = 𝖷(𝒳) = 2 over 200 random bases: max deviation ${wp.toExponential(2)}`);
}

// ---- transport (end of Appendix C.5, D57): closed forms of C.5, written here independently of the module. In the chart
// X: ∇^E keeps the cartesian components constant; ∇^W keeps the components w^a in the frame e_1 = (a, b)/ρ,
// e_2 = (−b, a)/ρ constant (along δ_r0: the polar components, i.e. (z¹ cos λ − r0 z² sin λ, z¹ sin λ + r0 z² cos λ));
// ∇^κ keeps z² and changes z¹ by −κ z² ∫ a db along the loop (rectangle: −κ x1 z² Δb up the right side, +κ x0 z² Δb
// down the left side, Δz¹ = −κ z² (x1 − x0) Δb; circle: ∫ a db = r0² (λ + π + sin λ cos λ)/2, our integral, not the
// notes'). Torsion T^i_12: (−b, a)/ρ² for ∇^W, 0 otherwise; Riem^1_212 = κ for ∇^κ, all others 0.
const trPos = (st, l) => {
  if (st.loop === 'delta') return [st.r0 * Math.cos(l), st.r0 * Math.sin(l)];
  const [x0, x1, b0, db] = st.rect, w = x1 - x0;
  if (l <= w) return [x0 + l, b0];
  if (l <= w + db) return [x1, b0 + l - w];
  if (l <= 2 * w + db) return [x1 - (l - w - db), b0 + db];
  return [x0, b0 + db - (l - 2 * w - db)];
};
const trPolar = ([a, b], z) => { const r2 = a * a + b * b, r = Math.sqrt(r2); return [(a * z[0] + b * z[1]) / r, (-b * z[0] + a * z[1]) / r2]; };
function trZ(st, l) {                                   // 𝒵 at λ, components in X
  const p = trPos(st, st.loop === 'delta' ? -Math.PI : 0), q = trPos(st, l), z = st.z0;
  if (st.conn === 'E') return z.slice();
  if (st.conn === 'W') {
    const e = ([a, b]) => { const r = Math.hypot(a, b); return [[a / r, b / r], [-b / r, a / r]]; }, [e1, e2] = e(p), [f1, f2] = e(q);
    const w = [z[0] * e1[0] + z[1] * e1[1], z[0] * e2[0] + z[1] * e2[1]];
    return [w[0] * f1[0] + w[1] * f2[0], w[0] * f1[1] + w[1] * f2[1]];
  }
  let I;                                                // ∫ a db from the start to λ
  if (st.loop === 'delta') I = st.r0 * st.r0 * (l + Math.PI + Math.sin(l) * Math.cos(l)) / 2;
  else { const [x0, x1, b0, db] = st.rect, w = x1 - x0; I = x1 * Math.min(db, Math.max(0, l - w)) - x0 * Math.min(db, Math.max(0, l - 2 * w - db)); }
  return [z[0] - st.kappa * z[1] * I, z[1]];
}
function trExpect(st) {
  const l = st.lam, q = trPos(st, l), zl = trZ(st, l), L = st.loop === 'delta' ? Math.PI : 2 * (st.rect[1] - st.rect[0]) + 2 * st.rect[3];
  const zE = trZ(st, L), r2 = q[0] * q[0] + q[1] * q[1];
  const T = st.conn === 'W' ? [-q[1] / r2, q[0] / r2] : [0, 0], R = [[0, st.conn === 'k' ? st.kappa : 0], [0, 0]];
  let F = null, val = null;
  if (st.loop === 'delta' && st.conn === 'E') { const c = st.z0; F = [c[0] * Math.cos(l) + c[1] * Math.sin(l), (-c[0] * Math.sin(l) + c[1] * Math.cos(l)) / st.r0]; }
  if (st.loop === 'delta' && st.conn === 'W') F = zl;
  if (st.loop === 'rect' && st.conn === 'k') val = -st.kappa * st.z0[1] * (st.rect[1] - st.rect[0]) * st.rect[3];
  if (st.conn === 'k' && st.loop === 'rect') check(Math.abs(zE[0] - st.z0[0] - val) < 1e-12, 'test: Δz¹ of the side-by-side sum = the notes\' −κ z² (x1 − x0) Δb');
  return { zl, zY: trPolar(q, zl), dz: [zE[0] - st.z0[0], zE[1] - st.z0[1]], F, val, T, R };
}

async function testTransport(width) {
  console.log(`transport @ ${width}px`);
  const { page, errors } = await open(TR, width);
  await ready(page);
  const fr = page.locator('.dg-interactive');
  // place (D57): after the last paragraph of C.5 (the end of the subsection on ∇^κ), before "Mark as read" and previous/next
  const place = await fr.evaluate(f => {
    const all = [...document.querySelectorAll('main *')], i = all.indexOf(f);
    const lastP = all.slice(0, i).filter(e => e.matches('p')).pop(), after = sel => { const e = document.querySelector(sel); return !!e && all.indexOf(e) > i; };
    const heads = all.slice(0, i).filter(e => e.matches('h2, h3, h4'));
    return { lastP: !!lastP && /Repeating the computation for/.test(lastP.textContent) && /loops must avoid the origin/.test(lastP.textContent),
      lastHead: heads.length && heads.pop().textContent.includes('A curved, torsion-free connection'),
      nav: after('.dg-prevnext') && after('.dg-readbar'), frames: document.querySelectorAll('.dg-interactive').length, for: f.dataset.for, height: f.getBoundingClientRect().height };
  });
  check(place.lastP && place.lastHead && place.nav && place.frames === 1 && place.for === 'subsection_Example_Connections_curved',
    `panel at the end of C.5 (after the subsection on ∇^κ and its last paragraph, before previous/next) (${JSON.stringify(place)})`);
  if (width >= 1000) check(place.height <= 850, `panel height ${Math.round(place.height)} px <= 850 px`);
  const state = async () => JSON.parse(await fr.locator('.dg-transport').getAttribute('data-state'));
  const svg = fr.locator('.dg-transport svg.dg-plot-svg');
  const pick = (group, k) => fr.locator('.dg-choice').nth(group).locator('label').nth(k).click();
  async function numbers(what) {
    const st = await state(), e = trExpect(st);
    const ms = await fr.locator('.dg-tr-out .dg-mat').evaluateAll(ms => ms.map(m => ({ hidden: !m.offsetParent, v: [...m.children].map(c => c.textContent) })));
    const vals = ms.map(m => m.v.map(num)), fv = await fr.locator('.dg-tr-val').textContent(), rowF = await fr.locator('.dg-tr-out .dg-tr-row').nth(2).isVisible();
    const shown = [vals[0], vals[1], vals[2], vals[4], vals[5]], want = [e.zl, e.zY, e.dz, e.T, e.R.flat()];
    if (e.F) { shown.push(vals[3]); want.push(e.F); }
    if (e.val != null) { shown.push([num(fv)]); want.push([e.val]); }
    const err = Math.max(...shown.map((a, k) => a.length === want[k].length ? Math.max(...a.map((v, i) => Math.abs(v - want[k][i]))) : Infinity));
    const formOk = (e.F ? !ms[3].hidden : ms[3].hidden) && rowF === (st.loop === 'rect' || st.conn !== 'k');
    const text = await fr.locator('.dg-interactive-body').textContent();
    check(err <= 5.1e-4 && formOk && !/NaN|Infinity/.test(text),
      `${what} (${st.conn}, ${st.loop}, λ = ${st.lam.toFixed(3)}): 𝒵 in X (${vals[0]}) in Y (${vals[1]}) Δz (${vals[2]}) T (${vals[4]}) Riem (${vals[5]})${e.F ? ' closed form (' + vals[3] + ')' : ''}${e.val != null ? ' Δz¹ = ' + fv : ''}; max deviation from the closed forms ${err.toExponential(1)}`);
    return st;
  }
  await shot(page, `transport-${width}.png`);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  check(await fr.locator('.dg-choice label mjx-container').count() === 5 && await fr.locator('.dg-slider .dg-ctl-label mjx-container').count() === 2, 'options and slider labels typeset');
  const tops = await fr.locator('.dg-transport .dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? tops[1] > tops[0] + 50 : tops[1] < tops[0] + 300, width < 700 ? 'chart above the numbers' : 'chart and numbers side by side');
  const st0 = await numbers('start');
  check(JSON.stringify(st0) === JSON.stringify({ conn: 'E', loop: 'delta', k: 300, z0: [0.5, 0.7], r0: 1, rect: [0.5, 2, -0.9, 1.6], kappa: 1, lam: Math.PI / 2 }), 'starts with ∇^E, δ_r0 (r0 = 1), 𝒵 = (0.5, 0.7) at p, λ = π/2');
  check(await fr.locator('.dg-tr-kappa input').isDisabled(), 'κ slider disabled for ∇^E');
  await pick(0, 1); await numbers('∇^W');
  await pick(0, 2); await numbers('∇^κ');
  check(!(await fr.locator('.dg-tr-kappa input').isDisabled()), 'κ slider enabled for ∇^κ');
  await pick(1, 1); await numbers('∇^κ, rectangle');
  await shot(page, `transport-curved-${width}.png`);
  await pick(0, 0); await numbers('∇^E, rectangle');
  await pick(0, 1); await numbers('∇^W, rectangle');
  await pick(0, 2);
  // mouse: the opposite corner, then p, of the rectangle
  let [x, y] = await center(svg.locator('[data-key="q"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 25, y - 30, { steps: 5 }); await page.mouse.up();
  const s1 = await numbers('after dragging the opposite corner');
  check(s1.rect[1] > 2.1 && s1.rect[3] > 1.7 && s1.rect[0] === 0.5 && s1.rect[2] === -0.9, `corner moved: rectangle ${s1.rect.map(v => v.toFixed(3))}`);
  [x, y] = await center(svg.locator('[data-key="p"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 200, y, { steps: 8 }); await page.mouse.up();
  const s2 = await numbers('after dragging p to the left');
  check(near(s2.rect[0], 0.25, 1e-9), `p stops at a = 0.25 (the rectangle stays away from the origin): ${s2.rect.map(v => v.toFixed(3))}`);
  // keyboard: λ and κ sliders
  await fr.locator('.dg-tr-lambda input').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const s3 = await numbers('ArrowRight x2 on λ');
  check(s3.k === 302, `ArrowRight moves λ by two steps (k = ${s3.k})`);
  await fr.locator('.dg-tr-kappa input').focus(); await page.keyboard.press('ArrowRight');
  const s4 = await numbers('ArrowRight on κ');
  check(near(s4.kappa, 1.05, 1e-9), `κ = ${s4.kappa}`);
  // circle: drag the tip of 𝒵 and p; arrow keys on both
  await pick(1, 0);
  [x, y] = await center(svg.locator('[data-key="tip"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 30, y + 40, { steps: 5 }); await page.mouse.up();
  const s5 = await numbers('after dragging the tip of 𝒵');
  check(s5.z0[0] > 0.6 && s5.z0[1] < 0.5, `𝒵 at p = (${s5.z0.map(v => v.toFixed(3))})`);
  [x, y] = await center(svg.locator('[data-key="p"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 40, y, { steps: 5 }); await page.mouse.up();
  const s6 = await numbers('after dragging p outwards');
  check(s6.r0 > 1.2, `r0 = ${s6.r0.toFixed(3)}`);
  await svg.locator('[data-key="p"]').focus(); await page.keyboard.press('ArrowRight');
  const s7 = await numbers('ArrowRight on p');
  check(near(s7.r0, Math.round((s6.r0 - 0.05) * 100) / 100, 1e-9), `ArrowRight on p makes the circle smaller (r0 ${s6.r0.toFixed(3)} -> ${s7.r0})`);
  await svg.locator('[data-key="tip"]').focus(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  const s8 = await numbers('ArrowUp x2 on the tip of 𝒵');
  check(s8.z0[1] > s7.z0[1] + 0.05, `ArrowUp moves the tip of 𝒵 up (z² ${s7.z0[1].toFixed(3)} -> ${s8.z0[1].toFixed(3)})`);
  for (const k of [1, 0]) { await pick(0, k); await numbers(['∇^E', '∇^W'][k] + ' after the changes'); }
  await shot(page, `transport-moved-${width}.png`);
  await panelFoot(page, fr, null, null, null);
  check(JSON.stringify(await state()) === JSON.stringify(st0), 'Reset -> the starting state again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await transportCrossChecks(page);
  await page.close();
}

async function transportCrossChecks(page) {
  console.log('transport: the module against the closed forms of C.5 (random states)');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/transport.js');
    let seed = 7; const rnd = (a, b) => a + (b - a) * ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const tr = [], ap = [], tc = [], G = [];
    for (let n = 0; n < 60; n++) for (const conn of ['E', 'W', 'k']) for (const loop of ['delta', 'rect']) {
      const x0 = rnd(0.25, 1.5), b0 = rnd(-2.3, 1), st = { conn, loop, z0: [rnd(-1.2, 1.2), rnd(-1.2, 1.2)], r0: rnd(0.4, 2), rect: [x0, rnd(x0 + 0.3, 2.45), b0, rnd(0.3, 2.45 - b0)], kappa: rnd(0.1, 2) };
      const L = m.loopOf(loop, st.r0, st.rect), lam = rnd(L.l0, L.l1);
      const [zl, zE] = m.transport(conn, L, st.z0, [lam, L.l1], st.kappa);
      tr.push({ st: { ...st, lam }, zl, zE, at: m.at(L, lam) });
    }
    for (let n = 0; n < 60; n++) for (const conn of ['E', 'W', 'k']) {
      const p = [rnd(-2, 2), rnd(-2, 2)], v = [rnd(-1, 1), rnd(-1, 1)], kappa = rnd(0.1, 2), lam = rnd(-1, 1);
      if (conn === 'W' && Math.hypot(...p) < 0.5) continue;
      ap.push({ conn, p, v, kappa, lam, s: m.autoparallel(conn, p, v, lam, kappa) });
      const tcv = m.torsionCurvature(conn, p, kappa);
      tc.push({ conn, p, kappa, ...tcv });
      G.push({ conn, p, kappa, G: m.Gamma(conn, p, kappa) });
    }
    return { tr, ap, tc, G, START: m.START };
  });
  check(JSON.stringify(r.START) === JSON.stringify({ conn: 'E', loop: 'delta', k: 300, z0: [0.5, 0.7], r0: 1, rect: [0.5, 2, -0.9, 1.6], kappa: 1 }), 'starting state as in the test');
  // transport: 𝒵(λ) and after the full loop, every connection on both loops
  const w = {};
  for (const { st, zl, zE, at } of r.tr) {
    const L = st.loop === 'delta' ? Math.PI : 2 * (st.rect[1] - st.rect[0]) + 2 * st.rect[3], key = st.conn + ' ' + st.loop;
    const q = trPos(st, st.lam), e = trZ(st, st.lam), eE = trZ(st, L);
    w[key] = Math.max(w[key] || 0, Math.hypot(at[0] - q[0], at[1] - q[1]), Math.abs(zl[0] - e[0]), Math.abs(zl[1] - e[1]), Math.abs(zE[0] - eE[0]), Math.abs(zE[1] - eE[1]));
    if (st.conn !== 'k') w[key] = Math.max(w[key], Math.abs(zE[0] - st.z0[0]), Math.abs(zE[1] - st.z0[1]));   // flat: Δz = 0 on every loop
    if (st.conn === 'W' && st.loop === 'delta') {                                                              // the notes' formula along δ_r0
      const [z1, z2] = trPolar([-st.r0, 0], st.z0), l = st.lam;
      w[key] = Math.max(w[key], Math.abs(zl[0] - (z1 * Math.cos(l) - st.r0 * z2 * Math.sin(l))), Math.abs(zl[1] - (z1 * Math.sin(l) + st.r0 * z2 * Math.cos(l))));
    }
  }
  for (const [k, v] of Object.entries(w)) check(v < 1e-6, `parallel transport, ${k}: 𝒵(λ) and 𝒵 after the full loop vs the closed form, max difference ${v.toExponential(2)} (60 random states)`);
  // autoparallels: ∇^E straight lines; ∇^W γ¹ = r0 + uλ, γ² = φ0 + (w/u) ln(1 + uλ/r0) (or φ0 + (w/r0) λ); ∇^κ γ² = b0 + vλ, γ¹ = A cos(√κ v λ + ψ)
  const wa = { E: 0, W: 0, k: 0 };
  for (const { conn, p, v, kappa, lam, s } of r.ap) {
    let e;
    if (conn === 'E') e = [p[0] + lam * v[0], p[1] + lam * v[1]];
    else if (conn === 'W') {
      const r0 = Math.hypot(...p), f0 = Math.atan2(p[1], p[0]), u = (p[0] * v[0] + p[1] * v[1]) / r0, wv = (p[0] * v[1] - p[1] * v[0]) / r0;
      if (r0 + u * lam < 0.2) continue;
      const f = Math.abs(u) < 1e-12 ? f0 + wv / r0 * lam : f0 + wv / u * Math.log(1 + u * lam / r0), rr = r0 + u * lam;
      e = [rr * Math.cos(f), rr * Math.sin(f)];
    } else {
      const om = Math.sqrt(kappa) * v[1];
      if (Math.abs(om) < 0.05) continue;
      const A = Math.hypot(p[0], v[0] / om), psi = Math.atan2(-v[0] / om, p[0]);
      e = [A * Math.cos(om * lam + psi), p[1] + v[1] * lam];
    }
    wa[conn] = Math.max(wa[conn], Math.abs(s[0] - e[0]), Math.abs(s[1] - e[1]));
  }
  check(wa.E < 1e-6 && wa.W < 1e-6 && wa.k < 1e-6, `autoparallels vs the notes' closed forms (lines, circles/radial lines/logarithmic spirals, sinusoids): max differences ${wa.E.toExponential(1)}, ${wa.W.toExponential(1)}, ${wa.k.toExponential(1)}`);
  // torsion and curvature
  let wt = 0;
  for (const { conn, p, kappa, T, R } of r.tc) {
    const r2 = p[0] * p[0] + p[1] * p[1], eT = conn === 'W' ? [-p[1] / r2, p[0] / r2] : [0, 0], eR = [[0, conn === 'k' ? kappa : 0], [0, 0]];
    wt = Math.max(wt, ...T.map((v, i) => Math.abs(v - eT[i])), ...R.flatMap((row, i) => row.map((v, j) => Math.abs(v - eR[i][j]))));
  }
  check(wt < 1e-6, `T^i_12 (∇^W: (−b, a)/(a² + b²)) and Riem^i_j12 (∇^κ: Riem^1_212 = κ) vs the notes: max difference ${wt.toExponential(2)}`);
  // the coefficients in X, carried to the chart Y by the transformation law, give the notes' coefficients in Y
  let wg = 0;
  for (const { conn, p, G: Gx } of r.G) {
    if (conn === 'k') continue;
    const b1 = Math.hypot(...p), b2 = Math.atan2(p[1], p[0]), c = Math.cos(b2), s = Math.sin(b2);
    const dX = [[c, -b1 * s], [s, b1 * c]], dY = [[c, s], [-s / b1, c / b1]], dd = [[[0, -s], [-s, -b1 * c]], [[0, c], [c, -b1 * s]]];   // ∂X^s/∂Y^j, ∂Y^i/∂X^l, ∂²X^s/∂Y^k∂Y^j
    const want = [[[0, 0], [0, conn === 'E' ? -b1 : 0]], [[0, conn === 'E' ? 1 / b1 : 0], [1 / b1, 0]]];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      let g = 0;
      for (let S = 0; S < 2; S++) { g += dY[i][S] * dd[S][k][j]; for (let l = 0; l < 2; l++) for (let mm = 0; mm < 2; mm++) g += dY[i][S] * dX[l][j] * dX[mm][k] * Gx[S][l][mm]; }
      wg = Math.max(wg, Math.abs(g - want[i][j][k]));
    }
  }
  check(wg < 1e-12, `Γ in X carried to Y gives the notes' (Γ^E_y)^1_22 = −β1, (Γ^E_y)^2_12 = (Γ^E_y)^2_21 = 1/β1, (Γ^W_y)^2_21 = 1/β1, all others 0: max difference ${wg.toExponential(2)}`);
}

// ---- touch (D56) on a phone (390 px, hasTouch, isMobile). Swipes are CDP Input.dispatchTouchEvent, which go
// through the browser's own gesture handling, so touch-action decides between scrolling the page and the panel.
async function swipe(page, cdp, [x0, y0], [x1, y1], steps = 10) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let k = 1; k <= steps; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / steps, y: y0 + (y1 - y0) * k / steps }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(500);
}
const scrollY = page => page.evaluate(() => Math.round(scrollY));
// a point of the drawing `loc` (svg or canvas) whose topmost element is not a handle, an arrow or a label,
// at least 40 px from every handle: a touch there starts on the empty drawing area
const emptyPoint = loc => loc.evaluate(d => {
  const b = d.getBoundingClientRect(), hs = [...d.querySelectorAll('.dg-handle')].map(h => h.getBoundingClientRect());
  for (let fy = 0.75; fy > 0.2; fy -= 0.05) for (let fx = 0.2; fx < 0.85; fx += 0.05) {
    const x = b.left + fx * b.width, y = b.top + fy * b.height, e = document.elementFromPoint(x, y);
    if (!e || !d.contains(e) && e !== d || e.closest('.dg-handle, .dg-handle-hit, .dg-arrow:not(.dg-inert)')) continue;
    if (hs.every(h => Math.hypot(h.left + h.width / 2 - x, h.top + h.height / 2 - y) > 40)) return [x, y];
  }
  return null;
});

async function testTouch() {
  console.log('touch @ 390px (phone)');
  // 2D (tpm, chart (U, X)) and 3D (tpm, the view of M)
  {
    const { page, errors } = await open(TPM, 390, { touch: true });
    await ready(page);
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator('.dg-interactive');
    const state = async () => (await fr.locator('.dg-tpm').getAttribute('data-state'));
    const svg = fr.locator('.dg-tpm .dg-panel').nth(0).locator('svg');
    check(await svg.evaluate(e => getComputedStyle(e).touchAction) === 'pan-y pinch-zoom' && await svg.locator('[data-key="p"]').evaluate(e => getComputedStyle(e).touchAction) === 'none',
      'chart: touch-action pan-y pinch-zoom on the drawing, none on the handles');
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    let s0 = await state(), y0 = await scrollY(page);
    const pt = await emptyPoint(svg);
    check(!!pt, 'chart: found an empty point of the drawing');
    if (pt) {
      await swipe(page, cdp, pt, [pt[0], pt[1] - 150]);
      const y1 = await scrollY(page);
      check(y1 > y0 + 50 && await state() === s0, `chart: a vertical swipe from an empty point scrolls the page (scrollY ${y0} -> ${y1}) and leaves the panel as it was`);
    }
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    // the touch starts 10 px right of the centre of p: outside the drawn disc (radius 6.5), inside the hit area (>= 24 px)
    const hb = await svg.locator('[data-key="p"]').boundingBox(), hx = hb.x + hb.width / 2 + 10, hy = hb.y + hb.height / 2;
    s0 = await state(); y0 = await scrollY(page);
    await swipe(page, cdp, [hx, hy], [hx - 15, hy - 30]);
    const s1 = await state(), y1 = await scrollY(page);
    check(s1 !== s0 && y1 === y0, `chart: a swipe starting 10 px from the centre of p drags p (p ${JSON.parse(s0).p.map(v => v.toFixed(3))} -> ${JSON.parse(s1).p.map(v => v.toFixed(3))}) and does not scroll (scrollY ${y0} -> ${y1})`);
    // 3D
    const cv = fr.locator('canvas');
    const hash = () => cv.evaluate(c => { const d = c.toDataURL(); let h = 0; for (let k = 0; k < d.length; k += 7) h = (h * 31 + d.charCodeAt(k)) | 0; return h; });
    check(await cv.evaluate(e => getComputedStyle(e).touchAction) === 'pan-y pinch-zoom', '3D view: touch-action pan-y pinch-zoom');
    await cv.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    let b = await cv.boundingBox(), h0 = await hash();
    y0 = await scrollY(page);
    await swipe(page, cdp, [b.x + b.width * 0.3, b.y + b.height / 2], [b.x + b.width * 0.7, b.y + b.height / 2]);
    let h1 = await hash(), y1b = await scrollY(page);
    check(h1 !== h0 && y1b === y0, `3D view: a horizontal swipe rotates it and does not scroll (scrollY ${y0} -> ${y1b})`);
    await cv.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    b = await cv.boundingBox(); h0 = await hash(); y0 = await scrollY(page);
    await swipe(page, cdp, [b.x + b.width / 2, b.y + b.height * 0.75], [b.x + b.width / 2, b.y + b.height * 0.75 - 150]);
    h1 = await hash(); y1b = await scrollY(page);
    check(y1b > y0 + 50 && h1 === h0, `3D view: a vertical swipe scrolls the page (scrollY ${y0} -> ${y1b}) and leaves the view as it was`);
    check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // laws (B24): a finger drag that starts 10 px off the tip of ŷ₁ (drawn radius 8) moves it; a vertical swipe elsewhere scrolls
  {
    const { page, errors } = await open(LAWS, 390, { touch: true });
    await ready(page);
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator('.dg-interactive');
    const state = () => fr.locator('.dg-laws').getAttribute('data-state');
    const svg = fr.locator('.dg-laws .dg-panel').nth(1).locator('svg');
    check(await svg.evaluate(e => getComputedStyle(e).touchAction) === 'pan-y pinch-zoom' && await svg.locator('[data-key="h0"]').evaluate(e => getComputedStyle(e).touchAction) === 'none',
      'laws: touch-action pan-y pinch-zoom on the drawing, none on the handles');
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const hb = await svg.locator('[data-key="h0"]').boundingBox(), hx = hb.x + hb.width / 2 + 10, hy = hb.y + hb.height / 2;
    let s0 = await state(), y0 = await scrollY(page);
    await swipe(page, cdp, [hx, hy], [hx - 20, hy - 30]);
    const s1 = await state(), y1 = await scrollY(page);
    check(s1 !== s0 && y1 === y0, `laws: a swipe starting 10 px from the tip of ŷ₁ drags it (ŷ₁ ${JSON.parse(s0).y[0].map(v => v.toFixed(3))} -> ${JSON.parse(s1).y[0].map(v => v.toFixed(3))}) and does not scroll (scrollY ${y0} -> ${y1})`);
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const pt = await emptyPoint(svg);
    check(!!pt, 'laws: found an empty point of the drawing');
    if (pt) {
      s0 = await state(); y0 = await scrollY(page);
      await swipe(page, cdp, pt, [pt[0], pt[1] - 150]);
      const y2 = await scrollY(page);
      check(y2 > y0 + 50 && await state() === s0, `laws: a vertical swipe from an empty point scrolls the page (scrollY ${y0} -> ${y2}) and leaves the panel as it was`);
    }
    check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // transport (B25): a finger drag that starts 10 px off p (drawn radius 6.5) changes r0; a vertical swipe elsewhere scrolls
  {
    const { page, errors } = await open(TR, 390, { touch: true });
    await ready(page);
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator('.dg-interactive');
    const state = () => fr.locator('.dg-transport').getAttribute('data-state');
    const svg = fr.locator('.dg-transport svg.dg-plot-svg');
    check(await svg.evaluate(e => getComputedStyle(e).touchAction) === 'pan-y pinch-zoom' && await svg.locator('[data-key="p"]').evaluate(e => getComputedStyle(e).touchAction) === 'none',
      'transport: touch-action pan-y pinch-zoom on the drawing, none on the handles');
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const hb = await svg.locator('[data-key="p"]').boundingBox(), hx = hb.x + hb.width / 2 - 10, hy = hb.y + hb.height / 2;
    let s0 = await state(), y0 = await scrollY(page);
    await swipe(page, cdp, [hx, hy], [hx - 30, hy - 10]);
    const s1 = await state(), y1 = await scrollY(page);
    check(JSON.parse(s1).r0 > JSON.parse(s0).r0 + 0.2 && y1 === y0, `transport: a swipe starting 10 px from p drags it (r0 ${JSON.parse(s0).r0} -> ${JSON.parse(s1).r0.toFixed(3)}) and does not scroll (scrollY ${y0} -> ${y1})`);
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const pt = await emptyPoint(svg);
    check(!!pt, 'transport: found an empty point of the drawing');
    if (pt) {
      s0 = await state(); y0 = await scrollY(page);
      await swipe(page, cdp, pt, [pt[0], pt[1] - 150]);
      const y2 = await scrollY(page);
      check(y2 > y0 + 50 && await state() === s0, `transport: a vertical swipe from an empty point scrolls the page (scrollY ${y0} -> ${y2}) and leaves the panel as it was`);
    }
    check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // charts (B26): a finger on p in the 3D view drags p (and does not scroll or rotate); a finger 10 px off X(p) drags it;
  // a vertical swipe elsewhere on the 3D view scrolls the page
  {
    const { page, errors } = await open(CHARTS, 390, { touch: true });
    await ready(page);
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator('.dg-interactive');
    const state = async () => JSON.parse(await fr.locator('.dg-charts').getAttribute('data-state'));
    const cv = fr.locator('canvas');
    await cv.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    let b = await cv.boundingBox(), s0 = await state(), y0 = await scrollY(page);
    const at = [b.x + s0.p3[0], b.y + s0.p3[1]];
    await swipe(page, cdp, at, [at[0] - 10, at[1] + 12]);
    let s1 = await state(), y1 = await scrollY(page);
    check(Math.hypot(s1.p[0] - s0.p[0], s1.p[1] - s0.p[1]) > 0.02 && y1 === y0 && Math.hypot(b.x + s1.p3[0] - at[0] + 10, b.y + s1.p3[1] - at[1] - 12) < 1.5,
      `charts: a finger on p in the 3D view drags it (p ${s0.p.map(v => v.toFixed(3))} -> ${s1.p.map(v => v.toFixed(3))}, under the finger) and does not scroll (scrollY ${y0} -> ${y1})`);
    await cv.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    b = await cv.boundingBox(); s0 = await state(); y0 = await scrollY(page);
    const ex = s0.p3[0] < b.width / 2 ? b.x + 0.85 * b.width : b.x + 0.15 * b.width;
    await swipe(page, cdp, [ex, b.y + b.height * 0.8], [ex, b.y + b.height * 0.8 - 150]);
    y1 = await scrollY(page);
    check(y1 > y0 + 50 && JSON.stringify((await state()).p) === JSON.stringify(s0.p), `charts: a vertical swipe on the 3D view away from p scrolls the page (scrollY ${y0} -> ${y1})`);
    const svg = fr.locator('.dg-ch-row .dg-panel').nth(0).locator('svg');
    check(await svg.evaluate(e => getComputedStyle(e).touchAction) === 'pan-y pinch-zoom' && await svg.locator('[data-key="p"]').evaluate(e => getComputedStyle(e).touchAction) === 'none',
      'charts: touch-action pan-y pinch-zoom on the chart, none on X(p)');
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const hb = await svg.locator('[data-key="p"]').boundingBox(), hx = hb.x + hb.width / 2 + 10, hy = hb.y + hb.height / 2;
    s0 = await state(); y0 = await scrollY(page);
    await swipe(page, cdp, [hx, hy], [hx - 15, hy - 20]);
    s1 = await state(); y1 = await scrollY(page);
    check(Math.hypot(s1.p[0] - s0.p[0], s1.p[1] - s0.p[1]) > 0.05 && y1 === y0, `charts: a swipe starting 10 px from X(p) drags it (p ${s0.p.map(v => v.toFixed(3))} -> ${s1.p.map(v => v.toFixed(3))}) and does not scroll (scrollY ${y0} -> ${y1})`);
    check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // maps: drag from an element of M to an element of N with a finger (up and to the right), starting 10 px off the drawn dot (radius 9)
  {
    const { page, errors } = await open(MAPS, 390, { touch: true });
    await ready(page);
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator('.dg-interactive');
    const status = () => fr.locator('.dg-status').textContent();
    await fr.locator('.dg-presets button', { hasText: /^Only Injective$/ }).click();   // 4 -> 5: element 4 of M has the arrow 4 -> 2
    const svg = fr.locator('svg.dg-plot-svg');
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const d = await svg.locator('[data-key="d3"]').boundingBox(), t = await svg.locator('[data-key="t0"]').boundingBox();
    const y0 = await scrollY(page);
    await swipe(page, cdp, [d.x + d.width / 2 - 10, d.y + d.height / 2], [t.x + t.width / 2, t.y + t.height / 2]);
    const y1 = await scrollY(page);
    check(await fr.locator('[data-key="a3-0"]').count() === 1 && await status() === 'NOT a Function' && y1 === y0,
      `maps: a finger drag from 4 in M (10 px off the dot) up to 1 in N adds the arrow (status "${await status()}") and does not scroll (scrollY ${y0} -> ${y1})`);
    check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
}

async function testBroken() {
  console.log('broken module');
  const { page } = await open(VAR, 1280, { breakModule: 'variations.js' });
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => { const f = document.querySelector('.dg-interactive'); const r = f.getBoundingClientRect(); return { ready: f.classList.contains('dg-ready'), h: r.height, vis: getComputedStyle(f).visibility }; });
  check(!st.ready && st.h === 0 && st.vis === 'hidden', `frame stays hidden (height ${st.h}, visibility ${st.vis})`);
  check(await page.locator('#fig_Example_Variations_length').isVisible(), 'static figure still there');
  await page.close();
}

try {
  for (const w of [1280, 390]) { await testMaps(w); await testVariations(w); await testTpm(w); await testLaws(w); await testTransport(w); await testCharts(w); }
  await testTouch();
  await testBroken();
} catch (e) {
  console.log('  FAIL exception: ' + e.message.split('\n')[0]);
  failures++;
}
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
