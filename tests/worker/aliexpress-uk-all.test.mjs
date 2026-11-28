// AliExpress UK in all categories (owner, 28 Nov 2026: "AliExpress θέλω για όλες τις κατηγορίες αύριο", lessons L241).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aliexpressUkSection, brandTrouble, SECTION_SITES, NEVER_MORE } from '../../tools/import-rules/lib/aliexpress-uk-sections.mjs';
import * as gc from '../../tools/import-rules/aliexpress-uk-gc.mjs';
import * as first from '../../tools/import-rules/aliexpress-uk.mjs';
import { viewFor, isShown } from '../../src/lib/visibility.js';

const at = (site, name, path, brand = 'NONE') => {
  const c = aliexpressUkSection(site, name, path, brand);
  return c.ok ? `${c.slug} > ${c.sub}` : `out: ${c.reason}`;
};
const gcAt = (name, feedCategory) => {
  const c = gc.classify({ name, feedCategory });
  return c.reject ? `out: ${c.reject}` : `${c.site} ${c.siteCategory} > ${c.subcategory}`;
};
const NEW_SITES = ['tgw', 'agw', 'sgw', 'bgw', 'pgw', 'zgw', 'vgw'];

test('L241: every newer site reads AliExpress UK from the three fresh feeds only, with its own sections, £3 to £1,500', () => {
  assert.deepEqual([...SECTION_SITES].sort(), ['AGW', 'BGW', 'PGW', 'SGW', 'TGW', 'VGW', 'ZGW']);
  for (const s of NEW_SITES) {
    const src = JSON.parse(readFileSync(`sites/${s}/sources.json`, 'utf8')).sources.filter(x => x.advertiserId === 7035);
    assert.equal(src.length, 1, s);
    const [a] = src;
    assert.equal(a.retailer, 'AliExpress UK', s);
    assert.equal(a.currency, 'GBP', s);
    assert.equal(a.sections, 'aliexpress-uk', s);
    assert.equal(a.approved, true, s);
    assert.equal(a.minPrice, 3, s);
    assert.equal(a.maxPrice, 1500, s);
    assert.deepEqual(a.feedIds, [...first.FEEDS], s);
    // L238: the old copies (Awin refresh in 2025 or August 2026) are never read.
    for (const old of first.OLD_FEEDS) assert.ok(!a.feedIds.includes(old), `${s} ${old}`);
  }
  // The planner knows the sections value and keeps a source's highest price.
  const plan = readFileSync('tools/tgw-import-plan.mjs', 'utf8');
  assert.ok(plan.includes("source.sections === 'aliexpress-uk' ? aliexpressUkSection(label, name, merchantCategory, brand)"));
  assert.ok(plan.includes('if (source.maxPrice && price > source.maxPrice)'));
});

