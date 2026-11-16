#!/usr/bin/env python3
"""Hand-written tool: the rendered site outside the course section must be what a git ref has.

    python3 _port/tools/site_unchanged.py [REF]        (REF defaults to `main`; exit code 0 = unchanged)

Compares docs/ in the working tree with docs/ of REF, ignoring docs/notes/ (the course section).
Accepted differences, and nothing else (KICKOFF rule 6; Lyα brief "Site updates", Lyα DECISIONS L15, L19):
  * the navbar entry "Lecture Notes": absent at REF, a plain link into notes/diffgeo-gr/, or the dropdown whose
    menu has exactly the two course links ("From Differential Geometry to General Relativity",
    "Lyman-α Forest"), and the script of includes/navbar-dropdown.html, once, where Quarto puts it;
  * the Teaching page: its section "Lecture Notes" (heading and cards) removed, the graduate course card's
    PDF button labelled "Download PDF" instead of "Lecture notes", and the MathJax scripts that only that
    section's "Ly$\alpha$" needed; the same in its search.json entries;
  * the Research page: the OJALÁ card's title as accepted and "Astronomy & Astrophysics, in press (accepted
    12 November 2026)" instead of the arXiv preprint line; the same in its search.json entries;
  * the files in ALLOWED_DELETED (the old Lyα PDF and its thumbnail, deleted as asked; the first course's
    thumbnail, which no page shows any more, so Quarto no longer copies it);
  * links with class `dg-read-online` (the "Read online" buttons on the Teaching page), and their label in the
    Teaching page's entries of search.json;
  * the content hash in the name of Quarto's Bootstrap bundle, and in the bundle itself only
    rules whose selector mentions `sidebar` (a site with a sidebar gets them; DECISIONS D26d);
  * site_libs files that only the course pages use (extra files are allowed there, missing ones are not);
  * search.json and sitemap.xml: only entries outside notes/ are compared (sitemap: addresses, not dates);
  * files in ALLOWED_CHANGED (decided by the author; each with its reason).
"""
import json, re, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
REF = sys.argv[1] if len(sys.argv) > 1 else 'main'
# Files the author asked to replace (REDESIGN.md, answer 2): the PDF of the notes and its thumbnail.
ALLOWED_CHANGED = {
    'docs/assets/files/docs/from_differential_geometry_to_general_relativity.pdf',
    'docs/assets/img/docs/from_differential_geometry_to_general_relativity.png',
}

# Files deleted on purpose (Lyα brief, site update 2; REVIEW.md): the old Lyα PDF and its thumbnail show the
# co-authors and lost their last link; the first course's thumbnail was shown only in the removed section.
ALLOWED_DELETED = {
    'docs/assets/files/docs/absorption_lines_in_cosmological_sightlines.pdf',
    'docs/assets/img/docs/absorption_lines_in_cosmological_sightlines.png',
    'docs/assets/img/docs/from_differential_geometry_to_general_relativity.png',
}
DROPDOWN = re.compile(r'<li class="nav-item dropdown ">\s*<a class="nav-link dropdown-toggle[^"]*" href="#" id="nav-menu-lecture-notes"'
                      r'[^>]*>\s*<span class="menu-text">Lecture Notes</span>\s*</a>\s*<ul class="dropdown-menu"[^>]*>(.*?)</ul>\s*</li>', re.S)
PLAIN = re.compile(r'<li class="nav-item">\s*<a class="nav-link[^"]*" href="[^"]*notes/diffgeo-gr/index\.html"[^>]*>\s*'
                   r'<span class="menu-text">Lecture Notes</span></a>\s*</li>')
MENU = [('notes/diffgeo-gr/index.html', 'From Differential Geometry to General Relativity'),
        ('notes/lya-forest/index.html', 'Lyman-α Forest')]
INCLUDE = (REPO / 'includes' / 'navbar-dropdown.html').read_text(encoding='utf-8').strip()
OJALA_OLD = 'OJALÁ: Optimizing J-PAS Astronomy for Large-scale Analysis'
OJALA_NEW = ('OJALÁ: Optimizing J-PAS Astronomy for Large-scale Analysis. A transformer-based model for source '
             'classification and physical-parameter inference')
