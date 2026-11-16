# Ledger of the Lyα forest course

**Next action:** L6 (navbar dropdown, done before L3's end because the course pages need their navbar entry), then finish L3: full `build.py --course lya-forest`, look at every page, commit `notes/lya-forest/`.

**State of the working tree:** clean after each commit; branch `course-lya` (from `main` at `f6bd3ae` + the brief `0bd14e0`).

**Notes directory:** `SkewerJAX_Review_and_Equations`, read-only; fingerprint at the start `3ed78561…cfd23` (L7).

| # | Unit | Status | Checks | Commit |
|---|---|---|---|---|
| L0 | Plan, inventory, decisions, ledger | done | — | 41c965a |
| L1 | Course configuration; converter/scratch build/shell take a course | done | first course: `course_unchanged.py` 150 files identical, `test_converter.py` ALL PASSED, `build.py --status` 81/81 | 08449a0 |
| L2 | Scratch LaTeX build of the Lyα notes | done | 57 pages, 296 records (L12); labels = author's `main.aux`; `pdftotext` = author's PDF; first course `main.port` identical | (this commit) |
| L3 | Converter: article structure, cut, appendices, author material, constructs | in progress | `--status` 27/27 pages; first course unchanged | (this commit: part 1) |
| L4 | Math configuration | todo | | |
| L5 | Landing page, accent, cover | todo | | |
| L6 | Navbar dropdown | todo | | |
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
