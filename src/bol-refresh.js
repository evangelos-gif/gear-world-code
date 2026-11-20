// gear-world-bol-refresh: the private Worker that keeps the price and stock of the bol.com products ON the Gear World
// sites fresh (bol.com's terms, 3.6: prices refreshed at least daily; Manager 20 Nov 2026, lessons L205). It copies the
// safety pattern of the network sync (private Worker, cron only, a run row per run, its code version in a meta table).
//
// What it does, and only this:
//  - It NEVER inserts a product. It only changes bol.com rows that are already on the 10 sites (retailer 'bol.com'):
//    price, stock, hiding (is_active = 0), showing again a row that it hid itself. Every UPDATE says
//    AND retailer = 'bol.com' and names only the columns that change; a row whose price, stock and visibility stay the
//    same is NOT written (on HGW, GGW, WGW, MGW and KGW every UPDATE also rewrites the search index, L59). The site's
//    own date (updated_at / last_seen_at) is set with a change, or when it is older than SITE_DATE_DAYS (the sites hide a
//    product after 30 days and say "check at the retailer" after 14, L107). It never changes a row's currency.
//  - Freshness is the Worker's OWN record (bol_refresh_checked in gear-world-awin: site, row id, checked_at), never the
//    sites' dates, which other tools write too (imports, clean-ups). A row the Worker has never checked is due at once.
//  - Twice a day (a "cycle" from 04:00 and from 16:00 UTC, BOL_CYCLE_HOURS) it re-reads the standard lists of
//    src/lib/bol-lists.js (12 popular-category lists + 2 searches, pages of 50, at most 1,000 each: the same as the PC
//    download) and refreshes every row whose EAN is in them; the rows it did not find are looked up one by one by EAN
//    (/products/{ean}?include-offer). With fewer EANs than list pages (280) it skips the lists and only looks up.
//  - Each invocation keeps to a budget (BOL_MAX_CALLS calls, BOL_MAX_SECONDS seconds): the cron runs every hour at :13,
//    and an invocation goes on where the last one stopped (the cycle's place in the lists is kept in bol_refresh_meta;
//    a row is due when the Worker's own check of it is older than the cycle's slot).
//  - A row with no current offer (not for sale, unknown EAN 404, no Dutch content 406) is hidden at once. EVERY run (also
//    with the kill switch off) hides the bol.com rows the Worker has not checked for 24 hours (a row it never checked:
//    24 hours after it first saw it): a bol.com price older than a day is never left on a page for more than the hour
//    until the next run.
//  - Kill switch: bol_refresh_meta 'enabled' = '0' (the removal tool sets it as its first step; -Step disable too). Then
//    no bol.com call, no price change, no row shown again: only the 24-hour hiding above. The Worker turns it off ITSELF
//    when bol.com answers 401 or 403 (keys refused, or blocked), so it does not ask again every hour; only
//    tools/bol-refresh-setup.ps1 -Step enable turns it on again.
//  - bol.com's rules (L154): ONE token per invocation (a new one only when it has run out, at most 3); 401, 403 and 429
//    from either host stop the run at once, with no new try. The keys go only to login.bol.com and the token only to
//    api.bol.com, no redirect is followed. The keys are the Worker secrets BOL_CATALOG_CLIENT_ID /
//    BOL_CATALOG_CLIENT_SECRET (tools/bol-refresh-setup.ps1); no key or token ever reaches a message or a database.
//  - Showing again: only a row THIS Worker hid, within RESHOW_DAYS, and only when the row is unchanged since (a
//    fingerprint of category, subcategory, name and the date it was made, kept when it was hidden).
//  - D1: rows found by retailer (an index on every site: idx_products_retailer, CGW idx_products_retailer_active_ean),
//    writes by id, at most 92 bound values per statement (D1 allows 100, lessons L193), 50 statements per batch.
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
export const RESHOW_DAYS = 3;
// The site's own date is written with a change, or when it is older than this (the sites' 14/30-day rules, L107).
export const SITE_DATE_DAYS = 7;
export const KEEP_RUNS = 1000;
export const STATEMENTS_PER_BATCH = 50;
export const IDS_PER_STATEMENT = 90;
export const ROWS_PER_UPSERT = 45;
export const MAX_FAILED_KEPT = 1000;
export const DEFAULTS = { maxCalls: 800, maxSeconds: 480, pauseMs: 250, cycleHours: [4, 16] };
// The list pages of a full read (14 lists x 20 pages): with fewer EANs to check, looking them up one by one is cheaper.
export const LIST_PAGES = standardJobs().length * Math.ceil(BOL_MAX_PER_LIST / PAGE_SIZE);
const HOUR = 36e5;
const DAY = 864e5;

