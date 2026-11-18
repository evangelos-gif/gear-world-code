// Lessons L159 (15 Nov 2026): the lists of a big category read only the cards they show. With the indexes of migration
// 0003 (src/db.js FAST_INDEX_SQL) the engine walks each category in the page's own order and finds each card's group
// through the group-key index, instead of numbering every row of the category (window functions); the counts, the filters
// and the home page's numbers come from the covering index and the census. These tests prove, on random data with
// product groups, stale rows and retailers that a view hides, that every list is exactly the one of the old queries, that
// the walk reads in index order (no sort of the whole category), that a busy database answers with the page's day-long
// copy or 503, and that tracking additions to an address share one cached copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import * as db from '../../src/db.js';
import { viewFor, homeView, cacheKeyUrl } from '../../src/lib/visibility.js';
import { withEdgeCache, isDbBusy, staleKeyUrl, STALE_SECONDS } from '../../src/lib/http.js';
import { edgeMemo, memoAllowed, MEMO_VERSION } from '../../src/lib/memo.js';
import { TEST_DAY } from './test-clock.mjs';

const read = f => readFileSync(f, 'utf8');
const NOW = Date.parse(`${TEST_DAY}T12:00:00Z`);
const SITES = readdirSync('sites').filter(n => existsSync(`sites/${n}/site.config.js`) && existsSync(`sites/${n}/public/assets/site.js`));
const config = {};
for (const s of SITES) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const NEW_LAYOUT = SITES.filter(s => existsSync(`sites/${s}/migrations/0001_init.sql`));

