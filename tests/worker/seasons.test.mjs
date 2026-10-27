// Seasonal banners on the deals pages of the 10 sites (owner, 27/10/2026): the same yearly calendar as the Hub, the
// files from the Hub (one copy for all), the text translated by the site script, the video only after the page has
// loaded and only when the visitor can afford it, Pause, and the countdown of Black Friday.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { seasonFor, seasonsOf, blackFridayDay, countdownLeft, seasonMedia, SEASON_MEDIA_VERSION } from '../../src/lib/seasons.js';
import { seasonBanner } from '../../src/pages/season.js';
import { offersIndexPage } from '../../src/pages/offers.js';
import { dealsPage } from '../../src/pages/listing.js';
import { toString } from '../../src/lib/html.js';
import { SECURITY_HEADERS } from '../../src/lib/http.js';
import tgw from '../../sites/tgw/site.config.js';

const at = day => Date.parse(`${day}T12:00:00Z`);
const SITES = readdirSync(new URL('../../sites/', import.meta.url)).filter(n => existsSync(new URL(`../../sites/${n}/public/assets/site.js`, import.meta.url)));
const KEYS = ['Seasonal offers', 'Halloween', 'Black Friday', 'Christmas', 'Until {0}', 'Halloween offers', 'Black Friday offers', 'Christmas offers',
  'Ends in {0} d {1} h {2} min', 'Ends in {0} h {1} min', 'See the deals', 'Pause', 'Play'];

function hub() {
  const window = { addEventListener() {}, dispatchEvent() {} };
  vm.runInNewContext(readFileSync(new URL('../../sites/gwh/public/hub-v2.js', import.meta.url), 'utf8'),
    { window, document: { readyState: 'loading', addEventListener() {} }, URLSearchParams, Intl });
  return window.GearWorldHubV2;
}

test('seasons: the owner\'s dates, every year by itself, the same calendar as the Hub', () => {
  const id = day => (seasonFor(at(day)) || {}).id || '';
  assert.deepEqual(['2026-10-19', '2026-10-20', '2026-10-31', '2026-11-01', '2026-11-19', '2026-11-20', '2026-12-01', '2026-12-02', '2026-12-24', '2026-12-25'].map(id),
    ['', 'halloween', 'halloween', '', '', 'black-friday', 'black-friday', 'christmas', 'christmas', '']);
  assert.deepEqual([2026, 2027, 2028].map(blackFridayDay), [27, 26, 24]);
  const h = hub();
  for (const year of [2026, 2027, 2028, 2029, 2030]) {
    const mine = seasonsOf(year).map(s => [s.id, s.start, s.end, s.countdownTo || '', s.file, !!s.mirror]);
    const theirs = JSON.parse(JSON.stringify(h.seasonsOf(year).map(s => [s.id, s.start, s.end, s.countdownTo || '', s.file, !!s.mirror])));
    assert.deepEqual(mine, theirs, `${year}: the sites and the Hub show the same season`);
  }
  assert.equal(SEASON_MEDIA_VERSION, h.seasonMediaVersion, 'the same files (?v=) as the Hub');
  const bf = seasonsOf(2026)[1];
  assert.deepEqual(countdownLeft(bf, Date.parse('2026-11-28T10:30:00Z')), { d: 2, h: 13, m: 29 });
  assert.equal(countdownLeft(bf, Date.parse('2026-12-01T00:00:00Z')), null);
});

test('seasons: the files come from the Hub (one copy for all 11), and the sites allow it (CSP media-src)', () => {
  for (const s of seasonsOf(2026)) {
    for (const ext of ['mp4', 'jpg']) {
      const url = seasonMedia(s, ext);
      assert.equal(url, `https://gearworldhub.com/seasonal/${s.file}.${ext}?v=${SEASON_MEDIA_VERSION}`);
      assert.ok(existsSync(new URL(`../../sites/gwh/public/seasonal/${s.file}.${ext}`, import.meta.url)), `${s.file}.${ext} is in the Hub`);
    }
  }
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  assert.match(csp, /(^|; )media-src 'self' https:\/\/gearworldhub\.com(;|$)/);
  assert.match(csp, /img-src 'self' data: https:/, 'the still picture from the Hub is allowed');
  assert.match(csp, /default-src 'self'/, 'nothing else from outside');
});

