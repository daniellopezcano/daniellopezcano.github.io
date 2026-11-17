#!/usr/bin/env python3
"""Build the CV page of the site from the LaTeX CV.  Hand-written; standard library only.

    python3 _cv/build.py [--src DIR] [--no-render] [--check-links]

Reads DIR/main.tex and DIR/main.pdf (DIR: --src, else $CV_SRC, else the default below). DIR is read-only:
nothing is ever written there, and nothing is compiled (compile main.pdf yourself first). Writes:

  cv.qmd                          the CV page (generated: change main.tex or this script, never cv.qmd)
  assets/files/DLC_CV.pdf         main.pdf, compressed by Ghostscript when that is lossless to the eye
                                  (checks in compress_pdf); otherwise an exact copy
  assets/img/docs/cv_preview.jpg  thumbnail of the PDF's first page
  assets/img/cv/                  the photo and the logos the site does not already have
  _cv/pdf_source.txt              SHA-256 of the main.pdf behind the files above (the PDF step is skipped
                                  when main.pdf has not changed, so a rebuild does not churn binary files)

then runs `quarto render cv.qmd` (which copies them into docs/) unless --no-render.

The converter knows the macros of main.tex (\\cvevent, \\cvitem, \\pub, ...) and a small table of inline
commands and math. Anything else stops the build with main.tex:<line>, so a new construct is never dropped
silently: teach it to this script. Private data (phone numbers, postal address) is left out on purpose;
privacy_check() fails the build if any of it reaches the page. See _cv/NOTES.md for the decisions.
"""
import argparse, hashlib, html, os, re, shutil, subprocess, sys, tempfile, unicodedata
from pathlib import Path
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parents[1]
DEFAULT_SRC = Path(os.environ.get('CV_SRC', '/home/dlopez/Documentos/2.documentacion/CV_DanielLopezCano'))
OUT_QMD = REPO / 'cv.qmd'
OUT_PDF = REPO / 'assets/files/DLC_CV.pdf'
OUT_THUMB = REPO / 'assets/img/docs/cv_preview.jpg'
OUT_IMG = REPO / 'assets/img/cv'
SITE_LOGOS = REPO / 'assets/img/logos'
PDF_STAMP = REPO / '_cv/pdf_source.txt'
CSS = 'assets/css/cv.css'
SITE_HOST = 'daniellopezcano.github.io'   # links to it stay in the same tab (link-external-newwindow)

# Links in main.tex that do not resolve; the page uses the working address, and every build says so, so the
# entry can go once main.tex is fixed: (address in main.tex, text of the entry it is in, address used, why).
LINK_FIXES = [
    ('https://daniellopezcano.github.io/notes', 'From Differential Geometry to GR', 'notes/diffgeo-gr/index.html',
     'the site has no page at /notes (404); the course lives at /notes/diffgeo-gr/'),
    ('https://daniellopezcano.github.io/notes', 'Notes on the Ly', 'notes/lya-forest/index.html',
     'the site has no page at /notes (404); the notes live at /notes/lya-forest/'),
]

# Font Awesome (LaTeX) -> Bootstrap Icons (shipped with every Quarto page). None: the item is private.
ICONS = {
    'suitcase': 'briefcase', 'university': 'bank', 'laptop-code': 'laptop', 'award': 'award',
    'user-graduate': 'mortarboard-fill', 'chalkboard': 'easel', 'microphone': 'mic', 'camera': 'camera',
    'share': 'forward', 'code': 'code-slash', 'graduation-cap': 'mortarboard', 'bullhorn': 'megaphone',
    'language': 'translate', 'book': 'book', 'paper-plane': 'send', 'envelope': 'envelope', 'globe': 'globe',
    'github': 'github', 'link': 'link-45deg', 'youtube': 'youtube', 'file-alt': 'file-earmark-text',
    'external-link-alt': 'box-arrow-up-right', 'google': 'google', 'orcid': 'person-badge',
    'satellite': 'broadcast', 'check-circle': 'check-circle', 'user': 'person', 'user-friends': 'people',
    'quote-right': 'quote', 'chart-line': 'graph-up', 'phone': None, 'map-marker': None,
}
PRIVATE_ICONS = {'phone': 'phone numbers', 'map-marker': 'postal address'}
# What an icon-only link is, for its accessible name (aria-label / tooltip).
LINK_KIND = {'globe': 'Website', 'github': 'GitHub', 'link': 'Link', 'youtube': 'YouTube',
             'file-alt': 'arXiv', 'external-link-alt': 'Journal'}
# Labels of the publication links: the words of the CV's own legend ("Links: arXiv  journal  code").
PUB_LINKS = {'arxiv': ('file-alt', 'arXiv'), 'journal': ('external-link-alt', 'journal'), 'code': ('github', 'code')}
STATUS_CLASS = {'statusorange': 'cv-status-orange', 'statusgreen': 'cv-status-green'}

# Every math snippet of the CV, typeset by hand (the page needs no MathJax). New math stops the build.
MATH = {
    r'\alpha': '<span class="cv-greek">α</span>', r'\cdot': '·', r'\times': '×',
    r'10^{12}\,h^{-1}M_\odot': '10<sup>12</sup>\u202f<i>h</i><sup>−1</sup>\u202f<i>M</i><sub>⊙</sub>',
}
ACCENTS = {"'": '\u0301', '`': '\u0300', '"': '\u0308', '~': '\u0303', '^': '\u0302'}
DROP0 = {'footnotesize', 'small', 'normalsize', 'large', 'Large', 'scriptsize', 'tiny', 'bfseries', 'itshape',
         'sffamily', 'raggedright', 'raggedleft', 'centering', 'noindent', 'par', 'selectfont', 'cvsmall', 'cvbase'}
