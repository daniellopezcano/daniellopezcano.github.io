"""A strict parser for the LaTeX subset used in the notes.

Hand-written, part of the web port.

Design rules (see _port/DECISIONS.md, D4):
  * Math is never parsed. `$..$`, `\\(..\\)`, `\\[..\\]` and the math environments
    are captured as the exact source string, so the web shows the notes' own TeX.
  * Every text-mode command and environment must be declared in CMDS / ENVS below.
    An undeclared one raises ConvertError with file:line. Nothing is dropped silently.
  * Environments in RAW_ENVS (tikzpicture, tabular, figure, ...) are captured as
    source and handed to a dedicated handler in render.py.

Node kinds (plain tuples would do; classes keep render.py readable):
  Text(s)                      literal text
  Par()                        blank line / \\par
  Math(src, kind, env)         kind: 'inline' | 'display' | 'env' (env = environment name)
  Cmd(name, star, args)        args follow the signature; missing optional = None
  Env(name, args, body, raw)   body = list of nodes, or None when raw holds the source
  Group(body)                  { ... }
Every node has .pos (offset into Source.text) for error messages.
"""
from __future__ import annotations
import re


class ConvertError(Exception):
    def __init__(self, msg: str, pos: int | None = None):
        super().__init__(msg)
        self.msg = msg
        self.pos = pos


class Node:
    __slots__ = ('pos',)


class Text(Node):
    __slots__ = ('s',)

    def __init__(self, s, pos):
        self.s, self.pos = s, pos


class Par(Node):
    __slots__ = ()

    def __init__(self, pos):
        self.pos = pos


class Math(Node):
    __slots__ = ('src', 'kind', 'env')

    def __init__(self, src, kind, env, pos):
        self.src, self.kind, self.env, self.pos = src, kind, env, pos


class Cmd(Node):
    __slots__ = ('name', 'star', 'args')

    def __init__(self, name, star, args, pos):
        self.name, self.star, self.args, self.pos = name, star, args, pos


class Env(Node):
    __slots__ = ('name', 'args', 'body', 'raw')

    def __init__(self, name, args, body, raw, pos):
        self.name, self.args, self.body, self.raw, self.pos = name, args, body, raw, pos


class Group(Node):
    __slots__ = ('body',)

    def __init__(self, body, pos):
        self.body, self.pos = body, pos


