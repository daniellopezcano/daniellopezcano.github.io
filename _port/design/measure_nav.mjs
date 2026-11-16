// Hand-written (design study): computed look of the site's navbar on a Quarto page, to replicate it on course pages.
import { chromium, serveDocs } from '../tools/shot.mjs';
const { server, base } = await serveDocs();
const b = await chromium.launch();
for (const w of [1280, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 800 } });
  await p.goto(base + '/teaching_and_projects.html', { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    const cs = (el, props) => { if (!el) return null; const s = getComputedStyle(el); const o = {}; for (const k of props) o[k] = s[k]; const bb = el.getBoundingClientRect(); o.box = [Math.round(bb.x), Math.round(bb.y), Math.round(bb.width), Math.round(bb.height)]; return o; };
    const P = ['backgroundColor', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'padding', 'margin', 'borderBottom', 'boxShadow', 'position', 'letterSpacing', 'textTransform', 'backdropFilter', 'gap', 'display', 'justifyContent'];
    const q = s => document.querySelector(s);
    return { header: cs(q('#quarto-header'), P), navbar: cs(q('.navbar'), P), container: cs(q('.navbar .navbar-container'), P), ul: cs(q('.navbar-nav'), P),
      link: cs(q('.navbar-nav .nav-link:not(.active)'), P), active: cs(q('.navbar-nav .nav-link.active'), P), toggler: cs(q('.navbar-toggler'), P), search: cs(q('#quarto-search'), P),
      searchBtn: cs(q('#quarto-search .aa-DetachedSearchButton, #quarto-search button'), P), body: cs(document.body, P), footer: cs(q('footer.footer'), P),
      links: [...document.querySelectorAll('.navbar-nav .nav-link')].map(a => [a.textContent.trim(), a.getAttribute('href'), Math.round(a.getBoundingClientRect().x), Math.round(a.getBoundingClientRect().width)]) };
  });
  console.log(w, JSON.stringify(r, null, 0));
  await p.locator('#quarto-header').screenshot({ path: `_port/.work/nav-${w}.png` });
  await p.close();
}
await b.close(); server.close();
