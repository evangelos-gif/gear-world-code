// Technology Gear World, lessons L64 (25 Oct 2026): what the dry run with the new shops showed, checked against the live
// database the same day. Names are from the report and from the live site, word for word.
//  - Office 365 CSP licences were on the cameras page ("... [EOS 01.10.23]" is an end-of-sale date, not a Canon EOS);
//  - Panasonic Toughbook rugged business computers, and HP "LASERJET ENT" enterprise printers sold for Europe ("PRINTER:EUR");
//  - a Belgian keyboard written "Belg", a power adapter for the US ("(PA-12-US)");
//  - Joybuy's camping gas stove with the accessories, and a pen given only as a free gift;
//  - "�" (a character the PCHUB.UK feed lost) in names;
//  - Back to the Office and PCHUB.UK say in_stock = 1 with stock_quantity 0 on about 24,000 products (stockFromQuantity).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planImport, sourceFilter, resolveSources, rowStock } from '../../tools/tgw-import-plan.mjs';
import { classify, cleanProductName, notUkHint } from '../../sites/tgw/category-rules.js';

const SOURCES = JSON.parse(readFileSync(new URL('../../sites/tgw/sources.json', import.meta.url), 'utf8')).sources;
const ALL = resolveSources(SOURCES);
const shop = id => ALL.find(s => s.advertiserId === id);
const BTTO = sourceFilter(shop(61655));
const PCHUB = sourceFilter(shop(126641));
const PCNOVA = sourceFilter(shop(125822));
const D = 'Default Category';
const BUSINESS = r => `business IT, parts or services (${r})`;
const NOT_UK = 'not for UK buyers (plug or keyboard layout)';

// Where a product ends up: the shop's filter first, then the category rules (as the import tool does).
const where = (filter, name, brand, path = '') => {
  const n = cleanProductName(name);
  const why = filter ? filter(n, brand, path) : '';
  if (why) return `OUT ${why}`;
  const c = classify(n, path);
  return c.ok ? c.slug : `OUT ${c.reason}`;
};

test('licences, rugged business computers and enterprise printers are out; cameras named EOS stay', () => {
  const csp = 'Microsoft YY CSP Office 365 E3 [1M1M] New Commerce [EOS 01.10.23] 1 (CFQ7TTC0LF8R-0001-1M1M)';
  assert.equal(where(PCHUB, csp, 'Microsoft', `${D}>Personal Stock`), `OUT ${BUSINESS('PCHUB.UK')}`);
  assert.equal(where(PCNOVA, 'Microsoft YY CSP Office 365 E1 [1J1M] New Commerce [EOS 01.10.23] 1 (CFQ7TTC0LF8Q-0001-1J1M)', 'Microsoft', `${D}>Personal Stock`),
    `OUT ${BUSINESS('PcNova (IT-Supplies)')}`, 'PcNova takes PCHUB\'s words');
  assert.notEqual(classify(csp, '').slug, 'cameras-drones', 'an end-of-sale date is not a Canon EOS, even without the shop\'s words');
  for (const [filter, r, name] of [
    [PCHUB, 'PCHUB.UK', 'Panasonic TOUGHBOOK 56. 35.5cm (14\'\'). USB. BT. Ethernet (FZ-56BZ00YB4)'],
    [PCHUB, 'PCHUB.UK', 'Panasonic Toughbook FZ-L1 Snapdragon 16 GB 17.8 cm (7") 2 GB (FZ-L1AGAAGAS)'],
    [BTTO, 'Back to the Office', 'Panasonic Toughbook 55 MK3 14" Laptop (FZ-55J6601BE) - Intel Core i5-1345U, 16GB RAM, 512GB SSD, Windows 11 Pro'],
    [BTTO, 'Back to the Office', 'HP CLR LASERJET ENT 4701DN PRINTER:EUR Colour A4'],
    [PCHUB, 'PCHUB.UK', 'HP CLR LASERJET ENT MFP 4801FW PRNTR:EUR Laser A4 33 ppm']
  ]) assert.equal(where(filter, name, name.split(' ')[0], `${D}>Peripherals>Keyboards`), `OUT ${BUSINESS(r)}`, name);
  for (const name of ['Canon EOS R6 Mark III Mirrorless Camera inc RF 24-105mm F4L IS USM (7084C026)',
    'Canon EOS 2000D Black SLR Camera Kit EF-S 18-55mm IS Lens. 32GB SD (2728C006 32GBCASE)',
    'Canon EOS R50 V APS-C Mirrorless Camera - Black inc RF-S 14-30mm (6895C029KIT)']) {
    assert.equal(where(PCHUB, name, 'Canon', `${D}>Personal Stock`), 'cameras-drones', name);
  }
  // LaCie Rugged disks stay (lessons L50); the new words did not touch them.
  assert.equal(where(PCHUB, 'LaCie Rugged Mini external hard drive 2 TB 5400 RPM Micro-USB B 3.2', 'LaCie', `${D}>Storage>External Hard Drives`), 'accessories-storage');
});

