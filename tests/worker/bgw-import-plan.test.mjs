// Biker Gear World import plan (dry run): BGW rules on fake feeds, only the shops' motorbike and scooter sections (L65),
// bicycles, kids' ride-on toys, fashion biker jackets and the look-alikes of the motorbike feed scan (31 Oct 2026) out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planBgwImport } from '../../tools/bgw-import-plan.mjs';
import { classify, cleanProductName, CATEGORY_SLUGS } from '../../sites/bgw/category-rules.js';
import site from '../../sites/bgw/site.config.js';

const TOOLS = 'Cycle & Motorcycle > Motorcycle > Motorcycle Tools';
const slug = (n, c = '') => classify(cleanProductName(n), c, c).slug;
const ok = (n, c = '') => classify(cleanProductName(n), c, c).ok;

test('BGW rules put real-looking products in the right category (names from the motorbike feed scan, 31 Oct 2026)', () => {
  const cases = [
    ['Shoei NXR2 Full Face Motorcycle Helmet', '', 'helmets'],
    ['AGV K6 S Helmet', '', 'helmets'],
    ['MY 936 Full-Face Motorcycle Helmet, ECE 22.06, Integrated Sun Visor, Matte Titan', 'Vehicles & Parts > Vehicle Parts & Accessories', 'helmets'],
    ['Kids Motocross Helmet Matte Black M', '', 'helmets'],
    ['Richa Textile Motorcycle Jacket Waterproof', '', 'jackets-trousers'],
    ['Alpinestars SMX-6 V2 Boots', '', 'boots-gloves'],
    ['TCX Touring Biker Boots Waterproof Motorcycle', '', 'boots-gloves'],
    ['Motul 7100 10W-40 4T Oil 1L', '', 'parts-maintenance'],
    ['Carlube XFS401 4-Stroke 10W 40 Fully-Synthetic Motorcycle Oil 1L', 'Garage Equipment > Oil & Fluid Tools > Engine Oil', 'parts-maintenance'],
    ['SGS 200 Kg Paddock Stand Set', 'Vehicles & Parts', 'parts-maintenance'],
    ['Draper Motorcycle Scissor Stand Lift', 'Motorcycle Lifts & Stands', 'parts-maintenance'],
    ['Sealey Motorcycle Transportation Combo Kit', TOOLS, 'parts-maintenance'],
    ['Draper Double Cylinder Foot Pump', TOOLS, 'parts-maintenance'],
    ['Sealey Valve Spring Compressor', TOOLS, 'parts-maintenance'],
    ['Electric Motorbike Battery Charger 60V', '', 'parts-maintenance'],
    ['Pit Bike Tyres 14 inch', '', 'parts-maintenance'],
    ['Oxford Monster XL Disc Lock', '', 'luggage-security'],
    ['Givi Top Box 47L', '', 'luggage-security'],
    ['LOBOO 50L Motorcycle Tail Bag, Waterproof', '', 'luggage-security'],
    ['Lexmoto 125cc Scooter Cover', '', 'luggage-security'],
    ['Cardo Packtalk Edge Motorcycle Intercom', '', 'electronics'],
    ['LOBOO PH06 Motorcycle Phone Mount, Anti-Vibration, 15W Wireless Charging', '', 'electronics'],
    ['Xiaomi Electric Scooter 4 Pro', '', 'electric-scooters'],
    ['Segway Ninebot Max G2', '', 'electric-scooters'],
    ['Pure Electric Pure Escape Ultra Max Suspension Foldable Electric Scooter', '', 'electric-scooters'],
    ['Hama ESCOOTER LOCK 2 KEYS 120CM', '', 'electric-scooters'],
    ['Micro Maxi Deluxe Kick Scooter Kids', '', 'kick-scooters'],
    ['VOKUL K1 Pro Scooters Stunt Scooter Trick Scooter for Boys', 'Sporting Goods > Outdoor Recreation > Riding Scooters', 'kick-scooters'],
    ['Evo Move n Groove Scooter – Blue', 'Bikes & scooters', 'kick-scooters'],
    ['Super Soco TC Max Electric Motorbike', '', 'electric-motorbikes'],
    ['YADEA OWIN Electric Motorcycle, 2800W Motor, 72V 30Ah Battery, 28 Mph, 50 mi Range', '', 'electric-motorbikes'],
    ['Forcefield Pro Back Protector Level 2', '', 'protection']
  ];
  for (const [name, cat, s] of cases) assert.equal(slug(name, cat), s, name);
});

