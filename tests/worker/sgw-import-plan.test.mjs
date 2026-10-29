// Sporty Gear World import plan (dry run): SGW rules on fake feeds, only the shops' sport sections (L65), kids, tech,
// camping, safety shoes and non-sport supplements out, feeds in two folders (L41).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planSgwImport } from '../../tools/sgw-import-plan.mjs';
import { classify, cleanProductName, CATEGORY_SLUGS } from '../../sites/sgw/category-rules.js';
import site from '../../sites/sgw/site.config.js';

const slug = (n, c = 'Sports') => classify(cleanProductName(n), c, c).slug;
const ok = (n, c = 'Sports') => classify(cleanProductName(n), c, c).ok;

test('SGW rules put real-looking products in the right category (names from the sports feed scan, 25 Oct 2026)', () => {
  const cases = [
    ['Adjustable Dumbbell Set 20kg', 'Sporting Goods > Exercise & Fitness > Weight Lifting', 'fitness-gym'],
    ['6MM Print Yoga Mat 24" x 72" Full Pattern, Yoga Pilates Fitness and Floor Workout', 'Sporting Goods > Exercise & Fitness > Yoga', 'fitness-gym'],
    ['Everlast Boxing Gloves 12oz', 'Sports', 'fitness-gym'],
    ['Bodybuilding Lifting Belt Leather', 'Sports', 'fitness-gym'],
    ['VEVOR Pilates Reformer wall mount', 'Sport en buitenshuis > Fitness', 'fitness-gym'],
    ["Men's Running Shoes Lightweight", 'Sports', 'running'],
    ['Phone Armband for Running', 'Sports', 'running'],
    ['Hydration Vest 5L', 'Sports', 'running'],
    ['Falcon Horizon Low Step Electric Hybrid/Trekking Bike 17" Frame', 'Sporting Goods > Outdoor Recreation > Cycling > Bicycles', 'cycling'],
    ['Bike Phone Mount Handlebar', 'Sporting Goods > Cycling', 'cycling'],
    ['Adidas Predator League Football Boots', 'Sports', 'football-team-sports'],
    ['Adidas Adizero Lux 3 Hockey Shoes', 'Sports', 'football-team-sports'],
    ['High-Quality Rubber Basketball (29.5") Size 7#', 'Sporting Goods > Athletics > Basketball', 'football-team-sports'],
    ['NFL Official Game Ball', 'Sports', 'football-team-sports'],
    ['Gilbert Rugby Ball Size 5', 'Sports', 'football-team-sports'],
    ['Dunlop Tristorm Pro 100 Super Lite Tennis Racket', 'Sports', 'racket-sports'],
    ['NIUPIPO Pickleball Paddles Set of 2', 'Sporting Goods > Racquet Sports', 'racket-sports'],
    ['Inflatable Stand Up Paddle Board 10ft', 'Sports', 'water-sports'],
    ['Intex Swimming goggles', 'Sport & fitness', 'water-sports'],
    ['Kayak Paddle 2 piece', 'Sports', 'water-sports'],
    ['PELLIOT Outdoor Trekking Pole, 3K Carbon Fiber', 'Sporting Goods > Outdoor Recreation > Climbing', 'hiking-climbing-winter'],
    ['Salomon X Ultra 360 Mid Gore-tex Walking Boot', 'Sports', 'hiking-climbing-winter'],
    ['Ski Goggles OTG', 'Sports', 'hiking-climbing-winter'],
    ['Awesome Creatine', 'Sports', 'nutrition-hydration'],
    ['Whey Protein Powder 1kg Chocolate', 'Health & Beauty > Health Care > Fitness & Nutrition', 'nutrition-hydration'],
    ['Electrolyte Powder', 'Fitness Equipment', 'nutrition-hydration'],
    ['Brushed Steel Sports Bottle', 'Fitness Equipment', 'nutrition-hydration'],
    ["Under Armour Edge Suede Men's Training Shoes - Khaki", 'Sporting Goods > Athletics', 'sportswear-shoes-bags'],
    ['Gym Bag Duffel 40L', 'Sports', 'sportswear-shoes-bags'],
    ['Sports Leggings High Waist', 'Sports', 'sportswear-shoes-bags'],
    ['Ben Sayers Push Golf Trolley Black', 'Sporting Goods > Outdoor Recreation > Golf', 'golf-skate-more'],
    ['ECOODA Carbon Sea Bass Rod, Freshwater Fishing Rod', 'Sporting Goods > Outdoor Recreation > Fishing', 'golf-skate-more'],
    ['Hy-Pro Dartboard Apex Professional', 'Sporting Goods > Indoor Games', 'golf-skate-more']
  ];
  for (const [name, cat, s] of cases) assert.equal(slug(name, cat), s, name);
});

