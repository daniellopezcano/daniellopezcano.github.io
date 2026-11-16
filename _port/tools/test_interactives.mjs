// Hand-written tool: headless-browser test of the interactive figures (assets/interactive/*.js).
//   node _port/tools/test_interactives.mjs [--shots DIR]      exit code 0 = all checks passed, 1 = failures
// Serves docs/ (render the pages first), drives each interactive at 1280 px and 390 px, asserts that it
// mounts without console errors of its own and reacts to its controls, cross-checks the numbers of the
// variations module against the closed forms of Appendix C.6 and those of the tpm module against the
// transformation law of §4.1.1 (finite differences of the chart maps), and checks that a module that fails to
// load leaves its frame hidden. --shots writes a screenshot of every frame.
import fs from 'node:fs';
import path from 'node:path';
import { serveDocs, chromium } from './shot.mjs';

const args = process.argv.slice(2);
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const MAPS = 'notes/diffgeo-gr/vector-spaces/foundations-sets-maps.html';
const VAR = 'notes/diffgeo-gr/examples/example-variations.html';
const TPM = 'notes/diffgeo-gr/tangent-spaces/tangent-space.html';
// page errors that are not ours (MathJax config, being fixed elsewhere) and placeholder images
const IGNORE = [/Cannot set property Package/, /Failed to load resource/];

let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failures++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const num = s => parseFloat(String(s).replace('−', '-'));

const { server, base } = await serveDocs();
const browser = await chromium.launch();

async function open(url, width, { breakModule } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.some(r => r.test(m.text()))) errors.push(m.text()); });
  page.on('pageerror', e => { if (!IGNORE.some(r => r.test(e.message))) errors.push(e.message); });
  if (breakModule) await page.route('**/assets/interactive/' + breakModule, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'export default function () { throw new Error("broken on purpose"); }' }));
  await page.goto(base + '/' + url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('dg-math-ready'), null, { timeout: 30000 });
  // bring the figure the frame follows into view, so that course.js loads the module
  await page.evaluate(() => { const f = document.querySelector('.dg-interactive'); (f.previousElementSibling || f).scrollIntoView({ block: 'center', behavior: 'instant' }); });
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

// the panel's footer (D55): Reset re-mounts (one body, one set of controls), the static-figure link
// names the figure and scrolls to it, the notebook link where interactives.json gives one
async function panelFoot(page, fr, figId, figName, notebook) {
  const foot = fr.locator('.dg-interactive-foot');
  check(await foot.count() === 1, 'panel footer present');
  const stat = foot.locator('a.dg-ia-static');
  check(await stat.textContent() === figName && await stat.getAttribute('href') === '#' + figId, `static-figure link "${figName}" -> #${figId}`);
  const nb = foot.locator('a.dg-ia-notebook');
  if (notebook) check(await nb.count() === 1 && (await nb.getAttribute('href')).endsWith('/' + notebook), `notebook link -> ${notebook}`);
  else check(await nb.count() === 0, 'no notebook link');
  await foot.locator('button.dg-ia-reset').click();
  await page.waitForFunction(f => !f.querySelector('.dg-ia-reset').disabled, await fr.elementHandle());
  await page.waitForTimeout(300);
  check(await fr.locator('.dg-interactive-body > .dg-controls').count() >= 1 && await fr.locator('.dg-interactive-foot').count() === 1, 'Reset leaves one body and one footer');
  check(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('dg-ia-reset')), 'focus stays on Reset');
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
  for (const w of [1280, 390]) { await testMaps(w); await testVariations(w); await testTpm(w); }
  await testBroken();
} catch (e) {
  console.log('  FAIL exception: ' + e.message.split('\n')[0]);
  failures++;
}
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
