// Poster QR scans (lessons L76): who counts, what is counted, and that the page never waits or breaks for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { posterScan, isPosterScan, posterCampaign, POSTER_COUNT_URL } from '../../src/lib/poster-scan.js';
import { createPosterCounter, countScan, campaignName, londonDay, SITES, CAMPAIGNS, DAILY_CAP } from '../../src/posters.js';
import { addPostersJsonc, addPostersToml, parseJsonc } from '../../tools/poster-config.mjs';

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const BROWSER = {
  'User-Agent': PHONE,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document'
};
const POSTER_Q = '?utm_source=poster&utm_medium=qr&utm_campaign=poster-a&utm_content=kgw';
const req = (url, headers = BROWSER, method = 'GET') => new Request(url, { method, headers });
const fakePosters = () => {
  const calls = [];
  return { calls, POSTERS: { fetch: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(null, { status: 204 }); } } };
};
const ctx = () => { const waits = []; return { waits, waitUntil: p => waits.push(p) }; };

// ---------- what counts ----------
test('a person opening the poster address in a browser counts', () => {
  const u = `https://kidsgearworld.com/${POSTER_Q}`;
  assert.equal(isPosterScan(req(u), new URL(u), 'kidsgearworld.com'), true);
  assert.equal(isPosterScan(req(u.replace('poster&', 'POSTER&')), new URL(u.replace('poster&', 'POSTER&')), 'kidsgearworld.com'), true, 'case does not matter');
  // Older browsers send no Sec-Fetch headers: still a person.
  const old = { 'User-Agent': PHONE, Accept: 'text/html,*/*' };
  assert.equal(isPosterScan(req(u, old), new URL(u), 'kidsgearworld.com'), true);
});

test('bots, link previews, prefetch, HEAD, other pages and other sources do not count', () => {
  const u = `https://kidsgearworld.com/${POSTER_Q}`;
  const no = (headers, method = 'GET', url = u, domain = 'kidsgearworld.com') => assert.equal(isPosterScan(req(url, headers, method), new URL(url), domain), false, JSON.stringify({ headers, method, url }));
  no(BROWSER, 'HEAD');
  for (const ua of ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'facebookexternalhit/1.1', 'WhatsApp/2.24.1 A', 'TelegramBot (like TwitterBot)',
    'Slackbot-LinkExpanding 1.0', 'curl/8.5.0', 'python-requests/2.32', 'Mozilla/5.0 (Windows NT; Windows NT 10.0; en-GB) WindowsPowerShell/5.1.26100.1',
    'GearWorldQA-bot/1.0 (+read-only check)', 'Mozilla/5.0 (compatible; Discordbot/2.0)', 'Viber/22.0', 'SkypeUriPreview Preview/0.5', '']) {
    no({ ...BROWSER, 'User-Agent': ua });
  }
  no({ ...BROWSER, 'Sec-Purpose': 'prefetch' });
  no({ ...BROWSER, 'Sec-Purpose': 'prefetch;prerender' });
  no({ ...BROWSER, Purpose: 'prefetch' });
  no({ ...BROWSER, 'X-Moz': 'prefetch' });
  no({ ...BROWSER, 'Sec-Fetch-Dest': 'image' });
  no({ ...BROWSER, 'Sec-Fetch-Mode': 'no-cors' });
  no({ ...BROWSER, Accept: '*/*' });
  no(BROWSER, 'GET', 'https://kidsgearworld.com/category/toys/?utm_source=poster&utm_campaign=poster-a');
  no(BROWSER, 'GET', 'https://kidsgearworld.com/?utm_source=newsletter&utm_campaign=poster-a');
  no(BROWSER, 'GET', 'https://kidsgearworld.com/');
  no(BROWSER, 'GET', `https://www.kidsgearworld.com/${POSTER_Q}`, 'kidsgearworld.com');
  no(BROWSER, 'GET', `https://kids-gear-world-preview.x.workers.dev/${POSTER_Q}`, 'kidsgearworld.com');
});

