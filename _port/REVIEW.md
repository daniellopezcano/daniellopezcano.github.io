# For the author's review

Things only you can decide or fix. Nothing here was changed in the notes; the web shows exactly what the LaTeX says.

## Open questions (pilot)

See the end-of-pilot message; they are repeated in `PROGRESS.md` § "Pilot review" once answered.

## Facts checked

- **The source repository named on the copyright page is not publicly reachable**: `https://github.com/daniellopezcano/lecture_notes_differential_geometry_GR` answers HTTP 404 (checked 2026-11-14), so it is private or not created. The Python package repository `https://github.com/daniellopezcano/differential_geometry` is public (HTTP 200, MIT).
- The scratch build reproduces your PDF: 176 pages, the labels in its `main.aux` are identical to those in the notes' `main.aux`, and the text of both PDFs differs only in the date on the cover.
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
| `Chapters/Metric.tex:178` | missing full stop before "The curve $\gamma$ is a geodesic if" |
| several files | `\coloneq` (12 uses) next to `\coloneqq` (376 uses): check they print the same sign in your PDF (see the math-engine note below) |

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

(Landing-page buttons and the instructions of each interactive are added to this table by the units that write them.)

## Content the converter cannot yet show faithfully

See `python3 _port/convert/build.py --status` (pages listed as PENDING) and `INVENTORY.md` § "Hard to convert".
