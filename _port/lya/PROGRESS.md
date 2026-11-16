# Ledger of the Lyα forest course

**Next action:** L7 — site updates: Teaching page (remove the "Lecture Notes" section; graduate course card's "Lecture notes" button → "Read online" to `/notes/diffgeo-gr/`), delete the old Lyα PDF + thumbnail from `assets/` and `docs/` (log in REVIEW), OJALÁ in press on the Research page (and every other mention in the site source); then extend `site_unchanged.py` to accept exactly these and the navbar.

**State of the working tree:** clean after each commit except `docs/` (rendered output is committed at the end, D28; until then `docs/` carries uncommitted renders); branch `course-lya` (from `main` at `f6bd3ae` + the brief `0bd14e0`).

**Notes directory:** `SkewerJAX_Review_and_Equations`, read-only; fingerprint at the start `3ed78561…cfd23` (L7).

| # | Unit | Status | Checks | Commit |
|---|---|---|---|---|
| L0 | Plan, inventory, decisions, ledger | done | — | 41c965a |
| L1 | Course configuration; converter/scratch build/shell take a course | done | first course: `course_unchanged.py` 150 files identical, `test_converter.py` ALL PASSED, `build.py --status` 81/81 | 08449a0 |
| L2 | Scratch LaTeX build of the Lyα notes | done | 57 pages, 296 records (L12); labels = author's `main.aux`; `pdftotext` = author's PDF; first course `main.port` identical | fd4ec5b |
| L3 | Converter: article structure, cut, appendices, author material, constructs | done | `build.py --course lya-forest` 27/27 pages (+ landing); 16 pages and 71 labels left out (§§ 6–9, D, E); first course unchanged except navbar | fd4ec5b, (this commit) |
| L4 | Math configuration | done | `math_check`: diffgeo 3427 / lya 439 expressions, 0 failures; macros checked against the preamble (L16) | (this commit) |
| L5 | Landing page, accent, cover | in progress | landing renders (title, subtitle, version, abstract, keywords, contents; no authors); teal accent; spectrum cover. Review in L17 | (this commit) |
| L6 | Navbar dropdown | done | first course: 82 pages differ only in the navbar (`course_unchanged.py`); behaviour/look checks added to `navbar_check` in L8 | 34f7805 |
| L7 | Site updates (Teaching, old PDF, OJALÁ) | todo | | |
| L8 | Tools and `check.sh` for both courses | todo | | |
| L9 | Panel 1: line profile | todo | | |
| L10 | Panel 2: optical depth along a sightline | todo | | |
| L11 | Panel 3: transmission and saturation | todo | | |
| L12 | Panel 4: observed wavelength → gas frame | todo | | |
| L13 | Panel 5: scale factor along the photon path | todo | | |
| L14 | Panel 6: 1D 2PCF and ergodicity | todo | | |
| L15 | Panel 7: 2PCF decomposition (L = 2) | todo | | |
| L16 | Panel 8: velocity units examples | todo | | |
| L17 | Page-by-page review against the PDF | todo | | |
| L18 | Report, final check, `docs/` | todo | | |

## Appendices included (L2)

| Appendix | Pulled in by |
|---|---|
| A Systems of ODEs | § 2.3 → `app:ODEs` |
| B Velocity Units Examples | § 3.2.3 → `app:velocity_units_example`, `subsec:app_redshift_independent_line_separation`, `subsec:app_relative_line_centered_velocity_units` |
| C Approximate Velocity Units in Single-Snapshot Calculations | § 3.2.4 → `app:velocity_units_snapshot_approx` |
