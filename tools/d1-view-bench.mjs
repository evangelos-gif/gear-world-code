#!/usr/bin/env node
// D1 rows read per page, before and after the visitor views of lessons L107 (delivery country and price age), measured
// the way lessons L105 asks: the real engine on the local D1 of wrangler (meta.rows_read of every query of the page),
// on synthetic products with the shape of the live data of 9 Nov 2026 (only counts per retailer, category and age;
// no feed data, no names, no ids):
//   agw  Car Gear World (new layout): 38,051 active, Pneus.be 29,931 (98% of the tyres), VEVOR 625, all checked 3-8 Nov
//   cgw  Construction Gear World (older layout, its 21 indexes): 85,592 active, Reidl 19,945, Vevor NL 1,474, and the
//        rows not changed for 14 / 30 days as on 9 Nov (Tooled Up 26,534 over 30 days ...)
//   tgw  Technology Gear World (new layout, UK shops only): 30,087 active, all checked in the last 14 days
//
//   node tools/d1-view-bench.mjs --site agw [--engine <folder with src/ and sites/ of another version>] [--scale 1]
//        [--countries none,GB,BE] [--only <page>] [--detail <page>] [--cache-check]
//
// It prints one line per page and country: rows read. Without --engine it measures this version. Run it twice (the
// version before L107 from `git archive`, then this one) to compare. Nothing leaves this computer; wrangler keeps the
// local database in a temporary folder that is removed at the end.
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SITE = opt('site', 'agw');
const ENGINE = resolve(opt('engine', repo));
const SCALE = Number(opt('scale', '1'));
const COUNTRIES = String(opt('countries', 'none,GB,BE,DE')).split(',');

