# Decisions

Each decision has the reason that led to it, so that a later session (possibly on a different model) can apply it without asking. Change a decision only if it blocks you; record the change and the reason here.

## Architecture

**D1. Quarto website, not a Quarto book; the converter resolves every cross-reference itself.**
Quarto's native cross-references across pages only work in book projects, and its numbers are Quarto's, not LaTeX's. The site must stay one website project, and numbers must be the PDF's. So the converter knows where every `\label` lands (page + anchor) and writes plain links carrying the number taken from LaTeX (D5). Nothing depends on Quarto's `@ref` machinery.

**D2. Course lives in `notes/diffgeo-gr/`; addresses come from the LaTeX labels, not from numbers or titles.**
`\chapter{Vector Spaces}\label{chapter_Vector_Spaces}` → `notes/diffgeo-gr/vector-spaces/index.html`; `\section{…}\label{section_Foundations_Sets_Maps}` → `…/vector-spaces/foundations-sets-maps.html` (prefixes `chapter_`, `appendix_`, `section_`, `subsection_` are dropped; a heading without a label falls back to its title). Numbers shift when a chapter is inserted (Symmetries will become Ch. 9) and titles get reworded; labels are the stable name the author already maintains. `COURSE` in `build.py` is the one place that names the directory.

**D3. One page per chapter opening and one per `\section`.** The chapter page holds the motivation box and the text before the first section, then a generated list of its sections. Subsections are headings inside the section page and feed "On this page". Appendix B and C sections (one proof / one worked example each) are pages too. This gives 76 pages of 1–6 screens; chapters as single pages would be 10–25 screens with hundreds of formulas each.

**D4. Own strict converter (`_port/convert/`), Python standard library only; pandoc's LaTeX reader is not used.**
Reasons: (a) pandoc rewrites math (`align*` → `aligned`, expands macros) while rule 3 wants the source untouched; (b) pandoc silently drops what it does not know, while we need the opposite: every command and environment is declared in `texparse.py` and handled in `render.py`, anything else stops that page with `file:line` ("teach the converter"); (c) the notes use a small regular subset (lists, footnotes, figures, boxes, colour macros), so a recursive-descent parser is ~400 lines; (d) emitting HTML directly avoids Markdown escaping bugs. Math is never parsed: it is captured as the exact source string.
Pipeline: `source.py` (strip comments like TeX does, expand uncommented `\input`, keep file:line for every character) → `texparse.py` (nodes) → `render.py` (HTML with placeholders) → `build.py` (page map, numbering, link resolution, `.qmd` files, sidebar, landing-page fragments).
Files that `main.tex` does not include are never opened, which is how "publish exactly what main.tex includes" holds; including them later needs no converter change.

