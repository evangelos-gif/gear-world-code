// Joybuy UK beauty -> Women's Gear World (add-only plan for a shop that is already on the site).
// Names and feed categories are from the gw-feed-gaps report and the WGW database (21 Oct 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import { diff, hideByAwinIdSql } from '../../tools/legacy-import-diff.mjs';
import { classify } from '../../tools/import-rules/joybuy.mjs';

const PERFUME = 'Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne';
const FRAGRANCE_OILS = 'Home & Garden > Decor > Candles & Home Fragrances > Fragrance Oils';

test('Joybuy rules: women\'s and unisex beauty go to WGW Beauty & Fragrances, with a subcategory', () => {
  const c = (name, feedCategory) => classify({ name, feedCategory });
  const yes = [
    ["Paco Rabanne Olympea Absolu Women's Eau de Parfum 30ml, A Sensual Oriental Floral Fragrance", PERFUME, 'Fragrance'],
    ['TOM FORD Azure Lime Eau de Parfum 50ml - Citrus Unisex Fragrance for a Vibrant and Refreshing Scent Experience', FRAGRANCE_OILS, 'Fragrance'],
    ['Narciso Rodriguez For Her Edp Spray 30 ml', 'Health & Beauty > Personal Care > Cosmetics > Perf', 'Fragrance'],
    ['Bvlgari Female Fragrance: Rose Goldea Blossom Delight Eau de Toilette, 75ml', PERFUME, 'Fragrance'],
    ['Azzaro Wanted Girl Eau de Parfum 50ml', PERFUME, 'Fragrance'],
    ['MAC Beauty Makeup Lips Macximal Silky Matte Lipstick 3.5 g', 'Health & Beauty > Personal Care > Cosmetics > Make-Up > Lip Makeup > Lipstick', 'Make-up'],
    ['Judydoll Waterproof Long-Lasting Eyebrow Pencil 03 Gray Brown', 'Health & Beauty > Personal Care > Cosmetics > Make-Up > Eye Makeup', 'Make-up'],
    ['OLAY Regenerist Whip Light As Air Touch Active Moisturiser SPF 30 50ml', 'Health & Beauty > Personal Care > Cosmetics > Skin Care > Lotion & Moisturizer', 'Skincare'],
    ['Real Techniques Everyday Essentials Makeup Brush Set', 'Health & Beauty > Personal Care > Cosmetics > Cosmetic Tools > Makeup Tools > Makeup Brushes', 'Beauty tools'],
    ['Dyson Airwrap Multi-Styler Complete Long', 'Health & Beauty > Personal Care > Hair Care > Hair Styling Tools > Curling Irons', 'Hair tools'],
    ['Olaplex No.4 Bond Maintenance Shampoo 250ml', 'Health & Beauty > Personal Care > Hair Care > Shampoo & Conditioner', 'Hair care'],
    ['ghd Gold Professional Hair Straightener', 'Health & Beauty > Personal Care > Haircare > Hair Styling Tools > Hair Straighteners', 'Hair tools']
  ];
  for (const [name, cat, sub] of yes) {
    const r = classify({ name, feedCategory: cat });
    assert.deepEqual(r, { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub }, name);
  }
  const no = [
    ['Sure Men Anti-Perspirant Aerosol Active Dry 200ml', 'Health & Beauty > Personal Care > Deodorant & Anti-Perspirant', /men's/],
    ["Wilkinson Sword Hydro 5 Sense Energizer Men's Razor with 4 Blade Refills", 'Health & Beauty > Personal Care > Shaving & Grooming > Razors', /men's/],
    ['Dior Sauvage Eau de Toilette 100ml', PERFUME, /men's/],
    ['Jean Paul Gaultier Le Male Le Parfum EDP Spray Intense 125ml', PERFUME, /men's/],
    ['Childs Farm Baby Bubble Bath Cherry 250ml', 'Health & Beauty > Personal Care > Cosmetics > Bath & Body > Bath Additives', /children/],
    ['Yankee Candle Large Jar Vanilla Cupcake', 'Home & Garden > Decor > Candles & Home Fragrances > Candles', /not beauty/],
    ['Lavender Reed Diffuser with Eau de Parfum scent 100ml', FRAGRANCE_OILS, /home scent|not beauty/],
    ['TGI Fridays Barbecue Boneless Wings 400g', 'Food, Beverages & Tobacco > Food Items > Frozen Desserts', /not beauty/],
    ['Spider-Man 蜘蛛侠金属胸针', 'Apparel & Accessories > Shoe Accessories', /English/],
    ['Oral-B Pro 3 Electric Toothbrush', 'Health & Beauty > Personal Care > Oral Care', /not beauty/],
    ['Colgate Max White Toothpaste 75ml', 'Health & Beauty > Personal Care > Cosmetics > Skin Care', /dental/],
    ['Philips OneBlade 360 Face Shaver', 'Health & Beauty > Personal Care > Shaving & Grooming > Electric Razors', /men's|shaving/]
  ];
  for (const [name, cat, why] of no) {
    const r = c(name, cat);
    assert.ok(r.reject, `${name} must be left out`);
    assert.match(r.reject, why, name);
  }
});

const HEAD = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,merchant_name,merchant_id,brand_name,currency,merchant_deep_link,ean\n';
const row = (n, name, cat, price) =>
  `https://www.awin1.com/pclick.php?p=${n}&a=3057233&m=123932,"${name}",9${n},1055${n},https://images1.joy-sourcing.com/${n}.jpg,"${cat}",${price},Joybuy UK,123932,Brand,GBP,https://www.joybuy.co.uk/landingPage/dp/item-${n}/1055${n}?siteCode=GB&lang=en,\n`;

function joybuyFeed() {
  const dir = mkdtempSync(join(tmpdir(), 'joybuy-'));
  const csv = HEAD
    + row(1, "Paco Rabanne Olympea Absolu Women's Eau de Parfum 30ml", PERFUME, 37.7)
    + row(2, 'MAC Macximal Silky Matte Lipstick Lady Danger', 'Health & Beauty > Personal Care > Cosmetics > Make-Up > Lip Makeup > Lipstick', 20)
    + row(3, 'Dior Sauvage Eau de Toilette 100ml', PERFUME, 89)
    + row(4, 'Sony WH-1000XM5 Wireless Headphones', 'Electronics > Audio', 279)
    + row(5, 'Charlotte Tilbury Airbrush Flawless Setting Spray', 'Health & Beauty > Personal Care > Cosmetics > Make-Up', 0);
  writeFileSync(join(dir, 'AWIN_123932_114093.csv.gz'), gzipSync(csv));
  return dir;
}

const TABLE = `CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, awin_product_id TEXT NOT NULL UNIQUE, merchant_product_id TEXT, retailer TEXT NOT NULL,
  site_category TEXT NOT NULL, subcategory TEXT, brand TEXT, product_name TEXT NOT NULL, feed_product_name TEXT, price REAL NOT NULL,
  currency TEXT DEFAULT 'GBP', stock_status TEXT, merchant_category TEXT, image_url TEXT, affiliate_url TEXT NOT NULL, ean TEXT,
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  specs_json TEXT, product_slug TEXT);
CREATE VIRTUAL TABLE products_fts USING fts5(product_name, brand, subcategory, retailer, merchant_category, content='products', content_rowid='id');
CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, product_name, brand, subcategory, retailer, merchant_category) VALUES (new.id, new.product_name, new.brand, new.subcategory, new.retailer, new.merchant_category); END;
CREATE TRIGGER products_fts_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, product_name, brand, subcategory, retailer, merchant_category) VALUES ('delete', old.id, old.product_name, old.brand, old.subcategory, old.retailer, old.merchant_category);
  INSERT INTO products_fts(rowid, product_name, brand, subcategory, retailer, merchant_category) VALUES (new.id, new.product_name, new.brand, new.subcategory, new.retailer, new.merchant_category); END;`;

test('Joybuy plan: same id as the products already on WGW, link keeps the shop query, add-only', async () => {
  const out = mkdtempSync(join(tmpdir(), 'joybuy-plan-'));
  const r = await planLegacyImport({ archive: joybuyFeed(), retailer: 'joybuy', outDir: out, now: new Date('2026-10-21T20:00:00Z') });
  assert.equal(r.products, 5);
  const names = r.accepted.wgw.map(p => p.product_name).sort();
  assert.deepEqual(names, ['MAC Macximal Silky Matte Lipstick Lady Danger', "Paco Rabanne Olympea Absolu Women's Eau de Parfum 30ml"]);
  const perfume = r.accepted.wgw.find(p => p.product_name.startsWith('Paco'));
  assert.equal(perfume.awin_product_id, '123932:10551', 'the Hub router id: advertiser and merchant_product_id');
  assert.equal(perfume.merchant_product_id, '10551');
  assert.equal(perfume.retailer, 'Joybuy UK', 'the name the products already have on WGW');
  assert.equal(perfume.subcategory, 'Fragrance');
  assert.match(perfume.affiliate_url, /^https:\/\/www\.awin1\.com\/cread\.php\?awinmid=123932&awinaffid=3057233&ued=https%3A%2F%2Fwww\.joybuy\.co\.uk%2FlandingPage%2Fdp%2Fitem-1%2F10551%3FsiteCode%3DGB%26lang%3Den$/);
  const plan = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8'));
  assert.equal(plan.addOnly, true);
  assert.equal(plan.sites.wgw.products, 2);
  const reasons = Object.keys(r.rejected).join(' | ');
  assert.match(reasons, /men's/);
  assert.match(reasons, /not beauty/);
  assert.match(reasons, /no price/);
  const text = readFileSync(join(out, 'report.txt'), 'utf8');
  assert.match(text, /Add-only plan/);
  assert.doesNotMatch(text, /no currency column/);
});

test('Joybuy plan on a copy of the WGW table: updates the product already there, adds the new one, leaves the rest alone', async () => {
  const out = mkdtempSync(join(tmpdir(), 'joybuy-sql-'));
  await planLegacyImport({ archive: joybuyFeed(), retailer: 'joybuy', outDir: out, now: new Date('2026-10-21T20:00:00Z') });
  const db = new DatabaseSync(':memory:');
  db.exec(TABLE);
  const add = db.prepare('INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, subcategory, product_name, price, affiliate_url, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  add.run('123932:10551', '10551', 'Joybuy UK', 'Beauty & Fragrances', 'Beauty & Fragrances', 'Old perfume name', 40, 'https://www.awin1.com/old', 1);
  add.run('123932:99999', '99999', 'Joybuy UK', 'Clothing', 'Clothing', 'Joybuy Knit Jumper', 25, 'https://www.awin1.com/j', 1);
  add.run('30645:jacket', 'x', 'Coes', 'Clothing', 'Jackets', 'Barbour Jacket', 299, 'https://www.awin1.com/c', 1);
  const dir = join(out, 'sql', 'wgw');
  const sql = readFileSync(join(dir, readdirSync(dir).filter(f => f.endsWith('.sql'))[0]), 'utf8');
  assert.doesNotMatch(sql, /\bDELETE\b|\bDROP\b/i);
  db.exec(sql);
  db.exec(sql);
  const get = id => db.prepare('SELECT * FROM products WHERE awin_product_id = ?').get(id);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM products WHERE retailer = 'Joybuy UK'").get().n, 3, 'one new product, no duplicate of the old one');
  assert.equal(get('123932:10551').price, 37.7, 'the product already on the site is updated');
  assert.equal(get('123932:10551').subcategory, 'Fragrance');
  assert.equal(get('123932:99999').is_active, 1, 'other Joybuy products stay as they are');
  assert.equal(get('123932:99999').site_category, 'Clothing');
  assert.equal(get('30645:jacket').is_active, 1);

  // The import's comparison: the jumper is not in this beauty-only plan, the undo hides only the added lipstick.
  const ids = readFileSync(join(dir, 'ids.txt'), 'utf8').split('\n').filter(Boolean);
  const before = [{ id: 1, awin_product_id: '123932:10551', is_active: 1 }, { id: 2, awin_product_id: '123932:99999', is_active: 1 }];
  const d = diff(ids, before);
  assert.deepEqual(d.addedIds, ['123932:10552']);
  assert.equal(d.updated, 1);
  db.exec(hideByAwinIdSql(d.addedIds));
  assert.equal(get('123932:10552').is_active, 0, 'undo hides the added product');
  assert.equal(get('123932:10551').is_active, 1, 'undo does not touch the product that was there before');
  assert.equal(get('123932:99999').is_active, 1);
  assert.equal(hideByAwinIdSql([]), '');
  assert.match(hideByAwinIdSql(["123932:o'brien"]), /'123932:o''brien'/, 'quotes are escaped');
});
