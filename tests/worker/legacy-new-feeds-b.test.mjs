// New Awin feeds of 23 Oct 2026, wave B: Plusshop UK and Bazta UK (the same catalogue, two prices) on WGW, MGW, HGW,
// KGW and GGW; Viaduct Clothing (one card per product instead of one per size) on MGW, WGW and KGW; Beyond Shakers on HGW.
// Names and category paths are from the awin-feed-sample report of 23 Oct 2026; shop tags and types from the live shops.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import * as plusshop from '../../tools/import-rules/plusshop.mjs';
import * as bazta from '../../tools/import-rules/bazta.mjs';
import * as viaduct from '../../tools/import-rules/viaduct.mjs';
import * as viaductWomen from '../../tools/import-rules/viaduct-women.mjs';
import * as shakers from '../../tools/import-rules/beyondshakers.mjs';
import * as sizes from '../../tools/cleanup-rules/viaduct-sizes.mjs';

const place = r => (r.reject ? `REJECT ${r.reject}` : `${r.site} | ${r.siteCategory} | ${r.subcategory}`);
const ps = (name, leaf, path, awin = '', brand = '') => place(plusshop.classify({ name, feedCategory: leaf, awinCategory: awin ? `${path} || ${awin}` : path, brand }));

test('Plusshop/Bazta: beauty to WGW, men to MGW (path or name), watches by who wears them', () => {
  assert.equal(ps('Maison Alhambra Unisex Oasis Eau De Parfum – 100 ml', 'Eau de parfum', 'Men > Women > Personal care > Personal Care > Fragrances > Eau de parfum > Arabian Perfumes', 'Fragrance'), 'wgw | Beauty & Fragrances | Fragrance');
  assert.equal(ps('Maison Alhambra Men’s Philos Rosso Eau De Parfum – 100 ml', 'Eau de parfum', 'Men > Women > Personal care > Personal Care > Fragrances > Eau de parfum'), 'mgw | Grooming & Fragrances | Fragrance');
  assert.equal(ps('Hugo Boss Dark Blue Eau de Toilette 75ml', 'Personal Care', 'Men > Personal Care > Fragrances > Eau de toilette', 'Bodycare & Fitness'), 'mgw | Grooming & Fragrances | Fragrance');
  assert.equal(ps('Calvin Klein IN2U Her - Eau de Toilette 100ml Spray', 'Personal care', 'Women > Personal care > Fragrances > Eau de toilette'), 'wgw | Beauty & Fragrances | Fragrance');
  assert.equal(ps('Gillette ProSheild Chill razor blades 4 pcs', 'Shaving & hair-cutting', 'Men > Women > Personal care > Shaving & hair-cutting'), 'mgw | Grooming & Fragrances | Shaving');
  assert.equal(ps('Proraso Beard Balm 100 ml', 'Personal Care', 'Men > Personal Care > Beard care'), 'mgw | Grooming & Fragrances | Beard care');
  assert.equal(ps('Beauty Formulas Aloe Vera Bikini Line Wax Strips - 36 pcs', 'Shaving & hair removal', 'Women > Personal care > Shaving & hair removal > Hair removal'), 'wgw | Beauty & Fragrances | Hair removal');
  assert.equal(ps('QVS Black Carbon Steel Eyelash Curler', 'Makeup', 'Women > Personal care > Makeup > Makeup accessories > SUMMER DEALS'), 'wgw | Beauty & Fragrances | Beauty tools');
  assert.equal(ps('Essence Lash Princess Cat Eye Mascara', 'Makeup', 'Women > Personal care > Makeup > Mascara'), 'wgw | Beauty & Fragrances | Make-up');
  assert.equal(ps('Elizabeth Arden Ceramide Vitamin C Capsules 30 pcs', 'Face care', 'Women > Personal care > Face & skin care > Face care'), 'wgw | Beauty & Fragrances | Skincare');
  assert.equal(ps('Zazie Toiletry Bag Pink', 'Personal care', 'Women > Personal care > Toiletry bags'), 'wgw | Bags & Accessories | Bags');
  assert.equal(ps('Casio LRW-200H-4CVDF Lady Diver Analog Sports Watch - White & Pink', 'Analog watches', 'Women > Accessories > Watches > Analog watches'), 'wgw | Watches | Watches');
  assert.equal(ps('Casio WS-1800-3AVEF Digital Sports Watch - Green', 'Sports watches', 'Men > Accessories > Watches > Sports watches'), 'mgw | Watches | Watches');
  assert.equal(ps('Vtech Kidizoom Smartwatch - Blue', "Children's watches", "Children > Baby & children products > Children's watches"), 'kgw | Kids Tech | Kids Smartwatches');
  assert.equal(ps('Peppa Pig 482608 Kids Analog Wrist Watch - Pink', 'Analog watches', 'Children > Accessories > Analog watches'), 'kgw | Accessories | Kids Watches');
});

