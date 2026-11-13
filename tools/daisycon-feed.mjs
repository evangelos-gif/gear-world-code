// Daisycon product feeds (13 Nov 2026, lessons L128). Daisycon accepted Gear World for many European shops (Superdry EU,
// La Redoute NL/DE, Petit Bateau, My Little Darling Shop UK ...).
// First try (13 Nov 2026): guessing each feed's address (daisycon.io/datafeed with a "standard" and a "locale") gave
// "Missing the following parameters: locale_id" and then "Too many requests" for every programme. Now the feeds come from
// Daisycon's own API, as its documentation says: the owner creates an API app once (Tools -> Daisycon API, redirect URI
// https://login.daisycon.com/oauth/cli), signs in once in the browser (OAuth with PKCE) and pastes the code it shows;
// the API then lists every feed of a programme with its ready address (#MEDIA_ID# = our media).
// The download writes DAISYCON_<programme>.csv.gz with the Awin column names and the Daisycon tracking link in
// aw_deep_link, like CJ (lessons L86), so tools/legacy-import.ps1 imports it like any other feed.
// Secrets (client secret, refresh token, code) come only through environment variables from the PowerShell tool, which
// keeps them encrypted (DPAPI) and never writes them to a report.
// Command line (used by tools/daisycon-feed-download.ps1):
//   node tools/daisycon-feed.mjs --mode auth-url --client <client id>
//   node tools/daisycon-feed.mjs --mode auth-token          (GW_DC_CLIENT, GW_DC_SECRET, GW_DC_CODE, GW_DC_VERIFIER)
//   node tools/daisycon-feed.mjs --mode probe|download --media <id> --programs 16029,22318 [--out <dir>]
//                                                          (GW_DC_CLIENT, GW_DC_SECRET, GW_DC_REFRESH)
import { createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FEED_COLUMNS, csvLine, isDaisyconLink, pageInLink } from './network-links.mjs';

export const LOGIN = 'https://login.daisycon.com';
export const SERVICES = 'https://services.daisycon.com';
export const REDIRECT = 'https://login.daisycon.com/oauth/cli';
export const PER_PAGE = 500;
export const MAX_PAGES = 200;            // 100,000 products for one programme at most
export const API_PAUSE_MS = 1400;        // Daisycon's API allows 50 requests a minute

const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function pkce() {
  const verifier = b64url(randomBytes(32));
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()), state: b64url(randomBytes(12)) };
}
export function authorizeUrl({ client, challenge, state, login = LOGIN }) {
  const q = new URLSearchParams({ response_type: 'code', client_id: client, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state });
  return `${login}/oauth/authorize?${q}`;
}

// Only Daisycon gets the keys (or the tests' local fake server).
const okHost = (u, hosts) => { try { const h = new URL(u).hostname; return hosts.includes(h) || h === '127.0.0.1'; } catch { return false; } };

