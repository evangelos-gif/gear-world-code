// Lessons L56: the Joybuy import of 25 Oct 2026 put about 470 products on HGW under subcategory names the site did not use
// ("Security cameras & doorbells" next to the site's "Security Camera", "Bins" next to "Bins & Bin Bags", vacuums under
// Cleaning & Laundry while the site keeps them under Home Appliances > Vacuum Cleaner). The next import moves exactly those
// products to the site's names; every other product keeps its own place. The comparison with the database counts them,
// writes their rollback and lists any subcategory of a plan that the site does not have yet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { insertSql, planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import { subcategoryCheck } from '../../tools/legacy-import-diff.mjs';
import { classify, RULES, HGW_SUBCATEGORIES } from '../../tools/import-rules/joybuy.mjs';

const STABLE_TABLE = `CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, awin_product_id TEXT NOT NULL, merchant_product_id TEXT, retailer TEXT NOT NULL,
  site_category TEXT NOT NULL, subcategory TEXT, brand TEXT, product_name TEXT NOT NULL, feed_product_name TEXT, price REAL NOT NULL,
  currency TEXT DEFAULT 'GBP', stock_status TEXT, merchant_category TEXT, image_url TEXT, affiliate_url TEXT NOT NULL, ean TEXT,
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  specs_json TEXT, product_slug TEXT);
CREATE UNIQUE INDEX ux_products_refresh_stable_key ON products(retailer, merchant_product_id)
  WHERE merchant_product_id IS NOT NULL AND TRIM(merchant_product_id) <> '';`;

const item = (mid, cat, sub, name) => ({
  awin_product_id: `123932:${mid}`, merchant_product_id: String(mid), retailer: 'Joybuy UK', site_category: cat, subcategory: sub, brand: 'B',
  product_name: name, feed_product_name: name, price: 10, currency: 'GBP', stock_status: 'in stock', merchant_category: 'x', image_url: 'https://i/x.jpg',
  affiliate_url: 'https://www.awin1.com/x', ean: null
});

test('L56: the import moves only the products with a wrong subcategory name; the others keep their place; twice is the same', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(STABLE_TABLE);
  const ins = db.prepare('INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, subcategory, product_name, price, affiliate_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  ins.run('123932:1', '1', 'Joybuy UK', 'Smart Home', 'Security cameras & doorbells', 'Tapo C560WS Outdoor Pan/Tilt Security Wi-Fi Camera', 30, 'x');
  ins.run('123932:2', '2', 'Joybuy UK', 'Cleaning & Laundry', 'Vacuum cleaners', 'Karcher WD 2 Plus Wet & Dry Vacuum', 60, 'x');
  ins.run('123932:3', '3', 'Joybuy UK', 'Smart Home', 'Wifi Camera', 'JOOAN Camera (the router put it here)', 20, 'x');
  ins.run('123932:4', '4', 'Joybuy UK', 'Home Appliances', 'Vacuum Cleaner', 'Hoover HF4 (already right)', 99, 'x');
  const plan = [
    item(1, 'Smart Home', 'Security Camera', 'Tapo C560WS Outdoor Pan/Tilt Security Wi-Fi Camera'),
    item(2, 'Home Appliances', 'Vacuum Cleaner', 'Karcher WD 2 Plus Wet & Dry Vacuum'),
    item(3, 'Smart Home', 'Security Camera', 'JOOAN Camera'),
    item(4, 'Cleaning & Laundry', 'Mop', 'Hoover HF4'),
    item(5, 'Cleaning & Laundry', 'Bins & Bin Bags', 'Simplehuman 30L Round Pedal Bin')
  ];
  const sql = insertSql(plan, '2026-10-25 10:00:00', { site: 'hgw', keepCategory: true, replace: RULES.replaceSubcategories.hgw });
  assert.doesNotMatch(sql, /site_category=excluded\.site_category,/, 'never a plain overwrite of the category');
  db.exec(sql);
  db.exec(sql);
  const rows = Object.fromEntries(db.prepare('SELECT merchant_product_id AS m, site_category AS c, subcategory AS s, price FROM products').all().map(r => [r.m, [r.c, r.s, r.price]]));
  assert.deepEqual(rows['1'], ['Smart Home', 'Security Camera', 10], 'wrong name -> the site\'s name, price updated');
  assert.deepEqual(rows['2'], ['Home Appliances', 'Vacuum Cleaner', 10], 'vacuum moves to Home Appliances like the other 156');
  assert.deepEqual(rows['3'], ['Smart Home', 'Wifi Camera', 10], 'a router name is the site\'s own: it stays');
  assert.deepEqual(rows['4'], ['Home Appliances', 'Vacuum Cleaner', 10], 'a right place is never moved');
  assert.deepEqual(rows['5'], ['Cleaning & Laundry', 'Bins & Bin Bags', 10], 'a new product gets the plan\'s place');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n, 5, 'no duplicates after two runs');
  // Without replace (other sites, other shops) the SQL is the same as before L56.
  assert.doesNotMatch(insertSql(plan, 's', { site: 'hgw', keepCategory: true }), /CASE WHEN/);
});

