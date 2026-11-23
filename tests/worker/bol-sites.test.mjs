// bol.com on the Gear World sites (lessons L204): the 10 sites that list it show it ONLY to visitors from the
// Netherlands and Belgium (bol.com delivers there only, its names are Dutch: deliversTo.languages 'nl', L165). The UK
// view, Google's crawlers (the UK view), the sitemaps and the other countries never list it. Home Gear World shows it
// in the Netherlands only until chat 3's new view filter takes away the limit of 10 page groups (sites/_shared/bol.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { deliveryConfigProblems, shownCountries, feedLanguage, deliveryCountries } from '../../src/lib/delivery.js';
import { viewFor, countryGroups, isShown, hiddenReason, homeView } from '../../src/lib/visibility.js';
import { BOL_RETAILER, BOL_SITES, BOL_COUNTRIES, BOL_GUARD_SITES, bolDelivery } from '../../sites/_shared/bol.js';
import { TEST_DAY } from './test-clock.mjs';

const NOW = Date.parse(`${TEST_DAY}T12:00:00Z`);
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const SHOPS = readdirSync('sites').filter(n => existsSync(`sites/${n}/site.config.js`) && existsSync(`sites/${n}/public/assets/site.js`));
const config = {};
for (const s of SHOPS) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const TARGETS = ['agw', 'hgw', 'vgw', 'sgw', 'cgw', 'ggw', 'zgw', 'wgw', 'mgw', 'kgw'];
const row = { retailer: BOL_RETAILER, last_seen_at: `${TEST_DAY} 06:00:00` };

test('L204: the 10 sites of the bol.com rules list bol.com, with its own countries and the Dutch feed language', () => {
  assert.deepEqual(Object.keys(BOL_SITES).sort(), [...TARGETS].sort());
  assert.deepEqual(bolDelivery(), { retailers: { 'bol.com': ['NL', 'BE'] }, languages: { 'bol.com': 'nl' } });
  assert.deepEqual([...BOL_COUNTRIES], ['NL', 'BE']);
  for (const s of TARGETS) {
    const site = config[s];
    assert.deepEqual(deliveryConfigProblems(site), [], s);
    assert.deepEqual(site.deliversTo.retailers[BOL_RETAILER], [...BOL_SITES[s]], `${s}: bol.com delivers to`);
    assert.equal(feedLanguage(site, BOL_RETAILER), 'nl', `${s}: Dutch names`);
    assert.deepEqual(shownCountries(site, BOL_RETAILER), s === 'hgw' ? ['NL'] : ['NL', 'BE'], `${s}: seen in`);
    assert.deepEqual(deliveryCountries(site, BOL_RETAILER), s === 'hgw' ? ['NL'] : ['NL', 'BE'], `${s}: the card says`);
  }
  // The other 3 sites (TGW, BGW, PGW) list no bol.com (tools/import-rules/bol-nl.mjs never sends a product there; the
  // removal tool still checks their databases), but carry the same NL/BE-only line (review of 6954a135), so a stray
  // bol.com row there could never reach the UK view, Google or the sitemaps.
  const others = SHOPS.filter(x => !TARGETS.includes(x)).sort();
  assert.deepEqual(others, [...BOL_GUARD_SITES].sort());
  for (const s of others) {
    assert.deepEqual(config[s].deliversTo.retailers[BOL_RETAILER], ['NL', 'BE'], s);
    assert.equal(feedLanguage(config[s], BOL_RETAILER), 'nl', s);
    assert.deepEqual(deliveryConfigProblems(config[s]), [], s);
    assert.ok(!shownCountries(config[s], BOL_RETAILER).includes('GB'), `${s}: never the UK view`);
    assert.equal(isShown(viewFor(config[s], 'GB', NOW), row), false, `${s}: a bol.com row is not in the UK view`);
    assert.equal(isShown(homeView(config[s], NOW), row), false, `${s}: nor in the sitemaps and /api/stats`);
  }
});

test('L204: the UK view and Google never list bol.com; the Netherlands and Belgium do; Germany, France, Greece and the rest never', () => {
  for (const s of TARGETS) {
    const site = config[s];
    const gb = viewFor(site, 'GB', NOW);
    assert.ok(gb.hidden.includes(BOL_RETAILER), `${s}: the UK view hides bol.com`);
    assert.equal(isShown(gb, row), false, `${s} GB`);
    assert.equal(hiddenReason(gb, row), 'language', `${s} GB: the notice says "another language", not "does not deliver"`);
    assert.equal(isShown(homeView(site, NOW), row), false, `${s}: the sitemaps and /api/stats (the UK view)`);
    assert.equal(isShown(viewFor(site, 'NL', NOW), row), true, `${s} NL`);
    assert.equal(isShown(viewFor(site, 'BE', NOW), row), s !== 'hgw', `${s} BE`);
    for (const cc of ['DE', 'FR', 'GR', 'CY', 'AT', 'LU', 'IE', 'IT', 'ES', 'PL', 'US', 'CA', '', 'XX']) {
      assert.equal(isShown(viewFor(site, cc, NOW), row), false, `${s} ${cc || 'unknown'}: never bol.com`);
    }
    // The all view (every country without a view of its own) leaves it out, so the copy of Germany or Canada never has it.
    const groups = countryGroups(site);
    assert.ok(groups.all.hidden.includes(BOL_RETAILER), `${s}: the all view`);
    // Few page copies (L165, L199): the older sites keep at most 10 groups; since L202 the names are quoted text in the SQL,
    // so the limit is the D1 statement (600 names, tests/worker/fast-lists-legacy.test.mjs; massive import of 22 Nov 2026).
    assert.ok(groups.list.length <= 10, `${s}: ${groups.list.length} groups`);
    for (const g of groups.list) assert.ok((g.hidden || g.only || []).length <= 600, `${s} ${g.id}`);
  }
  // The other sites: a bol.com row (there should be none) would never reach a visitor outside the UK view's own retailers.
  assert.equal(viewFor(config.hgw, 'BE', NOW).group, 'all', 'HGW: Belgium keeps the all view (no 11th group)');
});

