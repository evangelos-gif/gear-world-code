// Rakuten Advertising product catalogues (13 Nov 2026, lessons L128). Rakuten accepted Gear World for Cotton On UK,
// Isabel Marant, Currex, Seagate, Tushbaby ... Its catalogues are files on Rakuten's FTP/SFTP server for publishers
// (an account that Rakuten's support creates on request), one per advertiser: <MID>_<SID>_mp.txt.gz (pipe-delimited) or
// <MID>_<SID>_mp.xml.gz, with a header (HDR|MID|advertiser|time), one record per product and a trailer with the product
// count (TRL|n). Field order of a product record (Rakuten's Product Catalog Appendix A): product id, name, SKU, primary
// category, secondary categories (~~), product URL (the Rakuten tracking link), image URL, buy URL, short and long
// description, discount, discount type, sale price, retail price, begin and end date, brand, shipping, keywords (~~),
// manufacturer part number, manufacturer, shipping information, availability, UPC/EAN, class id, currency, M1, pixel.
// tools/rakuten-feed-download.ps1 fetches the file; this turns it into RAKUTEN_<MID>.csv.gz with the Awin column names
// and the Rakuten tracking link in aw_deep_link, so tools/legacy-import.ps1 imports it like a CJ shop (lessons L86).
// Command line:
//   node tools/rakuten-feed.mjs --mode sample --in <file.gz> [--partial]   (read-only: header, first records, links)
//   node tools/rakuten-feed.mjs --mode convert --in <file.gz> --out <RAKUTEN_<mid>.csv.gz.part>
import { readFileSync, createReadStream, createWriteStream, openSync, readSync, closeSync, rmSync } from 'node:fs';
import { gunzipSync, createGunzip, createGzip, constants } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { FEED_COLUMNS, csvLine, isRakutenLink, pageInLink } from './network-links.mjs';

export const FIELDS = ['product_id', 'name', 'sku', 'primary_category', 'secondary_category', 'product_url', 'image_url', 'buy_url',
  'short_description', 'long_description', 'discount', 'discount_type', 'sale_price', 'retail_price', 'begin_date', 'end_date', 'brand',
  'shipping', 'keywords', 'part_number', 'manufacturer', 'shipping_info', 'availability', 'upc', 'class_id', 'currency', 'm1', 'pixel'];

// One pipe-delimited line; a value with a pipe in it is in double quotes.
export function splitPipe(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"' && cur === '') q = true;
    else if (ch === '|') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parsePipe(text, { limit = Infinity } = {}) {
  const R = { format: 'txt', header: null, records: [], trailer: null, bad: 0 };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, '');
    if (!line.trim()) continue;
    if (line.startsWith('HDR|')) { const h = splitPipe(line); R.header = { mid: h[1] || '', name: h[2] || '', created: h[3] || '' }; continue; }
    if (line.startsWith('TRL|')) { R.trailer = Number(splitPipe(line)[1]); continue; }
    if (R.records.length >= limit) continue;
    const rec = pipeRecord(line);
    if (!rec) { R.bad++; continue; }
    R.records.push(rec);
  }
  return R;
}
// One pipe-delimited product line, or null when it has too few fields.
function pipeRecord(line) {
  const v = splitPipe(line);
  if (v.length < 26) return null;
  const rec = {};
  FIELDS.forEach((f, i) => { rec[f] = (v[i] ?? '').trim(); });
  return rec;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const xmlText = s => String(s ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()]).trim();
