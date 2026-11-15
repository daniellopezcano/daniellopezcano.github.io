# Plan

How the notes become a course section of the site. Reasons for each choice are in `DECISIONS.md` (D-numbers); what the notes contain is in `INVENTORY.md`; status is in `PROGRESS.md`.

## Architecture in one page

```
notes (read-only)                                   website repo
main.tex + Chapters/ + Appendices/ + plots/
        │  _port/tex/build_scratch.sh  (copy + XeLaTeX with numbering hooks)       D5
        ▼
_port/.work/tex/src/   main.aux  main.port  main.bbl  sources
        │  _port/convert/build.py                                                   D4
        │     source.py   comments stripped, \input expanded, file:line kept
        │     texparse.py strict parser; math captured verbatim
        │     render.py   HTML; numbers from main.port, refs from main.aux         D5 D7
        │     figures.py  PDF → SVG/WebP, TikZ → SVG                               D10
        │     cover.py    texts of the cover and dedication                        D19
        ▼
notes/diffgeo-gr/   <chapter>/index.qmd, <chapter>/<section>.qmd   (generated)     D2 D3 D6
                    _sidebar.yml, _generated/*.qmd, figures/, assets/labels.json   (generated)
                    index.qmd, _metadata.yml, assets/course.css|js,
                    assets/mathjax-config.js, assets/interactive/*.js              (hand-written)
        │  quarto render
        ▼
docs/notes/diffgeo-gr/…                                                (published from main by GitHub Pages)
```

- One command regenerates everything after the LaTeX changes: `_port/build.sh` (scratch build → converter → `quarto render`), and `_port/check.sh` verifies it (both written in unit B9; until then the three commands are in `CLAUDE.md`).
- Web-only material is attached by LaTeX label (`_port/interactives.json`) and lives in hand-written files, so regeneration never destroys it (D15, D23).

## Page map

One page per chapter opening and one per section; the full table (number, title, address, source file, counts, conversion status) is generated in `INVENTORY.md` § "Structure and page map". Summary:

