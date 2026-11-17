#!/usr/bin/env python3
"""Hand-written tool (DECISIONS D24): the text of the course pages is the text of the notes.

    python3 _port/tools/fidelity.py               exit 0 = the only differences are allow-listed ones (every course)
    python3 _port/tools/fidelity.py --course NAME  one course of _port/convert/courses.py (default: each in turn)
    python3 _port/tools/fidelity.py --page <slug>  report only this page (repeatable; 'index' = landing page;
                                                   without --course: the first course)
    python3 _port/tools/fidelity.py --json <file>  also write every difference found (allowed or not)
    python3 _port/tools/fidelity.py --self-test    test the two reducers on small inputs

Reads the course's scratch build (courses.py `src`, e.g. `_port/.work/tex/src`: main.tex and what it \\inputs,
main.aux, main.bbl) and its generated pages (notes/<course>/**/*.html); writes nothing but --json. Standard library only, ~2 s. Written
independently of the converter: render.py / texparse.py are not imported; `_port/convert/source.py` is,
only for TeX's comment stripping and the \\input expansion with file:line.

LaTeX -> stream. From \\begin{document}, in text mode: words are what the text prints with the commands
stripped (\\textbf{x} -> x; the preamble's and the pages' own \\newcommand / \\def macros expanded; TeX's
input ligatures `` '' ` ' -- --- ~ and \\S, accents etc. mapped to the characters they print). Each formula
is one token: its source with all whitespace removed and \\label{..} dropped (it prints nothing); a display
whose whole content is a tabular is text (D48). \\ref / \\eqref / \\pageref print what LaTeX printed (number
or page from main.aux, "??" for a label not in the build); citations print natbib's author-year text, from
the \\bibitem labels of main.bbl. A \\footnote's body stays at its mark; a \\footnotetext (a body placed by
hand, its mark elsewhere) goes to the end of its page, as the footnote text goes to the foot of the PDF
page. A tabular's cells are text (D48). Numbers that LaTeX generates (sections, figures, equations, list
items, footnote marks) are not in the source, so they are not in the stream.

HTML -> stream. The text of <main> without the web layer (`.dg-web`) and without what the converter
generates: heading and figure numbers (`.dg-secnum`, `.dg-fignum`), the running-header kicker
(`.dg-kicker`), footnote marks, whose bodies are spliced in at the mark from the footnote list at the foot
of the page (the list itself is dropped; a body that no mark points to stays where the list was), the
landing page's contents (`nav.dg-contents`, the \\tableofcontents of main.toc) and the List of Figures
entries (`ol.dg-lof`, see below); <svg>, <script>, <button> are not text. Formulas are the text of
`span.math` (the TeX the page typesets, never `data-tex`) without the \\(..\\) / \\[..\\] delimiters,
whitespace removed.

Tokens: a word is a run of letters/digits; every other printed character is a token of its own, so
spacing and line breaks never matter. `$..$` is an inline formula, `$$..$$` a display one.

Pages: their order is the notes' order as the pages give it: the landing page, then the previous/next
chain from the page without a "previous" link. The source is cut where the page map puts page boundaries
(D3, D51, D52): the start of the document (landing page), each top-level \\input of main.tex that lies
wholly before the first chapter-kind heading (front matter), \\listoffigures and \\bibliography (when the
course has those pages: courses.py `lists`), and the two page-making headings of the course (courses.py
`pages`: \\chapter and \\section for the first notes; \\section and \\subsection for the Lyα notes, an
article, Lyα DECISIONS L10). A course that publishes part of its notes (courses.py `last`, `appendices`: L1,
L2) keeps the segments of the pages the converter keeps, decided by the converter's own `select_pages`
(build.py, imported for this alone), whose addresses must then be the pages' in order; constructs this tool
does not know are reported only in the segments kept. Segment i is diffed with page i (difflib); a different
number of segments and pages is a failure.

Lyα notes (L5, L6, L13, L14). The landing page is the title page: its text is compared like any other page; the
uses of the title-page macros the web leaves out (\\noteauthors, \\noteaffiliationone..three, \\noteemails,
\\notedate) are "source" entries of the allow list (a macro named by a "source" entry prints nothing where the
entry names its use; the keys quote the use, never the macro's text, so the allow list holds no author
material), and an author name or the e-mail that reached the page would be a difference. The `abstract`
environment prints article's \\abstractname ("Abstract") before its text; `appendices` is a marker.
In tables, \\multicolumn and \\multirow print their last argument, \\cellcolor prints nothing (the preamble's
\\TotZero..\\TotSix expand to it and their argument); \\setlength{\\tabcolsep} and \\arraystretch print nothing.

List of Figures and Bibliography (D52). The Bibliography page is checked against main.bbl: its \\bibitem
entries reduced like the text, after the class's \\bibname ("Bibliography"), the page's title. The List of
Figures page is checked only for its title (\\listfigurename, "List of Figures"): its entries are the
figures' short captions, which LaTeX writes to main.lof, not text of the page's source segment, and the
converter already checks them figure by figure against main.lof (D52); so `ol.dg-lof` is skipped.
Definitions and notation (D53, `definitions.html`) is not checked: it is web layer throughout and not a span
of the source (it is not in the previous/next chain either); the only text of the notes on it, the Notation
table and the terms, are copies of text that is checked where it stands (EXCLUDED).
Cases that need no allow entry because both streams agree: \\pageref prints the PDF's page number (D47),
the caption of Figure 10.3 (\\captionof, D50), the tables (D48), the copyright page (D51).

Accepted differences: one file per course (ALLOWS: `_port/fidelity_allow.json` for the first notes,
`_port/lya/fidelity_allow.json` for the Lyα notes), one entry per difference, each with its reason:
  "source": a construct whose text the page does not carry as text, named by file + construct + key
            (a fingerprint that survives line shifts: the \\label of its figure, else the first 60
            characters of its source, + ' #n' if two share one in a file; "line" is informative).
            Constructs: "tikzpicture" (its words are in the SVG, D10; the cover and dedication D19 and
            About the Author D51 overlays), "figure" (a figure whose whole body is the picture, with the
            macros and saved boxes it draws: only its \\caption is compared), "\\DLC" (a hidden author
            note, D18), "\\<macro>" (a use of a macro whose text the page leaves out, e.g. \\noteauthors:
            key = the first 60 characters of the source from the macro's name on). Left out of the LaTeX
            stream. A tikzpicture that no entry names is reported.
  "diff":   one difference on one page, matched exactly: page slug + the LaTeX tokens + the page tokens
            ("at", the LaTeX file:line, is informative). Each entry matches one difference.
An entry that matches nothing is stale and fails the check. A construct the LaTeX reducer does not know
fails the check with file:line (teach this tool, as the converter is taught).
Output: each difference that is not allowed (page, LaTeX file:line, both token runs), each stale entry,
then one summary line.
"""
from __future__ import annotations

import argparse
import bisect
import difflib
import json
import os
import posixpath
import re
import sys
import time
import unicodedata
from html.parser import HTMLParser

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(REPO, '_port', 'convert'))
import source  # noqa: E402  (comment stripping and \input expansion only)
import courses  # noqa: E402  (where each course's build and pages are)
# the allow list of each course (relative to the repo root)
ALLOWS = {'diffgeo-gr': '_port/fidelity_allow.json', 'lya-forest': '_port/lya/fidelity_allow.json'}
# set by configure(): the course, its pages, its scratch build, its allow list, the headings that make pages
# (LaTeX command -> page kind) and the generated pages it has (courses.py 'lists')
CFG: dict = {}
COURSE = TEXSRC = ALLOW = None
PAGE_CMDS = {'chapter': 'chapter', 'section': 'section'}
LISTS = ('lof', 'bib')


