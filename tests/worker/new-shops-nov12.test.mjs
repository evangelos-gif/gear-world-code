// New Awin shops of 12 Nov 2026 (owner: "all the feeds, whatever the country"; lessons L116). Names are from the
// awin-feed-sample report of House of Sneakers (11 Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as hos from '../../tools/import-rules/houseofsneakers.mjs';

test('House of Sneakers: women to WGW, children to KGW, men and unisex to MGW, all Shoes; only the pound feed is read', () => {
  const page = h => `https://house-of-sneakers.de/products/${h}?variant=1`;
  const c = (name, h) => hos.classify({ name, url: page(h) });
  assert.deepEqual(c('Air Jordan 1 Low SE Light Smoke Grey Gym Red', 'air-jordan-1-low-se-light-smoke-grey-gym-red'), { site: 'mgw', siteCategory: 'Shoes', subcategory: 'Trainers' });
  assert.equal(c('Nike Shox TL Pink Foam', 'nike-shox-tlpink-foam-womens').site, 'wgw');
  assert.equal(c("Air Max 1 '87 Denim Aura", 'nike-air-max-1-87-denim-aura-damen').site, 'wgw');
  assert.equal(c('Air Jordan 1 Mid Patent Black White Gold (GS)', 'jordan-1-midpatent-black-white-gold-gs').site, 'kgw');
  assert.equal(c('Yeezy Foam RNNR MX Brown Blue', 'adidas-yeezy-foam-runner-mx-cinder').subcategory, 'Trainers');
  assert.equal(c('Birkenstock Arizona Big Buckle Sandal', 'birkenstock-arizona').subcategory, 'Sandals');
  assert.equal(c('Timberland 6 Inch Premium Boot Wheat', 'timberland-6-inch').subcategory, 'Boots');
  assert.equal(c('Adidas  Campus 00er Surf Green', 'adidas-campus-00er-surf-green').site, 'mgw');
  assert.ok(c('House of Sneakers Gift Card', 'gift-card').reject);
  assert.equal(hos.displayName('Adidas  Campus 00er Surf Green'), 'Adidas Campus 00er Surf Green');
  assert.equal(hos.displayBrand('Adidas'), 'adidas');
  assert.ok(hos.RULES.shop.test('https://house-of-sneakers.de/products/x'));
  assert.ok(!hos.RULES.shop.test('https://www.awin1.com/cread.php?x'));
  const dir = mkdtempSync(join(tmpdir(), 'gw-hos-'));
  for (const id of [116528, 118232, 118233]) writeFileSync(join(dir, `AWIN_114336_${id}.csv.gz`), '');
  assert.deepEqual(hos.feedFiles(dir), [join(dir, 'AWIN_114336_118232.csv.gz')], 'the pound feed only');
});