test('SGW rules send other sites\' products away and keep look-alikes out (approved rules, 25 Oct 2026)', () => {
  for (const [name, cat] of [
    ['Kids Football Boots', 'Sports'],
    ['Junior Tennis Racket 23"', 'Sports'],
    ['OutdoorMaster Ibex Youth & Kids Bike Helmet - for Balance Bike', 'Sporting Goods > Cycling'],
    ['Mens Swim Shorts Quick Dry', 'Sports'],
    ['adidas Originals SPRT Swim Shorts - Black | Size: XS', 'General Clothing'],
    ['Apple Watch Series 11 GPS 46mm', 'Electronics'],
    ['Garmin Forerunner 265 GPS Running Watch', 'Sports'],
    ['Shokz OpenRun Sports Headphones', 'Sports'],
    ['Nokia 3210 4G TA-1618 DS GBIE SCUBA Blue', 'Sporting Goods > Water Sports'],
    ['IM-CHEN iPhone 18 Pro Case,Compatible17pro Skin-Friendly', 'Sporting Goods > Outdoor Recreation > Cycling'],
    ['Milestone Camping Tent Pegs Heavy Duty', 'Sporting Goods > Outdoor Recreation > Camping'],
    ['Thule Towbar Bike Rack 3 Bikes for Cars', 'Sports'],
    ['10ft Trampoline with Safety Net', 'Sports'],
    ['Portwest Steelite Tove Safety Trainers Black', 'Workwear'],
    ['Barbie Career Tennis Player Doll', 'Sport & fitness'],
    ['Swim Essentials Pink Panther Swim Ball 51cm', 'Sport & fitness'],
    ["Higher Nature Rekindle for Women Vegan Women's Health Support Capsules - 60 Caps", 'Health & Beauty > Health Care > Fitness & Nutrition'],
    ['NOW Foods Red Clover Womens Health 375mg', 'Health & Beauty > Health Care > Fitness & Nutrition'],
    ['Vitamin D3 Tablets', 'Health & Beauty > Health Care > Fitness & Nutrition'],
    ['Draper Adjustable Bench Grinder Stand', 'Sports'],
    ['Philip Jones 18k Gold Plated Tennis Bangle', 'Jewellery'],
    ['Draper INV160A 160Amp MMA Inverter Welder 240v', 'Welding Tools'],
    ['Wikus Bandsägeblatt MARATHON M42 2700 x 27 x 0,9', 'Werkzeug']
  ]) assert.equal(ok(name, cat), false, name);
});

