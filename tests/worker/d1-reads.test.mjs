// Lessons L50: D1 bills every row a query reads. "The same product at other retailers" and "similar products" on a
// product page, and the "newest" cards of the home page, now read only the rows next to the product (or the newest
// rows) through an index. These tests prove that they show exactly what the old full queries showed: on every
// product of every site's test data, and on large random data with many equal prices, equal dates and product
// groups. With the indexes of L50, their query plans never read a whole table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { useLayout, getProduct, similarProducts, offersFor, homeData, LEGACY_GROUP_KEY } from '../../src/db.js';

const OLD_SITES = ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw'];
const configs = {};
for (const s of [...OLD_SITES, 'tgw']) configs[s] = (await import(`../../sites/${s}/site.config.js`)).default;

const read = f => readFileSync(f, 'utf8');
const schemaOf = s => (s === 'tgw' ? read('sites/tgw/migrations/0001_init.sql') : read('tests/fixtures/ggw-legacy-schema.sql'));

// A local D1 (node:sqlite) that also keeps every statement it ran, for the query plan checks.
function memD1(sqlTexts) {
  const sql = new DatabaseSync(':memory:');
  for (const t of sqlTexts) sql.exec(t);
  const log = [];
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => {
      log.push({ text, args });
      return { results: sql.prepare(text).all(...args).map(r => ({ ...r })) };
    },
    first: async () => {
      log.push({ text, args });
      const r = sql.prepare(text).get(...args);
      return r ? { ...r } : null;
    }
  });
  return { sql, log, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}

const plain = v => JSON.parse(JSON.stringify(v));

async function compareAll(db, site, ids, nears) {
  useLayout(site);
  let checked = 0;
  for (const id of ids) {
    const p = await getProduct(db, id);
    if (!p) continue;
    const want = plain(await similarProducts(db, p, 8, { full: true }));
    for (const near of nears) {
      assert.deepEqual(plain(await similarProducts(db, p, 8, { near })), want, `${site.code} similar ${id} near ${near}`);
    }
    assert.deepEqual(plain(await offersFor(db, p)), plain(await offersFor(db, p, 12, { full: true })), `${site.code} offers ${id}`);
    checked++;
  }
  const slugs = site.categories.map(c => c.slug);
  const want = plain((await homeData(db, slugs, { full: true })).newest);
  for (const near of nears) {
    assert.deepEqual(plain((await homeData(db, slugs, { near })).newest), want, `${site.code} newest near ${near}`);
  }
  return checked;
}

for (const s of [...OLD_SITES, 'tgw']) {
  test(`${s.toUpperCase()}: every product page and the home page show exactly what the full queries showed`, async () => {
    const db = memD1([schemaOf(s), read(`tests/fixtures/${s}-seed.sql`)]);
    const ids = db.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id').all().map(r => r.id);
    const checked = await compareAll(db, configs[s], ids, [undefined, 1, 2, 3]);
    assert.ok(checked >= 10, `${s}: ${checked} products checked`);
  });
}

// The indexes that lessons L50 adds to the older databases (CGW already has the first one).
const L50_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_products_active_category_price_id ON products(is_active, site_category, price, id);',
  `CREATE INDEX IF NOT EXISTS idx_products_group_key ON products(${LEGACY_GROUP_KEY});`,
  'CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(is_active, created_at);'
];

