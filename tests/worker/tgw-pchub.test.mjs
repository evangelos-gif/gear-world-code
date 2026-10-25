// Technology Gear World: PCHUB.UK (Awin 126641) as a third shop (24 Oct 2026, lessons L45). A trade catalogue of 228,274
// rows: only consumer folders and brands, names the feed cut at 70 characters, an rrp_price that is always price x 1.44 and
// "image coming soon" pictures. Names and folders are from the awin-feed-sample report of 23 Oct 2026 (feed 115609).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planImport, sourceFilter, looseOnly, cutToWord, PLACEHOLDER_IMAGE, garbledName, partsFolder, findDuplicates, nameKey } from '../../tools/tgw-import-plan.mjs';
import { classify } from '../../sites/tgw/category-rules.js';

const SOURCES = JSON.parse(readFileSync(new URL('../../sites/tgw/sources.json', import.meta.url), 'utf8')).sources;
const PCHUB = SOURCES.find(s => s.advertiserId === 126641);
const BTTO = SOURCES.find(s => s.advertiserId === 61655);
const D = 'Default Category';

test('PCHUB.UK is a TGW source: consumer folders, consumer brands and no business IT', () => {
  assert.ok(PCHUB && PCHUB.approved);
  assert.deepEqual(PCHUB.feedIds, [115609]);
  assert.equal(PCHUB.retailer, 'PCHUB.UK');
  assert.deepEqual(PCHUB.brands, BTTO.brands, 'the same consumer brand list as Back to the Office');
  const f = sourceFilter(PCHUB);
  const keep = [
    ['Logitech Mouse M90', 'Logitech', `${D}>Peripherals>Mouses`],
    ['TP-Link Archer C50 wireless router Fast Ethernet Dual-band', 'TP-Link', `${D}>Networking>Networking>Network Service Equipment>wireless routers>${D}>Personal Stock`],
    ['Lenovo ThinkPad T14 Gen 3 (Intel) Intel® Core™ i5 i5-1235U Laptop', 'Lenovo', `${D}>Laptops>Laptops & Notebooks`],
    ['Samsung Galaxy Tab S9 SM-X710N Snapdragon 128 GB 27.9 cm (11")', 'Samsung', `${D}>Laptops>Tablets & Accessories>Tablets`],
    ['D-Link 16-Port Gigabit Unmanaged Desktop Switch', 'D-Link', `${D}>Networking>Switches`],
    ['SanDisk ULTRA FLAIR USB flash drive 16 GB USB Type-A 3.2 Gen 1', 'Sandisk', `${D}>Storage>USB Flash Drives>${D}>Direktek`],
    ['Fractal Design Core 1100 Mini Tower Black', 'Fractal Design', `${D}>PC Components>Cases & Cooling>Cases & Parts`],
    // Owner, 24 Oct 2026: as many as possible, if safe. Genuine toner and ink, laptop chargers and camera mounts are in.
    ['HP 643A toner cartridge Original Yellow', 'HP', `${D}>Consumables>Toner Cartridges>Laser Toner & Cartridges`],
    ['HP AC 65W power adapter/inverter Indoor Black', 'HP', `${D}>Power Conditioning>Batteries & Accessories>Power Adapters & Inverters`],
    ['Arlo Ceiling Adapter Floodlight Mount FBA1001-10000S', 'Arlo', `${D}>Audio Visual>Cameras & Camcorders`]
  ];
  for (const [n, b, p] of keep) assert.equal(f(n, b, p), '', n);
  const out = [
    ['STATUS 700W Carbon Fibre Element Patio Heater', 'STATUS', `${D}>PC Components>Other>${D}>Personal Stock`, 'brand not on the consumer list (PCHUB.UK)'],
    ['Hypertec HYCFM00000 card reader Internal Metallic', 'Hypertec', `${D}>Storage>Data Storage>Card Readers`, 'brand not on the consumer list (PCHUB.UK)'],
    ['HP Drum Color Imge Uni Cyn', 'HP', `${D}>PC Components>Other`, 'business IT, parts or services (PCHUB.UK)'],
    ['HP Q3931-67915 fuser', 'HP', `${D}>Peripherals>Printers & Accessories>Print & Scan Accessories>Spare Parts`, 'feed folder not for TGW (PCHUB.UK)'],
    ['Canon QY6-0068 Printhead for Pixma IP 100/ 100 Portable/ V', 'Canon', `${D}>Consumables>Others>Print Heads`, 'feed folder not for TGW (PCHUB.UK)'],
    ['HP 610913-B31 laptop spare part Keyboard', 'HP', `${D}>Laptops>Laptop Spare Parts`, 'feed folder not for TGW (PCHUB.UK)'],
    ['Targus Privacy Screen 14.1"W 35.8 cm (14.1")', 'Targus', `${D}>Monitor & TV's>Accessories>Privacy Filters`, 'feed folder not for TGW (PCHUB.UK)'],
    ['Hypertec GEN8-2.5TRAY computer case part HDD Cage', 'Hypertec', `${D}>PC Components>Cases & Cooling>Cases & Parts>Case Parts`, 'feed folder not for TGW (PCHUB.UK)'],
    ['Jabra A Ear Pads', 'Jabra', `${D}>Audio Visual>AV & Accessories>Televisions & Accessories>audio equipment parts & accessories>Portable Audio`, 'feed folder not for TGW (PCHUB.UK)'],
    ['Hypertec HYSDC0304G memory card 4 GB SD', 'Hypertec', `${D}>Storage>Memory Cards`, 'brand not on the consumer list (PCHUB.UK)'],
    ['AG Neovo TM-23 computer monitor 58.4 cm (23") 1920 x 1080 pixels', 'AG Neovo', `${D}>Monitor & TV's>Monitors`, 'brand not on the consumer list (PCHUB.UK)'],
    ['DELL 37MGT internal hard drive 2 TB 7200 RPM 3.5" NL-SAS', 'Dell', `${D}>Storage>Internal Hard Drives`, 'business IT, parts or services (PCHUB.UK)'],
    ['Synology RackStation RS3618xs NAS Rack (2U) Intel® Xeon® D D-1521 8 GB', 'Synology', `${D}>Storage>NAS & Storage Servers`, 'business IT, parts or services (PCHUB.UK)'],
    ['Hypertec HYMAS7401G (Legacy) memory module 1 GB 1 x 1 GB DDR2 667 MHz', 'Lenovo', `${D}>PC Components>Components>Memory Modules`, 'business IT, parts or services (PCHUB.UK)']
  ];
  for (const [n, b, p, why] of out) assert.equal(f(n, b, p), why, n);
  // Back to the Office has no folder lists: its filter is as before.
  assert.equal(sourceFilter(BTTO)('Logitech Speakers S150', 'Logitech'), '');
});

