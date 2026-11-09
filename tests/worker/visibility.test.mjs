// Lessons L107 (Google Ads compliance, 9 Nov 2026): a visitor sees only the retailers that deliver to their country, and
// only prices checked in the last 30 days ("Check price and stock at the retailer" after 14). These tests cover the
// country groups of every site, the page cache key per group, the notice page of a product the visitor may not see
// (200, noindex, no price, no button), /out/, the sitemaps and /api/stats in the UK view, the Hub's ?deliver_to=, the
// list "Below RRP", thin categories, and the D1 cost: with a view every hot query keeps the query plan it has
// without one (the extra term is a filter only), and "similar products" never walks further than without a view and
// shows exactly the first cards of the full filtered query.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import * as db from '../../src/db.js';
import { countryGroups, viewFor, homeView, visibleSql, hiddenReason, needsCheck, cacheKeyUrl, cleanCountry, useClock, needsUkBar,
  strictCountries, EU_COUNTRIES, OWN_VIEW_COUNTRIES, HIDE_AFTER_DAYS, CHECK_AFTER_DAYS } from '../../src/lib/visibility.js';
import { deliveryText, UK_BAR_TEXT } from '../../src/pages/layout.js';
import { toString } from '../../src/lib/html.js';
import { MIN_INDEXED_PRODUCTS } from '../../src/pages/listing.js';
import { TEST_DAY } from './test-clock.mjs';

const SITES = readdirSync('sites').filter(n => existsSync(`sites/${n}/site.config.js`) && existsSync(`sites/${n}/public/assets/site.js`));
const config = {};
for (const s of SITES) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const read = f => readFileSync(f, 'utf8');
const NOW = Date.parse(`${TEST_DAY}T12:00:00Z`);

test('country groups: the owner\'s delivery data (9 Nov 2026); the UK view for the UK, unknown and non-European countries', () => {
  const agw = config.agw;
  assert.deepEqual(agw.deliversTo, { default: ['GB'], retailers: { 'Pneus.be': ['BE'], VEVOR: ['EU', 'IS', 'LI', 'NO'] } });
  assert.deepEqual(config.vgw.deliversTo.retailers, { VEVOR: ['EU', 'IS', 'LI', 'NO'] });
  for (const s of ['cgw', 'bgw', 'pgw']) assert.deepEqual(config[s].deliversTo.retailers.VEVOR, ['EU', 'IS', 'LI', 'NO'], s);
  assert.deepEqual(config.cgw.deliversTo.retailers.Reidl, ['DE', 'AT']);
  assert.deepEqual(config.wgw.deliversTo.retailers['100% PURE'], ['EU', 'CH', 'NO']);
  for (const s of SITES) assert.ok(config[s].deliversTo, `${s}: deliversTo`);
  const g = cc => viewFor(agw, cc, NOW);
  assert.equal(g('GB').group, 'gb');
  assert.deepEqual(g('GB').hidden, ['Pneus.be', 'VEVOR']);
  assert.equal(g('GB').only, null);
  for (const cc of ['US', 'CA', 'AU', 'JP', '', 'XX', 'T1', 'gbr', null, undefined]) assert.equal(g(cc).group, 'gb', `${cc}: the UK view`);
  assert.equal(g('BE').group, 'be');
  assert.deepEqual(g('BE').only, ['Pneus.be', 'VEVOR']);
  assert.equal(g('BE').hidden, null);
  // Every other EU / EEA country: VEVOR only. Switzerland: no retailer of AGW delivers there, so the UK view.
  const eu = g('NL').group;
  assert.match(eu, /^eu-[0-9a-f]{6}$/);
  for (const cc of [...EU_COUNTRIES.filter(c => c !== 'BE'), 'IS', 'LI', 'NO']) {
    assert.equal(g(cc).group, eu, cc);
    assert.deepEqual(g(cc).only, ['VEVOR'], cc);
  }
  assert.equal(g('CH').group, 'gb');
  // Construction: Reidl to Germany and Austria; VEVOR the EEA; GRABO worldwide (it is in every view).
  const c = cc => viewFor(config.cgw, cc, NOW);
  assert.deepEqual(c('GB').hidden, ['Reidl', 'VEVOR']);
  assert.equal(c('DE').group, 'at-de');
  assert.deepEqual(c('AT').only, ['GRABO', 'Reidl', 'VEVOR']);
  assert.deepEqual(c('FR').only, ['GRABO', 'VEVOR']);
  assert.deepEqual(c('CH').only, ['GRABO']);
  // Women's: 100% PURE to the EU, Switzerland and Norway; Men's: Wavytalk (US) is never shown, the US gets the UK view.
  assert.deepEqual(viewFor(config.wgw, 'GB', NOW).hidden, ['100% PURE']);
  assert.deepEqual(viewFor(config.wgw, 'CH', NOW).only, ['100% PURE']);
  assert.deepEqual(viewFor(config.mgw, 'US', NOW).hidden, ['Wavytalk']);
  // A site where every retailer delivers to the UK: the UK view filters no retailer (the same lists as before).
  for (const s of ['tgw', 'sgw', 'zgw', 'kgw', 'hgw', 'ggw']) {
    const v = viewFor(config[s], 'GB', NOW);
    assert.equal(v.hidden, null, s);
    assert.equal(v.only, null, s);
    assert.equal(viewFor(config[s], 'FR', NOW).group, 'gb', `${s}: nobody delivers to France, so the UK view`);
  }
  // Few groups per site (one page copy each in the cache).
  for (const s of SITES) assert.ok(countryGroups(config[s]).list.length <= 5, `${s}: ${countryGroups(config[s]).list.length} groups`);
  assert.equal(OWN_VIEW_COUNTRIES.length, 27 + 3 + 2);
  assert.equal(cleanCountry(' be '), 'BE');
});