test('dry-run fixes (25 Oct 2026): shops whose sections are unreliable are sorted by the product name only', () => {
  // Coes: every sport product has the Awin category "Fitness"; Joybuy: sub-sections are often wrong (sources.json "sectionHints": false).
  const coes = { sectionHints: false };
  const at = (n, c, src = coes) => classify(cleanProductName(n), c, c, src);
  for (const [name, cat, s] of [
    ['Adidas F50 Club Firm/Multi Ground Boots', 'Sports Fitness', 'football-team-sports'],
    ['Grays Anatomic Pro Glove L/H', 'Sports Fitness', 'football-team-sports'],
    ['Kookaburra Ghost 5.1 Right Hand Batting Pads', 'Sports Fitness', 'football-team-sports'],
    ['Adidas 22yds Spikeless', 'Sports Fitness', 'football-team-sports'],
    ['Adidas Lux Shinguard', 'Sports Fitness', 'football-team-sports'],
    ['Ronhill Tech Short Sleeve Tee M', 'Sports Fitness', 'running'],
    ['ON Cloudmonster 3 Men', 'Sports Fitness', 'running'],
    ['Brooks Ghost 17', 'Sports Fitness', 'running'],
    ['Head Hydrosorb Grip', 'Sports Fitness', 'racket-sports'],
    ['K-Swiss Hypercourt Skirt 3', 'Sports Fitness', 'racket-sports'],
    ['Speedo Biofuse Ear Plug', 'Sports Fitness', 'water-sports'],
    ['Hoka Kaha 3 Gtx M', 'Sports Fitness', 'hiking-climbing-winter'],
    ['Awesome Endure', 'Sports Fitness', 'nutrition-hydration'],
    ['Adidas Graphic Tee', 'Sports Fitness', 'sportswear-shoes-bags'],
    ['1000 Mile Fusion Walk Socks in Charcoal', 'Sports Fitness', 'sportswear-shoes-bags'],
    ['Applied Nutrition ABE White Pre Workout Energy Drink Natural - 12 x 330ml', 'Health & Beauty > Health Care > Fitness & Nutrition', 'nutrition-hydration'],
    ['SPORTSOUL 40" & 48" Folding Mini Fitness Indoor Exercise Workout Rebounder Trampoline with Handle', 'Sporting Goods > Exercise & Fitness', 'fitness-gym'],
    ['Lichico Under Desk Fitness Walking Pad Treadmill with 9% Incline, Running Machine for Home Exercise', 'Sporting Goods > Exercise & Fitness', 'fitness-gym'],
    ['Adidas 4.7" Sports bracelet', 'Training accessories', 'running'],
    ['OutdoorMaster wheeled golf club travel bag, gray, thickened design', 'Sporting Goods > Outdoor Recreation > Cycling', 'golf-skate-more']
  ]) assert.equal(at(name, cat).slug, s, name);
  for (const [name, cat] of [
    ['Adidas Runfalcon 5 J Trainers', 'Sports Fitness'],
    ['Adidas Duramo Sl2 El C Trainers', 'Sports Fitness'],
    ['Adidas Colourblock Swim Boxers', 'Sports Fitness'],
    ['Awesome Defence Multi Vitamin', 'Sports Fitness'],
    ['Ray-Ban Wayfarer Sunglasses', 'Sports Fitness'],
    ['Elderberry Gummies', 'Fitness Equipment'],
    ['PELLIOT Outdoor Travel Toiletry Bag White', 'Sporting Goods > Outdoor Recreation > Camping & Hiking'],
    ['SUNCOJIA Foldable Cart with Wheels for Beach, Camping, Sports, Lightweight and Portable', 'Sporting Goods > Outdoor Recreation'],
    ['3M Safety Goggles 1623AF, 1 Pair', 'Sporting Goods > Athletics'],
    ['Kent and Stowe Sure and Fit Gloves Large', 'Sporting Goods > Athletics > Rounders'],
    ['Beneunder LC168, Lightweight Foldable Tote Bag 35L, Beige', 'Sporting Goods > Outdoor Recreation > Cycling > Unicycle Accessories']
  ]) assert.equal(at(name, cat).ok, false, name);
  // A shop with reliable sections (Plusshop, Bazta) still gets the second chance from its "Sport & fitness" section.
  assert.equal(classify('InShape Fitness Ball - Ø 65cm', 'Home > Sport & fitness', '').slug, 'fitness-gym');
  assert.equal(at('Capelli Sport STROBE LIGHT', 'Sporting Goods > Exercise & Fitness').ok, false);
});

test('sizes in product names are taken out, so each size is one card (owner\'s rule for duplicates)', () => {
  for (const [raw, clean] of [
    ["EU43 Li-Ning Men's RED HARE 9 ULTRA Racing Running Shoes", "Li-Ning Men's RED HARE 9 ULTRA Racing Running Shoes"],
    ['OutdoorMaster Cycling Gloves Orange XL', 'OutdoorMaster Cycling Gloves Orange'],
    ['Yoga sports set - Classic black - M', 'Yoga sports set - Classic black'],
    ['Yoga leggings - Mocha brown - EU M', 'Yoga leggings - Mocha brown'],
    ['DKONI HS-062 Adult Mountain Cycling Helmet Black/Orange M 54-58cm', 'DKONI HS-062 Adult Mountain Cycling Helmet Black/Orange'],
    ['PELLIOT Hiking Shoes Men Black EU41', 'PELLIOT Hiking Shoes Men Black'],
    ['PELLIOT Trail running shoes Women White 37', 'PELLIOT Trail running shoes Women White'],
    ['PELLIOT Running Shoes Unisex Lightweight, Obsidian Black (EU 43)', 'PELLIOT Running Shoes Unisex Lightweight, Obsidian Black'],
    ['ACTION,INLINE SKATE,PW-113 L', 'ACTION,INLINE SKATE,PW-113'],
    ['ACTION Inline Skating Helmet PW-903-PG, Size S', 'ACTION Inline Skating Helmet PW-903-PG'],
    ["Women's sports trousers Pink L size", "Women's sports trousers Pink"],
    // Kept: M means men's here, L is a capacity, Size 5 is a ball size.
    ['Ronhill Tech Short Sleeve Tee M', 'Ronhill Tech Short Sleeve Tee M'],
    ['Water Bottle 1 L', 'Water Bottle 1 L'],
    ['Gilbert Rugby Ball Size 5', 'Gilbert Rugby Ball Size 5']
  ]) assert.equal(cleanProductName(raw), clean, raw);
});

