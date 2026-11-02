// "Get deal updates" (lessons L90): every site sends a sign-up to the one member list of Gear World Hub, through the
// service binding HUB. The form works without JavaScript, the site never sends the visitor's IP address, and an older
// site's own database is not touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker, HUB_SUBSCRIBE_URL, clientKey } from '../../src/engine.js';

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const FX_FETCH = async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } });
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

test('every shop of the engine is checked (the 12 sites)', () => {
  assert.equal(codes.length, 12);
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
    const link = { [name]: HUB };
    const home = await worker.fetch(new Request(`https://${site.domain}/`, { headers: { 'User-Agent': PHONE } }), { DB, FX_FETCH, ...link }, { waitUntil() {} });
    const html = await home.text();
    assert.match(html, /<form class="deal-form" action="\/api\/newsletter" method="post">/);
    assert.match(html, /name="consent" value="yes" required/);
    assert.match(html, /Get deal updates/);
    const r = await worker.fetch(form(site, { email: ' Jo@Example.com ', consent: 'yes', page: '/deals/', website: '' }), { DB, FX_FETCH, ...link }, { waitUntil() {} });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    assert.match(await r.text(), /You are signed up/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, HUB_SUBSCRIBE_URL);
    assert.deepEqual(calls[0].body, { email: 'jo@example.com', consent: true, site: code, page: '/deals/', client: await clientKey('203.0.113.7') });
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
  const env = { DB, FX_FETCH, HUB };
  assert.equal((await worker.fetch(form(site, { email: 'a@b.co', page: '/' }), env, {})).status, 400, 'no consent');
  assert.equal((await worker.fetch(form(site, { email: 'not-an-email', consent: 'yes' }), env, {})).status, 400);
  assert.equal((await worker.fetch(form(site, { email: 'a@b.co', consent: 'yes' }, { Origin: 'https://evil.example' }), env, {})).status, 403);
  const bot = await worker.fetch(form(site, { email: 'a@b.co', consent: 'yes', website: 'http://spam' }), env, {});
  assert.equal(bot.status, 200, 'a bot gets the same answer');
  assert.equal(calls.length, 0);
  // A page that is not one of ours is never passed on.
  await worker.fetch(form(site, { email: 'a@b.co', consent: 'yes', page: '//evil.example/x' }), env, {});
  assert.equal(calls[0].body.page, '/');
});

test('the Hub says too many, or is down: the visitor is told, and JSON works too', async () => {
  const site = (await import('../../sites/tgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = fakeD1('tgw', site);
  const busy = fakeHub({ ok: false, error: 'too_many' }, 429);
  assert.equal((await worker.fetch(form(site, { email: 'a@b.co', consent: 'yes' }), { DB, FX_FETCH, HUB: busy.HUB }, {})).status, 429);
  const down = { fetch: async () => { throw new Error('hub down'); } };
  const r = await worker.fetch(form(site, { email: 'a@b.co', consent: 'yes' }), { DB, FX_FETCH, HUB: down }, {});
  assert.equal(r.status, 503);
  assert.match(await r.text(), /not working right now/);
  const ok = fakeHub();
  const j = await worker.fetch(new Request(`https://${site.domain}/api/newsletter`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: `https://${site.domain}` }, body: JSON.stringify({ email: 'a@b.co', consent: true }) }), { DB, FX_FETCH, HUB: ok.HUB }, {});
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
