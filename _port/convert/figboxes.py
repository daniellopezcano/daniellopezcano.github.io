"""Named regions of a TikZ figure in its SVG's user units (D58). Hand-written, part of the web port.

A TikZ picture names regions with `local bounding box` scopes. For a figure that an interactive steps
through (an entry of _port/interactives.json with "steps"), the figure pipeline (figures.py) appends to
the picture, right before \\end{tikzpicture}, one \\typeout per top-level `local bounding box` with the
box's south-west and north-east corners in pt (`typeouts`); these lines draw nothing, and figures.py
checks that the SVG is byte-identical with and without them. `parse_log` reads the corners back from
the XeLaTeX log and `place` converts them to the user units of dvisvgm's SVG: dvisvgm draws the picture
inside one group whose transform maps the picture's coordinates (pt, y up) to the page (bp, y down), so
the boxes take exactly that transform. `place` then checks the result on the SVG itself: every box lies
inside the viewBox, every box sits inside a drawn frame of its own (the smallest path whose bounding box
encloses it within FRAME_MAX on every side), and the first line of text inside that frame (the panel's
heading: the glyphs whose baseline lies within HEAD_BAND of the topmost one) lies inside the box, glyph
outlines included, and opens it: its ink starts within HEAD_GAP of the box's top and left edges. Any
failure stops the build.
"""
from __future__ import annotations
import math
import re
import xml.etree.ElementTree as ET

VERSION = 'boxes-1'                # part of the figure cache key of a figure built with boxes: bump when the output changes
SVGNS = '{http://www.w3.org/2000/svg}'
XLINK = '{http://www.w3.org/1999/xlink}href'
BP_PER_PT = 72 / 72.27
FRAME_MAX = 1.5 * 72 / 2.54        # bp: a frame encloses its box with at most this much on each side
HEAD_BAND = 6.0                    # bp: glyphs whose baseline is this close to the topmost one form the heading line
HEAD_GAP = 8.0                     # bp: the heading's ink starts this close to the box's top-left corner
TOL = 0.05                         # bp


class BoxError(RuntimeError):
    pass


# -- TeX side ----------------------------------------------------------------------------------------
def _strip_comments(s: str) -> str:
    return re.sub(r'(?<!\\)%[^\n]*', '', s)


def _options(s: str, i: int) -> tuple[str, int]:
    """The [..] group of s that starts at s[i] == '[' (braces may hold ']'), and the index after it."""
    depth, j = 0, i
    while j < len(s):
        c = s[j]
        if c == '\\':
            j += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        elif c == ']' and depth == 0:
            return s[i + 1:j], j + 1
        j += 1
    raise BoxError('unbalanced scope options')


def top_level(snippet: str) -> list[str]:
    """Names of the `local bounding box` scopes at the top level of the snippet's last tikzpicture
    (a scope inside another scope is not top-level), in source order."""
    s = _strip_comments(snippet)
    a, b = s.rfind('\\begin{tikzpicture}'), s.rfind('\\end{tikzpicture}')
    if a == -1 or b < a:
        raise BoxError('no tikzpicture')
    names, depth = [], 0
    for m in re.finditer(r'\\(begin|end)\{scope\}', s[a:b]):
        if m.group(1) == 'end':
            depth -= 1
            continue
        k = a + m.end()
        while k < b and s[k] in ' \t\n':
            k += 1
        opts = _options(s, k)[0] if s[k] == '[' else ''
        n = re.search(r'local bounding box\s*=\s*([^,\]\s]+)', opts)
        if depth == 0 and n:
            names.append(n.group(1))
        depth += 1
    if depth != 0:
        raise BoxError('unbalanced scopes')
    return names


def typeouts(names: list[str]) -> str:
    return ''.join(
        f'\\pgfpointanchor{{{n}}}{{south west}}\\pgfgetlastxy{{\\PortBx}}{{\\PortBy}}'
        f'\\pgfpointanchor{{{n}}}{{north east}}\\pgfgetlastxy{{\\PortBX}}{{\\PortBY}}'
        f'\\typeout{{PORTBOX {n} \\PortBx\\space\\PortBy\\space\\PortBX\\space\\PortBY}}\n' for n in names)


def insert(snippet: str, names: list[str]) -> str:
    """The snippet with the typeout lines right before its last \\end{tikzpicture}."""
    i = snippet.rindex('\\end{tikzpicture}')
    return snippet[:i] + typeouts(names) + snippet[i:]


