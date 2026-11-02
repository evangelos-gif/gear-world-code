// gear-world-awin-sync: the private Worker that copies the Awin sales of every Gear World site into the D1 database
// gear-world-awin, so the private dashboard can show real sales and commission (lessons L91).
// - Read-only towards Awin: it only calls GET endpoints of the Publisher API with the owner's token (secret AWIN_TOKEN).
// - No public address (no routes, workers.dev off): it runs on its cron only, and answers 404 to any request.
// - The publisher id is not stored anywhere: it is read from Awin (/accounts) at every run.
// - Only the fields of migrations/0001_awin.sql are kept: never the full answer, and no customer data.
// - The site and product come from our own clickref ("cgw-82540", "tgw-promo-joybuy-halloween"; src/engine.js).

export const AWIN_API = 'https://api.awin.com';
// The codes our Workers put in front of a clickref (src/engine.js: site.code in lower case).
export const SITE_CODES = ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw', 'tgw', 'agw', 'vgw', 'sgw', 'bgw', 'pgw', 'zgw', 'gwh'];
// The first sales of the network were in September 2026: the first run reads from here.
export const FIRST_DAY = '2026-08-01';
// Awin gives at most 31 days per call; 30 keeps a margin.
export const WINDOW_DAYS = 30;
// Sales can stay "pending" for weeks: every run reads again the last 90 days by sale date, and the last 30 days by
// approval date (for older sales approved now).
export const LOOKBACK_DAYS = 90;
export const VALIDATION_DAYS = 30;
export const KEEP_RUNS = 300;
// Awin allows 20 calls a minute: one run makes at most this many.
export const MAX_CALLS = 15;

const DAY = 864e5;

export function siteOf(clickRef) {
  const m = /^([a-z]{3})-(.+)$/i.exec(String(clickRef || '').trim());
  if (!m) return 'unknown';
  const code = m[1].toLowerCase();
  return SITE_CODES.includes(code) ? code : 'unknown';
}

export function productRefOf(clickRef) {
  const m = /^([a-z]{3})-(.+)$/i.exec(String(clickRef || '').trim());
  return m && SITE_CODES.includes(m[1].toLowerCase()) ? m[2].slice(0, 80) : null;
}

// Awin sends money as { amount, currency } (amount a number, or text in older answers).
export function money(v) {
  if (v === null || v === undefined || v === '') return { amount: null, currency: null };
  if (typeof v === 'object') {
    const n = Number(v.amount);
    return { amount: Number.isFinite(n) ? n : null, currency: v.currency ? String(v.currency).slice(0, 3) : null };
  }
  const n = Number(v);
  return { amount: Number.isFinite(n) ? n : null, currency: null };
}

const text = (v, max = 120) => (v === null || v === undefined || v === '' ? null : String(v).slice(0, max));

// One Awin transaction as a row of awin_transactions (only these fields are ever kept).
export function toRow(t, publisherId, nowIso) {
  const refs = t && t.clickRefs && typeof t.clickRefs === 'object' ? t.clickRefs : {};
  const clickRef = text(refs.clickRef || t.clickRef, 100);
  const sale = money(t.saleAmount);
  const commission = money(t.commissionAmount);
  return {
    id: String(t.id),
    publisher_id: String(publisherId),
    advertiser_id: text(t.advertiserId, 20),
    type: text(t.type, 40),
    status: text(t.commissionStatus, 20),
    transaction_date: text(t.transactionDate, 40),
    validation_date: text(t.validationDate, 40),
    sale_amount: sale.amount,
    sale_currency: sale.currency,
    commission_amount: commission.amount,
    commission_currency: commission.currency,
    click_ref: clickRef,
    site: siteOf(clickRef),
    product_ref: productRefOf(clickRef),
    paid_to_publisher: t.paidToPublisher ? 1 : 0,
    decline_reason: text(t.declineReason, 200),
    first_seen_at: nowIso,
    updated_at: nowIso
  };
}

const awinDate = d => d.toISOString().slice(0, 19);

// Date windows of at most WINDOW_DAYS days from `from` (YYYY-MM-DD or Date) to `now`, oldest first.
export function windows(from, now, days = WINDOW_DAYS) {
  const out = [];
  let start = from instanceof Date ? new Date(from.getTime()) : new Date(`${from}T00:00:00Z`);
  while (start < now) {
    const end = new Date(Math.min(start.getTime() + days * DAY - 1000, now.getTime()));
    out.push({ start: awinDate(start), end: awinDate(end) });
    start = new Date(end.getTime() + 1000);
  }
  return out;
}

// GET on the Awin API. The token goes only in the Authorization header and never into an error message.
export async function awinGet(fetchFn, token, path, query = {}) {
  const url = new URL(AWIN_API + path);
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  const res = await fetchFn(url.toString(), { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 160); } catch { /* no body */ }
    if (token) detail = detail.split(token).join('[token]');
    const what = res.status === 401 || res.status === 403 ? 'the Awin token was refused (expired or revoked?)'
      : res.status === 429 ? 'Awin rate limit (20 calls a minute)' : `Awin answered ${res.status}`;
    throw new Error(`${what} on ${path.replace(/\/publishers\/\d+/, '/publishers/<id>')}${detail ? ': ' + detail : ''}`);
  }
  return res.json();
}

export async function publisherIds(fetchFn, token) {
  const j = await awinGet(fetchFn, token, '/accounts', { type: 'publisher' });
  const list = Array.isArray(j) ? j : (j && Array.isArray(j.accounts) ? j.accounts : []);
  return list
    .filter(a => a && a.accountId && (!a.accountType || String(a.accountType).toLowerCase() === 'publisher'))
    .map(a => String(a.accountId));
}

