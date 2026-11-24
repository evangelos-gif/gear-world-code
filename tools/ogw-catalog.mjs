// The catalogue of the big Linkwise stores of Mega Stores Gear World (owner, 24 Nov 2026, lessons L228).
//
//   node tools/ogw-catalog.mjs --archive <GW_AWIN_BULK_ARCHIVE> --out <folder> --program 138,13026 [--config <file>] [--now <ISO>]
//
// For each programme it reads the store's own Linkwise product feed (LINKWISE_<programme>.csv.gz with the Awin column
// names, read at most 23 hours ago, as for the prices of L227) and writes SQL files for the store's own D1 database
// (sites/ogw/catalog-schema.sql): every product in stock, in euros, with an https photo and a page on the store's own
// address, in the store's own categories (merchant_category, its first three levels). Rows that share one page (sizes,
// shades) are one product, and only when they agree on the price (else it is left out: no price is guessed). A full
// load per store: its old rows first (DELETE), then every product (INSERT), then its categories and its row in stores
// (with the time of the feed and the prices of its own sets and ideas), each statement at most 90 KB, each file at most 20 MB. Nothing is sent from here:
// tools/ogw-site.ps1 -Step catalog sends the files, in order, with the owner's phrase. No affiliate code: the products
// keep the store's own page. ASCII lines on stdout, never stderr (Windows PowerShell 5.1):
//   CATALOG <slug> <programme> <OK|OLD|MISSING|NONE|ERROR> <products> <categories> <left out> <feed ISO or -> <files>
//   CATALOG-DONE <stores> <products> <files>
import { createReadStream, existsSync, mkdirSync, openSync, closeSync, writeSync, readFileSync, statSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';
import { pageKey } from '../src/lib/price-key.js';
import { directStoresFromConfig, pricesFromFeed, FEED_MAX_AGE_MS } from './ogw-prices.mjs';

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
  const out = u.toString();
  return out.length <= 1000 ? out : '';
}
const photo = raw => { const s = String(raw || '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(s) && s.length <= 1000 ? s : ''; };
export function levels(category) {
  const parts = String(category || '').replace(/&gt;/gi, '>').split('>').map(x => clean(x, 80)).filter(Boolean).slice(0, 3);
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
const rowOf = (get, hosts) => ({
  page: storePage(get('merchant_deep_link'), hosts),
  image: photo(get('merchant_image_url') || get('large_image')),
  name: clean(get('product_name'), 300),
  brand: clean(get('brand_name'), 80),
  price: euro(get('search_price')),
  currency: get('currency').trim().toUpperCase() || 'EUR',
  stock: get('in_stock').trim(),
  pid: clean(get('merchant_product_id'), 120),
  cats: levels(get('merchant_category'))
});
const usable = r => r.page && r.image && r.name && r.price && r.currency === 'EUR' && r.stock !== '0';

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

export async function buildStore(store, file, outDir, feedIso) {
  // Pass 1: the price of each page (two rows of one page with different prices: left out).
  const pagePrice = new Map();
  for await (const get of rows(file)) {
    const r = rowOf(get, store.hosts);
    if (!usable(r)) continue;
    const k = pageKey(r.page);
    const seen = pagePrice.get(k);
    if (seen === undefined) pagePrice.set(k, r.price);
    else if (seen !== r.price) pagePrice.set(k, -1);
  }
  // Pass 2: one product per page, in its categories.
  const sql = new SqlFiles(outDir, String(store.program));
  sql.write(`DELETE FROM products WHERE program = ${store.program};`);
  const cats = new Map(); // id -> { id, parent, level, name, slug, path, products }
  const idOf = path => { let id = fnv(`${store.program}|${path}`) & 0x7fffffff; return id || 1; };
  const done = new Set();
  let products = 0, left = 0;
  let batch = [], batchBytes = 0;
  const head = 'INSERT INTO products (program, pid, pos, c1, c2, c3, name, brand, page, image, price) VALUES ';
  const flush = () => { if (batch.length) sql.write(`${head}${batch.join(',')};`); batch = []; batchBytes = 0; };
  for await (const get of rows(file)) {
    const r = rowOf(get, store.hosts);
    if (!usable(r)) { left++; continue; }
    const k = pageKey(r.page);
    if (done.has(k)) continue;
    done.add(k);
    if (pagePrice.get(k) !== r.price) { left++; continue; }
    const ids = [];
    for (let i = 0; i < r.cats.length; i++) {
      const path = r.cats.slice(0, i + 1).join(' > ');
      let id = idOf(path);
      while (cats.has(id) && cats.get(id).path !== path) id = (id + 7919) & 0x7fffffff || 1;
      if (!cats.has(id)) cats.set(id, { id, parent: i ? ids[i - 1] : 0, level: i + 1, name: r.cats[i], slug: catSlug(r.cats[i]), path, products: 0 });
      cats.get(id).products++;
      ids.push(id);
    }
    const pid = r.pid || k;
    const value = `(${store.program},${sq(pid)},${position(pid)},${ids[0]},${ids[1] || 0},${ids[2] || 0},${sq(r.name)},${sq(r.brand)},${sq(r.page)},${sq(r.image)},${r.price})`;
    const bytes = Buffer.byteLength(value, 'utf8') + 1;
    if (batchBytes + bytes + head.length > MAX_STATEMENT) flush();
    batch.push(value);
    batchBytes += bytes;
    products++;
  }
  flush();
  sql.write(`DELETE FROM categories WHERE program = ${store.program};`);
  let cb = [];
  const cflush = () => { if (cb.length) sql.write(`INSERT INTO categories (program, id, parent, level, name, slug, products) VALUES ${cb.join(',')};`); cb = []; };
  let cbBytes = 0;
  for (const c of cats.values()) {
    const v = `(${store.program},${c.id},${c.parent},${c.level},${sq(c.name)},${sq(c.slug)},${c.products})`;
    const b = Buffer.byteLength(v, 'utf8') + 1;
    if (cbBytes + b > MAX_STATEMENT - 200) { cflush(); cbBytes = 0; }
    cb.push(v); cbBytes += b;
  }
  cflush();
  // The prices of its sets and ideas, from the same feed (the rules of L227: one sure price, else none).
  let picks = {};
  if (store.picks.length) { try { picks = (await pricesFromFeed(feedStream(file), store.picks)).prices; } catch { picks = {}; } }
  sql.write(`INSERT OR REPLACE INTO stores (program, slug, checked_at, products, picks) VALUES (${store.program}, ${sq(store.slug)}, ${sq(feedIso)}, ${products}, ${sq(JSON.stringify(picks))});`);
  sql.close();
  return { products, categories: cats.size, left, files: sql.files, picks: Object.keys(picks).length };
}

export async function buildCatalog({ archive, out, programs, config, now = Date.now() }) {
  const stores = directStoresFromConfig(readFileSync(config, 'utf8'));
  mkdirSync(out, { recursive: true });
  const lines = [];
  let shown = 0, total = 0, files = 0;
  for (const program of programs) {
    const s = stores.find(x => x.program === program);
    const line = (state, r = {}, iso = '-') => lines.push(`CATALOG ${s ? s.slug : 'unknown'} ${program} ${state} ${r.products || 0} ${r.categories || 0} ${r.left || 0} ${iso} ${(r.files || []).length}`);
    if (!s) { line('ERROR'); continue; }
    const file = join(archive, `LINKWISE_${program}.csv.gz`);
    if (!archive || !existsSync(file)) { line('MISSING'); continue; }
    let t = 0;
    try { t = Math.min(statSync(file).mtimeMs, now); } catch { line('ERROR'); continue; }
    const iso = new Date(t).toISOString();
    if (now - t > FEED_MAX_AGE_MS) { line('OLD', {}, iso); continue; }
    let r;
    try { r = await buildStore(s, file, out, iso); } catch { line('ERROR', {}, iso); continue; }
    if (!r.products) { line('NONE', { ...r, files: [] }, iso); continue; }
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
      console.log('CATALOG-ERROR usage: --archive <folder> --out <folder> --program <ids> [--config <file>] [--now <ISO>]');
      process.exit(2);
    }
    const { lines } = await buildCatalog({ archive: a.archive || '', out: a.out, programs, config: a.config || join(HERE, '..', 'sites', 'ogw', 'site.config.js'), now });
    for (const l of lines) console.log(ascii(l));
  } catch (e) {
    console.log(`CATALOG-ERROR ${ascii(e && e.message ? e.message : e)}`);
  }
}
