"""The page shell of the course pages (DECISIONS D29-D33). Hand-written, part of the web port.

build.py renders the body of every page (render.py) and hands it here; this module wraps it in a
complete HTML document in design direction A, "Paper" (DESIGN.md section 4; the prototype it was
promoted from is _port/design/proto/build.py):

    <head>   title, description, canonical link, favicon, fonts, course.css, theme script, MathJax
    <body>   skip link, site navbar (replica of the Quarto navbar, links read from _quarto.yml),
             course bar (breadcrumbs, Contents, Map, Search, theme, progress hairlines),
             shell grid: course tree | <main> | sidenote margin, site footer (from _quarto.yml)

The landing page uses the same shell with templates/landing.html as the content of <main>.
Every URL written here is relative to the page, so the pages work at any path prefix; <body data-dg-site>
is the site root relative to the page (course.js resolves the site's search.json and its hrefs with it);
<body data-dg-slug> is the page's path inside the course without .html (the key of the "read" marks, D40).
Every word of interface text is in INTERFACE below (listed in _port/REVIEW.md).
"""
from __future__ import annotations
import html
import os
import posixpath
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
COURSE = 'notes/diffgeo-gr'
COURSE_TITLE = 'From Differential Geometry to General Relativity'
SITE_NAME = 'Daniel López Cano'
MATHJAX = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml-full.js'      # the one place that names it
LATO = 'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400;1,700&display=swap'
RUNIC = True                  # preload the notes' runic font (D8)
STYLESHEETS: list = []        # the course's own stylesheets, after course.css (courses.py)
MAP = True                    # the course has a course map (D39)
READ_KEY = None               # L24: localStorage key of the read marks (<body data-dg-read-key>); None = 'dg-read'
OPEN_DIRS: list = []          # L23: directories whose pages open in place (<body data-dg-open>); [] = course.js's rule
THEME_SCRIPT = "try{var t=localStorage.getItem('dg-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}"

# Interface words of the shell (web layer; every one is listed in _port/REVIEW.md).
INTERFACE = {
    'skip': 'Skip to content', 'site_nav': 'Site', 'toggle': 'Toggle navigation', 'search': 'Search',
    'contents': 'Contents', 'crumbs': 'Breadcrumb', 'map': 'Map', 'map_label': 'Course map',
    'search_label': 'Search the notes', 'theme_label': 'Light or dark', 'tree': 'Course contents',
    'read_toggle': 'Mark as read', 'read_on': 'Read', 'read_mark': 'read',          # "read" marks (D40)
}


def configure(c: dict) -> None:
    """The course's values (courses.py, Lyα DECISIONS L9)."""
    global COURSE, COURSE_TITLE, RUNIC, STYLESHEETS, MAP, OPEN_DIRS, READ_KEY
    COURSE, COURSE_TITLE, RUNIC = c['dir'], c['title'], c['runic']
    STYLESHEETS, MAP = list(c['stylesheets']), bool(c['master_map'])
    OPEN_DIRS = []                # set by build.py once the pages are known (L23)
    READ_KEY = c.get('read_key')  # L24


def readmark() -> str:
    """The "read" mark after a section's title (D40): always in the HTML, hidden until course.js finds the
    page in the reader's list, so that showing it never moves the text; its word is for screen readers."""
    return (f'<span class="dg-readmark dg-web">{icon("check")}'
            f'<span class="dg-sr-only">{INTERFACE["read_mark"]}</span></span>')


def readtoggle() -> str:
    """The toggle at the foot of a section page, before previous/next (D40). Its name stays "Mark as read";
    the visible word becomes "Read" while it is pressed. Hidden without JavaScript (course.css)."""
    return (f'<div class="dg-web dg-readbar"><button class="dg-readtoggle" type="button" aria-pressed="false" '
            f'aria-label="{INTERFACE["read_toggle"]}">{icon("check")}'
            f'<span class="dg-read-off" aria-hidden="true">{INTERFACE["read_toggle"]}</span>'
            f'<span class="dg-read-on" aria-hidden="true">{INTERFACE["read_on"]}</span></button></div>')

