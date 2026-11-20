// bol.com Marketing Catalog API (https://api.bol.com/marketing/catalog/v1; lessons L154, L205): the pieces that both the
// PC download (tools/bol-feed.mjs, Node) and the private Worker gear-world-bol-refresh (src/bol-refresh.js) use. Plain
// JavaScript with no Node-only import (no fs, no Buffer), so the Worker bundle can import it.
//
// The rules of bol.com's terms and API (Manager 15 Nov 2026, chat 7's reading of the terms):
//  - ONE token per run, asked again only when it has run out, at most 3; no new try after 401/403/429 (L154: many
//    tokens block the address). The keys go only to login.bol.com, the token only to api.bol.com (or 127.0.0.1 in tests).
//  - Only the official API (no reading of bol.com pages: "spider websites ... worden niet toegelaten").
//  - No "was" price: the strikethrough price of the API stays out (Google Ads rules, L107).
//  - The link is the partner link of site ID 1559450 (bolLink).
// Reference (read 20 Nov 2026): https://api.bol.com/marketing/docs/api-reference/catalog-api-v1.html
//   GET /products/{ean}               country-code (required), include-offer/-image/-rating/-specifications; the EAN is
//                                     13 digits (^\d{13}$); 404 = unknown EAN, 406 = no content in that language
//   GET /products/lists/popular       country-code, category-id, page, page-size (at most 50), include-*
//   GET /products/search              search-term, country-code, the same paging
//   The header Accept-Language (nl, nl-NL, nl-BE, fr, fr-BE) is required. No rate limit is documented.

export const LOGIN_BASE = 'https://login.bol.com';
export const API_BASE = 'https://api.bol.com';
export const CATALOG = '/marketing/catalog/v1';
export const PAGE_SIZE = 50;          // the API's most for search and popular lists
export const MAX_PER_CATEGORY = 1000; // default: the 1,000 most popular products of a category (20 pages)
export const MAX_TOKENS = 3;
export const UA = 'GearWorld-bol-feed/1.0 (+https://gearworldgroup.com)';

// Only bol.com's own servers (or the tests' local server) get the keys and the token.
export function okBase(base, host) {
  try {
    const u = new URL(base);
    if (u.protocol === 'http:' && u.hostname === '127.0.0.1') return true;
    return u.protocol === 'https:' && u.hostname === host && (u.pathname === '/' || u.pathname === '');
  } catch { return false; }
}

export const clean = v => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

// base64 of the UTF-8 bytes (the same as Node's Buffer.from(s).toString('base64')), without Buffer.
export function base64Utf8(s) {
  let bin = '';
  for (const b of new TextEncoder().encode(String(s))) bin += String.fromCharCode(b);
  return btoa(bin);
}

// bol.com Partnerprogramma (site ID 1559450, gearworldhub.com, lessons L154): the product link of the partner programme,
// https://partner.bol.com/click/click?p=2&t=url&s=<site ID>&f=TXL&url=<bol.com page>&name=<product name>. Only a bol.com
// product page (https://www.bol.com/...) goes in it; anything else gives no link (the click would not pay).
export const BOL_SITE_ID = '1559450';
const BOL_PAGE = /^https:\/\/www\.bol\.com\//i;
const parse = u => { try { const x = new URL(String(u || '')); return /^https?:$/.test(x.protocol) ? x : null; } catch { return null; } };
export function bolLink(page, name = '', siteId = BOL_SITE_ID) {
  const x = parse(page);
  if (!x || !BOL_PAGE.test(x.href)) return '';
  const label = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `https://partner.bol.com/click/click?p=2&t=url&s=${encodeURIComponent(siteId)}&f=TXL&url=${encodeURIComponent(x.href)}` +
    (label ? `&name=${encodeURIComponent(label)}` : '');
}
export function isBolLink(u, siteId = BOL_SITE_ID) {
  const x = parse(u);
  return Boolean(x && x.protocol === 'https:' && x.hostname === 'partner.bol.com' && x.pathname === '/click/click' &&
    x.searchParams.get('s') === String(siteId) && BOL_PAGE.test(x.searchParams.get('url') || ''));
}

// An EAN/GTIN as bol.com's product endpoint wants it: 13 digits. GTIN-8 and GTIN-12 (UPC) get leading zeros, a GTIN-14
// with a leading zero loses it; anything else is not an EAN ('' = cannot be looked up).
export function ean13(v) {
  const d = String(v ?? '').trim();
  if (!/^\d+$/.test(d)) return '';
  if (d.length === 13) return d;
  if (d.length === 8 || d.length === 12) return d.padStart(13, '0');
  if (d.length === 14 && d[0] === '0') return d.slice(1);
  return '';
}

