/* NÉVORA core: api, state, router, layout, cart, wishlist */
const NV = window.NV = { routes: [], user: null, cart: [], wish: new Set(), quote: null };
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (n) => '$' + (+n).toFixed(2).replace(/\.00$/, '');
const ICON = { search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/>', bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>' };
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const stars = (r) => `<span class="stars" aria-label="Rated ${r} out of 5">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</span>`;

async function api(path, { method = 'GET', body } = {}) {
  let res; try { res = await fetch('/api' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' }); } catch { throw Object.assign(new Error('Network error'), { status: 0 }); }
  const data = await res.json().catch(() => ({})); if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status, details: data.details }); return data;
}
let toastT; function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), 3200); }
const busy = async (btn, label, fn) => { const o = btn.innerHTML; btn.disabled = true; btn.textContent = label; try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = o; } };
const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

/* ---- overlay / drawers / modal (focus-managed) ---- */
let lastFocus, openEl;
function openLayer(el, focusSel) { lastFocus = document.activeElement; closeLayers(true); el.hidden = false; $('#overlay').hidden = false; document.body.style.overflow = 'hidden'; requestAnimationFrame(() => { el.classList.add('show'); $('#overlay').classList.add('show'); }); openEl = el; setTimeout(() => ($(focusSel || 'button, a, input', el))?.focus(), 60); }
function closeLayers(quick) { if (!openEl) return; const el = openEl; openEl = null; el.classList.remove('show'); $('#overlay').classList.remove('show'); document.body.style.overflow = ''; const done = () => { el.hidden = true; $('#overlay').hidden = true; if (!quick) lastFocus?.focus?.(); }; quick ? done() : setTimeout(done, 300); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLayers(); if (e.key === 'Tab' && openEl) { const f = $$('a[href],button:not([disabled]),input,select,textarea', openEl).filter((x) => x.offsetParent); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } });
document.addEventListener('click', (e) => { if (e.target.id === 'overlay') closeLayers(); });
function modal(html) { const m = $('#modal'); m.innerHTML = `<div class="box"><button class="ibtn x" data-close aria-label="Close">${icon('x')}</button>${html}</div>`; openLayer(m, 'input,button:not(.x)'); m.onclick = (e) => { if (e.target === m || e.target.closest('[data-close]')) closeLayers(); }; return m; }

