#!/usr/bin/env node
// Awin feed inventory. READ-ONLY: it only reads the feed files on this PC and writes a report.
//
// For every file AWIN_<advertiserId>_<feedId>.csv.gz in the archive folder it counts products, in-stock
// share, EAN share, currencies, how recent the file is, and the main categories. It then suggests which
// Gear World site each retailer fits, and marks the retailers that no site uses yet.
//
// Usage: node tools/awin-feed-inventory.mjs --archive <dir> --out <dir> [--max-rows <n per feed>]
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';

// Retailers (Awin advertiser ids) already used by a site, from the sites' databases on 20 Oct 2026.
export const IN_USE = {
  123932: ['TGW', 'MGW', 'WGW'], 496: ['GGW'], 49385: ['GGW'], 122444: ['MGW', 'WGW', 'KGW', 'HGW'],
  125248: ['MGW', 'WGW'], 128533: ['MGW', 'WGW'], 78380: ['MGW', 'WGW'], 122382: ['MGW', 'WGW'],
  61197: ['MGW'], 125096: ['MGW', 'WGW'], 61655: ['MGW', 'WGW'], 123248: ['MGW', 'WGW'], 105835: ['MGW']
};

// Words in categories and product names that point to a site. Simple on purpose: it is a first sort,
// a person decides (and each site's import rules decide product by product).
export const SITE_WORDS = {
  TGW: ['laptop', 'computer', 'computing', 'tablet', 'phone', 'mobile', 'smartphone', 'headphone', 'earbud', 'audio', 'speaker', 'soundbar', 'tv', 'television', 'camera', 'drone', 'gaming', 'console', 'playstation', 'xbox', 'nintendo', 'monitor', 'printer', 'electronics', 'smart home', 'router', 'wifi', 'charger', 'usb', 'ssd'],
  MGW: ['men', "men's", 'mens', 'menswear', 'watch', 'watches', 'grooming', 'aftershave', 'shaver', 'beard', 'cufflink', 'edc'],
  WGW: ['women', "women's", 'womens', 'ladies', 'dress', 'dresses', 'lingerie', 'bra', 'beauty', 'makeup', 'make-up', 'cosmetic', 'perfume', 'fragrance', 'handbag', 'skincare', 'haircare', 'nail'],
  KGW: ['kids', 'kid', 'child', 'children', 'baby', 'babies', 'toy', 'toys', 'toddler', 'nursery', 'school', 'girls', 'boys', 'lego', 'pram', 'pushchair'],
  HGW: ['home', 'kitchen', 'furniture', 'bedding', 'bed', 'bath', 'bathroom', 'appliance', 'lighting', 'lamp', 'decor', 'cleaning', 'storage', 'sofa', 'mattress', 'cookware', 'pet', 'rug', 'curtain'],
  GGW: ['garden', 'lawn', 'mower', 'bbq', 'barbecue', 'outdoor', 'plant', 'plants', 'seed', 'hose', 'watering', 'shed', 'patio', 'greenhouse', 'compost', 'trimmer'],
  CGW: ['tool', 'tools', 'drill', 'saw', 'workwear', 'safety', 'ppe', 'construction', 'building', 'plumbing', 'electrical', 'hardware', 'fixings', 'screw', 'ladder', 'site', 'power tool', 'hand tool']
};

const COLS = {
  merchant: ['merchant_name'],
  name: ['product_name'],
  price: ['search_price', 'store_price', 'display_price', 'price'],
  currency: ['currency'],
  inStock: ['in_stock', 'is_for_sale', 'stock_status', 'stock_quantity'],
  gtin: ['ean', 'product_gtin', 'upc'],
  merchantCategory: ['merchant_category', 'merchant_product_category_path'],
  awinCategory: ['category_name'],
  updated: ['last_updated', 'data_feed_last_updated']
};

function mapHeader(header) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
  return Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, names.map(n => h.indexOf(n)).filter(i => i >= 0)]));
}
const pick = (rec, idxs) => {
  for (const i of idxs) { const v = rec[i]; if (v !== undefined && String(v).trim() !== '') return String(v).trim(); }
  return '';
};
function inStock(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === '') return null;
  if (/^\d+$/.test(s)) return Number(s) > 0;
  if (/^(yes|y|true|in stock|in_stock|instock|available|available to order|limited stock)$/.test(s)) return true;
  return false;
}
const top = (counts, n) => Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);