test('made for another country: printers for Europe, a Belgian keyboard, a US power adapter; UK and plain ones stay', () => {
  const p = name => classify(cleanProductName(name), '');
  for (const [name, hint] of [
    ['HP LASERJET PRO MFP 3106SDW PRINTER:EUR Laser A4 1200 x 1200 DPI 33', 'PRINTER:EUR'],
    ['HP 725 Multi-Device Rchrgbl WL KBD Belg keyboard Home/Office RF', 'Belg keyboard'],
    ['DELL 65W Barrel (7.4 x 5mm) AC Adapter for Slim PA12 Family 9RN2C (PA-12-US)', '-US)']
  ]) {
    assert.equal(p(name).reason, NOT_UK, name);
    assert.equal(notUkHint(name), hint, `the report says why: ${name}`);
  }
  for (const name of ['DELL 130W Barrel (7.4 x 5mm) AC Adapter for Latitude E Series PA4E', 'Lenovo 5A10W86316 65W USB-C AC Adapter with UK plug',
    'Corsair Harpoon RGB Pro mouse Gaming Right-hand USB Type-A Optical (CH-9301111-EU)', 'HP 230 BLK WL KBD keyboard Universal RF Wireless Black',
    'Samsung MUF-128BE USB flash drive 128 GB USB Type-A 3.2 Gen 1 (MUF-128BE3/EU)']) {
    assert.ok(p(name).ok, name);
  }
});

test('not tech, or not for sale on its own: a camping gas stove, a free-gift pen', () => {
  assert.equal(where(null, 'BRS 11-Series Camping Gas Stove with Carry Bag and Multifunctional Adapter,3240 W', '', 'Sporting Goods > Outdoor Recreation > Camping & Hiking'),
    'OUT camping or cooking gear (not tech)');
  assert.equal(where(null, 'ZTE Nubia Pen White – Free Gift Only', '', 'Electronics > Electronics Accessories > Computer Accessories > Handheld Device Accessories'),
    'OUT free gift, not sold on its own');
  // "Free Gift Mouse ..." is a keyboard sold with a free mouse (out here only for its US layout); a gift box is a gift box.
  assert.equal(where(null, 'Free Gift Mouse ET 60% Tri-Mode Mechanical Keyboard, QWERTY US Layout, RGB Backlit', '', 'Electronics'), `OUT ${NOT_UK}`);
  assert.equal(where(null, 'Baseus PowerCombo 65W Charger UK Gift Box', '', 'Electronics > Electronics Accessories > Power'), 'accessories-storage');
});

test('the right page: an SSD filed under game controllers, and things made for an iPhone are not phones', () => {
  const GC = 'Electronics > Electronics Accessories > Computer Components > Input Devices > Game Controllers';
  const cases = [
    ['Samsung 990 Pro PCIe 4.0 NVMe 2TB', GC, 'accessories-storage'],
    ['Kingston Technology 4000G NV3 M.2 2280 NVMe SSD', GC, 'accessories-storage'],
    ['Sony PlayStation DualSense Wireless Controller - Chroma Pearl (PS5)', GC, 'gaming'],
    ['Razer Blade 16 (2025) Gaming Laptop - NVIDIA GeForce RTX 5090, AMD Ryzen AI 9 365, 32GB RAM, 4TB SSD', '', 'gaming'],
    ['MSI Claw 8 EX AI+ Intel Arc G3 Extreme 32GB RAM 1TB SSD 120Hz 8 Inch', '', 'gaming'],
    ['MOVESPEED Solid State Drive – 1TB USB 3.2 Gen2x2 Portable SSD with 2060MB/s High-Speed for iPhone', 'Electronics > Electronics Accessories > Computer Components > Storage Devices > Floppy Drives', 'accessories-storage'],
    ['BOYA BY-V20 V2.0 USB-C Wireless Microphone for iPhone 16/17, Android with One-Click Noise Cancelling', 'Electronics > Audio > Audio Accessories > Microphone Accessories', 'audio'],
    ['VoxorAI M28 Black Fill Light, Selfie Fill Light, Magnetic Selfie Light, Magnetic Beauty Light for iPhone', 'Electronics > Electronics Accessories > Power > Batteries > Camera Batteries', 'cameras-drones'],
    ['Apple iPhone 16 128GB Ultramarine', 'Electronics > Communications > Telephony > Mobile Phones > Unlocked Mobile Phones', 'phones-smartwatches'],
    ['Apple Watch Series 11 GPS 46mm Silver Aluminium Case with Purple Fog Sport Band - M/L', 'Electronics > Computers > Smart Glasses', 'phones-smartwatches']
  ];
  for (const [name, cat, slug] of cases) assert.equal(where(null, name, '', cat), slug, name);
});