test('PCHUB.UK catch-all folders ("PC Components>Other"): in only when the name alone says what tech product it is', () => {
  const f = sourceFilter(PCHUB);
  assert.equal(looseOnly(PCHUB, `${D}>PC Components>Other`), true);
  assert.equal(looseOnly(PCHUB, `${D}>Storage>USB Flash Drives>${D}>Direktek`), false, 'an allowed folder decides, not the catch-all one');
  assert.equal(looseOnly(BTTO, 'Computers'), false);
  const where = n => { const c = classify(n, ''); return c.ok ? c.slug : `REJECT ${c.reason}`; };
  assert.equal(f('Epson FRME LEF', 'Epson', `${D}>PC Components>Other`), '');
  assert.equal(where('Epson FRME LEF'), 'REJECT not tech', 'a cryptic part name is not a product');
  // "Canon RUER MOUN" (rubber mount, every a, b and t missing) is out before it is classified (lessons L47).
  assert.equal(f('Canon RUER MOUN', 'Canon', `${D}>PC Components>Other`), 'name with letters missing (PCHUB.UK)');
  assert.equal(where('Canon RUER MOUN'), 'REJECT not tech');
  assert.equal(f('Logitech MX Master 3S Performance Wireless Mouse Graphite', 'Logitech', `${D}>PC Components>Other>${D}>Personal Stock`), '');
  assert.equal(where('Logitech MX Master 3S Performance Wireless Mouse Graphite'), 'laptops-computing');
});

test('PCHUB.UK names cut at 70 characters lose the cut word, a dangling separator and an unclosed bracket', () => {
  assert.equal(cutToWord('StarTech.com 75ft CAT6 Ethernet Cable - Red CAT 6 Gigabit Ethernet Wir'), 'StarTech.com 75ft CAT6 Ethernet Cable - Red CAT 6 Gigabit Ethernet');
  assert.equal(cutToWord('TP-Link Archer C50 wireless router Fast Ethernet Dual-band (2.4 GHz /'), 'TP-Link Archer C50 wireless router Fast Ethernet Dual-band');
  assert.equal(cutToWord('Lenovo ThinkPad T14 Gen 3 (Intel) Intel® Core™ i5 i5-1235U Laptop 35.6'), 'Lenovo ThinkPad T14 Gen 3 (Intel) Intel® Core™ i5 i5-1235U Laptop');
  assert.equal(cutToWord('Samsung Galaxy Tab S9 SM-X710N Snapdragon 128 GB 27.9 cm (11") 8'), 'Samsung Galaxy Tab S9 SM-X710N Snapdragon 128 GB 27.9 cm (11")');
  assert.equal(cutToWord('SanDisk ULTRA FLAIR USB flash drive 16 GB USB Type-A 3.2 Gen 1 (3.1 Ge'), 'SanDisk ULTRA FLAIR USB flash drive 16 GB USB Type-A 3.2 Gen 1');
  assert.equal(cutToWord('Acer Veriton 2000 (VZ2524G) Intel Core Ultra 5 125U. 8GB. 512GB SSD. 2'), 'Acer Veriton 2000 (VZ2524G) Intel Core Ultra 5 125U. 8GB. 512GB SSD');
  assert.equal(cutToWord('Fellowes Computer Monitor Stand with 5 Height Adjustments - Office Sui'), 'Fellowes Computer Monitor Stand with 5 Height Adjustments - Office');
  assert.equal(cutToWord('Logitech'), 'Logitech', 'a one-word name stays');
});

