// tools/bol-remove.mjs (lessons L204): the SQL of the bol.com removal, run here on in-memory copies of the three kinds
// of database (an older site with CGW's side tables, a newer site with its search index, Price Watch). The tool itself
// (tools/bol-remove.ps1, fake wrangler) is tested in tests/run-tests.ps1 (section 26).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { targets, targetOf, countSql, deleteSql, tablesSql, parts, bolWhere, UNSAFE, SIDE_TABLES, PRODUCTS_PER_DELETE, REFRESH_WORKER, PRICES_DB, AWIN_DB, switchSql, switchReadSql, SWITCH_REASON, retailerWhere } from '../../tools/bol-remove.mjs';
import { networkShopId } from '../../tools/tgw-import-plan.mjs';
import { PRICE_SITES } from '../../sites/prices/sites.js';
import { BOL_SITES } from '../../sites/_shared/bol.js';

const read = f => readFileSync(f, 'utf8');
const LINK = 'https://partner.bol.com/click/click?p=2&t=url&s=1559450&f=TXL&url=https%3A%2F%2Fwww.bol.com%2Fnl%2Fnl%2Fp%2Fx%2F1%2F';
const list = await targets();
const tableNames = db => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(r => r.name);
const counts = (db, t) => ({ ...db.prepare(countSql(t, tableNames(db))).get() });

