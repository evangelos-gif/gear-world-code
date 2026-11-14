// Security fixes of 8/11/2026 (lessons L106): F02 Turnstile and daily sign-up limits, F03 guarded translations,
// F04 no public test addresses and no clicks from them, F08 HSTS, F11 the Hub headers, F16 unused secrets.
// A real SQLite (node:sqlite) stands in for D1; fake fetch, AI and cache stand in for Cloudflare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import hub from '../../sites/gwh/worker.js';
import { handleSubscribe } from '../../sites/gwh/mailerlite.js';
import { handleInternal, aiSlot } from '../../sites/gwh/members.js';
import {
  TURNSTILE_WIDGETS, SITE_DOMAINS, TURNSTILE_VERIFY_URL, TEST_SITE_KEY, TEST_SECRET_KEY, HUB_CSP, HUB_USER_AGENT,
  withHubHeaders, checkToken, takeNetworkSlot, DEFAULT_SUBSCRIBE_DAILY_LIMIT, DEFAULT_APP_DAILY_LIMIT, DEFAULT_TRANSLATE_DAILY_LIMIT
} from '../../sites/gwh/security.js';
import { createWorker } from '../../src/engine.js';
import { translationsFor, AI_MODEL, AI_MODEL_2, AI_SLOT_URL } from '../../src/lib/hub.js';
import { SECURITY_HEADERS, HSTS } from '../../src/lib/http.js';
import { GEAR_WORLDS } from '../../promos/network.js';

const ORIGIN = 'https://gearworldhub.com';
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const TS = { TURNSTILE_SECRET_KEY: 'secret-widget-1', TURNSTILE_SECRET_KEY_2: 'secret-widget-2', TURNSTILE_SITE_KEY: '0x4AAAAAAAhub_sitekey-01' };

// The Hub D1 as it is live: schema of hub_subscribers before 0002, then migrations 0002 and 0003.
function registry() {
  const sql = new DatabaseSync(':memory:');
  const schema = readFileSync('sites/gwh/schema.sql', 'utf8');
  sql.exec(schema.match(/CREATE TABLE hub_subscribers \([^;]+\);/)[0].replace(/, ml_status TEXT[^;]*\);$/, ');'));
  sql.exec(readFileSync('sites/gwh/migrations/0002_mailerlite_sync.sql', 'utf8'));
  sql.exec(readFileSync('sites/gwh/migrations/0003_members.sql', 'utf8'));
  sql.exec('CREATE TABLE sites (id INTEGER PRIMARY KEY, site_key TEXT, site_name TEXT, domain TEXT, priority INTEGER, is_active INTEGER)');
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text) };
}
const count = (db, where = '1') => db.sql.prepare(`SELECT COUNT(*) AS n FROM hub_subscribers WHERE ${where}`).get().n;

// A fake Siteverify: "ok:<hostname>:<action>" passes for that hostname and form, anything else fails.
function siteverify() {
  const calls = [];
  const fn = async (url, init = {}) => {
    if (String(url) !== TURNSTILE_VERIFY_URL) return new Response('{}', { status: 404 });
    const form = Object.fromEntries(new URLSearchParams(String(init.body)));
    calls.push(form);
    const m = /^ok:([^:]+):(.*)$/.exec(form.response);
    return Response.json(m ? { success: true, hostname: m[1], action: m[2] } : { success: false, 'error-codes': ['invalid-input-response'] });
  };
  return { calls, fn };
}
async function withFetch(fn, run) {
  const before = globalThis.fetch;
  globalThis.fetch = fn;
  try { return await run(); } finally { globalThis.fetch = before; }
}
const hubPost = (body, headers = { Origin: ORIGIN }) => new Request(`${ORIGIN}/api/subscribe`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', ...headers }, body: JSON.stringify(body)
});
const FORM = { email: 'a@example.com', consent: true, consent_version: '2026-11-02', source: 'hub', website: '' };
const ctx = () => ({ waitUntil() {} });

// ---------------- F02: Turnstile and the daily limits on the Hub ----------------

