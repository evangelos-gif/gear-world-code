// Technology Gear World: the fourth dry run with PCHUB.UK and Back to the Office (24 Oct 2026, lessons L48). TGW is a UK site
// for consumers: no plugs or keyboard layouts for other countries, no business-only supplies, graded products marked as
// refurbished, and every product on its right page. Names are from the owner's report and from the live site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planImport, sourceFilter, vagueName } from '../../tools/tgw-import-plan.mjs';
import { classify, notUkHint } from '../../sites/tgw/category-rules.js';

const SOURCES = JSON.parse(readFileSync(new URL('../../sites/tgw/sources.json', import.meta.url), 'utf8')).sources;
const PCHUB = SOURCES.find(s => s.advertiserId === 126641);
const BTTO = SOURCES.find(s => s.advertiserId === 61655);
const D = 'Default Category';
const where = (n, p = 'Computers') => { const c = classify(n, p); return c.ok ? c.slug : `REJECT ${c.reason}`; };
const NOT_UK = 'REJECT not for UK buyers (plug or keyboard layout)';

test('UK site: keyboards with another country\'s layout are out, UK and plain English ones stay', () => {
  for (const n of ['Apple Magic Keyboard QWERTZ German Black', 'Apple Magic Keyboard AZERTY French White', 'Apple Magic Keyboard QWERTY Danish Black',
    'Apple Magic Keyboard QWERTY US English White', 'Apple Magic Keyboard for iPad Air 13-inch (M3) - French - Black',
    'Apple Magic Keyboard with Touch ID for Mac models with silicon (USB–C) - Italian', 'CHERRY KC 6000 Slim keyboard Universal USB US English Black',
    'DELL Pro Keyboard and Mouse - KM5221W - US International (QWERTY) - Black', 'Lenovo 4X31R64425 keyboard Mouse included Home/Office USB Norwegian Black',
    'CHERRY TouchBoard G80-11900 Black USB ES keyboard', 'Apple Magic Keyboard with Touch ID for Mac models with silicon (MXCK3PO/A)']) {
    assert.equal(where(n), NOT_UK, n);
  }
  for (const n of ['Apple Magic Keyboard QWERTY UK English Black', 'Apple Magic Keyboard QWERTY English White', 'DELL Pro Keyboard - KB500 - UK (QWERTY)',
    'CHERRY KC 1000 Corded Keyboard, Black, USB (QWERTY - UK)', 'Corsair K70 PRO TKL keyboard Gaming USB QWERTZ UK English Black',
    'ASUS ROG Azoth X keyboard Gaming USB White', 'Apple Magic Keyboard with Touch ID (MXCK3B/A)']) {
    assert.equal(where(n), 'laptops-computing', n);
  }
});

test('UK site: chargers, adapters and docks with a plug for another country are out; UK plugs, UK sockets and plug-free adapters stay', () => {
  for (const n of ['Sandberg USB-C AC Charger PD20W EU', 'Verbatim Essentials GaN Charger 65W EU plug Black', 'DELL 65W USB-C AC Adapter with SA Plug',
    'DELL EURO Simple E-Port II Docking Black', 'Apple 20W USB-C Power Adapter (MHJE3ZM/A)',
    'GIGABYTE P650G PCIE 5.1 Power Supply - PCIe 5.1, 80 PLUS Gold, 120mm Fan, ATX 3.1 compatible, EU Plug']) {
    assert.equal(where(n), NOT_UK, n);
  }
  assert.equal(where('Lenovo 02DL108 65W USB-C AC Adapter with UK Plug'), 'accessories-storage');
  assert.equal(where('Belkin BoostCharge Pro dual wall charger with UK/EU plugs'), 'accessories-storage');
  assert.equal(where('ANKER ANKER NANO CHARGER (45W) (K)OFFLINE - SA/KW/AE/SG/MY/HK BLACK (A2692K11)'), 'accessories-storage', 'the same socket type as the UK');
  assert.equal(where('Apple USB-C to Lightning Adapter (MUQX3ZM/A)'), 'accessories-storage', 'no plug: the country code does not matter');
  assert.equal(where('ASUS ZenWiFi BD4 (2-pack EU+UK) Dual-band (2.4 GHz / 5 GHz) Wi-Fi 7 (802.11be) White Internal'), 'smart-home-wifi');
  assert.equal(where('Hama Audio Cable, 3.5 mm Jack Plug - 2 RCA Plugs, Stereo, 1.5 m'), 'accessories-storage');
  assert.equal(where('Apple iPhone 15 6.1" 5G Smartphone (MTP93ZD/A) - 256GB, Blue'), 'phones-smartwatches', 'a phone is the same everywhere');
});

