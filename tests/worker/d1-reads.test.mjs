// Lessons L51: D1 bills every row a query reads. "The same product at other retailers" and "similar products" on a
// product page, and the "newest" cards of the home page, now read only the rows next to the product (or the newest
// rows) through an index. These tests prove that they show exactly what the old full queries showed: on every
// product of every site's test data, and on large random data with many equal prices, equal dates and product
// groups. With the indexes of L51, their query plans never read a whole table.
// Lessons L105: the same on the new layout (TGW, AGW, VGW, SGW, BGW, PGW, ZGW), with its index idx_products_group_key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { useLayout, getProduct, similarProducts, offersFor, homeData, LEGACY_GROUP_KEY, NATIVE_GROUP_KEY, GTIN_KEY } from '../../src/db.js';

const OLD_SITES = ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw'];
// The sites with their own database in the new layout (sites/<site>/migrations).
const NEW_SITES = ['tgw', 'agw', 'vgw', 'sgw', 'bgw', 'pgw', 'zgw'];
const configs = {};
for (const s of [...OLD_SITES, ...NEW_SITES]) configs[s] = (await import(`../../sites/${s}/site.config.js`)).default;

const read = f => readFileSync(f, 'utf8');
// The new layout: every migration of the site in order (0001 the tables, 0002 the group-key index of L105).
const migrationsOf = s => readdirSync(`sites/${s}/migrations`).filter(f => f.endsWith('.sql')).sort().map(f => read(`sites/${s}/migrations/${f}`));
const schemaOf = s => (NEW_SITES.includes(s) ? migrationsOf(s).join('\n') : read('tests/fixtures/ggw-legacy-schema.sql'));
// The new layout as the live databases were before L105: only the tables of 0001 (no group-key index).
const firstMigrationOf = s => read(`sites/${s}/migrations/0001_init.sql`);

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

for (const s of [...OLD_SITES, ...NEW_SITES]) {
  test(`${s.toUpperCase()}: every product page and the home page show exactly what the full queries showed`, async () => {
    const db = memD1([schemaOf(s), read(`tests/fixtures/${s}-seed.sql`)]);
    const ids = db.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id').all().map(r => r.id);
    const checked = await compareAll(db, configs[s], ids, [undefined, 1, 2, 3]);
    assert.ok(checked >= 10, `${s}: ${checked} products checked`);
  });
}

// The live new-layout databases until the L105 index is added: same results (an index never changes which rows).
for (const s of NEW_SITES) {
  test(`${s.toUpperCase()} without the L105 index: every product page shows exactly what the full queries showed`, async () => {
    const db = memD1([firstMigrationOf(s), read(`tests/fixtures/${s}-seed.sql`)]);
    const ids = db.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id').all().map(r => r.id);
    const checked = await compareAll(db, configs[s], ids, [undefined, 2]);
    assert.ok(checked >= 10, `${s}: ${checked} products checked`);
  });
}

