"""Texts of the title page and of the quote/dedication page, for the course landing page.

Hand-written, part of the web port. The cover and the dedication are full-page TikZ
drawings in main.tex; the landing page is a hand-written web layout, but every word on
it must be the notes' own. This module pulls those words out of the TikZ nodes, so the
landing page changes when main.tex changes. Each pattern is anchored on the LaTeX
around the text; if main.tex is restructured the build stops with a clear message
instead of publishing a stale or empty cover.
"""
from __future__ import annotations
import re

PATTERNS = {
    # title page
    'title':       r'\\spaceskip=0\.4em\s+(.*?)\\par\}',
    'subtitle':    r'\\Large\\itshape\s+(.*?)\}\\\\\[1\.1cm\]',
    'author':      r'\\LARGE\\bfseries\s+(.*?)\}\\\\\[0\.35cm\]',
    'affiliation': r'\\color\{black!75\}\\large\s+(.*?)\}\\\\\[0\.1cm\]',
    'address':     r'\\color\{black!75\}\\large\s+(R\..*?)\}\\\\\[0\.25cm\]',
    'email':       r'\\href\{mailto:([^}]+)\}',
    # quote and dedication page
    'quote':        r'inner sep=0pt\]\s*at \(Q\)\s*\{(.*?)\};',
    'quote_author': r'at \(\[yshift=-0\.72cm\]Q\)\s*\{(.*?)\};',
    'quote_source': r'at \(\[yshift=-1\.18cm\]Q\)\s*\{(.*?)\};',
    'dedication':   r'\\linespread\{1\.25\}\\selectfont\s+(.*?)\\par\};',
}


def extract(front_tex: str) -> dict[str, str]:
    """name -> LaTeX source of that piece of text (to be rendered by the normal renderer)."""
    out = {}
    for name, pat in PATTERNS.items():
        m = re.search(pat, front_tex, re.S)
        if not m:
            raise SystemExit(f'cover.py: cannot find the "{name}" text of the title/dedication page in main.tex; '
                             f'the page layout changed, update the pattern in _port/convert/cover.py')
        out[name] = m.group(1).strip()
    return out