test('PCHUB.UK products land on the right TGW page (name and feed folder)', () => {
  const where = (n, p) => { const c = classify(n, p); return c.ok ? c.slug : `REJECT ${c.reason}`; };
  assert.equal(where('Fractal Design Core 1100 Mini Tower Black', `${D}>PC Components>Cases & Cooling>Cases & Parts`), 'laptops-computing');
  assert.equal(where('Apple MQEH3ZM/A Smart Wearable Accessories Band Beige. Yellow Nylon', `${D}>Storage>Telecom & Navigation>Telecommunication Equipment Accessories>smartwatch accessories`), 'accessories-storage', 'a band, not a watch');
  assert.equal(where('DELL Simple E-Port II Docking Black', `${D}>Laptops>Docks & Port Replicators`), 'accessories-storage');
  assert.equal(where('DELL EURO Simple E-Port II Docking Black', `${D}>Laptops>Docks & Port Replicators`), 'REJECT not for UK buyers (plug or keyboard layout)', 'a European power cord (lessons L48)');
  assert.equal(where('Samsung Galaxy Watch4 Classic 3.56 cm (1.4") OLED 46 mm Digital', `${D}>Peripherals>Smart Watches>Smart Watches`), 'phones-smartwatches');
  assert.equal(where('Canon MAXIFY MB2150 Inkjet A4 600 x 1200 DPI 19 ppm Wi-Fi', `${D}>Peripherals>Printers & Accessories>Multifunctional Printer`), 'laptops-computing');
  assert.equal(where('Samsung EF-QG955 mobile phone case 15.8 cm (6.2") Cover Black', `${D}>Storage>Telecom & Navigation>Mobile & Accessories>Cases & Covers`), 'accessories-storage');
  assert.equal(where('Epson EB-685W', `${D}>Audio Visual>Projectors>Data Projectors`), 'tv-home-cinema');
  assert.equal(where('Logitech ClearChat Comfort Headset Wired Head-band Calls/Music Black', `${D}>Headsets`), 'audio');
  assert.equal(where('Apple iPhone 12 mini 256GB - Blue', `${D}>Storage>Telecom & Navigation>Mobile & Accessories>Smartphones`), 'phones-smartwatches');
  assert.equal(where('TP-Link Archer C50 wireless router Fast Ethernet Dual-band', `${D}>Networking>Networking>Network Service Equipment>wireless routers`), 'smart-home-wifi');
});

// The first TGW dry run with PCHUB.UK (24 Oct 2026, the owner's report): what was still let in or on the wrong page.
test('PCHUB.UK dry-run fixes: business projectors, hotel TVs, photo paper, call-centre headsets and OEM power supplies out', () => {
  const f = sourceFilter(PCHUB);
  const business = 'business IT, parts or services (PCHUB.UK)';
  assert.equal(f('Epson Premium Glossy Photo Paper Roll. 24" x 30.5 m. 170g/m2', 'Epson', `${D}>Audio Visual>Cameras & Camcorders>Photo & Video Accessories`), business);
  assert.equal(f('Canon MP-101 Matte Photo Paper A3 - 40 Sheets', 'Canon', `${D}>Audio Visual>Cameras & Camcorders>Photo & Video Accessories`), business);
  assert.equal(f('Epson EB-PU1007B', 'Epson', `${D}>Audio Visual>Projectors>Data Projectors`), 'feed folder not for TGW (PCHUB.UK)');
  assert.equal(f('LG 32LN661H hospitality TV 81.3 cm (32") HD Smart TV Black 10 W', 'LG', `${D}>Audio Visual>AV & Accessories>Televisions & Accessories>Televisions`), business);
  assert.equal(f('Jabra BIZ 2300 Duo. USB. MS', 'Jabra', `${D}>Headsets`), business);
  assert.equal(f('Jabra GN2100 Telecoil MS', 'Jabra', `${D}>Headsets`), business);
  assert.equal(f('DELL WU136 power supply unit 235 W', 'Dell', `${D}>Power Conditioning>Batteries & Accessories>Power Supply Units`), business);
  assert.equal(f('Corsair RM850x power supply unit 850 W', 'Corsair', `${D}>Power Conditioning>Batteries & Accessories>Power Supply Units`), '');
  assert.equal(f('Samsung Odyssey G8 QD-OLED Monitor', 'Samsung', `${D}>Monitor & TV's>Monitors`), '', 'QD-OLED is a monitor panel, not a QD headset');
  assert.equal(f('Logitech G PRO X Gaming Headset', 'Logitech', `${D}>Headsets`), '');
  const where = (n, p = 'Computers') => { const c = classify(n, p); return c.ok ? c.slug : `REJECT ${c.reason}`; };
  assert.equal(where('Belkin F7U017bt Passive holder Mobile phone/Smartphone Black, Silver'), 'accessories-storage');
  assert.equal(where('Kensington Car Mount for Smartphones'), 'accessories-storage');
  assert.equal(where('Belkin Boost Charge Smartphone Black Cigar lighter Auto'), 'accessories-storage');
  assert.equal(where('InvisibleShield Glass Elite Apple iPhone 17e/16e/14/13/13 Pro'), 'accessories-storage');
  assert.equal(where('DJI OM 5 Smartphone camera stabilizer Grey', `${D}>Audio Visual>Cameras & Camcorders>Photo & Video Accessories`), 'cameras-drones');
  assert.equal(where('Apple iPhone 15 6.1" 5G Smartphone (MTP93ZD/A) - 256GB, Blue'), 'phones-smartwatches');
  assert.equal(where('ARCTIC Alpine 23 CO - Compact AMD CPU-Cooler for continuous operation'), 'laptops-computing');
  assert.equal(where('ARCTIC MX-4 Highest Performance Thermal Compound'), 'laptops-computing');
  assert.equal(where('Kingston Technology DataTraveler 64GB USB-C 3.2 Gen 1'), 'accessories-storage');
});