test('F02 Hub form: a browser needs a Turnstile token for gearworldhub.com and the form "hub-signup"; nothing is written otherwise', async () => {
  const db = registry();
  const env = { gear_world_registry: db, ...TS };
  const sv = siteverify();
  await withFetch(sv.fn, async () => {
    const none = await handleSubscribe(hubPost(FORM), env, ctx());
    assert.equal(none.status, 403);
    assert.equal((await none.json()).error, 'turnstile_required');
    for (const token of ['nonsense', 'ok:evil.example:hub-signup', 'ok:gearworldhub.com:deal-updates', 'ok:cargearworld.com:hub-signup']) {
      const r = await handleSubscribe(hubPost({ ...FORM, turnstile_token: token }), env, ctx());
      assert.equal(r.status, 403, token);
      assert.equal((await r.json()).error, 'turnstile_failed');
    }
    assert.equal(count(db), 0, 'nothing written');
    const good = await handleSubscribe(hubPost({ ...FORM, turnstile_token: 'ok:gearworldhub.com:hub-signup' }), env, ctx());
    assert.equal(good.status, 200);
    assert.equal(count(db, "email = 'a@example.com'"), 1);
    const www = await handleSubscribe(hubPost({ ...FORM, email: 'b@example.com', turnstile_token: 'ok:www.gearworldhub.com:hub-signup' }), env, ctx());
    assert.equal(www.status, 200, 'the www name of the same site is fine');
  });
  // The secret of widget 1 checks the Hub's tokens, and the visitor's IP goes only to Cloudflare (remoteip).
  assert.ok(sv.calls.every(c => c.secret === TS.TURNSTILE_SECRET_KEY && c.remoteip === '203.0.113.9'));
  // No secret key set yet: the Hub says "not ready" and writes nothing.
  const db2 = registry();
  const nr = await withFetch(sv.fn, () => handleSubscribe(hubPost({ ...FORM, turnstile_token: 'ok:gearworldhub.com:hub-signup' }), { gear_world_registry: db2 }, ctx()));
  assert.equal(nr.status, 503);
  assert.equal(count(db2), 0);
});

