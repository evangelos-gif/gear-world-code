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
import { classify as zgwClassify } from '../../sites/zgw/category-rules.js';
import * as natkina from '../../tools/import-rules/natkina.mjs';
import * as santoro from '../../tools/import-rules/santoromilan.mjs';
import * as luxe from '../../tools/import-rules/luxefashion.mjs';
import * as sal from '../../tools/import-rules/sportandleisure.mjs';

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

test('fixes after the dry run of 8 Nov 2026 evening: sets, shoe benches, Christmas, blinds, fittings out, colours, men\'s Cottsbury', () => {
  const at = n => { const p = home.homePlace(n); return p ? `${p.siteCategory} / ${p.subcategory}` : null; };
  for (const [n, want] of [
    ['Chicago Oak White Bar Table & 2 Oak White Chairs', 'Furniture / Dining Set'],
    ['Helena Glass Dining Table & 4 Grey Chairs', 'Furniture / Dining Set'],
    ['Bolitzo Oak White Bar Table 2 Oak White Stools', 'Furniture / Dining Set'],
    ['Carina Dining Table & Bench Set Black | Oval 200cm', 'Furniture / Dining Set'],
    ['Winchester Shoe Storage Bench - Grey', 'Storage & Organisation / Shoe Rack'],
    ['Tiva 5 Shelf Grey Corner Ladder Bookshelf Storage Display Unit', 'Furniture / Bookcase'],
    ['Monte Carlo Aged Gold Bed Side Table', 'Furniture / Bedside Table'],
    ['Liang & Eimil Hudson Sofa - Lander Shade', 'Furniture / Sofa'],
    ['Liang & Eimil Ventus Ceiling Lamp - Brushed Antique Brass/Off White Linen Shade', 'Lighting / Ceiling Light'],
    ['Reni Large Black Fabric Drum Shade 45cm Easy Fit', 'Lighting / Lampshade'],
    ['Xander Brushed Gold Drinks Trolley', 'Furniture / Drinks Trolley'],
    ['Quintessa Peial Handmade Artwork', 'Home Decor / Wall Art'],
    ['Derwent Bronze Pedestal Column', 'Furniture / Side Table'],
    ['Freestanding Towel Ladder White', 'Bedding & Bath / Bathroom Accessories'],
    ['Pre-Lit Pencil Christmas Tree 6ft Green Elegant and Lifelike Holiday Decor', 'Home Decor / Christmas'],
    ['Little Black Book 50mm Venetian Blind Black 70x160cm', 'Home Decor / Blinds']
  ]) assert.equal(at(n), want, n);
  for (const n of ['1375x755mm Fully Framed Bath Shower Screen White', 'Kitchen Wall Unit 300mm 18mm Cabinet Carcass Cupboard',
    'Pro Fitness 2 Tier Weights Storage Rack', 'Sportspower Swing with Rebound Net and Basketball Hoop Kids Garden Play']) assert.ok(home.notHome(n), n);
  assert.equal(home.notHome('Sideboard with Gold Door Handles'), false);
  const c = name => cfw.classify({ name });
  assert.equal(c('45m 4 Arm Rotary Airer Outdoor Washing Line Garden Dryer Heavy Duty').subcategory, 'Clothes Airer');
  assert.equal(c('Antigua 4-Seater Dining Set Garden Patio Furniture Table Chairs').subcategory, 'Dining sets');
  assert.equal(c('McGregor Large Walk In Greenhouse Easy Assembly Sturdy Frame').subcategory, 'Greenhouses');
  // Only the feed Awin still refreshes (113623); the May one (99953) stays out (lessons L39).
  assert.deepEqual(cfw.feedFiles('/no/such/folder'), []);
  assert.equal(macian.cardName('Ludo Penny Loafer', 'https://maciancollection.com/products/ludo-penny-loafer-black-calf?variant=1'), 'Ludo Penny Loafer - Black Calf');
  assert.equal(macian.cardName('Ada Derby Shoes', 'https://maciancollection.com/products/ada-derby-shoes'), 'Ada Derby Shoes');
  const ct = name => cotts.classify({ name, url: 'https://cottsbury.com/products/x' });
  assert.equal(ct('Henley Regular Fit Organic Cotton Jersey T-Shirt').site, 'mgw');
  assert.equal(ct('Zip Front Slim Fit Organic Cotton Interlock Jacket').subcategory, 'Jackets');
  assert.equal(ct('Organic Cotton Black Tights in Full Length. GOTS Certified & Fairtrade').subcategory, 'Leggings');
  assert.ok(ct('Carbon Organic Cotton Cable Knit Throw (Sample)').reject);
  assert.ok(ct('Cottsbury E-Giftcard').reject);
  const b = (name, feedCategory) => blooms.classify({ name, feedCategory });
  assert.equal(b('Plant Magic Old Timer Organic Bloom', 'Nutrients').subcategory, 'Plant feed');
  assert.equal(b('Athena Fade', 'Fertiliser').subcategory, 'Plant feed');
  assert.ok(b('CO2 Solenoid - CO2 Kit (Solenoid Only)', 'Grow System').reject);
  assert.ok(b('LUMATEK LED DRIVER 5m EXTENSION CABLES', 'Lighting').reject);
});

