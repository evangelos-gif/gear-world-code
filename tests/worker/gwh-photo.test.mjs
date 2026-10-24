// Gear World Hub photo search: /api/photo-search in sites/gwh/photo-search.js and its route in sites/gwh/worker.js.
// A real SQLite (node:sqlite) stands in for D1, so the fair-use counting runs the same SQL as on Cloudflare.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import {
  handlePhotoSearch, parseModelAnswer, buildUserPrompt, visitorCode, isJpeg,
  previewResponse, addPreviewHeaders, PHOTO_MODEL, MAX_PHOTO_BYTES, DEFAULT_HOURLY_LIMIT, DEFAULT_DAILY_LIMIT
} from '../../sites/gwh/photo-search.js';
import hub from '../../sites/gwh/worker.js';

const ROOT = new URL('../../sites/gwh/', import.meta.url);
const SITES = [
  ['CGW', 'Construction Gear World', 'constructiongearworld.com'], ['MGW', "Men's Gear World", 'mensgearworld.com'],
  ['WGW', "Women's Gear World", 'womensgearworld.com'], ['KGW', "Kids' Gear World", 'kidsgearworld.com'],
  ['HGW', 'Home Gear World', 'homegearworld.com'], ['GGW', 'Garden Gear World', 'gardengearworld.com'],
  ['TGW', 'Technology Gear World', 'technologygearworld.com'], ['AGW', 'Car Gear World', 'cargearworld.com'],
  ['VGW', 'Travel Gear World', 'travelgearworld.com']
];

// D1 look-alike on node:sqlite: prepare().bind().first()/all()/run().
function makeDb() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('migrations/0001_photo_search_limits.sql', ROOT), 'utf8'));
  sql.exec('CREATE TABLE sites (id INTEGER PRIMARY KEY, site_key TEXT, site_name TEXT, domain TEXT, priority INTEGER, is_active INTEGER)');
  const add = sql.prepare('INSERT INTO sites (site_key, site_name, domain, priority, is_active) VALUES (?, ?, ?, ?, 1)');
  SITES.forEach(([k, n, d], i) => add.run(k, n, d, (i + 1) * 10));
  const wrap = (text, args = []) => ({
    bind: (...a) => wrap(text, a),
    first: async () => sql.prepare(text).get(...args) ?? null,
    all: async () => ({ results: sql.prepare(text).all(...args) }),
    run: async () => { sql.prepare(text).run(...args); return { success: true }; }
  });
  return { prepare: (text) => wrap(text), raw: sql };
}

function makeAi(answer) {
  const calls = [];
  return {
    calls,
    run: async (model, input) => {
      calls.push({ model, input });
      if (answer instanceof Error) throw answer;
      return typeof answer === 'function' ? answer(model, input) : answer;
    }
  };
}

// A small, valid-looking JPEG body (only the first bytes are checked).
function jpeg(size = 400) {
  const b = new Uint8Array(size);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  for (let i = 4; i < size; i++) b[i] = (i * 7) % 251;
  return b;
}

const GOOD = { response: 'Sure: {"found": true, "product": "cordless drill", "query": "cordless drill", "keywords": ["drill", "cordless", "power tool", "18V"], "brand": "Makita", "world": "CGW"}' };
const ORIGIN = 'https://gearworldhub.com';

function env(extra = {}) {
  return { gear_world_registry: makeDb(), AI: makeAi(GOOD), PHOTO_LIMIT_SALT: 'test-salt-0123456789abcdef', ...extra };
}