test('F02 daily limit of the network: SUBSCRIBE_DAILY_LIMIT, then 429 limit_day until the next UTC day; the app has its own small one', async () => {
  assert.equal(DEFAULT_SUBSCRIBE_DAILY_LIMIT, 50);
  assert.equal(DEFAULT_APP_DAILY_LIMIT, 10);
  const db = registry();
  const env = { gear_world_registry: db, ...TS, SUBSCRIBE_DAILY_LIMIT: '2', SUBSCRIBE_APP_DAILY_LIMIT: '1' };
  const sv = siteverify();
  await withFetch(sv.fn, async () => {
    const ok = (email, ip) => handleSubscribe(hubPost({ ...FORM, email, turnstile_token: 'ok:gearworldhub.com:hub-signup' }, { Origin: ORIGIN, 'CF-Connecting-IP': ip }), env, ctx());
    assert.equal((await ok('one@example.com', '198.51.100.1')).status, 200);
    // The app: no Origin and no token, only within its own limit (and it counts in the network limit too).
    const app = body => handleSubscribe(new Request(`${ORIGIN}/api/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.9' }, body: JSON.stringify(body) }), env, ctx());
    assert.equal((await app({ email: 'app1@example.com', consent: true })).status, 200);
    const app2 = await app({ email: 'app2@example.com', consent: true });
    assert.equal(app2.status, 429, 'the app limit of the day is 1 here');
    assert.equal((await app2.json()).error, 'limit_day');
    const full = await ok('three@example.com', '198.51.100.3');
    assert.equal(full.status, 429, 'the network limit of the day is 2 here');
    assert.equal((await full.json()).error, 'limit_day');
    assert.ok(Number(full.headers.get('Retry-After')) >= 60);
  });
  assert.equal(count(db), 2);
  assert.equal(count(db, "email IN ('app2@example.com', 'three@example.com')"), 0);
  // No IP address in the counters: one row per limit and day.
  const rows = db.sql.prepare("SELECT visitor, hour, count FROM subscribe_usage WHERE visitor LIKE 'network:%' ORDER BY visitor").all().map(r => ({ ...r }));
  assert.deepEqual(rows.map(r => r.visitor), ['network:subscribe', 'network:subscribe-app']);
  assert.ok(rows.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.hour)));
  // The next day is free again; 0 means never.
  assert.equal(await takeNetworkSlot(db, new Date(Date.now() + 86400000), 'subscribe', 2), true);
  assert.equal(await takeNetworkSlot(db, new Date(), 'subscribe', 0), false);
});

test('F02 site sign-ups (members.js): the token of the site box, checked with that site\'s widget, for that site and the form "deal-updates"', async () => {
  const db = registry();
  const env = { gear_world_registry: db, ...TS };
  const sv = siteverify();
  const post = body => new Request('https://hub.internal/internal/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const base = { consent: true, client: 'a'.repeat(32) };
  const opts = { sync: async () => 'pending', verify: (token, secret, ip) => sv.fn(TURNSTILE_VERIFY_URL, { method: 'POST', body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }) }).then(r => r.json()) };
  assert.equal((await handleInternal(post({ ...base, email: 'x@e.co', site: 'tgw' }), env, {}, opts)).status, 403, 'no token');
  assert.equal((await handleInternal(post({ ...base, email: 'x@e.co', site: 'tgw', turnstile_token: 'ok:cargearworld.com:deal-updates' }), env, {}, opts)).status, 403, 'a token of another site');
  assert.equal((await handleInternal(post({ ...base, email: 'x@e.co', site: 'tgw', turnstile_token: 'ok:technologygearworld.com:hub-signup' }), env, {}, opts)).status, 403, 'a token of another form');
  assert.equal(count(db), 0);
  assert.equal((await handleInternal(post({ ...base, email: 'w@e.co', site: 'wgw', turnstile_token: 'ok:womensgearworld.com:deal-updates' }), env, {}, opts)).status, 200);
  assert.equal((await handleInternal(post({ ...base, email: 's@e.co', site: 'sgw', turnstile_token: 'ok:sportygearworld.com:deal-updates' }), env, {}, opts)).status, 200);
  const secrets = sv.calls.slice(-2).map(c => c.secret);
  assert.deepEqual(secrets, [TS.TURNSTILE_SECRET_KEY, TS.TURNSTILE_SECRET_KEY_2], 'WGW is on widget 1, SGW on widget 2');
  assert.ok(sv.calls.every(c => !('remoteip' in c)), 'the site never sends the IP, so none goes to Cloudflare either');
  // The same daily limit as the Hub form.
  const tight = { gear_world_registry: registry(), ...TS, SUBSCRIBE_DAILY_LIMIT: '1' };
  assert.equal((await handleInternal(post({ ...base, email: 'p@e.co', site: 'agw', turnstile_token: 'ok:cargearworld.com:deal-updates' }), tight, {}, opts)).status, 200);
  const r = await handleInternal(post({ ...base, email: 'q@e.co', site: 'agw', client: 'b'.repeat(32), turnstile_token: 'ok:cargearworld.com:deal-updates' }), tight, {}, opts);
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'limit_day');
  // Widget 2 without its secret: not ready, nothing written.
  const half = { gear_world_registry: registry(), TURNSTILE_SECRET_KEY: 'only-widget-1' };
  assert.equal((await handleInternal(post({ ...base, email: 'z@e.co', site: 'zgw', turnstile_token: 'ok:petsgearworld.com:deal-updates' }), half, {}, opts)).status, 503);
});

test('F02 the two Turnstile widgets: at most 10 hostnames each (free plan), together the Hub and every site of the network', () => {
  const all = [...TURNSTILE_WIDGETS[1], ...TURNSTILE_WIDGETS[2]];
  assert.ok(TURNSTILE_WIDGETS[1].length <= 10 && TURNSTILE_WIDGETS[2].length <= 10);
  assert.equal(new Set(all).size, all.length);
  const network = GEAR_WORLDS.map(w => new URL(w.url).hostname);
  assert.deepEqual([...all].sort(), ['gearworldhub.com', ...network].sort());
  assert.deepEqual(Object.entries(SITE_DOMAINS).map(([c, d]) => `${c.toUpperCase()} ${d}`).sort(), GEAR_WORLDS.map(w => `${w.code} ${new URL(w.url).hostname}`).sort());
  // The tool makes the widgets with exactly these hostnames.
  const tool = readFileSync('tools/gw-security-fixes.ps1', 'utf8');
  for (const [n, list] of Object.entries(TURNSTILE_WIDGETS)) {
    const m = new RegExp(`\\$Widget${n}Hosts = @\\(([^)]*)\\)`).exec(tool);
    assert.ok(m, `widget ${n} in the tool`);
    assert.deepEqual(m[1].split(',').map(s => s.trim().replace(/'/g, '')), list, `widget ${n}: the same hostnames in the tool`);
  }
});

test('F02 the test address of the Hub uses Cloudflare\'s test keys and still writes nothing; /api/turnstile gives the public sitekey', async () => {
  const db = registry();
  const env = { gear_world_registry: db, GWH_PREVIEW: '1' };
  const sv = siteverify();
  const preview = 'https://gear-world-hub-preview.example.workers.dev';
  await withFetch(async (url, init) => {
    if (String(url) === TURNSTILE_VERIFY_URL) return Response.json({ success: true, hostname: 'example.com', action: '' });
    return sv.fn(url, init);
  }, async () => {
    const r = await hub.fetch(new Request(`${preview}/api/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: preview }, body: JSON.stringify({ ...FORM, turnstile_token: 'XXXX.DUMMY.TOKEN.XXXX' }) }), env, ctx());
    assert.deepEqual(await r.json(), { ok: true, preview: true });
  });
  assert.equal(count(db), 0);
  assert.equal(await checkToken(env, 'x', { domain: 'gearworldhub.com', verify: async (t, s) => ({ success: s === TEST_SECRET_KEY }) }), 'ok');
  const k = await hub.fetch(new Request(`${preview}/api/turnstile`), env, ctx());
  assert.deepEqual(await k.json(), { ok: true, sitekey: TEST_SITE_KEY });
  const live = await hub.fetch(new Request(`${ORIGIN}/api/turnstile`), { ...TS }, ctx());
  assert.deepEqual(await live.json(), { ok: true, sitekey: TS.TURNSTILE_SITE_KEY });
  assert.equal(live.headers.get('Content-Type'), 'application/json; charset=utf-8');
  const missing = await hub.fetch(new Request(`${ORIGIN}/api/turnstile`), {}, ctx());
  assert.equal(missing.status, 503);
});

