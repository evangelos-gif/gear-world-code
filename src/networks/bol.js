// bol.com partner programme sales (publisher account "Gear World", NL/BE; lessons L197), read-only.
// Docs (official, read 19 Nov 2026):
//   - Affiliate Reporting API: https://api.bol.com/marketing/docs/affiliate-reports-api/index.html
//   - Authentication: https://api.bol.com/marketing/docs/affiliate-reports-api/authentication.html - client credentials
//     made in the affiliate portal (Account -> "Open API" -> "Toevoegen"); token: POST
//     https://login.bol.com/token?grant_type=client_credentials with "Authorization: Basic base64(<id>:<secret>)",
//     no body, "Accept: application/json"; the token is a JWT for a limited time.
//   - V2 reference: https://api.bol.com/marketing/docs/affiliate-reports-api/_attachments/api-reference/apmreporting-api-v2.html
//     base https://api.bol.com/marketing/affiliate/reports/v2, GET /order-report?startDate=yyyy-MM-dd&endDate=yyyy-MM-dd
//     (both required), answer { "items": [ ... ] }; 200, 400, 403, 500. No paging: "Only request the data for the period
//     you need" (V2 API documentation, https://api.bol.com/marketing/docs/affiliate-reports-api/v2-api-documentation.html).
//   - Errors: https://api.bol.com/marketing/docs/affiliate-reports-api/errors.html (400 validation, 401 token, 500, 503).
//   - Fields of the Orders report (one row per ORDER ITEM, V2 documentation): orderDate, orderDateTime, orderId,
//     orderItemId, productTitle, productId, quantity, chunkName, siteName, siteCode, frameType, name, subId ("the
//     identifier given to the affiliate link" = the subid= of our partner link, src/lib/network-subids.js),
//     priceExclVat, priceInclVat, commissionPercentage, commission ("does not take returns and cancellations into
//     account"), status ("Open", "Geaccepteerd", "Geweigerd"), statusFinal, approvedForPayment.
// So bol is a full network here (per order item, like CJ), not an aggregated report. The Commissions and Promotions
// reports (per day/site/link, sums) are not read.
// Kept: our sub id, the status, the commission and the price including VAT as bol gives them (EUR: bol pays in euros),
// the order date/time. NOT kept: the order number (the row id is a SHA-256 of order id and order item id, so it stays
// stable without storing bol's order number), the product title and id, category, site name, link name.
// The rules of the bol tools (lessons L154): ONE token per run, no new try after 401/403/429 (many tokens can block the
// address); the keys go only to login.bol.com and the token only to api.bol.com; no redirect is followed (ctx.call).
// The Worker's credential is a SEPARATE one with access to the Reporting API (BOL_REPORTING_CLIENT_ID / _SECRET), never
// the catalog credential of tools/bol-feed-download.ps1.
import { makeRow, readJson, sha256Hex, windows, ymd } from './common.js';

export const BOL_LOGIN = 'https://login.bol.com';
export const BOL_REPORTS = 'https://api.bol.com/marketing/affiliate/reports/v2';
// No limit is documented; 30 days keeps each report small.
export const BOL_WINDOW_DAYS = 30;

export function bolStatus(r) {
  const s = String((r && r.status) || '').toLowerCase();
  if (/geweigerd|afgewezen|geannuleerd|rejected|declined|cancel/.test(s)) return 'declined';
  if (/geaccepteerd|goedgekeurd|accepted|approved/.test(s) || (r && r.approvedForPayment === true)) return 'approved';
  return 'pending';
}

export async function bolRow(r, nowIso) {
  const orderKey = `${r.orderId ?? ''}:${r.orderItemId ?? r.productId ?? ''}`;
  const id = (await sha256Hex(`bol:${orderKey}`)).slice(0, 32);
  const raw = [r.status, r.statusFinal === true ? 'final' : '', r.approvedForPayment === true ? 'paid' : ''].filter(Boolean).join('/');
  return makeRow('bol', {
    id,
    subId: r.subId,
    advertiserId: 'bol.com',
    advertiserName: 'bol.com',
    saleDate: r.orderDateTime ? String(r.orderDateTime).replace(' ', 'T') : r.orderDate,
    lockingDate: null,
    status: bolStatus(r),
    rawStatus: raw,
    sale: r.priceInclVat,
    commission: r.commission,
    currency: 'EUR'
  }, nowIso);
}

// The one token of this run.
export async function bolToken(ctx) {
  const basic = btoa(`${ctx.secret('BOL_REPORTING_CLIENT_ID')}:${ctx.secret('BOL_REPORTING_CLIENT_SECRET')}`);
  ctx.addSecret(basic);
  const res = await ctx.call(`${BOL_LOGIN}/token?grant_type=client_credentials`, {
    method: 'POST', body: '', headers: { authorization: `Basic ${basic}`, accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }
  });
  if (res.status === 401) throw new Error('bol.com refused the Reporting API keys (401): make new ones and run the setup with -Only bol');
  if (res.status === 403 || res.status === 429) throw new Error(`bol.com answered ${res.status} to the token (too many requests or blocked); no new try this run`);
  const { json } = await readJson(res);
  if (res.status !== 200 || !json || !json.access_token) throw new Error(`bol.com gave no token (HTTP ${res.status})`);
  ctx.addSecret(json.access_token);
  return String(json.access_token);
}

export const bol = {
  id: 'bol',
  label: 'bol.com',
  hosts: ['login.bol.com', 'api.bol.com'],
  secrets: ['BOL_REPORTING_CLIENT_ID', 'BOL_REPORTING_CLIENT_SECRET'],
  optionalSecrets: [],
  vars: [],
  ready: true,
  async run(ctx) {
    const token = await bolToken(ctx);
    const rows = [];
    for (const w of windows(ctx.from, ctx.now, BOL_WINDOW_DAYS)) {
      // startDate and endDate are whole days; the window's last day is asked again by the next window (no gap).
      const q = new URLSearchParams({ startDate: ymd(w.start), endDate: ymd(w.end) });
      const res = await ctx.call(`${BOL_REPORTS}/order-report?${q}`, { method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
      const { json, text } = await readJson(res);
      if (res.status === 401) throw new Error('api.bol.com refused the token (401); no new token this run');
      if (res.status === 403) throw new Error('this bol.com credential has no access to the Reporting API (403): make one with Reporting API access and run the setup with -Only bol');
      if (res.status === 429) throw new Error('api.bol.com answered 429 (too many requests); no new try this run');
      // 204 or an empty answer: no orders in this window.
      if (res.status === 204 || (res.status === 200 && !String(text || '').trim())) continue;
      if (res.status !== 200 || json === null) {
        const why = json && (json.title || json.detail) ? `: ${String(json.title || json.detail).slice(0, 100)}` : '';
        throw new Error(`api.bol.com answered ${res.status} on /order-report${why}`);
      }
      const items = Array.isArray(json) ? json : (Array.isArray(json.items) ? json.items : []);
      for (const r of items) if (r && typeof r === 'object' && (r.orderId !== undefined || r.orderItemId !== undefined)) rows.push(await bolRow(r, ctx.nowIso));
    }
    return rows;
  }
};
