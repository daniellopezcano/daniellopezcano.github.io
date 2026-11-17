/* Hand-written: the math configuration of the Lyα course pages (Lyα DECISIONS L16).
 *
 * The equation source on the web is the source in the notes, character for character. What MathJax is told:
 *   - The preamble's math macros, with the preamble's bodies (main.tex, "Custom macros"): \e \dd \cc \Hzero
 *     \Orad \Om \Ok \Ol \Dop. The converter checks that every one-line \newcommand of the preamble used in a
 *     formula is defined here with the same body (build.py: check_math_macros), so they cannot drift apart.
 *   - \TextZero ... \TextSix: the preamble's \colorbox{<c>!22}{$\displaystyle #1$} with \fboxsep = 1pt, as a
 *     background of that colour mixed with the paper (what xcolor computes on white), so the dark theme
 *     gets the same hues on its own paper. The colours are read from TEXTBOX below, checked against the
 *     preamble by the converter.
 *   - xcolor expressions in \textcolor / \color (c!p: p % of c on the paper; c!p!d: p % of c, the rest d),
 *     which MathJax does not know, become the same mixes in CSS (a TeX input pre-filter: the page's text,
 *     data-tex and "Copy LaTeX" keep the notes' source). "black" is the text colour, so mixes with black
 *     stay legible in the dark theme.
 *   - \AA (inside \text{}) is the Angstrom sign.
 *   - ``…" and ``…'' are TeX's curly quotes “…” (inside \mathrm{} in Eq. (4.1)).
 * _port/tools/math_check.mjs evaluates this file in Node and typesets every equation of the pages with this
 * tex block, so keep it a plain script that only assigns window.MathJax (and the dg-js classes below).
 */
if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dg-js');
  setTimeout(function () { document.documentElement.classList.add('dg-math-ready'); }, 8000);
}
(function () {
  // xcolor's base names known to course.css (--dg-tex-<name>); black is the text colour, white the paper
  var BASE = /^(red|blue|black|white|gray|cyan|magenta|yellow|green|orange|violet|purple|teal|brown|olive|lime|pink)$/;
  var css = function (name) { return name === 'white' ? 'var(--dg-bg)' : 'var(--dg-tex-' + name + ')'; };
  // an xcolor expression -> a CSS colour, or null when it is not one this file knows
  function xcolor(expr) {
    var p = expr.replace(/\s+/g, '').split('!');
    if (!BASE.test(p[0])) return null;
    if (p.length === 1) return css(p[0]);
    if (!/^\d{1,3}$/.test(p[1]) || +p[1] > 100) return null;
    var other = p.length === 2 ? 'white' : p[2];
    if (p.length > 3 || !BASE.test(other)) return null;
    return 'color-mix(in srgb, ' + css(p[0]) + ' ' + p[1] + '%, ' + css(other) + ')';
  }
  // \textcolor{<expr>} / \color{<expr>} with an xcolor mix -> \style{color: ...} (MathJax's html package)
  function prefilter(data) {
    // \AA: the Angstrom sign (MathJax's text mode has no \AA; the notes use it inside \text{})
    data.math.math = data.math.math.replace(/\\AA(?![A-Za-z])/g, '\u00c5');
    // ``…" and ``…'' (TeX's quotes, used inside \mathrm{} in the notes, Eq. (4.1)): the curly quotes TeX prints, as
    // text (in math MathJax would take them for primes)
    data.math.math = data.math.math.replace(/``([^`"']*?)(?:"|'')/g, '\\text{\u201c}$1\\text{\u201d}');
    data.math.math = data.math.math.replace(/\\(textcolor|color)\s*\{([^{}]*!+[^{}]*)\}/g, function (all, cmd, expr) {
      var c = xcolor(expr);
      if (!c) return all;
      return cmd === 'textcolor' ? '\\style{color: ' + c + '}' : '\\style{color: ' + c + '}{}';
    });
  }
  var TEXTBOX = { TextZero: 'gray', TextOne: 'cyan', TextTwo: 'green', TextThree: 'yellow', TextFour: 'orange',
                  TextFive: 'magenta', TextSix: 'red' };
  var macros = {
    e: '\\mathrm{e}',
    dd: '\\mathrm{d}',
    cc: 'c',
    Hzero: 'H_0',
    Orad: '\\Omega_r',
    Om: '\\Omega_m',
    Ok: '\\Omega_k',
    Ol: '\\Omega_\\Lambda',
    Dop: '\\mathcal{D}'
  };
  Object.keys(TEXTBOX).forEach(function (k) {
    macros[k] = ['\\style{background-color: ' + xcolor(TEXTBOX[k] + '!22') + '; padding: 1pt}{\\displaystyle{#1}}', 1];
  });
  window.MathJax = {
    tex: {
      inlineMath: [['\\(', '\\)']],
      displayMath: [['\\[', '\\]']],
      processEscapes: false,
      processEnvironments: true,
      tags: 'none',
      packages: { '[+]': ['textmacros', 'mathtools', 'html', 'cancel', 'color'] },
      macros: macros
    },
    chtml: {
      mtextInheritFont: false,
      matchFontHeight: false,
      displayAlign: 'center'
    },
    options: {
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'annotation', 'annotation-xml'],
      renderActions: (function () {
        function untab(math) {
          var root = math.typesetRoot;
          if (root && root.querySelectorAll) root.querySelectorAll('[aria-hidden="true"] a[href]').forEach(function (a) { a.setAttribute('tabindex', '-1'); });
        }
        return { addMenu: [], untabHiddenLinks: [210, function (doc) { Array.from(doc.math).forEach(untab); }, untab] };
      })()
    },
    startup: {
      ready: function () {
        MathJax.startup.defaultReady();
        MathJax.startup.document.inputJax[0].preFilters.add(prefilter);
      },
      pageReady: function () {
        document.querySelectorAll('.math.display:not([data-tex])').forEach(function (el) {
          el.setAttribute('data-tex', el.textContent);
        });
        return MathJax.startup.defaultPageReady()
          .then(function () { document.documentElement.classList.add('dg-math-ready'); });
      }
    }
  };
  window.dgXcolor = xcolor;            // for the tests (math_check.mjs)
  window.dgMathPrefilter = prefilter;
})();