const tag = (body, path) => {
  let s = body;
  for (const t of path.split('/')) { const m = new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i').exec(s); if (!m) return ''; s = m[1]; }
  return xmlText(s);
};
const attr = (s, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(s); return m ? xmlText(m[1]) : ''; };

export function parseXml(text, { limit = Infinity } = {}) {
  const R = { format: 'xml', header: null, records: [], trailer: null, bad: 0 };
  const h = /<header>([\s\S]*?)<\/header>/i.exec(text);
  if (h) R.header = { mid: tag(h[1], 'merchantId'), name: tag(h[1], 'merchantName'), created: tag(h[1], 'createdOn') };
  const t = /<trailer>[\s\S]*?<numberOfProducts>\s*(\d+)\s*<\/numberOfProducts>/i.exec(text);
  if (t) R.trailer = Number(t[1]);
  // A record is <product product_id="..." ...> ... </product>; its link is in <URL><product>...</product></URL>, so a record
  // ends only at a </product> followed by the next record, the trailer or the end.
  const re = /<product(\s[^>]*product_id=[^>]*)>([\s\S]*?)<\/product>\s*(?=<product\s[^>]*product_id=|<trailer|<\/merchandiser|$)/gi;
  let m;
  while ((m = re.exec(text)) && R.records.length < limit) {
    R.records.push(xmlRecord(m[1] || '', m[2]));
  }
  return R;
}
// One XML product: the attributes of its <product ...> tag and what is inside it.
function xmlRecord(a, b) {
  const priceTag = /<price(\s[^>]*)?>/i.exec(b);
  return {
    product_id: attr(a, 'product_id'), name: attr(a, 'name'), sku: attr(a, 'sku_number'), part_number: attr(a, 'part_number'), manufacturer: attr(a, 'manufacturer_name'),
    primary_category: tag(b, 'category/primary'), secondary_category: tag(b, 'category/secondary'), product_url: tag(b, 'URL/product'),
    image_url: tag(b, 'URL/productImage'), buy_url: tag(b, 'URL/buy'), short_description: tag(b, 'description/short'), long_description: tag(b, 'description/long'),
    sale_price: tag(b, 'price/sale'), retail_price: tag(b, 'price/retail'), brand: tag(b, 'brand'), availability: tag(b, 'shipping/availability'),
    keywords: tag(b, 'keywords'), upc: tag(b, 'upc'), currency: (priceTag && attr(priceTag[1] || '', 'currency')) || ''
  };
}

export function parseCatalog(text, opts) {
  return /^\s*(<\?xml|<merchandiser|<header)/i.test(text.slice(0, 500)) ? parseXml(text, opts) : parsePipe(text, opts);
}

// The file's text, also from a file cut short on purpose (the read-only sample reads only the first part of it).
export function readGz(file, { partial = false } = {}) {
  const buf = readFileSync(file);
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf.toString('utf8');
  return gunzipSync(buf, partial ? { finishFlush: constants.Z_SYNC_FLUSH } : {}).toString('utf8');
}

const num = v => { const n = Number(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : NaN; };

// One Rakuten product as one feed row (Awin column names). The sale price wins when it is lower than the retail price.
export function toFeedRow(r, { mid = '', name = '' } = {}) {
  const retail = num(r.retail_price);
  const sale = num(r.sale_price);
  const price = Number.isFinite(sale) && sale > 0 && (!Number.isFinite(retail) || retail <= 0 || sale < retail) ? sale : retail;
  const av = String(r.availability || '').trim().toLowerCase();
  const inStock = /^(in-?stock|in stock|preorder|pre-order|backorder)$/.test(av) ? '1' : /out-?of-?stock|out of stock|discontinued/.test(av) ? '0' : '';
  const link = String(r.product_url || '');
  const page = pageInLink(link) || pageInLink(r.buy_url) || (isRakutenLink(link) ? '' : link);
  const cat = [r.primary_category, ...String(r.secondary_category || '').split('~~')].map(x => String(x || '').trim()).filter(Boolean)
    .filter((x, i, a) => a.indexOf(x) === i).join(' > ');
  const upc = String(r.upc || '').replace(/\D/g, '');
  return {
    data_feed_id: 'rakuten', merchant_id: String(mid), merchant_name: String(name), aw_product_id: String(r.product_id || ''),
    aw_deep_link: isRakutenLink(link) ? link : '', brand_name: String(r.brand || r.manufacturer || ''), merchant_product_id: String(r.sku || r.product_id || ''),
    merchant_category: cat, category_name: String(r.primary_category || ''), ean: upc, mpn: String(r.part_number || ''),
    product_name: String(r.name || ''), description: String(r.short_description || r.long_description || '').slice(0, 2000), merchant_deep_link: page,
    merchant_image_url: String(r.image_url || ''), large_image: '',
    search_price: Number.isFinite(price) ? String(price) : '', store_price: Number.isFinite(retail) ? String(retail) : '', rrp_price: Number.isFinite(retail) ? String(retail) : '',
    currency: String(r.currency || 'USD').toUpperCase(), in_stock: inStock, stock_status: av, parent_product_id: '', last_updated: ''
  };
}

export function sample(text) {
  const R = parseCatalog(text, { limit: 5 });
  const rows = R.records.map(r => toFeedRow(r, { mid: R.header && R.header.mid, name: R.header && R.header.name }));
  return {
    ok: R.records.length > 0, format: R.format, header: R.header, bad: R.bad, trailer: R.trailer,
    first: R.records.slice(0, 2).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v).slice(0, 120)]))),
    rows: rows.slice(0, 3).map(x => ({ name: x.product_name, price: x.search_price, currency: x.currency, stock: x.in_stock || x.stock_status, category: x.merchant_category,
      image: /^https:\/\//.test(x.merchant_image_url) ? 'yes' : (x.merchant_image_url ? 'not https' : 'no'), page: x.merchant_deep_link,
      tracking: x.aw_deep_link ? new URL(x.aw_deep_link).host : 'NONE' })),
    withTracking: rows.filter(x => x.aw_deep_link).length, of: rows.length
  };
}

