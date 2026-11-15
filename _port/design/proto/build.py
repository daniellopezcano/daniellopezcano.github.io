#!/usr/bin/env python3
"""Hand-written (design study, REDESIGN.md "The one stop"): builds the design-direction prototypes.

    python3 _port/design/proto/build.py        -> _port/design/site/<a|b|c>/<page>.html   (git-ignored)

Each prototype page is the REAL content of a course page (the <main> of the page rendered in docs/
by the pilot pipeline, untouched) placed in the page shell of one design direction:
    a  "Paper"   light paper, the notes' own typeface, sidenotes in the margin
    b  "Night"   the site's dark palette, sans-serif, page outline on the right, popovers
    c  "Atlas"   light, sans-serif, chapter line on top, a context pane that follows the reader
Preview: _port/design/preview.sh.  Screenshots: node _port/design/proto/shots.mjs.
"""
import html, json, re, shutil, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
DOCS = REPO / 'docs'
COURSE = 'notes/diffgeo-gr'
OUT = HERE.parent / 'site'
PAGES = ['index', 'vector-spaces/foundations-sets-maps', 'tangent-spaces/tangent-space',
         'proofs-and-additional-material/proof-euler-lagrange', 'examples/example-variations',
         'vector-spaces/index']
DIRS = {'a': 'Paper', 'b': 'Night', 'c': 'Atlas'}
NEWCM = Path('/usr/share/texlive/texmf-dist/fonts/opentype/public/newcomputermodern')
FONTS = {'NewCM10-Book.otf': 'newcm-book', 'NewCM10-BookItalic.otf': 'newcm-bookitalic',
         'NewCM10-Bold.otf': 'newcm-bold', 'NewCM10-BoldItalic.otf': 'newcm-bolditalic'}

def tex(s):   # titles in the report carry $..$ math
    return re.sub(r'\$(.+?)\$', r'\\(\1\\)', html.escape(s, quote=False))

