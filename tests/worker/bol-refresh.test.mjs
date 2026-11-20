// The daily bol.com price refresh (private Worker gear-world-bol-refresh, lessons L205): only bol.com rows already on the
// sites are changed (never an insert, never another retailer), one token per run, no new try after 401/429, the lists of
// src/lib/bol-lists.js, the rest one by one by EAN, budgets across hourly runs, 24-hour hiding even with the switch off,
// a row shown again only when THIS Worker hid it, and no key or token in a message or a database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { refreshRun, createBolRefresh, BOL_SITES, LIST_PAGES, slotOf, parseStamp, settingsOf, stamp, SECRETS, RESHOW_DAYS, KEEP_RUNS } from '../../src/bol-refresh.js';
import { BOL_CATEGORIES, BOL_SEARCHES, BOL_RETAILER, standardJobs } from '../../src/lib/bol-lists.js';
import { ean13, offerPrice, productOf, session, base64Utf8, pageRequest } from '../../src/lib/bol-catalog.js';
import { keyTest } from '../../tools/bol-refresh.mjs';
import { jobsOf as feedJobsOf, session as feedSession } from '../../tools/bol-feed.mjs';

const ID = 'gwBolCatalogId0001';
const SECRET = 'gwBolCatalogSecret0123456789';
const TOKEN = 'bolWorkerToken';

