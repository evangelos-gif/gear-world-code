// All D1 queries. Every value goes through bind() (lessons L08). Sort orders come from a fixed list.
//
// Two database layouts are supported:
//   - native: the TGW schema (sites/tgw/migrations).
//   - legacy: the database the older Gear World sites already have, written by the Hub import router
//     (site_category name, stock_status text, ean, specs_json ...). It is read AS IT IS: no table is
//     changed, the router keeps writing the same way, and product ids and addresses stay the same.
//     A read-only "view" in each query maps it to the native column names (lessons L28).

const NATIVE_CARD_COLUMNS = `id, product_name, product_slug, brand, retailer, category_slug, price, was_price,
  currency, in_stock, item_condition, image_url, subcategory, merchant_category`;
// The legacy layout also returns the old category name: Gear World Hub search shows it (lessons L22).
let CARD_COLUMNS = NATIVE_CARD_COLUMNS;

let LAYOUT = { legacy: false, from: 'products', catSql: 'p.category_slug = ?', catBinds: slug => [slug] };

const sqlText = v => `'${String(v).replace(/'/g, "''")}'`;

// Old sites build product addresses from the name only, with no length limit. Kept exactly, so every
// address that Google already knows keeps working.
export function legacySlug(name) {
  return String(name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Awin product images come in at 200 px; ask the same image server for a sharper one.
export function sharperImage(url) {
  const u = String(url || '');
  if (!/^https:\/\/images\d*\.productserve\.com\//.test(u)) return u;
  return u.replace(/([?&])w=200\b/, '$1w=600').replace(/([?&])h=200\b/, '$1h=600');
}

const IN_STOCK_WORDS = ['in_stock', 'in stock', '1', 'true', 'yes', 'available to order'];

// Called by the engine for each request. site.database = { layout: 'legacy', categories: { slug: [old names] } }
const layoutCache = new WeakMap();
export function useLayout(site) {
  if (site && layoutCache.has(site)) { [LAYOUT, CARD_COLUMNS] = layoutCache.get(site); return; }
  buildLayout(site);
  if (site) layoutCache.set(site, [LAYOUT, CARD_COLUMNS]);
}

function buildLayout(site) {
  const cfg = site && site.database;
  if (!cfg || cfg.layout !== 'legacy') {
    LAYOUT = { legacy: false, from: 'products', catSql: 'p.category_slug = ?', catBinds: slug => [slug] };
    CARD_COLUMNS = NATIVE_CARD_COLUMNS;
    return;
  }
  CARD_COLUMNS = NATIVE_CARD_COLUMNS + ', site_category';
  const map = cfg.categories || {};
  // Category names are fixed text from the site config (never visitor input), quoted for SQL.
  const whens = Object.entries(map).flatMap(([slug, names]) => names.map(n => `WHEN ${sqlText(n)} THEN ${sqlText(slug)}`));
  const catExpr = whens.length ? `CASE site_category ${whens.join(' ')} ELSE NULL END` : 'NULL';
  const stock = IN_STOCK_WORDS.map(sqlText).join(', ');
  const view = `(SELECT id, product_name, NULL AS product_slug, brand, retailer, site_category,
    ${catExpr} AS category_slug, subcategory, merchant_category, price, NULL AS was_price,
    COALESCE(NULLIF(TRIM(currency), ''), 'GBP') AS currency,
    CASE WHEN LOWER(TRIM(COALESCE(stock_status, ''))) IN (${stock}) THEN 1 ELSE 0 END AS in_stock,
    'new' AS item_condition, image_url, affiliate_url,
    COALESCE(NULLIF(TRIM(ean), ''), json_extract(specs_json, '$.gtin')) AS gtin,
    json_extract(specs_json, '$.mpn') AS mpn,
    COALESCE(json_extract(specs_json, '$.description'), json_extract(specs_json, '$.product_short_description')) AS description,
    NULL AS specs_json, is_active, awin_product_id, NULL AS awin_advertiser_id,
    created_at AS first_seen_at, updated_at AS last_seen_at, updated_at
    FROM products)`;
  LAYOUT = {
    legacy: true,
    from: view,
    // Category filters use the old column, so its index is used.
    catSql: slug => `p.site_category IN (${(map[slug] || ['']).map(() => '?').join(', ')})`,
    catBinds: slug => (map[slug] || ['']),
    map
  };
}

export function isLegacy() { return LAYOUT.legacy; }

function catWhere(slug) {
  return { sql: typeof LAYOUT.catSql === 'function' ? LAYOUT.catSql(slug) : LAYOUT.catSql, binds: LAYOUT.catBinds(slug) };
}

// Rows from the legacy layout get their address slug and a sharper image here.
function fix(row) {
  if (!row || !LAYOUT.legacy) return row;
  row.product_slug = legacySlug(row.product_name);
  row.image_url = sharperImage(row.image_url);
  return row;
}
const fixAll = rows => (LAYOUT.legacy ? (rows || []).map(fix) : rows || []);

const SORTS = {
  featured: 'in_stock DESC, ((id * 1103515245 + 12345) % 2147483647) ASC',
  'price-asc': 'price ASC, id ASC',
  'price-desc': 'price DESC, id ASC',
  newest: 'first_seen_at DESC, id DESC',
  saving: '(CASE WHEN was_price > price THEN (was_price - price) / was_price ELSE 0 END) DESC, id ASC'
};

export const SORT_OPTIONS = [
  ['featured', 'Featured'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['newest', 'Newest'],
  ['saving', 'Biggest saving']
];

export function normalizeSort(value) {
  return Object.hasOwn(SORTS, value) ? value : 'featured';
}

// Builds a safe search expression for FTS5 from user text.
export function ftsQuery(text) {
  const terms = String(text ?? '').normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
  return terms.slice(0, 8).map(t => `"${t.replace(/"/g, '""')}"*`).join(' AND ');
}

function buildFilter({ category, brand, retailer, maxPrice, minPrice, inStock, condition, search, onSale }) {
  const where = ['p.is_active = 1'];
  const binds = [];
  if (category) { const c = catWhere(category); where.push(c.sql); binds.push(...c.binds); }
  if (brand) { where.push('p.brand = ?'); binds.push(brand); }
  if (retailer) { where.push('p.retailer = ?'); binds.push(retailer); }
  if (Number.isFinite(maxPrice) && maxPrice > 0) { where.push('p.price <= ?'); binds.push(maxPrice); }
  if (Number.isFinite(minPrice) && minPrice > 0) { where.push('p.price >= ?'); binds.push(minPrice); }
  if (inStock) where.push('p.in_stock = 1');
  if (condition) { where.push('p.item_condition = ?'); binds.push(condition); }
  if (onSale) where.push('p.was_price > p.price AND (p.was_price - p.price) / p.was_price BETWEEN 0.05 AND 0.9');
  if (search) {
    const q = ftsQuery(search);
    if (!q) return null;
    where.push('p.id IN (SELECT rowid FROM products_fts WHERE products_fts MATCH ?)');
    binds.push(q);
  }
  return { sql: where.join(' AND '), binds };
}

export async function listProducts(db, filters, { sort = 'featured', page = 1, perPage = 24 } = {}) {
  const f = buildFilter(filters);
  if (!f) return { products: [], total: 0, page: 1, pages: 0 };
  const order = SORTS[normalizeSort(sort)];
  const offset = (page - 1) * perPage;
  const [count, rows] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n FROM ${LAYOUT.from} p WHERE ${f.sql}`).bind(...f.binds),
    db.prepare(`SELECT ${CARD_COLUMNS} FROM ${LAYOUT.from} p WHERE ${f.sql} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(...f.binds, perPage, offset)
  ]);
  const total = Number(count.results?.[0]?.n || 0);
  return { products: fixAll(rows.results), total, page, pages: Math.ceil(total / perPage) };
}

export async function facets(db, category) {
  const c = catWhere(category);
  const [brands, retailers, price] = await db.batch([
    db.prepare(`SELECT brand AS name, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND ${c.sql}
      AND brand IS NOT NULL AND TRIM(brand) <> '' GROUP BY brand ORDER BY n DESC, brand LIMIT 40`).bind(...c.binds),
    db.prepare(`SELECT retailer AS name, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND ${c.sql}
      GROUP BY retailer ORDER BY n DESC, retailer`).bind(...c.binds),
    db.prepare(`SELECT MIN(price) AS lo, MAX(price) AS hi FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND ${c.sql}`).bind(...c.binds)
  ]);
  return {
    brands: brands.results || [],
    retailers: retailers.results || [],
    priceLow: Number(price.results?.[0]?.lo || 0),
    priceHigh: Number(price.results?.[0]?.hi || 0)
  };
}

// Up to 4 active products, in the order asked (compare page).
export async function getProductsByIds(db, ids) {
  if (!ids.length) return [];
  const r = await db.prepare(`SELECT * FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND p.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const byId = new Map(fixAll(r.results).map(p => [Number(p.id), p]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

export async function getProduct(db, id) {
  return fix(await db.prepare(`SELECT * FROM ${LAYOUT.from} p WHERE p.id = ? AND p.is_active = 1 LIMIT 1`).bind(id).first());
}

export async function getProductForRedirect(db, id) {
  if (LAYOUT.legacy) {
    return db
      .prepare(`SELECT id, awin_product_id, awin_advertiser_id, retailer, brand, site_category, category_slug, product_name,
        affiliate_url, currency FROM ${LAYOUT.from} p WHERE p.id = ? AND p.is_active = 1 LIMIT 1`)
      .bind(id)
      .first();
  }
  return db
    .prepare('SELECT id, awin_advertiser_id, retailer, category_slug, affiliate_url FROM products WHERE id = ? AND is_active = 1 LIMIT 1')
    .bind(id)
    .first();
}

export async function similarProducts(db, product, limit = 8) {
  if (!product.category_slug) return [];
  const c = catWhere(product.category_slug);
  const r = await db
    .prepare(`SELECT ${CARD_COLUMNS} FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND ${c.sql} AND p.id <> ?
      ORDER BY ABS(p.price - ?) ASC, p.id ASC LIMIT ?`)
    .bind(...c.binds, product.id, product.price, limit)
    .all();
  return fixAll(r.results);
}

export async function homeData(db, categorySlugs) {
  const [counts, deals, newest, retailers, updated] = await db.batch([
    db.prepare(`SELECT category_slug AS slug, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 GROUP BY category_slug`),
    db.prepare(`SELECT ${CARD_COLUMNS} FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND p.in_stock = 1 AND p.was_price > p.price
      AND (p.was_price - p.price) / p.was_price BETWEEN 0.05 AND 0.9
      ORDER BY (p.was_price - p.price) / p.was_price DESC, p.id ASC LIMIT 11`),
    db.prepare(`SELECT ${CARD_COLUMNS} FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND p.in_stock = 1
      ORDER BY p.first_seen_at DESC, p.id DESC LIMIT 11`),
    db.prepare('SELECT retailer AS name, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY retailer ORDER BY n DESC, retailer'),
    db.prepare(`SELECT MAX(last_seen_at) AS t FROM ${LAYOUT.from} p WHERE p.is_active = 1`)
  ]);
  const byCat = Object.fromEntries((counts.results || []).map(r => [r.slug, Number(r.n)]));
  const categoryCounts = Object.fromEntries(categorySlugs.map(s => [s, byCat[s] || 0]));
  const totalProducts = Object.values(byCat).reduce((a, b) => a + b, 0);
  return {
    categoryCounts,
    totalProducts,
    deals: fixAll(deals.results),
    newest: fixAll(newest.results),
    retailers: retailers.results || [],
    lastUpdated: updated.results?.[0]?.t || ''
  };
}

export async function stats(db) {
  const r = await db.prepare(
    'SELECT retailer, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY retailer ORDER BY retailer COLLATE NOCASE'
  ).all();
  const rows = r.results || [];
  return {
    products: rows.reduce((t, x) => t + Number(x.n || 0), 0),
    retailers: rows.length,
    retailer_names: rows.map(x => String(x.retailer))
  };
}

export async function categoryCounts(db) {
  const r = await db.prepare(`SELECT category_slug AS slug, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 GROUP BY category_slug`).all();
  return Object.fromEntries((r.results || []).filter(x => x.slug).map(x => [x.slug, Number(x.n)]));
}

export async function sitemapCount(db) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM products WHERE is_active = 1').first();
  return Number(r?.n || 0);
}

export async function sitemapChunk(db, offset, limit) {
  const r = await db
    .prepare(`SELECT id, product_name, product_slug, updated_at FROM ${LAYOUT.from} p WHERE p.is_active = 1 ORDER BY p.id LIMIT ? OFFSET ?`)
    .bind(limit, offset)
    .all();
  return fixAll(r.results);
}

export async function logClick(db, row) {
  if (LAYOUT.legacy) {
    // The older sites' click table (same columns their dashboards and the Hub reports read).
    await db
      .prepare(`INSERT INTO affiliate_clicks (product_id, awin_product_id, retailer, brand, site_category, product_name,
        page_path, language, display_currency, country_code, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'retailer_click')`)
      .bind(row.product_id, row.awin_product_id || '', row.retailer || '', row.brand || '', row.site_category || '',
        row.product_name || '', row.page_path || '', row.language || '', row.display_currency || 'GBP', row.country_code || '')
      .run();
    return;
  }
  await db
    .prepare(`INSERT INTO affiliate_clicks (product_id, awin_advertiser_id, retailer, category_slug, page_path, country_code, click_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(row.product_id, row.awin_advertiser_id, row.retailer, row.category_slug, row.page_path, row.country_code, row.click_ref)
    .run();
}

export async function addNewsletter(db, { email, consentText, sourcePath }) {
  const r = await db
    .prepare('INSERT INTO newsletter (email, consent_text, source_path) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING')
    .bind(email, consentText, sourcePath)
    .run();
  return r.meta?.changes || 0;
}