test('freshness: hidden after 30 days, "Check price and stock at the retailer" after 14, whole UTC days', () => {
  const v = viewFor(config.mgw, 'GB', Date.parse('2026-11-09T08:00:00Z'));
  assert.equal(v.cutoff, '2026-10-10');
  assert.equal(v.checkFrom, '2026-10-26');
  assert.equal(HIDE_AFTER_DAYS, 30);
  assert.equal(CHECK_AFTER_DAYS, 14);
  const row = day => ({ retailer: 'Coes', last_seen_at: day });
  assert.equal(hiddenReason(v, row('2026-10-09 23:59:59')), 'stale');
  assert.equal(hiddenReason(v, row('2026-10-10 00:00:00')), '');
  assert.equal(hiddenReason(v, row('2026-10-10T08:00:00.000Z')), '', 'ISO dates compare the same way');
  assert.equal(hiddenReason(v, { retailer: 'Coes', last_seen_at: null }), 'stale', 'no date: as NULL in SQL');
  assert.equal(hiddenReason(v, { retailer: 'Wavytalk', last_seen_at: '2026-11-08 10:00:00' }), 'country');
  assert.equal(needsCheck(v, row('2026-10-25 23:00:00')), true);
  assert.equal(needsCheck(v, row('2026-10-26 00:00:01')), false);
  const sql = visibleSql(v);
  assert.equal(sql.sql, 'likelihood(+p.retailer NOT IN (?) AND +p.last_seen_at >= ?, 1.0)');
  assert.deepEqual(sql.binds, ['Wavytalk', '2026-10-10']);
  assert.equal(visibleSql(viewFor(config.agw, 'BE', NOW)).sql, 'likelihood(+p.retailer IN (?, ?) AND +p.last_seen_at >= ?, 1.0)');
  assert.equal(visibleSql(null), null);
});

test('the page cache keeps one copy per country group (lessons L107)', () => {
  const be = viewFor(config.agw, 'BE', NOW);
  const gb = viewFor(config.agw, 'US', NOW);
  assert.equal(cacheKeyUrl('https://cargearworld.com/category/tyres-wheels/?page=2', be), 'https://cargearworld.com/category/tyres-wheels/?page=2&gw-view=be');
  assert.equal(cacheKeyUrl('https://cargearworld.com/', gb), 'https://cargearworld.com/?gw-view=gb');
  assert.notEqual(cacheKeyUrl('https://cargearworld.com/', be), cacheKeyUrl('https://cargearworld.com/', gb));
  // The engine passes it to the edge cache of every cached page.
  const engine = read('src/engine.js');
  assert.match(engine, /withEdgeCache\(request, ctx, produce, env, cacheKeyUrl\(request\.url, view\)\)/);
  assert.equal((engine.match(/\}, view\);/g) || []).length, 6, 'home, category, product, deals, a guide and the guides list are cached per group');
});

