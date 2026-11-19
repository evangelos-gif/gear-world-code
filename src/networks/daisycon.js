// Daisycon sales (lessons L197), read-only.
// Sign-in (official Daisycon publisher FAQ "API authentication", read 19 Nov 2026:
//   https://faq-publisher.daisycon.com/hc/en-us/articles/24835908705809):
//   - "The Daisycon API only supports OAuth 2.1 with PKCE": the first sign-in happens once in a browser (the setup tool
//     tools/network-sales-setup.ps1 opens it, with the same CLI redirect https://login.daisycon.com/oauth/cli as
//     tools/daisycon-feed.mjs); token endpoint https://login.daisycon.com/oauth/access-token;
//   - an access token lasts 30 minutes; "Refresh tokens are valid for 30 days" and "A refresh token can only be used
//     once, so be sure to store the new one!".
//   So the Worker cannot keep using the key the setup tool gave it (DAISYCON_REFRESH_SEED): every run gets a new refresh
//   token and keeps it in D1 (network_oauth), ENCRYPTED with AES-GCM under the Worker secret NETWORK_SYNC_KEY, so a copy
//   of the database (a backup on the PC) never holds a usable key. The run every 2 hours keeps it far inside its 30 days.
//   A new sign-in with the setup tool changes DAISYCON_REFRESH_SEED; the Worker sees a new seed (its SHA-256 differs from
//   network_oauth.seed_hash) and starts from it.
// Sales: GET https://services.daisycon.com/publishers/{publisher id}/transactions with date_modified_start /
//   date_modified_end (YYYY-MM-DD), page, per_page; the total in the X-Total-Count header. Each transaction has parts[]
//   with id, date, approval_date, last_modified, status (open / approved / disapproved), subid (= ws= on our links),
//   commission, revenue. The publisher API reference (https://docs-publisher.daisycon.com/) was down for maintenance on
//   19 Nov 2026, so this shape is the one Daisycon's API gives the maintained open-source client
//   whitelabeled/daisycon-api-client (DaisyconClient::getTransactions, Transaction::createFromJson), read defensively.
//   The publisher id comes from GET /publishers (as tools/daisycon-feed.mjs). Not kept: anonymous_ip, referencenumber,
//   referer_click, extra_1..5, publisher_description, device, gender, age, country.
import { FIRST_DAY, delMeta, getMeta, makeRow, openText, readJson, sealText, setMeta, sha256Hex, text, windows, ymd } from './common.js';

export const DC_LOGIN = 'https://login.daisycon.com';
export const DC_SERVICES = 'https://services.daisycon.com';
export const PER_PAGE = 200;
export const MAX_PAGES = 15;
// Later runs read the transactions CHANGED in the last 35 days (new sales and new statuses alike). When the last good
// run is older than that (the Worker was stopped), they read from that run instead, as far as one run's call budget
// goes; where it stopped is kept (network_sync_meta 'daisycon:resume_from') and the next run goes on from there.
export const MODIFIED_DAYS = 35;
export const RESUME_KEY = 'daisycon:resume_from';

export function daisyconStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'approved') return 'approved';
  if (v === 'disapproved' || v === 'declined' || v === 'rejected') return 'declined';
  return 'pending';
}

// Daisycon dates are "2026-11-19 10:07:22" (Amsterdam time): kept as "2026-11-19T10:07:22".
const dcDate = v => { const t = text(v, 40); return t ? t.replace(' ', 'T') : null; };

export function daisyconRows(t, nowIso, fallbackCurrency = 'EUR') {
  const parts = Array.isArray(t && t.parts) && t.parts.length ? t.parts : [];
  const tid = t && (t.affiliatemarketing_id ?? t.id);
  if (tid === undefined || tid === null || tid === '') return [];
  return parts.filter(p => p && typeof p === 'object').map((p, i) => makeRow('daisycon', {
    id: `${tid}-${p.id ?? i}`,
    subId: p.subid,
    advertiserId: t.program_id,
    advertiserName: t.program_name,
    saleDate: dcDate(p.date),
    lockingDate: dcDate(p.approval_date),
    status: daisyconStatus(p.status),
    rawStatus: p.status,
    sale: p.revenue,
    commission: p.commission,
    currency: p.currency_code || t.currency_code || fallbackCurrency
  }, nowIso));
}

