// "Remind me on 27 Nov" of the 13 sites at the Hub (lessons L182), and the small sign-up window counted apart.
// - Only through the private address (hub.internal), with the Turnstile token of the site's widget.
// - D1 first (remind_signups, migration 0004), then MailerLite: the group "Gear World Remind me 27 Nov" (looked up,
//   never made), the remind_* fields, never the group "Gear World subscribers", no status (an unsubscribed address
//   stays unsubscribed). The three most recent products. Closed after 27 Nov; the rows deleted from 28 Nov.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import hub from '../../sites/gwh/worker.js';
import { handleRemind, syncRemind, remindCron, remindItem, mergeItems, remindFields, resetRemindCache, REMIND_GROUP, REMIND_UNTIL, REMIND_DELETE_FROM, SITE_NAMES } from '../../sites/gwh/remind.js';
import { handleInternal } from '../../sites/gwh/members.js';
import { handleSubscribe, GROUP_NAME } from '../../sites/gwh/mailerlite.js';
import { SITE_DOMAINS, TURNSTILE_VERIFY_URL } from '../../sites/gwh/security.js';

const TS = { TURNSTILE_SECRET_KEY: 'secret-widget-1', TURNSTILE_SECRET_KEY_2: 'secret-widget-2' };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) !== TURNSTILE_VERIFY_URL) return realFetch(url, init);
  const form = Object.fromEntries(new URLSearchParams(String(init.body)));
  const m = /^ok:([^:]+)(?::(.+))?$/.exec(form.response);
  return Response.json(m ? { success: true, hostname: m[1], action: m[2] || 'deal-updates' } : { success: false, 'error-codes': ['invalid-input-response'] });
};
const KEY = 'ml-key-0123456789abcdef';
const NOW = Date.parse('2026-11-21T10:00:00Z');

function registry({ remind = true } = {}) {
  const sql = new DatabaseSync(':memory:');
  const schema = readFileSync('sites/gwh/schema.sql', 'utf8');
  sql.exec(schema.match(/CREATE TABLE hub_subscribers \([^;]+\);/)[0].replace(/, ml_status TEXT[^;]*\);$/, ');'));
  sql.exec(readFileSync('sites/gwh/migrations/0002_mailerlite_sync.sql', 'utf8'));
  sql.exec(readFileSync('sites/gwh/migrations/0003_members.sql', 'utf8'));
  if (remind) sql.exec(readFileSync('sites/gwh/migrations/0004_remind.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text) };
}

function fakeMailerLite({ subscribeStatus = 201, groups = [{ id: '1700', name: GROUP_NAME }, { id: '2800', name: REMIND_GROUP }] } = {}) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method: init.method, path: u.pathname, query: u.search, body });
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.pathname === '/api/groups' && init.method === 'GET') return json(200, { data: groups });
    if (u.pathname === '/api/subscribers' && init.method === 'POST') return json(subscribeStatus, subscribeStatus < 300 ? { data: { id: '55' } } : { message: 'refused' });
    if (u.pathname === '/api/groups' && init.method === 'POST') return json(201, { data: { id: '9999' } });
    return json(404, {});
  };
  return { calls, impl };
}