test('L204: the targets are the 13 site databases (not only the 10 that list bol.com) and Price Watch', () => {
  assert.equal(list.length, 14);
  assert.deepEqual(list.slice(0, 13).map(t => [t.code, t.db, t.legacy]), PRICE_SITES.map(s => [s.code, s.database, s.legacy]));
  assert.deepEqual(list.filter(t => t.listed).map(t => t.code).sort(), Object.keys(BOL_SITES).sort());
  for (const t of list.slice(0, 13)) assert.deepEqual(t.names, ['bol.com'], `${t.code}: no other name shown as bol.com today`);
  const p = targetOf(list, 'prices');
  assert.equal(p.db, PRICES_DB);
  assert.deepEqual(p.legacySites, ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw']);
  assert.equal(REFRESH_WORKER, 'gear-world-bol-refresh');
  assert.equal(tablesSql(), "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
});

test('L204: a name the older site shows as bol.com (database.retailerNames) is removed too', async () => {
  const fake = { code: 'cgw', kind: 'site', names: ['bol.com', 'bol.com NL'] };
  assert.equal(bolWhere(fake.names), "(lower(COALESCE(retailer, '')) IN ('bol.com', 'bol.com nl') OR lower(substr(COALESCE(affiliate_url, ''), 1, 24)) = 'https://partner.bol.com/' OR lower(substr(COALESCE(affiliate_url, ''), 1, 20)) = 'https://www.bol.com/')");
});

test('L204: every count is ONE SELECT on one line that cmd.exe passes as it is (no & | < > ^ %)', () => {
  const all = ['products', 'products_fts', 'affiliate_clicks', 'product_groups', ...SIDE_TABLES.map(s => s.table), 'price_last', 'price_log', 'price_runs'];
  for (const t of list) {
    const sql = countSql(t, all);
    assert.match(sql, /^SELECT \(/, t.code);
    assert.ok(!UNSAFE.test(sql) && !sql.includes(';') && !sql.includes('"'), t.code);
    assert.ok(!/\b(DELETE|UPDATE|INSERT|DROP)\b/.test(sql), t.code);
    assert.ok(sql.length < 4000, `${t.code}: ${sql.length} characters (cmd.exe takes 8,191)`);
    assert.ok(!/affiliate_clicks|reward_clicks|awin_/.test(sql), `${t.code}: the click and sales logs stay`);
  }
  assert.equal(countSql(targetOf(list, 'agw'), ['affiliate_clicks']), 'SELECT 0 AS none', 'a database without products');
});

function olderDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(read('tests/fixtures/ggw-legacy-schema.sql'));
  db.exec(`CREATE TABLE product_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, identity_type TEXT, identity_key TEXT UNIQUE, canonical_name TEXT, canonical_slug TEXT);
    CREATE TABLE product_group_offers (group_id INTEGER NOT NULL, product_id INTEGER NOT NULL UNIQUE, PRIMARY KEY (group_id, product_id));
    CREATE TABLE product_finalize_update_queue (live_id INTEGER PRIMARY KEY);
    CREATE TABLE product_finalize_insert_queue (seq INTEGER PRIMARY KEY AUTOINCREMENT, retailer TEXT NOT NULL, merchant_product_id TEXT NOT NULL);
    CREATE TABLE product_refresh_baseline (retailer TEXT PRIMARY KEY, active_count INTEGER NOT NULL);
    CREATE TABLE product_refresh_stage (retailer TEXT NOT NULL, merchant_product_id TEXT NOT NULL, awin_product_id TEXT, affiliate_url TEXT NOT NULL);
  `);
  const ins = db.prepare(`INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, product_name, price, affiliate_url, is_active)
    VALUES (?, ?, ?, 'Power Tools', ?, 10, ?, ?)`);
  ins.run('a1', 'T1', 'Tooled Up', 'Drill', 'https://www.awin1.com/cread.php?awinmid=496', 1);
  for (let i = 1; i <= 1203; i++) ins.run(`bol${i}`, `87${i}`, 'bol.com', `Boor ${i}`, LINK, i % 7 ? 1 : 0);
  ins.run('x1', 'X1', 'bol.com NL', 'Zaag', LINK, 1); // another spelling, the partner link
  // Re-review of 51a8b88: the name in capitals (found by the index), in an odd mix (found by the separate statement), and a
  // bol.com product page link under another name.
  ins.run('c1', 'C1', 'Bol.com', 'Hamer', 'https://www.awin1.com/cread.php?awinmid=1', 1);
  ins.run('c2', 'C2', 'BOL.COM', 'Tang', 'https://www.awin1.com/cread.php?awinmid=1', 0);
  ins.run('c3', 'C3', 'BoL.cOm', 'Beitel', 'https://www.awin1.com/cread.php?awinmid=1', 1);
  ins.run('w1', 'W1', 'Some Shop', 'Waterpas', 'https://www.bol.com/nl/nl/p/waterpas/9200000000002/', 1);
  ins.run('w2', 'W2', 'Another Shop', 'Rolmaat', 'https://www.bol.com.evil.example/p/1', 1);
  ins.run('e1', 'E1', 'Evil', 'Look-alike', 'https://partner.bol.com.evil.example/x', 1);
  const id = n => db.prepare('SELECT id FROM products WHERE merchant_product_id = ?').get(n).id;
  db.exec("INSERT INTO product_groups (identity_type, identity_key, canonical_name, canonical_slug) VALUES ('ean', '1', 'Drill', 'drill'), ('ean', '2', 'Boor', 'boor')");
  db.prepare('INSERT INTO product_group_offers (group_id, product_id) VALUES (1, ?), (1, ?), (2, ?), (2, ?)').run(id('T1'), id('871'), id('872'), id('873'));
  db.prepare('INSERT INTO product_finalize_update_queue (live_id) VALUES (?), (?)').run(id('T1'), id('874'));
  db.exec("INSERT INTO product_finalize_insert_queue (retailer, merchant_product_id) VALUES ('bol.com', '9'), ('Tooled Up', '8')");
  db.exec("INSERT INTO product_refresh_baseline (retailer, active_count) VALUES ('bol.com', 1203), ('Tooled Up', 1)");
  db.prepare("INSERT INTO product_refresh_stage (retailer, merchant_product_id, awin_product_id, affiliate_url) VALUES ('bol.com', '1', 'b', ?), ('Tooled Up', '2', 'c', 'https://www.awin1.com/x')").run(LINK);
  db.prepare("INSERT INTO affiliate_clicks (product_id, retailer) VALUES (?, 'bol.com')").run(id('871'));
  return db;
}

test('L204: an older database (CGW side tables): counts, then the delete leaves 0 bol.com rows and every other row', () => {
  const db = olderDb();
  const t = targetOf(list, 'cgw');
  const c = counts(db, t);
  assert.deepEqual(c, { product_groups: 1, product_group_offers: 3, product_finalize_update_queue: 1, product_finalize_insert_queue: 1, product_refresh_baseline: 1,
    product_refresh_stage: 1, products: 1205, products_link: 3, active: 1204 - Math.floor(1203 / 7) + 3 });
  const sql = deleteSql(t, tableNames(db), { rows: c.products });
  assert.equal((sql.match(/^DELETE FROM products WHERE id IN \(SELECT id FROM products WHERE retailer IN \('bol\.com', 'BOL\.COM', 'Bol\.com', 'Bol\.Com'\) LIMIT 500\);$/gm) || []).length, Math.ceil(1205 / PRODUCTS_PER_DELETE) + 1,
    'in parts of 500 found by the names (an index), one more to be sure');
  // Review of 6954a135: the partner link under another name is ONE statement of its own, never an OR in every part.
  const linkLines = sql.split('\n').filter(l => l.startsWith('DELETE FROM products WHERE (lower(substr('));
  assert.equal(linkLines.length, 1, 'one statement for the links and the other capitals');
  assert.match(linkLines[0], /= 'https:\/\/partner\.bol\.com\/' OR .*= 'https:\/\/www\.bol\.com\/' OR lower\(COALESCE\(retailer, ''\)\) IN \('bol\.com'\)\) AND COALESCE\(retailer, ''\) NOT IN \('bol\.com', 'BOL\.COM', 'Bol\.com', 'Bol\.Com'\);$/);
  assert.ok(!/OR (lower\()?substr\(/.test(sql.split('\n').filter(l => l.startsWith('DELETE FROM products WHERE id IN')).join('\n')), 'no OR with substr() in the parts of 500');
  assert.ok(!/OR substr\(/.test(countSql(t, tableNames(db)).split('AS products,')[0].split('AS product_refresh_stage,').pop()), 'the products count reads the index of the names');
  // The side tables before the products (they find the products by id).
  assert.ok(sql.indexOf('DELETE FROM product_group_offers') < sql.indexOf('DELETE FROM products '));
  assert.ok(sql.indexOf('DELETE FROM product_groups') < sql.indexOf('DELETE FROM product_group_offers'));
  db.exec(sql);
  const after = counts(db, t);
  for (const [k, v] of Object.entries(after)) assert.equal(v, 0, k);
  assert.deepEqual(db.prepare('SELECT retailer FROM products ORDER BY id').all().map(r => r.retailer), ['Tooled Up', 'Another Shop', 'Evil'], 'a look-alike host stays');
  assert.deepEqual(db.prepare('SELECT id FROM product_groups').all().map(r => r.id), [1], 'the group with a Tooled Up offer stays');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM product_group_offers').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM product_finalize_update_queue').get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM product_refresh_baseline WHERE retailer = 'Tooled Up'").get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM affiliate_clicks').get().n, 1, 'the click log stays');
  // Again: nothing more to delete, no error.
  db.exec(deleteSql(t, tableNames(db), { rows: 0 }));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM products').get().n, 3);
});

test('L204: a newer database with its search index: the delete keeps the index right', () => {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync('sites/agw/migrations').sort()) db.exec(read(`sites/agw/migrations/${f}`));
  const ins = db.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, product_name, product_slug, price, image_url, affiliate_url)
    VALUES (?, ?, ?, ?, 'interior-comfort', ?, ?, 9, 'https://i/x.jpg', ?)`);
  const shop = networkShopId('bol', 43646, 'NL');
  ins.run('496:A', 496, 'A', 'Tooled Up', 'Car mat set', 'car-mat-set', 'https://www.awin1.com/x');
  for (let i = 1; i <= 30; i++) ins.run(`${shop}:${i}`, shop, String(i), 'bol.com', `Automatten set ${i}`, `automatten-set-${i}`, LINK);
  const t = targetOf(list, 'agw');
  assert.deepEqual(counts(db, t), { products: 30, products_link: 0, active: 30 });
  // The newer layout's index is (is_active, retailer): the names part says is_active IN (0, 1), so SQLite uses it.
  const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT id FROM products WHERE ${retailerWhere(t)}`).all().map(r => r.detail).join(' ');
  assert.match(plan, /USING (COVERING )?INDEX idx_products_retailer/, plan);
  db.exec(deleteSql(t, tableNames(db), { rows: 30 }));
  assert.deepEqual(counts(db, t), { products: 0, products_link: 0, active: 0 });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products_fts WHERE products_fts MATCH 'automatten'").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products_fts WHERE products_fts MATCH 'car'").get().n, 1);
});

