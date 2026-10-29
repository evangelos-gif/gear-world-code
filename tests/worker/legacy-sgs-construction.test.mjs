// L82: SGS Engineering power tools on Construction Gear World (29 Oct 2026). The car and van side stays on Car Gear World.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, RULES } from '../../tools/import-rules/sgs-construction.mjs';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const place = (name, feedCategory = '') => {
  const c = classify({ name, feedCategory });
  return c.reject ? 'out' : `${c.siteCategory}/${c.subcategory}${c.doubt ? ' (doubt)' : ''}`;
};

test('L82: power tools, air tools and their batteries go to CGW Power Tools', () => {
  assert.equal(place('Rikä RK40 40V Cordless Brushless Combi Drill | Body Only', 'Power Tools > Rikä RK40 40V Cordless Power Tools > Rikä'), 'Power Tools/Power Tools');
  assert.equal(place('Rikä RK20 4.0Ah Battery', 'Power Tools > Rikä RK20 20V > Rikä'), 'Power Tools/Power Tools');
  assert.equal(place('SGS 50 Litre Oil Free Air Compressor', 'Hardware > Tools > SGS'), 'Power Tools/Power Tools');
  assert.equal(place('SGS 1/2" Air Impact Wrench 1500Nm', 'Garage Equipment > Air Tools > SGS'), 'Power Tools/Power Tools');
  assert.equal(place('SGS 6 Inch Bench Grinder', 'Hardware > Tools > SGS'), 'Power Tools/Power Tools');
});

test('L82: hand tools and site equipment have their own CGW places', () => {
  assert.equal(place('SGS 1/2" Drive Torque Wrench 28-210Nm', 'Hand Tools > Torque Wrenches > SGS'), 'Hand Tools/Hand Tools');
  assert.equal(place('SGS 7 Drawer Roller Cabinet', 'Garage Equipment > Tool Storage > SGS'), 'Site Equipment/Site Equipment');
  assert.equal(place('SGS Diesel Space Heater 20kW', 'Heating > SGS'), 'Site Equipment/Site Equipment');
  assert.equal(place('SGS Rechargeable LED Work Light', 'Lighting > SGS'), 'Site Equipment/Lighting');
  assert.equal(place('SGS Belt Linisher 4in', 'Power Tools > Workshop Tools > SIP'), 'Power Tools/Power Tools');
  assert.equal(place('SGS Magnetic Base', 'Power Tools > Accessories > SGS'), 'Power Tools/Power Tools (doubt)');
});

test('L82: cars and vans (AGW), garden machinery (GGW), fitness and spare parts stay out', () => {
  for (const [name, cat] of [
    ['SGS 22 Tonne Professional Pneumatic Air Service Trolley Jack', 'Business & Industrial > Material Handling > Lifts & Hoists > Jacks & Lift Trucks > SGS'],
    ['Volvo V50 Boot Replacement Gas strut', 'Vehicles & Parts > Vehicle Parts & Accessories > Motor Vehicle Parts > NitroLift'],
    ['SGS Car Polisher 600W', 'Hardware > Tools > Polishers & Buffers > Rikä'],
    ["SGS Mechanic's Apprentice Tool Bag Kit | 145 Automotive Tools", 'Hand Tools > SGS'],
    ['SGS Engine Crane 2 Tonne', 'Garage Equipment > SGS'],
    ['Rikä 40V Cordless Lawn Mower', 'Garden > Rikä'],
    ['Rikä 20V Cordless Hedge Trimmer', 'Garden > Rikä'],
    ['SGS Folding Treadmill', 'Sports > Fitness > SGS'],
    ['Replacement Carbon Brushes for SGS Angle Grinder', 'Power Tools > SGS']
  ]) assert.equal(place(name, cat), 'out', name);
  assert.equal(RULES.advertiserId, 28807);
  assert.ok(RULES.shop.test('https://www.sgs-engineering.com/rika-rk40-combi-drill'));
});