// The indexes that lessons L51 adds to the older databases (CGW already has the first one).
const L51_INDEXES = [
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

// Same results with and without the L51 indexes (an index changes how rows are found, never which rows).
for (const [code, seed, indexed] of [['cgw', 7, false], ['cgw', 13, true], ['mgw', 11, false], ['wgw', 23, true]]) {
  test(`${code.toUpperCase()}, 900 random products${indexed ? ', L51 indexes' : ''}: same cards as the full queries, also when only 1-5 rows are read on each side`, async () => {
    const db = memD1([schemaOf(code), randomShop(code, 900, seed), ...(indexed ? L51_INDEXES : [])]);
    const ids = db.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id').all().map(r => r.id).filter((_, i) => i % 3 === 0);
    const checked = await compareAll(db, configs[code], ids, [undefined, 1, 2, 5]);
    assert.ok(checked > 240);
  });
}

// ---- Query plans with the indexes of L51 ----


// "SCAN p", "SCAN q" or "SCAN pick" read the few rows a subquery made; "SCAN products" would read the whole table.
function plansOf(db, entries) {
  return entries.map(e => db.sql.prepare('EXPLAIN QUERY PLAN ' + e.text).all(...e.args).map(r => r.detail));
}
const wholeTable = line => /^SCAN (products|product_group_offers)\b/.test(line);
// The old full queries (no "pick" list of ids in them) run only when a result cannot be proved.
const isFull = e => /ROW_NUMBER|ABS\(p\.price - \?\)/.test(e.text) && /ABS\(p\.price - \?\)|first_seen_at DESC/.test(e.text) && !/\bpick\b/.test(e.text);
// The two reads next to the price. Each must walk the category+price index: sorting all the rows of a side
// ("USE TEMP B-TREE FOR ORDER BY") would read them all; sorting only the ids of one price ("LAST TERM") is fine.
const isSide = e => /p\.price (>=|<) \?\s+ORDER BY p\.price/.test(e.text);
// L105: below the price the side is read backwards along the index, and the price block where it stopped once more
// from its lowest id ("p.price = ?"): neither may sort, not even one price block ("LAST TERM"), which read whole blocks.
const isBlock = e => /p\.price = \?\s+ORDER BY p\.id ASC/.test(e.text);
function assertSidePlan(plan, label, index = 'idx_products_active_category_price_id') {
  assert.ok(plan.some(line => new RegExp(`USING (COVERING )?INDEX ${index}\\b`).test(line)), `${label}: ${plan.join(' | ')}`);
  assert.ok(!plan.some(line => /TEMP B-TREE/.test(line)), `${label}: ${plan.join(' | ')}`);
}

// ---- Many products at one price (lessons L51) ----
// Real shops sell hundreds of products at one price (CGW: 873 at £10.95 in one category on 24 Oct 2026; about half
// of CGW's products and 40% of MGW's and WGW's share their price with more than 40 others). Then all the rows read on
// a side can be at the same distance from the price. The first version compared distances only, could not prove
// those pages and ran the full query on them. The id decides between equal distances, as in the full query.
function blockShop(code, seed) {
  const r = random(seed);
  const names = Object.values(configs[code].database.categories).flat();
  const eans = Array.from({ length: 30 }, (_, i) => String(6000000000000 + i));
  const rows = [];
  for (const [price, n] of [[44.99, 120], [39.99, 100], [41, 3], [49.99, 60], [45.5, 2], [10.95, 90], [11.95, 85], [9.95, 45]]) {
    for (let k = 0; k < n; k++) rows.push([price, names[0]]);
  }
  for (let k = 0; k < 60; k++) rows.push([5 + Math.floor(r() * 19500) / 100, names[0]]);
  for (let k = 0; k < 50; k++) rows.push([44.99, names[1]]);
  // Ids in random order, not price order.
  for (let k = rows.length - 1; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [rows[k], rows[j]] = [rows[j], rows[k]];
  }
  const stock = ['In Stock', 'Out of Stock', 'in stock', '0'];
  const lines = rows.map(([price, cat], i) => {
    const ean = r() < 0.15 ? eans[Math.floor(r() * eans.length)] : '';
    return `INSERT INTO products (awin_product_id, retailer, site_category, product_name, price, currency, stock_status,
      image_url, affiliate_url, ean, is_active, created_at, updated_at, specs_json) VALUES ('${800000 + i}', 'Shop ${1 + Math.floor(r() * 4)}',
      '${cat.replace(/'/g, "''")}', 'Block product ${i}', ${price}, 'GBP', '${stock[Math.floor(r() * stock.length)]}', 'https://images.example/b${i}.jpg',
      'https://www.awin1.com/cread.php?awinmid=1&awinaffid=3057233&ued=b${i}', '${ean}', ${r() < 0.95 ? 1 : 0}, '2026-10-0${1 + Math.floor(r() * 9)} 10:00:00',
      '2026-10-18 06:00:00', '{"gtin":"${ean}"}');`;
  });
  if (configs[code].database.groupTable) {
    lines.push('CREATE TABLE IF NOT EXISTS product_group_offers (group_id INTEGER NOT NULL, product_id INTEGER NOT NULL UNIQUE, PRIMARY KEY (group_id, product_id));');
    for (let g = 1; g <= 40; g++) {
      for (let k = 0; k < 3; k++) lines.push(`INSERT INTO product_group_offers (group_id, product_id) VALUES (${g}, ${1 + Math.floor(r() * rows.length)}) ON CONFLICT DO NOTHING;`);
    }
  }
  return lines.join('\n');
}

for (const code of ['mgw', 'cgw']) {
  test(`${code.toUpperCase()}: with hundreds of products at one price, every product page still reads only the rows next to its price and shows the same cards`, async () => {
    const extra = code === 'cgw' ? ['CREATE INDEX IF NOT EXISTS idx_product_group_offers_group ON product_group_offers(group_id);'] : [];
    const db = memD1([schemaOf(code), blockShop(code, 3), ...L51_INDEXES, ...extra]);
    useLayout(configs[code]);
    const ids = db.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id').all().map(r => r.id);
    let fullRuns = 0;
    let sides = 0;
    let blocks = 0;
    for (const id of ids) {
      const p = await getProduct(db, id);
      db.log.length = 0;
      const fast = plain(await similarProducts(db, p, 8));
      fullRuns += db.log.filter(isFull).length;
      for (const [i, plan] of plansOf(db, db.log.filter(isSide)).entries()) {
        assertSidePlan(plan, `${code} product ${id} side ${i}`);
        sides++;
      }
      for (const plan of plansOf(db, db.log.filter(isBlock))) {
        assertSidePlan(plan, `${code} product ${id} price block`);
        blocks++;
      }
      assert.deepEqual(fast, plain(await similarProducts(db, p, 8, { full: true })), `${code} similar ${id}`);
      assert.deepEqual(plain(await offersFor(db, p)), plain(await offersFor(db, p, 12, { full: true })), `${code} offers ${id}`);
    }
    assert.ok(ids.length > 500 && sides === ids.length * 2, `${ids.length} products, ${sides} side reads`);
    assert.ok(blocks > ids.length / 2, `${blocks} price blocks read again from their lowest id`);
    assert.equal(fullRuns, 0, `the full query ran for ${fullRuns} of ${ids.length} products`);
  });
}

// With and without ANALYZE: D1 may or may not have statistics; the plans must not depend on them.
for (const [code, analyze] of [['cgw', true], ['cgw', false], ['mgw', true], ['mgw', false]]) {
  test(`${code.toUpperCase()} with the L51 indexes${analyze ? '' : ', no statistics'}: the product page lists and the newest cards never read a whole table`, async () => {
    const extra = code === 'cgw' ? ['CREATE INDEX IF NOT EXISTS idx_product_group_offers_group ON product_group_offers(group_id);'] : [];
    const db = memD1([schemaOf(code), randomShop(code, 3000, 5), ...L51_INDEXES, ...extra, ...(analyze ? ['ANALYZE;'] : [])]);
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

// ---- The new layout (lessons L105) ----
// On 6-8 Nov 2026 D1 read about 1 billion rows a day: an SEO crawler opened about 1,000 AGW product pages an hour, and
// each read about 62,000 rows. "The same product at other retailers" read the whole table (no index on the group key)
// and the cards of "similar products" the whole category. Now both read the rows of the groups through
// idx_products_group_key (sites/<site>/migrations/0002_group_key_index.sql), with exactly the same results.

const NEW_INDEX = `CREATE INDEX IF NOT EXISTS idx_products_group_key ON products(${NATIVE_GROUP_KEY});`;

// A table scan in a plan: "SCAN products", or "SCAN p" when p is the table itself (the new layout names its table p)
// and not one of the plan's own subqueries (CO-ROUTINE p / MATERIALIZE p read only the rows a subquery made).
function wholeTableLines(plan) {
  const subqueries = new Set(plan.map(l => (l.match(/^(?:CO-ROUTINE|MATERIALIZE) (\S+)/) || [])[1]).filter(Boolean));
  return plan.filter(l => {
    const m = l.match(/^SCAN (\S+)/);
    return Boolean(m) && /^(products|product_group_offers|p)$/.test(m[1]) && !subqueries.has(m[1]);
  });
}

const sq = v => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
function newRow(i, { adv, retailer, cat, price, wasPrice = null, gtin, active, inStock, day }) {
  return `INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, product_name,
    product_slug, price, was_price, currency, in_stock, image_url, affiliate_url, gtin, is_active, first_seen_at, last_seen_at)
    VALUES (${sq(`${adv}:R${i}`)}, ${adv}, ${sq(`R${i}`)}, ${sq(retailer)}, ${sq(cat)}, ${sq(`Random product ${i}`)},
    ${sq(`random-product-${i}`)}, ${price}, ${wasPrice === null ? 'NULL' : wasPrice}, 'GBP', ${inStock}, ${sq(`https://images.example/${i}.jpg`)},
    ${sq(`https://www.awin1.com/cread.php?awinmid=${adv}&awinaffid=1&ued=x${i}`)}, ${sq(gtin)}, ${active}, ${sq(`2026-10-0${day} 10:00:00`)},
    '2026-10-18 06:00:00');`;
}
const RETAILERS = [[90101, 'Shop A'], [90102, 'Shop B'], [90103, 'Shop C'], [90104, 'VEVOR'], [90105, 'Shop E']];
const newCats = code => configs[code].categories.filter(c => !c.collection).map(c => c.slug);

// n products of a new-layout site: few distinct prices and dates (many ties), shared EANs (also across categories and
// at the same retailer), EANs with spaces around them, empty, blank and missing EANs, inactive and out-of-stock rows.
function randomNewShop(code, n, seed) {
  const r = random(seed);
  const pick = list => list[Math.floor(r() * list.length)];
  const cats = newCats(code);
  const eans = Array.from({ length: Math.ceil(n / 3) }, (_, i) => String(5000000000000 + i));
  const lines = [];
  for (let i = 1; i <= n; i++) {
    const [adv, retailer] = pick(RETAILERS);
    const price = pick([9.99, 10, 19.99, 25, 49.5, 50, 99, 100, 149.99, 199]) + (r() < 0.5 ? 0 : Math.floor(r() * 40) * 5);
    const x = r();
    const gtin = x < 0.55 ? pick(eans) : x < 0.62 ? ` ${pick(eans)} ` : x < 0.72 ? '' : x < 0.77 ? '  ' : null;
    const wasPrice = r() < 0.2 ? Math.round(price * 1.3 * 100) / 100 : null;
    lines.push(newRow(i, { adv, retailer, cat: pick(cats), price, wasPrice, gtin, active: r() < 0.9 ? 1 : 0, inStock: r() < 0.7 ? 1 : 0, day: 1 + Math.floor(r() * 9) }));
  }
  return lines.join('\n');
}

// Hundreds of products at one price in one category (like the older sites, L51), ids in random order, some EAN groups.
function blockNewShop(code, seed) {
  const r = random(seed);
  const cats = newCats(code);
  const eans = Array.from({ length: 30 }, (_, i) => String(6000000000000 + i));
  const rows = [];
  for (const [price, n] of [[44.99, 120], [39.99, 100], [41, 3], [49.99, 60], [45.5, 2], [10.95, 90], [11.95, 85], [9.95, 45]]) {
    for (let k = 0; k < n; k++) rows.push([price, cats[0]]);
  }
  for (let k = 0; k < 60; k++) rows.push([5 + Math.floor(r() * 19500) / 100, cats[0]]);
  for (let k = 0; k < 50; k++) rows.push([44.99, cats[1]]);
  for (let k = rows.length - 1; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [rows[k], rows[j]] = [rows[j], rows[k]];
  }
  return rows.map(([price, cat], i) => {
    const [adv, retailer] = RETAILERS[Math.floor(r() * 4)];
    const gtin = r() < 0.15 ? eans[Math.floor(r() * eans.length)] : null;
    return newRow(i + 1, { adv, retailer, cat, price, gtin, active: r() < 0.95 ? 1 : 0, inStock: r() < 0.5 ? 1 : 0, day: 1 + Math.floor(r() * 9) });
  }).join('\n');
}

test('L105: every new-layout site that groups offers has the index, written in exactly the text of the code\'s group key', () => {
  // The key on the rows named p is the same expression on the same columns.
  assert.equal(GTIN_KEY, NATIVE_GROUP_KEY.replace('TRIM(gtin)', 'TRIM(p.gtin)').replace("'id:' || id", "'id:' || p.id"));
  // Every site with its own database in the new layout (a products table in 0001_init.sql) is in the list.
  const own = readdirSync('sites').filter(d => {
    try { return /CREATE TABLE products\b/.test(read(`sites/${d}/migrations/0001_init.sql`)); } catch { return false; }
  }).sort();
  assert.deepEqual(own, [...NEW_SITES].sort());
  const grouping = NEW_SITES.filter(s => configs[s].groupOffers);
  assert.deepEqual(grouping, ['agw', 'vgw', 'sgw', 'bgw', 'pgw', 'zgw']);
  const tool = read('tools/d1-native-index.ps1');
  for (const s of NEW_SITES) {
    assert.ok(!configs[s].database || configs[s].database.layout !== 'legacy', `${s}: new layout`);
    const db = (read(`sites/${s}/wrangler.jsonc.example`).match(/"database_name":\s*"([^"]+)"/) || [])[1];
    const listed = new RegExp(`code = '${s}'; db = '${db}'`).test(tool);
    if (!configs[s].groupOffers) {
      // TGW: its product pages never use the group key, so its database gets no index (it would only cost writes).
      assert.ok(!readdirSync(`sites/${s}/migrations`).includes('0002_group_key_index.sql'), `${s}: no group-key index`);
      assert.ok(!listed, `${s}: not in the tool`);
      continue;
    }
    const text = read(`sites/${s}/migrations/0002_group_key_index.sql`);
    assert.ok(text.includes(NEW_INDEX), `${s}: ${NEW_INDEX}`);
    // Only an index: the migration changes no table and no row (L28).
    const statements = text.split('\n').filter(l => l.trim() && !l.startsWith('--'));
    assert.deepEqual(statements, [NEW_INDEX], `${s}: one CREATE INDEX only`);
    // The tool that adds it to the live databases (and checks it before every deploy) knows it.
    assert.ok(db && listed, `${s}: ${db} in the tool`);
  }
  assert.equal((tool.match(/@\{ code = '[a-z]{3}'; db = /g) || []).length, grouping.length, 'the tool lists exactly these databases');
  assert.ok(tool.includes(`'${NEW_INDEX.replace(/'/g, "''")}'`), 'the tool sends exactly the migration\'s statement');
});

