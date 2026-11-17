"""Texts of the title page and of the quote/dedication page, for the course landing page.

Hand-written, part of the web port. The cover and the dedication are full-page TikZ
drawings in main.tex; the landing page is a hand-written web layout, but every word on
it must be the notes' own. This module pulls those words out of the TikZ nodes, so the
landing page changes when main.tex changes. Each pattern is anchored on the LaTeX
around the text; if main.tex is restructured the build stops with a clear message
instead of publishing a stale or empty cover.
"""
from __future__ import annotations
import datetime, os, re, subprocess

PATTERNS = {
    # title page
    'title':       r'\\spaceskip=0\.4em\s+(.*?)\\par\}',
    'subtitle':    r'\\Large\\itshape\s+(.*?)\}\\\\\[1\.1cm\]',
    'author':      r'\\LARGE\\bfseries\s+(.*?)\}\\\\\[0\.35cm\]',
    'affiliation': r'\\color\{black!75\}\\large\s+(.*?)\}\\\\\[0\.1cm\]',
    'address':     r'\\color\{black!75\}\\large\s+(R\..*?)\}\\\\\[0\.25cm\]',
    'email':       r'\\href\{mailto:([^}]+)\}',
    # quote and dedication page
    'quote':        r'inner sep=0pt\]\s*at \(Q\)\s*\{(.*?)\};',
    'quote_author': r'at \(\[yshift=-0\.72cm\]Q\)\s*\{(.*?)\};',
    'quote_source': r'at \(\[yshift=-1\.18cm\]Q\)\s*\{(.*?)\};',
    'dedication':   r'\\linespread\{1\.25\}\\selectfont\s+(.*?)\\par\};',
}


def extract(front_tex: str) -> dict[str, str]:
    """name -> LaTeX source of that piece of text (to be rendered by the normal renderer)."""
    out = {}
    for name, pat in PATTERNS.items():
        m = re.search(pat, front_tex, re.S)
        if not m:
            raise SystemExit(f'cover.py: cannot find the "{name}" text of the title/dedication page in main.tex; '
                             f'the page layout changed, update the pattern in _port/convert/cover.py')
        out[name] = m.group(1).strip()
    return out


# ---------------------------------------------------------------------------------------
# "Last updated" (REDESIGN answer 3, DECISIONS D54)
# ---------------------------------------------------------------------------------------
# The cover of the PDF prints \today, the day of the build. The landing page shows instead the
# committer date of the most recent commit of the notes repository that touched a file main.tex
# includes. "Included" is what the LaTeX build actually read: the recorder file main.fls of the
# scratch build (INPUT lines inside the source tree: the .tex files and the files under plots/),
# plus the .bib files named by \bibdata in main.aux (BibTeX reads them, not LaTeX). Build products
# (.aux, .bbl, .toc, .lof, .out) and files git does not track there (port-hooks.tex, ours) are ignored.
MONTHS = ('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
          'September', 'October', 'November', 'December')


def included_files(src_dir: str) -> list[str]:
    """Paths (relative to the notes directory) of the source files the scratch build read."""
    fls = os.path.join(src_dir, 'main.fls')
    if not os.path.exists(fls):
        raise SystemExit(f'cover.py: {fls} not found; run _port/tex/build_scratch.sh first')
    root = os.path.realpath(src_dir)
    out = set()
    for line in open(fls, encoding='utf-8', errors='replace'):
        if not line.startswith('INPUT '):
            continue
        p = line[6:].rstrip('\n')
        full = os.path.realpath(p if os.path.isabs(p) else os.path.join(root, p))
        if os.path.commonpath([full, root]) != root:
            continue                                       # TeX Live, fonts, configuration
        rel = os.path.relpath(full, root).replace(os.sep, '/')
        if rel.endswith('.tex') or rel.startswith('plots/'):
            out.add(rel)
    aux = open(os.path.join(src_dir, 'main.aux'), encoding='utf-8', errors='replace').read()
    for m in re.finditer(r'\\bibdata\{([^}]*)\}', aux):
        out.update(b.strip() + '.bib' for b in m.group(1).split(',') if b.strip())
    if 'main.tex' not in out:
        raise SystemExit(f'cover.py: {fls} does not record main.tex; is it the recorder file of the scratch build?')
    return sorted(out)


def last_updated(src_dir: str, notes_dir: str, files: list | None = None) -> tuple[str, str]:
    """(ISO date, the date as LaTeX's \\today prints it in English) of the last commit of the notes
    repository that touched a file of included_files() (or of `files`, paths relative to the notes directory:
    a course that publishes only part of its notes passes the files of that part, Lyα DECISIONS L6).
    Stops if git or the repository is unavailable."""
    def git(*args):
        try:
            p = subprocess.run(['git', '-C', notes_dir, *args], capture_output=True, text=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired) as e:
            raise SystemExit(f'cover.py: cannot run git for the "Last updated" date of the landing page: {e}')
        if p.returncode:
            raise SystemExit(f'cover.py: git {" ".join(args[:2])} failed in {notes_dir} '
                             f'(set NOTES to the notes directory): {p.stderr.strip()}')
        return p.stdout
    if not os.path.isdir(notes_dir):
        raise SystemExit(f'cover.py: notes directory {notes_dir} not found (set NOTES); '
                         f'it is needed for the "Last updated" date of the landing page')
    files = list(files) if files is not None else included_files(src_dir)
    tracked = git('ls-files', '-z', '--', *files).split('\0')
    tracked = [f for f in tracked if f]
    if not tracked:
        raise SystemExit(f'cover.py: none of the {len(files)} files main.tex includes is tracked by git in {notes_dir}')
    iso = git('log', '-1', '--format=%cs', '--', *tracked).strip()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', iso):
        raise SystemExit(f'cover.py: unexpected date "{iso}" from git log in {notes_dir}')
    d = datetime.date.fromisoformat(iso)
    return iso, f'{MONTHS[d.month - 1]} {d.day}, {d.year}'