// The current offer price of an API product, or 0 when bol.com has no offer now (not for sale).
export function offerPrice(p) {
  const n = p && p.offer ? Number(p.offer.price) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

// The product of a /products/{ean} answer: the product itself (the documented shape), or wrapped in product/results.
export function productOf(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.ean !== undefined || body.offer !== undefined || body.title !== undefined) return body;
  if (body.product && typeof body.product === 'object') return body.product;
  if (Array.isArray(body.results) && body.results[0] && typeof body.results[0] === 'object') return body.results[0];
  return null;
}

// One API session: the token (once, renewed only when it has run out) and GET calls. Never follows a redirect.
// An error has .code: 3 keys refused, 4 token or call refused / no token, 6 too many requests or blocked (no new try);
// .tokenCap = true when the run already asked MAX_TOKENS tokens (a budget, not bol.com saying no).
export function session({ id, secret, loginBase = LOGIN_BASE, apiBase = API_BASE, fetchImpl = fetch, now = () => Date.now(), language = 'nl', userAgent = UA }) {
  const S = { tokens: 0, calls: 0, token: '', until: 0 };
  async function token() {
    if (S.token && now() < S.until) return S.token;
    if (S.tokens >= MAX_TOKENS) throw Object.assign(new Error(`${MAX_TOKENS} tokens asked in this run already: stopping, so bol.com does not block the address`), { code: 6, tokenCap: true });
    S.tokens++;
    const basic = base64Utf8(`${id}:${secret}`);
    const r = await fetchImpl(`${loginBase.replace(/\/$/, '')}/token?grant_type=client_credentials`, {
      method: 'POST', redirect: 'manual', body: '', headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent } });
    if (r.status === 401) throw Object.assign(new Error('bol.com refused the keys (401): run the keys step again with new keys'), { code: 3 });
    if (r.status === 403 || r.status === 429) throw Object.assign(new Error(`bol.com answered ${r.status} to the token (too many requests or blocked${r.headers.get('retry-after') ? `, again after ${r.headers.get('retry-after')} s` : ''}); no new try`), { code: 6 });
    if (r.status !== 200) throw Object.assign(new Error(`no token: HTTP ${r.status}`), { code: 4 });
    const j = await r.json().catch(() => ({}));
    if (!j.access_token) throw Object.assign(new Error('bol.com gave no token in the answer'), { code: 4 });
    const life = Number(j.expires_in) > 0 ? Number(j.expires_in) : 299;
    S.token = String(j.access_token);
    S.until = now() + Math.max(30, life - 30) * 1000;
    return S.token;
  }
  async function get(path, params) {
    const t = await token();
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    S.calls++;
    const r = await fetchImpl(`${apiBase.replace(/\/$/, '')}${CATALOG}${path}?${q}`, {
      redirect: 'manual', headers: { Authorization: `Bearer ${t}`, Accept: 'application/json', 'Accept-Language': language, 'User-Agent': userAgent } });
    if (r.status === 401) throw Object.assign(new Error('api.bol.com refused the token (401); no new token asked'), { code: 4 });
    if (r.status === 429) throw Object.assign(new Error(`api.bol.com answered 429 (too many requests${r.headers.get('retry-after') ? `, again after ${r.headers.get('retry-after')} s` : ''}); stopping, no new try`), { code: 6 });
    if (r.status === 404) return { status: 404, body: null };
    if (r.status !== 200) {
      const e = await r.json().catch(() => ({}));
      return { status: r.status, body: null, why: clean(e.detail || e.title || '') };
    }
    return { status: 200, body: await r.json() };
  }
  return { token, get, stats: S };
}

// The categories bol.com shows for a popular list without a category: top level and their subcategories.
export function categoryTree(body) {
  const walk = (list, depth) => (Array.isArray(list) ? list : []).map(c => ({
    id: String(c.categoryId ?? ''), name: clean(c.categoryName), count: Number(c.productCount) || 0,
    sub: depth < 2 ? walk(c.subcategories, depth + 1) : []
  })).filter(c => c.id);
  return walk(body && body.allRelevantCategories, 1);
}