// ---- fake D1 (node:sqlite), with the limits the tests check: bound values per statement, no product inserts ----
function fakeD1(files, label) {
  const sql = new DatabaseSync(':memory:');
  for (const f of files) sql.exec(readFileSync(f, 'utf8'));
  const log = [];
  const stmt = (text, args = []) => ({
    text, args,
    bind: (...a) => stmt(text, a),
    all: async () => { log.push({ text, args }); return { results: sql.prepare(text).all(...args).map(r => ({ ...r })) }; },
    first: async () => { log.push({ text, args }); const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { log.push({ text, args }); const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return {
    label, sql, log, batches: 0,
    prepare: text => stmt(text),
    async batch(list) {
      this.batches++;
      sql.exec('BEGIN');
      try { for (const s of list) { log.push({ text: s.text, args: s.args }); sql.prepare(s.text).run(...s.args); } sql.exec('COMMIT'); } catch (e) { sql.exec('ROLLBACK'); throw e; }
      return [];
    }
  };
}
const LEGACY = ['tests/fixtures/ggw-legacy-schema.sql'];
const NATIVE = ['sites/agw/migrations/0001_init.sql', 'sites/agw/migrations/0002_group_key_index.sql', 'sites/agw/migrations/0003_fast_lists.sql'];

function world() {
  const env = { SALES_DB: fakeD1(['sites/awin/migrations/0001_awin.sql', 'sites/bol-refresh/migrations/0001_bol_refresh.sql'], 'sales'),
    BOL_CATALOG_CLIENT_ID: ID, BOL_CATALOG_CLIENT_SECRET: SECRET, GW_COMMIT: 'ab'.repeat(20), BOL_PAUSE_MS: '0' };
  for (const s of BOL_SITES) env[s.binding] = fakeD1(s.layout === 'legacy' ? LEGACY : NATIVE, s.code);
  return env;
}
let nativeN = 0;
function addLegacy(db, { ean = '', gtin = '', price = 10, stock = 'in stock', fresh = '2026-11-19 04:20:00', active = 1, retailer = BOL_RETAILER, currency = 'EUR' }) {
  const specs = gtin ? JSON.stringify({ gtin }) : null;
  const r = db.sql.prepare(`INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, product_name, price, currency, stock_status, image_url, affiliate_url, ean, is_active, created_at, updated_at, specs_json)
    VALUES (?, ?, ?, 'Tools', 'P', ?, ?, ?, 'https://x/1.jpg', 'https://partner.bol.com/click/click', ?, ?, '2026-11-01 00:00:00', ?, ?)`).run(`bol1:${ean || gtin || Math.random()}`, null, retailer, price, currency, stock, ean || null, active, fresh, specs);
  return Number(r.lastInsertRowid);
}
function addNative(db, { ean = '', price = 10, stock = 1, fresh = '2026-11-19 04:20:00', active = 1, retailer = BOL_RETAILER }) {
  nativeN++;
  const r = db.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, awin_product_id, merchant_product_id, retailer, category_slug, product_name, product_slug, price, currency, in_stock, image_url, affiliate_url, gtin, is_active, first_seen_at, last_seen_at, updated_at)
    VALUES (?, 990001, ?, ?, ?, 'tyres', 'P', 'p', ?, 'EUR', ?, 'https://x/1.jpg', 'https://partner.bol.com/click/click', ?, ?, '2026-11-01 00:00:00', ?, '2026-11-01 00:00:00')`).run(`bol:${nativeN}`, `a${nativeN}`, `m${nativeN}`, retailer, price, stock, ean || null, active, fresh);
  return Number(r.lastInsertRowid);
}
const row = (db, id) => db.sql.prepare('SELECT * FROM products WHERE id = ?').get(id);
const runs = env => env.SALES_DB.sql.prepare('SELECT * FROM bol_refresh_runs ORDER BY id').all();
const meta = (env, k) => { const r = env.SALES_DB.sql.prepare('SELECT value FROM bol_refresh_meta WHERE key = ?').get(k); return r ? r.value : null; };
const hiddenRows = env => env.SALES_DB.sql.prepare('SELECT site, product_id, reason FROM bol_refresh_hidden ORDER BY site, product_id').all();
const EAN = n => String(8710000000000 + n);

// ---- fake bol.com: token, popular lists, search, product by EAN; records every call ----
function fakeBol({ lists = {}, products = {}, tokenStatus = 200, listStatus = {}, productStatus = {}, expires = 299 } = {}) {
  const F = { tokens: 0, calls: [], hosts: new Set() };
  const send = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
  F.fetch = async (url, init = {}) => {
    const u = new URL(url);
    F.hosts.add(u.hostname);
    const h = init.headers || {};
    assert.equal(init.redirect, 'manual', 'a redirect is never followed');
    if (u.hostname === 'login.bol.com' && u.pathname === '/token') {
      F.tokens++;
      assert.equal(h.Authorization, `Basic ${Buffer.from(`${ID}:${SECRET}`).toString('base64')}`);
      if (tokenStatus !== 200) return send(tokenStatus, { error: 'nope' });
      return send(200, { access_token: `${TOKEN}${F.tokens}`, expires_in: expires });
    }
    assert.equal(u.hostname, 'api.bol.com');
    assert.equal(h.Authorization, `Bearer ${TOKEN}${F.tokens}`);
    assert.equal(h['Accept-Language'], 'nl');
    assert.equal(u.searchParams.get('country-code'), 'NL');
    assert.equal(u.searchParams.get('include-offer'), 'true');
    const c = { path: u.pathname.replace('/marketing/catalog/v1', ''), q: Object.fromEntries(u.searchParams) };
    F.calls.push(c);
    const m = /^\/products\/(\d{13})$/.exec(c.path);
    if (m) {
      const s = productStatus[m[1]];
      if (s) return send(s, { title: `status ${s}` });
      if (!products[m[1]]) return send(404, { title: 'Not found' });
      return send(200, products[m[1]]);
    }
    const key = c.path === '/products/search' ? `s:${c.q['search-term']}` : `c:${c.q['category-id']}`;
    if (listStatus[key]) return send(listStatus[key], { title: 'x' });
    const all = lists[key] || [];
    const page = Number(c.q.page), size = Number(c.q['page-size']);
    assert.equal(size, 50);
    const totalPages = Math.max(1, Math.ceil(all.length / size));
    return send(200, { page, totalPages, totalResults: all.length, results: all.slice((page - 1) * size, page * size) });
  };
  return F;
}
const prod = (ean, price) => ({ ean, title: `Product ${ean}`, url: `https://www.bol.com/nl/nl/p/x/${ean}/`, ...(price ? { offer: { price, deliveryDescription: 'Morgen in huis' } } : {}) });
const clock = iso => { let t = Date.parse(iso); return { now: () => new Date(t), add: ms => { t += ms; } }; };
const noSleep = async () => {};

test('the shared lists: 12 categories in the order of the commission, then 2 searches; the PC download uses the same jobs', () => {
  assert.deepEqual(BOL_CATEGORIES.map(c => c.id), ['43646', '11764', '12001', '15270', '14648', '14035', '13155', '12974', '12748', '46673', '47024', '16947']);
  assert.deepEqual(BOL_SEARCHES, ['parfum', 'werkschoenen']);
  const jobs = standardJobs();
  assert.equal(jobs.length, 14);
  assert.equal(jobs[0].label, 'Auto & Motor');
  assert.deepEqual(jobs.slice(12).map(j => [j.kind, j.term, j.categoryId]), [['search', 'parfum', ''], ['search', 'werkschoenen', '']]);
  assert.deepEqual(feedJobsOf({ categories: BOL_CATEGORIES.map(c => `${c.id}=${c.name}`), searches: BOL_SEARCHES }), jobs);
  assert.equal(LIST_PAGES, 280);
  assert.equal(feedSession, session, 'the PC tool and the Worker share one session (one token per run)');
  // tools/bol-feed-download.ps1 reads the names with this pattern: every category must match it.
  const text = readFileSync('src/lib/bol-lists.js', 'utf8');
  assert.equal([...text.matchAll(/\{ id: '(\d+)', name: '([^']+)' \}/g)].length, 12);
  assert.match(text, /export const BOL_SEARCHES = \['parfum', 'werkschoenen'\];/);
});

test('helpers: EAN as 13 digits, the offer price, the product of an answer, dates, cycles, settings', () => {
  assert.equal(ean13('8712345678901'), '8712345678901');
  assert.equal(ean13('012345678905'), '0012345678905');
  assert.equal(ean13('12345670'), '0000012345670');
  assert.equal(ean13('08712345678901'), '8712345678901');
  assert.equal(ean13('ABC'), '');
  assert.equal(ean13(''), '');
  assert.equal(offerPrice({ offer: { price: 12.345 } }), 12.35);
  assert.equal(offerPrice({ offer: { price: 0 } }), 0);
  assert.equal(offerPrice({}), 0);
  assert.equal(productOf({ ean: '1' }).ean, '1');
  assert.equal(productOf({ product: { ean: '2' } }).ean, '2');
  assert.equal(productOf(null), null);
  assert.equal(parseStamp('2026-11-20 04:13:00'), Date.parse('2026-11-20T04:13:00Z'));
  assert.equal(parseStamp('2026-11-20T04:13:00Z'), Date.parse('2026-11-20T04:13:00Z'));
  assert.equal(parseStamp('2026-11-20'), Date.parse('2026-11-20T00:00:00Z'));
  assert.ok(Number.isNaN(parseStamp(null)));
  assert.equal(stamp(new Date('2026-11-20T04:13:05.123Z')), '2026-11-20 04:13:05');
  assert.equal(slotOf(new Date('2026-11-20T04:13:00Z')), '2026-11-20T04:00:00.000Z');
  assert.equal(slotOf(new Date('2026-11-20T15:13:00Z')), '2026-11-20T04:00:00.000Z');
  assert.equal(slotOf(new Date('2026-11-20T16:13:00Z')), '2026-11-20T16:00:00.000Z');
  assert.equal(slotOf(new Date('2026-11-20T03:13:00Z')), '2026-11-19T16:00:00.000Z');
  assert.equal(slotOf(new Date('2026-11-20T03:13:00Z'), [4]), '2026-11-19T04:00:00.000Z');
  assert.deepEqual(settingsOf({}), { maxCalls: 800, maxSeconds: 480, pauseMs: 250, cycleHours: [4, 16] });
  assert.deepEqual(settingsOf({ BOL_MAX_CALLS: '20', BOL_MAX_SECONDS: '99999', BOL_CYCLE_HOURS: '16, 4, x, 30' }), { maxCalls: 20, maxSeconds: 480, pauseMs: 250, cycleHours: [4, 16] });
  assert.equal(base64Utf8('a:b'), Buffer.from('a:b').toString('base64'));
  const p = pageRequest(standardJobs()[12], 2, { image: false, rating: false, categories: false });
  assert.deepEqual(p, { path: '/products/search', params: { 'search-term': 'parfum', 'country-code': 'NL', page: 2, 'page-size': 50, 'include-offer': 'true' } });
});

// The Worker's own check record (P2-3): when the Worker last checked a row, and when it first saw it.
const own = (env, code, id) => env.SALES_DB.sql.prepare('SELECT * FROM bol_refresh_checked WHERE site = ? AND product_id = ?').get(code, id);
const seedOwn = (env, code, id, ean, checkedAt, firstSeen = '2026-11-01 00:00:00') => env.SALES_DB.sql.prepare('INSERT INTO bol_refresh_checked (site, product_id, ean, checked_at, first_seen_at) VALUES (?, ?, ?, ?, ?)').run(code, id, ean, checkedAt, firstSeen);
const siteUpdates = db => db.log.filter(x => /^\s*UPDATE products/i.test(x.text));

test('no bol.com rows on the sites: no token, no call, a good run row, the cycle done (after the removal tool: nothing harmful)', async () => {
  const env = world();
  addLegacy(env.DB_HGW, { ean: EAN(1), retailer: 'Some Shop' });
  const F = fakeBol();
  const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(F.tokens, 0);
  assert.equal(F.calls.length, 0);
  assert.equal(r.state, 'ok');
  assert.equal(r.ok, 1);
  assert.match(r.message, /no bol\.com products on the sites/);
  assert.equal(runs(env).length, 1);
  assert.equal(JSON.parse(meta(env, 'cycle')).done, true);
  assert.equal(meta(env, 'commit'), 'ab'.repeat(20), 'the code version for the L156 guard');
  assert.equal(row(env.DB_HGW, 1).is_active, 1, 'another retailer is never touched');
});

test('a full cycle: the lists first (one token, pages of 50), then one by one by EAN; only changed rows are written; hiding; never an insert', async () => {
  const env = world();
  const c = clock('2026-11-20T04:13:00Z');
  // 320 bol.com EANs on HGW (older layout) and AGW (new layout): more than the 280 list pages, so the lists are read.
  const legacyIds = [], nativeIds = [];
  for (let n = 0; n < 160; n++) legacyIds.push(addLegacy(env.DB_HGW, { ean: EAN(n), price: 10 + n, stock: n === 5 ? 'Out of Stock' : 'in stock' }));
  for (let n = 160; n < 320; n++) nativeIds.push(addNative(env.DB_AGW, { ean: EAN(n), price: 10 + n, stock: n === 165 ? 0 : 1 }));
  const legacyGtin = addLegacy(env.DB_HGW, { gtin: '8799999999999', price: 7 });   // EAN only in specs_json
  const otherShop = addLegacy(env.DB_HGW, { ean: EAN(3), price: 1, retailer: 'Other Shop' });
  const sameEanCgw = addLegacy(env.DB_CGW, { ean: EAN(3), price: 13 });            // the same EAN on two sites
  const oldDate = addLegacy(env.DB_CGW, { ean: '8788888888888', price: 9, fresh: '2026-11-10 00:00:00' });
  const lists = { 'c:43646': [], 'c:11764': [] };
  for (let n = 0; n < 300; n++) {
    const price = n === 7 ? 0 : (n === 3 ? 99.5 : (n % 2 ? 10 + n : 10 + n + 1));   // 7: no offer; odd: same; even: +1
    (n < 150 ? lists['c:43646'] : lists['c:11764']).push(prod(EAN(n), price));
  }
  lists['c:43646'].push(prod('8799999999999', 7), prod('8788888888888', 9));
  for (let n = 1000; n < 1059; n++) lists['c:11764'].push(prod(EAN(n), 5));            // not on any site
  const products = { [EAN(300)]: prod(EAN(300), 55.5), [EAN(301)]: prod(EAN(301), 0) }; // 302..319: 404
  const F = fakeBol({ lists, products });
  const before = { hgw: env.DB_HGW.sql.prepare('SELECT COUNT(*) AS n FROM products').get().n, agw: env.DB_AGW.sql.prepare('SELECT COUNT(*) AS n FROM products').get().n };
  const r = await refreshRun(env, { fetchFn: F.fetch, now: c.now, sleepFn: noSleep });
  assert.equal(r.state, 'ok', r.message);
  assert.equal(F.tokens, 1, 'ONE token for the run');
  assert.deepEqual([...F.hosts].sort(), ['api.bol.com', 'login.bol.com']);
  const listCalls = F.calls.filter(x => !/^\/products\/\d{13}$/.test(x.path));
  assert.deepEqual(listCalls.slice(0, 4).map(x => [x.path, x.q['category-id'], x.q.page]), ['1', '2', '3', '4'].map(p => ['/products/lists/popular', '43646', p]));
  assert.equal(listCalls.length, 4 + 5 + 10 + 2, 'Auto & Motor 4 pages, Koken & Tafelen 5 pages, the other 10 lists and the 2 searches one empty page each');
  assert.deepEqual(listCalls.slice(-2).map(x => [x.path, x.q['search-term']]), [['/products/search', 'parfum'], ['/products/search', 'werkschoenen']]);
  assert.equal(r.lookups, 20, 'the 20 rows not in the lists, one by one');
  assert.equal(r.calls, listCalls.length + 20);
  const L = id => row(env.DB_HGW, id);
  const N = id => row(env.DB_AGW, id);
  assert.equal(L(legacyIds[2]).price, 13, 'price changed (12 -> 13)');
  assert.equal(L(legacyIds[2]).updated_at, '2026-11-20 04:13:00', 'a changed row gets the site date too');
  assert.equal(L(legacyIds[1]).price, 11);
  assert.equal(L(legacyIds[1]).updated_at, '2026-11-19 04:20:00', 'same price, stock and visibility: the site row is NOT written');
  assert.equal(own(env, 'hgw', legacyIds[1]).checked_at, '2026-11-20 04:13:00', 'the check is in the Worker\'s own record');
  assert.equal(row(env.DB_CGW, oldDate).updated_at, '2026-11-20 04:13:00', 'same price but the site date older than 7 days: only the date');
  assert.equal(L(legacyIds[5]).stock_status, 'in stock', 'an offer means in stock again');
  assert.equal(L(legacyIds[7]).is_active, 0, 'no offer in the list: hidden');
  assert.equal(own(env, 'hgw', legacyGtin).checked_at, '2026-11-20 04:13:00', 'the EAN in specs_json gtin is found too');
  assert.equal(L(otherShop).price, 1, 'never another retailer');
  assert.equal(row(env.DB_CGW, sameEanCgw).price, 99.5, 'the same EAN on another site: both refreshed');
  assert.equal(L(legacyIds[3]).price, 99.5);
  assert.equal(N(nativeIds[0]).price, 171, 'new layout: price changed (170 -> 171)');
  assert.equal(N(nativeIds[0]).last_seen_at, '2026-11-20 04:13:00');
  assert.equal(N(nativeIds[0]).updated_at, '2026-11-20 04:13:00');
  assert.deepEqual([N(nativeIds[1]).price, N(nativeIds[1]).last_seen_at, N(nativeIds[1]).updated_at], [171, '2026-11-19 04:20:00', '2026-11-01 00:00:00'], 'new layout, nothing changed: not written');
  assert.equal(N(nativeIds[5]).in_stock, 1);
  assert.equal(N(nativeIds[140]).price, 55.5, 'looked up by EAN: 300 has an offer');
  assert.equal(N(nativeIds[141]).is_active, 0, 'looked up: no offer, hidden');
  assert.equal(N(nativeIds[142]).is_active, 0, 'looked up: 404, hidden');
  assert.equal(r.hidden, 1 + 1 + 18);
  assert.equal(hiddenRows(env).filter(h => h.site === 'agw').length, 19);
  assert.ok(hiddenRows(env).some(h => h.site === 'agw' && h.reason === 'not on bol.com (404)'));
  assert.equal(r.pending, 0);
  assert.equal(JSON.parse(meta(env, 'cycle')).done, true);
  // a site row is written only when something visible changes (on HGW every UPDATE rewrites the search index, L59)
  const hgwWrites = siteUpdates(env.DB_HGW);
  assert.ok(hgwWrites.length <= 80 + 1 + 1 + 1, `${hgwWrites.length} UPDATEs on HGW for 80 price changes, 1 stock, 1 hide`);
  // never an insert, never a DELETE on a site, at most 100 bound values per statement, every UPDATE only for bol.com
  for (const s of BOL_SITES) {
    for (const x of env[s.binding].log) {
      assert.ok(!/^\s*(INSERT|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i.test(x.text), `${s.code}: ${x.text.slice(0, 40)}`);
      assert.ok(x.args.length <= 100, `${s.code}: ${x.args.length} bound values`);
      if (/^\s*UPDATE/i.test(x.text)) { assert.match(x.text, /retailer = \?/); assert.ok(x.args.includes(BOL_RETAILER)); }
    }
  }
  for (const x of env.SALES_DB.log) assert.ok(x.args.length <= 100, `sales: ${x.args.length} bound values`);
  assert.equal(env.DB_HGW.sql.prepare('SELECT COUNT(*) AS n FROM products').get().n, before.hgw);
  assert.equal(env.DB_AGW.sql.prepare('SELECT COUNT(*) AS n FROM products').get().n, before.agw);
  const dump = JSON.stringify(env.SALES_DB.sql.prepare('SELECT * FROM bol_refresh_runs').all()) + JSON.stringify(env.SALES_DB.sql.prepare('SELECT * FROM bol_refresh_meta').all());
  for (const v of [ID, SECRET, TOKEN]) assert.ok(!dump.includes(v) && !r.message.includes(v));
  // the next hours of the same cycle: nothing to do, no token
  c.add(3600e3);
  const r2 = await refreshRun(env, { fetchFn: F.fetch, now: c.now, sleepFn: noSleep });
  assert.equal(F.tokens, 1);
  assert.equal(r2.calls, 0);
  assert.match(r2.message, /done/);
  // 16:13: a new cycle reads the lists again
  c.add(11 * 3600e3);
  const r3 = await refreshRun(env, { fetchFn: F.fetch, now: c.now, sleepFn: noSleep });
  assert.equal(F.tokens, 2);
  assert.ok(r3.calls > 20);
  assert.equal(own(env, 'hgw', legacyIds[2]).checked_at, '2026-11-20 16:13:00');
  assert.equal(L(legacyIds[2]).updated_at, '2026-11-20 04:13:00', 'unchanged at 16:13: not written again');
});

test('P1-1: a run that starts at .500 of a second: rows checked in it are not looked up again in the same cycle; "done" only with nothing waiting', async () => {
  const env = world();
  for (let n = 0; n < 5; n++) addLegacy(env.DB_KGW, { ean: EAN(n), price: 5 });
  const products = Object.fromEntries(Array.from({ length: 5 }, (_, n) => [EAN(n), prod(EAN(n), 5)]));
  const F = fakeBol({ products });
  const r1 = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00.500Z').now, sleepFn: noSleep });
  assert.equal(r1.lookups, 5);
  assert.equal(own(env, 'kgw', 1).checked_at, '2026-11-20 04:13:00');
  for (const t of ['2026-11-20T05:13:00.500Z', '2026-11-20T06:13:00.999Z']) {
    const r = await refreshRun(env, { fetchFn: F.fetch, now: clock(t).now, sleepFn: noSleep });
    assert.equal(r.calls, 0, `${t}: nothing looked up again`);
    assert.match(r.message, /done/);
  }
  assert.equal(F.calls.length, 5);
  // with rows still waiting, the run row never says "done"
  const e2 = { ...world(), BOL_MAX_CALLS: '2' };
  for (let n = 0; n < 5; n++) addLegacy(e2.DB_KGW, { ean: EAN(n), price: 5 });
  const r2 = await refreshRun(e2, { fetchFn: fakeBol({ products }).fetch, now: clock('2026-11-20T04:13:00.500Z').now, sleepFn: noSleep });
  assert.equal(r2.pending, 3);
  assert.doesNotMatch(r2.message, /done/);
  assert.match(r2.message, /3 waiting/);
  assert.equal(JSON.parse(meta(e2, 'cycle')).done, false);
});

test('budgets: the calls of one run are limited, the next hourly run goes on from the same list and page, one token each', async () => {
  const env = { ...world(), BOL_MAX_CALLS: '3' };
  const c = clock('2026-11-20T04:13:00Z');
  for (let n = 0; n < 300; n++) addNative(env.DB_SGW, { ean: EAN(n), price: 5 });
  const lists = { 'c:43646': Array.from({ length: 300 }, (_, n) => prod(EAN(n), 6)) };
  const F = fakeBol({ lists });
  const r1 = await refreshRun(env, { fetchFn: F.fetch, now: c.now, sleepFn: noSleep });
  assert.equal(r1.calls, 3);
  assert.equal(r1.found, 150, '3 pages of 50');
  assert.equal(r1.pending, 150);
  assert.match(r1.message, /budget/);
  assert.deepEqual(F.calls.map(x => x.q.page), ['1', '2', '3']);
  const cy = JSON.parse(meta(env, 'cycle'));
  assert.deepEqual([cy.job, cy.page, cy.listsDone, cy.done], [0, 4, false, false]);
  c.add(3600e3);
  const r2 = await refreshRun(env, { fetchFn: F.fetch, now: c.now, sleepFn: noSleep });
  assert.equal(F.tokens, 2, 'one token per run');
  assert.deepEqual(F.calls.slice(3).map(x => x.q.page), ['4', '5', '6']);
  assert.equal(r2.found, 150);
  assert.equal(r2.pending, 0);
  assert.equal(JSON.parse(meta(env, 'cycle')).done, true, 'all found: the lists stop early and the cycle is done');
  assert.equal(env.DB_SGW.sql.prepare('SELECT COUNT(*) AS n FROM products WHERE price = 6').get().n, 300);
});

test('time budget: the run stops starting calls after BOL_MAX_SECONDS', async () => {
  const products = Object.fromEntries(Array.from({ length: 5 }, (_, n) => [EAN(n), prod(EAN(n), 5)]));
  // every answer of the fake bol.com takes 4 seconds on the test clock
  const env2 = { ...world(), BOL_MAX_SECONDS: '10' };
  for (let n = 0; n < 5; n++) addLegacy(env2.DB_KGW, { ean: EAN(n), price: 5 });
  const c2 = clock('2026-11-20T04:13:00Z');
  const F2 = fakeBol({ products });
  const slow = async (u, i) => { c2.add(4000); return F2.fetch(u, i); };
  const r2 = await refreshRun(env2, { fetchFn: slow, now: c2.now, sleepFn: noSleep });
  assert.equal(r2.lookups, 2, 'token + 2 calls take 12 s: no third call');
  assert.equal(r2.pending, 3);
  assert.equal(r2.state, 'ok');
});

test('few EANs (not more than the list pages): no list is read, only lookups; an empty currency (GBP on the older sites) is never refreshed', async () => {
  const env = world();
  const id = addLegacy(env.DB_WGW, { ean: '012345678905', price: 20 });   // 12 digits: looked up as 13
  const gbp = addLegacy(env.DB_WGW, { ean: EAN(9), price: 20, currency: '' });
  const F = fakeBol({ products: { '0012345678905': prod('0012345678905', 19.99), [EAN(9)]: prod(EAN(9), 1) } });
  const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.deepEqual(F.calls.map(x => x.path), ['/products/0012345678905']);
  assert.equal(row(env.DB_WGW, id).price, 19.99);
  assert.equal(r.updated, 1);
  assert.match(r.message, /looked up one by one/);
  assert.match(r.message, /1 not in EUR/);
  assert.deepEqual([row(env.DB_WGW, gbp).price, row(env.DB_WGW, gbp).currency], [20, ''], 'price and currency left as they are');
});

test('P2-3: freshness is the Worker\'s own check time, never the site\'s date; a row it never checked is due at once', async () => {
  const env = world();
  // site date written today by another tool, but the Worker last checked it 25 hours ago: hidden
  const touched = addNative(env.DB_VGW, { ean: EAN(1), fresh: '2026-11-20 04:00:00' });
  seedOwn(env, 'vgw', touched, EAN(1), '2026-11-19 03:13:00');
  // the Worker checked it 23 hours ago (the site date is old): stays
  const fine = addNative(env.DB_VGW, { ean: EAN(2), fresh: '2026-11-01 00:00:00' });
  seedOwn(env, 'vgw', fine, EAN(2), '2026-11-19 05:13:00');
  env.SALES_DB.sql.prepare("UPDATE bol_refresh_meta SET value = '0' WHERE key = 'enabled'").run();
  await refreshRun(env, { fetchFn: fakeBol().fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(row(env.DB_VGW, touched).is_active, 0, 'checked by the Worker 25 h ago: hidden, whatever the site date says');
  assert.equal(row(env.DB_VGW, fine).is_active, 1);
  // a new row (a new import) after the cycle is done: looked up in the next run, not the next cycle
  const e2 = world();
  const a = addLegacy(e2.DB_GGW, { ean: EAN(1), price: 5 });
  const F = fakeBol({ products: { [EAN(1)]: prod(EAN(1), 5), [EAN(2)]: prod(EAN(2), 8) } });
  await refreshRun(e2, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(JSON.parse(meta(e2, 'cycle')).done, true);
  const b = addLegacy(e2.DB_GGW, { ean: EAN(2), price: 7, fresh: '2026-11-20 04:30:00' });
  const r = await refreshRun(e2, { fetchFn: F.fetch, now: clock('2026-11-20T05:13:00Z').now, sleepFn: noSleep });
  assert.deepEqual(F.calls.map(x => x.path), [`/products/${EAN(1)}`, `/products/${EAN(2)}`]);
  assert.equal(row(e2.DB_GGW, b).price, 8);
  assert.equal(r.lookups, 1);
  assert.equal(own(e2, 'ggw', a).checked_at, '2026-11-20 04:13:00');
  // a row never checked (switch off): the Worker notes when it first saw it, and hides it 24 hours later
  const e3 = world();
  e3.SALES_DB.sql.prepare("UPDATE bol_refresh_meta SET value = '0' WHERE key = 'enabled'").run();
  const n1 = addNative(e3.DB_ZGW, { ean: EAN(1), fresh: '2026-11-20 04:00:00' });
  await refreshRun(e3, { fetchFn: fakeBol().fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.deepEqual([own(e3, 'zgw', n1).checked_at, own(e3, 'zgw', n1).first_seen_at], [null, '2026-11-20 04:13:00']);
  await refreshRun(e3, { fetchFn: fakeBol().fetch, now: clock('2026-11-21T04:00:00Z').now, sleepFn: noSleep });
  assert.equal(row(e3.DB_ZGW, n1).is_active, 1, 'seen 23 h 47 min ago: stays');
  e3.DB_ZGW.sql.prepare("UPDATE products SET last_seen_at = '2026-11-21 03:00:00' WHERE id = ?").run(n1);   // another tool touched it
  await refreshRun(e3, { fetchFn: fakeBol().fetch, now: clock('2026-11-21T04:14:00Z').now, sleepFn: noSleep });
  assert.equal(row(e3.DB_ZGW, n1).is_active, 0, 'never checked by the Worker, seen 24 h 1 min ago: hidden, though the site date is 1 hour old');
});

test('kill switch off: no bol.com call, no price change, but rows not checked for 24 hours are still hidden (state held)', async () => {
  const env = world();
  env.SALES_DB.sql.prepare("UPDATE bol_refresh_meta SET value = '0' WHERE key = 'enabled'").run();
  const stale = addLegacy(env.DB_MGW, { ean: EAN(1), price: 20 });
  const fresh = addLegacy(env.DB_MGW, { ean: EAN(2), price: 20 });
  seedOwn(env, 'mgw', stale, EAN(1), '2026-11-19 04:12:00');
  seedOwn(env, 'mgw', fresh, EAN(2), '2026-11-19 05:00:00');
  const F = fakeBol({ products: { [EAN(1)]: prod(EAN(1), 25), [EAN(2)]: prod(EAN(2), 25) } });
  const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(F.tokens + F.calls.length, 0, 'no call at all');
  assert.equal(r.state, 'held');
  assert.equal(r.ok, 2);
  assert.match(r.message, /kill switch off/);
  assert.equal(row(env.DB_MGW, stale).is_active, 0, 'checked 24 h 1 min ago: hidden');
  assert.equal(row(env.DB_MGW, fresh).is_active, 1, 'checked 23 h ago: stays');
  assert.equal(row(env.DB_MGW, fresh).price, 20, 'no price change');
  assert.equal(runs(env)[0].state, 'held');
  // switched on again: the hidden row is looked up and shown again (THIS Worker hid it, and it is unchanged)
  env.SALES_DB.sql.prepare("UPDATE bol_refresh_meta SET value = '1' WHERE key = 'enabled'").run();
  const r2 = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T05:13:00Z').now, sleepFn: noSleep });
  assert.equal(r2.reshown, 1);
  assert.equal(row(env.DB_MGW, stale).is_active, 1);
  assert.equal(row(env.DB_MGW, stale).price, 25);
  assert.deepEqual(hiddenRows(env), []);
});

test('P2-4: shown again only if THIS Worker hid it, within 3 days, and the row is unchanged since', async () => {
  const env = world();
  const c = clock('2026-11-20T04:13:00Z');
  const ours = addNative(env.DB_ZGW, { ean: EAN(2), price: 9 });
  const renamed = addNative(env.DB_ZGW, { ean: EAN(5), price: 9 });
  const theirs = addNative(env.DB_ZGW, { ean: EAN(1), price: 9, active: 0 });
  const F = fakeBol({ products: { [EAN(1)]: prod(EAN(1), 9) } });   // 2 and 5: 404 now, hidden by the Worker
  await refreshRun(env, { fetchFn: F.fetch, now: c.now, sleepFn: noSleep });
  assert.deepEqual([row(env.DB_ZGW, ours).is_active, row(env.DB_ZGW, renamed).is_active], [0, 0]);
  assert.equal(hiddenRows(env).length, 2);
  env.DB_ZGW.sql.prepare("UPDATE products SET product_name = 'Renamed by a clean-up' WHERE id = ?").run(renamed);
  // 16:13: bol.com sells both again
  c.add(12 * 3600e3);
  const F2 = fakeBol({ products: { [EAN(1)]: prod(EAN(1), 9), [EAN(2)]: prod(EAN(2), 9), [EAN(5)]: prod(EAN(5), 9) } });
  const r = await refreshRun(env, { fetchFn: F2.fetch, now: c.now, sleepFn: noSleep });
  assert.deepEqual(F2.calls.map(x => x.path), [`/products/${EAN(2)}`], 'the changed row and the one hidden by someone else are not even looked up');
  assert.equal(row(env.DB_ZGW, ours).is_active, 1);
  assert.equal(row(env.DB_ZGW, renamed).is_active, 0, 'changed since it was hidden: never shown again');
  assert.equal(row(env.DB_ZGW, theirs).is_active, 0);
  assert.equal(r.reshown, 1);
  assert.match(r.message, /1 hidden rows changed since: not shown again/);
  assert.deepEqual(hiddenRows(env), []);
  // hidden 4 days ago: left hidden
  const e2 = world();
  const old = addNative(e2.DB_ZGW, { ean: EAN(3), price: 9, active: 0 });
  e2.SALES_DB.sql.prepare('INSERT INTO bol_refresh_hidden (site, product_id, ean, reason, hidden_at, snap) VALUES (?, ?, ?, ?, ?, ?)').run('zgw', old, EAN(3), 'x', '2026-11-16T04:00:00.000Z', 'whatever');
  const F3 = fakeBol({ products: { [EAN(3)]: prod(EAN(3), 9) } });
  await refreshRun(e2, { fetchFn: F3.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(F3.calls.length, 0);
  assert.equal(row(e2.DB_ZGW, old).is_active, 0);
  assert.equal(RESHOW_DAYS, 3);
});

test('P1-2: 401 or 403 from either host stops the run and turns the switch off (no new try every hour); 429 only stops', async () => {
  const cases = [
    ['token 401', { tokenStatus: 401 }, /refused the keys \(401\)/, true],
    ['token 403', { tokenStatus: 403 }, /answered 403 to the token/, true],
    ['catalog 403', { productStatus: { [EAN(1)]: 403, [EAN(2)]: 403 } }, /api\.bol\.com answered 403/, true],
    ['token 429', { tokenStatus: 429 }, /answered 429 to the token/, false]
  ];
  for (const [name, opt, msg, off] of cases) {
    const env = world();
    const stale = addNative(env.DB_VGW, { ean: EAN(1) });
    seedOwn(env, 'vgw', stale, EAN(1), '2026-11-19 03:00:00');
    addNative(env.DB_VGW, { ean: EAN(2) });
    const F = fakeBol(opt);
    const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
    assert.equal(F.tokens, 1, `${name}: one token, no new try`);
    assert.ok(F.calls.length <= 1, `${name}: at most the one call that failed`);
    assert.equal(r.state, 'error', name);
    assert.match(r.message, msg, name);
    assert.ok(!r.message.includes(SECRET) && !r.message.includes(ID));
    assert.equal(row(env.DB_VGW, stale).is_active, 0, `${name}: the stale row is still hidden`);
    assert.equal(meta(env, 'enabled'), off ? '0' : '1', `${name}: the switch ${off ? 'goes off' : 'stays on'}`);
    if (off) {
      assert.match(meta(env, 'disabled_reason'), /answered 40[13]/);
      assert.match(r.message, /kill switch turned off by the Worker/);
      const F2 = fakeBol();
      const r2 = await refreshRun(env, { fetchFn: F2.fetch, now: clock('2026-11-20T05:13:00Z').now, sleepFn: noSleep });
      assert.equal(F2.tokens + F2.calls.length, 0, `${name}: the next hour asks nothing`);
      assert.deepEqual([r2.state, r2.ok], ['error', 0], `${name}: while the Worker's reason is set, every run is an error, not a pause`);
      assert.match(r2.message, /^kill switch off since worker .*answered 40[13]/);
    }
  }
  // the PC download stops on a 403 too (the same session)
  const { download } = await import('../../tools/bol-feed.mjs');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const F = fakeBol({ listStatus: { 'c:43646': 403 } });
  const api = session({ id: ID, secret: SECRET, fetchImpl: F.fetch });
  await assert.rejects(download({ api, jobs: standardJobs(), out: mkdtempSync(join(tmpdir(), 'bol403-')), pauseMs: 0 }), e => e.code === 6 && e.status === 403);
  assert.equal(F.calls.length, 1, 'no next list after the 403');
});

test('429 on a list: stop (no next list), what was found is kept; failed lookups make the run an error and wait for the next cycle', async () => {
  const env = world();
  for (let n = 0; n < 300; n++) addNative(env.DB_AGW, { ean: EAN(n), price: 5 });
  const F = fakeBol({ lists: { 'c:43646': Array.from({ length: 120 }, (_, n) => prod(EAN(n), 6)) }, listStatus: { 'c:11764': 429 } });
  const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(F.calls.length, 4, '3 pages of the first list, then the 429');
  assert.equal(r.state, 'error');
  assert.match(r.message, /429/);
  assert.equal(r.found, 120, 'the first list was written before the stop');
  assert.equal(JSON.parse(meta(env, 'cycle')).job, 1, 'the next run goes on with the second list');
  assert.equal(meta(env, 'enabled'), '1');
  const e2 = world();
  const id = addLegacy(e2.DB_GGW, { ean: EAN(1) });
  seedOwn(e2, 'ggw', id, EAN(1), '2026-11-20 00:00:00');
  const F2 = fakeBol({ productStatus: { [EAN(1)]: 500 } });
  const r2 = await refreshRun(e2, { fetchFn: F2.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(r2.state, 'error', 'a failed lookup is an error');
  assert.match(r2.message, /1 lookups failed \(HTTP 500 x1\)/);
  assert.equal(row(e2.DB_GGW, id).is_active, 1, 'checked 4 hours ago: not hidden');
  const r3 = await refreshRun(e2, { fetchFn: F2.fetch, now: clock('2026-11-20T05:13:00Z').now, sleepFn: noSleep });
  assert.equal(F2.calls.length, 1, 'not asked again in the same cycle');
  assert.equal(F2.tokens, 1, 'and no token for nothing');
  assert.equal(r3.state, 'ok');
  const e3 = world();
  const id3 = addLegacy(e3.DB_GGW, { ean: EAN(1) });
  await refreshRun(e3, { fetchFn: fakeBol({ productStatus: { [EAN(1)]: 406 } }).fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(row(e3.DB_GGW, id3).is_active, 0, '406: hidden');
});

test('missing keys, a missing site binding or unreadable own records: no bol.com call; the 24-hour hiding still runs', async () => {
  const env = world();
  delete env.BOL_CATALOG_CLIENT_SECRET;
  const stale = addLegacy(env.DB_HGW, { ean: EAN(1) });
  seedOwn(env, 'hgw', stale, EAN(1), '2026-11-18 10:00:00');
  const F = fakeBol();
  const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(F.tokens + F.calls.length, 0);
  assert.equal(r.state, 'error');
  assert.match(r.message, /missing secret\(s\): BOL_CATALOG_CLIENT_SECRET/);
  assert.equal(row(env.DB_HGW, stale).is_active, 0);
  assert.deepEqual(SECRETS, ['BOL_CATALOG_CLIENT_ID', 'BOL_CATALOG_CLIENT_SECRET']);
  const e2 = world();
  delete e2.DB_KGW;
  const id = addNative(e2.DB_AGW, { ean: EAN(1), price: 3 });
  const r2 = await refreshRun(e2, { fetchFn: fakeBol({ products: { [EAN(1)]: prod(EAN(1), 4) } }).fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(row(e2.DB_AGW, id).price, 4);
  assert.equal(r2.state, 'error');
  assert.match(r2.message, /kgw: no database binding DB_KGW/);
  const e3 = world();
  e3.SALES_DB.sql.exec('DROP TABLE bol_refresh_checked');
  const old = addLegacy(e3.DB_HGW, { ean: EAN(1), fresh: '2026-11-18 10:00:00' });
  const F3 = fakeBol();
  const r3 = await refreshRun(e3, { fetchFn: F3.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(F3.tokens + F3.calls.length, 0, 'own records unreadable: no call');
  assert.match(r3.message, /own records not readable/);
  assert.equal(row(e3.DB_HGW, old).is_active, 0, 'and the hiding falls back to the site date');
});

test('P2-2: a pause by the owner or the removal tool is held; a switch the Worker turned off is an error every run', async () => {
  const env = world();
  addNative(env.DB_AGW, { ean: EAN(1) });
  env.SALES_DB.sql.prepare("UPDATE bol_refresh_meta SET value = '0' WHERE key = 'enabled'").run();
  env.SALES_DB.sql.prepare("INSERT INTO bol_refresh_meta (key, value, updated_at) VALUES ('disabled_reason', '', 'x')").run();
  const r1 = await refreshRun(env, { fetchFn: fakeBol().fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.deepEqual([r1.state, r1.ok], ['held', 2]);
  env.SALES_DB.sql.prepare("UPDATE bol_refresh_meta SET value = 'removal tool 2026-11-20T04:00:00Z' WHERE key = 'disabled_reason'").run();
  const r2 = await refreshRun(env, { fetchFn: fakeBol().fetch, now: clock('2026-11-20T05:13:00Z').now, sleepFn: noSleep });
  assert.deepEqual([r2.state, r2.ok], ['held', 2], 'any reason that is not the Worker\'s own is a pause');
  env.SALES_DB.sql.prepare("UPDATE bol_refresh_meta SET value = 'worker 2026-11-20T05:00:00.000Z: bol.com answered 401 (token); turn on with -Step enable' WHERE key = 'disabled_reason'").run();
  const r3 = await refreshRun(env, { fetchFn: fakeBol().fetch, now: clock('2026-11-20T06:13:00Z').now, sleepFn: noSleep });
  assert.deepEqual([r3.state, r3.ok], ['error', 0]);
  assert.match(r3.message, /^kill switch off since worker 2026-11-20T05:00:00\.000Z: bol\.com answered 401/);
  assert.equal(runs(env).at(-1).ok, 0);
});

test('the setup helper: the names the check counts per site: bol.com and its aliases from retailerNames', async () => {
  const { bolAliases, siteAliases } = await import('../../tools/bol-refresh.mjs');
  assert.deepEqual(bolAliases({}), ['bol.com']);
  assert.deepEqual(bolAliases({ database: { retailerNames: { 'Joybuy UK': 'Joybuy', 'bol.com NL': 'bol.com', 'Bol Partner': 'Something', 'bol.com': 'bol.com' } } }), ['bol.com', 'bol.com NL', 'Bol Partner']);
  const all = await siteAliases();
  assert.deepEqual(Object.keys(all), BOL_SITES.map(s => s.code));
  assert.ok(Object.values(all).every(list => list[0] === 'bol.com'));
});

test('the Worker: no public address (404), the cron hands the run to waitUntil; runs kept to the newest 1,000', async () => {
  const w = createBolRefresh({ fetchFn: fakeBol().fetch });
  const res = await w.fetch(new Request('https://x/'));
  assert.equal(res.status, 404);
  const env = world();
  let waited = null;
  await w.scheduled({}, env, { waitUntil: p => { waited = p; } });
  const r = await waited;
  assert.equal(r.state, 'ok');
  assert.equal(KEEP_RUNS, 1000);
});

test('the Wrangler template: private, every hour at :13, the 10 site databases and the sales database, own migrations list', () => {
  const t = readFileSync('sites/bol-refresh/wrangler.jsonc.example', 'utf8');
  const cfg = JSON.parse(t.replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(cfg.name, 'gear-world-bol-refresh');
  assert.equal(cfg.workers_dev, false);
  assert.equal(cfg.preview_urls, false);
  assert.ok(!cfg.routes && !cfg.route);
  assert.deepEqual(cfg.triggers.crons, ['13 * * * *']);
  const [sales, ...siteDbs] = cfg.d1_databases;
  assert.deepEqual([sales.binding, sales.database_name, sales.migrations_dir, sales.migrations_table], ['SALES_DB', 'gear-world-awin', 'migrations', 'd1_migrations_bol_refresh']);
  assert.deepEqual(siteDbs.map(d => [d.binding, d.database_name]), BOL_SITES.map(s => [s.binding, s.database]));
  assert.ok(siteDbs.every(d => d.migrations_dir === 'no-migrations-here' && /^REPLACE_WITH_DATABASE_ID_[A-Z]{3}$/.test(d.database_id)));
  assert.deepEqual(BOL_SITES.filter(s => s.layout === 'legacy').map(s => s.code), ['cgw', 'hgw', 'ggw', 'wgw', 'mgw', 'kgw']);
  assert.deepEqual(BOL_SITES.filter(s => s.layout === 'native').map(s => s.code), ['agw', 'sgw', 'vgw', 'zgw']);
  for (const s of BOL_SITES) assert.match(readFileSync(`sites/${s.code}/wrangler.jsonc.example`, 'utf8'), new RegExp(`"database_name": "${s.database}"`));
  assert.deepEqual(settingsOf(cfg.vars), { maxCalls: 800, maxSeconds: 480, pauseMs: 250, cycleHours: [4, 16] });
});

test('the setup helper: one token and one call to test the keys; 401 refused, 429 blocked, no key in its answer', async () => {
  const seen = [];
  const fetchImpl = async (u, i) => {
    const url = new URL(u);
    seen.push(url.hostname + url.pathname);
    assert.equal(i.redirect, 'manual');
    if (url.pathname === '/token') return new Response(JSON.stringify({ access_token: TOKEN, expires_in: 299 }), { status: 200 });
    assert.equal(url.searchParams.get('page-size'), '1');
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  };
  const ok = await keyTest({ id: ID, secret: SECRET, fetchImpl });
  assert.deepEqual(seen, ['login.bol.com/token', 'api.bol.com/marketing/catalog/v1/products/lists/popular']);
  assert.deepEqual([ok.ok, ok.tokens, ok.calls], [true, 1, 1]);
  const ref = await keyTest({ id: ID, secret: SECRET, fetchImpl: fakeBol({ tokenStatus: 401 }).fetch });
  assert.deepEqual([ref.ok, ref.refused, ref.tokens, ref.calls], [false, true, 1, 0]);
  const blk = await keyTest({ id: ID, secret: SECRET, fetchImpl: fakeBol({ tokenStatus: 429 }).fetch });
  assert.deepEqual([blk.ok, blk.blocked], [false, true]);
  assert.ok(!JSON.stringify([ok, ref, blk]).includes(SECRET));
  assert.equal((await keyTest({ id: ID, secret: SECRET, loginBase: 'https://evil.example' })).error, 'the keys go only to login.bol.com and api.bol.com');
  assert.equal((await keyTest({ id: '', secret: '' })).error, 'no bol.com catalog keys');
});

test('the PC download --standard reads exactly the shared lists (12 categories in order, then the 2 searches), one token', async () => {
  const { createServer } = await import('node:http');
  const { spawn } = await import('node:child_process');
  const { mkdtempSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const seen = [];
  let tokens = 0;
  const server = createServer((q, s) => {
    const u = new URL(q.url, 'http://127.0.0.1');
    const send = (code, x) => { s.writeHead(code, { 'Content-Type': 'application/json' }); s.end(JSON.stringify(x)); };
    if (u.pathname === '/token') { tokens++; return send(200, { access_token: 'tokStandard1', expires_in: 299 }); }
    seen.push(u.pathname.endsWith('/search') ? `s:${u.searchParams.get('search-term')}` : `c:${u.searchParams.get('category-id')}`);
    const n = seen.length;
    return send(200, { page: 1, totalPages: 1, totalResults: 1, results: [prod(EAN(n), 5 + n)] });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const out = mkdtempSync(join(tmpdir(), 'bol-std-'));
  try {
    const child = spawn(process.execPath, ['tools/bol-feed.mjs', '--mode', 'download', '--standard', '--out', out, '--login-base', base, '--api-base', base, '--pause', '0'],
      { env: { ...process.env, GW_BOL_ID: ID, GW_BOL_SECRET: SECRET } });
    let stdout = '';
    child.stdout.on('data', d => { stdout += d; });
    const code = await new Promise(r => child.on('close', r));
    assert.equal(code, 0, stdout);
    const res = JSON.parse(stdout.trim().split('\n').pop());
    assert.equal(res.files, 14);
    assert.equal(res.tokens, 1);
    assert.equal(tokens, 1);
    assert.deepEqual(seen, [...BOL_CATEGORIES.map(c => `c:${c.id}`), 's:parfum', 's:werkschoenen']);
    assert.ok(readdirSync(out).includes('BOL_43646_NL.csv.gz') && readdirSync(out).includes('BOL_0_NL-werkschoenen.csv.gz'));
    assert.ok(!stdout.includes(SECRET) && !stdout.includes('tokStandard1'));
  } finally { server.close(); }
});
