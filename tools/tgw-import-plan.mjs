#!/usr/bin/env node
// Technology Gear World - import PLAN (dry run). READ-ONLY for feeds and for D1.
//
// Reads the Awin feed files listed in sites/tgw/sources.json from the local Awin archive,
// applies the category rules and quality rules (sites/tgw/category-rules.js) and writes, in a NEW folder:
//   report.txt                  what would be imported, per category, with samples and reject reasons
//   sql/0001.sql ...            the SQL that WOULD load the products into D1 (not executed)
//   sql/9999-finish.sql         marks products missing from the feed as inactive + logs the run (not executed)
// Nothing is sent to Cloudflare. Loading the SQL is a separate step that needs the owner's approval.
//
// Usage: node tools/tgw-import-plan.mjs --archive <dir>[;<dir>] --out <dir> [--sources sites/tgw/sources.json]
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { PassThrough } from 'node:stream';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as TGW_RULES from '../sites/tgw/category-rules.js';
import { normalizeGtin } from '../src/lib/gtin.js';
import { slugify, truncate } from '../src/lib/text.js';
import { tyreName } from './tyre-name.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SQL_ROWS_PER_FILE = 400;
const SAMPLES_PER_GROUP = 15;
const SAMPLES_PER_SHOP = 10;
const SAMPLES_PER_FOLDER = 3;
const SAMPLES_LOOSE = 30;
const AWIN_PUBLISHER_ID = 3057233;

// ---------- Google Shopping format feeds ----------
// A few retailers (GS Workwear, Awin 48473) send a Google Shopping file instead of the usual Awin CSV, saved in
// Downloads as "<advertiserId>-<name>.csv.gz" (sources.json: "format": "google", "file": "<regex>"). Each row is
// one size or colour ("Name - Colour / Size"), the link is the shop's own page and the Awin link is built here.
// These rows are turned into Awin-named columns, so the rest of the plan reads them like any other feed.
const GOOGLE_COLUMNS = ['product_name', 'aw_deep_link', 'merchant_image_url', 'search_price', 'rrp_price', 'currency', 'in_stock',
  'ean', 'merchant_product_id', 'merchant_category', 'brand_name', 'description', 'mpn', 'colour', 'size'];

// "Draper Torque Wrench - Black / UK 9" -> "Draper Torque Wrench": the size ending always has " / " in it.
export function googleBaseName(title) {
  const parts = String(title || '').replace(/\s+/g, ' ').trim()
    .replace(/(\d)\s[-–]\s((?:uk|eu|us)\s*)?(?=\d)/gi, '$1-$2').split(/\s[-–]\s/);
  let colour = '';
  if (parts.length > 1 && /\s\/\s/.test(parts[parts.length - 1].replace(/\([^()]*\)/g, '')) && parts[parts.length - 1].length <= 90) {
    colour = parts.pop().split(/\s\/\s/)[0].replace(/[*†?]/g, '').trim().toLowerCase();
  }
  while (parts.length > 1) {
    const last = parts[parts.length - 1].replace(/[*†?]/g, '').trim().toLowerCase();
    if ((colour && last === colour) || /^(uk|eu|us)\s*\d{1,2}(\.5)?(-\d{1,2}(\.5)?)?$/.test(last) || /^(x{0,3}-?small|small|medium|large|x{1,3}-?large|\d?xl|x{0,3}[sml]|one size)$/.test(last)) parts.pop();
    else break;
  }
  return parts.join(' - ');
}

export function googleAdapter(header, advertiserId) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^\uFEFF/, ''));
  const col = (rec, ...names) => { for (const n of names) { const i = h.indexOf(n); if (i >= 0 && String(rec[i] ?? '').trim()) return String(rec[i]).trim(); } return ''; };
  return {
    header: GOOGLE_COLUMNS,
    row(rec) {
      const page = col(rec, 'link', 'mobile_link');
      let host = '';
      try { host = new URL(page).hostname.toLowerCase(); } catch { /* invalid */ }
      const shopPage = page && /^https:/i.test(page) && host !== 'www.awin1.com' && host !== 'awin1.com';
      const sale = col(rec, 'sale_price');
      const full = col(rec, 'price');
      const priceText = sale || full;
      const avail = col(rec, 'availability').toLowerCase().replace(/[\s-]+/g, '_');
      const name = googleBaseName(col(rec, 'title'));
      const brand = col(rec, 'brand');
      return [
        name,
        shopPage ? `https://www.awin1.com/cread.php?awinmid=${advertiserId}&awinaffid=${AWIN_PUBLISHER_ID}&ued=${encodeURIComponent(page)}` : '',
        col(rec, 'image_link'),
        priceText,
        sale ? full : '',
        (priceText.match(/\b([A-Z]{3})\b/) || [])[1] || '',
        avail === 'in_stock' || avail === 'limited_stock' ? '1' : (avail === 'out_of_stock' || avail === 'discontinued' ? '0' : ''),
        col(rec, 'gtin'),
        // the same id on every run and for every size of the product
        slugify(`${brand} ${name}`).slice(0, 120),
        col(rec, 'product_type', 'google_product_category'),
        brand,
        col(rec, 'description'),
        col(rec, 'mpn'),
        '',
        ''
      ];
    }
  };
}

// The files of one source with "file" (a name pattern, e.g. GS Workwear's Google Shopping file "48473-*.csv.gz"): looked up in
// every archive folder and in the folder above each one (Downloads). The newest copy of each file name is used.
function sourceFiles(source, archives) {
  if (!source.file) return undefined;
  const re = new RegExp(source.file, 'i');
  const best = new Map();
  for (const a of archives) {
    for (const dir of [a, dirname(a)]) {
      let names = [];
      try { names = readdirSync(dir); } catch { continue; }
      for (const n of names) {
        if (!re.test(n)) continue;
        const full = join(dir, n);
        let mtime = 0;
        try { mtime = statSync(full).mtimeMs; } catch { continue; }
        const had = best.get(n.toLowerCase());
        if (!had || mtime > had.mtime) best.set(n.toLowerCase(), { name: n, full, dir, mtime });
      }
    }
  }
  return best.size ? [...best.values()] : null;
}

// No feedIds in sources.json: every AWIN_<advertiserId>_<feedId>.csv.gz of that retailer in the archive folders.
function allFeedIds(source, archives) {
  const ids = new Set();
  const re = new RegExp(`^AWIN_${source.advertiserId}_(\\d+)\\.csv\\.gz$`, 'i');
  for (const dir of archives) {
    let names = [];
    try { names = readdirSync(dir); } catch { continue; }
    for (const n of names) { const m = n.match(re); if (m) ids.add(m[1]); }
  }
  return [...ids].sort();
}


// ---------- CSV ----------

