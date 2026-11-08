// "Get deal updates" (lessons L92): every site sends a sign-up to the one member list of Gear World Hub, through the
// service binding HUB. The form works without JavaScript, the site never sends the visitor's IP address, and an older
// site's own database is not touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker, HUB_SUBSCRIBE_URL, clientKey } from '../../src/engine.js';

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const FX_FETCH = async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } });
// A public Turnstile sitekey in the real format (the tool sets the real one as the Worker secret TURNSTILE_SITE_KEY).
const SITEKEY = '0x4AAAAAAAtest_sitekey-01';
const TOKEN = 'turnstile-token-from-the-widget';
const NOT_SHOPS = new Set(['group', 'gwh', 'posters', 'awin']);
const codes = readdirSync('sites').filter(c => !NOT_SHOPS.has(c) && existsSync(`sites/${c}/site.config.js`));

function fakeD1(code, site) {
  const sql = new DatabaseSync(':memory:');
  const legacy = site.database && site.database.layout === 'legacy';
  sql.exec(readFileSync(legacy ? 'tests/fixtures/ggw-legacy-schema.sql' : `sites/${code}/migrations/0001_init.sql`, 'utf8'));
  const seed = `tests/fixtures/${code}-seed.sql`;
  if (existsSync(seed)) sql.exec(readFileSync(seed, 'utf8'));
  const writes = [];
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { if (!/^\s*SELECT/i.test(text)) writes.push(text); const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { writes, legacy, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}

function fakeHub(answer = { ok: true }, status = 200) {
  const calls = [];
  return { calls, HUB: { fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify(answer), { status, headers: { 'Content-Type': 'application/json' } }); } } };
}

const form = (site, fields, headers = {}) => new Request(`https://${site.domain}/api/newsletter`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: `https://${site.domain}`, 'User-Agent': PHONE, 'CF-Connecting-IP': '203.0.113.7', ...headers },
  body: new URLSearchParams(fields).toString()
});

test('every shop of the engine is checked (the 13 sites, Pets included)', () => {
  assert.equal(codes.length, 13);
});

for (const code of codes) {
  test(`${code.toUpperCase()}: with the Hub link the footer has the form, a sign-up goes to the Hub without the IP address, and the site database is not written`, async () => {
    const site = (await import(`../../sites/${code}/site.config.js`)).default;
    const worker = createWorker(site);
    const DB = fakeD1(code, site);
    const { calls, HUB } = fakeHub();
    // The older sites already reach the Hub as GW_HUB; the newer ones get HUB (their config template says which).
    const tpl = readFileSync(`sites/${code}/wrangler.jsonc.example`, 'utf8');
    const name = /"binding": "GW_HUB"/.test(tpl) ? 'GW_HUB' : 'HUB';
    assert.match(tpl, new RegExp(`"binding": "${name}", "service": "gear-world-hub"`), 'the template binds the Hub');
    const link = { [name]: HUB, TURNSTILE_SITE_KEY: SITEKEY };
    const home = await worker.fetch(new Request(`https://${site.domain}/`, { headers: { 'User-Agent': PHONE } }), { DB, FX_FETCH, ...link }, { waitUntil() {} });
    const html = await home.text();
    assert.match(html, /<form class="deal-form" action="\/api\/newsletter" method="post">/);
    assert.match(html, /name="consent" value="yes" required/);
    assert.match(html, /Get deal updates/);
    // Turnstile (F02, lessons L07, L106): the box carries the public sitekey and the form name; the site script loads
    // Turnstile only when the visitor starts using it.
    assert.ok(html.includes(`<div class="du-turnstile" data-du-turnstile data-sitekey="${SITEKEY}" data-action="deal-updates"></div>`));
    assert.doesNotMatch(html, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/, 'nothing of Turnstile loads with the page');
    const r = await worker.fetch(form(site, { email: ' Jo@Example.com ', consent: 'yes', page: '/deals/', website: '', 'cf-turnstile-response': TOKEN }), { DB, FX_FETCH, ...link }, { waitUntil() {} });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.match(await r.text(), /You are signed up/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, HUB_SUBSCRIBE_URL);
    assert.deepEqual(calls[0].body, { email: 'jo@example.com', consent: true, site: code, page: '/deals/', client: await clientKey('203.0.113.7'), turnstile_token: TOKEN });
    assert.ok(!JSON.stringify(calls[0].body).includes('203.0.113.7'), 'the IP address never leaves the site');
    assert.deepEqual(DB.writes.filter(w => /newsletter|customers|rate_limits/i.test(w)), [], 'the site database is not written');
    // The privacy policy names the shared list and MailerLite.
    const privacy = await (await worker.fetch(new Request(`https://${site.domain}/privacy/`, { headers: { 'User-Agent': PHONE } }), { DB, FX_FETCH, ...link }, { waitUntil() {} })).text();
    assert.match(privacy, /Deal updates\./);
    assert.match(privacy, /MailerLite/);
  });
}

