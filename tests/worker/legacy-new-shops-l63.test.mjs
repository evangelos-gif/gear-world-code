// New Awin shops of 25 Oct 2026 on the older sites (lessons L63): 100% PURE (100percentpure.de, euros) on Women's Gear
// World "Beauty & Fragrances", and GRABO (order.grabo.com, US dollars) on Construction Gear World. Names, categories and
// prices are from the awin-feed-sample report of 25 Oct 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import * as pure from '../../tools/import-rules/100percentpure.mjs';
import * as grabo from '../../tools/import-rules/grabo.mjs';
import { deliveryCountries } from '../../src/lib/delivery.js';
import { rateQuotes } from '../../src/lib/fx.js';
import wgw from '../../sites/wgw/site.config.js';
import cgw from '../../sites/cgw/site.config.js';

const place = r => (r.reject ? `REJECT ${r.reject}` : `${r.site} | ${r.siteCategory} | ${r.subcategory}`);

test('100% PURE: the German product type is left out of the card name, English parts stay', () => {
  assert.equal(pure.displayName('Coffee Bean Caffeine Brightening Eye Cream 30 ml - Augencreme'), 'Coffee Bean Caffeine Brightening Eye Cream 30 ml');
  assert.equal(pure.displayName('Lip Glaze Fruit Pigments Sultry - Lippenstift'), 'Lip Glaze Fruit Pigments Sultry');
  assert.equal(pure.displayName('Fruit Pigmented® Tinted Moisturizer - Getönte Tagespflege'), 'Fruit Pigmented® Tinted Moisturizer');
  assert.equal(pure.displayName('Fruit Pigmented® Pretty Naked Palette - MakeUp Palette'), 'Fruit Pigmented® Pretty Naked Palette');
  assert.equal(pure.displayName('Hydrating Hand Wash - Tea Tree'), 'Hydrating Hand Wash - Tea Tree');
  assert.equal(pure.displayName('Long Last Brow Pomade - Medium Brown'), 'Long Last Brow Pomade - Medium Brown');
  assert.equal(pure.productKey(c => (c === 'merchant_deep_link' ? 'https://www.100percentpure.de/Luminous-Primer' : '')), 'Luminous-Primer');
});

test('100% PURE: every product to its Beauty subcategory (WGW\'s own names), gift cards out', () => {
  const p = (name, feedCategory = '', awinCategory = '') => place(pure.classify({ name, feedCategory, awinCategory }));
  const B = 'wgw | Beauty & Fragrances | ';
  assert.equal(p('Coffee Bean Caffeine Brightening Eye Cream 30 ml - Augencreme', 'Augenpflege'), B + 'Skincare');
  assert.equal(p('Fruit Pigmented® Foundation Powder - White Peach', 'Foundation'), B + 'Make-up');
  assert.equal(p('Honey & Virgin Coconut Restorative Conditioner 236 ml', 'Conditioner'), B + 'Hair care');
  assert.equal(p('Kelp & Mint Volumizing Shampoo 236 ml'), B + 'Hair care');
  assert.equal(p('Pro-Vitamin B5 Smooth Hair Serum - Haarserum', 'Spezialpflege'), B + 'Hair care', 'a hair serum, not a face serum');
  assert.equal(p('Vitamin C Serum - Feuchtigkeitsserum', 'Serum'), B + 'Skincare');
  assert.equal(p('Fruit Pigmented® Tinted Moisturizer - Getönte Tagespflege', 'Getönte Tagespflege'), B + 'Make-up');
  assert.equal(p('Lysine + Herbs Lip Balm - Lippenpflege', 'Lippenpflege'), B + 'Skincare');
  assert.equal(p('Lip Glaze Fruit Pigments Sultry - Lippenstift', 'Lip Glaze'), B + 'Make-up');
  assert.equal(p('Fruit Pigmented® Powder Blush Cherry - Rouge', 'Rouge'), B + 'Make-up');
  assert.equal(p('Coconut Hand Buttercream - Handcreme', 'Coconut'), B + 'Bath & body');
  assert.equal(p('Blood Orange Nourishing Body Cream - Körperlotion', 'Body Cream'), B + 'Bath & body');
  assert.equal(p('Lavender Sea Therapy Bath - Badesalz', 'Badesalz'), B + 'Bath & body');
  assert.equal(p('Mangosteen Shower Gel 474 ml - Duschgel', 'Duschgel'), B + 'Bath & body');
  assert.equal(p('Hydrating Hand Wash - Tea Tree', 'Hände'), B + 'Bath & body');
  assert.equal(p('Reusable Face Cleansing Pad small - Reinigungspad', 'Beauty Tools'), B + 'Beauty tools');
  assert.equal(p('Coffee Caffeine Recovery Hydrogel Mask - Gesichtsmaske', 'Peelings & Masken'), B + 'Skincare');
  assert.equal(p('Dark Spot Remover - Gesichtspflege', 'Treatments'), B + 'Skincare');
  assert.equal(p('Organic Argan Oil', 'Tagespflege'), B + 'Skincare');
  assert.equal(p('Gift Card 1 - Gutschein', 'Gutschein'), 'REJECT gift card, not a product');
  // No word in the name: the shop's category, then Awin's, placed but listed as "check" in the report.
  const doubt = pure.classify({ name: 'Brightening Essentials', feedCategory: 'Tagespflege' });
  assert.equal(doubt.subcategory, 'Skincare');
  assert.equal(doubt.doubt, true);
});

