# Report: the Lyα forest notes on the web

## UPDATE-2 (2026-11-17): the revised notes, up to the metal contamination models

Brief `_port/lya/UPDATE-2.md`; branch `lya-update`, committed locally, **not pushed and not merged**. Ledger: `_port/lya/PROGRESS.md` (units U0–U8); decisions L29–L37 in `_port/lya/DECISIONS.md`.

**What changed**
- **Folders (U0).** Every absolute path to the notes now points to `…/0.profesional/Academic/4.Postdoc1/USP/Projects/…` (CLAUDE.md, KICKOFF.md, `go.sh`, `check.sh`, `courses.py`, `build.py`, the Lyα brief and inventory). `check.sh` now expects the branch `lya-update`.
- **Cut (L29).** The web runs from § 1 to the end of § 6 "P3D with the discrete Fourier transform" and stops just before § 7 "Metal contamination" (`sec:metals`, `sec_models.tex`). New on the web: § 3.7 "Product of Total Overfluxes" (your new heading; its text was already online as the end of § 3.6), § 4 ξ3D (4.1–4.8, with the old § 4 decomposition as § 4.7 and the L = 2, 3 particularisation as § 4.8), § 5 P3D (5.1–5.7), § 6 P3D with the DFT (6.1–6.7): 26 new pages, 48 pages + the landing page in all. Appendices A–C as before (D, E are not referred to); nothing points into what is left out, so no "in preparation" marker shows; numbering is the full build's.
- **Where your source and the cut disagree:** your `main.tex` (through `sec_summary_statistics.tex`) inputs § 7 "Metal contamination", so your PDF has it; the web stops before it. No `\endinput`; the only commented-out `\input` is the literature review (after § 7, not on the web either way).
- **A passage left out (L32).** § 4.8 ends with a block headed "FROM ANDREU's notes", one sentence and Eq. (4.21) in another notation. It names a co-author, so (brief "No authors") the converter leaves it out (`courses.py` `omit`, which stops the build if that passage changes). It reads like a working note: see `REVIEW.md`. It was on the branch for one commit (U1, `a9c74e6`) before being removed in U1b; nothing was pushed.
- **Existing pages that changed** (all regenerated from the current source): `index.html` (contents), `flux/overflux.html` (§ 3.6 now ends at your new § 3.7 heading), `flux/top-down-summary.html` (§ 3.7 → § 3.8), `velocity-units-example/index.html` (Figure 6 → Figure 15); web layer only: `flux/index.html`, `odes/index.html`; navigation only: the other 17. Removed: `xi-decomposition/index.html` (the old § 4, now `xi3d/xi-decomposition.html`; no redirect).
- **Your restyle (L37).** You committed a new style (`7c1659b`, Latin Modern, new geometry and title page) while this update was running; everything was rebuilt from it. The web's text is unchanged by it; the TikZ figures now use the notes' new font; the landing page keeps the web's own cover.
- **Converter.** TikZ figures of a pdfLaTeX course (L30: the nine figures of §§ 4–6 are compiled from your source to SVG); addresses of headings that end in a formula leave the formula out (L31: `pk3d/reduction-to-wedges.html`, not `…-p-ij-s-k-1-2`); a formula in a page's kicker keeps its glyphs (L36); the build stops if the text width it is configured with is not the LaTeX build's (L37). The first course is byte-identical (navbar only, as before).
- **Panels (L33, L34).** The two parked panels are back where their ideas now live: *ergodicity* after Eq. (4.14) in § 4.6, with a new control for the number of sightlines per realization (the revised § 4.4 defines the per-sample 1D 2PCF as an average over sightlines, and § 4.6 ties ergodicity to the size of the domain); *decomposition* after Eq. (4.20) in § 4.8 (the same equation). Two new panels for the two-point-statistics chapters, ranked in `PLAN.md`: *periodogram* (§ 5.6, after Eq. (5.21): the Fejér window smooths a spectrum's features over 2π/L_Λ; one periodogram scatters by ~100 % whatever L_Λ; only averaging converges) and *aliasing* (§ 6.7, after Figure 14: the copies P(k + 2c k_Ny) and their sum as the pixel size changes, with and without the pixel window). The third candidate (circular vs zero-padded correlation, § 6.3) was not built: it would repeat the periodogram panel. Nine panels in all, each with a test that recomputes what it shows.
- **PDF (L35, L37).** Your `main.pdf` of 21:18 (62 pages), compressed with the same Ghostscript settings (5.73 → 2.05 MB), at the same address `assets/files/docs/absorption_lines_in_cosmological_sightlines.pdf`; pages, outline and links checked, contents not reviewed. **Its last main-text section is § 7 "Metal contamination", not § 6 where the web course ends.**

**Waiting for you in `REVIEW.md`:** the passage of § 4.8 left out; 12 new slips found in the new and changed text (e.g. a `\label` in an unnumbered equation that makes "Eq. 3.29" point to it, "average over the direction φ" where Eq. (4.5) integrates, a sign in the n = 1 display of § 3.7, "truncated up to order-2" with Ξ^(n) for n ≥ 3, the L = 3 expression announced but not given, N used both as total and per-axis count in § 6); the earlier 6 still apply; the words of the four new or changed panels.

**What to preview:** `quarto preview`, then `/notes/lya-forest/` — the contents; § 3.7 (`flux/product-of-total-overfluxes.html`); § 4 (`xi3d/`), especially 4.6 (ergodicity panel) and 4.8 (tables, decomposition panel, the end without the left-out passage); § 5.2 (Figure 10) and 5.6 (periodogram panel); § 6.3 (Figure 13) and 6.7 (Figure 14 and the aliasing panel); the "Download PDF" button on the landing page.

**To publish** (after your preview): `git checkout main && git merge lya-update && git push` (GitHub Pages serves `docs/` from `main`). Nothing has been pushed or merged.

---

The rest of this report describes the first version (branch `course-lya`, 2026-11-16) and how to rebuild; it still applies, except where the section above says otherwise.


Your notes "SkewerJAX: Absorption Lines in Cosmological Sightlines" are now a second course section of the site, at `/notes/lya-forest/`, built by the same converter and design system as *From Differential Geometry to General Relativity* and looking like its sibling, in teal instead of navy. Everything is on the branch `course-lya`, committed locally, **not pushed and not merged**.

The ledger with every unit and its checks is `_port/lya/PROGRESS.md`; the reasons for every choice are in `_port/lya/DECISIONS.md` (L1–L…); what waits for you is in `_port/lya/REVIEW.md`.

## 1. What was built

**The course** (`notes/lya-forest/`, 28 pages): the landing page and 27 pages generated from the LaTeX, one per `\section` opening and one per `\subsection` (L10), with the notes' text, equations, numbers, figures and tables exactly as in the PDF: § 1 Introduction and Scope; § 2 Cosmological Background and Photon Trajectories (2.1–2.4); § 3 Transmitted Flux (3.1–3.7); § 4 Decomposition of the 2PCF; § 5 ξ1D (5.1–5.3); Appendices A, B (B.1, B.2) and C (C.1–C.3). Same components as the first course: sidenotes, previews of every reference, appendix items openable in place, search, read marks, chapter opening pages with the computed lists of sections and related appendix items, "Copy LaTeX", light and dark themes. New for these notes: numbered table floats with coloured cells, `\multicolumn`/`\multirow` (L13), colour boxes and xcolor colours inside formulas that follow the dark theme (L16), an accent and a cover of its own (L14, L18).

**Interactive panels** (L20, L25): seven, each next to the idea it serves, with the static figure always there and a link to the SkewerJAX notebook on the topic:
1. *Line profile* (after Figure 4): Gaussian, Lorentzian and Voigt for Lyα, Lyβ, Si III, driven by T, b_turb and the collisional damping; where the wings turn Lorentzian.
2. *Optical depth along a sightline* (after Figure 5): a toy gas along 40 Mpc at z ≈ 2.4 and its τ(v_†) from Eq. (3.20); scaling the peculiar velocities moves and reshapes the absorption, against the at-rest τ.
3. *Transmission, mean transmission and overflux* (after Eq. (3.26)): saturation as the density grows, T̄ as an ensemble mean at each Λ, ⟨δ_j⟩_ens = 0 while one sightline's mean δ_j is not 0, T̄ ≠ e^{−⟨τ⟩}.
4. *Exact and single-snapshot velocity units* (end of § 3.2.4): u_exact against u_H across a box; the difference grows as L_box², compared with the thermal width of Lyα.
5. *Scale factor along the photon path* (after Figure 1): a(x) for any Ω_r, Ω_m, Ω_Λ (Ω_k follows) over Figure 1's four backgrounds and the analytic solutions; where each ray ends and why.
6. *Ergodicity* (after Eq. (5.9)): per-sightline ξ̂^(s) and their average converging to ξ as sightlines are added and the interval grows.
7. *Decomposition for L = 2* (after Eq. (5.10)): Lyα and Si III 1206 in the same gas; the terms of Eq. (5.10) in the notes' colours, the cross term's peak at c ln(λ_1/λ_2).

The gas of panels 2, 3 and 7 is a stated toy (L25); everything from the gas to the plotted quantity is the notes' formulas. Appendix B's Figure 6 got no panel (L25: nothing there moves except a constant). Every panel has a test that recomputes what it shows from the notes' formulas (`_port/lya/tests/`).

**The converter now serves both courses** (L9): `_port/convert/courses.py` holds what differs between the two notes; the first course's generated pages are byte-identical to `main` except for the navbar (checked by `_port/tools/course_unchanged.py`, part of `check.sh`).

**Site updates** (L15, L19): "Lecture Notes" is a dropdown with both courses (hover, click, tap and keyboard focus, on the Quarto pages and on the course pages alike); the Teaching page has no "Lecture Notes" section any more and its graduate-course card reads Read online · Download PDF · GitHub; the old Lyα PDF and thumbnail are deleted; the OJALÁ card says "*Astronomy & Astrophysics*, in press (accepted 12 November 2026)" with the accepted title.

## 2. Where the web differs from the source, and why

- **Truncation (L1).** The web stops after § 5 ξ1D. Your brief named "Decomposition of the (total 1D) 2PCF" (§ 4.1.4 of the May build); since then that material has been split between the new § 4 "Decomposition of the 2PCF" and the end of § 5.3, so the cut is after § 5, before § 6 ξ3D. One value (`last` in `courses.py`) moves it.
- **Appendices (L2).** A, B and C, because the converted part refers to them (§ 2.3 → A, § 3.2.3–3.2.4 → B, C); D and E are left out. The letters are the full build's.
- **No author material (L5).** No names, affiliations, e-mail or running header; no byline. The converted part contains no acknowledgement and names no co-author.
- **Status words (L6).** "Review notes / working draft" is shown under the subtitle as on your title page; `\today` became "Last updated <date of the last commit touching the converted files>".
- **No bibliography (L4)**: nothing in the converted part cites.
- **References to what was cut** would show the "in preparation" marker (L3); there are none today.
- Presentation choices inherited from the first course (D-decisions): pages per section, sidenotes, figures on paper cards, underlined references. Display equations wider than the column (a few in § 3.6 and § 4, more on a phone) are set slightly smaller and then scroll sideways in their own box with a shaded edge (D27, D45); the PDF prints them whole.
- **Web-only behaviour added for these notes**: references to Appendices A–C open the appendix page in place ("open here", L23); read marks are kept per course (L24); TeX quotes inside two formulas of Eq. (4.1) are shown as the PDF's curly quotes (L27).

## 3. What waits for you in `REVIEW.md`

- **Decisions taken for you** (8 rows): the cut after § 5 (L1), appendices A–C, no bibliography, "working draft" kept, the Teaching card's "Download PDF" label, the deleted old Lyα PDF and thumbnail (how to restore them), the first course's thumbnail no longer shown, and your CV PDF still listing OJALÁ as a preprint (not edited).
- **Author material left out**: the four title-page items and the running header, by macro.
- **Typos and slips** (6 rows): "the remaining of" ×2, a capital "Limiting", equation references written with `\ref` (no parentheses) and appendix references without "Appendix", and Figure 1's caption mentioning a Λ analytic solution the text does not give. None is corrected on the web (rule 1).
- **Words written for the web layer**: every interface word, the landing page's buttons, and each panel's instruction, labels and screen-reader names, with the toy model of panels 2, 3 and 7 (L25).

## 4. How to rebuild after editing the LaTeX

From the repository root:
```bash
_port/build.sh --site     # scratch builds of both notes (pdfLaTeX ~25 s for these, XeLaTeX ~4 min for the first), converter, full quarto render
bash _port/check.sh       # every check, both courses and the rest of the site; ends with ALL CHECKS PASSED or the list of failures
```
Only these notes: `_port/tex/build_scratch.sh lya-forest && python3 _port/convert/build.py --course lya-forest`, then `_port/build.sh --no-tex` (copies both courses into `docs/` and updates the search index and sitemap). The notes directory is only read (`NOTES_LYA=` overrides its path); the scratch build lives in `_port/.work/lya/`. A construct the converter does not know stops its page with `file:line` (`python3 _port/convert/build.py --course lya-forest --status`). If you include more of the notes, change `last` in `_port/convert/courses.py`; appendices then follow automatically from the references.

## 5. How to preview

```bash
quarto preview            # then open http://localhost:<port>/notes/lya-forest/
```
or `python3 -m http.server -d docs 8000` and open `http://localhost:8000/notes/lya-forest/` (and `/notes/diffgeo-gr/` for the first course with its new navbar, `/teaching_and_projects.html`, `/research_and_publications.html`).

## 6. How to publish

Nothing is pushed or merged. The branch `course-lya` holds the whole job, with the rendered site committed in `docs/` (D28). The last full `bash _port/check.sh` printed ALL CHECKS PASSED. It covers both courses and the rest of the site against `main`. When you are happy with the preview:
```bash
git checkout main && git merge course-lya && git push      # GitHub Pages serves docs/ from main
```
If you edit the notes first, rebuild (§ 4) and run `bash _port/check.sh` again before merging. One check of `check.sh` needs internet access, because the pages load MathJax and Lato from their CDNs; a network outage shows up as `page_check` and interactive failures, not as a defect of the pages.
