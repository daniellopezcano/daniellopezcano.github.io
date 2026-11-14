/* Hand-written: the one shared math configuration of the course pages.
 *
 * The notes define no math macros of their own (the preamble only defines colours,
 * \DLC and the font switches \runic / \cunei), so the equation source on the web is
 * the source in the notes, character for character. What MathJax needs to be told:
 *   - \runic and \cunei are font switches used as \textrm{\runic X}. On the web the
 *     glyph itself selects the font (a @font-face restricted to the runic block, see
 *     course.css), so the switches expand to nothing.
 *   - \xlongrightarrow (LaTeX mathtools) is missing from MathJax 3: it is \xrightarrow with
 *     \; either side of the upper label, which keeps most arrows within ~0.1em of the
 *     PDF's length (mathtools' minimum is the length of \longrightarrow).
 *   - \coloneq: mathtools 1.29 (the notes' TeX Live 2023) prints := like \coloneqq;
 *     MathJax 3's mathtools still prints the legacy :-.
 * Typesetting waits for the runic font, so the glyph widths MathJax measures are the real ones.
 * _port/tools/math_check.mjs evaluates this file in Node and typesets every equation of
 * the pages with this tex block, so keep it a plain script that only assigns window.MathJax.
 */
window.MathJax = {
  tex: {
    inlineMath: [['\\(', '\\)']],
    displayMath: [['\\[', '\\]']],
    processEscapes: false,
    processEnvironments: true,
    tags: 'none',
    // tex-chtml-full already contains every extension; they only need to be switched on
    packages: { '[+]': ['textmacros', 'mathtools', 'html'] },
    macros: {
      runic: '',
      cunei: '',
      coloneq: '\\coloneqq',
      xlongrightarrow: ['\\xrightarrow[#1]{\\;#2\\;}', 2, '']
    }
  },
  chtml: {
    unknownFamily: '"Noto Sans Runic", serif',
    mtextInheritFont: false,
    matchFontHeight: false,          // keep math at the text size (the page font has a tall x-height)
    displayAlign: 'center'
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'annotation', 'annotation-xml'],
    renderActions: { addMenu: [] }
  },
  startup: {
    pageReady: function () {
      var font = document.fonts && document.fonts.load
        ? document.fonts.load('16px "Noto Sans Runic"', 'ᛊ').catch(function () {})
        : Promise.resolve();
      return font.then(function () { return MathJax.startup.defaultPageReady(); })
        .then(function () { document.documentElement.classList.add('dg-math-ready'); });
    }
  }
};