def configure(name: str) -> None:
    global CFG, COURSE, TEXSRC, ALLOW, PAGE_CMDS, LISTS
    CFG = courses.get(name)
    if name not in ALLOWS:
        raise SystemExit(f'fidelity: no allow list for course {name} (ALLOWS)')
    COURSE, TEXSRC, ALLOW = CFG['out'], CFG['src'], os.path.join(REPO, ALLOWS[name])
    PAGE_CMDS = {cmd: kind for kind, cmd in CFG['pages'].items()}
    LISTS = tuple(CFG['lists'])


class Unknown(Exception):
    def __init__(self, msg, loc):
        super().__init__(msg)
        self.loc = loc


# ---------------------------------------------------------------------------------------------------------
# common normalisation

_SPACES = dict.fromkeys(map(ord, '\u00a0\u2002\u2003\u2009\u200a\u202f\u2007\u2008'), ' ')
_SPACES.update(dict.fromkeys(map(ord, '\u200b\u2060\u00ad\ufeff'), None))
WORD = re.compile(r'\w+|[^\w\s]')


def words(text: str) -> list[str]:
    return WORD.findall(unicodedata.normalize('NFC', text.translate(_SPACES)))


def mathtok(src: str, display: bool) -> str:
    s = re.sub(r'\s+', '', unicodedata.normalize('NFC', src))
    return f'$${s}$$' if display else f'${s}$'


# ---------------------------------------------------------------------------------------------------------
# LaTeX -> stream

MATH_ENVS = {'align', 'align*', 'equation', 'equation*', 'gather', 'gather*', 'multline', 'multline*',
             'flalign', 'flalign*', 'alignat', 'alignat*', 'eqnarray', 'eqnarray*', 'displaymath', 'math'}
# commands that print nothing (font, size, spacing, page layout, counters; D9), with the number of {}
# arguments they take (OPTARG: an optional [..] argument first)
OPTARG = {'includegraphics', 'rule'}
SILENT = {
    'noindent': 0, 'indent': 0, 'medskip': 0, 'smallskip': 0, 'bigskip': 0, 'newpage': 0, 'clearpage': 0,
    'cleardoublepage': 0, 'centering': 0, 'raggedright': 0, 'raggedleft': 0, 'par': 0, 'tiny': 0,
    'scriptsize': 0, 'footnotesize': 0, 'small': 0, 'normalsize': 0, 'large': 0, 'Large': 0, 'LARGE': 0,
    'huge': 0, 'Huge': 0, 'bfseries': 0, 'itshape': 0, 'scshape': 0, 'sffamily': 0, 'rmfamily': 0,
    'ttfamily': 0, 'upshape': 0, 'mdseries': 0, 'normalfont': 0, 'selectfont': 0, 'hfill': 0, 'vfill': 0,
    'null': 0, 'relax': 0, 'protect': 0, 'phantomsection': 0, 'appendix': 0, 'begingroup': 0,
    'endgroup': 0, 'arraybackslash': 0, 'hline': 0, 'tableofcontents': 0, 'runic': 0, 'cunei': 0,
    'leavevmode': 0, 'ignorespaces': 0, 'unskip': 0, 'nobreak': 0, 'allowbreak': 0, 'tcblower': 0,
    'leaders': 0, 'hyphenpenalty': 0, 'exhyphenpenalty': 0, 'spaceskip': 0, 'newblock': 0, 'frenchspacing': 0,
    'label': 1, 'vspace': 1, 'vspace*': 1, 'hspace': 1, 'hspace*': 1, 'thispagestyle': 1, 'pagestyle': 1,
    'color': 1, 'stepcounter': 1, 'refstepcounter': 1, 'linespread': 1, 'pgfsetlayers': 1, 'pagenumbering': 1,
    'pgfdeclarelayer': 1, 'addvspace': 1, 'hypersetup': 1, 'cmidrule': 1, 'cline': 1,
    'setlength': 2, 'addtolength': 2, 'setcounter': 2, 'addtocounter': 2, 'colorlet': 2, 'markboth': 2,
    'fontsize': 2, 'pgfmathsetmacro': 2, 'pgfmathsetlengthmacro': 2, 'pgfmathtruncatemacro': 2,
    'definecolor': 3, 'addcontentsline': 3, 'rule': 2, 'includegraphics': 1,
}
BREAKS = {'par', 'medskip', 'smallskip', 'bigskip', 'newpage', 'clearpage', 'cleardoublepage', 'vspace',
          'vspace*', 'addvspace', 'hfill', 'vfill', 'hspace', 'hspace*', 'quad', 'qquad', 'rule'}
PASS1 = {'textbf', 'textit', 'emph', 'texttt', 'textrm', 'textsf', 'textsc', 'textup', 'textmd', 'textnormal',
         'textsl', 'mbox', 'underline', 'natexlab', 'text', 'hbox', 'fbox', 'makebox'}
SYMBOL = {'S': '§', 'P': '¶', 'checkmark': '✓', 'textbullet': '•', 'textcopyright': '©', 'LaTeX': 'LaTeX',
          'TeX': 'TeX',
          'ldots': '…', 'dots': '…', 'textellipsis': '…', 'enspace': ' ', 'quad': ' ', 'qquad': ' ',
          'thinspace': ' ', 'textendash': '–', 'textemdash': '—', 'textbackslash': '\\', 'textasciitilde': '~',
          'textregistered': '®', 'texttrademark': '™', 'textdegree': '°', 'i': 'ı', 'j': 'ȷ', 'ss': 'ß',
          'ae': 'æ', 'oe': 'œ', 'o': 'ø', 'O': 'Ø', 'l': 'ł', 'L': 'Ł', 'aa': 'å', 'AA': 'Å', 'today': None}
CTRLSYM = {'&': '&', '%': '%', '#': '#', '_': '_', '$': '$', '{': '{', '}': '}', ' ': ' ', '\n': ' ', ',': ' ',
           ';': ' ', ':': ' ', '!': '', '/': '', '-': '', '@': ''}
ACCENT = {"'": '\u0301', '`': '\u0300', '^': '\u0302', '"': '\u0308', '~': '\u0303', '=': '\u0304',
          '.': '\u0307', 'c': '\u0327', 'v': '\u030c', 'u': '\u0306', 'H': '\u030b', 'r': '\u030a',
          'k': '\u0328', 'd': '\u0323', 'b': '\u0331'}
HEADINGS = {'part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'}
CITES = {'cite', 'citep', 'citet', 'citealp', 'citealt', 'citeauthor', 'citeyear', 'citeyearpar'}


class Tok:
    __slots__ = ('val', 'loc')

    def __init__(self, val, loc):
        self.val, self.loc = val, loc


class Deferred:
    __slots__ = ('toks',)

    def __init__(self, toks):
        self.toks = toks


class Boundary:
    __slots__ = ('kind', 'loc')

    def __init__(self, kind, loc):
        self.kind, self.loc = kind, loc


