// Linkwise product feeds (Greece and Cyprus, owner 19 Nov 2026: "I want Linkwise in tonight's command so the Greek shop
// opens today", lessons L199). Linkwise approved our 13 sites and the Hub on 19 Nov 2026 (email 09:01) and 236 programmes
// on 18 Nov. Its "Product feed" tool gives one CSV per programme:
//   https://affiliate.linkwi.se/feeds/1.2/<affiliate code>/programs-joined/columns-<list>/catinc-0/catex-0/proginc-<id>/progex-0/feed.csv
// The affiliate code (CD + digits) is in every tracking link but never goes into the repository (chat 7, 18 Nov 2026):
// tools/linkwise-feed-download.ps1 keeps it encrypted for the Windows user and hands it to this script in GW_LW_CODE.
// Each feed is written as LINKWISE_<programme>.csv.gz with the Awin column names (tools/network-links.mjs), so the import
// planners read it like the CJ, Daisycon and Rakuten files: the Linkwise tracking link (go.linkwi.se/z/<programme>-0/<code>/
// ?lnkurl=<shop page>) in aw_deep_link, the shop page in merchant_deep_link, prices with a point ("1.299,00" -> 1299.00),
// euros when the feed gives no currency, the category path with ">" ("ΔΙΑΚΟΣΜΗΣΗ&gt;Σαλόνι" -> "ΔΙΑΚΟΣΜΗΣΗ > Σαλόνι").
// Nothing is ever written to stderr (Windows PowerShell 5.1 stops on it).
//
// node tools/linkwise-feed.mjs download --archive <dir> --programs 11532,14184 [--out <report>]   (code in GW_LW_CODE)
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCsvRecords, cleanText } from './tgw-import-plan.mjs';
import { COLUMNS, csvLine } from './cj-feed.mjs';
import { feedRows } from './feed-rows.mjs';
import { isLinkwiseLink } from './network-links.mjs';

export const LINKWISE_HOST = 'affiliate.linkwi.se';
// The columns asked for (the names Linkwise's feed tool knows, checked 19 Nov 2026; an unknown name is just left out).
export const LINKWISE_COLUMNS = ['product_id', 'sku', 'product_name', 'description', 'category', 'brand_name', 'tracking_url', 'thumb_url',
  'image_url', 'in_stock', 'availability', 'currency', 'price', 'full_price', 'discount', 'program_id', 'program_name', 'size', 'colour',
  'shipping', 'gtin'];
export const isAffiliateCode = c => /^CD\d{3,9}$/.test(String(c || ''));

// base: only for the tests (a local fake Linkwise at http://127.0.0.1:<port>).
export function linkwiseFeedUrl(code, programId, base = '') {
  if (!isAffiliateCode(code)) throw new Error('bad Linkwise affiliate code');
  if (!/^\d{2,9}$/.test(String(programId))) throw new Error('bad Linkwise programme id');
  const root = /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(String(base)) ? base : `https://${LINKWISE_HOST}`;
  return `${root}/feeds/1.2/${code}/programs-joined/columns-${LINKWISE_COLUMNS.join(',')}/catinc-0/catex-0/proginc-${programId}/progex-0/feed.csv`;
}

export { isLinkwiseLink };
export function shopPage(trackingUrl) {
  try {
    const v = new URL(String(trackingUrl || '')).searchParams.get('lnkurl') || '';
    return /^https?:\/\//i.test(v) ? v : '';
  } catch { return ''; }
}
// "19,00" -> "19.00", "1.299,00" -> "1299.00", "1299.5" -> "1299.50"; nothing readable -> "".
export function euroPrice(v) {
  let s = String(v ?? '').replace(/[^0-9.,]/g, '');
  if (!s) return '';
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : '';
}
export const categoryPath = v => cleanText(String(v || '').replace(/&gt;/gi, '>')).split('>').map(x => x.trim()).filter(Boolean).join(' > ');

// One Linkwise record (by its header) -> one row in the Awin column names (COLUMNS of tools/cj-feed.mjs).
export function toAwinRow(get, programId) {
  const id = String(get('product_id') || get('sku') || '').trim();
  const price = euroPrice(get('price'));
  const full = euroPrice(get('full_price'));
  const stock = String(get('in_stock') || '').trim().toUpperCase();
  const image = String(get('image_url') || get('thumb_url') || '').trim();
  return {
    data_feed_id: '', merchant_id: String(programId), merchant_name: cleanText(get('program_name')),
    aw_product_id: id ? `lw${programId}-${id}` : '', aw_deep_link: String(get('tracking_url') || '').trim(),
    brand_name: cleanText(get('brand_name')), merchant_product_id: id, merchant_category: categoryPath(get('category')),
    category_name: '', ean: String(get('gtin') || '').trim(), mpn: String(get('sku') || '').trim(), product_name: cleanText(get('product_name')),
    description: cleanText(get('description')).slice(0, 2000), merchant_deep_link: shopPage(get('tracking_url')), merchant_image_url: image,
    large_image: image, search_price: price, store_price: price, rrp_price: full && price && Number(full) > Number(price) ? full : '',
    currency: (String(get('currency') || '').trim().toUpperCase() || 'EUR'),
    in_stock: stock === 'Y' || stock === '1' || stock === 'YES' ? '1' : stock === 'N' || stock === '0' || stock === 'NO' ? '0' : '',
    stock_status: cleanText(get('availability')), parent_product_id: '', last_updated: ''
  };
}

