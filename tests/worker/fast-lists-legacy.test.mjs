// Lessons L193 (18 Nov 2026): the lists of L159 on the older database layout (CGW, MGW, WGW, KGW, HGW, GGW). With the
// indexes of LEGACY_FAST_INDEX_SQL (sites/<site>/migrations/0001_fast_lists.sql) each category is walked in the page's own
// order through its view (the index named inside it), each card's other offers found through the group key (the view's
// group_key column; CGW: its import's match table), and the counts, the filters and the census come from the covering
// index. These tests prove, on random shops in each site's own layout (its category names, renamed retailers, product
// groups, stale and hidden rows, collections), that every list, count, filter, home page and stats is exactly the one of
// the old queries, without the indexes, with them, and after they are dropped; that every statement stays inside D1's
// limits (100 values, 5 SELECTs in a UNION ALL); that the walks read in index order; and that a busy database answers with
// the page's copy or 503 on these sites too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import * as db from '../../src/db.js';
import { viewFor, homeView, cacheKeyUrl } from '../../src/lib/visibility.js';
import { isDbBusy, staleKeyUrl } from '../../src/lib/http.js';
import { writeCosts } from '../../tools/legacy-refresh-plan.mjs';
import { TEST_DAY } from './test-clock.mjs';

const read = f => readFileSync(f, 'utf8');
const NOW = Date.parse(`${TEST_DAY}T12:00:00Z`);
const OLD = ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw'];
const config = {};
for (const s of [...OLD, 'agw']) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const SCHEMA = read('tests/fixtures/ggw-legacy-schema.sql');
const PGO = 'CREATE TABLE product_group_offers (group_id INTEGER NOT NULL, product_id INTEGER NOT NULL UNIQUE, PRIMARY KEY (group_id, product_id));';
// The L51 indexes every older database has (CGW's own set is larger, lessons L51).
const L51 = [
  'CREATE INDEX IF NOT EXISTS idx_products_active_category_price_id ON products(is_active, site_category, price, id);',
  `CREATE INDEX IF NOT EXISTS idx_products_group_key ON products(${db.LEGACY_GROUP_KEY});`,
  'CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(is_active, created_at);'
];

