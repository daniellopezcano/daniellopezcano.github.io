// Hand-written tool: headless-browser test of the interactive figures (assets/interactive/*.js).
//   node _port/tools/test_interactives.mjs [--shots DIR]      exit code 0 = all checks passed, 1 = failures
// Serves docs/ (render the pages first), drives each interactive at 1280 px and 390 px, asserts that it
// mounts without console errors of its own and reacts to its controls, cross-checks the numbers of the
// variations module against the closed forms of Appendix C.6, those of the tpm module against the
// transformation law of §4.1.1 (finite differences of the chart maps) and those of the laws module against the laws
// of §2.3 (components through J and J⁻¹, the pairing over 200 random bases; its place at the end of §2.3, D57), those of the
// transport module against the closed forms of Appendix C.5 (parallel transport, autoparallels, torsion, curvature, the
// coefficients in the chart Y; its place at the end of C.5, D57), those of the charts module against the charts and
// transition maps of §3.2 (Figure 3.1: p on M, X(p) and Y(p) stay linked wherever p is dragged; membership in U, V), those of
// the rotating and pointmass modules against the closed forms of C.8 (free worldlines in the inertial and co-rotating charts: ᛖ_𝒰𝒱,
// the involute, Γ_𝒴 from the transformation law; radial fall, the falling chart and the tidal acceleration), those of the lightcones
// and schwarzschild modules against Chapter 10 and C.9 (proper time, the observer's frame, the causal character of 𝒳_p; the radial
// length ∫ dr/√f and the circles of Figure C.19a), those of the fields module against C.4 (𝒳⌊f⌉, 𝒴⌊f⌉ in both charts, from the curves
// and as df⌈·⌋; finite differences of f along γ_x0, δ_r0; the drawing in pixels and its raster), those of the cotangent module
// against §4.2.1 (𝚡_i^p, 𝚢_i^p by finite differences of f in each chart, the transformation law, the pairing, the lines of
// (df)_p crossed), those of the integration module against C.7 (the two terms of the partition of unity against Gauss–Legendre,
// their sum against 2πR; the drawing in pixels), drives the ehsteps panel through Figure 10.3 (D58: steps in the caption's order,
// the viewBox on each box of figures/fig-eh-chain-rule.boxes.json plus its margin, buttons, keys, whole figure, the \ref links
// inside the inlined SVG), checks touch on a phone (D56: a swipe
// over a drawing scrolls the page, one that starts on a handle drags it, horizontal swipes rotate the 3D view),
// and checks that a module that fails to load leaves its frame hidden. --shots writes a screenshot of every frame.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const NEWTON = 'notes/diffgeo-gr/examples/example-newtonian.html';       // two panels (B27): rotating, pointmass
const GR = 'notes/diffgeo-gr/gr/index.html';                            // chapter opening page (D38)
const SCH = 'notes/diffgeo-gr/examples/example-schwarzschild.html';
// page errors that are not ours (MathJax config, being fixed elsewhere) and placeholder images
const IGNORE = [/Cannot set property Package/, /Failed to load resource/];

let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failures++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const num = s => parseFloat(String(s).replace('−', '-'));

const { server, base } = await serveDocs();
const browser = await chromium.launch();

async function open(url, width, { breakModule, touch, module } = {}) {
  const page = await browser.newPage({ viewport: { width, height: touch ? 844 : 900 }, deviceScaleFactor: 1, ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.some(r => r.test(m.text()))) errors.push(m.text()); });
  page.on('pageerror', e => { if (!IGNORE.some(r => r.test(e.message))) errors.push(e.message); });
  if (breakModule) await page.route('**/assets/interactive/' + breakModule, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export default function () { throw new Error("broken on purpose"); }' }));
  await page.goto(base + '/' + url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('dg-math-ready'), null, { timeout: 30000 });
  // bring the figure the frame follows into view (the frame itself when it closes a section, D57: what comes
  // before it can be taller than the screen), so that course.js loads the module
  // (module: the frame of that module, on a page with several panels)
  await page.evaluate(m => { const f = document.querySelector(m ? `.dg-interactive[data-module="${m}"]` : '.dg-interactive'), s = f.previousElementSibling; (s && s.matches('figure') ? s : f).scrollIntoView({ block: 'center', behavior: 'instant' }); }, module || null);
  return { page, errors };
}
const ready = (page, module) => page.waitForSelector(module ? `.dg-interactive[data-module="${module}"].dg-ready` : '.dg-interactive.dg-ready', { timeout: 20000 }).then(() => page.waitForTimeout(400));
// the mounted frame must not widen the page on a phone (D27: the page never scrolls sideways)
async function noSideScroll(page, width) {
  if (width >= 600) return;
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  check(sw <= iw, `no horizontal page scroll (scrollWidth ${sw}, innerWidth ${iw})`);
}
const shot = async (page, name, fr) => { if (shots) await (fr || page.locator('.dg-interactive')).screenshot({ path: path.join(shots, name) }); };
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

// ---- Newton–Cartan (B27): two panels in Appendix C.8, rotating (after Figure C.15) and pointmass (after Figure C.17).
// rotating: the free worldline is χ_𝒰(t) = χ(0) + t v (Γ_𝒳 = 0) with v = χ̇_𝒱(0) + ω(−χ²(0), χ¹(0)); in the co-rotating chart
// the notes' ᛖ_𝒰𝒱 (θ = ωt, b = 0) gives χ_𝒱 = (α1 cos ωt + α2 sin ωt, −α1 sin ωt + α2 cos ωt) and its derivatives; the notes'
// Γ_𝒴: Γ¹02 = −ω, Γ²01 = ω, Γ^α_00 = −ω² β_α; Coriolis 2ω(χ̇²_𝒱, −χ̇¹_𝒱), centrifugal ω²(χ¹_𝒱, χ²_𝒱).
function rotExpect(st) {
  const w = st.omega, t = st.t, [p1, p2] = st.p0, v = [st.w0[0] - w * p2, st.w0[1] + w * p1];
  const a = [p1 + t * v[0], p2 + t * v[1]], c = Math.cos(w * t), s = Math.sin(w * t);
  const b = [a[0] * c + a[1] * s, -a[0] * s + a[1] * c], bd = [v[0] * c + v[1] * s + w * b[1], -v[0] * s + v[1] * c - w * b[0]];
  const cor = [2 * w * bd[1], -2 * w * bd[0]], cen = [w * w * b[0], w * w * b[1]];
  return { xu: a, vu: v, au: [0, 0], g0: [0, -w, w, 0], g00: [-w * w * b[0], -w * w * b[1]], xv: b, ev: b, vv: bd, av: [cor[0] + cen[0], cor[1] + cen[1]], cor, cen };
}
// the notes' χ of C.8.2 (χ(0) = (r0, 0), at rest in the co-rotating chart): the involute and its derivatives
const involute = (r0, w, t) => { const c = Math.cos(w * t), s = Math.sin(w * t), u = w * t;
  return { x: [r0 * c + r0 * u * s, -r0 * s + r0 * u * c], v: [r0 * w * u * c, -r0 * w * u * s], a: [r0 * w * w * (c - u * s), -r0 * w * w * (s + u * c)] }; };
const ROT_ORDER = ['xu', 'vu', 'au', 'g0', 'g00', 'xv', 'ev', 'vv', 'av', 'cor', 'cen'];

async function placedAfter(fr, figId) {
  return fr.evaluate((f, id) => { const s = f.previousElementSibling; return { after: !!s && s.matches('figure') && s.id === id, h: f.getBoundingClientRect().height }; }, figId);
}

