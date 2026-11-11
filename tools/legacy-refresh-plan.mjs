#!/usr/bin/env node
// Refresh PLAN for a retailer that is ALREADY on one of the older Gear World sites (CGW, MGW, WGW, KGW, HGW, GGW).
// READ-ONLY: it reads the retailer's Awin feed on this PC and the rows the site database has for it (given as
// wrangler output files), and writes the SQL a refresh WOULD run. Nothing is sent to any database.
//
//   - price, picture and stock of the products already on the site are set to the feed's values, only where they differ
//     (D1 bills every row and index entry written, even for an unchanged value);
//   - "seen" (lessons L108): an active product the feed still has, at the same price, gets the feed's time as its date
//     (updated_at, the "Price checked" date of the site), so the site knows the feed confirmed it: the sites hide a
//     product after 30 days and say "Check price and stock at the retailer" after 14 (src/lib/visibility.js, L107);
//   - the date written is the time the feed FILE was downloaded (its time on this PC), never "now" and never later, and
//     never later than the feed's own newest last_updated ("Price checked" is never newer than the retailer's data); a
//     feed file downloaded more than 2 days before the run writes no date at all (download it again first). The rows
//     that change get the same date; a row the database changed after the download is newer than the feed: untouched;
//   - another write between our read and our load is never overwritten: every UPDATE also asks that the row still has
//     the date we read (updated_at not later than the newest date read for the ids of that statement; every tool that
//     writes products sets updated_at to the time of writing), a hide also asks is_active = 1, and the rollback of a
//     dated row asks updated_at = our date, so it never undoes a later change of someone else;
//   - no date on a price held back by the price-jump rule, on another currency, without a feed price, on a hidden row
//     or on a row not in the feed;
//   - active products that are no longer in the feed are hidden (is_active = 0, nothing is deleted, no date);
//   - hidden products stay hidden: a clean-up may have hidden them on purpose (one card per product, misfits...);
//   - a price that changes more than 3 times up or down is not changed but listed for a person to check;
//   - a feed whose products were last updated more than 30 days ago changes nothing (lessons L39: stale feeds);
//   - a feed that misses more than half of the active products, or has no product at all, hides nothing (more likely a
//     broken download); the one-paste mode (-Stale) hides nothing at all (--no-hide): a product the feed does not
//     confirm gets no date, and the sites stop listing it after 30 days on their own;
//   - the rows written in D1 are counted from the table's own indexes and triggers (lessons L49, L57, L108): 1 + one per
//     index holding the column + one per statement of a trigger that fires on it (the FTS trigger of MGW, WGW, KGW, HGW
//     and GGW fires on every UPDATE: 2 more rows each). Above the budget, the plan keeps the first changes and leaves
//     the rest for the next run;
//   - few statements in small files: equal changes in one UPDATE ... WHERE id IN (up to 500 ids), and at most 50
//     statements and 5,000 rows written per file (a big `d1 execute --file` keeps the database busy: short 500 errors on
//     the sites, L108).
//
// node tools/legacy-refresh-plan.mjs --archive <dir> --retailer "<name on the site>" --rows <wrangler json> [--rows ...]
//   --indexes <wrangler json of sqlite_master> --out <dir> [--max-writes 90000] [--advertiser <id>] [--now <iso date>]
//   [--require-dates]   (the one-paste mode: a shop whose feed file is too old to write dates changes nothing)
//   [--feed-file AWIN_<advertiser>_<feed>.csv.gz ...]   (files found by --find, instead of reading the archive again)
//   [--no-hide]   (the one-paste mode: products not in the feed are not hidden)
//   [--accept-jumps]   (-AcceptJumps: a price that jumps more than 3 times, up to 10, is taken as the new price)
//   Rows with a retailer column (the one-paste mode reads all active rows of a site at once) are kept only for --retailer.
// node tools/legacy-refresh-plan.mjs --find --archive <dir> --retailers-file <one name per line> --out <dir> [--now ...]
//   writes feeds.json: the feed files of every shop (advertiser, feed id, time of the file), read-only. A line may be
//   "<name><TAB><Awin advertiser id or one affiliate link of the shop>": when no feed has the shop's name as its
//   merchant_name, the files AWIN_<id>_*.csv(.gz) are used.
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords, parsePrice } from './tgw-import-plan.mjs';
import { stockFlag, pickImage } from './legacy-import-plan.mjs';
import { rowsFromWrangler } from './cleanup-rules/tidy.mjs';
import { IN_STOCK_WORDS } from '../src/db.js';
import { HIDE_AFTER_DAYS, CHECK_AFTER_DAYS } from '../src/lib/visibility.js';
import * as gsworkwear from './import-rules/gsworkwear.mjs';

export const STALE_DAYS = 30;
export const PRICE_JUMP = 3;
// -AcceptJumps (a shop the owner checked, e.g. Coes at the end of a 70% sale, 11 Nov 2026): a jump up to this many times
// is taken as the new price; a bigger one is still held back.
export const ACCEPT_JUMP_MAX = 10;
// A feed file downloaded more than this many days before the run writes no date (lessons L108).
export const FEED_FILE_MAX_DAYS = 2;
export const IDS_PER_STATEMENT = 500;
export const MAX_STATEMENTS_PER_FILE = 50;
export const MAX_WRITES_PER_FILE = 5000;
export const COLUMNS = ['price', 'image_url', 'stock_status', 'is_active', 'updated_at'];
const DAY = 86400000;