test('UK site: laptops and printers set up for another country are out; a mouse with a country code stays', () => {
  assert.equal(where('HP ProBook 450 G10 Intel Core i5 i5-1335U Laptop 39.6 cm (85B04EA#ABD)'), NOT_UK);
  assert.equal(where('Lenovo ThinkPad T14 Gen 5 (Intel) Intel Core Ultra 5 Laptop (21ML0024GE)'), NOT_UK);
  assert.equal(where('HP EliteBook 840 G8 Certified Refurbished Intel® Core™ i5 i5-1145G7 (C20LSE8Q#ABU)'), 'laptops-computing');
  assert.equal(where('Lenovo ThinkPad E14 Gen 6 (AMD) AMD Ryzen™ 5 7535HS Laptop 35.6 cm (21M3002XUK)'), 'laptops-computing');
  assert.equal(where('Lenovo V14 G6 ARP 14" Laptop (83UT000HUK) - AMD Ryzen 7 170, 16GB RAM'), 'laptops-computing');
  assert.equal(where('HP B8YX3AA#ABB mouse Home Right-hand Bluetooth + USB Type-C 6000 DPI'), 'laptops-computing');
});

test('business-only supplies and kit are out in both shops; consumer ink bottles stay', () => {
  const fp = sourceFilter(PCHUB), fb = sourceFilter(BTTO);
  const P = 'business IT, parts or services (PCHUB.UK)', B = 'business IT, parts or services (Back to the Office)';
  for (const [n, b] of [['HP CF310AC/826A Toner black Contract. 29K pages/5% for HP Color', 'HP'], ['Brother WT-320CL Toner waste box. 50K pages for Brother DCP-L', 'Brother'],
    ['HP F9K17A/728 Ink cartridge cyan 300ml for HP DesignJet T 730/830', 'HP'], ['HP C9372A/72 Ink cartridge magenta 130ml for HP DesignJet T', 'HP'],
    ['Epson C13T612100/T6121 Ink cartridge foto black 220ml for Epson', 'Epson'], ['Epson Bond Paper Satin 90. 610mm x 50m', 'Epson'],
    ['TP-LINK VIGI InSight PTZ5425 V1.6 - Network surveillance camera', 'TP-Link'], ['Ubiquiti Rocket 5ac Lite 450 Mbit/s White', 'Ubiquiti'],
    ['Ubiquiti PBE-M5-400 bridge/repeater Network bridge 1000 Mbit/s White', 'Ubiquiti'], ['Intel AXXRMM4LITE2 remote management adapter', 'Intel'],
    ['Intel CYP2URISER3STD interface cards/adapter Internal PCIe', 'Intel'], ['Intel Ethernet Network Adapter E810-CQDA2 Internal Fiber 100000', 'Intel'],
    ['Synology FS200T 5.76TB 6-Bay Desktop NAS; Intel Celeron J4125 CPU', 'Synology'], ['Samsung SSD M.2 (22110) 3.84TB Samsung PM9A3 Series (PCIe 4.0/NVMe)', 'Samsung'],
    ['DELL ASSY CVR WLAN 3540', 'Dell']]) {
    assert.equal(fp(n, b, `${D}>Personal Stock`), P, n);
  }
  assert.equal(fb('TP-Link 5GHz 150Mbps 23dBi Outdoor CPE', 'TP-Link'), B);
  assert.equal(fb('HP LaserJet Enterprise 675S3A#B19 multifunction printer Laser A4 1200 x 1200 DPI 50 ppm', 'HP'), B);
  assert.equal(fb('HP OfficeJet Pro 8132e Wireless All-in-One Color Printer. Instant (40Q45B#687)', 'HP'), '');
  assert.equal(fb('Canon GI-50 PGBK black ink bottle 170ml', 'Canon'), '', 'a MegaTank bottle is consumer ink');
  assert.equal(where('Canon GI-50 PGBK black ink bottle 170ml'), 'laptops-computing');
  assert.equal(where('Epson 104 EcoTank Black ink bottle 65ml'), 'laptops-computing');
  assert.equal(where('HP 125 Wired Mouse (Bulk120)'), 'REJECT trade pack (bulk quantity)');
  assert.equal(where('Sandberg MiniJack Headphone Bulk'), 'audio', 'one unboxed product is not a trade pack');
});

