// The catalogue of the big Linkwise stores of Mega Stores Gear World (owner, 24 Nov 2026, lessons L228, L231).
//
//   node tools/ogw-catalog.mjs --archive <GW_AWIN_BULK_ARCHIVE> --out <folder> --program 138,13026 [--full 13026]
//                              [--state <folder>] [--have 138=<load id>,...] [--config <file>] [--now <ISO>]
//
// For each programme it reads the store's own Linkwise product feed (LINKWISE_<programme>.csv.gz with the Awin column
// names, read at most 23 hours ago, as for the prices of L227) and writes SQL files for the store's own D1 database
// (sites/ogw/catalog-schema.sql): every product in stock, in euros, with an https photo and a page on the store's own
// address, in the store's own categories (merchant_category, its first three levels; AB, whose feed has no category
// names, from the address of each product: tools/ogw-catalog-paths.mjs). Rows that share one page (sizes, shades) are
// one product, and only when they agree on the price (else it is left out: no price is guessed); a product id seen
// twice is kept once. Each category gets a photo: one of its dearer products (the middle of its 20 dearest), so the
// card shows a main product, not an accessory.
// Two ways to send a store (each statement at most 90 KB, each file at most 20 MB):
//   full (--full, a store that is new, stopped half-way or -Reload): marked "loading", its old rows out (DELETE), every
//        product in (INSERT OR REPLACE: a file can be sent twice), its categories, its row in stores, no longer loading.
//   refresh (every other store, L231: D1 bills every row written, so a daily full load would cost ~$110-210 a month):
//        only what changed since the last load that ended well (--state <folder>/<programme>.tsv: the id and two hashes
//        of each product as it was sent, under the id of that load), as INSERT ... ON CONFLICT DO UPDATE ...
//        WHERE something differs; a product whose place and categories did not change updates only its own columns
//        (D1 writes no index row for it: ~1 row instead of ~4). The state file counts only when its load id is the one
//        the database has for the store (stores.run, written by the store's last statement; --have from the table
//        stores): a restore, another PC or a send that did not end well make them differ. Without a state file that counts, every product goes, with the same WHERE, so a row that
//        is already right is not written again. Then, a range of ids at a time (the primary key), the products of the
//        store that are no longer in the feed go (DELETE ... NOT IN), the categories the same way, and its row in stores
//        (the time of the feed). The store stays on the site the whole time: never half a store, never "loading".
// Each OK store also gets <programme>.state (its id and hash list), which tools/ogw-site.ps1 keeps as the next run's
// --state file only after every file of that store was sent.
// Nothing is sent from here: tools/ogw-site.ps1 -Step catalog sends the files, in order, with the owner's phrase; only a
// store that ends OK has files (they are written under a temporary name first). No affiliate code: the products keep
// the store's own page, without tracking parameters, and a page or photo with a code of ours in it is left out. ASCII
// lines on stdout, never stderr (Windows PowerShell 5.1):
//   CATALOG <slug> <programme> <OK|OLD|MISSING|NONE|ERROR> <products> <categories> <left out> <feed ISO or -> <files>
//           <full|refresh|check> <products sent> <products gone, -1 unknown>
//   CATALOG-DONE <stores> <products> <files>
import { createReadStream, existsSync, mkdirSync, openSync, closeSync, writeSync, writeFileSync, readFileSync, statSync, renameSync, rmSync, readdirSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';
import { pageKey } from '../src/lib/price-key.js';
import { directStoresFromConfig, pricesFromFeed, FEED_MAX_AGE_MS } from './ogw-prices.mjs';
import { PATH_CATEGORIES, pathLevels } from './ogw-catalog-paths.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MAX_STATEMENT = 90000;
export const MAX_FILE = 20 * 1024 * 1024;
export const OTHER = 'Άλλα'; // "Other" in Greek, for products without a category
const CONTROL = /[\u0000-\u001f\u007f]+/g;
export const clean = (v, max) => String(v ?? '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const sq = v => `'${String(v).replace(/'/g, "''")}'`;
const euro = v => { const n = Number(String(v || '').trim()); return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : 0; };
function fnv(s, basis = 0x811c9dc5) {
  let h = basis;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
// A stable place in the list (the same every day, so the order of a category does not move): 52 bits from two hashes.
export const position = pid => fnv(pid) * 1048576 + (fnv(pid, 0x01000193) >>> 12);
// Greek to Latin for the address of a category (its name stays as the store writes it).
const GR = { 'α': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'i', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'f', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o' };
export function catSlug(name) {
  const s = String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[α-ως]/g, ch => GR[ch] || '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return s || 'c';
}
// The store's own page of a product: https, on one of the store's own addresses (the www one when the feed has none).
export function storePage(raw, hosts) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  if (u.username || u.password || u.port) return '';
  let host = u.hostname.toLowerCase();
  if (!hosts.includes(host) && hosts.includes(`www.${host}`)) host = `www.${host}`;
  if (!hosts.includes(host)) return '';
  u.protocol = 'https:';
  u.hostname = host;
  u.hash = '';
  for (const [k, v] of [...u.searchParams]) if (TRACKING.test(k) || AFF.test(k) || AFF.test(v)) u.searchParams.delete(k);
  const out = u.toString();
  return out.length <= 1000 && !AFF.test(out) ? out : '';
}
// Our Linkwise code is upper-case CD + digits; case-sensitive and whole, so a model name (philips-cd1201b) or a photo
// hash (…3acd1234…) is never taken for it (second review 24/11/2026).
const AFF = /(?<![A-Za-z0-9])CD\d{3,9}(?![0-9])/;
const TRACKING = /^(utm_.*|gclid|fbclid|msclkid|mc_cid|mc_eid|_ga|aff.*|ref|source|lw.*|linkwise.*|clickid|click_id|sub_?id.*)$/i;
// The store's photo, https. An http photo on the store's own domain (e-shop.gr: http://images.e-shop.gr/…, which also
// answers on https, 24/11/2026) is moved to https; one elsewhere on http stays out (a browser blocks it on our pages).
const baseOf = host => String(host).toLowerCase().replace(/^www\./, '');
const photo = (raw, hosts = []) => {
  let s = String(raw || '').trim();
  const m = /^http:\/\/([^/\s"'<>:@]+)(\/[^\s"'<>]*)?$/i.exec(s);
  if (m) {
    const host = m[1].toLowerCase();
    if (hosts.some(h => host === baseOf(h) || host.endsWith(`.${baseOf(h)}`))) s = `https://${host}${m[2] || '/'}`;
  }
  return /^https:\/\/[^\s"'<>]+$/.test(s) && s.length <= 1000 && !AFF.test(s) ? s : '';
};
export function levels(category) {
  const raw = String(category || '').replace(/&gt;/gi, '>');
  let parts = raw.split('>').map(x => clean(x, 80)).filter(Boolean).slice(0, 3);
  // Public writes its tree with " - " (Βιβλία & Κόμικς - Ξενόγλωσσα - Θετικές - Τεχνολογικές Επιστήμες, 24/11/2026): the
  // first two are levels, the rest is the third, whole (a name can hold " - " itself).
  if (!raw.includes('>') && raw.includes(' - ')) {
    const d = raw.split(' - ').map(x => clean(x, 200)).filter(Boolean);
    parts = [d[0], d[1], d.slice(2).join(' - ')].filter(Boolean).map(x => clean(x, 80));
  }
  return parts.length ? parts : [OTHER];
}

function feedStream(file) {
  const gz = createGunzip();
  pipeline(createReadStream(file), gz, () => {});
  return gz;
}
async function* rows(file) {
  let header = null;
  for await (const rec of readCsvRecords(feedStream(file))) {
    if (!header) { header = rec.map(h => String(h).trim().toLowerCase().replace(/^﻿/, '')); continue; }
    const get = n => { const i = header.indexOf(n); return i >= 0 ? String(rec[i] ?? '') : ''; };
    yield get;
  }
}
const rowOf = (get, hosts, program = 0) => {
  const page = storePage(get('merchant_deep_link'), hosts);
  const byPath = PATH_CATEGORIES[program];
  return {
  page,
  image: photo(get('merchant_image_url') || get('large_image'), hosts),
  name: clean(get('product_name'), 300),
  brand: clean(get('brand_name'), 80),
  price: euro(get('search_price')),
  currency: get('currency').trim().toUpperCase() || 'EUR',
  stock: get('in_stock').trim(),
  status: get('stock_status'),
  pid: clean(get('merchant_product_id'), 120),
  cats: byPath ? (pathLevels(page, byPath) || [OTHER]) : levels(get('merchant_category'))
  };
};
// The store's own words also count (24/11/2026): Public «Αγορά μόνο από κατάστημα» or «Μη Διαθέσιμο» with in_stock 1,
// Kotsovolos «Μη διαθέσιμο για αποστολή» with no in_stock. «Μη διαθέσιμο για αποστολή, Διαθέσιμο για παραλαβή» stays.
export function soldOut(status) {
  const s = String(status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  if (/εξαντλ|mh diathesimo|μονο απο (το )?καταστημα|^error/.test(s)) return true;
  return s.startsWith('μη διαθεσιμο') && !/, ?διαθεσιμο για/.test(s);
}
const usable = r => r.page && r.image && r.name && r.price && r.currency === 'EUR' && r.stock !== '0' && !soldOut(r.status);

// One file writer: whole statements, a new file before MAX_FILE.
class SqlFiles {
  constructor(dir, prefix) { this.dir = dir; this.prefix = prefix; this.files = []; this.fd = null; this.size = 0; }
  write(statement) {
    const bytes = Buffer.byteLength(statement, 'utf8') + 1;
    if (this.fd === null || this.size + bytes > MAX_FILE) this.next();
    writeSync(this.fd, statement + '\n');
    this.size += bytes;
  }
  next() {
    if (this.fd !== null) closeSync(this.fd);
    const f = join(this.dir, `${this.prefix}-${String(this.files.length + 1).padStart(4, '0')}.sql`);
    this.fd = openSync(f, 'w');
    this.files.push(f);
    this.size = 0;
  }
  close() { if (this.fd !== null) closeSync(this.fd); this.fd = null; }
}

// SQLite compares TEXT byte by byte (UTF-8, BINARY): the same order here, so the ranges below are the database's own.
const byBytes = (a, b) => Buffer.compare(a.b, b.b);
export function sortKeys(keys) {
  return keys.map(s => ({ s, b: Buffer.from(String(s), 'utf8') })).sort(byBytes).map(x => x.s);
}
// Every row of the store that is not in `keys` (sorted as the database sorts them) goes, one range at a time: each
// statement names the keys of its own range (NOT IN), so the database reads only that range of its primary key and
// writes only the rows that go. The first range has no lower end and the last no upper end: nothing is missed.
export function rangeDeletes(table, program, col, keys, lit) {
  const head = `DELETE FROM ${table} WHERE program = ${program}`;
  if (!keys.length) return [`${head};`];
  const out = [];
  // Room for the upper end too, whichever key it is (review 25/11/2026: a page address as an id can be ~2 KB).
  let room = 0;
  for (const k of keys) room = Math.max(room, Buffer.byteLength(lit(k), 'utf8'));
  let i = 0;
  while (i < keys.length) {
    const lo = i > 0 ? ` AND ${col} >= ${lit(keys[i])}` : '';
    let j = i, bytes = Buffer.byteLength(head + lo, 'utf8') + room + 100, list = [];
    while (j < keys.length) {
      const v = lit(keys[j]);
      const b = Buffer.byteLength(v, 'utf8') + 1;
      if (list.length && bytes + b > MAX_STATEMENT - 300) break;
      list.push(v); bytes += b; j++;
    }
    const hi = j < keys.length ? ` AND ${col} < ${lit(keys[j])}` : '';
    out.push(`${head}${lo}${hi} AND ${col} NOT IN (${list.join(',')});`);
    i = j;
  }
  return out;
}
// The photo of a category (L231): the middle one of its 20 dearest products (a main product, not an accessory, and not
// the one odd price at the top); the same product while the feed stays the same.
const TOP = 20;
function addTop(c, price, pos, image) {
  const t = c.top;
  const last = t[t.length - 1];
  if (t.length === TOP && (price < last.price || (price === last.price && pos > last.pos))) return;
  let i = t.length;
  while (i > 0 && (t[i - 1].price < price || (t[i - 1].price === price && t[i - 1].pos > pos))) i--;
  t.splice(i, 0, { price, pos, image });
  if (t.length > TOP) t.pop();
}
export const categoryImage = c => (c.top && c.top.length ? c.top[Math.floor((c.top.length - 1) / 2)].image : '');
const hashOf = v => createHash('sha1').update(v).digest('hex').slice(0, 16);
// The ids and hashes of a store's last load that ended well (<programme>.tsv: "#loaded <id of that load>", then
// "<id>\t<hash of the row>\t<hash of its place and categories>"), null without one. expect: the load id the database
// has for the store, stores.run (review 25/11/2026: after a restore of the database, or a load from another PC, the
// file no longer says what the database holds, and a refresh from it would leave old prices behind; the time of the
// feed is not enough, the same feed can be loaded twice); undefined = not checked.
export function readState(dir, program, expect) {
  if (!dir) return null;
  const f = join(dir, `${program}.tsv`);
  if (!existsSync(f)) return null;
  const lines = readFileSync(f, 'utf8').split('\n');
  if (expect !== undefined && (!expect || lines[0] !== `#loaded ${expect}`)) return null;
  const m = new Map();
  for (const [n, line] of lines.entries()) {
    if (n === 0 && line.startsWith('#loaded')) continue;
    const [pid, h, i] = line.split('\t');
    if (pid && h) m.set(pid, { h: h.trim(), i: (i || '').trim() });
  }
  return m;
}
const PCOLS = ['pos', 'c1', 'c2', 'c3', 'name', 'brand', 'page', 'image', 'price'];
// Review 25/11/2026 (D1 cost): a product whose place and categories are the same updates only these, so no index row.
const LCOLS = ['name', 'brand', 'page', 'image', 'price'];
const CCOLS = ['parent', 'level', 'name', 'slug', 'products', 'image'];
const changed = (table, cols) => cols.map(c => `${table}.${c} IS NOT excluded.${c}`).join(' OR ');
const PRODUCT_UPSERT = ` ON CONFLICT(program, pid) DO UPDATE SET ${PCOLS.map(c => `${c} = excluded.${c}`).join(', ')} WHERE ${changed('products', PCOLS)};`;
const PRODUCT_LIGHT = ` ON CONFLICT(program, pid) DO UPDATE SET ${LCOLS.map(c => `${c} = excluded.${c}`).join(', ')} WHERE ${changed('products', LCOLS)};`;
const CATEGORY_UPSERT = ` ON CONFLICT(program, id) DO UPDATE SET ${CCOLS.map(c => `${c} = excluded.${c}`).join(', ')} WHERE ${changed('categories', CCOLS)};`;

// mode: 'full' (DELETE and INSERT, the store "loading" meanwhile) or 'refresh' (only the changes; 'check' when there is
// no state file, so every product is sent with the WHERE that skips the rows already right).
export async function buildStore(store, file, outDir, feedIso, { mode = 'full', state = null } = {}) {
  const full = mode === 'full';
  // The id of this load (review 25/11/2026): in the store's last statement and at the top of its state file.
  const run = randomBytes(8).toString('hex');
  const how = full ? 'full' : (state ? 'refresh' : 'check');
  // Pass 1: the price of each page (two rows of one page with different prices: left out).
  const pagePrice = new Map();
  for await (const get of rows(file)) {
    const r = rowOf(get, store.hosts, store.program);
    if (!usable(r)) continue;
    const k = pageKey(r.page);
    const seen = pagePrice.get(k);
    if (seen === undefined) pagePrice.set(k, r.price);
    else if (seen !== r.price) pagePrice.set(k, -1);
  }
  // Pass 2: one product per page, in its categories.
  // Written as tmp-<programme>-NNNN.sql; renamed to <programme>-NNNN.sql only when the store ends OK.
  const sql = new SqlFiles(outDir, `tmp-${store.program}`);
  if (full) {
    sql.write(`INSERT INTO stores (program, slug, checked_at, products, loading) VALUES (${store.program}, ${sq(store.slug)}, ${sq(feedIso)}, 0, 1) ON CONFLICT(program) DO UPDATE SET loading = 1;`);
    sql.write(`DELETE FROM products WHERE program = ${store.program};`);
  }
  const cats = new Map(); // id -> { id, parent, level, name, slug, path, products, top }
  const idOf = path => { let id = fnv(`${store.program}|${path}`) & 0x7fffffff; return id || 1; };
  const done = new Set();
  const pids = new Set();
  const stateLines = [];
  let products = 0, left = 0, sent = 0;
  const cols = '(program, pid, pos, c1, c2, c3, name, brand, page, image, price)';
  const head = full ? `INSERT OR REPLACE INTO products ${cols} VALUES ` : `INSERT INTO products ${cols} VALUES `;
  // Two kinds of statement in a refresh: every column (new, or moved), or only the product's own columns.
  const batches = [{ tail: full ? ';' : PRODUCT_UPSERT, rows: [], bytes: 0 }, { tail: PRODUCT_LIGHT, rows: [], bytes: 0 }];
  const flush = b => { if (b.rows.length) sql.write(`${head}${b.rows.join(',')}${b.tail}`); b.rows = []; b.bytes = 0; };
  for await (const get of rows(file)) {
    const r = rowOf(get, store.hosts, store.program);
    if (!usable(r)) { left++; continue; }
    const k = pageKey(r.page);
    if (done.has(k)) continue;
    done.add(k);
    if (pagePrice.get(k) !== r.price) { left++; continue; }
    // The same product id twice (a colour with its own page): kept once, and counted in its categories once.
    const pid = r.pid || k;
    if (pids.has(pid)) { left++; continue; }
    pids.add(pid);
    const pos = position(pid);
    const ids = [];
    for (let i = 0; i < r.cats.length; i++) {
      const path = r.cats.slice(0, i + 1).join(' > ');
      let id = idOf(path);
      while (cats.has(id) && cats.get(id).path !== path) id = (id + 7919) & 0x7fffffff || 1;
      if (!cats.has(id)) cats.set(id, { id, parent: i ? ids[i - 1] : 0, level: i + 1, name: r.cats[i], slug: catSlug(r.cats[i]), path, products: 0, top: [] });
      const c = cats.get(id);
      c.products++;
      addTop(c, r.price, pos, r.image);
      ids.push(id);
    }
    const value = `(${store.program},${sq(pid)},${pos},${ids[0]},${ids[1] || 0},${ids[2] || 0},${sq(r.name)},${sq(r.brand)},${sq(r.page)},${sq(r.image)},${r.price})`;
    const hash = hashOf(value);
    const where = hashOf(`${pos},${ids[0]},${ids[1] || 0},${ids[2] || 0}`).slice(0, 8);
    stateLines.push(`${pid}\t${hash}\t${where}`);
    products++;
    // A refresh sends only a product that is new or not as it was sent last time.
    const was = !full && state ? state.get(pid) : undefined;
    if (was && was.h === hash) continue;
    const b = was && was.i === where ? batches[1] : batches[0];
    const bytes = Buffer.byteLength(value, 'utf8') + 1;
    if (b.bytes + bytes + head.length + b.tail.length > MAX_STATEMENT) flush(b);
    b.rows.push(value);
    b.bytes += bytes;
    sent++;
  }
  batches.forEach(flush);
  let gone = -1;
  if (!full) {
    for (const s of rangeDeletes('products', store.program, 'pid', sortKeys([...pids]), sq)) sql.write(s);
    if (state) { gone = 0; for (const k of state.keys()) if (!pids.has(k)) gone++; }
  } else {
    sql.write(`DELETE FROM categories WHERE program = ${store.program};`);
  }
  let cb = [];
  const chead = `INSERT INTO categories (program, id, parent, level, name, slug, products, image) VALUES `;
  const ctail = full ? ';' : CATEGORY_UPSERT;
  const cflush = () => { if (cb.length) sql.write(`${chead}${cb.join(',')}${ctail}`); cb = []; };
  let cbBytes = 0;
  for (const c of cats.values()) {
    const v = `(${store.program},${c.id},${c.parent},${c.level},${sq(c.name)},${sq(c.slug)},${c.products},${sq(categoryImage(c))})`;
    const b = Buffer.byteLength(v, 'utf8') + 1;
    if (cbBytes + b + chead.length + ctail.length > MAX_STATEMENT - 200) { cflush(); cbBytes = 0; }
    cb.push(v); cbBytes += b;
  }
  cflush();
  if (!full) for (const s of rangeDeletes('categories', store.program, 'id', [...cats.keys()].sort((a, b) => a - b), String)) sql.write(s);
  // The prices of its sets and ideas, from the same feed (the rules of L227: one sure price, else none).
  let picks = {};
  if (store.picks.length) { try { picks = (await pricesFromFeed(feedStream(file), store.picks)).prices; } catch { picks = {}; } }
  // Last: the store's row (the time of its feed), so the site shows the new time only when everything is in.
  sql.write(`INSERT INTO stores (program, slug, checked_at, products, loading, picks, run) VALUES (${store.program}, ${sq(store.slug)}, ${sq(feedIso)}, ${products}, 0, ${sq(JSON.stringify(picks))}, ${sq(run)}) ON CONFLICT(program) DO UPDATE SET slug = excluded.slug, checked_at = excluded.checked_at, products = excluded.products, loading = 0, picks = excluded.picks, run = excluded.run;`);
  sql.close();
  const stateFile = join(outDir, `tmp-${store.program}.state`);
  writeFileSync(stateFile, [`#loaded ${run}`, ...stateLines].join('\n') + '\n', 'utf8');
  return { products, categories: cats.size, left, files: sql.files, picks: Object.keys(picks).length, mode: how, sent, gone, state: stateFile, run };
}

// loaded: { <programme>: the load id the database has for it, stores.run } (--have); null = the state files are not checked.
export async function buildCatalog({ archive, out, programs, config, now = Date.now(), full = null, stateDir = '', loaded = null }) {
  const stores = directStoresFromConfig(readFileSync(config, 'utf8'));
  mkdirSync(out, { recursive: true });
  const lines = [];
  let shown = 0, total = 0, files = 0;
  for (const program of programs) {
    const s = stores.find(x => x.program === program);
    const line = (state, r = {}, iso = '-') => lines.push(`CATALOG ${s ? s.slug : 'unknown'} ${program} ${state} ${r.products || 0} ${r.categories || 0} ${r.left || 0} ${iso} ${(r.files || []).length} ${r.mode || '-'} ${r.sent || 0} ${r.gone === undefined ? -1 : r.gone}`);
    if (!s) { line('ERROR'); continue; }
    const file = join(archive, `LINKWISE_${program}.csv.gz`);
    if (!archive || !existsSync(file)) { line('MISSING'); continue; }
    let t = 0;
    try { t = Math.min(statSync(file).mtimeMs, now); } catch { line('ERROR'); continue; }
    const iso = new Date(t).toISOString();
    if (now - t > FEED_MAX_AGE_MS) { line('OLD', {}, iso); continue; }
    let r;
    const dropTmp = () => { for (const f of readdirSync(out)) if (f.startsWith(`tmp-${program}-`) || f === `tmp-${program}.state`) rmSync(join(out, f), { force: true }); };
    // Without --full (the old way of calling it): every store in full.
    const mode = !full || full.includes(program) ? 'full' : 'refresh';
    const expect = loaded ? (loaded[program] || '') : undefined;
    try { r = await buildStore(s, file, out, iso, { mode, state: mode === 'refresh' ? readState(stateDir, program, expect) : null }); } catch { dropTmp(); line('ERROR', {}, iso); continue; }
    if (!r.products) { dropTmp(); line('NONE', { ...r, files: [] }, iso); continue; }
    // OK: the files get their real names (a store's files are only ever all there or none).
    const real = f => join(out, f.split(/[\\/]/).pop().replace(/^tmp-/, ''));
    r.files = r.files.map(f => { const to = real(f); renameSync(f, to); return to; });
    const st = real(r.state);
    renameSync(r.state, st);
    r.state = st;
    shown++; total += r.products; files += r.files.length;
    line('OK', r, iso);
  }
  lines.push(`CATALOG-DONE ${shown} ${total} ${files}`);
  return { lines };
}

function args(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) if (/^--[a-z]+$/.test(argv[i])) a[argv[i].slice(2)] = argv[++i] ?? '';
  return a;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const ascii = s => String(s).replace(/[^\x20-\x7E]/g, '?').slice(0, 300);
  try {
    const a = args(process.argv.slice(2));
    const now = a.now ? Date.parse(a.now) : Date.now();
    const programs = String(a.program || '').split(/[,\s]+/).filter(Boolean).map(Number);
    if (!a.out || !Number.isFinite(now) || !programs.length || programs.some(p => !Number.isInteger(p) || p <= 0)) {
      console.log('CATALOG-ERROR usage: --archive <folder> --out <folder> --program <ids> [--full <ids>] [--state <folder>] [--have <programme>=<load id>,...] [--config <file>] [--now <ISO>]');
      process.exit(2);
    }
    // --full 0: no store in full (Windows PowerShell 5.1 does not pass an empty argument).
    const full = a.full === undefined ? null : String(a.full).split(/[,\s]+/).map(Number).filter(n => Number.isInteger(n) && n > 0);
    // --have 138=<load id>,469=<load id> (0: no store): stores.run of each store in the database.
    let loaded = null;
    if (a.have !== undefined) {
      loaded = {};
      for (const part of String(a.have).split(',')) {
        const m = /^(\d{1,9})=(\S+)$/.exec(part.trim());
        if (m) loaded[Number(m[1])] = m[2];
      }
    }
    const { lines } = await buildCatalog({ archive: a.archive || '', out: a.out, programs, config: a.config || join(HERE, '..', 'sites', 'ogw', 'site.config.js'), now, full, stateDir: a.state || '', loaded });
    for (const l of lines) console.log(ascii(l));
  } catch (e) {
    console.log(`CATALOG-ERROR ${ascii(e && e.message ? e.message : e)}`);
  }
}
