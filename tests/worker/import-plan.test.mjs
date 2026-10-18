import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
import { classify } from '../../sites/tgw/category-rules.js';
import { planImport, readCsvRecords, parsePrice, cleanText } from '../../tools/tgw-import-plan.mjs';

test('category rules: tech goes to the right category, junk is rejected (lessons L14)', () => {
  const cases = [
    ['Apple iPhone 15 128GB SIM-free Black', 'phones-smartwatches'],
    ['Samsung Galaxy Tab S9 Wi-Fi', 'laptops-computing'],
    ['Spigen Tough Armor iPhone 15 Case', 'accessories-storage'],
    ['Samsung Galaxy S24 Clear Cover', 'accessories-storage'],
    ['Anker 20000mAh Power Bank USB-C', 'accessories-storage'],
    ['Lenovo IdeaPad 15.6 inch Laptop 16GB RAM', 'laptops-computing'],
    ['Sony WH-1000XM5 Wireless Headphones', 'audio'],
    ['Sony PlayStation 5 Slim Console', 'gaming'],
    ['Logitech G Pro Gaming Headset', 'gaming'],
    ['LG 55 inch OLED TV', 'tv-home-cinema'],
    ['Nextbase 622GW Dash Cam', 'cameras-drones'],
    ['DJI Mini 4 Pro Drone', 'cameras-drones'],
    ['Ring Video Doorbell 4', 'smart-home-wifi'],
    ['TP-Link Deco Mesh Wi-Fi 3-pack', 'smart-home-wifi'],
    ['Samsung 990 Pro 2TB NVMe SSD', 'accessories-storage'],
    ['HP DeskJet Wireless All-in-One Printer', 'laptops-computing'],
    ['Garmin Forerunner 265 GPS Smartwatch', 'phones-smartwatches'],
    ['Lenovo IdeaPad 3 15.6 Laptop 8GB RAM 512GB SSD', 'laptops-computing'],
    ['Echo Dot Smart Speaker with Alexa', 'smart-home-wifi']
  ];
  for (const [name, slug] of cases) assert.deepEqual(classify(name), { ok: true, slug }, name);
  const junk = [
    ['Makita RT0702C Trim Router 240V', 'woodworking or power tool'],
    ['Bosch Brake Pads Front Set', 'vehicle part'],
    ['Smart Glasses Bluetooth Audio Sunglasses', 'novelty smart glasses'],
    ['Cotton Crew Neck T-Shirt', 'clothing or beauty'],
    ['Garden Hose 30m', 'not tech'],
    ['Vitamin C Tablets 1000mg', 'not tech'],
    ['Zip Pencil Case Blue', 'not tech']
  ];
  for (const [name, reason] of junk) assert.deepEqual(classify(name), { ok: false, reason }, name);
});

test('CSV reader: quotes, doubled quotes, line breaks inside quotes, pipe delimiter, BOM', async () => {
  const text = '﻿a|b|c\n1|"x | y"|"line1\nline2"\n2|"say ""hi"""|end\r\n3||';
  const rows = [];
  for await (const r of readCsvRecords(Readable.from([Buffer.from(text.slice(0, 7)), Buffer.from(text.slice(7))]))) rows.push(r);
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', 'x | y', 'line1\nline2'], ['2', 'say "hi"', 'end'], ['3', '', '']]);
});

test('price and text cleaning', () => {
  assert.equal(parsePrice('£1,299.99'), 1299.99);
  assert.equal(parsePrice('GBP54.03'), 54.03);
  assert.equal(parsePrice('19,99'), 19.99);
  assert.ok(Number.isNaN(parsePrice('')));
  assert.equal(cleanText('<p>Fast &amp; light&nbsp;laptop</p>'), 'Fast & light laptop');
});

function csvLine(values) {
  return values.map(v => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',');
}