function memD1(schema) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(schema);
  const log = [];
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => { log.push({ text, args }); return { results: sql.prepare(text).all(...args).map(r => ({ ...r })) }; },
    first: async () => { log.push({ text, args }); const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, log, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const migrations = site => readdirSync(`sites/${site}/migrations`).sort().map(f => read(`sites/${site}/migrations/${f}`));
const withoutFast = list => list.filter(t => !/idx_products_cat_featured/.test(t)).join('\n');

function random(seed) {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}
// The same random car shop in two databases: one with the indexes of L159 (fast mode), one without (the old queries).
const CATS = ['tyres-wheels', 'garage-tools-equipment', 'ev-charging'];
const RETAILERS = ['Pneus.be', 'Neumaticos.es', 'Pneumatici.it', 'Tanie-Opony.pl', 'VEVOR', 'Ottocast', 'Example Motor Parts', 'Sample Garage Supplies', 'Tooled Up'];
function shop(seed, n = 1800) {
  const all = migrations('agw');
  const fast = memD1(all.join('\n'));
  const slow = memD1(withoutFast(all));
  const r = random(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const cat = r() < 0.7 ? 'tyres-wheels' : pick(CATS.slice(1));
    const retailer = cat === 'tyres-wheels' && r() < 0.8 ? pick(RETAILERS.slice(0, 4)) : pick(RETAILERS.slice(4));
    // Prices on a few steps, so many rows share a price (the tie-breaks by id and stock are tested too).
    const price = [9.99, 19.5, 25, 49, 60, 75, 99, 120][Math.floor(r() * 8)];
    const was = r() < 0.35 ? price * [1.04, 1.2, 1.5, 3][Math.floor(r() * 4)] : null;
    const gtin = r() < 0.75 ? String(4000000000000 + Math.floor(r() * 500)) : r() < 0.5 ? '' : null;
    const seen = r() < 0.1 ? '2026-09-01 06:00:00' : r() < 0.2 ? '2026-10-02 06:00:00' : '2026-10-19 06:00:00';
    rows.push([`${i % 7}:${i}`, i % 7, `m${i}`, retailer, cat, pick(['Michelin', 'Tyreco', 'Bosch', 'Ring', null]), `Product ${pick(['summer', 'winter', 'drill', 'cable'])} ${i}`,
      `product-${i}`, price, was, r() < 0.8 ? 1 : 0, gtin, r() < 0.95 ? 1 : 0, `2026-${pick(['08', '09', '10'])}-${String(1 + Math.floor(r() * 20)).padStart(2, '0')} 06:00:00`, seen]);
  }
  for (const d of [fast, slow]) {
    const ins = d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name, product_slug,
      price, was_price, currency, in_stock, image_url, affiliate_url, gtin, is_active, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GBP', ?, 'https://img.example/x.jpg', 'https://example.com/x', ?, ?, ?, ?)`);
    for (const row of rows) ins.run(...row);
  }
  return { fast, slow };
}
const plain = x => JSON.parse(JSON.stringify(x));

test('L159: fast mode only with every index of migration 0003 (and the group-key index where offers are grouped); the older sites only with their own (L193)', async () => {
  const site = config.agw;
  db.useLayout(site);
  const { fast, slow } = shop(1, 50);
  assert.equal(await db.fastMode(fast), true);
  assert.equal(await db.fastMode(slow), false);
  // One index missing: the old queries.
  const all = migrations('agw');
  const partial = memD1(all.join('\n') + '\nDROP INDEX idx_products_deals;');
  assert.equal(await db.fastMode(partial), false);
  // A database that cannot answer: the old queries, never an error.
  assert.equal(await db.fastMode({ prepare: () => { throw new Error('D1_ERROR: boom'); } }), false);
  // The older layout (CGW, MGW ...) has its own indexes (L193, tests/worker/fast-lists-legacy.test.mjs): never with these.
  db.useLayout(config.mgw);
  assert.equal(await db.fastMode(fast), false);
  db.useLayout(site);
});

test('L159: the migration of every new-layout site is exactly FAST_INDEX_SQL, and adds only indexes', () => {
  for (const s of NEW_LAYOUT) {
    const text = read(`sites/${s}/migrations/0003_fast_lists.sql`);
    const statements = text.split('\n').filter(l => l.trim() && !l.startsWith('--'));
    assert.deepEqual(statements, db.FAST_INDEX_SQL, s);
    assert.ok(statements.every(l => /^CREATE INDEX IF NOT EXISTS idx_products_\w+ ON products \(/.test(l)), s);
  }
  assert.deepEqual(db.FAST_INDEXES, ['idx_products_cat_featured', 'idx_products_cat_newest', 'idx_products_cat_saving', 'idx_products_deals', 'idx_products_cat_cover']);
  assert.equal(NEW_LAYOUT.length, 7);
});

test('L159: asOther() renames only the columns of the rows named p', () => {
  assert.equal(db.asOther("p.is_active = 1 AND p.category_slug = ? AND likelihood(+p.retailer NOT IN (?) AND +p.last_seen_at >= ?, 1.0)"),
    "o.is_active = 1 AND o.category_slug = ? AND likelihood(+o.retailer NOT IN (?) AND +o.last_seen_at >= ?, 1.0)");
  assert.equal(db.asOther('p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ?)'), 'o.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ?)');
  assert.equal(db.asOther("instr((' ' || replace(lower(p.product_name), '(', ' ') || ' '), ?) > 0 AND top.p.x = 1"), "instr((' ' || replace(lower(o.product_name), '(', ' ') || ' '), ?) > 0 AND top.p.x = 1");
});

test('L159: every list, count and filter of fast mode is exactly the old one (random shops, 4 views, 5 sorts, filters, every page)', async () => {
  const site = config.agw;
  db.useLayout(site);
  const views = { none: null, GB: viewFor(site, 'GB', NOW), all: viewFor(site, 'BE', NOW), PL: viewFor(site, 'PL', NOW) };
  const sorts = ['featured', 'price-asc', 'price-desc', 'newest', 'saving'];
  const filters = [{}, { brand: 'Tyreco' }, { retailer: 'Tooled Up' }, { maxPrice: 30 }, { minPrice: 50 }, { inStock: true }, { onSale: true }];
  let lists = 0;
  for (const seed of [7, 8]) {
    const { fast, slow } = shop(seed);
    for (const [vn, view] of Object.entries(views)) {
      for (const cat of CATS) {
        for (const sort of sorts) {
          for (const extra of filters) {
            const f = { category: cat, view, ...extra };
            const first = plain(await db.listProducts(slow, f, { sort, page: 1, perPage: 24 }));
            for (let page = 1; page <= Math.max(1, first.pages) + 1; page++) {
              const a = page === 1 ? first : plain(await db.listProducts(slow, f, { sort, page, perPage: 24 }));
              const b = plain(await db.listProducts(fast, f, { sort, page, perPage: 24 }));
              assert.deepEqual(b, a, `seed ${seed} ${vn} ${cat} ${sort} ${JSON.stringify(extra)} page ${page}`);
              lists++;
            }
          }
        }
        assert.deepEqual(plain(await db.facets(fast, cat, null, view)), plain(await db.facets(slow, cat, null, view)), `facets ${vn} ${cat}`);
      }
      assert.deepEqual(plain(await db.listProducts(fast, { search: 'summer', view }, { sort: 'featured' })), plain(await db.listProducts(slow, { search: 'summer', view }, { sort: 'featured' })), `search ${vn}`);
      assert.deepEqual(plain(await db.homeData(fast, site.categories.map(c => c.slug), { view })), plain(await db.homeData(slow, site.categories.map(c => c.slug), { view })), `home ${vn}`);
      assert.deepEqual(plain(await db.categoryCounts(fast, view)), plain(await db.categoryCounts(slow, view)), `categoryCounts ${vn}`);
    }
    assert.deepEqual(plain(await db.stats(fast, homeView(site, NOW), site)), plain(await db.stats(slow, homeView(site, NOW), site)), 'stats');
    assert.deepEqual(plain(await db.stats(fast, null, site)), plain(await db.stats(slow, null, site)), 'stats without a view');
  }
  assert.ok(lists > 1500, `${lists} lists compared`);
});

test('L159: a big category is walked in its sort\'s own index (no sort of the whole category), each card\'s group through the group-key index', async () => {
  const site = config.agw;
  db.useLayout(site);
  const { fast } = shop(9, 3000);
  const view = viewFor(site, 'GB', NOW);
  const ORDER = { featured: 'idx_products_cat_featured', 'price-asc': 'idx_products_category', 'price-desc': 'idx_products_category', newest: 'idx_products_cat_newest', saving: 'idx_products_cat_saving' };
  for (const [sort, index] of Object.entries(ORDER)) {
    fast.log.length = 0;
    await db.listProducts(fast, { category: 'tyres-wheels', view: viewFor(site, 'BE', NOW) }, { sort, page: 1 });
    const cards = fast.log.find(q => /NOT EXISTS/.test(q.text));
    assert.ok(cards, `${sort}: the walk`);
    const plan = fast.sql.prepare(`EXPLAIN QUERY PLAN ${cards.text}`).all(...cards.args).map(r => r.detail);
    assert.ok(plan.some(d => d.startsWith(`SEARCH p USING INDEX ${index} (is_active=? AND category_slug=?)`)), `${sort}: ${plan.join(' | ')}`);
    assert.ok(plan.filter(d => / o /.test(d)).every(d => /USING INDEX idx_products_group_key \(<expr>=\?\)/.test(d)), `${sort}: groups by their key`);
    // Only price-desc sorts within a price (its ties go by the lower id first): never the whole category.
    assert.ok(!plan.some(d => /TEMP B-TREE FOR ORDER BY/.test(d)), `${sort}: no sort of the whole category`);
    assert.ok(!/ROW_NUMBER\(\) OVER/.test(cards.text), `${sort}: no numbering of every row`);
  }
  // The counts and the filters: the covering index only (no row of the table).
  fast.log.length = 0;
  await db.facets(fast, 'tyres-wheels', null, view);
  for (const q of fast.log.filter(x => /GROUP BY|MIN\(price\)/.test(x.text))) {
    const plan = fast.sql.prepare(`EXPLAIN QUERY PLAN ${q.text}`).all(...q.args).map(r => r.detail).join(' | ');
    assert.match(plan, /USING COVERING INDEX idx_products_cat_cover/, plan);
  }
  // The home page: the census (one read of the covering index) and two walks of 11 cards.
  fast.log.length = 0;
  await db.homeData(fast, site.categories.map(c => c.slug), { view });
  const census = fast.log.find(q => /GROUP BY category_slug, retailer/.test(q.text));
  assert.match(fast.sql.prepare(`EXPLAIN QUERY PLAN ${census.text}`).all(...census.args).map(r => r.detail).join(' | '), /USING COVERING INDEX idx_products_cat_cover/);
  assert.ok(!fast.log.some(q => /ROW_NUMBER\(\) OVER/.test(q.text)), 'no numbering on the home page');
  for (const name of ['idx_products_active_seen', 'idx_products_deals']) {
    const q = fast.log.find(x => x.text.includes(`INDEXED BY ${name}`));
    const plan = fast.sql.prepare(`EXPLAIN QUERY PLAN ${q.text}`).all(...q.args).map(r => r.detail);
    assert.ok(plan.some(d => d.startsWith(`SEARCH p USING INDEX ${name}`)) && !plan.some(d => /TEMP B-TREE FOR ORDER BY/.test(d)), `${name}: ${plan.join(' | ')}`);
  }
});

test('L159: a filter that leaves few rows is numbered (cardSql) on that small set, not walked through the whole category', async () => {
  const site = config.agw;
  db.useLayout(site);
  const { fast } = shop(10, 3000);
  fast.log.length = 0;
  // One brand at a single price: few rows of the category.
  await db.listProducts(fast, { category: 'tyres-wheels', brand: 'Bosch', maxPrice: 10, view: viewFor(site, 'GB', NOW) }, { sort: 'featured', page: 1 });
  assert.ok(fast.log.some(q => /ROW_NUMBER\(\) OVER/.test(q.text)), 'numbered');
  assert.ok(!fast.log.some(q => /NOT EXISTS/.test(q.text)), 'not walked');
  // Nothing matches: no card query at all.
  fast.log.length = 0;
  const none = await db.listProducts(fast, { category: 'tyres-wheels', brand: 'No such brand' }, { sort: 'featured' });
  assert.deepEqual(none.products, []);
  assert.equal(fast.log.filter(q => !/sqlite_master|GROUP BY category_slug, retailer/.test(q.text)).length, 1, 'only the count');
});

test('L159: memo() keeps counts, filters and the census (the Worker\'s cache); another view, category or question is asked again', async () => {
  const site = config.agw;
  db.useLayout(site);
  const { fast } = shop(11, 400);
  const store = new Map();
  const cache = {
    match: async key => (store.has(key.url) ? new Response(store.get(key.url).body, { headers: store.get(key.url).headers }) : undefined),
    put: async (key, res) => { store.set(key.url, { body: await res.text(), headers: Object.fromEntries(res.headers) }); }
  };
  db.useMemo(edgeMemo(site.domain, cache));
  try {
    const gb = viewFor(site, 'GB', NOW);
    const be = viewFor(site, 'BE', NOW);
    const a = plain(await db.listProducts(fast, { category: 'tyres-wheels', view: gb }, { sort: 'featured' }));
    const reads = fast.log.length;
    const b = plain(await db.listProducts(fast, { category: 'tyres-wheels', view: gb }, { sort: 'featured', page: 1 }));
    assert.deepEqual(b, a);
    assert.equal(fast.log.length - reads, 1, 'the second time only the cards are read: the count and the census are kept');
    await db.listProducts(fast, { category: 'tyres-wheels', view: be }, { sort: 'featured' });
    assert.ok(fast.log.slice(reads + 1).some(q => /COUNT\(DISTINCT/.test(q.text)), 'another view: counted again');
    const f1 = plain(await db.facets(fast, 'tyres-wheels', null, gb));
    const n = fast.log.length;
    assert.deepEqual(plain(await db.facets(fast, 'tyres-wheels', null, gb)), f1);
    assert.equal(fast.log.length, n, 'filters kept');
    await db.facets(fast, 'ev-charging', null, gb);
    assert.ok(fast.log.length > n, 'another category: read');
    // Subcategory counts (TGW Mini PCs, ZGW birds): kept too, the same answer.
    const subs = [{ slug: 'x', name: 'Summer' }, { slug: 'm', name: 'Drills', match: ['drill'] }];
    const s1 = plain(await db.subcategoryCounts(fast, 'tyres-wheels', subs, gb));
    const m = fast.log.length;
    assert.deepEqual(plain(await db.subcategoryCounts(fast, 'tyres-wheels', subs, gb)), s1);
    assert.equal(fast.log.length, m, 'subcategory counts kept');
    // Keys: the site's own address under /__gw-memo/ (no page has it), a hash of the question, the version; lifetimes.
    const keys = [...store.keys()];
    assert.ok(keys.every(k => new RegExp(`^https://cargearworld\\.com/__gw-memo/(census|count|facets|subcats)/[0-9a-f]{32}\\?v=${MEMO_VERSION}$`).test(k)), keys.join(' '));
    const life = name => store.get(keys.find(k => k.includes(`/__gw-memo/${name}/`))).headers['cache-control'];
    assert.equal(life('census'), 'public, max-age=3600');
    assert.equal(life('count'), 'public, max-age=900');
    assert.equal(life('facets'), 'public, max-age=900');
    // A cache that fails: the numbers are read from D1, the page never fails.
    db.useMemo(edgeMemo(site.domain, { match: async () => { throw new Error('cache down'); }, put: async () => { throw new Error('cache down'); } }));
    assert.deepEqual(plain(await db.listProducts(fast, { category: 'tyres-wheels', view: gb }, { sort: 'featured' })), a);
  } finally {
    db.useMemo(null);
  }
  // Never in Node (the tests) or with the page cache off (the local checks).
  assert.equal(memoAllowed({}), false);
  assert.equal(memoAllowed({ EDGE_CACHE: 'off' }), false);
});

test('L159: a busy database (import or overload) gives the page\'s day-long copy, else 503 with Retry-After; any other error stays 500', async () => {
  assert.equal(isDbBusy(new Error('D1_ERROR: Currently processing a long-running import.')), true);
  assert.equal(isDbBusy(new Error('D1 DB is overloaded. Too many resources consumed within a 10 second window.')), true);
  assert.equal(isDbBusy(new Error('D1_ERROR: no such column: foo')), false);
  assert.equal(isDbBusy(new Error('TypeError: x is undefined')), false);
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  const worker = createWorker(config.agw);
  const all = migrations('agw');
  const good = memD1(all.join('\n') + '\n' + read('tests/fixtures/agw-seed.sql'));
  const busyDb = { prepare: () => { throw new Error('D1_ERROR: Currently processing a long-running import.'); }, batch: async () => { throw new Error('D1_ERROR: Currently processing a long-running import.'); } };
  const ctx = { waitUntil: p => p };
  // A UK visitor (no bar is added after the cache, lessons L107).
  const get = (path, DB) => {
    const req = new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } });
    Object.defineProperty(req, 'cf', { value: { country: 'GB' } });
    return worker.fetch(req, { DB, CLICK_LOG: 'off', FX_FETCH: async () => { throw new Error('offline'); } }, ctx);
  };
  try {
    // A first visit while the database answers: the 5-minute copy and the day-long one.
    const ok = await get('/category/garage-tools-equipment/', good);
    assert.equal(ok.status, 200);
    const okHtml = await ok.text();
    const key = cacheKeyUrl('https://cargearworld.com/category/garage-tools-equipment/', viewFor(config.agw, 'GB', NOW));
    assert.ok(store.has(key) && store.has(staleKeyUrl(key)));
    assert.match(store.get(staleKeyUrl(key)).headers.get('Cache-Control'), new RegExp(`max-age=${STALE_SECONDS}`));
    // The 5-minute copy has gone, the database is busy: the day-long copy, not kept by browsers.
    store.delete(key);
    const stale = await get('/category/garage-tools-equipment/', busyDb);
    assert.equal(stale.status, 200);
    assert.equal(stale.headers.get('X-GW-Stale'), '1');
    assert.equal(stale.headers.get('Cache-Control'), 'no-store');
    assert.equal(await stale.text(), okHtml);
    // A page without a copy: 503, try again in a minute.
    const none = await get('/category/ev-charging/', busyDb);
    assert.equal(none.status, 503);
    assert.equal(none.headers.get('Retry-After'), '60');
    assert.match(await none.text(), /try again in a minute/i);
    // Any other error: 500 as before.
    const broken = { prepare: () => { throw new Error('D1_ERROR: no such table: products'); }, batch: async () => { throw new Error('D1_ERROR: no such table: products'); } };
    const err = await get('/category/safety-winter/', broken);
    assert.equal(err.status, 500);
    assert.equal(err.headers.get('Retry-After'), null);
  } finally {
    if (before === undefined) delete globalThis.caches; else globalThis.caches = before;
  }
  // withEdgeCache itself: a non-busy error is never hidden behind a copy.
  globalThis.caches = { default: { match: async key => (key.url.includes('gw-stale=1') ? new Response('old') : undefined), put: async () => {} } };
  try {
    const req = new Request('https://cargearworld.com/x');
    await assert.rejects(() => withEdgeCache(req, { waitUntil: p => p }, async () => { throw new Error('TypeError'); }, {}, 'https://cargearworld.com/y'));
  } finally {
    if (before === undefined) delete globalThis.caches; else globalThis.caches = before;
  }
});