test('L204: Price Watch: the bol.com keys of the older and the newer sites go, every other key stays', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(read('sites/prices/migrations/0001_prices.sql'));
  const last = db.prepare("INSERT INTO price_last (site, pkey, price, was_price, in_stock, listed, day) VALUES (?, ?, 5, NULL, 1, 1, '2026-11-20')");
  const log = db.prepare('INSERT INTO price_log (site, pkey, day, price, was_price, in_stock, listed) VALUES (?, ?, ?, 5, NULL, 1, 1)');
  const bolNew = `${networkShopId('bol', 43646, 'NL')}:9200000000001`;
  const keep = [['hgw', 'Joybuy UK:J1'], ['agw', '496:A'], ['agw', `${networkShopId('daisycon', 20164, 'GB')}:R-1`], ['tgw', `${networkShopId('cj', 7983236)}:S`], ['hgw', `${networkShopId('bol', 1, 'NL')}:X`]];
  const gone = [['hgw', 'bol.com:8710103000001'], ['cgw', 'BOL.COM:2'], ['agw', bolNew], ['zgw', `${networkShopId('bol', 12748, 'BE')}:7`]];
  for (const [s, k] of [...keep, ...gone]) {
    last.run(s, k);
    for (const d of ['2026-11-18', '2026-11-19', '2026-11-20']) log.run(s, k, d);
  }
  const t = targetOf(list, 'prices');
  const c = counts(db, t);
  assert.deepEqual(c, { price_log: 12, price_last: 4 });
  db.exec(deleteSql(t, tableNames(db), { rows: c.price_last, rowsLog: c.price_log }));
  assert.deepEqual(counts(db, t), { price_log: 0, price_last: 0 });
  assert.deepEqual(db.prepare('SELECT site, pkey FROM price_last ORDER BY site, pkey').all().map(r => [r.site, r.pkey]),
    keep.slice().sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1)), 'a new-layout key on an older site is not a bol.com key there');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM price_log').get().n, keep.length * 3);
  assert.deepEqual(parts(t, ['price_runs']), [], 'price_runs keeps its daily totals');
});