function detectDelimiter(headerLine) {
  let best = ',', bestCount = -1;
  for (const d of [',', '|', '\t', ';']) {
    let count = 0, quoted = false;
    for (const ch of headerLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

// Streaming CSV reader: handles quotes, doubled quotes, delimiters and line breaks inside quotes.
export async function* readCsvRecords(stream) {
  let delim = null, field = '', record = [], quoted = false, pendingQuote = false, head = '';
  if (typeof stream.setEncoding === 'function') stream.setEncoding('utf8'); // keeps multi-byte characters whole
  for await (const chunk of stream) {
    let text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    if (delim === null) {
      head += text;
      const nl = head.search(/\r?\n/);
      if (nl < 0 && head.length < 1e6) continue;
      delim = detectDelimiter(nl < 0 ? head : head.slice(0, nl));
      text = head.replace(/^﻿/, '');
      head = '';
    }
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (ch === '"') { field += '"'; continue; }
        quoted = false;
      }
      if (quoted) {
        if (ch === '"') pendingQuote = true;
        else field += ch;
        continue;
      }
      if (ch === '"' && field === '') { quoted = true; continue; }
      if (ch === delim) { record.push(field); field = ''; continue; }
      if (ch === '\n') {
        record.push(field.endsWith('\r') ? field.slice(0, -1) : field);
        yield record;
        record = []; field = '';
        continue;
      }
      field += ch;
    }
  }
  if (pendingQuote) quoted = false;
  if (field !== '' || record.length) { record.push(field.replace(/\r$/, '')); yield record; }
}

// ---------- Column mapping (Awin feeds differ in which columns they include) ----------

const COLUMNS = {
  name: ['product_name'],
  brand: ['brand_name', 'brand'],
  price: ['search_price', 'store_price', 'display_price', 'price'],
  was: ['rrp_price', 'product_price_old', 'base_price', 'saving_from_price'],
  currency: ['currency'],
  displayPrice: ['display_price'],
  inStock: ['in_stock', 'is_for_sale', 'stock_status', 'stock_quantity'],
  stockQuantity: ['stock_quantity'],
  images: ['large_image', 'merchant_image_url', 'alternate_image', 'aw_image_url', 'merchant_thumb_url'],
  link: ['aw_deep_link'],
  merchantProductId: ['merchant_product_id', 'aw_product_id'],
  awinProductId: ['aw_product_id'],
  gtin: ['ean', 'product_gtin', 'upc', 'isbn'],
  mpn: ['mpn', 'model_number'],
  merchantCategory: ['merchant_category', 'merchant_product_category_path'],
  awinCategory: ['category_name'],
  description: ['description', 'product_short_description', 'specifications'],
  condition: ['condition'],
  colour: ['colour', 'color'],
  size: ['size', 'fashion_size']
};

function mapHeader(header) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
  const map = {};
  for (const [key, names] of Object.entries(COLUMNS)) {
    map[key] = names.map(n => h.indexOf(n)).filter(i => i >= 0);
  }
  return map;
}

