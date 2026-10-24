// Technology Gear World: the check of the live site after the first import with PCHUB.UK (24 Oct 2026, lessons L50).
// 25,298 products were loaded; reading the database found about 190 that should not be there or were on the wrong page.
// Every name below is a real name from the live site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceFilter } from '../../tools/tgw-import-plan.mjs';
import { classify, cleanProductName, notUkHint } from '../../sites/tgw/category-rules.js';

const SOURCES = JSON.parse(readFileSync(new URL('../../sites/tgw/sources.json', import.meta.url), 'utf8')).sources;
const PCHUB = SOURCES.find(s => s.advertiserId === 126641);
const BTTO = SOURCES.find(s => s.advertiserId === 61655);
const PS = 'Default Category>Personal Stock';
const where = (n, p = 'Computers') => { const c = classify(n, p); return c.ok ? c.slug : `REJECT ${c.reason}`; };
const NOT_UK = 'REJECT not for UK buyers (plug or keyboard layout)';
// The feed's brand column: "HPE ..." rows are filed under HP.
const brandOf = n => (/^Western Digital\b/.test(n) ? 'Western Digital' : /^HPE\b/.test(n) ? 'HP' : n.split(' ')[0]);

test('business and data-centre kit is out in both shops', () => {
  const fp = sourceFilter(PCHUB), fb = sourceFilter(BTTO);
  const names = [
    'Synology RackStation RS2423RP+II 48TB (Synology HAT53) 12-Bay (RS2423RP+II/48TB-HAT53)',
    'Synology RS826+ 48TB (Synology HAT33) 4 bay rackstation; AMD Ryzen (RS826+/48TB-HAT33)',
    'Synology RS1626XS+ 64TB (Synology HAT53) 4-bay XS with 2x 10GbE; 16 (RS1626XS+/64TB-HAT53)',
    'Synology RS2825RP+ 64TB (Synology HAT53) with Ryzen V1780B CPU; 8GB (RS2825RP+/64TB-HAT53)',
    'QNAP TL-R1620Sep-RP HDD enclosure Black, Grey 2.5/3.5"',
    'Kioxia CD8-R 15.4 TB 2.5" PCI Express 4.0 NVMe BiCS FLASH TLC', 'Kioxia CD8P-V 6.4 TB 2.5" PCI Express 5.0 NVMe BiCS FLASH TLC',
    'Kioxia CM7-V 1.6 TB 2.5" PCI Express 5.0 NVMe BiCS FLASH TLC', 'Kioxia XD7P 1.92 TB E1.S PCI Express 5.0 NVMe BiCS FLASH TLC',
    'Kioxia 15360 Condor D8P-R KCD8XPUG15T3 SIE 15.4 TB 2.5" PCI',
    'Kingston Technology 960G DC600M (Mixed-Use) 2.5” Enterprise SATA SSD', 'Kingston Technology 1920G DC600M (Mixed-Use) 2.5” Enterprise SATA (SEDC600M/1920G)',
    'Kingston Technology 480G DC2000B PCIe 4.0 M.2 2280 Enterprise SSD',
    'Seagate Enterprise ST1200MM0009 internal hard drive 1.2 TB 10000 RPM', 'Synology Enterprise internal hard drive 20 TB 7200 RPM 512 MB (HAT5310-20T)',
    'Western Digital Gold WD Enterprise Class SATA HDD', 'Lenovo 2TB 3.5" Enterprise SATA Hot Swap internal hard drive (4XB0F28713)',
    'Synology HAS5310-12T internal hard drive 12 TB 7200 RPM 512 MB 3.5" SAS3', 'Fujitsu SAS3 cable upgr. kit for RX2540',
    'HP HPE 4TB 6G SATA 3.5in NHP MDL HDD - Bulk', 'HP HPE P40497-B21 480GB 2.5 Internal SSD - Bulk', 'HPE 775403-001 Processor Heatsink/Radiator',
    'Panasonic AW-UE100WEJ streaming camera', 'Panasonic AW-RM50AG camera remote control IR Wireless',
    'Panasonic AW-UE80 Dome IP security camera Indoor 1920 x 1080 pixels (AW-UE80WEJ)', 'Sony SRG-X40UH Dome IP security camera Indoor 3840 x 2160 pixels (SRG-X40UH/WC)',
    'Canon imageFORMULA DR-G2140 A3 High-Speed Production Network Scanner', 'Canon imageFORMULA DR-G2090 A3 Production Document Scanner',
    'HP ScanJet Enterprise Flow 9000 s1 ADF + Sheet-fed scanner 600 x 600 DPI A3 Blue, White',
    'Lenovo ThinkSmart Hub Intel® Core™ i5 i5-8365UE 25.6 cm (10.1") 1920 x 1200 pixels Touchscreen All-in-One PC 16 GB DDR4-SDRAM 256 GB SSD',
    'Zyxel CX4800-56F 48-port L3 Aggregation Fiber Switch(GB SKU)', 'Ubiquiti AF-5 wireless access point 1000 Mbit/s Power over Ethernet',
    'Ubiquiti Unifi UWB XG 1733 Mbit/s White Power over Ethernet (PoE)', 'Ubiquiti E7-Audience 11500 Mbit/s White Power over Ethernet (PoE)'
  ];
  for (const n of names) {
    assert.equal(fp(n, brandOf(n), PS), 'business IT, parts or services (PCHUB.UK)', n);
    assert.equal(fb(n, brandOf(n)), 'business IT, parts or services (Back to the Office)', n);
  }
});

