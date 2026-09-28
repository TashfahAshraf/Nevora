// NÉVORA server — zero external dependencies (Node 22+). `node server.js`
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { db, hash, hashPassword, verifyPassword, tx } = require('./db');
const PORT = +process.env.PORT || 3000, PUB = path.join(__dirname, 'public'), FREE_SHIP = 7500, SHIP = 600, IS_PROD = process.env.NODE_ENV === 'production';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.txt': 'text/plain' };
class HttpErr extends Error { constructor(s, m, d) { super(m); this.status = s; this.details = d; } }
const bad = (m, d) => new HttpErr(422, m, d);
const clean = (s, n = 500) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>]/g, '').trim().slice(0, n);
const isEmail = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const isPhone = (p) => /^[+()\d\s-]{7,20}$/.test(p || '');
const money = (c) => +(c / 100).toFixed(2);

/* ---------- serializers ---------- */
const PSQL = `SELECT p.*, c.name cat_name, c.slug cat_slug, c.dept cat_dept, co.name col_name, co.slug col_slug FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN collections co ON co.id=p.collection_id`;
function stockState(p) { return p.stock <= 0 ? 'out_of_stock' : p.stock <= p.low_stock_threshold ? 'low_stock' : 'in_stock'; }
function ser(p, full) {
  const imgs = db.prepare('SELECT url,thumb_url,alt,kind FROM product_images WHERE product_id=? ORDER BY sort,id').all(p.id);
  const o = { id: p.id, name: p.name, slug: p.slug, short_description: p.short_description, price: money(p.price_cents), compare_at: p.compare_at_cents ? money(p.compare_at_cents) : null, size: p.size,
    category: { name: p.cat_name, slug: p.cat_slug, dept: p.cat_dept }, collection: p.col_slug ? { name: p.col_name, slug: p.col_slug } : null, rating: p.rating, review_count: p.review_count,
    stock_state: stockState(p), image: imgs[0]?.url, thumb: imgs[0]?.thumb_url, images: imgs, ritual_step: p.ritual_step, skin_types: p.skin_types.split(',').filter(Boolean), concerns: p.concerns.split(',').filter(Boolean),
    badge: p.stock <= 0 ? null : p.is_new ? 'New' : p.stock <= p.low_stock_threshold ? 'Low Stock' : p.is_bestseller ? 'Bestseller' : null, is_featured: !!p.is_featured, status: p.status };
  if (full) { o.description = p.description; o.how_to_use = p.how_to_use; o.stock = p.stock; o.low_stock_threshold = p.low_stock_threshold;
    o.ingredients = db.prepare('SELECT i.name,i.slug,i.description FROM ingredients i JOIN product_ingredients pi ON pi.ingredient_id=i.id WHERE pi.product_id=?').all(p.id); }
  return o;
}
const getProduct = (idOrSlug) => db.prepare(PSQL + ' WHERE (p.id=? OR p.slug=?)').get(/^\d+$/.test(idOrSlug) ? +idOrSlug : -1, String(idOrSlug));

/* ---------- auth / sessions ---------- */
function parseCookies(req) { const o = {}; (req.headers.cookie || '').split(';').forEach((c) => { const i = c.indexOf('='); if (i > 0) o[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1)); }); return o; }
function currentUser(req) {
  const t = parseCookies(req).nv_session; if (!t) return null;
  const s = db.prepare('SELECT u.id,u.name,u.email,u.phone,u.role,s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(hash(t));
  if (!s || s.expires_at < Date.now()) return null; return s;
}
function startSession(res, uid) {
  const t = crypto.randomBytes(32).toString('base64url'), exp = Date.now() + 14 * 864e5;
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(t), uid, exp);
  res.setHeader('Set-Cookie', `nv_session=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${14 * 86400}${IS_PROD ? '; Secure' : ''}`);
}
const need = (u) => { if (!u) throw new HttpErr(401, 'Please sign in to continue.'); return u; };
const needAdmin = (u) => { need(u); if (u.role !== 'admin') throw new HttpErr(403, 'Not authorised.'); return u; };
const hits = new Map();
function limit(key, max, ms) { const n = Date.now(), a = (hits.get(key) || []).filter((t) => n - t < ms); if (a.length >= max) throw new HttpErr(429, 'Too many attempts. Please wait a moment.'); a.push(n); hits.set(key, a); }