test('catch-all folders: a laptop battery and a name that says nothing are out', () => {
  const f = sourceFilter(PCHUB);
  assert.equal(f('DELL Laptop 7.4v 4500mAh', 'Dell', `${D}>PC Components>Other`), 'spare part from a catch-all folder (PCHUB.UK)');
  assert.equal(f('Nintendo C/VOL (K1) EE', 'Nintendo', `${D}>PC Components>Other`), 'name says nothing about the product (PCHUB.UK)');
  assert.equal(vagueName('Nintendo C/VOL (K1) EE', 'Nintendo'), true);
  for (const [n, b] of [['Apple AirPods 4', 'Apple'], ['Lenovo Mouse', 'Lenovo'], ['Kodak LUMA 150 PROJECTOR', 'Kodak'], ['Logitech Speakers S150', 'Logitech']]) {
    assert.equal(vagueName(n, b), false, n);
  }
  assert.equal(f('Apple AirPods 4', 'Apple', `${D}>Personal Stock`), '');
  assert.equal(f('Microsoft Xbox One EA Sports UFC 4 Game', 'Microsoft', `${D}>PC Components>Other>${D}>Direktek`), '');
});

test('fourth dry run: products on the right page', () => {
  const O = `${D}>PC Components>Other`;
  assert.equal(where('Fujifilm Instax Mini Link 3 Wireless Smartphone Photo Printer - Clay (16832077+20)', ''), 'cameras-drones', 'not a phone');
  assert.equal(where('Canon EOS R50 Camera inc RF-S 18-45mm Lens. CP1500 Printer (5811C031-SelphyKit)', ''), 'cameras-drones', 'not a printer');
  assert.equal(where('Panasonic Lumix S5 + S 18-40mm / F4.5-6.3 Zoom MILC Body 24.2 MP (DC-S5DNE-K)', ''), 'cameras-drones');
  assert.equal(where('Hama FlexPro tripod Smartphone/Action camera 3 leg(s) Black', `${D}>Audio Visual>Cameras & Camcorders>Photo & Video Equipment>Accessories>Tripods`), 'cameras-drones');
  assert.equal(where('OnePlus Nord Buds 2 Thunder Grey Wireless Earphones', ''), 'audio');
  assert.equal(where('Antec ARGB & PWM FAN CONTROLLER fan speed controller', ''), 'laptops-computing', 'not a game controller');
  assert.equal(where('LG UltraGear 39GX950B evo GX9 39" OLED 5K2K 165Hz USB-C (39GX950B-B.AEK)', ''), 'gaming', 'a gaming monitor, not a TV');
  assert.equal(where('ASUS 26.5 OLED MON ROG SWIFT PG27UCDM', ''), 'gaming');
  assert.equal(where('Sony BRAVIA 7 II K65XR75M2B 65 Inch 4K Ultra HD Smart LED TV HDR', ''), 'tv-home-cinema');
  assert.equal(where('D-Link 2 Megapixel H.265 Outdoor Dome Camera'), 'smart-home-wifi', 'a security camera');
  assert.equal(where('Ubiquiti (UVC-G6-INS-W-UK) Plug-and-play. 4K WiFi-connected camera', ''), 'smart-home-wifi');
  assert.equal(where('ZAGG Cases Luxe Snap Apple iPhone 16 Plus Black'), 'accessories-storage', 'a case, not a phone');
  assert.equal(where('dbramante1928 Lynge MS ICON - iPhone 18 Pro/iPhone 17 Pro - Deep Water'), 'accessories-storage');
  assert.equal(where('Apple iPhone 16 6.1" 5G Smartphone (MYE73QN/A) - 128GB, Black'), 'phones-smartwatches');
  assert.equal(where('DELL MS116 Mouse Ambidextrous USB-A Optical 1000 DPI', ''), 'laptops-computing');
  assert.equal(where('Kodak LUMA 150 PROJECTOR', O), 'tv-home-cinema');
});

