// Construction Gear World: the general category rules (phase 4 of "every product through the Hub", 31 Oct 2026).
// Names are real products from the live site; the rules were tuned on them (92% of the UK shops' products in the same category).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as CGW from '../../sites/cgw/category-rules.js';
import cgwConfig from '../../sites/cgw/site.config.js';

// Names of the tool and workwear shops (sources.json "tradeShop"); a shop without it needs a trade word (test below).
const TRADE_SHOP = { tradeShop: true };
const on = (name, feed = '', source = TRADE_SHOP) => {
  const c = CGW.classify(CGW.cleanProductName(name), feed, '', source);
  return c.ok ? `${c.slug}/${c.subcategory}` : `no: ${c.reason}`;
};

test('the slugs and names are the ones the site already uses (site.config.js, database.categories)', () => {
  const cats = cgwConfig.database.categories;
  for (const slug of CGW.CATEGORY_SLUGS) {
    assert.ok(cats[slug], `${slug} is a page of the site`);
    assert.ok(cats[slug].includes(CGW.CATEGORY_DB_NAMES[slug]), `${slug} is stored as "${CGW.CATEGORY_DB_NAMES[slug]}"`);
  }
});

test('sources.json: UK shops in pounds only (L87), and every rule a shop names exists', () => {
  const { sources } = JSON.parse(readFileSync(new URL('../../sites/cgw/sources.json', import.meta.url), 'utf8'));
  for (const s of sources) {
    assert.equal(s.currency, 'GBP', s.retailer);
    if (s.defaultCategory) assert.ok(CGW.CATEGORY_SLUGS.includes(s.defaultCategory), `${s.retailer}: ${s.defaultCategory}`);
  }
  assert.ok(!sources.some(s => /reidl|vevor/i.test(s.retailer)), 'Reidl (DE) and VEVOR NL are not offered');
});

test('workwear, PPE and safety footwear: the type is the last noun of the name', () => {
  const cases = [
    ['Snickers 6241 AllroundWork Stretch Work Trousers Black / Black 33 32', '', 'workwear/Work Trousers'],
    ['Portwest PW3 Hi-Vis Winter Jacket Yellow / Navy XL', '', 'workwear/Hi-Vis'],
    ['Ansell HyFlex 11-840 Work Gloves Size 9', '', 'workwear/Work Gloves'],
    ['Caterpillar Premium Work Sock 3 Pair Pack', '', 'workwear/Socks'],
    ['Portwest Classic Ear Protector', '', 'ppe/Hearing Protection'],
    ['Beeswift Boston Spectacles Clear', '', 'ppe/Eye & Face Protection'],
    ['Mascot Complete Waterloo Knee-pads', '', 'ppe/Knee Protection'],
    ['Scan Disposable Overall Navy XL', 'Workwear > Mens Workwear > Overalls', 'ppe/Disposable Coveralls'],
    ['Dickies Redhawk Super Safety Boot Black Size 10', '', 'safety-footwear/Safety Boots'],
    ['Amblers Safety FS7 Steel Toe Cap Dual Density Rigger Boots Brown Size 10', '', 'safety-footwear/Rigger Boots'],
    ['Portwest PU Non Safety Wellington Boots Green Size 11', '', 'safety-footwear/Wellingtons'],
    ['Skechers Work Flex Advantage Bronwood Shoe Black Size 8', '', 'safety-footwear/Safety Shoes']
  ];
  for (const [name, feed, want] of cases) assert.equal(on(name, feed), want, name);
});

