// Wave 1 UK of the massive import (chat 7, 22-24 Nov 2026, lessons L224): the shops in pounds on the older sites.
// Truthbrush and Elegant Showers (HGW), OPI UK (WGW), Ekster UK (MGW), W. Hamond (WGW/MGW), Cotton On (WGW/MGW/KGW) and
// Green Kid Crafts (KGW, dollars). Cases from the feeds of 22 Nov 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as truth from '../../tools/import-rules/truthbrush-uk.mjs';
import * as elegant from '../../tools/import-rules/elegantshowers-uk.mjs';
import * as opi from '../../tools/import-rules/opi-uk.mjs';
import * as ekster from '../../tools/import-rules/ekster-uk.mjs';
import * as hamond from '../../tools/import-rules/whamond-uk.mjs';
import * as cotton from '../../tools/import-rules/cottonon-uk.mjs';
import * as gkc from '../../tools/import-rules/greenkidcrafts.mjs';
import { withoutOption, tidy } from '../../tools/import-rules/lib/uk-wave1.mjs';

const at = c => (c.reject ? `out: ${c.reject}` : `${c.site} ${c.siteCategory} > ${c.subcategory}`);
const config = JSON.parse(readFileSync('tools/massive/candidates-1122.json', 'utf8'));

test('L224 Truthbrush: toothbrushes, heads, cases and jars to HGW bathroom accessories, toothpaste tablets out', () => {
  const c = n => at(truth.classify({ name: n }));
  assert.equal(c('Truthbrush Bamboo Toothbrush - Medium bristles'), 'hgw Bedding & Bath > Bathroom Accessories');
  assert.equal(c('Truthbrush Glass Apothecary Jar For Truthtabs Storage'), 'hgw Bedding & Bath > Bathroom Accessories');
  assert.equal(c('Beautiful Bamboo Interdental Brushes'), 'hgw Bedding & Bath > Bathroom Accessories');
  assert.match(c('Truthtabs - Award Winning Wild Mint Toothpaste Tablets. Three Month Supply'), /^out: toothpaste/);
  assert.equal(truth.RULES.currency, 'GBP');
});

test('L224 Elegant Showers: showers and towel rails to bathroom, radiators to heaters, mirrors, furniture by name, parts out', () => {
  const c = n => at(elegant.classify({ name: n }));
  assert.equal(elegant.displayName('ELEGANT 1200mm Sliding Shower Door 6mm Tempered Glass'), '1200mm Sliding Shower Door 6mm Tempered Glass');
  assert.equal(c('ELEGANT 900x900 Ultra Slim Stone Resin Quadrant Shower Tray + 90mm Waste'), 'hgw Bedding & Bath > Bathroom Accessories');
  assert.equal(c('ELEGANT 1000x500mm Chrome Heated Bathroom Flat Panel Towel Rail Radiator'), 'hgw Bedding & Bath > Bathroom Accessories');
  assert.equal(c('ELEGANT 600x1505mm Horizontal White Traditional Cast Iron Style 2 Column Radiator'), 'hgw Home Appliances > Heater');
  assert.equal(c('ELEGANT 600x500mm LED Illuminated Mirror with Anti-Fog, Dimmer and Touch Sensor'), 'hgw Home Decor > Mirror');
  assert.equal(c('ELEGANT 360 x 520mm Bathroom Mirror Cabinet with LED Makeup Light, Stainless Steel'), 'hgw Home Decor > Mirror');
  assert.equal(c('ELEGANT Bathroom Mirror Light 35cm with Switch 2.2W'), 'hgw Lighting > Wall Light');
  assert.equal(c('ELEGANT Wall Mounted White Bathroom Vanity Unit and Sink Basin Home Furniture'), 'hgw Bedding & Bath > Bathroom Accessories');
  assert.equal(c('ELEGANT Floating TV Stand Cabinet Unit Black - 1400x400x300mm'), 'hgw Furniture > TV Unit');
  assert.equal(c('ELEGANT Sideboard & TV Stand with Hinge LED Sensor Light 100cm-Black'), 'hgw Furniture > TV Unit');
  assert.equal(c('ELEGANT Cabinet Furniture Set 3 Door Bedroom Wardrobe and 4 Drawer Chest and Bedside Cabinet White/Oak'), 'hgw Furniture > Wardrobe');
  assert.equal(c('ELEGANT Vanity Makeup Table with Flip-top Mirror and LED Lights White'), 'hgw Furniture > Dressing Table');
  assert.match(c('ELEGANT Modern Chrome Thermostatic Angled Radiator Valves'), /^out: a part/);
  assert.match(c('ELEGANT Grey 1120mm Vertical Grille Radiator Cover Traditional 3 Pattern Slatted Wood Decor'), /^out: a part/);
  assert.match(c('ELEGANT Easy Plumb Riser Kit Feet Legs Panel Riser Pack for Rectangle Trays - Up to 1700mm'), /^out: a part/);
  const link = 'https://glp8.net/c/?si=21657&li=1&wi=447289&pid=abc&dl=elegant-1200mm-sliding-shower-door.html&ws=';
  const page = elegant.field('merchant_deep_link', k => (k === 'aw_deep_link' ? link : ''));
  assert.equal(page, 'https://www.elegantshowers.co.uk/elegant-1200mm-sliding-shower-door.html');
  assert.ok(elegant.RULES.shop.test(page));
});