test('Plusshop/Bazta: home cleaning, home fragrance, kitchen and smart home to HGW; garden and BBQ to GGW', () => {
  assert.equal(ps('Glade Pure Clean Linen Air Freshener Room Spray - 300 ml', 'Cleaning', 'Home > Household > Cleaning > Cleaning products > Air refresheners', 'Cleaning'), 'hgw | Home Decor | Home Fragrance');
  assert.equal(ps('Lenor Cotton Fresh Rinse Aid - 1 42L', 'Clean, iron & dry', 'Home > Household > Clean, iron & dry > Laundry > Fabric softener', 'Cleaning'), 'hgw | Cleaning & Laundry | Fabric Softener');
  assert.equal(ps('Ariel Liquid Colour Detergent - 1L', 'Clean, iron & dry', 'Home > Household > Clean, iron & dry > Laundry > Detergent'), 'hgw | Cleaning & Laundry | Laundry Detergent');
  assert.equal(ps('Swiffer Duster Kit XXL - Handle & 2 cloths', 'Steam mop & cleaner', 'Home > Household > Cleaning > Steam mop & cleaner > Cleaning products'), 'hgw | Cleaning & Laundry | Duster');
  assert.equal(ps('Erase Away Cleaning Pads – 2 Pcs', 'Cleaning', 'Home > Household > Cleaning > Cleaning products > Kitchen', 'Cleaning'), 'hgw | Cleaning & Laundry | Cloths & Sponges');
  assert.equal(ps('InnovaGoods Uncorker Electric Corkscrew', 'Kitchen', 'Home > Household > Kitchen > Bar'), 'hgw | Kitchen & Dining | Bar Accessories');
  assert.equal(ps('Scandinavia Bathroom Double-sided Mirror on Stand', 'Bathroom accessories', 'Home > Household > Bathroom accessories'), 'hgw | Bedding & Bath | Bathroom Accessories');
  assert.equal(ps('Byron Wireless WiFi & Video Doorbell - Black', 'Home security', 'Home > Household > Home security', 'Home Security'), 'hgw | Smart Home | Video Doorbell');
  assert.equal(ps('Black & Decker Spray Gun', 'Garden tools', 'Home > Household > HOT DEALS > Tools and garden appliances > Water hoses and accessories > Garden tools > Nozzles & spray guns > Garden', 'Garden Tools'), 'ggw | Watering & Irrigation | Spray Guns & Nozzles');
  assert.equal(ps('Wilkinson Sword Pruning shears', 'Garden tools', 'Home > Household > Tools and garden appliances > Garden tools > Tools > Pruning'), 'ggw | Garden Tools | Pruning & Cutting');
  assert.equal(ps('Black & Decker BBQ & Grill Cleaner Wipes - 20 pcs', 'Cleaning', 'Home > Household > Cleaning > Cleaning products', 'Cleaning'), 'ggw | BBQ & Outdoor Cooking | BBQ accessories');
  assert.equal(ps('BeNomad BBQ & Steak set', 'Cutting boards', 'Home > Household > Kitchen > Cutting boards'), 'ggw | BBQ & Outdoor Cooking | BBQ accessories');
  assert.equal(ps('Goobay LED Outdoor Floodlight 50W Black', 'Household', 'Home > Household > Lighting'), 'ggw | Outdoor Lighting & Garden Electrical | Floodlights & security lights');
});

