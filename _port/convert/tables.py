"""`tabular` -> HTML table (unit B2, DECISIONS D48).

Hand-written, part of the web port.

A tabular is text mode in LaTeX, so it becomes a real table whose cells are parsed and
rendered like any other text of the notes (their `$..$` math stays the notes' source).
Structure comes from the source and nothing else:
  * column spec: l / c / r (alignment), p{w} (top-aligned paragraph of width w),
    `|` (vertical rule), @{..} (the gap beside a column: `@{}` none, `@{\\hspace{w}}` w);
    without @{..} a column has LaTeX's \\tabcolsep (6pt) on each side;
  * rows end at a top-level `\\\\`; `\\\\[dim]` adds dim below the row; `\\hline` draws a rule;
  * cells split at a top-level `&`;
  * \\arraystretch (set by \\renewcommand before the table) scales the row height.
Lengths become em of the notes' type (10pt for the first notes, 11pt for the Lyα notes; courses.py
'pt'): 1pt = 1/size em, \\textwidth = the renderer's text width. A first row that is followed by an
\\hline is the header (<th scope="col">), which is what the rule marks in the PDF.
Lyα notes (L13): `\\setlength{\\tabcolsep}{w}` before the tabular sets the gap; a cell may begin with
`\\multicolumn{n}{spec}{content}` (colspan, its own alignment and rules), `\\multirow{n}{*}{content}`
(rowspan; the cells it covers below must be empty), `\\cellcolor{c}` (background), or be one call of a
preamble macro defined as `\\newcommand{\\X}[1]{\\cellcolor{c}{#1}}` (the notes' \\TotZero ... \\TotSix).
Anything outside this subset stops the page with file:line.
"""
from __future__ import annotations
import re
from texparse import ConvertError

PT_EM = 0.1                       # 10pt type
CM_EM = 28.4527 * PT_EM
TABCOLSEP_EM = 6 * PT_EM
CELL_MACROS: dict = {}            # name -> colour, from the preamble: \newcommand{\X}[1]{\cellcolor{c}{#1}} (L13)
_CELLMAC = re.compile(r'\\newcommand\s*\{?\\([A-Za-z]+)\}?\s*\[1\]\s*\{\s*\\cellcolor\s*\{([^{}]+)\}\s*\{#1\}\s*\}')


def configure(c: dict) -> None:
    """The course's type size (courses.py 'pt'), which sets every length in em."""
    global PT_EM, CM_EM, TABCOLSEP_EM
    PT_EM = 1 / c['pt']
    CM_EM = 28.4527 * PT_EM
    TABCOLSEP_EM = 6 * PT_EM


def cell_macros(preamble: str) -> None:
    """The preamble's cell-colour macros (L13)."""
    CELL_MACROS.clear()
    for m in _CELLMAC.finditer(preamble):
        CELL_MACROS[m.group(1)] = m.group(2).strip()


def length_em(src: str, textwidth_cm: float, pos: int) -> float:
    """A TeX length as the notes write it -> em. Accepts `Xcm`, `Xpt`, `Xem`, `\\textwidth`,
    `\\hspace{..}`, and `\\dimexpr a +/- b ...\\relax`."""
    t = src.strip()
    m = re.fullmatch(r'\\hspace\*?\s*\{(.*)\}', t, re.S)
    if m:
        t = m.group(1).strip()
    m = re.fullmatch(r'\\dimexpr(.*?)\\relax', t, re.S)
    if m:
        t = m.group(1)
    total, sign, rest = 0.0, 1, t.strip()
    while rest:
        m = re.match(r'([+-])?\s*(?:(\d*\.?\d+)\s*(cm|pt|em|mm)|(\d*\.?\d*)\s*\\textwidth)\s*', rest)
        if not m or not m.group(0):
            raise ConvertError(f'tabular: cannot read the length "{src}"', pos)
        if m.group(1):
            sign = -1 if m.group(1) == '-' else 1
        if m.group(3):
            v, u = float(m.group(2)), m.group(3)
            em = v * {'cm': CM_EM, 'mm': CM_EM / 10, 'pt': PT_EM, 'em': 1.0}[u]
        else:
            em = float(m.group(4) or 1) * textwidth_cm * CM_EM
        total += sign * em
        sign, rest = 1, rest[m.end():]
    return total


