# Report: the lecture notes on the web (phase 2)

"From Differential Geometry to General Relativity" is now a course section of the site at `/notes/diffgeo-gr/`: 82 generated pages (81 converted from the notes plus the definitions-and-notation page), in their own design, with the notes' text, equations, numbers and figures exactly as in the PDF, and fourteen interactive panels. Everything is on the branch `course-diffgeo-gr`, committed locally, **not pushed and not merged**. What is live on `main` is still the pilot (27fb386).

The ledger with every unit and its checks is `_port/PROGRESS.md`; the reasons for every choice are in `_port/DECISIONS.md` (D1–D60); what waits for you is in `_port/REVIEW.md`.

## 1. What changed in this phase

**Milestone 1, design (2026-11-15).** Design direction A, "Paper", chosen under your delegation (`DESIGN.md`, D30). The course pages left Quarto's templates: the converter writes complete HTML pages and `quarto render` only copies them (D29), so the published HTML is exactly what the converter wrote and the rest of the site is untouched. The design system: light paper by default with your site's navy as a reader-selectable dark theme (D32); the notes' own typeface family, New Computer Modern, for every word of the notes and Lato for every word of the site (D31); a course tree with the page outline inside it, a course bar with breadcrumbs, the master roadmap as a map, search, theme switch and progress; sidenotes in the margin (D33, D60); chapter opening pages with the chapter's roadmap and the related proofs and examples computed from your own cross-references (D38); hover previews of every reference (D25); proofs and worked examples openable in place where they are referenced (D35); "copy LaTeX" on every display (D39); "read" marks kept in the browser (D40).

**Milestone 2, content complete (2026-11-16).** The four pages that failed in the pilot convert: tables (D48), the Einstein–Hilbert flowchart as Figure 10.3 (D50), the remaining list and reference constructs (D47, D49). New pages: copyright, licence and funding (verbatim, D51), About the Author (D51), List of Figures (checked against `main.lof`, D52), Bibliography (from `main.bbl`, citations linked and previewed, D52), and a definitions-and-notation page built only from your term macros and the "Notation" table of §4.1.2 (D53). The PDF on the site is the compressed current build, with a new thumbnail; both Teaching cards have a "Read online" button; the landing page says "Last updated" with the date of the last commit of the notes repository that touched the build (D54).

**Milestone 3, interactives (2026-11-16).** One panel component for all of them (D55, D56): it sits right after the figure or at the end of the section it illustrates (D57), has one line of instructions, controls with your notation, Reset, a link back to the static figure and, where your package has one, a link to the notebook. The twelve of the ranking, in fourteen panels:

| Panel | Where | What the reader does |
|---|---|---|
| `maps` | after Fig. 2.1 | rewires arrows between two finite sets; the classification follows (pilot) |
| `laws` | end of §2.3 | drags two bases; vector and covector components change, the pairing does not |
| `charts` | after Fig. 3.1 | drags a point on the surface or in either chart; the transition maps relate the two labels |
| `tpm` | after Fig. 4.2 | drags p and a velocity; one vector, two sets of components, the law in numbers |
| `cotangent` | after Fig. 4.3 | counts the lines of (df)_p crossed by a vector |
| `fields` | after Fig. C.8 | moves p; 𝒳⌊f⌉(p) in both charts and as (df)_p(𝒳_p) |
| `transport` | end of C.5 | transports a vector around loops under ∇ᴱ, ∇ᵂ, ∇ᵏ; only curvature fails to close |
| `variations` | after Fig. C.12 | deforms the meridian and the parallel; the first variation (pilot) |
| `integration` | after Fig. 8.1 | reshapes the partition of unity; the two chart terms change, their sum does not |
| `rotating` | after Fig. C.15 | free paths in the inertial and the co-rotating chart; pseudo-forces from the chart |
| `pointmass` | after Fig. C.17 | radial fall and the tidal stretching of a ring of particles |
| `lightcones` | after Fig. 10.1 | drags a worldline and a vector; proper time, observer frame, causal character |
| `schwarzschild` | after Fig. C.19 | radial proper distance against coordinate distance near r_S |
| `ehsteps` | after Fig. 10.3 | reads the flowchart panel by panel in the caption's order |

