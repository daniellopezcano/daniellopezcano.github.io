#!/usr/bin/env python3
"""Test driver for _port/convert/figures.py. Hand-written, part of the web port.

Builds the master roadmap and the variation figure of the Metric chapter with
Figures.tex, the Einstein-Hilbert flowchart with its boxes and without (D58: the
boxes file, the ten boxes inside the viewBox, the same SVG bytes either way), and every graphic in plots/ and plots/exercises/ with
Figures.graphic, into --out (default: a scratch directory under _port/.work/,
never notes/). Checks the outputs, prints a size table, then builds everything
a second time to check that the cache makes it a no-op. Exit status 0 = pass.

    python3 _port/tools/test_figures.py [--out DIR] [--preview] [--skip-graphics]

--preview also renders each TikZ SVG to PNG (Inkscape) next to it, to look at.
"""
from __future__ import annotations
import argparse
import collections
import glob
import os
import re
import subprocess
import sys
import time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, '_port', 'convert'))
from figures import Figures  # noqa: E402

SRC = os.path.join(REPO, '_port', '.work', 'tex', 'src')
NOTES = os.path.join(REPO, 'notes')


def balanced(s: str, i: int, op: str, cl: str) -> int:
    """Index just past the group of s that opens with s[i] == op."""
    assert s[i] == op
    depth = 0
    while i < len(s):
        c = s[i]
        if c == '\\':
            i += 2
            continue
        if c == op:
            depth += 1
        elif c == cl:
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    raise ValueError('unbalanced')


def strip_figure(body: str) -> str:
    """Remove the figure wrapper, \\centering, \\caption[..]{..} and \\label{..}."""
    body = re.sub(r'\\begin\{figure\}(\[[^\]]*\])?', '', body)
    body = body.replace('\\end{figure}', '').replace('\\centering', '')
    for cmd in ('\\caption', '\\label'):
        while True:
            i = body.find(cmd)
            if i < 0:
                break
            j = i + len(cmd)
            while body[j].isspace():
                j += 1
            if body[j] == '[':
                j = balanced(body, j, '[', ']')
                while body[j].isspace():
                    j += 1
            j = balanced(body, j, '{', '}')
            body = body[:i] + body[j:]
    return body


def figure_around(text: str, label: str) -> str:
    k = text.index('\\label{%s}' % label)
    a = text.rindex('\\begin{figure}', 0, k)
    b = text.index('\\end{figure}', k) + len('\\end{figure}')
    return text[a:b]


def expected_roadmap_refs(src: str) -> collections.Counter:
    c = collections.Counter()
    for line in src.splitlines():
        if line.lstrip().startswith('\\def'):
            continue
        line = line.split('%')[0]
        for m in re.finditer(r'\\(mch|msec|meq)\{([^}]+)\}', line):
            c[m.group(2)] += 1
        for m in re.finditer(r'\\mchs\{([^}]+)\}\{([^}]+)\}', line):
            c[m.group(1)] += 1
            c[m.group(2)] += 1
        for m in re.finditer(r'\\ref\*?\{([^}]+)\}', line):
            c[m.group(1)] += 1
    return c


