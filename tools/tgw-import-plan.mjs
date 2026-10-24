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
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classify, cleanProductName, QUALITY, CATEGORY_SLUGS } from '../sites/tgw/category-rules.js';
import { normalizeGtin } from '../src/lib/gtin.js';
import { slugify, truncate } from '../src/lib/text.js';

const here = dirname(fileURLToPath(import.meta.url));
const SQL_ROWS_PER_FILE = 400;
const SAMPLES_PER_GROUP = 15;
const SAMPLES_PER_SHOP = 10;

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
const normBrand = b => String(b || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const pathFolders = p => String(p || '').split('>').map(s => s.trim().toLowerCase()).filter(Boolean);
export function sourceFilter(source) {
  const brands = Array.isArray(source.brands) && source.brands.length ? new Set(source.brands.map(normBrand)) : null;
  const deny = Array.isArray(source.denyNames) && source.denyNames.length ? new RegExp(source.denyNames.join('|'), 'i') : null;
  const allowPaths = Array.isArray(source.allowPaths) && source.allowPaths.length ? new Set(source.allowPaths.map(s => s.toLowerCase())) : null;
  const denyPaths = Array.isArray(source.denyPaths) && source.denyPaths.length ? new Set(source.denyPaths.map(s => s.toLowerCase())) : null;
  return (name, brand, path = '') => {
    const folders = pathFolders(path);
    if (denyPaths && folders.some(f => denyPaths.has(f))) return `feed folder not for TGW (${source.retailer})`;
    if (allowPaths && !folders.some(f => allowPaths.has(f))) return `feed folder not on the consumer list (${source.retailer})`;
    if (brands && !brands.has(normBrand(brand))) return `brand not on the consumer list (${source.retailer})`;
    if (deny && deny.test(name)) return `business IT, parts or services (${source.retailer})`;
    return '';
  };
}

export async function planImport({ archive, sourcesFile, outDir, now = new Date() }) {
  const sources = JSON.parse(readFileSync(sourcesFile, 'utf8')).sources.filter(s => s.approved);
  const runStamp = now.toISOString().replace('T', ' ').slice(0, 19);
  const archives = archiveList(archive);
  // Only a retailer whose feed was found and read gets its missing products hidden by 9999-finish.sql.
  const readAdvertisers = new Set();
  const notRead = [];
  const stats = { rows: 0, accepted: 0, rejected: {}, perCategory: {}, gtinValid: 0, withWas: 0, feedCats: {}, perRetailer: {} };
  const samples = { accepted: {}, rejected: {}, byRetailer: {} };
  const feedInfo = [];
  const products = new Map();
  const seenNames = new Set();
  const reject = (reason, rec) => {
    stats.rejected[reason] = (stats.rejected[reason] || 0) + 1;
    const list = (samples.rejected[reason] ||= []);
    if (list.length < (reason.startsWith('not matched') ? 40 : SAMPLES_PER_GROUP)) list.push(rec);
  };

  for (const source of sources) {
    const filter = sourceFilter(source);
    let sourceRows = 0, missing = 0;
    // Per shop: rows, products and samples, so a new shop can be checked on its own (PCHUB.UK next to Back to the Office).
    const rs = (stats.perRetailer[source.retailer] ||= { rows: 0, accepted: 0, perCategory: {} });
    const rsamples = (samples.byRetailer[source.retailer] ||= {});
    for (const feedId of source.feedIds) {
      const fname = `AWIN_${source.advertiserId}_${feedId}.csv.gz`;
      const found = findFeed(archives, fname);
      if (!found) { feedInfo.push(`${fname}: NOT FOUND in the archive folder(s)`); missing++; continue; }
      const real = found.name;
      if (archives.length > 1) feedInfo.push(`${fname}: from ${found.dir}`);
      let header = null, map = null, rows = 0;
      const stream = createReadStream(found.full).pipe(createGunzip());
      for await (const rec of readCsvRecords(stream)) {
        if (!header) {
          header = rec; map = mapHeader(rec);
          const missing = ['name', 'price', 'link', 'merchantProductId', 'images'].filter(k => !map[k].length);
          feedInfo.push(`${real}: ${rec.length} columns${missing.length ? ' | MISSING: ' + missing.join(', ') : ''}`);
          feedInfo.push('  columns used: ' + Object.entries(map).map(([k, v]) => `${k}=${v.map(i => header[i]).join('/') || '-'}`).join(' '));
          continue;
        }
        if (rec.length === 1 && rec[0] === '') continue;
        rows++; stats.rows++; rs.rows++;
        const rawName = pick(rec, map.name);
        let name = cleanProductName(cleanText(rawName));
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
        if (filtered) { reject(filtered, short); continue; }
        const cls = classify(name, `${merchantCategory || awinCategory} ${merchantCategory ? awinCategory : ''}`.trim());
        if (!cls.ok) { reject(cls.reason, short); continue; }
        if (!Number.isFinite(price) || price <= 0) { reject('no price', short); continue; }
        if (price < QUALITY.minPrice || price > QUALITY.maxPrice) { reject('price out of range', short); continue; }
        const currency = detectCurrency(rec, map, source);
        if (currency !== QUALITY.currency) { reject(`currency ${currency || 'unknown'}`, short); continue; }
        const stock = inStockValue(pick(rec, map.inStock));
        if (QUALITY.requireInStock && stock === false) { reject('out of stock', short); continue; }
        const image = firstHttpsImage(rec, map);
        if (QUALITY.requireImage && !image) { reject('no https image', short); continue; }
        const link = pick(rec, map.link);
        let host = '';
        try { host = new URL(link).hostname.toLowerCase(); } catch { /* invalid */ }
        if (!QUALITY.affiliateHosts.includes(host)) { reject('link is not an Awin link', short); continue; }
        const merchantProductId = pick(rec, map.merchantProductId);
        if (!merchantProductId) { reject('no product id', short); continue; }
        const stableKey = `${source.advertiserId}:${merchantProductId}`;
        if (products.has(stableKey)) { reject('duplicate product id', short); continue; }
        const nameKey = `${source.advertiserId}|${name.toLowerCase()}|${price.toFixed(2)}`;
        if (seenNames.has(nameKey)) { reject('duplicate (same name and price)', short); continue; }
        seenNames.add(nameKey);

        // "ignoreWasPrice": a feed whose rrp_price is the same mark-up on every product (PCHUB.UK: price x 1.44) is not
        // a real earlier price, so no "was" price and no discount badge.
        const wasRaw = source.ignoreWasPrice ? NaN : parsePrice(pick(rec, map.was));
        const wasPrice = Number.isFinite(wasRaw) && wasRaw > price * 1.04 && wasRaw < price * 5 ? wasRaw : null;
        const gtin = normalizeGtin(pick(rec, map.gtin));
        const condRaw = pick(rec, map.condition).toLowerCase();
        const condition = /refurb/.test(condRaw) || /\brefurbished\b/i.test(name) ? 'refurbished'
          : /used|pre-?owned/.test(condRaw) ? 'used' : (source.condition || 'new');
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
        products.set(stableKey, p);
        stats.accepted++;
        stats.perCategory[cls.slug] = (stats.perCategory[cls.slug] || 0) + 1;
        rs.accepted++;
        rs.perCategory[cls.slug] = (rs.perCategory[cls.slug] || 0) + 1;
        const rlist = (rsamples[cls.slug] ||= []);
        if (rlist.length < SAMPLES_PER_SHOP) rlist.push(short);
        const fc = truncate(merchantCategory || awinCategory || '-', 70);
        const fcs = (stats.feedCats[cls.slug] ||= {});
        fcs[fc] = (fcs[fc] || 0) + 1;
        if (gtin) stats.gtinValid++;
        if (wasPrice) stats.withWas++;
        const list = (samples.accepted[cls.slug] ||= []);
        if (list.length < SAMPLES_PER_GROUP) list.push(short);
      }
      feedInfo.push(`  rows read: ${rows}`);
      sourceRows += rows;
    }
    if (sourceRows > 0 && missing === 0) readAdvertisers.add(source.advertiserId);
    else notRead.push(source.retailer);
  }

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
    writeFileSync(join(outDir, 'sql', name), `-- TGW import plan ${runStamp}. NOT executed. Loading needs the owner's approval.\n${lines.join('\n')}\n`);
    sqlFiles.push(name);
  }
  const advIds = [...readAdvertisers];
  const finish = [
    `-- TGW import plan ${runStamp}. NOT executed. Run only after all numbered files succeeded.`,
    // A retailer whose feed was not found keeps its products as they are (never hidden because a file is missing).
    ...(advIds.length ? [`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE awin_advertiser_id IN (${advIds.join(', ')}) AND is_active = 1 AND last_seen_at < ${sq(runStamp)};`] : []),
    `INSERT INTO import_runs (source, inserted, updated, deactivated, notes) VALUES (${sq('awin:' + (advIds.join(',') || 'none'))}, ${all.length}, 0, 0, ${sq('planned ' + runStamp)});`
  ];
  writeFileSync(join(outDir, 'sql', '9999-finish.sql'), finish.join('\n') + '\n');

  // ---------- Report ----------
  const L = [];
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
  L.push(`TGW IMPORT PLAN (dry run, nothing imported) ${runStamp} UTC`);
  L.push(`Archive: ${archives.join(' ; ')}`);
  L.push(`Sources: ${sources.map(s => `${s.retailer} (${s.advertiserId}: ${s.feedIds.join(',')})`).join('; ')}`);
  L.push('');
  L.push('== Feeds ==');
  L.push(...feedInfo);
  for (const r of notRead) L.push(`${r}: its feed was not found (or is empty), so its products on the site are left exactly as they are.`);
  L.push('');
  L.push(`== Result: ${stats.accepted} of ${stats.rows} rows would be imported (${pct(stats.accepted, stats.rows)}) ==`);
  L.push(`valid GTIN: ${stats.gtinValid} (${pct(stats.gtinValid, stats.accepted)}) | with a was-price: ${stats.withWas}`);
  L.push('');
  L.push('== Per shop ==');
  for (const [r, v] of Object.entries(stats.perRetailer)) {
    if (!v.rows) continue; // its feed was not read: said under "Feeds"
    L.push(`  ${r}: ${v.accepted} of ${v.rows} rows (${pct(v.accepted, v.rows)})`);
    const cats = CATEGORY_SLUGS.filter(sl => v.perCategory[sl]).map(sl => `${sl} ${v.perCategory[sl]}`).join(' | ');
    if (cats) L.push('      ' + cats);
  }
  L.push('');
  L.push('== Per category ==');
  for (const slug of CATEGORY_SLUGS) {
    L.push(`  ${slug.padEnd(24)} ${stats.perCategory[slug] || 0}`);
    const top = Object.entries(stats.feedCats[slug] || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [c, n] of top) L.push(`      ${String(n).padStart(5)}  ${c}`);
  }
  L.push('');
  L.push('== Rejected, by reason ==');
  for (const [k, v] of Object.entries(stats.rejected).sort((a, b) => b[1] - a[1])) L.push(`  ${k.padEnd(28)} ${v}`);
  L.push('');
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
