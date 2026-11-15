#!/usr/bin/env node
// CJ Affiliate product catalogues for the Gear World sites (31 Oct 2026, lessons L86).
// Reads the products of CJ advertisers that accepted us (e.g. XPLORA UK, advertiser 5175167) through the CJ product
// search API (GraphQL, https://ads.api.cj.com/query, personal access token) and writes them as a feed file in the SAME
// column names as an Awin feed (product_name, merchant_deep_link, search_price, ...), so the import tools read it like
// any other feed. The CJ tracking link of each product (the link that earns the commission) goes in aw_deep_link.
//
//   probe:    READ-ONLY. Which CJ account id works, which fields the API offers, the joined feeds, how many products
//             each chosen advertiser has, and 5 sample products. Writes nothing but the JSON summary on stdout.
//   download: writes <out>/CJ_<advertiser>.csv.gz.part for each advertiser (the PowerShell tool checks it, keeps the
//             old copy and only then swaps it in, after the approval phrase).
//
// The token comes ONLY from the environment variable GW_CJ_TOKEN (set by tools/cj-feed-download.ps1 for this one
// process). It is never printed: every message goes through mask().
// Nothing here writes to stderr: in Windows PowerShell 5.1 with ErrorActionPreference Stop, a stderr line stops the tool.
//
// Usage: node tools/cj-feed.mjs --mode probe|download --cid 7806395,8114224 --pid 101917444 --advertisers 5175167 [--out <dir>] [--search <name>]
//
// --search (15 Nov 2026, lessons L161): instead of the whole catalogue, only the products that CJ's keyword search finds
// for one of the SEARCHES below (e.g. DHgate's 6 million products: only kids' winter boots), in the search's currency.
// The file is then CJ_<advertiser>_<search>.csv.gz, so it never takes the place of a whole-catalogue file.
import { createWriteStream, mkdirSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CJ_API = 'https://ads.api.cj.com/query';
export const PAGE = 1000;           // CJ gives at most 1,000 products per request
export const MAX_PRODUCTS = 50000;  // a sane ceiling for one advertiser
export const FEED_PAGE = 500;      // feeds per request of the feed list (first run: exactly 500 came back)
export const FEED_MAX_PAGES = 200; // most pages of the feed list (100,000 feeds); CJ's totalCount usually stops it sooner
// CJ answers "Cannot page past 10,000 records. The limit and offset parameters may not add up to be greater than 10,000"
// (13 Nov 2026: Jeulia 21,905, Haglofs 72,031 and Dream Pairs 58,629 products stopped there, lessons L129). Every search
// has its own 10,000, so a bigger catalogue is read in price bands (lowPrice/highPrice), each one under the cap.
export const OFFSET_CAP = 10000;
export const PRICE_TOP = 100000000;  // the top of the first price band (covers yen and won prices too)
const MAX_COUNT_CALLS = 3000;        // most band-size questions for one shop (a safety stop)
// CJ's pages are not stable: the same search asked with offset 0, 1000, 2000 ... gives some products twice and others
// never (third download of 13 Nov 2026: Diecast 8,975 rows but 7,248 different products, Kärcher 1,044 rows / 1,016;
// Jeulia gave 18,437 and then 18,124). So every search is made small enough to come back in ONE page (offset 0), by
// price bands, and offsets are used only where that is impossible (no price filter, or more than a page at one price).
export const RETRY_WAIT_MS = 60000;  // a "too many requests" answer: wait, then ask again (at most 3 times)

// Keyword searches (15 Nov 2026, lessons L161). Each keyword is ONE CJ search (its own 10,000 cap and price bands); the
// products of all of them go in one file, each product once. currency: only products priced in it (the Manager's rule for
// the UK view: a real pound price, not a converted one). A keyword that finds more than SEARCH_MAX products is too broad
// (CJ may read the words as "any of them"): it is left out and the report says so.
export const SEARCH_MAX = 20000;
// A whole-catalogue download of a bigger shop is refused (DHgate has 6 million products): only a search can read it.
export const WHOLE_MAX = 300000;
export const SEARCHES = {
  'kids-winter-boots': {
    label: "kids' winter boots",
    currency: 'GBP',
    area: 'GB',
    // CJ reads the words of one keyword as ANY of them, and ignores "+" and quotes (second DHgate look, 15 Nov 2026:
    // "kids snow boots" = "+kids +snow +boots" = "\"kids snow boots\"" = 70,394 in pounds). So each keyword is ONE
    // narrow word; the import rules then keep only children's winter boots.
    keywords: ['snow', 'snowboots', 'wellies', 'wellington', 'winter', 'plush', 'fur', 'fleece', 'thermal', 'waterproof'],
    // Tried in this order with each keyword; the first that finds something under SEARCH_MAX is used. Google's product
    // category 187 is "Apparel & Accessories > Shoes".
    narrow: [
      { label: 'Shoes (Google 187)', googleProductCategoryIds: '187' },
      { label: 'Shoes (Google name)', googleProductCategoryNames: 'Apparel & Accessories > Shoes' },
      { label: 'every category' }
    ]
  }
};
// More fields for a search: where the product is sold and sent from, and for whom (the import rules check them).
export const SEARCH_WANT = ['targetCountry', 'serviceableAreas', 'shipsFromCountry', 'ageGroup', 'gender'];
export const SEARCH_COLUMNS = ['target_country', 'serviceable_areas', 'ships_from', 'age_group', 'gender', 'search_keyword'];
// A text argument of the product search (keywords, currency, serviceableAreas), safely quoted.
const textArg = v => JSON.stringify(String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 200));

