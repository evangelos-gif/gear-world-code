// Travel Gear World import plan (dry run): VGW rules on fake feeds, euro prices kept, baby gear and cosmetics out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planVgwImport } from '../../tools/vgw-import-plan.mjs';
import { classify, CATEGORY_SLUGS } from '../../sites/vgw/category-rules.js';
import site from '../../sites/vgw/site.config.js';

test('VGW rules put real-looking products in the right category', () => {
  const cases = [
    ['Samsonite S\'Cure Spinner 55cm Cabin Suitcase', 'Luggage > Suitcases', 'luggage-suitcases'],
    ['Cabin Max Metz Underseat Cabin Bag 40x20x25', 'Bags & Luggage', 'luggage-suitcases'],
    ['VEVOR Hard Shell Koffer met TSA slot 28 inch', 'Bagage > Koffers', 'luggage-suitcases'],
    ['Osprey Farpoint 40 Travel Backpack', 'Travel Bags', 'travel-bags-backpacks'],
    ['Eastpak Duffel Bag 60L', 'Luggage > Holdalls', 'travel-bags-backpacks'],
    ['Eagle Creek Pack-It Packing Cube Set', 'Travel Accessories', 'travel-accessories'],
    ['Hanging Toiletry Bag for Travel', 'Home > Bathroom', 'travel-accessories'],
    ['Digital Luggage Scale 50kg', 'Travel Accessories', 'travel-accessories'],
    ['Memory Foam Neck Pillow with Eye Mask', 'Travel Accessories', 'comfort-sleep'],
    ['Compression Flight Socks for Long Haul Travel', 'Health > Travel', 'comfort-sleep'],
    ['RFID Blocking Passport Holder Travel Wallet', 'Travel Accessories', 'documents-security'],
    ['TSA Approved Luggage Lock 2 Pack', 'Luggage Accessories', 'documents-security'],
    ['Universal Travel Adapter with 4 USB Ports', 'Electronics > Adapters', 'travel-tech'],
    ['Anker Power Bank 20000mAh for Travel', 'Electronics > Phone Accessories', 'travel-tech'],
    ['Vango Odyssey 3 Person Tent', 'Camping > Tents', 'camping-outdoor'],
    ['VEVOR Camping Stove Portable Gas', 'Outdoor > Camping', 'camping-outdoor'],
    ['Rechargeable Head Torch 500 Lumens', 'Camping & Hiking > Lighting', 'camping-outdoor'],
    ['Pop Up Beach Shelter UV50+', 'Beach & Garden', 'beach-holiday'],
    ['Full Face Snorkel Mask Set for Holiday', 'Sports > Swimming', 'beach-holiday']
  ];
  for (const [name, cat, slug] of cases) assert.equal(classify(name, cat).slug, slug, name);
});

test('VGW rules keep look-alikes out: baby travel gear, travel-size cosmetics, pets, plain home items', () => {
  for (const [name, cat] of [
    ['Joie Excursion Travel Cot', 'Baby > Travel'],
    ['Maxi-Cosi Pebble 360 Car Seat Travel System', 'Baby & Toddler'],
    ['Nivea Travel Size Shampoo 50ml', 'Beauty > Travel Size'],
    ['Chanel No 5 Eau de Parfum Travel Spray', 'Fragrance'],
    ['Dog Travel Crate Medium', 'Pets > Travel'],
    ['Lonely Planet Italy Travel Guide Book', 'Books > Travel'],
    ['Kids School Backpack Unicorn', 'Bags > Backpacks'],
    ['Bosch 18V Combi Drill', 'Power Tools > Drills'],
    ['Anker Power Bank 10000mAh', 'Electronics > Phone Accessories'],
    ['Fidget Spinner Toy', 'Toys'],
    ['Wood Burning Stove 5kW', 'Home > Heating'],
    ['Travel Insurance Voucher', 'Services']
  ]) assert.equal(classify(name, cat).ok, false, name);
});