/* ---- cart ---- */
async function refreshQuote() {
  const items = NV.cart; if (!items.length) { NV.quote = { items: [], subtotal: 0, shipping: 0, total: 0, issues: [], away_from_free_shipping: 0, free_shipping_threshold: 75 }; return; }
  try { NV.quote = await api('/cart/quote', { method: 'POST', body: { items } }); const ok = new Map(NV.quote.items.map((i) => [i.product.id, i.qty])); const fixed = NV.cart.filter((c) => ok.has(c.productId)).map((c) => ({ productId: c.productId, qty: ok.get(c.productId) })); if (JSON.stringify(fixed) !== JSON.stringify(NV.cart)) { NV.cart = fixed; persistCart(false); } } catch { NV.quote = null; }
}
function persistCart(sync = true) { ls.set('nv_cart', NV.cart); if (sync && NV.user) api('/cart', { method: 'PUT', body: { items: NV.cart } }).catch(() => {}); updateBadges(); }
async function addToCart(id, qty = 1, { open = true, silent = false } = {}) {
  const cur = NV.cart.find((c) => c.productId === id); if (cur) cur.qty = Math.min(20, cur.qty + qty); else NV.cart.push({ productId: id, qty });
  persistCart(); await refreshQuote(); if (NV.quote) { const line = NV.quote.items.find((i) => i.product.id === id); if (!line) { toast('Sorry, that ritual is unavailable right now.', true); return false; } if (cur && line.qty < cur.qty) toast(`Only ${line.qty} available.`, true); }
  updateBadges(); if (!silent) toast('Added to your ritual.'); if (open) showCart(); return true;
}
async function setQty(id, qty) { if (qty <= 0) NV.cart = NV.cart.filter((c) => c.productId !== id); else { const c = NV.cart.find((x) => x.productId === id); if (c) c.qty = Math.min(20, qty); } persistCart(); await refreshQuote(); renderCart(); }
function updateBadges() { const n = NV.cart.reduce((s, c) => s + c.qty, 0); $$('[data-bag-count]').forEach((b) => { b.textContent = n; b.hidden = !n; }); const w = NV.wish.size; $$('[data-wish-count]').forEach((b) => { b.textContent = w; b.hidden = !w; }); }
function showCart() { const d = $('#drawer'); d.className = 'drawer'; openLayer(d, '.dhead .ibtn'); renderCart(); }
function renderCart() {
  const d = $('#drawer'), q = NV.quote; if (!d || d.hidden && !openEl) return;
  const items = q?.items || [], pct = q ? Math.min(100, (q.subtotal / q.free_shipping_threshold) * 100) : 0;
  d.innerHTML = `<div class="dhead"><h2>Your Bag</h2><button class="ibtn" data-close aria-label="Close bag">${icon('x')}</button></div>` + (!items.length
    ? `<div class="dbody"><div class="empty"><h2>Your ritual is waiting.</h2><p>Nothing in your bag yet.</p><a class="btn" href="/shop" data-close>Explore the collection</a></div></div>`
    : `<div class="dbody"><div class="ship" role="status">${q.away_from_free_shipping > 0 ? `You’re ${usd(q.away_from_free_shipping)} away from complimentary shipping.` : 'Complimentary shipping unlocked.'}<div class="bar"><i style="width:${pct}%"></i></div></div>` +
      items.map((i) => `<div class="line"><a href="/products/${esc(i.product.slug)}" data-close><img src="${esc(i.product.thumb)}" alt="${esc(i.product.name)}" width="76" height="76"></a><div><h4>${esc(i.product.name)}</h4><small>${esc(i.product.size)}</small><div class="qty" role="group" aria-label="Quantity"><button data-q="${i.product.id}" data-d="-1" aria-label="Decrease quantity">−</button><span>${i.qty}</span><button data-q="${i.product.id}" data-d="1" aria-label="Increase quantity">+</button></div></div><div style="text-align:right"><div class="price">${usd(i.line_total)}</div><button class="link" data-rm="${i.product.id}" aria-label="Remove ${esc(i.product.name)}">Remove</button></div></div>`).join('') + '</div>' +
      `<div class="dfoot"><div class="totals"><div><span>Subtotal</span><span>${usd(q.subtotal)}</span></div><div><span>Shipping</span><span>${q.shipping ? usd(q.shipping) : 'Free'}</span></div><div class="t"><span>Total</span><span>${usd(q.total)}</span></div></div><a class="btn block" href="/checkout" data-close>Checkout</a></div>`);
  d.onclick = (e) => { const b = e.target.closest('[data-q]'), r = e.target.closest('[data-rm]'); if (b) { const id = +b.dataset.q, c = NV.cart.find((x) => x.productId === id); setQty(id, (c?.qty || 0) + +b.dataset.d); } else if (r) setQty(+r.dataset.rm, 0); else if (e.target.closest('[data-close]')) closeLayers(true); };
}

/* ---- wishlist ---- */
async function toggleWish(id) {
  const had = NV.wish.has(id); had ? NV.wish.delete(id) : NV.wish.add(id); ls.set('nv_wish', [...NV.wish]); updateBadges(); $$(`[data-wish="${id}"]`).forEach((b) => b.setAttribute('aria-pressed', !had));
  if (NV.user) { try { await api(had ? '/wishlist/' + id : '/wishlist', { method: had ? 'DELETE' : 'POST', body: had ? undefined : { productId: id } }); } catch { toast('We couldn’t update your wishlist.', true); } }
  toast('Your wishlist has been updated.'); if (location.pathname === '/wishlist') NV.render();
}

