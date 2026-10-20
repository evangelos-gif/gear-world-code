// Family clean-up rules (KGW, a site for parents): medicines, food supplements, adult clothing and items for the mother
// are hidden; toys, baby feeding items and kids' clothing stay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { summarySql, samplesSql, idsSql, keptSql, updateSql } from '../../tools/cleanup-rules/family.mjs';

const ROWS = [
  // [id, category, name, hidden reason or '']
  [1, 'Baby & Toddler', 'Calpol Baby Health Medicine Infant Oral Suspension 2+ Months 100ml', 'medicine'],
  [2, 'Kids Tech', 'Zyrtec Allergy Relief (10 mg) - 90 Tablets', 'medicine'],
  [3, 'Toys & Games', 'Simulation Stethoscope Set Portable Medicine Box Child Doctor Role Playing Toy', ''],
  [4, 'Kids Tech', 'Natures Plus Animal Parade Kids Multivitamin - Cherry Chewables, 90 Tablets', 'food supplement or vitamin'],
  [5, 'Clothing', 'SmartyPants Kids Fiber & Veggies Gummies - Prebiotic Fiber, 60 Count', 'food supplement or vitamin'],
  [6, 'Baby & Toddler', 'Cow & Gate Stage 2 Follow On Baby Milk Powder, Iron & Vitamin D Support, 800g Tin', ''],
  [7, 'Kids Tech', 'Chomp Junior Very Berry Toothpaste Tablets (Pack of 2)', ''],
  [8, 'Kids Tech', 'Kids Tablet 10 inch with Parental Controls and Case', ''],
  [9, 'Clothing', "PUMA Women's Tad Essential Baby Tee - Raisin", 'adult clothing'],
  [10, 'Clothing', 'Y2K sexy halter dress - XL / black', 'adult clothing'],
  [11, 'Clothing', 'Fairtrade Organic Kids Hoodie - 10/11 Years / Burgundy', ''],
  [12, 'Clothing', '1 Pack Adults & Kids Knee High Hockey Socks - 7-11 UK / White', ''],
  [13, 'Baby & Toddler', 'Medela Keep Cool Maternity Nursing Bra in Black, Size M', 'for the mother (maternity, nursing, pregnancy)'],
  [14, 'Baby & Toddler', 'Momcozy M5 Hands-Free Wearable Electric Breast Pump Double Pack', 'for the mother (maternity, nursing, pregnancy)'],
  [15, 'Baby & Toddler', 'THORNE Prenatal DHA - 650 mg DHA + 200 mg EPA', 'food supplement or vitamin'],
  [16, 'Baby & Toddler', 'Baby Bottle Cooler Bag Storage Pouch for Breast Pump - Black', ''],
  [17, 'Baby & Toddler', 'MOCHi Breast Milk Storage Bags - 50', ''],
  [18, 'Baby & Toddler', 'aden + anais Baby Nursing Feeding Bibs 3 Pack Cotton Muslin', ''],
  [19, 'Baby & Toddler', 'Bluet Baby Fruit Feeder Pacifier - 6 Nipples (2 Pack)', ''],
  [20, 'Baby & Toddler', 'Momcozy Breastfeeding Reusable 5ml Colostrum Collectors, 2-Pack', ''],
  [21, 'Baby & Toddler', 'Mum 2 Mum Hooded Towel - Baby Blue', ''],
  [22, 'Baby & Toddler', 'Twin Pregnancy Nursing Pillow - Dino', 'for the mother (maternity, nursing, pregnancy)']
];

function db() {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, site_category TEXT, product_name TEXT, is_active INTEGER DEFAULT 1, updated_at TEXT)');
  const add = d.prepare('INSERT INTO products (id, site_category, product_name) VALUES (?, ?, ?)');
  for (const [id, cat, name] of ROWS) add.run(id, cat, name);
  add.run(99, 'Kids Tech', 'Zyrtec Allergy Relief - already hidden');
  d.prepare('UPDATE products SET is_active = 0 WHERE id = 99').run();
  return d;
}

test('hides medicines, supplements, adult clothing and items for the mother; keeps toys, baby feeding and kids clothing', () => {
  const d = db();
  const want = ROWS.filter(r => r[3]).map(r => r[0]);
  assert.deepEqual(d.prepare(idsSql()).all().map(r => r.id), want);
  // Each product gets the reason we expect (the report groups by it).
  const reasons = new Map(d.prepare(idsSql().replace('SELECT id FROM x ORDER BY id', 'SELECT id, reason FROM x')).all().map(r => [r.id, r.reason]));
  for (const [id, , name, reason] of ROWS.filter(r => r[3])) assert.equal(reasons.get(id), reason, name);
  assert.ok(d.prepare(samplesSql()).all().length >= 4);
  const sum = d.prepare(summarySql()).all();
  assert.equal(sum.reduce((t, r) => t + Number(r.n), 0), want.length);
  const kept = d.prepare(keptSql()).all().reduce((t, r) => t + Number(r.n), 0);
  assert.equal(kept, ROWS.length - want.length);
});

test('the hide and rollback SQL work by id and undo each other', () => {
  const d = db();
  const ids = d.prepare(idsSql()).all().map(r => r.id);
  d.exec(updateSql(ids, false));
  assert.equal(d.prepare(idsSql()).all().length, 0, 'nothing left to hide');
  d.exec(updateSql(ids, true));
  assert.equal(d.prepare('SELECT COUNT(*) n FROM products WHERE is_active = 1').get().n, ROWS.length, 'rollback shows them again; the one hidden before stays hidden');
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
