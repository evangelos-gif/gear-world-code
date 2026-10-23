// Technology Gear World, wave B (23 Oct 2026): Back to the Office as a second shop, from a second archive folder.
// Names are from the awin-feed-sample report of 23 Oct 2026 (feed 102827, one category "Computers" for every row).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planImport, sourceFilter, archiveList } from '../../tools/tgw-import-plan.mjs';

const SOURCES = JSON.parse(readFileSync(new URL('../../sites/tgw/sources.json', import.meta.url), 'utf8')).sources;
const BTTO = SOURCES.find(s => s.advertiserId === 61655);

test('Back to the Office is a TGW source with a consumer brand list and a "business IT" word list', () => {
  assert.ok(BTTO && BTTO.approved);
  assert.deepEqual(BTTO.feedIds, [102827]);
  const f = sourceFilter(BTTO);
  const keep = [['Logitech Speakers S150', 'Logitech'], ['TP-Link AC1900 Whole Home Mesh Wi-Fi System, 3-Pack', 'TP-Link'],
    ['AMD Ryzen 9 9950X Processor 4.3 GHz 80 MB L2 & L3 Box', 'AMD'], ['Apple iPhone 15 128GB Black', 'Apple'],
    ['Kingston Technology 512G SSD KC600 SATA3 2.5"', 'Kingston Technology'], ['Philips Evnia 8000 – 31.5" 4K UHD 240Hz QD-OLED Monitor', 'Philips'],
    ['Corsair Harpoon RGB Pro mouse Gaming Right-hand USB Type-A Optical 12000 DPI', 'Corsair'], ['Eufy Floodlight E30 2K Smart Security Camera CCTV', 'Eufy']];
  for (const [n, b] of keep) assert.equal(f(n, b), '', n);
  const out = [
    ['Logitech MeetUp', 'Logitech', 'business IT, parts or services (Back to the Office)'],
    ['Brother Labelling Tape 12mm', 'Brother', 'business IT, parts or services (Back to the Office)'],
    ['NETGEAR MHBTRM5-10000S network switch component', 'Netgear', 'business IT, parts or services (Back to the Office)'],
    ['Kingston Technology FURY 64GB 4800MT/s DDR5 ECC Reg CL36 DIMM (Kit of 4)', 'Kingston Technology', 'business IT, parts or services (Back to the Office)'],
    ['DELL 412-AAMT computer cooling system part/accessory Radiator block', 'Dell', 'business IT, parts or services (Back to the Office)'],
    ['HP 643A toner cartridge Original Yellow', 'HP', 'business IT, parts or services (Back to the Office)'],
    ['StarTech.com Desk Mount Triple Monitor Arm', 'StarTech.com', 'brand not on the consumer list (Back to the Office)'],
    ['Cisco Catalyst 9200', 'Cisco', 'brand not on the consumer list (Back to the Office)'],
    ['Hewlett Packard Enterprise ProLiant DL380', 'Hewlett Packard Enterprise', 'brand not on the consumer list (Back to the Office)']
  ];
  for (const [n, b, why] of out) assert.equal(f(n, b), why, n);
  assert.deepEqual(archiveList('C:\\A ; C:\\B;'), ['C:\\A', 'C:\\B']);
});