// The Awin column names of the feed file (tools/cj-feed.mjs COLUMNS, lessons L86) are added by tools/bol-feed.mjs; this
// is the row itself. One API product -> one feed row. null = left out, with the reason in .why of the returned object.
export function rowOf(p, { country = 'NL', categoryId = '', categoryName = '', stamp = new Date().toISOString() } = {}) {
  const ean = String(p && p.ean || '').trim();
  const price = p && p.offer && Number(p.offer.price);
  if (!ean) return { why: 'no EAN' };
  if (!(price > 0)) return { why: 'no offer (not for sale now)' };
  const page = String(p.url || '').trim();
  const link = bolLink(page, p.title);
  if (!link) return { why: 'no bol.com product page' };
  const img = p.image && p.image.url && /^https:\/\//i.test(p.image.url) ? String(p.image.url) : '';
  const gpc = (Array.isArray(p.gpc) ? p.gpc : []).slice().sort((a, b) => (a.level || 0) - (b.level || 0)).map(g => clean(g.name)).filter(Boolean);
  // No "before" price on purpose: bol's offer.strikethroughPrice is bol's own "van" (was) price, not the maker's RRP, and
  // the sites print the before price as "RRP £X" (src/pages/layout.js rrpTag): a was price shown as an RRP is a claim we
  // cannot back (lessons L107). No brand either: the list and search endpoints give none; only /products/{ean} with
  // include-specifications has one, one call per product (lessons L178).
  return { row: {
    data_feed_id: `bol-${country}`, merchant_id: 'bol.com', merchant_name: 'bol.com', aw_product_id: ean, aw_deep_link: link,
    brand_name: '', merchant_product_id: String(p.bolProductId || ''), merchant_category: categoryName, category_name: gpc.join(' > '),
    ean, mpn: '', product_name: clean(p.title), description: clean(p.description).slice(0, 2000), merchant_deep_link: page,
    merchant_image_url: img, large_image: img, search_price: price.toFixed(2), store_price: price.toFixed(2), rrp_price: '',
    currency: 'EUR', in_stock: '1', stock_status: clean(p.offer.deliveryDescription), parent_product_id: '', last_updated: stamp,
    language: 'nl', bol_category_id: String(categoryId), bol_rating: p.rating ?? '', bol_gpc: gpc.join(' > ')
  } };
}

// The jobs of a download, in the order given (highest commission first): category ids, then searches.
// A category is '<id>' or '<id>=<name>' (the name from the categories step, used when the API gives none).
export function jobsOf({ categories = [], searches = [], searchCategory = '', country = 'NL' }) {
  const jobs = [];
  for (const c of categories) {
    const m = String(c).match(/^\s*(\d{1,12})\s*(?:=\s*(.{1,60}?))?\s*$/);
    if (m && !jobs.some(j => j.categoryId === m[1])) jobs.push({ kind: 'category', categoryId: m[1], label: clean(m[2] || ''), file: `BOL_${m[1]}_${country}` });
  }
  for (const term of searches) jobs.push({ kind: 'search', term, categoryId: String(searchCategory || ''), file: `BOL_${searchCategory || 0}_${country}-${slug(term)}` });
  return jobs;
}

// The API call of one page of a job (the same for the PC download and the Worker).
export function pageRequest(job, page, { country = 'NL', pageSize = PAGE_SIZE, image = true, rating = true, categories = true } = {}) {
  const params = { 'country-code': country, page, 'page-size': pageSize };
  if (image) params['include-image'] = 'true';
  params['include-offer'] = 'true';
  if (rating) params['include-rating'] = 'true';
  if (job.categoryId && job.categoryId !== '0') params['category-id'] = job.categoryId;
  if (categories && page === 1 && job.kind === 'category') params['include-relevant-categories'] = 'true';
  if (job.kind === 'search') return { path: '/products/search', params: { 'search-term': job.term, ...params } };
  return { path: '/products/lists/popular', params };
}

// The end of a list is the last page bol.com names (or an empty page). A short page is not the end when bol.com says
// there are more pages: the first download (17 Nov 2026) stopped "Auto & Motor" after page 1 (47 of 50) and "Damesmode"
// after page 16 that way. Without totalPages a short page still ends the list.
export function lastPage(body, page, listLength, pageSize = PAGE_SIZE) {
  if (!listLength) return true;
  const totalPages = Number(body && body.totalPages) || 0;
  return totalPages ? page >= totalPages : listLength < pageSize;
}
