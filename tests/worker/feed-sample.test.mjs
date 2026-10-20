// Awin feed sample for one retailer (read-only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { sampleFeed, renderSample } from '../../tools/awin-feed-sample.mjs';

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
