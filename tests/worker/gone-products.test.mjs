// Lessons L112: on 9/11/2026 Search Console sent "New reasons prevent pages from being indexed: Not found (404)" for
// most sites. They were products that left the site (the feed dropped them, or a clean-up hid them). 404 is right for
// search engines, but the page was a dead end for a visitor from an old search result, pin or post. The address of a
// product that is no longer listed now still answers 404 + noindex, with its name, a notice, its category and the
// closest products in price. These tests check both database layouts, the texts in the 130 dictionaries, and that a
// product that never existed still gets the plain "Page not found".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { legacySlug } from '../../src/db.js';
import { withEdgeCache, isDbBusy, spareKeyUrl, SPARE_SECONDS } from '../../src/lib/http.js';

const CODES = ['agw', 'bgw', 'cgw', 'ggw', 'hgw', 'kgw', 'mgw', 'pgw', 'sgw', 'tgw', 'vgw', 'wgw', 'zgw'];
const LANGS = ['de-DE', 'el-GR', 'es-ES', 'fr-FR', 'it-IT', 'nl-NL', 'pt-PT', 'ro-RO', 'ru-RU', 'sq-AL'];
const NEW_TEXTS = ['This product is no longer listed.', 'Here are similar products from the same category, at a similar price.'];

function memD1(files) {
  const sql = new DatabaseSync(':memory:');
  for (const f of files) sql.exec(readFileSync(f, 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, prepare: t => stmt(t), batch: async l => Promise.all(l.map(x => x.all())) };
}

async function fetchPage(site, env, path) {
  const w = createWorker(site);
  const res = await w.fetch(new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' }, redirect: 'manual' }), env,
    { waitUntil: x => x });
  return { status: res.status, headers: res.headers, html: await res.text() };
}

const cardIds = html => [...html.matchAll(/data-compare="(\d+)"/g)].map(m => Number(m[1]));

function checkGonePage(r, gone, categoryName) {
  assert.equal(r.status, 404, 'still "not found" for search engines');
  assert.match(r.html, /<meta name="robots" content="noindex,follow">/);
  assert.ok(!/<link rel="canonical"/.test(r.html), 'no canonical on a 404');
  assert.match(r.html, /<article class="prose product-gone" data-gone="1">/);
  assert.ok(r.html.includes('<p class="notice-text">This product is no longer listed.</p>'));
  assert.ok(r.html.includes(`<h1 translate="no">${gone.name.replace(/&/g, '&amp;')}</h1>`), 'the old name, untranslated');
  assert.ok(r.html.includes(`>${categoryName.replace(/&/g, '&amp;')}</a></li>`), 'a link to its category');
  assert.ok(!/"@type":"Product"|"@type":"AggregateOffer"|href="\/out\//.test(r.html.split('<section class="section"')[0]), 'no price, no button, no product data for the gone product');
  const ids = cardIds(r.html);
  assert.ok(ids.length > 0, 'similar products are shown');
  assert.ok(!ids.includes(gone.id), 'never the gone product itself');
  assert.ok(r.html.includes('Here are similar products from the same category, at a similar price.'));
  assert.match(r.html, /<h2 id="sim-h">Similar products<\/h2>/);
  return ids;
}

test('TGW (new layout): a product that left the site answers 404 with its category and the closest products', async () => {
  const site = (await import('../../sites/tgw/site.config.js')).default;
  const migrations = readdirSync('sites/tgw/migrations').filter(f => f.endsWith('.sql')).sort().map(f => `sites/tgw/migrations/${f}`);
  const db = memD1([...migrations, 'tests/fixtures/tgw-seed.sql']);
  const env = { DB: db, CLICK_LOG: 'off', FX_FETCH: async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }) };
  // The category with the most products, and one of its products leaves the site.
  const cat = db.sql.prepare('SELECT category_slug AS slug, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY category_slug ORDER BY n DESC LIMIT 1').get();
  const row = db.sql.prepare('SELECT id, product_name AS name, product_slug AS slug FROM products WHERE is_active = 1 AND category_slug = ? ORDER BY id LIMIT 1').get(cat.slug);
  const path = `/product/${row.slug}-${row.id}/`;
  assert.equal((await fetchPage(site, env, path)).status, 200, 'listed: the normal page');
  db.sql.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(row.id);
  const r = await fetchPage(site, env, path);
  const category = site.categories.find(c => c.slug === cat.slug);
  const ids = checkGonePage(r, row, category.name);
  const cats = new Set(ids.map(id => db.sql.prepare('SELECT category_slug FROM products WHERE id = ?').get(id).category_slug));
  assert.deepEqual([...cats], [cat.slug], 'the similar products come from the same category');
  // An old address with another name still opens the same page (the id decides).
  assert.equal((await fetchPage(site, env, `/product/an-old-name-${row.id}/`)).status, 404);
  assert.ok((await fetchPage(site, env, `/product/an-old-name-${row.id}/`)).html.includes('data-gone="1"'));
  // A product that never existed: the plain "Page not found".
  const none = await fetchPage(site, env, '/product/nothing-here-987654321/');
  assert.equal(none.status, 404);
  assert.ok(!none.html.includes('data-gone') && none.html.includes('<h1>Page not found</h1>'));
});

