# Ledger of the Lyα forest course

**Next action:** none — UPDATE-2 is done (final full `bash _port/check.sh` on 2026-11-18: ALL CHECKS PASSED; `docs/` rendered and committed). Waiting for the author's preview and `REVIEW.md` (rows 11–15 of the decisions, the § 4.8 passage, 12 new slips); nothing is pushed or merged.

**State of the working tree:** branch `lya-update` (the author's, at `d089a14` of `main`) + the brief `ee4b89d` cherry-picked as `a88a7f8` (a fast-forward to `main` was refused as a merge). Earlier work: branch `course-lya`, merged into `main` by the author.

**Notes directory (UPDATE-2):** clean at `7c1659b` (2026-11-17 21:20, the author's restyle, L37; before it `674da4f`). **Earlier:** `SkewerJAX_Review_and_Equations`, read-only; fingerprint at the start `3ed78561…cfd23` (L7). On 2026-11-16 23:27 the author changed `main.tex` (title page; `\input{sec_summary_statistics}` commented out) and rebuilt `main.pdf`; the scratch build restores that input (L28).

| # | Unit | Status | Checks | Commit |
|---|---|---|---|---|
| L0 | Plan, inventory, decisions, ledger | done | — | 41c965a |
| L1 | Course configuration; converter/scratch build/shell take a course | done | first course: `course_unchanged.py` 150 files identical, `test_converter.py` ALL PASSED, `build.py --status` 81/81 | 08449a0 |
| L2 | Scratch LaTeX build of the Lyα notes | done | 57 pages, 296 records (L12); labels = author's `main.aux`; `pdftotext` = author's PDF; first course `main.port` identical | fd4ec5b |
| L3 | Converter: article structure, cut, appendices, author material, constructs | done | `build.py --course lya-forest` 27/27 pages (+ landing); 16 pages and 71 labels left out (§§ 6–9, D, E); first course unchanged except navbar | fd4ec5b, (this commit) |
| L4 | Math configuration | done | `math_check`: diffgeo 3427 / lya 439 expressions, 0 failures; macros checked against the preamble (L16) | (this commit) |
| L5 | Landing page, accent, cover | done | landing renders (title, subtitle, version, abstract, keywords, contents; no authors); teal accent; spectrum cover; reviewed in L17 (both themes, 1440/390), a11y clean | (this commit) |
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
| L18 | Report, final check, `docs/` | done | full `bash _port/check.sh` on 2026-11-16: ALL CHECKS PASSED (26 checks, both courses and the rest of the site); `REPORT.md` written; `docs/` rendered and committed | (this commit) |
| L19 | Follow-up: cut at the end of § 4, the restored input, both PDFs | done | `build_scratch.sh lya-forest`: § 4 restored, the 138 labels of the author's `main.aux` with the same numbers; `build.py`: 23 pages (+ landing), 19 left out (§§ 5–8, D, E); panels 6, 7 parked; PDFs compressed (27.0 → 6.97 MB, 5.24 → 1.66 MB; pages, outline, links compared); first course unchanged (navbar only); full `bash _port/check.sh`: ALL CHECKS PASSED | 72463b1 (renames only) + the next commit |

## Appendices included (L2)

| Appendix | Pulled in by |
|---|---|
| A Systems of ODEs | § 2.3 → `app:ODEs` |
| B Velocity Units Examples | § 3.2.3 → `app:velocity_units_example`, `subsec:app_redshift_independent_line_separation`, `subsec:app_relative_line_centered_velocity_units` |
| C Approximate Velocity Units in Single-Snapshot Calculations | § 3.2.4 → `app:velocity_units_snapshot_approx` |

## UPDATE-2 (2026-11-17): the revised notes, cut before the metal contamination models

Brief `_port/lya/UPDATE-2.md`. Notes moved to `/home/dlopez/Documentos/0.profesional/Academic/4.Postdoc1/USP/Projects/` (both courses); the Lyα notes are now committed and clean (`674da4f` "improved 2-point stats").

| # | Unit | Status | Checks | Commit |
|---|---|---|---|---|
| U0 | New folder locations in every path of the repo | done | `grep 'Postdoc/USP'` outside `Academic/4.Postdoc1`: none left (CLAUDE.md, KICKOFF.md, go.sh, check.sh, courses.py, build.py, lya BRIEF.md, INVENTORY.md); both directories exist; generated pages and `docs/` carry no notes path | (this commit) |
| U1 | New cut (L29), TikZ figures of a pdfLaTeX course (L30), addresses without formulas (L31), regenerated pages | done | scratch build: 60 pages, 330 records, labels identical to the author's `main.aux`; `build.py --course lya-forest`: 48 pages (+ landing), 9 pages and 38 labels left out (§ 7, D, E); first course rebuilt, `course_unchanged.py`: 150 files, navbar only; `math_check` lya 731 expressions, 0 failures; `fidelity` lya: 0 not allowed, 0 stale (61 new D7 entries, 8 stale removed, 9 TikZ pictures) | (this commit) |
| U1b | A passage naming a co-author left out (L32): end of § 4.8, `courses.py` `omit` | done | no page or index carries it (`grep -i` of the course); `main_text_diff`: only `xi3d/xi-decomposition-l2.html` changes; `fidelity` lya: 0 not allowed, 0 stale | (this commit) |
| U2 | New and changed text read for slips (§ 3.6 end, § 3.7, §§ 4–6, the nine TikZ pictures; port-worker, rows spot-checked) | done | 11 rows added to REVIEW.md; the earlier 6 rows still apply at the same lines | (this commit) |
| U3 | Panels 6 and 7 back from `parked/` on §§ 4.6 and 4.8 (L33); ergodicity gains M sightlines per realization | done | `test_lya_interactives`: 7 panels passed (1440/390, Reset, the recomputing tests); screenshots of both panels reviewed | (this commit) |
| U4 | New panels ranked in PLAN.md; `periodogram` (§ 5.6) and `aliasing` (§ 6.7) built (port-worker, reviewed; L34) | done | `test_lya_interactives`: 9 panels passed; a11y 0 serious on both pages; page_check §§ 5–6 16/16; links 0 broken; screenshots 1280/390 light/dark reviewed | 7a87c49 (plan), (this commit) |
| U6a | Review of every page against the PDF (port-checker: 196 screenshots, 49 pages × 1440/390 × light/dark, scripted checks on all) | done | one defect: ξ in the kicker of § 4 pages, fixed (L36); figures 8–10 small at 390 px have the Zoom control (D10 f) | 330e538 |
| U5 | The Lyα PDF: the author's `main.pdf` (60 pages) compressed (5.43 → 1.92 MB), same address (L35) | done | pages, outline (72), links (304), renders compared; its last section is § 7 Metal contamination, the web ends at § 6 | (this commit) |
| U7 | The author's restyle `7c1659b` (L37): rebuilt from it; title page taught to `cover_lya.py`; text width 16.0 cm (+ guard); new PDF 5.73 → 2.05 MB | done | scratch: 62 pages, labels identical; 48/48 pages; `main_text_diff` 49/49 identical; nine TikZ SVGs recompiled; `math_check` 730, 0 failures; `fidelity` lya 0 not allowed, 0 stale; first course unchanged (150 files); PDF: text identical to scratch, outline 72, links 303 | (this commit) |
| U8 | Second review against the PDF (port-checker: 196 views, all read; 49 pages × 1440/390 × light/dark): one defect, two unlinked references to Eq. 3.29 on § 3.6 (L38), fixed; figures 9–11, 13 small at 390 px have the Zoom control (D10 f) | done | first course unchanged (150 files); `main_text_diff` 49/49; no pending reference left in the course | (this commit) |
| U9 | Final check and `docs/` | done | full `bash _port/check.sh` (2026-11-18): ALL CHECKS PASSED (26 checks, both courses and the rest of the site). Two earlier full runs failed only in `test_page_script`: the expected count of § 3's subsections (7 → 8, fixed `fff1d6e`) and once a 30 s timeout tapping the zoom viewer's close button at 390 px in a first-course step (passed in two separate reruns and in the final run: timing) | (this commit) |

### Existing pages after U1 (the notes' text of `<main>` without the web layer, `main_text_diff.py --course lya-forest`)

- **Text changed (4):** `index.html` (contents: § 3.7 "Product of Total Overfluxes" and § 3.8, §§ 4–6 replace the old § 4); `flux/overflux.html` (§ 3.6 now ends where the author's new heading § 3.7 starts: the product of total overfluxes and its subset-pair representation moved to the new page `flux/product-of-total-overfluxes.html`); `flux/top-down-summary.html` (§ 3.7 → § 3.8); `velocity-units-example/index.html` (Figure 6 → Figure 15).
- **Web layer only (2):** `flux/index.html` (its list of subsections), `odes/index.html` ("previous" now § 6.7).
- **Navigation only (17):** every other existing page (contents tree, progress bar); their notes' text is identical.
- **Removed (1):** `xi-decomposition/index.html` (the old § 4, now § 4.7 `xi3d/xi-decomposition.html`; L29).
- **New (26):** `flux/product-of-total-overfluxes.html`; `xi3d/` (index + 8), `pk3d/` (index + 7), `pk3d-dft/` (index + 7); nine TikZ figures `figures/fig-xi3d-*.svg`, `fig-pk3d-*.svg`, `fig-dft-*.svg`.