test('no consent, a bad address, another site, a bot field: nothing goes to the Hub', async () => {
  const site = (await import('../../sites/cgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = fakeD1('cgw', site);
  const { calls, HUB } = fakeHub();
  const env = { DB, FX_FETCH, HUB, TURNSTILE_SITE_KEY: SITEKEY };
  assert.equal((await worker.fetch(form(site, { email: 'a@b.co', page: '/' }), env, {})).status, 400, 'no consent');
  // No Turnstile token: refused by the site itself, nothing goes to the Hub (L07).
  const noToken = await worker.fetch(form(site, { email: 'a@b.co', consent: 'yes' }), env, {});
  assert.equal(noToken.status, 403);
  assert.match(await noToken.text(), /The security check failed/);
  assert.equal(calls.length, 0);
  assert.equal((await worker.fetch(form(site, { email: 'not-an-email', consent: 'yes' }), env, {})).status, 400);
  assert.equal((await worker.fetch(form(site, { email: 'a@b.co', consent: 'yes' }, { Origin: 'https://evil.example' }), env, {})).status, 403);
  const bot = await worker.fetch(form(site, { email: 'a@b.co', consent: 'yes', website: 'http://spam' }), env, {});
  assert.equal(bot.status, 200, 'a bot gets the same answer');
  assert.equal(calls.length, 0);
  // A page that is not one of ours is never passed on.
  await worker.fetch(form(site, { email: 'a@b.co', consent: 'yes', page: '//evil.example/x', 'cf-turnstile-response': TOKEN }), env, {});
  assert.equal(calls[0].body.page, '/');
});

test('the Hub says too many, or is down: the visitor is told, and JSON works too', async () => {
  const site = (await import('../../sites/tgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = fakeD1('tgw', site);
  const sent = { email: 'a@b.co', consent: 'yes', 'cf-turnstile-response': TOKEN };
  const busy = fakeHub({ ok: false, error: 'too_many' }, 429);
  assert.equal((await worker.fetch(form(site, sent), { DB, FX_FETCH, HUB: busy.HUB }, {})).status, 429);
  const down = { fetch: async () => { throw new Error('hub down'); } };
  const r = await worker.fetch(form(site, sent), { DB, FX_FETCH, HUB: down }, {});
  assert.equal(r.status, 503);
  assert.match(await r.text(), /not working right now/);
  // The network's sign-ups of the day are full (F02): a friendly answer; a token the Hub refuses: the security check.
  const full = fakeHub({ ok: false, error: 'limit_day' }, 429);
  const f = await worker.fetch(form(site, sent), { DB, FX_FETCH, HUB: full.HUB }, {});
  assert.equal(f.status, 429);
  assert.match(await f.text(), /Sign-ups are full for today\. Please try again tomorrow\./);
  const refused = fakeHub({ ok: false, error: 'turnstile_failed' }, 403);
  const x = await worker.fetch(form(site, sent), { DB, FX_FETCH, HUB: refused.HUB }, {});
  assert.equal(x.status, 403);
  assert.match(await x.text(), /The security check failed/);
  const ok = fakeHub();
  const j = await worker.fetch(new Request(`https://${site.domain}/api/newsletter`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: `https://${site.domain}` }, body: JSON.stringify({ email: 'a@b.co', consent: true, turnstile_token: TOKEN }) }), { DB, FX_FETCH, HUB: ok.HUB }, {});
  assert.deepEqual(await j.json(), { ok: true, message: 'Thanks. You are signed up for deal updates. Every email has an unsubscribe link.' });
});

test('without the Hub link: no form, and an older site has no sign-up address at all (its database never changes)', async () => {
  const site = (await import('../../sites/mgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = fakeD1('mgw', site);
  const html = await (await worker.fetch(new Request(`https://${site.domain}/`, { headers: { 'User-Agent': PHONE } }), { DB, FX_FETCH }, { waitUntil() {} })).text();
  assert.doesNotMatch(html, /deal-form/);
  assert.equal((await worker.fetch(form(site, { email: 'a@b.co', consent: 'yes' }), { DB, FX_FETCH }, {})).status, 404);
  assert.deepEqual(DB.writes, []);
});

test('the box needs its sitekey, and a test address never shows it (Turnstile, F02, lessons L106)', async () => {
  const site = (await import('../../sites/agw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = fakeD1('agw', site);
  const { HUB } = fakeHub();
  const page = async (host, env) => (await worker.fetch(new Request(`https://${host}/`, { headers: { 'User-Agent': PHONE } }), { DB, FX_FETCH, HUB, ...env }, { waitUntil() {} })).text();
  assert.doesNotMatch(await page(site.domain, {}), /deal-form/, 'no sitekey yet: no box (the Hub would refuse every sign-up)');
  assert.doesNotMatch(await page(site.domain, { TURNSTILE_SITE_KEY: 'not a key' }), /deal-form/);
  assert.match(await page(site.domain, { TURNSTILE_SITE_KEY: SITEKEY }), /deal-form/);
  assert.doesNotMatch(await page('car-gear-world.example.workers.dev', { TURNSTILE_SITE_KEY: SITEKEY }), /deal-form/, 'not on a test address');
  // The privacy policy still names the shared list and now Turnstile.
  const privacy = await (await worker.fetch(new Request(`https://${site.domain}/privacy/`, { headers: { 'User-Agent': PHONE } }), { DB, FX_FETCH, HUB, TURNSTILE_SITE_KEY: SITEKEY }, { waitUntil() {} })).text();
  assert.match(privacy, /the form uses Cloudflare Turnstile/);
});

test('the site script loads Turnstile only when the box is used, and the 13 sites have the same script', () => {
  const js = readFileSync('sites/tgw/public/assets/site.js', 'utf8');
  const part = js.slice(js.indexOf('function setupDealUpdates'), js.indexOf('// ---------- Discount codes'));
  assert.match(part, /addEventListener\('focusin', load\)/);
  assert.match(part, /api\.js\?render=explicit&onload=gwDealTurnstileReady/);
  assert.match(part, /t\(state === 'failed' \? 'The security check failed\. Reload the page and try again\.' : 'Wait for the security check to finish, then try again\.'\)/);
  assert.match(js, /setupDealUpdates\(\);/);
  for (const c of codes) {
    for (const l of readdirSync(`sites/${c}/public/assets/i18n`)) {
      const d = JSON.parse(readFileSync(`sites/${c}/public/assets/i18n/${l}`, 'utf8'));
      for (const k of ['Wait for the security check to finish, then try again.', 'The security check failed. Reload the page and try again.', 'Sign-ups are full for today. Please try again tomorrow.']) {
        assert.ok(d[k] && d[k] !== k, `${c} ${l}: ${k}`);
      }
    }
  }
});
