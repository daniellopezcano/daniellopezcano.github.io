PHASE: design

# Progress ledger

**Next action.** The pilot is complete and waiting for the author's review (the one planned stop). Do NOT start the bulk units before the approval is recorded below. After approval: write the date, what was approved and every requested change under "Pilot review", change the first line of this file to `PHASE: bulk`, then take the units of `PLAN.md` § "Work units" in order (B1 first: `python3 _port/convert/build.py --status` lists the four pending pages and the construct that stops each), one commit per unit.

**State of the working tree.** Branch `course-diffgeo-gr`, everything of the pilot committed (source, generated pages, `docs/`). ~120 pre-existing files show as modified because of file-mode changes only: never stage them (DECISIONS D22, D28). Scratch build in `_port/.work/tex/src` (git-ignored; rebuild with `_port/tex/build_scratch.sh`, ~4 min). Node tools: `cd _port && npm ci`, then `PLAYWRIGHT_BROWSERS_PATH=$PWD/.work/pw npx playwright install chromium` if `_port/.work/pw` is missing.

**Pilot review (waiting for the author).** Not approved yet. Open questions put to the author on 2026-11-15:
1. Navbar label ("Lecture Notes") and address (`/notes/diffgeo-gr/`).
2. The PDF: replace the old 73-page file in place with a compressed copy of the current build (Ghostscript `/ebook`: 6.3 MB, the file there now is 7.1 MB) and regenerate its thumbnail, or link elsewhere. "Download PDF" currently points to the old file.
3. Cover date (`\today` in the PDF): left out on the landing page; alternative: date of the last change of the notes.
4. Figure weight: 5.8 MB for 31 figures (3D plots as 1800 px WebP); once more in `docs/`.
5. Interactive figures: the ranking in PLAN.md (build 1–12), and the choices listed in REVIEW.md.
6. Reading layout: one page per section, sans-serif text, 880 px column, slightly wide equations shrunk to fit.
7. Math engine: MathJax 3 (8 arrays have a narrower gap beside the rule than the PDF; MathJax 4 would match).
8. Wording of web-layer text (REVIEW.md table), incl. "in preparation".
9. The source repository named on the copyright page is not public (404).

**Needs a design decision.** (none)

## Units

Status: `todo`, `in progress`, `done`, `blocked`. One commit per finished unit, ledger updated in the same commit.

### Pilot (design phase)

| Unit | What | Status | Checks passed | Commit |
|---|---|---|---|---|
| P1 | Scratch build of the notes with numbering hooks (`_port/tex/`) | done | 176 pages; labels identical to the notes' `main.aux`; pdftotext identical except the date; notes dir clean | 378b8b3 |
| P2 | Converter core: `source.py`, `texparse.py`, `render.py`, `build.py`, `cover.py` | done | `build.py --status`: 72 of 76 pages convert; numbering records fully consumed on each | 378b8b3 |
| P3 | Figure pipeline `figures.py` (PDF→SVG/WebP, TikZ→SVG with reference groups) | done | `tools/test_figures.py` passes; 31 figures built, 5.8 MB; 23 reference groups in the master roadmap | 5c792e4 |
| P4 | Math engine comparison + `tools/math_check.mjs` + config fixes | done | 3046 of 3047 distinct expressions typeset with MathJax 3.2.2 (the one failure is the `tabular` of §4.1.2, unit B2); runic glyphs verified in browser at 3× | 5c792e4 |
| P5 | Course shell: `_metadata.yml`, `assets/course.css`, `_head.html`, navbar entry, sidebar | done | `quarto render notes/diffgeo-gr` completes; outline, sidebar and search index include generated pages | 378b8b3 |
| P6 | Page script `assets/course.js`: footnote popovers, reference previews, figure zoom/pan, roadmap links, interactive loader; landing page `index.qmd` | done | `tools/test_page_script.mjs`: 49 checks pass at 1280 and 390 px | dfd8cc4 |
| P7 | Interactive core `assets/interactive/dg.js` + pilot 2D (`maps`, §2.1) + pilot 3D (`variations`, C.6) | done | `tools/test_interactives.mjs` passes at 1280 and 390 px; lengths and first variations match the notes' closed forms | dfd8cc4 |
| P8 | `_port/INVENTORY.md`, `PLAN.md`, `DECISIONS.md`, `REVIEW.md`, `CLAUDE.md` | done | | db5d158 |
| P9 | Render, checker review of the pilot pages vs the PDF (desktop + phone), fixes, commit | done | checker compared 5 pages with PDF pp. 1, 11–18, 59–61, 157–163: text, numbering, colours, runic glyphs match; 4 defects found and fixed (nested links in prev/next, lost bullet, footnote panel, clipped wide equations); all tests pass after the fixes; existing pages differ from `main` only by the navbar entry | db5d158 |

### Bulk (after approval)

See `PLAN.md` § "Work units" for the full list (B1…). Copy each unit here when it starts.