// ---- The pages: AGW (newer layout) and HGW (older layout), with bol.com products in memory ----
function memD1(schema, seed) {
  const sql = new DatabaseSync(':memory:');
  for (const t of [schema, seed]) if (t) sql.exec(t);
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const read = f => readFileSync(f, 'utf8');
const link = n => `https://partner.bol.com/click/click?p=2&t=url&s=1559450&f=TXL&url=${encodeURIComponent(`https://www.bol.com/nl/nl/p/x/${n}/`)}`;
function agwWithBol() {
  const d = memD1(readdirSync('sites/agw/migrations').sort().map(f => read(`sites/agw/migrations/${f}`)).join('\n'), read('tests/fixtures/agw-seed.sql'));
  const ins = d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name,
    product_slug, price, currency, in_stock, image_url, affiliate_url, last_seen_at, first_seen_at) VALUES (?, -439000043646, ?, 'bol.com', 'interior-comfort', NULL, ?, ?, ?, 'EUR', 1,
    'https://media.s-bol.com/x.jpg', ?, '${TEST_DAY} 06:00:00', '${TEST_DAY} 06:00:00')`);
  for (let i = 1; i <= 25; i++) ins.run(`-439000043646:${9200000000000 + i}`, String(9200000000000 + i), `Automatten rubber set ${i}`, `automatten-rubber-set-${i}`, 20 + i, link(i));
  return d;
}
function hgwWithBol() {
  const d = memD1(read('tests/fixtures/ggw-legacy-schema.sql'), read('tests/fixtures/hgw-seed.sql'));
  const ins = d.sql.prepare(`INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, subcategory, brand, product_name, feed_product_name,
    price, currency, stock_status, merchant_category, image_url, affiliate_url, ean, is_active, created_at, updated_at) VALUES (?, ?, 'bol.com', 'Home Decor', 'Cushion', NULL, ?, ?, ?, 'EUR',
    'in stock', 'Wonen', 'https://media.s-bol.com/y.jpg', ?, NULL, 1, '${TEST_DAY} 06:00:00', '${TEST_DAY} 06:00:00')`);
  for (let i = 1; i <= 25; i++) ins.run(`bol14035:${8700000000000 + i}`, String(8700000000000 + i), `Sierkussen velours groen ${i}`, `Sierkussen velours groen ${i}`, 15 + i, link(100 + i));
  return d;
}
const visit = (site) => {
  const worker = createWorker(site);
  return (path, env, country = '', ua = 'Mozilla/5.0 test') => {
    const req = new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': ua } });
    if (country) Object.defineProperty(req, 'cf', { value: { country } });
    return worker.fetch(req, env, { waitUntil: p => p });
  };
};
const envOf = d => ({ DB: d, CLICK_LOG: 'off', FX_FETCH: async () => { throw new Error('offline'); } });

for (const [code, make, path, word, countries] of [
  ['agw', agwWithBol, '/category/interior-comfort/', /Automatten rubber set/g, ['NL', 'BE']],
  ['hgw', hgwWithBol, '/category/home-decor/', /Sierkussen velours groen/g, ['NL']]
]) {
  test(`L204: ${code.toUpperCase()} pages: ${countries.join(' and ')} see bol.com; the UK, Google, Germany, France, Greece and the sitemaps never`, async () => {
    const site = config[code];
    const get = visit(site);
    const d = make();
    const env = envOf(d);
    const hits = html => (html.split('<main')[1] || '').match(word) || [];
    for (const cc of countries) assert.ok(hits(await (await get(path, env, cc)).text()).length > 0, `${cc}: bol.com`);
    const never = ['GB', 'DE', 'FR', 'GR', 'US', 'PL', 'IE', '', ...['BE'].filter(c => !countries.includes(c))];
    for (const cc of never) assert.equal(hits(await (await get(path, env, cc)).text()).length, 0, `${cc || 'unknown'}: no bol.com`);
    for (const cc of ['NL', 'BE', 'GB']) assert.equal(hits(await (await get(path, env, cc, GOOGLEBOT)).text()).length, 0, `Googlebot from ${cc}`);
    const sitemaps = (await (await get('/sitemap.xml', env, 'NL')).text()).match(/<loc>[^<]+<\/loc>/g) || [];
    assert.ok(sitemaps.length > 0);
    for (const loc of sitemaps) {
      const body = await (await get(new URL(loc.slice(5, -6)).pathname, env, 'NL')).text();
      assert.ok(!word.test(body), `${loc}: no bol.com product`);
      word.lastIndex = 0;
    }
    // /api/stats (the Group's numbers): bol.com counted only where it is shown, never in the UK numbers.
    const stats = await (await get('/api/stats', env, 'NL')).json();
    const bol = (stats.delivery || []).find(x => x.retailer === BOL_RETAILER);
    assert.ok(bol, 'bol.com in the delivery list');
    assert.deepEqual(bol.countries, countries);
    assert.ok(!stats.retailer_names.includes(BOL_RETAILER), 'not in the UK numbers');
  });
}
