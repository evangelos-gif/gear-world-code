// The product page <title>: brand first and the model number in it, only where the feed's data can be trusted
// (lessons L217). The examples are real rows of the 13 sites' databases (22/11/2026, read only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleName, titleNameParts, TITLE_NAME_MAX } from '../../src/lib/title.js';
import { truncate } from '../../src/lib/text.js';
import { productPage } from '../../src/pages/product.js';
import tgw from '../../sites/tgw/site.config.js';
import cgw from '../../sites/cgw/site.config.js';
import wgw from '../../sites/wgw/site.config.js';

const t = (product_name, brand, retailer, mpn = null, gtin = null) => titleNameParts({ product_name, brand, retailer, mpn, gtin });

test('the model number goes at the end, only when it fits without cutting the name', () => {
  assert.deepEqual(t('HP 963XL High Yield Cyan Original Ink Cartridge', 'HP', 'Back to the Office', '3JA27AE', '0193905535289'),
    { name: 'HP 963XL High Yield Cyan Original Ink Cartridge 3JA27AE', steps: ['model'] });
  assert.equal(t('Sealey Premier Folding Engine Crane', 'Sealey', 'Tooled Up', 'SPC1000').name, 'Sealey Premier Folding Engine Crane SPC1000');
  assert.equal(t('Olpro USB Battery Portable Shower', 'Olpro', 'Camping World UK', 'OL537').name, 'Olpro USB Battery Portable Shower OL537');
  assert.equal(t('Makita Comet Continuous Rim Diamond Tile Cutting Disc', 'Makita', 'Tooled Up', 'B-13063').name,
    'Makita Comet Continuous Rim Diamond Tile Cutting Disc B-13063');
  // Too long with the code: the name stays whole and the code stays out (no "…" before a code).
  const long = t('Draper Drive Belt Spanner for Audi, Skoda and Volkswagen Vehicles', 'Draper', 'Tooled Up', 'ETK231');
  assert.equal(long.name, 'Draper Drive Belt Spanner for Audi, Skoda and Volkswagen Vehicles');
  assert.deepEqual(long.steps, []);
});

test('a code that is not the maker\'s model number never goes in', () => {
  // TradeInn's own number, a GTIN in the mpn field, a code already in the name, a code with spaces, a stock code.
  assert.deepEqual(t('Delock 83163 Usb-a Extension Cable Silver', 'Delock', 'TechInn', '143886445', '4043619831630').steps, []);
  assert.deepEqual(t('Alpinestars Andes V3 Drystar Jacket Dark Blue Black', 'Alpinestars', 'Alpinestars', '8059175280733', '8059175280733').steps, []);
  assert.deepEqual(t('Alienware AW720M Wireless Gaming Mouse - White', 'Alienware', 'Back to the Office', 'AW720M').steps, []);
  assert.deepEqual(t('Knox Hadleigh Black', 'Knox', 'Chromeburner', 'Hadleigh Waterproof MK2').steps, []);
  assert.deepEqual(t('Mascow Dog Bed - 57x75x83cm', 'Mascow', 'Plusshop UK', 'S3605743-GRY').steps, []);
  assert.deepEqual(t('Alpinestars History Hat Grey Heather/Blue', 'Alpinestars casual', 'Webbs Motorcycles', 'ALCHIS').steps, []);
});

test('the brand goes in front where the name has none', () => {
  assert.equal(t('Arahi 9 Wide Women\'s Road Running Shoes', 'HOKA', 'Coes').name, 'HOKA Arahi 9 Wide Women\'s Road Running Shoes');
  assert.equal(t('32oz Wide Flex Straw Cap Water Bottle', 'Hydro Flask', 'Coes').name, 'Hydro Flask 32oz Wide Flex Straw Cap Water Bottle');
  assert.equal(t('Ikoni 3.5 Trainers', 'Karhu', 'Coes').name, 'Karhu Ikoni 3.5 Trainers');
  assert.equal(t('Multi-Vitamin + Antioxidants PM Eye Treatment', '100% PURE', '100 Percent Pure').name,
    '100% PURE Multi-Vitamin + Antioxidants PM Eye Treatment');
  const valve = t('Welded End DN 50 NC Pneumatic 2-Way Angle Seat Valve Stainless Steel - 2000', 'Burkert', 'Tameson');
  assert.equal(valve.name, truncate('Burkert Welded End DN 50 NC Pneumatic 2-Way Angle Seat Valve Stainless Steel - 2000', TITLE_NAME_MAX));
  assert.deepEqual(valve.steps, ['added']);
});