export function suggestSites(textCounts) {
  const score = Object.fromEntries(Object.keys(SITE_WORDS).map(s => [s, 0]));
  for (const [text, n] of Object.entries(textCounts)) {
    const words = ` ${String(text).toLowerCase().replace(/[^a-z0-9'&+-]+/g, ' ')} `;
    for (const [siteCode, list] of Object.entries(SITE_WORDS)) {
      if (list.some(w => words.includes(` ${w} `))) score[siteCode] += n;
    }
  }
  const ranked = Object.entries(score).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = Object.values(textCounts).reduce((a, b) => a + b, 0) || 1;
  return ranked.slice(0, 2).map(([s, v]) => ({ site: s, share: Math.round((v / total) * 100) }));
}

export async function inventory({ archive, maxRows = Infinity, now = Date.now(), log = () => {} }) {
  const files = readdirSync(archive).filter(f => /^AWIN_\d+_\d+\.csv(\.gz)?$/i.test(f)).sort();
  const feeds = [];
  let i = 0;
  for (const f of files) {
    i++;
    const [, adv, feedId] = f.match(/^AWIN_(\d+)_(\d+)/i);
    const full = join(archive, f);
    const st = statSync(full);
    const feed = { file: f, advertiserId: Number(adv), feedId: Number(feedId), bytes: st.size, ageDays: Math.floor((now - st.mtimeMs) / 86400000),
      merchant: '', rows: 0, inStock: 0, withGtin: 0, currencies: {}, cats: {}, samples: [], error: '' };
    try {
      const raw = createReadStream(full);
      const stream = /\.gz$/i.test(f) ? raw.pipe(createGunzip()) : raw;
      let map = null;
      for await (const rec of readCsvRecords(stream)) {
        if (!map) { map = mapHeader(rec); continue; }
        if (rec.length < 3) continue;
        feed.rows++;
        if (!feed.merchant) feed.merchant = pick(rec, map.merchant);
        if (inStock(pick(rec, map.inStock)) !== false) feed.inStock++;
        if (/^\d{8,14}$/.test(pick(rec, map.gtin))) feed.withGtin++;
        const cur = pick(rec, map.currency).toUpperCase() || '?';
        feed.currencies[cur] = (feed.currencies[cur] || 0) + 1;
        const cat = pick(rec, map.merchantCategory) || pick(rec, map.awinCategory) || '(no category)';
        feed.cats[cat] = (feed.cats[cat] || 0) + 1;
        if (feed.samples.length < 3 && feed.rows % 97 === 1) feed.samples.push(pick(rec, map.name).slice(0, 90));
        if (feed.rows >= maxRows) break;
      }
    } catch (e) {
      feed.error = String(e && e.message || e).slice(0, 200);
    }
    // Category texts plus product samples decide the site.
    const texts = { ...feed.cats };
    for (const s of feed.samples) texts[s] = (texts[s] || 0) + 1;
    feed.suggest = suggestSites(texts);
    feed.inUse = IN_USE[feed.advertiserId] || [];
    feeds.push(feed);
    log(`${i}/${files.length} ${f}: ${feed.rows} products`);
  }
  return feeds;
}