# ---------------------------------------------------------------------------
# Signatures.  One letter per argument:
#   m  mandatory, parsed as text        r  mandatory, raw source string
#   O  optional [..], parsed as text    o  optional [..], raw source string
# A trailing '*' in the key is not used: starred forms are detected generically
# for the names listed in STARRED.
# ---------------------------------------------------------------------------
CMDS: dict[str, str] = {
    # sectioning
    'chapter': 'Om', 'section': 'Om', 'subsection': 'Om', 'subsubsection': 'Om',
    # cross references, citations, links
    'label': 'r', 'ref': 'r', 'eqref': 'r', 'pageref': 'r',
    'citep': 'OOr', 'citet': 'OOr', 'citealt': 'OOr',
    'href': 'rm', 'url': 'r', 'nolinkurl': 'r', 'hypertarget': 'rm', 'hyperlink': 'rm',
    # footnotes
    'footnote': 'm', 'footnotetext': 'om',
    # font / emphasis commands with an argument
    'textbf': 'm', 'textit': 'm', 'emph': 'm', 'texttt': 'm', 'textrm': 'm', 'textsf': 'm',
    'textsc': 'm', 'textup': 'm', 'underline': 'm', 'textcolor': 'rm', 'mbox': 'm',
    # the notes' colour macros for defined terms (\blueone ... \indigotwo): added below
    # declarations (scope = rest of the enclosing group)
    'itshape': '', 'bfseries': '', 'scshape': '', 'sffamily': '', 'ttfamily': '', 'normalfont': '',
    'tiny': '', 'scriptsize': '', 'footnotesize': '', 'small': '', 'normalsize': '',
    'large': '', 'Large': '', 'LARGE': '', 'huge': '', 'Huge': '',
    'centering': '', 'color': 'r',
    # spacing and page layout (print-only ones are dropped by the renderer, see D9)
    'noindent': '', 'medskip': '', 'smallskip': '', 'bigskip': '', 'par': '',
    'vspace': 'r', 'hspace': 'r', 'hfill': '', 'quad': '', 'qquad': '', 'enspace': '',
    'newpage': '', 'clearpage': '', 'thispagestyle': 'r', 'pagestyle': 'r',
    # lists, floats
    'item': 'O', 'caption': 'Om', 'includegraphics': 'or', 'tcblower': '',
    # symbols
    'S': '', 'dots': '', 'ldots': '', 'LaTeX': '', 'TeX': '', 'textbullet': '', 'textcopyright': '',
    'textperiodcentered': '', 'checkmark': '', 'textbackslash': '', 'today': '',
    'i': '', 'j': '',                    # dotless i / j (under an accent)
    # counters (handled by the renderer where they matter)
    'setcounter': 'rr', 'stepcounter': 'r', 'addtocounter': 'rr',
    # document structure in main.tex
    'appendix': '', 'tableofcontents': '', 'listoffigures': '', 'addcontentsline': 'rrm',
    'bibliography': 'r', 'bibliographystyle': 'r',
    # TikZ figure pages: a custompage holding one tikzpicture and a \captionof{figure} (D50); elsewhere they stop the page
    'captionof': 'rOm', 'colorlet': 'rr', 'pgfdeclarelayer': 'r', 'pgfsetlayers': 'r',
    # author notes (hidden on the web, listed in REVIEW.md)
    'DLC': 'm',
}
for _c in ('blue', 'green', 'purple', 'orange', 'red', 'yellow', 'brown', 'teal', 'rose', 'olive', 'indigo'):
    CMDS[_c + 'one'] = 'm'
    CMDS[_c + 'two'] = 'm'

STARRED = {'chapter', 'section', 'subsection', 'subsubsection', 'vspace', 'hspace', 'ref', 'caption'}

# control symbols: \\ takes an optional [len]; accents take one argument
SYMBOLS = {'\\': 'o', ',': '', ';': '', ':': '', '!': '', ' ': '', '\n': '', '&': '', '%': '', '#': '',
           '_': '', '$': '', '{': '', '}': '', '-': '', '/': '', '@': '',
           "'": 'm', '`': 'm', '^': 'm', '"': 'm', '~': 'm', '=': 'm', '.': 'm'}
ACCENT_WORDS = {'c': 'm', 'v': 'm', 'u': 'm', 'H': 'm', 'k': 'm', 'r': 'm'}
CMDS.update(ACCENT_WORDS)

# Environments: signature of the arguments after \begin{name}; body parsed as text
ENVS: dict[str, str] = {
    'itemize': 'o', 'enumerate': 'o', 'center': '', 'quote': '', 'flushleft': '', 'flushright': '',
    'motivationbox': 'm', 'custompage': 'Orrr', 'minipage': 'or',
}
# Environments captured as raw source and given to a dedicated handler
RAW_ENVS = {'figure', 'tikzpicture', 'tabular', 'titlepage', 'tcolorbox', 'lstlisting', 'verbatim',
            'thebibliography'}
MATH_ENVS = {'equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*',
             'alignat', 'alignat*', 'flalign', 'flalign*', 'displaymath', 'math'}

_WORD = re.compile(r'[A-Za-z@]+')
_PARBREAK = re.compile(r'\n[ \t]*(\n[ \t]*)+')
_PLAIN = re.compile(r'[^\\${}~\n]+')


