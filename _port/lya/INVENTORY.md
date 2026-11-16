# Inventory of the Lyα notes (source of 2026-11-16)

Notes directory: `/home/dlopez/Documentos/0.profesional/Postdoc/USP/Projects/SkewerJAX_Review_and_Equations` (read-only; L7). Last commit `981c2a6` (2026-11-12); uncommitted edit of `subsec_xi3D.tex` and the author's build products present (L7). Author's `main.pdf`: pdfTeX, 57 pages (L8).

## Document

`article` 11 pt, A4, 1 in margins; `newtxtext`/`newtxmath` (Times-like text and math; pdfLaTeX); `titlesec` (`\section` "N.", `\subsection` "N.M", `\subsubsection` "N.M.K"); `\parindent 0`, `\parskip 0.5em`; `\numberwithin{equation}{section}`; figures and tables numbered globally; footnotes numbered globally; `appendix` package (`\begin{appendices}` … `\end{appendices}`, letters A–E); `natbib` author–year + `aas_macros` + `aasjournal.bst`; `hyperref` + `cleveref` (`\cref` not used in the converted part); `tcolorbox` loaded (not used in the converted part); `fancyhdr` running header "SkewerJAX: Absorption Lines in Cosmological Sightlines | López-Cano et al." (L5).

## Files and what is converted (L1, L2)

| File | Lines | Content | Converted |
|---|---|---|---|
| `main.tex` | 245 | preamble, macros, `titlepage` (title, subtitle, authors, affiliations, version, date, e-mail, abstract, keywords), ToC, `\input`s | landing page only: title, subtitle, version, abstract, keywords (L5, L6) |
| `sec_introduction.tex` | 25 | § 1 Introduction and Scope | yes |
| `sec_cosmology.tex` | 146 | § 2 (2.1–2.4, 2.3.1), Figure 1, 7 equation environments | yes |
| `sec_flux.tex` | 1492 | § 3 (3.1–3.7), Figures 2–5, Tables 1–2, 56 equation environments, 1 footnote | yes |
| `sec_summary_statistics.tex` | 15 | `\input` of the next four (no heading of its own) | the wrapper only |
| `subsec_xi1D.tex` | 660 | § 4 Decomposition of the 2PCF; § 5 ξ1D (5.1–5.3), Tables 3–4, 1 footnote | yes |
| `subsec_xi3D.tex` | 341 | § 6 ξ3D | no (L1) |
| `subsec_P1D.tex` | 537 | § 7 P1D | no (L1) |
| `subsec_models.tex` | 755 | § 8 Metal contamination | no (L1) |
| `sec_literature_review.tex` | 302 | § 9 Literature Review (longtable, 42 citations) | no (L1) |
| `app_systems_ODEs.tex` | 37 | Appendix A | yes (L2: § 2.3 refers to it) |
| `app_velocity_units.tex` | 199 | Appendix B (B.1, B.2), Figure 6 | yes (L2: § 3.2.3) |
| `app_velocity_units_approx.tex` | 263 | Appendix C (C.1–C.3) | yes (L2: § 3.2.4) |
| `app_analytical_solutions.tex` | 266 | Appendix D (Figures 7–8) | no (L2: not referred to) |
| `app_numerical_resolution.tex` | 187 | Appendix E | no (L2: not referred to) |
| bibliography (`main.bib`, `aasjournal`) | | | no (L4: nothing cited in the converted part) |

## Numbered objects in the converted part (from the author's `main.aux`)

- Sections 1–5 with subsections 2.1–2.4, 3.1–3.7, 5.1–5.3; subsubsections 2.3.1, 3.1.1–3.1.3, 3.2.1–3.2.4; Appendices A, B (B.1, B.2), C (C.1–C.3).
- Figures 1 (`fig:a_of_x`, PDF), 2 (no label, `example_fields.png`), 3 (`fig:voigt_profile`), 4 (`fig:line_profile`), 5 (`fig:optical_depth`, a 3.7 MB PNG), 6 (`fig:velocity_units_schematic`). All `\includegraphics` of files in `figures/` (no TikZ). Figures 7–8 are in Appendix D (not converted).
- Tables 1–4 (`table` floats with `\caption` and `\label`): subset pairings for L = 2 and L = 3 (§ 3.6) and their ensemble versions (§ 5.3). `tabular` with `|` rules, `\multicolumn`, `\multirow`, `\cellcolor` through the macros `\TotZero`…`\TotSix`, `\renewcommand{\arraystretch}`, `\setlength{\tabcolsep}`.
- Equations: numbered per section (`(3.28)`), ~120 environments (`equation`, `align`, `align*`); many `\notag` rows, `\underbrace` with coloured labels, `\cancelto`, `bmatrix`.
- Footnotes: 2 (§ 3.2.2, § 5.1).
- `\paragraph{…}` run-in headings: "Remark on the mean flux model." (§ 3.6), "Autocorrelation and symmetry." (§ 5.1).

## Macros (preamble)

Math: `\e` `\dd` `\cc` `\Hzero` `\Orad` `\Om` `\Ok` `\Ol` `\Dop`; colour boxes in math `\TextZero`…`\TextSix` (`\colorbox{<c>!22}{$\displaystyle #1$}`); table cell colours `\TotZero`…`\TotSix` (`\cellcolor{<c>!22}{#1}`); `\Ntick` `\Ttick` `\Ftick` (`\ding{51}` ticks, literature review only). Metadata: `\notetitle`, `\notesubtitle`, `\noteversion`, `\notedate`, `\noteaffiliationone…three`, `\noteauthors`, `\noteemails`, `\orcidicon`, `\authornameorcid`.
Colours in math: `\textcolor{black!70}{..}`, `\textcolor{cyan!22!black}{..}` (xcolor mix expressions).

## Hard points

1. Restructured source vs the brief's description (L1).
2. `article` levels instead of `book` (L10); `appendices` environment spanning several pages.
3. Tables with cell colours, `\multicolumn`, `\multirow` (the first course's `tables.py` has neither).
4. xcolor expressions inside math (`cyan!22!black`, `gray!22`), which MathJax does not know.
5. `\AA` (Å) in text and inside `\text{}` in math.
6. Figure 5 is a 3.7 MB PNG (budget: WebP).
7. No author material may reach the web (L5).
