#!/usr/bin/env python3
"""Hand-written tool: proves that a converter change added markup only (DECISIONS D44).

    python3 _port/tools/main_text_diff.py [--rev HEAD] [--course NAME]

(--course: one course of _port/convert/courses.py, default diffgeo-gr.) For every generated page of the course
(notes/<course>/**/*.html) compares the text content of <main> as it is
now with the same page at git revision --rev (default HEAD): (a) the notes' text, i.e. <main> without the
web layer (elements with class dg-web), must be identical character for character; (b) pages whose web
layer text changed are listed for information. Exit code 0 when (a) holds on every page.

    --nbsp   accept, in (a), a no-break space (U+00A0) where --rev has a space (U+0020) and nothing else: the
             texts must have the same length and differ only at such positions (proof for the fix of D9's `~`,
             unit B10); the number of such positions is reported.
    --mathref  accept, in (a), a reference number inside a formula that became a MathJax link, `X` ->
             `\\href{<url>}{X}`, and nothing else: with every `\\href{..}{X}` replaced by its X the texts are
             identical, and every \\href of --rev is still there (proof for the links of D7 rewrite 2, units
             B12-B17); the number of new links is reported.
    --dlc    accept, in (a), whitespace removed right before punctuation (.,;:!?) or a line break, and nothing
             else: --rev's text with those spaces deleted equals the new text (proof for the space before a
             dropped \\DLC note, D18, units B18-B22); the number of such places is reported.
"""
import argparse, os, re, subprocess, sys
from collections import Counter
from html.parser import HTMLParser

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(REPO, '_port', 'convert'))
import courses  # noqa: E402
COURSE = None                  # set in main(): REPO/notes/<course>
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


HREF = re.compile(r'\\href\{([^{}]*)\}\{([^{}]*)\}')


def only_mathref(a: str, b: str):
    """Number of \\href{..}{X} links that b adds around a text X of a, if that is the only difference; else None."""
    if HREF.sub(r'\2', a) != HREF.sub(r'\2', b):
        return None
    old, new = Counter(m.group(0) for m in HREF.finditer(a)), Counter(m.group(0) for m in HREF.finditer(b))
    if old - new:
        return None
    return sum((new - old).values())


PUNCT_AFTER = '.,;:!?)\n'


def only_unskip(a: str, b: str):
    """Number of whitespace runs of a (not in b) each followed by punctuation or a line break, if deleting them
    from a gives b exactly; else None."""
    i = j = k = 0
    while i < len(a):
        if j < len(b) and a[i] == b[j]:
            i += 1
            j += 1
            continue
        e = i
        while e < len(a) and a[e] in ' \t':
            e += 1
        if e == i or e >= len(a) or a[e] not in PUNCT_AFTER or j >= len(b) or b[j] != a[e]:
            return None
        k += 1
        i = e
    return k if j == len(b) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rev', default='HEAD')
    ap.add_argument('--nbsp', action='store_true', help='accept U+0020 -> U+00A0 and nothing else (D9 fix, B10)')
    ap.add_argument('--mathref', action='store_true', help='accept X -> \\href{url}{X} inside formulas and nothing else (B12-B17)')
    ap.add_argument('--dlc', action='store_true', help='accept a space removed before punctuation or a line break and nothing else (B18-B22)')
    ap.add_argument('--course', default='diffgeo-gr', help='a course of _port/convert/courses.py')
    args = ap.parse_args()
    global COURSE
    COURSE = os.path.join(REPO, courses.get(args.course)['dir'])
    rev = args.rev
    bad, web, n, nb, nbp, mr, mrp, dl, dlp = [], [], 0, 0, 0, 0, 0, 0, 0
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
            if a[0] != b[0] and args.mathref and only_mathref(a[0], b[0]) is not None:
                mr += only_mathref(a[0], b[0])
                mrp += 1
                if only_mathref(a[1], b[1]) is None:
                    web.append(rel)
            elif a[0] != b[0] and args.dlc and only_unskip(a[0], b[0]) is not None:
                dl += only_unskip(a[0], b[0])
                dlp += 1
                if only_unskip(a[1], b[1]) is None:
                    web.append(rel)
            elif a[0] != b[0] and args.nbsp and only_nbsp(a[0], b[0]) is not None:
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
        print(f'web layer text changed on {len(web)} page(s): ' + ', '.join(os.path.relpath(w, os.path.relpath(COURSE, REPO)) for w in web))
    if args.mathref:
        print(f'--mathref: {mr} reference number(s) inside formulas became links on {mrp} page(s); no other change of the notes\' text there')
    if args.dlc:
        print(f'--dlc: {dl} space(s) before punctuation or a line break removed on {dlp} page(s); no other change of the notes\' text there')
    if args.nbsp:
        print(f'--nbsp: {nb} space(s) became no-break spaces on {nbp} page(s); no other change of the notes\' text there')
    print(f'{n - len(bad)} of {n} pages: text of <main> without the web layer identical to {rev}')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