test('first real dry run (22 Oct 2026): what was wrong now goes to the right place or stays out', () => {
  const SHOE = 'Apparel & Accessories > Shoe Accessories > Shoelaces'; // where Joybuy files its suitcases
  const ok = [
    ['Kono 28 Inch Expandable ABS+PC Hard Shell Large Suitcase with TSA Lock and Silent Spinner Wheels', SHOE, 'luggage-suitcases'],
    ['Kono 20 Inch Zipperless Aluminium Frame PC Hard Shell Cabin Suitcase with TSA Lock, Cup Holder', SHOE, 'luggage-suitcases'],
    ['Kono 40x20x25cm Ryanair Under Seat Holdall, 20L Lightweight Cabin Hand Luggage for Travel', SHOE, 'luggage-suitcases'],
    ['NINETYGO Danube Luggage, 100% Hard PC Shell, Airline Approved, Ideal for 5-7 Day Trips', SHOE, 'luggage-suitcases'],
    ['Kono Foldable Rolling Duffel Bag with Wheels and Telescopic Handle, 55L Carry On Trolley', SHOE, 'luggage-suitcases'],
    ['KONO Women\'s Lightweight Multi-Pocket Crossbody Bag with RFID Protection for Travel', 'Apparel & Accessories > Clothing > Underwear & Socks', 'travel-bags-backpacks'],
    ['PELLIOT Outdoor Hiking Lightweight Rucksack Backpack Travel Backpack Black', 'Sporting Goods > Outdoor Recreation > Cycling', 'travel-bags-backpacks'],
    ['Kono 6-Piece Packing Cubes Set, Travel Luggage Organiser Bags with Mesh Top', 'Home & Garden > Household Supplies > Storage', 'travel-accessories'],
    ['JORDAN&JUDY 4-Fold Travel Toiletry Bag, 1pc, Green-Pink Stripe', 'Home & Garden > Household Supplies > Storage', 'travel-accessories'],
    ['Mobi Garden, Press-to-Inflate U-Shaped Neck Pillow, Soft Comfortable Travel Pillow', 'Sporting Goods > Outdoor Recreation > Camping & Hiking > Camp Furniture', 'comfort-sleep'],
    ['toocki Universal Travel Adapter 45W PD Fast Charger Adapter - International Power', 'Electronics > Electronics Accessories > Cables', 'travel-tech'],
    ['SJCAM C400 Pocket Action Camera 4K Video for Travel and Vlogging', 'Cameras & Optics > Cameras > Digital Cameras', 'travel-tech'],
    ['VEVOR Koepeltent 4 personen camping waterdicht', 'Sport en buitenshuis > Campinguitrusting > Tenten > Campingtenten', 'camping-outdoor'],
    ['Milestone Camping Tent Pegs Heavy Duty Ripple Angled 10pcs', 'Sporting Goods > Outdoor Recreation > Camping & Hiking > Tent Accessories', 'camping-outdoor'],
    ['DJI Power 1000 Portable Power Station, 1024Wh LiFePO4 Battery', 'Sporting Goods > Outdoor Recreation > Camping & Hiking > Camping Tools', 'camping-outdoor'],
    ['PELLIOT Waterproof Bag Unisex Dry Bag Storage Water Sports for Beach and Hiking', 'Sporting Goods > Outdoor Recreation > Boating & Water Sports', 'beach-holiday'],
    ['TOP-EX Women\'s Wide Brim Bucket Sun Hat Summer Packable Sunhat for Beach', 'Apparel & Accessories > Clothing Accessories > Hats', 'beach-holiday']
  ];
  for (const [name, cat, slug] of ok) assert.equal(classify(name, cat).slug, slug, name);
  for (const [name, cat] of [
    ['Korean Pokémon Trading Card Game (TCG) Ninja Spinner Booster Box', 'Toys & Games > Games > Card Games'],
    ['Faber-Castell Connector Felt-Tip Pen Suitcase', 'Office Supplies > Office Instruments'],
    ['PELLIOT Hard shell jacket Black M Unisex Camping Travel Waterproof Durable', 'Apparel & Accessories > Clothing > Outerwear'],
    ['Turtle Wax Original Car Wax Super Hard Shell Finish Spray 500ml', 'Vehicles & Parts > Vehicle Parts & Accessories'],
    ['VEVOR Pistoolkluis met vingerafdruk, draagbare koffer', 'Hulpmiddelen > Veiligheid en beveiliging > Kluizen > Pistoolkluizen'],
    ['VEVOR Gitaar harde koffer voor elektrische gitaar', 'Muziekinstrumenten > Opslag van muziekinstrument > Gitaar harde kast'],
    ['VEVOR Lager- en afdichtingsdriverset in koffer', 'Automobiel > Mechanics Tools > Lager- en afdichtingsdriverset'],
    ['VEVOR Opblaasbare Spuitcabine Tent 8x4.5x3m', 'Verf > Verfbenodigdheden > Opblaasbare spuitcabine'],
    ['MISSADOLA Beach Swim Vacation Two-Piece Swimsuit Blue S', 'Sporting Goods > Outdoor Recreation > Boating & Water Sports'],
    ['Always Discreet Incontinence Pants Women L 7 Pants', 'Home & Garden > Linens & Bedding > Towels > Beach Towels'],
    ['Always Ultra Sanitary Towels with Wings Size 3 Long Plus 9 Pads', 'Home & Garden > Linens & Bedding > Towels > Beach Towels'],
    ['Harry Potter Officially Licensed Stickers Pack Waterproof PVC Vinyl Decals for Luggage', 'Toys & Games > Toys > Art & Drawing Toys'],
    ['SK-II PITERA Beauty Travel Kit - 9 Items (Essence, Lotion, Cleanser, Cream, Mask)', 'Health & Beauty > Personal Care > Cosmetics'],
    ['Artiste Watercolour Travel Kit - 12 Colours with Water Brush', 'Office Supplies > Office Instruments'],
    ['Summer Cooler Bag Insulated Lunch Backpack for Women Men 15.6-Inch Laptop and Travel Bag', 'Home & Garden > Kitchen & Dining > Food & Beverage Carriers'],
    ['UTRAI 7000A Jump Starter Powerbank, 12V Car Jump Starter with Air Pump for Travel', 'Vehicles & Parts > Vehicle Parts & Accessories'],
    ['JOYFURNOS Ink Black Long Foldable Storage Ottoman, Foot Rest for Travel', 'Furniture > Ottomans'],
    ['FLORA GUARD ZDJ-1 7.7 INCH Folding Hand Saw, Camping/Pruning Saw', 'Home & Garden > Lawn & Garden > Gardening'],
    ['SUCOJIA 304 Stainless Steel 50-Pack Kebab Skewers Barbecue', 'Sporting Goods > Outdoor Recreation > Camping & Hiking > Camping Tools'],
    ['ECOODA Carbon Sea Bass Rod, Freshwater Fishing Rod', 'Sporting Goods > Outdoor Recreation > Fishing'],
    ['VEVOR Verwarmde Fleecejas voor Dames, 7,4V 16000mAh Oplaadbare powerbank', 'Werkkleding > Verwarmde kleding en uitrusting'],
    ['Oral-B iO6 Electric Toothbrush, Travel Case, 5 Modes, App Guidance, AI Tracker', 'Health & Beauty > Personal Care > Oral Care'],
    ['Turtle Beach Stealth 500 Wireless Gaming Headset for Xbox & PC - Arctic Camo', 'Electronics > Audio > Headphones']
  ]) assert.equal(classify(name, cat).ok, false, name);
});