async function testRotating(width) {
  console.log(`rotating @ ${width}px`);
  const { page, errors } = await open(NEWTON, width, { module: 'rotating' });
  await ready(page, 'rotating');
  const fr = page.locator('.dg-interactive[data-module="rotating"]');
  const pl = await placedAfter(fr, 'fig_Example_Newtonian_Rotating');
  check(pl.after, 'panel right after Figure C.15 (fig_Example_Newtonian_Rotating)');
  if (width >= 1000) check(pl.h <= 850, `panel height ${Math.round(pl.h)} px <= 850 px`);
  const state = async () => JSON.parse(await fr.locator('.dg-nc').getAttribute('data-state'));
  const svgs = fr.locator('.dg-nc svg.dg-plot-svg');
  async function numbers(what) {
    const st = await state(), e = rotExpect(st);
    const ms = await fr.locator('.dg-nc .dg-mat').evaluateAll(ms => ms.map(m => [...m.children].map(c => c.textContent)));
    const err = Math.max(...ROT_ORDER.map((k, i) => ms[i].length === e[k].length ? Math.max(...ms[i].map((x, j) => Math.abs(num(x) - e[k][j]))) : Infinity));
    let inv = 0;
    if (st.p0[1] === 0 && st.p0[0] > 0 && st.w0[0] === 0 && st.w0[1] === 0) {         // the notes' χ: their closed forms
      const n = involute(st.p0[0], st.omega, st.t), w = [[5, n.x], [7, n.v], [8, n.a]];
      inv = Math.max(...w.flatMap(([i, v]) => ms[i].map((x, j) => Math.abs(num(x) - v[j]))));
    }
    const text = await fr.locator('.dg-interactive-body').textContent();
    check(err <= 5.1e-4 && inv <= 5.1e-4 && !/NaN|Infinity/.test(text),
      `${what} (χ(0) = (${st.p0.map(v => v.toFixed(3))}), χ̇_𝒱(0) = (${st.w0.map(v => v.toFixed(3))}), ω = ${st.omega}, t = ${st.t}): χ_𝒱 (${ms[5]}), χ̈_𝒱 (${ms[8]}); max deviation from ᛖ_𝒰𝒱 and the notes' Γ_𝒴 ${err.toExponential(1)}${inv ? `, from the notes' involute ${inv.toExponential(1)}` : ''}`);
    return st;
  }
  await shot(page, `rotating-${width}.png`, fr);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  check(await fr.locator('.dg-slider .dg-ctl-label mjx-container').count() === 2, 'slider labels typeset');
  const tops = await fr.locator('.dg-nc .dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? tops[1] > tops[0] + 200 : Math.abs(tops[1] - tops[0]) < 2, width < 700 ? '(𝒱, 𝒴) below (𝒰, 𝒳)' : 'the two charts side by side');
  const st0 = await numbers('start');
  check(JSON.stringify(st0) === JSON.stringify({ p0: [1, 0], w0: [0, 0], omega: 1, t: 1.5 }), 'starts with the notes\' χ (r0 = 1, at rest in the co-rotating chart), ω = 1, t = 1.5');
  // keyboard: ω and t
  await fr.locator('.dg-nc-omega input').focus(); await page.keyboard.press('ArrowRight');
  const s1 = await numbers('ArrowRight on ω');
  check(near(s1.omega, 1.05, 1e-9) && s1.w0[0] === 0 && s1.w0[1] === 0, `ω = ${s1.omega}, still at rest in 𝒴 at t = 0`);
  await fr.locator('.dg-slider').nth(1).locator('input').focus(); await page.keyboard.press('End');
  const s2 = await numbers('End on t');
  check(s2.t === 2.5, `t = ${s2.t}`);
  await page.keyboard.press('Home'); await numbers('Home on t');
  await page.keyboard.press('PageUp'); await numbers('PageUp on t');
  // mouse: the tip of v (inertial chart), then χ(0) in the co-rotating chart
  let [x, y] = await center(svgs.nth(0).locator('[data-key="v"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 30, y + 20, { steps: 5 }); await page.mouse.up();
  const s3 = await numbers('after dragging the tip of v');
  check(Math.hypot(...s3.w0) > 0.2, `v changed: χ̇_𝒱(0) = (${s3.w0.map(v => v.toFixed(3))})`);
  [x, y] = await center(svgs.nth(1).locator('[data-key="p0"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 40, y - 30, { steps: 5 }); await page.mouse.up();
  const s4 = await numbers('after dragging χ(0) in (𝒱, 𝒴)');
  check(s4.p0[0] < 0.9 && s4.p0[1] > 0.1 && JSON.stringify(s4.w0) === JSON.stringify(s3.w0), `χ(0) moved to (${s4.p0.map(v => v.toFixed(3))}), χ̇_𝒱(0) kept`);
  const pos = await svgs.evaluateAll(ss => ss.map(s => { const h = s.querySelector('[data-key="p0"]'); return [+h.getAttribute('cx'), +h.getAttribute('cy')]; }));
  check(Math.hypot(pos[0][0] - pos[1][0], pos[0][1] - pos[1][1]) < 0.5, 'χ(0) at the same place in both charts (θ(0) = 0)');
  await svgs.nth(0).locator('[data-key="p0"]').focus(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  const s5 = await numbers('ArrowUp x2 on χ(0)');
  check(s5.p0[1] > s4.p0[1] + 0.05, `ArrowUp moves χ(0) up (${s4.p0[1].toFixed(3)} -> ${s5.p0[1].toFixed(3)})`);
  // far away: |χ(0)| and |v| stop at their limits
  [x, y] = await center(svgs.nth(0).locator('[data-key="v"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 600, y - 400, { steps: 6 }); await page.mouse.up();
  const s6 = await numbers('after dragging v far away');
  const v6 = [s6.w0[0] - s6.omega * s6.p0[1], s6.w0[1] + s6.omega * s6.p0[0]];
  check(Math.hypot(...v6) <= 2 + 1e-9, `|v| = ${Math.hypot(...v6).toFixed(3)} <= 2`);
  await shot(page, `rotating-moved-${width}.png`, fr);
  await panelFoot(page, fr, 'fig_Example_Newtonian_Rotating', 'Figure C.15', null);
  check(JSON.stringify(await state()) === JSON.stringify(st0), 'Reset -> the starting state again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await rotatingCrossChecks(page);
  await page.close();
}

async function rotatingCrossChecks(page) {
  console.log('rotating: the module against ᛖ_𝒰𝒱, the notes\' involute and the transformation law (random states)');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/rotating.js');
    let seed = 11; const rnd = (a, b) => a + (b - a) * ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const free = [], inv = [], G = [];
    for (let n = 0; n < 200; n++) {
      const st = { p0: [rnd(-2, 2), rnd(-2, 2)], w0: [rnd(-1.5, 1.5), rnd(-1.5, 1.5)], omega: rnd(0.1, 2) }, t = rnd(0, 2.5);
      free.push({ st, t, x: m.inertial(st, t), y: m.corotating(st, t), tr: m.terms(st.omega, [0.3, -0.7], [1.1, 0.4]) });
    }
    for (let n = 0; n < 100; n++) {
      const st = { p0: [rnd(0.3, 2.2), 0], w0: [0, 0], omega: rnd(0.1, 2) }, t = rnd(0, 2.5), y = m.corotating(st, t), tr = m.terms(st.omega, [y[0], y[1]], [y[2], y[3]]);
      inv.push({ st, t, y, a: [tr.cor[0] + tr.cen[0], tr.cor[1] + tr.cen[1]] });
    }
    for (let n = 0; n < 100; n++) { const w = rnd(0.1, 2), b = [rnd(-2, 2), rnd(-2, 2)], t = rnd(0, 2.5); G.push({ w, b, t, g: m.Gamma(w, b, t) }); }
    return { free, inv, G, START: m.START };
  });
  check(JSON.stringify(r.START) === JSON.stringify({ p0: [1, 0], w0: [0, 0], omega: 1, t: 1.5 }), 'starting state as in the test');
  let wf = 0, wt = 0;
  for (const { st, t, x, y, tr } of r.free) {
    const e = rotExpect({ ...st, t });
    wf = Math.max(wf, ...[0, 1].flatMap(i => [Math.abs(x[i] - e.xu[i]), Math.abs(x[2 + i] - e.vu[i]), Math.abs(y[i] - e.xv[i]), Math.abs(y[2 + i] - e.vv[i])]));
    const w = st.omega;
    wt = Math.max(wt, Math.abs(tr.cor[0] - 2 * w * 0.4), Math.abs(tr.cor[1] + 2 * w * 1.1), Math.abs(tr.cen[0] - w * w * 0.3), Math.abs(tr.cen[1] + w * w * 0.7));
  }
  check(wf < 1e-6, `free worldlines: χ_𝒰 is the straight line, χ_𝒱 (RK4 of Newton II in 𝒴) = ᛖ_𝒰𝒱(χ_𝒰) and χ̇_𝒱 = its derivative, max difference ${wf.toExponential(2)} (200 random states)`);
  check(wt < 1e-12, `Coriolis 2ω(χ̇², −χ̇¹) and centrifugal ω²(χ¹, χ²) as in the notes: max difference ${wt.toExponential(2)}`);
  let wi = 0;
  for (const { st, t, y, a } of r.inv) {
    const n = involute(st.p0[0], st.omega, t);
    wi = Math.max(wi, ...[0, 1].flatMap(i => [Math.abs(y[i] - n.x[i]), Math.abs(y[2 + i] - n.v[i]), Math.abs(a[i] - n.a[i])]));
  }
  check(wi < 1e-6, `the notes' χ (χ(0) = (r0, 0), at rest in 𝒴): χ_𝒱, χ̇_𝒱, χ̈_𝒱 vs the notes' involute and its derivatives, max difference ${wi.toExponential(2)} (100 random r0, ω, t)`);
  // Γ_𝒴 from the transition map ᛖ_𝒱𝒰 (η = (t, β1, β2) -> ξ = (t, α1, α2)) by the transformation law (inhomogeneous term, Γ_𝒳 = 0)
  let wg = 0;
  for (const { w, b, t, g } of r.G) {
    const X = ([s, b1, b2]) => [s, b1 * Math.cos(w * s) - b2 * Math.sin(w * s), b1 * Math.sin(w * s) + b2 * Math.cos(w * s)];
    const h = 1e-4, eta = [t, b[0], b[1]], E = k => [0, 1, 2].map(i => (i === k ? 1 : 0));
    const sh = (v, k, c) => v.map((x, i) => x + c * E(k)[i]);
    const J = [0, 1, 2].map(s => [0, 1, 2].map(j => (X(sh(eta, j, h))[s] - X(sh(eta, j, -h))[s]) / (2 * h)));     // ∂X^s/∂Y^j
    const D2 = (s, j, k) => (X(sh(sh(eta, j, h), k, h))[s] - X(sh(sh(eta, j, h), k, -h))[s] - X(sh(sh(eta, j, -h), k, h))[s] + X(sh(sh(eta, j, -h), k, -h))[s]) / (4 * h * h);
    const det = J[0][0] * (J[1][1] * J[2][2] - J[1][2] * J[2][1]) - J[0][1] * (J[1][0] * J[2][2] - J[1][2] * J[2][0]) + J[0][2] * (J[1][0] * J[2][1] - J[1][1] * J[2][0]);
    const cof = (i, j) => { const r = [0, 1, 2].filter(x => x !== i), c = [0, 1, 2].filter(x => x !== j); return J[r[0]][c[0]] * J[r[1]][c[1]] - J[r[0]][c[1]] * J[r[1]][c[0]]; };
    const Ji = [0, 1, 2].map(i => [0, 1, 2].map(s => ((i + s) % 2 ? -1 : 1) * cof(s, i) / det));                  // ∂Y^i/∂X^s
    const Gm = (i, j, k) => [0, 1, 2].reduce((a, s) => a + Ji[i][s] * D2(s, k, j), 0);
    const want = (i, j, k) => i === 0 ? 0 : j === 0 && k === 0 ? g.G00[i - 1] : j === 0 ? g.G0[i - 1][k - 1] : k === 0 ? g.G0[i - 1][j - 1] : 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) wg = Math.max(wg, Math.abs(Gm(i, j, k) - want(i, j, k)));
  }
  check(wg < 1e-6, `Γ_𝒴 of the module = ∂𝒴^i/∂𝒳^s ∂²𝒳^s/∂𝒴^k∂𝒴^j of the notes' transition map (θ = ωt, b = 0), all 27 components, max difference ${wg.toExponential(2)} (100 random points)`);
}

// pointmass: units r0 = ω = 1, GM = 1. The notes' closed form for ζ released from rest at 2 r0 is inverted by bisection; for
// a body released from rest at R it is the same formula with r0 = R/2 and ω = (GM/r0³)^½ (Kepler's law, the notes' setup
// with other constants; used only in the test). Other starts: ṙ²/2 − GM/r is constant along the notes' r̈ = −GM/r².
const pmT = (r, R) => { const r0 = R / 2, w = Math.sqrt(1 / r0 ** 3), x = r / R; return 2 / w * (Math.sqrt(x * (1 - x)) + Math.acos(Math.sqrt(x))); };
const pmR = (t, R) => { let a = 0, b = R; for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (pmT(m, R) > Math.abs(t)) a = m; else b = m; } return (a + b) / 2; };
const pmRd = (t, R) => { const r = pmR(t, R), r0 = R / 2, w = Math.sqrt(1 / r0 ** 3), x = r / R; return -Math.sign(t) * w * r0 * Math.sqrt((1 - x) / x); };
const pmGY = ([b1, b2], r) => { const a = [b1 + r, b2], n = Math.hypot(...a); return [a[0] / n ** 3 - 1 / (r * r), a[1] / n ** 3]; };
// our own RK4 of the notes' Newton II in 𝒳 (α̈ = −GM α/|α|³), steps of at most 2e−3 (shorter near the source), for the numbers shown
function pmFree(a0, v0, t) {
  const f = q => { const n = Math.hypot(q[0], q[1]) ** 3; return [q[2], q[3], -q[0] / n, -q[1] / n]; }, add = (q, k, c) => q.map((x, j) => x + c * k[j]);
  let s = [...a0, ...v0], T = 0;
  while (T !== t) {
    let h = (t < 0 ? -1 : 1) * Math.min(2e-3, 5e-3 * Math.hypot(s[0], s[1]) ** 1.5);
    if (Math.abs(t - T) <= Math.abs(h)) { h = t - T; T = t; } else T += h;
    const k1 = f(s), k2 = f(add(s, k1, h / 2)), k3 = f(add(s, k2, h / 2)), k4 = f(add(s, k3, h));
    s = s.map((x, j) => x + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
  }
  return s;
}
function pmExpect(st) {
  const z = pmFree([st.R, 0], [st.u, 0], st.t), r = z[0], k = 1 / r ** 3;
  const ps = [0, 3].map(j => { const ph = 2 * Math.PI * j / 12, q = pmFree([st.R + 0.1 * Math.cos(ph), 0.1 * Math.sin(ph)], [st.u, 0], st.t); return [q[0] - r, q[1]]; });
  return { vals: [r, z[2], -1 / r ** 2, r / 2, pmT(r, 2), 2 / r - 1, k],
    ms: [[0, 0], [-2 * k, 0, 0, 0, k, 0, 0, 0, k], ...ps.flatMap(b => [b, pmGY(b, r).map(g => -g), [2 * k * b[0], -k * b[1]]])] };
}

async function testPointmass(width) {
  console.log(`pointmass @ ${width}px`);
  const { page, errors } = await open(NEWTON, width, { module: 'pointmass' });
  await ready(page, 'pointmass');
  const fr = page.locator('.dg-interactive[data-module="pointmass"]');
  const pl = await placedAfter(fr, 'fig_Example_Newtonian_Tidal');
  check(pl.after, 'panel right after Figure C.17 (fig_Example_Newtonian_Tidal)');
  if (width >= 1000) check(pl.h <= 850, `panel height ${Math.round(pl.h)} px <= 850 px`);
  const state = async () => JSON.parse(await fr.locator('.dg-nc').getAttribute('data-state'));
  const svgT = fr.locator('.dg-nc svg.dg-plot-svg').nth(0);
  async function numbers(what) {
    const st = await state(), e = pmExpect(st), isNotes = st.R === 2 && st.u === 0;
    const vals = (await fr.locator('.dg-nc-val').allTextContents()).map(num), shown = await fr.locator('.dg-nc-val').evaluateAll(vs => vs.map(v => !!v.offsetParent));
    const ms = (await fr.locator('.dg-nc .dg-mat').evaluateAll(ms => ms.map(m => [...m.children].map(c => c.textContent)))).map(m => m.map(num));
    const d = (a, b, tol) => Math.abs(a - b) / tol;                                            // <= 1 when within tol
    const ok = [0, 1, 2, 6].map(i => d(vals[i], e.vals[i], 5.1e-4));
    if (isNotes) ok.push(...[3, 4, 5].map(i => d(vals[i], e.vals[i], 5.1e-4)), d(vals[4], Math.abs(st.t), 5.1e-4), d(vals[5], vals[1] ** 2, 2e-3));
    if (st.u === 0) ok.push(d(e.vals[0], pmR(st.t, st.R), 1e-6));                             // the notes' closed form (rescaled for R != 2r0)
    ok.push(...ms.flatMap((m, i) => m.map((v, j) => d(v, e.ms[i][j], i < 2 ? 5.1e-4 : 6e-5))));
    const formsOk = shown.slice(3, 6).every(s => s === isNotes);
    const err = Math.max(...ok), text = await fr.locator('.dg-interactive-body').textContent();
    check(err <= 1 && formsOk && !/NaN|Infinity/.test(text),
      `${what} (R = ${st.R}, ṙ(0) = ${st.u}, t = ${st.t}, range ${st.range}): r = ${vals[0]}, ṙ = ${vals[1]}, GM/r³ = ${vals[6]}${isNotes ? `, t(r) = ${vals[4]}` : ''}; tide (${ms[3]}) vs (${ms[4]}), (${ms[6]}) vs (${ms[7]}); largest deviation / tolerance ${err.toFixed(2)} (tolerance 5.1e−4 for 3 decimals, 6e−5 for 4)`);
    return st;
  }
  await shot(page, `pointmass-${width}.png`, fr);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  const tops = await fr.locator('.dg-nc .dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? tops[1] > tops[0] + 150 : Math.abs(tops[1] - tops[0]) < 2, width < 700 ? 'falling chart below the (t, r) diagram' : 'the two drawings side by side');
  const st0 = await numbers('start');
  check(st0.R === 2 && st0.u === 0 && st0.t === 1.5, 'starts with the notes\' ζ (released from rest at 2r0), t = 1.5');
  check(st0.range[0] < -2.8 && st0.range[1] > 2.8 && st0.range[1] < Math.PI, `t from ${st0.range[0]} to ${st0.range[1]} (ζ reaches the source at ±π/ω)`);
  const sl = fr.locator('.dg-slider input');
  await sl.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const s1 = await numbers('ArrowRight x2 on t');
  check(near(s1.t, 1.52, 1e-9), `t = ${s1.t}`);
  await page.keyboard.press('End'); const s2 = await numbers('End on t (the last event before the source)');
  check(s2.t === s2.range[1], `t at the end of its range (${s2.t})`);
  await page.keyboard.press('Home'); await numbers('Home on t (rising, t < 0)');
  await page.keyboard.press('PageUp'); await numbers('PageUp on t');
  // mouse: ζ(0) down, then the tip of ζ̇(0) up
  let [x, y] = await center(svgT.locator('[data-key="z0"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 30, { steps: 5 }); await page.mouse.up();
  const s3 = await numbers('after dragging ζ(0) down');
  check(s3.R < 1.8 && s3.u === 0, `R = ${s3.R}`);
  [x, y] = await center(svgT.locator('[data-key="zv"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 25, { steps: 5 }); await page.mouse.up();
  const s4 = await numbers('after dragging the tip of ζ̇(0) up');
  check(s4.u > 0.2, `ṙ(0) = ${s4.u}`);
  await svgT.locator('[data-key="z0"]').focus(); await page.keyboard.press('ArrowUp');
  const s5 = await numbers('ArrowUp on ζ(0)');
  check(near(s5.R, s4.R + 0.05, 1e-9), `R ${s4.R} -> ${s5.R}`);
  await sl.focus(); await page.keyboard.press('End'); await numbers('End on t after the changes');
  await page.keyboard.press('Home'); await numbers('Home on t after the changes');
  // the extremes: ζ(0) as low and as fast inwards as allowed
  [x, y] = await center(svgT.locator('[data-key="z0"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 400, { steps: 6 }); await page.mouse.up();
  [x, y] = await center(svgT.locator('[data-key="zv"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + 400, { steps: 6 }); await page.mouse.up();
  const s6 = await numbers('ζ(0) at the lowest start, falling as fast as allowed');
  check(s6.R === 1 && s6.u === -1, `R = ${s6.R}, ṙ(0) = ${s6.u}`);
  await sl.focus(); await page.keyboard.press('End'); await numbers('End on t there');
  await shot(page, `pointmass-moved-${width}.png`, fr);
  await panelFoot(page, fr, 'fig_Example_Newtonian_Tidal', 'Figure C.17', null);
  const sR = await state();
  check(sR.R === 2 && sR.u === 0 && sR.t === 1.5, 'Reset -> the starting state again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await pointmassCrossChecks(page);
  await page.close();
}

async function pointmassCrossChecks(page) {
  console.log('pointmass: the module against the notes\' closed forms of C.8.3 (random states)');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/pointmass.js');
    let seed = 5; const rnd = (a, b) => a + (b - a) * ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const fall = [], gen = [], fns = [], rg = [];
    for (let n = 0; n < 150; n++) { const R = n < 30 ? 2 : rnd(1, 2.4), t = rnd(-1, 1) * Math.PI * (R / 2) ** 1.5 * 0.93; fall.push({ R, t, s: m.free([R, 0], [0, 0], t) }); }
    for (let n = 0; n < 60; n++) {
      const st = { R: rnd(1, 2.4), u: rnd(-1, 1) }, [lo, hi] = m.range(st), t = rnd(lo, hi), a = m.at(st, t);
      gen.push({ st, t, a, z: m.free([st.R, 0], [st.u, 0], t) });
      rg.push({ st, lo, hi, inside: [lo, hi].map(s => !!m.at(st, s)), past: [lo - 0.02, hi + 0.02].map(s => { try { m.at(st, s); return true; } catch (e) { return false; } }) });
    }
    for (let n = 0; n < 100; n++) { const a = [rnd(-2, 2), rnd(-2, 2)], r = rnd(0.5, 2.4), b = [rnd(-0.3, 0.3), rnd(-0.3, 0.3)];
      if (Math.hypot(...a) < 0.5) continue; fns.push({ a, gx: m.GammaX(a), Rm: m.Riem([a[0], a[1], 0]), r, gy0: m.GammaY([0, 0], r), Rb: m.Riem([r, 0, 0]), dgy: [0, 1].map(k => { const e = [0, 0]; e[k] = 1e-5; const P = m.GammaY(e, r), M = m.GammaY(e.map(c => -c), r); return [0, 1].map(i => (P[i] - M[i]) / 2e-5); }) }); }
    return { fall, gen, fns, rg, START: m.START, tOfR: [0.3, 0.9, 1.5, 1.99].map(r => m.tOfR(r)) };
  });
  check(JSON.stringify(r.START) === JSON.stringify({ R: 2, u: 0, t: 1.5 }), 'starting state as in the test');
  check(Math.max(...[0.3, 0.9, 1.5, 1.99].map((x, i) => Math.abs(r.tOfR[i] - pmT(x, 2)))) < 1e-15, 'the module\'s t(r) is the notes\' formula');
  let wf = 0, wn = 0;
  for (const { R, t, s } of r.fall) {
    const d = Math.max(Math.abs(s[0] - pmR(t, R)), pmR(t, R) > 0.05 * R ? Math.abs(s[2] - pmRd(t, R)) : 0, Math.abs(s[1]), Math.abs(s[3]));
    if (R === 2) wn = Math.max(wn, d); else wf = Math.max(wf, d);
  }
  check(wn < 1e-6, `ζ released from rest at 2r0: r(t) and ṙ(t) (RK4) vs the notes' t(r) = (2/ω)(√(x(1 − x)) + arccos √x) and ṙ = −ωr0 √((1 − x)/x), mirrored for t < 0, max difference ${wn.toExponential(2)} (30 random t)`);
  check(wf < 1e-6, `released from rest at other R: the same closed form with r0 = R/2, ω² = GM/r0³, max difference ${wf.toExponential(2)} (120 random R, t)`);
  let we = 0, wa = 0;
  for (const { st, t, a, z } of r.gen) {
    we = Math.max(we, Math.abs((z[2] ** 2 / 2 - 1 / z[0]) - (st.u ** 2 / 2 - 1 / st.R)), Math.abs(a.r - z[0]), Math.abs(a.rdd + 1 / z[0] ** 2));
    wa = Math.max(wa, ...a.gy0.map(Math.abs), ...a.ps.flatMap((b, k) => { const g = pmGY(b, a.r); return [Math.abs(a.acc[k][0] + g[0]), Math.abs(a.acc[k][1] + g[1]), Math.abs(a.tidal[k][0] - 2 * b[0] / a.r ** 3), Math.abs(a.tidal[k][1] + b[1] / a.r ** 3)]; }),
      Math.abs(a.k - 1 / a.r ** 3), Math.abs(a.k - 1 / (8 * (a.r / 2) ** 3)));
  }
  check(we < 1e-6, `any start: r̈ = −GM/r² and ṙ²/2 − GM/r constant along ζ, max difference ${we.toExponential(2)} (60 random R, ṙ(0), t)`);
  check(wa < 1e-12, `(Γ_𝒴)^α_00(t, 0) = 0, β̈ = −(Γ_𝒴)^α_00(t, β) = −GM(β + b)/|β + b|³ + (GM/r², 0) and −Riem β = (2GMβ1/r³, −GMβ2/r³) for every particle of the ring, GM/r³ = ω²/(8x³): max difference ${wa.toExponential(2)}`);
  let wr = 0;
  for (const { st, t, a } of r.gen) {
    const z = pmFree([st.R, 0], [st.u, 0], t);
    a.ps.forEach((b, k) => { const ph = 2 * Math.PI * k / 12, q = pmFree([st.R + 0.1 * Math.cos(ph), 0.1 * Math.sin(ph)], [st.u, 0], t); wr = Math.max(wr, Math.abs(b[0] - (q[0] - z[0])), Math.abs(b[1] - q[1])); });
  }
  check(wr < 1e-6, `the ring in the falling chart, β = α − b(t): the module against our own RK4 of the notes' Newton II, max difference ${wr.toExponential(2)} (60 random states, 12 particles each)`);
  check(r.rg.every(x => x.inside.every(Boolean) && (x.hi > 3.55 || !x.past[1]) && (x.lo < -3.55 || !x.past[0])), 'the t range ends where the first particle (or ζ) comes within RMIN of the source: inside it every position exists, just past it one does not');
  let wg = 0;
  for (const { a, gx, Rm, r: rr, gy0, Rb, dgy } of r.fns) {
    const Phi = q => -1 / Math.hypot(...q), h = 1e-4, e = k => [0, 1].map(i => (i === k ? h : 0)), add = (p, q, c = 1) => p.map((x, i) => x + c * q[i]);
    const dP = [0, 1].map(k => (Phi(add(a, e(k))) - Phi(add(a, e(k), -1))) / (2 * h));
    // second derivatives: central differences with steps 1e−3 and 2e−3, Richardson-extrapolated (error O(h⁴))
    const hess = (i, k, q) => { const E = j => [0, 1].map(l => (l === j ? q : 0));
      return (Phi(add(add(a, E(i)), E(k))) - Phi(add(add(a, E(i)), E(k), -1)) - Phi(add(add(a, E(i), -1), E(k))) + Phi(add(add(a, E(i), -1), E(k), -1))) / (4 * q * q); };
    const H = [0, 1].map(i => [0, 1].map(k => (4 * hess(i, k, 1e-3) - hess(i, k, 2e-3)) / 3));
    wg = Math.max(wg, ...[0, 1].map(i => Math.abs(gx[i] - dP[i])), ...[0, 1].flatMap(i => [0, 1].map(k => Math.abs(Rm[i][k] - H[i][k]))), ...gy0.map(Math.abs),
      ...[0, 1].flatMap(i => [0, 1].map(k => Math.abs(dgy[k][i] - Rb[i][k]))), Math.abs(Rm[2][2] - 1 / Math.hypot(...a) ** 3), Math.abs(Rb[0][0] + 2 / rr ** 3));
  }
  check(wg < 1e-6, `(Γ_𝒳)^σ_00 = ∂σΦ and Riem^σ_0κ0 = ∂κ∂σΦ for Φ = −GM/|α| (finite differences), ∂κ(Γ_𝒴)^α_00(t, 0) = Riem^α_0κ0(ζ(t)) = GM/r³ diag(−2, 1, 1): max difference ${wg.toExponential(2)} (100 random points)`);
}

// ---- lightcones (Figure 10.1, B28): closed forms of Chapter 10, written here independently of the module. (η_ij) = diag(1, −1)
// in the chart α = (α⁰, α¹); γ⁰_𝒰(λ) = λ and γ¹_𝒰 the cubic Hermite curve through the five points (Catmull–Rom tangents, the
// module's construction); τ = ∫ √(1 − (γ̇¹_𝒰)²) dλ by Gauss–Legendre (20 nodes on 64 pieces per unit of λ); a straight
// worldline of speed u has the closed form τ = (λ2 − λ1) √(1 − u²); the observer's frame e_0 = (1, u)/s, e_1 = (u, 1)/s
// (s = √(1 − u²)), ε⁰(𝒳) = g(e_0, 𝒳), ε¹(𝒳) = −g(e_1, 𝒳).
const GL20 = (() => {                                                   // nodes and weights of Gauss–Legendre, 20 points (Newton on P_20)
  const n = 20, xs = [], ws = [];
  for (let i = 1; i <= n; i++) {
    let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), dp = 0;
    for (let it = 0; it < 100; it++) { let p0 = 1, p1 = x; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } dp = n * (x * p1 - p0) / (x * x - 1); const dx = p1 / dp; x -= dx; if (Math.abs(dx) < 1e-16) break; }
    xs.push(x); ws.push(2 / ((1 - x * x) * dp * dp));
  }
  return { xs, ws };
})();
const gl = (f, a, b, pieces) => { let s = 0; for (let j = 0; j < pieces; j++) { const lo = a + (b - a) * j / pieces, hi = a + (b - a) * (j + 1) / pieces, m = (lo + hi) / 2, h = (hi - lo) / 2;
  GL20.xs.forEach((x, i) => { s += GL20.ws[i] * h * f(m + h * x); }); } return s; };
function lcCurve(c, l) {
  const m = c.map((_, k) => k === 0 ? c[1] - c[0] : k === 4 ? c[4] - c[3] : (c[k + 1] - c[k - 1]) / 2), k = Math.min(3, Math.max(0, Math.floor(l))), s = l - k;
  const H = [2 * s ** 3 - 3 * s * s + 1, s ** 3 - 2 * s * s + s, -2 * s ** 3 + 3 * s * s, s ** 3 - s * s], dH = [6 * s * s - 6 * s, 3 * s * s - 4 * s + 1, -6 * s * s + 6 * s, 3 * s * s - 2 * s];
  const q = [c[k], m[k], c[k + 1], m[k + 1]];
  return [H.reduce((a, h, i) => a + h * q[i], 0), dH.reduce((a, h, i) => a + h * q[i], 0)];
}
function lcTau(c, l1, l2) {                                              // split at the points, where the integrand is smooth
  const cuts = [l1, ...[1, 2, 3].filter(k => k > l1 && k < l2), l2];
  let t = 0; for (let i = 0; i + 1 < cuts.length; i++) t += gl(l => Math.sqrt(1 - lcCurve(c, l)[1] ** 2), cuts[i], cuts[i + 1], Math.max(1, Math.ceil(64 * (cuts[i + 1] - cuts[i]))));
  return t;
}
const lcMaxSpeed = c => { let w = 0; for (let i = 0; i <= 8000; i++) w = Math.max(w, Math.abs(lcCurve(c, 4 * i / 8000)[1])); return w; };
function lcExpect(st) {
  const [, u] = lcCurve(st.c, st.l3), s = Math.sqrt(1 - u * u), e0 = [1 / s, u / s], e1 = [u / s, 1 / s], X = st.X, Q = X[0] ** 2 - X[1] ** 2;
  const eps = [(X[0] - u * X[1]) / s, (X[1] - u * X[0]) / s];
  const kind = (Q > 0 ? 'timelike' : Q === 0 ? 'lightlike' : 'spacelike') + (Q < 0 ? '' : X[0] > 0 ? ', future directed' : ', past directed');
  return { vals: [lcTau(st.c, st.l1, st.l2), st.l2 - st.l1, u, s, Q, X[0], eps[0] ** 2 - eps[1] ** 2], ms: [e0, e1, [1, 0, 0, -1], X, eps], kind };
}

// lightcones: the drawing in pixels (equal scales): every cone edge and both lines of the cone at p are null (|Δx| = |Δy| within
// 1 px), future halves blue above their apex, past halves grey below; e_0 and e_1 at p mirror each other across the null line
// (swapped |Δx|, |Δy|) and are η-orthogonal (Δy0 Δy1 − Δx0 Δx1 ≈ 0); the tip of 𝒳_p lies inside / on / outside the cone at p
// exactly when the status says timelike / lightlike / spacelike, above p when future directed
async function lcGeometry(fr, what) {
  const g = await fr.locator('.dg-lc svg.dg-plot-svg').evaluate(svg => {
    const nums = d => d.match(/-?\d+(\.\d+)?/g).map(Number);
    const cones = [...svg.querySelectorAll('path[fill="#bdc9ed"], path[fill="#d9d9d9"]')].map(e => ({ fut: e.getAttribute('fill') === '#bdc9ed', v: nums(e.getAttribute('d')) }));
    const nulls = [...svg.querySelectorAll('path.dg-lc-null')].map(e => nums(e.getAttribute('d')));
    const arrows = [...svg.querySelectorAll('g.dg-arrow')].map(a => { const [hit, shaft, head] = a.children; const h = nums(hit.getAttribute('d')), t = nums(head.getAttribute('d'));
      return { color: shaft.getAttribute('stroke'), from: [h[0], h[1]], to: [t[0], t[1]] }; });
    return { cones, nulls, arrows };
  });
  const X = g.arrows.find(a => a.color === '#d68b02'), p = X.from, at = c => g.arrows.find(a => a.color === c && Math.hypot(a.from[0] - p[0], a.from[1] - p[1]) < 0.5);
  const e0 = at('#d60202'), e1 = at('#222222'), d = a => [a.to[0] - a.from[0], a.to[1] - a.from[1]];
  let worst = 0, sides = true;
  for (const { fut, v } of g.cones) for (const k of [2, 4]) { const dx = v[k] - v[0], dy = v[k + 1] - v[1]; worst = Math.max(worst, Math.abs(Math.abs(dx) - Math.abs(dy))); sides = sides && (fut ? dy < 0 : dy > 0); }
  for (const v of g.nulls) worst = Math.max(worst, Math.abs(Math.abs(v[2] - v[0]) - Math.abs(v[3] - v[1])));
  const [a0, b0] = d(e0), [a1, b1] = d(e1), [ax, bx] = d(X);
  const mirror = Math.max(Math.abs(Math.abs(a0) - Math.abs(b1)), Math.abs(Math.abs(b0) - Math.abs(a1))), orth = Math.abs(b0 * b1 - a0 * a1) / (Math.hypot(a0, b0) * Math.hypot(a1, b1));
  const kind = await fr.locator('.dg-gr-status').textContent(), gap = Math.abs(bx) - Math.abs(ax);
  const seen = gap > 1 ? 'timelike' : gap < -1 ? 'spacelike' : 'lightlike', dir = kind.includes('future') ? bx < 0 : kind.includes('past') ? bx > 0 : true;
  check(g.cones.length === 6 && g.nulls.length === 2 && worst <= 1 && sides && mirror <= 1 && orth < 0.01 && kind.startsWith(seen) && dir,
    `${what}: ${g.cones.length} cone halves and 2 null lines at 45° in pixels (largest ||Δx| − |Δy|| ${worst.toFixed(2)} px), future up / past down; e_0 (${a0.toFixed(1)}, ${b0.toFixed(1)}) and e_1 (${a1.toFixed(1)}, ${b1.toFixed(1)}) px mirror each other (${mirror.toFixed(2)} px), η-orthogonal (${orth.toExponential(1)}); 𝒳_p (${ax.toFixed(1)}, ${bx.toFixed(1)}) px is drawn ${seen}, status "${kind}"`);
}

async function testLightcones(width) {
  console.log(`lightcones @ ${width}px`);
  const { page, errors } = await open(GR, width, { module: 'lightcones' });
  await ready(page, 'lightcones');
  const fr = page.locator('.dg-interactive[data-module="lightcones"]');
  const pl = await placedAfter(fr, 'fig_light_cones');
  check(pl.after, 'panel right after Figure 10.1 (fig_light_cones), on the chapter opening page');
  if (width >= 1000) check(pl.h <= 850, `panel height ${Math.round(pl.h)} px <= 850 px`);
  const wd = await page.evaluate(() => [document.querySelector('.dg-interactive[data-module="lightcones"]').getBoundingClientRect().width, document.querySelector('#fig_light_cones').getBoundingClientRect().width]);
  check(Math.abs(wd[0] - wd[1]) < 2, `as wide as the figure it follows (${Math.round(wd[0])} px, figure ${Math.round(wd[1])} px; D38)`);
  const state = async () => JSON.parse(await fr.locator('.dg-lc').getAttribute('data-state'));
  const svg = fr.locator('.dg-lc svg.dg-plot-svg');
  async function numbers(what) {
    const st = await state(), e = lcExpect(st);
    const vals = (await fr.locator('.dg-gr-val').allTextContents()).map(num);
    const ms = (await fr.locator('.dg-lc .dg-mat').evaluateAll(ms => ms.map(m => [...m.children].map(c => c.textContent)))).map(m => m.map(num));
    const tol = [5.1e-4, 5.1e-4, 5.1e-4, 5.1e-4, 5.1e-4, 5.1e-4, 5.1e-4], mtol = [5.1e-4, 5.1e-4, 5.1e-3, 5.1e-3, 5.1e-4];
    const err = Math.max(...vals.map((v, i) => Math.abs(v - e.vals[i]) / tol[i]), ...ms.flatMap((m, i) => m.map((v, j) => Math.abs(v - e.ms[i][j]) / mtol[i])));
    const kind = await fr.locator('.dg-gr-status').textContent(), text = await fr.locator('.dg-interactive-body').textContent();
    const ms0 = lcMaxSpeed(st.c);
    check(err <= 1 && kind === e.kind && ms0 < 0.75 && st.c.every(x => Math.abs(x) <= 1.15 + 1e-12) && st.l1 < st.l2 && !/NaN|Infinity/.test(text),
      `${what} (points ${st.c.map(x => +x.toFixed(3))}, λ = ${st.l1}, ${st.l2}, ${st.l3}, 𝒳_p = (${st.X})): τ = ${vals[0]} (λ2 − λ1 = ${vals[1]}), "${kind}", η(𝒳, 𝒳) = ${vals[4]} = ${vals[6]}; max |γ̇¹| ${ms0.toFixed(3)} < 0.75; largest deviation / tolerance ${err.toFixed(2)}`);
    return st;
  }
  await shot(page, `lightcones-${width}.png`, fr);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  const tops = await fr.locator('.dg-lc .dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? tops[1] > tops[0] + 150 : Math.abs(tops[1] - tops[0]) < 2, width < 700 ? 'numbers below the drawing' : 'drawing and numbers side by side');
  const st0 = await numbers('start');
  await lcGeometry(fr, 'start');
  check(JSON.stringify(st0) === JSON.stringify({ c: [-0.2, -0.45, -0.25, 0.35, 0.55], l1: 0.4, l2: 1.9, l3: 2.5, X: [0.4, 0.8] }), 'starting state');
  // 𝒳_p with the keyboard: onto the light cone (future), across spacelike, onto it again (past), then timelike
  const tip = svg.locator('[data-key="X"]');
  await tip.focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowUp');
  let s = await numbers('ArrowUp ×8 on the tip of 𝒳_p');
  check(s.X[0] === 0.8 && s.X[1] === 0.8 && await fr.locator('.dg-gr-status').textContent() === 'lightlike, future directed', `𝒳_p = (${s.X}) is lightlike, future directed`);
  await lcGeometry(fr, 'lightlike, future directed');
  for (let i = 0; i < 32; i++) await page.keyboard.press('ArrowDown');
  s = await numbers('ArrowDown ×32');
  check(s.X[0] === -0.8 && await fr.locator('.dg-gr-status').textContent() === 'lightlike, past directed', `𝒳_p = (${s.X}) is lightlike, past directed`);
  await lcGeometry(fr, 'lightlike, past directed');
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
  s = await numbers('ArrowLeft ×10');
  check(await fr.locator('.dg-gr-status').textContent() === 'timelike, past directed', `𝒳_p = (${s.X}) is timelike, past directed`);
  await lcGeometry(fr, 'timelike, past directed');
  // mouse: the tip of 𝒳_p up and right, a point of γ far to the right (stopped where γ̇¹ would reach 0.75), λ sliders
  let [x, y] = await center(tip);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y - 70, { steps: 6 }); await page.mouse.up();
  s = await numbers('after dragging the tip of 𝒳_p');
  [x, y] = await center(svg.locator('[data-key="k2"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 400, y, { steps: 8 }); await page.mouse.up();
  s = await numbers('after dragging γ(2) far to the right');
  await lcGeometry(fr, 'after the drags (spacelike, γ at its steepest)');
  check(s.c[2] > -0.25 + 0.2 && lcMaxSpeed(s.c) > 0.74, `γ(2) moved to ${s.c[2].toFixed(3)} and stopped at the limit (max |γ̇¹| ${lcMaxSpeed(s.c).toFixed(4)})`);
  await svg.locator('[data-key="k4"]').focus(); await page.keyboard.press('ArrowLeft');
  s = await numbers('ArrowLeft on γ(4)');
  const sls = fr.locator('.dg-slider input');
  await sls.nth(0).focus(); await page.keyboard.press('End');
  s = await numbers('End on λ1 (pushes λ2)');
  check(s.l1 === 3.9 && s.l2 === 4, `λ1 = ${s.l1}, λ2 = ${s.l2}`);
  await sls.nth(1).focus(); await page.keyboard.press('Home');
  s = await numbers('Home on λ2 (pushes λ1)');
  check(s.l2 === 0.1 && s.l1 === 0, `λ1 = ${s.l1}, λ2 = ${s.l2}`);
  await page.keyboard.press('End'); await sls.nth(2).focus(); await page.keyboard.press('Home'); await numbers('End on λ2, Home on λ3');
  await page.keyboard.press('End'); await numbers('End on λ3');
  await shot(page, `lightcones-moved-${width}.png`, fr);
  await panelFoot(page, fr, 'fig_light_cones', 'Figure 10.1', null);
  check(JSON.stringify(await state()) === JSON.stringify(st0), 'Reset -> the starting state again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await lightconesCrossChecks(page);
  await page.close();
}

async function lightconesCrossChecks(page) {
  console.log('lightcones: the module against Chapter 10 (random states)');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/lightcones.js');
    let seed = 7; const rnd = (a, b) => a + (b - a) * ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const curves = [], straight = [], frames = [], moves = [];
    while (curves.length < 120) { const c = Array.from({ length: 5 }, () => rnd(-1.1, 1.1)); if (m.maxSpeed(c) >= m.VMAX) continue; const l1 = rnd(0, 3.8), l2 = rnd(l1 + 0.05, 4); curves.push({ c, l1, l2, tau: m.tau(c, l1, l2), ms: m.maxSpeed(c), at: [0.3, 1.7, 3.2].map(l => m.curve(c, l)) }); }
    for (let n = 0; n < 60; n++) { const u = rnd(-0.74, 0.74), a = rnd(-1, 1), c = [0, 1, 2, 3, 4].map(k => a + u * k), l1 = rnd(0, 3.5), l2 = rnd(l1 + 0.1, 4); straight.push({ u, l1, l2, tau: m.tau(c, l1, l2) }); }
    for (let n = 0; n < 200; n++) { const st = { c: [0, 1, 2, 3, 4].map(() => rnd(-0.3, 0.3)), l1: 0.5, l2: 1.5, l3: rnd(0.6, 3.4), X: [Math.round(rnd(-0.8, 0.8) * 100) / 100, Math.round(rnd(-1.1, 1.1) * 100) / 100] };
      if (n % 5 === 0) st.X[1] = (n % 10 ? -1 : 1) * Math.abs(st.X[0]);
      if (m.maxSpeed(st.c) < m.VMAX) frames.push({ st, a: m.at(st), fr: m.frame(m.curve(st.c, st.l3)[1]) }); }
    let c = m.START.c.slice();
    for (let n = 0; n < 300; n++) { const k = Math.floor(rnd(0, 5)), v = rnd(-2, 2); c = m.moveKnot(c, k, v); moves.push(c.slice()); }
    const snaps = [[0.4, 0.42], [0.4, -0.38], [-0.5, 0.52], [0.3, 0.6], [0.01, 0.02]].map(([a, b]) => m.setX([0.4, 0.8], a, b));
    return { curves, straight, frames, moves, snaps, VMAX: m.VMAX };
  });
  let wt = 0, wc = 0, wm = 0;
  for (const { c, l1, l2, tau, ms, at } of r.curves) {
    wt = Math.max(wt, Math.abs(tau - lcTau(c, l1, l2)));
    wc = Math.max(wc, ...[0.3, 1.7, 3.2].flatMap((l, i) => { const q = lcCurve(c, l); return [Math.abs(q[0] - at[i][0]), Math.abs(q[1] - at[i][1])]; }));
    wm = Math.max(wm, Math.abs(ms - lcMaxSpeed(c)));
  }
  check(wt < 1e-6, `τ_[λ1, λ2][γ] = ∫ √(η_ij γ̇^i γ̇^j) dλ: the module (Simpson) against Gauss–Legendre, max difference ${wt.toExponential(2)} (120 random worldlines and λ1 < λ2)`);
  check(wc < 1e-12 && wm < 1e-4, `the worldline is the cubic Hermite curve through the points (max difference ${wc.toExponential(2)}); its max |γ̇¹| (exact, from the quadratic) against dense sampling: ${wm.toExponential(2)}`);
  const ws = Math.max(...r.straight.map(({ u, l1, l2, tau }) => Math.abs(tau - (l2 - l1) * Math.sqrt(1 - u * u))));
  check(ws < 1e-9, `straight worldlines γ¹_𝒰 = a + uλ: τ = (λ2 − λ1) √(1 − u²), max difference ${ws.toExponential(2)} (60 random)`);
  let wf = 0, wk = 0, nk = { timelike: 0, lightlike: 0, spacelike: 0 };
  const g = (a, b) => a[0] * b[0] - a[1] * b[1];
  for (const { st, a, fr } of r.frames) {
    const e = lcExpect(st), [, u] = lcCurve(st.c, st.l3), s = Math.sqrt(1 - u * u), eta = [[1, 0], [0, -1]];
    // Lorentz-orthonormality (cond. 1), e_0 = v/s_γ (cond. 2 after reparametrizing by τ), ε^a(e_b) = δ^a_b, ε⁰(𝒳) = g(v, 𝒳)/s, and g(𝒳, 𝒳) = (ε⁰)² − (ε¹)²
    const epsOf = Y => [g(fr[0], Y), -g(fr[1], Y)];
    wf = Math.max(wf, ...[0, 1].flatMap(i => [0, 1].map(j => Math.abs(g(fr[i], fr[j]) - eta[i][j]))), Math.abs(fr[0][0] - 1 / s), Math.abs(fr[0][1] - u / s),
      ...[0, 1].flatMap(i => epsOf(fr[i]).map((v, j) => Math.abs(v - (i === j ? 1 : 0)))), Math.abs(a.eps[0] - g([1, u], st.X) / s), Math.abs(a.Qe - a.Q), Math.abs(a.tau - lcTau(st.c, st.l1, st.l2)));
    if (a.kind !== e.kind) wk++;
    nk[e.kind.split(',')[0]]++;
  }
  check(wf < 1e-6, `observer's frame: g(e_a, e_b) = η_ab, e_0 = v/s_γ, ε^a(e_b) = δ^a_b, ε⁰(𝒳) = g(v, 𝒳)/s_γ, (ε⁰(𝒳))² − (ε¹(𝒳))² = η_ij x^i x^j, max difference ${wf.toExponential(2)} (${r.frames.length} random states)`);
  check(wk === 0 && nk.timelike > 10 && nk.lightlike > 10 && nk.spacelike > 10, `causal character of 𝒳_p as §10.1 defines it in ${r.frames.length} random states (${nk.timelike} timelike, ${nk.lightlike} lightlike, ${nk.spacelike} spacelike): ${wk} wrong`);
  const mv = Math.max(...r.moves.map(lcMaxSpeed)), mc = Math.max(...r.moves.flat().map(Math.abs));
  check(mv < r.VMAX && mc <= 1.15 + 1e-12, `300 random drags of the points: γ stays timelike, max |γ̇¹| ${mv.toFixed(4)} < ${r.VMAX}, |γ¹| <= 1.15`);
  check(JSON.stringify(r.snaps) === JSON.stringify([[0.4, 0.4], [0.4, -0.4], [-0.5, 0.5], [0.3, 0.6], [0.4, 0.8]]), `a tip within 0.03 of the light cone snaps onto it, the zero vector is refused: ${JSON.stringify(r.snaps)}`);
}

// ---- schwarzschild (Figure C.19, B28): closed forms for C.9, written here independently of the module: the notes'
// ∫ dr/√f, f = 1 − r_S/r, has the antiderivative F(r) = √(r(r − r_S)) + r_S ln(√r + √(r − r_S)) (ours; dF/dr = 1/√f).
const schF = (r, rS) => Math.sqrt(r * (r - rS)) + rS * Math.log(Math.sqrt(r) + Math.sqrt(r - rS));
const schL = (rS, r1, r2) => schF(r2, rS) - schF(r1, rS);
const schR = (rS, D) => { let a = rS, b = rS + D; for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (schL(rS, rS, m) < D) a = m; else b = m; } return (a + b) / 2; };
function schExpect({ rS, r1, r2 }) {
  const f = r => 1 - rS / r, L = schL(rS, r1, r2);
  return [r1, f(r1), -1 / f(r1), r2, f(r2), -1 / f(r2), r2 - r1, L, L / (r2 - r1), 1 / Math.sqrt(f(r1)), schL(rS, rS, r2)];
}
const FIG_C19 = [1.087, 1.325, 1.667, 2.074, 2.525, 3.004, 3.503];      // the radii (in units of r_S) of the circles of Figure C.19a

async function testSchwarzschild(width) {
  console.log(`schwarzschild @ ${width}px`);
  const { page, errors } = await open(SCH, width, { module: 'schwarzschild' });
  await ready(page, 'schwarzschild');
  const fr = page.locator('.dg-interactive[data-module="schwarzschild"]');
  const pl = await placedAfter(fr, 'fig_Example_Schwarzschild');
  check(pl.after, 'panel right after Figure C.19 (fig_Example_Schwarzschild)');
  if (width >= 1000) check(pl.h <= 850, `panel height ${Math.round(pl.h)} px <= 850 px`);
  const state = async () => JSON.parse(await fr.locator('.dg-sch').getAttribute('data-state'));
  const svgA = fr.locator('.dg-sch svg.dg-plot-svg').nth(0);
  async function numbers(what) {
    const st = await state(), e = schExpect(st);
    const vals = (await fr.locator('.dg-gr-val').allTextContents()).map(num), text = await fr.locator('.dg-interactive-body').textContent();
    const err = Math.max(...vals.map((v, i) => Math.abs(v - e[i]) / 5.1e-4));
    // the drawing: as many blue circles as radii r_S < r <= 4 at radial distances 0.6 k from r_S, grey ones at r_S + 0.6 k
    const nb = await svgA.locator('path[stroke="#3859bd"]').count(), ng = await svgA.locator('path[stroke="#9a9a9a"][fill="none"]').count();
    let kb = 0; while (schR(st.rS, 0.6 * (kb + 1)) <= 4) kb++;
    const kg = Math.floor((4 - st.rS) / 0.6 + 1e-9);
    check(err <= 1 && nb === kb && ng === kg && st.rS < st.r1 && st.r1 < st.r2 && st.r2 <= 4 && vals[7] > vals[6] && vals[8] < vals[9] + 5.1e-4 && !/NaN|Infinity/.test(text),
      `${what} (r_S = ${st.rS}, r1 = ${st.r1}, r2 = ${st.r2}): ∫ dr/√f = ${vals[7]} > r2 − r1 = ${vals[6]}, ratio ${vals[8]} <= 1/√f(r1) = ${vals[9]}, from r_S ${vals[10]}; ${nb} blue and ${ng} grey circles (expected ${kb}, ${kg}); largest deviation / tolerance ${err.toFixed(2)}`);
    return st;
  }
  await shot(page, `schwarzschild-${width}.png`, fr);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  const tops = await fr.locator('.dg-sch .dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? tops[1] > tops[0] + 150 : Math.abs(tops[1] - tops[0]) < 2, width < 700 ? 'g plot below the slice' : 'the slice and the g plot side by side');
  const st0 = await numbers('start (Figure C.19a: r_S = 1, circles 0.6 r_S apart)');
  check(JSON.stringify(st0) === JSON.stringify({ rS: 1, r1: 1.2, r2: 2.2 }), 'starting state');
  // mouse: r1 into r_S (stops at r_S + 0.01), r2 out (stops at 4)
  let [x, y] = await center(svgA.locator('[data-key="r1"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 200, y + 120, { steps: 6 }); await page.mouse.up();
  let s = await numbers('after dragging r1 into the disc r <= r_S');
  check(s.r1 === 1.01, `r1 = ${s.r1} (r_S + 0.01)`);
  [x, y] = await center(svgA.locator('[data-key="r2"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 400, y - 230, { steps: 6 }); await page.mouse.up();
  s = await numbers('after dragging r2 out');
  check(s.r2 === 4, `r2 = ${s.r2}`);
  await svgA.locator('[data-key="r2"]').focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  s = await numbers('ArrowDown ×2 on r2'); check(Math.abs(s.r2 - 3.9) < 1e-9, `r2 = ${s.r2}`);
  await svgA.locator('[data-key="r1"]').focus(); await page.keyboard.press('ArrowUp');
  s = await numbers('ArrowUp on r1'); check(Math.abs(s.r1 - 1.06) < 1e-9, `r1 = ${s.r1}`);
  const sl = fr.locator('.dg-slider input');
  await sl.focus(); await page.keyboard.press('End');
  s = await numbers('End on r_S (r1 pushed out)');
  check(s.rS === 1.5 && s.r1 === 1.51, `r_S = ${s.rS}, r1 = ${s.r1}`);
  await page.keyboard.press('Home'); s = await numbers('Home on r_S (nearly flat)');
  check(s.rS === 0.2, `r_S = ${s.rS}`);
  await shot(page, `schwarzschild-moved-${width}.png`, fr);
  await panelFoot(page, fr, 'fig_Example_Schwarzschild', 'Figure C.19', null);
  check(JSON.stringify(await state()) === JSON.stringify(st0), 'Reset -> the starting state again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await schwarzschildCrossChecks(page);
  await page.close();
}

async function schwarzschildCrossChecks(page) {
  console.log('schwarzschild: the module against C.9 (random states)');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/schwarzschild.js');
    let seed = 11; const rnd = (a, b) => a + (b - a) * ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const d = [], rings = [], clamp = [];
    for (let n = 0; n < 300; n++) { const rS = rnd(0.2, 1.5), r1 = n % 3 ? rnd(rS, 4) : rS + rnd(0, 1e-3), r2 = rnd(r1, 4.5); d.push({ rS, r1, r2, L: m.dist(rS, r1, r2), a: m.at({ rS, r1: Math.max(r1, rS + 1e-3), r2: Math.max(r2, r1 + 2e-3) }) }); }
    for (let n = 0; n < 40; n++) { const rS = n === 0 ? 1 : rnd(0.2, 1.5); rings.push({ rS, c: m.circles(rS) }); }
    for (let n = 0; n < 200; n++) clamp.push(m.clampR({ rS: Math.round(rnd(0.2, 1.5) * 20) / 20, r1: rnd(-1, 5), r2: rnd(-1, 5) }));
    const short = [1.05, 1.3, 2, 3.5].map(r1 => ({ r1, ratio: m.dist(1, r1, r1 + 1e-4) / 1e-4 }));
    return { d, rings, clamp, short, f: [1.5, 2, 4].map(x => m.f(x, 1)) };
  });
  check(Math.max(...[1.5, 2, 4].map((x, i) => Math.abs(r.f[i] - (1 - 1 / x)))) < 1e-15, 'f(r) = 1 − r_S/r');
  let wd = 0, wa = 0;
  for (const { rS, r1, r2, L, a } of r.d) {
    wd = Math.max(wd, Math.abs(L - schL(rS, r1, r2)));
    const st = { rS, r1: Math.max(r1, rS + 1e-3), r2: Math.max(r2, Math.max(r1, rS + 1e-3) + 2e-3) }, e = schExpect(st);
    wa = Math.max(wa, Math.abs(a.f1 - e[1]), Math.abs(a.f2 - e[4]), Math.abs(a.L - e[7]), Math.abs(a.ratio - e[8]), Math.abs(a.inv1 - e[9]), Math.abs(a.LS - e[10]));
  }
  check(wd < 1e-6, `∫_{r1}^{r2} dr/√f (the module: Simpson after r = r_S + w²) against F(r2) − F(r1), max difference ${wd.toExponential(2)} (300 random r_S, r1, r2, a third with r1 within 10⁻³ of r_S)`);
  check(wa < 1e-6, `every number of the panel against the closed form, max difference ${wa.toExponential(2)}`);
  const fig = r.rings[0].c.blue, wf = Math.max(...FIG_C19.map((x, i) => Math.abs(fig[i] - x)));
  check(fig.length === 7 && wf < 6e-4, `r_S = 1: the seven blue circles are those of Figure C.19a (${fig.map(x => x.toFixed(4)).join(', ')}; the figure's 3 decimals, max difference ${wf.toExponential(2)})`);
  let wr = 0;
  for (const { rS, c } of r.rings) {
    c.blue.forEach((x, k) => { wr = Math.max(wr, Math.abs(x - schR(rS, 0.6 * (k + 1)))); });
    if (schR(rS, 0.6 * (c.blue.length + 1)) <= 4 || c.grey.some((x, k) => Math.abs(x - rS - 0.6 * (k + 1)) > 1e-12)) wr = Infinity;
  }
  check(wr < 1e-6, `circles at radial distances 0.6 k from r_S: radii against the inverse of F, max difference ${wr.toExponential(2)} (40 random r_S); grey ones at r_S + 0.6 k`);
  const crowd = r.rings.every(({ c }) => c.blue.every((x, k) => !k || k < 2 || x - c.blue[k - 1] > c.blue[k - 1] - (c.blue[k - 2] ?? 0)));
  check(crowd, 'the gaps in r between neighbouring blue circles grow outwards (they crowd towards r_S)');
  check(r.clamp.every(s => s.r1 > s.rS && s.r2 > s.r1 && s.r2 <= 4 && Math.abs(s.r1 * 100 - Math.round(s.r1 * 100)) < 1e-9), 'r_S < r1 < r2 <= 4 on a grid of 0.01 whatever is dragged (200 random)');
  const ws = Math.max(...r.short.map(({ r1, ratio }) => Math.abs(ratio * Math.sqrt(1 - 1 / r1) - 1)));
  check(ws < 1e-3, `a short segment (r2 − r1 = 10⁻⁴): the ratio to r2 − r1 is 1/√f(r1) (the notes' estimate), relative difference ${ws.toExponential(2)}`);
}

// ---- fields (Figure C.8, B29): closed forms of C.4 (example_fields.tex), written here independently of the module: f = cos a cos b + 1,
// the components of (df)_p in both charts, the component functions of 𝒳 (X^i = (0, 1), Y^i = (b/r, a/r²)) and 𝒴 (X̃^i = (−b, a),
// Ỹ^i = (0, 1)), the actions 𝒳⌊f⌉ = −cos a sin b and 𝒴⌊f⌉ = b sin a cos b − a cos a sin b; 𝒱 = ℳ \ {a <= 0, b = 0}.
const fdF = (a, b) => Math.cos(a) * Math.cos(b) + 1;
function fdExpect({ field, p: [a, b] }) {
  const r = Math.hypot(a, b), inV = !(b === 0 && a <= 0), sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
  const act = field === 'X' ? -ca * sb : b * sa * cb - a * ca * sb;
  return { inV, act, beta: inV ? [r, Math.atan2(b, a)] : null, c: field === 'X' ? [a, b] : [r, r > 0 ? Math.atan2(b, a) : null],
    A: field === 'X' ? [0, 1] : [-b, a], x: [-sa * cb, -ca * sb], B: !inV ? null : field === 'X' ? [b / r, a / (r * r)] : [0, 1],
    y: inV ? [-(a * sa * cb + b * ca * sb) / r, b * sa * cb - a * ca * sb] : null };
}
const FD = 'notes/diffgeo-gr/examples/example-fields.html';
const FD_START = { field: 'X', colour: 'f', p: [2, Math.sqrt(Math.PI ** 2 - 4)] };

// the drawing in pixels: p where (a, b) is, 𝒳_p along the field's components, the integral curve through p (a = x0 or |q| = r0),
// the raster under the frame, its colours those of the colouring at sample points away from its level sets and arrows
async function fdGeometry(fr, st, what) {
  const g = await fr.locator('.dg-fd svg.dg-plot-svg').evaluate(async svg => {
    const nums = d => d.match(/-?\d+(\.\d+)?/g).map(Number), R = e => ['x', 'y', 'width', 'height'].map(k => +e.getAttribute(k));
    const frame = R(svg.querySelector('rect.dg-frame')), im = svg.querySelector('image.dg-fd-bg'), h = svg.querySelector('[data-key="p"]');
    const Xp = svg.querySelector('g.dg-fd-Xp'), curves = [...svg.querySelectorAll('path.dg-fd-curve')].map(e => nums(e.getAttribute('d')));
    const img = new Image(); img.src = im.getAttribute('href'); await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const m = await import('/notes/diffgeo-gr/assets/interactive/fields.js'), st = JSON.parse(svg.closest('.dg-fd').dataset.state);
    const S = 14, W = cv.width, u = S / W, samples = [];
    for (let k = -6; k <= 5; k++) for (let j = -6; j <= 5; j++) for (const [oa, ob] of [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]]) {
      const a = k + oa, b = j + ob, fv = m.f(a, b), gr = Math.hypot(Math.sin(a) * Math.cos(b), Math.cos(a) * Math.sin(b));
      if (Math.min(...[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75].map(L => Math.abs(fv - L))) < 2.5 * u * gr) continue;   // on a level set (the arrows sit on the integer grid, >= 0.55 away)
      const i = Math.floor((a + 7) / u), jj = Math.floor((7 - b) / S * cv.height), px = [...ctx.getImageData(i, jj, 1, 1).data].slice(0, 3);
      samples.push({ px, want: m.cmap(st.colour, m.shade(st, a, b)) });
    }
    return { frame, image: R(im), size: [img.naturalWidth, img.naturalHeight], p: [+h.getAttribute('cx'), +h.getAttribute('cy')],
      Xp: Xp && nums(Xp.children[0].getAttribute('d')), curves, samples };
  });
  const [fx, fy, fw, fh] = g.frame, sx = a => fx + (a + 7) / 14 * fw, sy = b => fy + (7 - b) / 14 * fh, e = fdExpect(st);
  const dp = Math.hypot(g.p[0] - sx(st.p[0]), g.p[1] - sy(st.p[1]));
  let dir = 0, n = Math.hypot(...e.A);
  if (g.Xp) { const v = [g.Xp[2] - g.Xp[0], g.Xp[3] - g.Xp[1]], L = Math.hypot(...v); dir = Math.abs(v[0] * -e.A[1] - v[1] * e.A[0]) / (L * n) + (v[0] * e.A[0] - v[1] * e.A[1] > 0 ? 0 : 1); }
  let wc = 0, inside = true;
  for (const c of g.curves) for (let k = 0; k < c.length; k += 2) {
    const [x, y] = [c[k], c[k + 1]];
    wc = Math.max(wc, st.field === 'X' ? Math.abs(x - g.p[0]) : Math.abs(Math.hypot(x - sx(0), y - sy(0)) - Math.hypot(...st.p) * fw / 14));
    inside = inside && x >= fx - 0.6 && x <= fx + fw + 0.6 && y >= fy - 0.6 && y <= fy + fh + 0.6;
  }
  const wcol = Math.max(...g.samples.map(s => Math.max(...s.px.map((c, i) => Math.abs(c - s.want[i])))));
  const noArrow = n === 0;
  check(dp <= 0.6 && Math.abs(fw - fh) <= 1 && (noArrow ? !g.Xp : dir < 0.01) && (noArrow || g.curves.length >= 1) && wc <= 0.8 && inside
    && JSON.stringify(g.image) === JSON.stringify(g.frame) && g.samples.length > 150 && wcol <= 6,
    `${what}: p drawn at (a, b) (${dp.toFixed(2)} px), equal scales (${fw.toFixed(1)} × ${fh.toFixed(1)} px); ${noArrow ? 'no arrow (𝒴_p = 0)' : `${st.field === 'X' ? '𝒳' : '𝒴'}_p along its components (${dir.toExponential(1)})`}; ` +
    `integral curve ${st.field === 'X' ? 'a = x₀' : '|q| = r₀'} within ${wc.toFixed(2)} px, inside the frame; raster ${g.size.join(' × ')} on the frame, colours at ${g.samples.length} points = the colouring (max channel difference ${wcol})`);
}

async function testFields(width) {
  console.log(`fields @ ${width}px`);
  const { page, errors } = await open(FD, width, { module: 'fields' });
  await ready(page, 'fields');
  const fr = page.locator('.dg-interactive[data-module="fields"]');
  const pl = await placedAfter(fr, 'fig_Example_Fields_action');
  check(pl.after, 'panel right after Figure C.8 (fig_Example_Fields_action)');
  if (width >= 1000) check(pl.h <= 850, `panel height ${Math.round(pl.h)} px <= 850 px`);
  const state = async () => JSON.parse(await fr.locator('.dg-fd').getAttribute('data-state'));
  const svg = fr.locator('.dg-fd svg.dg-plot-svg');
  async function numbers(what) {
    const st = await state(), e = fdExpect(st);
    const shown = await fr.locator('.dg-fd-out').evaluate(o => {
      const out = {};
      for (const s of o.querySelectorAll('[data-k]')) { let h = false; for (let x = s; x && x !== o; x = x.parentElement) if (x.hidden) h = true; out[s.dataset.k] = h ? null : s.textContent; }
      out.notV = [...o.querySelectorAll('.dg-fd-tex')].filter(t => !t.hidden && /notin/.test(t.dataset.tex || '')).length;
      out.text = o.textContent; return out;
    });
    const pr = s => s.replace(/[()]/g, '').split(',').map(num);
    const want = { p: st.p, c1: [e.c[0]], c2: e.c[1] == null ? null : [e.c[1]], dcur: [e.act], A1: [e.A[0]], A2: [e.A[1]], x1: [e.x[0]], x2: [e.x[1]], vX: [e.act], df: [e.act],
      beta: e.beta, B1: e.B && [e.B[0]], B2: e.B && [e.B[1]], y1: e.y && [e.y[0]], y2: e.y && [e.y[1]], vY: e.inV ? [e.act] : null };
    let err = 0, vis = true;
    for (const [k, w] of Object.entries(want)) {
      if (w == null) { vis = vis && shown[k] == null; continue; }
      if (shown[k] == null) { vis = false; continue; }
      pr(shown[k]).forEach((x, i) => { err = Math.max(err, Math.abs(x - w[i]) / 5.1e-4); });
    }
    check(err <= 1 && vis && shown.notV === (e.inV ? 0 : 2) && !/NaN|Infinity|undefined/.test(shown.text),
      `${what} (${st.field === 'X' ? '𝒳' : '𝒴'}, p = (${st.p.map(x => x.toFixed(3))})): ${st.field === 'X' ? '𝒳' : '𝒴'}⌊f⌉(p) = ${shown.dcur} from the curve, ${shown.vX} in (𝒰, 𝒳), ${e.inV ? shown.vY + ' in (𝒱, 𝒴)' : 'p ∉ 𝒱 shown'}, df⌈·⌋(p) = ${shown.df}; largest deviation / tolerance ${err.toFixed(2)}`);
    return { st, shown };
  }
  await shot(page, `fields-${width}.png`, fr);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  const tops = await fr.locator('.dg-fd .dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? tops[1] > tops[0] + 150 : Math.abs(tops[1] - tops[0]) < 2, width < 700 ? 'numbers below the drawing' : 'the drawing and the numbers side by side');
  const { st: st0 } = await numbers('start (the point p = (2, √(π² − 4)) of Figure C.6)');
  check(JSON.stringify(st0) === JSON.stringify(FD_START), 'starting state');
  await fdGeometry(fr, st0, 'start');
  // 𝒴 at the same point: the caption of Figure C.6 gives v_δ,p(f) ≈ −1.11
  await fr.locator('.dg-choice label').nth(1).click(); await page.waitForTimeout(300);
  let { st, shown } = await numbers('𝒴 chosen');
  check(st.field === 'Y' && Math.abs(num(shown.dcur) + 1.11) < 0.005, `𝒴⌊f⌉(p) = ${shown.dcur} ≈ −1.11 (v_δ,p(f) in the caption of Figure C.6)`);
  await fdGeometry(fr, st, '𝒴, coloured by f');
  await fr.locator('.dg-toggle input').check(); await page.waitForTimeout(400);
  st = await state();
  const cb = (await fr.locator('.dg-fd-cbar').textContent()).replace(/\s+/g, ' ');
  check(st.colour === 'act' && /−6\.5/.test(cb) && /6\.5/.test(cb) && await fr.locator('.dg-toggle input').getAttribute('aria-label') === '𝒴⌊f⌉', `colouring by 𝒴⌊f⌉ (colour bar "${cb.trim()}", switch named 𝒴⌊f⌉)`);
  await fdGeometry(fr, st, '𝒴, coloured by 𝒴⌊f⌉');
  // mouse: p to (−3, 4)
  let [x, y] = await center(svg.locator('[data-key="p"]'));
  let fb = await svg.locator('rect.dg-frame').boundingBox();
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(fb.x + (4 / 14) * fb.width, fb.y + (3 / 14) * fb.height, { steps: 6 }); await page.mouse.up();
  ({ st } = await numbers('after dragging p to about (−3, 4)'));
  check(Math.abs(st.p[0] + 3) < 0.08 && Math.abs(st.p[1] - 4) < 0.08, `p = (${st.p.map(v => v.toFixed(3))})`);
  await fdGeometry(fr, st, 'after the drag');
  // keys: down onto the branch cut (p ∉ 𝒱), right onto the origin (𝒴_p = 0), right again (off the cut)
  const hp = svg.locator('[data-key="p"]');
  await hp.focus();
  for (let k = 0; k < 60 && (await state()).p[1] !== 0; k++) await page.keyboard.press('ArrowDown');
  ({ st } = await numbers('ArrowDown onto the branch cut {a <= 0, b = 0}'));
  check(st.p[1] === 0 && st.p[0] < 0, `p = (${st.p}) on the cut: p ∉ 𝒱`);
  for (let k = 0; k < 60 && (await state()).p[0] !== 0; k++) await page.keyboard.press('ArrowRight');
  ({ st } = await numbers('ArrowRight onto the origin'));
  check(JSON.stringify(st.p) === '[0,0]', `p = (${st.p}): 𝒴_p = 0, λ₀ not shown`);
  await fdGeometry(fr, st, 'origin');
  await page.keyboard.press('ArrowRight');
  ({ st } = await numbers('ArrowRight off the origin'));
  check(JSON.stringify(st.p) === '[0.1,0]', `p = (${st.p}) in 𝒱 again`);
  await fr.locator('.dg-choice label').nth(0).click(); await page.waitForTimeout(300);
  ({ st } = await numbers('𝒳 at (0.1, 0)'));
  await fdGeometry(fr, st, '𝒳, coloured by 𝒳⌊f⌉');
  await shot(page, `fields-moved-${width}.png`, fr);
  await panelFoot(page, fr, 'fig_Example_Fields_action', 'Figure C.8', 'notebooks/exercises_and_example_figures/exercise_C3.ipynb');
  check(JSON.stringify(await state()) === JSON.stringify(FD_START), 'Reset -> the starting state again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await fieldsCrossChecks(page);
  await page.close();
}

async function fieldsCrossChecks(page) {
  console.log('fields: the module against C.4 (random points, both fields)');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/fields.js');
    let seed = 29; const rnd = (a, b) => a + (b - a) * ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const f = (a, b) => Math.cos(a) * Math.cos(b) + 1, Y = ([a, b]) => [Math.hypot(a, b), Math.atan2(b, a)];
    const d5 = (g, l, h) => (g(l - 2 * h) - 8 * g(l - h) + 8 * g(l + h) - g(l + 2 * h)) / (12 * h);   // 5-point central difference
    const out = [], places = [];
    for (let n = 0; n < 2000; n++) {
      const field = n % 2 ? 'Y' : 'X', k = n % 50;
      const p = k === 0 ? [0, 0] : k === 1 ? [-rnd(0, 7), 0] : k === 2 ? [rnd(0, 7), 0] : k === 3 ? [rnd(-1e-6, 1e-6), rnd(-1e-6, 1e-6)] : [rnd(-7, 7), rnd(-7, 7)];
      const st = { field, colour: 'f', p }, a = m.at(st), c = m.curveAt(field, p), l0 = c.l0 ?? 0, h = 1e-3;
      const q0 = c.at(l0), fd = d5(l => f(...c.at(l)), l0, h), vel = [0, 1].map(i => d5(l => c.at(l)[i], l0, h));
      let velY = null;
      if (a.inV && Math.abs(Y(c.at(l0 + 2 * h))[1] - Y(c.at(l0 - 2 * h))[1]) < 1) velY = [0, 1].map(i => d5(l => Y(c.at(l))[i], l0, h));
      out.push({ st, a, q0, fd, vel, velY, sh: m.shade(st, ...p), act: m.action(field, ...p) });
    }
    for (let n = 0; n < 500; n++) { const q = [rnd(-8, 8), n % 3 ? rnd(-8, 8) : rnd(-0.2, 0.2)]; places.push({ q, d: m.place(q), k: m.place(q, m.SNAPKEY) }); }
    return { out, places, ends: [m.cmap('f', 0), m.cmap('f', 1), m.cmap('act', 0), m.cmap('act', 1), m.cmap('f', 0.5), m.cmap('act', 0.5)] };
  });
  let wc = 0, wfd = 0, wv = 0, wlaw = 0, wq = 0, nY = 0, finite = true;
  const J = ([a, b]) => { const r = Math.hypot(a, b); return [[a / r, b / r], [-b / (r * r), a / (r * r)]]; };          // (ᛞ_VU)^i_j, C.4.2
  for (const { st, a, q0, fd, vel, velY, sh, act } of r.out) {
    const e = fdExpect(st), [pa, pb] = st.p;
    const vals = [a.vCurve, a.vX, a.vDf, ...a.A, ...a.x, act];
    finite = finite && vals.every(Number.isFinite) && (a.inV ? [a.vY, ...a.B, ...a.y, ...a.beta].every(Number.isFinite) : a.vY === null && a.B === null && a.y === null && a.beta === null);
    const diffs = [a.vCurve - e.act, a.vX - e.act, a.vDf - e.act, act - e.act, a.A[0] - e.A[0], a.A[1] - e.A[1], a.x[0] - e.x[0], a.x[1] - e.x[1], sh - fdF(pa, pb) / 2];
    if (a.inV) { diffs.push(a.vY - e.act, a.B[0] - e.B[0], a.B[1] - e.B[1], a.y[0] - e.y[0], a.y[1] - e.y[1], a.beta[0] - e.beta[0], a.beta[1] - e.beta[1]); nY++; }
    wc = Math.max(wc, ...diffs.map(Math.abs));
    wq = Math.max(wq, Math.hypot(q0[0] - pa, q0[1] - pb));
    wfd = Math.max(wfd, Math.abs(fd - e.act));
    wv = Math.max(wv, Math.abs(vel[0] - e.A[0]), Math.abs(vel[1] - e.A[1]));
    if (velY) wv = Math.max(wv, ...[0, 1].map(i => Math.abs(velY[i] - e.B[i]) / Math.max(1, Math.abs(e.B[i]))));
    if (a.inV) {                                                       // the transformation laws of C.4.2 / C.4.7
      const j = J(st.p), r = Math.hypot(pa, pb);
      wlaw = Math.max(wlaw, ...[0, 1].map(i => Math.abs(a.B[i] - (j[i][0] * a.A[0] + j[i][1] * a.A[1]))),
        Math.abs(a.y[0] - (pa / r * a.x[0] + pb / r * a.x[1])), Math.abs(a.y[1] - (-pb * a.x[0] + pa * a.x[1])));
    }
  }
  check(finite, `no NaN or ∞ anywhere (2000 points, among them the origin, points of the branch cut and points within 10⁻⁶ of the origin); outside 𝒱 nothing of (𝒱, 𝒴) is computed`);
  check(wc < 1e-9, `every number against the closed forms of C.4 (both fields; ${nY} points in 𝒱), max difference ${wc.toExponential(2)}`);
  check(wq < 1e-12, `the curve of the family passes through p at λ₀ (γ_{x₀}(b), δ_{r₀}(atan2(b, a))): max distance ${wq.toExponential(2)}`);
  check(wfd < 1e-6, `𝒳⌊f⌉(p), 𝒴⌊f⌉(p) against finite differences of f along γ_{x₀}, δ_{r₀} (5 points, h = 10⁻³): max difference ${wfd.toExponential(2)}`);
  check(wv < 1e-6, `the components X^i, Y^i (X̃^i, Ỹ^i) against finite differences of the charts along the curve: max difference (relative where a component exceeds 1) ${wv.toExponential(2)}`);
  check(wlaw < 1e-9, `Y^i = (ᛞ_VU)^i_j X^i and 𝚢_j = (∂𝒳^i/∂𝒴^j) 𝚡_i (C.4.2, C.4.7): max difference ${wlaw.toExponential(2)}`);
  const okPlace = r.places.every(({ q, d, k }) => [d, k].every((s, i) => {
    const sn = i ? 0.05 : 0.12, x = Math.max(-6.9, Math.min(6.9, q[0])), y = Math.max(-6.9, Math.min(6.9, q[1]));
    const onCut = Math.abs(y) <= sn && x <= sn, origin = onCut && Math.abs(x) <= sn;
    return !Object.is(s[1], -0) && !Object.is(s[0], -0) && s[1] === (onCut ? 0 : y) && s[0] === (origin ? 0 : x);
  }));
  check(okPlace, 'p stays in the drawing and snaps onto the branch cut (within 0.12 on a drag, 0.05 by keys) and the origin; never −0 (500 random)');
  const [f0, f1, a0, a1, fm, am] = r.ends;
  check(f0[0] > f0[2] && f1[2] > f1[0] && a0[2] > a0[0] && a1[0] > a1[2] && Math.min(...fm, ...am) > 240,
    'colours as in Figures C.6/C.8: f low red, high blue (RdBu); the action negative blue, positive red (red: the field climbs f), white at the middle');
}

// ---- cotangent (Figure 4.3, §4.2.1): the notebook's f and the charts of eggs.js, written here independently of the module.
// 𝚡_i^p and 𝚢_i^p from their definition in each chart, ∂_i[f ∘ X⁻¹](X(p)) and ∂_i[f ∘ Y⁻¹](Y(p)), by central differences; the
// lines of the stack of (df)_p crossed by 𝒳_p: trunc((df)_p(𝒳_p)/0.25), and in pixels on the drawing
const COT = 'notes/diffgeo-gr/tangent-spaces/cotangent-space.html', COT_STEP = 0.25, COT_START = { p: [Math.PI / 4, -Math.PI / 8], u: [0, 1] };
const cotF = ([x, y]) => (Math.cos(x + y) / 2 + Math.sin(x - y + Math.PI / 2) / 2 + 1) * Math.exp(-(x * x + y * y) / (2 * Math.PI * Math.PI)) * 2 * Math.sqrt(x * x + y * y + 2);
const cotD = (g, q, h = 1e-5) => [0, 1].map(i => { const a = q.slice(), b = q.slice(); a[i] += h; b[i] -= h; return (g(a) - g(b)) / (2 * h); });
function cotExpect({ p, u }) {
  const x = cotD(cotF, p), Yp = tpmY(p), y = cotD(q => cotF(chYinv(q)), Yp), J = tpmJ(p), d = J[0][0] * J[1][1] - J[0][1] * J[1][0];
  const K = [[J[1][1] / d, -J[0][1] / d], [-J[1][0] / d, J[0][0] / d]], vy = [J[0][0] * u[0] + J[0][1] * u[1], J[1][0] * u[0] + J[1][1] * u[1]];
  const f0 = cotF(p), pair = x[0] * u[0] + x[1] * u[1];
  return { x, y, K, vy, f0, Yp, pair, lin: Math.trunc(pair / COT_STEP) };
}

async function testCotangent(width) {
  console.log(`cotangent @ ${width}px`);
  const { page, errors } = await open(COT, width, { module: 'cotangent' });
  await ready(page, 'cotangent');
  const fr = page.locator('.dg-interactive[data-module="cotangent"]');
  const pl = await placedAfter(fr, 'fig_TstarpM');
  check(pl.after, 'panel right after Figure 4.3 (fig_TstarpM)');
  if (width >= 1000) check(pl.h <= 900, `panel height ${Math.round(pl.h)} px <= 900 px`);
  const state = async () => JSON.parse(await fr.locator('.dg-cot').getAttribute('data-state'));
  const panel = k => fr.locator('.dg-cot .dg-panel').nth(k);
  // every number on the panel against cotExpect at the module's exact state (display: 3 decimals; counts exact)
  async function numbers(what) {
    const st = await state(), e = cotExpect(st);
    const sh = await fr.evaluate(f => ({
      mats: [...f.querySelectorAll('.dg-mat')].map(m => [...m.children].map(c => parseFloat(c.textContent.replace('−', '-')))),
      ro: [...f.querySelectorAll('.dg-readout-value')].map(r => r.textContent),
      k: Object.fromEntries([...f.querySelectorAll('[data-k]')].map(s => [s.dataset.k, s.textContent])),
      text: f.querySelector('.dg-interactive-body').textContent }));
    const [mx, my, mx2, mK, mx3, mu, my3, mv] = sh.mats;
    const pairs = sh.ro.map(t => (t.match(/[−-]?\d+\.\d+/g) || []).map(num));
    const want = [[mx, e.x], [my, e.y], [mx2, e.x], [mK, e.K.flat()], [mx3, e.x], [mu, st.u], [my3, e.y], [mv, e.vy], [pairs[0], st.p], [pairs[1], e.Yp], [pairs[2], [e.f0]],
      [[num(sh.k.pairX), num(sh.k.pairY)], [e.pair, e.pair]], [[num(sh.k.rX), num(sh.k.rY)], [e.pair / COT_STEP, e.pair / COT_STEP]]];
    const err = Math.max(...want.flatMap(([a, b]) => b.map((v, k) => Math.abs(a[k] - v))));
    const counts = [sh.k.kX, sh.k.kY].map(num);
    const ok = err <= 5.1e-4 && counts[0] === e.lin && counts[1] === e.lin && !('nX' in sh.k) && !/NaN|Infinity|undefined/.test(sh.text) && tpmIn(st.p);
    check(ok, `${what} (p = (${st.p.map(v => v.toFixed(3))}), x^i_p = (${st.u.map(v => v.toFixed(3))})): 𝚡 (${mx}), 𝚢 (${my}), (df)_p(𝒳_p) = ${sh.k.pairX} = ${sh.k.pairY}; lines of (df)_p crossed ${counts[0]} in (𝒰, 𝒳), ${counts[1]} in (𝒱, 𝒴) (expected trunc((df)_p(𝒳_p)/0.25) = ${e.lin}); max deviation ${err.toExponential(1)}`);
    return { st, e };
  }
  // the drawing in pixels: the thick line through p is orthogonal to the covector's components (equal scales), the arrow goes from p
  // along the vector's components, the lines of the stack are parallel to it, and the arrow crosses |trunc((df)_p(𝒳_p)/0.25)| of them
  // (segment intersections in pixels; the line through p, where the arrow starts, not counted); no dots for level sets of f
  async function geometry(what) {
    const st = await state(), e = cotExpect(st);
    const g = await fr.evaluate(f => [...f.querySelectorAll('.dg-cot .dg-panel svg')].map(svg => {
      const nums = d => d.match(/-?\d+(\.\d+)?/g).map(Number), h = svg.querySelector('[data-key="p"]'), t = svg.querySelector('[data-key="tip"]');
      return { ker: nums(svg.querySelector('.dg-cot-ker').getAttribute('d')), p: [+h.getAttribute('cx'), +h.getAttribute('cy')], tip: [+t.getAttribute('cx'), +t.getAttribute('cy')],
        dots: svg.querySelectorAll('.dg-cot-dot').length, stack: [...svg.querySelectorAll('.dg-cot-stack')].map(l => nums(l.getAttribute('d'))) };
    }));
    let ok = true; const msg = [];
    g.forEach((c, k) => {
      const comp = k ? e.y : e.x, v = k ? e.vy : st.u, kd = [c.ker[2] - c.ker[0], -(c.ker[3] - c.ker[1])], ad = [c.tip[0] - c.p[0], -(c.tip[1] - c.p[1])];
      const cos = Math.abs(kd[0] * comp[0] + kd[1] * comp[1]) / (Math.hypot(...kd) * Math.hypot(...comp));
      const sin = Math.abs(ad[0] * v[1] - ad[1] * v[0]) / (Math.hypot(...ad) * Math.hypot(...v)), same = ad[0] * v[0] + ad[1] * v[1] > 0;
      const cross = (a, b, q, r) => { const o = (u, v, w) => Math.sign((v[0] - u[0]) * (w[1] - u[1]) - (v[1] - u[1]) * (w[0] - u[0])); return o(a, b, q) * o(a, b, r) < 0 && o(q, r, a) * o(q, r, b) < 0; };
      const hit = c.stack.filter(l => cross(c.p, c.tip, [l[0], l[1]], [l[2], l[3]])).length;
      const par = Math.max(0, ...c.stack.filter(l => Math.hypot(l[2] - l[0], l[3] - l[1]) >= 20).map(l => { const d = [l[2] - l[0], l[3] - l[1]], kk = [c.ker[2] - c.ker[0], c.ker[3] - c.ker[1]]; return Math.abs(d[0] * kk[1] - d[1] * kk[0]) / (Math.hypot(...d) * Math.hypot(...kk)); }));
      const okk = cos < 0.01 && sin < 0.01 && same && par < 0.01 && hit === Math.abs(e.lin) && c.dots === 0 && c.stack.length > 0;
      ok = ok && okk; msg.push(`${k ? '(𝒱, 𝒴)' : '(𝒰, 𝒳)'}: cos(line of (df)_p, components) ${cos.toFixed(4)}, sin(arrow, components) ${sin.toFixed(4)}, ${c.stack.length} lines of the stack (those of 20 px or more parallel within ${par.toExponential(1)}), the arrow crosses ${hit} (expected ${Math.abs(e.lin)}), ${c.dots} dots`);
    });
    check(ok, `${what}: ${msg.join('; ')}`);
  }
  await shot(page, `cotangent-${width}.png`, fr);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  const tops = await fr.locator('.dg-cot .dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? tops[1] > tops[0] + 50 : Math.abs(tops[1] - tops[0]) < 2, width < 700 ? 'chart panels stacked' : 'chart panels side by side');
  const { st: st0 } = await numbers('start');
  check(JSON.stringify(st0) === JSON.stringify(COT_START), 'starts at the notebook: p = (π/4, −π/8), γ vertical with x^i_p = (0, 1)');
  await geometry('start');
  // drag p in the X panel
  let [x, y] = await center(panel(0).locator('[data-key="p"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 30, y - 25, { steps: 5 }); await page.mouse.up();
  const { st: st1 } = await numbers('after dragging p in (𝒰, 𝒳)');
  check(st1.p[0] < st0.p[0] - 0.05 && st1.p[1] > st0.p[1] + 0.05, `p moved to (${st1.p.map(v => v.toFixed(3))})`);
  // drag p far outside U ∩ V in the Y panel: it stops on the boundary
  [x, y] = await center(panel(1).locator('[data-key="p"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 400, y + 300, { steps: 6 }); await page.mouse.up();
  const { st: st2 } = await numbers('after dragging p out of 𝒰 ∩ 𝒱 in (𝒱, 𝒴)');
  check(Math.hypot(st2.p[0] - st1.p[0], st2.p[1] - st1.p[1]) > 0.05, 'p moved and stays in 𝒰 ∩ 𝒱');
  // drag the tip of 𝒳_p in the Y panel
  [x, y] = await center(panel(1).locator('[data-key="tip"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 20, y + 25, { steps: 5 }); await page.mouse.up();
  const { st: st3 } = await numbers('after dragging the tip of 𝒳_p in (𝒱, 𝒴)');
  check(Math.hypot(st3.u[0] - st2.u[0], st3.u[1] - st2.u[1]) > 0.05, `x^i_p changed to (${st3.u.map(v => v.toFixed(3))})`);
  await geometry('after the drags');
  // keyboard: arrow keys on the handles of the X panel
  await panel(0).locator('[data-key="tip"]').focus(); await page.keyboard.press('ArrowLeft');
  const { st: st4 } = await numbers('ArrowLeft on the tip in (𝒰, 𝒳)');
  check(st4.u[0] < st3.u[0] - 0.01 && near(st4.u[1], st3.u[1], 0.02), 'ArrowLeft moves the tip to the left');
  await panel(0).locator('[data-key="p"]').focus(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  const { st: st5 } = await numbers('ArrowUp ×2 on p in (𝒰, 𝒳)');
  check(st5.p[1] > st4.p[1] + 0.01 || !tpmIn([st5.p[0], st5.p[1] + 0.05]), 'ArrowUp moves p up (or p is on the boundary)');
  // a long 𝒳_p along the gradient: the tip dragged far out stops at |x_p| = 1.25
  [x, y] = await center(panel(0).locator('[data-key="tip"]'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 300, y + 60, { steps: 6 }); await page.mouse.up();
  const { st: st6 } = await numbers('a long 𝒳_p');
  check(near(Math.hypot(...st6.u), 1.25, 1e-9), `|x^i_p| clamped at 1.25 (${Math.hypot(...st6.u).toFixed(6)})`);
  await geometry('a long 𝒳_p');
  await shot(page, `cotangent-moved-${width}.png`, fr);
  await panelFoot(page, fr, 'fig_TstarpM', 'Figure 4.3', '2_4_TstarpM.ipynb');
  check(JSON.stringify(await state()) === JSON.stringify(COT_START), 'Reset -> the starting state again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await cotangentCrossChecks(page);
  await page.close();
}

async function cotangentCrossChecks(page) {
  console.log('cotangent: the module against §4.2.1 (200 random p in 𝒰 ∩ 𝒱 and vectors)');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/cotangent.js');
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pts = [];
    while (pts.length < 200) { const p = [-0.8 + 1.9 * rnd(), -0.7 + 1.6 * rnd()]; if (m.inUV(p)) { const a = 2 * Math.PI * rnd(), n = 0.25 + rnd(); pts.push([p, [n * Math.cos(a), n * Math.sin(a)]]); } }
    return pts.map(([p, u]) => {
      const a = m.at(p, u);
      return { p, u, a, f: m.f(p), STEP: m.STEP };
    });
  });
  let wx = 0, wy = 0, wlaw = 0, wpair = 0, wf = 0, wv = 0, nbad = 0, finite = true;
  for (const q of r) {
    const e = cotExpect(q), J = tpmJ(q.p);
    finite = finite && [q.a.f, ...q.a.x, ...q.a.y, ...q.a.vy, q.a.pairX, q.a.pairY, ...q.a.K.flat()].every(Number.isFinite);
    wx = Math.max(wx, ...q.a.x.map((v, k) => Math.abs(v - e.x[k])));
    wy = Math.max(wy, ...q.a.y.map((v, k) => Math.abs(v - e.y[k])));
    wlaw = Math.max(wlaw, ...[0, 1].map(j => Math.abs(q.a.y[j] - (e.K[0][j] * q.a.x[0] + e.K[1][j] * q.a.x[1]))));
    wv = Math.max(wv, ...[0, 1].map(i => Math.abs(q.a.vy[i] - (J[i][0] * q.u[0] + J[i][1] * q.u[1]))));
    wpair = Math.max(wpair, Math.abs(q.a.pairX - q.a.pairY), Math.abs(q.a.pairX - (q.a.x[0] * q.u[0] + q.a.x[1] * q.u[1])));
    wf = Math.max(wf, Math.abs(q.f - cotF(q.p)), Math.abs(q.a.f - cotF(q.p)));
    if (Math.trunc(q.a.pairX / COT_STEP) !== e.lin || Math.trunc(q.a.pairY / COT_STEP) !== e.lin) nbad++;
  }
  check(finite && r[0].STEP === COT_STEP, 'no NaN or ∞; spacing 0.25 in the values of f');
  check(wf < 1e-12, `f against the notebook's scalar_field_f (height of M × 2√(x² + y² + 2)): ${wf.toExponential(1)}`);
  check(wx < 1e-6, `𝚡_i^p = ∂_i[f ∘ 𝒳⁻¹](𝒳(p)) against central differences: max difference ${wx.toExponential(2)}`);
  check(wy < 1e-6, `𝚢_i^p against central differences of f ∘ 𝒴⁻¹ at 𝒴(p) (the definition in (𝒱, 𝒴)): max difference ${wy.toExponential(2)}`);
  check(wlaw < 1e-9, `𝚢_j^p = (∂𝒳^i/∂𝒴^j)_p 𝚡_i^p (§4.2.1; the inverse of the polar Jacobian written in the test): max difference ${wlaw.toExponential(2)}`);
  check(wv < 1e-9, `y^i_p = (∂𝒴^i/∂𝒳^j)_p x^j_p: max difference ${wv.toExponential(2)}`);
  check(wpair < 1e-9, `the pairing 𝚡_i^p x^i_p = 𝚢_i^p y^i_p: max difference ${wpair.toExponential(2)}`);
  check(nbad === 0, `lines of (df)_p crossed, trunc((df)_p(𝒳_p)/0.25) from either chart's pairing, against the test's: ${nbad} of 200 differ`);
}

// ---- integration (Figure 8.1, B31): the circle of C.7 (example_integration.tex), written here independently of the module:
// ᚹ₁(p) = χ(a/R), ᚹ₂ = 1 − ᚹ₁, the two terms ∫_0^{2π} dα R χ(cos α) and ∫_{−π}^{π} dβ R (1 − χ(cos β)) (Gauss–Legendre on the whole
// interval, no splitting at the transition), their sum and the notes' closed form 2πR. χ is the panel's smooth step (its choice
// within C.7's conditions): 1 for s <= s1, 0 for s >= s2, 1 − ψ(t)/(ψ(t) + ψ(1 − t)) in between, t = (s − s1)/(s2 − s1), ψ(t) = e^{−1/t}.
const IG = 'notes/diffgeo-gr/integrals/index.html';
const IG_START = { R: 1, s1: -0.5, s2: 0.5, th: 100 };
const igChi = (s, s1, s2) => { const t = (s - s1) / (s2 - s1); if (t <= 0) return 1; if (t >= 1) return 0; const a = Math.exp(-1 / t), b = Math.exp(-1 / (1 - t)); return b / (a + b); };
const igTerms = ({ R, s1, s2 }, pieces = 1500) => ({
  I1: gl(a => R * igChi(Math.cos(a), s1, s2), 0, 2 * Math.PI, pieces),
  I2: gl(b => R * (1 - igChi(Math.cos(b), s1, s2)), -Math.PI, Math.PI, pieces) });
function igExpect(st) {
  const t = igTerms(st), th = st.th * Math.PI / 180, w1 = igChi(Math.cos(th), st.s1, st.s2);
  const m = ((st.th % 360) + 360) % 360;
  return { r1: w1, r2: 1 - w1, a: m === 0 ? null : m * Math.PI / 180, b: m === 180 ? null : (m < 180 ? m : m - 360) * Math.PI / 180,
    I1: t.I1, I2: t.I2, J1: t.I1, J2: t.I2, sum: t.I1 + t.I2, closed: 2 * Math.PI * st.R };
}
// the drawing, in pixels: p on the circle at its angle (the centre and R from the two open circles at (±R, 0)); the colour of ℳ at
// 12 angles is the mix of blue_1 and green_1 in the proportion ᚹ₂ (green channel; ᚹ₂ within ±3° of the angle); in each chart the solid area (this chart's term)
// is the fraction term/(2πR) of the two areas together (the rectangle of height R); the bar at 𝒳(p), 𝒴(p) is split at ᚹ₁(p) : ᚹ₂(p)
async function igGeometry(fr, st, what) {
  const r = await fr.evaluate((f, st) => {
    const svgs = [...f.querySelectorAll('.dg-ig svg.dg-plot-svg')], M = svgs[0];
    M.scrollIntoView({ block: 'center', behavior: 'instant' });                // elementsFromPoint only sees the viewport
    const box = M.getBoundingClientRect();
    const opens = [...M.querySelectorAll('circle')].filter(c => c.getAttribute('fill') === '#fff').map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
    const c = [(opens[0][0] + opens[1][0]) / 2, (opens[0][1] + opens[1][1]) / 2], Rpx = Math.abs(opens[0][0] - opens[1][0]) / 2;
    const h = M.querySelector('[data-key="p"]'), hp = [+h.getAttribute('cx') - c[0], +h.getAttribute('cy') - c[1]];
    const cols = [];
    for (let k = 0; k < 12; k++) {
      const t = (k * 30 + 7) * Math.PI / 180, x = box.left + c[0] + Rpx * Math.cos(t), y = box.top + c[1] - Rpx * Math.sin(t);
      const e = document.elementsFromPoint(x, y).find(e => e.tagName === 'path' && e.getAttribute('stroke-width') === '5');
      cols.push([t, e ? e.getAttribute('stroke') : null]);
    }
    const pts = d => d.slice(1, -1).split(/[LM]/).map(q => q.trim().split(/\s+/).map(Number));
    const area = d => { const p = pts(d); let s = 0; for (let i = 0; i < p.length; i++) { const [a, b] = p[i], [u, v] = p[(i + 1) % p.length]; s += a * v - u * b; } return Math.abs(s) / 2; };
    const charts = svgs.slice(1).map(S => {
      const fills = [...S.querySelectorAll('path')].filter(p => p.getAttribute('fill') && p.getAttribute('fill') !== 'none' && p.getAttribute('d').endsWith('Z') && !p.closest('.dg-arrow'));
      const own = fills.find(p => p.getAttribute('fill-opacity') === '1'), other = fills.find(p => p.getAttribute('fill-opacity') !== '1');
      const bars = [...S.querySelectorAll('path')].filter(p => p.getAttribute('stroke-width') === '3.5').map(p => { const q = pts(p.getAttribute('d') + 'Z'); return Math.abs(q[1][1] - q[0][1]); });
      return { frac: area(own.getAttribute('d')) / (area(own.getAttribute('d')) + area(other.getAttribute('d'))), bars };
    });
    return { Rpx, hp, cols, charts };
  }, st);
  const th = st.th * Math.PI / 180, ang = Math.atan2(-r.hp[1], r.hp[0]), dAng = Math.abs(((ang - th) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  const okP = dAng < 0.02 && Math.abs(Math.hypot(...r.hp) - r.Rpx) < 1;
  let wc = 0;
  // the arc is drawn in runs of 1.5° whose round caps overlap their neighbours by up to 2.5 px: compare with the range of ᚹ₂ within ±3°
  for (const [t, col] of r.cols) {
    const g = col ? +col.match(/\d+/g)[1] : NaN, w = (g - 89) / (172 - 89);
    const near = Array.from({ length: 61 }, (_, i) => 1 - igChi(Math.cos(t + (i - 30) * Math.PI / 1800), st.s1, st.s2));
    wc = Math.max(wc, Number.isNaN(w) ? Infinity : Math.max(0, Math.min(...near) - w, w - Math.max(...near)));
  }
  const e = igExpect(st), m = ((st.th % 360) + 360) % 360, w1 = e.r1;
  const wf = Math.max(Math.abs(r.charts[0].frac - e.I1 / e.closed), Math.abs(r.charts[1].frac - e.I2 / e.closed));
  const barOk = (bars, own, has) => has ? bars.length === 2 && Math.abs(bars[0] / (bars[0] + bars[1]) - own) < 0.02 : bars.length === 0;
  const okB = barOk(r.charts[0].bars, w1, m !== 0) && barOk(r.charts[1].bars, 1 - w1, m !== 180);
  check(okP && wc < 0.015 && wf < 0.005 && okB, `${what}, the drawing in pixels: p at its angle on ℳ (off by ${dAng.toFixed(4)} rad); colour of ℳ = mix of blue and green in the proportion ᚹ₂ at 12 angles (within ±3°; max deviation ${wc.toFixed(3)}); solid area / (2πR rectangle) = term/(2πR) in both charts (max deviation ${wf.toExponential(1)}); bars at 𝒳(p), 𝒴(p) split as ᚹ₁(p) : ᚹ₂(p) (${okB ? 'yes' : 'no'})`);
}

async function testIntegration(width) {
  console.log(`integration @ ${width}px`);
  const { page, errors } = await open(IG, width, { module: 'integration' });
  await ready(page, 'integration');
  const fr = page.locator('.dg-interactive[data-module="integration"]');
  const pl = await placedAfter(fr, 'fig_integration_charts');
  check(pl.after, 'panel right after Figure 8.1 (fig_integration_charts), on the chapter opening page');
  if (width >= 1000) check(pl.h <= 850, `panel height ${Math.round(pl.h)} px <= 850 px`);
  const wd = await page.evaluate(() => [document.querySelector('.dg-interactive[data-module="integration"]').getBoundingClientRect().width, document.querySelector('#fig_integration_charts').getBoundingClientRect().width]);
  check(Math.abs(wd[0] - wd[1]) < 2, `as wide as the figure it follows (${Math.round(wd[0])} px, figure ${Math.round(wd[1])} px; D38)`);
  const state = async () => JSON.parse(await fr.locator('.dg-ig').getAttribute('data-state'));
  const svgM = fr.locator('.dg-ig svg.dg-plot-svg').nth(0);
  async function numbers(what) {
    const st = await state(), e = igExpect(st);
    const shown = await fr.locator('.dg-ig-val').evaluateAll(vs => vs.map(v => [v.dataset.k, v.textContent, !!v.closest('[hidden]')]));
    const text = await fr.locator('.dg-interactive-body').textContent();
    let err = 0, bad = [];
    for (const [k, t, hidden] of shown) {
      if (e[k] === null) { if (!hidden) bad.push(k + ' shown'); continue; }
      if (hidden) { bad.push(k + ' hidden'); continue; }
      const tol = ['r1', 'r2', 'a', 'b'].includes(k) ? 5.1e-4 : 5.1e-7;
      err = Math.max(err, Math.abs(num(t) - e[k]) / tol);
    }
    const nots = await fr.locator('.dg-ig-not').evaluateAll(ns => ns.map(n => !n.hidden));
    const notOk = nots[0] === (e.a === null) && nots[1] === (e.b === null);
    const val = k => shown.find(s => s[0] === k)[1];
    check(err <= 1 && !bad.length && notOk && val('sum') === val('closed') && st.s1 >= -0.5 && st.s2 <= 0.5 && st.s2 - st.s1 >= 0.02 - 1e-9 && !/NaN|Infinity/.test(text),
      `${what} (R = ${st.R}, ᚹ₁ = 1 for a/R <= ${st.s1}, ᚹ₂ = 1 for a/R >= ${st.s2}, θ = ${st.th}°): ${val('I1')} + ${val('I2')} = ${val('sum')}, 2πR = ${val('closed')}; ᚹ₁(p) = ${val('r1')}${e.a === null ? ', p ∉ 𝒰' : ''}${e.b === null ? ', p ∉ 𝒱' : ''}; largest deviation / tolerance ${err.toFixed(2)}${bad.length ? '; ' + bad.join(', ') : ''}`);
    await igGeometry(fr, st, what);
    return { st, val };
  }
  await shot(page, `integration-${width}.png`, fr);
  check(await fr.locator('mjx-merror, [data-mjx-error]').count() === 0, 'no MathJax errors in the frame');
  const tops = await fr.locator('.dg-ig > .dg-two').nth(1).locator('.dg-panel').evaluateAll(ps => ps.map(p => p.getBoundingClientRect().top));
  check(width < 700 ? tops[1] > tops[0] + 100 : Math.abs(tops[1] - tops[0]) < 2, width < 700 ? 'chart (𝒱, 𝒴) below chart (𝒰, 𝒳)' : 'the two charts side by side');
  let { st, val } = await numbers('start (Figure C.13c: ᚹ₁, ᚹ₂ shared on −R/2 < a < R/2)');
  check(JSON.stringify(st) === JSON.stringify(IG_START), 'starting state');
  check(val('I1') === val('I2') && Math.abs(num(val('I1')) - Math.PI) < 5.1e-7, `symmetric partition: both terms πR (${val('I1')}, ${val('I2')})`);
  const sums = new Set([val('sum')]);
  const sl = fr.locator('.dg-slider input');
  await sl.nth(1).focus(); await page.keyboard.press('End');
  ({ st, val } = await numbers('End on ᚹ₁ = 1 for a/R <= (pushes the other)')); sums.add(val('sum'));
  check(st.s1 === 0.48 && st.s2 === 0.5, `s1 = ${st.s1}, s2 = ${st.s2}`);
  await sl.nth(2).focus(); await page.keyboard.press('Home');
  ({ st, val } = await numbers('Home on ᚹ₂ = 1 for a/R >= (pushes the other)')); sums.add(val('sum'));
  check(st.s1 === -0.5 && st.s2 === -0.48, `s1 = ${st.s1}, s2 = ${st.s2}`);
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight');
  ({ st, val } = await numbers('ArrowRight ×30 on the second slider')); sums.add(val('sum'));
  check(Math.abs(st.s2 + 0.18) < 1e-9 && num(val('I1')) < Math.PI, `s2 = ${st.s2}: the ᚹ₁ term is smaller (${val('I1')}), the sum is not`);
  check(sums.size === 1, `the sum shown never changed with the partition of unity (${[...sums].join(', ')})`);
  await sl.nth(0).focus(); await page.keyboard.press('End');
  ({ st, val } = await numbers('End on R')); check(st.R === 1.5, `R = ${st.R}`);
  // p: keyboard, then the mouse onto (R, 0) and (−R, 0), the points missing from 𝒰 and 𝒱
  const hp = svgM.locator('[data-key="p"]');
  await hp.focus(); for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  ({ st } = await numbers('ArrowRight ×4 on p')); check(st.th === 120, `θ = ${st.th}°`);
  let [x, y] = await center(hp);
  const box = await svgM.boundingBox();
  const cy = box.y + box.height / 2 + (await svgM.evaluate(s => { const o = [...s.querySelectorAll('circle')].find(c => c.getAttribute('fill') === '#fff'); return +o.getAttribute('cy') - s.getBoundingClientRect().height / 2; }));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(box.x + box.width - 2, cy, { steps: 8 }); await page.mouse.up();
  ({ st } = await numbers('p dragged onto (R, 0)')); check(st.th === 0, `θ = ${st.th}°: p ∉ 𝒰`);
  [x, y] = await center(hp);
  const box2 = await svgM.boundingBox(), cy2 = cy - box.y + box2.y;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 60, y - 120, { steps: 6 }); await page.mouse.move(box2.x + 2, cy2, { steps: 8 }); await page.mouse.up();
  ({ st } = await numbers('p dragged onto (−R, 0)')); check(st.th === 180, `θ = ${st.th}°: p ∉ 𝒱`);
  await shot(page, `integration-moved-${width}.png`, fr);
  await panelFoot(page, fr, 'fig_integration_charts', 'Figure 8.1', null);
  check(JSON.stringify(await state()) === JSON.stringify(IG_START), 'Reset -> the starting state again');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  if (width === 1280) await integrationCrossChecks(page);
  await page.close();
}

async function integrationCrossChecks(page) {
  console.log('integration: the module against C.7 (random states)');
  const r = await page.evaluate(async () => {
    const m = await import('/notes/diffgeo-gr/assets/interactive/integration.js');
    let seed = 31; const rnd = (a, b) => a + (b - a) * ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const states = [], chis = [], clamp = [], coords = [];
    for (let n = 0; n < 300; n++) {
      const R = rnd(0.6, 1.5), s1 = rnd(-0.5, 0.48), s2 = n % 4 ? rnd(s1 + 0.02, 0.5) : Math.min(0.5, s1 + 0.02);
      states.push({ R, s1, s2, t: m.terms({ R, s1, s2 }) });
      const ss = [-1, -0.75, -0.5, s1 - 1e-9, s1, (s1 + s2) / 2, s2, s2 + 1e-9, 0.5, 0.75, 1, rnd(-1, 1), rnd(s1, s2)];
      chis.push({ s1, s2, ss, c: ss.map(s => m.chi(s, s1, s2)), w: [0.3, 1.7, 2.9, 4.4].map(th => m.rho({ s1, s2 }, th)) });
    }
    for (let n = 0; n < 200; n++) { const k = n % 2 ? 's1' : 's2'; clamp.push(m.clampS({ s1: rnd(-1, 1), s2: rnd(-1, 1) }, k)); }
    for (let n = 0; n < 200; n++) { const th = n < 4 ? [0, 180, 360, -90][n] : Math.round(rnd(-720, 720)); coords.push({ th, c: m.coords(th) }); }
    const fixedR = [0, 1, 2, 3, 4, 5].map(k => m.terms({ R: 1.3, s1: -0.5 + 0.15 * k, s2: -0.5 + 0.15 * k + 0.02 + 0.1 * (k % 3) }));
    return { states, chis, clamp, coords, fixedR, sym: [0.1, 0.25, 0.5].map(s => m.terms({ R: 1, s1: -s, s2: s })) };
  });
  let wt = 0, wc = 0, wg = 0;
  for (const { R, s1, s2, t } of r.states) {
    const e = igTerms({ R, s1, s2 }, 3000);
    wt = Math.max(wt, Math.abs(t.I1 - e.I1), Math.abs(t.I2 - e.I2));
    wc = Math.max(wc, Math.abs(t.sum - 2 * Math.PI * R), Math.abs(t.closed - 2 * Math.PI * R));
    wg = Math.max(wg, Math.abs(e.I1 + e.I2 - 2 * Math.PI * R));
  }
  check(wt < 1e-8, `each term (the module: Simpson, split at the transition) against Gauss–Legendre on the whole interval, max difference ${wt.toExponential(2)} (300 random R, s1, s2; a quarter with the sharpest transition, s2 − s1 = 0.02)`);
  check(wc < 1e-6 && wg < 1e-9, `the sum against the notes' closed form 2πR, max difference ${wc.toExponential(2)} (the test's own terms: ${wg.toExponential(2)})`);
  const spread = Math.max(...r.fixedR.map(t => t.sum)) - Math.min(...r.fixedR.map(t => t.sum)), moved = Math.max(...r.fixedR.map(t => t.I1)) - Math.min(...r.fixedR.map(t => t.I1));
  check(spread < 1e-12 && moved > 1, `R = 1.3, six partitions of unity: the ᚹ₁ term ranges over ${moved.toFixed(3)}, the sum over ${spread.toExponential(1)}`);
  check(r.sym.every(t => Math.abs(t.I1 - Math.PI) < 1e-12 && Math.abs(t.I2 - Math.PI) < 1e-12), 'symmetric transitions (s1 = −s2): both terms πR (χ(s) + χ(−s) = 1)');
  let wchi = 0, cond = true;
  for (const { s1, s2, ss, c, w } of r.chis) {
    ss.forEach((s, i) => { wchi = Math.max(wchi, Math.abs(c[i] - igChi(s, s1, s2))); });
    cond = cond && c.every(x => x >= 0 && x <= 1) && c.slice(0, 5).every(x => x === 1) && c.slice(6, 11).every(x => x === 0) && w.every(([a, b]) => Math.abs(a + b - 1) < 1e-15);
    for (let k = 1; k < 400 && cond; k++) cond = m1(s1, s2, k);
  }
  function m1(s1, s2, k) { return igChi(-1 + k / 200, s1, s2) <= igChi(-1 + (k - 1) / 200, s1, s2); }
  check(wchi < 1e-15 && cond, `χ as C.7 requires: values in [0, 1], χ = 1 on (−∞, −1/2] (and up to s1), χ = 0 on [1/2, ∞) (and from s2), non-increasing; ᚹ₁ + ᚹ₂ = 1 (300 random partitions; max difference to the test's χ ${wchi.toExponential(1)})`);
  check(r.clamp.every(s => s.s1 >= -0.5 && s.s2 <= 0.5 && s.s2 - s.s1 >= 0.02 - 1e-9 && Math.abs(s.s1 * 100 - Math.round(s.s1 * 100)) < 1e-9 && Math.abs(s.s2 * 100 - Math.round(s.s2 * 100)) < 1e-9),
    '−1/2 <= s1, s1 + 0.02 <= s2 <= 1/2 on a grid of 0.01 whatever the sliders do (200 random)');
  let wx = 0, okc = true;
  for (const { th, c } of r.coords) {
    const t = th * Math.PI / 180, p = [Math.cos(t), Math.sin(t)], m = ((th % 360) + 360) % 360;
    okc = okc && (c.alpha === null) === (m === 0) && (c.beta === null) === (m === 180);
    if (c.alpha !== null) { okc = okc && c.alpha > 0 && c.alpha < 2 * Math.PI; wx = Math.max(wx, Math.hypot(Math.cos(c.alpha) - p[0], Math.sin(c.alpha) - p[1])); }
    if (c.beta !== null) { okc = okc && c.beta > -Math.PI && c.beta < Math.PI; wx = Math.max(wx, Math.hypot(Math.cos(c.beta) - p[0], Math.sin(c.beta) - p[1])); }
  }
  check(okc && wx < 1e-12, `𝒳(p) ∈ (0, 2π), 𝒴(p) ∈ (−π, π) with 𝒳⁻¹(α) = 𝒴⁻¹(β) = p (200 angles; p ∉ 𝒰 exactly at (R, 0), p ∉ 𝒱 at (−R, 0)); max distance ${wx.toExponential(1)}`);
}

// ---- Figure 10.3 step by step (ehsteps, B32, D58): the figure's own SVG inlined, the viewBox on one box at a time
const EH = 'notes/diffgeo-gr/gr/einstein-hilbert.html';
const EH_STEPS = ['Sbox', 'Abox', 'Bbox', 'Cbox', 'Dbox', 'Ebox', 'Xbox', 'Fbox', 'Gbox', 'Hbox'];      // the caption's order
const EH_TAGS = ['', '(A)', '(B)', '(C)', '(D)', '(E)', '(∗) of (E)', '(F)', '(G)', '(H)'];               // as the figure prints them
const EH_MARGIN = 0.7 * 72 / 2.54, EH_HOLE = 0.5 * 72 / 2.54;
const DOCS = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'docs', 'notes', 'diffgeo-gr');
const EH_BOXES = JSON.parse(fs.readFileSync(path.join(DOCS, 'figures', 'fig-eh-chain-rule.boxes.json'), 'utf-8'));
const LABELS = JSON.parse(fs.readFileSync(path.join(DOCS, 'assets', 'labels.json'), 'utf-8'));
const grow = ([x, y, w, h], m) => [x - m, y - m, w + 2 * m, h + 2 * m];
async function testEhsteps(width) {
  console.log(`ehsteps @ ${width}px`);
  const { page, errors } = await open(EH, width, { module: 'ehsteps' });
  await ready(page, 'ehsteps');
  const fr = page.locator('.dg-interactive[data-module="ehsteps"]');
  const pl = await placedAfter(fr, 'fig_EH_chain_rule');
  check(pl.after, 'panel right after Figure 10.3 (fig_EH_chain_rule)');
  if (width >= 1000) check(pl.h <= 850, `panel height ${Math.round(pl.h)} px <= 850 px`);
  check(await fr.getAttribute('data-steps') === EH_STEPS.join(' '), `steps in the caption's order: ${await fr.getAttribute('data-steps')}`);
  const svg = fr.locator('svg.dg-ehs-svg');
  const state = async () => JSON.parse(await fr.locator('.dg-ehs').getAttribute('data-state'));
  check(await svg.count() === 1 && await svg.evaluate(e => e.querySelectorAll('use').length > 4000 && e.getAttribute('role') === 'group' && /^Figure 10\.3: \S/.test(e.getAttribute('aria-label') || '')),
    'the figure\'s own SVG is inlined (all its glyphs), role group labelled with the figure\'s alt ("Figure 10.3: <short caption>", B11)');
  // the same file as the static figure, fetched only by the panel (the static image is lazy)
  const src = await page.locator('#fig_EH_chain_rule img').getAttribute('src');
  check(src === '../figures/fig-eh-chain-rule.svg', `static figure ${src}`);
  // the two \ref badges inside the figure are links to their targets (as on the roadmaps)
  const links = await svg.evaluate(e => [...e.querySelectorAll('a.dg-svg-link')].map(a => [a.getAttribute('href'), a.querySelector('g.dg-xref').getAttribute('data-label'), a.querySelector('title').textContent]));
  const want = ['subsection_metric_prop_parallel', 'subsection_metric_prop_det'];
  check(links.length === 2 && want.every(l => links.some(([h, lab, t]) => lab === l && h === `${base}/notes/diffgeo-gr/${LABELS[l].url}` && t === LABELS[l].num)),
    `the two \\ref badges are links: ${links.map(([h, l, t]) => `${l} (${t}) -> ${h.replace(base, '')}`).join(', ')}`);
  const vb = async () => (await svg.getAttribute('viewBox')).split(' ').map(Number);
  const near4 = (a, b, t = 2e-3) => a.length === 4 && a.every((v, i) => Math.abs(v - b[i]) <= t);
  const hole = async () => svg.evaluate(e => { const n = e.querySelector('.dg-ehs-veil').getAttribute('d').match(/-?[\d.]+/g).map(Number); return n.slice(5, 9); });
  async function at(k, what) {
    const st = await state(), v = await vb(), pos = await fr.locator('.dg-ehs-pos').textContent(), h = await hole();
    const box = EH_BOXES.boxes[EH_STEPS[k]];
    const ok = st.k === k && st.step === EH_STEPS[k] && !st.whole && near4(v, grow(box, EH_MARGIN))
      && near4([h[0], h[1], h[0] + h[2], h[1] + h[3]].map(Number), (([x, y, w, hh]) => [x, y, x + w, y + hh])(grow(box, EH_HOLE)))
      && pos === `${k + 1} / 10` + (EH_TAGS[k] ? ' ' + EH_TAGS[k] : '');
    check(ok, `${what}: step ${k + 1} "${pos}", viewBox ${v.map(x => +x.toFixed(1)).join(' ')} = ${EH_STEPS[k]} + 0.7 cm, the undimmed hole = ${EH_STEPS[k]} + 0.5 cm`);
    return ok;
  }
  check(await at(0, 'start'), 'starting state: the first line');
  check(await fr.locator('.dg-ehs-prev').getAttribute('aria-disabled') === 'true' && await fr.locator('.dg-ehs-next').getAttribute('aria-disabled') === 'false', 'Previous marked unavailable at the first step, Next available');
  await shot(page, `ehsteps-${width}.png`, fr);
  // buttons, with the transition (no reduced motion)
  for (let k = 1; k < 10; k++) {
    await fr.locator('.dg-ehs-next').click();
    if (k === 1) { await page.waitForTimeout(90); const v = await vb(); check(!near4(v, grow(EH_BOXES.boxes.Abox, EH_MARGIN)) && !near4(v, grow(EH_BOXES.boxes.Sbox, EH_MARGIN)), 'a short transition between two steps (without prefers-reduced-motion)'); }
    await page.waitForTimeout(420);
    await at(k, 'Next');
  }
  check(await fr.locator('.dg-ehs-next').getAttribute('aria-disabled') === 'true', 'Next marked unavailable at the last step');
  await shot(page, `ehsteps-H-${width}.png`, fr);
  // keyboard, with reduced motion (no transition): ← / → when the panel has the focus; nothing past the ends
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await svg.focus();
  await page.keyboard.press('ArrowRight');
  await at(9, 'ArrowRight at the last step');
  for (let k = 8; k >= 0; k--) { await page.keyboard.press('ArrowLeft'); if (k === 6 || k === 3 || k === 0) await at(k, 'ArrowLeft'); }
  await page.keyboard.press('ArrowLeft');
  await at(0, 'ArrowLeft at the first step');
  await fr.locator('.dg-ehs-next').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await at(3, 'ArrowRight ×3 on the Next button (the focus is in the panel)');
  check(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('dg-ehs-next')), 'the focus stays on Next');
  check(page.url().endsWith('/' + EH), 'the arrow keys in the panel step it, not the page (course.js leaves them to the panel)');
  await shot(page, `ehsteps-C-${width}.png`, fr);
  // whole figure, and back
  await fr.locator('.dg-ehs-whole').click();
  let st = await state();
  check(st.whole && near4(await vb(), EH_BOXES.viewBox) && await fr.locator('.dg-ehs-whole').getAttribute('aria-pressed') === 'true'
    && (await hole()).every((v, i) => Math.abs(v - grow(EH_BOXES.viewBox, 1)[i]) < 2e-3),
    `Whole figure: viewBox = the figure's (${EH_BOXES.viewBox.map(x => +x.toFixed(1)).join(' ')}), nothing dimmed, pressed`);
  await shot(page, `ehsteps-whole-${width}.png`, fr);
  await fr.locator('.dg-ehs-whole').click();
  await at(3, 'Whole figure again: back to the step');
  await fr.locator('.dg-ehs-whole').click();
  await fr.locator('.dg-ehs-next').click();
  await at(4, 'Next from the whole figure');
  check(await fr.locator('.dg-ehs-whole').getAttribute('aria-pressed') === 'false', 'Whole figure no longer pressed');
  // (B33: on a phone the drawing is wider than the stage, which scrolls sideways: inside it means inside its scroll width)
  const inStage = await fr.evaluate(f => { const st = f.querySelector('.dg-ehs-stage'), s = st.getBoundingClientRect(), v = f.querySelector('svg').getBoundingClientRect();
    return v.left >= s.left - st.scrollLeft - 0.5 && v.width <= st.scrollWidth + 0.5 && v.top >= s.top - 0.5 && v.bottom <= s.bottom + 0.5; });
  check(inStage, 'the drawing stays inside its stage (its scroll width on a phone)');
  check(await fr.locator('.dg-interactive-body .dg-ehs-pos[aria-live="polite"]').count() === 1, 'the step is announced (aria-live)');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await panelFoot(page, fr, 'fig_EH_chain_rule', 'Figure 10.3', null);
  await at(0, 'Reset -> the first line again');
  check(await fr.locator('svg.dg-ehs-svg').count() === 1 && await fr.locator('a.dg-svg-link').count() === 2, 'Reset: one figure, its two links');
  await svg.focus(); await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(450);
  await at(1, 'one ArrowRight after Reset moves one step (no key handler left from the first mount)');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await noSideScroll(page, width);
  await page.close();
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
  // rotating, pointmass (B27): a finger 10 px off χ(0) in the co-rotating chart drags it, one 10 px off ζ(0) changes r(0);
  // vertical swipes elsewhere (the co-rotating chart, the falling chart, which has no handles) scroll the page
  for (const [mod, svgIdx, key, dir, moved] of [['rotating', 1, 'p0', [-15, -25], (a, b) => Math.hypot(b.p0[0] - a.p0[0], b.p0[1] - a.p0[1]) > 0.1],
    ['pointmass', 0, 'z0', [0, 30], (a, b) => b.R < a.R - 0.1]]) {
    const { page, errors } = await open(NEWTON, 390, { touch: true, module: mod });
    await ready(page, mod);
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator(`.dg-interactive[data-module="${mod}"]`);
    const state = async () => JSON.parse(await fr.locator('.dg-nc').getAttribute('data-state'));
    const svg = fr.locator('.dg-nc svg.dg-plot-svg').nth(svgIdx);
    check(await svg.evaluate(e => getComputedStyle(e).touchAction) === 'pan-y pinch-zoom' && await svg.locator(`[data-key="${key}"]`).evaluate(e => getComputedStyle(e).touchAction) === 'none',
      `${mod}: touch-action pan-y pinch-zoom on the drawing, none on the handles`);
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const hb = await svg.locator(`[data-key="${key}"]`).boundingBox(), hx = hb.x + hb.width / 2 - 10, hy = hb.y + hb.height / 2;
    let s0 = await state(), y0 = await scrollY(page);
    await swipe(page, cdp, [hx, hy], [hx + dir[0], hy + dir[1]]);
    const s1 = await state(), y1 = await scrollY(page);
    check(moved(s0, s1) && y1 === y0, `${mod}: a swipe starting 10 px from ${key === 'p0' ? 'χ(0)' : 'ζ(0)'} drags it (${JSON.stringify(key === 'p0' ? s0.p0 : s0.R)} -> ${JSON.stringify(key === 'p0' ? s1.p0.map(v => +v.toFixed(3)) : s1.R)}) and does not scroll (scrollY ${y0} -> ${y1})`);
    const other = fr.locator('.dg-nc svg.dg-plot-svg').nth(1);
    await other.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const pt = await emptyPoint(other);
    check(!!pt, `${mod}: found an empty point of the ${mod === 'rotating' ? 'co-rotating' : 'falling'} chart`);
    if (pt) {
      s0 = await state(); y0 = await scrollY(page);
      await swipe(page, cdp, pt, [pt[0], pt[1] - 150]);
      const y2 = await scrollY(page);
      check(y2 > y0 + 50 && JSON.stringify(await state()) === JSON.stringify(s0), `${mod}: a vertical swipe from an empty point scrolls the page (scrollY ${y0} -> ${y2}) and leaves the panel as it was`);
    }
    check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // lightcones, schwarzschild (B28): a finger 10 px off γ(2) moves it sideways, one 10 px off r2 moves it outwards; vertical
  // swipes elsewhere (lightcones: an empty point of the drawing; schwarzschild: the g plot, which has no handles) scroll the page
  for (const [mod, url, sel, key, other, dir, moved] of [['lightcones', GR, '.dg-lc', 'k2', 0, [30, -5], (a, b) => b.c[2] > a.c[2] + 0.1],
    ['schwarzschild', SCH, '.dg-sch', 'r2', 1, [30, -20], (a, b) => b.r2 > a.r2 + 0.1]]) {
    const { page, errors } = await open(url, 390, { touch: true, module: mod });
    await ready(page, mod);
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator(`.dg-interactive[data-module="${mod}"]`);
    const state = async () => JSON.parse(await fr.locator(sel).getAttribute('data-state'));
    const svg = fr.locator(`${sel} svg.dg-plot-svg`).nth(0);
    check(await svg.evaluate(e => getComputedStyle(e).touchAction) === 'pan-y pinch-zoom' && await svg.locator(`[data-key="${key}"]`).evaluate(e => getComputedStyle(e).touchAction) === 'none',
      `${mod}: touch-action pan-y pinch-zoom on the drawing, none on the handles`);
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const hb = await svg.locator(`[data-key="${key}"]`).boundingBox(), hx = hb.x + hb.width / 2 - 10, hy = hb.y + hb.height / 2;
    let s0 = await state(), y0 = await scrollY(page);
    await swipe(page, cdp, [hx, hy], [hx + dir[0], hy + dir[1]]);
    const s1 = await state(), y1 = await scrollY(page);
    check(moved(s0, s1) && y1 === y0, `${mod}: a swipe starting 10 px from ${key === 'k2' ? 'γ(2)' : 'r₂'} drags it (${JSON.stringify(key === 'k2' ? s0.c[2] : s0.r2)} -> ${JSON.stringify(key === 'k2' ? +s1.c[2].toFixed(3) : s1.r2)}) and does not scroll (scrollY ${y0} -> ${y1})`);
    const area = fr.locator(`${sel} svg.dg-plot-svg`).nth(other);
    await area.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const pt = await emptyPoint(area);
    check(!!pt, `${mod}: found an empty point of the ${other ? 'g plot' : 'drawing'}`);
    if (pt) {
      s0 = await state(); y0 = await scrollY(page);
      await swipe(page, cdp, pt, [pt[0], pt[1] - 150]);
      const y2 = await scrollY(page);
      check(y2 > y0 + 50 && JSON.stringify(await state()) === JSON.stringify(s0), `${mod}: a vertical swipe from an empty point scrolls the page (scrollY ${y0} -> ${y2}) and leaves the panel as it was`);
    }
    check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // fields (B29): a finger 10 px off p (drawn radius 6.5) drags it; a vertical swipe from an empty point of the drawing scrolls the page
  {
    const { page, errors } = await open(FD, 390, { touch: true, module: 'fields' });
    await ready(page, 'fields');
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator('.dg-interactive[data-module="fields"]');
    const state = async () => JSON.parse(await fr.locator('.dg-fd').getAttribute('data-state'));
    const svg = fr.locator('.dg-fd svg.dg-plot-svg');
    check(await svg.evaluate(e => getComputedStyle(e).touchAction) === 'pan-y pinch-zoom' && await svg.locator('[data-key="p"]').evaluate(e => getComputedStyle(e).touchAction) === 'none',
      'fields: touch-action pan-y pinch-zoom on the drawing, none on the handle');
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const hb = await svg.locator('[data-key="p"]').boundingBox(), hx = hb.x + hb.width / 2 - 10, hy = hb.y + hb.height / 2;
    let s0 = await state(), y0 = await scrollY(page);
    await swipe(page, cdp, [hx, hy], [hx - 40, hy + 30]);
    const s1 = await state(), y1 = await scrollY(page);
    check(s1.p[0] < s0.p[0] - 0.5 && s1.p[1] < s0.p[1] - 0.5 && y1 === y0, `fields: a swipe starting 10 px from p drags it (p ${s0.p.map(v => v.toFixed(3))} -> ${s1.p.map(v => v.toFixed(3))}) and does not scroll (scrollY ${y0} -> ${y1})`);
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const pt = await emptyPoint(svg);
    check(!!pt, 'fields: found an empty point of the drawing');
    if (pt) {
      s0 = await state(); y0 = await scrollY(page);
      await swipe(page, cdp, pt, [pt[0], pt[1] - 150]);
      const y2 = await scrollY(page);
      check(y2 > y0 + 50 && JSON.stringify(await state()) === JSON.stringify(s0), `fields: a vertical swipe from an empty point scrolls the page (scrollY ${y0} -> ${y2}) and leaves the panel as it was`);
    }
    check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // cotangent (B30): in (𝒱, 𝒴), a finger 10 px off p (drawn radius 6.5) drags it; a vertical swipe from an empty point scrolls the page
  {
    const { page, errors } = await open(COT, 390, { touch: true, module: 'cotangent' });
    await ready(page, 'cotangent');
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator('.dg-interactive[data-module="cotangent"]');
    const state = async () => JSON.parse(await fr.locator('.dg-cot').getAttribute('data-state'));
    const svg = fr.locator('.dg-cot .dg-panel').nth(1).locator('svg');
    check(await svg.evaluate(e => getComputedStyle(e).touchAction) === 'pan-y pinch-zoom' && await svg.locator('[data-key="p"]').evaluate(e => getComputedStyle(e).touchAction) === 'none'
      && await svg.locator('[data-key="tip"]').evaluate(e => getComputedStyle(e).touchAction) === 'none', 'cotangent: touch-action pan-y pinch-zoom on the drawing, none on the handles');
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const hb = await svg.locator('[data-key="p"]').boundingBox(), hx = hb.x + hb.width / 2 - 10, hy = hb.y + hb.height / 2;
    let s0 = await state(), y0 = await scrollY(page);
    await swipe(page, cdp, [hx, hy], [hx - 25, hy + 15]);
    const s1 = await state(), y1 = await scrollY(page);
    check(JSON.stringify(s1.p) !== JSON.stringify(s0.p) && y1 === y0, `cotangent: a swipe starting 10 px from p drags it (p ${s0.p.map(v => v.toFixed(3))} -> ${s1.p.map(v => v.toFixed(3))}) and does not scroll (scrollY ${y0} -> ${y1})`);
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const pt = await emptyPoint(svg);
    check(!!pt, 'cotangent: found an empty point of the drawing');
    if (pt) {
      s0 = await state(); y0 = await scrollY(page);
      await swipe(page, cdp, pt, [pt[0], pt[1] - 150]);
      const y2 = await scrollY(page);
      check(y2 > y0 + 50 && JSON.stringify(await state()) === JSON.stringify(s0), `cotangent: a vertical swipe from an empty point scrolls the page (scrollY ${y0} -> ${y2}) and leaves the panel as it was`);
    }
    check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // integration (B31): on ℳ, a finger 10 px off p (drawn radius 6) drags it along the circle; a vertical swipe from an empty point scrolls the page
  {
    const { page, errors } = await open(IG, 390, { touch: true, module: 'integration' });
    await ready(page, 'integration');
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator('.dg-interactive[data-module="integration"]');
    const state = async () => JSON.parse(await fr.locator('.dg-ig').getAttribute('data-state'));
    const svg = fr.locator('.dg-ig svg.dg-plot-svg').nth(0);
    check(await svg.evaluate(e => getComputedStyle(e).touchAction) === 'pan-y pinch-zoom' && await svg.locator('[data-key="p"]').evaluate(e => getComputedStyle(e).touchAction) === 'none',
      'integration: touch-action pan-y pinch-zoom on the drawing, none on the handle');
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const hb = await svg.locator('[data-key="p"]').boundingBox(), hx = hb.x + hb.width / 2 - 10, hy = hb.y + hb.height / 2;
    let s0 = await state(), y0 = await scrollY(page);
    await swipe(page, cdp, [hx, hy], [hx - 60, hy + 25]);
    const s1 = await state(), y1 = await scrollY(page);
    check(s1.th > s0.th + 10 && y1 === y0, `integration: a swipe starting 10 px from p drags it along ℳ (θ ${s0.th}° -> ${s1.th}°) and does not scroll (scrollY ${y0} -> ${y1})`);
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const pt = await emptyPoint(svg);
    check(!!pt, 'integration: found an empty point of the drawing');
    if (pt) {
      s0 = await state(); y0 = await scrollY(page);
      await swipe(page, cdp, pt, [pt[0], pt[1] - 150]);
      const y2 = await scrollY(page);
      check(y2 > y0 + 50 && JSON.stringify(await state()) === JSON.stringify(s0), `integration: a vertical swipe from an empty point scrolls the page (scrollY ${y0} -> ${y2}) and leaves the panel as it was`);
    }
    check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // ehsteps (B32): a vertical swipe over the inlined figure scrolls the page and leaves the step as it was
  {
    const { page, errors } = await open(EH, 390, { touch: true, module: 'ehsteps' });
    await ready(page, 'ehsteps');
    const cdp = await page.context().newCDPSession(page);
    const fr = page.locator('.dg-interactive[data-module="ehsteps"]');
    const svg = fr.locator('svg.dg-ehs-svg');
    const ta = await svg.evaluate(e => getComputedStyle(e).touchAction);
    check(ta === 'manipulation' || (/pan-x/.test(ta) && /pan-y/.test(ta) && /pinch-zoom/.test(ta)), `ehsteps: touch-action ${ta} (= pan-x pan-y pinch-zoom) on the figure (B33: the stage scrolls sideways on a phone)`);
    await fr.locator('.dg-ehs-next').click(); await page.waitForTimeout(450);
    await svg.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const b = await svg.boundingBox(), s0 = await fr.locator('.dg-ehs').getAttribute('data-state'), y0 = await scrollY(page);
    await swipe(page, cdp, [b.x + b.width / 2, b.y + b.height * 0.7], [b.x + b.width / 2, b.y + b.height * 0.7 - 150]);
    const y1 = await scrollY(page);
    check(y1 > y0 + 50 && await fr.locator('.dg-ehs').getAttribute('data-state') === s0, `ehsteps: a vertical swipe over the figure scrolls the page (scrollY ${y0} -> ${y1}) and leaves the step as it was`);
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

// ---- the milestone-3 review nits (B33): charts' arrows reach 3:1 on the panel surface in both themes; laws' level numbers
// beside their lines; cotangent's level sets never closer than ~3 px; transport's κ slider shown for ∇ᵏ only, its place kept;
// rotating's legend clear of the chart titles; sliders of one row equally long, and the same rule in every panel; ehsteps at
// 390 px drawn wide enough for 8 px text, taller, scrolling sideways; tpm's chart names in Unicode; no words of ours inside
// formulas (static scan of the modules)
const lum = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(x => +x / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
async function testNits(width) {
  console.log(`B33 nits @${width}`);
  // charts: the arrows' colour against the frame's surface, light and dark
  {
    const { page, errors } = await open(CHARTS, width); await ready(page);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme); await page.waitForTimeout(150);
      const r = await page.evaluate(() => { const a = document.querySelector('.dg-ch-arrows .dg-ch-arr'), f = document.querySelector('.dg-interactive');
        return a && { fg: getComputedStyle(a).color, bg: getComputedStyle(f).backgroundColor }; });
      check(r && contrast(r.fg, r.bg) >= 3, `charts (${theme}): transition arrows ${r && r.fg} on ${r && r.bg}: ${r ? contrast(r.fg, r.bg).toFixed(2) : '?'}:1 >= 3:1`);
    }
    check(errors.length === 0, 'charts: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // laws: no level line passes through the box of any level number (the box shrunk by 0.5 px)
  {
    const { page, errors } = await open(LAWS, width); await ready(page);
    const d = await page.evaluate(() => {
      const hits = [];
      const cross = ([x0, y0, x1, y1], b) => {            // Liang–Barsky: does the segment enter the box?
        let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
        for (const [p, q] of [[-dx, x0 - b.x], [dx, b.x + b.width - x0], [-dy, y0 - b.y], [dy, b.y + b.height - y0]]) {
          if (p === 0) { if (q < 0) return false; continue; }
          const r = q / p; if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
        }
        return t0 <= t1;
      };
      for (const svg of document.querySelectorAll('.dg-laws svg')) {
        const lines = [...svg.querySelectorAll('path')].filter(p => (p.getAttribute('stroke') || '').toUpperCase() === '#AA3377').map(p => p.getAttribute('d').match(/-?[\d.]+/g).map(Number));
        for (const t of svg.querySelectorAll('text.dg-laws-level')) {
          const b = t.getBBox(), s = { x: b.x + 0.5, y: b.y + 0.5, width: b.width - 1, height: b.height - 1 };
          if (lines.some(l => cross(l, s))) hits.push(t.textContent);
        }
      }
      return hits;
    });
    check(d.length === 0, `laws: no level line runs through a level number${d.length ? ' (' + d.join(', ') + ')' : ''}`);
    check(errors.length === 0, 'laws: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // cotangent: along vertical scan lines near the right edge of the 𝒴 chart, drawn level sets never cross closer than 2.4 px
  // (3 px across the lines, less along a slanted scan line)
  {
    const { page, errors } = await open('notes/diffgeo-gr/tangent-spaces/cotangent-space.html', width); await ready(page);
    const gap = await page.evaluate(() => {
      const svg = document.querySelectorAll('.dg-interactive svg.dg-plot-svg')[1];
      const segs = [];                                   // [x0, y0, x1, y1, level set]
      [...svg.querySelectorAll('path.dg-cot-level')].forEach((p, k) => { const v = p.getAttribute('d').match(/-?[\d.]+/g).map(Number); for (let i = 0; i + 3 < v.length; i += 4) segs.push([...v.slice(i, i + 4), k]); });
      const xs = segs.flatMap(s => [s[0], s[2]]), xmax = Math.max(...xs);
      let worst = Infinity;
      for (const off of [4, 8, 12, 16, 20, 30, 40]) {
        const X = xmax - off, ys = [];
        for (const [x0, y0, x1, y1, k] of segs) if ((x0 - X) * (x1 - X) < 0) ys.push([y0 + (y1 - y0) * (X - x0) / (x1 - x0), k]);
        ys.sort((a, b) => a[0] - b[0]);
        // neighbours of different level sets (two crossings of one level set near its fold are not crowding)
        for (let i = 1; i < ys.length; i++) if (ys[i][1] !== ys[i - 1][1]) worst = Math.min(worst, ys[i][0] - ys[i - 1][0]);
      }
      return worst;
    });
    check(gap >= 2.4, `cotangent: drawn level sets near the right edge of 𝒴 at least ${gap.toFixed(2)} px apart (>= 2.4)`);
    const names = await page.locator('.dg-interactive svg.dg-plot-svg').evaluateAll(ss => ss.map(s => s.getAttribute('aria-label')));
    check(names.join('|') === '(𝒰, 𝒳)|(𝒱, 𝒴)', `cotangent: chart names ${names.join(', ')}`);
    check(errors.length === 0, 'cotangent: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // transport: κ invisible for ∇ᴱ and ∇ᵂ, visible for ∇ᵏ; the controls do not move when it appears
  {
    const { page, errors } = await open(TR, width); await ready(page);
    const fr = page.locator('.dg-interactive');
    const k = () => fr.locator('.dg-tr-kappa').evaluate(e => ({ vis: getComputedStyle(e).visibility, top: Math.round(e.getBoundingClientRect().top), h: Math.round(e.closest('.dg-controls').getBoundingClientRect().height) }));
    const a = await k();
    await fr.locator('.dg-choice').first().locator('label').nth(2).click(); await page.waitForTimeout(300);
    const b = await k();
    check(a.vis === 'hidden' && b.vis === 'visible', `transport: κ slider hidden for ∇ᴱ (${a.vis}), shown for ∇ᵏ (${b.vis})`);
    check(a.top === b.top && a.h === b.h, `transport: the controls keep their place (top ${a.top} -> ${b.top}, row height ${a.h} -> ${b.h})`);
    check(await fr.locator('.dg-tr-out').evaluate(e => !/\bchart\b/.test([...e.querySelectorAll('mjx-container')].map(m => m.getAttribute('aria-label') || '').join(' ')) && /chart/.test(e.textContent)),
      'transport: "chart" is text, not part of a formula');
    check(errors.length === 0, 'transport: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // rotating: the legend ends at least 8 px above the chart titles
  {
    const { page, errors } = await open(NEWTON, width, { module: 'rotating' }); await ready(page, 'rotating');
    const g = await page.locator('.dg-interactive[data-module="rotating"]').evaluate(f => {
      const l = f.querySelector('.dg-legend').getBoundingClientRect(), t = Math.min(...[...f.querySelectorAll('svg.dg-plot-svg')].map(s => s.getBoundingClientRect().top));
      return t - l.bottom; });
    check(g >= 8, `rotating: ${g.toFixed(1)} px between the legend and the charts (>= 8)`);
    check(errors.length === 0, 'rotating: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  // sliders: on every panel, the visible tracks of one row are equally long and at least 6rem
  for (const [url, m] of [[TR, 'transport'], [NEWTON, 'rotating'], [NEWTON, 'pointmass'], ['notes/diffgeo-gr/integrals/index.html', 'integration'], [GR, 'lightcones'], [SCH, 'schwarzschild'], [VAR, 'variations']]) {
    const { page } = await open(url, width, { module: m }); await ready(page, m);
    const rows = await page.locator(`.dg-interactive[data-module="${m}"] .dg-slider`).evaluateAll(ss => {
      const by = {};
      for (const s of ss) { if (getComputedStyle(s).visibility === 'hidden') continue; const r = s.querySelector('input').getBoundingClientRect(); (by[Math.round(r.top)] ||= []).push(r.width); }
      return Object.values(by); });
    const flat = rows.flat(), even = rows.every(r => Math.max(...r) - Math.min(...r) <= 2);
    check(flat.length > 0 && even && Math.min(...flat) >= 6 * 16 - 1, `${m}: slider tracks ${rows.map(r => r.map(Math.round).join('/')).join(' | ')} px (equal in a row, >= 6rem)`);
    await page.close();
  }
  // tpm: chart drawings named in Unicode (D56)
  {
    const { page } = await open(TPM, width); await ready(page);
    const names = await page.locator('.dg-interactive svg.dg-plot-svg').evaluateAll(ss => ss.map(s => s.getAttribute('aria-label')));
    check(names.join('|') === '(𝒰, 𝒳)|(𝒱, 𝒴)', `tpm: chart names ${names.join(', ')}`);
    await page.close();
  }
  // ehsteps on a phone: a panel's text at >= 8 px, the stage taller than the column is wide, and it scrolls sideways
  if (width < 600) {
    const { page, errors } = await open('notes/diffgeo-gr/gr/einstein-hilbert.html', width, { touch: true }); await ready(page);
    const r = await page.evaluate(async () => {
      const st = document.querySelector('.dg-ehs-stage'), sv = st.querySelector('svg'), img = document.querySelector('#fig_EH_chain_rule img');
      const vb = sv.viewBox.baseVal, sw = sv.getBoundingClientRect().width, sh = sv.getBoundingClientRect().height;
      const whole = (await (await fetch(img.src.replace(/\.svg$/, '.boxes.json'))).json()).viewBox[2];
      const scale = Math.min(sw / vb.width, sh / vb.height);               // px per user unit in the current step's view
      const text = +img.getAttribute('data-dg-text') * scale * whole / +img.getAttribute('width');
      return { text, h: st.clientHeight, w: st.clientWidth, scrolls: st.scrollWidth > st.clientWidth + 10, maxh: innerHeight * 0.8 }; });
    check(r.text >= 7.9 && r.h > r.w && r.h <= r.maxh + 1 && r.scrolls, `ehsteps @${width}: panel text ${r.text.toFixed(1)} px, stage ${r.w}x${r.h} (<= 80vh), scrolls sideways`);
    check(errors.length === 0, 'ehsteps: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
}

function scanTextWords() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'notes', 'diffgeo-gr', 'assets', 'interactive');
  const bad = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/\\\\(?:text|textrm|textsf|textit|mbox)\{([^{}]*)\}/g)) if (/[A-Za-z]{3,}/.test(m[1].replace(/\\\\runic/g, ''))) bad.push(`${f}: ${m[0]}`);
  }
  check(bad.length === 0, `no English words inside the formulas of the modules (D31, B33)${bad.length ? ': ' + bad.join(', ') : ''}`);
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
  for (const w of [1280, 390]) { await testMaps(w); await testVariations(w); await testTpm(w); await testLaws(w); await testTransport(w); await testCharts(w); await testRotating(w); await testPointmass(w); await testLightcones(w); await testSchwarzschild(w); await testFields(w); await testCotangent(w); await testIntegration(w); await testEhsteps(w); }
  for (const w of [1280, 390]) await testNits(w);
  scanTextWords();
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