# ---------------------------------------------------------------------------------------
# fonts (D31): New Computer Modern 10 Book, subset to Latin + punctuation, as WOFF2
# ---------------------------------------------------------------------------------------
NEWCM = '/usr/share/texlive/texmf-dist/fonts/opentype/public/newcomputermodern'
FONTS = {'NewCM10-Book.otf': 'newcm-book', 'NewCM10-BookItalic.otf': 'newcm-bookitalic',
         'NewCM10-Bold.otf': 'newcm-bold', 'NewCM10-BoldItalic.otf': 'newcm-bolditalic'}
PRELOAD = ('newcm-book', 'newcm-bold')                # the two faces on every first screen (text, headings)


def subset_fonts(dst: str) -> None:
    """Writes the four WOFF2 files once; they are committed, so a machine without TeX Live or
    fontTools reuses them. Same subset and features as the design prototype."""
    outs = {src: os.path.join(dst, f'{name}.woff2') for src, name in FONTS.items()}
    if all(os.path.exists(o) for o in outs.values()):
        print('fonts: the four NewCM WOFF2 files exist, not rebuilt')
        return
    try:
        from fontTools import subset
    except ImportError:
        raise SystemExit('fonts: notes/diffgeo-gr/assets/fonts/newcm-*.woff2 are missing and fontTools is not installed '
                         '(pip install fonttools brotli), so they cannot be rebuilt')
    os.makedirs(dst, exist_ok=True)
    for src, out in outs.items():
        if os.path.exists(out):
            continue
        path = os.path.join(NEWCM, src)
        if not os.path.exists(path):
            raise SystemExit(f'fonts: {os.path.relpath(out, REPO)} is missing and {path} (TeX Live) is not there to build it from')
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['kern', 'liga', 'onum', 'lnum', 'smcp', 'c2sc']
        opts.unicodes = (list(range(0x20, 0x17F)) + list(range(0x2010, 0x2028))
                         + [0x2030, 0x2032, 0x2033, 0x2039, 0x203A, 0x20AC, 0x2122, 0x2190, 0x2192, 0x2212, 0x00A0,
                            0x2022, 0xFB00, 0xFB01, 0xFB02, 0xFB03, 0xFB04])
        f = subset.load_font(path, opts)
        s = subset.Subsetter(opts)
        s.populate(unicodes=opts.unicodes)
        s.subset(f)
        subset.save_font(f, out, opts)
        print('font', os.path.basename(out), os.path.getsize(out) // 1024, 'kB')


# ---------------------------------------------------------------------------------------
# what the course pages share with the rest of the site: read from _quarto.yml
# ---------------------------------------------------------------------------------------
def _block(lines: list[str], start: int) -> tuple[int, list[str]]:
    """Indentation of lines[start] and the lines indented deeper that follow it."""
    ind = len(lines[start]) - len(lines[start].lstrip())
    out = []
    for ln in lines[start + 1:]:
        if ln.strip() and not ln.lstrip().startswith('#') and len(ln) - len(ln.lstrip()) <= ind:
            break
        out.append(ln)
    return ind, out


def _find(lines: list[str], key: str, after: int = 0) -> int:
    for i in range(after, len(lines)):
        if re.match(rf'\s*{re.escape(key)}:\s*(#.*)?$', lines[i]):
            return i
    return -1


def _unquote(v: str) -> str:
    v = re.sub(r'\s+#.*$', '', v.strip()) if not v.strip().startswith(('"', "'")) else v.strip()
    m = re.match(r'^"(.*)"\s*(#.*)?$', v) or re.match(r"^'(.*)'\s*(#.*)?$", v)
    return m.group(1) if m else v


def site_config(path: str | None = None) -> dict:
    """site-url, the navbar links (website: navbar: left) and the page footer of _quarto.yml.
    A small line-based reader: it stops the build if the blocks it needs are not where expected."""
    path = path or os.path.join(REPO, '_quarto.yml')
    lines = open(path, encoding='utf-8').read().split('\n')
    where = os.path.relpath(path, REPO)
    m = next((re.match(r'\s*site-url:\s*(.+)$', ln) for ln in lines if re.match(r'\s*site-url:', ln)), None)
    if not m:
        raise SystemExit(f'{where}: no website: site-url found (needed for the canonical links of the course pages)')
    site_url = _unquote(m.group(1)).rstrip('/')
    w = _find(lines, 'website')
    nb = _find(lines, 'navbar', w + 1) if w >= 0 else -1
    left = _find(lines, 'left', nb + 1) if nb >= 0 else -1
    if left < 0:
        raise SystemExit(f'{where}: block website: navbar: left: not found (the course pages copy the site navbar from it)')
    # entries: {'href', 'text'} or, for a dropdown (Lyα DECISIONS L15), {'text', 'menu': [{'href', 'text'}, ...]};
    # an item is a "- " line, a menu's items are "- " lines indented deeper than the entry that holds them
    nav, item, top = [], None, None
    for ln in _block(lines, left)[1]:
        s = ln.strip()
        ind = len(ln) - len(ln.lstrip())
        if s.startswith('- '):
            if top is None:
                top = ind
            item = {}
            if ind == top:
                nav.append(item)
            elif nav and 'menu' in nav[-1]:
                nav[-1]['menu'].append(item)
            else:
                raise SystemExit(f'{where}: website: navbar: left: an indented item outside a menu: {s}')
            s = s[2:].strip()
        if re.match(r'menu:\s*$', s) and item is not None and ind > (top or 0):
            item['menu'] = []
            continue
        k = re.match(r'(href|text):\s*(.+)$', s)
        if k and item is not None:
            item[k.group(1)] = _unquote(k.group(2))
    nav = [i for i in nav if 'text' in i and ('href' in i or i.get('menu'))]
    for i in nav:
        if 'menu' in i:
            i['menu'] = [m for m in i['menu'] if 'href' in m and 'text' in m]
    if not nav or not any(_leads_here(i) for i in nav):
        raise SystemExit(f'{where}: website: navbar: left: has no entry pointing into {COURSE}/')
    pf = _find(lines, 'page-footer', w + 1)
    foot = {}
    if pf >= 0:
        for ln in _block(lines, pf)[1]:
            k = re.match(r'\s*(left|right):\s*(.+)$', ln)
            if k:
                foot[k.group(1)] = _unquote(k.group(2))
    link = re.match(r'^\[(.+?)\]\((.+?)\)$', foot.get('right', ''))
    if 'left' not in foot or not link:
        raise SystemExit(f'{where}: website: page-footer: with left: "<text>" and right: "[<text>](<page>)" not found')
    return {'site_url': site_url, 'nav': nav, 'foot_left': foot['left'], 'foot_right': (link.group(1), link.group(2))}


def _leads_here(i: dict) -> bool:
    """The navbar entry (or a link of its menu) leads into this course."""
    return any(x['href'].startswith(COURSE + '/') for x in i.get('menu', [i]))


# ---------------------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------------------
def attr(s: str) -> str:
    return html.escape(s, quote=True)


def site_href(target: str, page_dir: str) -> str:
    """A page of the site (as written in _quarto.yml, .qmd or .html), relative to the page's directory."""
    t = re.sub(r'\.qmd$', '.html', target)
    return posixpath.relpath(t, page_dir)


def icon(name: str) -> str:
    """Bootstrap Icons drawn by CSS masks (course.css, section "icons"): no icon font is loaded."""
    return f'<i class="dg-i dg-i-{name}" aria-hidden="true"></i>'


def plain_text(s: str) -> str:
    """Tags dropped, entities decoded, whitespace collapsed (math stays as its TeX source)."""
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def description(text: str, n: int = 160) -> str:
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) <= n:
        return text
    cut = text[:n]
    return cut[:cut.rfind(' ')] if ' ' in cut else cut


