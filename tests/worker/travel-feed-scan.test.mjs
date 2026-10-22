// Travel feed scan (read-only): which feed products are travel products, and which Awin programmes look like travel-gear retailers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { classify, isTravelProgramme, scanArchive, readList, render } from '../../tools/travel-feed-scan.mjs';

test('travel products go to the right category', () => {
  assert.equal(classify('Samsonite Cosmolite Spinner Suitcase 75cm').cat, 'luggage');
  assert.equal(classify('Cabin Max Metz Cabin Bag 40x20x25').cat, 'luggage');
  assert.equal(classify('Osprey Farpoint 40 Travel Backpack').cat, 'bags-backpacks');
  assert.equal(classify('Eagle Creek Packing Cube Set').cat, 'accessories');
  assert.equal(classify('Memory Foam Neck Pillow for Travel').cat, 'comfort');
  assert.equal(classify('RFID Passport Holder Travel Wallet').cat, 'documents-security');
  assert.equal(classify('Universal Travel Adapter with USB-C').cat, 'tech');
  assert.equal(classify('Vango Odyssey 3 Person Tent', 'Camping > Tents').cat, 'camping-outdoor');
  assert.equal(classify('Quick Dry Beach Towel for Holiday').cat, 'beach-holiday');
});

test('not travel products: baby travel gear, travel-size cosmetics, pets, things without a travel word', () => {
  assert.equal(classify('Joie Travel Cot Grey').travel, false);
  assert.equal(classify('Nivea Travel Size Shampoo 50ml').travel, false);
  assert.equal(classify('Dog Travel Crate').travel, false);
  assert.equal(classify('Lonely Planet Travel Guide Book Italy').travel, false);
  assert.equal(classify('School Backpack Navy').travel, false);
  assert.equal(classify('Fidget Spinner').travel, false);
  assert.equal(classify('Anker Power Bank 10000mAh').travel, false);
  assert.equal(classify('Anker Power Bank 10000mAh for travel').cat, 'tech');
});

test('Awin programmes that sell travel gear, not trips', () => {
  assert.ok(isTravelProgramme('Samsonite UK'));
  assert.ok(isTravelProgramme('Cabin Max'));
  assert.ok(isTravelProgramme('Millets'));
  assert.ok(!isTravelProgramme('Premier Inn Hotels'));
  assert.ok(!isTravelProgramme('British Airways'));
  assert.ok(!isTravelProgramme('Jet2 Holidays'));
  assert.ok(!isTravelProgramme('Coes'));
});

test('scan counts per retailer and the report lists joined and not joined travel programmes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'travelscan-'));
  const head = 'merchant_name,aw_product_id,product_name,search_price,currency,in_stock,merchant_category\n';
  writeFileSync(join(dir, 'AWIN_111_1.csv.gz'), gzipSync(head
    + 'Bag Shop,1,"Hard Shell Spinner Suitcase 68cm",99,GBP,1,Luggage\n'
    + 'Bag Shop,2,"Travel Neck Pillow",15,GBP,0,Travel Accessories\n'
    + 'Bag Shop,3,"Garden Hose 30m",19,GBP,1,Garden\n'));
  writeFileSync(join(dir, 'AWIN_222_2.csv.gz'), gzipSync(head + 'Fashion,1,"Wool Coat",99,GBP,1,Coats\n'));
  const advs = await scanArchive({ archive: dir });
  const a = advs.find(x => x.advertiserId === 111);
  assert.equal(a.rows, 3);
  assert.equal(a.travel, 2);
  assert.equal(a.travelInStock, 1);
  assert.equal(advs.find(x => x.advertiserId === 222).travel, 0);
  const listFile = join(dir, 'list.csv');
  writeFileSync(listFile, 'Advertiser ID,Advertiser Name,Primary Region,Membership Status,Feed ID,Feed Name,Vertical,No of products\n'
    + '111,Bag Shop Luggage,GB,active,1,Main,Retail,3\n'
    + '333,Antler,GB,notjoined,9,Luggage,Retail,5000\n'
    + '444,Sunny Holidays,GB,notjoined,8,Deals,Travel,900\n'
    + '222,Fashion,GB,active,2,Main,Retail,1\n');
  const list = await readList(listFile);
  assert.equal(list.length, 4);
  const { text } = render({ advs, list, archive: dir });
  assert.match(text, /111 Bag Shop: 2 travel of 3 products/);
  assert.match(text, /https:\/\/ui\.awin\.com\/merchant-profile\/333/);
  assert.doesNotMatch(text, /merchant-profile\/444/);
  assert.doesNotMatch(text, /merchant-profile\/111/);
  assert.match(text, /file on this PC: yes/);
});