// The columns the import tools read (same names as tools/awin-feed-download.ps1 asks Awin for).
export const COLUMNS = ['data_feed_id', 'merchant_id', 'merchant_name', 'aw_product_id', 'aw_deep_link', 'brand_name', 'merchant_product_id',
  'merchant_category', 'category_name', 'ean', 'mpn', 'product_name', 'description', 'merchant_deep_link', 'merchant_image_url', 'large_image',
  'search_price', 'store_price', 'rrp_price', 'currency', 'in_stock', 'stock_status', 'parent_product_id', 'last_updated'];

// Hosts of CJ tracking links (click and deep links). A product link elsewhere earns no commission.
export const CJ_LINK_HOSTS = /(^|\.)(anrdoezrs\.net|dpbolvw\.net|jdoqocy\.com|kqzyfj\.com|tkqlhce\.com|emjcd\.com|qksrv\.net|ftjcfx\.com|lduhtrp\.net|awltovhc\.com|tqlkg\.com|apmebf\.com|afcyhf\.com|lqdhgjs\.com|yceml\.net|mjbpab\.com)$/i;

export function isCjLink(u) {
  try { const x = new URL(String(u || '')); return (x.protocol === 'https:' || x.protocol === 'http:') && CJ_LINK_HOSTS.test(x.hostname); } catch { return false; }
}

export function makeMask(secret) {
  return s => {
    let t = String(s ?? '');
    if (secret && secret.length >= 6) t = t.split(secret).join('***');
    return t.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1***');
  };
}

// One GraphQL call. Returns { status, data, errors } and never throws for an HTTP or GraphQL error.
export async function gql({ query, token, api = CJ_API, fetchImpl = fetch }) {
  let res;
  try {
    res = await fetchImpl(api, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'user-agent': 'gear-world-cj-feed/1' },
      body: JSON.stringify({ query }) });
  } catch (e) { return { status: 0, data: null, errors: [{ message: `network: ${e && e.message ? e.message : e}` }] }; }
  let body = null;
  const text = await res.text();
  try { body = JSON.parse(text); } catch { body = null; }
  if (!body) return { status: res.status, data: null, errors: [{ message: `HTTP ${res.status}: ${text.slice(0, 300)}` }] };
  const errors = Array.isArray(body.errors) && body.errors.length ? body.errors : (res.status >= 400 ? [{ message: `HTTP ${res.status}` }] : null);
  return { status: res.status, data: body.data || null, errors };
}

const errText = errors => (errors || []).map(e => String(e && e.message ? e.message : e)).join(' | ').slice(0, 500);
const named = t => { let x = t; while (x && !x.name && x.ofType) x = x.ofType; return x || {}; };
const isList = t => { let x = t; while (x) { if (x.kind === 'LIST') return true; x = x.ofType; } return false; };
const TYPE_REF = 'name kind ofType { name kind ofType { name kind ofType { name kind } } }';

// The API describes itself (GraphQL introspection). With it the tool asks only for fields that exist, so a renamed or
// missing field gives a clear report line instead of a failed download. Without it, a fixed field list is used.
export async function describe({ token, api, fetchImpl }) {
  const root = await gql({ token, api, fetchImpl, query: `{ __schema { queryType { fields { name args { name type { ${TYPE_REF} } } type { ${TYPE_REF} } } } } }` });
  if (root.errors || !root.data || !root.data.__schema) return { ok: false, error: errText(root.errors) || 'no schema' };
  const queries = root.data.__schema.queryType.fields;
  const cache = new Map();
  const typeFields = async name => {
    if (!name) return [];
    if (cache.has(name)) return cache.get(name);
    const r = await gql({ token, api, fetchImpl, query: `{ __type(name: "${name.replace(/[^A-Za-z0-9_]/g, '')}") { fields { name args { name } type { ${TYPE_REF} } } } }` });
    const f = (r.data && r.data.__type && r.data.__type.fields) || [];
    cache.set(name, f);
    return f;
  };
  const shape = async qname => {
    const q = queries.find(x => x.name === qname);
    if (!q) return null;
    const outer = await typeFields(named(q.type).name);
    const list = outer.find(f => f.name === 'resultList');
    const item = list ? named(list.type).name : '';
    const fields = await typeFields(item);
    const sub = {};
    for (const f of fields) { const t = named(f.type); if (t.kind === 'OBJECT' || t.kind === 'INTERFACE') sub[f.name] = (await typeFields(t.name)).map(x => x.name); }
    return { args: q.args.map(a => a.name), argTypes: Object.fromEntries(q.args.map(a => [a.name, named(a.type).name || ''])), outer: outer.map(f => f.name), item, fields: fields.map(f => ({ name: f.name, args: (f.args || []).map(a => a.name), object: Boolean(sub[f.name]), list: isList(f.type) })), sub };
  };
  return { ok: true, queries: queries.map(q => q.name), shoppingProducts: await shape('shoppingProducts'), products: await shape('products'), shoppingProductFeeds: await shape('shoppingProductFeeds') };
}