const product = (site, id = 1234, slug = 'makita-drill') => ({ id, name: `Product ${id}`, url: `https://${SITE_DOMAINS[site]}/product/${slug}-${id}/` });
const body = (o = {}) => ({ email: 'Rem@Example.com', consent: true, site: 'cgw', client: 'a'.repeat(32), product: product('cgw'), turnstile_token: `ok:${SITE_DOMAINS[o.site || 'cgw']}`, ...o });
const post = b => new Request('https://hub.internal/internal/remind', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const row = (db, email) => db.sql.prepare('SELECT * FROM remind_signups WHERE email = ?').get(email);

test('GET: open while the table exists and until the end of 27 Nov (London); the sites get it through hub.internal only', async () => {
  resetRemindCache();
  const env = { gear_world_registry: registry(), ...TS };
  const open = await (await handleRemind(new Request('https://hub.internal/internal/remind'), env, null, { now: NOW })).json();
  assert.deepEqual(open, { ok: true, open: true, until: '2026-11-27T23:59:59Z' });
  assert.equal((await (await handleRemind(new Request('https://hub.internal/internal/remind'), env, null, { now: REMIND_UNTIL + 1 })).json()).open, false);
  resetRemindCache();
  const before = { gear_world_registry: registry({ remind: false }), ...TS };
  assert.equal((await (await handleRemind(new Request('https://hub.internal/internal/remind'), before, null, { now: NOW })).json()).open, false, 'no table yet: closed');
  // Through the Worker: the private host answers; the public one never reaches it.
  resetRemindCache();
  const assets = { fetch: async () => new Response('asset', { status: 404 }) };
  const viaWorker = await hub.fetch(new Request('https://hub.internal/internal/remind'), { ...env, ASSETS: assets }, { waitUntil() {} });
  assert.equal(viaWorker.status, 200);
  assert.equal(typeof (await viaWorker.json()).open, 'boolean');
  const pub = await hub.fetch(new Request('https://gearworldhub.com/internal/remind', { method: 'POST', body: '{}' }), { ...env, ASSETS: assets }, { waitUntil() {} });
  assert.notEqual(pub.status, 200);
});

test('POST: D1 first, then MailerLite with the remind fields in the Remind group only, never the weekly list, no status', async () => {
  resetRemindCache();
  const db = registry();
  const ml = fakeMailerLite();
  const env = { gear_world_registry: db, MAILERLITE_API_KEY: KEY, ...TS };
  const r = await handleRemind(post(body()), env, null, { now: NOW, sync: (e, email) => syncRemind(e, email, ml.impl) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  const saved = row(db, 'rem@example.com');
  assert.equal(saved.ml_status, 'synced');
  assert.equal(saved.consent_version, '2026-11-19-remind');
  assert.deepEqual(JSON.parse(saved.items), [{ ...product('cgw'), site: 'cgw', at: '2026-11-21' }]);
  const sub = ml.calls.find(c => c.path === '/api/subscribers');
  assert.deepEqual(sub.body.groups, ['2800'], 'only the Remind group');
  assert.ok(!('status' in sub.body), 'no status: an unsubscribed address is not subscribed again');
  assert.equal(sub.body.fields.remind_name_1, 'Product 1234');
  assert.equal(sub.body.fields.remind_url_1, 'https://constructiongearworld.com/product/makita-drill-1234/');
  assert.equal(sub.body.fields.remind_site_1, 'Construction Gear World');
  assert.match(sub.body.fields.remind_signup_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!ml.calls.some(c => c.method === 'POST' && c.path === '/api/groups'), 'the group is never made here');
  // Nothing went into the weekly list.
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM hub_subscribers').get().n, 0);
});

test('the three most recent products, a product chosen again moves to the top, other sites keep their own address', async () => {
  resetRemindCache();
  const db = registry();
  const env = { gear_world_registry: db, ...TS };
  const send = async (site, id) => (await handleRemind(post(body({ site, product: product(site, id), turnstile_token: `ok:${SITE_DOMAINS[site]}` })), env, null, { now: NOW, sync: async () => 'pending' })).status;
  assert.equal(await send('cgw', 1), 200);
  assert.equal(await send('hgw', 2), 200);
  assert.equal(await send('tgw', 3), 200);
  assert.equal(await send('cgw', 4), 200);
  let items = JSON.parse(row(db, 'rem@example.com').items);
  assert.deepEqual(items.map(x => `${x.site}-${x.id}`), ['cgw-4', 'tgw-3', 'hgw-2']);
  assert.equal(await send('hgw', 2), 200);
  items = JSON.parse(row(db, 'rem@example.com').items);
  assert.deepEqual(items.map(x => `${x.site}-${x.id}`), ['hgw-2', 'cgw-4', 'tgw-3']);
  const f = remindFields(items, '2026-11-21 10:00:00');
  assert.deepEqual(f, {
    remind_name_1: 'Product 2', remind_url_1: 'https://homegearworld.com/product/makita-drill-2/', remind_site_1: 'Home Gear World',
    remind_name_2: 'Product 4', remind_url_2: 'https://constructiongearworld.com/product/makita-drill-4/', remind_site_2: 'Construction Gear World',
    remind_name_3: 'Product 3', remind_url_3: 'https://technologygearworld.com/product/makita-drill-3/', remind_site_3: 'Technology Gear World',
    remind_signup_date: '2026-11-21'
  });
  assert.deepEqual(mergeItems('not json', { site: 'agw', id: 9, name: 'x y', url: 'u' }, '2026-11-21').length, 1);
});

test('refused: no consent, a bad address or site, a product address that is not the site\'s own page, no or a wrong token, after 27 Nov', async () => {
  resetRemindCache();
  const db = registry();
  const env = { gear_world_registry: db, ...TS };
  const send = async (b, now = NOW) => { const r = await handleRemind(post(b), env, null, { now, sync: async () => 'pending' }); return [r.status, (await r.json()).error]; };
  assert.deepEqual(await send(body({ consent: 'yes' })), [400, 'consent_required']);
  assert.deepEqual(await send(body({ email: 'nope' })), [400, 'invalid_email']);
  assert.deepEqual(await send(body({ site: 'xyz' })), [400, 'site']);
  for (const p of [
    { id: 1234, name: 'A drill', url: 'https://constructiongearworld.com/out/1234' },
    { id: 1234, name: 'A drill', url: 'https://constructiongearworld.com/go/abc' },
    { id: 1234, name: 'A drill', url: 'https://evil.example/product/x-1234/' },
    { id: 1234, name: 'A drill', url: 'https://homegearworld.com/product/x-1234/' },
    { id: 1234, name: 'A drill', url: 'https://constructiongearworld.com/product/x-999/' },
    { id: 1234, name: 'A drill', url: 'http://constructiongearworld.com/product/x-1234/' },
    { id: 0, name: 'A drill', url: 'https://constructiongearworld.com/product/x-0/' },
    { id: 1234, name: '', url: 'https://constructiongearworld.com/product/x-1234/' }
  ]) assert.deepEqual(await send(body({ product: p })), [400, 'product'], p.url);
  assert.deepEqual(await send(body({ turnstile_token: '' })), [403, 'turnstile_required']);
  assert.deepEqual(await send(body({ turnstile_token: 'ok:homegearworld.com' })), [403, 'turnstile_failed'], 'another site\'s token');
  assert.deepEqual(await send(body(), REMIND_UNTIL + 1), [410, 'closed']);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM remind_signups').get().n, 0);
  // Before the migration: closed, nothing written.
  resetRemindCache();
  const before = { gear_world_registry: registry({ remind: false }), ...TS };
  const r = await handleRemind(post(body()), before, null, { now: NOW, sync: async () => 'pending' });
  assert.equal(r.status, 410);
  // The test address of the Hub answers but writes nothing.
  resetRemindCache();
  const preview = await handleRemind(post(body()), { ...env, GWH_PREVIEW: '1' }, null, { now: NOW, sync: async () => 'pending' });
  assert.deepEqual(await preview.json(), { ok: true, preview: true });
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM remind_signups').get().n, 0);
  // A product name is cleaned and cut.
  assert.equal(remindItem('cgw', { id: 5, name: ` A\u0000 drill\n${'x'.repeat(300)}`, url: 'https://constructiongearworld.com/product/a-5/' }).name.length, 200);
});

test('limits: 5 attempts per site, visitor key and hour', async () => {
  resetRemindCache();
  const db = registry();
  const env = { gear_world_registry: db, ...TS };
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await handleRemind(post(body({ email: `p${i}@example.com` })), env, null, { now: NOW, sync: async () => 'pending' })).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);
});

test('MailerLite: a refused (unsubscribed) address is not tried again; a missing group or an outage leaves the row for the cron', async () => {
  resetRemindCache();
  const db = registry();
  const env = { gear_world_registry: db, MAILERLITE_API_KEY: KEY, ...TS };
  const refused = fakeMailerLite({ subscribeStatus: 422 });
  await handleRemind(post(body({ email: 'gone@example.com' })), env, null, { now: NOW, sync: (e, m) => syncRemind(e, m, refused.impl) });
  assert.equal(row(db, 'gone@example.com').ml_status, 'failed');
  resetRemindCache();
  const noGroup = fakeMailerLite({ groups: [{ id: '1700', name: GROUP_NAME }] });
  await handleRemind(post(body({ email: 'wait@example.com' })), env, null, { now: NOW, sync: (e, m) => syncRemind(e, m, noGroup.impl) });
  assert.equal(row(db, 'wait@example.com').ml_status, 'pending');
  assert.match(row(db, 'wait@example.com').ml_error, /missing/);
  assert.ok(!noGroup.calls.some(c => c.method === 'POST'), 'never made, never added to another group');
  resetRemindCache();
  const ok = fakeMailerLite();
  const cron = await remindCron(env, ok.impl, NOW);
  assert.deepEqual(cron, { tried: 1, synced: 1, deleted: 0 });
  assert.equal(row(db, 'wait@example.com').ml_status, 'synced');
  // From 28 Nov 2026 12:00 UTC the cron deletes every row.
  const del = await remindCron(env, ok.impl, REMIND_DELETE_FROM);
  assert.equal(del.deleted, 2);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM remind_signups').get().n, 0);
  // Before the migration the cron does nothing and does not fail.
  assert.deepEqual(await remindCron({ gear_world_registry: registry({ remind: false }), MAILERLITE_API_KEY: KEY }, ok.impl, NOW), { tried: 0, synced: 0, deleted: 0 });
});

test('the site names match the 13 site configs; the sites\' and the Hub\'s dates agree', async () => {
  for (const [code, name] of Object.entries(SITE_NAMES)) {
    const cfg = readFileSync(`sites/${code}/site.config.js`, 'utf8');
    assert.ok(cfg.includes(`name: '${name.replace(/'/g, "\\'")}'`) || cfg.includes(`name: "${name}"`), `${code}: ${name}`);
  }
  assert.deepEqual(Object.keys(SITE_NAMES).sort(), Object.keys(SITE_DOMAINS).sort());
  assert.equal(REMIND_UNTIL, Date.parse('2026-11-27T23:59:59Z'));
  assert.equal(REMIND_DELETE_FROM, Date.parse('2026-11-28T12:00:00Z'));
});

test('the small sign-up window is counted apart: site-popup:<site> from a site, hub-popup on the Hub; an address keeps where it first came from', async () => {
  const db = registry();
  const env = { gear_world_registry: db, ...TS };
  const sitePost = b => new Request('https://hub.internal/internal/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: true, client: 'b'.repeat(32), turnstile_token: `ok:${SITE_DOMAINS[b.site]}`, ...b }) });
  assert.equal((await handleInternal(sitePost({ email: 'pop@example.com', site: 'tgw', form: 'popup' }), env, null, { sync: async () => 'pending' })).status, 200);
  assert.equal((await handleInternal(sitePost({ email: 'box@example.com', site: 'tgw', form: 'box' }), env, null, { sync: async () => 'pending' })).status, 200);
  assert.equal((await handleInternal(sitePost({ email: 'pop@example.com', site: 'cgw' }), env, null, { sync: async () => 'pending' })).status, 200);
  const src = e => db.sql.prepare('SELECT member_source FROM hub_subscribers WHERE email = ?').get(e).member_source;
  assert.equal(src('pop@example.com'), 'site-popup:tgw');
  assert.equal(src('box@example.com'), 'site-form:tgw');
  // The Hub's own window (home page).
  const hubReq = b => new Request('https://gearworldhub.com/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://gearworldhub.com' }, body: JSON.stringify(b) });
  const r = await handleSubscribe(hubReq({ email: 'hubpop@example.com', consent: true, source: 'hub', form: 'popup', turnstile_token: 'ok:gearworldhub.com:hub-signup' }), env, null);
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal(src('hubpop@example.com'), 'hub-popup');
  await handleSubscribe(hubReq({ email: 'hubbox@example.com', consent: true, source: 'hub', turnstile_token: 'ok:gearworldhub.com:hub-signup' }), env, null);
  assert.equal(src('hubbox@example.com'), null);
});

