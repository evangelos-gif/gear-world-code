// Kids' Gear World on the engine (lessons L28, L33).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { legacySlug } from '../../src/db.js';
import { themedFiles } from '../../tools/theme-site.mjs';
import site from '../../sites/kgw/site.config.js';

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('tests/fixtures/ggw-legacy-schema.sql', 'utf8'));
  sql.exec(readFileSync('tests/fixtures/kgw-seed.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const worker = createWorker(site);
const get = (path, env) => worker.fetch(new Request(`https://kidsgearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });

test('the 10 old category names each have their own page with their products', async () => {
  const env = { DB: fakeD1() };
  const names = Object.values(site.database.categories).flat();
  assert.equal(names.length, 10);
  for (const c of site.categories) {
    const r = await get(`/category/${c.slug}/`, env);
    assert.equal(r.status, 200, c.slug);
    assert.match(await r.text(), /\/product\/[a-z0-9-]+-\d+\//, `${c.slug} lists products`);
  }
});

test('product addresses stay the old ones: whole name, no length limit, then the id', async () => {
  const env = { DB: fakeD1() };
  const row = env.DB.sql.prepare("SELECT id, product_name, product_slug FROM products WHERE product_name LIKE '%Balance Bike%'").get();
  // The stored slug was cut at 100 characters; the old site's address used the whole name.
  assert.ok(row.product_slug.length <= 100 && legacySlug(row.product_name).length > 100);
  const path = `/product/${legacySlug(row.product_name)}-${row.id}/`;
  assert.equal((await get(path, env)).status, 200);
  const short = await get(`/product/${row.product_slug}-${row.id}/`, env);
  assert.equal(short.status, 301);
  assert.equal(new URL(short.headers.get('location')).pathname, path);
});

test('Gifts for Kids keeps the old gift category and adds gifts from toys, tech and accessories', async () => {
  const env = { DB: fakeD1() };
  const html = await (await get('/category/gifts-for-kids/', env)).text();
  assert.match(html, /Science Kit Gift Set|Craft Gift Box/);
});

test('stock written as "1" (Joybuy) or "in stock" (InStock) counts as in stock; Joybuy is shown by its usual name', async () => {
  const env = { DB: fakeD1() };
  const api = await (await get(`/api/products?retailer=${encodeURIComponent('Joybuy')}&limit=5`, env)).json();
  assert.ok(api.products.length > 0 && api.products.every(p => p.retailer === 'Joybuy'));
  assert.ok(api.products.some(p => p.stock_status === 'in_stock'));
  const instock = await (await get(`/api/products?retailer=${encodeURIComponent('InStock UK')}&limit=5`, env)).json();
  assert.ok(instock.products.some(p => p.stock_status === 'in_stock'));
  const home = await (await get('/', env)).text();
  assert.ok(!/Joybuy UK/.test(home.replace(/<a[^>]*\/go\/[^>]*>[\s\S]*?<\/a>/g, '')));
});

test('worldwide wording, own hero photo and logo, and the TGW front-end files recoloured', async () => {
  const home = await (await get('/', { DB: fakeD1() })).text();
  assert.ok(!/UK retailers/i.test(home), 'no "UK retailers" in the page (the sites are worldwide)');
  assert.match(home, /img\/hero-1672\.webp/);
  assert.ok(!/kgw-hero|mgw-hero/.test(home));
  assert.match(home, /aria-label="Kids' Gear World home"|Kids&#39; Gear World home/);
  const files = await themedFiles('kgw');
  for (const [name, content] of Object.entries(files)) {
    assert.ok(Buffer.compare(readFileSync(`sites/kgw/public/assets/${name}`), Buffer.from(content)) === 0, `${name} is out of date`);
  }
});

test('tidy step on KGW: InStock names lose the size/colour of the kept card, no product is hidden as "other site"', async () => {
  const { plan, rowsSql } = await import('../../tools/cleanup-rules/tidy.mjs');
  const env = { DB: fakeD1() };
  assert.equal(env.DB.sql.prepare(rowsSql('kgw', 'gender')).all().length, 0);
  const names = env.DB.sql.prepare(rowsSql('kgw', 'names')).all();
  assert.ok(names.length > 0);
  const p = plan('kgw', names, [{ id: 1, retailer: 'InStock UK', site_category: 'Clothing', product_name: "Women's Tee" }]);
  assert.equal(p.hide.length, 0);
  assert.ok(p.rename.some(r => / - \d-\d Years \/ Navy$/.test(r.from) && !/ \/ /.test(r.to)));
});

test('a hidden size/colour card of InStock goes (301) to the card of the same product that stays; others stay 404', async () => {
  const env = { DB: fakeD1() };
  const link = (h, v) => `https://www.awin1.com/cread.php?awinmid=1&awinaffid=3057233&ued=https%3A%2F%2Finstock.net%2Fproducts%2F${h}%3Fvariant%3D${v}`;
  const add = env.DB.sql.prepare(`INSERT INTO products (awin_product_id, retailer, site_category, product_name, price, currency, stock_status, affiliate_url, is_active)
    VALUES (?, 'InStock UK', 'Clothing', ?, ?, 'GBP', 'in stock', ?, ?)`);
  const kept = Number(add.run('a1', 'Acme Fleece', 10, link('acme-fleece', 1), 1).lastInsertRowid);
  const hidden = Number(add.run('a2', 'Acme Fleece - 9-10 Years / Red', 12, link('acme-fleece', 2), 0).lastInsertRowid);
  const alone = Number(add.run('a3', 'Acme Medicine', 5, link('acme-medicine', 3), 0).lastInsertRowid);
  const r = await get(`/product/acme-fleece-9-10-years-red-${hidden}/`, env);
  assert.equal(r.status, 301);
  assert.equal(new URL(r.headers.get('location')).pathname, `/product/acme-fleece-${kept}/`);
  assert.equal((await get(`/product/acme-medicine-${alone}/`, env)).status, 404);
});
