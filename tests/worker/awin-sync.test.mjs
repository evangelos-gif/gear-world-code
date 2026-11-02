// Awin sales into the private dashboard (lessons L89): what is read from Awin, what is kept, and that a failure never
// loses data or shows the token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { syncAwin, createAwinSync, siteOf, productRefOf, money, toRow, windows, SITE_CODES, FIRST_DAY, MAX_CALLS } from '../../src/awin-sync.js';

const TOKEN = 'tok-1234567890abcdef';
const NOW = new Date('2026-11-02T12:00:00Z');

function fakeD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('sites/awin/migrations/0001_awin.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.run())) };
}

const tx = (id, over = {}) => ({
  id, advertiserId: 496, type: 'Sale', transactionDate: '2026-10-20T10:00:00', validationDate: null,
  commissionStatus: 'pending', paidToPublisher: false, saleAmount: { amount: 13.29, currency: 'GBP' },
  commissionAmount: { amount: 0.4, currency: 'GBP' }, clickRefs: { clickRef: 'cgw-82540' },
  customerCountry: 'GB', orderRef: 'ORDER-SECRET-1', basketProducts: [{ name: 'x' }], ...over
});

// A fake Awin: answers by path, and writes down every call (URL and headers).
function fakeAwin(answers = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url: new URL(url), headers: init.headers });
    const u = new URL(url);
    for (const [k, v] of Object.entries(answers)) {
      if (u.pathname.includes(k)) {
        const a = typeof v === 'function' ? v(u) : v;
        if (a instanceof Response) return a;
        return new Response(JSON.stringify(a), { headers: { 'Content-Type': 'application/json' } });
      }
    }
    return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
  };
  return { calls, fetchFn };
}
const ACCOUNTS = { userId: 1, accounts: [{ accountId: 3000001, accountName: 'Gear World', accountType: 'publisher', userRole: 'admin' }, { accountId: 9, accountType: 'advertiser' }] };

test('the site and product come from our own clickref', () => {
  assert.equal(siteOf('cgw-82540'), 'cgw');
  assert.equal(siteOf('TGW-promo-joybuy-halloween'), 'tgw');
  assert.equal(productRefOf('tgw-promo-joybuy-halloween'), 'promo-joybuy-halloween');
  assert.equal(siteOf('xyz-1'), 'unknown', 'not one of our sites');
  assert.equal(siteOf(''), 'unknown');
  assert.equal(siteOf(null), 'unknown');
  assert.equal(productRefOf('nothing'), null);
  for (const c of ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw', 'tgw', 'agw', 'vgw', 'sgw', 'bgw', 'pgw']) assert.ok(SITE_CODES.includes(c), c);
});

test('money is read whether Awin sends numbers or text', () => {
  assert.deepEqual(money({ amount: 13.29, currency: 'GBP' }), { amount: 13.29, currency: 'GBP' });
  assert.deepEqual(money({ amount: '0.40', currency: 'GBP' }), { amount: 0.4, currency: 'GBP' });
  assert.deepEqual(money(null), { amount: null, currency: null });
  assert.deepEqual(money({ amount: 'n/a' }), { amount: null, currency: null });
});

test('only the listed fields are kept: no order reference, basket or customer country', () => {
  const r = toRow(tx('1'), '3000001', NOW.toISOString());
  assert.deepEqual(Object.keys(r).sort(), ['advertiser_id', 'click_ref', 'commission_amount', 'commission_currency', 'decline_reason', 'first_seen_at', 'id',
    'paid_to_publisher', 'product_ref', 'publisher_id', 'sale_amount', 'sale_currency', 'site', 'status', 'transaction_date', 'type', 'updated_at', 'validation_date']);
  assert.ok(!JSON.stringify(r).includes('ORDER-SECRET'));
  assert.equal(r.site, 'cgw');
  assert.equal(r.commission_amount, 0.4);
});

test('date windows are at most 30 days (Awin allows 31), back to back, oldest first', () => {
  const w = windows(FIRST_DAY, NOW);
  assert.ok(w.length >= 4);
  assert.equal(w[0].start, '2026-08-01T00:00:00');
  assert.equal(w[w.length - 1].end, '2026-11-02T12:00:00');
  for (let i = 0; i < w.length; i++) {
    const days = (Date.parse(w[i].end + 'Z') - Date.parse(w[i].start + 'Z')) / 864e5;
    assert.ok(days <= 30, `window ${i} is ${days} days`);
    if (i) assert.equal(Date.parse(w[i].start + 'Z') - Date.parse(w[i - 1].end + 'Z'), 1000, 'no gap, no overlap');
  }
});

test('first run: reads from August, keeps the sales, the shop names and a run row; the token only in the header', async () => {
  const db = fakeD1();
  const awin = fakeAwin({
    '/accounts': ACCOUNTS,
    '/programmes': [{ id: 496, name: 'Tooled Up' }],
    '/transactions/': u => (u.searchParams.get('dateType') === 'transaction' && u.searchParams.get('startDate').startsWith('2026-10') ? [tx('1'), tx('2', { clickRefs: null })] : [])
  });
  const run = await syncAwin({ AWIN_DB: db, AWIN_TOKEN: TOKEN }, { fetchFn: awin.fetchFn, now: NOW });
  assert.equal(run.ok, true, run.message);
  assert.equal(run.saved, 2);
  assert.ok(run.calls <= MAX_CALLS);
  const rows = db.sql.prepare('SELECT id, site, status FROM awin_transactions ORDER BY id').all();
  assert.deepEqual(rows.map(r => [r.id, r.site, r.status]), [['1', 'cgw', 'pending'], ['2', 'unknown', 'pending']]);
  assert.equal(db.sql.prepare('SELECT name FROM awin_advertisers').get().name, 'Tooled Up');
  assert.equal(db.sql.prepare('SELECT ok FROM awin_sync_runs').get().ok, 1);
  const tCalls = awin.calls.filter(c => c.url.pathname.endsWith('/transactions/'));
  assert.equal(tCalls[0].url.searchParams.get('startDate'), '2026-08-01T00:00:00', 'the first run starts at FIRST_DAY');
  assert.ok(tCalls.every(c => c.url.pathname === '/publishers/3000001/transactions/'), 'only the publisher account, never the advertiser one');
  for (const c of awin.calls) {
    assert.equal(c.headers.Authorization, `Bearer ${TOKEN}`);
    assert.ok(!c.url.toString().includes(TOKEN), 'the token is never in the address');
  }
});

test('a later run reads the last 90 days again and updates a status without a second row; the first-seen date stays', async () => {
  const db = fakeD1();
  const first = fakeAwin({ '/accounts': ACCOUNTS, '/transactions/': u => (u.searchParams.get('startDate').startsWith('2026-10') ? [tx('1')] : []) });
  await syncAwin({ AWIN_DB: db, AWIN_TOKEN: TOKEN }, { fetchFn: first.fetchFn, now: NOW });
  const later = new Date('2026-11-20T12:00:00Z');
  const second = fakeAwin({ '/accounts': ACCOUNTS, '/transactions/': u => (u.searchParams.get('dateType') === 'validation' ? [tx('1', { commissionStatus: 'approved', validationDate: '2026-11-19T09:00:00' })] : []) });
  const run = await syncAwin({ AWIN_DB: db, AWIN_TOKEN: TOKEN }, { fetchFn: second.fetchFn, now: later });
  assert.equal(run.ok, true, run.message);
  const rows = db.sql.prepare('SELECT status, first_seen_at, updated_at FROM awin_transactions').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'approved');
  assert.equal(rows[0].first_seen_at, NOW.toISOString());
  assert.equal(rows[0].updated_at, later.toISOString());
  const starts = second.calls.filter(c => c.url.searchParams.get('dateType') === 'transaction').map(c => c.url.searchParams.get('startDate'));
  assert.equal(starts[0], '2026-08-22T12:00:00', '90 days back, not from August');
});

