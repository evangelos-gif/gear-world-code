// Refresh of retailers already on the older sites (job 2 of 25 Oct 2026, lessons L57): price, picture and stock from
// the Awin feed, products no longer in the feed hidden, D1 writes counted from the table's own indexes.
// Database rows in the shape of the CGW database (Reidl: Awin product ids, stock "1"; Tooled Up: "In Stock",
// "Available to Order", Awin 200px picture proxies; GS Workwear / InStock: "<advertiser>:<shop id>").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { findFeeds, readFeed, planRefresh, writeCosts, writePlan, keyOf, matchRow, newestFirst, renderReport, linkHost, shopOriginOf, feedFromShopify, readShopCurrency, productHandle, sampleShopProducts, renderSampleReport, sampleReason } from '../../tools/legacy-refresh-plan.mjs';
import { readShopifyCatalog } from '../../tools/legacy-import-plan.mjs';

// The CGW indexes on products (read from the live database, 25 Oct 2026).
const CGW_INDEXES = [
  'CREATE INDEX idx_products_active_brand ON products(is_active, brand)',
  'CREATE INDEX idx_products_active_brand_name ON products(is_active, brand COLLATE NOCASE, product_name COLLATE NOCASE)',
  'CREATE INDEX idx_products_active_category ON products(is_active, site_category)',
  'CREATE INDEX idx_products_active_category_brand_name ON products(is_active, site_category, brand COLLATE NOCASE, product_name COLLATE NOCASE)',
  'CREATE INDEX idx_products_active_category_featured ON products(is_active, site_category, ((id * 1103515245 + 12345) % 2147483647))',
  'CREATE INDEX idx_products_active_category_price_id ON products(is_active, site_category, price, id)',
  'CREATE INDEX idx_products_active_created ON products(is_active, created_at)',
  'CREATE INDEX idx_products_active_featured ON products(is_active, ((id * 1103515245 + 12345) % 2147483647))',
  'CREATE INDEX idx_products_active_id ON products(is_active, id)',
  'CREATE INDEX idx_products_active_price ON products(is_active, price)',
  'CREATE INDEX idx_products_retailer_active_ean ON products(retailer, is_active, ean)',
  'CREATE INDEX idx_products_retailer_merchant_id ON products(retailer, merchant_product_id)',
  "CREATE UNIQUE INDEX ux_products_refresh_stable_key_global ON products(retailer, merchant_product_id) WHERE merchant_product_id IS NOT NULL AND TRIM(merchant_product_id) <> ''"
];

test('rows written per change, from the CGW indexes: price 3, picture 1, stock 1, hide 12 (measured with the wrangler local D1)', () => {
  assert.deepEqual(writeCosts([...CGW_INDEXES.map(sql => ({ sql })), { name: 'sqlite_autoindex_products_1', sql: null }]), { price: 3, image_url: 1, stock_status: 1, is_active: 12 });
  assert.deepEqual(writeCosts([]), { price: 1, image_url: 1, stock_status: 1, is_active: 1 });
});

// L59: the search-index trigger. On CGW it fires only for name, brand, subcategory, retailer, category and id: no cost for a
// refresh. On MGW (and WGW, KGW, HGW, GGW) it fires on ANY update. Measured on the MGW layout with the wrangler local D1,
// 26 Oct 2026: price 4, stock 3, hide 6 rows written per product (the index-only count said 2, 1 and 4).
const CGW_FTS_AU = 'CREATE TRIGGER products_fts_au AFTER UPDATE OF product_name, brand, subcategory, retailer, merchant_category, id ON products BEGIN INSERT INTO products_fts(products_fts, rowid, product_name) VALUES (\'delete\', old.id, old.product_name); END';
const MGW_FTS_AU = 'CREATE TRIGGER products_fts_au\nAFTER UPDATE ON products\nBEGIN\n  INSERT INTO products_fts(products_fts, rowid, product_name) VALUES(\'delete\', old.id, old.product_name);\nEND';
const MGW_INDEXES = [
  'CREATE INDEX idx_products_category\nON products(site_category)',
  'CREATE INDEX idx_products_retailer\nON products(retailer)',
  'CREATE INDEX idx_products_merchant_id\nON products(retailer, merchant_product_id)',
  'CREATE INDEX idx_products_active\nON products(is_active)',
  "CREATE UNIQUE INDEX ux_products_refresh_stable_key\nON products(retailer, merchant_product_id)\nWHERE retailer IN ('Stan Ray UK', 'Stattics', 'Watch Enclave', 'WATCH & WATCH')",
  'CREATE INDEX idx_products_active_category_price_id ON products(is_active, site_category, price, id)',
  "CREATE INDEX idx_products_group_key ON products(COALESCE(NULLIF(TRIM(COALESCE(NULLIF(TRIM(ean), ''), json_extract(specs_json, '$.gtin'))), ''), 'id:' || id))",
  'CREATE INDEX idx_products_active_created ON products(is_active, created_at)'
];