// ---- The Car site with a Belgian tyre shop, in memory ----
function memD1(schema, seed) {
  const sql = new DatabaseSync(':memory:');
  for (const t of [schema, seed]) if (t) sql.exec(t);
  const log = [];
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => { log.push({ text, args }); return { results: sql.prepare(text).all(...args).map(r => ({ ...r })) }; },
    first: async () => { log.push({ text, args }); const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, log, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const agwSchema = readdirSync('sites/agw/migrations').sort().map(f => read(`sites/agw/migrations/${f}`)).join('\n');
function carShop() {
  const d = memD1(agwSchema, read('tests/fixtures/agw-seed.sql'));
  // 30 Belgian tyres (in euros) and a stale UK product, like the live data of 9 Nov 2026 in miniature.
  const ins = d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name,
    product_slug, price, currency, in_stock, image_url, affiliate_url, gtin, last_seen_at, first_seen_at) VALUES (?, ?, ?, ?, 'tyres-wheels', 'Tyreco', ?, ?, ?, 'EUR', 1,
    'https://img.example/t.jpg', 'https://www.pneus.be/x', NULL, '2026-10-20 06:00:00', '2026-10-20 06:00:00')`);
  for (let i = 1; i <= 30; i++) ins.run(`91001:t${i}`, 91001, `t${i}`, 'Pneus.be', `Tyreco Summer 205/55 R16 ${i}`, `tyreco-summer-205-55-r16-${i}`, 60 + i);
  d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name, product_slug, price,
    currency, in_stock, image_url, affiliate_url, last_seen_at, first_seen_at) VALUES ('90101:old', 90101, 'old', 'Example Motor Parts', 'tyres-wheels', 'Oldco',
    'Oldco Tyre Inflator', 'oldco-tyre-inflator', 30, 'GBP', 1, 'https://img.example/o.jpg', 'https://example.com/o', '2026-09-01 06:00:00', '2026-09-01 06:00:00')`).run();
  d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name, product_slug, price,
    was_price, currency, in_stock, image_url, affiliate_url, last_seen_at, first_seen_at) VALUES ('90101:mid', 90101, 'mid', 'Example Motor Parts', 'tyres-wheels', 'Midco',
    'Midco Tyre Gauge', 'midco-tyre-gauge', 20, 40, 'GBP', 1, 'https://img.example/m.jpg', 'https://example.com/m', '2026-10-01 06:00:00', '2026-10-01 06:00:00')`).run();
  return d;
}
const agwWorker = createWorker(config.agw);
const getAgw = (path, env, country = '', headers = {}) => {
  const req = new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test', ...headers } });
  if (country) Object.defineProperty(req, 'cf', { value: { country } });
  return agwWorker.fetch(req, env, { waitUntil: p => p });
};
const envOf = d => ({ DB: d, CLICK_LOG: 'off', FX_FETCH: async () => { throw new Error('offline'); } });
const idOf = (d, name) => d.sql.prepare('SELECT id FROM products WHERE product_name = ?').get(name).id;

test('AGW: a UK visitor never sees the Belgian tyres; a Belgian visitor sees them and VEVOR, not the UK shops', async () => {
  const d = carShop();
  const env = envOf(d);
  const tyreCount = html => (html.match(/Tyreco Summer/g) || []).length;
  const ukCat = await (await getAgw('/category/tyres-wheels/', env, 'GB')).text();
  assert.equal(tyreCount(ukCat), 0);
  assert.ok(!/Pneus\.be/.test(ukCat), 'not even in the retailer filter');
  const usCat = await (await getAgw('/category/tyres-wheels/', env, 'US')).text();
  assert.equal(tyreCount(usCat), 0, 'a US address (crawlers, reviewers) gets the UK view');
  const beCat = await (await getAgw('/category/tyres-wheels/', env, 'BE')).text();
  assert.ok(tyreCount(beCat) > 0);
  assert.ok(!/Example Motor Parts|Sample Garage Supplies/.test(beCat.split('<main')[1]), 'the UK shops do not deliver to Belgium');
  // Home page, search, deals, API: the same rule.
  const ukHome = await (await getAgw('/', env, 'GB')).text();
  assert.ok(!/Pneus\.be|Tyreco Summer/.test(ukHome));
  assert.ok(/Pneus\.be/.test(await (await getAgw('/', env, 'BE')).text()));
  assert.ok(!/Tyreco/.test(await (await getAgw('/search?q=tyreco', env, 'GB')).text()));
  assert.ok(/Tyreco Summer/.test(await (await getAgw('/search?q=tyreco', env, 'BE')).text()));
  // The Hub asks /api/products from its own Worker and passes its visitor's country (deliver_to).
  const api = cc => getAgw(`/api/products?search=tyreco&limit=60${cc ? `&deliver_to=${cc}` : ''}`, env, 'GB').then(r => r.json());
  assert.equal((await api('')).products.length, 0);
  assert.equal((await api('BE')).products.length, 30);
  assert.equal((await api('US')).products.length, 0);
  assert.ok((await api('BE')).products.every(p => p.retailer === 'Pneus.be'));
  // deliver_to counts only on /api/products: a page ignores it.
  assert.equal(tyreCount(await (await getAgw('/category/tyres-wheels/?deliver_to=BE', env, 'GB')).text()), 0);
});

test('AGW: an old link to a product the visitor may not see opens a notice (200, noindex, no price, no button)', async () => {
  const d = carShop();
  const env = envOf(d);
  const id = idOf(d, 'Tyreco Summer 205/55 R16 5');
  const path = `/product/tyreco-summer-205-55-r16-5-${id}/`;
  const r = await getAgw(path, env, 'GB');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/cargearworld\.com\/product\/tyreco-summer-205-55-r16-5-\d+\/">/);
  // The page is cached per country group, and many countries share a group: so the notice names no country, and the
  // line under it says where the retailer delivers.
  assert.match(html, /<span data-i18n="\{0\} does not deliver to your country\." data-i18n-0="Pneus\.be" data-i18n-keep="0"><span translate="no">Pneus\.be<\/span> does not deliver to your country\.<\/span>/);
  assert.match(html, /<span translate="no">Pneus\.be<\/span> delivers to<\/span><\/span>: <span class="ship-names"><span data-country="BE">Belgium<\/span>/);
  assert.ok(!/United Kingdom/.test(html.split('notice-box')[1].split('chip-list')[0]), 'no country named in the notice');
  // A US visitor shares the UK copy: the same words.
  const us = await (await getAgw(path, env, 'US')).text();
  assert.equal(us.split('notice-box')[1].split('chip-list')[0], html.split('notice-box')[1].split('chip-list')[0]);
  assert.ok(!/\/out\/\d/.test(html), 'no button to the retailer');
  assert.ok(!/€\d|data-price=/.test(html.split('<main')[1].split('</main>')[0]), 'no price');
  assert.ok(!/"@type":"Product"/.test(html), 'no product markup');
  // Unknown country: the same notice.
  assert.match(await (await getAgw(path, env)).text(), /data-i18n="\{0\} does not deliver to your country\."/);
  // The Belgian visitor sees the normal page.
  const be = await (await getAgw(path, env, 'BE')).text();
  assert.match(be, /<meta name="robots" content="index,follow">/);
  assert.match(be, /href="\/out\/\d+"/);
  assert.match(be, /<span translate="no">Pneus\.be<\/span> delivers to<\/span><\/dt><dd class="ship-dd">.*<span data-country="BE">Belgium<\/span>/s, 'the Belgian page says where Pneus.be delivers');
  // A price older than 30 days: hidden for everyone, with its own notice.
  const old = idOf(d, 'Oldco Tyre Inflator');
  const stale = await (await getAgw(`/product/oldco-tyre-inflator-${old}/`, env, 'GB')).text();
  assert.match(stale, /data-i18n="We have no price check for this product from the last 30 days, so we don&#39;t show it\."|data-i18n="We have no price check for this product from the last 30 days, so we don't show it\."/);
  assert.ok(!/more than 30 days ago/.test(stale), 'no claim about when it was last checked');
  assert.match(stale, /<meta name="robots" content="noindex,follow">/);
  assert.ok(!/\/out\/\d/.test(stale));
});

test('AGW: /out/ of a product the visitor may not see goes to its page, never to the retailer', async () => {
  const d = carShop();
  const env = envOf(d);
  const id = idOf(d, 'Tyreco Summer 205/55 R16 5');
  const uk = await getAgw(`/out/${id}`, env, 'GB');
  assert.equal(uk.status, 302);
  assert.equal(uk.headers.get('location'), `https://cargearworld.com/product/tyreco-summer-205-55-r16-5-${id}/`);
  const be = await getAgw(`/out/${id}`, env, 'BE');
  assert.equal(be.status, 302);
  assert.match(be.headers.get('location'), /^https:\/\/www\.pneus\.be\//);
});

