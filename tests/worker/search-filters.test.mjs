// Lessons L98: the search page lets the visitor pick a shop (and a brand), like a category page. Owner, 7 Nov 2026, on
// TGW "wireless mouse": "doesn't have feature to select by retailer". The search already obeyed ?retailer= and ?brand=;
// its page had no list to choose from, because the shops of a search were never read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import site from '../../sites/tgw/site.config.js';

const COLS = 'stable_key, awin_advertiser_id, awin_product_id, merchant_product_id, retailer, category_slug, subcategory, brand, product_name, product_slug, description, price, was_price, in_stock, item_condition, image_url, affiliate_url, merchant_category, gtin, mpn, specs_json, first_seen_at, last_seen_at';
// [shop, brand, name, price]: 30 mice at one shop (more than one page of 24), 3 and 1 at two others, and a keyboard.
const ROWS = [
  ...Array.from({ length: 30 }, (_, i) => ['PCHUB.UK', i % 2 ? 'Logitech' : 'Asus', `Wireless Mouse Model ${i + 1}`, 20 + i]),
  ['Back to the Office', 'Razer', 'Razer Basilisk V3 Pro Wireless Mouse', 149.99],
  ['Back to the Office', 'Logitech', 'Logitech MX Master 3S Wireless Mouse', 89.99],
  ['Back to the Office', 'Logitech', 'Logitech Lift Wireless Vertical Mouse', 59.99],
  ['Joybuy', 'GravaStar', 'GravaStar Mercury X Pro Wireless Gaming Mouse', 149.95],
  ['Joybuy', 'Cherry', 'Cherry KW 3000 Wireless Keyboard', 39.99]
];

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('sites/tgw/migrations/0001_init.sql', 'utf8'));
  const ins = sql.prepare(`INSERT INTO products (${COLS}) VALUES (${COLS.split(',').map(() => '?').join(',')})`);
  ROWS.forEach(([shop, brand, name, price], i) => ins.run(`98${i}:SF-${i}`, 98000 + i, String(980000 + i), `SF-${i}`, shop, 'accessories-storage', 'Mice', brand, name,
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name, price, null, 1, 'new', '', `https://www.awin1.com/pclick.php?p=${980000 + i}&a=0&m=98000`,
    'Mice', '', '', '{}', '2026-11-07 10:00:00', '2026-11-07 10:00:00'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const FX_FETCH = async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } });
const worker = createWorker(site);
const get = async path => (await worker.fetch(new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }),
  { DB: fakeD1(), FX_FETCH, CLICK_LOG: 'off' }, { waitUntil: p => p })).text();
const selectOf = (html, name) => {
  const m = html.match(new RegExp(`<select name="${name}"[^>]*>([\\s\\S]*?)</select>`));
  return m ? [...m[1].matchAll(/<option value="([^"]*)"([^>]*)>([^<]*)<\/option>/g)].map(o => ({ value: o[1], selected: /selected/.test(o[2]), label: o[3] })) : null;
};

test('a search lists its shops, most products first, with their numbers, and its brands', async () => {
  const html = await get('/search?q=wireless+mouse');
  const shops = selectOf(html, 'retailer');
  assert.ok(shops, 'a Retailer list on the search page');
  assert.deepEqual(shops.map(o => o.label), ['All retailers', 'PCHUB.UK (30)', 'Back to the Office (3)', 'Joybuy (1)']);
  assert.ok(shops[0].selected, 'all shops to start with');
  assert.match(html, /<input type="hidden" name="q" value="wireless mouse">/, 'the words stay when a shop is picked');
  const brands = selectOf(html, 'brand');
  assert.deepEqual(brands.slice(0, 3).map(o => o.label), ['All brands', 'Logitech (17)', 'Asus (15)']);
  assert.ok(!brands.some(o => o.label.startsWith('Cherry')), 'only the brands this search finds');
});

test('picking a shop shows only its products, keeps it chosen, and the next pages keep it too', async () => {
  const html = await get('/search?q=wireless+mouse&retailer=Back+to+the+Office');
  assert.match(html, />3 products</);
  for (const n of ['Razer Basilisk V3 Pro', 'Logitech MX Master 3S', 'Logitech Lift']) assert.ok(html.includes(n), n);
  assert.ok(!html.includes('Wireless Mouse Model 1<') && !html.includes('Mercury X Pro'), 'no product of another shop');
  assert.ok(selectOf(html, 'retailer').find(o => o.value === 'Back to the Office').selected);
  const many = await get('/search?q=wireless+mouse&retailer=PCHUB.UK');
  assert.match(many, />30 products<\/span>, <span[^>]*>page 1 of 2</);
  assert.match(many, /href="\/search\?q=wireless\+mouse&amp;retailer=PCHUB\.UK&amp;page=2"/);
});

test('no list when a search finds one shop only; a filter with no products offers "Clear all" back to the search', async () => {
  const one = await get('/search?q=keyboard');
  assert.equal(selectOf(one, 'retailer'), null, 'one shop: nothing to choose');
  const none = await get('/search?q=keyboard&retailer=PCHUB.UK');
  assert.match(none, /<h2>No products match these filters<\/h2>/);
  assert.match(none, /<a class="btn btn-quiet" href="\/search\?q=keyboard">Clear all<\/a>/);
  assert.ok(!/No products found for/.test(none));
});

// Every shop of the engine, with its own test products (the GGW kind of database too): the search page still opens.
const NOT_SHOPS = new Set(['group', 'gwh']);
for (const code of readdirSync('sites').filter(c => !NOT_SHOPS.has(c) && existsSync(`sites/${c}/site.config.js`))) {
  test(`${code.toUpperCase()}: the search page with its shop and brand lists opens`, async () => {
    const s = (await import(`../../sites/${code}/site.config.js`)).default;
    const sql = new DatabaseSync(':memory:');
    const legacy = s.database && s.database.layout === 'legacy';
    sql.exec(readFileSync(legacy ? 'tests/fixtures/ggw-legacy-schema.sql' : `sites/${code}/migrations/0001_init.sql`, 'utf8'));
    if (existsSync(`tests/fixtures/${code}-seed.sql`)) sql.exec(readFileSync(`tests/fixtures/${code}-seed.sql`, 'utf8'));
    const stmt = (text, args = []) => ({
      bind: (...a) => stmt(text, a),
      all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
      first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
      run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
    });
    const env = { DB: { prepare: t => stmt(t), batch: async l => Promise.all(l.map(x => x.all())) }, FX_FETCH, CLICK_LOG: 'off' };
    const word = (sql.prepare('SELECT product_name FROM products WHERE is_active = 1 LIMIT 1').get() || {}).product_name || 'drill';
    const q = encodeURIComponent(String(word).split(/\s+/)[0]);
    const res = await createWorker(s).fetch(new Request(`https://${s.domain}/search?q=${q}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<form class="filters" action="\/search"/);
  });
}