def kb(n: int) -> str:
    return f'{n / 1000:.0f}k'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(REPO, '_port', '.work', 'test-figures'))
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--skip-graphics', action='store_true')
    args = ap.parse_args()
    out = os.path.abspath(args.out)
    if os.path.commonpath([out, NOTES]) == NOTES and '--out' not in sys.argv:
        print('refusing to write into notes/ without an explicit --out')
        return 2

    with open(os.path.join(SRC, 'main.tex'), encoding='utf-8') as f:
        main_tex = f.read()
    preamble = main_tex[:main_tex.index('\\begin{document}')]
    aux = os.path.join(SRC, 'main.aux')
    with open(aux, encoding='utf-8', errors='replace') as f:
        defined = set(re.findall(r'\\newlabel\{([^}]+)\}', f.read()))

    failures: list[str] = []

    def check(cond: bool, msg: str):
        if not cond:
            failures.append(msg)
            print('FAIL:', msg)

    def run(figs: Figures, skip_graphics: bool):
        results = {}
        with open(os.path.join(SRC, 'plots', 'roadmap_master.tex'), encoding='utf-8') as f:
            roadmap_src = f.read()
        with open(os.path.join(SRC, 'Chapters', 'Metric.tex'), encoding='utf-8') as f:
            metric_src = f.read()
        jobs = [
            ('roadmap_master', strip_figure(roadmap_src), 37.6, expected_roadmap_refs(strip_figure(roadmap_src))),
            ('fig_variation_curve', strip_figure(figure_around(metric_src, 'fig_variation_curve')), 16.0,
             collections.Counter()),
        ]
        for name, snippet, tw, refs in jobs:
            t = time.time()
            results[name] = (figs.tex(snippet, name, tw), refs, time.time() - t)
        # D58: the Einstein-Hilbert flowchart (Figure 10.3) with its boxes, and the same picture without them
        with open(os.path.join(SRC, 'Chapters', 'fig_eh_chain_rule.tex'), encoding='utf-8') as f:
            eh = f.read()
        eh = eh[:eh.index('\\end{tikzpicture}') + len('\\end{tikzpicture}')].replace('\\centering', '')
        for name, boxes in (('fig_EH_chain_rule', True), ('fig_EH_chain_rule_plain', False)):
            t = time.time()
            results[name] = (figs.tex(eh, name, 48.6, boxes=boxes), collections.Counter(), time.time() - t)
        if not skip_graphics:
            files = sorted(glob.glob(os.path.join(SRC, 'plots', '*.pdf'))) + \
                sorted(glob.glob(os.path.join(SRC, 'plots', 'exercises', '*.pdf'))) + \
                sorted(glob.glob(os.path.join(SRC, 'plots', '*.png'))) + \
                sorted(glob.glob(os.path.join(SRC, 'plots', '*.jpg')))
            for i, f in enumerate(files):
                rel = os.path.relpath(f, SRC)
                name = os.path.splitext(os.path.basename(f))[0]
                if rel.endswith('.pdf') and i % 2:   # exercise the lookup without extension too
                    rel = rel[:-4]
                t = time.time()
                results[name] = (figs.graphic(rel, name), None, time.time() - t)
        return results

    figs = Figures(REPO, preamble, aux, out_dir=out)
    res = run(figs, args.skip_graphics)

    # -- TikZ checks
    for name in ('roadmap_master', 'fig_variation_curve'):
        info, refs, dt = res[name]
        path = os.path.join(out, name + '.svg')
        check(os.path.exists(path), f'{name}: no SVG')
        svg = open(path, encoding='utf-8').read()
        check(svg.count('<svg') == 1 and svg.rstrip().endswith('</svg>'), f'{name}: malformed SVG')
        groups = re.findall(r"<g class='dg-xref' data-label='([^']*)'>(.*?)</g>", svg, re.S)
        got = collections.Counter(lbl for lbl, _ in groups)
        check(got == refs, f'{name}: xref labels {dict(got)} != expected {dict(refs)}')
        check(all(re.search(r'<(use|path)\b', inner) for _, inner in groups), f'{name}: empty xref group')
        undefined = sorted(set(got) - defined)
        check(not undefined, f'{name}: labels not in aux: {undefined}')
        check(0 < info['width_frac'] <= 1.02, f'{name}: width_frac {info["width_frac"]}')
        print(f'tex  {name:<28} {info["width"]}x{info["height"]}px  width_frac={info["width_frac"]}  '
              f'{kb(os.path.getsize(path))}  xrefs={sum(got.values())}  {dt:.1f}s')
        if args.preview:
            subprocess.run(['inkscape', '--export-type=png', '--export-width=1600', '--export-background=white',
                            f'--export-filename={os.path.join(out, name + ".preview.png")}', path],
                           check=True, capture_output=True)

    # -- D58: boxes of the flowchart
    info = res['fig_EH_chain_rule'][0]
    bpath = os.path.join(out, 'fig_EH_chain_rule.boxes.json')
    check(os.path.exists(bpath) and not os.path.exists(os.path.join(out, 'fig_EH_chain_rule_plain.boxes.json')),
          'boxes: fig_EH_chain_rule.boxes.json written, and no boxes file for the build without boxes')
    import json
    bj = json.load(open(bpath, encoding='utf-8')) if os.path.exists(bpath) else {}
    order = ['Sbox', 'Abox', 'Bbox', 'Cbox', 'Dbox', 'Hbox', 'Gbox', 'Fbox', 'Ebox', 'Xbox']
    check(list(bj.get('boxes', {})) == order and 'do not edit' in bj.get('_generated', '') and bj.get('figure') == 'fig_EH_chain_rule.svg',
          f'boxes: the ten top-level boxes in source order, with the generated header ({list(bj.get("boxes", {}))})')
    vb = bj.get('viewBox', [0, 0, 0, 0])
    check(all(vb[0] <= x and vb[1] <= y and x + w <= vb[0] + vb[2] and y + h <= vb[1] + vb[3] for x, y, w, h in bj.get('boxes', {}).values()),
          'boxes: every box inside the viewBox')
    eh_svg = open(os.path.join(out, 'fig_EH_chain_rule.svg'), 'rb').read()
    check(eh_svg == open(os.path.join(out, 'fig_EH_chain_rule_plain.svg'), 'rb').read(),
          'boxes: the SVG built with the typeout lines is byte-identical with the one built without them')
    check(info.get('boxes', {}).get('order') == order, 'boxes: returned with the asset (the converter checks the steps against them)')
    det = figs.stats.get('fig_EH_chain_rule', {}).get('boxes', {})
    if det:
        print('boxes fig_EH_chain_rule: ' + ', '.join(f'{k} {bj["boxes"][k][2]:.0f}x{bj["boxes"][k][3]:.0f} (frame {d["frame"][2]:+.2f}, '
                                                       f'heading {d["heading_glyphs"]} glyphs)' for k, d in det.items()))

    # -- graphics table
    total = 0
    if not args.skip_graphics:
        print(f'\n{"file":<52} {"pdf":>6} {"pdftocairo":>14} {"dvisvgm --pdf":>14} {"chosen":<15} {"final":>6}  size(px)')
        for name, (info, _, dt) in res.items():
            if name in ('roadmap_master', 'fig_variation_curve', 'fig_EH_chain_rule', 'fig_EH_chain_rule_plain'):
                continue
            path = os.path.join(out, os.path.basename(info['src']))
            check(os.path.exists(path), f'{name}: missing output {path}')
            n = os.path.getsize(path)
            total += n
            st = figs.stats.get(name, {})

            def tool(t):
                d = st.get(t)
                if not d:
                    return ''
                mark = {True: '', False: '!', None: ''}[d['ok']]
                return kb(d['bytes']) + mark + (f' ({d["mean_diff"]:.1f})' if 'mean_diff' in d else '')
            src_b = st.get('pdf_bytes', st.get('input_bytes', 0))
            chosen = f'{info["kind"]}' + (f' ({st["chosen_tool"]})' if 'chosen_tool' in st else '')
            print(f'{name:<52} {kb(src_b):>6} {tool("pdftocairo"):>14} {tool("dvisvgm"):>14} {chosen:<15} '
                  f'{kb(n):>6}  {info["width"]}x{info["height"]}')
            check(info['kind'] != 'svg' or n <= 400_000, f'{name}: SVG over 400 kB')
    tex_total = sum(os.path.getsize(os.path.join(out, n + '.svg')) for n in ('roadmap_master', 'fig_variation_curve'))
    print(f'\ntotal: graphics {kb(total)}, TikZ {kb(tex_total)}, all {kb(total + tex_total)}  (out: {out})')

    # -- second pass: everything from the cache, nothing rebuilt or rewritten
    mtimes = {p: os.stat(p).st_mtime_ns for p in glob.glob(os.path.join(out, '*'))}
    figs2 = Figures(REPO, preamble, aux, out_dir=out)
    res2 = run(figs2, args.skip_graphics)
    check(not figs2.log, f'cache: second pass rebuilt {figs2.log}')
    check(all(res2[k][0] == res[k][0] for k in res), 'cache: second pass returned different results')
    check(all(os.stat(p).st_mtime_ns == m for p, m in mtimes.items()), 'cache: second pass rewrote outputs')

    print('\nPASS' if not failures else f'\n{len(failures)} FAILURE(S)')
    return 0 if not failures else 1


if __name__ == '__main__':
    sys.exit(main())