test('tools: the longer phrase wins at the same place, and what comes with the product does not decide', () => {
  const cases = [
    ['DeWalt DCD796 18v XR Cordless Brushless Combi Drill No Batteries No Charger No Case', 'Power Tools > Drills', 'power-tools/Power Tools'],
    ['Einhell TE-MG 300 EQ OIS Oscillating Multi Tool', 'Power Tools > Oscillating Multi Tools', 'power-tools/Power Tools'],
    ['Makita 2 Cutter SDS Plus Masonry Drill Bit', 'SDS Plus Drill Bits', 'power-tools/Power Tools'],
    ['Milwaukee M12 FBFL13 Fuel 12v Cordless Brushless Belt Sander 2 x 4ah Li-ion Battery Charger Bag', 'Power Tools > Sanders', 'power-tools/Power Tools'],
    ['DeWalt DCL050 18v XR Cordless LED Work Light No Batteries No Battery Charger No Case', 'Power Tools > Portable Lighting', 'site-equipment/Lighting'],
    ['Draper Expert 1/2" Drive Hi Torq Hexagon Impact Socket Metric 1/2" 22mm', 'Hand Tools > Single Sockets', 'hand-tools/Hand Tools'],
    ['Draper Redline 14 Piece Combination Spanner Set in Tool Roll', 'Hand Tools > Combination Spanners', 'hand-tools/Hand Tools'],
    ['Stanley Fatmax Spring Steel Claw Bar', 'Nail Bars', 'hand-tools/Hand Tools'],
    ['ABUS Mechanical 65/40mm Brass Padlock Keyed Alike 404', '', 'hand-tools/Hand Tools'],
    ['Gorilla Broom with Hard Bristle 50cm Head', 'Home & Garden > Household Supplies', 'hand-tools/Brooms'],
    ['Bosch Spirit Level and Integrated 17 Piece Screwdriver Bit Set 12" / 30cm', 'Measuring Tools > Levels & Accessories', 'site-equipment/Site Equipment'],
    ['Bahco MTS Reversible Magnetic Tip Tape Measure Imperial & Metric 16ft / 5m 25mm', 'Measuring Tools > Tape Measures', 'site-equipment/Site Equipment'],
    ['Stanley Fatmax Waterproof Structural Foam Toolbox 580mm', 'Tool Boxes & Storage > Tool Boxes & Cases', 'site-equipment/Site Equipment'],
    ['Sealey PC100 Wet and Dry Vacuum Cleaner 10L 240v', 'Cleaning & Drainage > Vacuums & Dust Extractors', 'site-equipment/Vacuum Cleaners'],
    ['Gorilla Tub Large 38 Litres', 'Home & Garden > Household Supplies', 'site-equipment/Mixing Tubs & Buckets']
  ];
  for (const [name, feed, want] of cases) assert.equal(on(name, feed), want, name);
});

test('other Gear Worlds\' products stay out, with the site they belong to', () => {
  assert.equal(on('Sealey VS7003 15 Piece Oil Filter Cap Wrench Set', 'Hand Tools > Oil Filter Wrenches'), 'no: car tool (Car Gear World)');
  assert.equal(on('Sealey Ratchet Type Axle Stands 6 Tonne', 'Automotive Tools > Jacks, Lifting Gear & Stands'), 'no: car tool (Car Gear World)');
  assert.equal(on('Gardena SmartCut Comfort Ratchet Anvil Secateurs', 'Garden Tools > Loppers, Pruners & Saws'), 'no: garden product (Garden Gear World)');
  assert.equal(on('Makita DUR181Z 18v LXT Cordless Line Trimmer', 'Garden Tools > Outdoor Power Tools'), 'no: garden product (Garden Gear World)');
  assert.equal(on('Uneek Childrens Poloshirt'), 'no: children\'s product (Kids\' Gear World)');
  assert.equal(on('HP RM1-8177-000CN Transfer Belt for HP CLJ CP 3525'), 'no: office or computer part (Technology Gear World)');
  assert.equal(on('Gift Card £50'), 'no: gift card or voucher');
  // No rule matches an empty word (a stray ",," in a word list would make every name match).
  assert.equal(on('Zzzz Qqqq'), 'no: not a construction product');
});

test('a shop that is not a tool or workwear shop needs a trade word, brand or section (shadow catalogue 31 Oct 2026)', () => {
  const other = { retailer: 'New shop' };
  assert.match(on('HP AC Smart pin slim power adapter (90-watt)', 'Default Category>Power Adapters', other), /^no: /);
  assert.match(on('1000 Mile Approach Socks in Navy', 'Sports', other), /^no: /);
  assert.match(on('Sol Wooden Solar Lantern', '594', other), /^no: /);
  assert.match(on('DeWalt DCD796 18V Combi Drill', '', other), /^power-tools\//);
  assert.match(on('Snickers 6241 AllroundWork Trousers', '', other), /^workwear\//);
  assert.equal(on('Rst S1 Ce Mens Textile Motorcycle Jacket Black', '', other), 'no: motorbike clothing (Biker Gear World)');
});
