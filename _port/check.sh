#!/usr/bin/env bash
# Definition-of-done checks for the course section. Hand-written, part of the web port.
#   _port/check.sh              run everything; ends with ALL CHECKS PASSED or the list of failures
#   _port/check.sh --no-render  reuse the docs/ already rendered (faster; for repeated runs)
#   BASE=<git ref> _port/check.sh   compare the rest of the site against another ref (default: main)
# Each check is one line `name: command`; a check fails if its command exits non-zero.
# Checks are added here as the tools are built (see _port/PROGRESS.md); never remove one.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
NOTES="${NOTES:-/home/dlopez/Documentos/0.profesional/Postdoc/USP/Projects/learning_cosmology/lecture_notes_differential_geometry_GR/from_diff_geom_to_GR}"
BASE="${BASE:-main}"
RENDER=1
for a in "$@"; do case "$a" in --no-render) RENDER=0 ;; *) echo "usage: $0 [--no-render]"; exit 2 ;; esac; done
export PLAYWRIGHT_BROWSERS_PATH="$REPO/_port/.work/pw"
LOG="$REPO/_port/.work/check"; mkdir -p "$LOG"
FAILED=()

run() {  # run <name> <command...>
  local name="$1"; shift
  local log="$LOG/$(echo "$name" | tr ' /' '__').log"
  printf '%-58s ' "$name"
  if "$@" >"$log" 2>&1; then echo ok; else echo FAIL; FAILED+=("$name  (log: ${log#$REPO/})"); tail -n 6 "$log" | sed 's/^/      /'; fi
}

notes_clean()   { [ -z "$(git -C "$NOTES/.." status --short)" ]; }
on_branch()     { [ "$(git rev-parse --abbrev-ref HEAD)" = course-diffgeo-gr ]; }
# The converter must convert every page. STRICT_PAGES=0 only while pages are still pending (PROGRESS.md).
convert()       { if [ "${STRICT_PAGES:-$(cat _port/.strict 2>/dev/null || echo 0)}" = 1 ]; then python3 _port/convert/build.py --strict; else python3 _port/convert/build.py; fi; }
math_ok()       { node _port/tools/math_check.mjs > "$LOG/math.out" 2>&1; local rc=$?; tail -n 4 "$LOG/math.out"; return $rc; }
render_site()   { quarto render 2>&1 | tee "$LOG/render.out" | tail -n 3; [ "${PIPESTATUS[0]}" = 0 ] || return 1
                  # no warning or error that concerns the course pages
                  ! grep -nE '^(WARN|ERROR)|\[WARNING\]|Could not|Unable to' "$LOG/render.out"; }
# every page address that existed at the pilot still resolves (REDESIGN "Definition of done"; D29)
pilot_addresses() { local n=0 a; while read -r a; do [ -z "$a" ] && continue; [ -f "docs/$a" ] || { echo "missing: docs/$a"; n=$((n+1)); }; done < _port/pilot_addresses.txt; echo "$n missing"; [ "$n" = 0 ]; }
no_conflicts()  { ! grep -rlE '^(<<<<<<<|>>>>>>>) ' docs --include='*.html' --include='*.json' --include='*.xml' --include='*.css' --include='*.js'; }

run "on branch course-diffgeo-gr"                          on_branch
run "notes directory unchanged (before)"                   notes_clean
run "converter regenerates the pages"                      convert
run "every equation typesets (math_check)"                 math_ok
[ "$RENDER" = 1 ] && run "quarto render (whole site)"      render_site
run "no merge-conflict markers in docs/"                   no_conflicts
run "every pilot address still exists"                     pilot_addresses
run "figure pipeline (test_figures)"                       python3 _port/tools/test_figures.py
run "page script in a headless browser"                    node _port/tools/test_page_script.mjs
run "interactives in a headless browser"                   node _port/tools/test_interactives.mjs
# >>> further checks are appended here by later units (fidelity, all-pages browser check, a11y, weight, addresses)
# R9 (D37): published course = committed course and converter idempotent (only after a render); links;
# all pages in a browser (errors, sideways scroll at 1280/390 px, img attributes, ids, weight budget);
# axe-core in both themes + keyboard pass; navbar replica vs Quarto navbar
[ "$RENDER" = 1 ] && run "docs/ course = committed; converter idempotent"  python3 _port/tools/render_intact.py
run "every course link resolves (links_check)"             python3 _port/tools/links_check.py
run "all pages: errors, overflow, weight (page_check)"     node _port/tools/page_check.mjs
run "accessibility: axe-core + keyboard (a11y_check)"      node _port/tools/a11y_check.mjs
run "navbar replica = Quarto navbar (navbar_check)"        node _port/tools/navbar_check.mjs
[ -x _port/tools/checks_extra.sh ] && source _port/tools/checks_extra.sh
run "rest of the site unchanged with respect to $BASE"     python3 _port/tools/site_unchanged.py "$BASE"
run "notes directory unchanged (after)"                    notes_clean

echo
if [ "${#FAILED[@]}" = 0 ]; then echo "ALL CHECKS PASSED"; else
  echo "FAILED (${#FAILED[@]}):"; printf '  - %s\n' "${FAILED[@]}"; exit 1
fi
