// New Awin shops of 13 Nov 2026 (lessons L117, L120). The rows are made up, in the layout of the Awin Google feeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import * as otra from '../../tools/import-rules/otra.mjs';

test('Otra Eyewear: sunglasses to Bags & Accessories > Sunglasses, men by the feed gender, frames and cases for checking', () => {
  const c = (name, gender = '', feedCategory = 'Apparel & Accessories > Clothing Accessories > Sunglasses') =>
    otra.classify({ name, feedCategory, awinCategory: `Apparel & Accessories > Clothing Accessories > Sunglasses | ${gender}` });
  assert.deepEqual(c('Kent', 'male'), { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses', name: 'Kent Sunglasses' });
  assert.equal(c('Hazel Black Cateye', 'female').site, 'wgw');
  assert.equal(c('Maddy Black Aviator', 'unisex').site, 'wgw');
  assert.equal(c('Maddy Black Aviator', '').site, 'wgw');
  assert.equal(c("Billy Men's Sunglasses", '').site, 'mgw');
  assert.equal(c('Hazel Black Cateye Sunglasses', 'female').name, 'Hazel Black Cateye Sunglasses', 'no second "Sunglasses"');
  const frame = otra.classify({ name: 'Pia Blue Light Glasses', feedCategory: 'Optical', awinCategory: 'Apparel & Accessories > Clothing Accessories | female' });
  assert.equal(frame.subcategory, 'Accessories');
  assert.ok(frame.doubt);
  assert.equal(c('Otra Hard Case', 'unisex', 'Accessories').subcategory, 'Accessories');
  assert.ok(c('Otra Eyewear Gift Card').reject);
  assert.ok(otra.classify({ name: 'Tote Bag', feedCategory: 'Bags', awinCategory: 'Apparel & Accessories > Handbags | female' }).reject);
  assert.equal(otra.displayName('Otra Eyewear - Hazel'), 'Hazel');
  // Titles of the dry run of 13 Nov 2026.
  const name = raw => otra.classify({ name: raw, feedCategory: 'Health & Beauty > Personal Care > Vision Care > Eyeglasses', awinCategory: 'Health & Beauty > Personal Care > Vision Care > Eyeglasses | ' }).name;
  assert.equal(name('BLUE LIGHT - Rosie'), 'Rosie Blue Light Glasses');
  assert.equal(name('Derby Blue Light'), 'Derby Blue Light Glasses');
  assert.equal(c('Alba - Black - Polarised').name, 'Alba Polarised Sunglasses (Black)');
  assert.equal(c('KENT - BLACK / SMOKE').name, 'Kent Sunglasses (Black / Smoke)');
  assert.equal(c('GQ Travel Case', '', '').name, 'GQ Travel Case');
  assert.ok(c('Shipping Protection by Route', '', '').reject);
  assert.equal(otra.displayBrand('OTRA'), 'Otra Eyewear');
  assert.ok(otra.RULES.shop.test('https://www.otraeyewear.com/products/kent'));
  assert.ok(otra.RULES.shop.test('https://otraeyewear.com/en-gb/products/kent'));
  assert.ok(!otra.RULES.shop.test('https://www.awin1.com/cread.php?x'));
});

test('Otra Eyewear: a whole plan from a Google feed, the colours of one frame on one card, in US dollars', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gw-otra-'));
  const archive = join(root, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(archive);
  const head = 'advertiser_id,advertiser_name,id,title,link,image_link,google_product_category,product_type,gtin,brand,gender,availability,price,sale_price,item_group_id';
  const row = (id, title, handle, gender, avail, price, group) => `96299,Otra Eyewear,${id},"${title}",https://www.otraeyewear.com/products/${handle},https://cdn.shopify.com/x/${handle}.jpg,"Apparel & Accessories > Clothing Accessories > Sunglasses",Sunglasses,,OTRA,${gender},${avail},${price} USD,,${group}`;
  writeFileSync(join(archive, '96299-retail-en_GB.csv'), [head,
    row(1, 'Kent - Black / Smoke', 'kent-black', 'male', 'in_stock', '75.00', 'g1'),
    row(2, 'Kent - Tort / Brown', 'kent-tort', 'male', 'in_stock', '70.00', 'g1'),
    row(3, 'Hazel - Black', 'hazel-black', 'female', 'in_stock', '65.00', 'g2'),
    row(4, 'Maddy - Gold', 'maddy-gold', 'unisex', 'out_of_stock', '60.00', 'g3')].join('\n') + '\n');
  const r = await planLegacyImport({ archive, retailer: 'otra', outDir: join(root, 'plan'), now: new Date('2026-11-13T19:00:00Z') });
  assert.deepEqual(r.accepted.mgw.map(p => [p.product_name, p.price, p.subcategory, p.currency, p.brand]), [['Kent Sunglasses', 70, 'Sunglasses', 'USD', 'Otra Eyewear']]);
  assert.deepEqual(r.accepted.wgw.map(p => [p.product_name, p.price]), [['Hazel Sunglasses (Black)', 65]]);
  assert.equal(r.rejected['out of stock in every size'].length, 1);
  assert.ok(r.text.includes('Hazel Sunglasses (Black) | Otra Eyewear | $65 | Sunglasses | 1 option(s) [feed: Hazel - Black]'), 'the report shows the shop\'s own name');
  assert.equal(otra.commonName(['Kent - Black / Smoke', 'Kent - Tort / Brown']), 'Kent');
  assert.equal(otra.commonName(['BLUE LIGHT - Rosie - Black', 'BLUE LIGHT - Rosie - Tort']), 'BLUE LIGHT - Rosie');
});

import * as sb from '../../tools/import-rules/silverbene.mjs';

test('Silverbene: silver jewellery by the name to WGW (men\'s to MGW), jewellery-making parts and boxes left out', () => {
  const c = name => sb.classify({ name });
  assert.deepEqual(c('Fine 3.70ct 100% Genuine Purple Amethyst Sterling Silver Double Layer Necklace'), { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: 'Necklaces' });
  assert.equal(c('Tenderness 5.0ct Luxury Accessory Natural Red Garnet Sterling Silver Flower Ring').subcategory, 'Rings');
  assert.equal(c('0.8ct Natural Red Garnet Sterling Silver Blooming Flower Black Studs Earrings').subcategory, 'Earrings');
  assert.equal(c('Vintage Black CZ 925 Sterling Silver Adjustable Chain Ring').subcategory, 'Rings');
  assert.equal(c('Simple Elliptical Pyramid 925 Sterling Silver Dangling Earrings').subcategory, 'Earrings');
  assert.equal(c('White/Black Enamel SLR Camera 925 Silver Pendant').subcategory, 'Necklaces');
  assert.equal(c('925 Sterling Silver Box Chain Necklace').subcategory, 'Necklaces');
  assert.equal(c('Wire Wrapped 925 Sterling Silver Ring').subcategory, 'Rings');
  assert.equal(c('Sterling Silver Tennis Bracelet').subcategory, 'Bracelets');
  assert.equal(c('Opal Necklace and Earrings Set Sterling Silver').subcategory, 'Jewellery');
  assert.equal(c('925 Sterling Silver Nose Ring').subcategory, 'Jewellery');
  // MGW files men's rings under Men's Jewellery > Jewellery (no Rings subcategory there, L56, dry run 13 Nov 2026).
  assert.deepEqual(c("Men's 925 Sterling Silver Signet Ring"), { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Jewellery' });
  assert.equal(c('Female Heart 925 Silver Ring').site, 'wgw');
  assert.ok(c('925 Sterling Silver Lobster Clasp Findings').reject);
  assert.ok(c('925 Sterling Silver Jump Rings 50pcs').reject);
  assert.ok(c('Sterling Silver Spacer Beads').reject);
  assert.ok(c('Velvet Jewelry Box').reject);
  assert.equal(sb.displayBrand(''), 'Silverbene');
  assert.ok(sb.RULES.shop.test('https://silverbene.com/sterling-silver-rings/p-123.html'));
});

test('Silverbene: the last kind of jewellery in the name decides (dry run of 13 Nov 2026)', () => {
  const c = name => sb.classify({ name });
  assert.equal(c("Men's Chain 925 Sterling Silver Bracelet").subcategory, 'Bracelets');
  assert.equal(c("Men's Retro Chain 925 Sterling Silver Watch Button Bracelet").subcategory, 'Bracelets');
  assert.equal(c("Retro Elliptical Ring And Circle Ring 925 Solid Sterling Silver Men's Necklace").subcategory, 'Necklaces');
  assert.equal(c('Silver Ear Cuff Climber').subcategory, 'Earrings');
  assert.equal(c('NEW Silver Bead Flower Solid 925 Sterling Silver Promise Ring/Men Couples').subcategory, 'Rings', 'a bead pattern, not a loose bead');
  assert.equal(c('Gift CZ Crown Circle Stars Beads 925 Sterling Silver Bracelet').subcategory, 'Bracelets');
  assert.equal(c('Punk Octopus Crimp 925 Sterling Silver Adjustable Ring').subcategory, 'Rings');
  assert.equal(c('Simple 1.2 Bead Double Lines 925 Sterling Silver Choker Necklace').subcategory, 'Necklaces');
  assert.equal(c('Pink/Yellow Enamel Bowknot Gift Box 925 Silver Studs Earrings').subcategory, 'Earrings');
  assert.equal(c('Cute Dinosaur 925 Sterling Silver DIY Pendant').subcategory, 'Jewellery', 'a charm for a charm bracelet');
  assert.equal(c("Golden Dragon Twining Around Pirate Hook Men's Solid 925 Sterling Sliver Pedant").subcategory, 'Necklaces');
  assert.ok(c('Ring Gauges Finger Sizer Measuring Adjust Tool Set Hong Kong HK Size').reject);
  assert.ok(c('925 Sterling Silver Ring Box').reject);
  assert.ok(c('925 Silver Round Beads 6mm').reject);
  assert.equal(sb.displayName('Fashion n CZ Jumping Double Dolphin 925 Sterling Silver Necklace'), 'Fashion CZ Jumping Double Dolphin 925 Sterling Silver Necklace');
  assert.equal(sb.displayName('Fashion nable Simple Star 925 Sterling Sliver Pedant'), 'Fashionable Simple Star 925 Sterling Silver Pendant');
});

// L129: after the first import of 13 Nov 2026: a bare "Men" is men's (not "Women/Men" or "Ring/Men Couples"), a clasp
// before the kind of jewellery is part of the design, and Otra writes a colour once.
test('L129: Silverbene bare "Men" goes to MGW, "Clasp Bracelet" stays, parts stay out; Otra writes a colour once', () => {
  const c = name => sb.classify({ name });
  assert.equal(c('Vintage Buddhism Devil 925 Sterling Silver Men Pendant').site, 'mgw');
  assert.equal(c('Vintage Personality Carved Thai Silver 925 Sterling Silver Blessing Bracelet Men').site, 'mgw');
  assert.equal(c('Vintage Men Domineering Fist Adjustable Carved 925 Sterling Silver Ring').subcategory, 'Jewellery', 'MGW rings under Jewellery');
  assert.equal(c('White CZ 925 Sterling Silver Studs Earrings Women/Men (5mm)').site, 'wgw');
  assert.equal(c('NEW Fashion Tree Solid 925 Sterling Silver Promise Ring/Men Couples').site, 'wgw');
  assert.equal(c('Elegant 925 Sterling Silver Love Heart White Clasp Bracelet Women').subcategory, 'Bracelets');
  assert.equal(c('Sweet Two Hollow Ring Clasp 925 Silver Adjustable Ring').subcategory, 'Rings');
  assert.ok(c('925 Sterling Silver Lobster Clasp Findings').reject);
  assert.ok(c('925 Sterling Silver Toggle Clasp for Bracelet').reject);
  assert.ok(c('Sterling Silver Clasp').reject);
  assert.equal(otra.cardName('Alba - Black - Black', 'sunglasses'), 'Alba Sunglasses (Black)');
  assert.equal(otra.cardName('Deja - Silver/ Rose', 'sunglasses'), 'Deja Sunglasses (Silver/ Rose)');
});