test('Sporty Gear World: gym machines with a console or named "trainer" stay in Fitness & Gym, indoor bikes too', () => {
  const src = { sportShop: true, defaultSlug: 'fitness-gym' };
  for (const n of ['Life Fitness E1 Elliptical Cross Trainer-Go Console', 'Life Fitness C1 Upright Bike-Go Console', 'IC6 Bike',
    'Nohrd Upright Bike-Club Sport Upright Bike', 'Tria Trainer-Tria Trainer Oak', 'Inspire FT1 Functional Trainer', 'BH Pioneer S3 Senior Treadmill']) {
    assert.deepEqual(sgwClassify(n, 'Gym at Home', '', src), { ok: true, slug: 'fitness-gym' }, n);
  }
  // Upright bikes are gym machines for every shop, not Cycling.
  assert.equal(sgwClassify('Schwinn 590U Upright Bike', 'Exercise Bikes', '', null).slug, 'fitness-gym');
  // Still out: a games console, safety boots; running trainers stay Running.
  assert.equal(sgwClassify('PlayStation 5 Console', '', '', null).ok, false);
  assert.equal(sgwClassify('Dickies S3 Safety Boots', 'Sports', '', null).ok, false);
  assert.equal(sgwClassify('Adidas Ultraboost Running Trainers', 'Sports', '', null).slug, 'running');
});

test('after the import of 8 Nov 2026: a type in front of the marketing words still counts ("... Elegant Dining Table")', () => {
  assert.equal(home.homePlace('Marlow 110 cm Round Smoked Glass Top Elegant Dining Table').subcategory, 'Dining Table');
  assert.equal(home.homeName('Marlow 110 cm Round Smoked Glass Top Elegant Dining Table'), 'Marlow 110 cm Round Smoked Glass Top Elegant Dining Table');
  assert.equal(home.homeName('Cornwall King Bed Frame Grey Elegant and Comfortable Bedroom Furniture'), 'Cornwall King Bed Frame Grey');
  const c = cfw.classify({ name: 'Cuba 4 Seater Cube Set Stylish Comfortable Outdoor Seating' });
  assert.equal(c.site, 'ggw');
  assert.equal(c.name, 'Cuba 4 Seater Cube Set');
});