test('stationery is not tech: paint markers (read as printer ink) and a ballpoint pen set (read as a mouse)', () => {
  const INK = 'Office Supplies > Office Instruments > Writing & Drawing Instrument Accessories > Marker & Highlighter Ink Refills';
  for (const name of ['Posca PC-1M Ultra Fine Tip Paint Marker (8 Pack) - Assorted Colours', 'Pentel Fine Paint Marker Metallic Colours Pack of 6',
    'Posca PC-5M Medium Tip Paint Marker (4 Pack) - Festive']) {
    assert.equal(where(null, name, '', INK), 'OUT stationery (not tech)', name);
  }
  assert.equal(where(null, '4pcs Disney Mickey Mouse and Donald Duck Pen Set Officially Licensed Minnie Daisy Cute Anime Ballpoint Pens Colorful Smooth Stationery Gift', '',
    'Office Supplies > Office Instruments > Writing & Drawing Instruments > Pens & Pencils > Pens'), 'OUT stationery (not tech)');
  // still tech: a cable's "E-Marker" chip, a stylus, printer ink
  assert.equal(where(null, 'Hama USB-C Cable, E-Marker, USB4 Gen4, 80 Gbit/s, 5 A, 240 W, 1.00 m', '', 'Computers'), 'accessories-storage');
  assert.equal(where(null, 'Microsoft Surface Slim Pen 2 Stylus', '', 'Electronics > Electronics Accessories > Computer Accessories'), 'accessories-storage');
  assert.equal(where(null, 'Canon CLI-571Y Yellow Ink Cartridge', '', 'Office Supplies > General Office Supplies'), 'laptops-computing');
});

test('"�" in a name: a dash between words, a space inside a word, nothing at the end', () => {
  assert.equal(cleanProductName('Samsung Q600H Q-Series Soundbar with Subwoofer � 3.1.2ch Dolby Atmos (HW-Q600H/XU)'),
    'Samsung Q600H Q-Series Soundbar with Subwoofer – 3.1.2ch Dolby Atmos (HW-Q600H/XU)');
  assert.equal(cleanProductName('LG UltraGear evo�GX9 45GX950B 45" OLED 5K2K 165Hz 0.03ms Curved (45GX950B-B.AEK)'),
    'LG UltraGear evo GX9 45GX950B 45" OLED 5K2K 165Hz 0.03ms Curved (45GX950B-B.AEK)');
  assert.equal(cleanProductName('LG 32U501SB-B 32" IPS Full HD Smart AI Monitor�'), 'LG 32U501SB-B 32" IPS Full HD Smart AI Monitor');
  assert.equal(cleanProductName('TCL 75P7L-UK 75" QLED 4K Smart TV � Ultra Large 75 Inch HDR'), 'TCL 75P7L-UK 75" QLED 4K Smart TV – Ultra Large 75 Inch HDR');
  assert.equal(cleanProductName('Samsung Q990H Q-Series Soundbar with Subwoofer & Rear Speakers � (HW-Q990H/XU)'),
    'Samsung Q990H Q-Series Soundbar with Subwoofer & Rear Speakers – (HW-Q990H/XU)');
});

