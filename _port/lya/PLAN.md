# Plan of the Lyα forest course

Brief: `_port/lya/BRIEF.md`. Decisions: `_port/lya/DECISIONS.md` (L1…). The first course's documents (`_port/DECISIONS.md`, `DESIGN.md`, `REPORT.md`) describe the converter, the design system and the checks this course reuses.

## What is built

- **Course** `/notes/lya-forest/`: the notes "SkewerJAX: Absorption Lines in Cosmological Sightlines" up to the end of § 5 ξ1D (L1), Appendices A, B, C (L2), no author material (L5), in the "Paper" design with its own accent and cover (L11, unit L8 below).
- **Site**: "Lecture Notes" becomes a dropdown (both courses); the Teaching page loses its "Lecture Notes" section; the OJALÁ paper is "in press" in A&A.

## Page map (L10)

| Page | Source | Address |
|---|---|---|
| Landing | `titlepage`: title, subtitle, version, abstract, keywords; contents | `index.html` |
| § 1 Introduction and Scope | `sec_introduction.tex` | `introduction-and-scope/index.html` |
| § 2 Cosmological Background and Photon Trajectories (opening) + 2.1–2.4 | `sec_cosmology.tex` | `cosmo-background/…` |
| § 3 Transmitted Flux (opening) + 3.1–3.7 | `sec_flux.tex` | `flux/…` |
| § 4 Decomposition of the 2PCF | `subsec_xi1D.tex` l. 1–243 | `xi-decomposition/index.html` |
| § 5 ξ1D (opening) + 5.1–5.3 | `subsec_xi1D.tex` l. 244– | `xi1d/…` |
| Appendix A Systems of ODEs | `app_systems_ODEs.tex` | `odes/index.html` |
| Appendix B Velocity Units Examples (opening) + B.1, B.2 | `app_velocity_units.tex` | `velocity-units-example/…` |
| Appendix C Approximate Velocity Units … (opening) + C.1–C.3 | `app_velocity_units_approx.tex` | `velocity-units-snapshot-approx/…` |

Addresses come from the labels with the prefixes `sec:`, `subsec:`, `subsubsec:`, `app:` dropped (D2), or from the title where a heading has no label. Exact slugs are whatever the converter computes; `build.py --status` lists them.

## Interactive panels (ranked)

The test (KICKOFF): what does a student understand by manipulating this that the static figure cannot show? Ranked by that, after reading the source (the formulas each panel computes are the notes' own; where a figure was made with SkewerJAX, data are exported offline only if needed).

1. **Line profile** (§ 3.3, Figures 3 `fig:voigt_profile` and 4 `fig:line_profile`): Gaussian, Lorentzian and Voigt with σ_j (from T and b_turb) and γ_j (from A_j and collisions) as sliders; the Voigt core is Gaussian and its wings Lorentzian, and which one dominates where is only visible by moving the parameters. Log axis toggle.
2. **Optical depth along a sightline** (§ 3.4, Figure 5 `fig:optical_depth`): a toy density, temperature and peculiar-velocity field along x; τ(Λ) from the notes' optical-depth integral by direct summation; switch peculiar velocities on and off and scale them: the absorption moves and sharpens/broadens (redshift-space distortions along one line).
3. **Transmission and saturation** (§ 3.5): F = e^{-τ} from the same skewer with a scale on τ (or on n): saturation of strong lines, the mean flux F̄ and δ_F = F/F̄ − 1; why the mean flux is not e^{-⟨τ⟩}.
4. **Mapping the observed wavelength to the gas frame** (§ 3.2, Eqs. 3.2–3.4 and the velocity units of 3.2.3–3.2.4): a gas element at x with peculiar velocity v; λ_obs → a(x) → λ' with the Doppler factor; the exact logarithmic velocity unit against the Hubble-flow approximation, and the error of the approximation as the interval grows.
5. **Scale factor along the photon path** (§ 2.3, Figure 1 `fig:a_of_x`): a(x) for the background cosmologies of § 2.3.1 with their analytic solutions overlaid on the numerical integration of da/dx; Ω sliders for a general background.
6. **1D 2PCF and ergodicity** (§ 5.3): per-sightline estimates ξ̂^(s)(Δ) of a toy Gaussian field and their average as sightlines are added, converging to the ensemble ξ(Δ).
7. **Decomposition of the 2PCF for L = 2** (end of § 5.3, the L = 2 decomposition and Tables 3–4): two absorbers' fields; the total ξ and its colour-coded components (the notes' own colours of `\TextZero…\TextFour`), switching each on and off.
8. **Velocity units examples** (Appendix B, Figure 6): two lines in velocity units at different redshifts; redshift-independent line separation.

Build 1–6 at least; 7–8 if they pass the test once 1–6 exist. Exact placement (after which figure or at the end of which (sub)section, D57) is decided per panel when it is built and recorded in `DECISIONS.md`.

## Units

Each unit ends with its checks and a commit; the ledger (`PROGRESS.md`) records it.

| # | Unit | Done when |
|---|---|---|
| L0 | Plan, inventory, decisions, ledger | committed |
| L1 | Course configuration; converter, scratch build, shell take a course | first course byte-identical (`course_unchanged.py`) |
| L2 | Scratch LaTeX build of the Lyα notes with the numbering hooks | builds; labels = author's `main.aux`; text = author's PDF |
| L3 | Converter: article structure, cut, appendices, author material, constructs | `build.py --course lya-forest --strict` converts every page |
| L4 | Math configuration (macros, colour boxes) | `math_check` 0 failures on both courses |
| L5 | Landing page, accent and cover | landing renders; a11y/contrast ok |
| L6 | Navbar dropdown (`_quarto.yml` + replica + behaviour) | `navbar_check` both; hover/click/tap/keyboard tested |
| L7 | Site updates: Teaching page, old PDF removed, OJALÁ in press | `site_unchanged.py` accepts exactly these |
| L8 | Tools and `check.sh` for both courses | full `check.sh` passes |
| L9–L16 | Interactive panels 1–8 | `test_interactives` per panel |
| L17 | Review: every page vs the PDF, desktop/phone, both themes | no defect left a careful reader would notice |
| L18 | `REPORT.md`, final full `check.sh`, `docs/` rendered and committed | ALL CHECKS PASSED; `git status` clean |