def _group(s: str, i: int, pos: int) -> int:
    """s[i] == '{': offset of the matching '}' in a short string (column specs)."""
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '{':
            depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0:
                return j
    raise ConvertError('tabular: unbalanced { in the column spec', pos)


def columns(spec: str, textwidth_cm: float, pos: int, sep: float | None = None) -> list[dict]:
    """Column spec -> [{align, width, pad_l, pad_r, rule_l, rule_r}] (paddings and width in em); sep is the
    \\tabcolsep in force (em), LaTeX's 6pt when None."""
    sep = TABCOLSEP_EM if sep is None else sep
    cols, i, pending_rule, pending_pad = [], 0, False, None
    while i < len(spec):
        c = spec[i]
        if c.isspace():
            i += 1
        elif c == '|':
            pending_rule = True
            if cols:
                cols[-1]['rule_r'] = True
            i += 1
        elif c == '@':
            if spec[i + 1:i + 2] != '{':
                raise ConvertError('tabular: @ without {..} in the column spec', pos)
            k = _group(spec, i + 1, pos)
            body = spec[i + 2:k].strip()
            gap = 0.0 if not body else length_em(body, textwidth_cm, pos)
            if pending_pad is not None or (cols and cols[-1]['_after']):
                raise ConvertError('tabular: two @{..} in a row in the column spec', pos)
            if cols:                    # @{..} replaces the whole space between two columns
                cols[-1]['pad_r'], cols[-1]['_after'] = gap, True
                pending_pad = 0.0
            else:
                pending_pad = gap
            i = k + 1
        elif c in 'lcr' or c == 'p':
            width = None
            if c == 'p':
                if spec[i + 1:i + 2] != '{':
                    raise ConvertError('tabular: p without {width}', pos)
                k = _group(spec, i + 1, pos)
                width = length_em(spec[i + 2:k], textwidth_cm, pos)
                i = k + 1
            else:
                i += 1
            col = {'align': {'l': 'left', 'c': 'center', 'r': 'right', 'p': 'left'}[c], 'top': c == 'p',
                   'width': width, 'pad_l': sep if pending_pad is None else pending_pad,
                   'pad_r': sep, 'rule_l': pending_rule and not cols, 'rule_r': False, '_after': False}
            cols.append(col)
            pending_rule, pending_pad = False, None
        else:
            raise ConvertError(f'tabular: column type "{c}" in "{spec}": no handler yet', pos)
    if not cols:
        raise ConvertError('tabular without columns', pos)
    return cols


def split(P, a: int, b: int) -> tuple[list[dict], int]:
    """Scan the body s[a:b] at top level -> rows [{cells: [(i, j)], space, hline}], trailing hlines.
    `hline` counts the \\hline before the row; `space` is the source of the [dim] after `\\\\`."""
    s = P.s
    rows, cells, start, hl, j = [], [], a, 0, a

    def end_row(k, space):
        nonlocal cells, start, hl
        cells.append((start, k))
        rows.append({'cells': cells, 'space': space, 'hline': hl})
        cells, hl = [], 0

    while j < b:
        c = s[j]
        if c == '\\':
            if s.startswith('\\\\', j):
                k = P.skip_ws(j + 2, b, allow_par=True)
                space = None
                if k < b and s[k] == '[':
                    e = P.bracket_end(k, b)
                    space, k = s[k + 1:e], e + 1
                end_row(j, space)
                start = j = k
                continue
            if s.startswith('\\hline', j) and not s[j + 6:j + 7].isalpha():
                if s[start:j].strip():
                    raise ConvertError('tabular: \\hline inside a row', j)
                hl += 1
                start = j = j + 6
                continue
            if s.startswith('\\begin{tabular}', j):
                raise ConvertError('tabular inside tabular: no handler yet', j)
            if s.startswith('\\[', j) or s.startswith('\\(', j):
                j = P.math_end(j + 2, b, '\\]' if s[j + 1] == '[' else '\\)') + 2
                continue
            j = P.skip_cs(j)
        elif c == '$':
            j = P.math_end(j + 1, b, '$') + 1
        elif c == '{':
            j = P.group_end(j, b) + 1
        elif c == '&':
            cells.append((start, j))
            start = j = j + 1
        else:
            j += 1
    if s[start:b].strip() or cells:
        end_row(b, None)
    trailing = hl
    return rows, trailing


