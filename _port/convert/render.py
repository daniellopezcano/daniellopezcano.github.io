"""Render parsed LaTeX nodes to HTML. Hand-written, part of the web port.

One Renderer per page chunk. It never rewords anything: text nodes are emitted
as they are (TeX ligatures -- `` '' --- ~ are mapped to the characters the PDF
shows), math is emitted as the exact source (see `math()` for the four
documented rewrites), and every numbered object takes its number from the
records of the instrumented LaTeX build (numbering.py), never from a counter
of our own.

Placeholders left in the output and resolved by build.py once all pages exist:
    \\x02R|<label>|<style>\\x02   cross reference   (style: ref | eqref | pageref)
    \\x02U|<slug>#<frag>\\x02      URL of another course page, made relative
Headings inside a page are emitted as  \\x01H<level>|<id>|<html>\\x01  so that
build.py can find them: it writes them as <h2>/<h3> elements and builds the
page outline (course tree) and the search index (one entry per section) from them.
"""
from __future__ import annotations
import html
import re
import unicodedata
from texparse import Parser, ConvertError, Text, Par, Math, Cmd, Env, Group
import tables

TERM_COLOURS = ('blue', 'green', 'purple', 'orange', 'red', 'yellow', 'brown', 'teal', 'rose', 'olive', 'indigo')

# declarations -> CSS class (None = no visible effect on the web)
DECL = {'itshape': 'dg-it', 'bfseries': 'dg-bf', 'scshape': 'dg-sc', 'sffamily': 'dg-sf', 'ttfamily': 'dg-tt',
        'normalfont': None, 'tiny': 'dg-sz-tiny', 'scriptsize': 'dg-sz-script', 'footnotesize': 'dg-sz-foot',
        'small': 'dg-sz-small', 'normalsize': None, 'large': 'dg-sz-large', 'Large': 'dg-sz-Large',
        'LARGE': 'dg-sz-LARGE', 'huge': 'dg-sz-huge', 'Huge': 'dg-sz-Huge', 'centering': 'dg-center'}
WRAP = {'textbf': ('<strong>', '</strong>'), 'textit': ('<em>', '</em>'), 'emph': ('<em>', '</em>'),
        'texttt': ('<code class="dg-code">', '</code>'), 'textrm': ('<span class="dg-rm">', '</span>'),
        'textsf': ('<span class="dg-sf">', '</span>'), 'textsc': ('<span class="dg-sc">', '</span>'),
        'textup': ('<span class="dg-up">', '</span>'), 'underline': ('<u>', '</u>'), 'mbox': ('<span class="dg-nowrap">', '</span>')}
SYMBOL = {'S': '§', 'dots': '…', 'ldots': '…', 'textbullet': '•', 'textcopyright': '©', 'textperiodcentered': '·',
          'checkmark': '✓', 'textbackslash': '\\', 'LaTeX': 'LaTeX', 'TeX': 'TeX',
          'i': 'i', 'j': 'j',
          ',': '\u2009', ';': '\u2005', ':': '\u2005', '!': '', ' ': ' ', '\n': ' ', '&': '&amp;', '%': '%', '#': '#',
          '_': '_', '$': '$', '{': '{', '}': '}', '-': '\u00ad', '/': '', '@': '',
          'quad': '\u2003', 'qquad': '\u2003\u2003', 'enspace': '\u2002', 'noindent': '', 'hfill': '<span class="dg-hfill"></span>'}
ACCENT = {"'": '\u0301', '`': '\u0300', '^': '\u0302', '"': '\u0308', '~': '\u0303', '=': '\u0304', '.': '\u0307',
          'c': '\u0327', 'v': '\u030c', 'u': '\u0306', 'H': '\u030b', 'k': '\u0328', 'r': '\u030a'}
PRINT_ONLY = {'vspace', 'newpage', 'clearpage', 'thispagestyle', 'pagestyle', 'par', 'appendix',
              'addcontentsline', 'bibliographystyle', 'begingroup', 'endgroup', 'phantomsection', 'markboth'}
# Page-local macros of the front matter (unit B4, D51): accepted only after their \newcommand on the same page,
# and only if that definition still has the shape the handler renders (LOCAL_SHAPE: what the body must contain)
LOCAL_SHAPE = {'cpheading': (r'\bfseries #1}', r'\leaders\vrule'),
               'grantbadge': (r'\tcbox', r'\##1'),
               'aboutstop': (r'{#2}', r'{#3}}', r'{#4}}')}
# tcolorbox options (unit B4): keys that only lay the box out in the PDF; the others are rendered or stop the page
TCB_LAYOUT = {'enhanced', 'breakable', 'frame hidden', 'arc', 'boxrule', 'left', 'right', 'top', 'bottom',
              'before skip', 'after skip'}
SKIPS = {'medskip': 'dg-medskip', 'smallskip': 'dg-smallskip', 'bigskip': 'dg-bigskip'}
HEAD_LEVEL = {'subsection': 2, 'subsubsection': 3}
NUMBERED_MATH = {'equation', 'align', 'gather', 'multline', 'alignat', 'flalign'}

_WS = re.compile(r'[^\S\u00a0]+')     # any whitespace but the no-break space of ~ (D9): it must survive
_REF_IN_MATH = re.compile(r'\\(eqref|ref)\*?\s*\{([^}]+)\}')
_LABEL = re.compile(r'\\label\s*\{([^}]+)\}')
_TIKZ_REF = re.compile(r'\\ref\*?\s*\{([^}]+)\}')


def is_display_tabular(nd) -> bool:
    """\\[ \\begin{tabular}..\\end{tabular} \\]: rendered as a table, not as a formula (D48)."""
    return (isinstance(nd, Math) and nd.kind == 'display'
            and re.fullmatch(r'\s*\\begin\{tabular\}.*\\end\{tabular\}\s*', nd.src, re.S) is not None)


