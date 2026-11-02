// The one member list in the Hub (lessons L90): sign-ups from the sites only through the private address, limits,
// the copy to MailerLite (new sign-ups vs members from before), and that the key never shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import hub from '../../sites/gwh/worker.js';
import { handleInternal, syncMailerLite, isInternal, resetGroupCache, GROUP_NEW, GROUP_EXISTING, RATE_LIMIT, CONSENT_VERSION } from '../../sites/gwh/members.js';

const KEY = 'ml-key-0123456789abcdef';
const SCHEMA = `CREATE TABLE hub_subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL COLLATE NOCASE UNIQUE, locale TEXT NOT NULL DEFAULT 'en-GB', marketing_consent INTEGER NOT NULL DEFAULT 1 CHECK(marketing_consent IN (0,1)), consent_version TEXT NOT NULL DEFAULT '2026-10-05', source TEXT NOT NULL DEFAULT 'hub-homepage', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`;

function registry({ migrated = true } = {}) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(SCHEMA);
  sql.exec("INSERT INTO hub_subscribers (email) VALUES ('first@hub.example')");
  if (migrated) sql.exec(readFileSync('sites/gwh/migrations/0002_members.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.run())) };
}

function fakeMailerLite({ fail = 0 } = {}) {
  const calls = [];
  const groups = [];
  let left = fail;
  const fetchFn = async (url, init) => {
    const u = new URL(url);
    calls.push({ method: init.method, path: u.pathname + u.search, auth: init.headers.Authorization, body: init.body ? JSON.parse(init.body) : null });
    const ok = d => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (u.pathname === '/api/groups' && init.method === 'GET') return ok({ data: groups.filter(g => g.name === u.searchParams.get('filter[name]')) });
    if (u.pathname === '/api/groups' && init.method === 'POST') { const g = { id: String(100 + groups.length), name: JSON.parse(init.body).name }; groups.push(g); return ok({ data: g }); }
    if (u.pathname === '/api/subscribers') {
      if (left > 0) { left--; return new Response(`{"message":"bad ${KEY}"}`, { status: 500 }); }
      return ok({ data: { id: '1' } });
    }
    return new Response('{}', { status: 404 });
  };
  return { calls, groups, fetchFn };
}

const post = (body, host = 'hub.internal') => new Request(`https://${host}/internal/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const CLIENT = 'a'.repeat(32);

test('only the private host name is the internal address; the public site never reaches it', async () => {
  assert.equal(isInternal(new URL('https://hub.internal/internal/subscribe')), true);
  assert.equal(isInternal(new URL('https://gearworldhub.com/internal/subscribe')), false);
  const db = registry();
  const env = { gear_world_registry: db, ASSETS: { fetch: async () => new Response('asset', { status: 404 }) } };
  const pub = await hub.fetch(post({ email: 'x@y.co', consent: true, site: 'cgw', client: CLIENT }, 'gearworldhub.com'), env, { waitUntil() {} });
  assert.notEqual(pub.status, 200);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM hub_subscribers WHERE email = 'x@y.co'").get().n, 0);
  const priv = await hub.fetch(post({ email: 'x@y.co', consent: true, site: 'cgw', client: CLIENT }), env, { waitUntil() {} });
  assert.equal(priv.status, 200);
  const row = db.sql.prepare("SELECT site, source, member_source, consent_version, mailerlite_group, mailerlite_status FROM hub_subscribers WHERE email = 'x@y.co'").get();
  assert.deepEqual({ ...row }, { site: 'cgw', source: 'site-form', member_source: 'site-form:cgw', consent_version: CONSENT_VERSION, mailerlite_group: null, mailerlite_status: null });
});

test('checks: a site that is not ours, no consent, a bad address; and the limit per visitor and hour', async () => {
  const db = registry();
  const env = { gear_world_registry: db };
  assert.equal((await handleInternal(post({ email: 'a@b.co', consent: true, site: 'xyz', client: CLIENT }), env, {})).status, 400);
  assert.equal((await handleInternal(post({ email: 'a@b.co', consent: false, site: 'cgw', client: CLIENT }), env, {})).status, 400);
  assert.equal((await handleInternal(post({ email: 'nope', consent: true, site: 'cgw', client: CLIENT }), env, {})).status, 400);
  const now = Date.parse('2026-11-03T10:15:00Z');
  for (let i = 0; i < RATE_LIMIT; i++) assert.equal((await handleInternal(post({ email: `p${i}@b.co`, consent: true, site: 'tgw', client: CLIENT }), env, {}, { now })).status, 200);
  assert.equal((await handleInternal(post({ email: 'late@b.co', consent: true, site: 'tgw', client: CLIENT }), env, {}, { now })).status, 429);
  assert.equal((await handleInternal(post({ email: 'other@b.co', consent: true, site: 'tgw', client: 'b'.repeat(32) }), env, {}, { now })).status, 200, 'another visitor is not limited');
  assert.equal((await handleInternal(post({ email: 'next@b.co', consent: true, site: 'tgw', client: CLIENT }), env, {}, { now: now + 3600000 })).status, 200, 'the next hour is free again');
});

test('MailerLite: new sign-ups to "Gear World", members from before to "existing members"; groups made once; the key only in the header', async () => {
  resetGroupCache();
  const db = registry();
  db.sql.exec("INSERT INTO hub_subscribers (email, marketing_consent, mailerlite_group, first_name) VALUES ('old@rewards.example', 1, 'existing', 'Maria')");
  db.sql.exec("INSERT INTO hub_subscribers (email, marketing_consent, mailerlite_group) VALUES ('noconsent@rewards.example', 0, 'existing')");
  await handleInternal(post({ email: 'new@site.example', consent: true, site: 'kgw', client: CLIENT }), { gear_world_registry: db }, {});
  const ml = fakeMailerLite();
  const r = await syncMailerLite({ gear_world_registry: db, MAILERLITE_TOKEN: KEY }, { fetchFn: ml.fetchFn });
  assert.equal(r.ok, 3, JSON.stringify(r));
  const subs = ml.calls.filter(c => c.path === '/api/subscribers').map(c => [c.body.email, ml.groups.find(g => g.id === c.body.groups[0]).name]);
  assert.deepEqual(subs.sort(), [['first@hub.example', GROUP_EXISTING], ['new@site.example', GROUP_NEW], ['old@rewards.example', GROUP_EXISTING]]);
  assert.ok(!subs.some(s => s[0] === 'noconsent@rewards.example'), 'never without consent');
  assert.equal(ml.calls.find(c => c.body && c.body.email === 'old@rewards.example').body.fields.name, 'Maria');
  assert.equal(ml.groups.length, 2);
  assert.ok(ml.calls.every(c => c.auth === `Bearer ${KEY}` && !c.path.includes(KEY)));
  // A second run sends nobody again.
  const again = await syncMailerLite({ gear_world_registry: db, MAILERLITE_TOKEN: KEY }, { fetchFn: ml.fetchFn });
  assert.equal(again.tried, 0);
});

test('no key yet: nothing is sent and nothing is marked; a failure is tried again later, and the key never shows', async () => {
  resetGroupCache();
  const db = registry();
  const none = await syncMailerLite({ gear_world_registry: db }, { fetchFn: fakeMailerLite().fetchFn });
  assert.match(none.message, /no MailerLite key/);
  assert.equal(db.sql.prepare('SELECT mailerlite_status AS s FROM hub_subscribers').get().s, null);
  const ml = fakeMailerLite({ fail: 1 });
  const r = await syncMailerLite({ gear_world_registry: db, MAILERLITE_TOKEN: KEY }, { fetchFn: ml.fetchFn });
  assert.equal(r.failed, 1);
  assert.ok(!r.message.includes(KEY));
  assert.equal(db.sql.prepare('SELECT mailerlite_status AS s, mailerlite_tries AS t FROM hub_subscribers').get().s, 'error');
  const r2 = await syncMailerLite({ gear_world_registry: db, MAILERLITE_TOKEN: KEY }, { fetchFn: ml.fetchFn });
  assert.equal(r2.ok, 1);
  assert.equal(db.sql.prepare('SELECT mailerlite_status AS s FROM hub_subscribers').get().s, 'ok');
});

test('the migration only adds: the row already there is kept and marked as an existing member', () => {
  const db = registry();
  const row = db.sql.prepare('SELECT email, marketing_consent, mailerlite_group FROM hub_subscribers').get();
  assert.deepEqual({ ...row }, { email: 'first@hub.example', marketing_consent: 1, mailerlite_group: 'existing' });
  const text = readFileSync('sites/gwh/migrations/0002_members.sql', 'utf8');
  assert.doesNotMatch(text.replace(/--.*$/gm, ''), /\b(DROP|DELETE)\b/i);
});

test('the Hub runs the copy on its cron', async () => {
  resetGroupCache();
  const db = registry();
  const waits = [];
  await hub.scheduled({}, { gear_world_registry: db }, { waitUntil: p => waits.push(p) });
  const [r] = await Promise.all(waits);
  assert.match(r.message, /no MailerLite key/);
});