test('GRABO: lifters and their kit to Site Equipment, Nemo tools to Power Tools, repair kits and boat care out', () => {
  const g = (name, feedCategory = '') => place(grabo.classify({ name, feedCategory }));
  const SITE = 'cgw | Site Equipment | Site Equipment';
  const TOOLS = 'cgw | Power Tools | Power Tools';
  assert.equal(g('GRABO Pro Brushless Suction Gripster 375 lb, Tool Only, No Battery', 'Suction Gripsters'), SITE);
  assert.equal(g('GRABO Lifting Strap, Hands Free Shoulder Sling for Four Anchor Point Gripsters', 'Suction Gripster Accessories'), SITE);
  assert.equal(g('GRABO Bore Mount Core Drill Holder, Two-Cup', 'Suction Gripster Accessories'), SITE);
  assert.equal(g('GRABO Tile Vibration Attachment for Thinset Setting', 'Suction Gripster Accessories'), SITE);
  assert.equal(g('GRABO Pro Brushless 20V 2.6Ah Li-Ion Battery', 'Suction Gripster Batteries'), SITE);
  assert.equal(g('GRABO Pro Brushless 20V Battery Charger', 'Suction Gripster Chargers'), SITE);
  assert.equal(g('Nemo Underwater Cordless Impact Wrench, Waterproof to 50 m (164 ft)', 'Hardware > Tools > Impact Wrenches & Drivers'), TOOLS);
  assert.equal(g('Nemo Clean Room Sterilized Cordless Drill/Driver', 'Hardware > Tools > Drills > Handheld Power Drills'), TOOLS);
  assert.equal(g('Nemo Special Ops Drill 6Ah Battery', 'Hardware > Tool Accessories > Power Tool Batteries'), TOOLS);
  assert.equal(g('Reciprocating Saw/Special Ops Charger', 'Hardware > Tool Accessories > Power Tool Chargers'), TOOLS);
  assert.equal(g('Nemo Glass Drill Bits', 'Hardware > Tool Accessories > Drill & Screwdriver Accessories > Drill & Screwdriver Bits'), TOOLS);
  assert.equal(g('Kits for Special Ops Hammer Drill - Balance Pressure Assembly', 'Hardware > Tool Accessories > Drill & Screwdriver Accessories'), 'REJECT repair kit or spare part');
  assert.equal(g('Kits for V2 Nemo Angle Grinder - Electric switch', 'Hardware > Tool Accessories > Grinder Accessories'), 'REJECT repair kit or spare part');
  assert.equal(g('V3 Nemo Flood Light Replacement & Accessories - Upper Body (Lamp Head)', 'Hardware > Tool Accessories > Flashlight Accessories'), 'REJECT repair kit or spare part');
  assert.equal(g('GRABO Pro Brushless Foam Rubber Seal for Textured Materials', 'Suction Gripster Accessories'), 'REJECT repair kit or spare part');
  assert.equal(g('Hull Cleaner Scraper Brush for Heavy Growth', 'Vehicles & Parts > Vehicle Parts & Accessories > Watercraft Parts & Accessories > Watercraft Care'), 'REJECT boat or vehicle care, not construction gear');
  assert.equal(grabo.productKey(c => (c === 'merchant_deep_link' ? 'https://order.grabo.com/product/grabo-pro-brushless-tool-only/' : '')), 'grabo-pro-brushless-tool-only');
});

