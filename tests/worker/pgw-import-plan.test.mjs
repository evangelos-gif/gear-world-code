// Gaming Gear World import plan (dry run): PGW rules on fake feeds, the TGW shop filters (consumer brands and folders,
// lessons L45-L54), and the look-alikes of the two gaming feed scans of 31 Oct 2026 out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planPgwImport } from '../../tools/pgw-import-plan.mjs';
import { classify, cleanProductName, CATEGORY_SLUGS } from '../../sites/pgw/category-rules.js';

const slug = (n, c = '') => classify(cleanProductName(n), c, c).slug;
const ok = (n, c = '') => classify(cleanProductName(n), c, c).ok;

test('PGW rules put real products of the second scan (31 Oct 2026) in the right category', () => {
  for (const [name, s] of [
    ['Sony PlayStation 5 Console, Digital Edition, Slim Version', 'consoles'],
    ['ASUS ROG Ally Hand Held Game Console (RC71L-NH001W)', 'consoles'],
    ['Trust GXT 1253 Silicone grip case for Nintendo Switch 2 - Black', 'consoles'],
    ['Seagate Game Drive PS5 NVMe 1 TB M.2 PCI Express 4.0 3D TLC', 'consoles'],
    ['Marvel\'s Wolverine - PS5', 'games-cards'],
    ['Warner Bros Mortal Kombat 11 Ultimate English Xbox One', 'games-cards'],
    ['Nintendo Amiibo Inkling Squid Interactive gaming figure', 'games-cards'],
    ['PlayStation 5 DualSense Wireless Controller - White', 'controllers'],
    ['Logitech G Driving Force Shifter', 'controllers'],
    ['Lenovo Legion 5 16IRX9 16" Laptop (83DG00DSUK) - Intel Core i7-14650HX, 16GB RAM', 'pcs-laptops'],
    ['Alienware Aurora ACT1250 Intel Core Ultra 9 285K 32 GB DDR5-SDRAM 2 TB', 'pcs-laptops'],
    ['Samsung 27" Full HD 240Hz Monitor (LS27BG400EU)', 'monitors'],
    ['Alienware 27 Gaming Monitor AW2724HF 27" FHD 360Hz Fast IPS', 'monitors'],
    ['Razer Huntsman Mini (Red Switch, UK Layout) - RZ03-03391800-R3W1', 'mice-keyboards'],
    ['Logitech G G213 Prodigy Gaming Keyboard', 'mice-keyboards'],
    ['Corsair HS80 RGB USB Headset Wired Handheld Gaming Carbon', 'headsets'],
    ['Razer Leviathan V2 X PC Gaming Soundbar, Black', 'headsets'],
    ['Razer Iskur V2 Gaming armchair Padded seat Black', 'chairs-desks'],
    ['Arozzi Arena Gaming Desk - Frozen Grey', 'chairs-desks'],
    ['Logitech G Blue Yeti Nano USB Mic', 'streaming'],
    ['Razer Kiyo webcam 4 MP 2688 x 1520 pixels USB Black', 'streaming'],
    ['AMD Ryzen 5 5600X processor 3.7 GHz 32 MB L3 Box', 'components'],
    ['GIGABYTE GeForce RTX 5080 WINDFORCE OC SFF 16G', 'components'],
    ['Fractal Design Focus 2 RGB Black Gaming PC Case', 'components'],
    ['Cooler Master Case TD500 Mesh V2 White', 'components']
  ]) assert.equal(slug(name), s, name);
});

test('PGW rules leave out OEM parts, repair parts, bags, board games and look-alikes', () => {
  for (const [name, cat] of [
    ['DELL 305W Power Supply. PFC.', ''],
    ['StarTech.com Replacement 70mm TX3 Dual Ball Bearing CPU Cooler Fan', ''],
    ['Hypertec FDEL-K40 computer case part Universal HDD Cage', ''],
    ['BAQ For Xbox One X | HDMI Redriver | TDP158', ''],
    ['BTI 86Wh 8 cell HSTNN-LB7B compatible battery for HP - COMPAQ OMEN 17-', ''],
    ['Marvo Scorpion BA-002 Ranger 600G Waterproof 15.6 Inch Gaming Laptop Backpack', ''],
    ['DeWalt Akku-Kit (2x 18 V/5Ah PS plus DCB1104)', ''],
    ['VEVOR Air-Powered Hockeytafel, Indoor Hockeytafel voor Kinderen', ''],
    ['VoxorAI XH12 Silver AI Translator Earbuds, Real-Time Translation', ''],
    ['Gaming Night Poker Chip Set 500 pcs', 'Toys & Games > Games > Poker Chips & Sets'],
    ['Family Strategy Board Game for Gamers', 'Toys & Games > Games > Board Games'],
    ['Xbox Logo T-Shirt', ''],
    ['Logitech Wireless Combo MK270', ''],
    ['Dell Latitude 5440 Laptop i5', '']
  ]) assert.equal(ok(name, cat), false, name);
});

test('a shop section that says gaming gives the gaming context (Plusshop UK, Bazta UK)', () => {
  assert.equal(classify('White Shark Charging Dock Black', 'Game Console', 'Game Console').ok, false, 'no console name, no gaming word: not enough');
  assert.equal(classify('Dual Charging Dock for PS5 Controllers', 'Game Console', 'Game Console').slug, 'controllers');
  assert.equal(classify('Mouse Pad XXL', '', '').ok, false);
  assert.equal(classify('Mouse Pad XXL', 'Computer & gaming accessories', 'Computer & gaming accessories').slug, 'mice-keyboards');
});

