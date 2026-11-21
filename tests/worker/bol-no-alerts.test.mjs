// bol.com products never get an alert of any kind (lessons L204): bol.com's terms say "stock alerts worden niet
// toegelaten" and its prices must be refreshed every day, so a bol.com product is never in Price Watch (the price history
// in D1 gear-world-prices), never gets "Remind me" (L182) on its page or through /api/remind, and never goes into the
// weekly deals email ("Price drops" / "Picks"). src/lib/retailer-terms.js has the rule; it knows a bol.com product by its
// name and by its partner link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { noAlerts, noAlertsSql, bolPriceKey, NO_ALERT_RETAILERS, BOL_PARTNER_PREFIX } from '../../src/lib/retailer-terms.js';
import { networkShopId } from '../../tools/tgw-import-plan.mjs';
import { PRICE_SITES } from '../../sites/prices/sites.js';
import { runOnce, siteSql } from '../../sites/prices/price-log.js';
import { createWorker } from '../../src/engine.js';
import { productPath } from '../../src/lib/text.js';
import { TEST_DAY } from './test-clock.mjs';

const read = f => readFileSync(f, 'utf8');
const LEGACY_SCHEMA = read('tests/fixtures/ggw-legacy-schema.sql');
const NEW_SCHEMA = read('sites/tgw/migrations/0001_init.sql');
const PRICES = read('sites/prices/migrations/0001_prices.sql');
const BOL_LINK = 'https://partner.bol.com/click/click?p=2&t=url&s=1559450&f=TXL&url=https%3A%2F%2Fwww.bol.com%2Fnl%2Fnl%2Fp%2Fx%2F9200000000001%2F';

test('L204: a bol.com product is known by its name or its partner link; every other shop is not', () => {
  assert.deepEqual([...NO_ALERT_RETAILERS], ['bol.com']);
  assert.equal(BOL_PARTNER_PREFIX, 'https://partner.bol.com/');
  for (const r of ['bol.com', 'BOL.COM', ' bol.com ']) assert.equal(noAlerts(r), true, r);
  assert.equal(noAlerts({ retailer: 'bol.com NL', affiliate_url: BOL_LINK }), true, 'another spelling, the partner link');
  assert.equal(noAlerts({ retailer: 'Tooled Up', affiliate_url: 'https://www.awin1.com/cread.php?awinmid=496' }), false);
  assert.equal(noAlerts('Tooled Up'), false);
  assert.equal(noAlerts(null), false);
  assert.equal(noAlerts('bol'), false, 'a different name and no partner link');
});

test('L204: the Price Watch key of a bol.com product, on the older and the newer layout', () => {
  assert.equal(bolPriceKey('bol.com:8710103000001', true), true);
  assert.equal(bolPriceKey('Tooled Up:ABC', true), false);
  assert.equal(bolPriceKey('bol.com nl:1', true, ['bol.com NL']), true);
  // The newer layout: the stable key of tools/tgw-import-plan.mjs, the bol.com shop number of every category and country.
  for (const [cat, cc] of [[43646, 'NL'], [14035, 'NL'], [1, 'BE'], [99999999, 'ZZ'], [12974, '']]) {
    const key = `${networkShopId('bol', cat, cc)}:9200000000001`;
    assert.equal(bolPriceKey(key, false), true, key);
  }
  for (const key of [`${networkShopId('daisycon', 20164, 'GB')}:R-1`, `${networkShopId('cj', 7983236)}:x`, `${networkShopId('rakuten', 1)}:y`, '496:abc', '-4:short']) {
    assert.equal(bolPriceKey(key, false), false, key);
  }
});

