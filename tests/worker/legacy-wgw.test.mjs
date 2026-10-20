// Women's Gear World on the engine (lessons L28, L33).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { themedFiles } from '../../tools/theme-site.mjs';
import site from '../../sites/wgw/site.config.js';

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('tests/fixtures/ggw-legacy-schema.sql', 'utf8'));
  sql.exec(readFileSync('tests/fixtures/wgw-seed.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const worker = createWorker(site);
const get = (path, env) => worker.fetch(new Request(`https://womensgearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });

test('two old category names on one page: watches include "Jewellery & Watches", bags include "Bags"', async () => {
  const env = { DB: fakeD1() };
  const watches = await (await get('/category/watches/', env)).text();
  assert.match(watches, /Silver Mesh Watch 30mm/);
  const bags = await (await get('/category/bags-accessories/', env)).text();
  assert.match(bags, /Canvas Shopper Bag/);
});

test('stock written as "1" counts as in stock', async () => {
  const env = { DB: fakeD1() };
  const api = await (await get(`/api/products?retailer=${encodeURIComponent('Philip Jones Jewellery')}&limit=5`, env)).json();
  assert.ok(api.products.length > 0 && api.products.every(p => p.stock_status === 'in_stock'));
});

test('no hero photo of another site (lessons L13), own logo, and the TGW front-end files recoloured', async () => {
  const home = await (await get('/', { DB: fakeD1() })).text();
  assert.ok(!/mgw-hero|hero-img/.test(home));
  assert.match(home, /aria-label="Women's Gear World home"|Women&#39;s Gear World home/);
  const files = await themedFiles('wgw');
  for (const [name, content] of Object.entries(files)) {
    assert.ok(Buffer.compare(readFileSync(`sites/wgw/public/assets/${name}`), Buffer.from(content)) === 0, `${name} is out of date`);
  }
});