// Owner, 24 Oct 2026: as many products as possible, if safe. The new folders land on the right page.
test('PCHUB.UK wider rules: ink and toner with printers, chargers and mounts with accessories, TV mounts with TVs', () => {
  const where = (n, p) => { const c = classify(n, p); return c.ok ? c.slug : `REJECT ${c.reason}`; };
  const M = `${D}>Monitor & TV's>Accessories`;
  assert.equal(where('HP 643A toner cartridge Original Yellow', `${D}>Consumables>Toner Cartridges>Laser Toner & Cartridges`), 'laptops-computing');
  assert.equal(where('HP AC 65W power adapter/inverter Indoor Black', `${D}>Power Conditioning>Batteries & Accessories>Power Adapters & Inverters`), 'accessories-storage');
  assert.equal(where('Arlo Ceiling Adapter Floodlight Mount FBA1001-10000S', `${D}>Audio Visual>Cameras & Camcorders`), 'accessories-storage', 'a mount, not a camera');
  assert.equal(where('Fellowes Computer Monitor Stand with 5 Height Adjustments', `${M}>Desk Mounts`), 'accessories-storage');
  assert.equal(where('ARCTIC Z1 Basic - Desk Mount Monitor Arm', 'Computers'), 'accessories-storage');
  assert.equal(where('Neomounts FPMA-W115 monitor mount / stand 76.2 cm (30") Black Wall', `${M}>Wall Mounts`), 'accessories-storage');
  assert.equal(where('Neomounts by Newstar Select tv wall mount 81.3 cm (32") - 139.7 cm (55") Black', `${M}>Wall Mounts`), 'tv-home-cinema', 'a TV mount, not a monitor');
  assert.equal(where("Vogel's WALL 3345 TV mount", `${M}>Wall Mounts`), 'tv-home-cinema');
  assert.equal(where('GoPro Helmet Front + Side Mount', 'Computers'), 'accessories-storage');
  assert.equal(where('LG UltraGear 27GR95QE OLED Gaming Monitor', `${D}>Monitor & TV's>Monitors`), 'gaming');
});