# ---------------------------------------------------------------------------------------
# the page
# ---------------------------------------------------------------------------------------
def head(*, title: str, desc: str, canonical: str, assets: str, site_root: str, interactive: bool) -> str:
    pre = ''.join(f'<link rel="preload" href="{assets}fonts/{f}.woff2" as="font" type="font/woff2" crossorigin>\n'
                  for f in PRELOAD)
    inter = f'<link rel="stylesheet" href="{assets}interactive.css">\n' if interactive else ''
    runic = (f'<link rel="preload" href="{assets}fonts/NotoSansRunic-Regular.ttf" as="font" type="font/ttf" crossorigin>\n'
             if RUNIC else '')
    own = ''.join(f'<link rel="stylesheet" href="{assets}{css}">\n' for css in STYLESHEETS)
    return (f'<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f'<title>{html.escape(title, quote=False)}</title>\n'
            f'<meta name="description" content="{attr(desc)}">\n'
            f'<link rel="canonical" href="{attr(canonical)}">\n'
            f'<link rel="icon" href="{site_root}assets/icons/site-mark.svg" type="image/svg+xml">\n'
            f'<link rel="preconnect" href="https://fonts.googleapis.com">'
            f'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            f'<link rel="stylesheet" href="{LATO}">\n'
            f'{pre}{runic}'
            f'<link rel="stylesheet" href="{assets}course.css">\n{own}{inter}'
            f'<script>{THEME_SCRIPT}</script>\n'
            f'<script src="{assets}mathjax-config.js"></script>\n'
            f'<script defer src="{MATHJAX}"></script>\n'
            f'<script type="module" src="{assets}course.js"></script>\n')