const UPSERT_SQL = `INSERT INTO awin_transactions (id, publisher_id, advertiser_id, type, status, transaction_date, validation_date,
  sale_amount, sale_currency, commission_amount, commission_currency, click_ref, site, product_ref, paid_to_publisher,
  decline_reason, first_seen_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (id) DO UPDATE SET publisher_id = excluded.publisher_id, advertiser_id = excluded.advertiser_id,
  type = excluded.type, status = excluded.status, transaction_date = excluded.transaction_date,
  validation_date = excluded.validation_date, sale_amount = excluded.sale_amount, sale_currency = excluded.sale_currency,
  commission_amount = excluded.commission_amount, commission_currency = excluded.commission_currency,
  click_ref = excluded.click_ref, site = excluded.site, product_ref = excluded.product_ref,
  paid_to_publisher = excluded.paid_to_publisher, decline_reason = excluded.decline_reason, updated_at = excluded.updated_at`;

const COLS = ['id', 'publisher_id', 'advertiser_id', 'type', 'status', 'transaction_date', 'validation_date', 'sale_amount',
  'sale_currency', 'commission_amount', 'commission_currency', 'click_ref', 'site', 'product_ref', 'paid_to_publisher',
  'decline_reason', 'first_seen_at', 'updated_at'];

async function saveRows(db, rows) {
  let saved = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const part = rows.slice(i, i + 50).map(r => db.prepare(UPSERT_SQL).bind(...COLS.map(c => r[c])));
    await db.batch(part);
    saved += part.length;
  }
  return saved;
}

async function logRun(db, run) {
  await db.prepare('INSERT INTO awin_sync_runs (ran_at, ok, calls, fetched, saved, message) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(run.ran_at, run.ok ? 1 : 0, run.calls, run.fetched, run.saved, run.message ? String(run.message).slice(0, 300) : null).run();
  await db.prepare('DELETE FROM awin_sync_runs WHERE id NOT IN (SELECT id FROM awin_sync_runs ORDER BY id DESC LIMIT ?)').bind(KEEP_RUNS).run();
}

// One sync. Never throws: the result (also written to awin_sync_runs) says what happened.
export async function syncAwin(env, { fetchFn = fetch, now = new Date() } = {}) {
  const db = env.AWIN_DB;
  const nowIso = now.toISOString();
  const run = { ran_at: nowIso, ok: false, calls: 0, fetched: 0, saved: 0, message: '' };
  if (!db) return { ...run, message: 'no database binding AWIN_DB' };
  const token = String(env.AWIN_TOKEN || '').trim();
  try {
    if (!token) throw new Error('no Awin token yet (secret AWIN_TOKEN)');
    const call = async (path, query) => {
      if (run.calls >= MAX_CALLS) throw new Error(`more than ${MAX_CALLS} Awin calls in one run`);
      run.calls++;
      return awinGet(fetchFn, token, path, query);
    };
    const pids = await (async () => { run.calls++; return publisherIds(fetchFn, token); })();
    if (!pids.length) throw new Error('the Awin token has no publisher account');
    const have = await db.prepare('SELECT COUNT(*) AS n FROM awin_transactions').first();
    const from = have && Number(have.n) > 0 ? new Date(now.getTime() - LOOKBACK_DAYS * DAY) : FIRST_DAY;
    const rows = new Map();
    for (const pid of pids) {
      const base = `/publishers/${pid}/transactions/`;
      for (const w of windows(from, now)) {
        const list = await call(base, { startDate: w.start, endDate: w.end, timezone: 'UTC', dateType: 'transaction' });
        for (const t of Array.isArray(list) ? list : []) if (t && t.id !== undefined) rows.set(String(t.id), toRow(t, pid, nowIso));
      }
      const v = windows(new Date(now.getTime() - VALIDATION_DAYS * DAY), now)[0];
      if (v) {
        const list = await call(base, { startDate: v.start, endDate: v.end, timezone: 'UTC', dateType: 'validation' });
        for (const t of Array.isArray(list) ? list : []) if (t && t.id !== undefined) rows.set(String(t.id), toRow(t, pid, nowIso));
      }
    }
    run.fetched = rows.size;
    run.saved = await saveRows(db, [...rows.values()]);
    // Shop names, once a day (a failure here does not fail the sync).
    try {
      const last = await db.prepare('SELECT MAX(updated_at) AS t FROM awin_advertisers').first();
      if (!last || !last.t || now.getTime() - Date.parse(last.t) > DAY) {
        for (const pid of pids) {
          const progs = await call(`/publishers/${pid}/programmes`, { relationship: 'joined' });
          const stmts = (Array.isArray(progs) ? progs : []).filter(p => p && p.id && p.name).slice(0, 500)
            .map(p => db.prepare('INSERT INTO awin_advertisers (id, name, updated_at) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at')
              .bind(String(p.id), String(p.name).slice(0, 120), nowIso));
          for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
        }
      }
    } catch (e) {
      run.message = 'sales saved; shop names not refreshed: ' + String(e && e.message || e).slice(0, 150);
    }
    run.ok = true;
  } catch (e) {
    run.message = String(e && e.message || e);
    if (token) run.message = run.message.split(token).join('[token]');
  }
  try { await logRun(db, run); } catch { /* the result is still returned */ }
  return run;
}

export function createAwinSync({ fetchFn } = {}) {
  return {
    async scheduled(event, env, ctx) {
      ctx.waitUntil(syncAwin(env, { fetchFn: fetchFn || fetch }));
    },
    // No public address; anything that reaches it anyway gets nothing.
    async fetch() {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