export async function convert(text, outFile) {
  const R = parseCatalog(text);
  const mid = (R.header && R.header.mid) || '';
  const name = (R.header && R.header.name) || '';
  const rows = R.records.map(r => toFeedRow(r, { mid, name }));
  const S = { ok: false, format: R.format, mid, name, rows: rows.length, trailer: R.trailer, bad: R.bad,
    withTracking: rows.filter(x => x.aw_deep_link).length, currencies: [...new Set(rows.map(x => x.currency).filter(Boolean))] };
  // The trailer says how many products the file has: a file cut short is not used (Rakuten's own advice).
  if (R.trailer === null || R.trailer === undefined || !Number.isFinite(R.trailer)) { S.error = 'no trailer (file cut short?)'; return S; }
  if (R.trailer !== R.records.length + R.bad) { S.error = `trailer says ${R.trailer} products, read ${R.records.length + R.bad}`; return S; }
  if (!rows.length) { S.error = 'no products'; return S; }
  await new Promise((resolve, reject) => {
    const gz = createGzip();
    const ws = createWriteStream(outFile);
    gz.pipe(ws);
    ws.on('finish', resolve);
    ws.on('error', reject);
    gz.write(csvLine(FEED_COLUMNS));
    for (const row of rows) gz.write(csvLine(FEED_COLUMNS.map(c => row[c])));
    gz.end();
  });
  S.ok = true;
  return S;
}