const header = ['aw_deep_link', 'product_name', 'aw_product_id', 'merchant_product_id', 'merchant_image_url', 'aw_image_url', 'merchant_category', 'search_price', 'rrp_price', 'brand_name', 'stock_quantity', 'ean', 'mpn'];
const line = v => v.map(x => (/[",\n]/.test(x) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(',');
const feed = rows => gzipSync(Buffer.from([line(header), ...rows.map(line)].join('\n') + '\n'));
const link = id => `https://www.awin1.com/pclick.php?p=${id}&a=3057233&m=126641`;
const img = id => `https://media.stockinthechannel.com/pic/${id}.c-r.jpg`;
const SOON = 'https://entrepreneurship.ieee.org/wp-content/uploads/2018/02/Image-Coming-Soon-Placeholder-e1518111259296.png';
const AW_SOON = 'https://images2.productserve.com/?w=200&h=200&bg=white&trim=5&t=letterbox&url=ssl%3Aentrepreneurship.ieee.org%2Fwp-content%2Fuploads%2F2018%2F02%2FImage-Coming-Soon-Placeholder-e1518111259296.png&feedId=115609';

test('PCHUB.UK plan: consumer products only, names whole, no fake "was" price, no "coming soon" picture, a line per shop', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgw-pchub-'));
  const arc = join(dir, 'GW_AWIN_NEW_20261023');
  mkdirSync(arc);
  writeFileSync(join(arc, 'AWIN_126641_115609.csv.gz'), feed([
    [link(1), 'Logitech Mouse M90', '1', 'P-1', img(1), '', `${D}>Peripherals>Mouses`, '21.65', '31.17 GBP', 'Logitech', '1015', '5099206021877'],
    [link(2), 'StarTech.com 75ft CAT6 Ethernet Cable - Red CAT 6 Gigabit Ethernet Wir', '2', 'P-2', img(2), '', `${D}>Networking>Routers & Accessories>Cables`, '24.34', '35.05 GBP', 'StarTech.com', '5', '65030838733'],
    [link(3), 'TP-Link Archer C50 wireless router Fast Ethernet Dual-band (2.4 GHz /', '3', 'P-3', img(3), '', `${D}>Networking>Networking>Network Service Equipment>wireless routers>${D}>Personal Stock`, '42.47', '61.15 GBP', 'TP-Link', '118', '6935364095710'],
    [link(4), 'Epson FRME RCOR RIGH', '4', 'P-4', SOON, AW_SOON, `${D}>PC Components>Other`, '17.50', '25.21 GBP', 'Epson', '5', '5705965746912'],
    [link(5), 'Lenovo ThinkPad T14 Gen 3 (Intel) Intel® Core™ i5 i5-1235U Laptop 35.6', '5', 'P-5', SOON, AW_SOON, `${D}>Laptops>Laptops & Notebooks`, '899.00', '1294.56 GBP', 'Lenovo', '3', '196803123456'],
    [link(6), 'SanDisk ULTRA FLAIR USB flash drive 16 GB USB Type-A 3.2 Gen 1 (3.1 Ge', '6', 'P-6', img(6), '', `${D}>Storage>USB Flash Drives>${D}>Direktek`, '37.61', '54.15 GBP', 'Sandisk', '0', '619659136680'],
    [link(7), 'HP 643A toner cartridge Original Yellow', '7', 'P-7', img(7), '', `${D}>Consumables>Toner Cartridges>Laser Toner & Cartridges`, '120.00', '172.80 GBP', 'HP', '9', ''],
    [link(8), 'Lenovo ThinkPad E14 Gen 6 (AMD) AMD Ryzen™ 5 7535HS Laptop 35.6 cm (14', '8', 'P-8', img(8), '', `${D}>Laptops>Laptops & Notebooks`, '629.99', '907.19 GBP', 'Lenovo', '7', '197529999999', '21M3002XUK']
  ].map(r => (r.length === 12 ? [...r, ''] : r))));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: [{ ...BTTO }, { ...PCHUB }] }));
  const out = join(dir, 'out');
  mkdirSync(out);
  const { stats, products, report } = await planImport({ archive: arc, sourcesFile, outDir: out, now: new Date('2026-10-24T12:00:00Z') });
  const names = products.map(p => p.product_name).sort();
  assert.deepEqual(names, ['HP 643A toner cartridge Original Yellow', 'Lenovo ThinkPad E14 Gen 6 (AMD) AMD Ryzen™ 5 7535HS Laptop 35.6 cm (21M3002XUK)',
    'Logitech Mouse M90', 'TP-Link Archer C50 wireless router Fast Ethernet Dual-band'], 'a cut name gets the part number, unless it already has it');
  for (const p of products) {
    assert.equal(p.retailer, 'PCHUB.UK');
    assert.equal(p.was_price, null, 'rrp_price is price x 1.44 on every row: no "was" price');
    assert.match(p.stable_key, /^126641:P-\d$/);
  }
  assert.equal(stats.rejected['no https image'], 1, 'the laptop has only "image coming soon" pictures');
  assert.equal(stats.rejected['out of stock'], 1);
  assert.equal(stats.rejected['brand not on the consumer list (PCHUB.UK)'], 1, 'StarTech.com network cable');
  assert.equal(stats.rejected['name with letters missing (PCHUB.UK)'], 1, '"Epson FRME RCOR RIGH" (frame, rear, right) in the catch-all folder');
  assert.equal(stats.rejected['feed folder not on the consumer list (PCHUB.UK)'], undefined);
  assert.match(report, /== Per shop ==\r\n {2}PCHUB\.UK: 4 of 8 rows \(50%\)\r\n {6}laptops-computing 3 \| smart-home-wifi 1/);
  assert.match(report, /-- PCHUB\.UK \| smart-home-wifi\r\n {3}TP-Link Archer C50 wireless router Fast Ethernet Dual-band \| 42\.47/);
  assert.match(report, /Back to the Office: its feed was not found \(or is empty\), so its products on the site are left exactly as they are\./);
  const finish = readFileSync(join(out, 'sql', '9999-finish.sql'), 'utf8');
  assert.match(finish, /WHERE awin_advertiser_id IN \(126641\) AND is_active = 1/);
  assert.doesNotMatch(finish, /61655/, 'Back to the Office feed not found: its products are not hidden');
  assert.ok(PLACEHOLDER_IMAGE.test(SOON) && PLACEHOLDER_IMAGE.test(AW_SOON) && !PLACEHOLDER_IMAGE.test(img(1)));
});

