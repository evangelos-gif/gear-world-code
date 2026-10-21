// Car Gear World import plan (dry run): AGW rules on fake feeds, euro prices kept, toys and child seats out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planAgwImport } from '../../tools/agw-import-plan.mjs';
import { classify } from '../../sites/agw/category-rules.js';

test('AGW rules put real-looking products in the right category and keep look-alikes out', () => {
  const cases = [
    ['Sealey Portable Adjustable Type 2 EV Charger', 'Automotive Tools > EV', 'ev-charging'],
    ['Sealey SBC6 Battery Charger and Maintainer 12V 6A Automatic', 'Automotive Tools > Batteries', 'diagnostics-battery'],
    ['OTOFIX D1 Lite OBD2 Scanner, Automotive Diagnostic Device', 'Vehicles & Parts', 'diagnostics-battery'],
    ['Fast Inflation 150PSI Wired Tire Inflator', 'Vehicles & Parts', 'tyres-wheels'],
    ['Draper 2 In 1 Microfibre Car Wash Mitt', 'Automotive Tools > Car Care', 'car-care-detailing'],
    ['Nextbase Dash Cam with 32GB SD Card', 'Car Electronics', 'car-electronics'],
    ['Universal Car Seat Covers Black', 'Car Accessories', 'interior-comfort'],
    ['Draper 50mm Tow Ball', 'Automotive Tools > Towing', 'roof-towing-exterior'],
    ['CarPlan Blue Star De-Icer Trigger Spray 500ml', 'Vehicles & Parts', 'safety-winter'],
    ['NitroLift Audi A6 Avant Tailgate Gas Strut', 'Vehicles & Parts > Vehicle Parts & Accessories', 'parts-maintenance'],
    ['Sealey 3/8" Drive Magnetic Spark Plug Socket 16mm', 'Automotive Tools > Vehicle Repairs & Servicing > Engine', 'garage-tools-equipment'],
    ['SGS 3 Tonne Long Reach Service Trolley Jack', 'Business & Industrial > Material Handling > Lifts', 'garage-tools-equipment'],
    ['VEVOR Type 2 laadkabel voor elektrische EV', 'Elektrisch > EV Chargers', 'ev-charging'],
    ['Sealey Trim Clip Removal Pliers', 'Hand Tools > Pliers > Gripping Tools > Automotive', 'garage-tools-equipment'],
    ['NitroLift Audi A6 Avant Tailgate Gas Strut', 'Hardware > Hardware Accessories > NitroLift', 'parts-maintenance'],
    ['NitroLift Vauxhall Astra G 1998-2004 Tailgate / Boot Gas Support', 'Vehicles & Parts > Vehicle Parts & Accessories', 'parts-maintenance'],
    ['Sealey TA201 Digital Automotive Analyser 13 Function', 'Automotive Analysers', 'diagnostics-battery'],
    ['HG Car Windscreen De-Icer Spray 500ml', 'Vehicles & Parts > Vehicles > Motor Vehicles > Cars', 'safety-winter'],
    ['SGS Magnetic Parts Tray', 'Vehicles & Parts/Vehicle Parts & Accessories', 'garage-tools-equipment']
  ];
  for (const [name, cat, slug] of cases) assert.equal(classify(name, cat).slug, slug, name);
  // The full category path (third argument) decides when the leaf alone does not say garden.
  assert.equal(classify('ALM RCJ7Y Spark Plug', 'Spark Plugs', 'Spark Plugs | Garden Tools > Spark Plugs > Garden Machinery').ok, false);
  for (const [name, cat] of [
    ['Monster Jam Rev N Roar El Toro Loco', 'Vehicles & Parts'],
    ['Maxi-Cosi Pearl 360 ISOFIX Car Seat', 'Baby & Toddler'],
    ['Cars puzzel', 'Speelgoed'],
    ['Classic Car T-Shirt', 'Clothing'],
    ['Oxford Motorcycle Cover', 'Vehicles & Parts'],
    ['Reidl DIN 913 Gewindestifte M 4x4', 'Befestigung'],
    ['Bosch 18V Combi Drill', 'Power Tools > Drills'],
    ['Handy Lawnmower Oil Change Kit', 'Garden'],
    // From the first real dry run (21 Oct 2026):
    ['Bosch GAL 18V-160 18v Li-Ion Fast Battery Charger', 'Battery Chargers'],
    ['Bosch GDM 600-15 Digital Multimeter', 'Multimeters'],
    ['ALM RCJ7Y Spark Plug', 'Garden Tools > Spark Plugs > Garden Machinery > Parts'],
    ['Handy 10W/30 Engine Oil in Portable Dispenser Can 5l', 'Garden Tools > Engine Oil > Garden Machinery'],
    ['Sealey Pneumatic Tyre Platform Trolley Truck 450Kg', 'Garden Tools > Carts, Trolleys & Wheelbarrows'],
    ['Draper 12v Car Charger for D20 20v Lithium Ion Batteries', 'Power Tool Accessories > Battery Packs'],
    ['VEVOR Bureau organizer met lades auto', 'Opslag en organisatie > Kantoorartikelen > Bureauorganisatoren'],
    ['NitroLift Gas Strut 200N 300mm', 'Hardware > Hardware Accessories > NitroLift'],
    ['Snow Sled 2 seat', 'Vehicles & Parts > Vehicles > Motor Vehicles > Snowmobiles']
  ]) assert.equal(classify(name, cat).ok, false, name);
});