def esc(s: str) -> str:
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def typo(s: str) -> str:
    """TeX input conventions -> the characters the PDF shows. Runs of white space become one space; a
    no-break space (U+00A0, what the parser makes of ~) is kept as it is (D9)."""
    s = _WS.sub(' ', s)
    s = s.replace('---', '—').replace('--', '–').replace('``', '“').replace("''", '”')
    return s.replace('`', '‘').replace("'", '’')


def slugify(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def _captionof(nd) -> bool:
    """A \\captionof at the top level of a custompage's body or of a minipage in it (D50)."""
    if isinstance(nd, Cmd):
        return nd.name == 'captionof'
    return isinstance(nd, Env) and nd.name == 'minipage' and any(_captionof(c) for c in nd.body)


class Renderer:
    def __init__(self, ctx, page, parser: Parser, records: dict):
        self.ctx = ctx                  # build context: labels (aux), bib, figures, review log, where()
        self.page = page
        self.P = parser
        self.rec = records              # counter -> list of numbers for this chunk (consumed in order)
        self.footnotes: list[tuple[str, str]] = []
        self.anchors: dict[str, str] = {}     # label -> fragment id on this page
        self.refs: list[str] = []             # every label this page refers to (ref and eqref: text, math, captions)
        self.math_log: list[str] = []         # every math string emitted (for the math check)
        self.enum_depth = 0
        self.item_depth = 0
        self.textwidth_cm = 16.0              # A4 minus 2 x 25 mm; changed inside custompage
        self.fn_counter = 0 if page.kind == 'chapter' else None
        self.macros: dict[str, str] = {}      # \edef'ed numbers (footnote marks used inside math)
        self.defs: list[str] = []             # in-body \def lines, needed by later TikZ pictures
        self.arraystretch = None              # \renewcommand{\arraystretch}{x} in force (None = LaTeX's 1); for tabular
        self.local: dict[str, str] = {}       # page-local \newcommand bodies (front matter, LOCAL_SHAPE)

    # -- numbering ---------------------------------------------------------------
    def take(self, counter: str, pos: int) -> str:
        q = self.rec.get(counter)
        if not q:
            raise ConvertError(f'no numbering record left for counter "{counter}" '
                               f'(LaTeX build and converter disagree)', pos)
        return q.pop(0)

    # -- block level ---------------------------------------------------------------
    def flow(self, nodes: list) -> str:
        out, buf = [], []

        def flush():
            h = ''.join(buf).strip()
            buf.clear()
            if h:
                out.append('<p>' + h + '</p>')

        i, n = 0, len(nodes)
        while i < n:
            nd = nodes[i]
            i += 1
            if isinstance(nd, Par):
                flush()
            elif isinstance(nd, Math) and is_display_tabular(nd):
                flush()                           # a table is a block: it ends the paragraph's <p> (D48)
                out.append(self.math(nd))
            elif isinstance(nd, Env):
                flush()
                stretch = self.arraystretch       # a definition made inside an environment ends with it (TeX group)
                out.append(self.env(nd))
                self.arraystretch = stretch
            elif isinstance(nd, Cmd) and nd.name in DECL:
                flush()
                rest = self.flow(nodes[i:])
                out.append(f'<div class="{DECL[nd.name]}">{rest}</div>' if DECL[nd.name] else rest)
                break
            elif isinstance(nd, Cmd) and nd.name == 'color':
                flush()
                out.append(f'<div style="color:{self.colour(nd.args[0], nd.pos)}">{self.flow(nodes[i:])}</div>')
                break
            elif isinstance(nd, Cmd) and nd.name in SKIPS:
                flush()
                out.append(f'<div class="dg-skip {SKIPS[nd.name]}"></div>')
            elif isinstance(nd, Cmd) and nd.name in HEAD_LEVEL:
                flush()
                labels = []
                while i < n and (isinstance(nodes[i], Cmd) and nodes[i].name == 'label'
                                 or isinstance(nodes[i], Text) and not nodes[i].s.strip()):
                    if isinstance(nodes[i], Cmd):
                        labels.append(nodes[i].args[0])
                    i += 1
                out.append(self.heading(nd, labels))
            elif isinstance(nd, Cmd) and nd.name == 'cpheading':
                flush()
                out.append(self.cpheading(nd))
            elif isinstance(nd, Group) and self.block_group(nd):
                flush()                           # {\footnotesize ... \par\smallskip ... \par}: paragraphs inside
                stretch = self.arraystretch
                out.append(self.flow(nd.body))
                self.arraystretch = stretch
            elif isinstance(nd, Cmd) and nd.name == 'tcblower':
                flush()
                out.append('\x03LOWER\x03')
            elif isinstance(nd, Cmd) and nd.name == 'footnotetext':
                buf.append(self.footnotetext(nd))
            else:
                buf.append(self.inline_node(nd))
        flush()
        return '\n'.join(out)

    @staticmethod
    def block_group(nd: Group) -> bool:
        """A brace group at block level that holds paragraph breaks or vertical skips (front matter)."""
        return any(isinstance(c, Par) or isinstance(c, Env) or isinstance(c, Cmd) and (c.name in SKIPS or c.name == 'par')
                   for c in nd.body)

    def local_macro(self, name: str, pos: int) -> str:
        if name not in self.local:
            raise ConvertError(f'\\{name} without its page-local \\newcommand before it on this page', pos)
        return self.local[name]

    def cpheading(self, nd: Cmd) -> str:
        """\\cpheading{title} of the copyright page: a bold navy heading followed by a light-blue rule to the
        margin (its definition, checked by LOCAL_SHAPE). On the web: an <h2> of the page, rule drawn by CSS."""
        self.local_macro('cpheading', nd.pos)
        title = self.inline(nd.args[0])
        hid = 'sec-' + slugify(html.unescape(re.sub(r'<[^>]+>', '', title)))
        return f'\x01H2|{hid}|<span class="dg-cp-heading">{title}</span>\x01'

    def heading(self, nd: Cmd, labels: list[str]) -> str:
        level = HEAD_LEVEL[nd.name]
        title = self.inline(nd.args[1])
        if nd.star:
            hid = labels[0] if labels else 'sec-' + slugify(re.sub(r'<[^>]+>|\x02[^\x02]*\x02', '', title))
            html = title
        else:
            num = self.take(nd.name, nd.pos)
            hid = labels[0] if labels else 'sec-' + num.replace('.', '-')
            html = f'<span class="dg-secnum">{num}</span> {title}'
        for lab in labels:
            self.anchors[lab] = hid
        extra = ''.join(f'<span class="dg-anchor" id="{esc(l)}"></span>' for l in labels[1:])
        return f'\x01H{level}|{hid}|{html}{extra}\x01' + ''.join(self.ctx.interactive(l) for l in labels)

    def env(self, nd: Env) -> str:
        name = nd.name
        if name in ('itemize', 'enumerate'):
            return self.list(nd)
        if name == 'figure':
            return self.figure(nd)
        if name == 'tikzpicture':
            return self.diagram(nd)
        if name == 'tabular':                       # a real HTML table (D48)
            return tables.tabular(self, nd.pos, nd.pos + len(nd.raw), nd.pos)
        if name == 'center':
            return f'<div class="dg-center">{self.flow(nd.body)}</div>'
        if name == 'quote':
            return f'<blockquote class="dg-quote">{self.flow(nd.body)}</blockquote>'
        if name in ('flushleft', 'flushright', 'minipage'):
            return f'<div class="dg-{name}">{self.flow(nd.body)}</div>'
        if name == 'motivationbox':
            upper, _, lower = self.flow(nd.body).partition('\x03LOWER\x03')
            low = f'<div class="dg-motivation-lower">{lower}</div>' if lower else ''
            return (f'<div class="dg-motivation"><div class="dg-motivation-title">Motivation: '
                    f'{self.inline(nd.args[0])}</div><div class="dg-motivation-upper">{upper}</div>{low}</div>')
        if name == 'tcolorbox':
            return self.tcolorbox(nd)
        if name == 'custompage':
            # a page of its own size in the PDF: only its text width matters here (figures scale to it)
            old = self.textwidth_cm
            w = re.match(r'\s*([\d.]+)cm', nd.args[1])
            hm = re.search(r'hmargin=([\d.]+)cm', nd.args[3])
            if not (w and hm):
                raise ConvertError('custompage: cannot read the paper width / hmargin', nd.pos)
            self.textwidth_cm = float(w.group(1)) - 2 * float(hm.group(1))
            defs = list(self.defs)                  # an environment is a group: its \def's end with it
            try:
                if any(_captionof(c) for c in nd.body):
                    return self.figure_page(nd)
                return self.flow(nd.body)
            finally:
                self.textwidth_cm = old
                self.defs = defs
        raise ConvertError(f'environment {name}: no handler yet', nd.pos)

    def tcolorbox(self, nd: Env) -> str:
        """A tcolorbox (the MIT licence box of the copyright page): background, a left border line and the
        font size of its options are rendered; layout-only keys (TCB_LAYOUT) print nothing; any other key stops."""
        opts = nd.args[0] or ''
        style, cls = [], ''
        for key, val in self.keyvals(opts, nd.pos):
            if key in TCB_LAYOUT:
                continue
            if key == 'colback':
                style.append(f'background:{self.colour(val, nd.pos)}')
            elif key == 'borderline west':
                m = re.fullmatch(r'\{([\d.]+)pt\}\{([\d.]+)pt\}\{([^{}]+)\}', val)
                if not m or float(m.group(2)) != 0:
                    raise ConvertError(f'tcolorbox: borderline west={val}: no handler for this form', nd.pos)
                style.append(f'border-left:{float(m.group(1)) * 0.1:.3g}em solid {self.colour(m.group(3), nd.pos)}')
            elif key == 'fontupper':
                m = re.fullmatch(r'\\([A-Za-z]+)', val)
                if not m or m.group(1) not in DECL or not DECL[m.group(1)]:
                    raise ConvertError(f'tcolorbox: fontupper={val}: no handler', nd.pos)
                cls = ' ' + DECL[m.group(1)]
            else:
                raise ConvertError(f'tcolorbox: option "{key}" has no handler yet', nd.pos)
        st = f' style="{";".join(style)}"' if style else ''
        return f'<div class="dg-tcb{cls}"{st}>{self.flow(nd.body)}</div>'

    @staticmethod
    def keyvals(opts: str, pos: int) -> list:
        """A pgfkeys option list -> [(key, value)], split at top-level commas."""
        out, depth, cur = [], 0, ''
        for ch in opts + ',':
            if ch == ',' and depth == 0:
                if cur.strip():
                    k, _, v = cur.partition('=')
                    out.append((' '.join(k.split()), v.strip()))
                cur = ''
                continue
            depth += (ch == '{') - (ch == '}')
            cur += ch
        if depth:
            raise ConvertError(f'unbalanced braces in options [{opts}]', pos)
        return out

    def list(self, nd: Env) -> str:
        if nd.args[0] is not None:
            raise ConvertError(f'{nd.name} with an optional argument: no handler yet', nd.pos)
        ordered = nd.name == 'enumerate'
        items, cur, start, floats = [], None, None, []
        for c in nd.body:
            if isinstance(c, Cmd) and c.name == 'item':
                cur = (c, [])
                items.append(cur)
            elif cur is not None:
                cur[1].append(c)
            elif isinstance(c, Cmd) and c.name == 'setcounter' and c.args[0].strip() in ('enumi', 'enumii', 'enumiii'):
                start = int(c.args[1]) + 1
            elif isinstance(c, Env) and c.name == 'figure':
                floats.append(c)        # a float written before the first \item: emitted right before the list
            elif not (isinstance(c, (Text, Par)) and (isinstance(c, Par) or not c.s.strip())):
                raise ConvertError(f'content before the first \\item in {nd.name}', c.pos)
        lead = ''.join(self.figure(f) + '\n' for f in floats)
        if ordered:
            self.enum_depth += 1
            depth = self.enum_depth
        else:
            self.item_depth += 1
            depth = self.item_depth
        # Item numbers of a first-level enumerate are LaTeX's (main.port, counter enumi): every unlabelled
        # \item takes its record, in source order. The HTML list numbers its <li> itself (a labelled
        # <li class="dg-labelled"> counts too, LaTeX's \item[..] does not), so each record is checked against
        # the number the HTML shows; after a \setcounter{enumi}{n} inside an item's body (dropped, it prints
        # nothing) the following items carry the LaTeX number explicitly (<li value>).
        numbered = ordered and depth == 1
        ordinal = start or 1            # the number the HTML list gives its next <li>
        explicit, expect = False, None
        lis = []
        for it, body in items:
            num = self.take('enumi', it.pos) if numbered and it.args[0] is None else None
            body, reset = self.item_setcounter(body, numbered)
            if it.args[0] is not None:
                lab = f'<span class="dg-item-label">{self.inline(it.args[0])}</span> '
                lis.append(f'<li class="dg-labelled">{lab}{self.flow(body)}</li>')
            else:
                val = ''
                if num is not None:
                    if expect is not None and num != str(expect):
                        raise ConvertError(f'\\item after \\setcounter{{enumi}}{{{expect - 1}}}, but LaTeX numbered it {num}', it.pos)
                    expect = None
                    if explicit:
                        val = f' value="{num}"'
                    elif num != str(ordinal):
                        raise ConvertError(f'\\item numbered {num} by LaTeX, but the HTML list would show {ordinal}', it.pos)
                lis.append(f'<li{val}>{self.flow(body)}</li>')
            ordinal += 1
            if reset is not None:
                explicit, expect = True, reset + 1
        if ordered:
            self.enum_depth -= 1
        else:
            self.item_depth -= 1
        tag = 'ol' if ordered else 'ul'
        st = f' start="{start}"' if start else ''
        return lead + f'<{tag} class="dg-{nd.name} dg-depth-{depth}"{st}>\n' + '\n'.join(lis) + f'\n</{tag}>'

    def item_setcounter(self, body: list, numbered: bool):
        """A \\setcounter{enumi}{n} at the top level of an item's body (first-level enumerate only):
        removed from the body; returns (body, n). Any other \\setcounter stays and stops the page."""
        reset, out = None, []
        for c in body:
            if numbered and isinstance(c, Cmd) and c.name == 'setcounter' and c.args[0].strip() == 'enumi':
                if reset is not None or not c.args[1].strip().isdigit():
                    raise ConvertError(f'\\setcounter{{enumi}}{{{c.args[1]}}} inside an item: no handler for this form', c.pos)
                reset = int(c.args[1])
            else:
                out.append(c)
        return out, reset

    # -- figures -------------------------------------------------------------------
    def figure(self, nd: Env) -> str:
        raw = nd.raw
        base = nd.pos
        m = re.match(r'\\begin\{figure\}\s*(\[[^\]]*\])?', raw)
        a, b = m.end(), raw.rindex('\\end{figure}')
        body = raw[a:b]
        cap = body.find('\\caption')
        if cap == -1:
            raise ConvertError('figure without \\caption: no handler yet', nd.pos)
        args, cap_end = self.P.read_args('Om', base + a + cap + len('\\caption'), base + b, nd.pos)
        cap_end -= base + a
        rest = body[:cap] + body[cap_end:]
        labels = _LABEL.findall(rest)
        rest = _LABEL.sub('', rest)
        rest = re.sub(r'\\centering|\\begin\{center\}|\\end\{center\}|\\vspace\*?\{[^}]*\}', '', rest).strip()
        num = self.take('figure', nd.pos)
        fid = labels[0] if labels else 'fig-' + num.replace('.', '-')
        g = re.fullmatch(r'\\includegraphics\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}', rest)
        if g:
            asset = self.ctx.figures.graphic(g.group(2).strip(), slugify(fid))
            frac = self.width_frac(g.group(1) or '', nd.pos)
        else:
            snippet = '\n'.join(self.defs + [rest])
            asset = self.tikz(snippet, slugify(fid), self.textwidth_cm, boxes=self.ctx.wants_boxes(labels))
            frac = min(1.0, asset.get('width_frac', 1.0))
        return self.figure_html(num, fid, labels, args, asset, frac)

    def figure_page(self, nd: Env) -> str:
        """A custompage that is one TikZ figure captioned with \\captionof{figure} (the Einstein-Hilbert
        flowchart of section 10.2; D50). Its local definitions (\\def, \\colorlet, PGF layers, in source order)
        and its tikzpicture are typeset as one snippet, as a figure environment's body is; the caption and
        label make it a numbered figure. \\centering and \\vspace print nothing on the web (D9); the minipage
        around the caption only sets its width in the PDF. Any other content stops the page."""
        pre, labels = [], []
        found = {'pic': None, 'cap': None}

        def walk(nodes, in_mini):
            for c in nodes:
                if isinstance(c, Par) or (isinstance(c, Text) and not c.s.strip()):
                    continue
                if isinstance(c, Cmd) and c.name in ('centering', 'vspace'):
                    continue
                if isinstance(c, Cmd) and c.name == 'def' and not in_mini:
                    pre.append(f'\\def{c.args[0]}{{{c.args[1]}}}')
                elif isinstance(c, Cmd) and c.name == 'colorlet' and not in_mini:
                    pre.append(f'\\colorlet{{{c.args[0]}}}{{{c.args[1]}}}')
                elif isinstance(c, Cmd) and c.name in ('pgfdeclarelayer', 'pgfsetlayers') and not in_mini:
                    pre.append(f'\\{c.name}{{{c.args[0]}}}')
                elif isinstance(c, Env) and c.name == 'tikzpicture' and not in_mini and found['pic'] is None:
                    found['pic'] = c
                elif isinstance(c, Env) and c.name == 'minipage' and not in_mini:
                    walk(c.body, True)
                elif (isinstance(c, Cmd) and c.name == 'captionof' and c.args[0].strip() == 'figure'
                      and found['cap'] is None):
                    found['cap'] = c
                elif isinstance(c, Cmd) and c.name == 'label' and found['cap'] is not None:
                    labels.append(c.args[0].strip())
                else:
                    raise ConvertError('figure page (custompage with \\captionof{figure}): no handler for this content', c.pos)

        walk(nd.body, False)
        pic, cap = found['pic'], found['cap']
        if pic is None:
            raise ConvertError('figure page (custompage with \\captionof{figure}) without a tikzpicture', nd.pos)
        num = self.take('figure', cap.pos)
        fid = labels[0] if labels else 'fig-' + num.replace('.', '-')
        snippet = '\n'.join(self.defs + pre + [pic.raw])
        asset = self.tikz(snippet, slugify(fid), self.textwidth_cm, boxes=self.ctx.wants_boxes(labels))
        frac = min(1.0, asset.get('width_frac', 1.0))
        return self.figure_html(num, fid, labels, cap.args[1:], asset, frac)

    def tikz(self, snippet: str, name: str, textwidth_cm: float, boxes: bool = False) -> dict:
        """A TikZ figure body as an SVG (D10). Its \\ref's are references of this page like those of the
        text (they become links in the SVG), so the chapter opening pages count them (D38). boxes: also its named
        regions (D58), for an interactive that steps through them."""
        self.refs.extend(m.strip() for m in _TIKZ_REF.findall(snippet))
        return self.ctx.figures.tex(snippet, name, textwidth_cm, boxes=boxes)

    def figure_html(self, num: str, fid: str, labels: list[str], args: list, asset: dict, frac: float) -> str:
        """The <figure> of a numbered figure: `args` are the caption's [short] and {long} nodes."""
        for lab in labels:
            self.anchors[lab] = fid
        extra = ''.join(f'<span class="dg-anchor" id="{esc(l)}"></span>' for l in labels[1:])
        caption = self.inline(args[1])
        short = self.inline(args[0]) if args[0] is not None else ''
        self.ctx.figure_list.append((num, self.page.slug, fid, short or caption))
        alt = f'Figure {num}: {self.alt_text(short or caption)}'
        img = (f'<img src="\x02U|{asset["src"]}\x02" alt="{html.escape(alt, quote=True)}" width="{asset["width"]}" '
               f'height="{asset["height"]}" loading="lazy" decoding="async" data-kind="{asset["kind"]}">')
        self.ctx.assets[fid] = asset
        self.ctx.captions[fid] = {'num': num, 'page': self.page.slug, 'caption': caption, 'frac': frac, 'alt': alt}
        return (f'<figure class="dg-figure" id="{esc(fid)}">{extra}'
                f'<div class="dg-paper" style="--dg-frac:{frac:.3f}">{img}</div>'
                f'<figcaption><span class="dg-fignum">Figure {num}:</span> {caption}</figcaption></figure>'
                + ''.join(self.ctx.interactive(l, asset=asset) for l in labels))

    def alt_text(self, caption: str) -> str:
        """A caption (rendered HTML) as plain text for the figure's alt (unit B11): tags and footnote marks
        dropped, a formula as its TeX source without \\( \\), a reference as the number it shows, every run of
        white space (the no-break space of ~ included) one space. The caption itself stays under the figure."""
        def ref(m):
            lab, kind = m.group(1), m.group(2)
            v = self.ctx.aux.get(lab)
            if v is None:
                return '…'
            return v['page'] if kind == 'pageref' else f'({v["num"]})' if kind == 'eqref' else v['num']
        t = re.sub(r'<sup class="dg-fnref">.*?</sup>', '', caption, flags=re.S)
        t = re.sub(r'<span class="math inline">\\\((.*?)\\\)</span>', lambda m: m.group(1).strip(), t, flags=re.S)
        t = re.sub('\x02R\\|([^|\x02]+)\\|([a-z]+)\x02', ref, t)
        t = html.unescape(re.sub(r'<[^>]+>', '', t))
        return ' '.join(t.split())

    def diagram(self, nd: Env) -> str:
        """A tikzpicture that is not inside a figure environment: no number, no caption."""
        if 'aboutstop' in self.local and '\\aboutstop' in nd.raw:
            return self.timeline(nd)
        snippet = '\n'.join(self.defs + [nd.raw])
        name = f'{slugify(self.page.slug)}-diagram-{len(self.ctx.figures_used(self.page.slug)) + 1}'
        asset = self.tikz(snippet, name, self.textwidth_cm)
        self.ctx.figures_used(self.page.slug).append(name)
        frac = min(1.0, asset.get('width_frac', 1.0))
        return (f'<div class="dg-diagram"><div class="dg-paper" style="--dg-frac:{frac:.3f}">'
                f'<img src="\x02U|{asset["src"]}\x02" alt="" width="{asset["width"]}" height="{asset["height"]}" '
                f'loading="lazy" decoding="async" data-kind="{asset["kind"]}"></div></div>')

    def timeline(self, nd: Env) -> str:
        """The trajectory timeline of About the Author (D51): a tikzpicture holding one \\draw (the line) and
        \\aboutstop{x}{years}{role}{place} calls. On the web an ordered list in source order, so its words stay
        text (search, screen readers, phone width); the x positions only space the stops evenly in the PDF.
        Anything else in the picture stops the page."""
        raw = nd.raw
        m = re.fullmatch(r'\\begin\{tikzpicture\}(.*)\\end\{tikzpicture\}', raw, re.S)
        body = m.group(1)
        body = re.sub(r'^\s*\\draw\[[^\]]*\]\s*\([\d.]+,0\)\s*--\s*\([\d.]+,0\)\s*;', '', body, count=1)
        stops, i, sub = [], 0, Parser(body)
        while True:
            j = body.find('\\aboutstop', i)
            rest = body[i:j if j != -1 else len(body)]
            if rest.strip():
                raise ConvertError(f'timeline (tikzpicture with \\aboutstop): no handler for "{rest.strip()[:40]}"', nd.pos)
            if j == -1:
                break
            args, i = sub.read_args('rmmm', j + len('\\aboutstop'), len(body), nd.pos)
            stops.append(args[1:])
        if not stops:
            raise ConvertError('timeline without \\aboutstop', nd.pos)
        lis = ''.join(f'<li><span class="dg-tl-years">{self.inline(y)}</span><span class="dg-tl-role">{self.inline(r)}</span>'
                      f'<span class="dg-tl-place">{self.inline(pl)}</span></li>' for y, r, pl in stops)
        return f'<ol class="dg-timeline">{lis}</ol>'

    def width_frac(self, opts: str, pos: int) -> float:
        m = re.search(r'width\s*=\s*([\d.]*)\s*\\(textwidth|linewidth)', opts)
        if m:
            return float(m.group(1) or 1)
        m = re.search(r'width\s*=\s*([\d.]+)\s*cm', opts)
        if m:
            return min(1.0, float(m.group(1)) / self.textwidth_cm)
        if not opts.strip():
            return 1.0
        raise ConvertError(f'includegraphics options not understood: [{opts}]', pos)

    # -- inline level ----------------------------------------------------------------
    def inline(self, nodes: list) -> str:
        out = []
        for i, nd in enumerate(nodes):
            if isinstance(nd, Cmd) and nd.name in DECL:
                rest = self.inline(nodes[i + 1:])
                out.append(f'<span class="{DECL[nd.name]}">{rest}</span>' if DECL[nd.name] else rest)
                break
            if isinstance(nd, Cmd) and nd.name == 'color':
                out.append(f'<span style="color:{self.colour(nd.args[0], nd.pos)}">{self.inline(nodes[i + 1:])}</span>')
                break
            out.append(self.inline_node(nd))
        return ''.join(out)

    def inline_node(self, nd) -> str:
        if isinstance(nd, Text):
            return esc(typo(nd.s))
        if isinstance(nd, Math):
            return self.math(nd)
        if isinstance(nd, Group):
            stretch = self.arraystretch           # ... and one made inside {..} ends with the group
            html = self.inline(nd.body)
            self.arraystretch = stretch
            return html
        if isinstance(nd, Par):
            return ' '
        if isinstance(nd, Env):
            raise ConvertError(f'environment {nd.name} inside inline text: no handler yet', nd.pos)
        name, a = nd.name, nd.args
        if name in WRAP:
            return WRAP[name][0] + self.inline(a[0]) + WRAP[name][1]
        if name in SYMBOL:
            return SYMBOL[name]
        if name[:-3] in TERM_COLOURS and name[-3:] in ('one', 'two'):
            shade = '' if name.endswith('one') else '2'
            return f'<span class="dg-term dg-term-{name[:-3]}{shade}">{self.inline(a[0])}</span>'
        if name in ('ref', 'eqref', 'pageref'):     # pageref: the PDF's page number, linked like \ref (D47)
            self.refs.append(a[0].strip())
            return f'\x02R|{a[0].strip()}|{name}\x02'
        if name == 'renewcommand':
            m = re.fullmatch(r'\{?\\arraystretch\}?', a[0])
            if m and re.fullmatch(r'\s*\d+(\.\d+)?\s*', a[1]):
                self.arraystretch = a[1].strip()      # prints nothing; read by the tabular that follows
                return ''
            raise ConvertError(f'\\renewcommand{a[0]}: no handler for this definition', nd.pos)
        if name == 'label':
            lab = a[0].strip()
            self.anchors[lab] = lab
            return f'<span class="dg-anchor" id="{esc(lab)}"></span>'
        if name == 'footnote':
            return self.footnote(a[0], self.take('footnote', nd.pos))
        if name in ('citep', 'citet', 'citealt'):
            return self.cite(nd)
        if name == 'href':
            return f'<a href="{esc(a[0].strip())}">{self.inline(a[1])}</a>'
        if name in ('url', 'nolinkurl'):
            u = esc(a[0].strip())
            return f'<a href="{u}"><code class="dg-code">{u}</code></a>' if name == 'url' else f'<code class="dg-code">{u}</code>'
        if name == 'hypertarget':
            return f'<span class="dg-anchor" id="{esc(a[0].strip())}"></span>{self.inline(a[1])}'
        if name == 'hyperlink':
            return f'<a href="#{esc(a[0].strip())}">{self.inline(a[1])}</a>'
        if name == 'textcolor':
            return f'<span style="color:{self.colour(a[0], nd.pos)}">{self.inline(a[1])}</span>'
        if name == '\\':
            return '<br>'
        if name in ACCENT:
            base = re.sub(r'<[^>]+>', '', self.inline(a[0])) or ' '
            return unicodedata.normalize('NFC', base[0] + ACCENT[name]) + base[1:]
        if name in ('captionof', 'colorlet', 'pgfdeclarelayer', 'pgfsetlayers'):
            raise ConvertError(f'\\{name} outside a figure page (custompage with one tikzpicture and '
                               f'\\captionof{{figure}}): no handler yet', nd.pos)
        if name == 'DLC':
            self.ctx.review('author-note', nd.pos, self.P.s[nd.pos:nd.pos + 300].split('\n')[0])
            return ''
        if name in PRINT_ONLY or name == 'hspace':
            return ' ' if name == 'hspace' else ''
        if name == 'stepcounter' and a[0].strip() == 'footnote':
            if self.fn_counter is None:
                raise ConvertError('\\stepcounter{footnote} outside a chapter opening: no handler yet', nd.pos)
            self.fn_counter += 1
            return ''
        if name == 'edef':
            m = re.fullmatch(r'\\([A-Za-z]+)', a[0])
            if m and a[1].strip() == r'\arabic{footnote}' and self.fn_counter is not None:
                self.macros[m.group(1)] = str(self.fn_counter)
                return ''
            raise ConvertError(f'\\edef{a[0]}: no handler for this definition', nd.pos)
        if name == 'newcommand':
            m = re.fullmatch(r'\{?\\([A-Za-z]+)\}?\s*(?:\[\d\])?', a[0])
            if not m or m.group(1) not in LOCAL_SHAPE:
                raise ConvertError(f'\\newcommand{a[0]}: no handler for this definition', nd.pos)
            if not all(part in a[1] for part in LOCAL_SHAPE[m.group(1)]):
                raise ConvertError(f'\\newcommand{a[0]}: its definition changed; update render.py (LOCAL_SHAPE and handler)', nd.pos)
            self.local[m.group(1)] = a[1]
            return ''
        if name == 'grantbadge':                    # its definition prints \#<arg> in a navy box (LOCAL_SHAPE)
            self.local_macro('grantbadge', nd.pos)
            return f'<span class="dg-grant">#{self.inline(a[0])}</span>'
        if name == 'cpheading':
            raise ConvertError('\\cpheading inside inline text: no handler', nd.pos)
        if name == 'rule':
            if a[0] is not None:
                raise ConvertError('\\rule with a raise argument: no handler yet', nd.pos)
            w, h = (tables.length_em(x, self.textwidth_cm, nd.pos) for x in (a[1], a[2]))
            return f'<span class="dg-rule" style="width:{w:.3g}em;height:{h:.3g}em" aria-hidden="true"></span>'
        if name == 'def':
            self.defs.append(f'\\def{a[0]}{{{a[1]}}}')      # kept for the TikZ pictures that follow
            return ''
        if name == 'bibliography':
            return ''                                        # its own page, built from the .bbl
        if name == 'newblock':                               # plainnat: a small space between the blocks of an entry
            return ' '
        if name == 'penalty':                                # \penalty0 (main.bbl): a line break allowed, nothing printed
            if int(a[0]) != 0:
                raise ConvertError(f'\\penalty{a[0]}: no handler (only \\penalty0)', nd.pos)
            return '<wbr>'
        raise ConvertError(f'\\{name}: declared in texparse.CMDS but has no handler in render.py', nd.pos)

    def colour(self, name: str, pos: int) -> str:
        name = name.strip()
        if re.fullmatch(r'color_[a-z]+_[012]', name):
            return f'var(--dg-{name.replace("_", "-")})'
        if name in ('red', 'blue', 'black', 'white', 'gray'):
            return f'var(--dg-tex-{name})'
        m = re.fullmatch(r'([a-z_0-9]+)!(\d{1,2})', name)        # xcolor's c!p: p % of c, the rest white (paper)
        if m:
            return f'color-mix(in srgb, {self.colour(m.group(1), pos)} {m.group(2)}%, var(--dg-bg))'
        raise ConvertError(f'colour "{name}": not in the palette known to render.py', pos)

    def cite(self, nd: Cmd) -> str:
        pre, post, keys = nd.args
        parts = []
        for key in (k.strip() for k in keys.split(',')):
            if key not in self.ctx.bib:
                raise ConvertError(f'citation key {key} is not in the .bbl', nd.pos)
            author, year = self.ctx.bib[key]['author'], self.ctx.bib[key]['year']
            text = {'citep': f'{author}, {year}', 'citet': f'{author} ({year})', 'citealt': f'{author} {year}'}[nd.name]
            parts.append(f'<a class="dg-cite" href="\x02U|bibliography#bib-{esc(key)}\x02">{text}</a>')
        body = '; '.join(parts)
        if pre is not None and post is None:      # natbib: a single optional argument is the post-note
            pre, post = None, pre
        if pre:
            body = self.inline(pre) + ' ' + body
        if post:
            body += ', ' + self.inline(post)
        return f'({body})' if nd.name == 'citep' else body

    # -- footnotes ---------------------------------------------------------------------
    def footnote(self, body: list, num: str) -> str:
        if num.isdigit():
            self.fn_counter = int(num)
        self.footnotes.append((num, self.flow(body)))
        return (f'<sup class="dg-fnref"><a href="#fn-{num}" id="fnref-{num}" '
                f'aria-label="Footnote {num}">{num}</a></sup>')

    def footnotetext(self, nd: Cmd) -> str:
        """\\footnotetext[<number>]{text}: the text of a footnote whose mark is placed by hand."""
        num = self.take('footnote', nd.pos)
        want = (nd.args[0] or '').strip()
        want = self.macros.get(want.lstrip('\\'), want)
        if want and want != num:
            raise ConvertError(f'\\footnotetext[{want}] but LaTeX numbered it {num}', nd.pos)
        self.footnotes.append((num, self.flow(nd.args[1])))
        return ''

    # -- math ----------------------------------------------------------------------------
    def math(self, nd: Math) -> str:
        """Emit math as the exact source. The only rewrites, all forced by the web
        (cross-page numbering, no LaTeX counters), are:
          1. \\label{x} in a numbered environment -> \\tag{<number from the LaTeX build>}
          2. \\ref{x} / \\eqref{x} inside math      -> the number
          3. \\hyperlink{t}{..}                     -> \\href{#t}{..}   (hand-placed footnote marks)
          4. macros \\edef'ed to a footnote number  -> that number
        """
        src = nd.src
        ids = []
        if is_display_tabular(nd):
            # \[ \begin{tabular}..\end{tabular} \]: a tabular is text mode, so this is a centred table whose
            # cells are text of the notes, not a formula (D48; not a rewrite of math, D7)
            a = nd.pos + 2 + src.index('\\begin{tabular}')
            b = nd.pos + 2 + src.rindex('\\end{tabular}') + len('\\end{tabular}')
            if self.P.env_end('tabular', a + len('\\begin{tabular}'), b)[1] != b:
                raise ConvertError('display math with more than one tabular: no handler yet', nd.pos)
            return tables.tabular(self, a, b, nd.pos).replace('class="dg-table-wrap"', 'class="dg-table-wrap dg-table-display"', 1)
        if nd.kind == 'env' and nd.env in NUMBERED_MATH:
            src, ids = self.number_rows(src, nd)
        elif '\\label' in src:
            ids = _LABEL.findall(src)
            src = _LABEL.sub('', src)
        if '\\ref' in src or '\\eqref' in src:
            src = _REF_IN_MATH.sub(lambda m: self.ref_in_math(m, nd.pos), src)
        if '\\hyperlink' in src:
            src = re.sub(r'\\hyperlink\s*\{([^}]*)\}', lambda m: '\\href{#' + m.group(1) + '}', src)
        for k, v in self.macros.items():
            src = re.sub(r'\\' + k + r'(?![A-Za-z])', lambda m: v, src)
        if '\\footnote' in src:
            raise ConvertError('\\footnote inside math: no handler yet', nd.pos)
        for lab in ids:
            self.anchors[lab] = lab
        if nd.kind == 'inline':
            tex = '\\(' + src + '\\)'
        elif nd.kind == 'display':
            tex = '\\[' + src + '\\]'
        else:
            tex = src
        self.math_log.append(tex)
        cls = 'math inline' if nd.kind == 'inline' else 'math display'
        ident = f' id="{esc(ids[0])}"' if ids else ''
        # "Copy LaTeX" (D39) copies a display equation's source as it stands in the notes. Where one
        # of the rewrites above changed it, the original travels in data-tex; everywhere else the
        # text of the element is the notes' source (mathjax-config.js keeps it before typesetting).
        orig = nd.src if nd.kind == 'env' else '\\[' + nd.src + '\\]'
        keep = f' data-tex="{esc(orig).replace(chr(34), "&quot;")}"' if nd.kind != 'inline' and orig != tex else ''
        extra = ''.join(f'<span class="dg-anchor" id="{esc(l)}"></span>' for l in ids[1:])
        return f'{extra}<span class="{cls}"{ident}{keep}>{esc(tex)}</span>'

    def number_rows(self, src: str, nd: Math):
        """Put the equation numbers of the LaTeX build into a numbered environment."""
        env = nd.env
        head, tail = '\\begin{' + env + '}', '\\end{' + env + '}'
        inner = src[len(head):len(src) - len(tail)]
        rows = [inner] if env == 'equation' else self.split_rows(inner)
        ids, out = [], []
        for r in rows:
            if not r.strip() and env != 'equation':
                out.append(r)
                continue
            labels = _LABEL.findall(r)
            r = _LABEL.sub('', r)
            if '\\nonumber' in r or '\\notag' in r or '\\tag' in r:
                out.append(r)
                continue
            num = self.take('equation', nd.pos)
            ids += labels
            out.append(r.rstrip() + f' \\tag{{{num}}}' + r[len(r.rstrip()):])
        return head + '\\\\'.join(out) + tail, ids

    def split_rows(self, inner: str) -> list[str]:
        """Split at the top-level \\\\ of an align-like body (nested environments are skipped)."""
        rows, depth, j, last = [], 0, 0, 0
        while j < len(inner):
            if inner.startswith('\\begin{', j):
                depth += 1
            elif inner.startswith('\\end{', j):
                depth -= 1
            if inner.startswith('\\\\', j):
                if depth == 0:
                    rows.append(inner[last:j])
                    last = j + 2
                j += 2
            elif inner[j] == '\\':
                j += 2
            else:
                j += 1
        rows.append(inner[last:])
        return rows

    def ref_in_math(self, m, pos: int) -> str:
        label = m.group(2).strip()
        self.refs.append(label)
        num = self.ctx.aux.get(label)
        if num is None:
            self.ctx.review('undefined-ref', pos, label)
            return '(in preparation)'       # refs in math sit inside \\text{..} in the notes
        return f'({num["num"]})' if m.group(1) == 'eqref' else num['num']