| Part | Pages | Address under `notes/diffgeo-gr/` |
|---|---|---|
| Landing page (cover texts, master roadmap as map, contents, PDF and package links, quote and dedication) | 1 | `index.html` |
| Copyright, licence (MIT) and funding (FAPESP, both languages), verbatim | 1 | `copyright.html` |
| About the Author | 1 | `about-the-author.html` |
| Ch. 1–10: chapter page + one page per section (1.1 holds the four roadmaps) | 10 + 31 | `<chapter>/index.html`, `<chapter>/<section>.html` |
| Appendix A Computational resources | 1 | `computational-ressources/index.html` (label spelling kept, D2) |
| Appendix B Proofs & Comments: chapter page + B.1–B.22 | 1 + 22 | `proofs-and-additional-material/…` |
| Appendix C Examples: chapter page + C.1–C.9 | 1 + 9 | `examples/…` |
| List of Figures (generated from the captions' short forms) | 1 | `list-of-figures.html` |
| Bibliography (from `main.bbl`) | 1 | `bibliography.html` |
| Index of definitions (optional, last) | 1 | `definitions.html` |

Sidebar: Course home; chapters 1–10 with their sections; "Appendices" → A, B, C with their sections; front and back matter. Right-hand "On this page" lists subsections. Previous/next at the foot of each page follow the order of the notes.

## Reading experience (how each wish is met)

| Wish | Mechanism |
|---|---|
| Same content, notation, numbering | D4–D7; fidelity check D24; `math_check.mjs` |
| Runic symbols | D8 |
| Colour-coded terms | `.dg-term-<colour>`, D12 |
| Calm reading surface | D13 |
| Footnotes without losing your place | popover + list at page foot, D11 |
| Working cross-references with preview | converter links (D1) + D25 |
| Figures at full quality, click-to-zoom, light backgrounds handled | D10 |
| Roadmaps and EH flowchart readable; boxes link to their chapter/section/equation | zoom/pan viewer; `dg-xref` groups from `\ref*` (the TikZ source has no hyperlinks of its own: the badges use `\ref*`, which is link-free in the PDF) |
| Real HTML tables | `tabular` handler (unit B2) |
| Phone | Quarto's collapsing sidebar; `.math.display` scrolls horizontally; figures full width |
| Search | Quarto's site search indexes the generated pages by section (verified) |
| "??" references | "in preparation" marker, D17 |
| Author notes hidden | D18 |

## Interactive figures: proposal and ranking

Test applied to each: what does manipulating it show that the static figure cannot? Ranked by that. All follow D15 (one small own library, no plotting library; geometry from the formulas of Appendix C). The first two rows of "Pilot" are built now to establish the 2D and 3D patterns.

| # | Where (label) | Interactive | What the student gains | Type |
|---|---|---|---|---|
| 1 | Ch. 4 / C.3, tangent space at p | Curves through p on the surface, their velocities and the tangent plane; the same velocity's components in charts 𝒰 and 𝒱; switch or drag p | The vector is one object; its components depend on the chart. The central idea of the course, impossible to see in a still | 3D + 2 chart panels |
| 2 | §2.3 / C.1, transformation laws | Drag the two basis vectors of a 2D space; a fixed vector and a fixed covector (drawn as level lines) | Components of the vector change contravariantly, of the covector covariantly, while the pairing stays put | 2D |
| 3 | §6.3 / C.5, parallel transport | Transport a vector along a closed curve under the example's three connections, side by side, with autoparallels | Transport is a choice of connection; torsion vs curvature show up as different failures to close | 2D/3D |
| 4 | §7.2.1 / C.6, variations (**pilot 3D**) | Families (i), (ii) of the meridian and of the parallel on the paraboloid; slider for the deformation parameter; length plotted live | Sees the first variation vanish for the geodesic and not for the parallel; the minimum near −1/π | 3D + plot |
| 5 | §3.2 / C.2, charts and transition maps | A point in 𝒰∩𝒱 linked to its images in both charts; drag any of the three | The transition map as "the same point, two labels" | 3D + 2 panels |
| 6 | §9.4 / C.8, Newton–Cartan | Free worldlines in an inertial and in the co-rotating chart; then around a point mass, radial fall, tidal acceleration | Pseudo-forces appear from the chart, gravity from the connection | 2D spacetime diagrams |
| 7 | Ch. 10 / C.9, light cones and Schwarzschild | Light cones along a draggable worldline with the observer frame; Schwarzschild slice with circles at equal radial distance next to the metric components | Causal structure follows the metric; radial distance crowding towards r_S | 2D |
| 8 | §2.1, maps (**pilot 2D**) | Rewire arrows between two finite sets | Classification changes live: not a function / general / only injective / only surjective / bijective | 2D |
| 9 | §5.1–5.2 / C.4, fields | A vector field acting on a scalar field; the differential as level sets | X(f) as the rate of change of f along X, point by point | 3D/2D |
| 10 | §4.2, cotangent space | A covector as a differential with level sets, acting on a draggable tangent vector | The number df(X) as "how many level sets X crosses" | 2D |
| 11 | Ch. 8 / C.7, integration with two charts | Region covered by two overlapping charts; slider for the partition of unity | Why the chart contributions add to a chart-independent integral | 2D |
| 12 | §10, Einstein–Hilbert flowchart | Step-through of the same SVG, panel by panel | Follows a full-page derivation in order (only if the SVG groups allow it without redrawing) | SVG |
| 13 | C.1, polynomial vector space | Coefficient sliders; monomial vs Legendre decomposition | Same vector, two bases | 2D |
| 14 | C.3, sum of tangent vectors | Adding curves in two charts | Why the sum of curves depends on the chart and the sum of velocities does not | 3D + panels |
| 15 | Ch. 5, bundles of a ring | Tangent and cotangent bundle over a circle | Bundle as "all tangent spaces at once" | 3D |

Dropped as weak: smooth functions as a vector space with a scalar slider (the static figure already shows it); integration on the circle (covered by 11).
Proposal: build 1–12 in this order after the pilot (4 and 8 exist), then 13–15 only if everything else is solid.

## Work units

Pilot units P1–P9 are in `PROGRESS.md`. After approval:

| Unit | What | Who |
|---|---|---|
| B1 | Converter: remaining text handlers (`\setcounter{enumi}` inside lists, `\item` preceded by content, `\pageref`, `\renewcommand{\arraystretch}`) | worker |
| B2 | Converter: `tabular` → HTML tables (4 tables, 2 of them inside math) | main (first of its kind) |
| B3 | Converter: Einstein–Hilbert flowchart (`custompage` + `\captionof`, own macros) → SVG figure with number and caption | main |
| B4 | Front matter pages: copyright/licence/funding; About the Author (handlers for `\cpheading`, `\grantbadge`, `\aboutstop`; background image re-encoded small) | main, then worker |
| B5 | List of Figures and Bibliography pages; citations link to it | worker |
| B6 | Fidelity check `tools/fidelity.py` + allow-list (D24) | main designs, worker builds |
| B7 | Browser check `tools/browser_check.mjs` (every page: no MathJax errors, no console errors, internal links and anchors resolve, interactives initialise) | worker |
| B8 | Cross-reference hover previews (D25) | worker |
| B9 | `_port/build.sh`, `_port/check.sh` (all Definition-of-done checks, incl. numbers vs PDF and "outside the course only the navbar entry and two buttons changed") | worker |
| B10–B19 | Chapter-by-chapter review against the PDF, desktop and phone (Ch. 1–10), fixing the converter where a careful reader would notice | checker finds, worker fixes |
| B20–B22 | Same for Appendix A+B (two units) and C | checker, worker |
| B23–B32 | Interactives 1, 2, 3, 5, 6, 7, 9, 10, 11, 12 of the ranking, one unit each | worker (pattern from P7) |
| B33 | Roadmap boxes: whole badge clickable; EH flowchart zoom defaults | worker |
| B34 | PDF on the site (per the author's answer), thumbnail, "Read online" buttons on the two cards of `teaching_and_projects.qmd` | worker |
| B35 | Index of definitions from the term macros (optional) | worker |
| B36 | Full `check.sh` pass, screenshots of every page reviewed, `REPORT.md` | checker + main |

Rules for every unit: follow `DECISIONS.md`; never edit generated files; never write to the notes; run `python3 _port/convert/build.py --status` and the relevant checks; main agent reviews the diff, updates `PROGRESS.md`, commits.
