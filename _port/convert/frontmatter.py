"""The header and foot of About the Author (unit B4, DECISIONS D51). Hand-written, part of the web port.

The page's body (paragraphs, timeline) goes through the normal renderer. Its top block and its
foot are one `remember picture, overlay` tikzpicture laid out on the A4 page: a cosmic-web image
tinted navy in the upper 34 % of the page, "About the Author" and the name on it, a round portrait
straddling its lower edge, the affiliation beside the portrait, and a navy rule with two links at
the bottom of the page. A page-anchored overlay has no web equivalent, so as for the cover
(cover.py) the words are pulled out of the TikZ nodes and set in a web layout (CSS:
`.dg-about-*`); the two images are cropped to exactly what the PDF shows (the TikZ clips), with
the crop computed from the TikZ's own numbers, and re-encoded small. Every pattern is anchored on
the LaTeX around the text: if the page is restructured the build stops with a clear message.
"""
from __future__ import annotations
import re
from texparse import Parser, ConvertError, Env, Text, Par, Cmd

PAPER_CM = (21.0, 29.7)               # a4paper (checked against the preamble in about())

PATTERNS = {
    'band':       r'\\coordinate \(aboutSW\) at \(\[yshift=-([\d.]+)\\paperheight\]current page\.north west\);',
    'centre':     r'\\coordinate \(aboutC\)\s+at \(\[yshift=-([\d.]+)\\paperheight\]current page\.north\);',
    'background': r'\\node\[inner sep=0pt\] at \(aboutC\) \{\\includegraphics\[width=\\paperwidth\]\{([^}]+)\}\};',
    'kicker':     r'text=color_blue_2, font=\\large\\scshape\]\s*at \([^;]*?\)\s*\{(.*?)\};',
    'name':       r'text=white,\s*font=\\fontsize\{28\}\{34\}\\selectfont\\bfseries\]\s*at \([^;]*?\)\s*\{(.*?)\};',
    'radius':     r'\\clip \(aboutP\) circle \(([\d.]+)cm\);',
    'portrait':   r'\\node\[inner sep=0pt\] at \(\[xshift=([-\d.]+)cm, yshift=([-\d.]+)cm\]aboutP\)\s*'
                  r'\{\\includegraphics\[width=([\d.]+)cm\]\{([^}]+)\}\};',
    'role':       r'\{\\color\{color_blue_0\}\\large\\itshape (.*?)\}\\\\\[2pt\]',
    'institute':  r'\{\\color\{black!75\}(.*?)\}\};',
    'links':      r'font=\\small\]\s*at \(\[xshift=-25mm, yshift=24mm\]current page\.south east\) \{(.*?)\};',
}
BAND_PX, BAND_Q = 1440, 50            # the band is tinted and darkened on the page: a light encoding is enough
PORTRAIT_PX, PORTRAIT_Q = 400, 82


def _find(name: str, tex: str, pos: int):
    m = re.search(PATTERNS[name], tex, re.S)
    if not m:
        raise ConvertError(f'About the Author: cannot find the "{name}" part of the page\'s overlay picture; the '
                           f'layout changed, update the pattern in _port/convert/frontmatter.py', pos)
    return m