test('L224 OPI UK: the card name stops before the shop category, nails / gift sets / bath & body', () => {
  assert.equal(opi.cardName('OPI Berlin There Done That Nail Polish Nail Lacquer Classics', 'Nail Lacquer'), 'OPI Berlin There Done That Nail Polish');
  assert.equal(opi.cardName('OPI Repair Mode Bond Building Nail Serum Treatments & Strengtheners Treatments & Strengtheners', 'Treatments & Strengtheners'), 'OPI Repair Mode Bond Building Nail Serum');
  assert.equal(opi.cardName('OPI Infinite Shine - Base & Top Duo Pack Infinite Shine', 'Infinite Shine'), 'OPI Infinite Shine - Base & Top Duo Pack');
  assert.equal(opi.cardName('OPI Stun n\' Done RapiDry RapiDry Quick-Dry Nail Polish', 'RapiDry™'), 'OPI Stun n\' Done RapiDry Nail Polish');
  assert.equal(opi.cardName('OPI Cult Classics Nail Lacquer 4-Piece Gift Set Gift Sets', 'Gift Sets'), 'OPI Cult Classics Nail Lacquer 4-Piece Gift Set');
  const c = (n, cat) => at(opi.classify({ name: n, feedCategory: cat }));
  assert.equal(c('OPI Red Hot Rio Nail Polish Nail Lacquer Classics', 'Nail Lacquer'), 'wgw Beauty & Fragrances > Nails');
  assert.equal(c('OPI Cult Classics Nail Lacquer 4-Piece Gift Set Gift Sets', 'Gift Sets'), 'wgw Beauty & Fragrances > Gift sets');
  assert.equal(c('OPI Moisture Misson Hand & Foot Cream Hands & Feet Nature Strong. Skincare', 'Hands & Feet'), 'wgw Beauty & Fragrances > Bath & body');
  assert.equal(c('OPI Glow Up Nail & Cuticle Oil Hands & Feet Nature Strong. Skincare', 'Hands & Feet'), 'wgw Beauty & Fragrances > Nails');
  assert.ok(opi.RULES.shop.test('http://www.opi.com/en-GB/products/nail-lacquer-berlin-there-done-that'));
  assert.equal(opi.RULES.network, 'rakuten');
});

test('L224 Ekster UK: wallets, bags and everyday carry to MGW; gift cards, phone cases and "Black Friday" bundles out (L107)', () => {
  const c = n => at(ekster.classify({ name: n }));
  assert.equal(c('Ekster Cardholder - VIP Offer'), 'mgw Bags & Accessories > Wallets & Purses');
  assert.equal(ekster.classify({ name: 'Ekster Cardholder - VIP Offer' }).name, 'Ekster Cardholder');
  assert.equal(c('GRID Backpack Pro'), 'mgw Bags & Accessories > Bags');
  assert.equal(c('Key Case + Wallet Bundle'), 'mgw Bags & Accessories > Wallets & Purses');
  assert.equal(c('Tracker Card for MagSafe'), 'mgw Everyday Carry / EDC > Everyday Carry / EDC');
  for (const n of ['Ekster Gift Card', 'iPhone 12 Mini Case', 'Black Friday Bundle', 'Black Friday Bundle (offer)', 'MagSafe Sticker']) assert.match(c(n), /^out:/, n);
});

