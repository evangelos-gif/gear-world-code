// Repair of names broken by the tidy step (UTF-8 read as code page 850): back to the feed name without size/colour,
// only when every readable character is the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { rowsSql, fixedName, plan } from '../../tools/cleanup-rules/fixnames.mjs';

const ROWS = [
  { id: 1, retailer: 'InStock UK', product_name: 'Acme KIDSÔÇÖ Helmet', feed_product_name: 'Acme KIDS’ Helmet - Matt Grey / XS ( 46-50cm)' },
  { id: 2, retailer: 'InStock UK', product_name: 'Acme Kids Shirt ÔÇô Coming 2026 T-Shirt', feed_product_name: 'Acme Kids Shirt – Coming 2026 T-Shirt - White / XS' },
  { id: 3, retailer: 'InStock UK', product_name: 'Acme Banz┬« Sunglasses - Toddler 2', feed_product_name: 'Acme Banz® Sunglasses - Toddler 2 - 4 Years / Green / Poly' },
  // Already broken in the feed ("â€“"), then broken again by the tidy step: back to the feed's own text.
  { id: 4, retailer: 'InStock UK', product_name: 'Acme Pyjama Set ├óÔé¼ÔÇ£ Pale Purple', feed_product_name: 'Acme Pyjama Set â€“ Pale Purple - Pale Purple / S' },
  { id: 5, retailer: 'Finediam', product_name: 'Acme Ring ├óÔé¼ÔÇ£ Pav├â┬® Design', feed_product_name: 'Acme Ring â€“ PavÃ© Design - 9k Gold / 0.50 Carat / Lab' },
  // Not safe: the readable text is different, so it is listed and left.
  { id: 6, retailer: 'InStock UK', product_name: 'Acme Other ÔÇô Name', feed_product_name: 'Acme Different – Name - Red / S' },
  // Not broken: never touched.
  { id: 7, retailer: 'InStock UK', product_name: 'Acme Kids’ Socks', feed_product_name: 'Acme Kids’ Socks - Red / S' }
];

test('broken names go back to the feed name without size/colour; unsafe ones are left', () => {
  const p = plan(ROWS);
  assert.deepEqual(p.rename.map(r => [r.id, r.to]), [
    [1, 'Acme KIDS’ Helmet'],
    [2, 'Acme Kids Shirt – Coming 2026 T-Shirt'],
    [3, 'Acme Banz® Sunglasses - Toddler 2'],
    [4, 'Acme Pyjama Set â€“ Pale Purple'],
    [5, 'Acme Ring â€“ PavÃ© Design']
  ]);
  assert.deepEqual(p.skip.map(s => s.id), [6]);
  assert.equal(p.hide.length, 0);
  assert.equal(fixedName({ retailer: 'Joybuy UK', product_name: 'Acme Tee ÔÇô Red', feed_product_name: 'Acme Tee – Red' }), 'Acme Tee – Red');
});

test('the query finds the broken names, is ASCII and read-only', () => {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, retailer TEXT, product_name TEXT, feed_product_name TEXT)');
  const add = d.prepare('INSERT INTO products VALUES (?, ?, ?, ?)');
  for (const r of ROWS) add.run(r.id, r.retailer, r.product_name, r.feed_product_name);
  assert.deepEqual(d.prepare(rowsSql()).all().map(r => r.id), [1, 2, 3, 4, 5, 6]);
  assert.doesNotMatch(rowsSql(), /[^\x20-\x7e]|[%<>&|^"]/);
  assert.doesNotMatch(rowsSql(), /\b(UPDATE|INSERT|DELETE|DROP)\b/i);
});
