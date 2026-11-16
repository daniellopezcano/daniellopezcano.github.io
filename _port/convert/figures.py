"""Figure assets for the web pages: PDF/PNG/JPG graphics and TikZ figure bodies.

Hand-written, part of the web port. Never writes to the notes directory.

`Figures.graphic(path, name)` turns a file used with \\includegraphics into a web
asset: a PDF becomes a vector SVG (the smaller correct one of `pdftocairo -svg`
and `dvisvgm --pdf`) unless that SVG exceeds SVG_MAX bytes, in which case it
becomes a WebP rendered RASTER_PDF_PX wide; a PNG/JPG is copied when it is small
and re-encoded to WebP (at most RASTER_IMG_PX wide) otherwise.

`Figures.tex(snippet, name, textwidth_cm)` typesets one figure body (a
tikzpicture with its local \\def/\\definecolor lines) in a standalone document
made of the notes' preamble, compiled with XeLaTeX to XDV and converted with
dvisvgm to a tight SVG. Every \\ref / \\ref* in the snippet is wrapped in a
`<g class='dg-xref' data-label='LABEL'>` group so the page can make it a link.
The main .aux is copied in first so the numbers are those of the PDF. With
boxes=True (D58) it also returns the picture's top-level `local bounding box`
regions in the SVG's user units (figboxes.py), cached with the SVG and written
to figures/<name>.boxes.json.

Every SVG figure and every figure made from a PDF also carries `text`: the size of its
ordinary text in CSS px at its intrinsic size (figtext.py; None when it has no glyphs),
measured once and kept in the cache entry; the page makes its zoom control prominent where
that text would be shown below ~8 px (D10 f).

Results are cached by content hash in _port/.work/figcache/: an unchanged
figure is never rebuilt, and an output file that already holds the cached bytes
is not touched. Sizes are CSS px (1 px = 1/96 in; a PDF point is 1/72 in).
"""
from __future__ import annotations
import filecmp
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile

import figboxes
import figtext

VERSION = 'figures-2'          # bump to invalidate the whole cache
SVG_MAX = 400_000              # bytes: larger vector output becomes WebP
RASTER_PDF_PX = 1800           # pixel width of a PDF rendered to WebP (2.3x the 780 px text column: sharp on HiDPI and when zoomed)
WEBP_Q = 80                    # visually lossless for line art on white; the size of docs/ counts twice
IMG_COPY_MAX = 300_000         # bytes: PNG/JPG smaller than this are copied as is
RASTER_IMG_PX = 2000           # PNG/JPG re-encoded to WebP are capped at this width
PX_PER_BP = 96 / 72
BP_PER_CM = 72 / 2.54
# Round-trip check of a PDF->SVG conversion (see _compare): the PDF and the SVG
# (Inkscape -> PDF) are rendered in grey at COMPARE_PX wide and box-blurred 3x3,
# so that antialiasing and hairline widths do not count but missing text or
# dropped transparency does. Measured on the notes' plots: correct conversions
# stay below 0.8 % of pixels differing by more than 64; conversions that lose the
# text or the transparency are at 2 % and above.
COMPARE_PX = 600
COMPARE_MEAN = 8.0             # mean |difference| (0..255) allowed
COMPARE_FRAC = 0.01            # fraction of pixels differing by more than 64 allowed

KINDS = ('svg', 'webp', 'png', 'jpg')

# Wraps every \ref and \ref* in dvisvgm raw specials. \NewCommandCopy (not \let)
# because hyperref's \ref is robust: \let would copy only the \protect wrapper,
# which would then call the redefinition and loop. \detokenize keeps labels with
# _ or : literal in the attribute. An undefined label typesets "??" as usual.
LINK_HOOK = r"""\makeatletter
\AtBeginDocument{\NewCommandCopy\port@ref\ref
  \DeclareRobustCommand\ref{\@ifstar\port@refw\port@refw}%
  \def\port@refw#1{\special{dvisvgm:raw <g class='dg-xref' data-label='\detokenize{#1}'>}%
    \port@ref*{#1}\special{dvisvgm:raw </g>}}}
\makeatother
"""