test('a sales slogan in front of the name is taken off', () => {
  assert.equal(cleanProductName('Black Friday Deal | Coocaa 40"CTQH38 Direct-LED FHD HDR10 Dolby Audio QLED Freely Tivo'),
    'Coocaa 40"CTQH38 Direct-LED FHD HDR10 Dolby Audio QLED Freely Tivo');
  assert.equal(cleanProductName('Black Friday Deals!COMFEE\' RCD92WH2UKY(E) 88L Under Counter Fridge'), 'COMFEE\' RCD92WH2UKY(E) 88L Under Counter Fridge');
  assert.equal(cleanProductName('Black Friday Special Edition Headphones'), 'Black Friday Special Edition Headphones', 'a name, not a slogan');
});

test('stock: Back to the Office, PCHUB.UK (and PcNova, with PCHUB\'s rules) trust stock_quantity; Joybuy keeps in_stock', () => {
  for (const id of [61655, 126641, 125822, 124146]) {
    const s = shop(id);
    assert.equal(rowStock(s, '1', '0'), false, `${s.retailer}: in_stock 1, quantity 0`);
    assert.equal(rowStock(s, '1', '7'), true, s.retailer);
    assert.equal(rowStock(s, 'true', ''), true, `${s.retailer}: no quantity, in_stock decides`);
  }
  assert.equal(rowStock(shop(123932), '1', '0'), true, 'Joybuy: unchanged');
});

const header = ['aw_deep_link', 'product_name', 'aw_product_id', 'merchant_product_id', 'merchant_image_url', 'merchant_category', 'search_price', 'brand_name', 'in_stock', 'stock_quantity', 'ean'];
const line = v => v.map(x => (/[",\n]/.test(x) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(',');
const feed = rows => gzipSync(Buffer.from([line(header), ...rows.map(line)].join('\n') + '\n'));
const link = (m, id) => `https://www.awin1.com/pclick.php?p=${id}&a=3057233&m=${m}`;
const img = id => `https://cdn.shopify.com/s/files/${id}.jpg`;

test('dry run: a row in stock only by in_stock is left out, and the report counts it per shop', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgw-l64-'));
  const arc = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(arc);
  writeFileSync(join(arc, 'AWIN_61655_102827.csv.gz'), feed([
    [link(61655, 1), 'Motorola Moto G30 6.5" 4G Smartphone (PAML0006GB) - 128GB, 4GB RAM, Dual SIM, Black', '1', 'B-1', img(1), 'Computers', '161.99', 'Motorola', '1', '0', '0840023218052'],
    [link(61655, 2), 'Logitech C925e Business Webcam', '2', 'B-2', img(2), 'Computers', '69.99', 'Logitech', '1', '14', '5099206065314'],
    [link(61655, 3), 'Panasonic Toughbook 55 MK3 14" Laptop (FZ-55J6601BE) - Intel Core i5-1345U, 16GB RAM, 512GB SSD, Windows 11 Pro', '3', 'B-3', img(3), 'Computers', '3082.99', 'Panasonic', '1', '2', '']
  ]));
  writeFileSync(join(arc, 'AWIN_126641_115609.csv.gz'), feed([
    [link(126641, 11), 'Logitech Mouse M90', '11', 'H-1', img(11), `${D}>Peripherals>Mouses`, '21.65', 'Logitech', '1', '1015', '5099206021877'],
    [link(126641, 12), 'Logitech Wireless Mouse M185 Grey', '12', 'H-2', img(12), `${D}>Peripherals>Mouses`, '12.99', 'Logitech', '1', '0', '5099206027916']
  ]));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: SOURCES.filter(s => [61655, 126641].includes(s.advertiserId)) }));
  const out = join(dir, 'out');
  mkdirSync(out);
  const { stats, products, report } = await planImport({ archive: arc, sourcesFile, outDir: out, now: new Date('2026-10-25T18:00:00Z') });
  assert.deepEqual(products.map(p => `${p.retailer} | ${p.product_name}`).sort(), [
    'Back to the Office | Logitech C925e Business Webcam',
    'PCHUB.UK | Logitech Mouse M90'
  ]);
  assert.equal(stats.rejected['out of stock: quantity 0, although the feed says in stock (Back to the Office)'], 1, 'the Moto G30');
  assert.equal(stats.rejected['out of stock: quantity 0, although the feed says in stock (PCHUB.UK)'], 1, 'the M185');
  assert.equal(stats.rejected[BUSINESS('Back to the Office')], 1, 'the Toughbook');
  assert.match(report, /-- out of stock: quantity 0, although the feed says in stock \(Back to the Office\)\r\n {3}Motorola Moto G30/);
  assert.doesNotMatch(report, /in stock by the feed, but stock_quantity 0/, 'nothing kept with quantity 0 any more');
});
