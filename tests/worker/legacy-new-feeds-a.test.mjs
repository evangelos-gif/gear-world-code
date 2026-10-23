// New Awin feeds of 23 Oct 2026, wave A: Mint Outdoor, Gardenista and Lights4fun -> GGW, tado° -> HGW,
// Opulensi -> WGW and MGW (add-only, the shop is already on both). Names are from the gw-feed-gaps report of
// 23 Oct 2026 and from the live MGW/WGW/HGW databases. Also: the plan reads the feed's in_stock column (L37).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { planLegacyImport, stockFlag, joinSameName } from '../../tools/legacy-import-plan.mjs';
import * as mint from '../../tools/import-rules/mintoutdoor.mjs';
import * as gardenista from '../../tools/import-rules/gardenista-garden.mjs';
import * as lights from '../../tools/import-rules/lights4fun-garden.mjs';
import * as tado from '../../tools/import-rules/tado.mjs';
import * as opulensi from '../../tools/import-rules/opulensi.mjs';
import * as opulensiMen from '../../tools/import-rules/opulensi-men.mjs';

const FURNITURE = 'Garden Furniture & Outdoor Living';
const LIGHTING = 'Outdoor Lighting & Garden Electrical';
const BUILDINGS = 'Garden Buildings, Fencing & Storage';

test('stockFlag reads the in_stock column of Awin feeds', () => {
  for (const v of ['1', '3', 'yes', 'Y', 'true', 'in stock', 'in_stock', 'available']) assert.equal(stockFlag(v), true, v);
  for (const v of ['0', 'no', 'N', 'false', 'out of stock', 'out_of_stock', 'sold out']) assert.equal(stockFlag(v), false, v);
  for (const v of ['', ' ', null, undefined, 'maybe']) assert.equal(stockFlag(v), null, String(v));
});

test('Mint Outdoor: every furniture set goes to GGW with a subcategory, storage boxes to buildings', () => {
  const c = name => mint.classify({ name, feedCategory: 'Sheds & Garden Furniture' });
  const yes = [
    ['Palma Grey Corner Rattan Casual Garden Dining and Lounge Set 9 Seater', FURNITURE, 'Dining sets'],
    ['Stockholm 6 Seater Grey Rattan Garden Corner Dining Set', FURNITURE, 'Dining sets'],
    ['Wren 5 Seater Aluminium Corner Sofa Set With Concrete Table', FURNITURE, 'Lounge & corner sets'],
    ['Marbella Grey 5 Seater Corner Garden Lounge Set with cushions', FURNITURE, 'Lounge & corner sets'],
    ['Round Furniture Cover 200cm', FURNITURE, 'Furniture covers'],
    ['Rattan Garden Storage Box 290L', BUILDINGS, 'Garden storage'],
    // From the first dry run (23 Oct 2026, 20:06):
    ['Marbella 5-Seater Garden Lounge Set with Ottoman Chaise | Grey Cushions', FURNITURE, 'Lounge & corner sets'],
    ['Marbella Garden Lounge Set Replacement Cushions/Covers', FURNITURE, 'Cushions & rugs'],
    ['Chesterton Waterproof Rattan Cushion Box L.113 W.76 x H.70cm', BUILDINGS, 'Garden storage'],
    ['Chesterton Grey 5 Seater Corner Rattan Garden Sofa Lounge Set and Cushion Box Bundle', FURNITURE, 'Lounge & corner sets'],
    ['Stockholm Chaise Custom-Fitted Outdoor Furniture Cover – Weather & UV Protection', FURNITURE, 'Furniture covers'],
    ['Lima 5 Seater Grey Polyrattan Garden Sofa Set Bundle with Armchair, Coffee Table & Protective Cover', FURNITURE, 'Lounge & corner sets'],
    ['Linden Custom-Fitted Furniture Cover – Tailored Protection for Sofas & Outdoor Furniture', FURNITURE, 'Furniture covers'],
    ['2KW LED Touchscreen Rotating Upright Infrared Heater UP-20 Outdoor IP65', FURNITURE, 'Fire pits & heaters'],
    ['Kiki Beige Metal Garden 2 Seater Bistro Set', FURNITURE, 'Bistro sets']
  ];
  for (const [name, cat, sub] of yes) assert.deepEqual(c(name), { site: 'ggw', siteCategory: cat, subcategory: sub }, name);
  for (const name of ['Mint Outdoor Gift Card', 'White Glove Assembly Service', 'Two-Person Delivery Charge', 'Collection Fee', 'Sonny Kids Outdoor Play Sofa']) assert.ok(c(name).reject, name);
});