const FALLBACK_PRODUCT = {
  args: ['companyId', 'partnerIds', 'limit', 'offset'], outer: ['totalCount', 'count', 'resultList'],
  fields: ['id', 'title', 'description', 'brand', 'link', 'imageLink', 'availability', 'gtin', 'mpn', 'advertiserId', 'advertiserName', 'productType', 'itemGroupId', 'lastUpdated']
    .map(name => ({ name, args: [], object: false, list: name === 'productType' }))
    .concat([{ name: 'price', args: [], object: true }, { name: 'salePrice', args: [], object: true }, { name: 'googleProductCategory', args: [], object: true },
      { name: 'linkCode', args: ['pid'], object: true }]),
  sub: { price: ['amount', 'currency'], salePrice: ['amount', 'currency'], googleProductCategory: ['id', 'name'], linkCode: ['clickUrl'] }
};
const WANT = ['id', 'adId', 'catalogId', 'title', 'description', 'brand', 'link', 'imageLink', 'additionalImageLink', 'availability', 'gtin', 'mpn', 'advertiserId', 'advertiserName',
  'productType', 'itemGroupId', 'lastUpdated', 'price', 'salePrice', 'googleProductCategory', 'linkCode'];
const SUB_WANT = { price: ['amount', 'currency'], salePrice: ['amount', 'currency'], googleProductCategory: ['name'], linkCode: ['clickUrl'], imageLink: ['url', 'link'], additionalImageLink: ['url', 'link'] };

// A price for a filter argument: a number, or a quoted text when the API declares the argument as text (String/ID).
export function priceLiteral(v, type = '') {
  const n = String(Math.round(Number(v) * 1000) / 1000);
  return /^(String|ID)$/.test(String(type || '')) ? `"${n}"` : n;
}

// The product query, built from the fields the API really has. pid: the CJ property (website) id for the tracking links.
// extra: { lowPrice, highPrice } for one price band (only when the API has those arguments).
// extra may also hold keywords, currency and serviceableAreas (a keyword search, L161); more: extra fields to select.
export function productQuery({ shape, cid, pid, advertiser, limit = PAGE, offset = 0, extra = null, more = [] }) {
  const s = shape || FALLBACK_PRODUCT;
  const qname = s.qname || 'shoppingProducts';
  const args = [`companyId: "${String(cid).replace(/\D/g, '')}"`];
  if (s.args.includes('partnerIds')) args.push(`partnerIds: ["${String(advertiser).replace(/\D/g, '')}"]`);
  if (s.args.includes('limit')) args.push(`limit: ${limit}`);
  if (s.args.includes('offset')) args.push(`offset: ${offset}`);
  for (const k of ['lowPrice', 'highPrice']) {
    if (extra && extra[k] !== undefined && extra[k] !== null && s.args.includes(k)) args.push(`${k}: ${priceLiteral(extra[k], (s.argTypes || {})[k])}`);
  }
  for (const k of ['keywords', 'currency', 'serviceableAreas', 'googleProductCategoryIds', 'googleProductCategoryNames']) {
    if (extra && extra[k] && s.args.includes(k)) args.push(`${k}: ${textArg(extra[k])}`);
  }
  const sel = [];
  for (const name of WANT.concat((more || []).filter(x => !WANT.includes(x)))) {
    const f = s.fields.find(x => x.name === name);
    if (!f) continue;
    if (name === 'linkCode') { if (pid && f.args.includes('pid')) sel.push(`linkCode(pid: "${String(pid).replace(/\D/g, '')}") { clickUrl }`); continue; }
    if (f.object) {
      const have = (s.sub && s.sub[name]) || [];
      const pick = (SUB_WANT[name] || []).filter(x => have.includes(x));
      if (pick.length) sel.push(`${name} { ${pick.join(' ')} }`);
      continue;
    }
    sel.push(name);
  }
  const outer = ['totalCount', 'count'].filter(x => s.outer.includes(x));
  return `{ ${qname}(${args.join(', ')}) { ${outer.join(' ')} resultList { ${sel.join(' ')} } } }`;
}

const money = m => { if (m === null || m === undefined) return NaN; if (typeof m === 'object') return Number(m.amount); return Number(m); };
const cur = (...ms) => { for (const m of ms) if (m && typeof m === 'object' && m.currency) return String(m.currency).toUpperCase(); return ''; };
const img = v => { if (!v) return ''; if (Array.isArray(v)) return img(v[0]); if (typeof v === 'object') return String(v.url || v.link || ''); return String(v); };
const flat = v => Array.isArray(v) ? v.filter(Boolean).join(' > ') : String(v ?? '');
const words = v => Array.isArray(v) ? v.map(x => (x && typeof x === 'object' ? Object.values(x).join(':') : String(x ?? ''))).filter(Boolean).join(' ') : (v && typeof v === 'object' ? Object.values(v).join(':') : String(v ?? ''));