DROP1 = {'color', 'vspace', 'hspace'}
SPACE0 = {'hfill', 'quad', 'qquad'}
CS = re.compile(r'\\([A-Za-z]+|.)', re.S)
NBSP, THIN = '\u00a0', '\u202f'


class TexError(Exception):
    pass


class Doc:
    """main.tex with comments blanked (same length, so offsets and line numbers stay right)."""

    def __init__(self, path: Path):
        self.path = path
        raw = path.read_text(encoding='utf-8')
        self.text = re.sub(r'(?<!\\)%[^\n]*', lambda m: ' ' * len(m.group(0)), raw)

    def where(self, pos: int) -> str:
        return f'{self.path.name}:{self.text.count(chr(10), 0, pos) + 1}'


DOC: Doc = None          # set in main()
NOTES = []               # what the build reports at the end (private data left out, link fixes, ...)


def fail(pos, msg):
    raise TexError(f'{DOC.where(pos)}: {msg}')


# ---------------------------------------------------------------- reading TeX

def skip_ws(s, i):
    while i < len(s) and s[i] in ' \t\n':
        i += 1
    return i


def read_group(s, i, base):
    """The {...} group at s[i] (after blanks): (content, absolute start of the content, index after it)."""
    i = skip_ws(s, i)
    if i >= len(s) or s[i] != '{':
        fail(base + i, 'expected {')
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
            if depth == 0:
                return s[i + 1:j], base + i + 1, j + 1
        j += 1
    fail(base + i, 'unbalanced {')


def read_opt(s, i):
    """Skip an optional [...] argument."""
    k = skip_ws(s, i)
    if k < len(s) and s[k] == '[':
        return s.index(']', k) + 1
    return i


def read_args(s, i, base, n):
    args = []
    for _ in range(n):
        g, gb, i = read_group(s, i, base)
        args.append((g, gb))
    return args, i


def read_env(s, i, base, name):
    """s[i:] starts right after \\begin{name}: (body, absolute start, index after \\end{name})."""
    depth, j = 1, i
    pat = re.compile(r'\\(begin|end)\{' + re.escape(name) + r'\}')
    for m in pat.finditer(s, i):
        depth += 1 if m.group(1) == 'begin' else -1
        if depth == 0:
            return s[i:m.start()], base + i, m.end()
    fail(base + i, f'no \\end{{{name}}}')


def unescape_url(u):
    return re.sub(r'\\([%&#_])', r'\1', u.strip())


def resolve_conditionals(body, flags, base):
    """Keep the branches of \\ifshowcv / \\ifshowpubs / \\ifshowmetrics that the document mode selects."""
    out, stack, i = [], [], 0          # stack of [flag value, in else-branch]
    tok = re.compile(r'\\(ifshow[a-z]+|else|fi)(?![A-Za-z])')
    for m in tok.finditer(body):
        if all(on != els for on, els in stack):
            out.append(body[i:m.start()])
        else:
            out.append(re.sub(r'[^\n]', ' ', body[i:m.start()]))      # keep line numbers
        t = m.group(1)
        if t.startswith('ifshow'):
            if t[2:] not in flags:
                fail(base + m.start(), f'unknown conditional \\{t}')
            stack.append([flags[t[2:]], False])
        elif not stack:
            fail(base + m.start(), f'\\{t} without \\if')
        elif t == 'else':
            stack[-1][1] = True
        else:
            stack.pop()
        out.append(' ' * (m.end() - m.start()))
        i = m.end()
    if stack:
        fail(base, 'unclosed \\ifshow...')
    out.append(body[i:])
    return ''.join(out)


# ---------------------------------------------------------------- inline TeX -> HTML

def icon(name, cls=''):
    bi = ICONS.get(name)
    if not bi:
        raise TexError(f'icon {name!r}: no Bootstrap icon mapped (add it to ICONS)')
    return f'<i class="bi bi-{bi}{(" " + cls) if cls else ""}" aria-hidden="true"></i>'


def link_label(kind_icon, url):
    kind = LINK_KIND.get(kind_icon, 'Link')
    u = urlparse(url)
    host = u.netloc.removeprefix('www.')
    if host == 'github.com':
        where = u.path.strip('/').split('/tree/')[0].split('/blob/')[0]
    elif host == 'arxiv.org':
        kind, where = 'arXiv', u.path.rsplit('/', 1)[-1]
    elif not u.netloc:
        where = 'this site, ' + u.path.removesuffix('index.html')
    else:
        where = host
    return f'{kind}: {where}'


def fix_url(url, ctx, pos):
    for old, title, new, why in LINK_FIXES:
        if url == old and title in ctx.get('title', ''):
            NOTES.append(f'link fixed on the page ({DOC.where(pos)}): {old} -> {new} ({why})')
            return new
    return url


def a(url, inner, cls='', label=None):
    attrs = f' href="{html.escape(url)}"'
    if urlparse(url).scheme in ('http', 'https') and urlparse(url).netloc != SITE_HOST:
        attrs += ' target="_blank" rel="noopener"'      # as Quarto does for the site's markdown links
    if cls:
        attrs += f' class="{cls}"'
    if label:
        attrs += f' aria-label="{html.escape(label)}" title="{html.escape(label)}"'
    return f'<a{attrs}>{inner}</a>'


ICON_MARK = re.compile('\x00I:([a-z-]+)\x00')


def icon_link(url, name):
    return a(url, icon(name), 'cv-icon-link', link_label(name, url))