test('Gardenista: outdoor cushions, pads and covers go to GGW; indoor products stay on HGW', () => {
  const c = (name, feedCategory = 'Home & Garden > Garden') => gardenista.classify({ name, feedCategory });
  const yes = [
    ['2 Seater Garden Bench Cover', 'Furniture covers'],
    ['3 - Seater Swing Seat Pad 180cm', 'Cushions & rugs'],
    ['3-Seater Outdoor Keter Eden Bench Cushions  Water Resistant Garden Storage Bench', 'Cushions & rugs'],
    ['Printed Outdoor Scatter Cushions Garden Decorative Pillow Water Resistant', 'Cushions & rugs'],
    ['Water-Resistant Decorative Scatter Cushion Covers Outdoor Printed Cushion Cover - 5pc Set Elephant', 'Cushions & rugs'],
    ['Bright Colorful Mini Outdoor Scatter Cushion Set for Garden Furniture Water-Resistant - Bright 12 Pieces Set', 'Cushions & rugs'],
    ['Tufted Printed Seat Pad | Slip Free Garden Chair Cushions | Water Resistant Garden Furniture | Dining Seat Pads with Secure Ties| Cushion', 'Cushions & rugs'],
    ['Waterproof 1-2-3 Seater Outdoor Sofa Covers With Buckle Straps Black', 'Furniture covers'],
    ['Water Resistant 3 Seater Swing Canopy Cover Outdoor Replacement Hammock Covers with Velcro', 'Furniture covers'],
    ['Heavy Duty Waterproof Rectangular Garden Table Cover with Buckle Loops', 'Furniture covers'],
    ['Water Resistant Gazebo Side Panel Plain Curtains Replacement Outdoor Pergola Privacy Panels', 'Parasols, gazebos & shade']
  ];
  for (const [name, sub] of yes) assert.deepEqual(c(name), { site: 'ggw', siteCategory: FURNITURE, subcategory: sub }, name);
  assert.deepEqual(c('Garden BBQ Cover Waterproof'), { site: 'ggw', siteCategory: 'BBQ & Outdoor Cooking', subcategory: 'BBQ accessories' });
  for (const name of ['Lantern Cushion Cover', 'Velvet Recliner Armchair for Living Room', 'Bedroom Cushion Set Grey', 'test product 3', 'Gardenista Digital Gift Card']) assert.ok(c(name, 'Furniture').reject, name);
  assert.equal(gardenista.RULES.joinSameName, true);
});

test('Lights4fun: outdoor lights to GGW lighting; seasonal decorations, indoor lights and other products out', () => {
  const c = (name, awinCategory = 'Lighting') => lights.classify({ name, feedCategory: '594', awinCategory });
  const yes = [
    ['Ultimate Connect Multi Coloured Festoon Lights Black Cable', 'String & festoon lights'],
    ['Ultimate Connect Warm White Festoon Lights White Cable', 'String & festoon lights'],
    ['80 Warm White LED Battery Operated Parasol Lights', 'String & festoon lights'],
    ['Set of 5 Festoon Poles, 2.75m', 'Lighting accessories'],
    ['Solar Fairy Lights 100 Warm White', 'Solar lights'],
    ['Outdoor Dining Lighting Bundle', 'Outdoor lights']
  ];
  for (const [name, sub] of yes) assert.deepEqual(c(name), { site: 'ggw', siteCategory: LIGHTING, subcategory: sub }, name);
  assert.deepEqual(c('Warm White Bulb String Lights', 'Garden & Leisure'), { site: 'ggw', siteCategory: LIGHTING, subcategory: 'String & festoon lights' });
  const no = ['Leyburn Dual LED Rattan Set of 4 Light Up Reindeer Family', 'Pre Lit Winter Log Cabin Wooden House Scene', '4 Mercury Glass Mini LED Pumpkin Decorations',
    '1.2m Colour Changing Swinsty Acrylic Stag Smart Light Up Reindeer', 'Autumn Winter 02 - Orange & Cinnamon Room Fragrance Spray for Wreaths & Garlands',
    'Pro Connect to Type C Converter Cable White', 'Smart Plug', 'Copper Wire Fairy Lights', '25cm Merlin Mouse LED 3D Acrylic Christmas Figure'];
  for (const name of no) assert.ok(c(name).reject, name);
});

