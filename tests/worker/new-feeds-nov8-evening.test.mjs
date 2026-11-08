// New Awin feeds of 8 Nov 2026 evening (owner: "check email and download new feeds and import with one go"):
// Cheap Furniture Warehouse and Dream Interiors -> HGW (garden pieces to GGW), Macian -> WGW Shoes (pound feed only),
// Doctor Blooms -> GGW growing, Cottsbury -> HGW bedding and bath, WGW and MGW clothing, Fitness Options -> SGW.
// Names are from the feed-profile report of 8 Nov 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as home from '../../tools/import-rules/lib/hgw-home.mjs';
import * as cfw from '../../tools/import-rules/cheapfurniture.mjs';
import * as dream from '../../tools/import-rules/dreaminteriors.mjs';
import * as macian from '../../tools/import-rules/macian.mjs';
import * as blooms from '../../tools/import-rules/doctorblooms.mjs';
import * as cotts from '../../tools/import-rules/cottsbury.mjs';
import { classify as sgwClassify } from '../../sites/sgw/category-rules.js';

test('HGW home places: the head of the name says what the product is, marketing tails are cut', () => {
  const at = n => { const p = home.homePlace(n); return p ? `${p.siteCategory} / ${p.subcategory}` : null; };
  const cases = [
    ['Pair of Crushed Velvet Scroll Back Dining Chairs Silver/Chrome Elegant Seating', 'Furniture / Dining Chair'],
    ['Nel Wood 4 Seater Dining Table Black Stylish and Durable Dining Room Decor', 'Furniture / Dining Table'],
    ['Habitat x Scion Lohko Coffee Table - Natural', 'Furniture / Coffee Table'],
    ['5 Tier Grey Steel Heavy Duty Garage Shelving Unit Storage Rack Organiser', 'Storage & Organisation / Storage Rack'],
    ['Self Assembly Fabric Armchair Green Comfortable Lounge Chair Design', 'Furniture / Armchair'],
    ['Workstation Office Desk Beech Effect For Computer Laptop Study', 'Home Office / Office Desk'],
    ['Cornwall King Bed Frame Grey Elegant and Comfortable Bedroom Furniture', 'Furniture / Bed Frame'],
    ['Kentford 2 Door Mirrored Wardrobe Oak Spacious and Stylish Bedroom Storage', 'Furniture / Wardrobe'],
    ['Skandi Double Headboard Light Grey Stylish Comfortable Bedroom Decor', 'Furniture / Headboard'],
    ['Malibu 1 Drw Dressing Table with Mirror Pine Effect Stylish Bedroom Furniture', 'Furniture / Dressing Table'],
    ['Luxury Large  Antique Brass Glass Chandelier', 'Lighting / Chandelier'],
    ['Luxury Antique Brass Table Lamp', 'Lighting / Table Lamp'],
    ['Fluted Glass Wall Light', 'Lighting / Wall Light'],
    ['Kendrick Console Table Large', 'Furniture / Console Table'],
    ['Oak Lamp Table', 'Furniture / Side Table'],
    ['Sideboard 3 Drawers Grey', 'Furniture / Sideboard'],
    ['Organic Cotton Double Bed Sheet', 'Bedding & Bath / Bed Linen']
  ];
  for (const [n, want] of cases) assert.equal(at(n), want, n);
  assert.equal(home.trimTail('Cube Wide Shelving Unit Black Modern and Functional Storage'), 'Cube Wide Shelving Unit Black');
  assert.equal(home.trimTail('Modern Sofa'), 'Modern Sofa');
  assert.ok(home.notHome('Sideboard with Gold Handles') === false);
});

test('Cheap Furniture Warehouse: furniture to HGW, garden sets to GGW, pets, sport and kitchen fronts out', () => {
  const c = name => cfw.classify({ name });
  assert.deepEqual(c('Cornwall King Bed Frame Grey Elegant and Comfortable Bedroom Furniture'),
    { site: 'hgw', siteCategory: 'Furniture', subcategory: 'Bed Frame', name: 'Cornwall King Bed Frame Grey' });
  assert.equal(c('Rattan Garden Bistro Set 2 Chairs and Table Grey').site, 'ggw');
  for (const n of ['Plastic Dog House Size L Beige Pet Crate 974 x 674 x 740 mm Beige', 'Lifetime Portable Adjustable Youth Basketball Hoop Backboard Durable',
    'Kitchen Cabinet Doors Gloss 300mm Cashmere 18mm Luxury Replacement Outlet Cheap Fronts']) assert.ok(c(n).reject, n);
  assert.equal(cfw.displayBrand('CFW'), 'Cheap Furniture Warehouse');
  assert.equal(cfw.displayBrand('Habitat'), 'Habitat');
  assert.equal(cfw.productKey(k => ({ merchant_deep_link: 'https://www.cheapfurniturewarehouse.co.uk/products/nel-table?utm=x' })[k] || ''), 'products/nel-table');
});

