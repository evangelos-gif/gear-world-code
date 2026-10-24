// Technology Gear World: the check of the live site after the second import (24 Oct 2026, lessons L51). The new count of
// "business words" in the dry-run report showed consumer products that those words were stopping, and the live database
// showed server disks and a few business devices that came in with the "Serial ATA" disks, and hard disks at prices far
// above the usual. Every name below is a real name from the report or the live site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { hddCapacityTb, planImport, sourceFilter } from '../../tools/tgw-import-plan.mjs';
import { classify } from '../../sites/tgw/category-rules.js';

const SOURCES = JSON.parse(readFileSync(new URL('../../sites/tgw/sources.json', import.meta.url), 'utf8')).sources;
const PCHUB = SOURCES.find(s => s.advertiserId === 126641);
const BTTO = SOURCES.find(s => s.advertiserId === 61655);
const PS = 'Default Category>Personal Stock';
const where = (n, p = 'Computers') => { const c = classify(n, p); return c.ok ? c.slug : `REJECT ${c.reason}`; };
const denied = (s, n) => new RegExp(s.denyNames.join('|'), 'i').test(n);

test('server disks and business devices that came in with the Serial ATA disks are out in both shops', () => {
  for (const n of ['DELL 345-BGVL internal solid state drive 960 GB 2.5" Serial ATA', 'DELL 400-AUST internal hard drive 2 TB 7200 RPM 3.5" Serial ATA',
    'Lenovo 4XB7A90875 internal solid state drive 1.92 TB 2.5" Serial ATA III V-NAND TLC', 'DELL S4520 3.84 TB 2.5" Serial ATA III',
    'Western Digital DC HC590 internal hard drive 24 TB 7200 RPM 3.5" Serial ATA', 'Synology SAT5210 7 TB 2.5" Serial ATA III',
    'Synology SAT5221-960G internal solid state drive 960 GB 2.5" Serial ATA III', 'Synology SNV5420-1600G internal solid state drive 1.6 TB M.2 PCI Express 4.0 NVMe',
    'Synology DP340 NAS/storage server Desktop R1600 16 GB 32 TB HDD Black', 'Canon imageFORMULA CR-120 600 x 600 DPI Black',
    'Canon imageFORMULA CR-L1 300 x 300 DPI Black, Grey', 'Brother TJ4021TN label printer Direct thermal / Thermal transfer 203 x 203 DPI 254 mm/sec Wired Ethernet LAN',
    'Brother RJ-4250WB label printer 203 x 203 DPI 127 mm/sec Wired & Wireless Wi-Fi Bluetooth']) {
    for (const s of [BTTO, PCHUB]) assert.ok(denied(s, n), `${s.retailer}: ${n}`);
  }
  for (const n of ['DELL 460-BBUL laptop case 35.6 cm (14") Briefcase Black', 'Synology DS925+ 32TB (Synology HAT33) 4 bay desktop NAS; AMD Ryzen (DS925+/32TB-HAT33)',
    'Synology SNV3410-400G internal solid state drive M.2 400 GB PCI Express 3.0 NVMe', 'Canon imageFORMULA R40 Sheet-fed scanner 600 x 600 DPI A4 Black',
    'Brother QL-800 label printer Direct thermal Colour 300 x 600 DPI 148 mm/sec Wired DK', 'Samsung 870 EVO 1 TB 2.5" Serial ATA III V-NAND MLC']) {
    for (const s of [BTTO, PCHUB]) assert.ok(!denied(s, n), `${s.retailer}: ${n}`);
  }
});

test('consumer products the business words were stopping are in, on the right page', () => {
  const cases = [
    ['Targus Privacy Screen 22"W (16:10)', 'Targus', 'accessories-storage'],
    ['Fellowes PrivaScreen 35.6 cm (14") Laptop Frameless display privacy filter', 'Fellowes', 'accessories-storage'],
    ['PanzerGlass ® Privacy Screen Protector iPhone 11 Pro | X | Xs (P2664)', 'PanzerGlass', 'accessories-storage'],
    ['Lenovo 57Y4303 cable lock Black, Silver 1.52 m', 'Lenovo', 'accessories-storage'],
    ['Fellowes Office Suites Laptop Riser', 'Fellowes', 'accessories-storage'],
    ['SanDisk Cruzer Blade USB flash drive 64 GB USB Type-A 2.0 Black, Red', 'SanDisk', 'accessories-storage'],
    ['HP E24mv G4 FHD Conferencing Monitor', 'HP', 'laptops-computing'],
    ['TP-Link UE300 network card Ethernet 1000 Mbit/s', 'TP-Link', 'smart-home-wifi'],
    ['TP-Link TL-WN823N network card WLAN 300 Mbit/s', 'TP-Link', 'smart-home-wifi'],
    ['Logitech Rugged Combo 3 Keyboard Case for iPad (7th, 8th, & 9th generation)', 'Logitech', 'accessories-storage'],
    ['Apple MR2Q3ZM/A watch part/accessory Watch strap', 'Apple', 'accessories-storage'],
    ['TP-Link TL-SF1016 Unmanaged Fast Ethernet (10/100) 1U Black', 'TP-Link', 'smart-home-wifi'],
    ['TP-Link 24-port 10/100Mbps Desktop/Rackmount Network Switch', 'TP-Link', 'smart-home-wifi']
  ];
  for (const s of [BTTO, PCHUB]) {
    const f = sourceFilter(s);
    for (const [n, b] of cases) assert.equal(f(n, b, s === PCHUB ? PS : ''), '', `${s.retailer}: ${n}`);
  }
  for (const [n, , slug] of cases) assert.equal(where(n), slug, n);
  // PCHUB.UK leaves "Managed" switches in too, as Back to the Office does
  assert.equal(sourceFilter(PCHUB)('TP-Link TL-SG1024DE network switch Managed L2 Gigabit Ethernet', 'TP-Link', PS), '');
});

