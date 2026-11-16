#!/usr/bin/env bash
# Copy the notes to a git-ignored scratch dir and compile them there with the
# numbering hooks. Never writes to the notes directory.
# The build happens in <work>/stage and is copied to <work>/src only when it
# succeeds; the converter and the figure pipeline read <work>/src.
#   _port/tex/build_scratch.sh              every course (courses.py), one after the other
#   _port/tex/build_scratch.sh <course>     one course (diffgeo-gr, lya-forest)
# The notes directory, the scratch directory, the TeX engine and the files copied are the course's entry of
# _port/convert/courses.py (NOTES / NOTES_LYA override the notes directory).
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ "$#" = 0 ]; then
  for c in $(python3 "$REPO/_port/convert/courses.py"); do "$0" "$c"; done
  exit 0
fi
eval "$(python3 "$REPO/_port/convert/courses.py" --shell "$1")"
NOTES="$C_NOTES"
W="$REPO/$C_WORK"
mkdir -p "$W"
# source only: no build products, no PDF
INC=(--include='*/')
for p in "${C_COPY[@]}"; do INC+=(--include="$p"); done
rsync -a --delete "${INC[@]}" --exclude='*' "$NOTES"/ "$W/stage/"
cp "$REPO/_port/tex/port-hooks.tex" "$W/stage/port-hooks.tex"
# inject the hooks into the scratch copy of main.tex only; restore the \input lines the course names (Lyα L28)
python3 - "$W/stage/main.tex" ${C_RESTORE[@]+"${C_RESTORE[@]}"} <<'PY'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
m=re.search(r'^\\begin\{document\}',s,flags=re.M)
assert m, 'no \\begin{document}'
s=s[:m.start()]+'\\input{port-hooks}'+s[m.start():]   # same line: line numbers must not shift
# Lyα DECISIONS L28: a commented-out `% \input{<name>}` line (and a commented `% \newpage` right before it) is
# uncommented in place, on the same line; already active: nothing to do; neither: stop
for name in sys.argv[2:]:
    pat = r'^[ \t]*%[ \t]*((?:\\newpage[ \t]*\n[ \t]*%[ \t]*)?)\\input\{' + re.escape(name) + r'\}[ \t]*$'
    hit = re.search(pat, s, flags=re.M)
    if hit:
        block = hit.group(0)
        restored = re.sub(r'^([ \t]*)%[ \t]*', r'\1', block, flags=re.M)
        s = s[:hit.start()] + restored + s[hit.end():]
        print('restored in the scratch copy of main.tex: ' + ' / '.join(x.strip() for x in restored.splitlines()))
    elif not re.search(r'^[ \t]*\\input\{' + re.escape(name) + r'\}', s, flags=re.M):
        sys.exit(f'build_scratch: no \\input{{{name}}} in main.tex, commented or not (courses.py restore_inputs)')
open(p,'w',encoding='utf-8').write(s)
PY
cd "$W/stage"
latexmk "-$C_ENGINE" -interaction=nonstopmode -halt-on-error -silent main.tex >"$W/build.log" 2>&1 || { tail -40 "$W/build.log"; exit 1; }
# publish the finished build in one go: readers of $W/src never see a half-written .aux/.port
rsync -a --delete "$W/stage/" "$W/src/"
echo "$1 built: $W/src/main.pdf ($(pdfinfo main.pdf | awk '/^Pages/{print $2}') pages), $(wc -l < main.port) numbering records"
# Lyα DECISIONS L8: when the notes directory holds the author's own build and it is newer than every source
# file, its labels (numbers and pages) must be the scratch build's.
if [ -f "$NOTES/main.aux" ]; then
  newest=$(find "$NOTES" -name '*.tex' -newer "$NOTES/main.aux" | head -1)
  if [ -z "$newest" ]; then
    if [ "${#C_RESTORE[@]}" = 0 ]; then
      if diff <(grep '^\\newlabel' "$NOTES/main.aux" | sort) <(grep '^\\newlabel' "$W/src/main.aux" | sort) >/dev/null; then
        echo "$1: labels identical to the author's main.aux"
      else
        echo "$1: WARNING the labels differ from the author's main.aux (newer than every .tex)"; exit 1
      fi
    else
      # L28: the scratch build has the restored input's labels too, and the pages after it move; every label of
      # the author's build must be in the scratch build with the same number
      python3 - "$NOTES/main.aux" "$W/src/main.aux" "$1" <<'PY' || exit 1
import re, sys
def labels(p):
    t = open(p, encoding='latin-1').read()
    return {m.group(1): m.group(2) for m in re.finditer(r'^\\newlabel\{([^}]*)\}\{\{([^}]*)\}', t, flags=re.M)}
a, w = labels(sys.argv[1]), labels(sys.argv[2])
bad = sorted(k for k in a if w.get(k) != a[k])
if bad:
    sys.exit(f'{sys.argv[3]}: WARNING {len(bad)} labels of the author\'s main.aux are missing or numbered '
             f'differently in the scratch build: {", ".join(bad[:10])}')
print(f'{sys.argv[3]}: the {len(a)} labels of the author\'s main.aux have the same numbers in the scratch build '
      f'(which has {len(w) - len(a)} more, from the restored input)')
PY
    fi
  fi
fi
