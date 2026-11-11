// Refresh of retailers already on the older sites (job 2 of 25 Oct 2026, lessons L57): price, picture and stock from
// the Awin feed, products no longer in the feed hidden, D1 writes counted from the table's own indexes.
// Lessons L108 (9 Nov 2026): every active product the feed still confirms gets the time the feed file was downloaded as
// its date ("seen"), so the sites (src/lib/visibility.js: hidden after 30 days, "check at the retailer" after 14) know it
// is still sold; the rows that change get the same date; few statements in small files; triggers counted in the writes.
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
import {
  findFeeds, findFeedsFor, pickFeedFiles, readFeed, planRefresh, writeCosts, updateTrigger, writePlan, planStatements, splitFiles,
  groupedStatements, idsPerStatement, sqliteTime, viewDays, keyOf, matchRow, renderReport, advertiserOf, linkKey,
  FEED_FILE_MAX_DAYS, MAX_STATEMENTS_PER_FILE, MAX_WRITES_PER_FILE, IDS_PER_STATEMENT
} from '../../tools/legacy-refresh-plan.mjs';
import { viewFor, isShown, needsCheck, HIDE_AFTER_DAYS } from '../../src/lib/visibility.js';

// The CGW indexes on products (read from the live database, 25 Oct 2026; the same on 9 Nov).
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
const FTS_BODY = "BEGIN INSERT INTO products_fts(products_fts, rowid, product_name, brand, subcategory, retailer, merchant_category) VALUES ('delete', old.id, old.product_name, old.brand, old.subcategory, old.retailer, old.merchant_category); INSERT INTO products_fts(rowid, product_name, brand, subcategory, retailer, merchant_category) VALUES (new.id, new.product_name, new.brand, new.subcategory, new.retailer, new.merchant_category); END";
// The triggers as the live databases have them (9 Nov 2026): CGW's fires only on the name columns, the other five on
// every UPDATE.
const CGW_TRIGGERS = [
  'CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN INSERT INTO products_fts(rowid, product_name) VALUES (new.id, new.product_name); END',
  `CREATE TRIGGER products_fts_au AFTER UPDATE OF product_name, brand, subcategory, retailer, merchant_category, id ON products ${FTS_BODY}`
];
const HGW_SCHEMA = [
  { type: 'index', sql: 'CREATE INDEX idx_products_category\nON products(site_category)' },
  { type: 'index', sql: 'CREATE INDEX idx_products_retailer\nON products(retailer)' },
  { type: 'index', sql: "CREATE UNIQUE INDEX ux_products_refresh_stable_key\nON products(retailer, merchant_product_id)\nWHERE merchant_product_id IS NOT NULL\n  AND TRIM(merchant_product_id) <> ''" },
  { type: 'index', sql: 'CREATE INDEX idx_products_active\nON products(is_active)' },
  { type: 'trigger', sql: 'CREATE TRIGGER products_fts_ai\nAFTER INSERT ON products\nBEGIN\n  INSERT INTO products_fts(rowid, product_name) VALUES (new.id, new.product_name);\nEND' },
  { type: 'trigger', sql: "CREATE TRIGGER products_fts_ad\nAFTER DELETE ON products\nBEGIN\n  INSERT INTO products_fts(products_fts, rowid, product_name) VALUES ('delete', old.id, old.product_name);\nEND" },
  { type: 'trigger', sql: `CREATE TRIGGER products_fts_au\nAFTER UPDATE ON products\n${FTS_BODY.replace(/; /g, ';\n\n  ')}` },
  { type: 'index', sql: 'CREATE INDEX idx_products_active_category_price_id ON products(is_active, site_category, price, id)' },
  { type: 'index', sql: "CREATE INDEX idx_products_group_key ON products(COALESCE(NULLIF(TRIM(COALESCE(NULLIF(TRIM(ean), ''), json_extract(specs_json, '$.gtin'))), ''), 'id:' || id))" },
  { type: 'index', sql: 'CREATE INDEX idx_products_active_created ON products(is_active, created_at)' },
  { type: 'index', name: 'sqlite_autoindex_products_1', sql: null }
];

test('rows written per change, from the indexes and triggers: CGW price 3, picture 1, stock 1, date 1, hide 12; HGW 4, 3, 3, 3, 6 (measured with the wrangler local D1)', () => {
  assert.deepEqual(writeCosts([...CGW_INDEXES.map(sql => ({ type: 'index', sql })), ...CGW_TRIGGERS.map(sql => ({ type: 'trigger', sql })), { name: 'sqlite_autoindex_products_1', sql: null }]),
    { price: 3, image_url: 1, stock_status: 1, is_active: 12, updated_at: 1 });
  // MGW, WGW, KGW, HGW and GGW: the FTS trigger rewrites the search entry on every UPDATE (2 statements).
  assert.deepEqual(writeCosts(HGW_SCHEMA), { price: 4, image_url: 3, stock_status: 3, is_active: 6, updated_at: 3 });
  assert.deepEqual(writeCosts([]), { price: 1, image_url: 1, stock_status: 1, is_active: 1, updated_at: 1 });
  assert.deepEqual(updateTrigger(CGW_TRIGGERS[1]), { cols: ['product_name', 'brand', 'subcategory', 'retailer', 'merchant_category', 'id'], statements: 2 });
  assert.deepEqual(updateTrigger(HGW_SCHEMA[6].sql), { cols: null, statements: 2 }, "'delete' is a value, not a statement");
  assert.equal(updateTrigger(CGW_TRIGGERS[0]), null, 'an INSERT trigger costs nothing on UPDATE');
  assert.equal(updateTrigger('CREATE TRIGGER x AFTER UPDATE ON products_fts BEGIN DELETE FROM y; END'), null, 'another table');
  // No index of the six live databases holds updated_at (9 Nov 2026): a date costs the row and the trigger only.
  assert.ok(![...CGW_INDEXES, ...HGW_SCHEMA.map(r => r.sql || '')].some(s => /updated_at/.test(s)));
});

const HEAD = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,aw_image_url,merchant_category,search_price,merchant_name,merchant_id,currency,in_stock,stock_status,last_updated\n';
const line = o => [o.link || 'https://www.awin1.com/pclick.php?p=1', `"${o.name}"`, o.aw, o.mid, o.img || '', o.awImg || '', 'Tools', o.price, o.merchant, o.adv, o.cur || 'GBP',
  o.inStock ?? '1', o.status ?? '', o.updated || '2026-10-25 11:00:00'].join(',') + '\n';
// (the feed's own date has no zone and is read as the PC's time: 25 Oct 11:00 is after the download in every zone)

// Feed files downloaded on the evening of 24 Oct 2026 (their time on the PC), unless a test says otherwise.
const DOWNLOADED = Date.parse('2026-10-24T21:30:15.750Z');
function archive(downloaded = DOWNLOADED) {
  const dir = mkdtempSync(join(tmpdir(), 'refresh-feeds-'));
  const put = (name, text) => { writeFileSync(join(dir, name), gzipSync(text)); utimesSync(join(dir, name), downloaded / 1000, downloaded / 1000); };
  put('AWIN_496_1001.csv.gz', HEAD
    + line({ name: 'Bahco Spanner 10mm', aw: '100046875', mid: '100005800', price: 12.5, merchant: 'Tooled Up', adv: 496, img: 'https://www.tooled-up.com/artwork/prodzoom/a.jpg', status: 'In Stock' })
    + line({ name: 'Stanley Hammer', aw: '10066565757', mid: '100005803', price: 20, merchant: 'Tooled Up', adv: 496, awImg: 'https://images2.productserve.com/?w=200&h=200&bg=white&trim=5&t=letterbox&url=ssl%3Awww.tooled-up.com%2Fartwork%2Fprodzoom%2Fb.jpg', inStock: '0', status: 'Out of Stock' })
    + line({ name: 'Makita Drill', aw: '10310084311', mid: '100645949', price: 900, merchant: 'Tooled Up', adv: 496, img: 'https://www.tooled-up.com/artwork/prodzoom/c.jpg', status: 'Available to Order' })
    + line({ name: 'Same Product', aw: '200', mid: '300', price: 5, merchant: 'Tooled Up', adv: 496, img: 'https://www.tooled-up.com/artwork/prodzoom/d.jpg', status: 'In Stock' })
    + line({ name: 'Hidden By A Clean-up', aw: '666', mid: '666', price: 3, merchant: 'Tooled Up', adv: 496, img: 'https://x/6.jpg', status: 'In Stock' })
    + line({ name: 'No Price', aw: '777', mid: '777', price: '', merchant: 'Tooled Up', adv: 496, img: 'https://x/7.jpg', status: 'In Stock' }));
  put('AWIN_122822_2002.csv.gz', HEAD
    + line({ name: 'Reidl Saw', aw: '44606347019', mid: '101915', price: 30, merchant: 'Reidl', adv: 122822, cur: 'EUR', img: 'https://rdlcdn.de/s/100009.jpg?class=czl', inStock: '0' })
    + line({ name: 'Reidl Old', aw: '44606347020', mid: '101916', price: 9.99, merchant: 'Reidl', adv: 122822, cur: 'GBP', img: 'https://rdlcdn.de/s/100010.jpg', inStock: '1' }));
  put('AWIN_48473_3003.csv.gz', HEAD
    + line({ name: 'Bodywarmer', aw: '777', mid: '2786-2786-bodywarmer', price: 25, merchant: 'GS Workwear', adv: 48473, img: 'https://gs/1.jpg', inStock: 'yes' }));
  return dir;
}