test('8 Nov 2026 late: Natkina jewellery on WGW (pound feed only), Santoro Milan suits on MGW, new SGW and ZGW sources', () => {
  const nk = (name, feedCategory) => natkina.classify({ name, feedCategory });
  assert.deepEqual(nk('Lucky Green Frog Ring - White Silver / Green / 52', 'Rings'), { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: 'Rings', name: 'Lucky Green Frog Ring' });
  assert.equal(nk('Rainbow Square Silver Tennis Bracelet - White Silver / Emerald CZ / 17.5 cms', 'Bracelets').subcategory, 'Bracelets');
  assert.equal(nk('Multicolor Owl Silver Earrings - White Silver / Multi', 'Earrings').subcategory, 'Earrings');
  assert.ok(nk('Jewellery Cleaning Spray', 'Spray').reject);
  assert.deepEqual(natkina.feedFiles('/no/such/folder'), []);
  assert.equal(natkina.displayBrand('NATKINA'), 'Natkina');
  const sm = name => santoro.classify({ name });
  assert.equal(sm('Diaz Blue Three Piece Suit').subcategory, 'Suits');
  assert.equal(sm('Santoro - Leonardo Tux').subcategory, 'Suits');
  assert.equal(sm('Bromley Sky Waistcoat').subcategory, 'Waistcoats');
  assert.equal(sm('Marc Darcy Jenson Grey Check Suit Three Piece Suit.').name, 'Marc Darcy Jenson Grey Check Suit Three Piece Suit');
  assert.deepEqual(sm('Navy Silk Bow Tie'), { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Ties', name: 'Navy Silk Bow Tie' });
  assert.ok(sm('Boys Navy Three Piece Suit').reject);
  const sgw = JSON.parse(readFileSync(new URL('../../sites/sgw/sources.json', import.meta.url), 'utf8')).sources;
  assert.ok(sgw.find(s => s.advertiserId === 1463 && s.approved && s.feedIds.includes(37875)));
  assert.equal(sgwClassify('IronMan 20kg Vinyl Dumbbell Set', 'Fitness Equipment > Free Weights', '', sgw.find(s => s.advertiserId === 1463)).slug, 'fitness-gym');
  assert.equal(sgwClassify('Air King 12ft Trampoline with Enclosure', 'Trampolines > Round Trampolines', '', sgw.find(s => s.advertiserId === 1463)).ok, false);
  const zgw = JSON.parse(readFileSync(new URL('../../sites/zgw/sources.json', import.meta.url), 'utf8')).sources.find(s => s.advertiserId === 42915);
  assert.ok(zgw && zgw.petShop);
  assert.deepEqual(zgwClassify('Calm The Eff Down - Natural Calming Dog Treats', 'Pets', '', zgw), { ok: true, slug: 'food' });
});

test('8 Nov 2026 late, "can they go elsewhere": Luxefashion on WGW (heels, dresses, lingerie), trampolines and ride-on cars on KGW', () => {
  const lx = name => luxe.classify({ name });
  assert.deepEqual(lx('Block heel pumps model 226555 Solea - 39 - Black'), { site: 'wgw', siteCategory: 'Shoes', subcategory: 'Heels', name: 'Solea Block Heel Pumps - Black' });
  assert.equal(lx('High heels model 191201 Step in style - 38 - Red').subcategory, 'Heels');
  assert.equal(lx('Cocktail dress model 139517 awama - M - Navy').subcategory, 'Dresses');
  // classifyAll: the full sort, before the owner's choice of ranges.
  assert.deepEqual(luxe.classifyAll({ name: 'Soft model 198086 Teyli - 100C - White' }), { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Underwear', name: 'Teyli Soft Bra - White' });
  assert.equal(luxe.classifyAll({ name: 'Blouse model 228065 Relevance - ONE-SIZE-FITS-ALL - Red' }).name, 'Relevance Blouse - Red');
  assert.equal(luxe.classifyAll({ name: 'Boxers model 158461 Henderson - L - Black', feedCategory: 'male' }).site, 'mgw');
  // One card per model and colour: the sizes are joined.
  const key = n => luxe.productKey(c => (c === 'product_name' ? n : ''));
  assert.equal(key('Padded bra model 227813 Vena - 85D - Beige'), key('Padded bra model 227813 Vena - 75D - Beige'));
  assert.notEqual(key('Padded bra model 227813 Vena - 85D - Beige'), key('Padded bra model 227985 Vena - 95C - Black'));
  const sl = (name, feedCategory) => sal.classify({ name, feedCategory });
  assert.deepEqual(sl('Air King 12ft Trampoline with Enclosure', 'Trampolines > Round Trampolines'), { site: 'kgw', siteCategory: 'Sports & Outdoors', subcategory: 'Trampolines' });
  assert.equal(sl('12V Kids Ride On Jeep', 'Kids Ride-On Electric Cars').subcategory, 'Electric Riding Vehicles');
  assert.ok(sl('IronMan 20kg Dumbbell Set', 'Fitness Equipment > Free Weights').reject);
  assert.ok(sl('Fitness Mad Mini Rebounder', 'Trampolines').reject);
});

test("owner's choice for Luxefashion (8 Nov 2026): shoes, dresses, coats, knitwear, skirts, accessories, nightwear only; Natkina https pictures; pools on KGW", () => {
  const lx = name => luxe.classify({ name });
  assert.equal(lx('Block heel pumps model 226555 Solea - 39 - Black').subcategory, 'Heels');
  assert.equal(lx('Daydress model 205511 Numoco - M - Red').subcategory, 'Dresses');
  assert.equal(lx('Turtleneck model 215301 Lakerta - S - Black').subcategory, 'Knitwear');
  assert.equal(lx('Neckerchief model 223310 At - ONE-SIZE-FITS-ALL - Multicolor').subcategory, 'Scarves');
  assert.equal(lx('Coat model 160011 Rue Paris - L - Brown').subcategory, 'Jackets & Coats');
  for (const n of ['Padded bra model 227813 Vena - 85D - Beige', 'Blouse model 228065 Relevance - ONE-SIZE-FITS-ALL - Red',
    'Swimsuit two piece model 199981 Marko - M - Pink', 'Jeans model 217001 Factory Price - 38 - Blue']) assert.ok(lx(n).reject, n);
  // The full sort still works (for a later change of mind).
  assert.equal(luxe.classifyAll({ name: 'Padded bra model 227813 Vena - 85D - Beige' }).subcategory, 'Underwear');
  assert.equal(natkina.field('merchant_image_url', () => 'http://cdn.example.com/a.jpg'), 'https://cdn.example.com/a.jpg');
  assert.equal(natkina.field('product_name', () => 'http://x'), 'http://x');
  assert.equal(sal.classify({ name: 'Bestway Tug Boat Play Pool', feedCategory: 'Garden Games > Swimming Pools' }).subcategory, 'Water Play Equipment');
  assert.equal(sal.classify({ name: 'Air League HB10 Junior Adjustable Basketball Stand', feedCategory: 'Garden Games > Basketball' }).subcategory, 'Outdoor Games');
  const sgw = JSON.parse(readFileSync(new URL('../../sites/sgw/sources.json', import.meta.url), 'utf8')).sources.find(s => s.advertiserId === 1463);
  assert.ok(sgw.denyPaths.includes('trampolines') && sgw.denyPaths.includes('swimming pools'));
});

