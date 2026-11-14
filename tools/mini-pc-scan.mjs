// Gear World - MINI PC SCAN (owner, 7 Nov 2026, lessons L97). READ-ONLY.
// Reads every Awin feed already in the archive on this PC and counts the mini PCs in each one, with the SAME words as the
// "Mini PCs" page of Technology Gear World (sites/tgw/site.config.js), matched the same way as the site's database query
// (whole words; brackets, commas, dots, slashes, hyphens and the like count as spaces). For each shop: how many, how many in
// stock, the cheapest, how many have a "was" price above the price (a sale the site can show), and whether Technology Gear
// World already takes that feed (sites/tgw/sources.json). Joybuy has many mini PCs on its own site but only 10 on TGW.
// It changes nothing: no import, no Cloudflare, no D1, no file in the archive.
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';
import site from '../sites/tgw/site.config.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SUB = site.categories.find(c => c.slug === 'laptops-computing').subcategories.find(s => s.slug === 'mini-pcs');
// The same as NAME_WORDS and wordOf in src/db.js: one replace per character, no squeezing of spaces.
const PUNCT = ['(', ')', ',', '.', '/', '-', ':', ';', '|', '+'];
const hay = name => ' ' + PUNCT.reduce((s, ch) => s.split(ch).join(' '), String(name || '').toLowerCase()) + ' ';
const wordOf = w => ' ' + String(w).toLowerCase().replace(/[(),./:;|+-]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
const WORDS = SUB.match.map(wordOf);
const NOT = SUB.exclude.map(wordOf);
export function isMiniPc(name) {
  const h = hay(name);
  return WORDS.some(w => h.includes(w)) && !NOT.some(w => h.includes(w));
}

const COLS = {
  merchant: ['merchant_name'], name: ['product_name'],
  price: ['search_price', 'store_price', 'display_price', 'price'],
  was: ['rrp_price', 'product_price_old', 'base_price', 'saving_from_price'], currency: ['currency'],
  inStock: ['in_stock', 'is_for_sale', 'stock_status', 'stock_quantity'],
  merchantCategory: ['merchant_category', 'merchant_product_category_path']
};
function mapHeader(header) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
  return Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, names.map(n => h.indexOf(n)).filter(i => i >= 0)]));
}
const pick = (rec, idxs) => { for (const i of idxs) { const v = rec[i]; if (v !== undefined && String(v).trim() !== '') return String(v).trim(); } return ''; };
const num = v => { const n = Number(String(v || '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0; };
function inStock(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  return /^(yes|y|true|in stock|in_stock|instock|available|available to order|limited stock)$/.test(s);
}

export function tgwFeeds(file = join(HERE, '..', 'sites', 'tgw', 'sources.json')) {
  try {
    const d = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
    const list = Array.isArray(d) ? d : (Array.isArray(d.sources) ? d.sources : []);
    return new Set(list.flatMap(s => (s.feedIds || []).map(String)));
  } catch { return new Set(); }
}

export async function scanArchive({ archive, maxRows = Infinity, log = () => {} }) {
  const files = readdirSync(archive).filter(f => /^AWIN_\d+_\d+\.csv(\.gz)?$/i.test(f)).sort();
  const feeds = [];
  let i = 0;
  for (const f of files) {
    i++;
    const [, adv, feed] = f.match(/^AWIN_(\d+)_(\d+)/i);
    const full = join(archive, f);
    const a = { advertiserId: Number(adv), feedId: Number(feed), merchant: '', rows: 0, mini: 0, inStock: 0, sale: 0,
      cheapest: [], currencies: {}, shopCats: {}, ageDays: Math.floor((Date.now() - statSync(full).mtimeMs) / 86400000), error: '' };
    try {
      const raw = createReadStream(full);
      const stream = /\.gz$/i.test(f) ? raw.pipe(createGunzip()) : raw;
      let map = null;
      for await (const rec of readCsvRecords(stream)) {
        if (!map) { map = mapHeader(rec); continue; }
        if (rec.length < 3) continue;
        a.rows++;
        if (!a.merchant) a.merchant = pick(rec, map.merchant);
        const name = pick(rec, map.name);
        if (isMiniPc(name)) {
          a.mini++;
          if (inStock(pick(rec, map.inStock)) !== false) a.inStock++;
          const price = num(pick(rec, map.price));
          const was = num(pick(rec, map.was));
          if (was > price && price > 0) a.sale++;
          const cur = pick(rec, map.currency).toUpperCase() || '?';
          a.currencies[cur] = (a.currencies[cur] || 0) + 1;
          const sc = pick(rec, map.merchantCategory) || '(no category)';
          a.shopCats[sc] = (a.shopCats[sc] || 0) + 1;
          if (price > 0) {
            a.cheapest.push({ name: name.slice(0, 90), price, was: was > price ? was : 0, cur });
            a.cheapest.sort((x, y) => x.price - y.price);
            if (a.cheapest.length > 5) a.cheapest.length = 5;
          }
        }
        if (a.rows >= maxRows) break;
      }
    } catch (e) {
      a.error = String(e && e.message || e).slice(0, 160);
    }
    feeds.push(a);
    log(`${i}/${files.length} ${f}`);
  }
  return feeds;
}

export function render({ feeds, inTgw = new Set(), archive = '', generated = new Date() }) {
  const withMini = feeds.filter(f => f.mini > 0).sort((x, y) => y.mini - x.mini);
  const lines = [
    'Gear World - MINI PC SCAN (μόνο ανάγνωση)',
    `Ώρα: ${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    `Φάκελος: ${archive}`,
    `Feeds που διαβάστηκαν: ${feeds.length}. Με mini PC: ${withMini.length}. Mini PC συνολικά: ${withMini.reduce((s, f) => s + f.mini, 0)}.`,
    'Οι λέξεις είναι ίδιες με τη σελίδα «Mini PCs» του Technology Gear World. «Έκπτωση» = τιμή «was» πάνω από την τιμή.',
    ''
  ];
  for (const f of withMini) {
    const cur = Object.entries(f.currencies).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', ');
    const old = f.ageDays > 30 ? ' | ΠΑΛΙΟ ΑΡΧΕΙΟ (πάνω από 30 μέρες, L39)' : '';
    const tg = inTgw.has(String(f.feedId)) ? ' | ΣΤΟ TECHNOLOGY' : ' | όχι στο Technology';
    lines.push(`${f.merchant || '?'} (Awin ${f.advertiserId}, feed ${f.feedId}) | mini PC: ${f.mini} | σε απόθεμα: ${f.inStock} | με έκπτωση: ${f.sale} | ${cur} | αρχείο ${f.ageDays} ημερών${old}${tg}`);
    const cats = Object.entries(f.shopCats).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k.slice(0, 60)} (${v})`).join('; ');
    lines.push(`  Κατηγορίες του καταστήματος: ${cats}`);
    for (const c of f.cheapest) lines.push(`  ${c.price.toFixed(2)} ${c.cur}${c.was ? ` (πριν ${c.was.toFixed(2)})` : ''} | ${c.name}`);
  }
  const errs = feeds.filter(f => f.error);
  if (errs.length) { lines.push('', 'Αρχεία που δεν διαβάστηκαν:'); for (const f of errs) lines.push(`  AWIN_${f.advertiserId}_${f.feedId}: ${f.error}`); }
  lines.push('', 'Μόνο ανάγνωση: δεν άλλαξε τίποτα (ούτε αρχεία, ούτε sites, ούτε βάσεις).');
  return lines.join('\n') + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = resolve(val('archive') || '');
  const out = resolve(val('out') || 'mini-pc-scan');
  if (!val('archive') || !existsSync(archive)) { console.error(`Archive folder not found: ${archive}`); process.exit(2); }
  mkdirSync(out, { recursive: true });
  const feeds = await scanArchive({ archive, maxRows: Number(val('max-rows')) || Infinity, log: m => process.stdout.write(`\r${m}`.padEnd(90)) });
  process.stdout.write('\n');
  writeFileSync(join(out, 'report.txt'), render({ feeds, inTgw: tgwFeeds(), archive }));
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
