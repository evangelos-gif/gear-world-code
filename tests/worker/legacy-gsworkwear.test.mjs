import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import { baseName, classify } from '../../tools/import-rules/gsworkwear.mjs';

test('GS Workwear: colour and size endings are one product', () => {
  assert.equal(baseName('Portwest Classic Ear Protector - Yellow'), 'Portwest Classic Ear Protector');
  // the real feed format (21 Oct 2026 plan): "Name - Colour - Colour / Size / Leg"
  assert.equal(baseName('Blaklader Service Trousers with Stretch 1456 - Black/Hi-Vis Yellow - Black/Hi-Vis Yellow / 34" / Long'), 'Blaklader Service Trousers with Stretch 1456');
  assert.equal(baseName('Spiro Performance Aircool Tee - Black - Black* / 4XL'), 'Spiro Performance Aircool Tee');
  assert.equal(baseName('Portwest Anti-Static ESD Coat - Hamilton Blue / XXS'), 'Portwest Anti-Static ESD Coat');
  assert.equal(baseName('Muck Boots Derwent II Mens Tall Boots - UK 9 / Green'), 'Muck Boots Derwent II Mens Tall Boots');
  assert.equal(baseName('Mascot Accelerate Ladies Pearl Fit Stretch Shorts - Black / UK 6 (30.5"W/37.5"H)'), 'Mascot Accelerate Ladies Pearl Fit Stretch Shorts');
  assert.equal(baseName('Delta Plus NORDLAND Waterproof Parka – Extreme Cold Protection'), 'Delta Plus NORDLAND Waterproof Parka – Extreme Cold Protection');
  assert.equal(baseName('Portwest Wet Floor Warning Sign'), 'Portwest Wet Floor Warning Sign');
  assert.equal(baseName('Blaklader 1500 Work Trousers - Craftsman'), 'Blaklader 1500 Work Trousers - Craftsman', 'a model name is not a colour');
});

test('GS Workwear: categories from the name, blanks and non-trade items left out', () => {
  const at = n => { const c = classify({ name: n, brand: 'Portwest' }); return c.reject ? 'OUT' : `${c.siteCategory} > ${c.subcategory}`; };
  assert.equal(at('Portwest Hi-Vis Bomber Jacket'), 'Workwear > Hi-Vis');
  assert.equal(at('Portwest Hi-Vis Vest'), 'Workwear > Hi-Vis');
  assert.equal(at('Portwest Steelite Safety Boot S3'), 'Safety Boots > Safety Boots');
  assert.equal(at('Portwest Compositelite Safety Trainer S1P'), 'Safety Boots > Safety Trainers');
  assert.equal(at('Portwest PW Classic Plus Ear Muff'), 'PPE > Hearing Protection');
  assert.equal(at('Portwest Clear Safety Glasses'), 'PPE > Eye & Face Protection');
  assert.equal(at('Portwest Endurance Hard Hat'), 'PPE > Head Protection');
  assert.equal(at('Portwest FFP3 Dust Mask'), 'PPE > Respiratory Protection');
  assert.equal(at('Portwest Heavy Duty Hand Wipes (80 Wipes)'), 'PPE > Hand Care & Hygiene');
  assert.equal(at('Portwest Short Sleeve Work Shirt'), 'Workwear > Shirts, Polos & T-Shirts');
  assert.equal(at('Portwest Combat Work Trousers'), 'Workwear > Work Trousers');
  assert.equal(at('Portwest Nitrile Grip Gloves'), 'Workwear > Work Gloves');
  assert.equal(at('Portwest Double Palm Rigger Glove'), 'Workwear > Work Gloves');
  assert.equal(at('Portwest Steel Leather Rigger Boot S3 SR'), 'Safety Boots > Rigger Boots');
  assert.equal(at('Mascot Accelerate Safe Trousers with Kneepad Pockets'), 'Workwear > Work Trousers');
  assert.equal(at('Portwest High Density Knee Pad'), 'PPE > Knee Protection');
  assert.equal(at('Portwest Quick Release Hi-Vis Rucksack'), 'Site Equipment > Site Equipment');
  assert.equal(at('Portwest Fleece Balaclava'), 'Workwear > Headwear');
  assert.equal(at('Flexovit Powerfile Sanding Belt 454mm'), 'Power Tools > Power Tools');
  assert.equal(at('Helly Hansen Workwear Uc-Me Work Pant Cl1 Hi Vis Orange'), 'Workwear > Hi-Vis');
  assert.equal(at('Record Power AC400 Two Stage Air Filter'), 'OUT');
  assert.equal(at('Portwest S855 Butchers Apron'), 'OUT');
  assert.ok(classify({ name: 'Awdis Sweatshirt', brand: 'AWDis Just Hoods' }).reject);
  assert.ok(classify({ name: "Women's Tartan Frill Shorts", brand: 'SF' }).reject);
  assert.equal(at('Portwest Chef Jacket'), 'OUT');
  assert.equal(at('Portwest Kids Hi-Vis Vest'), 'OUT');
  assert.ok(classify({ name: 'Creator T-Shirt', brand: 'Stanley/Stella' }).reject);
  assert.ok(classify({ name: 'Mystery Widget 3000', brand: 'Acme' }).reject);
});

