// The product page <title>: brand first and the model number in it, only where the feed's data can be trusted
// (lessons L217). The examples are real rows of the 13 sites' databases (22/11/2026, read only), and the cases an
// independent review found.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { titleName, titleNameParts, TITLE_NAME_MAX } from '../../src/lib/title.js';
import { truncate } from '../../src/lib/text.js';
import { productPage } from '../../src/pages/product.js';
import tgw from '../../sites/tgw/site.config.js';
import cgw from '../../sites/cgw/site.config.js';
import wgw from '../../sites/wgw/site.config.js';

const t = (product_name, brand, retailer, mpn = null, gtin = null, site) => titleNameParts({ product_name, brand, retailer, mpn, gtin }, site);
// Nothing may change: exactly the old name part.
const same = (name, brand, retailer, mpn = null, gtin = null, site) =>
  assert.deepEqual(t(name, brand, retailer, mpn, gtin, site), { name: truncate(name, TITLE_NAME_MAX), steps: [] }, `${name} / ${brand} / ${retailer}`);

test('the model number goes at the end, only when it fits without cutting the name', () => {
  assert.deepEqual(t('HP 963XL High Yield Cyan Original Ink Cartridge', 'HP', 'Back to the Office', '3JA27AE', '0193905535289'),
    { name: 'HP 963XL High Yield Cyan Original Ink Cartridge 3JA27AE', steps: ['model'] });
  assert.equal(t('Sealey Premier Folding Engine Crane', 'Sealey', 'Tooled Up', 'SPC1000').name, 'Sealey Premier Folding Engine Crane SPC1000');
  assert.equal(t('Olpro USB Battery Portable Shower', 'Olpro', 'Camping World UK', 'OL537').name, 'Olpro USB Battery Portable Shower OL537');
  assert.equal(t('Makita Comet Continuous Rim Diamond Tile Cutting Disc', 'Makita', 'Tooled Up', 'B-13063').name,
    'Makita Comet Continuous Rim Diamond Tile Cutting Disc B-13063');
  // Too long with the code: the name stays whole and the code stays out (no "…" before a code).
  same('Draper Drive Belt Spanner for Audi, Skoda and Volkswagen Vehicles', 'Draper', 'Tooled Up', 'ETK231');
});

test('a code that is not the maker\'s model number never goes in', () => {
  same('Delock 83163 Usb-a Extension Cable Silver', 'Delock', 'TechInn', '143886445', '4043619831630'); // TradeInn's own number
  same('Alpinestars Andes V3 Drystar Jacket Dark Blue Black', 'Alpinestars', 'Alpinestars', '8059175280733', '8059175280733');
  same('Alienware AW720M Wireless Gaming Mouse - White', 'Alienware', 'Back to the Office', 'AW720M'); // already in the name
  same('Knox Hadleigh Black', 'Knox', 'Chromeburner', 'Hadleigh Waterproof MK2'); // spaces
  same('Mascow Dog Bed - 57x75x83cm', 'Mascow', 'Plusshop UK', 'S3605743-GRY'); // stock code
  same('Alpinestars History Hat Grey Heather/Blue', 'Alpinestars casual', 'Webbs Motorcycles', 'ALCHIS'); // no digit
  for (const code of ['SIZE10', 'BLK-10', '500ml', 'EU42', '2.5L']) same('Bridgedale Hike Crew Socks', 'Bridgedale', 'Cotswold Outdoor', code);
});

