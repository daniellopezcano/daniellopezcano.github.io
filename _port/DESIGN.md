# Design of the course section (phase 2)

What the course section should look like and why. The brief is `REDESIGN.md`; the mechanics are in `DECISIONS.md` (D29 onwards); status is in `PROGRESS.md`.

**Chosen direction: A, "Paper"** (chosen by Claude on 2026-11-15 under the author's delegation; the author reviews the result at the end). Reasons in § 3, the design system that follows from it in § 4.

## 1. Reference sites

Studied in a headless browser on 2026-11-15. Measurements (computed styles, column widths, page weight), handling notes and 27 screenshots are in `_port/design/refs/` (`NOTES.md` has one section per site and a comparison table; `capture.mjs` reproduces them). What follows is the judgement: what is worth taking for these notes, what is not, and why.

| Site | Worth taking | Not taking | Why |
|---|---|---|---|
| **micro-book** (colleague's notes, MkDocs Material) | A course that is organised for students: persistent chapter tree with the page outline inside it, light/dark switch, a notation page and a glossary, interactive panels as a plot plus a control card with a Reset button and a numbered caption. Text in CMU Serif, so text and math are one voice. | 16 px text on a 938 px column (≈ 123 characters per line); interactives in iframes; a 5.7 MB search index loaded on the first page. | The structure is what the author liked. The measure is too long for mathematical prose, and the weight is an order of magnitude over what these pages need. |
| **Interactive Linear Algebra** (Georgia Tech, PreTeXt) | "Knowls": a referenced definition or proof opens in place, exactly where it is cited, and closes again. Numbered, captioned demos that sit right after the concept. Serif text at 18 px. Tiny pages (0.55 MB). | Single 739 px column with no persistent navigation (the contents are hidden behind a button); line-height 1.25; demos in iframes with a debug-style control overlay. | The knowl is the model for the brief's "inline panel showing content from somewhere else". Without a visible tree the reader loses the sense of where they are, which the brief asks for above all. |
| **Immersive Linear Algebra** | The figure as part of the argument: a framed canvas with a number badge, a boxed caption, and step controls (back / reset / forward) for multi-step constructions. | Full-width text in the browser's default face (≈ 186 characters per line), a floating menu as the only navigation. | The step control is the pattern for the Einstein–Hilbert flowchart step-through. The page layout is not a reading layout. |
| **Distill** | Sidenotes and figure captions in the margin, level with the line they belong to; 20 px text on a 648 px measure (≈ 81 characters); figures allowed to be wider than the text; interactive controls drawn in the article's own visual language, with no chrome. | No navigation (single articles); KaTeX (fails on 9 of the notes' expressions, DECISIONS "Measured"); no reset buttons. | The best long-form reading surface of the set. The notes' footnotes are frequent and substantial (they carry notation conventions and pointers to Appendix B), which is exactly the case sidenotes are for. |
| **Seeing Theory** | Small, focused panels: one idea per panel, controls in the reader's path, immediate response. | The split screen with a fixed visualisation pane; no captions, no reset, 67 requests. | A fixed pane suits a page built around one visualisation. These notes are text and equations first; most of the time the pane would be empty or would hold something narrower than the displays it must show (see direction C). |
| **The Feynman Lectures** (Caltech) | From knowledge of the site, not measured: a classic physics text that keeps its print identity on the web (serif text, numbered equations with the number at the right edge, figures with their printed captions, chapter/section numbering as the navigation). | — | The site is online but answers a headless browser with a Cloudflare challenge, which was not circumvented. No screenshot or measurement was taken (`refs/feynman-blocked-desktop.jpg` is the challenge page). No equivalent classic was found that adds something the other seven do not. |
| **d2l.ai** | Fixed right-hand outline with scroll-spy; links to runnable code at the top of every section. | 196 requests and 2.2 MB per page; 16 px Roboto on an 850 px column (≈ 125 characters); two stacked top bars. | The code links map onto the notes' Appendix A and the Python package. The rest is documentation tooling, heavier and denser than a reader needs. |
| **QuantEcon** | The quietest chrome of the set: one slim toolbar (contents, search, theme, font size, download), a scroll-spy outline, equation numbers at the right edge. | 900 px column at 18 px (≈ 120 characters); grey sans-serif text beside black serif math, which makes the math look heavier than the prose; equations clipped on phones. | The toolbar is the model for the course bar. The text/math mismatch is the thing to avoid: it is also what direction B shows. |

Three findings carried into the design:

1. **Measure.** Every documentation-style site runs 120+ characters per line; the two sites that read best (Distill, ILA) run 80–90. The notes' own text block is 45 em and their display equations use all of it, so the column cannot be narrower than 45 em without scrolling equations. The way to a comfortable measure is therefore a larger text size with the column fixed at 45 em (≈ 95 characters, the PDF's measure), not a narrower column.
2. **One voice for text and math.** The sites where sans-serif prose meets Computer Modern math (d2l, QuantEcon, and the pilot) look like two documents interleaved. micro-book and ILA avoid it by setting the prose in a serif that matches the math.
3. **Nobody combines** a persistent course tree, sidenotes, in-place appendix content and inline panels. Each exists somewhere; the notes need all four, because they are a course (tree), written with substantial footnotes (sidenotes), with proofs and worked examples deliberately moved to appendices (in place), and with figures that reward manipulation (panels).

