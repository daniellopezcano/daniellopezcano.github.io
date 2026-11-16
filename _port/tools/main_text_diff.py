#!/usr/bin/env python3
"""Hand-written tool: proves that a converter change added markup only (DECISIONS D44).

    python3 _port/tools/main_text_diff.py [--rev HEAD]

For every generated course page (notes/diffgeo-gr/**/*.html) compares the text content of <main> as it is
now with the same page at git revision --rev (default HEAD): (a) the notes' text, i.e. <main> without the
web layer (elements with class dg-web), must be identical character for character; (b) pages whose web
layer text changed are listed for information. Exit code 0 when (a) holds on every page.

    --nbsp   accept, in (a), a no-break space (U+00A0) where --rev has a space (U+0020) and nothing else: the
             texts must have the same length and differ only at such positions (proof for the fix of D9's `~`,
             unit B10); the number of such positions is reported.
"""
import argparse, os, subprocess, sys
from html.parser import HTMLParser

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
COURSE = os.path.join(REPO, 'notes', 'diffgeo-gr')
VOID = {'area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class MainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0                 # > 0 inside <main>
        self.web = []                  # stack: inside a dg-web element
        self.notes, self.all = [], []

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        if tag == 'main':
            self.depth += 1
        if self.depth:
            cls = (dict(attrs).get('class') or '').split()
            self.web.append((self.web[-1] if self.web else False) or 'dg-web' in cls)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if self.depth and self.web:
            self.web.pop()
        if tag == 'main':
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.all.append(data)
            if not (self.web and self.web[-1]):
                self.notes.append(data)


def texts(html):
    p = MainText()
    p.feed(html)
    p.close()
    return ''.join(p.notes), ''.join(p.all)


def only_nbsp(a: str, b: str):
    """Number of positions where a has U+0020 and b U+00A0, if that is the only difference; else None."""
    if len(a) != len(b):
        return None
    k = 0
    for x, y in zip(a, b):
        if x != y:
            if (x, y) != (' ', '\u00a0'):
                return None
            k += 1
    return k


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rev', default='HEAD')
    ap.add_argument('--nbsp', action='store_true', help='accept U+0020 -> U+00A0 and nothing else (D9 fix, B10)')
    args = ap.parse_args()
    rev = args.rev
    bad, web, n, nb, nbp = [], [], 0, 0, 0
    for root, _, names in os.walk(COURSE):
        for name in sorted(names):
            if not name.endswith('.html'):
                continue
            path = os.path.join(root, name)
            rel = os.path.relpath(path, REPO)
            try:
                old = subprocess.run(['git', '-C', REPO, 'show', f'{rev}:{rel}'], capture_output=True, check=True, text=True).stdout
            except subprocess.CalledProcessError:
                print(f'new page (not in {rev}): {rel}')
                continue
            n += 1
            a, b = texts(old), texts(open(path, encoding='utf-8').read())
            if a[0] != b[0] and args.nbsp and only_nbsp(a[0], b[0]) is not None:
                nb += only_nbsp(a[0], b[0])
                nbp += 1
                if only_nbsp(a[1], b[1]) is None:
                    web.append(rel)
            elif a[0] != b[0]:
                k = next((i for i, (x, y) in enumerate(zip(a[0], b[0])) if x != y), min(len(a[0]), len(b[0])))
                bad.append(f'{rel}: notes\' text differs at {k}: {a[0][max(0, k - 40):k + 40]!r} -> {b[0][max(0, k - 40):k + 40]!r}')
            elif a[1] != b[1] and not (args.nbsp and only_nbsp(a[1], b[1]) is not None):
                web.append(rel)
    for line in bad:
        print('FAIL', line)
    if web:
        print(f'web layer text changed on {len(web)} page(s): ' + ', '.join(os.path.relpath(w, 'notes/diffgeo-gr') for w in web))
    if args.nbsp:
        print(f'--nbsp: {nb} space(s) became no-break spaces on {nbp} page(s); no other change of the notes\' text there')
    print(f'{n - len(bad)} of {n} pages: text of <main> without the web layer identical to {rev}')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
