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
// Usage: node tools/cj-feed.mjs --mode probe|download --cid 7806395,8114224 --pid 101917444 --advertisers 5175167 [--out <dir>]
import { createWriteStream, mkdirSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CJ_API = 'https://ads.api.cj.com/query';
export const PAGE = 1000;           // CJ gives at most 1,000 products per request
export const MAX_PRODUCTS = 50000;  // a sane ceiling for one advertiser

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
  const root = await gql({ token, api, fetchImpl, query: `{ __schema { queryType { fields { name args { name } type { ${TYPE_REF} } } } } }` });
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
    return { args: q.args.map(a => a.name), outer: outer.map(f => f.name), item, fields: fields.map(f => ({ name: f.name, args: (f.args || []).map(a => a.name), object: Boolean(sub[f.name]), list: isList(f.type) })), sub };
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
const WANT = ['id', 'title', 'description', 'brand', 'link', 'imageLink', 'additionalImageLink', 'availability', 'gtin', 'mpn', 'advertiserId', 'advertiserName',
  'productType', 'itemGroupId', 'lastUpdated', 'price', 'salePrice', 'googleProductCategory', 'linkCode'];
const SUB_WANT = { price: ['amount', 'currency'], salePrice: ['amount', 'currency'], googleProductCategory: ['name'], linkCode: ['clickUrl'], imageLink: ['url', 'link'], additionalImageLink: ['url', 'link'] };

// The product query, built from the fields the API really has. pid: the CJ property (website) id for the tracking links.
export function productQuery({ shape, cid, pid, advertiser, limit = PAGE, offset = 0 }) {
  const s = shape || FALLBACK_PRODUCT;
  const qname = s.qname || 'shoppingProducts';
  const args = [`companyId: "${String(cid).replace(/\D/g, '')}"`];
  if (s.args.includes('partnerIds')) args.push(`partnerIds: ["${String(advertiser).replace(/\D/g, '')}"]`);
  if (s.args.includes('limit')) args.push(`limit: ${limit}`);
  if (s.args.includes('offset')) args.push(`offset: ${offset}`);
  const sel = [];
  for (const name of WANT) {
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
    currency: cur(p.salePrice, p.price), in_stock: inStock, stock_status: av, parent_product_id: String(p.itemGroupId ?? ''), last_updated: String(p.lastUpdated ?? '')
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

// Every product of one advertiser, page by page.
export async function fetchAll({ shape, cid, pid, advertiser, token, api, fetchImpl, pauseMs = 1000, log = () => {} }) {
  const qname = (shape && shape.qname) || 'shoppingProducts';
  const out = [];
  let total = null;
  for (let offset = 0; offset < MAX_PRODUCTS; offset += PAGE) {
    const r = await gql({ token, api, fetchImpl, query: productQuery({ shape, cid, pid, advertiser, offset }) });
    if (r.errors || !r.data || !r.data[qname]) return { ok: false, products: out, total, error: errText(r.errors) || 'empty answer' };
    const block = r.data[qname];
    if (total === null && Number.isFinite(Number(block.totalCount))) total = Number(block.totalCount);
    const list = Array.isArray(block.resultList) ? block.resultList : [];
    out.push(...list);
    log(`${advertiser}: ${out.length}${total !== null ? ` / ${total}` : ''}`);
    if (list.length < PAGE || (total !== null && out.length >= total)) break;
    if (pauseMs) await sleep(pauseMs);
  }
  return { ok: true, products: out, total };
}

export async function writeFeed(file, products) {
  await new Promise((resolve, reject) => {
    const gz = createGzip();
    const ws = createWriteStream(file);
    gz.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
    gz.write(csvLine(COLUMNS));
    for (const p of products) { const row = toFeedRow(p); gz.write(csvLine(COLUMNS.map(c => row[c]))); }
    gz.end();
  });
}

// The whole run. Returns a summary object (printed as JSON by the command line).
export async function run({ mode, cids, pid, advertisers, out, token, api = CJ_API, fetchImpl = fetch, pauseMs = 1000 }) {
  const mask = makeMask(token);
  const S = { mode, ok: false, api: new URL(api).host, cid: '', cidTried: [], pid: String(pid || ''), queries: [], fields: [], feeds: null, feedsError: '', advertisers: [] };
  if (!token || token.length < 10) { S.error = 'no CJ token'; return S; }
  // The token goes only to CJ (or to the local fake server of the tests).
  const h = new URL(api).hostname;
  if (h !== 'ads.api.cj.com' && h !== '127.0.0.1') { S.error = 'unexpected API address'; return S; }
  const d = await describe({ token, api, fetchImpl });
  let shape = null;
  if (d.ok) {
    S.queries = d.queries.filter(q => /product|feed/i.test(q));
    const s = d.shoppingProducts || d.products;
    if (s) { shape = { ...s, qname: d.shoppingProducts ? 'shoppingProducts' : 'products' }; S.fields = s.fields.map(f => f.name + (f.args.length ? `(${f.args.join(',')})` : '')); }
  } else S.describeError = mask(d.error);
  if (d.ok && !shape) { S.error = 'the CJ API has no product query (shoppingProducts / products)'; return S; }
  const first = advertisers[0];
  const c = await pickCid({ cids, token, api, fetchImpl, shape, pid, advertiser: first });
  S.cidTried = c.tried.map(t => ({ cid: t.cid, error: mask(t.error) }));
  if (!c.cid) { S.error = 'no CJ account id (CID) worked with this token'; return S; }
  S.cid = c.cid;
  // The feeds of the advertisers that accepted us (read-only, for the report).
  if (d.ok && d.shoppingProductFeeds) {
    const fs = d.shoppingProductFeeds;
    const want = ['advertiserId', 'advertiserName', 'feedName', 'productCount', 'lastUpdated', 'currency', 'language', 'adId'].filter(x => fs.fields.some(f => f.name === x && !f.object));
    const q = `{ shoppingProductFeeds(companyId: "${S.cid}"${fs.args.includes('limit') ? ', limit: 500' : ''}) { ${['totalCount', 'count'].filter(x => fs.outer.includes(x)).join(' ')} resultList { ${want.join(' ')} } } }`;
    const r = await gql({ token, api, fetchImpl, query: q });
    if (r.errors || !r.data) S.feedsError = mask(errText(r.errors));
    else {
      // The API lists every CJ feed (first run, 31 Oct 2026: 500 feeds of shops that never accepted us), so the report
      // shows only the feeds of the chosen advertisers and the total.
      const all = r.data.shoppingProductFeeds.resultList || [];
      S.feedsTotal = all.length;
      S.feeds = all.filter(f => advertisers.includes(String(f.advertiserId))).map(f => Object.fromEntries(want.map(k => [k, f[k] ?? ''])));
    }
  }
  for (const adv of advertisers) {
    const A = { advertiser: adv, ok: false };
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
      const r = await fetchAll({ shape, cid: S.cid, pid, advertiser: adv, token, api, fetchImpl, pauseMs });
      A.total = r.total;
      A.got = r.products.length;
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
    const S = await run({ mode: opt('--mode') === 'download' ? 'download' : 'probe', cids: list(opt('--cid')), pid: opt('--pid'), advertisers: list(opt('--advertisers')),
      out: opt('--out'), token, api: opt('--api') || CJ_API, pauseMs: Number(opt('--pause') || 1000) });
    process.stdout.write(mask(JSON.stringify(S)) + '\n');
  } catch (e) {
    process.stdout.write(mask(JSON.stringify({ ok: false, error: String(e && e.stack ? e.stack : e).slice(0, 800) })) + '\n');
  }
}
