// gear-world-bol-refresh: the private Worker that keeps the price and stock of the bol.com products ON the Gear World
// sites fresh (bol.com's terms, 3.6: prices refreshed at least daily; Manager 20 Nov 2026, lessons L205). It copies the
// safety pattern of the network sync (private Worker, cron only, a run row per run, its code version in a meta table).
//
// What it does, and only this:
//  - It NEVER inserts a product. It only changes bol.com rows that are already on the 10 sites (retailer 'bol.com'):
//    price, stock and the "checked" date, hides a row (is_active = 0), and shows again a row that it hid itself.
//    Every UPDATE says AND retailer = 'bol.com'. After the removal tool has deleted the bol.com rows it finds nothing to do.
//  - Twice a day (a "cycle" from 04:00 and from 16:00 UTC, BOL_CYCLE_HOURS) it re-reads the standard lists of
//    src/lib/bol-lists.js (12 popular-category lists + 2 searches, pages of 50, at most 1,000 each: the same as the PC
//    download) and refreshes every row whose EAN is in them; the rows it did not find are looked up one by one by EAN
//    (/products/{ean}?include-offer). With fewer EANs than list pages (280) it skips the lists and only looks up.
//  - Each invocation keeps to a budget (BOL_MAX_CALLS calls, BOL_MAX_SECONDS seconds): the cron runs every hour at :13,
//    and an invocation goes on where the last one stopped (the cycle's place in the lists is kept in bol_refresh_meta;
//    which rows are still waiting is their own "checked" date, older than the cycle's start).
//  - A row with no current offer (not for sale, unknown EAN 404, no Dutch content 406) is hidden at once. EVERY run (also
//    with the kill switch off) hides the bol.com rows whose last check is more than 24 hours old: a bol.com price older
//    than a day is never left on a page for more than the hour until the next run (L205).
//  - Kill switch: bol_refresh_meta 'enabled' = '0' (the removal tool sets it). Then no bol.com call, no price change, no
//    row shown again: only the 24-hour hiding above.
//  - bol.com's rules (L154): ONE token per invocation (a new one only when it has run out, at most 3), no new try after
//    401/403/429; the keys go only to login.bol.com and the token only to api.bol.com, no redirect is followed.
//    The keys are the Worker secrets BOL_CATALOG_CLIENT_ID / BOL_CATALOG_CLIENT_SECRET (tools/bol-refresh-setup.ps1);
//    no key or token ever reaches a message, the database or another host.
//  - D1: rows found by retailer (an index on every site: idx_products_retailer, CGW idx_products_retailer_active_ean),
//    writes by id, at most 92 bound values per statement (D1 allows 100, lessons L193), 50 statements per batch, and an
//    UPDATE names only the columns that change (an unchanged column still writes its indexes, L57/L59).
//  - Each invocation writes one row in bol_refresh_runs (gear-world-awin, next to network_sync_runs) for the Manager's
//    stats page and the 07:40 report: ok 1 / 0 / 2 (held), state ok / error / held, counts, and a message without keys.
import { session, ean13, offerPrice, productOf, pageRequest, lastPage, PAGE_SIZE, LOGIN_BASE, API_BASE } from './lib/bol-catalog.js';
import { BOL_RETAILER, BOL_COUNTRY, BOL_LANGUAGE, BOL_MAX_PER_LIST, standardJobs } from './lib/bol-lists.js';
import { IN_STOCK_WORDS } from './db.js';

