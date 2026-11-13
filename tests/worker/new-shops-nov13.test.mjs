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
  assert.equal(otra.displayName('KENT - BLACK / SMOKE'), 'Kent');
  assert.equal(otra.displayName('Otra Eyewear - Hazel'), 'Hazel');
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
  assert.deepEqual(r.accepted.wgw.map(p => [p.product_name, p.price]), [['Hazel Sunglasses', 65]]);
  assert.equal(r.rejected['out of stock in every size'].length, 1);
});