OJALA_ID = 'ojalá-optimizing-j-pas-astronomy-for-large-scale-analysis'
OJALA_ID_NEW = OJALA_ID + '.-a-transformer-based-model-for-source-classification-and-physical-parameter-inference'


def nav_new(s: str, where: str, failures: list) -> str:
    """The dropdown in a page of the working tree: exactly the two course links; then a placeholder."""
    m = DROPDOWN.search(s)
    if not m:
        return s
    items = re.findall(r'<a class="dropdown-item[^"]*" href="(?:\./|(?:\.\./)+)?([^"]+)"[^>]*>\s*<span class="dropdown-text">([^<]*)</span>', m.group(1))
    if items != MENU:
        failures.append(f'{where}: the Lecture Notes menu is {items}, expected {MENU}')
    s = s[:m.start()] + '<li>LECTURE-NOTES</li>' + s[m.end():]
    if s.count(INCLUDE) != 1:
        failures.append(f'{where}: the script of includes/navbar-dropdown.html is there {s.count(INCLUDE)} times (expected once)')
    return s.replace(INCLUDE + '\n', '', 1).replace(INCLUDE, '', 1)


def nav_old(s: str) -> str:
    return PLAIN.sub('<li>LECTURE-NOTES</li>', s)


def teaching_old(s: str) -> str:
    """The accepted changes of the Teaching page, applied to REF's rendering."""
    s = re.sub(r'<section id="lecture-notes" class="level2">.*?</section>\s*(?=<section id="other-projects)', '', s, count=1, flags=re.S)
    s = s.replace('btn-sm">Lecture notes</a>', 'btn-sm">Download PDF</a>', 1)
    s = re.sub(r'[ \t]*<script[^>]*(?:polyfill|mathjax)[^>]*></script>\n', '', s)
    # Quarto's helper that typesets math in the page (window.Quarto.typesetMath): written only on pages with math
    return re.sub(r'\n<script type="text/javascript">\nconst typesetMath = .*?</script>\n', '\n', s, count=1, flags=re.S)


def research_old(s: str) -> str:
    s = s.replace(OJALA_ID, OJALA_ID_NEW).replace(f'>{OJALA_OLD}</h3>', f'>{OJALA_NEW}</h3>')
    return s.replace('<em>arXiv preprint, arXiv:2604.00661</em>', '<em>Astronomy &amp; Astrophysics</em>, in press (accepted 12 November 2026)')


def search_old(e: dict) -> dict | None:
    """REF's search.json entry as the accepted changes make it (None: the entry is gone)."""
    h, t = e.get('href', ''), e.get('text')
    if h.startswith('teaching_and_projects.html'):
        if '#lecture-notes' in h or '#from-differential-geometry-to-general-relativity-1' in h or '#notes-on-ly' in h:
            return None
        if isinstance(t, str):
            e = dict(e, text=t.replace('Lecture notes GitHub', 'Download PDF GitHub'))
    if h.startswith('research_and_publications.html'):
        e = {k: (v.replace(OJALA_ID, OJALA_ID_NEW).replace(OJALA_OLD, OJALA_NEW)
                 .replace('arXiv preprint, arXiv:2604.00661', 'Astronomy & Astrophysics, in press (accepted 12 November 2026)')
                 if isinstance(v, str) else v) for k, v in e.items()}
    return e


def git(*args, text=True):
    return subprocess.run(['git', '-C', str(REPO), *args], capture_output=True, text=text, check=True).stdout

NAV = re.compile(r'\s*</li>\s*<li class="nav-item">\s*<a class="nav-link[^"]*" href="[^"]*notes/diffgeo-gr/index\.html"[^>]*>\s*'
                 r'<span class="menu-text">Lecture Notes</span></a>')
# the button with the whitespace that separates it from its neighbour: the space before it, or, when it is the
# first thing in its row (as placed: first in .media-actions), the space after it
READ = re.compile(r'\s+<a\b[^>]*\bdg-read-online\b[^>]*>.*?</a>|<a\b[^>]*\bdg-read-online\b[^>]*>.*?</a>\s*', re.S)
HASH = re.compile(r'bootstrap-[0-9a-f]{32}\.min\.css')

def read_online(e):
    """Quarto's search index has the button's label as the first word of the row of buttons of the Teaching page."""
    if e.get('href', '').startswith('teaching_and_projects.html') and isinstance(e.get('text'), str):
        e = dict(e, text=e['text'].replace('\n\nRead online ', '\n\n'))
    return e