test('a refused token, no token or an Awin error: nothing is lost, the run says why, and the token never shows', async () => {
  const db = fakeD1();
  db.sql.exec("INSERT INTO awin_transactions (id, publisher_id, site, first_seen_at, updated_at, status) VALUES ('old', '1', 'cgw', 'x', 'x', 'pending')");
  const refused = fakeAwin({ '/accounts': new Response(`bad token ${TOKEN}`, { status: 401 }) });
  const r1 = await syncAwin({ AWIN_DB: db, AWIN_TOKEN: TOKEN }, { fetchFn: refused.fetchFn, now: NOW });
  assert.equal(r1.ok, false);
  assert.match(r1.message, /token was refused/);
  assert.ok(!r1.message.includes(TOKEN));
  const r2 = await syncAwin({ AWIN_DB: db }, { fetchFn: refused.fetchFn, now: NOW });
  assert.match(r2.message, /no Awin token/);
  const busy = fakeAwin({ '/accounts': ACCOUNTS, '/transactions/': new Response('slow down', { status: 429 }) });
  const r3 = await syncAwin({ AWIN_DB: db, AWIN_TOKEN: TOKEN }, { fetchFn: busy.fetchFn, now: NOW });
  assert.match(r3.message, /rate limit/);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM awin_transactions').get().n, 1, 'the old sale is still there');
  const runs = db.sql.prepare('SELECT ok, message FROM awin_sync_runs ORDER BY id').all();
  assert.deepEqual(runs.map(r => r.ok), [0, 0, 0]);
  assert.ok(runs.every(r => !String(r.message).includes(TOKEN)));
});

test('the Worker has no public answer and runs the sync on its cron', async () => {
  const w = createAwinSync({ fetchFn: fakeAwin({ '/accounts': ACCOUNTS }).fetchFn });
  assert.equal((await w.fetch(new Request('https://x/anything'))).status, 404);
  const db = fakeD1();
  const waits = [];
  await w.scheduled({}, { AWIN_DB: db, AWIN_TOKEN: TOKEN }, { waitUntil: p => waits.push(p) });
  await Promise.all(waits);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM awin_sync_runs').get().n, 1);
});

test('the config template has no public address, a cron, and no real ID', () => {
  const t = readFileSync('sites/awin/wrangler.jsonc.example', 'utf8');
  assert.match(t, /"workers_dev": false/);
  assert.match(t, /"preview_urls": false/);
  assert.match(t, /"crons": \["23 \*\/2 \* \* \*"\]/);
  assert.match(t, /REPLACE_WITH_DATABASE_ID/);
  assert.doesNotMatch(t, /"routes"/);
  assert.doesNotMatch(t, /AWIN_TOKEN"\s*:/, 'the token is a secret, never a var');
});
