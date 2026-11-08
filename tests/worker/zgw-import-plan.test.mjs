// Pets Gear World import plan (dry run): ZGW rules on fake feeds, the approved shops of the pets feed scan
// (1 Nov 2026), and the look-alikes of that scan out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planZgwImport } from '../../tools/zgw-import-plan.mjs';
import { classify, cleanProductName, CATEGORY_SLUGS, QUALITY } from '../../sites/zgw/category-rules.js';
import site from '../../sites/zgw/site.config.js';

const slug = (n, c = '') => classify(cleanProductName(n), c, c).slug;
const ok = (n, c = '') => classify(cleanProductName(n), c, c).ok;
const PET = 'Animals & Pet Supplies > Pet Supplies';

test('ZGW rules put real products of the pets feed scan (1 Nov 2026) in the right category', () => {
  for (const [name, c, s] of [
    ['Dreamies Mix Cat Treat Biscuits with Chicken & Duck 60g', `${PET} > Cat Supplies`, 'food'],
    ['Harringtons Puppy Rich in Turkey & Rice 1.7kg', `${PET} > Pet Food Supplies`, 'food'],
    ['Good Boy Pork and Hide Twisters 60g', `${PET} > Dog Supplies`, 'food'],
    ['Feandrea Cat Tree, 2 Cat Caves, 68x48x101cm, Smoky Grey', `${PET} > Cat Supplies`, 'cats'],
    ['Pawise Reversible Cat Scratcher 35cm', `${PET} > Cat Supplies`, 'cats'],
    ['Itch Flea & Tick Spot-On Treatment For Medium Dogs (10-20kg) 2 Pipettes', `${PET} > Dog Supplies`, 'grooming'],
    ['Good Boy Soft Dog Toy', `${PET} > Dog Supplies`, 'toys'],
    ['Mason Cash Colour Mix Grey Dog Bowl 20cm', `${PET} > Dog Supplies`, 'feeding'],
    ['pecute Slow Feeder Bowl (Size M) - Blue', `${PET} > Dog Supplies`, 'feeding'],
    ['Rosewood Large Dog Bed 81 x 63 x 18cm', `${PET} > Dog Supplies`, 'beds-crates'],
    ['CoA Halti Headcollar Size 2 Black', `${PET} > Dog Supplies`, 'walking'],
    ['Ancol Timberwolf Leather Collar Sable 35cm', `${PET} > Dog Supplies`, 'walking'],
    ['Pecute Pet Backpack, Large, Expandable, for Cats up to 11 kg or Dogs up to 10 kg', `${PET} > Dog Supplies`, 'travel'],
    ['Hunter Uppsala Extreme Dog Coat - Size 50', 'Household', 'walking'],
    ['Barbour Harley Quilted Dog Coat', 'Gifts', 'walking'],
    ['Barbour Dog Small Quilted Carrier', 'Gifts', 'travel'],
    ['Equestrian Saddle Pad Navy', '', 'horse']
  ]) assert.equal(slug(name, c), s, name);
});

test('ZGW rules leave out children\'s toys, people\'s clothing, vacuums and look-alikes', () => {
  for (const [name, c] of [
    ['Paw Patrol Chase Plush 20cm', 'Toys'],
    ['Keel Toys Soft Cuddly Rabbit - White', 'Toys'],
    ['Hoover HF4 Cordless Stick Vacuum Cleaner with Pet Tool - 30 Minute Run', 'Home'],
    ['Mens Dog Walking Jacket Waterproof', 'Menswear'],
    ['Halloween Cat Cufflinks Luxury Gift Bag', 'Cufflinks'],
    ['FDL IP68 RATED CAT.6A WEATHERPROOF ENCLOSURE BOX', 'Default Category>PC Components>Other'],
    ['Dassy Stretch-Arbeitshose Hong Kong PESCO41 201099', ''],
    ['Palmolive Aquarium Hand Soap 300ml', 'Household']
  ]) assert.equal(ok(name, c), false, name);
});

test('11 categories (birds with subcategories and horse and riding, owner 1 Nov 2026), prices in pounds only', () => {
  assert.deepEqual(CATEGORY_SLUGS, ['beds-crates', 'walking', 'toys', 'food', 'cats', 'grooming', 'feeding', 'travel', 'small-pets', 'birds', 'horse']);
  assert.deepEqual(QUALITY.currencies, ['GBP']);
  assert.deepEqual(CATEGORY_SLUGS, site.categories.map(c => c.slug), 'the same order as the site menu');
});

