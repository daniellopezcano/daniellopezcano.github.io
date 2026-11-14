PHASE: design

# Progress ledger

**Next action.** The pilot is being assembled (units P1–P9 below). When all are `done`: render (`quarto render notes/diffgeo-gr`), have `port-checker` review the five pilot pages against the PDF, commit, and STOP for the author's review (the one planned stop; see "Pilot review" below). Do not start the bulk units (B…) before the author's approval is recorded in this file.

**State of the working tree.** Branch `course-diffgeo-gr`. ~120 pre-existing files show as modified because of file-mode changes only: never stage them (DECISIONS D22). Scratch build present in `_port/.work/tex/src` (git-ignored; rebuild with `_port/tex/build_scratch.sh`, ~4 min).

**Pilot review (waiting for the author).** Not approved yet. When approved, record here the date, what was approved and every change requested, switch the first line to `PHASE: bulk`, then continue with the bulk units without stopping.

**Needs a design decision.** (none)

## Units

Status: `todo`, `in progress`, `done`, `blocked`. One commit per finished unit, ledger updated in the same commit.

### Pilot (design phase)

| Unit | What | Status | Checks passed | Commit |
|---|---|---|---|---|
| P1 | Scratch build of the notes with numbering hooks (`_port/tex/`) | done | 176 pages; labels identical to the notes' `main.aux`; pdftotext identical except the date; notes dir clean | (pilot commit) |
| P2 | Converter core: `source.py`, `texparse.py`, `render.py`, `build.py`, `cover.py` | done | `build.py --status`: 72 of 76 pages convert; numbering records fully consumed on each | (pilot commit) |
| P3 | Figure pipeline `figures.py` (PDF→SVG/WebP, TikZ→SVG with reference groups) | in progress | | |
| P4 | Math engine comparison + `tools/math_check.mjs` + config fixes | in progress | | |
| P5 | Course shell: `_metadata.yml`, `assets/course.css`, `_head.html`, navbar entry, sidebar | done | `quarto render notes/diffgeo-gr` completes; outline, sidebar and search index include generated pages | (pilot commit) |
| P6 | Page script `assets/course.js`: footnote popovers, figure zoom/pan, roadmap links, interactive loader; landing page `index.qmd` | todo | | |
| P7 | Interactive core `assets/interactive/dg.js` + pilot 2D (`maps`, §2.1) + pilot 3D (`variations`, C.6) | todo | | |
| P8 | `_port/INVENTORY.md`, `PLAN.md`, `DECISIONS.md`, `REVIEW.md`, `CLAUDE.md` | in progress | | |
| P9 | Render, checker review of the pilot pages vs the PDF (desktop + phone), fixes, commit | todo | | |

### Bulk (after approval)

See `PLAN.md` § "Work units" for the full list (B1…). Copy each unit here when it starts.