// One CJ product as one feed row (Awin column names). The sale price wins when it is lower than the normal price.
export function toFeedRow(p) {
  const price = money(p.price);
  const sale = money(p.salePrice);
  const search = Number.isFinite(sale) && sale > 0 && (!Number.isFinite(price) || sale < price) ? sale : price;
  const av = String(p.availability || '').trim().toLowerCase().replace(/_/g, ' ');
  const inStock = /^in ?stock$|^preorder$|^pre-order$|^backorder$/.test(av) ? '1' : (/out ?of ?stock|discontinued/.test(av) ? '0' : '');
  const click = p.linkCode && p.linkCode.clickUrl ? String(p.linkCode.clickUrl) : '';
  const gpc = p.googleProductCategory && p.googleProductCategory.name ? String(p.googleProductCategory.name) : '';
  return {
    data_feed_id: 'cj', merchant_id: String(p.advertiserId ?? ''), merchant_name: String(p.advertiserName ?? ''), aw_product_id: String(p.id ?? ''),
    aw_deep_link: isCjLink(click) ? click : '', brand_name: String(p.brand ?? ''), merchant_product_id: String(p.id ?? ''),
    merchant_category: flat(p.productType) || gpc, category_name: gpc, ean: String(p.gtin ?? ''), mpn: String(p.mpn ?? ''),
    product_name: String(p.title ?? ''), description: String(p.description ?? '').slice(0, 2000), merchant_deep_link: String(p.link ?? ''),
    merchant_image_url: img(p.imageLink), large_image: img(p.additionalImageLink),
    search_price: Number.isFinite(search) ? String(search) : '', store_price: Number.isFinite(price) ? String(price) : '', rrp_price: Number.isFinite(price) ? String(price) : '',
    currency: cur(p.salePrice, p.price), in_stock: inStock, stock_status: av, parent_product_id: String(p.itemGroupId ?? ''), last_updated: String(p.lastUpdated ?? ''),
    target_country: words(p.targetCountry), serviceable_areas: words(p.serviceableAreas), ships_from: words(p.shipsFromCountry), age_group: words(p.ageGroup),
    gender: words(p.gender), search_keyword: String(p._keyword ?? '')
  };
}

export const csvLine = vals => vals.map(v => `"${String(v ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`).join(',') + '\n';

// Which CJ account id (CID) the token accepts: the first candidate whose product query has no error.
async function pickCid({ cids, token, api, fetchImpl, shape, pid, advertiser }) {
  const tried = [];
  for (const cid of cids) {
    const r = await gql({ token, api, fetchImpl, query: productQuery({ shape, cid, pid, advertiser, limit: 1 }) });
    if (!r.errors && r.data) return { cid, tried };
    tried.push({ cid, error: errText(r.errors) });
  }
  return { cid: '', tried };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Where a price band is cut in two: never on a real price (prices have 2 decimals, the cut is at x.xx5), so it does not
// matter whether CJ counts the band edges in or out. Wide bands are cut in the middle of their range of magnitudes.
export function splitPoint(lo, hi) {
  const base = Math.max(lo, 1);
  let m = hi / base > 8 ? Math.sqrt(base * hi) : (lo + hi) / 2;
  m = Math.floor(m * 100) / 100 + 0.005;
  if (!(m > lo && m < hi)) m = (lo + hi) / 2;
  return Math.round(m * 1000) / 1000;
}

// Every product of one advertiser, page by page; above 10,000 products in price bands (lessons L129).
// Returns { ok, products, total, capped, bands, split, error }. capped: CJ's cap still cut something (the file then
// holds what came, and the report says how many are missing).
// filters: the same keyword/currency filters on every request of this search (L161); more: extra fields; maxTotal: a search
// that finds more products is not read at all (tooBroad).
export async function fetchAll({ shape, cid, pid, advertiser, token, api, fetchImpl, pauseMs = 1000, log = () => {}, page = PAGE, cap = OFFSET_CAP, retryWaitMs = RETRY_WAIT_MS,
  filters = null, more = [], maxTotal = Infinity }) {
  const qname = (shape && shape.qname) || 'shoppingProducts';
  // One row per product AND catalogue: a shop with a catalogue per country (Haglofs: the same product id in the GB, NL,
  // DE ... catalogues, in pounds and euros) keeps every country, so the rules can pick the one in the site's currency.
  // Only the very same row (same id, catalogue and currency, e.g. at a band edge) is kept once (13 Nov 2026, L129).
  const seen = new Map();
  let extraRows = 0;
  const keyOf = p => (p && p.id !== undefined && p.id !== null && p.id !== ''
    ? [p.id, p.adId ?? p.catalogId ?? '', cur(p.salePrice, p.price)].map(x => String(x ?? '')).join('|') : `#${seen.size + ++extraRows}`);
  const add = list => { for (const p of list) { const k = keyOf(p); if (!seen.has(k)) seen.set(k, p); } };
  const products = () => [...seen.values()];
  const pause = async () => { if (pauseMs) await sleep(pauseMs); };
  const ask = async (limit, offset, extra) => {
    let r;
    for (let attempt = 1; ; attempt++) {
      r = await gql({ token, api, fetchImpl, query: productQuery({ shape, cid, pid, advertiser, limit, offset, extra: { ...(filters || {}), ...(extra || {}) }, more }) });
      const busy = r.status === 429 || /too many requests|rate limit/i.test(errText(r.errors));
      if (!busy || attempt > 3) break;
      log(`${advertiser}: CJ is busy, waiting ${Math.round(retryWaitMs * attempt / 1000)} s`);
      if (retryWaitMs) await sleep(retryWaitMs * attempt);
    }
    if (r.errors || !r.data || !r.data[qname]) return { ok: false, error: errText(r.errors) || 'empty answer' };
    const block = r.data[qname];
    const t = block.totalCount === null || block.totalCount === undefined || block.totalCount === '' ? NaN : Number(block.totalCount);
    return { ok: true, total: Number.isFinite(t) ? t : null, list: Array.isArray(block.resultList) ? block.resultList : [] };
  };
  // One search (all products, or one price band), up to CJ's cap.
  const pages = async (extra, label) => {
    let total = null;
    let n = 0;
    for (let offset = 0; offset < Math.min(cap, MAX_PRODUCTS); offset += page) {
      const limit = Math.min(page, cap - offset);
      const r = await ask(limit, offset, extra);
      if (!r.ok) return r;
      if (total === null) total = r.total;
      add(r.list);
      n += r.list.length;
      log(`${advertiser}${label}: ${n}${total !== null ? ` / ${total}` : ''}`);
      if (r.list.length < limit || (total !== null && n >= total)) return { ok: true, total, n, cut: false };
      await pause();
    }
    return { ok: true, total, n, cut: total === null || n < total };
  };
  const first = await ask(1, 0, null);
  if (!first.ok) return { ok: false, products: [], total: null, error: first.error };
  const total = first.total;
  if (total !== null && total > maxTotal) return { ok: false, tooBroad: true, products: [], total, error: `too broad: ${total} products` };
  const canSplit = Boolean(shape && ['lowPrice', 'highPrice'].every(a => (shape.args || []).includes(a)));
  if (total === null || total <= page || !canSplit) {
    await pause();
    const r = await pages(null, '');
    if (!r.ok) return { ok: false, products: products(), total, error: r.error };
    const capped = Boolean((r.cut || total !== null) && seen.size < (total ?? r.total ?? 0));
    return { ok: true, products: products(), total: total ?? r.total, capped, bands: 1, split: total !== null && total > page ? 'none' : '' };
  }
  // Price bands: [lo, hi] is cut in two until each band fits in one page (offset 0 only, see above).
  const stack = [[0, PRICE_TOP]];
  let bands = 0;
  let calls = 0;
  let capped = false;
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (++calls > MAX_COUNT_CALLS) { capped = true; break; }
    await pause();
    const c = await ask(1, 0, { lowPrice: lo, highPrice: hi });
    if (!c.ok) return { ok: false, products: products(), total, error: c.error };
    if (c.total === 0) continue;
    if (c.total !== null && c.total > page && hi - lo >= 0.02) { const m = splitPoint(lo, hi); stack.push([m, hi], [lo, m]); continue; }
    await pause();
    const r = await pages({ lowPrice: lo, highPrice: hi }, ` (${lo}-${hi})`);
    if (!r.ok) return { ok: false, products: products(), total, error: r.error };
    bands++;
    if (r.cut) capped = true;
  }
  if (seen.size < total) capped = true;
  return { ok: true, products: products(), total, capped, bands, split: 'price' };
}

