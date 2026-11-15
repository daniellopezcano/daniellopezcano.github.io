# Reference sites for long-form mathematical web reading: measurements

Captured 2026-11-15 with headless Chromium (Playwright, project-local browser), default settings, no login, no interaction beyond scrolling. Scripts: `capture.mjs` (screenshots + computed-style probes + network accounting), `extras.mjs` (one targeted feature screenshot + DOM probes). Raw numbers: `data/<site>.json`, `data/extras.json`.

How to read the numbers:
- **Body text** is a typical long paragraph of the main column (`p`, or the text block when the site has no `p`). Colours are computed values.
- **Measure (cpl)** is the paragraph's inner width divided by the average glyph width of its own text, with math removed, measured on a canvas in the same font. It is the number of characters in a full line. Fonts that are not web fonts (Georgia, Times New Roman, Hoefler Text) resolve to the Linux fallback in this browser, so these widths can differ slightly on macOS or Windows.
- **Weight** is the encoded bytes from CDP `Network.loadingFinished` for the content page at 1440 px, counted up to network idle (at most 15 s after `load`). It is a single cold-cache sample from one network. The "load" time is the time to the `load` event.
- **Phone** is 390x844. "Overflow" means `documentElement.scrollWidth > innerWidth`.

---

## 1. micro-book (Darcio Genicolo-Martins), MkDocs Material

URLs: https://darciogm.github.io/micro-book/ (home), https://darciogm.github.io/micro-book/cap01/maximizacao/ (content). Both live.

| item | value |
|---|---|
| body font | "CMU Serif" (self-hosted woff2: cmunrm/cmunbx/cmunti), fallback Computer Modern, Georgia |
| size / line-height | 16 px / 25.6 px (1.6) |
| colour / background | rgba(0,0,0,.87) on #fff |
| text column | 938 px (x=376…1314); **~123 cpl** |
| h1 / h2 | CMU Serif 32 px w300 rgba(0,0,0,.54) / CMU Serif 25 px w300 rgba(0,0,0,.87); no h3 on page |
| layout 1440 | sticky top bar 48 px (red, title, theme toggle, search) + non-sticky tab bar 48 px; left nav 242 px sticky (top:48), its own scroll box, with the page TOC integrated into the nav tree (`md-nav--integrated`); text 938 px; **no right column** |
| math | MathJax 3.2.2 CHTML (tex-mml-chtml from jsDelivr + boldsymbol ext); 47 math, 15 display |
| fonts loaded | CMU Serif 400/700/400i; MathJax TeX woff (Zero, Main, Math-Italic, Size1, AMS) |
| weight | 38 requests, **6.90 MB**: html 30 kB, css 37 kB, js 687 kB (MathJax 206 kB, JSXGraph 204 kB, a second MathJax tex-chtml 204 kB), fonts 418 kB, **search_index.json 5.68 MB** (whole-site search index fetched on page load), WebR worker 41 kB |
| load | 1.5–1.7 s |
| phone | no overflow (scrollWidth 390); text 358 px, 16/25.6 px, ~47 cpl; nav becomes a 242 px off-canvas drawer (hamburger in the 48 px sticky header); search becomes an icon |