const header = ['aw_deep_link', 'product_name', 'aw_product_id', 'merchant_product_id', 'merchant_image_url', 'merchant_category', 'search_price', 'brand_name', 'stock_quantity', 'condition'];
const line = v => v.map(x => (/[",\n]/.test(x) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(',');

test('graded and refurbished products are marked refurbished, whatever the feed\'s condition column says', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgw-l48-'));
  const arc = join(dir, 'arc');
  mkdirSync(arc);
  const link = id => `https://www.awin1.com/pclick.php?p=${id}&a=1&m=61655`;
  const rows = [
    [link(1), 'Dell Latitude - Intel Core i5-10310U 8Gb 256Gb 15.6" FHD Windows 11 Pro - Grey (Grade B - Average)', '1', 'B-1', 'https://img.example/1.jpg', 'Computers', '281.99', 'Dell', '3', ''],
    [link(2), 'HP 320 FHD Webcam (Grade A1 - Like New)', '2', 'B-2', 'https://img.example/2.jpg', 'Computers', '35.99', 'HP', '3', 'new'],
    [link(3), 'Corsair HS65 W/L HEADSET CARBON REFURB', '3', 'B-3', 'https://img.example/3.jpg', 'Computers', '77.87', 'Corsair', '3', ''],
    [link(4), 'RHINOSHIELD Case for iPhone 17 Pro Max Military Grade Drop Protection', '4', 'B-4', 'https://img.example/4.jpg', 'Computers', '24.99', 'Spigen', '3', ''],
    [link(5), 'Logitech MX Master 3S Performance Wireless Mouse Graphite', '5', 'B-5', 'https://img.example/5.jpg', 'Computers', '89.99', 'Logitech', '3', '']
  ];
  writeFileSync(join(arc, 'AWIN_61655_102827.csv.gz'), gzipSync(Buffer.from([line(header), ...rows.map(line)].join('\n') + '\n')));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: [{ ...BTTO }] }));
  const out = join(dir, 'out');
  mkdirSync(out);
  const { products } = await planImport({ archive: arc, sourcesFile, outDir: out, now: new Date('2026-10-24T15:00:00Z') });
  const cond = Object.fromEntries(products.map(p => [p.merchant_product_id, p.item_condition]));
  assert.deepEqual(cond, { 'B-1': 'refurbished', 'B-2': 'refurbished', 'B-3': 'refurbished', 'B-4': 'new', 'B-5': 'new' });
});

// Fifth dry run (24 Oct 2026, lessons L49).
test('fifth dry run: plugs "with SA", any Apple country code but B/A, adapters without a cable, radio links and data-centre kit out', () => {
  const fp = sourceFilter(PCHUB), fb = sourceFilter(BTTO);
  const O = `${D}>PC Components>Other`, PS = `${D}>Personal Stock`;
  const P = 'business IT, parts or services (PCHUB.UK)';
  assert.equal(where('DELL 90W Barrel (7.4 x 5mm) AC Adapter for Latitude E Series with SA (CM889-SA)', ''), NOT_UK);
  assert.equal(where('DELL 65W Barrel (7.4 x 5mm) AC Adapter for Latitude E Series with UK (HS65NS1-00)', ''), 'accessories-storage');
  assert.equal(where('Apple Magic Keyboard with Touch ID for Mac models with silicon (MXCK3MG/A)', `${D}>Peripherals>Keyboards`), NOT_UK, 'Hungarian');
  assert.equal(where('Apple MacBook Air 13-inch M4 chip 16GB 256GB (MW123D/A)'), NOT_UK);
  assert.equal(where('Apple MacBook Air 13-inch M4 chip 16GB 256GB (MW123B/A)'), 'laptops-computing');
  assert.equal(where('Apple MagSafe Charger (1 m) (MX6X3ZM/A)'), 'accessories-storage', 'no plug: sold in the UK with this code');
  for (const [n, b, p] of [['Lenovo 45N0554 135W Slim Tip AC Adapter - no cable', 'Lenovo', O], ['HP *Non Cancellable/Non Returnable (NCNR)* SSD HARDWARE KIT', 'HP', O],
    ['TP-Link CPE710 network antenna Directional antenna PoE/LAN 23 dBi', 'TP-Link', PS], ['Ubiquiti UISP WAVE-AP-MICRO bridge/repeater 5000 Mbit/s White', 'Ubiquiti', PS],
    ['Ubiquiti RP-5AC-Gen2 White Power over Ethernet (PoE)', 'Ubiquiti', `${D}>Networking>WLAN Access Points`], ['Ubiquiti E7 Campus 11500 Mbit/s White Power over Ethernet (PoE)', 'Ubiquiti', PS],
    ['Zyxel USG FLEX 50 HP. 5 Gigabit with 1 YR Gold Security Pack', 'Zyxel', O], ['Toshiba 6B000000748/T-305PK Toner black for Toshiba E-Studio 305 CS', 'Toshiba', O],
    ['Seagate Exos M internal hard drive 30 TB 7200 RPM 512 MB 3.5" (ST30000NM004K)', 'Seagate', PS]]) {
    assert.equal(fp(n, b, p), P, n);
  }
  assert.equal(fb('TP-Link CPE510 wireless access point 300 Mbit/s', 'TP-Link'), 'business IT, parts or services (Back to the Office)');
  assert.equal(fp('DELL AC Adapter 19.5V 4.62A 90W includes power cable', 'Dell', O), '');
  assert.equal(fp('HP 250GB/320GB ENCRYPTED HDD M525', 'HP', O), 'spare part from a catch-all folder (PCHUB.UK)');
  assert.equal(where('Urban Armor Gear Microsoft Surface Pro 9/10/11 Metropolis SE, BULK 33 cm (13") Cover Black'), 'accessories-storage', 'a size, not a quantity');
  assert.equal(where('HP Wired Desktop 320K Keyboard (Bulk12)'), 'REJECT trade pack (bulk quantity)');
});

