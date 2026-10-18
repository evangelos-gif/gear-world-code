// All D1 queries. Every value goes through bind() (lessons L08). Sort orders come from a fixed list.

const CARD_COLUMNS = `id, product_name, product_slug, brand, retailer, category_slug, price, was_price,
  currency, in_stock, item_condition, image_url`;

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
  if (category) { where.push('p.category_slug = ?'); binds.push(category); }
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
    db.prepare(`SELECT COUNT(*) AS n FROM products p WHERE ${f.sql}`).bind(...f.binds),
    db.prepare(`SELECT ${CARD_COLUMNS} FROM products p WHERE ${f.sql} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(...f.binds, perPage, offset)
  ]);
  const total = Number(count.results?.[0]?.n || 0);
  return { products: rows.results || [], total, page, pages: Math.ceil(total / perPage) };
}

export async function facets(db, category) {
  const [brands, retailers, price] = await db.batch([
    db.prepare(`SELECT brand AS name, COUNT(*) AS n FROM products WHERE is_active = 1 AND category_slug = ?
      AND brand IS NOT NULL AND TRIM(brand) <> '' GROUP BY brand ORDER BY n DESC, brand LIMIT 40`).bind(category),
    db.prepare(`SELECT retailer AS name, COUNT(*) AS n FROM products WHERE is_active = 1 AND category_slug = ?
      GROUP BY retailer ORDER BY n DESC, retailer`).bind(category),
    db.prepare('SELECT MIN(price) AS lo, MAX(price) AS hi FROM products WHERE is_active = 1 AND category_slug = ?').bind(category)
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
  const r = await db.prepare(`SELECT * FROM products WHERE is_active = 1 AND id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const byId = new Map((r.results || []).map(p => [Number(p.id), p]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

export async function getProduct(db, id) {
  return db.prepare(`SELECT * FROM products WHERE id = ? AND is_active = 1 LIMIT 1`).bind(id).first();
}

export async function getProductForRedirect(db, id) {
  return db
    .prepare('SELECT id, awin_advertiser_id, retailer, category_slug, affiliate_url FROM products WHERE id = ? AND is_active = 1 LIMIT 1')
    .bind(id)
    .first();
}

export async function similarProducts(db, product, limit = 8) {
  const r = await db
    .prepare(`SELECT ${CARD_COLUMNS} FROM products p WHERE p.is_active = 1 AND p.category_slug = ? AND p.id <> ?
      ORDER BY ABS(p.price - ?) ASC, p.id ASC LIMIT ?`)
    .bind(product.category_slug, product.id, product.price, limit)
    .all();
  return r.results || [];
}

export async function homeData(db, categorySlugs) {
  const [counts, deals, newest, retailers, updated] = await db.batch([
    db.prepare('SELECT category_slug AS slug, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY category_slug'),
    db.prepare(`SELECT ${CARD_COLUMNS} FROM products p WHERE p.is_active = 1 AND p.in_stock = 1 AND p.was_price > p.price
      AND (p.was_price - p.price) / p.was_price BETWEEN 0.05 AND 0.9
      ORDER BY (p.was_price - p.price) / p.was_price DESC, p.id ASC LIMIT 11`),
    db.prepare(`SELECT ${CARD_COLUMNS} FROM products p WHERE p.is_active = 1 AND p.in_stock = 1
      ORDER BY p.first_seen_at DESC, p.id DESC LIMIT 11`),
    db.prepare('SELECT retailer AS name, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY retailer ORDER BY n DESC, retailer'),
    db.prepare('SELECT MAX(last_seen_at) AS t FROM products WHERE is_active = 1')
  ]);
  const byCat = Object.fromEntries((counts.results || []).map(r => [r.slug, Number(r.n)]));
  const categoryCounts = Object.fromEntries(categorySlugs.map(s => [s, byCat[s] || 0]));
  const totalProducts = Object.values(byCat).reduce((a, b) => a + b, 0);
  return {
    categoryCounts,
    totalProducts,
    deals: deals.results || [],
    newest: newest.results || [],
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

export async function sitemapCount(db) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM products WHERE is_active = 1').first();
  return Number(r?.n || 0);
}

export async function sitemapChunk(db, offset, limit) {
  const r = await db
    .prepare('SELECT id, product_name, product_slug, updated_at FROM products WHERE is_active = 1 ORDER BY id LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all();
  return r.results || [];
}

export async function logClick(db, row) {
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