/* ---------- pricing (server is the source of truth) ---------- */
function priceLines(items, { strict = false } = {}) {
  if (!Array.isArray(items) || items.length > 50) throw bad('Invalid cart.');
  const merged = new Map();
  for (const it of items) { const id = +it.productId, q = +it.qty; if (!Number.isInteger(id) || !Number.isInteger(q) || q < 1 || q > 20) throw bad('Invalid item quantity.'); merged.set(id, Math.min(20, (merged.get(id) || 0) + q)); }
  const lines = [], issues = [];
  for (const [id, qty] of merged) {
    const p = getProduct(String(id)); if (!p || p.status !== 'active') { if (strict) throw bad('An item in your bag is no longer available.'); issues.push({ productId: id, issue: 'unavailable' }); continue; }
    if (p.stock < qty) { if (strict) throw new HttpErr(409, `Only ${p.stock} of ${p.name} left in stock.`); if (p.stock <= 0) { issues.push({ productId: id, issue: 'out_of_stock' }); continue; } issues.push({ productId: id, issue: 'reduced', available: p.stock }); }
    const q = Math.min(qty, p.stock); lines.push({ product: ser(p), qty: q, unit: p.price_cents, line: p.price_cents * q, _row: p });
  }
  const subtotal = lines.reduce((s, l) => s + l.line, 0), shipping = subtotal === 0 || subtotal >= FREE_SHIP ? 0 : SHIP;
  return { lines, issues, subtotal, shipping, total: subtotal + shipping, free_shipping_threshold: money(FREE_SHIP), away: subtotal >= FREE_SHIP || !subtotal ? 0 : money(FREE_SHIP - subtotal) };
}
const quoteOut = (q) => ({ items: q.lines.map((l) => ({ product: l.product, qty: l.qty, line_total: money(l.line) })), issues: q.issues, subtotal: money(q.subtotal), shipping: money(q.shipping), total: money(q.total), free_shipping_threshold: q.free_shipping_threshold, away_from_free_shipping: q.away });

