#!/usr/bin/env node
// Refresh PLAN for a retailer that is ALREADY on one of the older Gear World sites (CGW, MGW, WGW, KGW, HGW, GGW).
// READ-ONLY: it reads the retailer's Awin feed on this PC and the rows the site database has for it (given as
// wrangler output files), and writes the SQL a refresh WOULD run. Nothing is sent to any database.
//
//   - price, picture and stock of the products already on the site are set to the feed's values, only where they differ
//     (D1 bills every row and index entry written, even for an unchanged value);
//   - active products that are no longer in the feed are hidden (is_active = 0, nothing is deleted);
//   - hidden products stay hidden: a clean-up may have hidden them on purpose (one card per product, misfits...);
//   - a price that changes more than 3 times up or down is not changed but listed for a person to check;
//   - a feed whose products were last updated more than 30 days ago changes nothing (lessons L39: stale feeds); a feed
//     without that date (Reidl, Tooled Up) is judged by the date of its newest file on this PC;
//   - a feed that misses more than half of the active products hides nothing (more likely a broken download);
//   - the rows written in D1 are counted from the table's own indexes and triggers (lessons L49, L57, L59): 1 + one per
//     index holding the column + 2 per update trigger firing on it. Above the budget, the plan keeps the first changes
//     and leaves the rest for the next run.
//
//
// --from-shop (job 3, lessons L60): for a shop whose Awin feed stopped (Red Gorilla, Wavytalk and Gardenista since 15 May
// 2026) the source is the shop's own live Shopify catalogue (/products.json, read-only GETs; the shop address comes from the
// products' links). There a product sold out on the shop is hidden too (as at import, L39), and a price changes only when
// the shop sells in the currency of the site (/meta.json).
//
// node tools/legacy-refresh-plan.mjs --archive <dir> --retailer "<name on the site>" --rows <wrangler json> [--rows ...]
//   --indexes <wrangler json of sqlite_master> --out <dir> [--max-writes 90000] [--advertiser <id>] [--now <iso date>] [--from-shop]
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords, parsePrice } from './tgw-import-plan.mjs';
import { stockFlag, pickImage, realImage, readShopifyCatalog } from './legacy-import-plan.mjs';
import { rowsFromWrangler } from './cleanup-rules/tidy.mjs';
import { IN_STOCK_WORDS, fixMojibake } from '../src/db.js';

export const STALE_DAYS = 30;
export const PRICE_JUMP = 3;
const STATEMENTS_PER_FILE = 1000;