// D1's limits on one statement (the local D1 of wrangler refuses the same): at most 100 values ("too many SQL variables";
// with ?N the highest N), at most 5 SELECTs in one UNION ALL ("too many terms in compound SELECT"), 100,000 characters.
function d1Limits(text, args) {
  const numbered = [...text.matchAll(/\?(\d+)/g)].map(m => Number(m[1]));
  const values = numbered.length ? Math.max(...numbered) : args.length;
  assert.ok(values <= 100 && args.length <= 100, `too many SQL variables (${values}, ${args.length})`);
  assert.ok(text.length <= 100000, `statement of ${text.length} characters`);
  const terms = [1];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'") quoted = !quoted;
    if (quoted) continue;
    if (ch === '(') terms.push(1);
    else if (ch === ')') assert.ok(terms.pop() <= 5, 'too many terms in compound SELECT');
    else if (/^UNION\b/.test(text.slice(i, i + 6)) && !/[A-Za-z_]/.test(text[i - 1] || '')) terms[terms.length - 1]++;
  }
  assert.ok(terms.pop() <= 5, 'too many terms in compound SELECT');
}
function memD1(schema) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(schema);
  const log = [];
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => { d1Limits(text, args); log.push({ text, args }); return { results: sql.prepare(text).all(...args).map(r => ({ ...r })) }; },
    first: async () => { d1Limits(text, args); log.push({ text, args }); const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, log, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const plain = x => JSON.parse(JSON.stringify(x));
const planOf = (d, q) => d.sql.prepare(`EXPLAIN QUERY PLAN ${q.text}`).all(...q.args).map(r => r.detail);

function random(seed) {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}
// The same random shop in the site's own layout, in two databases: with the indexes of L193 (fast) and without (slow).
// Its category names (WGW: two names for Watches and for Bags), its renamed retailers ("Joybuy UK" -> "Joybuy"), shops that
// some views hide (its own deliversTo), shared EANs and GTINs in specs_json, CGW's match groups, every stock text, prices
// with many ties, inactive rows, dates missing, stale prices, empty brands.
function shop(code, seed, n = 1000, extra = '') {
  const site = config[code];
  const schema = SCHEMA + '\n' + L51.join('\n') + (site.database.groupTable ? '\n' + PGO : '');
  const fast = memD1(schema + '\n' + db.LEGACY_FAST_INDEX_SQL.join('\n') + extra);
  const slow = memD1(schema);
  const r = random(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const names = Object.values(site.database.categories).flat();
  const away = Object.keys(site.deliversTo.retailers || {}).slice(0, 3);
  const renamed = Object.keys(site.database.retailerNames || {});
  const retailers = ['Example Tools UK', 'Sample Store UK', 'Demo Supplies UK', ...renamed, ...away];
  const stock = ['In Stock', 'in stock', ' IN STOCK ', 'Out of Stock', '1', '0', 'true', 'yes', 'Available to Order', '', null];
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const ean = r() < 0.55 ? String(5000000000000 + Math.floor(r() * (n / 4))) : r() < 0.5 ? '' : null;
    const specs = ean ? null : r() < 0.3 ? JSON.stringify({ gtin: String(5000000000000 + Math.floor(r() * (n / 4))) }) : null;
    rows.push([`a${i}`, `m${i}`, pick(retailers), pick(names), pick(['Sub A', 'Sub B', 'Winter Boots', null]), pick(['Acme', 'Zeta', 'Brand 3', null, '']),
      `Item ${pick(['gift set', 'watch', 'bag', 'tool', 'boot'])} ${i}`, pick([4.99, 9.99, 10, 10.95, 19.99, 25, 49.5, 100, 149.99]), pick(['GBP', 'EUR', '', null]), pick(stock),
      ean, specs, r() < 0.9 ? 1 : 0, r() < 0.04 ? null : `2026-10-${String(1 + Math.floor(r() * 18)).padStart(2, '0')} 0${Math.floor(r() * 3)}:00:00`,
      pick(['2026-09-01 06:00:00', '2026-10-02 06:00:00', '2026-10-15 06:00:00', '2026-10-19 06:00:00', '2026-10-19 06:00:00'])]);
  }
  const groups = [];
  if (site.database.groupTable) for (let g = 1; g <= n / 8; g++) for (let k = 0; k < 2 + Math.floor(r() * 3); k++) groups.push([g, 1 + Math.floor(r() * n)]);
  for (const d of [fast, slow]) {
    const ins = d.sql.prepare(`INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, subcategory, brand, product_name, price,
      currency, stock_status, image_url, affiliate_url, ean, specs_json, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'https://img.example/x.jpg', 'https://www.awin1.com/cread.php?x=1', ?, ?, ?, ?, ?)`);
    for (const row of rows) ins.run(...row);
    const g = groups.length ? d.sql.prepare('INSERT INTO product_group_offers (group_id, product_id) VALUES (?, ?) ON CONFLICT DO NOTHING') : null;
    for (const x of groups) g.run(...x);
  }
  return { fast, slow };
}
const views = site => ({ none: null, GB: viewFor(site, 'GB', NOW), all: viewFor(site, 'BE', NOW), US: viewFor(site, 'US', NOW), PL: viewFor(site, 'PL', NOW) });

test('L193: the older layout reads fast only with every index of LEGACY_FAST_INDEX_SQL (per layout); one missing, none, or a failing database: the old reads', async () => {
  for (const code of OLD) {
    const site = config[code];
    db.useLayout(site);
    const { fast, slow } = shop(code, 1, 30);
    assert.equal(await db.fastMode(fast), true, code);
    assert.equal(await db.fastMode(slow), false, code);
    for (const name of db.LEGACY_FAST_INDEXES) {
      const partial = memD1(SCHEMA + '\n' + (site.database.groupTable ? PGO : '') + '\n' + db.LEGACY_FAST_INDEX_SQL.join('\n') + `\nDROP INDEX ${name};`);
      assert.equal(await db.fastMode(partial), false, `${code} without ${name}`);
    }
  }
  assert.equal(await db.fastMode({ prepare: () => { throw new Error('D1_ERROR: boom'); } }), false);
  // The new layout's indexes are not the older layout's, and the answer is kept per layout for the same database.
  const both = shop('mgw', 2, 30);
  db.useLayout(config.agw);
  assert.equal(await db.fastMode(both.fast), false, 'a database with the older indexes under the new layout');
  db.useLayout(config.mgw);
  assert.equal(await db.fastMode(both.fast), true, 'and under its own layout');
  const agwFast = memD1(readdirSync('sites/agw/migrations').sort().map(f => read(`sites/agw/migrations/${f}`)).join('\n'));
  assert.equal(await db.fastMode(agwFast), false, 'a new-layout database under the older layout');
});

test('L193: every older site\'s migration is exactly LEGACY_FAST_INDEX_SQL (only indexes, ASCII); the view and the indexes share the stock and group-key text', () => {
  for (const code of OLD) {
    const text = read(`sites/${code}/migrations/0001_fast_lists.sql`);
    assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(text), `${code}: ASCII only`);
    const statements = text.split('\n').filter(l => l.trim() && !l.startsWith('--'));
    assert.deepEqual(statements, db.LEGACY_FAST_INDEX_SQL, code);
    assert.ok(statements.every(l => /^CREATE INDEX IF NOT EXISTS idx_products_\w+ ON products \(/.test(l)), code);
    // Lessons L206: and the one nullable column of the extra photos (tests/worker/product-photos.test.mjs).
    assert.deepEqual(readdirSync(`sites/${code}/migrations`), ['0001_fast_lists.sql', '0002_product_images.sql'], `${code}: only the indexes and the photo column (L206)`);
    assert.ok(!existsSync(`sites/${code}/migrations/0001_init.sql`), `${code}: no table of its own (L28)`);
  }
  assert.deepEqual(db.LEGACY_FAST_INDEXES, ['idx_products_active_category', 'idx_products_active_category_price_id', 'idx_products_active_created',
    'idx_products_group_key', 'idx_products_old_featured', 'idx_products_old_newest', 'idx_products_old_cover']);
  // The first four are those the live databases have (L51 and CGW's plain category index): the same text, so the tool
  // finds them and writes nothing for them.
  const norm = s => s.toLowerCase().replace(/\s+/g, '').replace('ifnotexists', '').replace(/;$/, '');
  assert.deepEqual(db.LEGACY_FAST_INDEX_SQL.slice(1, 4).map(norm).sort(), L51.map(norm).sort());
  assert.equal(norm(db.LEGACY_FAST_INDEX_SQL[0]), norm('CREATE INDEX idx_products_active_category ON products(is_active, site_category)'));
  // The view's in_stock and the featured and cover indexes: one text, so SQLite reads the featured order from the index.
  db.useLayout(config.cgw);
  const d = memD1(SCHEMA + '\n' + PGO);
  return db.listProducts(d, { category: 'ppe' }, {}).then(() => {
    assert.ok(d.log.some(q => q.text.includes(`${db.LEGACY_IN_STOCK} AS in_stock`)));
    assert.ok(db.LEGACY_FAST_INDEX_SQL[4].includes(`(${db.LEGACY_IN_STOCK}) DESC`) && db.LEGACY_FAST_INDEX_SQL[6].includes(`(${db.LEGACY_IN_STOCK})`));
    assert.ok(db.LEGACY_FAST_INDEX_SQL[6].includes(`(${db.LEGACY_GROUP_KEY})`));
  });
});

test('L193: byNumber() names every value by its number, never a ? inside quotes', () => {
  assert.deepEqual(db.byNumber("p.a = ? AND p.b IN (?, ?) AND replace(x, '?', ' ') = ?"), { sql: "p.a = ?1 AND p.b IN (?2, ?3) AND replace(x, '?', ' ') = ?4", next: 5 });
  assert.deepEqual(db.byNumber('LIMIT ? OFFSET ?', 7), { sql: 'LIMIT ?7 OFFSET ?8', next: 9 });
  assert.deepEqual(db.byNumber('p.x = 1'), { sql: 'p.x = 1', next: 1 });
});

for (const code of OLD) {
  test(`L193 ${code.toUpperCase()}: every list, count, filter, home page and stats of fast mode is exactly the old one (random shops, 5 views, 5 sorts, filters, every page)`, async () => {
    const site = config[code];
    db.useLayout(site);
    const slugs = site.categories.map(c => c.slug);
    const sorts = ['featured', 'price-asc', 'price-desc', 'newest', 'saving'];
    const filters = [{}, { brand: 'Acme' }, { retailer: 'Sample Store UK' }, { maxPrice: 15 }, { minPrice: 40, inStock: true }];
    let lists = 0;
    const { fast, slow } = shop(code, 7 + OLD.indexOf(code));
    for (const [vn, view] of Object.entries(views(site))) {
      for (const cat of slugs) {
        for (const sort of sorts) {
          for (const extra of vn === 'GB' || vn === 'none' ? filters : filters.slice(0, 2)) {
            const f = { category: cat, view, ...extra };
            const first = plain(await db.listProducts(slow, f, { sort, page: 1, perPage: 24 }));
            for (let page = 1; page <= Math.max(1, first.pages) + 1; page++) {
              const a = page === 1 ? first : plain(await db.listProducts(slow, f, { sort, page, perPage: 24 }));
              assert.deepEqual(plain(await db.listProducts(fast, f, { sort, page, perPage: 24 })), a, `${vn} ${cat} ${sort} ${JSON.stringify(extra)} page ${page}`);
              lists++;
            }
          }
        }
        assert.deepEqual(plain(await db.facets(fast, cat, null, view)), plain(await db.facets(slow, cat, null, view)), `facets ${vn} ${cat}`);
        const subs = (site.categories.find(c => c.slug === cat) || {}).subcategories;
        if (subs) {
          assert.deepEqual(plain(await db.subcategoryCounts(fast, cat, subs, view)), plain(await db.subcategoryCounts(slow, cat, subs, view)), `subcategories ${vn} ${cat}`);
          for (const s of subs) assert.deepEqual(plain(await db.listProducts(fast, { category: cat, subcategory: s.name, view }, { sort: 'featured' })), plain(await db.listProducts(slow, { category: cat, subcategory: s.name, view }, { sort: 'featured' })));
        }
      }
      for (const q of ['gift', 'watch bag']) assert.deepEqual(plain(await db.listProducts(fast, { search: q, view }, { sort: 'featured' })), plain(await db.listProducts(slow, { search: q, view }, { sort: 'featured' })), `search ${q} ${vn}`);
      assert.deepEqual(plain(await db.listProducts(fast, { retailer: 'Sample Store UK', view }, { sort: 'price-asc' })), plain(await db.listProducts(slow, { retailer: 'Sample Store UK', view }, { sort: 'price-asc' })), `one shop ${vn}`);
      assert.deepEqual(plain(await db.homeData(fast, slugs, { view })), plain(await db.homeData(slow, slugs, { view })), `home ${vn}`);
      assert.deepEqual(plain(await db.categoryCounts(fast, view)), plain(await db.categoryCounts(slow, view)), `categoryCounts ${vn}`);
      assert.deepEqual(plain(await db.stats(fast, view, site)), plain(await db.stats(slow, view, site)), `stats ${vn}`);
    }
    assert.deepEqual(plain(await db.stats(fast, homeView(site, NOW), site)), plain(await db.stats(slow, homeView(site, NOW), site)), 'stats of the home view');
    assert.ok(lists > 900, `${lists} lists compared`);
    // Fast mode really answered them: the walks, the census and the covering index were read.
    assert.ok(fast.log.some(q => /NOT EXISTS/.test(q.text)) && fast.log.some(q => /INDEXED BY idx_products_old_cover/.test(q.text)), 'fast mode was used');
    assert.ok(!slow.log.some(q => /INDEXED BY|\?\d/.test(q.text)), 'the old reads have no index named and no numbered value');
  });
}

test('L193: a big category is walked in its sort\'s own index (no sort of the category), the other offers through the group key or CGW\'s match table; counts, filters and census from the covering index', async () => {
  const ORDER = { featured: 'idx_products_old_featured', 'price-asc': 'idx_products_active_category_price_id', 'price-desc': 'idx_products_active_category_price_id',
    newest: 'idx_products_old_newest', saving: 'idx_products_active_category' };
  for (const code of ['cgw', 'hgw']) {
    const site = config[code];
    db.useLayout(site);
    const { fast } = shop(code, 21, 3000);
    const big = Object.keys(site.database.categories)[0];
    for (const [sort, index] of Object.entries(ORDER)) {
      fast.log.length = 0;
      await db.listProducts(fast, { category: big, view: viewFor(site, 'GB', NOW) }, { sort, page: 2 });
      const walk = fast.log.find(q => /NOT EXISTS/.test(q.text));
      assert.ok(walk, `${code} ${sort}: walked`);
      const plan = planOf(fast, walk);
      assert.ok(plan.some(d => d.startsWith(`SEARCH products USING INDEX ${index} (is_active=? AND site_category=?)`)), `${code} ${sort}: ${plan.join(' | ')}`);
      assert.ok(!plan.some(d => /TEMP B-TREE FOR ORDER BY|^SCAN/.test(d)), `${code} ${sort}: no sort, no scan: ${plan.join(' | ')}`);
      if (code === 'cgw') assert.ok(plan.some(d => /SEARCH g USING (COVERING )?INDEX \S+ \(group_id=\?\)/.test(d)), `${code} ${sort}: the import's match by group_id`);
      else assert.ok(plan.filter(d => /idx_products_group_key/.test(d)).every(d => /SEARCH products USING INDEX idx_products_group_key \(<expr>=\?\)/.test(d)) && plan.some(d => /idx_products_group_key/.test(d)), `${code} ${sort}: the group key`);
      assert.ok(!/ROW_NUMBER\(\) OVER/.test(walk.text), `${code} ${sort}: no numbering`);
    }
    fast.log.length = 0;
    await db.listProducts(fast, { category: big, view: viewFor(site, 'GB', NOW) }, { sort: 'featured' });
    await db.facets(fast, big, null, viewFor(site, 'GB', NOW));
    await db.homeData(fast, site.categories.map(c => c.slug), { view: viewFor(site, 'GB', NOW) });
    for (const q of fast.log.filter(x => /INDEXED BY idx_products_old_cover/.test(x.text))) {
      const plan = planOf(fast, q).join(' | ');
      assert.match(plan, /USING COVERING INDEX idx_products_old_cover/, `${code}: ${q.text.slice(0, 80)} ${plan}`);
    }
    assert.ok(fast.log.filter(x => /INDEXED BY idx_products_old_cover/.test(x.text)).length >= 5, 'count, 3 filters, census');
    const newest = fast.log.find(x => /INDEXED BY idx_products_active_created/.test(x.text));
    const plan = planOf(fast, newest);
    assert.ok(plan.some(d => d.startsWith('SEARCH products USING INDEX idx_products_active_created (is_active=?)')) && !plan.some(d => /TEMP B-TREE FOR ORDER BY/.test(d)), `home newest: ${plan.join(' | ')}`);
    assert.ok(!fast.log.some(q => /ROW_NUMBER\(\) OVER/.test(q.text)), 'no numbering on the category page and the home page');
  }
});

test('L193: two names of one category (WGW Watches) are merged walks; a collection of 6 names (WGW Gifts for Her) in groups of 5 (D1 takes 5 SELECTs in one UNION ALL)', async () => {
  // The real WGW, Priority A included (L234, 28 Nov 2026: 13 more names hidden in the UK view): the walk of the 6 names is
  // 89,419 characters, just inside D1_SQL_CHARS. A few more hidden names and it takes the plain query (the same cards,
  // L202): then this test fails, and the next step is one hidden list per statement (chat 4).
  const site = config.wgw;
  db.useLayout(site);
  const { fast, slow } = shop('wgw', 31, 3000);
  const gifts = site.categories.find(c => c.collection).slug;
  const giftNames = site.categories.find(c => c.collection).collection.from.flatMap(c => site.database.categories[c]);
  assert.ok(giftNames.length > 5, `${giftNames.length} names`);
  for (const [cat, terms] of [['watches', 2], ['bags-accessories', 2], [gifts, giftNames.length]]) {
    for (const sort of ['featured', 'newest', 'price-desc']) {
      for (const page of [1, 3]) {
        fast.log.length = 0;
        const view = viewFor(site, 'GB', NOW);
        const b = plain(await db.listProducts(fast, { category: cat, view }, { sort, page }));
        assert.deepEqual(b, plain(await db.listProducts(slow, { category: cat, view }, { sort, page })), `${cat} ${sort} ${page}`);
        const walk = fast.log.find(q => /NOT EXISTS/.test(q.text));
        assert.ok(walk, `${cat} ${sort}: walked`);
        assert.equal((walk.text.match(/UNION ALL/g) || []).length, terms - 1, `${cat}: one walk per name`);
        if (terms > 5) assert.equal((walk.text.match(/SELECT \* FROM \(/g) || []).length, Math.ceil(terms / 5), `${cat}: groups of 5`);
        const plan = planOf(fast, walk);
        assert.ok(plan.some(d => d === 'MERGE (UNION ALL)'), `${cat} ${sort}: merged`);
        assert.equal(plan.filter(d => /^SEARCH products USING INDEX idx_products_(old_featured|old_newest|active_category_price_id) \(is_active=\? AND site_category=\?\)$/.test(d)).length, terms, `${cat} ${sort}: each name in the index`);
        assert.ok(b.products.every(p => !('fh' in p)), 'the shuffle column is not on the cards');
      }
    }
  }
});

test('L193: D1\'s 100 values: HGW\'s UK view (41 hidden retailers) with every filter is walked with each value bound once', async () => {
  const site = config.hgw;
  db.useLayout(site);
  const view = viewFor(site, 'GB', NOW);
  assert.ok(view.hidden.length >= 35, `${view.hidden.length} hidden`);
  const { fast, slow } = shop('hgw', 41, 3000);
  const f = { category: 'home-decor', view, brand: 'Acme', retailer: 'Sample Store UK', minPrice: 5, maxPrice: 200, inStock: true };
  // With every filter few rows are left (numbered, as before); with the price range only, the category is walked.
  for (const extra of [{}, { brand: '', retailer: '', inStock: false }]) {
    fast.log.length = 0;
    const b = plain(await db.listProducts(fast, { ...f, ...extra }, { sort: 'featured' }));
    assert.deepEqual(b, plain(await db.listProducts(slow, { ...f, ...extra }, { sort: 'featured' })));
  }
  const walk = fast.log.find(q => /NOT EXISTS/.test(q.text));
  // Since L199 the UK view also hides the 20 Linkwise shops (Greece only): 60 names. Since L202 they are quoted text in
  // the SQL, not values, so the walk's values are only those of the other filters, and every name is in the text.
  assert.ok(walk && walk.args.length <= 20, `${walk && walk.args.length} values`);
  for (const n of view.hidden) assert.ok(walk.text.includes(`'${n.replace(/'/g, "''")}'`), `${n} is in the SQL`);
});

test('L202: "p." and "?" inside quoted names are text, never a column or a value', () => {
  const where = "p.is_active = 1 AND likelihood(+p.retailer NOT IN ('Shop p.co', 'O''Neill p.x', 'What?') AND +p.last_seen_at >= ?, 1.0) AND p.price <= ?";
  assert.equal(db.asOther(where), "o.is_active = 1 AND likelihood(+o.retailer NOT IN ('Shop p.co', 'O''Neill p.x', 'What?') AND +o.last_seen_at >= ?, 1.0) AND o.price <= ?");
  assert.deepEqual(db.byNumber(where), { sql: "p.is_active = 1 AND likelihood(+p.retailer NOT IN ('Shop p.co', 'O''Neill p.x', 'What?') AND +p.last_seen_at >= ?1, 1.0) AND p.price <= ?2", next: 3 });
});

test('L202: 600 shops that do not deliver to the UK (names with a quote, a ? and "p."): every statement stays inside D1\'s limits, the same pages as the old queries, none of them in the UK view', async () => {
  // The new country filter (lessons L202): the hidden names are quoted text in the SQL, so the UK view of a site can hide
  // any number of shops. Before, every name was one of D1's 100 values and ~62 names was the limit (L193, L199).
  const tricky = ["O'Neill GR", 'Shop p.co GR', 'What? GR', "Bob''s GR"];
  const many = Array.from({ length: 600 }, (_, i) => `Shop ${String(i + 1).padStart(3, '0')} GR`);
  const extra = {};
  for (const n of [...tricky, ...many]) extra[n] = ['GR'];
  const base = config.hgw;
  config.hgw600 = { ...base, deliversTo: { ...base.deliversTo, retailers: { ...extra, ...base.deliversTo.retailers } } };
  try {
    const site = config.hgw600;
    db.useLayout(site);
    const view = viewFor(site, 'GB', NOW);
    assert.ok(view.hidden.length >= 604, `${view.hidden.length} hidden`);
    for (const n of tricky) assert.ok(view.hidden.includes(n), n);
    const { fast, slow } = shop('hgw600', 7, 1500);
    for (const f of [{ category: 'home-decor', view }, { category: 'home-decor', view, brand: 'Acme', minPrice: 5, maxPrice: 200, inStock: true }, { view, search: 'gift' }]) {
      for (const sort of ['featured', 'price-asc', 'newest']) {
        fast.log.length = 0;
        const a = plain(await db.listProducts(fast, f, { sort }));
        const b = plain(await db.listProducts(slow, f, { sort }));
        assert.deepEqual(a, b, `${JSON.stringify({ ...f, view: 'GB' })} ${sort}`);
        const shown = JSON.stringify(a);
        for (const n of tricky) assert.ok(!shown.includes(JSON.stringify(n).slice(1, -1)), `${n} is not in the UK view`);
        assert.ok(fast.log.length > 0);
      }
    }
    // The other views read the same way (the all view hides the Greek feeds too: their language is Greek, L165, L199).
    for (const v of [viewFor(site, 'BE', NOW), viewFor(site, 'US', NOW), viewFor(site, 'GR', NOW)]) {
      assert.deepEqual(plain(await db.listProducts(fast, { category: 'home-decor', view: v }, { sort: 'featured' })),
        plain(await db.listProducts(slow, { category: 'home-decor', view: v }, { sort: 'featured' })));
    }
  } finally {
    delete config.hgw600;
    db.useLayout(config.hgw);
  }
});

test('L193: indexes dropped, or one of another text, while fast mode thinks they are there: the same pages the old way, never an error', async () => {
  const site = config.mgw;
  db.useLayout(site);
  const view = viewFor(site, 'GB', NOW);
  const slugs = site.categories.map(c => c.slug);
  const asks = [
    d => db.listProducts(d, { category: 'clothing', view }, { sort: 'featured' }),
    d => db.listProducts(d, { category: 'clothing', view }, { sort: 'newest', page: 2 }),
    d => db.facets(d, 'clothing', null, view),
    d => db.homeData(d, slugs, { view }),
    d => db.stats(d, homeView(site, NOW), site),
    d => db.categoryCounts(d, view)
  ];
  for (const ask of asks) {
    const s = shop('mgw', 51, 400);
    assert.equal(await db.fastMode(s.fast), true);
    for (const name of db.LEGACY_FAST_INDEXES) s.fast.sql.exec(`DROP INDEX ${name}`);
    assert.deepEqual(plain(await ask(s.fast)), plain(await ask(s.slow)));
    assert.equal(await db.fastMode(s.fast), false, 'fast mode off at once');
  }
  // An index of that name that cannot walk the page (another text): "no query solution", the old way.
  const s = shop('mgw', 52, 2000);
  assert.equal(await db.fastMode(s.fast), true);
  s.fast.sql.exec('DROP INDEX idx_products_old_featured; CREATE INDEX idx_products_old_featured ON products (brand) WHERE brand IS NULL;');
  s.fast.log.length = 0;
  assert.deepEqual(plain(await db.listProducts(s.fast, { category: 'clothing', view }, { sort: 'featured' })), plain(await db.listProducts(s.slow, { category: 'clothing', view }, { sort: 'featured' })));
  assert.ok(s.fast.log.some(q => /INDEXED BY idx_products_old_featured/.test(q.text)), 'the walk was asked for');
  assert.equal(await db.fastMode(s.fast), false);
});

test('L193: the pages of the 6 older sites (their test data) are the same with and without the indexes', async () => {
  const before = globalThis.caches;
  delete globalThis.caches;
  try {
    for (const code of OLD) {
      const site = config[code];
      const seed = read(`tests/fixtures/${code}-seed.sql`).replace(/CREATE TABLE product_group_offers[^;]*;/, '');
      const schema = SCHEMA + '\n' + L51.join('\n') + '\n' + PGO;
      const slow = memD1(schema + '\n' + seed);
      const fast = memD1(schema + '\n' + db.LEGACY_FAST_INDEX_SQL.join('\n') + '\n' + seed);
      const worker = createWorker(site);
      const get = async (path, DB, cc) => {
        const req = new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } });
        Object.defineProperty(req, 'cf', { value: { country: cc } });
        const res = await worker.fetch(req, { DB, CLICK_LOG: 'off', EDGE_CACHE: 'off', FX_FETCH: async () => { throw new Error('offline'); } }, { waitUntil: p => p });
        return `${res.status} ${await res.text()}`;
      };
      const paths = ['/', '/api/stats', '/sitemap-static.xml', '/search?q=black', '/api/products?limit=24'];
      for (const c of site.categories) paths.push(`/category/${c.slug}/`, `/category/${c.slug}/?page=2`, `/category/${c.slug}/?sort=price-desc&stock=1`, `/category/${c.slug}/?sort=newest&max=30`,
        `/api/products?category=${encodeURIComponent(c.name)}&limit=60`, `/api/products?category=${c.slug}&limit=7&page=2&sort=saving`);
      // Greece: the view of the Linkwise shops (L199).
      for (const cc of ['GB', 'DE', 'US', 'GR']) {
        for (const path of paths) assert.equal(await get(path, fast, cc), await get(path, slow, cc), `${code} ${cc} ${path}`);
      }
      assert.ok(fast.log.some(q => /NOT EXISTS/.test(q.text)), `${code}: fast mode was used`);
    }
  } finally {
    if (before !== undefined) globalThis.caches = before;
  }
});