test('L224 W. Hamond: jewellery to WGW, cufflinks and men\'s pieces to MGW, watches by audience, gifts and straps out', () => {
  const c = (n, cat = '') => at(hamond.classify({ name: n, feedCategory: cat }));
  assert.equal(withoutOption('Clogau 9ct Yellow Gold Timeless Love Wedding Ring - K'), 'Clogau 9ct Yellow Gold Timeless Love Wedding Ring');
  assert.equal(withoutOption('Sterling Silver Whitby Jet Zodiac Sagittarius Round Necklace - Default Title / Silver'), 'Sterling Silver Whitby Jet Zodiac Sagittarius Round Necklace');
  assert.equal(withoutOption('Sterling Silver Octopus Tentacle Torc Bangle - Option1 Value / Silver'), 'Sterling Silver Octopus Tentacle Torc Bangle');
  assert.equal(withoutOption('18ct Yellow Gold 0.49ct Sapphire Diamond Oval Cluster Ring - M.5'), '18ct Yellow Gold 0.49ct Sapphire Diamond Oval Cluster Ring');
  assert.equal(tidy('Official Harry Potter Sterling Silver Deathly Hallows Embellished Slider Charm'), 'Harry Potter Sterling Silver Deathly Hallows Embellished Slider Charm');
  assert.equal(c('Clogau Promises 9ct Yellow Gold 3mm Wedding Ring - K', 'Ring'), "wgw Women's Jewellery > Rings");
  assert.equal(c('Sterling Silver Whitby Jet Small Oval Stud Earrings', 'Earrings'), "wgw Women's Jewellery > Earrings");
  assert.equal(c('Clogau Insignia Sterling Silver Slim Bangle', 'Bangle'), "wgw Women's Jewellery > Bracelets");
  assert.equal(c('Sterling Silver Whitby Jet Marcasite Butterfly Brooch', 'Brooch'), "wgw Women's Jewellery > Jewellery");
  assert.equal(c('Sterling Silver Whitby Jet Barrel Cufflinks', 'Cufflinks'), "mgw Men's Jewellery > Cufflinks");
  assert.equal(c('Sterling Silver Whitby Jet Four Stone Inlaid Tie Slide', 'Tie Slide'), "mgw Men's Jewellery > Cufflinks");
  assert.equal(c('Little Star Otis Sterling Silver Mens Tag Necklace D', 'Necklace'), "mgw Men's Jewellery > Necklaces");
  assert.equal(c('Luminox Pacific Diver Mens Watch', 'Watch'), "mgw Watches > Men's Watches");
  assert.equal(c('Doxa Sub 200 II Sharkhunter Vintage Grey Bezel Rubber Strap Watch', 'Watch'), 'mgw Watches > Watches');
  assert.equal(c('Clogau Cariad Ladies Watch', 'Watch'), 'wgw Watches > Watches');
  assert.equal(c('Sterling Silver Bauxite Lineaire Polished Oval Ring', 'Ring'), "wgw Women's Jewellery > Rings");
  for (const [n, cat] of [['Garmin Watch Band QuickFit 26 Moss Silicone', 'Watch strap'], ['Garmin Strap UltraFit Nylon Straps 22mm Moss', 'Watch strap'],
    ['Montegrappa Armonia Ballpen Dark Blue', 'Pen'], ['Moorcroft Snow Leopard Vase', 'Vase'], ['Clogau Welsh Heart Sterling Silver Red Enamel Keyring', 'Keyring'],
    ['Sterling Silver Whitby Jet Cow Cocktail Stirrer', 'Home'], ['Gold Polishing Cloth', 'Jewellery Cleaning'], ['Art In Bronze Hippo by Butler & Peach', 'Gift']]) {
    assert.match(c(n, cat), /^out:/, n);
  }
  assert.ok(hamond.RULES.shop.test('http://whamond.com/products/sterling-silver-ring?variant=1'));
  // C.W. Sellors sells the same catalogue: only W. Hamond is imported (see the rules file).
  assert.ok(config.candidates.some(x => /C\.W\.Sellors/.test(x.name)));
});