// The live shape (9 Nov 2026, read-only SELECTs): rows per category and retailer, and how many are older than 14 / 30 days.
const PROFILES = {
  agw: {
    layout: 'native',
    rows: {
      'tyres-wheels': { 'Pneus.be': 29931, VEVOR: 104, 'Tooled Up': 300, '4x4 Predator': 200, 'SGS Engineering': 72 },
      'garage-tools-equipment': { VEVOR: 380, 'Tooled Up': 1500, 'SGS Engineering': 900, Joybuy: 264 },
      'parts-maintenance': { VEVOR: 1, '4x4 Predator': 1100, 'SGS Engineering': 500, 'Tooled Up': 289 },
      'roof-towing-exterior': { VEVOR: 65, '4x4 Predator': 540, 'Tooled Up': 700, Joybuy: 133 },
      'diagnostics-battery': { VEVOR: 26, 'Tooled Up': 268, Joybuy: 100 },
      'car-electronics': { VEVOR: 14, Joybuy: 200, 'SGS Engineering': 133 },
      'car-care-detailing': { VEVOR: 4, 'Tooled Up': 61, 'GS Workwear': 79 },
      'interior-comfort': { VEVOR: 10, 'SGS Engineering': 120 },
      'ev-charging': { VEVOR: 21, 'SGS Engineering': 20 },
      'safety-winter': { 'GS Workwear': 16 }
    },
    euro: ['Pneus.be', 'VEVOR'],
    stale: {}
  },
  tgw: {
    layout: 'native',
    migrations: 'tgw',
    rows: {
      'laptops-computing': { 'PCHUB.UK': 7962, 'Back to the Office': 5091, Joybuy: 569, 'PcNova (IT-Supplies)': 521, AKKO: 343 },
      'accessories-storage': { 'PCHUB.UK': 5361, 'Back to the Office': 3027, Joybuy: 676, 'PcNova (IT-Supplies)': 212, AKKO: 1 },
      audio: { 'PCHUB.UK': 829, Joybuy: 396, 'Back to the Office': 340, 'PcNova (IT-Supplies)': 24 },
      'smart-home-wifi': { 'PCHUB.UK': 761, 'Back to the Office': 594, Joybuy: 97, 'PcNova (IT-Supplies)': 48 },
      'phones-smartwatches': { 'PCHUB.UK': 432, Joybuy: 428, 'Back to the Office': 225, 'PcNova (IT-Supplies)': 15 },
      gaming: { Joybuy: 436, 'Back to the Office': 421, 'PCHUB.UK': 171, 'PcNova (IT-Supplies)': 29, AKKO: 27 },
      'cameras-drones': { 'PCHUB.UK': 533, Joybuy: 141, 'Back to the Office': 27, 'PcNova (IT-Supplies)': 22 },
      'tv-home-cinema': { Joybuy: 115, 'PCHUB.UK': 106, 'Back to the Office': 104, 'PcNova (IT-Supplies)': 3 }
    },
    euro: [],
    stale: {}
  },
  cgw: {
    layout: 'legacy',
    rows: {
      'Hand Tools': { 'Tooled Up': 16000, 'My Tool Shed': 4600, Reidl: 9000, 'Vevor NL': 500, 'Joybuy UK': 100, 'Nebo Tools': 100, 'Red Gorilla International': 72 },
      'Power Tools': { 'Tooled Up': 12000, 'My Tool Shed': 4500, Reidl: 6000, 'Vevor NL': 474, 'Back to the Office': 117 },
      Workwear: { 'GS Workwear': 12000, 'InStock UK': 982, 'Tooled Up': 1369 },
      'Safety Boots': { 'GS Workwear': 2575, 'Tooled Up': 2000 },
      PPE: { 'Tooled Up': 3000, 'SGS Engineering': 1303, Reidl: 1945 },
      'Site Equipment': { 'Tooled Up': 2000, 'My Tool Shed': 1301, Reidl: 3000, 'Vevor NL': 500, 'Joybuy UK': 106, GRABO: 48 }
    },
    euro: ['Reidl', 'Vevor NL'],
    // Share of each retailer's rows not changed for more than 30 days, and for 14-30 days (live, 9 Nov 2026).
    stale: { 'Tooled Up': [0.730, 0.259], Reidl: [0.550, 0], 'GS Workwear': [0, 1], 'My Tool Shed': [0.778, 0], 'InStock UK': [0.312, 0.046],
      'Joybuy UK': [0.398, 0], 'Back to the Office': [0.829, 0], 'Nebo Tools': [0.99, 0], 'Red Gorilla International': [0.944, 0], GRABO: [0, 1] }
  }
};
// The indexes of the live Construction database (sqlite_master, 9 Nov 2026), on the older layout's table.
const CGW_INDEXES = [
  'CREATE INDEX idx_products_active_category ON products(is_active, site_category)',
  'CREATE INDEX idx_products_active_price ON products(is_active, price)',
  'CREATE INDEX idx_products_active_brand ON products(is_active, brand)',
  'CREATE INDEX idx_products_active_id ON products(is_active, id)',
  'CREATE INDEX idx_products_active_featured ON products(is_active, ((id * 1103515245 + 12345) % 2147483647))',
  'CREATE INDEX idx_products_active_category_featured ON products(is_active, site_category, ((id * 1103515245 + 12345) % 2147483647))',
  'CREATE INDEX idx_products_active_category_price_id ON products(is_active, site_category, price, id)',
  'CREATE INDEX idx_products_active_category_brand_name ON products(is_active, site_category, brand COLLATE NOCASE, product_name COLLATE NOCASE)',
  'CREATE INDEX idx_products_active_brand_name ON products(is_active, brand COLLATE NOCASE, product_name COLLATE NOCASE)',
  'CREATE INDEX idx_products_retailer_active_ean ON products(retailer, is_active, ean)',
  'CREATE INDEX idx_products_retailer_merchant_id ON products(retailer, merchant_product_id)',
  "CREATE INDEX idx_products_group_key ON products(COALESCE(NULLIF(TRIM(COALESCE(NULLIF(TRIM(ean), ''), json_extract(specs_json, '$.gtin'))), ''), 'id:' || id))",
  'CREATE INDEX idx_products_active_created ON products(is_active, created_at)',
  'CREATE TABLE product_group_offers (group_id INTEGER NOT NULL, product_id INTEGER NOT NULL UNIQUE, created_at TEXT, updated_at TEXT, PRIMARY KEY (group_id, product_id))',
  'CREATE INDEX idx_product_group_offers_group ON product_group_offers(group_id)'
];

