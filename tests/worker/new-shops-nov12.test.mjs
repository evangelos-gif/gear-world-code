// New Awin shops of 12 Nov 2026 (owner: "all the feeds, whatever the country"; lessons L116). Names are from the
// awin-feed-sample report of House of Sneakers (11 Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as hos from '../../tools/import-rules/houseofsneakers.mjs';

test('House of Sneakers: women to WGW, children to KGW, men and unisex to MGW, all Shoes; only the pound feed is read', () => {
  const page = h => `https://house-of-sneakers.de/products/${h}?variant=1`;
  const c = (name, h) => hos.classify({ name, url: page(h) });
  assert.deepEqual(c('Air Jordan 1 Low SE Light Smoke Grey Gym Red', 'air-jordan-1-low-se-light-smoke-grey-gym-red'), { site: 'mgw', siteCategory: 'Shoes', subcategory: 'Trainers' });
  assert.equal(c('Nike Shox TL Pink Foam', 'nike-shox-tlpink-foam-womens').site, 'wgw');
  assert.equal(c("Air Max 1 '87 Denim Aura", 'nike-air-max-1-87-denim-aura-damen').site, 'wgw');
  assert.equal(c('Air Jordan 1 Mid Patent Black White Gold (GS)', 'jordan-1-midpatent-black-white-gold-gs').site, 'kgw');
  assert.equal(c('Yeezy Foam RNNR MX Brown Blue', 'adidas-yeezy-foam-runner-mx-cinder').subcategory, 'Trainers');
  assert.equal(c('Birkenstock Arizona Big Buckle Sandal', 'birkenstock-arizona').subcategory, 'Sandals');
  assert.equal(c('Timberland 6 Inch Premium Boot Wheat', 'timberland-6-inch').subcategory, 'Boots');
  assert.equal(c('Adidas  Campus 00er Surf Green', 'adidas-campus-00er-surf-green').site, 'mgw');
  assert.ok(c('House of Sneakers Gift Card', 'gift-card').reject);
  assert.equal(hos.displayName('Adidas  Campus 00er Surf Green'), 'Adidas Campus 00er Surf Green');
  assert.equal(hos.displayBrand('Adidas'), 'adidas');
  assert.ok(hos.RULES.shop.test('https://house-of-sneakers.de/products/x'));
  assert.ok(!hos.RULES.shop.test('https://www.awin1.com/cread.php?x'));
  const dir = mkdtempSync(join(tmpdir(), 'gw-hos-'));
  for (const id of [116528, 118232, 118233]) writeFileSync(join(dir, `AWIN_114336_${id}.csv.gz`), '');
  assert.deepEqual(hos.feedFiles(dir), [join(dir, 'AWIN_114336_118232.csv.gz')], 'the pound feed only');
});

