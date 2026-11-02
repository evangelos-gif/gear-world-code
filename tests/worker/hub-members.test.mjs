// "Get deal updates" into the one member list of the Hub (lessons L92): sign-ups from the sites only through the
// private address, limits, the same way to MailerLite as the Hub form (mailerlite.js), and Rewards members on hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import hub from '../../sites/gwh/worker.js';
import { handleInternal, isInternal, RATE_LIMIT, CONSENT_VERSION } from '../../sites/gwh/members.js';
import { syncOne, syncPending, resetMailerLiteCache, GROUP_NAME, SOURCE_FIELD } from '../../sites/gwh/mailerlite.js';

const KEY = 'ml-key-0123456789abcdef';

// The live table: as it was before migration 0002, then 0002 (email step 5) and 0003 (members), like on 02/11/2026.
function registry() {
  const sql = new DatabaseSync(':memory:');
  const schema = readFileSync('sites/gwh/schema.sql', 'utf8');
  const table = schema.match(/CREATE TABLE hub_subscribers \([^;]+\);/)[0].replace(/, ml_status TEXT[^;]*\);$/, ');');
  assert.ok(!table.includes('ml_status') && !table.includes('member_source'));
  sql.exec(table);
  sql.exec("INSERT INTO hub_subscribers (email) VALUES ('first@hub.example')");
  sql.exec(readFileSync('sites/gwh/migrations/0002_mailerlite_sync.sql', 'utf8'));
  sql.exec(readFileSync('sites/gwh/migrations/0003_members.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text) };
}

function fakeMailerLite() {
  const calls = [];
  const impl = async (url, init = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method: init.method, path: u.pathname, body, auth: init.headers && init.headers.Authorization });
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.pathname === '/api/groups' && init.method === 'GET') return json(200, { data: [{ id: '1700', name: GROUP_NAME }] });
    if (u.pathname === '/api/fields' && init.method === 'GET') return json(200, { data: [{ id: 7, key: SOURCE_FIELD }] });
    if (u.pathname === '/api/subscribers' && init.method === 'POST') return json(201, { data: { id: '55' } });
    return json(404, {});
  };
  return { calls, impl };
}