const pick = (rec, idxs) => {
  for (const i of idxs) {
    const v = rec[i];
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

// ---------- Cleaning ----------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', pound: '£', euro: '€', reg: '®', trade: '™', copy: '©' };
export function cleanText(v) {
  return String(v || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePrice(v) {
  const s = String(v || '').replace(/[^0-9.,]/g, '');
  if (!s) return NaN;
  // "1,299.99" -> 1299.99 ; "1299,99" -> 1299.99
  const norm = /,\d{1,2}$/.test(s) && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, '');
  return Math.round(parseFloat(norm) * 100) / 100;
}

function detectCurrency(rec, map, source) {
  const c = pick(rec, map.currency).toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) return c;
  const dp = pick(rec, map.displayPrice);
  if (/£|GBP/i.test(dp)) return 'GBP';
  if (/€|EUR/i.test(dp)) return 'EUR';
  if (/\$|USD/i.test(dp)) return 'USD';
  return source.currency || '';
}

function inStockValue(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  if (/^(yes|y|true|in stock|in_stock|instock|available|available to order|limited stock)$/.test(s)) return true;
  if (/^(no|n|false|out of stock|out_of_stock|outofstock|discontinued|preorder|pre-order)$/.test(s)) return false;
  return null;
}

// "Image coming soon" pictures are not product images (PCHUB.UK feed, 23 Oct 2026: entrepreneurship.ieee.org/...
// Image-Coming-Soon-Placeholder.png); the next image column is tried instead (lessons L38).
export const PLACEHOLDER_IMAGE = /placeholder|coming[-_ ]?soon|no[-_ ]?image|image[-_ ]?not[-_ ]?available|noimage|no[-_]?photo|default[-_]?image/i;
export function firstHttpsImage(rec, map) {
  for (const i of map.images) {
    const v = String(rec[i] || '').trim();
    if (/^https:\/\/[^\s"'<>]+$/i.test(v) && !PLACEHOLDER_IMAGE.test(v)) return v;
  }
  return '';
}

// A feed that cuts every name at a fixed length (PCHUB.UK: 70 characters, "... Gigabit Ethernet Wir"): the cut last word,
// then any dangling separator, small word or unclosed bracket, are taken off.
export function cutToWord(name) {
  let s = String(name || '').replace(/\s+\S*$/, '');
  for (;;) {
    const t = s.replace(/\s*[-–—,/(&+|:;.]+\s*$/, '').replace(/\s+(?:with|for|and|of|in|to|the|a|an|by|w|plus|incl)\.?$/i, '').trim();
    if (t === s) break;
    s = t;
  }
  const open = s.lastIndexOf('('), close = s.lastIndexOf(')');
  if (open > close) s = s.slice(0, open).replace(/\s*[-–—,/&+|:;]+\s*$/, '').trim();
  return s || String(name || '').trim();
}

function subcategoryOf(merchantCategory) {
  const parts = String(merchantCategory || '').split(/\s*(?:>|\/|\|)\s*/).map(s => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || '';
  return last.length <= 60 ? last : '';
}

const sq = v => (v === null || v === undefined || v === '' ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

// ---------- Main ----------

// Several archive folders can be given ("A;B"): the feeds of 23 Oct 2026 are in a new folder, the Joybuy feed in the old
// one. For each feed file the newest copy is used.
export function archiveList(archive) {
  return (Array.isArray(archive) ? archive : String(archive || '').split(';')).map(a => String(a).trim()).filter(Boolean);
}

function findFeed(archives, fname) {
  let best = null;
  for (const dir of archives) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (f.toLowerCase() !== fname.toLowerCase()) continue;
      const full = join(dir, f);
      const mtime = statSync(full).mtimeMs;
      if (!best || mtime > best.mtime) best = { full, name: f, dir, mtime };
    }
  }
  return best;
}

// Per-source filters in sources.json (lessons L14): "brands" (only these brands, e.g. consumer brands from a shop that
// also sells business IT) and "denyNames" (words that mark a business product: server, toner, warranty ...).
// "allowPaths" / "denyPaths" (PCHUB.UK, 24 Oct 2026): folder names of the feed's category path ("Default Category>
// Peripherals>Mouses"); a product needs one allowed folder and no denied one. Its 99,975 "PC Components>Other" rows
// and the spare parts, toner and POS folders never reach the site.
// "looseFolders" (owner, 24 Oct 2026: as many as possible, if safe): catch-all folders such as PCHUB's "PC Components>
// Other". A product there (and in no allowed folder) is taken only when its NAME alone says what tech product it is.
const normBrand = b => String(b || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const pathFolders = p => String(p || '').split('>').map(s => s.trim().toLowerCase()).filter(Boolean);
const folderSet = list => (Array.isArray(list) && list.length ? new Set(list.map(s => s.toLowerCase())) : null);
export function looseOnly(source, path) {
  const allow = folderSet(source.allowPaths);
  const loose = folderSet(source.looseFolders);
  if (!allow || !loose) return false;
  const folders = pathFolders(path);
  return !folders.some(f => allow.has(f)) && folders.some(f => loose.has(f));
}
// PCHUB.UK's spare-part folders ("PC Components>Other", "Direktek") have names with every "a", "b" and "t" missing, while the
// brand in front is whole: "DELL Opicl Scroll Mouse US" (Optical ... USB), "DELL Ki Mouse. US. 3 uons." (Kit ... buttons),
// "DELL 280W Power Supply wih PFC", "Canon RUER MOUN" (dry runs of 24 Oct 2026). Such a name is not shown on the site: the
// words after the brand have 8 or more letters and not one a, b or t (lessons L47).
export function garbledName(name, brand = '') {
  const n = String(name || '').trim();
  const b = String(brand || '').trim();
  const rest = b && n.toLowerCase().startsWith(b.toLowerCase()) ? n.slice(b.length) : n.replace(/^\S+/, '');
  const letters = rest.replace(/[^A-Za-z]/g, '');
  return letters.length >= 8 && !/[abt]/i.test(letters);
}

// "partsFolders" (PCHUB.UK: "Other", "Direktek"): folders that are mostly makers' spare parts. A name there with letters missing
// is out, and a product there with no consumer folder is out when its name has a spare-part word ("partsNames": internal,
// LCD, system board, roller, lamp, battery ...), because the folder cannot vouch for it (lessons L47).
export function partsFolder(source, path) {
  const parts = folderSet(source.partsFolders);
  return Boolean(parts) && pathFolders(path).some(f => parts.has(f));
}

// "rulesFrom" (25 Oct 2026, lessons L63): PcNova.co.uk and GamingKit send the same wholesale catalogue as PCHUB.UK (the same
// "Default Category>..." folders, spare parts, toner, names cut at 70 characters), so they take PCHUB's rules instead of a
// second copy that would drift. A field the shop sets itself wins over the inherited one.
export const RULE_FIELDS = ['brands', 'denyNames', 'allowPaths', 'denyPaths', 'looseFolders', 'partsFolders', 'partsNames', 'nameCutAt', 'ignoreWasPrice',
  'stockFromQuantity'];
export function resolveSources(list) {
  const byId = new Map(list.map(s => [Number(s.advertiserId), s]));
  return list.map(s => {
    if (!s.rulesFrom) return s;
    const base = byId.get(Number(s.rulesFrom));
    if (!base || base.rulesFrom) throw new Error(`${s.retailer}: rulesFrom ${s.rulesFrom} must be a shop in sources.json with its own rules`);
    const inherited = Object.fromEntries(RULE_FIELDS.filter(k => k in base && !(k in s)).map(k => [k, base[k]]));
    return { ...inherited, ...s };
  });
}

// The stock a row says: "stockFromQuantity" (GamingKit, 25 Oct 2026) trusts the stock_quantity column over in_stock, because
// the feed marks all 50,000 rows in_stock = 1 while most have stock_quantity = 0 (lessons L63: no out-of-stock product shown).
// In the feeds of the same day Back to the Office and PCHUB.UK say in_stock = 1 with stock_quantity 0 on about 24,000 of the
// products the plan kept, about as many as the plan had more than the import of 24 Oct (old phones such as the Motorola Moto
// G30 among them): they trust the quantity too (lessons L64).
export function rowStock(source, inStockRaw, quantityRaw) {
  const q = String(quantityRaw || '').trim();
  if (source.stockFromQuantity && /^\d+$/.test(q)) return Number(q) > 0;
  return inStockValue(inStockRaw);
}

export function sourceFilter(source) {
  const brands = Array.isArray(source.brands) && source.brands.length ? new Set(source.brands.map(normBrand)) : null;
  const deny = Array.isArray(source.denyNames) && source.denyNames.length ? new RegExp(source.denyNames.join('|'), 'i') : null;
  const partsNames = Array.isArray(source.partsNames) && source.partsNames.length ? new RegExp(source.partsNames.join('|'), 'i') : null;
  const allowPaths = folderSet(source.allowPaths);
  const denyPaths = folderSet(source.denyPaths);
  const filter = (name, brand, path = '') => {
    const folders = pathFolders(path);
    if (denyPaths && folders.some(f => denyPaths.has(f))) return `feed folder not for TGW (${source.retailer})`;
    if (allowPaths && !folders.some(f => allowPaths.has(f)) && !looseOnly(source, path)) return `feed folder not on the consumer list (${source.retailer})`;
    if (brands && !brands.has(normBrand(brand))) return `brand not on the consumer list (${source.retailer})`;
    if (deny && deny.test(name)) return `business IT, parts or services (${source.retailer})`;
    if (partsFolder(source, path)) {
      if (garbledName(name, brand)) return `name with letters missing (${source.retailer})`;
      if (partsNames && looseOnly(source, path) && partsNames.test(name)) return `spare part from a catch-all folder (${source.retailer})`;
    }
    if (looseOnly(source, path) && vagueName(name, brand)) return `name says nothing about the product (${source.retailer})`;
    return '';
  };
  // The word of "denyNames" that stopped a product, for the report (sixth check, lessons L50: the word "serial", meant for
  // serial ports, was also stopping "Serial ATA" disks). A rule that looks at the whole name gives its last 24 characters.
  const denyEach = deny ? source.denyNames.map(d => new RegExp(d, 'i')) : [];
  filter.denyWord = name => {
    for (const re of denyEach) {
      const m = String(name || '').match(re);
      if (!m) continue;
      const w = String(m[1] || m[0]).trim().toLowerCase();
      return w.length > 24 ? `…${w.slice(-24)}` : w;
    }
    return '';
  };
  return filter;
}

// Not new, whatever the feed says (lessons L64): incomplete, open box, ex-display or in a damaged box.
export const NOT_NEW = /\b(?:incomplete|box damaged|damaged (?:box|packaging)|open[- ]box|ex[- ]display)\b/i;
export const NOT_NEW_REASON = 'not new (incomplete, open box or damaged box): the site has no "Used" label yet';

// Memory modules (lessons L64, live check of 25 Oct 2026): "Lenovo 4X77A77032 memory module 64 GB ... DDR5 ... ECC" at
// £9,847.99 and "Samsung M321RAJA0MB0-CWM memory module 128 GB" at £5,151.72 were on the computing page. Even with the
// memory prices of 2026, more than £40 a GB (and than £150) is a price error or a server part. A computer, a graphics card
// or a NAS that names its memory is not a memory module; "Desktop Memory" and "Laptop Memory" are kinds of module.
const MEM_PRICE_PER_GB = 40, MEM_MIN_PRICE_CAP = 150;
export function memoryCapacityGb(name) {
  const n = String(name || '').toLowerCase().replace(/\b(?:desktop|laptop|notebook|pc|server|workstation|gaming) (?:memory|ram)\b/g, 'memory');
  // "HP 16GB DDR5 (1x16GB) 4800 UDIMM ECC Memory" (third dry run): UDIMM, RDIMM and LRDIMM are modules too.
  if (!/\bmemory modules?\b|\b(?:c?so-?|u|r|lr)?dimms?\b|\bcsodimm\b|\bram kit\b/.test(n)) return 0;
  if (/\b(?:gddr\d\w*|graphics|laptops?|notebooks?|desktops?|pcs?|mini pc|workstations?|nas|ssd|tablets?|phones?)\b/.test(n)) return 0;
  // The largest size in the name, a kit written "2 x 16GB" counted whole: a doubt makes the limit higher, never lower.
  let gb = 0;
  for (const m of n.matchAll(/\b(?:(\d{1,2}) ?x ?)?(\d{1,4}) ?gb\b/g)) gb = Math.max(gb, (m[1] ? Number(m[1]) : 1) * Number(m[2]));
  return gb;
}

// Internal hard disks: the capacity in TB from the name, or 0 for anything else (SSDs, external disks, a NAS with disks).
const HDD_PRICE_PER_TB = 60, HDD_MIN_PRICE_CAP = 150;
export function hddCapacityTb(name) {
  const n = String(name || '').toLowerCase();
  if (!/\binternal hard (?:disk )?drive\b|\bhdd\b/.test(n) || /\b(?:external|portable|nas|ssd|solid state)\b/.test(n)) return 0;
  // a computer with a hard disk ("Acer Aspire XC-840 Desktop Intel Pentium Silver N6005 8Gb 1Tb HDD ... Windows 11", lessons L54)
  if (/\b(?:intel|core i\d|core ultra|ryzen|pentium|celeron|athlon|ddr\d|windows|laptops?|notebooks?|workstations?|all-in-one|chromebook)\b/.test(n)) return 0;
  const m = n.match(/\b(\d{1,2}(?:\.\d+)?) ?tb\b/);
  return m ? Number(m[1]) : 0;
}

// A product from a catch-all folder is placed by its name alone, so the name must say something: "Nintendo C/VOL (K1) EE"
// (fourth dry run, 24 Oct 2026) has no word of 4 or more letters after the brand.
export function vagueName(name, brand = '') {
  const n = String(name || '').trim();
  const b = String(brand || '').trim();
  const rest = b && n.toLowerCase().startsWith(b.toLowerCase()) ? n.slice(b.length) : n.replace(/^\S+/, '');
  return !/[A-Za-z]{4,}/.test(rest);
}

// ---------- Duplicates ----------
// Owner's rule (project memory): no product twice on the site, except the same product from ANOTHER shop at ANOTHER price
// (kept for price comparison). In one shop the same name, or the same EAN, is one product and only its cheapest row is kept
// (Back to the Office lists "TP-Link 8-Port 10/100/1000Mbps Desktop Network Switch" at 16.99, 19.99 and 27.99; the live
// site had 116 such names, 24 Oct 2026). Between shops the same name or EAN at the same price is shown once (lessons L47).
export const nameKey = name => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function findDuplicates(rows) {
  const parent = rows.map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); };
  const shop = p => `${p.awin_advertiser_id}|${p.item_condition || ''}`;
  // An EAN that one shop puts on more than 3 different names is a code for a whole range, not for one product: not used.
  const namesPerGtin = new Map();
  for (const p of rows) {
    if (!p.gtin) continue;
    const k = `${shop(p)}|${p.gtin}`;
    if (!namesPerGtin.has(k)) namesPerGtin.set(k, new Set());
    namesPerGtin.get(k).add(nameKey(p.product_name));
  }
  const firstOf = new Map();
  rows.forEach((p, i) => {
    const keys = [`n|${shop(p)}|${nameKey(p.product_name)}`];
    const g = `${shop(p)}|${p.gtin}`;
    if (p.gtin && namesPerGtin.get(g).size <= 3) keys.push(`g|${g}`);
    for (const k of keys) {
      if (firstOf.has(k)) union(i, firstOf.get(k));
      else firstOf.set(k, i);
    }
  });
  const cheapest = new Map(); // group -> its cheapest row (the first one on a tie)
  rows.forEach((p, i) => {
    const r = find(i), b = cheapest.get(r);
    if (b === undefined || p.price < rows[b].price) cheapest.set(r, i);
  });
  const keep = rows.map((_, i) => cheapest.get(find(i)) === i);
  const keptFor = rows.map((_, i) => (keep[i] ? -1 : cheapest.get(find(i)))); // the row that stays instead of this one
  const sameShop = keep.map((k, i) => (k ? -1 : i)).filter(i => i >= 0);
  const otherShop = [];
  const seen = new Map(); // name or EAN + price -> the first row (of any shop) that has it
  rows.forEach((p, i) => {
    if (!keep[i]) return;
    const price = p.price.toFixed(2);
    const keys = [`n|${nameKey(p.product_name)}|${price}`];
    if (p.gtin) keys.push(`g|${p.gtin}|${price}`);
    const other = keys.map(k => seen.get(k)).find(j => j !== undefined && rows[j].awin_advertiser_id !== p.awin_advertiser_id);
    if (other !== undefined) { keep[i] = false; keptFor[i] = other; otherShop.push(i); return; }
    for (const k of keys) if (!seen.has(k)) seen.set(k, i);
  });
  return { keep, sameShop, otherShop, keptFor };
}

// The same product kept at two shops at DIFFERENT prices: both are shown, as separate cards (owner's rule: price comparison).
// The report counts them per pair of shops, so a shop that mostly repeats another shop's catalogue (PcNova.co.uk and GamingKit
// next to PCHUB.UK, 25 Oct 2026) is seen before its first import (lessons L63). Same keys as findDuplicates: the name, and an
// EAN that the shop does not put on more than 3 different names (GamingKit gives 012345678912 to thousands of products).
export function crossShopOverlap(rows) {
  const shopOf = p => p.retailer;
  const namesPerGtin = new Map();
  for (const p of rows) {
    if (!p.gtin) continue;
    const k = `${shopOf(p)}|${p.gtin}`;
    if (!namesPerGtin.has(k)) namesPerGtin.set(k, new Set());
    namesPerGtin.get(k).add(nameKey(p.product_name));
  }
  const keysOf = p => {
    const keys = [`n|${nameKey(p.product_name)}`];
    if (p.gtin && namesPerGtin.get(`${shopOf(p)}|${p.gtin}`).size <= 3) keys.push(`g|${p.gtin}`);
    return keys;
  };
  const byKey = new Map(); // key -> Map(shop -> its cheapest row with that key)
  for (const p of rows) {
    for (const k of keysOf(p)) {
      if (!byKey.has(k)) byKey.set(k, new Map());
      const m = byKey.get(k), cur = m.get(shopOf(p));
      if (!cur || p.price < cur.price) m.set(shopOf(p), p);
    }
  }
  const perShop = {}, pairs = {};
  for (const p of rows) {
    const s = (perShop[shopOf(p)] ||= { kept: 0, elsewhere: 0 });
    s.kept++;
    const others = new Map();
    for (const k of keysOf(p)) for (const [shop, q] of byKey.get(k)) if (shop !== shopOf(p) && !others.has(shop)) others.set(shop, q);
    if (!others.size) continue;
    s.elsewhere++;
    for (const [shop, q] of others) {
      const [a, b] = [shopOf(p), shop].sort();
      if (shopOf(p) !== a) continue; // each pair counted from one side only
      const pr = (pairs[`${a} | ${b}`] ||= { a, b, n: 0, cheaperA: 0, cheaperB: 0, same: 0, examples: [] });
      pr.n++;
      if (p.price < q.price) pr.cheaperA++; else if (p.price > q.price) pr.cheaperB++; else pr.same++;
      if (pr.examples.length < 8) pr.examples.push(`${truncate(p.product_name, 70)} | ${a} ${p.price.toFixed(2)} | ${b} ${q.price.toFixed(2)}`);
    }
  }
  return { perShop, pairs };
}

// Random examples that are the same on every run of the same feed (a fixed seed), so the report shows a spread of each group
// and not only its first rows.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function addSample(store, key, item, size, rng) {
  const r = (store[key] ||= { n: 0, items: [] });
  r.n++;
  if (r.items.length < size) r.items.push(item);
  else {
    const j = Math.floor(rng() * r.n);
    if (j < size) r.items[j] = item;
  }
}

// rules: a site's category-rules.js (default TGW). Other sites with their own database reuse this tool with their own
// rules and label (tools/agw-import-plan.mjs, tools/vgw-import-plan.mjs). QUALITY.currencies (list) or QUALITY.currency.
// only: a list of Awin advertiser ids, to plan just those retailers (their SQL then touches only them).
export async function planImport({ archive, sourcesFile, outDir, now = new Date(), rules = TGW_RULES, label = 'TGW', only = null }) {
  const { classify, cleanProductName, QUALITY, CATEGORY_SLUGS } = rules;
  const notUkHint = rules.notUkHint || (() => '');
  const currencies = QUALITY.currencies || [QUALITY.currency];
  const onlyIds = only && only.length ? new Set(only.map(Number)) : null;
  const sources = resolveSources(JSON.parse(readFileSync(sourcesFile, 'utf8')).sources)
    .filter(s => s.approved && (!onlyIds || onlyIds.has(Number(s.advertiserId))));
  const runStamp = now.toISOString().replace('T', ' ').slice(0, 19);
  const archives = archiveList(archive);
  // Only a retailer whose feed was found and read gets its missing products hidden by 9999-finish.sql.
  const readAdvertisers = new Set();
  const notRead = [];
  const stats = { rows: 0, accepted: 0, rejected: {}, perCategory: {}, gtinValid: 0, withWas: 0, feedCats: {}, perRetailer: {}, denyWords: {}, rejectFolders: {} };
  const samples = { accepted: {}, rejected: {}, byRetailer: {} };
  const feedInfo = [];
  const products = new Map();
  // Rows that passed every check, in feed order; duplicates are taken out once all feeds are read (findDuplicates).
  const candidates = [];
  const seenKeys = new Set();
  // Google format feeds: one row per size and colour; all of them are one product at its lowest price (lessons L34).
  const googleSeen = new Map();
  const rng = makeRng(47);
  const folderRng = makeRng(78);
  const reject = (reason, rec) => {
    stats.rejected[reason] = (stats.rejected[reason] || 0) + 1;
    const list = (samples.rejected[reason] ||= []);
    if (list.length < (reason.startsWith('not matched') ? 40 : SAMPLES_PER_GROUP)) list.push(rec);
  };

  for (const source of sources) {
    const filter = sourceFilter(source);
    let sourceRows = 0, missing = 0;
    // Per shop: rows, products and samples, so a new shop can be checked on its own (PCHUB.UK next to Back to the Office).
    const rs = (stats.perRetailer[source.retailer] ||= { rows: 0, accepted: 0, loose: 0, qtyZero: 0, perCategory: {}, feedCats: {}, folderSamples: {}, looseSamples: {} });
    samples.byRetailer[source.retailer] ||= {};
    const google = source.format === 'google';
    const extra = sourceFiles(source, archives);
    if (extra === null) { feedInfo.push(`${source.retailer}: no file matching ${source.file} in the archive folder(s) or the folder above`); missing++; }
    // No feedIds in sources.json: every file of that retailer in the archive folders.
    const feedIds = extra ? [] : (source.feedIds && source.feedIds.length ? source.feedIds : allFeedIds(source, archives));
    if (!extra && extra !== null && !feedIds.length) { feedInfo.push(`AWIN_${source.advertiserId}_*.csv.gz: NOT FOUND in the archive folder(s)`); missing++; }
    const files = extra ? extra : [];
    for (const feedId of feedIds) {
      const fname = `AWIN_${source.advertiserId}_${feedId}.csv.gz`;
      const found = findFeed(archives, fname);
      if (!found) { feedInfo.push(`${fname}: NOT FOUND in the archive folder(s)`); missing++; continue; }
      if (archives.length > 1) feedInfo.push(`${fname}: from ${found.dir}`);
      files.push(found);
    }
    for (const found of files) {
      const real = found.name;
      let header = null, map = null, rows = 0, adapter = null;
      const stream = createReadStream(found.full).pipe(/\.gz$/i.test(real) ? createGunzip() : new PassThrough());
      for await (const raw of readCsvRecords(stream)) {
        let rec = raw;
        if (!header && google) { adapter = googleAdapter(raw, source.advertiserId); rec = adapter.header; }
        else if (adapter) rec = adapter.row(raw);
        if (!header) {
          header = rec; map = mapHeader(rec);
          const missingCols = ['name', 'price', 'link', 'merchantProductId', 'images'].filter(k => !map[k].length);
          feedInfo.push(`${real}: ${google ? raw.length + ' columns (Google Shopping format)' : rec.length + ' columns'} | file date ${new Date(found.mtime).toISOString().slice(0, 10)}${missingCols.length ? ' | MISSING: ' + missingCols.join(', ') : ''}`);
          feedInfo.push('  columns used: ' + Object.entries(map).map(([k, v]) => `${k}=${v.map(i => header[i]).join('/') || '-'}`).join(' '));
          continue;
        }
        if (raw.length === 1 && raw[0] === '') continue;
        rows++; stats.rows++; rs.rows++;
        const rawName = pick(rec, map.name);
        // Second argument: the shop's sources.json entry (VGW reads its "skuEanInName"); the other sites ignore it.
        let name = cleanProductName(cleanText(rawName), source);
        // A tyre shop (sources.json "tyreSizeFromLink", Pneus.be, L87): brand + model + the size from the shop's address.
        // A tyre without a size in its address, or a motorbike/scooter size, is left out here.
        if (source.tyreSizeFromLink) {
          const t = tyreName(name, cleanText(pick(rec, map.brand)), rec[header.indexOf('merchant_deep_link')]);
          if (!t.size) { reject('tyre without a size in its address', `${truncate(name, 90)}`); continue; }
          if (t.size.twoWheel) { reject('motorbike or bicycle', `${truncate(t.name, 90)}`); continue; }
          name = t.name;
        }
        // A cut name loses its last word; the maker's part number then tells two versions apart ("Lenovo ThinkPad T14 Gen 3
        // ... Laptop" comes with several memory and disk sizes).
        if (source.nameCutAt && rawName.length >= source.nameCutAt) {
          name = cutToWord(name);
          const mpnCut = cleanText(pick(rec, map.mpn));
          const flat = v => v.toLowerCase().replace(/[^a-z0-9]+/g, '');
          if (mpnCut && mpnCut.length <= 25 && !flat(name).includes(flat(mpnCut))) name = `${name} (${mpnCut})`;
        }
        const merchantCategory = cleanText(pick(rec, map.merchantCategory));
        const awinCategory = cleanText(pick(rec, map.awinCategory));
        const brand = cleanText(pick(rec, map.brand));
        const price = parsePrice(pick(rec, map.price));
        const short = `${truncate(name, 90)} | ${Number.isFinite(price) ? price.toFixed(2) : '?'} | ${truncate(merchantCategory || awinCategory, 50)}`;

        if (!name) { reject('no product name', short); continue; }
        if (name.length > QUALITY.maxNameLength) { reject('name too long', short); continue; }
        const filtered = filter(name, brand, merchantCategory);
        if (filtered) {
          if (filtered.startsWith('business IT')) {
            const words = (stats.denyWords[source.retailer] ||= {});
            const w = (words[filter.denyWord(name) || '?'] ||= { n: 0, inStock: 0, examples: [] });
            w.n++;
            if (inStockValue(pick(rec, map.inStock)) !== false) {
              w.inStock++;
              if (w.examples.length < 2) w.examples.push(truncate(name, 70));
            }
          }
          reject(filtered, short);
          continue;
        }
        // A product from a catch-all folder is classified by its name alone (the folder says nothing about it).
        const loose = looseOnly(source, merchantCategory);
        // Third argument: every merchant category column (leaf and full path). Fourth: the shop's sources.json entry
        // (SGW reads its "sectionHints"). TGW's rules ignore both.
        const categoryPaths = map.merchantCategory.map(i => cleanText(rec[i])).filter(Boolean).join(' | ');
        const cls = loose ? classify(name, '', '', source)
          : classify(name, `${merchantCategory || awinCategory} ${merchantCategory ? awinCategory : ''}`.trim(), categoryPaths, source);
        if (!cls.ok) {
          // Per feed folder (27 Oct 2026, Case Luggage: 505 rows "not travel" and only 15 examples): the report shows which
          // folders the rules leave out, so a whole folder of real products is not missed.
          const folder = (merchantCategory || awinCategory || '(no folder)').slice(0, 90);
          const byFolder = (stats.rejectFolders[cls.reason] ||= {});
          const f = (byFolder[folder] ||= { n: 0, ex: [] });
          f.n++;
          // Up to 6 examples spread over the folder (its own random numbers, so the other samples stay the same).
          const shown = name.length > 90 ? name.slice(0, 89) + '…' : name;
          if (f.ex.length < 6) f.ex.push(shown);
          else { const j = Math.floor(folderRng() * f.n); if (j < 6) f.ex[j] = shown; }
          reject(cls.reason, cls.reason.startsWith('not for UK') ? `${short}  [${notUkHint(name)}]` : short);
          continue;
        }
        if (!Number.isFinite(price) || price <= 0) { reject('no price', short); continue; }
        if (price < QUALITY.minPrice || price > QUALITY.maxPrice) { reject('price out of range', short); continue; }
        // After the second import (24 Oct 2026, lessons L53): Back to the Office priced "Western Digital WD80EFPX internal hard drive
        // 8 TB" at 838.99 (usually about 200) and a 22 TB disk at 5,761.99. Such a price is an error: visitors would think the site
        // overcharges. A hard disk dearer than 60 per TB (and than 150) is left out.
        const hddTb = hddCapacityTb(name);
        if (hddTb && price > Math.max(HDD_MIN_PRICE_CAP, HDD_PRICE_PER_TB * hddTb)) { reject('price far above the usual for this hard disk', short); continue; }
        const memGb = memoryCapacityGb(name);
        if (memGb && price > Math.max(MEM_MIN_PRICE_CAP, MEM_PRICE_PER_GB * memGb)) { reject('price far above the usual for this memory', short); continue; }
        // Live check of 25 Oct 2026 (lessons L64): "Sharp 42 Inch FHD LED Smart TV ... (Incomplete - Fully Functional)" and "Fellowes
        // BOX DAMAGED - 60CS Cross Cut Shredder" were on the site as new. They are not new, and the site has no "Used" label yet
        // (the cards and the compare table know only new and refurbished), so they are left out until it has one.
        if (NOT_NEW.test(name)) { reject(NOT_NEW_REASON, short); continue; }
        const currency = detectCurrency(rec, map, source);
        if (!currencies.includes(currency)) { reject(`currency ${currency || 'unknown'}`, short); continue; }
        const quantity = pick(rec, map.stockQuantity);
        const stock = rowStock(source, pick(rec, map.inStock), quantity);
        if (QUALITY.requireInStock && stock === false) {
          // Counted per shop when only the quantity says so (lessons L64), so the report shows what stockFromQuantity leaves out.
          const byQuantity = source.stockFromQuantity && inStockValue(pick(rec, map.inStock)) !== false;
          reject(byQuantity ? `out of stock: quantity 0, although the feed says in stock (${source.retailer})` : 'out of stock', short);
          continue;
        }
        const image = firstHttpsImage(rec, map);
        if (QUALITY.requireImage && !image) { reject('no https image', short); continue; }
        const link = pick(rec, map.link);
        let host = '';
        try { host = new URL(link).hostname.toLowerCase(); } catch { /* invalid */ }
        if (!QUALITY.affiliateHosts.includes(host)) { reject('link is not an Awin link', short); continue; }
        const merchantProductId = pick(rec, map.merchantProductId);
        if (!merchantProductId) { reject('no product id', short); continue; }
        const stableKey = `${source.advertiserId}:${merchantProductId}`;
        if (seenKeys.has(stableKey)) {
          // Google format: the other sizes and colours of a product already taken (the cheapest stays)
          if (google && googleSeen.has(stableKey)) { const had = googleSeen.get(stableKey); if (price < had.price) had.price = price; stats.sizesJoined = (stats.sizesJoined || 0) + 1; continue; }
          reject('duplicate product id', short); continue;
        }
        seenKeys.add(stableKey);

        // "ignoreWasPrice": a feed whose rrp_price is the same mark-up on every product (PCHUB.UK: price x 1.44) is not
        // a real earlier price, so no "was" price and no discount badge.
        const wasRaw = source.ignoreWasPrice ? NaN : parsePrice(pick(rec, map.was));
        const wasPrice = Number.isFinite(wasRaw) && wasRaw > price * 1.04 && wasRaw < price * 5 ? wasRaw : null;
        const gtin = normalizeGtin(pick(rec, map.gtin));
        const condRaw = pick(rec, map.condition).toLowerCase();
        // The site shows a "Refurbished" badge: the name decides too ("Corsair HS65 W/L HEADSET CARBON REFURB", "Lenovo PREMIUM
        // REFURBISHED ...", fourth dry run 24 Oct 2026). Back to the Office's graded laptops ("Dell Latitude ... (Grade B -
        // Average)", "(Grade A1 - Like New)") were on the live site as new: 93 of them.
        const condition = /refurb|renewed/.test(condRaw) || /\b(?:refurb(?:ished)?|renewed|grade [a-c]\d?)\b/i.test(name) ? 'refurbished'
          : /used|pre-?owned|second-?hand/.test(condRaw) || /\bpre-?owned\b/i.test(name) ? 'used' : (source.condition || 'new');
        const specs = {};
        const colour = cleanText(pick(rec, map.colour));
        const size = cleanText(pick(rec, map.size));
        if (colour && colour.length <= 40) specs.Colour = colour;
        if (size && size.length <= 40) specs.Size = size;

        const p = {
          stable_key: stableKey,
          awin_advertiser_id: source.advertiserId,
          awin_product_id: pick(rec, map.awinProductId) || null,
          merchant_product_id: merchantProductId,
          retailer: source.retailer,
          category_slug: cls.slug,
          subcategory: subcategoryOf(merchantCategory) || null,
          brand: brand || null,
          product_name: name,
          product_slug: slugify(name),
          description: truncate(cleanText(pick(rec, map.description)), 1500) || null,
          price,
          was_price: wasPrice,
          currency,
          in_stock: stock === false ? 0 : 1,
          item_condition: condition,
          image_url: image,
          affiliate_url: link,
          merchant_category: truncate(merchantCategory || awinCategory, 200) || null,
          gtin,
          mpn: cleanText(pick(rec, map.mpn)).slice(0, 60) || null,
          specs_json: Object.keys(specs).length ? JSON.stringify(specs) : null,
          is_active: 1,
          last_seen_at: runStamp
        };
        candidates.push({ p, short, loose, feedCategory: merchantCategory || awinCategory || '-', qtyZero: quantity === '0' });
        if (google) googleSeen.set(stableKey, p);
      }
      feedInfo.push(`  rows read: ${rows}`);
      sourceRows += rows;
    }
    if (sourceRows > 0 && missing === 0) readAdvertisers.add(source.advertiserId);
    else notRead.push(source.retailer);
  }

  // ---------- Duplicates out, then the counts and samples of what stays ----------
  const dup = findDuplicates(candidates.map(c => c.p));
  const kept = i => candidates[dup.keptFor[i]].p;
  for (const i of dup.sameShop) reject('duplicate: same shop, same name or EAN (the cheapest is kept)', `${candidates[i].short}  (kept: ${kept(i).price.toFixed(2)})`);
  for (const i of dup.otherShop) reject('duplicate: same product and price at another shop', `${candidates[i].short}  (shown from ${kept(i).retailer})`);
  candidates.forEach((c, i) => {
    if (!dup.keep[i]) return;
    const { p, short } = c;
    const slug = p.category_slug;
    const rs = stats.perRetailer[p.retailer];
    products.set(p.stable_key, p);
    stats.accepted++;
    stats.perCategory[slug] = (stats.perCategory[slug] || 0) + 1;
    rs.accepted++;
    if (c.qtyZero) rs.qtyZero++;
    rs.perCategory[slug] = (rs.perCategory[slug] || 0) + 1;
    const rlist = (samples.byRetailer[p.retailer][slug] ||= []);
    if (rlist.length < SAMPLES_PER_SHOP) rlist.push(short);
    const fc = truncate(c.feedCategory, 70);
    const fcs = (stats.feedCats[slug] ||= {});
    fcs[fc] = (fcs[fc] || 0) + 1;
    const fcLong = truncate(c.feedCategory, 110);
    const rfc = (rs.feedCats[slug] ||= {});
    rfc[fcLong] = (rfc[fcLong] || 0) + 1;
    const example = `${truncate(p.product_name, 90)} | ${p.price.toFixed(2)}`;
    addSample((rs.folderSamples[slug] ||= {}), fcLong, example, SAMPLES_PER_FOLDER, rng);
    if (c.loose) {
      rs.loose++;
      addSample(rs.looseSamples, slug, `${example} | ${truncate(c.feedCategory, 60)}`, SAMPLES_LOOSE, rng);
    }
    if (p.gtin) stats.gtinValid++;
    if (p.was_price) stats.withWas++;
    const list = (samples.accepted[slug] ||= []);
    if (list.length < SAMPLES_PER_GROUP) list.push(short);
  });

  // ---------- SQL (written, never executed here) ----------
  mkdirSync(join(outDir, 'sql'), { recursive: true });
  const cols = ['stable_key', 'awin_advertiser_id', 'awin_product_id', 'merchant_product_id', 'retailer', 'category_slug', 'subcategory', 'brand', 'product_name', 'product_slug', 'description', 'price', 'was_price', 'currency', 'in_stock', 'item_condition', 'image_url', 'affiliate_url', 'merchant_category', 'gtin', 'mpn', 'specs_json', 'is_active', 'last_seen_at'];
  const updateCols = cols.filter(c => c !== 'stable_key' && c !== 'awin_advertiser_id' && c !== 'merchant_product_id');
  const all = [...products.values()];
  const sqlFiles = [];
  for (let i = 0; i < all.length; i += SQL_ROWS_PER_FILE) {
    const part = all.slice(i, i + SQL_ROWS_PER_FILE);
    const lines = part.map(p => `INSERT INTO products (${cols.join(', ')}) VALUES (${cols.map(c => sq(p[c])).join(', ')}) ON CONFLICT(stable_key) DO UPDATE SET ${updateCols.map(c => `${c} = excluded.${c}`).join(', ')}, updated_at = datetime('now');`);
    const name = `${String(sqlFiles.length + 1).padStart(4, '0')}.sql`;
    writeFileSync(join(outDir, 'sql', name), `-- ${label} import plan ${runStamp}. NOT executed. Loading needs the owner's approval.\n${lines.join('\n')}\n`);
    sqlFiles.push(name);
  }
  const advIds = [...readAdvertisers];
  const finish = [
    `-- ${label} import plan ${runStamp}. NOT executed. Run only after all numbered files succeeded.`,
    // A retailer whose feed was not found keeps its products as they are (never hidden because a file is missing).
    ...(advIds.length ? [`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE awin_advertiser_id IN (${advIds.join(', ')}) AND is_active = 1 AND last_seen_at < ${sq(runStamp)};`] : []),
    `INSERT INTO import_runs (source, inserted, updated, deactivated, notes) VALUES (${sq('awin:' + (advIds.join(',') || 'none'))}, ${all.length}, 0, 0, ${sq('planned ' + runStamp)});`
  ];
  writeFileSync(join(outDir, 'sql', '9999-finish.sql'), finish.join('\n') + '\n');

  // ---------- Report ----------
  const L = [];
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
  L.push(`${label} IMPORT PLAN (dry run, nothing imported) ${runStamp} UTC`);
  L.push(`Archive: ${archives.join(' ; ')}`);
  L.push(`Sources: ${sources.map(s => `${s.retailer} (${s.advertiserId}: ${s.file ? 'file ' + s.file : (s.feedIds || []).join(',') || 'all files'})`).join('; ')}${onlyIds ? ' (only these)' : ''}`);
  L.push('');
  L.push('== Feeds ==');
  L.push(...feedInfo);
  for (const r of notRead) L.push(`${r}: its feed was not found (or is empty), so its products on the site are left exactly as they are.`);
  L.push('');
  L.push(`== Result: ${stats.accepted} of ${stats.rows} rows would be imported (${pct(stats.accepted, stats.rows)}) ==`);
  if (stats.sizesJoined) L.push(`sizes and colours joined into one product (Google format feeds): ${stats.sizesJoined} rows`);
  L.push('per retailer: ' + Object.entries(stats.perRetailer).filter(([, v]) => v.accepted).map(([r, v]) => `${r} ${v.accepted}`).join(', '));
  L.push(`valid GTIN: ${stats.gtinValid} (${pct(stats.gtinValid, stats.accepted)}) | with a was-price: ${stats.withWas}`);
  L.push('');
  L.push('== Per shop ==');
  for (const [r, v] of Object.entries(stats.perRetailer)) {
    if (!v.rows) continue; // its feed was not read: said under "Feeds"
    L.push(`  ${r}: ${v.accepted} of ${v.rows} rows (${pct(v.accepted, v.rows)})`);
    const cats = CATEGORY_SLUGS.filter(sl => v.perCategory[sl]).map(sl => `${sl} ${v.perCategory[sl]}`).join(' | ');
    if (cats) L.push('      ' + cats);
    if (v.qtyZero) L.push(`      in stock by the feed, but stock_quantity 0: ${v.qtyZero} (lessons L63)`);
  }
  L.push('');
  const overlap = crossShopOverlap(all);
  const pairList = Object.values(overlap.pairs).sort((x, y) => y.n - x.n);
  L.push('== The same product at two shops, at different prices (both are shown, as separate cards) ==');
  for (const [r, v] of Object.entries(overlap.perShop)) {
    L.push(`  ${r}: ${v.kept} kept | ${v.elsewhere} also at another shop | ${v.kept - v.elsewhere} only at ${r}`);
  }
  for (const pr of pairList) {
    L.push(`  ${pr.a} and ${pr.b}: ${pr.n} (cheaper at ${pr.a}: ${pr.cheaperA} | cheaper at ${pr.b}: ${pr.cheaperB}${pr.same ? ` | same price: ${pr.same}` : ''})`);
    for (const x of pr.examples) L.push(`      e.g. ${x}`);
  }
  L.push('');
  L.push(`== Per shop: the biggest feed folders of each category (with up to ${SAMPLES_PER_FOLDER} random examples) ==`);
  for (const [r, v] of Object.entries(stats.perRetailer)) {
    if (!v.accepted) continue;
    for (const slug of CATEGORY_SLUGS) {
      const top = Object.entries(v.feedCats[slug] || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (!top.length) continue;
      L.push(`  ${r} | ${slug}`);
      for (const [c, n] of top) {
        L.push(`      ${String(n).padStart(5)}  ${c}`);
        for (const x of ((v.folderSamples[slug] || {})[c] || { items: [] }).items) L.push(`               - ${x}`);
      }
    }
  }
  L.push('');
  const looseShops = Object.entries(stats.perRetailer).filter(([, v]) => v.loose);
  if (looseShops.length) {
    L.push(`== Catch-all folders: products placed by their NAME alone (up to ${SAMPLES_LOOSE} random examples per category) ==`);
    for (const [r, v] of looseShops) {
      L.push(`  ${r}: ${v.loose} of its ${v.accepted} products`);
      for (const slug of CATEGORY_SLUGS) {
        const s = v.looseSamples[slug];
        if (!s) continue;
        L.push(`  -- ${r} | ${slug}: ${s.n}`);
        for (const x of s.items) L.push(`     ${x}`);
      }
    }
    L.push('');
  }
  L.push('== Per category ==');
  for (const slug of CATEGORY_SLUGS) {
    L.push(`  ${slug.padEnd(24)} ${stats.perCategory[slug] || 0}`);
    const top = Object.entries(stats.feedCats[slug] || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [c, n] of top) L.push(`      ${String(n).padStart(5)}  ${c}`);
  }
  L.push('');
  L.push('== Rejected, by reason ==');
  for (const [k, v] of Object.entries(stats.rejected).sort((a, b) => b[1] - a[1])) L.push(`  ${k.padEnd(28)} ${v}`);
  if (stats.rejected['duplicate: same shop, same name or EAN (the cheapest is kept)']) {
    L.push('  (duplicates: the same product twice in one shop is shown once, at its lowest price - owner\'s rule)');
  }
  L.push('');
  // Which business word stopped how many products, most in-stock first: a word that stops consumer products shows up here.
  if (Object.keys(stats.denyWords).length) {
    L.push('== Business words: the word that left products out (rows | in stock | 2 in-stock examples), top 40 per shop ==');
    for (const [r, words] of Object.entries(stats.denyWords)) {
      L.push(`  ${r}`);
      const top = Object.entries(words).sort((a, b) => b[1].inStock - a[1].inStock || b[1].n - a[1].n).slice(0, 40);
      for (const [w, v] of top) L.push(`    ${String(v.n).padStart(5)} | ${String(v.inStock).padStart(5)} | ${w}${v.examples.length ? '  ->  ' + v.examples.join('  ;  ') : ''}`);
    }
    L.push('');
  }
  L.push(`== Samples: up to ${SAMPLES_PER_GROUP} accepted per category (name | price | feed category) ==`);
  for (const slug of CATEGORY_SLUGS) {
    const list = samples.accepted[slug] || [];
    if (!list.length) continue;
    L.push(`-- ${slug}`);
    for (const s of list) L.push(`   ${s}`);
  }
  L.push('');
  L.push(`== Samples per shop: up to ${SAMPLES_PER_SHOP} accepted per category ==`);
  for (const [r, bySlug] of Object.entries(samples.byRetailer)) {
    for (const slug of CATEGORY_SLUGS) {
      const list = bySlug[slug] || [];
      if (!list.length) continue;
      L.push(`-- ${r} | ${slug}`);
      for (const x of list) L.push(`   ${x}`);
    }
  }
  L.push('');
  L.push(`== Samples: up to ${SAMPLES_PER_GROUP} rejected per reason ==`);
  for (const [k, list] of Object.entries(samples.rejected)) {
    L.push(`-- ${k}`);
    for (const s of list) L.push(`   ${s}`);
  }
  L.push('');
  const folderReasons = Object.entries(stats.rejectFolders).filter(([, f]) => Object.keys(f).length);
  if (folderReasons.length) {
    L.push('== Left out by the category rules, per feed folder (biggest 15, up to 6 examples) ==');
    for (const [reason, byFolder] of folderReasons) {
      L.push(`-- ${reason}`);
      for (const [folder, f] of Object.entries(byFolder).sort((a, b) => b[1].n - a[1].n).slice(0, 15)) {
        L.push(`   ${String(f.n).padStart(6)}  ${folder}`);
        for (const x of f.ex) L.push(`            - ${x}`);
      }
    }
    L.push('');
  }
  L.push(`SQL written (NOT executed): ${sqlFiles.length} file(s) + 9999-finish.sql in ${join(outDir, 'sql')}`);
  L.push('=== END ===');
  const report = L.join('\r\n');
  writeFileSync(join(outDir, 'report.txt'), '﻿' + report);
  return { report, stats, sqlFiles, products: all };
}

// ---------- CLI ----------
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = val('archive');
  const outDir = val('out');
  const sourcesFile = val('sources') || join(here, '..', 'sites', 'tgw', 'sources.json');
  if (!archive || !outDir) {
    console.error('usage: node tools/tgw-import-plan.mjs --archive <dir> --out <dir> [--sources <file>]');
    process.exit(2);
  }
  if (existsSync(join(outDir, 'report.txt'))) {
    console.error(`Output folder already has a report: ${outDir}. Use a new folder.`);
    process.exit(2);
  }
  mkdirSync(outDir, { recursive: true });
  const { stats, sqlFiles } = await planImport({ archive, sourcesFile, outDir });
  console.log(`rows ${stats.rows} | would import ${stats.accepted} | SQL files ${sqlFiles.length} (not executed)`);
  console.log(`report: ${join(outDir, 'report.txt')}`);
}
