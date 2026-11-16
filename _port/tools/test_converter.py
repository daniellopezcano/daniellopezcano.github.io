#!/usr/bin/env python3
"""Direct tests of converter constructs that no converted page shows yet. Hand-written, part of the web port.

    python3 _port/tools/test_converter.py        # exit status 0 = pass

Reads the scratch LaTeX build (_port/.work/tex/src: sources, main.aux); writes nothing.
  * \\pageref (D47): the PDF's page number from main.aux, linked to the label's target like \\ref
    (class dg-xref), no words added; a missing label gives the "in preparation" marker (D17).
    Exercised on the notes' own use (Chapters/GR.tex, "page~\\pageref{fig_EH_chain_rule}").
  * \\renewcommand{\\arraystretch}{x}: prints nothing, sets Renderer.arraystretch for the tabular
    that follows, and ends with the enclosing environment or group as in TeX.
  * lists: \\setcounter{enumi}{n} inside an item (numbers from the LaTeX records, <li value>), and
    the forms that must still stop the page.
  * figure page (D50): a custompage holding one tikzpicture and \\captionof{figure} becomes a numbered figure
    whose snippet carries the page's local definitions in source order; its \\refs count for D38; the forms
    that must stop the page. (Typesetting is stubbed here; the real flowchart is built by build.py.)
  * tabular (D48): column specs of the three tables in the build (incl. the copyright page's, unit B4),
    rules, \\hline header, row spacing, \\arraystretch, display tabular as a block, refusals.
  * List of Figures and Bibliography (unit B5, D52): where main.tex places them (page order, course tree),
    main.lof parsed and compared with the converter's figures (a mismatch stops the page), the entries of
    main.bbl (accents, \\emph, \\url, --, \\penalty0, \\newblock, ids) and the forms that stop the page.
  * Definitions and notation (unit B35, D53), on a small source of its own: ids term-<k> on the term spans
    (markup only) and their sites, entries merged by text (one chip per page), alphabetical order with "Symbols"
    first, "used in" from \\ref / \\ref* / \\pageref (not \\eqref; not inside pictures, captions excepted), the Notation table found by the title rule, the links to
    the titles with "notation", the headings, and a term in a footnote stopping the page.
  * "steps" in interactives.json and the boxes of a TikZ figure (unit B32, D58): an entry with steps asks the figure
    pipeline for the figure's boxes and puts the steps on the frame (data-steps); a step that is not a box, malformed
    steps, steps with "at" or on a heading stop the build; figboxes.py on the flowchart's source (its top-level local
    bounding boxes), on small pictures (nesting, options, comments), the log lines, and a small dvisvgm-like SVG (the
    transform, the frame, the heading; a shifted box, a box outside the viewBox, no frame, a wrong transform stop it).
  * "at": "end" in interactives.json (unit B24, D57), on a small source of its own: the panel closes a subsection
    (before the next heading of its level, after its subsubsections and lists), or a section / subsection that runs
    to the end of the page (after its last block, footnotes kept apart; inner before outer); an entry without "at"
    stays right after its heading; "at" on a figure or subsubsection label, or a value other than "end", stops the build.
"""
from __future__ import annotations
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, '_port', 'convert'))
import build                                           # noqa: E402
import source                                          # noqa: E402
from texparse import Parser, ConvertError              # noqa: E402
from render import Renderer                            # noqa: E402

FAIL = []


def check(name: str, ok: bool, got=''):
    print(('ok    ' if ok else 'FAIL  ') + name + ('' if ok else f'\n      got: {got!r}'))
    if not ok:
        FAIL.append(name)


