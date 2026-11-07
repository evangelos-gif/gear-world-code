// Mini PC scan (owner, 7 Nov 2026, lessons L97): read-only, the same words and the same matching as the TGW Mini PCs page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isMiniPc, scanArchive, render, SUB } from '../../tools/mini-pc-scan.mjs';
import { nameMatch } from '../../src/db.js';

const NAMES = [
  'FIREBAT Mini PC AMD Ryzen 7 7735HS | Radeon 680M | 16GB RAM 512GB SSD',
  'MSI Cubi NUC 1M Intel Core 5 120U Barebone, NUC, SFF, Mini Computer',
  'DELL Pro QCM1250 Intel Core i5 16 GB 512 GB SSD Windows 11 Pro Micro PC.',
  'Lenovo ThinkCentre Tiny-In-One 24 computer monitor 60.5 cm',
  'D-Link Nuclias Connect Network Controller',
  'UK 19V 65W Mains Charger, DC Power Adapter for Monitor Mini PC',
  'ASUS Vivobook 15 Laptop 16GB 512GB',
  'Mini  PC with two spaces',
  'Beelink SER5 MAX Mini-PC (Ryzen 7 6800U)'
];

test('the scan finds exactly what the site page finds (same words, same matching as the database query)', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE products (product_name TEXT)');
  for (const n of NAMES) db.prepare('INSERT INTO products VALUES (?)').run(n);
  const m = nameMatch({ words: SUB.match, not: SUB.exclude });
  const site = db.prepare(`SELECT product_name FROM products p WHERE ${m.sql}`).all(...m.binds).map(r => r.product_name).sort();
  assert.deepEqual(NAMES.filter(isMiniPc).sort(), site);
  assert.ok(isMiniPc(NAMES[0]) && isMiniPc(NAMES[8]) && !isMiniPc(NAMES[4]) && !isMiniPc(NAMES[5]));
});

test('counts per feed: mini PCs, in stock, sales, the cheapest; marks feeds Technology already takes; changes nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mini-scan-'));
  const head = 'merchant_name,product_name,search_price,rrp_price,currency,in_stock,merchant_category';
  const rows = [
    'Joybuy,"FIREBAT Mini PC AMD Ryzen 7 7735HS 16GB",379.99,459.99,GBP,1,Desktop Computers',
    'Joybuy,"SOYO S5Air Mini PC Ryzen 5",332.99,,GBP,0,Desktop Computers',
    'Joybuy,"Lenovo ThinkCentre Tiny-In-One 24 computer monitor",146.39,,GBP,1,Monitors',
    'Joybuy,"ASUS Vivobook 15 Laptop",499.99,,GBP,1,Laptops'
  ];
  const file = join(dir, 'AWIN_123932_114093.csv.gz');
  writeFileSync(file, gzipSync([head, ...rows].join('\n') + '\n'));
  const before = readFileSync(file);
  const mtime = statSync(file).mtimeMs;
  const feeds = await scanArchive({ archive: dir });
  assert.equal(feeds.length, 1);
  const f = feeds[0];
  assert.deepEqual([f.rows, f.mini, f.inStock, f.sale], [4, 2, 1, 1]);
  assert.equal(f.cheapest[0].price, 332.99);
  const text = render({ feeds, inTgw: new Set(['114093']), archive: dir });
  assert.match(text, /Joybuy \(Awin 123932, feed 114093\) \| mini PC: 2 \| σε απόθεμα: 1 \| με έκπτωση: 1 \| GBP 2 \| .* \| ΣΤΟ TECHNOLOGY/);
  assert.match(text, /379\.99 GBP \(πριν 459\.99\) \| FIREBAT Mini PC/);
  assert.ok(text.includes('Feeds που διαβάστηκαν: 1.'));
  assert.ok(readFileSync(file).equals(before) && statSync(file).mtimeMs === mtime, 'the archive file is unchanged');
});
