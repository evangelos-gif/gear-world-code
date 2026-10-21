// Home Gear World on the engine (lessons L28, L33).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { legacySlug } from '../../src/db.js';
import { themedFiles } from '../../tools/theme-site.mjs';
import site from '../../sites/hgw/site.config.js';

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('tests/fixtures/ggw-legacy-schema.sql', 'utf8'));
  sql.exec(readFileSync('tests/fixtures/hgw-seed.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const worker = createWorker(site);
const get = (path, env) => worker.fetch(new Request(`https://homegearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });

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
  const row = env.DB.sql.prepare("SELECT id, product_name, product_slug FROM products WHERE product_name LIKE '%Extendable Dining Table%'").get();
  // The stored slug was cut at 100 characters; the old site's address used the whole name.
  assert.ok(row.product_slug.length <= 100 && legacySlug(row.product_name).length > 100);
  const path = `/product/${legacySlug(row.product_name)}-${row.id}/`;
  assert.equal((await get(path, env)).status, 200);
  const short = await get(`/product/${row.product_slug}-${row.id}/`, env);
  assert.equal(short.status, 301);
  assert.equal(new URL(short.headers.get('location')).pathname, path);
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

test('worldwide wording, own category photos and logo, and the TGW front-end files recoloured', async () => {
  const home = await (await get('/', { DB: fakeD1() })).text();
  assert.ok(!/UK retailers/i.test(home), 'no "UK retailers" in the page (the sites are worldwide)');
  assert.ok(!/-hero\.png|hero-1672/.test(home), 'no hero photo: the old one is a small banner with its logo printed on it');
  assert.match(home, /img\/cat-furniture\.webp/);
  assert.match(home, /aria-label="Home Gear World home"/);
  const files = await themedFiles('hgw');
  for (const [name, content] of Object.entries(files)) {
    assert.ok(Buffer.compare(readFileSync(`sites/hgw/public/assets/${name}`), Buffer.from(content)) === 0, `${name} is out of date`);
  }
});


test('an empty search tries the next translation until one finds products', async () => {
  const { AI_MODEL } = await import('../../src/lib/hub.js');
  const calls = [];
  const env = { DB: fakeD1(), AI: { run: async (model) => { calls.push(model); return { response: model === AI_MODEL ? 'chainsaw' : 'air fryer' }; } } };
  const api = await (await get(`/api/products?search=${encodeURIComponent('φριτέζα αέρος')}&limit=5`, env)).json();
  assert.ok(api.products.length > 0 && api.products.every(p => /Air Fryer/i.test(p.product_name)));
  assert.equal(calls.length, 2, 'the first answer found nothing, the second did, no third call');
  assert.equal(api.search_used, 'air fryer');
  assert.deepEqual(api.search_tried, ['chainsaw', 'air fryer']);
});