/* ---------- product queries ---------- */
function listProducts(qs, { admin = false } = {}) {
  const w = [admin ? '1=1' : "p.status='active'"], a = [];
  const q = clean(qs.get('q') || '', 80).toLowerCase();
  if (q) for (const t of q.split(/\s+/).slice(0, 5)) { w.push(`(lower(p.name) LIKE ? OR lower(c.name) LIKE ? OR lower(p.concerns) LIKE ? OR lower(p.description) LIKE ? OR lower(p.short_description) LIKE ? OR EXISTS(SELECT 1 FROM product_ingredients pi JOIN ingredients i ON i.id=pi.ingredient_id WHERE pi.product_id=p.id AND lower(i.name) LIKE ?))`); const l = `%${t.replace(/[%_]/g, '')}%`; a.push(l, l, l, l, l, l); }
  if (qs.get('category')) { w.push('c.slug=?'); a.push(qs.get('category')); }
  if (qs.get('dept')) { w.push('c.dept=?'); a.push(qs.get('dept')); }
  if (qs.get('collection')) { w.push('co.slug=?'); a.push(qs.get('collection')); }
  if (qs.get('step')) { w.push('p.ritual_step=?'); a.push(qs.get('step')); }
  if (qs.get('skin')) { w.push("(',' || p.skin_types || ',') LIKE ?"); a.push(`%,${clean(qs.get('skin'), 20)},%`); }
  if (qs.get('concern')) { w.push("(',' || p.concerns || ',') LIKE ?"); a.push(`%,${clean(qs.get('concern'), 20)},%`); }
  if (qs.get('min') != null && qs.get('min') !== '') { w.push('p.price_cents>=?'); a.push(Math.round(+qs.get('min') * 100) || 0); }
  if (qs.get('max') != null && qs.get('max') !== '') { w.push('p.price_cents<=?'); a.push(Math.round(+qs.get('max') * 100) || 0); }
  if (qs.get('avail') === 'in') w.push('p.stock>0');
  if (qs.get('featured')) w.push('p.is_featured=1');
  const order = { newest: 'p.created_at DESC, p.id DESC', 'price-asc': 'p.price_cents ASC', 'price-desc': 'p.price_cents DESC', rating: 'p.rating DESC, p.review_count DESC' }[qs.get('sort')] || 'p.is_featured DESC, p.is_bestseller DESC, p.rating DESC, p.id';
  const page = Math.max(1, +qs.get('page') || 1), lim = Math.min(48, Math.max(1, +qs.get('limit') || 12));
  const where = w.join(' AND '), total = db.prepare(`SELECT COUNT(*) n FROM products p JOIN categories c ON c.id=p.category_id LEFT JOIN collections co ON co.id=p.collection_id WHERE ${where}`).get(...a).n;
  const rows = db.prepare(`${PSQL} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...a, lim, (page - 1) * lim);
  return { products: rows.map((r) => ser(r, admin)), total, page, pages: Math.ceil(total / lim) };
}

/* ---------- validation helpers ---------- */
function validateContact(b) {
  const e = {}, v = { full_name: clean(b.full_name, 100), email: clean(b.email, 254).toLowerCase(), phone: clean(b.phone, 20), address: clean(b.address, 200), city: clean(b.city, 80), postal_code: clean(b.postal_code, 12) };
  if (v.full_name.length < 2) e.full_name = 'Please enter your full name.'; if (!isEmail(v.email)) e.email = 'Please enter a valid email.'; if (!isPhone(v.phone)) e.phone = 'Please enter a valid phone number.';
  if (v.address.length < 5) e.address = 'Please enter your address.'; if (v.city.length < 2) e.city = 'Please enter your city.'; if (!/^[A-Za-z0-9 -]{3,12}$/.test(v.postal_code)) e.postal_code = 'Please enter a valid postal code.';
  if (Object.keys(e).length) throw bad('Please check your details.', e); return v;
}
function recalcRating(pid) { const r = db.prepare("SELECT COUNT(*) n, AVG(rating) a FROM reviews WHERE product_id=? AND status='approved'").get(pid); if (r.n) db.prepare('UPDATE products SET rating=?, review_count=? WHERE id=?').run(+r.a.toFixed(1), r.n, pid); }
function orderOut(o, withItems = true) { const r = { order_number: o.order_number, status: o.status, created_at: o.created_at, updated_at: o.updated_at, subtotal: money(o.subtotal_cents), shipping: money(o.shipping_cents), total: money(o.total_cents), payment_method: o.payment_method, full_name: o.full_name, email: o.email, phone: o.phone, address: o.address, city: o.city, postal_code: o.postal_code };
  if (withItems) r.items = db.prepare('SELECT product_id,name,size,image,unit_price_cents,qty FROM order_items WHERE order_id=?').all(o.id).map((i) => ({ product_id: i.product_id, name: i.name, size: i.size, image: i.image, unit_price: money(i.unit_price_cents), qty: i.qty })); return r; }

/* ---------- quiz scoring ---------- */
function recommend(ans) {
  const rows = db.prepare(`${PSQL} WHERE p.status='active' AND p.stock>0 AND p.ritual_step IS NOT NULL AND c.slug!='discovery-minis'`).all();
  const count = { minimal: 2, balanced: 3, complete: 4 }[ans.routine] || 3, steps = ['cleanse', 'treat', 'hydrate', 'protect'];
  const wantSteps = count === 2 ? ['cleanse', 'hydrate'] : count === 3 ? ['cleanse', 'treat', 'hydrate'] : steps;
  const score = (p) => { let s = p.rating; const st = p.skin_types.split(','), cn = p.concerns.split(',');
    if (st.includes(ans.skin_type)) s += 3; if (cn.includes(ans.concern)) s += 4;
    if (ans.after_cleansing === 'tight' && (cn.includes('dehydration') || cn.includes('barrier'))) s += 1.5; if (ans.after_cleansing === 'oily' && cn.includes('breakouts')) s += 1.5; if (ans.after_cleansing === 'irritated' && (cn.includes('sensitivity') || cn.includes('barrier'))) s += 2;
    if (ans.skin_type === 'sensitive' && st.includes('sensitive')) s += 1; return s; };
  const picks = wantSteps.map((step) => rows.filter((p) => p.ritual_step === step && (step !== 'treat' || /serum|essence|toner|mask|exfol/.test(p.cat_slug))).sort((a, b) => score(b) - score(a))[0]).filter(Boolean);
  if (ans.concern === 'breakouts' || ans.concern === 'dullness') { /* keep serums first for treat */ }
  return picks.map((p) => ({ ...ser(p), match: Math.min(99, Math.round(score(p) / 12 * 100)) }));
}

/* ---------- routes ---------- */
const routes = [];
const route = (m, p, h) => routes.push({ m, re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), h });

route('GET', '/api/health', () => ({ ok: true }));
route('GET', '/api/products', ({ url }) => listProducts(url.searchParams));
route('GET', '/api/products/:id', ({ params }) => { const p = getProduct(params.id); if (!p || p.status !== 'active') throw new HttpErr(404, 'Product not found.'); const o = ser(p, true);
  o.related = db.prepare(`${PSQL} WHERE p.status='active' AND p.stock>0 AND p.id!=? AND (p.category_id=? OR p.collection_id=?) ORDER BY (p.category_id=?) DESC, p.rating DESC LIMIT 4`).all(p.id, p.category_id, p.collection_id, p.category_id).map((r) => ser(r));
  const nextStep = { cleanse: 'treat', treat: 'hydrate', hydrate: 'protect' }[p.ritual_step];
  o.complete_the_ritual = nextStep ? db.prepare(`${PSQL} WHERE p.status='active' AND p.stock>0 AND p.ritual_step=? AND c.dept='skincare' AND c.slug!='discovery-minis' ORDER BY p.is_bestseller DESC, p.rating DESC LIMIT 2`).all(nextStep).map((r) => ser(r)) : []; return o; });
route('GET', '/api/products/:id/reviews', ({ params }) => { const p = getProduct(params.id); if (!p) throw new HttpErr(404, 'Product not found.'); return { reviews: db.prepare("SELECT author,rating,title,body,verified,created_at FROM reviews WHERE product_id=? AND status='approved' ORDER BY created_at DESC, id DESC LIMIT 50").all(p.id).map((r) => ({ ...r, verified: !!r.verified })) }; });
route('POST', '/api/products/:id/reviews', ({ params, body, user }) => { need(user); const p = getProduct(params.id); if (!p) throw new HttpErr(404, 'Product not found.');
  const rating = +body.rating, text = clean(body.body, 1000), t = clean(body.title, 100); if (!(rating >= 1 && rating <= 5 && Number.isInteger(rating))) throw bad('Please choose a rating.'); if (text.length < 10) throw bad('Please tell us a little more (at least 10 characters).');
  const bought = db.prepare("SELECT 1 FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.user_id=? AND i.product_id=? AND o.status!='cancelled' LIMIT 1").get(user.id, p.id);
  if (!bought) throw new HttpErr(403, 'Reviews are open to customers who have purchased this product.');
  if (db.prepare('SELECT 1 FROM reviews WHERE product_id=? AND user_id=?').get(p.id, user.id)) throw new HttpErr(409, 'You have already reviewed this product.');
  db.prepare("INSERT INTO reviews(product_id,user_id,author,rating,title,body,verified,status) VALUES(?,?,?,?,?,?,1,'pending')").run(p.id, user.id, user.name.split(' ')[0] + ' ' + (user.name.split(' ')[1]?.[0] || '') + '.', rating, t, text); return { status: 201, message: 'Thank you — your review will appear once approved.' }; });
route('GET', '/api/categories', () => ({ categories: db.prepare("SELECT c.name,c.slug,c.dept,(SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.status='active') count FROM categories c ORDER BY c.sort").all(), collections: db.prepare('SELECT name,slug,description FROM collections').all() }));
route('GET', '/api/categories/:slug', ({ params }) => { const c = db.prepare('SELECT name,slug,dept FROM categories WHERE slug=?').get(params.slug); if (!c) throw new HttpErr(404, 'Category not found.'); return { category: c, ...listProducts(new URLSearchParams({ category: c.slug, limit: '24' })) }; });
route('GET', '/api/ingredients', () => ({ ingredients: db.prepare('SELECT * FROM ingredients').all().map((i) => ({ ...i, concerns: i.concerns.split(','), products: db.prepare("SELECT p.name,p.slug FROM products p JOIN product_ingredients pi ON pi.product_id=p.id WHERE pi.ingredient_id=? AND p.status='active' ORDER BY p.rating DESC LIMIT 4").all(i.id) })) }));
route('GET', '/api/reviews/featured', () => ({ reviews: db.prepare("SELECT r.author,r.rating,r.title,r.body,r.verified,p.name product,p.slug FROM reviews r JOIN products p ON p.id=r.product_id WHERE r.status='approved' AND r.rating=5 ORDER BY r.id DESC LIMIT 3").all() }));
route('GET', '/api/journal', () => ({ posts: db.prepare('SELECT slug,title,category,excerpt,cover,published_at FROM journal_posts ORDER BY published_at DESC, id').all() }));
route('GET', '/api/journal/:slug', ({ params }) => { const p = db.prepare('SELECT * FROM journal_posts WHERE slug=?').get(params.slug); if (!p) throw new HttpErr(404, 'Article not found.'); return p; });
route('POST', '/api/subscribers', ({ body, ip }) => { limit('sub' + ip, 10, 6e4); const email = clean(body.email, 254).toLowerCase(); if (!isEmail(email)) throw bad('Please enter a valid email.');
  const r = db.prepare('INSERT OR IGNORE INTO subscribers(email) VALUES(?)').run(email); return { status: r.changes ? 201 : 200, message: 'Welcome to the ritual.' }; });

route('POST', '/api/cart/quote', ({ body }) => quoteOut(priceLines(body.items || [])));
route('GET', '/api/cart', ({ user }) => { need(user); const c = db.prepare('SELECT id FROM carts WHERE user_id=?').get(user.id); const items = c ? db.prepare('SELECT product_id productId, qty FROM cart_items WHERE cart_id=?').all(c.id) : []; return { items }; });
route('PUT', '/api/cart', ({ body, user }) => { need(user); const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50).filter((i) => Number.isInteger(+i.productId) && Number.isInteger(+i.qty) && +i.qty > 0 && +i.qty <= 20);
  tx(() => { let c = db.prepare('SELECT id FROM carts WHERE user_id=?').get(user.id); if (!c) c = { id: db.prepare('INSERT INTO carts(user_id) VALUES(?)').run(user.id).lastInsertRowid }; db.prepare('DELETE FROM cart_items WHERE cart_id=?').run(c.id);
    for (const i of items) if (db.prepare('SELECT 1 FROM products WHERE id=?').get(+i.productId)) db.prepare('INSERT OR REPLACE INTO cart_items VALUES(?,?,?)').run(c.id, +i.productId, +i.qty); db.prepare('UPDATE carts SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(c.id); }); return { ok: true }; });

route('POST', '/api/orders', ({ body, user }) => {
  const v = validateContact(body.contact || {}); const pm = 'cod';
  const order = tx(() => {
    const q = priceLines(body.items, { strict: true }); if (!q.lines.length) throw bad('Your bag is empty.');
    const n = db.prepare('SELECT COALESCE(MAX(id),0)+1284 n FROM orders').get().n, num = `NV-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`;
    const oid = db.prepare('INSERT INTO orders(order_number,user_id,email,full_name,phone,address,city,postal_code,subtotal_cents,shipping_cents,total_cents,payment_method) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(num, user?.id ?? null, v.email, v.full_name, v.phone, v.address, v.city, v.postal_code, q.subtotal, q.shipping, q.total, pm).lastInsertRowid;
    for (const l of q.lines) { const u = db.prepare('UPDATE products SET stock=stock-?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=?').run(l.qty, l.product.id, l.qty); if (!u.changes) throw new HttpErr(409, `Sorry, ${l.product.name} just sold out.`);
      db.prepare('INSERT INTO order_items(order_id,product_id,name,size,image,unit_price_cents,qty) VALUES(?,?,?,?,?,?,?)').run(oid, l.product.id, l.product.name, l.product.size, l.product.thumb, l.unit, l.qty); }
    if (user) db.prepare('DELETE FROM cart_items WHERE cart_id=(SELECT id FROM carts WHERE user_id=?)').run(user.id);
    return db.prepare('SELECT * FROM orders WHERE id=?').get(oid); });
  return { status: 201, order: orderOut(order) }; });
route('GET', '/api/orders/:num', ({ params, url, user }) => { const o = db.prepare('SELECT * FROM orders WHERE order_number=?').get(params.num); const email = (url.searchParams.get('email') || '').toLowerCase();
  if (!o || !((user && (user.role === 'admin' || o.user_id === user.id)) || (email && o.email === email))) throw new HttpErr(404, 'We couldn’t find an order with those details.'); return { order: orderOut(o) }; });

route('POST', '/api/quiz', ({ body, user }) => { const qs = db.prepare('SELECT key,options FROM quiz_questions').all(), ans = {};
  for (const q of qs) { const v = clean(body.answers?.[q.key], 30); if (!JSON.parse(q.options).some((o) => o.value === v)) throw bad('Please answer every question.'); ans[q.key] = v; }
  const picks = recommend(ans); db.prepare('INSERT INTO quiz_results(user_id,answers,product_ids) VALUES(?,?,?)').run(user?.id ?? null, JSON.stringify(ans), JSON.stringify(picks.map((p) => p.id))); return { answers: ans, products: picks, total: money(picks.reduce((s, p) => s + p.price * 100, 0)) }; });
route('GET', '/api/quiz/questions', () => ({ questions: db.prepare('SELECT key,prompt,options FROM quiz_questions ORDER BY sort').all().map((q) => ({ ...q, options: JSON.parse(q.options) })) }));
route('GET', '/api/ritual/options', () => { const o = {}; for (const s of ['cleanse', 'treat', 'hydrate', 'protect']) o[s] = db.prepare(`${PSQL} WHERE p.status='active' AND p.stock>0 AND p.ritual_step=? AND c.dept='skincare' AND c.slug NOT IN('discovery-minis','lip-care') ORDER BY p.is_bestseller DESC, p.rating DESC LIMIT 8`).all(s).map((r) => ser(r)); return o; });

/* auth */
route('POST', '/api/auth/signup', ({ body, res, ip }) => { limit('su' + ip, 10, 36e5); const name = clean(body.name, 80), email = clean(body.email, 254).toLowerCase(), pw = String(body.password || '');
  if (name.length < 2) throw bad('Please enter your name.'); if (!isEmail(email)) throw bad('Please enter a valid email.'); if (pw.length < 8 || pw.length > 200) throw bad('Password must be at least 8 characters.');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw new HttpErr(409, 'An account with this email already exists.');
  const id = db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name, email, hashPassword(pw)).lastInsertRowid; startSession(res, id); return { status: 201, user: { id: +id, name, email, role: 'customer' } }; });
route('POST', '/api/auth/login', ({ body, res, ip }) => { limit('li' + ip, 10, 9e5); const u = db.prepare('SELECT * FROM users WHERE email=?').get(clean(body.email, 254).toLowerCase());
  if (!u || !verifyPassword(String(body.password || ''), u.password_hash)) throw new HttpErr(401, 'Email or password is incorrect.'); startSession(res, u.id); return { user: { id: u.id, name: u.name, email: u.email, role: u.role } }; });
route('POST', '/api/auth/logout', ({ req, res }) => { const t = parseCookies(req).nv_session; if (t) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(t)); res.setHeader('Set-Cookie', 'nv_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'); return { ok: true }; });
route('GET', '/api/auth/me', ({ user }) => ({ user: user && { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } }));
route('POST', '/api/auth/forgot', ({ body, ip }) => { limit('fp' + ip, 5, 36e5); const u = db.prepare('SELECT id FROM users WHERE email=?').get(clean(body.email, 254).toLowerCase());
  if (u) { const t = crypto.randomBytes(24).toString('base64url'); db.prepare('INSERT INTO password_resets VALUES(?,?,?)').run(hash(t), u.id, Date.now() + 36e5);
    console.log(`[password reset] http://localhost:${PORT}/reset-password?token=${t}   (no email provider configured — wire one up in production)`); }
  return { message: 'If that email is registered, a reset link is on its way.' }; });
