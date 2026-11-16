# Ledger of the Lyα forest course

**Next action:** L18 — final full `bash _port/check.sh` (needs internet: CDNs), then commit `docs/` (D28) and the ledger; `git status` clean.

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
| L7 | Site updates (Teaching, old PDF, OJALÁ) | done | full `quarto render`; `site_unchanged.py` passes with exactly these changes (L19), fails on others | (this commit) |
| L8 | Tools and `check.sh` for both courses | done | `check.sh` covers both courses (L22); "open here" for the Lyα appendices (L23), read marks per course (L24); `test_page_script` Lyα block; first course unchanged except navbar | (this commit) |
| L9 | Panel 1: line profile | done | `test_lya_interactives`: lineprofile passes at 1440/390 (controls driven through their labels) | 5577944, 06d9c87 |
| L10 | Panel 2: optical depth along a sightline | done | `opticaldepth` (after Figure 5) + `skewer.js` (L25); test recomputes τ of Eq. (3.20) cell by cell | (this commit) |
| L11 | Panel 3: transmission and saturation | done | `transmission` (after Eq. (3.26), L21): T, T̄ at each Λ, δ_j, ⟨δ_j⟩_ens = 0 vs the sightline mean; test recomputes from τ | (this commit) |
| L12 | Panel 4: observed wavelength → gas frame | done | `velocityunits` (end of § 3.2.4, L26): u_exact vs u_H across a box, the L² drift against b_th; `ray.js`; test with its own RK4 | (this commit) |
| L13 | Panel 5: scale factor along the photon path | done | `scalefactor` (after Figure 1): any Ω mix over Figure 1's backgrounds and analytic solutions; test checks −2c/H0, −c/H0, +c/H0 and the closed case | (this commit) |
| L14 | Panel 6: 1D 2PCF and ergodicity | done | `ergodicity` (after Eq. (5.9), L21): ξ̂^(s), their average, ξ; test recomputes Eqs. (5.2), (5.9) and the 1/√N and L_Λ trends | (this commit) |
| L15 | Panel 7: 2PCF decomposition (L = 2) | done | `decomposition` + `decompstats.js` (after Eq. (5.10), L21): Lyα + Si III in one gas, the terms of Eq. (5.10) in the notes' colours; test recomputes them and the total | (this commit) |
| L16 | Panel 8: velocity units examples | done (not built) | L25: Figure 6 is a schematic and Appendix B's results are constants; its B.2 shift is used and shown by panel 7. Seven panels | (this commit) |
| L17 | Page-by-page review against the PDF | done | 112 screenshots (28 pages × 1440/390 × light/dark) against the PDF pages (port-checker, reviewed); fixed: TeX quotes in Eq. (4.1) (L27), the ξ legend swatch of panel 7 in dark; wide displays scroll by design (D27/D45); 6 slips logged in REVIEW.md | 75a0888, (this commit) |
| L18 | Report, final check, `docs/` | todo | | |

## Appendices included (L2)

| Appendix | Pulled in by |
|---|---|
| A Systems of ODEs | § 2.3 → `app:ODEs` |
| B Velocity Units Examples | § 3.2.3 → `app:velocity_units_example`, `subsec:app_redshift_independent_line_separation`, `subsec:app_relative_line_centered_velocity_units` |
| C Approximate Velocity Units in Single-Snapshot Calculations | § 3.2.4 → `app:velocity_units_snapshot_approx` |
