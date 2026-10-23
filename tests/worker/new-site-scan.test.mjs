// New site scan: Travel or Gaming (read-only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { classifyProduct, readMembers, scan, renderReport } from '../../tools/gw-new-site-scan.mjs';

test('yes and no words: travel and gaming products, look-alikes stay out', () => {
  assert.deepEqual(classifyProduct('Samsonite Spinner 55cm Cabin Suitcase', 'Luggage'), { TRAVEL: 'luggage' });
  assert.deepEqual(classifyProduct('Osprey Farpoint 40 Travel Backpack', 'Bags'), { TRAVEL: 'bags-backpacks' });
  assert.deepEqual(classifyProduct('Universal Travel Adapter UK to EU', 'Electrical'), { TRAVEL: 'travel-accessories' });
  assert.deepEqual(classifyProduct('Vango Tent 4 Person', 'Camping'), { TRAVEL: 'camping-outdoor' });
  assert.deepEqual(classifyProduct('Sony PlayStation 5 Slim Console Digital Edition', 'Gaming'), { GAMING: 'consoles' });
  assert.deepEqual(classifyProduct('EA Sports FC 25 (PS5)', 'Video Games'), { GAMING: 'video-games' });
  assert.deepEqual(classifyProduct('DualSense Wireless Controller', 'Gaming'), { GAMING: 'controllers-vr' });
  assert.deepEqual(classifyProduct('Logitech G502 Gaming Mouse', 'PC'), { GAMING: 'pc-gaming' });
  assert.deepEqual(classifyProduct('Catan Board Game', 'Toys'), { GAMING: 'tabletop' });
  for (const [n, c] of [['Kids School Backpack Unicorn', 'Bags'], ['Garden Gazebo 3x3m', 'Garden'], ['Hive Smart Heating Controller', 'Smart Home'], ['Oak Console Table', 'Furniture'],
    ['Travel Size Shampoo 50ml', 'Beauty'], ['Jigsaw Puzzle 1000', 'Toys'], ['PS5 Console Cover White', 'Gaming'], ['Hydrating eye mask gel', 'Beauty'], ['Toy Suitcase for Dolls', 'Toys']]) {
    assert.deepEqual(classifyProduct(n, c), {}, n);
  }
});

test('members list: a member on any feed is a member', () => {
  const m = readMembers('advertiser_id,advertiser,region,membership,products,feed_name,vertical\r\n1,"Game, Ltd",GB,not joined,5,A,\r\n1,"Game, Ltd",GB,active,7,B,\r\n2,Luggage Co,DE,pending,3,C,Travel\r\n');
  assert.equal(m.get(1).membership, 'active');
  assert.equal(m.get(1).products, 12);
  assert.equal(m.get(1).name, 'Game, Ltd');
  assert.equal(m.get(2).membership, 'pending');
});

test('scan counts per candidate, joins EANs, skips out of stock, marks TGW overlap and members', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'newsite-'));
  const head = 'merchant_name,product_name,search_price,currency,in_stock,ean,merchant_category\n';
  writeFileSync(join(dir, 'AWIN_100_1.csv.gz'), gzipSync(head
    + 'Game Shop,"Sony PlayStation 5 Slim Console",479,GBP,1,0711719577294,Consoles\n'
    + 'Game Shop,"EA Sports FC 25 (PS5)",39.99,GBP,1,5035223124961,Video Games\n'
    + 'Game Shop,"Elden Ring (PS5)",29.99,GBP,0,1234567890128,Video Games\n'
    + 'Game Shop,"Makita Drill",99,GBP,1,,Tools\n'));
  writeFileSync(join(dir, 'AWIN_200_2.csv.gz'), gzipSync(head
    + 'Bag World,"Samsonite Spinner 55cm Cabin Suitcase",159,GBP,1,5414847000001,Luggage\n'
    + 'Bag World,"Antler Holdall",89,GBP,1,,Bags\n'
    + 'Bag World,"Sony PlayStation 5 Slim Console",469,GBP,1,0711719577294,Consoles\n'));
  writeFileSync(join(dir, 'notes.txt'), 'not a feed');
  const members = readMembers('advertiser_id,advertiser,region,membership,products,feed_name,vertical\n100,Game Shop,GB,active,4,Main,\n200,Bag World,GB,not joined,3,Main,\n300,Big Luggage Store,GB,active,9000,Main,\n400,Retro Gaming Ltd,US,not joined,50,Main,\n');
  const res = await scan({ archive: dir, members });
  assert.equal(res.files, 2);
  const G = res.candidates.GAMING, T = res.candidates.TRAVEL;
  assert.equal(G.rows, 3);
  assert.equal(G.keys.size, 2, 'same EAN from two retailers is one product');
  assert.equal(G.outOfStock, 1);
  assert.ok(G.tgw >= 2, 'TGW rules take the console and the game');
  assert.equal(T.rows, 2);
  const text = renderReport(res, { archive: dir, membersChecked: true });
  assert.match(text, /SIDE BY SIDE/);
  assert.match(text, /Game Shop .*MEMBER/);
  assert.match(text, /Bag World .*not joined/);
  assert.match(text, /300 +Big Luggage Store +MEMBER/);
  assert.match(text, /400 +Retro Gaming Ltd/);
  assert.doesNotMatch(text, /Makita/);
  const plain = renderReport(res, { archive: dir });
  assert.match(plain, /NOT checked/);
  assert.equal(readFileSync(join(dir, 'notes.txt'), 'utf8'), 'not a feed');
});
