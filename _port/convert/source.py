"""Load the LaTeX source of the notes: strip comments, expand \\input, keep provenance.

Hand-written, part of the web port. Reads the notes directory, never writes to it.

`load(notes_dir)` returns a `Source` whose `.text` is the body of main.tex
(between \\begin{document} and \\end{document}) with every *uncommented* \\input
expanded in place and all comments removed the way TeX removes them (a `%`
eats the rest of the line, the newline, and the indentation of the next line).
`Source.where(offset)` maps any offset of `.text` back to "file:line".
Files that main.tex does not include are never read, which is how "publish
exactly what main.tex includes" is enforced.
`load(notes_dir, omit)` also leaves out the passages a course names in `courses.py` `omit` (Lyα DECISIONS L32:
a passage that names a co-author): each is a run of whole lines of one file, from the line whose text is `from`
to the first line after it whose text is `to` (both compared without surrounding white space). Each must be
found exactly once and may hold no \\label or \\input, or the load stops; the lines produce no text, and
`Source.omitted` holds their (file basename, line) pairs so that the numbering records from them are dropped.
"""
from __future__ import annotations
import bisect
import os
import re

INPUT_RE = re.compile(r'\\input\{([^}]+)\}')


def _comment_start(line: str) -> int:
    """Index of the first unescaped % in line, or -1."""
    i = line.find('%')
    while i != -1:
        j = i - 1
        n = 0
        while j >= 0 and line[j] == '\\':
            n += 1
            j -= 1
        if n % 2 == 0:
            return i
        i = line.find('%', i + 1)
    return -1


class Source:
    def __init__(self, notes_dir: str):
        self.notes_dir = notes_dir
        self.parts: list[str] = []
        self.length = 0
        self.mark_off: list[int] = []      # offsets, increasing
        self.mark_loc: list[tuple[str, int]] = []   # (file relative to notes dir, line)
        self.files: list[str] = []         # included files, in order (main.tex first)
        self.preamble = ''
        self.text = ''
        # (start, end, file) offset span that each top-level \input of main.tex expands to
        self.main_inputs: list[tuple[int, int, str]] = []
        self.omit: list[dict] = []
        self.omitted: set[tuple[str, int]] = set()      # (file basename, line) of the lines left out (L32)
        self.omit_found: list[tuple[str, int, int]] = []  # (file, first line, last line) of each passage

    # -- building ---------------------------------------------------------
    def _emit(self, s: str, file: str, line: int):
        if not s:
            return
        self.mark_off.append(self.length)
        self.mark_loc.append((file, line))
        self.parts.append(s)
        self.length += len(s)

    def _omitted_lines(self, rel: str, lines: list[str], first_line: int) -> set[int]:
        out = set()
        for o in self.omit:
            if os.path.basename(o['file']) != os.path.basename(rel):
                continue
            starts = [k for k, l in enumerate(lines) if l.strip() == o['from']]
            if len(starts) != 1:
                raise SystemExit(f'source: omitted passage {o["from"]!r} found {len(starts)} times in {rel} '
                                 f'(courses.py omit; Lyα DECISIONS L32)')
            a = starts[0]
            b = next((k for k in range(a + 1, len(lines)) if lines[k].strip() == o['to']), None)
            if b is None:
                raise SystemExit(f'source: omitted passage {o["from"]!r} in {rel}: no line {o["to"]!r} after it')
            body = '\n'.join(lines[a:b + 1])
            if re.search(r'\\(label|input)\b', body):
                raise SystemExit(f'source: omitted passage {o["from"]!r} in {rel} holds a \\label or \\input')
            out.update(range(first_line + a, first_line + b + 1))
            self.omit_found.append((rel, first_line + a, first_line + b))
        return out

    def _expand(self, rel: str, lines: list[str], first_line: int, top: bool):
        self.files.append(rel) if rel not in self.files else None
        skip = self._omitted_lines(rel, lines, first_line) if self.omit else set()
        self.omitted.update((os.path.basename(rel), n) for n in skip)
        eat_indent = False
        for k, raw in enumerate(lines):
            lineno = first_line + k
            if lineno in skip:
                continue
            line = raw
            if eat_indent:
                line = line.lstrip(' \t')
                eat_indent = False
            c = _comment_start(line)
            if c != -1:
                line = line[:c]
                eat_indent = True          # TeX: % also swallows the newline + next indentation
            else:
                line = line + '\n'
            pos = 0
            for m in INPUT_RE.finditer(line):
                self._emit(line[pos:m.start()], rel, lineno)
                sub = m.group(1).strip()
                if not sub.endswith('.tex'):
                    sub += '.tex'
                start = self.length
                with open(os.path.join(self.notes_dir, sub), encoding='utf-8') as f:
                    self._expand(sub, f.read().split('\n'), 1, False)
                if top:
                    self.main_inputs.append((start, self.length, sub))
                pos = m.end()
            self._emit(line[pos:], rel, lineno)

    # -- queries ----------------------------------------------------------
    def loc(self, off: int) -> tuple[str, int]:
        i = bisect.bisect_right(self.mark_off, off) - 1
        return self.mark_loc[max(i, 0)]

    def where(self, off: int) -> str:
        f, l = self.loc(off)
        return f'{f}:{l}'

    def offset_of(self, file_basename: str, line: int) -> int | None:
        """Offset of the first text coming from <file>:<line> (file given by basename;
        '' means main.tex). Falls back to the nearest following line that produced text."""
        best = None
        for off, (f, l) in zip(self.mark_off, self.mark_loc):
            if os.path.basename(f) == (file_basename or 'main.tex') and l >= line:
                if best is None or l < best[0]:
                    best = (l, off)
        return None if best is None else best[1]


def load(notes_dir: str, omit=()) -> Source:
    src = Source(notes_dir)
    src.omit = list(omit)
    with open(os.path.join(notes_dir, 'main.tex'), encoding='utf-8') as f:
        lines = f.read().split('\n')
    # the scratch copy carries \input{port-hooks} on the \begin{document} line (numbering hooks)
    b = next(i for i, l in enumerate(lines) if _comment_start(l) != 0 and r'\begin{document}' in l)
    e = next(i for i, l in enumerate(lines) if l.lstrip().startswith(r'\end{document}'))
    src.preamble = '\n'.join(lines[:b])
    src.files.append('main.tex')
    src._expand('main.tex', lines[b + 1:e], b + 2, True)
    src.text = ''.join(src.parts)
    if len(src.omit_found) != len(src.omit):
        raise SystemExit(f'source: {len(src.omit)} omitted passages named, {len(src.omit_found)} found '
                         f'(courses.py omit: is the file included?)')
    names = [os.path.basename(f) for f in src.files]
    dup = {n for n in names if names.count(n) > 1}
    if dup:
        raise SystemExit(f'included files share a basename (numbering records are keyed by it): {dup}')
    return src