export const WORKER_NAME = 'gear-world-bol-refresh';
// The 10 sites with bol.com products (Manager 20 Nov 2026): the 6 older-layout sites keep their own columns (src/db.js:
// updated_at, stock_status text, ean or specs_json gtin), the 4 new-layout sites have last_seen_at, in_stock, gtin.
// The bindings are made at deploy time by tools/bol-refresh-setup.ps1 (sites/bol-refresh/wrangler.jsonc.example).
export const BOL_SITES = [
  { code: 'cgw', binding: 'DB_CGW', database: 'construction-gear-customers', layout: 'legacy' },
  { code: 'hgw', binding: 'DB_HGW', database: 'home-gear-world', layout: 'legacy' },
  { code: 'ggw', binding: 'DB_GGW', database: 'garden-gear-world', layout: 'legacy' },
  { code: 'wgw', binding: 'DB_WGW', database: 'womens-gear-world', layout: 'legacy' },
  { code: 'mgw', binding: 'DB_MGW', database: 'mens-gear-world', layout: 'legacy' },
  { code: 'kgw', binding: 'DB_KGW', database: 'kids-gear-world', layout: 'legacy' },
  { code: 'agw', binding: 'DB_AGW', database: 'car-gear-world', layout: 'native' },
  { code: 'sgw', binding: 'DB_SGW', database: 'sporty-gear-world', layout: 'native' },
  { code: 'vgw', binding: 'DB_VGW', database: 'travel-gear-world', layout: 'native' },
  { code: 'zgw', binding: 'DB_ZGW', database: 'pets-gear-world', layout: 'native' }
];
export const SECRETS = ['BOL_CATALOG_CLIENT_ID', 'BOL_CATALOG_CLIENT_SECRET'];
export const BOL_HOSTS = ['login.bol.com', 'api.bol.com'];
export const MAX_AGE_HOURS = 24;
// A row this Worker hid is looked up again (to show it when bol.com sells it again) for this many days, then left hidden.
export const RESHOW_DAYS = 14;
export const KEEP_RUNS = 1000;
export const STATEMENTS_PER_BATCH = 50;
export const IDS_PER_STATEMENT = 90;
export const MAX_FAILED_KEPT = 1000;
export const DEFAULTS = { maxCalls: 800, maxSeconds: 480, pauseMs: 250, cycleHours: [4, 16] };
// The list pages of a full read (14 lists x 20 pages): with fewer EANs to check, looking them up one by one is cheaper.
export const LIST_PAGES = standardJobs().length * Math.ceil(BOL_MAX_PER_LIST / PAGE_SIZE);
const HOUR = 36e5;
const DAY = 864e5;

// The "checked" date as the import tools write it: 'YYYY-MM-DD HH:MM:SS' (UTC).
export const stamp = d => d.toISOString().replace('T', ' ').slice(0, 19);
// Any date the sites hold ('2026-11-20 04:13:00', ISO with T/Z, a day only) as milliseconds; NaN when there is none.
export function parseStamp(v) {
  const s = String(v ?? '').trim();
  if (!s) return NaN;
  let t = s.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) t += 'T00:00:00';
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(t)) t += 'Z';
  return Date.parse(t);
}

export function settingsOf(env) {
  const int = (name, def, lo, hi) => { const raw = env && env[name]; const n = Number(raw); return raw !== undefined && raw !== '' && Number.isFinite(n) && n >= lo && n <= hi ? Math.floor(n) : def; };
  const hours = String((env && env.BOL_CYCLE_HOURS) || '').split(/[,\s]+/).filter(x => /^\d{1,2}$/.test(x)).map(Number).filter(h => h <= 23);
  return {
    maxCalls: int('BOL_MAX_CALLS', DEFAULTS.maxCalls, 1, 5000),
    maxSeconds: int('BOL_MAX_SECONDS', DEFAULTS.maxSeconds, 10, 840),
    pauseMs: int('BOL_PAUSE_MS', DEFAULTS.pauseMs, 0, 5000),
    cycleHours: hours.length ? [...new Set(hours)].sort((a, b) => a - b) : DEFAULTS.cycleHours
  };
}

// The start of the cycle that `now` belongs to: the latest of the cycle hours (UTC) at or before now.
export function slotOf(now, hours = DEFAULTS.cycleHours) {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let best = null;
  for (const back of [0, 1]) for (const h of hours) {
    const t = day - back * DAY + h * HOUR;
    if (t <= now.getTime() && (best === null || t > best)) best = t;
  }
  return new Date(best).toISOString();
}