CSS_PAD_EM = 0.6                  # course.css: the padding of a table cell (the first notes' 6pt at 10pt)


def _style(col: dict, extra: str = '') -> str:
    st = [f'text-align:{col["align"]}']
    if col['top']:
        st.append('vertical-align:top')
    else:
        st.append('white-space:nowrap')         # l, c, r cells are one line in LaTeX; only p{..} wraps
    if col['width'] is not None:
        st.append(f'width:{col["width"]:.2f}em')
    if abs(col['pad_l'] - CSS_PAD_EM) > 1e-6:
        st.append(f'padding-left:{col["pad_l"]:.2f}em')
    if abs(col['pad_r'] - CSS_PAD_EM) > 1e-6:
        st.append(f'padding-right:{col["pad_r"]:.2f}em')
    if extra:
        st.append(extra)
    return ';'.join(st)


def cell(r, i: int, j: int, cols: list, k: int, pos: int) -> dict:
    """What the source cell s[i:j] in column k asks for (L13): {'span', 'rows', 'col' (its column spec),
    'color', 'a', 'b' (the content's range)}. Leading \\multicolumn / \\multirow / \\cellcolor and the preamble's
    cell-colour macros are read here; what is left is the content, rendered as text of the notes."""
    P, s = r.P, r.P.s
    out = {'span': 1, 'rows': 1, 'col': cols[k] if k < len(cols) else None, 'color': None, 'a': i, 'b': j}
    while True:
        a = P.skip_ws(out['a'], out['b'], allow_par=True)
        m = re.match(r'\\([A-Za-z]+)(?![A-Za-z])', s[a:out['b']])
        name = m.group(1) if m else None
        if name == 'multicolumn' and out['span'] == 1 and out['rows'] == 1 and out['color'] is None:
            (n, spec, body), e = P.read_args('rrr', a + m.end(), out['b'], a)
            if not n.strip().isdigit():
                raise ConvertError(f'\\multicolumn{{{n}}}: no handler for this count', a)
            sub = columns(spec, r.textwidth_cm, a, length_em(r.tabcolsep, r.textwidth_cm, a) if r.tabcolsep else None)
            if len(sub) != 1:
                raise ConvertError(f'\\multicolumn with the column spec "{spec}": one column expected', a)
            out['span'], out['col'] = int(n), sub[0]
        elif name == 'multirow' and out['rows'] == 1 and out['color'] is None:
            (n, width, body), e = P.read_args('rrr', a + m.end(), out['b'], a)
            if not n.strip().isdigit() or width.strip() != '*':
                raise ConvertError(f'\\multirow{{{n}}}{{{width}}}: no handler for this form', a)
            out['rows'] = int(n)
        elif name == 'cellcolor' and out['color'] is None:
            (c,), e = P.read_args('r', a + m.end(), out['b'], a)
            out['color'] = c.strip()
            out['a'] = e
            continue
        elif name in CELL_MACROS and out['color'] is None:
            (body,), e = P.read_args('r', a + m.end(), out['b'], a)
            out['color'] = CELL_MACROS[name]
        else:
            return out
        out['a'], out['b'] = e - 1 - len(body), e - 1          # the last argument: the content
        if s[e:j].strip():
            raise ConvertError(f'tabular: text after \\{name}{{..}} in the same cell: no handler yet', e)