test('L204: the SQL that keeps bol.com out reads no bound value and leaves out the bol.com rows by name and by link', () => {
  const sql = noAlertsSql();
  assert.ok(!sql.includes('?') && !sql.includes(';'));
  for (const legacy of [true, false]) {
    const db = new DatabaseSync(':memory:');
    db.exec(legacy ? LEGACY_SCHEMA : NEW_SCHEMA);
    const add = (name, link) => (legacy
      ? db.prepare(`INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, product_name, price, stock_status, affiliate_url, is_active)
          VALUES (?, ?, ?, 'X', 'n', 5, 'in stock', ?, 1)`).run(`${name}-${link.length}`, `${name}-${link.length}`, name, link)
      : db.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, product_name, product_slug, price, image_url, affiliate_url)
          VALUES (?, 1, ?, ?, 'x', 'n', 'n', 5, 'https://i/x.jpg', ?)`).run(`${name}:${link.length}`, `${name}-${link.length}`, name, link));
    add('Tooled Up', 'https://www.awin1.com/cread.php?awinmid=496');
    add('bol.com', BOL_LINK);
    add('bol.com NL', BOL_LINK);
    add('Other', 'https://partner.bol.com.evil.example/x');
    const left = db.prepare(`SELECT retailer FROM products WHERE ${sql} ORDER BY id`).all().map(r => r.retailer);
    assert.deepEqual(left, ['Tooled Up', 'Other'], legacy ? 'older layout' : 'newer layout');
    for (const s of PRICE_SITES) assert.ok(siteSql(s).includes(sql), `${s.code}: Price Watch reads no bol.com row`);
  }
});

// ---- Price Watch (sites/prices/price-log.js): the 13 site databases with a bol.com product each ----
function fakeD1(sql) {
  const stmt = (text, args = []) => ({
    text, args,
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return {
    prepare: text => stmt(String(text)),
    async batch(list) {
      sql.exec('BEGIN');
      try { const out = list.map(s => ({ meta: { changes: Number(sql.prepare(s.text).run(...s.args).changes) } })); sql.exec('COMMIT'); return out; } catch (e) { sql.exec('ROLLBACK'); throw e; }
    }
  };
}
test('L204: Price Watch never logs a bol.com product, and writes nothing for a bol.com key it had before (not even "gone")', async () => {
  const env = { DAILY_WRITE_CAP: '' };
  for (const s of PRICE_SITES) {
    const sql = new DatabaseSync(':memory:');
    sql.exec(s.legacy ? LEGACY_SCHEMA : NEW_SCHEMA);
    if (s.legacy) {
      const ins = sql.prepare(`INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, product_name, price, stock_status, affiliate_url, is_active)
        VALUES (?, ?, ?, 'Tools', ?, ?, 'in stock', ?, 1)`);
      ins.run(`${s.code}-1`, 'A1', 'Shop One', 'Drill', 19.99, 'https://www.awin1.com/cread.php?awinmid=1');
      ins.run(`${s.code}-2`, '8710103000001', 'bol.com', 'Boormachine', 39.99, BOL_LINK);
      ins.run(`${s.code}-3`, '8710103000002', 'bol.com NL', 'Zaag', 9.99, BOL_LINK);
    } else {
      const ins = sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, product_name, product_slug, price, in_stock, image_url, affiliate_url)
        VALUES (?, ?, ?, ?, 'misc', ?, ?, ?, 1, 'https://i/x.jpg', ?)`);
      ins.run('11:A1', 11, 'A1', 'Shop One', 'Mouse', 'mouse', 19.99, 'https://www.awin1.com/cread.php?awinmid=11');
      const shop = networkShopId('bol', 43646, 'NL');
      ins.run(`${shop}:9200000000001`, shop, '9200000000001', 'bol.com', 'Automat', 'automat', 29.99, BOL_LINK);
    }
    env[s.binding] = fakeD1(sql);
  }
  const prices = new DatabaseSync(':memory:');
  prices.exec(PRICES);
  // A bol.com key from before (it would be "gone" today): nothing may be written for it.
  prices.prepare("INSERT INTO price_last (site, pkey, price, was_price, in_stock, listed, day) VALUES ('hgw', 'bol.com:8710103000009', 12, NULL, 1, 1, '2026-11-01')").run();
  prices.prepare(`INSERT INTO price_last (site, pkey, price, was_price, in_stock, listed, day) VALUES ('agw', '${networkShopId('bol', 43646, 'NL')}:9200000000009', 12, NULL, 1, 1, '2026-11-01')`).run();
  env.PRICES_DB = fakeD1(prices);
  const day = '2026-11-21';
  for (let i = 0; i < PRICE_SITES.length; i++) {
    const r = await runOnce(env, { now: Date.parse(`${day}T00:00:00Z`) + i * 15 * 60000 });
    assert.equal(r.status, 'ok', `${r.site}: ${r.error || ''}`);
    assert.equal(r.products, 1, `${r.site}: only the non-bol.com product`);
    assert.equal(r.gone, 0, `${r.site}: no bol.com key marked gone`);
  }
  const keys = prices.prepare('SELECT site, pkey FROM price_log').all().map(r => `${r.site} ${r.pkey}`);
  assert.equal(keys.length, PRICE_SITES.length);
  assert.ok(keys.every(k => / (Shop One:A1|11:A1)$/.test(k)), keys.join(', '));
  assert.equal(prices.prepare("SELECT COUNT(*) AS n FROM price_last WHERE pkey LIKE 'bol.com:%' OR pkey LIKE '-4%'").get().n, 2, 'only the two old rows, unchanged (tools/bol-remove.ps1 deletes them)');
});

