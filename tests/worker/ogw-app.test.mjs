// Lessons L218 on Mega Stores Gear World (owner, 22 Nov 2026: the app's badge "on the Group and Mega Stores too"): the
// official "Get it on Google Play" badge after the hero buttons of the home page, in the page's language, only for a visitor
// from a country where the app is published (GB, GR, CY, PL, US), never on an iPhone or iPad, no script and nothing
// stored. Fake fetch, a fixed day, never the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import site from '../../sites/ogw/site.config.js';
import { createGuidesWorker, makeContext, homePage, appRow } from '../../src/marketplace-guides.js';
import { toString } from '../../src/lib/html.js';
import { APP_PLAY_URL, APP_COUNTRIES, APP_BADGE_FILES, APP_BAR_TEXT, APP_BADGE_LABEL } from '../../src/lib/app.js';

const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-23T18:00:00Z');
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const GOOGLE = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const QA = 'GearWorldQA-bot/1.0 (+read-only check)';
const read = f => readFileSync(f, 'utf8');
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
const row = text => (text.match(/<div class="app-bar">[\s\S]*?<\/div>/) || [''])[0];

const noFetch = async () => new Response(JSON.stringify({ ok: true, products: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
async function home(path, { cc = null, ua = DESKTOP, headers = {} } = {}) {
  const w = createGuidesWorker(site, { fetch: noFetch, cache: null, now: () => NOW });
  const req = new Request(LIVE + path, { headers: { 'user-agent': ua, ...headers } });
  if (cc) Object.defineProperty(req, 'cf', { value: { country: cc } });
  const r = await w.fetch(req, {});
  return { r, text: await r.text() };
}

test('L218 Mega Stores: the badge under the hero text for the app\'s countries, with the link and Google\'s badge', async () => {
  for (const cc of APP_COUNTRIES) {
    const { r, text } = await home('/', { cc });
    assert.equal(r.status, 200, cc);
    assert.match(r.headers.get('cache-control'), /^private/, `${cc}: never in a shared cache`);
    const a = row(text);
    assert.ok(a, `${cc}: the row`);
    const at = text.indexOf('<div class="app-bar">');
    assert.ok(text.indexOf('<nav class="hero-jump"') < at && at < text.indexOf('</div></section>'), `${cc}: after the hero buttons, still in the hero (L208: the stores first on a phone)`);
    assert.ok(a.includes(`href="${APP_PLAY_URL}&amp;utm_source=gearworld-megastores&amp;utm_medium=site&amp;utm_campaign=app_bar"`), `${cc}: the link with utm`);
    assert.ok(a.includes('target="_blank" rel="noopener"') && a.includes('width="646" height="250"') && a.includes('alt=""'), cc);
    assert.ok(!a.includes('<button') && !/<script/.test(text), `${cc}: no close button, no script`);
  }
  const uk = row((await home('/', { cc: 'GB' })).text);
  assert.ok(uk.includes(`src="/assets/app/google-play-en.png?v=${site.assetVersion}"`), 'English page: the English badge');
  assert.ok(uk.includes(`aria-label="${APP_BADGE_LABEL}"`) && uk.includes(APP_BAR_TEXT), 'the English words');
  const gr = row((await home('/', { cc: 'GR' })).text);
  assert.ok(gr.includes('/assets/app/google-play-el.png'), 'Greece: the Greek page and badge');
  assert.ok(gr.includes('aria-label="Αποκτήστε το στο Google Play"') && gr.includes('Αναζητήστε σε κάθε Gear World από το κινητό σας.'), 'Greek words');
  const pl = row((await home('/', { cc: 'PL' })).text);
  assert.ok(pl.includes('/assets/app/google-play-pl.png') && pl.includes('Pobierz z Google Play'), 'Poland: Polish');
  const sq = row((await home('/?lang=sq-AL', { cc: 'GB' })).text);
  assert.ok(sq.includes('/assets/app/google-play-en.png') && sq.includes('aria-label="Get it on Google Play"'), 'Albanian: Google\'s English badge and its words');
  assert.ok(sq.includes('Kërkoni në çdo Gear World nga telefoni juaj.'));
});

test('L218 Mega Stores: no row elsewhere, on an iPhone or iPad, or on any page but the home page', async () => {
  for (const cc of ['DE', 'FR', 'IE', 'NL', 'XX', 'T1']) assert.ok(!row((await home('/', { cc })).text), `no row from ${cc}`);
  for (const ua of [IPHONE, IPAD]) assert.ok(!row((await home('/', { cc: 'GB', ua })).text), 'no row on an iPhone or iPad');
  assert.ok(row((await home('/', { cc: 'US', ua: ANDROID })).text), 'Android in the US');
  assert.ok(row((await home('/', { cc: 'DE', ua: GOOGLE })).text), 'Google reads the UK page, with the row (as on the sites)');
  assert.ok(row((await home('/', { cc: 'GB', ua: QA, headers: { 'X-GW-QA-Country': 'PL' } })).text), 'the QA check as Poland');
  assert.ok(!row((await home('/', { cc: 'GB', ua: QA, headers: { 'X-GW-QA-Country': 'DE' } })).text), 'the QA check as Germany');
  for (const p of ['/guides/christmas-gift-ideas-for-him/', '/privacy/', '/cookies/']) assert.ok(!row((await home(p, { cc: 'GB' })).text), p);
  const c = makeContext(site, 'en-GB', false, 'off', '/', 'GB');
  assert.ok(!row(homePage(c, new Date(NOW), {})), 'homePage alone (no c.app): no row');
  c.app = true;
  assert.equal(row(homePage(c, new Date(NOW), {})), row(toString(appRow(c))), 'c.app: the row');
});

test('L218 Mega Stores: Google\'s own files, the allowlist, the CSS and a new asset version', () => {
  const allow = read('sites/ogw/public-allowlist.txt').split('\n');
  for (const f of APP_BADGE_FILES) {
    const file = `sites/ogw/public/assets/app/google-play-${f}.png`;
    // The Hub keeps the same Google files (no Polish: the Hub has no Polish page); every file is Google's 646x250 PNG.
    if (existsSync(`sites/gwh/public/play/google-play-${f}.png`)) assert.equal(sha(file), sha(`sites/gwh/public/play/google-play-${f}.png`), `${f}: the Hub's file`);
    const png = readFileSync(file);
    assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG', f);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [646, 250], `${f}: 646x250`);
    assert.ok(allow.includes(`assets/app/google-play-${f}.png`), `${f} in the allowlist`);
  }
  assert.equal(site.assetVersion, '2026-11-25-ogw-14', 'a new asset version (L31: -8 for the CSS of the row; -9 for the Linkwise stores back and /gr/, L214/L215; -10 for the showcase CSS and logos, L221; -11 for the logos of the direct stores, L226; -12 for the price CSS, L227; -13 for the catalogue, L228; -14 for the category photo cards, L231)');
  const css = read('sites/ogw/public/assets/ogw.css');
  assert.match(css, /\.app-bar \{ display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin: 18px 0 0; \}/, 'clear space of a quarter of the badge height');
  assert.match(css, /\.app-badge img \{ display: block; height: 60px; width: auto; \}/);
  assert.match(css, /\.hero-grid > \.app-bar \{ grid-column: 1 \/ -1; margin: 0; \}/, 'under both columns on a computer (the grid gap is its clear space)');
  assert.match(css, /@supports \(-webkit-touch-callout: none\) \{ \.app-bar \{ display: none; \} \}/, 'hidden on an iPad that asks for desktop pages');
  const tool = read('tools/ogw-site.ps1');
  assert.ok(tool.includes("$appGbPage = Get-Page ($base + '/') 'GB'") && tool.includes("$appDePage = Get-Page ($base + '/') 'DE'"), 'the tool checks the row from the UK and Germany');
  assert.ok(tool.includes("$appGbPage.status -eq 200 -and $appDePage.status -eq 200 -and $appGb -and -not $appDe"), 'a failed request is never ΕΝΤΑΞΕΙ');
});