test('consumer products with similar words stay', () => {
  const fp = sourceFilter(PCHUB), fb = sourceFilter(BTTO);
  const names = [
    'ASUS Dual 4K USB-C Dock DC201 Wired USB 3.2 Gen 2 (3.1 Gen 2) Type-C (90XB094N-BDS000)', 'ASUS Triple Display USB-C Dock DC300 Docking USB 3.2 Gen 2 (3.1 Gen 2) Type-C Black',
    'DELL 15 DC15250 Intel Core i7-1355U 16GB RAM 512GB SSD 15.6" (DH2Y5)', 'HP OmniBook 7 Laptop Next Gen AI 17-dc0002nax Copilot+ PC Intel Core (D77L2EA)',
    'Samsung Galaxy A55 5G Enterprise Edition 16.8 cm (6.6") Dual (SM-A556BZKAEEB)', 'Samsung Galaxy Book6 Enterprise Edition 14" Laptop (NP744BJG-KA2UK) - Intel Core Ultra 5 325, 16GB RAM, 512GB SSD, Windows 11 Pro',
    'ASUS Chromebook Plus Enterprise CB54 CB5403CMA-QM0909 Intel Core', 'Ubiquiti U6 Enterprise 4800 Mbit/s White Power over Ethernet (PoE)',
    'Ubiquiti INS-3AF-I-G PoE adapter Gigabit Ethernet 48 V', 'Ubiquiti AFi-Cable-USB-7M USB cable USB C Black. Grey',
    'DeepCool ASSASSIN IV Processor Air cooler 120/140 mm Black 1 pc(s)', 'Hama FlashPen "Fancy" USB 2.0 16GB 40X USB flash drive USB (90894)',
    'Synology DiskStation DS925+ NAS Ryzen Embedded V1500B 4 GB DDR4 64 (DS925+/64TB-HAT53)', 'Synology DS1825neo+ 8 bay Plus series 128TB (8x 16TB HAT53) (DS1825NEO+/128TB-HAT53)',
    'Skullcandy Crusher ANC 2 Headset Wired & Wireless Head-band (S6CAW-S951)',
    'Keychron K8 Pro Hot Swap Wireless Mechanical Keyboard UK ISO Layout', 'Panasonic Lumix FZ82D Bridge Camera with 20-1200mm F2.8-5.9 Lens',
    'Sony ZV-E10 II Mirrorless Camera Body Black', 'Canon imageFORMULA R40 Sheet-fed scanner 600 x 600 DPI A4 Black'
  ];
  for (const n of names) {
    assert.equal(fp(n, brandOf(n), PS), '', n);
    assert.equal(fb(n, brandOf(n)), '', n);
  }
  // "L2/L3" is a label, not a size: an 8-port home switch says it too (PCHUB.UK leaves out every "Managed" switch, as before).
  assert.equal(fb('NETGEAR GS308E Managed L2/L3 Gigabit Ethernet (10/100/1000) Black', 'NETGEAR'), '');
});

