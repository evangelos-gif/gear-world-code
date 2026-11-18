#!/usr/bin/env node
// Lessons L193: the lists of the older sites (CGW, MGW, WGW, KGW, HGW, GGW) at 1,000,000 products, before and after the
// indexes of LEGACY_FAST_INDEX_SQL (sites/<site>/migrations/0001_fast_lists.sql), measured the way lessons L105 and L159
// ask: the real engine on the local D1 of wrangler (Miniflare), every page as a UK visitor gets it, with D1's own rows
// read (meta.rows_read) and the time of the page. Synthetic products only (no feed data): the site's own category names
// (one big category, 40% of the rows; WGW also a second name for Watches), its renamed retailers, shops that only some
// countries see, product groups by EAN (CGW: its import's match table too), prices with many ties, stale prices.
//
//   node tools/d1-fast-lists-bench.mjs --site cgw [--rows 1000000] [--deep 40,400] [--detail <path>] [--out <file>]
//
// 1. Loads the products into the older layout as it is live (tests/fixtures/ggw-legacy-schema.sql with the L51 indexes;
//    CGW with its 13 live indexes and product_group_offers), without the new indexes.
// 2. Before: every page with the old reads (fast mode off: the indexes are not all there).
// 3. Adds the indexes one by one (CREATE INDEX IF NOT EXISTS, rows written and time of each), then every page again.
// 4. Compares: the same HTML of every page (the same cards, counts, filters and order), and the same answers of
//    listProducts, facets, homeData, categoryCounts and stats; then the pages' D1 work again with the counts kept (as the
//    Worker keeps them for 15 minutes, the census 1 hour).
// 5. Rows written by a refresh change (price, picture, stock, hide) before and after, against writeCosts() of
//    tools/legacy-refresh-plan.mjs (lessons L57, L59).
// Nothing leaves this computer; wrangler keeps the local database in a temporary folder that is removed at the end.
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SITE = opt('site', 'cgw');
const ROWS = Number(opt('rows', '1000000'));
const DEEP = String(opt('deep', '40,400')).split(',').map(Number).filter(n => n > 1);

// The big category, a shop that only some EU countries see and a US-only shop of each site (their own deliversTo).
const PROFILES = {
  cgw: { big: 'Hand Tools', eu: 'Vevor NL', us: 'Tameson' },
  mgw: { big: 'Clothing', eu: 'Invicta Stores', us: 'TEMU' },
  wgw: { big: 'Clothing', eu: 'FOREO', us: 'TEMU', second: 'Jewellery & Watches' },
  kgw: { big: 'Clothing', eu: 'Bazta IE', us: 'TEMU' },
  hgw: { big: 'Home Decor', eu: 'SwitchBot', us: 'TEMU' },
  ggw: { big: 'Garden Tools', eu: 'Bazta IE', us: 'TEMU' }
};
// The L51 indexes of every older database, and CGW's 13 live indexes (sqlite_master, 9 Nov 2026, tools/d1-view-bench.mjs).
const L51 = [
  'CREATE INDEX IF NOT EXISTS idx_products_active_category_price_id ON products(is_active, site_category, price, id)',
  "CREATE INDEX IF NOT EXISTS idx_products_group_key ON products(COALESCE(NULLIF(TRIM(COALESCE(NULLIF(TRIM(ean), ''), json_extract(specs_json, '$.gtin'))), ''), 'id:' || id))",
  'CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(is_active, created_at)'
];
const CGW_LIVE = [
  'CREATE INDEX idx_products_active_category ON products(is_active, site_category)',
  'CREATE INDEX idx_products_active_price ON products(is_active, price)',
  'CREATE INDEX idx_products_active_brand ON products(is_active, brand)',
  'CREATE INDEX idx_products_active_id ON products(is_active, id)',
  'CREATE INDEX idx_products_active_featured ON products(is_active, ((id * 1103515245 + 12345) % 2147483647))',
  'CREATE INDEX idx_products_active_category_featured ON products(is_active, site_category, ((id * 1103515245 + 12345) % 2147483647))',
  'CREATE INDEX idx_products_active_category_brand_name ON products(is_active, site_category, brand COLLATE NOCASE, product_name COLLATE NOCASE)',
  'CREATE INDEX idx_products_active_brand_name ON products(is_active, brand COLLATE NOCASE, product_name COLLATE NOCASE)',
  'CREATE INDEX idx_products_retailer_active_ean ON products(retailer, is_active, ean)',
  'CREATE INDEX idx_products_retailer_merchant_id ON products(retailer, merchant_product_id)',
  ...L51,
  'CREATE TABLE product_group_offers (group_id INTEGER NOT NULL, product_id INTEGER NOT NULL UNIQUE, created_at TEXT, updated_at TEXT, PRIMARY KEY (group_id, product_id))',
  'CREATE INDEX idx_product_group_offers_group ON product_group_offers(group_id)'
];

