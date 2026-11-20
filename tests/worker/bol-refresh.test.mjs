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

test('a full cycle: the lists first (one token, pages of 50), then one by one by EAN; price, stock and date; hiding; never an insert', async () => {
  const env = world();
  const c = clock('2026-11-20T04:13:00Z');
  // 320 bol.com EANs on HGW (older layout) and AGW (new layout): more than the 280 list pages, so the lists are read.
  const legacyIds = [], nativeIds = [];
  for (let n = 0; n < 160; n++) legacyIds.push(addLegacy(env.DB_HGW, { ean: EAN(n), price: 10 + n, stock: n === 5 ? 'Out of Stock' : 'in stock' }));
  for (let n = 160; n < 320; n++) nativeIds.push(addNative(env.DB_AGW, { ean: EAN(n), price: 10 + n, stock: n === 165 ? 0 : 1 }));
  const legacyGtin = addLegacy(env.DB_HGW, { gtin: '8799999999999', price: 7 });   // EAN only in specs_json
  const otherShop = addLegacy(env.DB_HGW, { ean: EAN(3), price: 1, retailer: 'Other Shop' });
  const sameEanCgw = addLegacy(env.DB_CGW, { ean: EAN(3), price: 13 });            // the same EAN on two sites
  const lists = { 'c:43646': [], 'c:11764': [] };
  for (let n = 0; n < 300; n++) {
    const price = n === 7 ? 0 : (n === 3 ? 99.5 : (n % 2 ? 10 + n : 10 + n + 1));   // 7: no offer; others: half change
    (n < 150 ? lists['c:43646'] : lists['c:11764']).push(prod(EAN(n), price));
  }
  lists['c:43646'].push(prod('8799999999999', 7));
  for (let n = 1000; n < 1060; n++) lists['c:11764'].push(prod(EAN(n), 5));            // not on any site
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
  const lookups = F.calls.filter(x => /^\/products\/\d{13}$/.test(x.path));
  assert.equal(lookups.length, 20, 'the 20 rows not in the lists, one by one');
  assert.equal(r.lookups, 20);
  assert.equal(r.calls, listCalls.length + 20);
  // prices, stock, dates
  const L = id => row(env.DB_HGW, id);
  const N = id => row(env.DB_AGW, id);
  assert.equal(L(legacyIds[2]).price, 13, 'price changed (2 -> 13)');
  assert.equal(L(legacyIds[2]).updated_at, '2026-11-20 04:13:00');
  assert.equal(L(legacyIds[1]).price, 11, 'same price: only the date');
  assert.equal(L(legacyIds[1]).updated_at, '2026-11-20 04:13:00');
  assert.equal(L(legacyIds[5]).stock_status, 'in stock', 'an offer means in stock again');
  assert.equal(L(legacyIds[7]).is_active, 0, 'no offer in the list: hidden');
  assert.equal(L(legacyGtin).updated_at, '2026-11-20 04:13:00', 'the EAN in specs_json gtin is found too');
  assert.equal(L(otherShop).price, 1, 'never another retailer');
  assert.equal(L(otherShop).updated_at, '2026-11-19 04:20:00');
  assert.equal(row(env.DB_CGW, sameEanCgw).price, 99.5, 'the same EAN on another site: both refreshed');
  assert.equal(L(legacyIds[3]).price, 99.5);
  assert.equal(N(nativeIds[0]).price, 171, 'new layout: price changed (170 -> 171)');
  assert.equal(N(nativeIds[0]).last_seen_at, '2026-11-20 04:13:00');
  assert.equal(N(nativeIds[0]).updated_at, '2026-11-20 04:13:00');
  assert.equal(N(nativeIds[1]).price, 171, 'new layout, same price');
  assert.equal(N(nativeIds[1]).updated_at, '2026-11-01 00:00:00', 'new layout, same price: updated_at stays, only last_seen_at');
  assert.equal(N(nativeIds[1]).last_seen_at, '2026-11-20 04:13:00');
  assert.equal(N(nativeIds[5]).in_stock, 1);
  assert.equal(N(nativeIds[140]).price, 55.5, 'looked up by EAN: 300 has an offer');
  assert.equal(N(nativeIds[141]).is_active, 0, 'looked up: no offer, hidden');
  assert.equal(N(nativeIds[142]).is_active, 0, 'looked up: 404, hidden');
  assert.equal(r.hidden, 1 + 1 + 18);
  assert.deepEqual(hiddenRows(env).filter(h => h.site === 'agw').length, 19);
  assert.ok(hiddenRows(env).some(h => h.site === 'agw' && h.reason === 'not on bol.com (404)'));
  assert.equal(r.pending, 0);
  assert.equal(JSON.parse(meta(env, 'cycle')).done, true);
  // never an insert, never a DELETE on a site, at most 100 bound values per statement, every UPDATE only for bol.com
  for (const s of BOL_SITES) {
    for (const x of env[s.binding].log) {
      assert.ok(!/^\s*(INSERT|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i.test(x.text), `${s.code}: ${x.text.slice(0, 40)}`);
      assert.ok(x.args.length <= 100, `${s.code}: ${x.args.length} bound values`);
      if (/^\s*UPDATE/i.test(x.text)) { assert.match(x.text, /retailer = \?/); assert.ok(x.args.includes(BOL_RETAILER)); }
    }
  }
  assert.equal(env.DB_HGW.sql.prepare('SELECT COUNT(*) AS n FROM products').get().n, before.hgw);
  assert.equal(env.DB_AGW.sql.prepare('SELECT COUNT(*) AS n FROM products').get().n, before.agw);
  // no key or token anywhere
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
  assert.equal(L(legacyIds[2]).updated_at, '2026-11-20 16:13:00');
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
  assert.equal(env.DB_SGW.sql.prepare("SELECT COUNT(*) AS n FROM products WHERE price = 6 AND last_seen_at >= '2026-11-20 04:13:00'").get().n, 300);
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

test('few EANs (not more than the list pages): no list is read, only lookups', async () => {
  const env = world();
  const id = addLegacy(env.DB_WGW, { ean: '012345678905', price: 20 });   // 12 digits: looked up as 13
  const F = fakeBol({ products: { '0012345678905': prod('0012345678905', 19.99) } });
  const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.deepEqual(F.calls.map(x => x.path), ['/products/0012345678905']);
  assert.equal(row(env.DB_WGW, id).price, 19.99);
  assert.equal(r.updated, 1);
  assert.match(r.message, /looked up one by one/);
});

test('kill switch off: no bol.com call, no price change, but rows not checked for 24 hours are still hidden (state held)', async () => {
  const env = world();
  env.SALES_DB.sql.prepare("UPDATE bol_refresh_meta SET value = '0' WHERE key = 'enabled'").run();
  const stale = addLegacy(env.DB_MGW, { ean: EAN(1), price: 20, fresh: '2026-11-19 04:12:00' });
  const fresh = addLegacy(env.DB_MGW, { ean: EAN(2), price: 20, fresh: '2026-11-19 05:00:00' });
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
  // switched on again: the hidden row is looked up and shown again (THIS Worker hid it)
  env.SALES_DB.sql.prepare("UPDATE bol_refresh_meta SET value = '1' WHERE key = 'enabled'").run();
  const r2 = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T05:13:00Z').now, sleepFn: noSleep });
  assert.equal(r2.reshown, 1);
  assert.equal(row(env.DB_MGW, stale).is_active, 1);
  assert.equal(row(env.DB_MGW, stale).price, 25);
  assert.deepEqual(hiddenRows(env), []);
});

test('a row hidden by anything else (a clean-up, the removal tool) is never shown again; our own only for 14 days', async () => {
  const env = world();
  const theirs = addNative(env.DB_ZGW, { ean: EAN(1), price: 9, active: 0 });
  const ours = addNative(env.DB_ZGW, { ean: EAN(2), price: 9, active: 0 });
  const old = addNative(env.DB_ZGW, { ean: EAN(3), price: 9, active: 0 });
  const ins = env.SALES_DB.sql.prepare('INSERT INTO bol_refresh_hidden (site, product_id, ean, reason, hidden_at) VALUES (?, ?, ?, ?, ?)');
  ins.run('zgw', ours, EAN(2), 'x', '2026-11-19T10:00:00.000Z');
  ins.run('zgw', old, EAN(3), 'x', new Date(Date.parse('2026-11-20T04:13:00Z') - (RESHOW_DAYS + 1) * 864e5).toISOString());
  ins.run('zgw', 99999, EAN(4), 'x', '2026-11-19T10:00:00.000Z');   // a row deleted since (removal tool)
  const F = fakeBol({ products: { [EAN(1)]: prod(EAN(1), 9), [EAN(2)]: prod(EAN(2), 9), [EAN(3)]: prod(EAN(3), 9) } });
  const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.deepEqual(F.calls.map(x => x.path), [`/products/${EAN(2)}`]);
  assert.equal(row(env.DB_ZGW, theirs).is_active, 0);
  assert.equal(row(env.DB_ZGW, ours).is_active, 1);
  assert.equal(row(env.DB_ZGW, old).is_active, 0, 'hidden more than 14 days ago: left hidden');
  assert.equal(r.reshown, 1);
  assert.deepEqual(hiddenRows(env), [], 'the entries of the shown, the too old and the deleted rows are dropped');
});

test('401 on the token: stop at once, no new try, no catalog call; stale rows still hidden; state error without a key', async () => {
  const env = world();
  const stale = addNative(env.DB_VGW, { ean: EAN(1), fresh: '2026-11-19 03:00:00' });
  const ok = addNative(env.DB_VGW, { ean: EAN(2), fresh: '2026-11-19 12:00:00' });
  const F = fakeBol({ tokenStatus: 401 });
  const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(F.tokens, 1);
  assert.equal(F.calls.length, 0);
  assert.equal(r.state, 'error');
  assert.equal(r.ok, 0);
  assert.match(r.message, /refused the keys \(401\)/);
  assert.ok(!r.message.includes(SECRET) && !r.message.includes(ID));
  assert.equal(row(env.DB_VGW, stale).is_active, 0);
  assert.equal(row(env.DB_VGW, ok).is_active, 1);
  assert.equal(r.hidden, 1);
  // 403 and 429 on the token: the same, no new try
  for (const s of [403, 429]) {
    const e2 = world();
    addNative(e2.DB_VGW, { ean: EAN(1) });
    const F2 = fakeBol({ tokenStatus: s });
    const r2 = await refreshRun(e2, { fetchFn: F2.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
    assert.equal(F2.tokens, 1);
    assert.equal(F2.calls.length, 0);
    assert.match(r2.message, new RegExp(`answered ${s} to the token`));
  }
});

test('429 on a list: stop at once (no new try, no next list), what was found is kept; 500 on a lookup is tried next cycle only', async () => {
  const env = world();
  for (let n = 0; n < 300; n++) addNative(env.DB_AGW, { ean: EAN(n), price: 5 });
  const F = fakeBol({ lists: { 'c:43646': Array.from({ length: 120 }, (_, n) => prod(EAN(n), 6)) }, listStatus: { 'c:11764': 429 } });
  const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(F.calls.length, 4, '3 pages of the first list, then the 429');
  assert.equal(r.state, 'error');
  assert.match(r.message, /429/);
  assert.equal(r.found, 120, 'the first list was written before the stop');
  assert.equal(JSON.parse(meta(env, 'cycle')).job, 1, 'the next run goes on with the second list');
  // 500 on lookups: not hidden (checked less than 24 h ago), not asked again in the same cycle
  const e2 = world();
  const id = addLegacy(e2.DB_GGW, { ean: EAN(1), fresh: '2026-11-20 00:00:00' });
  const F2 = fakeBol({ productStatus: { [EAN(1)]: 500 } });
  const r2 = await refreshRun(e2, { fetchFn: F2.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(r2.state, 'ok');
  assert.match(r2.message, /1 lookups failed/);
  assert.equal(row(e2.DB_GGW, id).is_active, 1);
  await refreshRun(e2, { fetchFn: F2.fetch, now: clock('2026-11-20T05:13:00Z').now, sleepFn: noSleep });
  assert.equal(F2.calls.length, 1, 'not asked again in the same cycle');
  assert.equal(F2.tokens, 1, 'and no token for nothing');
  // 406: hidden
  const e3 = world();
  const id3 = addLegacy(e3.DB_GGW, { ean: EAN(1) });
  await refreshRun(e3, { fetchFn: fakeBol({ productStatus: { [EAN(1)]: 406 } }).fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(row(e3.DB_GGW, id3).is_active, 0);
});

test('missing keys or meta: no bol.com call, the 24-hour hiding still runs; a bad host is refused', async () => {
  const env = world();
  delete env.BOL_CATALOG_CLIENT_SECRET;
  const stale = addLegacy(env.DB_HGW, { ean: EAN(1), fresh: '2026-11-18 10:00:00' });
  const F = fakeBol();
  const r = await refreshRun(env, { fetchFn: F.fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(F.tokens + F.calls.length, 0);
  assert.equal(r.state, 'error');
  assert.match(r.message, /missing secret\(s\): BOL_CATALOG_CLIENT_SECRET/);
  assert.equal(row(env.DB_HGW, stale).is_active, 0);
  assert.deepEqual(SECRETS, ['BOL_CATALOG_CLIENT_ID', 'BOL_CATALOG_CLIENT_SECRET']);
  // a site database that is not bound: the others go on
  const e2 = world();
  delete e2.DB_KGW;
  const id = addNative(e2.DB_AGW, { ean: EAN(1), price: 3 });
  const r2 = await refreshRun(e2, { fetchFn: fakeBol({ products: { [EAN(1)]: prod(EAN(1), 4) } }).fetch, now: clock('2026-11-20T04:13:00Z').now, sleepFn: noSleep });
  assert.equal(row(e2.DB_AGW, id).price, 4);
  assert.equal(r2.state, 'error');
  assert.match(r2.message, /kgw: no database binding DB_KGW/);
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