test('the business products behind those words stay out', () => {
  for (const s of [BTTO, PCHUB]) {
    for (const n of ['Intel CYP2URISER3STD interface cards/adapter Internal PCIe', 'DELL PowerEdge R740 Riser 2 Kit', 'Intel X710-DA2 network card Internal Fiber 10000 Mbit/s',
      'Synology RackStation RS1221+ NAS/storage server Rack (2U) Ryzen V1500B Black', 'Poly Studio G62 Video Conferencing System With Mounting Plate Kit',
      'Panasonic Toughbook 40 rugged laptop', 'HP CE988-67903 part/accessory Transfer roller', 'DELL 412-AAMT computer cooling system part/accessory Radiator block', 'Lenovo ThinkSmart Hub', 'Microsoft Windows Server 2022 - License - 5 User CAL',
      'TP-Link Omada 10-Port Gigabit Smart Switch with 8-Port PoE+', 'Brother DK-11201 labels']) {
      assert.ok(denied(s, n), `${s.retailer}: ${n}`);
    }
  }
});

test('a hard disk priced far above the usual is left out; external disks, SSDs and NAS bundles are not checked', async () => {
  assert.equal(hddCapacityTb('Western Digital WD80EFPX internal hard drive 8 TB 5640 RPM 256 MB 3.5" Serial ATA'), 8);
  assert.equal(hddCapacityTb('Seagate Barracuda Desktop 24TB HDD internal hard drive 7200 RPM 512 MB 3.5" Serial ATA'), 24);
  assert.equal(hddCapacityTb('LaCie d2 Professional external hard drive 16 TB 7200 RPM 3.2 Gen 1 (STHA16000800)'), 0);
  assert.equal(hddCapacityTb('Samsung 870 EVO 4 TB 2.5" Serial ATA III V-NAND MLC'), 0);
  assert.equal(hddCapacityTb('Synology DS423 NAS Realtek RTD1619B 2 GB DDR4 48 TB HDD DiskStation (DS423/48TB-HAT53)'), 0);

  const dir = mkdtempSync(join(tmpdir(), 'tgw-l51-'));
  const arc = join(dir, 'arc');
  mkdirSync(arc);
  const header = ['aw_deep_link', 'product_name', 'aw_product_id', 'merchant_product_id', 'merchant_image_url', 'merchant_category', 'search_price', 'brand_name', 'stock_quantity'];
  const line = v => v.map(x => (/[",\n]/.test(x) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(',');
  const link = id => `https://www.awin1.com/pclick.php?p=${id}&a=1&m=61655`;
  const rows = [
    ['Western Digital WD80EFPX internal hard drive 8 TB 5640 RPM 256 MB 3.5" Serial ATA', '838.99', 'Western Digital'],
    ['Western Digital Red Pro WD221KFGX internal hard drive 22 TB 7200 RPM 512 MB 3.5" Serial ATA', '2880.99', 'Western Digital'],
    ['Seagate IronWolf Pro ST16000NT001 internal hard drive 16 TB 7200 RPM 256 MB 3.5" Serial ATA III', '714.99', 'Seagate'],
    ['Seagate Barracuda ST2000DM008 internal hard drive 2 TB 7200 RPM 256 MB 3.5" Serial ATA III', '141.99', 'Seagate'],
    ['LaCie d2 Professional external hard drive 16 TB 7200 RPM 3.2 Gen 1 (3.1 Gen 1) Black', '900.00', 'LaCie']
  ].map(([n, price, brand], i) => [link(i + 1), n, String(i + 1), `B-${i + 1}`, `https://img.example/${i + 1}.jpg`, 'Computers', price, brand, '3']);
  writeFileSync(join(arc, 'AWIN_61655_102827.csv.gz'), gzipSync(Buffer.from([line(header), ...rows.map(line)].join('\n') + '\n')));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: [{ ...BTTO }] }));
  const out = join(dir, 'out');
  mkdirSync(out);
  const { products } = await planImport({ archive: arc, sourcesFile, outDir: out, now: new Date('2026-10-24T22:00:00Z') });
  assert.deepEqual(products.map(p => p.merchant_product_id).sort(), ['B-3', 'B-4', 'B-5']);
  assert.match(readFileSync(join(out, 'report.txt'), 'utf8'), /price far above the usual for this hard disk +2/);
});