test('BGW rules leave out the scan\'s look-alikes and other sites\' products (bicycles stay on SGW)', () => {
  for (const [name, cat] of [
    ['Carrera Crossfire E Electric Bike', ''],
    ['Cycle Helmet Adult', ''],
    ['Shimano Deore Rear Derailleur', ''],
    ['Bike Lights Set USB', ''],
    ['Draper Bicycle Storage Hooks', TOOLS],
    ['Leather Biker Jacket Women', ''],
    ['Womens Biker Boots Black', ''],
    ['Kids Electric Ride On Motorbike 6V', ''],
    ['370-235V70YL HOMCOM 12V Electric Quad Bike for Kids Ride On Car ATV', ''],
    ['Horse Riding Boots Leather', ''],
    ['Die Cast Ducati Model 1:12', ''],
    ['Mobility Scooter 4mph', ''],
    ['Underwater Sea Scooter', ''],
    ['Motorbike Birthday Card', ''],
    ['Triumph Lingerie Bra', ''],
    ['Motorola Moto G06 Battery Support Foam', ''],
    ['ARCTIC MX-4 (4 g) Edition 2019 – High Performance Thermal Paste', ''],
    ['Intenso Video Scooter BT MP3 player 16 GB Pink', ''],
    ['CIT 500w ATV Eco Bronze 500W 230V 12cm Fan APFC', ''],
    ['Schuberth Schutzhelm EuroGuard 4', ''],
    ['Draper Hard Hat Safety Helmet Visor and Ear Defenders', TOOLS],
    ['Mini Inflation Pump Portable Car Tire Inflation Tool', 'Vehicles & Parts > Vehicle Parts & Accessories'],
    ['Puma Liga Baselayer Short Tights - Sun Stream', 'Sporting Goods > Athletics'],
    ['Rawlink Spiral lock', 'Car & bike']
  ]) assert.equal(ok(name, cat), false, name);
});

test('a general word counts only with a motorbike word or a motorbike section of the shop', () => {
  assert.equal(ok('Waterproof Jacket', ''), false);
  assert.equal(slug('Waterproof Jacket', 'Motorcycle Clothing > Jackets'), 'jackets-trousers');
  assert.equal(ok('Heavy Duty Shackle Lock', 'Vehicles & Parts > Vehicle Parts & Accessories'), false);
  assert.equal(slug('Heavy Duty Shackle Lock', 'Motorcycle Security'), 'luggage-security');
  // Joybuy: its sub-sections are unreliable (sectionHints false), so only the product name says motorbike.
  assert.equal(classify('Sealey Valve Spring Compressor', TOOLS, TOOLS, { sectionHints: false }).ok, false);
  assert.equal(classify('Sealey Motorcycle Valve Spring Compressor', TOOLS, TOOLS, { sectionHints: false }).slug, 'parts-maintenance');
  assert.equal(classify('Draper Wall Bracket', 'Motorcycle Lifts & Stands', '', { sectionHints: false }).ok, false);
  assert.equal(classify('Draper Wall Bracket', 'Motorcycle Lifts & Stands', '').slug, 'parts-maintenance', 'the second chance from the shop section');
});

