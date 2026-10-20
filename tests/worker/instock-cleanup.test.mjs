// InStock clean-up rules (MGW/WGW): one card per product, no smartwatch straps in Watches, no political merchandise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { summarySql, samplesSql, idsSql, keptSql, updateSql } from '../../tools/cleanup-rules/instock.mjs';

const link = (handle, v) => `https://www.awin1.com/cread.php?awinmid=122444&awinaffid=3057233&ued=https%3A%2F%2Finstock.net%2Fproducts%2F${handle}%3Fvariant%3D${v}`;

function db() {
  const d = new DatabaseSync(':memory:');
  d.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, retailer TEXT, site_category TEXT, product_name TEXT, price REAL, affiliate_url TEXT,
    is_active INTEGER DEFAULT 1, updated_at TEXT)`);
  const add = d.prepare('INSERT INTO products (id, retailer, site_category, product_name, price, affiliate_url) VALUES (?, ?, ?, ?, ?, ?)');
  add.run(1, 'InStock UK', 'Clothing', 'Thermal Top - Black / S', 12, link('thermal-top', 1));
  add.run(2, 'InStock UK', 'Clothing', 'Thermal Top - Black / M', 10, link('thermal-top', 2));
  add.run(3, 'InStock UK', 'Clothing', 'Thermal Top - Navy / L', 12, link('thermal-top', 3));
  add.run(4, 'InStock UK', 'Clothing', 'Restore Britain Unisex Hoodie - UK Politics - Navy / S', 30, link('restore-hoodie', 4));
  add.run(5, 'InStock UK', 'Clothing', 'Restore Britain Unisex Hoodie - UK Politics - Navy / M', 30, link('restore-hoodie', 5));
  add.run(6, 'InStock UK', 'Watches', 'xDfind Silicone Watch Band, For Garmin Venu 2S - Black', 8, link('xdfind-band', 6));
  add.run(7, 'InStock UK', 'Watches', 'IMAK Plexiglass HD Watch Protective Film, For Fitbit Luxe', 5, link('imak-film', 7));
  add.run(8, 'InStock UK', 'Watches', 'RENATA SP 319 Watch Battery (1PC)', 2, link('renata-319', 8));
  add.run(9, 'InStock UK', 'Watches', 'Ravel Mens Classic Black Leather Strap Watch R0105.32.1A', 14.97, link('ravel-r0105', 9));
  add.run(10, 'InStock UK', 'Watches', '1.43 inch Leather Strap Bluetooth Call Smart Watch - Black', 25, link('smart-watch-143', 10));
  add.run(11, 'Coes', 'Clothing', 'Barbour Beaufort Wax Jacket', 289, 'https://www.awin1.com/cread.php?awinmid=30645&awinaffid=3057233&ued=https%3A%2F%2Fwww.coes.co.uk%2Fproducts%2Fbeaufort');
  add.run(12, 'Watch Enclave', 'Watches', 'Seiko Watch Strap Leather 20mm', 30, 'https://www.awin1.com/x');
  add.run(13, 'InStock UK', 'Clothing', 'Thermal Top - Red / S', 9, link('thermal-top', 13));
  d.prepare('UPDATE products SET is_active = 0 WHERE id = 13').run();
  return d;
}

test('hides sizes/colours, smartwatch parts and political items; keeps real watches and other retailers', () => {
  const d = db();
  const ids = d.prepare(idsSql()).all().map(r => r.id);
  // 1 kept (cheapest, id 2); 4 and 5 political; 6, 7, 8 smartwatch parts. 13 was already hidden.
  assert.deepEqual(ids, [1, 3, 4, 5, 6, 7, 8]);
  const sum = d.prepare(summarySql()).all();
  const by = Object.fromEntries(sum.map(r => [r.reason + '|' + r.site_category, r.n]));
  assert.equal(by['political merchandise|Clothing'], 2);
  assert.equal(by['smartwatch strap, film or spare part|Watches'], 3);
  assert.equal(by['same product, other size or colour|Clothing'], 2);
  assert.ok(d.prepare(samplesSql()).all().length >= 3);
  const kept = Object.fromEntries(d.prepare(keptSql()).all().map(r => [r.site_category, r.n]));
  assert.deepEqual(kept, { Watches: 3, Clothing: 2 });
});

test('the hide and rollback SQL work by id and undo each other', () => {
  const d = db();
  const ids = d.prepare(idsSql()).all().map(r => r.id);
  d.exec(updateSql(ids, false));
  assert.equal(d.prepare(idsSql()).all().length, 0, 'nothing left to hide');
  assert.equal(d.prepare('SELECT COUNT(*) n FROM products WHERE is_active = 1').get().n, 5);
  d.exec(updateSql(ids, true));
  assert.equal(d.prepare('SELECT COUNT(*) n FROM products WHERE is_active = 1').get().n, 12, 'rollback shows them again; the one hidden before stays hidden');
});

test('the SQL can go on a Windows cmd line (no % < > & | ^ or double quotes) and is read-only', () => {
  for (const sql of [summarySql(), samplesSql(), idsSql(), keptSql()]) {
    assert.doesNotMatch(sql, /[%<>&|^"]/);
    assert.doesNotMatch(sql, /\b(UPDATE|INSERT|DELETE|DROP)\b/i);
    assert.ok(sql.replace(/\s+/g, ' ').length < 6000, 'fits a cmd line');
  }
  assert.ok(updateSql(Array.from({ length: 1201 }, (_, i) => i + 1), false).split('\n').filter(Boolean).length === 3, '500 ids per statement');
});