test('L59: rows written count the search-index trigger: CGW unchanged, MGW layout price 4, stock 3, hide 6 (measured)', () => {
  const insertTrigger = 'CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN INSERT INTO products_fts(rowid) VALUES (new.id); END';
  assert.deepEqual(writeCosts([...CGW_INDEXES, CGW_FTS_AU, insertTrigger].map(sql => ({ sql }))), { price: 3, image_url: 1, stock_status: 1, is_active: 12 });
  assert.deepEqual(writeCosts([...MGW_INDEXES, MGW_FTS_AU, insertTrigger].map(sql => ({ type: 'x', sql }))), { price: 4, image_url: 3, stock_status: 3, is_active: 6 });
  assert.deepEqual(writeCosts(MGW_INDEXES.map(sql => ({ sql }))), { price: 2, image_url: 1, stock_status: 1, is_active: 4 }, 'without the trigger: indexes only');
});

const HEAD = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,aw_image_url,merchant_category,search_price,merchant_name,merchant_id,currency,in_stock,stock_status,last_updated\n';
const line = o => [o.link || 'https://www.awin1.com/pclick.php?p=1', `"${o.name}"`, o.aw, o.mid, o.img || '', o.awImg || '', 'Tools', o.price, o.merchant, o.adv, o.cur || 'GBP',
  o.inStock ?? '1', o.status ?? '', o.updated || '2026-10-24 22:00:00'].join(',') + '\n';

function archive() {
  const dir = mkdtempSync(join(tmpdir(), 'refresh-feeds-'));
  writeFileSync(join(dir, 'AWIN_496_1001.csv.gz'), gzipSync(HEAD
    + line({ name: 'Bahco Spanner 10mm', aw: '100046875', mid: '100005800', price: 12.5, merchant: 'Tooled Up', adv: 496, img: 'https://www.tooled-up.com/artwork/prodzoom/a.jpg', status: 'In Stock' })
    + line({ name: 'Stanley Hammer', aw: '10066565757', mid: '100005803', price: 20, merchant: 'Tooled Up', adv: 496, awImg: 'https://images2.productserve.com/?w=200&h=200&bg=white&trim=5&t=letterbox&url=ssl%3Awww.tooled-up.com%2Fartwork%2Fprodzoom%2Fb.jpg', inStock: '0', status: 'Out of Stock' })
    + line({ name: 'Makita Drill', aw: '10310084311', mid: '100645949', price: 900, merchant: 'Tooled Up', adv: 496, img: 'https://www.tooled-up.com/artwork/prodzoom/c.jpg', status: 'Available to Order' })
    + line({ name: 'Same Product', aw: '200', mid: '300', price: 5, merchant: 'Tooled Up', adv: 496, img: 'https://www.tooled-up.com/artwork/prodzoom/d.jpg', status: 'In Stock' })));
  writeFileSync(join(dir, 'AWIN_122822_2002.csv.gz'), gzipSync(HEAD
    + line({ name: 'Reidl Saw', aw: '44606347019', mid: '101915', price: 30, merchant: 'Reidl', adv: 122822, cur: 'EUR', img: 'https://rdlcdn.de/s/100009.jpg?class=czl', inStock: '0' })
    + line({ name: 'Reidl Old', aw: '44606347020', mid: '101916', price: 9.99, merchant: 'Reidl', adv: 122822, cur: 'GBP', img: 'https://rdlcdn.de/s/100010.jpg', inStock: '1' })));
  writeFileSync(join(dir, 'AWIN_48473_3003.csv.gz'), gzipSync(HEAD
    + line({ name: 'Bodywarmer', aw: '777', mid: '2786-2786-bodywarmer', price: 25, merchant: 'GS Workwear', adv: 48473, img: 'https://gs/1.jpg', inStock: 'yes' })));
  return dir;
}