const label = 'daisycon';

// The access token for this run, and the new refresh token kept (encrypted) for the next run.
export async function daisyconAccess(ctx) {
  const db = ctx.db;
  const key = ctx.secret('NETWORK_SYNC_KEY');
  const seed = ctx.secret('DAISYCON_REFRESH_SEED');
  const seedHash = seed ? await sha256Hex(seed) : '';
  // The key must work BEFORE a refresh token is spent: Daisycon's refresh token works once, so a new one that cannot
  // be kept would be lost.
  await sealText(key, 'check', label);
  const row = await db.prepare('SELECT iv, ciphertext, seed_hash FROM network_oauth WHERE network = ?').bind(label).first();
  let refresh = '';
  let fromSeed = false;
  if (row && (!seed || row.seed_hash === seedHash)) {
    try { refresh = await openText(key, row, label); } catch {
      throw new Error('the kept Daisycon sign-in cannot be read (was NETWORK_SYNC_KEY changed?): sign in again with tools/network-sales-setup.ps1 -Only daisycon');
    }
  } else {
    refresh = seed;
    fromSeed = true;
  }
  ctx.addSecret(refresh);
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: ctx.secret('DAISYCON_CLIENT_ID') });
  if (ctx.secret('DAISYCON_CLIENT_SECRET')) body.set('client_secret', ctx.secret('DAISYCON_CLIENT_SECRET'));
  const res = await ctx.call(`${DC_LOGIN}/oauth/access-token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: body.toString() });
  const { json, text: raw } = await readJson(res);
  if (json && json.access_token) ctx.addSecret(json.access_token);
  if (json && json.refresh_token) ctx.addSecret(json.refresh_token);
  if (res.status !== 200 || !json || !json.access_token) {
    const why = (json && (json.error_description || json.error || json.message)) || raw.slice(0, 120);
    const which = fromSeed ? 'the sign-in from the setup tool' : 'the kept sign-in';
    throw new Error(`Daisycon refused ${which} (${res.status} ${String(why).slice(0, 120)}): a sign-in lasts 30 days and each key works once; ` +
      'sign in again with tools/network-sales-setup.ps1 -Only daisycon');
  }
  if (json.refresh_token) {
    const sealed = await sealText(key, String(json.refresh_token), label);
    const save = () => db.prepare(`INSERT INTO network_oauth (network, iv, ciphertext, seed_hash, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (network) DO UPDATE SET iv = excluded.iv, ciphertext = excluded.ciphertext, seed_hash = excluded.seed_hash, updated_at = excluded.updated_at`)
      .bind(label, sealed.iv, sealed.ciphertext, seedHash || (row && row.seed_hash) || null, ctx.nowIso).run();
    try { await save(); } catch {
      try { await save(); } catch {
        // The old refresh token is used up now: without the new one the next run cannot sign in. The sales of this run
        // are still saved, but the run counts as failed so the dashboard shows it.
        ctx.fail = 'the new Daisycon sign-in could not be kept: sign in again with tools/network-sales-setup.ps1 -Only daisycon';
      }
    }
  } else {
    ctx.notes.push('Daisycon gave no new sign-in key: the next run may need a new sign-in');
  }
  return String(json.access_token);
}

async function getJson(ctx, access, path) {
  const res = await ctx.call(`${DC_SERVICES}${path}`, { method: 'GET', headers: { authorization: `Bearer ${access}`, accept: 'application/json' } });
  const { json, text: raw } = await readJson(res);
  if (res.status === 401 || res.status === 403) throw new Error(`Daisycon refused the access (${res.status}) on ${path.replace(/\/publishers\/\d+/, '/publishers/<id>').split('?')[0]}`);
  if (res.status === 429) throw new Error('Daisycon rate limit (50 calls a minute)');
  // 204 No Content (first live run, 19 Nov 2026: the transactions list with nothing in it), or an empty 200: an empty
  // list, so paging stops there. Every other answer that is not 200 with JSON stays an error.
  if (res.status === 204 || (res.status === 200 && !String(raw || '').trim())) return { json: [], total: 0 };
  if (res.status !== 200 || json === null) throw new Error(`Daisycon answered ${res.status} on ${path.replace(/\/publishers\/\d+/, '/publishers/<id>').split('?')[0]}: ${raw.slice(0, 100)}`);
  // No X-Total-Count header = total unknown (Number(null) would be 0 and stop paging after a full first page).
  const h = res.headers && typeof res.headers.get === 'function' ? res.headers.get('x-total-count') : null;
  const total = h === null || h === undefined || String(h).trim() === '' ? NaN : Number(h);
  return { json, total: Number.isFinite(total) ? total : null };
}

const listOf = j => (Array.isArray(j) ? j : (j && Array.isArray(j.results) ? j.results : (j && Array.isArray(j.data) ? j.data : [])));

export const daisycon = {
  id: 'daisycon',
  label: 'Daisycon',
  hosts: ['login.daisycon.com', 'services.daisycon.com'],
  secrets: ['DAISYCON_CLIENT_ID', 'DAISYCON_REFRESH_SEED', 'NETWORK_SYNC_KEY'],
  optionalSecrets: ['DAISYCON_CLIENT_SECRET'],
  vars: ['DAISYCON_CURRENCY'],
  ready: true,
  async run(ctx) {
    const access = await daisyconAccess(ctx);
    const pubs = listOf((await getJson(ctx, access, '/publishers')).json);
    const publisher = pubs.length && pubs[0] && pubs[0].id !== undefined ? String(pubs[0].id) : '';
    if (!/^\d{1,12}$/.test(publisher)) throw new Error('Daisycon gave no publisher account');
    const currency = /^[A-Z]{3}$/.test(String(ctx.env.DAISYCON_CURRENCY || '')) ? ctx.env.DAISYCON_CURRENCY : 'EUR';
    let from = ctx.firstRun ? ctx.from : new Date(ctx.now.getTime() - MODIFIED_DAYS * 864e5);
    if (!ctx.firstRun && ctx.lastOk && ctx.lastOk < from) from = new Date(ctx.lastOk.getTime() - 864e5);
    const resume = await getMeta(ctx.db, RESUME_KEY);
    const resumeAt = resume ? new Date(resume) : null;
    if (resumeAt && Number.isFinite(resumeAt.getTime()) && resumeAt < from) from = resumeAt;
    const first = new Date(`${FIRST_DAY}T00:00:00Z`);
    if (from < first) from = first;
    const rows = [];
    let stoppedAt = null;
    read: for (const w of windows(from, ctx.now, 30)) {
      // date_modified_end is a whole day: the window's last day is asked again by the next window (no gap).
      for (let page = 1; page <= MAX_PAGES; page++) {
        if (ctx.callsLeft() < 1) { stoppedAt = w.start; break read; }
        const q = new URLSearchParams({ date_modified_start: ymd(w.start), date_modified_end: ymd(w.end), page: String(page), per_page: String(PER_PAGE) });
        const { json, total } = await getJson(ctx, access, `/publishers/${publisher}/transactions?${q}`);
        const list = listOf(json);
        for (const t of list) rows.push(...daisyconRows(t, ctx.nowIso, currency));
        if (list.length < PER_PAGE || (total !== null && page * PER_PAGE >= total)) break;
        if (page === MAX_PAGES) ctx.notes.push(`Daisycon: more than ${MAX_PAGES} pages, the rest next time`);
      }
    }
    if (stoppedAt) {
      await setMeta(ctx.db, RESUME_KEY, stoppedAt.toISOString(), ctx.nowIso);
      ctx.notes.push(`Daisycon: the call budget of one run is used up; the next run goes on from ${ymd(stoppedAt)}`);
    } else if (resume) {
      await delMeta(ctx.db, RESUME_KEY);
    }
    return rows;
  }
};
