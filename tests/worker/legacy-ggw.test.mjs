// Garden Gear World on the shared engine, reading the older database layout as it is (lessons L28, L29).
// Uses Node's built-in SQLite as a stand-in for D1, with the real legacy schema and synthetic products.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker, affiliateTarget } from '../../src/engine.js';
import { legacySlug, sharperImage } from '../../src/db.js';
import { themedFiles } from '../../tools/theme-site.mjs';
import site from '../../sites/ggw/site.config.js';
import tgw from '../../sites/tgw/site.config.js';

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('tests/fixtures/ggw-legacy-schema.sql', 'utf8'));
  sql.exec(readFileSync('tests/fixtures/ggw-seed.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}

const worker = createWorker(site);
const ctx = { waitUntil: p => p };
async function get(path, env, headers = {}) {
  return worker.fetch(new Request(`https://gardengearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test', ...headers } }), env, ctx);
}

test('legacy slug and sharper image follow the old site rules', () => {
  assert.equal(legacySlug('Thornbury Pro: 4-Prong Fork & Spade Set (Ash Handle) — 2 pcs'), 'thornbury-pro-4-prong-fork-spade-set-ash-handle-2-pcs');
  assert.equal(legacySlug(''), 'product');
  assert.equal(sharperImage('https://images2.productserve.com/?w=200&h=200&bg=white&url=x'), 'https://images2.productserve.com/?w=600&h=600&bg=white&url=x');
  assert.equal(sharperImage('https://example.com/a.jpg?w=200'), 'https://example.com/a.jpg?w=200');
});

test('home page counts every active product and marks empty categories "coming soon"', async () => {
  const env = { DB: fakeD1() };
  const r = await get('/', env);
  const body = await r.text();
  assert.equal(r.status, 200);
  assert.match(body, />60</);
  assert.match(body, /Coming soon/);
  assert.match(body, /30 products/);
});

test('product pages keep the old addresses; wrong slugs redirect to them', async () => {
  const env = { DB: fakeD1() };
  const row = env.DB.sql.prepare("SELECT id, product_name FROM products WHERE product_name LIKE 'Thornbury Pro%'").get();
  const path = `/product/${legacySlug(row.product_name)}-${row.id}/`;
  const ok = await get(path, env);
  assert.equal(ok.status, 200);
  const html = await ok.text();
  assert.match(html, /Test product used for automated checks/);
  assert.match(html, /href="\/out\/\d+" rel="sponsored nofollow/);
  const moved = await get(`/product/old-name-${row.id}/`, env);
  assert.equal(moved.status, 301);
  assert.equal(new URL(moved.headers.get('location')).pathname, path);
  const inactive = env.DB.sql.prepare('SELECT id, product_name FROM products WHERE is_active = 0').get();
  assert.equal((await get(`/product/${legacySlug(inactive.product_name)}-${inactive.id}/`, env)).status, 404);
});

test('a product whose old category has no page still opens', async () => {
  const env = { DB: fakeD1() };
  const row = env.DB.sql.prepare("SELECT id, product_name FROM products WHERE site_category = 'Old Category Name'").get();
  const r = await get(`/product/${legacySlug(row.product_name)}-${row.id}/`, env);
  assert.equal(r.status, 200);
});

test('category filter, stock text and pagination work on the old columns', async () => {
  const env = { DB: fakeD1() };
  const r = await get('/category/power-garden-tools/?page=2', env);
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.equal((html.match(/data-compare="\d+"/g) || []).length, 6);
  const api = await (await get('/api/products?category=power-garden-tools&limit=60&stock=1', env)).json();
  assert.ok(api.products.length > 0 && api.products.every(p => p.stock_status === 'in_stock'));
  assert.ok(api.products.length < 30, 'out of stock rows are filtered out');
});

test('/api/products keeps the fields Gear World Hub reads, with the old category name', async () => {
  const env = { DB: fakeD1() };
  const api = await (await get('/api/products?search=hose&page=1&limit=8', env)).json();
  assert.equal(api.ok, true);
  assert.ok(api.products.length > 0);
  for (const k of ['id', 'product_name', 'brand', 'retailer', 'site_category', 'subcategory', 'merchant_category', 'price', 'currency', 'stock_status', 'image_url']) {
    assert.ok(k in api.products[0], k);
  }
  assert.equal(api.products[0].site_category, 'Watering & Irrigation');
  // The Hub's own category name works as a filter too.
  const byName = await (await get(`/api/products?category=${encodeURIComponent('Garden Tools')}&limit=60`, env)).json();
  assert.ok(byName.products.length > 0 && byName.products.every(p => p.site_category === 'Garden Tools'));
});

test('/out/ turns plain retailer addresses into Awin links and logs the click in the old table', async () => {
  const env = { DB: fakeD1() };
  const row = env.DB.sql.prepare("SELECT id, affiliate_url, site_category FROM products WHERE retailer = 'Tooled Up' AND is_active = 1 ORDER BY id LIMIT 1").get();
  const r = await get(`/out/${row.id}`, env, { referer: 'https://gardengearworld.com/category/garden-tools/' });
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://www.awin1.com/cread.php');
  assert.equal(loc.searchParams.get('awinmid'), '496');
  assert.equal(loc.searchParams.get('awinaffid'), '3057233');
  assert.equal(loc.searchParams.get('clickref'), `ggw-${row.id}`);
  assert.equal(loc.searchParams.get('ued'), row.affiliate_url);
  const click = env.DB.sql.prepare('SELECT * FROM affiliate_clicks ORDER BY id DESC LIMIT 1').get();
  assert.equal(click.product_id, row.id);
  assert.equal(click.retailer, 'Tooled Up');
  assert.equal(click.site_category, row.site_category);
  assert.equal(click.page_path, '/category/garden-tools/');
  assert.equal(click.source, 'retailer_click');
  // A retailer without an Awin programme in the config keeps its address (and the QA gate lists it).
  const other = env.DB.sql.prepare("SELECT id FROM products WHERE retailer = 'Example Garden Shop'").get();
  assert.equal((await get(`/out/${other.id}`, env)).headers.get('location'), 'https://shop.example/garden-shop/kneeler');
  // An address that is already an Awin link only gets the clickref.
  const awin = env.DB.sql.prepare("SELECT id FROM products WHERE affiliate_url LIKE 'https://www.awin1.com/%'").get();
  assert.match((await get(`/out/${awin.id}`, env)).headers.get('location'), /^https:\/\/www\.awin1\.com\/pclick\.php\?p=890999&a=3057233&m=49385&clickref=ggw-\d+$/);
});

test('a preview Worker with CLICK_LOG=off redirects but records nothing', async () => {
  const env = { DB: fakeD1(), CLICK_LOG: 'off' };
  const r = await get('/out/1', env);
  assert.equal(r.status, 302);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM affiliate_clicks').get().n, 0);
});

test('affiliateTarget refuses bad addresses and leaves TGW Awin links as before', () => {
  assert.equal(affiliateTarget('javascript:alert(1)', 'Tooled Up', site.awin, 'x'), null);
  assert.equal(affiliateTarget('not a url', 'Tooled Up', site.awin, 'x'), null);
  const t = affiliateTarget('https://www.awin1.com/pclick.php?p=1&a=2&m=3', 'Joybuy', tgw.awin, 'tgw-1');
  assert.equal(t.toString(), 'https://www.awin1.com/pclick.php?p=1&a=2&m=3&clickref=tgw-1');
});

test('empty categories are noindex and left out of the sitemap; full ones are listed', async () => {
  const env = { DB: fakeD1() };
  const empty = await (await get('/category/bbq-outdoor-cooking/', env)).text();
  assert.match(empty, /<meta name="robots" content="noindex/);
  assert.match(empty, /data-empty-category/);
  const map = await (await get('/sitemap-static.xml', env)).text();
  assert.ok(!map.includes('/category/bbq-outdoor-cooking/'));
  assert.ok(map.includes('/category/garden-tools/'));
  const products = await (await get('/sitemap-products-1.xml', env)).text();
  assert.equal((products.match(/<loc>/g) || []).length, 60);
});

test('a search with no results asks the Hub for English words, once, on page 1', async () => {
  const calls = [];
  const env = {
    DB: fakeD1(),
    GW_INTERNAL_TOKEN: 'test-only',
    GW_HUB: { fetch: async req => { calls.push(await req.json()); return Response.json({ candidate: 'hose' }); } }
  };
  const r = await get('/search?q=' + encodeURIComponent('λάστιχο'), env);
  const html = await r.text();
  assert.deepEqual(calls, [{ q: 'λάστιχο' }]);
  assert.match(html, /Showing results for “hose”/);
  assert.match(html, /Garden Hose 30m/);
  const api = await (await get('/api/products?search=' + encodeURIComponent('λάστιχο'), env)).json();
  assert.ok(api.products.length > 0);
  // Not on page 2, not for short words, not without the binding.
  calls.length = 0;
  await get('/search?q=' + encodeURIComponent('λάστιχο') + '&page=2', env);
  await get('/search?q=xy', env);
  assert.equal(calls.length, 0);
  const plain = await (await get('/search?q=' + encodeURIComponent('λάστιχο'), { DB: fakeD1() })).text();
  assert.match(plain, /No products found/);
});

test('the Hub answer must look like plain search words', async () => {
  const env = {
    DB: fakeD1(),
    GW_INTERNAL_TOKEN: 'test-only',
    GW_HUB: { fetch: async () => Response.json({ candidate: '<script>' }) }
  };
  const html = await (await get('/search?q=' + encodeURIComponent('κάτι άλλο'), env)).text();
  assert.match(html, /No products found/);
});

test('no newsletter route and no clean-up on the older database', async () => {
  const env = { DB: fakeD1() };
  const before = env.DB.sql.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  await worker.scheduled({}, env);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM products').get().n, before);
  const post = await worker.fetch(new Request('https://gardengearworld.com/api/newsletter', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } }), env, ctx);
  assert.equal(post.status, 404);
});

test('GGW front-end files are the TGW ones (recoloured): run tools/theme-site.mjs ggw after changing TGW', async () => {
  const files = await themedFiles('ggw');
  for (const [name, content] of Object.entries(files)) {
    const actual = readFileSync(`sites/ggw/public/assets/${name}`);
    assert.ok(Buffer.compare(actual, Buffer.from(content)) === 0, `${name} is out of date`);
  }
  assert.ok(!/#0a1222|#1747d1/i.test(files['site.css']), 'no TGW navy left in the GGW stylesheet');
});

test('GGW config: every page category maps to an old category name, and the Awin retailers are named', () => {
  for (const c of site.categories) assert.ok((site.database.categories[c.slug] || []).length > 0, c.slug);
  assert.deepEqual(Object.keys(site.awin.advertisers).sort(), ['My Tool Shed', 'Tooled Up']);
});
