// Lessons L218 (owner, 22 Nov 2026: "we got the app, put it on the page so people can download it" — "on the home page,
// at the top, on every site"): the official "Get it on Google Play" badge of the Gear World app, under the hero buttons of
// the home page of the 13 sites. Only for visitors from a country where the app is published (GB, GR, CY, PL, US), never on an
// iPhone or iPad, never in a cached copy, in the visitor's language (Google's own badge files), with a close button.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createWorker, withAppBar } from '../../src/engine.js';
import { appBarHtml } from '../../src/pages/layout.js';
import { APP_PLAY_URL, APP_COUNTRIES, APP_BADGE_LANGS, APP_BADGE_FILES, APP_BAR_TEXT, APP_BADGE_LABEL, appBarWanted, appPlayUrl } from '../../src/lib/app.js';
import { translatableTexts } from './i18n-keys.mjs';

const read = f => readFileSync(f, 'utf8');
const SITES = readdirSync('sites').filter(n => existsSync(`sites/${n}/site.config.js`) && existsSync(`sites/${n}/public/assets/site.js`));
const config = {};
for (const s of SITES) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

test('L218: the app is offered only where Google Play has it (GB, GR, CY, PL, US), never on an iPhone or iPad', () => {
  assert.deepEqual(APP_COUNTRIES, ['GB', 'GR', 'CY', 'PL', 'US']);
  for (const cc of ['GB', 'GR', 'CY', 'PL', 'US', 'gb', 'gr', 'cy', 'pl', 'us']) {
    assert.equal(appBarWanted(cc, ANDROID), true, cc);
    assert.equal(appBarWanted(cc, DESKTOP), true, `${cc} desktop`);
  }
  for (const cc of ['DE', 'FR', 'IE', 'NL', 'BE', 'CA', 'XX', 'T1', '', null, undefined]) assert.equal(appBarWanted(cc, ANDROID), false, String(cc));
  for (const ua of [IPHONE, IPAD, 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)']) assert.equal(appBarWanted('GB', ua), false, ua);
  assert.equal(appBarWanted('GB', ''), true, 'no user agent: the badge (the site script still hides it on an iPad)');
});

test('L218: the badge links to the app\'s page on Google Play, with the site in utm_source', () => {
  assert.equal(APP_PLAY_URL, 'https://play.google.com/store/apps/details?id=com.gearworldhub.app');
  assert.equal(appPlayUrl('TGW'), 'https://play.google.com/store/apps/details?id=com.gearworldhub.app&utm_source=gearworld-tgw&utm_medium=site&utm_campaign=app_bar');
  assert.equal(appPlayUrl('cgw'), 'https://play.google.com/store/apps/details?id=com.gearworldhub.app&utm_source=gearworld-cgw&utm_medium=site&utm_campaign=app_bar');
  assert.equal(appPlayUrl('a"b<c'), 'https://play.google.com/store/apps/details?id=com.gearworldhub.app&utm_source=gearworld-abc&utm_medium=site&utm_campaign=app_bar', 'only letters and digits from the code');
});

test('L218: the row: Google\'s badge in English (the site script swaps the language), the close button for the script, no inline style or script', () => {
  for (const s of SITES) {
    const site = config[s];
    const row = appBarHtml(site);
    const v = encodeURIComponent(site.assetVersion);
    assert.match(row, /^<div class="app-bar" data-app-bar>/, s);
    assert.ok(row.includes(`<a class="app-badge" href="${appPlayUrl(site.code).replace(/&/g, '&amp;')}" target="_blank" rel="noopener" aria-label="Get it on Google Play">`), `${s}: the link`);
    assert.ok(row.includes(`<img src="/assets/app/google-play-en.png?v=${v}" data-app-badge data-langs="el de it es fr nl pl pt ro ru" alt="" width="646" height="250" decoding="async">`), `${s}: the English badge, versioned (L31)`);
    assert.ok(row.includes('<span class="app-name" translate="no">Gear World app</span> <span class="app-words">Search every Gear World from your phone.</span>'), `${s}: the words`);
    assert.ok(row.includes('<button type="button" class="app-close" data-app-close aria-label="Close" hidden>'), `${s}: the close button waits for the script`);
    assert.ok(!/style=|<script|on[a-z]+="/i.test(row), `${s}: CSP: no inline style, script or handler`);
    assert.ok(!/\bshop|\bcart\b|\bsale\b|\bdeals?\b|\bofficial\b|\bpartner|lowest price|% off|\bsave\b/i.test(row), `${s}: no L107 word`);
    // Every text of the row is in every dictionary (L24), and the site script can find it.
    const keys = [...translatableTexts(`<body>${row}</body>`)].sort();
    assert.deepEqual(keys, ['Close', 'Get it on Google Play', 'Search every Gear World from your phone.'], s);
    for (const f of readdirSync(`sites/${s}/public/assets/i18n`)) {
      const dict = JSON.parse(read(`sites/${s}/public/assets/i18n/${f}`));
      for (const k of keys) {
        // Albanian shows Google's English badge, so its label is the badge's own English words (label in name, WCAG 2.5.3).
        if (f === 'sq-AL.json' && k === 'Get it on Google Play') { assert.equal(dict[k], k, `${s}/${f}: the English badge's words`); continue; }
        assert.ok(dict[k] && dict[k] !== k, `${s}/${f}: ${k}`);
        if (k !== 'Close') assert.match(dict[k], /Google Play|Gear World/, `${s}/${f}: ${k} keeps the name`);
      }
    }
  }
  assert.equal(APP_BAR_TEXT, 'Search every Gear World from your phone.');
  assert.equal(APP_BADGE_LABEL, 'Get it on Google Play');
});

test('L218: Google\'s own badge files, the same on every site, allowed in public/, and the master copy in TGW', () => {
  assert.deepEqual(APP_BADGE_FILES, ['en', ...APP_BADGE_LANGS]);
  assert.ok(!APP_BADGE_LANGS.includes('sq'), 'Albanian keeps English: Google\'s Albanian file has the old logo');
  for (const s of SITES) {
    const dir = `sites/${s}/public/assets/app`;
    assert.deepEqual(readdirSync(dir).sort(), APP_BADGE_FILES.map(l => `google-play-${l}.png`).sort(), s);
    for (const l of APP_BADGE_FILES) {
      const f = `${dir}/google-play-${l}.png`;
      const b = readFileSync(f);
      assert.equal(b.subarray(1, 4).toString(), 'PNG', f);
      assert.equal(b.readUInt32BE(16), 646, `${f}: width`);
      assert.equal(b.readUInt32BE(20), 250, `${f}: height`);
      assert.equal(sha(f), sha(`sites/tgw/public/assets/app/google-play-${l}.png`), `${f}: the same file as TGW (tools/theme-site.mjs)`);
    }
    assert.match(read(`sites/${s}/public-allowlist.txt`), /^assets\/app\/google-play-\*\.png$/m, `${s}: allowlist (L04)`);
  }
  // The English file is the one Google serves for "en" (its own palette PNG, 4,904 bytes).
  assert.equal(readFileSync('sites/tgw/public/assets/app/google-play-en.png').length, 4904);
});

test('L218: the row goes right after the hero buttons, once, and the answer is the visitor\'s only', async () => {
  const site = config.tgw;
  const home = '<!doctype html><html><body><header class="masthead"></header><main><section class="hero"><div class="hero-inner"><p class="hero-actions">\n  <a class="btn btn-gold" href="#cats-h">Browse by category</a>\n</p><p class="hero-facts">x</p></div></section></main></body></html>';
  const page = cc => new Response(home, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cc } });
  const row = appBarHtml(site);
  const res = await withAppBar(page('public, max-age=300'), row);
  const text = await res.text();
  assert.equal(text.split('data-app-bar').length, 2, 'once');
  assert.ok(text.includes(`Browse by category</a>\n</p>${row}<p class="hero-facts">`), 'after the buttons, before the facts');
  assert.equal(res.headers.get('Cache-Control'), 'private, max-age=60');
  assert.equal((await withAppBar(page('no-store'), row)).headers.get('Cache-Control'), 'no-store', 'no-store stays');
  const plain = new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
  assert.equal(await withAppBar(plain, row), plain, 'only HTML');
  const noButtons = await (await withAppBar(new Response('<html><body><main>x</main></body></html>', { headers: { 'Content-Type': 'text/html' } }), row)).text();
  assert.ok(!noButtons.includes('data-app-bar'), 'a page without hero buttons: nothing');
});