test('L159: tracking and cache-busting additions share the page\'s cached copy; what a page reads keeps its own', () => {
  const view = viewFor(config.agw, 'GB', NOW);
  const base = cacheKeyUrl('https://cargearworld.com/category/tyres-wheels/', view);
  for (const extra of ['v=1731600000', 'utm_source=poster&utm_campaign=b', 'gclid=abc', 'fbclid=x&_=1', 'srsltid=AfmBOo', 'cb=9&nocache=1']) {
    assert.equal(cacheKeyUrl(`https://cargearworld.com/category/tyres-wheels/?${extra}`, view), base, extra);
  }
  for (const kept of ['page=2', 'sort=price-asc', 'brand=Michelin', 'retailer=Tooled+Up', 'max=50', 'min=10', 'stock=1', 'sub=x', 'q=tyre', 'condition=new']) {
    assert.notEqual(cacheKeyUrl(`https://cargearworld.com/category/tyres-wheels/?${kept}`, view), base, kept);
  }
  assert.equal(cacheKeyUrl('https://cargearworld.com/category/tyres-wheels/?page=2&v=3', view), cacheKeyUrl('https://cargearworld.com/category/tyres-wheels/?page=2', view));
});

test('L159: indexes dropped while fast mode still thinks they are there: the same pages the old way, never an error', async () => {
  const site = config.agw;
  db.useLayout(site);
  const { fast, slow } = shop(12, 600);
  const view = viewFor(site, 'GB', NOW);
  assert.equal(await db.fastMode(fast), true);
  // Going back (DROP INDEX), within the 10 minutes before fastMode() looks again.
  for (const name of db.FAST_INDEXES) fast.sql.exec(`DROP INDEX ${name}`);
  assert.deepEqual(plain(await db.listProducts(fast, { category: 'tyres-wheels', view }, { sort: 'featured' })), plain(await db.listProducts(slow, { category: 'tyres-wheels', view }, { sort: 'featured' })));
  assert.equal(await db.fastMode(fast), false, 'fast mode off at once');
  const last = fast.log[fast.log.length - 1].text;
  assert.ok(/ROW_NUMBER\(\) OVER/.test(last) && !/INDEXED BY idx_products_cat_/.test(last), 'the cards the old way');
  // Every other fast-mode question too (a fresh database each time, so fast mode is on when it is asked).
  const again = async ask => {
    const s = shop(13, 300);
    assert.equal(await db.fastMode(s.fast), true);
    for (const name of db.FAST_INDEXES) s.fast.sql.exec(`DROP INDEX ${name}`);
    assert.deepEqual(plain(await ask(s.fast)), plain(await ask(s.slow)));
  };
  await again(d => db.facets(d, 'tyres-wheels', null, view));
  await again(d => db.homeData(d, site.categories.map(c => c.slug), { view }));
  await again(d => db.stats(d, homeView(site, NOW), site));
  await again(d => db.categoryCounts(d, view));
});

