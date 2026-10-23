// Awin feed sample for one retailer (read-only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { sampleFeed, renderSample, sampleMany } from '../../tools/awin-feed-sample.mjs';

test('reads only the asked retailer, counts categories and values, keeps samples', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sample-'));
  const head = 'aw_product_id,product_name,brand_name,search_price,currency,in_stock,merchant_category,fashion_suitable_for\n';
  writeFileSync(join(dir, 'AWIN_30645_1.csv.gz'), gzipSync(head
    + '1,"Barbour Wax Jacket",Barbour,199,,1,Menswear > Jackets,Male\n'
    + '2,"Joules Dress",Joules,59,,1,Womenswear > Dresses,Female\n'
    + '3,"Barbour Gilet",Barbour,89,,1,Menswear > Jackets,Male\n'));
  writeFileSync(join(dir, 'AWIN_496_2.csv.gz'), gzipSync(head + '1,"Drill",Makita,99,GBP,1,Tools,\n'));
  const s = await sampleFeed({ archive: dir, advertiserId: '30645' });
  assert.deepEqual(s.files, ['AWIN_30645_1.csv.gz']);
  assert.equal(s.rows, 3);
  assert.equal(s.cats['Menswear > Jackets'], 2);
  assert.equal(s.values.currency['(empty)'], 3);
  assert.equal(s.values.fashion_suitable_for.Male, 2);
  assert.ok(s.samples.length >= 3);
  const text = renderSample(s, '30645');
  assert.match(text, /2 {2}Menswear > Jackets/);
  assert.match(text, /brand_name: Barbour/);
  assert.doesNotMatch(text, /Makita/);
});

test('one product per category path, brand counts, and several retailers in one report', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sample-many-'));
  const head = 'aw_product_id,product_name,brand_name,search_price,currency,in_stock,merchant_category\n';
  writeFileSync(join(dir, 'AWIN_69306_89999.csv.gz'), gzipSync(head
    + '1,"Proraso Beard Balm 100 ml",Proraso,9.79,GBP,1,Personal Care\n'
    + '2,"Nivea Men Deodorant 150 ml",Nivea,3.89,GBP,1,Fragrances\n'
    + '3,"Proraso Shaving Cream",Proraso,5.99,GBP,1,Personal Care\n'));
  writeFileSync(join(dir, 'AWIN_116097_102169.csv.gz'), gzipSync(head + '1,"Scrub Mummy Twin Pack",Scrub Daddy,4.99,GBP,1,Cleaning products\n'));
  const s = await sampleFeed({ archive: dir, advertiserId: '69306' });
  assert.equal(s.examples['Personal Care'], 'Proraso Beard Balm 100 ml');
  assert.equal(s.brands.Proraso, 2);
  const text = renderSample(s, '69306');
  assert.match(text, /2 {2}Personal Care {2}e\.g\. Proraso Beard Balm 100 ml/);
  assert.match(text, /== BRANDS \(2, biggest first, up to 60\) ==\n {2}Proraso \(2\) \| Nivea \(1\)/);
  const both = await sampleMany({ archive: dir, advertiserIds: ['69306', '116097'] });
  assert.match(both, /^##### ADVERTISER 69306\n/);
  assert.match(both, /##### ADVERTISER 116097\nAWIN FEED SAMPLE \(read-only\) advertiser 116097/);
  assert.match(both, /Cleaning products {2}e\.g\. Scrub Mummy Twin Pack/);
  // One retailer: the same report as before (no section header).
  assert.doesNotMatch(await sampleMany({ archive: dir, advertiserIds: ['69306'] }), /#####/);
});