route('POST', '/api/auth/reset', ({ body }) => { const pw = String(body.password || ''); if (pw.length < 8) throw bad('Password must be at least 8 characters.'); const r = db.prepare('SELECT * FROM password_resets WHERE token_hash=?').get(hash(String(body.token || '')));
  if (!r || r.expires_at < Date.now()) throw new HttpErr(400, 'This reset link has expired.'); tx(() => { db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(pw), r.user_id); db.prepare('DELETE FROM password_resets WHERE user_id=?').run(r.user_id); db.prepare('DELETE FROM sessions WHERE user_id=?').run(r.user_id); }); return { message: 'Password updated. Please sign in.' }; });

/* account */
route('PATCH', '/api/account', ({ body, user }) => { need(user); const name = clean(body.name, 80), phone = clean(body.phone, 20); if (name.length < 2) throw bad('Please enter your name.'); if (phone && !isPhone(phone)) throw bad('Please enter a valid phone number.'); db.prepare('UPDATE users SET name=?, phone=? WHERE id=?').run(name, phone || null, user.id); return { ok: true }; });
route('GET', '/api/account/addresses', ({ user }) => ({ addresses: db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,id').all(need(user).id) }));
function addrBody(b) { const v = validateContact({ ...b, email: 'x@x.co', full_name: b.full_name, address: b.line1 }); return { label: clean(b.label, 30), full_name: v.full_name, phone: v.phone, line1: v.address, city: v.city, postal_code: v.postal_code, is_default: b.is_default ? 1 : 0 }; }
function setDefault(uid, id) { db.prepare('UPDATE addresses SET is_default=CASE WHEN id=? THEN 1 ELSE 0 END WHERE user_id=?').run(id, uid); }
route('POST', '/api/account/addresses', ({ body, user }) => { need(user); const a = addrBody(body); const id = db.prepare('INSERT INTO addresses(user_id,label,full_name,phone,line1,city,postal_code) VALUES(?,?,?,?,?,?,?)').run(user.id, a.label, a.full_name, a.phone, a.line1, a.city, a.postal_code).lastInsertRowid;
  if (a.is_default || !db.prepare('SELECT 1 FROM addresses WHERE user_id=? AND is_default=1').get(user.id)) setDefault(user.id, id); return { status: 201, id: +id }; });
route('PATCH', '/api/account/addresses/:id', ({ params, body, user }) => { need(user); if (!db.prepare('SELECT 1 FROM addresses WHERE id=? AND user_id=?').get(+params.id, user.id)) throw new HttpErr(404, 'Address not found.'); const a = addrBody(body);
  db.prepare('UPDATE addresses SET label=?,full_name=?,phone=?,line1=?,city=?,postal_code=? WHERE id=? AND user_id=?').run(a.label, a.full_name, a.phone, a.line1, a.city, a.postal_code, +params.id, user.id); if (a.is_default) setDefault(user.id, +params.id); return { ok: true }; });
route('DELETE', '/api/account/addresses/:id', ({ params, user }) => { need(user); db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(+params.id, user.id); return { ok: true }; });
route('GET', '/api/account/orders', ({ user }) => ({ orders: db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(need(user).id).map((o) => orderOut(o)) }));

/* wishlist */
const wl = (uid) => db.prepare('SELECT id FROM wishlists WHERE user_id=?').get(uid) || { id: db.prepare('INSERT INTO wishlists(user_id) VALUES(?)').run(uid).lastInsertRowid };
route('GET', '/api/wishlist', ({ user }) => { const w = wl(need(user).id); return { products: db.prepare(`${PSQL} JOIN wishlist_items wi ON wi.product_id=p.id WHERE wi.wishlist_id=? AND p.status='active' ORDER BY wi.added_at DESC`).all(w.id).map((r) => ser(r)) }; });
route('POST', '/api/wishlist', ({ body, user }) => { const w = wl(need(user).id); const ids = (Array.isArray(body.productIds) ? body.productIds : [body.productId]).map(Number).filter(Number.isInteger).slice(0, 100);
  for (const id of ids) if (db.prepare('SELECT 1 FROM products WHERE id=?').get(id)) db.prepare('INSERT OR IGNORE INTO wishlist_items(wishlist_id,product_id) VALUES(?,?)').run(w.id, id); return { status: 201, ok: true }; });
route('DELETE', '/api/wishlist/:productId', ({ params, user }) => { const w = wl(need(user).id); db.prepare('DELETE FROM wishlist_items WHERE wishlist_id=? AND product_id=?').run(w.id, +params.productId); return { ok: true }; });

/* admin */
route('GET', '/api/admin/stats', ({ user }) => { needAdmin(user); const g = (s) => db.prepare(s).get().n; return { revenue: money(g("SELECT COALESCE(SUM(total_cents),0) n FROM orders WHERE status!='cancelled'")), orders: g('SELECT COUNT(*) n FROM orders'), customers: g("SELECT COUNT(*) n FROM users WHERE role='customer'"), products: g("SELECT COUNT(*) n FROM products WHERE status='active'"), low_stock: g("SELECT COUNT(*) n FROM products WHERE status='active' AND stock<=low_stock_threshold"), pending_reviews: g("SELECT COUNT(*) n FROM reviews WHERE status='pending'"), subscribers: g('SELECT COUNT(*) n FROM subscribers') }; });
route('GET', '/api/admin/products', ({ user, url }) => { needAdmin(user); url.searchParams.set('limit', url.searchParams.get('limit') || '24'); return listProducts(url.searchParams, { admin: true }); });
function productBody(b, partial) {
  const o = {}, set = (k, v) => { o[k] = v; };
  if (!partial || 'name' in b) { const n = clean(b.name, 120); if (n.length < 2) throw bad('Name is required.'); set('name', n); }
  if ('price' in b) { const p = Math.round(+b.price * 100); if (!(p >= 0) || p > 1e7) throw bad('Invalid price.'); set('price_cents', p); } else if (!partial) throw bad('Price is required.');
  if ('compare_at' in b) set('compare_at_cents', b.compare_at ? Math.round(+b.compare_at * 100) : null);
  if ('stock' in b) { const s = +b.stock; if (!Number.isInteger(s) || s < 0) throw bad('Invalid stock.'); set('stock', s); }
  if ('low_stock_threshold' in b) { const s = +b.low_stock_threshold; if (!Number.isInteger(s) || s < 0) throw bad('Invalid threshold.'); set('low_stock_threshold', s); }
  for (const k of ['description', 'short_description', 'how_to_use']) if (k in b) set(k, clean(b[k], 2000));
  if ('size' in b) set('size', clean(b.size, 30));
  for (const k of ['skin_types', 'concerns']) if (k in b) set(k, (Array.isArray(b[k]) ? b[k] : String(b[k]).split(',')).map((x) => clean(x, 30).toLowerCase()).filter(Boolean).join(','));
  if ('ritual_step' in b) { if (b.ritual_step && !['cleanse', 'treat', 'hydrate', 'protect'].includes(b.ritual_step)) throw bad('Invalid ritual step.'); set('ritual_step', b.ritual_step || null); }
  if ('category_id' in b) { if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(+b.category_id)) throw bad('Invalid category.'); set('category_id', +b.category_id); } else if (!partial) throw bad('Category is required.');
  if ('collection_id' in b) set('collection_id', b.collection_id ? +b.collection_id : null);
  for (const k of ['is_featured', 'is_new', 'is_bestseller']) if (k in b) set(k, b[k] ? 1 : 0);
  if ('status' in b) { if (!['active', 'archived'].includes(b.status)) throw bad('Invalid status.'); set('status', b.status); }
  return o;
}
const upSlug = (name) => { let s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product', b = s, i = 2; while (db.prepare('SELECT 1 FROM products WHERE slug=?').get(s)) s = `${b}-${i++}`; return s; };
function saveImage(b, pid, alt) { if (!b.image_data) return; const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.image_data); if (!m) throw bad('Image must be PNG, JPEG or WebP.'); const buf = Buffer.from(m[2], 'base64'); if (buf.length > 4e6) throw bad('Image must be under 4MB.');
  const f = `${crypto.randomBytes(8).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`; fs.mkdirSync(path.join(PUB, 'uploads'), { recursive: true }); fs.writeFileSync(path.join(PUB, 'uploads', f), buf);
  db.prepare('INSERT INTO product_images(product_id,url,thumb_url,alt,kind,sort) VALUES(?,?,?,?,?,?)').run(pid, '/uploads/' + f, '/uploads/' + f, alt, 'main', (db.prepare('SELECT COALESCE(MAX(sort),-1)+1 n FROM product_images WHERE product_id=?').get(pid).n)); }
route('POST', '/api/products', ({ body, user }) => { needAdmin(user); const o = productBody(body, false); const id = tx(() => { const r = db.prepare('INSERT INTO products(name,slug,price_cents,category_id) VALUES(?,?,?,?)').run(o.name, upSlug(o.name), o.price_cents, o.category_id); const pid = +r.lastInsertRowid;
  const rest = Object.entries(o).filter(([k]) => !['name', 'price_cents', 'category_id'].includes(k)); if (rest.length) db.prepare(`UPDATE products SET ${rest.map(([k]) => k + '=?').join(',')} WHERE id=?`).run(...rest.map(([, v]) => v), pid); saveImage(body, pid, o.name); return pid; }); return { status: 201, product: ser(getProduct(String(id)), true) }; });
route('PATCH', '/api/products/:id', ({ params, body, user }) => { needAdmin(user); const p = getProduct(params.id); if (!p) throw new HttpErr(404, 'Product not found.'); const o = productBody(body, true);
  tx(() => { const e = Object.entries(o); if (e.length) db.prepare(`UPDATE products SET ${e.map(([k]) => k + '=?').join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...e.map(([, v]) => v), p.id); saveImage(body, p.id, o.name || p.name); }); return { product: ser(getProduct(String(p.id)), true) }; });
route('DELETE', '/api/products/:id', ({ params, user }) => { needAdmin(user); const p = getProduct(params.id); if (!p) throw new HttpErr(404, 'Product not found.'); db.prepare("UPDATE products SET status='archived', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(p.id); return { ok: true, archived: true }; });
route('GET', '/api/admin/orders', ({ user }) => { needAdmin(user); return { orders: db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all().map((o) => orderOut(o)) }; });
route('PATCH', '/api/admin/orders/:num', ({ params, body, user }) => { needAdmin(user); if (!['confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'].includes(body.status)) throw bad('Invalid status.'); const o = db.prepare('SELECT * FROM orders WHERE order_number=?').get(params.num); if (!o) throw new HttpErr(404, 'Order not found.');
  tx(() => { if (body.status === 'cancelled' && o.status !== 'cancelled') for (const i of db.prepare('SELECT product_id,qty FROM order_items WHERE order_id=?').all(o.id)) db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(i.qty, i.product_id);
    if (o.status === 'cancelled' && body.status !== 'cancelled') throw new HttpErr(409, 'A cancelled order cannot be reopened.'); db.prepare('UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(body.status, o.id); }); return { ok: true }; });
route('GET', '/api/admin/reviews', ({ user }) => { needAdmin(user); return { reviews: db.prepare('SELECT r.id,r.author,r.rating,r.title,r.body,r.verified,r.status,r.created_at,p.name product FROM reviews r JOIN products p ON p.id=r.product_id ORDER BY (r.status=\'pending\') DESC, r.id DESC LIMIT 100').all() }; });
route('PATCH', '/api/admin/reviews/:id', ({ params, body, user }) => { needAdmin(user); if (!['approved', 'rejected', 'pending'].includes(body.status)) throw bad('Invalid status.'); const r = db.prepare('SELECT product_id FROM reviews WHERE id=?').get(+params.id); if (!r) throw new HttpErr(404, 'Review not found.'); db.prepare('UPDATE reviews SET status=? WHERE id=?').run(body.status, +params.id); recalcRating(r.product_id); return { ok: true }; });
route('GET', '/api/admin/customers', ({ user }) => { needAdmin(user); return { customers: db.prepare("SELECT u.id,u.name,u.email,u.created_at,(SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) orders FROM users u WHERE role='customer' ORDER BY u.id DESC LIMIT 200").all() }; });
route('GET', '/api/admin/subscribers', ({ user }) => { needAdmin(user); return { subscribers: db.prepare('SELECT email,created_at FROM subscribers ORDER BY id DESC LIMIT 500').all() }; });

/* ---------- http plumbing ---------- */
function readBody(req) { return new Promise((ok, no) => { let n = 0; const c = []; req.on('data', (d) => { n += d.length; if (n > 6e6) { no(new HttpErr(413, 'Request too large.')); req.destroy(); } else c.push(d); }); req.on('end', () => { if (!c.length) return ok({}); try { ok(JSON.parse(Buffer.concat(c))); } catch { no(new HttpErr(400, 'Invalid JSON.')); } }); }); }
const SEC = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'" };
const json = (res, s, o) => { res.writeHead(s, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...SEC }); res.end(JSON.stringify(o)); };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function page(req, res, url) { // SPA shell with per-page SEO metadata
  let t = 'NÉVORA — Beauty as Ritual', d = 'Premium skincare, haircare and body care designed to turn everyday moments into ritual.', img = '/img/hero-campaign.webp', ld = '';
  const m = url.pathname.match(/^\/(products|journal)\/([\w-]+)$/);
  if (m?.[1] === 'products') { const p = getProduct(m[2]); if (p) { t = `${p.name} — NÉVORA`; d = `${p.short_description}. ${p.description}`.slice(0, 200); img = db.prepare('SELECT url FROM product_images WHERE product_id=? ORDER BY sort LIMIT 1').get(p.id)?.url || img;
    ld = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.name, image: img, description: p.description, brand: { '@type': 'Brand', name: 'NÉVORA' }, offers: { '@type': 'Offer', priceCurrency: 'USD', price: money(p.price_cents), availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } }).replace(/</g, '\\u003c')}</script>`; } }
  else if (m) { const j = db.prepare('SELECT * FROM journal_posts WHERE slug=?').get(m[2]); if (j) { t = `${j.title} — NÉVORA Journal`; d = j.excerpt; img = j.cover; } }
  else { const s = { '/shop': 'Shop', '/skin-quiz': 'Skin Quiz', '/ritual': 'Ritual Builder', '/journal': 'Journal', '/track-order': 'Track Order', '/our-ritual': 'Our Ritual', '/collections': 'Collections' }[url.pathname]; if (s) t = `${s} — NÉVORA`; }
  const host = `http://${req.headers.host}`;
  let html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8').replace('<!--SEO-->', `<title>${esc(t)}</title><meta name="description" content="${esc(d)}"><link rel="canonical" href="${esc(host + url.pathname)}"><meta property="og:title" content="${esc(t)}"><meta property="og:description" content="${esc(d)}"><meta property="og:image" content="${esc(host + img)}"><meta property="og:type" content="website">${ld}`);
  res.writeHead(200, { 'Content-Type': MIME['.html'], ...SEC }); res.end(html);
}
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), ip = req.socket.remoteAddress;
  try {
    if (url.pathname.startsWith('/api/')) {
      const user = currentUser(req); let body = {};
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) { if (req.method !== 'DELETE' && !/json/.test(req.headers['content-type'] || '') && req.headers['content-length'] !== '0') throw new HttpErr(415, 'JSON required.'); const o = req.headers.origin; if (o && new URL(o).host !== req.headers.host) throw new HttpErr(403, 'Cross-origin request blocked.'); body = await readBody(req); }
      for (const r of routes) { if (r.m !== req.method) continue; const m = r.re.exec(url.pathname); if (!m) continue; const out = await r.h({ req, res, url, params: m.groups || {}, body, user, ip }); const s = typeof out?.status === 'number' ? out.status : 200; if (typeof out?.status === 'number') delete out.status; return json(res, s, out); }
      throw new HttpErr(404, 'Not found.');
    }
    const fp = path.normalize(path.join(PUB, decodeURIComponent(url.pathname)));
    if (!fp.startsWith(PUB)) throw new HttpErr(403, 'Forbidden');
    if (path.extname(fp) && fs.existsSync(fp) && fs.statSync(fp).isFile()) { res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': /\/img\/|\/uploads\//.test(fp) ? 'public, max-age=604800' : 'no-cache', 'X-Content-Type-Options': 'nosniff' }); return fs.createReadStream(fp).pipe(res); }
    if (path.extname(url.pathname)) throw new HttpErr(404, 'Not found.');
    page(req, res, url);
  } catch (e) {
    if (!(e instanceof HttpErr)) console.error(e);
    if (url.pathname.startsWith('/api/')) json(res, e.status || 500, { error: e.status ? e.message : 'Something went wrong. Please try again.', details: e.details });
    else { res.writeHead(e.status || 500, { 'Content-Type': 'text/plain' }); res.end(e.message || 'Error'); }
  }
}).listen(PORT, () => console.log(`NÉVORA running → http://localhost:${PORT}`));