**D5. Numbers come from an instrumented LaTeX build, keyed by source position.**
`_port/tex/build_scratch.sh` copies the notes to `_port/.work/tex/stage`, injects `\input{port-hooks}` on the `\begin{document}` line (so no line shifts), compiles with latexmk/XeLaTeX and publishes the result to `_port/.work/tex/src` only on success. `port-hooks.tex` typesets nothing; it writes `main.port`, one line per numbered object in source order: `counter|printed number|file|line` (hooks on `\refstepcounter`, on the caption package's `\caption@@refstepcounter`, and on `\H@@footnotetext` for footnotes incl. `\footnotetext[n]`). `build.py` assigns each record to the page whose source span contains it and the renderer consumes them in order; a page fails if LaTeX numbered something the converter did not see, or the reverse. `\ref` numbers and kinds come from `main.aux`. Verified: the scratch build's labels are identical to the notes' own `main.aux`, and `pdftotext` of both PDFs differs only in the date.
Never compute a number in the converter. If a new kind of numbered object appears (e.g. `table`), it will already be in `main.port`; add the `take('table')` call.

**D6. Output is `.qmd` whose body is raw HTML blocks; in-page headings are Markdown headings with raw-inline content.**
Quarto builds the "On this page" outline and the search index from real headings, so `\subsection`s are written as `## `<span class="dg-secnum">7.2.1</span> Title`{=html} {#label}`; everything else is in ```` ```{=html} ```` blocks. No pandoc Math nodes are ever produced (math is `<span class="math inline">\(…\)</span>` in raw HTML), so pandoc never touches the equations. Quarto's own title block is hidden by CSS and the page header (`.dg-head`: kicker "Chapter 2 • Vector Spaces" as in the PDF running header, then the numbered title) is generated from the notes. The YAML `title` is kept for the browser tab, sidebar and search.

**D7. Math: MathJax 3.2.2 (CHTML), one shared configuration, source verbatim.**
`notes/diffgeo-gr/assets/mathjax-config.js` is the single math configuration. The notes' preamble defines no math macros, so the config only holds what MathJax lacks (`\xlongrightarrow`) and the font switches (D8). Quarto loads MathJax itself on every page; `_metadata.yml` pins the URL and `_head.html` puts our config before it. The only rewrites of math source, all forced by the web, are in `render.py: Renderer.math`: (1) `\label{x}` in a numbered environment → `\tag{n}` with LaTeX's number, (2) `\ref`/`\eqref` inside math → the number, (3) `\hyperlink{t}{…}` → `\href{#t}{…}`, (4) macros `\edef`'ed to a footnote number (Ch. 8) → that number. Every expression is test-typeset at build time by `_port/tools/math_check.mjs`. (Engine comparison and any config fixes: see "Measured" below.)

**D8. Runic symbols: the literal Unicode rune, the notes' own font, restricted to the runic block.**
The source writes `\textrm{\runic ᛊ}`. On the web `\runic` (and `\cunei`) expand to nothing and the rune stays a Unicode character inside `\textrm{}`; `course.css` declares `@font-face "Noto Sans Runic"` from the notes' `fonts/NotoSansRunic-Regular.ttf` (copied by the converter, 10 kB) with `unicode-range: U+16A0-16FF`, MathJax's `unknownFamily` names it, and `startup.pageReady` waits for `document.fonts.load` so the widths MathJax measures are the real glyph's. Result: same glyphs as the PDF on any machine, in inline, display, sub- and superscripts. TikZ pictures get their runes as outlines from the same font (D10).

**D9. Print-only layout commands are dropped; vertical rhythm is kept.**
`\noindent`, `\vspace`, `\newpage`, `\clearpage`, `\thispagestyle`, `\addcontentsline`, float placement options and the running-header title of `custompage` have no meaning on a web page and produce nothing. `\smallskip/\medskip/\bigskip` become spacing classes because the author uses them to group paragraphs. TeX input conventions are mapped to what the PDF shows: `` `` ''`` → “ ”, `--` → –, `---` → —, `~` → no-break space, `\S` → §.

**D10. Figures.** (a) `plots/*.pdf` → SVG when small, otherwise WebP at 2400 px (thresholds and tools in `figures.py`; measured table below). (b) Every TikZ picture is compiled from the author's source: the figure body goes into a standalone document with the notes' preamble verbatim and the right `\textwidth` (16 cm, or the `custompage` width for roadmaps), `main.aux` is supplied so `\ref` resolves, XeLaTeX → `.xdv` → `dvisvgm --no-fonts` (glyphs as outlines, so no font dependence). Nothing is redrawn. (c) In those builds `\ref` is wrapped so that each reference becomes `<g class="dg-xref" data-label="…">` in the SVG; the page script turns them into links using `assets/labels.json`. (d) Figures keep their own light background and sit on a white "paper" card at the same fraction of the text width as in the PDF (`--dg-frac`); no colour inversion, because the colours carry meaning. (e) Click opens a zoom/pan viewer. Outputs are cached by content hash in `_port/.work/figcache` and written to `notes/diffgeo-gr/figures/`.

**D11. Footnotes** keep LaTeX's numbers (per chapter), are listed at the foot of the page that cites them, and open in a popover on hover/focus/tap.

**D12. Colours.** The eleven term colours keep their meaning; the dark `_1` shades are lightened for the dark page, the `_2` shades are kept. The mapping is the `--dg-color-*` table at the top of `course.css`; `\textcolor{color_x_n}` maps to the same variables. Unknown colour names stop the page.

**D13. Reading surface.** Course pages load `assets/course.css` (only they do), which removes the animated background, sets a solid `--dlc-bg` surface and a 780 px text column, and uses its own Quarto `grid`. Cost: Quarto compiles one more Bootstrap bundle for the different grid (0.5 MB in `docs/site_libs`, ~75 kB over the wire). Accepted because overriding Quarto's grid in CSS breaks between Quarto versions.

**D14. Web layer.** Everything not in the PDF carries class `dg-web` (navigation aids) or sits in a `dg-interactive` frame with an "Interactive" badge. Every word written for it is listed in `REVIEW.md`. Prev/next links and the section list of a chapter are generated by the converter (no site-wide `page-navigation`).

**D15. Interactive figures.** Mapping in `_port/interactives.json` (`label` → `module`); the converter emits an empty frame right after the figure or heading with that label. `course.js` lazily imports `assets/interactive/<module>.js` when the frame nears the viewport; each module exports `default function mount(body, frame)` and imports the shared `assets/interactive/dg.js` (controls with MathJax-rendered labels, a 2D SVG plot helper, a small canvas 3D scene with painter's-algorithm surfaces, the palette). No third-party library. Budget per page: ≤ 40 kB of JS and ≤ 150 kB of data on top of MathJax, loaded only where a frame exists. Geometry is computed in JS when the formulas are in the notes (they usually are, in Appendix C); only where a figure's geometry exists solely in the Python package is it exported offline to JSON. If JS fails the frame stays hidden and the static figure is untouched.

**D16. Partial conversion is visible, strict mode is the goal.** `build.py` writes the pages that convert, lists the others as `PENDING <file:line>: reason`, shows them greyed out in the sidebar and renders references to them as unlinked numbers. `build.py --strict` (used by `check.sh`) fails if any page is pending.

**D17.** References whose label does not exist in the build ("??" in the PDF) render as a small "in preparation" marker. **D18.** `\DLC{…}` author notes render nothing and are listed in `REVIEW.md`. Typos are never fixed.

**D19. Landing page.** `index.qmd` is hand-written and includes generated fragments from `notes/diffgeo-gr/_generated/` (cover texts, quote and dedication, contents, master roadmap). `cover.py` extracts the texts from the TikZ nodes of the title and dedication pages with anchored patterns that fail loudly if `main.tex` is restructured.

**D20. Bibliography** page and citation texts come from `main.bbl` (natbib author–year), so they match what BibTeX produced.

## Working rules

**D21. Scratch and environments.** Everything temporary is under `_port/.work/` (git-ignored): `tex/stage`, `tex/src`, `figs`, `figcache`, `report.json`. Node tools live in `_port/node_modules` (git-ignored; `_port/package.json` is committed). The converter needs only Python ≥ 3.10 stdlib. This machine has no `python3-venv`; if the Python package must run (data export), use a conda prefix env at `_port/.env`.

**D22. Git.** The working tree shows ~120 files as modified because of file-mode changes only (`old mode 100644 / new mode 100755`); never `git add -A` or `git commit -a`. Stage explicit paths: `_port/`, `notes/`, `docs/notes/`, `docs/site_libs/`, `docs/search.json`, `docs/sitemap.xml`, `_quarto.yml`, `.gitignore`, `CLAUDE.md`, `.claude/agents/`, and the `docs/*.html` of existing pages only when their content (not mode) changed.

**D23. Generated vs hand-written.** Generated (never edit): `notes/diffgeo-gr/**/*.qmd` except `index.qmd`, `_sidebar.yml`, `_generated/`, `figures/`, `assets/labels.json`, `assets/fonts/`, `docs/`. Hand-written: `index.qmd`, `_metadata.yml`, `assets/*.css|js|html`, `assets/interactive/`, `_port/interactives.json`, all of `_port/convert`, `_port/tex`, `_port/tools`.

## Planned (design fixed, not built yet)

**D24. Fidelity check** (`_port/tools/fidelity.py`): an implementation independent of `render.py` reduces the LaTeX source to an ordered stream of (a) math strings with whitespace removed and (b) text words with commands stripped; the generated pages are reduced to the same stream from their HTML (footnote bodies spliced in at their marks, `dg-web` elements and generated numbers ignored); the two are diffed. Accepted differences are listed one by one in `_port/fidelity_allow.json` (hidden `\DLC` notes, "in preparation" markers, the four math rewrites of D7, text inside TikZ pictures, which lives in the SVG).

**D25. Cross-reference previews**: on hover/focus of `a.dg-xref`, fetch the target page once, take the element with that id (equation, figure, list item, footnote, or heading + first paragraph), show it in the same popover as footnotes and typeset it.

## Measured

**Math engines** (`node _port/tools/math_check.mjs --engine all`, 5356 expressions, 3047 distinct; 2026-11-14):

| Engine | Failures | What fails |
|---|---|---|
| MathJax 3.2.2 (chosen) | 1 | the `tabular` inside display math in §4.1.2 (`Coordinates_TpM.tex` ~l.299) |
| MathJax 4.1.3 | 1 | the same `tabular` |
| KaTeX 0.19.1 | 9 | that `tabular` + 8 arrays with `@{..}` column specs; no `\xlongrightarrow`; `\coloneq` prints ":−" |

MathJax 3 is kept (Quarto's default, well known, same failure count as 4). Config-level fixes applied in `mathjax-config.js`: `\coloneq` → `\coloneqq` (TeX Live 2023 mathtools prints ":=" for both; MathJax 3 would print ":−"); `\xlongrightarrow[below]{above}` → `\xrightarrow[below]{\;above\;}` (closest arrow length to LaTeX's: within 0.1 em on typical labels). `tex-chtml-full` already contains every extension, so there is no `loader.load` (it throws in the browser). `matchFontHeight: false` keeps math at the text size.
Known residual differences with MathJax 3, to revisit only if the author minds: in the 8 arrays with `@{\quad}` / `@{\qquad}` column specs the gap beside the vertical rule is 0.5 em instead of 1–2 em (MathJax 4 renders `@{}` exactly; switching engines is the fix, not rewriting math). The `tabular` needs the converter (unit B2): emit it as an HTML table whose cells keep their `$…$` source.
In the browser `tex-chtml-full` enables `noerrors`/`noundefined`, so a broken expression shows as raw source or red text, not as an error node: `math_check.mjs` (Node, those two packages off) is the check that catches them.

**Runic symbols** verified in the browser (screenshots at 3× of §7.2): correct glyphs from the notes' font inline, in display math, in subscripts (`L_{ᚱ^{-1}([a,b])}`, `γ_ᛊ`, `ᛊ=0` limits) and inside the TikZ figure 7.1.

**Figures** (`python3 _port/tools/test_figures.py` prints the table). `pdftocairo -svg` is correct for the 5 small 2D plots (67–320 kB); `dvisvgm --pdf` drops matplotlib's text and is never used. The 14 mesh-heavy 3D plots are 0.6–4 MB as SVG and become WebP (1800 px wide, q 80: 40–470 kB each). TikZ → SVG with `dvisvgm --no-fonts --exact-bbox --optimize`: roadmaps 360–715 kB, others ~100 kB; needs `\def\pgfsysdriver{pgfsys-dvisvgm.def}` and `\NewCommandCopy` for the `\ref` wrapper (hyperref's `\ref` is robust, `\let` loops). All 31 figures of the 72 converted pages: 5.8 MB (once more in `docs/`). `RASTER_PDF_PX`, `WEBP_Q`, `SVG_MAX` in `figures.py` are the knobs; they are part of the cache key.
The four worked-example PDFs that are whole A4 pages keep their margins, as `\includegraphics` shows them in the PDF (no cropping: it would change their relative size).

**Quarto** (1.9.37): directories starting with `_` are not rendered (`_port/`, `_generated/`); raw-inline headings appear in the page outline; raw-HTML text is indexed by the site search per section; root-absolute `/notes/...` URLs in the head include are rewritten to relative ones; MathJax is added by Quarto to every page, so we only pin its URL. `quarto render notes/diffgeo-gr` takes ~1 min for 73 pages. The scratch LaTeX build takes ~4 min; the converter ~10 s with a warm figure cache (~3 min cold).
