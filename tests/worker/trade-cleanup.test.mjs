// Trade clean-up rules (CGW): products of the general shops that have nothing to do with construction are hidden;
// tools stay, and a tool shop's "jigsaw" (a saw) is never checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { summarySql, samplesSql, idsSql, keptSql, updateSql } from '../../tools/cleanup-rules/trade.mjs';

const ROWS = [
  [1, 'InStock UK', 'Power Tools', 'A to Z Map of Acmeton 1000 Piece Jigsaw Puzzle', 'puzzle, toy or game'],
  [2, 'InStock UK', 'PPE', 'Acme Mullein Drops for Lungs - Respiratory Support, 2 oz', 'health product or supplement'],
  [3, 'InStock UK', 'PPE', 'Acme Respiratory half mask with replaceable filter', ''],
  [4, 'InStock UK', 'PPE', 'Acme Kids Hearing Protection Ear Defenders - Sky Blue', 'for babies, children or pets'],
  [5, 'InStock UK', 'Hand Tools', '2 PCS for Apple Watch 38mm Metal Strap Connector - Black', 'phone, watch, beauty or kitchen item'],
  [6, 'InStock UK', 'Hand Tools', '25 in 1 Screwdriver for iPhone and Smart Phones', ''],
  [7, 'InStock UK', 'Hand Tools', 'Acme Wooden Meat Tenderizer Mallet Hammer', 'phone, watch, beauty or kitchen item'],
  [8, 'Tooled Up', 'Power Tools', 'Acme 18V Cordless Jigsaw Body Only', ''],
  [9, 'Tooled Up', 'Workwear', 'Acme Kids Hi Vis Vest', ''],
  [10, 'Joybuy UK', 'Site Equipment', 'Acme Toothpaste Pack of 3', 'health product or supplement'],
  [11, 'InStock UK', 'Hand Tools', 'Acme 6 Inch Long Nose Pliers', '']
];

function db() {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, retailer TEXT, site_category TEXT, product_name TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT)');
  const add = d.prepare('INSERT INTO products (id, retailer, site_category, product_name) VALUES (?, ?, ?, ?)');
  for (const [id, r, c, n] of ROWS) add.run(id, r, c, n);
  return d;
}

test('hides puzzles, supplements, kids, phone and kitchen items of the general shops; keeps tools and tool shops', () => {
  const d = db();
  const want = ROWS.filter(r => r[4]).map(r => r[0]);
  assert.deepEqual(d.prepare(idsSql()).all().map(r => r.id), want);
  const reasons = new Map(d.prepare(idsSql().replace('SELECT id FROM x ORDER BY id', 'SELECT id, reason FROM x')).all().map(r => [r.id, r.reason]));
  for (const [id, , , name, reason] of ROWS.filter(r => r[4])) assert.equal(reasons.get(id), reason, name);
  assert.equal(d.prepare(summarySql()).all().reduce((t, r) => t + Number(r.n), 0), want.length);
  assert.ok(d.prepare(samplesSql()).all().length >= 4);
  assert.equal(d.prepare(keptSql()).all().reduce((t, r) => t + Number(r.n), 0), ROWS.length - want.length);
  d.exec(updateSql(want, false));
  assert.equal(d.prepare(idsSql()).all().length, 0);
  d.exec(updateSql(want, true));
  assert.equal(d.prepare('SELECT COUNT(*) n FROM products WHERE is_active = 1').get().n, ROWS.length);
});

test('the SQL can go on a Windows cmd line (ASCII, no % < > & | ^ or double quotes) and is read-only', () => {
  for (const sql of [summarySql(), samplesSql(), idsSql(), keptSql()]) {
    const one = sql.replace(/\s+/g, ' ');
    assert.doesNotMatch(one, /[%<>&|^"]/);
    assert.doesNotMatch(one, /[^\x20-\x7e]/);
    assert.doesNotMatch(one, /\b(UPDATE|INSERT|DELETE|DROP)\b/i);
    assert.ok(one.length < 6000, 'fits a cmd line');
  }
});
