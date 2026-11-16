"""Text size of a figure, for the page script's zoom control (unit B33, DECISIONS D10 f).

Hand-written, part of the web port. Never writes to the notes directory.

`text_px(svg)` estimates the size of the figure's ordinary text, in CSS px at the image's intrinsic size
(the width/height the converter writes on its <img>, 1 px = 1/96 in): the page script scales it by the
displayed width over the intrinsic width and makes the zoom control prominent where that falls below
~8 px (course.js: TINY_TEXT_PX). The measure is taken from the glyphs themselves, so it holds for TikZ
figures (dvisvgm: glyph <path id> in <defs>, placed with <use>) and for PDF plots (pdftocairo: glyph
<g id="glyph-…"><path/>, placed with <use>) alike: every placed glyph's height (its outline's extent
times the scale of the <use> chain and of its ancestors' transforms), the lower quartile of those heights
(the small labels, not the sub- and superscripts at the very bottom), divided by X_HEIGHT, a typical
lowercase height in em. A figure with no glyphs (text drawn as outlines, or no text) gives None, and the
page script then assumes the notes' body size at the PDF's scale.
"""
from __future__ import annotations
import math
import re
import xml.etree.ElementTree as ET

VERSION = 'figtext-1'      # part of the cached value: bump when the measure changes
X_HEIGHT = 0.45            # lowercase height / em (Computer Modern 0.43, Latin Modern Sans 0.45, DejaVu Sans 0.55)
QUANTILE = 0.25

_SVG = '{http://www.w3.org/2000/svg}'
_XLINK = '{http://www.w3.org/1999/xlink}href'
_NUM = re.compile(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')
_TOK = re.compile(r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')
_ARGS = {'M': 2, 'L': 2, 'T': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'A': 7, 'Z': 0}


def _height(d: str) -> float:
    """Vertical extent of a path (control points included: an upper bound, close enough for glyphs)."""
    toks, i, x, y, sx, sy, ys, cmd = _TOK.findall(d), 0, 0.0, 0.0, 0.0, 0.0, [], 'M'
    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]
            i += 1
        up = cmd.upper()
        if up == 'Z':
            x, y = sx, sy
            continue
        n = _ARGS[up]
        a = [float(v) for v in toks[i:i + n]]
        i += n
        if len(a) < n:
            break
        rel = cmd.islower()
        if up == 'H':
            x = a[0] + (x if rel else 0)
        elif up == 'V':
            y = a[0] + (y if rel else 0)
        elif up == 'A':
            x, y = a[5] + (x if rel else 0), a[6] + (y if rel else 0)
        else:
            for j in range(0, n, 2):
                ys.append(a[j + 1] + (y if rel else 0))
            x, y = a[n - 2] + (x if rel else 0), a[n - 1] + (y if rel else 0)
        ys.append(y)
        if up == 'M':
            sx, sy = x, y
            cmd = 'l' if rel else 'L'
    return max(ys) - min(ys) if ys else 0.0


def _scale(transform: str | None) -> float:
    """Area scale (square root of |det|) of an SVG transform list."""
    s = 1.0
    for name, args in re.findall(r'(\w+)\s*\(([^)]*)\)', transform or ''):
        v = [float(z) for z in _NUM.findall(args)]
        if name == 'matrix' and len(v) == 6:
            s *= math.sqrt(abs(v[0] * v[3] - v[1] * v[2]))
        elif name == 'scale' and v:
            s *= math.sqrt(abs(v[0] * (v[1] if len(v) > 1 else v[0])))
    return s


def text_px(svg_path: str, width_px: float) -> float | None:
    """Estimated text size (em) of the figure in CSS px at `width_px`, the intrinsic width of its <img>."""
    root = ET.parse(svg_path).getroot()
    vb = (root.get('viewBox') or '').split()
    if len(vb) != 4 or float(vb[2]) <= 0:
        return None
    defs: dict[str, tuple] = {}
    for el in root.iter():
        i = el.get('id')
        if not i:
            continue
        if el.tag == _SVG + 'path':
            defs[i] = ('h', _height(el.get('d', '')))
        elif el.tag in (_SVG + 'symbol', _SVG + 'g') and (el.tag == _SVG + 'symbol' or i.startswith('glyph')):
            p = el.find(_SVG + 'path')
            if p is not None:
                defs[i] = ('h', _height(p.get('d', '')))
        elif el.tag == _SVG + 'use' and (el.get(_XLINK) or '').startswith('#'):
            defs[i] = ('u', el.get(_XLINK)[1:], _scale(el.get('transform')))

    def glyph(i: str, depth: int = 0) -> float | None:
        d = defs.get(i)
        if not d or depth > 8:
            return None
        if d[0] == 'h':
            return d[1]
        h = glyph(d[1], depth + 1)
        return None if h is None else h * d[2]

    heights: list[float] = []

    def walk(el, s: float):
        s *= _scale(el.get('transform'))
        if el.tag in (_SVG + 'defs', _SVG + 'symbol'):
            return
        if el.tag == _SVG + 'use' and (el.get(_XLINK) or '').startswith('#'):
            h = glyph(el.get(_XLINK)[1:])
            if h:
                heights.append(h * s)
        for c in el:
            walk(c, s)

    walk(root, 1.0)
    if len(heights) < 3:
        return None
    heights.sort()
    q = heights[int(QUANTILE * (len(heights) - 1))]
    return round(q / X_HEIGHT * width_px / float(vb[2]), 1)