test('the brand is not added where the feed\'s brand is a seller, a label of the retailer, or not a brand', () => {
  const same = (name, brand, retailer) => assert.deepEqual(t(name, brand, retailer), { name: truncate(name, TITLE_NAME_MAX), steps: [] }, `${brand} / ${retailer}`);
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
  for (const junk of ['OEM', 'NONE', 'Generic', 'Unbranded', 'n/a', '']) same('Universal Phone Holder For Car Air Vent', junk, 'Tooled Up');
});

test('other-language feeds, marketplaces and Greek names stay exactly as they are', () => {
  const same = (name, brand, retailer, mpn) => assert.deepEqual(t(name, brand, retailer, mpn), { name: truncate(name, TITLE_NAME_MAX), steps: [] }, retailer);
  same('Ρακέτα Τένις Wilson Roland Garros Team 102', 'Wilson', 'e-tennis GR');
  same('adidas Team Icon 23 Jr HR2632 Tshirt', 'adidas performance', 'Mybrand.shoes GR');
  same('Dla Renault Clio 4 podłokietnik do Renault Captur', 'anoeh', 'AliExpress PL');
  same('Kabel SATA do USB 3.0 / 2.0, prędkość transmisji danych do 6 Gb/s', 'NONE', 'AliExpress PL');
  same('LE100 360 Black AIO Liquid CPU Cooler', 'TCOMAS', 'Joybuy');
  same('Θήκη Orso Cloud Magsafe Red iPhone 14 Pro Max', 'OEM', 'The iStore.gr GR');
  same('Zestaw walizek 3 szt Twarde ABS+ PLOVER', 'W WINGS', 'AliExpress PL', 'AB12');
});

test('small fixes: the brand from the end, a doubled brand word, the brand\'s capitals, "Mens Nike"', () => {
  assert.deepEqual(t('Tour Shirt (Choc Chip Camo) | XXL | Stan Ray®', 'Stan Ray®', 'Stan Ray UK'),
    { name: 'Stan Ray Tour Shirt (Choc Chip Camo) | XXL', steps: ['tail'] });
  assert.deepEqual(t('DEWALT DEWALT DT20711 Multi-Tool Titanium Flush Cut Blade 100mm', 'DEWALT', 'GS Workwear'),
    { name: 'DEWALT DT20711 Multi-Tool Titanium Flush Cut Blade 100mm', steps: ['double'] });
  assert.equal(t('Draper Draper TX-STAR Security Screwdriver (T27T x 100mm)', 'Draper Tools', 'GS Workwear').name,
    'Draper TX-STAR Security Screwdriver (T27T x 100mm)');
  assert.equal(t('Miffy Miffy Head Luggage Tag - White', 'Miffy', 'Case Luggage').name, 'Miffy Head Luggage Tag - White');
  // A doubled word that is not the brand stays: "Bora Bora" is a place.
  assert.equal(t('Bora Bora Printed Swimsuit', 'Seafolly', 'Swimwear Galore').name, 'Seafolly Bora Bora Printed Swimsuit');
  assert.deepEqual(t('Nexx X.R3R Zorga Orange Green Full Face Helmet', 'NEXX', 'Chromeburner'),
    { name: 'NEXX X.R3R Zorga Orange Green Full Face Helmet', steps: ['case'] });
  assert.deepEqual(t('Mens Nike Air Max 90 Trainers', 'Nike', 'Sports Direct'), { name: 'Nike Mens Air Max 90 Trainers', steps: ['moved'] });
  // Brand already first in another form: nothing to do.
  for (const [name, brand] of [['BlueSpot Soft Grip Plastering Trowel 11"', 'Blue Spot'], ['Bosch UNIVERSALHEDGECUT 18V-55 Hedge Trimmer', 'Bosch Home and Garden'],
    ['adidas Duramo SL 2.0 Running Shoes', 'adidas performance'], ['REV’IT! Endo Ladies Black White Gloves', "REV'IT!"]]) {
    assert.deepEqual(t(name, brand, 'Tooled Up'), { name: truncate(name, TITLE_NAME_MAX), steps: [] }, name);
  }
});