test('Plusshop/Bazta: kids products to KGW (toys, baby, school, kids tech, outdoor)', () => {
  assert.equal(ps('LEGO 3D The LEGO Movie 2 School Bag', 'Baby & children products', 'Children > Baby & children products > School accessories > School bags & bags > SUMMER DEALS', "Children's Clothing"), 'kgw | School & Backpacks | School Bags');
  assert.equal(ps('Mega Bloks GRV37 Construction site', 'Toys', 'Children > Baby & children products > Activities & play time > Toys > Building & construction toys', 'Toys'), 'kgw | Toys & Games | Construction Set Toys');
  assert.equal(ps('Barbie Chelsea Doll with Shorts', 'Barbie dolls', 'Children > Baby & children products > Activities & play time > Toys > Dolls & accessories > Dolls > Barbie dolls'), 'kgw | Toys & Games | Dolls');
  assert.equal(ps('PAW Patrol Shuffle Dominoes Matching Game', 'Toys', 'Children > Baby & children products > Activities & play time > Toys > Games > Games', 'Toys'), 'kgw | Toys & Games | Board Games');
  assert.equal(ps('Nerf N-Strike Elite Accustrike Refill - 24 pcs', 'Toy weapons', 'Children > Baby & children products > Activities & play time > Toys > Toy weapons'), 'kgw | Toys & Games | Toy Weapons & Gadgets');
  assert.equal(ps('Keel Toys Signature Cuddle Puppies Dog 25cm', 'Toys', 'Children > Baby & children products > Activities & play time > Toys > Soft toys'), 'kgw | Toys & Games | Stuffed Animals & Cuddly Toys');
  assert.equal(ps('Vital Baby Nurture Fast Flow Bottle Nipples - 2 pcs', 'Bottles & accessories', 'Children > Baby & children products > Bottles & accessories'), 'kgw | Baby & Toddler | Baby Bottle Teats & Liners');
  assert.equal(ps('MAM Perfect Pacifier 0 months - Blue', 'Baby & children products', 'Children > Baby & children products > Pacifiers'), 'kgw | Baby & Toddler | Baby Soothers');
  assert.equal(ps('Angelcare Soft-Touch Bath Chair – Aqua', 'Bathroom & care', 'Children > Baby & children products > Bathroom & care > Baby bath & bath accessories'), 'kgw | Baby & Toddler | Baby Bathtubs & Bath Seats');
  assert.equal(ps('myFirst Insta Wi Camera Yellow', 'Remote controlled toys', 'Children > Baby & children products > Activities & play time > Toys > Remote controlled toys'), 'kgw | Kids Tech | Kids Cameras');
  assert.equal(ps('Intex Lifejacket', 'Activities & play time', 'Children > Baby & children products > Activities & play time > Outdoor toys'), 'kgw | Sports & Outdoors | Water Play Equipment');
});

