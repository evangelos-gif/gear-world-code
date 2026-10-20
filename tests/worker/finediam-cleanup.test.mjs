// Finediam clean-up (MGW): one card per ring design instead of one per metal and width.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { summarySql, samplesSql, idsSql, keptSql } from '../../tools/cleanup-rules/finediam.mjs';
import { plan, rowsSql } from '../../tools/cleanup-rules/tidy.mjs';

function db() {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, retailer TEXT, site_category TEXT, product_name TEXT, price REAL, is_active INTEGER DEFAULT 1, updated_at TEXT)');
  const add = d.prepare('INSERT INTO products (id, retailer, site_category, product_name, price) VALUES (?, ?, ?, ?, ?)');
  add.run(1, 'Finediam', "Men's Jewellery", "5mm-8mm Standard Weight Men's Gold Band - 18k Yellow Gold / 5mm", 1757);
  add.run(2, 'Finediam', "Men's Jewellery", "5mm-8mm Standard Weight Men's Gold Band - 9k Yellow Gold / 5mm", 747);
  add.run(3, 'Finediam', "Men's Jewellery", "5mm-8mm Standard Weight Men's Gold Band - 9k Rose Gold / 8mm", 1369);
  add.run(4, 'Finediam', "Men's Jewellery", "Bold Men's 5mm-8mm Carved Gold Band Smooth - 9k White Gold / 8mm", 1369);
  add.run(5, 'Finediam', 'Watches', 'Finediam Watch', 156);
  add.run(6, 'Stattics', "Men's Jewellery", "5mm-8mm Standard Weight Men's Gold Band - Silver / 5mm", 50);
  return d;
}

test('one card per design (the cheapest), other retailers untouched', () => {
  const d = db();
  assert.deepEqual(d.prepare(idsSql()).all().map(r => r.id), [1, 3]);
  assert.equal(d.prepare(summarySql()).all()[0].n, 2);
  assert.ok(d.prepare(samplesSql()).all().length === 2);
  assert.deepEqual(Object.fromEntries(d.prepare(keptSql()).all().map(r => [r.site_category, r.n])), { "Men's Jewellery": 3, Watches: 1 });
  for (const s of [summarySql(), samplesSql(), idsSql(), keptSql()]) assert.doesNotMatch(s, /[%<>&|^"]/);
});

test('the tidy step then drops the metal/width from the kept Finediam names', () => {
  const d = db();
  d.exec('UPDATE products SET is_active = 0 WHERE id IN (1, 3)');
  const p = plan('mgw', d.prepare(rowsSql('mgw', 'names')).all(), []);
  assert.deepEqual(p.rename.map(r => [r.id, r.to]), [[2, "5mm-8mm Standard Weight Men's Gold Band"], [4, "Bold Men's 5mm-8mm Carved Gold Band Smooth"]]);
});