test('the poster name is cleaned, and the counter keeps only the known posters', () => {
  assert.equal(posterCampaign(new URL('https://a.com/?utm_campaign=Poster-B')), 'poster-b');
  assert.equal(posterCampaign(new URL('https://a.com/?utm_campaign=%3Cscript%3Ealert(1)')), 'scriptalert1');
  assert.equal(posterCampaign(new URL(`https://a.com/?utm_campaign=${'x'.repeat(100)}`)).length, 40);
  for (const c of ['poster10', 'poster-a', 'poster-b', 'poster-c', 'poster-test']) assert.equal(campaignName(c), c);
  assert.equal(campaignName('POSTER-A'), 'poster-a');
  for (const c of ['', 'poster-z', 'poster11', 'scriptalert1', undefined]) assert.equal(campaignName(c), 'other');
  assert.deepEqual(SITES, ['hub', 'cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw', 'tgw', 'vgw', 'agw', 'sgw']);
  assert.ok(CAMPAIGNS.includes('poster10'));
});

test('the day is London time (BST in summer, GMT in winter)', () => {
  assert.equal(londonDay(new Date('2026-07-01T23:30:00Z')), '2026-07-02', 'BST: 00:30 on the 2nd');
  assert.equal(londonDay(new Date('2026-12-01T23:30:00Z')), '2026-12-01', 'GMT: still the 1st');
});

// ---------- sending the count ----------
test('posterScan sends site and poster only, in the background, and never throws', async () => {
  const { calls, POSTERS } = fakePosters();
  const c = ctx();
  const sent = posterScan(req(`https://kidsgearworld.com/${POSTER_Q}`), { POSTERS }, c, { site: 'KGW', domain: 'kidsgearworld.com' });
  assert.equal(sent, true);
  assert.equal(c.waits.length, 1, 'ctx.waitUntil holds the count, the page does not wait');
  await Promise.all(c.waits);
  assert.deepEqual(calls, [{ url: POSTER_COUNT_URL, body: { site: 'kgw', campaign: 'poster-a' } }], 'nothing about the visitor is sent');
  // A failing counter: swallowed.
  const broken = { POSTERS: { fetch: async () => { throw new Error('down'); } } };
  const c2 = ctx();
  assert.equal(posterScan(req(`https://kidsgearworld.com/${POSTER_Q}`), broken, c2, { site: 'kgw', domain: 'kidsgearworld.com' }), true);
  await assert.doesNotReject(Promise.all(c2.waits));
  const sync = { POSTERS: { fetch: () => { throw new Error('sync'); } } };
  const c3 = ctx();
  posterScan(req(`https://kidsgearworld.com/${POSTER_Q}`), sync, c3, { site: 'kgw', domain: 'kidsgearworld.com' });
  await assert.doesNotReject(Promise.all(c3.waits));
  // No binding, a test address (off) or no env: nothing sent, no error.
  assert.equal(posterScan(req(`https://kidsgearworld.com/${POSTER_Q}`), {}, ctx(), { site: 'kgw', domain: 'kidsgearworld.com' }), false);
  assert.equal(posterScan(req(`https://kidsgearworld.com/${POSTER_Q}`), { POSTERS }, ctx(), { site: 'kgw', domain: 'kidsgearworld.com', off: true }), false);
  assert.equal(posterScan(req(`https://kidsgearworld.com/${POSTER_Q}`), undefined, undefined, { site: 'kgw', domain: 'kidsgearworld.com' }), false);
});

// ---------- the counter Worker and its table ----------
function posterDb() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('sites/posters/migrations/0001_poster_scans.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: sql.prepare(text).all(...args) })
  });
  return { sql, db: { prepare: text => stmt(text) } };
}