test('Plusshop/Bazta: adult, pet, car, health, cards and electronics are never placed', () => {
  assert.equal(ps('BlowYo Extreme Wave Intense Oral Super Stroker', 'Intimate', 'Men > Women > Personal care > Personal Care > Intimate', 'Adult Toys'), 'REJECT adult product');
  assert.equal(ps('Pjur Analyse Me! Lubricant - 100ml', 'Cream, gel & oils', 'Men > Women > Personal care > Personal Care > Intimate > Cream, gel & oils > Lube', '', 'Pjur'), 'REJECT adult product');
  assert.equal(ps('Sex & Mischief Sparkle Bling Whip - 78cm', 'Intimate play', 'Men > Women > Personal care > Personal Care > Intimate > Intimate play'), 'REJECT adult product');
  assert.equal(ps('Billy Boy Sensual variety condoms - 3 pcs', 'Intimate', 'Men > Women > Personal care > Personal Care > Intimate', '', 'Billy Boy'), 'REJECT adult product');
  assert.equal(ps('Hunter Yuroma Rugby Toy', 'Household', 'Home > Household > Pet accessories > Toys > SUMMER DEALS', 'Car Accessories'), 'REJECT pet product');
  assert.equal(ps('Little Trees New Car Air Freshener', 'Car & bike', 'Home > Household > Car & bike > Auto > Air Freshener', 'Car Accessories'), 'REJECT car or bike product (not on these sites)');
  assert.equal(ps('Turtle Wax Wheel Wizard Easy Clean Brush', 'Cleaning', 'Home > Household > Cleaning > Cleaning products', 'Cleaning'), 'REJECT car or bike product (not on these sites)');
  assert.equal(ps('Colgate Max White One Toothpaste - 75ml', 'Dental care', 'Men > Women > Personal care > Dental care'), 'REJECT health or dental product');
  assert.equal(ps('Always Ultra Normal Sanitary Towels', 'Hygiene', 'Women > Personal care > Hygiene > Sanitary towels'), 'REJECT health, dental or hygiene product (not beauty)');
  assert.equal(ps('Giftmaker Christmas card - Let it Snow', 'Christmas', 'Home > Household > Christmas > Christmas cards & gift wrap'), 'REJECT cards, gift wrap or party items');
  assert.equal(ps('BasicPlus iPhone 12 Mini Cover - Black Marble', 'Covers, cases & holders', 'Electronics & accessories > Accessories for phones and tablets > Covers, cases & holders', 'Mobile Phone Accessories'), 'REJECT electronics accessory (Technology Gear World, later)');
  assert.equal(ps('Smartware Fake Security Camera Silver', 'Home security', 'Home > Household > Home security', 'Home Security'), 'REJECT fake security camera');
  assert.equal(ps('Raid Ant & Cockroach Powder - 250g', 'Tools and garden appliances', 'Home > Household > Tools and garden appliances > Pest control'), 'REJECT pest control');
  assert.equal(ps('Kleenex Family Maxi Pack - 128 pcs', 'Bathroom accessories', 'Home > Household > Bathroom accessories'), 'REJECT paper consumables');
});

// A small Plusshop-like feed: the same product in two feeds (one link with "?gsnp"), a 29p card, a lubricant.
const PS_HEAD = 'merchant_product_id,product_name,brand_name,search_price,in_stock,stock_quantity,merchant_category,category_name,merchant_product_category_path,product_gtin,merchant_deep_link,merchant_image_url\n';
const psRow = (id, name, price, leaf, path, link, ean = '') =>
  `${id},"${name}",Brand,${price},1,4,"${leaf}",,"${path}",${ean},${link},https://uk.plusshop.com/media/catalog/product/${id}.png\n`;