def inline(s, base, ctx=None):
    """TeX text -> HTML. Icons come out as markers (resolved by finish())."""
    ctx = ctx or {}
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '\\':
            m = CS.match(s, i)
            name, pos, i = m.group(1), base + i, m.end()
            if name.isalpha():
                i = skip_ws(s, i)
            if name in DROP0:
                continue
            if name in DROP1:
                _, _, i = read_group(s, i, base)
                continue
            if name == 'fontsize':
                _, i = read_args(s, i, base, 2)
                continue
            if name in SPACE0:
                out.append('\x00HFILL\x00' if name == 'hfill' else ' ')
                continue
            if name in ('textbf', 'textit', 'emph'):
                g, gb, i = read_group(s, i, base)
                tag = 'strong' if name == 'textbf' else 'em'
                out.append(f'<{tag}>{inline(g, gb, ctx)}</{tag}>')
            elif name == 'textcolor':
                (_, (g, gb)), i = read_args(s, i, base, 2)
                out.append(inline(g, gb, ctx))
            elif name == 'href':
                ((u, ub), (g, gb)), i = read_args(s, i, base, 2)
                url = fix_url(unescape_url(u), ctx, ub)
                inner = inline(g, gb, ctx).strip()
                only = ICON_MARK.fullmatch(inner)
                out.append(icon_link(url, only.group(1)) if only else a(url, inner))
            elif name == 'actlink':
                ((u, ub), (g, _)), i = read_args(s, i, base, 2)
                out.append(icon_link(fix_url(unescape_url(u), ctx, ub), g.strip()))
            elif name == 'faIcon':
                g, _, i = read_group(s, i, base)
                out.append(f'\x00I:{g.strip()}\x00')
            elif name.startswith('fa') and len(name) > 2 and name[2].isupper():
                out.append('\x00I:' + re.sub(r'(?<!^)([A-Z])', r'-\1', name[2:]).lower() + '\x00')
            elif name == 'badge':
                ((col, _), (g, gb)), i = read_args(s, i, base, 2)
                if col not in STATUS_CLASS:
                    fail(pos, f'badge colour {col!r} unknown')
                out.append(f'<span class="cv-status {STATUS_CLASS[col]}">{inline(g, gb, ctx)}</span>')
            elif name == 'me':
                out.append(MACROS['me'])
            elif name in ('ldots', 'dots'):
                out.append('…')
            elif name == 'LaTeX':
                out.append('LaTeX')
            elif name == '\\':
                i = read_opt(s, i)
                out.append('<br>')
            elif name == ',':
                out.append(THIN)
            elif name in (';', ' ', '\n'):
                out.append(' ')
            elif name in '&%#_{}$':
                out.append(html.escape(name))
            elif name in ACCENTS:
                k = skip_ws(s, i)
                if s[k] == '{':
                    g, _, i = read_group(s, k, base)
                else:
                    g, i = s[k], k + 1
                letter = {'\\i': 'i', '\\i ': 'i'}.get(g.strip(), g.strip())
                if len(letter) != 1:
                    fail(pos, f'accent on {g!r}')
                out.append(unicodedata.normalize('NFC', letter + ACCENTS[name]))
            else:
                fail(pos, f'unknown command \\{name} (teach it to _cv/build.py)')
        elif c == '{':
            g, gb, i = read_group(s, i, base)
            out.append(inline(g, gb, ctx))
        elif c == '$':
            j = s.find('$', i + 1)
            key = s[i + 1:j].strip()
            if j < 0 or key not in MATH:
                fail(base + i, f'math ${key}$ is not in the MATH table of _cv/build.py')
            out.append(MATH[key])
            i = j + 1
        elif c == '~':
            out.append(NBSP)
            i += 1
        elif s.startswith('``', i):
            out.append('“'); i += 2
        elif s.startswith("''", i):
            out.append('”'); i += 2
        elif s.startswith('---', i):
            out.append('—'); i += 3
        elif s.startswith('--', i):
            out.append('–'); i += 2
        elif c == "'":
            out.append('’'); i += 1
        elif c == '`':
            out.append('‘'); i += 1
        elif c in ' \t\n':
            out.append(' ')
            i += 1
        elif c == '&':
            fail(base + i, 'alignment & outside a tabular')
        else:
            out.append(html.escape(c))
            i += 1
    return re.sub(r' {2,}', ' ', ''.join(out))


def finish(h):
    """Resolve icon markers; tidy blanks."""
    h = ICON_MARK.sub(lambda m: icon(m.group(1)), h)
    h = re.sub(r' *<br> *', '<br>', h)
    return h.strip()


def text(s, base, ctx=None):
    return finish(inline(s, base, ctx))


MACROS = {}


# ---------------------------------------------------------------- blocks

class Page:
    def __init__(self):
        self.parts = []          # markdown and raw HTML, in order
        self.html = []           # pending raw HTML
        self.skills = []
        self.pubno = 0
        self.images = {}         # LaTeX image name -> site path
        self.hero = {}

    def raw(self, h):
        self.flush_skills()
        self.html.append(h)

    def heading(self, level, title_html, icon_name=None):
        self.flush_skills()
        self.flush()
        plain = re.sub(r'<[^>]+>', '', html.unescape(title_html))
        if not re.fullmatch(r"[\w &/,’'-]+", plain):
            raise TexError(f'heading {plain!r}: characters the markdown heading writer does not escape')
        slug = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', plain).encode('ascii', 'ignore').decode().lower()).strip('-')
        ic = (icon(icon_name, 'cv-h-icon') + ' ') if icon_name else ''
        self.parts.append(f'{"#" * level} {ic}{title_html} {{#{slug}}}\n')

    def flush(self):
        if self.html:
            self.parts.append('```{=html}\n' + '\n'.join(self.html) + '\n```\n')
            self.html = []

    def flush_skills(self):
        if self.skills:
            items = '\n'.join(f'<div class="cv-skill"><dt>{t}</dt><dd>{d}</dd></div>' for t, d in self.skills)
            self.skills = []
            self.html.append(f'<dl class="cv-skills">\n{items}\n</dl>')