// ---- UK shops of 12 Nov 2026 (lessons L117) ----
import { commonVariantName, planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import { googleFeedFiles, stripOption } from '../../tools/import-rules/lib/google-feed.mjs';
import * as cat from '../../tools/import-rules/catfootwear.mjs';
import * as sheds from '../../tools/import-rules/buysheds.mjs';
import * as fila from '../../tools/import-rules/fila.mjs';
import * as home from '../../tools/import-rules/homespace.mjs';
import * as ec from '../../tools/import-rules/extremecomfort.mjs';
import * as pd from '../../tools/import-rules/pixiedixie.mjs';
import { mkdirSync } from 'node:fs';

test('a card name is the words all its options share, never the first size or colour', () => {
  assert.equal(commonVariantName(['Animal Sleepsuit - 0-3mths / Animal / White', 'Animal Sleepsuit - 3-6mths / Animal / White']), 'Animal Sleepsuit');
  assert.equal(commonVariantName(['Colorado 2.0 P726503 Icon Mens Black Boots - 8', 'Colorado 2.0 P726503 Icon Mens Black Boots - 9']), 'Colorado 2.0 P726503 Icon Mens Black Boots');
  assert.equal(commonVariantName(['Planet B Duvet Cover Set - Multi - Double', 'Planet B Duvet Cover Set - Multi - King']), 'Planet B Duvet Cover Set - Multi');
  assert.equal(commonVariantName(['Frigate Bracelet S - 19cm/No Gift Wrapping', 'Frigate Bracelet M - 21cm/No Gift Wrapping']), 'Frigate Bracelet');
  assert.equal(commonVariantName(['Red Shirt', 'Blue Shirt']), '', 'nothing shared: keep the feed name');
  assert.equal(stripOption('Animal Blanket - one size / Animal / White'), 'Animal Blanket');
  assert.equal(stripOption('Venter Chino Shorts - XXL'), 'Venter Chino Shorts');
  assert.equal(stripOption("Junior's Heritage T-Shirt Logo - 10YR"), "Junior's Heritage T-Shirt Logo");
  assert.equal(stripOption('Pro Tennis V-Back Tank - UK'), 'Pro Tennis V-Back Tank');
  assert.equal(stripOption('Country Living Ceramic Plant Pot - "Plant One On Me"'), 'Country Living Ceramic Plant Pot - "Plant One On Me"');
});

test('Google-format feeds: the shop\'s own file in the archive (or Downloads), and the Google columns read as Awin ones', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gw-google-'));
  const archive = join(root, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(archive);
  writeFileSync(join(root, '120435-retail-en_GB.csv'), '');
  assert.deepEqual(googleFeedFiles(120435)(archive), [join(root, '120435-retail-en_GB.csv')], 'from Downloads when the archive has none');
  // Made-up rows in the Google layout: three ages of one pyjama page, one blanket, one sold-out page.
  const head = 'advertiser_id,advertiser_name,id,title,link,image_link,google_product_category,gtin,brand,availability,price,sale_price,item_group_id';
  const row = (id, title, handle, avail, price) => `120435,Pixie Dixie,${id},"${title}",https://pixiedixie.co.uk/products/${handle}?variant=${id},https://cdn.shopify.com/x/${handle}.jpg,,,Pixie Dixie,${avail},${price} GBP,,`;
  writeFileSync(join(archive, '120435-retail-en_GB.csv'), [head,
    row(1, 'Star Crew Neck Pyjamas - 1-2yrs / Star / White', 'star-pyjamas', 'in_stock', '30.00'),
    row(2, 'Star Crew Neck Pyjamas - 3-4yrs / Star / White', 'star-pyjamas', 'in_stock', '28.00'),
    row(3, 'Star Crew Neck Pyjamas - 5-6yrs / Star / White', 'star-pyjamas', 'out_of_stock', '20.00'),
    row(4, 'Star Blanket - one size / Star / White', 'star-blanket', 'in_stock', '25.00'),
    row(5, 'Moon Nightdress - 5-6yrs / Moon / White', 'moon-nightdress', 'out_of_stock', '28.00')].join('\n') + '\n');
  const r = await planLegacyImport({ archive, retailer: 'pixiedixie', outDir: join(root, 'plan'), now: new Date('2026-11-12T20:00:00Z') });
  const cards = r.accepted.kgw.map(p => [p.product_name, p.price, p.subcategory, p.currency]).sort();
  assert.deepEqual(cards, [['Star Blanket', 25, 'Receiving Blankets', 'GBP'], ['Star Crew Neck Pyjamas', 28, 'Nightwear & Loungewear', 'GBP']]);
  assert.equal(r.rejected['out of stock in every size'].length, 1);
  assert.ok(r.accepted.kgw.every(p => /^https:\/\/www\.awin1\.com\/cread\.php\?awinmid=120435&/.test(p.affiliate_url) && !/variant/.test(decodeURIComponent(p.affiliate_url))));
});

test('CAT Footwear: one card per boot without the style number; women to WGW, bags to MGW', () => {
  assert.equal(cat.displayName('Colorado 2.0 P726503 Icon Mens Black Boots'), 'Colorado 2.0 Icon Black Boots');
  assert.equal(cat.displayName('Colorado 2.0 Dark Beige Boots - Dark Beige'), 'Colorado 2.0 Dark Beige Boots');
  assert.equal(cat.displayName('Second Shift P70043 Black Full Grain Boots -UK EXCLUSIVE'), 'Second Shift Black Full Grain Boots');
  assert.equal(cat.displayName('CAT BLACK PLOWING BACKPACK - Black'), 'CAT Black Plowing Backpack');
  assert.deepEqual(cat.classify({ name: 'Rewrite Harness P312299 Womens Leather Nuthatch Boots', feedCategory: 'Boots' }), { site: 'wgw', siteCategory: 'Shoes', subcategory: 'Boots' });
  assert.equal(cat.classify({ name: 'Intruder P110463 Black Out Unisex Trainers', feedCategory: 'Shoes' }).site, 'mgw');
  assert.equal(cat.classify({ name: 'Intruder P110463 Black Out Unisex Trainers', feedCategory: 'Shoes' }).subcategory, 'Trainers');
  assert.equal(cat.classify({ name: 'Giles Black Sandals', feedCategory: 'Sandals' }).subcategory, 'Sandals');
  assert.deepEqual(cat.classify({ name: 'CAT BLACK UNITED CROSSBODY - Black', feedCategory: '' }), { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Bags' });
});

test('Buy Sheds Direct: garden buildings by the shop category, kennels and swings left out', () => {
  const c = (name, feedCategory) => sheds.classify({ name, feedCategory });
  assert.equal(c("6' x 8' Trimetals Titan 680 Apex Metal Shed", 'Metal Sheds').subcategory, 'Sheds');
  assert.equal(c('Palmako Irene 4.7m x 5.7m Log Cabin Garden Building (44mm)', 'Log Cabins').subcategory, 'Summerhouses & log cabins');
  assert.equal(c('Log Cabin Base Kit', 'Log Cabin Base').subcategory, 'Shed bases & accessories');
  assert.equal(c('Shire Log Cabin Garage', 'Log Cabin Garages').subcategory, 'Garages & workshops');
  assert.equal(c("9x6 Trimetals 'Protect a Bike' Secure Garden Storage", 'Bike Storage').subcategory, 'Garden storage');
  assert.equal(c("10' x 12' Palram Canopia Balance Greenhouse", 'Greenhouses').subcategory, 'Greenhouses');
  assert.deepEqual(c('3m x 3m Wooden Gazebo', 'Wooden Gazebos'), { site: 'ggw', siteCategory: 'Garden Furniture & Outdoor Living', subcategory: 'Parasols, gazebos & shade' });
  assert.equal(c('Forest Trellis Wooden Garden Planter', 'Planters').siteCategory, 'Plants, Growing & Garden Care');
  assert.equal(c('Forest 6x6 Lap Fence Panel', 'Pressure Treated Lap Panels').subcategory, 'Fencing & screening');
  assert.ok(c('Traditional Pent Wooden Dog Kennel - Pet House', 'Pet House').reject);
  assert.ok(c('Kids Wooden Double Garden Swing', 'Kids Swings and Slides').reject);
  assert.equal(c('Decking Tiles 60x60cm (Pack of 4)', '').doubt, true, 'placed by the name only: listed for checking');
  assert.equal(sheds.RULES.maxPrice, 20000, 'log cabins cost thousands');
});

test('Fila: women and kids by name and style code, the rest to MGW; a "baby tee" is a women\'s top', () => {
  const page = h => `https://fila.co.uk/products/${h}?variant=1`;
  const c = (name, h, g = '') => fila.classify({ name, url: page(h), feedCategory: g });
  assert.deepEqual(c('Venter Chino Shorts', 'venter-chino-shorts-s22mh040-410'), { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Shorts' });
  assert.equal(c('Blue Tennis Essential A-Line Skirt', 'tennis-essential-a-line-skirt-tw31e370-492').site, 'wgw');
  assert.equal(c('Loligo Trainer', 'loligo-trainer_ffw0296-40064', 'Clothing & Accessories > Shoes').site, 'wgw');
  assert.equal(c('Heidi Cropped Roll Neck Top', 'heidi-cropped-roll-neck-fw24wh001-100').site, 'wgw');
  assert.equal(c('Off White Women’s Mesh Jersey Dress', 'mesh-jersey-dress-tw24d001-104').subcategory, 'Dresses');
  assert.equal(c("Junior's Heritage T-Shirt Logo", 'juniors-heritage-t-shirt-logo-fjl131020-001').site, 'kgw');
  assert.equal(c('Fila White Baby Tee', 'baby-tee-ss24wh002-100').site, 'wgw');
  assert.equal(c('Fila Black Baby Tee', 'baby-tee-ss24xh002-001').site, 'wgw', 'a baby tee is a women\'s top whatever the code');
  assert.equal(c('White Backspin Tennis Short Sleeve Top', 'backspin-tennis-top-tm33d706-109').subcategory, 'T-Shirts');
  assert.equal(c('Black BB Slider', 'bb-slider-1sm00001-001').subcategory, 'Sandals');
  assert.deepEqual(c('Hylo Baseball Cap', 'hylo-cap-fhxf9001-001'), { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Hats' });
  assert.ok(c('Peacoat Turn It Up (Wireless Speaker Gift Set)', 'gift-set-xf24001-001').reject);
  assert.equal(fila.styleCode(page('loligo-trainer_ffw0296-40064')), 'ffw0296');
  assert.equal(fila.displayBrand('FILA tennis'), 'FILA Tennis');
});

test('Homespace Direct, Extreme Comfort and Pixie Dixie: home textiles and decor to HGW, soft toys and kids nightwear to KGW', () => {
  const h = name => home.classify({ name, feedCategory: '' });
  assert.deepEqual(h('Planet B Duvet Cover Set - Multi'), { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bed Linen' });
  assert.equal(h('Chatsworth 100% Cotton Towels').subcategory, 'Towel');
  assert.equal(h('Luxury Egyptian Bath Sheet').subcategory, 'Towel', 'a bath sheet is a towel, not a bed sheet');
  assert.equal(h('Madrid Wine Eyelet Curtains').subcategory, 'Curtain');
  assert.equal(h('Chevronne Ceramic Lamp Shade').subcategory, 'Lampshade');
  assert.equal(h('Milestones Sandalwood Candle').subcategory, 'Home Fragrance');
  assert.equal(h('Laurel Leaf Spray').reject, 'no clear place on Home Gear World', 'artificial foliage, not a room spray');
  assert.equal(h('Teddy Bear Fleece Duvet Cover Set').site, 'hgw', 'teddy-print bedding is bedding');
  assert.deepEqual(h('Benny The Plush Long Leg Teddy Bear 30cm'), { site: 'kgw', siteCategory: 'Toys & Games', subcategory: 'Stuffed Animals & Cuddly Toys' });
  assert.ok(h('Harvey Makin Classic Hip Flask 5.5oz').reject);
  assert.ok(h('Amalfi Collection Outdoor Bistro Table With Glass Top').reject);
  assert.equal(home.classify({ name: 'Broken Stripe Beige', feedCategory: 'Home & Garden > Decor > Rugs' }).subcategory, 'Rug');
  assert.equal(home.displayBrand('Your Brand'), 'Homespace Direct');
  assert.equal(home.displayName('200TC H/W pcase each Cream - Pair / Cream'), '200TC Housewife Pillowcase each Cream');
  assert.equal(ec.classify({ name: 'Diamond Cooltouch Plush Innerspring Mattress', feedCategory: 'Furniture > Beds & Accessories > Mattress Foundations' }).subcategory, 'Mattress');
  assert.equal(ec.classify({ name: '8" Deep Coolmax Zipper cover All-foam Mattress', feedCategory: '' }).subcategory, 'Mattress');
  assert.equal(ec.classify({ name: 'Memory Foam Topper without Cover', feedCategory: '' }).subcategory, 'Mattress Topper');
  assert.equal(ec.classify({ name: 'Space Saving Ultimate Storage Black Ottoman Bed', feedCategory: '' }).subcategory, 'Bed Frame');
  assert.equal(pd.classify({ name: 'Animal Sleepsuit' }).subcategory, 'Baby & Toddler Sleepwear');
  assert.equal(pd.classify({ name: 'Unicorn Nightdress' }).subcategory, 'Nightwear & Loungewear');
});

test('new shops use the subcategory names the sites already have (dry run of 12 Nov 2026, lessons L56)', () => {
  assert.deepEqual(sheds.classify({ name: 'Forest Compact Composter 330L', feedCategory: 'Composters' }), { site: 'ggw', siteCategory: 'Garden Tools', subcategory: 'Composters' });
  assert.equal(home.classify({ name: 'Otto The Plush Lilac Octopus 30 cm', feedCategory: '' }).subcategory, 'Stuffed Animals & Cuddly Toys');
});

test('Tooled Up plumbing tools: Construction Gear World Hand Tools, add-only, the plumbing feed only', async () => {
  const tup = await import('../../tools/import-rules/tooledup-plumbing.mjs');
  assert.deepEqual(tup.classify({ name: 'Monument Autocut Copper Pipe Cutter', feedCategory: 'Pipe Cutters' }), { site: 'cgw', siteCategory: 'Hand Tools', subcategory: 'Plumbing Tools' });
  assert.equal(tup.classify({ name: 'Monument Olive Puller', feedCategory: 'Olive Removing Tools' }).subcategory, 'Plumbing Tools');
  assert.ok(tup.classify({ name: 'Tooled Up Gift Card', feedCategory: '' }).reject);
  assert.equal(tup.RULES.addOnly, true, 'the other 36,000 Tooled Up products on CGW must stay');
  const dir = mkdtempSync(join(tmpdir(), 'gw-tup-'));
  for (const id of [118685, 118686, 89987]) writeFileSync(join(dir, `AWIN_496_${id}.csv.gz`), '');
  assert.deepEqual(tup.feedFiles(dir), [join(dir, 'AWIN_496_118685.csv.gz')]);
});

test('import SQL: one picture per card, and no statement over 90 KB (House of Sneakers on MGW, 12 Nov 2026)', async () => {
  const { realImage, insertSqlLimited, MAX_STATEMENT_BYTES } = await import('../../tools/legacy-import-plan.mjs');
  assert.equal(realImage('https://cdn.shopify.com/a/00_png.png?v=1,https://cdn.shopify.com/a/01_jpg.jpg?v=2,https://cdn.shopify.com/a/02.jpg'), 'https://cdn.shopify.com/a/00_png.png?v=1');
  assert.equal(realImage('https://cdn.shopify.com/a/x.jpg?w=1,2'), 'https://cdn.shopify.com/a/x.jpg?w=1,2', 'a comma inside one link stays');
  const row = i => ({ awin_product_id: `1:${i}`, merchant_product_id: String(i), retailer: 'Shop', site_category: 'Shoes', subcategory: 'Trainers', brand: 'B',
    product_name: 'N', feed_product_name: 'N', price: 10, currency: 'GBP', stock_status: 'in stock', merchant_category: null,
    image_url: 'https://cdn.example/' + 'x'.repeat(1500), affiliate_url: 'https://www.awin1.com/cread.php?x', ean: null });
  const sql = insertSqlLimited(Array.from({ length: 80 }, (_, i) => row(i)), '2026-11-12 21:00:00', { site: 'mgw' });
  const statements = sql.split(/;\n/).filter(x => x.trim());
  assert.ok(statements.length > 1, 'split into several statements');
  for (const st of statements) assert.ok(Buffer.byteLength(st, 'utf8') <= MAX_STATEMENT_BYTES);
  assert.equal((sql.match(/'1:\d+'/g) || []).length, 80, 'every row is still there');
});
