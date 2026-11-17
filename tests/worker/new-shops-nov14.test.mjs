// New shops of 14 Nov 2026 (lessons L140, L132, L133, L141, L142): ANCHOR & CREW (Awin 131192, MGW/WGW), Haglöfs (CJ 5531758, MGW/WGW, the
// British catalogue only) and TORRO (Awin 24751, MGW; its device cases wait for Technology Gear World).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ac from '../../tools/import-rules/anchorcrew.mjs';
import * as hg from '../../tools/import-rules/haglofs.mjs';
import * as tr from '../../tools/import-rules/torro.mjs';
import { networkOf } from '../../tools/network-links.mjs';

test('L140: ANCHOR & CREW (database name "Anchor and Crew": wrangler refuses "&") prices come without VAT in the feed: the card shows the shop price (x 1.2)', () => {
  const col = { search_price: '45.83', store_price: '', product_name: 'Pink Agate Sienna Silver and Stone Bracelet No Gift Wrapping' };
  const get = c => col[c] ?? '';
  assert.equal(ac.RULES.retailer, 'Anchor and Crew');
  assert.equal(ac.displayBrand(), 'ANCHOR & CREW');
  assert.equal(ac.field('search_price', get), '55.00', 'Sienna bracelet: £45.83 in the feed, £55.00 on anchorandcrew.com');
  assert.equal(ac.field('product_name', get), col.product_name);
  assert.equal(ac.field('store_price', get), '');
  assert.equal(ac.field('search_price', c => (c === 'search_price' ? '62.50' : '')), '75.00');
});