def main() -> int:
    src = source.load(build.SRC)
    aux = build.read_aux(os.path.join(build.SRC, 'main.aux'))
    ctx = build.Ctx(src, aux, {}, None)
    P = Parser(src.text)

    # -- \pageref, on the notes' own sentence --------------------------------------------
    lab = 'fig_EH_chain_rule'
    at = src.text.find('(page~\\pageref{' + lab + '})')
    check('the notes contain "(page~\\pageref{fig_EH_chain_rule})"', at != -1)
    if at == -1:
        return 1
    page = build.Page('section', at, at)
    page.slug = 'gr/einstein-hilbert'
    r = Renderer(ctx, page, P, {})
    snippet = '(page~\\pageref{' + lab + '})'
    html = r.inline(P.parse(at, at + len(snippet)))
    pre = html.split('\x02')[0]                       # "(page" and the no-break space of ~
    check('\\pageref leaves a pageref placeholder and records the label',
          html == f'{pre}\x02R|{lab}|pageref\x02)' and pre.startswith('(page') and r.refs == [lab], html)
    pdf_page = aux[lab]['page']
    check('main.aux gives the label a page number different from its figure number', pdf_page != aux[lab]['num'], aux[lab])
    where = {lab: ('gr/einstein-hilbert', lab)}
    same = build.resolve(html, page, ctx, where)
    check('same page: link to #label showing the PDF page',
          same == f'{pre}<a class="dg-xref" href="#{lab}" data-kind="figure" data-label="{lab}">{pdf_page}</a>)', same)
    other = build.Page('section', at, at)
    other.slug = 'proofs-and-additional-material/some-proof'
    far = build.resolve(html, other, ctx, where)
    check('other page: relative link to page#label showing the PDF page',
          far == f'{pre}<a class="dg-xref" href="../gr/einstein-hilbert.html#{lab}" data-kind="figure" '
                 f'data-label="{lab}">{pdf_page}</a>)', far)
    pend = build.resolve(html, page, ctx, {})
    check('target page not converted: unlinked PDF page number',
          pend == f'{pre}<span class="dg-xref dg-xref-pending" data-label="{lab}">{pdf_page}</span>)', pend)
    nol = build.resolve(build.nolinks(html), page, ctx, where)
    check('inside a link (nolinks): plain PDF page number', nol == f'{pre}{pdf_page})', nol)
    build.PLAIN_NUM[lab] = aux[lab]['num']
    build.PLAIN_NUM[(lab, 'page')] = pdf_page
    check('plain text (titles, search): PDF page number', build.plain(html) == f'{pre}{pdf_page})', build.plain(html))
    missing = build.resolve('\x02R|no_such_label|pageref\x02', page, ctx, where)
    check('missing label: "in preparation" marker (D17)', 'class="dg-inprep"' in missing and 'in preparation' in missing, missing)

    # -- \renewcommand{\arraystretch}{x} ------------------------------------------------------
    tex = ('\\begin{center}\n\\renewcommand{\\arraystretch}{1.3}\nA\n\\end{center}\nB '
           '{\\renewcommand{\\arraystretch}{2}C} D \\renewcommand\\arraystretch{1.5}E')
    Q = Parser(tex)
    r = Renderer(ctx, page, Q, {})
    seen = []
    orig_env = r.env

    def env(nd):
        out = orig_env(nd)
        seen.append(('in center', r.arraystretch))
        return out
    r.env = env
    nodes = Q.parse(0, len(tex))
    html = r.flow(nodes)
    check('arraystretch is set inside the environment', seen == [('in center', '1.3')], seen)
    check('arraystretch prints nothing', 'arraystretch' not in html and '1.3' not in html, html)
    check('arraystretch set by \\renewcommand\\arraystretch{x} at the top level stays', r.arraystretch == '1.5', r.arraystretch)
    r2 = Renderer(ctx, page, Q, {})
    r2.flow(Q.parse(0, tex.index(' D')))
    check('arraystretch ends with its environment and its group', r2.arraystretch is None, r2.arraystretch)
    for bad in ('\\renewcommand{\\baselinestretch}{1.3}', '\\renewcommand{\\arraystretch}{\\large}'):
        Q = Parser(bad)
        try:
            Renderer(ctx, page, Q, {}).flow(Q.parse(0, len(bad)))
            check(f'{bad} stops the page', False, 'no error')
        except ConvertError:
            check(f'{bad} stops the page', True)

    # -- lists: \setcounter{enumi} inside an item, a figure before the first \item ------------------
    def run(tex, records):
        Q = Parser(tex)
        rr = Renderer(ctx, page, Q, records)
        return rr, rr.flow(Q.parse(0, len(tex)))
    rr, html = run('\\begin{enumerate}\\item[1--2.] A \\setcounter{enumi}{2}\n\n\\item B\n\\item C\\end{enumerate}',
                   {'enumi': ['3', '4']})
    check('\\setcounter{enumi} in an item: dropped, next items carry the LaTeX numbers',
          'setcounter' not in html and '<li value="3">' in html and '<li value="4">' in html and not rr.rec['enumi'], html)
    for name, tex, records in (
            ('\\setcounter{enumi}{n} that disagrees with the LaTeX record',
             '\\begin{enumerate}\\item[1.] A \\setcounter{enumi}{5}\\item B\\end{enumerate}', {'enumi': ['2']}),
            ('labelled then plain items without \\setcounter (HTML would show 2, LaTeX printed 1)',
             '\\begin{enumerate}\\item[a.] A\\item B\\end{enumerate}', {'enumi': ['1']}),
            ('\\setcounter{enumii} in a nested item',
             '\\begin{enumerate}\\item A\\begin{enumerate}\\item[x] B \\setcounter{enumii}{2}\\item C\\end{enumerate}\\end{enumerate}',
             {'enumi': ['1']}),
            ('\\setcounter{footnote} in the text', 'Text \\setcounter{footnote}{3} more.', {}),
            ('an environment other than figure before the first \\item',
             '\\begin{itemize}\\begin{center}X\\end{center}\\item A\\end{itemize}', {}),
            ('an enumerate item with no numbering record', '\\begin{enumerate}\\item A\\end{enumerate}', {})):
        try:
            run(tex, records)
            check(f'{name} stops the page', False, 'no error')
        except ConvertError as e:
            check(f"{name} stops the page ({e.msg})", True)

    # -- figure page: custompage + tikzpicture + \captionof{figure} (D50) ---------------------------------
    class FakeFigures:
        def __init__(self):
            self.calls = []

        def tex(self, snippet, name, textwidth_cm, boxes=False):
            self.calls.append((snippet, name, textwidth_cm))
            self.boxes = boxes
            res = {'src': f'figures/{name}.svg', 'width': 1000, 'height': 1200, 'kind': 'svg', 'width_frac': 0.99}
            if boxes:
                res['boxes'] = {'viewBox': [0, 0, 100, 100], 'boxes': {'Abox': [1, 2, 3, 4], 'Bbox': [5, 6, 7, 8]}, 'order': ['Abox', 'Bbox']}
            return res
    real_figures, ctx.figures = ctx.figures, FakeFigures()
    pic = '\\begin{tikzpicture}\\node {$\\EHs$ \\ref{lab_in_pic}};\\end{tikzpicture}'
    fp = ('\\begin{custompage}[Head]{53cm}{67cm}{hmargin=2.2cm, top=2.6cm}\n'
          '\\def\\EHs{\\textrm{s}}\n\\def\\EHgo#1#2{\\coordinate (here) at (#1,#2);}\n\\colorlet{EHup}{color_blue_1}\n'
          '\\pgfdeclarelayer{EHback}\n\\pgfsetlayers{EHback,main}\n\n\\centering\n' + pic + '\n\n\\vspace{0.8cm}\n'
          '\\begin{minipage}{0.9\\linewidth}\n\\captionof{figure}[Short (\\S\\ref{lab_short})]{Long, see \\ref{lab_cap}.}\n'
          '\\label{fig_test_page}\n\\end{minipage}\n\\end{custompage}\nAfter \\ref{lab_after}.')
    rr, html = run(fp, {'figure': ['10.3']})
    snip, name, tw = ctx.figures.calls[0] if ctx.figures.calls else ('', '', 0)
    check('figure page: one numbered <figure> with the label as id, number from the records, caption',
          html.startswith('<figure class="dg-figure" id="fig_test_page">') and '<span class="dg-fignum">Figure 10.3:</span> Long, see' in html
          and 'alt="Figure 10.3"' in html and not rr.rec['figure'] and rr.anchors.get('fig_test_page') == 'fig_test_page', html)
    check('figure page: snippet = local definitions in source order, then the picture; text width of the custompage',
          snip == ('\\def\\EHs{\\textrm{s}}\n\\def\\EHgo#1#2{\\coordinate (here) at (#1,#2);}\n\\colorlet{EHup}{color_blue_1}\n'
                   '\\pgfdeclarelayer{EHback}\n\\pgfsetlayers{EHback,main}\n' + pic)
          and abs(tw - 48.6) < 1e-9 and name == 'fig-test-page', (snip, name, tw))
    check('figure page: \\refs in the picture and the caption are page references (D38); \\def ends with the custompage',
          {'lab_in_pic', 'lab_cap', 'lab_short', 'lab_after'} <= set(rr.refs) and rr.defs == [], (rr.refs, rr.defs))
    check('figure page: listed for the List of Figures with its short caption',
          ctx.figure_list[-1][0] == '10.3' and ctx.figure_list[-1][2] == 'fig_test_page' and 'Short' in ctx.figure_list[-1][3], ctx.figure_list[-1])
    for name, tex, records in (
            ('text inside a figure page', fp.replace('\\centering', 'Some words.'), {'figure': ['10.3']}),
            ('a second tikzpicture in a figure page', fp.replace('\\vspace{0.8cm}', pic), {'figure': ['10.3']}),
            ('a figure page without a tikzpicture', fp.replace(pic, ''), {'figure': ['10.3']}),
            ('\\colorlet outside a figure page', 'Text \\colorlet{a}{b} more.', {}),
            ('\\captionof outside a custompage', '\\begin{minipage}{5cm}\\captionof{figure}{X}\\end{minipage}', {'figure': ['1.1']})):
        try:
            run(tex, records)
            check(f'{name} stops the page', False, 'no error')
        except ConvertError as e:
            check(f"{name} stops the page ({e.msg})", True)
    check('figure page: built without boxes when no interactive steps through it (D58)', ctx.figures.boxes is False, ctx.figures.boxes)
    # D58: an entry with "steps" on the figure's label asks for its boxes; the steps go to the frame as data-steps
    saved = dict(ctx.interactives)
    ctx.interactives = {}
    ctx.load_interactives([{'label': 'fig_test_page', 'module': 'steps1', 'steps': ['Bbox', 'Abox']}])
    rr, html = run(fp, {'figure': ['10.3']})
    check('D58: a figure page whose label has "steps" is built with its boxes; the frame carries the steps in their order',
          ctx.figures.boxes is True and 'data-module="steps1" data-for="fig_test_page" data-steps="Bbox Abox"' in html, html[-400:])
    ctx.interactives = {}
    ctx.load_interactives([{'label': 'fig_test_page', 'module': 'steps1', 'steps': ['Abox', 'Cbox']}])
    try:
        run(fp, {'figure': ['10.3']})
        check('D58: a step that is not a box of the figure stops the page', False, 'no error')
    except ConvertError as e:
        check(f'D58: a step that is not a box of the figure stops the page ({e.msg[:80]}...)', 'Cbox' in e.msg)
    for bad, why in [({'label': 'x', 'module': 'm', 'steps': 'Abox'}, 'as a string instead of a list'),
                     ({'label': 'x', 'module': 'm', 'steps': []}, 'as an empty list'),
                     ({'label': 'x', 'module': 'm', 'steps': ['Abox', 'Abox']}, 'with a repeated name'),
                     ({'label': 'x', 'module': 'm', 'steps': ['Abox'], 'at': 'end'}, 'with "at"')]:
        try:
            ctx.load_interactives([bad])
            check(f'D58: "steps" {why} stops the build', False, 'no error')
        except SystemExit as e:
            check(f'D58: "steps" {why} stops the build', 'D58' in str(e), str(e))
    ctx.interactives = {'sec_x': [('m', None, None, ['Abox'])]}
    try:
        ctx.interactive('sec_x')
        check('D58: "steps" on a heading (no TikZ figure) stops the page', False, 'no error')
    except ConvertError as e:
        check(f'D58: "steps" on a heading (no TikZ figure) stops the page ({e.msg[:60]}...)', True)
    ctx.interactives = saved
    check('D58: the real entry asks for the boxes of fig_EH_chain_rule, and only of it',
          ctx.wants_boxes(['fig_EH_chain_rule']) and not ctx.wants_boxes(['fig_light_cones', 'fig_test_page']))
    ctx.figures = real_figures

    # -- figboxes (D58): the top-level local bounding boxes of the flowchart, the typeout lines, the log, the SVG ----
    import figboxes
    with open(os.path.join(build.SRC, 'Chapters', 'fig_eh_chain_rule.tex'), encoding='utf-8') as f:
        eh = f.read()
    names = figboxes.top_level(eh)
    check('figboxes: the flowchart\'s top-level boxes in source order (nested S1, B2, D3, D4, E2, E5 left out)',
          names == ['Sbox', 'Abox', 'Bbox', 'Cbox', 'Dbox', 'Hbox', 'Gbox', 'Fbox', 'Ebox', 'Xbox'], names)
    pic = ('\\begin{tikzpicture}[a/.style={x=1}]\\begin{scope}[local bounding box = P1, b={[x]}]'
           '\\begin{scope}[local bounding box=Q]\\end{scope}\\end{scope}\\begin{scope}[c]\\end{scope}'
           '% \\begin{scope}[local bounding box=Commented]\n\\begin{scope}[local bounding box=P2]\\end{scope}\\end{tikzpicture}')
    check('figboxes: options with braces and brackets, nesting, a scope without a box, comments',
          figboxes.top_level(pic) == ['P1', 'P2'], figboxes.top_level(pic))
    ins = figboxes.insert('\\tikz{\\end{tikzpicture}}' + pic, ['P1', 'P2'])
    check('figboxes: the typeout lines go right before the last \\end{tikzpicture}, one per box',
          ins.endswith('\\typeout{PORTBOX P2 \\PortBx\\space\\PortBy\\space\\PortBX\\space\\PortBY}\n\\end{tikzpicture}')
          and ins.count('PORTBOX') == 2 and ins.startswith('\\tikz{\\end{tikzpicture}}'), ins[-300:])
    got = figboxes.parse_log('x\nPORTBOX P1 0.0pt -10.5pt 20.0pt 0.0pt\nPORTBOX P2 1.0pt -2.0pt 3.0pt 4.0pt\n', ['P1', 'P2'])
    check('figboxes: corners read back from the log', got == {'P1': (0.0, -10.5, 20.0, 0.0), 'P2': (1.0, -2.0, 3.0, 4.0)}, got)
    try:
        figboxes.parse_log('PORTBOX P1 0.0pt -10.5pt 20.0pt 0.0pt\n', ['P1', 'P2'])
        check('figboxes: a box missing from the log stops the build', False, 'no error')
    except figboxes.BoxError as e:
        check(f'figboxes: a box missing from the log stops the build ({e})', True)
    # a dvisvgm-like SVG: the picture group maps pt to bp with y flipped; a frame 10 pt around a box (0,-40)-(200,0) pt,
    # and a heading of three glyphs at its top left
    a = 72 / 72.27
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='-12 -2 226 54'>"
           "<defs><path id='g1-1' d='M0 0V-6H4V0Z'/></defs><g id='page1'>"
           f"<g transform='matrix({a} 0 0 -{a} 1 10)'><path d='M-10 10H210V-50H-10Z'/>"
           f"<g transform='matrix({1 / a} 0 0 -{1 / a} 0 0)'><use x='3' y='8' xlink:href='#g1-1'/>"
           "<use x='9' y='8' xlink:href='#g1-1'/><use x='15' y='8.5' xlink:href='#g1-1'/>"
           "<use x='3' y='30' xlink:href='#g1-1'/></g></g></g></svg>")
    box = {'P': (0.0, -40.0, 200.0, 0.0)}
    res, det = figboxes.place(svg, box)
    want = [1.0, 10.0, round(200 * a, 3), round(40 * a, 3)]
    check('figboxes: a box in the SVG\'s user units through the picture group\'s transform; frame and heading found',
          res['boxes']['P'] == want and res['order'] == ['P'] and det['P']['heading_glyphs'] == 3, (res, det))
    for why, b2, svg2 in [('a box shifted off its heading', {'P': (6.0, -40.0, 206.0, 0.0)}, svg),
                          ('a box not inside the viewBox', box, svg.replace("viewBox='-12 -2 226 54'", "viewBox='0 0 100 54'")),
                          ('a box without a frame', box, svg.replace("<path d='M-10 10H210V-50H-10Z'/>", '')),
                          ('a picture group that is not pt -> bp', box, svg.replace(f'matrix({a} 0 0 -{a} 1 10)', 'matrix(1 0 0 -1 1 10)'))]:
        try:
            figboxes.place(svg2, b2)
            check(f'figboxes: {why} stops the build', False, 'no error')
        except figboxes.BoxError as e:
            check(f'figboxes: {why} stops the build ({str(e)[:70]})', True)

    # -- tabular (D48) ----------------------------------------------------------------
    import tables
    cols = tables.columns(r'@{}l@{\hspace{10pt}}p{\dimexpr\textwidth-3.25cm\relax}@{}', 16.0, 0)
    check('tabular spec @{}l@{\\hspace{10pt}}p{\\dimexpr..}@{}: no outer gap, 10pt between, p width = textwidth - 3.25cm',
          [round(c['pad_l'], 2) for c in cols] == [0, 0] and [round(c['pad_r'], 2) for c in cols] == [1.0, 0]
          and abs(cols[1]['width'] - 12.75 * tables.CM_EM) < 1e-6 and cols[1]['top'], cols)
    cols = tables.columns(r'c@{\hspace{1.5cm}}c', 16.0, 0)
    check('tabular spec c@{\\hspace{1.5cm}}c: the gap replaces both \\tabcolsep',
          abs(cols[0]['pad_r'] + cols[1]['pad_l'] - 1.5 * tables.CM_EM) < 1e-6 and cols[0]['pad_l'] == tables.TABCOLSEP_EM, cols)
    cols = tables.columns('|l|l|', 16.0, 0)
    check('tabular spec |l|l|: outer and inner rules', [(c['rule_l'], c['rule_r']) for c in cols] == [(True, True), (False, True)], cols)
    rr, html = run('\\begin{center}\\renewcommand{\\arraystretch}{1.3}\\begin{tabular}{l|c}\n A & $x$ \\\\ \\hline\n'
                   ' B & {C \\& D} \\\\[10pt] E & F \\\\\n\\hline\n\\end{tabular}\\end{center}', {})
    check('tabular: header row (followed by \\hline) as th, rules, spacing, \\arraystretch, escaped & kept in a cell',
          '<thead><tr><th scope="col" class="dg-rule-r" style="text-align:left;white-space:nowrap">A</th>' in html
          and '<tr class="dg-hline-above">' in html and 'dg-hline-below' in html and 'C &amp; D' in html
          and "--dg-strut-dp:1.00em" in html and '--dg-arraystretch:1.3' in html
          and rr.arraystretch is None, html)
    rr, html = run('Text: \\[ \\begin{tabular}{cc} \\textbf{a} & $y$ \\end{tabular} \\] more.', {})
    check('display tabular: a centred table that ends the paragraph, cells as text (math inline)',
          html.startswith('<p>Text:</p>\n<div class="dg-table-wrap dg-table-display">') and '<td style="text-align:center;white-space:nowrap"><strong>a</strong></td>' in html
          and '\\(y\\)' in html and html.endswith('<p>more.</p>'), html)
    for name, tex in (('a column type tables.py does not know', '\\begin{tabular}{lX}a&b\\end{tabular}'),
                      ('more cells than columns', '\\begin{tabular}{l}a&b\\end{tabular}'),
                      ('a tabular with a position argument', '\\begin{tabular}[t]{l}a\\end{tabular}'),
                      ('\\hline inside a row', '\\begin{tabular}{l}a \\hline b\\end{tabular}')):
        try:
            run(tex, {})
            check(f'{name} stops the page', False, 'no error')
        except ConvertError as e:
            check(f"{name} stops the page ({e.msg})", True)

    # -- front matter (unit B4, D51) -------------------------------------------------------
    cp_def = ('\\newcommand{\\cpheading}[1]{\\par\\noindent{\\color{color_blue_0}\\normalsize\\bfseries #1}\\enspace'
              '{\\color{color_blue_2}\\leaders\\vrule height 3.4pt depth -2.6pt\\hfill\\kern0pt}\\par\\vspace{5pt}}\n'
              '\\newcommand{\\grantbadge}[1]{\\tcbox[on line]{\\footnotesize\\bfseries\\textcolor{white}{\\##1}}}\n')
    rr, html = run(cp_def + '\\cpheading{Copyright \\& License}\n\nText \\grantbadge{2024/05768-9} and \\rule{3cm}{2pt}.', {})
    check('\\cpheading: an <h2> heading of the page (outline), id from its text; definitions print nothing',
          html.startswith('\x01H2|sec-copyright-license|<span class="dg-cp-heading">Copyright &amp; License</span>\x01')
          and 'newcommand' not in html and 'leaders' not in html, html)
    check('\\grantbadge prints # and its argument (as its definition does); \\rule a box of the given size in em',
          '<span class="dg-grant">#2024/05768-9</span>' in html
          and '<span class="dg-rule" style="width:8.54em;height:0.2em" aria-hidden="true"></span>' in html, html)
    rr, html = run('{\\footnotesize\\color{black!70}\n\\noindent One.\\par\\smallskip\n\\noindent\\textit{Dois.}\\par}', {})
    check('a block-level group with \\par\\smallskip: two paragraphs; black!70 = 70 % ink on the paper',
          html.count('<p>') == 2 and 'color-mix(in srgb, var(--dg-tex-black) 70%, var(--dg-bg))' in html
          and html.startswith('<div class="dg-sz-foot">'), html)
    rr, html = run('\\begin{tcolorbox}[enhanced, breakable=false, colback=color_blue_2!20, frame hidden,\n'
                   ' borderline west={2.5pt}{0pt}{color_blue_0}, arc=0pt, boxrule=0pt, left=9pt, right=8pt, top=6pt,'
                   ' bottom=6pt, fontupper=\\footnotesize, before skip=0pt, after skip=0pt]\nA\\par\\smallskip B\n\\end{tcolorbox}', {})
    check('tcolorbox: background, left border and font size from its options; layout keys print nothing',
          html.startswith('<div class="dg-tcb dg-sz-foot" style="background:color-mix(in srgb, var(--dg-color-blue-2) 20%, '
                          'var(--dg-bg));border-left:0.25em solid var(--dg-color-blue-0)">'), html)
    stop_def = ('\\newcommand{\\aboutstop}[4]{\\fill[white] (#1,0) circle (4pt);\\node at (#1,0.32) {#2};'
                '\\node at (#1,-0.32) {\\textbf{\\textcolor{color_blue_0}{#3}}\\\\[1pt]\\textcolor{black!65}{#4}};}\n')
    line = '\\draw[color_blue_2, line width=2.5pt, line cap=round] (1.55,0) -- (14.45,0);\n'
    tl = ('\\begin{tikzpicture}\n' + line + '\\aboutstop{1.55}{2015}{BSc in Physics}{Univ.\\ Aut\\\'onoma de Madrid}\n'
          '\\aboutstop{5.85}{2019}{MSc}{DIPC, Donostia \\& UAM}\n\\end{tikzpicture}')
    rr, html = run(stop_def + tl, {})
    check('timeline: an ordered list of the \\aboutstop calls in source order (years, role, place)',
          html == ('<ol class="dg-timeline"><li><span class="dg-tl-years">2015</span><span class="dg-tl-role">BSc in Physics</span>'
                   '<span class="dg-tl-place">Univ. Autónoma de Madrid</span></li><li><span class="dg-tl-years">2019</span>'
                   '<span class="dg-tl-role">MSc</span><span class="dg-tl-place">DIPC, Donostia &amp; UAM</span></li></ol>'), html)
    for name, tex in (('\\cpheading without its \\newcommand on the page', '\\cpheading{X}'),
                      ('\\grantbadge without its \\newcommand on the page', 'A \\grantbadge{1} B'),
                      ('\\newcommand of a macro the converter does not know', '\\newcommand{\\foo}[1]{#1}'),
                      ('\\grantbadge whose definition no longer prints \\#', cp_def.replace('\\##1', '#1') + '\\grantbadge{1}'),
                      ('a tcolorbox option with no handler', '\\begin{tcolorbox}[title=X]A\\end{tcolorbox}'),
                      ('a timeline picture with other content', stop_def + tl.replace(line, line + '\\node {X};\n')),
                      ('\\rule with a raise argument', '\\rule[2pt]{1cm}{1pt}')):
        try:
            run(tex, {})
            check(f'{name} stops the page', False, 'no error')
        except ConvertError as e:
            check(f"{name} stops the page ({e.msg})", True)
    front, pages = build.make_pages(src, P)
    fronts = build.front_pages(src, P, ctx, front)
    check('front matter: the copyright page (our title, web layer) and About the Author (title from its contents entry)',
          [(q.role, q.slug, q.title_html, q.web_title) for q in fronts]
          == [('copyright', 'copyright', 'Copyright, License and Funding', True),
              ('about', 'about-the-author', 'About the Author', False)], [(q.role, q.slug, q.title_html) for q in fronts])

    class CropFigures:
        def __init__(self):
            self.calls = []

        def image_size(self, path):
            return (6144, 6144) if 'background' in path else (640, 640)

        def crop(self, path, name, box, px, q):
            self.calls.append((name, box))
            return {'src': f'figures/{name}.webp', 'width': px, 'height': px, 'kind': 'webp'}
    import frontmatter
    real_figures, ctx.figures = ctx.figures, CropFigures()
    about = fronts[1]
    ra = Renderer(ctx, about, P, {})
    rest, head, foot = frontmatter.about(P.parse(about.a, about.b), ra, src.preamble)
    crops = dict(ctx.figures.calls)
    bl, bt, br, bb = crops.get('about-the-author-portrait', (0, 0, 0, 0))
    check('About: portrait cropped to the TikZ clip (circle r = 2.3 cm around the shifted 7.7 cm picture: '
          'about 382 px centred near (287, 290) of 640 px)',
          abs((bl + br) / 2 * 640 - 286.8) < 1 and abs((bt + bb) / 2 * 640 - 290.1) < 1 and abs((br - bl) * 640 - 382.3) < 1,
          (bl, bt, br, bb))
    bl, bt, br, bb = crops.get('about-the-author-background', (0, 0, 0, 0))
    check('About: background cropped to the band the PDF shows (34 % of the page height, image centred at 17 %)',
          (bl, br) == (0.0, 1.0) and abs(bt - 0.2596) < 1e-3 and abs(bb - 0.7404) < 1e-3, (bl, bt, br, bb))
    check('About: header with the notes\' words (title, name, affiliation), portrait alt = the name; links at the foot',
          '<h1 class="dg-about-kicker">About the Author</h1>' in head and '<p class="dg-about-name">Daniel López Cano</p>' in head
          and 'FAPESP Postdoctoral Fellow' in head and 'Institute of Physics, University of São Paulo' in head
          and 'alt="Daniel López Cano"' in head and 'alt=""' in head
          and 'href="https://daniellopezcano.github.io"' in foot and 'href="https://github.com/daniellopezcano"' in foot
          and not any(getattr(n, 'raw', '') and 'overlay' in n.raw for n in rest), (head, foot))
    ctx.figures = real_figures

    # -- List of Figures and Bibliography (unit B5, D52) ----------------------------------------
    lists = build.list_pages(src, front)
    check('main.tex places a List of Figures (front matter) and a Bibliography (back matter); titles are the book class\'s',
          [(q.role, q.kind, q.slug, q.title_html) for q in lists]
          == [('lof', 'front', 'list-of-figures', 'List of Figures'), ('bib', 'back', 'bibliography', 'Bibliography')],
          [(q.role, q.kind, q.slug, q.title_html) for q in lists])
    order = sorted(fronts + lists + pages, key=lambda q: q.a)
    for q in order:
        q.html = ''
    build.assign_slugs(pages, P, src)
    slugs = [q.slug for q in order]
    check('page order (previous/next): copyright, List of Figures, About the Author, Chapter 1 ... C.9, Bibliography (last)',
          slugs[:4] == ['copyright', 'list-of-figures', 'about-the-author', 'introduction/index']
          and slugs[-2:] == ['examples/example-schwarzschild', 'bibliography'], slugs[:4] + slugs[-2:])
    import re as _re
    tree = build.course_tree(order[-1], order, [])
    group = _re.search(r'<ol class="dg-tree-list dg-tree-matter">(.*?)</ol>', tree)
    check('course tree: the front and back matter group, in the notes\' order',
          group is not None and _re.findall(r'>([^<>]+)</a>', group.group(1))
          == ['Copyright, License and Funding', 'List of Figures', 'About the Author', 'Bibliography'], tree[-600:])
    dpage = build.Page('back', len(src.text), len(src.text))
    dpage.role, dpage.slug, dpage.title_html, dpage.html = 'defs', build.DEFS_SLUG, build.DEFS_TITLE, ''
    tree = build.course_tree(order[-1], order + [dpage], [])
    group = _re.search(r'<ol class="dg-tree-list dg-tree-matter">(.*?)</ol>', tree)
    check('course tree: Definitions and notation (D53) ends the group, after the Bibliography',
          group is not None and _re.findall(r'>([^<>]+)</a>', group.group(1))[-2:] == ['Bibliography', 'Definitions and notation'],
          tree[-600:])
    for q in order:
        q.html = None

    lof_text = open(os.path.join(build.SRC, 'main.lof'), encoding='utf-8').read()
    lof = build.parse_lof(lof_text)
    check('main.lof: numbers in order, a gap at each chapter change (none before the first entry)',
          lof[0][:1] == ('1.1',) and not lof[0][2] and [n for n, _, g in lof if g][:3] == ['2.1', '3.1', '4.1']
          and '10.3' in [n for n, _, _ in lof] and not any(g for n, _, g in lof if n in ('1.2', '4.2', 'C.19')), lof[:6])
    lofp = lists[0]
    figs = [(n, 'some/page', f'fig-{n}', f'Caption {n} (\\S\x02R|section_Spacetime|ref\x02)') for n, _, _ in lof]
    ctx.figure_list = list(figs)
    build.render_lof(lofp, ctx, lof)
    h = lofp.html
    check('List of Figures: one entry per figure, the number a reference-style link (dg-xref, figure) beside the caption, '
          'whose references stay separate links',
          h.startswith('<ol class="dg-lof"><li><span class="dg-lof-num"><a class="dg-xref" href="\x02U|some/page#fig-1.1\x02" '
                       'data-kind="figure">1.1</a></span> <span class="dg-lof-cap">Caption 1.1 (\\S\x02R|section_Spacetime|ref\x02)</span></li>')
          and h.count('<li') == len(lof) and h.count('class="dg-lof-gap"') == sum(g for _, _, g in lof), h[:300])
    for name, fl in (('two figures in another order', figs[:1] + [figs[2], figs[1]] + figs[3:]),
                     ('a figure missing', figs[:-1]), ('an extra figure', figs + [('C.20', 'x', 'fig-x', 'x')]),
                     ('a different number', [('1.9',) + figs[0][1:]] + figs[1:])):
        ctx.figure_list = list(fl)
        try:
            build.render_lof(lofp, ctx, lof)
            check(f'List of Figures vs main.lof, {name}: stops the page', False, 'no error')
        except ConvertError as e:
            check(f'List of Figures vs main.lof, {name}: stops the page ({e.msg[:90]}...)', e.msg.startswith('main.lof:'), e.msg)
    try:
        build.parse_lof(lof_text + '\\contentsline {table}{\\numberline {1.1}{\\ignorespaces T}}{3}{table.1}%\n')
        check('main.lof with a line of another form stops the page', False, 'no error')
    except ConvertError as e:
        check(f'main.lof with a line of another form stops the page ({e.msg[:60]}...)', e.msg.startswith('main.lof:'), e.msg)
    ctx.figure_list = []

    bbl = os.path.join(build.SRC, 'main.bbl')
    ctx.bib = build.read_bbl(bbl)
    bibp = lists[1]
    build.render_bib(bibp, ctx, bbl)
    h = bibp.html
    ids = _re.findall(r'<li id="bib-([^"]+)">', h)
    check('Bibliography: one entry per \\bibitem, in the .bbl\'s order, id bib-<key>', ids == list(ctx.bib) and len(ids) == 6, ids)
    entry = lambda k: _re.search(rf'<li id="bib-{k}">(.*?)</li>', h).group(1)
    # ~: what typo() makes of every ~ of the notes (today a plain space, see the B5 report), so either is accepted here
    sp = lambda t: t.replace('\u00a0', ' ')
    check('Bibliography: accents ({\\\'\\i}, {\\\'a}), \\emph, ~ as a space, \\newblock as one space',
          entry('Ortin_2004') == 'Tomás Ortín. <em>Gravity and Strings</em>. Cambridge Monographs on Mathematical Physics. '
                                 'Cambridge University Press, Cambridge, 2004.'
          and sp(entry('Landau_Lifshitz_1975')).startswith('L. D. Landau and E. M. Lifshitz. <em>The Classical Theory of Fields</em>, '
                                                           'volume 2 of <em>Course of Theoretical Physics</em>.'), (entry('Ortin_2004'), entry('Landau_Lifshitz_1975')))
    check('Bibliography: -- an en dash, \\penalty0 a break opportunity, {Hamiltonian} its word',
          entry('Regge_Teitelboim_1974') == 'Tullio Regge and Claudio Teitelboim. Role of surface integrals in the Hamiltonian '
                                            'formulation of general relativity. <em>Annals of Physics</em>, 88:<wbr>286–318, 1974.',
          entry('Regge_Teitelboim_1974'))
    check('Bibliography: \\url a link whose text is the URL as printed (typewriter)',
          entry('IWSGL').endswith('<a href="https://www.youtube.com/watch?v=7G4SqIboeig&amp;list=PLFeEvEPtX_0S6vxxiiNPrJbLu9aK1UVC_&amp;index=1">'
                                  '<code class="dg-code">https://www.youtube.com/watch?v=7G4SqIboeig&amp;list=PLFeEvEPtX_0S6vxxiiNPrJbLu9aK1UVC_&amp;index=1'
                                  '</code></a>, Feb 2015.') and sp(entry('IWSGL')).startswith('Frederic P Schuller. A thorough'), entry('IWSGL'))
    keep = ctx.bib['Poisson_2004']['entry_tex']
    for name, tex, want in (('a command it does not know', keep + ' \\doi{10.1/x}', 'main.bbl:'),
                            ('\\penalty other than 0', keep.replace('Cambridge,', 'Cambridge,\\penalty10000'), 'main.bbl:')):
        ctx.bib['Poisson_2004']['entry_tex'] = tex
        try:
            build.render_bib(bibp, ctx, bbl)
            check(f'Bibliography entry with {name} stops the page', False, 'no error')
        except ConvertError as e:
            check(f'Bibliography entry with {name} stops the page ({e.msg})', e.msg.startswith(want), e.msg)
    ctx.bib['Poisson_2004']['entry_tex'] = keep
    line = ctx.bib['Poisson_2004']['line']
    check('main.bbl line of an entry is where its text starts',
          open(bbl, encoding='utf-8').read().split('\n')[line - 1].startswith('Eric Poisson.'), line)

    # -- Definitions and notation (unit B35, D53) ----------------------------------------------------
    import types
    T = ('\\chapter{Ch}\\label{chapter_X}\n'
         '\\section{Alpha}\\label{section_A}\nAn \\blueone{Basis} here.\n'
         '\\subsection{{Notation}}\\label{nt_A}\nA \\greentwo{$\\mathbb{R}$-vector space} and '
         '\\begin{tabular}{c|c} $x$ & y \\\\ \\hline a & \\redone{b} \\end{tabular}\n'
         '\\subsection{Other}\nAn \\purpleone{atlas} and \\begin{tabular}{c} z \\end{tabular}\n'
         '\\section{Beta and more notation}\\label{section_B}\nThe \\blueone{basis}, see \\ref{nt_A}. Again \\blueone{Basis}.\n'
         '\\subsection{Notations used}\\label{nt_B}\nA \\redone{(multi-)linear} map, \\eqref{section_A}.\n'
         '\\section{Gamma}\\label{section_C}\nAs in \\ref*{nt_A} and \\pageref{section_A}; \\blueone{ basis } and '
         '\\oliveone{$ C^\\infty $-compatible}.\n')
    tctx = build.Ctx(types.SimpleNamespace(text=T, where=lambda pos: f'test:{pos}'), {}, {}, None)
    TP = Parser(T)
    tch = build.Page('chapter', 0, T.index('\\section{Alpha}'))
    tch.number, tch.slug, tch.title_html = '2', 'ch/index', 'Ch'
    cuts = [T.index(x) for x in ('\\section{Alpha}', '\\section{Beta', '\\section{Gamma}')] + [len(T)]
    tpages = []
    for (a, b), num, sub in zip(zip(cuts, cuts[1:]), ('2.1', '2.2', '2.3'), (['2.1.1', '2.1.2'], ['2.2.1'], [])):
        q = build.Page('section', a, b)
        q.parent, q.slug = tch, f'ch/s{num[-1]}'
        q.label = build.LABEL_AFTER.match(T, T.index('}', a) + 1).group(1)
        build.render_page(q, tctx, TP, {'section': [num], 'subsection': list(sub)})
        tpages.append(q)
    tch.html = ''
    s1, s2, s3 = tpages
    ids = _re.findall(r'<span class="dg-term dg-term-(\w+)" id="(term-\d+)">', s1.html)
    check('D53: every term span of a page gets id term-<k>, k in the order of the page (table cells included)',
          ids == [('blue', 'term-1'), ('green2', 'term-2'), ('red', 'term-3'), ('purple', 'term-4')], ids)
    check('D53: only markup is added (the page without the ids is the page as before)',
          _re.sub(r' id="term-\d+"', '', s1.html).count('class="dg-term') == 4
          and build.text_of(s1.html) == build.text_of(_re.sub(r' id="term-\d+"', '', s1.html)), s1.html[:200])
    check('D53: the site of a term is its labelled \\subsection, else the page\'s label',
          [t['site'] for t in s1.terms] == ['section_A', 'nt_A', 'nt_A', 'section_A'] and [t['site'] for t in s2.terms] == ['section_B', 'section_B', 'nt_B'],
          ([t['site'] for t in s1.terms], [t['site'] for t in s2.terms]))
    parts = lambda h: build._term_parts(h)
    check('D53: one entry per term text: case-insensitive, whitespace collapsed, formulas by their source without spaces',
          build.term_key(parts('Basis')) == build.term_key(parts(' basis ')) == 'basis'
          and build.term_key(parts('<span class="math inline">\\( C^\\infty \\)</span>-compatible'))
          == build.term_key(parts('<span class="math inline">\\(C^\\infty\\)</span>-compatible'))
          and build.term_key(parts('<span class="math inline">\\(M\\)</span>')) != build.term_key(parts('<span class="math inline">\\(m\\)</span>')))
    names = ['Basis', 'atlas', '(multi-)linear', '<span class="math inline">\\(\\mathbb{R}\\)</span>-vector space',
             'chart map', 'Charts', '(smooth) <span class="math inline">\\((r,s)\\)</span>-tensor field',
             '<span class="math inline">\\((0,2)\\)</span>-tensor', 'smooth atlas', 'Élan']
    got = [n for n in sorted(names, key=lambda n: build.term_sort(parts(n)))]
    check('D53: alphabetical by letters (TeX, case and leading brackets ignored), formulas first under Symbols',
          got == [names[7], names[3], names[1], names[0], names[4], names[5], names[9], names[2], names[8], names[6]]
          and [build.term_sort(parts(n))[0] for n in got][:3] == ['', '', 'A'] and build.term_sort(parts('Élan'))[0] == 'E', got)
    dp = build.Page('back', len(T), len(T))
    dp.role, dp.slug = 'defs', build.DEFS_SLUG
    build.render_defs(dp, tctx, [tch] + tpages)
    h = dp.html
    tables = _re.findall(r'<div class="dg-defs-table">.*?</table></div></div>', h, _re.S)
    check('D53: Notation = the tables of a (sub)section titled "Notation", labelled with its number and title, ids removed',
          len(tables) == 1 and '<a href="\x02U|ch/s1#nt_A\x02"><span class="dg-secnum">2.1.1</span> Notation</a>' in tables[0]
          and '>y</th>' in tables[0] and ' z ' not in tables[0] and 'z</td>' not in tables[0] and ' id=' not in tables[0], tables)
    links = _re.search(r'<ul class="dg-web dg-defs-links">(.*?)</ul>', h)
    check('D53: then links to every section and subsection whose title contains "notation", in the notes\' order',
          links is not None and _re.findall(r'href="\x02U\|([^\x02]+)\x02"', links.group(1)) == ['ch/s1#nt_A', 'ch/s2', 'ch/s2#nt_B'],
          links and links.group(1))
    entry = lambda word: next((li for li in _re.findall(r'<li><span class="dg-term.*?</li>', h)
                               if _re.sub(r'<[^>]+>', '', li.split('<span class="dg-defs-at">')[0]).strip().casefold() == word), '')
    b = entry('basis')
    chips = lambda s, kind: _re.findall(rf'href="\x02U\|([^\x02]+)\x02" data-kind="{kind}" title="[^"]*">([^<]+)</a>', s)
    check('D53: occurrences merged (Basis, basis, " basis "), one chip per page (twice on 2.2: one chip, to the first), '
          'its page number linked to #term-<k>, first spelling shown',
          b.startswith('<li><span class="dg-term dg-term-blue">Basis</span>')
          and chips(b, 'term') == [('ch/s1#term-1', '2.1'), ('ch/s2#term-1', '2.2'), ('ch/s3#term-1', '2.3')], b)
    used = lambda li: chips(li.split('dg-defs-used')[1], 'page') if 'dg-defs-used' in li else []
    rv = entry('$\\mathbb{r}$-vector space') or next(li for li in _re.findall(r'<li><span class="dg-term.*?</li>', h) if '-vector space' in li)
    check('D53: "used in" = the other section pages that \\ref / \\ref* a site (here \\subsection nt_A), in the notes\' order',
          '<span class="dg-web">used in</span>' in rv and used(rv) == [('ch/s2', '2.2'), ('ch/s3', '2.3')], rv)
    check('D53: "used in" counts \\pageref, not \\eqref; duplicates merged over the occurrences of an entry; never the page itself',
          used(b) == [('ch/s3', '2.3')] and used(entry('atlas')) == [('ch/s3', '2.3')], (used(b), used(entry('atlas'))))
    check('D53: a site that no page refers to shows no "used in"',
          entry('(multi-)linear') and 'dg-defs-used' not in entry('(multi-)linear'), entry('(multi-)linear'))
    heads = _re.findall('\x01H(\\d)\\|([^|]*)\\|<span class="dg-web dg-defs-head">([^<]*)</span>\x01', h)
    check('D53: headings Notation, Defined terms, Symbols, then the letters that occur (web layer)',
          heads == [('2', 'dg-notation', 'Notation'), ('2', 'dg-terms', 'Defined terms'), ('3', 'dg-terms-symbols', 'Symbols'),
                    ('3', 'dg-terms-a', 'A'), ('3', 'dg-terms-b', 'B'), ('3', 'dg-terms-m', 'M')], heads)
    check('D53: Symbols holds the entries that start with a formula',
          h.index('dg-terms-symbols') < h.index('-compatible') < h.index('-vector space', h.index('dg-terms-symbols')) < h.index('dg-terms-a'),
          h[h.index('dg-terms-symbols'):][:600])
    s3.footnotes = [('1', 'a <span class="dg-term dg-term-blue">term</span>')]
    try:
        build.render_defs(dp, tctx, [tch] + tpages)
        check('D53: a term in a footnote stops the definitions page', False, 'no error')
    except ConvertError as e:
        check(f'D53: a term in a footnote stops the definitions page ({e.msg[:70]}...)', True)
    s3.footnotes = []
    pic = ('A \\ref{x1}. \\begin{figure}[H]\\centering\\figbox\\gA{\\ref{x3}}\\begin{tikzpicture}\\node {\\ref{x2}};'
           '\\begin{tikzpicture}\\node{\\ref{x9}};\\end{tikzpicture}\\end{tikzpicture}'
           '\\caption[short \\ref{x4}]{Long \\ref*{x5}.}\\label{f}\\end{figure} '
           '\\begin{tikzpicture}\\node{\\pageref{x6}};\\end{tikzpicture} B \\pageref{x7} \\eqref{x8} '
           '\\begin{custompage}\\begin{tikzpicture}\\node{\\ref{x10}};\\end{tikzpicture}\\captionof{figure}[s]{C \\ref{x11}}\\end{custompage}')
    got = build.used_refs(pic, 0, len(pic), Parser(pic))
    check('D53: "used in" ignores references inside a picture (figure body, saved boxes, tikzpicture, nested) but not in a '
          'caption (\\caption, its short form, \\captionof)', got == {'x1', 'x4', 'x5', 'x7', 'x11'}, sorted(got))

    # -- a panel that closes a (sub)section: "at": "end" in interactives.json (unit B24, D57) ---------------------
    T = ('\\section{Alpha}\\label{section_A}\nFirst paragraph.\n'
         '\\subsection{One}\\label{sub_1}\nInside one.\n'
         '\\subsubsection{Deeper}\\label{subsub_1}\nStill one\\footnote{A note.}.\n'
         '\\begin{itemize}\\item last item of one\\end{itemize}\n'
         '\\subsection{Two}\\label{sub_2}\nInside two.\n'
         '\\begin{itemize}\\item last item of the page\\end{itemize}\n')
    taux = {'section_A': {'num': '2.1', 'page': '1', 'kind': 'section'}, 'sub_1': {'num': '2.1.1', 'page': '1', 'kind': 'subsection'},
            'sub_2': {'num': '2.1.2', 'page': '1', 'kind': 'subsection'}, 'subsub_1': {'num': '2.1.1.1', 'page': '1', 'kind': 'subsubsection'},
            'fig_A': {'num': '2.1', 'page': '1', 'kind': 'figure'}}

    def at_end_page(entries):
        c = build.Ctx(types.SimpleNamespace(text=T, where=lambda pos: f'test:{pos}'), taux, {}, None)
        c.interactives = {}
        c.load_interactives(entries)
        q = build.Page('section', 0, len(T))
        q.slug, q.label = 'ch/s1', 'section_A'
        build.render_page(q, c, Parser(T), {'section': ['2.1'], 'subsection': ['2.1.1', '2.1.2'],
                                            'subsubsection': ['2.1.1.1'], 'footnote': ['1']})
        return q, c
    frame = lambda mod, lab: f'<div class="dg-web dg-interactive" role="group" data-module="{mod}" data-for="{lab}" '
    q, c = at_end_page([{'label': 'sub_1', 'at': 'end', 'module': 'm1'}, {'label': 'sub_2', 'module': 'm2'}])
    h = q.html
    i1, i2 = h.find(frame('m1', 'sub_1')), h.find('\x01H2|sub_2|')
    check('D57: "at": "end" on a subsection followed by another: after its last block (its subsubsection and list '
          'included), right before the next heading of the same level',
          h.count('dg-interactive"') == 2 and h.rfind('last item of one', 0, i1) != -1 and h.find('</ul>', h.find('last item of one')) < i1
          and h[i1:i2].endswith('<div class="dg-interactive-body"></div></div>') and h.find('\x01H3|subsub_1|') < i1 < i2, h)
    check('D57: an entry without "at" is still placed right after its heading (D15)',
          h.find('\x01', h.find('\x01H2|sub_2|') + 1) + 1 == h.find(frame('m2', 'sub_2')), h[i2:i2 + 200])
    check('D57: both panels count as placed', c.interactives_used == {('sub_1', 'm1'), ('sub_2', 'm2')}, c.interactives_used)
    q, c = at_end_page([{'label': 'section_A', 'at': 'end', 'module': 'm3'}, {'label': 'sub_2', 'at': 'end', 'module': 'm4'}])
    h = q.html
    i4, i3 = h.find(frame('m4', 'sub_2')), h.find(frame('m3', 'section_A'))
    check('D57: a section and a subsection that run to the end of the page: both panels after its last list, at the end '
          'of the page\'s text (the footnotes are kept apart; write_page puts them and previous/next after it)',
          h.find('</ul>', h.find('last item of the page')) < i4 and h.endswith('<div class="dg-interactive-body"></div></div>') and h.count('dg-interactive"') == 2
          and h[h.find('</ul>', h.find('last item of the page')) + 5:].strip().startswith(frame('m4', 'sub_2'))
          and q.footnotes and 'A note.' not in h, h[-700:])
    check('D57: where both close at the same point the subsection\'s panel comes first (inner before outer)', -1 < i4 < i3, (i4, i3))
    for bad, why in [({'label': 'fig_A', 'at': 'end', 'module': 'm5'}, 'on a figure label'),
                     ({'label': 'subsub_1', 'at': 'end', 'module': 'm5'}, 'on a subsubsection label'),
                     ({'label': 'sub_1', 'at': 'start', 'module': 'm5'}, 'with another value ("start")')]:
        try:
            at_end_page([bad])
            check(f'D57: "at" {why} stops the build', False, 'no error')
        except SystemExit as e:
            check(f'D57: "at" {why} stops the build ({str(e)[:90]}...)', 'D57' in str(e))

    print('ALL PASSED' if not FAIL else f'{len(FAIL)} FAILED')
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