def image(name, pos):
    """Site path of a LaTeX image: a site logo with the same bytes, else a web-sized copy in assets/img/cv/."""
    if name in PAGE.images:
        return PAGE.images[name]
    cands = [p for p in SRC.iterdir() if p.stem == name or p.name == name]
    if len(cands) != 1:
        fail(pos, f'image {name!r}: {len(cands)} matching files in {SRC}')
    f = cands[0]
    data = f.read_bytes()
    for logo in sorted(SITE_LOGOS.glob('*')):
        if logo.read_bytes() == data:
            PAGE.images[name] = str(logo.relative_to(REPO))
            return PAGE.images[name]
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    is_photo = name.lower().startswith('photo')
    out = OUT_IMG / (Path(name).stem.lower() + ('.jpg' if is_photo else '.png'))
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / out.name
        opts = ['-resize', '480x480>', '-strip']
        if is_photo:
            opts += ['-background', 'white', '-flatten', '-quality', '86']
        else:
            opts += ['-define', 'png:exclude-chunks=date,time']
        subprocess.run(['convert', str(f), *opts, str(tmp)], check=True)
        if not out.exists() or out.read_bytes() != tmp.read_bytes():
            shutil.copyfile(tmp, out)
    PAGE.images[name] = str(out.relative_to(REPO))
    return PAGE.images[name]


def img_tag(path, alt, cls):
    w, h = subprocess.run(['identify', '-format', '%w %h', str(REPO / path)], capture_output=True, text=True,
                          check=True).stdout.split()
    return f'<img src="{path}" alt="{html.escape(alt)}" class="{cls}" width="{w}" height="{h}" loading="lazy">'


def section_head(arg, pos):
    m = re.fullmatch(r'\s*\\fa([A-Za-z]+)\s*\\;-\s*(.+?)\s*', arg, re.S)
    if not m:
        fail(pos, 'section head: expected "\\faIcon \\;- TITLE"')
    name = re.sub(r'(?<!^)([A-Z])', r'-\1', m.group(1)).lower()
    PAGE.heading(2, text(m.group(2), pos + m.start(2)), name)


def cvevent(args):
    (fr, frb), (to, tob), (role, rb), (org, ob), (loc, lb), (logo, gb), (body, bb) = args
    ctx = {'title': role}
    logo_path = image(logo.strip(), gb)
    PAGE.raw('\n'.join([
        '<div class="trajectory-entry cv-entry">',
        f'<span class="cv-logo">{img_tag(logo_path, "", "trajectory-logo")}</span>',
        '<div class="trajectory-body">',
        f'<p class="cv-date">{text(fr, frb)} – {text(to, tob)}</p>',
        f'<h3>{text(role, rb, ctx)}</h3>',
        f'<p class="cv-meta"><em>{text(org, ob, ctx)}</em> · {text(loc, lb, ctx)}</p>',
        f'<p>{text(body, bb, ctx)}</p>',
        '</div>', '</div>']))


def itemize(body, base):
    m = re.search(r'\\renewcommand\{\\labelitemi\}', body)
    label_icon = None
    if m:
        [(g, gb)], end = read_args(body, m.end(), base, 1)
        label_icon = re.search(r'\\fa([A-Za-z]+)', g)
        label_icon = label_icon and re.sub(r'(?<!^)([A-Z])', r'-\1', label_icon.group(1)).lower()
        body = body[:m.start()] + ' ' * (end - m.start()) + body[end:]
    items = [(mm.end(), None) for mm in re.finditer(r'\\item(?![A-Za-z])', body)]
    if body[:items[0][0] - 5].strip():
        fail(base, 'text before the first \\item')
    out = ['<div class="cv-grants">']
    for k, (start, _) in enumerate(items):
        end = items[k + 1][0] - 5 if k + 1 < len(items) else len(body)
        h = text(body[start:end], base + start)
        if '\x00HFILL\x00' not in h:
            fail(base + start, 'grant item: expected "title \\hfill dates \\\\ text"')
        title, rest = h.split('\x00HFILL\x00', 1)
        dates, _, more = rest.strip().partition('<br>')
        out += ['<div class="cv-grant">',
                f'<div class="cv-grant-head">{icon(label_icon, "cv-grant-icon") if label_icon else ""}'
                f'<h3 class="cv-grant-title">{title.strip()}</h3>'
                f'<p class="cv-date">{re.sub(r"</?strong>", "", dates.strip())}</p></div>',
                f'<p>{more.strip()}</p>', '</div>']
    out.append('</div>')
    PAGE.raw('\n'.join(out))


def cvitem(args, logo=None):
    (year, yb), (tag, tb), (title, ttb), (where, wb), (extra, eb) = args
    ctx = {'title': title}
    head = (f'<p class="cv-item-head"><span class="cv-tag">{text(tag, tb)}</span> '
            f'<strong class="cv-item-title">{text(title, ttb, ctx)}</strong> '
            f'<span class="cv-item-where">· {text(where, wb, ctx)}</span></p>')
    parts = ['<div class="cv-item' + (' cv-item-has-logo' if logo else '') + '">',
             f'<span class="cv-year">{text(year, yb)}</span>', '<div class="cv-item-body">', head]
    if logo is None and extra.strip():
        parts.append(f'<p class="cv-item-details">{text(extra, eb, ctx)}</p>')
    parts.append('</div>')
    if logo is not None:
        parts.append(f'<span class="cv-item-logo">{img_tag(image(extra.strip(), eb), "", "")}</span>')
    parts.append('</div>')
    PAGE.raw('\n'.join(parts))