def sitenav(cfg: dict, page_dir: str, landing: bool) -> str:
    items = []

    def link(i, cls=''):
        here = i['href'].startswith(COURSE + '/')
        c = ' '.join(x for x in (cls, 'active' if here else '') if x)
        cur = (f' class="{c}"' if c else '') + (' aria-current="page"' if here and landing else '')
        return f'<a href="{attr(site_href(i["href"], page_dir))}"{cur}>{html.escape(i["text"])}</a>'
    for i in cfg['nav']:
        if 'menu' not in i:
            items.append(f'<li>{link(i)}</li>')
            continue
        # a dropdown (L15): opened by course.js (initSiteNav) on hover, click, tap and keyboard focus. The space after
        # the text is Quarto's (its toggle ends with white space before the caret, ::after): the caret, and the
        # entries after it, then sit where Quarto puts them (navbar_check.mjs)
        mid = 'dg-nav-menu-' + re.sub(r'[^a-z0-9]+', '-', i['text'].lower()).strip('-')
        act = ' active' if _leads_here(i) else ''
        items.append(f'<li class="dg-dropdown"><button class="dg-dropdown-toggle{act}" type="button" aria-expanded="false" '
                     f'aria-controls="{mid}">{html.escape(i["text"])} </button><ul class="dg-dropdown-menu" id="{mid}">'
                     + ''.join(f'<li>{link(m, "dg-dropdown-item")}</li>' for m in i['menu']) + '</ul></li>')
    return (f'<header class="dg-sitenav" id="dg-sitenav"><nav class="dg-sitenav-in" aria-label="{INTERFACE["site_nav"]}">'
            f'<button class="dg-sitenav-toggle" type="button" aria-label="{INTERFACE["toggle"]}" aria-expanded="false" '
            f'aria-controls="dg-sitenav-links">{icon("list")}</button>'
            f'<ul id="dg-sitenav-links">{"".join(items)}</ul>'
            f'<button class="dg-sitenav-search" type="button" aria-label="{INTERFACE["search"]}" data-act="search" data-scope="site">'
            f'{icon("search")}</button></nav></header>')


def course_label(cfg: dict) -> str:
    """The first breadcrumb: the text of the navbar entry that leads into the course (for a dropdown, its own
    text, "Lecture Notes", the same for both courses; L15)."""
    return next(i['text'] for i in cfg['nav'] if _leads_here(i))