function random(seed) {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}
const q = v => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const day = (now, n) => new Date(now - n * 86400000).toISOString().slice(0, 19).replace('T', ' ');

// The products, as INSERT statements of 250 rows (one line each: D1's exec() runs one line at a time).
function* inserts(site, profile, now) {
  const r = random(193);
  const names = Object.values(site.database.categories).flat();
  const others = names.filter(n => n !== profile.big && n !== profile.second);
  const stored = Object.fromEntries(Object.entries(site.database.retailerNames || {}).map(([from, to]) => [to, from]));
  const uk = ['Example Tools UK', 'Sample Store UK', 'Demo Supplies UK', 'Test Outlet UK'];
  const joybuy = (site.database.retailerNames || {})['Joybuy UK'] ? 'Joybuy UK' : 'Example Market UK';
  const words = ['gift', 'set', 'pro', 'mini', 'classic', 'deluxe'];
  const prices = [4.99, 9.99, 10.95, 14.99, 19.99, 24.99, 29.99, 49.5, 89.9, 129, 199];
  const pool = Math.max(10, Math.floor(ROWS / 4));
  let batch = [];
  for (let i = 1; i <= ROWS; i++) {
    const a = r();
    const cat = a < 0.4 ? profile.big : profile.second && a < 0.45 ? profile.second : others[Math.floor(r() * others.length)];
    const b = r();
    const retailer = b < 0.7 ? uk[Math.floor(r() * uk.length)] : b < 0.78 ? joybuy : b < 0.85 ? 'AliExpress PL' : b < 0.93 ? (stored[profile.us] || profile.us) : (stored[profile.eu] || profile.eu);
    const currency = retailer === 'AliExpress PL' ? 'PLN' : retailer === profile.us ? 'USD' : retailer === (stored[profile.eu] || profile.eu) ? 'EUR' : 'GBP';
    const s = r();
    const stock = s < 0.5 ? 'In Stock' : s < 0.7 ? 'in stock' : s < 0.85 ? 'Out of Stock' : s < 0.9 ? '1' : s < 0.95 ? '0' : '';
    const e = r();
    const ean = e < 0.45 ? String(5000000000000 + Math.floor(r() * pool)) : e < 0.7 ? '' : null;
    const specs = ean === '' && r() < 0.2 ? JSON.stringify({ gtin: String(5000000000000 + Math.floor(r() * pool)) }) : null;
    const u = r();
    const seen = day(now, u < 0.75 ? r() * 10 : u < 0.85 ? 15 + r() * 14 : 31 + r() * 30);
    const created = r() < 0.01 ? null : day(now, 1 + Math.floor(r() * 90) + Math.floor(r() * 24) / 24);
    const brand = r() < 0.05 ? null : `Brand ${Math.floor(r() * 400)}`;
    const price = prices[Math.floor(r() * prices.length)] + (r() < 0.5 ? 0 : Math.floor(r() * 20) * 5);
    batch.push(`(${i}, ${q(`a${i}`)}, ${q(`m${i}`)}, ${q(retailer)}, ${q(cat)}, ${q(`Sub ${Math.floor(r() * 8)}`)}, ${q(brand)}, ${q(`Product ${i} ${words[Math.floor(r() * words.length)]}`)}, ${price}, ${q(currency)}, ${q(stock)}, 'https://img.example/p.jpg', ${q(`https://www.awin1.com/cread.php?p=${i}`)}, ${q(ean)}, ${r() < 0.92 ? 1 : 0}, ${q(created)}, ${q(seen)}, ${q(specs)})`);
    if (batch.length === 250 || i === ROWS) {
      yield `INSERT INTO products (id, awin_product_id, merchant_product_id, retailer, site_category, subcategory, brand, product_name, price, currency, stock_status, image_url, affiliate_url, ean, is_active, created_at, updated_at, specs_json) VALUES ${batch.join(',')};`;
      batch = [];
    }
  }
}

async function main() {
  const profile = PROFILES[SITE];
  if (!profile) throw new Error(`--site ${SITE}: one of ${Object.keys(PROFILES).join(', ')}`);
  const { getPlatformProxy } = await import(pathToFileURL(join(repo, 'node_modules', 'wrangler', 'wrangler-dist', 'cli.js')).href);
  const db = await import(pathToFileURL(join(repo, 'src', 'db.js')).href);
  const { createWorker } = await import(pathToFileURL(join(repo, 'src', 'engine.js')).href);
  const { viewFor, homeView } = await import(pathToFileURL(join(repo, 'src', 'lib', 'visibility.js')).href);
  const { writeCosts } = await import(pathToFileURL(join(repo, 'tools', 'legacy-refresh-plan.mjs')).href);
  const site = (await import(pathToFileURL(join(repo, 'sites', SITE, 'site.config.js')).href)).default;
  const dir = mkdtempSync(join(tmpdir(), 'gw-l193-'));
  writeFileSync(join(dir, 'w.js'), 'export default { fetch() { return new Response("") } }');
  writeFileSync(join(dir, 'wrangler.jsonc'), JSON.stringify({ name: 'bench', main: 'w.js', compatibility_date: '2025-09-01', d1_databases: [{ binding: 'DB', database_name: 'bench', database_id: 'local-bench' }] }));
  const proxy = await getPlatformProxy({ configPath: join(dir, 'wrangler.jsonc'), persist: { path: join(dir, 'state') } });
  const out = [];
  const say = line => { out.push(line); console.log(line); };
  try {
    const raw = proxy.env.DB;
    const now = Date.now();
    const t0 = Date.now();
    const schema = readFileSync(join(repo, 'tests', 'fixtures', 'ggw-legacy-schema.sql'), 'utf8').split('\n').map(l => l.replace(/--.*$/, '')).join(' ');
    await raw.exec(schema);
    for (const s of SITE === 'cgw' ? CGW_LIVE : L51) await raw.exec(`${s};`);
    for (const s of inserts(site, profile, now)) await raw.exec(s);
    if (SITE === 'cgw') {
      // The import's own matches: pairs of products (about 18% of the rows), as on the live site.
      await raw.exec('INSERT INTO product_group_offers (group_id, product_id) SELECT id, id FROM products WHERE id % 11 = 0;');
      await raw.exec('INSERT INTO product_group_offers (group_id, product_id) SELECT id - 1, id FROM products WHERE id % 11 = 1 AND id > 1;');
    }
    const n = (await raw.prepare('SELECT COUNT(*) AS n, MAX(id) AS m, SUM(is_active) AS a FROM products').first());
    say(`${SITE.toUpperCase()} ${site.name}: ${n.n} products (${n.a} active, highest id ${n.m}), loaded in ${Math.round((Date.now() - t0) / 1000)} s`);
    const big = Object.entries(site.database.categories).find(([, list]) => list.includes(profile.big))[0];
    const bigRows = (await raw.prepare('SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND site_category = ?').bind(profile.big).first()).n;
    say(`big category: ${profile.big} (/category/${big}/), ${bigRows} active rows`);

    // A D1 binding that counts the rows D1 reads; a new one per phase (fastMode() looks at each binding once).
    // --detail <page>: every query of that page with its rows read and time.
    let read = 0;
    let log = null;
    const binding = () => {
      const count = (r, text, started) => {
        const n = Number(r && r.meta && r.meta.rows_read) || 0;
        read += n;
        if (log) log.push(`${String(n).padStart(9)} ${String(Date.now() - started).padStart(6)} ms  ${text.replace(/\s+/g, ' ').replace(/\(SELECT id, product_name, NULL AS product_slug.*?FROM products( INDEXED BY \w+)?\)/g, '<view$1>').slice(0, 170)}`);
      };
      const wrap = (st, text) => ({
        bind: (...a) => wrap(st.bind(...a), text),
        all: async () => { const s = Date.now(); const r = await st.all(); count(r, text, s); return r; },
        first: async () => { const s = Date.now(); const r = await st.all(); count(r, text, s); return (r.results || [])[0] || null; },
        run: async () => { const s = Date.now(); const r = await st.run(); count(r, text, s); return r; },
        raw: st,
        text
      });
      return { prepare: t => wrap(raw.prepare(t), t), batch: async list => { const s = Date.now(); const res = await raw.batch(list.map(x => x.raw)); res.forEach((r, i) => count(r, list[i].text, s)); return res; } };
    };
    const worker = createWorker(site);
    const gb = viewFor(site, 'GB', now);
    const pages = [
      ['home', '/'],
      [`${big} page 1`, `/category/${big}/`],
      ...DEEP.map(p => [`${big} page ${p}`, `/category/${big}/?page=${p}`]),
      [`${big} price low-high`, `/category/${big}/?sort=price-asc`],
      [`${big} price high-low p2`, `/category/${big}/?sort=price-desc&page=2`],
      [`${big} newest`, `/category/${big}/?sort=newest`],
      [`${big} brand filter`, `/category/${big}/?brand=${encodeURIComponent('Brand 12')}`],
      [`${big} in stock, under 20`, `/category/${big}/?stock=1&max=20`],
      [`${big} one shop`, `/category/${big}/?retailer=${encodeURIComponent('Sample Store UK')}`],
      ...site.categories.filter(c => c.slug !== big && !c.collection).slice(0, 1).map(c => [`${c.slug} page 1`, `/category/${c.slug}/`]),
      ...(SITE === 'wgw' ? [['watches (2 names) page 1', '/category/watches/'], ['watches (2 names) page 20', '/category/watches/?page=20']] : []),
      ...site.categories.filter(c => c.collection).map(c => [`${c.slug} (collection)`, `/category/${c.slug}/`]),
      ['search', '/search?q=deluxe'],
      ['/api/stats', '/api/stats'],
      ['sitemap-static (counts)', '/sitemap-static.xml']
    ];
    const visit = async (DB, path, phase) => {
      const req = new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 bench' } });
      Object.defineProperty(req, 'cf', { value: { country: 'GB' } });
      read = 0;
      log = opt('detail', '') && path === opt('detail', '') ? [] : null;
      const started = Date.now();
      let status = 0;
      let html = '';
      try {
        const res = await worker.fetch(req, { DB, CLICK_LOG: 'off', EDGE_CACHE: 'off', FX_FETCH: async () => { throw new Error('offline'); } }, { waitUntil: x => x });
        status = res.status;
        html = await res.text();
      } catch (err) { status = `failed: ${String(err && err.message || err).slice(0, 60)}`; }
      if (log) { console.log(`--- ${path}\n${log.join('\n')}`); log = null; }
      const r = { status, html, rows: read, total: Date.now() - started };
      console.log(`  ${phase} ${path}: ${r.total} ms, ${r.rows} rows read, ${r.status}`);
      return r;
    };
    const slugs = site.categories.map(c => c.slug);
    // The db.js answers, one by one: an old read the local D1 cannot finish at this size is left out of the comparison
    // (and counted), every other answer is compared.
    const answers = async DB => {
      db.useLayout(site);
      const asks = {};
      for (const [sort, page] of [['featured', 1], ['featured', 40], ['price-asc', 1], ['price-desc', 3], ['newest', 1], ['saving', 2]]) {
        asks[`list ${sort} ${page}`] = () => db.listProducts(DB, { category: big, view: gb }, { sort, page, perPage: 24 });
      }
      asks['list brand, in stock'] = () => db.listProducts(DB, { category: big, view: gb, brand: 'Brand 12', inStock: true }, { sort: 'featured', page: 1, perPage: 24 });
      asks.facets = () => db.facets(DB, big, null, gb);
      asks.home = () => db.homeData(DB, slugs, { view: gb });
      asks.categoryCounts = () => db.categoryCounts(DB, gb);
      asks.stats = () => db.stats(DB, homeView(site, now), site);
      const out = {};
      for (const [k, ask] of Object.entries(asks)) {
        try { out[k] = JSON.parse(JSON.stringify(await ask())); } catch (err) { out[k] = { failed: String((err && err.message) || err).slice(0, 80) }; }
      }
      return out;
    };
    // Rows written by one refresh change (lessons L57, L59): each column alone, with updated_at as the refresh sets it.
    const refreshWrites = async () => {
      const row = await raw.prepare("SELECT id, price, image_url, stock_status, is_active, updated_at FROM products WHERE is_active = 1 AND stock_status = 'In Stock' ORDER BY id LIMIT 1").first();
      const w = async sql => Number((await raw.prepare(sql).bind(row.id).run()).meta.rows_written) || 0;
      const res = {
        price: await w("UPDATE products SET price = price + 1, updated_at = datetime('now') WHERE id = ?"),
        image_url: await w("UPDATE products SET image_url = image_url || '?x', updated_at = datetime('now') WHERE id = ?"),
        stock_status: await w("UPDATE products SET stock_status = 'Out of Stock', updated_at = datetime('now') WHERE id = ?"),
        is_active: await w("UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?")
      };
      // The row exactly as it was, so both phases read the same data.
      await raw.prepare('UPDATE products SET price = ?, image_url = ?, stock_status = ?, is_active = ?, updated_at = ? WHERE id = ?')
        .bind(row.price, row.image_url, row.stock_status, row.is_active, row.updated_at, row.id).run();
      const master = (await raw.prepare("SELECT sql FROM sqlite_master WHERE tbl_name = 'products' AND sql IS NOT NULL AND type IN ('index', 'trigger')").all()).results;
      return { measured: res, formula: writeCosts(master) };
    };

    // ---- Before: the old reads ----
    const before = {};
    const A = binding();
    db.useLayout(site);
    say(`fast mode before the indexes: ${await db.fastMode(A)}`);
    for (const [name, path] of pages) before[name] = await visit(A, path, 'before');
    const answersBefore = await answers(binding());
    const writesBefore = await refreshWrites();

    // ---- The indexes ----
    say('');
    say('indexes (CREATE INDEX IF NOT EXISTS, one at a time): rows written, seconds');
    let written = 0;
    for (const sql of db.LEGACY_FAST_INDEX_SQL) {
      const s = Date.now();
      const r = await raw.prepare(sql).run();
      const w = Number(r.meta && r.meta.rows_written) || 0;
      written += w;
      say(`  ${sql.match(/EXISTS (\w+)/)[1].padEnd(40)} ${String(w).padStart(9)}  ${((Date.now() - s) / 1000).toFixed(1)} s`);
    }
    say(`  in all: ${written} rows written (highest id ${n.m})`);

    // ---- After ----
    const after = {};
    const B = binding();
    db.useLayout(site);
    say(`fast mode after the indexes: ${await db.fastMode(B)}`);
    for (const [name, path] of pages) after[name] = await visit(B, path, 'after');
    const answersAfter = await answers(binding());
    const writesAfter = await refreshWrites();

    // ---- With the counts kept (the Worker keeps counts, filters and the census; tests and local checks never do) ----
    const kept = {};
    const store = new Map();
    db.useMemo(async (name, a, seconds, compute) => { const k = `${name}:${JSON.stringify(a)}`; if (!store.has(k)) store.set(k, await compute()); return JSON.parse(JSON.stringify(store.get(k))); });
    const C = binding();
    const keptCalls = {
      home: () => db.homeData(C, slugs, { view: gb }),
      [`${big} page 1`]: () => Promise.all([db.listProducts(C, { category: big, view: gb }, { sort: 'featured', page: 1 }), db.facets(C, big, null, gb)]),
      ...Object.fromEntries(DEEP.map(p => [`${big} page ${p}`, () => Promise.all([db.listProducts(C, { category: big, view: gb }, { sort: 'featured', page: p }), db.facets(C, big, null, gb)])])),
      [`${big} newest`]: () => Promise.all([db.listProducts(C, { category: big, view: gb }, { sort: 'newest', page: 1 }), db.facets(C, big, null, gb)])
    };
    for (const [name, call] of Object.entries(keptCalls)) {
      db.useLayout(site);
      await call();
      read = 0;
      const s = Date.now();
      await call();
      kept[name] = { rows: read, total: Date.now() - s };
    }
    db.useMemo(null);

    say('');
    say('page (UK visitor)                       before: ms / rows read     after: ms / rows read     kept: ms / rows read   same page');
    // A page the old reads could not answer (500/503 at this size) is compared with nothing: "old failed".
    let allSame = true;
    let oldFailed = 0;
    for (const [name] of pages) {
      const a = before[name], b = after[name];
      const same = a.status === b.status && a.html === b.html;
      const failedBefore = a.status !== 200 && b.status === 200;
      if (failedBefore) oldFailed++;
      else if (!same) allSame = false;
      const k = kept[name] ? `${String(kept[name].total).padStart(6)} / ${String(kept[name].rows).padStart(9)}` : ''.padStart(18);
      say(`${name.padEnd(38)} ${String(a.total).padStart(7)} / ${String(a.rows).padStart(9)}${a.status === 200 ? '' : ` (${a.status})`}   ${String(b.total).padStart(7)} / ${String(b.rows).padStart(9)}${b.status === 200 ? '' : ` (${b.status})`}   ${k}   ${failedBefore ? 'old failed' : same ? 'yes' : 'NO'}`);
    }
    if (oldFailed) say(`${oldFailed} page(s) the old reads could not answer at this size; every other page is compared.`);
    const keys = Object.keys(answersBefore);
    const oldOut = keys.filter(k => answersBefore[k].failed && !answersAfter[k].failed);
    const differ = keys.filter(k => !oldOut.includes(k) && !isDeepStrictEqual(answersBefore[k], answersAfter[k]));
    const sameAnswers = differ.length === 0;
    say('');
    say(`same HTML on every page: ${allSame ? 'yes' : 'NO'}; the same db.js answers (lists, filters, home page, counts, stats): ${keys.length - oldOut.length - differ.length} of ${keys.length}${differ.length ? `, DIFFERENT: ${differ.join(', ')}` : ''}${oldOut.length ? `; the old read could not answer on the local D1: ${oldOut.join(', ')} (${answersBefore[oldOut[0]].failed})` : ''}`);
    say(`refresh, rows written per change  before: measured ${JSON.stringify(writesBefore.measured)} formula ${JSON.stringify(writesBefore.formula)}`);
    say(`                                  after:  measured ${JSON.stringify(writesAfter.measured)} formula ${JSON.stringify(writesAfter.formula)}`);
    if (!allSame || !sameAnswers) process.exitCode = 1;
    if (opt('out', '')) writeFileSync(opt('out', ''), out.join('\n') + '\n');
  } finally {
    await proxy.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
}

await main();