test('Plusshop plan: one card for the same product in two feeds, the shop address without "?gsnp", 29p and adult products out', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'plusshop-'));
  writeFileSync(join(dir, 'AWIN_69306_89999.csv.gz'), gzipSync(PS_HEAD
    + psRow('A1', 'Hugo Boss Dark Blue Eau de Toilette 75ml', 29.99, 'Personal Care', 'Men > Personal Care > Fragrances > Eau de toilette', 'https://uk.plusshop.com/hugo-boss-dark-blue-eau-de-toilette-75ml?gsnp', '0737052031415')
    + psRow('A2', 'Giftmaker Christmas card - Let it Snow', 0.29, 'Christmas', 'Home > Household > Christmas > Christmas cards & gift wrap', 'https://uk.plusshop.com/giftmaker-christmas-card-let-it-snow?gsnp')
    + psRow('A3', 'Pjur Analyse Me! Lubricant - 100ml', 7.49, 'Cream, gel & oils', 'Men > Women > Personal care > Personal Care > Intimate > Cream, gel & oils', 'https://uk.plusshop.com/pjur-analyse-me-glidecreme-100ml?gsnp')));
  writeFileSync(join(dir, 'AWIN_69306_111951.csv.gz'), gzipSync(PS_HEAD
    + psRow('B1', 'Hugo Boss Dark Blue Eau de Toilette 75ml', 27.49, 'Personal Care', 'Men > Personal Care > Fragrances > Eau de toilette', 'https://uk.plusshop.com/hugo-boss-dark-blue-eau-de-toilette-75ml', '0737052031415')
    + psRow('B2', 'Ariel Liquid Colour Detergent - 1L', 6.95, 'Clean, iron & dry', 'Home > Household > Clean, iron & dry > Laundry > Detergent', 'https://uk.plusshop.com/ariel-liquid-colour-detergent-1l')
    + psRow('B3', 'Mega Bloks GRV37 Construction site', 9.30, 'Toys', 'Children > Baby & children products > Activities & play time > Toys > Building & construction toys', 'https://uk.plusshop.com/mega-bloks-grv37-construction-site')));
  const out = mkdtempSync(join(tmpdir(), 'plusshop-out-'));
  const r = await planLegacyImport({ archive: dir, retailer: 'plusshop', outDir: out, now: new Date('2026-10-23T22:30:00Z') });
  assert.equal(r.products, 5, 'the perfume in both feeds is one product');
  assert.equal(r.accepted.mgw.length, 1);
  const perfume = r.accepted.mgw[0];
  assert.equal(perfume.awin_product_id, '69306:hugo-boss-dark-blue-eau-de-toilette-75ml');
  assert.equal(perfume.merchant_product_id, 'hugo-boss-dark-blue-eau-de-toilette-75ml');
  assert.equal(perfume.price, 27.49, 'the lower in-stock price of the two feeds');
  assert.equal(perfume.ean, '0737052031415');
  assert.match(perfume.affiliate_url, /awinmid=69306&awinaffid=3057233&ued=https%3A%2F%2Fuk\.plusshop\.com%2Fhugo-boss-dark-blue-eau-de-toilette-75ml$/);
  assert.equal(r.accepted.hgw[0].subcategory, 'Laundry Detergent');
  assert.equal(r.accepted.kgw[0].merchant_product_id, 'mega-bloks-grv37-construction-site', 'KGW: the stable key is the shop address');
  assert.deepEqual(Object.keys(r.rejected).sort(), ['adult product', 'price under £1 (too small to list)']);
  assert.equal(r.accepted.wgw.length + r.accepted.ggw.length, 0);
  const plan = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8'));
  assert.equal(plan.addOnly, false);
  assert.equal(plan.retailer, 'Plusshop UK');
  // Bazta: the same rules, its own shop and Awin number.
  assert.equal(bazta.RULES.retailer, 'Bazta UK');
  assert.ok(bazta.RULES.shop.test('https://uk.bazta.com/ariel-liquid-colour-detergent-1l'));
  assert.ok(!bazta.RULES.shop.test('https://uk.plusshop.com/ariel-liquid-colour-detergent-1l'));
});

// A fake shop: its live catalogue (/products.json) has these products (L39).
const liveShop = products => async url => ({ ok: true, json: async () => ({ products: /[?&]page=1$/.test(url) ? products : [] }) });
const VIA_HEAD = 'merchant_product_id,product_name,brand_name,search_price,currency,in_stock,stock_quantity,merchant_category,ean,merchant_deep_link,merchant_image_url\n';
const viaRow = (variant, name, price, handle) =>
  `${variant},"${name}",adidas,${price},GBP,1,1,General Clothing,,https://viaductclothing.co.uk/products/${handle}?variant=${variant},https://cdn.shopify.com/s/files/1/0300/6631/1261/files/${handle}.jpg\n`;
const viaLive = (handle, type, tags, variants) => ({ handle, product_type: type, tags, variants: variants.map(([id, available]) => ({ id, sku: '', available, featured_image: null })),
  images: [{ src: `https://cdn.shopify.com/s/files/1/0300/6631/1261/files/${handle}-live.jpg`, variant_ids: [] }] });

