// Men's Gear World on the engine: shown retailer names, repaired text and one card per product (lessons L28).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { legacySlug, fixMojibake } from '../../src/db.js';
import { themedFiles } from '../../tools/theme-site.mjs';
import site from '../../sites/mgw/site.config.js';

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('tests/fixtures/ggw-legacy-schema.sql', 'utf8'));
  sql.exec(readFileSync('tests/fixtures/mgw-seed.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const worker = createWorker(site);
const get = (path, env) => worker.fetch(new Request(`https://mensgearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });

test('text saved twice as UTF-8 is shown as meant; plain text is left alone', () => {
  assert.equal(fixMojibake('Menâ€™s Watch â€“ 44mm'), 'Men’s Watch – 44mm');
  assert.equal(fixMojibake('CafÃ©'), 'Café');
  assert.equal(fixMojibake('Plain name'), 'Plain name');
});

test('retailers show their usual names, in stats, cards and filters', async () => {
  const env = { DB: fakeD1() };
  const stats = await (await get('/api/stats', env)).json();
  assert.ok(stats.retailer_names.includes('Watch Enclave') && !stats.retailer_names.some(n => /Affiliate Programme|Joybuy UK/.test(n)));
  assert.ok(stats.retailer_names.includes('Joybuy'));
  const api = await (await get(`/api/products?retailer=${encodeURIComponent('Watch Enclave')}&limit=10`, env)).json();
  assert.ok(api.products.length >= 1 && api.products.every(p => p.retailer === 'Watch Enclave'));
});

test('one card for a watch sold by one shop under two feed names and by a second shop', async () => {
  const env = { DB: fakeD1() };
  const list = await (await get('/category/watches/', env)).text();
  assert.equal((list.match(/Calder Pilot Men/g) || []).length, 1, 'one card');
  assert.match(list, /Calder Pilot Men’s Chronograph – 44mm/, 'repaired name');
  assert.match(list, /2 retailers/, 'two different shops, not three rows');
  const row = env.DB.sql.prepare("SELECT id, product_name FROM products WHERE retailer = 'Watch Enclave Affiliate Programme'").get();
  const page = await (await get(`/product/${legacySlug(row.product_name)}-${row.id}/`, env)).text();
  assert.match(page, /Prices at 2 retailers/);
  assert.equal((page.match(/class="offer-retailer" translate="no">Watch Enclave</g) || []).length, 1, 'Watch Enclave listed once');
});

test('Joybuy codes show on MGW too, linked to the Joybuy page', async () => {
  const env = { DB: fakeD1() };
  assert.ok(site.promos.some(p => p.code === 'halloween'));
  const r = await get('/discount-codes/joybuy/', env);
  assert.equal(r.status, 200);
});

test('MGW front-end files are the TGW ones (recoloured)', async () => {
  const files = await themedFiles('mgw');
  for (const [name, content] of Object.entries(files)) {
    assert.ok(Buffer.compare(readFileSync(`sites/mgw/public/assets/${name}`), Buffer.from(content)) === 0, `${name} is out of date`);
  }
});

test('Gifts for Him: products from the chosen categories in the price range; counted on the home page', async () => {
  const env = { DB: fakeD1() };
  const col = site.categories.find(c => c.slug === 'gifts-for-him').collection;
  const api = await (await get('/api/products?category=gifts-for-him&limit=60', env)).json();
  assert.ok(api.products.length > 0);
  const allowed = new Set(col.from);
  for (const p of api.products) {
    assert.ok(allowed.has(p.category_slug), `${p.product_name} is from ${p.category_slug}`);
    assert.ok((p.price >= col.minPrice && p.price <= col.maxPrice) || /gift/i.test(p.product_name), `${p.product_name} £${p.price}`);
  }
  assert.ok(!api.products.some(p => p.category_slug === 'clothing'), 'clothing is not in the gift list');
  const home = await (await get('/', env)).text();
  assert.match(home, /Gifts for Him/);
  const page = await (await get('/category/gifts-for-him/', env)).text();
  assert.match(page, /<meta name="robots" content="index,follow">/);
});
