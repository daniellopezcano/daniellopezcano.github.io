#!/usr/bin/env bash
# One command after editing the LaTeX notes: recompile the scratch copy, regenerate the
# course pages and render them. Hand-written, part of the web port.
#   _port/build.sh            scratch LaTeX build + converter + quarto render of the course
#   _port/build.sh --site     ... and render the whole site instead of only the course
#   _port/build.sh --no-tex   skip the LaTeX build (the notes did not change)
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
SITE=0; TEX=1
for a in "$@"; do case "$a" in --site) SITE=1 ;; --no-tex) TEX=0 ;; *) echo "usage: $0 [--site] [--no-tex]"; exit 2 ;; esac; done
[ "$TEX" = 1 ] && _port/tex/build_scratch.sh
python3 _port/convert/build.py
node _port/tools/math_check.mjs | tail -n 3 || echo "math check reported failures (see above)"
if [ "$SITE" = 1 ]; then quarto render; else quarto render notes/diffgeo-gr; fi
echo "done. Preview: quarto preview   (then open /notes/diffgeo-gr/)"
