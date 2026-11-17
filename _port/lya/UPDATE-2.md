# Lyα course: update to the new version of the notes

I have revised the Lyα notes and written new chapters on two-point statistics. Update the course at /notes/lya-forest/ using the same pipeline, rules and design as before (see _port/lya/ and _port/KICKOFF.md). Work on branch lya-update. Never push or merge.

## 0. My folders have moved
- Website repo: /home/dlopez/Documentos/0.profesional/daniellopezcano.github.io
- Lyα notes: /home/dlopez/Documentos/0.profesional/Academic/4.Postdoc1/USP/Projects/SkewerJAX_Review_and_Equations
- Differential geometry notes: /home/dlopez/Documentos/0.profesional/Academic/4.Postdoc1/USP/Projects/learning_cosmology/lecture_notes_differential_geometry_GR/from_diff_geom_to_GR

Find every absolute path in the repo that still points to the old locations (course configuration such as _port/convert/courses.py, CLAUDE.md, _port/go.sh, scripts, checks) and update it. Both notes folders are read-only, as before. Commit this as its own unit.

## 1. New cut point
- The web course now runs, in document order, up to the part on **metal contamination models**, and stops just before it. Include every new chapter on two-point statistics that comes before that part. Leave the metal contamination models out, along with everything after them.
- Find that part by its title in the current source and record the exact cut in _port/lya/DECISIONS.md.
- The usual rules still hold:
  - Include an appendix only if the kept text refers to it.
  - A reference to a part that was left out shows the "in preparation" marker.
  - Numbering stays as in the full LaTeX build.
  - Text is exactly as in the source: no rewording, and typos are logged in _port/lya/REVIEW.md, not fixed.

## 2. Regenerate everything from the current source
- The sections already online have been revised too. Regenerate every Lyα page from the current LaTeX, and list in the ledger which existing pages changed.
- Any \endinput or commented-out \input in my source reflects my choices for the PDF. If my source and the cut above disagree, follow the cut above for the web and tell me where they disagree. Do not edit my notes directory.
- The differential geometry course must not change at all.

## 3. Interactive panels
- Bring back the panels parked in _port/lya/parked/ (L28) where their sections are back on the web, updated to the revised text and equations.
- For the new two-point-statistics chapters, add new panels only where they pass the usual test: a student understands something by manipulating it that the static figure can't show. At most three, ranked in _port/lya/PLAN.md.

## 4. PDF
Replace the Lyα PDF on the site with my freshly compiled main.pdf from the Lyα notes folder, at the same address, compressed with the same Ghostscript settings. Don't review its contents. Tell me if its last section is not the one the web course ends with.

## 5. Done when
- _port/check.sh prints ALL CHECKS PASSED.
- Every new or changed Lyα page has been compared with the PDF at desktop and phone widths in both themes, with problems fixed.
- _port/lya/PROGRESS.md, DECISIONS.md, REVIEW.md and REPORT.md are updated.
- git status is clean.
- You tell me what changed and what to preview.
