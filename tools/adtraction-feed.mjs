// Adtraction product feeds (UK programmes approved on 23 Nov 2026: chat 7 sheet «Εγκρίσεις» rows 1183-1191, massive
// import wave 1 with the UK, lessons L221). Adtraction is a Swedish network; its API v3 (https://api.adtraction.net/v3/,
// the token in the X-Token header, from Account > Settings in Adtraction) lists the programmes a channel is approved for,
// with their feeds (POST /v3/partner/programs/), and gives a programme's products as JSON (POST /v3/partner/products/feed/:
// productName, productPrice, oldPrice, currency, productUrl, trackingUrl, imageUrl, inStock, ean, sku, manufacturer,
// manufacturerArticleNumber, productCategory, productDescription, shipping).
// The token never goes into the repository, a report or the screen: tools/adtraction-feed-download.ps1 keeps it encrypted
// for the Windows user (DPAPI) and hands it to this script in GW_AT_TOKEN. The channel (our site at Adtraction) is a number
// shown in the reports, given in GW_AT_CHANNEL.
// Each feed is written as ADTRACTION_<programme>.csv.gz with the Awin column names (tools/network-links.mjs), the
// Adtraction click in aw_deep_link and the shop page in merchant_deep_link, so the import planners read it like the CJ,
// Daisycon, Rakuten and Linkwise files. Nothing is ever written to stderr (Windows PowerShell 5.1 stops on it).
//
// node tools/adtraction-feed.mjs programs --markets GB [--channel 123] [--out <file>]       (token in GW_AT_TOKEN)
// node tools/adtraction-feed.mjs download --archive <dir> --programs 1234:5678,... [--out <file>]
//   (each item: <programme>:<channel>; the channel of each programme comes from the "programs" step)
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COLUMNS, csvLine } from './cj-feed.mjs';
import { feedRows } from './feed-rows.mjs';
import { isAdtractionLink, adtractionLink } from './network-links.mjs';
import { cleanText } from './tgw-import-plan.mjs';

export const ADTRACTION_API = 'https://api.adtraction.net';
export const isToken = t => /^[A-Za-z0-9_-]{16,128}$/.test(String(t || ''));
export const isChannel = c => /^\d{3,12}$/.test(String(c || ''));
export { isAdtractionLink, adtractionLink };

const rootOf = base => (/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(String(base)) ? base : ADTRACTION_API);