test('Viaduct: one card per product (all sizes), the shop tags decide men or women, juniors to KGW, the link opens the page', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'viaduct-'));
  writeFileSync(join(dir, 'AWIN_125096_114294.csv.gz'), gzipSync(VIA_HEAD
    + viaRow(11, 'adidas FC Schalke 04 3rd Kit Shorts - Green | Size: S', 7.99, 'adidas-fc-schalke-04-3rd-kit-shorts-green')
    + viaRow(12, 'adidas FC Schalke 04 3rd Kit Shorts - Green | Size: M', 7.99, 'adidas-fc-schalke-04-3rd-kit-shorts-green')
    + viaRow(21, 'New Balance Womens Energize Tights - Navy | Size: S', 39.99, 'new-balance-womens-energize-tights-navy')
    + viaRow(31, 'adidas Junior Pureboost Go Running Shoes - White | Size: 4', 44.99, 'adidas-junior-pureboost-go-white')
    + viaRow(41, 'adidas Unisex Ultra Boost DNA Shoes - Black | Size: 6', 69.99, 'adidas-unisex-ultra-boost-dna-black')));
  const fetchImpl = liveShop([
    viaLive('adidas-fc-schalke-04-3rd-kit-shorts-green', 'Shorts', ["Men's", 'Colour_Green'], [[11, true], [12, true]]),
    viaLive('new-balance-womens-energize-tights-navy', 'Leggings', ['Womens'], [[21, true]]),
    viaLive('adidas-junior-pureboost-go-white', 'Trainers', ["Men's"], [[31, true]]),
    viaLive('adidas-unisex-ultra-boost-dna-black', 'Trainers', ["Men's", 'Womens'], [[41, true]])
  ]);
  const men = await planLegacyImport({ archive: dir, retailer: 'viaduct', outDir: mkdtempSync(join(tmpdir(), 'viaduct-out-')), now: new Date('2026-10-23T22:30:00Z'), fetchImpl });
  assert.equal(men.products, 4, 'two sizes of the shorts are one product');
  assert.deepEqual(men.accepted.mgw.map(p => `${p.product_name} | ${p.site_category} | ${p.subcategory}`).sort(), [
    'adidas FC Schalke 04 3rd Kit Shorts - Green | Clothing | Shorts',
    'adidas Unisex Ultra Boost DNA Shoes - Black | Shoes | Trainers'
  ]);
  const shorts = men.accepted.mgw.find(p => /Schalke/.test(p.product_name));
  assert.equal(shorts.awin_product_id, '125096:adidas-fc-schalke-04-3rd-kit-shorts-green');
  assert.match(shorts.affiliate_url, /ued=https%3A%2F%2Fviaductclothing\.co\.uk%2Fproducts%2Fadidas-fc-schalke-04-3rd-kit-shorts-green$/, 'no ?variant=: the card covers all sizes');
  assert.equal(shorts.image_url, 'https://cdn.shopify.com/s/files/1/0300/6631/1261/files/adidas-fc-schalke-04-3rd-kit-shorts-green-live.jpg');
  assert.deepEqual(men.accepted.kgw.map(p => `${p.product_name} | ${p.site_category} | ${p.subcategory} | ${p.merchant_product_id}`), [
    'adidas Junior Pureboost Go Running Shoes - White | Shoes | Trainers | adidas-junior-pureboost-go-white'
  ]);
  assert.deepEqual(Object.keys(men.rejected), ["women's (on Women's Gear World, viaduct-women)"]);
  const women = await planLegacyImport({ archive: dir, retailer: 'viaduct-women', outDir: mkdtempSync(join(tmpdir(), 'viaduct-w-out-')), now: new Date('2026-10-23T22:30:00Z'), fetchImpl });
  assert.deepEqual(women.accepted.wgw.map(p => `${p.product_name} | ${p.site_category} | ${p.subcategory}`).sort(), [
    'New Balance Womens Energize Tights - Navy | Clothing | Leggings',
    'adidas Unisex Ultra Boost DNA Shoes - Black | Shoes | Trainers'
  ]);
  assert.equal(viaduct.displayName('adidas Originals Daily Chino Shorts - Beige | Size: XS'), 'adidas Originals Daily Chino Shorts - Beige');
  assert.equal(viaductWomen.RULES.sites.join(), 'wgw');
});

