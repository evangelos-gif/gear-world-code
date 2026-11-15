// Massive import round 3 (15 Nov 2026, lessons L145, L147): the first Daisycon shops, Invicta Stores on MGW and HOME-TEX
// on HGW. Their files carry the shop page only as a path in the link (dl=...); the rules put it together.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import * as invicta from '../../tools/import-rules/invicta-eu.mjs';
import * as hometex from '../../tools/import-rules/hometex-int.mjs';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import { DC_COLUMNS } from '../../tools/daisycon-feed.mjs';
import { csvLine } from '../../tools/network-links.mjs';

const link = (si, dl) => `https://bdt9.net/c/?si=${si}&li=1&wi=447289&pid=abc&dl=${encodeURIComponent(dl)}&ws=`;
const col = row => c => String(row[c] ?? '');

test('L147 Invicta Stores: men\'s and unisex watches on MGW, the page from the link path, accessories and women\'s out', () => {
  const row = { aw_deep_link: link(18836, 'collections/bolt/invicta-bolt-46037-mens-quartz-watch-50mm/'), dc_gender: 'male', merchant_deep_link: '' };
  assert.equal(invicta.field('merchant_deep_link', col(row)), 'https://www.invictastores.eu/collections/bolt/invicta-bolt-46037-mens-quartz-watch-50mm/');
  assert.ok(invicta.RULES.shop.test(invicta.field('merchant_deep_link', col(row))));
  assert.equal(invicta.field('category_name', col(row)), 'male', 'Daisycon gender_target reaches the rules');
  assert.equal(invicta.RULES.network, 'daisycon');
  assert.equal(invicta.displayName("Invicta Bolt 46037 Men's Watch - Quartz Movement - Stainless Steel with Black Dial - 50 mm"), 'Invicta Bolt 46037 Watch, Quartz, Black Dial, 50 mm');
  assert.equal(invicta.displayName("Invicta Pro Diver - SCUBA 22227 Men's Watch - Quartz Movement - Stainless Steel with Gold Dial - 50 mm"), 'Invicta Pro Diver SCUBA 22227 Watch, Quartz, Gold Dial, 50 mm');
  const c = (name, g) => invicta.classify({ name, awinCategory: g });
  assert.deepEqual(c("Invicta Pro Diver - SCUBA 22227 Men's Watch - Quartz Movement - Stainless Steel with Gold Dial - 50 mm", 'male'), { site: 'mgw', siteCategory: 'Watches', subcategory: "Men's Watches" });
  assert.deepEqual(c('Invicta Specialty 49959 Unisex Watch - Quartz Movement - Stainless Steel with Black Dial -', 'unisex'), { site: 'mgw', siteCategory: 'Watches', subcategory: 'Unisex Watches' });
  assert.match(c("Invicta Angel 24667 Women's Watch - Quartz Movement - Stainless Steel with Silver Dial - 40 mm", 'female').reject, /^women's watch/);
  for (const n of ['Invicta Watch Box IPM547X-SIL', 'Invicta Watch Box Yellow - 3 Slot DC3YEL', 'Invicta Pro Diver Wall Clock 70040', 'Invicta Sunglasses IEW053-01', 'Invicta Racing Aluminum Bottle', 'Invicta Travelcase Grey']) {
    assert.equal(c(n, '').reject, 'not a watch (accessory)', n);
  }
});

test('L147 HOME-TEX: one card per size page, the "-master" pages out, sorted by the first part of the name', () => {
  const row = { aw_deep_link: link(21120, 'shop/silk-bedding-100%25-20966p.html'), merchant_product_id: '2111-master' };
  assert.equal(hometex.field('merchant_deep_link', col(row)), 'https://www.home-tex.com/shop/silk-bedding-100%25-20966p.html');
  assert.ok(hometex.RULES.shop.test(hometex.field('merchant_deep_link', col(row))));
  assert.equal(hometex.field('category_name', col(row)), 'master');
  assert.equal(hometex.field('category_name', col({ ...row, merchant_product_id: '2111-2' })), '');
  const c = (name, cat = '') => hometex.classify({ name, awinCategory: cat });
  assert.match(c('Silk bedding - 100% mulberry silk - Dusty blue', 'master').reject, /-master/);
  assert.deepEqual(c('Silk bedding 140x220 cm - 100% mulberry silk - Dusty blue'), { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bed Linen' });
  assert.equal(c('Bamboo towel - Bamboo/cotton - Bath sheet 100x150 cm - Olive green').subcategory, 'Towel', 'not a bed sheet');
  assert.equal(c("Gabby's Dollhouse Towel - 70x140 cm - 100% Cotton - Soft Bath Towel with Gabby, Pandy Paws, Pillow Cat").subcategory, 'Towel', 'not a pillow');
  assert.equal(c('Silk sheet - Topper fitted sheet 140x200x8 cm - Dusty blue -').subcategory, 'Bed Sheet');
  assert.equal(c('Duvet and pillow set - All-season duvet 200x220 cm + 2 pillows 60x63 cm').subcategory, 'Duvet');
  assert.deepEqual(c('Tablecloth - 140x320 cm - Jacquard tablecloth'), { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: 'Table Linen' });
  assert.match(c('Suitcase - Hard-shell suitcase - Size Medium - Gold shell').reject, /suitcase/);
  assert.match(c('Minecraft water bottle - Water bottle with flip function and straw').reject, /does not tell/);
  assert.equal(hometex.displayName('Silk sheet - Topper fitted sheet 140x200x8 cm - Dusty blue -'), 'Silk sheet - Topper fitted sheet 140x200x8 cm - Dusty blue', 'the size stays, the dangling dash goes');
});

test('L145 a Daisycon file through the import plan: the shop page made from the link, the Daisycon link kept as the paid link', async () => {
  const archive = mkdtempSync(join(tmpdir(), 'gw-r3-'));
  const rows = [
    { aw_product_id: 'u1', merchant_name: 'Invicta Watch Europe', product_name: "Invicta Bolt 46037 Men's Watch - Quartz Movement - Stainless Steel with Black Dial - 50 mm", brand_name: 'Invicta',
      aw_deep_link: link(18836, 'collections/bolt/invicta-bolt-46037-mens-quartz-watch-50mm/'), merchant_image_url: 'https://www.invictastores.eu/a.jpg', search_price: '149', currency: 'EUR', in_stock: '1', dc_gender: 'male' },
    { aw_product_id: 'u2', merchant_name: 'Invicta Watch Europe', product_name: 'Invicta Watch Box IPM547X-SIL', brand_name: 'Invicta',
      aw_deep_link: link(18836, 'collections/accessories/invicta-watch-box-ipm547x-sil/'), merchant_image_url: 'https://www.invictastores.eu/b.jpg', search_price: '49', currency: 'EUR', in_stock: '1', dc_gender: '' }
  ];
  writeFileSync(join(archive, 'DAISYCON_18836.csv.gz'), gzipSync(csvLine(DC_COLUMNS) + rows.map(r => csvLine(DC_COLUMNS.map(c => r[c]))).join('')));
  const out = mkdtempSync(join(tmpdir(), 'gw-r3-out-'));
  const r = await planLegacyImport({ archive, retailer: 'invicta-eu', outDir: out, now: new Date('2026-11-15T10:00:00Z') });
  const items = r.accepted.mgw;
  assert.equal(items.length, 1, 'the watch, not the box');
  assert.equal(items[0].affiliate_url, rows[0].aw_deep_link);
  assert.equal(items[0].retailer, 'Invicta Stores');
  assert.equal(items[0].product_name, 'Invicta Bolt 46037 Watch, Quartz, Black Dial, 50 mm');
});
