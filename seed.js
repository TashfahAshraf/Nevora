// Seeds the catalog from data/images.json (your product photos). Safe to re-run: only seeds an empty DB.
const { db, hashPassword, tx } = require('./db');
const images = require('./data/images.json');
const crypto = require('node:crypto');
if (db.prepare('SELECT COUNT(*) c FROM products').get().c > 0) { console.log('DB already seeded.'); process.exit(0); }

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const title = (s) => s.split('-').map((w) => ({ c: 'C', spf: 'SPF', bha: 'BHA', aha: 'AHA', pha: 'PHA' }[w] || w[0].toUpperCase() + w.slice(1))).join(' ').replace('C Eclat', 'C-Éclat');
const CATS = [ // [name, slug, dept, ritual_step]
  ['Cleansers', 'cleansers', 'skincare', 'cleanse'], ['Toners & Essences', 'toners-essences', 'skincare', 'treat'], ['Serums', 'serums', 'skincare', 'treat'],
  ['Exfoliators', 'exfoliators', 'skincare', 'treat'], ['Masks', 'masks', 'skincare', 'treat'], ['Face Oils', 'face-oils', 'skincare', 'hydrate'],
  ['Moisturizers', 'moisturizers', 'skincare', 'hydrate'], ['Eye Care', 'eye-care', 'skincare', 'hydrate'], ['Lip Care', 'lip-care', 'skincare', 'hydrate'],
  ['SPF', 'spf', 'skincare', 'protect'], ['Discovery Minis', 'discovery-minis', 'skincare', 'hydrate'],
  ['Shampoo', 'shampoo', 'haircare', null], ['Conditioner', 'conditioner', 'haircare', null], ['Hair Treatments', 'hair-treatments', 'haircare', null],
  ['Body Lotion', 'body-lotion', 'body', null], ['Body Care', 'body-care', 'body', null]];
const FOLDER = { 'Cleansers': 'cleansers', 'Toners & Essences': 'toners-essences', 'Serums': 'serums', 'Exfoliators': 'exfoliators', 'Masks': 'masks', 'oils': 'face-oils', 'Moisturizers': 'moisturizers', 'Eye Care': 'eye-care', 'Lip Balm': 'lip-care', 'sun care': 'spf', 'Discovery Mini Collection': 'discovery-minis' };
const PRICE = { cleansers: 22, 'toners-essences': 24, serums: 34, exfoliators: 28, masks: 32, 'face-oils': 36, moisturizers: 38, 'eye-care': 29, 'lip-care': 18, spf: 27, 'discovery-minis': 14, shampoo: 24, conditioner: 24, 'hair-treatments': 30, 'body-lotion': 26, 'body-care': 28 };
const SIZE = { cleansers: '150ml', 'toners-essences': '120ml', serums: '30ml', exfoliators: '100ml', masks: '50ml', 'face-oils': '30ml', moisturizers: '50ml', 'eye-care': '15ml', 'lip-care': '10ml', spf: '40ml', 'discovery-minis': '15ml', shampoo: '250ml', conditioner: '250ml', 'hair-treatments': '150ml', 'body-lotion': '200ml', 'body-care': '200ml' };
const SPEC = { // exact values from the original nevora.html
  'calm-current-serum': ['Barrier support', 34, 4.9], 'cloud-cream-moisturizer': ['Deep hydration', 38, 4.8], 'velvet-body-lotion': ['Nourishing body', 26, 4.9], 'silk-eye-cream': ['Brightening', 29, 4.7],
  'rose-veil-lip-treatment': ['Overnight repair', 18, 4.9], 'hydra-balance-shampoo': ['Scalp care', 24, 4.6], 'overnight-dew-mask': ['Hydration mask', 32, 4.8], 'daily-shield-spf-50': ['Mineral sun care', 27, 4.7], 'cloud-veil-gentle-cleanser': ['Gentle cleanse', 22, 4.8] };
const RULES = [ // keyword -> [concerns, skinTypes, ingredients]
  [/barrier|calm|comfort|silk|gentle|cloud|velvet/, ['barrier,sensitivity', 'sensitive,dry', 'Botanical Extracts']],
  [/hydra|dew|aqua|hydration|glass|mist/, ['dehydration', 'dry,normal,combination', 'Hyaluronic Acid']],
  [/bright|radiance|eclat|glow|c-|drop/, ['dullness,uneven-tone', 'normal,combination,dry', 'Niacinamide']],
  [/clear|purify|pore|bha|clay|balance|refin|gel|foam|light/, ['breakouts', 'oily,combination', 'Niacinamide']],
  [/peptide|renewal|overnight|recovery|rich|aha|repair/, ['fine-lines,barrier', 'dry,normal', 'Peptides']],
  [/niacinamide/, ['uneven-tone,breakouts', 'oily,combination,normal', 'Niacinamide']]];
