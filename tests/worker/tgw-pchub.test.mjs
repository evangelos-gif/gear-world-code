// Technology Gear World: PCHUB.UK (Awin 126641) as a third shop (24 Oct 2026, lessons L45). A trade catalogue of 228,274
// rows: only consumer folders and brands, names the feed cut at 70 characters, an rrp_price that is always price x 1.44 and
// "image coming soon" pictures. Names and folders are from the awin-feed-sample report of 23 Oct 2026 (feed 115609).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planImport, sourceFilter, cutToWord, PLACEHOLDER_IMAGE } from '../../tools/tgw-import-plan.mjs';
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
    ['Fractal Design Core 1100 Mini Tower Black', 'Fractal Design', `${D}>PC Components>Cases & Cooling>Cases & Parts`]
  ];
  for (const [n, b, p] of keep) assert.equal(f(n, b, p), '', n);
  const out = [
    ['Epson FRME LEF', 'Epson', `${D}>PC Components>Other`, 'feed folder not on the consumer list (PCHUB.UK)'],
    ['STATUS 700W Carbon Fibre Element Patio Heater', 'STATUS', `${D}>PC Components>Other>${D}>Personal Stock`, 'feed folder not on the consumer list (PCHUB.UK)'],
    ['HP 610913-B31 laptop spare part Keyboard', 'HP', `${D}>Laptops>Laptop Spare Parts`, 'feed folder not for TGW (PCHUB.UK)'],
    ['HP 643A toner cartridge Original Yellow', 'HP', `${D}>Consumables>Toner Cartridges>Laser Toner & Cartridges`, 'feed folder not for TGW (PCHUB.UK)'],
    ['Targus Privacy Screen 14.1"W 35.8 cm (14.1")', 'Targus', `${D}>Monitor & TV's>Accessories>Privacy Filters`, 'feed folder not for TGW (PCHUB.UK)'],
    ['Hypertec GEN8-2.5TRAY computer case part HDD Cage', 'Hypertec', `${D}>PC Components>Cases & Cooling>Cases & Parts>Case Parts`, 'feed folder not for TGW (PCHUB.UK)'],
    ['Jabra A Ear Pads', 'Jabra', `${D}>Audio Visual>AV & Accessories>Televisions & Accessories>audio equipment parts & accessories>Portable Audio`, 'feed folder not for TGW (PCHUB.UK)'],
    ['Hypertec HYSDC0304G memory card 4 GB SD', 'Hypertec', `${D}>Storage>Memory Cards`, 'brand not on the consumer list (PCHUB.UK)'],
    ['AG Neovo TM-23 computer monitor 58.4 cm (23") 1920 x 1080 pixels', 'AG Neovo', `${D}>Monitor & TV's>Monitors`, 'brand not on the consumer list (PCHUB.UK)'],
    ['DELL 37MGT internal hard drive 2 TB 7200 RPM 3.5" NL-SAS', 'Dell', `${D}>Storage>Internal Hard Drives`, 'business IT, parts or services (PCHUB.UK)'],
    ['Synology RackStation RS3618xs NAS Rack (2U) Intel® Xeon® D D-1521 8 GB', 'Synology', `${D}>Storage>NAS & Storage Servers`, 'business IT, parts or services (PCHUB.UK)'],
    ['Arlo Ceiling Adapter Floodlight Mount FBA1001-10000S', 'Arlo', `${D}>Audio Visual>Cameras & Camcorders`, 'business IT, parts or services (PCHUB.UK)'],
    ['Hypertec HYMAS7401G (Legacy) memory module 1 GB 1 x 1 GB DDR2 667 MHz', 'Lenovo', `${D}>PC Components>Components>Memory Modules`, 'business IT, parts or services (PCHUB.UK)']
  ];
  for (const [n, b, p, why] of out) assert.equal(f(n, b, p), why, n);
  // Back to the Office has no folder lists: its filter is as before.
  assert.equal(sourceFilter(BTTO)('Logitech Speakers S150', 'Logitech'), '');
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
  assert.equal(where('DELL EURO Simple E-Port II Docking Black', `${D}>Laptops>Docks & Port Replicators`), 'accessories-storage');
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
  assert.deepEqual(names, ['Lenovo ThinkPad E14 Gen 6 (AMD) AMD Ryzen™ 5 7535HS Laptop 35.6 cm (21M3002XUK)', 'Logitech Mouse M90',
    'TP-Link Archer C50 wireless router Fast Ethernet Dual-band'], 'a cut name gets the part number, unless it already has it');
  for (const p of products) {
    assert.equal(p.retailer, 'PCHUB.UK');
    assert.equal(p.was_price, null, 'rrp_price is price x 1.44 on every row: no "was" price');
    assert.match(p.stable_key, /^126641:P-\d$/);
  }
  assert.equal(stats.rejected['no https image'], 1, 'the laptop has only "image coming soon" pictures');
  assert.equal(stats.rejected['out of stock'], 1);
  assert.equal(stats.rejected['feed folder not on the consumer list (PCHUB.UK)'], 2);
  assert.equal(stats.rejected['feed folder not for TGW (PCHUB.UK)'], 1);
  assert.match(report, /== Per shop ==\r\n {2}PCHUB\.UK: 3 of 8 rows \(38%\)\r\n {6}laptops-computing 2 \| smart-home-wifi 1/);
  assert.match(report, /-- PCHUB\.UK \| smart-home-wifi\r\n {3}TP-Link Archer C50 wireless router Fast Ethernet Dual-band \| 42\.47/);
  assert.match(report, /Back to the Office: its feed was not found \(or is empty\), so its products on the site are left exactly as they are\./);
  const finish = readFileSync(join(out, 'sql', '9999-finish.sql'), 'utf8');
  assert.match(finish, /WHERE awin_advertiser_id IN \(126641\) AND is_active = 1/);
  assert.doesNotMatch(finish, /61655/, 'Back to the Office feed not found: its products are not hidden');
  assert.ok(PLACEHOLDER_IMAGE.test(SOON) && PLACEHOLDER_IMAGE.test(AW_SOON) && !PLACEHOLDER_IMAGE.test(img(1)));
});
