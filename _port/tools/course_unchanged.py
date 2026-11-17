#!/usr/bin/env python3
"""The first course's generated files are byte-identical to <base> (default: main), except for the site
navbar of every page (Lyα brief: "The first course must not change"; Lyα DECISIONS L9). Hand-written, part
of the web port.

    python3 _port/tools/course_unchanged.py [<base>] [--course diffgeo-gr]

Compares the working tree's notes/<course>/ (as the converter last wrote it; check.sh runs the converter
first) with the same directory at <base>:
  - every generated file (the pages, assets/search.json, assets/labels.json, assets/fonts/, figures/) must
    exist in both and be identical; in the pages the <header class="dg-sitenav">…</header> element is
    compared after replacing it by a placeholder (the navbar is the one authorised change);
  - assets/lastmod.json must have the same keys (its values are the times the pages' bytes changed, which
    the navbar change moves);
  - the hand-written files (assets/*.css|js, assets/interactive/) are listed when they differ (INFO), since
    the navbar's behaviour lives there; the generated pages decide pass or fail.
Exit 1 on any difference outside the navbar.
"""
from __future__ import annotations
import json
import os
import re
import subprocess
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
NAV = re.compile(r'<header class="dg-sitenav".*?</header>', re.S)
HAND = re.compile(r'^assets/(?:[^/]+\.(?:css|js)|interactive/.*)$')


def at_base(base: str, path: str) -> bytes | None:
    r = subprocess.run(['git', '-C', REPO, 'show', f'{base}:{path}'], capture_output=True)
    return r.stdout if r.returncode == 0 else None


def main(argv: list[str]) -> int:
    course, base, args = 'diffgeo-gr', 'main', list(argv[1:])
    if '--course' in args:
        k = args.index('--course')
        course = args[k + 1]
        del args[k:k + 2]
    if args:
        base = args[0]
    d = f'notes/{course}'
    listed = subprocess.run(['git', '-C', REPO, 'ls-tree', '-r', '--name-only', base, d], capture_output=True, text=True)
    if listed.returncode != 0:
        print(listed.stderr)
        return 2
    old = {p[len(d) + 1:] for p in listed.stdout.split('\n') if p}
    new = set()
    for root, _, names in os.walk(os.path.join(REPO, d)):
        for n in names:
            new.add(os.path.relpath(os.path.join(root, n), os.path.join(REPO, d)).replace(os.sep, '/'))
    bad, info, nav = [], [], 0
    for f in sorted(old | new):
        if f not in new:
            bad.append(f'missing now: {f}')
            continue
        if f not in old:
            (info if HAND.match(f) else bad).append(f'new: {f}')
            continue
        a, b = at_base(base, f'{d}/{f}'), open(os.path.join(REPO, d, f), 'rb').read()
        if a == b:
            continue
        if HAND.match(f):
            info.append(f'hand-written file changed: {f}')
        elif f == 'assets/lastmod.json':
            if set(json.loads(a)) != set(json.loads(b)):
                bad.append('assets/lastmod.json: another set of pages')
        elif f.endswith('.html'):
            ta, tb = a.decode('utf-8'), b.decode('utf-8')
            if NAV.sub('<NAV>', ta) == NAV.sub('<NAV>', tb):
                nav += 1
            else:
                la, lb = NAV.sub('<NAV>', ta).split('\n'), NAV.sub('<NAV>', tb).split('\n')
                k = next((i for i, (x, y) in enumerate(zip(la, lb)) if x != y), min(len(la), len(lb)))
                bad.append(f'{f}: differs outside the navbar at line {k + 1}: {lb[k][:160] if k < len(lb) else "(end)"}')
        else:
            bad.append(f'{f}: differs')
    for x in info:
        print('INFO', x)
    print(f'{course} vs {base}: {len(old & new)} files compared; {nav} pages differ only in the site navbar')
    for x in bad:
        print('FAIL', x)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
