// Prices of the direct stores of Mega Stores Gear World (owner and Linkwise, 24 Nov 2026, lessons L227).
//
//   node tools/ogw-prices.mjs --archive <GW_AWIN_BULK_ARCHIVE> --out <file> [--config <site.config.js>] [--now <ISO>]
//
// Reads, for each direct store of sites/ogw/site.config.js (the 5 big Greek stores of Linkwise), the store's own
// Linkwise product feed that chat 3 downloads (LINKWISE_<programme>.csv.gz, Awin column names, tools/linkwise-feed.mjs)
// and finds the price of each product of its sets and gift ideas: by the product's page (merchant_deep_link), else its
// photo, else its exact name (only when one product has it). Only euros, only a product not marked out of stock, only a
// feed read in the last 24 hours (the time of the file). The result is the Worker secret LINKWISE_PRICES:
//   base64 of {"v":1,"s":{"<programme>":{"t":"<time of the feed>","p":{"<priceKey(page)>":<euros>}}}}
// written to --out only when there is at least one price (tools/ogw-site.ps1 adds it to the deploy and deletes it).
// The config is read as text (no import), so this runs with any Node.js the deploy runs with; a test checks that it
// finds exactly the products of the config. It writes nothing else and never to stderr (Windows PowerShell 5.1 would
// stop on it): one line per store on stdout, in ASCII:
//   PRICES <slug> <programme> <OK|NONE|OLD|MISSING|SKIP> <prices> <products> <out of stock> <feed time ISO or ->
//   PRICES-DONE <stores with prices> <prices>
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';
import { PRICE_MAX_AGE_MS, pageKey, priceKey } from '../src/lib/price-key.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const unq = s => s.replace(/\\(.)/g, '$1');
const STR = "'((?:[^'\\\\]|\\\\.)*)'";

// The direct stores of the config and their products: [{ slug, program, hosts, picks: [{ name, image, url }] }].
export function directStoresFromConfig(text) {
  const stores = [];
  const re = new RegExp(`slug:\\s*${STR}[^{}]*?direct:\\s*\\{\\s*program:\\s*(\\d+),\\s*hosts:\\s*\\[([^\\]]*)\\]`, 'g');
  for (const m of text.matchAll(re)) {
    const hosts = [...m[3].matchAll(new RegExp(STR, 'g'))].map(h => unq(h[1]).toLowerCase());
    stores.push({ slug: unq(m[1]), program: Number(m[2]), hosts, picks: [] });
  }
  const item = new RegExp(`\\{\\s*name:\\s*${STR},\\s*image:\\s*${STR},\\s*url:\\s*${STR}\\s*\\}`, 'g');
  for (const m of text.matchAll(item)) {
    const url = unq(m[3]);
    let host = '';
    try { host = new URL(url).hostname.toLowerCase(); } catch { continue; }
    const store = stores.find(s => s.hosts.includes(host));
    if (store && !store.picks.some(p => p.url === url)) store.picks.push({ name: unq(m[1]), image: unq(m[2]), url });
  }
  return stores;
}

const nameKey = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const imageKey = s => { try { const u = new URL(String(s || '').trim()); return `${u.hostname.toLowerCase()}${u.pathname}`; } catch { return ''; } };
const euro = v => { const n = Number(String(v || '').trim()); return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : 0; };

// One feed file -> the price of each pick (by the key of its page), and how many were out of stock.
export async function pricesFromFeed(stream, picks) {
  const want = new Map(picks.map(p => [pageKey(p.url), p]));
  const wantImage = new Map(picks.map(p => [imageKey(p.image), p]).filter(([k]) => k));
  const byUrl = new Map(), byImage = new Map(), byName = new Map();
  let header = null;
  for await (const rec of readCsvRecords(stream)) {
    if (!header) { header = rec.map(h => String(h).trim().toLowerCase().replace(/^﻿/, '')); continue; }
    const get = n => { const i = header.indexOf(n); return i >= 0 ? String(rec[i] ?? '') : ''; };
    const row = { url: get('merchant_deep_link'), image: get('merchant_image_url') || get('large_image'), name: get('product_name'),
      price: euro(get('search_price')), currency: get('currency').trim().toUpperCase(), stock: get('in_stock').trim() };
    const u = pageKey(row.url);
    if (u && want.has(u) && !byUrl.has(u)) byUrl.set(u, row);
    const im = imageKey(row.image);
    if (im && wantImage.has(im) && !byImage.has(im)) byImage.set(im, row);
    const n = nameKey(row.name);
    if (n && picks.some(p => nameKey(p.name) === n)) byName.set(n, byName.has(n) ? null : row);
  }
  const prices = {};
  let out = 0;
  for (const p of picks) {
    const row = byUrl.get(pageKey(p.url)) || byImage.get(imageKey(p.image)) || byName.get(nameKey(p.name)) || null;
    if (!row) continue;
    if (row.stock === '0') { out++; continue; }
    if (row.currency !== 'EUR' || !row.price) continue;
    prices[priceKey(p.url)] = row.price;
  }
  return { prices, out };
}

export async function buildPrices({ archive, config, now = Date.now() }) {
  const stores = directStoresFromConfig(readFileSync(config, 'utf8'));
  const lines = [];
  const data = { v: 1, s: {} };
  let shown = 0, total = 0;
  for (const s of stores) {
    const file = join(archive, `LINKWISE_${s.program}.csv.gz`);
    const line = (state, n = 0, out = 0, t = '-') => lines.push(`PRICES ${s.slug} ${s.program} ${state} ${n} ${s.picks.length} ${out} ${t}`);
    if (!s.picks.length) { line('SKIP'); continue; }
    if (!archive || !existsSync(file)) { line('MISSING'); continue; }
    const t = Math.min(statSync(file).mtimeMs, now);
    const iso = new Date(t).toISOString();
    if (now - t > PRICE_MAX_AGE_MS) { line('OLD', 0, 0, iso); continue; }
    const { prices, out } = await pricesFromFeed(createReadStream(file).pipe(createGunzip()), s.picks);
    const n = Object.keys(prices).length;
    if (!n) { line('NONE', 0, out, iso); continue; }
    data.s[String(s.program)] = { t: iso, p: prices };
    shown++; total += n;
    line('OK', n, out, iso);
  }
  lines.push(`PRICES-DONE ${shown} ${total}`);
  return { lines, value: shown ? Buffer.from(JSON.stringify(data), 'utf8').toString('base64') : '' };
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
    if (!a.out || !Number.isFinite(now)) { console.log('PRICES-ERROR usage: --archive <folder> --out <file> [--config <file>] [--now <ISO>]'); process.exit(2); }
    const { lines, value } = await buildPrices({ archive: a.archive || '', config: a.config || join(HERE, '..', 'sites', 'ogw', 'site.config.js'), now });
    if (value) writeFileSync(a.out, value, 'ascii');
    for (const l of lines) console.log(ascii(l));
  } catch (e) {
    console.log(`PRICES-ERROR ${ascii(e && e.message ? e.message : e)}`);
  }
}
