// Technology Gear World: PcNova.co.uk (Awin 125822) and GamingKit (124146), approved on 25 Oct 2026 (lessons L63). Both send
// the same wholesale catalogue as PCHUB.UK, so they take PCHUB's rules (rulesFrom); GamingKit says in_stock = 1 on all
// 50,000 rows while most have stock_quantity = 0; the dry run counts the same product at two shops. Names, folders and
// prices are from the awin-feed-sample report of 25 Oct 2026.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planImport, resolveSources, rowStock, crossShopOverlap, RULE_FIELDS } from '../../tools/tgw-import-plan.mjs';

const SOURCES = JSON.parse(readFileSync(new URL('../../sites/tgw/sources.json', import.meta.url), 'utf8')).sources;
const D = 'Default Category';

test('PcNova.co.uk and GamingKit are TGW sources with the rules of PCHUB.UK', () => {
  const all = resolveSources(SOURCES);
  const pchub = all.find(s => s.advertiserId === 126641);
  for (const [id, feed, name] of [[125822, 114610, 'PcNova.co.uk'], [124146, 113741, 'GamingKit']]) {
    const raw = SOURCES.find(s => s.advertiserId === id);
    assert.ok(raw && raw.approved, name);
    assert.equal(raw.rulesFrom, 126641, `${name} takes PCHUB's rules`);
    assert.ok(!raw.allowPaths && !raw.brands, `${name} has no second copy of the rules`);
    const s = all.find(x => x.advertiserId === id);
    assert.deepEqual(s.feedIds, [feed]);
    assert.equal(s.retailer, name);
    for (const k of RULE_FIELDS) assert.deepEqual(s[k], pchub[k], `${name}: ${k}`);
  }
  assert.equal(all.find(s => s.advertiserId === 124146).stockFromQuantity, true);
  assert.equal(all.find(s => s.advertiserId === 125822).stockFromQuantity, undefined);
  // A field of the shop itself wins; a missing base shop is an error, not a shop without rules.
  const mine = resolveSources([{ advertiserId: 1, retailer: 'A', brands: ['x'], nameCutAt: 69 }, { advertiserId: 2, retailer: 'B', rulesFrom: 1, nameCutAt: 80 }]);
  assert.deepEqual(mine[1].brands, ['x']);
  assert.equal(mine[1].nameCutAt, 80);
  assert.throws(() => resolveSources([{ advertiserId: 2, retailer: 'B', rulesFrom: 9 }]), /rulesFrom 9/);
});

test('stock: GamingKit trusts stock_quantity, the other shops the in_stock column', () => {
  const gk = { stockFromQuantity: true };
  assert.equal(rowStock(gk, '1', '0'), false, 'in_stock 1 but none in stock');
  assert.equal(rowStock(gk, '1', '16'), true);
  assert.equal(rowStock(gk, '0', '3'), true);
  assert.equal(rowStock(gk, '1', ''), true, 'no quantity: in_stock decides');
  assert.equal(rowStock({}, '1', '0'), true, 'other shops: unchanged');
  // Without an in_stock value the caller's pick already falls back to stock_quantity ('0'), as before.
  assert.equal(rowStock({}, '0', '0'), false);
});

test('the same product at two shops is counted per pair, with the cheaper side; a range EAN is not used', () => {
  const p = (retailer, name, price, gtin = null) => ({ retailer, product_name: name, price, gtin });
  const rows = [
    p('PCHUB.UK', 'Logitech Mouse M90', 21.65, '5099206021877'),
    p('PcNova.co.uk', 'Logitech M90 Mouse USB', 20.80, '5099206021877'),
    p('PCHUB.UK', 'TP-Link Archer C50 wireless router', 42.47),
    p('PcNova.co.uk', 'TP-Link Archer C50 wireless router', 44.15),
    p('PcNova.co.uk', 'Kensington Car Mount for Smartphones', 23.14, '5028252291224'),
    // GamingKit's made-up EAN on 4 different names: a code for nothing, never a match.
    p('GamingKit', 'MSI EdgeMesa N AI+', 8342.32, '012345678912'),
    p('GamingKit', 'HP Pavilion Wired Keyboard 300', 104.81, '012345678912'),
    p('GamingKit', 'Multibrackets 7340234813179', 759.80, '012345678912'),
    p('GamingKit', 'Motorola Moto E20 Battery Cover', 17.00, '012345678912'),
    p('PCHUB.UK', 'Motorola Moto E20 Battery Cover Rear', 18.00, '012345678912')
  ];
  const { perShop, pairs } = crossShopOverlap(rows);
  assert.deepEqual(perShop['PcNova.co.uk'], { kept: 3, elsewhere: 2 });
  assert.deepEqual(perShop['PCHUB.UK'], { kept: 3, elsewhere: 2 });
  assert.deepEqual(perShop.GamingKit, { kept: 4, elsewhere: 0 }, 'the range EAN joins nothing');
  const pair = pairs['PCHUB.UK | PcNova.co.uk'];
  assert.equal(pair.n, 2);
  assert.equal(pair.cheaperA, 1, 'the router is cheaper at PCHUB.UK');
  assert.equal(pair.cheaperB, 1, 'the mouse is cheaper at PcNova.co.uk');
  assert.equal(Object.keys(pairs).length, 1);
});

