// Daisycon Wave 3 (chat 9, 17 Nov 2026): the rules of the shops chosen from the profile of 96 feeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeOf, SHOPS } from '../../tools/import-rules/lib/westwing.mjs';
import * as wwNl from '../../tools/import-rules/westwing-nl.mjs';
import * as wwEs from '../../tools/import-rules/westwing-es.mjs';
import config from '../../sites/hgw/site.config.js';

test('Westwing: the place on HGW comes from the English category path, never from the Dutch/German/... name', () => {
  const at = c => { const p = placeOf(c); return p ? `${p.siteCategory} > ${p.subcategory}` : null; };
  assert.equal(at('Sofas'), 'Furniture > Sofa');
  assert.equal(at('Sofa Accessories|Sectional Sofa Units'), 'Furniture > Sofa');
  assert.equal(at('Decor|Rugs'), 'Home Decor > Rug');
  assert.equal(at('Decor|Throw Pillows'), 'Home Decor > Cushion', 'a throw pillow is a cushion, not a bed pillow');
  assert.equal(at('Beds & Accessories|Beds & Bed Frames'), 'Furniture > Bed Frame');
  assert.equal(at('Linens & Bedding|Bedding|Duvet Covers'), 'Bedding & Bath > Duvet');
  assert.equal(at('Linens & Bedding|Bedding|Bed Sheets'), 'Bedding & Bath > Bed Linen');
  assert.equal(at('Linens & Bedding|Bedding|Pillowcases & Shams'), 'Bedding & Bath > Pillow');
  assert.equal(at('Linens & Bedding|Towels'), 'Bedding & Bath > Towel');
  assert.equal(at('Lighting|Lamps'), 'Lighting > Table Lamp');
  assert.equal(at('Lighting|Lighting Fixtures|Ceiling Light Fixtures'), 'Lighting > Ceiling Light');
  assert.equal(at('Chairs'), 'Furniture > Dining Chair');
  assert.equal(at('Decor|Seasonal & Holiday Decorations'), 'Home Decor > Christmas');
  assert.equal(at('Apparel & Accessories|Jewelry'), null, 'jewellery is not a home product');
  assert.equal(at('Food, Beverages & Tobacco|Food Items'), null);
  assert.equal(at('Kitchen & Dining|Tableware|Dinnerware'), null, 'not sure: left out');
});

test('Westwing: one rules file per country, Daisycon links, the shop page of that country only', () => {
  assert.equal(wwNl.RULES.advertiserId, 17294);
  assert.equal(wwNl.RULES.network, 'daisycon');
  assert.equal(wwNl.RULES.retailer, 'Westwing NL');
  assert.ok(wwNl.RULES.shop.test('https://www.westwing.nl/loungefauteuil-steve-123.html'));
  assert.ok(!wwNl.RULES.shop.test('https://www.westwing.de/x.html'));
  assert.equal(wwEs.RULES.advertiserId, 20708);
  assert.deepEqual(wwNl.classify({ name: 'Bank Stella (3-zits)', feedCategory: 'Sofas', awinCategory: 'Furniture' }),
    { site: 'hgw', siteCategory: 'Furniture', subcategory: 'Sofa', name: 'Bank Stella (3-zits)' });
  assert.ok(wwNl.classify({ name: 'Vergulde armband Jeanne', feedCategory: 'Jewelry', awinCategory: 'Apparel & Accessories' }).reject);
});

test('Westwing: each country shop is seen only in its own country and language (L165)', () => {
  const d = config.deliversTo;
  for (const [code, s] of Object.entries(SHOPS)) {
    assert.deepEqual(d.retailers[`Westwing ${s.country}`], [s.country], code);
    assert.equal(d.languages[`Westwing ${s.country}`], s.language, code);
  }
});

// ---- Daisycon on the new-engine sites (lessons L170) ----
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { networkShopId, shopIdOf } from '../../tools/tgw-import-plan.mjs';
import { planSgwImport } from '../../tools/sgw-import-plan.mjs';

