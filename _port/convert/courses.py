"""The courses the converter builds, one entry each (Lyα DECISIONS L9). Hand-written, part of the web port.

Every value that differs between the two sets of notes lives here; the converter, the page shell, the figure
pipeline and _port/tex/build_scratch.sh read the entry of the course they build. The first course's values are
exactly the constants the converter had before it took a course, so its pages are unchanged
(_port/tools/course_unchanged.py proves it).

    python3 _port/convert/courses.py                 # the course names, one per line
    python3 _port/convert/courses.py --shell <name>  # shell assignments for build_scratch.sh / check.sh
"""
from __future__ import annotations
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))

COURSES: dict[str, dict] = {
    'diffgeo-gr': {
        'dir': 'notes/diffgeo-gr',                          # course directory, relative to the repo root (D2)
        'title': 'From Differential Geometry to General Relativity',
        # the notes directory (read-only) and the variable that overrides it
        'notes_env': 'NOTES',
        'notes': '/home/dlopez/Documentos/0.profesional/Postdoc/USP/Projects/learning_cosmology/'
                 'lecture_notes_differential_geometry_GR/from_diff_geom_to_GR',
        'work': '_port/.work/tex',                          # scratch build (D5): <work>/stage, <work>/src
        'engine': 'xelatex',                                # latexmk -<engine>
        'copy': ['*.tex', '*.bib', '*.ttf', '*.otf', 'plots/**'],   # what the scratch copy takes from the notes
        'package_blob': 'https://github.com/daniellopezcano/differential_geometry/blob/main/',   # D55 notebooks
        'interactives': '_port/interactives.json',
        # page structure (D3): the command that makes a page with an opening text and the list of its sections
        # ('chapter' kind), the command that makes one page each ('section' kind), in-page headings and levels
        'pages': {'chapter': 'chapter', 'section': 'section'},
        'heads': {'subsection': 2, 'subsubsection': 3},
        'slug_camel': False,                                # D2: labels as written
        'label_prefix': r'^(chapter|appendix|section|subsection)_',      # dropped from labels for addresses (D2)
        'words': {'main': 'Chapter', 'appendix': 'Appendix'},           # the kicker's word for a chapter-kind page
        'textwidth_cm': 16.0,                               # A4 minus 2 x 25 mm (figure widths, table lengths)
        'pt': 10,                                           # the notes' type size: table lengths in em (D48)
        'front': {'Chapters/Copyrigh_page.tex': 'copyright', 'Chapters/About_the_author.tex': 'about'},   # D51
        'copyright_title': 'Copyright, License and Funding',
        'lists': ('lof', 'bib'),                            # D52: \listoffigures and \bibliography make pages
        'defs': True,                                       # D53: Definitions and notation
        'related': ('B', 'C'),                              # D38: appendices whose section pages are listed
        'master_map': 'fig_roadmap_master',                 # D38/D39: the course map
        'landing': 'diffgeo',                               # write_landing: which cover builder
        'runic': True,                                      # preload the notes' runic font (D8)
        'stylesheets': [],                                  # course stylesheets after course.css
        'last': None,                                       # L1: label of the last main-text section converted
        'restore_inputs': [],                               # L28: commented-out \input lines the scratch copy restores
        'appendices': 'all',                                # L2: 'all' or 'referenced'
        'shared_from': None,                                # L11: course whose design files this one copies
        'open_here': None,                                  # L23: None = course.js's rule (D35), 'appendices'
        'read_key': None,                                   # L24: localStorage key of the read marks (None: 'dg-read')
    },
    'lya-forest': {
        'dir': 'notes/lya-forest',
        'title': 'SkewerJAX: Absorption Lines in Cosmological Sightlines',
        'notes_env': 'NOTES_LYA',
        'notes': '/home/dlopez/Documentos/0.profesional/Postdoc/USP/Projects/SkewerJAX_Review_and_Equations',
        'work': '_port/.work/lya/tex',
        'engine': 'pdf',                                    # newtx: pdfLaTeX, as the author builds it
        'copy': ['*.tex', '*.bib', '*.sty', 'figures/**'],
        'package_blob': 'https://github.com/daniellopezcano/SkewerJAX/blob/main/',
        'interactives': '_port/lya/interactives.json',
        # an article (L10): \section plays the chapter's role, \subsection the section's
        'pages': {'chapter': 'section', 'section': 'subsection'},
        'heads': {'subsubsection': 2, 'paragraph': 3},
        'slug_camel': True,                                 # L17: subsec:LineProfile -> line-profile
        'label_prefix': r'^(sec|subsec|subsubsec|app):',
        'words': {'main': 'Section', 'appendix': 'Appendix'},
        'textwidth_cm': 21.0 - 2 * 2.54,                    # A4, 1 in margins (geometry)
        'pt': 11,
        'front': {},
        'copyright_title': None,
        'lists': (),                                        # L4: nothing cited, no List of Figures in main.tex
        'defs': False,                                      # no term macros in these notes
        'related': ('A', 'B', 'C', 'D', 'E'),
        'master_map': None,
        'landing': 'lya',
        'runic': False,
        'stylesheets': ['lya.css'],
        'last': 'sec:xi_decomposition',                     # L1, L28: up to the end of section 4, Decomposition of the 2PCF
        # L28: the author's main.tex (2026-11-16 23:27) comments out this \input, which holds sections 4-8; the
        # scratch copy restores it (with its \newpage) so that section 4 exists and keeps its number
        'restore_inputs': ['sec_summary_statistics'],
        'appendices': 'referenced',                         # L2
        'shared_from': 'diffgeo-gr',                        # L11
        'open_here': 'appendices',                          # L23: every page of an included appendix opens in place
        'read_key': 'dg-read:lya-forest',                   # L24: its own read marks
    },
}

