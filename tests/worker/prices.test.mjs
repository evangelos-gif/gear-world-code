// Lessons L100: the daily price log of the 13 sites (private Worker gear-world-prices, its own D1 gear-world-prices).
// On 7 Nov 2026 no site kept any price history: a new price wrote over the old one. The price alerts (17-18 Nov) need
// to know when a price fell. The Worker must only READ the sites' databases (D1 has no read-only binding).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { PRICE_SITES } from '../../sites/prices/sites.js';
import { readOnly, money, diffPrices, chunkJson, siteSql, runOnce, DEFAULTS } from '../../sites/prices/price-log.js';
import worker from '../../sites/prices/worker.js';
import { GEAR_WORLDS } from '../../promos/network.js';
import { IN_STOCK_WORDS } from '../../src/db.js';
import { readTemplate, buildConfig, databaseNames } from '../../tools/prices-config.mjs';
import { parseJsonc } from '../../tools/poster-config.mjs';

const MIGRATION = readFileSync('sites/prices/migrations/0001_prices.sql', 'utf8');
const LEGACY_SCHEMA = readFileSync('tests/fixtures/ggw-legacy-schema.sql', 'utf8');
const NEW_SCHEMA = readFileSync('sites/tgw/migrations/0001_init.sql', 'utf8');

