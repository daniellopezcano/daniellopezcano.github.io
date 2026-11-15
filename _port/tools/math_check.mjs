#!/usr/bin/env node
// Build-time math check: typesets every distinct equation the course pages carry
// (the `math` array of _port/.work/report.json, written by _port/convert/build.py)
// with a math engine in Node, using the tex configuration of the browser
// (read from notes/diffgeo-gr/assets/mathjax-config.js, never duplicated here).
//
//   node _port/tools/math_check.mjs [--engine mathjax3|mathjax4|katex|all] [--json FILE] [--report FILE]
//   (--json writes the grouped failures; --report reads another {math: [{page, tex}]} file)
//
// An expression fails when the engine throws or its output carries an error node
// (MathJax: merror / data-mjx-error; KaTeX: throwOnError with strict 'ignore').
// Exit code 1 when mathjax3 (the engine the pages load) has failures.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const PORT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(PORT, '..');
const DEFAULT_REPORT = path.join(PORT, '.work', 'report.json');
const CONFIG = path.join(REPO, 'notes', 'diffgeo-gr', 'assets', 'mathjax-config.js');
const require = createRequire(path.join(PORT, 'package.json'));
const ENGINES = ['mathjax3', 'mathjax4', 'katex'];
const DEFAULT_ENGINE = 'mathjax3';

// ---------------------------------------------------------------- inputs

/** The browser configuration, evaluated as the classic script it is. */
function browserConfig() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(CONFIG, 'utf8'), sandbox, { filename: CONFIG });
  const cfg = sandbox.window.MathJax;
  if (!cfg || !cfg.tex) throw new Error(`${CONFIG} does not define window.MathJax.tex`);
  return cfg;
}

/** Packages listed under tex.packages['[+]'] (or a plain array). */
function addedPackages(tex) {
  const p = tex.packages || [];
  return Array.isArray(p) ? p : (p['[+]'] || []);
}

/** Distinct expressions -> { tex, math, display, pages } */
function expressions(report) {
  if (!fs.existsSync(report)) {
    console.error(`missing ${report}: run python3 _port/convert/build.py --no-figures first`);
    process.exit(2);
  }
  const byTex = new Map();
  for (const { page, tex } of JSON.parse(fs.readFileSync(report, 'utf8')).math) {
    if (!byTex.has(tex)) byTex.set(tex, new Set());
    byTex.get(tex).add(page);
  }
  return [...byTex].map(([tex, pages]) => ({ tex, ...strip(tex), pages: [...pages].sort() }));
}

/** What the browser's TeX finder hands to the engine for this page string. */
function strip(tex) {
  const t = tex.trim();
  if (t.startsWith('\\(') && t.endsWith('\\)')) return { math: t.slice(2, -2), display: false };
  if (t.startsWith('\\[') && t.endsWith('\\]')) return { math: t.slice(2, -2), display: true };
  if (/^\\begin\{[^}]+\}/.test(t)) return { math: t, display: true };  // processEnvironments
  throw new Error(`unrecognised math delimiters: ${tex.slice(0, 80)}`);
}

// ---------------------------------------------------------------- engines

/** tex-chtml-full enables 'require' + AllPackages, then the config's '[+]' list.
 *  Left out: 'require' (\require needs the browser's component loader; the notes never
 *  use it) and 'noundefined', which in the browser turns an undefined macro into red
 *  text instead of an error node and so would hide it from this check. */
function mathjax3Packages(AllPackages, tex) {
  return [...new Set([...AllPackages, ...addedPackages(tex)])].filter((p) => p !== 'noundefined');
}

function texOptions(tex, packages) {
  // Only the options that change parsing; the delimiters were already stripped.
  const opts = { packages, macros: tex.macros || {} };
  for (const k of ['tags', 'environments', 'textmacros', 'mathtools', 'tagformat', 'colorV2']) {
    if (k in tex) opts[k] = tex[k];
  }
  return opts;
}

async function runMathjax3(items, cfg) {
  const { mathjax } = require('mathjax-full/js/mathjax.js');
  const { TeX } = require('mathjax-full/js/input/tex.js');
  const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
  const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
  const { SerializedMmlVisitor } = require('mathjax-full/js/core/MmlTree/SerializedMmlVisitor.js');
  const { STATE } = require('mathjax-full/js/core/MathItem.js');
  const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');
  const { CHTML } = require('mathjax-full/js/output/chtml.js');
  const version = require('mathjax-full/package.json').version;

  RegisterHTMLHandler(liteAdaptor());
  const input = new TeX(texOptions(cfg.tex, mathjax3Packages(AllPackages, cfg.tex)));
  // An output jax is attached (bussproofs insists on one) but never run: STATE.CONVERT
  // stops after the TeX -> MathML step, which is where every TeX error arises.
  const doc = mathjax.document('', { InputJax: input, OutputJax: new CHTML(cfg.chtml || {}) });
  const visitor = new SerializedMmlVisitor();
  const results = items.map((it) => {
    try {
      const mml = visitor.visitTree(doc.convert(it.math, { display: it.display, end: STATE.CONVERT }));
      return { item: it, error: mmlError(mml), output: mml };
    } catch (e) {
      return { item: it, error: String(e.message || e) };
    }
  });
  return { engine: `mathjax3 (mathjax-full ${version})`, results };
}

