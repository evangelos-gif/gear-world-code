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
//   - the date written is the time the feed FILE was downloaded (its time on this PC), never "now" and never later; a
//     feed file downloaded more than 2 days before the run writes no date at all (download it again first). The rows
//     that change get the same date; a row the database changed after the download is newer than the feed: untouched;
//   - no date on a price held back by the price-jump rule, on another currency, without a feed price, on a hidden row
//     or on a row not in the feed;
//   - active products that are no longer in the feed are hidden (is_active = 0, nothing is deleted, no date);
//   - hidden products stay hidden: a clean-up may have hidden them on purpose (one card per product, misfits...);
//   - a price that changes more than 3 times up or down is not changed but listed for a person to check;
//   - a feed whose products were last updated more than 30 days ago changes nothing (lessons L39: stale feeds);
//   - a feed that misses more than half of the active products hides nothing (more likely a broken download);
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
// node tools/legacy-refresh-plan.mjs --find --archive <dir> --retailers-file <one name per line> --out <dir> [--now ...]
//   writes feeds.json: the feed files of every shop (advertiser, feed id, time of the file), read-only.
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords, parsePrice } from './tgw-import-plan.mjs';
import { stockFlag, pickImage } from './legacy-import-plan.mjs';
import { rowsFromWrangler } from './cleanup-rules/tidy.mjs';
import { IN_STOCK_WORDS } from '../src/db.js';
import { HIDE_AFTER_DAYS, CHECK_AFTER_DAYS } from '../src/lib/visibility.js';

export const STALE_DAYS = 30;
export const PRICE_JUMP = 3;
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

// The Awin feed files of one retailer: AWIN_<advertiser>_<feed>.csv(.gz) whose merchant_name is the retailer's name on the
// site (or the advertiser id given). Reads only the first rows of each file.
export async function findFeeds(archive, retailer, advertiser = '') {
  const files = readdirSync(archive).filter(f => FEED_FILE.test(f)).sort();
  if (advertiser) return { files: files.filter(f => f.split('_')[1] === String(advertiser)).map(f => join(archive, f)), names: {} };
  const want = keyOf(retailer);
  const names = await merchantNames(archive, files);
  return { files: files.filter(f => names[f] && keyOf(names[f]) === want).map(f => join(archive, f)), names };
}