def tabular(r, a: int, b: int, pos: int) -> str:
    """r: the Renderer; s[a:b] is `\\begin{tabular}{spec} ... \\end{tabular}` in the source."""
    P, s = r.P, r.P.s
    m = re.match(r'\\begin\{tabular\}\s*(?:\[([^\]]*)\])?\s*\{', s[a:b])
    if not m:
        raise ConvertError('tabular: cannot read the column spec', pos)
    if m.group(1):
        raise ConvertError('tabular with a position argument: no handler yet', pos)
    o = a + m.end() - 1
    e = P.group_end(o, b)
    sep = getattr(r, 'tabcolsep', None)
    cols = columns(s[o + 1:e], r.textwidth_cm, pos, length_em(sep, r.textwidth_cm, pos) if sep else None)
    end = s.rindex('\\end{tabular}', a, b)
    rows, trailing = split(P, e + 1, end)
    if not rows:
        raise ConvertError('tabular without rows', pos)
    header = len(rows) > 1 and rows[1]['hline'] > 0
    out = []
    covered: dict = {}                 # column -> rows still covered by a \multirow above (L13)
    for n, row in enumerate(rows):
        if len(row['cells']) > len(cols):
            raise ConvertError(f'tabular: a row has {len(row["cells"])} cells for {len(cols)} columns', row['cells'][0][0])
        # \\[dim] deepens the row's strut by dim (array.sty), so a row that is already deep absorbs part of
        # it: an invisible strut of that depth in the first cell does the same here
        strut = ''
        if row['space']:
            dim = length_em(row['space'], r.textwidth_cm, pos)
            strut = f'<span class="dg-row-strut" style="--dg-strut-dp:{dim:.2f}em" aria-hidden="true"></span>'
        tag = 'th scope="col"' if header and n == 0 else 'td'
        tds = []
        ci = 0                         # the column the next source cell starts in
        for k, (i, j) in enumerate(row['cells']):
            if covered.get(ci):        # the cell under a \multirow: must be empty in the source, no <td>
                covered[ci] -= 1
                if s[i:j].strip():
                    raise ConvertError('tabular: a cell under a \\multirow is not empty', i)
                ci += 1
                continue
            if ci >= len(cols):
                raise ConvertError(f'tabular: a row has more cells than the {len(cols)} columns', i)
            c = cell(r, i, j, cols, ci, pos)
            col = c['col']
            if ci + c['span'] > len(cols):
                raise ConvertError(f'tabular: \\multicolumn{{{c["span"]}}} runs past the last column', i)
            if c['rows'] > 1:
                if c['span'] != 1:
                    raise ConvertError('tabular: \\multirow inside \\multicolumn: no handler yet', i)
                covered[ci] = c['rows'] - 1
            cls = ' '.join(x for x, on in (('dg-rule-l', col['rule_l']), ('dg-rule-r', col['rule_r'])) if on)
            html = r.inline(P.parse(c['a'], c['b'])).strip() + (strut if k == 0 else '')
            st = _style(col, f'background:{r.colour(c["color"], i)}' if c['color'] else '')
            attrs = (f' colspan="{c["span"]}"' if c['span'] > 1 else '') + (f' rowspan="{c["rows"]}"' if c['rows'] > 1 else '')
            tds.append(f'<{tag}{attrs}{f" class={chr(34)}{cls}{chr(34)}" if cls else ""} style="{st}">{html}</{tag.split()[0]}>')
            ci += c['span']
        if any(covered.get(x) for x in range(ci, len(cols))):
            raise ConvertError('tabular: a row ends before the cells a \\multirow covers', row['cells'][-1][0])
        rcls = []
        if row['hline']:
            rcls.append('dg-hline-above')
        if n == len(rows) - 1 and trailing:
            rcls.append('dg-hline-below')
        # a newline between cells: no effect on the layout, but the page's text keeps cells apart as words
        tr = f'<tr{f" class={chr(34)}{" ".join(rcls)}{chr(34)}" if rcls else ""}>' + '\n'.join(tds) + '</tr>'
        out.append(tr)
    if header:
        body = f'<thead>{out[0]}</thead>\n<tbody>{chr(10).join(out[1:])}</tbody>'
    else:
        body = f'<tbody>{chr(10).join(out)}</tbody>'
    stretch = getattr(r, 'arraystretch', None)
    st = f' style="--dg-arraystretch:{stretch}"' if stretch and float(stretch) != 1.0 else ''
    return f'<div class="dg-table-wrap"><table class="dg-table"{st}>{body}</table></div>'