test('plan: reads every file of a retailer, keeps euro prices, writes SQL that is not executed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agw-plan-'));
  const out = join(dir, 'out');
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean\n';
  const link = (p, m) => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=${m}`;
  writeFileSync(join(dir, 'AWIN_496_118674.csv.gz'), gzipSync(head
    + `${link(1, 496)},Sealey 3 Tonne Trolley Jack,1,TU-1,https://img.example/1.jpg,Automotive Tools > Lifting,89.95,,Sealey,1,5051747000000\n`
    + `${link(2, 496)},Bosch 18V Combi Drill,2,TU-2,https://img.example/2.jpg,Power Tools > Drills,99.95,,Bosch,1,\n`
    + `${link(3, 496)},Draper Tyre Tread Depth Gauge,3,TU-3,https://img.example/3.jpg,Automotive Tools > Tyres,10.95,,Draper,0,\n`));
  writeFileSync(join(dir, 'AWIN_118435_99.csv.gz'), gzipSync(head
    + `${link(4, 118435)},VEVOR 4K Dashcam voor auto,4,V-1,https://img.example/4.jpg,Automobiel > Elektronica,90.99,EUR,VEVOR,1,\n`
    + `${link(5, 118435)},Remote Control Car Red,5,V-2,https://img.example/5.jpg,Speelgoed,19.99,EUR,VEVOR,1,\n`));
  const sources = join(dir, 'sources.json');
  writeFileSync(sources, JSON.stringify({ sources: [
    { advertiserId: 496, retailer: 'Tooled Up', currency: 'GBP', approved: true },
    { advertiserId: 118435, retailer: 'VEVOR', currency: 'EUR', approved: true }
  ] }));
  const { stats, report } = await planAgwImport({ archive: dir, sourcesFile: sources, outDir: out, now: new Date('2026-10-21T20:00:00Z') });
  assert.equal(stats.rows, 5);
  assert.equal(stats.accepted, 2);
  assert.equal(stats.perCategory['garage-tools-equipment'], 1);
  assert.equal(stats.perCategory['car-electronics'], 1);
  assert.equal(stats.rejected['out of stock'], 1);
  assert.match(report, /AGW IMPORT PLAN/);
  assert.match(report, /Tooled Up \(496: all files\)/);
  const sql = readFileSync(join(out, 'sql', readdirSync(join(out, 'sql')).find(f => f === '0001.sql')), 'utf8');
  assert.match(sql, /-- AGW import plan .* NOT executed/);
  assert.match(sql, /'VEVOR', 'car-electronics'.*'EUR'/);
});