test('GGW (older layout): the same page from the old columns', async () => {
  const site = (await import('../../sites/ggw/site.config.js')).default;
  const db = memD1(['tests/fixtures/ggw-legacy-schema.sql', 'tests/fixtures/ggw-seed.sql']);
  const env = { DB: db, CLICK_LOG: 'off' };
  // The older layout keeps the category name (site_category); the site config maps names to the category pages.
  const names = slug => (site.database.categories[slug] || []);
  const inCat = slug => `SELECT %s FROM products WHERE is_active = 1 AND site_category IN (${names(slug).map(() => '?').join(', ') || "''"})`;
  const cat = site.categories.find(c => names(c.slug).length && db.sql.prepare(inCat(c.slug).replace('%s', 'COUNT(*) AS n')).get(...names(c.slug)).n > 3);
  assert.ok(cat, 'a category with products in the test data');
  const row = db.sql.prepare(inCat(cat.slug).replace('%s', 'id, product_name AS name') + ' ORDER BY id LIMIT 1').get(...names(cat.slug));
  db.sql.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(row.id);
  const r = await fetchPage(site, env, `/product/${legacySlug(row.name)}-${row.id}/`);
  checkGonePage(r, row, cat.name);
});

test('the two texts of the page are in the 130 dictionaries, translated', () => {
  for (const c of CODES) {
    for (const lang of LANGS) {
      const d = JSON.parse(readFileSync(`sites/${c}/public/assets/i18n/${lang}.json`, 'utf8'));
      for (const k of NEW_TEXTS) assert.ok(d[k] && d[k].trim() && d[k] !== k, `${c}/${lang}: "${k}"`);
      for (const k of ['Similar products', 'Browse all categories']) assert.ok(d[k], `${c}/${lang}: "${k}"`);
    }
  }
});

// ---------- the database is busy (lessons L112) ----------

function memCache() {
  const m = new Map();
  return {
    m,
    match: async req => { const r = m.get(req.url); return r ? r.clone() : undefined; },
    put: async (req, res) => { m.set(req.url, res.clone()); },
    delete: async req => m.delete(req.url)
  };
}
const waits = [];
const ctxW = { waitUntil: p => waits.push(p) };
const settle = async () => { await Promise.all(waits.splice(0)); };

test('isDbBusy: only a D1 that cannot answer for a while, never a mistake in the code', () => {
  assert.ok(isDbBusy(new Error('D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window')));
  assert.ok(isDbBusy(new Error('D1_ERROR: Currently processing a long-running import.')));
  assert.ok(isDbBusy(new Error('D1_ERROR: Network connection lost.')));
  assert.ok(!isDbBusy(new Error('D1_ERROR: no such column: active at offset 11: SQLITE_ERROR')));
  assert.ok(!isDbBusy(new Error('TypeError: x is undefined')));
  assert.ok(!isDbBusy(null));
  assert.equal(spareKeyUrl('https://technologygearworld.com/category/audio/?page=2&v=gb'), 'https://technologygearworld.com/__gw-spare/category/audio/?page=2&v=gb');
});