// ---- Large random data in the older layout ----
function random(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

// n products in the categories of the site, few distinct prices and dates (many ties), shared EANs, inactive rows,
// and for CGW the import's own match groups (2-4 products each, also across categories).
function randomShop(code, n, seed) {
  const r = random(seed);
  const pick = list => list[Math.floor(r() * list.length)];
  const names = Object.values(configs[code].database.categories).flat();
  const retailers = ['Shop A', 'Shop B', 'Shop C', 'Joybuy UK', 'Vevor NL'];
  const stock = ['In Stock', 'in stock', 'Out of Stock', '1', '0', 'Available to Order', ''];
  const eans = Array.from({ length: Math.ceil(n / 3) }, (_, i) => String(5000000000000 + i));
  const lines = [];
  for (let i = 1; i <= n; i++) {
    const price = pick([9.99, 10, 19.99, 25, 49.5, 50, 99, 100, 149.99, 199]) + (r() < 0.5 ? 0 : Math.floor(r() * 40) * 5);
    const ean = r() < 0.6 ? pick(eans) : '';
    const day = String(1 + Math.floor(r() * 9)).padStart(2, '0');
    const created = r() < 0.03 ? 'NULL' : `'2026-10-${day} 10:00:00'`;
    const active = r() < 0.9 ? 1 : 0;
    lines.push(`INSERT INTO products (awin_product_id, retailer, site_category, product_name, price, currency, stock_status,
      image_url, affiliate_url, ean, is_active, created_at, updated_at, specs_json) VALUES ('${900000 + i}', '${pick(retailers)}',
      '${pick(names).replace(/'/g, "''")}', 'Random product ${i}', ${price}, 'GBP', '${pick(stock)}', 'https://images.example/${i}.jpg',
      'https://www.awin1.com/cread.php?awinmid=1&awinaffid=3057233&ued=x${i}', '${ean}', ${active}, ${created}, '2026-10-18 06:00:00',
      '{"gtin":"${ean}","mpn":"M${i}"}');`);
  }
  if (configs[code].database.groupTable) {
    lines.push('CREATE TABLE IF NOT EXISTS product_group_offers (group_id INTEGER NOT NULL, product_id INTEGER NOT NULL UNIQUE, PRIMARY KEY (group_id, product_id));');
    let group = 0;
    for (let i = 1; i <= n;) {
      const size = 2 + Math.floor(r() * 3);
      if (r() < 0.35) {
        group++;
        for (let k = 0; k < size && i + k <= n; k++) lines.push(`INSERT INTO product_group_offers (group_id, product_id) VALUES (${group}, ${Math.floor(r() * n) + 1}) ON CONFLICT DO NOTHING;`);
      }
      i += size;
    }
  }
  return lines.join('\n');
}

// Same results with and without the L50 indexes (an index changes how rows are found, never which rows).
for (const [code, seed, indexed] of [['cgw', 7, false], ['cgw', 13, true], ['mgw', 11, false], ['wgw', 23, true]]) {
  test(`${code.toUpperCase()}, 900 random products${indexed ? ', L50 indexes' : ''}: same cards as the full queries, also when only 1-5 rows are read on each side`, async () => {
    const db = memD1([schemaOf(code), randomShop(code, 900, seed), ...(indexed ? L50_INDEXES : [])]);
    const ids = db.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id').all().map(r => r.id).filter((_, i) => i % 3 === 0);
    const checked = await compareAll(db, configs[code], ids, [undefined, 1, 2, 5]);
    assert.ok(checked > 240);
  });
}

// ---- Query plans with the indexes of L50 ----


// "SCAN p", "SCAN q" or "SCAN pick" read the few rows a subquery made; "SCAN products" would read the whole table.
function plansOf(db, entries) {
  return entries.map(e => db.sql.prepare('EXPLAIN QUERY PLAN ' + e.text).all(...e.args).map(r => r.detail));
}
const wholeTable = line => /^SCAN (products|product_group_offers)\b/.test(line);
// The old full queries (no "pick" list of ids in them) run only when a result cannot be proved.
const isFull = e => /ROW_NUMBER|ABS\(p\.price - \?\)/.test(e.text) && /ABS\(p\.price - \?\)|first_seen_at DESC/.test(e.text) && !/\bpick\b/.test(e.text);

// With and without ANALYZE: D1 may or may not have statistics; the plans must not depend on them.
for (const [code, analyze] of [['cgw', true], ['cgw', false], ['mgw', true], ['mgw', false]]) {
  test(`${code.toUpperCase()} with the L50 indexes${analyze ? '' : ', no statistics'}: the product page lists and the newest cards never read a whole table`, async () => {
    const extra = code === 'cgw' ? ['CREATE INDEX IF NOT EXISTS idx_product_group_offers_group ON product_group_offers(group_id);'] : [];
    const db = memD1([schemaOf(code), randomShop(code, 3000, 5), ...L50_INDEXES, ...extra, ...(analyze ? ['ANALYZE;'] : [])]);
    useLayout(configs[code]);
    const ids = db.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id').all().map(r => r.id).filter((_, i) => i % 50 === 0);
    let fullRuns = 0;
    let checked = 0;
    for (const id of ids) {
      const p = await getProduct(db, id);
      db.log.length = 0;
      await similarProducts(db, p, 8);
      await offersFor(db, p);
      const cheap = db.log.filter(e => !isFull(e));
      fullRuns += db.log.length - cheap.length;
      for (const plan of plansOf(db, cheap)) {
        checked++;
        for (const line of plan) assert.ok(!wholeTable(line), `${code} product ${id}: ${line}\n${plan.join('\n')}`);
      }
    }
    assert.ok(checked >= ids.length * 3, `${checked} plans checked`);
    assert.ok(fullRuns <= Math.ceil(ids.length * 0.05), `full query ran ${fullRuns} times for ${ids.length} products`);
    db.log.length = 0;
    await homeData(db, configs[code].categories.map(c => c.slug));
    const newest = db.log.filter(e => (/first_seen_at DESC/.test(e.text) || /\bpick\b/.test(e.text)) && !isFull(e));
    assert.equal(newest.length, 3, 'newest: the rows read, their group keys, the cards');
    for (const plan of plansOf(db, newest)) {
      for (const line of plan) assert.ok(!wholeTable(line), `${code} newest: ${line}\n${plan.join('\n')}`);
    }
  });
}