test('counter: +1 per scan in one row per day, poster and site (UPSERT), and at most the daily cap', async () => {
  const { sql, db } = posterDb();
  const now = new Date('2026-10-27T12:00:00Z');
  for (let i = 0; i < 3; i++) await countScan(db, { site: 'kgw', campaign: 'poster-a' }, now);
  await countScan(db, { site: 'cgw', campaign: 'poster-a' }, now);
  await countScan(db, { site: 'kgw', campaign: 'poster-zzz' }, now);
  await countScan(db, { site: 'kgw', campaign: 'poster-a' }, new Date('2026-10-28T12:00:00Z'));
  const rows = sql.prepare('SELECT day, campaign, site, scans FROM poster_scans ORDER BY day, campaign, site').all().map(r => ({ ...r }));
  assert.deepEqual(rows, [
    { day: '2026-10-27', campaign: 'other', site: 'kgw', scans: 1 },
    { day: '2026-10-27', campaign: 'poster-a', site: 'cgw', scans: 1 },
    { day: '2026-10-27', campaign: 'poster-a', site: 'kgw', scans: 3 },
    { day: '2026-10-28', campaign: 'poster-a', site: 'kgw', scans: 1 }
  ]);
  const cols = sql.prepare("SELECT name FROM pragma_table_info('poster_scans')").all().map(r => r.name);
  assert.deepEqual(cols, ['day', 'campaign', 'site', 'scans'], 'only these 4 fields: nothing about visitors');
  // Cap
  for (let i = 0; i < 5; i++) await countScan(db, { site: 'sgw', campaign: 'poster-b' }, now, 3);
  const capped = await countScan(db, { site: 'sgw', campaign: 'poster-b' }, now, 3);
  assert.equal(capped.counted, false);
  assert.equal(sql.prepare("SELECT scans FROM poster_scans WHERE site = 'sgw'").get().scans, 3);
  assert.equal(DAILY_CAP, 200);
  // Unknown site
  assert.deepEqual(await countScan(db, { site: 'xyz', campaign: 'poster-a' }, now), { ok: false, error: 'site' });
});

test('counter Worker: only POST /scan with a small JSON body; errors answer without breaking', async () => {
  const { sql, db } = posterDb();
  const w = createPosterCounter();
  const post = (body, path = '/scan', method = 'POST', env = { POSTER_DB: db }) => w.fetch(new Request(`https://gear-world-posters${path}`, { method, body, headers: { 'Content-Type': 'application/json' } }), env);
  assert.equal((await post(JSON.stringify({ site: 'hub', campaign: 'poster10' }))).status, 200);
  assert.equal(sql.prepare('SELECT SUM(scans) AS n FROM poster_scans').get().n, 1);
  assert.equal((await post(JSON.stringify({ site: 'hub' }), '/other')).status, 404);
  assert.equal((await w.fetch(new Request('https://gear-world-posters/scan'), { POSTER_DB: db })).status, 405);
  assert.equal((await post('not json')).status, 400);
  assert.equal((await post(JSON.stringify({ site: 'nope', campaign: 'poster-a' }))).status, 400);
  assert.equal((await post(JSON.stringify({ site: 'hub', campaign: 'x'.repeat(600) }))).status, 413);
  assert.equal((await post(JSON.stringify({ site: 'hub' }), '/scan', 'POST', {})).status, 503);
  const failing = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('d1 down'); } }) }) };
  const errors = console.error; console.error = () => {};
  try { assert.equal((await post(JSON.stringify({ site: 'hub', campaign: 'poster-a' }), '/scan', 'POST', { POSTER_DB: failing })).status, 500); } finally { console.error = errors; }
  assert.equal(sql.prepare('SELECT SUM(scans) AS n FROM poster_scans').get().n, 1, 'only the valid scan was counted');
});

// ---------- every site of the engine ----------
const NOT_SHOPS = new Set(['group', 'gwh', 'posters']);
const codes = readdirSync('sites').filter(c => !NOT_SHOPS.has(c) && existsSync(`sites/${c}/site.config.js`));

function fakeD1(code, site) {
  const sql = new DatabaseSync(':memory:');
  const legacy = site.database && site.database.layout === 'legacy';
  sql.exec(readFileSync(legacy ? 'tests/fixtures/ggw-legacy-schema.sql' : `sites/${code}/migrations/0001_init.sql`, 'utf8'));
  const seed = `tests/fixtures/${code}-seed.sql`;
  if (existsSync(seed)) sql.exec(readFileSync(seed, 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const FX_FETCH = async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } });

test('every shop of the engine is checked (the 11 sites, BGW the newest)', () => {
  assert.deepEqual([...codes].sort(), ['agw', 'bgw', 'cgw', 'ggw', 'hgw', 'kgw', 'mgw', 'sgw', 'tgw', 'vgw', 'wgw']);
});