# L11: the design files a course with 'shared_from' copies byte for byte from that course's assets/
SHARED = ('course.css', 'course.js', 'interactive.css', 'interactive/dg.js', 'fonts/newcm-book.woff2',
          'fonts/newcm-bookitalic.woff2', 'fonts/newcm-bold.woff2', 'fonts/newcm-bolditalic.woff2')


def get(name: str) -> dict:
    if name not in COURSES:
        raise SystemExit(f'unknown course {name!r}; courses: {", ".join(COURSES)}')
    c = dict(COURSES[name])
    c['name'] = name
    c['notes'] = os.environ.get(c['notes_env']) or c['notes']
    c['src'] = os.path.join(REPO, c['work'], 'src')
    c['out'] = os.path.join(REPO, c['dir'])
    # the converter's report (pages, math, review items): _port/.work/report.json for the first course (as
    # before), <work>/../report.json for the others
    c['report'] = os.path.join(REPO, os.path.dirname(c['work']), 'report.json')
    return c


def main(argv: list[str]) -> int:
    if len(argv) == 3 and argv[1] == '--shell':
        c = get(argv[2])
        for k in ('dir', 'notes', 'work', 'engine'):
            if '"' in c[k] or '$' in c[k]:
                raise SystemExit(f'courses.py --shell: {k} of {argv[2]} contains a quote or $')
            print(f'C_{k.upper()}="{c[k]}"')
        print('C_COPY=(' + ' '.join(f'"{x}"' for x in c['copy']) + ')')
        print('C_RESTORE=(' + ' '.join(f'"{x}"' for x in c['restore_inputs']) + ')')
        return 0
    if len(argv) == 1:
        print('\n'.join(COURSES))
        return 0
    if argv[1:] == ['--json']:                 # for the Node tools: every course's entry, resolved
        import json
        print(json.dumps({n: {k: v for k, v in get(n).items() if isinstance(v, (str, int, float, bool, list, type(None)))}
                          for n in COURSES}))
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv))
