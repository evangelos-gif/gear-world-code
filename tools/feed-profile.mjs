// Gear World - FEED PROFILE (owner, 8 Nov 2026: "feed download and import, all in one go"). READ-ONLY.
// For the Awin feeds on this PC that were downloaded recently (or the advertisers given), one block per feed with what is
// needed to write a shop's import rules (tools/import-rules, lessons L14) and to choose its site: the shop's web address,
// currency, how many products and in stock, prices, the shop's own categories, brands, sample names, "was" prices and
// images. It changes nothing: no import, no Cloudflare, no D1, no file in the archive.
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';

const COLS = {
  merchant: ['merchant_name'], name: ['product_name'], brand: ['brand_name', 'brand'],
  price: ['search_price', 'store_price', 'display_price', 'price'],
  was: ['rrp_price', 'product_price_old', 'base_price', 'saving_from_price'], currency: ['currency'],
  inStock: ['in_stock', 'is_for_sale', 'stock_status', 'stock_quantity'],
  category: ['merchant_category', 'merchant_product_category_path', 'category_name'],
  link: ['merchant_deep_link', 'aw_deep_link'], image: ['merchant_image_url', 'aw_image_url', 'large_image'],
  language: ['language']
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
const bump = (o, k) => { if (k) o[k] = (o[k] || 0) + 1; };
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
function hostOf(link) {
  try {
    const u = new URL(link);
    // An Awin tracking link carries the shop's own address in "ued".
    const ued = u.searchParams.get('ued');
    return (ued ? new URL(ued) : u).hostname.replace(/^www\./, '');
  } catch { return ''; }
}

export function chooseFiles(archive, { advertisers = [], days = 2, now = Date.now() } = {}) {
  const ads = new Set(advertisers.map(String));
  return readdirSync(archive).filter(f => /^AWIN_\d+_\d+\.csv(\.gz)?$/i.test(f)).filter(f => {
    const adv = f.match(/^AWIN_(\d+)_/i)[1];
    if (ads.size) return ads.has(adv);
    return now - statSync(join(archive, f)).mtimeMs <= days * 86400000;
  }).sort();
}

export async function profileFile(file, { maxRows = Infinity } = {}) {
  const name = file.split(/[\\/]/).pop();
  const [, adv, feed] = name.match(/^AWIN_(\d+)_(\d+)/i);
  const p = { advertiserId: Number(adv), feedId: Number(feed), merchant: '', rows: 0, inStock: 0, priced: 0, withWas: 0, withImage: 0,
    prices: [], currencies: {}, hosts: {}, categories: {}, brands: {}, languages: {}, samples: [], error: '',
    ageHours: Math.round((Date.now() - statSync(file).mtimeMs) / 3600000) };
  try {
    const raw = createReadStream(file);
    const stream = /\.gz$/i.test(name) ? raw.pipe(createGunzip()) : raw;
    let map = null;
    for await (const rec of readCsvRecords(stream)) {
      if (!map) { map = mapHeader(rec); continue; }
      if (rec.length < 3) continue;
      p.rows++;
      if (!p.merchant) p.merchant = pick(rec, map.merchant);
      const price = num(pick(rec, map.price));
      const was = num(pick(rec, map.was));
      if (price > 0) { p.priced++; if (p.prices.length < 50000) p.prices.push(price); }
      if (was > price && price > 0) p.withWas++;
      if (inStock(pick(rec, map.inStock)) !== false) p.inStock++;
      if (pick(rec, map.image)) p.withImage++;
      bump(p.currencies, pick(rec, map.currency).toUpperCase() || '?');
      bump(p.hosts, hostOf(pick(rec, map.link)));
      bump(p.categories, pick(rec, map.category) || '(no category)');
      bump(p.brands, pick(rec, map.brand) || '(no brand)');
      bump(p.languages, pick(rec, map.language).toLowerCase());
      // Samples spread over the file: the first 4, then every 500th product, up to 10.
      if (p.samples.length < 10 && (p.rows <= 4 || p.rows % 500 === 0)) p.samples.push({ name: pick(rec, map.name).slice(0, 100), price });
      if (p.rows >= maxRows) break;
    }
  } catch (e) { p.error = String(e && e.message || e).slice(0, 160); }
  p.prices.sort((a, b) => a - b);
  return p;
}

export function render({ profiles, archive, generated = new Date(), days, advertisers }) {
  const lines = [
    'Gear World - FEED PROFILE (μόνο ανάγνωση)',
    `Ώρα: ${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    `Φάκελος: ${archive}`,
    advertisers && advertisers.length ? `Καταστήματα: ${advertisers.join(', ')}` : `Feeds που άλλαξαν τις τελευταίες ${days} μέρες: ${profiles.length}`,
    ''
  ];
  if (!profiles.length) lines.push('Δεν βρέθηκε κανένα feed. Αν μόλις έγινε λήψη, δες την αναφορά της λήψης.');
  for (const p of profiles) {
    const pr = p.prices;
    const med = pr.length ? pr[Math.floor(pr.length / 2)] : 0;
    lines.push(`=== ${p.merchant || '?'} (Awin ${p.advertiserId}, feed ${p.feedId}) | αρχείο ${p.ageHours} ωρών`);
    if (p.error) { lines.push(`  Δεν διαβάστηκε: ${p.error}`, ''); continue; }
    lines.push(`  Προϊόντα: ${p.rows} | σε απόθεμα: ${p.inStock} | με τιμή: ${p.priced} | με «πριν» τιμή: ${p.withWas} | με εικόνα: ${p.withImage}`);
    if (pr.length) lines.push(`  Τιμές: από ${pr[0].toFixed(2)} | μέση ${med.toFixed(2)} | έως ${pr[pr.length - 1].toFixed(2)}`);
    lines.push(`  Νόμισμα: ${top(p.currencies, 3).map(([k, v]) => `${k} ${v}`).join(', ')} | γλώσσα: ${top(p.languages, 3).map(([k, v]) => `${k || '?'} ${v}`).join(', ')}`);
    lines.push(`  Site καταστήματος: ${top(p.hosts, 3).map(([k, v]) => `${k || '?'} ${v}`).join(', ')}`);
    lines.push(`  Κατηγορίες (${Object.keys(p.categories).length}): ${top(p.categories, 12).map(([k, v]) => `${k.slice(0, 50)} (${v})`).join('; ')}`);
    lines.push(`  Brands (${Object.keys(p.brands).length}): ${top(p.brands, 8).map(([k, v]) => `${k.slice(0, 30)} (${v})`).join('; ')}`);
    for (const s of p.samples) lines.push(`  ${s.price ? s.price.toFixed(2) : '?'} | ${s.name}`);
    lines.push('');
  }
  lines.push('Μόνο ανάγνωση: δεν άλλαξε τίποτα (ούτε αρχεία, ούτε sites, ούτε βάσεις).');
  return lines.join('\n') + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = resolve(val('archive') || '');
  if (!val('archive') || !existsSync(archive)) { console.error(`Archive folder not found: ${archive}`); process.exit(2); }
  const out = resolve(val('out') || 'feed-profile');
  mkdirSync(out, { recursive: true });
  const advertisers = (val('advertiser') || '').split(/[\s,;]+/).filter(x => /^\d+$/.test(x));
  const days = Number(val('days')) || 2;
  const files = chooseFiles(archive, { advertisers, days });
  const profiles = [];
  for (const f of files) { process.stdout.write(`\r${f}`.padEnd(70)); profiles.push(await profileFile(join(archive, f), { maxRows: Number(val('max-rows')) || Infinity })); }
  process.stdout.write('\n');
  writeFileSync(join(out, 'report.txt'), render({ profiles, archive, days, advertisers }));
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
