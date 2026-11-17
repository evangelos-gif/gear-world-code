// bol.com Partnerprogramma (chat 9 "Retailers & Feeds B", 16 Nov 2026; lessons L154): the products of bol.com's
// Marketing Catalog API (https://api.bol.com/marketing/catalog/v1) as a feed file with the Awin column names, so the
// import planner reads them like any other network (tools/network-links.mjs). Called by tools/bol-feed-download.ps1,
// which keeps the keys (DPAPI) and asks the owner's phrase; the keys reach this file only through the environment
// (GW_BOL_ID, GW_BOL_SECRET) and never appear in a line it writes.
//
//   --mode categories  READ-ONLY: bol.com's categories with their ids and product counts (one popular-list call with
//                      include-relevant-categories), to choose the ids of the download.
//   --mode download    the most popular products of each category id (--categories '1,2'), and the products of the
//                      searches (--search 'werkschoenen'), page by page (page-size 50, the API's most), to
//                      <out>/BOL_<category>_<country>.csv.gz (a search: BOL_<category or 0>_<country>-<search>.csv.gz).
//                      The old copy of a file goes to <out>/_old/<stamp>/ first. Writes only files on this PC.
//
// The rules of bol.com's terms and API (Manager 15 Nov 2026, chat 7's reading of the terms):
//  - ONE token per run, asked again only when it has run out, at most 3; no new try after 401/403/429 (L154: many
//    tokens block the address). The keys go only to login.bol.com, the token only to api.bol.com (or 127.0.0.1 in tests).
//  - Only the official API (no reading of bol.com pages: "spider websites ... worden niet toegelaten").
//  - A product without an offer (not for sale now) or without a bol.com page is left out; the same product (EAN) once in
//    the whole run, the first time it comes (the categories are given in the order of the commission, highest first).
//  - No "was" price: the strikethrough price of the API stays out of rrp_price (Google Ads rules, L107).
//  - The link is the partner link of site ID 1559450 (bolLink); bol.com delivers to NL and BE only (the site setting
//    deliversTo 'bol.com': ['NL', 'BE'] and languages { 'bol.com': 'nl' }, L165, come before any import).
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FEED_COLUMNS, bolLink, csvLine } from './network-links.mjs';

export const LOGIN_BASE = 'https://login.bol.com';
export const API_BASE = 'https://api.bol.com';
export const CATALOG = '/marketing/catalog/v1';
export const PAGE_SIZE = 50;          // the API's most for search and popular lists
export const MAX_PER_CATEGORY = 1000; // default: the 1,000 most popular products of a category (20 pages)
export const MAX_TOKENS = 3;
export const PAUSE_MS = 300;
export const UA = 'GearWorld-bol-feed/1.0 (+https://gearworldgroup.com)';
export const BOL_COLUMNS = [...FEED_COLUMNS, 'language', 'bol_category_id', 'bol_rating', 'bol_gpc'];

