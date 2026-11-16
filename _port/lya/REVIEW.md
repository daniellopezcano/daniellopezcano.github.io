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
| `sec_flux.tex:21` (§ 3, opening) | "For the remaining of this section" — probably "For the remainder of this section". |
| `sec_flux.tex:507` (§ 3.6) | "In the remaining of this subsection" — probably "In the remainder of this subsection". |
| `sec_cosmology.tex:116` (§ 2.3.1) | "In simple Limiting cases" — capital L. |
| `sec_cosmology.tex:108, 116, 130`; `sec_flux.tex:49, 86, 183, 667, 785–787` | Equations referred to with `\ref` instead of `\eqref` print without parentheses ("Eq. 2.5", "Equation 2.5", "Eq. 3.5", …) while most references print "Eq. (2.3)". The web prints them as the PDF does. |
| `sec_flux.tex:157, 195, 199, 286` | `see~\ref{subsec:app_…}` / `on~\ref{…}` print a bare number ("see B.1", "proof on B.1", "see 3.2") with no "Appendix"/"Sec." before it. |
| `sec_cosmology.tex:108` (Figure 1 caption) | The caption mentions analytic (dashed) curves for the radiation-, matter- and Λ-dominated cases; § 2.3.1 gives the analytic solutions for matter and radiation only (the Λ one, a = 1/(1 − H0 x/c), is not written in the converted part). |

## Words written for the web layer

| Where | Words |
|---|---|
| Every page (shared with the first course) | the interface words of the page shell, the panels' frame and footer, previews and search, as listed in `_port/REVIEW.md` (Contents, Search, Mark as read, Interactive, Reset, Notebook, …); this course has no "Map" (it has no roadmap) |
| Navbar (both courses and the Quarto pages) | "Lyman-α Forest" (your wording, from the brief); the menu "Lecture Notes" keeps its name |
| Landing page | "Start reading", "SkewerJAX" (button to github.com/daniellopezcano/SkewerJAX), "Last updated <date>" |
| Landing page cover | a decorative transmitted-flux spectrum (no words; aria-hidden) |
| Panel `lineprofile` (after Figure 4) | instruction "Choose a transition and change the temperature, the turbulent broadening and the collisional damping."; toggle "log scale"; units "km/s", "GHz", "MHz", "kHz", "[Å]", "[ns]"; screen-reader names "Lyman-α", "Lyman-β", "Si III 1206", "log10 T", "b turb", "log10(1 + A coll / A j)", "Line profile φ_ij against λ′ − λ_j" |
| Panel `opticaldepth` (after Figure 5) | instruction "Scale the peculiar velocities of the gas, change its temperature and turbulent broadening, and compare the optical depth with the one the gas would give at rest (dashed)."; units "km/s"; the toy gas (L25); screen-reader names "Lyman-α", "Lyman-β", "peculiar velocity scale", "log10 T0", "b turb", "Toy gas: log10 of n_com / n̄ against c ln(a_f / a(x))", "Toy gas: peculiar velocity v along the sightline", "Optical depth τ(v_†) with the peculiar velocities and at rest" |
| Panel `transmission` (after Eq. (3.26), δ_j) | instruction "Change the density scale n̄ of the absorbers and choose one of the first sightlines; the mean transmission is the average over all the sightlines at each v_†."; "on" in the readout "T_j^(s) < 0.05 on …"; screen-reader names "log10 n bar", "sightline", "Transmission of one sightline and the mean transmission", "Overflux of the sightline" |
| Panel `velocityunits` (end of § 3.2.4) | instruction "Change the redshift of the snapshot and the comoving length of the box along the line of sight."; readout "… km/s = … b_th"; legend "±b_th (Lyα, 10⁴ K)"; screen-reader names "z box", "L box", "Exact and single-snapshot velocity coordinates across the box", "Difference of the two coordinates, with the thermal width of Lyman-α at 10^4 K" |
| Panel `scalefactor` (after Figure 1) | instruction "Set the density parameters of the background; Ω_k follows from them. The thin curves are the backgrounds of the figure, solid numerical and dashed analytic."; toggle "backgrounds of the figure"; legend "this background", "radiation", "matter", "Λ", "Planck 2018"; readouts "past end:", "future end:", "a = 0 at … Mpc", "a → ∞ at … Mpc", "1 − κx² = 0 at … Mpc", "beyond … Mpc"; screen-reader names "Omega m", "Omega Lambda", "log10 Omega r", "Scale factor a(x) along the ray, log scale" |
| Panel `ergodicity` (after Eq. (5.9)) | instruction "Change the number of realizations N and the length L_Λ of the interval."; screen-reader names "N", "L Λ", "One realization δ⁽¹⁾(Λ) on [Λa, Λb]", "Estimates ξ̂⁽ˢ⁾(Δ), their average ξ̂(Δ) and the ensemble ξ(Δ)"; the toy field ξ(Δ) = exp(−Δ²/2) |
| Panel `decomposition` (after Eq. (5.10)) | instruction "Change the density of the second absorber (Si III, relative to H I) and show or hide the terms of each order."; toggles "order 0", "order 2", "order 3", "order 4"; screen-reader names "log10 of the density ratio", "Total 1D 2PCF and the terms of its L = 2 decomposition against the lag"; the toy (L25) |
