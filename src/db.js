// All D1 queries. Every value goes through bind() (lessons L08). Sort orders come from a fixed list.
//
// Two database layouts are supported:
//   - native: the TGW schema (sites/tgw/migrations).
//   - legacy: the database the older Gear World sites already have, written by the Hub import router
//     (site_category name, stock_status text, ean, specs_json ...). It is read AS IT IS: no table is
//     changed, the router keeps writing the same way, and product ids and addresses stay the same.
//     A read-only "view" in each query maps it to the native column names (lessons L28).

// last_seen_at: the day the price was last checked (lessons L107: hidden after 30 days, "check at the retailer" after 14).
const NATIVE_CARD_COLUMNS = `id, product_name, product_slug, brand, retailer, category_slug, price, was_price,
  currency, in_stock, item_condition, image_url, subcategory, merchant_category, last_seen_at`;
import { visibleSql, hiddenReason } from './lib/visibility.js';
import { deliveryCountries } from './lib/delivery.js';

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

export const IN_STOCK_WORDS = ['in_stock', 'in stock', '1', 'true', 'yes', 'available to order'];

// GTIN of an older-layout row: the ean column, or the gtin in specs_json when ean is empty.
const LEGACY_GTIN = "COALESCE(NULLIF(TRIM(ean), ''), json_extract(specs_json, '$.gtin'))";
// Its product-group key on the table's own columns: the same value as gk() through the view. The L51 index
// idx_products_group_key is built on exactly this text, so SQLite finds a group's rows through it.
export const LEGACY_GROUP_KEY = `COALESCE(NULLIF(TRIM(${LEGACY_GTIN}), ''), 'id:' || id)`;

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
    ${LEGACY_GTIN} AS gtin,
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

// The rows a visitor may see (src/lib/visibility.js, lessons L107): one more WHERE term, or nothing without a view.
// Every function below that takes a view adds it; without one it reads exactly as before.
function vis(view) {
  return visibleSql(view) || { sql: '', binds: [] };
}
const andVis = v => (v.sql ? ` AND ${v.sql}` : '');
// The older layout has no feed RRP (was_price is NULL in its view): a list of products below their RRP is always empty
// there, so it is not asked for (it used to read every active row for nothing on every home page).
export function hasRrp() { return !LAYOUT.legacy; }

// One product sold by several retailers (same GTIN/EAN) is shown once, at its best offer: in stock first,
// then the lowest price. offer_count tells the card how many retailers sell it (site.groupOffers).
// GTIN_KEY is the group key on the rows named p (the new layout's table, or the older layout's view).
export const GTIN_KEY = "COALESCE(NULLIF(TRIM(p.gtin), ''), 'id:' || p.id)";
// The same key on the new layout's own columns (no alias). The index idx_products_group_key of the new-layout databases
// (sites/<site>/migrations/0002_group_key_index.sql, lessons L105) is built on exactly this text, so SQLite finds the
// rows of a group through it (without the index, "the same product at other retailers" read the whole table: AGW 36,212
// rows on every product page, 8 Nov 2026).
export const NATIVE_GROUP_KEY = "COALESCE(NULLIF(TRIM(gtin), ''), 'id:' || id)";
const gk = () => LAYOUT.groupKey || GTIN_KEY;

export function offerKey(product) {
  if (product && product.group_id !== null && product.group_id !== undefined && product.group_id !== '') return `g:${product.group_id}`;
  if (LAYOUT.groupById) return `id:${product && product.id}`;
  const g = String((product && product.gtin) || '').trim();
  return g || `id:${product && product.id}`;
}

// offer_count = how many different retailers sell it (a retailer with two rows for one product counts once).
// from: the rows, always named p (a list of product ids can be joined in front of them, see groupFilter).
function cardSql(where, order, tail = '', from = `${LAYOUT.from} p`) {
  if (!LAYOUT.group) return `SELECT ${CARD_COLUMNS} FROM ${from} WHERE ${where} ORDER BY ${order} ${tail}`;
  return `SELECT * FROM (SELECT q.*,
      ROW_NUMBER() OVER (PARTITION BY q.gk ORDER BY q.in_stock DESC, q.price ASC, q.id ASC) AS rn,
      SUM(CASE WHEN q.rr = 1 THEN 1 ELSE 0 END) OVER (PARTITION BY q.gk) AS offer_count
    FROM (SELECT ${CARD_COLUMNS}, first_seen_at, gtin, ${gk()} AS gk,
      ROW_NUMBER() OVER (PARTITION BY ${gk()}, p.retailer ORDER BY p.in_stock DESC, p.price ASC, p.id ASC) AS rr
      FROM ${from} WHERE ${where}) q) p WHERE p.rn = 1 ORDER BY ${order} ${tail}`;
}