// Only bol.com's own servers (or the tests' local server) get the keys and the token.
export function okBase(base, host) {
  try {
    const u = new URL(base);
    if (u.protocol === 'http:' && u.hostname === '127.0.0.1') return true;
    return u.protocol === 'https:' && u.hostname === host && (u.pathname === '/' || u.pathname === '');
  } catch { return false; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = v => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
export const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

// One API session: the token (once, renewed only when it has run out) and GET calls. Never follows a redirect.
export function session({ id, secret, loginBase = LOGIN_BASE, apiBase = API_BASE, fetchImpl = fetch, now = () => Date.now(), language = 'nl' }) {
  const S = { tokens: 0, calls: 0, token: '', until: 0 };
  async function token() {
    if (S.token && now() < S.until) return S.token;
    if (S.tokens >= MAX_TOKENS) throw Object.assign(new Error(`${MAX_TOKENS} tokens asked in this run already: stopping, so bol.com does not block the address`), { code: 6 });
    S.tokens++;
    const basic = Buffer.from(`${id}:${secret}`).toString('base64');
    const r = await fetchImpl(`${loginBase.replace(/\/$/, '')}/token?grant_type=client_credentials`, {
      method: 'POST', redirect: 'manual', body: '', headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA } });
    if (r.status === 401) throw Object.assign(new Error('bol.com refused the keys (401): run the keys step again with new keys'), { code: 3 });
    if (r.status === 403 || r.status === 429) throw Object.assign(new Error(`bol.com answered ${r.status} to the token (too many requests or blocked${r.headers.get('retry-after') ? `, again after ${r.headers.get('retry-after')} s` : ''}); no new try`), { code: 6 });
    if (r.status !== 200) throw Object.assign(new Error(`no token: HTTP ${r.status}`), { code: 4 });
    const j = await r.json().catch(() => ({}));
    if (!j.access_token) throw Object.assign(new Error('bol.com gave no token in the answer'), { code: 4 });
    const life = Number(j.expires_in) > 0 ? Number(j.expires_in) : 299;
    S.token = String(j.access_token);
    S.until = now() + Math.max(30, life - 30) * 1000;
    return S.token;
  }
  async function get(path, params) {
    const t = await token();
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    S.calls++;
    const r = await fetchImpl(`${apiBase.replace(/\/$/, '')}${CATALOG}${path}?${q}`, {
      redirect: 'manual', headers: { Authorization: `Bearer ${t}`, Accept: 'application/json', 'Accept-Language': language, 'User-Agent': UA } });
    if (r.status === 401) throw Object.assign(new Error('api.bol.com refused the token (401); no new token asked'), { code: 4 });
    if (r.status === 429) throw Object.assign(new Error(`api.bol.com answered 429 (too many requests${r.headers.get('retry-after') ? `, again after ${r.headers.get('retry-after')} s` : ''}); stopping, no new try`), { code: 6 });
    if (r.status === 404) return { status: 404, body: null };
    if (r.status !== 200) {
      const e = await r.json().catch(() => ({}));
      return { status: r.status, body: null, why: clean(e.detail || e.title || '') };
    }
    return { status: 200, body: await r.json() };
  }
  return { token, get, stats: S };
}

// The categories bol.com shows for a popular list without a category: top level and their subcategories.
export function categoryTree(body) {
  const walk = (list, depth) => (Array.isArray(list) ? list : []).map(c => ({
    id: String(c.categoryId ?? ''), name: clean(c.categoryName), count: Number(c.productCount) || 0,
    sub: depth < 2 ? walk(c.subcategories, depth + 1) : []
  })).filter(c => c.id);
  return walk(body && body.allRelevantCategories, 1);
}

// One API product -> one feed row (Awin column names). null = left out, with the reason in .why of the returned object.
export function rowOf(p, { country = 'NL', categoryId = '', categoryName = '', stamp = new Date().toISOString() } = {}) {
  const ean = String(p && p.ean || '').trim();
  const price = p && p.offer && Number(p.offer.price);
  if (!ean) return { why: 'no EAN' };
  if (!(price > 0)) return { why: 'no offer (not for sale now)' };
  const page = String(p.url || '').trim();
  const link = bolLink(page, p.title);
  if (!link) return { why: 'no bol.com product page' };
  const img = p.image && p.image.url && /^https:\/\//i.test(p.image.url) ? String(p.image.url) : '';
  const gpc = (Array.isArray(p.gpc) ? p.gpc : []).slice().sort((a, b) => (a.level || 0) - (b.level || 0)).map(g => clean(g.name)).filter(Boolean);
  // No "before" price on purpose: bol's offer.strikethroughPrice is bol's own "van" (was) price, not the maker's RRP, and
  // the sites print the before price as "RRP £X" (src/pages/layout.js rrpTag): a was price shown as an RRP is a claim we
  // cannot back (lessons L107). No brand either: the list and search endpoints give none; only /products/{ean} with
  // include-specifications has one, one call per product (lessons L178).
  return { row: {
    data_feed_id: `bol-${country}`, merchant_id: 'bol.com', merchant_name: 'bol.com', aw_product_id: ean, aw_deep_link: link,
    brand_name: '', merchant_product_id: String(p.bolProductId || ''), merchant_category: categoryName, category_name: gpc.join(' > '),
    ean, mpn: '', product_name: clean(p.title), description: clean(p.description).slice(0, 2000), merchant_deep_link: page,
    merchant_image_url: img, large_image: img, search_price: price.toFixed(2), store_price: price.toFixed(2), rrp_price: '',
    currency: 'EUR', in_stock: '1', stock_status: clean(p.offer.deliveryDescription), parent_product_id: '', last_updated: stamp,
    language: 'nl', bol_category_id: String(categoryId), bol_rating: p.rating ?? '', bol_gpc: gpc.join(' > ')
  } };
}

function openRows(file) {
  const gz = createGzip();
  const ws = createWriteStream(file);
  gz.pipe(ws);
  const done = new Promise((res, rej) => { ws.on('finish', res); ws.on('error', rej); gz.on('error', rej); });
  done.catch(() => {});
  gz.write(csvLine(BOL_COLUMNS));
  return { write: row => gz.write(csvLine(BOL_COLUMNS.map(c => row[c]))), close: () => { gz.end(); return done; } };
}

// The jobs of a download, in the order given (highest commission first): category ids, then searches.
// A category is '<id>' or '<id>=<name>' (the name from the categories step, used when the API gives none).
export function jobsOf({ categories = [], searches = [], searchCategory = '', country = 'NL' }) {
  const jobs = [];
  for (const c of categories) {
    const m = String(c).match(/^\s*(\d{1,12})\s*(?:=\s*(.{1,60}?))?\s*$/);
    if (m && !jobs.some(j => j.categoryId === m[1])) jobs.push({ kind: 'category', categoryId: m[1], label: clean(m[2] || ''), file: `BOL_${m[1]}_${country}` });
  }
  for (const term of searches) jobs.push({ kind: 'search', term, categoryId: String(searchCategory || ''), file: `BOL_${searchCategory || 0}_${country}-${slug(term)}` });
  return jobs;
}

export async function download({ api, jobs, country = 'NL', out, max = MAX_PER_CATEGORY, pageSize = PAGE_SIZE, pauseMs = PAUSE_MS, stamp = new Date().toISOString(), oldStamp = '' }) {
  const seen = new Set();
  const results = [];
  for (const job of jobs) {
    const R = { ...job, ok: false, pages: 0, written: 0, left: {}, total: 0, prices: [], samples: [], name: '' };
    const part = join(out, `${job.file}.csv.gz.part`);
    const w = openRows(part);
    try {
      for (let page = 1; R.written + Object.values(R.left).reduce((a, b) => a + b, 0) < max; page++) {
        const params = { 'country-code': country, page, 'page-size': pageSize, 'include-image': 'true', 'include-offer': 'true', 'include-rating': 'true' };
        if (job.categoryId && job.categoryId !== '0') params['category-id'] = job.categoryId;
        if (page === 1 && job.kind === 'category') params['include-relevant-categories'] = 'true';
        let res;
        if (job.kind === 'search') res = await api.get('/products/search', { 'search-term': job.term, ...params });
        else res = await api.get('/products/lists/popular', params);
        if (res.status === 404) break;
        if (res.status !== 200) { if (page === 1) throw Object.assign(new Error(`HTTP ${res.status}${res.why ? ` ${res.why}` : ''}`), { soft: true }); break; }
        const b = res.body || {};
        R.pages++;
        if (page === 1) {
          R.total = Number(b.totalResults) || 0;
          const tree = categoryTree(b);
          const me = tree.find(c => c.id === job.categoryId) || tree.flatMap(c => c.sub).find(c => c.id === job.categoryId);
          R.name = me ? me.name : (job.label || (job.kind === 'search' ? `search "${job.term}"` : ''));
        }
        const list = Array.isArray(b.results) ? b.results : [];
        if (!list.length) break;
        for (const p of list) {
          const r = rowOf(p, { country, categoryId: job.categoryId, categoryName: R.name, stamp });
          if (!r.row) { R.left[r.why] = (R.left[r.why] || 0) + 1; continue; }
          if (seen.has(r.row.ean)) { R.left['the same product already in this run (EAN)'] = (R.left['the same product already in this run (EAN)'] || 0) + 1; continue; }
          seen.add(r.row.ean);
          w.write(r.row);
          R.written++;
          if (R.prices.length < 20000) R.prices.push(Number(r.row.search_price));
          if (R.samples.length < 5 && (R.written <= 3 || R.written % 200 === 0)) R.samples.push(`${r.row.search_price} | ${r.row.product_name.slice(0, 90)}`);
        }
        // The end is the last page bol.com names (or an empty page). A short page is not the end when bol.com says there
        // are more pages: the first download (17 Nov 2026) stopped "Auto & Motor" after page 1 (47 of 50) and
        // "Damesmode" after page 16 that way. Without totalPages a short page still ends the list.
        const totalPages = Number(b.totalPages) || 0;
        if (totalPages ? page >= totalPages : list.length < pageSize) break;
        if (pauseMs) await sleep(pauseMs);
      }
      await w.close();
      const final = join(out, `${job.file}.csv.gz`);
      if (existsSync(final)) {
        const oldDir = join(out, '_old', oldStamp || stamp.replace(/\D/g, '').slice(0, 14));
        mkdirSync(oldDir, { recursive: true });
        renameSync(final, join(oldDir, `${job.file}.csv.gz`));
        R.oldMoved = true;
      }
      renameSync(part, final);
      R.ok = true;
      R.fileName = `${job.file}.csv.gz`;
    } catch (e) {
      await w.close().catch(() => {});
      rmSync(part, { force: true });
      if (!e.soft) { R.error = e.message; results.push(R); throw Object.assign(e, { results }); }
      R.error = e.message;
    }
    results.push(R);
    if (pauseMs) await sleep(pauseMs);
  }
  return results;
}

const fmt = n => Number(n).toLocaleString('en-GB');
export function renderDownload({ results, country, max, api }) {
  const L = [`bol.com - λήψη προϊόντων (${country}, έως ${fmt(max)} ανά κατηγορία ή αναζήτηση)`, ''];
  let total = 0;
  for (const R of results) {
    const pr = R.prices.slice().sort((a, b) => a - b);
    const what = R.kind === 'search' ? `αναζήτηση «${R.term}»${R.categoryId ? ` στην κατηγορία ${R.categoryId}` : ''}` : `κατηγορία ${R.categoryId}${R.name ? ` «${R.name}»` : ''}`;
    L.push(`=== ${what}: ${R.ok ? 'ΕΝΤΑΞΕΙ' : 'ΠΡΟΒΛΗΜΑ'}${R.fileName ? ` -> ${R.fileName}` : ''}${R.oldMoved ? ' (το παλιό στο _old)' : ''}`);
    if (R.error) L.push(`  Σφάλμα: ${R.error}`);
    L.push(`  Στο bol.com: ${fmt(R.total)} | σελίδες: ${R.pages} | γράφτηκαν: ${fmt(R.written)}`);
    for (const [why, n] of Object.entries(R.left)) L.push(`  Έξω: ${fmt(n)} - ${why}`);
    if (pr.length) L.push(`  Τιμές €: από ${pr[0].toFixed(2)} | μέση ${pr[Math.floor(pr.length / 2)].toFixed(2)} | έως ${pr[pr.length - 1].toFixed(2)}`);
    for (const s of R.samples) L.push(`  ${s}`);
    L.push('');
    total += R.written;
  }
  L.push(`Σύνολο: ${fmt(total)} προϊόντα σε ${results.filter(r => r.ok).length} αρχεία. Αιτήματα: ${api.stats.tokens} token, ${api.stats.calls} κλήσεις API.`);
  L.push('Μόνο αρχεία στον υπολογιστή: τα sites και οι βάσεις ΔΕΝ άλλαξαν. Εισαγωγή μόνο με «ΕΓΚΡΙΝΩ ALL IMPORTS», αφού μπουν η αφαίρεση και η καθημερινή ανανέωση (Manager 15/11).');
  return L.join('\n') + '\n';
}
export function renderCategories({ tree, country, api }) {
  const L = [`bol.com - κατηγορίες (${country}): id | όνομα | προϊόντα`, ''];
  for (const c of tree) {
    L.push(`${c.id} | ${c.name} | ${fmt(c.count)}`);
    for (const s of c.sub) L.push(`    ${s.id} | ${s.name} | ${fmt(s.count)}`);
  }
  if (!tree.length) L.push('Το bol.com δεν έδωσε κατηγορίες.');
  L.push('', `Αιτήματα: ${api.stats.tokens} token, ${api.stats.calls} κλήση API. Μόνο ανάγνωση: δεν αποθηκεύτηκε τίποτα εκτός από αυτή την αναφορά.`);
  return L.join('\n') + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? String(args[i + 1] ?? '') : ''; };
  const list = n => val(n).split(/[,;]+/).map(x => x.trim()).filter(Boolean);
  const answer = (code, x) => { process.stdout.write(`${JSON.stringify(x)}\n`); process.exit(code); };
  const loginBase = val('login-base') || LOGIN_BASE;
  const apiBase = val('api-base') || API_BASE;
  if (!okBase(loginBase, 'login.bol.com') || !okBase(apiBase, 'api.bol.com')) answer(2, { error: 'the keys go only to login.bol.com and api.bol.com' });
  const id = process.env.GW_BOL_ID || '';
  const secret = process.env.GW_BOL_SECRET || '';
  if (!id || !secret) answer(3, { error: 'no keys (run the keys step first)' });
  const country = /^(NL|BE)$/.test(val('country').toUpperCase()) ? val('country').toUpperCase() : 'NL';
  const report = val('report');
  const api = session({ id, secret, loginBase, apiBase, language: country === 'BE' ? 'nl-BE' : 'nl' });
  try {
    if (val('mode') === 'categories') {
      const r = await api.get('/products/lists/popular', { 'country-code': country, page: 1, 'page-size': 1, 'include-relevant-categories': 'true' });
      if (r.status !== 200) answer(4, { error: `HTTP ${r.status} ${r.why || ''}`.trim(), tokens: api.stats.tokens });
      const tree = categoryTree(r.body);
      if (report) writeFileSync(report, renderCategories({ tree, country, api }));
      answer(0, { ok: true, categories: tree.length, tokens: api.stats.tokens, calls: api.stats.calls });
    }
    if (val('mode') === 'download') {
      const out = resolve(val('out') || '.');
      if (!existsSync(out)) answer(2, { error: `feeds folder not found: ${out}` });
      const categories = list('categories');
      const searches = list('search').filter(x => x.length <= 60);
      const searchCategory = /^\d{1,12}$/.test(val('search-category')) ? val('search-category') : '';
      const max = Math.min(10000, Math.max(1, Number(val('max')) || MAX_PER_CATEGORY));
      const jobs = jobsOf({ categories, searches, searchCategory, country });
      if (!jobs.length) answer(2, { error: 'no category id or search given' });
      let results;
      try {
        results = await download({ api, jobs, country, out, max, pauseMs: Number(val('pause')) >= 0 && val('pause') !== '' ? Number(val('pause')) : PAUSE_MS, oldStamp: val('stamp') });
      } catch (e) {
        if (report) writeFileSync(report, renderDownload({ results: e.results || [], country, max, api }) + `\nΣΤΑΜΑΤΗΣΕ: ${e.message}\n`);
        answer(e.code || 9, { error: e.message, tokens: api.stats.tokens, calls: api.stats.calls });
      }
      if (report) writeFileSync(report, renderDownload({ results, country, max, api }));
      const bad = results.filter(r => !r.ok).length;
      answer(bad ? 5 : 0, { ok: !bad, files: results.filter(r => r.ok).length, products: results.reduce((a, r) => a + r.written, 0), tokens: api.stats.tokens, calls: api.stats.calls });
    }
    answer(2, { error: 'unknown --mode (categories or download)' });
  } catch (e) {
    answer(e.code || 9, { error: String(e.message || e).slice(0, 300), tokens: api.stats.tokens });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