test('every site category has rules, and the menu order matches the site', () => {
  assert.deepEqual(CATEGORY_SLUGS, site.categories.map(c => c.slug));
});

test('sources: the first-wave shops are approved, VEVOR waits for the second wave, sport sections only (L65)', () => {
  const src = JSON.parse(readFileSync('sites/sgw/sources.json', 'utf8')).sources;
  const approved = src.filter(s => s.approved).map(s => s.retailer);
  assert.deepEqual(approved, ['Coes', 'Joybuy', 'Plusshop UK', 'Bazta UK', 'Beyond Shakers', 'Cronjager']);
  assert.equal(src.find(s => s.retailer === 'VEVOR').approved, false);
  for (const r of ['Coes', 'Joybuy']) assert.equal(src.find(s => s.retailer === r).sectionHints, false, r);
  // A shop's sport sections (allowPaths) or, for a marketplace of many brands, its sport brands (brands) decide first.
  for (const s of src.filter(x => x.approved && !x.rulesFrom && x.retailer !== 'Beyond Shakers')) {
    assert.ok((s.allowPaths && s.allowPaths.length) || (s.brands && s.brands.length), s.retailer);
  }
  // Cronjager has one feed per currency: only the GBP feed is read, so one card never mixes pounds and euros.
  const cj = src.find(s => s.retailer === 'Cronjager');
  assert.deepEqual(cj.feedIds, [95541]);
  assert.equal(cj.currency, 'GBP');
  assert.ok(!cj.brands.some(b => /irish army|english|remixd|my store|daytona/i.test(b)), 'no slogan merch, resold trainers or motorbike helmets');
});

test('plan: two archive folders, only the sport section of a shop, kids and tools out, SQL not executed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sgw-plan-'));
  const a = join(dir, 'GW_AWIN_BULK_ARCHIVE'), b = join(dir, 'GW_AWIN_NEW_20261023');
  mkdirSync(a); mkdirSync(b);
  const out = join(dir, 'out');
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean\n';
  const link = (p, m) => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=${m}`;
  writeFileSync(join(a, 'AWIN_30645_116078.csv.gz'), gzipSync(head
    + `${link(1, 30645)},Adidas Predator League Football Boots,1,C-1,https://img.example/1.jpg,Sports,85,GBP,Adidas,1,5051747000000\n`
    + `${link(2, 30645)},Adidas Junior Football Boots,2,C-2,https://img.example/2.jpg,Sports,45,GBP,Adidas,1,\n`
    + `${link(3, 30645)},Wool Overcoat Navy,3,C-3,https://img.example/3.jpg,Menswear,199,GBP,Coes,1,\n`
    + `${link(4, 30645)},Graphite Tennis Racket,4,C-4,https://img.example/4.jpg,Sports,60,GBP,Head,0,\n`));
  writeFileSync(join(b, 'AWIN_69306_89999.csv.gz'), gzipSync(head
    + `${link(5, 69306)},InShape Balance Board 39cm,5,P-1,https://img.example/5.jpg,Home > Sport & fitness,7.05,,InShape,1,\n`
    + `${link(6, 69306)},Febreze Car Air Freshener Teak,6,P-2,https://img.example/6.jpg,Home > Car & bike,2.79,,Febreze,1,\n`));
  const sources = join(dir, 'sources.json');
  writeFileSync(sources, JSON.stringify({ sources: [
    { advertiserId: 30645, feedIds: [116078], retailer: 'Coes', currency: 'GBP', approved: true, allowPaths: ['sports'] },
    { advertiserId: 69306, retailer: 'Plusshop UK', currency: 'GBP', approved: true, allowPaths: ['sport & fitness'] }
  ] }));
  const { stats, report } = await planSgwImport({ archive: `${a};${b}`, sourcesFile: sources, outDir: out, now: new Date('2026-10-25T21:00:00Z') });
  assert.equal(stats.rows, 6);
  assert.equal(stats.accepted, 2);
  assert.equal(stats.perCategory['football-team-sports'], 1);
  assert.equal(stats.perCategory['fitness-gym'], 1);
  assert.equal(stats.rejected['out of stock'], 1);
  assert.ok(Object.keys(stats.rejected).some(k => /kids/.test(k)));
  assert.ok(Object.keys(stats.rejected).some(k => /feed folder not on the consumer list/.test(k)));
  assert.match(report, /SGW IMPORT PLAN/);
  const sql = readFileSync(join(out, 'sql', readdirSync(join(out, 'sql')).find(f => f === '0001.sql')), 'utf8');
  assert.match(sql, /-- SGW import plan .* NOT executed/);
  assert.match(sql, /'Plusshop UK', 'fitness-gym'.*'GBP'/);
});

