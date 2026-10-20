// Home Gear World clean-up: shops that do not sell home goods are hidden on HGW only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { summarySql, idsSql, keptSql, samplesSql } from '../../tools/cleanup-rules/home-misfits.mjs';
import * as instock from '../../tools/cleanup-rules/instock.mjs';
import { rowsSql, plan } from '../../tools/cleanup-rules/tidy.mjs';

function db() {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, retailer TEXT, site_category TEXT, product_name TEXT, price REAL, affiliate_url TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT)');
  const add = d.prepare('INSERT INTO products (id, retailer, site_category, product_name, price, affiliate_url) VALUES (?, ?, ?, ?, ?, ?)');
  const link = (h, v) => `https://www.awin1.com/cread.php?awinmid=122444&awinaffid=3057233&ued=https%3A%2F%2Finstock.net%2Fproducts%2F${h}%3Fvariant%3D${v}`;
  add.run(1, 'Finediam', 'Home Decor', "Slim Men's Gold Band Mirror Finish - 9k Yellow Gold / 5mm", 747, 'x');
  add.run(2, 'AKKO UK', 'Home Decor', 'Mineral 01 VIA Custom Mechanical Keyboard - US-ANSI / Akko Mirror Switch', 149.99, 'x');
  add.run(3, 'InStock UK', 'Home Decor', 'Round Wall Mirror - 60cm / Gold', 40, link('round-mirror', 1));
  add.run(4, 'InStock UK', 'Home Decor', 'Round Wall Mirror - 80cm / Gold', 55, link('round-mirror', 2));
  add.run(5, 'Joybuy UK', 'Home Appliances', 'Digital Air Fryer 5L', 49, 'x');
  return d;
}

test('rings and keyboards hidden on HGW, home products stay', () => {
  const d = db();
  assert.deepEqual(d.prepare(idsSql()).all().map(r => r.id), [1, 2]);
  assert.equal(d.prepare(summarySql()).all()[0].n, 2);
  assert.ok(d.prepare(samplesSql()).all().length === 2);
  assert.deepEqual(Object.fromEntries(d.prepare(keptSql()).all().map(r => [r.site_category, r.n])), { 'Home Decor': 2, 'Home Appliances': 1 });
  for (const s of [summarySql(), samplesSql(), idsSql(), keptSql()]) assert.doesNotMatch(s, /[%<>&|^"]/);
});

test('on HGW the InStock rules keep one card per product, and tidy cleans its name; no product is "other site"', () => {
  const d = db();
  assert.deepEqual(d.prepare(instock.idsSql()).all().map(r => r.id), [4]);
  d.exec(instock.updateSql([4], false));
  assert.equal(d.prepare(rowsSql('hgw', 'gender')).all().length, 0);
  const p = plan('hgw', d.prepare(rowsSql('hgw', 'names')).all(), []);
  assert.deepEqual(p.rename.map(r => [r.id, r.to]), [[1, "Slim Men's Gold Band Mirror Finish"], [3, 'Round Wall Mirror']]);
});