// One call to the API. Returns { status, json, text } (text: the first 300 characters, for the report).
export async function call(path, { token, body = null, method = 'POST', base = '', fetchImpl = globalThis.fetch }) {
  const headers = { 'X-Token': token, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try { res = await fetchImpl(`${rootOf(base)}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }); } catch (e) {
    return { status: 0, json: null, text: `network: ${String(e && e.message || e).slice(0, 120)}` };
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text: text.replace(/\s+/g, ' ').slice(0, 300) };
}

// Our channels: v3 has no list for partners, so the v2 list is asked (deprecated, may be gone); with --channel, that one.
export async function channels({ token, base = '', fetchImpl }) {
  for (const [path, method] of [['/v3/partner/channels/', 'POST'], ['/v2/partner/channels/', 'GET']]) {
    const r = await call(path, { token, method, body: method === 'POST' ? {} : null, base, fetchImpl });
    const list = Array.isArray(r.json) ? r.json : (r.json && Array.isArray(r.json.channels) ? r.json.channels : null);
    if (r.status === 200 && list) {
      return { ok: true, list: list.map(c => ({ channelId: String(c.channelId ?? c.id ?? ''), name: cleanText(c.channelName ?? c.name ?? '') })).filter(c => isChannel(c.channelId)) };
    }
  }
  return { ok: false, list: [] };
}

// The programmes a channel is approved for in one market, with their feeds.
export async function programs({ token, channel, market, base = '', fetchImpl }) {
  const r = await call('/v3/partner/programs/', { token, body: { market, channelId: Number(channel), approvalStatus: 1 }, base, fetchImpl });
  if (r.status !== 200 || !Array.isArray(r.json)) return { ok: false, status: r.status, text: r.text, list: [] };
  const list = r.json.map(p => ({
    programId: String(p.programId ?? ''), name: cleanText(p.programName ?? ''), market: String(p.market ?? market), currency: String(p.currency ?? ''),
    approved: Number(p.approvalStatus ?? 1) === 1, channel: String(channel),
    feeds: (Array.isArray(p.feeds) ? p.feeds : []).map(f => ({ feedId: String(f.feedId ?? ''), name: cleanText(f.name ?? ''), products: Number(f.numberOfProducts ?? 0), updated: String(f.lastUpdated ?? '') }))
  })).filter(p => /^\d{2,12}$/.test(p.programId));
  return { ok: true, status: 200, list };
}

const money = v => { const n = Number(String(v ?? '').replace(',', '.').replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? n.toFixed(2) : ''; };
const stockOf = v => {
  const s = String(v ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'in stock', 'instock'].includes(s)) return '1';
  if (['0', 'false', 'no', 'n', 'out of stock', 'outofstock'].includes(s)) return '0';
  return '';
};

// One product of the JSON feed -> one row in the Awin column names. The click: the feed's trackingUrl when it is an
// Adtraction click of this channel, otherwise the standard deep link (track.adtraction.com/t/t?a=...&as=...&t=2&tk=1&url=).
export function toAwinRow(p, programId, channel, fallbackCurrency = '') {
  const page = String(p.productUrl || '').trim();
  const given = String(p.trackingUrl || '').trim();
  const link = isAdtractionLink(given, channel) ? given : (/^https:\/\//i.test(page) ? adtractionLink(programId, channel, page) : '');
  const key = String(p.sku || p.ean || '').trim() || (page ? createHash('sha1').update(page).digest('hex').slice(0, 16) : '');
  const price = money(p.productPrice);
  const old = money(p.oldPrice);
  return {
    row: {
      data_feed_id: '', merchant_id: String(programId), merchant_name: '', aw_product_id: key ? `at${programId}-${key}` : '', aw_deep_link: link,
      brand_name: cleanText(p.manufacturer || ''), merchant_product_id: String(p.sku || '').trim(), merchant_category: cleanText(p.productCategory || '').replace(/\s*[>|/]\s*/g, ' > '),
      category_name: '', ean: String(p.ean || '').trim(), mpn: String(p.manufacturerArticleNumber || '').trim(), product_name: cleanText(p.productName || ''),
      description: cleanText(p.productDescription || '').slice(0, 2000), merchant_deep_link: page, merchant_image_url: String(p.imageUrl || '').trim(),
      large_image: String(p.imageUrl || '').trim(), search_price: price, store_price: price, rrp_price: old && price && Number(old) > Number(price) ? old : '',
      currency: (String(p.currency || '').trim().toUpperCase() || fallbackCurrency), in_stock: stockOf(p.inStock), stock_status: '', parent_product_id: '', last_updated: ''
    },
    built: Boolean(link) && link !== given
  };
}

// Download one programme into the archive. The old copy goes to <archive>\_old\<stamp>\ only when the new one is good.
export async function downloadProgramme({ token, programId, channel, archive, stamp, base = '', fetchImpl = globalThis.fetch, currency = '' }) {
  const final = join(archive, `ADTRACTION_${programId}.csv.gz`);
  const part = `${final}.part`;
  const r = await call('/v3/partner/products/feed/', { token, body: { programId: Number(programId), channelId: Number(channel) }, base, fetchImpl });
  if (r.status !== 200) return { programId, ok: false, rows: 0, built: 0, why: `HTTP ${r.status}${r.text ? `: ${r.text.slice(0, 120)}` : ''}` };
  const list = Array.isArray(r.json) ? r.json : (r.json && Array.isArray(r.json.products) ? r.json.products : null);
  if (!list) return { programId, ok: false, rows: 0, built: 0, why: 'not a product list' };
  const gz = createGzip();
  const out = createWriteStream(part);
  gz.pipe(out);
  const done = new Promise((resolve, reject) => { out.on('finish', resolve); out.on('error', reject); gz.on('error', reject); });
  gz.write(csvLine(COLUMNS));
  let rows = 0, built = 0;
  for (const p of list) {
    const { row, built: b } = toAwinRow(p || {}, programId, channel, currency);
    if (!row.product_name || !row.aw_deep_link || !row.aw_product_id) continue;
    gz.write(csvLine(COLUMNS.map(c => row[c])));
    rows++;
    if (b) built++;
  }
  gz.end();
  await done;
  if (rows === 0) { try { unlinkSync(part); } catch { /* nothing */ } return { programId, ok: false, rows: 0, built: 0, why: `empty feed (${list.length} items, none with a name and a link)` }; }
  const check = await feedRows(part, ['product_name', 'aw_deep_link']);
  if (!check.ok || check.rows !== rows) { try { unlinkSync(part); } catch { /* nothing */ } return { programId, ok: false, rows, built, why: 'check of the written file failed' }; }
  if (existsSync(final)) {
    // Far fewer products than the copy we have (a cut answer): the old copy stays (lessons L168).
    const before = await feedRows(final, ['product_name', 'aw_deep_link']);
    if (before.ok && before.rows >= 100 && rows < before.rows / 2) {
      try { unlinkSync(part); } catch { /* nothing */ }
      return { programId, ok: false, rows, built, why: `only ${rows} products, the copy we have has ${before.rows}: kept the old copy` };
    }
    const old = join(archive, '_old', stamp);
    mkdirSync(old, { recursive: true });
    renameSync(final, join(old, `ADTRACTION_${programId}.csv.gz`));
  }
  renameSync(part, final);
  return { programId, ok: true, rows, built };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] || '' : ''; };
  const say = s => process.stdout.write(`${s}\n`);
  const token = String(process.env.GW_AT_TOKEN || '').trim();
  if (!isToken(token)) { say('ERROR no Adtraction API token (GW_AT_TOKEN)'); return 2; }
  const base = opt('base');
  if (base && !/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(base)) { say('ERROR --base is only for a local test server'); return 2; }
  const lines = [];
  const emit = s => { say(s); lines.push(s); };
  if (args[0] === 'programs') {
    const markets = (opt('markets') || 'GB').split(/[,\s]+/).filter(m => /^[A-Za-z]{2,3}$/.test(m)).map(m => m.toUpperCase());
    let chans = opt('channel') ? [{ channelId: opt('channel'), name: '' }] : [];
    if (chans.length && !isChannel(chans[0].channelId)) { say('ERROR bad --channel'); return 2; }
    if (!chans.length) {
      const c = await channels({ token, base });
      if (!c.ok || !c.list.length) { emit('NOCHANNEL'); return 3; }
      chans = c.list;
    }
    for (const ch of chans) emit(`CHANNEL ${ch.channelId} ${ch.name}`);
    let n = 0;
    for (const ch of chans) {
      for (const m of markets) {
        const r = await programs({ token, channel: ch.channelId, market: m, base });
        if (!r.ok) { emit(`FAIL ${ch.channelId} ${m} HTTP ${r.status} ${r.text}`); continue; }
        for (const p of r.list) {
          n++;
          const feeds = p.feeds.map(f => `${f.feedId}:${f.products}:${f.updated}`).join(';');
          emit(`PROGRAM\t${p.programId}\t${ch.channelId}\t${p.market}\t${p.currency}\t${p.feeds.reduce((s, f) => s + f.products, 0)}\t${p.name}\t${feeds}`);
        }
      }
    }
    emit(`SUMMARY ${n} approved programmes`);
  } else if (args[0] === 'download') {
    const archive = opt('archive');
    if (!archive || !existsSync(archive)) { say('ERROR no archive folder'); return 2; }
    const items = opt('programs').split(/[,\s]+/).filter(Boolean).map(x => x.split(':'));
    if (!items.length || items.some(([p, c, cur]) => !/^\d{2,12}$/.test(p || '') || !isChannel(c) || (cur && !/^[A-Z]{3}$/.test(cur)))) { say('ERROR bad --programs (programme:channel[:currency])'); return 2; }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
    let ok = 0, total = 0;
    for (const [programId, channel, currency] of items) {
      const r = await downloadProgramme({ token, programId, channel, archive, stamp, base, currency: currency || '' });
      emit(`${r.ok ? 'OK' : 'FAIL'} ${r.programId} ${r.rows} ${r.built}${r.why ? ` ${r.why}` : ''}`);
      if (r.ok) { ok++; total += r.rows; }
    }
    emit(`SUMMARY ${ok} of ${items.length} feeds, ${total} rows`);
    if (!ok) { if (opt('out')) writeFileSync(opt('out'), lines.join('\n') + '\n', 'utf8'); return 1; }
  } else {
    say('usage: node tools/adtraction-feed.mjs programs|download ...');
    return 2;
  }
  if (opt('out')) writeFileSync(opt('out'), lines.join('\n') + '\n', 'utf8');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(c => { process.exitCode = c; }).catch(e => { process.stdout.write(`ERROR ${String(e && e.message || e).slice(0, 200)}\n`); process.exitCode = 1; });
}