def parse_log(log: str, names: list[str]) -> dict[str, tuple[float, float, float, float]]:
    """name -> (x0, y0, x1, y1) in pt, picture coordinates (y up), from the PORTBOX lines of the log."""
    got = {}
    for m in re.finditer(r'^PORTBOX (\S+) (-?[\d.]+)pt (-?[\d.]+)pt (-?[\d.]+)pt (-?[\d.]+)pt\s*$', log, re.M):
        got[m.group(1)] = tuple(float(m.group(k)) for k in range(2, 6))
    missing = [n for n in names if n not in got]
    if missing:
        raise BoxError(f'no PORTBOX line in the log for {missing}')
    return {n: got[n] for n in names}


# -- SVG side ----------------------------------------------------------------------------------------
_NUM = re.compile(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')


def _mul(m, n):
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return (a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f)


def _apply(m, x, y):
    return m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]


ID = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def _transform(t: str | None):
    m = ID
    for name, args in re.findall(r'(\w+)\s*\(([^)]*)\)', t or ''):
        v = [float(x) for x in _NUM.findall(args)]
        if name == 'matrix' and len(v) == 6:
            n = tuple(v)
        elif name == 'translate':
            n = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == 'scale':
            n = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        elif name == 'rotate' and len(v) == 1:
            r = math.radians(v[0])
            n = (math.cos(r), math.sin(r), -math.sin(r), math.cos(r), 0, 0)
        else:
            raise BoxError(f'transform {name}({args}) not handled')
        m = _mul(m, n)
    return m


def _path_points(d: str) -> list[tuple[float, float]]:
    """Every end and control point of an SVG path (absolute), enough for a bounding box that encloses it."""
    pts, x, y, sx, sy = [], 0.0, 0.0, 0.0, 0.0
    sizes = {'M': 2, 'L': 2, 'T': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4, 'A': 7, 'Z': 0}
    for cmd, args in re.findall(r'([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)', d):
        v = [float(t) for t in _NUM.findall(args)]
        up, rel = cmd.upper(), cmd.islower()
        if up == 'Z':
            x, y = sx, sy
            continue
        k = sizes[up]
        for i in range(0, len(v), k):
            g = v[i:i + k]
            if len(g) < k:
                raise BoxError(f'path data: {cmd} with {len(v)} numbers')
            if up == 'H':
                x = g[0] + (x if rel else 0)
            elif up == 'V':
                y = g[0] + (y if rel else 0)
            elif up == 'A':
                x, y = g[5] + (x if rel else 0), g[6] + (y if rel else 0)
            else:
                for j in range(0, k, 2):
                    px, py = g[j] + (x if rel else 0), g[j + 1] + (y if rel else 0)
                    pts.append((px, py))
                x, y = pts[-1]
            if up in 'HVA':
                pts.append((x, y))
            if up == 'M' and i == 0:
                sx, sy = x, y
    return pts


def _bbox(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))


def _inside(inner, outer, tol=TOL):
    return (inner[0] >= outer[0] - tol and inner[1] >= outer[1] - tol
            and inner[2] <= outer[2] + tol and inner[3] <= outer[3] + tol)


def _scan(svg_text: str):
    """(viewBox, picture transform, drawn paths [(bbox)], glyphs [(origin, outline bbox)]) of a dvisvgm SVG."""
    root = ET.fromstring(svg_text)
    vb = [float(v) for v in _NUM.findall(root.get('viewBox', ''))]
    if len(vb) != 4:
        raise BoxError('SVG without a viewBox')
    defs = {}
    for e in root.iter():
        if e.tag in (SVGNS + 'path', SVGNS + 'use') and e.get('id'):
            defs[e.get('id')] = e
    glyph_box = {}

    def outline(gid, depth=0):              # bbox of a glyph definition in its own units
        if gid in glyph_box:
            return glyph_box[gid]
        e = defs.get(gid)
        bb = None
        if e is not None and depth < 8:
            if e.tag == SVGNS + 'path':
                pts = _path_points(e.get('d', ''))
                bb = _bbox(pts) if pts else None
            else:
                inner = outline(e.get(XLINK, '').lstrip('#'), depth + 1)
                if inner:
                    m = _mul(_transform(e.get('transform')), (1, 0, 0, 1, float(e.get('x', 0)), float(e.get('y', 0))))
                    bb = _bbox([_apply(m, inner[0], inner[1]), _apply(m, inner[2], inner[1]),
                                _apply(m, inner[0], inner[3]), _apply(m, inner[2], inner[3])])
        glyph_box[gid] = bb
        return bb

    page = next((e for e in root.iter(SVGNS + 'g') if e.get('id') == 'page1'), None)
    if page is None:
        raise BoxError("no <g id='page1'> in the SVG")
    pic = next((c for c in page if c.tag == SVGNS + 'g' and c.get('transform')), None)
    if pic is None:
        raise BoxError('no picture group with a transform in page1')
    m0 = _transform(page.get('transform'))
    mp = _mul(m0, _transform(pic.get('transform')))
    if abs(mp[1]) > 1e-9 or abs(mp[2]) > 1e-9 or abs(mp[0] - BP_PER_PT) > 1e-5 or abs(mp[3] + BP_PER_PT) > 1e-5:
        raise BoxError(f'picture transform {mp} is not pt -> bp with y flipped')
    paths, glyphs = [], []

    def walk(e, m):
        for c in e:
            mc = _mul(m, _transform(c.get('transform')))
            if c.tag == SVGNS + 'g':
                walk(c, mc)
            elif c.tag == SVGNS + 'path':
                pts = _path_points(c.get('d', ''))
                if pts:
                    paths.append(_bbox([_apply(mc, *p) for p in pts]))
            elif c.tag == SVGNS + 'use':
                x, y = float(c.get('x', 0)), float(c.get('y', 0))
                bb = outline(c.get(XLINK, '').lstrip('#'))
                ink = None
                if bb:
                    ink = _bbox([_apply(mc, x + bb[0], y + bb[1]), _apply(mc, x + bb[2], y + bb[1]),
                                 _apply(mc, x + bb[0], y + bb[3]), _apply(mc, x + bb[2], y + bb[3])])
                glyphs.append((_apply(mc, x, y), ink))
    walk(page, m0)
    return vb, mp, paths, glyphs


