// Technology Gear World, lessons L64 (25 Oct 2026): what the dry run with the new shops showed, checked against the live
// database the same day. Names are from the report and from the live site, word for word.
//  - Office 365 CSP licences were on the cameras page ("... [EOS 01.10.23]" is an end-of-sale date, not a Canon EOS);
//  - Panasonic Toughbook rugged business computers, and HP "LASERJET ENT" enterprise printers sold for Europe ("PRINTER:EUR");
//  - a Belgian keyboard written "Belg", a power adapter for the US ("(PA-12-US)");
//  - Joybuy's camping gas stove with the accessories, and a pen given only as a free gift;
//  - "�" (a character the PCHUB.UK feed lost) in names;
//  - Back to the Office and PCHUB.UK say in_stock = 1 with stock_quantity 0 on about 24,000 products (stockFromQuantity).
// The live check after the import (same day): server memory and Panasonic Toughbook accessories on the computing page, memory at
// far more than the usual price (£9,847.99 for 64 GB), "(Incomplete - Fully Functional)" and "BOX DAMAGED" shown as new, camera
// bundles on the audio and accessories pages, replacement ear cushions, a slogan left in front of a TV's name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planImport, sourceFilter, resolveSources, rowStock, memoryCapacityGb, NOT_NEW, NOT_NEW_REASON } from '../../tools/tgw-import-plan.mjs';
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

