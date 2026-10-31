// Gaming feed scan (read-only): which feed products are for the planned Gaming Gear World (PGW), which belong to
// another Gear World site (toys, merchandise), which also fit the TGW rules (the TGW/PGW boundary), and which Awin
// programmes look like gaming retailers (not gambling).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { classify, isGamingProgramme, refreshHz, scanArchive, readList, render } from '../../tools/gaming-feed-scan.mjs';

const cat = (n, c = '') => { const r = classify(n, c); return r.sport ? r.cat : null; };
const ov = (n, c = '') => classify(n, c).overlap || null;

test('gaming products go to the proposed category', () => {
  assert.equal(cat('Sony PlayStation 5 Slim Console Digital Edition'), 'consoles');
  assert.equal(cat('Steam Deck OLED 512GB'), 'consoles');
  assert.equal(cat('Mario Kart World (Nintendo Switch 2)'), 'games-cards', 'a game, not a console');
  assert.equal(cat('PlayStation Store Gift Card £50'), 'games-cards');
  assert.equal(cat('Nintendo Switch Pro Controller'), 'controllers', 'a controller, not a console');
  assert.equal(cat('Razer Wolverine V3 Tournament Edition 8K PC Black USB Gamepad'), 'controllers');
  assert.equal(cat('Thrustmaster T248 Racing Wheel'), 'controllers');
  assert.equal(cat('Acer Nitro V 15 Gaming Laptop RTX 4050'), 'pcs-laptops');
  assert.equal(cat('Samsung Odyssey G5 27" QHD 165Hz'), 'monitors');
  assert.equal(cat('Iiyama 27" IPS Monitor 180Hz 1ms'), 'monitors', '144 Hz and more is a gaming screen');
  assert.equal(cat('GravaStar Mercury M1 Pro Gaming Mouse Wireless'), 'mice-keyboards');
  assert.equal(cat('SteelSeries Arctis Nova 7 Wireless'), 'headsets');
  assert.equal(cat('GTPLAYER Gaming Chair with Footrest'), 'chairs-desks');
  assert.equal(cat('Elgato Stream Deck MK.2'), 'streaming');
  assert.equal(cat('Blue Yeti USB Microphone'), 'streaming');
  assert.equal(cat('ASUS TUF Gaming GeForce RTX 4070 Ti SUPER 16GB'), 'components');
  assert.equal(cat('Corsair Vengeance 32GB (2 x 16GB) DDR5 6000'), 'components');
});

test('everyday tech stays on TGW; office, TV and printer products are not PGW products', () => {
  for (const n of ['Logitech Wireless Combo MK270', 'LG 27UL500 27" 4K 60Hz IPS Monitor', 'Dell Latitude 5440 Laptop i5', 'Samsung 55" QLED Smart TV 120Hz',
    'Office Chair Mesh Ergonomic', 'Cisco Catalyst 9200 Network Switch', 'HP 305 Black Ink Cartridge', 'Toner HP 26A', 'Monopoly Board Game']) {
    assert.equal(classify(n, '').sport, false, n);
  }
  assert.equal(refreshHz('Monitor 27" 240Hz (overclock 280 Hz)'), 280);
});

test('gaming toys and merchandise belong to other sites; gaming products that fit TGW are flagged', () => {
  assert.equal(ov('Xbox Logo T-Shirt'), 'merch');
  assert.equal(ov('PlayStation Controller Night Light'), null, 'the word controller keeps it out of merchandise (unless list)');
  assert.equal(ov('Nintendo Super Mario Plush Toy'), 'kids');
  assert.equal(classify('Sony PlayStation 5 Slim Console Digital Edition').also, 'tgw', 'the TGW rules also take consoles today');
});

test('Awin programmes that sell gaming products, not gambling', () => {
  for (const p of ['Scan Computers', 'Overclockers UK', 'GamingKit', 'Zavvi', 'CDKeys.com', 'Secretlab']) assert.ok(isGamingProgramme(p), p);
  for (const p of ['Sky Vegas Casino', 'Paddy Power Games', 'Bet365 Gaming', 'Mecca Bingo', 'Joybuy UK']) assert.ok(!isGamingProgramme(p), p);
});

test('scan: counts per retailer and category, toys apart, Awin list with links, no gambling', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gamingscan-'));
  const dir = join(root, 'GW_AWIN_NEW_20261031');
  mkdirSync(dir);
  const head = 'merchant_name,aw_product_id,product_name,search_price,currency,in_stock,stock_quantity,merchant_category\n';
  writeFileSync(join(dir, 'AWIN_111_1.csv.gz'), gzipSync(head
    + 'Game Shop,1,"SteelSeries Arctis Nova 7 Wireless Gaming Headset",179,GBP,1,3,Gaming\n'
    + 'Game Shop,2,"Razer DeathAdder V3 Gaming Mouse",59,GBP,1,0,Gaming\n'
    + 'Game Shop,3,"Nintendo Super Mario Plush Toy",19,GBP,1,2,Gaming\n'
    + 'Game Shop,4,"Garden Hose 30m",19,GBP,1,9,Garden\n'));
  const { advs, files } = await scanArchive({ archives: [dir], now: Date.now() });
  const a = advs.find(x => x.advertiserId === 111);
  assert.equal(a.products, 4);
  assert.equal(a.sport, 2);
  assert.equal(a.sportInStock, 1, 'the mouse with quantity 0 is out of stock (L64)');
  assert.equal(a.cats.headsets, 1);
  assert.equal(a.overlaps.kids, 1);
  const listFile = join(root, 'list.csv');
  writeFileSync(listFile, 'Advertiser ID,Advertiser Name,Primary Region,Membership Status,Feed ID,Feed Name,Vertical,No of products\n'
    + '111,Game Shop,GB,active,1,Main,Retail,4\n'
    + '15473,Scan Computers,GB,notjoined,7,Main,Electronics,40000\n'
    + '444,Sky Vegas Casino,GB,notjoined,8,Games,Gaming,10\n');
  const list = await readList(listFile);
  const { text } = render({ advs, files, list, archives: [dir] });
  assert.match(text, /^GAMING FEED SCAN \(read-only\) - for Gaming Gear World \(gaminggearworld\.com, code PGW\)/);
  assert.match(text, /111 Game Shop: 2 gaming of 4 products/);
  assert.match(text, /Toys, figures & board games \(Kids' Gear World, KGW\)\s+1/);
  assert.match(text, /https:\/\/ui\.awin\.com\/merchant-profile\/15473/);
  assert.doesNotMatch(text, /merchant-profile\/444/, 'a casino is not a gaming retailer');
  assert.match(text, /apply later WITH gaminggearworld\.com/);
  assert.doesNotMatch(text, /otorbike|Biker|bikergearworld/, 'no text of another site (L01)');
});
