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
//                      --standard instead of --categories/--search: the standard lists of src/lib/bol-lists.js, the
//                      same ones the private Worker gear-world-bol-refresh re-reads every day (lessons L205).
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
import { FEED_COLUMNS, csvLine } from './network-links.mjs';
// The API session, the row of a product, the jobs and the paging are shared with the private Worker
// gear-world-bol-refresh (src/lib/bol-catalog.js, lessons L205): plain JavaScript without Node-only imports.
import { LOGIN_BASE, API_BASE, CATALOG, PAGE_SIZE, MAX_PER_CATEGORY, MAX_TOKENS, UA, okBase, slug, session, categoryTree, rowOf,
  jobsOf, pageRequest, lastPage } from '../src/lib/bol-catalog.js';
// The standard lists (the 12 categories and 2 searches the Worker refreshes every day): one shared file (L205).
import { standardJobs, BOL_MAX_PER_LIST } from '../src/lib/bol-lists.js';

export { LOGIN_BASE, API_BASE, CATALOG, PAGE_SIZE, MAX_PER_CATEGORY, MAX_TOKENS, UA, okBase, slug, session, categoryTree, rowOf, jobsOf };
export const PAUSE_MS = 300;
export const BOL_COLUMNS = [...FEED_COLUMNS, 'language', 'bol_category_id', 'bol_rating', 'bol_gpc'];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function openRows(file) {
  const gz = createGzip();
  const ws = createWriteStream(file);
  gz.pipe(ws);
  const done = new Promise((res, rej) => { ws.on('finish', res); ws.on('error', rej); gz.on('error', rej); });
  done.catch(() => {});
  gz.write(csvLine(BOL_COLUMNS));
  return { write: row => gz.write(csvLine(BOL_COLUMNS.map(c => row[c]))), close: () => { gz.end(); return done; } };
}

// The jobs of a download: jobsOf (src/lib/bol-catalog.js), or standardJobs (src/lib/bol-lists.js) for --standard.
export async function download({ api, jobs, country = 'NL', out, max = MAX_PER_CATEGORY, pageSize = PAGE_SIZE, pauseMs = PAUSE_MS, stamp = new Date().toISOString(), oldStamp = '' }) {
  const seen = new Set();
  const results = [];
  for (const job of jobs) {
    const R = { ...job, ok: false, pages: 0, written: 0, left: {}, total: 0, prices: [], samples: [], name: '' };
    const part = join(out, `${job.file}.csv.gz.part`);
    const w = openRows(part);
    try {
      for (let page = 1; R.written + Object.values(R.left).reduce((a, b) => a + b, 0) < max; page++) {
        const req = pageRequest(job, page, { country, pageSize });
        const res = await api.get(req.path, req.params);
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
        // The end is the last page bol.com names (or an empty page): lastPage (src/lib/bol-catalog.js).
        if (lastPage(b, page, list.length, pageSize)) break;
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
      // --standard: the 12 categories and 2 searches of src/lib/bol-lists.js, the same lists the Worker refreshes (L205).
      const standard = args.includes('--standard');
      const categories = list('categories');
      const searches = list('search').filter(x => x.length <= 60);
      const searchCategory = /^\d{1,12}$/.test(val('search-category')) ? val('search-category') : '';
      const max = Math.min(10000, Math.max(1, Number(val('max')) || (standard ? BOL_MAX_PER_LIST : MAX_PER_CATEGORY)));
      const jobs = standard ? standardJobs(country) : jobsOf({ categories, searches, searchCategory, country });
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
