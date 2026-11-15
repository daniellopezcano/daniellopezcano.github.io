#!/usr/bin/env python3
"""Hand-written tool: the rendered site outside the course section must be what a git ref has.

    python3 _port/tools/site_unchanged.py [REF]        (REF defaults to `main`; exit code 0 = unchanged)

Compares docs/ in the working tree with docs/ of REF, ignoring docs/notes/ (the course section).
Accepted differences, and nothing else (KICKOFF rule 6):
  * the navbar entry "Lecture Notes" (one <li class="nav-item"> pointing into notes/diffgeo-gr/);
  * links with class `dg-read-online` (the "Read online" buttons on the Teaching page);
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

def git(*args, text=True):
    return subprocess.run(['git', '-C', str(REPO), *args], capture_output=True, text=text, check=True).stdout

NAV = re.compile(r'\s*</li>\s*<li class="nav-item">\s*<a class="nav-link[^"]*" href="[^"]*notes/diffgeo-gr/index\.html"[^>]*>\s*'
                 r'<span class="menu-text">Lecture Notes</span></a>')
READ = re.compile(r'\s*<a\b[^>]*\bdg-read-online\b[^>]*>.*?</a>', re.S)
HASH = re.compile(r'bootstrap-[0-9a-f]{32}\.min\.css')

def norm_html(s):
    s = NAV.sub('', s)
    s = READ.sub('', s)
    s = HASH.sub('bootstrap-HASH.min.css', s)
    return re.sub(r'[ \t]+\n', '\n', s)

def main():
    failures = []
    ref_files = [f for f in git('ls-tree', '-r', '--name-only', REF, 'docs').splitlines() if not f.startswith('docs/notes/')]
    work_files = {str(p.relative_to(REPO)) for p in (REPO / 'docs').rglob('*') if p.is_file()}
    work_files = {f for f in work_files if not f.startswith('docs/notes/')}

    # 1. every file of REF is there; nothing new outside site_libs
    for f in ref_files:
        if f not in work_files and not HASH.search(f):
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
            o, n = norm_html(old.decode()), norm_html(new.decode())
            if o != n:
                ol, nl = o.splitlines(), n.splitlines()
                diff = [(a, b) for a, b in zip(ol, nl) if a != b][:2]
                failures.append(f'{f}: differs beyond the accepted differences ({len(ol)} vs {len(nl)} lines); first: {diff}')
            for side, text in (('old', old.decode()), ('new', new.decode())):
                for m in HASH.findall(text):
                    bundles.setdefault(f, {})[side] = m
        elif f == 'docs/search.json':
            keep = lambda js: sorted((e for e in json.loads(js) if not e.get('href', '').startswith('notes/')),
                                     key=lambda e: e.get('objectID', ''))   # the order of pages in the index is not stable
            if keep(old) != keep(new):
                failures.append('docs/search.json: entries of existing pages changed')
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
