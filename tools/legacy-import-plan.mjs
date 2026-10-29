#!/usr/bin/env node
// Import PLAN for a new retailer on the older Gear World sites (MGW, WGW, ...), which keep the database
// layout written by the Hub import router. READ-ONLY: it reads the Awin feed on this PC and writes a report
// plus the SQL that an import WOULD run. Nothing is sent to any database (lessons L14, L19).
//
// Usage: node tools/legacy-import-plan.mjs --archive <dir> --retailer coes --out <dir>
import { createReadStream, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { basename, join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readCsvRecords, cleanText, parsePrice } from './tgw-import-plan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const AWIN_PUBLISHER_ID = 3057233;
const ROWS_PER_INSERT = 80;   // keeps every statement well under the D1 limit of 100 KB
const ROWS_PER_FILE = 1000;
// KGW, HGW and GGW keep products with no UNIQUE on awin_product_id: there the unique key is (retailer, merchant_product_id)
// for a non-empty merchant id (index ux_products_refresh_stable_key, checked on the live databases 21 Oct 2026).
// MGW and WGW have awin_product_id UNIQUE. The SQL must name the key the table really has.
export const STABLE_KEY_SITES = new Set(['kgw', 'hgw', 'ggw']);

export async function loadRules(key) {
  if (!/^[a-z0-9-]{2,40}$/.test(String(key || ''))) throw new Error('bad retailer key');
  return import(pathToFileURL(join(HERE, 'import-rules', `${key}.mjs`)).href);
}

async function foreignMarkersFor(site) {
  try {
    const mod = await import(pathToFileURL(join(HERE, '..', 'sites', site, 'site.config.js')).href);
    const cfg = mod.default || mod.SITE || mod.site || {};
    const own = String(site).toUpperCase();
    return (cfg.foreignMarkers || []).filter(m => m !== own);
  } catch { return []; }
}

const markerHit = (text, markers) => markers.find(mk => (/^[A-Z]{3}$/.test(mk)
  ? new RegExp(`\\b${mk}\\b`) : new RegExp('(?<![A-Za-z])' + mk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).test(text));

function productPage(url) {
  try { const u = new URL(url); return `${u.origin}${u.pathname}`; } catch { return ''; }
}

// The in_stock column of an Awin feed: true (in stock), false (sold out) or null (not given or not readable).
export function stockFlag(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  if (/^(yes|y|true|in stock|in_stock|instock|available|limited stock|limited_stock)$/.test(s)) return true;
  if (/^(no|n|false|out of stock|out_of_stock|outofstock|sold out|discontinued)$/.test(s)) return false;
  return null;
}

// The product picture (lessons L38). Awin fills aw_image_url with a placeholder ("images2.productserve.com/noimage.gif")
// when the shop sends none, and with a 200x200 resize proxy ("images2.productserve.com/?w=200&...&url=ssl:cdn.shopify.com/...")
// otherwise. The plan takes the first real picture of the shop's own columns, unwraps the proxy to the full-size image and
// never takes the placeholder: a product without a picture is left out ("no image").
const IMAGE_COLUMNS = ['merchant_image_url', 'large_image', 'alternate_image', 'alternate_image_two', 'alternate_image_three', 'alternate_image_four',
  'merchant_thumb_url', 'aw_image_url', 'aw_thumb_url', 'image_link'];
export function realImage(raw) {
  let u = String(raw || '').trim();
  if (!u) return '';
  let parsed;
  try { parsed = new URL(u); } catch { return ''; }
  if (/(^|\.)productserve\.com$/i.test(parsed.hostname)) {
    if (/noimage/i.test(parsed.pathname)) return '';
    const inner = parsed.searchParams.get('url') || '';
    if (!inner) return '';
    u = inner.replace(/^ssl:/i, 'https://').replace(/^http:/i, 'https:');
    if (!/^https:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
    try { parsed = new URL(u); } catch { return ''; }
  }
  if (parsed.protocol !== 'https:' || /noimage|no-image|placeholder/i.test(parsed.pathname)) return '';
  return parsed.toString();
}
export function pickImage(get) {
  for (const c of IMAGE_COLUMNS) { const u = realImage(get(c)); if (u) return u; }
  return '';
}

// Read the feed and join the rows of one product (one row per size) into one product.
// A shop's rules may say where its feed is (rules.feedFiles: full paths, e.g. a Google-format feed saved in Downloads)
// and how its columns map to the Awin names used below (rules.field). Without them: AWIN_<id>_<feed>.csv(.gz) in the archive.
export function feedPaths({ archive, rules }) {
  if (typeof rules.feedFiles === 'function') return rules.feedFiles(archive).filter(f => existsSync(f)).sort();
  return readdirSync(archive).filter(f => new RegExp(`^AWIN_${rules.RULES.advertiserId}_\\d+\\.csv(\\.gz)?$`, 'i').test(f)).sort().map(f => join(archive, f));
}

export async function readProducts({ archive, rules }) {
  const paths = feedPaths({ archive, rules });
  const files = paths.map(f => basename(f));
  const groups = new Map();
  let rows = 0;
  for (const f of paths) {
    const raw = createReadStream(f);
    const stream = /\.gz$/i.test(f) ? raw.pipe(createGunzip()) : raw;
    let h = null;
    for await (const rec of readCsvRecords(stream)) {
      if (!h) { h = rec.map(x => String(x).trim().toLowerCase().replace(/^﻿/, '')); continue; }
      if (rec.length < 3) continue;
      rows++;
      const column = c => { const i = h.indexOf(c); return i >= 0 ? String(rec[i] ?? '').trim() : ''; };
      const get = typeof rules.field === 'function' ? (c => String(rules.field(c, column) ?? '').trim()) : column;
      const link = get('merchant_deep_link');
      const page = productPage(link);
      // A shop's rules can choose the product id (e.g. the id an older import already used for the same products).
      const key = (typeof rules.productKey === 'function' && rules.productKey(get)) || get('parent_product_id') || page || get('merchant_product_id') || get('aw_product_id');
      if (!key) continue;
      const qtyRaw = get('stock_quantity');
      let qty = qtyRaw === '' ? null : Number(qtyRaw);
      // Many Awin feeds give the stock only as in_stock (1/0) and leave stock_quantity empty (lessons L37).
      if (qty === null || !Number.isFinite(qty)) { const flag = stockFlag(get('in_stock')); if (flag !== null) qty = flag ? 1 : 0; }
      const price = parsePrice(get('search_price') || get('store_price'));
      let g = groups.get(key);
      if (!g) {
        g = { key, name: cleanText(get('product_name')), brand: cleanText(get('brand_name')), feedCategory: cleanText(get('merchant_category')),
          awinCategory: cleanText(get('category_name')),
          link, page, image: pickImage(get), firstVariant: get('merchant_product_id'),
          variants: 0, inStockVariants: 0, unknownStock: 0, prices: [], currency: get('currency').toUpperCase(), ean: get('ean') || get('product_gtin') };
        groups.set(key, g);
      }
      g.variants++;
      if (qty === null || !Number.isFinite(qty)) g.unknownStock++;
      else if (qty > 0) g.inStockVariants++;
      if (Number.isFinite(price) && price > 0 && (qty === null || !Number.isFinite(qty) || qty > 0)) g.prices.push(price);
    }
  }
  return { files, rows, products: [...groups.values()] };
}

const hostOf = url => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };

export function joinSameName(products) {
  const byName = new Map();
  const out = [];
  for (const p of products) {
    const k = `${p.page || ''}|${String(p.name || '').toLowerCase()}`;
    const first = p.page && p.name ? byName.get(k) : null;
    if (!first) { if (p.page && p.name) byName.set(k, p); out.push(p); continue; }
    first.variants += p.variants;
    first.inStockVariants += p.inStockVariants;
    first.unknownStock += p.unknownStock;
    first.prices.push(...p.prices);
    if (!first.ean && p.ean) first.ean = p.ean;
  }
  return out;
}

// rules.RULES.shopifyImages (lessons L38): for a product whose feed has no picture, the plan reads the shop's own public
// Shopify product data (https://<shop>/products/<handle>.js, the same page the "View at" button opens) and takes the
// picture of that option (the feed's merchant_product_id is the Shopify variant id), else the product's main picture.
// Read-only: one GET per product page, at most 400 per plan, one at a time with a short pause. No answer: no picture.
export async function fillShopifyImages(products, R, { fetchImpl = globalThis.fetch, pauseMs = 250, max = 400 } = {}) {
  const pages = new Map();
  let asked = 0, filled = 0;
  for (const p of products) {
    if (p.image || !p.page || !R.shop.test(p.page)) continue;
    const m = /^(https:\/\/[^/]+)\/products\/([a-z0-9][a-z0-9-]{0,200})$/i.exec(p.page);
    if (!m) continue;
    const url = `${m[1]}/products/${m[2].toLowerCase()}.js`;
    if (!pages.has(url)) {
      if (asked >= max || typeof fetchImpl !== 'function') { pages.set(url, null); continue; }
      asked++;
      if (asked > 1 && pauseMs) await new Promise(r => setTimeout(r, pauseMs));
      let data = null;
      try {
        const res = await fetchImpl(url, { headers: { accept: 'application/json', 'user-agent': 'GearWorldImportPlan/1.0' }, signal: AbortSignal.timeout(15000) });
        if (res && res.ok) data = await res.json();
      } catch { data = null; }
      pages.set(url, data);
    }
    const d = pages.get(url);
    if (!d) continue;
    // The option of this card: the ?variant= id of the feed's link, else the SKU (Gardenista's merchant_product_id, e.g.
    // "LGP3 Harvest Green"), else the variant id (Mint Outdoor's merchant_product_id).
    const linkVariant = (/[?&]variant=(\d+)/.exec(String(p.link || '')) || [])[1] || '';
    const same = (a, b) => String(a ?? '').trim() !== '' && String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
    const vs = d.variants || [];
    const variant = (linkVariant && vs.find(v => same(v.id, linkVariant))) || vs.find(v => same(v.sku, p.firstVariant)) || vs.find(v => same(v.id, p.firstVariant));
    const pick = v => (v && typeof v === 'object' ? v.src : v) || '';
    const abs = u => (String(u || '').startsWith('//') ? 'https:' + u : String(u || ''));
    const img = realImage(abs(pick(variant && variant.featured_image))) || realImage(abs(pick(d.featured_image))) || realImage(abs(pick((d.images || [])[0])));
    if (img) { p.image = img; filled++; }
  }
  return { asked, filled };
}

// Shopify shops (rules.RULES.shopifyCheck + shopOrigin, lessons L39). An Awin feed can be months behind the shop: on
// 23 Oct 2026, 56 Gardenista cards on GGW came from an old feed (gardenista-store.myshopify.com links, the product id
// as ?variant=, deleted pictures) and some pages were gone (404), so the cards had broken pictures and links that did not
// open the product. The plan reads the shop's live catalogue (read-only, /products.json, 250 products a page) and:
//  - leaves out a product whose page is not on the shop any more, or whose every option is sold out there;
//  - takes the shop's current picture of that option (a feed picture can be a deleted file);
//  - links to the shop's own address (shopOrigin) with the real ?variant= id of that option;
//  - leaves out a second card for the same page and option (an older feed's copy).
// If the catalogue cannot be read, the plan stops (nothing changes) instead of importing unchecked products.
export async function readShopifyCatalog(origin, { fetchImpl = globalThis.fetch, pauseMs = 300, maxPages = 40 } = {}) {
  const base = String(origin || '').replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(base)) throw new Error(`shopOrigin is not a shop address: ${origin}`);
  if (typeof fetchImpl !== 'function') throw new Error(`Cannot read ${base}: this Node.js has no fetch. Nothing was changed.`);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const byHandle = new Map();
  for (let page = 1; page <= maxPages; page++) {
    if (page > 1 && pauseMs) await sleep(pauseMs);
    const url = `${base}/products.json?limit=250&page=${page}`;
    let data = null, status = 0;
    for (let attempt = 1; attempt <= 3 && !data; attempt++) {
      if (attempt > 1 && pauseMs) await sleep(pauseMs * 5);
      try {
        const res = await fetchImpl(url, { headers: { accept: 'application/json', 'user-agent': 'GearWorldImportPlan/1.0' }, signal: AbortSignal.timeout(20000) });
        status = (res && res.status) || 0;
        if (res && res.ok) { const d = await res.json(); if (d && Array.isArray(d.products)) data = d; }
      } catch { data = null; }
    }
    // The HTTP status tells "slow down" (429, Shopify answers it for every shop to the same PC) from "down" (5xx).
    if (!data) throw new Error(`Could not read the shop's live catalogue (${url}${status ? `, HTTP ${status}` : ''}). Nothing was changed; try again later.`);
    for (const p of data.products) if (p && p.handle) byHandle.set(String(p.handle).toLowerCase(), p);
    if (data.products.length < 250) break;
    if (page === maxPages) throw new Error(`The shop's live catalogue (${base}) has more than ${maxPages * 250} products: too big for this check. Nothing was changed.`);
  }
  if (!byHandle.size) throw new Error(`The shop's live catalogue (${base}) is empty. Nothing was changed.`);
  return byHandle;
}

export function checkShopify(products, R, catalog) {
  const origin = String(R.shopOrigin || '').replace(/\/+$/, '');
  const st = { origin, live: catalog.size, checked: 0, gone: 0, soldOut: 0, duplicates: 0, pictures: 0, links: 0 };
  const same = (a, b) => String(a ?? '').trim() !== '' && String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  const abs = u => (String(u || '').startsWith('//') ? 'https:' + u : String(u || ''));
  const src = v => (v && typeof v === 'object' ? v.src : v) || '';
  const found = [];
  for (const p of products) {
    if (!p.page || !R.shop.test(p.page)) continue;
    const m = /^https:\/\/[^/]+\/products\/([^/?#]+)\/?$/i.exec(p.page);
    if (!m) continue;
    st.checked++;
    let handle;
    try { handle = decodeURIComponent(m[1]).toLowerCase(); } catch { handle = m[1].toLowerCase(); }
    const lp = catalog.get(handle);
    if (!lp) { p.shopCheck = 'gone'; st.gone++; continue; }
    const vs = Array.isArray(lp.variants) ? lp.variants.filter(Boolean) : [];
    if (!vs.some(v => v.available === true)) { p.shopCheck = 'soldOut'; st.soldOut++; continue; }
    // The option of this card: the ?variant= id of the feed's link, else the SKU, else the variant id.
    const linkVariant = (/[?&]variant=(\d+)/.exec(String(p.link || '')) || [])[1] || '';
    const variant = (linkVariant && vs.find(v => same(v.id, linkVariant))) || vs.find(v => same(v.sku, p.firstVariant)) || vs.find(v => same(v.id, p.firstVariant)) || null;
    // That option sold out on the shop (others not): the link opens the page without ?variant=, so the shop shows an
    // option that can be bought, and the card shows that option's picture.
    const shown = variant && variant.available === true ? variant : (variant ? vs.find(v => v.available === true) : null);
    const imgs = Array.isArray(lp.images) ? lp.images.filter(Boolean) : [];
    const ofVariant = shown ? imgs.find(i => Array.isArray(i.variant_ids) && i.variant_ids.some(id => same(id, shown.id))) : null;
    const pic = realImage(abs(src(shown && shown.featured_image))) || realImage(abs(src(ofVariant))) || realImage(abs(src(imgs[0])));
    const newPicture = Boolean(pic) && pic !== p.image;
    p.image = pic; // '' when the shop shows no picture either: the product is left out ("no image")
    const page = `${origin}/products/${encodeURIComponent(String(lp.handle))}`;
    // R.pageLink: one card covers every size (clothing), so the link opens the page, not one size.
    const link = !R.pageLink && variant && variant === shown ? `${page}?variant=${variant.id}` : page;
    const newLink = link !== p.link;
    p.page = page;
    p.link = link;
    // The shop's own product type and tags ("Trainers", "Men's", "Womens") help the rules place the product.
    p.shopType = String(lp.product_type || '').trim();
    p.shopTags = (Array.isArray(lp.tags) ? lp.tags : String(lp.tags || '').split(',')).map(t => String(t).trim()).filter(Boolean);
    p.shopHandle = handle;
    p.shopVariant = variant ? String(variant.id) : '';
    found.push({ p, newPicture, newLink });
  }
  // An older feed's copy: no real option of its own while another card has one, or the same page and option twice.
  const hasOption = new Set(found.filter(f => f.p.shopVariant).map(f => f.p.shopHandle));
  const seen = new Set();
  for (const { p, newPicture, newLink } of found) {
    const k = `${p.shopHandle}|${p.shopVariant}`;
    if ((!p.shopVariant && hasOption.has(p.shopHandle)) || seen.has(k)) { p.shopCheck = 'duplicate'; st.duplicates++; continue; }
    seen.add(k);
    if (newPicture) st.pictures++;
    if (newLink) st.links++;
  }
  return st;
}

export async function planLegacyImport({ archive, retailer, outDir, now = new Date(), fetchImpl }) {
  const rules = await loadRules(retailer);
  const R = rules.RULES;
  const read = await readProducts({ archive, rules });
  const { files, rows } = read;
  // rules.RULES.joinSameName: options of one product page with the SAME name (e.g. two sizes of "Director Chair Covers")
  // become one card with the lowest in-stock price. Options with different names (colours, sets) stay separate cards.
  const products = R.joinSameName ? joinSameName(read.products) : read.products;
  let shopImages = null, shopCheck = null;
  if (R.shopifyCheck) shopCheck = checkShopify(products, R, await readShopifyCatalog(R.shopOrigin, fetchImpl ? { fetchImpl, pauseMs: 0 } : {}));
  else if (R.shopifyImages) shopImages = await fillShopifyImages(products, R, fetchImpl ? { fetchImpl, pauseMs: 0 } : {});
  const markers = {};
  for (const s of R.sites) markers[s] = await foreignMarkersFor(s);
  const accepted = Object.fromEntries(R.sites.map(s => [s, []]));
  const rejected = {};
  const reject = (p, why) => { (rejected[why] ||= []).push(p); };
  // One card per product number and site: the sites have a unique key on (retailer, merchant_product_id) (CGW too), and
  // one SGS product came in both feeds with two different links (import of 29 Oct 2026 stopped at file 0002, L85).
  const takenIds = new Set();
  for (const p of products) {
    if (!p.name) { reject(p, 'no product name'); continue; }
    if (p.shopCheck === 'gone') { reject(p, "not on the shop's site any more (page not found)"); continue; }
    if (p.shopCheck === 'soldOut') { reject(p, "sold out on the shop's site"); continue; }
    if (p.shopCheck === 'duplicate') { reject(p, 'the same shop product twice in the feeds (older copy)'); continue; }
    if (!p.inStockVariants && !p.unknownStock) { reject(p, 'out of stock in every size'); continue; }
    if (!p.prices.length) { reject(p, 'no price'); continue; }
    const price = Math.min(...p.prices);
    if (price > R.maxPrice) { reject(p, `price above £${R.maxPrice} (looks wrong)`); continue; }
    if (R.minPrice && price < R.minPrice) { reject(p, `price under £${R.minPrice} (too small to list)`); continue; }
    if (!/^https:\/\//i.test(p.image || '')) { reject(p, 'no image'); continue; }
    if (!R.shop.test(p.link || '')) { reject(p, `link is not the shop's own page (${hostOf(p.link) || 'no link'})`); continue; }
    if (p.currency && p.currency !== R.currency) { reject(p, `currency ${p.currency}, expected ${R.currency}`); continue; }
    const c = rules.classify({ name: p.name, feedCategory: p.feedCategory, awinCategory: p.awinCategory, url: p.link, brand: p.brand,
      shopType: p.shopType || '', shopTags: p.shopTags || [] });
    if (c.reject) { reject(p, c.reject); continue; }
    if (!accepted[c.site]) { reject(p, `site ${c.site} is not in the plan`); continue; }
    // The rules may give a better card name (e.g. a shaker called only "Pink" in the feed).
    const name = c.name || (rules.displayName ? rules.displayName(p.name) : p.name);
    const hit = markerHit(name, markers[c.site]);
    if (hit) { reject(p, `name has text that belongs to another site ("${hit}")`); continue; }
    // On KGW/HGW/GGW the merchant id is the unique key, so it must be the same on every run: the product key
    // (e.g. the Shopify handle), not the first size of the feed.
    const merchantId = STABLE_KEY_SITES.has(c.site)
      ? (p.key.startsWith('http') ? (p.key.replace(/^https?:\/\/[^/]+\/products\//i, '').replace(/^https?:.*/i, '') || p.firstVariant) : p.key)
      : (p.key.startsWith('http') ? p.firstVariant : p.key);
    const taken = `${c.site}|${String(merchantId || '').trim()}`;
    if (String(merchantId || '').trim() && takenIds.has(taken)) { reject(p, 'the same product number twice in the feeds (another link): kept once'); continue; }
    takenIds.add(taken);
    accepted[c.site].push({
      awin_product_id: `${R.advertiserId}:${p.key.replace(/^https?:\/\/[^/]+\/products\//i, '')}`,
      merchant_product_id: merchantId,
      retailer: R.retailer, site_category: c.siteCategory, subcategory: c.subcategory, brand: p.brand || null,
      product_name: name, feed_product_name: p.name, price, currency: R.currency, stock_status: 'in stock',
      merchant_category: p.feedCategory || null, image_url: p.image,
      affiliate_url: `https://www.awin1.com/cread.php?awinmid=${R.advertiserId}&awinaffid=${AWIN_PUBLISHER_ID}&ued=${encodeURIComponent(R.keepQuery ? (p.link || p.page) : (p.page || p.link))}`,
      ean: /^\d{8,14}$/.test(p.ean || '') ? p.ean : null, variants: p.variants,
      // Placed only because of the feed category (no clear word in the name): listed in the report for checking.
      doubt: Boolean(c.doubt)
    });
  }
  mkdirSync(outDir, { recursive: true });
  const sqlFiles = {};
  for (const s of R.sites) sqlFiles[s] = writeSql(join(outDir, 'sql', s), accepted[s], R, s, now);
  const text = renderPlan({ R, files, rows, products, accepted, rejected, sqlFiles, now, shopImages, shopCheck });
  writeFileSync(join(outDir, 'report.txt'), text);
  // For the import tool: how many products each site should have from this retailer after the import.
  // addOnly: the plan covers only part of a shop that is already on the site, so the import must not hide the rest.
  const summary = { retailer: R.retailer, advertiserId: R.advertiserId, addOnly: Boolean(R.addOnly), sites: {} };
  for (const s of R.sites) {
    const byCat = {};
    for (const p of accepted[s]) byCat[p.site_category] = (byCat[p.site_category] || 0) + 1;
    summary.sites[s] = { products: accepted[s].length, files: sqlFiles[s].length, byCategory: byCat };
  }
  writeFileSync(join(outDir, 'plan.json'), JSON.stringify(summary, null, 2));
  return { files, rows, products: products.length, accepted, rejected, text };
}

const q = v => (v === null || v === undefined) ? 'NULL' : (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const COLS = ['awin_product_id', 'merchant_product_id', 'retailer', 'site_category', 'subcategory', 'brand', 'product_name', 'feed_product_name',
  'price', 'currency', 'stock_status', 'merchant_category', 'image_url', 'affiliate_url', 'ean', 'is_active', 'created_at', 'updated_at'];

// opts.site: which unique key the table has (STABLE_KEY_SITES). opts.keepCategory: a product already on the site keeps
// its category and subcategory (only new products get the category of these rules). opts.replace: subcategory names an
// earlier plan wrote that the site does not use (lessons L56): a product already on the site with one of them gets the
// plan's category and subcategory; every other product keeps its own.
export function insertSql(items, stamp, opts = {}) {
  const values = items.map(p => '(' + [p.awin_product_id, p.merchant_product_id, p.retailer, p.site_category, p.subcategory, p.brand, p.product_name,
    p.feed_product_name, p.price, p.currency, p.stock_status, p.merchant_category, p.image_url, p.affiliate_url, p.ean, 1, stamp, stamp].map(q).join(', ') + ')');
  const stable = STABLE_KEY_SITES.has(String(opts.site || ''));
  const skip = ['awin_product_id', 'retailer', 'created_at'].concat(stable ? ['merchant_product_id'] : [], opts.keepCategory ? ['site_category', 'subcategory'] : []);
  const sets = COLS.filter(c => !skip.includes(c)).map(c => `${c}=excluded.${c}`);
  const replace = (opts.keepCategory && Array.isArray(opts.replace)) ? opts.replace.filter(Boolean) : [];
  if (replace.length) {
    const list = replace.map(q).join(', ');
    // SQLite reads products.<column> as the row's value BEFORE this update, so both lines test the old subcategory.
    sets.push(`site_category=CASE WHEN products.subcategory IN (${list}) THEN excluded.site_category ELSE products.site_category END`,
      `subcategory=CASE WHEN products.subcategory IN (${list}) THEN excluded.subcategory ELSE products.subcategory END`);
  }
  const update = sets.join(', ');
  const target = stable ? "(retailer, merchant_product_id) WHERE merchant_product_id IS NOT NULL AND TRIM(merchant_product_id) <> ''" : '(awin_product_id)';
  return `INSERT INTO products (${COLS.join(', ')}) VALUES\n${values.join(',\n')}\nON CONFLICT${target} DO UPDATE SET ${update};\n`;
}

function writeSql(dir, items, R, site, now) {
  mkdirSync(dir, { recursive: true });
  const replace = (R.keepCategory && R.replaceSubcategories && R.replaceSubcategories[site]) || [];
  const stamp = now.toISOString().slice(0, 19).replace('T', ' ');
  const out = [];
  for (let i = 0, n = 1; i < items.length; i += ROWS_PER_FILE, n++) {
    const part = items.slice(i, i + ROWS_PER_FILE);
    let sql = `-- PLAN ONLY. NOT EXECUTED. ${R.retailer} (Awin ${R.advertiserId}) -> ${site.toUpperCase()}, part ${n}, ${part.length} products, ${stamp} UTC.\n` +
      '-- Adds new products and updates the same products on a later run (same awin_product_id). Deletes nothing.\n';
    for (let j = 0; j < part.length; j += ROWS_PER_INSERT) sql += insertSql(part.slice(j, j + ROWS_PER_INSERT), stamp, { site, keepCategory: R.keepCategory, replace });
    const file = join(dir, String(n).padStart(4, '0') + '.sql');
    writeFileSync(file, sql);
    out.push(file);
  }
  // The products this run keeps on the site (a refresh hides the retailer's other products: sold out or gone).
  writeFileSync(join(dir, 'ids.txt'), items.map(p => p.awin_product_id).join('\n') + (items.length ? '\n' : ''));
  // The products with their planned place, for the comparison with the database (subcategory names, L56).
  writeFileSync(join(dir, 'places.json'), JSON.stringify({ replace, places: items.map(p => [p.awin_product_id, p.site_category, p.subcategory]) }));
  return out;
}

function renderPlan({ R, files, rows, products, accepted, rejected, sqlFiles, now, shopImages, shopCheck }) {
  const fmt = n => new Intl.NumberFormat('en-GB').format(n);
  const total = Object.values(accepted).reduce((a, l) => a + l.length, 0);
  const L = [`IMPORT PLAN (read-only, nothing executed) ${R.retailer} - Awin ${R.advertiserId} - ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    `Feed files: ${files.join(', ') || 'none found'}`,
    `Feed rows: ${fmt(rows)} (one row per size) -> ${fmt(products.length)} products -> ${fmt(total)} would be imported, ${fmt(products.length - total)} left out`,
    ...(shopImages ? [`Pictures from the shop's product pages (the feed has none): ${fmt(shopImages.filled)} products (${fmt(shopImages.asked)} pages read)`] : []),
    ...(shopCheck ? [`Checked on the shop's live site (${shopCheck.origin}, ${fmt(shopCheck.live)} products there): ${fmt(shopCheck.checked)} feed products checked, `
      + `${fmt(shopCheck.gone)} gone from the site, ${fmt(shopCheck.soldOut)} sold out there, ${fmt(shopCheck.duplicates)} older copies; `
      + `${fmt(shopCheck.pictures)} pictures and ${fmt(shopCheck.links)} links set to the shop's current ones`] : []), ''];
  for (const [site, list] of Object.entries(accepted)) {
    L.push(`== ${site.toUpperCase()}: ${fmt(list.length)} products (SQL files: ${sqlFiles[site].length}, not executed) ==`);
    const byCat = {};
    for (const p of list) ((byCat[p.site_category] ||= {})[p.subcategory] ||= []).push(p);
    for (const [cat, subs] of Object.entries(byCat).sort((a, b) => count(b[1]) - count(a[1]))) {
      L.push(`-- ${cat}: ${fmt(count(subs))} | ` + Object.entries(subs).sort((a, b) => b[1].length - a[1].length).map(([s, l]) => `${s} ${fmt(l.length)}`).join(', '));
      const all = Object.values(subs).flat();
      const prices = all.map(p => p.price).sort((a, b) => a - b);
      L.push(`   price £${prices[0]} to £${prices[prices.length - 1]}, middle £${prices[Math.floor(prices.length / 2)]}`);
      const subList = Object.entries(subs).sort((a, b) => b[1].length - a[1].length);
      // One category with several subcategories (e.g. Joybuy beauty): samples from every subcategory, not 20 from the largest.
      const picks = subList.length > 1 ? subList.flatMap(([, l]) => spread(l, Math.max(3, Math.min(8, Math.ceil(48 / subList.length))))) : spread(all, 20);
      for (const p of picks) L.push(`   - ${p.product_name} | ${p.brand || '-'} | £${p.price} | ${p.subcategory} | ${p.variants} option(s)`);
    }
    const doubtful = list.filter(p => p.doubt);
    if (doubtful.length) {
      L.push(`-- CHECK: ${fmt(doubtful.length)} placed only because of the feed category (no clear word in the name):`);
      for (const p of spread(doubtful, 40)) L.push(`   - ${p.product_name} | £${p.price} | ${p.merchant_category || '-'}`);
    }
    L.push('');
  }
  L.push('== LEFT OUT, by reason ==');
  for (const [why, list] of Object.entries(rejected).sort((a, b) => b[1].length - a[1].length)) {
    L.push(`-- ${fmt(list.length)}  ${why}`);
    for (const p of spread(list, /not sure|no men\/women/.test(why) ? 30 : 10)) L.push(`   - ${p.name} [${p.feedCategory || '-'}]`);
  }
  const all = Object.values(accepted).flat();
  const withEan = all.filter(p => p.ean).length;
  L.push('', 'Notes:',
    `- Prices are ${R.currency}. Each product shows its lowest in-stock size price.`,
    withEan ? `- ${fmt(withEan)} of ${fmt(all.length)} products have an EAN, so the same product from other retailers can be shown together.`
      : '- The feed has no EAN, so these products are not joined with the same product from other retailers.',
    ...(R.addOnly ? [`- Add-only plan: it covers only part of ${R.retailer}. Its other products on the site stay as they are; nothing is hidden.`] : []),
    '- Nothing was changed. An import needs a backup of the site database first and your approval phrase.');
  return L.join('\n') + '\n';
}

const count = subs => Object.values(subs).reduce((a, l) => a + l.length, 0);
function spread(list, n) {
  if (list.length <= n) return list;
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.floor(i * list.length / n)]);
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = resolve(val('archive') || '');
  const retailer = String(val('retailer') || '').toLowerCase();
  const out = resolve(val('out') || 'legacy-import-plan');
  if (!existsSync(archive) || !retailer) { console.error('Usage: --archive <dir> --retailer <key> --out <dir>'); process.exit(2); }
  const r = await planLegacyImport({ archive, retailer, outDir: out });
  if (!r.files.length) { console.error('No feed file for this retailer in the archive.'); process.exit(4); }
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(e => { console.error(e && e.message ? e.message : e); process.exit(1); });