// Third TGW dry run with PCHUB.UK (24 Oct 2026, the owner's report): names with letters missing, spare parts from the
// catch-all folders, hotel TVs, network controllers on the gaming page, phone cases on the phones page and the same product
// twice in one shop (lessons L47).
test('PCHUB.UK spare-part folders: names with letters missing and spare parts are out, clean names stay', () => {
  const f = sourceFilter(PCHUB);
  const O = `${D}>PC Components>Other`;
  const K = `${D}>PC Components>Other>${D}>Direktek`;
  const garbled = 'name with letters missing (PCHUB.UK)';
  const part = 'spare part from a catch-all folder (PCHUB.UK)';
  for (const n of ['DELL Opicl Scroll Mouse US', 'DELL Ki Mouse. US. 3 uons.', 'DELL Docking Sion. E-Series.', 'DELL Wired 2-uon US mouse', 'DELL US Opicl Mouse wih 2']) {
    assert.equal(f(n, 'Dell', O), garbled, n);
    assert.equal(garbledName(n, 'Dell'), true, n);
  }
  assert.equal(f('DELL Opicl Scroll Mouse US', 'Dell', K), garbled, 'the Direktek folder too');
  for (const [n, b] of [["DELL 14.1'' XGA LCD Display w/o Screen Cable", 'Dell'], ['DELL Speaker, Internal', 'Dell'], ['HP Speakers (Left and Right)', 'HP'],
    ['Samsung Battery for Galaxy S21', 'Samsung'], ['Epson ELPLP96 Projector Lamp', 'Epson'], ['DELL Motherboard, Intel Core i5', 'Dell'], ['DELL Camera Module HD', 'Dell'],
    ['DELL Wireless Card, Wi-Fi 6E', 'Dell'], ['Epson ELPAF60 Air Filter for projector', 'Epson']]) {
    assert.equal(f(n, b, K), part, n);
  }
  for (const [n, b] of [['DELL USB Optical Mouse (Black)', 'Dell'], ['DELL AC Adapter 19.5V 4.62A 90W includes power cable', 'Dell'], ['Kodak LUMA 150 PROJECTOR', 'Kodak'],
    ['DELL USB Slim QuietKey Keyboard (UK)', 'Dell'], ['Lenovo Mouse', 'Lenovo'], ['Samsung 870 EVO 1TB internal SSD', 'Samsung'],
    ['Anker 737 Power Bank (PowerCore 24K) portable battery', 'Anker']]) {
    assert.equal(f(n, b, O), '', n);
  }
  // A consumer folder vouches for the product: a camera battery there stays, and only the spare-part folders are checked for
  // missing letters ("Jabra EVOLVE 20 MS Mono" is a real headset).
  assert.equal(f('Canon LP-E10 Battery Pack', 'Canon', `${D}>Audio Visual>Cameras & Camcorders>Digital Cameras>${D}>Direktek`), '');
  assert.equal(f('Jabra EVOLVE 20 MS Mono', 'Jabra', `${D}>Headsets>${D}>Personal Stock`), '');
  assert.equal(f('Logitech G G305 LIGHTSPEED Wireless Gaming Mouse', 'Logitech', `${D}>Personal Stock`), '');
  assert.equal(partsFolder(PCHUB, O), true);
  assert.equal(partsFolder(PCHUB, `${D}>Personal Stock`), false);
  assert.equal(partsFolder(BTTO, 'Computers'), false);
  assert.equal(garbledName('Epson FRME LEF', 'Epson'), false, 'too short to tell: classified, and rejected there as not tech');
});

test('TGW: hotel TVs and network gateway/controllers out, cases and holders with the accessories', () => {
  const fp = sourceFilter(PCHUB), fb = sourceFilter(BTTO);
  const TV = `${D}>Audio Visual>AV & Accessories>Televisions & Accessories>Televisions`;
  assert.equal(fp('Samsung HG43CU700EU 109.2 cm (43") 4K Ultra HD Smart TV', 'Samsung', `${TV}>Hospitality TVs`), 'feed folder not for TGW (PCHUB.UK)');
  assert.equal(fp('Samsung HG55BU800EU 55" 4K Ultra HD Smart TV Wi-Fi - Black', 'Samsung', TV), 'business IT, parts or services (PCHUB.UK)');
  const business = 'business IT, parts or services (Back to the Office)';
  // Back to the Office on the live site, 24 Oct 2026.
  assert.equal(fb('Samsung HG50Q60AAEU 127 cm (50") 4K Ultra HD Smart TV Black 20 W', 'Samsung'), business);
  assert.equal(fb('Samsung HG75AU800EEXXU 190.5 cm (75") 4K Ultra HD Smart TV Wi-Fi Black', 'Samsung'), business);
  assert.equal(fb('Samsung 75" 4K Ultra HD Hospitality TV (HG75U800FEUXXU)', 'Samsung'), business);
  assert.equal(fb('Samsung QE55Q60DAUXXU 55" QLED 4K Smart TV', 'Samsung'), '');
  assert.equal(fb('Lenovo V14 G6 ARP 14" Laptop (83UT000HUK) - AMD Ryzen 7 170, 16GB RAM', 'Lenovo'), '');
  const ctl = 'Ubiquiti UCK-G2-PLUS gateway/controller 10, 100, 1000 Mbit/s';
  assert.equal(fp(ctl, 'Ubiquiti', `${D}>Networking>Routers & Accessories>Controllers>${D}>Personal Stock`), 'business IT, parts or services (PCHUB.UK)');
  assert.equal(fb(ctl, 'Ubiquiti'), business);
  const where = (n, p = '') => { const c = classify(n, p); return c.ok ? c.slug : `REJECT ${c.reason}`; };
  assert.notEqual(where(ctl), 'gaming');
  assert.equal(where('Microsoft Xbox Wireless Controller Black Bluetooth/USB Gamepad Analogue / Digital Xbox One'), 'gaming');
  assert.equal(where('PlayStation 5 DualSense Wireless Controller - White', 'Computers'), 'gaming');
  const CASES = `${D}>Storage>Telecom & Navigation>Mobile & Accessories>Cases & Covers`;
  assert.equal(where('Speck Presidio Perfect Clear + MS Apple iPhone 14 Plus/15 Plus Clear (150119-5085)', CASES), 'accessories-storage');
  assert.equal(where('Verbatim FWC-01 Active holder Mobile phone/Smartphone Black', `${D}>PC Components>Accessories>Holders>${D}>Personal Stock`), 'accessories-storage');
  assert.equal(where('Apple iPhone 15 128GB - Blue', `${D}>Storage>Telecom & Navigation>Mobile & Accessories>Smartphones`), 'phones-smartwatches');
});

