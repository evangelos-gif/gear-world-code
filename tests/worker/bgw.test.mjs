// Biker Gear World (BGW): new site with its own database (sites/bgw/migrations), 10 categories, worldwide wording,
// euro prices with "≈ £", "Delivers to" on cards and pages (L62), the same product at two retailers on one card,
// the UK rule for private e-scooters on the Electric Scooters page, and clickref bgw-<id>.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { themedFiles } from '../../tools/theme-site.mjs';
import site from '../../sites/bgw/site.config.js';

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('sites/bgw/migrations/0001_init.sql', 'utf8'));
  sql.exec(readFileSync('tests/fixtures/bgw-seed.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const FX_FETCH = async () => new Response(JSON.stringify([
  { base: 'GBP', quote: 'EUR', rate: 1.15, date: '2026-10-20' }
]), { headers: { 'Content-Type': 'application/json' } });
const worker = createWorker(site);
const get = (path, env) => worker.fetch(new Request(`https://bikergearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });
const envOf = () => ({ DB: fakeD1(), FX_FETCH, CLICK_LOG: 'off' });

test('code BGW, 10 categories with their photos, and no other site\'s name in the config', () => {
  assert.equal(site.code, 'BGW');
  assert.equal(site.domain, 'bikergearworld.com');
  assert.equal(site.categories.length, 10);
  for (const c of site.categories) assert.ok(readFileSync(`sites/bgw/public/assets/img/cat-${c.slug}.webp`).length > 1000, c.slug);
  assert.ok(site.foreignMarkers.includes('SGW') && site.foreignMarkers.includes('Sporty Gear'), 'bicycles stay on Sporty Gear World');
});

test('every category page works and lists products', async () => {
  const env = envOf();
  for (const c of site.categories) {
    const r = await get(`/category/${c.slug}/`, env);
    assert.equal(r.status, 200, c.slug);
    assert.match(await r.text(), /\/product\/[a-z0-9-]+-\d+\//, `${c.slug} lists products`);
  }
});

test('UK and Europe wording: no "UK retailers" on the home or about page', async () => {
  const env = envOf();
  const home = await (await get('/', env)).text();
  assert.ok(!/UK retailers/i.test(home));
  assert.match(home, /retailers in the UK and Europe/);
  const about = await (await get('/about/', env)).text();
  assert.match(about, /retailers in the UK and Europe/);
});

test('a euro price stays in euros with "≈ £"', async () => {
  const env = envOf();
  const row = env.DB.sql.prepare("SELECT id, product_slug FROM products WHERE currency = 'EUR' AND in_stock = 1 LIMIT 1").get();
  const html = await (await get(`/product/${row.product_slug}-${row.id}/`, env)).text();
  assert.match(html, /€\d/);
  assert.match(html, /≈ £\d/);
  assert.match(html, /"priceCurrency":"EUR"/);
});

test('cards and product pages say where the retailer delivers (lessons L62)', async () => {
  const env = envOf();
  const home = await (await get('/', env)).text();
  assert.match(home, /<span class="ship-word">Delivers to<\/span>:/);
  const row = env.DB.sql.prepare("SELECT id, product_slug FROM products WHERE in_stock = 1 LIMIT 1").get();
  const page = await (await get(`/product/${row.product_slug}-${row.id}/`, env)).text();
  assert.match(page, /<dt>Delivers to<\/dt><dd class="ship-dd">[\s\S]*?data-country="GB"/);
});

test('the Electric Scooters page says the UK rule for private e-scooters; other category pages do not', async () => {
  const env = envOf();
  const es = await (await get('/category/electric-scooters/', env)).text();
  assert.match(es, /<p class="category-note">In the UK, a privately owned e-scooter may only be ridden on private land/);
  const kick = await (await get('/category/kick-scooters/', env)).text();
  assert.ok(!/category-note/.test(kick.replace(/<style[\s\S]*?<\/style>/g, '')));
});

test('no discount codes until a retailer sends one for this site (lessons L32)', () => {
  for (const p of site.promos) assert.match(p.end, /^\d{4}-\d{2}-\d{2}$/);
});

test('the same paddock stand (same EAN) at two retailers: one card, two prices on its page', async () => {
  const env = envOf();
  const list = await (await get('/category/parts-maintenance/', env)).text();
  assert.equal((list.match(/Front Paddock Stand<\/a>/g) || []).length <= 1, true);
  assert.match(list, /2 retailers/);
  const row = env.DB.sql.prepare("SELECT id, product_slug FROM products WHERE product_name LIKE '%Front Paddock Stand%' AND in_stock = 1").get();
  const page = await (await get(`/product/${row.product_slug}-${row.id}/`, env)).text();
  assert.match(page, /Prices at 2 retailers/);
});

test('buy buttons go through /out/<id> to Awin with clickref bgw-<id>', async () => {
  const env = envOf();
  const r = await get('/out/1', env);
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /^https:\/\/www\.awin1\.com\/.*clickref=bgw-1$/);
});

test('front-end files are the TGW ones recoloured (run: node tools/theme-site.mjs bgw)', async () => {
  const files = await themedFiles('bgw');
  for (const [name, content] of Object.entries(files)) {
    assert.ok(Buffer.compare(readFileSync(`sites/bgw/public/assets/${name}`), Buffer.from(content)) === 0, `${name} is out of date`);
  }
  const css = String(files['site.css']);
  assert.match(css, /--gold: #c39bff/);
  assert.ok(!/#f2b84b|#0a1222/i.test(css), 'no TGW colour left');
});

test('colour-blind safe colours (lessons L35): no red or green signal colours left, strong contrast', async () => {
  const css = String((await themedFiles('bgw'))['site.css']);
  for (const c of ['#d7263d', '#1d7a43', '#5ee08f', '#ff8a98', '#ff5a4e']) assert.ok(!css.toLowerCase().includes(c), `${c} left in the stylesheet`);
  const lum = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const v = name => css.match(new RegExp(`--${name}: (#[0-9a-f]{6})`, 'i'))[1];
  assert.ok(ratio(v('text'), v('page')) >= 7, 'text on the page');
  assert.ok(ratio(v('gold'), v('page')) >= 4.5, 'accent on the page');
  assert.ok(ratio(v('link'), v('page')) >= 4.5, 'links on the page');
  assert.ok(ratio(v('ink'), v('surface')) >= 7, 'text on cards');
  assert.ok(ratio(v('ink-link'), v('surface')) >= 4.5, 'links on cards');
  assert.ok(ratio('#ffffff', v('tag')) >= 4.5, 'white text on the price-drop tag');
  assert.ok(ratio(v('ok'), v('surface')) >= 4.5, '"in stock" on cards');
});