test('every site category has rules, and the menu order matches the site', () => {
  assert.deepEqual(CATEGORY_SLUGS, site.categories.map(c => c.slug));
});

test('plan: keeps euro prices, leaves out-of-stock and non-travel rows out, writes SQL that is not executed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vgw-plan-'));
  const out = join(dir, 'out');
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean\n';
  const link = (p, m) => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=${m}`;
  writeFileSync(join(dir, 'AWIN_123932_114093.csv.gz'), gzipSync(head
    + `${link(1, 123932)},Hard Shell Spinner Suitcase 68cm,1,J-1,https://img.example/1.jpg,Luggage > Suitcases,59.99,GBP,Wayfarra,1,5051747000000\n`
    + `${link(2, 123932)},Bosch 18V Combi Drill,2,J-2,https://img.example/2.jpg,Power Tools > Drills,99.95,GBP,Bosch,1,\n`
    + `${link(3, 123932)},Memory Foam Neck Pillow for Travel,3,J-3,https://img.example/3.jpg,Travel Accessories,12.95,GBP,Northbay,0,\n`));
  writeFileSync(join(dir, 'AWIN_118435_109014.csv.gz'), gzipSync(head
    + `${link(4, 118435)},VEVOR Koepeltent 4 personen camping,4,V-1,https://img.example/4.jpg,Kamperen > Tenten,90.99,EUR,VEVOR,1,\n`
    + `${link(5, 118435)},VEVOR Travel Cot for Babies,5,V-2,https://img.example/5.jpg,Baby,49.99,EUR,VEVOR,1,\n`));
  const sources = join(dir, 'sources.json');
  writeFileSync(sources, JSON.stringify({ sources: [
    { advertiserId: 123932, feedIds: [114093], retailer: 'Joybuy', currency: 'GBP', approved: true },
    { advertiserId: 118435, feedIds: [109014], retailer: 'VEVOR', currency: 'EUR', approved: true }
  ] }));
  const { stats, report } = await planVgwImport({ archive: dir, sourcesFile: sources, outDir: out, now: new Date('2026-10-22T12:00:00Z') });
  assert.equal(stats.rows, 5);
  assert.equal(stats.accepted, 2);
  assert.equal(stats.perCategory['luggage-suitcases'], 1);
  assert.equal(stats.perCategory['camping-outdoor'], 1);
  assert.equal(stats.rejected['out of stock'], 1);
  assert.match(report, /VGW IMPORT PLAN/);
  const sql = readFileSync(join(out, 'sql', readdirSync(join(out, 'sql')).find(f => f === '0001.sql')), 'utf8');
  assert.match(sql, /-- VGW import plan .* NOT executed/);
  assert.match(sql, /'VEVOR', 'camping-outdoor'.*'EUR'/);
});
