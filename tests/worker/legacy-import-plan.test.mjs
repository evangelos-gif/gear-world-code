// Import plan for the older sites (Coes -> MGW / WGW). Read-only plan; the SQL is checked on a local copy
// of the real products table layout (awin_product_id UNIQUE, search index triggers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import { classify } from '../../tools/import-rules/coes.mjs';

const HEAD = 'data_feed_id,merchant_id,merchant_name,aw_product_id,aw_deep_link,aw_image_url,aw_thumb_url,category_id,category_name,brand_id,brand_name,merchant_product_id,merchant_category,product_name,description,merchant_deep_link,merchant_image_url,search_price,stock_quantity,parent_product_id\n';
const row = (id, name, brand, cat, handle, price, qty, parent = '') =>
  `116078,30645,Coes,${id},https://www.awin1.com/pclick.php?p=${id}&a=3057233&m=30645,,,1,x,1,"${brand}",${id}0,${cat},"${name}",,https://www.coes.co.uk/products/${handle}?variant=${id}0,https://cdn.shopify.com/${id}.png,${price},${qty},${parent}\n`;

function feed() {
  const dir = mkdtempSync(join(tmpdir(), 'coes-'));
  const csv = HEAD
    + row(1, 'Barbour Beaufort Wax Jacket', 'Barbour', 'Menswear', 'beaufort-wax-jacket', 299, 1)
    + row(2, 'Barbour Beaufort Wax Jacket', 'Barbour', 'Menswear', 'beaufort-wax-jacket', 289, 2)
    + row(3, 'Barbour Beaufort Wax Jacket', 'Barbour', 'Menswear', 'beaufort-wax-jacket', 199, 0)
    + row(4, "Holland Cooper Contour Skinny Jeans", 'Holland Cooper', 'Womenswear', 'contour-skinny-jeans', 99, 4)
    + row(5, 'Brooks Canopy Jacket M', 'Brooks', 'Sports', 'canopy-jacket-m', 90, 1)
    + row(6, '1000 Mile Fusion Walk Socks in Charcoal', '1000 Mile', 'Sports', 'fusion-walk-socks-for-men-in-charcoal', 18, 1)
    + row(7, 'Adidas F50 Club FG/MG Football Boots', 'Adidas', 'Sports', 'f50-club', 80, 1)
    + row(8, 'Canterbury Professional Short Junior for Kids in White', 'Canterbury', 'Sports', 'pro-short-junior', 14.99, 1)
    + row(9, 'Elsie & Tom Scented Candle', 'Elsie & Tom', 'Gifts', 'candle', 49.5, 2)
    + row(10, 'Golding Regular Fit Chino', 'Golding', 'Menswear', 'golding-chino', 99.95, 0)
    + row(11, "Estella Bartlett Flower Bracelet", 'Estella Bartlett', 'Womenswear', 'eb-bracelet', 25, 5)
    + row(12, "O'Neill Men's Boardshorts", "O'Neill", 'Menswear', 'oneill-boardshorts', 40, 3, 'P-777')
    + row(13, "O'Neill Men's Boardshorts", "O'Neill", 'Menswear', 'oneill-boardshorts-blue', 35, 3, 'P-777');
  writeFileSync(join(dir, 'AWIN_30645_116078.csv.gz'), gzipSync(csv));
  writeFileSync(join(dir, 'AWIN_496_1.csv.gz'), gzipSync(HEAD + row(1, 'Makita Drill', 'Makita', 'Tools', 'drill', 99, 1)));
  return dir;
}

const REAL_TABLE = `CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, awin_product_id TEXT NOT NULL UNIQUE, merchant_product_id TEXT, retailer TEXT NOT NULL,
  site_category TEXT NOT NULL, subcategory TEXT, brand TEXT, product_name TEXT NOT NULL, feed_product_name TEXT, price REAL NOT NULL,
  currency TEXT DEFAULT 'GBP', stock_status TEXT, merchant_category TEXT, image_url TEXT, affiliate_url TEXT NOT NULL, ean TEXT,
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  specs_json TEXT, product_slug TEXT);
CREATE UNIQUE INDEX ux_products_refresh_stable_key ON products(retailer, merchant_product_id)
  WHERE retailer IN ('Stan Ray UK', 'Watch Enclave', 'WATCH & WATCH') AND merchant_product_id IS NOT NULL AND TRIM(merchant_product_id) <> '';
CREATE VIRTUAL TABLE products_fts USING fts5(product_name, brand, subcategory, retailer, merchant_category, content='products', content_rowid='id');
CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, product_name, brand, subcategory, retailer, merchant_category) VALUES (new.id, new.product_name, new.brand, new.subcategory, new.retailer, new.merchant_category); END;
CREATE TRIGGER products_fts_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, product_name, brand, subcategory, retailer, merchant_category) VALUES ('delete', old.id, old.product_name, old.brand, old.subcategory, old.retailer, old.merchant_category);
  INSERT INTO products_fts(rowid, product_name, brand, subcategory, retailer, merchant_category) VALUES (new.id, new.product_name, new.brand, new.subcategory, new.retailer, new.merchant_category); END;`;

