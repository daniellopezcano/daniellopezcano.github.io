# For the author's review

Things only you can decide or fix. Nothing here was changed in the notes; the web shows exactly what the LaTeX says.

## Open questions (pilot)

See the end-of-pilot message; they are repeated in `PROGRESS.md` § "Pilot review" once answered.

## Facts checked

- **The source repository named on the copyright page is not publicly reachable**: `https://github.com/daniellopezcano/lecture_notes_differential_geometry_GR` answers HTTP 404 (checked 2026-11-14), so it is private or not created. The Python package repository `https://github.com/daniellopezcano/differential_geometry` is public (HTTP 200, MIT).
- The scratch build reproduces your PDF: 176 pages, the labels in its `main.aux` are identical to those in the notes' `main.aux`, and the text of both PDFs differs only in the date on the cover.
- `\coloneq` (14 uses) and `\coloneqq` both print ":=" in your PDF (mathtools 2022); the web does the same.
- Four worked-example figures (`plots/exercises/fig_fields_*.pdf` and others) are whole A4 pages with wide white margins; the web shows them as the PDF does, margins included. Cropping the source PDFs would enlarge them in both.
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
| screen-reader labels (not visible) | "Footnote n", "Back to the text", "Sections", "Contents", "Previous and next page", "Interactive figure" |
| figure numbers | "Figure n:" (as the PDF prints it) |
| page headers | "Chapter n • Title" / "Appendix X • Title" (as in the PDF running header) |

| landing page buttons | "Start reading", "Download PDF", "Python package" |
| figure viewer (labels of icon buttons, read by screen readers and shown as tooltips) | "Zoom in", "Zoom out", "Fit to window", "Close", "Enlarge figure", "Enlarge Figure n" |
| interactive after Figure 2.1 (`maps`) | instruction: "Drag from an element of 𝓜 to an element of 𝓝 to add an arrow of φ; click an arrow to remove it."; preset buttons and status line use your five panel names unchanged ("NOT a Function", "General Function", "Only Injective", "Only Surjective", "Bijective"); control labels 𝓜, 𝓝, φ⁻¹ |
| interactive after Figure C.12 (`variations`) | instruction: "Choose a curve and a family of variations and move ᛊ; drag the surface to rotate it."; options γ, σ, "(i)", "(ii)"; legend copied from Figure C.12 ("(i) linear in 𝒳", "(ii) linear in 𝒴", "(ii), second-order expansion"); readouts L[γ_ᛊ], d/dᛊ L[·]|_{ᛊ=0}; point labels A, B, P, Q |

### Choices made in the pilot interactives (say if you want them otherwise)

- `maps` starts on the "Bijective" preset; the presets use the set sizes of your Figure 2.1 (4/5, 4/5, 4/5, 4/3, 4/4); inverse arrows in green, offending elements ringed in red.
- `variations` starts at γ, family (i), ᛊ = 0.5; the slider covers [−1.2, 1.2] (the axis of Figure C.12); in 3D the deformed curve takes the colour and line style of its family in the plot (blue solid / orange dashed) rather than the sign colours of Figures C.10–C.11; the plot also shows the grey tangent lines and, for σ, the dotted second-order expansion of Figure C.12; the marker on the plot can be dragged.
- Numbers computed in the browser agree with your closed forms: L[γ] = 2.8586978545, L[σ] = π, first variations 0, 0, 2√2/3, 1; the minimum of σ (ii) is at ᛊ ≈ −0.345 with L ≈ 2.976 (your second-order estimate: near −1/π, about π − 1/(2π) = 2.982).

## Content the converter cannot yet show faithfully

See `python3 _port/convert/build.py --status` (pages listed as PENDING) and `INVENTORY.md` § "Hard to convert".