test('L140: ANCHOR & CREW names lose the size and gift-wrap options; jewellery, clothing and extras go to the right place', () => {
  assert.equal(ac.displayName('Khaki Green Montrose Silver and Rope Bracelet M - 21cm (Most Popular)/No Gift Wrapping'), 'Khaki Green Montrose Silver and Rope Bracelet');
  assert.equal(ac.displayName('Fire Orange Blake Silver and Braided Leather Bracelet Gift Wrapped (Paper & Bow) +£1.50'), 'Fire Orange Blake Silver and Braided Leather Bracelet');
  assert.equal(ac.displayName('Athletic Grey Explorer Print Organic Cotton T-Shirt (Womens) 10 - 35"/36" (US 6 / EU 38)/No Gift Wrapping'), 'Athletic Grey Explorer Print Organic Cotton T-Shirt');
  const c = name => ac.classify({ name });
  assert.deepEqual(c('Coal Black Admiral Anchor Silver and Flat Leather Bracelet No Gift Wrapping'), { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Bracelets' });
  assert.equal(c('Admiral Anchor Signature Silver Necklace Pendant M - 50cm/No Gift Wrapping').subcategory, 'Necklaces');
  assert.equal(c('Classic Grey Arthur Silver and Rope SKINNY Bracelet No Gift Wrapping').site, 'mgw', 'SKINNY is a thin bracelet, not a women\'s one');
  assert.equal(c('Pink Maisie Silver and Freshwater Shell SKINNY Bracelet M - 21cm/No Gift Wrapping').site, 'wgw');
  assert.equal(c('Athletic Grey Explorer Print Organic Cotton T-Shirt (Womens) 10 - 35"/36"/No Gift Wrapping').site, 'wgw');
  assert.deepEqual(c('Octopus Another Good Day Organic Cotton Sweatshirt L/No Gift Wrapping'), { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Sweatshirts' });
  assert.deepEqual(c('Samson Everyday Carry Silver Keyring No Gift Wrapping'), { site: 'mgw', siteCategory: 'Everyday Carry / EDC', subcategory: 'Everyday Carry / EDC' }, 'MGW has no Keyrings place (L56)');
  assert.equal(c('GUSTATORY Coffee Bag Silver Bead No Gift Wrapping').siteCategory, "Men's Jewellery", 'a charm bead, not a bag');
  for (const n of ['Sunset Party Archival Giclée Paper A3 Wall Print', 'Grey Reykjavik Medium Hardcover Notebook', 'Small Graphite Black Standen Leather and Rope Phone Case', 'Handmade Candle Co. Sea Spice Scented Soy Wax Candle (180ml)'])
    assert.ok(c(n).reject, n);
});

test('L140: Haglöfs is a CJ shop; only British rows (haglofs.com/en/, pounds) are read; men, women, both', () => {
  assert.equal(networkOf(hg).label, 'CJ');
  const row = (link, currency) => c => ({ merchant_deep_link: link, currency, product_name: 'Korp Proof Jacket Women', search_price: '130' })[c] ?? '';
  assert.equal(hg.field('product_name', row('https://www.haglofs.com/en/women/korp-proof-jacket-women_1', 'GBP')), 'Korp Proof Jacket Women');
  assert.equal(hg.field('product_name', row('https://www.haglofs.com/nl/women/korp-proof-jacket-women_1', 'EUR')), '', 'a Dutch row gives no columns');
  assert.equal(hg.field('search_price', row('https://www.haglofs.com/en/women/x', 'EUR')), '', 'a euro price never reaches a card');
  assert.equal(hg.displayName('Haglöfs Rosson Proof Mid Men'), 'Rosson Proof Mid');
  const c = (name, feedCategory = '') => hg.classify({ name, feedCategory });
  assert.deepEqual(c('Korp Proof Jacket Women', 'Shell jackets'), { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Jackets & Coats' });
  assert.deepEqual(c('Rosson Down Hood Men', 'Insulated jackets'), { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Jackets' });
  assert.equal(c('L.I.M Airak 2,5L Jacket Men', 'Shell jackets').subcategory, 'Jackets', '"2,5L" is the fabric, not a bag size');
  assert.equal(c('Magma 42L', 'Hiking backpacks').subcategory, 'Bags');
  assert.equal(c('Rosson Proof Mid Men', 'Shoes | Boots').subcategory, 'Boots');
  assert.equal(c('Vassi Beanie', 'Beanies | Hats | Caps').subcategory, 'Hats');
  assert.ok(c('Haglöfs Shoe Lace 4 mm', 'Shoelaces').reject);
  assert.ok(c('Mila Jacket Junior', 'Jackets').reject);
});

test('L140: TORRO on MGW: leather accessories in, device cases (also "wallet cases") out for Technology Gear World', () => {
  const c = name => tr.classify({ name });
  assert.equal(c('Trifold Leather Wallet (with RFID Protection) - Black').subcategory, 'Wallets & Purses', "MGW's own name (L56)");
  assert.ok(c('iPhone 17 2-in-1 Leather Wallet Case (with Detachable Cover & MagSafe Charging)').reject);
  assert.ok(c('Kindle Paperwhite & Kindle Colorsoft Leather Case (2024/2025) - Navy Blue').reject);
  assert.equal(c('Leather Weekend Duffle Bag - Black').subcategory, 'Bags');
  assert.equal(c('Leather Passport Holder & Travel Document Organiser - Black').subcategory, 'Accessories');
  assert.equal(c('Leather AirTag Keyring - Tan').siteCategory, 'Everyday Carry / EDC');
  assert.deepEqual(c('Leather Apple Watch & Watch Ultra Strap - Small'), { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Accessories' });
  assert.equal(c('Leather Golf Tee Holder for Golf Bags - Navy Blue').subcategory, 'Accessories');
  assert.ok(c('Large Leather Desk Mat (80x40cm) - Black').reject);
  assert.equal(tr.displayName('Slim Leather Card Holder with 5 Card Slots - Black with Red Detail'), 'Slim Leather Card Holder with 5 Card Slots');
});

test('L132: dry run of 14 Nov on MGW: a charm named after a bag is jewellery, golf book covers are golf, every packing cube goes together', () => {
  const ac1 = ac.classify({ name: 'Midnight Black GUSTATORY Coffee Bag Silver and Braided Leather Bracelet S - 19cm' });
  assert.deepEqual(ac1, { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Bracelets' });
  assert.equal(ac.classify({ name: 'GUSTATORY Coffee Bag Silver Necklace Pendant' }).subcategory, 'Necklaces');
  assert.equal(ac.classify({ name: 'Small Graphite Black Rufford Leather and Rope Briefcase' }).subcategory, 'Bags');
  const t = name => tr.classify({ name, feedCategory: 'Sporting Goods > Outdoor Recreation > Golf > Golf Accessories' });
  assert.deepEqual(t('Leather Golf Scorecard Holder and Yardage Book Cover'), { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Accessories' });
  assert.ok(tr.classify({ name: 'Galaxy Tab A9 Leather Case - Black with Red Detail', feedCategory: '' }).reject, 'device cases still wait for TGW');
  assert.ok(tr.classify({ name: 'Leather Laptop Sleeve with Zip (13”–16”) - Black', feedCategory: 'Electronics > Electronics Accessories > Computer Accessories > Laptop Sleeves' }).reject);
  const h = name => hg.classify({ name, feedCategory: 'Packing cubes' });
  assert.equal(h('Packing cube 12L').subcategory, 'Accessories');
  assert.equal(h('LO Packing cubes').subcategory, 'Accessories');
  assert.equal(hg.classify({ name: 'Lava 30', feedCategory: 'Hiking backpacks' }).subcategory, 'Bags');
});

test('L133: Needs No Label (massive import of 14 Nov) on WGW: sizes off the name, Miss Cecilia jewellery from "General Clothing", tops, trousers and jumpsuits out', async () => {
  const nn = await import('../../tools/import-rules/needsnolabel.mjs');
  assert.equal(nn.displayName('Blue Animal Smock Waisted Midi Dress | Size: 12'), 'Blue Animal Smock Waisted Midi Dress');
  assert.equal(nn.displayName('Multicoloured Floral Ruched Top | Clothing Size: 8'), 'Multicoloured Floral Ruched Top');
  assert.equal(nn.displayBrand('Needs no label'), 'Needs No Label');
  assert.equal(nn.displayBrand('Miss Cecilia'), 'Miss Cecilia');
  const c = (name, cat) => nn.classify({ name, feedCategory: cat });
  const W = "Clothing & Accessories > Women's Clothing > ";
  assert.deepEqual(c('Green Animal Chiffon Maxi Dress | Size: 6', W + "Women's Dresses & Skirts"), { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Dresses' });
  assert.equal(c('Pink Animal Satin Midi Skirt | Size: 6', W + "Women's Dresses & Skirts").subcategory, 'Skirts');
  assert.equal(c('Cream Soft Belted Jacket | Size: XS', W + "Women's Tops").subcategory, 'Jackets & Coats');
  assert.deepEqual(c('Drift Hoop Earrings', 'Clothing & Accessories > General Clothing'), { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: 'Earrings' });
  assert.equal(c('Arc Cuff Bangle', 'Clothing & Accessories > General Clothing').subcategory, 'Bracelets');
  assert.equal(c('Black Asymmetric Feather Cuff Dress | Size: 8', W + "Women's Dresses & Skirts").subcategory, 'Dresses');
  for (const n of ['White Puff Sleeve Blouse | Size: 16', 'Black Sequin Jersey Jumpsuit | Size: 8', 'Linen Stripe Co-ord Trousers | Size: M', 'Black Floral Relaxed Co-ord Shorts | Size: 8']) assert.ok(c(n, W + "Women's Tops").reject, n);
  assert.equal(nn.RULES.retailer, 'Needs No Label');
  assert.match('Needs No Label', /^[A-Za-z0-9 .\-]{2,40}$/, 'wrangler-safe shop name (L63)');
});

test('L133: MASON New York (ships to about 200 countries, the UK too) on WGW: one card per page even with "™" in the handle, charm bracelets are bracelets, bundle sets are "Jewellery"', async () => {
  const m = await import('../../tools/import-rules/masonnewyork.mjs');
  const link = 'https://masonnewyork.com/products/diamond-ring-2-1-carat-band-mason-tennis%E2%84%A2?variant=1';
  const get = c => (c === 'merchant_deep_link' ? link : c === 'merchant_product_id' ? '42' : '');
  assert.equal(m.productKey(get), 'products/diamond-ring-2-1-carat-band-mason-tennis%e2%84%a2');
  const c = name => m.classify({ name }).subcategory;
  assert.equal(c('1 Carat Diamond Adjustable Charm Bracelet - MASON TENNIS™'), 'Bracelets');
  assert.equal(c('Diamond Necklace Earrings Bundle Set - Teardrop Pear'), 'Jewellery');
  assert.equal(c('1 Carat Diamond Stud Earrings - Weekend Meetup'), 'Earrings');
  assert.equal(c('0.82 Carat Diamond Butterfly Pendant Necklace'), 'Necklaces');
  assert.equal(c('4.2 Carat Diamond Adjustable Chain Bracelet'), 'Bracelets');
  assert.equal(c('0.45 Carat Diamond Chain Pendant Necklace - MASON TENNIS™'), 'Necklaces');
  assert.equal(c('2.1 Carat Diamond Band Ring - MASON TENNIS™'), 'Rings');
  assert.equal(m.RULES.currency, 'USD');
});

// ---- Massive import round 2b (14 Nov 2026): 11 shops on WGW, MGW, KGW, HGW and GGW; lessons L141 (the US view), L142 ----
const SHOP_RULES = ['jeulia', 'dreampairs', 'maceoo', 'kaiyababy', 'diecast', 'clickandgrow', 'kincmo', 'switchbot', 'foreo', 'aloraircrawlspace', 'mosaic'];
const rulesOf = async k => import(`../../tools/import-rules/${k}.mjs`);
const siteConfig = async s => (await import(`../../sites/${s}/site.config.js`)).default;

test('L141: each round 2b shop is in deliversTo of every site it goes to, with the countries of its shipping page (US, or EU for FOREO and SwitchBot)', async () => {
  const want = { foreo: ['EU'], switchbot: ['EU'] };
  for (const k of SHOP_RULES) {
    const { RULES } = await rulesOf(k);
    assert.match(RULES.retailer, /^[A-Za-z0-9 .\-]{2,40}$/, `${k}: wrangler-safe shop name (L63)`);
    for (const s of RULES.sites) {
      const cfg = await siteConfig(s);
      assert.deepEqual(cfg.deliversTo.retailers[RULES.retailer], want[k] || ['US'], `${k} on ${s}: "${RULES.retailer}"`);
    }
  }
  // Round 2a: MASON New York and Needs No Label ship to the UK and the US: both views.
  const wgw = await siteConfig('wgw');
  assert.deepEqual(wgw.deliversTo.retailers['MASON New York'], ['GB', 'US']);
  assert.deepEqual(wgw.deliversTo.retailers['Needs No Label'], ['GB', 'US']);
  assert.deepEqual(wgw.foreignCurrencies, ['USD', 'PLN'], 'MASON New York prices in dollars get "≈ £", AliExpress PL\'s zloty too (L157)');
});

test('L142: Dream Pairs: "Cowboy Boots" are not boys\' boots, the name wins over a kids section, T-shirts and belts go to MGW clothing and accessories, the brand leaves the name', async () => {
  const d = await rulesOf('dreampairs');
  const c = (name, cat) => d.classify({ name, feedCategory: cat });
  assert.deepEqual(c('DREAM PAIRS Dakota Western Cowboy Boots', 'Mid-Calf Boots'), { site: 'wgw', siteCategory: 'Shoes', subcategory: 'Boots' });
  assert.deepEqual(c('BRUNO MARC Men s Cowboy Square Toe Western Boots', 'Boots'), { site: 'mgw', siteCategory: 'Shoes', subcategory: 'Boots' });
  assert.equal(c('DREAM PAIRS Boys Camouflage Western Cowboy Boots', 'Kids Boots').site, 'kgw');
  assert.equal(c("DREAM PAIRS Women's Inner Zipper Chelsea Boots", 'Kids Boots').site, 'wgw');
  assert.equal(c('DREAM PAIRS Kids Soccer Cleats for Boys Girls', 'Kids Soccer Shoes').site, 'kgw');
  assert.equal(c('DREAM PAIRS Low Heel Pointed Toe Pumps', 'Pumps').subcategory, 'Heels');
  assert.equal(c('BRUNO MARC Men s Breathable Casual Sneakers', 'OTHERS').subcategory, 'Trainers', 'a shoe in "OTHERS" stays');
  assert.equal(c('NORTIV 8 Men s DualStride Armadillo FieldLite Mid WaterproofPRO', 'Hiking').site, 'mgw', 'a boot named without the word');
  // The whole catalogue (owner, 15 Nov 2026): the clothes, belts and wallets go to MGW and the tote bag to WGW, in places they already have.
  for (const [n, cat, want] of [
    ['BRUNO MARC Men s Ultra Soft Breathable Classic Crew Neck T Shirt', 'ACCESSORIES', ['mgw', 'Clothing', 'T-Shirts']],
    ['BRUNO MARC Men s Classic Soft Polo Shirt Business Casual', 'ACCESSORIES', ['mgw', 'Clothing', 'Shirts']],
    ['BRUNO MARC Men s Classic Straight Leg Washed Denim Jeans', 'ACCESSORIES', ['mgw', 'Clothing', 'Jeans']],
    ['BRUNO MARC Men s Soft Casual Shorts With Elastic Band And Drawstring', 'ACCESSORIES', ['mgw', 'Clothing', 'Shorts']],
    ['BRUNO MARC Men s Relaxed Boxy Fit Fleece Hoodie', 'ACCESSORIES', ['mgw', 'Clothing', 'Hoodies']],
    ['BRUNO MARC Men s Soft Smart Casual 4 Way Stretch Pants', 'ACCESSORIES', ['mgw', 'Clothing', 'Trousers']],
    ['BRUNO MARC Men s Cotton Crew Athletic Dress Socks', 'OTHERS', ['mgw', 'Clothing', 'Socks']],
    ['BRUNO MARC Men s Genuine Leather Casual Dress Belt', 'Belts', ['mgw', 'Bags & Accessories', 'Belts']],
    ['BRUNO MARC Men s Compact Pop Up Wallet', 'Wallets', ['mgw', 'Bags & Accessories', 'Wallets & Purses']],
    ['DREAM PAIRS Sustainable Knitted Tote Bag', 'Bags', ['wgw', 'Bags & Accessories', 'Bags']]
  ]) assert.deepEqual(c(n, cat), { site: want[0], siteCategory: want[1], subcategory: want[2] }, n);
  assert.ok(c('DREAM PAIRS Knit Beanie Hat', 'ACCESSORIES').reject, 'no place for a women\'s hat from this shop');
  assert.ok(c('DREAM PAIRS Gift Card', 'OTHERS').reject);
  assert.equal(d.displayName('BRUNO MARC Men s Cowboy Square Toe Western Boots'), "Men's Cowboy Square Toe Western Boots");
  assert.equal(d.displayName('DREAM PAIRS Kid s Square Toe Boots'), "Kid's Square Toe Boots");
  for (const u of ['https://www.dreampairs.com/products/a', 'https://www.brunomarc.com/products/a', 'https://nortiv8shoes.com/products/a']) assert.ok(d.RULES.shop.test(u), u);
});

test('L142: Jeulia, Maceoo, Kaiya Baby: ring sets are rings, men\'s bands go to MGW, crewneck T-shirts are T-shirts, no embroidery service or old feed row', async () => {
  const j = await rulesOf('jeulia');
  assert.equal(j.classify({ name: 'Jeulia Halo Pear Cut Engagement Eternity Ring Set 3PC Sterling Silver', feedCategory: 'Jewelry Sets' }).subcategory, 'Rings');
  assert.deepEqual(j.classify({ name: "Jeulia Walnut Stainless Steel Men's Band", feedCategory: 'Alloy Rings' }), { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Jewellery' });
  assert.equal(j.displayName('Jeulia Custom Infinite Heart Necklace'), 'Custom Infinite Heart Necklace');
  const m = await rulesOf('maceoo');
  const mc = (name, cat) => m.classify({ name, feedCategory: cat }).subcategory;
  assert.equal(mc("Maceoo - Men's Skull Disco Graphic Crewneck T-Shirt - White", 'Athleisure'), 'T-Shirts');
  assert.equal(mc("Men's Monogram Graphic Crewneck Sweater - Black", 'Athleisure'), 'Sweatshirts');
  assert.equal(mc('Einstein Scale Grey Long Sleeve Dress Shirt', 'Dress Shirt LS'), 'Shirts');
  assert.equal(mc('Lion Geo Red Swim Shorts', 'Swim'), 'Shorts');
  const k = await rulesOf('kaiyababy');
  assert.ok(k.classify({ name: 'embroidery-service' }).reject);
  assert.ok(k.classify({ name: 'Organic Cotton Front Opening Zip Up Swaddle 0.5 TOG - Cameo Pink-3-6M - 3-6 Months / 0.5 TOG' }).reject);
  assert.equal(k.classify({ name: 'Warm Sleep Suit Sack 3-in-1 2.5 TOG - Organic Cotton & Camel Wool - Pea Green' }).subcategory, 'Baby & Toddler Sleepwear');
  assert.equal(k.classify({ name: 'ClimaCuddle® Swaddle 2-in-1 0.5 TOG - Merino Wool & Rayon From Bamboo - Dusty Pink' }).subcategory, 'Swaddling Blankets');
});

test('L142: Diecast Models Wholesale: a car "with Driver Figure" and a car "by American Diorama" are cars, "Cobra Jet" is no aircraft, "Railway Express" no train', async () => {
  const d = await rulesOf('diecast');
  const c = (name, cat = '') => d.classify({ name, feedCategory: cat }).subcategory;
  assert.equal(c('Can-Am Defender XMR Silver Metallic and Black with Driver Figure 1/32 Diecast Model by BRP Models', '1 > 32|UTV & SUV'), 'Toy Cars');
  assert.equal(c('US Army Vehicle WWII Desert Sand 1/18 Diecast Model Car by American Diorama', 'Military'), 'Toy Cars');
  assert.equal(c('Hazmat Crew Figurine VI for 1/18 Scale Models by American Diorama', 'Accessories|Figures & Figurine'), 'Action & Toy Figures');
  assert.equal(c('Grand Prix Paddock Diorama "Team Orange" with LED Lights for 1/64 Scale Models by American Diorama', 'Accessories'), 'Toys & Games');
  assert.equal(c('1968 Ford Mustang CJ Cobra Jet White 1/18 Diecast Model Car by Maisto', 'Ford|Mustang'), 'Toy Cars');
  assert.equal(c('Boeing 777F Commercial Aircraft "Lufthansa Cargo" White with Blue Tail', 'Civilian'), 'Toy Aeroplanes');
  assert.equal(c('1948 Dodge B-1B Pickup Truck Green "Railway Express Agency" 1/87 (HO) Scale Diecast Model Car by Oxford Diecast', 'Dodge|Pickup'), 'Toy Lorries & Construction Vehicles');
  assert.equal(c('Progress Rail 100th Anniversary Train Set 1/87 (HO) Diecast Models by Diecast Masters'), 'Toy Trains & Train Sets');
  assert.equal(c('Oliver 1755 Tractor with FWA ROPS and Canopy Green with Light Green Canopy "Classic Series" 1/16 Diecast Model by SpecCast', 'Agriculture & Farming'), 'Toy Lorries & Construction Vehicles');
});

test('L142: FOREO: the FAQ™ line stays (LED masks are tools, its serums skincare), ESPADA™ is no "pad", a peach-coloured LUNA™ is no hair removal; cables and cases out', async () => {
  const f = await rulesOf('foreo');
  const c = name => f.classify({ name });
  assert.equal(c('FAQ™ 101-Amethyst').subcategory, 'Beauty tools');
  assert.equal(c('FAQ™ Red Light Peptide Serum').subcategory, 'Skincare');
  assert.equal(c('ESPADA™ 2 plus Lavender').subcategory, 'Beauty tools');
  assert.equal(c('LUNA™ 4 go Peach Perfect').subcategory, 'Beauty tools');
  assert.equal(c('PEACH™ 2 Mint').subcategory, 'Hair removal');
  assert.equal(c('KIWI™ derma Bundle').subcategory, 'Gift sets');
  for (const n of ['PEACH™ 2 power cable with 4 plug adaptors', 'FAQ™ 200 Travel Case', 'issa™ baby Replacement Brush Head Kiwi Green Panda']) assert.ok(c(n).reject, n);
});

test('L142: SwitchBot (European shop only), Click & Grow, Kincmo, AlorAir, Mosaic: each product in the site\'s own section names', async () => {
  const s = await rulesOf('switchbot');
  const row = (link, currency) => c => ({ merchant_deep_link: link, currency, product_name: 'SwitchBot Hub 2' })[c] ?? '';
  assert.equal(s.field('product_name', row('https://us.switch-bot.com/products/hub-2', 'USD')), '', 'a US row gives no columns');
  assert.equal(s.field('product_name', row('https://eu.switch-bot.com/products/hub-2', 'EUR')), 'SwitchBot Hub 2');
  const sc = name => s.classify({ name }).subcategory;
  assert.equal(sc('SwitchBot RGBICWW Floor Lamp'), 'Smart Home Accessories', 'a lamp is no bulb');
  assert.equal(sc('SwitchBot Color Bulb'), 'Smart Bulb');
  assert.equal(sc('SwitchBot Smart Radiator Thermostat Matter Combo'), 'Smart Thermostat');
  assert.equal(sc('SwitchBot Mini Robot Vacuum K10+ Pro'), 'Vacuum Cleaner');
  const g = await rulesOf('clickandgrow');
  assert.equal(g.classify({ name: 'Thyme Plant Pods 30-pack' }).subcategory, 'Seeds & bulbs');
  assert.equal(g.classify({ name: 'The Smart Garden 9 Lamp' }).subcategory, 'Grow lights');
  assert.equal(g.classify({ name: 'The Smart Garden 27' }).subcategory, 'Hydroponics');
  assert.equal(g.displayBrand(), 'Click & Grow');
  const k = await rulesOf('kincmo');
  assert.ok(k.classify({ name: 'Shipping Protection', feedCategory: 'shipping-protection' }).reject);
  assert.equal(k.classify({ name: 'Kincmo No Drill Cordless Roller Shades 100% Blackout - Classic' }).subcategory, 'Blinds');
  const a = await rulesOf('aloraircrawlspace');
  assert.ok(a.classify({ name: 'AlorAir Wholesale Packs Sentinel HD55 (pack of 5)' }).reject);
  assert.equal(a.classify({ name: 'AlorAir 220PPD Crawl Space Dehumidifier with Pump and Drain Hose | Sentinel HDi100 (White)' }).subcategory, 'Dehumidifier');
  const mo = await rulesOf('mosaic');
  assert.equal(mo.classify({ name: 'Minky Dot Duvet Cover' }).subcategory, 'Bed Linen');
  assert.deepEqual(mo.classify({ name: 'Lavender Minky Weighted Blanket' }), { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Throw' });
  for (const name of SHOP_RULES) {
    const r = await rulesOf(name);
    if (r.RULES.network === 'cj') assert.equal(networkOf(r).label, 'CJ', name);
  }
});

// ---- Children's winter boots on KGW (Manager, plan of 14 Nov 2026 17:10): Shoes > Winter Boots ----
test('Winter Boots on KGW: Coes winter boots and wellies move there (add-only, same key), sports boots stay; Camping World UK children\'s boots; Dream Pairs children\'s boots', async () => {
  const c = await rulesOf('coes-kids-winter');
  assert.equal(c.RULES.addOnly, true, 'the rest of Coes on KGW stays as it is');
  assert.equal(c.RULES.retailer, 'Coes');
  const cc = (name, brand = '') => c.classify({ name, brand });
  for (const n of ['Olang BMX Front Zip Winter Boot for Boys in Nero', 'Olang Patty Girls Winter Boots for Kids in Black', 'Dunlop JR Wellington Boots for Kids in Black',
    'Dunlop Kids 16247 Wellington Boots']) assert.deepEqual(cc(n), { site: 'kgw', siteCategory: 'Shoes', subcategory: 'Winter Boots' }, n);
  for (const n of ['Adidas Predator Club Firm/Multi-Ground Kids Boots', 'Canterbury Stampede GB Team SG Rugby Boots Kids', 'New Balance Furion Dispatch V7 Junior Boot',
    'Adidas Rugby Junior SG Boots', 'Grays Raid 2.0 Junior Hockey Astros', 'Adidas Runfalcon 5 Shoes for Kids', 'Hunter Womens Original Tall Wellington Boots']) assert.ok(cc(n).reject, n);
  // The same key as coes-kids (KGW's unique key is the shop's product id): the plan updates the 4 rows already on KGW.
  assert.ok(!('productKey' in c), 'no own key: the planner key of coes-kids');
  const w = await rulesOf('campingworld-kids');
  assert.equal(w.RULES.retailer, 'Camping World UK');
  assert.equal(w.RULES.addOnly, true);
  const link = 'https://www.campingworld.co.uk/en/gb/Olang-Zaza-Kids-Snow-Boots/m-6096.aspx';
  assert.equal(w.productKey(col => (col === 'merchant_deep_link' ? link : '')), 'en/gb/olang-zaza-kids-snow-boots/m-6096.aspx');
  const wc = name => w.classify({ name });
  for (const n of ['Olang Zaza Kids Snow Boots', 'VW Freedom PVC Girls Wellington Boots', 'Wild Tribe Kids T-Rex Dinosaur Wellington Boots', 'Hi Tec Boys Blackout Mid Boots',
    'Regatta Kids Vendeavour Waterproof Walking Boots']) assert.deepEqual(wc(n), { site: 'kgw', siteCategory: 'Shoes', subcategory: 'Winter Boots' }, n);
  for (const n of ['Regatta Mens Samaris Walking Boots', 'Wild Tribe Kids Sandals', 'Kids Boot Socks', 'Outwell Tent']) assert.ok(wc(n).reject, n);
  assert.equal(w.displayName('Hi Tec Kids Blackout Mid Boots'), 'Hi-Tec Kids Blackout Mid Boots');
  const d = await rulesOf('dreampairs');
  assert.deepEqual(d.classify({ name: 'DREAM PAIRS Kids Waterproof Winter Snow Boots', feedCategory: 'Kids Boots' }), { site: 'kgw', siteCategory: 'Shoes', subcategory: 'Winter Boots' });
  assert.equal(d.classify({ name: 'DREAM PAIRS Girls Rainbow Ombre Hook and Loop Sneakers', feedCategory: 'Kids Sneakers' }).subcategory, 'Trainers');
  assert.equal(d.classify({ name: 'DREAM PAIRS Kids Cozy Fuzzy House Slippers', feedCategory: 'Kids Slippers' }).subcategory, 'Shoes', 'KGW has no "Slippers" (L56)');
  assert.equal(d.classify({ name: 'DREAM PAIRS Warm Fuzzy House Slippers', feedCategory: 'Slippers' }).subcategory, 'Slippers', 'WGW has "Slippers"');
  assert.equal(d.classify({ name: 'DREAM PAIRS Dakota Western Cowboy Boots', feedCategory: 'Mid-Calf Boots' }).subcategory, 'Boots', 'women\'s boots stay "Boots" on WGW');
});

test('Winter Boots on KGW is a row above Shoes (?sub=winter-boots) in every language, with a new asset version (L31, L143)', async () => {
  const kgw = await siteConfig('kgw');
  const shoes = kgw.categories.find(c => c.slug === 'shoes');
  assert.deepEqual(shoes.subcategories, [{ slug: 'winter-boots', name: 'Winter Boots' }]);
  assert.match(kgw.assetVersion, /^(2026-11-1[45]-kgw-(boots|pl)|2026-11-16-kgw-lang|2026-11-17-kgw-legal|2026-11-19-kgw-popup)-1$/, 'a new asset version (and the Polish one of L162 after it)');
  const { readFileSync, readdirSync } = await import('node:fs');
  const langs = readdirSync('sites/kgw/public/assets/i18n').filter(f => f.endsWith('.json'));
  assert.equal(langs.length, 11, '10 languages and Polish (L162)');
  for (const f of langs) {
    const d = JSON.parse(readFileSync(`sites/kgw/public/assets/i18n/${f}`, 'utf8'));
    for (const k of ['All', 'Winter Boots']) assert.ok(d[k] && d[k] !== k, `${f}: "${k}"`);
  }
});
