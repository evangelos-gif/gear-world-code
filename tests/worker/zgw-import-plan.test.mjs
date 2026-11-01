// Pets Gear World import plan (dry run): ZGW rules on fake feeds, the approved shops of the pets feed scan
// (1 Nov 2026), and the look-alikes of that scan out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planZgwImport } from '../../tools/zgw-import-plan.mjs';
import { classify, cleanProductName, CATEGORY_SLUGS, QUALITY } from '../../sites/zgw/category-rules.js';

const slug = (n, c = '') => classify(cleanProductName(n), c, c).slug;
const ok = (n, c = '') => classify(cleanProductName(n), c, c).ok;
const PET = 'Animals & Pet Supplies > Pet Supplies';

test('ZGW rules put real products of the pets feed scan (1 Nov 2026) in the right category', () => {
  for (const [name, c, s] of [
    ['Dreamies Mix Cat Treat Biscuits with Chicken & Duck 60g', `${PET} > Cat Supplies`, 'food'],
    ['Harringtons Puppy Rich in Turkey & Rice 1.7kg', `${PET} > Pet Food Supplies`, 'food'],
    ['Good Boy Pork and Hide Twisters 60g', `${PET} > Dog Supplies`, 'food'],
    ['Feandrea Cat Tree, 2 Cat Caves, 68x48x101cm, Smoky Grey', `${PET} > Cat Supplies`, 'cats'],
    ['Pawise Reversible Cat Scratcher 35cm', `${PET} > Cat Supplies`, 'cats'],
    ['Itch Flea & Tick Spot-On Treatment For Medium Dogs (10-20kg) 2 Pipettes', `${PET} > Dog Supplies`, 'grooming'],
    ['Good Boy Soft Dog Toy', `${PET} > Dog Supplies`, 'toys'],
    ['Mason Cash Colour Mix Grey Dog Bowl 20cm', `${PET} > Dog Supplies`, 'feeding'],
    ['pecute Slow Feeder Bowl (Size M) - Blue', `${PET} > Dog Supplies`, 'feeding'],
    ['Rosewood Large Dog Bed 81 x 63 x 18cm', `${PET} > Dog Supplies`, 'beds-crates'],
    ['CoA Halti Headcollar Size 2 Black', `${PET} > Dog Supplies`, 'walking'],
    ['Ancol Timberwolf Leather Collar Sable 35cm', `${PET} > Dog Supplies`, 'walking'],
    ['Pecute Pet Backpack, Large, Expandable, for Cats up to 11 kg or Dogs up to 10 kg', `${PET} > Dog Supplies`, 'travel'],
    ['Hunter Uppsala Extreme Dog Coat - Size 50', 'Household', 'walking'],
    ['Barbour Harley Quilted Dog Coat', 'Gifts', 'walking'],
    ['Barbour Dog Small Quilted Carrier', 'Gifts', 'travel'],
    ['Equestrian Saddle Pad Navy', '', 'horse']
  ]) assert.equal(slug(name, c), s, name);
});

test('ZGW rules leave out children\'s toys, people\'s clothing, vacuums and look-alikes', () => {
  for (const [name, c] of [
    ['Paw Patrol Chase Plush 20cm', 'Toys'],
    ['Keel Toys Soft Cuddly Rabbit - White', 'Toys'],
    ['Hoover HF4 Cordless Stick Vacuum Cleaner with Pet Tool - 30 Minute Run', 'Home'],
    ['Mens Dog Walking Jacket Waterproof', 'Menswear'],
    ['Halloween Cat Cufflinks Luxury Gift Bag', 'Cufflinks'],
    ['FDL IP68 RATED CAT.6A WEATHERPROOF ENCLOSURE BOX', 'Default Category>PC Components>Other'],
    ['Dassy Stretch-Arbeitshose Hong Kong PESCO41 201099', ''],
    ['Palmolive Aquarium Hand Soap 300ml', 'Household']
  ]) assert.equal(ok(name, c), false, name);
});

test('11 categories (10 + horse and riding, owner 1 Nov 2026), prices in pounds only', () => {
  assert.deepEqual(CATEGORY_SLUGS, ['beds-crates', 'walking', 'toys', 'food', 'cats', 'grooming', 'feeding', 'travel', 'small-pets', 'outdoor', 'horse']);
  assert.deepEqual(QUALITY.currencies, ['GBP']);
});

test('sources: Joybuy, Plusshop, Bazta and Coes; Red Gorilla and VEVOR off; no text of another site', () => {
  const text = readFileSync('sites/zgw/sources.json', 'utf8');
  const src = JSON.parse(text).sources;
  assert.deepEqual(src.filter(s => s.approved).map(s => s.retailer), ['Joybuy', 'Plusshop UK', 'Bazta UK', 'Coes']);
  assert.equal(src.find(s => s.retailer === 'Bazta UK').rulesFrom, 69306);
  assert.equal(src.find(s => s.retailer === 'Red Gorilla').approved, false);
  assert.equal(src.find(s => s.retailer === 'VEVOR').approved, false);
  assert.doesNotMatch(text, /Gaming|Biker|gaminggearworld|bikergearworld/i, 'lessons L01');
});

test('plan: ZGW products in, children\'s toys and out-of-stock rows out, SQL not executed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'zgw-plan-'));
  const a = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(a);
  const out = join(dir, 'out');
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean\n';
  const link = (p, m) => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=${m}`;
  writeFileSync(join(a, 'AWIN_123932_114093.csv.gz'), gzipSync(head
    + `${link(1, 123932)},Harringtons Puppy Rich in Turkey & Rice 1.7kg,1,J-1,https://img.example/1.jpg,${PET} > Pet Food Supplies,5.25,GBP,Harringtons,1,\n`
    + `${link(2, 123932)},Feandrea Cat Tree with 2 Cat Caves Smoky Grey,2,J-2,https://img.example/2.jpg,${PET} > Cat Supplies,49.99,GBP,Feandrea,1,\n`
    + `${link(3, 123932)},Paw Patrol Chase Plush 20cm,3,J-3,https://img.example/3.jpg,Toys & Games > Toys,12,GBP,Paw Patrol,1,\n`
    + `${link(4, 123932)},Rosewood Large Dog Bed 81 x 63 x 18cm,4,J-4,https://img.example/4.jpg,${PET} > Dog Supplies,20.39,GBP,Rosewood,0,\n`));
  const sources = join(dir, 'sources.json');
  writeFileSync(sources, JSON.stringify({ sources: [{ advertiserId: 123932, feedIds: [114093], retailer: 'Joybuy', currency: 'GBP', approved: true }] }));
  const { stats, report } = await planZgwImport({ archive: a, sourcesFile: sources, outDir: out, now: new Date('2026-11-01T20:00:00Z') });
  assert.equal(stats.rows, 4);
  assert.equal(stats.accepted, 2);
  assert.equal(stats.perCategory.food, 1);
  assert.equal(stats.perCategory.cats, 1);
  assert.equal(stats.rejected['out of stock'], 1);
  assert.match(report, /ZGW IMPORT PLAN/);
  const sql = readFileSync(join(out, 'sql', readdirSync(join(out, 'sql')).find(f => f === '0001.sql')), 'utf8');
  assert.match(sql, /-- ZGW import plan .* NOT executed/);
});
