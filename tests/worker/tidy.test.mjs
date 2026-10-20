// Tidy-up rules for MGW / WGW: InStock names without the size/colour, products of the other site hidden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { genderOf, tidyName, rowsSql, plan, sqlFiles, rowsFromWrangler } from '../../tools/cleanup-rules/tidy.mjs';

test('gender words: one side only, both sides stay', () => {
  assert.equal(genderOf("Emporio Armani Mia AR11597 Women’s Watch – 32mm"), 'W');
  assert.equal(genderOf('Fairtrade Organic Ladies T-shirt'), 'W');
  assert.equal(genderOf('SKMEI 1888 Multifunctional Men 30M Waterproof'), 'M');
  assert.equal(genderOf('Mens & Ladies London Design Socks'), 'both');
  assert.equal(genderOf('FNGEEN 5808 Women Fashion Couple Watch'), 'both');
  assert.equal(genderOf('Unisex Hoodie for Women'), 'both');
  assert.equal(genderOf('Spider-Man T-Shirt'), '');
  assert.equal(genderOf('Womenswear Gilet'), '');
});

test('names lose the size/colour of the kept card, other names stay', () => {
  assert.equal(tidyName('Organic Poplin Long Sleeve Shirt: Mens - 3XL / Cream'), 'Organic Poplin Long Sleeve Shirt: Mens');
  assert.equal(tidyName('1 Pack Mens Waterproof Cold Weather Knee Socks - 3-5 UK / Black / Grey'), '1 Pack Mens Waterproof Cold Weather Knee Socks');
  assert.equal(tidyName('Thermal Top - Black / M - XL / Red'), 'Thermal Top');
  assert.equal(tidyName('AK-26 - Men\'s Black 3 Piece Velvet Wedding Tuxedo Suit - 46" Jacket 40" Trousers'), 'AK-26 - Men\'s Black 3 Piece Velvet Wedding Tuxedo Suit - 46" Jacket 40" Trousers');
  assert.equal(tidyName('SKMEI 9166 Fashion Men Business Watch - Blue'), 'SKMEI 9166 Fashion Men Business Watch - Blue');
  assert.equal(tidyName('A - B / C'), 'A - B / C', 'too short to cut');
});

function db() {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, retailer TEXT, site_category TEXT, product_name TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT)');
  const add = d.prepare('INSERT INTO products (id, retailer, site_category, product_name) VALUES (?, ?, ?, ?)');
  add.run(1, 'InStock UK', 'Clothing', 'Organic Poplin Long Sleeve Shirt: Mens - 3XL / Cream');
  add.run(2, 'Watch Enclave', 'Watches', "Hugo Boss Hera 1502593 Women's Watch – 38.0mm Black Dial");
  add.run(3, 'InStock UK', 'Clothing', 'Mens & Ladies London Design Socks - 6-11 UK / Blue');
  add.run(4, 'InStock UK', 'Clothing', "Fairtrade Organic Ladies T-shirt - M / White");
  add.run(5, 'Coes', 'Clothing', "O'Neill Men's Boardshorts / Blue - Large / Navy");
  add.run(6, 'Watch Enclave', 'Watches', "Seiko Men's Watch");
  return d;
}

function run(d, site) {
  const names = d.prepare(rowsSql(site, 'names')).all();
  const gender = d.prepare(rowsSql(site, 'gender')).all();
  return plan(site, names, gender);
}

test('MGW: women-only hidden, InStock names tidied, other retailers keep their names; change and rollback work', () => {
  const d = db();
  const p = run(d, 'mgw');
  assert.deepEqual(p.hide.map(h => h.id).sort(), [2, 4]);
  assert.deepEqual(p.rename.map(r => [r.id, r.to]), [[1, 'Organic Poplin Long Sleeve Shirt: Mens'], [3, 'Mens & Ladies London Design Socks']]);
  const f = sqlFiles(p);
  d.exec(f.change);
  assert.equal(d.prepare('SELECT COUNT(*) n FROM products WHERE is_active = 1').get().n, 4);
  assert.equal(d.prepare('SELECT product_name FROM products WHERE id = 5').get().product_name, "O'Neill Men's Boardshorts / Blue - Large / Navy");
  const again = run(d, 'mgw');
  assert.equal(again.hide.length + again.rename.length, 0, 'nothing left after the change');
  d.exec(f.rollback);
  assert.equal(d.prepare('SELECT COUNT(*) n FROM products WHERE is_active = 1').get().n, 6);
  assert.equal(d.prepare('SELECT product_name FROM products WHERE id = 1').get().product_name, 'Organic Poplin Long Sleeve Shirt: Mens - 3XL / Cream');
});

test('WGW: men-only hidden, "Mens & Ladies" stays', () => {
  const p = run(db(), 'wgw');
  assert.deepEqual(p.hide.map(h => h.id).sort(), [1, 5, 6]);
});

test('SQL for the cmd line and wrangler output parsing', () => {
  for (const s of ['mgw', 'wgw']) for (const part of ['names', 'gender']) assert.doesNotMatch(rowsSql(s, part), /[%<>&|^"]/);
  const rows = rowsFromWrangler('Executing...\n[{"results":[{"id":1,"product_name":"A [x]"}],"success":true}]\n');
  assert.equal(rows[0].product_name, 'A [x]');
});