test('L193: a busy database on an older site gives the page\'s day-long copy, else 503 with Retry-After; too many SQL variables or any other error stays 500', async () => {
  assert.equal(isDbBusy(new Error('D1_ERROR: too many SQL variables at offset 6671: SQLITE_ERROR')), false);
  assert.equal(isDbBusy(new Error('D1 DB is overloaded. Too many resources consumed within a 10 second window.')), true);
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  const site = config.cgw;
  const worker = createWorker(site);
  const good = memD1(SCHEMA + '\n' + PGO + '\n' + db.LEGACY_FAST_INDEX_SQL.join('\n') + '\n' + read('tests/fixtures/cgw-seed.sql').replace(/CREATE TABLE product_group_offers[^;]*;/, ''));
  const failing = message => ({ prepare: () => { throw new Error(message); }, batch: async () => { throw new Error(message); } });
  const get = (path, DB) => {
    const req = new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } });
    Object.defineProperty(req, 'cf', { value: { country: 'GB' } });
    return worker.fetch(req, { DB, CLICK_LOG: 'off', FX_FETCH: async () => { throw new Error('offline'); } }, { waitUntil: p => p });
  };
  try {
    const ok = await get('/category/power-tools/', good);
    assert.equal(ok.status, 200);
    const okHtml = await ok.text();
    const key = cacheKeyUrl(`https://${site.domain}/category/power-tools/`, viewFor(site, 'GB', NOW));
    assert.ok(store.has(key) && store.has(staleKeyUrl(key)));
    store.delete(key);
    const stale = await get('/category/power-tools/', failing('D1_ERROR: Currently processing a long-running import.'));
    assert.equal(stale.status, 200);
    assert.equal(stale.headers.get('X-GW-Stale'), '1');
    assert.equal(await stale.text(), okHtml);
    const none = await get('/category/ppe/', failing('D1 DB is overloaded. Too many resources consumed.'));
    assert.equal(none.status, 503);
    assert.equal(none.headers.get('Retry-After'), '60');
    for (const message of ['D1_ERROR: too many SQL variables at offset 10: SQLITE_ERROR', 'D1_ERROR: no such table: products']) {
      const err = await get('/category/workwear/', failing(message));
      assert.equal(err.status, 500, message);
      assert.equal(err.headers.get('Retry-After'), null);
    }
  } finally {
    if (before === undefined) delete globalThis.caches; else globalThis.caches = before;
  }
});

