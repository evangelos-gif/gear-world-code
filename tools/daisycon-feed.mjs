// Daisycon product feeds (13 Nov 2026, lessons L128). Daisycon accepted Gear World for many European shops (Superdry EU,
// La Redoute NL/DE, Petit Bateau, My Little Darling Shop UK ...). Each approved programme has a product feed at
//   https://daisycon.io/datafeed/?media_id=<our media>&program_id=<programme>&standard_id=<n>&language_code=en&type=JSON...
// No key: the media id in the address is ours (the same one is in every Daisycon link of ours, "wi=").
// The feed's "standard" (the field set of the shop's product type) differs per programme and is not in the approval
// emails, so the read-only probe tries the standards one by one (one product per request) and keeps the first that
// answers with products. The download writes DAISYCON_<programme>.csv.gz with the Awin column names and the Daisycon
// tracking link in aw_deep_link, like CJ (lessons L86), so tools/legacy-import.ps1 imports it like any other feed.
// Command line (used by tools/daisycon-feed-download.ps1):
//   node tools/daisycon-feed.mjs --mode probe|download --media <id> --programs 16029,22318 [--standards 1,2,...] --out <dir>
import { createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FEED_COLUMNS, csvLine, isDaisyconLink, pageInLink } from './network-links.mjs';

export const FEED_HOST = 'daisycon.io';
export const PER_PAGE = 500;
export const MAX_PAGES = 200;            // 100,000 products for one programme at most
export const DEFAULT_STANDARDS = Array.from({ length: 60 }, (_, i) => i + 1);

export function feedUrl({ base = `https://${FEED_HOST}/datafeed/`, mediaId, programId, standardId, languageCode = 'en', page = 1, perPage = PER_PAGE }) {
  const q = new URLSearchParams({
    media_id: String(mediaId), program_id: String(programId), standard_id: String(standardId), language_code: languageCode,
    type: 'JSON', html_transform: 'none', rawdata: 'false', encoding: 'utf8', general: 'false', page: String(page), per_page: String(perPage)
  });
  return `${base}?${q}`;
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

async function getJson(url, fetchImpl) {
  let res;
  try { res = await fetchImpl(url, { headers: { accept: 'application/json' } }); } catch (e) { return { status: 0, error: String(e && e.message || e) }; }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, text: json ? '' : text.slice(0, 300) };
}

// Read-only: which standard gives products for each programme, with two samples. Nothing is written.
export async function probe({ mediaId, programs, standards = DEFAULT_STANDARDS, base, fetchImpl = fetch, pauseMs = 200 }) {
  const out = [];
  for (const programId of programs) {
    const P = { program: String(programId), ok: false, standard: null, tried: 0, firstAnswer: '', samples: [], keys: [] };
    for (const s of standards) {
      P.tried++;
      const r = await getJson(feedUrl({ base, mediaId, programId, standardId: s, page: 1, perPage: 2 }), fetchImpl);
      const found = r.json ? findProducts(r.json) : [];
      if (!P.firstAnswer) P.firstAnswer = `HTTP ${r.status}${r.error ? ` ${r.error}` : ''}${r.text ? ` ${r.text}` : ''}${r.json && !found.length ? ` ${JSON.stringify(r.json).slice(0, 300)}` : ''}`;
      if (found.length) {
        P.ok = true; P.standard = s;
        P.name = String((found[0].program && (found[0].program.name || found[0].program.program_name)) || '');
        P.keys = Object.keys(flatten(found[0].product)).slice(0, 60);
        P.samples = found.slice(0, 2).map(x => { const row = toFeedRow(x.product, { programId, program: x.program, mediaId }); return {
          name: row.product_name, price: row.search_price, currency: row.currency, stock: row.in_stock || row.stock_status, category: row.merchant_category,
          image: /^https:\/\//.test(row.merchant_image_url) ? 'yes' : (row.merchant_image_url ? 'not https' : 'no'), page: row.merchant_deep_link,
          tracking: row.aw_deep_link ? new URL(row.aw_deep_link).host : 'NONE' }; });
        break;
      }
      if (r.status === 0 || r.status >= 500) break;   // the feed server itself has a problem: do not hammer it
      if (pauseMs) await sleep(pauseMs);
    }
    out.push(P);
  }
  return out;
}

