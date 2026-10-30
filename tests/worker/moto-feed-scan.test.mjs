// Motorbike and scooter feed scan (read-only): which feed products are for the planned Biker Gear World (BGW),
// which belong to another Gear World site (bicycles and e-bikes stay on SGW), and which Awin programmes look like
// motorbike or scooter retailers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { classify, isBikerProgramme, scanArchive, readList, render } from '../../tools/moto-feed-scan.mjs';

const cat = (n, c = '') => { const r = classify(n, c); return r.sport ? r.cat : null; };
const ov = (n, c = '') => classify(n, c).overlap || null;

test('motorbike and scooter products go to the proposed category', () => {
  assert.equal(cat('Shoei NXR2 Full Face Motorcycle Helmet'), 'helmets');
  assert.equal(cat('AGV K6 S Helmet'), 'helmets');
  assert.equal(cat('Richa Textile Motorcycle Jacket Waterproof'), 'jackets-trousers');
  assert.equal(cat('Waterproof Jacket', 'Motorcycle Clothing > Jackets'), 'jackets-trousers', 'the shop category says motorbike');
  assert.equal(cat('Alpinestars SMX-6 V2 Boots', 'Motorcycle > Boots'), 'boots-gloves');
  assert.equal(cat('Motul 7100 10W-40 4T Oil 1L'), 'parts-maintenance');
  assert.equal(cat('Oxford Monster XL Disc Lock'), 'luggage-security');
  assert.equal(cat('Givi Top Box 47L'), 'luggage-security');
  assert.equal(cat('Cardo Packtalk Edge Motorcycle Intercom'), 'electronics');
  assert.equal(cat('Xiaomi Electric Scooter 4 Pro'), 'electric-scooters');
  assert.equal(cat('Segway Ninebot Max G2'), 'electric-scooters');
  assert.equal(cat('Micro Maxi Deluxe Kick Scooter Kids'), 'kick-scooters', "kids' kick scooters are BGW products (owner, 29 Oct 2026)");
  assert.equal(cat('Super Soco TC Max Electric Motorbike'), 'electric-mopeds');
  assert.equal(cat('Forcefield Pro Back Protector Level 2'), 'safety');
});

test('bicycles and e-bikes stay on SGW; fashion biker jackets and kids\' ride-on toys belong to other sites', () => {
  assert.equal(ov('Carrera Crossfire E Electric Bike'), 'bicycles');
  assert.equal(ov('Cycle Helmet Adult'), 'bicycles');
  assert.equal(ov('Shimano Deore Rear Derailleur'), 'bicycles');
  assert.equal(ov('Leather Biker Jacket Women'), 'fashion');
  assert.equal(ov('Womens Biker Boots Black'), 'fashion');
  assert.equal(ov('Kids Electric Ride On Motorbike 6V'), 'kids');
  assert.equal(cat('Richa Armoured Leather Motorcycle Jacket'), 'jackets-trousers', 'a real motorbike jacket is not fashion');
  assert.equal(cat('TCX Touring Biker Boots Waterproof Motorcycle'), 'boots-gloves');
});

test('not BGW products, even with a biker word (L42)', () => {
  for (const n of ['Horse Riding Boots Leather', 'Die Cast Ducati Model 1:12', 'Mobility Scooter 4mph', 'Motorbike Birthday Card', 'Bike Lights Set USB',
    'Underwater Sea Scooter', 'Triumph Lingerie Bra']) {
    const r = classify(n, '');
    assert.equal(r.sport, false, n);
  }
});

test('Awin programmes that sell motorbike or scooter products, not insurance, lessons or rentals', () => {
  for (const p of ['SportsBikeShop', 'Ghost Bikes', 'Wemoto', 'Pure Electric', 'Infinity Motorcycles', 'Demon Tweeks']) assert.ok(isBikerProgramme(p), p);
  for (const p of ['Bennetts Motorbike Insurance', 'CBT Motorcycle Training', 'Scooter Hire London', 'Coes', 'Joybuy UK']) assert.ok(!isBikerProgramme(p), p);
});

test('scan: counts per retailer and category, bicycles apart, Awin list with links', async () => {
  const root = mkdtempSync(join(tmpdir(), 'motoscan-'));
  const dir = join(root, 'GW_AWIN_NEW_20261030');
  mkdirSync(dir);
  const head = 'merchant_name,aw_product_id,product_name,search_price,currency,in_stock,stock_quantity,merchant_category\n';
  writeFileSync(join(dir, 'AWIN_111_1.csv.gz'), gzipSync(head
    + 'Moto Shop,1,"Shoei NXR2 Full Face Motorcycle Helmet",549,GBP,1,3,Helmets\n'
    + 'Moto Shop,2,"Oxford Monster XL Disc Lock",59,GBP,1,0,Security\n'
    + 'Moto Shop,3,"Carrera Crossfire E Electric Bike",1199,GBP,1,2,Bikes\n'
    + 'Moto Shop,4,"Garden Hose 30m",19,GBP,1,9,Garden\n'));
  const { advs, files } = await scanArchive({ archives: [dir], now: Date.now() });
  const a = advs.find(x => x.advertiserId === 111);
  assert.equal(a.products, 4);
  assert.equal(a.sport, 2);
  assert.equal(a.sportInStock, 1, 'the lock with quantity 0 is out of stock');
  assert.equal(a.cats.helmets, 1);
  assert.equal(a.overlaps.bicycles, 1);
  const listFile = join(root, 'list.csv');
  writeFileSync(listFile, 'Advertiser ID,Advertiser Name,Primary Region,Membership Status,Feed ID,Feed Name,Vertical,No of products\n'
    + '111,Moto Shop,GB,active,1,Main,Retail,4\n'
    + '333,SportsBikeShop,GB,notjoined,7,Main,Automotive,40000\n'
    + '444,Bennetts Motorbike Insurance,GB,notjoined,8,Quotes,Finance,10\n');
  const list = await readList(listFile);
  const { text } = render({ advs, files, list, archives: [dir] });
  assert.match(text, /^BIKER FEED SCAN \(read-only\) - for Biker Gear World \(bikergearworld\.com/);
  assert.match(text, /111 Moto Shop: 2 motorbike\/scooter of 4 products/);
  assert.match(text, /Bicycles & e-bikes \(stay on Sporty Gear World, SGW\)\s+1/);
  assert.match(text, /https:\/\/ui\.awin\.com\/merchant-profile\/333/);
  assert.doesNotMatch(text, /merchant-profile\/444/);
  assert.match(text, /apply later WITH bikergearworld\.com/);
});
