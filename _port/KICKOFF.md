# Put my lecture notes "From Differential Geometry to General Relativity" on my website

## What I want

I wrote a set of LaTeX lecture notes for my graduate course *From Differential Geometry to General Relativity*. Today my website only offers them as a PDF download. I want the full notes readable online, as a proper course section of my personal site: same content, same notation, same figures, laid out for the web, with interactive figures added wherever they help a student understand a concept better than the static figure can.

The notes are written the way I like to explain the subject: bulleted definitions, colour-coded defined terms, roadmap diagrams that show the overall structure, footnotes, and appendices with proofs and worked examples. The web version should feel like those notes, in my site's visual style, and be easier to navigate than the PDF.

The notes are 176 pages: ten chapters and three appendices. This is a large job that will span several sessions. Set it up so that any session can stop at any moment and a fresh one can pick up without losing work (see "Tracking and restarts").

## Where everything is

**Website repo: the current working directory.** What I know about it, so you don't have to rediscover it:

- Quarto website project (`_quarto.yml`, `type: website`), last rendered with Quarto 1.9.37. Theme `darkly` plus my own `styles.css`, which defines the palette as `--dlc-*` CSS variables and the card components used across the site.
- `output-dir: docs`, and `docs/` is committed. GitHub Pages serves the live site from `docs/` on `main`. Anything merged to `main` is published.
- The body has a fixed animated GIF background with a dark overlay, global `toc: false`, and `body-width: 1080px`. That suits the card pages but not long-form reading, so the course pages need their own layout settings (a `_metadata.yml` in the course directory is one way).
- Navbar: Home, Research & Publications, Teaching & Projects, Outreach, CV.
- `teaching_and_projects.qmd` has two cards for these notes (under "Courses & Schools" and "Lecture Notes") that link to `assets/files/docs/from_differential_geometry_to_general_relativity.pdf` and to the GitHub package.
- The repo is already heavy (about 95 MB of assets, including a 16 MB background GIF). Keep what you add small.

**Lecture notes source (LaTeX): the directory added with `--add-dir`:**
`/home/dlopez/Documentos/0.profesional/Postdoc/USP/Projects/learning_cosmology/lecture_notes_differential_geometry_GR/from_diff_geom_to_GR`

This is the source of truth. What I know about it:

- Entry point `main.tex`, built with XeLaTeX (latexmk). The current build, `main.pdf` in that directory, is 176 pages, dated October 2026.
- Layout: `Chapters/` (one file per chapter; Tangent Spaces and Fields are split into the subfolders `Tangent_spaces/` and `Fields/`), `Appendices/open_code.tex`, `Appendices/proofs_and_comments/` (one file per proof or comment), `Appendices/examples_and_exercises/` (one file per worked example), `plots/`, `fonts/`, `references.bib`.
- Contents of the current build: cover; a copyright, licence (MIT) and funding page; dedication and epigraph; About the Author; Ch. 1 Introduction with §1.1 "Roadmaps of the Notes"; Ch. 2 Vector Spaces; Ch. 3 Topological Manifolds; Ch. 4 Tangent Spaces; Ch. 5 Fields; Ch. 6 Covariant Derivative; Ch. 7 Metric; Ch. 8 Integrals; Ch. 9 Newton-Cartan Theory; Ch. 10 General Relativity; Appendix A Computational resources; Appendix B Proofs & Comments (22 sections); Appendix C Examples (9 worked examples, C.1–C.9); Bibliography.
- **Publish exactly what `main.tex` includes, nothing more.** The tree contains files that the current build does not include or that are unfinished (for example `Symmetries.tex`, `epilogue.tex`, and some appendix files; the PDF has a few "??" references pointing at them). List them in the inventory and leave them out. When I include them in `main.tex` later, re-running the converter should pick them up.
- Figures come in two kinds. `plots/*.pdf` and `plots/exercises/*.pdf` were made with my Python package. TikZ sources are in `plots/*.tex` (four roadmaps: master, vector spaces, manifolds to fields, connection/metric/integrals; light cones; Newton-Cartan; integration charts; metric variation) and `Chapters/fig_eh_chain_rule.tex` (a full-page flowchart of the variation of the Einstein–Hilbert action).
- **Runic letters are mathematical symbols in these notes**, hundreds of times: the variation parameter and the variation field in the calculus of variations, the change-of-basis matrix, and others. They are typeset with the Noto fonts in `fonts/` (there is a cuneiform font too). On the web they must be the same glyphs, rendering correctly inside inline and display math, including in sub- and superscripts, on machines that don't have those fonts installed. Treat this as a known hard point and prove it works in the pilot.
- LaTeX build products (`main.aux`, `main.toc`, …) are already in that directory. You may read them, but they can be stale. For numbering, compile a scratch copy and confirm it matches `main.pdf`.
- The copyright page points readers to `github.com/daniellopezcano/lecture_notes_differential_geometry_GR` for the source. Check whether that repository is publicly reachable and note the answer in `_port/REVIEW.md`.