# TikZ must write dvisvgm specials (its XeTeX driver writes PDF operators that
# dvisvgm does not draw); this has to come before tikz is loaded.
DRIVER = '\\def\\pgfsysdriver{pgfsys-dvisvgm.def}\n'

PORT_HOOKS_RE = re.compile(r'^[ \t]*\\input\{port-hooks\}[ \t]*\n?', re.M)


class FigureError(RuntimeError):
    pass


def _run(cmd: list[str], cwd: str | None = None, log: str | None = None, timeout: int = 600) -> str:
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, errors='replace',
                           timeout=timeout)
    except subprocess.TimeoutExpired:
        raise FigureError(f'timeout: {" ".join(cmd)}')
    if p.returncode != 0:
        tail = (p.stdout + p.stderr).strip().splitlines()[-25:]
        if log and os.path.exists(log):
            with open(log, errors='replace') as f:
                lines = f.read().splitlines()
            # the first TeX error and what follows it, else the end of the log
            err = next((i for i, l in enumerate(lines) if l.startswith('!')), None)
            tail = lines[err:err + 20] if err is not None else lines[-25:]
        raise FigureError(f'command failed ({p.returncode}): {" ".join(cmd)}\n' + '\n'.join(tail))
    return p.stdout + p.stderr


def _sha(*parts) -> str:
    h = hashlib.sha256()
    for p in parts:
        if isinstance(p, str):
            p = p.encode('utf-8')
        h.update(len(p).to_bytes(8, 'big'))
        h.update(p)
    return h.hexdigest()


# -- sizes -----------------------------------------------------------------
def _pdf_size_bp(pdf: str) -> tuple[float, float]:
    out = _run(['pdfinfo', pdf])
    m = re.search(r'Page size:\s*([\d.]+) x ([\d.]+) pts', out)
    if not m:
        raise FigureError(f'no page size in pdfinfo output for {pdf}')
    w, h = float(m.group(1)), float(m.group(2))
    m = re.search(r'Page rot:\s*(\d+)', out)
    if m and int(m.group(1)) % 180 == 90:
        w, h = h, w
    return w, h


def _svg_size_bp(svg: str) -> tuple[float, float]:
    with open(svg, encoding='utf-8', errors='replace') as f:
        head = f.read(4096)
    m = re.search(r'<svg\b[^>]*>', head, re.S)
    if not m:
        raise FigureError(f'not an SVG: {svg}')
    tag = m.group(0)
    vals = []
    for attr in ('width', 'height'):
        a = re.search(attr + r"""=['"]([\d.]+)(pt|px|bp)?['"]""", tag)
        if not a:
            raise FigureError(f'no {attr} in {svg}')
        v = float(a.group(1))
        # dvisvgm writes PostScript points as "pt"; cairo writes bare numbers (points too)
        vals.append(v * 72 / 96 if a.group(2) == 'px' else v)
    return vals[0], vals[1]


