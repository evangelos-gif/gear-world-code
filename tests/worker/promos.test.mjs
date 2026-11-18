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
const sale = { ...base, id: 'joybuy-sale', kind: 'sale', campaign: 'Baby', start: day(0), end: day(0) };

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

test('the promos data: every entry has an end date, an Awin advertiser id and a known landing page', () => {
  // Each retailer's own site, the landing page its email gave (lessons L32; Tooled Up and My Tool Shed since L114; Angel
  // Barocco since L186).
  const HOMES = { Joybuy: /^https:\/\/www\.joybuy\.co\.uk\//, 'Tooled Up': /^https:\/\/www\.tooled-up\.com\//, 'My Tool Shed': /^https:\/\/www\.mytoolshed\.co\.uk\//,
    'Angel Barocco': /^https:\/\/www\.angelbarocco\.com\// };
  for (const p of PROMOS) {
    assert.match(p.end, /^\d{4}-\d{2}-\d{2}$/, p.id);
    assert.ok(HOMES[p.retailer], `${p.id}: a retailer with a known landing page`);
    assert.ok(p.awinMid > 0 && HOMES[p.retailer].test(p.url), p.id);
    assert.ok(p.source, `${p.id}: source of the offer`);
  }
  assert.equal(new Set(PROMOS.map(p => p.id)).size, PROMOS.length, 'ids are unique');
  // The four Joybuy Halloween codes were removed on 9/11/2026 (lessons L107): no Halloween code in November.
  assert.deepEqual(promosFor('TGW').filter(p => p.kind === 'code').map(p => p.code), []);
  assert.ok(!PROMOS.some(p => /halloween/i.test(`${p.id} ${p.code || ''} ${p.campaign}`) || p.bar === '🎃'));
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
  // The retailer name and the code stay untranslated, each in its own translate="no" span (lessons L103).
  assert.match(info, /<span translate="no">Joybuy<\/span>: £4 off £20\+ with code <span translate="no">halloween<\/span>/);
  assert.match(info, /href="\/discount-codes\/joybuy\/"/);
  const page = await (await get(worker, '/discount-codes/joybuy/', env)).text();
  assert.match(page, /<meta name="robots" content="index,follow">/);
  assert.match(page, /<strong translate="no">halloween<\/strong>/);
  assert.match(page, /Valid until/);
  // A sale says "Sale at Joybuy" and its campaign: no percentage or saving (lessons L107).
  assert.match(page, /<span data-i18n="\{0\} sale" data-i18n-0="Joybuy" data-i18n-keep="0"><span translate="no">Joybuy<\/span> sale<\/span>/);
  assert.ok(!/% off|up to \d|Save \d/i.test(page), 'no percentage or saving');
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

test('a sale shows only "Sale at <retailer>" and its campaign; one with a percentage or an extra saving is not shown (L107)', async () => {
  const household = { ...base, id: 'joybuy-household', kind: 'sale', campaign: 'Household & Cleaning', start: day(-1), end: day(3) };
  const worker = createWorker(siteWith([household]));
  const page = await (await get(worker, '/discount-codes/joybuy/', { DB: fakeDb() })).text();
  assert.match(page, /data-i18n="Household &amp; Cleaning"/);
  assert.match(page, /data-i18n="\{0\} sale"/);
  assert.ok(!/% off|when you spend|every Thursday/.test(page), 'no figure we cannot check');
  assert.ok(!/&lt;span/.test(page), 'no escaped HTML');
  // The old shape (upTo, extraOff): not complete any more, so it never shows.
  assert.equal(activePromos(siteWith([{ ...household, upTo: 60 }, { ...household, id: 'x', extraOff: 5, extraMin: 20 }])).length, 0);
  // And the real promos.js has no percentage or saving on a sale.
  for (const p of PROMOS.filter(x => x.kind === 'sale')) assert.ok(!('upTo' in p) && !('extraOff' in p), p.id);
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
  assert.match(bar, /<span translate="no">Joybuy<\/span>: £15 off when you spend £99/);
  assert.ok(!/undefined/.test(bar));
});

test('L186: a code with the retailer\'s own percentage: "10% off your order" with no minimum, "15% off when you spend £50" with one', async () => {
  const pct = { ...base, id: 'joybuy-pct', kind: 'code', campaign: 'Black Friday', code: 'EARLYBF10', pct: 10, minSpend: 0, start: day(-1), end: day(2) };
  const min = { ...pct, id: 'joybuy-pct-min', code: 'EIN15', pct: 15, minSpend: 50 };
  const worker = createWorker(siteWith([pct, min]));
  const page = await (await get(worker, '/discount-codes/joybuy/', { DB: fakeDb() })).text();
  assert.match(page, /data-i18n="\{0\} off your order" data-i18n-0="10%">10% off your order</);
  assert.match(page, /data-i18n="\{0\} off when you spend \{1\}" data-i18n-0="15%" data-i18n-1="£50">15% off when you spend £50</);
  assert.match(page, /EARLYBF10 \(10% off\), EIN15 \(15% off £50\)|EIN15 \(15% off £50\), EARLYBF10 \(10% off\)/, 'the description');
  assert.ok(!/undefined|NaN|£0/.test(page), 'no empty amount and no "£0" minimum');
  const bar = await (await get(createWorker(siteWith([{ ...pct, bar: '🎁' }])), '/about/', { DB: fakeDb() })).text();
  assert.match(bar, /<span translate="no">Joybuy<\/span>: 10% off with code <span translate="no">EARLYBF10<\/span>/);
  assert.ok(!/undefined|NaN/.test(bar));
});

test('L186: Angel Barocco EARLYBF10 is what the email of 11 Nov 2026 says, on WGW only, until 21 Nov 2026, with no bar', () => {
  const ab = PROMOS.filter(p => p.retailer === 'Angel Barocco');
  assert.deepEqual(ab.map(p => [p.id, p.slug, p.awinMid, p.kind, p.code, p.pct, p.minSpend, p.off, p.currency, p.start, p.end, p.sites.join(), p.url, p.bar]),
    [['angel-barocco-earlybf10', 'angel-barocco', 70252, 'code', 'EARLYBF10', 10, 0, undefined, 'GBP', '2026-11-11', '2026-11-21', 'WGW', 'https://www.angelbarocco.com/', undefined]]);
  assert.match(ab[0].source, /^Awin email "Angel Barocco \(70252\): Early Access Black Friday is live: EARLYBF10", received 11 Nov 2026/);
  assert.ok(!PROMOS.some(p => p.code === 'BFCM20'), 'BFCM20 not before 22 Nov 2026 (the retailer asked)');
});

test('L187: EIN15PCDD (Tooled Up, My Tool Shed) and the Joybuy Black Friday coupons are what the emails of 16 and 17 Nov 2026 say', () => {
  const rows = PROMOS.filter(p => p.code === 'EIN15PCDD' || /^joybuy-bf-/.test(p.id))
    .map(p => [p.id, p.kind, p.code, p.pct, p.off, p.minSpend, p.start, p.end, p.sites.join(), p.url, p.campaign, p.bar]);
  const JOY = 'https://www.joybuy.co.uk/campaign/active/2NtPpZpkV1c8jJk4UL6tXcxWfsvM';
  assert.deepEqual(rows, [
    ['tooled-up-ein15pcdd', 'code', 'EIN15PCDD', 15, undefined, 50, '2026-11-16', '2026-12-30', 'CGW,AGW',
      'https://www.tooled-up.com/save-15-percent-on-einhell-products/landing/320/', 'Einhell', undefined],
    ['my-tool-shed-ein15pcdd', 'code', 'EIN15PCDD', 15, undefined, 50, '2026-11-16', '2026-12-30', 'CGW,GGW',
      'https://www.mytoolshed.co.uk/save-15-percent-on-einhell-products/landing/320/', 'Einhell', undefined],
    ['joybuy-bf-10-off-59', 'coupon', undefined, undefined, 10, 59, '2026-11-16', '2026-11-30', 'HGW,KGW,PGW,TGW,WGW', JOY, 'Black Friday', undefined],
    ['joybuy-bf-40-off-199', 'coupon', undefined, undefined, 40, 199, '2026-11-16', '2026-11-30', 'HGW,KGW,PGW,TGW,WGW', JOY, 'Black Friday', undefined]
  ]);
  for (const p of PROMOS.filter(x => x.code === 'EIN15PCDD' || /^joybuy-bf-/.test(x.id))) {
    assert.match(p.source, /received 1[67] Nov 2026 \(owner's approval «ΕΓΚΡΙΝΩ ΠΡΟΣΦΟΡΕΣ 18\/11: 11,12,13», 18 Nov 2026\)$/, p.id);
  }
});
