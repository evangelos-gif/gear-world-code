import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { peekFeeds } from '../../tools/gw-feed-peek.mjs';

test('feed peek: reports products, empty feeds and missing feeds, and changes nothing', async () => {
  const arch = mkdtempSync(join(tmpdir(), 'gw-peek-arch-'));
  const out = mkdtempSync(join(tmpdir(), 'gw-peek-out-'));
  const csv = 'aw_deep_link,product_name,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock\n' +
    'https://www.awin1.com/pclick.php?p=1,Kids Hoodie Blue,K1,https://img.example/1.jpg,Kids > Hoodies,19.99,GBP,Brand A,1\n' +
    'https://www.awin1.com/pclick.php?p=2,"Toddler Shoes, Red",K2,http://img.example/2.jpg,Kids > Shoes,24.50,GBP,Brand B,0\n';
  writeFileSync(join(arch, 'AWIN_83599_94107.csv.gz'), gzipSync(Buffer.from(csv)));
  writeFileSync(join(arch, 'AWIN_91665_108768.csv.gz'), gzipSync(Buffer.from('aw_deep_link,product_name,search_price\n')));
  const hash = () => readdirSync(arch).sort().map(f => f + createHash('sha256').update(readFileSync(join(arch, f))).digest('hex')).join(';');
  const before = hash();
  const { report, summary } = await peekFeeds({ archive: arch, ids: ['83599', '91665', '48473'], outDir: out });
  assert.ok(report.includes('Products (rows): 2'));
  assert.ok(report.includes('Price range: 19.99 to 24.50'));
  assert.ok(report.includes('Stock: in 1, out 1'));
  assert.ok(report.includes('No https image: 1'));
  assert.ok(report.includes('Toddler Shoes, Red | 24.50'));
  assert.deepEqual(summary, [
    'AWIN_83599_94107.csv.gz: 2 products, 2 categories',
    'AWIN_91665_108768.csv.gz: header only, 0 products',
    '48473: no feed file'
  ]);
  assert.equal(readdirSync(out).join(','), 'report.txt');
  assert.equal(hash(), before, 'archive unchanged');
});