test('viaduct-sizes clean-up: hides the old one-card-per-size rows only when the new cards are on the site', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, awin_product_id TEXT NOT NULL UNIQUE, retailer TEXT NOT NULL,
    site_category TEXT, product_name TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT)`);
  const add = db.prepare('INSERT INTO products (awin_product_id, retailer, site_category, product_name, is_active) VALUES (?, ?, ?, ?, ?)');
  add.run('125096:42550014705757', 'Viaduct Clothing', 'Clothing', 'Ellesse Diveria Sweatshirt - Black / S', 1);
  add.run('125096:42550014672989', 'Viaduct Clothing', 'Clothing', 'Ellesse Diveria Sweatshirt - Black / XS', 1);
  add.run('125096:40992138264669', 'Viaduct Clothing', 'Shoes', 'Reebok Victory G Gore-Tex Shoes - Grey / 4', 0);
  add.run('61655:55306556440958', 'Back to the Office', 'Watches', 'Other shop', 1);
  for (const f of ['summarySql', 'samplesSql', 'idsSql', 'keptSql']) assert.doesNotMatch(sizes[f](), /[%<>&|^]/, f);
  // No new cards yet (the import did not run): nothing to hide.
  assert.deepEqual(db.prepare(sizes.idsSql()).all(), []);
  for (let i = 0; i < 30; i++) add.run(`125096:product-page-${i}`, 'Viaduct Clothing', 'Clothing', `Product ${i}`, 1);
  const ids = db.prepare(sizes.idsSql()).all().map(r => r.id);
  assert.deepEqual(ids, [1, 2]);
  db.exec(sizes.updateSql(ids, false));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND retailer = 'Viaduct Clothing'").get().n, 30);
  db.exec(sizes.updateSql(ids, true));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND retailer = 'Viaduct Clothing'").get().n, 32);
});

test('Beyond Shakers: shakers and bottles to HGW Kitchen & Dining with a name that says what they are; supplements out', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'shakers-'));
  const head = 'merchant_product_id,product_name,brand_name,search_price,merchant_category,ean,merchant_deep_link,merchant_image_url\n';
  const row = (v, name, price, handle) => `${v},"${name}",Beyond Shakers,${price},Fitness Equipment,,https://beyondshakers.com/products/${handle}?variant=${v},https://beyondshakers.com/cdn/shop/files/${handle}.jpg\n`;
  writeFileSync(join(dir, 'AWIN_66912_98325.csv.gz'), gzipSync(head + row(1, 'Terracotta & Sand Twist', 24.99, 'twist-shaker-terracotta-sand') + row(2, 'Pink', 19.99, 'pink')));
  writeFileSync(join(dir, 'AWIN_66912_118469.csv.gz'), gzipSync(head + row(3, 'Grey Gym Towel', 10, 'grey-gym-towel') + row(4, 'Creatine Gummies', 24.99, 'creatine-gummies')));
  const fetchImpl = liveShop([['twist-shaker-terracotta-sand', 'Shaker', 1], ['pink', 'Shaker', 2], ['grey-gym-towel', 'Towels', 3], ['creatine-gummies', 'Supplement', 4]]
    .map(([handle, type, id]) => ({ handle, product_type: type, tags: [], variants: [{ id, sku: '', available: true }], images: [{ src: `https://beyondshakers.com/cdn/shop/files/${handle}.jpg`, variant_ids: [] }] })));
  const r = await planLegacyImport({ archive: dir, retailer: 'beyondshakers', outDir: mkdtempSync(join(tmpdir(), 'shakers-out-')), now: new Date('2026-10-23T22:30:00Z'), fetchImpl });
  assert.deepEqual(r.accepted.hgw.map(p => `${p.product_name} | ${p.site_category} | ${p.subcategory}`).sort(), [
    'Beyond Shakers Grey Gym Towel | Bedding & Bath | Towel',
    'Beyond Shakers Pink Protein Shaker | Kitchen & Dining | Drinkware',
    'Beyond Shakers Terracotta & Sand Twist Protein Shaker | Kitchen & Dining | Drinkware'
  ]);
  assert.deepEqual(Object.keys(r.rejected), ['supplements, lifting gear or gift cards (not on these sites)']);
  assert.equal(shakers.RULES.sites.join(), 'hgw');
});
