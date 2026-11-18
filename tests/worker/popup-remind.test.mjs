// The small sign-up window and "Remind me on 27 Nov" (lessons L182, owner's decisions of 16 and 17 Nov 2026).
// - The window: made only by the site script after the page has loaded, at the bottom of the screen, after the cookie
//   answer, after 30 seconds or half-way down the page, at most once a month, never after a sign-up, never while the
//   "Get deal updates" box is on the screen, never on the legal pages; the same /api/newsletter, sent as form 'popup'.
// - "Remind me on 27 Nov": on the page of a product the visitor may see, until the end of 27 Nov (London), while the
//   Hub says its list is open; email + an unticked box + Turnstile; the product's name and our own /product/ address go
//   to the Hub (never /out/ or /go/), the visitor's IP address never does.
// - Every new text is in every dictionary of the 13 sites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker, clientKey } from '../../src/engine.js';
import { REMIND_URL, REMIND_UNTIL, REMIND_UNTIL_ISO, remindProbe } from '../../src/lib/remind.js';
import { useClock } from '../../src/lib/visibility.js';
import { translatableTexts } from './i18n-keys.mjs';
import { TEST_DAY } from './test-clock.mjs';

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const FX_FETCH = async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } });
const SITEKEY = '0x4AAAAAAAtest_sitekey-01';
const TOKEN = 'turnstile-token-from-the-widget';
const NOT_SHOPS = new Set(['group', 'gwh', 'ogw', 'posters', 'awin']);
const codes = readdirSync('sites').filter(c => !NOT_SHOPS.has(c) && existsSync(`sites/${c}/site.config.js`));
const LANGS = ['de-DE', 'el-GR', 'es-ES', 'fr-FR', 'it-IT', 'nl-NL', 'pl-PL', 'pt-PT', 'ro-RO', 'ru-RU', 'sq-AL'];
const JS = readFileSync('sites/tgw/public/assets/site.js', 'utf8');
const CSS = readFileSync('sites/tgw/public/assets/site.css', 'utf8');

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
  return { writes, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
// The Hub: GET /internal/remind says whether the list is open; POST answers like the real one.
function fakeHub({ open = true, answer = { ok: true } } = {}) {
  const calls = [];
  return {
    calls,
    HUB: {
      fetch: async (url, init = {}) => {
        if (!init.method || init.method === 'GET') { calls.push({ url: String(url), method: 'GET' }); return json({ ok: true, open }); }
        calls.push({ url: String(url), method: init.method, body: JSON.parse(init.body) });
        return json(answer);
      }
    }
  };
}

const get = (worker, site, path, env) => worker.fetch(new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': PHONE } }), env, { waitUntil() {} });
const postJson = (worker, site, path, body, env, headers = {}) => worker.fetch(new Request(`https://${site.domain}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: `https://${site.domain}`, 'User-Agent': PHONE, 'CF-Connecting-IP': '203.0.113.7', ...headers },
  body: JSON.stringify(body)
}), env, { waitUntil() {} });

// A product a UK visitor may see on the test day: the first product link of the home page.
async function firstProduct(worker, site, env) {
  const home = await (await get(worker, site, '/', env)).text();
  const m = home.match(/href="(\/product\/[a-z0-9-]*-(\d+)\/)"/);
  assert.ok(m, `${site.code}: a product on the home page`);
  return { path: m[1], id: Number(m[2]) };
}

function remindBlock(html) {
  const i = html.indexOf('<details class="remind"');
  return i < 0 ? '' : html.slice(i, html.indexOf('</details>', i) + 10);
}

// ---------------------------------------------------------------- the small sign-up window (site.js)

test('the window: only from the script, with every condition of the owner\'s list', () => {
  const part = JS.slice(JS.indexOf('// ---------- The small sign-up window'), JS.indexOf('// ---------- "Remind me on 27 Nov"'));
  assert.ok(part.length > 1000);
  assert.match(part, /var POPUP_DAYS = 30;/, 'at most once a month');
  assert.match(part, /var POPUP_SECONDS = 30;/, 'after 30 seconds');
  assert.match(part, /setTimeout\(start, POPUP_SECONDS \* 1000\)/);
  assert.match(part, /\(y \+ window\.innerHeight\) >= doc\.scrollHeight \/ 2/, 'or half-way down the page');
  assert.match(part, /write\('popup-date', today\(\)\)/, 'only the date is kept');
  assert.match(part, /read\('popup-done', ''\) === '1'\) return;/, 'never after a sign-up');
  assert.match(part, /if \(document\.querySelector\('\[data-signed-up\]'\)\) write\('popup-done', '1'\);/, 'a sign-up in the box counts too');
  assert.match(part, /if \(ok\) \{ write\('popup-done', '1'\);/);
  assert.match(part, /document\.querySelector\('\[data-lang-note\]'\)/, 'not on the legal pages');
  assert.match(part, /STORE \+ '-cookie-consent'/, 'only after the cookie answer');
  assert.match(part, /banner && !banner\.hidden\) return false;/);
  assert.match(part, /new IntersectionObserver[\s\S]*observe\(footer\)/, 'not while the "Get deal updates" box is on the screen');
  assert.match(part, /footerSeen \|\| compareOpen\(\)/);
  assert.match(part, /ev\.key === 'Escape'/, 'Esc closes it');
  assert.match(part, /close\.setAttribute\('aria-label', t\('Close'\)\)/);
  assert.match(part, /box\.setAttribute\('role', 'region'\)/, 'a region, not a modal dialog: no focus trap');
  assert.doesNotMatch(part, /\.focus\(\)/, 'it never takes the focus');
  assert.match(part, /sendJson\('\/api\/newsletter', \{[^}]*form: 'popup' \}/, 'the same endpoint, counted as the window');
  assert.match(part, /tick\.type = 'checkbox';\n\s+tick\.name = 'consent';\n\s+tick\.required = true;/);
  assert.doesNotMatch(part, /tick\.checked = true/, 'the box is never ticked for the visitor');
  assert.match(part, /t\('Email me deals from Gear World\.'\)/, 'the consent text of the box');
  assert.match(part, /appearance: 'interaction-only'/, 'the check takes no room unless it needs the visitor');
  // Nothing of it in a server page: search engines never see it.
  assert.match(JS, /setupRemind\(\);\n\s+setupPopup\(\);/);
  // Styles: bottom, no backdrop, a phone gets at most 30% of the height, a 44 px close button, under the cookie banner.
  assert.match(CSS, /\.pop \{ position: fixed; left: 0; right: 0; bottom: 0; z-index: 45; max-height: 30vh;/);
  assert.match(CSS, /@media \(min-width: 700px\) and \(min-height: 600px\) \{ \.pop,/, 'the card only on tall screens: a phone on its side keeps the band');
  assert.match(CSS, /body\.has-compare-bar \.pop \{ bottom: 76px; \}/, 'above the compare bar');
  assert.match(part, /box\.style\.bottom = open \? \(bar\.offsetHeight \+/, 'above the compare bar at its real height (two rows on a phone)');
  assert.match(CSS, /@media \(min-width: 560px\) and \(max-height: 599px\) \{ \.pop \{ display: grid;/, 'two columns on a phone on its side, from 560 px');
  assert.match(CSS, /\.pop-close \{[^}]*width: 44px; height: 44px;/);
  assert.match(CSS, /\.consent \{ position: fixed;[^}]*z-index: 50;/);
  assert.doesNotMatch(CSS, /\.pop[^{]*\{[^}]*(backdrop|inset: 0)/, 'no dark backdrop');
});

test('the window sends form "popup" to the Hub; the box sends "box"; anything else counts as the box', async () => {
  const site = (await import('../../sites/tgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = fakeD1('tgw', site);
  const { calls, HUB } = fakeHub();
  const env = { DB, FX_FETCH, HUB, TURNSTILE_SITE_KEY: SITEKEY };
  const r = await postJson(worker, site, '/api/newsletter', { email: 'Pop@Example.com', consent: true, page: '/deals/', website: '', turnstile_token: TOKEN, form: 'popup' }, env);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, message: 'Thanks. You are signed up for deal updates. Every email has an unsubscribe link.' });
  assert.equal(calls.at(-1).body.form, 'popup');
  assert.equal(calls.at(-1).body.email, 'pop@example.com');
  assert.ok(!JSON.stringify(calls.at(-1).body).includes('203.0.113.7'));
  await postJson(worker, site, '/api/newsletter', { email: 'a@example.com', consent: true, turnstile_token: TOKEN, form: '<script>' }, env);
  assert.equal(calls.at(-1).body.form, 'box');
  // The answer page of the box after a sign-up tells the script not to show the window again.
  const page = await worker.fetch(new Request(`https://${site.domain}/api/newsletter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: `https://${site.domain}`, 'User-Agent': PHONE },
    body: new URLSearchParams({ email: 'b@example.com', consent: 'yes', 'cf-turnstile-response': TOKEN }).toString()
  }), env, { waitUntil() {} });
  assert.match(await page.text(), /<article class="prose" data-signed-up>/);
});

// ---------------------------------------------------------------- "Remind me on 27 Nov" on a product page

for (const code of codes) {
  test(`${code.toUpperCase()}: "Remind me on 27 Nov" on a product page while the Hub's list is open, with the box unticked`, async () => {
    const site = (await import(`../../sites/${code}/site.config.js`)).default;
    const worker = createWorker(site);
    const DB = fakeD1(code, site);
    const { calls, HUB } = fakeHub();
    const env = { DB, FX_FETCH, HUB, TURNSTILE_SITE_KEY: SITEKEY };
    const p = await firstProduct(worker, site, env);
    const html = await (await get(worker, site, p.path, env)).text();
    const box = remindBlock(html);
    assert.ok(box, 'the box is on the page');
    assert.ok(box.includes(`data-remind="${REMIND_UNTIL_ISO}"`), 'the script removes it after 27 Nov');
    assert.ok(box.includes('<form class="remind-form" action="/api/remind" method="post">'));
    assert.ok(box.includes(`<input type="hidden" name="product" value="${p.id}">`));
    assert.ok(box.includes(`data-remind-turnstile data-sitekey="${SITEKEY}"`));
    assert.match(box, /<input type="checkbox" name="consent" value="yes" required>/);
    assert.doesNotMatch(box, /checked/, 'never ticked for the visitor');
    assert.match(box, /MailerLite sends the email for us/, 'the consent says who sends it');
    assert.doesNotMatch(box, /\bdeals?\b|%|\bWas\b|\bsave\b|Black Friday/i, 'no "deals", percentage, "Was", "save" or "Black Friday" (L103, L107)');
    assert.doesNotMatch(box, /\/out\/|\/go\//);
    assert.ok(calls.some(c => c.method === 'GET' && c.url === REMIND_URL), 'the Hub was asked');
    // Every text of the page is in every dictionary of the site (lessons L24).
    for (const lang of LANGS) {
      const d = JSON.parse(readFileSync(`sites/${code}/public/assets/i18n/${lang}.json`, 'utf8'));
      for (const k of translatableTexts(box)) assert.ok(d[k] && d[k] !== k, `${code}/${lang}: "${k}"`);
    }
  });
}

test('no "Remind me" box: Hub list closed, no Turnstile sitekey, after 27 Nov, a test address, or a product the visitor may not see', async () => {
  const site = (await import('../../sites/agw/site.config.js')).default;
  const DB = fakeD1('agw', site);
  // The Hub says closed (or is an older Hub that does not know the address).
  {
    const worker = createWorker(site);
    const { HUB } = fakeHub({ open: false });
    const env = { DB, FX_FETCH, HUB, TURNSTILE_SITE_KEY: SITEKEY };
    const p = await firstProduct(worker, site, env);
    assert.equal(remindBlock(await (await get(worker, site, p.path, env)).text()), '');
  }
  {
    const worker = createWorker(site);
    const old = { fetch: async () => json({ ok: false, error: 'not_found' }, 404) };
    const env = { DB, FX_FETCH, HUB: old, TURNSTILE_SITE_KEY: SITEKEY };
    const p = await firstProduct(worker, site, env);
    assert.equal(remindBlock(await (await get(worker, site, p.path, env)).text()), '');
  }
  {
    const worker = createWorker(site);
    const { HUB } = fakeHub();
    const env = { DB, FX_FETCH, HUB };
    const p = await firstProduct(worker, site, env);
    assert.equal(remindBlock(await (await get(worker, site, p.path, env)).text()), '', 'no sitekey: no box');
  }
  {
    const worker = createWorker(site);
    const { HUB, calls } = fakeHub();
    const env = { DB, FX_FETCH, HUB, TURNSTILE_SITE_KEY: SITEKEY };
    const p = await firstProduct(worker, site, env);
    const html = await (await worker.fetch(new Request(`https://car-gear-world.example.workers.dev${p.path}`, { headers: { 'User-Agent': PHONE } }), env, { waitUntil() {} })).text();
    assert.equal(remindBlock(html), '', 'not on a test address');
    assert.equal(calls.length, 0);
  }
  // After the end of 27 Nov (London): no box, and the Hub is not even asked.
  const restore = () => useClock(() => Date.parse(`${TEST_DAY}T12:00:00Z`));
  try {
    useClock(() => REMIND_UNTIL + 1000);
    const worker = createWorker(site);
    const { HUB, calls } = fakeHub();
    const env = { DB, FX_FETCH, HUB, TURNSTILE_SITE_KEY: SITEKEY };
    const html = await (await get(worker, site, '/', env)).text();
    const m = html.match(/href="(\/product\/[a-z0-9-]*-\d+\/)"/);
    if (m) assert.equal(remindBlock(await (await get(worker, site, m[1], env)).text()), '');
    assert.ok(!calls.some(c => c.url === REMIND_URL));
  } finally { restore(); }
});

test('the Hub is asked at most every 10 minutes while open, every minute while closed, never after 27 Nov', async () => {
  let n = 0;
  let open = false;
  const binding = { fetch: async () => { n++; return json({ ok: true, open }); } };
  const probe = remindProbe();
  const t0 = Date.parse('2026-11-20T12:00:00Z');
  assert.equal(await probe(binding, t0), false);
  assert.equal(await probe(binding, t0 + 30000), false);
  assert.equal(n, 1);
  open = true;
  assert.equal(await probe(binding, t0 + 61000), true);
  assert.equal(n, 2);
  assert.equal(await probe(binding, t0 + 61000 + 9 * 60000), true);
  assert.equal(n, 2);
  assert.equal(await probe(binding, t0 + 61000 + 11 * 60000), true);
  assert.equal(n, 3);
  assert.equal(await probe(binding, REMIND_UNTIL + 1), false);
  assert.equal(n, 3);
  assert.equal(await probe(null, t0), false);
  const broken = remindProbe();
  assert.equal(await broken({ fetch: async () => { throw new Error('down'); } }, t0), false);
  assert.equal(await broken({ fetch: async () => json({ ok: true, open: 'yes' }) }, t0 + 120000), false, 'only open: true counts');
});

test('POST /api/remind: the product\'s name and our /product/ address go to the Hub, never the IP; every refusal says why', async () => {
  const site = (await import('../../sites/cgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = fakeD1('cgw', site);
  const { calls, HUB } = fakeHub();
  const env = { DB, FX_FETCH, HUB, TURNSTILE_SITE_KEY: SITEKEY };
  const p = await firstProduct(worker, site, env);
  const ok = await postJson(worker, site, '/api/remind', { email: ' Rem@Example.com ', consent: true, product: String(p.id), website: '', turnstile_token: TOKEN }, env);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, message: 'Thanks. We will email you once, on 27 Nov, with a link to this product.' });
  const sent = calls.filter(c => c.method === 'POST');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, REMIND_URL);
  const { product, ...rest } = sent[0].body;
  assert.deepEqual(rest, { email: 'rem@example.com', consent: true, site: 'cgw', client: await clientKey('203.0.113.7'), turnstile_token: TOKEN });
  assert.equal(product.id, p.id);
  assert.equal(product.url, `https://${site.domain}${p.path}`, 'our own product page');
  assert.ok(product.name.length > 3 && product.name.length <= 200);
  assert.ok(!JSON.stringify(sent[0].body).includes('203.0.113.7'), 'the IP address never leaves the site');
  assert.deepEqual(DB.writes, [], 'the site database is not written');

  const refused = async (body, status, message, headers) => {
    const before = calls.filter(c => c.method === 'POST').length;
    const r = await postJson(worker, site, '/api/remind', body, env, headers);
    assert.equal(r.status, status, message);
    assert.deepEqual(await r.json(), { ok: false, error: message });
    assert.equal(calls.filter(c => c.method === 'POST').length, before, `${message}: nothing went to the Hub`);
  };
  await refused({ email: 'a@b.co', product: String(p.id), turnstile_token: TOKEN }, 400, 'Tick the box to get the reminder email.');
  await refused({ email: 'a@b.co', consent: 'true', product: String(p.id), turnstile_token: TOKEN }, 400, 'Tick the box to get the reminder email.');
  await refused({ email: 'nope', consent: true, product: String(p.id), turnstile_token: TOKEN }, 400, 'Enter a valid email address.');
  await refused({ email: 'a@b.co', consent: true, product: '999999999', turnstile_token: TOKEN }, 404, 'This product is no longer listed.');
  await refused({ email: 'a@b.co', consent: true, product: 'x1', turnstile_token: TOKEN }, 404, 'This product is no longer listed.');
  await refused({ email: 'a@b.co', consent: true, product: String(p.id) }, 403, 'This sign-up box needs JavaScript for its security check. Turn on JavaScript and try again.');
  await refused({ email: 'a@b.co', consent: true, product: String(p.id), turnstile_token: TOKEN }, 403, 'This form only works on this website.', { Origin: 'https://evil.example' });
  // A bot field: the same answer as a real sign-up, nothing sent.
  const before = calls.length;
  const bot = await postJson(worker, site, '/api/remind', { email: 'a@b.co', consent: true, product: String(p.id), website: 'x', turnstile_token: TOKEN }, env);
  assert.equal(bot.status, 200);
  assert.equal(calls.length, before);
  // The Hub's own refusals.
  for (const [answer, status, message] of [
    [{ ok: false, error: 'closed' }, 410, 'Reminders for 27 Nov are closed.'],
    [{ ok: false, error: 'too_many' }, 429, 'Too many attempts. Try again in an hour.'],
    [{ ok: false, error: 'limit_day' }, 429, 'Sign-ups are full for today. Please try again tomorrow.'],
    [{ ok: false, error: 'turnstile_failed' }, 403, 'The security check failed. Reload the page and try again.'],
    [{ ok: false, error: 'subscribe_failed' }, 503, 'Sign-up is not working right now. Please try again later.']
  ]) {
    const w = createWorker(site);
    const hub = fakeHub({ answer });
    const r = await postJson(w, site, '/api/remind', { email: 'a@b.co', consent: true, product: String(p.id), turnstile_token: TOKEN }, { ...env, HUB: hub.HUB });
    assert.equal(r.status, status, answer.error);
    assert.deepEqual(await r.json(), { ok: false, error: message });
  }
  // Without JavaScript (a form post): the answer page, in the site's look.
  const formPost = await worker.fetch(new Request(`https://${site.domain}/api/remind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: `https://${site.domain}`, 'User-Agent': PHONE },
    body: new URLSearchParams({ email: 'c@example.com', consent: 'yes', product: String(p.id), 'cf-turnstile-response': TOKEN }).toString()
  }), env, { waitUntil() {} });
  const page = await formPost.text();
  assert.match(page, /<h1>You will get a reminder<\/h1>/);
  assert.doesNotMatch(page, /data-signed-up/, 'a reminder is not a sign-up to the weekly email');
  // After the end of 27 Nov: closed, nothing sent.
  try {
    useClock(() => REMIND_UNTIL + 1000);
    await refused({ email: 'a@b.co', consent: true, product: String(p.id), turnstile_token: TOKEN }, 410, 'Reminders for 27 Nov are closed.');
  } finally { useClock(() => Date.parse(`${TEST_DAY}T12:00:00Z`)); }
});

test('POST /api/remind: a product whose retailer does not deliver to the visitor is refused', async () => {
  const site = (await import('../../sites/cgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = fakeD1('cgw', site);
  const { calls, HUB } = fakeHub();
  const env = { DB, FX_FETCH, HUB, TURNSTILE_SITE_KEY: SITEKEY };
  // A retailer that delivers only outside the UK (site config deliversTo), if the test data has one.
  let row = null;
  for (const [retailer, list] of Object.entries((site.deliversTo && site.deliversTo.retailers) || {})) {
    if (!Array.isArray(list) || !list.length || list.includes('GB') || list.includes('WORLD')) continue;
    row = await DB.prepare('SELECT id FROM products WHERE is_active = 1 AND retailer = ? LIMIT 1').bind(retailer).first();
    if (row) break;
  }
  assert.ok(row, 'the CGW test data has a retailer that does not deliver to the UK');
  const r = await postJson(worker, site, '/api/remind', { email: 'a@b.co', consent: true, product: String(row.id), turnstile_token: TOKEN }, env);
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { ok: false, error: 'We cannot set a reminder for this product in your country.' });
  assert.equal(calls.filter(c => c.method === 'POST').length, 0);
});

// ---------------------------------------------------------------- texts in every dictionary

test('every text the script writes for the window and the reminder, and every new legal sentence, is in the 143 dictionaries', async () => {
  const part = JS.slice(JS.indexOf('function sendJson'), JS.indexOf('// ---------- Discount codes'));
  const keys = new Set([...part.matchAll(/\bt\('((?:[^'\\]|\\.)+)'\)/g)].map(m => m[1].replace(/\\'/g, "'")));
  for (const k of ['Close', 'Get our weekly email: prices we\'ve checked and the stores\' codes.', 'Email me deals from Gear World.', 'Sign up', 'Your email address', 'Privacy policy']) assert.ok(keys.has(k), k);
  // The server's answers, which the script shows through t().
  for (const k of ['Thanks. We will email you once, on 27 Nov, with a link to this product.', 'Reminders for 27 Nov are closed.', 'Tick the box to get the reminder email.',
    'This product is no longer listed.', 'We cannot set a reminder for this product in your country.']) keys.add(k);
  // The legal pages of a site with "Get deal updates" (Hub link and sitekey).
  const site = (await import('../../sites/hgw/site.config.js')).default;
  const worker = createWorker(site);
  const env = { DB: fakeD1('hgw', site), FX_FETCH, HUB: fakeHub().HUB, TURNSTILE_SITE_KEY: SITEKEY };
  const privacy = await (await get(worker, site, '/privacy/', env)).text();
  const cookies = await (await get(worker, site, '/cookies/', env)).text();
  assert.match(privacy, /<strong>Small sign-up window\.<\/strong>/);
  assert.match(privacy, /<strong>Remind me on 27 Nov\.<\/strong>/);
  assert.match(privacy, /We delete the list on 28 November 2026/);
  assert.match(privacy, /Reminders for 27 Nov: deleted on 28 November 2026\./);
  assert.match(cookies, /The small sign-up window and &quot;Remind me on 27 Nov&quot; use the same check\.|The small sign-up window and "Remind me on 27 Nov" use the same check\./);
  assert.match(cookies, /keeps the date it last appeared/);
  const NEW_LEGAL = ['Small sign-up window.', 'Remind me on 27 Nov.', 'Reminders for 27 Nov: deleted on 28 November 2026.', 'The small sign-up window and "Remind me on 27 Nov" use the same check.'];
  const article = h => h.slice(h.indexOf('<article class="prose">'), h.indexOf('</article>'));
  const pageTexts = new Set([...translatableTexts(article(privacy)), ...translatableTexts(article(cookies))]);
  for (const k of NEW_LEGAL) assert.ok(pageTexts.has(k), k);
  for (const k of pageTexts) if (/sign-up window|Remind me|27 Nov|28 November/.test(k)) keys.add(k);
  assert.ok(keys.size >= 17, `${keys.size} texts`);
  // Every text of the two legal texts in every HGW dictionary (the other sites' pages have the same new sentences).
  for (const lang of LANGS) {
    const d = JSON.parse(readFileSync(`sites/hgw/public/assets/i18n/${lang}.json`, 'utf8'));
    for (const k of pageTexts) assert.ok(typeof d[k] === 'string' && d[k].trim(), `hgw/${lang}: "${k}"`);
  }
  for (const c of codes) {
    for (const lang of LANGS) {
      const d = JSON.parse(readFileSync(`sites/${c}/public/assets/i18n/${lang}.json`, 'utf8'));
      for (const k of keys) {
        assert.ok(d[k] && d[k] !== k, `${c}/${lang}: "${k}"`);
        assert.deepEqual((d[k].match(/\{\d+\}/g) || []).sort(), (k.match(/\{\d+\}/g) || []).sort(), `${c}/${lang}: placeholders of "${k}"`);
      }
    }
  }
});

test('the Hub check: an answer slower than 1.5 s counts as closed, and requests at the same time share one question', async () => {
  let n = 0;
  const slow = { fetch: () => { n++; return new Promise(r => setTimeout(() => r(json({ ok: true, open: true })), 5000)); } };
  const probe = remindProbe({ timeoutMs: 50 });
  const t0 = Date.parse('2026-11-20T12:00:00Z');
  const [a, b, c] = await Promise.all([probe(slow, t0), probe(slow, t0), probe(slow, t0)]);
  assert.deepEqual([a, b, c], [false, false, false]);
  assert.equal(n, 1, 'one question for three pages');
  // Closed at 27 Nov 06:00 London, before the drafts of the 27 Nov email (06:41).
  assert.equal(REMIND_UNTIL_ISO, '2026-11-27T06:00:00Z');
});