test('sources: Joybuy, Plusshop, Bazta, Coes and Aquatics Shop UK; Red Gorilla and VEVOR off; no text of another site', () => {
  const text = readFileSync('sites/zgw/sources.json', 'utf8');
  const src = JSON.parse(text).sources;
  assert.deepEqual(src.filter(s => s.approved).map(s => s.retailer), ['Joybuy', 'Plusshop UK', 'Bazta UK', 'Coes', 'Aquatics Shop UK', 'Pets Calm Down']);
  assert.equal(src.find(s => s.retailer === 'Aquatics Shop UK').aquatics, true, 'its live fish stay out (L90)');
  assert.equal(src.find(s => s.retailer === 'Bazta UK').rulesFrom, 69306);
  assert.equal(src.find(s => s.retailer === 'Red Gorilla').approved, false);
  assert.equal(src.find(s => s.retailer === 'VEVOR').approved, false);
  assert.doesNotMatch(text, /Gaming|Biker|gaminggearworld|bikergearworld/i, 'lessons L01');
});

test('plan: ZGW products in, children\'s toys and out-of-stock rows out, SQL not executed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'zgw-plan-'));
  const a = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(a);
  const out = join(dir, 'out');
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean\n';
  const link = (p, m) => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=${m}`;
  writeFileSync(join(a, 'AWIN_123932_114093.csv.gz'), gzipSync(head
    + `${link(1, 123932)},Harringtons Puppy Rich in Turkey & Rice 1.7kg,1,J-1,https://img.example/1.jpg,${PET} > Pet Food Supplies,5.25,GBP,Harringtons,1,\n`
    + `${link(2, 123932)},Feandrea Cat Tree with 2 Cat Caves Smoky Grey,2,J-2,https://img.example/2.jpg,${PET} > Cat Supplies,49.99,GBP,Feandrea,1,\n`
    + `${link(3, 123932)},Paw Patrol Chase Plush 20cm,3,J-3,https://img.example/3.jpg,Toys & Games > Toys,12,GBP,Paw Patrol,1,\n`
    + `${link(4, 123932)},Rosewood Large Dog Bed 81 x 63 x 18cm,4,J-4,https://img.example/4.jpg,${PET} > Dog Supplies,20.39,GBP,Rosewood,0,\n`));
  const sources = join(dir, 'sources.json');
  writeFileSync(sources, JSON.stringify({ sources: [{ advertiserId: 123932, feedIds: [114093], retailer: 'Joybuy', currency: 'GBP', approved: true }] }));
  const { stats, report } = await planZgwImport({ archive: a, sourcesFile: sources, outDir: out, now: new Date('2026-11-01T20:00:00Z') });
  assert.equal(stats.rows, 4);
  assert.equal(stats.accepted, 2);
  assert.equal(stats.perCategory.food, 1);
  assert.equal(stats.perCategory.cats, 1);
  assert.equal(stats.rejected['out of stock'], 1);
  assert.match(report, /ZGW IMPORT PLAN/);
  const sql = readFileSync(join(out, 'sql', readdirSync(join(out, 'sql')).find(f => f === '0001.sql')), 'utf8');
  assert.match(sql, /-- ZGW import plan .* NOT executed/);
});