export const keyOf = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sq = v => (v === null || v === undefined) ? 'NULL' : (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
export const inStockText = t => IN_STOCK_WORDS.includes(String(t ?? '').trim().toLowerCase());

// The Awin feed files of one retailer: AWIN_<advertiser>_<feed>.csv(.gz) whose merchant_name is the retailer's name on the
// site (or the advertiser id given). Reads only the first rows of each file.
export async function findFeeds(archive, retailer, advertiser = '') {
  const files = readdirSync(archive).filter(f => /^AWIN_\d+_\d+\.csv(\.gz)?$/i.test(f)).sort();
  if (advertiser) return { files: files.filter(f => f.split('_')[1] === String(advertiser)).map(f => join(archive, f)), names: {} };
  const want = keyOf(retailer);
  const names = {};
  const hit = [];
  for (const f of files) {
    const name = await firstMerchantName(join(archive, f));
    names[f] = name;
    if (name && keyOf(name) === want) hit.push(join(archive, f));
  }
  return { files: hit, names };
}

async function firstMerchantName(path) {
  const raw = createReadStream(path);
  const stream = /\.gz$/i.test(path) ? raw.pipe(createGunzip()) : raw;
  let h = null;
  try {
    for await (const rec of readCsvRecords(stream)) {
      if (!h) { h = rec.map(x => String(x).trim().toLowerCase().replace(/^﻿/, '')); continue; }
      const i = h.indexOf('merchant_name');
      return i >= 0 ? String(rec[i] || '').trim() : '';
    }
  } catch { return ''; } finally { raw.destroy(); }
  return '';
}

// One entry per feed row, found by Awin product id and by the shop's own product id. The newest file is read first, so
// when a product is in two files (Tooled Up: files of 1 and of 10 days, 26 Oct 2026) the fresher row wins (L58).
export function newestFirst(paths, mtime = f => statSync(f).mtimeMs) {
  return paths.map(f => ({ f, t: mtime(f) })).sort((a, b) => (b.t - a.t) || (a.f < b.f ? -1 : a.f > b.f ? 1 : 0)).map(x => x.f);
}

export async function readFeed(paths) {
  const byAw = new Map();
  const byMid = new Map();
  let rows = 0, newest = '', newestFile = 0;
  for (const f of newestFirst(paths)) {
    newestFile = Math.max(newestFile, statSync(f).mtimeMs);
    const raw = createReadStream(f);
    const stream = /\.gz$/i.test(f) ? raw.pipe(createGunzip()) : raw;
    let h = null;
    for await (const rec of readCsvRecords(stream)) {
      if (!h) { h = rec.map(x => String(x).trim().toLowerCase().replace(/^\uFEFF/, '')); continue; }
      if (rec.length < 3) continue;
      const get = c => { const i = h.indexOf(c); return i >= 0 ? String(rec[i] ?? '').trim() : ''; };
      rows++;
      const qty = get('stock_quantity');
      let inStock = stockFlag(get('in_stock'));
      if (inStock === null && /^\d+$/.test(qty)) inStock = Number(qty) > 0;
      const statusText = get('stock_status');
      if (inStock === null && statusText) inStock = inStockText(statusText) ? true : (stockFlag(statusText) === false ? false : null);
      const p = {
        aw: get('aw_product_id'), mid: get('merchant_product_id'), price: parsePrice(get('search_price') || get('store_price')),
        currency: get('currency').toUpperCase(), inStock, stockText: statusText || get('in_stock') || qty, image: pickImage(get)
      };
      const upd = get('last_updated') || get('data_feed_last_updated');
      if (upd && upd > newest) newest = upd;
      if (p.aw && !byAw.has(p.aw)) byAw.set(p.aw, p);
      if (p.mid && !byMid.has(p.mid)) byMid.set(p.mid, p);
    }
  }
  return { byAw, byMid, rows, newest, newestFile };
}

// The feed row of a database row: the Awin product id, "<advertiser>:<shop id>", or the shop's own product id.
export function matchRow(row, feed) {
  const id = String(row.awin_product_id || '');
  if (feed.byAw.has(id)) return feed.byAw.get(id);
  const colon = id.indexOf(':');
  if (colon > 0 && feed.byMid.has(id.slice(colon + 1))) return feed.byMid.get(id.slice(colon + 1));
  const mid = String(row.merchant_product_id || '');
  if (mid && feed.byMid.has(mid)) return feed.byMid.get(mid);
  return null;
}

// Rows written per changed column: 1 for the row, plus 1 for every index that holds the column (measured on the CGW
// layout with the wrangler local D1, 25 Oct 2026: price 3, picture 1, stock 1, hide 12 = 1 + 11 indexes on is_active),
// plus 2 for every UPDATE trigger that fires on the column (lessons L59: on MGW, WGW, KGW, HGW and GGW the search index
// trigger fires on ANY update and rewrites the product's search entry; measured on the MGW layout, 26 Oct 2026:
// price 4, stock 3, hide 6). The CGW trigger fires only for name, brand, subcategory, retailer and category: +0.
export function writeCosts(rows) {
  const sqls = rows.map(r => String(r.sql || '')).filter(Boolean);
  const triggers = sqls.filter(s => /^\s*CREATE\s+TRIGGER\b/i.test(s));
  const indexes = sqls.filter(s => !/^\s*CREATE\s+TRIGGER\b/i.test(s));
  const onUpdate = triggers.map(s => /\bAFTER\s+UPDATE\b(?:\s+OF\s+([\s\S]*?))?\s+ON\s+["'`]?products\b/i.exec(s)).filter(Boolean)
    .map(m => (m[1] ? m[1].split(',').map(c => c.trim().replace(/["'`]/g, '').toLowerCase()) : null));
  const per = col => 1 + indexes.filter(s => new RegExp(`\\b${col}\\b`, 'i').test(s.replace(/^[^(]*\(/, ''))).length
    + 2 * onUpdate.filter(cols => cols === null || cols.includes(col)).length;
  return { price: per('price'), image_url: per('image_url'), stock_status: per('stock_status'), is_active: per('is_active') };
}

// The shop's own address from the products' links (Awin cread.php ?ued=..., or the plain shop link): the most common host,
// used by at least 4 in 5 products. Empty when there is none (e.g. pclick.php links carry no shop address).
export function linkHost(url) {
  let u;
  try { u = new URL(String(url || '')); } catch { return ''; }
  if (/(^|\.)awin1\.com$/i.test(u.hostname)) {
    const inner = u.searchParams.get('ued') || '';
    if (!inner) return '';
    try { u = new URL(inner); } catch { return ''; }
  }
  return u.protocol === 'https:' ? u.hostname.toLowerCase() : '';
}
export function shopOriginOf(rows) {
  const count = new Map();
  for (const r of rows) { const h = linkHost(r.affiliate_url); if (h) count.set(h, (count.get(h) || 0) + 1); }
  let best = '', n = 0;
  for (const [h, c] of count) if (c > n) { best = h; n = c; }
  return best && n >= rows.length * 0.8 ? `https://${best}` : '';
}

// The currency the shop sells in (Shopify /meta.json). Empty when it cannot be read: then no price changes.
export async function readShopCurrency(origin, { fetchImpl = globalThis.fetch } = {}) {
  try {
    const res = await fetchImpl(`${origin}/meta.json`, { headers: { accept: 'application/json', 'user-agent': 'GearWorldRefresh/1.0' }, signal: AbortSignal.timeout(20000) });
    if (!res || !res.ok) return '';
    const d = await res.json();
    return /^[A-Z]{3}$/.test(String(d && d.currency || '').toUpperCase()) ? String(d.currency).toUpperCase() : '';
  } catch { return ''; }
}

// The live catalogue in the shape of a feed: one entry per option (variant), found by its id and by its SKU.
const picKey = u => String(u || '').split('?')[0].toLowerCase();
export function feedFromShopify(catalog, currency, now = new Date()) {
  const byAw = new Map(), byMid = new Map();
  let rows = 0;
  const abs = u => (String(u || '').startsWith('//') ? 'https:' + u : String(u || ''));
  for (const p of catalog.values()) {
    const images = (p.images || []).map(i => realImage(abs(i && typeof i === 'object' ? i.src : i))).filter(Boolean);
    for (const v of p.variants || []) {
      rows++;
      const own = v.featured_image ? realImage(abs(typeof v.featured_image === 'object' ? v.featured_image.src : v.featured_image)) : '';
      const e = { aw: String(v.id), mid: String(v.sku || '').trim(), price: currency ? parsePrice(String(v.price ?? '')) : NaN, currency: currency || '',
        inStock: typeof v.available === 'boolean' ? v.available : null, stockText: '', image: own || images[0] || '', images };
      byAw.set(e.aw, e);
      byMid.set(e.aw, e);
      if (e.mid && !byMid.has(e.mid)) byMid.set(e.mid, e);
    }
  }
  return { byAw, byMid, rows, newest: now.toISOString().slice(0, 19).replace('T', ' '), newestFile: 0, shop: true };
}

const daysBetween = (a, b) => (b - a) / 86400000;
function parseFeedDate(s) {
  const t = Date.parse(String(s).replace(' ', 'T'));
  return Number.isFinite(t) ? t : NaN;
}

export function planRefresh({ rows, feed, costs, maxWrites = 90000, now = new Date() }) {
  const active = rows.filter(r => Number(r.is_active) === 1);
  // The products' own update date; without it, the date of the newest feed file on this PC (L39, L58).
  const newestTime = feed.newest ? parseFeedDate(feed.newest) : NaN;
  const fileTime = Number(feed.newestFile) > 0 ? Number(feed.newestFile) : NaN;
  const staleFrom = Number.isFinite(newestTime) ? 'products' : (Number.isFinite(fileTime) ? 'file' : '');
  const staleDays = staleFrom ? Math.floor(daysBetween(staleFrom === 'products' ? newestTime : fileTime, now.getTime())) : null;
  const stale = staleDays !== null && staleDays > STALE_DAYS;
  const changes = [];
  const gone = [];
  const soldOut = [];
  const bigPrice = [];
  const currencySkip = [];
  let same = 0;
  const feedStock = { in: 0, out: 0, unknown: 0 };
  for (const r of active) {
    const f = matchRow(r, feed);
    if (!f) { gone.push(Number(r.id)); continue; }
    feedStock[f.inStock === true ? 'in' : (f.inStock === false ? 'out' : 'unknown')]++;
    // The shop's own catalogue (L60): sold out on the shop -> hidden, as at import (L39); there is no feed to bring it back.
    if (feed.shop && f.inStock === false) { soldOut.push(Number(r.id)); continue; }
    const set = {}, old = {};
    if (Number.isFinite(f.price) && f.price > 0) {
      const curCurrency = String(r.currency || 'GBP').toUpperCase();
      const oldPrice = Number(r.price);
      if (f.currency && f.currency !== curCurrency) currencySkip.push({ id: Number(r.id), from: curCurrency, to: f.currency });
      else if (Math.abs(f.price - oldPrice) >= 0.005) {
        if (oldPrice > 0 && (f.price > oldPrice * PRICE_JUMP || f.price < oldPrice / PRICE_JUMP)) bigPrice.push({ id: Number(r.id), name: r.product_name || r.awin_product_id, from: oldPrice, to: f.price });
        else { set.price = f.price; old.price = oldPrice; }
      }
    }
    // A picture only when the feed has a real one and it is another picture (an Awin 200px proxy becomes the full image, L38).
    // From the shop's catalogue only when the saved picture is no longer one of the product's pictures (deleted, L39).
    const curPic = String(r.image_url || '');
    const keepPic = Array.isArray(f.images) && f.images.some(u => picKey(u) === picKey(curPic));
    if (f.image && f.image !== curPic && !keepPic) { set.image_url = f.image; old.image_url = r.image_url ?? null; }
    if (f.inStock !== null && f.inStock !== inStockText(r.stock_status)) {
      // The shop's own word when the site reads it the same way, else the engine's plain words.
      let text = String(f.stockText || '').trim();
      if (!text || inStockText(text) !== f.inStock) text = f.inStock ? 'in stock' : 'out_of_stock';
      set.stock_status = text; old.stock_status = r.stock_status ?? null;
    }
    if (!Object.keys(set).length) { same++; continue; }
    const writes = Math.max(...Object.keys(set).map(c => costs[c] || 1));
    changes.push({ id: Number(r.id), set, old, writes, name: r.product_name || '' });
  }
  // A feed that misses most products is more likely a broken download than a closed shop.
  const safe = !(active.length >= 100 && gone.length > active.length * 0.5);
  const hideAll = [...(safe ? gone : []), ...soldOut];
  // The budget: changes first (cheap, and they fix prices and pictures), then hides; the rest waits for the next run.
  let writes = 0;
  const doChanges = [], doHides = [];
  if (!stale) {
    for (const c of changes) { if (writes + c.writes > maxWrites) break; doChanges.push(c); writes += c.writes; }
    for (const id of hideAll) { if (writes + costs.is_active > maxWrites) break; doHides.push(id); writes += costs.is_active; }
  }
  const left = { changes: stale ? 0 : changes.length - doChanges.length, hides: stale ? 0 : hideAll.length - doHides.length };
  const count = col => doChanges.filter(c => col in c.set).length;
  return {
    active: active.length, matched: active.length - gone.length, same, changes: doChanges, hides: doHides, gone: gone.length, soldOut: soldOut.length, safe, stale, staleDays,
    staleFrom, feedStock, bigPrice, currencySkip, writes, left, costs,
    counts: { price: count('price'), image_url: count('image_url'), stock_status: count('stock_status'),
      toOut: doChanges.filter(c => 'stock_status' in c.set && !inStockText(c.set.stock_status)).length,
      toIn: doChanges.filter(c => 'stock_status' in c.set && inStockText(c.set.stock_status)).length }
  };
}

export function updateStatement(c) {
  const parts = Object.entries(c.set).map(([k, v]) => `${k} = ${sq(v)}`);
  return `UPDATE products SET ${parts.join(', ')}, updated_at = datetime('now') WHERE id = ${c.id};`;
}
export function rollbackStatement(c) {
  const parts = Object.entries(c.old).map(([k, v]) => `${k} = ${sq(v)}`);
  return `UPDATE products SET ${parts.join(', ')} WHERE id = ${c.id};`;
}
const idsSql = (ids, active) => {
  const out = [];
  for (let i = 0; i < ids.length; i += 500) out.push(`UPDATE products SET is_active = ${active ? 1 : 0}, updated_at = datetime('now') WHERE id IN (${ids.slice(i, i + 500).join(', ')});`);
  return out;
};

export function writePlan(out, p) {
  mkdirSync(out, { recursive: true });
  const files = [];
  const statements = p.changes.map(updateStatement);
  for (let i = 0, n = 1; i < statements.length; i += STATEMENTS_PER_FILE, n++) {
    const f = join(out, `update-${String(n).padStart(4, '0')}.sql`);
    writeFileSync(f, statements.slice(i, i + STATEMENTS_PER_FILE).join('\n') + '\n');
    files.push(basename(f));
  }
  writeFileSync(join(out, 'hide.sql'), p.hides.length ? idsSql(p.hides, false).join('\n') + '\n' : '');
  writeFileSync(join(out, 'rollback.sql'), [...p.changes.map(rollbackStatement), ...idsSql(p.hides, true)].join('\n') + '\n');
  writeFileSync(join(out, 'hidden-ids.txt'), p.hides.join('\n') + (p.hides.length ? '\n' : ''));
  const summary = { active: p.active, matched: p.matched, same: p.same, changes: p.changes.length, hides: p.hides.length, gone: p.gone, soldOut: p.soldOut || 0, safe: p.safe,
    stale: p.stale, staleDays: p.staleDays, staleFrom: p.staleFrom, feedStock: p.feedStock, writes: p.writes, left: p.left, counts: p.counts, costs: p.costs, bigPrice: p.bigPrice.length,
    currencySkip: p.currencySkip.length, updateFiles: files };
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

export function renderReport({ retailer, site, feedFiles, feedRows, newest, p, shop = null }) {
  const fmt = n => new Intl.NumberFormat('en-GB').format(n);
  const L = [];
  if (shop) L.push(`Πηγή: ο ζωντανός κατάλογος του καταστήματος ${shop.origin} (${fmt(feedRows)} επιλογές, νόμισμα ${shop.currency || 'άγνωστο'}), όχι το feed του Awin (L60).`);
  else L.push(`Feed: ${feedFiles.join(', ')} (${fmt(feedRows)} γραμμές${newest ? `, νεότερη ενημέρωση προϊόντος ${newest}` : ''})`);
  const where = shop ? 'στο κατάστημα' : 'στο feed';
  L.push(`Ενεργά προϊόντα ${retailer} στο ${site.toUpperCase()}: ${fmt(p.active)}. Βρέθηκαν ${where}: ${fmt(p.matched)} (ίδια: ${fmt(p.same)}). Δεν υπάρχουν πια ${where}: ${fmt(p.gone)}.`);
  if (shop) L.push(`Εξαντλημένα στο κατάστημα: ${fmt(p.soldOut || 0)} (κρύβονται, όπως στην εισαγωγή, L39).`);
  if (shop && !shop.currency) L.push('ΠΡΟΣΟΧΗ: δεν διάβασα το νόμισμα του καταστήματος· οι τιμές δεν αλλάζουν.');
  if (!shop && !newest && p.staleFrom === 'file') L.push(`Το feed δεν γράφει πότε ενημερώθηκε κάθε προϊόν: ο έλεγχος παλιού feed (L39) έγινε με το νεότερο αρχείο του (${p.staleDays} ημ.).`);
  if (p.stale && p.staleFrom === 'file') L.push(`ΠΡΟΣΟΧΗ: το νεότερο αρχείο του feed είναι ${p.staleDays} ημερών (πάνω από ${STALE_DAYS}). Δεν θα αλλάξει τίποτα (L39). Χρειάζεται νεότερο feed (εργαλείο awin-feed-download).`);
  else if (p.stale) L.push(`ΠΡΟΣΟΧΗ: το feed έχει να ενημερωθεί ${p.staleDays} μέρες (πάνω από ${STALE_DAYS}). Δεν θα αλλάξει τίποτα (L39).`);
  if (!p.safe) L.push(`ΠΡΟΣΟΧΗ: λείπουν από το feed πάνω από τα μισά ενεργά προϊόντα (${fmt(p.gone)} από ${fmt(p.active)}). Μάλλον δεν κατέβηκε ολόκληρο: ΔΕΝ θα κρυφτεί κανένα.`);
  if (!shop && p.feedStock && p.matched) L.push(`Απόθεμα στο feed για τα ${fmt(p.matched)} που βρέθηκαν: σε απόθεμα ${fmt(p.feedStock.in)}, εξαντλημένα ${fmt(p.feedStock.out)}, χωρίς στοιχείο ${fmt(p.feedStock.unknown)}.`);
  L.push(`Αλλαγές: τιμή ${fmt(p.counts.price)}, εικόνα ${fmt(p.counts.image_url)}, απόθεμα ${fmt(p.counts.stock_status)} (σε απόθεμα ξανά: ${fmt(p.counts.toIn)}, εξαντλήθηκαν: ${fmt(p.counts.toOut)}). Απόκρυψη: ${fmt(p.hides.length)}.`);
  L.push(`Εγγραφές D1: περίπου ${fmt(p.writes)} (ανά προϊόν: τιμή ${p.costs.price}, εικόνα ${p.costs.image_url}, απόθεμα ${p.costs.stock_status}, απόκρυψη ${p.costs.is_active}).`);
  if (p.left.changes || p.left.hides) L.push(`Όριο εγγραφών: ${fmt(p.left.changes)} αλλαγές και ${fmt(p.left.hides)} αποκρύψεις μένουν για την επόμενη εκτέλεση (κάθε εκτέλεση ξαναϋπολογίζει μόνο όσα διαφέρουν).`);
  if (p.bigPrice.length) {
    L.push(`ΠΡΟΣΟΧΗ: ${fmt(p.bigPrice.length)} τιμές αλλάζουν πάνω από ${PRICE_JUMP} φορές. ΔΕΝ αλλάζουν· να ελεγχθούν:`);
    for (const b of p.bigPrice.slice(0, 15)) L.push(`   - ${String(fixMojibake(b.name)).slice(0, 90)}: ${b.from} -> ${b.to}`);
  }
  if (p.currencySkip.length) L.push(`ΠΡΟΣΟΧΗ: ${fmt(p.currencySkip.length)} προϊόντα έχουν άλλο νόμισμα ${where} (${p.currencySkip[0].from} -> ${p.currencySkip[0].to}). Η τιμή τους δεν αλλάζει.`);
  const samples = p.changes.filter(c => 'price' in c.set).slice(0, 8);
  if (samples.length) {
    L.push('Δείγματα αλλαγών τιμής:');
    for (const c of samples) L.push(`   - ${String(fixMojibake(c.name)).slice(0, 80)}: ${c.old.price} -> ${c.set.price}`);
  }
  return L.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
  const all = k => args.flatMap((a, i) => a === k ? [args[i + 1]] : []);
  const archive = resolve(opt('--archive'));
  const retailer = opt('--retailer');
  const out = resolve(opt('--out'));
  const site = opt('--site') || 'site';
  const now = opt('--now') ? new Date(opt('--now')) : new Date();
  const maxWrites = Number(opt('--max-writes') || 90000);
  mkdirSync(out, { recursive: true });
  const rows = all('--rows').flatMap(f => rowsFromWrangler(readFileSync(f, 'utf8')));
  const costs = writeCosts(opt('--indexes') && existsSync(opt('--indexes')) ? rowsFromWrangler(readFileSync(opt('--indexes'), 'utf8')) : []);
  const finish = (feed, report) => {
    const p = planRefresh({ rows, feed, costs, maxWrites, now });
    const summary = writePlan(out, p);
    writeFileSync(join(out, 'report.txt'), report(p));
    writeFileSync(join(out, 'counts.txt'), `${summary.changes} ${summary.hides} ${summary.writes} ${summary.stale ? 1 : 0} ${summary.safe ? 1 : 0} ${summary.active}\n`);
  };
  if (args.includes('--from-shop')) {
    // The shop's own live catalogue (L60). Read-only GETs; any failure changes nothing.
    const origin = shopOriginOf(rows.filter(r => Number(r.is_active) === 1));
    if (!origin) {
      writeFileSync(join(out, 'report.txt'), 'Δεν βρήκα τη διεύθυνση του καταστήματος στα links των προϊόντων. Δεν άλλαξε τίποτα.\n');
      process.exit(3);
    }
    let catalog;
    try { catalog = await readShopifyCatalog(origin); } catch (e) {
      writeFileSync(join(out, 'report.txt'), `Δεν διάβασα τον κατάλογο του καταστήματος ${origin}: ${e.message}\n`);
      process.exit(4);
    }
    const currency = await readShopCurrency(origin);
    const feed = feedFromShopify(catalog, currency, now);
    finish(feed, p => renderReport({ retailer, site, feedFiles: [origin], feedRows: feed.rows, newest: feed.newest, p, shop: { origin, currency } }));
  } else {
    const { files, names } = await findFeeds(archive, retailer, opt('--advertiser'));
    if (!files.length) {
      const similar = Object.entries(names).filter(([, n]) => n && keyOf(n).includes(keyOf(retailer).split('-')[0])).map(([f, n]) => `${f}: ${n}`);
      writeFileSync(join(out, 'report.txt'), `Δεν βρέθηκε feed με merchant_name "${retailer}" στο ${archive}.${similar.length ? `\nΠαρόμοια: ${similar.join('; ')}` : ''}\n`);
      process.exit(3);
    }
    const feed = await readFeed(files);
    const ages = files.map(f => Math.floor((now.getTime() - statSync(f).mtimeMs) / 86400000));
    finish(feed, p => renderReport({ retailer, site, feedFiles: files.map((f, i) => `${basename(f)} (αρχείο ${ages[i]} ημ.)`), feedRows: feed.rows, newest: feed.newest, p }));
  }
}