const ING = { 'Niacinamide': ['Refines the look of pores and evens the appearance of tone.', 'breakouts,uneven-tone'], 'Hyaluronic Acid': ['Draws water to the surface for plump, dewy-looking skin.', 'dehydration'], 'Peptides': ['Amino-acid chains that help skin look firmer and smoother over time.', 'fine-lines'], 'Botanical Extracts': ['Chamomile, aloe and rose to soften and comfort stressed-looking skin.', 'sensitivity,barrier'] };
const NEW = ['barrier-silk-mini', 'cloud-cream-mini', 'hydra-veil-mini', 'midnight-bloom-face-oil', 'overnight-renewal-serum'];
const LOW = ['rose-veil-lip-treatment', 'melt-away-cleansing-balm'];

tx(() => {
  const cat = {}; CATS.forEach((c, i) => { cat[c[1]] = { id: db.prepare('INSERT INTO categories(name,slug,dept,sort) VALUES(?,?,?,?)').run(c[0], c[1], c[2], i).lastInsertRowid, step: c[3] }; });
  const col = {}; [['The NÉVORA Edit', 'the-nevora-edit', 'Our most-loved rituals.'], ['Night Ritual', 'night-ritual', 'Slow, restorative evening care.'], ['Discovery Minis', 'discovery-minis', 'Travel-size ways to begin.'], ['Barrier Ritual', 'barrier-ritual', 'Comfort for sensitive-looking skin.']].forEach((c) => { col[c[1]] = db.prepare('INSERT INTO collections(name,slug,description) VALUES(?,?,?)').run(...c).lastInsertRowid; });
  const ing = {}; for (const [n, [d, c]] of Object.entries(ING)) ing[n] = db.prepare('INSERT INTO ingredients(name,slug,description,concerns) VALUES(?,?,?,?)').run(n, slug(n), d, c).lastInsertRowid;
  const insP = db.prepare(`INSERT INTO products(name,slug,description,short_description,how_to_use,price_cents,size,category_id,collection_id,stock,low_stock_threshold,rating,review_count,skin_types,concerns,ritual_step,is_featured,is_new,is_bestseller) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insI = db.prepare('INSERT INTO product_images(product_id,url,thumb_url,alt,kind,sort) VALUES(?,?,?,?,?,?)');
  let n = 0;
  for (const im of images) {
    let cs = FOLDER[im.folder];
    if (im.folder === 'Hair care') cs = /shampoo/.test(im.file) ? 'shampoo' : /conditioner/.test(im.file) ? 'conditioner' : 'hair-treatments';
    if (im.folder === 'body care') cs = /lotion|cream/.test(im.file) ? 'body-lotion' : 'body-care';
    const c = cat[cs], name = title(im.file), sp = SPEC[im.file];
    let concerns = '', skin = 'normal,combination', ings = new Set();
    for (const [re, [cn, st, ig]] of RULES) if (re.test(im.file)) { concerns += (concerns ? ',' : '') + cn; skin = st; ings.add(ig); }
    if (!ings.size) ings.add('Botanical Extracts');
    concerns = [...new Set(concerns.split(',').filter(Boolean))].join(',') || 'dehydration';
    const size = /mini/.test(im.file) ? '15ml' : SIZE[cs], h = crypto.createHash('md5').update(im.file).digest()[0];
    const price = sp ? sp[1] : PRICE[cs] + (h % 4) * 2 - (/mini/.test(im.file) ? 0 : 0);
    const rating = sp ? sp[2] : +(4.5 + (h % 5) / 10).toFixed(1);
    const desc = sp ? sp[0] : CATS.find((x) => x[1] === cs)[0];
    const stock = LOW.includes(im.file) ? 3 : im.file === 'daily-reset-micellar-water' ? 0 : 25 + (h % 30);
    const ingList = [...ings].join(', ');
    const id = insP.run(name, im.file, `${name} is part of the NÉVORA ritual — a considered formula for ${concerns.replace(/,/g, ' and ').replace(/-/g, ' ')}, made to feel as good as it looks. Contains ${ingList.toLowerCase()}. Cosmetic use only.`, desc + ' · ' + size,
      /spf/.test(cs) ? 'Apply generously as the final step of your morning ritual; reapply every two hours in direct sun.' : 'Use as part of your ' + (c.step || 'daily') + ' step. Apply a small amount to clean skin and massage gently until absorbed.',
      price * 100, size, c.id, /night|overnight|midnight|renewal|recovery/.test(im.file) ? col['night-ritual'] : /mini/.test(im.file) ? col['discovery-minis'] : /barrier|calm/.test(im.file) ? col['barrier-ritual'] : col['the-nevora-edit'],
      stock, 5, rating, sp ? 40 + h % 80 : 0, skin, concerns, c.step, sp || h % 6 === 0 ? 1 : 0, NEW.includes(im.file) ? 1 : 0, h % 7 === 0 || rating >= 4.9 ? 1 : 0).lastInsertRowid;
    insI.run(id, `/img/p/${im.file}.webp`, `/img/p/${im.file}-sm.webp`, `${name} — NÉVORA ${desc.toLowerCase()}`, 'main', 0);
    for (const g of ings) db.prepare('INSERT INTO product_ingredients VALUES(?,?)').run(id, ing[g]);
    n++;
  }
  console.log('Seeded', n, 'products');
  // Quiz
  const Q = [['skin_type', 'How would you describe your skin?', 0, [['dry', 'Dry'], ['oily', 'Oily'], ['combination', 'Combination'], ['normal', 'Normal'], ['sensitive', 'Sensitive']]],
    ['concern', 'What’s your main concern?', 0, [['dehydration', 'Dehydration'], ['dullness', 'Dullness'], ['breakouts', 'Breakouts'], ['sensitivity', 'Sensitivity'], ['uneven-tone', 'Uneven tone'], ['fine-lines', 'Fine lines'], ['barrier', 'Barrier support']]],
    ['after_cleansing', 'After cleansing, my skin feels…', 0, [['tight', 'Tight'], ['comfortable', 'Comfortable'], ['oily', 'Slick or shiny'], ['irritated', 'Sensitised']]],
    ['routine', 'What kind of routine do you prefer?', 0, [['minimal', 'Minimal — 2 steps'], ['balanced', 'Balanced — 3 steps'], ['complete', 'Complete ritual — 4 steps']]]];
  Q.forEach((q, i) => db.prepare('INSERT INTO quiz_questions(key,prompt,multi,options,sort) VALUES(?,?,?,?,?)').run(q[0], q[1], q[2], JSON.stringify(q[3].map(([v, l]) => ({ value: v, label: l }))), i));
  // Journal
  const J = [['understanding-your-skin-barrier', 'Understanding Your Skin Barrier', 'Skin Science', 'What the barrier is, why it matters, and how to care for it gently.', '/img/journal-1.webp', "Your skin barrier is the outermost layer of the skin — a quiet, hardworking shield that helps keep moisture in and everyday irritants out.\n\nWhen it feels balanced, skin looks smooth and comfortable. When it's stressed, you may notice tightness, dullness or sensitivity.\n\nThe most useful thing you can do is simplify: cleanse gently, add hydration, and protect with SPF each morning. Ingredients such as niacinamide and ceramide-friendly moisturisers support the look of a healthy barrier.\n\nGive any new step a few weeks before judging it, and introduce one product at a time."],
    ['the-art-of-the-evening-ritual', 'The Art of the Evening Ritual', 'Ritual', 'Why the last ten minutes of your day deserve to be slow.', '/img/journal-2.webp', "Evening is when skincare stops being a task and becomes a pause.\n\nDim the lights. Warm cleanser between your palms. Press a serum in rather than rubbing. Finish with cream, and stay with the sensation for a breath longer than feels necessary.\n\nThe products matter, but the slowing down matters more."],
    ['how-to-build-a-simple-routine', 'How to Build a Simple Routine', 'Guides', 'Four steps, in order: cleanse, treat, hydrate, protect.', '/img/journal-3.webp', "A routine doesn't need to be long to be effective.\n\n1. Cleanse — remove the day.\n2. Treat — a serum for your main concern.\n3. Hydrate — a moisturiser suited to your skin type.\n4. Protect — SPF every morning.\n\nNot sure where to begin? Take our skin quiz or use the Ritual Builder."],
    ['ingredient-stories', 'Ingredient Stories', 'Ingredients', 'Niacinamide, hyaluronic acid, peptides and botanicals — what each one does.', '/img/formula.webp', "Niacinamide helps refine the look of pores and even tone. Hyaluronic acid attracts water for a plump, dewy finish. Peptides help skin look smoother and firmer with consistent use. Botanical extracts like chamomile and aloe soften and comfort.\n\nClaims here are cosmetic; skin varies from person to person."]];
  J.forEach((j) => db.prepare('INSERT INTO journal_posts(slug,title,category,excerpt,cover,content) VALUES(?,?,?,?,?,?)').run(...j));
  // Demo reviews (marked unverified, clearly demo data)
  const rv = [['Amira K.', 5, 'Beautiful texture', 'Absorbs quickly and my skin looks calmer within a week.'], ['Sara M.', 5, 'A real ritual', 'The packaging and the feel make my evenings something to look forward to.'], ['Hina R.', 4, 'Lovely', 'Gentle and effective. I would love a larger size.']];
  for (const p of db.prepare('SELECT id FROM products WHERE is_featured=1 LIMIT 12').all()) for (const r of rv) db.prepare("INSERT INTO reviews(product_id,author,rating,title,body,status) VALUES(?,?,?,?,?, 'approved')").run(p.id, ...r);
  // Admin
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES('NÉVORA Admin',?,?, 'admin')").run(process.env.ADMIN_EMAIL || 'admin@nevora.test', hashPassword(pw));
  console.log(`\nAdmin login → ${process.env.ADMIN_EMAIL || 'admin@nevora.test'} / ${pw}\n(save this now — it is only shown once)`);
});
