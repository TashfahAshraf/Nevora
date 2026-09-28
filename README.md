# NÉVORA — Beauty as Ritual

Full-stack store built on your existing NÉVORA design and your 74 product photos.

## Run it
    node -v            # needs Node 22.5+ (uses built-in node:sqlite, no npm install)
    node seed.js       # creates data/nevora.db and PRINTS THE ADMIN PASSWORD ONCE
    node server.js     # http://localhost:3000

`npm run reset` wipes and re-seeds. Password-reset links are printed in the server console (no email provider is wired up).

## Layout
    server.js        API + static hosting + SEO shell (validation, sessions, pricing, orders)
    db.js            schema (PostgreSQL-portable SQL), scrypt password hashing, transactions
    seed.js          builds the catalog from data/images.json (your folders → categories)
    public/          index.html, css/style.css, js/app.js (core) pages.js (storefront) admin.js
    public/img/p/    your photos as WebP (800px + 360px thumbs)

## Things to review before going live
- Prices, sizes, stock, concerns and descriptions for the 65 products beyond your original 9 are **placeholders generated from filenames/categories**. Edit them in /admin → Products.
- The 9 original products keep their exact names, prices and ratings from nevora.html.
- Seeded reviews (3 per featured product) are demo data and are not marked verified. Delete them before launch.
- `hello@nevora.example` on the Contact page is a placeholder.
- Payment is Cash on Delivery only; the `orders.payment_method` column is where an online gateway would plug in.
