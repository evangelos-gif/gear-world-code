// Daily price log of the 13 Gear World sites (lessons L100). Run by the private Worker gear-world-prices every
// 15 minutes: each run takes the next site that is not logged yet today (UTC), reads its products with SELECT only,
// and writes to its own database (PRICES_DB) one row per product whose price, "was" price, stock or listing changed,
// or that it sees for the first time. The sites' databases are only read: every query to them goes through readOnly().
import { IN_STOCK_WORDS } from '../../src/db.js';
import { PRICE_SITES } from './sites.js';

export const DEFAULTS = {
  pageRows: 20000,      // rows per SELECT page (by id, or by key in price_last)
  chunkRows: 1000,      // rows per write statement: they travel as ONE bound JSON text (D1: at most 100 bound values)
  chunkBytes: 400000,   // and at most this many bytes of JSON (D1: 2 MB per value)
  chunksPerBatch: 5,    // chunks per db.batch(): one transaction, well inside D1's 30 seconds
  maxAttempts: 3,       // tries per site and day
  staleMinutes: 20,     // a "running" row older than this was cut off (cron wall time is 15 minutes): try again
  dailyWriteCap: 1000000 // rows written per day in PRICES_DB, all sites together (env DAILY_WRITE_CAP)
};

const SELECT_ONLY = /^\s*SELECT\s/i;

// The only way to a site's database: one SELECT per statement, nothing else (D1 has no read-only binding).
// No batch(), exec() or dump() either.
export function readOnly(db, name) {
  if (!db || typeof db.prepare !== 'function') throw new Error(`the D1 binding ${name} is missing`);
  return Object.freeze({
    prepare(sql) {
      const text = String(sql);
      if (!SELECT_ONLY.test(text) || text.includes(';')) throw new Error(`${name} is read-only here: one SELECT only`);
      return db.prepare(text);
    }
  });
}

