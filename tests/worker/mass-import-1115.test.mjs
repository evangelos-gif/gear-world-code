// Mass import of 15 Nov 2026 (Manager: known brands that ship to the UK first). Timberland UK: the pound feed of the
// Daisycon programme 15048 (lessons L163), men's clothing, shoes and watches on Men's Gear World.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tim from '../../tools/import-rules/timberland-uk.mjs';

const col = row => c => String(row[c] ?? '');

test('Timberland UK: the pound feed on MGW, each product by the last word of its name, https pictures, UK default delivery', () => {
  assert.equal(tim.RULES.network, 'daisycon');
  assert.equal(tim.RULES.advertiserId, 15048);
  assert.equal(tim.RULES.currency, 'GBP');
  assert.deepEqual(tim.RULES.sites, ['mgw']);
  assert.ok(tim.RULES.shop.test('https://www.timberland.co.uk/en-gb/p/men-10029/euro-sprint-hiking-boot-for-men-in-yellow-TB0A1NHJ231'));
  assert.ok(!tim.RULES.shop.test('https://www.timberland.de/de-de/p/herren/x'), 'the German shop is another feed');
  const row = { merchant_image_url: 'http://assets.timberland.eu/images/t_Thumbnail/v1/TB0A6DZBA11-HERO/x.png', dc_gender: 'male', merchant_deep_link: 'https://www.timberland.co.uk/en-gb/p/men-10029/x' };
  assert.equal(tim.field('merchant_image_url', col(row)), 'https://assets.timberland.eu/images/t_Thumbnail/v1/TB0A6DZBA11-HERO/x.png');
  assert.equal(tim.field('category_name', col(row)), 'male');
  assert.equal(tim.displayName('Timberland - Euro Sprint Hiking Boot for Men in Yellow, Man, Yellow/Black, Size: 8.5'), 'Euro Sprint Hiking Boot in Yellow');
  assert.equal(tim.displayName("Timberland - Men's Timberland C. F. Stead Indigo Suede Heritage 6-Inch Boot in Dark Blue, Man, Blue, Size: 10"), 'C. F. Stead Indigo Suede Heritage 6-Inch Boot in Dark Blue');
  const c = n => { const r = tim.classify({ name: n, awinCategory: 'male' }); return r.reject ? `out: ${r.reject}` : `${r.siteCategory} > ${r.subcategory}`; };
  assert.equal(c('Timberland - Baboosic Brook Oxford Polo for Men in Teal, Man, Teal, Size: XXL'), 'Clothing > Shirts', 'an Oxford polo is a shirt, not a shoe');
  assert.equal(c('Timberland - Winsor Park Oxford Shoe for Men in Beige, Man, Beige, Size: 9'), 'Shoes > Shoes');
  assert.equal(c('Timberland - Graphic T-Shirt in Teal, Man, Teal, Size: XXL'), 'Clothing > T-Shirts', 'a T-shirt is not a shirt');
  assert.equal(c('Timberland - Williams River Crewneck Jumper for Men in Navy, Man, Navy, Size: M'), 'Clothing > Knitwear');
  assert.equal(c('Timberland - Est. 1973 Logo Crewneck Sweatshirt for Men in Blue, Man, Blue, Size: L'), 'Clothing > Sweatshirts');
  assert.equal(c('Timberland - Euro Hiker Mid Lace-Up With Gore-Tex Bootie For Men in Black, Man, Black, Size: 8'), 'Shoes > Boots', 'a lace-up is not laces');
  assert.equal(c('Timberland - Mylo Bay Low Slip-on Trainer for Men in Black, Man, Black, Size: 9'), 'Shoes > Trainers');
  assert.equal(c('Timberland - Stretch Core Jeans for Men in Blue, Man, Blue, Size: 34'), 'Clothing > Jeans');
  assert.equal(c('Timberland - Polartec Ultralight Packable Vest for Men in Black, Man, Black, Size: M'), 'Clothing > Jackets');
  assert.equal(c('Timberland - Carrigan Watch for Men in Black, Man, Black'), "Watches > Men's Watches");
  assert.match(c('Timberland - Replacement Laces for Men in Brown, Man, Brown'), /^out:/);
  assert.match(tim.classify({ name: "Timberland - Women's Courmayeur Valley Boot in Black", awinCategory: 'female' }).reject, /men's/);
});

// Round 2 (owner, 15 Nov 2026: "to strengthen the USA"): TEMU's US feed on the older sites, like DHgate (L161), and at
// most RULES.maxPerSubcategory cards per subcategory, the same ones at every refresh (lessons L164).
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import * as temu from '../../tools/import-rules/temu-us.mjs';
import { planLegacyImport, stableRank } from '../../tools/legacy-import-plan.mjs';
import { DC_COLUMNS } from '../../tools/daisycon-feed.mjs';
import { csvLine } from '../../tools/network-links.mjs';
import { deliveryCountries } from '../../src/lib/delivery.js';

test('TEMU US: our groups only, no brands, characters, merchandise, adult items or plugs; dollars only for the US', async () => {
  assert.equal(temu.RULES.currency, 'USD');
  assert.equal(temu.feedFiles('/x').length, 1);
  assert.match(temu.feedFiles('/x')[0], /DAISYCON_18371_US\.csv\.gz$/, 'the US file of lessons L163, never the German one');
  const url = 'https://www.temu.com/goods.html?_bg_fs=1&goods_id=602537419762922&sku_id=35299799344955&_x_ns_ts={timestamp}';
  assert.equal(temu.productKey(c => (c === 'merchant_deep_link' ? url : '')), 'temu-602537419762922');
  assert.equal(temu.field('merchant_deep_link', () => url), 'https://www.temu.com/goods.html?goods_id=602537419762922', 'no tracking placeholders in the shop page');
  const c = (name, path) => { const r = temu.classify({ name, feedCategory: path }); return r.reject ? `out: ${r.reject}` : `${r.site} ${r.siteCategory} > ${r.subcategory}`; };
  const W = 'Clothing, Shoes & Jewelry|Women|Clothing|Tops, Tees & Blouses > Tops';
  assert.equal(c('Women\'s Floral Midi Dress, Short Sleeve, Summer', W), 'wgw Clothing > Dresses');
  assert.equal(c('Men\'s Casual Cargo Shorts With Pockets', 'Clothing, Shoes & Jewelry|Men|Clothing|Shorts'), 'mgw Clothing > Shorts');
  assert.equal(c('Girls\' Flower Print Clothing Set', 'Clothing, Shoes & Jewelry|Girls|Clothing|Clothing Sets'), 'kgw Clothing > Clothing');
  assert.equal(c('Ceramic Vase For Flowers', 'Home & Kitchen|Home Décor Products|Vases'), 'hgw Home Decor > Vase');
  assert.equal(c('Solar Garden Lantern With Hummingbird', 'Patio, Lawn & Garden|Outdoor Lighting|Landscape Lighting'), 'ggw Outdoor Lighting & Garden Electrical > Solar lights', 'a solar light keeps its battery');
  assert.equal(c('Stainless Steel Men\'s Ring, Simple Band', 'Apparel & Accessories|Jewelry|Rings'), 'mgw Men\'s Jewellery > Rings');
  assert.equal(c('Women\'s Pearl Drop Earrings', 'Apparel & Accessories|Jewelry|Earrings'), 'wgw Women\'s Jewellery > Earrings');
  assert.match(c('Women\'s UGG Style Snow Boots', 'Clothing, Shoes & Jewelry|Women|Shoes|Boots'), /famous brand/);
  assert.match(c('Stitch Cartoon Hoodie For Women', W), /out:/);
  assert.match(c('Women\'s Black R&b Tour Graphic T-shirt, Concert Merchandise', W), /merchandise/);
  assert.match(c('Sexy Lace Lingerie Set', W), /adult/);
  assert.match(c('Electric Heated Throw Blanket With Plug', 'Home & Kitchen|Bedding|Blankets & Throws'), /plug/);
  assert.match(c('Kids Building Blocks Set', 'Toys & Games|Toys|Building Toys'), /not a TEMU group/, 'toys stay out (product safety)');
  assert.match(c('Car Seat Cover', 'Automotive|Interior Accessories|Seat Covers & Accessories'), /not a TEMU group/);
  assert.equal(temu.displayName("A Women's Round Neck T-shirt Made Of 100%, Perfect For Spring And Summer. A Fashionable And Relaxed"), "Women's Round Neck T-shirt Made Of 100%");
  for (const [site, name] of [['wgw', 'TEMU'], ['mgw', 'TEMU'], ['kgw', 'TEMU'], ['hgw', 'TEMU'], ['ggw', 'TEMU'], ['wgw', 'Dima Eyewear'], ['wgw', 'Grey State'], ['wgw', 'Kixies'],
    ['kgw', 'UPPER'], ['hgw', 'Imarku'], ['hgw', 'Super Area Rugs'], ['hgw', 'LOOMY Home'], ['hgw', 'Rowabi'], ['hgw', 'Airdog']]) {
    const m = await import(`../../sites/${site}/site.config.js`);
    const cfg = m.default || Object.values(m)[0];
    assert.deepEqual(deliveryCountries(cfg, name), ['US'], `${name} delivers only to the US on ${site}`);
  }
});

test('L164 maxPerSubcategory: at most N cards per subcategory, chosen by the product id (the same at every refresh)', async () => {
  assert.equal(stableRank('temu-1'), stableRank('temu-1'));
  assert.notEqual(stableRank('temu-1'), stableRank('temu-2'));
  const archive = mkdtempSync(join(tmpdir(), 'gw-temu-'));
  const row = i => ({ aw_product_id: `t${i}`, merchant_name: 'TEMU', product_name: `Women's Floral Midi Dress Style ${i}`, brand_name: 'Temu',
    merchant_category: 'Clothing, Shoes & Jewelry|Women|Clothing|Dresses > Dresses', merchant_deep_link: `https://www.temu.com/goods.html?goods_id=${100000 + i}&sku_id=1`,
    aw_deep_link: `https://bdt9.net/c/?si=18371&li=1&wi=447289&pid=x${i}`, merchant_image_url: `https://img.kwcdn.com/product/${i}.jpg`, search_price: '19.99', currency: 'USD', in_stock: '1' });
  const rows = Array.from({ length: 150 }, (_, i) => row(i + 1));
  writeFileSync(join(archive, 'DAISYCON_18371_US.csv.gz'), gzipSync(csvLine(DC_COLUMNS) + rows.map(r => csvLine(DC_COLUMNS.map(c => r[c]))).join('')));
  const a = await planLegacyImport({ archive, retailer: 'temu-us', outDir: mkdtempSync(join(tmpdir(), 'gw-temu-a-')), now: new Date('2026-11-15T23:00:00Z') });
  const b = await planLegacyImport({ archive, retailer: 'temu-us', outDir: mkdtempSync(join(tmpdir(), 'gw-temu-b-')), now: new Date('2026-11-16T23:00:00Z') });
  assert.equal(a.accepted.wgw.length, temu.RULES.maxPerSubcategory);
  assert.deepEqual(a.accepted.wgw.map(p => p.awin_product_id).sort(), b.accepted.wgw.map(p => p.awin_product_id).sort(), 'the same cards at every refresh');
  assert.ok(/cards per subcategory/.test(JSON.stringify(a.rejected)), 'the others are left out with that reason');
  assert.equal(a.accepted.wgw[0].currency, 'USD');
});

import * as dima from '../../tools/import-rules/dima-eyewear-us.mjs';
import * as grey from '../../tools/import-rules/greystate-us.mjs';
import * as imarku from '../../tools/import-rules/imarku-us.mjs';
import * as rugs from '../../tools/import-rules/superarearugs-us.mjs';
import * as loomy from '../../tools/import-rules/loomy-us.mjs';
import * as kixies from '../../tools/import-rules/kixies-us.mjs';
import * as upper from '../../tools/import-rules/upper-us.mjs';
import * as rowabi from '../../tools/import-rules/rowabi-us.mjs';
import * as airdog from '../../tools/import-rules/airdog-us.mjs';
import * as narwal from '../../tools/import-rules/narwal-eu.mjs';
import * as xplus from '../../tools/import-rules/xpluswear.mjs';

test('Round 2 shops: each product to its place, accessories and gift cards out, Narwal and Xpluswear only in the EU', async () => {
  const sc = r => (r.reject ? `out: ${r.reject}` : `${r.site} ${r.siteCategory} > ${r.subcategory}`);
  assert.equal(sc(dima.classify({ name: 'Aggie', feedCategory: 'Sunglasses' })), 'wgw Bags & Accessories > Sunglasses');
  assert.equal(dima.classify({ name: 'Aggie', feedCategory: 'Eyeglasses' }).name, 'Aggie Glasses Frames');
  assert.equal(sc(grey.classify({ name: 'Mia Dress' })), 'wgw Clothing > Dresses');
  assert.equal(sc(grey.classify({ name: 'Long Sleeve Audra Top' })), 'wgw Clothing > Tops & Blouses');
  assert.equal(sc(imarku.classify({ name: '16-Piece Japanese Knife Set' })), 'hgw Kitchen & Dining > Kitchen Knives');
  assert.match(sc(imarku.classify({ name: 'Stainless Steel Cast Iron Cleaner' })), /^out/);
  assert.equal(rugs.displayName("Confetti Bright & Bold 5-Carrier Braided Rug in Brilliant Red - 2' X 3' Oval"), 'Confetti Bright & Bold 5-Carrier Braided Rug in Brilliant Red');
  assert.equal(sc(loomy.classify({ name: 'Blue Striped Jute' })), 'hgw Home Decor > Rug');
  assert.match(sc(loomy.classify({ name: 'Eco-Friendly Rug Pad' })), /^out/);
  assert.equal(kixies.displayName('Ally: 1940s Polka Dot Flashback. Petite to Plus Size'), 'Ally 1940s Polka Dot Flashback Stockings');
  assert.equal(sc(upper.classify({ name: 'Diaper Backpack - Noah - Large Capacity Unisex Diaper Backpack' })), 'kgw Baby & Toddler > Nappy Bags');
  assert.match(sc(upper.classify({ name: 'Gold Ring - NYC Duo Ridge Ring' })), /^out/);
  assert.equal(sc(rowabi.classify({ name: 'Beatrice Rattan Pendant Light' })), 'hgw Lighting > Pendant Light');
  assert.match(sc(rowabi.classify({ name: 'Customized Hanging Light Cord Kit' })), /^out/);
  assert.equal(sc(airdog.classify({ name: 'Airdog Pro Air Purifier-530 sq.ft' })), 'hgw Home Appliances > Air Purifier');
  assert.match(sc(airdog.classify({ name: 'FitAir Replacement Parts' })), /^out/);
  assert.equal(sc(narwal.classify({ name: 'Narwal Freo Z10 Ultra Robot Vacuum & Mop' })), 'hgw Home Appliances > Vacuum Cleaner');
  assert.match(sc(narwal.classify({ name: 'Compatible with: Narwal Flow 2 / Freo Z10 Pro / Freo 20' })), /^out/);
  assert.equal(sc(xplus.classify({ name: 'Xpluswear Plus Size Vacation Hot Pink Round Neck Short Sleeve Ruffle Maxi Dress' })), 'wgw Clothing > Dresses');
  assert.match(sc(xplus.classify({ name: 'Xpluswear Plus Size Sexy See Through Mesh Top' })), /^out/);
  const hgw = await import('../../sites/hgw/site.config.js'); const wgw = await import('../../sites/wgw/site.config.js');
  assert.deepEqual(deliveryCountries(hgw.default || Object.values(hgw)[0], 'Narwal EU').includes('GB'), false);
  assert.deepEqual(deliveryCountries(wgw.default || Object.values(wgw)[0], 'Xpluswear').includes('GB'), false);
});