// The dates the Worker writes: 'YYYY-MM-DD HH:MM:SS' (UTC), whole seconds, as the import tools write them.
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

// The start of the cycle that `now` belongs to: the latest of the cycle hours (UTC) at or before now, on the hour.
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
      price, currency, stock_status AS stock, updated_at AS fresh, is_active, site_category AS cat, subcategory AS sub,
      product_name AS name, created_at AS made FROM products WHERE retailer = ?`,
    fresh: 'updated_at',
    inStock: v => IN_STOCK.has(String(v ?? '').trim().toLowerCase()),
    stockSet: "stock_status = 'in stock'",
    stockValue: 'in stock',
    priceExtra: ''
  },
  native: {
    // is_active IN (0, 1) lets SQLite use idx_products_retailer (is_active, retailer).
    select: `SELECT id, gtin AS ean, price, currency, in_stock AS stock, last_seen_at AS fresh, is_active, category_slug AS cat,
      subcategory AS sub, product_name AS name, first_seen_at AS made FROM products WHERE is_active IN (0, 1) AND retailer = ?`,
    fresh: 'last_seen_at',
    inStock: v => Number(v) === 1,
    stockSet: 'in_stock = 1',
    stockValue: 1,
    priceExtra: 'updated_at'
  }
};
// bol.com sells in euros. An empty currency on an older-layout row means GBP there (src/db.js), so only an explicit EUR
// row is refreshed; the Worker never changes a currency.
export const isEur = r => String(r.currency ?? '').trim().toUpperCase() === 'EUR';

// The fingerprint of a row when it is hidden: if any of these change, the row is never shown again by the Worker.
export async function snapOf(r) {
  const text = [r.cat, r.sub, r.name, r.made].map(v => String(v ?? '')).join('\u001f');
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
const short = e => String(e && e.message || e).slice(0, 80);
const marks = (n, from = 1) => Array.from({ length: n }, (_, i) => `?${i + from}`).join(', ');

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

// Upserts of the Worker's own check record: ?1 site, ?2 the time, then (row id, EAN) pairs (2 + 2 x 45 = 92 values).
function checkedStatements(db, code, rows, at, { firstSeenOnly = false } = {}) {
  return chunks(rows, ROWS_PER_UPSERT).map(part => {
    const vals = part.map((_, i) => `(?1, ?${3 + 2 * i}, ?${4 + 2 * i}, ${firstSeenOnly ? 'NULL' : '?2'}, ?2)`).join(', ');
    const tail = firstSeenOnly ? 'ON CONFLICT (site, product_id) DO NOTHING' : 'ON CONFLICT (site, product_id) DO UPDATE SET ean = excluded.ean, checked_at = excluded.checked_at';
    return db.prepare(`INSERT INTO bol_refresh_checked (site, product_id, ean, checked_at, first_seen_at) VALUES ${vals} ${tail}`)
      .bind(code, at, ...part.flatMap(r => [r.id, r.ean || null]));
  });
}
function deleteStatements(db, table, code, ids) {
  return chunks(ids, IDS_PER_STATEMENT).map(part => db.prepare(`DELETE FROM ${table} WHERE site = ?1 AND product_id IN (${marks(part.length, 2)})`).bind(code, ...part));
}

// One invocation. Never throws: the result (also written to bol_refresh_runs) says what happened.
// now: a clock (tests pass their own); sleepFn: the pause between calls (tests pass one that does not wait).
export async function refreshRun(env, { fetchFn = fetch, now = () => new Date(), sleepFn, sites = BOL_SITES } = {}) {
  const t0 = now();
  const startMs = t0.getTime();
  const nowIso = t0.toISOString();
  const st = stamp(t0);
  const stMs = parseStamp(st);
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
    } catch (e) { metaOk = false; errors.push(`bol_refresh_meta not readable (${short(e)}): no bol.com call, only the 24-hour hiding`); }
    // The code version this Worker runs (deploy --var GW_COMMIT:<commit>), for the setup tool's live-version guard (L156).
    const commit = value(env, 'GW_COMMIT');
    if (metaOk && /^[0-9a-f]{40}$/.test(commit)) { try { await setMeta(db, 'commit', commit, nowIso); } catch { /* the run goes on */ } }
  }

  // ---- the bol.com rows on the sites ----
  const rows = [];
  const okSites = new Set();
  for (const s of sites) {
    const sdb = env && env[s.binding];
    if (!sdb) { errors.push(`${s.code}: no database binding ${s.binding}`); continue; }
    try {
      const r = await sdb.prepare(LAYOUTS[s.layout].select).bind(BOL_RETAILER).all();
      for (const x of (r && r.results) || []) {
        rows.push({ site: s, key: `${s.code}:${x.id}`, id: Number(x.id), ean: ean13(x.ean), price: Number(x.price), currency: x.currency,
          stock: x.stock, freshMs: parseStamp(x.fresh), active: Number(x.is_active) === 1, cat: x.cat, sub: x.sub, name: x.name, made: x.made });
      }
      okSites.add(s.code);
    } catch (e) { errors.push(`${s.code}: rows not readable (${short(e)})`); }
  }
  const byKey = new Map(rows.map(r => [r.key, r]));

  // ---- the Worker's own records: when it checked each row, and the rows it hid ----
  let ownOk = metaOk;
  const checked = new Map(); // key -> { checkedMs, firstMs }
  const hiddenByUs = new Map(); // key -> { hiddenMs, snap }
  if (ownOk) {
    try {
      const c = await db.prepare('SELECT site, product_id, checked_at, first_seen_at FROM bol_refresh_checked').all();
      for (const x of (c && c.results) || []) checked.set(`${x.site}:${x.product_id}`, { checkedMs: parseStamp(x.checked_at), firstMs: parseStamp(x.first_seen_at) });
      const h = await db.prepare('SELECT site, product_id, hidden_at, snap FROM bol_refresh_hidden').all();
      for (const x of (h && h.results) || []) hiddenByUs.set(`${x.site}:${x.product_id}`, { hiddenMs: parseStamp(x.hidden_at), snap: x.snap || '' });
    } catch (e) { ownOk = false; errors.push(`own records not readable (${short(e)}): no bol.com call; the 24-hour hiding uses the sites' dates`); }
  }
  // A row we hid is a candidate again only for RESHOW_DAYS and only when it is unchanged; the other entries are dropped
  // (the row itself stays as it is).
  const pruneHidden = new Set();
  let changedSince = 0;
  for (const [key, h] of hiddenByUs) {
    if (!okSites.has(key.split(':')[0])) continue;
    const r = byKey.get(key);
    if (!r || r.active || !(h.hiddenMs >= startMs - RESHOW_DAYS * DAY)) { pruneHidden.add(key); continue; }
    if (!h.snap || h.snap !== await snapOf(r)) { pruneHidden.add(key); changedSince++; }
  }
  if (changedSince) notes.push(`${changedSince} hidden rows changed since: not shown again`);
  const candidates = rows.filter(r => r.active || (hiddenByUs.has(r.key) && !pruneHidden.has(r.key)));
  const isCandidate = new Set(candidates.map(r => r.key));
  for (const r of rows) {
    const c = checked.get(r.key);
    r.checkedMs = c ? c.checkedMs : NaN;
    r.firstMs = c ? c.firstMs : NaN;
    r.known = Boolean(c);
  }
  run.rows_total = candidates.length;
  const noEan = candidates.filter(r => !r.ean).length;
  if (noEan) notes.push(`${noEan} without an EAN (hidden after 24 h)`);
  const notEur = candidates.filter(r => r.ean && !isEur(r)).length;
  if (notEur) notes.push(`${notEur} not in EUR: never refreshed (hidden after 24 h)`);

  // ---- writing: the results of this invocation, site by site ----
  // row key -> { offer: price } (checked, for sale), { gone: why } (checked, not for sale) or { stale: why } (not checked)
  const results = new Map();
  const siteDateOld = r => !(r.freshMs >= startMs - SITE_DATE_DAYS * DAY);
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
      const statements = [], dateOnly = [], hide = [], checkedNow = [], changed = [];
      for (const [row, res] of list) {
        if (res.stale || res.gone) {
          if (row.active) hide.push([row, res.stale || res.gone]);
          if (res.gone) checkedNow.push(row);
          continue;
        }
        const priceChanged = !(Math.abs(row.price - res.offer) < 0.005);
        const stockOk = L.inStock(row.stock);
        const back = !row.active;
        checkedNow.push(row);
        if (!priceChanged && stockOk && !back) { if (siteDateOld(row)) dateOnly.push(row); continue; }
        const sets = [], binds = [];
        if (priceChanged) { sets.push('price = ?'); binds.push(res.offer); if (L.priceExtra) { sets.push(`${L.priceExtra} = ?`); binds.push(st); } }
        if (!stockOk) sets.push(L.stockSet);
        if (back) sets.push('is_active = 1');
        sets.push(`${L.fresh} = ?`);
        binds.push(st);
        statements.push(sdb.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ? AND retailer = ?${back ? ' AND is_active = 0' : ''}`).bind(...binds, row.id, BOL_RETAILER));
        changed.push([row, res, priceChanged || !stockOk, back]);
      }
      for (const part of chunks(dateOnly, IDS_PER_STATEMENT)) {
        statements.push(sdb.prepare(`UPDATE products SET ${L.fresh} = ?1 WHERE retailer = ?2 AND id IN (${marks(part.length, 3)})`).bind(st, BOL_RETAILER, ...part.map(r => r.id)));
      }
      // The rows to hide go into bol_refresh_hidden FIRST (with their fingerprint), so a row hidden here can be shown again.
      if (hide.length && ownOk) {
        try {
          const ins = [];
          for (const [r, why] of hide) {
            ins.push(db.prepare(`INSERT INTO bol_refresh_hidden (site, product_id, ean, reason, hidden_at, snap) VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (site, product_id) DO UPDATE SET ean = excluded.ean, reason = excluded.reason, hidden_at = excluded.hidden_at, snap = excluded.snap`).bind(code, r.id, r.ean || null, why, nowIso, await snapOf(r)));
          }
          await batchAll(db, ins);
        } catch (e) { errors.push(`bol_refresh_hidden not written (${short(e)})`); }
      }
      for (const part of chunks(hide, IDS_PER_STATEMENT)) {
        statements.push(sdb.prepare(`UPDATE products SET is_active = 0 WHERE retailer = ?1 AND is_active = 1 AND id IN (${marks(part.length, 2)})`).bind(BOL_RETAILER, ...part.map(([r]) => r.id)));
      }
      try {
        await batchAll(sdb, statements);
      } catch (e) { errors.push(`${code}: not written (${short(e)})`); continue; }
      for (const r of dateOnly) r.freshMs = stMs;
      for (const [r, res, upd, back] of changed) {
        r.freshMs = stMs; r.price = res.offer; r.stock = L.stockValue;
        if (upd) run.updated++;
        if (back) { r.active = true; run.reshown++; }
      }
      for (const [r] of hide) { r.active = false; run.hidden++; }
      run.found += list.filter(([, res]) => res.offer !== undefined).length;
      // The Worker's own check record, after the site was written.
      if (checkedNow.length && ownOk) {
        try {
          await batchAll(db, checkedStatements(db, code, checkedNow, st));
          for (const r of checkedNow) { r.checkedMs = stMs; if (!r.known) { r.firstMs = stMs; r.known = true; } }
        } catch (e) { errors.push(`bol_refresh_checked not written (${short(e)})`); }
      }
      const back = changed.filter(x => x[3]).map(x => x[0].id);
      if (back.length && ownOk) { try { await batchAll(db, deleteStatements(db, 'bol_refresh_hidden', code, back)); } catch { /* dropped next run */ } }
    }
  }

  // ---- the refresh (only with the switch on, the records readable and the keys there) ----
  let refreshing = enabled && metaOk && ownOk;
  const missing = SECRETS.filter(n => !value(env, n));
  if (refreshing && missing.length) { errors.push(`missing secret(s): ${missing.join(', ')}`); refreshing = false; }
  if (!enabled) notes.push('kill switch off (bol_refresh_meta enabled = 0): no bol.com call, only the 24-hour hiding');
  let api = null;
  let disabledNow = false;
  if (refreshing) {
    const slot = slotOf(t0, set.cycleHours);
    // The cycle is compared with its SLOT (on the hour, whole seconds), never with the time a run started: a row checked
    // at 04:13:00 (written in whole seconds) is inside the cycle of 04:00 even when the run started at 04:13:00.500.
    const slotMs = Date.parse(slot);
    if (!cycle || cycle.id !== slot) cycle = { id: slot, started: nowIso, job: 0, page: 1, listsDone: false, relisted: false, failed: [], done: false };
    if (!Array.isArray(cycle.failed)) cycle.failed = [];
    run.cycle_at = cycle.started;
    const failed = new Set(cycle.failed);
    const due = new Map(); // EAN -> rows not checked yet in this cycle (a row never checked is always due)
    let dueNew = 0;
    for (const r of candidates) {
      if (!r.ean || !isEur(r) || failed.has(r.ean) || r.checkedMs >= slotMs) continue;
      if (!due.has(r.ean)) { due.set(r.ean, []); if (!r.known || !Number.isFinite(r.checkedMs)) dueNew++; }
      due.get(r.ean).push(r);
    }
    const jobs = standardJobs(BOL_COUNTRY);
    const atStart = !cycle.listsDone && cycle.job === 0 && cycle.page === 1;
    if (atStart && due.size <= LIST_PAGES) {
      cycle.listsDone = true;
      if (due.size) notes.push(`${due.size} EANs: looked up one by one (fewer than the ${LIST_PAGES} list pages)`);
    }
    // Many rows the Worker has never checked (a new import) after the lists of this cycle: read the lists once more.
    if (cycle.listsDone && !cycle.relisted && dueNew > LIST_PAGES) {
      cycle.listsDone = false; cycle.job = 0; cycle.page = 1; cycle.relisted = true; cycle.done = false;
      notes.push(`${dueNew} new EANs: the lists are read again`);
    }
    const saveCycle = async () => { try { await setMeta(db, 'cycle', JSON.stringify({ ...cycle, failed: cycle.failed.slice(-MAX_FAILED_KEPT) }), nowIso); } catch (e) { errors.push(`cycle not saved (${short(e)})`); } };
    const mark = (ean, price, why) => {
      const list = due.get(ean);
      if (!list) return;
      due.delete(ean);
      for (const r of list) results.set(r.key, price > 0 ? { offer: price } : { gone: why || 'no offer on bol.com now' });
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
      const failedCodes = new Map();
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
        // 2. the rest one by one, the oldest check first (never checked first of all)
        if (cycle.listsDone && !stopped) {
          const order = [...due.entries()].map(([e, list]) => [e, Math.min(...list.map(r => (Number.isFinite(r.checkedMs) ? r.checkedMs : 0)))]).sort((a, b) => a[1] - b[1]);
          for (const [e] of order) {
            if (!can()) { stopped = 'budget'; break; }
            await pause();
            const res = await api.get(`/products/${e}`, { 'country-code': BOL_COUNTRY, 'include-offer': 'true' });
            run.lookups++;
            if (res.status === 200) mark(e, offerPrice(productOf(res.body)), 'no offer on bol.com now');
            else if (res.status === 404) mark(e, 0, 'not on bol.com (404)');
            else if (res.status === 406) mark(e, 0, 'no Dutch content on bol.com (406)');
            else { due.delete(e); cycle.failed.push(e); failedCodes.set(res.status, (failedCodes.get(res.status) || 0) + 1); }
            if (results.size >= 400) await flush();
          }
        }
      } catch (e) {
        if (e && e.tokenCap) stopped = 'budget';
        else {
          errors.push(String(e && e.message || e));
          // 401 or 403 from either host: the keys are refused or the address is blocked. The switch goes off, so the
          // Worker does not ask again every hour (L154); tools/bol-refresh-setup.ps1 -Step enable turns it on again.
          if (e && (e.status === 401 || e.status === 403)) {
            try {
              await setMeta(db, 'enabled', '0', nowIso);
              await setMeta(db, 'disabled_reason', `worker ${nowIso}: bol.com answered ${e.status} (${e.host === 'login' ? 'token' : 'catalog'}); turn on with -Step enable`, nowIso);
              disabledNow = true;
              errors.push('kill switch turned off by the Worker');
            } catch (e2) { errors.push(`kill switch not turned off (${short(e2)})`); }
          }
        }
      }
      await flush();
      if (failedCodes.size) errors.push(`${[...failedCodes.values()].reduce((a, b) => a + b, 0)} lookups failed (${[...failedCodes].map(([c, n]) => `HTTP ${c} x${n}`).join(', ')}); tried again next cycle`);
      if (stopped) notes.push('call or time budget used: the next run at :13 goes on');
    }
    run.pending = [...due.values()].reduce((a, list) => a + list.length, 0);
    cycle.done = cycle.listsDone && run.pending === 0;
    if (cycle.done && !cycle.doneAt) cycle.doneAt = nowIso;
    await saveCycle();
    if (!candidates.length) notes.push('no bol.com products on the sites: nothing to refresh');
  }

  // ---- every run: hide what the Worker did not check for 24 hours (also with the switch off) ----
  const oldest = startMs - MAX_AGE_HOURS * HOUR;
  for (const r of candidates) {
    if (!r.active || results.has(r.key)) continue;
    let stale;
    if (!ownOk) stale = !(r.freshMs >= oldest);                  // own records unreadable: the site's date, best effort
    else if (Number.isFinite(r.checkedMs)) stale = r.checkedMs < oldest;
    else stale = r.known && !(r.firstMs >= oldest);               // never checked: 24 hours after the Worker first saw it
    if (stale) results.set(r.key, { stale: 'not checked for 24 hours' });
  }
  await flush();
  // Rows seen for the first time and not checked in this run: when the Worker first saw them (for the 24 hours above).
  if (ownOk) {
    const bySite = new Map();
    for (const r of candidates) if (!r.known && r.active) { if (!bySite.has(r.site.code)) bySite.set(r.site.code, []); bySite.get(r.site.code).push(r); }
    const statements = [];
    for (const [code, list] of bySite) statements.push(...checkedStatements(db, code, list, st, { firstSeenOnly: true }));
    // Records of rows that are gone or no longer looked after (deleted, or hidden by something else), and old hide entries.
    const dropChecked = new Map();
    for (const key of checked.keys()) {
      const code = key.split(':')[0];
      if (!okSites.has(code) || isCandidate.has(key)) continue;
      if (!dropChecked.has(code)) dropChecked.set(code, []);
      dropChecked.get(code).push(Number(key.split(':')[1]));
    }
    for (const [code, ids] of dropChecked) statements.push(...deleteStatements(db, 'bol_refresh_checked', code, ids));
    const dropHidden = new Map();
    for (const key of pruneHidden) { const code = key.split(':')[0]; if (!dropHidden.has(code)) dropHidden.set(code, []); dropHidden.get(code).push(Number(key.split(':')[1])); }
    for (const [code, ids] of dropHidden) statements.push(...deleteStatements(db, 'bol_refresh_hidden', code, ids));
    try { await batchAll(db, statements); } catch (e) { errors.push(`own records not tidied (${short(e)})`); }
  }

  // ---- the run row ----
  if (api) { run.calls = api.stats.calls; run.tokens = api.stats.tokens; if (api.stats.token) secretValues.push(api.stats.token); }
  const mask = maskOf(secretValues);
  run.state = errors.length ? 'error' : (enabled ? 'ok' : 'held');
  run.ok = run.state === 'ok' ? 1 : (run.state === 'held' ? 2 : 0);
  const cyc = refreshing && cycle ? `cycle ${cycle.id.slice(0, 13)}h: ${cycle.listsDone ? 'lists read' : `list ${Math.min(cycle.job + 1, standardJobs().length)} of ${standardJobs().length}`}, ${cycle.done ? 'done' : `${run.pending} waiting`}` : '';
  run.message = mask([...errors, cyc, ...notes].filter(Boolean).join('; ')).slice(0, 300);
  run.disabled = disabledNow;
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