function random(seed) {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}
const q = v => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

function rowsOf(profile) {
  const r = random(1107);
  const out = [];
  const day = n => new Date(Date.parse('2026-11-09T12:00:00Z') - n * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  let i = 0;
  for (const [cat, byRetailer] of Object.entries(profile.rows)) {
    for (const [retailer, n0] of Object.entries(byRetailer)) {
      const n = Math.max(1, Math.round(n0 * SCALE));
      const [s30, s14] = profile.stale[retailer] || [0, 0];
      for (let k = 0; k < n; k++) {
        i++;
        const a = r();
        const age = a < s30 ? 31 + Math.floor(r() * 30) : a < s30 + s14 ? 15 + Math.floor(r() * 14) : 1 + Math.floor(r() * 6);
        const price = [9.99, 10.95, 19.99, 24.99, 49.5, 89.9, 129, 199][Math.floor(r() * 8)] + Math.floor(r() * 30);
        out.push({ i, cat, retailer, price, was: r() < 0.3 ? Math.round(price * 1.4 * 100) / 100 : null, stock: r() < 0.9 ? 1 : 0,
          ean: r() < 0.4 ? String(5000000000000 + Math.floor(r() * (n * 0.9 + 10))) : null, seen: day(age), created: day(age + Math.floor(r() * 20)),
          eur: profile.euro.includes(retailer) });
      }
    }
  }
  return out;
}

function sqlFor(profile, rows) {
  const parts = [];
  if (profile.layout === 'native') {
    const migDir = join(repo, 'sites', profile.migrations || 'agw', 'migrations');
    const mig = (profile.migrations === 'tgw' ? ['0001_init.sql'] : ['0001_init.sql', '0002_group_key_index.sql']).map(f => readFileSync(join(migDir, f), 'utf8'));
    parts.push(...mig);
    for (let s = 0; s < rows.length; s += 150) {
      parts.push(`INSERT INTO products (id, stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name, product_slug, price, was_price, currency, in_stock, image_url, affiliate_url, gtin, first_seen_at, last_seen_at, updated_at) VALUES ${rows.slice(s, s + 150).map(x =>
        `(${x.i}, 'k${x.i}', 1, 'm${x.i}', ${q(x.retailer)}, ${q(x.cat)}, 'Brand ${x.i % 300}', 'Product ${x.i}', 'product-${x.i}', ${x.price}, ${x.was === null ? 'NULL' : x.was}, ${x.eur ? "'EUR'" : "'GBP'"}, ${x.stock}, 'https://img.example/${x.i}.jpg', 'https://example.com/${x.i}', ${q(x.ean)}, ${q(x.created)}, ${q(x.seen)}, ${q(x.seen)})`).join(',')};`);
    }
  } else {
    parts.push(readFileSync(join(repo, 'tests', 'fixtures', 'ggw-legacy-schema.sql'), 'utf8'));
    parts.push(...CGW_INDEXES.map(s => `${s};`));
    for (let s = 0; s < rows.length; s += 150) {
      parts.push(`INSERT INTO products (id, awin_product_id, merchant_product_id, retailer, site_category, brand, product_name, price, currency, stock_status, image_url, affiliate_url, ean, is_active, created_at, updated_at) VALUES ${rows.slice(s, s + 150).map(x =>
        `(${x.i}, 'a${x.i}', 'm${x.i}', ${q(x.retailer)}, ${q(x.cat)}, 'Brand ${x.i % 300}', 'Product ${x.i}', ${x.price}, ${x.eur ? "'EUR'" : "'GBP'"}, ${x.stock ? "'in stock'" : "'out of stock'"}, 'https://img.example/${x.i}.jpg', 'https://www.awin1.com/cread.php?p=${x.i}', ${q(x.ean)}, 1, ${q(x.created)}, ${q(x.seen)})`).join(',')};`);
    }
    // The import's own match groups: pairs of the same EAN at two retailers (a few thousand, as on the live site).
    parts.push(`INSERT INTO product_group_offers (group_id, product_id) SELECT MIN(id), id FROM products WHERE ean IS NOT NULL GROUP BY id HAVING id % 7 = 0;`);
  }
  parts.push('ANALYZE;');
  return parts;
}

async function main() {
  const profile = PROFILES[SITE];
  if (!profile) throw new Error(`--site ${SITE}: agw, cgw or tgw`);
  const { getPlatformProxy } = await import(pathToFileURL(join(repo, 'node_modules', 'wrangler', 'wrangler-dist', 'cli.js')).href);
  const dir = mkdtempSync(join(tmpdir(), 'gw-bench-'));
  writeFileSync(join(dir, 'w.js'), 'export default { fetch() { return new Response("") } }');
  writeFileSync(join(dir, 'wrangler.jsonc'), JSON.stringify({ name: 'bench', main: 'w.js', compatibility_date: '2025-09-01', d1_databases: [{ binding: 'DB', database_name: 'bench', database_id: 'local-bench' }] }));
  const proxy = await getPlatformProxy({ configPath: join(dir, 'wrangler.jsonc'), persist: { path: join(dir, 'state') } });
  try {
    const raw = proxy.env.DB;
    const rows = rowsOf(profile);
    // D1 exec() runs one line at a time: each file becomes one line, without its -- comments.
    for (const s of sqlFor(profile, rows)) await raw.exec(s.split('\n').map(l => l.replace(/--.*$/, '')).join(' '));
    let read = 0;
    // --detail <page>: every query of that page with its rows read.
    const detail = opt('detail', '');
    let log = null;
    const count = (r, text) => { const n = Number(r.meta && r.meta.rows_read) || 0; read += n; if (log) log.push(`${String(n).padStart(8)}  ${text.replace(/\s+/g, ' ').slice(0, 150)}`); };
    const wrap = (st, text) => ({
      bind: (...a) => wrap(st.bind(...a), text),
      all: async () => { const r = await st.all(); count(r, text); return r; },
      first: async () => { const r = await st.all(); count(r, text); return (r.results || [])[0] || null; },
      run: async () => { const r = await st.run(); count(r, text); return r; },
      raw: st,
      text
    });
    const DB = { prepare: t => wrap(raw.prepare(t), t), batch: async list => { const res = await raw.batch(list.map(s => s.raw)); res.forEach((r, i) => count(r, list[i].text)); return res; } };
    const { createWorker } = await import(pathToFileURL(join(ENGINE, 'src', 'engine.js')).href);
    const site = (await import(pathToFileURL(join(ENGINE, 'sites', SITE, 'site.config.js')).href)).default;
    const worker = createWorker(site);
    const env = { DB, CLICK_LOG: 'off', EDGE_CACHE: 'off', FX_FETCH: async () => { throw new Error('offline'); } };
    const pick = (cond) => rows.find(cond);
    const T = SITE === 'tgw';
    const gbRetailer = T ? 'PCHUB.UK' : 'Tooled Up';
    const euRetailer = T ? 'Joybuy' : profile.layout === 'native' ? 'Pneus.be' : 'Reidl';
    const bigCat = T ? 'laptops-computing' : profile.layout === 'native' ? 'tyres-wheels' : 'hand-tools';
    const smallCat = T ? 'tv-home-cinema' : profile.layout === 'native' ? 'safety-winter' : 'ppe';
    const midCat = T ? 'audio' : profile.layout === 'native' ? 'garage-tools-equipment' : 'workwear';
    const path = x => `/product/product-${x.i}-${x.i}/`;
    // Products the UK view lists (checked in the last 30 days), and one from the other country's retailer.
    const gbInBig = pick(x => x.retailer === gbRetailer && x.cat === (T ? 'laptops-computing' : profile.layout === 'native' ? 'tyres-wheels' : 'Hand Tools') && x.seen > '2026-10-11');
    const gbInMid = pick(x => x.retailer === gbRetailer && x.seen > '2026-10-11' && x.cat !== gbInBig.cat);
    const eu = pick(x => x.retailer === euRetailer && x.seen > '2026-10-11');
    const brand = encodeURIComponent('Brand 12');
    const shop = encodeURIComponent(gbRetailer);
    const pages = [
      ['home', '/'], [`category ${bigCat}`, `/category/${bigCat}/`], [`category ${midCat}`, `/category/${midCat}/`], [`category ${smallCat}`, `/category/${smallCat}/`],
      [`category ${bigCat} page 3`, `/category/${bigCat}/?page=3`], [`product ${gbRetailer} (${gbInBig.cat})`, path(gbInBig)], [`product ${gbRetailer} (${gbInMid.cat})`, path(gbInMid)],
      [`product ${euRetailer}`, path(eu)], ['search "brand 12"', '/search?q=brand+12'], ['deals', '/deals/'], ['sitemap.xml', '/sitemap.xml'],
      ['sitemap-static', '/sitemap-static.xml'], ['sitemap-products-1', '/sitemap-products-1.xml'], ['/api/products (Hub)', '/api/products?search=brand+12&limit=8'], ['/api/stats', '/api/stats'],
      // Filters (checker of 9 Nov 2026, item 14): a brand or a retailer picked on a category or a search.
      [`category ${bigCat} brand`, `/category/${bigCat}/?brand=${brand}`], [`category ${bigCat} retailer`, `/category/${bigCat}/?retailer=${shop}`],
      ['search brand', `/search?q=brand&brand=${brand}`], ['search retailer', `/search?q=brand&retailer=${shop}`],
      ['/api/products retailer', `/api/products?retailer=${shop}&limit=24`], ['/api/products brand', `/api/products?brand=${brand}&limit=24`]
    ];
    if (opt('only', '')) pages.splice(0, pages.length, ...pages.filter(([n]) => n.includes(opt('only', ''))));
    console.log(`${SITE.toUpperCase()} ${rows.length} products, engine: ${ENGINE === repo ? 'this version' : ENGINE}`);
    // --cache-check: the home page through an edge cache kept in memory: a UK visit (miss), then a US visit (hit, the
    // bar "We're adding retailers for your country" added after the cache), then the UK again (hit). Rows read each.
    if (args.includes('--cache-check')) {
      const store = new Map();
      globalThis.caches = { default: { match: async k => (store.has(k.url) ? store.get(k.url).clone() : undefined), put: async (k, r) => { store.set(k.url, r); } } };
      const cenv = { ...env, EDGE_CACHE: 'on' };
      for (const [label, cc] of [['GB (miss)', 'GB'], ['US (hit)', 'US'], ['GB (hit)', 'GB']]) {
        const req = new Request(`https://${site.domain}/`, { headers: { 'User-Agent': 'Mozilla/5.0 bench' } });
        Object.defineProperty(req, 'cf', { value: { country: cc } });
        read = 0;
        const html = await (await worker.fetch(req, cenv, { waitUntil: x => x })).text();
        console.log(`home ${label}\t${read}\tbar: ${html.includes('class="country-bar"') ? 'yes' : 'no'}\tcache copies: ${store.size}`);
      }
      delete globalThis.caches;
      return;
    }
    console.log(['page', ...COUNTRIES].join('\t'));
    for (const [name, p] of pages) {
      const cells = [];
      for (const cc of COUNTRIES) {
        const req = new Request(`https://${site.domain}${p}`, { headers: { 'User-Agent': 'Mozilla/5.0 bench' } });
        if (cc !== 'none') Object.defineProperty(req, 'cf', { value: { country: cc } });
        read = 0;
        log = detail && name.includes(detail) ? [] : null;
        const res = await worker.fetch(req, env, { waitUntil: x => x });
        await res.text();
        cells.push(`${read}${res.status === 200 ? '' : ` (${res.status})`}`);
        if (log) console.log(`--- ${name} ${cc}\n${log.join('\n')}`);
      }
      console.log([name, ...cells].join('\t'));
    }
  } finally {
    await proxy.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
}

await main();
