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
    ['ghd Gold Professional Hair Straightener', 'Health & Beauty > Personal Care > Haircare > Hair Styling Tools > Hair Straighteners', 'Hair tools'],
    // Mistakes in the first real plan (21 Oct 2026, 20:31) that stay fixed:
    ["L'Oréal Paris Laser Renew Triple Action Night Cream 50ml", 'Health & Beauty > Personal Care > Cosmetics > Make-Up', 'Skincare'],
    ['Nuxe Huile Prodigieuse Multi-Purpose Dry Oil 50ml', 'Health & Beauty > Personal Care > Cosmetics > Make-Up', 'Skincare'],
    ["L'Oréal Paris Elvive Hydra Hyaluronic Hair Mask with Hyaluronic Acid for Dry Hair 300ml", 'Health & Beauty > Personal Care > Cosmetics > Skin Care', 'Hair care'],
    ['Gillette Venus Deluxe Smooth Swirl Razor - 1 Blade', 'Health & Beauty > Personal Care > Shaving & Grooming > Razors & Razor Blades', 'Hair removal'],
    ['BRAUN Silk-épil 9 Hair Removal Device, Easy Hair Removal, Long-Lasting Smooth Skin', 'Health & Beauty > Personal Care > Shaving & Grooming > Hair Removal > Laser & IPL Hair Removal Devices', 'Hair removal'],
    ['PHILIPS Series 8000 Wet & Dry Cordless Epilator, Rechargeable', 'Health & Beauty > Personal Care > Shaving & Grooming > Hair Removal', 'Hair removal'],
    ['Dove Anti-Perspirant Deodorant Spray Classic 200ml', 'Health & Beauty > Personal Care > Deodorant & Anti-Perspirant > Deodorant', 'Bath & body'],
    ['Moschino Toy 2 Eau de Parfum Spray 100ml', PERFUME, 'Fragrance'],
    ['Sabrina Carpenter Cherry Baby Eau de Parfum 30ml', PERFUME, 'Fragrance'],
    ['Dreame Glory Combo High Speed Hair Dryer, Includes Nozzle and Diffuser', 'Health & Beauty > Personal Care > Hair Care > Hair Styling Tools > Hair Dryers', 'Hair tools'],
    // From the second real plan (20:48):
    ["L'Oréal Excellence Créme 6 Natural Light Brown: 100% Grey Coverage, Hyaluronic Acid for 10x Nourished Hair", 'Health & Beauty > Personal Care > Hair Care > Hair Color', 'Hair care'],
    ['Medicube One Day Exosome Shot Pore Ampoule 2000 30ml', 'Health & Beauty > Personal Care > Cosmetics > Makeup > Eye Makeup > Eye Shadow', 'Skincare'],
    ['Molton Brown Delicious Rhubarb & Rose Hand Lotion 300ml', 'Health & Beauty > Personal Care > Cosmetics > Nail Care', 'Bath & body'],
    ['VO5 Gum Texturising 75ml', 'Health & Beauty > Personal Care > Hair Care > Hair Styling Tools > Hair Curlers', 'Hair care'],
    ['QUIYUM Green Tea Skincare Set (11pcs): Includes Cleanser 80g, Toner 100ml, with Nail Stickers', 'Health & Beauty > Personal Care > Cosmetics > Nail Care', 'Gift sets']
  ];
  for (const [name, cat, sub] of yes) {
    const r = classify({ name, feedCategory: cat });
    assert.deepEqual(r, { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub }, name);
  }
  // Men's products go to Men's Gear World "Grooming & Fragrances".
  const mgw = [
    ['Sure Men Anti-Perspirant Aerosol Active Dry 200ml', 'Health & Beauty > Personal Care > Deodorant & Anti-Perspirant', 'Deodorant'],
    ["Wilkinson Sword Hydro 5 Sense Energizer Men's Razor with 4 Blade Refills", 'Health & Beauty > Personal Care > Shaving & Grooming > Razors', 'Shaving'],
    ['Dior Sauvage Eau de Toilette 100ml', PERFUME, 'Fragrance'],
    ['Jean Paul Gaultier Le Male Le Parfum EDP Spray Intense 125ml', PERFUME, 'Fragrance'],
    ['Philips OneBlade 360 Face Shaver', 'Health & Beauty > Personal Care > Shaving & Grooming > Electric Razors', 'Shaving'],
    ['Moschino Toy Boy Eau de Parfum 50ml', PERFUME, 'Fragrance'],
    ['Montblanc Legend Red Eau de Parfum 50ml', PERFUME, 'Fragrance'],
    ['lattafa Asad EDP Spray 100ml', PERFUME, 'Fragrance'],
    ['Philips 11-in-1 Trimmer 5000, 13 Length Settings, Wet & Dry, Self-Sharpening Metal Blades, Intimate Comb, MG5941/15', 'Health & Beauty > Personal Care > Cosmetics > Cosmetic Tools', 'Trimmers & clippers'],
    ['Lynx Aerosol Body Spray Sunset Fresh XXL 250ml', 'Health & Beauty > Personal Care > Deodorant & Anti-Perspirant > Deodorant', 'Deodorant'],
    ['Gillette Labs With Exfoliating Bar Razor, 1 Handle - 7 Blades', 'Health & Beauty > Personal Care > Shaving & Grooming > Razors & Razor Blades', 'Shaving'],
    ['Wahl Lithium Elite Cordless Beard Trimmer Kit', 'Health & Beauty > Personal Care > Shaving & Grooming > Hair Removal', 'Trimmers & clippers'],
    ["Urtekram Men's Face Cream: 75ml Hydrating Moisturizer", 'Health & Beauty > Personal Care > Cosmetics > Skin Care', 'Skincare']
  ];
  for (const [name, cat, sub] of mgw) assert.deepEqual(c(name, cat), { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory: sub }, name);
  const no = [
    ['Childs Farm Baby Bubble Bath Cherry 250ml', 'Health & Beauty > Personal Care > Cosmetics > Bath & Body > Bath Additives', /children/],
    ['Yankee Candle Large Jar Vanilla Cupcake', 'Home & Garden > Decor > Candles & Home Fragrances > Candles', /not in these plans/],
    ['Lavender Reed Diffuser with Eau de Parfum scent 100ml', FRAGRANCE_OILS, /home scent|not in these plans/],
    ['TGI Fridays Barbecue Boneless Wings 400g', 'Food, Beverages & Tobacco > Food Items > Frozen Desserts', /not in these plans/],
    ['Spider-Man 蜘蛛侠金属胸针', 'Apparel & Accessories > Shoe Accessories', /English/],
    ['Oral-B Pro 3 Electric Toothbrush', 'Health & Beauty > Personal Care > Oral Care', /not in these plans/],
    ['Colgate Max White Toothpaste 75ml', 'Health & Beauty > Personal Care > Cosmetics > Skin Care', /dental/],
    ['Bebird Ear Wax Remover Otoscope, 1920P HD Flexible Ear Camera', 'Health & Beauty > Personal Care > Cosmetics > Cosmetic Tools > Skin Care Tools', /not beauty/]
  ];
  assert.equal(c('Mijia Smart Device 2', 'Health & Beauty > Personal Care > Cosmetics').doubt, true, 'placed only by the feed category: listed for checking');
  assert.equal(c('Max Factor Colour Elixir Lipstick English Rose 090 4g', 'Health & Beauty > Personal Care > Cosmetics > Make-Up').doubt, undefined);
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
  assert.deepEqual(r.accepted.mgw.map(p => p.product_name), ['Dior Sauvage Eau de Toilette 100ml'], "men's perfume goes to MGW");
  assert.match(reasons, /not in these plans/);
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
  assert.equal(get('123932:10551').subcategory, 'Beauty & Fragrances', 'keepCategory: a product already there keeps its category and subcategory');
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