test('the D1 tool: read-only without -Apply, its own phrase, a restore point before the table, only CREATE, a rollback', () => {
  const raw = readFileSync('tools/gwh-remind-d1.ps1');
  assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 with BOM');
  const ps = raw.toString('utf8');
  assert.ok(!/(^|[^\r])\n/.test(ps), 'CRLF only');
  assert.match(ps, /\$Phrase = 'ΕΓΚΡΙΝΩ REMIND ME D1'/);
  assert.match(ps, /\$Migration = 'migrations\/0004_remind\.sql'/);
  assert.match(ps, /if \(-not \$Apply\) \{ Say ''; Say 'Δοκιμή μόνο \(χωρίς -Apply\): δεν άλλαξε τίποτα\.' \$Ok; Finish 0 \}/);
  assert.ok(ps.indexOf("d1 time-travel info") < ps.indexOf("--file \"{1}\""), 'the restore point first');
  assert.match(ps, /DROP TABLE IF EXISTS \{1\}/, 'the rollback is written');
  assert.match(ps, /GWH_REMIND_D1_/);
  assert.doesNotMatch(ps, /\?\?|::new\(|-Parallel|-AsHashtable/, 'Windows PowerShell 5.1 syntax');
  const sql = readFileSync('sites/gwh/migrations/0004_remind.sql', 'utf8').replace(/--[^\n]*/g, '');
  assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE|ALTER|INSERT)\b/i, 'only CREATE');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS remind_signups/);
  assert.match(readFileSync('README.md', 'utf8'), /\| `tools\/gwh-remind-d1\.ps1` \|[^\n]*«ΕΓΚΡΙΝΩ REMIND ME D1»/);
});

test('the Hub release tool takes remind.js with the other server files (worker.js imports it)', () => {
  const ps = readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
  assert.match(ps, /\$newFiles = @\([^)]*'remind\.js'\)/);
  assert.match(readFileSync('sites/gwh/worker.js', 'utf8'), /from "\.\/remind\.js"/);
});