test('F02 the Hub page: Turnstile loads only when the form is used, its token goes with the sign-up, new texts in 11 languages', () => {
  const page = readFileSync('sites/gwh/public/index.html', 'utf8');
  assert.match(page, /<div class="gwh-email-turnstile" id="gwhEmailTurnstile"><\/div>/);
  assert.match(page, /\/email-signup\.js\?v=(20261108-security1|20261109-compliance1)/);
  assert.doesNotMatch(page, /challenges\.cloudflare\.com/, 'nothing of Turnstile loads with the page');
  const js = readFileSync('sites/gwh/public/email-signup.js', 'utf8');
  assert.match(js, /form\.addEventListener\("focusin", loadTurnstile\)/);
  assert.match(js, /turnstile_token: token/);
  assert.match(js, /action: "hub-signup"/);
  const copy = new Function(`${js.slice(js.indexOf('const COPY'), js.indexOf('function locale'))}; return COPY;`)();
  for (const [l, c] of Object.entries(copy)) {
    for (const k of ['waitCheck', 'checkFailed', 'full']) {
      assert.ok(c[k] && c[k].trim(), `${l}.${k}`);
      if (l !== 'en-GB') assert.notEqual(c[k], copy['en-GB'][k], `${l}.${k} is translated`);
      assert.doesNotMatch(c[k], /[‘’“”]/, 'plain quotes only');
    }
  }
});

// ---------------- F03: translations ----------------

function fakeCache() {
  const store = new Map();
  return { store, match: async req => (store.has(req.url) ? new Response(store.get(req.url)) : undefined), put: async (req, res) => { store.set(req.url, await res.text()); } };
}

test('F03 sites: one model answer per term and day (cache), no model for a bot, a translated search of the Hub, or a full day', async () => {
  let ai = 0;
  let slots = 0;
  const env = { AI: { run: async () => { ai++; return { response: 'garden hose' }; } }, HUB: { fetch: async (url) => { slots++; assert.equal(String(url), AI_SLOT_URL); return Response.json({ ok: true }); } } };
  const cache = fakeCache();
  const collect = async (q, opts) => { const out = []; for await (const c of translationsFor(env, q, { cache, origin: 'https://gardengearworld.com', site: 'ggw', ...opts })) out.push(c); return out; };
  assert.deepEqual(await collect('λάστιχο κήπου'), ['garden hose', 'hose']);
  assert.equal(ai, 2, 'both models were asked (the first answer gave two tries, the second model the same words)');
  assert.equal(slots, 2, 'one place of the daily limit per model call');
  assert.deepEqual(await collect('  ΛΆΣΤΙΧΟ   κήπου '), ['garden hose', 'hose'], 'the same words in another case and spacing: from the cache');
  assert.equal(ai, 2);
  assert.equal(slots, 2);
  assert.ok([...cache.store.keys()].every(k => k.startsWith('https://gardengearworld.com/__gw/translate/v1?m=')));
  assert.deepEqual(await collect('φτυάρι', { noAI: true }), []);
  assert.deepEqual(await collect('123456'), [], 'no letters: nothing to translate');
  assert.deepEqual(await collect('x'.repeat(81)), []);
  assert.equal(ai, 2);
  // The day is full (or the Hub cannot say): no model, the search goes on with the words as typed.
  const full = { AI: env.AI, HUB: { fetch: async () => Response.json({ ok: false, error: 'limit_day' }, { status: 429 }) } };
  const out = [];
  for await (const c of translationsFor(full, 'φτυάρι', { cache: null })) out.push(c);
  assert.deepEqual(out, []);
  const noHub = [];
  for await (const c of translationsFor({ AI: env.AI }, 'φτυάρι', { cache: null })) noHub.push(c);
  assert.deepEqual(noHub, []);
  assert.equal(ai, 2);
  // A failed model call is not kept: the next visitor tries again.
  const flaky = fakeCache();
  let n = 0;
  const env2 = { AI: { run: async (m) => { n++; if (n === 1) throw new Error('3040'); return { response: m === AI_MODEL ? 'spade' : 'shovel' }; } }, HUB: env.HUB };
  const first = [];
  for await (const c of translationsFor(env2, 'φτυάρι', { cache: flaky })) first.push(c);
  assert.deepEqual(first, ['shovel']);
  assert.equal([...flaky.store.keys()].filter(k => k.includes(encodeURIComponent(AI_MODEL))).length, 0);
  assert.equal([...flaky.store.keys()].filter(k => k.includes(encodeURIComponent(AI_MODEL_2))).length, 1);
});

test('F03 sites between the two updates: the Hub without /internal/ai-slot (404 not_found) still lets them translate; other refusals do not', async () => {
  const { takeAiSlot } = await import('../../src/lib/hub.js');
  const hubAnswer = (status, body) => ({ HUB: { fetch: async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }) } });
  assert.equal(await takeAiSlot(hubAnswer(404, { ok: false, error: 'not_found' }), 'zgw'), true, 'the Hub of before (members.js answers not_found)');
  assert.equal(await takeAiSlot(hubAnswer(404, { error: 'other' }), 'zgw'), false);
  assert.equal(await takeAiSlot(hubAnswer(429, { ok: false, error: 'limit_day' }), 'zgw'), false, 'the day is full');
  assert.equal(await takeAiSlot(hubAnswer(500, {}), 'zgw'), false);
  assert.equal(await takeAiSlot(hubAnswer(200, { ok: true }), 'zgw'), true);
  assert.equal(await takeAiSlot({}, 'zgw'), false, 'no Hub binding: no model');
  // That is how the Hub answers an internal address it does not have (the Hub of before had only /internal/subscribe).
  const unknown = await handleInternal(new Request('https://hub.internal/internal/not-here', { method: 'POST', body: '{}' }), { gear_world_registry: registry() }, {});
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { ok: false, error: 'not_found' });
});