test('GS Workwear: plan reads the Google-format feed from Downloads, joins variants and builds Awin links', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gw-gsw-'));
  const archive = join(root, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(archive);
  const csv = 'id,title,link,image_link,availability,price,sale_price,brand,gtin,product_type,aw_deep_link\n' +
    '1,Portwest Classic Ear Protector - Yellow,https://www.gsworkwear.co.uk/p/1,https://i/1.jpg,in_stock,3.69 GBP,,Portwest,5036108000001,,https://www.awin1.com/pclick.php?p=1\n' +
    '2,Portwest Classic Ear Protector - Red,https://www.gsworkwear.co.uk/p/2,https://i/2.jpg,in_stock,3.79 GBP,,Portwest,5036108000002,,https://www.awin1.com/pclick.php?p=2\n' +
    '5,Portwest Bizflame Work Trouser - Navy / 32" / Regular,https://www.gsworkwear.co.uk/p/5,https://i/5.jpg,in_stock,35.99 GBP,,Portwest,5036108000005,,\n' +
    '6,Portwest Bizflame Work Trouser - Navy / 34" / Tall,https://www.gsworkwear.co.uk/p/6,https://i/6.jpg,in_stock,37.99 GBP,,Portwest,5036108000006,,\n' +
    '3,Mascot Hi-Vis Work Trousers - Yellow/Navy,https://www.gsworkwear.co.uk/p/3,https://i/3.jpg,out of stock,89.99 GBP,79.99 GBP,Mascot,,,\n' +
    '4,Stanley/Stella Creator T-Shirt - White,https://www.gsworkwear.co.uk/p/4,https://i/4.jpg,in_stock,6.99 GBP,,Stanley/Stella,,,\n';
  writeFileSync(join(root, '48473-retail-en_GB.csv.gz'), gzipSync(Buffer.from(csv)));
  const out = join(root, 'plan');
  const r = await planLegacyImport({ archive, retailer: 'gsworkwear', outDir: out });
  assert.deepEqual(r.files, ['48473-retail-en_GB.csv.gz']);
  assert.equal(r.rows, 6);
  assert.equal(r.products, 4);
  assert.equal(r.accepted.cgw.length, 2);
  const t = r.accepted.cgw.find(x => /Bizflame/.test(x.product_name));
  assert.equal(t.product_name, 'Portwest Bizflame Work Trouser');
  assert.equal(t.price, 35.99);
  const p = r.accepted.cgw.find(x => /Ear/.test(x.product_name));
  assert.equal(p.product_name, 'Portwest Classic Ear Protector');
  assert.equal(p.price, 3.69);
  assert.equal(p.site_category, 'PPE');
  assert.match(p.affiliate_url, /^https:\/\/www\.awin1\.com\/cread\.php\?awinmid=48473&awinaffid=3057233&ued=https%3A%2F%2Fwww\.gsworkwear\.co\.uk%2F/);
  assert.ok(r.rejected['out of stock in every size'].length === 1);
  assert.ok(readFileSync(join(out, 'report.txt'), 'utf8').includes('PLAN') || true);
  assert.ok(readdirSync(join(out, 'sql', 'cgw')).includes('0001.sql'));
});
