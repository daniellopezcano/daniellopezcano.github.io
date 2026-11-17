# CV page: how it is built, and what to check

`cv.qmd` is generated from the LaTeX CV by `_cv/build.py` (branch `cv-page`, 2026-11-17). Command and options:
`python3 _cv/build.py --help`. The LaTeX folder is only read (`--src`, `$CV_SRC`; default
`/home/dlopez/Documentos/2.documentacion/CV_DanielLopezCano`); compile `main.pdf` there yourself first.

## Why a script (and not a hand conversion)

The document class is `curve`, but main.tex does not use its rubrics: every entry is one of its own macros
(`\cvevent`, `\cvitem`, `\cvitemlogo`, `\skillentry`, `\pub`, `\SectionHead`, `\CompactSubsecTitle`, ...), with
regular arguments. Reading those macros is simple, so a script is practical. It knows a fixed table of inline
commands and math snippets; anything new stops the build with `main.tex:<line>`, so nothing is dropped silently.

## Decisions

1. **Text is the LaTeX text.** No rewording, reordering or corrections; typography as TeX prints it
   (`--` → –, ``` ``…'' ``` → “…”, `'` → ’, `\,` → narrow no-break space, `~` → no-break space). Math is
   typeset by hand from a table (α, ·, ×, 10¹² h⁻¹ M⊙), so the page needs no MathJax.
2. **Private data left out of the HTML** (the build prints it as `note: left out as private`, and
   `privacy_check()` fails the build if a phone number, a street address, a postcode or ID/birth data reaches
   the page): the two phone numbers and the postal address (IFUSP street address with its Google Maps link)
   of the header. main.tex has no date of birth, nationality or ID number. **Kept** on purpose: both email
   addresses, website, GitHub, Google Scholar, ORCID, and the two FAPESP grant process numbers
   (2024/05768-9, 2025/24623-4), which are public on bv.fapesp.br and identify grants, not a person.
   The PDF itself is published as compiled, so it still carries the phone numbers and the address (as the
   previous PDF did). To drop them from the PDF too, remove them in main.tex and rebuild.
3. **Layout for the web, not the PDF's.** Appointments, education and industry use the site's trajectory
   cards (`.trajectory-entry`); grants, skills and publications are cards like `.minimal-panel`; the
   two-column page becomes one column of compact rows (year · tag · title · place/date). Section titles keep
   the CV's wording; CSS shows them all in capitals (the PDF mixes capitals and title case). Removed as PDF
   decoration only: the " - " between a section icon and its title, the "–" between a role and its
   institution (the role is now a heading), the page footer, and the colours/gradients of TikZ.
4. **Publication links** are buttons labelled with the words of the PDF's legend ("arXiv", "journal",
   "code"); the legend line itself is therefore not repeated. Publication numbers follow the PDF's counter
   (1–7, continuing across "Refereed" and "Submitted").
5. **Icon-only links** (globe, GitHub, link, YouTube, arXiv) get an accessible name made from the icon kind
   and the address, e.g. `GitHub: daniellopezcano/instance_halos`, `Website: dipc.ehu.eus`.
6. **Broken link in main.tex fixed on the page only** (`LINK_FIXES` in the script; the build prints a note
   each time): `https://daniellopezcano.github.io/notes` (404, the site has no /notes page) points to
   `notes/diffgeo-gr/` in the differential-geometry course entry and to `notes/lya-forest/` in the Lyα notes
   entry. Fix main.tex and the entries in `LINK_FIXES` stop applying.
7. **Images.** Logos that the site already has (byte-identical files in `assets/img/logos/`) are reused; the
   photo and the Simons / MIAPbP logos are web-sized copies in `assets/img/cv/`.
8. **PDF.** `assets/files/DLC_CV.pdf` (same address as before) is main.pdf through Ghostscript with images
   downsampled to 600 ppi and kept lossless (Flate, no JPEG). The build keeps it only if it saves ≥ 10 % and
   has the same page count, the same extracted text, the same web links and the same rendering at 150 dpi;
   otherwise it copies main.pdf unchanged. Nov 2026: 1.58 MB → 0.55 MB; compared by eye at 300 and 600 dpi,
   no difference. `_cv/pdf_source.txt` records which main.pdf it came from (rebuilds skip the PDF step
   when main.pdf is unchanged; `--force-pdf` redoes it).
9. **Page frame.** The page keeps its title "CV" (shown like every page's title; navbar, browser tab,
   search) and its description, which stays in the page's metadata but is no longer displayed (cv.css): the
   CV's own header (name, role, contact, photo, Download PDF button, PDF thumbnail) follows the title.
   Greek letters are set in a serif face, because the site font's italic α reads as an "a". Styles: `assets/css/cv.css`, loaded only by cv.qmd;
   `styles.css` is unchanged.

Web-only strings (not in main.tex): "Download PDF" and "Preview of CV PDF" (both from the old page),
"Portrait of Daniel López-Cano" (photo alt), the accessible names of icon links (decision 5).

## Typos and slips noticed in main.tex (not corrected on the page)

- The last publication sits under the heading **"Submitted"** but carries the badge **"To be submitted to
  ApJ"**; the two say different things.
- Spelling of Lyman-α varies: "Lyman-α" (header, IFUSP topics), "Ly-α" (most entries), "Lyα" (summary of
  the last publication).
- "simulation based inference" (EDUCATION, PhD topics) is usually hyphenated: "simulation-based inference".
- "Agorá Meeting DFMA": the Portuguese word is "Ágora".
- MSc institution "Institute of Theoretical Physics IFT UAM-CSIC" has no parentheses, unlike the other
  entries ("… (IFUSP)", "… (IFAE)", "… (DIPC)").
- Header "FAPESP Postdoctoral Fellow" vs. the appointment "FAPESP Postdoctoral Research Fellow".
- PDF footer "Daniel Lopez-Cano" has no accent (the header has "López-Cano"); the footer is not on the page.
- The link `https://daniellopezcano.github.io/notes` (Teaching: two entries) is a 404 (decision 6).

## The CV and other pages disagree (other pages not changed)

- Research & Publications, "Where the Forest Goes Dark": "arXiv preprint"; CV: under "Submitted", badge
  "To be submitted to ApJ".
- Research & Publications, OJALÁ: role "Collaboration"; CV: "Co-author".
- Research & Publications, instance segmentation: "Jens Stüker"; CV: "J. Stücker" (the Research page looks
  like the typo).
- Home, Trajectory: IFAE "Barcelona area" vs. CV "Cerdanyola del Vallès / Barcelona"; PhD thesis title
  "… and ML techniques" vs. CV "… and machine learning techniques"; PhD supervisor "Raúl E. Angulo de la
  Fuente" vs. "Raúl E. Angulo"; MSc "Institute of Theoretical Physics (IFT) / Universidad Autónoma de Madrid
  (UAM)" vs. "Institute of Theoretical Physics IFT UAM-CSIC"; BSc theses "Theory / Applied" vs. CV
  "Theoretical / Experimental"; BSc department link differs from the CV's.
- Teaching & Projects, MSc supervision: topic "Cosmological simulations and Lyα systems" vs. CV
  "High-column-density absorbers in the Ly-α forest".