test('tado°: thermostats, AC control, sensors and parts go to HGW Smart Home; services are left out', () => {
  const c = (name, feedCategory = '') => tado.classify({ name, feedCategory });
  const yes = [
    ['tado° | Add-on Smart Radiator Thermostat', 'smart radiator thermostat', 'Smart Thermostat'],
    ['tado° | Wired Smart Thermostat X-Wired Smart Thermostat X [UK]', 'smart thermostat', 'Smart Thermostat'],
    ['tado° | Refurbished: Wired Smart Thermostat X - Starter Kit', 'smart thermostat', 'Smart Thermostat'],
    ['tado° | Smart AC Control', 'cooling', 'Smart AC Control'],
    ['tado° | USB-C Cable for Smart Radiator Thermostat X', 'smart radiator thermostat', 'Smart Home Accessories']
  ];
  for (const [name, cat, sub] of yes) assert.deepEqual(c(name, cat), { site: 'hgw', siteCategory: 'Smart Home', subcategory: sub }, name);
  assert.deepEqual(c('tado° | Wireless Receiver X UK', 'wireless receiver'), { site: 'hgw', siteCategory: 'Smart Home', subcategory: 'Smart Thermostat' });
  assert.deepEqual(c('tado° | Extension Kit', ''), { site: 'hgw', siteCategory: 'Smart Home', subcategory: 'Smart Thermostat' });
  assert.ok(c('tado° | Auto-Assist subscription 12 months').reject);
  assert.ok(c('tado° | Wireless Smart Thermostat X (2nd gen) - Starter Kit incl. Programmer with Hot Water Control and OpenTherm-With Installation', 'combi').reject);
  assert.equal(tado.displayName('tado° | Add-on Smart Radiator Thermostat'), 'tado° Add-on Smart Radiator Thermostat');
});

