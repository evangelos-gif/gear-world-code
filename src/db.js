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
  buildSource(site);
  LAYOUT.group = Boolean(site && site.groupOffers);
  // Collections: pages made from other categories (e.g. "Gifts for Him": watches, jewellery... in a price
  // range, plus anything named "gift"). A product keeps its own category; it is also listed here.
  LAYOUT.collections = Object.fromEntries(((site && site.categories) || []).filter(c => c.collection).map(c => [c.slug, c.collection]));
}

function buildSource(site) {
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
  // Shown retailer names: one feed can come under two names (e.g. "X" and "X Affiliate Programme").
  const names = Object.entries(cfg.retailerNames || {});
  const retailerExpr = names.length
    ? `CASE retailer ${names.map(([from, to]) => `WHEN ${sqlText(from)} THEN ${sqlText(to)}`).join(' ')} ELSE retailer END`
    : 'retailer';
  // Sites whose import already matched the same product across retailers (CGW: product_group_offers)
  // group by that match first, then by GTIN. A product is in at most one group (product_id is unique there).
  const groupCol = cfg.groupTable === 'product_group_offers'
    ? ',\n    (SELECT g.group_id FROM product_group_offers g WHERE g.product_id = products.id) AS group_id'
    : '';
  const view = `(SELECT id, product_name, NULL AS product_slug, brand, ${retailerExpr} AS retailer, site_category,
    ${catExpr} AS category_slug, subcategory, merchant_category, price, NULL AS was_price,
    COALESCE(NULLIF(TRIM(currency), ''), 'GBP') AS currency,
    CASE WHEN LOWER(TRIM(COALESCE(stock_status, ''))) IN (${stock}) THEN 1 ELSE 0 END AS in_stock,
    'new' AS item_condition, image_url, affiliate_url,
    COALESCE(NULLIF(TRIM(ean), ''), json_extract(specs_json, '$.gtin')) AS gtin,
    json_extract(specs_json, '$.mpn') AS mpn,
    COALESCE(json_extract(specs_json, '$.description'), json_extract(specs_json, '$.product_short_description')) AS description,
    NULL AS specs_json, is_active, awin_product_id, NULL AS awin_advertiser_id,
    created_at AS first_seen_at, updated_at AS last_seen_at, updated_at${groupCol}
    FROM products)`;
  LAYOUT = {
    legacy: true,
    from: view,
    // Category filters use the old column, so its index is used.
    catSql: slug => `p.site_category IN (${(map[slug] || ['']).map(() => '?').join(', ')})`,
    catBinds: slug => (map[slug] || ['']),
    map,
    // The import already used the EAN when it built the groups, so the GTIN is not read again (faster on 70,000 rows).
    groupKey: groupCol ? "COALESCE('g:' || p.group_id, 'id:' || p.id)" : GTIN_KEY,
    groupById: Boolean(groupCol)
  };
}

export function isLegacy() { return LAYOUT.legacy; }

// One product sold by several retailers (same GTIN/EAN) is shown once, at its best offer: in stock first,
// then the lowest price. offer_count tells the card how many retailers sell it (site.groupOffers).
const GTIN_KEY = "COALESCE(NULLIF(TRIM(p.gtin), ''), 'id:' || p.id)";
const gk = () => LAYOUT.groupKey || GTIN_KEY;

export function offerKey(product) {
  if (product && product.group_id !== null && product.group_id !== undefined && product.group_id !== '') return `g:${product.group_id}`;
  if (LAYOUT.groupById) return `id:${product && product.id}`;
  const g = String((product && product.gtin) || '').trim();
  return g || `id:${product && product.id}`;
}

// offer_count = how many different retailers sell it (a retailer with two rows for one product counts once).
function cardSql(where, order, tail = '') {
  if (!LAYOUT.group) return `SELECT ${CARD_COLUMNS} FROM ${LAYOUT.from} p WHERE ${where} ORDER BY ${order} ${tail}`;
  return `SELECT * FROM (SELECT q.*,
      ROW_NUMBER() OVER (PARTITION BY q.gk ORDER BY q.in_stock DESC, q.price ASC, q.id ASC) AS rn,
      SUM(CASE WHEN q.rr = 1 THEN 1 ELSE 0 END) OVER (PARTITION BY q.gk) AS offer_count
    FROM (SELECT ${CARD_COLUMNS}, first_seen_at, gtin, ${gk()} AS gk,
      ROW_NUMBER() OVER (PARTITION BY ${gk()}, p.retailer ORDER BY p.in_stock DESC, p.price ASC, p.id ASC) AS rr
      FROM ${LAYOUT.from} p WHERE ${where}) q) p WHERE p.rn = 1 ORDER BY ${order} ${tail}`;
}