def norm_html(s):
    s = NAV.sub('', s)
    s = READ.sub('', s)
    s = HASH.sub('bootstrap-HASH.min.css', s)
    s = re.sub(r'[ \t]+\n', '\n', s)
    return re.sub(r'\n{3,}', '\n\n', s)          # blank lines left where a removed block stood

def main():
    failures = []
    ref_files = [f for f in git('ls-tree', '-r', '--name-only', REF, 'docs').splitlines() if not f.startswith('docs/notes/')]
    work_files = {str(p.relative_to(REPO)) for p in (REPO / 'docs').rglob('*') if p.is_file()}
    work_files = {f for f in work_files if not f.startswith('docs/notes/')}

    # 1. every file of REF is there; nothing new outside site_libs
    for f in ref_files:
        if f not in work_files and not HASH.search(f) and f not in ALLOWED_DELETED:
            failures.append(f'missing: {f}')
    for f in sorted(work_files - set(ref_files)):
        if not f.startswith('docs/site_libs/'):
            failures.append(f'new file outside the course section: {f}')

    # 2. contents
    bundles = {}
    for f in ref_files:
        if f not in work_files or f in ALLOWED_CHANGED:
            continue
        old = git('show', f'{REF}:{f}', text=False)
        new = (REPO / f).read_bytes()
        if f.endswith('.html'):
            o, n = nav_old(old.decode()), nav_new(new.decode(), f, failures)
            if f == 'docs/teaching_and_projects.html':
                o = teaching_old(o)
            if f == 'docs/research_and_publications.html':
                o = research_old(o)
            o, n = norm_html(o), norm_html(n)
            if o != n:
                ol, nl = o.splitlines(), n.splitlines()
                diff = [(a, b) for a, b in zip(ol, nl) if a != b][:2]
                failures.append(f'{f}: differs beyond the accepted differences ({len(ol)} vs {len(nl)} lines); first: {diff}')
            for side, text in (('old', old.decode()), ('new', new.decode())):
                for m in HASH.findall(text):
                    bundles.setdefault(f, {})[side] = m
        elif f == 'docs/search.json':
            keep = lambda es: sorted((read_online(e) for e in es if e is not None and not e.get('href', '').startswith('notes/')),
                                     key=lambda e: e.get('objectID', ''))   # the order of pages in the index is not stable
            ko, kn = keep(search_old(e) for e in json.loads(old)), keep(json.loads(new))
            if ko != kn:
                a = {e['objectID']: e for e in ko}
                b = {e['objectID']: e for e in kn}
                bad = sorted(k for k in a.keys() | b.keys() if a.get(k) != b.get(k))
                failures.append(f'docs/search.json: entries of existing pages changed: {bad[:4]}')
        elif f == 'docs/sitemap.xml':
            locs = lambda x: sorted(u for u in re.findall(r'<loc>(.*?)</loc>', x.decode()) if '/notes/' not in u)
            if locs(old) != locs(new):
                failures.append('docs/sitemap.xml: addresses of existing pages changed')
        elif old != new:
            failures.append(f'{f}: content changed')

    # 3. the Bootstrap bundles of the existing pages: only sidebar rules may differ
    rules = lambda css: set(css.replace('}', '}\n').split('\n'))
    for pair in {(b['old'], b['new']) for b in bundles.values() if 'old' in b and 'new' in b}:
        o, n = pair
        try:
            old = rules(git('show', f'{REF}:docs/site_libs/bootstrap/{o}'))
            new = rules((REPO / 'docs/site_libs/bootstrap' / n).read_text())
        except Exception as e:  # noqa: BLE001
            failures.append(f'bootstrap bundle {o} / {n}: {e}')
            continue
        bad = [r for r in old ^ new if 'sidebar' not in r.split('{')[0]]
        if bad:
            failures.append(f'bootstrap bundle {n}: {len(bad)} rule(s) differ from {REF} beyond sidebar rules, e.g. {bad[0][:160]}')

    if failures:
        print(f'site outside the course section differs from {REF}:')
        for x in failures:
            print('  FAIL', x)
        return 1
    print(f'site outside the course section is unchanged with respect to {REF} ({len(ref_files)} files compared)')
    return 0

if __name__ == '__main__':
    sys.exit(main())