test('L241: places on the newer sites by the shop\'s own English sections', () => {
  assert.equal(at('AGW', 'VIOFO A229 PLUS Car DVR 2K HDR Video Recorder 5GHZ WI-FI GPS Voice Control Dash Camera', 'Automobiles, Parts & Accessories , Car Electronics , Car DVR', 'VIOFO'), 'car-electronics > Dash Cams');
  assert.equal(at('AGW', 'Car Seat Covers Full Set Breathable Leather for BMW E46', 'Automobiles, Parts & Accessories , Interior Accessories , Seat Accessories'), 'interior-comfort > Seat Covers & Cushions');
  assert.equal(at('TGW', 'Samsung Galaxy Z Fold 8 Stand Matte Hard PC Cover Case With Kickstand', 'Phones & Telecommunications Accessories , Mobile Phone Cases & Covers , Basic Phone Case').startsWith('phones-smartwatches > Phone Cases') ||
    at('TGW', 'Samsung Galaxy Z Fold 8 Stand Matte Hard PC Cover Case With Kickstand', 'Phones & Telecommunications Accessories , Mobile Phone Cases & Covers , Basic Phone Case').startsWith('out: one in 3 kept'), true);
  assert.equal(at('TGW', 'TWS Wireless Earbuds Bluetooth 5.4 for iPhone Samsung Android', 'Consumer Electronics , Portable Audio & Video , Earphones & Headphones'), 'audio > Headphones & Earbuds');
  assert.equal(at('TGW', 'GMKtec G10 Mini PC AMD Ryzen5 3500U Barebone 2.5GbE NIC LAN', 'Computer & Office , Barebone & Mini PC , Mini PC', 'GMKtec'), 'laptops-computing > Mini PCs');
  assert.equal(at('PGW', 'Mobapad M12-S Bluetooth Controller For Nintendo Switch 2 TMR Glide Sticks', 'Consumer Electronics , Games & Accessories , Gamepads', 'MOBAPAD'), 'controllers > Controllers');
  assert.equal(at('SGW', 'Naturehike Star Trail Hiking Tent 1 2 Person Ultralight', 'Sports & Entertainment , Camping & Hiking , Tents & Shelters', 'Naturehike'), 'hiking-climbing-winter > Tents');
  assert.equal(at('SGW', 'Li-Ning Men\'s RED HARE 9 Racing Running Shoes LIGHT FOAM', 'Sports Shoes,Clothing&Accessories , Sneakers , Running Shoes', 'LINING'), 'running > Running Shoes');
  assert.equal(at('BGW', 'Rhinowalk Motorcycle Magnet Tank Bag 6.5L Waterproof Quick Release', 'Motorcycle Equipments & Parts , Motorcycle Accessories , Luggage', 'Rhinowalk'), 'luggage-security > Luggage');
  assert.equal(at('ZGW', 'Elevated Ceramic Cat Bowl Slanted Neck Protection Pet Food Bowl', 'Home & Garden , Pet Products , Dog & Cat Feeders'), 'feeding > Bowls & Feeders');
  assert.equal(at('VGW', 'Carry-on Travel Luggage 20 Inch Trolley Case Lightweight Spinner', 'Luggage & Bags , Luggage , Rolling Luggage'), 'luggage-suitcases > Suitcases');
  // Another site's section is not this site's.
  assert.match(at('TGW', 'VIOFO A229 PLUS Car DVR 2K HDR Video Recorder', 'Automobiles, Parts & Accessories , Car Electronics , Car DVR'), /^out: AliExpress UK section of AGW/);
  // The card's brand: the seller's own, never a well-known one or a car maker.
  assert.equal(aliexpressUkSection('AGW', 'Car Threshold Strip Anti Scratch Door Sill Protector', 'Automobiles, Parts & Accessories , Exterior Accessories , Door Trim', 'Peugeot').brand, 'AliExpress');
  assert.equal(aliexpressUkSection('AGW', 'VIOFO A229 PLUS Car DVR 2K HDR Video Recorder', 'Automobiles, Parts & Accessories , Car Electronics , Car DVR', 'VIOFO').brand, 'VIOFO');
});

test('L241: well-known brands only as what an accessory fits, never as the product or the "original"', () => {
  assert.match(at('TGW', 'Apple AirPods Pro 2 Wireless Earbuds Noise Cancelling', 'Consumer Electronics , Portable Audio & Video , Earphones & Headphones'), /^out: a well-known brand named as the product/);
  assert.match(at('TGW', 'Apple Watch Series 10 Smartwatch 46mm', 'Consumer Electronics , Smart Electronics , Wearable Devices'), /^out: a well-known brand/);
  assert.equal(at('TGW', 'Silicone Strap for Apple Watch Ultra 2 49mm Sport Band', 'Consumer Electronics , Smart Electronics , Wearable Devices'), 'phones-smartwatches > Smartwatches & Wearables');
  assert.match(brandTrouble('Original Milwaukee M18 Battery 6.0Ah', 'Consumer Electronics , Accessories & Parts , Batteries'), /original/);
  assert.match(at('TGW', 'Cute Anime Kuromi Phone Holder Stand', 'Phones & Telecommunications Accessories , Holders & Stands , Stands'), /^out: a well-known brand or licensed character/);
  assert.match(at('SGW', 'Nike Air Zoom Pegasus Running Shoes Men', 'Sports Shoes,Clothing&Accessories , Sneakers , Running Shoes'), /^out: a well-known brand or licensed character/);
  // "Mini PC", "Seat Covers", "Digital Pixel" are not the car makers MINI and SEAT or Google Pixel.
  assert.equal(brandTrouble('8 Ohm 2W Mini Speaker Full Range Cavity Sound Box', 'Consumer Electronics , Portable Audio & Video , Speakers'), '');
  assert.equal(brandTrouble('WS2812B Addressable Digital Pixel LED Chip', 'Electronic Components & Supplies , Optoelectronic Displays , LED'), '');
});