test('fixes after the first dry run (1 Nov 2026): human food, adult, camera, toy and clothing sections; "chicken" alone', () => {
  const food = 'Food, Beverages & Tobacco > Food Items > Pasta & Noodles';
  for (const [n, c] of [
    ['Master Kong Classic Bucket Noodles - Scallion & Pork Flavor 109g x 12', food],
    ['Korean Street Chicken Ramen Korean Chicken Flavour Bowl 112g', food],
    ['HANSS Kitten Paw-Shaped Shrimp Ball 200g/Pack', 'Food, Beverages & Tobacco > Food Items > Frozen Desserts'],
    ['Birds Eye 2 Southern Fried Chicken in Breadcrumbs 180g', 'Food, Beverages & Tobacco > Food Items > Meat'],
    ['Chicken Shawarma Recipe Kit', 'Gifts'],
    ['Master Series Sugar Kitty Collar - Pink', 'Intimate play'],
    ['CINMOORE 3K Security Camera Indoor, AI Person/Pet/Cry Detection', 'Cameras & Optics > Cameras > Surveillance Cameras'],
    ['Magical Kingdom Style N Go Unicorn Pony With Comb Toy', 'Dolls & accessories'],
    ['VTech Pull Along Puppy Pal Toy', 'Activities & play time'],
    ['Clementoni Harry Potter Hagrid\'s Hut Terrarium', 'Toys & Games > Toys > Educational Toys'],
    ['G. H. Bass Panama Horse Bit Lincoln Saddle Bar Penny Loafers', 'Menswear'],
    ['OYAJIA Chamber Air Fryer', 'Home & Garden > Kitchen & Dining > Kitchen Appliances'],
    ['Peter Rabbit Comfort Blanket', 'Baby & Toddler > Baby Toys'],
    ['XLLX Long Hot Water Bottle 1.8L Soft Artificial Rabbit Fur Cover', 'Home & Garden > Household Supplies'],
    ['JORDAN&JUDY Cleaning Brush, 2-Pack, PP+PET, Long Handle', 'Home & Garden > Household Supplies'],
    ['Mushroom Plant Terrarium, Set of 10 Unique Propagation Station', 'Home & Garden > Decor']
  ]) assert.equal(ok(n, c), false, n);
  for (const [n, c, s] of [
    ['Bakers Meaty Meals Chicken Dry Dog Food 2.7kg', `${PET} > Pet Food Scoops`, 'food'],
    ['Whiskas 1+ Poultry Feasts Adult Wet Cat Food Pouches in Jelly 12 x 85g', `${PET} > Cat Supplies > Cat Food`, 'food'],
    ['Good Boy Pigs in Blankets 60g', `${PET} > Pet Food Scoops`, 'food'],
    ['HomerunPET 135L Deluxe Edition Pet Dryer, PD135, Salon-Grade Drying', `${PET} > Pet Grooming Supplies > Pet Hair Dryers`, 'grooming'],
    ['Barbour Dog Small Quilted Carrier', 'Womenswear', 'travel'],
    ['Hunter Tambo Dog Toy - Whale', 'Household', 'toys'],
    ['Omlet Eglu Cube Chicken Coop', '', 'birds']
  ]) assert.equal(slug(n, c), s, n);
});

test('second dry run (1 Nov 2026): the pet shop section decides when the name has no category word, and no other site takes it', () => {
  for (const [n, c, s] of [
    ['JW Hol-ee Roller Size 3.5', `${PET} > Dog Supplies > Dog Toys`, 'toys'],
    ['Encore Pâté Selection 5 x 150g', `${PET} > Dog Supplies > Dog Food`, 'food'],
    ['Sotnos Colour Block Red & Pink Sweater XS', `${PET} > Pet Apparel`, 'walking'],
    ['pecute Built-in Frame Series Daily Pet Handbag - Dark Grey', `${PET} > Cat Supplies > Cat Carriers`, 'travel'],
    ['Carefresh Tutti Frutti Small Animal Bedding 10L', `${PET} > Small Animal Supplies > Small Animal Bedding`, 'small-pets'],
    ['House of Paws Chocolate Dipped Strawberry Plush Toy', `${PET} > Dog Supplies > Dog Toys`, 'toys'],
    ["Willit Women's Riding Pants Full Seat Silicone Breeches Equestrian", 'Sporting Goods > Outdoor Recreation > Equestrian', 'horse']
  ]) assert.equal(slug(n, c), s, n);
  assert.equal(ok('Hoover HF4 Cordless Stick Vacuum Cleaner with Pet Tool', 'Home & Garden > Kitchen & Dining > Kitchen Appliances'), false);
});

