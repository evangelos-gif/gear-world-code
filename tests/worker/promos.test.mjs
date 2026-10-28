// Discount codes and the offer bar (lessons L32).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../../src/engine.js';
import { activePromos, barPromo, ukToday } from '../../src/lib/promos.js';
import { PROMOS, promosFor, AWIN_PUBLISHER_ID } from '../../promos/promos.js';
import tgw from '../../sites/tgw/site.config.js';

// Days counted on the UK calendar, not as 24-hour steps: on the day the clocks go back (25 Oct 2026, 23:00-24:00 UTC)
// "now minus 24 hours" is still the same UK date, and an offer that ended yesterday looked like it ends today.
const TODAY = ukToday(Date.now());
const day = offset => { const d = new Date(`${TODAY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };

// A copy of TGW with offers dated around today, so the tests do not depend on the calendar.
function siteWith(promos) {
  return { ...tgw, promos };
}
const base = { retailer: 'Joybuy', slug: 'joybuy', awinMid: 123932, currency: 'GBP', url: 'https://www.joybuy.co.uk/campaign/x', sites: ['TGW'] };
const live = { ...base, id: 'joybuy-live', kind: 'code', campaign: 'Halloween', code: 'halloween', off: 4, minSpend: 20, bar: '🎃', start: day(-1), end: day(5) };
const later = { ...base, id: 'joybuy-later', kind: 'code', campaign: 'Halloween', code: 'later', off: 5, minSpend: 30, start: day(3), end: day(9) };
const ended = { ...base, id: 'joybuy-ended', kind: 'code', campaign: 'Halloween', code: 'ended', off: 5, minSpend: 30, start: day(-9), end: day(-1) };
const sale = { ...base, id: 'joybuy-sale', kind: 'sale', campaign: 'Baby', upTo: 60, start: day(0), end: day(0) };

function fakeDb() {
  const rows = [];
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), run: async () => { rows.push({ sql, args }); return { meta: {} }; }, first: async () => null, all: async () => ({ results: [] }) });
  return { rows, prepare: sql => stmt(sql), batch: async l => Promise.all(l.map(s => s.all())) };
}
const ctx = { waitUntil: p => p };
const get = (worker, path, env, headers = {}) =>
  worker.fetch(new Request(`https://technologygearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test', ...headers } }), env, ctx);

test('only offers that run today are shown; codes first; the last day still counts', () => {
  const site = siteWith([sale, ended, later, live]);
  assert.deepEqual(activePromos(site).map(p => p.id), ['joybuy-live', 'joybuy-sale']);
  assert.equal(barPromo(site).id, 'joybuy-live');
  assert.equal(barPromo(siteWith([ended, later])), null);
  assert.deepEqual(activePromos(siteWith([{ ...live, end: '' }])), [], 'an offer without an end date is never shown');
});

test('the Joybuy data: every entry has an end date, an Awin advertiser id and a known landing page', () => {
  for (const p of PROMOS) {
    assert.match(p.end, /^\d{4}-\d{2}-\d{2}$/, p.id);
    assert.ok(p.awinMid > 0 && /^https:\/\/www\.joybuy\.co\.uk\//.test(p.url), p.id);
    assert.ok(p.source, `${p.id}: source of the offer`);
  }
  assert.equal(new Set(PROMOS.map(p => p.id)).size, PROMOS.length, 'ids are unique');
  assert.deepEqual(promosFor('TGW').filter(p => p.kind === 'code').map(p => p.code), ['halloween', 'beauty', 'sports', 'tools']);
  const joy = PROMOS.find(p => p.id === 'joybuy-joy-day');
  assert.deepEqual([joy.kind, joy.off, joy.minSpend, joy.start, joy.end, joy.sites.join(), joy.code, joy.bar], ['coupon', 15, 99, '2026-10-26', '2026-10-31', 'TGW', undefined, undefined],
    'Joy Day (Awin email of 26 Oct, approved 28 Oct): TGW only, no code, no bar, until 31 Oct');
  assert.ok(promosFor('KGW').some(p => p.campaign === 'Baby') && !promosFor('TGW').some(p => p.campaign === 'Baby'));
  assert.equal(AWIN_PUBLISHER_ID, 3057233);
});

test('bar on every page, codes page, retailer page, and the sitemap lists them', async () => {
  const worker = createWorker(siteWith([live, sale, ended]));
  const env = { DB: fakeDb() };
  const info = await (await get(worker, '/about/', env)).text();
  assert.match(info, /class="promo-bar"/);
  assert.match(info, /Joybuy: £4 off £20\+ with code halloween/);
  assert.match(info, /href="\/discount-codes\/joybuy\/"/);
  const page = await (await get(worker, '/discount-codes/joybuy/', env)).text();
  assert.match(page, /<meta name="robots" content="index,follow">/);
  assert.match(page, /<strong translate="no">halloween<\/strong>/);
  assert.match(page, /Valid until/);
  assert.match(page, /Up to 60% off/);
  assert.ok(!page.includes('ended'), 'expired code not shown');
  assert.match(page, /href="\/go\/joybuy-live" rel="sponsored nofollow/);
  assert.match(page, /data-copy="halloween"/);
  assert.ok(!/awin1\.com/.test(page), 'no direct affiliate links in the page');
  const index = await (await get(worker, '/discount-codes/', env)).text();
  assert.match(index, /Discount codes and offers/);
  const map = await (await get(worker, '/sitemap-static.xml', env)).text();
  assert.ok(map.includes('/discount-codes/joybuy/'));
  const robots = await (await get(worker, '/robots.txt', env)).text();
  assert.match(robots, /Disallow: \/go\//);
  assert.equal((await get(worker, '/discount-codes/unknown-shop/', env)).status, 404);
  assert.equal((await get(worker, '/discount-codes', env)).status, 301);
});

test('/go/<id> is an Awin deep link with our publisher id and clickref, and is recorded', async () => {
  const worker = createWorker(siteWith([live]));
  const env = { DB: fakeDb() };
  const r = await get(worker, '/go/joybuy-live', env, { referer: 'https://technologygearworld.com/discount-codes/joybuy/' });
  assert.equal(r.status, 302);
  const loc = new URL(r.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://www.awin1.com/cread.php');
  assert.equal(loc.searchParams.get('awinmid'), '123932');
  assert.equal(loc.searchParams.get('awinaffid'), '3057233');
  assert.equal(loc.searchParams.get('clickref'), 'tgw-promo-joybuy-live');
  assert.equal(loc.searchParams.get('ued'), 'https://www.joybuy.co.uk/campaign/x');
  assert.match(r.headers.get('x-robots-tag'), /noindex/);
  assert.equal(env.DB.rows.length, 1);
  assert.ok(env.DB.rows[0].args.includes('tgw-promo-joybuy-live'));
  assert.equal((await get(worker, '/go/nope', env)).status, 404);
});

test('when all offers have ended: no bar, and the codes page says so and is noindex', async () => {
  const worker = createWorker(siteWith([ended]));
  const env = { DB: fakeDb() };
  const info = await (await get(worker, '/about/', env)).text();
  assert.ok(!/promo-bar/.test(info));
  assert.ok(!/href="\/discount-codes\/"/.test(info), 'no footer link');
  const page = await (await get(worker, '/discount-codes/joybuy/', env)).text();
  assert.match(page, /No codes right now/);
  assert.match(page, /noindex/);
  const map = await (await get(worker, '/sitemap-static.xml', env)).text();
  assert.ok(!map.includes('/discount-codes/'));
});

test('a sale with a weekly extra renders as plain translatable texts (no HTML inside a changing part)', async () => {
  const household = { ...base, id: 'joybuy-household', kind: 'sale', campaign: 'Household & Cleaning', upTo: 60, extraOff: 5, extraMin: 20, day: 'Thursday', start: day(-1), end: day(3) };
  const worker = createWorker(siteWith([household]));
  const page = await (await get(worker, '/discount-codes/joybuy/', { DB: fakeDb() })).text();
  assert.match(page, /Up to 60% off/);
  assert.match(page, /£5 off when you spend £20/);
  assert.match(page, /data-i18n="every Thursday"/);
  assert.ok(!/&lt;span/.test(page), 'no escaped HTML');
});

test('a coupon (money off, no code to type): after the codes, before the sales, with no code box and its own /go/ link', async () => {
  const coupon = { ...base, id: 'joybuy-joy-day', kind: 'coupon', campaign: 'Joy Day', off: 15, minSpend: 99, start: day(-1), end: day(2) };
  const site = siteWith([sale, coupon, live]);
  assert.deepEqual(activePromos(site).map(p => p.id), ['joybuy-live', 'joybuy-joy-day', 'joybuy-sale']);
  assert.deepEqual(activePromos(siteWith([{ ...coupon, off: 0 }])), [], 'a coupon without an amount is never shown');
  const worker = createWorker(siteWith([coupon]));
  const page = await (await get(worker, '/discount-codes/joybuy/', { DB: fakeDb() })).text();
  assert.match(page, /data-i18n="Joy Day"/);
  assert.match(page, /£15 off when you spend £99/);
  assert.match(page, /href="\/go\/joybuy-joy-day"/);
  assert.ok(!/promo-code-card|btn-copy/.test(page), 'no code to copy');
  const bar = await (await get(createWorker(siteWith([{ ...coupon, bar: '🎮' }])), '/about/', { DB: fakeDb() })).text();
  assert.match(bar, /Joybuy: £15 off when you spend £99/);
  assert.ok(!/undefined/.test(bar));
});