const IN_STOCK = new Set(IN_STOCK_WORDS);
export const LAYOUTS = {
  legacy: {
    select: `SELECT id, COALESCE(NULLIF(TRIM(ean), ''), CASE WHEN json_valid(specs_json) THEN json_extract(specs_json, '$.gtin') END) AS ean,
      price, currency, stock_status AS stock, updated_at AS fresh, is_active FROM products WHERE retailer = ?`,
    fresh: 'updated_at',
    inStock: v => IN_STOCK.has(String(v ?? '').trim().toLowerCase()),
    stockSet: "stock_status = 'in stock'",
    priceExtra: ''
  },
  native: {
    // is_active IN (0, 1) lets SQLite use idx_products_retailer (is_active, retailer).
    select: `SELECT id, gtin AS ean, price, currency, in_stock AS stock, last_seen_at AS fresh, is_active FROM products
      WHERE is_active IN (0, 1) AND retailer = ?`,
    fresh: 'last_seen_at',
    inStock: v => Number(v) === 1,
    stockSet: 'in_stock = 1',
    priceExtra: 'updated_at'
  }
};

// Hides keys and tokens in any text (values under 6 characters are left alone: they would hide ordinary words).
function maskOf(values) {
  return s => {
    let t = String(s ?? '');
    for (const v of values) if (v && String(v).length >= 6) t = t.split(String(v)).join('[secret]');
    return t.replace(/((?:Bearer|Basic)\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[secret]');
  };
}

const value = (env, name) => String((env && env[name]) || '').trim();
const chunks = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };

export async function getMeta(db, key) {
  const r = await db.prepare('SELECT value FROM bol_refresh_meta WHERE key = ?').bind(key).first();
  return r && r.value !== undefined && r.value !== null ? String(r.value) : null;
}
export async function setMeta(db, key, val, nowIso) {
  await db.prepare(`INSERT INTO bol_refresh_meta (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).bind(key, String(val), nowIso).run();
}

async function batchAll(db, statements) {
  for (const part of chunks(statements, STATEMENTS_PER_BATCH)) await db.batch(part);
}

// One invocation. Never throws: the result (also written to bol_refresh_runs) says what happened.
// now: a clock (tests pass their own); sleepFn: the pause between calls (tests pass one that does not wait).
export async function refreshRun(env, { fetchFn = fetch, now = () => new Date(), sleepFn, sites = BOL_SITES } = {}) {
  const t0 = now();
  const startMs = t0.getTime();
  const nowIso = t0.toISOString();
  const st = stamp(t0);
  const set = settingsOf(env);
  const sleep = sleepFn || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const run = { ran_at: nowIso, ok: 0, state: 'error', calls: 0, tokens: 0, found: 0, updated: 0, hidden: 0, reshown: 0, lookups: 0,
    rows_total: 0, pending: 0, cycle_at: null, message: '' };
  const errors = [];
  const notes = [];
  const secretValues = SECRETS.map(n => value(env, n)).filter(Boolean);
  const db = env && env.SALES_DB;

  // ---- the kill switch, the cycle and the code version (gear-world-awin) ----
  let metaOk = Boolean(db);
  let enabled = true;
  let cycle = null;
  if (!db) errors.push('no database binding SALES_DB');
  else {
    try {
      const e = await getMeta(db, 'enabled');
      enabled = e === null ? true : e.trim() !== '0';
      const c = await getMeta(db, 'cycle');
      if (c) { try { cycle = JSON.parse(c); } catch { cycle = null; } }
    } catch (e) { metaOk = false; errors.push(`bol_refresh_meta not readable (${String(e && e.message || e).slice(0, 80)}): no bol.com call, only the 24-hour hiding`); }
    // The code version this Worker runs (deploy --var GW_COMMIT:<commit>), for the setup tool's live-version guard (L156).
    const commit = value(env, 'GW_COMMIT');
    if (metaOk && /^[0-9a-f]{40}$/.test(commit)) { try { await setMeta(db, 'commit', commit, nowIso); } catch { /* the run goes on */ } }
  }

  // ---- the bol.com rows on the sites, and the rows this Worker hid ----
  const rows = [];
  const okSites = new Set();
  for (const s of sites) {
    const sdb = env && env[s.binding];
    if (!sdb) { errors.push(`${s.code}: no database binding ${s.binding}`); continue; }
    try {
      const r = await sdb.prepare(LAYOUTS[s.layout].select).bind(BOL_RETAILER).all();
      for (const x of (r && r.results) || []) {
        rows.push({ site: s, key: `${s.code}:${x.id}`, id: Number(x.id), ean: ean13(x.ean), price: Number(x.price), currency: x.currency,
          stock: x.stock, freshMs: parseStamp(x.fresh), active: Number(x.is_active) === 1 });
      }
      okSites.add(s.code);
    } catch (e) { errors.push(`${s.code}: rows not readable (${String(e && e.message || e).slice(0, 80)})`); }
  }
  const hiddenByUs = new Map();
  if (metaOk) {
    try {
      const h = await db.prepare('SELECT site, product_id, hidden_at, checked_at FROM bol_refresh_hidden').all();
      for (const x of (h && h.results) || []) hiddenByUs.set(`${x.site}:${x.product_id}`, { hiddenMs: parseStamp(x.hidden_at), checkedMs: parseStamp(x.checked_at) });
    } catch (e) { errors.push(`bol_refresh_hidden not readable (${String(e && e.message || e).slice(0, 80)})`); }
  }
  const byKey = new Map(rows.map(r => [r.key, r]));
  // A row we hid is a candidate again for RESHOW_DAYS; entries of rows that are gone, shown again by someone else, or
  // older than that are dropped from the list (the row itself stays as it is).
  const prune = new Set();
  for (const [key, h] of hiddenByUs) {
    const site = key.split(':')[0];
    if (!okSites.has(site)) continue;
    const r = byKey.get(key);
    if (!r || r.active || !(h.hiddenMs >= startMs - RESHOW_DAYS * DAY)) prune.add(key);
  }
  const candidates = rows.filter(r => r.active || (hiddenByUs.has(r.key) && !prune.has(r.key)));
  // When a row was last checked: an active row by its own date; a row we hid also by its last check while hidden (so it
  // is looked up once per cycle, not every hour).
  for (const r of rows) {
    const h = hiddenByUs.get(r.key);
    r.checkedMs = r.active || !h ? r.freshMs : Math.max(Number.isFinite(r.freshMs) ? r.freshMs : 0, Number.isFinite(h.checkedMs) ? h.checkedMs : 0, Number.isFinite(h.hiddenMs) ? h.hiddenMs : 0);
  }
  run.rows_total = candidates.length;
  const noEan = candidates.filter(r => !r.ean).length;
  if (noEan) notes.push(`${noEan} without an EAN (hidden after 24 h)`);

  // ---- writing: the results of this invocation, site by site ----
  const results = new Map(); // row key -> { price } (a current offer) or { hide: reason }
  let otherCurrency = 0;
  async function flush() {
    const bySite = new Map();
    for (const [key, res] of results) {
      const row = byKey.get(key);
      if (!row) continue;
      if (!bySite.has(row.site.code)) bySite.set(row.site.code, []);
      bySite.get(row.site.code).push([row, res]);
    }
    results.clear();
    for (const [code, list] of bySite) {
      const s = list[0][0].site;
      const L = LAYOUTS[s.layout];
      const sdb = env[s.binding];
      const touch = [], hide = [], statements = [], reshow = [], changed = [], stillHidden = [];
      for (const [row, res] of list) {
        if (res.hide) { if (row.active) hide.push([row, res.hide]); else stillHidden.push(row); continue; }
        // bol.com sells in euros: a row in another currency is left as it is (and hidden after 24 hours).
        if (row.currency && String(row.currency).toUpperCase() !== 'EUR') { otherCurrency++; continue; }
        const priceChanged = !(Math.abs(row.price - res.price) < 0.005);
        const stockOk = L.inStock(row.stock);
        const back = !row.active;
        if (!priceChanged && stockOk && !back) { touch.push(row); continue; }
        const sets = [], binds = [];
        if (priceChanged) { sets.push('price = ?'); binds.push(res.price); if (L.priceExtra) { sets.push(`${L.priceExtra} = ?`); binds.push(st); } }
        if (!stockOk) sets.push(L.stockSet);
        if (back) sets.push('is_active = 1');
        sets.push(`${L.fresh} = ?`);
        binds.push(st);
        statements.push(sdb.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ? AND retailer = ?${back ? ' AND is_active = 0' : ''}`).bind(...binds, row.id, BOL_RETAILER));
        changed.push([row, res, priceChanged || !stockOk, back]);
      }
      for (const part of chunks(touch, IDS_PER_STATEMENT)) {
        statements.push(sdb.prepare(`UPDATE products SET ${L.fresh} = ? WHERE retailer = ? AND id IN (${part.map(() => '?').join(', ')})`).bind(st, BOL_RETAILER, ...part.map(r => r.id)));
      }
      // The rows to hide go into bol_refresh_hidden FIRST, so a row hidden here can always be shown again later.
      if (hide.length && metaOk) {
        try {
          await batchAll(db, hide.map(([r, why]) => db.prepare(`INSERT INTO bol_refresh_hidden (site, product_id, ean, reason, hidden_at, checked_at) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (site, product_id) DO UPDATE SET ean = excluded.ean, reason = excluded.reason, hidden_at = excluded.hidden_at, checked_at = excluded.checked_at`).bind(code, r.id, r.ean || null, why, nowIso, nowIso)));
        } catch (e) { errors.push(`bol_refresh_hidden not written (${String(e && e.message || e).slice(0, 80)})`); }
      }
      for (const part of chunks(hide, IDS_PER_STATEMENT)) {
        statements.push(sdb.prepare(`UPDATE products SET is_active = 0 WHERE retailer = ? AND is_active = 1 AND id IN (${part.map(() => '?').join(', ')})`).bind(BOL_RETAILER, ...part.map(([r]) => r.id)));
      }
      try {
        await batchAll(sdb, statements);
      } catch (e) { errors.push(`${code}: not written (${String(e && e.message || e).slice(0, 80)})`); continue; }
      const freshNow = t0.getTime();
      for (const r of touch) { r.freshMs = freshNow; run.found++; }
      for (const [r, res, upd, back] of changed) {
        r.freshMs = freshNow; r.price = res.price; r.stock = s.layout === 'legacy' ? 'in stock' : 1; run.found++;
        if (upd) run.updated++;
        if (back) { r.active = true; run.reshown++; reshow.push(r); }
      }
      for (const [r] of hide) { r.active = false; r.checkedMs = freshNow; run.hidden++; }
      // A row we hid, checked again and still without an offer: its check date, so it waits for the next cycle.
      if (stillHidden.length && metaOk) {
        try {
          await batchAll(db, chunks(stillHidden, IDS_PER_STATEMENT).map(part => db.prepare(`UPDATE bol_refresh_hidden SET checked_at = ? WHERE site = ? AND product_id IN (${part.map(() => '?').join(', ')})`).bind(nowIso, code, ...part.map(r => r.id))));
          for (const r of stillHidden) r.checkedMs = freshNow;
        } catch { /* looked up again next run */ }
      }
      if (reshow.length && metaOk) {
        try {
          await batchAll(db, chunks(reshow, IDS_PER_STATEMENT).map(part => db.prepare(`DELETE FROM bol_refresh_hidden WHERE site = ? AND product_id IN (${part.map(() => '?').join(', ')})`).bind(code, ...part.map(r => r.id))));
        } catch { /* a stale entry is dropped by the next run */ }
      }
    }
  }

  // ---- the refresh (only with the switch on, the meta readable and the keys there) ----
  let refreshing = enabled && metaOk;
  const missing = SECRETS.filter(n => !value(env, n));
  if (refreshing && missing.length) { errors.push(`missing secret(s): ${missing.join(', ')}`); refreshing = false; }
  if (!enabled) notes.push('kill switch off (bol_refresh_meta enabled = 0): no bol.com call, only the 24-hour hiding');
  let api = null;
  if (refreshing) {
    const slot = slotOf(t0, set.cycleHours);
    if (!cycle || cycle.id !== slot) cycle = { id: slot, started: nowIso, job: 0, page: 1, listsDone: false, failed: [], done: false };
    if (!Array.isArray(cycle.failed)) cycle.failed = [];
    run.cycle_at = cycle.started;
    const cycleMs = Date.parse(cycle.started);
    const failed = new Set(cycle.failed);
    const due = new Map(); // EAN -> rows not checked yet in this cycle
    for (const r of candidates) {
      if (!r.ean || failed.has(r.ean) || r.checkedMs >= cycleMs) continue;
      if (!due.has(r.ean)) due.set(r.ean, []);
      due.get(r.ean).push(r);
    }
    const jobs = standardJobs(BOL_COUNTRY);
    if (!cycle.listsDone && cycle.job === 0 && cycle.page === 1 && due.size <= LIST_PAGES) {
      cycle.listsDone = true;
      if (due.size) notes.push(`${due.size} EANs: looked up one by one (fewer than the ${LIST_PAGES} list pages)`);
    }
    const saveCycle = async () => { try { await setMeta(db, 'cycle', JSON.stringify({ ...cycle, failed: cycle.failed.slice(-MAX_FAILED_KEPT) }), nowIso); } catch (e) { errors.push(`cycle not saved (${String(e && e.message || e).slice(0, 60)})`); } };
    const mark = (ean, price, why) => {
      const list = due.get(ean);
      if (!list) return;
      due.delete(ean);
      for (const r of list) results.set(r.key, price > 0 ? { price } : { hide: why || 'no offer on bol.com now' });
    };
    if (due.size) {
      // Only bol.com's own hosts, never a redirect (session sets redirect: 'manual'; a 3xx is not 200 and is not followed).
      const guarded = async (url, init) => {
        let host = '';
        try { host = new URL(url).hostname; } catch { /* bad address */ }
        if (!BOL_HOSTS.includes(host)) throw Object.assign(new Error(`refused: ${host || 'a bad address'} is not a bol.com address`), { code: 2 });
        return fetchFn(url, init);
      };
      api = session({ id: value(env, 'BOL_CATALOG_CLIENT_ID'), secret: value(env, 'BOL_CATALOG_CLIENT_SECRET'), loginBase: LOGIN_BASE, apiBase: API_BASE,
        fetchImpl: guarded, now: () => now().getTime(), language: BOL_LANGUAGE, userAgent: 'GearWorld-bol-refresh/1.0 (+https://gearworldgroup.com)' });
      const can = () => api.stats.calls < set.maxCalls && now().getTime() - startMs < set.maxSeconds * 1000;
      const pause = async () => { if (set.pauseMs && api.stats.calls > 0) await sleep(set.pauseMs); };
      let stopped = '';
      try {
        // 1. the lists, from where the cycle stopped
        while (!cycle.listsDone && due.size) {
          if (cycle.job >= jobs.length) { cycle.listsDone = true; break; }
          if (!can()) { stopped = 'budget'; break; }
          const job = jobs[cycle.job];
          const req = pageRequest(job, cycle.page, { country: BOL_COUNTRY, image: false, rating: false, categories: false });
          await pause();
          const res = await api.get(req.path, req.params);
          let end = false;
          if (res.status === 200) {
            const list = Array.isArray(res.body && res.body.results) ? res.body.results : [];
            for (const p of list) { const e = ean13(p && p.ean); if (e) mark(e, offerPrice(p), 'no offer on bol.com now (list)'); }
            end = lastPage(res.body, cycle.page, list.length) || cycle.page * PAGE_SIZE >= BOL_MAX_PER_LIST;
          } else {
            end = true;
            if (res.status !== 404) notes.push(`${job.kind === 'search' ? `search ${job.term}` : `list ${job.categoryId}`} page ${cycle.page}: HTTP ${res.status}`);
          }
          if (end) { cycle.job++; cycle.page = 1; await flush(); await saveCycle(); } else cycle.page++;
        }
        // The lists are done at their end, or as soon as every EAN of the cycle was found in them.
        if (cycle.job >= jobs.length || !due.size) cycle.listsDone = true;
        // 2. the rest one by one, the oldest check first
        if (cycle.listsDone && !stopped) {
          const order = [...due.entries()].map(([e, list]) => [e, Math.min(...list.map(r => (Number.isFinite(r.freshMs) ? r.freshMs : 0)))]).sort((a, b) => a[1] - b[1]);
          let failedNow = 0;
          for (const [e] of order) {
            if (!can()) { stopped = 'budget'; break; }
            await pause();
            const res = await api.get(`/products/${e}`, { 'country-code': BOL_COUNTRY, 'include-offer': 'true' });
            run.lookups++;
            if (res.status === 200) {
              const p = productOf(res.body);
              mark(e, offerPrice(p), 'no offer on bol.com now');
            } else if (res.status === 404) mark(e, 0, 'not on bol.com (404)');
            else if (res.status === 406) mark(e, 0, 'no Dutch content on bol.com (406)');
            else { due.delete(e); cycle.failed.push(e); failedNow++; }
            if (results.size >= 400) await flush();
          }
          if (failedNow) notes.push(`${failedNow} lookups failed (tried again next cycle)`);
        }
      } catch (e) {
        if (e && e.tokenCap) stopped = 'budget';
        else errors.push(String(e && e.message || e));
      }
      await flush();
      if (stopped) notes.push('call or time budget used: the next run at :13 goes on');
    }
    run.pending = [...due.values()].reduce((a, list) => a + list.length, 0);
    if (cycle.listsDone && !run.pending) { if (!cycle.done) cycle.doneAt = nowIso; cycle.done = true; }
    await saveCycle();
    if (!candidates.length) notes.push('no bol.com products on the sites: nothing to refresh');
  }

  // ---- every run: hide what was not checked for 24 hours (also with the switch off) ----
  const oldest = startMs - MAX_AGE_HOURS * HOUR;
  for (const r of candidates) if (r.active && !(r.freshMs >= oldest)) results.set(r.key, { hide: 'not checked for 24 hours' });
  await flush();
  if (otherCurrency) notes.push(`${otherCurrency} rows not in EUR: not changed`);
  if (prune.size && metaOk) {
    try {
      const bySite = new Map();
      for (const k of prune) { const [site, id] = k.split(':'); if (!bySite.has(site)) bySite.set(site, []); bySite.get(site).push(Number(id)); }
      const del = [];
      for (const [site, ids] of bySite) for (const part of chunks(ids, IDS_PER_STATEMENT)) del.push(db.prepare(`DELETE FROM bol_refresh_hidden WHERE site = ? AND product_id IN (${part.map(() => '?').join(', ')})`).bind(site, ...part));
      await batchAll(db, del);
    } catch { /* tried again next run */ }
  }

  // ---- the run row ----
  if (api) { run.calls = api.stats.calls; run.tokens = api.stats.tokens; if (api.stats.token) secretValues.push(api.stats.token); }
  const mask = maskOf(secretValues);
  run.state = errors.length ? 'error' : (enabled ? 'ok' : 'held');
  run.ok = run.state === 'ok' ? 1 : (run.state === 'held' ? 2 : 0);
  const cyc = refreshing && cycle ? `cycle ${cycle.id.slice(0, 13)}h: ${cycle.listsDone ? 'lists read' : `list ${Math.min(cycle.job + 1, standardJobs().length)} of ${standardJobs().length}`}, ${cycle.done ? 'done' : `${run.pending} waiting`}` : '';
  run.message = mask([...errors, cyc, ...notes].filter(Boolean).join('; ')).slice(0, 300);
  if (metaOk) {
    try {
      await db.prepare(`INSERT INTO bol_refresh_runs (ran_at, ok, state, calls, tokens, found, updated, hidden, reshown, lookups, rows_total, pending, cycle_at, message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(run.ran_at, run.ok, run.state, run.calls, run.tokens, run.found, run.updated, run.hidden,
        run.reshown, run.lookups, run.rows_total, run.pending, run.cycle_at, run.message || null).run();
      await db.prepare('DELETE FROM bol_refresh_runs WHERE id NOT IN (SELECT id FROM bol_refresh_runs ORDER BY id DESC LIMIT ?)').bind(KEEP_RUNS).run();
    } catch { /* the result is still returned */ }
  }
  return run;
}

export function createBolRefresh({ fetchFn } = {}) {
  return {
    async scheduled(event, env, ctx) {
      ctx.waitUntil(refreshRun(env, { fetchFn: fetchFn || fetch }));
    },
    // No public address; anything that reaches it anyway gets nothing.
    async fetch() {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