const TU = [
  { id: 1, awin_product_id: '100046875', merchant_product_id: '100005800', product_name: 'Bahco Spanner 10mm', price: 11.99, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://www.tooled-up.com/artwork/prodzoom/a.jpg', is_active: 1 },
  { id: 2, awin_product_id: '10066565757', merchant_product_id: '100005803', product_name: 'Stanley Hammer', price: 20, currency: 'GBP', stock_status: 'Available to Order',
    image_url: 'https://images2.productserve.com/?w=200&h=200&bg=white&trim=5&t=letterbox&url=ssl%3Awww.tooled-up.com%2Fartwork%2Fprodzoom%2Fb.jpg', is_active: 1 },
  { id: 3, awin_product_id: '10310084311', merchant_product_id: '100645949', product_name: 'Makita Drill', price: 99, currency: 'GBP', stock_status: 'Available to Order', image_url: 'https://www.tooled-up.com/artwork/prodzoom/c.jpg', is_active: 1 },
  { id: 4, awin_product_id: '999', merchant_product_id: '300', product_name: 'Same Product (found by the shop id)', price: 5, currency: 'GBP', stock_status: 'in_stock', image_url: 'https://www.tooled-up.com/artwork/prodzoom/d.jpg', is_active: 1 },
  { id: 5, awin_product_id: '555', merchant_product_id: '555', product_name: 'Gone From Feed', price: 7, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://x/5.jpg', is_active: 1 }
];
const CGW_COSTS = { price: 3, image_url: 1, stock_status: 1, is_active: 12 };

test('the feed of a shop is found by its merchant_name; names compare as keys', async () => {
  const dir = archive();
  const r = await findFeeds(dir, 'Tooled Up');
  assert.deepEqual(r.files.map(f => f.split(/[\\/]/).pop()), ['AWIN_496_1001.csv.gz']);
  assert.equal((await findFeeds(dir, 'reidl')).files.length, 1);
  assert.equal((await findFeeds(dir, 'Nobody')).files.length, 0);
  assert.equal((await findFeeds(dir, 'whatever', '48473')).files.length, 1, 'an advertiser id finds the file directly');
  assert.equal(keyOf('WATCH & WATCH'), 'watch-watch');
  assert.equal(keyOf('Tooled Up'), 'tooled-up');
});

test('Tooled Up on CGW: only values that differ change; the shop id finds a product; a gone product is hidden; a 9x price is listed, not changed', async () => {
  const dir = archive();
  const feed = await readFeed((await findFeeds(dir, 'Tooled Up')).files);
  assert.equal(matchRow(TU[3], feed).aw, '200', 'found by merchant_product_id when the Awin id changed');
  const p = planRefresh({ rows: TU, feed, costs: CGW_COSTS, now: new Date('2026-10-25T12:00:00Z') });
  const by = Object.fromEntries(p.changes.map(c => [c.id, c.set]));
  assert.deepEqual(by[1], { price: 12.5 }, 'price only');
  assert.deepEqual(by[2], { image_url: 'https://www.tooled-up.com/artwork/prodzoom/b.jpg', stock_status: 'Out of Stock' }, 'full picture instead of the 200px proxy; sold out in the shop\'s own words');
  assert.equal(by[3], undefined, '99 -> 900 is a jump: not changed');
  assert.deepEqual(p.bigPrice.map(b => [b.id, b.from, b.to]), [[3, 99, 900]]);
  assert.equal(by[4], undefined, 'in_stock and "In Stock" are the same for the site: nothing to write');
  assert.deepEqual(p.hides, [5]);
  assert.equal(p.writes, 3 + 1 + 12, 'price 3, picture+stock 1, hide 12');
  assert.equal(p.same, 2);
});

test('Reidl: stock "1" -> "0" in the shop\'s own convention; another currency in the feed keeps the price; GS Workwear ids "<advertiser>:<shop id>"', async () => {
  const dir = archive();
  const feed = await readFeed((await findFeeds(dir, 'Reidl')).files);
  const rows = [
    { id: 10, awin_product_id: '44606347019', merchant_product_id: '101915', product_name: 'Reidl Saw', price: 28, currency: 'EUR', stock_status: '1', image_url: 'https://rdlcdn.de/s/100009.jpg?class=czl', is_active: 1 },
    { id: 11, awin_product_id: '44606347020', merchant_product_id: '101916', product_name: 'Reidl Old', price: 8, currency: 'EUR', stock_status: '1', image_url: 'https://rdlcdn.de/s/100010.jpg', is_active: 1 }
  ];
  const p = planRefresh({ rows, feed, costs: CGW_COSTS, now: new Date('2026-10-25T12:00:00Z') });
  const by = Object.fromEntries(p.changes.map(c => [c.id, c.set]));
  assert.deepEqual(by[10], { price: 30, stock_status: '0' });
  assert.equal(by[11], undefined, 'GBP in the feed, EUR on the site: the price is not changed');
  assert.equal(p.currencySkip.length, 1);
  const gs = await readFeed((await findFeeds(dir, 'GS Workwear')).files);
  const g = planRefresh({ rows: [{ id: 20, awin_product_id: '48473:2786-2786-bodywarmer', merchant_product_id: null, price: 20, currency: 'GBP', stock_status: 'in stock', image_url: 'https://gs/1.jpg', is_active: 1 }],
    feed: gs, costs: CGW_COSTS, now: new Date('2026-10-25T12:00:00Z') });
  assert.deepEqual(g.changes.map(c => c.set), [{ price: 25 }]);
  assert.equal(g.hides.length, 0);
});

test('safety: a stale feed changes nothing; a feed missing most products hides nothing; the write budget leaves the rest for the next run', async () => {
  const dir = archive();
  const feed = await readFeed((await findFeeds(dir, 'Tooled Up')).files);
  const stale = planRefresh({ rows: TU, feed, costs: CGW_COSTS, now: new Date('2026-12-30T12:00:00Z') });
  assert.equal(stale.stale, true);
  assert.equal(stale.changes.length + stale.hides.length, 0);
  const many = Array.from({ length: 150 }, (_, i) => ({ id: 1000 + i, awin_product_id: `x${i}`, merchant_product_id: `y${i}`, price: 1, currency: 'GBP', stock_status: '1', image_url: '', is_active: 1 }));
  const broken = planRefresh({ rows: [...TU, ...many], feed, costs: CGW_COSTS, now: new Date('2026-10-25T12:00:00Z') });
  assert.equal(broken.safe, false);
  assert.equal(broken.hides.length, 0);
  const small = planRefresh({ rows: TU, feed, costs: CGW_COSTS, maxWrites: 4, now: new Date('2026-10-25T12:00:00Z') });
  assert.equal(small.writes, 4);
  assert.deepEqual([small.changes.length, small.hides.length, small.left.changes, small.left.hides], [2, 0, 0, 1]);
});

test('the SQL on a copy of the CGW table: values change by id, the gone product is hidden, the rollback puts everything back', async () => {
  const dir = archive();
  const feed = await readFeed((await findFeeds(dir, 'Tooled Up')).files);
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, awin_product_id TEXT NOT NULL UNIQUE, merchant_product_id TEXT, retailer TEXT NOT NULL,
    site_category TEXT NOT NULL DEFAULT 'Hand Tools', subcategory TEXT, brand TEXT, product_name TEXT NOT NULL, feed_product_name TEXT, price REAL NOT NULL,
    currency TEXT DEFAULT 'GBP', stock_status TEXT, merchant_category TEXT, image_url TEXT, affiliate_url TEXT NOT NULL DEFAULT 'x', ean TEXT,
    is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, specs_json TEXT, product_slug TEXT);`);
  for (const s of CGW_INDEXES) db.exec(s + ';');
  const ins = db.prepare('INSERT INTO products (id, awin_product_id, merchant_product_id, retailer, product_name, price, currency, stock_status, image_url, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const r of TU) ins.run(r.id, r.awin_product_id, r.merchant_product_id, 'Tooled Up', r.product_name, r.price, r.currency, r.stock_status, r.image_url, 1);
  ins.run(6, '666', '666', 'Tooled Up', 'Hidden by a clean-up', 3, 'GBP', 'In Stock', 'https://x/6.jpg', 0);
  const before = db.prepare('SELECT id, price, image_url, stock_status, is_active FROM products ORDER BY id').all();
  const rows = db.prepare('SELECT * FROM products WHERE is_active = 1').all();
  const out = mkdtempSync(join(tmpdir(), 'refresh-out-'));
  writePlan(out, planRefresh({ rows, feed, costs: CGW_COSTS, now: new Date('2026-10-25T12:00:00Z') }));
  for (const f of readdirSync(out).filter(f => /^update-\d+\.sql$/.test(f)).sort()) db.exec(readFileSync(join(out, f), 'utf8'));
  db.exec(readFileSync(join(out, 'hide.sql'), 'utf8'));
  const after = Object.fromEntries(db.prepare('SELECT id, price, stock_status, is_active FROM products').all().map(r => [r.id, r]));
  assert.equal(after[1].price, 12.5);
  assert.equal(after[2].stock_status, 'Out of Stock');
  assert.equal(after[5].is_active, 0, 'gone from the feed: hidden');
  assert.equal(after[6].is_active, 0, 'hidden before: stays hidden');
  db.exec(readFileSync(join(out, 'rollback.sql'), 'utf8'));
  assert.deepEqual(db.prepare('SELECT id, price, image_url, stock_status, is_active FROM products ORDER BY id').all(), before, 'rollback: exactly as before');
});

test('command line: report and counts from wrangler output files; no feed found -> exit 3 with the names of similar feeds', () => {
  const dir = archive();
  const out = mkdtempSync(join(tmpdir(), 'refresh-cli-'));
  const rowsFile = join(out, 'rows-001.json.txt');
  writeFileSync(rowsFile, 'some wrangler text\n' + JSON.stringify([{ results: TU, success: true }]));
  const idxFile = join(out, 'indexes.json.txt');
  writeFileSync(idxFile, JSON.stringify([{ results: CGW_INDEXES.map((sql, i) => ({ name: `i${i}`, sql })), success: true }]));
  const tool = join(process.cwd(), 'tools', 'legacy-refresh-plan.mjs');
  execFileSync(process.execPath, [tool, '--archive', dir, '--retailer', 'Tooled Up', '--site', 'cgw', '--rows', rowsFile, '--indexes', idxFile, '--out', out, '--now', '2026-10-25T12:00:00Z']);
  assert.equal(readFileSync(join(out, 'counts.txt'), 'utf8').trim(), '2 1 16 0 1 5');
  const report = readFileSync(join(out, 'report.txt'), 'utf8');
  assert.match(report, /ΠΡΟΣΟΧΗ: 1 τιμές αλλάζουν πάνω από 3 φορές/);
  assert.match(report, /απόκρυψη 12/);
  const miss = spawnSync(process.execPath, [tool, '--archive', dir, '--retailer', 'Tooled', '--rows', rowsFile, '--out', join(out, 'x')]);
  assert.equal(miss.status, 3);
  assert.match(readFileSync(join(out, 'x', 'report.txt'), 'utf8'), /Παρόμοια: AWIN_496_1001\.csv\.gz: Tooled Up/);
});

// L58 (26 Oct 2026, dry run of Reidl and Tooled Up on CGW): Tooled Up came in files of 1 and of 10 days, and the older
// file was read first by its name; neither feed had an update date, so the 30-day check (L39) never ran; the report
// showed names as 'Schl├â┬╝ssel'. The site keeps such names saved twice as UTF-8 ('SchlÃ¼ssel') and shows them right.
test('L58: the newest file wins; a feed without dates is judged by its newest file; stock in the feed is counted; names read right', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'refresh-l58-'));
  const head = 'product_name,aw_product_id,merchant_product_id,merchant_image_url,search_price,merchant_name,currency,in_stock\n';
  const oldFile = join(dir, 'AWIN_496_19857.csv.gz');
  const newFile = join(dir, 'AWIN_496_89987.csv.gz');
  writeFileSync(oldFile, gzipSync(head + 'Gedore Spanner,100046875,100005800,https://www.tooled-up.com/artwork/prodzoom/a.jpg,11.00,Tooled Up,GBP,1\n'
    + 'Old File Only,200,300,https://www.tooled-up.com/artwork/prodzoom/d.jpg,5,Tooled Up,GBP,0\n'));
  writeFileSync(newFile, gzipSync(head + 'Gedore Spanner,100046875,100005800,https://www.tooled-up.com/artwork/prodzoom/a.jpg,12.50,Tooled Up,GBP,1\n'));
  const day = 86400000;
  const now = Date.now();
  utimesSync(oldFile, new Date(now - 10 * day), new Date(now - 10 * day));
  utimesSync(newFile, new Date(now - 1 * day - 3600000), new Date(now - 1 * day - 3600000));
  assert.deepEqual(newestFirst([oldFile, newFile]), [newFile, oldFile], 'by date, not by name');
  const feed = await readFeed((await findFeeds(dir, 'Tooled Up')).files);
  assert.equal(feed.byAw.get('100046875').price, 12.5, 'the row of the newer file');
  assert.equal(feed.newest, '');
  const rows = [
    { id: 1, awin_product_id: '100046875', merchant_product_id: '100005800', product_name: 'Gedore Ring-Maulschl\u00c3\u00bcssel 10mm', price: 11.99, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://www.tooled-up.com/artwork/prodzoom/a.jpg', is_active: 1 },
    { id: 2, awin_product_id: '200', merchant_product_id: '300', product_name: 'Old File Only', price: 5, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://www.tooled-up.com/artwork/prodzoom/d.jpg', is_active: 1 }
  ];
  const p = planRefresh({ rows, feed, costs: CGW_COSTS, now: new Date(now) });
  assert.equal(p.staleFrom, 'file');
  assert.equal(p.staleDays, 1);
  assert.equal(p.stale, false);
  assert.deepEqual(Object.fromEntries(p.changes.map(c => [c.id, c.set])), { 1: { price: 12.5 }, 2: { stock_status: '0' } });
  assert.deepEqual(p.feedStock, { in: 1, out: 1, unknown: 0 });
  const report = renderReport({ retailer: 'Tooled Up', site: 'cgw', feedFiles: ['a'], feedRows: feed.rows, newest: feed.newest, p });
  assert.match(report, /Ring-Maulschl\u00fcssel 10mm: 11\.99 -> 12\.5/, 'the name as the site shows it');
  assert.match(report, /ο έλεγχος παλιού feed \(L39\) έγινε με το νεότερο αρχείο του \(1 ημ\.\)/);
  assert.match(report, /Απόθεμα στο feed για τα 2 που βρέθηκαν: σε απόθεμα 1, εξαντλημένα 1, χωρίς στοιχείο 0\./);
  const old = planRefresh({ rows, feed, costs: CGW_COSTS, now: new Date(now + 40 * day) });
  assert.equal(old.stale, true, 'newest file 41 days old: nothing changes');
  assert.equal(old.changes.length + old.hides.length, 0);
  assert.match(renderReport({ retailer: 'Tooled Up', site: 'cgw', feedFiles: ['a'], feedRows: feed.rows, newest: '', p: old }), /ΠΡΟΣΟΧΗ: το νεότερο αρχείο του feed είναι 41 ημερών/);
});

// L60 (job 3, 26 Oct 2026): the Awin feeds of Red Gorilla (CGW), Wavytalk (MGW) and Gardenista (HGW) were not refreshed
// after 15 May 2026, but the shops' own Shopify sites were live. Checked on the live sites that day: Gardenista and Red
// Gorilla prices were the same; Wavytalk is a US store (USD) and the UK-plug options on MGW were sold out.
test('L60: the shop address comes from the products\' links', () => {
  const cread = u => `https://www.awin1.com/cread.php?awinmid=37292&awinaffid=3057233&ued=${encodeURIComponent(u)}`;
  assert.equal(linkHost(cread('https://gardenistauk.com/products/cccd1vahinee?variant=37737710846101')), 'gardenistauk.com');
  assert.equal(linkHost('https://www.awin1.com/pclick.php?p=45361363125&a=3057233&m=128533'), '', 'pclick carries no shop address');
  assert.equal(linkHost('http://shop.example/x'), '', 'https only');
  const rows = [1, 2, 3, 4, 5].map(i => ({ affiliate_url: cread(`https://www.redgorilla.red/products/p${i}?variant=${i}`) }));
  assert.equal(shopOriginOf(rows), 'https://www.redgorilla.red');
  assert.equal(shopOriginOf([...rows, ...[6, 7].map(() => ({ affiliate_url: cread('https://other.example/products/x') }))]), '', 'under 4 in 5 on one shop: none');
});

function fakeShop(products, currency) {
  return async url => {
    const u = new URL(url);
    if (u.pathname === '/meta.json') return { ok: true, json: async () => ({ currency, domain: u.hostname }) };
    if (u.pathname === '/products.json') return { ok: true, json: async () => ({ products: u.searchParams.get('page') === '1' ? products : [] }) };
    return { ok: false, json: async () => ({}) };
  };
}
const SHOP = [
  { handle: 'cushion', images: [{ src: 'https://cdn.shopify.com/s/files/1/x/cushion.jpg?v=2' }],
    variants: [{ id: 101, sku: 'C-1', price: '12.99', available: true, featured_image: null }, { id: 102, sku: 'C-2', price: '14.99', available: true, featured_image: null }] },
  { handle: 'cover', images: [{ src: 'https://cdn.shopify.com/s/files/1/x/cover-new.jpg?v=9' }],
    variants: [{ id: 201, sku: 'V-1', price: '29.99', available: false, featured_image: null }, { id: 202, sku: 'V-2', price: '7.99', available: true, featured_image: { src: 'https://cdn.shopify.com/s/files/1/x/cover-b.jpg?v=3' } }] }
];

test('L60: from the shop\'s live catalogue: same price kept, new price set, sold out and gone hidden, deleted picture replaced', async () => {
  const fetchImpl = fakeShop(SHOP, 'GBP');
  const catalog = await readShopifyCatalog('https://gardenistauk.com', { fetchImpl, pauseMs: 0 });
  const currency = await readShopCurrency('https://gardenistauk.com', { fetchImpl });
  assert.equal(currency, 'GBP');
  const feed = feedFromShopify(catalog, currency, new Date('2026-10-26T22:00:00Z'));
  const pic = 'https://cdn.shopify.com/s/files/1/x/cushion.jpg?v=1';
  const rows = [
    { id: 1, awin_product_id: '37292:101', merchant_product_id: '101', product_name: 'Cushion A', price: 12.99, currency: 'GBP', stock_status: 'in stock', image_url: pic, is_active: 1 },
    { id: 2, awin_product_id: '37292:102', merchant_product_id: '102', product_name: 'Cushion B', price: 12.99, currency: 'GBP', stock_status: 'in stock', image_url: pic, is_active: 1 },
    { id: 3, awin_product_id: '37292:201', merchant_product_id: '201', product_name: 'Cover set', price: 29.99, currency: 'GBP', stock_status: 'in stock', image_url: 'https://cdn.shopify.com/s/files/1/x/cover-new.jpg', is_active: 1 },
    { id: 4, awin_product_id: '37292:202', merchant_product_id: '202', product_name: 'Cover B', price: 7.99, currency: 'GBP', stock_status: 'in stock', image_url: 'https://cdn.shopify.com/s/files/1/x/deleted.jpg', is_active: 1 },
    { id: 5, awin_product_id: '37292:999', merchant_product_id: '999', product_name: 'Gone', price: 5, currency: 'GBP', stock_status: 'in stock', image_url: pic, is_active: 1 },
    { id: 6, awin_product_id: '54965443821954', merchant_product_id: 'V-1', product_name: 'By SKU, sold out', price: 29.99, currency: 'GBP', stock_status: 'in stock', image_url: pic, is_active: 1 }
  ];
  const p = planRefresh({ rows, feed, costs: { price: 4, image_url: 3, stock_status: 3, is_active: 6 }, now: new Date('2026-10-26T22:00:00Z') });
  const by = Object.fromEntries(p.changes.map(c => [c.id, c.set]));
  assert.equal(by[1], undefined, 'same price; the picture is still one of the product\'s pictures (other ?v=): nothing');
  assert.deepEqual(by[2], { price: 14.99 });
  assert.deepEqual(by[4], { image_url: 'https://cdn.shopify.com/s/files/1/x/cover-b.jpg?v=3' }, 'deleted picture -> the option\'s own picture');
  assert.deepEqual(p.hides.sort(), [3, 5, 6], 'sold out (by id and by SKU) and gone are hidden');
  assert.equal(p.soldOut, 2);
  assert.equal(p.stale, false);
  const report = renderReport({ retailer: 'Gardenista', site: 'hgw', feedFiles: [], feedRows: feed.rows, newest: feed.newest, p, shop: { origin: 'https://gardenistauk.com', currency } });
  assert.match(report, /Πηγή: ο ζωντανός κατάλογος του καταστήματος https:\/\/gardenistauk\.com \(4 επιλογές, νόμισμα GBP\)/);
  assert.match(report, /Εξαντλημένα στο κατάστημα: 2/);
  assert.match(report, /Δεν υπάρχουν πια στο κατάστημα: 1\./);
});

test('L60: a shop in another currency (Wavytalk, USD) changes no price; an unknown currency changes no price either', async () => {
  const catalog = await readShopifyCatalog('https://wavytalk.com', { fetchImpl: fakeShop(SHOP, 'USD'), pauseMs: 0 });
  const rows = [{ id: 2, awin_product_id: '102', merchant_product_id: '102', product_name: 'Steamlift', price: 9.99, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://cdn.shopify.com/s/files/1/x/cushion.jpg', is_active: 1 }];
  const usd = planRefresh({ rows, feed: feedFromShopify(catalog, 'USD'), costs: { price: 4, image_url: 3, stock_status: 3, is_active: 6 } });
  assert.equal(usd.changes.length, 0);
  assert.equal(usd.currencySkip.length, 1);
  const unknown = planRefresh({ rows, feed: feedFromShopify(catalog, ''), costs: { price: 4, image_url: 3, stock_status: 3, is_active: 6 } });
  assert.equal(unknown.changes.length, 0, 'no currency read: no price change');
  assert.equal(await readShopCurrency('https://wavytalk.com', { fetchImpl: async () => { throw new Error('offline'); } }), '');
});

test('L80: a catalogue too big to read whole (InStock) is sampled product by product: same, new price, sold out, gone', async () => {
  const awin = h => `https://www.awin1.com/cread.php?awinmid=122444&awinaffid=3057233&ued=${encodeURIComponent(`https://instock.net/products/${h}`)}`;
  assert.deepEqual(productHandle(awin('0-5mm-drill-bit?variant=77')), { handle: '0-5mm-drill-bit', variant: '77' });
  assert.equal(productHandle('https://www.awin1.com/cread.php?awinmid=1&awinaffid=3057233&ued='), null);
  const rows = [
    { id: 1, awin_product_id: '122444:11', product_name: 'Same Price Lamp', price: 20, currency: 'GBP', is_active: 1, affiliate_url: awin('same-lamp') },
    { id: 2, awin_product_id: '122444:21', product_name: 'New Price Kettle', price: 30, currency: 'GBP', is_active: 1, affiliate_url: awin('kettle?variant=21') },
    { id: 3, awin_product_id: '122444:31', product_name: 'Sold Out Fan', price: 15, currency: 'GBP', is_active: 1, affiliate_url: awin('fan') },
    { id: 4, awin_product_id: '122444:41', product_name: 'Gone Rug', price: 50, currency: 'GBP', is_active: 1, affiliate_url: awin('rug') },
    { id: 5, awin_product_id: '122444:51', product_name: 'Hidden Chair', price: 50, currency: 'GBP', is_active: 0, affiliate_url: awin('chair') }
  ];
  const shop = {
    'same-lamp': { variants: [{ id: 11, price: 2000, available: true }] },
    kettle: { variants: [{ id: 20, price: 1000, available: true }, { id: 21, price: 3499, available: true }] },
    fan: { variants: [{ id: 31, price: 1500, available: false }] }
  };
  const asked = [];
  const fetchImpl = async url => {
    asked.push(url);
    const h = /\/products\/([^/]+)\.js$/.exec(url)[1];
    if (!shop[h]) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => shop[h] };
  };
  const st = await sampleShopProducts(rows, 'https://instock.net', { n: 10, fetchImpl, pauseMs: 0, currency: 'GBP' });
  assert.equal(st.active, 4, 'hidden products are not sampled');
  assert.equal(asked.length, 4);
  assert.ok(asked.every(u => /^https:\/\/instock\.net\/products\/[a-z-]+\.js$/.test(u)), 'only the shop\'s own product pages, never an Awin link');
  assert.deepEqual([st.checked, st.same, st.changed, st.soldOut, st.gone], [4, 1, 1, 1, 1]);
  assert.match(st.examples.changed[0], /New Price Kettle: 30 -> 34\.99/, 'the option in the link decides the price');
  const report = renderSampleReport({ retailer: 'InStock UK', site: 'hgw', origin: 'https://instock.net', currency: 'GBP', st, limitNote: 'πάνω από 10.000 προϊόντα' });
  assert.match(report, /Ίδια τιμή: 1 \(25%\) · άλλη τιμή: 1 \(25%\) · εξαντλημένα: 1 \(25%\) · δεν υπάρχουν πια: 1 \(25%\)/);
  assert.match(report, /Δείγμα μόνο: δεν άλλαξε τίποτα/);
  // Another currency: no price comparison.
  const st2 = await sampleShopProducts(rows, 'https://instock.net', { n: 10, fetchImpl, pauseMs: 0, currency: 'USD' });
  assert.equal(st2.same + st2.changed, 0);
  assert.equal(st2.otherCurrency, 2);
});

test('L80: the sample waits and asks again once when the shop says 429 (slow down)', async () => {
  const awin = h => `https://www.awin1.com/cread.php?awinmid=122444&awinaffid=3057233&ued=${encodeURIComponent(`https://instock.net/products/${h}`)}`;
  const rows = [{ id: 1, awin_product_id: '122444:11', product_name: 'Lamp', price: 20, currency: 'GBP', is_active: 1, affiliate_url: awin('lamp') }];
  let calls = 0;
  const fetchImpl = async () => { calls++; return calls === 1 ? { ok: false, status: 429, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ variants: [{ id: 11, price: 2000, available: true }] }) }; };
  const st = await sampleShopProducts(rows, 'https://instock.net', { n: 5, fetchImpl, pauseMs: 0, currency: 'GBP' });
  assert.equal(calls, 2);
  assert.deepEqual([st.checked, st.same, st.failed], [1, 1, 0]);
});