test('the brand goes in front where the name has none, only when the whole name still fits', () => {
  assert.equal(t('Arahi 9 Wide Women\'s Road Running Shoes', 'HOKA', 'Coes').name, 'HOKA Arahi 9 Wide Women\'s Road Running Shoes');
  assert.equal(t('32oz Wide Flex Straw Cap Water Bottle', 'Hydro Flask', 'Coes').name, 'Hydro Flask 32oz Wide Flex Straw Cap Water Bottle');
  assert.equal(t('Ikoni 3.5 Trainers', 'Karhu', 'Coes').name, 'Karhu Ikoni 3.5 Trainers');
  assert.equal(t('Multi-Vitamin + Antioxidants PM Eye Treatment', '100% PURE', '100 Percent Pure').name,
    '100% PURE Multi-Vitamin + Antioxidants PM Eye Treatment');
  assert.deepEqual(t('Solenoid Valve 3/2 NO G1/4\'\' Brass FKM 24VDC', 'Burkert', 'Tameson'),
    { name: 'Burkert Solenoid Valve 3/2 NO G1/4\'\' Brass FKM 24VDC', steps: ['added'] });
  // Review finding 1: the sizes made these four titles different; with the brand in front they would all be cut to the
  // same 70 characters. Nothing is added, so they stay different.
  const socks = ['S', 'M', 'L', 'XL'].map(size => `Women's Merino Wool Light Hiking Crew Socks Charcoal Grey Size ${size}`);
  for (const n of socks) same(n, 'Bridgedale', 'Cotswold Outdoor');
  assert.equal(new Set(socks.map(n => titleName({ product_name: n, brand: 'Bridgedale', retailer: 'Cotswold Outdoor' }))).size, 4);
  same('Welded End DN 50 NC Pneumatic 2-Way Angle Seat Valve Stainless Steel - 2000', 'Burkert', 'Tameson');
  // Second review: the same for the brand from the end. Long names keep their size or colour, so they stay different.
  for (const size of ['10', '12', '14']) same(`Recycled Quilted Puffer Gilet With Detachable Hood Black | Size ${size} | Ted Baker`, 'Ted Baker', 'Ted Baker UK');
  for (const colour of ['Black', 'Navy', 'Olive']) same(`Mens Waterproof Breathable Hiking Jacket With Packable Hood - ${colour} - Berghaus`, 'Berghaus', 'Cotswold Outdoor');
  // A glued form of the brand is already the brand.
  same('Compatible battery for Makita-style tools 18V', 'Makita Tools', 'Tooled Up');
});

test('the brand is not added where the feed\'s brand is a seller, a label of the retailer, a parent of a short form, or not a brand', () => {
  same('78 in 1 Precision Electric Screwdriver Kit with 5 Torque Levels', 'Mira Sales', 'InStock UK');
  same('Vital Baby Scoop Travel Feeding Set - Natural Berry', 'Pushchair Expert', 'InStock UK');
  same('PAPO Wild Animal Kingdom Panda and Baby Panda Toy Figure', 'Hipeon', 'InStock UK');
  same('Mens Luxury Pyjama Trousers Loungewear Jogging Bottoms', 'Sock Snob', 'InStock UK');
  same('Pro Connect 28m 1400 Traditional Warm White Connectable Icicle Lights', 'Lights4fun.co.uk', 'Lights4fun');
  same('White Outdoor Scatter Cushions with Colourful Piping', 'GardenistaUK Store', 'Gardenista');
  same('Kaikoo Double Fabric Chairbed Flint Grey Convertible Sofa Bed Guest', 'Cheap Furniture Warehouse', 'Cheap Furniture Warehouse');
  same('Keter California Taupe Rattan Coffee Table 68 x 68cm', 'MINT Outdoor', 'Mint Outdoor');
  same('Tavamo 180 Dining Table - Black Oak', 'Dream Interiors', 'Dream Interiors');
  same('Glerc 14 Inch Kids Bike With Water Bottle - Fantacy - White', 'GlercBikesUK', 'InStock UK');
  same('Glerc 14 Inch Kids Bike With Water Bottle - Fantacy - White', 'Glerc Bikes', 'Bazta UK');
  same('Schildkröt Ogo Sport Disk Set', 'Schildkrot', 'Plusshop UK');
  same('Wham Small Dog Bowl - Green', 'What Wham', 'Plusshop UK');
  same('Gurli Pig Gurli\'s Unicorn Bath Toy', 'Peppa Pig', 'Plusshop UK');
  same('CK Electricians Draw Tape 15.2m', 'CK Tools', 'Tooled Up');
  same('CarPlan SWA025 All Seasons Screenwash 2.5L', 'Tetrosyl', 'SGS Engineering');
  same('Origin Storage Dell 45W 2.31A AC Adapter Power Charger', 'Dell', 'Back to the Office');
  // Review finding 6: a short form at the start is already a brand.
  same('HP 963XL High Yield Black Ink', 'Hewlett Packard', 'Back to the Office', '3JA30AE');
  same('VW Golf Mk7 Floor Mats', 'Volkswagen', 'Halfords');
  // Review finding 4: junk values and words the sites never show (L107) in the brand field.
  for (const junk of ['OEM', 'NONE', 'Generic', 'Unbranded', 'n/a', '', 'No Brand', 'Does Not Apply', 'null', 'N.A.',
    'Not Applicable', 'Unbranded/Generic', 'No Name', 'Various Brands', 'Own Label', '00', '--', '??', 'Sale', 'Official Merch',
    'Partner Brand', 'Best Deals']) {
    same('Universal Phone Holder For Car Air Vent', junk, 'Tooled Up', 'AB123');
  }
});