test('plan report: samples from every subcategory, and a CHECK list for products placed only by the feed category', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'joybuy-check-'));
  const csv = HEAD
    + row(1, "Paco Rabanne Olympea Absolu Women's Eau de Parfum 30ml", PERFUME, 37.7)
    + row(2, 'MAC Macximal Silky Matte Lipstick Lady Danger', 'Health & Beauty > Personal Care > Cosmetics > Make-Up', 20)
    + row(3, 'Mijia Smart Device 2', 'Health & Beauty > Personal Care > Cosmetics', 30);
  writeFileSync(join(dir, 'AWIN_123932_114093.csv.gz'), gzipSync(csv));
  const out = mkdtempSync(join(tmpdir(), 'joybuy-check-out-'));
  const r = await planLegacyImport({ archive: dir, retailer: 'joybuy', outDir: out, now: new Date('2026-10-21T21:00:00Z') });
  assert.equal(r.accepted.wgw.length, 3);
  const text = readFileSync(join(out, 'report.txt'), 'utf8');
  assert.match(text, /Paco Rabanne.*\| Fragrance \|/);
  assert.match(text, /MAC Macximal.*\| Make-up \|/);
  assert.match(text, /-- CHECK: 1 placed only because of the feed category/);
  assert.match(text, /   - Mijia Smart Device 2 \| £30 \| Health & Beauty > Personal Care > Cosmetics/);
  const sql = readFileSync(join(out, 'sql', 'wgw', '0001.sql'), 'utf8');
  assert.doesNotMatch(sql, /doubt/, 'the check flag is not written to the database');
});


