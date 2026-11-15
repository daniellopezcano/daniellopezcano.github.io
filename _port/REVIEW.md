# For the author's review

Things only you can decide or fix. Nothing here was changed in the notes; the web shows exactly what the LaTeX says.

## Decisions taken for you in phase 2 (say if you want any of them otherwise)

- **Design direction A, "Paper"**, chosen under your delegation (2026-11-15). The comparison with the two alternatives, with screenshots, is in `_port/DESIGN.md`; `_port/design/preview.sh` shows all three on the same six pages.
- **Light by default, dark on request** (remembered per browser). The alternative is to follow the reader's operating-system setting.
- **Typeface: New Computer Modern Book**, the heavier-drawn sibling of the Latin Modern of your PDF, served from the site (four files, about 33 kB each, redistributed under the GUST Font License). Interface text is Lato, as on the rest of your site.
- **The course pages are no longer Quarto pages**: the converter writes them complete, and `quarto render` copies them. The rest of the site is untouched and still built by Quarto; `_quarto.yml` gains `resources` and `post-render` entries (DECISIONS D29).
- **Math engine stays MathJax 3.2.2.** MathJax 4.1.3 was tried (unit R6). It typesets every equation and the runes correctly, uses New Computer Modern Math (the family of the text face), and sets the gap beside the vertical rule of the arrays with `@{…}` column specifications as your PDF does (3.2.2 gives a narrower gap; three of the eight arrays were compared). It failed the speed rule I had set in advance (no page more than 30 % slower): pages with little math take about 35 ms longer to start (worst section page 126 → 159 ms; the landing page 152 → 324 ms), pages with much math are within −2 to +10 %. The slowdown is small in absolute terms, so this is a close call: if you prefer MathJax 4 for the font and the arrays, say so; the working configuration is saved (DECISIONS D34, "Result (R6)").
- **References and citations in the text are thinly underlined** (in your PDF they are coloured only). Colour alone did not pass the accessibility check in either theme (DECISIONS D41).
- The site navbar on course pages scrolls away with the page (on your other pages it is fixed); the slim course bar stays at the top instead.

## Open questions (pilot)

Answered in `REDESIGN.md`; recorded in `PROGRESS.md` § "Pilot review".

## Facts checked

- **The source repository named on the copyright page is not publicly reachable**: `https://github.com/daniellopezcano/lecture_notes_differential_geometry_GR` answers HTTP 404 (checked 2026-11-14), so it is private or not created. The Python package repository `https://github.com/daniellopezcano/differential_geometry` is public (HTTP 200, MIT).
- The scratch build reproduces your PDF: 176 pages, the labels in its `main.aux` are identical to those in the notes' `main.aux`, and the text of both PDFs differs only in the date on the cover.
- `\coloneq` (14 uses) and `\coloneqq` both print ":=" in your PDF (mathtools 2022); the web does the same.
- Four worked-example figures (`plots/exercises/fig_fields_*.pdf` and others) are whole A4 pages with wide white margins; the web shows them as the PDF does, margins included. Cropping the source PDFs would enlarge them in both.
- The Feynman Lectures site (one of your reference sites) is online but shows a Cloudflare challenge to a headless browser; it was not measured or screenshotted, and is described in `DESIGN.md` from prior knowledge only.
- The package repository has no `fig_variations_euler_lagrange_*` notebook (the four figures of C.6), and its `setup.py` omits `scipy` and `tol_colors`, which the code imports.

## Typos and slips found in the notes (left as they are)

| Where | What |
|---|---|
| `main.tex:693`, Appendix A title | "Computational ressources" (also in the label, which the web address inherits: `…/computational-ressources/`) |
| `Chapters/Vector_Spaces.tex:33` | "some necessary set-theoretic and the algebraic structures" (a noun seems to be missing after "set-theoretic") |
| `Chapters/Vector_Spaces.tex:128` | Ring identity: "\(\alpha \cdot 1 = \alpha \cdot 1 = \alpha\)" (the same product twice; probably `1 \cdot \alpha` was meant) |
| `Chapters/Vector_Spaces.tex:133` | stray ")" after the left-distributive law |
| `Chapters/Vector_Spaces.tex:196` | "associatted" |
| `Chapters/Vector_Spaces.tex:237` | "are the defined as" |
| `Chapters/Metric.tex` ~l.178 (§7.2.1) | missing full stop before "The curve $\gamma$ is a geodesic if" |

