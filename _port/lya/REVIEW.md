# For the author to review (Lyα forest course)

Everything here waits for you. Nothing in the notes has been changed: typos are listed, not fixed (rule 1).

## Decisions taken for you

| # | What | Where |
|---|---|---|
| 1 | The conversion stops after § 5 ξ1D (the whole of `subsec_xi1D.tex`), because the May § 4.1.4 "Decomposition of the total 1D 2PCF" is now split between the new § 4 and the end of § 5.3. One value in `_port/convert/courses.py` (`last`) moves the cut. | DECISIONS L1 |
| 2 | Appendices A, B, C are included (the converted part refers to them); D and E are not. | L2 |
| 3 | No bibliography page (nothing is cited in the converted part). | L4 |
| 4 | "Review notes / working draft" stays on the landing page; the date is "Last updated". | L6 |
| 5 | Teaching page: the graduate course card's PDF button is labelled "Download PDF" (it had "Read online" already, next to "Lecture notes" = the PDF); the card now reads Read online · Download PDF · GitHub. | L19 |
| 6 | The old Lyα PDF and its thumbnail are deleted from `assets/` and `docs/` (they show the co-authors). Reversible: `git checkout main -- assets/files/docs/absorption_lines_in_cosmological_sightlines.pdf assets/img/docs/absorption_lines_in_cosmological_sightlines.png`. | L19 |
| 7 | The first course's thumbnail (`assets/img/docs/from_differential_geometry_to_general_relativity.png`) is now shown by no page (it was only in the removed "Lecture Notes" section); kept in `assets/`, no longer copied to `docs/`. | L19 |
| 8 | Your CV PDF (`assets/files/DLC_CV.pdf`) still lists OJALÁ as it was; not edited. | L19 |

## Author material left out (brief: "No authors")

| Source | What | Where it would have appeared |
|---|---|---|
| `main.tex` `\noteauthors` | the five author names with ORCID links and affiliation marks | title page → landing page |
| `main.tex` `\noteaffiliationone`–`three` | the three affiliations | title page |
| `main.tex` `\noteemails` | the contact e-mail | title page |
| `main.tex` `\fancyhead[R]` | "López-Cano et al." running header | every page (the web has no running header) |

No acknowledgement and no passage naming a co-author exists in the converted part (§§ 1–5, Appendices A–C), nor anywhere in the notes.

## Typos and slips found in the notes

| Where | What |
|---|---|

## Words written for the web layer

| Where | Words |
|---|---|
