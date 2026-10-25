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
import { findFeeds, readFeed, planRefresh, writeCosts, writePlan, keyOf, matchRow } from '../../tools/legacy-refresh-plan.mjs';

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