def pub(args):
    (year, yb), (role, rb), (status, sb), (title, tb), (authors, ab), (venue, vb), (summary, smb), (links, lb) = args
    PAGE.pubno += 1
    btns = []
    for m in re.finditer(r'\\(arxiv|journal|code)\s*\{', links):
        g, gb, _ = read_group(links, m.end() - 1, lb)
        url = 'https://arxiv.org/abs/' + g.strip() if m.group(1) == 'arxiv' else unescape_url(g)
        ic, label = PUB_LINKS[m.group(1)]
        btns.append(a(url, f'{icon(ic)} {label}', 'btn btn-outline-info btn-sm'))
    rest = re.sub(r'\\(arxiv|journal|code)\s*\{[^{}]*\}', '', links).strip()
    if rest:
        fail(lb, f'publication links: unexpected {rest[:40]!r}')
    venue_h = text(venue, vb) + (' ' + text(status, sb) if status.strip() else '')
    PAGE.raw('\n'.join([
        '<article class="cv-pub">',
        f'<span class="cv-pub-num">{PAGE.pubno}</span>',
        '<div class="cv-pub-body">',
        f'<p class="cv-pub-side"><span class="cv-year">{text(year, yb)}</span> <span class="cv-tag">{text(role, rb)}</span></p>',
        f'<h4 class="cv-pub-title">{text(title, tb)}</h4>',
        f'<p class="cv-pub-authors">{text(authors, ab)}</p>',
        f'<p class="cv-pub-venue">{venue_h}</p>',
        *([f'<p class="cv-pub-summary">{text(summary, smb)}</p>'] if summary.strip() else []),
        f'<div class="media-actions">{" ".join(btns)}</div>' if btns else '',
        '</div>', '</article>']))


def header_main(body, base):
    """Name, role, keywords and the contact table (private cells left out)."""
    k = body.find('\\begin{tabular}')
    lines = []
    i = 0
    while i < k:
        i = skip_ws(body, i)
        if i >= k:
            break
        if body[i] == '{':
            g, gb, i = read_group(body, i, base)
            if '\\rule' not in g:
                lines.append(text(g, gb))
        elif body.startswith('\\\\', i):
            i = read_opt(body, i + 2)
        else:
            m = CS.match(body, i)
            if m and m.group(1) in DROP0:
                i = m.end()
            else:
                fail(base + i, 'header: unexpected ' + body[i:i + 30])
    if len(lines) != 3:
        fail(base, f'header: expected name, role and keywords, found {len(lines)} lines')
    tab, tb, _ = read_env(body, k + len('\\begin{tabular}'), base, 'tabular')
    _, _, j = read_group(tab, 0, tb)                       # column spec
    contacts = []
    for row in re.split(r'\\\\(?:\[[^\]]*\])?', tab[j:]):
        for cell in split_cells(row):
            cs = tab[j:].find(cell) + j
            m = re.match(r'\s*\\contact\s*', cell)
            if not cell.strip():
                continue
            if not m:
                fail(tb + cs, 'header: a contact cell that is not \\contact{icon}{text}')
            (ic, _), (val, vb) = read_args(cell, m.end(), tb + cs, 2)[0]
            name = re.sub(r'(?<!^)([A-Z])', r'-\1', ic.strip().removeprefix('\\fa')).lower()
            if name in PRIVATE_ICONS:
                NOTES.append(f'left out as private ({DOC.where(vb)}): {PRIVATE_ICONS[name]}: '
                             + re.sub(r'<[^>]+>', '', text(val, vb)))
                continue
            contacts.append((name, text(val, vb)))
    PAGE.hero.update(name=lines[0], role=lines[1], keywords=lines[2], contacts=contacts)


def split_cells(row):
    cells, depth, cur = [], 0, []
    i = 0
    while i < len(row):
        c = row[i]
        if c == '\\':
            cur.append(row[i:i + 2]); i += 2; continue
        depth += c == '{'
        depth -= c == '}'
        if c == '&' and depth == 0:
            cells.append(''.join(cur)); cur = []
        else:
            cur.append(c)
        i += 1
    cells.append(''.join(cur))
    return cells


def header_photo(body, base):
    m = re.search(r'\\href\{([^}]*)\}\{\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}\}', body)
    if not m:
        fail(base, 'photo: expected \\href{url}{\\includegraphics{file}}')
    PAGE.hero.update(photo=image(m.group(2), base + m.start(2)), photo_url=unescape_url(m.group(1)))


def write_hero():
    h = PAGE.hero
    contacts = '\n'.join(f'<li>{icon(n)} <span>{v}</span></li>' for n, v in h['contacts'])
    PAGE.raw('\n'.join([
        '<header class="cv-hero">',
        f'<a class="cv-photo-link" href="{h["photo_url"]}">{img_tag(h["photo"], "Portrait of Daniel López-Cano", "cv-photo")}</a>',
        '<div class="cv-hero-text">',
        f'<p class="cv-name">{h["name"]}</p>',
        f'<p class="cv-role">{h["role"]}</p>',
        f'<p class="cv-keywords">{h["keywords"]}</p>',
        f'<ul class="cv-contact">\n{contacts}\n</ul>',
        '<div class="media-actions cv-hero-actions">',
        f'<a href="{OUT_PDF.relative_to(REPO)}" class="btn btn-primary btn-sm">{icon("file-alt")} Download PDF</a>',
        '</div>',
        '</div>',
        f'<a class="cv-pdf-link" href="{OUT_PDF.relative_to(REPO)}">'
        f'{img_tag(str(OUT_THUMB.relative_to(REPO)), "Preview of CV PDF", "cv-pdf-thumb")}</a>',
        '</header>']))