test('second dry run (25 Oct 2026): the NAME decides, not Joybuy\'s folder; straps, bags, coin cells, business parts', () => {
  // A phone in Joybuy's "Microphone Accessories" folder stays a phone (the first fix looked at the folder too).
  assert.equal(where(null, 'Google Pixel 11 5G Smartphone - 6.3 inch, 12GB RAM, 512GB, Obsidian', '', 'Electronics > Audio > Audio Accessories > Microphone Accessories'), 'phones-smartwatches');
  assert.equal(where(null, 'VoxorAI BOX1 Black Keyboard – Wireless Keyboard with Bluetooth Connectivity. Compatible with iPhone, iPad', '',
    'Electronics > Electronics Accessories > Computer Components > Input Devices > Keyboards'), 'laptops-computing');
  assert.equal(where(null, 'Apple - iPhone Crossbody Strap - Blue', '', 'Electronics > Electronics Accessories > Computer Accessories > Handheld Device Accessories'), 'accessories-storage');
  const SPK = 'Electronics > Audio > Audio Accessories > Speaker Accessories';
  assert.equal(where(null, 'VoxorAI Bestseller: Gray Travel Bag, Packing Bag, Clothing Storage Bag, Gadget Bag, 8-piece Travel Storage Set', '', SPK), 'OUT not matched (feed says tech)');
  assert.equal(where(null, 'Verbex K60 Black Selfie Stick – Portable Tripod for Live Streaming, Photography, and Video Calls', '', SPK), 'cameras-drones');
  assert.equal(where(null, 'BOSE SoundLink Micro (2nd Gen) Portable Bluetooth Speaker Blue Dusk', '', 'Electronics > Audio > Audio Components > Audio Transmitters > Bluetooth Transmitters'), 'audio');
  assert.equal(where(null, 'FIFINE K688CTW White Podcast Microphone Kit | Dynamic Mic with Boom Arm, XLR/USB Ports', '', SPK), 'audio', 'a microphone stays in audio');
  const BAT = 'Electronics > Electronics Accessories > Power > Batteries > Tablet Computer Batteries';
  assert.equal(where(null, 'DURACELL LR44 1.5V Alkaline Button Batteries - 2 Pack', '', BAT), 'OUT consumable, not a gadget');
  assert.equal(where(null, 'Energizer CR2016 Lithium Coin Cell - Pack of 1', '', BAT), 'OUT consumable, not a gadget');
  assert.equal(where(null, 'Xiaomi 33W Power Bank 10000mAh (Integrated Cable) Tan', '', BAT), 'accessories-storage');
  assert.equal(where(null, 'Apple - AirTag - 4 Pack', '', 'Electronics > Electronics Accessories > Computer Accessories > Handheld Device Accessories'), 'accessories-storage');
  for (const [filter, r, name, brand] of [
    [PCNOVA, 'PcNova (IT-Supplies)', 'Toshiba MG Series internal hard drive 22 TB 7200 RPM 512 MB', 'Toshiba'],
    [PCHUB, 'PCHUB.UK', 'Logitech GROUP 15m Extender Cable', 'Logitech'],
    [BTTO, 'Back to the Office', 'Logitech GROUP 10m Extended Cable', 'Logitech'],
    [PCNOVA, 'PcNova (IT-Supplies)', 'HP Sps- Brac Wl Combo keyboard Mouse included Office RF Wireless', 'HP']
  ]) assert.equal(where(filter, name, brand, `${D}>Personal Stock`), `OUT ${BUSINESS(r)}`, name);
  assert.equal(where(PCHUB, 'Toshiba Canvio Basics external hard drive 2 TB Black', 'Toshiba', `${D}>Storage>External Hard Drives`), 'accessories-storage');
  assert.equal(where(PCHUB, 'Logitech MX Keys S Combo keyboard Mouse included Office RF Wireless + Bluetooth', 'Logitech', `${D}>Peripherals>Keyboards`), 'laptops-computing');
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
  // live check: every promotion in front goes, slogans and brackets in any order
  const TV = 'Coocaa 55"CRUG50 Direct LED 4K HDR Smart Roku TV-55CRUG50ZUK(HDR10,Dolby Audio)';
  assert.equal(cleanProductName(`Black Friday Deal | Black Friday Deal | ${TV}`), TV);
  assert.equal(cleanProductName(`【Black Friday Early Deals】Black Friday Deal | ${TV}`), TV);
  assert.equal(cleanProductName(`Black Friday Deal | 【Free Delivery】 ${TV}`), TV);
  assert.equal(cleanProductName(`[Back-to-School] ${TV}`), TV);
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

test('live check after the import (25 Oct 2026): server memory, Toughbook accessories and Toshiba MG09 out; consumer memory stays', () => {
  const MEM = `${D}>PC Components>Components>Memory Modules`;
  const KT = 'Kingston Technology';
  for (const [filter, r, name, brand, path] of [
    [PCHUB, 'PCHUB.UK', 'Samsung M321R8GA0EB2-CCP memory module 64 GB 1 x 64 GB DDR5 288-pin', 'Samsung', MEM],
    [PCHUB, 'PCHUB.UK', 'Samsung M393A4K40DB3-CWE memory module 32 GB 1 x 32 GB DDR4 288-pin', 'Samsung', MEM],
    [PCHUB, 'PCHUB.UK', 'Samsung M386A8K40CM2-CVF memory module 64 GB DDR4 2933 MHz', 'Samsung', MEM],
    [BTTO, 'Back to the Office', 'Lenovo 4X77A77032 memory module 64 GB 1 x 64 GB DDR5 288-pin DIMM ECC', 'Lenovo', 'Computers'],
    [PCHUB, 'PCHUB.UK', 'Lenovo 4ZC7A08744 memory module 64 GB 1 x 64 GB DDR4', 'Lenovo', MEM],
    [PCHUB, 'PCHUB.UK', 'Kingston Technology KSM32RD8/16HDR memory module 16 GB 1 x 16 GB', KT, MEM],
    [PCHUB, 'PCHUB.UK', 'Kingston Technology KSM56R46BD4-64HA memory module 64 GB 1 x 64 GB', KT, MEM],
    [BTTO, 'Back to the Office', 'Kingston Technology KCS-UC556D4-64G memory module 64 GB 1 x 64 GB DDR5 5600 MT/s ECC', KT, 'Computers'],
    [PCHUB, 'PCHUB.UK', 'Kingston Technology KTH-PL556D8-32G memory module 32 GB 1 x 32 GB', KT, MEM],
    [PCHUB, 'PCHUB.UK', 'Kingston Technology System Specific Memory KTH-PL426/32G memory', KT, MEM],
    [PCHUB, 'PCHUB.UK', 'Kingston Technology KTD-PE432D8/32G memory module 32 GB 1 x 32 GB', KT, MEM],
    [PCHUB, 'PCHUB.UK', 'Kingston Technology KTL-TS432/32G memory module 32 GB 1 x 32 GB DDR4', KT, MEM],
    [BTTO, 'Back to the Office', 'Panasonic FZ-VNP026U stylus pen 11.3 g Black', 'Panasonic', 'Computers'],
    [PCHUB, 'PCHUB.UK', 'Panasonic FZ-VEB551U laptop dock/port replicator Docking Black', 'Panasonic', `${D}>Laptops>Docks & Port Replicators`],
    [PCNOVA, 'PcNova (IT-Supplies)', 'Toshiba MG09 internal hard drive 18 TB 7200 RPM 512 MB 3.5"', 'Toshiba', `${D}>Storage>Internal Hard Drives>${D}>Personal Stock`]
  ]) assert.equal(where(filter, name, brand, path), `OUT ${BUSINESS(r)}`, name);
  // Third dry run (25 Oct 2026, 19:42): with the PCHUB.UK copy out by its code (KSM56E46BD8-32MH), PcNova's copy came in, its
  // name cut at 70 characters before the code. Server memory is known by its words too: DDR5 ECC unbuffered or registered.
  for (const [filter, r] of [[PCNOVA, 'PcNova (IT-Supplies)'], [PCHUB, 'PCHUB.UK']]) {
    for (const name of ['Kingston Technology 32GB DDR5 5600MT/s ECC Unbuffered DIMM CL46 2Rx8', 'Kingston Technology 16GB DDR5 5600MT/s ECC Unbuffered DIMM CL46 1Rx8',
      'HP 16GB DDR5 (1x16GB) 4800 UDIMM ECC Memory']) {
      assert.equal(where(filter, name, name.split(' ')[0] === 'HP' ? 'HP' : KT, MEM), `OUT ${BUSINESS(r)}`, `${r}: ${name}`);
    }
  }
  assert.equal(where(PCHUB, 'Corsair Vengeance memory module 32 GB 2 x 16 GB DDR5 ECC', 'Corsair', MEM), 'laptops-computing', 'DDR5 named ECC stays (L54)');
  assert.equal(where(PCHUB, 'Crucial CT2K16G56C46S5 memory module 32 GB 2 x 16 GB DDR5 ECC', 'Crucial', MEM), 'laptops-computing');
  assert.equal(where(PCHUB, 'Kingston Technology FURY Beast 64GB 6000MT/s DDR5 CL36 DIMM (KF560C36BBEK2-64)', KT, MEM), 'laptops-computing');
  assert.equal(where(PCHUB, 'Samsung M425R1GB4BB0-CQK memory module 8 GB 1 x 8 GB DDR5 SODIMM', 'Samsung', MEM), 'laptops-computing');
  assert.equal(where(PCHUB, 'Toshiba N300 internal hard drive 8 TB 7200 RPM 3.5" Serial ATA', 'Toshiba', `${D}>Storage>Internal Hard Drives`), 'accessories-storage');
  assert.equal(where(BTTO, 'Panasonic Lumix DC-FZ82 Bridge Camera', 'Panasonic', 'Computers'), 'cameras-drones');
});

test('live check: camera bundles are cameras, replacement ear cushions are spare parts, camera mounts stay accessories', () => {
  const CAM = 'Cameras & Optics > Cameras > Digital Cameras';
  const GEAR = 'Cameras & Optics > Camera & Optic Accessories > Camera Parts & Accessories > Camera Gears';
  const SPK = 'Electronics > Audio > Audio Accessories > Speaker Accessories';
  for (const name of ['Insta360 X5 Creator Combo (X5 + Quick Reader + 114 cm Invisible Selfie Stick + Lens Protector)',
    'DJI Osmo Pocket 4 Standard Combo & Shokz OpenDots One Black Open-Ear Clip On Headphones',
    'DJI Osmo Action 6 Adventure Combo&Shokz OpenRun Mini Black Bone Conduction Headphones',
    'DJI Osmo Pocket 4 Creator Combo & Shokz OpenDots One Grey Wireless Clip Open Ear Earbuds']) {
    assert.equal(where(null, name, '', CAM), 'cameras-drones', name);
  }
  assert.equal(where(null, 'Insta360 X5 Standard Lens Protector', '', GEAR), 'accessories-storage');
  assert.equal(where(null, 'Ulanzi CO62 Go-Quick ll Magnetic Backpack Clip Mount for GoPro Hero 12 11 10 9 8 7 6 5 4 Session 3+ 3 2 1 Max, DJI Osmo Action, Insta360, Action Cameras Backpack Strap Mount for Phone with Support Vertical Shots', '', GEAR), 'accessories-storage');
  for (const name of ['DELL Pro Wired Headset Ear Cushions - HE324', 'DELL Wireless Headset Ear Cushions - HE424', 'Dell Pro Wired/Wireless Headset Ear Cushions']) {
    assert.equal(where(null, name, '', SPK), 'OUT spare part or service', name);
  }
  assert.equal(where(null, 'Sennheiser HD 560S Over-Ear Headphones with Velour Ear Pads', '', 'Electronics > Audio > Audio Components > Headphones & Headsets > Headphones'), 'audio');
  assert.equal(where(null, 'Shokz OpenRun Pro 2 Bone Conduction Headphones', '', 'Electronics > Audio > Audio Components > Headphones & Headsets > Headphones'), 'audio');
  // an action camera "for the outdoors" is not a security camera; a camera light that says "Mini LED" is not a TV
  assert.equal(where(null, 'DJI Osmo Action 4 Adventure Combo - 4K/120fps Waterproof Action Camera with a 1/1.3-Inch Sensor, 10-bit & D-Log M Color Performance, 155° FOV, Up to 7.5 h with 3 Extra Batteries, Outdoor Camera', '', CAM), 'cameras-drones');
  assert.equal(where(null, 'ULANZI LM18 Vlogging Light for DJI Osmo Action 3/4/5 Pro Camera Cage Accessories, Mini LED Action Camera Light', '', GEAR), 'cameras-drones');
  assert.equal(where(null, 'ULANZI PK-04 Carrying Bag + ULANZI LM001 Magnetic Mini LED Light for DJI Osmo Pocket 3 – Travel & Vlogging Value Bundle', '', GEAR), 'cameras-drones');
  assert.equal(where(null, 'Reolink Argus 4 Pro Outdoor Camera Battery', '', 'Electronics > Video > Video Surveillance'), 'smart-home-wifi');
  assert.equal(where(PCHUB, 'Sony BRAVIA 9 II K65XR95M2PB 65 Inch 4K HDR True RGB Mini LED Smart', 'Sony', `${D}>TV & Audio>Televisions`), 'tv-home-cinema');
  assert.equal(where(null, 'TCL 98Q6C QD-Mini LED 4K HDR Smart Google TV-98Q6C-UK', '', 'Electronics > Video > Televisions'), 'tv-home-cinema');
});

test('live check: memory far dearer than usual is left out; a laptop or graphics card naming its memory is not a module', () => {
  assert.equal(memoryCapacityGb('Lenovo 4X77A77032 memory module 64 GB 1 x 64 GB DDR5 288-pin DIMM ECC'), 64);
  assert.equal(memoryCapacityGb('HP 64GB DDR5 (1x64GB) 6400 CSODIMM NECC Memory'), 64);
  assert.equal(memoryCapacityGb('Kingston FURY Beast 16GB 3200MHz DDR4 CL16 Desktop Memory Single DIMM'), 16, '"Desktop Memory" is a kind of module');
  assert.equal(memoryCapacityGb('Corsair Vengeance RGB 32GB (2x16GB) DDR5 6000MHz RAM Kit'), 32);
  assert.equal(memoryCapacityGb('Kingston Technology FURY 256GB 3200MT/s DDR4 CL16 DIMM (Kit of 8) (KF432C16RB2K8/256)'), 256);
  assert.equal(memoryCapacityGb('G.Skill Ripjaws S5 2 x 16GB DDR5 6000MHz DIMM'), 32, 'a kit without its total is counted whole');
  assert.equal(memoryCapacityGb('Corsair Dominator Titanium memory module 96 GB 2 x 48 GB DDR5'), 96);
  assert.equal(memoryCapacityGb('HP 16GB DDR5 (1x16GB) 4800 UDIMM ECC Memory'), 16, 'a UDIMM is a module');
  assert.equal(memoryCapacityGb('DELL 64G. RDIMM. 2933MHz. DDR4. 64GB'), 64);
  assert.equal(memoryCapacityGb('ASUS ROG Strix G16 Gaming Laptop 32GB RAM 1TB SSD DDR5 memory module'), 0);
  assert.equal(memoryCapacityGb('Gigabyte GeForce RTX 5070 Ti 16GB GDDR7 graphics card'), 0);
  assert.equal(memoryCapacityGb('Logitech MX Keys S Combo'), 0);
  for (const n of ['Sharp 42 Inch FHD LED Smart TV - 2T-C42CG2KG2FB (Incomplete - Fully Functional)', 'Fellowes BOX DAMAGED - 60CS Cross Cut Shredder',
    'Brother BOX DAMAGED BTD180CLVAL C-M-Y Ink Bottles 48.8ml', 'Apple iPad Air 11" Open-Box', 'Sony Bravia 8 II Ex-Display']) assert.ok(NOT_NEW.test(n), n);
  for (const n of ['Samsung 990 PRO 2TB NVMe SSD', 'Apple AirPods Pro 3 (USB-C) with MagSafe Charging Case', 'Logitech MX Master 4 Complete']) assert.ok(!NOT_NEW.test(n), n);
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

test('dry run: memory far dearer than usual is left out (2026 prices stay); "Incomplete" is not new, and is left out', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgw-l64b-'));
  const arc = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(arc);
  writeFileSync(join(arc, 'AWIN_61655_102827.csv.gz'), feed([
    [link(61655, 21), 'HP 8GB DDR5 5600 SODIMM Memory', '21', 'B-21', img(21), 'Computers', '409.99', 'HP', '1', '5', ''],
    [link(61655, 22), 'Kingston Technology FURY Beast 64GB 6000MT/s DDR5 CL36 DIMM (Kit of 2) RGB EXPO', '22', 'B-22', img(22), 'Computers', '1469.99', 'Kingston Technology', '1', '4', ''],
    [link(61655, 23), 'Sharp 42 Inch FHD LED Smart TV - 2T-C42CG2KG2FB (Incomplete - Fully Functional)', '23', 'B-23', img(23), 'Computers', '213.99', 'Sharp', '1', '9', ''],
    [link(61655, 24), 'Sharp 42 Inch FHD LED Smart TV - 2T-C42CG2KG2FB', '24', 'B-24', img(24), 'Computers', '279.99', 'Sharp', '1', '9', '']
  ]));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: SOURCES.filter(s => s.advertiserId === 61655) }));
  const out = join(dir, 'out');
  mkdirSync(out);
  const { stats, products } = await planImport({ archive: arc, sourcesFile, outDir: out, now: new Date('2026-10-25T20:00:00Z') });
  const by = Object.fromEntries(products.map(p => [p.merchant_product_id, p]));
  assert.deepEqual(Object.keys(by).sort(), ['B-22', 'B-24']);
  assert.equal(stats.rejected['price far above the usual for this memory'], 1, 'the HP 8 GB at £409.99');
  // The site shows only new and refurbished (cards, compare table): an incomplete TV must not be shown as new.
  assert.equal(stats.rejected[NOT_NEW_REASON], 1, 'the incomplete TV');
  assert.equal(by['B-24'].item_condition, 'new');
  assert.equal(by['B-22'].item_condition, 'new');
});
