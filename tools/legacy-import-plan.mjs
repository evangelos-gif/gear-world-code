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
          link, page, image: get('merchant_image_url') || get('large_image') || get('aw_image_url'), firstVariant: get('merchant_product_id'),
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

export async function planLegacyImport({ archive, retailer, outDir, now = new Date() }) {
  const rules = await loadRules(retailer);
  const R = rules.RULES;
  const read = await readProducts({ archive, rules });
  const { files, rows } = read;
  // rules.RULES.joinSameName: options of one product page with the SAME name (e.g. two sizes of "Director Chair Covers")
  // become one card with the lowest in-stock price. Options with different names (colours, sets) stay separate cards.
  const products = R.joinSameName ? joinSameName(read.products) : read.products;
  const markers = {};
  for (const s of R.sites) markers[s] = await foreignMarkersFor(s);
  const accepted = Object.fromEntries(R.sites.map(s => [s, []]));
  const rejected = {};
  const reject = (p, why) => { (rejected[why] ||= []).push(p); };
  for (const p of products) {
    if (!p.name) { reject(p, 'no product name'); continue; }
    if (!p.inStockVariants && !p.unknownStock) { reject(p, 'out of stock in every size'); continue; }
    if (!p.prices.length) { reject(p, 'no price'); continue; }
    const price = Math.min(...p.prices);
    if (price > R.maxPrice) { reject(p, `price above £${R.maxPrice} (looks wrong)`); continue; }
    if (!/^https:\/\//i.test(p.image || '')) { reject(p, 'no image'); continue; }
    if (!R.shop.test(p.link || '')) { reject(p, `link is not the shop's own page (${hostOf(p.link) || 'no link'})`); continue; }
    if (p.currency && p.currency !== R.currency) { reject(p, `currency ${p.currency}, expected ${R.currency}`); continue; }
    const c = rules.classify({ name: p.name, feedCategory: p.feedCategory, awinCategory: p.awinCategory, url: p.link, brand: p.brand });
    if (c.reject) { reject(p, c.reject); continue; }
    if (!accepted[c.site]) { reject(p, `site ${c.site} is not in the plan`); continue; }
    const name = rules.displayName ? rules.displayName(p.name) : p.name;
    const hit = markerHit(name, markers[c.site]);
    if (hit) { reject(p, `name has text that belongs to another site ("${hit}")`); continue; }
    accepted[c.site].push({
      awin_product_id: `${R.advertiserId}:${p.key.replace(/^https?:\/\/[^/]+\/products\//i, '')}`,
      // On KGW/HGW/GGW the merchant id is the unique key, so it must be the same on every run: the product key
      // (e.g. the Shopify handle), not the first size of the feed.
      merchant_product_id: STABLE_KEY_SITES.has(c.site)
        ? (p.key.startsWith('http') ? (p.key.replace(/^https?:\/\/[^/]+\/products\//i, '').replace(/^https?:.*/i, '') || p.firstVariant) : p.key)
        : (p.key.startsWith('http') ? p.firstVariant : p.key),
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
  const text = renderPlan({ R, files, rows, products, accepted, rejected, sqlFiles, now });
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
// its category and subcategory (only new products get the category of these rules).
export function insertSql(items, stamp, opts = {}) {
  const values = items.map(p => '(' + [p.awin_product_id, p.merchant_product_id, p.retailer, p.site_category, p.subcategory, p.brand, p.product_name,
    p.feed_product_name, p.price, p.currency, p.stock_status, p.merchant_category, p.image_url, p.affiliate_url, p.ean, 1, stamp, stamp].map(q).join(', ') + ')');
  const stable = STABLE_KEY_SITES.has(String(opts.site || ''));
  const skip = ['awin_product_id', 'retailer', 'created_at'].concat(stable ? ['merchant_product_id'] : [], opts.keepCategory ? ['site_category', 'subcategory'] : []);
  const update = COLS.filter(c => !skip.includes(c)).map(c => `${c}=excluded.${c}`).join(', ');
  const target = stable ? "(retailer, merchant_product_id) WHERE merchant_product_id IS NOT NULL AND TRIM(merchant_product_id) <> ''" : '(awin_product_id)';
  return `INSERT INTO products (${COLS.join(', ')}) VALUES\n${values.join(',\n')}\nON CONFLICT${target} DO UPDATE SET ${update};\n`;
}

function writeSql(dir, items, R, site, now) {
  mkdirSync(dir, { recursive: true });
  const stamp = now.toISOString().slice(0, 19).replace('T', ' ');
  const out = [];
  for (let i = 0, n = 1; i < items.length; i += ROWS_PER_FILE, n++) {
    const part = items.slice(i, i + ROWS_PER_FILE);
    let sql = `-- PLAN ONLY. NOT EXECUTED. ${R.retailer} (Awin ${R.advertiserId}) -> ${site.toUpperCase()}, part ${n}, ${part.length} products, ${stamp} UTC.\n` +
      '-- Adds new products and updates the same products on a later run (same awin_product_id). Deletes nothing.\n';
    for (let j = 0; j < part.length; j += ROWS_PER_INSERT) sql += insertSql(part.slice(j, j + ROWS_PER_INSERT), stamp, { site, keepCategory: R.keepCategory });
    const file = join(dir, String(n).padStart(4, '0') + '.sql');
    writeFileSync(file, sql);
    out.push(file);
  }
  // The products this run keeps on the site (a refresh hides the retailer's other products: sold out or gone).
  writeFileSync(join(dir, 'ids.txt'), items.map(p => p.awin_product_id).join('\n') + (items.length ? '\n' : ''));
  return out;
}

function renderPlan({ R, files, rows, products, accepted, rejected, sqlFiles, now }) {
  const fmt = n => new Intl.NumberFormat('en-GB').format(n);
  const total = Object.values(accepted).reduce((a, l) => a + l.length, 0);
  const L = [`IMPORT PLAN (read-only, nothing executed) ${R.retailer} - Awin ${R.advertiserId} - ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    `Feed files: ${files.join(', ') || 'none found'}`,
    `Feed rows: ${fmt(rows)} (one row per size) -> ${fmt(products.length)} products -> ${fmt(total)} would be imported, ${fmt(products.length - total)} left out`, ''];
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