def pub_masthead(body, base):
    groups = []
    i = 0
    while True:
        i = skip_ws(body, i)
        if i >= len(body):
            break
        if body[i] != '{':
            fail(base + i, 'publication masthead: unexpected ' + body[i:i + 30])
        g, gb, i = read_group(body, i, base)
        groups.append(text(g, gb))
    PAGE.masthead = groups


def pub_links(body, base):
    if '\\publinks' not in body:
        fail(base, 'expected \\publinks')
    d, db = MACROS['publinks']
    btns, i = [], 0
    for m in re.finditer(r'\\href', d):
        ((u, _), (g, gb)), j = read_args(d, m.end(), db, 2)
        k = skip_ws(d, j)
        if d.startswith('\\;', k):
            k += 2
        ic, icb, _ = read_group(d, k, db)
        btns.append(a(unescape_url(u), f'{text(g, gb)} {text(ic, icb)}', 'btn btn-outline-info btn-sm'))
    groups = getattr(PAGE, 'masthead', [])
    if len(groups) != 2:
        fail(base, 'publication masthead: expected title and date')
    title, date = groups
    PAGE.raw('\n'.join(['<div class="cv-pub-masthead">',
                        f'<p class="cv-pub-mast-title"><span>{title}</span> <span class="cv-pub-mast-date">{date}</span></p>',
                        f'<div class="media-actions">{" ".join(btns)}</div>', '</div>']))


def metrics(body, base):
    groups, stats = [], []
    for m in re.finditer(r'\\(bandgroup|bandstat)\s*\{', body):
        n = 2 if m.group(1) == 'bandgroup' else 4
        args, _ = read_args(body, m.end() - 1, base, n)
        x = float(args[0][0])
        if m.group(1) == 'bandgroup':
            groups.append([x, text(*args[1]), []])
        else:
            stats.append((x, args[1][0].strip(), text(*args[2]), text(*args[3])))
    groups.sort()
    for st in stats:
        owner = [g for g in groups if g[0] <= st[0]]
        if not owner:
            fail(base, 'metrics: a number outside every group')
        owner[-1][2].append(st)
    out = ['<div class="cv-metrics">']
    for _, label, sts in groups:
        cells = '\n'.join(f'<li>{icon(ic, "cv-metric-icon")}<span class="cv-metric-num">{num}</span>'
                          f'<span class="cv-metric-label">{lab}</span></li>' for _, ic, num, lab in sts)
        out += ['<div class="cv-metrics-group">', f'<p class="cv-metrics-title">{label}</p>',
                f'<ul class="cv-metrics-list">\n{cells}\n</ul>', '</div>']
    out.append('</div>')
    PAGE.raw('\n'.join(out))


SKIP = {'vspace': 1, 'noindent': 0, 'small': 0, 'footnotesize': 0, 'normalsize': 0, 'newpage': 0, 'cvbase': 0,
        'raggedcolumns': 0, 'setlength': 2, 'renewcommand': 2, 'begingroup': 0, 'endgroup': 0, 'hypersetup': 1,
        'hfill': 0, 'par': 0}
BLOCKS = {'SectionHead': 1, 'cvevent': 7, 'CompactSubsecTitle': 2, 'CompactMinorTitle': 1, 'cvitem': 5,
          'cvitemlogo': 5, 'skillentry': 2, 'PubSubHead': 2, 'pub': 8}
INLINE_START = {'textbf', 'textit', 'emph', 'href'}


def walk(s, base):
    i = 0
    while True:
        i = skip_ws(s, i)
        if i >= len(s):
            return
        pos = base + i
        c = s[i]
        if c == '\\':
            m = CS.match(s, i)
            name, j = m.group(1), m.end()
            if name == '\\':
                i = read_opt(s, j)
            elif name in SKIP:
                _, i = read_args(s, j, base, SKIP[name])
            elif name == 'newcommand':
                [(nm, _)], k = read_args(s, j, base, 1)
                k = read_opt(s, k)
                [(d, db)], i = read_args(s, k, base, 1)
                MACROS[nm.strip().lstrip('\\')] = (d, db)
            elif name in BLOCKS:
                args, i = read_args(s, j, base, BLOCKS[name])
                if name == 'SectionHead':
                    section_head(*args[0])
                elif name == 'cvevent':
                    cvevent(args)
                elif name == 'CompactSubsecTitle':
                    PAGE.heading(2, text(*args[1]), icon_name_of(*args[0]))
                elif name == 'CompactMinorTitle':
                    PAGE.heading(3, text(*args[0]))
                elif name == 'cvitem':
                    cvitem(args)
                elif name == 'cvitemlogo':
                    cvitem(args, logo=True)
                elif name == 'skillentry':
                    PAGE.skills.append((text(*args[0]), text(*args[1])))
                elif name == 'PubSubHead':
                    PAGE.heading(3, text(*args[1]), icon_name_of(*args[0]))
                elif name == 'pub':
                    pub(args)
            elif name == 'begin':
                [(env, _)], k = read_args(s, j, base, 1)
                env = env.strip()
                if env == 'multicols':
                    _, i = read_args(s, k, base, 1)
                    continue
                k = read_opt(s, k)
                if env == 'minipage':
                    _, k = read_args(s, k, base, 1)
                body, bb, i = read_env(s, k, base, env)
                if env == 'itemize':
                    itemize(body, bb)
                elif env == 'minipage' and '\\contact' in body:
                    header_main(body, bb)
                elif env == 'minipage' and 'includegraphics' in body:
                    header_photo(body, bb)
                    write_hero()
                elif env == 'minipage' and 'Publication list' in body:
                    pub_masthead(body.replace('\\raggedleft', ''), bb)
                elif env == 'minipage' and '\\publinks' in body:
                    pub_links(body, bb)
                elif env == 'tikzpicture' and '\\bandstat' in body:
                    metrics(body, bb)
                else:
                    fail(pos, f'environment {env} with content the script does not know')
            elif name == 'end':
                [(env, _)], i = read_args(s, j, base, 1)
                if env.strip() != 'multicols':
                    fail(pos, f'stray \\end{{{env}}}')
            elif name in INLINE_START:
                end = re.search(r'\n\s*\n|\\end\{', s[i:])
                stop = i + (end.start() if end else len(s) - i)
                PAGE.raw(f'<p class="cv-para">{text(s[i:stop], pos)}</p>')
                i = stop
            else:
                fail(pos, f'unknown block command \\{name} (teach it to _cv/build.py)')
        elif c == '{':
            g, gb, i = read_group(s, i, base)
            if 'Links:' in g:
                NOTES.append(f'not on the page ({DOC.where(gb)}): the PDF\'s link legend '
                             '("Links: arXiv journal code"); its words label the publication buttons instead')
            else:
                fail(pos, 'a {group} at block level that the script does not know')
        else:
            fail(pos, f'text at block level: {s[i:i + 40]!r}')


