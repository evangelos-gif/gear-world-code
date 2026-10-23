#!/usr/bin/env node
// Awin feed sample. READ-ONLY. Shows what one retailer's feed really contains, so the import rules for a
// new retailer are written from real data: the columns, every category path with its count, currencies,
// stock values, gender/size/colour columns and a spread of sample products.
//
// Usage: node tools/awin-feed-sample.mjs --archive <dir> --advertiser <id>[,<id>...] --out <dir>
import { createReadStream, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';

const SHOW = ['product_name', 'brand_name', 'search_price', 'store_price', 'rrp_price', 'currency', 'in_stock', 'stock_status', 'stock_quantity',
  'merchant_category', 'category_name', 'merchant_product_category_path', 'ean', 'product_gtin', 'colour', 'size', 'fashion_size', 'fashion_suitable_for',
  'gender', 'age_group', 'delivery_cost', 'delivery_time', 'condition', 'merchant_deep_link', 'aw_deep_link', 'merchant_image_url', 'large_image'];

export async function sampleFeed({ archive, advertiserId, maxSamples = 40 }) {
  const files = readdirSync(archive).filter(f => new RegExp(`^AWIN_${advertiserId}_\\d+\\.csv(\\.gz)?$`, 'i').test(f)).sort();
  // examples: one product name per category path; brands: how many products each brand has (L14: rules from real data).
  const out = { files, header: [], rows: 0, cats: {}, examples: {}, brands: {}, values: {}, samples: [] };
  const valueCols = ['currency', 'in_stock', 'stock_status', 'fashion_suitable_for', 'gender', 'age_group', 'condition', 'category_name', 'delivery_cost'];
  let seen = 0;
  for (const f of files) {
    const raw = createReadStream(join(archive, f));
    const stream = /\.gz$/i.test(f) ? raw.pipe(createGunzip()) : raw;
    let h = null;
    for await (const rec of readCsvRecords(stream)) {
      if (!h) { h = rec.map(x => String(x).trim().toLowerCase().replace(/^﻿/, '')); if (!out.header.length) out.header = h; continue; }
      if (rec.length < 3) continue;
      out.rows++;
      const get = c => { const i = h.indexOf(c); return i >= 0 ? String(rec[i] ?? '').trim() : ''; };
      const cat = get('merchant_category') || get('merchant_product_category_path') || get('category_name') || '(no category)';
      out.cats[cat] = (out.cats[cat] || 0) + 1;
      if (!out.examples[cat]) out.examples[cat] = get('product_name').slice(0, 70);
      const brand = (get('brand_name') || '(no brand)').slice(0, 40);
      if (out.brands[brand] || Object.keys(out.brands).length < 5000) out.brands[brand] = (out.brands[brand] || 0) + 1;
      for (const c of valueCols) {
        if (h.indexOf(c) < 0) continue;
        const v = get(c).slice(0, 40) || '(empty)';
        const m = (out.values[c] ||= {});
        if (Object.keys(m).length < 60 || m[v]) m[v] = (m[v] || 0) + 1;
      }
      seen++;
      // A spread across the whole feed, not only the first rows.
      if (out.samples.length < maxSamples && (seen % 499 === 1 || out.samples.length < 5)) {
        out.samples.push(Object.fromEntries(SHOW.filter(c => h.includes(c)).map(c => [c, get(c).slice(0, 140)])));
      }
    }
  }
  return out;
}

export function renderSample(s, advertiserId, { maxCats = 150, maxSamples = 40 } = {}) {
  const fmt = n => new Intl.NumberFormat('en-GB').format(n);
  const L = [`AWIN FEED SAMPLE (read-only) advertiser ${advertiserId}`, `Files: ${s.files.join(', ') || 'none found'} | Products: ${fmt(s.rows)}`, ''];
  L.push('== COLUMNS ==', s.header.join(', '), '');
  L.push(`== CATEGORY PATHS (${Object.keys(s.cats).length}, biggest first, up to ${maxCats}; e.g. = one product of that path) ==`);
  for (const [c, n] of Object.entries(s.cats).sort((a, b) => b[1] - a[1]).slice(0, maxCats)) {
    const e = s.examples && s.examples[c] ? `  e.g. ${s.examples[c]}` : '';
    L.push(`  ${fmt(n).padStart(7)}  ${c.slice(0, 120)}${e}`);
  }
  L.push('');
  const brands = Object.entries(s.brands || {}).sort((a, b) => b[1] - a[1]);
  if (brands.length) {
    L.push(`== BRANDS (${fmt(brands.length)}, biggest first, up to 60) ==`);
    L.push('  ' + brands.slice(0, 60).map(([b, n]) => `${b} (${fmt(n)})`).join(' | '), '');
  }
  for (const [c, m] of Object.entries(s.values)) {
    L.push(`== VALUES OF ${c} ==`);
    L.push('  ' + Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([v, n]) => `${v} (${fmt(n)})`).join(' | '));
  }
  const shown = s.samples.slice(0, maxSamples);
  L.push('', `== ${shown.length} SAMPLE PRODUCTS (spread across the feed) ==`);
  for (const p of shown) {
    L.push('  - ' + Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' ; '));
  }
  return L.join('\n') + '\n';
}

// Several retailers in one report (--advertiser 69306,116097): shorter lists per retailer, so the whole report
// still fits in one paste.
export async function sampleMany({ archive, advertiserIds }) {
  const many = advertiserIds.length > 1;
  const parts = [];
  for (const id of advertiserIds) {
    const s = await sampleFeed({ archive, advertiserId: id });
    const text = renderSample(s, id, many ? { maxCats: 100, maxSamples: 20 } : {});
    parts.push(many ? `##### ADVERTISER ${id}\n${text}` : text);
  }
  return parts.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = resolve(val('archive') || '');
  const ids = String(val('advertiser') || '').split(',').map(x => x.replace(/\D/g, '')).filter(Boolean);
  const out = resolve(val('out') || 'feed-sample');
  if (!existsSync(archive) || !ids.length) { console.error('Usage: --archive <dir> --advertiser <id>[,<id>...] --out <dir>'); process.exit(2); }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'report.txt'), await sampleMany({ archive, advertiserIds: [...new Set(ids)] }));
  console.log(`Report: ${join(out, 'report.txt')}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