// Money as the sites show it: 2 decimals. Anything that is not a number is null.
export function money(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

const sqlText = s => `'${String(s).replace(/'/g, "''")}'`;

// The products a site shows, with the key that stays the same across imports.
// Older layout (lessons L28): the shop and its own product code (the unique index of the import), stock from the
// stock_status text as the site reads it (src/db.js IN_STOCK_WORDS), and no "was" price. "+is_active" keeps SQLite on
// the id order (no index scan and sort on every page).
export function siteSql(site) {
  if (site.legacy) {
    const stock = IN_STOCK_WORDS.map(sqlText).join(', ');
    return `SELECT id, retailer || ':' || COALESCE(NULLIF(TRIM(merchant_product_id), ''), 'awin-' || awin_product_id) AS k, price,
      NULL AS was_price, CASE WHEN LOWER(TRIM(COALESCE(stock_status, ''))) IN (${stock}) THEN 1 ELSE 0 END AS in_stock
      FROM products WHERE +is_active = 1 AND id > ? ORDER BY id LIMIT ?`;
  }
  return 'SELECT id, stable_key AS k, price, was_price, in_stock FROM products WHERE +is_active = 1 AND id > ? ORDER BY id LIMIT ?';
}

async function readSite(db, site, pageRows) {
  const sql = siteSql(site);
  const now = new Map();
  let dupes = 0;
  let skipped = 0;
  let lastId = 0;
  for (;;) {
    const res = await db.prepare(sql).bind(lastId, pageRows).all();
    const rows = (res && res.results) || [];
    for (const row of rows) {
      const key = row.k === null || row.k === undefined ? '' : String(row.k);
      const price = money(row.price);
      if (!key || price === null || price <= 0) { skipped++; continue; }
      const was = money(row.was_price);
      if (now.has(key)) dupes++;
      now.set(key, { price, was: was !== null && was > 0 ? was : null, stock: Number(row.in_stock) ? 1 : 0 });
    }
    if (rows.length < pageRows) break;
    const next = Number(rows[rows.length - 1].id);
    if (!(next > lastId)) throw new Error('the product ids did not move forward');
    lastId = next;
  }
  return { now, dupes, skipped };
}

async function readLast(prices, code, pageRows) {
  const last = new Map();
  let after = '';
  for (;;) {
    const res = await prices.prepare('SELECT pkey, price, was_price, in_stock, listed FROM price_last WHERE site = ? AND pkey > ? ORDER BY pkey LIMIT ?')
      .bind(code, after, pageRows).all();
    const rows = (res && res.results) || [];
    for (const row of rows) {
      last.set(String(row.pkey), { price: money(row.price), was: money(row.was_price), stock: Number(row.in_stock) ? 1 : 0, listed: Number(row.listed) ? 1 : 0 });
    }
    if (rows.length < pageRows) break;
    after = String(rows[rows.length - 1].pkey);
  }
  return last;
}

// What to write today: [key, price, was, stock, listed] for every product that is new, changed, back on the site,
// or gone from it (then with its last known price and listed = 0). Sorted by key, so a capped day is the same every time.
export function diffPrices(now, last) {
  const changes = [];
  let changed = 0;
  let added = 0;
  let gone = 0;
  for (const [k, c] of now) {
    const o = last.get(k);
    if (!o) { added++; changes.push([k, c.price, c.was, c.stock, 1]); continue; }
    if (o.listed !== 1 || o.price !== c.price || o.was !== c.was || o.stock !== c.stock) { changed++; changes.push([k, c.price, c.was, c.stock, 1]); }
  }
  for (const [k, o] of last) {
    if (o.listed === 1 && !now.has(k)) { gone++; changes.push([k, o.price, o.was, o.stock, 0]); }
  }
  changes.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { changes, changed, added, gone };
}

const encoder = new TextEncoder();

// The rows as JSON texts of at most maxRows rows and maxBytes bytes each.
export function chunkJson(rows, maxRows, maxBytes) {
  const out = [];
  let cur = [];
  let bytes = 2;
  for (const r of rows) {
    const s = JSON.stringify(r);
    const n = encoder.encode(s).length + 1;
    if (cur.length && (cur.length >= maxRows || bytes + n > maxBytes)) { out.push({ json: `[${cur.join(',')}]`, rows: cur.length }); cur = []; bytes = 2; }
    cur.push(s);
    bytes += n;
  }
  if (cur.length) out.push({ json: `[${cur.join(',')}]`, rows: cur.length });
  return out;
}

// SQLite needs "WHERE true" before ON CONFLICT when the rows come from a SELECT (upsert parsing).
const LOG_SQL = `INSERT INTO price_log (site, pkey, day, price, was_price, in_stock, listed)
  SELECT ?1, json_extract(j.value, '$[0]'), ?2, json_extract(j.value, '$[1]'), json_extract(j.value, '$[2]'),
    json_extract(j.value, '$[3]'), json_extract(j.value, '$[4]')
  FROM json_each(?3) AS j WHERE true
  ON CONFLICT (site, pkey, day) DO UPDATE SET price = excluded.price, was_price = excluded.was_price,
    in_stock = excluded.in_stock, listed = excluded.listed`;
const LAST_SQL = `INSERT INTO price_last (site, pkey, price, was_price, in_stock, listed, day)
  SELECT ?1, json_extract(j.value, '$[0]'), json_extract(j.value, '$[1]'), json_extract(j.value, '$[2]'),
    json_extract(j.value, '$[3]'), json_extract(j.value, '$[4]'), ?2
  FROM json_each(?3) AS j WHERE true
  ON CONFLICT (site, pkey) DO UPDATE SET price = excluded.price, was_price = excluded.was_price,
    in_stock = excluded.in_stock, listed = excluded.listed, day = excluded.day`;

// One site and day at a time: a new row, or a failed / cut-off one that still has tries left.
const CLAIM_SQL = `INSERT INTO price_runs (day, site, status, attempts, started_at) VALUES (?1, ?2, 'running', 1, ?3)
  ON CONFLICT (day, site) DO UPDATE SET status = 'running', attempts = price_runs.attempts + 1,
    started_at = excluded.started_at, error = NULL, finished_at = NULL
  WHERE price_runs.attempts < ?4
    AND (price_runs.status = 'error' OR (price_runs.status = 'running' AND price_runs.started_at < ?5))`;
const DONE_SQL = `UPDATE price_runs SET status = ?3, products = ?4, changed = ?5, added = ?6, gone = ?7, dupes = ?8,
  skipped = ?9, writes = writes + ?10, ms = ?11, error = NULL, finished_at = ?12 WHERE day = ?1 AND site = ?2`;
const FAIL_SQL = `UPDATE price_runs SET status = 'error', writes = writes + ?3, ms = ?4, error = ?5, finished_at = ?6
  WHERE day = ?1 AND site = ?2`;

function cleanError(e) {
  const text = String(e && e.message ? e.message : e);
  return text.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>').replace(/\s+/g, ' ').slice(0, 300);
}

async function logSite(env, site, day, opts, budget, progress) {
  const db = readOnly(env[site.binding], site.binding);
  const prices = env.PRICES_DB;
  const { now, dupes, skipped } = await readSite(db, site, opts.pageRows);
  // An empty answer is a problem of the moment (a site never shows 0 products): nothing is written, it is tried again.
  if (now.size === 0) throw new Error('the site database gave no products: nothing written');
  const last = await readLast(prices, site.code, opts.pageRows);
  const diff = diffPrices(now, last);
  let changes = diff.changes;
  let status = 'ok';
  const most = Math.max(0, Math.floor(budget / 2));
  if (changes.length > most) { changes = changes.slice(0, most); status = 'capped'; }
  const chunks = chunkJson(changes, opts.chunkRows, opts.chunkBytes);
  for (let i = 0; i < chunks.length; i += opts.chunksPerBatch) {
    const group = chunks.slice(i, i + opts.chunksPerBatch);
    const stmts = [];
    for (const c of group) {
      stmts.push(prices.prepare(LOG_SQL).bind(site.code, day, c.json));
      stmts.push(prices.prepare(LAST_SQL).bind(site.code, day, c.json));
    }
    // One transaction: the history row and the last state of the same products are written together, or not at all.
    await prices.batch(stmts);
    for (const c of group) progress.writes += 2 * c.rows;
  }
  return { status, products: now.size, changed: diff.changed, added: diff.added, gone: diff.gone, dupes, skipped };
}

// One run of the cron: logs at most one site. Returns what it did (for the Worker's log).
export async function runOnce(env, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const at = options.now !== undefined ? new Date(options.now) : new Date();
  const day = at.toISOString().slice(0, 10);
  const startedAt = at.toISOString();
  const staleBefore = new Date(at.getTime() - opts.staleMinutes * 60000).toISOString();
  const cap = Number(env.DAILY_WRITE_CAP) > 0 ? Number(env.DAILY_WRITE_CAP) : opts.dailyWriteCap;
  const prices = env.PRICES_DB;
  if (!prices || typeof prices.prepare !== 'function') throw new Error('the D1 binding PRICES_DB is missing');
  const runs = ((await prices.prepare('SELECT site, status, attempts, started_at FROM price_runs WHERE day = ?').bind(day).all()).results) || [];
  const byCode = new Map(runs.map(r => [String(r.site), r]));
  const fresh = PRICE_SITES.filter(s => !byCode.has(s.code));
  const again = PRICE_SITES.filter(s => {
    const r = byCode.get(s.code);
    return r && Number(r.attempts) < opts.maxAttempts
      && (r.status === 'error' || (r.status === 'running' && String(r.started_at || '') < staleBefore));
  });
  for (const site of [...fresh, ...again]) {
    const claim = await prices.prepare(CLAIM_SQL).bind(day, site.code, startedAt, opts.maxAttempts, staleBefore).run();
    if (!claim || !claim.meta || Number(claim.meta.changes) !== 1) continue;
    const t0 = Date.now();
    const progress = { writes: 0 };
    try {
      const w = await prices.prepare('SELECT COALESCE(SUM(writes), 0) AS w FROM price_runs WHERE day = ?').bind(day).first();
      const budget = Math.max(0, cap - Number((w && w.w) || 0));
      const r = await logSite(env, site, day, opts, budget, progress);
      const ms = Date.now() - t0;
      await prices.prepare(DONE_SQL).bind(day, site.code, r.status, r.products, r.changed, r.added, r.gone, r.dupes, r.skipped,
        progress.writes, ms, new Date().toISOString()).run();
      return { day, site: site.code, ...r, writes: progress.writes, ms };
    } catch (e) {
      const ms = Date.now() - t0;
      const error = cleanError(e);
      await prices.prepare(FAIL_SQL).bind(day, site.code, progress.writes, ms, error, new Date().toISOString()).run();
      return { day, site: site.code, status: 'error', error, writes: progress.writes, ms };
    }
  }
  return { day, site: null, status: 'idle' };
}