test('where they deliver, and the euro and dollar prices get "≈ £"', () => {
  assert.deepEqual(deliveryCountries(wgw, '100% PURE'), ['EU', 'CH', 'NO']);
  assert.deepEqual(deliveryCountries(wgw, 'Coes'), ['GB']);
  assert.deepEqual(deliveryCountries(cgw, 'GRABO'), ['WORLD']);
  assert.equal(wgw.convertForeignPrices, true);
  assert.deepEqual(rateQuotes(cgw), ['EUR', 'ALL', 'RON', 'RUB', 'USD'], 'GRABO sells in US dollars');
  assert.deepEqual(rateQuotes(wgw), ['EUR', 'ALL', 'RON', 'RUB']);
  assert.ok(!('extraCss' in cgw), 'the "≈ £" style is in the shared stylesheet now');
});

const header = ['merchant_deep_link', 'product_name', 'merchant_product_id', 'brand_name', 'merchant_category', 'category_name', 'merchant_image_url', 'search_price', 'currency', 'in_stock', 'stock_quantity', 'ean'];
const line = v => v.map(x => (/[",\n]/.test(x) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(',');
const feed = rows => gzipSync(Buffer.from([line(header), ...rows.map(line)].join('\n') + '\n'));

test('100% PURE plan: two feeds of the same products give one card each, with the category of the feed that has it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pure-'));
  const U = s => `https://www.100percentpure.de/${s}`;
  const I = s => `https://www.100percentpure.de/media/image/product/${s}.jpg`;
  const B = '100% PURE® - Purity Cosmetics Inc.';
  // Feed 93600: no categories; feed 98144: the shop's categories (as in the report: 366 rows "(no category)").
  writeFileSync(join(dir, 'AWIN_13991_93600.csv.gz'), feed([
    [U('Brightening-Essentials-Augencreme'), 'Brightening Essentials - Augencreme', 'A1', B, '', '', I(1), '31', 'EUR', '1', '139', ''],
    [U('Fruit-Pigmented-Powder-Blush-Cherry-Rouge'), 'Fruit Pigmented® Powder Blush Cherry - Rouge', 'A2', B, '', 'Cosmetics', I(2), '39.5', 'EUR', '0', '0', ''],
    [U('Gift-Card-1-Gutschein'), 'Gift Card 1 - Gutschein', 'A3', '', '', 'Gifts', I(3), '25', 'EUR', '1', '50', '']
  ]));
  writeFileSync(join(dir, 'AWIN_13991_98144.csv.gz'), feed([
    [U('Brightening-Essentials-Augencreme'), 'Brightening Essentials - Augencreme', 'A1', B, 'Augenpflege', 'Cosmetics & Skincare', I(1), '31', 'EUR', '1', '139', ''],
    [U('Fruit-Pigmented-Powder-Blush-Cherry-Rouge'), 'Fruit Pigmented® Powder Blush Cherry - Rouge', 'A2', B, 'Rouge', 'Cosmetics', I(2), '39.5', 'EUR', '0', '0', ''],
    [U('Gift-Card-1-Gutschein'), 'Gift Card 1 - Gutschein', 'A3', '', 'Gutschein', 'Gifts', I(3), '25', 'EUR', '1', '50', '']
  ]));
  const out = join(dir, 'out');
  const r = await planLegacyImport({ archive: dir, retailer: '100percentpure', outDir: out, now: new Date('2026-10-25T17:00:00Z') });
  assert.equal(r.rows, 6);
  assert.equal(r.products, 3, 'one product per page, not one per feed');
  assert.equal(r.accepted.wgw.length, 1);
  const p = r.accepted.wgw[0];
  assert.equal(p.product_name, 'Brightening Essentials');
  assert.equal(p.subcategory, 'Skincare', 'from the category of the second feed (Augenpflege)');
  assert.equal(p.currency, 'EUR');
  assert.equal(p.retailer, '100% PURE');
  assert.equal(p.awin_product_id, '13991:Brightening-Essentials-Augencreme');
  assert.match(p.affiliate_url, /^https:\/\/www\.awin1\.com\/cread\.php\?awinmid=13991&awinaffid=3057233&ued=https%3A%2F%2Fwww\.100percentpure\.de%2FBrightening-Essentials-Augencreme$/);
  assert.equal(r.rejected['out of stock in every size'].length, 1, 'the blush is sold out');
  assert.equal(r.rejected['gift card, not a product'].length, 1);
  const sql = readFileSync(join(out, 'sql', 'wgw', '0001.sql'), 'utf8');
  assert.match(sql, /ON CONFLICT\(awin_product_id\) DO UPDATE/);
  assert.match(sql, /'EUR'/);
});