test('HP computers and keyboards with any country code but #ABU are out; printers, monitors, mice and memory stay', () => {
  for (const n of ['HP 9SR37UT#AC0 keyboard Office USB Black', 'HP 650 Wireless and Mouse Combo keyboard Mouse included Home RF (4R013AA#AC0)',
    'HP 235 WIRELESS MOUSE KB COMBO-BELG keyboard Mouse included Office (1Y4D0UT#AC0)',
    'HP Pro Mini 400 G9 Intel® Core™ i5 i5-14400T 16 GB DDR5-SDRAM 512 GB (C7FX1ET#ABD)',
    'HP ProDesk 4 Mini G1i Intel Core Ultra 5 225T 16 GB DDR5-SDRAM 512 (B6ZA0ET#UUW)',
    'HP ZGX Nano G1n AI Station GB10 128 GB LPDDR5x-SDRAM 4 TB SSD Linux (CZ9K4ET#ABD)',
    'HP Color LaserJet Pro M454dw. Print. Front-facing USB printing (W1Y45A#B19)']) {
    assert.equal(where(n, ''), NOT_UK, n);
  }
  assert.equal(notUkHint('HP 9SR37UT#AC0 keyboard Office USB Black'), '#AC0');
  for (const n of ['HP EliteBook 840 G8 Certified Refurbished Intel® Core™ i5 i5-1145G7 (C20LSE8Q#ABU)', 'HP 9SR37AA#ABU keyboard Office USB Black',
    'HP HP ProBook 460 Intel Core Ultra 7 48GB RAM 512GB SSD 16 Inch (CL8V6ET#RP-UK)',
    'HP OfficeJet Pro 8132e Wireless All-in-One Color Printer. Instant (40Q45B#687)', 'HP ENVY 6132e Wireless All-in-One Color Printer. Instant Ink; Photo (714J2B#629)',
    'HP Smart Tank 7005 Wireless All-in-One Color Printer. Two-sided (28B54A#BHC)', 'HP P24 G4 computer monitor 60.5 cm (23.8") 1920 x 1080 pixels (1A7E5AT#ABB)',
    'HP B8YX3AA#ABB mouse Home Right-hand Bluetooth + USB Type-C 6000 DPI', 'HP 4S967AA#AC3 memory module 32 GB DDR4 260-pin SO-DIMM',
    'HP 4K0V7PE/925 Ink cartridge magenta. 400 pages ISO/IEC 19752 6ml (4K0V7PE#LS1)']) {
    assert.equal(where(n, ''), 'laptops-computing', n);
  }
});

test('laptop bags are accessories; a pack of ten bags is a trade pack', () => {
  for (const n of ['HP Everyday 16-inch Laptop Backpack', 'Targus TAR300 laptop case 39.6 cm (15.6") Briefcase Black', 'DELL Pro Briefcase 15',
    'Tucano GOMMO Laptop 15.6", MacBook Pro 16" Backpack case waxed Grey', 'Kensington EQ 14" Laptop Backpack', 'Targus 13-14" Intellect Slim Briefcase',
    'Targus CityGear 3 39.6 cm (15.6") Sleeve case Black. Yellow', 'Tucano IDEA Notebook 13"/14" and MacBook Pro 14" Messenger case with mouse included Black',
    'Thule Subterra 2 TSA414 Black 35.6 cm (14") Briefcase', 'HP 14-inch Convertible Laptop Backpack Tote', 'Lenovo Tab Plus Sleeve 29.2 cm (11.5") Sleeve case Grey']) {
    assert.equal(where(n), 'accessories-storage', n);
  }
  assert.equal(where('DELL 14-16 EcoLoop Briefcase - CC3624 (Pack 10 pcs)'), 'REJECT trade pack (bulk quantity)');
  assert.equal(where('Fellowes 100142987 laminator pouch 100 pc(s)'), 'laptops-computing', 'a box of pouches is one product');
  assert.equal(where('Fellowes Shredder Bags 94 Litres'), 'laptops-computing', 'shredder bags are not laptop bags');
  assert.equal(where('Hama Valletta Camera Bag. 130 Colt. black', 'Default Category>Audio Visual>Cameras & Camcorders>Bags'), 'cameras-drones');
  assert.match(where('Monolith Leather Look Briefcase Black 43 cm'), /^REJECT/, 'a document briefcase is not a computer bag');
});