def _image_info(path: str) -> tuple[int, int, float, float]:
    """(pixel width, pixel height, x dpi, y dpi) of a PNG or JPEG; 72 dpi when unset,
    which is what XeTeX assumes."""
    with open(path, 'rb') as f:
        data = f.read()
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        w = int.from_bytes(data[16:20], 'big')
        h = int.from_bytes(data[20:24], 'big')
        dx = dy = 72.0
        i = 8
        while i + 8 <= len(data):
            n = int.from_bytes(data[i:i + 4], 'big')
            t = data[i + 4:i + 8]
            if t == b'pHYs':
                px, py, unit = (int.from_bytes(data[i + 8:i + 12], 'big'),
                                int.from_bytes(data[i + 12:i + 16], 'big'), data[i + 16])
                if unit == 1 and px and py:
                    dx, dy = px * 0.0254, py * 0.0254
                break
            if t in (b'IDAT', b'IEND'):
                break
            i += 12 + n
        return w, h, dx, dy
    if data[:2] == b'\xff\xd8':
        dx = dy = 72.0
        i = 2
        while i + 4 <= len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            mk = data[i + 1]
            if mk in (0xD8, 0x01) or 0xD0 <= mk <= 0xD7:
                i += 2
                continue
            n = int.from_bytes(data[i + 2:i + 4], 'big')
            seg = data[i + 4:i + 2 + n]
            if mk == 0xE0 and seg[:5] == b'JFIF\x00':
                unit = seg[7]
                x, y = int.from_bytes(seg[8:10], 'big'), int.from_bytes(seg[10:12], 'big')
                if unit == 1 and x and y:
                    dx, dy = float(x), float(y)
                elif unit == 2 and x and y:
                    dx, dy = x * 2.54, y * 2.54
            elif mk in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h = int.from_bytes(seg[1:3], 'big')
                w = int.from_bytes(seg[3:5], 'big')
                return w, h, dx, dy
            i += 2 + n
    raise FigureError(f'unsupported image: {path}')


# -- round-trip check ------------------------------------------------------
def _read_pgm(path: str) -> tuple[int, int, bytes]:
    with open(path, 'rb') as f:
        data = f.read()
    tok = re.match(rb'P5\s+(\d+)\s+(\d+)\s+(\d+)\s', data)
    if not tok:
        raise FigureError(f'bad PGM {path}')
    w, h = int(tok.group(1)), int(tok.group(2))
    return w, h, data[tok.end():tok.end() + w * h]


def _render_pgm(pdf: str, out_base: str, w: int, h: int) -> tuple[int, int, bytes]:
    _run(['pdftoppm', '-gray', '-singlefile', '-scale-to-x', str(w), '-scale-to-y', str(h),
          pdf, out_base])
    return _read_pgm(out_base + '.pgm')


def _blur3(w: int, h: int, a: bytes) -> list[int]:
    """3x3 box sum (separable; edges use the available neighbours, unnormalised x9)."""
    rows = []
    for y in range(h):
        r = a[y * w:(y + 1) * w]
        s = [0] * w
        for x in range(w):
            s[x] = r[x] + (r[x - 1] if x else 0) + (r[x + 1] if x + 1 < w else 0)
        rows.append(s)
    out = []
    for y in range(h):
        up = rows[y - 1] if y else None
        dn = rows[y + 1] if y + 1 < h else None
        c = rows[y]
        for x in range(w):
            out.append(c[x] + (up[x] if up else 0) + (dn[x] if dn else 0))
    return out


def _compare(pdf: str, svg: str, tmp: str) -> tuple[float, float]:
    """Render `pdf` and `svg` (via Inkscape -> PDF) to grey pixmaps of the same size,
    blur both; return (mean |difference|, fraction of pixels differing by more than 64)."""
    wbp, hbp = _pdf_size_bp(pdf)
    w = COMPARE_PX
    h = max(1, round(COMPARE_PX * hbp / wbp))
    rt = os.path.join(tmp, 'roundtrip.pdf')
    _run(['inkscape', '--export-type=pdf', f'--export-filename={rt}', svg])
    _, _, a = _render_pgm(pdf, os.path.join(tmp, 'ref'), w, h)
    _, _, b = _render_pgm(rt, os.path.join(tmp, 'rt'), w, h)
    if len(a) != len(b) or len(a) != w * h:
        return 255.0, 1.0
    ba, bb = _blur3(w, h, a), _blur3(w, h, b)
    tot = 0
    big = 0
    for x, y in zip(ba, bb):           # sums of 9 pixels: compare at 9x scale
        d = x - y if x > y else y - x
        tot += d
        if d > 9 * 64:
            big += 1
    return tot / (9 * len(a)), big / len(a)