export async function writeFeed(file, products, columns = COLUMNS) {
  await new Promise((resolve, reject) => {
    const gz = createGzip();
    const ws = createWriteStream(file);
    gz.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
    gz.write(csvLine(columns));
    for (const p of products) { const row = toFeedRow(p); gz.write(csvLine(columns.map(c => row[c]))); }
    gz.end();
  });
}

// The whole run. Returns a summary object (printed as JSON by the command line).
// The advertisers that accepted us (13 Nov 2026, lessons L128): CJ's Advertiser Lookup API with the same token. The feed
// list stops at 10,000 of CJ's 16,617 feeds, so five of the fourteen shops that accepted us that day were not in it.
export const LOOKUP_API = 'https://advertiser-lookup.api.cj.com/v2/advertiser-lookup';
const xmlTag = (s, t) => { const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`, 'i').exec(s); return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim() : ''; };
export function parseLookup(xml) {
  const text = String(xml || '');
  const head = /<advertisers\s([^>]*)>/i.exec(text);
  const attr = n => { const m = head && new RegExp(`${n}="(\\d+)"`).exec(head[1]); return m ? Number(m[1]) : null; };
  const advertisers = [];
  for (const m of text.matchAll(/<advertiser>([\s\S]*?)<\/advertiser>/gi)) {
    const b = m[1];
    advertisers.push({ id: xmlTag(b, 'advertiser-id'), name: xmlTag(b, 'advertiser-name'), relationship: xmlTag(b, 'relationship-status'),
      status: xmlTag(b, 'account-status'), category: [xmlTag(b, 'parent'), xmlTag(b, 'child')].filter(Boolean).join(' > '), url: xmlTag(b, 'program-url') });
  }
  return { total: attr('total-matched'), returned: attr('records-returned'), page: attr('page-number'), advertisers };
}
export async function joinedAdvertisers({ token, cids, lookupApi = LOOKUP_API, fetchImpl = fetch, pauseMs = 1000 }) {
  const tried = [];
  for (const cid of cids) {
    const all = [];
    let ok = true;
    for (let page = 1; page <= 50; page++) {
      const u = `${lookupApi}?requestor-cid=${encodeURIComponent(cid)}&advertiser-ids=joined&records-per-page=100&page-number=${page}`;
      let res;
      try { res = await fetchImpl(u, { headers: { authorization: `Bearer ${token}` } }); } catch (e) { tried.push({ cid, error: String(e && e.message || e) }); ok = false; break; }
      const text = await res.text();
      if (res.status !== 200) { tried.push({ cid, error: `HTTP ${res.status}: ${text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)}` }); ok = false; break; }
      const r = parseLookup(text);
      all.push(...r.advertisers);
      if (!r.advertisers.length || r.advertisers.length < 100 || (r.total !== null && all.length >= r.total)) break;
      if (pauseMs) await sleep(pauseMs);
    }
    if (ok) return { cid, tried, advertisers: all.filter(a => /^\d{3,12}$/.test(a.id) && (!a.relationship || /^joined$/i.test(a.relationship))) };
  }
  return { cid: '', tried, advertisers: [] };
}

// One advertiser, one search (L161). probe: for each keyword how many products CJ finds in any currency, in the search's
// currency in each keyword form, which form is used, and 5 samples. download: every product of every keyword (in its
// form) in the search's currency, each once, in CJ_<advertiser>_<search>.csv.gz.part.
async function searchOne({ A, SR, S, shape, pid, adv, token, api, fetchImpl, pauseMs, out, mode, mask, searchMax }) {
  const qname = (shape && shape.qname) || 'shoppingProducts';
  const count = async extra => {
    const r = await gql({ token, api, fetchImpl, query: productQuery({ shape, cid: S.cid, pid, advertiser: adv, limit: 1, extra }) });
    if (pauseMs) await sleep(pauseMs);
    if (r.errors || !r.data || !r.data[qname]) return { error: mask(errText(r.errors) || 'empty answer') };
    const t = Number(r.data[qname].totalCount);
    return { total: Number.isFinite(t) ? t : null };
  };
  const cur = SR.currency || '';
  const areaArg = SR.area && shape.args.includes('serviceableAreas') ? SR.area : '';
  // The narrowing of one keyword (SR.narrow, in order; only filters the API has): { tries: [{label, total}], chosen, filters, total }.
  const narrow = (SR.narrow && SR.narrow.length ? SR.narrow : [{ label: 'every category' }])
    .filter(n => Object.keys(n).filter(k => k !== 'label').every(k => shape.args.includes(k)));
  const choose = async kw => {
    const tries = [];
    let chosen = null;
    for (const n of narrow) {
      const { label, ...extra } = n;
      const filters = { keywords: kw, currency: cur, ...extra };
      const c = await count(filters);
      if (c.error) return { error: c.error };
      tries.push({ label, total: c.total });
      if (!chosen && c.total && c.total <= searchMax) chosen = { label, filters, total: c.total };
    }
    return { tries, chosen: chosen ? chosen.label : '', filters: chosen ? chosen.filters : null, total: chosen ? chosen.total : 0 };
  };
  A.searches = [];
  if (mode === 'probe') {
    let sampleExtra = null;
    let anyExtra = null;
    for (const kw of SR.keywords) {
      const all = await count({ keywords: kw });
      if (all.error) { A.error = all.error; return; }
      const ch = await choose(kw);
      if (ch.error) { A.error = ch.error; return; }
      const inArea = areaArg && ch.filters ? await count({ ...ch.filters, serviceableAreas: areaArg }) : { total: null };
      const last = ch.tries[ch.tries.length - 1];
      A.searches.push({ keyword: kw, all: all.total, inCurrency: last ? last.total : null, tries: ch.tries, form: ch.chosen, used: ch.total,
        inArea: inArea.error ? null : inArea.total, tooBroad: !ch.chosen && ch.tries.some(t => (t.total || 0) > 0) });
      if (!sampleExtra && ch.filters) sampleExtra = ch.filters;
      if (!anyExtra) { const t = ch.tries.find(x => x.total); if (t) { const { label, ...extra } = narrow.find(n => n.label === t.label); anyExtra = { keywords: kw, currency: cur, ...extra }; } }
    }
    A.total = A.searches.reduce((n, x) => n + (x.used || 0), 0);
    const ex = sampleExtra || anyExtra;
    if (ex) {
      const r = await gql({ token, api, fetchImpl, query: productQuery({ shape, cid: S.cid, pid, advertiser: adv, limit: 20, extra: ex, more: SEARCH_WANT }) });
      const list = (r.data && r.data[qname] && r.data[qname].resultList) || [];
      A.sampleQuery = Object.entries(ex).map(([k, v]) => `${k}=${v}`).join(' | ');
      A.samples = list.map(toFeedRow).map(x => ({ name: x.product_name, brand: x.brand_name, price: x.search_price, currency: x.currency, stock: x.stock_status,
        category: x.merchant_category, gpc: x.category_name, page: x.merchant_deep_link, image: x.merchant_image_url ? 'yes' : 'no', tracking: x.aw_deep_link ? new URL(x.aw_deep_link).host : 'NONE',
        group: x.parent_product_id, target: x.target_country, areas: x.serviceable_areas, shipsFrom: x.ships_from, age: x.age_group, keyword: ex.keywords }));
    } else A.samples = [];
    A.ok = true;
    return;
  }
  const seen = new Map();
  let failed = '';
  for (const kw of SR.keywords) {
    const ch = await choose(kw);
    if (ch.error) { failed = ch.error; break; }
    if (!ch.filters) { const big = Math.max(0, ...ch.tries.map(t => t.total || 0)); A.searches.push({ keyword: kw, form: '', total: big, got: 0, added: 0, tooBroad: big > 0, capped: false, error: '' }); continue; }
    const r = await fetchAll({ shape, cid: S.cid, pid, advertiser: adv, token, api, fetchImpl, pauseMs, filters: ch.filters, more: SEARCH_WANT, maxTotal: searchMax });
    let added = 0;
    for (const p of r.products) {
      const k = [p.id ?? '', p.adId ?? p.catalogId ?? '', JSON.stringify(p.price || '')].map(String).join('|');
      if (!seen.has(k)) { seen.set(k, { ...p, _keyword: kw }); added++; }
    }
    A.searches.push({ keyword: kw, form: ch.chosen, total: r.total, got: r.products.length, added, capped: Boolean(r.capped), tooBroad: Boolean(r.tooBroad), error: r.ok || r.tooBroad ? '' : mask(r.error) });
    if (!r.ok && !r.tooBroad) { failed = mask(r.error); break; }
  }
  const products = [...seen.values()];
  A.total = A.searches.reduce((n, x) => n + (x.tooBroad ? 0 : (x.total || 0)), 0);
  A.got = products.length;
  A.capped = A.searches.some(x => x.capped);
  if (failed) { A.error = failed; return; }
  const rows = products.map(toFeedRow);
  A.withTracking = rows.filter(x => x.aw_deep_link).length;
  A.currencies = [...new Set(rows.map(x => x.currency).filter(Boolean))];
  A.name = (rows.find(x => x.merchant_name) || {}).merchant_name || '';
  if (!rows.length) { A.error = 'no products'; return; }
  mkdirSync(out, { recursive: true });
  A.file = join(out, `CJ_${adv}_${S.search}.csv.gz.part`);
  await writeFeed(A.file, products, COLUMNS.concat(SEARCH_COLUMNS));
  A.ok = true;
}

export async function run({ mode, cids, pid, advertisers, out, token, api = CJ_API, fetchImpl = fetch, pauseMs = 1000, lookupApi = LOOKUP_API, search = '', searchMax = SEARCH_MAX }) {
  const mask = makeMask(token);
  const S = { mode, ok: false, api: new URL(api).host, cid: '', cidTried: [], pid: String(pid || ''), queries: [], fields: [], feeds: null, feedsError: '', advertisers: [] };
  if (!token || token.length < 10) { S.error = 'no CJ token'; return S; }
  const SR = search ? (Object.prototype.hasOwnProperty.call(SEARCHES, search) ? SEARCHES[search] : null) : null;
  if (search && !SR) { S.error = `unknown search: ${String(search).slice(0, 40)}`; return S; }
  if (SR) { S.search = search; S.searchLabel = SR.label; S.searchCurrency = SR.currency || ''; S.keywords = SR.keywords.slice(); }
  if (SR && (mode === 'list' || mode === 'joined')) { S.error = 'a search works only with probe or download'; return S; }
  // The token goes only to CJ (or to the local fake server of the tests).
  const h = new URL(api).hostname;
  if (h !== 'ads.api.cj.com' && h !== '127.0.0.1') { S.error = 'unexpected API address'; return S; }
  // Mode "joined": the shops that accepted us, then the same read-only look as "probe" at each of them.
  if (mode === 'joined') {
    const lh = new URL(lookupApi).hostname;
    if (lh !== 'advertiser-lookup.api.cj.com' && lh !== '127.0.0.1') { S.error = 'unexpected lookup address'; return S; }
    const J = await joinedAdvertisers({ token, cids, lookupApi, fetchImpl, pauseMs });
    S.joinedTried = J.tried.map(t => ({ cid: t.cid, error: mask(t.error) }));
    if (!J.cid) { S.error = 'the CJ advertiser lookup did not answer for any CID'; return S; }
    S.joined = J.advertisers;
    if (!J.advertisers.length) { S.ok = true; return S; }
    advertisers = J.advertisers.map(a => a.id);
    cids = [J.cid, ...cids.filter(c => c !== J.cid)];
    mode = 'probe';
  }
  const d = await describe({ token, api, fetchImpl });
  let shape = null;
  if (d.ok) {
    S.queries = d.queries.filter(q => /product|feed/i.test(q));
    const s = d.shoppingProducts || d.products;
    if (s) {
      shape = { ...s, qname: d.shoppingProducts ? 'shoppingProducts' : 'products' };
      S.fields = s.fields.map(f => f.name + (f.args.length ? `(${f.args.join(',')})` : ''));
      S.productArgs = s.args.map(a => (s.argTypes && s.argTypes[a] ? `${a}:${s.argTypes[a]}` : a));
      S.priceBands = ['lowPrice', 'highPrice'].every(a => s.args.includes(a));
    }
  } else S.describeError = mask(d.error);
  if (d.ok && !shape) { S.error = 'the CJ API has no product query (shoppingProducts / products)'; return S; }
  // Without the keywords argument a "search" would read the WHOLE catalogue (DHgate: 6 million products): stop instead.
  if (SR && !(shape && shape.args.includes('keywords'))) { S.error = 'the CJ API has no keyword search (keywords)'; return S; }
  if (SR && SR.currency && !shape.args.includes('currency')) { S.error = 'the CJ API has no currency filter (currency)'; return S; }
  const first = advertisers[0];
  const c = await pickCid({ cids, token, api, fetchImpl, shape, pid, advertiser: first });
  S.cidTried = c.tried.map(t => ({ cid: t.cid, error: mask(t.error) }));
  if (!c.cid) { S.error = 'no CJ account id (CID) worked with this token'; return S; }
  S.cid = c.cid;
  // The feeds of the advertisers that accepted us (read-only, for the report).
  if (d.ok && d.shoppingProductFeeds) {
    const fs = d.shoppingProductFeeds;
    const want = ['advertiserId', 'advertiserName', 'feedName', 'productCount', 'lastUpdated', 'currency', 'language', 'adId'].filter(x => fs.fields.some(f => f.name === x && !f.object));
    const outer = ['totalCount', 'count'].filter(x => fs.outer.includes(x)).join(' ');
    // Mode "list" (6 Nov 2026, lessons L96) pages through every feed with offset, when the API has it: the first run
    // stopped at exactly 500, the limit of one page.
    // The second run (6 Nov 2026) stopped at exactly 10,000 = the old cap of 20 pages: now up to FEED_MAX_PAGES pages,
    // it stops when CJ's own total (totalCount) is reached, and the report says when the cap cut the list.
    const pages = mode === 'list' && fs.args.includes('offset') && fs.args.includes('limit') ? FEED_MAX_PAGES : 1;
    const all = [];
    let apiTotal = null;
    for (let pg = 0; pg < pages; pg++) {
      const lim = fs.args.includes('limit') ? `, limit: ${FEED_PAGE}` : '';
      const off = pg && fs.args.includes('offset') ? `, offset: ${pg * FEED_PAGE}` : '';
      const q = `{ shoppingProductFeeds(companyId: "${S.cid}"${lim}${off}) { ${outer} resultList { ${want.join(' ')} } } }`;
      const r = await gql({ token, api, fetchImpl, query: q });
      if (r.errors || !r.data) { S.feedsError = mask(errText(r.errors)); break; }
      const block = r.data.shoppingProductFeeds;
      if (apiTotal === null && block.totalCount != null && block.totalCount !== '' && Number.isFinite(Number(block.totalCount))) apiTotal = Number(block.totalCount);
      const got = block.resultList || [];
      all.push(...got);
      if (got.length < FEED_PAGE) break;
      if (apiTotal !== null && all.length >= apiTotal) break;
      if (pages > 1 && pg === pages - 1) { S.feedsCapped = true; break; }
      if (pauseMs) await sleep(pauseMs);
    }
    S.feedsApiTotal = apiTotal;
    if (!S.feedsError || all.length) {
      // The API lists every CJ feed (first run, 31 Oct 2026: 500 feeds of shops that never accepted us). Probe and
      // download show only the feeds of the chosen advertisers and the total; "list" shows them all.
      S.feedsTotal = all.length;
      const pick = mode === 'list' ? all : all.filter(f => advertisers.includes(String(f.advertiserId)));
      S.feeds = pick.map(f => Object.fromEntries(want.map(k => [k, f[k] ?? ''])));
    }
  }
  if (mode === 'list') { S.ok = S.feeds !== null; if (!S.ok && !S.feedsError) S.feedsError = 'the CJ API has no feed list (shoppingProductFeeds)'; return S; }
  for (const adv of advertisers) {
    const A = { advertiser: adv, ok: false };
    if (SR) { await searchOne({ A, SR, S, shape, pid, adv, token, api, fetchImpl, pauseMs, out, mode, mask, searchMax }); S.advertisers.push(A); continue; }
    if (mode === 'probe') {
      const r = await gql({ token, api, fetchImpl, query: productQuery({ shape, cid: S.cid, pid, advertiser: adv, limit: 5 }) });
      const qname = (shape && shape.qname) || 'shoppingProducts';
      if (r.errors || !r.data || !r.data[qname]) { A.error = mask(errText(r.errors) || 'empty answer'); S.advertisers.push(A); continue; }
      const block = r.data[qname];
      A.ok = true;
      A.total = Number.isFinite(Number(block.totalCount)) ? Number(block.totalCount) : null;
      A.samples = (block.resultList || []).map(toFeedRow).map(x => ({ name: x.product_name, brand: x.brand_name, price: x.search_price, currency: x.currency, stock: x.stock_status,
        category: x.merchant_category, page: x.merchant_deep_link, image: x.merchant_image_url ? 'yes' : 'no', tracking: x.aw_deep_link ? new URL(x.aw_deep_link).host : 'NONE', group: x.parent_product_id }));
    } else {
      const r = await fetchAll({ shape, cid: S.cid, pid, advertiser: adv, token, api, fetchImpl, pauseMs, maxTotal: WHOLE_MAX });
      if (r.tooBroad) r.error = `the whole catalogue is too big (${r.total} products): only a search (-Search) can read it`;
      A.total = r.total;
      A.got = r.products.length;
      A.capped = Boolean(r.capped);
      A.bands = r.bands || 0;
      A.split = r.split || '';
      if (!r.ok) { A.error = mask(r.error); S.advertisers.push(A); continue; }
      const rows = r.products.map(toFeedRow);
      A.withTracking = rows.filter(x => x.aw_deep_link).length;
      A.currencies = [...new Set(rows.map(x => x.currency).filter(Boolean))];
      A.name = (rows.find(x => x.merchant_name) || {}).merchant_name || '';
      if (!rows.length) { A.error = 'no products'; S.advertisers.push(A); continue; }
      mkdirSync(out, { recursive: true });
      A.file = join(out, `CJ_${adv}.csv.gz.part`);
      await writeFeed(A.file, r.products);
      A.ok = true;
    }
    S.advertisers.push(A);
  }
  S.ok = S.advertisers.every(a => a.ok);
  return S;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? String(args[i + 1] || '') : ''; };
  const token = process.env.GW_CJ_TOKEN || '';
  const mask = makeMask(token);
  const list = s => s.split(/[,\s]+/).filter(x => /^\d{3,12}$/.test(x));
  try {
    const S = await run({ mode: ['download', 'list', 'joined'].includes(opt('--mode')) ? opt('--mode') : 'probe', cids: list(opt('--cid')), pid: opt('--pid'), advertisers: list(opt('--advertisers')),
      out: opt('--out'), token, api: opt('--api') || CJ_API, pauseMs: Number(opt('--pause') || 1000), lookupApi: opt('--lookup') || LOOKUP_API,
      search: opt('--search') });
    process.stdout.write(mask(JSON.stringify(S)) + '\n');
  } catch (e) {
    process.stdout.write(mask(JSON.stringify({ ok: false, error: String(e && e.stack ? e.stack : e).slice(0, 800) })) + '\n');
  }
}