const header = ['aw_deep_link', 'product_name', 'aw_product_id', 'merchant_product_id', 'merchant_image_url', 'merchant_category', 'search_price', 'brand_name', 'stock_status', 'ean'];
const line = v => v.map(x => (/[",\n]/.test(x) ? `"${String(x).replace(/"/g, '""')}"` : x)).join(',');
const feed = rows => gzipSync(Buffer.from([line(header), ...rows.map(line)].join('\n') + '\n'));
const link = (m, id) => `https://www.awin1.com/pclick.php?p=${id}&a=3057233&m=${m}`;

test('two archive folders: the newest copy of each feed; a shop whose feed is missing keeps its products (no hiding)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgw-two-'));
  const oldArc = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  const newArc = join(dir, 'GW_AWIN_NEW_20261023');
  mkdirSync(oldArc); mkdirSync(newArc);
  // An old and a new copy of the Back to the Office feed: the new one is used.
  writeFileSync(join(oldArc, 'AWIN_61655_102827.csv.gz'), feed([[link(61655, 1), 'Logitech Speakers S150', '1', 'B-1', 'https://cdn.shopify.com/1.jpg', 'Computers', '18.99', 'Logitech', 'true', '5099206004023']]));
  utimesSync(join(oldArc, 'AWIN_61655_102827.csv.gz'), new Date('2026-10-15T10:00:00Z'), new Date('2026-10-15T10:00:00Z'));
  writeFileSync(join(newArc, 'AWIN_61655_102827.csv.gz'), feed([
    [link(61655, 1), 'Logitech Speakers S150', '1', 'B-1', 'https://cdn.shopify.com/1.jpg', 'Computers', '17.99', 'Logitech', 'true', '5099206004023'],
    [link(61655, 2), 'Logitech C310 HD WEBCAM', '2', 'B-2', 'https://cdn.shopify.com/2.jpg', 'Computers', '26.99', 'Logitech', 'false', '5099206064225'],
    [link(61655, 3), 'HP 643A toner cartridge Original Yellow', '3', 'B-3', 'https://cdn.shopify.com/3.jpg', 'Computers', '120', 'HP', 'true', ''],
    [link(61655, 4), 'Cisco Catalyst 9200 24-port switch', '4', 'B-4', 'https://cdn.shopify.com/4.jpg', 'Computers', '900', 'Cisco', 'true', '']
  ]));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: [
    { advertiserId: 123932, feedIds: [114093], retailer: 'Joybuy', currency: 'GBP', condition: 'new', approved: true },
    { ...BTTO }
  ] }));
  const out = join(dir, 'out');
  mkdirSync(out);
  const { stats, products, report } = await planImport({ archive: `${oldArc};${newArc}`, sourcesFile, outDir: out, now: new Date('2026-10-23T22:00:00Z') });
  assert.equal(stats.accepted, 1);
  assert.equal(products[0].product_name, 'Logitech Speakers S150');
  assert.equal(products[0].price, 17.99, 'the newest copy of the feed');
  assert.equal(products[0].retailer, 'Back to the Office');
  assert.equal(products[0].stable_key, '61655:B-1');
  assert.equal(stats.rejected['out of stock'], 1);
  assert.equal(stats.rejected['business IT, parts or services (Back to the Office)'], 1);
  assert.equal(stats.rejected['brand not on the consumer list (Back to the Office)'], 1);
  const finish = readFileSync(join(out, 'sql', '9999-finish.sql'), 'utf8');
  assert.match(finish, /WHERE awin_advertiser_id IN \(61655\) AND is_active = 1/);
  assert.doesNotMatch(finish, /123932/, 'Joybuy feed not found: its products are not hidden');
  assert.match(report, /AWIN_123932_114093\.csv\.gz: NOT FOUND in the archive folder\(s\)/);
  assert.match(report, /Joybuy: its feed was not found \(or is empty\), so its products on the site are left exactly as they are\./);
  assert.match(report, /AWIN_61655_102827\.csv\.gz: from .*GW_AWIN_NEW_20261023/);
});

test('no feed found at all: the finish file hides nothing', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tgw-none-'));
  const arc = join(dir, 'empty');
  mkdirSync(arc);
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: [{ ...BTTO }] }));
  const out = join(dir, 'out');
  mkdirSync(out);
  await planImport({ archive: arc, sourcesFile, outDir: out, now: new Date('2026-10-23T22:00:00Z') });
  const finish = readFileSync(join(out, 'sql', '9999-finish.sql'), 'utf8');
  assert.doesNotMatch(finish, /UPDATE products/);
  assert.match(finish, /INSERT INTO import_runs \(source, inserted, updated, deactivated, notes\) VALUES \('awin:none', 0,/);
});
