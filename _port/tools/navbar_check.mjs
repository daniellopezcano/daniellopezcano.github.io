// Hand-written tool (DECISIONS D29, D37): the site navbar replica of the course pages (shell.py, course.css
// "site navbar") against the Quarto navbar of the rest of the site, on the rendered site in docs/.
//   node _port/tools/navbar_check.mjs [--page <slug>] [--verbose]    (exit code 0 = same; default page metric/length-geodesics)
// Quarto side: docs/index.html. At 1440×900 and 390×844:
//   * same links in the same order, same visible text, same resolved target URLs (".../index.html" and ".../"
//     are the same target: Quarto's navigation script drops "index.html" from its links when served over http);
//   * the active entry of the course page is "Lecture Notes";
//   * bar height, link font family / size, horizontal padding of the links and the left edge of every link
//     within 1 px; background colour of the bar (composited over what is behind it) and link colour
//     (with opacity) exactly equal;
//   * at 390 px both bars hide their links behind a toggle button, and once it is pressed the opened menu
//     lists the same links (text and URL, in order).
// Output: one line per difference (`<width> <property>: quarto … | course …`).
import { chromium, serveDocs } from './shot.mjs';
import { COURSE, selectPages } from './course_pages.mjs';

const args = process.argv.slice(2);
const slug = args.includes('--page') ? selectPages(args)[0] : 'metric/length-geodesics';
const SIDES = {
  quarto: { path: 'index.html', bar: '#quarto-header', links: '#navbarCollapse .navbar-nav .nav-link', toggle: '.navbar-toggler' },
  course: { path: `${COURSE}/${slug}.html`, bar: '#dg-sitenav', links: '#dg-sitenav-links a', toggle: '.dg-sitenav-toggle' },
};
const diffs = [];
const { server, base } = await serveDocs();
const browser = await chromium.launch();

function measure(page, S) {
  return page.evaluate(S => {
    const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
    // colour seen at an element: its background and its ancestors' composited from the root (white canvas)
    const effBg = el => {
      const stack = [];
      for (let e = el; e; e = e.parentElement) stack.push(parse(getComputedStyle(e).backgroundColor));
      let c = [255, 255, 255];
      for (const [r, g, b, a] of stack.reverse()) c = [r * a + c[0] * (1 - a), g * a + c[1] * (1 - a), b * a + c[2] * (1 - a)];
      return c.map(Math.round).join(',');
    };
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const bar = document.querySelector(S.bar);
    const links = [...document.querySelectorAll(S.links)];
    const plain = links.find(a => !a.classList.contains('active')) || links[0];
    const ls = plain && getComputedStyle(plain);
    const toggle = document.querySelector(S.toggle);
    return {
      height: bar ? bar.getBoundingClientRect().height : 0,
      bg: plain ? effBg(plain) : '',
      links: links.map(a => ({ text: a.textContent.replace(/\s+/g, ' ').trim(), href: a.href.replace(/\/index\.html$/, '/'), visible: vis(a), x: a.getBoundingClientRect().left })),
      active: links.filter(a => a.classList.contains('active') || a.getAttribute('aria-current') === 'page').map(a => a.textContent.trim()),
      font: ls ? ls.fontFamily.replace(/["']/g, '').replace(/\s*,\s*/g, ',') : '',
      size: ls ? ls.fontSize : '',
      color: ls ? `${ls.color} opacity ${ls.opacity}` : '',
      padL: ls ? parseFloat(ls.paddingLeft) : 0, padR: ls ? parseFloat(ls.paddingRight) : 0,
      toggle: toggle ? vis(toggle) : false,
    };
  }, S);
}

async function open(S, width) {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 } });
  await page.goto(`${base}/${S.path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}

const near = (a, b) => Math.abs(a - b) <= 1;
try {
  for (const width of [1440, 390]) {
    const pq = await open(SIDES.quarto, width), pc = await open(SIDES.course, width);
    const q = await measure(pq, SIDES.quarto), c = await measure(pc, SIDES.course);
    if (args.includes('--verbose')) for (const [n, m] of [['quarto', q], ['course', c]]) console.log(`  ${width} ${n}: height ${m.height.toFixed(1)}, bg rgb(${m.bg}), ${m.size} ${m.font.split(',')[0]}, ${m.color}, padding ${m.padL}/${m.padR}, toggle ${m.toggle}, x ${m.links.map(l => Math.round(l.x)).join(' ')}`);
    const d = (prop, a, b) => diffs.push(`${width} ${prop}: quarto ${a} | course ${b}`);
    const list = m => m.links.map(l => `${l.text} -> ${l.href}`).join(' ; ');
    if (list(q) !== list(c)) d('links (text -> URL, in order)', list(q), list(c));
    if (c.active.join() !== 'Lecture Notes') d('active entry on the course page', '(Lecture Notes expected)', c.active.join() || 'none');
    if (!near(q.height, c.height)) d('bar height', q.height.toFixed(1) + ' px', c.height.toFixed(1) + ' px');
    if (q.bg !== c.bg) d('bar background (composited)', `rgb(${q.bg})`, `rgb(${c.bg})`);
    if (q.font !== c.font) d('link font family', q.font, c.font);
    if (q.size !== c.size) d('link font size', q.size, c.size);
    if (q.color !== c.color) d('link colour', q.color, c.color);
    if (!near(q.padL, c.padL) || !near(q.padR, c.padR)) d('link horizontal padding', `${q.padL} / ${q.padR} px`, `${c.padL} / ${c.padR} px`);
    if (width >= 992) {
      q.links.forEach((l, i) => { const k = c.links[i]; if (k && !near(l.x, k.x)) d(`left edge of "${l.text}"`, l.x.toFixed(1) + ' px', k.x.toFixed(1) + ' px'); });
    } else {
      // collapsed: links hidden behind a visible toggle; pressing it lists the same links
      for (const [name, m] of [['quarto', q], ['course', c]]) {
        if (!m.toggle) d('toggle button visible', name === 'quarto' ? 'no' : 'yes', name === 'course' ? 'no' : 'yes');
        if (m.links.some(l => l.visible)) diffs.push(`${width} ${name}: links visible before the toggle is pressed`);
      }
      await pq.click(SIDES.quarto.toggle); await pc.click(SIDES.course.toggle);
      await pq.waitForTimeout(700); await pc.waitForTimeout(400);
      const q2 = await measure(pq, SIDES.quarto), c2 = await measure(pc, SIDES.course);
      const shown = m => m.links.filter(l => l.visible).map(l => `${l.text} -> ${l.href}`).join(' ; ');
      if (!shown(q2)) diffs.push(`${width} quarto: no link visible after pressing the toggle`);
      if (shown(q2) !== shown(c2)) d('opened menu (visible links, in order)', shown(q2), shown(c2));
    }
    await pq.close(); await pc.close();
  }
} finally {
  await browser.close();
  server.close();
}
for (const x of diffs) console.log('DIFF ' + x);
console.log(diffs.length ? `${diffs.length} differences between the Quarto navbar and the replica on ${slug}` : `navbar replica on ${slug} matches the Quarto navbar at 1440 and 390 px`);
process.exit(diffs.length ? 1 : 0);
