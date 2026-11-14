// Hand-written tool: headless-browser test of the interactive figures (assets/interactive/*.js).
//   node _port/tools/test_interactives.mjs [--shots DIR]      exit code 0 = all checks passed, 1 = failures
// Serves docs/ (render the pages first), drives each interactive at 1280 px and 390 px, asserts that it
// mounts without console errors of its own and reacts to its controls, cross-checks the numbers of the
// variations module against the closed forms of Appendix C.6, and checks that a module that fails to
// load leaves its frame hidden. --shots writes a screenshot of every frame.
import fs from 'node:fs';
import path from 'node:path';
import { serveDocs, chromium } from './shot.mjs';

const args = process.argv.slice(2);
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const MAPS = 'notes/diffgeo-gr/vector-spaces/foundations-sets-maps.html';
const VAR = 'notes/diffgeo-gr/examples/example-variations.html';
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
const shot = async (page, name) => { if (shots) await page.locator('.dg-interactive').screenshot({ path: path.join(shots, name) }); };
// mouse events outside the viewport are lost: bring the drawing area (svg / canvas) into view first
const center = async loc => {
  await loc.evaluate(e => (e.closest('svg, canvas') || e).scrollIntoView({ block: 'center', behavior: 'instant' }));
  const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2];
};

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
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
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
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
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
  for (const w of [1280, 390]) { await testMaps(w); await testVariations(w); }
  await testBroken();
} catch (e) {
  console.log('  FAIL exception: ' + e.message.split('\n')[0]);
  failures++;
}
await browser.close();
server.close();
console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
process.exit(failures ? 1 : 0);