## 2. The three directions

Built as working prototypes on the same real pages (the content is the `<main>` of the pages rendered by the pilot pipeline, untouched): the landing page, the Chapter 2 opening, §2.1, §4.1 with its figures, B.13 (proof of the Euler–Lagrange equations) and C.6 with its interactive figure.

- **Preview:** `_port/design/preview.sh` and open `http://localhost:4321/design/` (builds the prototypes, serves them next to `docs/`).
- **Screenshots:** `_port/design/shots/<a|b|c>-<page>-<1440|390>[-n].jpg` (`node _port/design/proto/shots.mjs` regenerates them). Pages: `landing`, `chapter`, `sec21`, `sec41`, `proofB`, `exC6`; `-1`, `-2` are scrolled views (figure, appendix content opened in place, interactive); `a-sec21-1440-dark.jpg` is A's dark theme.
- **Source:** `_port/design/proto/` (`build.py`, `shell.css` shared, `a.css`, `b.css`, `c.css`, `proto.js`).

All three share what the brief fixes or what the study settled: the site navbar on top (same links, same look, measured from the Quarto pages), a slim sticky course bar under it (breadcrumbs, course map, search, light/dark, reading progress), previous/next with titles, figures on their own white paper, and proofs and worked examples that open where they are cited.

| | **A "Paper"** | **B "Night"** | **C "Atlas"** |
|---|---|---|---|
| Surface | warm paper `#fbfaf6`, ink `#1a2030`; dark theme one click away | the site's dark navy `#0b1220` | white sheet on a cool grey page |
| Text face | New Computer Modern Book (the notes' Latin Modern, drawn heavier for screens), 18.7 px / 1.58 | Lato (the site's face), 17.5 px / 1.72 | Lato, 17.5 px / 1.7 |
| Columns at 1440 px | course tree 264 · text 45 em · margin 296 | course tree 272 · text 51 rem · outline 232 | text 51 rem · context pane 384 (tree in a drawer) |
| Footnotes | sidenotes in the margin, level with their mark; popover + list below the text on narrow screens | popover + list below the text | shown in the context pane |
| Page outline | inside the course tree, under the current section | right column, scroll-spy | top of the context pane |
| Appendix content in place | panel in the text column, full width | same | in the context pane |
| Term colours | the notes' colours as printed (four darkened slightly for contrast) | lightened for the dark surface | as printed |
| Chapters | tree | tree | numbered stops in the course bar |

What the screenshots show:

- **A** reads as the notes themselves, typeset for the screen. Text and math share one design, so inline formulas stop standing out as foreign objects and the colour-coded terms carry the emphasis they have in the PDF. The figures, almost all on white, sit on the paper without the white cards that punctuate B. The footnote of §2.1 (a notation convention plus a pointer to B.1) is readable beside the sentence that cites it, without a click. The margin costs nothing: the text column is the PDF's 45 em either way. On a phone the same typography holds and footnotes fall back to popovers. Its dark theme keeps all of this on the site's navy.
- **B** is the pilot, refined. It is the most consistent with the rest of the site and the least work. But it keeps the pilot's weaknesses: Lato prose against Computer Modern math looks like two interleaved documents; every figure is a bright white card on a dark page; the term colours had to be lightened away from the PDF's; and light text on a dark page is the less comfortable option for most readers of dense mathematics in daylight.
- **C** has the most interesting idea: the reader points and the pane answers. It fails on this content. A 24 rem pane is narrower than the display equations inside the proofs it should show (B.13 scrolls sideways in it), it is empty most of the time, and removing the persistent tree takes away the "where am I in the course" that the brief puts first. The chapter line is a nice orientation device but duplicates the tree.

## 3. Recommendation and choice

**A, "Paper", with B's palette as its reader-selectable dark theme.** Reasons, in order of weight:

1. **It keeps the notes' identity.** The brief: "the web version should feel like those notes". A uses the notes' own typeface family, their navy headings, their term colours as printed, and their white figures as they are. B and C translate the notes into the site's look; A brings the site's look (navbar, palette of the dark theme, Lato for all interface text) around the notes.
2. **It is the best surface for long mathematical reading** by the evidence of § 1: one voice for text and math, the PDF's measure at a larger size, sidenotes for the footnotes.
3. **Light or dark stops being a dilemma.** Paper by default, because the notes and the figures are white; the site's dark for those who prefer it, remembered per browser. The site navbar stays dark in both, so the section always belongs to the site.
4. **Everything in the brief's list fits without a second layout mode**: the appendix panel uses the full text width (proofs need it), interactives sit in the text column, the margin holds sidenotes on wide screens and disappears on narrow ones.