for (const code of codes) {
  test(`${code.toUpperCase()}: a poster scan of the home page is counted once, the page opens the same, and a broken counter changes nothing`, async () => {
    const site = (await import(`../../sites/${code}/site.config.js`)).default;
    const worker = createWorker(site);
    const DB = fakeD1(code, site);
    const { calls, POSTERS } = fakePosters();
    const c = ctx();
    const r = await worker.fetch(req(`https://${site.domain}/?utm_source=poster&utm_medium=qr&utm_campaign=poster-b&utm_content=${code}`), { DB, FX_FETCH, POSTERS }, c);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') || '', /text\/html/);
    await Promise.all(c.waits);
    assert.deepEqual(calls.map(x => x.body), [{ site: code, campaign: 'poster-b' }]);
    // The same page without the poster address and without the counter: same status, nothing counted.
    const plain = await worker.fetch(req(`https://${site.domain}/`), { DB, FX_FETCH, POSTERS }, ctx());
    assert.equal(plain.status, 200);
    assert.equal(calls.length, 1);
    // HEAD, a bot, the test address (CLICK_LOG off): not counted.
    await worker.fetch(req(`https://${site.domain}/?utm_source=poster&utm_campaign=poster-b`, BROWSER, 'HEAD'), { DB, FX_FETCH, POSTERS }, ctx());
    await worker.fetch(req(`https://${site.domain}/?utm_source=poster&utm_campaign=poster-b`, { ...BROWSER, 'User-Agent': 'Googlebot/2.1' }), { DB, FX_FETCH, POSTERS }, ctx());
    await worker.fetch(req(`https://${site.domain}/?utm_source=poster&utm_campaign=poster-b`), { DB, FX_FETCH, POSTERS, CLICK_LOG: 'off' }, ctx());
    assert.equal(calls.length, 1);
    // A broken counter: the page still opens.
    const broken = { fetch: async () => { throw new Error('counter down'); } };
    const c2 = ctx();
    const r2 = await worker.fetch(req(`https://${site.domain}/?utm_source=poster&utm_campaign=poster-b`), { DB, FX_FETCH, POSTERS: broken }, c2);
    assert.equal(r2.status, 200);
    await assert.doesNotReject(Promise.all(c2.waits));
    // www keeps the whole poster address in its one redirect, and is counted only after it.
    const www = await worker.fetch(req(`https://www.${site.domain}/?utm_source=poster&utm_medium=qr&utm_campaign=poster-c&utm_content=${code}`), { DB, FX_FETCH, POSTERS }, ctx());
    assert.equal(www.status, 301);
    assert.equal(www.headers.get('location'), `https://${site.domain}/?utm_source=poster&utm_medium=qr&utm_campaign=poster-c&utm_content=${code}`);
    assert.equal(calls.length, 1);
  });

  test(`${code.toUpperCase()}: the Worker template binds POSTERS to the private counter, no IDs`, () => {
    const cfg = parseJsonc(readFileSync(`sites/${code}/wrangler.jsonc.example`, 'utf8'));
    assert.deepEqual(cfg.services.filter(s => s.binding === 'POSTERS'), [{ binding: 'POSTERS', service: 'gear-world-posters' }]);
  });
}

// ---------- the Hub ----------
test('Hub: poster-scan.js is a byte-for-byte copy of src/lib/poster-scan.js', () => {
  assert.equal(readFileSync('sites/gwh/poster-scan.js', 'utf8'), readFileSync('src/lib/poster-scan.js', 'utf8'));
});

test('Hub: a poster scan of gearworldhub.com is counted once; the page comes from ASSETS as before; not on the test address', async () => {
  const hub = (await import('../../sites/gwh/worker.js')).default;
  const { calls, POSTERS } = fakePosters();
  const ASSETS = { fetch: async () => new Response('<!doctype html><title>Hub</title>', { headers: { 'Content-Type': 'text/html' } }) };
  const c = ctx();
  const r = await hub.fetch(req('https://gearworldhub.com/?utm_source=poster&utm_medium=qr&utm_campaign=poster10&utm_content=hub'), { ASSETS, POSTERS }, c);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), '<!doctype html><title>Hub</title>');
  await Promise.all(c.waits);
  assert.deepEqual(calls.map(x => x.body), [{ site: 'hub', campaign: 'poster10' }]);
  await hub.fetch(req('https://gearworldhub.com/?utm_source=poster&utm_campaign=poster10'), { ASSETS, POSTERS, GWH_PREVIEW: '1' }, ctx());
  await hub.fetch(req('https://gearworldhub.com/?utm_source=poster&utm_campaign=poster10', { ...BROWSER, 'User-Agent': 'facebookexternalhit/1.1' }), { ASSETS, POSTERS }, ctx());
  const www = await hub.fetch(req('https://www.gearworldhub.com/?utm_source=poster&utm_campaign=poster10'), { ASSETS, POSTERS }, ctx());
  assert.equal(www.status, 301);
  assert.match(www.headers.get('location'), /^https:\/\/gearworldhub\.com\/\?utm_source=poster&utm_campaign=poster10$/);
  assert.equal(calls.length, 1);
  const broken = { fetch: async () => { throw new Error('down'); } };
  const c2 = ctx();
  assert.equal((await hub.fetch(req('https://gearworldhub.com/?utm_source=poster&utm_campaign=poster10'), { ASSETS, POSTERS: broken }, c2)).status, 200);
  await assert.doesNotReject(Promise.all(c2.waits));
});