export const keyOf = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sq = v => (v === null || v === undefined) ? 'NULL' : (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
export const inStockText = t => IN_STOCK_WORDS.includes(String(t ?? '').trim().toLowerCase());

// The date as the older sites keep it: SQLite datetime('now') text, UTC, whole seconds (never rounded up).
export const sqliteTime = ms => new Date(Math.floor(ms / 1000) * 1000).toISOString().slice(0, 19).replace('T', ' ');
const isoDay = t => new Date(t).toISOString().slice(0, 10);
// The days of src/lib/visibility.js for a moment: listed only when checked on or after `cutoff`, "check at the
// retailer" when checked before `checkFrom`.
export function viewDays(nowMs) {
  return { cutoff: isoDay(nowMs - HIDE_AFTER_DAYS * DAY), checkFrom: isoDay(nowMs - CHECK_AFTER_DAYS * DAY) };
}
const dateText = v => (v === null || v === undefined ? '' : String(v));
// The same date as comparable text: an ISO "2026-11-08T10:00:00.000Z" compares like "2026-11-08 10:00:00".
const dateKey = v => dateText(v).replace('T', ' ').slice(0, 19);

const FEED_FILE = /^AWIN_(\d+)_(\d+)\.csv(\.gz)?$/i;
// Awin's feeds in Google format ("Enhanced" feeds, e.g. GS Workwear, 48473): <advertiser>-<vertical>-<locale>.csv(.gz),
// e.g. 48473-retail-en_GB.csv.gz (lessons L34, L114). They are not in Awin's usual feed list; tools/awin-feed-download.ps1
// saves them in the archive, and an older copy may still be in Downloads (the folder above the archive).
const GOOGLE_FILE = /^(\d{2,9})-([A-Za-z0-9_-]+)\.csv(\.gz)?$/i;
export const isFeedFile = name => FEED_FILE.test(name) || GOOGLE_FILE.test(name);
// { advertiser, feed } of a feed file name ('' when it is not one).
export function feedFileParts(name) {
  const m = FEED_FILE.exec(name);
  if (m) return { advertiser: m[1], feed: m[2] };
  const g = GOOGLE_FILE.exec(name);
  return g ? { advertiser: g[1], feed: g[2] } : { advertiser: '', feed: '' };
}
// The feed files of the archive, and the Google-format ones of the folder above it (Downloads) that the archive does not
// have: name -> full path.
export function listFeedFiles(archive) {
  const out = new Map();
  const read = dir => { try { return readdirSync(dir); } catch { return []; } };
  for (const f of read(archive).filter(isFeedFile).sort()) out.set(f, join(archive, f));
  // Downloads: only for an advertiser the archive has no file of (an old copy never joins a fresh feed of the shop).
  const inArchive = new Set([...out.keys()].map(f => feedFileParts(f).advertiser));
  for (const f of read(dirname(archive)).filter(n => GOOGLE_FILE.test(n)).sort()) {
    if (!out.has(f) && !inArchive.has(feedFileParts(f).advertiser)) out.set(f, join(dirname(archive), f));
  }
  return out;
}
// A file name of feeds.json (the one-paste mode): in the archive, or else in the folder above it.
export function resolveFeedFile(archive, name) {
  const b = basename(name);
  if (!isFeedFile(b)) return '';
  for (const p of [join(archive, b), join(dirname(archive), b)]) if (existsSync(p)) return p;
  return '';
}

// The Awin feed files of one retailer: AWIN_<advertiser>_<feed>.csv(.gz) whose merchant_name is the retailer's name on the
// site (or the advertiser id given). Reads only the first rows of each file.
export async function findFeeds(archive, retailer, advertiser = '') {
  const all = listFeedFiles(archive);
  const files = [...all.keys()];
  if (advertiser) return { files: files.filter(f => feedFileParts(f).advertiser === String(advertiser)).map(f => all.get(f)), names: {} };
  const want = keyOf(retailer);
  const names = await merchantNames(archive, files, all);
  return { files: files.filter(f => names[f] && keyOf(names[f]) === want).map(f => all.get(f)), names };
}

export async function merchantNames(archive, files, paths = null) {
  const names = {};
  for (const f of files) names[f] = await firstMerchantName(paths && paths.get(f) ? paths.get(f) : join(archive, f));
  return names;
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

// One copy per feed: AWIN_<advertiser>_<feed>.csv and .csv.gz are the same feed, and the newer file wins. The time of the
// feed is the time of its OLDEST file (a shop with two feeds is only as fresh as the older one).
export function pickFeedFiles(paths, statFn = statSync) {
  const byBase = new Map();
  for (const p of paths) {
    const base = basename(p).replace(/\.csv(\.gz)?$/i, '').toUpperCase();
    const t = statFn(p).mtimeMs;
    const cur = byBase.get(base);
    if (!cur || t > cur.mtimeMs) byBase.set(base, { path: p, mtimeMs: t });
  }
  const kept = [...byBase.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
  return {
    files: kept.map(k => k.path),
    times: kept.map(k => k.mtimeMs),
    dropped: paths.filter(p => !kept.some(k => k.path === p)),
    feedTime: kept.length ? Math.min(...kept.map(k => k.mtimeMs)) : NaN
  };
}

// The Awin advertiser id of an affiliate link of the older sites: cread.php?awinmid=<id>&awinaffid=<us>&ued=...,
// pclick.php?p=<product>&a=<us>&m=<id>, or an older cread.php?mid=<id>. '' for any other link (CJ, shop links).
export function advertiserOf(url) {
  const u = String(url || '');
  if (!/^https?:\/\/(www\.)?awin1\.com\//i.test(u)) return '';
  const m = /[?&]awinmid=(\d{1,9})\b/i.exec(u) || /[?&]mid=(\d{1,9})\b/i.exec(u) || (/\/pclick\.php\?/i.test(u) ? /[?&]m=(\d{1,9})\b/i.exec(u) : null);
  return m ? m[1] : '';
}

// The feeds of many shops in one pass over the archive (the one-paste mode, lessons L108). Each entry is a name, or
// { retailer, advertiser }: the advertiser id finds AWIN_<id>_* when no feed has the shop's name (e.g. "Watch Enclave
// Affiliate Programme" or "100 Percent Pure", whose feeds have another merchant_name).
export async function findFeedsFor(archive, retailers, nowMs = Date.now()) {
  const all = listFeedFiles(archive);
  const files = [...all.keys()];
  const names = await merchantNames(archive, files, all);
  return retailers.map(entry => {
    const retailer = typeof entry === 'string' ? entry : String(entry.retailer || '');
    // The advertiser id itself, or an affiliate link of the shop (the one-paste mode sends MIN(affiliate_url)).
    const raw = typeof entry === 'string' ? '' : String(entry.advertiser || '').trim();
    const hint = /^\d{1,9}$/.test(raw) ? raw : advertiserOf(raw);
    const want = keyOf(retailer);
    let hits = files.filter(f => names[f] && keyOf(names[f]) === want).map(f => all.get(f));
    let matchedBy = hits.length ? 'name' : '';
    if (!hits.length && hint) {
      hits = files.filter(f => feedFileParts(f).advertiser === hint).map(f => all.get(f));
      matchedBy = hits.length ? 'advertiser' : '';
    }
    const pick = pickFeedFiles(hits);
    const similar = hits.length ? [] : Object.entries(names).filter(([, n]) => n && want && keyOf(n).includes(want.split('-')[0])).map(([f, n]) => `${f}: ${n}`).slice(0, 5);
    return {
      retailer,
      files: pick.files.map((f, i) => {
        const m = feedFileParts(basename(f));
        return { file: basename(f), advertiser: m.advertiser, feed: m.feed, time: sqliteTime(pick.times[i]), ageDays: Math.round(((nowMs - pick.times[i]) / DAY) * 10) / 10 };
      }),
      // With no feed here but a known advertiser id, the one-paste mode can still download it.
      advertisers: hits.length ? [...new Set(pick.files.map(f => feedFileParts(basename(f)).advertiser))] : (hint ? [hint] : []),
      matchedBy,
      feedTime: Number.isFinite(pick.feedTime) ? sqliteTime(pick.feedTime) : '',
      ageDays: Number.isFinite(pick.feedTime) ? Math.round(((nowMs - pick.feedTime) / DAY) * 10) / 10 : null,
      similar
    };
  });
}

// The product page of a link, as "host/path" in lower case: no "www.", no query, no trailing slash. An Awin tracking link
// (cread.php ... ued=..., awclick.php ... p=...) gives the shop page inside it. Coes, Cronjager, Plusshop, Bazta and GRABO
// rows were imported with ids the feed no longer uses (an old Shopify variant id, or the page name), but the page is the
// same (feed check of 11 Nov 2026, lessons L113), so the page is the last way a row finds its feed row.
export function linkKey(url) {
  let s = String(url || '').trim();
  if (!s) return '';
  for (let i = 0; i < 2; i++) {
    let u;
    try { u = new URL(s); } catch { return ''; }
    if (/(^|\.)awin1\.com$/i.test(u.hostname)) {
      const inner = u.searchParams.get('ued') || u.searchParams.get('p') || '';
      if (!/^https?:\/\//i.test(inner)) return '';
      s = inner;
      continue;
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    let path = u.pathname;
    try { path = decodeURIComponent(path); } catch { /* keep it as it is */ }
    path = path.toLowerCase().replace(/\/+$/, '');
    return host + path;
  }
  return '';
}

// Which of two feed rows of the same product page a row uses: the site's currency first, then the newest file (L108),
// then in stock, then the lowest price (one card per product, at its lowest price: owner's rule). Ties keep the first.
function betterRow(a, b, currency) {
  const rank = p => [p.currency && p.currency !== currency ? 1 : 0, Number(p.fi) || 0, p.inStock === true ? 0 : 1,
    Number.isFinite(p.price) && p.price > 0 ? p.price : Infinity];
  const x = rank(a), y = rank(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? a : b;
  return a;
}

// The import rules of the shops whose Google-format feed was imported as one card per product (lessons L34): the
// database id is "<advertiser>:<productKey>", so a refresh finds the product by the same key, at its best row.
const GROUP_RULES = new Map([[String(gsworkwear.RULES.advertiserId), gsworkwear]]);
// A feed file in Google format: its header has title and link, and not the Awin product_name.
export const isGoogleHeader = h => h.includes('title') && (h.includes('link') || h.includes('id')) && !h.includes('product_name');

// One entry per feed row, found by Awin product id, by the shop's own product id and by its product page (L113). Files are read newest first: a
// product in several files (a fresh feed and an old copy that Awin no longer lists) takes the values and the time of
// the NEWEST file it is in (lessons L108: Tooled Up's leftover files of 15 Oct used to date the whole shop). Every entry
// keeps the index of its file (fi); files[fi] = { path, t: time of the file on this PC, newest: its newest last_updated }.
export async function readFeed(paths, timeOf = p => statSync(p).mtimeMs, { currency = 'GBP' } = {}) {
  const byAw = new Map();
  const byMid = new Map();
  const byLink = new Map();
  // Google-format feeds of a shop with import rules (GS Workwear): every size and colour of one product, by its key.
  const byGroup = new Map();
  let google = false;
  let rows = 0, newest = '';
  const key = x => (Number.isFinite(x.t) ? x.t : -Infinity);
  const order = paths.map(p => ({ p, t: Number(timeOf(p)) })).sort((a, b) => (key(b) - key(a)) || (a.p < b.p ? -1 : 1));
  const files = [];
  for (const { p: f, t: fileT } of order) {
    const fi = files.length;
    const info = { path: f, t: fileT, newest: '' };
    files.push(info);
    const raw = createReadStream(f);
    const stream = /\.gz$/i.test(f) ? raw.pipe(createGunzip()) : raw;
    let h = null, isGoogle = false, rules = null;
    for await (const rec of readCsvRecords(stream)) {
      if (!h) {
        h = rec.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
        isGoogle = isGoogleHeader(h);
        if (isGoogle) { google = true; rules = GROUP_RULES.get(feedFileParts(basename(f)).advertiser) || null; }
        continue;
      }
      if (rec.length < 3) continue;
      const column = c => { const i = h.indexOf(c); return i >= 0 ? String(rec[i] ?? '').trim() : ''; };
      // Google columns read under the Awin names (title -> product_name, sale_price/price "4.99 GBP" -> search_price,
      // availability -> stock_quantity, image_link, link -> merchant_deep_link, id -> merchant_product_id), as the import did.
      const get = isGoogle ? (c => String(gsworkwear.field(c, column) ?? '').trim()) : column;
      rows++;
      const qty = get('stock_quantity');
      let inStock = stockFlag(get('in_stock'));
      if (inStock === null && /^\d+$/.test(qty)) inStock = Number(qty) > 0;
      const statusText = get('stock_status');
      if (inStock === null && statusText) inStock = inStockText(statusText) ? true : (stockFlag(statusText) === false ? false : null);
      const p = {
        aw: get('aw_product_id'), mid: get('merchant_product_id'), price: parsePrice(get('search_price') || get('store_price')),
        currency: get('currency').toUpperCase(), inStock, stockText: statusText || get('in_stock') || qty, image: pickImage(get), fi
      };
      const upd = get('last_updated') || get('data_feed_last_updated');
      if (upd && upd > newest) newest = upd;
      if (upd && upd > info.newest) info.newest = upd;
      if (p.aw && !byAw.has(p.aw)) byAw.set(p.aw, p);
      if (p.mid && !byMid.has(p.mid)) byMid.set(p.mid, p);
      const lk = linkKey(get('merchant_deep_link')) || linkKey(get('aw_deep_link'));
      if (lk) { const had = byLink.get(lk); byLink.set(lk, had ? betterRow(had, p, currency) : p); }
      if (rules) {
        const gk = rules.productKey(get);
        if (gk) { const had = byGroup.get(gk); byGroup.set(gk, had ? betterRow(had, p, currency) : p); }
      }
    }
  }
  return { byAw, byMid, byLink, byGroup, google, rows, newest, files };
}

// The feed row of a database row: the Awin product id, "<advertiser>:<shop id>", the shop's own product id, or the
// product page of its link (lessons L113).
export function matchRow(row, feed) {
  const id = String(row.awin_product_id || '');
  if (feed.byAw.has(id)) return feed.byAw.get(id);
  const colon = id.indexOf(':');
  // "<advertiser>:<productKey>" of a shop imported as one card per product (GS Workwear): its best size and colour.
  if (colon > 0 && feed.byGroup && feed.byGroup.has(id.slice(colon + 1))) return feed.byGroup.get(id.slice(colon + 1));
  if (colon > 0 && feed.byMid.has(id.slice(colon + 1))) return feed.byMid.get(id.slice(colon + 1));
  const mid = String(row.merchant_product_id || '');
  if (mid && feed.byMid.has(mid)) return feed.byMid.get(mid);
  const lk = linkKey(row.affiliate_url);
  if (lk && feed.byLink && feed.byLink.has(lk)) return feed.byLink.get(lk);
  return null;
}

// An UPDATE trigger on products: the columns it fires on (null = every column) and how many statements it runs.
// String literals are blanked first ('delete' is a value of the FTS command, not a statement).
export function updateTrigger(sql) {
  const text = String(sql || '').replace(/'(?:[^']|'')*'/g, "''");
  const m = /\b(?:BEFORE|AFTER|INSTEAD\s+OF)\s+UPDATE\b(?:\s+OF\s+([\w\s,"`[\]]+?))?\s+ON\s+["`[]?products["`\]]?\s/i.exec(text);
  if (!m) return null;
  const cols = m[1] ? m[1].split(',').map(s => s.replace(/["`[\]]/g, '').trim().toLowerCase()).filter(Boolean) : null;
  const at = text.search(/\bBEGIN\b/i);
  const body = at >= 0 ? text.slice(at + 5) : '';
  return { cols, statements: (body.match(/\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/gi) || []).length };
}

// Rows written per changed column: 1 for the row, 1 for every index that holds the column, and 1 for every statement
// of an UPDATE trigger that fires on it. Measured with the wrangler local D1 on the live layouts (25 Oct and 9 Nov 2026):
// CGW price 3, picture 1, stock 1, date 1, hide 12 (1 + 11 indexes on is_active; its FTS trigger fires only on the
// name columns); HGW price 4, picture 3, stock 3, date 3, hide 6 (its FTS trigger fires on every UPDATE: 2 more rows).
// The rows are sqlite_master rows { type, name, sql } of the products table (indexes and triggers).
export function writeCosts(schemaRows) {
  const all = (schemaRows || []).map(r => ({ type: String(r.type || '').toLowerCase(), sql: String(r.sql || '') })).filter(r => r.sql);
  const isTrigger = r => r.type === 'trigger' || /^\s*CREATE\s+(?:TEMP\w*\s+)?TRIGGER\b/i.test(r.sql);
  const indexes = all.filter(r => !isTrigger(r)).map(r => r.sql.replace(/^[^(]*\(/, ''));
  const triggers = all.filter(isTrigger).map(r => updateTrigger(r.sql)).filter(Boolean);
  const per = col => 1 + indexes.filter(s => new RegExp(`\\b${col}\\b`, 'i').test(s)).length
    + triggers.filter(t => !t.cols || t.cols.includes(col)).reduce((n, t) => n + t.statements, 0);
  return Object.fromEntries(COLUMNS.map(c => [c, per(c)]));
}

const daysBetween = (a, b) => (b - a) / DAY;
function parseFeedDate(s) {
  const t = Date.parse(String(s).replace(' ', 'T'));
  return Number.isFinite(t) ? t : NaN;
}

// feedTime: the time (ms) the feed file was downloaded (pickFeedFiles). requireDates: the one-paste mode, where a shop
// whose feed file is too old to date its rows changes nothing at all (it is listed and waits for a fresh download).
export function planRefresh({ rows, feed, costs, maxWrites = 90000, now = new Date(), feedTime = NaN, requireDates = false, noHide = false, acceptJumps = false }) {
  const nowMs = now.getTime();
  const cost = col => (costs && costs[col]) || 1;
  const active = rows.filter(r => Number(r.is_active) === 1);
  const newestTime = feed.newest ? parseFeedDate(feed.newest) : NaN;
  const staleDays = Number.isFinite(newestTime) ? Math.floor(daysBetween(newestTime, nowMs)) : null;
  const stale = staleDays !== null && staleDays > STALE_DAYS;
  // The time of every row (lessons L108): the time of the NEWEST file it was found in, never later than now and never
  // later than that file's own newest last_updated ("Price checked" is never newer than the retailer's data). A row
  // found only in a file downloaded more than 2 days ago gets no date. feedTime is used only for a feed object without
  // file times (older callers and tests).
  const fallback = Number(feedTime);
  const fileInfos = (feed.files && feed.files.length) ? feed.files : (Number.isFinite(fallback) && fallback > 0 ? [{ path: '', t: fallback, newest: feed.newest }] : []);
  const timed = fileInfos.map(fi => {
    const has = Number.isFinite(fi.t) && fi.t > 0;
    const cap = fi.newest ? parseFeedDate(fi.newest) : NaN;
    const time = has ? Math.min(fi.t, nowMs, Number.isFinite(cap) ? cap : Infinity) : NaN;
    return { has, fresh: has && Math.max(0, daysBetween(fi.t, nowMs)) <= FEED_FILE_MAX_DAYS, stamp: has ? sqliteTime(time) : '',
      capped: has && Number.isFinite(cap) && cap < Math.min(fi.t, nowMs), ageDays: has ? Math.max(0, daysBetween(fi.t, nowMs)) : null, path: fi.path };
  });
  const rowTime = f => (feed.files && feed.files.length ? timed[f.fi] : timed[0]) || { has: false, fresh: false, stamp: '', capped: false };
  const freshest = timed.filter(x => x.has).sort((a, b) => a.ageDays - b.ageDays)[0] || null;
  const hasFileTime = Boolean(freshest);
  const fileAgeDays = freshest ? freshest.ageDays : null;
  const datesOk = Boolean(freshest && freshest.fresh);
  const stamp = freshest ? freshest.stamp : '';
  const oldFiles = timed.filter(x => x.has && !x.fresh).map(x => ({ file: basename(x.path || ''), ageDays: Math.round(x.ageDays * 10) / 10 }));
  const dateBlock = !hasFileTime ? 'no-file-time' : (datesOk ? '' : 'old-file');
  const skip = stale ? 'stale-feed' : (requireDates && !datesOk ? dateBlock : '');
  const { cutoff, checkFrom } = viewDays(nowMs);
  const isHidden = d => !d || d < cutoff;

  const changes = [];
  const gone = [];
  const bigPrice = [];
  const acceptedJumps = [];
  const currencySkip = [];
  const seenAll = [];
  const why = new Map();
  const goneDates = {};
  let same = 0, newer = 0, noPrice = 0, oldOnly = 0, cappedRows = 0;
  const oldCands = [];
  for (const r of active) {
    const id = Number(r.id);
    const oldDate = dateText(r.updated_at);
    const f = matchRow(r, feed);
    if (!f) { gone.push(id); goneDates[id] = oldDate; why.set(id, 'gone'); continue; }
    const rt = rowTime(f);
    // The database changed this row after its feed file was downloaded: the feed is older than what the site shows.
    if (rt.stamp && oldDate && dateKey(oldDate) > rt.stamp) { newer++; why.set(id, 'newer'); continue; }
    // Found only in a file older than 2 days (a fresh file of the same shop does not have it): no date. The one-paste
    // mode changes nothing on such a row; the per-pair mode still updates its values, without a date.
    if (!rt.fresh) oldOnly++;
    if (!rt.fresh && requireDates) { why.set(id, 'old-file'); oldCands.push(oldDate); continue; }
    const set = {}, old = {};
    let price = 'none';
    if (Number.isFinite(f.price) && f.price > 0) {
      const curCurrency = String(r.currency || 'GBP').toUpperCase();
      const oldPrice = Number(r.price);
      if (f.currency && f.currency !== curCurrency) { currencySkip.push({ id, from: curCurrency, to: f.currency }); price = 'currency'; }
      else if (Math.abs(f.price - oldPrice) >= 0.005) {
        const jump = oldPrice > 0 && (f.price > oldPrice * PRICE_JUMP || f.price < oldPrice / PRICE_JUMP);
        const takeJump = jump && acceptJumps && f.price <= oldPrice * ACCEPT_JUMP_MAX && f.price >= oldPrice / ACCEPT_JUMP_MAX;
        if (jump && !takeJump) { bigPrice.push({ id, name: r.product_name || r.awin_product_id, from: oldPrice, to: f.price }); price = 'jump'; }
        else {
          if (takeJump) acceptedJumps.push({ id, name: r.product_name || r.awin_product_id, from: oldPrice, to: f.price });
          set.price = f.price; old.price = oldPrice; price = 'changed';
        }
      } else price = 'same';
    }
    // The feed confirms the price only when it has one, in the site's currency, and it is the price the site will show.
    const confirmed = price === 'same' || price === 'changed';
    if (price === 'none') noPrice++;
    if (!confirmed) why.set(id, price === 'none' ? 'no-price' : price);
    // A picture only when the feed has a real one and it is another picture (an Awin 200px proxy becomes the full image, L38).
    if (f.image && f.image !== String(r.image_url || '')) { set.image_url = f.image; old.image_url = r.image_url ?? null; }
    if (f.inStock !== null && f.inStock !== inStockText(r.stock_status)) {
      // The shop's own word when the site reads it the same way, else the engine's plain words.
      let text = String(f.stockText || '').trim();
      if (!text || inStockText(text) !== f.inStock) text = f.inStock ? 'in stock' : 'out_of_stock';
      set.stock_status = text; old.stock_status = r.stock_status ?? null;
    }
    if (Object.keys(set).length) {
      const stampIt = confirmed && rt.fresh;
      const cols = [...Object.keys(set), ...(stampIt ? ['updated_at'] : [])];
      changes.push({ id, set, old, oldDate, stamp: stampIt ? rt.stamp : '', confirmed, writes: Math.max(...cols.map(cost)), name: r.product_name || '' });
      if (stampIt && rt.capped) cappedRows++;
      if (confirmed) { why.set(id, rt.fresh ? 'dated' : 'old-file'); if (!rt.fresh) oldCands.push(oldDate); }
      continue;
    }
    if (confirmed && !rt.fresh) { why.set(id, 'old-file'); oldCands.push(oldDate); continue; }
    if (confirmed && (!oldDate || dateKey(oldDate) < rt.stamp)) { seenAll.push({ id, old: oldDate, stamp: rt.stamp }); if (rt.capped) cappedRows++; why.set(id, 'dated'); continue; }
    same++;
  }
  // A feed that misses most products, or has none, is more likely a broken download than a closed shop (lessons L108:
  // a header-only feed of a small shop used to hide all of it). The one-paste mode never hides (noHide).
  const safe = feed.rows > 0 && gone.length <= active.length * 0.5;
  const hideAll = safe && !noHide ? gone : [];
  // The budget: changes first (cheap, and they fix prices and pictures), then hides, then the dates of the rows the feed
  // confirmed, oldest first (the ones the sites hide now come back first); the rest waits for the next run.
  let writes = 0;
  const doChanges = [], doHides = [], doSeen = [];
  if (!skip) {
    for (const c of changes) { if (writes + c.writes > maxWrites) break; doChanges.push(c); writes += c.writes; }
    for (const id of hideAll) { if (writes + cost('is_active') > maxWrites) break; doHides.push(id); writes += cost('is_active'); }
    if (datesOk) {
      const ordered = seenAll.slice().sort((a, b) => (a.old < b.old ? -1 : (a.old > b.old ? 1 : a.id - b.id)));
      for (const s of ordered) { if (writes + cost('updated_at') > maxWrites) break; doSeen.push(s); writes += cost('updated_at'); }
    }
  }
  const left = {
    changes: skip ? 0 : changes.length - doChanges.length,
    hides: skip ? 0 : hideAll.length - doHides.length,
    seen: skip || !datesOk ? 0 : seenAll.length - doSeen.length
  };
  // What the visitors will see: rows hidden today (no date in the last 30 days) that get a date now come back, and rows
  // that said "Check price and stock at the retailer" (14-30 days) show their stock again.
  const doneDates = [...doChanges.filter(c => c.stamp).map(c => ({ id: c.id, old: c.oldDate })), ...doSeen];
  const doneIds = new Set(doneDates.map(d => d.id));
  const visible = {
    hiddenNow: active.filter(r => isHidden(dateText(r.updated_at))).length,
    checkNow: active.filter(r => { const d = dateText(r.updated_at); return !isHidden(d) && d < checkFrom; }).length,
    revive: doneDates.filter(d => isHidden(d.old)).length,
    uncheck: doneDates.filter(d => !isHidden(d.old) && d.old < checkFrom).length,
    // With a fresh feed file (the one-paste mode downloads it first): the rows it would bring back.
    reviveIfFresh: stale ? 0 : [...changes.filter(c => c.confirmed && c.stamp).map(c => c.oldDate), ...seenAll.map(s => s.old), ...oldCands].filter(isHidden).length,
    still: {}
  };
  const hiding = new Set(doHides);
  for (const r of active) {
    const id = Number(r.id);
    if (!isHidden(dateText(r.updated_at)) || doneIds.has(id)) continue;
    let reason = why.get(id) || 'same';
    // A shop that changes nothing (stale feed, or no fresh file in the one-paste mode): that is the reason for all.
    if (skip) reason = skip;
    else if (reason === 'dated') reason = 'budget';
    else if (reason === 'gone') reason = noHide ? 'gone-kept' : (!safe ? 'gone-unsafe' : (hiding.has(id) ? 'gone' : 'gone-budget'));
    visible.still[reason] = (visible.still[reason] || 0) + 1;
  }
  const count = col => doChanges.filter(c => col in c.set).length;
  return {
    active: active.length, matched: active.length - gone.length, same, newer, noPrice, changes: doChanges, hides: doHides, seen: doSeen,
    hideDates: Object.fromEntries(doHides.map(id => [id, goneDates[id]])),
    gone: gone.length, safe, noHide, stale, staleDays, skip, datesOk, dateBlock, stamp, stampFromFeed: cappedRows > 0, cappedRows,
    stampCapped: Boolean(freshest && freshest.capped), fileAgeDays, cutoff, checkFrom,
    oldOnly, oldFiles, feedRows: feed.rows, feedNewest: feed.newest || '',
    // The feed gives nothing to work with: not updated for 30 days, empty, or nearly none of the shop's products.
    deadFeed: stale || feed.rows === 0 || (active.length >= 20 && active.length - gone.length <= active.length * 0.05),
    bigPrice, acceptedJumps, currencySkip, writes, left, costs, visible,
    counts: { price: count('price'), image_url: count('image_url'), stock_status: count('stock_status'),
      dated: doChanges.filter(c => c.stamp).length, undated: doChanges.filter(c => !c.stamp).length,
      toOut: doChanges.filter(c => 'stock_status' in c.set && !inStockText(c.set.stock_status)).length,
      toIn: doChanges.filter(c => 'stock_status' in c.set && inStockText(c.set.stock_status)).length }
  };
}

// --- The SQL: as few statements as possible, in small files. ---
const whereIds = ids => (ids.length === 1 ? `id = ${ids[0]}` : `id IN (${ids.join(', ')})`);
export const idsPerStatement = rowCost => Math.max(1, Math.min(IDS_PER_STATEMENT, Math.floor(MAX_WRITES_PER_FILE / Math.max(1, rowCost))));

// The guard against another write between our read and our load (lessons L108): the row must still have a date no later
// than the newest date we read for the ids of this statement. Every tool that writes products sets updated_at to the
// time of writing (datetime('now')), which is later than any date we read, so such a row is left alone; the lookups stay
// by id (no extra rows read). Dates come from D1 itself, so the clock of the PC plays no part.
export function readGuard(dates) {
  const vals = dates.map(dateText).filter(Boolean);
  if (!vals.length) return 'updated_at IS NULL';
  const max = vals.reduce((a, b) => (b > a ? b : a));
  return `(updated_at IS NULL OR updated_at <= ${sq(max)})`;
}

// One statement per group of rows that get exactly the same SET, up to idsPerStatement ids each.
// groups: [{ set: 'col = value, ...', ids: [...], rowCost, read?: Map(id -> date read), extra?: 'is_active = 1',
//   only?: '<date>' (rollback of a dated row: only while the row still has our date) }] -> [{ sql, writes, rows }]
export function groupedStatements(groups) {
  const out = [];
  for (const g of groups) {
    const ids = g.ids.slice().sort((a, b) => a - b);
    const n = idsPerStatement(g.rowCost);
    for (let i = 0; i < ids.length; i += n) {
      const part = ids.slice(i, i + n);
      const where = [whereIds(part)];
      if (g.extra) where.push(g.extra);
      if (g.only) where.push(`updated_at = ${sq(g.only)}`);
      else if (g.read) {
        const missing = part.find(id => !g.read.has(id));
        if (missing !== undefined) throw new Error(`no date read for id ${missing}`);
        where.push(readGuard(part.map(id => g.read.get(id))));
      }
      out.push({ sql: `UPDATE products SET ${g.set} WHERE ${where.join(' AND ')};`, writes: part.length * g.rowCost, rows: part.length });
    }
  }
  return out;
}
function groupBy(items, keyFn, idFn, costFn, more = () => ({})) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, { set: k, ids: [], rowCost: costFn(it), ...more(it) });
    m.get(k).ids.push(idFn(it));
  }
  return [...m.values()];
}
const setText = obj => Object.entries(obj).map(([k, v]) => `${k} = ${sq(v)}`).join(', ');

export function planStatements(p) {
  const cost = col => (p.costs && p.costs[col]) || 1;
  // The date read for every row (the guard); hides use the dates of the rows read too (p.hideDates).
  const read = new Map([...p.changes.map(c => [c.id, c.oldDate]), ...p.seen.map(s => [s.id, s.old]), ...Object.entries(p.hideDates || {}).map(([id, d]) => [Number(id), d])]);
  const changeSet = c => setText({ ...c.set, ...(c.stamp ? { updated_at: c.stamp } : {}) });
  const update = groupedStatements(groupBy(p.changes, changeSet, c => c.id, c => c.writes, () => ({ read })));
  const hide = groupedStatements(p.hides.length ? [{ set: 'is_active = 0', ids: p.hides, rowCost: cost('is_active'), extra: 'is_active = 1', read }] : []);
  // Grouped by identical time (rows of the same feed file share it).
  const seen = groupedStatements(groupBy(p.seen, s => setText({ updated_at: s.stamp || p.stamp }), s => s.id, () => cost('updated_at'), () => ({ read })));
  // The rollback puts back every old value (and the old date), and shows the hidden products again, but only on rows
  // nobody changed after us: a dated row only while it still has our date; the others only while their date is the one
  // we read.
  const oldSet = c => setText({ ...c.old, ...(c.stamp ? { updated_at: c.oldDate || null } : {}) });
  const rollback = [
    ...groupedStatements(groupBy(p.changes, c => `${oldSet(c)}|${c.stamp}`, c => c.id, c => c.writes, c => ({ set: oldSet(c), ...(c.stamp ? { only: c.stamp } : { read }) }))),
    ...groupedStatements(p.hides.length ? [{ set: 'is_active = 1', ids: p.hides, rowCost: cost('is_active'), extra: 'is_active = 0', read }] : []),
    ...groupedStatements(groupBy(p.seen, s => `${setText({ updated_at: s.old || null })}|${s.stamp || p.stamp}`, s => s.id, () => cost('updated_at'), s => ({ set: setText({ updated_at: s.old || null }), only: s.stamp || p.stamp })))
  ];
  return { update, hide, seen, rollback };
}

// Statements -> files of at most MAX_STATEMENTS_PER_FILE statements and MAX_WRITES_PER_FILE rows written.
export function splitFiles(statements, maxStatements = MAX_STATEMENTS_PER_FILE, maxWrites = MAX_WRITES_PER_FILE) {
  const files = [];
  let cur = null;
  for (const s of statements) {
    if (!cur || cur.statements.length >= maxStatements || (cur.statements.length && cur.writes + s.writes > maxWrites)) {
      cur = { statements: [], writes: 0 };
      files.push(cur);
    }
    cur.statements.push(s.sql);
    cur.writes += s.writes;
  }
  return files;
}

export function writePlan(out, p) {
  mkdirSync(out, { recursive: true });
  const st = planStatements(p);
  const files = [];
  const put = (prefix, list) => {
    splitFiles(list).forEach((f, i) => {
      const name = `${prefix}-${String(i + 1).padStart(4, '0')}.sql`;
      writeFileSync(join(out, name), f.statements.join('\n') + '\n');
      files.push({ name, statements: f.statements.length, writes: f.writes });
    });
  };
  put('update', st.update);
  put('hide', st.hide);
  put('seen', st.seen);
  const rollbackFiles = [];
  splitFiles(st.rollback).forEach((f, i) => {
    const name = `rollback-${String(i + 1).padStart(4, '0')}.sql`;
    writeFileSync(join(out, name), f.statements.join('\n') + '\n');
    rollbackFiles.push(name);
  });
  writeFileSync(join(out, 'rollback.sql'), st.rollback.map(s => s.sql).join('\n') + (st.rollback.length ? '\n' : ''));
  writeFileSync(join(out, 'hidden-ids.txt'), p.hides.join('\n') + (p.hides.length ? '\n' : ''));
  const summary = { active: p.active, matched: p.matched, same: p.same, newer: p.newer, noPrice: p.noPrice, changes: p.changes.length,
    hides: p.hides.length, seen: p.seen.length, gone: p.gone, safe: p.safe, noHide: Boolean(p.noHide), stale: p.stale, staleDays: p.staleDays, skip: p.skip,
    datesOk: p.datesOk, dateBlock: p.dateBlock, stamp: p.stamp, stampFromFeed: Boolean(p.stampFromFeed), cappedRows: p.cappedRows || 0,
    oldOnly: p.oldOnly || 0, oldFiles: p.oldFiles || [], feedRows: p.feedRows ?? null, feedNewest: p.feedNewest || '', deadFeed: Boolean(p.deadFeed), fileAgeDays: p.fileAgeDays === null ? null : Math.round(p.fileAgeDays * 10) / 10,
    writes: p.writes, left: p.left, counts: p.counts, costs: p.costs, visible: p.visible, bigPrice: p.bigPrice.length, acceptedJumps: (p.acceptedJumps || []).length,
    still: Object.entries(p.visible.still).map(([reason, n]) => ({ reason, n, text: reasonText(reason) })),
    currencySkip: p.currencySkip.length, statements: files.reduce((n, f) => n + f.statements, 0), files, rollbackFiles };
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

const REASONS = {
  gone: 'δεν υπάρχουν πια στο feed (κρύβονται)', 'gone-budget': 'δεν υπάρχουν πια στο feed (η απόκρυψη περιμένει το όριο εγγραφών)',
  'gone-unsafe': 'λείπουν από ένα feed που μοιάζει μισό ή άδειο', 'gone-kept': 'δεν υπάρχουν πια στο feed (δεν κρύβονται εδώ· χωρίς ημερομηνία φεύγουν μόνα τους στις 30 μέρες)', jump: 'τιμή που αλλάζει πάνω από 3 φορές (να ελεγχθεί)',
  currency: 'άλλο νόμισμα στο feed', 'no-price': 'το feed δεν έχει τιμή', budget: 'όριο εγγραφών (την επόμενη φορά)',
  'old-file': 'βρίσκονται μόνο σε αρχείο feed πάνω από 2 μερών (κατέβασέ το ξανά)', 'no-file-time': 'δεν ξέρω πότε κατέβηκε το feed',
  'stale-feed': 'το feed έχει να ενημερωθεί πάνω από 30 μέρες', newer: 'άλλαξαν μετά τη λήψη του feed', same: 'χωρίς επιβεβαίωση'
};
export const reasonText = k => REASONS[k] || k;

export function renderReport({ retailer, site, feedFiles, feedRows, newest, p }) {
  const fmt = n => new Intl.NumberFormat('en-GB').format(n);
  const L = [];
  L.push(`Feed: ${feedFiles.join(', ')} (${fmt(feedRows)} γραμμές${newest ? `, νεότερη ενημέρωση προϊόντος ${newest}` : ''})`);
  L.push(`Ενεργά προϊόντα ${retailer} στο ${site.toUpperCase()}: ${fmt(p.active)}. Βρέθηκαν στο feed: ${fmt(p.matched)} (ίδια: ${fmt(p.same)}). Δεν υπάρχουν πια στο feed: ${fmt(p.gone)}.`);
  if (p.stale) L.push(`ΠΡΟΣΟΧΗ: το feed έχει να ενημερωθεί ${p.staleDays} μέρες (πάνω από ${STALE_DAYS}). Δεν θα αλλάξει τίποτα (L39).`);
  else if (p.staleDays !== null && p.staleDays > CHECK_AFTER_DAYS) L.push(`ΠΡΟΣΟΧΗ: η νεότερη ενημέρωση προϊόντος μέσα στο feed είναι πριν από ${p.staleDays} μέρες. Το κατάστημα μάλλον δεν ανανεώνει το feed του.`);
  if (p.stamp && !p.stampCapped) L.push(`Ώρα λήψης του feed σε αυτόν τον υπολογιστή: ${p.stamp} UTC (πριν από ${Math.round(p.fileAgeDays * 10) / 10} μέρες). Αυτή η ώρα γράφεται ως «Price checked».`);
  if (p.stamp && p.stampCapped) L.push(`Το feed κατέβηκε πριν από ${Math.round(p.fileAgeDays * 10) / 10} μέρες, αλλά η νεότερη ενημέρωση του ίδιου του feed είναι ${p.stamp} UTC: αυτή γράφεται ως «Price checked» (ποτέ νεότερη από τα στοιχεία του καταστήματος).`);
  if (!p.datesOk && !p.stale) {
    L.push(p.dateBlock === 'old-file'
      ? `ΠΡΟΣΟΧΗ: το αρχείο του feed κατέβηκε πριν από ${Math.floor(p.fileAgeDays)} μέρες (πάνω από ${FEED_FILE_MAX_DAYS}). Δεν γράφεται ΚΑΜΙΑ ημερομηνία για αυτό το κατάστημα. Κατέβασε πρώτα ξανά το feed (το κάνει μόνο του το legacy-refresh με -Stale -Apply). Με φρέσκο feed θα ξαναφαίνονταν περίπου ${fmt(p.visible.reviveIfFresh)} προϊόντα.`
      : 'ΠΡΟΣΟΧΗ: δεν ξέρω πότε κατέβηκε το feed. Δεν γράφεται καμία ημερομηνία.');
  }
  if (p.datesOk && p.oldFiles && p.oldFiles.length) {
    L.push(`Παλιά αρχεία feed του ίδιου καταστήματος (πάνω από ${FEED_FILE_MAX_DAYS} μέρες, το Awin δεν τα δίνει πια): ${p.oldFiles.map(f => `${f.file} (${f.ageDays} ημ.)`).join(', ')}. Κάθε προϊόν παίρνει την ώρα του νεότερου αρχείου όπου υπάρχει.`);
    if (p.oldOnly) L.push(`${fmt(p.oldOnly)} προϊόντα βρίσκονται μόνο στα παλιά αρχεία: δεν παίρνουν ημερομηνία.`);
  }
  if (p.deadFeed && !p.stale) L.push(`ΠΡΟΣΟΧΗ: το feed είναι άδειο ή σχεδόν άδειο (${fmt(p.feedRows || 0)} προϊόντα για ${fmt(p.active)} ενεργά): τα προϊόντα που δεν επιβεβαιώνει φεύγουν από τα sites στις ${HIDE_AFTER_DAYS} μέρες.`);
  if (p.skip === 'old-file' || p.skip === 'no-file-time') L.push('Σε αυτή τη λειτουργία (-Stale) το κατάστημα ΔΕΝ αλλάζει καθόλου μέχρι να κατέβει φρέσκο feed.');
  if (p.noHide) { if (p.gone) L.push(`${fmt(p.gone)} προϊόντα δεν υπάρχουν πια στο feed: σε αυτή τη λειτουργία δεν κρύβονται, δεν παίρνουν ημερομηνία και φεύγουν μόνα τους από το site στις ${HIDE_AFTER_DAYS} μέρες.`); }
  else if (!p.safe) L.push(`ΠΡΟΣΟΧΗ: λείπουν από το feed πάνω από τα μισά ενεργά προϊόντα ή το feed δεν έχει κανένα (${fmt(p.gone)} από ${fmt(p.active)}). Μάλλον δεν κατέβηκε ολόκληρο: ΔΕΝ θα κρυφτεί κανένα.`);
  L.push(`Αλλαγές: τιμή ${fmt(p.counts.price)}, εικόνα ${fmt(p.counts.image_url)}, απόθεμα ${fmt(p.counts.stock_status)} (σε απόθεμα ξανά: ${fmt(p.counts.toIn)}, εξαντλήθηκαν: ${fmt(p.counts.toOut)}). Απόκρυψη: ${fmt(p.hides.length)}.`);
  if (p.datesOk) L.push(`Επιβεβαίωση από το feed (L108): ${fmt(p.seen.length)} προϊόντα χωρίς άλλη αλλαγή παίρνουν ημερομηνία ${p.stamp}, και ${fmt(p.counts.dated)} από τις αλλαγές την ίδια.`);
  if (p.newer) L.push(`${fmt(p.newer)} προϊόντα άλλαξαν στη βάση ΜΕΤΑ τη λήψη του feed: δεν αλλάζουν.`);
  const v = p.visible;
  L.push(`Στο site: κρυμμένα σήμερα (πάνω από ${HIDE_AFTER_DAYS} μέρες) ${fmt(v.hiddenNow)}, με «Check price and stock at the retailer» (${CHECK_AFTER_DAYS}-${HIDE_AFTER_DAYS} μέρες) ${fmt(v.checkNow)}.`);
  L.push(`Θα φαίνονται ξανά: ${fmt(v.revive)}. Θα δείχνουν ξανά απόθεμα: ${fmt(v.uncheck)}.`);
  const still = Object.entries(v.still).filter(([, n]) => n > 0);
  if (still.length) L.push(`Μένουν κρυμμένα: ${still.map(([k, n]) => `${fmt(n)} ${reasonText(k)}`).join('; ')}.`);
  L.push(`Εγγραφές D1: περίπου ${fmt(p.writes)} (ανά προϊόν: τιμή ${p.costs.price}, εικόνα ${p.costs.image_url}, απόθεμα ${p.costs.stock_status}, ημερομηνία ${p.costs.updated_at}, απόκρυψη ${p.costs.is_active}).`);
  if (p.left.changes || p.left.hides || p.left.seen) L.push(`Όριο εγγραφών: ${fmt(p.left.changes)} αλλαγές, ${fmt(p.left.hides)} αποκρύψεις και ${fmt(p.left.seen)} ημερομηνίες μένουν για την επόμενη εκτέλεση (κάθε εκτέλεση ξαναϋπολογίζει μόνο όσα διαφέρουν).`);
  if (p.bigPrice.length) {
    L.push(`ΠΡΟΣΟΧΗ: ${fmt(p.bigPrice.length)} τιμές αλλάζουν πάνω από ${PRICE_JUMP} φορές. ΔΕΝ αλλάζουν και δεν παίρνουν ημερομηνία· να ελεγχθούν:`);
    for (const b of p.bigPrice.slice(0, 15)) L.push(`   - ${String(b.name).slice(0, 90)}: ${b.from} -> ${b.to}`);
  }
  if (p.acceptedJumps && p.acceptedJumps.length) {
    L.push(`Δεκτές με -AcceptJumps: ${fmt(p.acceptedJumps.length)} τιμές που αλλάζουν πάνω από ${PRICE_JUMP} φορές (έως ${ACCEPT_JUMP_MAX}) αλλάζουν κανονικά και παίρνουν ημερομηνία:`);
    for (const b of p.acceptedJumps.slice(0, 15)) L.push(`   - ${String(b.name).slice(0, 90)}: ${b.from} -> ${b.to}`);
  }
  if (p.currencySkip.length) L.push(`ΠΡΟΣΟΧΗ: ${fmt(p.currencySkip.length)} προϊόντα έχουν άλλο νόμισμα στο feed (${p.currencySkip[0].from} -> ${p.currencySkip[0].to}). Η τιμή τους δεν αλλάζει και δεν παίρνουν ημερομηνία.`);
  const samples = p.changes.filter(c => 'price' in c.set).slice(0, 8);
  if (samples.length) {
    L.push('Δείγματα αλλαγών τιμής:');
    for (const c of samples) L.push(`   - ${String(c.name).slice(0, 80)}: ${c.old.price} -> ${c.set.price}`);
  }
  return L.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
  const all = k => args.flatMap((a, i) => a === k ? [args[i + 1]] : []);
  const archive = resolve(opt('--archive'));
  const out = resolve(opt('--out'));
  const now = opt('--now') ? new Date(opt('--now')) : new Date();
  mkdirSync(out, { recursive: true });
  if (args.includes('--find')) {
    const lines = readFileSync(opt('--retailers-file'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(s => s.trim());
    const entries = lines.map(l => { const [retailer, advertiser = ''] = l.split('\t'); return { retailer: retailer.trim(), advertiser: advertiser.trim() }; });
    writeFileSync(join(out, 'feeds.json'), JSON.stringify(await findFeedsFor(archive, entries, now.getTime()), null, 2));
    process.exit(0);
  }
  const retailer = opt('--retailer');
  const site = opt('--site') || 'site';
  const maxWrites = Number(opt('--max-writes') || 90000);
  // --feed-file <name>: the files the one-paste mode already found (feeds.json), so the archive is not read again.
  const given = all('--feed-file').map(f => resolveFeedFile(archive, f)).filter(Boolean);
  const { files: found, names } = given.length ? { files: given, names: {} } : await findFeeds(archive, retailer, opt('--advertiser'));
  if (!found.length) {
    const similar = Object.entries(names).filter(([, n]) => n && keyOf(n).includes(keyOf(retailer).split('-')[0])).map(([f, n]) => `${f}: ${n}`);
    writeFileSync(join(out, 'report.txt'), `Δεν βρέθηκε feed με merchant_name "${retailer}" στο ${archive}.${similar.length ? `\nΠαρόμοια: ${similar.join('; ')}` : ''}\n`);
    process.exit(3);
  }
  const pick = pickFeedFiles(found);
  const files = pick.files;
  // Rows of a whole site (the one-paste mode reads them once, with their retailer): only this shop's rows.
  const rows = all('--rows').flatMap(f => rowsFromWrangler(readFileSync(f, 'utf8'))).filter(r => !('retailer' in r) || String(r.retailer) === retailer);
  // The site's own currency for this shop (most of its rows): a shop with one feed per currency (Cronjager) is matched
  // by its page to the feed row in that currency (L113).
  const curCount = {};
  for (const r of rows) { const c = String(r.currency || 'GBP').toUpperCase(); curCount[c] = (curCount[c] || 0) + 1; }
  const currency = Object.entries(curCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'GBP';
  const feed = await readFeed(files, undefined, { currency });
  const costs = writeCosts(opt('--indexes') && existsSync(opt('--indexes')) ? rowsFromWrangler(readFileSync(opt('--indexes'), 'utf8')) : []);
  const p = planRefresh({ rows, feed, costs, maxWrites, now, feedTime: pick.feedTime, requireDates: args.includes('--require-dates'), noHide: args.includes('--no-hide'), acceptJumps: args.includes('--accept-jumps') });
  const summary = writePlan(out, p);
  const ages = pick.times.map(t => Math.floor((now.getTime() - t) / DAY));
  writeFileSync(join(out, 'report.txt'), renderReport({ retailer, site, feedFiles: files.map((f, i) => `${basename(f)} (αρχείο ${ages[i]} ημ.)`), feedRows: feed.rows, newest: feed.newest, p }));
  writeFileSync(join(out, 'counts.txt'), `${summary.changes} ${summary.hides} ${summary.writes} ${summary.stale ? 1 : 0} ${summary.safe ? 1 : 0} ${summary.active} ${summary.seen} ${p.visible.revive} ${p.datesOk ? 1 : 0} ${summary.files.length}\n`);
}
