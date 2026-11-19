// CJ Affiliate sales (lessons L197): the Commission Detail API (GraphQL), read-only.
// Docs (official, read 19 Nov 2026): https://developers.cj.com/graphql/reference/Commission%20Detail
//   - endpoint https://commissions.api.cj.com/query, header "Authorization: Bearer <personal access token>"
//     (tokens: https://developers.cj.com/account/personal-access-tokens);
//   - publisherCommissions(forPublishers: [<publisher CID>], sincePostingDate, beforePostingDate, sinceLockingDate,
//     beforeLockingDate, sinceCommissionId) { count payloadComplete maxCommissionId records { ... } };
//   - "Date ranges of no more than 31 days", "no more than 10,000 commissions" per answer: when payloadComplete is
//     false, ask again with sinceCommissionId = maxCommissionId; "200 calls per 5 minutes";
//   - a CID the token does not belong to gives no error, only "count": 0 (the docs' "No data" note), so each CID of
//     CJ_PUBLISHER_IDS is asked on its own;
//   - our SID comes back in the record field shopperId ("Shopper ID for the transaction (Publisher-only attribute)";
//     the older field sid is deprecated);
//   - actionStatus: new / extended (still open) -> pending, locked / closed (in the payout cycle) -> approved;
//     any DECLIN... in validationStatus or actionStatus -> declined. A correction is a second record (original: false) with the same
//     originalActionId and amounts that are a difference ("delta records"); a sale whose records add up to 0 is declined.
//   - amounts: saleAmountPubCurrency / pubCommissionAmountPubCurrency are in our publisher currency (GBP for the Gear
//     World account: CJ_PUB_CURRENCY in the Worker config). The order id, country, coupon, device and click URL are
//     never asked for.
import { iso, makeRow, readJson, windows } from './common.js';

export const CJ_COMMISSIONS_API = 'https://commissions.api.cj.com/query';
// Read again every run: the commissions locked in the last 30 days (older sales that became approved now).
export const LOCKING_DAYS = 30;
// CJ allows 31 days per range; 30 keeps a margin.
export const CJ_WINDOW_DAYS = 30;
export const MAX_PAGES = 10;

export const RECORD_FIELDS = ['commissionId', 'actionStatus', 'actionType', 'advertiserId', 'advertiserName', 'eventDate',
  'postingDate', 'lockingDate', 'validationStatus', 'original', 'originalActionId', 'saleAmountPubCurrency',
  'pubCommissionAmountPubCurrency', 'shopperId'];

// Any form of "declined" (DECLINED, Declined, declined_by_advertiser ...) in either status field counts as declined.
export function cjStatus(r) {
  const v = String((r && r.validationStatus) || '');
  const a = String((r && r.actionStatus) || '').toLowerCase();
  if (/DECLIN/i.test(v) || /DECLIN/i.test(a)) return 'declined';
  if (a === 'locked' || a === 'closed') return 'approved';
  return 'pending';
}

export function cjRow(r, nowIso, currency = 'GBP') {
  return makeRow('cj', {
    id: r.commissionId,
    subId: r.shopperId ?? r.sid,
    advertiserId: r.advertiserId,
    advertiserName: r.advertiserName,
    saleDate: r.eventDate,
    lockingDate: r.lockingDate,
    status: cjStatus(r),
    rawStatus: [r.actionStatus, r.validationStatus].filter(Boolean).join('/'),
    sale: r.saleAmountPubCurrency,
    commission: r.pubCommissionAmountPubCurrency,
    currency,
    isCorrection: r.original === false || r.original === 0 || r.original === '0' || r.original === 'false',
    groupRef: r.originalActionId
  }, nowIso);
}

// The GraphQL query: string arguments quoted with JSON.stringify, so nothing can break out of them.
export function commissionsQuery(cid, args) {
  const a = [`forPublishers: [${JSON.stringify(String(cid))}]`];
  for (const [k, v] of Object.entries(args)) if (v) a.push(`${k}: ${JSON.stringify(String(v))}`);
  return `{ publisherCommissions(${a.join(', ')}) { count payloadComplete maxCommissionId records { ${RECORD_FIELDS.join(' ')} } } }`;
}

const errText = errors => (Array.isArray(errors) ? errors.map(e => (e && e.message) || String(e)).join('; ') : String(errors || '')).slice(0, 200);