test('fixes after the first dry run (31 Oct 2026, real Joybuy names: games in "Board Games", sports cams with "60FPS")', () => {
  const games = 'Toys & Games > Games > Board Games';
  for (const [n, c, s] of [
    ['Star Wars Outlaws (Xbox Series X)', games, 'games-cards'],
    ['Electronic Arts Madden NFL: 22 (Xbox One/Xbox Series X)', games, 'games-cards'],
    ['Activision Call of Duty: Black Ops 7 - Cross-Gen Bundle - Xbox Series X and Xbox One', games, 'games-cards'],
    ['Xbox Series S 512GB Console - White', '', 'consoles'],
    ['HORI Dual USB PlayStand for Nintendo Switch 2', '', 'consoles'],
    ['Lexar PLAY PRO MicroSDXC Express Card 512GB for Nintendo Switch 2', '', 'consoles'],
    ['EasySMX D10 PC Controller Video Game Gamepad - Elite Wireless BT Gamepad with TMR', '', 'controllers'],
    ['Turtle Beach VelocityOne Race Wheel & Pedal System for Xbox & Windows 10/11', 'Toys & Games > Games > Roulette Wheels & Sets', 'controllers'],
    ['Turtle Beach Stealth 600 Wireless Gaming Headset GEN3 PS - White', '', 'headsets']
  ]) assert.equal(classify(n, c, c).slug, s, n);
  for (const n of ['XbotGo Chameleon AI Team Sports Action Cam 4K 60FPS', 'nubia Z80 Ultra 5G Unlocked Android Gaming Phone', 'Fanttik S1 Pro Electric Screwdriver for Gaming Console Repair']) {
    assert.equal(classify(n, '', '').ok, false, n);
  }
  const pchub = JSON.parse(readFileSync('sites/pgw/sources.json', 'utf8')).sources.find(s => s.retailer === 'PCHUB.UK');
  assert.ok(pchub.allowPaths.includes('Gaming & Gadgets'), 'PCHUB\'s own gaming folder');
});

test('10 categories, as the owner chose (31 Oct 2026)', () => {
  assert.deepEqual(CATEGORY_SLUGS, ['games-cards', 'controllers', 'consoles', 'pcs-laptops', 'monitors', 'mice-keyboards', 'headsets', 'chairs-desks', 'streaming', 'components']);
});

test('sources: the TGW shops with their filters, GamingKit and VEVOR off (L63, L79), no text of another site', () => {
  const src = JSON.parse(readFileSync('sites/pgw/sources.json', 'utf8')).sources;
  assert.deepEqual(src.filter(s => s.approved).map(s => s.retailer), ['Joybuy', 'Back to the Office', 'PCHUB.UK', 'PcNova (IT-Supplies)', 'Plusshop UK', 'Bazta UK']);
  assert.equal(src.find(s => s.retailer === 'GamingKit').approved, false);
  assert.equal(src.find(s => s.retailer === 'VEVOR').approved, false);
  assert.equal(src.find(s => s.retailer === 'PcNova (IT-Supplies)').rulesFrom, 126641);
  const pchub = src.find(s => s.retailer === 'PCHUB.UK');
  assert.ok(pchub.denyPaths.includes('Spare Parts') && pchub.brands.includes('Arozzi') && pchub.allowPaths.includes('Gaming Chairs'));
  assert.doesNotMatch(readFileSync('sites/pgw/sources.json', 'utf8'), /Biker|bikergearworld|motorbike/i, 'lessons L01');
});

test('plan: PGW products in, office products and out-of-stock rows out, SQL not executed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pgw-plan-'));
  const a = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(a);
  const out = join(dir, 'out');
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean\n';
  const link = (p, m) => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=${m}`;
  writeFileSync(join(a, 'AWIN_123932_114093.csv.gz'), gzipSync(head
    + `${link(1, 123932)},Sony PlayStation 5 Console Digital Edition Slim Version,1,J-1,https://img.example/1.jpg,Electronics > Video Game Consoles,519.99,GBP,Sony,1,\n`
    + `${link(2, 123932)},Turtle Beach Recon 50P Headset Wired Gaming Headset - PS5,2,J-2,https://img.example/2.jpg,Electronics > Audio,16.39,GBP,Turtle Beach,1,\n`
    + `${link(3, 123932)},Office Chair Mesh Ergonomic,3,J-3,https://img.example/3.jpg,Furniture > Office Chairs,59,GBP,Generic,1,\n`
    + `${link(4, 123932)},Razer DeathAdder V3 Gaming Mouse,4,J-4,https://img.example/4.jpg,Electronics > Computers,59,GBP,Razer,0,\n`));
  const sources = join(dir, 'sources.json');
  writeFileSync(sources, JSON.stringify({ sources: [{ advertiserId: 123932, feedIds: [114093], retailer: 'Joybuy', currency: 'GBP', approved: true }] }));
  const { stats, report } = await planPgwImport({ archive: a, sourcesFile: sources, outDir: out, now: new Date('2026-10-31T19:30:00Z') });
  assert.equal(stats.rows, 4);
  assert.equal(stats.accepted, 2);
  assert.equal(stats.perCategory.consoles, 1);
  assert.equal(stats.perCategory.headsets, 1);
  assert.equal(stats.rejected['out of stock'], 1);
  assert.match(report, /PGW IMPORT PLAN/);
  const sql = readFileSync(join(out, 'sql', readdirSync(join(out, 'sql')).find(f => f === '0001.sql')), 'utf8');
  assert.match(sql, /-- PGW import plan .* NOT executed/);
});
