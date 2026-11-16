#!/usr/bin/env python3
"""Hand-written tool (DECISIONS D29, D37): the published course is exactly the committed course, and the
converter is idempotent.

    python3 _port/tools/render_intact.py [--course NAME] [--page <slug>]... [--no-rerun]     (exit code 0 = intact)
    (without --course: every course of _port/convert/courses.py, one after the other; --page alone: the first
    course)

1. docs/notes/<course>/ is file-for-file and byte-for-byte identical to notes/<course>/ (what a
   `quarto render` copies through the `resources` glob, after the course build): no file missing, extra
   or different on either side. With --page, only those pages are compared (a slug, 'index' for the
   landing page, or a prefix ending in '/').
2. Unless --no-rerun: running the converter once more for that course (`_port/convert/build.py --course NAME`,
   which writes notes/<course>/ in place) leaves every file of notes/<course>/ byte-identical (SHA-256 of every
   file before and after; the converter only rewrites a file whose content changed).
Run it after the converter and the render (check.sh does). Output: one line per differing file.
"""
import hashlib, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / '_port' / 'convert'))
import courses  # noqa: E402
IGNORE = {'__pycache__', '.DS_Store'}          # nothing the converter writes; never published either


def tree(root: Path) -> dict:
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob('*')) if p.is_file() and not (set(p.relative_to(root).parts) & IGNORE)}


def main(argv) -> int:
    argv = list(argv)
    if '--course' in argv:
        k = argv.index('--course')
        name = argv[k + 1]
        del argv[k:k + 2]
    elif '--page' in argv:
        name = 'diffgeo-gr'
    else:                                   # every course, one after the other
        rc = 0
        for name in courses.COURSES:
            print(f'== {name}', flush=True)
            rc = main(['--course', name] + argv) or rc
        return rc
    COURSE = courses.get(name)['dir']
    SRC, PUB = REPO / COURSE, REPO / 'docs' / COURSE
    want = [argv[i + 1].removesuffix('.html') for i, a in enumerate(argv) if a == '--page' and i + 1 < len(argv)]
    keep = (lambda k: any(k == w + '.html' or (w.endswith('/') and k.startswith(w)) for w in want)) if want else (lambda k: True)
    bad = 0
    if not PUB.exists():
        print(f'missing: docs/{COURSE} (render or build first)')
        return 1
    a, b = tree(SRC), tree(PUB)
    a, b = {k: v for k, v in a.items() if keep(k)}, {k: v for k, v in b.items() if keep(k)}
    if want and not a:
        print(f'no file of {COURSE} matches {", ".join(want)}')
        return 2
    for k in sorted(set(a) | set(b)):
        if k not in b:
            print(f'not published: {COURSE}/{k}'); bad += 1
        elif k not in a:
            print(f'only in docs/: {COURSE}/{k}'); bad += 1
        elif a[k] != b[k]:
            print(f'differs: docs/{COURSE}/{k}'); bad += 1
    print(f'docs/{COURSE} vs {COURSE}: {len(a)} files compared, {bad} differences')
    if '--no-rerun' not in argv:
        before = tree(SRC)
        r = subprocess.run([sys.executable, str(REPO / '_port' / 'convert' / 'build.py'), '--course', name], cwd=REPO,
                           capture_output=True, text=True)
        if r.returncode != 0:
            print('converter failed on the second run:', (r.stdout + r.stderr).strip().splitlines()[-1:])
            return 1
        after = tree(SRC)
        n = 0
        for k in sorted(set(before) | set(after)):
            if keep(k) and before.get(k) != after.get(k):
                print(f'converter not idempotent: {COURSE}/{k} ' + ('appeared' if k not in before else 'vanished' if k not in after else 'changed'))
                n += 1
        print(f'second converter run: {n} files changed')
        bad += n
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
