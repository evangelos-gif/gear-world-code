// Repair of names broken by the tidy step (UTF-8 read as code page 850): back to the feed name without size/colour,
// only when every readable character is the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { rowsSql, fixedName, plan, demojibake, sqlFiles } from '../../tools/cleanup-rules/fixnames.mjs';

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
    // 16 Nov 2026 (L167): the feed's own double UTF-8 is read again too.
    [4, 'Acme Pyjama Set – Pale Purple'],
    [5, 'Acme Ring – Pavé Design']
  ]);
  assert.deepEqual(p.skip.map(s => s.id), [6]);
  assert.equal(p.hide.length, 0);
  assert.equal(fixedName({ retailer: 'Joybuy UK', product_name: 'Acme Tee ÔÇô Red', feed_product_name: 'Acme Tee – Red' }), 'Acme Tee – Red');
});

test('L167 (chat 9, 16 Nov 2026): double UTF-8 from the feed (Reidl on CGW) is read again letter by letter; real Â/â/Ã are never touched', () => {
  const rows = [
    { id: 11, retailer: 'Reidl', product_name: 'ABUS SchlÃ¼sselkasten 787 GrÃ¶ÃŸe M', feed_product_name: 'ABUS SchlÃ¼sselkasten 787 GrÃ¶ÃŸe M' },
    { id: 12, retailer: 'Reidl', product_name: 'Wiha Bitsatz Â® 32-tlg. â€“ Tradeâ„¢', feed_product_name: '' },
    { id: 13, retailer: 'Joybuy UK', product_name: 'SÃO PAULO Tee', feed_product_name: 'SÃO PAULO Tee' },
    { id: 14, retailer: 'Joybuy UK', product_name: 'Moule à pâte crêpes', feed_product_name: 'Moule à pâte crêpes' }
  ];
  const p = plan(rows);
  assert.deepEqual(p.rename.map(r => [r.id, r.to]), [[11, 'ABUS Schlüsselkasten 787 Größe M'], [12, 'Wiha Bitsatz ® 32-tlg. – Trade™']]);
  assert.deepEqual(p.skip.map(s => s.id), [], 'a name with nothing to read again is not listed at all');
  assert.equal(demojibake('SÃO PAULO'), '', 'Ã then a plain letter is real text');
  assert.equal(demojibake('pâte'), '');
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

test('the rename keeps the date of the last price check: a product that left its feed never shows again by a name fix (Manager, 16 Nov 2026)', () => {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, retailer TEXT, product_name TEXT, feed_product_name TEXT, updated_at TEXT)');
  d.prepare('INSERT INTO products VALUES (?, ?, ?, ?, ?)').run(21, 'Reidl', "ABUS SchlÃ¼ssel 'Pro'", '', '2000-01-01 00:00:00');
  const p = plan(d.prepare('SELECT * FROM products').all());
  const f = sqlFiles(p);
  assert.doesNotMatch(f.change + f.rollback, /updated_at|datetime/);
  d.exec(f.change);
  assert.deepEqual({ ...d.prepare('SELECT product_name, updated_at FROM products WHERE id = 21').get() }, { product_name: "ABUS Schlüssel 'Pro'", updated_at: '2000-01-01 00:00:00' });
  d.exec(f.rollback);
  assert.equal(d.prepare('SELECT product_name FROM products WHERE id = 21').get().product_name, "ABUS SchlÃ¼ssel 'Pro'");
});
