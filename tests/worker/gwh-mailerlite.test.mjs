// Gear World Hub: email sign-ups to MailerLite (sites/gwh/mailerlite.js, migration 0002, route in worker.js).
// A real SQLite (node:sqlite) stands in for D1, and a fake fetch stands in for the MailerLite API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  handleSubscribe, syncOne, syncPending, resetMailerLiteCache, validEmail,
  GROUP_NAME, SOURCE_FIELD, CONSENT_VERSION, OLD_CONSENT_VERSION, HOURLY_LIMIT, MAX_ATTEMPTS
} from '../../sites/gwh/mailerlite.js';
import hub from '../../sites/gwh/worker.js';

const ROOT = new URL('../../sites/gwh/', import.meta.url);
const ORIGIN = 'https://gearworldhub.com';
const KEY = 'test-key-not-real';

// The live table as it is today (schema.sql), with two older sign-ups, then migration 0002.
function makeDb({ migrate = true } = {}) {
  const sql = new DatabaseSync(':memory:');
  const schema = readFileSync(new URL('schema.sql', ROOT), 'utf8');
  // The table as it was before migration 0002 (schema.sql now shows it after the migration).
  const table = schema.match(/CREATE TABLE hub_subscribers \([^;]+\);/)[0].replace(/, ml_status TEXT[^;]*\);$/, ');');
  assert.ok(!table.includes('ml_status'));
  sql.exec(table);
  sql.exec("INSERT INTO hub_subscribers (email) VALUES ('old1@example.com'), ('old2@example.com')");
  if (migrate) sql.exec(readFileSync(new URL('migrations/0002_mailerlite_sync.sql', ROOT), 'utf8'));
  const wrap = (text, args = []) => ({
    bind: (...a) => wrap(text, a),
    first: async () => sql.prepare(text).get(...args) ?? null,
    all: async () => ({ results: sql.prepare(text).all(...args) }),
    run: async () => { sql.prepare(text).run(...args); return { success: true }; }
  });
  return { prepare: (text) => wrap(text), raw: sql };
}

function row(db, email) {
  return db.raw.prepare('SELECT * FROM hub_subscribers WHERE email = ?').get(email);
}

// Fake MailerLite: the group exists, the field does not yet; answers can be switched per test.
// Turnstile's Siteverify answers too (security fixes F02, lessons L106): a token for gearworldhub.com and the Hub form.
function fakeMailerLite({ down = false, subscriberStatus = 201, groupExists = true } = {}) {
  const calls = [];
  const verified = [];
  const impl = async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === 'challenges.cloudflare.com') {
      verified.push(Object.fromEntries(new URLSearchParams(String(init.body))));
      return new Response(JSON.stringify({ success: true, hostname: 'gearworldhub.com', action: 'hub-signup' }), { headers: { 'Content-Type': 'application/json' } });
    }
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ method: init.method, path: u.pathname, search: u.search, body, auth: init.headers && init.headers.Authorization });
    if (down) throw new Error('fetch failed');
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    if (u.pathname === '/api/groups' && init.method === 'GET') return json(200, { data: groupExists ? [{ id: '1700', name: GROUP_NAME }, { id: '9', name: 'Other' }] : [] });
    if (u.pathname === '/api/groups' && init.method === 'POST') return json(201, { data: { id: '1800', name: body.name } });
    if (u.pathname === '/api/fields' && init.method === 'GET') return json(200, { data: [{ id: 1, key: 'name', name: 'Name' }] });
    if (u.pathname === '/api/fields' && init.method === 'POST') return json(201, { data: { id: 7, key: SOURCE_FIELD, name: body.name } });
    if (u.pathname === '/api/subscribers' && init.method === 'POST') return json(subscriberStatus, { data: { id: '55', email: body.email } });
    return json(404, {});
  };
  return { calls, verified, impl };
}

