// Prices of the direct stores of Mega Stores Gear World (owner and Linkwise, 24 Nov 2026, lessons L227).
//
//   node tools/ogw-prices.mjs --archive <GW_AWIN_BULK_ARCHIVE> --out <file> [--config <site.config.js>] [--now <ISO>]
//
// Reads, for each direct store of sites/ogw/site.config.js (the 5 big Greek stores of Linkwise), the store's own
// Linkwise product feed that chat 3 downloads (LINKWISE_<programme>.csv.gz, Awin column names, tools/linkwise-feed.mjs)
// and finds the price of each product of its sets and gift ideas: by the product's page (merchant_deep_link), else its
// photo, else its exact name (only when one product has it). When several rows share the page (sizes, shades), the one
// with the product's own photo; if they still differ in price or stock, no price (review 24/11/2026). Only euros, only a
// product not marked out of stock, only a feed read in the last 23 hours (the time of the file: the price then has at
// least an hour on the page before the Worker hides it at 24 hours). The result is the Worker secret LINKWISE_PRICES:
//   base64 of {"v":1,"s":{"<programme>":{"t":"<time of the feed>","p":{"<priceKey(page)>":<euros>}}}}
// written to --out whenever at least one feed was read fresh, even with no price in it (then the Worker drops the
// prices it had, which that newer feed no longer gives); with no fresh feed at all nothing is written and the Worker
// keeps what it has, which hides itself at 24 hours. Never more than MAX_SECRET characters (a Worker secret is small).
// tools/ogw-site.ps1 adds the file to the deploy and deletes it.
// The config is read as text (no import), so this runs with any Node.js the deploy runs with; a test checks that it
// finds exactly the products of the config. It writes nothing else and never to stderr (Windows PowerShell 5.1 would
// stop on it): one line per store on stdout, in ASCII:
//   PRICES <slug> <programme> <OK|NONE|OLD|MISSING|SKIP|ERROR> <prices> <products> <out of stock> <feed time ISO or -> <unclear>
//   PRICES-DONE <stores with prices> <prices> <SEND|KEEP|TOOBIG>
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readCsvRecords } from './tgw-import-plan.mjs';
import { PRICE_MAX_AGE_MS, pageKey, priceKey } from '../src/lib/price-key.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// A feed must be read at most this long ago: an hour less than the Worker's 24 hours.
export const FEED_MAX_AGE_MS = PRICE_MAX_AGE_MS - 3600 * 1000;
export const MAX_SECRET = 4800;
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

const add = (m, k, row) => { if (!k) return; const list = m.get(k); if (list) list.push(row); else m.set(k, [row]); };
// One feed file -> the price of each pick (by the key of its page), how many were out of stock and how many unclear.
export async function pricesFromFeed(stream, picks) {
  const want = new Set(picks.map(p => pageKey(p.url)));
  const wantImage = new Set(picks.map(p => imageKey(p.image)).filter(Boolean));
  const wantName = new Set(picks.map(p => nameKey(p.name)).filter(Boolean));
  const byUrl = new Map(), byImage = new Map(), byName = new Map();
  let header = null;
  for await (const rec of readCsvRecords(stream)) {
    if (!header) { header = rec.map(h => String(h).trim().toLowerCase().replace(/^\uFEFF/, '')); continue; }
    const get = n => { const i = header.indexOf(n); return i >= 0 ? String(rec[i] ?? '') : ''; };
    const row = { url: get('merchant_deep_link'), image: get('merchant_image_url') || get('large_image'), name: get('product_name'),
      price: euro(get('search_price')), currency: get('currency').trim().toUpperCase(), stock: get('in_stock').trim() };
    const u = pageKey(row.url);
    if (want.has(u)) add(byUrl, u, row);
    const im = imageKey(row.image);
    if (wantImage.has(im)) add(byImage, im, row);
    const n = nameKey(row.name);
    if (wantName.has(n)) add(byName, n, row);
  }
  const prices = {};
  let out = 0, unclear = 0;
  for (const p of picks) {
    // The rows of its page; several (sizes, shades): those with its own photo, if any. Else its photo; else its name,
    // only when one row has it.
    let rows = byUrl.get(pageKey(p.url)) || [];
    if (rows.length > 1) { const own = rows.filter(r => imageKey(r.image) && imageKey(r.image) === imageKey(p.image)); if (own.length) rows = own; }
    if (!rows.length) rows = byImage.get(imageKey(p.image)) || [];
    if (!rows.length) { const named = byName.get(nameKey(p.name)) || []; if (named.length === 1) rows = named; }
    if (!rows.length) continue;
    const gone = rows.filter(r => r.stock === '0').length;
    if (gone === rows.length) { out++; continue; }
    const amounts = new Set(rows.map(r => (r.currency === 'EUR' && r.price ? r.price : 0)));
    // Rows that differ in stock or price, or one not in euros: we cannot tell which one is this product.
    if (gone || amounts.size !== 1 || amounts.has(0)) { unclear++; continue; }
    prices[priceKey(p.url)] = [...amounts][0];
  }
  return { prices, out, unclear };
}
// A gz file as a stream whose read errors reach the reader (a locked or broken file is one store's error, not a crash).
function gunzipFile(file) {
  const gz = createGunzip();
  pipeline(createReadStream(file), gz, () => {});
  return gz;
}

export async function buildPrices({ archive, config, now = Date.now() }) {
  const stores = directStoresFromConfig(readFileSync(config, 'utf8'));
  const lines = [];
  const data = { v: 1, s: {} };
  let shown = 0, total = 0, fresh = 0;
  for (const s of stores) {
    const file = join(archive, `LINKWISE_${s.program}.csv.gz`);
    const line = (state, n = 0, out = 0, t = '-', unclear = 0) => lines.push(`PRICES ${s.slug} ${s.program} ${state} ${n} ${s.picks.length} ${out} ${t} ${unclear}`);
    if (!s.picks.length) { line('SKIP'); continue; }
    if (!archive || !existsSync(file)) { line('MISSING'); continue; }
    let t = 0;
    try { t = Math.min(statSync(file).mtimeMs, now); } catch { line('ERROR'); continue; }
    const iso = new Date(t).toISOString();
    if (now - t > FEED_MAX_AGE_MS) { line('OLD', 0, 0, iso); continue; }
    let r;
    try { r = await pricesFromFeed(gunzipFile(file), s.picks); } catch { line('ERROR', 0, 0, iso); continue; }
    fresh++;
    const n = Object.keys(r.prices).length;
    if (!n) { line('NONE', 0, r.out, iso, r.unclear); continue; }
    data.s[String(s.program)] = { t: iso, p: r.prices };
    shown++; total += n;
    line('OK', n, r.out, iso, r.unclear);
  }
  let value = fresh ? Buffer.from(JSON.stringify(data), 'utf8').toString('base64') : '';
  let how = value ? 'SEND' : 'KEEP';
  if (value.length > MAX_SECRET) { value = ''; how = 'TOOBIG'; }
  lines.push(`PRICES-DONE ${shown} ${total} ${how}`);
  return { lines, value };
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