test('Joybuy rules: garden, smart home, cleaning, kids tech and school bags go to GGW, HGW and KGW', () => {
  const c = (name, feedCategory) => classify({ name, feedCategory });
  const cases = [
    ['Vonhaus Barrel Charcoal Barbecue', 'Home & Garden > Kitchen & Dining > Kitchen Appliances', 'ggw', 'BBQ & Outdoor Cooking'],
    ['Vonhaus Verona 2 Pack Zero Gravity Chair - Grey', 'Furniture > Outdoor Furniture Accessories', 'ggw', 'Garden Furniture & Outdoor Living'],
    ['AOXUN 1800L high plastic shed with base, large garden storage box', 'Home & Garden > Lawn & Garden > Outdoor Living > Outdoor Structures > Sheds', 'ggw', 'Garden Buildings, Fencing & Storage'],
    ['VIVREAL G40 Decorative String Lights 20M Outdoor', 'Home & Garden > Lighting', 'ggw', 'Outdoor Lighting & Garden Electrical'],
    ['JOOAN 2K Outdoor Security Camera LAN 2.4G WiFi 360 PTZ Cam', 'Home & Garden > Business & Home Security > Security Monitors', 'hgw', 'Smart Home'],
    ['eufy E340 2K Dual Cameras Smart Video Doorbell with Chime', 'Electronics > Networking > Network Security', 'hgw', 'Smart Home'],
    ['WIZ Smart Plug White: Wi-Fi Connected Smart Home Device', 'Home & Garden > Lighting', 'hgw', 'Smart Home'],
    ['eufy G50 Hybrid Robot Vacuum and Mop - 4000Pa Suction', 'Home & Garden > Household Appliances > Vacuums', 'hgw', 'Home Appliances'],
    ['Marvel 3D Spider-man Walkie Talkies', 'Toys & Games > Toys > Educational Toys', 'kgw', 'Kids Tech'],
    ["TABWEE K8 Kids' Tablet, 7-inch, 2GB RAM", 'Electronics > Computers > Tablet Computers', 'kgw', 'Kids Tech'],
    ['Paw Patrol Kids Backpack School Bag', 'Luggage & Bags > Backpacks', 'kgw', 'School & Backpacks']
  ];
  for (const [name, cat, site, siteCategory] of cases) {
    const r = c(name, cat);
    assert.equal(r.site, site, name);
    assert.equal(r.siteCategory, siteCategory, name);
  }
  for (const [name, cat] of [
    ['Thermos Vacuum Insulated Flask 1L', 'Home & Garden > Kitchen & Dining'],
    ['VTech Baby Monitor VM5467 Pan & Tilt', 'Baby & Toddler > Baby Safety'],
    ['Festool Fan BOX-LCH FT1-L Lunch Box', 'Tool Boxes'],
    ['Sony WH-1000XM5 Wireless Headphones', 'Electronics > Audio'],
    ['HuaSeed - Lotus Seed 100g', 'Food, Beverages & Tobacco > Food Items'],
    ['Ramadan Lantern Decorations for Home Set of 2', 'Home & Garden > Lighting'],
    ['SAFE. by PanzerGlass Privacy Screen Protector iPhone 17 Air', 'Electronics > Electronics Accessories']
  ]) assert.ok(c(name, cat).reject, `${name} must be left out`);
});

