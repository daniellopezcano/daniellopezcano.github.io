#!/usr/bin/env bash
# Copy the notes to a git-ignored scratch dir and compile them there with the
# numbering hooks. Never writes to the notes directory.
# The build happens in .work/tex/stage and is copied to .work/tex/src only when it
# succeeds; the converter and the figure pipeline read .work/tex/src.
#   _port/tex/build_scratch.sh            (uses $NOTES or the default path)
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NOTES="${NOTES:-/home/dlopez/Documentos/0.profesional/Postdoc/USP/Projects/learning_cosmology/lecture_notes_differential_geometry_GR/from_diff_geom_to_GR}"
W="$REPO/_port/.work/tex"
mkdir -p "$W"
# source only: no build products, no PDF
rsync -a --delete \
  --include='*/' --include='*.tex' --include='*.bib' --include='*.ttf' --include='*.otf' \
  --include='plots/**' --exclude='*' \
  "$NOTES"/ "$W/stage/"
cp "$REPO/_port/tex/port-hooks.tex" "$W/stage/port-hooks.tex"
# inject the hooks into the scratch copy of main.tex only
python3 - "$W/stage/main.tex" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
m=re.search(r'^\\begin\{document\}',s,flags=re.M)
assert m, 'no \\begin{document}'
s=s[:m.start()]+'\\input{port-hooks}'+s[m.start():]   # same line: line numbers must not shift
open(p,'w',encoding='utf-8').write(s)
PY
cd "$W/stage"
latexmk -xelatex -interaction=nonstopmode -halt-on-error -silent main.tex >"$W/build.log" 2>&1 || { tail -40 "$W/build.log"; exit 1; }
# publish the finished build in one go: readers of $W/src never see a half-written .aux/.port
rsync -a --delete "$W/stage/" "$W/src/"
echo "built: $W/src/main.pdf ($(pdfinfo main.pdf | awk '/^Pages/{print $2}') pages), $(wc -l < main.port) numbering records"