test('AGW: a price checked 14-30 days ago says "Check price and stock at the retailer", with its real date', async () => {
  const d = carShop();
  const env = envOf(d);
  const id = idOf(d, 'Midco Tyre Gauge');
  const html = await (await getAgw(`/product/midco-tyre-gauge-${id}/`, env, 'GB')).text();
  assert.match(html, /<dd class="check"><span data-i18n="Check price and stock at the retailer">Check price and stock at the retailer<\/span><\/dd>/);
  assert.ok(!/>In stock</.test(html.split('id="sim-h"')[0]), 'no stock claim');
  assert.match(html, /<dt>Price checked<\/dt><dd><time datetime="2026-10-01">/);
  // The RRP is a plain "RRP £40.00", never a "was" price or "Save n%".
  assert.match(html, /<span class="rrp"><span data-i18n="RRP \{0\}" data-i18n-0="£40\.00" data-i18n-keep="0">RRP <span translate="no">£40\.00<\/span><\/span><\/span>/);
  assert.ok(!/class="was"|tag-save|Save \d+%|previous price/i.test(html));
  const api = await (await getAgw('/api/products?search=midco', env)).json();
  assert.equal(api.products[0].stock_status, 'check_retailer');
});

test('"Below RRP": only fresh prices (14 days), never "price drop" wording; the older layout asks nothing', async () => {
  const d = carShop();
  const env = envOf(d);
  const home = await (await getAgw('/', env, 'GB')).text();
  assert.ok(!/price drop|Today's price|previous price|Save \d+%/i.test(home), 'no price-drop words on the home page');
  const deals = await (await getAgw('/deals/', env, 'GB')).text();
  assert.match(deals, /<h1>Below RRP<\/h1>/);
  assert.match(deals, /not an earlier price\. Every price here was checked in the last 14 days\./);
  assert.ok(!/Midco Tyre Gauge/.test(deals), 'checked 20 days ago: not "today"');
  assert.ok(!/price drop|previous price/i.test(deals));
  const cat = await (await getAgw('/category/garage-tools-equipment/', env, 'GB')).text();
  assert.match(cat, /<option value="saving">Furthest below RRP<\/option>/);
  // The older layout has no RRP: no query for it, an empty list.
  const mgw = createWorker(config.mgw);
  const legacy = memD1(read('tests/fixtures/ggw-legacy-schema.sql'), read('tests/fixtures/mgw-seed.sql'));
  const res = await mgw.fetch(new Request('https://mensgearworld.com/deals/'), { DB: legacy }, { waitUntil: p => p });
  assert.equal(res.status, 200);
  assert.ok(!legacy.log.some(q => /was_price > p\.price/.test(q.text)), 'no RRP query on the older layout');
});

test('sitemaps and /api/stats: the UK view for everyone; categories with fewer than 20 visible products are left out', async () => {
  const d = carShop();
  const env = envOf(d);
  const chunk = await (await getAgw('/sitemap-products-1.xml', env, 'BE')).text();
  assert.ok(!/tyreco-summer/.test(chunk), 'no Belgian tyre in the sitemap, even when Belgium asks');
  assert.ok(!/oldco-tyre-inflator/.test(chunk), 'no stale product');
  const total = d.sql.prepare("SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND retailer NOT IN ('Pneus.be', 'VEVOR') AND last_seen_at >= ?").get(viewFor(config.agw, 'GB', NOW).cutoff).n;
  assert.equal((chunk.match(/<url>/g) || []).length, total);
  const stat = await (await getAgw('/sitemap-static.xml', env, 'BE')).text();
  useClock(() => NOW);
  db.useLayout(config.agw);
  const counts = await db.categoryCounts(d, homeView(config.agw));
  for (const c of config.agw.categories) {
    assert.equal(stat.includes(`/category/${c.slug}/<`), (counts[c.slug] || 0) >= MIN_INDEXED_PRODUCTS, c.slug);
  }
  const stats = await (await getAgw('/api/stats', env, 'BE')).json();
  assert.ok(!stats.retailer_names.includes('Pneus.be') && !stats.retailer_names.includes('VEVOR'));
  // A thin category page: noindex,follow.
  const thin = config.agw.categories.find(c => (counts[c.slug] || 0) > 0 && counts[c.slug] < MIN_INDEXED_PRODUCTS);
  assert.ok(thin, 'a thin category in the test data');
  assert.match(await (await getAgw(`/category/${thin.slug}/`, env, 'GB')).text(), /<meta name="robots" content="noindex,follow">/);
});

test('Women\'s: "Watch Enclave Affiliate Programme" is always shown as "Watch Enclave", also through the filters', async () => {
  const wgw = config.wgw;
  assert.equal(wgw.database.retailerNames['Watch Enclave Affiliate Programme'], 'Watch Enclave');
  const legacy = memD1(read('tests/fixtures/ggw-legacy-schema.sql'), read('tests/fixtures/wgw-seed.sql'));
  legacy.sql.prepare(`INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, product_name, price, currency, stock_status, image_url,
    affiliate_url, is_active, updated_at) VALUES ('we1', 'we1', 'Watch Enclave Affiliate Programme', ?, 'Enclave Steel Watch 40mm', 99, 'GBP', 'in stock',
    'https://img.example/w.jpg', 'https://www.awin1.com/cread.php?x=1', 1, '2026-10-20 10:00:00')`).run(Object.values(wgw.database.categories)[0][0]);
  const w = createWorker(wgw);
  const env = { DB: legacy };
  const get = path => w.fetch(new Request(`https://womensgearworld.com${path}`), env, { waitUntil: p => p }).then(r => r.text());
  for (const path of ['/', '/search?q=enclave', `/category/${Object.keys(wgw.database.categories)[0]}/`, '/api/products?search=enclave', '/api/stats']) {
    assert.ok(!/Affiliate Programme/.test(await get(path)), path);
  }
});

// ---- D1 cost: the same plans with a view; similar products bounded ----
const L51_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_products_active_category_price_id ON products(is_active, site_category, price, id);',
  `CREATE INDEX IF NOT EXISTS idx_products_group_key ON products(${db.LEGACY_GROUP_KEY});`,
  'CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(is_active, created_at);'
];
const VIS_TERM = /\s+AND likelihood\((?:[^()]|\([^()]*\))*, 1\.0\)/g;
// The plan of a query, with the index NAME left out: the same constraint on another index of the same table walks the
// same number of index rows (one entry per row), and D1 counts the index rows walked, not the reads of a row by its id
// that follow (measured with the D1 of wrangler, lessons L107). Without its retailer and date, a COUNT can use any index
// that starts with is_active; with them it takes the smallest one, for the same rows. Sorts (TEMP B-TREE) stay in.
const planOf = (sql, text, args) => sql.prepare(`EXPLAIN QUERY PLAN ${text}`).all(...args)
  .map(r => r.detail.replace(/COVERING /, '').replace(/USING INDEX \S+ \(/, 'USING INDEX (').replace(/USING INDEX \S+$/, 'USING INDEX')).join(' | ');

async function plansFor(site, d, view) {
  db.useLayout(site);
  const slugs = site.categories.map(c => c.slug);
  d.log.length = 0;
  await db.homeData(d, slugs, { view });
  for (const c of slugs.slice(0, 3)) {
    await db.listProducts(d, { category: c, view }, { sort: 'featured' });
    await db.listProducts(d, { category: c, view, brand: 'X' }, { sort: 'price-asc' });
    await db.facets(d, c, null, view);
  }
  await db.listProducts(d, { search: 'drill', view }, {});
  await db.searchFacets(d, 'drill', view);
  await db.categoryCounts(d, view);
  await db.stats(d, view);
  await db.sitemapChunk(d, 1, 100, view);
  const p = await db.getProduct(d, d.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id LIMIT 1').get().id);
  await db.offersFor(d, p, 12, { view });
  return d.log.map(q => ({ shape: q.text.replace(VIS_TERM, ''), plan: planOf(d.sql, q.text, q.args) }));
}

for (const [code, schema] of [['agw', agwSchema], ['cgw', read('tests/fixtures/ggw-legacy-schema.sql') + '\n' + L51_INDEXES.join('\n')], ['mgw', read('tests/fixtures/ggw-legacy-schema.sql') + '\n' + L51_INDEXES.join('\n')]]) {
  test(`${code.toUpperCase()}: with a view every hot query keeps the plan it has without one (the view only filters)`, async () => {
    const site = config[code];
    const extra = site.database && site.database.groupTable ? 'CREATE TABLE product_group_offers (group_id INTEGER NOT NULL, product_id INTEGER NOT NULL UNIQUE, PRIMARY KEY (group_id, product_id)); CREATE INDEX idx_product_group_offers_group ON product_group_offers(group_id);' : '';
    const d = memD1(schema + '\n' + extra, read(`tests/fixtures/${code}-seed.sql`).replace(/CREATE TABLE product_group_offers[^;]*;/, ''));
    const plain = await plansFor(site, d, null);
    for (const cc of ['GB', 'BE', 'DE']) {
      const viewed = await plansFor(site, d, viewFor(site, cc, NOW));
      assert.equal(viewed.length, plain.length, `${cc}: the same queries`);
      viewed.forEach((q, i) => {
        if (q.shape !== plain[i].shape) return; // a query written for the view (sitemap count): checked by the benchmark
        assert.equal(q.plan, plain[i].plan, `${cc}: ${q.shape.slice(0, 120)}`);
      });
    }
  });
}

// Random categories where most rows are hidden (the Belgian tyres): similar products read NEAR rows a side, as without a
// view, and their cards are exactly the first cards of the full filtered query (fewer only when the walk ran out).
function random(seed) {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}
test('similar products with a view: a prefix of the full filtered query, never more rows than without a view', async () => {
  const site = config.agw;
  const d = memD1(agwSchema);
  const r = random(107);
  const ins = d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, product_name, product_slug, price,
    currency, in_stock, image_url, affiliate_url, gtin, last_seen_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'GBP', ?, 'https://img.example/x.jpg', 'https://example.com/x', ?, ?)`);
  const eans = Array.from({ length: 300 }, (_, i) => String(5000000000000 + i));
  for (let i = 1; i <= 2500; i++) {
    const retailer = r() < 0.8 ? 'Pneus.be' : r() < 0.5 ? 'VEVOR' : r() < 0.5 ? 'Shop A' : 'Shop B';
    const day = r() < 0.15 ? '2026-09-01 06:00:00' : '2026-10-20 06:00:00';
    ins.run(`k${i}`, `m${i}`, retailer, r() < 0.7 ? 'tyres-wheels' : 'garage-tools-equipment', `P ${i}`, `p-${i}`, [9.99, 10, 25, 49.5, 50, 99][Math.floor(r() * 6)] + Math.floor(r() * 20),
      r() < 0.9 ? 1 : 0, r() < 0.5 ? eans[Math.floor(r() * eans.length)] : null, day);
  }
  db.useLayout(site);
  const ids = d.sql.prepare('SELECT id FROM products ORDER BY id').all().map(x => x.id);
  let checked = 0, shorter = 0;
  for (const cc of ['GB', 'BE', 'FR']) {
    const view = viewFor(site, cc, NOW);
    for (const id of ids.filter((_, i) => i % 23 === 0)) {
      const p = await db.getProduct(d, id);
      if (!p || hiddenReason(view, p)) continue;
      const full = JSON.parse(JSON.stringify(await db.similarProducts(d, p, 8, { full: true, view })));
      d.log.length = 0;
      const got = JSON.parse(JSON.stringify(await db.similarProducts(d, p, 8, { view })));
      assert.deepEqual(got, full.slice(0, got.length), `${cc} ${id}: a prefix of the full query`);
      if (got.length < full.length) shorter++;
      for (const g of got) assert.equal(hiddenReason(view, g), '', `${cc} ${id}: only cards the visitor may see`);
      // Never the full query, and each side asks for NEAR rows, as without a view.
      assert.ok(!d.log.some(q => /ROW_NUMBER\(\) OVER/.test(q.text)), `${cc} ${id}: no full query`);
      const sides = d.log.filter(q => /ORDER BY p\.price (ASC|DESC), p\.id (ASC|DESC)\s+LIMIT \?/.test(q.text));
      assert.equal(sides.length, 2);
      for (const s of sides) assert.equal(s.args[s.args.length - 1], 40);
      checked++;
    }
  }
  assert.ok(checked > 100, `${checked} product pages checked`);
  assert.ok(shorter < checked, 'most pages have their 8 cards');
});

test('the old full listing without a view is unchanged: the same rows as before the view existed (GB on a UK-only site)', async () => {
  // A site where every retailer delivers to the UK and every price is fresh: the UK view shows exactly what no view shows.
  const site = config.tgw;
  const d = memD1(read('sites/tgw/migrations/0001_init.sql'), read('tests/fixtures/tgw-seed.sql'));
  d.sql.prepare("UPDATE products SET last_seen_at = '2026-10-20 06:00:00'").run();
  db.useLayout(site);
  const view = viewFor(site, 'GB', NOW);
  const strip = rows => JSON.parse(JSON.stringify(rows));
  for (const c of site.categories) {
    assert.deepEqual(strip(await db.listProducts(d, { category: c.slug, view }, {})), strip(await db.listProducts(d, { category: c.slug }, {})), c.slug);
    assert.deepEqual(strip(await db.facets(d, c.slug, null, view)), strip(await db.facets(d, c.slug)), c.slug);
  }
  const a = strip(await db.homeData(d, site.categories.map(c => c.slug), { view }));
  const b = strip(await db.homeData(d, site.categories.map(c => c.slug), {}));
  assert.deepEqual({ ...a, deals: [] }, { ...b, deals: [] });
});

test('the Hub passes its visitor\'s country to every site (?deliver_to=), and only a real 2-letter code', () => {
  const hub = read('sites/gwh/worker.js');
  assert.match(hub, /const deliverTo = country \|\| visitorCountry\(request\);/);
  assert.match(hub, /return \/\^\[A-Z\]\{2\}\$\/\.test\(cc\) && cc !== "XX" && cc !== "T1" \? cc : "GB";/, 'unknown: GB');
  assert.match(hub, /if \(deliverTo\) endpoint\.searchParams\.set\("deliver_to", deliverTo\);/);
  assert.match(read('src/engine.js'), /const asked = apiProducts \? url\.searchParams\.get\('deliver_to'\) : '';/);
});

test('the dictionaries of the 13 sites have every new text (lessons L24, L107), and none of the old price-drop words', () => {
  const KEYS = ['RRP {0}', 'RRP', 'Check price and stock at the retailer', 'Below RRP', 'See all below RRP', 'Furthest below RRP',
    '{0} does not deliver to your country.', "We have no price check for this product from the last 30 days, so we don't show it.",
    'No products below their RRP right now', 'In stock, at the joint lowest price.', '{0} sale', UK_BAR_TEXT];
  const OLD = /price drops?|previous price|Save \{0\}%|Biggest saving|^Below RRP today$|^\{0\} does not deliver to \{1\}\.$|^We no longer list this product|^Up to \{0\}% off$|up to \{1\}% off/i;
  let n = 0;
  for (const s of SITES) {
    for (const f of readdirSync(`sites/${s}/public/assets/i18n`)) {
      const dict = JSON.parse(read(`sites/${s}/public/assets/i18n/${f}`));
      for (const k of KEYS) {
        assert.ok(dict[k], `${s}/${f}: ${k}`);
        assert.equal((dict[k].match(/\{\d\}/g) || []).sort().join(), (k.match(/\{\d\}/g) || []).sort().join(), `${s}/${f}: ${k} keeps its placeholders`);
      }
      for (const k of Object.keys(dict)) assert.ok(!OLD.test(k), `${s}/${f}: old key "${k}"`);
      n++;
    }
  }
  assert.equal(n, 130);
});

// ---- Google's crawlers (item 8 of the checker, 9 Nov 2026) ----
const CRAWLERS = ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'AdsBot-Google (+http://www.google.com/adsbot.html)',
  'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)',
  'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)', 'Mozilla/5.0 (X11; Linux x86_64; Storebot-Google/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  'Mediapartners-Google', 'Mozilla/5.0 (compatible; GoogleOther)'];
test('Google crawlers get the UK view (even from a Belgian address) and no bar; a fake crawler name gains nothing', async () => {
  const d = carShop();
  const env = envOf(d);
  const tyres = html => (html.match(/Tyreco Summer/g) || []).length;
  for (const ua of CRAWLERS) {
    const r = await getAgw('/category/tyres-wheels/', env, 'BE', { 'User-Agent': ua });
    const html = await r.text();
    assert.equal(tyres(html), 0, `${ua.slice(0, 40)}: the UK view`);
    assert.ok(!html.includes('class="country-bar"'), `${ua.slice(0, 40)}: no bar`);
  }
  // A "Googlebot" from the US (a spoofed name or the real one): the UK view, which the US gets anyway, without the bar.
  const spoof = await (await getAgw('/', env, 'US', { 'User-Agent': 'Googlebot' })).text();
  assert.ok(!/Tyreco|Pneus\.be/.test(spoof) && !spoof.includes('class="country-bar"'));
  // Another crawler (or a person) from Belgium: the Belgian view.
  assert.ok(tyres(await (await getAgw('/category/tyres-wheels/', env, 'BE', { 'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0)' })).text()) > 0);
});

// ---- The bar for visitors outside the UK (item 15, the owner's option A, 9 Nov 2026) ----
test('the UK bar: for the UK view outside the UK (unknown, no own view, nobody delivers), never for the UK, an own view or a crawler', () => {
  const agw = config.agw;
  assert.equal(needsUkBar(agw, 'GB'), false);
  for (const cc of ['US', 'CA', 'AU', '', 'XX', 'CH']) assert.equal(needsUkBar(agw, cc), true, `AGW ${cc || 'unknown'}`);
  for (const cc of ['BE', 'NL', 'DE', 'IE', 'NO']) assert.equal(needsUkBar(agw, cc), false, `AGW ${cc}: its own view`);
  for (const s of ['tgw', 'hgw', 'kgw']) {
    assert.equal(needsUkBar(config[s], 'FR'), true, `${s}: nobody delivers to France`);
    assert.equal(needsUkBar(config[s], 'GB'), false, s);
  }
  assert.equal(needsUkBar(config.cgw, 'DE'), false, 'CGW Germany: Reidl, VEVOR and GRABO');
  assert.equal(needsUkBar(config.cgw, 'US'), true, 'CGW US: only GRABO (worldwide) besides the UK shops');
  assert.equal(UK_BAR_TEXT, "We're adding retailers for your country. Most retailers below deliver to the UK only. Check delivery before you buy.");
});

test('the UK bar is added after the page cache: one cached copy for GB and US, no D1 read on a hit, the bar only for the US', async () => {
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  try {
    // The pages of the cache, without their spare copies (lessons L112: /__gw-spare/<path>, read only when D1 is busy).
    const pages = () => [...store.keys()].filter(k => !k.includes('/__gw-spare/'));
    const d = carShop();
    const env = envOf(d);
    const reads = () => d.log.length;
    const r0 = reads();
    const gb = await getAgw('/', env, 'GB');
    const gbHtml = await gb.text();
    const missReads = reads() - r0;
    assert.ok(missReads > 0, 'the first visit reads D1');
    assert.equal(pages().length, 1, 'one copy in the cache');
    assert.ok([...store.keys()].some(k => k.includes('/__gw-spare/')), 'and its spare copy');
    const cachedHtml = await store.get(pages()[0]).clone().text();
    assert.ok(!cachedHtml.includes('country-bar'), 'the cached copy has no bar');
    const r1 = reads();
    const us = await getAgw('/', env, 'US');
    const usHtml = await us.text();
    assert.equal(reads() - r1, 0, 'the US visit is a cache hit: no D1 read');
    assert.equal(pages().length, 1, 'no copy of its own for the bar');
    assert.equal(cachedHtml, gbHtml, 'GB gets the cached copy as it is');
    assert.ok(usHtml.includes(`<div class="country-bar" role="note"><p class="wrap country-row"><span data-i18n="We&#39;re adding retailers for your country.`) || usHtml.includes('<div class="country-bar" role="note">'));
    assert.equal(usHtml.replace(/<div class="country-bar"[\s\S]*?<\/div>/, ''), cachedHtml, 'the US answer is the same copy plus the bar');
    assert.ok(usHtml.indexOf('class="country-bar"') < usHtml.indexOf('<header class="masthead">'), 'above the header, never over the offer bar or the menu');
    assert.match(us.headers.get('Cache-Control'), /^private/, 'a shared cache never keeps the copy with the bar');
    assert.match(gb.headers.get('Cache-Control'), /^public/);
    // Unknown country: the bar too; Belgium (its own view, its own copy): no bar.
    assert.ok((await (await getAgw('/', env)).text()).includes('class="country-bar"'));
    assert.ok(!(await (await getAgw('/', env, 'BE')).text()).includes('class="country-bar"'));
    // Not on JSON, XML or a redirect.
    assert.ok(!(await (await getAgw('/sitemap.xml', env, 'US')).text()).includes('country-bar'));
  } finally {
    if (before === undefined) delete globalThis.caches; else globalThis.caches = before;
  }
});

