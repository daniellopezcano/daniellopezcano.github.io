#!/usr/bin/env bash
# One command after editing the LaTeX notes: recompile the scratch copy, regenerate the course pages
# and publish them into docs/ (every course of _port/convert/courses.py). Hand-written, part of the web port.
#   _port/build.sh            scratch LaTeX build + converter + copy of the courses into docs/ (seconds)
#   _port/build.sh --site     ... and a full `quarto render` of the whole site instead of the copy
#   _port/build.sh --no-tex   skip the LaTeX build (the notes did not change)
# The course pages are complete HTML files (DECISIONS D29): Quarto only copies them (project resources),
# and its post-render script _port/tools/post_render.py adds them to docs/search.json and docs/sitemap.xml.
# A course-only build does the same two steps itself, without Quarto.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
SITE=0; TEX=1
for a in "$@"; do case "$a" in --site) SITE=1 ;; --no-tex) TEX=0 ;; *) echo "usage: $0 [--site] [--no-tex]"; exit 2 ;; esac; done
[ "$TEX" = 1 ] && _port/tex/build_scratch.sh
python3 _port/convert/build.py
node _port/tools/math_check.mjs | tail -n 3 || echo "math check reported failures (see above)"
if [ "$SITE" = 1 ]; then
  quarto render
else
  for d in $(python3 -c "import sys; sys.path.insert(0, '_port/convert'); import courses; print(' '.join(c['dir'] for c in courses.COURSES.values()))"); do
    mkdir -p "docs/$d"
    rsync -a --delete "$d/" "docs/$d/"
  done
  python3 _port/tools/post_render.py
fi
echo "done. Preview: quarto preview   (then open /notes/diffgeo-gr/ or /notes/lya-forest/)"