// ---- "Remind me on 27 Nov" (L182) never for a bol.com product ----
const SITEKEY = '0x4AAAAAAAtest_sitekey-01';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function hub() {
  const calls = [];
  return { calls, HUB: { fetch: async (url, init = {}) => { calls.push({ url: String(url), method: init.method || 'GET' }); return json(init.method === 'POST' ? { ok: true } : { ok: true, open: true }); } } };
}
function agwDb() {
  const sql = new DatabaseSync(':memory:');
  for (const f of readdirSync('sites/agw/migrations').sort()) sql.exec(read(`sites/agw/migrations/${f}`));
  sql.exec(read('tests/fixtures/agw-seed.sql'));
  const shop = networkShopId('bol', 43646, 'NL');
  sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, product_name, product_slug, price, currency, in_stock,
    image_url, affiliate_url, last_seen_at, first_seen_at) VALUES (?, ?, '9200000000001', 'bol.com', 'interior-comfort', 'Automatten rubber set', 'automatten-rubber-set', 24.99, 'EUR', 1,
    'https://media.s-bol.com/x.jpg', ?, '${TEST_DAY} 06:00:00', '${TEST_DAY} 06:00:00')`).run(`${shop}:9200000000001`, shop, BOL_LINK);
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
test('L204: no "Remind me" box on a bol.com product page (the visitor from the Netherlands sees the product); the box stays for the others', async () => {
  const site = (await import('../../sites/agw/site.config.js')).default;
  const DB = agwDb();
  const bol = DB.sql.prepare("SELECT id, product_slug FROM products WHERE retailer = 'bol.com'").get();
  const other = DB.sql.prepare("SELECT id, product_slug FROM products WHERE retailer <> 'bol.com' AND is_active = 1 ORDER BY id LIMIT 1").get();
  const worker = createWorker(site);
  const { HUB } = hub();
  const env = { DB, FX_FETCH: async () => json([]), HUB, TURNSTILE_SITE_KEY: SITEKEY };
  const page = async (p, cc) => {
    const req = new Request(`https://${site.domain}${productPath(p)}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } });
    Object.defineProperty(req, 'cf', { value: { country: cc } });
    return (await worker.fetch(req, env, { waitUntil() {} })).text();
  };
  const nl = await page(bol, 'NL');
  assert.match(nl, /Automatten rubber set/, 'the Dutch visitor sees the bol.com product');
  assert.match(nl, /href="\/out\/\d+"/);
  assert.ok(!nl.includes('<details class="remind"'), 'no reminder box on a bol.com product');
  const gb = await page(other, 'GB');
  assert.ok(gb.includes('<details class="remind"'), 'the box is still there for the other shops');
});