test('plan: Cronjager (one feed per currency, many brands) - only the GBP feed and only its sport brands (29 Oct 2026)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sgw-cj-'));
  const a = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(a);
  const out = join(dir, 'out');
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean\n';
  const link = p => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=98661`;
  const rows = cur => head
    + `${link(1)},AIXO Pastel De Mint Padel Racket Full Carbon,1,A-1,https://img.example/1.jpg,Badminton,${cur === 'GBP' ? 120 : 140},${cur},Aixo,1,\n`
    + `${link(2)},Mahee Tandem Kayak | Blue | Stable & Durable,2,F-1,https://img.example/2.jpg,General Clothing,${cur === 'GBP' ? 499 : 580},${cur},Fatyak Kayaks,1,\n`
    + `${link(3)},Beginnings Trace Chain Necklace,3,G-1,https://img.example/3.jpg,Cycling,${cur === 'GBP' ? 40 : 47},${cur},Gecko Jewellery Retail,1,\n`
    + `${link(4)},Yoga Shorts - Irish Army,4,I-1,https://img.example/4.jpg,General Clothing,${cur === 'GBP' ? 60 : 70},${cur},Irish Army,1,\n`
    + `${link(5)},7mm Interlocking PVC Dog Kennel Tiles,5,S-1,https://img.example/5.jpg,General Clothing,${cur === 'GBP' ? 30 : 35},${cur},Sprung Gym Flooring,1,\n`
    + `${link(6)},Pet-Friendly Artificial Grass for Dog Areas & Kennels,6,C-1,https://img.example/6.jpg,Arts & Crafts,${cur === 'GBP' ? 1157 : 1300},${cur},Central Sports UK,1,\n`
    + `${link(7)},9' 1 Heritage Square Tail Retro Longboard Gloss Tint,7,R-1,https://img.example/7.jpg,General Clothing,${cur === 'GBP' ? 750 : 860},${cur},Circle One Surf,1,\n`;
  writeFileSync(join(a, 'AWIN_98661_95541.csv.gz'), gzipSync(rows('GBP')));
  writeFileSync(join(a, 'AWIN_98661_95542.csv.gz'), gzipSync(rows('EUR')));
  const sources = join(dir, 'sources.json');
  const real = JSON.parse(readFileSync('sites/sgw/sources.json', 'utf8')).sources.find(s => s.retailer === 'Cronjager');
  writeFileSync(sources, JSON.stringify({ sources: [real] }));
  const { stats } = await planSgwImport({ archive: a, sourcesFile: sources, outDir: out, now: new Date('2026-10-29T23:30:00Z') });
  assert.equal(stats.rows, 7, 'only the GBP feed is read');
  assert.equal(stats.accepted, 3, 'the padel racket, the kayak and the surf longboard');
  assert.equal(stats.perCategory['racket-sports'], 1);
  assert.equal(stats.perCategory['water-sports'], 2, 'a 9-foot retro longboard is a surfboard');
  assert.ok(Object.keys(stats.rejected).some(k => /brand not on the consumer list/.test(k)), 'jewellery and slogan merch stay out');
  const sql = readdirSync(join(out, 'sql')).map(f => readFileSync(join(out, 'sql', f), 'utf8')).join('\n');
  assert.doesNotMatch(sql, /'EUR'/);
  assert.doesNotMatch(sql, /Necklace|Irish Army|Kennel|Dog Areas/);
});