def subset_fonts():
    """The notes are set in Latin Modern; New Computer Modern 'Book' is the same design, slightly
    heavier, made for screens and low resolutions. Subset to Latin + punctuation, as WOFF2."""
    dst = OUT / 'fonts'; dst.mkdir(parents=True, exist_ok=True)
    from fontTools import subset
    for src, name in FONTS.items():
        out = dst / f'{name}.woff2'
        if out.exists() or not (NEWCM / src).exists():
            continue
        opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['kern', 'liga', 'onum', 'lnum', 'smcp', 'c2sc']
        opts.unicodes = list(range(0x20, 0x17F)) + list(range(0x2010, 0x2028)) + [0x2030, 0x2032, 0x2033, 0x2039, 0x203A, 0x20AC, 0x2122, 0x2190, 0x2192, 0x2212, 0x00A0, 0x2022, 0xFB00, 0xFB01, 0xFB02, 0xFB03, 0xFB04]
        f = subset.load_font(str(NEWCM / src), opts); s = subset.Subsetter(opts); s.populate(unicodes=opts.unicodes); s.subset(f)
        subset.save_font(f, str(out), opts)
        print('font', out.name, out.stat().st_size // 1024, 'kB')

def site_nav():
    s = (DOCS / 'index.html').read_text()
    links = re.findall(r'<a class="nav-link[^"]*" href="([^"]+)"[^>]*>\s*<span class="menu-text">(.*?)</span>', s)
    return [(('/' + h.lstrip('./')), t) for h, t in links]

def body_of(slug):
    s = (DOCS / COURSE / f'{slug}.html').read_text()
    m = s[s.index('<main'):s.index('</main>')]
    m = m[m.index('>') + 1:]
    m = re.sub(r'<header id="title-block-header".*?</header>', '', m, flags=re.S)
    return m

def outline_of(body):
    out = []
    for lvl, ident, inner in re.findall(r'<h([23])[^>]*\bid="([^"]+)"[^>]*>(.*?)</h\1>', body, flags=re.S):
        inner = re.sub(r'<a [^>]*class="anchorjs[^>]*>.*?</a>', '', inner, flags=re.S)
        out.append((int(lvl), ident, inner.strip()))
    return out

def page(d, slug, pages, nav):
    P = {p['slug']: p for p in pages}
    cur = P.get(slug)
    chap = None
    if cur:
        chap = cur if cur['kind'] == 'chapter' else P[slug.split('/')[0] + '/index']
    body = body_of(slug)
    outline = outline_of(body)
    url = lambda s: f'/design/{d}/{s}.html' if s in PAGES else f'/{COURSE}/{s}.html'
    num = lambda p: f'<span class="n">{p["number"]}</span>'
    # --- site navbar (same links as the site) ---
    sn = ''.join(f'<li><a href="{h}"{" class=\"active\" aria-current=\"page\"" if "diffgeo" in h else ""}>{t}</a></li>' for h, t in nav)
    # --- course tree ---
    tree, line = [], []
    for p in pages:
        if p['kind'] != 'chapter':
            continue
        key = p['slug'].split('/')[0]
        secs = [q for q in pages if q['kind'] == 'section' and q['slug'].startswith(key + '/')]
        is_cur = chap is not None and chap['slug'] == p['slug']
        sub = ''
        if secs:
            items = ''
            for q in secs:
                here = cur is not None and q['slug'] == slug
                ol = ''
                if here and outline:
                    ol = '<ol class="cn-outline">' + ''.join(f'<li class="l{l}"><a href="#{i}">{t}</a></li>' for l, i, t in outline) + '</ol>'
                items += f'<li{" class=\"here\"" if here else ""}><a href="{url(q["slug"])}"{" aria-current=\"page\"" if here else ""}>{num(q)} {tex(q["title"])}</a>{ol}</li>'
            sub = f'<ol>{items}</ol>'
        here = cur is not None and p['slug'] == slug
        tree.append(f'<li class="ch{" open" if is_cur else ""}{" here" if here else ""}"><a href="{url(p["slug"])}"{" aria-current=\"page\"" if here else ""}>{num(p)} {tex(p["title"])}</a>{sub}</li>')
        line.append(f'<li class="{"cur" if is_cur else ""}"><a href="{url(p["slug"])}" title="{html.escape(p["number"] + " " + re.sub(r"[$]", "", p["title"]))}"><span>{p["number"]}</span></a></li>')
    # --- breadcrumbs ---
    crumbs = [f'<a href="/design/{d}/index.html">Lecture Notes</a>']
    if chap and cur is not chap:
        crumbs.append(f'<a href="{url(chap["slug"])}">{num(chap)} {tex(chap["title"])}</a>')
    if cur:
        crumbs.append(f'<span aria-current="page">{num(cur)} {tex(cur["title"])}</span>')
    order = [p['slug'] for p in pages]
    pos = (order.index(slug) + 1) if slug in order else 0
    ol = ''.join(f'<li class="l{l}"><a href="#{i}">{t}</a></li>' for l, i, t in outline)
    title = (cur['number'] + ' ' + re.sub(r'[$]', '', cur['title'])) if cur else 'From Differential Geometry to General Relativity'
    base = f'/{COURSE}/{slug}.html'
    return f'''<!doctype html>
<html lang="en" class="dg-js dir-{d}" data-dir="{d}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} – {DIRS[d]} (design prototype)</title>
<base href="{base}">
<link rel="icon" href="/assets/icons/site-mark.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400;1,700&display=swap">
<link rel="stylesheet" href="/site_libs/bootstrap/bootstrap-icons.css">
<link rel="stylesheet" href="/design/proto/reset.css">
<link rel="stylesheet" href="/{COURSE}/assets/course.css">
<link rel="stylesheet" href="/{COURSE}/assets/interactive.css">
<link rel="stylesheet" href="/design/proto/shell.css">
<link rel="stylesheet" href="/design/proto/{d}.css">
<script>try{{var t=localStorage.getItem('dg-theme');if(t)document.documentElement.dataset.theme=t}}catch(e){{}}</script>
<script src="/{COURSE}/assets/mathjax-config.js"></script>
<script type="module" src="/{COURSE}/assets/course.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml-full.js"></script>
<script type="module" src="/design/proto/proto.js"></script>
</head>
<body class="{'landing' if slug == 'index' else 'reading'}">
<a class="skip dg-web" href="#dg-main">Skip to content</a>
<header class="sn" id="quarto-header"><nav class="sn-in" aria-label="Site"><button class="sn-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false"><i class="bi bi-list"></i></button><ul>{sn}</ul><button class="sn-search" type="button" aria-label="Search" data-act="search"><i class="bi bi-search"></i></button></nav></header>
<div class="cb dg-web" id="course-bar">
  <button class="cb-btn cb-menu" type="button" data-act="menu" aria-label="Contents" aria-expanded="false"><i class="bi bi-layout-sidebar"></i><span>Contents</span></button>
  <nav class="cb-crumbs" aria-label="Breadcrumb">{'<i class="sep bi bi-chevron-right"></i>'.join(crumbs)}</nav>
  <ol class="cb-line" aria-label="Chapters">{''.join(line)}</ol>
  <div class="cb-tools">
    <button class="cb-btn" type="button" data-act="map" aria-label="Course map"><i class="bi bi-diagram-3"></i><span>Map</span></button>
    <button class="cb-btn" type="button" data-act="search" aria-label="Search the notes"><i class="bi bi-search"></i><span>Search</span></button>
    <button class="cb-btn" type="button" data-act="theme" aria-label="Light or dark"><i class="bi bi-circle-half"></i></button>
  </div>
  <div class="cb-progress" role="presentation"><i style="--pos:{pos / max(1, len(order)):.4f}"></i><b></b></div>
</div>
<div class="shell">
  <nav class="cn dg-web" id="course-nav" aria-label="Course contents">
    <p class="cn-title"><a href="/design/{d}/index.html">From Differential Geometry to General Relativity</a></p>
    <ol class="cn-tree">{''.join(tree)}</ol>
  </nav>
  <main class="content" id="dg-main">
{body}
  </main>
  <aside class="cx dg-web" id="course-context" aria-label="On this page">
    <div class="cx-outline"><p class="cx-title">On this page</p><ol>{ol}</ol></div>
    <div class="cx-pane" id="cx-pane" aria-live="polite"></div>
  </aside>
</div>
<footer class="sf"><span>© Daniel López Cano</span><span class="dg-web">design prototype {d.upper()} · “{DIRS[d]}”</span><a href="/index.html">Home</a></footer>
</body>
</html>
'''

def main():
    report = json.loads((REPO / '_port/.work/report.json').read_text())
    pages = [p for p in report['pages'] if p['converted']]
    nav = site_nav()
    subset_fonts()
    for d in DIRS:
        for slug in PAGES:
            out = OUT / d / f'{slug}.html'
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(page(d, slug, pages, nav))
    idx = ''.join(f'<h2>{d.upper()} — {n}</h2><ul>' + ''.join(f'<li><a href="/design/{d}/{s}.html">{s}</a></li>' for s in PAGES) + '</ul>' for d, n in DIRS.items())
    (OUT / 'index.html').write_text(f'<!doctype html><meta charset="utf-8"><title>Design directions</title><body style="font:17px/1.6 system-ui;max-width:46rem;margin:3rem auto;padding:0 1rem"><h1>Design directions (prototypes)</h1><p>Same real pages, three directions. See <code>_port/DESIGN.md</code>.</p>{idx}</body>')
    print(f'wrote {len(DIRS) * len(PAGES)} pages to {OUT.relative_to(REPO)}')

if __name__ == '__main__':
    sys.exit(main())