def icon_name_of(s, pos):
    m = re.fullmatch(r'\s*\\fa([A-Za-z]+)\s*', s)
    if not m:
        fail(pos, 'expected one \\faIcon')
    return re.sub(r'(?<!^)([A-Z])', r'-\1', m.group(1)).lower()


# ---------------------------------------------------------------- checks and files

PRIVATE_PATTERNS = [
    (r'\(\+\d{1,3}\)|\+\d{1,3}[\s-]?\d', 'phone number'),
    (r'\b\d{3}-\d{3}-\d{3}\b|\b\d{5}-\d{4}\b', 'phone number'),
    (r'\bRua\b|\bMatão\b|\b1371\b|maps\.app\.goo\.gl|google\.[a-z.]+/maps', 'postal address'),
    (r'\b\d{5}-\d{3}\b', 'postal code'),
    (r'(?i)date of birth|born on|nationality|passport|\bDNI\b|\bNIE\b|\bCPF\b|\bRNE\b', 'personal ID or birth data'),
]


def privacy_check(page):
    bad = [(what, m.group(0)) for pat, what in PRIVATE_PATTERNS for m in re.finditer(pat, page)]
    if bad:
        raise TexError('private data on the page: ' + '; '.join(f'{w}: {t!r}' for w, t in bad))