test('fixes after the first dry run (31 Oct 2026, real feed names)', () => {
  const joybuy = { sectionHints: false };
  const V = 'Vehicles & Parts > Vehicle Parts & Accessories > Vehicle Maintenance, Care & Decor';
  const at = (n, c, src = null) => classify(n, c, c, src);
  // Helmet hooks, hangers and shelves are garage storage; a helmet bag stays with the helmets.
  assert.equal(at('Sealey Motorcycle Helmet Hook', 'Motorcycle Tools').slug, 'parts-maintenance');
  assert.equal(at('Sealey Helmet Hanger / Dryer', 'Motorcycle Tools').slug, 'parts-maintenance');
  assert.equal(at('Sealey Fleece Lined Helmet Bag', 'Motorcycle Tools').slug, 'helmets');
  assert.equal(at('LOBOO R1X Motorcycle Helmet Headset, 45 mm Speakers', V, joybuy).slug, 'electronics');
  assert.equal(at('LOBOO Motorcycle Riding Headgear', V, joybuy).slug, 'jackets-trousers');
  // "Installation" in a tool name is not a service.
  assert.equal(at('Sealey 3 Piece Motorcycle Stud Installation Tool Set', 'Motorcycle Tools').slug, 'parts-maintenance');
  // Kids' scooters stay, even when the name says toy; a kids' ride-on motorbike goes to Kids' Gear World.
  assert.equal(at('Neuleb 3 Wheel Kick Scooter for Kids Ages 3-10, Light Up Flashing Wheels, Toddler Toys', 'Sporting Goods > Outdoor Recreation > Riding Scooters', joybuy).slug, 'kick-scooters');
  assert.equal(at('AA1-023RD HOMCOM Electric Scooter for Kids, Folded Powdered Scooters for Ages 7-12 Years Toy', '', joybuy).slug, 'electric-scooters');
  assert.equal(at('370-335V70GN AIYAPLAY 12V Kids Electric Motorbike, Kids Electric Ride on Motorcycle', '', joybuy).ok, false);
  // A product for several vehicles goes to the site of the vehicle its name puts first.
  assert.match(at('COCCKO Inflatable Pump, Portable Wireless Air Compressor - Smart Car / Motorcycle / Bike', V, joybuy).reason, /Car Gear World/);
  assert.match(at('AstroAI Inflation Devices, Electric Bike Pump Presta Valve for Motorcycle', V, joybuy).reason, /Sporty Gear World/);
  assert.equal(at('Sealey WTS01 Motorcycle and Bicycle Wheel Balancer and Truing Stand', 'Motorcycle Tools').slug, 'parts-maintenance');
  // Joybuy's motorbike section is not enough: the name must say motorbike.
  assert.equal(at('Silverline Tool Bag Hard Base Wide Mouth', 'Vehicles & Parts > Vehicle Parts & Accessories > Vehicle Storage & Cargo > Motorcycle Bags & Panniers', joybuy).ok, false);
  assert.equal(at('66L Motorcycle Tail Bag, Waterproof', 'Motorcycle Bags & Panniers', joybuy).slug, 'luggage-security');
  // SGS Engineering: general chargers, inflators, garden 2-stroke oil and chainsaws are not motorbike products.
  for (const [n, c] of [['SGS 1A Compact Automatic Battery Charger | 6V/12V', 'Electronics > Power'], ['SGS 45cc Petrol Chainsaw - 15in Bar with Chain Oil 1L', 'Garden Equipment > Chainsaws'],
    ['SGS Mini Cordless Tyre Inflator Power Bank', 'Home & Garden > Automotive'], ['SGS 2 Stroke Oil - 1 Litre', 'Home & Garden > Lawn & Garden'], ['NitroLift Quiver Rack Top Box Gas Strut', 'Hardware']]) assert.equal(at(n, c).ok, false, n);
  assert.equal(at('Carlube XST011 2-Stroke Mineral Motorcycle Oil 1L', 'Engine Oil').slug, 'parts-maintenance');
});

test('sizes in product names are taken out, so each size is one card (owner\'s rule for duplicates)', () => {
  for (const [raw, clean] of [
    ['Full Face Motorcycle Helmet Matte Black M 57-58cm', 'Full Face Motorcycle Helmet Matte Black'],
    ['Textile Motorbike Jacket Black XL', 'Textile Motorbike Jacket Black'],
    ['Touring Motorbike Boots EU43', 'Touring Motorbike Boots'],
    ['Summer Riding Gloves - Black | Size: S', 'Summer Riding Gloves - Black'],
    ['Disc Lock 10mm L', 'Disc Lock 10mm L']
  ]) assert.equal(cleanProductName(raw), clean, raw);
});

test('every site category has rules, and the menu order matches the site', () => {
  assert.deepEqual(CATEGORY_SLUGS, site.categories.map(c => c.slug));
});

