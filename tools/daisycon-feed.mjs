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
//                                [--country GB | GB,US,PL] [--currency GBP] [--max-products 300000]
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
// Daisycon pages a feed with "records" and the X-Next-Url answer header ("Paginating product feeds"); "page" and
// "per_page" are not feed parameters: the first real download (14 Nov 2026, lessons L145) got the whole feed again on
// every page, 200 times over (430,400 rows for 2,152 products), and the next programme ran Node out of memory.
export const PER_PAGE = 1000;            // products per request ("records")
export const MAX_PAGES = 2000;           // a guard only: a page with nothing new, or too many products, stops sooner
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
export function toFeedRow(raw, { programId, program, mediaId, shopUrl = '' } = {}) {
  const f = flatten(raw);
  const link = String(first(f, ['link', 'deeplink', 'tracking_link', 'url_tracking', 'affiliate_link']));
  const price = num(first(f, ['price', 'price_new', 'sale_price', 'selling_price', 'price_sale']));
  const old = num(first(f, ['price_old', 'price_from', 'rrp', 'price_normal', 'price_regular']));
  const stockRaw = String(first(f, ['in_stock', 'stock', 'availability', 'in_stock_amount', 'stock_status'])).trim().toLowerCase();
  const inStock = /^(true|1|yes|y|in ?stock|available|op voorraad|auf lager)$/.test(stockRaw) || /^[1-9]\d*$/.test(stockRaw) ? '1'
    : /^(false|0|no|n|out ?of ?stock|sold ?out|niet op voorraad|nicht verf)/.test(stockRaw) ? '0' : '';
  const category = [first(f, ['category_path']), first(f, ['category', 'category_name', 'main_category']), first(f, ['sub_category', 'subcategory'])]
    .map(x => String(x || '').trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' > ');
  const page = pageInLink(link) || pageFromDl(link, shopUrl) || String(first(f, ['product_link', 'product_url', 'url', 'landing_page']) || '');
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
    last_updated: String(first(f, ['last_modified', 'update_date', 'modified']) || ''),
    // Daisycon's own fields the rules need (who it is for, colour, size, delivery), after the Awin columns.
    dc_gender: String(first(f, ['gender_target', 'gender']) || ''), dc_colour: String(first(f, ['color_primary', 'colour', 'color']) || ''),
    dc_size: String(first(f, ['size', 'size_description']) || ''), dc_delivery: String(first(f, ['delivery_time', 'delivery_description']) || ''),
    dc_shipping: String(first(f, ['price_shipping']) ?? ''), dc_google_category: String(first(f, ['google_category_path']) || ''),
    dc_condition: String(first(f, ['condition']) || '')
  };
}