// Dates as the live rows have them (SQLite datetime('now'), UTC). On 25 Oct 2026 the sites hide rows checked before
// 25 Sep and say "check at the retailer" before 11 Oct.
const TU = [
  { id: 1, awin_product_id: '100046875', merchant_product_id: '100005800', product_name: 'Bahco Spanner 10mm', price: 11.99, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://www.tooled-up.com/artwork/prodzoom/a.jpg', is_active: 1, updated_at: '2026-09-20 19:00:00' },
  { id: 2, awin_product_id: '10066565757', merchant_product_id: '100005803', product_name: 'Stanley Hammer', price: 20, currency: 'GBP', stock_status: 'Available to Order',
    image_url: 'https://images2.productserve.com/?w=200&h=200&bg=white&trim=5&t=letterbox&url=ssl%3Awww.tooled-up.com%2Fartwork%2Fprodzoom%2Fb.jpg', is_active: 1, updated_at: '2026-10-06 20:49:24' },
  { id: 3, awin_product_id: '10310084311', merchant_product_id: '100645949', product_name: 'Makita Drill', price: 99, currency: 'GBP', stock_status: 'Available to Order', image_url: 'https://www.tooled-up.com/artwork/prodzoom/c.jpg', is_active: 1, updated_at: '2026-09-01 10:00:00' },
  { id: 4, awin_product_id: '999', merchant_product_id: '300', product_name: 'Same Product (found by the shop id)', price: 5, currency: 'GBP', stock_status: 'in_stock', image_url: 'https://www.tooled-up.com/artwork/prodzoom/d.jpg', is_active: 1, updated_at: '2026-09-02 10:00:00' },
  { id: 5, awin_product_id: '555', merchant_product_id: '555', product_name: 'Gone From Feed', price: 7, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://x/5.jpg', is_active: 1, updated_at: '2026-09-03 10:00:00' }
];
const CGW_COSTS = { price: 3, image_url: 1, stock_status: 1, is_active: 12, updated_at: 1 };
const HGW_COSTS = { price: 4, image_url: 3, stock_status: 3, is_active: 6, updated_at: 3 };
const RUN = new Date('2026-10-25T12:00:00Z');
const STAMP = '2026-10-24 21:30:15';

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
  const p = planRefresh({ rows: TU, feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED });
  const by = Object.fromEntries(p.changes.map(c => [c.id, c.set]));
  assert.deepEqual(by[1], { price: 12.5 }, 'price only');
  assert.deepEqual(by[2], { image_url: 'https://www.tooled-up.com/artwork/prodzoom/b.jpg', stock_status: 'Out of Stock' }, 'full picture instead of the 200px proxy; sold out in the shop\'s own words');
  assert.equal(by[3], undefined, '99 -> 900 is a jump: not changed');
  assert.deepEqual(p.bigPrice.map(b => [b.id, b.from, b.to]), [[3, 99, 900]]);
  assert.equal(by[4], undefined, 'in_stock and "In Stock" are the same for the site: no value to write');
  assert.deepEqual(p.seen.map(s => s.id), [4], 'but the feed confirms it: it gets the date');
  assert.deepEqual(p.hides, [5]);
  assert.equal(p.writes, 3 + 1 + 12 + 1, 'price 3, picture+stock 1, hide 12, date 1');
  assert.equal(p.same, 1, 'only the price jump is left as it is');
});

test('Reidl: stock "1" -> "0" in the shop\'s own convention; another currency in the feed keeps the price; GS Workwear ids "<advertiser>:<shop id>"', async () => {
  const dir = archive();
  const feed = await readFeed((await findFeeds(dir, 'Reidl')).files);
  const rows = [
    { id: 10, awin_product_id: '44606347019', merchant_product_id: '101915', product_name: 'Reidl Saw', price: 28, currency: 'EUR', stock_status: '1', image_url: 'https://rdlcdn.de/s/100009.jpg?class=czl', is_active: 1, updated_at: '2026-10-06 22:37:57' },
    { id: 11, awin_product_id: '44606347020', merchant_product_id: '101916', product_name: 'Reidl Old', price: 8, currency: 'EUR', stock_status: '1', image_url: 'https://rdlcdn.de/s/100010.jpg', is_active: 1, updated_at: '2026-10-06 22:37:57' }
  ];
  const p = planRefresh({ rows, feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED });
  const by = Object.fromEntries(p.changes.map(c => [c.id, c.set]));
  assert.deepEqual(by[10], { price: 30, stock_status: '0' });
  assert.equal(by[11], undefined, 'GBP in the feed, EUR on the site: the price is not changed');
  assert.equal(p.currencySkip.length, 1);
  assert.equal(p.seen.length, 0, 'and the price is not confirmed: no date');
  const gs = await readFeed((await findFeeds(dir, 'GS Workwear')).files);
  const g = planRefresh({ rows: [{ id: 20, awin_product_id: '48473:2786-2786-bodywarmer', merchant_product_id: null, price: 20, currency: 'GBP', stock_status: 'in stock', image_url: 'https://gs/1.jpg', is_active: 1, updated_at: '2026-10-21 22:06:22' }],
    feed: gs, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED });
  assert.deepEqual(g.changes.map(c => [c.set, c.stamp]), [[{ price: 25 }, STAMP]]);
  assert.equal(g.hides.length, 0);
});