test('Opulensi: women, unisex and no-gender perfumes to WGW; men and unisex to MGW; wallets and incense out', () => {
  const w = name => opulensi.classify({ name, feedCategory: 'Perfume' });
  const m = name => opulensiMen.classify({ name, feedCategory: 'Perfume' });
  const both = ['Khamrah EDP - EDP 100ml by Lattafa Unisex - 100ml', 'Penthouse Ginza Eau De Parfum 80ml Spray - Unisex - Rue Broca'];
  for (const name of both) {
    assert.deepEqual(w(name), { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Fragrance' }, name);
    assert.deepEqual(m(name), { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: 'Fragrance' }, name);
  }
  for (const name of ['Sapil Iconic 100ml Eau de Parfum for Men', 'Jazzab Silver EDP 100ml - Mens, fresh, citrus, aquatic, wood, musky', 'Sapil Rave 100ml Eau de Toilette Mens']) {
    assert.ok(w(name).reject, name);
    assert.deepEqual(m(name), { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: 'Fragrance' }, name);
  }
  for (const name of ['Yara 100ml EDP by Lattafa for Women', 'Anfar The Jewel of Night 100ml Extrait Perfume']) {
    assert.deepEqual(w(name), { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Fragrance' }, name);
    assert.ok(m(name).reject, name);
  }
  assert.deepEqual(w('Khamrah Perfume Deodorant 200ml by Lattafa Unisex'), { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Bath & body' });
  for (const name of ['Riseicon® Legacy Travel Passport Wallet Document Organiser - Luxury Leather', 'Lattafa Bakhoor Incense 40g', 'Riseicon Liberty 1 Anti-theft USB charging waterproof laptop backpack']) {
    assert.ok(w(name).reject, name);
    assert.ok(m(name).reject, name);
  }
  // From the first dry run: a perfume called "Bakhour" is a perfume, incense is not; the shop's "Gift Set" category holds perfume sets;
  // a perfume "with Deodorant" is a fragrance; men's roll-on oils and "Eau De Perfum" are fragrances.
  assert.deepEqual(w('Al Rehab Bakhour 35ml EDP Perfume Spray'), { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Fragrance' });
  assert.deepEqual(opulensi.classify({ name: 'Bint Hooran 3 Piece Gift Set by Ard Al Zaafaran', feedCategory: 'Gift Set' }), { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Gift sets' });
  assert.deepEqual(w('Shams Emarat Khususi Perfume EDP 100ml with Body Deodorant by Ard Al Zaafaran'), { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Fragrance' });
  for (const name of ['Al Rehab Clever Man 6ml Roll-On Oil', 'Rasasi Hawas Ice for Men 100ml', 'Ajmal Sacrifice For Him II Eau De Perfum 50ML - by Ajmal']) {
    assert.deepEqual(m(name), { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: 'Fragrance' }, name);
  }
  assert.deepEqual(m('Nebras Lattafa Pride 250ml perfumed deodorant By Lattafa Unisex'), { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: 'Deodorant' });
  for (const name of ['Oudh Nabeel Bakhoor (Arabian Incense) 60g by Nabeel Perfumes', 'Oud 24 Hours 300ml premium Air Freshener By Ard Al Zaafaran']) assert.ok(w(name).reject, name);
  assert.equal(opulensi.RULES.addOnly && opulensiMen.RULES.addOnly && opulensi.RULES.keepCategory && opulensiMen.RULES.keepCategory, true);
});

// A feed in the shape of the 23 Oct 2026 downloads: in_stock column, no stock_quantity, no currency.
const HEAD = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,search_price,merchant_name,merchant_id,category_name,category_id,aw_image_url,currency,store_price,delivery_cost,merchant_deep_link,language,last_updated,display_price,data_feed_id,brand_name,in_stock,large_image,ean\n';
const row = (id, name, price, inStock, cat = 'Sheds & Garden Furniture') =>
  `https://www.awin1.com/pclick.php?p=${id}&a=3057233&m=114094,"${name}",${id},${id}0,https://cdn.shopify.com/${id}.jpg,,${cat},${price},Mint Outdoor,114094,Garden,1,,,,,https://mint-outdoor.com/products/p${id}?variant=${id}0,en,,,100804,MINT,${inStock},,\n`;

const STABLE_TABLE = `CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, awin_product_id TEXT NOT NULL, merchant_product_id TEXT, retailer TEXT NOT NULL,
  site_category TEXT NOT NULL, subcategory TEXT, brand TEXT, product_name TEXT NOT NULL, feed_product_name TEXT, price REAL NOT NULL,
  currency TEXT DEFAULT 'GBP', stock_status TEXT, merchant_category TEXT, image_url TEXT, affiliate_url TEXT NOT NULL, ean TEXT,
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  specs_json TEXT, product_slug TEXT);
CREATE UNIQUE INDEX ux_products_refresh_stable_key ON products(retailer, merchant_product_id)
  WHERE merchant_product_id IS NOT NULL AND TRIM(merchant_product_id) <> '';`;

test('Mint Outdoor plan: in_stock 0 is sold out, the router id format, and the SQL runs twice on a GGW-like table without duplicates', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mint-'));
  const csv = HEAD
    + row(1, 'Palma Grey Corner Rattan Casual Garden Dining and Lounge Set 9 Seater', 699, 1)
    + row(2, 'Wren 5 Seater Aluminium Corner Sofa Set With Concrete Table', 3999, '')
    + row(3, 'Stockholm 6 Seater Black Rattan Corner Garden Dining Set', 599, 0)
    + row(4, 'Round Furniture Cover 200cm', 49.99, 'yes');
  writeFileSync(join(dir, 'AWIN_114094_100804.csv.gz'), gzipSync(csv));
  const out = mkdtempSync(join(tmpdir(), 'mint-out-'));
  const r = await planLegacyImport({ archive: dir, retailer: 'mintoutdoor', outDir: out, now: new Date('2026-10-23T20:00:00Z') });
  const names = r.accepted.ggw.map(p => p.product_name).sort();
  assert.deepEqual(names, ['Palma Grey Corner Rattan Casual Garden Dining and Lounge Set 9 Seater', 'Round Furniture Cover 200cm',
    'Wren 5 Seater Aluminium Corner Sofa Set With Concrete Table']);
  assert.match(Object.keys(r.rejected).join(' | '), /out of stock/, 'in_stock 0 with no stock_quantity is sold out');
  const set = r.accepted.ggw.find(p => p.product_name.startsWith('Palma'));
  assert.equal(set.awin_product_id, '114094:10');
  assert.equal(set.merchant_product_id, '10');
  assert.equal(set.retailer, 'Mint Outdoor');
  assert.equal(set.currency, 'GBP');
  assert.match(set.affiliate_url, /^https:\/\/www\.awin1\.com\/cread\.php\?awinmid=114094&awinaffid=3057233&ued=https%3A%2F%2Fmint-outdoor\.com%2Fproducts%2Fp1%3Fvariant%3D10$/);
  const db = new DatabaseSync(':memory:');
  db.exec(STABLE_TABLE);
  const files = readdirSync(join(out, 'sql', 'ggw')).filter(f => f.endsWith('.sql')).sort();
  for (let run = 0; run < 2; run++) for (const f of files) db.exec(readFileSync(join(out, 'sql', 'ggw', f), 'utf8'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n, 3);
  const plan = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8'));
  assert.equal(plan.addOnly, false);
  assert.equal(plan.sites.ggw.products, 3);
});

test('Opulensi plan is add-only and keeps the category of a product the router already put on MGW', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'opulensi-'));
  const r2 = (id, name) => `https://www.awin1.com/pclick.php?p=${id}&a=3057233&m=123248,"${name}",${id},${id},https://cdn.shopify.com/${id}.jpg,,Perfume,25.99,Opulensi Perfumes Lattafa Sapil Anfar,123248,Perfume,1,,GBP,,,https://www.opulensi.com/products/p${id}?variant=${id},en,,,112686,Lattafa,1,,\n`;
  writeFileSync(join(dir, 'AWIN_123248_112686.csv.gz'), gzipSync(HEAD + r2('50070995829055', 'Khamrah EDP - EDP 100ml by Lattafa Unisex - 100ml')
    + r2('45287559168319', 'Jazzab Silver EDP 100ml - Mens, fresh, citrus, aquatic, wood, musky') + r2('111', 'Yara 100ml EDP by Lattafa for Women')));
  const out = mkdtempSync(join(tmpdir(), 'opulensi-out-'));
  const r = await planLegacyImport({ archive: dir, retailer: 'opulensi-men', outDir: out, now: new Date('2026-10-23T20:00:00Z') });
  assert.deepEqual(r.accepted.mgw.map(p => p.awin_product_id).sort(), ['123248:45287559168319', '123248:50070995829055']);
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, awin_product_id TEXT NOT NULL UNIQUE, merchant_product_id TEXT, retailer TEXT NOT NULL,
    site_category TEXT NOT NULL, subcategory TEXT, brand TEXT, product_name TEXT NOT NULL, feed_product_name TEXT, price REAL NOT NULL, currency TEXT DEFAULT 'GBP',
    stock_status TEXT, merchant_category TEXT, image_url TEXT, affiliate_url TEXT NOT NULL, ean TEXT, is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, specs_json TEXT, product_slug TEXT);`);
  db.prepare('INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, subcategory, product_name, price, affiliate_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('123248:45287559168319', '45287559168319', 'Opulensi Perfumes Lattafa Sapil Anfar', 'Grooming & Fragrances', 'Beauty & Fragrances', 'Old name', 18.99, 'https://www.awin1.com/old');
  for (const f of readdirSync(join(out, 'sql', 'mgw')).filter(f => f.endsWith('.sql'))) db.exec(readFileSync(join(out, 'sql', 'mgw', f), 'utf8'));
  const rows = db.prepare('SELECT awin_product_id, subcategory, price FROM products ORDER BY awin_product_id').all();
  assert.equal(rows.length, 2, 'the product already on MGW is updated, not added twice');
  assert.equal(rows[0].subcategory, 'Beauty & Fragrances', 'keeps the category the router gave it');
  assert.equal(rows[0].price, 25.99, 'price updated from the feed');
  assert.equal(rows[1].subcategory, 'Fragrance');
  assert.equal(JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8')).addOnly, true);
});

test('joinSameName: options of one page with the same name become one card with the lowest price; other names stay', () => {
  const p = (key, page, name, prices, inStock = 1) => ({ key, page, name, prices, variants: 1, inStockVariants: inStock, unknownStock: 0, ean: '' });
  const out = joinSameName([
    p('1', 'https://gardenistauk.com/products/director', 'Replacement Director Chair Covers', [14.99]),
    p('2', 'https://gardenistauk.com/products/director', 'Replacement Director Chair Covers', [12.99]),
    p('3', 'https://gardenistauk.com/products/elephant', 'Cushion Cover - Elephant A', [7.99]),
    p('4', 'https://gardenistauk.com/products/elephant', 'Cushion Cover - 5pc Set Elephant', [29.99])
  ]);
  assert.equal(out.length, 3);
  assert.equal(out[0].key, '1');
  assert.equal(Math.min(...out[0].prices), 12.99);
  assert.equal(out[0].variants, 2);
});

test('a product whose link is on another address is left out, and the report says which address', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mint-host-'));
  const other = row(9, 'Lark Rattan Garden Chair', 499, 1).replace('https://mint-outdoor.com/products/p9?variant=90', 'https://old-shop.example/p9');
  writeFileSync(join(dir, 'AWIN_114094_100804.csv.gz'), gzipSync(HEAD + other));
  const r = await planLegacyImport({ archive: dir, retailer: 'mintoutdoor', outDir: mkdtempSync(join(tmpdir(), 'mint-host-out-')), now: new Date('2026-10-23T20:00:00Z') });
  assert.equal(r.accepted.ggw.length, 0);
  assert.deepEqual(Object.keys(r.rejected), ["link is not the shop's own page (old-shop.example)"]);
});
