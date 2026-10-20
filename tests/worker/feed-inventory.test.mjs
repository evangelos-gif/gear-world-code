// Awin feed inventory (read-only report over the feed archive).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { inventory, renderReport, suggestSites } from '../../tools/awin-feed-inventory.mjs';

test('counts products per retailer, marks retailers already used, suggests a site, survives a broken file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'feeds-'));
  const head = 'aw_product_id,product_name,merchant_name,search_price,currency,in_stock,ean,merchant_category\n';
  writeFileSync(join(dir, 'AWIN_900001_1.csv.gz'), gzipSync(head + '1,"Lawn Mower 37cm",Garden Shop,99,GBP,1,5012345678900,Garden > Lawn\n2,"Garden Hose",Garden Shop,19,GBP,0,,Garden > Watering\n'));
  writeFileSync(join(dir, 'AWIN_123932_114093.csv.gz'), gzipSync(head + '1,"USB-C Charger 65W",Joybuy UK,19,GBP,1,5012345678900,Electronics > Chargers\n'));
  writeFileSync(join(dir, 'AWIN_900002_2.csv.gz'), 'not gzip');
  writeFileSync(join(dir, 'notes.txt'), 'ignored');
  const feeds = await inventory({ archive: dir });
  assert.equal(feeds.length, 3);
  const garden = feeds.find(f => f.advertiserId === 900001);
  assert.equal(garden.rows, 2);
  assert.equal(garden.inStock, 1);
  assert.equal(garden.withGtin, 1);
  assert.equal(garden.merchant, 'Garden Shop');
  assert.ok(feeds.find(f => f.advertiserId === 900002).error, 'broken file reported, not fatal');
  const { text, advs } = renderReport(feeds, { archive: dir });
  assert.match(text, /NOT USED YET/);
  assert.match(text, /900001\s+Garden Shop/);
  assert.match(text, /123932 .*on TGW/);
  assert.equal(advs.find(a => a.advertiserId === 900001).suggest[0].site, 'GGW');
});

test('site suggestion by category words', () => {
  assert.equal(suggestSites({ 'Toys > Kids games': 10 })[0].site, 'KGW');
  assert.equal(suggestSites({ 'Electronics > Laptops': 5, 'Home > Kitchen': 1 })[0].site, 'TGW');
  assert.deepEqual(suggestSites({ 'Misc': 3 }), []);
});