test('Coes plan: joins sizes, sorts men/women, leaves out kids, gifts, unisex sport and out of stock', async () => {
  const out = mkdtempSync(join(tmpdir(), 'coes-plan-'));
  const r = await planLegacyImport({ archive: feed(), retailer: 'coes', outDir: out, now: new Date('2026-10-20T18:00:00Z') });
  assert.deepEqual(r.files, ['AWIN_30645_116078.csv.gz']);
  assert.equal(r.rows, 13);
  assert.equal(r.products, 10, 'sizes joined: 3 jacket rows are one product, the parent id joins two links');
  const mgw = r.accepted.mgw.map(p => p.product_name).sort();
  assert.deepEqual(mgw, ['1000 Mile Fusion Walk Socks in Charcoal', 'Barbour Beaufort Wax Jacket', 'Brooks Canopy Jacket', "O'Neill Men's Boardshorts"]);
  assert.deepEqual(r.accepted.wgw.map(p => p.product_name).sort(), ['Estella Bartlett Flower Bracelet', 'Holland Cooper Contour Skinny Jeans']);
  const jacket = r.accepted.mgw.find(p => p.product_name.includes('Beaufort'));
  assert.equal(jacket.price, 289, 'lowest price of a size that is in stock');
  assert.equal(jacket.site_category, 'Clothing');
  assert.equal(jacket.subcategory, 'Jackets');
  assert.equal(jacket.awin_product_id, '30645:beaufort-wax-jacket');
  assert.match(jacket.affiliate_url, /^https:\/\/www\.awin1\.com\/cread\.php\?awinmid=30645&awinaffid=3057233&ued=https%3A%2F%2Fwww\.coes\.co\.uk%2Fproducts%2Fbeaufort-wax-jacket$/);
  assert.equal(r.accepted.wgw.find(p => p.product_name.includes('Bracelet')).site_category, "Women's Jewellery");
  const reasons = Object.keys(r.rejected).join(' | ');
  assert.match(reasons, /children/);
  assert.match(reasons, /out of stock/);
  assert.match(reasons, /no men\/women/);
  assert.match(reasons, /candles/);
  const text = readFileSync(join(out, 'report.txt'), 'utf8');
  assert.match(text, /13 \(one row per size\) -> 10 products -> 6 would be imported/);
  assert.match(text, /NOT EXECUTED|nothing executed/);
  assert.doesNotMatch(text, /Makita/);
});

test('Coes plan SQL runs on a copy of the real table, twice, without duplicates', async () => {
  const out = mkdtempSync(join(tmpdir(), 'coes-sql-'));
  await planLegacyImport({ archive: feed(), retailer: 'coes', outDir: out, now: new Date('2026-10-20T18:00:00Z') });
  const db = new DatabaseSync(':memory:');
  db.exec(REAL_TABLE);
  db.exec(`INSERT INTO products (awin_product_id, retailer, site_category, product_name, price, affiliate_url) VALUES ('122444:1', 'InStock UK', 'Watches', 'Ravel Watch', 14.97, 'https://www.awin1.com/x')`);
  const dir = join(out, 'sql', 'mgw');
  const files = readdirSync(dir).filter(f => f.endsWith('.sql'));
  assert.equal(files.length, 1);
  const sql = readFileSync(join(dir, files[0]), 'utf8');
  assert.match(sql, /^-- PLAN ONLY\. NOT EXECUTED\./);
  assert.doesNotMatch(sql, /\bDELETE\b|\bDROP\b/i);
  db.exec(sql);
  db.exec(sql);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM products WHERE retailer='Coes'").get().n, 4);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM products').get().n, 5, 'other retailers untouched');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM products_fts WHERE products_fts MATCH 'beaufort'").get().n, 1, 'search index in step');
});