// Linkwise CSV (a stream) -> LINKWISE_<programme>.csv.gz at outFile. Returns the rows written.
export async function convertLinkwise(stream, programId, outFile) {
  const gz = createGzip();
  const out = createWriteStream(outFile);
  gz.pipe(out);
  const done = new Promise((resolve, reject) => { out.on('finish', resolve); out.on('error', reject); gz.on('error', reject); });
  gz.write(csvLine(COLUMNS));
  let header = null, rows = 0;
  for await (const rec of readCsvRecords(stream)) {
    if (!header) { header = rec.map(h => String(h).trim().toLowerCase().replace(/^﻿/, '')); continue; }
    if (rec.length === 1 && !String(rec[0]).trim()) continue;
    const get = name => { const i = header.indexOf(name); return i >= 0 ? rec[i] : ''; };
    const row = toAwinRow(get, programId);
    if (!row.product_name || !row.aw_deep_link) continue;
    gz.write(csvLine(COLUMNS.map(c => row[c])));
    rows++;
  }
  gz.end();
  await done;
  return { rows, header: header || [] };
}

// Download one programme into the archive. The old copy goes to <archive>\_old\<stamp>\ only when the new one has products.
export async function downloadProgramme({ code, programId, archive, stamp, fetchImpl = globalThis.fetch, base = '' }) {
  const final = join(archive, `LINKWISE_${programId}.csv.gz`);
  const part = `${final}.part`;
  let res;
  try { res = await fetchImpl(linkwiseFeedUrl(code, programId, base)); } catch (e) { return { programId, ok: false, rows: 0, why: `network: ${String(e && e.message || e).slice(0, 80)}` }; }
  if (!res || !res.ok) return { programId, ok: false, rows: 0, why: `HTTP ${res ? res.status : '?'}` };
  const body = res.body ? Readable.fromWeb(res.body) : Readable.from([await res.text()]);
  const { rows, header } = await convertLinkwise(body, programId, part);
  if (!header.includes('product_name')) { try { unlinkSync(part); } catch { /* nothing */ } return { programId, ok: false, rows: 0, why: 'not a Linkwise feed (no product_name column)' }; }
  if (rows === 0) { try { unlinkSync(part); } catch { /* nothing */ } return { programId, ok: false, rows: 0, why: 'empty feed' }; }
  const check = await feedRows(part, ['product_name', 'aw_deep_link']);
  if (!check.ok || check.rows !== rows) { try { unlinkSync(part); } catch { /* nothing */ } return { programId, ok: false, rows, why: 'check of the written file failed' }; }
  if (existsSync(final)) {
    // Far fewer products than the copy we have (an interrupted or partial answer): the old copy stays, as for Daisycon.
    const before = await feedRows(final, ['product_name', 'aw_deep_link']);
    if (before.ok && before.rows >= 100 && rows < before.rows / 2) {
      try { unlinkSync(part); } catch { /* nothing */ }
      return { programId, ok: false, rows, why: `only ${rows} products, the copy we have has ${before.rows}: kept the old copy` };
    }
    const old = join(archive, '_old', stamp);
    mkdirSync(old, { recursive: true });
    renameSync(final, join(old, `LINKWISE_${programId}.csv.gz`));
  }
  renameSync(part, final);
  return { programId, ok: true, rows };
}

export async function downloadAll({ code, programs, archive, stamp, fetchImpl, base = '', parallel = 4, onDone = () => {} }) {
  const queue = [...programs];
  const results = [];
  async function worker() {
    while (queue.length) {
      const id = queue.shift();
      const r = await downloadProgramme({ code, programId: id, archive, stamp, fetchImpl, base });
      results.push(r);
      onDone(r);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, programs.length)) }, worker));
  return results.sort((a, b) => Number(a.programId) - Number(b.programId));
}

async function main() {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] || '' : ''; };
  const say = s => process.stdout.write(`${s}\n`);
  if (args[0] !== 'download') { say('usage: node tools/linkwise-feed.mjs download --archive <dir> --programs <ids>'); return 2; }
  const code = String(process.env.GW_LW_CODE || '').trim();
  if (!isAffiliateCode(code)) { say('ERROR no Linkwise affiliate code (GW_LW_CODE)'); return 2; }
  const archive = opt('archive');
  if (!archive || !existsSync(archive)) { say('ERROR no archive folder'); return 2; }
  const programs = opt('programs').split(/[,\s]+/).filter(Boolean);
  if (!programs.length || programs.some(p => !/^\d{2,9}$/.test(p))) { say('ERROR bad --programs'); return 2; }
  const base = opt('base');
  if (base && !/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(base)) { say('ERROR --base is only for a local test server'); return 2; }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  const results = await downloadAll({ code, programs, archive, stamp, base, parallel: Number(opt('parallel')) || 4, onDone: r => say(`${r.ok ? 'OK' : 'FAIL'} ${r.programId} ${r.rows}${r.why ? ` ${r.why}` : ''}`) });
  const ok = results.filter(r => r.ok);
  say(`SUMMARY ${ok.length} of ${results.length} feeds, ${ok.reduce((n, r) => n + r.rows, 0)} rows`);
  const out = opt('out');
  if (out) writeFileSync(out, results.map(r => `${r.ok ? 'OK' : 'FAIL'}\t${r.programId}\t${r.rows}\t${r.why || ''}`).join('\n') + '\n', 'utf8');
  return ok.length ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(c => { process.exitCode = c; }).catch(e => { process.stdout.write(`ERROR ${String(e && e.message || e).slice(0, 200)}\n`); process.exitCode = 1; });
}
