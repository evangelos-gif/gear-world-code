#!/usr/bin/env node
// Gear World - feed PEEK. READ-ONLY.
//
// Reads Awin feed files (AWIN_<advertiserId>_<feedId>.csv.gz) for the advertiser ids you give it, from the
// local Awin archive, and writes ONE report: rows, columns found, currencies, price range, stock, top
// categories and brands, and sample products. It does not change the archive, does not write SQL and does
// not contact Cloudflare, D1 or Awin. Use it before planning an import, to see what a new retailer's feed holds.
//
// Usage: node tools/gw-feed-peek.mjs --archive <dir> --ids 83599,91665 --out <dir>
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords, cleanText, parsePrice } from './tgw-import-plan.mjs';

const VERSION = 'gw-feed-peek v2';
const SAMPLES = 12;
const TOP = 15;

// Awin column names first, then Google Shopping feed names (some advertisers, e.g. GS Workwear, give that format).
const COLUMNS = {
  name: ['product_name', 'title'],
  brand: ['brand_name', 'brand'],
  price: ['search_price', 'store_price', 'display_price', 'sale_price', 'price'],
  currency: ['currency'],
  inStock: ['in_stock', 'is_for_sale', 'stock_status', 'stock_quantity', 'availability'],
  image: ['merchant_image_url', 'large_image', 'aw_image_url', 'alternate_image', 'image_link'],
  link: ['aw_deep_link', 'link'],
  merchantCategory: ['merchant_category', 'merchant_product_category_path', 'product_type'],
  awinCategory: ['category_name', 'google_product_category'],
  gtin: ['ean', 'product_gtin', 'upc', 'gtin']
};

function mapHeader(header) {
  const h = header.map(x => String(x).trim().toLowerCase().replace(/^﻿/, ''));
  const map = {};
  for (const [k, names] of Object.entries(COLUMNS)) map[k] = names.map(n => h.indexOf(n)).filter(i => i >= 0);
  return map;
}
const pick = (rec, idxs) => {
  for (const i of idxs) { const v = rec[i]; if (v !== undefined && String(v).trim() !== '') return String(v).trim(); }
  return '';
};
const bump = (o, k) => { if (k) o[k] = (o[k] || 0) + 1; };
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function stockState(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === '') return 'unknown';
  if (/^\d+$/.test(s)) return Number(s) > 0 ? 'in' : 'out';
  if (/^(yes|y|true|1|in stock|in_stock|instock|available|available to order|limited stock|backorder|preorder)$/.test(s)) return 'in';
  if (/^(no|n|false|0|out of stock|out_of_stock|outofstock|discontinued)$/.test(s)) return 'out';
  return 'unknown';
}