// Every product of one programme, page by page, written to <out>/DAISYCON_<programme>.csv.gz.part.
export async function download({ mediaId, programId, standardId, out, base, fetchImpl = fetch, pauseMs = 500 }) {
  const A = { program: String(programId), ok: false, got: 0, withTracking: 0, currencies: [], file: join(out, `DAISYCON_${programId}.csv.gz.part`), name: '' };
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await getJson(feedUrl({ base, mediaId, programId, standardId, page, perPage: PER_PAGE }), fetchImpl);
    if (!r.json) { A.error = `HTTP ${r.status} ${r.error || r.text || ''}`.trim(); return A; }
    const found = findProducts(r.json);
    for (const x of found) {
      const row = toFeedRow(x.product, { programId, program: x.program, mediaId });
      if (!A.name) A.name = row.merchant_name;
      rows.push(row);
    }
    if (found.length < PER_PAGE) break;
    if (page === MAX_PAGES) A.capped = true;
    if (pauseMs) await sleep(pauseMs);
  }
  A.got = rows.length;
  A.withTracking = rows.filter(x => x.aw_deep_link).length;
  A.currencies = [...new Set(rows.map(x => x.currency).filter(Boolean))];
  if (!rows.length) { A.error = 'no products'; return A; }
  await new Promise((resolve, reject) => {
    const gz = createGzip();
    const ws = createWriteStream(A.file);
    gz.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
    gz.write(csvLine(FEED_COLUMNS));
    for (const row of rows) gz.write(csvLine(FEED_COLUMNS.map(c => row[c])));
    gz.end();
  });
  A.ok = true;
  return A;
}

const arg = (argv, name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };

export async function main(argv = process.argv.slice(2), fetchImpl = fetch) {
  const mode = arg(argv, 'mode');
  const mediaId = String(arg(argv, 'media') || '');
  const programs = String(arg(argv, 'programs') || '').split(/[,\s]+/).filter(Boolean);
  const base = arg(argv, 'base');   // the tests' local fake server only
  const S = { mode, ok: false, media: mediaId, programs: [] };
  if (!/^\d{3,10}$/.test(mediaId)) { S.error = 'wrong media id'; return S; }
  if (!programs.length || programs.some(p => !/^\d{2,8}(:\d{1,3})?$/.test(p))) { S.error = 'wrong programme ids'; return S; }
  if (base && !/^http:\/\/127\.0\.0\.1:\d+\//.test(base)) { S.error = 'unexpected feed address'; return S; }
  if (mode === 'probe') {
    const st = arg(argv, 'standards');
    const standards = st ? st.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0) : DEFAULT_STANDARDS;
    S.programs = await probe({ mediaId, programs, standards, base, fetchImpl, pauseMs: Number(arg(argv, 'pause') ?? 200) });
    S.ok = true;
    return S;
  }
  if (mode === 'download') {
    const out = arg(argv, 'out');
    if (!out) { S.error = 'no output folder'; return S; }
    // "16029:3,22318:3" = programme:standard, from the probe.
    for (const p of programs) {
      const [programId, standardId] = p.includes(':') ? p.split(':') : [p, ''];
      if (!standardId) { S.programs.push({ program: programId, ok: false, error: 'no standard (probe first)' }); continue; }
      S.programs.push(await download({ mediaId, programId, standardId, out, base, fetchImpl, pauseMs: Number(arg(argv, 'pause') ?? 500) }));
    }
    S.ok = true;
    return S;
  }
  S.error = 'mode must be probe or download';
  return S;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(S => { console.log(JSON.stringify(S)); }, e => { console.log(JSON.stringify({ ok: false, error: String(e && e.message || e).slice(0, 300) })); });
}
