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
| 9 | (2026-11-16, superseding row 1) The web version ends with § 4 "Decomposition of the 2PCF"; § 5 and everything after it is not published, nor panels 6 and 7 (kept in `_port/lya/parked/`). Your `main.tex` now comments out `\input{sec_summary_statistics}`, so your PDF ends at § 3; the scratch build restores that one input so that § 4 exists with its number (you chose this). | L28 |
| 10 | The Lyα PDF is your current build, compressed, at the old Lyα PDF's address (`assets/files/docs/absorption_lines_in_cosmological_sightlines.pdf`); the landing page's button reads "Download PDF", as the first course's. The differential-geometry PDF is your `main.pdf` (created 2026-10-15), compressed, in place. | L28 |
| 11 | (UPDATE-2, 2026-11-17) The web ends with § 6 "P3D with the discrete Fourier transform", just before § 7 "Metal contamination"; your `main.tex` inputs § 7, so your PDF has it and the web does not. Appendices A–C as before. | L29 |
| 12 | The old § 4 page `xi-decomposition/index.html` is gone (its heading is now § 4.7, `xi3d/xi-decomposition.html`); no redirect page. | L29 |
| 13 | The passage at the end of § 4.8 that names a co-author is left out of the web (see "Author material left out"). | L32 |
| 14 | The ergodicity panel gained a third control (sightlines per realization), to follow the revised § 4.4/4.6; two new panels (§ 5.6 periodogram, § 6.7 aliasing); a third candidate (§ 6.3) not built. | L33, L34 |
| 15 | The Lyα PDF is your restyled build of 2026-11-17 21:18 (62 pages), compressed, same address. Its last section is § 7. | L35, L37 |

## Author material left out (brief: "No authors")