export async function peekFeeds({ archive, ids, outDir, extraFiles = [], now = new Date() }) {
  const files = existsSync(archive) ? readdirSync(archive) : [];
  const L = [];
  L.push(`=== Gear World feed peek (${VERSION}) - READ-ONLY ===`);
  L.push(`Run: ${now.toISOString().replace('T', ' ').slice(0, 19)} UTC`);
  L.push(`Archive: ${archive}`);
  L.push(`Advertiser ids: ${ids.join(', ') || '-'}`);
  if (extraFiles.length) L.push(`Extra files: ${extraFiles.map(f => basename(f)).join(', ')}`);
  L.push('Nothing was changed. No SQL was written. Nothing was sent to Cloudflare, D1 or Awin.');
  const summary = [];

  const groups = ids.map(id => ({
    title: `Advertiser ${id}`, id,
    paths: files.filter(f => new RegExp(`^AWIN_${id}_\\d+\\.csv\\.gz$`, 'i').test(f)).sort().map(f => join(archive, f))
  }));
  for (const x of extraFiles) groups.push({ title: `File ${basename(x)}`, id: basename(x), paths: existsSync(x) ? [x] : [] });
  for (const g of groups) {
    L.push('');
    L.push(`################ ${g.title} ################`);
    if (!g.paths.length) {
      L.push('No feed file found.');
      summary.push(`${g.id}: no feed file`);
      continue;
    }
    for (const full of g.paths) {
      const f = basename(full);
      const bytes = statSync(full).size;
      L.push('');
      L.push(`--- ${f} (${bytes} bytes) ---`);
      let header = null, map = null, rows = 0, error = '';
      const st = { linkHost: {}, currency: {}, stock: {}, mcat: {}, acat: {}, brand: {}, noImage: 0, noLink: 0, noPrice: 0, gtin: 0 };
      let min = Infinity, max = -Infinity;
      const samples = [];
      try {
        const raw = createReadStream(full);
        const stream = /\.gz$/i.test(full) ? raw.pipe(createGunzip()) : raw;
        for await (const rec of readCsvRecords(stream)) {
          if (!header) { header = rec; map = mapHeader(rec); continue; }
          if (rec.length === 1 && rec[0] === '') continue;
          rows++;
          const name = cleanText(pick(rec, map.name));
          const price = parsePrice(pick(rec, map.price));
          const brand = cleanText(pick(rec, map.brand));
          const mcat = cleanText(pick(rec, map.merchantCategory));
          const priceText = pick(rec, map.price);
          const curInPrice = (priceText.match(/\b([A-Z]{3})\b/) || [])[1] || (/£/.test(priceText) ? 'GBP' : /€/.test(priceText) ? 'EUR' : '');
          bump(st.currency, pick(rec, map.currency).toUpperCase() || curInPrice || 'unknown');
          let host = '';
          try { host = new URL(pick(rec, map.link)).hostname.toLowerCase(); } catch { host = ''; }
          bump(st.linkHost, host || '(none)');
          bump(st.stock, stockState(pick(rec, map.inStock)));
          bump(st.mcat, cut(mcat || '(none)', 70));
          bump(st.acat, cut(cleanText(pick(rec, map.awinCategory)) || '(none)', 50));
          bump(st.brand, cut(brand || '(none)', 40));
          if (!/^https:\/\//i.test(pick(rec, map.image))) st.noImage++;
          if (!pick(rec, map.link)) st.noLink++;
          if (Number.isFinite(price) && price > 0) { if (price < min) min = price; if (price > max) max = price; } else st.noPrice++;
          if (pick(rec, map.gtin)) st.gtin++;
          if (samples.length < SAMPLES && name) samples.push(`${cut(name, 80)} | ${Number.isFinite(price) ? price.toFixed(2) : '?'} | ${cut(brand, 25)} | ${cut(mcat, 45)}`);
        }
      } catch (e) {
        error = String(e && e.message ? e.message : e);
      }
      if (error) { L.push(`Could not read this file: ${error}`); summary.push(`${f}: unreadable`); continue; }
      if (!header) { L.push('The file is empty (no header row).'); summary.push(`${f}: empty file`); continue; }
      const missing = ['name', 'price', 'link', 'image'].filter(k => !map[k].length);
      L.push(`Columns: ${header.length}${missing.length ? ' | MISSING: ' + missing.join(', ') : ''}`);
      L.push(`Products (rows): ${rows}`);
      if (!rows) { summary.push(`${f}: header only, 0 products`); continue; }
      L.push(`Price range: ${Number.isFinite(min) ? min.toFixed(2) : '-'} to ${Number.isFinite(max) ? max.toFixed(2) : '-'} | no price: ${st.noPrice}`);
      L.push(`Currency: ${top(st.currency, 5).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      L.push(`Stock: ${top(st.stock, 5).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      L.push(`No https image: ${st.noImage} | no link: ${st.noLink} | with EAN/GTIN: ${st.gtin}`);
      L.push(`Link hosts: ${top(st.linkHost, 5).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      L.push(`Columns found: name=${header[map.name[0]] || '-'} price=${header[map.price[0]] || '-'} link=${header[map.link[0]] || '-'} category=${header[map.merchantCategory[0]] || '-'}`);
      L.push(`Top merchant categories:`);
      for (const [k, v] of top(st.mcat, TOP)) L.push(`   ${String(v).padStart(6)}  ${k}`);
      L.push(`Top Awin categories:`);
      for (const [k, v] of top(st.acat, 10)) L.push(`   ${String(v).padStart(6)}  ${k}`);
      L.push(`Top brands:`);
      for (const [k, v] of top(st.brand, 10)) L.push(`   ${String(v).padStart(6)}  ${k}`);
      L.push(`Samples (name | price | brand | merchant category):`);
      for (const s of samples) L.push(`   ${s}`);
      summary.push(`${f}: ${rows} products, ${Object.keys(st.mcat).length} categories`);
    }
  }
  L.push('');
  L.push('== Summary ==');
  for (const s of summary) L.push(`   ${s}`);
  L.push('=== END ===');
  const report = L.join('\r\n');
  writeFileSync(join(outDir, 'report.txt'), '﻿' + report);
  return { report, summary };
}

// ---------- CLI ----------
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = val('archive');
  const outDir = val('out');
  const ids = String(val('ids') || '').split(/[\s,;]+/).filter(Boolean);
  const extraFiles = args.flatMap((a, i) => (a === '--file' && args[i + 1] ? [args[i + 1]] : []));
  if (!archive || !outDir || (!ids.length && !extraFiles.length) || ids.some(i => !/^\d{1,9}$/.test(i))) {
    console.error('usage: node tools/gw-feed-peek.mjs --archive <dir> --ids 83599,91665 [--file <feed.csv.gz>] --out <dir>');
    process.exit(2);
  }
  if (existsSync(join(outDir, 'report.txt'))) {
    console.error(`Output folder already has a report: ${outDir}. Use a new folder.`);
    process.exit(2);
  }
  mkdirSync(outDir, { recursive: true });
  const { summary } = await peekFeeds({ archive, ids, outDir, extraFiles });
  for (const s of summary) console.log(s);
  console.log(`report: ${join(outDir, 'report.txt')}`);
}