test('a page keeps a spare copy for a day; when the database is busy the visitor gets it instead of the error page', async () => {
  const store = memCache();
  const before = globalThis.caches;
  globalThis.caches = { default: store };
  try {
    const url = 'https://technologygearworld.com/category/audio/';
    const req = new Request(url);
    const page = () => new Response('<h1>Audio</h1>', { status: 200, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
    const first = await withEdgeCache(req, ctxW, async () => page(), {}, url);
    assert.equal(await first.text(), '<h1>Audio</h1>');
    await settle();
    assert.ok(store.m.has(url) && store.m.has(spareKeyUrl(url)), 'the page and its spare copy');
    assert.equal(store.m.get(spareKeyUrl(url)).headers.get('Cache-Control'), `public, max-age=${SPARE_SECONDS}`);
    assert.equal(store.m.get(url).headers.get('Cache-Control'), 'public, max-age=60, s-maxage=300', 'the normal copy as before');
    // Five minutes later the normal copy is gone and an import is running on the database.
    store.m.delete(url);
    const busy = await withEdgeCache(req, ctxW, async () => { throw new Error('D1_ERROR: Currently processing a long-running import.'); }, {}, url);
    assert.equal(busy.status, 200);
    assert.equal(await busy.text(), '<h1>Audio</h1>');
    assert.equal(busy.headers.get('X-GW-Spare'), '1');
    assert.equal(busy.headers.get('Cache-Control'), 'no-store', 'the browser does not keep the spare copy');
    // A mistake in the code is never hidden behind the spare copy.
    await assert.rejects(withEdgeCache(req, ctxW, async () => { throw new Error('D1_ERROR: no such table: products'); }, {}, url), /no such table/);
    // No spare copy (a page nobody opened today): the error goes on to the error page as before.
    const other = 'https://technologygearworld.com/category/tv/';
    await assert.rejects(withEdgeCache(new Request(other), ctxW, async () => { throw new Error('D1_ERROR: D1 DB is overloaded.'); }, {}, other), /overloaded/);
    // A 404 never fills the cache or the spare copy.
    const nf = 'https://technologygearworld.com/product/x-1/';
    await withEdgeCache(new Request(nf), ctxW, async () => new Response('gone', { status: 404 }), {}, nf);
    await settle();
    assert.ok(!store.m.has(nf) && !store.m.has(spareKeyUrl(nf)));
  } finally { globalThis.caches = before; }
});

test('the sitemaps are read from the database at most once per data centre and hour', async () => {
  const site = (await import('../../sites/tgw/site.config.js')).default;
  const migrations = readdirSync('sites/tgw/migrations').filter(f => f.endsWith('.sql')).sort().map(f => `sites/tgw/migrations/${f}`);
  const db = memD1([...migrations, 'tests/fixtures/tgw-seed.sql']);
  let reads = 0;
  const counted = { prepare: t => { reads++; return db.prepare(t); }, batch: db.batch };
  const env = { DB: counted, CLICK_LOG: 'off', FX_FETCH: async () => new Response('[]') };
  const store = memCache();
  const before = globalThis.caches;
  globalThis.caches = { default: store };
  try {
    const w = createWorker(site);
    for (const p of ['/sitemap.xml', '/sitemap-static.xml', '/sitemap-products-1.xml']) {
      const a = await w.fetch(new Request(`https://${site.domain}${p}`, { headers: { 'User-Agent': 'Googlebot' } }), env, ctxW);
      assert.equal(a.status, 200, p);
      const body = await a.text();
      await settle();
      const n = reads;
      const b = await w.fetch(new Request(`https://${site.domain}${p}?x=1`, { headers: { 'User-Agent': 'Googlebot' } }), env, ctxW);
      assert.equal(await b.text(), body, `${p}: the same answer`);
      assert.equal(reads, n, `${p}: the second fetch read nothing from D1`);
      assert.equal(b.headers.get('Cache-Control'), a.headers.get('Cache-Control'), `${p}: the visitor gets the usual headers`);
    }
  } finally { globalThis.caches = before; }
});
