// Hand-written (design prototypes): behaviour of the page shell that differs between directions.
// The pilot's course.js still does footnote/reference popovers, the figure viewer and the interactives.
const H = document.documentElement, DIR = H.dataset.dir;
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const main = $('#dg-main');
const typeset = el => window.MathJax?.typesetPromise ? MathJax.typesetPromise([el]).catch(() => {}) : Promise.resolve();

// --- layout mode: the course tree is a drawer below a breakpoint that depends on the direction ---
const BREAK = { a: 1360, b: 1100, c: Infinity }[DIR];
const mode = () => { H.classList.toggle('drawer', innerWidth < BREAK); if (innerWidth >= BREAK) H.classList.remove('nav-open'); };
mode(); addEventListener('resize', mode);

// --- buttons of the course bar and the site navbar ---
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b) {
    const act = b.dataset.act;
    if (act === 'menu') { const o = H.classList.toggle('nav-open'); b.setAttribute('aria-expanded', o); }
    if (act === 'theme') { const t = H.dataset.theme === 'dark' ? 'light' : 'dark'; H.dataset.theme = t; try { localStorage.setItem('dg-theme', t); } catch {} }
    if (act === 'map') location.href = `/design/${DIR}/index.html#dg-roadmap`;
    return;
  }
  if (e.target.closest('.sn-toggle')) $('.sn').classList.toggle('open');
  if (H.classList.contains('nav-open') && !e.target.closest('.cn')) H.classList.remove('nav-open');
  // <base> points at the real page, so same-page anchors must be handled here
  const a = e.target.closest('a[href^="#"]');
  if (a && !e.defaultPrevented) { const t = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); H.classList.remove('nav-open'); } }
});
addEventListener('keydown', e => { if (e.key === 'Escape') H.classList.remove('nav-open'); });

// --- reading progress in the course bar ---
const bar = $('.cb-progress b');
const progress = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.width = (h > 0 ? Math.min(1, scrollY / h) * 100 : 0) + '%'; };
addEventListener('scroll', progress, { passive: true }); progress();

// --- outline: mark the heading being read ---
const links = $$('.cn-outline a, .cx-outline a');
const heads = $$('h2[id], h3[id]', main);
if (heads.length) {
  const spy = () => { let cur = null; for (const h of heads) if (h.getBoundingClientRect().top < 120) cur = h.id; links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur)); };
  addEventListener('scroll', spy, { passive: true }); spy();
}

// --- direction A: footnotes become sidenotes when there is a margin ---
function sidenotes() {
  const wide = DIR === 'a' && innerWidth >= 1000 && document.body.classList.contains('reading');
  let box = $('.sidenotes');
  if (!wide) { H.classList.remove('has-sidenotes'); return; }
  if (!box) {
    box = document.createElement('div'); box.className = 'sidenotes dg-web'; main.append(box);
    for (const fn of $$('.dg-footnotes .dg-fn')) {
      const n = document.createElement('div'); n.className = 'sidenote'; n.dataset.n = $('.dg-fn-num', fn).textContent; n.dataset.for = fn.id;
      n.innerHTML = $('.dg-fn-body', fn).innerHTML; box.append(n);
    }
  }
  H.classList.add('has-sidenotes');
  let floor = 0; const top0 = main.getBoundingClientRect().top;
  for (const n of $$('.sidenote', box)) {
    const ref = $(`.dg-fnref a[href$="#${n.dataset.for}"]`, main); if (!ref) continue;
    const y = Math.max(ref.getBoundingClientRect().top - top0 - 4, floor);
    n.style.top = y + 'px'; floor = y + n.offsetHeight + 14;
  }
}
// with sidenotes, the footnote mark points at its note instead of opening a popover
const fnref = e => e.target.closest?.('.dg-fnref > a');
for (const ev of ['pointerover', 'pointerdown', 'focusin', 'click'])
  addEventListener(ev, e => {
    const a = fnref(e); if (!a) return;
    if (H.classList.contains('has-sidenotes')) {
      e.stopPropagation(); if (ev === 'click') e.preventDefault();
      const n = $(`.sidenote[data-for="${a.getAttribute('href').split('#')[1]}"]`); if (n) { n.classList.add('hot'); a.addEventListener('pointerleave', () => n.classList.remove('hot'), { once: true }); }
    } else if (DIR === 'c' && innerWidth >= 1100) {
      e.stopPropagation(); if (ev === 'click') e.preventDefault();
      const fn = document.getElementById(a.getAttribute('href').split('#')[1]);
      if (fn && ev !== 'pointerdown') pane(`<div class="cx-note"><span class="cx-kicker">Footnote ${$('.dg-fn-num', fn).textContent}</span>${$('.dg-fn-body', fn).innerHTML}</div>`);
    }
  }, true);