test('L108 seen: the date is the time the feed file was downloaded (SQLite UTC text), never now; hidden, gone, jump, currency and price-less rows get none', async () => {
  const dir = archive();
  const files = (await findFeeds(dir, 'Tooled Up')).files;
  const pick = pickFeedFiles(files);
  assert.equal(pick.feedTime, Math.floor(DOWNLOADED / 1000) * 1000 + (pick.feedTime % 1000), 'the file time of the PC');
  assert.equal(sqliteTime(pick.feedTime), STAMP, 'whole seconds, rounded down: never later than the download');
  assert.match(sqliteTime(Date.now()), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'the text the older layout keeps (datetime(\'now\'))');
  const feed = await readFeed(files);
  const rows = [...TU,
    { id: 6, awin_product_id: '666', merchant_product_id: '666', product_name: 'Hidden By A Clean-up', price: 3, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://x/6.jpg', is_active: 0, updated_at: '2026-09-01 10:00:00' },
    { id: 7, awin_product_id: '777', merchant_product_id: '777', product_name: 'No Price', price: 4, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://x/7.jpg', is_active: 1, updated_at: '2026-09-01 10:00:00' }];
  const p = planRefresh({ rows, feed, costs: CGW_COSTS, now: RUN, feedTime: pick.feedTime });
  assert.equal(p.stamp, STAMP);
  assert.ok(p.stamp < sqliteTime(RUN.getTime()), 'not the time of the run');
  assert.deepEqual(p.seen.map(s => s.id), [4], 'only the confirmed row without another change');
  assert.deepEqual(p.changes.map(c => [c.id, c.stamp]), [[1, STAMP], [2, STAMP]], 'the rows that change get the same date');
  const dated = new Set([...p.seen.map(s => s.id), ...p.changes.filter(c => c.stamp).map(c => c.id)]);
  for (const id of [3, 5, 6, 7]) assert.ok(!dated.has(id), `row ${id}: no date (jump, gone, hidden, no feed price)`);
  // What the visitors see on 25 Oct: rows 1, 3, 4, 5, 7 are hidden today (before 25 Sep); 1 and 4 come back.
  assert.deepEqual(viewDays(RUN.getTime()), { cutoff: '2026-09-25', checkFrom: '2026-10-11' });
  assert.equal(p.visible.hiddenNow, 5);
  assert.equal(p.visible.revive, 2);
  assert.equal(p.visible.checkNow, 1, 'row 2 (6 Oct) says "check at the retailer"');
  assert.equal(p.visible.uncheck, 1, 'and shows its stock again');
  assert.deepEqual(p.visible.still, { jump: 1, gone: 1, 'no-price': 1 });
  // The sites' own test (src/lib/visibility.js) on the rows after the plan: shown, no "check at the retailer".
  const view = viewFor(null, 'GB', RUN.getTime());
  for (const id of dated) {
    assert.ok(isShown(view, { retailer: 'Tooled Up', last_seen_at: p.stamp }), `row ${id} is shown`);
    assert.ok(!needsCheck(view, { last_seen_at: p.stamp }));
  }
  assert.ok(!isShown(view, { retailer: 'Tooled Up', last_seen_at: rows[2].updated_at }), 'the price jump stays hidden');
});

test('L108: a feed file downloaded more than 2 days before the run writes no date (and says so in Greek); -Stale changes nothing for it', async () => {
  const old = Date.parse('2026-10-22T11:00:00Z');
  const dir = archive(old);
  const files = (await findFeeds(dir, 'Tooled Up')).files;
  const pick = pickFeedFiles(files);
  const feed = await readFeed(files);
  const p = planRefresh({ rows: TU, feed, costs: CGW_COSTS, now: RUN, feedTime: pick.feedTime });
  assert.ok(p.fileAgeDays > FEED_FILE_MAX_DAYS);
  assert.equal(p.datesOk, false);
  assert.equal(p.dateBlock, 'old-file');
  assert.equal(p.seen.length, 0);
  assert.deepEqual(p.changes.map(c => c.stamp), ['', ''], 'values still change (per-pair mode), but without a date');
  assert.equal(p.writes, 3 + 1 + 12);
  assert.equal(p.visible.revive, 0);
  assert.equal(p.visible.reviveIfFresh, 2, 'with a fresh download: 2 would come back');
  const st = planStatements(p);
  assert.ok([...st.update, ...st.hide, ...st.seen].every(s => !/updated_at/.test(s.sql.split(' WHERE ')[0])), 'no statement writes a date');
  const report = renderReport({ retailer: 'Tooled Up', site: 'cgw', feedFiles: ['AWIN_496_1001.csv.gz'], feedRows: 6, newest: feed.newest, p });
  assert.match(report, /ΠΡΟΣΟΧΗ: το αρχείο του feed κατέβηκε πριν από 3 μέρες \(πάνω από 2\)\. Δεν γράφεται ΚΑΜΙΑ ημερομηνία/);
  assert.match(report, /Κατέβασε πρώτα ξανά το feed/);
  // Exactly 2 days old: still fresh enough.
  const edge = planRefresh({ rows: TU, feed, costs: CGW_COSTS, now: new Date(old + 2 * 86400000), feedTime: old });
  assert.equal(edge.datesOk, true);
  // The one-paste mode: the shop waits for a fresh feed, nothing at all is written.
  const one = planRefresh({ rows: TU, feed, costs: CGW_COSTS, now: RUN, feedTime: pick.feedTime, requireDates: true });
  assert.equal(one.skip, 'old-file');
  assert.equal(one.changes.length + one.hides.length + one.seen.length + one.writes, 0);
  assert.deepEqual(one.visible.still, { 'old-file': 4 });
  // No file time at all: no date.
  assert.equal(planRefresh({ rows: TU, feed, costs: CGW_COSTS, now: RUN }).seen.length, 0);
});

test('L39 kept: a feed whose own products were last updated more than 30 days ago changes nothing, even when just downloaded', async () => {
  const dir = archive(Date.parse('2026-12-29T20:00:00Z'));
  const files = (await findFeeds(dir, 'Tooled Up')).files;
  const feed = await readFeed(files);
  const p = planRefresh({ rows: TU, feed, costs: CGW_COSTS, now: new Date('2026-12-30T12:00:00Z'), feedTime: pickFeedFiles(files).feedTime });
  assert.equal(p.stale, true);
  assert.equal(p.datesOk, true, 'the file itself is fresh');
  assert.equal(p.skip, 'stale-feed');
  assert.equal(p.changes.length + p.hides.length + p.seen.length + p.writes, 0);
  assert.equal(p.visible.reviveIfFresh, 0);
});

test('L108: a row the database changed after the download is newer than the feed and is not touched', async () => {
  const dir = archive();
  const feed = await readFeed((await findFeeds(dir, 'Tooled Up')).files);
  const rows = TU.map(r => (r.id === 1 || r.id === 4 ? { ...r, updated_at: '2026-10-25 08:00:00' } : r));
  const p = planRefresh({ rows, feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED });
  assert.equal(p.newer, 2);
  assert.ok(!p.changes.some(c => c.id === 1) && !p.seen.some(s => s.id === 4));
  // The same row checked at exactly the download time is not written again (D1 bills an unchanged value too).
  const again = planRefresh({ rows: TU.map(r => (r.id === 4 ? { ...r, updated_at: STAMP } : r)), feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED });
  assert.ok(!again.seen.some(s => s.id === 4));
  // An ISO date compares as the same moment.
  const iso = planRefresh({ rows: TU.map(r => (r.id === 4 ? { ...r, updated_at: '2026-10-24T21:30:15.000Z' } : r)), feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED });
  assert.ok(!iso.seen.some(s => s.id === 4) && iso.newer === 0);
});

test('safety: a feed missing most products hides nothing; the write budget: changes, then hides, then dates oldest first; the rest for the next run', async () => {
  const dir = archive();
  const feed = await readFeed((await findFeeds(dir, 'Tooled Up')).files);
  const many = Array.from({ length: 150 }, (_, i) => ({ id: 1000 + i, awin_product_id: `x${i}`, merchant_product_id: `y${i}`, price: 1, currency: 'GBP', stock_status: '1', image_url: '', is_active: 1, updated_at: '2026-10-01 10:00:00' }));
  const broken = planRefresh({ rows: [...TU, ...many], feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED });
  assert.equal(broken.safe, false);
  assert.equal(broken.hides.length, 0);
  assert.equal(broken.visible.still['gone-unsafe'], 1, 'the gone row of 3 Sep stays active (and hidden by its date)');
  const small = planRefresh({ rows: TU, feed, costs: CGW_COSTS, maxWrites: 4, now: RUN, feedTime: DOWNLOADED });
  assert.equal(small.writes, 4);
  assert.deepEqual([small.changes.length, small.hides.length, small.seen.length, small.left.changes, small.left.hides, small.left.seen], [2, 0, 0, 0, 1, 1]);
  // Dates: the oldest first (the rows the sites hide come back first).
  const rows = Array.from({ length: 5 }, (_, i) => ({ id: 50 + i, awin_product_id: '200', merchant_product_id: '300', price: 5, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://www.tooled-up.com/artwork/prodzoom/d.jpg', is_active: 1, updated_at: `2026-10-0${5 - i} 10:00:00` }));
  const dates = planRefresh({ rows, feed, costs: HGW_COSTS, maxWrites: 9, now: RUN, feedTime: DOWNLOADED });
  assert.deepEqual(dates.seen.map(s => s.id), [54, 53, 52], 'three rows of 3 writes each (HGW: the FTS trigger)');
  assert.equal(dates.writes, 9);
  assert.equal(dates.left.seen, 2);
});

test('L108 statements: equal changes in one UPDATE ... WHERE id IN (up to 500 ids), grouped by the same date; files of at most 50 statements and 5,000 rows written', () => {
  assert.equal(IDS_PER_STATEMENT, 500);
  assert.equal(MAX_STATEMENTS_PER_FILE, 50);
  assert.equal(MAX_WRITES_PER_FILE, 5000);
  const seen = Array.from({ length: 1200 }, (_, i) => ({ id: 1 + i, old: '2026-09-01 10:00:00' }));
  const p = { changes: [], hides: [], seen, stamp: STAMP, costs: CGW_COSTS };
  const st = planStatements(p);
  assert.equal(st.seen.length, 3);
  assert.deepEqual(st.seen.map(s => s.rows), [500, 500, 200]);
  assert.match(st.seen[0].sql, /^UPDATE products SET updated_at = '2026-10-24 21:30:15' WHERE id IN \(1, 2, 3, .* 500\) AND \(updated_at IS NULL OR updated_at <= '2026-09-01 10:00:00'\);$/);
  assert.equal(st.rollback.length, 3, 'the rollback groups the rows with the same old date');
  // Stock changes to the same word: one statement; price changes: one per product.
  const changes = [
    ...Array.from({ length: 3 }, (_, i) => ({ id: 10 + i, set: { stock_status: 'Out of Stock' }, old: { stock_status: 'In Stock' }, oldDate: '2026-09-01 10:00:00', stamp: STAMP, writes: 1 })),
    { id: 20, set: { price: 9.5 }, old: { price: 10 }, oldDate: '2026-09-02 10:00:00', stamp: STAMP, writes: 3 },
    { id: 21, set: { price: 7 }, old: { price: 8 }, oldDate: null, stamp: '', writes: 3 }
  ];
  const s2 = planStatements({ changes, hides: [30, 31], hideDates: { 30: '2026-09-03 10:00:00', 31: null }, seen: [], stamp: STAMP, costs: CGW_COSTS });
  // Every forward statement keeps its rows only while nobody changed them after our read (L108): the newest date read.
  assert.deepEqual(s2.update.map(s => s.sql), [
    "UPDATE products SET stock_status = 'Out of Stock', updated_at = '2026-10-24 21:30:15' WHERE id IN (10, 11, 12) AND (updated_at IS NULL OR updated_at <= '2026-09-01 10:00:00');",
    "UPDATE products SET price = 9.5, updated_at = '2026-10-24 21:30:15' WHERE id = 20 AND (updated_at IS NULL OR updated_at <= '2026-09-02 10:00:00');",
    'UPDATE products SET price = 7 WHERE id = 21 AND updated_at IS NULL;'
  ]);
  assert.deepEqual(s2.hide.map(s => s.sql), ["UPDATE products SET is_active = 0 WHERE id IN (30, 31) AND is_active = 1 AND (updated_at IS NULL OR updated_at <= '2026-09-03 10:00:00');"], 'a hidden row gets no date; only rows still active and unchanged');
  // The rollback of a dated row only while it still has our date; of the others only while unchanged since our read.
  assert.ok(s2.rollback.some(s => s.sql === "UPDATE products SET price = 10, updated_at = '2026-09-02 10:00:00' WHERE id = 20 AND updated_at = '2026-10-24 21:30:15';"));
  assert.ok(s2.rollback.some(s => s.sql === 'UPDATE products SET price = 8 WHERE id = 21 AND updated_at IS NULL;'), 'no date written, none put back');
  assert.ok(s2.rollback.some(s => s.sql === "UPDATE products SET is_active = 1 WHERE id IN (30, 31) AND is_active = 0 AND (updated_at IS NULL OR updated_at <= '2026-09-03 10:00:00');"));
  assert.throws(() => planStatements({ changes: [], hides: [40], seen: [], stamp: STAMP, costs: CGW_COSTS }), /no date read for id 40/, 'a statement without the date read is never written');
  // A hide on CGW writes 12 rows per product: at most 416 ids per statement, so one statement stays under 5,000.
  assert.equal(idsPerStatement(12), 416);
  assert.equal(idsPerStatement(1), 500);
  const hides = groupedStatements([{ set: 'is_active = 0', ids: Array.from({ length: 1000 }, (_, i) => i + 1), rowCost: 12 }]);
  assert.deepEqual(hides.map(h => h.rows), [416, 416, 168]);
  // Files: 120 single price changes -> 50 + 50 + 20 statements; 24 date statements of 500 rows -> 10 + 10 + 4.
  const prices = Array.from({ length: 120 }, (_, i) => ({ sql: `UPDATE products SET price = ${i} WHERE id = ${i};`, writes: 3 }));
  assert.deepEqual(splitFiles(prices).map(f => f.statements.length), [50, 50, 20]);
  const dates = groupedStatements([{ set: "updated_at = 'x'", ids: Array.from({ length: 12000 }, (_, i) => i + 1), rowCost: 1 }]);
  const files = splitFiles(dates);
  assert.deepEqual(files.map(f => [f.statements.length, f.writes]), [[10, 5000], [10, 5000], [4, 2000]]);
  for (const f of [...splitFiles(prices), ...files, ...splitFiles(hides)]) assert.ok(f.statements.length <= 50 && f.writes <= 5000);
});

test('the SQL on a copy of the CGW table: values and dates change by id, the gone product is hidden, the rollback puts everything back', async () => {
  const dir = archive();
  const feed = await readFeed((await findFeeds(dir, 'Tooled Up')).files);
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, awin_product_id TEXT NOT NULL UNIQUE, merchant_product_id TEXT, retailer TEXT NOT NULL,
    site_category TEXT NOT NULL DEFAULT 'Hand Tools', subcategory TEXT, brand TEXT, product_name TEXT NOT NULL, feed_product_name TEXT, price REAL NOT NULL,
    currency TEXT DEFAULT 'GBP', stock_status TEXT, merchant_category TEXT, image_url TEXT, affiliate_url TEXT NOT NULL DEFAULT 'x', ean TEXT,
    is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, specs_json TEXT, product_slug TEXT);`);
  for (const s of CGW_INDEXES) db.exec(s + ';');
  const ins = db.prepare('INSERT INTO products (id, awin_product_id, merchant_product_id, retailer, product_name, price, currency, stock_status, image_url, is_active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const r of TU) ins.run(r.id, r.awin_product_id, r.merchant_product_id, 'Tooled Up', r.product_name, r.price, r.currency, r.stock_status, r.image_url, 1, r.updated_at);
  ins.run(6, '666', '666', 'Tooled Up', 'Hidden by a clean-up', 3, 'GBP', 'In Stock', 'https://x/6.jpg', 0, '2026-09-01 10:00:00');
  const before = db.prepare('SELECT id, price, image_url, stock_status, is_active, updated_at FROM products ORDER BY id').all();
  const rows = db.prepare('SELECT * FROM products WHERE is_active = 1').all();
  const out = mkdtempSync(join(tmpdir(), 'refresh-out-'));
  const summary = writePlan(out, planRefresh({ rows, feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED }));
  assert.deepEqual(summary.files.map(f => f.name), ['update-0001.sql', 'hide-0001.sql', 'seen-0001.sql'], 'run order: values, hides, dates');
  for (const f of summary.files) db.exec(readFileSync(join(out, f.name), 'utf8'));
  const after = Object.fromEntries(db.prepare('SELECT id, price, stock_status, is_active, updated_at FROM products').all().map(r => [r.id, r]));
  assert.equal(after[1].price, 12.5);
  assert.equal(after[1].updated_at, STAMP, 'a change gets the feed time, not datetime(\'now\')');
  assert.equal(after[2].stock_status, 'Out of Stock');
  assert.equal(after[4].updated_at, STAMP, 'seen: confirmed by the feed');
  assert.equal(after[3].updated_at, '2026-09-01 10:00:00', 'the price jump keeps its old date');
  assert.equal(after[5].is_active, 0, 'gone from the feed: hidden');
  assert.equal(after[5].updated_at, '2026-09-03 10:00:00', 'and no date');
  assert.equal(after[6].is_active, 0, 'hidden before: stays hidden');
  assert.equal(after[6].updated_at, '2026-09-01 10:00:00', 'and gets no date');
  db.exec(readFileSync(join(out, 'rollback.sql'), 'utf8'));
  assert.deepEqual(db.prepare('SELECT id, price, image_url, stock_status, is_active, updated_at FROM products ORDER BY id').all(), before, 'rollback: exactly as before, dates too');
  // The split rollback files give the same result.
  for (const f of summary.files) db.exec(readFileSync(join(out, f.name), 'utf8'));
  for (const f of summary.rollbackFiles) db.exec(readFileSync(join(out, f), 'utf8'));
  assert.deepEqual(db.prepare('SELECT id, price, image_url, stock_status, is_active, updated_at FROM products ORDER BY id').all(), before);
});

test('the SQL on the older layout with its FTS trigger (tests/fixtures/ggw-legacy-schema.sql): search still finds the products, rollback exact', async () => {
  const dir = archive();
  const feed = await readFeed((await findFeeds(dir, 'Tooled Up')).files);
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('tests/fixtures/ggw-legacy-schema.sql', 'utf8'));
  const ins = db.prepare("INSERT INTO products (id, awin_product_id, merchant_product_id, retailer, site_category, product_name, price, currency, stock_status, image_url, affiliate_url, is_active, updated_at) VALUES (?, ?, ?, 'Tooled Up', 'Garden Tools', ?, ?, ?, ?, ?, 'x', 1, ?)");
  for (const r of TU) ins.run(r.id, r.awin_product_id, r.merchant_product_id, r.product_name, r.price, r.currency, r.stock_status, r.image_url, r.updated_at);
  const schema = db.prepare("SELECT type, name, sql FROM sqlite_master WHERE tbl_name = 'products' AND type IN ('index', 'trigger')").all();
  const costs = writeCosts(schema);
  assert.equal(costs.updated_at, 3, 'the fixture has the FTS trigger on every UPDATE, like MGW, WGW, KGW, HGW and GGW');
  const before = db.prepare('SELECT id, price, image_url, stock_status, is_active, updated_at FROM products ORDER BY id').all();
  const out = mkdtempSync(join(tmpdir(), 'refresh-fts-'));
  const summary = writePlan(out, planRefresh({ rows: db.prepare('SELECT * FROM products WHERE is_active = 1').all(), feed, costs, now: RUN, feedTime: DOWNLOADED }));
  for (const f of summary.files) db.exec(readFileSync(join(out, f.name), 'utf8'));
  assert.equal(db.prepare("SELECT updated_at AS d FROM products WHERE id = 4").get().d, STAMP);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products_fts WHERE products_fts MATCH 'spanner'").get().n, 1, 'the search index is intact');
  db.exec(readFileSync(join(out, 'rollback.sql'), 'utf8'));
  assert.deepEqual(db.prepare('SELECT id, price, image_url, stock_status, is_active, updated_at FROM products ORDER BY id').all(), before);
});

test('one-paste mode: the feeds of many shops in one pass; .csv and .csv.gz of one feed count once (the newer); times and advertisers', async () => {
  const dir = archive();
  const older = Date.parse('2026-10-20T09:00:00Z');
  writeFileSync(join(dir, 'AWIN_496_1001.csv'), HEAD + line({ name: 'Old copy', aw: '1', mid: '1', price: 1, merchant: 'Tooled Up', adv: 496 }));
  utimesSync(join(dir, 'AWIN_496_1001.csv'), older / 1000, older / 1000);
  const r = await findFeedsFor(dir, ['Tooled Up', 'Reidl', 'Tooled Down', 'Nobody'], RUN.getTime());
  assert.deepEqual(r[0].files.map(f => [f.file, f.advertiser, f.feed, f.time]), [['AWIN_496_1001.csv.gz', '496', '1001', STAMP]], 'the newer copy only');
  assert.deepEqual(r[0].advertisers, ['496']);
  assert.equal(r[0].ageDays, 0.6);
  assert.deepEqual(r[1].advertisers, ['122822']);
  assert.equal(r[2].files.length, 0);
  assert.deepEqual(r[2].similar, ['AWIN_496_1001.csv: Tooled Up', 'AWIN_496_1001.csv.gz: Tooled Up'], 'similar names are listed');
  assert.deepEqual(r[3], { retailer: 'Nobody', files: [], advertisers: [], matchedBy: '', feedTime: '', ageDays: null, similar: [] });
  assert.equal(r[0].matchedBy, 'name');
  const two = pickFeedFiles([join(dir, 'AWIN_496_1001.csv'), join(dir, 'AWIN_496_1001.csv.gz'), join(dir, 'AWIN_122822_2002.csv.gz')]);
  assert.equal(two.files.length, 2);
  assert.equal(two.dropped.length, 1);
});

test('command line: report and counts from wrangler output files; no feed found -> exit 3 with the names of similar feeds; --find; --require-dates', () => {
  const dir = archive();
  const out = mkdtempSync(join(tmpdir(), 'refresh-cli-'));
  const rowsFile = join(out, 'rows-001.json.txt');
  writeFileSync(rowsFile, 'some wrangler text\n' + JSON.stringify([{ results: TU, success: true }]));
  const idxFile = join(out, 'indexes.json.txt');
  writeFileSync(idxFile, JSON.stringify([{ results: [...CGW_INDEXES.map((sql, i) => ({ type: 'index', name: `i${i}`, sql })), ...CGW_TRIGGERS.map((sql, i) => ({ type: 'trigger', name: `t${i}`, sql }))], success: true }]));
  const tool = join(process.cwd(), 'tools', 'legacy-refresh-plan.mjs');
  execFileSync(process.execPath, [tool, '--archive', dir, '--retailer', 'Tooled Up', '--site', 'cgw', '--rows', rowsFile, '--indexes', idxFile, '--out', out, '--now', '2026-10-25T12:00:00Z']);
  // changes hides writes stale safe active seen revive datesOk files
  assert.equal(readFileSync(join(out, 'counts.txt'), 'utf8').trim(), '2 1 17 0 1 5 1 2 1 3');
  const report = readFileSync(join(out, 'report.txt'), 'utf8');
  assert.match(report, /ΠΡΟΣΟΧΗ: 1 τιμές αλλάζουν πάνω από 3 φορές/);
  assert.match(report, /απόκρυψη 12/);
  assert.match(report, /Ώρα λήψης του feed σε αυτόν τον υπολογιστή: 2026-10-24 21:30:15 UTC/);
  assert.match(report, /Θα φαίνονται ξανά: 2\./);
  const summary = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
  assert.equal(summary.stamp, STAMP);
  assert.deepEqual(summary.files.map(f => f.name), ['update-0001.sql', 'hide-0001.sql', 'seen-0001.sql']);
  const miss = spawnSync(process.execPath, [tool, '--archive', dir, '--retailer', 'Tooled', '--rows', rowsFile, '--out', join(out, 'x')]);
  assert.equal(miss.status, 3);
  assert.match(readFileSync(join(out, 'x', 'report.txt'), 'utf8'), /Παρόμοια: AWIN_496_1001\.csv\.gz: Tooled Up/);
  // The one-paste mode with a feed file of 3 days: nothing at all.
  const late = join(out, 'late');
  execFileSync(process.execPath, [tool, '--archive', dir, '--retailer', 'Tooled Up', '--site', 'cgw', '--rows', rowsFile, '--indexes', idxFile, '--out', late, '--now', '2026-10-27T22:00:00Z', '--require-dates']);
  assert.equal(readFileSync(join(late, 'counts.txt'), 'utf8').trim(), '0 0 0 0 1 5 0 0 0 0');
  assert.match(readFileSync(join(late, 'report.txt'), 'utf8'), /ΔΕΝ αλλάζει καθόλου μέχρι να κατέβει φρέσκο feed/);
  const names = join(out, 'names.txt');
  writeFileSync(names, '﻿Tooled Up\r\nReidl\r\n');
  execFileSync(process.execPath, [tool, '--find', '--archive', dir, '--retailers-file', names, '--out', join(out, 'find'), '--now', '2026-10-25T12:00:00Z']);
  const feeds = JSON.parse(readFileSync(join(out, 'find', 'feeds.json'), 'utf8'));
  assert.deepEqual(feeds.map(f => [f.retailer, f.advertisers.join(','), f.feedTime]), [['Tooled Up', '496', STAMP], ['Reidl', '122822', STAMP]]);
});

test('the dates of the sites and of the plan are the same days (src/lib/visibility.js)', () => {
  const at = Date.parse('2026-11-09T12:00:00Z');
  const v = viewFor(null, 'GB', at);
  assert.deepEqual(viewDays(at), { cutoff: v.cutoff, checkFrom: v.checkFrom });
  assert.equal(HIDE_AFTER_DAYS, 30);
});

test('legacy-refresh.ps1: the one-paste mode, its one phrase, the download tool and small files with pauses (lessons L108)', () => {
  const ps = readFileSync('tools/legacy-refresh.ps1', 'utf8');
  assert.ok(ps.includes("$StalePhrase = 'ΕΓΚΡΙΝΩ REFRESH ΠΑΛΙΑ ΠΡΟΪΟΝΤΑ'"), 'the one phrase, defined in the tool');
  assert.ok(ps.includes("'ΕΓΚΡΙΝΩ REFRESH {0} {1}'"), 'the per-pair phrases stay');
  assert.ok(ps.includes('awin-feed-download.ps1'), 'fresh feeds with the existing download tool');
  assert.ok(ps.includes('[switch]$Stale') && ps.includes('[string]$Sites') && ps.includes('[switch]$PaidPlan'));
  assert.ok(ps.includes('Start-Sleep -Seconds $PauseSeconds'), 'a pause between the files');
  assert.ok(/αργά το βράδυ/.test(ps), 'the tip to run at a quiet time');
  assert.ok(!/updated_at = datetime/.test(readFileSync('tools/legacy-refresh-plan.mjs', 'utf8')), 'no date of the run in the SQL');
  assert.ok(ps.charCodeAt(0) === 0xfeff && ps.includes('\r\n'), 'UTF-8 with BOM and CRLF');
  // L108 checker: 7-day selection, no hides in -Stale, --yes on the rollback files (not on Time Travel), report as it goes.
  assert.ok(ps.includes('[int]$OlderThanDays = 7') && ps.includes("AS dsel") && ps.includes('MIN(affiliate_url) AS aurl'));
  assert.ok(ps.includes("$a += '--no-hide'") && ps.includes('$true $true'), '-Stale plans with --no-hide');
  assert.ok(ps.includes('--remote --file $_.FullName --yes') && ps.includes('--remote --file "{1}" --yes') && !/time-travel restore[^\r\n']*--yes/.test(ps));
  assert.ok(ps.includes('AppendAllText($script:ReportFile'), 'the report is written line by line');
  assert.ok(ps.includes("WHERE is_active = 1 AND id BETWEEN {0} AND 2147483647 ORDER BY id LIMIT 5000"), 'one paged read of the site for all its shops');
});

test('L108 checker: an empty or half feed hides nothing, also for a small shop; the one-paste mode never hides', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'refresh-empty-'));
  writeFileSync(join(dir, 'AWIN_496_1001.csv.gz'), gzipSync(HEAD));
  utimesSync(join(dir, 'AWIN_496_1001.csv.gz'), DOWNLOADED / 1000, DOWNLOADED / 1000);
  const empty = await readFeed([join(dir, 'AWIN_496_1001.csv.gz')]);
  assert.equal(empty.rows, 0);
  const small = Array.from({ length: 60 }, (_, i) => ({ id: 1 + i, awin_product_id: `a${i}`, merchant_product_id: `m${i}`, price: 5, currency: 'GBP', stock_status: 'In Stock', image_url: '', is_active: 1, updated_at: '2026-10-20 10:00:00' }));
  const p = planRefresh({ rows: small, feed: empty, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED });
  assert.equal(p.safe, false);
  assert.equal(p.hides.length, 0, 'a header-only feed hid 60 of 60 before the fix');
  // Half of a small shop missing: still hidden (per pair); more than half: nothing.
  const feed = await readFeed((await findFeeds(archive(), 'Tooled Up')).files);
  const four = TU.slice(0, 4);
  const two = [...four.slice(0, 2), { ...TU[4], id: 8 }, { ...TU[4], id: 9 }];
  assert.equal(planRefresh({ rows: two, feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED }).hides.length, 2, '2 of 4 gone: hidden');
  const three = [TU[0], { ...TU[4], id: 7 }, { ...TU[4], id: 8 }, { ...TU[4], id: 9 }];
  assert.equal(planRefresh({ rows: three, feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED }).hides.length, 0, '3 of 4 gone: nothing hidden');
  const kept = planRefresh({ rows: TU, feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED, noHide: true });
  assert.deepEqual([kept.hides.length, kept.gone], [0, 1]);
  assert.equal(kept.visible.still['gone-kept'], 1, 'listed: not in the feed, no date, the sites drop it after 30 days');
  assert.ok(planStatements(kept).hide.length === 0);
  assert.match(renderReport({ retailer: 'Tooled Up', site: 'cgw', feedFiles: ['x'], feedRows: 6, newest: feed.newest, p: kept }), /δεν κρύβονται, δεν παίρνουν ημερομηνία/);
});

test('L108 checker: a write between our read and our load is never overwritten, and the rollback never undoes a later change (SQLite)', async () => {
  const feed = await readFeed((await findFeeds(archive(), 'Tooled Up')).files);
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('tests/fixtures/ggw-legacy-schema.sql', 'utf8'));
  const ins = db.prepare("INSERT INTO products (id, awin_product_id, merchant_product_id, retailer, site_category, product_name, price, currency, stock_status, image_url, affiliate_url, is_active, updated_at) VALUES (?, ?, ?, 'Tooled Up', 'Tools', ?, ?, ?, ?, ?, 'x', 1, ?)");
  for (const r of TU) ins.run(r.id, r.awin_product_id, r.merchant_product_id, r.product_name, r.price, r.currency, r.stock_status, r.image_url, r.updated_at);
  const rows = db.prepare('SELECT * FROM products WHERE is_active = 1').all();
  const out = mkdtempSync(join(tmpdir(), 'refresh-race-'));
  const summary = writePlan(out, planRefresh({ rows, feed, costs: writeCosts([]), now: RUN, feedTime: DOWNLOADED }));
  // Someone else writes rows 1, 4 and 5 after our read (any Gear World tool sets updated_at to the time of writing).
  db.exec("UPDATE products SET price = 99.99, updated_at = '2026-10-25 11:00:00' WHERE id = 1");
  db.exec("UPDATE products SET image_url = 'https://x/new.jpg', updated_at = '2026-10-25 11:00:00' WHERE id = 4");
  db.exec("UPDATE products SET price = 6.5, updated_at = '2026-10-25 11:00:00' WHERE id = 5");
  for (const f of summary.files) db.exec(readFileSync(join(out, f.name), 'utf8'));
  const after = Object.fromEntries(db.prepare('SELECT id, price, image_url, is_active, updated_at FROM products').all().map(r => [r.id, r]));
  assert.deepEqual([after[1].price, after[1].updated_at], [99.99, '2026-10-25 11:00:00'], 'not 12.5 with an older date');
  assert.equal(after[4].updated_at, '2026-10-25 11:00:00', 'the later write keeps its date');
  assert.equal(after[5].is_active, 1, 'a row changed after our read is not hidden');
  assert.equal(after[2].updated_at, STAMP, 'the untouched rows are refreshed');
  // Rollback after another later change of a row we dated: that row keeps the later change.
  db.exec("UPDATE products SET price = 21, updated_at = '2026-10-25 12:00:00' WHERE id = 2");
  db.exec(readFileSync(join(out, 'rollback.sql'), 'utf8'));
  const back = Object.fromEntries(db.prepare('SELECT id, price, updated_at FROM products').all().map(r => [r.id, r]));
  assert.deepEqual([back[2].price, back[2].updated_at], [21, '2026-10-25 12:00:00'], 'the rollback does not undo a later change');
  assert.equal(back[1].price, 99.99);
  // The statements still look rows up by id only.
  for (const f of summary.files) for (const line of readFileSync(join(out, f.name), 'utf8').trim().split('\n')) assert.match(line, /^UPDATE products SET .* WHERE id (=|IN) /);
});

test('L108 checker: "Price checked" is never newer than the feed\'s own newest last_updated', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'refresh-honest-'));
  const name = join(dir, 'AWIN_496_1001.csv.gz');
  writeFileSync(name, gzipSync(HEAD
    + line({ name: 'Bahco Spanner 10mm', aw: '100046875', mid: '100005800', price: 11.99, merchant: 'Tooled Up', adv: 496, img: 'https://www.tooled-up.com/artwork/prodzoom/a.jpg', status: 'In Stock', updated: '2026-10-24 08:00:00' })
    + line({ name: 'Same Product', aw: '200', mid: '300', price: 5, merchant: 'Tooled Up', adv: 496, img: 'https://www.tooled-up.com/artwork/prodzoom/d.jpg', status: 'In Stock', updated: '2026-10-23 08:00:00' })));
  utimesSync(name, DOWNLOADED / 1000, DOWNLOADED / 1000);
  const feed = await readFeed([name]);
  const p = planRefresh({ rows: TU, feed, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED });
  // The feed's dates have no zone: read as the PC's own time, like the 30-day rule (UK on the owner's PC).
  const newest = sqliteTime(Date.parse('2026-10-24T08:00:00'));
  assert.equal(p.stamp, newest < STAMP ? newest : STAMP);
  assert.equal(p.stampFromFeed, newest < STAMP);
  assert.ok(p.seen.every(() => true) && p.datesOk, 'the 2-day file rule still decides whether dates are written');
  if (p.stampFromFeed) assert.match(renderReport({ retailer: 'Tooled Up', site: 'cgw', feedFiles: ['x'], feedRows: 2, newest: feed.newest, p }), /η νεότερη ενημέρωση του ίδιου του feed είναι/);
  // Never later than the download, never later than now.
  const later = planRefresh({ rows: TU, feed: { ...feed, newest: '2026-10-30 08:00:00', files: feed.files.map(f => ({ ...f, newest: '2026-10-30 08:00:00' })) }, costs: CGW_COSTS, now: RUN, feedTime: DOWNLOADED });
  assert.equal(later.stamp, STAMP);
  assert.equal(later.stampFromFeed, false);
  const out = mkdtempSync(join(tmpdir(), 'refresh-honest-out-'));
  assert.equal(writePlan(out, p).stampFromFeed, p.stampFromFeed);
});

test('L108 checker: a shop whose feed has another merchant_name is found by the Awin advertiser id of its links', async () => {
  assert.equal(advertiserOf('https://www.awin1.com/cread.php?awinmid=122382&awinaffid=3057233&ued=https%3A%2F%2Fwatchenclave.co.uk%2Fproducts%2Fx'), '122382');
  assert.equal(advertiserOf('https://www.awin1.com/pclick.php?p=28719916185&a=3057233&m=496'), '496', 'pclick: m is the advertiser, a is us');
  assert.equal(advertiserOf('https://www.awin1.com/cread.php?mid=13991&id=3057233&clickref=x'), '13991');
  assert.equal(advertiserOf('https://www.anrdoezrs.net/click-123-456?url=x'), '', 'a CJ link has no Awin advertiser');
  assert.equal(advertiserOf('https://www.awin1.com/pclick.php?p=1&a=3057233'), '');
  const dir = archive();
  const r = await findFeedsFor(dir, [{ retailer: 'Tooled Up Affiliate Programme', advertiser: '496' }, { retailer: 'Reidl', advertiser: '999' }, { retailer: '100 Percent Pure', advertiser: 'https://www.awin1.com/cread.php?awinmid=13991&awinaffid=3057233&ued=https%3A%2F%2Fwww.100percentpure.de%2Fx' }, 'Nobody'], RUN.getTime());
  assert.deepEqual([r[0].matchedBy, r[0].advertisers, r[0].files.map(f => f.file)], ['advertiser', ['496'], ['AWIN_496_1001.csv.gz']]);
  assert.deepEqual([r[1].matchedBy, r[1].advertisers], ['name', ['122822']], 'the name wins when it matches');
  assert.deepEqual([r[2].matchedBy, r[2].advertisers, r[2].files], ['', ['13991'], []], 'no feed here: the id is kept for the download');
  assert.deepEqual(r[3].advertisers, []);
  // The command line takes "<name><TAB><id>" lines; a whole site's rows are filtered to the shop.
  const out = mkdtempSync(join(tmpdir(), 'refresh-adv-'));
  const names = join(out, 'names.txt');
  writeFileSync(names, 'Tooled Up Affiliate Programme\thttps://www.awin1.com/pclick.php?p=28719916185&a=3057233&m=496\r\nNobody\t\r\n');
  const tool = join(process.cwd(), 'tools', 'legacy-refresh-plan.mjs');
  execFileSync(process.execPath, [tool, '--find', '--archive', dir, '--retailers-file', names, '--out', join(out, 'find'), '--now', '2026-10-25T12:00:00Z']);
  const feeds = JSON.parse(readFileSync(join(out, 'find', 'feeds.json'), 'utf8'));
  assert.deepEqual(feeds.map(f => [f.retailer, f.matchedBy, f.advertisers.join(',')]), [['Tooled Up Affiliate Programme', 'advertiser', '496'], ['Nobody', '', '']]);
  const rowsFile = join(out, 'site-rows.json.txt');
  writeFileSync(rowsFile, JSON.stringify([{ results: [...TU.map(r => ({ ...r, retailer: 'Tooled Up' })), { ...TU[0], id: 77, retailer: 'Other Shop' }], success: true }]));
  execFileSync(process.execPath, [tool, '--archive', dir, '--retailer', 'Tooled Up', '--site', 'cgw', '--rows', rowsFile, '--out', join(out, 'plan'), '--feed-file', 'AWIN_496_1001.csv.gz', '--now', '2026-10-25T12:00:00Z', '--no-hide']);
  const s = JSON.parse(readFileSync(join(out, 'plan', 'summary.json'), 'utf8'));
  assert.deepEqual([s.active, s.hides, s.noHide], [5, 0, true], 'only the shop\'s own rows; nothing hidden with --no-hide');
});

test('L108 re-run fix: a shop with fresh feeds and 24-day-old leftover files dates every row by the NEWEST file it is in', async () => {
  // Tooled Up on 9 Nov: AWIN_496_118473 (Awin's current list, just downloaded) next to AWIN_496_19857 and AWIN_496_496
  // (Awin no longer lists them, 24 days old). The shop's oldest file used to date (and block) the whole shop.
  const dir = mkdtempSync(join(tmpdir(), 'refresh-leftover-'));
  const now = Date.parse('2026-11-09T19:00:00Z');
  const fresh = now - 2 * 3600000;
  const old = Date.parse('2026-10-15T22:07:43Z');
  const put = (name, text, time) => { writeFileSync(join(dir, name), gzipSync(text)); utimesSync(join(dir, name), time / 1000, time / 1000); };
  const upd = '2026-11-10 12:00:00'; // after the download in every zone: the file time decides
  put('AWIN_496_118473.csv.gz', HEAD
    + line({ name: 'In both', aw: '1', mid: '1', price: 10, merchant: 'Tooled Up', adv: 496, img: 'https://x/1.jpg', status: 'In Stock', updated: upd })
    + line({ name: 'Only fresh', aw: '2', mid: '2', price: 20, merchant: 'Tooled Up', adv: 496, img: 'https://x/2.jpg', status: 'In Stock', updated: upd }), fresh);
  put('AWIN_496_19857.csv.gz', HEAD
    + line({ name: 'In both (old copy)', aw: '1', mid: '1', price: 9, merchant: 'Tooled Up', adv: 496, img: 'https://x/1-old.jpg', status: 'In Stock', updated: '2026-10-15 20:00:00' })
    + line({ name: 'Only old', aw: '3', mid: '3', price: 30, merchant: 'Tooled Up', adv: 496, img: 'https://x/3.jpg', status: 'In Stock', updated: '2026-10-15 20:00:00' }), old);
  put('AWIN_496_496.csv.gz', HEAD + line({ name: 'Only old 2', aw: '4', mid: '4', price: 40, merchant: 'Tooled Up', adv: 496, img: 'https://x/4.jpg', status: 'In Stock', updated: '2026-10-15 20:00:00' }), old);
  const files = (await findFeeds(dir, 'Tooled Up')).files;
  assert.equal(files.length, 3);
  const feed = await readFeed(files);
  assert.equal(feed.files[0].path.endsWith('AWIN_496_118473.csv.gz'), true, 'the newest file is read first');
  assert.equal(matchRow({ awin_product_id: '1' }, feed).price, 10, 'a product in both files takes the fresh values');
  // Rows as the live ones: dated 6 Oct (hidden), and 20 Oct (after the old files, before the fresh one).
  const rows = [
    { id: 1, awin_product_id: '1', merchant_product_id: '1', price: 10, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://x/1.jpg', is_active: 1, updated_at: '2026-10-06 20:49:24' },
    { id: 2, awin_product_id: '2', merchant_product_id: '2', price: 20, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://x/2.jpg', is_active: 1, updated_at: '2026-10-20 10:00:00' },
    { id: 3, awin_product_id: '3', merchant_product_id: '3', price: 30, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://x/3.jpg', is_active: 1, updated_at: '2026-10-06 20:49:24' },
    { id: 4, awin_product_id: '4', merchant_product_id: '4', price: 41, currency: 'GBP', stock_status: 'In Stock', image_url: 'https://x/4.jpg', is_active: 1, updated_at: '2026-10-06 20:49:24' }
  ];
  const freshStamp = sqliteTime(fresh);
  // The one-paste mode (-Stale): the shop is NOT skipped; rows 1 and 2 get the fresh time; rows 3 and 4 (only in the
  // old files) get nothing, not even the price of the old file.
  const p = planRefresh({ rows, feed, costs: HGW_COSTS, now: new Date(now), requireDates: true, noHide: true });
  assert.equal(p.skip, '');
  assert.equal(p.datesOk, true);
  assert.equal(p.stamp, freshStamp);
  assert.deepEqual(p.seen.map(s => [s.id, s.stamp]), [[1, freshStamp], [2, freshStamp]]);
  assert.equal(p.newer, 0, 'row 2 (20 Oct) is older than its own file, not "changed after the download"');
  assert.equal(p.changes.length, 0, 'row 4: the old file says 40, but an old file changes nothing');
  assert.equal(p.oldOnly, 2);
  assert.deepEqual(p.oldFiles.map(f => f.file).sort(), ['AWIN_496_19857.csv.gz', 'AWIN_496_496.csv.gz']);
  assert.equal(p.visible.revive, 1);
  assert.equal(p.visible.still['old-file'], 2);
  const st = planStatements(p);
  assert.deepEqual(st.seen.map(s => s.sql), [`UPDATE products SET updated_at = '${freshStamp}' WHERE id IN (1, 2) AND (updated_at IS NULL OR updated_at <= '2026-10-20 10:00:00');`]);
  const report = renderReport({ retailer: 'Tooled Up', site: 'cgw', feedFiles: files.map(f => f.split(/[\\/]/).pop()), feedRows: feed.rows, newest: feed.newest, p });
  assert.match(report, /Παλιά αρχεία feed του ίδιου καταστήματος .*AWIN_496_19857\.csv\.gz \(24\.9 ημ\.\)/);
  assert.match(report, /2 προϊόντα βρίσκονται μόνο στα παλιά αρχεία: δεν παίρνουν ημερομηνία/);
  // The per-pair mode: rows only in old files still get their values, without a date.
  const pair = planRefresh({ rows, feed, costs: HGW_COSTS, now: new Date(now) });
  assert.deepEqual(pair.changes.map(c => [c.id, c.set, c.stamp]), [[4, { price: 40 }, '']]);
  assert.deepEqual(pair.seen.map(s => s.id), [1, 2]);
  // Only old files (the leftovers alone): nothing in the one-paste mode, as before.
  const onlyOld = await readFeed(files.filter(f => !/118473/.test(f)));
  const none = planRefresh({ rows, feed: onlyOld, costs: HGW_COSTS, now: new Date(now), requireDates: true, noHide: true });
  assert.equal(none.skip, 'old-file');
  assert.equal(none.writes, 0);
  // Two fresh files at different times: each row its own file time, grouped by time; the rollback per time.
  const t2 = fresh - 3600000;
  put('AWIN_496_496.csv.gz', HEAD + line({ name: 'Only old 2', aw: '4', mid: '4', price: 40, merchant: 'Tooled Up', adv: 496, img: 'https://x/4.jpg', status: 'In Stock', updated: upd }), t2);
  const two = planRefresh({ rows: rows.map(r => (r.id === 4 ? { ...r, price: 40 } : r)), feed: await readFeed(files), costs: HGW_COSTS, now: new Date(now), requireDates: true, noHide: true });
  assert.deepEqual(two.seen.map(s => [s.id, s.stamp]), [[1, freshStamp], [4, sqliteTime(t2)], [2, freshStamp]]);
  const st2 = planStatements(two);
  assert.equal(st2.seen.length, 2, 'one statement per time');
  assert.ok(st2.rollback.some(s => s.sql.endsWith(`AND updated_at = '${sqliteTime(t2)}';`)) && st2.rollback.some(s => s.sql.endsWith(`AND updated_at = '${freshStamp}';`)));
});

test('L108 re-run fix: a dead feed is named (InStock UK: 1 product, last updated in May)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'refresh-dead-'));
  writeFileSync(join(dir, 'AWIN_2004_115403.csv.gz'), gzipSync(HEAD + line({ name: 'Last one', aw: '9', mid: '9', price: 5, merchant: 'InStock UK', adv: 2004, updated: '2026-05-15 10:00:00' })));
  const feed = await readFeed([join(dir, 'AWIN_2004_115403.csv.gz')]);
  const rows = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, awin_product_id: `x${i}`, merchant_product_id: `y${i}`, price: 5, currency: 'GBP', stock_status: 'In Stock', image_url: '', is_active: 1, updated_at: '2026-10-29 23:14:40' }));
  const p = planRefresh({ rows, feed, costs: CGW_COSTS, now: new Date('2026-11-09T19:00:00Z'), requireDates: true, noHide: true });
  assert.equal(p.deadFeed, true);
  assert.equal(p.skip, 'stale-feed');
  const out = mkdtempSync(join(tmpdir(), 'refresh-dead-out-'));
  const s = writePlan(out, p);
  assert.deepEqual([s.deadFeed, s.feedRows, s.feedNewest], [true, 1, '2026-05-15 10:00:00']);
});

// Feed check of 11 Nov 2026 (lessons L113): the rows of Coes, Cronjager, Plusshop, Bazta and GRABO on the older sites carry
// ids the feed no longer uses ("30645:4606175510577", the page name "armaf-men-s-club-de-nuit-edt-105ml"...), so the
// refresh found 0 of them. The product page in their link is the same in the feed: it is the last way to match.
const HEAD2 = 'aw_deep_link,merchant_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,search_price,merchant_name,merchant_id,currency,in_stock,last_updated\n';
const row2 = o => [o.aw_link || '', o.link, `"${o.name}"`, o.aw, o.mid, o.img || 'https://x/i.jpg', o.price, o.merchant, o.adv, o.cur || 'GBP', o.inStock ?? '1', '2026-11-11 10:00:00'].join(',') + '\n';
const cread = page => `https://www.awin1.com/cread.php?awinmid=1&awinaffid=3057233&ued=${encodeURIComponent(page)}`;

test('linkKey: the shop page of a link or of an Awin tracking link, without www, query or last slash', () => {
  assert.equal(linkKey('https://www.coes.co.uk/products/fusion-walk-socks-for-men-in-charcoal?variant=31908117217329'), 'coes.co.uk/products/fusion-walk-socks-for-men-in-charcoal');
  assert.equal(linkKey(cread('https://www.coes.co.uk/products/fusion-walk-socks-for-men-in-charcoal')), 'coes.co.uk/products/fusion-walk-socks-for-men-in-charcoal');
  assert.equal(linkKey('https://order.grabo.com/product/1500mm-wired-cable-for-grabo-high-flow/'), linkKey(cread('https://order.grabo.com/product/1500mm-wired-cable-for-grabo-high-flow/')));
  assert.equal(linkKey('https://www.awin1.com/awclick.php?mid=6343&id=3057233&p=https%3A%2F%2Fuk.plusshop.com%2FArmaf-X'), 'uk.plusshop.com/armaf-x');
  assert.equal(linkKey('https://www.awin1.com/pclick.php?p=1'), '', 'a tracking link without a page inside gives nothing');
  assert.equal(linkKey(''), '');
  assert.equal(linkKey('not a link'), '');
});

test('Coes, Plusshop, GRABO and Cronjager: rows with old ids are found by their page; the site currency, stock and lowest price pick the feed row', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'refresh-links-'));
  writeFileSync(join(dir, 'AWIN_30645_116078.csv.gz'), gzipSync(HEAD2
    + row2({ link: 'https://www.coes.co.uk/products/fusion-walk-socks-for-men-in-charcoal?variant=31908117217329', name: '1000 Mile Fusion Walk Socks in Charcoal - L', aw: '45112394659', mid: '31908117217329', price: 18, merchant: 'Coes', adv: 30645 })
    + row2({ link: 'https://www.coes.co.uk/products/fusion-walk-socks-for-men-in-charcoal?variant=31908117217330', name: '1000 Mile Fusion Walk Socks in Charcoal - M', aw: '45112394660', mid: '31908117217330', price: 16, merchant: 'Coes', adv: 30645 })
    + row2({ link: 'https://www.coes.co.uk/products/fusion-walk-socks-for-men-in-charcoal?variant=31908117217331', name: '1000 Mile Fusion Walk Socks in Charcoal - S', aw: '45112394661', mid: '31908117217331', price: 12, merchant: 'Coes', adv: 30645, inStock: '0' })));
  writeFileSync(join(dir, 'AWIN_69306_111951.csv.gz'), gzipSync(HEAD2
    + row2({ link: 'https://uk.plusshop.com/armaf-men-s-club-de-nuit-edt-105ml', name: "Armaf Men's Club De Nuit EDT - 105ml", aw: '43224584865', mid: '52238', price: 29.99, merchant: 'Plusshop UK', adv: 69306 })));
  writeFileSync(join(dir, 'AWIN_129497_118332.csv.gz'), gzipSync(HEAD2
    + row2({ aw_link: cread('https://order.grabo.com/product/1500mm-wired-cable-for-grabo-high-flow/'), link: '', name: '1500mm Wired Cable', aw: '46235517292', mid: 'GHF-WR-1500', price: 24, merchant: 'GRABO', adv: 129497 })));
  writeFileSync(join(dir, 'AWIN_98661_115331.csv.gz'), gzipSync(HEAD2
    + row2({ link: 'https://cronjager.com/products/11cm-glazed-bonsai-pot-cascade-11cm-x-15cm-blue?variant=60255067898201&om=8616&currency=CAD', name: 'Bonsai Pot', aw: '46473435419', mid: '60255067898201', price: 19, cur: 'CAD', merchant: 'Cronjager', adv: 98661 })));
  writeFileSync(join(dir, 'AWIN_98661_115332.csv.gz'), gzipSync(HEAD2
    + row2({ link: 'https://cronjager.com/products/11cm-glazed-bonsai-pot-cascade-11cm-x-15cm-blue?variant=60255067898201&om=8616&currency=GBP', name: 'Bonsai Pot', aw: '46473435420', mid: '60255067898201', price: 10.5, cur: 'GBP', merchant: 'Cronjager', adv: 98661 })));
  const now = new Date('2026-11-11T18:00:00Z');

  const coes = await readFeed((await findFeeds(dir, 'Coes')).files);
  const c = planRefresh({ rows: [
    { id: 1, awin_product_id: '30645:4606175510577', merchant_product_id: '4606175510577', price: 18, currency: 'GBP', stock_status: 'in stock', image_url: 'https://x/i.jpg',
      affiliate_url: cread('https://www.coes.co.uk/products/fusion-walk-socks-for-men-in-charcoal'), is_active: 1 },
    { id: 2, awin_product_id: '30645:1', merchant_product_id: '1', price: 9, currency: 'GBP', stock_status: 'in stock', image_url: 'https://x/i.jpg',
      affiliate_url: cread('https://www.coes.co.uk/products/a-product-that-left'), is_active: 1 }
  ], feed: coes, costs: CGW_COSTS, now });
  assert.equal(c.matched, 1, 'the socks are found by their page');
  assert.deepEqual(c.changes.map(x => [x.id, x.set]), [[1, { price: 16 }]], 'the cheapest size in stock (12 is sold out)');
  assert.deepEqual(c.hides, [2], 'a page no longer in the feed is hidden as before');

  const plus = await readFeed((await findFeeds(dir, 'Plusshop UK')).files);
  const pl = { id: 3, awin_product_id: '69306:armaf-men-s-club-de-nuit-edt-105ml', merchant_product_id: 'armaf-men-s-club-de-nuit-edt-105ml', price: 31, currency: 'GBP', stock_status: 'in stock',
    image_url: 'https://x/i.jpg', affiliate_url: cread('https://uk.plusshop.com/armaf-men-s-club-de-nuit-edt-105ml'), is_active: 1 };
  assert.equal(matchRow(pl, plus).mid, '52238');

  const grabo = await readFeed((await findFeeds(dir, 'GRABO')).files);
  assert.equal(matchRow({ awin_product_id: '129497:1500mm-wired-cable-for-grabo-high-flow', merchant_product_id: '1500mm-wired-cable-for-grabo-high-flow',
    affiliate_url: cread('https://order.grabo.com/product/1500mm-wired-cable-for-grabo-high-flow/') }, grabo).mid, 'GHF-WR-1500', 'the page from the Awin link when the feed has no merchant_deep_link');

  const cron = await readFeed((await findFeeds(dir, 'Cronjager')).files, undefined, { currency: 'GBP' });
  const cr = planRefresh({ rows: [{ id: 4, awin_product_id: '98661:16685485687129', merchant_product_id: '16685485687129', price: 9.99, currency: 'GBP', stock_status: 'in stock',
    image_url: 'https://x/i.jpg', affiliate_url: cread('https://cronjager.com/products/11cm-glazed-bonsai-pot-cascade-11cm-x-15cm-blue'), is_active: 1 }], feed: cron, costs: CGW_COSTS, now });
  assert.deepEqual(cr.changes.map(x => x.set), [{ price: 10.5 }], 'the GBP feed row, not the CAD one');
  assert.equal(cr.currencySkip.length, 0);

  assert.equal(matchRow({ awin_product_id: 'x', merchant_product_id: 'y' }, coes), null, 'a row without a link still matches nothing');
});