function memD1(schema) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(schema);
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: 0 } })
  });
  return { prepare: t => stmt(t), batch: async list => Promise.all(list.map(s => s.all())) };
}

test('L218: the Worker adds the row to the home page for GB, GR, CY, PL, US (and Google), not elsewhere, not on an iPhone, never in the cached copy', async () => {
  const schema = readdirSync('sites/agw/migrations').sort().map(f => read(`sites/agw/migrations/${f}`)).join('\n');
  const DB = memD1(schema + '\n' + read('tests/fixtures/agw-seed.sql'));
  const env = { DB, CLICK_LOG: 'off', FX_FETCH: async () => { throw new Error('offline'); } };
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  const worker = createWorker(config.agw);
  const get = async (path, country, ua = ANDROID, headers = {}) => {
    const req = new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': ua, ...headers } });
    if (country) Object.defineProperty(req, 'cf', { value: { country } });
    const res = await worker.fetch(req, env, { waitUntil: p => p });
    return { res, text: await res.text() };
  };
  const has = t => t.includes('data-app-bar');
  try {
    for (const cc of ['GB', 'GR', 'CY', 'PL', 'US']) {
      const r = await get('/', cc);
      assert.equal(r.res.status, 200, cc);
      assert.ok(has(r.text), `${cc}: the row`);
      assert.equal(r.text.split('data-app-bar').length, 2, `${cc}: once`);
      assert.ok(/<p class="hero-actions">[\s\S]*?<\/p><div class="app-bar" data-app-bar>/.test(r.text), `${cc}: right after the hero buttons`);
      assert.ok(r.text.includes('utm_source=gearworld-agw'), `${cc}: the site in utm_source`);
      assert.equal(r.res.headers.get('Cache-Control').split(',')[0], 'private', `${cc}: the visitor's only`);
      assert.ok(has((await get('/?lang=el-GR', cc)).text), `${cc}: with ?lang= too`);
    }
    for (const cc of ['DE', 'FR', 'IE', 'NL', '']) assert.ok(!has((await get('/', cc)).text), `${cc || 'unknown'}: no row`);
    for (const ua of [IPHONE, IPAD]) assert.ok(!has((await get('/', 'GB', ua)).text), 'no row on an iPhone or iPad');
    assert.ok(has((await get('/', 'GB', DESKTOP)).text), 'a computer in the UK: the row');
    assert.ok(has((await get('/', 'DE', GOOGLEBOT)).text), 'Google\'s crawler counts as the UK (L107)');
    assert.ok(has((await get('/', 'DE', 'GearWorldQA-bot/1.0 (+read-only check)', { 'X-GW-QA-Country': 'GR' })).text), 'the network\'s checks as Greece (L158)');
    for (const path of ['/search?q=car', '/about/', '/category/no-such-category/']) assert.ok(!has((await get(path, 'GB')).text), `${path}: only the home page`);
    assert.ok(store.size > 0, 'pages were cached');
    for (const res of store.values()) assert.ok(!has(await res.clone().text()), 'the cached copies: never');
  } finally {
    globalThis.caches = before;
  }
});