// Wrong products seen in the first all-sites plan (21 Oct 2026), and the subcategories that were wrong.
test('Joybuy rules: fixes from the all-sites plan (indoor furniture, kitchen ovens, bird food, blankets, toys, devices)', () => {
  const c = (name, feedCategory = 'Home & Garden') => classify({ name, feedCategory });
  const H = 'Home & Garden > Household Supplies > Household Cleaning Supplies';
  for (const [name, cat] of [
    ['Nutmeg Skin Refreshing Cleansing Wipes for Normal Skin 25 Wipes', H], ['MENDALE Oversized Hoodie Blanket, Extra Thick', H],
    ['Likewise Runner Knightsbridge Pawprints Brown 50x150cm', H], ['Andrex Family Soft Toilet Tissue, 2-Ply, 12 Rolls', H],
    ['Black Shark Magnetic Phone Cooler 6 Pro – Smart Display, Magnetic Ring Plate', 'Electronics'],
    ['VTech Toot-Toot Drivers Enchanted Castle Slide', 'Toys & Games'], ['LeapFrog LF1911 Smart Full HD Baby Camera', 'Baby'],
    ['Minecraft Backpack Hangers Blind Bag Assortment', 'Toys'], ['H.XUN Multifunctional Backpack 23L, Business Bag, Student School Bag', 'Luggage'],
    ['Joyic 160 cm Chaise Lounge Chair, Boneless Couch, for Living Room'], ['JOYFURNOS Storage Ottoman, Foldable Velvet Storage Bench, Hallway, Bedroom'],
    ['JOYFURNOS 5-Tier Shelving Unit, Steel Shelving Unit for Storage, for Garage, Shed'], ['TAPEBEAR Butyl Tape Waterproof Sealing Tape, Awning'],
    ['OIMIS Air Fryer Oven with 21 Presets, Rotisserie'], ['Tower Elite Pizza Oven - 18L, 2000W, Grey & Chrome'], ['Disposable Paper Plates 15cm, Barbecues and Picnics'],
    ['Huacan Cocktail Smoker Wooden Barrel Set'], ['Silverline Holesaw Hex Arbor'], ['Peckish Complete Seed Mix Feeder'], ['Honor Red Bean Paste with Lotus Seeds and Lily 300g'],
    ['JU7CER Wildflower Diamond Painting Kit'], ['Addis Everyday Kitchen Food Waste Compost Caddy Bin, 4.5L'], ['LED Downlights 5W Recessed Ceiling Lights IP44 Round Spotlights'],
    ['Black Lanterns Decorative Indoor: Hurricane Lantern Candle Holder Front Porch Garden Wall Decorations']
  ]) assert.ok(c(name, cat).reject, `${name} must be left out`);
  const sub = (name, cat) => c(name, cat).subcategory;
  // HGW's own subcategory names (lessons L56).
  assert.equal(sub('Hoover H-Wash 300 Pro Integrated Washing Machine', 'Home & Garden > Household Appliances > Laundry Appliances'), 'Washing Machine');
  assert.equal(sub('Philips STE1040/20 1000 Series Garment Steamer, 1800w', 'Home & Garden > Household Appliances > Floor & Steam Cleaners'), 'Ironing & Clothes Care');
  assert.equal(sub('Fairy Max Power Washing Up Liquid, Original, 660ml', H), 'Dishwashing');
  assert.equal(c('Tineco Pure ONE Station 5 Cordless Stick Vacuum, iLoop Smart Sensor').siteCategory, 'Home Appliances');
  assert.equal(sub("TABWEE K8 Kids' Tablet, 7-inch, 2 MP front camera + 5 MP rear camera", 'Electronics'), 'Kids tablets');
  const S = 'Health & Beauty > Personal Care > Shaving & Grooming';
  assert.equal(sub('Gillette Mach 3 2 Count', S), 'Shaving');
  assert.equal(sub('RAF Hair Clipper Professional Cordless Hair Trimmer Men Grooming Kit', S), 'Trimmers & clippers');
  assert.equal(sub('Lynx Aerosol Bodyspray Africa 250ml', 'Health & Beauty > Personal Care > Deodorant & Anti-Perspirant'), 'Deodorant');
  assert.equal(sub("L'Oréal Men Expert Hydra Energetic Daily SPF50+ Invisible Fluid 50ml", 'Health & Beauty > Personal Care > Cosmetics > Skin Care'), 'Skincare');
  assert.equal(sub('Vonhaus Hudson Grey Sun Lounger Chair With Cushion'), 'Loungers');
  assert.equal(sub('Costway 4 Pieces Outdoor Furniture Set with Cushions and Tempered Glass Table'), 'Garden furniture');
  assert.equal(sub('Charcoal BBQ Grill, 57cm Kettle Barbecue with Thermometer & Adjustable Air Vent'), 'BBQs');
  assert.equal(c('Large Vertical Firewood Rack, Log Storage Holder for Fireplace, Patio, Indoor, Outdoor').siteCategory, 'Garden Buildings, Fencing & Storage');
});