test('F03 Hub ai-slot: one network counter for the sites and the Hub, TRANSLATE_DAILY_LIMIT (default 2000), only on the private address', async () => {
  assert.equal(DEFAULT_TRANSLATE_DAILY_LIMIT, 2000);
  const db = registry();
  const env = { gear_world_registry: db, TRANSLATE_DAILY_LIMIT: '2' };
  const slot = () => hub.fetch(new Request('https://hub.internal/internal/ai-slot', { method: 'POST', body: '{"site":"tgw"}' }), env, ctx());
  assert.equal((await slot()).status, 200);
  assert.equal(await aiSlot(env), true, 'the Hub\'s own translations count in the same limit');
  const third = await slot();
  assert.equal(third.status, 429);
  assert.deepEqual(await third.json(), { ok: false, error: 'limit_day' });
  const pub = await hub.fetch(new Request(`${ORIGIN}/internal/ai-slot`, { method: 'POST', body: '{}' }), { ...env, ASSETS: { fetch: async () => new Response('nf', { status: 404 }) } }, ctx());
  assert.notEqual(pub.status, 200, 'the public site never reaches it');
  assert.equal(await aiSlot({}), false, 'no database: no place');
});

function hubSearchEnv({ ai, limit } = {}) {
  const db = registry();
  db.sql.exec("INSERT INTO sites (site_key, site_name, domain, priority, is_active) VALUES ('TGW', 'Technology Gear World', 'technologygearworld.com', 10, 1), ('AGW', 'Car Gear World', 'cargearworld.com', 20, 1)");
  return { gear_world_registry: db, ...(ai ? { AI: ai } : {}), ...(limit ? { TRANSLATE_DAILY_LIMIT: String(limit) } : {}) };
}
function sitesFetch(found = () => []) {
  const asked = [];
  const fn = async (url, init) => {
    const u = new URL(url);
    asked.push({ url: u, ua: init && init.headers && init.headers['User-Agent'] });
    return Response.json({ ok: true, products: found(u) });
  };
  return { asked, fn };
}

test('F03 Hub search: a translation is asked once per term and day; every Hub search reaches the sites with translate=0, and the Hub says who it is', async () => {
  let calls = 0;
  const ai = { run: async () => { calls++; return { response: 'drill' }; } };
  const store = fakeCache();
  const before = globalThis.caches;
  globalThis.caches = { default: store };
  try {
    const env = hubSearchEnv({ ai });
    const s = sitesFetch();
    await withFetch(s.fn, async () => {
      const r = await hub.fetch(new Request(`${ORIGIN}/api/search?q=${encodeURIComponent('δράπανο')}`, { headers: { 'User-Agent': PHONE } }), env, ctx());
      assert.equal((await r.json()).ok, true);
      await hub.fetch(new Request(`${ORIGIN}/api/search?q=${encodeURIComponent('Δράπανο')}`, { headers: { 'User-Agent': PHONE } }), env, ctx());
    });
    assert.equal(calls, 1, 'the second search used the kept translation');
    assert.ok(s.asked.length === 4 && s.asked.every(a => a.url.searchParams.get('search') === 'drill' && a.url.searchParams.get('translate') === '0'));
    assert.ok(s.asked.every(a => a.ua === HUB_USER_AGENT));
    assert.doesNotMatch(HUB_USER_AGENT, /bot|crawl|spider|preview|headless/i, 'the sites do not take the Hub for a bot');
    // English words from a person: the Hub does its own ASCII second try, so the sites never translate a Hub search
    // (they keep the network's daily limit of model calls for searches on the sites themselves).
    const s2 = sitesFetch(u => [{ id: 1, product_name: 'Cordless drill', price: 50 }]);
    await withFetch(s2.fn, () => hub.fetch(new Request(`${ORIGIN}/api/search?q=drill`, { headers: { 'User-Agent': PHONE } }), env, ctx()));
    assert.ok(s2.asked.length > 0 && s2.asked.every(a => a.url.searchParams.get('translate') === '0'));
    // A bot: no model at the Hub, and translate=0 for the sites.
    const s3 = sitesFetch();
    await withFetch(s3.fn, () => hub.fetch(new Request(`${ORIGIN}/api/search?q=${encodeURIComponent('τρυπάνι')}`, { headers: { 'User-Agent': 'curl/8.5' } }), env, ctx()));
    assert.equal(calls, 1);
    assert.ok(s3.asked.length > 0 && s3.asked.every(a => a.url.searchParams.get('translate') === '0' && a.url.searchParams.get('search') === 'τρυπάνι'));
  } finally { globalThis.caches = before; }
});