test('L204: POST /api/remind refuses a bol.com product (also from the Netherlands), and the Hub is never asked', async () => {
  const site = (await import('../../sites/agw/site.config.js')).default;
  const DB = agwDb();
  const id = DB.sql.prepare("SELECT id FROM products WHERE retailer = 'bol.com'").get().id;
  const worker = createWorker(site);
  const { HUB, calls } = hub();
  const env = { DB, FX_FETCH: async () => json([]), HUB, TURNSTILE_SITE_KEY: SITEKEY };
  const req = new Request(`https://${site.domain}/api/remind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: `https://${site.domain}`, 'User-Agent': 'Mozilla/5.0 test', 'CF-Connecting-IP': '203.0.113.7' },
    body: JSON.stringify({ email: 'a@b.co', consent: true, product: String(id), turnstile_token: 'token-from-the-widget' })
  });
  Object.defineProperty(req, 'cf', { value: { country: 'NL' } });
  const r = await worker.fetch(req, env, { waitUntil() {} });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { ok: false, error: 'Reminders are not available for this product.' });
  assert.equal(calls.filter(c => c.method === 'POST').length, 0);
});

test('L204: the refusal is in the 143 dictionaries of the 13 sites', () => {
  const KEY = 'Reminders are not available for this product.';
  let files = 0;
  for (const s of readdirSync('sites')) {
    const dir = `sites/${s}/public/assets/i18n`;
    if (!existsSync(dir) || !existsSync(`sites/${s}/site.config.js`)) continue;
    for (const f of readdirSync(dir)) {
      const d = JSON.parse(read(`${dir}/${f}`));
      assert.ok(typeof d[KEY] === 'string' && d[KEY] && d[KEY] !== KEY, `${s}/${f}`);
      files++;
    }
  }
  assert.equal(files, 143);
});

test('L204: nothing on the sites or the Hub reads Price Watch; Price Watch and the alerts use the one rule', () => {
  const files = execFileSync('git', ['ls-files', 'src', 'sites/gwh', 'sites/group'], { encoding: 'utf8' }).split('\n').filter(f => /\.(m?js|html)$/.test(f) && f !== 'src/lib/retailer-terms.js');
  for (const f of files) assert.ok(!/price_last|price_log|PRICES_DB|gear-world-prices/.test(read(f)), `${f} reads Price Watch: it must leave bol.com out first (noAlerts)`);
  assert.match(read('sites/prices/price-log.js'), /import \{ noAlertsSql, bolPriceKey \} from '\.\.\/\.\.\/src\/lib\/retailer-terms\.js';/);
  assert.match(read('src/pages/product.js'), /site\.remindOpen && site\.dealTurnstileKey && !noAlerts\(product\) \? remindBox/);
  assert.match(read('src/engine.js'), /if \(noAlerts\(product\)\) return answer\(false, 'Reminders are not available for this product\.', 400\);/);
});

test('L204: the weekly deals email leaves bol.com out ("Price drops" and "Picks"), and says so', (t) => {
  const py = spawnSync('python3', ['--version']);
  if (py.status !== 0) { t.skip('no python3 here'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'bol-email-'));
  const week = JSON.parse(read('email/example-week.json'));
  week.items = [
    { section: 'drop', site: 'Car Gear World', name: 'Automatten rubber set', note: 'x', url: 'https://cargearworld.com/product/automatten-rubber-set-9/', image: 'https://media.s-bol.com/x.jpg', price: 24.99, was_price: null, retailer: 'bol.com' },
    { section: 'pick', site: 'Car Gear World', name: 'Zaag set', note: 'x', url: BOL_LINK, image: 'https://media.s-bol.com/y.jpg', price: 9.99, was_price: null, retailer: 'Someone' },
    ...week.items
  ];
  const src = join(dir, 'week.json');
  writeFileSync(src, JSON.stringify(week));
  const out = join(dir, 'email.html');
  const r = spawnSync('python3', ['-I', 'email/weekly_deals.py', '--in', src, '--out', out, '--address', '1 Test Street'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /left out \(bol\.com, no alerts allowed, L204\): 2 item\(s\)/);
  const html = read(out);
  assert.ok(!html.includes('Automatten rubber set') && !html.includes('Zaag set') && !html.includes('bol.com'));
  assert.ok(html.includes('Price checked'));
});
