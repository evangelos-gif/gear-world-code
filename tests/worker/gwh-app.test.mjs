// Gear World Hub: the Gear World app on Google Play (owner, 22 Nov 2026: "we got the app, put it on the page so people
// can download it" — "on the home page, at the top, on every site", lessons L218). Under the search of gearworldhub.com:
// "Gear World app", one line, and Google's own "Get it on Google Play" badge to the app's page, with a close button. The
// row is in the file, hidden until hub-v2.js shows it (not on an iPhone or iPad, not after a close). The app is on Google
// Play only in the UK, Greece and Cyprus, so the Worker takes the row out for every other country; the UK page stays the
// file itself (L119), so the Hub tool's comparisons keep working.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { APP_COUNTRIES, APP_START, APP_END, withoutAppRow, withAppCountry, QA_COUNTRY_HEADER } from '../../sites/gwh/worker.js';

const PUB = 'sites/gwh/public';
const read = rel => readFileSync(`${PUB}/${rel}`, 'utf8');
const HOME = read('index.html');
const WORKER = readFileSync('sites/gwh/worker.js', 'utf8');
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const QA = 'GearWorldQA-bot/1.0 (+read-only check)';
const FILES = ['en', 'el', 'de', 'fr', 'it', 'es', 'pt', 'nl', 'ro', 'ru'];
const LINK = 'https://play.google.com/store/apps/details?id=com.gearworldhub.app&amp;utm_source=gearworld-hub&amp;utm_medium=site&amp;utm_campaign=app_bar';
const L107 = /\bshop|\bcart\b|\bsale\b|\bdeals?\b|\bofficial\b|\bpartner|lowest price|% off|\bsave\b/i;

const rowOf = html => {
  const i = html.indexOf(APP_START);
  return i < 0 ? '' : html.slice(i, html.indexOf(APP_END, i) + APP_END.length);
};