// Every active offer of the same product (same GTIN), best first. Empty unless the site groups offers.
export async function offersFor(db, product, limit = 12) {
  if (!LAYOUT.group || !product || offerKey(product).startsWith('id:')) return [];
  const r = await db
    .prepare(`SELECT id, retailer, price, currency, in_stock, last_seen_at FROM ${LAYOUT.from} p
      WHERE p.is_active = 1 AND ${gk()} = ? ORDER BY p.in_stock DESC, p.price ASC, p.id ASC LIMIT ?`)
    .bind(offerKey(product), limit)
    .all();
  // One line per retailer: its best offer.
  const seen = new Set();
  const rows = (r.results || []).filter(o => (seen.has(o.retailer) ? false : seen.add(o.retailer)));
  return rows.length > 1 ? rows : [];
}

function plainCatWhere(slug) {
  return { sql: typeof LAYOUT.catSql === 'function' ? LAYOUT.catSql(slug) : LAYOUT.catSql, binds: LAYOUT.catBinds(slug) };
}

function catWhere(slug) {
  const col = LAYOUT.collections && LAYOUT.collections[slug];
  if (!col) return plainCatWhere(slug);
  const parts = (col.from || []).map(plainCatWhere);
  if (!parts.length) return { sql: '0', binds: [] };
  const inFrom = `(${parts.map(x => x.sql).join(' OR ')})`;
  const fromBinds = parts.flatMap(x => x.binds);
  const min = Number(col.minPrice) || 0;
  const max = Number(col.maxPrice) || 1e9;
  const words = (col.words || []).map(w => `%${String(w).toLowerCase()}%`);
  const wordSql = words.length ? ` OR (${inFrom} AND (${words.map(() => 'LOWER(p.product_name) LIKE ?').join(' OR ')}))` : '';
  return {
    sql: `((${inFrom} AND p.price BETWEEN ? AND ?)${wordSql})`,
    binds: [...fromBinds, min, max, ...(words.length ? [...fromBinds, ...words] : [])]
  };
}