def about(nodes: list, r, preamble: str):
    """nodes of the page -> (nodes without the overlay picture, header html, foot html)."""
    if not re.search(r'\\geometry\{\s*a4paper', preamble):
        raise ConvertError('About the Author: the page geometry assumes a4paper (frontmatter.PAPER_CM)', None)
    k = next((i for i, n in enumerate(nodes) if isinstance(n, Env) and n.name == 'tikzpicture'
              and re.match(r'\\begin\{tikzpicture\}\[remember picture, overlay\]', n.raw)), None)
    if k is None:
        raise ConvertError('About the Author: no overlay tikzpicture (frontmatter.py)', nodes[0].pos if nodes else None)
    pic = nodes[k]
    tex, pos = pic.raw, pic.pos

    def text(name):
        src = _find(name, tex, pos).group(1)
        return r.inline(Parser(src).parse(0, len(src)))

    pw, ph = PAPER_CM
    # background: \paperwidth wide, centred at aboutC, clipped to the band [page top, aboutSW]
    band = float(_find('band', tex, pos).group(1)) * ph
    centre = float(_find('centre', tex, pos).group(1)) * ph
    bg_path = _find('background', tex, pos).group(1)
    fig = r.ctx.figures
    iw, ih = fig.image_size(bg_path)
    img_h = pw * ih / iw
    top = (img_h / 2 - centre) / img_h
    bottom = (img_h / 2 - centre + band) / img_h
    bg = fig.crop(bg_path, 'about-the-author-background', (0.0, top, 1.0, bottom), BAND_PX, BAND_Q)
    # portrait: clipped to a circle of the given radius around aboutP; the picture's centre is shifted from it
    rad = float(_find('radius', tex, pos).group(1))
    m = _find('portrait', tex, pos)
    dx, dy, width, pt_path = float(m.group(1)), float(m.group(2)), float(m.group(3)), m.group(4)
    qw, qh = fig.image_size(pt_path)
    height = width * qh / qw
    cx, cy = width / 2 - dx, height / 2 + dy          # circle centre in the picture, cm from its top-left corner
    box = ((cx - rad) / width, (cy - rad) / height, (cx + rad) / width, (cy + rad) / height)
    pt = fig.crop(pt_path, 'about-the-author-portrait', box, PORTRAIT_PX, PORTRAIT_Q)

    name = text('name')
    plain_name = re.sub(r'<[^>]+>', '', name)
    head = (f'<header class="dg-about-head">'
            f'<div class="dg-about-band"><img class="dg-about-bg" src="\x02U|{bg["src"]}\x02" alt="" '
            f'width="{bg["width"]}" height="{bg["height"]}" decoding="async">'
            f'<div class="dg-about-titles"><h1 class="dg-about-kicker">{text("kicker")}</h1>'
            f'<p class="dg-about-name">{name}</p><div class="dg-about-rule"></div></div></div>'
            f'<div class="dg-about-under"><p class="dg-about-affil"><span class="dg-about-role">{text("role")}</span><br>'
            f'<span class="dg-about-institute">{text("institute")}</span></p>'
            f'<img class="dg-about-portrait" src="\x02U|{pt["src"]}\x02" alt="{plain_name}" '
            f'width="{pt["width"]}" height="{pt["height"]}" decoding="async"></div></header>')
    src = _find('links', tex, pos).group(1)
    foot = f'<footer class="dg-about-links"><p>{links_html(Parser(src).parse(0, len(src)), r)}</p></footer>'
    rest = nodes[:k] + nodes[k + 1:]
    return rest, head, foot


def links_html(nodes: list, r) -> str:
    """The foot's links (`\\href{..}{..}` separated by `\\quad·\\quad`): each link with what follows it up to
    the next link in one `span.dg-about-link`, that separator in `span.dg-about-sep` (units B18-B22). Only
    markup is added (every node is rendered, in order). The CSS (`.dg-about-links`) lets a link that does not
    fit wrap to a new line as a whole and clips the separator at the end of the line, so no line ends or
    starts with "·"."""
    hrefs = [i for i, n in enumerate(nodes) if isinstance(n, Cmd) and n.name == 'href']
    if not hrefs:
        return r.inline(nodes)
    out = [r.inline(nodes[:hrefs[0]])]
    for k, h in enumerate(hrefs):
        end = hrefs[k + 1] if k + 1 < len(hrefs) else len(nodes)
        link, rest = r.inline(nodes[h:h + 1]), r.inline(nodes[h + 1:end])
        sep = f'<span class="dg-about-sep">{rest}</span>' if k + 1 < len(hrefs) and rest.strip() else rest
        out.append(f'<span class="dg-about-link">{link}{sep}</span>')
    return ''.join(out)