def sha256(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def run(*cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw).stdout


def compress_pdf(src: Path, dst: Path):
    """Ghostscript, images downsampled to 600 ppi and kept lossless (Flate, no JPEG). Used only if it saves
    at least 10 % and the result has the same pages, the same text, the same links, and renders the same
    at 150 dpi (no more than 0.5 % of pixels differ by more than 25 %: glyph anti-aliasing moves a little)."""
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        out = td / 'gs.pdf'
        run('gs', '-q', '-o', str(out), '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5',
            '-dDownsampleColorImages=true', '-dDownsampleGrayImages=true',
            '-dColorImageDownsampleType=/Bicubic', '-dGrayImageDownsampleType=/Bicubic',
            '-dColorImageResolution=600', '-dGrayImageResolution=600',
            '-dColorImageDownsampleThreshold=1.5', '-dGrayImageDownsampleThreshold=1.5',
            '-dAutoFilterColorImages=false', '-dAutoFilterGrayImages=false',
            '-dColorImageFilter=/FlateEncode', '-dGrayImageFilter=/FlateEncode', '-dDetectDuplicateImages=true',
            str(src))
        a_sz, b_sz = src.stat().st_size, out.stat().st_size
        why = None
        pages = lambda p: re.search(r'Pages:\s+(\d+)', run('pdfinfo', str(p))).group(1)
        words = lambda p: sorted(run('pdftotext', str(p), '-').split())
        links = lambda p: re.findall(r'href="(http[^"]*)"', run('pdftohtml', '-q', '-xml', '-i', '-stdout', str(p)))
        if b_sz > 0.9 * a_sz:
            why = f'saves only {100 - 100 * b_sz / a_sz:.0f} %'
        elif pages(src) != pages(out):
            why = 'page count differs'
        elif words(src) != words(out):
            why = 'extracted text differs'
        elif links(src) != links(out):
            why = 'links differ'
        else:
            for k in range(1, int(pages(src)) + 1):
                for tag, p in (('a', src), ('b', out)):
                    run('pdftoppm', '-r', '150', '-f', str(k), '-l', str(k), '-png', '-singlefile', str(p), str(td / f'{tag}{k}'))
                r = subprocess.run(['compare', '-metric', 'AE', '-fuzz', '25%', str(td / f'a{k}.png'),
                                    str(td / f'b{k}.png'), 'null:'], capture_output=True, text=True)
                ae = float(r.stderr.split()[0])
                w, h = run('identify', '-format', '%w %h', str(td / f'a{k}.png')).split()
                total = int(w) * int(h)
                if ae / total > 0.005:
                    why = f'page {k} renders differently ({100 * ae / total:.2f} % of pixels)'
                    break
        if why:
            shutil.copyfile(src, dst)
            return f'PDF copied unchanged ({a_sz / 1e6:.2f} MB): Ghostscript not used, {why}'
        shutil.copyfile(out, dst)
        return f'PDF compressed by Ghostscript: {a_sz / 1e6:.2f} MB -> {b_sz / 1e6:.2f} MB, lossless checks passed'


def pdf_and_thumb(src_pdf: Path, force=False):
    digest = sha256(src_pdf)
    if not force and PDF_STAMP.exists() and PDF_STAMP.read_text().split()[0] == digest \
            and OUT_PDF.exists() and OUT_THUMB.exists():
        return 'PDF and thumbnail up to date (main.pdf unchanged)'
    msg = compress_pdf(src_pdf, OUT_PDF)
    with tempfile.TemporaryDirectory() as td:
        run('pdftoppm', '-f', '1', '-l', '1', '-r', '150', '-png', '-singlefile', str(src_pdf), f'{td}/p1')
        run('convert', f'{td}/p1.png', '-resize', '604x', '-strip', '-quality', '85', str(OUT_THUMB))
    PDF_STAMP.write_text(f'{digest}  main.pdf (SHA-256 of the source of assets/files/DLC_CV.pdf and its thumbnail)\n')
    return msg


def check_links(page):
    import urllib.request
    urls = sorted(set(u for u in re.findall(r'href="(https?://[^"]+)"', page)))
    bad = 0
    for u in urls:
        req = urllib.request.Request(html.unescape(u), headers={'User-Agent': 'Mozilla/5.0 (link check)'})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                code = r.status
        except Exception as e:  # noqa: BLE001
            code = getattr(e, 'code', None) or type(e).__name__
        ok = code in (200, 301, 302)
        bad += not ok
        print(f'  {"ok " if ok else "BAD"} {code} {html.unescape(u)}')
    print(f'{len(urls)} external links, {bad} not answering 200')


FRONT = '''---
title: "CV"
description: "I am a postdoctoral researcher in computational cosmology at the Institute of Physics of the University of São Paulo (IFUSP). My research combines cosmological simulations, machine learning for astrophysics, survey-oriented modelling, and scientific software development. I am also interested in the creation of pedagogical resources that leverage computational tools to produce interactive materials and exercises, with the aim of facilitating the learning of complex topics in theoretical physics and astrophysics."
page-layout: full
css:
  - {css}
resources:
{resources}
---

<!-- Generated by _cv/build.py from main.tex: do not edit; change main.tex (or the script) and run
     python3 _cv/build.py -->

'''


PAGE: Page = None
SRC: Path = None


def main():
    global DOC, PAGE, SRC
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--src', type=Path, default=DEFAULT_SRC)
    ap.add_argument('--no-render', action='store_true')
    ap.add_argument('--check-links', action='store_true')
    ap.add_argument('--force-pdf', action='store_true', help='redo the PDF and thumbnail even if main.pdf is unchanged')
    opt = ap.parse_args()
    SRC = opt.src.resolve()
    tex, pdf = SRC / 'main.tex', SRC / 'main.pdf'
    if REPO in SRC.parents or SRC == REPO:
        sys.exit('the CV source must live outside the repository')
    for f in (tex, pdf):
        if not f.exists():
            sys.exit(f'missing {f}')
    if pdf.stat().st_mtime < tex.stat().st_mtime:
        print(f'WARNING: main.pdf is older than main.tex: compile the CV before publishing its PDF')

    DOC = Doc(tex)
    t = DOC.text
    b0 = t.index('\\begin{document}') + len('\\begin{document}')
    b1 = t.index('\\end{document}')
    pre = t[:b0]
    mode = re.search(r'\\newcommand\{\\docmode\}\{(\w+)\}', pre).group(1)
    flags = {'full': (True, True), 'cv': (True, False), 'publist': (False, True)}.get(mode)
    if not flags:
        sys.exit(f'unknown \\docmode {mode!r}')
    metrics_on = re.findall(r'\\showmetrics(true|false)', pre)
    flags = {'showcv': flags[0], 'showpubs': flags[1], 'showmetrics': (metrics_on or ['true'])[-1] == 'true'}
    me = re.search(r'\\newcommand\{\\me\}\{', pre)
    g, gb, _ = read_group(pre, me.end() - 1, 0)
    MACROS['me'] = text(g, gb)

    print(pdf_and_thumb(pdf, opt.force_pdf))      # first: the page shows the thumbnail (its size goes in <img>)
    PAGE = Page()
    body = resolve_conditionals(t[b0:b1], flags, b0)
    try:
        walk(body, b0)
        PAGE.flush_skills()
        PAGE.flush()
    except TexError as e:
        sys.exit(f'error: {e}')
    page = '\n'.join(PAGE.parts)
    privacy_check(page)
    if not flags['showcv']:
        sys.exit('\\docmode publist: the page needs the CV part; set \\docmode to full or cv')

    res = [str(OUT_PDF.relative_to(REPO)), str(OUT_THUMB.relative_to(REPO))] + sorted(
        v for v in set(PAGE.images.values()) if v.startswith('assets/img/cv/'))
    for stale in OUT_IMG.glob('*') if OUT_IMG.exists() else []:
        if str(stale.relative_to(REPO)) not in res:
            stale.unlink()
            print(f'removed {stale.relative_to(REPO)} (no longer used)')
    resources = '\n'.join(f'  - {r}' for r in res)
    qmd = FRONT.format(css=CSS, resources=resources) + page
    if not OUT_QMD.exists() or OUT_QMD.read_text(encoding='utf-8') != qmd:     # unchanged: keep its date (sitemap)
        OUT_QMD.write_text(qmd, encoding='utf-8')
    print(f'wrote cv.qmd ({PAGE.pubno} publications, {len(PAGE.images)} images) from {tex}')
    for n in NOTES:
        print('note:', n)
    if opt.check_links:
        check_links(page)
    if not opt.no_render:
        r = subprocess.run(['quarto', 'render', 'cv.qmd'], cwd=REPO, capture_output=True, text=True)
        log = r.stdout + r.stderr
        warn = [l for l in log.splitlines() if re.search(r'WARN|ERROR|\[WARNING\]', l)]
        print('\n'.join(log.strip().splitlines()[-2:]))
        if r.returncode or warn:
            print('\n'.join(warn))
            sys.exit('quarto render cv.qmd: failed or warned (above)')
        print('rendered docs/cv.html')


if __name__ == '__main__':
    main()