test('sources: the first-wave shops are approved, VEVOR waits for the second wave, motorbike sections only (L65)', () => {
  const src = JSON.parse(readFileSync('sites/bgw/sources.json', 'utf8')).sources;
  const approved = src.filter(s => s.approved).map(s => s.retailer);
  assert.deepEqual(approved, ['Tooled Up', 'My Tool Shed', 'Joybuy', 'SGS Engineering', 'Plusshop UK', 'Bazta UK']);
  const vevor = src.find(s => s.retailer === 'VEVOR');
  assert.equal(vevor.approved, false);
  assert.equal(vevor.keepSiteNames, true, 'lessons L79: a VEVOR rules file keeps the translated names');
  assert.equal(src.find(s => s.retailer === 'Joybuy').sectionHints, false);
  for (const r of ['Tooled Up', 'My Tool Shed']) {
    const p = src.find(s => s.retailer === r).allowPaths;
    assert.ok(p.includes('motorcycle') && !p.some(x => /^cycle/.test(x)), `${r}: only the Motorcycle sections, not Cycle`);
  }
});

test('plan: two archive folders, only the motorbike section of a shop, bicycles and toys out, SQL not executed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'bgw-plan-'));
  const a = join(dir, 'GW_AWIN_BULK_ARCHIVE'), b = join(dir, 'GW_AWIN_NEW_20261031');
  mkdirSync(a); mkdirSync(b);
  const out = join(dir, 'out');
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean\n';
  const link = (p, m) => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=${m}`;
  writeFileSync(join(a, 'AWIN_496_89987.csv.gz'), gzipSync(head
    + `${link(1, 496)},Sealey Motorcycle Paddock Stand Rear,1,T-1,https://img.example/1.jpg,${TOOLS},69.95,GBP,Sealey,1,5051747000000\n`
    + `${link(2, 496)},Draper Bicycle Repair Stand,2,T-2,https://img.example/2.jpg,Cycle & Motorcycle > Cycle > Bicycle Tools,45,GBP,Draper,1,\n`
    + `${link(3, 496)},Draper 18V Combi Drill,3,T-3,https://img.example/3.jpg,Power Tools > Drills,99,GBP,Draper,1,\n`
    + `${link(4, 496)},Sealey Motorcycle Wheel Chock,4,T-4,https://img.example/4.jpg,${TOOLS},39,GBP,Sealey,0,\n`));
  writeFileSync(join(b, 'AWIN_123932_114093.csv.gz'), gzipSync(head
    + `${link(5, 123932)},Folding Kick Scooter for Adults 200mm Wheels,5,J-1,https://img.example/5.jpg,Sporting Goods > Outdoor Recreation > Riding Scooters,59.99,GBP,Neuleb,1,\n`
    + `${link(6, 123932)},HOMCOM 12V Kids Electric Ride On Motorbike,6,J-2,https://img.example/6.jpg,Toys & Games > Toys > Riding Toys,89,GBP,HOMCOM,1,\n`));
  const sources = join(dir, 'sources.json');
  writeFileSync(sources, JSON.stringify({ sources: [
    { advertiserId: 496, feedIds: [89987], retailer: 'Tooled Up', currency: 'GBP', approved: true, allowPaths: ['motorcycle', 'motorcycle tools', 'motorcycle lifts & stands'] },
    { advertiserId: 123932, feedIds: [114093], retailer: 'Joybuy', currency: 'GBP', approved: true, allowPaths: ['riding scooters', 'vehicle parts & accessories'], sectionHints: false }
  ] }));
  const { stats, report } = await planBgwImport({ archive: `${a};${b}`, sourcesFile: sources, outDir: out, now: new Date('2026-10-31T09:00:00Z') });
  assert.equal(stats.rows, 6);
  assert.equal(stats.accepted, 2);
  assert.equal(stats.perCategory['parts-maintenance'], 1);
  assert.equal(stats.perCategory['kick-scooters'], 1);
  assert.equal(stats.rejected['out of stock'], 1);
  assert.ok(Object.keys(stats.rejected).some(k => /feed folder not on the consumer list/.test(k)));
  assert.match(report, /BGW IMPORT PLAN/);
  const sql = readFileSync(join(out, 'sql', readdirSync(join(out, 'sql')).find(f => f === '0001.sql')), 'utf8');
  assert.match(sql, /-- BGW import plan .* NOT executed/);
  assert.match(sql, /'Tooled Up', 'parts-maintenance'.*'GBP'/);
});