test('other-language feeds, marketplaces and Greek names stay exactly as they are', () => {
  same('Ρακέτα Τένις Wilson Roland Garros Team 102', 'Wilson', 'e-tennis GR');
  same('adidas Team Icon 23 Jr HR2632 Tshirt', 'adidas performance', 'Mybrand.shoes GR');
  same('Dla Renault Clio 4 podłokietnik do Renault Captur', 'anoeh', 'AliExpress PL');
  same('LE100 360 Black AIO Liquid CPU Cooler', 'TCOMAS', 'Joybuy');
  same('Θήκη Orso Cloud Magsafe Red iPhone 14 Pro Max', 'OEM', 'The iStore.gr GR');
  same('Zestaw walizek 3 szt Twarde ABS+ PLOVER', 'W WINGS', 'AliExpress PL', 'AB12');
  // Review finding 7: a feed named in the site's deliversTo.languages (bol.com, Dutch), and Polish/Czech/Cyrillic names
  // from a retailer without a country code.
  assert.equal(tgw.deliversTo.languages['bol.com'], 'nl');
  same('Koffiezetapparaat met timer, zwart', 'Princess', 'bol.com', 'PR246010', null, tgw);
  same('Ekspres do kawy z młynkiem', 'Philips', 'Kawa Direct Europe');
  same('Кофеварка капельная', 'Philips', 'Some Retailer');
});

test('small fixes: the brand from the end, a doubled brand word, a short brand\'s capitals, "Mens Nike"', () => {
  assert.deepEqual(t('Tour Shirt (Choc Chip Camo) | XXL | Stan Ray®', 'Stan Ray®', 'Stan Ray UK'),
    { name: 'Stan Ray Tour Shirt (Choc Chip Camo) | XXL', steps: ['tail'] });
  // No separator left over when the name has two in a row.
  assert.deepEqual(t('Shirt | | Nike', 'Nike', 'Sports Direct'), { name: 'Nike Shirt', steps: ['tail'] });
  assert.deepEqual(t('Shirt - - Nike', 'Nike', 'Sports Direct'), { name: 'Nike Shirt', steps: ['tail'] });
  assert.deepEqual(t('DEWALT DEWALT DT20711 Multi-Tool Titanium Flush Cut Blade 100mm', 'DEWALT', 'GS Workwear'),
    { name: 'DEWALT DT20711 Multi-Tool Titanium Flush Cut Blade 100mm', steps: ['double'] });
  assert.equal(t('Draper Draper TX-STAR Security Screwdriver (T27T x 100mm)', 'Draper Tools', 'GS Workwear').name,
    'Draper TX-STAR Security Screwdriver (T27T x 100mm)');
  assert.equal(t('Miffy Miffy Head Luggage Tag - White', 'Miffy', 'Case Luggage').name, 'Miffy Head Luggage Tag - White');
  assert.deepEqual(t('Hjc C-91 Nepos Flip Front Motorcycle Helmet Yellow', 'HJC', 'Webbs Motorcycles'),
    { name: 'HJC C-91 Nepos Flip Front Motorcycle Helmet Yellow', steps: ['case'] });
  assert.deepEqual(t('Mens Nike Air Max 90 Trainers', 'Nike', 'Sports Direct'), { name: 'Nike Mens Air Max 90 Trainers', steps: ['moved'] });
  // A doubled word that is not the brand stays: "Bora Bora" is a place.
  assert.equal(t('Bora Bora Printed Swimsuit', 'Seafolly', 'Swimwear Galore').name, 'Seafolly Bora Bora Printed Swimsuit');
  // Brand already first in another form: nothing to do.
  for (const [name, brand] of [['BlueSpot Soft Grip Plastering Trowel 11"', 'Blue Spot'], ['Bosch UNIVERSALHEDGECUT 18V-55 Hedge Trimmer', 'Bosch Home and Garden'],
    ['adidas Duramo SL 2.0 Running Shoes', 'adidas performance'], ['REV’IT! Endo Ladies Black White Gloves', "REV'IT!"]]) same(name, brand, 'Tooled Up');
});

