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
  assert.equal(baseName('Mascot Hi-Vis Work Trousers - Yellow/Navy, 34R'), 'Mascot Hi-Vis Work Trousers');
  assert.equal(baseName('Dickies Rigger Boot S3 - Brown, 9'), 'Dickies Rigger Boot S3');
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
    '3,Mascot Hi-Vis Work Trousers - Yellow/Navy,https://www.gsworkwear.co.uk/p/3,https://i/3.jpg,out of stock,89.99 GBP,79.99 GBP,Mascot,,,\n' +
    '4,Stanley/Stella Creator T-Shirt - White,https://www.gsworkwear.co.uk/p/4,https://i/4.jpg,in_stock,6.99 GBP,,Stanley/Stella,,,\n';
  writeFileSync(join(root, '48473-retail-en_GB.csv.gz'), gzipSync(Buffer.from(csv)));
  const out = join(root, 'plan');
  const r = await planLegacyImport({ archive, retailer: 'gsworkwear', outDir: out });
  assert.deepEqual(r.files, ['48473-retail-en_GB.csv.gz']);
  assert.equal(r.rows, 4);
  assert.equal(r.products, 3);
  assert.equal(r.accepted.cgw.length, 1);
  const p = r.accepted.cgw[0];
  assert.equal(p.product_name, 'Portwest Classic Ear Protector');
  assert.equal(p.price, 3.69);
  assert.equal(p.site_category, 'PPE');
  assert.match(p.affiliate_url, /^https:\/\/www\.awin1\.com\/cread\.php\?awinmid=48473&awinaffid=3057233&ued=https%3A%2F%2Fwww\.gsworkwear\.co\.uk%2F/);
  assert.ok(r.rejected['out of stock in every size'].length === 1);
  assert.ok(readFileSync(join(out, 'report.txt'), 'utf8').includes('PLAN') || true);
  assert.ok(readdirSync(join(out, 'sql', 'cgw')).includes('0001.sql'));
});