test('Coes kids and My Tool Shed garden rules', async () => {
  const kids = (await import('../../tools/import-rules/coes-kids.mjs')).classify;
  const k = (name, brand = '') => kids({ name, brand });
  // KGW's own subcategory names only (lessons L56; the dry run of 26 Oct 2026 warned about 10 new ones).
  assert.deepEqual(k('Adidas Copa Pure 3 League Turf Junior Boots', 'Adidas'), { site: 'kgw', siteCategory: 'Shoes', subcategory: 'Shoes' });
  assert.deepEqual(k('Barbour Boys Liddesdale Quilted Jacket', 'Barbour'), { site: 'kgw', siteCategory: 'Clothing', subcategory: 'Coats & Jackets' });
  assert.equal(k('Joules Junior Wellies Pink', 'Joules').subcategory, 'Shoes');
  assert.equal(k('Adidas Junior Ultraboost Trainers', 'Adidas').subcategory, 'Trainers');
  assert.equal(k('Adidas Junior Entrada 22 Training Shorts', 'Adidas').subcategory, 'Clothing');
  assert.equal(k('Levis Boys 511 Slim Jeans', 'Levis').subcategory, 'Trousers & Jeans');
  assert.equal(k('Ralph Lauren Boys Polo Shirt', 'Ralph Lauren').subcategory, 'Shirts & Tops');
  assert.deepEqual(k('Falke Kids Ankle Socks', 'Falke'), { site: 'kgw', siteCategory: 'Clothing', subcategory: 'Socks' });
  assert.equal(k('Barbour Kids Beanie Hat', 'Barbour').subcategory, 'Accessories');
  assert.equal(k('Puma Junior Shin Pads', 'Puma').subcategory, 'Sports & Outdoors');
  const kgwNames = new Set(['Shoes', 'Trainers', 'Coats & Jackets', 'Clothing', 'Trousers & Jeans', 'Shirts & Tops', 'Socks', 'Nightwear & Loungewear', 'Accessories',
    'Sunglasses', 'Sports & Outdoors', 'School Bags', 'Lunch Boxes & Bags']);
  for (const n of ['Joules Girls Floral Dress', 'Barbour Kids Pyjamas', 'Nike Kids Hoodie', 'Joules Kids Backpack', 'Joules Kids Lunch Bag']) {
    const r = k(n);
    assert.ok(r.subcategory && kgwNames.has(r.subcategory), `${n}: ${r.subcategory}`);
  }
  const coes = (await import('../../tools/import-rules/coes.mjs')).classify;
  assert.deepEqual(coes({ name: 'Taggs Dress Studs', brand: 'Taggs', feedCategory: 'Menswear' }), { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Cufflinks' });
  for (const n of ['Barbour Beaufort Wax Jacket', "Nobody's Child Layla Midi Dress", 'Failsworth Carloway Harris Tweed Baker Boy Cap']) assert.ok(k(n).reject, n);
  const mts = (await import('../../tools/import-rules/mytoolshed-garden.mjs')).classify;
  const g = (name, feedCategory) => mts({ name, feedCategory });
  assert.equal(g('Draper OC1 Polyethylene Barbecue Cover', 'Garden Tools > BBQs').siteCategory, 'BBQ & Outdoor Cooking');
  assert.equal(g('Sealey Infrared Quartz Patio Heater 240v', 'Fans & Heaters > Electric Heaters > Patio Heaters').siteCategory, 'Garden Furniture & Outdoor Living');
  assert.equal(g('Town and Country Pyramid Log Store L', 'Garden Tools > Storage & Covers > Log Storage').siteCategory, 'Garden Buildings, Fencing & Storage');
  assert.equal(g('Sealey Extra Slim 20w LED Floodlight', 'Garden Lighting').siteCategory, 'Outdoor Lighting & Garden Electrical');
  assert.equal(g('Ronseal Hardwood Garden Furniture Restorer', 'Garden Tools > Gazebos & Furniture').subcategory, 'Furniture care');
  for (const [n, cat] of [['Faithfull Fencing Pins', 'Hand Tools > Fencing Pins'], ['Draper Compost Tumbler', 'Composters'], ['Makita DUB184 Blower', 'Garden Tools > Outdoor Power Tools']]) assert.ok(g(n, cat).reject, n);
});

// KGW, HGW and GGW: no UNIQUE on awin_product_id, the unique key is (retailer, merchant id) (live databases, 21 Oct 2026).
const STABLE_TABLE = `CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, awin_product_id TEXT NOT NULL, merchant_product_id TEXT, retailer TEXT NOT NULL,
  site_category TEXT NOT NULL, subcategory TEXT, brand TEXT, product_name TEXT NOT NULL, feed_product_name TEXT, price REAL NOT NULL,
  currency TEXT DEFAULT 'GBP', stock_status TEXT, merchant_category TEXT, image_url TEXT, affiliate_url TEXT NOT NULL, ean TEXT,
  is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  specs_json TEXT, product_slug TEXT);
CREATE UNIQUE INDEX ux_products_refresh_stable_key ON products(retailer, merchant_product_id)
  WHERE merchant_product_id IS NOT NULL AND TRIM(merchant_product_id) <> '';`;

test('stable-key sites (GGW/HGW/KGW): the SQL updates by retailer + merchant id and keeps the category of products already there', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'joybuy-stable-'));
  const csv = HEAD
    + row(1, 'eufy G50 Hybrid Robot Vacuum and Mop', 'Home & Garden > Household Appliances > Vacuums', 199)
    + row(2, 'WIZ Smart Plug White Wi-Fi', 'Home & Garden > Lighting', 12)
    + row(3, 'Vonhaus Barrel Charcoal Barbecue', 'Home & Garden > Kitchen & Dining > Kitchen Appliances', 69.99);
  writeFileSync(join(dir, 'AWIN_123932_114093.csv.gz'), gzipSync(csv));
  const out = mkdtempSync(join(tmpdir(), 'joybuy-stable-out-'));
  const r = await planLegacyImport({ archive: dir, retailer: 'joybuy', outDir: out, now: new Date('2026-10-21T22:00:00Z') });
  assert.equal(r.accepted.hgw.length, 2);
  assert.equal(r.accepted.ggw.length, 1);
  const db = new DatabaseSync(':memory:');
  db.exec(STABLE_TABLE);
  // The robot vacuum is already on HGW, under Home Appliances (written by the router).
  db.prepare('INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, subcategory, product_name, price, affiliate_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('123932:10551', '10551', 'Joybuy UK', 'Home Appliances', 'Home Appliances', 'Old name', 250, 'https://www.awin1.com/old');
  const sqlDir = join(out, 'sql', 'hgw');
  const sql = readFileSync(join(sqlDir, readdirSync(sqlDir).filter(f => f.endsWith('.sql'))[0]), 'utf8');
  assert.match(sql, /ON CONFLICT\(retailer, merchant_product_id\) WHERE merchant_product_id IS NOT NULL/);
  assert.doesNotMatch(sql, /site_category=excluded/, 'keepCategory: the category of a product already there is not changed');
  db.exec(sql);
  db.exec(sql);
  const rows = db.prepare("SELECT * FROM products WHERE retailer = 'Joybuy UK' ORDER BY merchant_product_id").all();
  assert.equal(rows.length, 2, 'no duplicate after two runs');
  assert.equal(rows[0].site_category, 'Home Appliances', 'existing product keeps its category');
  assert.equal(rows[0].price, 199, 'existing product gets the new price');
  assert.equal(rows[1].site_category, 'Smart Home', 'new product gets the plan category');
  assert.equal(rows[1].merchant_product_id, '10552');
  const ggwSql = readFileSync(join(out, 'sql', 'ggw', readdirSync(join(out, 'sql', 'ggw')).filter(f => f.endsWith('.sql'))[0]), 'utf8');
  assert.match(ggwSql, /ON CONFLICT\(retailer, merchant_product_id\)/, 'GGW uses the same key as HGW');
});