test('the review\'s wrong outputs stay as they were', () => {
  // Finding 2: brands that are a doubled word.
  same('Chi Chi London Lace Midi Dress', 'Chi Chi London', 'Chi Chi London');
  same('Duran Duran Rio T-Shirt', 'Duran Duran', 'Band Merch Co');
  same('Tom Tom GO Navigator 6', 'Tom Tom', 'Halfords');
  // Finding 3: "The", "Original" and "New" belong to brand names.
  same('The North Face Nuptse Jacket Black', 'North Face', 'Cotswold Outdoor');
  same('The Original Muck Boot Company Arctic Sport Boots', 'Muck Boot', 'Cotswold Outdoor');
  same('Original Penguin Polo Shirt Navy', 'Penguin', 'Coes');
  // Finding 5: longer brands written in capitals in the feed keep the name's writing.
  for (const [n, b] of [['Apple iPhone 15 Pro 128GB Natural Titanium', 'APPLE'], ['Bosch GSB 18V-55 Combi Drill', 'BOSCH'],
    ['Canon PIXMA TS5350i Printer', 'CANON'], ['Nike Air Max 90 Trainers', 'NIKE']]) same(n, b, 'Back to the Office');
  // Finding 8: a dash inside a word is not a separator.
  same('Pressure Washer Nozzle Turbo-Jet', 'Jet', 'Tooled Up');
  // Finding 9: "$" in a name is text, and "DEWALT DEWALT-DT20711" is not a doubled word.
  assert.deepEqual(t("A$'B A$'B Poster Print", "A$'B", 'Tooled Up'), { name: "A$'B Poster Print", steps: ['double'] });
  same('DEWALT DEWALT-DT20711 Blade', 'DEWALT', 'GS Workwear');
  // Finding 10: a brand is a whole word, never a part of one.
  same('Onesie for babies grey', 'On', 'Coes', 'AB1234');
});