// Same results as the full queries on large random data, with and without the index.
for (const [code, seed, indexed] of [['agw', 7, true], ['vgw', 11, false], ['zgw', 13, true], ['pgw', 19, true], ['tgw', 17, false]]) {
  test(`${code.toUpperCase()}, 900 random products${indexed ? ', L105 index' : ', no index'}: same cards and offers as the full queries, also when only 1-5 rows are read on each side`, async () => {
    const db = memD1([firstMigrationOf(code), randomNewShop(code, 900, seed), ...(indexed ? [NEW_INDEX] : [])]);
    const ids = db.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id').all().map(r => r.id).filter((_, i) => i % 3 === 0);
    const checked = await compareAll(db, configs[code], ids, [undefined, 1, 2, 5]);
    assert.ok(checked > 240);
  });
}

for (const code of ['agw', 'sgw', 'tgw']) {
  test(`${code.toUpperCase()}: with hundreds of products at one price, every product page reads only the rows next to its price and the rows of their groups, with the same cards`, async () => {
    const db = memD1([schemaOf(code), blockNewShop(code, 3)]);
    useLayout(configs[code]);
    const ids = db.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id').all().map(r => r.id);
    let fullRuns = 0;
    let sides = 0;
    let blocks = 0;
    for (const id of ids) {
      const p = await getProduct(db, id);
      db.log.length = 0;
      const fast = plain(await similarProducts(db, p, 8));
      const offers = plain(await offersFor(db, p));
      fullRuns += db.log.filter(isFull).length;
      for (const [i, plan] of plansOf(db, db.log.filter(isSide)).entries()) {
        assertSidePlan(plan, `${code} product ${id} side ${i}`, 'idx_products_category');
        sides++;
      }
      for (const plan of plansOf(db, db.log.filter(isBlock))) {
        assertSidePlan(plan, `${code} product ${id} price block`, 'idx_products_category');
        blocks++;
      }
      for (const plan of plansOf(db, db.log)) assert.deepEqual(wholeTableLines(plan), [], `${code} product ${id}: ${plan.join(' | ')}`);
      assert.deepEqual(fast, plain(await similarProducts(db, p, 8, { full: true })), `${code} similar ${id}`);
      assert.deepEqual(offers, plain(await offersFor(db, p, 12, { full: true })), `${code} offers ${id}`);
    }
    assert.ok(ids.length > 500 && sides === ids.length * 2, `${ids.length} products, ${sides} side reads`);
    assert.ok(blocks > ids.length / 2, `${blocks} price blocks read again from their lowest id`);
    assert.equal(fullRuns, 0, `the full query ran for ${fullRuns} of ${ids.length} products`);
  });
}