test('L241: unsafe, unlawful or copied products stay out of the newer sites', () => {
  const out = (site, name, path) => assert.match(at(site, name, path), /^out: /, name);
  out('AGW', 'H4 H7 LED Headlight Bulbs Canbus 6000K', 'Automobiles, Parts & Accessories , Car Lights , Car Headlight Bulbs(LED)');
  out('AGW', 'Universal Ceramic Brake Pads Front Set', 'Automobiles, Parts & Accessories , Wear Parts , Brake System');
  out('AGW', '225/45R17 Summer Tyre 94W', 'Automobiles, Parts & Accessories , Wear Parts , Wheels Tires & Parts');
  out('AGW', 'KTAG 7.020 Online EU Red PCB ECU Chip Tuning Tool', 'Automobiles, Parts & Accessories , Car Repair Tool , Diagnostic Tools');
  out('AGW', 'XDecoder 10.3 License Full Activated DTC Remover With Unlimited Keygen', 'Automobiles, Parts & Accessories , Car Repair Tool , Diagnostic Tools');
  out('AGW', 'KR5V2X ID47 433MHz Proximity Car Remote Key For Hyundai', 'Automobiles, Parts & Accessories , Car Lock System , Car Key');
  out('AGW', '7KW 32A EV Portable Charger Type 2', 'Automobiles, Parts & Accessories , New Energy Vehicle Parts & Accessories , Electric Vehicle Charging Equipment');
  out('AGW', 'Universal Mini Car Charger USB Type-C Adapter Hidden GPS Locator Track', 'Automobiles, Parts & Accessories , Car Electronics , GPS & Accessories');
  out('BGW', 'Motorcycle Helmet Full Face DOT Approved Racing', 'Motorcycle Equipments & Parts , Motorcycle Equipments , Helmets & Headwear');
  out('BGW', '72V 8000W Electric Bicycle Sur Ron Frame Ebike', 'Motorcycle Equipments & Parts , Motorcycle & ATV , Electric Motorcycle Parts');
  out('BGW', '48V 72V 5A Charger Lithium-ion Battery Pack Charger Scooter', 'Sports & Entertainment , Cycling , Scooters');
  out('SGW', 'Carbon Road Bikes R10 22S Full Hydraulic Disc Brake', 'Sports & Entertainment , Cycling , Bicycle');
  out('SGW', '4x32 Red Dot Sight Riflescope Hunting', 'Sports & Entertainment , Camping & Hiking , Outdoor Tools');
  out('SGW', 'Kids Swim Training Belt Adjustable Float Waist Belt', 'Sports & Entertainment , Water Sports , Swimming Accessories');
  out('SGW', 'Back Brace for Lower Back Pain Relief Lumbar Support', 'Sports & Entertainment , Fitness & Body Building , Sports Safety');
  out('PGW', 'R36 Ultra Retro Handheld Game Player 4.5 inch', 'Consumer Electronics , Games & Accessories , Handheld Game Players');
  out('PGW', 'MD Game Card 16 Bit with Box', 'Consumer Electronics , Games & Accessories , Memory Cards');
  out('TGW', 'VONTAR X5 Android 14 TV Box Amlogic', 'Consumer Electronics , Home Audio & Video , TV Receivers');
  out('TGW', 'Baofeng UV-5R Dual Band Two Way Radio', 'Phones & Telecommunications , Walkie Talkie , Walkie Talkie');
  out('TGW', '36V 15Ah 18650 Battery Pack 10S3P', 'Consumer Electronics , Accessories & Parts , Batteries');
  out('TGW', 'SAMSUNG SSD 870 EVO Internal Solid State Disk 2TB', 'Computer & Office , Storage Device , Solid State Drives');
  out('TGW', '2TB USB Flash Drive High Speed Metal Pen Drive', 'Computer & Office , Storage Device , USB Flash Drives');
  out('TGW', '200000mAh Power Bank Large Capacity Portable', 'Phones & Telecommunications Accessories , Mobile Phone Accessories , Power Bank');
  out('TGW', '433MHz Auto Copy Remote Control Garage Door Duplicator Clone', 'Consumer Electronics , Smart Electronics , Smart Remote Control');
  out('TGW', 'Smart Watch Non-invasive Blood Glucose Monitoring ECG', 'Consumer Electronics , Smart Electronics , Wearable Devices');
  out('ZGW', 'Rechargeable Dog Training Shock Collar Remote', 'Home & Garden , Pet Products , Dog & Cat Trainings');
  out('ZGW', '60 Pieces Veterinary Sutures 90 cm', 'Home & Garden , Pet Products , Collars, Harnesses & Leads（new）');
  // Words that only look like these: kept.
  for (const ok of ['Glue Gun 60W Hot Melt', 'Massage Gun Deep Tissue', '8GB RAM 128GB ROM Tablet', '3 Axes Gimbal Stabiliser', 'Exhaust Silencer 51mm', 'Bullet Connectors 4mm', 'Car Cigarette Lighter Socket Splitter']) {
    assert.equal(NEVER_MORE.test(ok.replace(/cigarette lighters?/gi, '12V socket')), false, ok);
  }
  assert.equal(at('AGW', 'LED Display Voltmeter Dual USB Phone Charger Car Cigarette Lighter Power Adapter Socket Splitter', 'Automobiles, Parts & Accessories , Electrical Equipment , Charging & Starting Systems'), 'diagnostics-battery > Charging & Starting');
});