test('computers, printers and a games console named "Wi-Fi" are not Wi-Fi kit; Apple\'s monitor is not a mount', () => {
  const cases = [
    ['Microsoft Surface Pro 11 Copilot+ PC Snapdragon 512 GB 33 cm (13") 16 GB Wi-Fi 7 (802.11be) Windows 11 Pro Platinum', 'laptops-computing'],
    ['Microsoft Surface Pro 13" Snapdragon 256 GB 33 cm (13") 16 GB Wi-Fi 7 (802.11be) Windows 11 Pro Platinum', 'laptops-computing'],
    ['Canon PIXMA G3570 Inkjet A4 4800 x 1200 DPI Wi-Fi', 'laptops-computing'],
    ['Epson EcoTank ET-4956 Inkjet A4 4800 x 1200 DPI 35 ppm Wi-Fi', 'laptops-computing'],
    ['HP LaserJet MFP M248DW Laser A4 600 x 600 DPI 30 ppm Wi-Fi', 'laptops-computing'],
    ['Brother MFCL2860DWRE1 Laser A4 1200 x 1200 DPI 34 ppm Wi-Fi', 'laptops-computing'],
    ['TCL NXTPAPER 11 Plus Mediatek 256 GB 29.2 cm (11.5") 8 GB Wi-Fi 5 (802.11ac) Android 15 Grey', 'laptops-computing'],
    ['ASUS PRO WS TRX50-SAGE WIFI A AMD TRX50 Socket sTR5 CEB', 'laptops-computing'],
    ['Lenovo Legion Go S 8ARP1 portable game console 20.3 cm (8") 512 GB Touchscreen Wi-Fi Black, Violet', 'gaming'],
    ['Apple Studio Display XDR - Standard glass - VESA mount adapter (MFEN4B/A)', 'laptops-computing'],
    ['Apple Studio Display - Nano-texture glass - VESA mount adapter (MFF24B/A)', 'laptops-computing'],
    ['TP-Link Tapo Mini Smart Wi-Fi Socket, Energy Monitoring', 'smart-home-wifi'],
    ['TP-LINK DECO BE68 (2-PACK) + (2-PACK) BUNDLE', 'smart-home-wifi'],
    ['Microsoft Surface Headphones 2 Wireless Noise Cancelling', 'audio'],
    ['Urban Armor Gear Microsoft Surface Pro 9/10/11 Metropolis SE, BULK 33 cm (13") Cover Black', 'accessories-storage']
  ];
  for (const [n, slug] of cases) assert.equal(where(n), slug, n);
  assert.match(where('Canon Inkjet A4 Paper 80gsm 500 sheets'), /^REJECT/, 'paper is not a printer');
});

test('product names: the brand once, never "None"', () => {
  assert.equal(cleanProductName('HP None Intel Core Ultra 9 285HX 40.6 cm (16") 2.5K 64 GB (E4WW0EA#ABU)'), 'HP Intel Core Ultra 9 285HX 40.6 cm (16") 2.5K 64 GB (E4WW0EA#ABU)');
  assert.equal(cleanProductName('HP None Copilot+ PC Intel Core Ultra 5 35.6 cm (14") WUXGA 16 (E4WV3EA#ABU)'), 'HP Copilot+ PC Intel Core Ultra 5 35.6 cm (14") WUXGA 16 (E4WV3EA#ABU)');
  assert.equal(cleanProductName('HP HP ProBook 460 Intel Core Ultra 7 48GB RAM 512GB SSD 16 Inch (CL8V6ET#RP-UK)'), 'HP ProBook 460 Intel Core Ultra 7 48GB RAM 512GB SSD 16 Inch (CL8V6ET#RP-UK)');
  assert.equal(cleanProductName('HP HP 938 - 27 ml - black - original - Officejet - ink cartridge (4S6X8PE#LS1)'), 'HP 938 - 27 ml - black - original - Officejet - ink cartridge (4S6X8PE#LS1)');
  assert.equal(cleanProductName('【Black Friday】HP HP ProBook 460'), 'HP ProBook 460');
  assert.equal(cleanProductName('HP HPE 4TB 6G SATA 3.5in NHP MDL HDD - Bulk'), 'HP HPE 4TB 6G SATA 3.5in NHP MDL HDD - Bulk', 'HPE is another word');
  assert.equal(cleanProductName('Nothing Phone (3a) 256GB'), 'Nothing Phone (3a) 256GB');
  assert.equal(cleanProductName('Sony WH-1000XM5'), 'Sony WH-1000XM5');
});
