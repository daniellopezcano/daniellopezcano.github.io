"""The landing page's texts of the Lyα notes, from their title page (Lyα DECISIONS L5, L6). Hand-written,
part of the web port.

The notes are an `article` whose `titlepage` prints, in this order: the title (\\notetitle), the subtitle
(\\notesubtitle), the authors (\\noteauthors), three affiliations, the version (\\noteversion), the date
(\\notedate = \\today), the contact e-mail (\\noteemails), the abstract, and a "Keywords:" line; before the
first \\section come only \\pagenumbering, \\tableofcontents and spacing.

The web shows the title, subtitle, version, abstract and keywords, in the notes' words. The authors,
affiliations and e-mail are left out (the notes are to be published with co-authors: L5); the date becomes
"Last updated" (L6). extract() reads each piece with patterns anchored on the source: anything on the title
page or before the first section that it does not account for stops the build, so that nothing new (an
acknowledgement, another author line) reaches the web, or is dropped, unnoticed.
"""
from __future__ import annotations
import re

META = ('notetitle', 'notesubtitle', 'noteversion')          # shown (the notes' words)
# Left out (L5): \noteauthors, \noteaffiliationone..three, \noteemails. They cannot reach a page by another way:
# the parser knows none of them, so a use outside the title page stops that page.

# The title page, piece by piece. Each pattern must match exactly once; what remains must be layout only.
_PIECES = [
    ('title', r'\{\\Huge\\bfseries\s*\\notetitle\\par\}'),
    ('subtitle', r'\{\\Large\s*\\notesubtitle\\par\}'),
    ('authors', r'\{\\large\s*\\noteauthors\\par\}'),
    ('affil1', r'\{\\scriptsize\s*\$\^\{1\}\$~\\noteaffiliationone\\par\}'),
    ('affil2', r'\{\\scriptsize\s*\$\^\{2\}\$~\\noteaffiliationtwo\\par\}'),
    ('affil3', r'\{\\scriptsize\s*\$\^\{3\}\$~\\noteaffiliationthree\\par\}'),
    ('version', r'\{\\normalsize\s*\\noteversion\\par\}'),
    ('date', r'\{\\normalsize\s*\\notedate\\par\}'),
    ('email', r'\{\\footnotesize\s*Contact email:\s*\\noteemails\\par\s*\}'),
    ('abstract', r'\\begin\{abstract\}(?P<abstract>.*?)\\end\{abstract\}'),
    # the keywords line with its bold label "Keywords:", as the notes print it (lya.css: p.dg-keywords strong)
    ('keywords', r'\\noindent(?P<keywords>\\textbf\{Keywords:\}[^\n]*)\n'),
]
# Pieces that are left out (L5) and may be absent: the author's main.tex of 2026-11-16 comments out the second and
# third affiliation lines (L28). Absent is safe, since they never reach the page; present, they must match once.
_OPTIONAL = ('affil2', 'affil3')
_LAYOUT = re.compile(r'(?:\s|\\centering|\\vspace\*?\{[^{}]*\})*')
_FRONT_REST = re.compile(r'\s*(?:\\pagenumbering\{(?:roman|arabic)\}|\\tableofcontents|\\bigskip|\\newpage|\\clearpage|\s)*')


def _macro(preamble: str, name: str) -> str:
    """The body of \\newcommand{\\name}{body} in the preamble (balanced braces)."""
    m = re.search(r'\\newcommand\s*\{\\' + name + r'\}\s*\{', preamble)
    if not m:
        raise SystemExit(f'cover_lya.py: no \\newcommand{{\\{name}}} in the preamble of main.tex')
    i, depth = m.end() - 1, 0
    for j in range(i, len(preamble)):
        c = preamble[j]
        if c == '\\':
            continue
        if c == '{' and preamble[j - 1] != '\\':
            depth += 1
        elif c == '}' and preamble[j - 1] != '\\':
            depth -= 1
            if depth == 0:
                return preamble[i + 1:j]
    raise SystemExit(f'cover_lya.py: unbalanced braces in \\newcommand{{\\{name}}}')


def extract(preamble: str, front: str, base: int) -> dict:
    """`front`: the source before the first \\section (offset `base` in the source text). Returns the TeX of
    'title', 'subtitle', 'version' (from the preamble) and the offsets of the abstract body and of the keywords
    (('abstract', a, b), ('keywords', a, b)), so that they are parsed in place (errors give file:line)."""
    m = re.match(r'\s*\\begin\{titlepage\}(.*?)\\end\{titlepage\}', front, re.S)
    if not m:
        raise SystemExit('cover_lya.py: the Lyα notes no longer begin with a titlepage environment; update cover_lya.py')
    if not _FRONT_REST.fullmatch(front, m.end()):
        raise SystemExit(f'cover_lya.py: something after the title page and before the first section: '
                         f'{front[m.end():].strip()[:80]!r}; update cover_lya.py')
    body, off = m.group(1), m.start(1)
    spans, out = [], {}
    for key, rx in _PIECES:
        found = list(re.finditer(rx, body, re.S))
        if key in _OPTIONAL and not found:
            continue
        if len(found) != 1:
            raise SystemExit(f'cover_lya.py: the title page piece "{key}" is found {len(found)} times (expected once); '
                             f'the title page changed, update cover_lya.py')
        f = found[0]
        spans.append((f.start(), f.end()))
        if key in ('abstract', 'keywords'):
            out[key] = (base + off + f.start(key), base + off + f.end(key))
    spans.sort()
    pos = 0
    for a, b in spans:
        if not _LAYOUT.fullmatch(body, pos, a):
            raise SystemExit(f'cover_lya.py: unknown content on the title page: {body[pos:a].strip()[:80]!r}; update cover_lya.py')
        pos = b
    if not _LAYOUT.fullmatch(body, pos):
        raise SystemExit(f'cover_lya.py: unknown content on the title page: {body[pos:].strip()[:80]!r}; update cover_lya.py')
    for name in META:
        out[name] = _macro(preamble, name)
    return out