// Product counts of the collection pages (their products are counted in their own categories too).
async function collectionCounts(db) {
  const slugs = Object.keys(LAYOUT.collections || {});
  const out = {};
  await Promise.all(slugs.map(async slug => {
    const c = catWhere(slug);
    const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND ${c.sql}`).bind(...c.binds).first();
    out[slug] = Number((r && r.n) || 0);
  }));
  return out;
}

// Rows from the legacy layout get their address slug and a sharper image here.
// Text that was saved twice as UTF-8 ("Menâ€™s Watch â€“ 44mm"), shown as meant ("Men’s Watch – 44mm").
const MOJIBAKE = [['â€™', '’'], ['â€˜', '‘'], ['â€œ', '“'], ['â€\u009d', '”'], ['â€“', '–'], ['â€”', '—'], ['â€¦', '…'], ['Â£', '£'], ['Â®', '®'], ['Â©', '©'], ['â„¢', '™'], ['Ã©', 'é'], ['Ã¨', 'è'], ['Ã¶', 'ö'], ['Ã¼', 'ü'], ['Ã¤', 'ä'],
  ['Ã±', 'ñ'], ['Ã¡', 'á'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'], ['Ã§', 'ç'], ['Ã¢', 'â'], ['Ãª', 'ê'], ['Ã´', 'ô'], ['Ã®', 'î'],
  ['Ã¸', 'ø'], ['Ã¥', 'å'], ['Ã‰', 'É'], ['ÃŸ', 'ß'], ['Ã„', 'Ä'], ['Ã–', 'Ö'], ['Ãœ', 'Ü'], ['â€¢', '•'], ['Â°', '°'], ['Â½', '½'], ['Â ', ' ']];
export function fixMojibake(text) {
  let t = String(text ?? '');
  if (!/[âÃÂ]/.test(t)) return text;
  for (const [bad, good] of MOJIBAKE) t = t.split(bad).join(good);
  return t;
}

function fix(row) {
  if (!row || !LAYOUT.legacy) return row;
  // The address keeps the old rule on the saved name, so links that already exist keep working.
  row.product_slug = legacySlug(row.product_name);
  for (const k of ['product_name', 'brand', 'description', 'subcategory']) if (row[k]) row[k] = fixMojibake(row[k]);
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
  const countSql = LAYOUT.group
    ? `SELECT COUNT(DISTINCT ${gk()}) AS n FROM ${LAYOUT.from} p WHERE ${f.sql}`
    : `SELECT COUNT(*) AS n FROM ${LAYOUT.from} p WHERE ${f.sql}`;
  const [count, rows] = await db.batch([
    db.prepare(countSql).bind(...f.binds),
    db.prepare(cardSql(f.sql, order, 'LIMIT ? OFFSET ?')).bind(...f.binds, perPage, offset)
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

// A hidden card of a product that still has another card on the site (InStock sent one card per size/colour; the
// clean-up kept one). Its old address then goes to the card that stays (301), so a link from Google keeps working.
// Same retailer, same shop page in the Awin link (.../products%2F<page>%3Fvariant...). Older layout only.
const SHOP_PAGE = /products%2F([a-z0-9._~-]{2,200})%3Fvariant/i;
export async function activeVariantOf(db, id) {
  if (!LAYOUT.legacy) return null;
  const gone = await db.prepare('SELECT retailer, affiliate_url FROM products WHERE id = ? AND is_active = 0 LIMIT 1').bind(id).first();
  const m = gone && SHOP_PAGE.exec(String(gone.affiliate_url || ''));
  if (!m) return null;
  const alt = await db
    .prepare(`SELECT id, product_name FROM products WHERE is_active = 1 AND retailer = ? AND instr(affiliate_url, ?) > 0 ORDER BY price ASC, id ASC LIMIT 1`)
    .bind(gone.retailer, `products%2F${m[1]}%3Fvariant`)
    .first();
  return alt ? fix(alt) : null;
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
    .prepare(cardSql(`p.is_active = 1 AND ${c.sql} AND p.id <> ? AND ${gk()} <> ?`, 'ABS(p.price - ?) ASC, p.id ASC', 'LIMIT ?'))
    .bind(...c.binds, product.id, offerKey(product), product.price, limit)
    .all();
  return fixAll(r.results);
}

export async function homeData(db, categorySlugs) {
  const [counts, deals, newest, retailers, updated] = await db.batch([
    db.prepare(`SELECT category_slug AS slug, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 GROUP BY category_slug`),
    db.prepare(cardSql(`p.is_active = 1 AND p.in_stock = 1 AND p.was_price > p.price
      AND (p.was_price - p.price) / p.was_price BETWEEN 0.05 AND 0.9`, '(p.was_price - p.price) / p.was_price DESC, p.id ASC', 'LIMIT 11')),
    db.prepare(cardSql('p.is_active = 1 AND p.in_stock = 1', 'p.first_seen_at DESC, p.id DESC', 'LIMIT 11')),
    db.prepare(`SELECT retailer AS name, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 GROUP BY retailer ORDER BY n DESC, retailer`),
    db.prepare(`SELECT MAX(last_seen_at) AS t FROM ${LAYOUT.from} p WHERE p.is_active = 1`)
  ]);
  const byCat = Object.fromEntries((counts.results || []).map(r => [r.slug, Number(r.n)]));
  const totalProducts = Object.values(byCat).reduce((a, b) => a + b, 0);
  Object.assign(byCat, await collectionCounts(db));
  const categoryCounts = Object.fromEntries(categorySlugs.map(s => [s, byCat[s] || 0]));
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
    `SELECT retailer, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 GROUP BY retailer ORDER BY retailer COLLATE NOCASE`
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
  const out = Object.fromEntries((r.results || []).filter(x => x.slug).map(x => [x.slug, Number(x.n)]));
  return Object.assign(out, await collectionCounts(db));
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