test('GRABO plan: dollar prices, the shop\'s own pages, repair kits left out', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'grabo-'));
  const U = s => `https://order.grabo.com/product/${s}/`;
  const I = s => `https://order.grabo.com/wp-content/uploads/2026/06/${s}.png`;
  writeFileSync(join(dir, 'AWIN_129497_118332.csv.gz'), feed([
    [U('grabo-pro-brushless-tool-only'), 'GRABO Pro Brushless Suction Gripster 375 lb, Tool Only, No Battery', 'G1', 'GRABO', 'Suction Gripsters', 'Power Tools', I('g1'), '259.99', 'USD', '1', '', '840082401315'],
    [U('grabo-pro-brushless-foam-rubber-seal'), 'GRABO Pro Brushless Foam Rubber Seal for Textured Materials', 'G2', 'GRABO', 'Suction Gripster Accessories', 'DIY', I('g2'), '24.99', 'USD', '1', '', '840082401476']
  ]));
  writeFileSync(join(dir, 'AWIN_129497_118395.csv.gz'), feed([
    [U('nemo-underwater-impact-wrench'), 'Nemo Underwater Cordless Impact Wrench, Waterproof to 50 m (164 ft)', 'N1', 'Nemo Power Tools', 'Hardware > Tools > Impact Wrenches & Drivers', 'Power Tools', I('n1'), '899.00', 'USD', '1', '5', ''],
    [U('kits-hammer-drill-balance'), 'Kits for Special Ops Hammer Drill - Balance Pressure Assembly', 'N2', 'Nemo Power Tools', 'Hardware > Tool Accessories > Drill & Screwdriver Accessories', 'Power Tools', I('n2'), '39.00', 'USD', '1', '5', '']
  ]));
  const out = join(dir, 'out');
  const r = await planLegacyImport({ archive: dir, retailer: 'grabo', outDir: out, now: new Date('2026-10-25T17:00:00Z') });
  const got = r.accepted.cgw.map(p => `${p.site_category} | ${p.product_name} | ${p.currency} ${p.price}`).sort();
  assert.deepEqual(got, [
    'Power Tools | Nemo Underwater Cordless Impact Wrench, Waterproof to 50 m (164 ft) | USD 899',
    'Site Equipment | GRABO Pro Brushless Suction Gripster 375 lb, Tool Only, No Battery | USD 259.99'
  ]);
  assert.equal(r.accepted.cgw.find(p => /Gripster/.test(p.product_name)).awin_product_id, '129497:grabo-pro-brushless-tool-only');
  assert.equal(r.rejected['repair kit or spare part'].length, 2);
});