class Parser:
    def __init__(self, text: str):
        self.s = text

    # -- low-level scanning --------------------------------------------------
    def skip_ws(self, i: int, end: int, allow_par: bool = False) -> int:
        """Skip spaces/tabs and single newlines (a blank line stops unless allow_par)."""
        s = self.s
        while i < end:
            c = s[i]
            if c in ' \t':
                i += 1
            elif c == '\n':
                if not allow_par and _PARBREAK.match(s, i):
                    return i
                i += 1
            else:
                break
        return i

    def skip_cs(self, i: int) -> int:
        """i points at a backslash; return the offset just after the control sequence."""
        m = _WORD.match(self.s, i + 1)
        return m.end() if m else i + 2

    def group_end(self, i: int, end: int) -> int:
        """i points at '{'; return the offset of the matching '}'."""
        s, depth, j = self.s, 0, i
        while j < end:
            c = s[j]
            if c == '\\':
                j = self.skip_cs(j)
                continue
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return j
            j += 1
        raise ConvertError('unbalanced {', i)

    def bracket_end(self, i: int, end: int) -> int:
        """i points at '['; return the offset of the matching ']' (braces protect brackets)."""
        s, j, depth = self.s, i + 1, 0
        while j < end:
            c = s[j]
            if c == '\\':
                j = self.skip_cs(j)
                continue
            if c == '{':
                j = self.group_end(j, end)
            elif c == '[':
                depth += 1
            elif c == ']':
                if depth == 0:
                    return j
                depth -= 1
            j += 1
        raise ConvertError('unbalanced [', i)

    def env_end(self, name: str, i: int, end: int) -> tuple[int, int]:
        """i is just after \\begin{name}; return (body_end, after_end) for the matching \\end{name}."""
        b, e = '\\begin{' + name + '}', '\\end{' + name + '}'
        s, depth, j = self.s, 1, i
        while True:
            nb, ne = s.find(b, j, end), s.find(e, j, end)
            if ne == -1:
                raise ConvertError(f'no \\end{{{name}}}', i)
            if nb != -1 and nb < ne:
                depth += 1
                j = nb + len(b)
            else:
                depth -= 1
                if depth == 0:
                    return ne, ne + len(e)
                j = ne + len(e)

    def math_end(self, i: int, end: int, closer: str) -> int:
        """Scan math starting at i; return the offset of the closer ('$', '\\)' or '\\]').
        A '$' inside braces belongs to nested text (\\text{for $x$}) and is skipped."""
        s, depth, j = self.s, 0, i
        while j < end:
            c = s[j]
            if c == '\\':
                if closer != '$' and s.startswith(closer, j) and depth == 0:
                    return j
                j = self.skip_cs(j)
                continue
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            elif c == '$' and closer == '$' and depth == 0:
                return j
            j += 1
        raise ConvertError(f'unterminated math (expected {closer})', i)

    # -- arguments -------------------------------------------------------------
    def read_args(self, sig: str, i: int, end: int, pos: int):
        args = []
        for kind in sig:
            j = self.skip_ws(i, end)
            if kind in 'oO':
                if j < end and self.s[j] == '[':
                    k = self.bracket_end(j, end)
                    args.append(self.parse(j + 1, k) if kind == 'O' else self.s[j + 1:k])
                    i = k + 1
                else:
                    args.append(None)
            else:
                if j < end and self.s[j] == '{':
                    k = self.group_end(j, end)
                    args.append(self.parse(j + 1, k) if kind == 'm' else self.s[j + 1:k])
                    i = k + 1
                elif j < end and kind == 'm':            # single-token argument: \'o, \c c
                    k = self.skip_cs(j) if self.s[j] == '\\' else j + 1
                    args.append(self.parse(j, k))
                    i = k
                else:
                    raise ConvertError('missing {argument}', pos)
        return args, i

    # -- main loop ---------------------------------------------------------------
    def parse(self, i: int, end: int) -> list[Node]:
        s, out = self.s, []
        while i < end:
            c = s[i]
            if c == '\\':
                nxt = s[i + 1] if i + 1 < end else ''
                if nxt == '[':
                    k = self.math_end(i + 2, end, '\\]')
                    out.append(Math(s[i + 2:k], 'display', None, i))
                    i = k + 2
                elif nxt == '(':
                    k = self.math_end(i + 2, end, '\\)')
                    out.append(Math(s[i + 2:k], 'inline', None, i))
                    i = k + 2
                else:
                    i = self.control(i, end, out)
            elif c == '$':
                if s.startswith('$$', i):
                    raise ConvertError('$$ display math is not supported (use \\[ \\])', i)
                k = self.math_end(i + 1, end, '$')
                out.append(Math(s[i + 1:k], 'inline', None, i))
                i = k + 1
            elif c == '{':
                k = self.group_end(i, end)
                out.append(Group(self.parse(i + 1, k), i))
                i = k + 1
            elif c == '}':
                raise ConvertError('unbalanced }', i)
            elif c == '~':
                out.append(Text(' ', i))
                i += 1
            elif c == '\n':
                m = _PARBREAK.match(s, i)
                if m:
                    out.append(Par(i))
                    i = min(m.end(), end)
                else:
                    out.append(Text(' ', i))
                    i += 1
            else:
                m = _PLAIN.match(s, i, end)
                out.append(Text(m.group(0), i))
                i = m.end()
        return out

    def control(self, i: int, end: int, out: list) -> int:
        """Handle the control sequence at offset i; append node(s); return the new offset."""
        s = self.s
        m = _WORD.match(s, i + 1)
        if not m:                                   # control symbol
            sym = s[i + 1]
            if sym not in SYMBOLS:
                raise ConvertError(f'unknown control symbol \\{sym}', i)
            args, j = self.read_args(SYMBOLS[sym], i + 2, end, i)
            out.append(Cmd(sym, False, args, i))
            return j
        name, j = m.group(0), m.end()
        if name == 'begin':
            return self.begin(i, j, end, out)
        if name == 'end':
            raise ConvertError('unexpected \\end', i)
        if name in ('def', 'edef', 'newcommand', 'renewcommand', 'begingroup', 'endgroup'):
            return self.definition(name, i, j, end, out)
        if name not in CMDS:
            raise ConvertError(f'unknown command \\{name}', i)
        star = False
        if name in STARRED and j < end and s[j] == '*':
            star, j = True, j + 1
        args, k = self.read_args(CMDS[name], j, end, i)
        if not CMDS[name] or k == j:                # a control word swallows the spaces after it
            k = self.skip_ws(k, end)
        out.append(Cmd(name, star, args, i))
        return k

    def begin(self, i: int, j: int, end: int, out: list) -> int:
        s = self.s
        if s[j] != '{':
            raise ConvertError('malformed \\begin', i)
        k = self.group_end(j, end)
        name = s[j + 1:k]
        body_start = k + 1
        if name in MATH_ENVS:
            be, ae = self.env_end(name, body_start, end)
            out.append(Math(s[i:ae], 'env', name, i))
            return ae
        if name in RAW_ENVS:
            be, ae = self.env_end(name, body_start, end)
            out.append(Env(name, [], None, s[i:ae], i))
            return ae
        if name not in ENVS:
            raise ConvertError(f'unknown environment {name}', i)
        args, a = self.read_args(ENVS[name], body_start, end, i)
        be, ae = self.env_end(name, a, end)
        out.append(Env(name, args, self.parse(a, be), None, i))
        return ae

    def definition(self, name: str, i: int, j: int, end: int, out: list) -> int:
        """In-body definitions (\\def, \\edef, \\newcommand, \\renewcommand) are captured raw
        and passed to the renderer, which knows the few that occur in the notes."""
        s = self.s
        if name in ('begingroup', 'endgroup'):
            out.append(Cmd(name, False, [], i))
            return self.skip_ws(j, end)
        k = s.find('{', j, end)
        if name in ('newcommand', 'renewcommand'):        # \newcommand{\x}[n]{body} or \newcommand\x[n]{body}
            a = self.skip_ws(j, end)
            if s[a] == '{':
                a = self.group_end(a, end) + 1
            else:
                a = self.skip_cs(a)
            a = self.skip_ws(a, end)
            while a < end and s[a] == '[':
                a = self.skip_ws(self.bracket_end(a, end) + 1, end)
            k = a
        if k == -1 or s[k] != '{':
            raise ConvertError(f'cannot parse \\{name}', i)
        e = self.group_end(k, end)
        out.append(Cmd(name, False, [s[j:k].strip(), s[k + 1:e]], i))
        return self.skip_ws(e + 1, end)