test('L241: Garden and Construction Gear World rules (older engine): same shop, same feeds, their own categories', () => {
  const R = gc.RULES;
  assert.equal(R.key, 'aliexpress-uk-gc');
  assert.equal(R.advertiserId, 7035);
  assert.equal(R.retailer, 'AliExpress UK');
  assert.deepEqual(R.sites, ['ggw', 'cgw']);
  assert.equal(R.maxPrice, 1500);
  assert.equal(R.keepQuery, true);
  assert.deepEqual(gc.feedFiles('/x'), first.feedFiles('/x'));
  // The first wave's sites are never these two (each site's clean-up keeps to its own rules file).
  assert.ok(!first.RULES.sites.some(s => R.sites.includes(s)));
  assert.equal(gcAt('2.6m Stainless Steel Telescopic Spray Rod Garden Watering', 'Home & Garden , Garden Supplies , Watering & Irrigation'), 'ggw Watering & Irrigation > Watering Accessories');
  assert.equal(gcAt('Solar Wall Lamp Outdoor Waterproof Up and Down Garden', 'Lights & Lighting , Outdoor Lighting , Solar Lamps'), 'ggw Outdoor Lighting & Garden Electrical > Solar lights');
  assert.equal(gcAt('21V Cordless Leaf Blower 158CFM with 2 Batteries and Charger', 'Tools , Garden Tools , Garden Power Tools'), 'ggw Power Garden Tools > Outdoor Power Tools');
  assert.equal(gcAt('Right Angle Screwdriver 90 Degree Low Profile Ratcheting', 'Tools , Hand Tools , Screwdriver'), 'cgw Hand Tools > Hand Tools');
  assert.equal(gcAt('HSS Twist Drill Bit Set 13 Pcs 1-13mm Metric', 'Tools , Drill Bits, Saw Blades & Cutting Tools , Drill Bits'), 'cgw Power Tools > Power Tools');
  assert.equal(gcAt('Brass Pipe Adapter G1-1/2 Inch Drain Pipe Fitting', 'Home Improvement , Plumbing , Pipes & Fittings'), 'cgw Hand Tools > Plumbing Tools');
});

test('L241: Garden and Construction leave out safety gear, wiring, poisons, misfiled products and brand copies', () => {
  const out = (name, path) => assert.match(gcAt(name, path), /^out: /, name);
  out('Safety Helmet Hard Hat ABS Construction', 'Security & Protection , Emergency Safety Supplies , Workplace Safety Supplies');
  out('TOMZN Din Rail 2P ATS Dual Power Transfer Switch', 'Home Improvement , Electrical Equipment & Supplies , Circuit Breakers');
  out('Rat Poison Bait Station Outdoor', 'Home & Garden , Garden Supplies , Pest Control Products');
  out('3.2m Telescopic Ladder with Hooks', 'Industrial & Business , Handling, Warehousing & Transportation Equipment , Ladders');
  out('2026 20 inch Folding Bicycle Adult Portable', 'Tools , Tool Sets , Hand Tool Sets');
  out('Industrial Electric Rice Steamer 4 Trays', 'Furniture , Outdoor Furniture , Beach Chairs');
  out('Electric Scooter Three-Wheel Folding', 'Home & Garden , Garden Supplies , Garden Carts Supplies');
  out('Makita DTD153 Impact Driver 18V Brushless', 'Tools , Power Tools , Electric Drill');
  out('18V 6.0Ah Battery for Makita BL1860', 'Tools , Power Tool Parts & Accessories , Power Tool Battery');
  out('4 Burner Household Gas Stove 8.8KW', 'Home & Garden , Garden Supplies , Garden Buildings');
  out('ATOMSTACK 20W Laser Engraver', 'Tools , Laser Engraving Machine & Accessories , Laser Engravers');
  out('Chainsaw 220V EU Plug Electric', 'Tools , Garden Tools , Garden Power Tools');
});

test('L241: AliExpress UK shows in the UK on the newer sites too (default delivery, no special line)', async () => {
  for (const s of [...NEW_SITES, 'ggw', 'cgw']) {
    const cfg = (await import(`../../sites/${s}/site.config.js`)).default;
    assert.deepEqual(cfg.deliversTo.default, ['GB'], s);
    assert.equal(cfg.deliversTo.retailers['AliExpress UK'], undefined, s);
    assert.equal(isShown(viewFor(cfg, 'GB', Date.parse('2026-11-28T09:00:00Z')), { retailer: 'AliExpress UK', last_seen_at: '2026-11-28 08:00:00' }), true, s);
  }
});