test('keepNames (L79): a product already on the site keeps its translated name, the feed name still follows the feed', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(STABLE_TABLE);
  const first = [item(9, 'Power Tools', 'Wall Chasers', 'VEVOR Muurfrees 4800W')];
  db.exec(insertSql(first, 's1', { site: 'hgw', keepNames: true }));
  db.exec("UPDATE products SET product_name = 'VEVOR Wall Chaser 4800W'");
  const again = [{ ...first[0], product_name: 'VEVOR Muurfrees 4800W nieuw', feed_product_name: 'VEVOR Muurfrees 4800W nieuw', price: 12 }];
  db.exec(insertSql(again, 's2', { site: 'hgw', keepNames: true }));
  const row = db.prepare('SELECT product_name, feed_product_name, price FROM products').get();
  assert.equal(row.product_name, 'VEVOR Wall Chaser 4800W', 'the English name stays');
  assert.equal(row.feed_product_name, 'VEVOR Muurfrees 4800W nieuw');
  assert.equal(row.price, 12, 'price still updates');
  assert.match(insertSql(again, 's2', { site: 'hgw' }), /product_name=excluded\.product_name/, 'without keepNames the name follows the feed');
});

test('L56: the comparison counts the moves, writes their rollback and lists subcategories the site does not have', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(STABLE_TABLE);
  const ins = db.prepare('INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, subcategory, product_name, price, affiliate_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  ins.run('123932:1', '1', 'Joybuy UK', 'Smart Home', 'Security cameras & doorbells', 'Cam', 30, 'x');
  ins.run('123932:2', '2', 'Joybuy UK', 'Cleaning & Laundry', 'Laundry & ironing', 'Samsung Washing Machine', 400, 'x');
  ins.run('123932:3', '3', 'Joybuy UK', 'Smart Home', 'Wifi Camera', 'Router cam', 20, 'x');
  ins.run('9:1', 'a', 'Other', 'Smart Home', 'Security Camera', 'Other cam', 20, 'x');
  const rows = db.prepare("SELECT id, awin_product_id, is_active, site_category, subcategory FROM products WHERE retailer = 'Joybuy UK'").all();
  const siteSubs = db.prepare('SELECT site_category, subcategory, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY site_category, subcategory').all();
  const places = [['123932:1', 'Smart Home', 'Security Camera'], ['123932:2', 'Home Appliances', 'Washing Machine'], ['123932:3', 'Smart Home', 'Security Camera'],
    ['123932:9', 'Cleaning & Laundry', 'Bins & Bin Bags']];
  const r = subcategoryCheck(places, rows, RULES.replaceSubcategories.hgw, siteSubs);
  assert.deepEqual(r.recat.map(x => [x.id, x.to[1]]), [[1, 'Security Camera'], [2, 'Washing Machine']]);
  assert.deepEqual(r.newSubs.map(x => x.place).sort(), ['Cleaning & Laundry > Bins & Bin Bags', 'Home Appliances > Washing Machine'],
    'new names are listed; "Smart Home > Wifi Camera" (kept) and "Security Camera" (the site has it) are not');
  // The rollback puts back exactly the old names.
  db.exec("UPDATE products SET site_category = 'Smart Home', subcategory = 'Security Camera' WHERE id = 1; UPDATE products SET site_category = 'Home Appliances', subcategory = 'Washing Machine' WHERE id = 2;");
  db.exec(r.rollback);
  assert.deepEqual(db.prepare('SELECT subcategory FROM products WHERE id IN (1, 2) ORDER BY id').all().map(x => x.subcategory), ['Security cameras & doorbells', 'Laundry & ironing']);
  // No site list (an older tool run): no warnings at all.
  assert.deepEqual(subcategoryCheck(places, rows, [], []).newSubs, []);
});