test('seasons: the banner on the codes page and the price drops (first page), with its text in tr() and the button to the list', () => {
  const site = { ...tgw, promos: [] };
  const b = toString(seasonBanner(site, 'offers-list', at('2026-10-28')));
  assert.match(b, /^<section class="season-banner season-halloween season-mirror" aria-label="Seasonal offers"/);
  assert.ok(b.includes('data-season-video="https://gearworldhub.com/seasonal/halloween.mp4?v='));
  assert.ok(b.includes('<img class="season-media" src="https://gearworldhub.com/seasonal/halloween.jpg?v='));
  assert.ok(b.includes('<span data-i18n="Halloween">Halloween</span> · <span data-i18n="Until {0}" data-i18n-0="31 Oct 2026" data-i18n-0-date="2026-10-31">Until 31 Oct 2026</span>'));
  assert.ok(b.includes('<a class="btn btn-gold" href="#offers-list"><span data-i18n="See the deals">See the deals</span></a>'));
  assert.ok(b.includes('data-season-pause hidden'), 'Pause appears only with the video');
  assert.ok(!b.includes('<video'), 'the server writes no video: the script adds it after the page has loaded');
  assert.ok(!b.includes('data-season-count'), 'no countdown for Halloween');
  const bf = toString(seasonBanner(site, 'deals-list', Date.parse('2026-11-28T10:30:00Z')));
  assert.ok(bf.includes('data-season-countdown="2026-11-30T23:59:00Z"'));
  assert.ok(bf.includes('<p class="season-count" data-season-count><span data-i18n="Ends in {0} d {1} h {2} min" data-i18n-0="2" data-i18n-1="13" data-i18n-2="29">Ends in 2 d 13 h 29 min</span></p>'));
  assert.equal(toString(seasonBanner(site, 'x', at('2026-11-10'))), '', 'no banner outside the seasons');

  const offersHtml = String(offersIndexPage(site, at('2026-12-10')));
  assert.ok(offersHtml.indexOf('season-christmas') > 0 && offersHtml.indexOf('season-christmas') < offersHtml.indexOf('id="offers-list"'), 'codes page: the banner, then the list');
  const deals = (page, day) => String(dealsPage(site, { page }, { products: [], total: 0, pages: 1, page }, at(day)));
  assert.ok(deals(1, '2026-10-28').includes('season-halloween') && deals(1, '2026-10-28').includes('id="deals-list"'));
  assert.ok(!deals(2, '2026-10-28').includes('season-banner'), 'only on the first page of the price drops');
  assert.ok(!deals(1, '2026-11-10').includes('season-banner'));
});

test('seasons: every dictionary of every site has the banner texts, with the same {placeholders}', () => {
  const ph = s => (String(s).match(/\{\d+\}/g) || []).sort().join(',');
  for (const code of SITES) {
    const dir = new URL(`../../sites/${code}/public/assets/i18n/`, import.meta.url);
    for (const f of readdirSync(dir)) {
      const d = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
      for (const k of KEYS) {
        assert.ok(typeof d[k] === 'string' && d[k].trim(), `${code} ${f}: "${k}"`);
        assert.equal(ph(d[k]), ph(k), `${code} ${f}: "${k}" keeps its placeholders`);
      }
    }
  }
});

test('seasons: the site script adds the video only after load, never with reduce motion / Save-Data / slow, with Pause', () => {
  const js = readFileSync(new URL('../../sites/tgw/public/assets/site.js', import.meta.url), 'utf8');
  const part = js.slice(js.indexOf('function setupSeason'), js.indexOf('// Language first'));
  for (const s of ["prefers-reduced-motion: reduce", 'saveData', 'slow-2g|2g|3g', "setAttribute('muted'", "setAttribute('loop'", "setAttribute('playsinline'",
    "setAttribute('autoplay'", "setAttribute('preload', 'none')", "setAttribute('poster'", "window.addEventListener('load', start)", "write('season-paused'", 'IntersectionObserver']) {
    assert.ok(js.includes(s), `site.js: ${s}`);
  }
  assert.ok(!/setInterval\(/.test(part), 'the countdown waits for the next minute, nothing ticks every second');
  assert.match(js, /setupCopy\(\);\s*setupSeason\(\);/);
  for (const code of SITES) {
    assert.equal(readFileSync(new URL(`../../sites/${code}/public/assets/site.js`, import.meta.url), 'utf8'), js, `${code} has the same site.js (tools/theme-site.mjs)`);
  }
  const css = readFileSync(new URL('../../sites/tgw/public/assets/site.css', import.meta.url), 'utf8');
  assert.match(css, /\.season-pause \{[^}]*min-width: 44px; min-height: 44px;/);
  assert.match(css, /\.season-shade \{[^}]*linear-gradient\(90deg/);
});
