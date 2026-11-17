// Lessons L179: the food filed under Home Gear World's appliances (Joybuy UK's Kettle crisps came first for "kettle").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { summarySql, idsSql, keptSql, samplesSql, FOOD_PATH } from '../../tools/cleanup-rules/home-food.mjs';

test('home-food (HGW): the shop\'s "Food, Beverages & Tobacco" products hidden; kettles, food storage and food processors stay', () => {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, retailer TEXT, site_category TEXT, subcategory TEXT, product_name TEXT, merchant_category TEXT, is_active INTEGER DEFAULT 1)');
  const add = d.prepare('INSERT INTO products (id, retailer, site_category, subcategory, product_name, merchant_category, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)');
  add.run(1, 'Joybuy UK', 'Home Appliances', 'Kettle', 'Kettle Crisps & Dips Sour Cream & Chive 130g', 'Food, Beverages & Tobacco > Food Items > Appetisers & Snacks', 1);
  add.run(2, 'Joybuy UK', 'Home Appliances', 'Toaster', "Kellogg's Pop Tarts Frosted Chocolate, Box of 8 Toaster Pastries", 'Food, Beverages & Tobacco > Food Items > Grain', 1);
  add.run(3, 'Joybuy UK', 'Home Appliances', 'Coffee Machine', 'Nescafé Dolce Gusto Coffee Pods', 'Food, Beverages & Tobacco > Beverages > Coffee', 1);
  add.run(4, 'Joybuy UK', 'Home Appliances', 'Kettle', 'DAEWOO Sienna Retro 1.7L Jug Kettle', 'Home & Garden > Kitchen & Dining > Kitchen Appliances > Electric Kettles', 1);
  add.run(5, 'InStock UK', 'Kitchen & Dining', 'Food Storage', 'Glass Food Storage Containers Set', 'Home & Garden > Kitchen & Dining > Food Storage', 1);
  add.run(6, 'InStock UK', 'Home Appliances', 'Food Processor', 'Food Processor 1000W', null, 1);
  add.run(7, 'Joybuy UK', 'Home Appliances', 'Kettle', 'Hotpot Kettle Base Oil (already hidden)', 'Food, Beverages & Tobacco > Food Items', 0);
  assert.equal(FOOD_PATH, 'Food, Beverages ');
  assert.deepEqual(d.prepare(idsSql()).all().map(r => r.id), [1, 2, 3]);
  assert.equal(d.prepare(summarySql()).all()[0].n, 3);
  assert.equal(d.prepare(samplesSql()).all().length, 3);
  assert.deepEqual(Object.fromEntries(d.prepare(keptSql()).all().map(r => [r.site_category, r.n])), { 'Home Appliances': 2, 'Kitchen & Dining': 1 });
  // The command goes through cmd.exe: none of its special characters.
  for (const s of [summarySql(), samplesSql(), idsSql(), keptSql()]) assert.doesNotMatch(s, /[%<>&|^"!]/);
});