function env(extra = {}) {
  return { gear_world_registry: makeDb(), MAILERLITE_API_KEY: KEY, PHOTO_LIMIT_SALT: 'test-salt-0123456789abcdef', TURNSTILE_SECRET_KEY: 'turnstile-secret-for-tests', ...extra };
}

function ctx() {
  const jobs = [];
  return { jobs, waitUntil: (p) => jobs.push(p), done: () => Promise.all(jobs) };
}

function post(body, headers = {}) {
  return new Request(`${ORIGIN}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.9', ...headers },
    body: JSON.stringify(body)
  });
}

const FORM = { email: 'New.Person@Example.com', locale: 'el-GR', consent: true, consent_version: CONSENT_VERSION, source: 'hub', website: '', turnstile_token: 'hub-widget-token' };

async function withFetch(fake, fn) {
  const before = globalThis.fetch;
  globalThis.fetch = fake.impl;
  resetMailerLiteCache();
  try { return await fn(); } finally { globalThis.fetch = before; }
}

test('mailerlite: migration 0002 puts every older sign-up on hold and new rows start pending', () => {
  const db = makeDb();
  assert.equal(row(db, 'old1@example.com').ml_status, 'hold');
  assert.equal(row(db, 'old2@example.com').ml_status, 'hold');
  db.raw.exec("INSERT INTO hub_subscribers (email) VALUES ('later@example.com')");
  assert.equal(row(db, 'later@example.com').ml_status, 'pending');
  assert.equal(row(db, 'later@example.com').ml_attempts, 0);
  assert.ok(db.raw.prepare("SELECT name FROM sqlite_master WHERE name = 'subscribe_usage'").get());
});

test('mailerlite: a sign-up is written to D1 first, then added to the group with its source', async () => {
  const e = env();
  const fake = fakeMailerLite();
  const c = ctx();
  await withFetch(fake, async () => {
    const res = await handleSubscribe(post(FORM), e, c);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    await c.done();
  });
  const r = row(e.gear_world_registry, 'new.person@example.com');
  assert.equal(r.ml_status, 'synced');
  assert.ok(r.ml_synced_at);
  assert.equal(r.locale, 'el-GR');
  assert.equal(r.source, 'hub');
  assert.equal(r.consent_version, CONSENT_VERSION);
  const sub = fake.calls.find((x) => x.path === '/api/subscribers');
  assert.equal(sub.method, 'POST');
  assert.equal(sub.body.email, 'new.person@example.com');
  assert.deepEqual(sub.body.groups, ['1700']);
  assert.deepEqual(sub.body.fields, { [SOURCE_FIELD]: 'hub' });
  assert.equal(sub.body.status, 'active');
  assert.match(sub.body.opted_in_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(sub.auth, `Bearer ${KEY}`);
  assert.ok(fake.calls.some((x) => x.path === '/api/fields' && x.method === 'POST'), 'the source_site field is made when missing');
  assert.ok(fake.calls.every((x) => x.method === 'GET' || x.method === 'POST'), 'only GET and POST to MailerLite');
});

test('mailerlite: when MailerLite does not answer, the sign-up is kept (pending) and the cron sends it later', async () => {
  const e = env();
  const c = ctx();
  await withFetch(fakeMailerLite({ down: true }), async () => {
    const res = await handleSubscribe(post(FORM), e, c);
    assert.equal(res.status, 200, 'the visitor still sees success');
    await c.done();
  });
  let r = row(e.gear_world_registry, 'new.person@example.com');
  assert.equal(r.ml_status, 'pending');
  assert.equal(r.ml_attempts, 1);
  assert.match(r.ml_error, /fetch failed/);
  const fake = fakeMailerLite();
  const out = await withFetch(fake, () => syncPending(e));
  assert.deepEqual(out, { tried: 1, synced: 1 }, 'only the pending row; the two older rows on hold are not sent');
  r = row(e.gear_world_registry, 'new.person@example.com');
  assert.equal(r.ml_status, 'synced');
  assert.equal(row(e.gear_world_registry, 'old1@example.com').ml_status, 'hold');
  assert.equal(fake.calls.filter((x) => x.path === '/api/subscribers').length, 1);
});

test('mailerlite: an address MailerLite refuses (422) is marked failed; endless errors stop after MAX_ATTEMPTS', async () => {
  const e = env();
  await withFetch(fakeMailerLite({ subscriberStatus: 422 }), async () => {
    const c = ctx();
    await handleSubscribe(post(FORM), e, c);
    await c.done();
  });
  assert.equal(row(e.gear_world_registry, 'new.person@example.com').ml_status, 'failed');
  e.gear_world_registry.raw.exec(`UPDATE hub_subscribers SET ml_status = 'pending', ml_attempts = ${MAX_ATTEMPTS - 1} WHERE email = 'new.person@example.com'`);
  await withFetch(fakeMailerLite({ subscriberStatus: 500 }), () => syncOne(e, 'new.person@example.com'));
  assert.equal(row(e.gear_world_registry, 'new.person@example.com').ml_status, 'failed');
});

test('mailerlite: a missing group is made, without a key nothing is sent and the row waits', async () => {
  const e = env();
  const fake = fakeMailerLite({ groupExists: false });
  await withFetch(fake, async () => {
    const c = ctx();
    await handleSubscribe(post(FORM), e, c);
    await c.done();
  });
  assert.ok(fake.calls.some((x) => x.path === '/api/groups' && x.method === 'POST' && x.body.name === GROUP_NAME));
  assert.deepEqual(fake.calls.find((x) => x.path === '/api/subscribers').body.groups, ['1800']);
  const noKey = env({ MAILERLITE_API_KEY: '' });
  const quiet = fakeMailerLite();
  await withFetch(quiet, async () => {
    const c = ctx();
    const res = await handleSubscribe(post(FORM), noKey, c);
    assert.equal(res.status, 200);
    await c.done();
    assert.deepEqual(await syncPending(noKey), { tried: 0, synced: 0 });
  });
  assert.equal(quiet.calls.length, 0);
  assert.equal(row(noKey.gear_world_registry, 'new.person@example.com').ml_status, 'pending');
});

test('mailerlite: checks of the form: method, origin, consent, address, honeypot, size', async () => {
  const e = env();
  await withFetch(fakeMailerLite(), async () => {
    assert.equal((await handleSubscribe(new Request(`${ORIGIN}/api/subscribe`), e, ctx())).status, 405);
    assert.equal((await handleSubscribe(post(FORM, { Origin: 'https://evil.example' }), e, ctx())).status, 403);
    const noConsent = await handleSubscribe(post({ ...FORM, consent: 'yes' }), e, ctx());
    assert.equal(noConsent.status, 400);
    assert.equal((await noConsent.json()).error, 'consent_required');
    const bad = await handleSubscribe(post({ ...FORM, email: 'not an email' }), e, ctx());
    assert.equal((await bad.json()).error, 'invalid_email');
    const bot = await handleSubscribe(post({ ...FORM, website: 'http://spam' }), e, ctx());
    assert.deepEqual(await bot.json(), { ok: true });
    const big = await handleSubscribe(post({ ...FORM, website: '', pad: 'x'.repeat(5000) }), e, ctx());
    assert.equal(big.status, 413);
  });
  assert.equal(e.gear_world_registry.raw.prepare('SELECT COUNT(*) AS n FROM hub_subscribers').get().n, 2, 'nothing written');
  assert.equal(validEmail('a@b.co'), true);
  assert.equal(validEmail('a@b'), false);
});

test('mailerlite: the app (no Origin, no token, no version) is kept as source app on hold: never sent to MailerLite (L106)', async () => {
  const e = env();
  const ml = fakeMailerLite();
  let mlCalls = 0;
  const counting = async (url, init) => { if (String(url).startsWith('https://connect.mailerlite.com')) mlCalls++; return ml(url, init); };
  await withFetch(counting, async () => {
    const c = ctx();
    const req = new Request(`${ORIGIN}/api/subscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'app.user@example.com', locale: 'en-GB', consent: true, website: '' })
    });
    const res = await handleSubscribe(req, e, c);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    await c.done();
    // The cron sends only 'pending' rows: the app row stays on hold.
    assert.deepEqual(await syncPending(e), { tried: 0, synced: 0 });
  });
  const r = row(e.gear_world_registry, 'app.user@example.com');
  assert.equal(r.source, 'app');
  assert.equal(r.consent_version, OLD_CONSENT_VERSION);
  assert.equal(r.ml_status, 'hold');
  assert.equal(r.status, 'active');
  assert.equal(mlCalls, 0, 'nothing sent to MailerLite');
});