function post(body = jpeg(), headers = {}) {
  return new Request(`${ORIGIN}/api/photo-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg', Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.7', ...headers },
    body
  });
}

test('photo: the answer of the model becomes clean search words and a Gear World of the list', () => {
  const worlds = SITES.map(([key, name, domain]) => ({ key, name, domain }));
  const a = parseModelAnswer(GOOD.response, worlds);
  assert.equal(a.found, true);
  assert.equal(a.query, 'cordless drill');
  assert.deepEqual(a.keywords, ['drill', 'cordless', 'power', 'tool', '18V']);
  assert.equal(a.brand, 'Makita');
  assert.deepEqual(a.world, { key: 'CGW', name: 'Construction Gear World', domain: 'constructiongearworld.com' });

  const evil = parseModelAnswer('{"found":"true","product":"<script>alert(1)</script> boots","query":"work \\"boots\\" <img>","keywords":"steel toe, safety","brand":"none","world":"XYZ"}', worlds);
  assert.equal(evil.found, true);
  assert.ok(!/[<>"]/.test(evil.product + evil.query + evil.keywords.join(' ')), 'no HTML or quotes reach the page');
  assert.equal(evil.brand, '', '"none" is not a brand');
  assert.equal(evil.world, null, 'a world that is not in the list is dropped');

  assert.equal(parseModelAnswer('{"found": false}', worlds).found, false);
  assert.equal(parseModelAnswer('no json here', worlds), null);
  assert.equal(parseModelAnswer('{"found": true, "query": ""}', worlds).found, false, 'no words means nothing found');
  const travel = parseModelAnswer('{"found":true,"product":"suitcase","query":"hard shell suitcase","keywords":[],"brand":"","world":"vgw"}', worlds);
  assert.equal(travel.world.key, 'VGW', 'lower-case keys are accepted');
});

test('photo: the prompt lists all 9 Gear Worlds and asks for JSON only', () => {
  const p = buildUserPrompt(SITES.map(([key, name, domain]) => ({ key, name, domain })));
  for (const [key, name] of SITES) assert.ok(p.includes(`${key}: ${name}`), key);
  assert.ok(p.includes('"world"') && p.includes('"query"') && p.includes('"brand"'));
});

test('photo: only POST, only JPEG, only from the Hub itself, max 1 MB', async () => {
  const e = env();
  assert.equal((await handlePhotoSearch(new Request(`${ORIGIN}/api/photo-search`), e)).status, 405);
  assert.equal((await handlePhotoSearch(post(jpeg(), { 'Content-Type': 'image/png' }), e)).status, 415);
  assert.equal((await handlePhotoSearch(post(jpeg(), { Origin: 'https://evil.example' }), e)).status, 403);
  assert.equal((await handlePhotoSearch(post(new Uint8Array(500)), e)).status, 400, 'not a JPEG');
  assert.equal((await handlePhotoSearch(post(jpeg(50)), e)).status, 400, 'too small to be a photo');
  assert.equal((await handlePhotoSearch(post(jpeg(MAX_PHOTO_BYTES + 1)), e)).status, 413);
  // A body without Content-Length that grows too big is stopped while reading.
  const stream = new ReadableStream({
    start(c) { for (let i = 0; i < 20; i++) c.enqueue(jpeg(100 * 1024)); c.close(); }
  });
  const chunked = new Request(`${ORIGIN}/api/photo-search`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: stream, duplex: 'half' });
  assert.equal((await handlePhotoSearch(chunked, e)).status, 413);
  assert.equal(e.AI.calls.length, 0, 'the model is never asked for a refused photo');
  assert.equal(isJpeg(jpeg()), true);
});

test('photo: without the secret or the bindings it refuses (fail closed)', async () => {
  assert.equal((await handlePhotoSearch(post(), env({ PHOTO_LIMIT_SALT: '' }))).status, 503);
  assert.equal((await handlePhotoSearch(post(), env({ AI: undefined }))).status, 503);
  assert.equal((await handlePhotoSearch(post(), env({ gear_world_registry: undefined }))).status, 503);
});

test('photo: one model call with the photo, Gemma 4 without thinking, all 9 sites in the prompt', async () => {
  const e = env();
  const r = await handlePhotoSearch(post(), e);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  const body = await r.json();
  assert.deepEqual(body, {
    ok: true, found: true, product: 'cordless drill', query: 'cordless drill',
    keywords: ['drill', 'cordless', 'power', 'tool', '18V'], brand: 'Makita',
    world: { key: 'CGW', name: 'Construction Gear World', domain: 'constructiongearworld.com' }
  });
  assert.equal(e.AI.calls.length, 1);
  const { model, input } = e.AI.calls[0];
  assert.equal(model, PHOTO_MODEL);
  assert.equal(PHOTO_MODEL, '@cf/google/gemma-4-26b-a4b-it');
  assert.deepEqual(input.chat_template_kwargs, { enable_thinking: false });
  assert.equal(input.temperature, 0);
  const parts = input.messages[1].content;
  assert.ok(parts[0].text.includes('VGW: Travel Gear World'));
  assert.match(parts[1].image_url.url, /^data:image\/jpeg;base64,\/9j\//);
});

test('photo: 10 per visitor per hour and 150 per day by default; nothing but counts and a daily code is kept', async () => {
  assert.equal(DEFAULT_HOURLY_LIMIT, 10);
  assert.equal(DEFAULT_DAILY_LIMIT, 150);
  const e = env({ PHOTO_HOURLY_LIMIT: '2', PHOTO_DAILY_LIMIT: '3' });
  assert.equal((await handlePhotoSearch(post(), e)).status, 200);
  assert.equal((await handlePhotoSearch(post(), e)).status, 200);
  const third = await handlePhotoSearch(post(), e);
  assert.equal(third.status, 429);
  assert.equal((await third.json()).error, 'limit_hour');
  assert.ok(Number(third.headers.get('Retry-After')) > 0);
  assert.equal(e.AI.calls.length, 2, 'no model call after the limit');
  assert.equal((await handlePhotoSearch(post(jpeg(), { 'CF-Connecting-IP': '198.51.100.9' }), e)).status, 200, 'another visitor');
  const day = await handlePhotoSearch(post(jpeg(), { 'CF-Connecting-IP': '192.0.2.44' }), e);
  assert.equal(day.status, 429);
  assert.equal((await day.json()).error, 'limit_day');
  const rows = e.gear_world_registry.raw.prepare('SELECT * FROM photo_search_usage').all();
  const dump = JSON.stringify(rows);
  assert.ok(!dump.includes('203.0.113.7') && !dump.includes('198.51.100'), 'no IP address is stored');
  assert.ok(rows.every(r => /^[0-9a-f]{24}$/.test(r.visitor)), 'only a short one-way code');
  assert.notEqual(await visitorCode('203.0.113.7', 's'.repeat(16), '2026-10-24'), await visitorCode('203.0.113.7', 's'.repeat(16), '2026-10-25'), 'the code changes every day');
});

test('photo: model errors give a friendly answer and the photo is never logged', async () => {
  const logged = [];
  const original = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    const busy = await handlePhotoSearch(post(), env({ AI: makeAi(new Error('3040: Out of capacity')) }));
    assert.equal(busy.status, 503);
    assert.equal((await busy.json()).error, 'busy');
    const used = await handlePhotoSearch(post(), env({ AI: makeAi(new Error('4006: you have used up your daily free allocation of 10,000 neurons')) }));
    assert.equal(used.status, 429);
    assert.equal((await used.json()).error, 'limit_day');
    const odd = await handlePhotoSearch(post(), env({ AI: makeAi({ response: 'I cannot help with that.' }) }));
    assert.deepEqual(await odd.json(), { ok: true, found: false, product: '', query: '', keywords: [], brand: '', world: null });
  } finally {
    console.error = original;
  }
  assert.ok(logged.length >= 2);
  assert.ok(!logged.some(line => line.includes('/9j/') || line.includes('base64')), 'no photo data in the logs');
});

test('photo: OpenAI-style answers are read too', async () => {
  const e = env({ AI: makeAi({ choices: [{ message: { content: '{"found":true,"product":"dash cam","query":"dash cam","keywords":["dash","camera","car"],"brand":"","world":"AGW"}' } }] }) });
  const body = await (await handlePhotoSearch(post(), e)).json();
  assert.equal(body.world.key, 'AGW');
  assert.equal(body.query, 'dash cam');
});

// ---------------------------------------------------------------------------------------------
// worker.js: the existing routes are unchanged, the photo route is added, preview rules only on the test address
// ---------------------------------------------------------------------------------------------

function assetsEnv(extra = {}) {
  const served = [];
  const asset = new Response('<!doctype html><title>Hub</title>', { headers: { 'Content-Type': 'text/html' } });
  return {
    served, asset,
    env: { ASSETS: { fetch: async (req) => { served.push(new URL(req.url).pathname); return asset; } }, ...env(), ...extra }
  };
}

test('worker: on the live Hub every other request is answered exactly as before', async () => {
  const { env: e, asset, served } = assetsEnv();
  const health = await hub.fetch(new Request(`${ORIGIN}/api/health`), e, {});
  assert.deepEqual(await health.json(), { ok: true, project: 'Gear World Hub', version: 'catalogue-links-v2' });
  const page = await hub.fetch(new Request(`${ORIGIN}/privacy/`), e, {});
  assert.equal(page, asset, 'the static page is the very same response, no header added');
  assert.deepEqual(served, ['/privacy/']);
  const www = await hub.fetch(new Request('https://www.gearworldhub.com/terms/'), e, {});
  assert.equal(www.status, 301);
  assert.equal((await hub.fetch(new Request(`${ORIGIN}/robots.txt`), e, {})), asset, 'robots.txt is not touched on live');
  const photo = await hub.fetch(post(), e, {});
  assert.equal(photo.status, 200);
  assert.equal((await photo.json()).found, true);
});

test('worker: the test address is noindex, has no analytics and never writes newsletter sign-ups', async () => {
  const { env: e, served } = assetsEnv({ GWH_PREVIEW: '1' });
  const page = await hub.fetch(new Request('https://gear-world-hub-preview.example.workers.dev/'), e, {});
  assert.equal(page.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.match(page.headers.get('Permissions-Policy'), /camera=\(self\)/);
  const robots = await hub.fetch(new Request('https://gear-world-hub-preview.example.workers.dev/robots.txt'), e, {});
  assert.equal(await robots.text(), 'User-agent: *\nDisallow: /\n');
  const analytics = await hub.fetch(new Request('https://gear-world-hub-preview.example.workers.dev/analytics.js?v=1'), e, {});
  assert.match(await analytics.text(), /analytics are off/);
  const signup = await hub.fetch(new Request('https://gear-world-hub-preview.example.workers.dev/api/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@example.com', consent: true })
  }), e, {});
  assert.equal(signup.status, 403);
  assert.deepEqual(served, ['/'], 'only the page itself came from the files');
  assert.equal(previewResponse(new Request(`${ORIGIN}/robots.txt`), {}), null);
  const r = new Response('x');
  assert.equal(addPreviewHeaders(r, {}), r);
});

// ---------------------------------------------------------------------------------------------
// The page script: every text in all 11 languages of the Hub (lessons L24, L27)
// ---------------------------------------------------------------------------------------------

test('camera script: every text exists in all 11 languages and is translated', () => {
  const code = readFileSync(new URL('public/gear-world-camera.js', ROOT), 'utf8');
  const window = { addEventListener() {}, dispatchEvent() {} };
  const document = { readyState: 'loading', addEventListener() {}, documentElement: { lang: 'en-GB' } };
  vm.runInNewContext(code, { window, document, console });
  // Copied out of the script's own context, so the arrays compare like normal arrays.
  const { locales, strings } = JSON.parse(JSON.stringify(window.GearWorldPhotoSearch));
  assert.deepEqual(locales, ['en-GB', 'el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'sq-AL', 'ro-RO', 'ru-RU']);
  const translations = readFileSync(new URL('public/translations.js', ROOT), 'utf8');
  for (const l of locales) assert.ok(translations.includes(`"${l}"`), `the Hub has ${l}`);
  for (const [key, list] of Object.entries(strings)) {
    assert.equal(list.length, 11, key);
    list.forEach((text, i) => assert.ok(typeof text === 'string' && text.trim().length > 1, `${key} ${locales[i]}`));
    const english = list[0];
    for (let i = 1; i < list.length; i++) {
      if (key === 'brand' && /^Marca/.test(list[i])) continue; // "Marca" is right in Italian, Spanish and Portuguese
      assert.notEqual(list[i], english, `${key} is translated in ${locales[i]}`);
    }
    const vars = (english.match(/\{[a-z]+\}/g) || []).sort().join();
    list.forEach((text, i) => assert.equal((text.match(/\{[a-z]+\}/g) || []).sort().join(), vars, `${key} keeps its {placeholders} in ${locales[i]}`));
  }
  assert.equal(strings.note[0], 'Your photo is only used to find products and is not saved');
});

test('camera script: no red or green colours (lesson L35), and the page loads it after the voice button', () => {
  const code = readFileSync(new URL('public/gear-world-camera.js', ROOT), 'utf8');
  const colours = code.match(/#[0-9a-f]{6}\b/gi) || [];
  for (const c of colours) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    assert.ok(!(r > 150 && g < 90 && b < 90), `${c} is not red`);
    assert.ok(!(g > 150 && r < 110 && b < 110), `${c} is not green`);
  }
  const html = readFileSync(new URL('public/index.html', ROOT), 'utf8');
  const voice = html.indexOf('/gear-world-voice-v2.js');
  const camera = html.indexOf('<script src="/gear-world-camera.js?v=');
  assert.ok(voice > 0 && camera > voice, 'camera script after the voice script');
  assert.match(html, /<script src="\/gear-world-camera\.js\?v=[^"]+" defer><\/script>/);
  const allow = readFileSync(new URL('public-allowlist.txt', ROOT), 'utf8').split('\n');
  assert.ok(allow.includes('gear-world-camera.js'));
});

test('analytics: photo_search sends only the outcome, through the consent check', () => {
  const code = readFileSync(new URL('public/analytics.js', ROOT), 'utf8');
  const i = code.indexOf('"gwh:photo_search"');
  assert.ok(i > 0);
  const block = code.slice(i, code.indexOf(');', code.indexOf('track("photo_search"', i)) + 2);
  assert.match(block, /track\("photo_search"/, 'uses track(), which checks the consent');
  assert.ok(!/query|keyword|words|image|photo_data|search_term/.test(block.replace('gwh:photo_search', '').replace('track("photo_search"', '')), 'no words and no photo');
  assert.match(code, /\/analytics\.js|track\(/);
  const html = readFileSync(new URL('public/index.html', ROOT), 'utf8');
  assert.ok(!html.includes('/analytics.js?v=20261005-ga4-order-fix'), 'new ?v= for the changed analytics.js (lesson L31)');
});

test('privacy page: explains the photo search and the date is updated', () => {
  const html = readFileSync(new URL('public/privacy/index.html', ROOT), 'utf8');
  assert.match(html, /<strong>Photo search\.<\/strong>/);
  assert.match(html, /We do not store the photo/);
  assert.match(html, /deleted after 2 days/);
  assert.match(html, /Last updated: 24 October 2026/);
});