test('L82, first dry run (29 Oct 2026): Rikä is a brand, not a power tool; machine parts and hydraulics stay out', () => {
  assert.equal(place('Rikä 20oz Fibreglass Claw Hammer with Soft Grip Handle', 'Hand Tools > Hammers > Rikä'), 'Hand Tools/Hand Tools');
  assert.equal(place('Rikä FFNR008 1st Fix Collated Nails Galv Ring 51 x 2.8mm 3000pk (No Fuel)'), 'Hand Tools/DIY');
  assert.equal(place('Rikä TWSR028 Woodscrew Twin-Thread CSK BZP 10 x 1in 200pk'), 'Hand Tools/DIY');
  assert.equal(place('Rikä RK40 40V SDS-Plus Rotary Hammer Drill Kit | Tabless | 4Ah'), 'Power Tools/Power Tools');
  assert.equal(place('Teng Tools 26in Classic Cabinet 7 Drawers Red', 'Tool Storage > Tool Chests & Cabinets > Teng Tools'), 'Site Equipment/Site Equipment');
  assert.equal(place('SGS LED Headlamp | Rechargeable | 400 Lumen'), 'Site Equipment/Lighting');
  assert.equal(place('SGS Heavy Duty Bolt Cutters 36in'), 'Hand Tools/Hand Tools');
  for (const [name, cat] of [['M6x16 Bolt', 'Hardware > Tools > SGS'], ['GPS520 Handle Bracket Assembly (40, 41, 42, 43 & 44)', 'Hardware > Tools > SGS'],
    ['SWV40 2.5m Hose 38mm diameter', 'Hardware > Tools > SGS'], ['Power Team HDT10273 O Ring (-114) Nitrile .81 X .62', 'Hardware > Tools > Hydraulic Technologies'],
    ['Female QRC to 1/4 BSPM', 'Hardware > Tools > Compressors > SGS'], ['V-TUF MIDI Spare pack of bags (10Bags)', 'Hardware > Tools > V-Tuf'],
    ['SC24H / SC50H / SC50T Cowling', 'Hardware > Tools > Compressors > SGS']]) assert.equal(place(name, cat), 'out', name);
});

test('L82, third dry run: brushcutters are garden; air impact kits and auger bits are power tools; dumpers are site equipment', () => {
  assert.equal(place('Stihl FSA 30 (AS) 11V Cordless Brushcutter (Body Only)', 'Power Tools > Garden > Stihl'), 'out');
  assert.equal(place('SGS 1/2 Inch Air Impact & 3/8 Inch Ratchet Wrench 15pcs Kit Rubber Grip'), 'Power Tools/Power Tools');
  assert.equal(place('Rikä WABR015 Wood Auger Bit 18mm x 160/235', 'Hardware > Tool Accessories > Drill & Screwdriver Accessories > Drill & Screwdriver Bits > Rikä'), 'Power Tools/Power Tools');
  assert.equal(place('Hyundai 196cc 300kg Petrol Tracked Mini Dumper Power Barrow Transporter', 'Home & Garden > Lawn & Garden > Gardening > Gardening Tools > Wheelbarrows > Hyundai'), 'Site Equipment/Site Equipment');
  assert.equal(place('Ground Guard Fast Cover Plus Interlocking System', 'Garage Equipment > Garage Flooring > Standard > GroundGuard'), 'Site Equipment/Site Equipment');
});

test('L85: one product number in both SGS feeds with two links becomes ONE card (the import of 29 Oct 2026 stopped on it)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sgs-'));
  const head = 'merchant_product_id,product_name,brand_name,search_price,currency,merchant_category,ean,merchant_deep_link,merchant_image_url\n';
  const row = (mid, name, link) => `${mid},"${name}",Rikä,119.99,GBP,Power Tools > Rikä RK40 > Rikä,5056000000001,${link},https://www.sgs-engineering.com/images/${mid}.jpg\n`;
  writeFileSync(join(dir, 'AWIN_28807_94852.csv.gz'), gzipSync(head
    + row('RK40IW', 'Rikä RK40 40V Cordless Impact Wrench | Body Only', 'https://www.sgs-engineering.com/rika-rk40-impact-wrench')
    + row('RK40CD', 'Rikä RK40 40V Cordless Combi Drill | Body Only', 'https://www.sgs-engineering.com/rika-rk40-combi-drill')));
  writeFileSync(join(dir, 'AWIN_28807_95330.csv.gz'), gzipSync(head
    + row('RK40IW', 'Rikä RK40 40V Cordless Impact Wrench | Body Only', 'https://www.sgs-engineering.com/power-tools/rika-rk40-impact-wrench')));
  const r = await planLegacyImport({ archive: dir, retailer: 'sgs-construction', outDir: mkdtempSync(join(tmpdir(), 'sgs-out-')), now: new Date('2026-10-29T23:30:00Z') });
  assert.deepEqual(r.accepted.cgw.map(p => p.merchant_product_id).sort(), ['RK40CD', 'RK40IW']);
  assert.equal((r.rejected['the same product number twice in the feeds (another link): kept once'] || []).length, 1);
});