test('duplicates: one shop shows a product once at its lowest price; another shop at the same price is not shown again', () => {
  const mk = (adv, name, price, gtin = null, cond = 'new') => ({ awin_advertiser_id: adv, product_name: name, price, gtin, item_condition: cond });
  const sw = 'TP-Link 8-Port 10/100/1000Mbps Desktop Network Switch';
  const d = findDuplicates([
    mk(61655, sw, 19.99), mk(61655, sw, 16.99), mk(61655, sw.toLowerCase(), 27.99), // 0-2: one product three times
    mk(126641, sw, 16.99), // 3: the same product at the same price in another shop
    mk(123932, sw, 18.49), // 4: a third shop at another price: kept for price comparison
    mk(126641, 'Lenovo Legion M600 Wireless Gaming mouse', 58.05, '0195348123456'), mk(126641, 'Lenovo Legion M600 Mouse (GY50X79385)', 55, '0195348123456'), // 5-6: one EAN
    mk(126641, 'Lenovo Legion M600 Mouse (GY50X79385)', 49, '0195348123456', 'refurbished') // 7: refurbished is another offer
  ]);
  assert.deepEqual(d.keep, [false, true, false, false, true, false, true, true]);
  assert.deepEqual(d.sameShop, [0, 2, 5]);
  assert.deepEqual(d.otherShop, [3]);
  assert.deepEqual(d.keptFor, [1, -1, 1, 1, -1, 6, -1, -1], 'which row stays instead (for the report)');
  // A shop is compared at its lowest price: PCHUB's cheapest row equals Back to the Office's price, so its dearer row is not
  // shown either (it is not PCHUB's real best price).
  assert.deepEqual(findDuplicates([mk(61655, sw, 16.99), mk(126641, sw, 16.99), mk(126641, sw, 18.49)]).keep, [true, false, false]);
  // An EAN that one shop puts on more than 3 different names is not trusted (a whole range under one code).
  const range = ['Black', 'White', 'Blue', 'Red'].map((c, i) => mk(126641, `Logitech M185 ${c}`, 10 + i, '5099206027299'));
  assert.deepEqual(findDuplicates(range).keep, [true, true, true, true]);
  assert.equal(nameKey('TP-Link  8-Port, Switch!'), 'tp link 8 port switch');
});

const ean13 = body => {
  let s = 0;
  for (let i = 0; i < 12; i++) s += Number(body[11 - i]) * (i % 2 === 0 ? 3 : 1);
  return body + ((10 - (s % 10)) % 10);
};