test('Dream Interiors: the name decides, the shop category when the name is only a model name', () => {
  const c = (name, feedCategory) => dream.classify({ name, feedCategory });
  assert.equal(c('Luxury Antique Brass Pendant', 'Lighting').subcategory, 'Pendant Light');
  assert.equal(c('Aurora Gold', 'Lighting').subcategory, 'Ceiling Light');
  assert.equal(c('Kendrick Large', 'Tables').subcategory, 'Side Table');
  assert.equal(c('Lifton Dark Brown Rug', 'Furniture Accessories').subcategory, 'Rug');
  assert.ok(c('Gift Card', '').reject);
  assert.equal(dream.displayBrand('DreamInteriors uk'), 'Dream Interiors');
});

test('Macian: one card per product page from the pound feed; the dollar rows get their own key (left out by currency)', () => {
  const row = cur => k => ({ merchant_deep_link: 'https://maciancollection.com/products/guinevere-brogue-derby?variant=12', currency: cur })[k] || '';
  assert.equal(macian.productKey(row('GBP')), 'products/guinevere-brogue-derby');
  assert.equal(macian.productKey(row('USD')), 'usd-products/guinevere-brogue-derby');
  const c = name => macian.classify({ name, feedCategory: "Women's Footwear" });
  assert.equal(c('Guinevere Brogue Derby Shoes').subcategory, 'Shoes');
  assert.equal(c('Isolde Chelsea Boots').subcategory, 'Boots');
  assert.equal(c('Elaine Block Heel Court Shoes').subcategory, 'Heels');
  assert.equal(c('Guinevere Brogue Derby Shoes').site, 'wgw');
});

test('Doctor Blooms: grow tents, lights, hydroponics, propagation, feed and media on GGW; spare parts out', () => {
  const c = (name, feedCategory) => blooms.classify({ name, feedCategory });
  assert.equal(c('Nokotech Undercover 150', 'Grow Tent').subcategory, 'Grow tents');
  assert.equal(c('Autopot 4Pot XL System', 'Grow System').subcategory, 'Hydroponics');
  assert.equal(c('Plant Magic Evolution 2.0', 'Nutrients').subcategory, 'Plant feed');
  assert.equal(c('Canna Coco Professional Plus 50L', 'Growing Media').subcategory, 'Growing media');
  assert.equal(c('Plant Magic Evolution 2.0', 'Nutrients').siteCategory, 'Plants, Growing & Garden Care');
  for (const [n, cat] of [['12 Outlet T.O.P. Spin Dripper Assembly - No Stand 16mm Elbow', 'Grow System'], ['RAM MIXED-FLOW INLINE FAN', 'Ventilation'],
    ['Aluminium Silver Joining Tape', 'Ducting']]) assert.ok(c(n, cat).reject, n);
  // A kit keeps its parts after "with": a grow tent kit is a grow tent.
  assert.equal(c('Grow Tent Kit 120 with Carbon Filter and Fan', 'Grow Tent').subcategory, 'Grow tents');
});

test("Cottsbury: bedding and bath to HGW, men's clothing to MGW, the rest to WGW", () => {
  const c = (name, url = 'https://cottsbury.com/products/x') => cotts.classify({ name, url });
  assert.deepEqual(c('GOTS Organic Cotton Duvet Cover Set'), { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Duvet' });
  assert.equal(c('Organic Cotton Bath Towel').subcategory, 'Towel');
  assert.deepEqual(c('Organic Cotton T-Shirt Boxy & Cropped'), { site: 'wgw', siteCategory: 'Clothing', subcategory: 'T-Shirts' });
  assert.equal(c("Men's Organic Joggers").site, 'mgw');
  assert.equal(c('Organic Cotton Hoodie', 'https://cottsbury.com/products/mens-hoodie').site, 'mgw');
  assert.equal(c('Organic Cotton Sports Bra', 'https://cottsbury.com/products/mens-x').site, 'wgw');
  assert.ok(c('E-Gift Card').reject);
});

test('Fitness Options on Sporty Gear World: a fitness-only shop, machines named by model come in under Fitness & Gym', () => {
  const src = JSON.parse(readFileSync(new URL('../../sites/sgw/sources.json', import.meta.url), 'utf8')).sources.find(s => s.advertiserId === 899);
  assert.ok(src && src.sportShop && src.defaultSlug === 'fitness-gym' && src.feedIds.includes(106051));
  assert.deepEqual(sgwClassify('WaterRower Original Series', 'Rowing Fitness Machine', '', src), { ok: true, slug: 'fitness-gym' });
  // Without the shop flag the same name is not sport (other shops keep the strict rules, lessons L65).
  assert.equal(sgwClassify('WaterRower Original Series', 'Rowing Fitness Machine', '', null).ok, false);
});