test('mailerlite: an unverified app request never changes an address that is already on the list (L106)', async () => {
  const e = env();
  await withFetch(fakeMailerLite(), async () => {
    const c = ctx();
    assert.equal((await handleSubscribe(post({ ...FORM, email: 'known@example.com', locale: 'de-DE' }), e, c)).status, 200);
    await c.done();
    const before = row(e.gear_world_registry, 'known@example.com');
    assert.equal(before.ml_status, 'synced');
    const app = new Request(`${ORIGIN}/api/subscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'known@example.com', locale: 'fr-FR', consent: true, website: '' })
    });
    assert.equal((await handleSubscribe(app, e, ctx())).status, 200);
    assert.deepEqual(row(e.gear_world_registry, 'known@example.com'), before);
  });
});

test('mailerlite: fair use, at most HOURLY_LIMIT sign-up attempts per visitor and hour', async () => {
  const e = env();
  await withFetch(fakeMailerLite(), async () => {
    for (let i = 0; i < HOURLY_LIMIT; i++) {
      const c = ctx();
      assert.equal((await handleSubscribe(post({ ...FORM, email: `p${i}@example.com` }), e, c)).status, 200);
      await c.done();
    }
    const over = await handleSubscribe(post({ ...FORM, email: 'p9@example.com' }), e, ctx());
    assert.equal(over.status, 429);
    assert.equal((await over.json()).error, 'too_many');
    const other = await handleSubscribe(post({ ...FORM, email: 'q@example.com' }, { 'CF-Connecting-IP': '198.51.100.4' }), e, ctx());
    assert.equal(other.status, 200, 'another visitor is not blocked');
  });
  assert.equal(row(e.gear_world_registry, 'p9@example.com'), undefined);
  const usage = e.gear_world_registry.raw.prepare('SELECT visitor FROM subscribe_usage').all();
  assert.ok(usage.every((u) => !u.visitor.includes('203.0.113.9')), 'the IP address is never stored');
});

test('mailerlite: the test address answers but writes and sends nothing', async () => {
  const e = env({ GWH_PREVIEW: '1' });
  const fake = fakeMailerLite();
  await withFetch(fake, async () => {
    const res = await hub.fetch(post(FORM), e, ctx());
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, preview: true });
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.deepEqual(await syncPending(e), { tried: 0, synced: 0 });
  });
  assert.equal(fake.calls.length, 0);
  assert.equal(e.gear_world_registry.raw.prepare('SELECT COUNT(*) AS n FROM hub_subscribers').get().n, 2);
});

test('mailerlite: the Worker routes /api/subscribe to the new code and has the cron handler', async () => {
  const e = env();
  const fake = fakeMailerLite();
  await withFetch(fake, async () => {
    const c = ctx();
    const res = await hub.fetch(post(FORM), e, c);
    assert.equal(res.status, 200);
    await c.done();
    const get = await hub.fetch(new Request(`${ORIGIN}/api/subscribe`), e, ctx());
    assert.equal(get.status, 405, 'GET /api/subscribe is answered by mailerlite.js (the old code fell through to the files)');
  });
  assert.equal(row(e.gear_world_registry, 'new.person@example.com').ml_status, 'synced');
  assert.equal(typeof hub.scheduled, 'function');
  const jobs = [];
  e.gear_world_registry.raw.exec("UPDATE hub_subscribers SET ml_status = 'pending' WHERE email = 'new.person@example.com'");
  await withFetch(fakeMailerLite(), async () => {
    await hub.scheduled({ cron: '*/10 * * * *' }, e, { waitUntil: (p) => jobs.push(p) });
    await Promise.all(jobs);
  });
  assert.equal(row(e.gear_world_registry, 'new.person@example.com').ml_status, 'synced');
});

test('mailerlite: email addresses never reach the logs', async () => {
  const e = env();
  e.gear_world_registry.prepare = () => { throw new Error('D1 down for new.person@example.com'); };
  const logged = [];
  const before = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    const res = await withFetch(fakeMailerLite(), () => handleSubscribe(post(FORM), e, ctx()));
    assert.equal(res.status, 500);
  } finally { console.error = before; }
  assert.ok(logged.length > 0);
  assert.ok(logged.every((l) => !l.includes('@example.com')));
});

test('mailerlite: the key is never in the code or the config files', () => {
  const code = readFileSync(new URL('mailerlite.js', ROOT), 'utf8');
  assert.ok(code.includes('env.MAILERLITE_API_KEY'));
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(code));
  const cfg = readFileSync(new URL('wrangler.toml.example', ROOT), 'utf8');
  assert.ok(!cfg.includes('MAILERLITE_API_KEY'));
  assert.match(cfg, /\[triggers\]\s*\r?\ncrons = \["\*\/10 \* \* \* \*"\]/);
});

test('mailerlite: the Hub form, its 11 languages and the privacy page match the new email', () => {
  const page = readFileSync(new URL('public/index.html', ROOT), 'utf8');
  // A new ?v= with every change of the script (L31): 9/11/2026 the text of the box (L107).
  assert.match(page, /\/email-signup\.js\?v=20261109-compliance1/);
  assert.ok(!page.includes('new Gear Worlds'), 'the form no longer promises news about new Gear Worlds');
  const code = readFileSync(new URL('public/email-signup.js', ROOT), 'utf8');
  const copy = new Function(`${code.slice(code.indexOf('const COPY'), code.indexOf('function locale'))}; return COPY;`)();
  const locales = Object.keys(copy);
  assert.equal(locales.length, 11);
  for (const l of locales) {
    for (const k of ['eyebrow', 'title', 'description', 'consent', 'success', 'consentRequired', 'tooMany', 'error']) {
      assert.ok(copy[l][k] && copy[l][k].trim(), `${l}.${k}`);
    }
    assert.ok(copy[l].consent.includes('Gear World'), `${l} consent names Gear World`);
    assert.ok(!/new Gear Worlds|nuevos Gear Worlds|neue Gear Worlds|nouveaux Gear Worlds|nuovi Gear Worlds|novos Gear Worlds|nieuwe Gear Worlds|νέα Gear Worlds/i.test(JSON.stringify(copy[l])), `${l}: no "new Gear Worlds"`);
    if (l !== 'en-GB') assert.notEqual(copy[l].consent, copy['en-GB'].consent, `${l} consent is translated`);
  }
  assert.match(code, /consent_version: "2026-11-02"/);
  assert.match(code, /source: "hub"/);
  assert.equal(CONSENT_VERSION, '2026-11-02');
  const privacy = readFileSync(new URL('public/privacy/index.html', ROOT), 'utf8');
  assert.match(privacy, /MailerLite/);
  assert.match(privacy, /opened and which links/);
  assert.match(privacy, /Last updated: (2|3|7|8|9) November 2026/);
});