Go by the source, not by this description.

**The PDF currently on my website is out of date**: it is a 73-page May 2026 build. The current `main.pdf` is 27 MB, which is too heavy to commit twice (`assets/` and `docs/`) without thinking. At the pilot stop, propose how to offer the current PDF (a compressed copy, or a link to where the latest version lives) and what to do with the old file and its thumbnail. Don't copy the 27 MB file into the repo before I answer.

**My Python package:** https://github.com/daniellopezcano/differential_geometry (JAX, matplotlib, plotly). It produced almost all the figures in the notes; see `differential_geometry/`, `plotting_tools/` and `notebooks/`. Look for a local clone near the notes directory first; otherwise clone it into a git-ignored scratch location.

**Reference for the kind of result I liked:** https://darciogm.github.io/micro-book/cap01/maximizacao/ (a colleague's lecture notes as a MkDocs Material site with interactive resources). Look at that page and a few neighbours. Take ideas about how a course is organised for students: persistent chapter navigation, a notation page, a glossary and index, concept maps, interactive elements embedded where the concept is explained. Do not copy its look or its structure. My site stays a Quarto site in my own style.

## Rules that are not negotiable

1. **The content stays exactly as I wrote it.** Every sentence, equation, symbol, index placement, footnote, caption, table and list in the notes appears on the website unchanged, in the same order. No paraphrasing, no summarising, no reordering, no "improving" the wording, no silently fixed typos. If you spot a typo or a mathematical slip, leave it and log it in `_port/REVIEW.md` so I can fix it in the LaTeX. This matters because the wording is how I teach the subject, and because the PDF and the website must never disagree.

2. **Build a converter; do not retype the notes.** The notes are still in preparation and I will keep adding chapters. I need to be able to re-run one command after editing the LaTeX and get updated pages. So the pages must be generated from the LaTeX by a deterministic pipeline (Quarto ships pandoc as `quarto pandoc`; add your own filters or preprocessing for my macros and environments). When a construct doesn't convert well, teach the converter to handle it rather than hand-editing its output. Generated files carry a "generated, do not edit" header. Everything that exists only on the web (landing page, navigation, CSS, interactive figures, the mapping that says where each interactive goes) lives in separate hand-written files, with interactives attached to the text by LaTeX label, so regeneration never destroys them.

3. **Notation is preserved by reusing my macros, not by rewriting math.** Extract the macro definitions from my preamble into one shared math configuration so the equation source on the web is literally the source in the notes. Numbering must match the PDF: chapters, sections, equations, figures, tables, footnotes, appendix letters. The reliable way to get those numbers is from the `.aux` of a real LaTeX build. As far as I know, Quarto cross-references across pages only work natively in book projects, not website projects; check this on the installed version and choose a structure accordingly.

4. **The notes directory is read-only.** Never write there, including LaTeX build products. Copy the source to a git-ignored scratch directory to compile it. `git -C <notes dir> status` must be clean whenever you finish a session.

5. **Git.** Work only on the branch `course-diffgeo-gr`. Commit small and often. Never push, never merge into `main`, never rewrite history. I will review and publish myself.

6. **Leave the rest of my site alone.** The only changes outside the new course section are: one new navbar entry, and a "Read online" button on the two existing cards in `teaching_and_projects.qmd`. No restyling of existing pages, no changes to global behaviour that would alter how they render.

7. **Web-only additions are visibly separate from my text.** Interactive figures, navigation aids and any label or caption you write must be recognisable as a web layer (for example a consistent "Interactive" frame), so a reader can always tell what is the notes and what is an add-on. Keep any text you write for them minimal, use the notes' own notation and terms, and list every sentence you authored in `_port/REVIEW.md` for my approval.

## The reading experience I'm after