export async function merchantNames(archive, files) {
  const names = {};
  for (const f of files) names[f] = await firstMerchantName(join(archive, f));
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

// The feeds of many shops in one pass over the archive (the one-paste mode, lessons L108).
export async function findFeedsFor(archive, retailers, nowMs = Date.now()) {
  const files = readdirSync(archive).filter(f => FEED_FILE.test(f)).sort();
  const names = await merchantNames(archive, files);
  return retailers.map(retailer => {
    const want = keyOf(retailer);
    const hits = files.filter(f => names[f] && keyOf(names[f]) === want).map(f => join(archive, f));
    const pick = pickFeedFiles(hits);
    const similar = hits.length ? [] : Object.entries(names).filter(([, n]) => n && want && keyOf(n).includes(want.split('-')[0])).map(([f, n]) => `${f}: ${n}`).slice(0, 5);
    return {
      retailer,
      files: pick.files.map((f, i) => {
        const m = FEED_FILE.exec(basename(f));
        return { file: basename(f), advertiser: m[1], feed: m[2], time: sqliteTime(pick.times[i]), ageDays: Math.round(((nowMs - pick.times[i]) / DAY) * 10) / 10 };
      }),
      advertisers: [...new Set(pick.files.map(f => FEED_FILE.exec(basename(f))[1]))],
      feedTime: Number.isFinite(pick.feedTime) ? sqliteTime(pick.feedTime) : '',
      ageDays: Number.isFinite(pick.feedTime) ? Math.round(((nowMs - pick.feedTime) / DAY) * 10) / 10 : null,
      similar
    };
  });
}

// One entry per feed row, found by Awin product id and by the shop's own product id.
export async function readFeed(paths) {
  const byAw = new Map();
  const byMid = new Map();
  let rows = 0, newest = '';
  for (const f of paths) {
    const raw = createReadStream(f);
    const stream = /\.gz$/i.test(f) ? raw.pipe(createGunzip()) : raw;
    let h = null;
    for await (const rec of readCsvRecords(stream)) {
      if (!h) { h = rec.map(x => String(x).trim().toLowerCase().replace(/^﻿/, '')); continue; }
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
  return { byAw, byMid, rows, newest };
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
export function planRefresh({ rows, feed, costs, maxWrites = 90000, now = new Date(), feedTime = NaN, requireDates = false }) {
  const nowMs = now.getTime();
  const cost = col => (costs && costs[col]) || 1;
  const active = rows.filter(r => Number(r.is_active) === 1);
  const newestTime = feed.newest ? parseFeedDate(feed.newest) : NaN;
  const staleDays = Number.isFinite(newestTime) ? Math.floor(daysBetween(newestTime, nowMs)) : null;
  const stale = staleDays !== null && staleDays > STALE_DAYS;
  const fileTime = Number(feedTime);
  const hasFileTime = Number.isFinite(fileTime) && fileTime > 0;
  const fileAgeDays = hasFileTime ? Math.max(0, daysBetween(fileTime, nowMs)) : null;
  const datesOk = hasFileTime && fileAgeDays <= FEED_FILE_MAX_DAYS;
  // Never later than the download (and never later than now, if the PC clock put the file in the future).
  const stamp = hasFileTime ? sqliteTime(Math.min(fileTime, nowMs)) : '';
  const dateBlock = !hasFileTime ? 'no-file-time' : (datesOk ? '' : 'old-file');
  const skip = stale ? 'stale-feed' : (requireDates && !datesOk ? dateBlock : '');
  const { cutoff, checkFrom } = viewDays(nowMs);
  const isHidden = d => !d || d < cutoff;

  const changes = [];
  const gone = [];
  const bigPrice = [];
  const currencySkip = [];
  const seenAll = [];
  const why = new Map();
  let same = 0, newer = 0, noPrice = 0;
  for (const r of active) {
    const id = Number(r.id);
    const oldDate = dateText(r.updated_at);
    const f = matchRow(r, feed);
    if (!f) { gone.push(id); why.set(id, 'gone'); continue; }
    // The database changed this row after the feed was downloaded: the feed is older than what the site shows.
    if (stamp && oldDate && dateKey(oldDate) > stamp) { newer++; why.set(id, 'newer'); continue; }
    const set = {}, old = {};
    let price = 'none';
    if (Number.isFinite(f.price) && f.price > 0) {
      const curCurrency = String(r.currency || 'GBP').toUpperCase();
      const oldPrice = Number(r.price);
      if (f.currency && f.currency !== curCurrency) { currencySkip.push({ id, from: curCurrency, to: f.currency }); price = 'currency'; }
      else if (Math.abs(f.price - oldPrice) >= 0.005) {
        if (oldPrice > 0 && (f.price > oldPrice * PRICE_JUMP || f.price < oldPrice / PRICE_JUMP)) { bigPrice.push({ id, name: r.product_name || r.awin_product_id, from: oldPrice, to: f.price }); price = 'jump'; }
        else { set.price = f.price; old.price = oldPrice; price = 'changed'; }
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
      const stampIt = confirmed && datesOk;
      const cols = [...Object.keys(set), ...(stampIt ? ['updated_at'] : [])];
      changes.push({ id, set, old, oldDate, stamp: stampIt ? stamp : '', confirmed, writes: Math.max(...cols.map(cost)), name: r.product_name || '' });
      if (confirmed) why.set(id, 'dated');
      continue;
    }
    if (confirmed && (!oldDate || !stamp || dateKey(oldDate) < stamp)) { seenAll.push({ id, old: oldDate }); why.set(id, 'dated'); continue; }
    same++;
  }
  // A feed that misses most products is more likely a broken download than a closed shop.
  const safe = !(active.length >= 100 && gone.length > active.length * 0.5);
  const hideAll = safe ? gone : [];
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
    reviveIfFresh: stale ? 0 : [...changes.filter(c => c.confirmed).map(c => c.oldDate), ...seenAll.map(s => s.old)].filter(isHidden).length,
    still: {}
  };
  const hiding = new Set(doHides);
  for (const r of active) {
    const id = Number(r.id);
    if (!isHidden(dateText(r.updated_at)) || doneIds.has(id)) continue;
    let reason = why.get(id) || 'same';
    // A shop that changes nothing (stale feed, or no fresh file in the one-paste mode): that is the reason for all.
    if (skip) reason = skip;
    else if (reason === 'dated') reason = datesOk ? 'budget' : dateBlock;
    else if (reason === 'gone') reason = !safe ? 'gone-unsafe' : (hiding.has(id) ? 'gone' : 'gone-budget');
    visible.still[reason] = (visible.still[reason] || 0) + 1;
  }
  const count = col => doChanges.filter(c => col in c.set).length;
  return {
    active: active.length, matched: active.length - gone.length, same, newer, noPrice, changes: doChanges, hides: doHides, seen: doSeen,
    gone: gone.length, safe, stale, staleDays, skip, datesOk, dateBlock, stamp, fileAgeDays, cutoff, checkFrom,
    bigPrice, currencySkip, writes, left, costs, visible,
    counts: { price: count('price'), image_url: count('image_url'), stock_status: count('stock_status'),
      dated: doChanges.filter(c => c.stamp).length, undated: doChanges.filter(c => !c.stamp).length,
      toOut: doChanges.filter(c => 'stock_status' in c.set && !inStockText(c.set.stock_status)).length,
      toIn: doChanges.filter(c => 'stock_status' in c.set && inStockText(c.set.stock_status)).length }
  };
}

// --- The SQL: as few statements as possible, in small files. ---
const whereIds = ids => (ids.length === 1 ? `id = ${ids[0]}` : `id IN (${ids.join(', ')})`);
export const idsPerStatement = rowCost => Math.max(1, Math.min(IDS_PER_STATEMENT, Math.floor(MAX_WRITES_PER_FILE / Math.max(1, rowCost))));

// One statement per group of rows that get exactly the same SET, up to idsPerStatement ids each.
// groups: [{ set: 'col = value, ...', ids: [...], rowCost }] -> [{ sql, writes }]
export function groupedStatements(groups) {
  const out = [];
  for (const g of groups) {
    const ids = g.ids.slice().sort((a, b) => a - b);
    const n = idsPerStatement(g.rowCost);
    for (let i = 0; i < ids.length; i += n) {
      const part = ids.slice(i, i + n);
      out.push({ sql: `UPDATE products SET ${g.set} WHERE ${whereIds(part)};`, writes: part.length * g.rowCost, rows: part.length });
    }
  }
  return out;
}
function groupBy(items, keyFn, idFn, costFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, { set: k, ids: [], rowCost: costFn(it) });
    m.get(k).ids.push(idFn(it));
  }
  return [...m.values()];
}
const setText = obj => Object.entries(obj).map(([k, v]) => `${k} = ${sq(v)}`).join(', ');

export function planStatements(p) {
  const cost = col => (p.costs && p.costs[col]) || 1;
  const changeSet = c => setText({ ...c.set, ...(c.stamp ? { updated_at: c.stamp } : {}) });
  const update = groupedStatements(groupBy(p.changes, changeSet, c => c.id, c => c.writes));
  const hide = groupedStatements(p.hides.length ? [{ set: 'is_active = 0', ids: p.hides, rowCost: cost('is_active') }] : []);
  const seen = groupedStatements(p.seen.length ? [{ set: `updated_at = ${sq(p.stamp)}`, ids: p.seen.map(s => s.id), rowCost: cost('updated_at') }] : []);
  // The rollback puts back every old value (and the old date), and shows the hidden products again.
  const oldSet = c => setText({ ...c.old, ...(c.stamp ? { updated_at: c.oldDate || null } : {}) });
  const rollback = [
    ...groupedStatements(groupBy(p.changes, oldSet, c => c.id, c => c.writes)),
    ...groupedStatements(p.hides.length ? [{ set: 'is_active = 1', ids: p.hides, rowCost: cost('is_active') }] : []),
    ...groupedStatements(groupBy(p.seen, s => setText({ updated_at: s.old || null }), s => s.id, () => cost('updated_at')))
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
    hides: p.hides.length, seen: p.seen.length, gone: p.gone, safe: p.safe, stale: p.stale, staleDays: p.staleDays, skip: p.skip,
    datesOk: p.datesOk, dateBlock: p.dateBlock, stamp: p.stamp, fileAgeDays: p.fileAgeDays === null ? null : Math.round(p.fileAgeDays * 10) / 10,
    writes: p.writes, left: p.left, counts: p.counts, costs: p.costs, visible: p.visible, bigPrice: p.bigPrice.length,
    still: Object.entries(p.visible.still).map(([reason, n]) => ({ reason, n, text: reasonText(reason) })),
    currencySkip: p.currencySkip.length, statements: files.reduce((n, f) => n + f.statements, 0), files, rollbackFiles };
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

const REASONS = {
  gone: 'δεν υπάρχουν πια στο feed (κρύβονται)', 'gone-budget': 'δεν υπάρχουν πια στο feed (η απόκρυψη περιμένει το όριο εγγραφών)',
  'gone-unsafe': 'λείπουν από ένα feed που μοιάζει μισό', jump: 'τιμή που αλλάζει πάνω από 3 φορές (να ελεγχθεί)',
  currency: 'άλλο νόμισμα στο feed', 'no-price': 'το feed δεν έχει τιμή', budget: 'όριο εγγραφών (την επόμενη φορά)',
  'old-file': 'το αρχείο του feed είναι παλιό (κατέβασέ το ξανά)', 'no-file-time': 'δεν ξέρω πότε κατέβηκε το feed',
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
  if (p.stamp) L.push(`Ώρα λήψης του feed σε αυτόν τον υπολογιστή: ${p.stamp} UTC (πριν από ${Math.round(p.fileAgeDays * 10) / 10} μέρες). Αυτή η ώρα γράφεται ως «Price checked».`);
  if (!p.datesOk && !p.stale) {
    L.push(p.dateBlock === 'old-file'
      ? `ΠΡΟΣΟΧΗ: το αρχείο του feed κατέβηκε πριν από ${Math.floor(p.fileAgeDays)} μέρες (πάνω από ${FEED_FILE_MAX_DAYS}). Δεν γράφεται ΚΑΜΙΑ ημερομηνία για αυτό το κατάστημα. Κατέβασε πρώτα ξανά το feed (το κάνει μόνο του το legacy-refresh με -Stale -Apply). Με φρέσκο feed θα ξαναφαίνονταν περίπου ${fmt(p.visible.reviveIfFresh)} προϊόντα.`
      : 'ΠΡΟΣΟΧΗ: δεν ξέρω πότε κατέβηκε το feed. Δεν γράφεται καμία ημερομηνία.');
  }
  if (p.skip === 'old-file' || p.skip === 'no-file-time') L.push('Σε αυτή τη λειτουργία (-Stale) το κατάστημα ΔΕΝ αλλάζει καθόλου μέχρι να κατέβει φρέσκο feed.');
  if (!p.safe) L.push(`ΠΡΟΣΟΧΗ: λείπουν από το feed πάνω από τα μισά ενεργά προϊόντα (${fmt(p.gone)} από ${fmt(p.active)}). Μάλλον δεν κατέβηκε ολόκληρο: ΔΕΝ θα κρυφτεί κανένα.`);
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
    const names = readFileSync(opt('--retailers-file'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    writeFileSync(join(out, 'feeds.json'), JSON.stringify(await findFeedsFor(archive, names, now.getTime()), null, 2));
    process.exit(0);
  }
  const retailer = opt('--retailer');
  const site = opt('--site') || 'site';
  const maxWrites = Number(opt('--max-writes') || 90000);
  // --feed-file <name>: the files the one-paste mode already found (feeds.json), so the archive is not read again.
  const given = all('--feed-file').filter(f => FEED_FILE.test(basename(f))).map(f => join(archive, basename(f))).filter(f => existsSync(f));
  const { files: found, names } = given.length ? { files: given, names: {} } : await findFeeds(archive, retailer, opt('--advertiser'));
  if (!found.length) {
    const similar = Object.entries(names).filter(([, n]) => n && keyOf(n).includes(keyOf(retailer).split('-')[0])).map(([f, n]) => `${f}: ${n}`);
    writeFileSync(join(out, 'report.txt'), `Δεν βρέθηκε feed με merchant_name "${retailer}" στο ${archive}.${similar.length ? `\nΠαρόμοια: ${similar.join('; ')}` : ''}\n`);
    process.exit(3);
  }
  const pick = pickFeedFiles(found);
  const files = pick.files;
  const feed = await readFeed(files);
  const rows = all('--rows').flatMap(f => rowsFromWrangler(readFileSync(f, 'utf8')));
  const costs = writeCosts(opt('--indexes') && existsSync(opt('--indexes')) ? rowsFromWrangler(readFileSync(opt('--indexes'), 'utf8')) : []);
  const p = planRefresh({ rows, feed, costs, maxWrites, now, feedTime: pick.feedTime, requireDates: args.includes('--require-dates') });
  const summary = writePlan(out, p);
  const ages = pick.times.map(t => Math.floor((now.getTime() - t) / DAY));
  writeFileSync(join(out, 'report.txt'), renderReport({ retailer, site, feedFiles: files.map((f, i) => `${basename(f)} (αρχείο ${ages[i]} ημ.)`), feedRows: feed.rows, newest: feed.newest, p }));
  writeFileSync(join(out, 'counts.txt'), `${summary.changes} ${summary.hides} ${summary.writes} ${summary.stale ? 1 : 0} ${summary.safe ? 1 : 0} ${summary.active} ${summary.seen} ${p.visible.revive} ${p.datesOk ? 1 : 0} ${summary.files.length}\n`);
}
