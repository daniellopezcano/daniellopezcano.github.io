// Hand-written tool (DECISIONS D29, D37; Lyα DECISIONS L15): the site navbar replica of the course pages (shell.py,
// course.css "site navbar", course.js initSiteNav) against the Quarto navbar of the rest of the site, on the
// rendered site in docs/.
//   node _port/tools/navbar_check.mjs [--course NAME] [--page <slug>] [--verbose]    (exit code 0 = same)
//   (without --course: every course of _port/convert/courses.py, one after the other; --page alone: the first
//   course; default page: DEFAULT_PAGE of the course)
// Quarto side: docs/index.html. At 1440×900 and 390×844:
//   * same top-level entries in order, same visible text, same resolved target URLs (".../index.html" and ".../"
//     are the same target: Quarto's navigation script drops "index.html" from its links when served over http);
//     a dropdown toggle is an entry whose target is "(menu)" (Quarto: .nav-item.dropdown > .dropdown-toggle;
//     course: li.dg-dropdown > button.dg-dropdown-toggle);
//   * the same dropdown menus: items (text -> URL) in the same order (Quarto .dropdown-menu .dropdown-item;
//     course ul.dg-dropdown-menu a.dg-dropdown-item); every toggle shows its caret (::after with a top border);
//   * the active entry of the course page is the "Lecture Notes" dropdown toggle;
//   * closed state: bar height, link font family / size, horizontal padding of the links and the left edge of every
//     entry within 1 px; background colour of the bar (composited over what is behind it) and link colour
//     (with opacity) exactly equal; no menu visible;
//   * the menu opened (1440: mouse over the toggle; 390: hamburger pressed, then a click on the toggle) on both
//     sides: its background colour, border, item font size and visible items (text -> URL) equal;
//   * 1440: hover opens the menu; keyboard focus (Tab onto the toggle) opens it; Escape then closes it;
//   * 390: both bars hide their entries behind a toggle button, and once it is pressed the opened menu lists the
//     same entries (text and URL, in order); with a touch screen, a tap on the hamburger then on the toggle opens
//     the menu.
// Output: one line per difference (`<width> <property>: quarto … | course …`).
import { chromium, serveDocs } from './shot.mjs';
import { COURSE, COURSE_NAME, selectPages, eachCourse } from './course_pages.mjs';

eachCourse(import.meta.url);
const DEFAULT_PAGE = { 'diffgeo-gr': 'metric/length-geodesics', 'lya-forest': 'flux/line-profile' };
const args = process.argv.slice(2);
const slug = args.includes('--page') ? selectPages(args)[0] : DEFAULT_PAGE[COURSE_NAME];
if (!slug) { console.error(`navbar_check.mjs: no default page for course ${COURSE_NAME}; give --page`); process.exit(2); }
const SIDES = {
  quarto: { path: 'index.html', bar: '#quarto-header', entries: '#navbarCollapse .navbar-nav > .nav-item > .nav-link',
    toggle: '.navbar-toggler', dd: '#navbarCollapse .nav-item.dropdown', ddToggle: '.dropdown-toggle', menu: '.dropdown-menu', item: '.dropdown-item' },
  course: { path: `${COURSE}/${slug}.html`, bar: '#dg-sitenav', entries: '#dg-sitenav-links > li > a, #dg-sitenav-links > li > button.dg-dropdown-toggle',
    toggle: '.dg-sitenav-toggle', dd: '#dg-sitenav-links > li.dg-dropdown', ddToggle: '.dg-dropdown-toggle', menu: 'ul.dg-dropdown-menu', item: 'a.dg-dropdown-item' },
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
    const text = el => el.textContent.replace(/\s+/g, ' ').trim();
    const href = a => a.href.replace(/\/index\.html$/, '/');
    const isToggle = el => el.matches(S.ddToggle);
    const bar = document.querySelector(S.bar);
    const links = [...document.querySelectorAll(S.entries)];
    const plain = links.find(a => !isToggle(a) && !a.classList.contains('active')) || links[0];
    const ls = plain && getComputedStyle(plain);
    const toggle = document.querySelector(S.toggle);
    const menus = [...document.querySelectorAll(S.dd)].map(li => {
      const t = li.querySelector(S.ddToggle), m = li.querySelector(S.menu);
      const after = t ? getComputedStyle(t, '::after') : null;
      const ms = m ? getComputedStyle(m) : null;
      const items = m ? [...m.querySelectorAll(S.item)] : [];
      const is = items[0] ? getComputedStyle(items[0]) : null;
      return {
        toggle: t ? text(t) : '',
        caret: !!after && after.content !== 'none' && parseFloat(after.borderTopWidth) > 0 && after.borderTopStyle !== 'none',
        caretSize: after ? after.borderTopWidth : '',
        open: !!m && vis(m),
        items: items.map(a => `${text(a)} -> ${href(a)}`),
        shown: items.filter(vis).map(a => `${text(a)} -> ${href(a)}`),
        bg: ms ? ms.backgroundColor : '', border: ms ? `${ms.borderTopWidth} ${ms.borderTopStyle} ${ms.borderTopColor}` : '',
        itemSize: is ? is.fontSize : '',
      };
    });
    return {
      height: bar ? bar.getBoundingClientRect().height : 0,
      bg: plain ? effBg(plain) : '',
      links: links.map(a => ({ text: text(a), href: isToggle(a) ? '(menu)' : href(a), visible: vis(a), x: a.getBoundingClientRect().left })),
      active: links.filter(a => a.classList.contains('active') || a.getAttribute('aria-current') === 'page').map(a => text(a)),
      font: ls ? ls.fontFamily.replace(/["']/g, '').replace(/\s*,\s*/g, ',') : '',
      size: ls ? ls.fontSize : '',
      color: ls ? `${ls.color} opacity ${ls.opacity}` : '',
      padL: ls ? parseFloat(ls.paddingLeft) : 0, padR: ls ? parseFloat(ls.paddingRight) : 0,
      toggle: toggle ? vis(toggle) : false,
      menus,
    };
  }, S);
}