// Review finding 12: the rule "no step = exactly the old name" for any input.
test('fuzz: whenever no step runs, the name is exactly the old one; never empty, never over 70 characters', () => {
  // A small seeded generator (mulberry32), so the run is the same every time.
  let seed = 217;
  const rnd = n => {
    seed = (seed + 0x6D2B79F5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return Math.floor(((x ^ (x >>> 14)) >>> 0) / 4294967296 * n);
  };
  const parts = ['Nike', 'nike', 'NIKE', 'The', 'Mens', 'Air', 'Max', '|', '-', '–', ',', 'XL', 'Stan', 'Ray®', 'Bosch', 'DEWALT',
    'Ω', 'ł', '$&', '(', ')', '[', '\\', '?', '+', '*', 'Chi', '10ml', 'A1B2', ' ', '', 'Tom', 'Tom', 'Gear', 'World', 'Sale',
    'HJC', 'Hjc', 'Jacket', 'Size', '10', 'Black'];
  const pick = k => Array.from({ length: k }, () => parts[rnd(parts.length)]).join(' ');
  const seen = {};
  for (let i = 0; i < 20000; i++) {
    const brand = rnd(5) ? pick(1 + rnd(3)) : null;
    // Some names end with a separator and the brand, start with the brand in other capitals, or with "Mens" and the brand.
    const body = pick(1 + rnd(14));
    const shape = rnd(5);
    const product_name = shape === 0 && brand ? `${body} ${['|', ',', '-', '–'][rnd(4)]} ${brand}`
      : shape === 1 && brand ? `${brand.toLowerCase()} ${body}` : shape === 2 && brand ? `Mens ${brand} ${body}` : body;
    const p = { product_name, brand, retailer: ['Tooled Up', 'Coes', 'AliExpress PL', 'e-tennis GR', 'InStock UK', 'Plusshop UK', 'bol.com', ''][rnd(8)],
      mpn: rnd(3) ? pick(1) : null, gtin: rnd(4) ? null : '5012345678900' };
    const out = titleNameParts(p, tgw);
    for (const step of out.steps) seen[step] = (seen[step] || 0) + 1;
    const old = truncate(p.product_name, TITLE_NAME_MAX);
    assert.ok(out.name.length <= TITLE_NAME_MAX, JSON.stringify(p));
    if (old) assert.ok(out.name.length > 0, JSON.stringify(p));
    if (!out.steps.length) assert.equal(out.name, old, JSON.stringify(p));
  }
  // The fuzz reaches every step.
  for (const step of ['double', 'case', 'tail', 'moved', 'added', 'model']) assert.ok(seen[step] > 0, `fuzz reached ${step}: ${JSON.stringify(seen)}`);
  for (const bad of [null, undefined, {}, { product_name: 42, brand: 7, mpn: 3, retailer: 1 }, { product_name: '   ', brand: 'Nike' }]) {
    assert.doesNotThrow(() => titleName(bad, tgw));
  }
  assert.equal(titleName(null), '');
});

const product = (over = {}) => ({
  id: 101, product_name: 'Sealey Premier Folding Engine Crane', brand: 'Sealey', retailer: 'Tooled Up', mpn: 'SPC1000',
  gtin: '5051747471573', price: 299.99, was_price: null, currency: 'GBP', in_stock: 1, item_condition: 'new',
  image_url: 'https://img.example/a.jpg', category_slug: 'garage-equipment', last_seen_at: '2026-11-21 10:00:00', offer_count: 1, ...over
});
const titleOf = html => (html.match(/<title>([^<]*)<\/title>/) || [])[1];

test('the product page: only the <title> and og:title change; the H1 and the Product structured data keep the retailer\'s name', () => {
  const html = productPage(tgw, product(), null, []);
  assert.equal(titleOf(html), 'Sealey Premier Folding Engine Crane SPC1000 | £299.99 | Technology Gear World');
  assert.match(html, /<meta property="og:title" content="Sealey Premier Folding Engine Crane SPC1000 \| £299\.99 \| Technology Gear World">/);
  assert.match(html, /<h1[^>]*>Sealey Premier Folding Engine Crane<\/h1>/);
  assert.match(html, /"@type":"Product","name":"Sealey Premier Folding Engine Crane"/);
  // The brand from the feed is escaped like any text.
  const risky = productPage(tgw, product({ product_name: 'Grip Handles', brand: 'A<b>&"C', mpn: null }), null, []);
  assert.equal(titleOf(risky), 'A&lt;b&gt;&amp;&quot;C Grip Handles | £299.99 | Technology Gear World');
});

test('the product page with nothing to change: the title is byte for byte the old one; the older layout gives the fields', () => {
  const plain = product({ product_name: 'BlueSpot Soft Grip Plastering Trowel 11"', brand: 'Blue Spot', mpn: null, price: 9.5 });
  assert.equal(titleOf(productPage(cgw, plain, null, [])), 'BlueSpot Soft Grip Plastering Trowel 11&quot; | £9.50 | Construction Gear World');
  const stan = product({ product_name: 'Tour Shirt (Choc Chip Camo) | XXL | Stan Ray®', brand: 'Stan Ray®', retailer: 'Stan Ray UK', mpn: null, price: 85 });
  assert.equal(titleOf(productPage(wgw, stan, null, [])), 'Stan Ray Tour Shirt (Choc Chip Camo) | XXL | £85.00 | Women&#39;s Gear World');
  // The older layout (src/db.js) reads the brand, the retailer, the GTIN from ean and the model number from specs_json,
  // under the names the title uses.
  const db = readFileSync('src/db.js', 'utf8');
  assert.match(db, /AS gtin,/);
  assert.match(db, /json_extract\(specs_json, '\$\.mpn'\) AS mpn,/);
  assert.match(db, /SELECT id, product_name, NULL AS product_slug, brand, \$\{retailerExpr\} AS retailer/);
});