// The site script part, run alone: the badge in the visitor's language, the close remembered, nothing on an iPad that
// says "Macintosh".
function appScript({ lang = 'en-GB', stored = {}, ua = ANDROID, touch = 5, withBar = true } = {}) {
  const js = read('sites/tgw/public/assets/site.js');
  const start = js.indexOf('  function setupAppBar() {');
  const end = js.indexOf('\n  }\n', start) + 4;
  const part = js.slice(start, end);
  assert.ok(start > 0 && part.length < 2000, 'found in site.js');
  const removed = [];
  const listeners = {};
  const img = { src: '/assets/app/google-play-en.png?v=1', getAttribute: n => (n === 'src' ? img.src : n === 'data-langs' ? APP_BADGE_LANGS.join(' ') : null) };
  const close = { hidden: true, addEventListener: (type, fn) => { listeners[type] = fn; } };
  const bar = { parentNode: { removeChild: b => removed.push(b) }, querySelector: q => (q === '[data-app-badge]' ? img : q === '[data-app-close]' ? close : null) };
  const store = new Map(Object.entries(stored));
  const ctx = {
    wantedLanguage: () => lang,
    navigator: { userAgent: ua, maxTouchPoints: touch },
    document: { querySelector: q => (q === '[data-app-bar]' && withBar ? bar : null) },
    read: (k, fallback) => (store.has(k) ? store.get(k) : fallback),
    write: (k, v) => store.set(k, v)
  };
  vm.runInNewContext(`${part}\nsetupAppBar();`, ctx);
  return { img, close, removed, store, click: () => listeners.click && listeners.click() };
}