// With and without ANALYZE: D1 may or may not have statistics; the plans must not depend on them.
for (const [code, analyze] of [['agw', true], ['agw', false], ['bgw', true], ['zgw', false], ['tgw', true], ['tgw', false]]) {
  test(`${code.toUpperCase()}${configs[code].groupOffers ? ' with the L105 index' : ' (no group-key index)'}${analyze ? '' : ', no statistics'}: the product page queries never read a whole table, and find the groups through the index`, async () => {
    const db = memD1([schemaOf(code), randomNewShop(code, 3000, 5), ...(analyze ? ['ANALYZE;'] : [])]);
    useLayout(configs[code]);
    const ids = db.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id').all().map(r => r.id).filter((_, i) => i % 50 === 0);
    let fullRuns = 0;
    let checked = 0;
    let grouped = 0;
    for (const id of ids) {
      db.log.length = 0;
      const p = await getProduct(db, id);
      await similarProducts(db, p, 8);
      await offersFor(db, p);
      const cheap = db.log.filter(e => !isFull(e));
      fullRuns += db.log.length - cheap.length;
      for (const [i, plan] of plansOf(db, cheap).entries()) {
        checked++;
        assert.deepEqual(wholeTableLines(plan), [], `${code} product ${id}: ${plan.join('\n')}`);
        if (/\bpick\b/.test(cheap[i].text)) {
          assert.ok(plan.some(line => /^SEARCH products USING (COVERING )?INDEX idx_products_group_key/.test(line)), `${code} product ${id}: ${plan.join('\n')}`);
          grouped++;
        }
      }
    }
    assert.ok(checked >= ids.length * 3, `${checked} plans checked`);
    if (configs[code].groupOffers) assert.ok(grouped >= ids.length, `${grouped} group reads through the index`);
    else assert.equal(grouped, 0, 'TGW does not group offers: no group reads');
    assert.ok(fullRuns <= Math.ceil(ids.length * 0.05), `full query ran ${fullRuns} times for ${ids.length} products`);
  });
}

// Why the index is needed: without it the same query reads the whole table (what the live sites did until L105).
test('AGW without the L105 index: "the same product at other retailers" reads the whole table; with it, only its group', async () => {
  for (const indexed of [false, true]) {
    const db = memD1([firstMigrationOf('agw'), randomNewShop('agw', 600, 29), ...(indexed ? [NEW_INDEX] : [])]);
    useLayout(configs.agw);
    const id = db.sql.prepare("SELECT id FROM products WHERE is_active = 1 AND TRIM(COALESCE(gtin, '')) <> '' ORDER BY id LIMIT 1").get().id;
    const p = await getProduct(db, id);
    db.log.length = 0;
    await offersFor(db, p);
    assert.equal(db.log.length, 1);
    const whole = wholeTableLines(plansOf(db, db.log)[0]);
    assert.equal(whole.length > 0, !indexed, `${indexed ? 'with' : 'without'} the index: ${whole.join(' | ')}`);
  }
});