def bar(cfg: dict, crumbs: list[str], home: str, pos: float, tree: bool) -> str:
    sep = icon('chevron-right').replace('class="dg-i ', 'class="dg-crumb-sep dg-i ')
    menu = (f'<button class="dg-bar-btn dg-bar-menu" type="button" data-act="menu" aria-label="{INTERFACE["contents"]}" '
            f'aria-expanded="false" aria-controls="dg-tree">{icon("layout-sidebar")}<span>{INTERFACE["contents"]}</span></button>'
            if tree else '')
    mapbtn = (f'<a class="dg-bar-btn" href="{home}#dg-roadmap" data-act="map" aria-label="{INTERFACE["map_label"]}">'
              f'{icon("diagram-3")}<span>{INTERFACE["map"]}</span></a>' if MAP else '')
    return (f'<div class="dg-bar dg-web" id="dg-bar">{menu}'
            f'<nav class="dg-crumbs" aria-label="{INTERFACE["crumbs"]}">{sep.join(crumbs)}</nav>'
            f'<div class="dg-bar-tools">'
            f'{mapbtn}'
            f'<button class="dg-bar-btn" type="button" data-act="search" data-scope="notes" aria-label="{INTERFACE["search_label"]}">{icon("search")}<span>{INTERFACE["search"]}</span></button>'
            f'<button class="dg-bar-btn" type="button" data-act="theme" aria-label="{INTERFACE["theme_label"]}">{icon("circle-half")}</button>'
            f'</div><div class="dg-bar-progress" aria-hidden="true"><i style="--pos:{pos:.4f}"></i><b></b></div></div>')


def sitefoot(cfg: dict, page_dir: str) -> str:
    text, target = cfg['foot_right']
    return (f'<footer class="dg-sitefoot"><span>{html.escape(cfg["foot_left"])}</span>'
            f'<a href="{attr(site_href(target, page_dir))}">{html.escape(text)}</a></footer>')


def document(*, cfg: dict, slug: str, source: str, title: str, desc: str, crumbs: list[str], tree: str,
             main: str, pos: float, landing: bool = False, chapter: bool = False) -> str:
    """A complete page. `slug` is the page's path inside the course without .html ('index', 'metric/metric')."""
    page_dir = posixpath.dirname(f'{COURSE}/{slug}')
    assets = posixpath.relpath(f'{COURSE}/assets', page_dir) + '/'
    site_root = posixpath.relpath('.', page_dir) + '/'
    home = posixpath.relpath(f'{COURSE}/index.html', page_dir)
    canonical = f'{cfg["site_url"]}/{COURSE}/{slug}.html'
    hd = head(title=title, desc=desc, canonical=canonical, assets=assets, site_root=site_root,
              interactive='dg-interactive' in main)
    shell_tree = f'\n{tree}' if tree else ''
    kind = 'dg-page-landing' if landing else 'dg-page-chapter' if chapter else 'dg-page-reading'
    return (f'<!doctype html>\n'
            f'<!-- GENERATED by _port/convert/build.py from {source}.\n'
            f'     Do not edit this file: edit the LaTeX notes (or the converter) and re-run the converter. -->\n'
            f'<html lang="en">\n<head>\n{hd}</head>\n'
            f'<body class="{kind}" data-dg-site="{site_root}" data-dg-slug="{attr(slug)}"'
            + (f' data-dg-open="{attr(" ".join(OPEN_DIRS))}"' if OPEN_DIRS else '')
            + (f' data-dg-read-key="{attr(READ_KEY)}"' if READ_KEY else '') + '>\n'
            f'<a class="dg-skiplink dg-web" href="#dg-main">{INTERFACE["skip"]}</a>\n'
            f'{sitenav(cfg, page_dir, landing)}\n'
            f'{bar(cfg, crumbs, home, pos, bool(tree))}\n'
            f'<div class="dg-shell">{shell_tree}\n'
            f'<main class="dg-main" id="dg-main" tabindex="-1">\n{main}\n</main>\n</div>\n'
            f'{sitefoot(cfg, page_dir)}\n</body>\n</html>\n')


def landing_main(fragments: dict, template: str = 'landing.html') -> str:
    """templates/<template> (hand-written) with the generated fragments put in."""
    tpl = open(os.path.join(HERE, 'templates', template), encoding='utf-8').read()
    tpl = re.sub(r'\A\s*<!--.*?-->\s*', '', tpl, flags=re.S)          # its header comment is for the source only
    for k, v in fragments.items():
        if '{{' + k + '}}' not in tpl:
            raise SystemExit(f'templates/landing.html has no {{{{{k}}}}} placeholder')
        tpl = tpl.replace('{{' + k + '}}', v)
    left = re.findall(r'\{\{(\w+)\}\}', tpl)
    if left:
        raise SystemExit(f'templates/landing.html: no generated fragment for {left}')
    return tpl.strip('\n')