export function renderReport(feeds, { archive, generated = new Date() } = {}) {
  const fmt = n => new Intl.NumberFormat('en-GB').format(n);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
  const byAdv = new Map();
  for (const f of feeds) {
    const a = byAdv.get(f.advertiserId) || { advertiserId: f.advertiserId, merchant: '', feeds: 0, rows: 0, inStock: 0, gtin: 0, gbp: 0, ageDays: 9999, suggest: [], inUse: f.inUse, cats: {} };
    a.merchant = a.merchant || f.merchant;
    a.feeds++; a.rows += f.rows; a.inStock += f.inStock; a.gtin += f.withGtin; a.gbp += f.currencies.GBP || 0;
    a.ageDays = Math.min(a.ageDays, f.ageDays);
    for (const [c, n] of Object.entries(f.cats)) a.cats[c] = (a.cats[c] || 0) + n;
    byAdv.set(f.advertiserId, a);
  }
  for (const a of byAdv.values()) a.suggest = suggestSites(a.cats);
  const advs = [...byAdv.values()].sort((x, y) => y.rows - x.rows);
  const total = advs.reduce((t, a) => t + a.rows, 0);
  const unused = advs.filter(a => !a.inUse.length && a.rows > 0);
  const perSite = {};
  for (const a of unused) { const s = (a.suggest[0] || {}).site || '?'; (perSite[s] ||= []).push(a); }
  const L = [];
  L.push(`AWIN FEED INVENTORY (read-only) ${generated.toISOString().slice(0, 16).replace('T', ' ')}`);
  L.push(`Archive: ${archive}`);
  L.push(`Files: ${feeds.length} | Retailers: ${advs.length} | Products: ${fmt(total)} | Retailers not used by any site yet: ${unused.length} (${fmt(unused.reduce((t, a) => t + a.rows, 0))} products)`);
  const errors = feeds.filter(f => f.error);
  if (errors.length) L.push(`Files that could not be read: ${errors.length} (${errors.slice(0, 5).map(f => f.file).join(', ')})`);
  L.push('');
  L.push('== NOT USED YET, by the site they seem to fit (biggest first) ==');
  for (const site of Object.keys(SITE_WORDS).concat('?')) {
    const list = (perSite[site] || []).slice(0, 15);
    if (!list.length) continue;
    L.push(`-- ${site} (${(perSite[site] || []).length} retailers) --`);
    for (const a of list) {
      L.push(`  ${String(a.advertiserId).padEnd(7)} ${(a.merchant || '?').slice(0, 34).padEnd(34)} ${fmt(a.rows).padStart(9)}  in stock ${pct(a.inStock, a.rows).padStart(4)}  EAN ${pct(a.gtin, a.rows).padStart(4)}  GBP ${pct(a.gbp, a.rows).padStart(4)}  file ${a.ageDays}d old  ${a.suggest.map(s => `${s.site} ${s.share}%`).join(', ')}`);
    }
  }
  L.push('');
  L.push('== ALREADY USED ==');
  for (const a of advs.filter(x => x.inUse.length)) {
    L.push(`  ${String(a.advertiserId).padEnd(7)} ${(a.merchant || '?').slice(0, 34).padEnd(34)} ${fmt(a.rows).padStart(9)}  on ${a.inUse.join(', ')}  file ${a.ageDays}d old`);
  }
  L.push('');
  L.push('== TOP CATEGORIES OF THE 25 BIGGEST RETAILERS ==');
  for (const a of advs.slice(0, 25)) {
    L.push(`  ${a.advertiserId} ${a.merchant || '?'}: ${top(a.cats, 4).map(([c, n]) => `${c.slice(0, 50)} (${fmt(n)})`).join(' | ')}`);
  }
  L.push('');
  L.push('Note: "in stock" counts rows whose stock column is empty or says in stock. The site suggestion is a first sort by keywords; each site\'s import rules decide product by product.');
  return { text: L.join('\n') + '\n', advs };
}

function toCsv(advs) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['advertiser_id', 'merchant', 'feeds', 'products', 'in_stock', 'with_ean', 'gbp', 'newest_file_age_days', 'used_on', 'suggested_site', 'second_site']];
  for (const a of advs) rows.push([a.advertiserId, a.merchant, a.feeds, a.rows, a.inStock, a.gtin, a.gbp, a.ageDays, a.inUse.join(' '), (a.suggest[0] || {}).site || '', (a.suggest[1] || {}).site || '']);
  return rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = resolve(val('archive') || '');
  const out = resolve(val('out') || 'feed-inventory');
  if (!val('archive') || !existsSync(archive)) { console.error(`Archive folder not found: ${archive}`); process.exit(2); }
  mkdirSync(out, { recursive: true });
  const feeds = await inventory({ archive, maxRows: Number(val('max-rows')) || Infinity, log: m => process.stdout.write(`\r${m}`.padEnd(100)) });
  process.stdout.write('\n');
  const { text, advs } = renderReport(feeds, { archive });
  writeFileSync(join(out, 'report.txt'), text);
  writeFileSync(join(out, 'retailers.csv'), '﻿' + toCsv(advs));
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