const post = (body, host = 'hub.internal') => new Request(`https://${host}/internal/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const CLIENT = 'a'.repeat(32);
const get = (db, email) => ({ ...db.sql.prepare('SELECT * FROM hub_subscribers WHERE email = ?').get(email) });

test('only the private host name is the internal address; the public site never reaches it', async () => {
  assert.equal(isInternal(new URL('https://hub.internal/internal/subscribe')), true);
  assert.equal(isInternal(new URL('https://gearworldhub.com/internal/subscribe')), false);
  const db = registry();
  const env = { gear_world_registry: db, ASSETS: { fetch: async () => new Response('asset', { status: 404 }) } };
  const pub = await hub.fetch(post({ email: 'x@y.co', consent: true, site: 'cgw', client: CLIENT }, 'gearworldhub.com'), env, { waitUntil() {} });
  assert.notEqual(pub.status, 200);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM hub_subscribers WHERE email = 'x@y.co'").get().n, 0);
  const priv = await hub.fetch(post({ email: ' X@Y.co ', consent: true, site: 'cgw', client: CLIENT }), env, { waitUntil() {} });
  assert.equal(priv.status, 200);
  const r = get(db, 'x@y.co');
  // Exactly like a sign-up on the Hub form: 'pending' for mailerlite.js, the site code as source (MailerLite source_site).
  assert.deepEqual([r.site, r.source, r.member_source, r.consent_version, r.ml_status, r.marketing_consent, r.status],
    ['cgw', 'cgw', 'site-form:cgw', CONSENT_VERSION, 'pending', 1, 'active']);
});

test('checks: a site that is not ours, no consent, a bad address; and the limit per visitor and hour', async () => {
  const db = registry();
  const env = { gear_world_registry: db };
  const none = { sync: async () => 'pending' };
  assert.equal((await handleInternal(post({ email: 'a@b.co', consent: true, site: 'xyz', client: CLIENT }), env, {}, none)).status, 400);
  assert.equal((await handleInternal(post({ email: 'a@b.co', consent: false, site: 'cgw', client: CLIENT }), env, {}, none)).status, 400);
  assert.equal((await handleInternal(post({ email: 'nope', consent: true, site: 'cgw', client: CLIENT }), env, {}, none)).status, 400);
  const now = Date.parse('2026-11-03T10:15:00Z');
  for (let i = 0; i < RATE_LIMIT; i++) assert.equal((await handleInternal(post({ email: `p${i}@b.co`, consent: true, site: 'tgw', client: CLIENT }), env, {}, { now, ...none })).status, 200);
  assert.equal((await handleInternal(post({ email: 'late@b.co', consent: true, site: 'tgw', client: CLIENT }), env, {}, { now, ...none })).status, 429);
  assert.equal((await handleInternal(post({ email: 'other@b.co', consent: true, site: 'tgw', client: 'b'.repeat(32) }), env, {}, { now, ...none })).status, 200, 'another visitor is not limited');
  assert.equal((await handleInternal(post({ email: 'next@b.co', consent: true, site: 'tgw', client: CLIENT }), env, {}, { now: now + 3600000, ...none })).status, 200, 'the next hour is free again');
});

test('a site sign-up goes to MailerLite the same way as the Hub form: group "Gear World subscribers", source_site, key only in the header', async () => {
  resetMailerLiteCache();
  const db = registry();
  const env = { gear_world_registry: db, MAILERLITE_API_KEY: KEY };
  const ml = fakeMailerLite();
  const waits = [];
  const r = await handleInternal(post({ email: 'new@site.example', consent: true, site: 'kgw', client: CLIENT }), env, { waitUntil: p => waits.push(p) }, { sync: (e, email) => syncOne(e, email, ml.impl) });
  assert.equal(r.status, 200);
  await Promise.all(waits);
  const sub = ml.calls.find(c => c.path === '/api/subscribers');
  assert.deepEqual([sub.body.email, sub.body.groups, sub.body.fields[SOURCE_FIELD]], ['new@site.example', ['1700'], 'kgw']);
  assert.ok(ml.calls.every(c => c.auth === `Bearer ${KEY}`));
  assert.equal(get(db, 'new@site.example').ml_status, 'synced');
});

test('Rewards members on hold are never sent by the timer; one who signs up again on a site gives new consent and is sent', async () => {
  resetMailerLiteCache();
  const db = registry();
  db.sql.exec("INSERT INTO hub_subscribers (email, marketing_consent, source, member_source, ml_status) VALUES ('old@rewards.example', 1, 'rewards-cgw', 'rewards:cgw', 'hold')");
  const env = { gear_world_registry: db, MAILERLITE_API_KEY: KEY };
  const ml = fakeMailerLite();
  const first = await syncPending(env, ml.impl);
  assert.equal(ml.calls.filter(c => c.path === '/api/subscribers').length, 0, JSON.stringify(first));
  assert.equal(get(db, 'old@rewards.example').ml_status, 'hold');
  await handleInternal(post({ email: 'old@rewards.example', consent: true, site: 'cgw', client: CLIENT }), env, {}, { sync: async () => 'pending' });
  const again = get(db, 'old@rewards.example');
  assert.deepEqual([again.ml_status, again.source, again.member_source, again.consent_version], ['pending', 'cgw', 'rewards:cgw', CONSENT_VERSION]);
  await syncPending(env, ml.impl);
  assert.deepEqual(ml.calls.filter(c => c.path === '/api/subscribers').map(c => c.body.email), ['old@rewards.example']);
});

test('the test address of the Hub answers but writes nothing', async () => {
  const db = registry();
  const r = await handleInternal(post({ email: 'p@b.co', consent: true, site: 'cgw', client: CLIENT }), { gear_world_registry: db, GWH_PREVIEW: '1' }, {}, { sync: async () => { throw new Error('never'); } });
  assert.equal(r.status, 200);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM hub_subscribers WHERE email = 'p@b.co'").get().n, 0);
});

test('migration 0003 only adds: the row already there is kept', () => {
  const db = registry();
  const row = get(db, 'first@hub.example');
  assert.deepEqual([row.email, row.marketing_consent, row.ml_status], ['first@hub.example', 1, 'hold']);
  const text = readFileSync('sites/gwh/migrations/0003_members.sql', 'utf8');
  assert.doesNotMatch(text.replace(/--.*$/gm, ''), /\b(DROP|DELETE)\b/i);
});