// A D1 binding over node:sqlite: prepare/bind/all/first/run and batch() as one transaction (as D1 does).
function fakeD1(sql, seen) {
  const stmt = (text, args = []) => ({
    text,
    args,
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return {
    sql,
    prepare(text) { if (seen) seen.push(String(text)); return stmt(String(text)); },
    async batch(list) {
      if (seen) seen.push('BATCH');
      sql.exec('BEGIN');
      try {
        const out = list.map(s => ({ meta: { changes: Number(sql.prepare(s.text).run(...s.args).changes) } }));
        sql.exec('COMMIT');
        return out;
      } catch (e) { sql.exec('ROLLBACK'); throw e; }
    },
    async exec(text) { if (seen) seen.push(String(text)); sql.exec(text); }
  };
}

function legacyRow(sql, r) {
  sql.prepare(`INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, product_name, price, stock_status, affiliate_url, is_active)
    VALUES (?, ?, ?, 'Tools', ?, ?, ?, 'https://example.com/a', ?)`).run(r.awin, r.mpid, r.retailer, r.name, r.price, r.stock, r.active);
}
function newRow(sql, r) {
  sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, product_name, product_slug,
    price, was_price, in_stock, image_url, affiliate_url, is_active) VALUES (?, 1, ?, ?, 'misc', ?, ?, ?, ?, ?, 'https://example.com/i.jpg', 'https://example.com/a', ?)`)
    .run(r.key, r.mpid, r.retailer, r.name, r.name.toLowerCase().replace(/\W+/g, '-'), r.price, r.was, r.stock, r.active);
}

// The 13 site databases with a few products each (one hidden), and the price database.
function makeEnv() {
  const seen = [];
  const env = { DAILY_WRITE_CAP: '' };
  const sites = {};
  for (const s of PRICE_SITES) {
    const sql = new DatabaseSync(':memory:');
    sql.exec(s.legacy ? LEGACY_SCHEMA : NEW_SCHEMA);
    if (s.legacy) {
      legacyRow(sql, { awin: `${s.code}-1`, mpid: 'A1', retailer: 'Shop One', name: 'Drill', price: 19.99, stock: 'in stock', active: 1 });
      legacyRow(sql, { awin: `${s.code}-2`, mpid: 'B2', retailer: 'Shop Two', name: 'Saw', price: 5, stock: 'out of stock', active: 1 });
      legacyRow(sql, { awin: `${s.code}-3`, mpid: '', retailer: 'Shop Two', name: 'Hammer', price: 7.5, stock: 'Available to order', active: 1 });
      legacyRow(sql, { awin: `${s.code}-4`, mpid: 'D4', retailer: 'Shop One', name: 'Old', price: 3, stock: 'in stock', active: 0 });
    } else {
      newRow(sql, { key: '11:A1', mpid: 'A1', retailer: 'Shop One', name: 'Mouse', price: 19.99, was: 24.99, stock: 1, active: 1 });
      newRow(sql, { key: '11:B2', mpid: 'B2', retailer: 'Shop One', name: 'Keyboard', price: 49, was: null, stock: 0, active: 1 });
      newRow(sql, { key: '12:C3', mpid: 'C3', retailer: 'Shop Two', name: 'Cable', price: 2.5, was: null, stock: 1, active: 1 });
      newRow(sql, { key: '12:D4', mpid: 'D4', retailer: 'Shop Two', name: 'Old', price: 3, was: null, stock: 1, active: 0 });
    }
    const log = [];
    seen.push({ code: s.code, log });
    env[s.binding] = fakeD1(sql, log);
    sites[s.code] = sql;
  }
  const prices = new DatabaseSync(':memory:');
  prices.exec(MIGRATION);
  env.PRICES_DB = fakeD1(prices);
  return { env, sites, prices, seen };
}

const dump = sql => JSON.stringify(sql.prepare("SELECT name, sql FROM sqlite_master ORDER BY name").all()) +
  JSON.stringify(sql.prepare('SELECT * FROM products ORDER BY id').all());
const rows = (sql, q, ...a) => sql.prepare(q).all(...a).map(r => ({ ...r }));
const one = (sql, q, ...a) => ({ ...sql.prepare(q).get(...a) });
const at = (day, minutes) => new Date(Date.parse(`${day}T00:00:00Z`) + minutes * 60000).getTime();

async function runDay(env, day, times = PRICE_SITES.length, options = {}) {
  const out = [];
  for (let i = 0; i < times; i++) out.push(await runOnce(env, { ...options, now: at(day, 15 * i) }));
  return out;
}

test('migration: the three tables, keyed by site and product (and day), without rowid', () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(MIGRATION);
  sql.exec(MIGRATION); // safe to run twice
  const t = rows(sql, "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name");
  assert.deepEqual(t.map(x => x.name), ['price_last', 'price_log', 'price_runs']);
  for (const x of t) assert.match(x.sql, /WITHOUT ROWID/);
  assert.match(t.find(x => x.name === 'price_log').sql, /PRIMARY KEY \(site, pkey, day\)/);
  assert.match(t.find(x => x.name === 'price_last').sql, /PRIMARY KEY \(site, pkey\)/);
  assert.match(t.find(x => x.name === 'price_runs').sql, /PRIMARY KEY \(day, site\)/);
  assert.equal(rows(sql, "SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL").length, 0, 'no extra index: every row written once');
});

test('readOnly lets only one SELECT through, and has no batch, exec or dump', () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE products (id INTEGER PRIMARY KEY)');
  const db = readOnly(fakeD1(sql), 'DB_TEST');
  assert.equal(typeof db.prepare('SELECT id FROM products').all, 'function');
  assert.equal(typeof db.prepare('  select id from products').all, 'function');
  for (const bad of ['DELETE FROM products', 'UPDATE products SET id = 2', 'INSERT INTO products VALUES (1)', 'DROP TABLE products',
    'PRAGMA writable_schema = 1', 'WITH x AS (SELECT 1) DELETE FROM products', 'SELECT 1; DELETE FROM products', 'REPLACE INTO products VALUES (1)',
    'ALTER TABLE products ADD x', 'CREATE TABLE y (a)', 'VACUUM', 'ATTACH DATABASE x AS y', 'SELECTX', '']) {
    assert.throws(() => db.prepare(bad), /read-only/, bad);
  }
  assert.equal(db.batch, undefined);
  assert.equal(db.exec, undefined);
  assert.equal(db.dump, undefined);
  assert.ok(Object.isFrozen(db));
  assert.throws(() => readOnly(undefined, 'DB_X'), /DB_X is missing/);
});

test('the site queries are SELECTs; the older layout reads stock as the site does', () => {
  for (const s of PRICE_SITES) assert.match(siteSql(s), /^SELECT /);
  const legacy = siteSql({ legacy: true });
  for (const w of IN_STOCK_WORDS) assert.ok(legacy.includes(`'${w}'`), w);
  assert.match(legacy, /\+is_active = 1 AND id > \? ORDER BY id LIMIT \?/);
  assert.match(siteSql({ legacy: false }), /stable_key AS k/);
});

test('money: 2 decimals, and nothing that is not a number', () => {
  assert.equal(money(19.989999), 19.99);
  assert.equal(money(0.1 + 0.2), 0.3);
  assert.equal(money('12.5'), 12.5);
  assert.equal(money(null), null);
  assert.equal(money(''), null);
  assert.equal(money('abc'), null);
  assert.equal(money(Infinity), null);
});

test('diffPrices: new, changed, back, gone; unchanged products give no row', () => {
  const now = new Map([
    ['a', { price: 10, was: null, stock: 1 }],  // same
    ['b', { price: 9, was: null, stock: 1 }],   // cheaper
    ['c', { price: 5, was: 6, stock: 1 }],      // was price changed
    ['d', { price: 4, was: null, stock: 0 }],   // out of stock
    ['e', { price: 3, was: null, stock: 1 }],   // new
    ['g', { price: 8, was: null, stock: 1 }]    // back on the site
  ]);
  const last = new Map([
    ['a', { price: 10, was: null, stock: 1, listed: 1 }],
    ['b', { price: 10, was: null, stock: 1, listed: 1 }],
    ['c', { price: 5, was: 7, stock: 1, listed: 1 }],
    ['d', { price: 4, was: null, stock: 1, listed: 1 }],
    ['f', { price: 2, was: null, stock: 1, listed: 1 }],  // gone
    ['g', { price: 8, was: null, stock: 1, listed: 0 }],
    ['h', { price: 1, was: null, stock: 1, listed: 0 }]   // gone before: nothing new
  ]);
  const d = diffPrices(now, last);
  assert.deepEqual(d.changes, [['b', 9, null, 1, 1], ['c', 5, 6, 1, 1], ['d', 4, null, 0, 1], ['e', 3, null, 1, 1], ['f', 2, null, 1, 0], ['g', 8, null, 1, 1]]);
  assert.deepEqual([d.changed, d.added, d.gone], [4, 1, 1]);
});

test('chunkJson: at most N rows and N bytes per chunk, nothing lost', () => {
  const list = Array.from({ length: 25 }, (_, i) => [`key-${i}-é`, i + 0.5, null, 1, 1]);
  const byRows = chunkJson(list, 10, 1e6);
  assert.deepEqual(byRows.map(c => c.rows), [10, 10, 5]);
  const byBytes = chunkJson(list, 1000, 120);
  assert.ok(byBytes.every(c => new TextEncoder().encode(c.json).length <= 120));
  assert.deepEqual(byBytes.flatMap(c => JSON.parse(c.json)), list);
  assert.deepEqual(chunkJson([], 10, 100), []);
});

test('first day: one site per run, in the Hub order; every shown product logged once; then idle', async () => {
  const { env, prices } = makeEnv();
  const out = await runDay(env, '2026-11-09', PRICE_SITES.length + 2);
  assert.deepEqual(out.slice(0, 13).map(r => r.site), PRICE_SITES.map(s => s.code));
  assert.ok(out.slice(0, 13).every(r => r.status === 'ok' && r.products === 3 && r.added === 3 && r.writes === 6), JSON.stringify(out[0]));
  assert.deepEqual(out.slice(13).map(r => r.status), ['idle', 'idle']);
  assert.equal(one(prices, 'SELECT COUNT(*) AS n FROM price_log').n, 39);
  assert.equal(one(prices, 'SELECT COUNT(*) AS n FROM price_last').n, 39);
  const runs = rows(prices, 'SELECT site, status, products, added, writes, attempts FROM price_runs ORDER BY site');
  assert.equal(runs.length, 13);
  assert.ok(runs.every(r => r.status === 'ok' && r.attempts === 1 && r.writes === 6));
  // the older layout: key = shop + its own code (or the Awin id when there is none), stock as the site reads it
  assert.deepEqual(rows(prices, "SELECT pkey, price, was_price, in_stock, listed FROM price_log WHERE site = 'cgw' ORDER BY pkey"), [
    { pkey: 'Shop One:A1', price: 19.99, was_price: null, in_stock: 1, listed: 1 },
    { pkey: 'Shop Two:B2', price: 5, was_price: null, in_stock: 0, listed: 1 },
    { pkey: 'Shop Two:awin-cgw-3', price: 7.5, was_price: null, in_stock: 1, listed: 1 }
  ]);
  assert.deepEqual(rows(prices, "SELECT pkey, price, was_price, in_stock FROM price_log WHERE site = 'tgw' ORDER BY pkey"), [
    { pkey: '11:A1', price: 19.99, was_price: 24.99, in_stock: 1 },
    { pkey: '11:B2', price: 49, was_price: null, in_stock: 0 },
    { pkey: '12:C3', price: 2.5, was_price: null, in_stock: 1 }
  ]);
  assert.equal(one(prices, "SELECT COUNT(*) AS n FROM price_log WHERE pkey LIKE '%D4'").n, 0, 'a hidden product is not logged');
  assert.equal(one(prices, "SELECT COUNT(DISTINCT day) AS n FROM price_log").n, 1);
});

test('the site databases are only read: every query a SELECT, nothing written, the data the same byte for byte', async () => {
  const { env, sites, seen } = makeEnv();
  const before = Object.fromEntries(Object.entries(sites).map(([c, s]) => [c, dump(s)]));
  await runDay(env, '2026-11-09', 15);
  newRow(sites.tgw, { key: '13:E5', mpid: 'E5', retailer: 'Shop Three', name: 'Hub', price: 30, was: null, stock: 1, active: 1 });
  const tgwBefore = dump(sites.tgw);
  await runDay(env, '2026-11-10', 15);
  for (const { code, log } of seen) {
    assert.ok(log.length > 0, `${code} was read`);
    for (const q of log) assert.match(q, /^\s*SELECT\s/, `${code}: ${q.slice(0, 40)}`);
    assert.ok(!log.includes('BATCH'), `${code}: no batch`);
  }
  for (const [c, s] of Object.entries(sites)) assert.equal(dump(s), c === 'tgw' ? tgwBefore : before[c], `${c} unchanged`);
});

test('next day: a row only for what changed; gone products keep their last price with listed = 0', async () => {
  const { env, sites, prices } = makeEnv();
  await runDay(env, '2026-11-09');
  sites.tgw.exec("UPDATE products SET price = 17.49 WHERE stable_key = '11:A1'");          // cheaper
  sites.tgw.exec("UPDATE products SET was_price = 3 WHERE stable_key = '12:C3'");          // shop's was price
  sites.tgw.exec("UPDATE products SET is_active = 0 WHERE stable_key = '11:B2'");          // gone
  sites.tgw.exec("UPDATE products SET is_active = 1, price = 2.75 WHERE stable_key = '12:D4'"); // first seen
  sites.tgw.exec("UPDATE products SET updated_at = datetime('now')");                     // not a change
  sites.cgw.exec("UPDATE products SET stock_status = 'out of stock' WHERE merchant_product_id = 'A1'");
  sites.cgw.exec("UPDATE products SET price = 7.499 WHERE product_name = 'Hammer'");       // 7.50 as shown: no change
  const out = await runDay(env, '2026-11-10');
  const tgw = out.find(r => r.site === 'tgw');
  assert.deepEqual([tgw.changed, tgw.added, tgw.gone, tgw.products, tgw.writes], [2, 1, 1, 3, 8]);
  assert.deepEqual(rows(prices, "SELECT pkey, price, was_price, in_stock, listed FROM price_log WHERE site = 'tgw' AND day = '2026-11-10' ORDER BY pkey"), [
    { pkey: '11:A1', price: 17.49, was_price: 24.99, in_stock: 1, listed: 1 },
    { pkey: '11:B2', price: 49, was_price: null, in_stock: 0, listed: 0 },
    { pkey: '12:C3', price: 2.5, was_price: 3, in_stock: 1, listed: 1 },
    { pkey: '12:D4', price: 2.75, was_price: null, in_stock: 1, listed: 1 }
  ]);
  assert.deepEqual(rows(prices, "SELECT pkey, in_stock FROM price_log WHERE site = 'cgw' AND day = '2026-11-10'"), [{ pkey: 'Shop One:A1', in_stock: 0 }]);
  assert.equal(one(prices, "SELECT COUNT(*) AS n FROM price_log WHERE day = '2026-11-10'").n, 5, 'the other 11 sites: no row');
  assert.deepEqual(one(prices, "SELECT price, listed, day FROM price_last WHERE site = 'tgw' AND pkey = '11:B2'"), { price: 49, listed: 0, day: '2026-11-10' });
  assert.deepEqual(rows(prices, "SELECT day, price FROM price_log WHERE site = 'tgw' AND pkey = '11:A1' ORDER BY day"),
    [{ day: '2026-11-09', price: 19.99 }, { day: '2026-11-10', price: 17.49 }], 'the history of one product');
  // a third day with no change writes nothing at all
  const before = one(prices, 'SELECT COUNT(*) AS n FROM price_log').n;
  const third = await runDay(env, '2026-11-11');
  assert.ok(third.every(r => r.status === 'ok' && r.writes === 0));
  assert.equal(one(prices, 'SELECT COUNT(*) AS n FROM price_log').n, before);
});

test('the same day twice gives the same rows, never two', async () => {
  const { env, sites, prices } = makeEnv();
  await runDay(env, '2026-11-09');
  sites.agw.exec("UPDATE products SET price = 45 WHERE stable_key = '11:B2'");
  await runDay(env, '2026-11-10');
  const log = rows(prices, 'SELECT * FROM price_log ORDER BY site, pkey, day');
  const last = rows(prices, 'SELECT * FROM price_last ORDER BY site, pkey');
  // as if the AGW run had been cut off after writing: it is taken again later the same day
  prices.exec("UPDATE price_runs SET status = 'error', attempts = 1 WHERE day = '2026-11-10' AND site = 'agw'");
  prices.exec("UPDATE price_last SET price = 49, day = '2026-11-09' WHERE site = 'agw' AND pkey = '11:B2'");
  const again = await runOnce(env, { now: at('2026-11-10', 300) });
  assert.equal(again.site, 'agw');
  assert.equal(again.status, 'ok');
  assert.deepEqual(rows(prices, 'SELECT * FROM price_log ORDER BY site, pkey, day'), log);
  assert.deepEqual(rows(prices, 'SELECT * FROM price_last ORDER BY site, pkey'), last);
  assert.equal(one(prices, "SELECT attempts FROM price_runs WHERE day = '2026-11-10' AND site = 'agw'").attempts, 2);
});

test('a failing site is tried again, at most 3 times a day, after the others; its error is kept', async () => {
  const { env, prices } = makeEnv();
  const good = env.DB_MGW;
  const someId = ['abcd1234', '1111', '2222', '3333', '444455556666'].join('-');
  env.DB_MGW = { prepare() { throw new Error(`D1_ERROR: network connection lost (${someId})`); } };
  const out = await runDay(env, '2026-11-09', 17);
  assert.deepEqual(out.map(r => r.site), ['cgw', 'mgw', ...PRICE_SITES.slice(2).map(s => s.code), 'mgw', 'mgw', null, null]);
  const r = one(prices, "SELECT status, attempts, error FROM price_runs WHERE site = 'mgw'");
  assert.equal(r.status, 'error');
  assert.equal(r.attempts, 3);
  assert.match(r.error, /network connection lost \(<id>\)/, 'the error is kept, without the id');
  assert.equal(one(prices, "SELECT COUNT(*) AS n FROM price_log WHERE site = 'mgw'").n, 0);
  // the next day it starts again from 0 tries
  env.DB_MGW = good;
  const next = await runDay(env, '2026-11-10');
  assert.equal(next.find(x => x.site === 'mgw').status, 'ok');
  assert.equal(next.find(x => x.site === 'mgw').added, 3);
});

test('a write that fails leaves nothing half written for that chunk, and is tried again', async () => {
  const { env, prices } = makeEnv();
  const real = env.PRICES_DB.batch;
  let fail = true;
  env.PRICES_DB.batch = async list => { if (fail) { fail = false; await real(list.slice(0, 1)); throw new Error('D1_ERROR: overloaded'); } return real(list); };
  // worst case: the batch fails after its first statement (the history row without the last state); the retry still
  // ends with one row per product and day
  const first = await runOnce(env, { now: at('2026-11-09', 0) });
  assert.equal(first.status, 'error');
  env.PRICES_DB.batch = real;
  await runDay(env, '2026-11-09', 15);
  assert.equal(one(prices, "SELECT COUNT(*) AS n FROM price_log WHERE site = 'cgw'").n, 3);
  assert.equal(one(prices, "SELECT COUNT(*) AS n FROM price_last WHERE site = 'cgw'").n, 3);
  assert.equal(one(prices, "SELECT status FROM price_runs WHERE site = 'cgw'").status, 'ok');
});

test('a run cut off (still "running" after 20 minutes) is taken again; a running one is left alone', async () => {
  const { env, prices } = makeEnv();
  prices.prepare("INSERT INTO price_runs (day, site, status, attempts, started_at) VALUES ('2026-11-09', 'cgw', 'running', 1, ?)").run(new Date(at('2026-11-09', 0)).toISOString());
  const a = await runOnce(env, { now: at('2026-11-09', 10) });
  assert.equal(a.site, 'mgw', 'CGW started 10 minutes ago: still running');
  for (let i = 0; i < 11; i++) await runOnce(env, { now: at('2026-11-09', 11 + i) });
  const b = await runOnce(env, { now: at('2026-11-09', 25) });
  assert.equal(b.site, 'cgw', 'CGW started 25 minutes ago: cut off, taken again');
  assert.equal(b.status, 'ok');
  assert.equal(one(prices, "SELECT attempts FROM price_runs WHERE site = 'cgw'").attempts, 2);
});

test('an empty answer from a site is an error: nothing written, nothing marked gone', async () => {
  const { env, sites, prices } = makeEnv();
  await runDay(env, '2026-11-09');
  sites.ggw.exec('UPDATE products SET is_active = 0');
  const out = await runDay(env, '2026-11-10');
  const g = out.find(r => r.site === 'ggw');
  assert.equal(g.status, 'error');
  assert.match(g.error, /no products/);
  assert.equal(one(prices, "SELECT COUNT(*) AS n FROM price_log WHERE site = 'ggw' AND day = '2026-11-10'").n, 0);
  assert.equal(one(prices, "SELECT COUNT(*) AS n FROM price_last WHERE site = 'ggw' AND listed = 1").n, 3);
});

test('the daily write limit: a site past it writes the first changes (by key), the rest come the next day', async () => {
  const { env, prices } = makeEnv();
  env.DAILY_WRITE_CAP = '16'; // 2 rows per product: 3 sites of 3 products = 18 would be needed
  const out = await runDay(env, '2026-11-09', 4);
  assert.deepEqual(out.map(r => [r.site, r.status, r.writes]), [['cgw', 'ok', 6], ['mgw', 'ok', 6], ['wgw', 'capped', 4], ['kgw', 'capped', 0]]);
  assert.deepEqual(rows(prices, "SELECT pkey FROM price_log WHERE site = 'wgw'").map(r => r.pkey), ['Shop One:A1', 'Shop Two:B2']);
  assert.equal(one(prices, "SELECT SUM(writes) AS w FROM price_runs WHERE day = '2026-11-09'").w, 16);
  env.DAILY_WRITE_CAP = '';
  const next = await runDay(env, '2026-11-10');
  assert.equal(next.find(r => r.site === 'wgw').added, 1);
  assert.equal(next.find(r => r.site === 'kgw').added, 3);
  assert.equal(next.find(r => r.site === 'cgw').writes, 0);
  assert.equal(DEFAULTS.dailyWriteCap, 1000000);
});

test('small pages and small chunks give exactly the same log', async () => {
  const a = makeEnv();
  const b = makeEnv();
  for (const e of [a, b]) {
    for (let i = 0; i < 40; i++) newRow(e.sites.zgw, { key: `20:${String(i).padStart(3, '0')}`, mpid: `Z${i}`, retailer: 'Pet Shop', name: `Toy ${i}`, price: 1 + i / 4, was: null, stock: i % 2, active: 1 });
  }
  await runDay(a.env, '2026-11-09');
  await runDay(b.env, '2026-11-09', 13, { pageRows: 3, chunkRows: 4, chunkBytes: 200, chunksPerBatch: 2 });
  const all = p => rows(p, 'SELECT * FROM price_log ORDER BY site, pkey, day');
  assert.deepEqual(all(b.prices), all(a.prices));
  assert.equal(one(b.prices, "SELECT products FROM price_runs WHERE site = 'zgw'").products, 43);
  // the next day reads the last state in pages too
  for (const e of [a, b]) e.sites.zgw.exec("UPDATE products SET price = price + 1 WHERE stable_key IN ('20:007', '20:031')");
  await runDay(a.env, '2026-11-10');
  await runDay(b.env, '2026-11-10', 13, { pageRows: 3, chunkRows: 4, chunkBytes: 200, chunksPerBatch: 2 });
  assert.deepEqual(all(b.prices), all(a.prices));
  assert.deepEqual(rows(b.prices, "SELECT pkey FROM price_log WHERE day = '2026-11-10'").map(r => r.pkey), ['20:007', '20:031']);
});

test('the Worker has no public answer (404) and its cron logs one site', async () => {
  const res = await worker.fetch(new Request('https://gear-world-prices.example/'));
  assert.equal(res.status, 404);
  const { env, prices } = makeEnv();
  const logs = [];
  const orig = console.log;
  console.log = m => logs.push(m);
  try { await worker.scheduled({ scheduledTime: at('2026-11-09', 0), cron: '*/15 * * * *' }, env, { waitUntil() {} }); } finally { console.log = orig; }
  assert.equal(one(prices, 'SELECT COUNT(*) AS n FROM price_runs').n, 1);
  assert.match(logs[0], /"site":"cgw"/);
});

test('the Worker code reaches a site database only through readOnly()', () => {
  const src = readFileSync('sites/prices/price-log.js', 'utf8');
  const uses = src.match(/env\[[^\]]+\]/g) || [];
  assert.deepEqual(uses, ['env[site.binding]']);
  assert.match(src, /readOnly\(env\[site\.binding\], site\.binding\)/);
  assert.ok(!/env\.DB_/.test(src) && !/env\.DB_/.test(readFileSync('sites/prices/worker.js', 'utf8')));
  assert.ok(!/\bDELETE\b|\bDROP\b|\bALTER\b/.test(src), 'the Worker never deletes or changes a table');
});

test('the site list: the 13 sites of the Hub, with their own database and layout', async () => {
  assert.deepEqual(PRICE_SITES.map(s => s.code.toUpperCase()), GEAR_WORLDS.map(w => w.code));
  for (const s of PRICE_SITES) {
    const cfg = (await import(`../../sites/${s.code}/site.config.js`)).default;
    assert.equal(s.legacy, Boolean(cfg.database && cfg.database.layout === 'legacy'), `${s.code} layout`);
    const w = parseJsonc(readFileSync(`sites/${s.code}/wrangler.jsonc.example`, 'utf8'));
    assert.equal(w.d1_databases.find(d => d.binding === 'DB').database_name, s.database, `${s.code} database`);
    assert.equal(s.binding, `DB_${s.code.toUpperCase()}`);
    assert.ok(s.legacy || existsSync(`sites/${s.code}/migrations/0001_init.sql`));
  }
});

test('the Worker config template: private, every 15 minutes, the price database and the 13 site databases', () => {
  const text = readFileSync('sites/prices/wrangler.jsonc.example', 'utf8');
  const cfg = readTemplate(text);
  assert.equal(cfg.main, 'worker.js');
  assert.deepEqual(cfg.triggers.crons, ['*/15 * * * *']);
  assert.equal(cfg.vars.DAILY_WRITE_CAP, '1000000');
  assert.ok(cfg.limits.cpu_ms <= 300000);
  assert.deepEqual(cfg.d1_databases.slice(1).map(d => [d.binding, d.database_name]), PRICE_SITES.map(s => [s.binding, s.database]));
  assert.deepEqual(databaseNames(text), ['gear-world-prices', ...PRICE_SITES.map(s => s.database)]);
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(text), 'no database id in the template');
  assert.ok(!('services' in cfg) && !('routes' in cfg) && !('kv_namespaces' in cfg));
});

test('prices-config: the real config gets every id; "stop" has no cron; anything odd is refused', () => {
  const text = readFileSync('sites/prices/wrangler.jsonc.example', 'utf8');
  const ids = {};
  databaseNames(text).forEach((n, i) => { ids[n] = `${String(i).padStart(8, '0')}-aaaa-4bbb-8ccc-dddddddddddd`; });
  const run = parseJsonc(buildConfig(text, ids, 'run', 'test'));
  assert.deepEqual(run.triggers.crons, ['*/15 * * * *']);
  assert.ok(run.d1_databases.every(d => d.database_id === ids[d.database_name]));
  assert.equal(run.workers_dev, false);
  const stop = parseJsonc(buildConfig(text, ids, 'stop', 'test'));
  assert.deepEqual(stop.triggers.crons, []);
  assert.deepEqual(stop.d1_databases, run.d1_databases);
  const missing = { ...ids };
  delete missing['pets-gear-world'];
  assert.throws(() => buildConfig(text, missing, 'run'), /no id for pets-gear-world/);
  assert.throws(() => buildConfig(text, { ...ids, 'car-gear-world': 'not-an-id' }, 'run'), /no id for car-gear-world/);
  assert.throws(() => buildConfig(text, ids, 'other'), /run or stop/);
  assert.throws(() => readTemplate(text.replace('"workers_dev": false', '"workers_dev": true')), /workers.dev/);
  assert.throws(() => readTemplate(text.replace('"preview_urls": false,', '"preview_urls": false, "routes": ["x.com/*"],')), /no routes/);
  assert.throws(() => readTemplate(text.replace('"*/15 * * * *"', '"* * * * *"')), /one cron/);
  assert.throws(() => readTemplate(text.replace('"binding": "DB_ZGW", "database_name": "pets-gear-world"', '"binding": "DB_ZGW", "database_name": "gaming-gear-world"')), /twice/);
  assert.throws(() => readTemplate(text.replace('"database_name": "pets-gear-world", "database_id": "REPLACE_WITH_DATABASE_ID"', '"database_name": "pets-gear-world", "database_id": "REPLACE_WITH_DATABASE_ID", "migrations_dir": "migrations"')), /no migrations for a site/);
});
