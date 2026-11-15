PHASE: bulk

# Progress ledger

**Milestone status.** None of the phase-2 milestones is reached yet. What is live on `main` is the pilot (27fb386).

**Next action.** Phase 2 (`_port/REDESIGN.md`), milestone 1. The design direction is chosen (see "Design direction"): do NOT stop to ask for it. R4, R5 and R6 are done: the course pages are complete HTML written by the converter in direction A, math stays on MathJax 3.2.2. Continue with R8 (D38), R9 (independent of each other; `PLAN.md` § "Phase 2", DECISIONS D34–D37, `DESIGN.md` § 4), then R10 and declare milestone 1 at the top of this file. R7 is done too. Known leftovers for R10: (1) eight pages scroll sideways at 390 px because a display equation is wider than its scroll box (D27 says it must scroll inside its box): tangent-spaces/tangent-space (699 px, the pending `tabular`), tangent-spaces/cotangent-space (564), gr/spacetime (499), computational-ressources/index (475), introduction/index (435), covariant-derivative/torsion-curvature (430), proofs…/proof-sylvester (403), examples/example-fields (393); (2) the "open here" button can wrap to the next line away from its reference at 1440 px in §7.2 (screenshot `_port/.work/r7/panel2-light-1440.png`); (3) search results show titles with raw TeX delimiters; (4) `docs/sitemap.xml` gets new `lastmod` times on every build; (5) the tree has no "Appendices" heading. Then milestone 2 (B1 first: `python3 _port/convert/build.py --status` lists the four pending pages).

**State of the working tree.** Branch `course-diffgeo-gr` = `main` (27fb386, pushed 2026-11-15 by the author's one-off authorisation) + local commits. From here on: never push, never merge into `main`. `core.fileMode` is `false` in this clone, so the mode-only changes of D22 no longer show; still stage explicit paths. Scratch build in `_port/.work/tex/src` (git-ignored; rebuild with `_port/tex/build_scratch.sh`, ~4 min). Node tools: `cd _port && npm ci`, then `PLAYWRIGHT_BROWSERS_PATH=$PWD/.work/pw npx playwright install chromium` if `_port/.work/pw` is missing.

**Pilot review: APPROVED by the author (recorded 2026-11-15, from `_port/REDESIGN.md`).** The pilot is merged into `main` and live at `/notes/diffgeo-gr/`. Answers to the nine questions:
1. Navbar label "Lecture Notes" and address `/notes/diffgeo-gr/` stay. The address is public: every page address that existed at the pilot must keep working (redirect if a page moves).
2. PDF: replace the old file in place with the compressed copy of the current build, regenerate its thumbnail, point both cards of the Teaching page and the landing page to it.
3. Cover date: shown as "Last updated", from the most recent commit in the notes repository that touched a file `main.tex` includes.
4. Figures: keep 1800 px; figures below the fold load lazily.
5. Interactives: build the top twelve of the ranking in `PLAN.md`; their presentation is part of the redesign.
6. Reading layout: decided in the redesign.
7. Math engine: decided in the redesign; match the PDF where it matters (arrays with vertical rules); MathJax 4 is fine if it holds on every equation and on the runes.
8. Web-only wording: approved for now; the author reviews the full list in `REVIEW.md` before the final merge.
9. Notes repository: the author decides later; the copyright text stays verbatim.

**Design direction.** Design direction chosen by Claude under the author's delegation, 2026-11-15: **A, "Paper"** (light paper surface, the notes' own typeface, sidenotes, course tree with the outline inside; the site's dark palette as a reader-selectable dark theme). The author wrote "I delegate the choice of design direction to you, so don't stop for it" and will review the result at the end. Comparison of the three prototypes, screenshots and reasons: `_port/DESIGN.md`; preview: `_port/design/preview.sh`. A resumed session must not stop to ask about this.

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

### Phase 2 (REDESIGN.md)

Units and their order: `PLAN.md` § "Phase 2". Copy each unit here when it starts.

| Unit | What | Status | Checks passed | Commit |
|---|---|---|---|---|
| A | Branch brought up to date with `main` (docs/ regenerated), `_port/check.sh` and `tools/site_unchanged.py` written, pilot merged into `main` and pushed (author's one-off authorisation), live site verified | done | `check.sh`: all pass except the known `math_check` failure (the `tabular` of §4.1.2, unit B2); live pages load without console errors | 50f234f, 27fb386 |
| R1 | Reference study in a headless browser (`_port/design/refs/`: `NOTES.md`, 27 screenshots; the Feynman Lectures site refused the headless browser) | done | | 0d809a3 |
| R2 | Three design directions as prototypes on six real pages (`_port/design/proto/`), screenshots at 1440 and 390 px (`_port/design/shots/`), `_port/design/preview.sh` | done | all 36 prototype pages load without console errors; the only horizontal overflow at 390 px is the pending `tabular` of §4.1 | 0d809a3 |
| R3 | `DESIGN.md` (study, comparison, choice, design system, budgets), DECISIONS D29–D37, `PLAN.md` phase 2 | done | Quarto behaviour behind D29 tested in a scratch project | 0d809a3 |
| R4 | Page shell in the converter (`shell.py`, `templates/landing.html`), Quarto copies the pages (`_quarto.yml` resources + `post-render`), `post_render.py`, `.qmd` pages and Quarto shell files removed, course search index written (D29, D36) | done | `check.sh --no-render`: all pass except the known `math_check` failure (the `tabular` of §4.1.2, unit B2); `docs/notes/diffgeo-gr` identical to `notes/diffgeo-gr` after a full `quarto render`; all 73 pilot addresses exist; text of `<main>` identical to the pilot's on all 73 pages; existing pages' Bootstrap bundles are again the pre-pilot ones | 0f1742a |
| R5 | Design system: `course.css` (tokens light/dark, shell, components, print), `course.js` (drawer, theme, progress, scroll-spy, sidenotes, ←/→), NewCM fonts subset by the converter (D30–D33) | done | `test_page_script.mjs` 69 checks at 1440/900/390 px; first load of §7.2: own HTML+CSS+JS+fonts 235 kB decoded, images 104 kB, third-party 1.47 MB | 0f1742a |
| R6 | MathJax 4 trial and decision (D34) | done: **stays on MathJax 3.2.2** | MathJax 4.1.3: equations (1 known failure), runes, weight pass; typeset time fails D34's 30 % rule on light pages (worst +38 ms; landing +172 ms). Numbers and the retry configuration in D34 "Result (R6)"; `tools/math_timing.mjs` | (this commit) |
| R7 | Connections: appendix content in place (D35), previews fixed for the new shell, "copy LaTeX", search dialog on the course and site indexes, map dialog (D36, D39) | done | `test_page_script.mjs` 165 checks at 1280 and 390 px; `test_interactives.mjs`; `check.sh --no-render` (only the known `tabular`); screenshots in both themes reviewed | (this commit) |
| R8 | Chapter opening pages (one wide column, roadmap excerpt, sections, related B/C); today they use the reading layout | todo | | |
| R9 | D37 checks not built yet: full-render-then-course-build identity, axe-core, weight budget, navbar replica vs Quarto navbar | todo | | |
| R10 | Checker review of every page (desktop, phone, both themes), fixes, milestone 1 declared | todo | | |
