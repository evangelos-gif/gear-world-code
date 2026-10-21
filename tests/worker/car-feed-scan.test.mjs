// Car feed scan (read-only): which feed products are car products, and which Awin programmes look like car retailers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { classify, isCarProgramme, scanArchive, readList, render } from '../../tools/car-feed-scan.mjs';

test('car products go to the right category', () => {
  assert.equal(classify('Nextbase 622GW Dash Cam').cat, 'car-electronics');
  assert.equal(classify('Michelin Pilot Sport 4 225/45 R17 Tyre').cat, 'tyres-wheels');
  assert.equal(classify('Castrol Edge 5W-30 Engine Oil 5L').cat, 'parts-maintenance');
  assert.equal(classify('Philips H7 bulb', 'Car Parts > Bulbs').cat, 'parts-maintenance');
  assert.equal(classify('Halfords 2 Tonne Trolley Jack').cat, 'garage-tools');
  assert.equal(classify('Meguiars Car Wash Shampoo 1L').cat, 'car-care');
  assert.equal(classify('Thule Roof Box 400L').cat, 'exterior-towing');
  assert.equal(classify('Universal Car Seat Covers Black').car, true);
  assert.equal(classify('Ohme Home Pro EV Charger Type 2').cat, 'ev-charging');
});

test('not car products: toys, child seats, clothes, bikes, things without a car word', () => {
  assert.equal(classify('Remote Control Car Red').car, false);
  assert.equal(classify('Maxi-Cosi Pearl 360 ISOFIX Car Seat').car, false);
  assert.equal(classify('Classic Car T-Shirt').car, false);
  assert.equal(classify('Continental Bike Tyre 700c').car, false);
  assert.equal(classify('Turtle Wax Candle').car, false);
  assert.equal(classify('Bosch Cordless Drill 18V').car, false);
  assert.equal(classify('Sony Wireless Subwoofer').car, false);
  assert.equal(classify('Card holder wallet').car, false);
  assert.equal(classify('Oxford Motorcycle Cover').moto, true);
});

test('Awin programmes with car names', () => {
  assert.ok(isCarProgramme('Halfords'));
  assert.ok(isCarProgramme('Blackcircles.com'));
  assert.ok(isCarProgramme('Euro Car Parts'));
  assert.ok(isCarProgramme('Some Shop', 'Automotive'));
  assert.ok(!isCarProgramme('Coes'));
  assert.ok(!isCarProgramme('Joybuy UK'));
});

test('scan counts per retailer and the report lists joined and not joined car programmes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'carscan-'));
  const head = 'merchant_name,aw_product_id,product_name,search_price,currency,in_stock,merchant_category\n';
  writeFileSync(join(dir, 'AWIN_111_1.csv.gz'), gzipSync(head
    + 'Motor Shop,1,"Nextbase Dash Cam 322GW",99,GBP,1,Car Electronics\n'
    + 'Motor Shop,2,"Trolley Jack 2T",49,GBP,0,Garage\n'
    + 'Motor Shop,3,"Garden Hose 30m",19,GBP,1,Garden\n'));
  writeFileSync(join(dir, 'AWIN_222_2.csv.gz'), gzipSync(head + 'Fashion,1,"Wool Coat",99,GBP,1,Coats\n'));
  const advs = await scanArchive({ archive: dir });
  const a = advs.find(x => x.advertiserId === 111);
  assert.equal(a.rows, 3);
  assert.equal(a.car, 2);
  assert.equal(a.carInStock, 1);
  assert.equal(advs.find(x => x.advertiserId === 222).car, 0);
  const listFile = join(dir, 'list.csv');
  writeFileSync(listFile, 'Advertiser ID,Advertiser Name,Primary Region,Membership Status,Feed ID,Feed Name,Vertical,No of products\n'
    + '111,Motor Shop,GB,active,1,Main,Retail,3\n'
    + '333,Tyre World,DE,notjoined,9,Tyres,Retail,5000\n'
    + '222,Fashion,GB,active,2,Main,Retail,1\n');
  const list = await readList(listFile);
  assert.equal(list.length, 3);
  const { text } = render({ advs, list, archive: dir });
  assert.match(text, /111 Motor Shop: 2 car of 3 products/);
  assert.match(text, /https:\/\/ui\.awin\.com\/merchant-profile\/333/);
  assert.doesNotMatch(text, /merchant-profile\/111/);
  assert.match(text, /file on this PC: yes/);
});