test('F03 Hub search: the second try (all sites empty) translates once and asks with translate=0; a full day means no model', async () => {
  let calls = 0;
  const ai = { run: async () => { calls++; return { response: 'drill' }; } };
  const env = hubSearchEnv({ ai, limit: 1 });
  const s = sitesFetch(u => (u.searchParams.get('search') === 'drill' ? [{ id: 7, product_name: 'Drill', price: 30 }] : []));
  await withFetch(s.fn, async () => {
    const r = await (await hub.fetch(new Request(`${ORIGIN}/api/search?q=Bohrmaschine`, { headers: { 'User-Agent': PHONE } }), env, ctx())).json();
    assert.equal(r.count, 2);
  });
  assert.equal(calls, 1);
  const second = s.asked.filter(a => a.url.searchParams.get('search') === 'drill');
  assert.equal(second.length, 2);
  assert.ok(second.every(a => a.url.searchParams.get('translate') === '0'));
  // The daily limit (1) is used up: the next new word is searched as typed, without a model.
  const s2 = sitesFetch();
  await withFetch(s2.fn, () => hub.fetch(new Request(`${ORIGIN}/api/search?q=Schraubenzieher`, { headers: { 'User-Agent': PHONE } }), env, ctx()));
  assert.equal(calls, 1);
});

// ---------------- F04: no clicks from test addresses; workers.dev off ----------------

