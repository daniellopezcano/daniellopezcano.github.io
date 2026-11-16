# Phase 2: make the course section a first-class lecture-notes site, and finish the port

This continues the work described in `_port/KICKOFF.md`. Everything in that brief still applies, above all its "Rules that are not negotiable", except where this brief changes something explicitly.

## Where things stand

- I reviewed the pilot and approved it. It is merged into `main` and live at `/notes/diffgeo-gr/`. Record the approval and the answers below in `_port/PROGRESS.md` before doing anything else.
- The transcription is faithful, and that must not change. What I want now is presentation: today the pages read like the PDF poured into my site's template. I want the course section to be one of the best lecture-notes sites on the web: something students enjoy reading and come back to. It should be structured so that a reader always knows where they are in the course and how the current concept connects to what came before and what comes next, with small interactive panels where they help understanding.
- Keep working on the branch `course-diffgeo-gr` (it now starts from the merged `main`). The Git rules are unchanged: commit often, never push, never merge, never rewrite history.

## My answers to the pilot questions

1. **Navbar label and address:** keep "Lecture Notes" and `/notes/diffgeo-gr/`. The address is now public. Any page address that already exists must keep working; add a redirect if you move a page.
2. **PDF:** yes. Replace the old file in place with the compressed copy of the current build, regenerate its thumbnail, and point both cards on the Teaching page and the landing page to it.
3. **Cover date:** show it as "Last updated", using the date of the most recent commit in the notes repository that touched a file `main.tex` includes.
4. **Figure weight:** keep 1800 px. Make sure figures below the fold load lazily.
5. **Interactive figures:** build the top twelve of your ranking in `PLAN.md`. How they are presented is part of this redesign.
6. **Reading layout:** decide as part of the redesign (see below).
7. **Math engine:** decide as part of the redesign. Match the PDF where it matters (the arrays with vertical rules). Moving to MathJax 4 is fine if it holds up on every equation of the notes and on the runic symbols.
8. **Web-only wording:** approved for now. I will review the full list in `REVIEW.md` before the final merge.
9. **Notes repository:** I'll decide later whether to make it public. Keep the copyright text verbatim.

## What you are free to change

- **The course section's whole presentation:** layout, typography, colour, navigation, page structure, components, and how figures, equations, footnotes, proofs, examples and interactive panels are shown.
- **You may move the course section off Quarto's page templates, or off Quarto entirely,** if that is what it takes to get it right. Decide based on what you find, and write the reasoning in `DECISIONS.md`. The rest of the site stays a Quarto site, unchanged. These constraints hold whatever you choose:
  - One documented command builds the whole site. GitHub Pages still serves it from `docs/` on `main`.
  - A full `quarto render` must never delete or break the course pages. Check how the installed Quarto treats the output directory (cleaning, `resources`, `post-render`) and test it.
  - Course pages carry the same site navbar (same links, same look), so the section still feels like part of my site and a reader can always get back to the rest of it.
  - Search finds the course content, whether through the site search or a search of the course's own.
- **Light or dark:** my site is dark, while the notes and most figures are white. Propose what works best for long mathematical reading. A reader-selectable theme is an option.
- **Reuse what works.** The converter, the numbering from the LaTeX build, the fidelity check, the figure pipeline and the interactive core stay. The redesign changes how things are presented. Don't rewrite working parts without a reason, and record the reason in `DECISIONS.md` if you do.

## What stays fixed

- Every rule about content: the sentences, equations, notation, numbering and order of the notes appear exactly as written. Pages are generated, never hand-edited. The notes directory is read-only.
- **New element: an inline panel that shows content from somewhere else in the notes** (for example a proof from Appendix B opened where it is referenced, or a worked example from Appendix C). It shows that content exactly, labels it with its number, and links to its canonical place. The canonical place stays where the notes put it.
- Every word you author (labels, hints such as "drag the point", headings of web-only panels) is part of the web layer: visibly separate from the notes, minimal, in the notes' notation, and logged in `REVIEW.md`.
- The rest of my site renders exactly as it does today.

## Study first