test('L193: rows written by a refresh change with the fast-list indexes (measured with the local D1 of wrangler, tools/d1-fast-lists-bench.mjs)', () => {
  // The MGW layout (the fixture's indexes, the L51 indexes and the search trigger that fires on every update, lessons L59),
  // measured on 20,000 and 1,000,000 products: before 4/3/3/6 (price, picture, stock, hide), with the indexes 5/4/5/10. The
  // picture costs one more too: every refresh UPDATE sets updated_at, which idx_products_old_cover holds.
  const asMaster = sql => ({ sql: sql.replace(/;$/, '').replace(' IF NOT EXISTS', '') });
  const base = [...SCHEMA.match(/CREATE (UNIQUE )?INDEX [^;]*/g), ...L51, SCHEMA.match(/CREATE TRIGGER products_fts_au[\s\S]*?END/)[0]].map(asMaster);
  assert.deepEqual(writeCosts(base), { price: 4, image_url: 3, stock_status: 3, is_active: 6 });
  const added = db.LEGACY_FAST_INDEX_SQL.filter(s => !/idx_products_(active_category_price_id|group_key|active_created) /.test(s));
  assert.equal(added.length, 4);
  assert.deepEqual(writeCosts([...base, ...added.map(asMaster)]), { price: 5, image_url: 4, stock_status: 5, is_active: 10 });
});