Handling:
- Display equations: centred inside `.arithmatex` blocks with a light grey background (#f5f5f5-like), and the number on the right inside the same box, e.g. "(1.7.1)" at x≈1230. Equation references are red links "(1.7.5)". On the phone the `.arithmatex` parent has `overflow-x:auto`, so wide equations scroll inside their own box.
- Theorem/proof: Material admonitions. "Teorema: …" has a blue border and a title bar with an icon. "Demonstração" has a purple border and is not collapsible; it ends with ■. Admonition text is visibly smaller than body text (Material default ≈0.64 rem; not measured). The solved exercise is a `<details class="exercicio-resolvido">`, closed by default. "Box Brasil" boxes are further admonitions.
- Footnotes: `a.footnote-ref` superscript linking to a `div.footnote` list at the page bottom (y≈5430 of 5680). The DOM showed no hover popover at load.
- Interactive (Figura 1.4, `iframe.graph-iframe` 938x450): a two-pane box. On the left a JSXGraph plot (curves R, CT, π, CMg with markers), on the right a "Parâmetros" card with one slider (Preço P = 20), a formula, a table of live readouts (q*, π*, CMg(q*), CPO, dq*/dP), a colour legend and a full-width red **"Resetar"** button. The caption sits centred below: "**Figura 1.4 —** title. instructions…". It is followed by a WebR (R in WebAssembly) editable code cell ("WebR pronto!" banner, "Edite o código e clique Executar").
- Previous/next: Material footer links with chapter titles. Search: yes (lunr index). Light/dark toggle: yes ("Switch to dark mode"). Breadcrumbs: none. Back-to-top button. Glossary/notation page: not on this page.

Visual: a warm red brand bar over a white page. Computer Modern body text makes it read like the PDF, but at 938 px the line is ~120 characters, far beyond a comfortable measure, and the admonition text and its inline math are noticeably smaller than the body. Display equations sit in grey slabs that span the whole column, with the number at the far right, so short equations float in a lot of empty grey. The interactive figure is well framed: plot and control card side by side, numbered caption below, explicit reset.

Files: `microbook-home-desktop-top.jpg`, `microbook-page-desktop-top.jpg`, `microbook-page-desktop-interactive.jpg`, `microbook-page-phone-top.jpg`.

---

## 2. Interactive Linear Algebra (Margalit & Rabinoff), PreTeXt/MathBook XML

URLs: https://textbooks.math.gatech.edu/ila/ (opens "Front Matter"), https://textbooks.math.gatech.edu/ila/vectors.html (§2.1 Vectors). Live.

| item | value |
|---|---|
| body font | CharterBT (self-hosted woff), fallback PT Serif, Times |
| size / line-height | 18 px / 22.5 px (1.25) |
| colour / background | #000 on #fff page, centred on a #545454 grey surround |
| text column | 675 px inside a 739 px page (x=351…1090); **~91 cpl** |
| headings | the masthead "Interactive Linear Algebra" is an h1 (CharterBT 31.5 px w700, white on #222); section titles are bold Charter (≈28 px in the screenshot) |
| layout 1440 | single centred 739 px column; dark masthead 103 px; toolbar 37 px (☰, Index, Prev, Up, Next) that becomes `position:fixed` at the top once scrolled; the left TOC is hidden behind ☰ (not shown at 1440); no right column |
| math | **pre-rendered SVG** (`svg.pretex`, 78 svgs; no MathJax/KaTeX runtime on the page); the demos inside iframes use KaTeX (fonts KaTeX_Main, KaTeX_Size3) |
| fonts loaded | CharterBT 4 styles, Ionicons, 7 inline data-URI subset fonts for the SVG math |
| weight | 21 requests, **552 kB**: html 29 kB, css 22 kB, js 315 kB (demo.js 285 kB), fonts 171 kB, images 15 kB |
| load | 3.1–3.4 s |
| phone | **overflow: scrollWidth 501** (a 491 px wide SVG figure; body has `overflow-x:hidden`); text 368 px, 18/22.5 px, ~49 cpl; the toolbar moves to a **fixed bottom bar** 45 px (☰, ‹, ^, ›) |

Handling:
- Definitions, examples and remarks are articles with a left 3 px yellow rule (`definition-like`, `remark-like`). "Objectives" opens the section as a yellow-ruled list.
- Collapsible content: "Example." and "Interactive: Linear combinations of three vectors." are underlined dotted-link headings with a ▾ chevron. They are PreTeXt knowls that expand in place. Some examples are open by default.
- Figures: SVG diagrams centred at their natural size (224–491 px). Numbered figure captions ("Figure 17 …") are italic, in the text font, below.
- Interactive demo: an iframe 675x400 (the full text width) running a three.js/MathBox scene. A dark dat.GUI control panel overlays the top right (checkboxes Axes/Show/Grid, sliders x, y with numeric fields, "Close Controls"). A live KaTeX matrix equation overlays the top left, and a fullscreen button sits at the bottom right. The italic numbered caption below gives the instruction ("move the sliders to change…"). There is no reset button.
- Previous/next/up: in the toolbar (top on desktop, bottom on phone). Index page: yes ("Index" button). "PDF version" link in the masthead. Search, theme toggle, footnotes, progress: none on this page.

Visual: reads like a printed book page dropped on a grey desk. Charter at 18 px is pleasant, but line-height 1.25 is tight, and inline math is set as SVG that matches the text weight well. The demo is a bare 3-D canvas with a developer-style black dat.GUI panel; it works, but visually it clashes with the book typography. On the phone the bottom navigation bar is handy, but one figure overflows the viewport.

Files: `ila-home-desktop-top.jpg`, `ila-page-desktop-top.jpg`, `ila-page-desktop-scrolled.jpg` (demo + knowls + display math), `ila-page-phone-top.jpg`.

---

## 3. Immersive Linear Algebra (Ström, Åström, Akenine-Möller)

URLs: https://immersivemath.com/ila/ (home, Bootstrap), https://immersivemath.com/ila/ch02_vectors/ch02.html (Chapter 2). Live.

| item | value |
|---|---|
| body font | no font set: browser default "Times New Roman" (Liberation Serif here); headings generic sans-serif |
| size / line-height | 16 px / normal (≈1.15) |
| colour / background | #000 on transparent (white) |
| text column | **1152 px** (x=144…1296); **~186 cpl** at 1440 |
| h1 | sans-serif 32 px w700 #3377aa ("Chapter 2: Vectors") |
| layout 1440 | no columns: one full-width text block. A fixed round "Menu" button 64 px at the top left. The chapter TOC is a button ("Table of Contents of the Chapter"). A fixed "Loading and building chapter..." banner at the top right persisted >1.5 s after network idle |
| math | **MathJax 2.7.5, SVG output** (self-hosted, TeX-AMS-MML_SVG-full); 1105 MathJax nodes |
| fonts loaded | none (MathJax SVG paths) |
| weight | 35 requests, **784 kB**: html 28 kB, css 2 kB, js 475 kB (28 files), images 278 kB (one 264 kB photo), Google Tag Manager 166 kB |
| load | 2.8 s to `load`, but figures show "Loading and generating math..." until ~10–15 s |
| phone | **overflow: scrollWidth 423**; a definition-box table with a 501 px display equation scrolls inside `div.definition_box` (overflow auto), but something else still widens the page; text ~50 cpl |

Handling:
- Definitions: a grey rounded box titled in blue sans ("Definition 2.1: Vector"). Display equations are centred with **blue right-aligned numbers "(2.1)"** at the box edge.
- Interactive illustrations: 23 canvases. They are either full-column boxes or floated right (~663 px) with the text wrapping on the left. Each sits in a lavender rounded frame with a blue number badge ("2.3") at the top left and a play ▶ button at the top right. Below are step dots (●○○○) and plain HTML buttons **Backward / Reset / Forward**. A grey caption box spans the column: "**Interactive Illustration 2.3:** text … Click/touch **Forward** …". Chapter 2 opens with a playable Breakout game (474x632 canvas) with a "Restart" button.
- Previous/next: text links at the very bottom ("Chapter 1: Introduction (previous)", "Chapter 3 … (next)"). No search, theme toggle, footnotes or breadcrumbs.

Visual: the content is the most interactive of the set, but the page typography is unstyled browser default. Times 16 px runs ~180 characters wide on a 1440 screen, and MathJax SVG vector arrows push line spacing apart unevenly. Floating figures beside text with numbered captions and step-wise "Forward" animations work well for proofs-by-picture. The persistent green loading banner and slow progressive build are visible defects.

Files: `immersive-home-desktop-top.jpg`, `immersive-page-desktop-top.jpg`, `immersive-page-desktop-scrolled.jpg` (taken 15 s after load: illustration 2.3 with controls and caption, numbered equation), `immersive-page-phone-top.jpg`.

---

## 4. Distill: "Why Momentum Really Works" (Goh, 2017)

URLs: https://distill.pub/ (home list), https://distill.pub/2017/momentum/ (article). Live; the journal is on hiatus since 2021.

| item | value |
|---|---|
| body font | Georgia, serif (system font, not loaded; Linux fallback here) |
| size / line-height | 20 px / 31 px (1.55) |
| colour / background | rgba(0,0,0,.8) on #fff |
| text column | 648 px (x=396…1044), centred; **~81 cpl** |
| h1 / h2 / h3 | "HoeflerText-Regular" (system) 56 / 30 / 26 px, w400, rgba(0,0,0,.8). UI and captions in -apple-system/Roboto 13 px |
| layout 1440 | header bar 70 px (not sticky). Centred grid: text 648 px; figures break out to 750–984 px (x=228…1212); **right margin column at x≈1070, 120 px wide** for margin captions. No nav, no TOC, nothing sticky |
| math | **KaTeX** (bundled; 335 math, 95 display); inline math rendered the same size as the text |
| fonts loaded | KaTeX_Main 400/700, Math italic, Size1–4 (self-hosted woff2) |
| weight | 29–30 requests, **1.85 MB**: html 51 kB, css 4 kB, js 311 kB, fonts 104 kB, **data JSON 1.37 MB** (Uval.json for a figure), GTM 168 kB |
| load | 1.5–1.6 s |
| phone | **page breaks: scrollWidth 1098**. The 984 px hero figure does not scale, so the page scrolls sideways. Text 342 px, 17/26.35 px, ~50 cpl; header kept, links shrink |

Handling:
- Display equations: centred KaTeX, **unnumbered**. Several "equations" are themselves interactive (hover-linked coloured terms; the eigen-decomposition row with dotted underlined coefficients).
- Footnotes: Distill v1 `dt-fn` elements (superscript number, e.g. "decay.²"). Citations are `dt-cite` shown as blue bracketed "[1, 2, 3]" / "[7]". The template shows both as hover boxes (hover not exercised). The reference list is at the end.
- Margin notes: `figcaption`s placed in the right margin at x=1070, 120 px wide, 13 px grey sans, aligned with the top of their figure ("When an eigenspace has converged…"). The hero caption sits to the right of the sliders under the figure.
- Interactive figures: 21 `figure`s, 124 svg, 5 canvas. Frameless or thin-grey-bordered plots wider than the text. Controls are custom sliders (orange knob on a grey track with tick labels, title "Step-size α = 0.02") directly under the plot, plus draggable handles inside the plot (hand-cursor "Starting Point" marker). There are no reset buttons, and instructions sit in the captions.
- No previous/next, search, theme switch or breadcrumbs (standalone article). Byline block (author, affiliation, date, citation) under the hero.

Visual: generous 20 px Georgia with 1.55 leading in a ~80-character column. Figures deliberately break out wider than the text, and small grey sans captions in the margin keep the column clean. Math is KaTeX at text size and looks integrated. The phone experience is broken by fixed-width figures (page scrolls to 1098 px).

Files: `distill-home-desktop-top.jpg`, `distill-page-desktop-top.jpg` (hero interactive + sliders + caption), `distill-page-desktop-scrolled.jpg` (display equations + paired figures), `distill-page-desktop-margin.jpg` (margin caption next to an interactive), `distill-page-phone-top.jpg`.

---

## 5. Seeing Theory (Brown University)

URLs: https://seeing-theory.brown.edu/ (home), https://seeing-theory.brown.edu/basic-probability/index.html (Chapter 1). Live, flagged "This site is archived for reference".

| item | value |
|---|---|
| body font | Assistant (Google Fonts 300/400/600/700), sans |
| size / line-height | 18 px / 25.2 px (1.4) |
| colour / background | #000 on #d6effa (light blue) |
| text column | 490 px (x=213); **~66 cpl** |
| h1 / h3 | Assistant 30 px w600 / 32 px w400 |
| layout 1440 | split screen. A left **text pane 576 px** scrolls (fixed header 576x128 with ☰ and chapter name, a blue progress bar under it). The **right visualisation pane 864x900 is `position:fixed`** and swaps per section. Chapter landing: intro text on the left, 3 section cards on the right |
| math | MathJax 2.7.1 HTML-CSS (cdnjs), 4 formulas only |
| fonts loaded | Assistant ×4, FontAwesome 4.7, MathJax_Main/Math-italic/Caligraphic/Size2 |
| weight | 67 requests, **1.39 MB**: html 20 kB, css 43 kB, js 703 kB (d3 151 kB, GTM 168 kB), images 450 kB (38 dice/icons), fonts 171 kB |
| load | 2.7 s |
| phone | no horizontal overflow, but **the split layout is kept**: the text pane is 156 px wide and the body paragraph is 133 px at 14/18.2 px (**~22 cpl**). The section cards squeeze in on the right |

Handling:
- Interactives: inline controls in the text pane (dice image, "Roll the Die", "Roll 100 times" buttons, draggable blue probability bars). The fixed right pane shows the corresponding d3 chart (running mean vs rolls). Instructions are prose paragraphs ("Change the distribution … by adjusting the blue bars"), with no caption or numbering and no reset button.
- Progress: a thin blue bar under the header shows scroll progress. "Next Compound Probability →" is a large block at the bottom. The menu (☰) lists chapters; language selector.
- No footnotes, equation numbers, figures with captions, search or theme switch.

Visual: a playful "scrollytelling" layout. Narrow sans text on pale blue on the left and a large white live chart on the right that stays put while you read. It works for short prose with one visual per section, not for equation-dense text (only 4 formulas on the page). The text slides under the semi-opaque header and overlaps it while scrolling, and the phone layout is unusable for reading.

Files: `seeing-home-desktop-top.jpg`, `seeing-page-desktop-top.jpg`, `seeing-page-desktop-scrolled.jpg` (text pane with dice controls + fixed chart pane), `seeing-page-phone-top.jpg`.

---

## 6. The Feynman Lectures on Physics (Caltech): UNAVAILABLE

URLs tried: https://www.feynmanlectures.caltech.edu/ and https://www.feynmanlectures.caltech.edu/I_04.html. Both returned a Cloudflare block page to the headless browser ("Attention Required! | Cloudflare. Sorry, you have been blocked. You are unable to access feynmanlectures.caltech.edu"; 6 requests, 30 kB). I made no attempt to get around it, so no measurements were taken. The site is live; the block targets automated browsers.

Files: `feynman-blocked-desktop.jpg` (the block page, as evidence).

---

## 7. Dive into Deep Learning (d2l.ai), Sphinx + d2lbook (Material Design Lite)

URLs: https://d2l.ai/ (home), https://d2l.ai/chapter_linear-regression/linear-regression.html (§3.1). Live.

| item | value |
|---|---|
| body font | Roboto (self-hosted woff), fallback "Noto Sans SC Sliced" |
| size / line-height | 16 px / 24 px (1.5) |
| colour / background | rgba(0,0,0,.87) on #fafafa |
| text column | 850 px (x=300…1150); **~125 cpl** |
| h1 / h2 / h3 | Roboto w400 #2196f3 (blue) 32 / 28 / 24 px, with numbers "3.1.1.1." and ¶ anchors |
| layout 1440 | left drawer 240 px (logo + collapsible global TOC, full height, own scroll); top bar 64 px blue with **breadcrumb** "3. Linear Neural Networks… › 3.1. Linear Regression", search icon, source icon; a second 64 px light-blue link bar (Preview, PyTorch/MXNet PDFs, Notebooks, Courses, GitHub, 中文版) that collapses on scroll ("waterfall" header); text 850 px; **right "Table Of Contents" 230 px, fixed** (x=1210, top 128), with the active-section highlight. The content scrolls inside `.mdl-layout__content`, not the window |
| math | MathJax 3.2.2 CHTML (jsDelivr); 138 math, 16 display |
| fonts loaded | Roboto 400, Material Icons, Font Awesome 5 brands/solid, MathJax TeX woff ×9 |
| weight | **196 requests, 2.15 MB**: html 209 kB (3 docs; page 159 kB), css 88 kB, js 508 kB, fonts 415 kB, images 926 kB (151 files), GTM 171 kB, plus a Discourse comments iframe |
| load | 2.7–4.1 s |
| phone | no overflow; the drawer collapses to a hamburger, the breadcrumb shrinks to the page title, and the link bar becomes horizontally scrollable. Wide display math (481 px) is inside `div.section` (overflow auto), so it scrolls in its box. The "Colab / SageMaker" buttons wrap into the first paragraph and break its lines (see the screenshot) |

Handling:
- Display equations: centred, with the **number flush right at the column edge: "(3.1.1)"** (`span.eqno`, float right) and a ¶ anchor on hover. References to equations and figures are orange underlined links "(3.1.1)", "Fig. 3.1.1". Citations are author–year orange links "(Gauss, 1809)".
- Figures: `div.figure` centred at natural size (255 px image in an 850 px column). The caption is centred below in 16 px with an italic label: "*Fig. 3.1.1* Fitting a linear regression model…". No zoom.
- Code: framework tabs (PYTORCH / MXNET / JAX / TENSORFLOW) over grey code blocks with a copy button; "Colab [pytorch]" and "SageMaker Studio Lab" launch links next to the h1; 34 `pre`.
- Previous/next: two large half-width buttons at the end ("Previous 3. …", "Next 3.2. …"). Search: yes. Breadcrumbs: yes. Exercises section; Discussions iframe at the bottom (21388 px tall). Notation page in the global TOC ("Notation"). No footnotes on this page, no theme switch, no sidenotes.

Visual: a three-column documentation layout: left TOC, wide text, right fixed outline with a scroll-spy. Equations are centred with numbers at the far right of an 850 px column, so the eye travels a long way from equation to number. Blue headings and orange links are loud for a textbook. In this headless render Roboto shows uneven letter spacing ("predict ing"), possibly a local hinting artefact, but it makes the body look gappy.

Files: `d2l-home-desktop-top.jpg`, `d2l-page-desktop-top.jpg`, `d2l-page-desktop-scrolled.jpg` (numbered display equations, scroll-spy), `d2l-page-desktop-figure.jpg` (figure + caption between equations), `d2l-page-phone-top.jpg`.

---

## 8. QuantEcon: Intermediate Quantitative Economics with Python (Jupyter Book, quantecon-book-theme)

URLs: https://python.quantecon.org/ (redirects to /intro.html, the contents list), https://python.quantecon.org/linear_algebra.html (Lecture 2). Live.

| item | value |
|---|---|
| body font | "Source Sans Pro" (Google Fonts 400/400i/700) |
| size / line-height | 18 px / 27 px (1.5) |
| colour / background | #444 on #fff |
| text column | 900 px (x=270…1170); **~123 cpl** |
| h1 / h2 / h3 | PT Serif w900: 36 px #333 (#0072bc blue in the render) / 30.6 px #444 / 25.2 px #444, numbered "2.2.1." with # anchors |
| layout 1440 | fixed top toolbar 51 px (☰, home, QuantEcon logo; right side: search, fullscreen, font size +/−, light/dark toggle, download, launch notebook ▶, PDF, GitHub). The left site nav 300 px is off-canvas (hidden until ☰). Text 900 px. **Right "On this page" 200 px, sticky** (x=1224) with the active-section highlight, "Powered by Jupyter Book", and a "↑ Top" link that appears on scroll. A "Last changed" dropdown under the title with a thick blue rule |
| math | MathJax 3.2.2 CHTML (jsDelivr); 403 math, 43 display |
| fonts loaded | Source Sans Pro ×3, PT Serif 700, Font Awesome 6 (solid/regular/brands), MathJax TeX woff ×9 |
| weight | 59 requests, **1.86 MB**: html 32 kB, css 110 kB, js 1.07 MB (Font Awesome all.min.js 553 kB, MathJax 205 kB, GTM 181 kB), fonts 502 kB, images 145 kB |
| load | 1.8–2.0 s |
| phone | no page overflow; the toolbar keeps its icons (some hidden), the TOC disappears, and the text is 326 px, 16/24 px, ~49 cpl. **Wide display math is clipped**: `div.math` has `overflow-x:hidden` and the inner `mjx-container` has `overflow-x:auto`, so the right end of the eq. (2.1) system is cut off at the screen edge, with no visible scroll cue. The number "(2.1)" is pushed to its own line between the equation rows |

Handling:
- Display equations: centred, the **number on the right "(2.1)"** (`.eqno`, float right, x≈1104–1170), vertically centred on multi-line systems.
- Footnotes: bracketed "[1]" superscript links (`footnote-reference brackets`) to an `aside.footnote-list` at the page bottom. 9 elements carry tippy hover-tooltip attributes (which ones was not determined).
- Collapsibles: admonitions "Note", "Exercise 2.1" (numbered, styled box), "Solution" as `dropdown toggle toggle-hidden` (closed by default).
- Figures: matplotlib output images centred at natural width (399–794 px) directly under their code cell, with no figure numbers or captions on this page. Code cells: grey box with a blue left rule and copy buttons (42 `pre`).
- Code/notebook links: toolbar download (ipynb/py), launch ▶ (Colab/JupyterHub), PDF, GitHub. Search: yes. Theme switch: yes (sun icon). Font-size controls: yes. Previous/next: not detected as links at 1440 (the theme places them in the footer/toolbar). Breadcrumbs: none.

Visual: the cleanest documentation-style page of the set. Light grey toolbar, a single wide text column, a quiet right outline with a scroll-spy, and bold PT Serif headings in blue. But the 900 px column at 18 px gives ~120-character lines, and body text in #444 grey sans sits next to black serif math (MathJax TeX), which looks heavier than the text. Equation numbers sit at the far right, separated from short equations by large gaps.

Files: `quantecon-home-desktop-top.jpg`, `quantecon-page-desktop-top.jpg` (display equations, numbers, outline), `quantecon-page-desktop-figure.jpg` (code cell + figure + scroll-spy), `quantecon-page-phone-top.jpg` (clipped equation).

---

## Comparison

| site | theme / generator | text font | size / lh | measure (cpl) | layout at 1440 | sidenotes | math engine | weight (req) | interactives |
|---|---|---|---|---|---|---|---|---|---|
| micro-book | MkDocs Material, light/dark | CMU Serif (web) | 16 / 1.6 | ~123 | sticky top 48 + tabs; left nav 242 (with TOC); text 938 | no (bottom footnotes) | MathJax 3.2 CHTML | 6.90 MB (38), 5.7 MB search index | iframe: JSXGraph plot + control card (slider, readouts, Reset), numbered caption below; WebR code cells |
| ILA (Georgia Tech) | PreTeXt, light | CharterBT (web) | 18 / 1.25 | ~91 | single 739 px page on grey; toolbar fixed on scroll; TOC hidden | no | pre-rendered SVG (KaTeX in demos) | 0.55 MB (21) | full-width iframe 3-D scene, dat.GUI overlay, fullscreen button, italic numbered caption; knowls |
| Immersive LA | custom, light | browser default Times | 16 / normal | ~186 | full-width text, floating Menu button | no | MathJax 2.7.5 SVG | 0.78 MB (35), slow build | framed canvases, number badge, Backward/Reset/Forward + step dots, boxed numbered caption |
| Distill (momentum) | Distill v1, light | Georgia (system) | 20 / 1.55 | ~81 | text 648 centred; figures 750–984; margin 120 px | yes (margin figcaptions; hover footnotes/cites) | KaTeX | 1.85 MB (30), 1.4 MB data | inline wide figures, custom sliders + drag handles, captions in margin, no reset |
| Seeing Theory | custom, light-blue | Assistant (web) | 18 / 1.4 | ~66 | split: text pane 576 + fixed viz pane 864 | no | MathJax 2.7.1 HTML-CSS | 1.39 MB (67) | controls inline in text, chart in fixed side pane, no captions/reset |
| Feynman Lectures | — | — | — | — | blocked by Cloudflare | — | — | — | — |
| d2l.ai | Sphinx/d2lbook (MDL), light | Roboto (web) | 16 / 1.5 | ~125 | left drawer 240; top bar 64 (+64 collapsing); text 850; fixed right TOC 230 | no | MathJax 3.2 CHTML | 2.15 MB (196) | none inline; code tabs, Colab/SageMaker launch links |
| QuantEcon | Jupyter Book (quantecon theme), light/dark | Source Sans Pro (web) | 18 / 1.5 | ~123 | fixed toolbar 51; nav off-canvas; text 900; sticky right TOC 200 | no (bottom footnotes) | MathJax 3.2 CHTML | 1.86 MB (59) | none inline; notebook launch/download; dropdown solutions |

Total size of this folder at time of writing: ~2.6 MB (27 JPEGs, each ≤ 180 kB, plus JSON and scripts).