test('Hub template and the counter template: POSTERS binding, the counter has no public address, no IDs', () => {
  const toml = readFileSync('sites/gwh/wrangler.toml.example', 'utf8');
  assert.match(toml, /\[\[services\]\]\r?\nbinding = "POSTERS"\r?\nservice = "gear-world-posters"/);
  const cfg = parseJsonc(readFileSync('sites/posters/wrangler.jsonc.example', 'utf8'));
  assert.equal(cfg.name, 'gear-world-posters');
  assert.equal(cfg.workers_dev, false);
  assert.equal(cfg.preview_urls, false);
  assert.equal(cfg.routes, undefined);
  assert.equal(cfg.d1_databases[0].database_id, 'REPLACE_WITH_DATABASE_ID');
  assert.equal(cfg.d1_databases[0].migrations_dir, 'migrations');
});

// ---------- tools/poster-config.mjs (the configs that stay on the PC) ----------
test('poster-config: POSTERS goes into a live wrangler.jsonc once, everything else stays', () => {
  const live = [
    '// Technology Gear World - Wrangler config',
    '{',
    '  "name": "technology-gear-world",',
    '  "main": "worker.js",',
    '  "d1_databases": [{ "binding": "DB", "database_name": "technology-gear-world", "database_id": "abcd" }],',
    '  // Search: https://example.com/ is not a comment start inside a string',
    '  "vars": { "NOTE": "a // b /* c */" },',
    '  "ai": { "binding": "AI" },',
    '  "observability": { "enabled": true },',
    '  "routes": [',
    '    { "pattern": "technologygearworld.com", "custom_domain": true },',
    '  ]',
    '}'
  ].join('\r\n');
  const r = addPostersJsonc(live);
  assert.equal(r.changed, true);
  assert.ok(r.text.includes('\r\n  "services": [{ "binding": "POSTERS", "service": "gear-world-posters" }],\r\n  "observability"'), 'same line ends, before observability');
  const cfg = parseJsonc(r.text);
  assert.equal(cfg.vars.NOTE, 'a // b /* c */');
  assert.equal(cfg.routes[0].pattern, 'technologygearworld.com');
  assert.equal(addPostersJsonc(r.text).changed, false, 'twice = once');
  // A config that already has services keeps them.
  const withHub = addPostersJsonc('{ "name": "kids-gear-world", "services": [{ "binding": "GW_HUB", "service": "gear-world-hub" }] }');
  assert.deepEqual(parseJsonc(withHub.text).services.map(s => s.binding).sort(), ['GW_HUB', 'POSTERS']);
  assert.deepEqual(parseJsonc(addPostersJsonc('{ "name": "x", "services": [] }').text).services, [{ binding: 'POSTERS', service: 'gear-world-posters' }]);
  assert.throws(() => addPostersJsonc('{ "name": "x", "services": [{ "binding": "POSTERS", "service": "elsewhere" }] }'), /somewhere else/);
  assert.throws(() => addPostersJsonc('not json'));
});

test('poster-config: POSTERS goes at the end of the Hub wrangler.toml once', () => {
  const toml = 'name = "gear-world-hub"\r\nmain = "worker.js"\r\n\r\n[[d1_databases]]\r\nbinding = "gear_world_registry"\r\n';
  const r = addPostersToml(toml);
  assert.equal(r.changed, true);
  assert.ok(r.text.startsWith('name = "gear-world-hub"\r\nmain = "worker.js"\r\n\r\n[[d1_databases]]\r\nbinding = "gear_world_registry"\r\n'));
  assert.ok(r.text.endsWith('[[services]]\r\nbinding = "POSTERS"\r\nservice = "gear-world-posters"\r\n'));
  assert.equal(addPostersToml(r.text).changed, false);
  assert.throws(() => addPostersToml('no name here'));
});