test('L224 Cotton On: one card per style and colour, by brand to WGW / MGW / KGW, Typo and personalised items out', () => {
  assert.deepEqual(cotton.parts('Cotton On Kids - Sammy Oversize Hoodie - Rocky road/stunt'), { brand: 'Cotton On Kids', style: 'Sammy Oversize Hoodie', colour: 'Rocky road/stunt' });
  assert.equal(cotton.displayName('Body - Body Bestee T-Shirt Bra - Maple sugar'), 'Body Bestee T-Shirt Bra - Maple sugar');
  assert.equal(cotton.displayName('Cotton On Men - The Rolling Stones Music Crop Fit T-Shirt - Lcn bra washed black / rolling stones'), 'The Rolling Stones Music Crop Fit T-Shirt - Washed black / rolling stones');
  const get = row => k => row[k] || '';
  const k1 = cotton.productKey(get({ merchant_deep_link: 'https://cottonon.com/UK/body-bestee-t-shirt-bra/9360978120171.html', product_name: 'Body - Body Bestee T-Shirt Bra - Maple sugar' }));
  const k2 = cotton.productKey(get({ merchant_deep_link: 'https://cottonon.com/UK/body-bestee-t-shirt-bra/9361619255337.html', product_name: 'Body - Body Bestee T-Shirt Bra - Maple sugar' }));
  assert.equal(k1, k2, 'the sizes of one colour are one card');
  const c = (n, b) => at(cotton.classify({ name: n, brand: b }));
  assert.equal(c('Body - Body Bestee T-Shirt Bra - Maple sugar', 'Body'), 'wgw Clothing > Underwear');
  assert.equal(c('Body - Tanga Lace G String - Black', 'Body'), 'wgw Clothing > Underwear');
  assert.equal(c('Body - Washed Satin Wide Leg Pant - Cream', 'Body'), 'wgw Clothing > Trousers');
  assert.equal(c('Cotton On Women - Molly Mini Dress - Black', 'Cotton On Women'), 'wgw Clothing > Dresses');
  assert.equal(c('Cotton On Women - Softest Luxe Mohair Knit - Black', 'Cotton On Women'), 'wgw Clothing > Knitwear');
  assert.equal(c('Cotton On Women - 90S Boatneck ¾ Sleeve - Black', 'Cotton On Women'), 'wgw Clothing > T-Shirts');
  assert.equal(c('Rubi - Edie Crossbody Bag - Black pu', 'Rubi'), 'wgw Bags & Accessories > Bags');
  assert.equal(c('Rubi - 5Pk Ankle Sock - White', 'Rubi'), 'wgw Clothing > Socks');
  assert.equal(c('Cotton On Men - Box Fit Graphic Hoodie - Washed black / 32', 'Cotton On Men'), 'mgw Clothing > Hoodies');
  assert.equal(c('Cotton On Men - Box Fit Rugby Polo - Vintage black panel', 'Cotton On Men'), 'mgw Clothing > Shirts');
  assert.equal(c('Cotton On Men - Waxed Harrington Jacket - Black', 'Cotton On Men'), 'mgw Clothing > Jackets');
  assert.equal(c('Cotton On Kids - Clarke Short Sleeve Pyjama Top - Fairy pink marle', 'Cotton On Kids'), 'kgw Clothing > Nightwear & Loungewear');
  assert.equal(c('Cotton On Kids - Ivy Sleeveless Dress - Denim navy', 'Cotton On Kids'), 'kgw Clothing > Clothing');
  assert.match(c('Typo - Everyday Mug - Dad you re the best model', 'Typo'), /^out: Typo/);
  assert.match(c('Cotton On Kids - Pet Bandana Family Christmas - Vanilla/everything christmas', 'Cotton On Kids'), /^out:/);
  assert.match(c('Body - Personalised Boyfriend Boxer Pant - Light blue/white stripe contrast', 'Body'), /^out:/);
  assert.equal(cotton.displayBrand('Body'), 'Cotton On Body');
});

test('L224 Green Kid Crafts: science boxes to Educational Toys, craft kits to Toy Craft Kits, subscriptions out', () => {
  const c = n => at(gkc.classify({ name: n }));
  assert.equal(c('Chemistry Lab Box'), 'kgw Toys & Games > Educational Toys');
  assert.equal(c('Art Lab Box'), 'kgw Toys & Games > Toy Craft Kits');
  assert.equal(c('Gingerbread House Village'), 'kgw Toys & Games > Toy Craft Kits');
  assert.match(c('Discovery Science &amp; Craft Subscription (Ages 5-10+)'), /^out: a subscription/);
  assert.equal(gkc.RULES.currency, 'USD');
});

test('L224 the wave 1 UK list file names only rules that exist, each once', () => {
  const pairs = readFileSync('tools/massive/uk-wave1-1124.txt', 'utf8').split(/\r?\n/).map(l => l.split('#')[0].trim()).filter(Boolean);
  assert.equal(new Set(pairs).size, pairs.length);
  for (const p of pairs) {
    const [key, site] = p.split(':');
    const rules = readFileSync(`tools/import-rules/${key}.mjs`, 'utf8');
    assert.ok(new RegExp(`sites: \\[[^\\]]*'${site}'`).test(rules), `${p}: the site is in the rules`);
  }
  assert.ok(pairs.includes('whamond-uk:wgw') && pairs.includes('cottonon-uk:kgw'));
});