Look at the reference sites below in a headless browser, not just their text. Take screenshots of the pages that matter into `_port/design/refs/`. Write `_port/DESIGN.md` with, for each site, what is worth taking for my notes, what is not, and why. Check each address works; replace any that don't with an equivalent you find.

- https://darciogm.github.io/micro-book/ (my colleague's notes, the starting point)
- https://textbooks.math.gatech.edu/ila/ (Interactive Linear Algebra: a math textbook on the web with inline interactive demos)
- https://immersivemath.com/ila/ (Immersive Linear Algebra: figures as the main medium)
- https://distill.pub/ (margin notes, figure design, interactive explanations inside the text)
- https://seeing-theory.brown.edu/ (small, focused interactive panels)
- https://www.feynmanlectures.caltech.edu/ (a classic physics text on the web: equations, figures, navigation)
- https://d2l.ai/ and https://python.quantecon.org/ (long technical courses: navigation, page structure, links to code)

Then think about which of these ideas fit my notes. They are possibilities, not requirements:

- **Navigation:** a course map as navigation (the roadmaps already link concepts to sections). Breadcrumbs, a progress indicator, and previous/next links with titles. Keyboard navigation. A chapter opening page with the chapter's roadmap excerpt, its sections, and the related proofs (B) and examples (C).
- **Reading:** a typeface and measure designed for long mathematical text; sidenotes in the margin instead of footnotes at the bottom; display equations, numbers and references that read as well as in the PDF.
- **Connections:** hover previews for every reference. Defined terms that link to their definition and show it on hover. A generated index of definitions, and a notation page built from the notes' own tables. "Used in" back-links from a definition to the places that rely on it.
- **Appendices in context:** proofs and worked examples openable inline where the text refers to them.
- **Interactive panels:** one consistent component that is compact and sits next to the concept it illustrates, with a reset button, a link to the relevant notebook of my Python package where one exists, and the static figure always available.
- **Study aids:** marking sections as read (stored in the browser), a print-friendly view, copying the LaTeX source of an equation.

## The one stop: design direction

1. Build two or three distinct design directions, each applied to the same real pages: the landing page, §2.1, §4.1 with its figures, a proof-heavy page from Appendix B, and the page of C.6 with its interactive figure.
2. Take screenshots of each at desktop and phone widths into `_port/design/`, and give me a single command to preview them locally.
3. Recommend one in `DESIGN.md`, with reasons.
4. Then stop and ask me to choose. Mark the stop in the ledger.

Keep the first line of `PROGRESS.md` as `PHASE: design` until I have chosen; the launcher uses it to pick the model. After my choice, record it, set `PHASE: bulk`, and continue to the end without stopping. Stop again only for something that can't be undone or that contradicts a rule.

## After I choose: milestones

The site is live, so work in milestones. Each milestone leaves the branch in a state I could publish. When one is reached, say so at the top of the ledger and in your message to me, and I will merge it.

1. **Design:** the chosen design implemented as the course's design system and applied to every page that already converts.
2. **Content complete:** the four pages that still fail, the front matter (copyright, licence, funding, About the Author), the bibliography, the list of figures, the notation and definitions index, and the PDF answer above.
3. **Interactives:** the top twelve, built in the new panel component.
4. **Polish:** a page-by-page review of screenshots at desktop and phone widths, against the PDF for fidelity and against the design for quality. Fix what a careful reader would notice.

## Definition of done

`_port/check.sh` keeps all its current checks and adds:

- An accessibility check of every course page with an automated tool (contrast, keyboard access, labels), with no serious violations.
- A weight budget per page (HTML, CSS, JS and images loaded before interaction), which you set in `DESIGN.md` and enforce.
- A check that a full `quarto render` followed by the course build leaves the course pages intact.
- A check that every page address that existed at the pilot still resolves.

At the end, update `_port/REPORT.md`: what changed in this phase, the design decisions, how to build and preview, and what is waiting in `REVIEW.md`.

## Working habits

`_port/MODELS.md` still applies: delegate repetitive units to `port-worker`, send checks and screenshot reviews to `port-checker`, and keep sessions short. Commit and update the ledger after every unit, so that a restart loses at most one unit.