function siteDb(code) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(`sites/${code}/migrations/0001_init.sql`, 'utf8'));
  sql.exec(readFileSync(`tests/fixtures/${code}-seed.sql`, 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}

test('F04 /out/ and /go/ on a test address (workers.dev, preview URL) never record a click; on the real domain they do', async () => {
  const site = (await import('../../sites/tgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = siteDb('tgw');
  const id = DB.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id LIMIT 1').get().id;
  const clicks = () => DB.sql.prepare('SELECT COUNT(*) AS n FROM affiliate_clicks').get().n;
  const out = host => worker.fetch(new Request(`https://${host}/out/${id}`, { headers: { 'User-Agent': PHONE } }), { DB, FX_FETCH: async () => Response.json([]) }, {});
  for (const host of ['technology-gear-world.example.workers.dev', 'abc123-technology-gear-world.example.workers.dev']) {
    const r = await out(host);
    assert.equal(r.status, 302);
    assert.match(r.headers.get('Location'), /awin1\.com/);
    assert.equal(clicks(), 0, host);
  }
  assert.equal((await out(site.domain)).status, 302);
  assert.equal(clicks(), 1);
  const engine = readFileSync('src/engine.js', 'utf8');
  assert.equal((engine.match(/env\.CLICK_LOG !== 'off' && !isPreviewHost\(url\.hostname, site\.domain\)/g) || []).length, 2, '/out/ and /go/ both');
});

test('F04 every live Worker template: workers.dev and preview URLs off (the Hub too); the private Workers stay off', () => {
  const live = readdirSync('sites').filter(c => existsSync(`sites/${c}/wrangler.jsonc.example`));
  assert.ok(live.length >= 16);
  for (const c of live) {
    const t = readFileSync(`sites/${c}/wrangler.jsonc.example`, 'utf8');
    assert.match(t, /^\s*"workers_dev": false,\s*$/m, c);
    assert.match(t, /^\s*"preview_urls": false,\s*$/m, c);
    assert.doesNotMatch(t, /"workers_dev": true/, c);
  }
  const hubCfg = readFileSync('sites/gwh/wrangler.toml.example', 'utf8');
  assert.match(hubCfg, /^workers_dev = false$/m);
  assert.match(hubCfg, /^preview_urls = false$/m);
  // The tools: a live update writes both lines into the config on the PC; a test Worker gets workers.dev.
  for (const s of ['tgw', 'agw', 'vgw', 'sgw', 'bgw', 'pgw', 'zgw']) {
    const tool = readFileSync(`tools/${s}-cloudflare.ps1`, 'utf8');
    assert.match(tool, /function Set-NoTestAddress/, s);
    assert.match(tool.slice(tool.indexOf("'update' {")), /Set-NoTestAddress/, `${s}: update turns the test address off`);
  }
  for (const s of ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw']) {
    const tool = readFileSync(`tools/${s}-engine.ps1`, 'utf8');
    assert.match(tool, /"workers_dev": true/, `${s}: the -preview test Worker gets workers.dev`);
  }
  const hubTool = readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
  assert.match(hubTool, /function Set-HubNoTestAddress/);
});

// ---------------- F08 HSTS, F11 the Hub headers ----------------

test('/api/stats: kept 1 hour per data centre under its path only; the visitor gets the same answer and headers', async () => {
  const site = (await import('../../sites/tgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = siteDb('tgw');
  let reads = 0;
  const prepare = DB.prepare;
  DB.prepare = text => { if (/GROUP BY retailer/.test(text)) reads++; return prepare(text); };
  // A cache that keeps status, headers and body, like caches.default.
  const kept = new Map();
  const store = {
    match: async req => { const k = kept.get(req.url); return k ? new Response(k.body, { status: k.status, headers: k.headers }) : undefined; },
    put: async (req, res) => { assert.equal(req.method, 'GET'); kept.set(req.url, { status: res.status, headers: [...res.headers], body: await res.text() }); }
  };
  const waits = [];
  const c = { waitUntil: p => waits.push(p) };
  const env = { DB, FX_FETCH: async () => Response.json([]) };
  const get = async (path, e = env) => { const r = await worker.fetch(new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': PHONE } }), e, c); await Promise.all(waits); return r; };
  const plain = await get('/api/stats');
  const plainBody = await plain.text();
  assert.equal(reads, 1);
  const before = globalThis.caches;
  globalThis.caches = { default: store };
  try {
    const first = await get('/api/stats');
    const firstBody = await first.text();
    assert.equal(reads, 2);
    assert.deepEqual([...kept.keys()], [`https://${site.domain}/api/stats?shape=2`], 'L130: the key names the shape');
    assert.equal(new Headers(kept.get(`https://${site.domain}/api/stats?shape=2`).headers).get('Cache-Control'), 'public, max-age=3600');
    for (const path of ['/api/stats', '/api/stats?x=1', '/api/stats?nocache=2']) {
      const r = await get(path);
      assert.equal(await r.text(), plainBody, path);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('Cache-Control'), plain.headers.get('Cache-Control'), path);
      assert.equal(r.headers.get('Content-Type'), 'application/json; charset=utf-8');
      assert.equal(r.headers.get('Strict-Transport-Security'), HSTS);
      assert.equal(r.headers.get('X-GW-Client-Cache-Control'), null);
    }
    assert.equal(firstBody, plainBody);
    assert.equal(reads, 2, 'one D1 query for all of them');
    assert.equal(kept.size, 1, 'a query string never makes another copy');
    await get('/api/stats', { ...env, EDGE_CACHE: 'off' });
    assert.equal(reads, 3, 'EDGE_CACHE=off still reads D1 every time');
  } finally { globalThis.caches = before; DB.prepare = prepare; }
});

test('F08 HSTS: one year with the subdomains on every engine page and every static file; no preload yet', () => {
  assert.equal(HSTS, 'max-age=31536000; includeSubDomains');
  assert.equal(SECURITY_HEADERS['Strict-Transport-Security'], HSTS);
  for (const c of readdirSync('sites').filter(x => existsSync(`sites/${x}/public/_headers`))) {
    const h = readFileSync(`sites/${c}/public/_headers`, 'utf8');
    assert.match(h, /^  Strict-Transport-Security: max-age=31536000; includeSubDomains$/m, c);
    assert.doesNotMatch(h, /preload/);
  }
});

test('F11 the Hub: charset=utf-8 on text, the full policy as Report-Only on HTML, never its own HSTS; reports go to /api/csp-report', async () => {
  const html = withHubHeaders(new Response('<p>x</p>', { headers: { 'Content-Type': 'text/html', 'Strict-Transport-Security': 'max-age=1' } }));
  assert.equal(html.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(html.headers.get('Content-Security-Policy-Report-Only'), HUB_CSP);
  assert.equal(html.headers.get('Strict-Transport-Security'), null);
  assert.equal(await html.text(), '<p>x</p>');
  const js = withHubHeaders(new Response('x', { headers: { 'Content-Type': 'text/javascript' } }));
  assert.equal(js.headers.get('Content-Type'), 'text/javascript; charset=utf-8');
  assert.equal(js.headers.get('Content-Security-Policy-Report-Only'), null);
  const video = new Response('x', { status: 206, headers: { 'Content-Type': 'video/mp4' } });
  assert.equal(withHubHeaders(video), video, 'media is not touched');
  for (const part of ["script-src 'self' https://challenges.cloudflare.com", 'frame-src https://challenges.cloudflare.com', 'https://www.googletagmanager.com', 'https://static.cloudflareinsights.com', 'https://cloudflareinsights.com', "img-src 'self' data: blob: https:", "object-src 'none'", 'report-uri /api/csp-report']) {
    assert.ok(HUB_CSP.includes(part), part);
  }
  assert.doesNotMatch(HUB_CSP, /unsafe-inline|unsafe-eval/);
  const r = await hub.fetch(new Request(`${ORIGIN}/api/csp-report`, { method: 'POST', body: '{"csp-report":{"blocked-uri":"https://x.example"}}' }), {}, ctx());
  assert.equal(r.status, 204);
  // What the Hub's own files load comes from origins the policy allows.
  const origins = new Set();
  const walk = dir => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${f.name}`;
      if (f.isDirectory()) walk(p);
      else if (/\.(html|js)$/.test(f.name)) for (const m of readFileSync(p, 'utf8').matchAll(/(?:<script[^>]*\ssrc=|script\.src\s*=)\s*["'](https:\/\/[a-z0-9.-]+)/g)) origins.add(m[1]);
    }
  };
  walk('sites/gwh/public');
  for (const o of origins) assert.ok(HUB_CSP.includes(o), `${o} is allowed in script-src`);
  // No inline script or style attribute in the Hub pages (the policy has no 'unsafe-inline').
  const pages = [];
  const collect = dir => { for (const f of readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${f.name}`; if (f.isDirectory()) collect(p); else if (f.name.endsWith('.html')) pages.push(p); } };
  collect('sites/gwh/public');
  for (const p of pages) {
    const t = readFileSync(p, 'utf8');
    assert.doesNotMatch(t, /<script>(?!\s*<\/script>)|<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>/, `${p}: an inline script`);
    assert.doesNotMatch(t, /\sstyle="|<style[\s>]/, `${p}: an inline style`);
  }
});

// ---------------- F16: the old internal token is not read by any code ----------------

test('F11 /api/csp-report: over 8 KB is refused before it is read (Content-Length) or once the limit is passed (stream)', async () => {
  const { cspReport, CSP_REPORT_MAX } = await import('../../sites/gwh/security.js');
  assert.equal(CSP_REPORT_MAX, 8192);
  const chunks = (limit) => {
    const state = { pulled: 0 };
    state.body = new ReadableStream({ pull(c) { state.pulled++; if (state.pulled > limit) c.close(); else c.enqueue(new Uint8Array(4096).fill(120)); } }, { highWaterMark: 0 });
    return state;
  };
  const fake = (headers, body) => ({ method: 'POST', headers: new Headers(headers), body });
  const logged = [];
  const warn = console.warn;
  console.warn = (...a) => logged.push(a.join(' '));
  try {
    const declared = chunks(100);
    assert.equal((await cspReport(fake({ 'content-length': String(CSP_REPORT_MAX + 1) }, declared.body))).status, 413);
    assert.equal(declared.pulled, 0, 'not read at all');
    const endless = chunks(1000);
    assert.equal((await cspReport(fake({}, endless.body))).status, 413);
    assert.equal(endless.pulled, 3, 'read only until the limit was passed');
    const exact = chunks(2);
    assert.equal((await cspReport(fake({}, exact.body))).status, 204, '8 KB exactly is fine');
    assert.equal((await cspReport(fake({ 'content-length': 'abc' }, null))).status, 413);
    const real = await cspReport(new Request(`${ORIGIN}/api/csp-report`, { method: 'POST', body: '{"csp-report":{"blocked-uri":"https://x.example","source-file":"mailto:someone@example.com"}}' }));
    assert.equal(real.status, 204);
    assert.equal(real.headers.get('Cache-Control'), 'no-store');
    assert.equal((await cspReport(new Request(`${ORIGIN}/api/csp-report`))).status, 405);
  } finally { console.warn = warn; }
  assert.equal(logged.length, 2);
  assert.ok(logged[1].includes('[email]') && !logged.join(' ').includes('someone@example.com'));
});

test('F16 GW_INTERNAL_TOKEN, CGW_ADMIN_TOKEN, HGW_ADMIN_TOKEN and the sites\' TURNSTILE_SECRET_KEY are read by no Worker code; the tool deletes only those', () => {
  const code = [];
  const walk = dir => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${f.name}`;
      if (f.isDirectory() && f.name !== 'public' && f.name !== 'node_modules') walk(p);
      else if (/\.(js|mjs)$/.test(f.name)) code.push([p, readFileSync(p, 'utf8')]);
    }
  };
  walk('src');
  walk('sites');
  for (const [p, t] of code) {
    for (const name of ['GW_INTERNAL_TOKEN', 'CGW_ADMIN_TOKEN', 'HGW_ADMIN_TOKEN']) assert.ok(!t.includes(`env.${name}`) && !t.includes(`.${name}`), `${p} reads ${name}`);
  }
  // The engine reads TURNSTILE_SECRET_KEY only on a site without the Hub link (none of the 13 live sites).
  const engine = readFileSync('src/engine.js', 'utf8');
  assert.equal((engine.match(/env\.TURNSTILE_SECRET_KEY/g) || []).length, 1);
  assert.ok(engine.indexOf('env.TURNSTILE_SECRET_KEY') > engine.indexOf('// No Hub link: newer sites keep their own newsletter table'));
  const tool = readFileSync('tools/gw-security-fixes.ps1', 'utf8');
  const m = /\$UnusedEverywhere = @\(([^)]*)\)/.exec(tool);
  assert.ok(m);
  assert.deepEqual(m[1].split(',').map(s => s.trim().replace(/'/g, '')).sort(), ['CGW_ADMIN_TOKEN', 'GW_INTERNAL_TOKEN', 'HGW_ADMIN_TOKEN']);
  assert.match(tool, /\$UnusedOnSites = @\('TURNSTILE_SECRET_KEY'\)/);
  // What the Hub reads stays: never deleted there.
  for (const keep of ['TURNSTILE_SECRET_KEY', 'TURNSTILE_SECRET_KEY_2', 'TURNSTILE_SITE_KEY', 'MAILERLITE_API_KEY', 'PHOTO_LIMIT_SALT']) assert.ok(tool.includes(`'${keep}'`), keep);
});