/* ---- session ---- */
async function loadUser() {
  try { NV.user = (await api('/auth/me')).user; } catch { NV.user = null; }
  NV.cart = ls.get('nv_cart', []); NV.wish = new Set(ls.get('nv_wish', []));
  if (NV.user) await syncAfterAuth();
}
async function syncAfterAuth() {
  try { const srv = (await api('/cart')).items, m = new Map(); [...srv, ...NV.cart].forEach((i) => m.set(i.productId, Math.min(20, Math.max(m.get(i.productId) || 0, i.qty)))); NV.cart = [...m].map(([productId, qty]) => ({ productId, qty })); persistCart(); if (NV.wish.size) await api('/wishlist', { method: 'POST', body: { productIds: [...NV.wish] } }); NV.wish = new Set((await api('/wishlist')).products.map((p) => p.id)); ls.set('nv_wish', [...NV.wish]); } catch {}
}
async function logout() { await api('/auth/logout', { method: 'POST' }).catch(() => {}); NV.user = null; NV.cart = []; NV.wish = new Set(); ls.set('nv_cart', []); ls.set('nv_wish', []); NV.quote = null; renderHeader(); go('/'); toast('You’ve been signed out.'); }

/* ---- layout ---- */
const MENU = [['Skincare', [['Cleansers', '/shop?category=cleansers'], ['Serums', '/shop?category=serums'], ['Moisturizers', '/shop?category=moisturizers'], ['Eye Care', '/shop?category=eye-care'], ['Masks', '/shop?category=masks'], ['SPF', '/shop?category=spf']]], ['Haircare', [['Shampoo', '/shop?category=shampoo'], ['Conditioner', '/shop?category=conditioner'], ['Treatments', '/shop?category=hair-treatments']]], ['Body', [['Body Lotion', '/shop?category=body-lotion'], ['Body Care', '/shop?category=body-care']]], ['Discover', [['Skin Quiz', '/skin-quiz'], ['Ritual Builder', '/ritual'], ['Journal', '/journal'], ['Our Ritual', '/our-ritual']]]];
function renderHeader() {
  $('#header').innerHTML = `<div class="announce">Complimentary shipping on rituals over $75<span class="hm"> · Free returns within 30 days</span></div>
  <header class="site" id="site"><div class="wrap"><nav class="nav" aria-label="Main"><div class="l"><button class="ibtn burger" id="burger" aria-label="Open menu">${icon('menu')}</button><a class="logo" href="/" aria-label="NÉVORA home">NÉVORA</a></div>
  <ul class="links"><li class="has-mega"><a href="/shop" aria-haspopup="true">Shop</a><div class="mega">${MENU.map(([h, l]) => `<div><h4>${h}</h4>${l.map(([n, u]) => `<a href="${u}">${n}</a>`).join('')}</div>`).join('')}</div></li><li><a href="/collections">Collections</a></li><li><a href="/skin-quiz">Skin Quiz</a></li><li><a href="/our-ritual">Our Ritual</a></li><li><a href="/journal">Journal</a></li></ul>
  <div class="icons"><button class="ibtn" id="sbtn" aria-label="Search" aria-expanded="false">${icon('search')}</button><a class="ibtn d" href="${NV.user ? '/account' : '/login'}" aria-label="Account">${icon('user')}</a><a class="ibtn d" href="/wishlist" aria-label="Wishlist">${icon('heart')}<span class="badge" data-wish-count hidden></span></a><button class="ibtn" id="bagbtn" aria-label="Open bag">${icon('bag')}<span class="badge" data-bag-count hidden></span></button></div></nav></div><div id="sbar"></div></header>`;
  updateBadges(); onScroll();
  $('#bagbtn').onclick = async () => { await refreshQuote(); showCart(); };
  $('#burger').onclick = openMobileMenu;
  $('#sbtn').onclick = () => { const s = $('#sbar'); if (s.innerHTML) { s.innerHTML = ''; $('#sbtn').setAttribute('aria-expanded', false); return; } $('#sbtn').setAttribute('aria-expanded', true); s.innerHTML = `<div class="searchbar"><div class="wrap"><form role="search"><label class="sr" for="hq">Search products</label><input id="hq" type="search" placeholder="Search serums, concerns, ingredients…" autocomplete="off"><button class="btn">Search</button></form></div></div>`; $('#hq').focus(); $('#sbar form').onsubmit = (e) => { e.preventDefault(); const v = $('#hq').value.trim(); s.innerHTML = ''; go('/shop' + (v ? '?q=' + encodeURIComponent(v) : '')); }; };
}
function openMobileMenu() {
  const d = $('#drawer'); d.className = 'drawer left'; d.innerHTML = `<div class="dhead" style="border-color:rgba(244,233,220,.1)"><span class="logo">NÉVORA</span><button class="ibtn" data-close aria-label="Close menu">${icon('x')}</button></div><nav class="dbody mnav" aria-label="Mobile"><a href="/shop">Shop</a><a href="/collections">Collections</a><a href="/skin-quiz">Skin Quiz</a><a href="/our-ritual">Our Ritual</a><a href="/journal">Journal</a><a href="${NV.user ? '/account' : '/login'}">Account</a><a href="/wishlist">Wishlist</a>${NV.user ? '<button id="mout">Sign out</button>' : ''}</nav>`;
  openLayer(d, '.dhead .ibtn'); d.onclick = (e) => { if (e.target.closest('[data-close]') || e.target.closest('a')) closeLayers(true); if (e.target.id === 'mout') { closeLayers(true); logout(); } };
}
function onScroll() { const h = $('#site'); if (!h) return; h.classList.toggle('scrolled', scrollY > 40); h.classList.toggle('solid', NV.solidHeader || false); }
addEventListener('scroll', onScroll, { passive: true });
function renderFooter() {
  $('#footer').innerHTML = `<footer><div class="wrap"><div class="fgrid"><div><div class="logo">NÉVORA</div><p style="opacity:.7;margin:10px 0 20px" class="serif"><em style="font-size:22px">Beauty as Ritual.</em></p><form id="nl-f" style="display:flex;gap:8px;max-width:320px" class="dark"><label class="sr" for="nl-f-e">Email</label><input id="nl-f-e" type="email" placeholder="Your email" required autocomplete="email"><button class="btn sm">Join</button></form></div>
  <div><h4>Shop</h4><a href="/shop?dept=skincare">Skincare</a><a href="/shop?dept=haircare">Haircare</a><a href="/shop?dept=body">Body</a><a href="/shop">All Products</a></div>
  <div><h4>Discover</h4><a href="/skin-quiz">Skin Quiz</a><a href="/ritual">Ritual Builder</a><a href="/our-ritual">Our Ritual</a><a href="/journal">Journal</a></div>
  <div><h4>Help</h4><a href="/help/contact">Contact</a><a href="/help/shipping">Shipping</a><a href="/help/returns">Returns</a><a href="/track-order">Track Order</a><a href="/help/faqs">FAQs</a></div></div>
  <div class="fbot"><span>© ${new Date().getFullYear()} NÉVORA. All rights reserved.</span><span>Beauty as Ritual.</span></div></div></footer>`;
  $('#nl-f').onsubmit = (e) => subscribe(e, $('#nl-f-e'));
}
async function subscribe(e, input) { e.preventDefault(); const btn = e.target.querySelector('button'); try { await busy(btn, '…', () => api('/subscribers', { method: 'POST', body: { email: input.value } })); input.value = ''; toast('Welcome to the ritual.'); } catch (er) { toast(er.status === 422 ? er.message : 'Something went wrong. Please try again.', true); } }