function req(path, { cc, ua = ANDROID, headers = {}, method = 'GET' } = {}) {
  const r = new Request(`https://gearworldhub.com${path}`, { method, headers: { 'User-Agent': ua, ...headers } });
  if (cc !== undefined) Object.defineProperty(r, 'cf', { value: cc === null ? {} : { country: cc } });
  return r;
}
const page = (text = HOME) => new Response(text, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=60', ETag: '"abc"' } });

test('L218: the row is under the search, in the file, hidden, with Google\'s badge to the app\'s page and a close button', () => {
  const row = rowOf(HOME);
  assert.ok(row, 'between GWH-APP-START and GWH-APP-END');
  assert.equal(HOME.split(APP_START).length, 2, 'once');
  const copy = HOME.indexOf('<div class="hero-copy">');
  assert.ok(HOME.indexOf(APP_START) > HOME.indexOf('<div class="gwh2-popular">') && HOME.indexOf(APP_START) > copy, 'after the popular searches, in the hero');
  assert.ok(HOME.indexOf(APP_START) < HOME.indexOf('<aside class="gwh2-campaigns"'), 'before the campaigns');
  assert.ok(row.includes('<div class="gwh2-app" id="gwh2App" hidden>'), 'hidden until hub-v2.js shows it');
  assert.ok(row.includes('<span class="gwh2-app-name" translate="no">Gear World app</span> <span data-gwh2="appLine">Search every Gear World from your phone.</span>'));
  assert.ok(row.includes(`<a class="gwh2-app-badge" href="${LINK}" target="_blank" rel="noopener" data-gwh2-aria="appBadge" aria-label="Get it on Google Play">`), 'the app\'s page, with the Hub in utm_source');
  assert.ok(row.includes('<img src="/play/google-play-en.png?v=20261125-app1" data-gwh2-badge alt="" width="646" height="250" decoding="async">'), 'Google\'s English badge, versioned (L31)');
  assert.ok(row.includes('<button type="button" class="gwh2-app-close" id="gwh2AppClose" data-gwh2-aria="appClose" aria-label="Close">'));
  const body = row.replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!/style=|<script|\son[a-z]+="/i.test(body), 'CSP: no inline style, script or handler');
  assert.ok(!L107.test(body.replace(/<[^>]+>/g, ' ')), 'no L107 word');
  assert.equal((body.match(/<a /g) || []).length, 1, 'one link');
  assert.ok(!/\/(out|go)\//.test(body), 'not a product link');
  assert.match(HOME, /<link rel="stylesheet" href="\/hub-v2\.css\?v=20261125-app1">/);
  assert.match(HOME, /<script src="\/hub-v2\.js\?v=20261125-app1" defer><\/script>/);
});

test('L218: Google\'s own badge files (unchanged PNGs), allowed in public/, described by the Hub tool', () => {
  assert.deepEqual(readdirSync(`${PUB}/play`).sort(), FILES.map(l => `google-play-${l}.png`).sort());
  for (const l of FILES) {
    const b = readFileSync(`${PUB}/play/google-play-${l}.png`);
    assert.equal(b.subarray(1, 4).toString(), 'PNG', l);
    assert.equal(b.readUInt32BE(16), 646, `${l}: width`);
    assert.equal(b.readUInt32BE(20), 250, `${l}: height`);
  }
  assert.equal(readFileSync(`${PUB}/play/google-play-en.png`).length, 4904, 'the file Google serves for "en"');
  const allow = readFileSync('sites/gwh/public-allowlist.txt', 'utf8').split('\n').map(s => s.trim());
  const tool = readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
  for (const l of FILES) {
    assert.ok(allow.includes(`play/google-play-${l}.png`), `allowlist: ${l} (L04)`);
    assert.ok(tool.includes(`'public/play/google-play-${l}.png' = `), `the tool's plan describes ${l}`);
  }
  assert.ok(tool.includes("$appUs = $usHtml.Contains('id=\"gwh2App\"')"), 'the tool checks the row from the UK, Greece and the US');
});

function hub() {
  const window = { addEventListener() {}, dispatchEvent() {} };
  vm.runInNewContext(read('hub-v2.js'), { window, document: { readyState: 'loading', addEventListener() {} }, URL, URLSearchParams, Intl, console });
  return window.GearWorldHubV2;
}

test('L218: the texts of the row in the 11 languages of the Hub (the badge text is Google\'s own in each language)', () => {
  const h = hub();
  for (const key of ['appLine', 'appBadge', 'appClose']) {
    const list = h.strings[key];
    assert.equal(list.length, h.locales.length, key);
    assert.ok(list.every(s => s.trim()), key);
    // Albanian shows Google's English badge, so its label is the badge's own English words (label in name, WCAG 2.5.3).
    const sq = h.locales.indexOf('sq-AL');
    if (key === 'appBadge') assert.equal(list[sq], list[0], 'sq: the English badge\'s words');
    assert.equal(new Set(list.slice(1).filter((s, i) => !(key === 'appBadge' && i + 1 === sq))).has(list[0]), false, `${key}: translated`);
    assert.ok(list.every(s => !L107.test(s)), `${key}: no L107 word`);
  }
  assert.equal(h.strings.appLine[0], 'Search every Gear World from your phone.');
  assert.ok(h.strings.appLine.every(s => s.includes('Gear World')), 'the name stays');
  assert.equal(h.strings.appBadge[0], 'Get it on Google Play');
  assert.ok(h.strings.appBadge.every(s => s.includes('Google Play')));
  assert.equal(h.strings.appBadge[h.locales.indexOf('el-GR')], 'Αποκτήστε το στο Google Play');
  assert.equal(h.strings.appClose[0], 'Close');
});

// The part of hub-v2.js that shows the row, run alone with a small page.
function appPart({ lang = 'en-GB', ua = ANDROID, touch = 5, closed = false, withRow = true } = {}) {
  const js = read('hub-v2.js');
  const start = js.indexOf('  const APP_BADGES = ');
  const end = js.indexOf('\n  function renderAll()', start);
  assert.ok(start > 0 && end > start, 'found in hub-v2.js');
  const removed = [];
  let onClose = null;
  const img = { src: '/play/google-play-en.png?v=20261125-app1', getAttribute: n => (n === 'src' ? img.src : null) };
  const row = { hidden: true, remove: () => removed.push('row') };
  const close = { addEventListener: (type, fn) => { if (type === 'click') onClose = fn; } };
  const store = new Map(closed ? [['gwh2-app-closed', '1']] : []);
  const ctx = {
    navigator: { userAgent: ua, maxTouchPoints: touch },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
    locale: () => lang,
    document: {
      getElementById: id => (id === 'gwh2App' && withRow ? row : id === 'gwh2AppClose' ? close : null),
      querySelector: q => (q === '[data-gwh2-badge]' ? img : null)
    }
  };
  vm.runInNewContext(`${js.slice(start, end)}\nthis.setupApp = setupApp; this.appBadge = appBadge;`, ctx);
  ctx.setupApp();
  ctx.appBadge();
  return { row, img, removed, store, close: () => onClose && onClose() };
}

test('L218: hub-v2.js shows the row (not on an iPhone or iPad, not after a close) and the badge in the page\'s language', () => {
  const shown = appPart();
  assert.equal(shown.row.hidden, false, 'shown');
  assert.equal(shown.img.src, '/play/google-play-en.png?v=20261125-app1');
  shown.close();
  assert.deepEqual(shown.removed, ['row'], 'closed');
  assert.equal(shown.store.get('gwh2-app-closed'), '1', 'remembered');
  assert.deepEqual(appPart({ closed: true }).removed, ['row'], 'closed before: gone');
  for (const ua of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)', 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X)']) assert.deepEqual(appPart({ ua }).removed, ['row'], ua);
  assert.deepEqual(appPart({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touch: 5 }).removed, ['row'], 'an iPad asking for desktop pages');
  assert.equal(appPart({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touch: 0 }).row.hidden, false, 'a Mac');
  assert.equal(appPart({ lang: 'el-GR' }).img.src, '/play/google-play-el.png?v=20261125-app1');
  assert.equal(appPart({ lang: 'pt-PT' }).img.src, '/play/google-play-pt.png?v=20261125-app1');
  assert.equal(appPart({ lang: 'sq-AL' }).img.src, '/play/google-play-en.png?v=20261125-app1', 'Albanian: English (Google\'s Albanian file has the old logo)');
  assert.doesNotThrow(() => appPart({ withRow: false }), 'a page without the row (another country)');
  const js = read('hub-v2.js');
  assert.match(js, /function renderAll\(\) \{\n {4}applyTexts\(\);\n {4}appBadge\(\);/, 'the badge follows a language change (renderAll)');
  assert.match(js, /setupApp\(\);\n {4}renderAll\(\);/);
});

test('L218: the Worker keeps the row for the UK, Greece and Cyprus (the UK page is the file) and takes it out elsewhere', async () => {
  assert.deepEqual(APP_COUNTRIES, ['GB', 'GR', 'CY']);
  for (const cc of ['GB', 'GR', 'CY']) {
    const p = page();
    assert.equal(await withAppCountry(req('/', { cc }), p), p, `${cc}: untouched`);
  }
  const g = page();
  assert.equal(await withAppCountry(req('/', { cc: 'US', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }), g), g, 'Google counts as the UK');
  const local = page();
  assert.equal(await withAppCountry(req('/'), local), local, 'no country at all: the UK page');
  const qaGr = page();
  assert.equal(await withAppCountry(req('/', { cc: 'US', ua: QA, headers: { [QA_COUNTRY_HEADER]: 'GR' } }), qaGr), qaGr, 'the QA check as Greece');
  for (const [cc, opts] of [['US', {}], ['DE', {}], ['PL', {}], ['IE', {}], ['XX', { cc: 'T1' }], ['QA US', { cc: 'GB', ua: QA, headers: { [QA_COUNTRY_HEADER]: 'US' } }]]) {
    const res = await withAppCountry(req('/', { cc, ...opts }), page());
    const text = await res.text();
    assert.ok(!text.includes('gwh2App') && !text.includes('GWH-APP'), `${cc}: no row`);
    assert.equal(text, withoutAppRow(HOME), cc);
    assert.equal(res.headers.get('Cache-Control'), 'private, max-age=60', cc);
    assert.equal(res.headers.get('ETag'), null, `${cc}: not the file any more`);
  }
  const index = await (await withAppCountry(req('/index.html', { cc: 'US' }), page())).text();
  assert.ok(!index.includes('gwh2App'), '/index.html too');
  // Only the row goes: the rest of the page is the file.
  const cut = withoutAppRow(HOME);
  assert.equal(cut, HOME.slice(0, HOME.lastIndexOf('\n', HOME.indexOf(APP_START)) + 1) + HOME.slice(HOME.indexOf(APP_END) + APP_END.length + 1));
  assert.ok(cut.includes('<div class="gwh2-chips" id="gwh2Popular"></div>') && cut.includes('<aside class="gwh2-campaigns"'));
  assert.equal(withoutAppRow('<p>no row</p>'), '<p>no row</p>');
  // Other pages, methods and answers: untouched.
  const about = page('<html>about</html>');
  assert.equal(await withAppCountry(req('/about/', { cc: 'US' }), about), about);
  const head = page();
  assert.equal(await withAppCountry(req('/', { cc: 'US', method: 'HEAD' }), head), head);
  const json = new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  assert.equal(await withAppCountry(req('/', { cc: 'US' }), json), json);
  const missing = new Response('no', { status: 404, headers: { 'Content-Type': 'text/html' } });
  assert.equal(await withAppCountry(req('/', { cc: 'US' }), missing), missing);
  assert.ok(WORKER.includes('await withCountryBar(request, await withAppCountry(request, await withMegaCountry(request, await hubFetch(request, env, ctx))))'), 'on every answer, after the Mega Stores bar');
});

test('L218: the cookies page names gwh2-app-closed (11 languages) and a new date; the legal script asks for the new dictionaries', () => {
  const c = read('cookies/index.html');
  assert.ok(c.includes('<tr><td data-label="Name"><span><code>gwh2-app-closed</code></span></td><td data-label="Type"><span>Browser storage, necessary</span></td><td data-label="What it does"><span>Remembers that you closed the Gear World app row on the home page</span></td><td data-label="How long"><span>Until you clear your browser data</span></td></tr>'));
  assert.match(c, /<p class="lg-updated">Last updated: 25 November 2026<\/p>/);
  for (const f of readdirSync(`${PUB}/legal/i18n`)) {
    const d = JSON.parse(read(`legal/i18n/${f}`));
    assert.ok(d['Remembers that you closed the Gear World app row on the home page'].includes('Gear World'), f);
    assert.match(d['Last updated: 25 November 2026'], /25/, f);
  }
  assert.match(read('legal/legal.js'), /var VERSION = "20261125-app1";/);
  assert.ok(read('hub-v2.js').includes('localStorage.getItem("gwh2-app-closed")'), 'the name the script uses');
});