Every number a panel shows is computed from the formulas of the notes (or, for the figures your package drew, from the notebook's own definitions) and cross-checked in `test_interactives.mjs` against closed forms or independent integration.

**Milestone 4, polish (2026-11-16).** Every page was compared with the PDF at desktop and phone widths in both themes (B10–B22): no fidelity defect was found; the fixes were of presentation — `~` is a no-break space again (D9), display and sidenote math sizes (D59, D60), equation numbers stay visible in scrolling displays, references inside formulas are links as in the PDF, footnotes that do not fit the margin open as popovers, figure alt texts carry the caption, and the figure viewer, roadmap badges, previews and panels were tuned (B33).

## 2. Where the web differs from the PDF, and why

The words, formulas, numbers and order of the notes are unchanged (checked by `fidelity.py` and `main_text_diff.py`). What differs is presentation, all recorded in `DECISIONS.md`:
- **Layout:** one page per chapter opening and per section (D3); footnotes as sidenotes or popovers, always also listed at the foot of the page (D33, D60); figures stay where the source puts them (floats are not moved).
- **"??" in the PDF** (labels of material not in the build) show an "in preparation" marker (D17); `\DLC` author notes are hidden (D18).
- **Four math rewrites** that MathJax needs (D7), each listed in `fidelity_allow.json`.
- **"page 84"** in §10.2 keeps the PDF's page number, linked to the figure (D47).
- **References and citations are thinly underlined** (accessibility, D41).
- **The arrow of §5.3** (an array with negative row skips) is taller than in the PDF (D46): it waits for your decision.
- **Text inside TikZ figures** lives in the SVG; the About-the-Author header, the cover and the dedication are set in a web layout from the words of their overlays (D19, D51).

## 3. What waits for you in `REVIEW.md`

- **Decisions taken for you** in this phase (12 items): design, light/dark, typeface, page architecture, math engine, underlines, PDF compression and thumbnail, definitions page, panels.
- **Typos and slips found in the notes** (32 rows), left as they are (rule 1): among them captions whose colours or labels disagree with their images (Figures 3.1, 4.2, 4.3, C.8), index slips in §2.3, "Subsection" for section labels in C.8, sentences cut short.
- **Every word written for the web layer** (57 rows): labels, buttons, instructions of the panels, screen-reader names. You said you would review this list before the final merge.
- **The author note hidden on the web** (`\DLC`, D18) and the open questions of the pilot.

## 4. How to rebuild after editing the LaTeX

From the repository root:
```bash
_port/build.sh --site     # scratch copy of the notes + LaTeX build with numbering hooks (~4 min), converter, full quarto render
bash _port/check.sh       # every check; ends with ALL CHECKS PASSED or the list of failures (~15 min)
```
`_port/build.sh --site --no-tex` skips the LaTeX build when only the converter or the design changed. The notes directory is only read; the scratch build lives in `_port/.work/` (git-ignored). A construct the converter does not know stops its page with `file:line` (`python3 _port/convert/build.py --status` lists them); teach the converter, never edit a generated page. Interactive panels are attached by LaTeX label in `_port/interactives.json`.

## 5. How to preview locally

```bash
quarto preview            # then open http://localhost:<port>/notes/diffgeo-gr/
```
Or serve `docs/` with any static server (`python3 -m http.server -d docs 8000`, then `http://localhost:8000/notes/diffgeo-gr/`).

## 6. How to publish

The branch is ready: `docs/` is rendered and committed, and the full `check.sh` (with a fresh `quarto render`) printed ALL CHECKS PASSED on 2026-11-16 (19 checks, 17 min 45 s): converter in strict mode (81 of 81 pages), every equation typesets, figure pipeline, converter constructs, page script and the 14 interactives in a headless browser, published course = committed course, links, all pages (errors, overflow, weights), accessibility with axe-core in both themes, navbar replica, fidelity to the LaTeX source, the rest of the site unchanged with respect to `main`, the notes directory untouched. To publish, review it (and `REVIEW.md`), then merge `course-diffgeo-gr` into `main` and push; GitHub Pages serves `docs/` from `main`. Every page address that existed at the pilot still resolves (checked), so no link breaks.
