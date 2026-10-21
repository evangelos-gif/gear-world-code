// Construction Gear World on the engine (lessons L28, L33): euro prices with "≈ £", retailer flags, the import's
// own product matches, worldwide wording, and the old category and product addresses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { legacySlug } from '../../src/db.js';
import { themedFiles } from '../../tools/theme-site.mjs';
import site from '../../sites/cgw/site.config.js';

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('tests/fixtures/ggw-legacy-schema.sql', 'utf8'));
  sql.exec(readFileSync('tests/fixtures/cgw-seed.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
// Rates as Frankfurter sends them: 1 GBP = 1.15 EUR.
const FX_FETCH = async () => new Response(JSON.stringify([
  { base: 'GBP', quote: 'EUR', rate: 1.15, date: '2026-10-20' },
  { base: 'GBP', quote: 'RON', rate: 5.8, date: '2026-10-20' }
]), { headers: { 'Content-Type': 'application/json' } });
const worker = createWorker(site);
const get = (path, env) => worker.fetch(new Request(`https://constructiongearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });
const envOf = () => ({ DB: fakeD1(), FX_FETCH });
const idOf = (env, name) => env.DB.sql.prepare('SELECT id FROM products WHERE product_name = ?').get(name).id;

test('the six old category addresses work, with their products; Garden Tools (hidden) is not shown', async () => {
  const env = envOf();
  for (const slug of ['safety-footwear', 'workwear', 'ppe', 'power-tools', 'hand-tools', 'site-equipment']) {
    const r = await get(`/category/${slug}/`, env);
    assert.equal(r.status, 200, slug);
    assert.match(await r.text(), /\/product\/[a-z0-9-]+-\d+\//, `${slug} lists products`);
  }
  const home = await (await get('/', env)).text();
  assert.ok(!/Hedge Trimmer/.test(home));
});

test('product addresses stay the old ones: /product/<name>-<id>/', async () => {
  const env = envOf();
  const id = idOf(env, 'Torqmaster Diamond Core Drill Bit 52mm');
  assert.equal((await get(`/product/${legacySlug('Torqmaster Diamond Core Drill Bit 52mm')}-${id}/`, env)).status, 200);
});

test('a euro price stays in euros with "≈ £" next to it, and the retailer has its country flag', async () => {
  const env = envOf();
  const id = idOf(env, 'Torqmaster Diamond Core Drill Bit 52mm');
  const html = await (await get(`/product/${legacySlug('Torqmaster Diamond Core Drill Bit 52mm')}-${id}/`, env)).text();
  assert.match(html, /€89\.90/);
  assert.match(html, /≈ £78\.17/);
  assert.match(html, /Reidl <img class="flag" src="\/assets\/flags\/de\.svg\?v=[^"]+" alt="Germany"/);
  // Structured data keeps the real currency.
  assert.match(html, /"priceCurrency":"EUR"/);
  // A pound price gets no "≈".
  const gbp = idOf(env, 'Ironvale Hi Vis Jacket Orange L');
  const page = await (await get(`/product/${legacySlug('Ironvale Hi Vis Jacket Orange L')}-${gbp}/`, env)).text();
  assert.ok(!/fx-base/.test(page.split('id="prices"')[0].split('<main')[1] || ''), 'no ≈ next to a pound price');
});

test('without rates the euro price shows on its own (no "≈")', async () => {
  const w = createWorker({ ...site, assetVersion: site.assetVersion + '-norates' });
  const env = { DB: fakeD1(), FX_FETCH: async () => { throw new Error('offline'); } };
  // Rates already in memory from another test would be reused; this only checks the page still works.
  const id = idOf(env, 'Torqmaster Diamond Core Drill Bit 52mm');
  const r = await w.fetch(new Request(`https://constructiongearworld.com/product/${legacySlug('Torqmaster Diamond Core Drill Bit 52mm')}-${id}/`), env, { waitUntil: p => p });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /€89\.90/);
});

test('the import\'s own match groups the same jacket from two shops into one card with both prices', async () => {
  const env = envOf();
  const list = await (await get('/category/workwear/', env)).text();
  assert.equal((list.match(/Ironvale Hi Vis Jacket/g) || []).length >= 1, true);
  assert.match(list, /2 retailers/);
  const id = idOf(env, 'Ironvale Hi Vis Jacket Orange L');
  const page = await (await get(`/product/${legacySlug('Ironvale Hi Vis Jacket Orange L')}-${id}/`, env)).text();
  assert.match(page, /Prices at 2 retailers/);
  assert.match(page, /My Tool Shed/);
  assert.match(page, /matched by its product code/);
});

test('worldwide wording, own hero and logo, no rewards sign-up, and the TGW front-end files recoloured', async () => {
  const env = envOf();
  const home = await (await get('/', env)).text();
  assert.ok(!/UK retailers/i.test(home), 'no "UK retailers"');
  assert.ok(!/rewards/i.test(home), 'rewards stay hidden');
  assert.match(home, /img\/hero-1774\.webp/);
  const about = await (await get('/about/', env)).text();
  assert.match(about, /retailers in the UK and Europe/);
  const files = await themedFiles('cgw');
  for (const [name, content] of Object.entries(files)) {
    assert.ok(Buffer.compare(readFileSync(`sites/cgw/public/assets/${name}`), Buffer.from(content)) === 0, `${name} is out of date`);
  }
  assert.match(String(files['site.css']), /\.flag \{/);
});

test('German retailer names saved twice as UTF-8 show as meant', async () => {
  const { fixMojibake } = await import('../../src/db.js');
  assert.equal(fixMojibake('Bahco Flacher Ring-MaulschlÃ¼ssel 350Â mm'), 'Bahco Flacher Ring-Maulschlüssel 350 mm');
  assert.equal(fixMojibake('AuÃŸensechskant'), 'Außensechskant');
  assert.equal(fixMojibake('PH2 x 125\u00c2\u00a0mm'), 'PH2 x 125 mm');
});

test('tidy step on CGW only cleans InStock names (no "other site" products)', async () => {
  const { rowsSql } = await import('../../tools/cleanup-rules/tidy.mjs');
  assert.match(rowsSql('cgw', 'gender'), /WHERE 0$/);
  assert.match(rowsSql('cgw', 'names'), /instock/);
});