test('strict countries (site.strictCountries, empty on every site today): only what delivers there, an empty view, no bar', () => {
  for (const s of SITES) assert.deepEqual(config[s].strictCountries, [], `${s}: no strict country yet`);
  const site = { ...config.agw, strictCountries: ['US', 'BE'] };
  assert.deepEqual(strictCountries(site), ['US', 'BE']);
  const us = viewFor(site, 'US', NOW);
  assert.equal(us.group, 'us');
  assert.deepEqual(us.only, []);
  assert.equal(hiddenReason(us, { retailer: 'Example Motor Parts', last_seen_at: '2026-10-20 06:00:00' }), 'country');
  assert.match(visibleSql(us).sql, /^likelihood\(0 AND /);
  assert.equal(needsUkBar(site, 'US'), false);
  assert.equal(viewFor(site, 'BE', NOW).group, 'be', 'a strict country with retailers: its own view as before');
  // Without the list nothing changes.
  assert.equal(viewFor(config.agw, 'US', NOW).group, 'gb');
});

test('where the retailers deliver, as the Belgian, Austrian/German and other EU views show it', () => {
  const names = (site, r) => toString(deliveryText(site, r)).replace(/<[^>]+>/g, '').trim();
  assert.equal(names(config.agw, 'Pneus.be'), 'Belgium');
  assert.equal(names(config.cgw, 'Reidl'), 'Germany, Austria');
  assert.equal(names(config.wgw, '100% PURE'), 'European Union, Switzerland, Norway');
  for (const s of ['agw', 'vgw', 'cgw']) assert.equal(names(config[s], 'VEVOR'), 'European Union, Iceland, Liechtenstein, Norway', s);
  assert.deepEqual(viewFor(config.agw, 'BE', NOW).only, ['Pneus.be', 'VEVOR']);
  assert.deepEqual(viewFor(config.cgw, 'AT', NOW).only, ['GRABO', 'Reidl', 'VEVOR']);
  assert.deepEqual(viewFor(config.wgw, 'DE', NOW).only, ['100% PURE']);
  assert.deepEqual(viewFor(config.vgw, 'FR', NOW).only, ['VEVOR']);
  // "Europe" is no longer claimed on AGW, VGW and WGW.
  for (const s of ['agw', 'vgw', 'wgw']) assert.equal(config[s].retailersFromEurope, false, s);
});

test('a search with one brand or retailer is counted through that index (INDEXED BY), only on the newer layout (item 14)', async () => {
  // Every newer site's migration has the two indexes the count names (checked on the 7 live databases, 9 Nov 2026).
  for (const s of SITES.filter(n => existsSync(`sites/${n}/migrations/0001_init.sql`))) {
    const m = read(`sites/${s}/migrations/0001_init.sql`);
    assert.match(m, /CREATE INDEX idx_products_brand ON products \(is_active, brand\);/, s);
    assert.match(m, /CREATE INDEX idx_products_retailer ON products \(is_active, retailer\);/, s);
  }
  const d = carShop();
  const env = envOf(d);
  for (const [q, idx] of [['brand=Tyreco', 'idx_products_brand'], ['retailer=Pneus.be', 'idx_products_retailer']]) {
    d.log.length = 0;
    const r = await getAgw(`/search?q=tyreco&${q}`, env, 'BE');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Tyreco Summer/);
    const count = d.log.find(x => /^SELECT COUNT\(DISTINCT/.test(x.text));
    assert.ok(count && count.text.includes(`FROM products p INDEXED BY ${idx} WHERE`), q);
    const plan = d.sql.prepare(`EXPLAIN QUERY PLAN ${count.text}`).all(...count.args).map(x => x.detail).join(' | ');
    assert.match(plan, new RegExp(`USING INDEX ${idx} \\(is_active=\\? AND (brand|retailer)=\\? AND rowid=\\?\\)`), plan);
  }
  // Without a search, or on the older layout: no INDEXED BY.
  d.log.length = 0;
  await getAgw('/category/tyres-wheels/?brand=Tyreco', env, 'BE');
  assert.ok(!d.log.some(x => /INDEXED BY/.test(x.text)));
  const mgw = createWorker(config.mgw);
  const legacy = memD1(read('tests/fixtures/ggw-legacy-schema.sql'), read('tests/fixtures/mgw-seed.sql'));
  await mgw.fetch(new Request('https://mensgearworld.com/search?q=watch&brand=Seiko'), { DB: legacy }, { waitUntil: p => p });
  assert.ok(!legacy.log.some(x => /INDEXED BY/.test(x.text)));
});