test('Coes rules on real names from the feed sample', () => {
  const c = (name, feedCategory, url = '') => classify({ name, feedCategory, url });
  assert.equal(c('Dalaco Rainbow Cufflinks', 'Menswear').siteCategory, "Men's Jewellery");
  assert.equal(c('Barker Javron Moccasin Leather Shoes', 'Menswear').siteCategory, 'Shoes');
  assert.equal(c('Field Wax Holdall', 'Menswear').siteCategory, 'Bags & Accessories');
  assert.equal(c('Dents Tetbury Leather Gloves', 'Menswear').subcategory, 'Gloves');
  assert.equal(c("Levi's Herringbone Boxer Brief 2 Pack", 'Menswear').subcategory, 'Underwear');
  assert.equal(c('Katie Loxton Nova Small Shoulder Bag', 'Womenswear').site, 'wgw');
  assert.equal(c('Adidas Run Essential 2 in 1 Short W', 'Sports').site, 'wgw');
  assert.equal(c('K-Swiss Tfw Receiver V Tennis Shoes M', 'Sports').site, 'mgw');
  assert.equal(c('Button-Down Collar Shirt', 'Menswear').siteCategory, 'Clothing');
  assert.equal(c('Tie Front Blouse', 'Womenswear').siteCategory, 'Clothing');
  assert.ok(c('1000 Mile Elastic laces', 'Sports').reject);
  assert.ok(c('Izipizi #D Reading Glasses', 'Gifts').reject);
  assert.ok(c('Grays Skinful Pro Gloves', 'Sports').reject);
});

test('Coes rules: mistakes found in the first real plan stay fixed', () => {
  const c = (name, feedCategory) => classify({ name, feedCategory });
  assert.equal(c('Polo Ralph Lauren Short Sleeve Sport Shirt', 'Menswear').subcategory, 'Shirts');
  assert.equal(c('Part Two Popsy Short Sleeve Blouse', 'Womenswear').subcategory, 'Tops & Blouses');
  assert.equal(c('Golding Horse Shoe Tie', 'Menswear').subcategory, 'Ties');
  assert.equal(c('Bortoni Cologne Trousers in Navy', 'Menswear').subcategory, 'Trousers');
  assert.equal(c('Barbour Heritage Eau De Parfum For Men', 'Menswear').siteCategory, 'Grooming & Fragrances');
  assert.equal(c('Katie Loxton Strawberry Bag Charm', 'Womenswear').siteCategory, 'Bags & Accessories');
  assert.equal(c("Nobody's Child Layla Midi Dress", 'Womenswear').subcategory, 'Dresses');
  assert.ok(c("Marc Darcy Edinson Check 3 Piece Children's Suit", 'Menswear').reject);
  assert.equal(c('GANT Relaxed Pull On Pants', 'Womenswear').subcategory, 'Trousers');
  assert.equal(c('Remus Uomo Classic Casual Raincoat', 'Menswear').subcategory, 'Jackets');
  assert.equal(c("Brooks Men's Ghost 18 Wide Running Shoes", 'Menswear').subcategory, 'Trainers');
  assert.equal(c('Barbour Tie Neck Blouse', 'Womenswear').siteCategory, 'Clothing');
  assert.equal(c('Dalaco Tie Clip', 'Menswear').siteCategory, "Men's Jewellery");
});

test('refresh: new, updated, back, gone, and no hiding when most of the feed is missing', async () => {
  const { diff } = await import('../../tools/legacy-import-diff.mjs');
  const d = diff(['30645:a', '30645:b', '30645:c'], [
    { id: 1, awin_product_id: '30645:a', is_active: 1 }, { id: 2, awin_product_id: '30645:x', is_active: 1 }, { id: 3, awin_product_id: '30645:b', is_active: 0 }]);
  assert.deepEqual({ added: d.added, updated: d.updated, back: d.back, gone: d.gone, safe: d.safe }, { added: 1, updated: 1, back: 1, gone: [2], safe: true });
  const many = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, awin_product_id: `30645:p${i}`, is_active: 1 }));
  assert.equal(diff(['30645:p1'], many).safe, false, '199 of 200 missing: the feed is broken, nothing is hidden');
  assert.equal(diff(many.slice(0, 150).map(r => r.awin_product_id), many).safe, true, '50 of 200 sold out: normal');
});

test('the plan writes the ids each site keeps', async () => {
  const out = mkdtempSync(join(tmpdir(), 'coes-ids-'));
  await planLegacyImport({ archive: feed(), retailer: 'coes', outDir: out, now: new Date('2026-10-20T18:00:00Z') });
  const ids = readFileSync(join(out, 'sql', 'mgw', 'ids.txt'), 'utf8').trim().split('\n');
  assert.ok(ids.includes('30645:beaufort-wax-jacket'));
  assert.equal(ids.length, 4);
});
