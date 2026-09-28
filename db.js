// NÉVORA database layer — node:sqlite (Node 22+). Schema is plain SQL and ports 1:1 to PostgreSQL/Prisma.
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');
const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, 'data', 'nevora.db'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN('customer','admin')), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS addresses(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, label TEXT, full_name TEXT NOT NULL, phone TEXT, line1 TEXT NOT NULL, city TEXT NOT NULL, postal_code TEXT NOT NULL, is_default INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, dept TEXT NOT NULL, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS collections(id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, short_description TEXT, how_to_use TEXT,
  price_cents INTEGER NOT NULL CHECK(price_cents>=0), compare_at_cents INTEGER, size TEXT,
  category_id INTEGER NOT NULL REFERENCES categories(id), collection_id INTEGER REFERENCES collections(id),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  rating REAL DEFAULT 0, review_count INTEGER DEFAULT 0, skin_types TEXT DEFAULT '', concerns TEXT DEFAULT '', ritual_step TEXT,
  is_featured INTEGER DEFAULT 0, is_new INTEGER DEFAULT 0, is_bestseller INTEGER DEFAULT 0, status TEXT DEFAULT 'active' CHECK(status IN('active','archived')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ix_products_cat ON products(category_id); CREATE INDEX IF NOT EXISTS ix_products_status ON products(status);
CREATE TABLE IF NOT EXISTS product_images(id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, url TEXT NOT NULL, thumb_url TEXT, alt TEXT, kind TEXT DEFAULT 'main', sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS ingredients(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, description TEXT, concerns TEXT);
CREATE TABLE IF NOT EXISTS product_ingredients(product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE CASCADE, PRIMARY KEY(product_id,ingredient_id));
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id), author TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), title TEXT, body TEXT NOT NULL, verified INTEGER DEFAULT 0, status TEXT DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')), created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(product_id,user_id));
CREATE TABLE IF NOT EXISTS wishlists(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS wishlist_items(wishlist_id INTEGER REFERENCES wishlists(id) ON DELETE CASCADE, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, added_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(wishlist_id,product_id));
CREATE TABLE IF NOT EXISTS carts(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS cart_items(cart_id INTEGER REFERENCES carts(id) ON DELETE CASCADE, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, qty INTEGER NOT NULL CHECK(qty>0), PRIMARY KEY(cart_id,product_id));
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, user_id INTEGER REFERENCES users(id), email TEXT NOT NULL, full_name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL, postal_code TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL, shipping_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL, payment_method TEXT DEFAULT 'cod', status TEXT DEFAULT 'confirmed' CHECK(status IN('confirmed','processing','packed','shipped','delivered','cancelled')), created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ix_orders_user ON orders(user_id);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id INTEGER REFERENCES products(id), name TEXT NOT NULL, size TEXT, image TEXT, unit_price_cents INTEGER NOT NULL, qty INTEGER NOT NULL CHECK(qty>0));
CREATE TABLE IF NOT EXISTS quiz_questions(id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, prompt TEXT NOT NULL, multi INTEGER DEFAULT 0, options TEXT NOT NULL, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS quiz_results(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), answers TEXT NOT NULL, product_ids TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subscribers(id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS journal_posts(id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, category TEXT, excerpt TEXT, content TEXT NOT NULL, cover TEXT, published_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
function hashPassword(pw) { const salt = crypto.randomBytes(16); return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(pw, salt, 64).toString('hex'); }
function verifyPassword(pw, stored) { const [, s, h] = stored.split('$'); const d = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64); return crypto.timingSafeEqual(d, Buffer.from(h, 'hex')); }
function tx(fn) { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } }
module.exports = { db, hash, hashPassword, verifyPassword, tx };