| `Chapters/Introduction.tex`, last paragraph before §1.1 | "the construction of fields in Chapter 3" and "the pseudo-forces of Chapter 6": fields are built in Chapter 5 and pseudo-forces appear in Chapter 9 (§9.4); check the two `\ref`s (`chapter_Topological_Manifolds`, `chapter_Covariant_Derivative`) |
| PDF table of contents | "B.18.10The …", "B.18.11The …": the number runs into the title (LaTeX's default number width is too small for three-part numbers ≥ 10); does not affect the web |

(Only the files read closely during the pilot so far; the chapter-by-chapter review will add to this table.)

## Author notes hidden on the web

| Where | Note |
|---|---|
| (filled from `_port/.work/report.json` → `review` → `author-note` at each build; one so far) | `\DLC{PROOF}` |

## References to material that is not in the build ("??" in the PDF → "in preparation" on the web)

`chapter_Symmetries`, `section_Spacetime`, `subsection_EH_boundary_terms`, `section_proof_EH_boundary_terms`, `section_proof_metric_EL`, `section_proof_Einstein_Maxwell` (10 occurrences; the list is regenerated in `INVENTORY.md`).

## Text written for the web layer (every word that is not yours)

| Where | Text |
|---|---|
| navbar | "Lecture Notes" |
| sidebar | "Course home", "Appendices" (the latter is the part title in your table of contents) |
| page outline title | "On this page" |
| unresolved references | "in preparation" (tooltip: "This part of the notes is in preparation") |
| interactive frames | badge "Interactive" |
| screen-reader labels (not visible) | "Footnote n", "Footnote n, back to the text" (the number link of a footnote; was "Back to the text", R9: the name must contain the visible number), "Sections", "Contents", "Previous and next page", "Interactive figure" |
| figure numbers | "Figure n:" (as the PDF prints it) |
| page headers | "Chapter n • Title" / "Appendix X • Title" (as in the PDF running header) |

| landing page buttons | "Start reading", "Download PDF", "Python package" |
| figure viewer (labels of icon buttons, read by screen readers and shown as tooltips) | "Zoom in", "Zoom out", "Fit to window", "Close", "Enlarge figure", "Enlarge Figure n" |
| interactive after Figure 2.1 (`maps`) | instruction: "Drag from an element of 𝓜 to an element of 𝓝 to add an arrow of φ; click an arrow to remove it."; preset buttons and status line use your five panel names unchanged ("NOT a Function", "General Function", "Only Injective", "Only Surjective", "Bijective"); control labels 𝓜, 𝓝, φ⁻¹ |
| interactive after Figure C.12 (`variations`) | instruction: "Choose a curve and a family of variations and move ᛊ; drag the surface to rotate it."; options γ, σ, "(i)", "(ii)"; legend copied from Figure C.12 ("(i) linear in 𝒳", "(ii) linear in 𝒴", "(ii), second-order expansion"); readouts L[γ_ᛊ], d/dᛊ L[·]|_{ᛊ=0}; point labels A, B, P, Q |

| course bar and page shell (built in R4/R5) | visible: "Lecture Notes" (first breadcrumb, read from the navbar entry), "Contents", "Map", "Search", "Skip to content"; labels of icon buttons and regions (screen readers, tooltips): "Site", "Toggle navigation", "Search", "Contents", "Breadcrumb", "Course map", "Search the notes", "Light or dark", "Course contents" |
| course tree | its title is the title of the notes and links to the landing page ("Course home" is gone) |
| browser tab | "<number> <title> – From Differential Geometry to General Relativity – Daniel López Cano" |
| appendix content opened in place (built in R7) | button "open here"; panel head: the kicker, number and title of the item as its own page shows them (your words), "open page", "close" |
| copy LaTeX on display equations (R7) | label of the button (screen readers, tooltip): "Copy LaTeX"; confirmation shown and announced: "Copied" |
| search dialog (R7) | dialog label "Search"; field label and placeholder "Search the notes" / "Search the site"; scope buttons "These notes", "Whole site"; list label "Results" (screen readers); "No results"; close button label "Close". Results show your page titles, section titles and text as written (TeX source as plain text) |
| map dialog (R7) | dialog label "Course map" (screen readers); its head is the link to §1.1 with your number and title; the caption is your caption of Figure 1.1; button labels "Enlarge figure", "Close" |
| chapter opening pages (R8) | label of the small page numbers after each related proof or example (screen readers, tooltip): "Pages connected by a reference"; a "·" before each number; the cards are headed by your chapter or appendix number and title ("Chapter n" / "Appendix X" + title, as in the contents of the landing page); the list of sections keeps the label "Sections" (screen readers); the roadmap's caption is your caption of that figure (Figure 1.2, 1.3 or 1.4), its number links to the figure in §1.1; button label "Enlarge figure" |

### Choices made in the pilot interactives (say if you want them otherwise)

- `maps` starts on the "Bijective" preset; the presets use the set sizes of your Figure 2.1 (4/5, 4/5, 4/5, 4/3, 4/4); inverse arrows in green, offending elements ringed in red.
- `variations` starts at γ, family (i), ᛊ = 0.5; the slider covers [−1.2, 1.2] (the axis of Figure C.12); in 3D the deformed curve takes the colour and line style of its family in the plot (blue solid / orange dashed) rather than the sign colours of Figures C.10–C.11; the plot also shows the grey tangent lines and, for σ, the dotted second-order expansion of Figure C.12; the marker on the plot can be dragged.
- Numbers computed in the browser agree with your closed forms: L[γ] = 2.8586978545, L[σ] = π, first variations 0, 0, 2√2/3, 1; the minimum of σ (ii) is at ᛊ ≈ −0.345 with L ≈ 2.976 (your second-order estimate: near −1/π, about π − 1/(2π) = 2.982).

## Content the converter cannot yet show faithfully

See `python3 _port/convert/build.py --status` (pages listed as PENDING) and `INVENTORY.md` § "Hard to convert".