test('fifth dry run: NAS, tablets, computers named by memory and disk, and fast gaming screens on the right page', () => {
  assert.equal(where('Ugreen DH4300 Plus 8GB RAM 4 Bays SATA Desktop NAS', ''), 'accessories-storage');
  assert.equal(where('Synology DS725neo+ 2 bay Plus series 32TB (2x 16TB HAT33) with Ryzen R1600', ''), 'accessories-storage');
  assert.equal(where('Synology RT6600ax Router WiFi6'), 'smart-home-wifi');
  assert.equal(where('Lenovo Tab K9 Mediatek 64 GB 22.1 cm (8.7") 4 GB Wi-Fi 5 (802.11ac) Android 14 Grey'), 'laptops-computing', 'a tablet, not Wi-Fi kit');
  assert.equal(where('OnePlus Pad 2 12.1" 256GB Nimbus Grey'), 'laptops-computing', 'a tablet, not a phone');
  assert.equal(where('MSI Prestige N16 Flip AI+ C1XMT-044UKY 32GB RAM 1TB SSD NVIDIA RTX (9S7-262111-044)', ''), 'laptops-computing', 'a laptop, not a disk');
  assert.equal(where('Acer Predator X27U F5 27 QD-OLED Quad HD 500 Hz 0.03ms Quan', ''), 'gaming', 'a gaming monitor, not a TV');
  assert.equal(where('LG OLED evo C5 65 inch 4K Smart TV 144Hz'), 'tv-home-cinema');
  assert.equal(where('Samsung 65" S95F OLED 4K HDR Smart TV 165Hz'), 'tv-home-cinema');
  assert.equal(where('Edifier R1280DB Bookshelf Speakers 55Hz-2000Hz'), 'audio', 'a speaker\'s frequencies are not a screen');
});

test('the dry-run report says what made a product "not for UK buyers"', () => {
  assert.equal(notUkHint('ASUS Vivobook S15 15.6" Laptop (90NB14Q2-M002R0) - Snapdragon X1, 16GB RAM, 1TB SSD, Windows 11 Home - US Keyboard'), 'US Keyboard');
  assert.equal(notUkHint('Apple Magic Keyboard with Touch ID (MXCK3MG/A)'), 'MXCK3MG/A');
  assert.equal(notUkHint('CHERRY KC 1000 keyboard Universal USB AZERTY Belgian Black'), 'AZERTY');
  assert.equal(notUkHint('Sandberg USB-C AC Charger PD20W EU'), 'EU');
  assert.equal(notUkHint('HP ProBook 450 G10 Laptop (85B04EA#ABD)'), '#ABD');
});

test('a laptop power brick without its mains cord is out; a phone charger "without cable" is a complete product', () => {
  const fb = sourceFilter(BTTO);
  const B = 'business IT, parts or services (Back to the Office)';
  assert.equal(fb('Origin Storage Lenovo 0B47036 power adapter/inverter Indoor 45 W Black with no cable', 'Lenovo'), B);
  assert.equal(fb('Lenovo 45N0554 135W Slim Tip AC Adapter - no cable', 'Lenovo'), B);
  assert.equal(fb('Samsung 15W PD Power Adapter (USB-C) (without Cable) Smartphone White Indoor', 'Samsung'), '');
  assert.equal(fb('Samsung 60W Super Fast Charger 3.0 (without cable)', 'Samsung'), '');
  assert.equal(fb('Western Digital Ultrastar DC SN655 3.84 TB U.3 PCI Express 4.0 NVMe TLC 3D NAND', 'Western Digital'), B, 'a data-centre SSD');
  assert.equal(fb('HP EliteStudio 8 All-in-One G1i 23.8 inch Desktop AI PC Intel Core Ultra 5', 'HP'), '', 'not a Toshiba e-STUDIO copier');
  assert.equal(fb('Apple Beats Studio Pro Headset Wired & Wireless Head-band Calls/Music USB Type-C Bluetooth Black', 'Apple'), '');
  assert.equal(fb('Panasonic PCPE-INFG2B1 strap Tablet Black', 'Panasonic'), '', 'not an outdoor CPE');
});