/* ---- product card ---- */
function card(p, dark) {
  const out = p.stock_state === 'out_of_stock';
  return `<article class="pcard${dark ? ' dark' : ''}"><a class="pimg" href="/products/${esc(p.slug)}" tabindex="-1" aria-hidden="true"><img src="${esc(p.thumb || p.image)}" alt="" loading="lazy" width="360" height="360">${out ? '<span class="tag out">Sold out</span>' : p.badge ? `<span class="tag">${esc(p.badge)}</span>` : ''}</a>
  <button class="wish" data-wish="${p.id}" aria-pressed="${NV.wish.has(p.id)}" aria-label="Add ${esc(p.name)} to wishlist">${icon('heart')}</button>
  <div class="pinfo"><span class="pcat">${esc(p.category.name)}</span><a class="pname" href="/products/${esc(p.slug)}">${esc(p.name)}</a><span class="psub">${esc(p.short_description)}</span>
  <div class="pmeta"><span>${stars(p.rating)} <small>${p.rating}</small></span><span class="price">${p.compare_at ? `<span class="was">${usd(p.compare_at)}</span>` : ''}${usd(p.price)}</span></div>
  <button class="btn sm block" data-add="${p.id}" ${out ? 'disabled' : ''}>${out ? 'Sold out' : 'Add to bag'}</button></div></article>`;
}
document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-add]'), w = e.target.closest('[data-wish]');
  if (a) { e.preventDefault(); await busy(a, 'Adding…', () => addToCart(+a.dataset.add)); }
  else if (w) { e.preventDefault(); toggleWish(+w.dataset.wish); }
});
const skeletons = (n = 8) => `<div class="pgrid">${'<div class="skel"></div>'.repeat(n)}</div>`;
const errorBox = (msg, retry) => `<div class="empty" role="alert"><h2>${esc(msg || 'We couldn’t load this ritual. Please try again.')}</h2>${retry ? '<button class="btn" data-retry>Try again</button>' : ''}</div>`;