test('the name part is never longer than 70 characters and never empty when the product has a name', () => {
  const names = ['Fractal Design Meshify 3 Black RGB TG Light Tint Gaming Case With A Very Long Name That Goes On',
    'Short', 'Gardenista Water-Resistant Decorative Scatter Cushion Covers Outdoor Printed Cushion Cover - Elephant D'];
  for (const n of names) for (const b of ['Fractal Design', 'Gardenista', 'Le Gramme', '']) for (const m of [null, 'FD-C-MES3A-06']) {
    const out = titleName({ product_name: n, brand: b, retailer: 'Back to the Office', mpn: m });
    assert.ok(out.length > 0 && out.length <= TITLE_NAME_MAX, `${n} / ${b} / ${m}: ${out.length}`);
  }
  assert.equal(titleName(null), '');
  assert.equal(titleName({ product_name: '' }), '');
});

const product = (over = {}) => ({
  id: 101, product_name: 'Sealey Premier Folding Engine Crane', brand: 'Sealey', retailer: 'Tooled Up', mpn: 'SPC1000',
  gtin: '5051747471573', price: 299.99, was_price: null, currency: 'GBP', in_stock: 1, item_condition: 'new',
  image_url: 'https://img.example/a.jpg', category_slug: 'garage-equipment', last_seen_at: '2026-11-21 10:00:00', offer_count: 1, ...over
});

test('the product page: only the <title> changes; the H1 and the Product structured data keep the retailer\'s name', () => {
  const html = productPage(tgw, product(), null, []);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  assert.match(title, /^Sealey Premier Folding Engine Crane SPC1000 \| £299\.99 \| Technology Gear World$/);
  assert.match(html, /<meta property="og:title" content="Sealey Premier Folding Engine Crane SPC1000 \| £299\.99 \| Technology Gear World">/);
  assert.match(html, /<h1[^>]*>Sealey Premier Folding Engine Crane<\/h1>/);
  assert.match(html, /"@type":"Product","name":"Sealey Premier Folding Engine Crane"/);
  assert.ok(title.length <= 110, 'the QA gate allows up to 110 characters');
});

test('the product page on the older layout and with nothing to change: the title is exactly as before', () => {
  const p = product({ product_name: 'Tour Shirt (Choc Chip Camo) | XXL | Stan Ray®', brand: 'Stan Ray®', retailer: 'Stan Ray UK', mpn: null, price: 85 });
  assert.match(productPage(wgw, p, null, []), /<title>Stan Ray Tour Shirt \(Choc Chip Camo\) \| XXL \| £85\.00 \| Women&#39;s Gear World<\/title>|<title>Stan Ray Tour Shirt \(Choc Chip Camo\) \| XXL \| £85\.00 \| Women's Gear World<\/title>/);
  const plain = product({ product_name: 'BlueSpot Soft Grip Plastering Trowel 11"', brand: 'Blue Spot', mpn: null, price: 9.5 });
  const before = `${truncate(plain.product_name, 70)} | £9.50 | ${cgw.name}`;
  const got = (productPage(cgw, plain, null, []).match(/<title>([^<]*)<\/title>/) || [])[1];
  assert.equal(got.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'), before);
});