class Figures:
    def __init__(self, repo_root: str, preamble: str, aux_path: str, out_dir: str | None = None):
        self.repo = os.path.abspath(repo_root)
        self.src = os.path.join(self.repo, '_port', '.work', 'tex', 'src')
        self.work = os.path.join(self.repo, '_port', '.work', 'figs')
        self.cache = os.path.join(self.repo, '_port', '.work', 'figcache')
        self.out = os.path.abspath(out_dir) if out_dir else os.path.join(
            self.repo, 'notes', 'diffgeo-gr', 'figures')
        self.preamble = PORT_HOOKS_RE.sub('', preamble)
        self.aux_path = aux_path
        with open(aux_path, 'rb') as f:
            self.aux = f.read()
        self.log: list[str] = []      # one line per figure built (not per cache hit)
        self.stats: dict[str, dict] = {}   # name -> details of the last build (for the test driver)
        for d in (self.work, self.cache, self.out):
            os.makedirs(d, exist_ok=True)
        for sub in ('fonts', 'plots'):
            link = os.path.join(self.work, sub)
            target = os.path.join('..', 'tex', 'src', sub)
            if os.path.islink(link) and os.readlink(link) == target:
                continue
            if os.path.lexists(link):
                os.remove(link)
            os.symlink(target, link)

    # -- cache -------------------------------------------------------------
    def _cached(self, key: str, name: str) -> dict | None:
        meta = os.path.join(self.cache, key + '.json')
        if not os.path.exists(meta):
            return None
        with open(meta) as f:
            info = json.load(f)
        blob = os.path.join(self.cache, key + '.' + info['kind'])
        if not os.path.exists(blob):
            return None
        return self._install(blob, info, name)

    def _store(self, key: str, built: str, info: dict, name: str) -> dict:
        blob = os.path.join(self.cache, key + '.' + info['kind'])
        shutil.copyfile(built, blob)
        with open(os.path.join(self.cache, key + '.json'), 'w') as f:
            json.dump(info, f, sort_keys=True)
        return self._install(blob, info, name)

    def _install(self, blob: str, info: dict, name: str) -> dict:
        out = os.path.join(self.out, name + '.' + info['kind'])
        if not (os.path.exists(out) and filecmp.cmp(blob, out, shallow=False)):
            shutil.copyfile(blob, out)
        for k in KINDS:            # an earlier build of this figure in another format
            if k != info['kind']:
                stale = os.path.join(self.out, name + '.' + k)
                if os.path.exists(stale):
                    os.remove(stale)
        boxes = os.path.join(self.out, name + '.boxes.json')
        if 'boxes' in info:                # D58: the named regions of a TikZ figure, part of the cached output
            j = lambda v: json.dumps(v, ensure_ascii=False)
            text = ('{\n "_generated": ' + j(f'Generated by _port/convert/figures.py from the TikZ build of {name}.svg '
                                            '(D58); do not edit. Rectangles [x, y, width, height] in the user units of '
                                            'the SVG (its viewBox), one per top-level local bounding box, in source order.')
                    + ',\n "figure": ' + j(f'{name}.svg') + ',\n "viewBox": ' + j(info['boxes']['viewBox'])
                    + ',\n "boxes": {\n' + ',\n'.join(f'  {j(k)}: {j(info["boxes"]["boxes"][k])}' for k in info['boxes']['order'])
                    + '\n }\n}\n')
            if not (os.path.exists(boxes) and open(boxes, encoding='utf-8').read() == text):
                with open(boxes, 'w', encoding='utf-8') as fh:
                    fh.write(text)
        elif os.path.exists(boxes):
            os.remove(boxes)
        res = dict(info)
        res['src'] = f'figures/{name}.{info["kind"]}'
        return res

    # -- \includegraphics ----------------------------------------------------
    def _resolve(self, path: str) -> str:
        p = os.path.join(self.src, path)
        if os.path.splitext(path)[1]:
            if os.path.exists(p):
                return p
        else:
            for ext in ('.pdf', '.png', '.jpg', '.jpeg', '.PDF', '.PNG', '.JPG', '.JPEG'):
                if os.path.exists(p + ext):
                    return p + ext
        raise FigureError(f'graphic not found: {path} (looked in {self.src})')

    def graphic(self, path: str, name: str) -> dict:
        f = self._resolve(path)
        ext = os.path.splitext(f)[1].lower()
        with open(f, 'rb') as fh:
            data = fh.read()
        key = _sha(VERSION, 'graphic', ext, data, str((SVG_MAX, RASTER_PDF_PX, WEBP_Q)))   # settings are part of the key
        pdf = f if ext == '.pdf' else None
        hit = self._cached(key, name)
        if hit:
            return self._text(key, hit, pdf)
        with tempfile.TemporaryDirectory(dir=self.work, prefix='g-') as tmp:
            if ext == '.pdf':
                built, info, stats = self._pdf(f, tmp)
            else:
                built, info, stats = self._raster(f, ext, len(data), tmp)
            self.stats[name] = stats
            self.log.append(f'built {name}.{info["kind"]} from {path}')
            return self._text(key, self._store(key, built, info, name), pdf)

    def _text(self, key: str, res: dict, pdf: str | None = None) -> dict:
        """Adds `text` (figtext.py) to a figure's result: measured on its SVG, or for a PDF rendered to WebP on
        the PDF's own text (pdftocairo SVG of it, in a temporary directory); a raster photo has none. Measured once
        per cache entry (and again when figtext.VERSION changes); the value is stored in the entry's JSON."""
        meta = os.path.join(self.cache, key + '.json')
        with open(meta) as fh:
            info = json.load(fh)
        if info.get('text_v') != figtext.VERSION:
            t = None
            if info['kind'] == 'svg':
                t = figtext.text_px(os.path.join(self.out, os.path.basename(res['src'])), info['width'])
            elif pdf:
                with tempfile.TemporaryDirectory(dir=self.work, prefix='t-') as tmp:
                    svg = os.path.join(tmp, 'text.svg')
                    _run(['pdftocairo', '-svg', pdf, svg])
                    t = figtext.text_px(svg, info['width'])
            info.update(text=t, text_v=figtext.VERSION)
            with open(meta, 'w') as fh:
                json.dump(info, fh, sort_keys=True)
        out = dict(res)
        out['text'] = info['text']
        return out

    def image_size(self, path: str) -> tuple[int, int]:
        from PIL import Image
        with Image.open(self._resolve(path)) as im:
            return im.size

    def crop(self, path: str, name: str, box: tuple, out_px: int, quality: int) -> dict:
        """The part of a raster graphic that the PDF shows (a TikZ clip), re-encoded small as WebP (unit B4:
        the About the Author header). box = (left, top, right, bottom) as fractions of the image; the result
        is out_px wide (never wider than the cropped pixels)."""
        from PIL import Image
        f = self._resolve(path)
        with open(f, 'rb') as fh:
            data = fh.read()
        key = _sha(VERSION, 'crop', data, str((box, out_px, quality)))
        hit = self._cached(key, name)
        if hit:
            return hit
        with Image.open(f) as im:
            w, h = im.size
        l, t, r, b = (round(v) for v in (box[0] * w, box[1] * h, box[2] * w, box[3] * h))
        if not (0 <= l < r <= w and 0 <= t < b <= h):
            raise FigureError(f'{name}: crop box {box} lies outside the image {path} ({w}x{h})')
        cw, ch = r - l, b - t
        ow = min(out_px, cw)
        oh = round(ch * ow / cw)
        with tempfile.TemporaryDirectory(dir=self.work, prefix='c-') as tmp:
            webp = os.path.join(tmp, 'crop.webp')
            _run(['cwebp', '-quiet', '-q', str(quality), '-crop', str(l), str(t), str(cw), str(ch),
                  '-resize', str(ow), str(oh), f, '-o', webp])
            self.stats[name] = {'kind': 'webp', 'input_bytes': len(data), 'pixels': f'{w}x{h}', 'crop': [l, t, cw, ch]}
            self.log.append(f'built {name}.webp from {path} (crop)')
            return self._store(key, webp, {'width': ow, 'height': oh, 'kind': 'webp'}, name)

    def _pdf(self, pdf: str, tmp: str):
        wbp, hbp = _pdf_size_bp(pdf)
        size = {'width': round(wbp * PX_PER_BP), 'height': round(hbp * PX_PER_BP)}
        cands = {}
        a = os.path.join(tmp, 'cairo.svg')
        _run(['pdftocairo', '-svg', pdf, a])
        cands['pdftocairo'] = a
        b = os.path.join(tmp, 'dvisvgm.svg')
        _run(['dvisvgm', '--pdf', '--no-fonts', '--optimize', '-o', b, pdf])
        cands['dvisvgm'] = b
        stats = {'pdf_bytes': os.path.getsize(pdf)}
        for tool, svg in cands.items():
            stats[tool] = {'bytes': os.path.getsize(svg), 'ok': None}   # None: not checked
        # smallest first; only an SVG small enough to be used is checked (the check is slow)
        for tool, svg in sorted(cands.items(), key=lambda kv: stats[kv[0]]['bytes']):
            if stats[tool]['bytes'] > SVG_MAX:
                break
            mean, frac = _compare(pdf, svg, tmp)
            sw, sh = _svg_size_bp(svg)
            ok = (mean <= COMPARE_MEAN and frac <= COMPARE_FRAC
                  and abs(sw - wbp) < 1 and abs(sh - hbp) < 1)   # same page size as the PDF
            stats[tool].update(mean_diff=round(mean, 3), frac_diff=round(frac, 5), ok=ok)
            if ok:
                stats['chosen_tool'] = tool
                stats['kind'] = 'svg'
                return svg, dict(size, kind='svg'), stats
        # no correct SVG within SVG_MAX: render it
        dpi = RASTER_PDF_PX / (wbp / 72)
        base = os.path.join(tmp, 'page')
        _run(['pdftoppm', '-png', '-singlefile', '-r', f'{dpi:.4f}', pdf, base])
        webp = os.path.join(tmp, 'page.webp')
        _run(['cwebp', '-quiet', '-q', str(WEBP_Q), base + '.png', '-o', webp])
        stats['kind'] = 'webp'
        stats['chosen_tool'] = 'pdftoppm+cwebp'
        return webp, dict(size, kind='webp'), stats

    def _raster(self, f: str, ext: str, nbytes: int, tmp: str):
        w, h, dx, dy = _image_info(f)
        size = {'width': round(w * 96 / dx), 'height': round(h * 96 / dy)}
        stats = {'input_bytes': nbytes, 'pixels': f'{w}x{h}'}
        if nbytes < IMG_COPY_MAX:
            kind = 'png' if ext == '.png' else 'jpg'
            stats['kind'] = kind
            return f, dict(size, kind=kind), stats
        webp = os.path.join(tmp, 'img.webp')
        cmd = ['cwebp', '-quiet', '-q', str(WEBP_Q)]
        if w > RASTER_IMG_PX:
            cmd += ['-resize', str(RASTER_IMG_PX), '0']
        _run(cmd + [f, '-o', webp])
        stats['kind'] = 'webp'
        return webp, dict(size, kind='webp'), stats

    # -- TikZ figure bodies ------------------------------------------------
    def document(self, snippet: str, textwidth_cm: float) -> str:
        """The standalone LaTeX document `tex` compiles (exposed for debugging)."""
        return (DRIVER + self.preamble.rstrip('\n') + '\n'
                + f'\\geometry{{paperwidth={textwidth_cm + 2:g}cm, paperheight=200cm, margin=1cm}}\n'
                + '\\pagestyle{empty}\n'
                + LINK_HOOK
                + '\\begin{document}\\thispagestyle{empty}\\noindent\n'
                + snippet.strip('\n') + '\n'
                + '\\end{document}\n')

    def _typeset(self, doc: str, job: str, name: str) -> tuple[str, str]:
        """XeLaTeX -> XDV -> dvisvgm for one document under the job name `job` (the same name gives the same
        bytes: dvisvgm's output depends on the length of its file names); returns (SVG path, log text)."""
        with open(os.path.join(self.work, job + '.tex'), 'w', encoding='utf-8') as fh:
            fh.write(doc)
        with open(os.path.join(self.work, job + '.aux'), 'wb') as fh:   # the bytes that are hashed
            fh.write(self.aux)
        log = os.path.join(self.work, job + '.log')
        _run(['xelatex', '-no-pdf', '-interaction=nonstopmode', '-halt-on-error', job + '.tex'],
             cwd=self.work, log=log)
        with open(log, errors='replace') as fh:
            text = fh.read()
        if 'Missing character' in text:
            miss = sorted(set(re.findall(r'Missing character: There is no (.+?) in font', text)))
            raise FigureError(f'{name}: missing glyphs {miss} (see {log})')
        svg = os.path.join(self.work, job + '.svg')
        out = _run(['dvisvgm', '--no-fonts', '--exact-bbox', '--optimize', '-o', svg, job + '.xdv'],
                   cwd=self.work)
        if 'warning' in out.lower() or 'error' in out.lower():
            raise FigureError(f'{name}: dvisvgm reported problems:\n{out}')
        return svg, text

    def tex(self, snippet: str, name: str, textwidth_cm: float = 16.0, boxes: bool = False) -> dict:
        """boxes=True (D58, figboxes.py): also the top-level `local bounding box` regions of the picture in the
        SVG's user units, as info['boxes'] and the file figures/<name>.boxes.json; the picture is compiled
        with and without the typeout lines and the two SVGs must be byte-identical."""
        try:
            names = figboxes.top_level(snippet) if boxes else []
        except figboxes.BoxError as e:
            raise FigureError(f'{name}: {e}')
        if boxes and not names:
            raise FigureError(f'{name}: boxes requested, but the picture has no top-level local bounding box')
        doc = self.document(figboxes.insert(snippet, names) if boxes else snippet, textwidth_cm)
        key = _sha(VERSION, 'tex', doc, self.aux, *([figboxes.VERSION] if boxes else []))
        hit = self._cached(key, name)
        if hit:
            return self._text(key, hit)
        job = 'fig-' + key[:16]
        svg, text = self._typeset(doc, job, name)
        info, checks = {}, None
        if boxes:
            with open(svg, 'rb') as fh:
                with_lines = fh.read()
            svg, _ = self._typeset(self.document(snippet, textwidth_cm), job, name)   # same job name: same bytes
            with open(svg, 'rb') as fh:
                if fh.read() != with_lines:
                    raise FigureError(f'{name}: the SVG changes when the box typeouts are appended (D58)')
            try:
                info['boxes'], checks = figboxes.place(
                    with_lines.decode('utf-8'), figboxes.parse_log(text, names))
            except figboxes.BoxError as e:
                raise FigureError(f'{name}: {e}')
        wbp, hbp = _svg_size_bp(svg)
        info.update({'width': round(wbp * PX_PER_BP), 'height': round(hbp * PX_PER_BP), 'kind': 'svg',
                     'width_frac': round(wbp / (textwidth_cm * BP_PER_CM), 4)})
        self.stats[name] = {'kind': 'svg', 'bytes': os.path.getsize(svg),
                            'xrefs': re.findall(r"<g class='dg-xref' data-label='([^']*)'>",
                                                open(svg, encoding='utf-8').read())}
        if checks:
            self.stats[name]['boxes'] = checks
        self.log.append(f'built {name}.svg from TikZ' + (f' (+ {len(names)} boxes)' if boxes else ''))
        res = self._text(key, self._store(key, svg, info, name))
        for e in ('.tex', '.aux', '.log', '.xdv', '.svg', '.out', '.port'):
            p = os.path.join(self.work, job + e)
            if os.path.exists(p):
                os.remove(p)
        return res