| Source | What | Where it would have appeared |
|---|---|---|
| `main.tex` `\noteauthors` | the five author names with ORCID links and affiliation marks | title page → landing page |
| `main.tex` `\noteaffiliationone`–`three` | the three affiliations | title page |
| `main.tex` `\noteemails` | the contact e-mail | title page |
| `main.tex` `\fancyhead[R]` | "López-Cano et al." running header | every page (the web has no running header) |
| `sec_xi.tex:862–875` (end of § 4.8; UPDATE-2, L32) | a pasted passage headed "FROM ANDREU's notes" (a co-author's first name), its sentence ("From now on, for simplicity, we ignore the redshift evolution of the mean fluxes, …") and its equation, Eq. (4.21) in your PDF, in another notation (ξ_T, Δθ, ξ_α, ξ_X, C_αX) | § 4.8, after Table 4 (left out with its equation number; it is the last equation of § 4, so no gap shows) |

No acknowledgement and no passage naming a co-author exists in the converted part (§§ 1–5, Appendices A–C), nor anywhere in the notes. *UPDATE-2 (2026-11-17):* the new § 4.8 ends with the passage above, the only one that names a co-author in the converted part (§§ 1–6, Appendices A–C; checked by searching for the co-authors' names, "acknowledg", "thank"); the literature review cites co-authors' papers but is not published. Is that passage meant to stay in your notes at all? It reads like a working note.

## Typos and slips found in the notes

| Where | What |
|---|---|
| `sec_flux.tex:21` (§ 3, opening) | "For the remaining of this section" — probably "For the remainder of this section". |
| `sec_flux.tex:507` (§ 3.6) | "In the remaining of this subsection" — probably "In the remainder of this subsection". |
| `sec_cosmology.tex:116` (§ 2.3.1) | "In simple Limiting cases" — capital L. |
| `sec_cosmology.tex:108, 116, 130`; `sec_flux.tex:49, 86, 183, 667, 785–787` | Equations referred to with `\ref` instead of `\eqref` print without parentheses ("Eq. 2.5", "Equation 2.5", "Eq. 3.5", …) while most references print "Eq. (2.3)". The web prints them as the PDF does. |
| `sec_flux.tex:157, 195, 199, 286` | `see~\ref{subsec:app_…}` / `on~\ref{…}` print a bare number ("see B.1", "proof on B.1", "see 3.2") with no "Appendix"/"Sec." before it. |
| `sec_cosmology.tex:108` (Figure 1 caption) | The caption mentions analytic (dashed) curves for the radiation-, matter- and Λ-dominated cases; § 2.3.1 gives the analytic solutions for matter and radiation only (the Λ one, a = 1/(1 − H0 x/c), is not written in the converted part). |
| `sec_flux.tex:631, 650` (§ 3.6) | The `align` of the total overflux (`\label{eq:total_overflux_compact}`) has one row with `\notag` in its middle, so it prints no number, yet its label reads 3.29 (amsmath steps the counter first): "Eq. 3.29" (twice, §§ 3.6) points to this unnumbered equation while the printed (3.29) is the next one. Probably drop the `\notag` (or move the label). The web links where the PDF does (L38). |
| `sec_flux.tex:822, 836` (end of § 3.6; UPDATE-2) | "Where we have defined:" starts with a capital although it continues the sentence of Eq. (3.32), and the display of definitions ends with a comma ("1\le p\le L,") right before the new heading § 3.7 — probably "where", and a full stop. |
| `sec_flux.tex:880–890` (§ 3.7) | The display for n = 1 writes "\sum_{p=0}^{1} -\mathcal S_p\,-\mathcal S_{n-p}" and gives "+\mathcal C\,\mathcal S_1+\mathcal S_1\,\mathcal C"; with \mathcal S_0 = −\mathcal C the sum is −\mathcal C\,\mathcal S_1 − \mathcal S_1\,\mathcal C (as order 1 is written in Eq. (3.34)), and its condition "1\le n\le L" belongs to the general case, not to n = 1. |
| `sec_flux.tex:994–1000` (§ 3.7.1) | The example "23/123" writes both points at \vec x_\perp, while the product tabulated is at \vec x_{\perp\alpha} and \vec x_{\perp\beta} — probably \vec x_{\perp\alpha}, \vec x_{\perp\beta}. |
| `sec_xi.tex:115` (§ 4.2) | "and average over the direction φ", but Eq. (4.5) is the integral over φ with no 1/(2π) (consistent with l. 301, ξ̂(r_⊥ = 0, Δ) = 2π ξ̂(Δ), and § 6.4, "the unnormalized angular integral") — probably "integrate over the direction". |
| `sec_xi.tex:124, 354, 564` (§§ 4.2, 4.5, 4.7) | Eqs. (4.5), (4.13) and (4.17) end with a comma and the next sentence starts with a capital — probably a full stop. |
| `sec_xi.tex:569, 596` (§ 4.7) | "the total 2PCF truncated up to order-2", yet Eq. (4.18) keeps \sum_{n=3}^{L}\Xi^{(n)}, with \Xi^{(n)} defined only for n = 2 (Eq. (4.17)) and the sum stopping at L although Eq. (4.16) has orders up to 2L — probably "+…", or the upper limit 2L. |
| `sec_xi.tex:676` (§ 4.8) | "can be obtained by using Table 1" (the overflux table) introduces Table 3, which no sentence refers to — possibly meant to name Table 3 as well. |
| `sec_xi.tex:699` (§ 4.8, Table 3) | One cell prints "−\mathcal C_{12}\,\mathcal C" with a calligraphic C₁₂; the mirror cell (l. 718), Eq. (4.20) and Table 4 use the italic C₁₂. |
| `sec_xi.tex:731` (§ 4.8) | "we can also obtain the analogous expression for the L = 3 case using Table 2, …:" — no L = 3 expression follows (only Table 4, and then the passage left out of the web, L32). |
| `sec_Pk.tex:155` (§ 5.3) | "the LOS flip": the abbreviation LOS is used only here and never defined; elsewhere "line-of-sight flip". |
| `sec_Pk_DFT.tex:47, 92` (§§ 6.1, 6.2) | N is defined at l. 29 as the total number of cells (N ≡ N_⊥²N_Λ), but the caption of Figure 12 ("for N = 8") and l. 92 ("Nyquist index −N/2 … modulo N") use N per axis — probably N_⊥ / N_Λ. |

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
| Panel `ergodicity` (after Eq. (4.14), § 4.6; UPDATE-2, L33) | instruction "Change the number of realizations N, the number of sightlines M of each realization and the length L_Λ of the interval."; screen-reader names "N", "M", "L Λ", "One sightline of realization 1, δ⁽¹⁾(Λ) on [Λa, Λb]", "Estimates ξ̂⁽ˢ⁾(Δ), their average ξ̂(Δ) and the ensemble ξ(Δ)"; the toy field ξ(Δ) = exp(−Δ²/2), with independent sightlines (no transverse correlation) |
| Panel `decomposition` (after Eq. (4.20), § 4.8) | instruction "Change the density of the second absorber (Si III, relative to H I) and show or hide the terms of each order."; toggles "order 0", "order 2", "order 3", "order 4"; screen-reader names "log10 of the density ratio", "Total 1D 2PCF and the terms of its L = 2 decomposition against the lag"; the toy (L25) |
| Panel `periodogram` (after Eq. (5.21), § 5.6; UPDATE-2, L34) | instruction "Change the length L_Λ of the interval and the number of realizations N."; toggle "log scale"; legend "P̂^(1)(k_∥)", "P̂(k_∥), average of N", "⟨P̂^(s)(k_∥)⟩_ens", "P(k_∥)"; readouts "2π/L_Λ =", "rms_k∥(P̂^(1)/⟨P̂^(s)⟩_ens − 1) =", "rms_k∥(P̂/⟨P̂^(s)⟩_ens − 1) =", "N^−1/2 ="; axis "log₁₀"; screen-reader names "N", "L Λ", "The sightline of realization 1, δ⁽¹⁾(Λ) on [Λa, Λb]", "Periodograms at the modes, their average, the expected periodogram and the true power spectrum against k∥"; the toy field (L34) |
| Panel `aliasing` (after Figure 14, § 6.7; UPDATE-2, L34) | instruction "Change the pixel size d and switch the pixel average on or off."; toggle "pixel average, W_pix = sinc(kd/2)"; legend "P(k) = e^{−k²/k_c²}/(1 + 4k²/k_c²)", "P(k + 2ck_Ny), c = ±1, ±2, ±3" (with the pixel average "(P|W_pix|²)(k + 2ck_Ny), …"), "P^alias = Σ_c P(k + 2ck_Ny)", "P^alias_pix = Σ_c (P|W_pix|²)(k + 2ck_Ny)" (a symbol of the panel, not of the notes); readouts "k_Ny/k_c = π/(k_c d) =", "[(P^alias − P)/P]_{k_Ny/2} =", "[P^alias_pix/(P|W_pix|²) − 1]_{k_Ny/2} =", "[P^alias_pix/P]_{k_Ny/2} =", "< 0.01 %"; axes "log₁₀(k/k_c)", "log₁₀ P", "k_Ny", "k_Ny/2"; screen-reader names "k c times d", "pixel average", "The power spectrum, its copies shifted by multiples of 2 k_Ny and their sum on 0 < k ≤ k_Ny, log scales" |