export async function tokenRequest({ login = LOGIN, fetchImpl = fetch, ...fields }) {
  if (!okHost(login, ['login.daisycon.com'])) return { error: 'unexpected login address' };
  const body = new URLSearchParams(Object.fromEntries(Object.entries(fields).filter(([, v]) => v)));
  let res;
  try { res = await fetchImpl(`${login}/oauth/access-token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() }); }
  catch (e) { return { error: String(e && e.message || e) }; }
  const text = await res.text();
  let j = null;
  try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (res.status !== 200 || !j || !j.access_token) return { error: `HTTP ${res.status} ${(j && (j.error_description || j.error || j.message)) || text.slice(0, 200)}` };
  return { access: j.access_token, refresh: j.refresh_token || fields.refresh_token || '', expiresIn: j.expires_in };
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const looksLikeProduct = o => isObj(o) && (isObj(o.product_info) || ('link' in o && ('title' in o || 'name' in o)));

// The products of a Daisycon JSON answer, wherever they sit (datafeed.programs[].products[] in the feeds seen in other
// projects, but the layout is not documented): the first array of product-like objects, with their programme's info.
export function findProducts(json) {
  const out = [];
  const walk = (v, program) => {
    if (Array.isArray(v)) {
      if (v.length && v.every(looksLikeProduct)) { for (const p of v) out.push({ product: p, program }); return; }
      for (const x of v) walk(x, program);
      return;
    }
    if (!isObj(v)) return;
    const info = isObj(v.program_info) ? v.program_info : program;
    for (const k of Object.keys(v)) walk(v[k], info);
  };
  walk(json, null);
  return out;
}

// One product's fields in one flat object: product_info, update_info and the top level, sub-objects joined with "_".
export function flatten(p) {
  const flat = {};
  const add = (o, pre) => {
    for (const [k, v] of Object.entries(o || {})) {
      const key = pre ? `${pre}_${k}` : k;
      if (isObj(v)) add(v, ['product_info', 'update_info', 'info'].includes(k) && !pre ? '' : key);
      else if (!(key in flat)) flat[key] = v;
    }
  };
  add(p, '');
  return flat;
}

const first = (f, names) => { for (const n of names) { const v = f[n]; if (v !== undefined && v !== null && String(v).trim() !== '') return v; } return ''; };
const num = v => { const n = Number(String(v ?? '').replace(/[^0-9.,-]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };
const imageOf = (f, raw) => {
  const imgs = raw && (raw.images || (raw.product_info && raw.product_info.images));
  if (Array.isArray(imgs) && imgs.length) { const i = imgs[0]; return String(isObj(i) ? (i.location || i.url || i.src || i.link || '') : i); }
  return String(first(f, ['image_location', 'image_large', 'image_url', 'image', 'image_default', 'images', 'image_link']));
};

// One Daisycon product as one feed row (Awin column names): price is the price today, the old price is the shop's "was".
export function toFeedRow(raw, { programId, program, mediaId } = {}) {
  const f = flatten(raw);
  const link = String(first(f, ['link', 'deeplink', 'tracking_link', 'url_tracking', 'affiliate_link']));
  const price = num(first(f, ['price', 'price_new', 'sale_price', 'selling_price', 'price_sale']));
  const old = num(first(f, ['price_old', 'price_from', 'rrp', 'price_normal', 'price_regular']));
  const stockRaw = String(first(f, ['in_stock', 'stock', 'availability', 'in_stock_amount', 'stock_status'])).trim().toLowerCase();
  const inStock = /^(true|1|yes|y|in ?stock|available|op voorraad|auf lager)$/.test(stockRaw) || /^[1-9]\d*$/.test(stockRaw) ? '1'
    : /^(false|0|no|n|out ?of ?stock|sold ?out|niet op voorraad|nicht verf)/.test(stockRaw) ? '0' : '';
  const category = [first(f, ['category_path']), first(f, ['category', 'category_name', 'main_category']), first(f, ['sub_category', 'subcategory'])]
    .map(x => String(x || '').trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' > ');
  const page = pageInLink(link) || String(first(f, ['product_link', 'product_url', 'url', 'landing_page']) || '');
  return {
    data_feed_id: 'daisycon', merchant_id: String(programId ?? ''), merchant_name: String((program && (program.name || program.program_name)) || ''),
    aw_product_id: String(first(f, ['daisycon_unique_id', 'unique_id', 'id', 'product_id', 'sku']) || ''),
    aw_deep_link: isDaisyconLink(link, mediaId) ? link : '', brand_name: String(first(f, ['brand', 'brand_name', 'manufacturer']) || ''),
    merchant_product_id: String(first(f, ['sku', 'product_id', 'id', 'model', 'daisycon_unique_id']) || ''),
    merchant_category: category, category_name: category, ean: String(first(f, ['ean', 'gtin', 'ean13', 'barcode']) || ''),
    mpn: String(first(f, ['mpn', 'model', 'manufacturer_part_number']) || ''),
    product_name: String(first(f, ['title', 'name', 'product_name', 'product_title']) || ''),
    description: String(first(f, ['description', 'description_short', 'short_description']) || '').slice(0, 2000),
    merchant_deep_link: page, merchant_image_url: imageOf(f, raw), large_image: '',
    search_price: Number.isFinite(price) ? String(price) : '',
    store_price: Number.isFinite(price) ? String(price) : '', rrp_price: Number.isFinite(old) ? String(old) : '',
    currency: String(first(f, ['currency', 'currency_code']) || (program && (program.currency || program.currency_code)) || '').toUpperCase(),
    in_stock: inStock, stock_status: stockRaw, parent_product_id: String(first(f, ['parent_id', 'group_id', 'item_group_id', 'model_id']) || ''),
    last_updated: String(first(f, ['last_modified', 'update_date', 'modified']) || '')
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// GET with a wait on "Too many requests" (429): Retry-After, else 60 s, at most 3 times. Nothing is hammered.
async function getJson(url, { fetchImpl = fetch, token = '', waitMs = 60000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try { res = await fetchImpl(url, { headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } }); }
    catch (e) { return { status: 0, error: String(e && e.message || e) }; }
    if (res.status === 429 && attempt < 3) {
      const ra = Number(res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : NaN);
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 120000) : waitMs);
      continue;
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, json, text: json ? '' : text.slice(0, 300), total: res.headers && typeof res.headers.get === 'function' ? res.headers.get('x-total-count') : null };
  }
}

const listOf = j => Array.isArray(j) ? j : (j && Array.isArray(j.results) ? j.results : (j && Array.isArray(j.data) ? j.data : []));

// The feed of a programme the import should use: English first, then the one with the most products.
export function pickFeed(feeds) {
  const ok = feeds.filter(f => f && f.url);
  ok.sort((a, b) => (String(b.language_code || '').toLowerCase() === 'en') - (String(a.language_code || '').toLowerCase() === 'en') || (Number(b.products) || 0) - (Number(a.products) || 0));
  return ok[0] || null;
}

// The ready address of a feed: our media id (and the feed's first locale) in its placeholders, JSON, one page.
export function feedAddress(feed, { mediaId, page = 1, perPage = PER_PAGE }) {
  const locale = Array.isArray(feed.locale_ids) && feed.locale_ids.length ? feed.locale_ids[0] : (feed.locale_id || '');
  const u = new URL(String(feed.url).replace(/#MEDIA_ID#/g, String(mediaId)).replace(/#LOCALE_ID#/g, String(locale)));
  if (!u.searchParams.get('media_id') && !u.searchParams.get('filter_id')) u.searchParams.set('media_id', String(mediaId));
  if (!u.searchParams.get('locale_id') && locale) u.searchParams.set('locale_id', String(locale));
  for (const [k, v] of Object.entries({ type: 'JSON', html_transform: 'none', rawdata: 'false', encoding: 'utf8', general: 'false', page: String(page), per_page: String(perPage) })) u.searchParams.set(k, v);
  return u.toString();
}

// The API part: who we are on Daisycon, and each programme's feeds.
async function apiFeeds({ access, programs, services, fetchImpl, pauseMs }) {
  const pub = await getJson(`${services}/publishers`, { fetchImpl, token: access });
  const pubs = listOf(pub.json);
  if (pub.status !== 200 || !pubs.length) return { error: `publishers: HTTP ${pub.status} ${pub.text || JSON.stringify(pub.json || '').slice(0, 200)}` };
  const publisher = pubs[0].id;
  const out = [];
  for (const programId of programs) {
    if (pauseMs) await sleep(pauseMs);
    const r = await getJson(`${services}/publishers/${publisher}/productfeeds.v2/program?program_id=${programId}&page=1&per_page=100`, { fetchImpl, token: access });
    const feeds = r.status === 200 ? listOf(r.json) : [];
    out.push({ program: String(programId), status: r.status, error: r.status === 200 ? '' : `HTTP ${r.status} ${r.text || JSON.stringify(r.json || '').slice(0, 200)}`,
      feeds: feeds.map(f => ({ id: f.id, url: f.url, standard_id: f.standard_id, language_code: f.language_code, locale_ids: f.locale_ids, currency_code: f.currency_code, products: f.products, name: f.name || f.program_name || '' })) });
  }
  return { publisher: String(publisher), programs: out };
}

// Read-only: each programme's feeds and two samples of the chosen one. Nothing is written.
export async function probe({ access, mediaId, programs, services = SERVICES, fetchImpl = fetch, pauseMs = API_PAUSE_MS }) {
  const A = await apiFeeds({ access, programs, services, fetchImpl, pauseMs });
  if (A.error) return { error: A.error };
  const result = [];
  for (const p of A.programs) {
    const P = { program: p.program, ok: false, feeds: p.feeds.length, error: p.error, samples: [], keys: [] };
    const f = pickFeed(p.feeds);
    if (!f) { if (!P.error) P.error = 'no product feed for this programme'; result.push(P); continue; }
    Object.assign(P, { feedId: f.id, language: f.language_code, currency: f.currency_code, products: f.products, standard: f.standard_id });
    const url = feedAddress(f, { mediaId, page: 1, perPage: 2 });
    if (!okHost(url, ['daisycon.io'])) { P.error = 'the feed address is not on daisycon.io'; result.push(P); continue; }
    const r = await getJson(url, { fetchImpl });
    const found = r.json ? findProducts(r.json) : [];
    if (!found.length) { P.error = `feed: HTTP ${r.status} ${r.text || JSON.stringify(r.json || '').slice(0, 200)}`; result.push(P); continue; }
    P.ok = true;
    P.name = String((found[0].program && (found[0].program.name || found[0].program.program_name)) || f.name || '');
    P.keys = Object.keys(flatten(found[0].product)).slice(0, 60);
    P.samples = found.slice(0, 2).map(x => { const row = toFeedRow(x.product, { programId: p.program, program: x.program, mediaId }); return {
      name: row.product_name, price: row.search_price, currency: row.currency || f.currency_code || '', stock: row.in_stock || row.stock_status, category: row.merchant_category,
      image: /^https:\/\//.test(row.merchant_image_url) ? 'yes' : (row.merchant_image_url ? 'not https' : 'no'), page: row.merchant_deep_link,
      tracking: row.aw_deep_link ? new URL(row.aw_deep_link).host : 'NONE' }; });
    result.push(P);
    if (pauseMs) await sleep(pauseMs);
  }
  return { publisher: A.publisher, programs: result };
}

async function writeRows(file, rows) {
  await new Promise((resolve, reject) => {
    const gz = createGzip();
    const ws = createWriteStream(file);
    gz.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
    gz.write(csvLine(FEED_COLUMNS));
    for (const row of rows) gz.write(csvLine(FEED_COLUMNS.map(c => row[c])));
    gz.end();
  });
}

// Every product of each programme's chosen feed, page by page, to <out>/DAISYCON_<programme>.csv.gz.part.
export async function download({ access, mediaId, programs, out, services = SERVICES, fetchImpl = fetch, pauseMs = API_PAUSE_MS }) {
  const A = await apiFeeds({ access, programs, services, fetchImpl, pauseMs });
  if (A.error) return { error: A.error };
  const result = [];
  for (const p of A.programs) {
    const D = { program: p.program, ok: false, got: 0, withTracking: 0, currencies: [], file: join(out, `DAISYCON_${p.program}.csv.gz.part`), name: '' };
    const f = pickFeed(p.feeds);
    if (!f) { D.error = p.error || 'no product feed for this programme'; result.push(D); continue; }
    const rows = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = feedAddress(f, { mediaId, page, perPage: PER_PAGE });
      if (!okHost(url, ['daisycon.io'])) { D.error = 'the feed address is not on daisycon.io'; break; }
      const r = await getJson(url, { fetchImpl });
      if (!r.json) { D.error = `HTTP ${r.status} ${r.error || r.text || ''}`.trim(); break; }
      const found = findProducts(r.json);
      for (const x of found) {
        const row = toFeedRow(x.product, { programId: p.program, program: x.program, mediaId });
        if (!row.currency && f.currency_code) row.currency = String(f.currency_code).toUpperCase();
        if (!D.name) D.name = row.merchant_name || f.name || '';
        rows.push(row);
      }
      if (found.length < PER_PAGE) break;
      if (page === MAX_PAGES) D.capped = true;
      if (pauseMs) await sleep(Math.min(pauseMs, 1000));
    }
    D.got = rows.length;
    D.withTracking = rows.filter(x => x.aw_deep_link).length;
    D.currencies = [...new Set(rows.map(x => x.currency).filter(Boolean))];
    if (!D.error && !rows.length) D.error = 'no products';
    if (!D.error) { await writeRows(D.file, rows); D.ok = true; }
    result.push(D);
  }
  return { publisher: A.publisher, programs: result };
}

const arg = (argv, name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };

export async function main(argv = process.argv.slice(2), fetchImpl = fetch, env = process.env) {
  const mode = arg(argv, 'mode');
  const base = arg(argv, 'base');   // the tests' local fake server only
  if (base && !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) return { ok: false, error: 'unexpected Daisycon address' };
  const login = base || LOGIN;
  const services = base || SERVICES;
  if (mode === 'auth-url') {
    const client = String(arg(argv, 'client') || '');
    if (!/^[A-Za-z0-9._-]{4,100}$/.test(client)) return { ok: false, error: 'wrong client id' };
    const k = pkce();
    return { ok: true, url: authorizeUrl({ client, challenge: k.challenge, state: k.state, login }), verifier: k.verifier, state: k.state };
  }
  if (mode === 'auth-token') {
    const t = await tokenRequest({ login, fetchImpl, grant_type: 'authorization_code', code: env.GW_DC_CODE || '', client_id: env.GW_DC_CLIENT || '',
      client_secret: env.GW_DC_SECRET || '', redirect_uri: REDIRECT, code_verifier: env.GW_DC_VERIFIER || '' });
    return t.error ? { ok: false, error: t.error } : { ok: true, refresh: t.refresh };
  }
  const mediaId = String(arg(argv, 'media') || '');
  const programs = String(arg(argv, 'programs') || '').split(/[,\s]+/).filter(Boolean);
  if (!/^\d{3,10}$/.test(mediaId)) return { ok: false, error: 'wrong media id' };
  if (!programs.length || programs.some(p => !/^\d{2,8}$/.test(p))) return { ok: false, error: 'wrong programme ids' };
  if (!['probe', 'download'].includes(mode)) return { ok: false, error: 'mode must be auth-url, auth-token, probe or download' };
  const t = await tokenRequest({ login, fetchImpl, grant_type: 'refresh_token', refresh_token: env.GW_DC_REFRESH || '', client_id: env.GW_DC_CLIENT || '', client_secret: env.GW_DC_SECRET || '' });
  if (t.error) return { ok: false, error: `sign-in: ${t.error}`, signIn: true };
  const S = { ok: false, mode, media: mediaId, newRefresh: t.refresh && t.refresh !== env.GW_DC_REFRESH ? t.refresh : '' };
  const pause = Number(arg(argv, 'pause') ?? API_PAUSE_MS);
  if (mode === 'probe') Object.assign(S, await probe({ access: t.access, mediaId, programs, services, fetchImpl, pauseMs: pause }));
  else {
    const out = arg(argv, 'out');
    if (!out) return { ...S, error: 'no output folder' };
    Object.assign(S, await download({ access: t.access, mediaId, programs, out, services, fetchImpl, pauseMs: pause }));
  }
  S.ok = !S.error;
  return S;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(S => { console.log(JSON.stringify(S)); }, e => { console.log(JSON.stringify({ ok: false, error: String(e && e.message || e).slice(0, 300) })); });
}
