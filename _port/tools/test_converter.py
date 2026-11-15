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

        def tex(self, snippet, name, textwidth_cm):
            self.calls.append((snippet, name, textwidth_cm))
            return {'src': f'figures/{name}.svg', 'width': 1000, 'height': 1200, 'kind': 'svg', 'width_frac': 0.99}
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
    ctx.figures = real_figures

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

    print('ALL PASSED' if not FAIL else f'{len(FAIL)} FAILED')
    return 1 if FAIL else 0


if __name__ == '__main__':
    sys.exit(main())