test('birds (owner, 1 Nov 2026): one category with a subcategory per kind of bird; chicken-flavoured pet food stays food', () => {
  const sub = (n, c = '') => classify(cleanProductName(n), c, c).sub;
  for (const [n, c, s] of [
    ['Omlet Eglu Cube Chicken Coop', '', 'Chickens & Poultry'],
    ['Layers Pellets 20kg', '', 'Chickens & Poultry'],
    ['Sealey Poultry Feeder 6kg Pack of 2', 'Garden Tools', 'Chickens & Poultry'],
    ['Classic De Luxe Canary Cage', '', 'Canaries & Finches'],
    ['RIO Eggfood for Budgies and Other Small Birds 250g', `${PET} > Bird Supplies > Bird Food`, 'Budgies & Parrots'],
    ['Parrot Rope Perch Large', '', 'Budgies & Parrots'],
    ['Bird Cage with Stand', '', 'Other Cage Birds']
  ]) {
    assert.equal(slug(n, c), 'birds', n);
    assert.equal(sub(n, c), s, n);
  }
  const birds = site.categories.find(c => c.slug === 'birds');
  for (const s of ['Chickens & Poultry', 'Canaries & Finches', 'Budgies & Parrots', 'Other Cage Birds']) assert.ok(birds.subcategories.some(x => x.name === s), `${s} is in the site config`);
  assert.equal(slug('Bakers Meaty Meals Chicken Dry Dog Food 2.7kg', `${PET} > Pet Food Scoops`), 'food');
  assert.equal(slug('Whiskas 1+ Poultry Feasts Adult Wet Cat Food Pouches', `${PET} > Cat Supplies > Cat Food`), 'food');
  assert.equal(slug('Outdoor Dog Kennel Wooden', ''), 'beds-crates', 'outdoor kennels are with the beds and kennels');
  assert.equal(ok('Wild Bird Feeder Station', 'Garden'), false, 'wild birds stay on Garden');
  assert.equal(slug("Willit Women's Riding Pants Full Seat Silicone Breeches Equestrian", 'Sporting Goods > Outdoor Recreation > Equestrian | Apparel & Accessories > Clothing'), 'horse');
});

test('test site of 1 Nov 2026: Richmond & Finch phone cases, a birdcage umbrella and "Poultry Feasts" cat food are not birds', () => {
  for (const [n, c] of [['Richmond & Finch White Marble iPhone 13 Cover', 'Gifts'], ['Richmond & Finch Wireless Charger', 'Gifts'], ['Fulton Umbrellas Birdcage White Umbrella', 'Gifts']]) assert.equal(ok(n, c), false, n);
  assert.equal(slug('Whiskas 1+ Poultry Feasts in Gravy 12 x 85g', `${PET} > Cat Supplies > Cat Food`), 'food');
  assert.equal(slug('Whiskas 1+ Poultry Feasts in Jelly 40 x 85g', ''), 'food', 'cat food by its brand, even without the cat section');
  assert.equal(slug('Bucktons Budgerigar Food with Spirulina 500g', `${PET} > Bird Supplies`), 'birds');
  assert.equal(slug('Zebra Finch Seed Mix 1kg', ''), 'birds');
});

test('Aquatics Shop UK (approved 2 Nov 2026): aquarium and pond products in, its live fish never (L90)', () => {
  const aq = { aquatics: true };
  const s = n => { const r = classify(n, '', '', aq); return r.ok ? r.slug : r.reason; };
  // Names from the shop's own catalogue (fishcaveaquatics.co.uk, 2 Nov 2026).
  for (const n of ['Tetra Easy Balance - Available In 3 Sizes', 'Fluval Aquasky 2.0 Bluetooth LED, 16W, up to 32.5″ / 83 cm', 'Fish Science Mini Algae Wafers 45g',
    'Clearseal Aura 250 Aquarium Set', 'Oase Heatup 200 31.5cm', 'Seachem Purigen', 'Tetra Test 6 in 1 Water Test Kit (25 Strips)', 'NT Labs Winter Pond Food 190g',
    'Betta Choice 6" Pink Fern Foregrounder', 'Classic Plane Wreckage 4446', 'Hikari Shrimp Cuisine 10g', 'Dennerle Shrimp King 5 in 1 Pack', 'Juwel SmartFeed 2.0 - Premium Automatic Feeder']) {
    assert.equal(s(n), 'small-pets', n);
  }
  for (const n of ['Neon Tetra - Paracheirodon Innesi', 'Blue Orfe 4-5 Inch', 'Thai Silk Flowerhorn -  4 Inches', 'Cherry Red Shrimp - Neocardina Denticulata',
    'Blueberry Snail - Viviparus sp', 'True Parrot Cichlid', 'Gold Base Hybrid Vieja 5-6 inches', 'Golden Nugget 10cm', 'King Tiger Plec L066',
    'Mixed Colour Vampire Crab - Geosesarma sp', 'Freshwater Golden Clam - Corbicula Fluminea', 'Jellybean Parrot Fish']) {
    assert.match(s(n), /live animal/, n);
  }
  assert.equal(classify('test product', '', '', aq).ok, false);
  assert.equal(classify('Custom Order', '', '', aq).ok, false);
  // Other shops keep the general rules: a parrot cage is still a bird product.
  assert.equal(classify('Large Parrot Cage with Stand', 'Pet Supplies > Birds', '', null).slug, 'birds');
});