- A new navbar entry leading to a course landing page: title and subtitle from the cover, the dedication and epigraph, a way into each chapter, the PDF, and the link to the Python package. The master roadmap of §1.1 is the natural map of the whole course; consider making it the way in.
- The front matter keeps its place in the course section: the licence and the funding statement appear verbatim (the FAPESP acknowledgement and disclaimer, in both languages, are an obligation), and About the Author is included as written. The bibliography gets its own page, with citations in the text linking to it.
- The notes have their own visual identity (navy cover, blue headings, coloured roadmap boxes). It is close to my site's palette; bring the two together rather than picking one and discarding the other.
- A persistent sidebar mirroring the notes' table of contents, appendices included; an "on this page" outline; previous/next links. Pages split at a granularity that reads well on screen (per section is my guess; you judge after seeing the source).
- My colour coding of defined terms is part of the pedagogy. Keep the same colour meaning as in the notes, with shades adjusted so they are legible on the dark background.
- Long-form text needs a calm, high-contrast reading surface. The animated background must not sit behind paragraphs and equations.
- Footnotes readable without losing your place (margin or hover).
- Every cross-reference is a working link, ideally with a hover preview: equations, figures, tables, sections, and especially the references into the appendices (proofs in B, worked examples in C) and back.
- Original figures at full quality with click-to-zoom. Many have white or light backgrounds; handle that deliberately on a dark page. TikZ diagrams should be compiled from my source to vector graphics, not redrawn.
- The four roadmaps of §1.1 and the full-page Einstein–Hilbert flowchart in Ch. 10 are dense, page-sized diagrams. They must be comfortably readable on a screen (zoom and pan at least). The roadmap boxes already carry badges naming the chapter, section or equation where each object is defined ("Ch. 3", "§4.1", "Eq. (6.1)"). If it is feasible without redrawing the diagrams, make those boxes link there; check whether the TikZ source already has hyperlinks that survive conversion to SVG.
- Tables as real HTML tables that keep my colours and structure.
- Works on a phone: navigation collapses, wide equations scroll instead of breaking the layout.
- Site search finds course content.
- References to chapters that are not written yet (they show as "??" in the PDF) appear as a discreet "in preparation" marker, not as "??". The introduction's chapter-by-chapter outline stays as written.
- My private author notes in the source (red "DLC: …" to-dos and similar) are not rendered. List them in `_port/REVIEW.md`.
- Optional, after everything else is solid: an index of definitions generated automatically from my defined-term macros, linking each term to where it is defined.

## Interactive figures

The test for each one: what does a student understand by manipulating this that the static figure cannot show? If there is no good answer, don't build it. An interactive figure accompanies the original figure and never replaces it.

Constraints:

- The site is static (GitHub Pages), so everything runs in the browser. My package depends on JAX and cannot run there. Where an interactive needs the same geometry as my static figures (the same surface, charts, curves, colours), use the package offline to export compact data and render it in JavaScript. Where the maths is simple, compute it directly in JavaScript.
- One small, consistent stack for all of them, loaded once per page and only on pages that need it. Do not embed a full plotting library per figure (no standalone Plotly HTML dumps). Set yourself a page-weight budget and keep to it.
- Styled with my palette. Controls labelled in the notes' notation with rendered math. Usable with keyboard and touch. If JavaScript fails, the static figure is still there.

Candidates I can see from the PDF, by chapter. Confirm each against the source, drop the weak ones, add better ones you find. The worked examples in Appendix C are the richest ground, because each already has a concrete manifold, concrete formulas and figures made with my package.

- **Ch. 2 / C.1.** Injective, surjective and bijective maps: rewire arrows between two finite sets and see the classification change, including the "not a function" case. The polynomial vector space: coefficient sliders for addition and scalar multiplication; the same polynomial decomposed in the monomial basis and in the Legendre basis. Transformation laws: drag the basis vectors of a 2D space and watch vector components change contravariantly while a covector's components change covariantly.
- **Ch. 3 / C.2.** Charts and transition maps: a point in the overlap of two chart domains, linked to its images in both charts; move it and see the transition map act.
- **Ch. 4 / C.3.** Smooth functions as a vector space on the surface, with a slider for the scalar. Tangent space: curves through p, their velocities, the tangent plane, and the velocity components in two charts; switch charts and see the components change while the vector does not. Sum of tangent vectors and why adding curves depends on the chart. Cotangent space: a covector as a differential, with level sets, acting on a tangent vector.
- **Ch. 5 / C.4.** Tangent and cotangent bundles of a ring. Vector fields in two charts, a scalar field and its differential, and a vector field acting on a scalar field.
- **Ch. 6 / C.5.** Parallel transport of a vector along a curve under the three connections of the example (flat torsion-free, flat with torsion, curved torsion-free), side by side, with autoparallels.
- **Ch. 7 / C.6.** Variations of a curve with fixed endpoints: the meridian and the parallel of the paraboloid, with a slider for the variation parameter and the length of the varied curve plotted live, so the student sees which curve is extremal.
- **Ch. 8 / C.7.** Integrating over a region covered by two overlapping charts; integration on the circle.
- **Ch. 9 / C.8.** Newton-Cartan worldlines: without gravity, in the co-rotating chart (pseudo-forces appearing from a change of chart), around a point mass, radial free fall and tidal acceleration, and a non-stratified chart.
- **Ch. 10 / C.9.** Light cones along a worldline with an observer frame. The Schwarzschild slice with circles at equal radial distance crowding towards the Schwarzschild radius, next to the metric components.
- **Step-through for the Einstein–Hilbert flowchart**: the same diagram, revealed one step at a time, if that can be done without redrawing it.