async function runMathjax4(items, cfg) {
  const version = require('mathjax/package.json').version;
  const { default: MathJax } = await import(require.resolve('mathjax'));
  const added = addedPackages(cfg.tex);
  const warn = console.warn;  // the loader warns that bundled extensions carry no version
  console.warn = (...a) => { if (!/No version information/.test(String(a[0]))) warn(...a); };
  await MathJax.init({
    loader: { load: ['input/tex', 'adaptors/liteDOM', ...added.map((p) => `[tex]/${p}`)] },
    tex: texOptions(cfg.tex, { '[+]': added, '[-]': ['noundefined'] }),
    startup: { typeset: false },
  });
  console.warn = warn;
  const results = [];
  for (const it of items) {
    try {
      const mml = await MathJax.tex2mmlPromise(it.math, { display: it.display });
      results.push({ item: it, error: mmlError(mml), output: mml });
    } catch (e) {
      results.push({ item: it, error: String(e.message || e) });
    }
  }
  return { engine: `mathjax4 (mathjax ${version}, input/tex + autoload)`, results };
}

/** KaTeX has no packages; the config's macros are translated where KaTeX can express
 *  them (it has no optional arguments with defaults, so such macros become their head). */
function katexMacros(tex) {
  const out = {};
  for (const [name, def] of Object.entries(tex.macros || {})) {
    if (typeof def === 'string') out['\\' + name] = def;
    else if (def.length >= 3) out['\\' + name] = def[0].match(/^\\[A-Za-z]+/)?.[0] ?? def[0];
    else out['\\' + name] = def[0];
  }
  return out;
}

async function runKatex(items, cfg) {
  const katex = require('katex');
  const macros = katexMacros(cfg.tex);
  const results = items.map((it) => {
    try {
      const output = katex.renderToString(it.math, {
        displayMode: it.display, throwOnError: true, strict: 'ignore', trust: true,
        macros: { ...macros },
      });
      return { item: it, error: null, output };
    } catch (e) {
      return { item: it, error: String(e.message || e).replace(/^KaTeX parse error: /, '') };
    }
  });
  return { engine: `katex ${katex.version}`, results };
}

/** First error message in serialized MathML, or null. */
function mmlError(mml) {
  if (!/<merror|data-mjx-error/.test(mml)) return null;
  const m = mml.match(/data-mjx-error="([^"]*)"/) || mml.match(/title="([^"]*)"/);
  return m ? decode(m[1]) : 'merror node';
}

function decode(s) {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

const RUNNERS = { mathjax3: runMathjax3, mathjax4: runMathjax4, katex: runKatex };

// ---------------------------------------------------------------- report

/** Error messages grouped into classes: KaTeX appends positions and context. */
function errorClass(msg) {
  return msg.replace(/ at position \d+:.*$/s, '').replace(/\s+/g, ' ').trim();
}

function summarise({ engine, results }) {
  const failures = results.filter((r) => r.error);
  const groups = new Map();
  for (const r of failures) {
    const k = errorClass(r.error);
    if (!groups.has(k)) groups.set(k, { message: k, count: 0, example: r.item.tex, pages: new Set() });
    const g = groups.get(k);
    g.count += 1;
    r.item.pages.forEach((p) => g.pages.add(p));
  }
  const classes = [...groups.values()].sort((a, b) => b.count - a.count)
    .map((g) => ({ ...g, pages: [...g.pages].sort() }));
  return { engine, expressions: results.length, failures: failures.length, classes };
}

function print(s) {
  console.log(`${s.engine}: ${s.expressions} expressions, ${s.failures} failures`);
  for (const c of s.classes) {
    console.log(`  [${c.count}] ${c.message}`);
    console.log(`      e.g. ${c.example.length > 200 ? c.example.slice(0, 200) + ' ...' : c.example}`);
    console.log(`      pages: ${c.pages.join(', ')}`);
  }
}

// ---------------------------------------------------------------- main

function parseArgs(argv) {
  const args = { engine: DEFAULT_ENGINE, json: null, report: DEFAULT_REPORT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--engine') args.engine = argv[++i];
    else if (a.startsWith('--engine=')) args.engine = a.slice(9);
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--report') args.report = path.resolve(argv[++i]);
    else if (a === '-h' || a === '--help') {
      console.log('usage: node _port/tools/math_check.mjs [--engine mathjax3|mathjax4|katex|all] [--json FILE] [--report FILE]');
      process.exit(0);
    } else { console.error(`unknown argument ${a}`); process.exit(2); }
  }
  if (args.engine !== 'all' && !ENGINES.includes(args.engine)) {
    console.error(`unknown engine ${args.engine}`); process.exit(2);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const cfg = browserConfig();
const items = expressions(args.report);
// mathjax4 runs last: it installs a global MathJax that mathjax-full would otherwise see.
const engines = args.engine === 'all' ? ENGINES : [args.engine];
const summaries = {};
for (const name of engines) {
  const s = summarise(await RUNNERS[name](items, cfg));
  summaries[name] = s;
  print(s);
}
if (args.json) fs.writeFileSync(args.json, JSON.stringify(summaries, null, 1));

const main = summaries[DEFAULT_ENGINE];
if (main) {
  if (main.failures > 0) process.exit(1);
  console.log(`MATH CHECK PASSED (${main.expressions} expressions)`);
}