Taken from the others: from B, its palette (as A's dark theme) and the scroll-spy outline; from C, nothing structural (the chapter line is dropped in favour of the tree; the "pane that answers" survives as hover previews).

## 4. The design system (what milestone 1 implements)

Class prefix `dg-` as before. All colours and sizes are CSS custom properties on `:root` (light) and `:root[data-theme="dark"]`; nothing else changes between themes.

**Type.** Text and headings: New Computer Modern 10 "Book" (regular, italic, bold, bold italic), subset to Latin and served as WOFF2 from the course's own `assets/fonts/` (≈ 33 kB each; built from the TeX Live fonts by the converter). Interface (course bar, tree, buttons, badges, panels' chrome): Lato, as on the rest of the site. Math: MathJax with the New Computer Modern math font if MathJax 4 passes the checks (D34), which makes text and math the same family; otherwise MathJax 3's TeX font. Runes: unchanged (D8). Text size 1.17 rem (18.7 px) on wide screens, 1.08 rem on phones; line-height 1.58; paragraphs separated by space, not indent (as in the PDF).

**Layout.** Site navbar (not fixed: it scrolls away, the course bar stays). Course bar 46 px, sticky. Reading pages: text column `minmax(0, 45em)`; margin 18.5 rem from 1000 px; course tree 16.5 rem from 1360 px, a drawer below that. Landing and chapter-opening pages are one wide column. The page never scrolls sideways; wide displays scroll in their own box (D27 stands).

**Palette.** Light: paper `#fbfaf6`, surface `#f4f2ea`, ink `#1a2030`, soft ink `#4b556b`, heading navy `#142864` (`color_blue_0`), accent `#3152b8`, rules navy at 17 %. Dark: `#0e1524`, `#141d31`, `#e4e9f5`, `#aebbd6`, `#cbd9ff`, `#8eadff`. Term colours: light theme = `color_<name>_1` of `main.tex`, except green, orange, yellow and olive, darkened until they reach 4.5 : 1 on paper (hue kept); dark theme = the pilot's table (D12).

**Components.**
- *Page header*: kicker in small caps ("Chapter 2 • Vector Spaces", as the PDF's running header) and numbered title, from the notes.
- *Course tree*: chapters and appendices; the current chapter open; under the current section, its subsections with scroll-spy; a mark on sections the reader has finished (stored in the browser).
- *Course bar*: breadcrumbs; "Map" (the master roadmap as navigation, in an overlay); "Search" (the course's own index, `/` to focus); theme switch; a hairline showing how far through the page the reader is, over a fainter one showing how far through the course this page lies.
- *Sidenote*: the footnote's own text and number, in the margin at the height of its mark; highlights when the mark is hovered or focused. Below 1000 px: popover on tap, and the list at the foot of the page.
- *Figure*: on white paper with a hairline border, caption beneath in the text face at 0.9 em, number in navy bold; click to zoom (viewer unchanged); lazy below the fold.
- *Display equation*: centred, number at the right edge; hovering shows a small "copy LaTeX" button (web layer).
- *Reference*: a link with a hover/focus preview of its target (equation, figure, section opening, footnote, bibliography entry). References to a proof (B) or worked example (C) also get the "open here" control.
- *Inline panel* ("appendix content in place"): dashed accent frame, header with "Appendix B" / "Appendix C", the item's number and title, "open page", "close"; the content exactly as on its own page, at full text width, scrollable above 70 vh.
- *Interactive panel*: solid accent frame with the "Interactive" badge; one line of instructions; controls in a single row with rendered math labels; canvas/plot; footer with Reset, the link to the notebook of the Python package where one exists, and "static figure" (scrolls to it).
- *Chapter opening*: the notes' motivation box and opening text; then, as web layer, the chapter's roadmap excerpt (the chapter's own roadmap figure from §1.1 where there is one), its sections, and the proofs (B) and examples (C) that belong to it.
- *Previous / next*: at the foot, with number and title; `←` / `→` on the keyboard.
- *Print*: a print stylesheet that drops the chrome, restores footnotes to the foot, and prints on white.

**Web layer.** Everything above that is not the notes' text carries `dg-web`, uses Lato (never the text face), and its words are listed in `REVIEW.md`. This makes the rule visible: serif is the author, sans-serif is the site.

**Weight budget per page** (bytes decoded, loaded before any interaction, measured in the headless browser by `check.sh`): own HTML + CSS + JS + fonts ≤ 700 kB; images loaded eagerly ≤ 500 kB (landing page: ≤ 900 kB including the inline roadmap); third-party (MathJax and its font, Lato) ≤ 1.6 MB, cached across pages. Interactive modules and data load only when their panel nears the viewport and count against D15's separate budget. The numbers are tightened once milestone 1 can be measured. The image budget is made precise in DECISIONS D42 (non-lazy images against the budget; all images fetched before interaction ≤ 2 MB).

**Accessibility.** Contrast ≥ 4.5 : 1 for text in both themes; every control reachable and operable by keyboard with a visible focus ring; the drawer and overlays trap and restore focus; `prefers-reduced-motion` honoured; landmarks (`header`, `nav`, `main`, `aside`) labelled. Checked on every page with axe-core in `check.sh`.