const header = ['aw_deep_link', 'product_name', 'aw_product_id', 'merchant_product_id', 'merchant_image_url', 'merchant_category', 'search_price', 'rrp_price', 'brand_name', 'in_stock', 'stock_quantity', 'ean'];
const line = v => v.map(x => (/[",\n]/.test(x) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(',');
const feed = rows => gzipSync(Buffer.from([line(header), ...rows.map(line)].join('\n') + '\n'));
const link = (m, id) => `https://www.awin1.com/pclick.php?p=${id}&a=3057233&m=${m}`;
const img = id => `https://media.stockinthechannel.com/pic/${id}.c-r.jpg`;
const SOON = 'https://entrepreneurship.ieee.org/wp-content/uploads/2018/02/Image-Coming-Soon-Placeholder-e1518111259296.png';

test('dry run with the three catalogue shops: PCHUB rules for all, GamingKit stock by quantity, a report of the overlap', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgw-newshops-'));
  const arc = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(arc);
  writeFileSync(join(arc, 'AWIN_126641_115609.csv.gz'), feed([
    [link(126641, 1), 'Logitech Mouse M90', '1', 'H-1', img(1), `${D}>Peripherals>Mouses`, '21.65', '31.17', 'Logitech', '1', '1015', '5099206021877'],
    [link(126641, 2), 'TP-Link Archer C50 wireless router', '2', 'H-2', img(2), `${D}>Networking>Routers & Accessories>Wireless Routers`, '42.47', '61.15', 'TP-Link', '1', '118', '6935364095710']
  ]));
  writeFileSync(join(arc, 'AWIN_125822_114610.csv.gz'), feed([
    [link(125822, 11), 'Logitech Mouse M90', '11', 'N-1', img(11), `${D}>Peripherals>Mouses`, '20.80', '28.70', 'Logitech', '1', '208', '5099206021877'],
    [link(125822, 12), 'TP-Link Archer C50 wireless router', '12', 'N-2', img(12), `${D}>Networking>Routers & Accessories>Wireless Routers`, '42.47', '58.61', 'TP-Link', '1', '51', '6935364095710'],
    [link(125822, 13), 'HP 1.8m 3-wire power cord for HP', '13', 'N-3', img(13), `${D}>PC Components>Other`, '44.15', '60.92', 'HP', '1', '3', '5705965764169'],
    [link(125822, 14), 'Epson 1005246 printer/scanner spare part', '14', 'N-4', img(14), `${D}>Peripherals>Printers & Accessories>Print & Scan Accessories>Spare Parts`, '22.76', '31.40', 'Epson', '1', '15', '5705965293980']
  ]));
  writeFileSync(join(arc, 'AWIN_124146_113741.csv.gz'), feed([
    [link(124146, 21), 'Logitech Mouse M90', '21', 'G-1', img(21), `${D}>Peripherals>Mouses`, '19.996001', '', 'Logitech', '1', '0', '5099206021877'],
    [link(124146, 22), 'Logitech Wireless Mouse M185 Grey', '22', 'G-2', img(22), `${D}>Peripherals>Mouses`, '13.248001', '', 'Logitech', '1', '12', '5099206027916'],
    [link(124146, 23), 'Segway NINEBOT KICKSCOOTER E2 PRO B', '23', 'G-3', SOON, `${D}>PC Components>Other`, '338.484001', '', 'Segway', '1', '0', '8720254406749']
  ]));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: SOURCES }));
  const out = join(dir, 'out');
  mkdirSync(out);
  const { stats, products, report } = await planImport({ archive: arc, sourcesFile, outDir: out, now: new Date('2026-10-25T17:00:00Z') });
  const got = products.map(p => `${p.retailer} | ${p.product_name} | ${p.price}`).sort();
  assert.deepEqual(got, [
    'GamingKit | Logitech Wireless Mouse M185 Grey | 13.25',
    'PCHUB.UK | Logitech Mouse M90 | 21.65',
    'PCHUB.UK | TP-Link Archer C50 wireless router | 42.47',
    'PcNova.co.uk | Logitech Mouse M90 | 20.8'
  ], 'the router at the same price is shown once; the cheaper mouse at PcNova stays; GamingKit\'s M90 has none in stock');
  assert.equal(stats.rejected['out of stock'], 1, 'GamingKit: Logitech M90 (stock_quantity 0)');
  assert.equal(stats.rejected['brand not on the consumer list (GamingKit)'], 1, 'the Segway scooter: PCHUB\'s brand list');
  assert.equal(stats.rejected['duplicate: same product and price at another shop'], 1);
  assert.ok(products.every(p => p.was_price === null), 'PCHUB rule ignoreWasPrice holds for PcNova (rrp = price x 1.38)');
  assert.match(report, /== The same product at two shops, at different prices \(both are shown, as separate cards\) ==/);
  assert.match(report, / {2}PCHUB\.UK and PcNova\.co\.uk: 1 \(cheaper at PCHUB\.UK: 0 \| cheaper at PcNova\.co\.uk: 1\)/);
  assert.match(report, / {2}GamingKit: 1 kept \| 0 also at another shop \| 1 only at GamingKit/);
  assert.match(report, /Sources: Joybuy \(123932: 114093\); Back to the Office \(61655: 102827\); PCHUB\.UK \(126641: 115609\); PcNova\.co\.uk \(125822: 114610\); GamingKit \(124146: 113741\)/);
  // GamingKit's feed was read, so its products missing from a later feed are hidden; Joybuy and Back to the Office were not.
  const finish = readFileSync(join(out, 'sql', '9999-finish.sql'), 'utf8');
  assert.match(finish, /awin_advertiser_id IN \(126641, 125822, 124146\)/);
});