test('L80: a catalogue read that stops part-way falls back to a sample; one that fails on page 1 does not', () => {
  const msg = n => `Could not read the shop's live catalogue (https://instock.net/products.json?limit=250&page=${n}). Nothing was changed; try again later.`;
  assert.match(sampleReason(msg(25)), /σελίδα 25/);
  assert.equal(sampleReason(msg(1)), null);
  assert.match(sampleReason('...more than 10000 products: too big for this check...'), /10\.000/);
  assert.match(sampleReason(msg(1), true), /SampleShops/);
});

test('27 Oct 2026: still 429 after the wait, three in a row, stops the sample and says so', async () => {
  const awin = h => `https://www.awin1.com/cread.php?awinmid=122444&awinaffid=3057233&ued=${encodeURIComponent(`https://instock.net/products/${h}`)}`;
  const rows = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, awin_product_id: `122444:${i}`, product_name: `Item ${i}`, price: 5, currency: 'GBP', is_active: 1, affiliate_url: awin(`item-${i}`) }));
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: false, status: 429, json: async () => ({}) }; };
  const st = await sampleShopProducts(rows, 'https://instock.net', { n: 10, fetchImpl, pauseMs: 0, currency: 'GBP' });
  assert.equal(st.throttled, true);
  assert.equal(st.failed, 3);
  assert.equal(calls, 6);
  const text = renderSampleReport({ retailer: 'InStock UK', site: 'hgw', origin: 'https://instock.net', currency: 'GBP', st, limitNote: 'x' });
  assert.match(text, /HTTP 429/);
  assert.match(text, /δεν ελέγχθηκε ολόκληρος/);
});

test('27 Oct 2026: the catalogue reader names the HTTP status, so 429 (slow down) is told from a shop that is down', async () => {
  const slow = async () => ({ ok: false, status: 429, json: async () => ({}) });
  await assert.rejects(readShopifyCatalog('https://gardenistauk.com', { fetchImpl: slow, pauseMs: 0 }), /page=1, HTTP 429\)/);
  const gone = async () => { throw new Error('offline'); };
  await assert.rejects(readShopifyCatalog('https://gardenistauk.com', { fetchImpl: gone, pauseMs: 0 }), /page=1\)\. Nothing was changed/);
});