async function open(S, width, extra = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, ...extra });
  const page = await context.newPage();
  await page.goto(`${base}/${S.path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}
const close = page => page.context().close();

const near = (a, b) => Math.abs(a - b) <= 1;
const list = m => m.links.map(l => `${l.text} -> ${l.href}`).join(' ; ');
const menuList = m => m.menus.map(x => `${x.toggle}: [${x.items.join(' ; ')}]`).join(' ; ');
const anyOpen = m => m.menus.some(x => x.open);
// the open menu (first dropdown) of both sides: colours, border, item size, visible items
function compareOpen(width, how, q, c) {
  const d = (prop, a, b) => diffs.push(`${width} ${prop} (${how}): quarto ${a} | course ${b}`);
  const mq = q.menus[0], mc = c.menus[0];
  if (!mq || !mc) { diffs.push(`${width} ${how}: no dropdown on ${!mq ? 'quarto' : 'course'}`); return; }
  if (!mq.open) diffs.push(`${width} quarto: the menu is not open after ${how}`);
  if (!mc.open) diffs.push(`${width} course: the menu is not open after ${how}`);
  if (!mq.open || !mc.open) return;
  if (mq.bg !== mc.bg) d('menu background', mq.bg, mc.bg);
  if (mq.border !== mc.border) d('menu border', mq.border, mc.border);
  if (mq.itemSize !== mc.itemSize) d('menu item font size', mq.itemSize, mc.itemSize);
  if (mq.shown.join(' ; ') !== mc.shown.join(' ; ')) d('visible menu items (text -> URL, in order)', mq.shown.join(' ; '), mc.shown.join(' ; '));
}
const isOpen = async (page, S) => page.evaluate(S => { const m = document.querySelector(`${S.dd} ${S.menu}`); if (!m) return false; const r = m.getBoundingClientRect(), s = getComputedStyle(m); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; }, S);
// Tab from the top of the page until the dropdown toggle has the focus (at most 60 presses)
async function tabTo(page, S) {
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(S => document.activeElement && document.activeElement.matches(`${S.dd} ${S.ddToggle}`), S)) return true;
  }
  return false;
}

try {
  for (const width of [1440, 390]) {
    const pq = await open(SIDES.quarto, width), pc = await open(SIDES.course, width);
    const q = await measure(pq, SIDES.quarto), c = await measure(pc, SIDES.course);
    if (args.includes('--verbose')) for (const [n, m] of [['quarto', q], ['course', c]]) console.log(`  ${width} ${n}: height ${m.height.toFixed(1)}, bg rgb(${m.bg}), ${m.size} ${m.font.split(',')[0]}, ${m.color}, padding ${m.padL}/${m.padR}, toggle ${m.toggle}, x ${m.links.map(l => Math.round(l.x)).join(' ')}, carets ${m.menus.map(x => x.caretSize).join(' ')}`);
    const d = (prop, a, b) => diffs.push(`${width} ${prop}: quarto ${a} | course ${b}`);
    if (list(q) !== list(c)) d('entries (text -> URL, in order)', list(q), list(c));
    if (menuList(q) !== menuList(c)) d('dropdown menus (items text -> URL, in order)', menuList(q), menuList(c));
    if (!q.menus.length) diffs.push(`${width} quarto: no dropdown in the navbar`);
    for (const [name, m] of [['quarto', q], ['course', c]]) for (const x of m.menus) if (!x.caret) diffs.push(`${width} ${name}: the toggle "${x.toggle}" has no caret`);
    if (anyOpen(q) || anyOpen(c)) d('a menu open before any interaction', anyOpen(q), anyOpen(c));
    if (c.active.join() !== 'Lecture Notes') d('active entry on the course page', '(Lecture Notes expected)', c.active.join() || 'none');
    if (!near(q.height, c.height)) d('bar height', q.height.toFixed(1) + ' px', c.height.toFixed(1) + ' px');
    if (q.bg !== c.bg) d('bar background (composited)', `rgb(${q.bg})`, `rgb(${c.bg})`);
    if (q.font !== c.font) d('link font family', q.font, c.font);
    if (q.size !== c.size) d('link font size', q.size, c.size);
    if (q.color !== c.color) d('link colour', q.color, c.color);
    if (!near(q.padL, c.padL) || !near(q.padR, c.padR)) d('link horizontal padding', `${q.padL} / ${q.padR} px`, `${c.padL} / ${c.padR} px`);
    if (width >= 992) {
      q.links.forEach((l, i) => { const k = c.links[i]; if (k && !near(l.x, k.x)) d(`left edge of "${l.text}"`, l.x.toFixed(1) + ' px', k.x.toFixed(1) + ' px'); });
      // hover opens the menu; compare the open menus
      for (const [p, S] of [[pq, SIDES.quarto], [pc, SIDES.course]]) await p.hover(`${S.dd} ${S.ddToggle}`);
      await pq.waitForTimeout(400); await pc.waitForTimeout(400);
      compareOpen(width, 'hover', await measure(pq, SIDES.quarto), await measure(pc, SIDES.course));
      await close(pq); await close(pc);
      // keyboard: Tab onto the toggle opens the menu, Escape closes it (fresh pages, the mouse elsewhere)
      for (const [name, S] of [['quarto', SIDES.quarto], ['course', SIDES.course]]) {
        const p = await open(S, width);
        await p.mouse.move(width / 2, 700);
        if (!(await tabTo(p, S))) { diffs.push(`${width} ${name}: Tab never reaches the dropdown toggle`); await close(p); continue; }
        await p.waitForTimeout(400);
        if (!(await isOpen(p, S))) diffs.push(`${width} ${name}: keyboard focus on the toggle does not open the menu`);
        await p.keyboard.press('Escape');
        await p.waitForTimeout(400);
        if (await isOpen(p, S)) diffs.push(`${width} ${name}: Escape does not close the menu`);
        await close(p);
      }
    } else {
      // collapsed: entries hidden behind a visible toggle; pressing it lists the same entries
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
      if (anyOpen(q2) || anyOpen(c2)) d('dropdown open after only the hamburger was pressed', anyOpen(q2), anyOpen(c2));
      // a click on the dropdown toggle opens its menu, in the flow of the opened navbar
      await pq.click(`${SIDES.quarto.dd} ${SIDES.quarto.ddToggle}`); await pc.click(`${SIDES.course.dd} ${SIDES.course.ddToggle}`);
      await pq.waitForTimeout(400); await pc.waitForTimeout(400);
      compareOpen(width, 'click', await measure(pq, SIDES.quarto), await measure(pc, SIDES.course));
      await close(pq); await close(pc);
      // a tap (touch screen) on the hamburger, then on the toggle, opens the menu
      for (const [name, S] of [['quarto', SIDES.quarto], ['course', SIDES.course]]) {
        const p = await open(S, width, { hasTouch: true });
        await p.tap(S.toggle);
        await p.waitForTimeout(700);
        await p.tap(`${S.dd} ${S.ddToggle}`);
        await p.waitForTimeout(400);
        if (!(await isOpen(p, S))) diffs.push(`${width} ${name}: a tap on the toggle does not open the menu`);
        await close(p);
      }
    }
  }
} finally {
  await browser.close();
  server.close();
}
for (const x of diffs) console.log('DIFF ' + x);
console.log(diffs.length ? `${diffs.length} differences between the Quarto navbar and the replica on ${COURSE}/${slug}` : `navbar replica on ${COURSE}/${slug} matches the Quarto navbar at 1440 and 390 px (closed, open, hover, keyboard, tap)`);
process.exit(diffs.length ? 1 : 0);