test('L204: the tool: read-only by default, one phrase, restore points before any change, the Worker, the report', () => {
  const raw = readFileSync('tools/bol-remove.ps1');
  assert.ok(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf, 'UTF-8 with BOM');
  const src = raw.toString('utf8');
  assert.ok(src.includes('\r\n') && !/[^\r]\n/.test(src), 'CRLF');
  assert.match(src, /\[string\]\$Step = 'check'/);
  assert.match(src, /\$Phrase = 'ΕΓΚΡΙΝΩ ΑΦΑΙΡΕΣΗ BOL'/);
  assert.match(src, /BOL_REMOVE_\{0\}_\{1\}\.txt/);
  assert.match(src, /gear-world-reports/);
  assert.match(src, /Set-Clipboard/);
  const iConfirm = src.indexOf('if (-not (Confirm-Approval $Phrase))');
  const iTT = src.indexOf("d1 time-travel info {0}");
  const iSwitch = src.indexOf("'--mode', 'switch-sql'");
  const iWorker = src.indexOf("('delete {0}' -f $WorkerName)");
  const iDelete = src.indexOf("'--mode', 'delete-sql'");
  assert.ok(iConfirm > 0 && iConfirm < iTT && iTT < iSwitch && iSwitch < iWorker && iWorker < iDelete,
    'approval, then every restore point (gear-world-awin too), then the kill switch, then the Worker, then the deletes');
  assert.match(src, /\$AwinDb = 'gear-world-awin'/);
  assert.match(src, /Finish 11/, 'no restore point: nothing changes');
  assert.ok(!/\?\?|\s\?\s.*\s:\s|&&|\|\||-AsHashtable|-Parallel/.test(src.replace(/'[^'\r\n]*'/g, "''")), 'Windows PowerShell 5.1 syntax only');
});

test('L204 + L205: the kill switch of the daily refresh: made if missing, set to 0, and the own migration of the refresh keeps the 0', () => {
  assert.equal(AWIN_DB, 'gear-world-awin');
  const at = new Date('2026-11-25T08:30:00Z');
  const sql = switchSql(at);
  assert.ok(!sql.includes('bol_refresh_hidden'), 'bol_refresh_hidden is left as it is');
  // A database where the refresh was never set up.
  const empty = new DatabaseSync(':memory:');
  empty.exec(sql);
  assert.deepEqual({ ...empty.prepare(switchReadSql()).get() }, { value: '0', updated_at: '2026-11-25 08:30:00' });
  // The refresh set up and on ('1'): the switch goes to 0; its migration run again later keeps the 0.
  const migration = read('sites/bol-refresh/migrations/0001_bol_refresh.sql');
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
  assert.equal(db.prepare(switchReadSql()).get().value, '1');
  db.prepare("INSERT INTO bol_refresh_hidden (site, product_id, ean, reason, hidden_at) VALUES ('hgw', 7, '8710103000001', 'no offer', '2026-11-24 04:13:00')").run();
  db.exec(sql);
  db.exec(sql);
  assert.equal(db.prepare(switchReadSql()).get().value, '0');
  db.exec(migration);
  assert.equal(db.prepare(switchReadSql()).get().value, '0', 'IF NOT EXISTS / DO NOTHING keeps the 0');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bol_refresh_hidden').get().n, 1);
  // The refresh Worker reads the same row (src/bol-refresh.js).
  assert.match(read('src/bol-refresh.js'), /SELECT value FROM bol_refresh_meta WHERE key = \?/);
  // Who turned it off (Manager, 20 Nov 2026): the removal tool's own reason, never one that starts with "worker" (the
  // Worker's own stop after a 401/403, which makes every later run an error), and it replaces such an old one.
  const reason = d => d.prepare("SELECT value FROM bol_refresh_meta WHERE key = 'disabled_reason'").get().value;
  assert.equal(SWITCH_REASON, 'removal tool');
  assert.equal(reason(empty), 'removal tool 2026-11-25 08:30');
  const stopped = new DatabaseSync(':memory:');
  stopped.exec(migration);
  stopped.exec("INSERT INTO bol_refresh_meta (key, value, updated_at) VALUES ('enabled', '0', '2026-11-24 04:13:00'), ('disabled_reason', 'worker 2026-11-24T04:13:00.000Z: bol.com answered 401 (token); turn on with -Step enable', '2026-11-24 04:13:00') ON CONFLICT (key) DO UPDATE SET value = excluded.value");
  stopped.exec(sql);
  assert.equal(stopped.prepare(switchReadSql()).get().value, '0');
  assert.equal(reason(stopped), 'removal tool 2026-11-25 08:30');
  const workerRule = read('src/bol-refresh.js').match(/if \(!enabled && (\/\^worker\\b\/i)\.test\(offReason\)\) errors\.push/);
  assert.ok(workerRule, 'the Worker counts a run as an error only for a reason that starts with "worker"');
  assert.ok(!/^worker\b/i.test(reason(stopped)) && !/^worker\b/i.test(reason(db)), 'so its later runs are pauses');
  // The setup tool's check says the same: ΠΡΟΒΛΗΜΑ only for 'worker ...', the removal tool and the owner's pause are a pause.
  const setup = read('tools/bol-refresh-setup.ps1');
  const iW = setup.indexOf("if ($why -match '^worker\\b') { Say ('    🔴 ΠΡΟΒΛΗΜΑ: τον έκλεισε ο ίδιος ο Worker");
  const iR = setup.indexOf("elseif ($why -match '^removal tool\\b') { Say ('    ⏸ ΚΛΕΙΣΤΟ από το εργαλείο αφαίρεσης");
  const iO = setup.indexOf("else { Say '    ⏸ Σε παύση: τον έκλεισες με -Step disable.");
  assert.ok(iW > 0 && iW < iR && iR < iO, 'Show-Switch: worker -> ΠΡΟΒΛΗΜΑ, removal tool -> closed by the removal tool, else a pause');
  assert.ok(!/if \(\$meta\.disabled_reason\) \{/.test(setup), 'no other place shows any reason as the Worker\'s ΠΡΟΒΛΗΜΑ');
  assert.ok(SWITCH_REASON.length === 12, "the setup tool cuts 'removal tool' (12 letters) off the time it shows");
});