// ---- Lists that read only the rows they show (lessons L51, L105) ----
// D1 bills every row a query reads (Workers Paid: 25 billion a month included, then $1 per billion). On the older
// sites "the same product at other retailers" and "similar products" used to read the whole table or the whole
// category for every product page (CGW: about 370,000 rows per page; the network paid about $24 on 23 Oct 2026).
// The new-layout sites did the same until 8 Nov 2026 (AGW: about 62,000 rows per product page, L105).
// They now find the rows next to the product through an index and return exactly the same cards. When that cannot
// be proved for a product (rare), the old full query runs, so the page never changes.

// Rows read on each side of a product's price (or from the newest end) before the cards are chosen.
const NEAR = 40;

// The rows of the given product groups (keys made by gk()), and nothing else.
// The ids of those rows are found through an index and joined IN FRONT of the rows with CROSS JOIN. SQLite always
// keeps the left side of a CROSS JOIN as the outer loop, so it reads each row by its id and never the whole category
// or table, whatever its statistics say.
//   CGW (groupById): the import's match table product_group_offers (index on group_id), and single product ids.
//   Other older sites: the group key on the table's own columns (L51 index idx_products_group_key).
//   New layout: the same on its own columns (NATIVE_GROUP_KEY, L105 index idx_products_group_key). Until 8 Nov 2026
//   the key was only a filter after the category: "similar products" read the whole category (AGW about 26,000 rows).
// Binds: fromBinds go before the binds of the caller's WHERE, whereBinds after them.
function groupFilter(keys) {
  const list = JSON.stringify(keys.map(String));
  const key = LAYOUT.legacy ? LEGACY_GROUP_KEY : NATIVE_GROUP_KEY;
  let ids = { sql: `SELECT id AS pid FROM products WHERE ${key} IN (SELECT value FROM json_each(?))`, binds: [list] };
  if (LAYOUT.groupById) {
    const singles = [], groups = [];
    for (const k of keys.map(String)) {
      if (k.startsWith('g:')) groups.push(Number(k.slice(2)));
      else if (k.startsWith('id:')) singles.push(Number(k.slice(3)));
    }
    ids = {
      sql: `SELECT value AS pid FROM json_each(?)
        UNION ALL SELECT product_id AS pid FROM product_group_offers WHERE group_id IN (SELECT value FROM json_each(?))`,
      binds: [JSON.stringify(singles), JSON.stringify(groups)]
    };
  }
  return { from: `(${ids.sql}) pick CROSS JOIN ${LAYOUT.from} p`, where: 'p.id = pick.pid', fromBinds: ids.binds, whereBinds: [] };
}