async function ask(ctx, token, query) {
  const res = await ctx.call(CJ_COMMISSIONS_API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, accept: 'application/json' },
    body: JSON.stringify({ query })
  });
  const { json, text } = await readJson(res);
  if (res.status === 401 || res.status === 403 || /invalid auth token/i.test(text)) throw new Error('the CJ key was refused (expired or revoked?)');
  if (res.status === 429 || /too many requests|rate limit/i.test(text)) throw new Error('CJ rate limit (200 calls in 5 minutes)');
  if (!json) throw new Error(`CJ answered ${res.status}: ${text.slice(0, 120)}`);
  if (Array.isArray(json.errors) && json.errors.length) throw new Error(`CJ: ${errText(json.errors)}`);
  const block = json.data && json.data.publisherCommissions;
  if (!block) throw new Error(`CJ answered ${res.status} without publisherCommissions`);
  return block;
}

// Every record of one date range, page after page (sinceCommissionId).
async function allPages(ctx, token, cid, args) {
  const out = [];
  let since = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const block = await ask(ctx, token, commissionsQuery(cid, since ? { ...args, sinceCommissionId: since } : args));
    for (const r of Array.isArray(block.records) ? block.records : []) if (r && r.commissionId) out.push(r);
    if (block.payloadComplete !== false || !block.maxCommissionId || String(block.maxCommissionId) === since) return out;
    since = String(block.maxCommissionId);
  }
  ctx.notes.push(`CJ: more than ${MAX_PAGES} pages in one range, the rest next time`);
  return out;
}

export const cj = {
  id: 'cj',
  label: 'CJ',
  hosts: ['commissions.api.cj.com'],
  secrets: ['CJ_TOKEN'],
  optionalSecrets: [],
  // Not secret: the CJ account number(s) (CID) and our CJ currency come from the Worker config (vars).
  vars: ['CJ_PUBLISHER_IDS', 'CJ_PUB_CURRENCY'],
  ready: true,
  async run(ctx) {
    const token = ctx.secret('CJ_TOKEN');
    const cids = [...new Set(String(ctx.env.CJ_PUBLISHER_IDS || '').split(/[,\s]+/).filter(x => /^\d{3,12}$/.test(x)))];
    if (!cids.length) throw new Error('no CJ account number (CJ_PUBLISHER_IDS in the Worker config)');
    const currency = /^[A-Z]{3}$/.test(String(ctx.env.CJ_PUB_CURRENCY || '')) ? ctx.env.CJ_PUB_CURRENCY : 'GBP';
    const rows = [];
    const failed = [];
    for (const cid of cids) {
      try {
        const records = [];
        for (const w of windows(ctx.from, ctx.now, CJ_WINDOW_DAYS)) {
          records.push(...await allPages(ctx, token, cid, { sincePostingDate: iso(w.start), beforePostingDate: iso(w.end) }));
        }
        const lockFrom = new Date(ctx.now.getTime() - LOCKING_DAYS * 864e5);
        records.push(...await allPages(ctx, token, cid, { sinceLockingDate: iso(lockFrom), beforeLockingDate: iso(ctx.now) }));
        for (const r of records) rows.push(cjRow(r, ctx.nowIso, currency));
      } catch (e) {
        // A refused key or the rate limit stops CJ; another CID's error only that CID.
        if (/refused|rate limit/.test(String(e && e.message))) throw e;
        failed.push(`CID ${cid}: ${String(e && e.message || e).slice(0, 120)}`);
      }
    }
    if (failed.length === cids.length) throw new Error(failed.join('; '));
    if (failed.length) ctx.notes.push(failed.join('; '));
    return rows;
  },
  // A sale whose original and correction records add up to nothing was taken back: every record of it is declined.
  async afterSave(db) {
    await db.prepare(`UPDATE network_transactions SET status = 'declined'
      WHERE network = 'cj' AND group_ref IS NOT NULL AND group_ref IN (
        SELECT group_ref FROM network_transactions WHERE network = 'cj' AND group_ref IS NOT NULL
        GROUP BY group_ref
        HAVING SUM(is_correction) > 0 AND ABS(SUM(COALESCE(commission_amount, 0))) < 0.005 AND ABS(SUM(COALESCE(sale_amount, 0))) < 0.005)`).run();
  }
};