test('import plan: accepts clean tech rows, rejects with reasons, writes SQL that is not executed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgw-plan-'));
  const archive = join(dir, 'archive');
  const out = join(dir, 'out');
  const header = ['aw_deep_link', 'product_name', 'aw_product_id', 'merchant_product_id', 'merchant_image_url', 'aw_image_url', 'description', 'merchant_category', 'search_price', 'rrp_price', 'currency', 'brand_name', 'in_stock', 'ean', 'colour'];
  const link = id => `https://www.awin1.com/pclick.php?p=${id}&a=1&m=123932`;
  const rows = [
    [link(1), 'Lenovo IdeaPad 15.6" Laptop 16GB RAM', '1', 'JB-1', 'https://img.example/1.jpg', '', '<p>Fast, light &amp; quiet.\nGreat for work.</p>', 'Computers > Laptops', '499.99', '599.99', 'GBP', 'Lenovo', '1', '4006381333931', 'Grey'],
    [link(2), 'Sony WH-1000XM5 Wireless Headphones', '2', 'JB-2', 'https://img.example/2.jpg', '', 'Noise cancelling', 'Audio', '279.00', '', 'GBP', 'Sony', 'yes', '5012345678901', ''],
    [link(3), 'Makita Trim Router 240V', '3', 'JB-3', 'https://img.example/3.jpg', '', '', 'Tools', '120', '', 'GBP', 'Makita', '1', '', ''],
    [link(4), 'Apple iPhone 15 128GB SIM-free', '4', 'JB-4', 'http://img.example/4.jpg', '', '', 'Phones', '699', '', 'GBP', 'Apple', '1', '', ''],
    [link(5), 'Anker Power Bank 20000mAh', '5', 'JB-5', 'https://img.example/5.jpg', '', '', 'Accessories', '29.99', '', 'GBP', 'Anker', '0', '', ''],
    ['https://example.com/x', 'Ring Video Doorbell 4', '6', 'JB-6', 'https://img.example/6.jpg', '', '', 'Smart Home', '99', '', 'GBP', 'Ring', '1', '', ''],
    [link(7), 'Nextbase Dash Cam 622GW', '7', 'JB-7', '', 'https://images2.productserve.com/7.jpg', '', 'Car Electronics', '199', '', 'GBP', 'Nextbase', '1', '', ''],
    [link(8), 'Lenovo IdeaPad 15.6" Laptop 16GB RAM', '8', 'JB-1', 'https://img.example/1.jpg', '', '', 'Computers > Laptops', '499.99', '', 'GBP', 'Lenovo', '1', '', ''],
    [link(9), 'Samsung 55 inch QLED TV', '9', 'JB-9', 'https://img.example/9.jpg', '', '', 'TV', '549', '', 'EUR', 'Samsung', '1', '', ''],
    [link(10), "O'Neill's 2TB External Hard Drive", '10', 'JB-10', 'https://img.example/10.jpg', '', 'Has; semicolons', 'Storage', '79.5', '', 'GBP', '', '1', '', '']
  ];
  const csv = [csvLine(header), ...rows.map(csvLine)].join('\n') + '\n';
  const { mkdirSync } = await import('node:fs');
  mkdirSync(archive, { recursive: true });
  writeFileSync(join(archive, 'AWIN_123932_114093.csv.gz'), gzipSync(Buffer.from(csv)));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: [{ advertiserId: 123932, feedIds: [114093], retailer: 'Joybuy', currency: 'GBP', condition: 'new', approved: true }] }));
  mkdirSync(out, { recursive: true });

  const before = readFileSync(join(archive, 'AWIN_123932_114093.csv.gz'));
  const { stats, products } = await planImport({ archive, sourcesFile, outDir: out, now: new Date('2026-10-18T19:00:00Z') });
  assert.deepEqual(readFileSync(join(archive, 'AWIN_123932_114093.csv.gz')), before, 'archive is not changed');

  assert.equal(stats.rows, 10);
  assert.equal(stats.accepted, 4, JSON.stringify(stats));
  assert.deepEqual(products.map(p => p.category_slug).sort(), ['accessories-storage', 'audio', 'cameras-drones', 'laptops-computing']);
  assert.equal(stats.rejected['woodworking or power tool'], 1);
  assert.equal(stats.rejected['no https image'], 1);
  assert.equal(stats.rejected['out of stock'], 1);
  assert.equal(stats.rejected['link is not an Awin link'], 1);
  assert.equal(stats.rejected['duplicate product id'], 1);
  assert.equal(stats.rejected['currency EUR'], 1);

  const laptop = products.find(p => p.merchant_product_id === 'JB-1');
  assert.equal(laptop.stable_key, '123932:JB-1');
  assert.equal(laptop.was_price, 599.99);
  assert.equal(laptop.gtin, '4006381333931');
  assert.equal(laptop.description, 'Fast, light & quiet. Great for work.');
  assert.equal(laptop.specs_json, '{"Colour":"Grey"}');
  assert.equal(laptop.subcategory, 'Laptops');
  assert.equal(products.find(p => p.merchant_product_id === 'JB-2').gtin, null, 'invalid GTIN dropped');
  assert.equal(products.find(p => p.merchant_product_id === 'JB-7').image_url, 'https://images2.productserve.com/7.jpg');

  const sqlFiles = readdirSync(join(out, 'sql')).sort();
  assert.deepEqual(sqlFiles, ['0001.sql', '9999-finish.sql']);
  const sql = readFileSync(join(out, 'sql', '0001.sql'), 'utf8');
  assert.match(sql, /NOT executed/);
  assert.equal((sql.match(/^INSERT INTO products/gm) || []).length, 4);
  assert.match(sql, /'O''Neill''s 2TB External Hard Drive'/);
  assert.match(sql, /ON CONFLICT\(stable_key\) DO UPDATE SET/);
  const finish = readFileSync(join(out, 'sql', '9999-finish.sql'), 'utf8');
  assert.match(finish, /UPDATE products SET is_active = 0.*awin_advertiser_id IN \(123932\).*last_seen_at < '2026-10-18 19:00:00'/);
  const report = readFileSync(join(out, 'report.txt'), 'utf8');
  assert.match(report, /4 of 10 rows would be imported/);
  assert.match(report, /nothing imported/);
});