test('L170: a shop of another network gets its own negative number, per network and per country, never an Awin id', () => {
  assert.equal(networkShopId('daisycon', 20164), -200000020164);
  assert.notEqual(networkShopId('daisycon', 20164, 'GB'), networkShopId('daisycon', 20164, 'DE'));
  assert.notEqual(networkShopId('daisycon', 20164), networkShopId('cj', 20164));
  assert.ok(networkShopId('bol', 99999999, 'ZZ') > -Number.MAX_SAFE_INTEGER);
  assert.equal(networkShopId('other', 1), 0);
  assert.equal(networkShopId('daisycon', 'x'), 0);
  assert.equal(shopIdOf({ advertiserId: 20164 }), 20164, 'an Awin shop keeps its own advertiser id');
  assert.equal(shopIdOf({ advertiserId: 20164, network: 'daisycon', country: 'GB' }), networkShopId('daisycon', 20164, 'GB'));
});

test('L170: a Daisycon feed on SGW - its own link test, its own key, and the clean-up never touches the Awin shop with the same number', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sgw-dc-'));
  const a = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(a);
  const out = join(dir, 'out');
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean,merchant_deep_link\n';
  const dc = n => `https://lt45.net/c/?si=20607&li=1&wi=447289&pid=${n}&dl=p%2F${n}`;
  writeFileSync(join(a, 'DAISYCON_20607.csv.gz'), gzipSync(head
    + `${dc(1)},Asics Gel Nimbus 26 Running Shoes,1,R-1,https://img.example/1.jpg,Apparel & Accessories|Shoes,129.99,GBP,Asics,1,4550456000001,https://www.tradeinn.com/runnerinn/en/1\n`
    + `https://www.awin1.com/pclick.php?p=2&a=1&m=20607,Nike Pegasus 41 Running Shoes,2,R-2,https://img.example/2.jpg,Apparel & Accessories|Shoes,99.99,GBP,Nike,1,,https://www.tradeinn.com/runnerinn/en/2\n`));
  writeFileSync(join(a, 'AWIN_20607_5.csv.gz'), gzipSync(head
    + `https://www.awin1.com/pclick.php?p=9&a=1&m=20607,Ronhill Tech Running Tee,9,A-9,https://img.example/9.jpg,Sports,35,GBP,Ronhill,1,,https://shop.example/9\n`));
  const sources = join(dir, 'sources.json');
  writeFileSync(sources, JSON.stringify({ sources: [
    { advertiserId: 20607, network: 'daisycon', file: '^DAISYCON_20607\\.csv\\.gz$', retailer: 'RunnerInn', currency: 'GBP', approved: true, sportShop: true, defaultSlug: 'running' },
    { advertiserId: 20607, feedIds: [5], retailer: 'Awin Shop 20607', currency: 'GBP', approved: true, sportShop: true, defaultSlug: 'running' },
    { advertiserId: 1, network: 'nonet', file: 'x', retailer: 'Broken', currency: 'GBP', approved: true }
  ] }));
  const { stats, report, products } = await planSgwImport({ archive: a, sourcesFile: sources, outDir: out, now: new Date('2026-11-17T21:00:00Z') });
  assert.equal(stats.rejected['link is not a Daisycon link'], 1, 'an Awin link in a Daisycon feed earns nothing for that shop');
  const dcRow = products.find(p => p.retailer === 'RunnerInn');
  assert.equal(dcRow.awin_advertiser_id, networkShopId('daisycon', 20607));
  assert.equal(dcRow.stable_key, `${networkShopId('daisycon', 20607)}:R-1`);
  assert.equal(products.find(p => p.retailer === 'Awin Shop 20607').awin_advertiser_id, 20607);
  assert.match(report, /Broken: "network" nonet needs a known network/);
  const fin = readFileSync(join(out, 'sql', '9999-finish.sql'), 'utf8');
  assert.match(fin, /WHERE awin_advertiser_id IN \((?:20607, -200000020607|-200000020607, 20607)\)/, 'each shop by its own number');
  assert.ok(readdirSync(join(out, 'sql')).includes('0001.sql'));
});