test('L159: a site that does not group offers (TGW): fast mode lists, counts and home page exactly as before', async () => {
  const site = config.tgw;
  db.useLayout(site);
  assert.equal(Boolean(site.groupOffers), false);
  const all = migrations('tgw');
  const fast = memD1(all.join('\n'));
  const slow = memD1(withoutFast(all));
  const r = random(21);
  const cats = site.categories.filter(c => !c.collection).slice(0, 3).map(c => c.slug);
  const shops = ['Back to the Office', 'Joybuy', 'PCHUB.UK', 'Ottocast', 'VEVOR'];
  for (const d of [fast, slow]) {
    const rr = random(21);
    const ins = d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name, product_slug,
      price, was_price, currency, in_stock, image_url, affiliate_url, gtin, is_active, first_seen_at, last_seen_at)
      VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'GBP', ?, 'https://img.example/x.jpg', 'https://example.com/x', NULL, 1, ?, ?)`);
    for (let i = 1; i <= 900; i++) {
      const price = [5, 10, 20, 40][Math.floor(rr() * 4)];
      ins.run(`k${i}`, `m${i}`, shops[Math.floor(rr() * shops.length)], cats[Math.floor(rr() * cats.length)], rr() < 0.5 ? 'Acme' : 'Zeta', `Item ${i}`, `item-${i}`,
        price, rr() < 0.4 ? price * 2 : null, rr() < 0.8 ? 1 : 0, `2026-10-${String(1 + Math.floor(rr() * 18)).padStart(2, '0')} 06:00:00`, rr() < 0.15 ? '2026-09-01 06:00:00' : '2026-10-19 06:00:00');
    }
  }
  assert.ok(r() >= 0);
  assert.equal(await db.fastMode(fast), true, 'without the group-key index: TGW does not need it');
  const views = [null, viewFor(site, 'GB', NOW), viewFor(site, 'BE', NOW)];
  for (const view of views) {
    for (const cat of cats) {
      for (const sort of ['featured', 'price-asc', 'price-desc', 'newest', 'saving']) {
        for (const extra of [{}, { brand: 'Acme' }, { maxPrice: 6 }]) {
          for (const page of [1, 2, 3, 9]) {
            const f = { category: cat, view, ...extra };
            assert.deepEqual(plain(await db.listProducts(fast, f, { sort, page })), plain(await db.listProducts(slow, f, { sort, page })), `${cat} ${sort} ${JSON.stringify(extra)} ${page}`);
          }
        }
      }
      assert.deepEqual(plain(await db.facets(fast, cat, null, view)), plain(await db.facets(slow, cat, null, view)));
    }
    assert.deepEqual(plain(await db.homeData(fast, site.categories.map(c => c.slug), { view })), plain(await db.homeData(slow, site.categories.map(c => c.slug), { view })));
  }
  fast.log.length = 0;
  await db.listProducts(fast, { category: cats[0] }, { sort: 'featured' });
  assert.ok(fast.log.some(q => q.text.includes('INDEXED BY idx_products_cat_featured')), 'the walk in featured order');
});