test('L218: the site script: the badge in the visitor\'s language, the close button remembered, no badge on an iPad', () => {
  assert.equal(appScript({ lang: 'el-GR' }).img.src, '/assets/app/google-play-el.png?v=1');
  assert.equal(appScript({ lang: 'pt-PT' }).img.src, '/assets/app/google-play-pt.png?v=1');
  assert.equal(appScript({ lang: 'pl-PL' }).img.src, '/assets/app/google-play-pl.png?v=1');
  assert.equal(appScript({ lang: 'sq-AL' }).img.src, '/assets/app/google-play-en.png?v=1', 'Albanian: English');
  assert.equal(appScript({ lang: 'en-GB' }).img.src, '/assets/app/google-play-en.png?v=1');
  const shown = appScript();
  assert.equal(shown.close.hidden, false, 'the close button shows with the script');
  assert.equal(shown.removed.length, 0);
  shown.click();
  assert.equal(shown.removed.length, 1, 'closed');
  assert.equal(shown.store.get('app-bar'), 'closed', 'remembered');
  assert.equal(appScript({ stored: { 'app-bar': 'closed' } }).removed.length, 1, 'closed before: gone');
  const ipad = appScript({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15', touch: 5 });
  assert.equal(ipad.removed.length, 1, 'an iPad that asks for desktop pages: gone');
  assert.equal(appScript({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touch: 0 }).removed.length, 0, 'a Mac: shown');
  assert.doesNotThrow(() => appScript({ withBar: false }), 'a page without the row');
  const js = read('sites/tgw/public/assets/site.js');
  assert.match(js, /\n {2}setupAppBar\(\);\n {2}setupGallery\(\);\n\n {2}\/\/ Language first/, 'at once, before the dictionary loads: a closed row never shows (review P3)');
  assert.ok(!/loadLanguage\(\)\.then\(function \(\) \{[^}]*setupAppBar/.test(js), 'not again after the language');
  for (const s of SITES) assert.equal(read(`sites/${s}/public/assets/site.js`), js, `${s}: the same site.js`);
});

test('L218: the stylesheet of every site has the row, after the hero buttons on a phone (L30)', () => {
  for (const s of SITES) {
    const css = read(`sites/${s}/public/assets/site.css`);
    assert.match(css, /\.app-bar \{ display: flex;/, s);
    assert.match(css, /\.app-close \{[^}]*width: 44px; height: 44px;/, `${s}: a 44 px close button`);
    assert.match(css, /\.app-close\[hidden\] \{ display: none; \}/, s);
    const phone = css.slice(css.indexOf('@media (max-width: 699px)'));
    assert.match(phone, /\.hero-actions \{ order: 2;[\s\S]*?\.app-bar \{ order: 2; gap: 10px 12px;/, `${s}: on a phone, right after the buttons, with Google's clear space (a quarter of the badge)`);
  }
});

test('L218: the cookies page of every site names the browser storage of a closed app row, in every dictionary', async () => {
  const { infoPage } = await import('../../src/pages/info.js');
  const K = "If you close the Gear World app row on the home page, your browser's local storage remembers it, so the row does not come back. This is not a cookie and is not sent to us.";
  assert.match(read('src/pages/info.js'), /const UPDATED = '25 November 2026';\nconst UPDATED_ISO = '2026-11-25';/, 'a new date on the legal pages');
  for (const s of SITES) {
    const html = infoPage(config[s], '/cookies/');
    assert.ok(String(html).includes(`<p>${K.replace(/'/g, '&#39;')}</p>`) || String(html).includes(`<p>${K}</p>`), `${s}: the line`);
    for (const f of readdirSync(`sites/${s}/public/assets/i18n`)) {
      const dict = JSON.parse(read(`sites/${s}/public/assets/i18n/${f}`));
      assert.ok(dict[K] && dict[K] !== K && dict[K].includes('Gear World'), `${s}/${f}`);
    }
  }
  const tool = read('tools/layout-check.mjs');
  assert.match(tool, /appBarHtml\(\{ code, assetVersion: v \}\)/, 'tools/layout-check.mjs measures the first screen with the app row too');
  assert.ok(tool.includes("check(fold.app, `${label}: the app row is on the page, right after the hero buttons (L218)`);"), 'and checks that the row is really there');
});