// --- direction C: the context pane ---
function pane(html) { const p = $('#cx-pane'); p.innerHTML = html; typeset(p); return p; }

// --- all directions: proofs (Appendix B) and worked examples (Appendix C) can be opened where they are cited ---
const cache = new Map();
function fetchPage(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then(r => r.text()).then(t => new DOMParser().parseFromString(t, 'text/html')));
  return cache.get(url);
}
const openable = a => /(proofs-and-additional-material|examples)\/(?!index)/.test(a.getAttribute('href') || '') && !a.closest('.dg-inline, .dg-prevnext, h1, h2, h3, .dg-kicker');
for (const a of $$('a.dg-xref[data-kind="section"]', main)) {
  if (!openable(a)) continue;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'dg-open-here dg-web'; b.setAttribute('aria-expanded', 'false');
  b.innerHTML = '<i class="bi bi-arrows-angle-expand" aria-hidden="true"></i> open here'; b.title = `Open ${a.textContent} here`;
  a.after(b);
}
const panels = new Map();   // target path -> open panel
const keyOf = b => new URL(b.previousElementSibling.getAttribute('href'), document.baseURI).pathname;
const mark = (key, v) => $$('.dg-open-here').forEach(x => { if (keyOf(x) === key) x.setAttribute('aria-expanded', v); });
function closePanel(key) { const box = panels.get(key); if (box) box.parentNode.removeChild(box); panels.delete(key); mark(key, 'false'); }
document.addEventListener('click', async e => {
  const b = e.target.closest('.dg-open-here'); if (!b) return;
  const a = b.previousElementSibling, href = a.getAttribute('href');
  const url = new URL(href, document.baseURI), key = url.pathname;
  if (panels.has(key)) { closePanel(key); return; }
  const doc = await fetchPage(key);
  const src = doc.querySelector('main'); const title = doc.querySelector('h1.dg-title')?.innerHTML || a.textContent;
  const box = document.createElement('div'); box.className = 'dg-inline dg-web';
  box.innerHTML = `<div class="dg-inline-head"><b>${href.includes('examples/') ? 'Appendix C' : 'Appendix B'}</b><span class="t">${title}</span><a href="${key}">open page <i class="bi bi-arrow-up-right"></i></a><button type="button" class="x" aria-label="Close">close <i class="bi bi-x-lg"></i></button></div><div class="dg-inline-body"></div>`;
  const body = $('.dg-inline-body', box);
  for (const el of [...src.children]) if (!el.matches('#title-block-header, .dg-prevnext, .dg-head')) body.append(document.importNode(el, true));
  for (const el of $$('[id]', body)) el.removeAttribute('id');
  for (const el of $$('[src], [href]', body)) for (const k of ['src', 'href']) { const v = el.getAttribute(k); if (v && !/^(#|[a-z]+:|\/)/.test(v)) { const u = new URL(v, url); el.setAttribute(k, u.pathname + u.hash); } }
  $('.x', box).addEventListener('click', () => closePanel(key));
  if (DIR === 'c' && innerWidth >= 1100) { const p = $('#cx-pane'); p.innerHTML = ''; p.append(box); }
  else {
    // a reference inside a footnote opens next to the paragraph that carries the footnote mark
    const note = a.closest('.sidenote, .dg-fn');
    const fm = note && $(`.dg-fnref a[href$="#${note.dataset.for || note.id}"]`, main);
    ((fm || a).closest('p, li, figcaption, td') || a).after(box);
  }
  panels.set(key, box); mark(key, 'true');
  await typeset(body);
});

// sidenotes are placed once the math has its final size, and again when the layout changes
const ready = () => new Promise(r => { const t = setInterval(() => { if (H.classList.contains('dg-math-ready')) { clearInterval(t); r(); } }, 60); setTimeout(() => { clearInterval(t); r(); }, 8000); });
ready().then(async () => { sidenotes(); const box = $('.sidenotes'); if (box) { await typeset(box); sidenotes(); } document.fonts?.ready.then(sidenotes); });
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(sidenotes, 120); });
new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(sidenotes, 120); }).observe(main);