def place(svg_text: str, boxes_pt: dict) -> dict:
    """The boxes in the SVG's user units, checked against the drawing (see the module docstring).
    Returns ({'viewBox': [x, y, w, h], 'boxes': {name: [x, y, w, h]} (rounded to 1e-3), 'order': names in
    source order (the cache stores dicts with sorted keys)}, per-box check details)."""
    vb, mp, paths, glyphs = _scan(svg_text)
    view = (vb[0], vb[1], vb[0] + vb[2], vb[1] + vb[3])
    out, frames, stats = {}, {}, {}
    for name, (x0, y0, x1, y1) in boxes_pt.items():
        bb = _bbox([_apply(mp, x0, y0), _apply(mp, x1, y1)])
        if not _inside(bb, view):
            raise BoxError(f'box {name} {bb} is not inside the viewBox {view}')
        cands = [p for p in paths if _inside(bb, p) and all(d <= FRAME_MAX for d in
                                                              (bb[0] - p[0], bb[1] - p[1], p[2] - bb[2], p[3] - bb[3]))]
        if not cands:
            raise BoxError(f'box {name}: no drawn frame encloses it within {FRAME_MAX:.1f} bp')
        fr = min(cands, key=lambda p: (p[2] - p[0]) * (p[3] - p[1]))
        if fr in frames.values():
            raise BoxError(f'box {name}: its frame is also the frame of {[k for k, v in frames.items() if v == fr]}')
        frames[name] = fr
        inner = [g for g in glyphs if _inside((*g[0], *g[0]), fr, 0)]
        if not inner:
            raise BoxError(f'box {name}: no text inside its frame')
        top = min(g[0][1] for g in inner)
        head = [g for g in inner if g[0][1] <= top + HEAD_BAND]
        bad = [g for g in head if not _inside(g[1] or (*g[0], *g[0]), bb)]
        if len(head) < 3 or bad:
            raise BoxError(f'box {name}: its heading ({len(head)} glyphs at y = {top:.2f}) is not inside it '
                           f'({len(bad)} glyph(s) outside {bb})')
        ink = _bbox([g[1][:2] for g in head if g[1]] + [g[1][2:] for g in head if g[1]])
        if ink[1] - bb[1] > HEAD_GAP or ink[0] - bb[0] > HEAD_GAP:
            raise BoxError(f'box {name}: its heading starts {ink[0] - bb[0]:.2f} bp from its left edge and '
                           f'{ink[1] - bb[1]:.2f} bp below its top (at most {HEAD_GAP} bp)')
        stats[name] = {'frame': [round(a - b, 3) for a, b in zip(fr, bb)], 'heading_glyphs': len(head),
                       'heading_gap': [round(ink[0] - bb[0], 2), round(ink[1] - bb[1], 2)]}
        out[name] = [round(bb[0], 3), round(bb[1], 3), round(bb[2] - bb[0], 3), round(bb[3] - bb[1], 3)]
    return {'viewBox': [round(v, 6) for v in vb], 'boxes': out, 'order': list(out)}, stats
