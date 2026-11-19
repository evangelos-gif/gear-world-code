// Linkwise sales (lessons L197). Linkwise approved Gear World on 19 Nov 2026 (Greece and Cyprus); no product is live
// yet, so there is nothing to read today. This adapter is BUILT BUT HELD (ready: false) until the transaction report's
// parameters are known: until then a run with the Linkwise secrets only writes "waiting" in network_sync_runs.
//
// What is known (official, read 19 Nov 2026):
//   - Linkwise has a publisher API: "API - Provides direct access to Program details, Statistics and Payments"
//     (https://linkwi.se/en/affiliates, Tools).
//   - The API reference https://affiliate.linkwi.se/api/ -> "Version 1.1" (https://affiliate.linkwi.se/api/1.1/):
//     "Transaction report /api/1.1/reports_transaction.json" (JSON; the .html form gives XML), "Program list
//     /api/1.1/programs.json", "Payment information /api/1.1/get_payment_info.json"; "The returned information can be in
//     either JSON or XML format"; "the number of API calls a user can make are limited per day".
//   - Authentication: HTTP Basic. Every call answers 401 with WWW-Authenticate: Basic realm="Linkwise Affiliation
//     Network" without a login, so the page of each call ("Each API call contains information about any parameters it
//     may require or accept") opens only with the account's API user name and password.
//   - Sub id on our links: subid1 (Linkwise's own click script https://go.linkwi.se/delivery/js/crl.js sends
//     subid1 ... subid5; src/engine.js adds subid1).
//
// TODO(linkwise), the exact steps to finish:
//   1. The owner runs 🟢 tools/network-sales-setup.ps1 -Step probe -Only linkwise: with the Linkwise API login typed at
//      the prompt (never stored by this step) it calls reports_transaction.json and programs.json once, with no
//      parameters, and writes into the report ONLY the parameter names, field names and messages the API gives back.
//   2. From that report: the date parameters of reports_transaction.json, the status words, and the names of the id,
//      sub id, programme, date, amount, commission and currency fields.
//   3. Fill reportQuery() and FIELD below, set ready: true, and add that answer as a fake in
//      tests/worker/network-sync.test.mjs. The secrets (LINKWISE_API_USER, LINKWISE_API_PASSWORD) are already stored by
//      the setup tool's apply step, so no new key step is needed then.
import { makeRow, readJson, windows, ymd } from './common.js';

export const LW_API = 'https://affiliate.linkwi.se/api/1.1';

// Field names tried in order (the real ones replace these lists in step 3 of the TODO).
export const FIELD = {
  id: ['transaction_id', 'id'],
  subId: ['subid1', 'sub_id', 'subid'],
  advertiserId: ['program_id', 'programid'],
  advertiserName: ['program_name', 'program'],
  saleDate: ['transaction_date', 'date', 'created'],
  lockingDate: ['approval_date', 'validation_date', 'status_date'],
  status: ['status', 'state'],
  sale: ['amount', 'sale_amount', 'order_amount'],
  commission: ['commission', 'affiliate_commission', 'earnings'],
  currency: ['currency', 'currency_code']
};
const pick = (r, names) => { for (const n of names) if (r && r[n] !== undefined && r[n] !== null && r[n] !== '') return r[n]; return null; };

export function linkwiseStatus(s) {
  const v = String(s || '').toLowerCase();
  if (/^(approved|accepted|confirmed|paid|valid)/.test(v)) return 'approved';
  if (/^(rejected|declined|cancel|disapproved|invalid)/.test(v)) return 'declined';
  return 'pending';
}

export function linkwiseRow(r, nowIso) {
  const id = pick(r, FIELD.id);
  if (id === null) return null;
  const status = pick(r, FIELD.status);
  return makeRow('linkwise', {
    id,
    subId: pick(r, FIELD.subId),
    advertiserId: pick(r, FIELD.advertiserId),
    advertiserName: pick(r, FIELD.advertiserName),
    saleDate: pick(r, FIELD.saleDate),
    lockingDate: pick(r, FIELD.lockingDate),
    status: linkwiseStatus(status),
    rawStatus: status,
    sale: pick(r, FIELD.sale),
    commission: pick(r, FIELD.commission),
    // Linkwise pays in euros (Greek network) unless the answer says otherwise.
    currency: pick(r, FIELD.currency) || 'EUR'
  }, nowIso);
}

// TODO(linkwise) step 3: the real date parameters. Today only "fields", "length" and "format" are seen in use.
export function reportQuery(w) {
  return new URLSearchParams({ date_from: ymd(w.start), date_to: ymd(w.end) }).toString();
}

export const basicAuth = (user, pass) => `Basic ${btoa(`${user}:${pass}`)}`;

export const linkwise = {
  id: 'linkwise',
  label: 'Linkwise',
  hosts: ['affiliate.linkwi.se'],
  secrets: ['LINKWISE_API_USER', 'LINKWISE_API_PASSWORD'],
  optionalSecrets: [],
  vars: [],
  ready: false,
  waiting: 'waiting for the parameters of the transaction report (run tools/network-sales-setup.ps1 -Step probe -Only linkwise and send the report to Claude)',
  async run(ctx) {
    const auth = basicAuth(ctx.secret('LINKWISE_API_USER'), ctx.secret('LINKWISE_API_PASSWORD'));
    ctx.addSecret(auth.slice(6));
    const rows = [];
    for (const w of windows(ctx.from, ctx.now, 30)) {
      const res = await ctx.call(`${LW_API}/reports_transaction.json?${reportQuery(w)}`, { method: 'GET', headers: { authorization: auth, accept: 'application/json' } });
      const { json, text } = await readJson(res);
      if (res.status === 401 || res.status === 403) throw new Error('the Linkwise API login was refused');
      if (res.status !== 200 || json === null) throw new Error(`Linkwise answered ${res.status}: ${text.slice(0, 100)}`);
      const list = Array.isArray(json) ? json : (Array.isArray(json.transactions) ? json.transactions : (Array.isArray(json.data) ? json.data : []));
      for (const r of list) { const row = linkwiseRow(r, ctx.nowIso); if (row) rows.push(row); }
    }
    return rows;
  }
};