// Every active offer of the same product (same GTIN), best first. Empty unless the site groups offers.
// Only the rows of the product's group are read, in both layouts (the same rows as the old query: the same key).
// opts.full: the old query that reads every row (tests compare the two).
// opts.view: only the offers the visitor may see (the same group rows are read: the filter adds no read).
export async function offersFor(db, product, limit = 12, opts = {}) {
  if (!LAYOUT.group || !product || offerKey(product).startsWith('id:')) return [];
  const key = offerKey(product);
  const f = opts.full
    ? { from: `${LAYOUT.from} p`, where: '1', fromBinds: [], whereBinds: [] }
    : groupFilter([key]);
  const v = vis(opts.view);
  const r = await db
    .prepare(`SELECT id, retailer, price, was_price, currency, in_stock, last_seen_at FROM ${f.from}
      WHERE p.is_active = 1 AND ${f.where} AND ${gk()} = ?${andVis(v)} ORDER BY p.in_stock DESC, p.price ASC, p.id ASC LIMIT ?`)
    .bind(...f.fromBinds, ...f.whereBinds, key, ...v.binds, limit)
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
async function collectionCounts(db, view = null) {
  const slugs = Object.keys(LAYOUT.collections || {});
  const out = {};
  const v = vis(view);
  await Promise.all(slugs.map(async slug => {
    const c = catWhere(slug);
    const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND ${c.sql}${andVis(v)}`).bind(...c.binds, ...v.binds).first();
    out[slug] = Number((r && r.n) || 0);
  }));
  return out;
}

// Rows from the legacy layout get their address slug and a sharper image here.
// Text that was saved twice as UTF-8 ("Menâ€™s Watch â€“ 44mm"), shown as meant ("Men’s Watch – 44mm").
const MOJIBAKE = [['â€™', '’'], ['â€˜', '‘'], ['â€œ', '“'], ['â€\u009d', '”'], ['â€“', '–'], ['â€”', '—'], ['â€¦', '…'], ['Â£', '£'], ['Â®', '®'], ['Â©', '©'], ['â„¢', '™'], ['Ã©', 'é'], ['Ã¨', 'è'], ['Ã¶', 'ö'], ['Ã¼', 'ü'], ['Ã¤', 'ä'],
  ['Ã±', 'ñ'], ['Ã¡', 'á'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'], ['Ã§', 'ç'], ['Ã¢', 'â'], ['Ãª', 'ê'], ['Ã´', 'ô'], ['Ã®', 'î'],
  ['Ã¸', 'ø'], ['Ã¥', 'å'], ['Ã‰', 'É'], ['ÃŸ', 'ß'], ['Ã„', 'Ä'], ['Ã–', 'Ö'], ['Ãœ', 'Ü'], ['â€¢', '•'], ['Â°', '°'], ['Â½', '½'], ['Â\u00a0', ' '], ['Â ', ' ']];
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
  // "saving" (the address keeps its old name): the furthest below the feed's RRP first. The RRP is not a previous price.
  saving: '(CASE WHEN was_price > price THEN (was_price - price) / was_price ELSE 0 END) DESC, id ASC'
};

export const SORT_OPTIONS = [
  ['featured', 'Featured'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['newest', 'Newest'],
  ['saving', 'Furthest below RRP']
];

export function normalizeSort(value) {
  return Object.hasOwn(SORTS, value) ? value : 'featured';
}

// Builds a safe search expression for FTS5 from user text.
export function ftsQuery(text) {
  const terms = String(text ?? '').normalize('NFKC').match(/[\p{L}\p{N}]+/gu) || [];
  return terms.slice(0, 8).map(t => `"${t.replace(/"/g, '""')}"*`).join(' AND ');
}

// A subcategory found by words in the product name (TGW "Mini PCs", 6 Nov 2026, lessons L97): the feeds file mini PCs
// under "Computers" or "PC's & Workstations", so the feed's own subcategory cannot find them. `words`: a name matches
// when it has one of them as whole words ("nuc" finds "Cubi NUC 1M", not "D-Link Nuclias"); `not`: it has none of these
// (a "power adapter for mini PC" is not a mini PC). Brackets, commas, dots, slashes, hyphens and the like count as spaces.
const PUNCT = ['(', ')', ',', '.', '/', '-', ':', ';', '|', '+'];
const NAME_WORDS = `(' ' || ${PUNCT.reduce((e, ch) => `replace(${e}, '${ch}', ' ')`, 'lower(p.product_name)')} || ' ')`;
const wordOf = w => ' ' + String(w).toLowerCase().replace(/[(),./:;|+-]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
export function nameMatch(m) {
  const words = (m && Array.isArray(m.words) ? m.words : []).map(wordOf).filter(w => w.trim().length > 1).slice(0, 30);
  const not = (m && Array.isArray(m.not) ? m.not : []).map(wordOf).filter(w => w.trim().length > 1).slice(0, 30);
  if (!words.length) return null;
  const any = list => '(' + list.map(() => `instr(${NAME_WORDS}, ?) > 0`).join(' OR ') + ')';
  return { sql: not.length ? `${any(words)} AND NOT ${any(not)}` : any(words), binds: [...words, ...not] };
}

// view: the rows the visitor may see (lessons L107). fresh: only prices checked in the last CHECK_AFTER_DAYS days (the
// list of products below their RRP "today" never shows an older price).
function buildFilter({ category, subcategory, subMatch, brand, retailer, maxPrice, minPrice, inStock, condition, search, onSale, view, fresh }) {
  const where = ['p.is_active = 1'];
  const binds = [];
  if (category) { const c = catWhere(category); where.push(c.sql); binds.push(...c.binds); }
  // Only a site whose config lists subcategories for the category passes one (ZGW birds).
  if (subcategory) { where.push('p.subcategory = ?'); binds.push(subcategory); }
  const nm = subMatch ? nameMatch(subMatch) : null;
  if (nm) { where.push(nm.sql); binds.push(...nm.binds); }
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
  const v = vis(view);
  if (v.sql) { where.push(v.sql); binds.push(...v.binds); }
  if (fresh && view && view.checkFrom) { where.push('likelihood(+p.last_seen_at >= ?, 1.0)'); binds.push(view.checkFrom); }
  return { sql: where.join(' AND '), binds };
}

// Lessons L107 (checker of 9 Nov 2026, item 14): a search narrowed to one brand (or one retailer) was counted from the
// brand (retailer) index alone, probed with each id the search matched: the index holds the id, so no row was read.
// The view's date term needs the row too, and SQLite then probes the table by id instead, which D1 counts as more rows
// (TGW, a search with a brand: 90,261 rows instead of 60,376). INDEXED BY keeps the index probe; the row read after it
// is not counted (TGW 271,086 rows for the page, as before the view; AGW, a retailer: 356,416 instead of 388,231). Only
// on the newer layout, whose indexes come from its own migration (sites/<site>/migrations/0001_init.sql:
// idx_products_brand and idx_products_retailer on every new site), and only with a view and a search.
function countIndex(filters) {
  if (LAYOUT.legacy || !filters || !filters.search || !filters.view) return '';
  if (filters.brand) return ' INDEXED BY idx_products_brand';
  if (filters.retailer) return ' INDEXED BY idx_products_retailer';
  return '';
}

export async function listProducts(db, filters, { sort = 'featured', page = 1, perPage = 24 } = {}) {
  const f = buildFilter(filters);
  if (!f || (filters && filters.onSale && !hasRrp())) return { products: [], total: 0, page: 1, pages: 0 };
  const order = SORTS[normalizeSort(sort)];
  const offset = (page - 1) * perPage;
  const from = `${LAYOUT.from} p${countIndex(filters)}`;
  const countSql = LAYOUT.group
    ? `SELECT COUNT(DISTINCT ${gk()}) AS n FROM ${from} WHERE ${f.sql}`
    : `SELECT COUNT(*) AS n FROM ${from} WHERE ${f.sql}`;
  const [count, rows] = await db.batch([
    db.prepare(countSql).bind(...f.binds),
    db.prepare(cardSql(f.sql, order, 'LIMIT ? OFFSET ?')).bind(...f.binds, perPage, offset)
  ]);
  const total = Number(count.results?.[0]?.n || 0);
  return { products: fixAll(rows.results), total, page, pages: Math.ceil(total / perPage) };
}

// Products per subcategory of a category (only for a category whose site config lists subcategories: ZGW birds).
// A subcategory with `match` (words in the name, TGW Mini PCs) is counted by those words, under its own name.
export async function subcategoryCounts(db, category, subs = [], view = null) {
  const c = catWhere(category);
  const v = vis(view);
  const byName = (subs || []).filter(s => s && s.match && nameMatch({ words: s.match, not: s.exclude }));
  const list = [db.prepare(`SELECT p.subcategory AS name, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND ${c.sql}
    AND p.subcategory IS NOT NULL${andVis(v)} GROUP BY p.subcategory`).bind(...c.binds, ...v.binds)];
  for (const s of byName) {
    const nm = nameMatch({ words: s.match, not: s.exclude });
    list.push(db.prepare(`SELECT ? AS name, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND ${c.sql} AND ${nm.sql}${andVis(v)}`)
      .bind(s.name, ...c.binds, ...nm.binds, ...v.binds));
  }
  const res = await db.batch(list);
  const out = Object.fromEntries((res[0].results || []).map(x => [x.name, Number(x.n) || 0]));
  for (let i = 1; i < res.length; i++) for (const x of res[i].results || []) out[x.name] = Number(x.n) || 0;
  return out;
}

// subMatch (TGW Mini PCs): the brands, shops and prices of that subcategory only.
export async function facets(db, category, subMatch = null, view = null) {
  const base = catWhere(category);
  const nm = subMatch ? nameMatch(subMatch) : null;
  const v = vis(view);
  const c0 = nm ? { sql: `${base.sql} AND ${nm.sql}`, binds: [...base.binds, ...nm.binds] } : base;
  const c = v.sql ? { sql: `${c0.sql} AND ${v.sql}`, binds: [...c0.binds, ...v.binds] } : c0;
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

// The brands and shops among the products a search finds (the search words only, like facets() for a category), so the
// search page can filter by shop and brand too. Owner, 7 Nov 2026, on TGW: "doesn't have feature to select by retailer";
// the search already obeyed ?retailer= and ?brand=, only its page had no list to choose from (lessons L98).
export async function searchFacets(db, search, view = null) {
  const f = buildFilter({ search, view });
  if (!f) return { brands: [], retailers: [] };
  // One query, shop and brand together. "+p.is_active" lets SQLite start from the products the search words found, not
  // from every active product: on the live TGW "wireless mouse" reads about 2,200 rows instead of 30,000 (D1 counts
  // rows read; the free plan allows 5 million a day for the whole account).
  const where = f.sql.replace(/^p\.is_active = 1/, '+p.is_active = 1');
  const rows = (await db.prepare(`SELECT p.retailer AS retailer, p.brand AS brand, COUNT(*) AS n FROM ${LAYOUT.from} p
    WHERE ${where} GROUP BY p.retailer, p.brand`).bind(...f.binds).all()).results || [];
  const sum = key => {
    const m = new Map();
    for (const r of rows) {
      const name = typeof r[key] === 'string' ? r[key] : '';  // as stored: the filter asks for the exact name
      if (name.trim()) m.set(name, (m.get(name) || 0) + (Number(r.n) || 0));
    }
    return [...m].map(([name, n]) => ({ name, n })).sort((x, y) => y.n - x.n || (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  };
  return { brands: sum('brand').slice(0, 40), retailers: sum('retailer') };
}

// Up to 4 active products, in the order asked (compare page).
export async function getProductsByIds(db, ids) {
  if (!ids.length) return [];
  const r = await db.prepare(`SELECT * FROM ${LAYOUT.from} p WHERE p.is_active = 1 AND p.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const byId = new Map(fixAll(r.results).map(p => [Number(p.id), p]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

// Products of a buying guide (lessons L82), by primary key only: with "p.is_active = 1" SQLite chose the is_active
// index on the AGW database and read 9,868 rows for 11 products; "+p.is_active" keeps it on the key (22 rows, L51).
export async function getGuideProducts(db, ids) {
  if (!ids.length) return [];
  const r = await db.prepare(`SELECT * FROM ${LAYOUT.from} p WHERE +p.is_active = 1 AND p.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  return fixAll(r.results);
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

// The address of a row read without fix() (the older layout builds it from the saved name, as everywhere else).
export function productSlugOf(row) {
  return LAYOUT.legacy ? legacySlug(row && row.product_name) : (row && row.product_slug) || '';
}

export async function getProductForRedirect(db, id) {
  if (LAYOUT.legacy) {
    return db
      .prepare(`SELECT id, awin_product_id, awin_advertiser_id, retailer, brand, site_category, category_slug, product_name,
        product_slug, affiliate_url, currency, last_seen_at FROM ${LAYOUT.from} p WHERE p.id = ? AND p.is_active = 1 LIMIT 1`)
      .bind(id)
      .first();
  }
  return db
    .prepare('SELECT id, awin_advertiser_id, retailer, category_slug, product_name, product_slug, affiliate_url, last_seen_at FROM products WHERE id = ? AND is_active = 1 LIMIT 1')
    .bind(id)
    .first();
}

// Products of the same category closest in price (one card per product group, never the product's own group).
// The full query orders the cards by distance from the price, then by id. The rows next to the price are read in
// that same order through the category+price index: NEAR at or above the price, NEAR below it. The cards are then
// built from the groups of those rows only. A side that stopped at its limit has read every row of its side that
// comes before its last row; so when the last card comes before that row (or is it) on every such side, no other
// group can come before it: the result is the full query's. Otherwise (or with opts.full) the full query runs.
// Many products often share one price (CGW: 873 at £10.95 in one category), so all the rows read on a side can be
// at the same distance; the id decides between them, as in the full query (lessons L51: an earlier version compared
// distances only, so every product with 40 others at its own price ran the full query).
// Below the price the full query wants the rows of one price by the LOWER id first, but the index walks them by the
// higher id first. Sorting them in SQL read the whole last price block of that side (AGW-like data: often 1,000-2,000
// rows, lessons L105). So the side is read backwards along the index (no sort, NEAR rows), and when it stops inside a
// price block, that one block is read again from its lowest id (no sort, at most NEAR rows): together exactly the first
// NEAR rows of the side in the full query's order.
// The cards of the groups are then chosen from the plain rows of those groups (cardsOf), not with the window functions
// of cardSql: D1 counts the rows of every window step too (AGW-like data: about 1,500 rows instead of about 450).
// Price is NOT NULL in both layouts, so no NULL price comes first.
// opts.view (lessons L107): only products the visitor may see. Then the sides read exactly the same NEAR index rows as
// without a view, and the rows the visitor may not see are left out in JavaScript (the same test as the SQL, see
// src/lib/visibility.js): a side never walks further than without the view, whatever share of the category is hidden
// (Car Gear World: 98% of the tyres are from a Belgian shop, so a filtered walk could read thousands of rows for 40).
// The cards are then those that are sure to be the first ones of the full filtered query (before the last row read on
// each side that stopped at its limit), so they may be fewer than `limit`, never different. No full query runs.
export async function similarProducts(db, product, limit = 8, opts = {}) {
  if (!product.category_slug) return [];
  const c = catWhere(product.category_slug);
  const where = `p.is_active = 1 AND ${c.sql} AND p.id <> ? AND ${gk()} <> ?`;
  const binds = [...c.binds, product.id, offerKey(product)];
  const order = 'ABS(p.price - ?) ASC, p.id ASC';
  const v = vis(opts.view);
  const full = async () => fixAll((await db.prepare(cardSql(where + andVis(v), order, 'LIMIT ?')).bind(...binds, ...v.binds, product.price, limit).all()).results);
  const price = Number(product.price);
  if (opts.full || !Number.isFinite(price)) return full();
  const near = Math.max(1, Number(opts.near) || NEAR);
  if (v.sql) return similarInView(db, { where, binds, price, near, limit, view: opts.view, v });
  const side = (cond, sideOrder, value, n) => db
    .prepare(`SELECT ${CARD_COLUMNS}, ${gk()} AS gk FROM ${LAYOUT.from} p WHERE ${where} AND ${cond}
      ORDER BY ${sideOrder} LIMIT ?`)
    .bind(...binds, value, n);
  const [up, back] = (await db.batch([
    side('p.price >= ?', 'p.price ASC, p.id ASC', price, near),
    side('p.price < ?', 'p.price DESC, p.id DESC', price, near)
  ])).map(r => r.results || []);
  // Below the price, in the full query's order: each price block of the rows read backwards, turned round (lower id
  // first). Prices are compared as SQLite returned them (===), never re-sorted in JS.
  if (back.some(row => typeof row.price !== 'number')) return full();
  const blocks = [];
  for (const row of back) {
    const last = blocks[blocks.length - 1];
    if (last && last[0].price === row.price) last.push(row); else blocks.push([row]);
  }
  let down = blocks.flatMap(b => b.reverse());
  if (back.length >= near) {
    // The read stopped inside its last price block: that block again, from its lowest id.
    const cut = blocks[blocks.length - 1];
    const keep = back.length - cut.length;
    const block = (await side('p.price = ?', 'p.id ASC', cut[0].price, near - keep).all()).results || [];
    if (block.length !== near - keep) return full();
    down = [...down.slice(0, keep), ...block];
  }
  const dist = row => Math.abs(Number(row.price) - price);
  // The full query's order: closer first, then the lower id (negative when a comes first).
  const before = (a, b) => dist(a) - dist(b) || Number(a.id) - Number(b.id);
  const ends = [up, down].filter(rows => rows.length >= near).map(rows => rows[rows.length - 1]);
  const proved = rows => (rows.length >= limit ? ends.every(end => before(rows[limit - 1], end) <= 0) : ends.length === 0);
  const read = [...up, ...down].sort(before);
  if (!LAYOUT.group) {
    const rows = read.slice(0, limit).map(({ gk: _key, ...row }) => row);
    return proved(rows) ? fixAll(rows) : full();
  }
  const keys = [...new Set(read.map(r => r.gk))];
  if (!keys.length) return ends.length === 0 ? [] : full();
  const f = groupFilter(keys);
  const groupRows = (await db
    .prepare(`SELECT ${CARD_COLUMNS}, first_seen_at, gtin, ${gk()} AS gk FROM ${f.from} WHERE ${where} AND ${f.where}`)
    .bind(...f.fromBinds, ...binds, ...f.whereBinds)
    .all()).results || [];
  const rows = cardsOf(groupRows, before, limit);
  if (!rows) return full();
  return proved(rows) ? fixAll(rows) : full();
}

// similarProducts() for a view: the same NEAR rows on each side as without a view (no block read again), the hidden ones
// dropped in JavaScript, then the cards of the groups of the rows left, among the rows of those groups the visitor may
// see. Proof, side by side: above the price the rows were read in the full query's order, so every card up to the last
// row read (inclusive) is sure; below it the rows were read by price down and then by the HIGHER id, so rows of the last
// price read with a lower id may still come first in the full query: only a card strictly closer than that price is
// sure. A side that read fewer than NEAR rows read the whole side. The sure cards are a prefix of the full query's.
async function similarInView(db, { where, binds, price, near, limit, view, v }) {
  const side = (cond, sideOrder, value) => db
    .prepare(`SELECT ${CARD_COLUMNS}, ${gk()} AS gk FROM ${LAYOUT.from} p WHERE ${where} AND ${cond}
      ORDER BY ${sideOrder} LIMIT ?`)
    .bind(...binds, value, near);
  const [up, back] = (await db.batch([
    side('p.price >= ?', 'p.price ASC, p.id ASC', price),
    side('p.price < ?', 'p.price DESC, p.id DESC', price)
  ])).map(r => r.results || []);
  if ([...up, ...back].some(row => typeof row.price !== 'number' || typeof row.id !== 'number')) return [];
  const dist = row => Math.abs(row.price - price);
  const before = (a, b) => dist(a) - dist(b) || a.id - b.id;
  const upEnd = up.length >= near ? up[up.length - 1] : null;
  const backEnd = back.length >= near ? back[back.length - 1] : null;
  const sure = card => (!upEnd || before(card, upEnd) <= 0) && (!backEnd || dist(card) < dist(backEnd));
  const seen = [...up, ...back].filter(row => hiddenReason(view, row) === '');
  if (!seen.length) return [];
  let cards;
  if (!LAYOUT.group) {
    cards = seen.sort(before);
  } else {
    const keys = [...new Set(seen.map(r => r.gk))];
    const f = groupFilter(keys);
    const groupRows = (await db
      .prepare(`SELECT ${CARD_COLUMNS}, first_seen_at, gtin, ${gk()} AS gk FROM ${f.from} WHERE ${where} AND ${f.where} AND ${v.sql}`)
      .bind(...f.fromBinds, ...binds, ...f.whereBinds, ...v.binds)
      .all()).results || [];
    cards = cardsOf(groupRows, before, Infinity);
    if (!cards) return [];
  }
  const out = [];
  for (const card of cards) {
    if (out.length >= limit || !sure(card)) break;
    if (LAYOUT.group) out.push(card);
    else { const { gk: _key, ...row } = card; out.push(row); }
  }
  return fixAll(out);
}

// The cards that cardSql() makes, from the plain rows of whole product groups: per group (gk) its best offer (in stock
// first, then the lowest price, then the lowest id), with rr = rn = 1 and offer_count = how many different retailers
// the group's rows have; then sorted by `order` and cut at `limit`. The same choice as the window functions, on the
// same values. Values that JavaScript could compare differently from SQLite (not plain numbers or text) give null:
// the caller then runs the full query.
function cardsOf(rows, order, limit) {
  const groups = new Map();
  for (const row of rows) {
    if (typeof row.gk !== 'string' || typeof row.retailer !== 'string' || typeof row.price !== 'number'
      || typeof row.in_stock !== 'number' || typeof row.id !== 'number') return null;
    const g = groups.get(row.gk);
    if (g) g.push(row); else groups.set(row.gk, [row]);
  }
  const better = (a, b) => b.in_stock - a.in_stock || (a.price < b.price ? -1 : a.price > b.price ? 1 : 0) || a.id - b.id;
  const cards = [];
  for (const g of groups.values()) {
    const best = g.reduce((x, y) => (better(y, x) < 0 ? y : x));
    cards.push({ ...best, rr: 1, rn: 1, offer_count: new Set(g.map(r => r.retailer)).size });
  }
  return cards.sort(order).slice(0, limit);
}

// Order of the "newest" cards: first_seen_at DESC, id DESC. Negative when a comes first; NULL dates come last.
function newerFirst(a, b) {
  const fa = a.first_seen_at, fb = b.first_seen_at;
  if (fa !== fb) {
    if (fa === null || fa === undefined) return 1;
    if (fb === null || fb === undefined) return -1;
    return fa > fb ? -1 : 1;
  }
  return Number(b.id) - Number(a.id);
}

// The newest products in stock, one card per product group (home page). On the older sites this read every row
// (CGW: 1.2 million rows per home page). Now: the NEAR newest rows, then the cards of their groups only. Every row
// newer than the last one read was read, so when the last card is not older than it, the result is the full
// query's; otherwise the full query runs. The new layout keeps its query (its first_seen_at index makes it cheap).
async function newestCards(db, limit, opts = {}) {
  const v = vis(opts.view);
  const where = `p.is_active = 1 AND p.in_stock = 1${andVis(v)}`;
  const order = 'p.first_seen_at DESC, p.id DESC';
  const full = async () => (await db.prepare(cardSql(where, order, 'LIMIT ?')).bind(...v.binds, limit).all()).results || [];
  if (!LAYOUT.group || !LAYOUT.legacy || opts.full) return full();
  const near = Math.max(1, Number(opts.near) || NEAR);
  const read = (await db.prepare(`SELECT p.id, p.first_seen_at FROM ${LAYOUT.from} p WHERE ${where} ORDER BY ${order} LIMIT ?`)
    .bind(...v.binds, near).all()).results || [];
  if (!read.length) return [];
  // Dates are text in the older layout; anything else is compared by the full query instead of guessed here.
  if (read.some(r => r.first_seen_at !== null && typeof r.first_seen_at !== 'string')) return full();
  // The group key of each row read, by its id (the id list drives the join, as in groupFilter).
  const keyRows = (await db
    .prepare(`SELECT ${gk()} AS gk FROM (SELECT value AS pid FROM json_each(?)) pick CROSS JOIN ${LAYOUT.from} p WHERE p.id = pick.pid`)
    .bind(JSON.stringify(read.map(r => Number(r.id)))).all()).results || [];
  const f = groupFilter([...new Set(keyRows.map(r => r.gk))]);
  const rows = (await db
    .prepare(cardSql(`${where} AND ${f.where}`, order, 'LIMIT ?', f.from))
    .bind(...f.fromBinds, ...v.binds, ...f.whereBinds, limit).all()).results || [];
  const proved = rows.length >= limit ? newerFirst(rows[limit - 1], read[read.length - 1]) <= 0 : read.length < near;
  return proved ? rows : full();
}

// opts.full: the old queries that read every row (tests compare the two). opts.view: what the visitor may see (L107).
// "Below RRP" (the list once called "Today's price drops"): in stock, priced at least 5% under the feed's RRP,
// and checked in the last CHECK_AFTER_DAYS days. Not asked for on the older layout, which has no RRP.
export async function homeData(db, categorySlugs, opts = {}) {
  const v = vis(opts.view);
  const fresh = opts.view && opts.view.checkFrom ? { sql: ' AND likelihood(+p.last_seen_at >= ?, 1.0)', binds: [opts.view.checkFrom] } : { sql: '', binds: [] };
  const queries = [
    db.prepare(`SELECT category_slug AS slug, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1${andVis(v)} GROUP BY category_slug`).bind(...v.binds),
    db.prepare(`SELECT retailer AS name, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1${andVis(v)} GROUP BY retailer ORDER BY n DESC, retailer`).bind(...v.binds),
    db.prepare(`SELECT MAX(last_seen_at) AS t FROM ${LAYOUT.from} p WHERE p.is_active = 1${andVis(v)}`).bind(...v.binds)
  ];
  if (hasRrp()) {
    queries.push(db.prepare(cardSql(`p.is_active = 1 AND p.in_stock = 1 AND p.was_price > p.price
      AND (p.was_price - p.price) / p.was_price BETWEEN 0.05 AND 0.9${andVis(v)}${fresh.sql}`, '(p.was_price - p.price) / p.was_price DESC, p.id ASC', 'LIMIT 11')).bind(...v.binds, ...fresh.binds));
  }
  const [counts, retailers, updated, deals] = await db.batch(queries);
  const newest = { results: await newestCards(db, 11, opts) };
  const byCat = Object.fromEntries((counts.results || []).map(r => [r.slug, Number(r.n)]));
  const totalProducts = Object.values(byCat).reduce((a, b) => a + b, 0);
  Object.assign(byCat, await collectionCounts(db, opts.view));
  const categoryCounts = Object.fromEntries(categorySlugs.map(s => [s, byCat[s] || 0]));
  return {
    categoryCounts,
    totalProducts,
    deals: fixAll(deals ? deals.results : []),
    newest: fixAll(newest.results),
    retailers: retailers.results || [],
    lastUpdated: updated.results?.[0]?.t || ''
  };
}

// view: the UK view (the Hub and the group page show these numbers to everyone).
// One query for the whole site (lessons L106, L130): every active row is counted per retailer, with how many of them are
// fresh (price checked in the last HIDE_AFTER_DAYS days). The UK numbers (products, retailers, retailer_names) are the
// fresh rows of the retailers the UK view shows, exactly as before; all_products and delivery add every fresh row of every
// retailer, with the countries the retailer delivers to (site.deliversTo), so the group page can show each country.
// The rows read are the same as before: the old query walked every active row too and filtered them afterwards.
export async function stats(db, view = null, site = null) {
  const cutoff = view && view.cutoff ? view.cutoff : '';
  const fresh = cutoff ? 'SUM(CASE WHEN p.last_seen_at >= ? THEN 1 ELSE 0 END)' : 'COUNT(*)';
  const r = await db.prepare(
    `SELECT retailer, ${fresh} AS fresh FROM ${LAYOUT.from} p WHERE p.is_active = 1 GROUP BY retailer ORDER BY retailer COLLATE NOCASE`
  ).bind(...(cutoff ? [cutoff] : [])).all();
  const rows = (r.results || []).map(x => ({ name: String(x.retailer ?? ''), fresh: Number(x.fresh || 0) })).filter(x => x.fresh > 0);
  const inUk = name => !view || ((!view.hidden || !view.hidden.includes(name)) && (!view.only || view.only.includes(name)));
  const uk = rows.filter(x => inUk(x.name));
  return {
    products: uk.reduce((t, x) => t + x.fresh, 0),
    retailers: uk.length,
    retailer_names: uk.map(x => x.name),
    all_products: rows.reduce((t, x) => t + x.fresh, 0),
    delivery: rows.map(x => ({ retailer: x.name, products: x.fresh, countries: deliveryCountries(site, x.name) }))
  };
}

export async function categoryCounts(db, view = null) {
  const v = vis(view);
  const r = await db.prepare(`SELECT category_slug AS slug, COUNT(*) AS n FROM ${LAYOUT.from} p WHERE p.is_active = 1${andVis(v)} GROUP BY category_slug`).bind(...v.binds).all();
  const out = Object.fromEntries((r.results || []).filter(x => x.slug).map(x => [x.slug, Number(x.n)]));
  return Object.assign(out, await collectionCounts(db, view));
}

// The sitemaps list the products of the UK view only (lessons L107): never a product the page would hide.
// Product sitemap n holds the products with ids (n-1)*size+1 .. n*size, so it reads at most `size` rows whatever share of
// them is hidden (with LIMIT/OFFSET over the shown rows, the first sitemap of Construction Gear World walked 54,000 rows
// for 10,000, and sitemap n always walked every row before it). The index lists every id range up to the highest id,
// which is one row to read (the table's own key), not a count of every active product.
export async function sitemapMaxId(db) {
  const r = await db.prepare('SELECT MAX(id) AS m FROM products').first();
  return Number(r?.m || 0);
}

export async function sitemapChunk(db, n, size, view = null) {
  const v = vis(view);
  const r = await db
    .prepare(`SELECT id, product_name, product_slug, updated_at FROM ${LAYOUT.from} p WHERE p.id BETWEEN ? AND ? AND p.is_active = 1${andVis(v)} ORDER BY p.id LIMIT ?`)
    .bind((n - 1) * size + 1, n * size, ...v.binds, size)
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