That is more than twenty. Rank them by how much understanding each one adds, propose the ranking in the plan, and build from the top. A dozen excellent ones beat twenty-five mediocre ones.

## How to work

**First, understand before building.** Read the LaTeX source in full (structure, preamble, macros, environments, figures and how each was produced, labels, bibliography), my website repo, my package, and the reference site. Check the toolchain on this machine (Quarto, a TeX distribution, Python, Node, a headless browser). If something essential is missing and needs `sudo`, tell me exactly what to install instead of working around it. Keep environments project-local and git-ignored.

**Then write the plan and a pilot, and stop for my review.** This is the one planned stop:

1. Write `_port/INVENTORY.md` (what the notes contain: every chapter, section, figure, table, custom macro and environment, and anything that will be hard to convert) and `_port/PLAN.md` (architecture choices with a sentence of reasoning each, the page map, the list of interactive figures you propose and why, and the work broken into units).
2. Build a vertical slice, generated by the converter: the course landing page and navigation; one complete early section with equations, coloured definitions, footnotes, a figure and cross-references; one passage that uses the runic symbols in math (the variations in §7.2.1 are a good test); one roadmap as zoomable vector graphics; and one 2D and one 3D interactive figure.
3. Stop. Tell me how to preview it locally and list your open questions.

**After I approve, record the approval and any changes I asked for in `_port/PROGRESS.md`, then carry on through the rest without stopping to ask.** For choices that are cheap to change, decide, record the decision and the reason in `_port/DECISIONS.md`, and continue. Only stop for something that cannot be undone or that contradicts one of the rules above.

## Tracking and restarts

Everything needed to resume lives in the repo, on the branch, so a brand-new session with no memory of this one can continue. Directories starting with `_` are ignored by Quarto's renderer, which is why the working files go in `_port/` (verify this on the installed version).

- `_port/KICKOFF.md`: this brief. `_port/RESUME.md`: the prompt I send to restart.
- `_port/PLAN.md` and `_port/INVENTORY.md`: as above. Update the plan when it changes; don't let it go stale.
- `_port/PROGRESS.md`: the ledger. One row per unit of work with status (`todo`, `in progress`, `done`, `blocked`), the checks that passed, and the commit hash. At the top, a "Next action" paragraph specific enough that someone else could act on it, and a "State of the working tree" line. Update it when you start a unit and when you finish one, not only at the end of a session.
- `_port/DECISIONS.md`: decisions with reasons. `_port/REVIEW.md`: things I must look at (typos found, sentences you authored, author notes hidden, content the converter could not handle faithfully).
- `CLAUDE.md` at the repo root: a short section stating the rules above in brief, the commands to build, preview and check the site, and a pointer to `_port/PROGRESS.md`. Keep it short; it is loaded in every session.
- One commit per finished unit, with the ledger updated in the same commit. A session that dies mid-unit must leave at most one unit to redo.

## Definition of done

Provide one command (for example `_port/check.sh`) that runs all of these and ends by printing `ALL CHECKS PASSED` or a list of failures:

- The converter regenerates every page from the LaTeX and `quarto render` completes with no errors or warnings that concern the course pages.
- A fidelity check compares the text and math of the LaTeX source with the generated pages and reports no unexplained difference. Every accepted difference (hidden author notes, "in preparation" markers) is listed explicitly.
- In a headless browser, every course page loads with no math rendering errors, no console errors, no broken internal links or anchors, and every interactive initialises.
- Section, equation, figure, table and footnote numbers match the PDF built from the same source.
- Outside the course section, the rendered site differs from `main` only by the navbar entry and the two "Read online" buttons.
- The notes directory is unchanged.

Beyond the script: look at screenshots of every page at desktop and phone widths, side by side with the corresponding PDF pages, and fix what a careful reader would notice.

When everything passes, write `_port/REPORT.md`: what was built, where it deviates from the notes and why, what is waiting in `REVIEW.md`, how I re-run the pipeline after editing the LaTeX, how I preview locally, and what I need to do to publish.
