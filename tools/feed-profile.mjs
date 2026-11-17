// Gear World - FEED PROFILE (owner, 8 Nov 2026: "feed download and import, all in one go"). READ-ONLY.
// For the feeds on this PC (Awin, CJ, Daisycon, Rakuten) that were downloaded recently (or the advertisers given), one block per feed with what is
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
  language: ['language'], updated: ['last_updated']
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
const ageDays = (ymd, now) => Math.floor((new Date(now).getTime() - Date.parse(`${ymd}T00:00:00Z`)) / 86400000);
function hostOf(link) {
  try {
    const u = new URL(link);
    // An Awin tracking link carries the shop's own address in "ued".
    const ued = u.searchParams.get('ued');
    return (ued ? new URL(ued) : u).hostname.replace(/^www\./, '');
  } catch { return ''; }
}

// Feed files of every network the download tools write (lessons L133): AWIN_<shop>_<feed>, CJ_<shop>, DAISYCON_<programme>,
// RAKUTEN_<MID> (the last three have the Awin column names). -Advertiser '<ids>' picks shops; with alsoDays the feeds
// downloaded in the last days come too, so one report has the shops asked for and everything just downloaded.
// The CJ, Daisycon and Rakuten files may have a tail: one file per country (DAISYCON_14965_DE, lessons L163) or per
// search (CJ_3992613_kids-winter-boots, L161); bol.com: BOL_<category>_<country>(-<search>) (tools/bol-feed.mjs). Before 16 Nov 2026 these were skipped without a word (chat 9: Superdry
// DE/NL and Chromeburner GB/DE of wave 3 would have been missing from the profile).
// -Network Daisycon (or 'CJ,Daisycon'): only the files of those networks. The shop ids of two networks can be the same
// number (an Awin advertiser and a Daisycon programme), so -Advertiser alone cannot pick one network.
const FEED_FILE = /^(?:AWIN_(\d+)_(\d+)|(CJ|DAISYCON|RAKUTEN|BOL)_(\d+)(?:_([A-Za-z0-9][A-Za-z0-9-]{0,39}))?)\.csv(?:\.gz)?$/i;
const NETWORK = { CJ: 'CJ', DAISYCON: 'Daisycon', RAKUTEN: 'Rakuten', BOL: 'bol' };
export const NETWORKS = ['Awin', 'CJ', 'Daisycon', 'Rakuten', 'bol'];
export function feedOf(name) {
  const m = String(name).match(FEED_FILE);
  if (!m) return null;
  if (m[1]) return { network: 'Awin', advertiserId: Number(m[1]), feedId: Number(m[2]), part: '' };
  // A two-letter tail is a country (upper case, as the download writes it); a longer one is a search name.
  const part = m[5] ? (/^[a-z]{2}$/i.test(m[5]) ? m[5].toUpperCase() : m[5]) : '';
  return { network: NETWORK[m[3].toUpperCase()], advertiserId: Number(m[4]), feedId: null, part };
}
// 'daisycon', 'CJ, Daisycon' -> ['CJ', 'Daisycon']; an unknown name -> null (the tool stops: never a silent empty report).
export function parseNetworks(text) {
  const words = String(text || '').split(/[\s,;]+/).filter(Boolean);
  const out = [];
  for (const w of words) {
    const n = NETWORKS.find(x => x.toLowerCase() === w.toLowerCase());
    if (!n) return null;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
export function chooseFiles(archive, { advertisers = [], days = 2, alsoDays = 0, networks = [], now = Date.now() } = {}) {
  const ads = new Set(advertisers.map(String));
  const nets = new Set(networks);
  const recent = (f, d) => now - statSync(join(archive, f)).mtimeMs <= d * 86400000;
  return readdirSync(archive).filter(f => feedOf(f)).filter(f => !nets.size || nets.has(feedOf(f).network)).filter(f => {
    const adv = String(feedOf(f).advertiserId);
    if (ads.size) return ads.has(adv) || (alsoDays > 0 && recent(f, alsoDays));
    return recent(f, days);
  }).sort();
}

export async function profileFile(file, { maxRows = Infinity } = {}) {
  const name = file.split(/[\\/]/).pop();
  const f = feedOf(name) || { network: 'Awin', advertiserId: 0, feedId: 0, part: '' };
  const p = { network: f.network, advertiserId: f.advertiserId, feedId: f.feedId, part: f.part || '', newest: '', merchant: '', rows: 0, inStock: 0, priced: 0, withWas: 0, withImage: 0,
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
      // The newest product change in the feed (Daisycon, CJ): a feed that stopped changing has old prices (L147: ≤ 14 days).
      const upd = pick(rec, map.updated);
      if (/^\d{4}-\d{2}-\d{2}/.test(upd) && upd.slice(0, 10) > p.newest) p.newest = upd.slice(0, 10);
      // Samples spread over the file: the first 4, then every 500th product, up to 10.
      if (p.samples.length < 10 && (p.rows <= 4 || p.rows % 500 === 0)) p.samples.push({ name: pick(rec, map.name).slice(0, 100), price });
      if (p.rows >= maxRows) break;
    }
  } catch (e) { p.error = String(e && e.message || e).slice(0, 160); }
  p.prices.sort((a, b) => a - b);
  return p;
}

export function render({ profiles, archive, generated = new Date(), days, advertisers, alsoDays = 0, networks = [] }) {
  const lines = [
    'Gear World - FEED PROFILE (μόνο ανάγνωση)',
    `Ώρα: ${generated.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    `Φάκελος: ${archive}`,
    ...(networks.length ? [`Δίκτυα: μόνο ${networks.join(', ')}`] : []),
    advertisers && advertisers.length ? `Καταστήματα: ${advertisers.join(', ')}${alsoDays > 0 ? ` και ό,τι κατέβηκε τις τελευταίες ${Math.round(alsoDays * 24)} ώρες` : ''} (${profiles.length} feeds)` : `Feeds που άλλαξαν τις τελευταίες ${days} μέρες: ${profiles.length}`,
    ''
  ];
  if (!profiles.length) lines.push('Δεν βρέθηκε κανένα feed. Αν μόλις έγινε λήψη, δες την αναφορά της λήψης.');
  for (const p of profiles) {
    const pr = p.prices;
    const med = pr.length ? pr[Math.floor(pr.length / 2)] : 0;
    const where = (p.network || 'Awin') === 'Awin' ? `Awin ${p.advertiserId}, feed ${p.feedId}` : `${p.network} ${p.advertiserId}${p.part ? ` ${p.part}` : ''}`;
    lines.push(`=== ${p.merchant || '?'} (${where}) | αρχείο ${p.ageHours} ωρών`);
    if (p.error) { lines.push(`  Δεν διαβάστηκε: ${p.error}`, ''); continue; }
    lines.push(`  Προϊόντα: ${p.rows} | σε απόθεμα: ${p.inStock} | με τιμή: ${p.priced} | με «πριν» τιμή: ${p.withWas} | με εικόνα: ${p.withImage}`);
    if (pr.length) lines.push(`  Τιμές: από ${pr[0].toFixed(2)} | μέση ${med.toFixed(2)} | έως ${pr[pr.length - 1].toFixed(2)}`);
    lines.push(`  Νόμισμα: ${top(p.currencies, 3).map(([k, v]) => `${k} ${v}`).join(', ')} | γλώσσα: ${top(p.languages, 3).map(([k, v]) => `${k || '?'} ${v}`).join(', ')}`);
    if (p.newest) lines.push(`  Νεότερη αλλαγή προϊόντος: ${p.newest}${ageDays(p.newest, generated) > 14 ? ' (πάνω από 14 μέρες, L147: πρώτα έλεγχος τιμών στο κατάστημα)' : ''}`);
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
  const alsoDays = Number(val('also-days')) || 0;
  const networks = parseNetworks(val('network'));
  if (!networks) { console.error(`Unknown network: ${val('network')} (one of ${NETWORKS.join(', ')})`); process.exit(2); }
  const files = chooseFiles(archive, { advertisers, days, alsoDays, networks });
  const profiles = [];
  for (const f of files) { process.stdout.write(`\r${f}`.padEnd(70)); profiles.push(await profileFile(join(archive, f), { maxRows: Number(val('max-rows')) || Infinity })); }
  process.stdout.write('\n');
  writeFileSync(join(out, 'report.txt'), render({ profiles, archive, days, advertisers, alsoDays, networks }));
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