test('L56: every HGW place of the Joybuy rules is a subcategory the site already has (or one of the two new appliance types)', () => {
  const names = ['Tapo C560WS Outdoor Pan/Tilt Security Wi-Fi Camera', 'aosu 2K HD Doorbell with Camera Wireless, Smart Video Doorbell with Gong',
    'Philips Smart Light Bulb LED Globe Frosted Bayonet B22 Full Colour', 'WIZ Smart Plug White', 'Xiaomi Smart Home Hub 2', 'TP-Link Tapo T110 Smart Door & Window Sensor',
    'Simplehuman 30L Round Pedal Bin, Brushed Stainless Steel', 'Fairy Max Power Washing Up Liquid, Original, 660ml', 'J Cloth, 50 per Pack',
    'Minky Opti-Clean Spin Mop', 'Addis Easi-Lift 50m 4 Arm Rotary Airer', 'Minky Classic Ironing Board 110 x 35', 'Comfort Pure Fabric Conditioner 160 Washes 4800ml',
    'Persil Washing Powder Non Bio 21 Washes 1.05kg', 'Braun Texstyle 5 Steam Iron, 2600W', 'Karcher Cartridge Filter For Wd2 + Wd3 Vacuum',
    'Hoover HF2 Ultra Compact Cordless Stick Vacuum Cleaner - Pet Tool', 'Samsung Series 5 WW80FG5L32AEEU 8kg Washing Machine - White - A Rated',
    'Hoover H-Dry 300 8kg Heat Pump Tumble Dryer – White', 'Domestos Thick Bleach Toilet Cleaner, Original, 750ml', 'Flash Duster Dust Magnet Starter Kit',
    'BISSELL Revolution HydroSteam Carpet Cleaner, Carpet Stain Remover with Hydrosteam', 'JVL Three Tier Laundry Washing Clothes Drying Rack - White',
    'Addis 40L Faux Hessian Slim Laundry Hamper - Charcoal', 'Addis 40L Rectangular Laundry Basket - White'];
  // Dry run of 25 Oct 2026 10:19: a vacuum whose name starts with the model, and steel pot scourers.
  const c = n => classify({ name: n, feedCategory: 'Home & Garden > Household Appliances > Vacuums' });
  assert.equal(c('Samsung Jet 85 Pet, Max 210W Suction Power Cordless Vacuum Cleaner with Pet Tool+, Woody Green - VS20C8522TN').subcategory, 'Vacuum Cleaner');
  assert.equal(classify({ name: '6-Pack Stainless Steel Pot Scourers, 15g Each, Non-Rusting Metal Scrubber Pads (Bagged)', feedCategory: 'Home & Garden > Household Supplies > Household Cleaning Supplies' }).subcategory, 'Cloths & Sponges');
  assert.equal(classify({ name: 'GARTOL 3 Piece Tool Holder, Broom Holder Wall, Garden Tool Holder, Wall Mount for Mop', feedCategory: 'Home & Garden > Household Supplies > Household Cleaning Supplies' }).subcategory, 'Cleaning Brush');
  const allowed = new Set([...HGW_SUBCATEGORIES, 'Washing Machine', 'Tumble Dryer']);
  for (const n of names) {
    const r = classify({ name: n, feedCategory: 'Home & Garden > Household Supplies > Household Cleaning Supplies' });
    assert.equal(r.site, 'hgw', n);
    assert.ok(allowed.has(r.subcategory), `${n} -> ${r.subcategory}`);
    assert.ok(!RULES.replaceSubcategories.hgw.includes(r.subcategory), `${n} must not get an old name`);
  }
});

const HEAD = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,merchant_name,merchant_id,brand_name,currency,merchant_deep_link,ean\n';
const row = (n, name, cat, price) =>
  `https://www.awin1.com/pclick.php?p=${n}&a=3057233&m=123932,"${name.replace(/"/g, '""')}",9${n},3055${n},https://images1.joy-sourcing.com/${n}.jpg,"${cat}",${price},Joybuy UK,123932,Brand,GBP,https://www.joybuy.co.uk/landingPage/dp/item-${n}/3055${n}?siteCode=GB&lang=en,\n`;

test('L56: the plan writes places.json for the comparison, with the names to replace only for HGW', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'joybuy-l56-'));
  writeFileSync(join(dir, 'AWIN_123932_114093.csv.gz'), gzipSync(HEAD
    + row(1, 'Simplehuman 30L Round Pedal Bin, Brushed Stainless Steel', 'Home & Garden > Household Supplies > Household Cleaning Supplies', 63.99)
    + row(2, 'Vonhaus Barrel Charcoal Barbecue', 'Home & Garden > Kitchen & Dining > Kitchen Appliances', 69.99)));
  const out = mkdtempSync(join(tmpdir(), 'joybuy-l56-out-'));
  await planLegacyImport({ archive: dir, retailer: 'joybuy', outDir: out, now: new Date('2026-10-25T10:00:00Z') });
  const hgw = JSON.parse(readFileSync(join(out, 'sql', 'hgw', 'places.json'), 'utf8'));
  assert.deepEqual(hgw.places, [['123932:30551', 'Cleaning & Laundry', 'Bins & Bin Bags']]);
  assert.ok(hgw.replace.includes('Bins'));
  const ggw = JSON.parse(readFileSync(join(out, 'sql', 'ggw', 'places.json'), 'utf8'));
  assert.deepEqual(ggw.replace, [], 'GGW names are not touched');
  const hgwSql = readFileSync(join(out, 'sql', 'hgw', readdirSync(join(out, 'sql', 'hgw')).filter(f => f.endsWith('.sql'))[0]), 'utf8');
  assert.match(hgwSql, /CASE WHEN products\.subcategory IN \('Laundry & ironing'/);
});