test('TGW plan with both shops: duplicates out (cheapest kept), letters missing and parts out, examples per folder', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgw-l47-'));
  const arc = join(dir, 'GW_AWIN_NEW_20261023');
  mkdirSync(arc);
  const blink = id => `https://www.awin1.com/pclick.php?p=${id}&a=3057233&m=61655`;
  const sw = 'TP-Link 8-Port 10/100/1000Mbps Desktop Network Switch';
  writeFileSync(join(arc, 'AWIN_61655_102827.csv.gz'), feed([
    [blink(1), sw, '1', 'B-1', img(1), '', 'Computers', '19.99', '', 'TP-Link', '5', ean13('693536409571'), ''],
    [blink(2), sw, '2', 'B-2', img(2), '', 'Computers', '16.99', '', 'TP-Link', '5', '', ''],
    [blink(3), sw, '3', 'B-3', img(3), '', 'Computers', '27.99', '', 'TP-Link', '5', '', ''],
    [blink(4), 'Samsung HG55BU800EU 55" 4K Ultra HD Smart TV Wi-Fi - Black', '4', 'B-4', img(4), '', 'Computers', '551.99', '', 'Samsung', '5', '', ''],
    [blink(5), 'Logitech Wireless Mouse M185', '5', 'B-5', img(5), '', 'Computers', '16.99', '', 'Logitech', '5', ean13('509920602729'), '']
  ]));
  const G = ean13('509920607522'), L = ean13('019534812345');
  writeFileSync(join(arc, 'AWIN_126641_115609.csv.gz'), feed([
    [link(1), 'Logitech Wireless Mouse M185', '11', 'P-1', img(11), '', `${D}>Peripherals>Mouses`, '16.99', '24.47 GBP', 'Logitech', '10', ean13('509920602729'), ''],
    [link(2), 'Logitech G G305 LIGHTSPEED Wireless Gaming Mouse', '12', 'P-2', img(12), '', `${D}>Personal Stock`, '43.06', '62.01 GBP', 'Logitech', '10', G, ''],
    [link(3), 'Logitech G G305 LIGHTSPEED Wireless Gaming Mouse', '13', 'P-3', img(13), '', `${D}>Personal Stock`, '41.58', '59.88 GBP', 'Logitech', '10', '', ''],
    [link(4), 'Lenovo Legion M600 Wireless Gaming mouse', '14', 'P-4', img(14), '', `${D}>Peripherals>Mouses`, '58.05', '83.59 GBP', 'Lenovo', '10', L, ''],
    [link(5), 'Lenovo Legion M600 Wireless Gaming Mouse Ambidextrous (GY50X79385)', '15', 'P-5', img(15), '', `${D}>Peripherals>Mouses`, '55.00', '79.20 GBP', 'Lenovo', '10', L, ''],
    [link(6), 'DELL Opicl Scroll Mouse US', '16', 'P-6', img(16), '', `${D}>PC Components>Other`, '23.87', '34.37 GBP', 'Dell', '10', '', ''],
    [link(7), "DELL 14.1'' XGA LCD Display w/o Screen Cable", '17', 'P-7', img(17), '', `${D}>PC Components>Other`, '92.24', '132.83 GBP', 'Dell', '10', '', ''],
    [link(8), 'Speck Presidio Perfect Clear + MS Apple iPhone 14 Plus/15 Plus Clear', '18', 'P-8', img(18), '', `${D}>Storage>Telecom & Navigation>Mobile & Accessories>Cases & Covers`, '19.58', '28.20 GBP', 'Speck', '10', '', ''],
    [link(9), 'Samsung HG43CU700EU 109.2 cm (43") 4K Ultra HD Smart TV', '19', 'P-9', img(19), '', `${D}>Audio Visual>AV & Accessories>Televisions & Accessories>Televisions>Hospitality TVs`, '399.00', '574.56 GBP', 'Samsung', '10', '', ''],
    [link(10), 'DELL USB Optical Mouse (Black)', '20', 'P-10', img(20), '', `${D}>PC Components>Other`, '15.76', '22.69 GBP', 'Dell', '10', '', '']
  ]));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: [{ ...BTTO }, { ...PCHUB }] }));
  const out = join(dir, 'out');
  mkdirSync(out);
  const { stats, products, report } = await planImport({ archive: arc, sourcesFile, outDir: out, now: new Date('2026-10-24T15:00:00Z') });
  const got = products.map(p => `${p.retailer} | ${p.product_name} | ${p.price} | ${p.category_slug}`).sort();
  assert.deepEqual(got, [
    'Back to the Office | Logitech Wireless Mouse M185 | 16.99 | laptops-computing',
    `Back to the Office | ${sw} | 16.99 | smart-home-wifi`,
    'PCHUB.UK | DELL USB Optical Mouse (Black) | 15.76 | laptops-computing',
    'PCHUB.UK | Lenovo Legion M600 Wireless Gaming Mouse Ambidextrous (GY50X79385) | 55 | gaming',
    'PCHUB.UK | Logitech G G305 LIGHTSPEED Wireless Gaming Mouse | 41.58 | gaming',
    'PCHUB.UK | Speck Presidio Perfect Clear + MS Apple iPhone 14 Plus/15 Plus Clear | 19.58 | accessories-storage'
  ]);
  assert.equal(stats.rejected['duplicate: same shop, same name or EAN (the cheapest is kept)'], 4, 'two switches, a G305 and a Legion M600');
  assert.equal(stats.rejected['duplicate: same product and price at another shop'], 1, 'the M185 at 16.99 is already there from Back to the Office');
  assert.equal(stats.rejected['business IT, parts or services (Back to the Office)'], 1, 'Samsung HG hotel TV');
  assert.equal(stats.rejected['name with letters missing (PCHUB.UK)'], 1);
  assert.equal(stats.rejected['spare part from a catch-all folder (PCHUB.UK)'], 1);
  assert.equal(stats.rejected['feed folder not for TGW (PCHUB.UK)'], 1, 'Hospitality TVs');
  assert.equal(stats.accepted, 6);
  assert.match(report, / {6}\s*1 {2}Computers\r\n {15}- TP-Link 8-Port 10\/100\/1000Mbps Desktop Network Switch \| 16\.99/, 'examples under each feed folder');
  assert.match(report, /== Catch-all folders: products placed by their NAME alone \(up to 30 random examples per category\) ==/);
  assert.match(report, / {2}PCHUB\.UK: 2 of its 4 products\r\n/);
  assert.match(report, / {2}-- PCHUB\.UK \| laptops-computing: 1\r\n {5}DELL USB Optical Mouse \(Black\) \| 15\.76 \| Default Category>PC Components>Other/);
  assert.match(report, /the same product twice in one shop is shown once, at its lowest price/);
  assert.match(report, /-- duplicate: same shop, same name or EAN \(the cheapest is kept\)\r\n {3}TP-Link 8-Port 10\/100\/1000Mbps Desktop Network Switch \| 19\.99 \| Computers {2}\(kept: 16\.99\)/);
  assert.match(report, /Logitech Wireless Mouse M185 \| 16\.99 \| Default Category>Peripherals>Mouses {2}\(shown from Back to the Office\)/);
});