class Ctx:
    """What the reducer knows about the build: label numbers (main.aux), citation texts (main.bbl),
    macros (preamble + page-local), the allowed source constructs, and how to print a location."""

    def __init__(self, aux=None, bib=None, where=None):
        self.labels = aux or {}          # label -> (number, page)
        self.bib = bib or {}             # key -> (authors, year)
        self.macros = {}                 # name -> (nargs, default-of-first-or-None, body)
        self.where = where or (lambda loc: str(loc))
        self.fp = {}                     # offset of a nameable construct -> (file, construct, key, line)
        self.skip_at = set()             # (file, construct, key) named by the allow list
        self.skipped = {}                # (file, construct, key) -> times it was left out
        self.unknown = []                # [(loc, message)] constructs this tool does not know
        self.unlisted = []               # [(file, construct, key, line, loc)] left out but not allow-listed
        self.omit = set()                # macros whose uses the allow list may name (printing nothing there)
        self.motivation = 'Motivation: #1'


def _find_group(s, i):
    """s[i] == '{': index after the matching '}'."""
    depth = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == '\\':
            i += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    raise ValueError('unbalanced {')


def _skip_space(s, i):
    while i < len(s) and s[i] in ' \t\n':
        i += 1
    return i


class TexReducer:
    """Reduces LaTeX (text mode) to tokens. `pos(i)` gives the location of character i of `s`."""

    def __init__(self, ctx: Ctx):
        self.ctx = ctx
        self.out: list = []
        self.buf: list = []              # [(text, loc)]

    # -- output ---------------------------------------------------------------------------------------
    def text(self, t, loc):
        if t:
            self.buf.append((unicodedata.normalize('NFC', t), loc))

    def flush(self):
        if not self.buf:
            return
        joined, starts = '', []
        for t, loc in self.buf:
            starts.append((len(joined), loc))
            joined += t
        self.buf = []
        k = 0
        norm = joined.translate(_SPACES)
        for m in WORD.finditer(norm):
            while k + 1 < len(starts) and starts[k + 1][0] <= m.start():
                k += 1
            self.out.append(Tok(unicodedata.normalize('NFC', m.group(0)), starts[k][1]))

    def emit(self, val, loc):
        self.flush()
        self.out.append(Tok(val, loc))

    # -- argument reading --------------------------------------------------------------------------------
    def arg(self, s, i, loc):
        """Mandatory argument at s[i:] (spaces skipped). Returns (start, end, next)."""
        i = _skip_space(s, i)
        if i >= len(s):
            raise Unknown('missing argument', loc(i - 1))
        if s[i] == '{':
            j = _find_group(s, i)
            return i + 1, j - 1, j
        if s[i] == '\\':
            m = re.match(r'\\([A-Za-z@]+|.)', s[i:])
            return i, i + m.end(), i + m.end()
        return i, i + 1, i + 1

    def opt(self, s, i):
        """Optional [..] argument: (start, end, next) or None."""
        j = _skip_space(s, i)
        if j >= len(s) or s[j] != '[':
            return None
        depth, k = 0, j + 1
        while k < len(s):
            c = s[k]
            if c == '\\':
                k += 2
                continue
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            elif c == ']' and depth == 0:
                return j + 1, k, k + 1
            k += 1
        raise ValueError('unbalanced [')

    # -- main loop --------------------------------------------------------------------------------------
    def run(self, s: str, pos, a=0, b=None, tabular=False):
        b = len(s) if b is None else b
        i = a
        while i < b:
            c = s[i]
            if c == '\\':
                i = self.command(s, i, pos, b, tabular)
            elif c == '$':
                if s.startswith('$$', i):
                    j = s.index('$$', i + 2)
                    self.math(s, i + 2, j, True, pos)
                    i = j + 2
                else:
                    j = i + 1
                    while s[j] != '$':
                        j += 2 if s[j] == '\\' else 1
                    self.math(s, i + 1, j, False, pos)
                    i = j + 1
            elif c in '{}':
                i += 1
            elif c == '~':
                self.text(' ', pos(i))
                i += 1
            elif c == '&' and tabular:
                self.text(' ', pos(i))
                i += 1
            elif c == '-':
                n = 3 if s.startswith('---', i) else 2 if s.startswith('--', i) else 1
                self.text({3: '—', 2: '–', 1: '-'}[n], pos(i))
                i += n
            elif c == '`':
                n = 2 if s.startswith('``', i) else 1
                self.text('“' if n == 2 else '‘', pos(i))
                i += n
            elif c == "'":
                n = 2 if s.startswith("''", i) else 1
                self.text('”' if n == 2 else '’', pos(i))
                i += n
            elif c == '#':
                raise Unknown('macro parameter # in text', pos(i))
            else:
                j = i
                while j < b and s[j] not in '\\${}~&-`\'#':
                    j += 1
                if j == i:          # a lone & outside a tabular
                    j = i + 1
                self.text(s[i:j], pos(i))
                i = j

    def math(self, s, a, b, display, pos, loc=None):
        """The formula s[a:b] (delimiters excluded; for an environment, included)."""
        src = s[a:b]
        loc = pos(a) if loc is None else loc
        if display and re.fullmatch(r'\s*\\begin\{tabular\}.*\\end\{tabular\}\s*', src, re.S):
            # a tabular is text mode, even inside \[..\] (D48): its cells are text
            self.run(s, pos, a, b)
            return
        src = re.sub(r'\\label\s*\{[^{}]*\}', '', src)
        self.emit(mathtok(src, display), loc)

    def command(self, s, i, pos, b, tabular):
        m = re.match(r'\\([A-Za-z@]+\*?|.)', s[i:i + 64], re.S)
        if not m:
            raise Unknown('lone backslash', pos(i))
        name, j = m.group(1), i + m.end()
        loc = pos(i)
        if name[0].isalpha() or name[0] == '@':
            # TeX skips the spaces (and one end of line) after a control word
            k = j
            while k < b and s[k] in ' \t':
                k += 1
            if k < b and s[k] == '\n':
                k += 1
                while k < b and s[k] in ' \t':
                    k += 1
                if k < b and s[k] == '\n':      # a blank line: \par, keep it as a space
                    k -= 1
            j = k
        bare = name.rstrip('*')
        if name in ('(', '['):
            close = '\\)' if name == '(' else '\\]'
            k = j
            while not s.startswith(close, k):
                k += 2 if s[k] == '\\' else 1
            self.math(s, j, k, name == '[', pos, loc)
            return k + 2
        if name == '\\':
            self.text(' ', loc)
            if j < b and s[j] == '*':
                j += 1
            o = self.opt(s, j)
            return o[2] if o else j
        if name in CTRLSYM:
            self.text(CTRLSYM[name], loc)
            return j
        if name in ACCENT:
            x, y, j = self.arg(s, j, pos)
            base = s[x:y].strip('{} ')
            if base.startswith('\\'):         # \'{\i} is an accented i, not a dotless one
                base = {'i': 'i', 'j': 'j'}.get(base[1:], SYMBOL.get(base[1:], base))
            self.text(base[:1] + ACCENT[name] + base[1:], loc)
            return j
        if name == 'begin':
            return self.begin(s, j, pos, loc)
        if name == 'end':
            raise Unknown('\\end without \\begin', loc)
        if name == 'DLC' and self.allowed(loc, '\\DLC'):
            # a hidden author note (D18), allow-listed
            return self.arg(s, j, pos)[2]
        if name in self.ctx.omit and self.ctx.macros.get(name) and self.allowed(loc, '\\' + name):
            # a use of a macro whose text the page leaves out (Lyα L5, L6: the title page's authors), allow-listed
            for _ in range(self.ctx.macros[name][0]):
                j = self.arg(s, j, pos)[2]
            return j
        if name in self.ctx.macros:
            return self.expand(name, s, j, pos, loc)
        if name in SYMBOL:
            if SYMBOL[name] is None:
                raise Unknown(f'\\{name} prints a date, not text of the notes', loc)
            self.text(SYMBOL[name], loc)
            return j
        if name in SILENT:
            o = self.opt(s, j) if name in OPTARG else None
            if o:
                j = o[2]
            for _ in range(SILENT[name]):
                j = self.arg(s, j, pos)[2]
            if name in BREAKS:
                self.text(' ', loc)
            return j
        if name == 'kern' or name == 'vrule' or name == 'hrule':
            mm = re.match(r'(\s*(height|depth|width)?\s*-?[\d.]+\s*(pt|cm|mm|em|ex|in|bp|sp))*\s*', s[j:])
            return j + mm.end()
        if name in ('url', 'nolinkurl'):
            x, y, j = self.arg(s, j, pos)
            self.text(s[x:y], loc)
            return j
        if name == 'bibitem':
            o = self.opt(s, j)
            j = o[2] if o else j
            self.text(' ', loc)
            return self.arg(s, j, pos)[2]
        if name == 'penalty':
            return j + re.match(r'\s*-?\d+', s[j:]).end()
        if name in PASS1:
            x, y, j = self.arg(s, j, pos)
            self.run(s, pos, x, y)
            return j
        if name == 'MakeUppercase':
            x, y, j = self.arg(s, j, pos)
            sub = TexReducer(self.ctx)
            sub.run(s, pos, x, y)
            sub.flush()
            for t in sub.out:
                self.emit(t.val.upper() if not t.val.startswith('$') else t.val, t.loc)
            return j
        if name == 'cellcolor':
            # a cell's background (L13): prints nothing ([model]{colour})
            o = self.opt(s, j)
            j = o[2] if o else j
            return self.arg(s, j, pos)[2]
        if name in ('multicolumn', 'multirow'):
            # a cell spanning columns / rows (L13): its text is the last argument (\multirow's optional
            # arguments: [vpos]{rows}[bigstruts]{width}[fixup]{text})
            n = 2
            if name == 'multirow':
                o = self.opt(s, j)
                j = o[2] if o else j
            for k in range(n):
                j = self.arg(s, j, pos)[2]
                if name == 'multirow':
                    o = self.opt(s, j)
                    j = o[2] if o else j
            x, y, j = self.arg(s, j, pos)
            self.run(s, pos, x, y, tabular=True)
            return j
        if name in ('textcolor', 'href', 'hyperlink', 'hypertarget'):
            j = self.arg(s, j, pos)[2]
            x, y, j = self.arg(s, j, pos)
            self.run(s, pos, x, y)
            return j
        if name in ('tcbox', 'colorbox', 'parbox', 'raisebox'):
            o = self.opt(s, j)
            j = o[2] if o else j
            if name in ('colorbox', 'parbox', 'raisebox'):
                j = self.arg(s, j, pos)[2]
            x, y, j = self.arg(s, j, pos)
            self.run(s, pos, x, y)
            return j
        if name == 'footnote':
            x, y, j = self.arg(s, j, pos)
            self.flush()
            self.run(s, pos, x, y)
            self.flush()
            return j
        if name == 'footnotetext':
            # a footnote text placed by hand (its mark is elsewhere, e.g. in a formula): it goes to the
            # foot of the page, as the page's footnote list does with a body that has no mark
            o = self.opt(s, j)
            j = o[2] if o else j
            x, y, j = self.arg(s, j, pos)
            sub = TexReducer(self.ctx)
            sub.run(s, pos, x, y)
            sub.flush()
            self.flush()
            self.out.append(Deferred(sub.out))
            return j
        if bare in ('ref', 'eqref', 'pageref', 'autoref'):
            x, y, j = self.arg(s, j, pos)
            lab = s[x:y].strip()
            n = self.ctx.labels.get(lab)
            v = '??' if n is None else (n[1] if bare == 'pageref' else n[0])
            self.text('(' + v + ')' if bare == 'eqref' else v, loc)
            return j
        if bare in CITES:
            if self.opt(s, j):
                raise Unknown('citation with optional text: not taught yet', loc)
            x, y, j = self.arg(s, j, pos)
            keys = [k.strip() for k in s[x:y].split(',')]
            self.text(self.cite(bare, keys), loc)
            return j
        if bare in HEADINGS:
            o = self.opt(s, j)
            j = o[2] if o else j
            x, y, j = self.arg(s, j, pos)
            if bare in PAGE_CMDS:
                self.flush()
                self.out.append(Boundary(PAGE_CMDS[bare], loc))
            self.flush()
            self.run(s, pos, x, y)
            self.text(' ', loc)
            return j
        if name in ('caption', 'captionof'):
            if name == 'captionof':
                j = self.arg(s, j, pos)[2]
            o = self.opt(s, j)
            j = o[2] if o else j
            x, y, j = self.arg(s, j, pos)
            self.run(s, pos, x, y)
            return j
        if name == 'item':
            self.text(' ', loc)
            o = self.opt(s, j)
            if o:
                self.run(s, pos, o[0], o[1])
                self.text(' ', loc)
                j = o[2]
            return j
        if name == 'listoffigures' and 'lof' in LISTS:
            self.flush()
            self.out.append(Boundary('listoffigures', loc))
            self.text('List of Figures ', loc)
            return j
        if name == 'bibliography':
            j = self.arg(s, j, pos)[2]
            if 'bib' in LISTS:          # else: a course without a Bibliography page (Lyα L4) prints nothing here
                self.flush()
                self.out.append(Boundary('bibliography', loc))
            return j
        if bare in ('newcommand', 'renewcommand', 'providecommand'):
            return self.define(s, j, pos, loc)
        if name in ('def', 'edef', 'gdef', 'xdef'):
            mm = re.match(r'\s*\\([A-Za-z@]+)([^{]*)', s[j:])
            nm, params = mm.group(1), mm.group(2)
            k = j + mm.end()
            e = _find_group(s, k)
            if name == 'def' and re.fullmatch(r'(#\d)*', params.strip()):
                self.ctx.macros[nm] = (len(params.strip()) // 2, None, s[k + 1:e - 1])
            else:
                self.ctx.macros[nm] = None          # defined, but not something text mode may use
            return e
        if name == 'let':
            mm = re.match(r'\s*\\[A-Za-z@]+\s*=?\s*(\\[A-Za-z@]+|.)', s[j:])
            return j + mm.end()
        if name in ('expandafter', 'ifx', 'csname', 'endcsname', 'else', 'fi'):
            raise Unknown(f'\\{name}: TeX programming in text mode', loc)
        self.ctx.unknown.append((loc, f'unknown command \\{name}'))   # reported; the rest goes on
        return j

    def allowed(self, loc, construct):
        """Is the construct at loc named by a 'source' entry of the allow list? (counted if so)"""
        fp = self.ctx.fp.get(loc)
        if fp is None or fp[1] != construct or fp[:3] not in self.ctx.skip_at:
            return False
        self.ctx.skipped[fp[:3]] = self.ctx.skipped.get(fp[:3], 0) + 1
        return True

    def define(self, s, j, pos, loc):
        j = _skip_space(s, j)
        if s[j] == '{':
            e = _find_group(s, j)
            nm = s[j + 1:e - 1].strip().lstrip('\\')
            j = e
        else:
            mm = re.match(r'\\([A-Za-z@]+)', s[j:])
            nm, j = mm.group(1), j + mm.end()
        n, dflt = 0, None
        o = self.opt(s, j)
        if o:
            n, j = int(s[o[0]:o[1]]), o[2]
            o = self.opt(s, j)
            if o:
                dflt, j = s[o[0]:o[1]], o[2]
        x, y, j = self.arg(s, j, pos)
        self.ctx.macros[nm] = (n, dflt, s[x:y])
        return j

    def expand(self, name, s, j, pos, loc):
        mac = self.ctx.macros[name]
        if mac is None:
            raise Unknown(f'\\{name} (\\edef or \\def with a parameter text) used in text mode', loc)
        n, dflt, body = mac
        args = []
        for k in range(n):
            if k == 0 and dflt is not None:
                o = self.opt(s, j)
                if o:
                    args.append(s[o[0]:o[1]])
                    j = o[2]
                else:
                    args.append(dflt)
                continue
            x, y, j = self.arg(s, j, pos)
            args.append(s[x:y])
        out, k = [], 0
        while k < len(body):
            c = body[k]
            if c == '\\' and k + 1 < len(body):
                out.append(body[k:k + 2])
                k += 2
            elif c == '#' and k + 1 < len(body) and body[k + 1] == '#':
                out.append('#')
                k += 2
            elif c == '#' and k + 1 < len(body) and body[k + 1].isdigit():
                out.append(args[int(body[k + 1]) - 1])
                k += 2
            else:
                out.append(c)
                k += 1
        sub = ''.join(out)
        self.run(sub, lambda _i: loc)
        return j

    def cite(self, kind, keys):
        """natbib's author-year text (plainnat: '(A, Y; B, Y)', 'A (Y)', ...)."""
        parts = []
        for k in keys:
            if k not in self.ctx.bib:
                parts.append('?')
                continue
            a, y = self.ctx.bib[k]
            parts.append({'citep': f'{a}, {y}', 'citealp': f'{a}, {y}', 'citet': f'{a} ({y})',
                          'citealt': f'{a} {y}', 'cite': f'{a} ({y})', 'citeauthor': a,
                          'citeyear': y, 'citeyearpar': y}[kind])
        t = '; '.join(parts) if kind in ('citep', 'citealp', 'citeyearpar') else ', '.join(parts)
        return f'({t})' if kind in ('citep', 'citeyearpar') else t

    def begin(self, s, j, pos, loc):
        x, y, j = self.arg(s, j, pos)
        env = s[x:y]
        end = '\\end{' + env + '}'
        # matching \end{env} (same-name nesting counted)
        depth, k = 1, j
        while True:
            e = s.find(end, k)
            bgn = s.find('\\begin{' + env + '}', k)
            if e == -1:
                raise Unknown(f'\\begin{{{env}}} without \\end', loc)
            if bgn != -1 and bgn < e:
                depth += 1
                k = bgn + 1
                continue
            depth -= 1
            if depth == 0:
                break
            k = e + 1
        after = e + len(end)
        if env in MATH_ENVS:
            self.math(s, x - 7, after, True, pos, loc)
            return after
        if env == 'tikzpicture':
            if not self.allowed(loc, 'tikzpicture'):     # reported; its words live in the SVG
                fp = self.ctx.fp.get(loc)
                self.ctx.unlisted.append((fp or (self.ctx.where(loc), 'tikzpicture', '?', '?'))[:4] + (loc,))
            return after
        a = j
        if env in ('itemize', 'enumerate', 'description', 'center', 'flushleft', 'flushright', 'quote',
                   'quotation', 'titlepage', 'document', 'verse', 'appendices'):
            pass
        elif env == 'abstract':
            # article's abstract: its heading \abstractname, then the text (Lyα L14)
            self.flush()
            self.text('Abstract ', loc)
        elif env in ('figure', 'figure*') and self.allowed(loc, 'figure'):
            # a TikZ figure: its whole body is compiled to the SVG (D10), with the macros and saved boxes
            # the picture uses; only the caption is text of the page
            self.text(' ', loc)
            for m in re.finditer(r'\\caption(of)?(?![A-Za-z])', s[a:e]):
                self.command(s, a + m.start(), pos, e, False)
            self.text(' ', loc)
            return after
        elif env in ('figure', 'figure*', 'table', 'table*'):
            o = self.opt(s, a)
            a = o[2] if o else a
        elif env == 'minipage':
            for _ in range(3):
                o = self.opt(s, a)
                a = o[2] if o else a
            a = self.arg(s, a, pos)[2]
        elif env == 'tabular':
            o = self.opt(s, a)
            a = o[2] if o else a
            a = self.arg(s, a, pos)[2]
            self.text(' ', loc)
            self.run(s, pos, a, e, tabular=True)
            self.text(' ', loc)
            return after
        elif env == 'motivationbox':
            tx, ty, a = self.arg(s, a, pos)
            self.flush()
            self.run(self.ctx.motivation.replace('#1', s[tx:ty]), lambda _i: loc)
            self.text(' ', loc)
        elif env == 'tcolorbox':
            o = self.opt(s, a)
            a = o[2] if o else a
        elif env == 'custompage':
            o = self.opt(s, a)
            a = o[2] if o else a
            for _ in range(3):
                a = self.arg(s, a, pos)[2]
        elif env == 'thebibliography':
            a = self.arg(s, a, pos)[2]
            first = s.find('\\bibitem', a)
            a = e if first == -1 or first > e else first
        else:
            self.ctx.unknown.append((loc, f'unknown environment {env}'))
            return after
        self.text(' ', loc)
        self.run(s, pos, a, e)
        self.text(' ', loc)
        return after


# -- reading the build products ----------------------------------------------------------------------------

def _brace_fields(s, i, n):
    out = []
    for _ in range(n):
        while s[i] != '{':
            i += 1
        j = _find_group(s, i)
        out.append(s[i + 1:j - 1])
        i = j
    return out, i


def read_aux(path):
    labels = {}
    for line in open(path, encoding='utf-8', errors='replace'):
        if line.startswith('\\newlabel{'):
            (name, data), _ = _brace_fields(line, 9, 2)
            f, _ = _brace_fields(data, 0, 2)
            labels[name] = (f[0], f[1])
    return labels


def read_bib(path):
    """natbib's \\bibitem[Authors(Year)Full]{key} -> (Authors, Year), accents composed."""
    s = open(path, encoding='utf-8').read()
    out = {}
    for m in re.finditer(r'\\bibitem\[', s):
        j = m.end() - 1
        depth, k = 0, j + 1
        while not (s[k] == ']' and depth == 0):
            depth += {'{': 1, '}': -1}.get(s[k], 0)
            k += 1
        label = s[j + 1:k]
        key = s[k + 2:s.index('}', k + 2)]
        mm = re.match(r'(.*?)\((.*?)\)', label, re.S)
        out[key] = (' '.join(_detok(w) for w in mm.group(1).split()), mm.group(2))
    return out


def _detok(t):
    """One word of a bibliography label (accents, braces) -> its Unicode text."""
    r = TexReducer(Ctx())
    r.run(t, lambda i: i)
    r.flush()
    return ''.join(x.val for x in r.out)


def fingerprints(text, where, omit=()):
    """The constructs a 'source' entry can name: offset -> (file, construct, key, line). The key survives
    line shifts: 'label:<x>' (the \\label of the figure or custompage the construct is in, or is), else
    'text:<first 60 characters of its source, spaces collapsed>'; ' #n' is appended only when two
    constructs of one file share a key (n = their order in the file)."""
    spans = []
    for m in re.finditer(r'\\begin\{(figure\*?|custompage)\}', text):
        e = text.find('\\end{' + m.group(1) + '}', m.end())
        lab = re.search(r'\\label\s*\{([^{}]*)\}', text[m.end():e])
        spans.append((m.start(), e, lab.group(1) if lab else None))

    def head(t):
        return 'text:' + re.sub(r'\s+', ' ', t).strip()[:60]
    found = []
    macros = '|'.join(sorted(re.escape(x) for x in omit))
    rx = r'\\begin\{(tikzpicture|figure)\}|\\DLC\s*\{' + (r'|\\(?P<macro>' + macros + r')(?![A-Za-z@])' if macros else '')
    for m in re.finditer(rx, text):
        off = m.start()
        f, line = where(off).rsplit(':', 1)
        if macros and m.group('macro'):
            # a use of a macro the page leaves out: its key quotes the use, from the macro's name on
            kind, key = '\\' + m.group('macro'), head(text[off:off + 400])
        elif m.group(1):
            lab = next((lb for a, b, lb in spans if a <= off < b and lb), None)
            key = 'label:' + lab if lab else head(text[m.end():m.end() + 400])
            kind = m.group(1)
        else:
            kind, key = '\\DLC', head(text[m.end():_find_group(text, m.end() - 1) - 1])
        found.append([off, f, kind, key, int(line)])
    count = {}
    for x in found:
        count[tuple(x[1:4])] = count.get(tuple(x[1:4]), 0) + 1
    seen = {}
    out = {}
    for off, f, kind, key, line in found:
        k = (f, kind, key)
        if count[k] > 1:
            seen[k] = seen.get(k, 0) + 1
            key = f'{key} #{seen[k]}'
        out[off] = (f, kind, key, line)
    return out


def tex_stream(allow_source):
    """The notes' source reduced to tokens and page boundaries. Returns (items, ctx, where)."""
    S = source.load(TEXSRC, CFG.get('omit', ()))     # Lyα L32: the passages the course leaves out
    bbl_path = os.path.join(TEXSRC, 'main.bbl')
    # the bibliography only where the course has a Bibliography page (Lyα L4: the converted part cites nothing)
    bbl = open(bbl_path, encoding='utf-8').read() if 'bib' in LISTS else ''
    if any(source._comment_start(line) != -1 for line in bbl.split('\n')):
        raise SystemExit('fidelity: main.bbl has a % comment (a broken URL?); teach this tool to strip it')
    bbl_lines = [0] + [m.end() for m in re.finditer('\n', bbl)]

    def where(loc):
        if isinstance(loc, tuple):        # ('bbl', offset)
            return f'main.bbl:{bisect.bisect_right(bbl_lines, loc[1])}'
        return S.where(loc)

    ctx = Ctx(read_aux(os.path.join(TEXSRC, 'main.aux')), read_bib(bbl_path) if bbl else {}, where)
    ctx.skip_at = {(e['file'], e['construct'], e['key']) for e in allow_source}
    ctx.omit = {e['construct'][1:] for e in allow_source if e['construct'].startswith('\\') and e['construct'] != '\\DLC'}
    ctx.fp = fingerprints(S.text, S.where, ctx.omit)
    # preamble macros (\newcommand only) and the motivation box's title
    pre = '\n'.join(line if source._comment_start(line) == -1 else line[:source._comment_start(line)]
                    for line in S.preamble.split('\n'))
    for m in re.finditer(r'\\newcommand(?![A-Za-z])', pre):
        try:
            TexReducer(ctx).define(pre, m.end(), lambda i: i, 0)
        except (ValueError, AttributeError, IndexError):
            pass        # a definition this reader cannot parse: using it in the text is then reported
    mt = re.search(r'\\newtcolorbox\{motivationbox\}\[1\]\{.*?title=\{([^{}]*#1[^{}]*)\}', pre, re.S)
    if not mt and 'motivationbox' in pre:
        raise SystemExit('fidelity: the motivationbox definition in the preamble changed; teach this tool')
    if mt:
        ctx.motivation = mt.group(1)
    if re.search(r'\\abstractname(?![A-Za-z])', pre):
        raise SystemExit('fidelity: the preamble renames \\abstractname; teach this tool')
    for k in ('runic', 'cunei'):
        ctx.macros.pop(k, None)
    r = TexReducer(ctx)
    r.run(S.text, lambda i: i)
    r.flush()
    items = r.out
    # front matter: each top-level \input before the first chapter-kind heading is a page of its own (D51)
    first_ch = next((i for i, t in enumerate(items) if isinstance(t, Boundary) and t.kind == 'chapter'), None)
    ch_off = items[first_ch].loc
    fronts = [st for st, en, f in S.main_inputs if en <= ch_off]
    merged, fi = [], 0
    for t in items:
        while fi < len(fronts) and not isinstance(t.loc, tuple) and t.loc >= fronts[fi]:
            merged.append(Boundary('front', fronts[fi]))
            fi += 1
        merged.append(t)
    # the bibliography: main.bbl reduced like the text, after its boundary, titled with \bibname
    out = []
    for t in merged:
        out.append(t)
        if isinstance(t, Boundary) and t.kind == 'bibliography':
            out.append(Tok('Bibliography', t.loc))
            rb = TexReducer(ctx)
            rb.run(bbl, lambda i: ('bbl', i))
            rb.flush()
            out.extend(rb.out)
    return out, ctx, where, S


def kept_pages(S):
    """None when the course publishes every page of its notes; else (the source offsets of the headings of the
    pages it keeps, their addresses in order), decided by the converter's select_pages (build.py, L1, L2)."""
    if not CFG.get('last') and CFG.get('appendices', 'all') == 'all':
        return None
    import contextlib
    import io
    import build
    from texparse import Parser
    build.configure(CFG)
    P = Parser(S.text)
    _, pages = build.make_pages(S, P)
    build.assign_slugs(pages, P, S)
    records = build.read_records(os.path.join(TEXSRC, 'main.port'), S)
    starts = [p.a for p in pages]
    per_page = [dict() for _ in pages]
    for off, counter, num in records:
        k = bisect.bisect_right(starts, off) - 1
        if k >= 0:
            per_page[k].setdefault(counter, []).append(num)
    with contextlib.redirect_stdout(io.StringIO()):
        kept, _, _ = build.select_pages(pages, per_page, S)
    return {p.a for p in kept}, [p.slug for p in kept]


# ---------------------------------------------------------------------------------------------------------
# HTML -> stream

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
BLOCK = {'p', 'div', 'li', 'ul', 'ol', 'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figure',
         'figcaption', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'blockquote', 'section', 'header',
         'footer', 'nav', 'main', 'br', 'hr', 'aside', 'pre'}
DROP_CLASS = {'dg-web', 'dg-kicker', 'dg-secnum', 'dg-fignum', 'dg-fn-num', 'dg-lof', 'dg-contents'}
DROP_TAG = {'script', 'style', 'svg', 'button', 'template', 'noscript'}


class PageReader(HTMLParser):
    """<main> of one page -> items: ('t', text) / ('m', token) / ('fn', id) / ('fnlist',)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_main = 0
        self.stack = []                    # (tag, kind): None | 'drop' | 'math' | 'fnref' | ('fn', id) | 'fnlist'
        self.items = []
        self.fn = {}                       # id -> items
        self.cur = self.items
        self.math = None
        self.dropping = 0
        self.prev = self.next = None
        self.fnref = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get('class') or '').split()
        if tag == 'a' and 'dg-prev' in cls:
            self.prev = a.get('href')
        if tag == 'a' and 'dg-next' in cls:
            self.next = a.get('href')
        if tag == 'main':
            self.in_main += 1
        if not self.in_main or tag in VOID:
            if self.in_main and tag in BLOCK and not self.dropping:
                self.cur.append(('t', ' '))
            return
        kind = None
        if self.dropping or tag in DROP_TAG or DROP_CLASS & set(cls):
            kind = 'drop'
        elif 'math' in cls:
            kind = 'math'
            self.math = ['display' in cls, '']
        elif tag == 'sup' and 'dg-fnref' in cls:
            kind = 'fnref'
        elif 'dg-footnotes' in cls:
            kind = 'fnlist'
            self.items.append(('fnlist',))
        elif tag == 'div' and 'dg-fn' in cls:
            kind = ('fn', a.get('id'))
            self.fn[a.get('id')] = self.cur = []
        if kind == 'drop' or kind == 'fnref':
            self.dropping += 1
        if kind == 'fnref':
            self.fnref = True
        elif tag == 'a' and self.fnref:          # the mark's link names the footnote: splice it here
            self.cur.append(('fn', (a.get('href') or '').lstrip('#')))
            self.fnref = False
        if tag in BLOCK and not self.dropping:
            self.cur.append(('t', ' '))
        self.stack.append((tag, kind))

    def handle_endtag(self, tag):
        if not self.in_main or tag in VOID:
            return
        t, kind = self.stack.pop()
        if t != tag:
            raise SystemExit(f'fidelity: unbalanced HTML: <{t}> closed by </{tag}>')
        if kind in ('drop', 'fnref'):
            self.dropping -= 1
        elif kind == 'math':
            disp, src = self.math
            src = src.strip()
            if disp and src.startswith('\\[') and src.endswith('\\]'):
                src = src[2:-2]
            elif not disp and src.startswith('\\(') and src.endswith('\\)'):
                src = src[2:-2]
            self.cur.append(('m', mathtok(src, disp)))
            self.math = None
        elif isinstance(kind, tuple):
            self.cur = self.items
        if tag in BLOCK and not self.dropping:
            self.cur.append(('t', ' '))
        if tag == 'main':
            self.in_main -= 1

    def handle_data(self, data):
        if not self.in_main or self.dropping:
            return
        if self.math is not None:
            self.math[1] += data
        else:
            self.cur.append(('t', data))


def page_tokens(html: str):
    """Tokens of a page's notes text, footnotes spliced at their marks. Returns (tokens, prev, next)."""
    p = PageReader()
    p.feed(html)
    p.close()
    used = set()

    def expand(items, depth=0):
        out, txt = [], []

        def flush():
            if txt:
                out.extend(words(''.join(txt)))
                txt.clear()
        for it in items:
            if it[0] == 't':
                txt.append(it[1])
            elif it[0] == 'm':
                flush()
                out.append(it[1])
            elif it[0] == 'fn':
                flush()
                used.add(it[1])
                if it[1] not in p.fn:
                    raise SystemExit(f'fidelity: footnote mark #{it[1]} without a footnote')
                out.extend(expand(p.fn[it[1]], depth + 1))
            elif it[0] == 'fnlist':
                flush()
                out.append(('fnlist',))
        flush()
        return out

    toks = expand(p.items)
    final = []
    for t in toks:
        if isinstance(t, tuple):
            for k, body in p.fn.items():         # bodies without a mark (\footnotetext) stay here
                if k not in used:
                    final.extend(expand(body))
        else:
            final.append(t)
    return final, p.prev, p.next


# pages that are not checked, with the reason (see the header)
EXCLUDED = {'definitions': 'Definitions and notation (D53): web layer; its Notation table and terms are copies '
                           'of text checked on its own page'}


def page_order():
    """Slugs in the notes' order: the landing page, then the previous/next chain from the page without a
    previous link."""
    pages = {}
    for root, _, names in os.walk(COURSE):
        for n in names:
            if n.endswith('.html'):
                path = os.path.join(root, n)
                slug = os.path.relpath(path, COURSE)[:-5].replace(os.sep, '/')
                if slug in EXCLUDED:
                    continue
                pages[slug] = page_tokens(open(path, encoding='utf-8').read())
    firsts = [s for s, (_, prev, _n) in pages.items() if prev is None and s != 'index']
    if len(firsts) != 1:
        raise SystemExit(f'fidelity: expected one page without "previous", found {firsts}')
    order, s = ['index'], firsts[0]
    while s is not None:
        if s in order:
            raise SystemExit(f'fidelity: the previous/next chain loops at {s}')
        order.append(s)
        nxt = pages[s][2]
        s = None if nxt is None else posixpath.normpath(posixpath.join(posixpath.dirname(s), nxt))[:-5]
    missing = sorted(set(pages) - set(order))
    if missing:
        raise SystemExit(f'fidelity: pages outside the previous/next chain: {missing}')
    return order, {k: v[0] for k, v in pages.items()}


# ---------------------------------------------------------------------------------------------------------
# diff

def segments(items):
    """[(location of the page's boundary, tokens)]; hand-placed footnote texts at the end of their page."""
    segs, cur, foot, start = [], [], [], 0
    for t in items:
        if isinstance(t, Boundary):
            segs.append((start, cur + foot))
            cur, foot, start = [], [], t.loc
        elif isinstance(t, Deferred):
            foot += t.toks
        else:
            cur.append(t)
    segs.append((start, cur + foot))
    return segs


def show(toks):
    s = ' '.join(toks)
    return s if len(s) <= 400 else s[:400] + ' …'


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--course', help='one course of _port/convert/courses.py (default: every course, in turn)')
    ap.add_argument('--page', action='append', default=[])
    ap.add_argument('--self-test', action='store_true')
    ap.add_argument('--json', help='write every difference found (allowed or not) to this file')
    args = ap.parse_args(argv)
    if args.self_test:
        return self_test()
    if args.course is None and not args.page:
        # every course, each in a process of its own (the converter's page selection keeps module state)
        import subprocess
        rc = 0
        for name in courses.COURSES:
            print(f'== {name}', flush=True)
            r = subprocess.run([sys.executable, os.path.abspath(__file__), '--course', name]
                               + (sys.argv[1:] if argv is None else list(argv)))
            rc = rc or r.returncode
        return rc
    configure(args.course or 'diffgeo-gr')
    t0 = time.time()
    allow = json.load(open(ALLOW, encoding='utf-8'))
    try:
        items, ctx, where, S = tex_stream(allow.get('source', []))
    except Unknown as e:
        # the location: offsets of the expanded source
        print(f'fidelity: the LaTeX reducer stops: {e} at {_where_safe(e.loc)} (teach this tool; a figure whose '
              f'body is a picture needs a "source" entry)')
        return 1
    segs = segments(items)
    keep = kept_pages(S)
    if keep is not None:
        # a course that publishes part of its notes: the segments of the pages it keeps (and the landing page)
        starts = [st for st, _ in segs]
        on = [k == 0 or st in keep[0] for k, (st, _) in enumerate(segs)]

        def kept(loc):
            return isinstance(loc, tuple) or on[bisect.bisect_right(starts, loc) - 1]
        ctx.unknown = [(loc, msg) for loc, msg in ctx.unknown if kept(loc)]
        ctx.unlisted = [x for x in ctx.unlisted if kept(x[4])]
        segs = [sg for sg, k in zip(segs, on) if k]
    if ctx.unknown or ctx.unlisted:
        for loc, msg in ctx.unknown:
            print(f'TEACH {where(loc)}: {msg} (teach this tool)')
        for f, what, key, line, _ in ctx.unlisted:
            print(f'SOURCE {f}:{line}: {what} not on the page as text and not allow-listed '
                  f'("source" entry: file {f!r}, construct {what!r}, key {key!r})')
        print(f'fidelity: {len(ctx.unknown) + len(ctx.unlisted)} constructs of the source stop the check')
        return 1
    order, pages = page_order()
    if len(segs) != len(order):
        print(f'fidelity: {len(segs)} source segments but {len(order)} pages')
        return 1
    if keep is not None and order[1:] != keep[1]:
        bad_at = next((i for i, (x, y) in enumerate(zip(order[1:], keep[1])) if x != y), min(len(order) - 1, len(keep[1])))
        print(f'fidelity: the pages\' previous/next chain and the converter\'s page selection differ at page {bad_at + 1}: '
              f'{order[1:][bad_at:bad_at + 1]} | {keep[1][bad_at:bad_at + 1]}')
        return 1
    diffs_allow = [dict(d, _used=False) for d in allow.get('diff', [])]
    bad, allowed, all_diffs = [], 0, []
    ntext = nwords = nmath = 0
    for slug, (start, seg) in zip(order, segs):
        a = [t.val for t in seg]
        b = pages[slug]
        if args.page and slug not in args.page:
            continue
        ntext += sum(1 for x in b if not x.startswith('$') or len(x) == 1)
        nwords += sum(1 for x in b if x[0].isalnum() or x[0] == '_')
        nmath += sum(1 for x in b if x.startswith('$') and len(x) > 1)
        sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == 'equal':
                continue
            la, lb = a[i1:i2], b[j1:j2]
            at = where(seg[i1].loc) if i1 < len(seg) else (where(seg[-1].loc) if seg else where(start))
            if i1 == i2 and i1 > 0:
                at = where(seg[i1 - 1].loc)
            all_diffs.append({'page': slug, 'at': at, 'latex': la, 'page_tokens': lb})
            hit = next((d for d in diffs_allow if not d['_used'] and d['page'] == slug
                        and d['latex'] == la and d['page_tokens'] == lb), None)
            if hit:
                hit['_used'] = True
                allowed += 1
            else:
                bad.append((slug, at, la, lb))
    stale = []
    for d in diffs_allow:
        if not d['_used'] and (not args.page or d['page'] in args.page):
            stale.append(f"diff entry: page {d['page']} at {d.get('at')}: "
                         f"{show(d['latex'])} -> {show(d['page_tokens'])}")
    for e in allow.get('source', []):
        if (e['file'], e['construct'], e['key']) not in ctx.skipped:
            stale.append(f"source entry: {e['construct']} {e['key']!r} in {e['file']} (line {e.get('line')}): "
                         f"no such construct there")
    if args.json:
        json.dump(all_diffs, open(args.json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for slug, at, la, lb in bad:
        print(f'DIFF {slug}  ({at})\n   LaTeX: {show(la) or "(nothing)"}\n   page:  {show(lb) or "(nothing)"}')
    for s in stale:
        print('STALE', s)
    nsrc = sum(ctx.skipped.values())
    print(f'fidelity {CFG["name"]}: {len(order) if not args.page else len(args.page)} pages, {nwords} words '
          f'({ntext} text tokens with punctuation), {nmath} math strings compared; '
          f'{allowed} allowed differences + {nsrc} allow-listed source constructs; '
          f'{len(bad)} not allowed, {len(stale)} stale allow entries ({time.time() - t0:.1f} s)')
    return 1 if bad or stale else 0


def _where_safe(loc):
    try:
        S = source.load(TEXSRC, CFG.get('omit', ()))
        return S.where(loc) if not isinstance(loc, tuple) else f'main.bbl offset {loc[1]}'
    except Exception:
        return str(loc)


# ---------------------------------------------------------------------------------------------------------

def self_test():
    ctx = Ctx({'eq_a': ('2.3', '14'), 'sec_b': ('4.1', '30')}, {'K': ('Landau and Lifshitz', '1975')})
    ctx.macros['blueone'] = (1, None, r'\textcolor{color_blue_1}{\textbf{\textit{#1}}}')
    ctx.motivation = 'Motivation: #1'
    r = TexReducer(ctx)
    src = (r"\section{Title of \S\ref{sec_b}}\label{s} The \blueone{map} $\phi : M\to N$, see "
           r"\eqref{eq_a}~and page~\pageref{eq_a}.\footnote{A note with $x$.} ``Quoted''---it's "
           r"\textbf{bold} \citep{K}; \citet{K}. Caf\'e \'{\i}. \begin{align*} a &= b \label{x}\\ c\end{align*}"
           r"\begin{itemize}\item[(a)] one \item two\end{itemize} \ref{missing} 1--2"
           r"\footnotetext[3]{Later.} \begin{tabular}{@{}l|c} x & y \\[2pt] \hline z&w \end{tabular}")
    r.run(src, lambda i: i)
    r.flush()
    got = [t.val if isinstance(t, Tok) else '|' + t.kind if isinstance(t, Boundary)
           else '>' + ' '.join(x.val for x in t.toks) for t in r.out]
    want = ['|section', 'Title', 'of', '§', '4', '.', '1', 'The', 'map', '$\\phi:M\\toN$', ',', 'see', '(',
            '2', '.', '3', ')', 'and', 'page', '14', '.', 'A', 'note', 'with', '$x$', '.', '“', 'Quoted', '”',
            '—', 'it', '’', 's', 'bold', '(', 'Landau', 'and', 'Lifshitz', ',', '1975', ')', ';', 'Landau',
            'and', 'Lifshitz', '(', '1975', ')', '.', 'Café', 'í', '.',
            '$$\\begin{align*}a&=b\\\\c\\end{align*}$$', '(', 'a', ')', 'one', 'two', '?', '?', '1', '–', '2',
            '>Later .', 'x', 'y', 'z', 'w']
    ok = got == want
    if not ok:
        print('TeX reducer:\n  got ', got, '\n  want', want)
    html = ('<html><body><nav class="dg-prevnext dg-web"><a class="dg-prev" href="a.html">p</a></nav><main>'
            '<header class="dg-head"><p class="dg-kicker">Chapter 2</p><h1 class="dg-title">'
            '<span class="dg-secnum">'
            '2.1</span> Title</h1></header><p>The <span class="dg-term">map</span><sup class="dg-fnref">'
            '<a href="#fn-1">1</a></sup> <span class="dg-nb"><span class="math inline">\\(\\phi : M\\)</span>,'
            '</span></p><span class="math display">\\[ a =\n b \\]</span><div class="dg-web">web words</div>'
            '<figure><figcaption><span class="dg-fignum">Figure 2.1:</span> Cap&shy;tion</figcaption></figure>'
            '<div class="dg-footnotes"><div class="dg-fn" id="fn-1"><span class="dg-fn-num">1</span>'
            '<div class="dg-fn-body"><p>A note.</p></div></div><div class="dg-fn" id="fn-2">'
            '<div class="dg-fn-body">'
            '<p>Text only.</p></div></div></div></main></body></html>')
    toks, prev, nxt = page_tokens(html)
    want2 = ['Title', 'The', 'map', 'A', 'note', '.', '$\\phi:M$', ',', '$$a=b$$', 'Caption', 'Text', 'only', '.']
    if toks != want2 or prev != 'a.html' or nxt is not None:
        print('HTML reducer:\n  got ', toks, prev, nxt, '\n  want', want2)
        ok = False
    print('fidelity self-test:', 'ok' if ok else 'FAILED')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