/* ---- router ---- */
function route(pattern, handler) { NV.routes.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), handler }); }
function go(url) { if (url === location.pathname + location.search) return NV.render(); history.pushState({}, '', url); NV.render(); }
document.addEventListener('click', (e) => { const a = e.target.closest('a[href^="/"]'); if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || a.hasAttribute('download')) return; e.preventDefault(); closeLayers(true); go(a.getAttribute('href')); scrollTo(0, 0); });
addEventListener('popstate', () => NV.render());
NV.render = async function () {
  const m = $('#main'); NV.solidHeader = true; $('#sbar') && ($('#sbar').innerHTML = '');
  for (const r of NV.routes) { const x = r.re.exec(location.pathname); if (x) { document.body.dataset.page = location.pathname; try { await r.handler(m, x.groups || {}, new URLSearchParams(location.search)); } catch (er) { m.innerHTML = `<div class="narrow">${errorBox(er.status === 404 ? 'We couldn’t find that page.' : null, er.status !== 404)}</div>`; const rb = $('[data-retry]'); if (rb) rb.onclick = () => NV.render(); } onScroll(); observeReveal(); return; } }
  m.innerHTML = `<div class="narrow"><div class="empty"><h1 class="serif" style="font-size:56px">Page not found</h1><p>The page you’re looking for has moved or doesn’t exist.</p><a class="btn" href="/">Return home</a></div></div>`; document.title = 'Not found — NÉVORA';
};
function observeReveal() { const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .12 }); $$('.reveal:not(.in)').forEach((el) => io.observe(el)); }
NV.start = async function () { await loadUser(); renderHeader(); renderFooter(); await refreshQuote(); NV.render(); };
Object.assign(NV, { api, esc, usd, $, $$, icon, stars, card, toast, busy, addToCart, toggleWish, route, go, modal, closeLayers, skeletons, errorBox, showCart, refreshQuote, renderHeader, syncAfterAuth, logout, subscribe, persistCart });