// The whole file as a stream (lessons L217): a catalogue whose text is over 512 MB cannot be one string in Node
// (ERR_STRING_TOO_LONG, as the Awin feeds in L185), so the records are read and written one by one. Same checks as convert().
export async function convertFile(input, outFile) {
  const fd = openSync(input, 'r');
  const magic = Buffer.alloc(2);
  readSync(fd, magic, 0, 2, 0);
  closeSync(fd);
  const raw = createReadStream(input);
  const stream = magic[0] === 0x1f && magic[1] === 0x8b ? raw.pipe(createGunzip()) : raw;
  stream.setEncoding('utf8');
  const gz = createGzip();
  const ws = createWriteStream(outFile);
  const done = new Promise((resolve, reject) => { ws.on('finish', resolve); ws.on('error', reject); gz.on('error', reject); });
  gz.pipe(ws);
  gz.write(csvLine(FEED_COLUMNS));
  const S = { ok: false, format: '', mid: '', name: '', rows: 0, trailer: null, bad: 0, withTracking: 0, currencies: [] };
  const cur = new Set();
  let header = null;
  const emit = rec => {
    const row = toFeedRow(rec, { mid: header ? header.mid : '', name: header ? header.name : '' });
    S.rows++;
    if (row.aw_deep_link) S.withTracking++;
    if (row.currency) cur.add(row.currency);
    return gz.write(csvLine(FEED_COLUMNS.map(c => row[c])));
  };
  const START = /<product\s[^>]*product_id=/gi;
  let buf = '';
  const xmlRecords = (final) => {
    if (!header) { const h = /<header>([\s\S]*?)<\/header>/i.exec(buf); if (h) header = { mid: tag(h[1], 'merchantId'), name: tag(h[1], 'merchantName'), created: tag(h[1], 'createdOn') }; }
    const starts = [];
    START.lastIndex = 0;
    let m;
    while ((m = START.exec(buf))) starts.push(m.index);
    if (!starts.length) { if (!final && buf.length > 1048576) buf = buf.slice(-65536); return; }
    // Every record but the last is whole (it ends where the next one starts); the last one only at the end of the file.
    const upto = final ? starts.length : starts.length - 1;
    for (let k = 0; k < upto; k++) {
      let piece = buf.slice(starts[k], k + 1 < starts.length ? starts[k + 1] : buf.length);
      if (k + 1 >= starts.length) { const e = piece.search(/<trailer|<\/merchandiser/i); if (e >= 0) piece = piece.slice(0, e); }
      const r = /^<product(\s[^>]*)>([\s\S]*)<\/product>\s*$/i.exec(piece);
      if (r) emit(xmlRecord(r[1], r[2])); else S.bad++;
    }
    if (final) { const t = /<trailer>[\s\S]*?<numberOfProducts>\s*(\d+)\s*<\/numberOfProducts>/i.exec(buf); if (t) S.trailer = Number(t[1]); buf = ''; }
    else buf = buf.slice(starts[starts.length - 1]);
  };
  const pipeLine = rawLine => {
    const line = rawLine.replace(/^\uFEFF/, '');
    if (!line.trim()) return;
    if (line.startsWith('HDR|')) { const h = splitPipe(line); header = { mid: h[1] || '', name: h[2] || '', created: h[3] || '' }; return; }
    if (line.startsWith('TRL|')) { S.trailer = Number(splitPipe(line)[1]); return; }
    const rec = pipeRecord(line);
    if (rec) emit(rec); else S.bad++;
  };
  const drain = () => new Promise(r => gz.once('drain', r));
  for await (const chunk of stream) {
    buf += chunk;
    if (!S.format) {
      if (buf.length < 500) continue;
      S.format = /^\s*(\uFEFF)?\s*(<\?xml|<merchandiser|<header)/i.test(buf.slice(0, 500)) ? 'xml' : 'txt';
    }
    if (S.format === 'txt') {
      // Lines are cut off one at a time from a start index, not by slicing the buffer each time (big chunks).
      let from = 0;
      let i;
      while ((i = buf.indexOf('\n', from)) >= 0) { pipeLine(buf.slice(from, i).replace(/\r$/, '')); from = i + 1; }
      buf = buf.slice(from);
    } else xmlRecords(false);
    if (gz.writableNeedDrain) await drain();
  }
  if (!S.format) S.format = /^\s*(\uFEFF)?\s*(<\?xml|<merchandiser|<header)/i.test(buf.slice(0, 500)) ? 'xml' : 'txt';
  if (S.format === 'txt') { if (buf) pipeLine(buf.replace(/\r$/, '')); buf = ''; } else xmlRecords(true);
  gz.end();
  await done;
  S.mid = header ? header.mid : '';
  S.name = header ? header.name : '';
  S.currencies = [...cur];
  const fail = e => { S.error = e; try { rmSync(outFile, { force: true }); } catch { } return S; };
  if (S.trailer === null || !Number.isFinite(S.trailer)) return fail('no trailer (file cut short?)');
  if (S.trailer !== S.rows + S.bad) return fail(`trailer says ${S.trailer} products, read ${S.rows + S.bad}`);
  if (!S.rows) return fail('no products');
  S.ok = true;
  return S;
}

const arg = (argv, name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };

export async function main(argv = process.argv.slice(2)) {
  const mode = arg(argv, 'mode');
  const input = arg(argv, 'in');
  if (!input) return { ok: false, error: 'no input file' };
  if (mode === 'sample') return sample(readGz(input, { partial: argv.includes('--partial') }));
  if (mode === 'convert') {
    const out = arg(argv, 'out');
    if (!out) return { ok: false, error: 'no output file' };
    return convertFile(input, out);
  }
  return { ok: false, error: 'mode must be sample or convert' };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(S => { console.log(JSON.stringify(S)); }, e => { console.log(JSON.stringify({ ok: false, error: String(e && e.message || e).slice(0, 300) })); });
}