// Daisycon's links carry the shop page as a path only ("dl=foco-myst-corner-right-1200_2012r57203.html"): the page is
// the programme's own address (from the API) and that path, put together as Daisycon does. '' when it cannot be told.
// Some programmes send the click on through another network: then the path is that network's link (Rakuten
// "link?...&murl=<page>" for Giuseppe Zanotti, Impact "c/...?u=<page>" for Eufy and Ubisoft) and the page is inside it.
export function pageFromDl(link, shopUrl) {
  let dl = '';
  try { dl = new URL(String(link || '')).searchParams.get('dl') || ''; } catch { return ''; }
  dl = dl.trim();
  if (!dl) return '';
  try {
    const inner = new URL(dl, 'https://inner.invalid/');
    for (const k of ['murl', 'u', 'url', 'ued']) {
      const v = inner.searchParams.get(k);
      if (v && /^https?:\/\//i.test(v)) { try { return new URL(v).toString(); } catch { /* not a page */ } }
    }
  } catch { /* not a path */ }
  if (/^[a-z][a-z0-9+.-]*:/i.test(dl) || dl.startsWith('//')) return '';
  let base;
  try { base = new URL(String(shopUrl || '')); } catch { return ''; }
  if (!/^https?:$/.test(base.protocol)) return '';
  const whole = dl.startsWith('/') ? base.origin + dl : base.href.replace(/[?#].*$/, '').replace(/\/?$/, '/') + dl;
  try { const u = new URL(whole); return u.host === base.host ? u.toString() : ''; } catch { return ''; }
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
    const header = k => (res.headers && typeof res.headers.get === 'function' ? res.headers.get(k) : null);
    return { status: res.status, json, text: json ? '' : text.slice(0, 300), total: header('x-total-count'), next: header('x-next-url') || '' };
  }
}

const listOf = j => Array.isArray(j) ? j : (j && Array.isArray(j.results) ? j.results : (j && Array.isArray(j.data) ? j.data : []));

// The feed of a programme the import should use: English first, then the one with the most products.
// The feed to use: with a country (--country GB) only a feed that serves that country (its locale then goes in the
// address), with a currency (--currency GBP) that currency first; then English, then the most products.
// A shop with a feed per country and currency (TEMU INT, 15 Nov 2026: the owner wants only what our sites can show
// to UK visitors) must not get the biggest feed, which may be in dollars for another country (lessons L163).
export function pickFeed(feeds, { currency = '', country = '' } = {}) {
  let ok = feeds.filter(f => f && f.url);
  const cc = String(country || '').toUpperCase();
  const cur = String(currency || '').toUpperCase();
  if (cc) ok = ok.filter(f => Array.isArray(f.countries) && f.countries.includes(cc));
  const isCur = f => cur && String(f.currency_code || '').toUpperCase() === cur;
  const isEn = f => String(f.language_code || '').toLowerCase() === 'en';
  ok.sort((a, b) => (isCur(b) - isCur(a)) || (isEn(b) - isEn(a)) || (Number(b.products) || 0) - (Number(a.products) || 0));
  const f = ok[0] || null;
  if (!f || !cc) return f;
  const i = f.countries.indexOf(cc);
  const locale = Array.isArray(f.locale_ids) && i >= 0 ? f.locale_ids[i] : undefined;
  return locale === undefined ? f : { ...f, locale_ids: [locale, ...f.locale_ids.filter(x => x !== locale)] };
}

// The usual currency of a country, used when several countries are asked at once (--country GB,US,PL; owner,
// 15 Nov 2026: "to strengthen the USA and Poland"): each country's feed in its own money.
export const COUNTRY_CURRENCY = { GB: 'GBP', US: 'USD', PL: 'PLN', IE: 'EUR', DE: 'EUR', FR: 'EUR', NL: 'EUR', BE: 'EUR', ES: 'EUR', IT: 'EUR', AT: 'EUR',
  PT: 'EUR', FI: 'EUR', CA: 'CAD', AU: 'AUD', CH: 'CHF', SE: 'SEK', DK: 'DKK', NO: 'NOK', CZ: 'CZK', HU: 'HUF', RO: 'RON' };
// The countries asked for ('' = no choice, the feed as before), each with its currency.
export function countryChoices(country = '', currency = '') {
  const list = [...new Set(String(country || '').toUpperCase().split(/[,\s]+/).filter(Boolean))];
  if (!list.length) return [{ country: '', currency: String(currency || '').toUpperCase() }];
  return list.map(cc => ({ country: cc, currency: String(currency || '').toUpperCase() || COUNTRY_CURRENCY[cc] || '' }));
}

// Every feed of a programme in one line each, for the report.
export const feedSummary = feeds => feeds.filter(isObj).map(f => ({ id: f.id, language: f.language_code || '', currency: String(f.currency_code || '').toUpperCase(),
  products: f.products, countries: Array.isArray(f.countries) ? f.countries : [] }));

// A feed's address as the API gives it, made whole (first real run, 14 Nov 2026: "Invalid URL" stopped the whole look
// after the sign-in, lessons L145): an address without "https:" ("//daisycon.io/...", "daisycon.io/...") or only a
// path ("/datafeed/?...") is completed on daisycon.io; anything else that is not a web address gives null.
export function feedUrlOf(raw) {
  let s = raw;
  if (isObj(s)) s = s.json || s.url || s.href || Object.values(s).find(v => typeof v === 'string' && /daisycon\.io|^https?:|^\/\//i.test(v)) || '';
  s = String(s ?? '').trim();
  if (!s || /^\[object /i.test(s)) return null;
  if (s.startsWith('//')) s = 'https:' + s;
  else if (s.startsWith('/')) s = 'https://daisycon.io' + s;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? s : null; } catch { return null; }
}

// What an unreadable address looked like, for the report: long codes hidden, at most 160 characters.
export function addressShape(raw) {
  let s;
  try { s = typeof raw === 'string' ? raw : `${raw === null ? 'null' : typeof raw}: ${JSON.stringify(raw)}`; } catch { s = typeof raw; }
  return String(s ?? '').replace(/[A-Za-z0-9_-]{24,}/g, '***').replace(/\s+/g, ' ').slice(0, 160) || '(empty)';
}

// The ready address of a feed: our media id (and the feed's first locale and language) in its placeholders, the other
// placeholders (#SUBID# ...) emptied (a "#" left in would cut the rest of the address off), JSON, the first
// <records> products (the next ones come from the X-Next-Url header). '' when the API's address cannot be read.
export function feedAddress(feed, { mediaId, records = PER_PAGE }) {
  const locale = Array.isArray(feed.locale_ids) && feed.locale_ids.length ? feed.locale_ids[0] : (feed.locale_id || '');
  const whole = feedUrlOf(feed.url);
  if (!whole) return '';
  const filled = whole.replace(/#MEDIA_ID#/g, String(mediaId)).replace(/#LOCALE_ID#/g, String(locale))
    .replace(/#LANGUAGE_CODE#/g, String(feed.language_code || '')).replace(/#[A-Z][A-Z0-9_]*#/g, '');
  let u;
  try { u = new URL(filled); } catch { return ''; }
  if (!u.searchParams.get('media_id') && !u.searchParams.get('filter_id')) u.searchParams.set('media_id', String(mediaId));
  if (!u.searchParams.get('locale_id') && locale) u.searchParams.set('locale_id', String(locale));
  for (const k of ['page', 'per_page']) u.searchParams.delete(k);
  for (const [k, v] of Object.entries({ type: 'JSON', html_transform: 'none', rawdata: 'false', encoding: 'utf8', general: 'false', records: String(records) })) u.searchParams.set(k, v);
  return u.toString();
}

// The next page from Daisycon's X-Next-Url header: only on daisycon.io (or the tests' local server). '' otherwise.
export function nextPage(next, current) {
  if (!next) return '';
  try { const u = new URL(String(next), current); return /^https?:$/.test(u.protocol) && okHost(u.toString(), ['daisycon.io']) ? u.toString() : ''; } catch { return ''; }
}

// The API part: who we are on Daisycon, and each programme's feeds.
async function apiFeeds({ access, mediaId = '', programs, services, fetchImpl, pauseMs }) {
  const pub = await getJson(`${services}/publishers`, { fetchImpl, token: access });
  const pubs = listOf(pub.json);
  if (pub.status !== 200 || !pubs.length) return { error: `publishers: HTTP ${pub.status} ${pub.text || JSON.stringify(pub.json || '').slice(0, 200)}` };
  const publisher = pubs[0].id;
  // Each programme's shop address (to make the product pages) and the countries it supplies (a list of several
  // programme ids gave nothing on 15 Nov 2026, so one request per programme).
  const locales = {};
  if (pauseMs) await sleep(pauseMs);
  const lr = await getJson(`${services}/locales?per_page=1000`, { fetchImpl, token: access });
  for (const x of listOf(lr.json).filter(isObj)) if (x.id !== undefined) locales[String(x.id)] = String(x.country_code || x.code || '').toUpperCase();
  const localeError = lr.status === 200 ? '' : `locales: HTTP ${lr.status}`;
  const countries = ids => Array.isArray(ids) ? [...new Set(ids.map(i => locales[String(i)] || `#${i}`))] : [];
  const programInfo = async programId => {
    if (pauseMs) await sleep(pauseMs);
    const r = await getJson(`${services}/publishers/${publisher}/programs/${programId}`, { fetchImpl, token: access });
    const j = r.json;
    const x = Array.isArray(j) ? j.find(isObj) : (isObj(j) && (j.id !== undefined || j.url) ? j : listOf(j).find(isObj));
    return { I: x || {}, error: r.status === 200 && x ? '' : `programme details: HTTP ${r.status} ${r.text || ''}`.trim() };
  };
  const out = [];
  for (const programId of programs) {
    if (pauseMs) await sleep(pauseMs);
    const media = /^\d{3,10}$/.test(String(mediaId)) ? `&placeholder_media_id=${mediaId}` : '';
    const r = await getJson(`${services}/publishers/${publisher}/productfeeds.v2/program?program_id=${programId}${media}&page=1&per_page=100`, { fetchImpl, token: access });
    const feeds = r.status === 200 ? listOf(r.json) : [];
    const { I, error: infoError } = await programInfo(programId);
    out.push({ infoError: [infoError, localeError].filter(Boolean).join('; '), program: String(programId), status: r.status, error: r.status === 200 ? '' : `HTTP ${r.status} ${r.text || JSON.stringify(r.json || '').slice(0, 200)}`,
      shopUrl: String(I.url || I.display_url || ''), ships: countries(I.supply_locale_ids), programName: String(I.name || ''),
      feeds: feeds.filter(isObj).map(f => ({ id: f.id, url: f.url, standard_id: f.standard_id, language_code: f.language_code, locale_ids: f.locale_ids, countries: countries(f.locale_ids), currency_code: f.currency_code, products: f.products,
        name: f.name || f.program_name || '', subscribed: Array.isArray(f.subscribed_media_ids) ? f.subscribed_media_ids.map(String).includes(String(mediaId)) : null })) });
  }
  return { publisher: String(publisher), programs: out };
}

// Read-only: each programme's feeds and two samples of the chosen one. Nothing is written.
export async function probe({ access, mediaId, programs, services = SERVICES, fetchImpl = fetch, pauseMs = API_PAUSE_MS, currency = '', country = '' }) {
  const A = await apiFeeds({ access, mediaId, programs, services, fetchImpl, pauseMs });
  if (A.error) return { error: A.error };
  const result = [];
  for (const p of A.programs) {
    for (const c of countryChoices(country, currency)) {
      const P = { program: p.program, country: c.country, ok: false, feeds: p.feeds.length, allFeeds: feedSummary(p.feeds), error: p.error, samples: [], keys: [] };
      try { await probeOne(P, p, { mediaId, fetchImpl, currency: c.currency, country: c.country }); }
      catch (e) { P.ok = false; P.error = `unexpected: ${String(e && e.message || e).slice(0, 200)}`; }
      if (!P.ok && c.country && /^no product feed for /.test(P.error || '')) P.noFeed = true;
      result.push(P);
      if (P.ok && pauseMs) await sleep(pauseMs);
    }
  }
  return { publisher: A.publisher, programs: result };
}

// One programme's look; a problem stays with that programme (the others are still looked at).
async function probeOne(P, p, { mediaId, fetchImpl, currency = '', country = '' }) {
  const f = pickFeed(p.feeds, { currency, country });
  if (!f) { if (!P.error) P.error = country && p.feeds.some(x => x && x.url) ? `no product feed for ${String(country).toUpperCase()}` : 'no product feed for this programme'; return; }
  Object.assign(P, { feedId: f.id, language: f.language_code, currency: f.currency_code, products: f.products, standard: f.standard_id, subscribed: f.subscribed, shopUrl: p.shopUrl, ships: p.ships, infoError: p.infoError });
  const url = feedAddress(f, { mediaId, records: 2 });
  if (!url) { P.error = `the feed address from the API could not be read: ${addressShape(f.url)}`; return; }
  if (!okHost(url, ['daisycon.io'])) { P.error = `the feed address is not on daisycon.io: ${addressShape(url)}`; return; }
  const r = await getJson(url, { fetchImpl });
  const found = r.json ? findProducts(r.json) : [];
  if (!found.length) { P.error = `feed: HTTP ${r.status} ${r.text || JSON.stringify(r.json || '').slice(0, 200)}`; return; }
  P.ok = true;
  P.name = String((found[0].program && (found[0].program.name || found[0].program.program_name)) || f.name || '');
  P.keys = Object.keys(flatten(found[0].product)).slice(0, 60);
  P.samples = found.slice(0, 2).map(x => { const row = toFeedRow(x.product, { programId: p.program, program: x.program, mediaId, shopUrl: p.shopUrl }); return {
    name: row.product_name, price: row.search_price, currency: row.currency || f.currency_code || '', stock: row.in_stock || row.stock_status, category: row.merchant_category,
    image: /^https:\/\//.test(row.merchant_image_url) ? 'yes' : (row.merchant_image_url ? 'not https' : 'no'), page: row.merchant_deep_link,
    tracking: hostOf(row.aw_deep_link) || 'NONE' }; });
}

const hostOf = u => { try { return u ? new URL(u).host : ''; } catch { return ''; } };

// The Awin columns, then Daisycon's own (the import reads columns by name, so the extra ones do no harm).
export const DC_COLUMNS = [...FEED_COLUMNS, 'dc_gender', 'dc_colour', 'dc_size', 'dc_delivery', 'dc_shipping', 'dc_google_category', 'dc_condition'];

// The feed file, written as the pages come (only the ids seen stay in memory).
function openRows(file) {
  const gz = createGzip();
  const ws = createWriteStream(file);
  gz.pipe(ws);
  const done = new Promise((resolve, reject) => { ws.on('finish', resolve); ws.on('error', reject); gz.on('error', reject); });
  done.catch(() => { /* reported by close() */ });
  gz.write(csvLine(DC_COLUMNS));
  return {
    write: row => gz.write(csvLine(DC_COLUMNS.map(c => row[c]))),
    drain: () => (gz.writableNeedDrain ? new Promise(r => gz.once('drain', r)) : Promise.resolve()),
    close: () => { gz.end(); return done; }
  };
}

// Every product of each programme's chosen feed, page by page, to <out>/DAISYCON_<programme>.csv.gz.part
// (with countries: one file per country, DAISYCON_<programme>_<country>.csv.gz.part, lessons L163).
export async function download({ access, mediaId, programs, out, services = SERVICES, fetchImpl = fetch, pauseMs = API_PAUSE_MS, currency = '', country = '', maxProducts = 0 }) {
  const A = await apiFeeds({ access, mediaId, programs, services, fetchImpl, pauseMs });
  if (A.error) return { error: A.error };
  const result = [];
  for (const p of A.programs) {
    for (const c of countryChoices(country, currency)) {
      const tail = c.country ? `_${c.country}` : '';
      const D = { program: p.program, country: c.country, ok: false, got: 0, withTracking: 0, withPage: 0, currencies: [], file: join(out, `DAISYCON_${p.program}${tail}.csv.gz.part`), name: '', shopUrl: p.shopUrl, ships: p.ships };
      try { await downloadOne(D, p, { mediaId, fetchImpl, pauseMs, currency: c.currency, country: c.country, maxProducts }); }
      catch (e) { D.ok = false; D.error = `unexpected: ${String(e && e.message || e).slice(0, 200)}`; }
      if (!D.ok && c.country && /^no product feed for /.test(D.error || '')) D.noFeed = true;
      result.push(D);
    }
  }
  return { publisher: A.publisher, programs: result };
}

async function downloadOne(D, p, { mediaId, fetchImpl, pauseMs, currency = '', country = '', maxProducts = 0 }) {
  const f = pickFeed(p.feeds, { currency, country });
  if (!f) { D.error = p.error || (country && p.feeds.some(x => x && x.url) ? `no product feed for ${String(country).toUpperCase()}` : 'no product feed for this programme'); return; }
  Object.assign(D, { feedId: f.id, language: f.language_code || '', feedCurrency: String(f.currency_code || '').toUpperCase(), country: String(country || '').toUpperCase() });
  // A feed bigger than the owner allowed (-MaxProducts) is not downloaded at all (lessons L163).
  if (maxProducts > 0 && Number(f.products) > maxProducts) { D.error = `the feed has ${f.products} products, more than the ${maxProducts} allowed (-MaxProducts): not downloaded`; D.tooBig = true; return; }
  let url = feedAddress(f, { mediaId, records: PER_PAGE });
  if (!url) { D.error = `the feed address from the API could not be read: ${addressShape(f.url)}`; return; }
  if (!okHost(url, ['daisycon.io'])) { D.error = `the feed address is not on daisycon.io: ${addressShape(url)}`; return; }
  const seen = new Set();
  const currencies = new Set();
  const out = openRows(D.file);
  try {
    for (let page = 1; url; page++) {
      if (page > MAX_PAGES) { D.capped = true; break; }
      const r = await getJson(url, { fetchImpl });
      if (!r.json) { D.error = `HTTP ${r.status} ${r.error || r.text || ''}`.trim(); break; }
      if (D.total === undefined && r.total !== null && r.total !== undefined && r.total !== '') D.total = Number(r.total);
      const found = findProducts(r.json);
      let fresh = 0;
      for (const x of found) {
        const row = toFeedRow(x.product, { programId: p.program, program: x.program, mediaId, shopUrl: p.shopUrl });
        const id = row.aw_product_id || row.merchant_product_id || row.aw_deep_link || row.product_name;
        if (seen.has(id)) continue;
        seen.add(id);
        fresh++;
        if (!row.currency && f.currency_code) row.currency = String(f.currency_code).toUpperCase();
        if (!D.name) D.name = row.merchant_name || f.name || '';
        out.write(row);
        D.got++;
        if (row.aw_deep_link) D.withTracking++;
        if (row.merchant_deep_link) D.withPage++;
        if (row.currency) currencies.add(row.currency);
        // The newest update in the feed: a feed whose products all stopped changing months ago has old prices and stock
        // (Bioethanol-fireplace UK, 14 Nov 2026: every product last updated 31 Jul 2026, lessons L60, L145).
        if (/^\d{4}-\d{2}-\d{2}/.test(row.last_updated) && row.last_updated > (D.newest || '')) D.newest = row.last_updated.slice(0, 10);
      }
      await out.drain();
      // Never the same products again and again (lessons L145): a page with nothing new, or more products than the
      // feed says it has, stops this programme with an error and its file is not used.
      if (found.length && !fresh) { D.error = `page ${page} gave only products already read (the feed does not move on)`; break; }
      const limit = Math.max(Number(D.total) || 0, Number(f.products) || 0);
      if (limit && D.got > limit * 1.2 + 100) { D.error = `more products (${D.got}) than the feed says it has (${limit})`; break; }
      if (maxProducts > 0 && D.got > maxProducts) { D.error = `more than the ${maxProducts} products allowed (-MaxProducts): not used`; D.tooBig = true; break; }
      const next = nextPage(r.next, url);
      if (r.next && !next) { D.error = `the next page address is not on daisycon.io: ${addressShape(r.next)}`; break; }
      url = next;
      if (url && pauseMs) await sleep(Math.min(pauseMs, 1000));
    }
  } finally {
    await out.close();
  }
  D.currencies = [...currencies];
  if (!D.error && !D.got) D.error = 'no products';
  if (!D.error) D.ok = true;
}

// The renewed sign-in key of this run, for the crash answer below.
let renewed = '';
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
  renewed = S.newRefresh;
  const pause = Number(arg(argv, 'pause') ?? API_PAUSE_MS);
  const currency = String(arg(argv, 'currency') || '').toUpperCase();
  const country = String(arg(argv, 'country') || '').toUpperCase();
  const maxProducts = Number(arg(argv, 'max-products') || 0);
  if (currency && !/^[A-Z]{3}$/.test(currency)) return { ...S, ok: false, error: 'wrong currency (three letters, e.g. GBP)' };
  if (country && !country.split(',').every(c => /^[A-Z]{2}$/.test(c))) return { ...S, ok: false, error: 'wrong country (two letters, e.g. GB, or a list GB,US,PL)' };
  if (!Number.isInteger(maxProducts) || maxProducts < 0) return { ...S, ok: false, error: 'wrong --max-products' };
  // The renewed sign-in must reach the PowerShell tool whatever happens next: Daisycon gives a new key at each sign-in
  // and the old one stops working (first real run, 14 Nov 2026: an error here lost it, lessons L145).
  try {
    if (mode === 'probe') Object.assign(S, await probe({ access: t.access, mediaId, programs, services, fetchImpl, pauseMs: pause, currency, country }));
    else {
      const out = arg(argv, 'out');
      if (!out) return { ...S, error: 'no output folder' };
      Object.assign(S, await download({ access: t.access, mediaId, programs, out, services, fetchImpl, pauseMs: pause, currency, country, maxProducts }));
    }
  } catch (e) { S.error = `unexpected: ${String(e && e.message || e).slice(0, 200)}`; }
  S.ok = !S.error;
  return S;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  // A crash still answers the PowerShell tool in one JSON line (14 Nov 2026 it got nothing at all, lessons L145).
  process.on('uncaughtException', e => { console.log(JSON.stringify({ ok: false, error: `crash: ${String(e && e.message || e).slice(0, 300)}`, newRefresh: renewed })); process.exit(1); });
  main().then(S => { console.log(JSON.stringify(S)); }, e => { console.log(JSON.stringify({ ok: false, error: String(e && e.message || e).slice(0, 300) })); });
}
