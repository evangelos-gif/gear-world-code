// Rakuten and Daisycon feeds (13 Nov 2026, lessons L128). Made-up records in the networks' documented layouts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isRakutenLink, isDaisyconLink, pageInLink, NETWORKS, networkOf } from '../../tools/network-links.mjs';
import * as dc from '../../tools/daisycon-feed.mjs';
import * as rk from '../../tools/rakuten-feed.mjs';
import { feedPaths, readProducts } from '../../tools/legacy-import-plan.mjs';

const RK_LINK = 'https://click.linksynergy.com/link?id=abc123&offerid=1606623.1001&type=15&murl=https%3A%2F%2Fcottonon.com%2FGB%2Fp%2F1001.html';
const DC_LINK = 'https://ds1.nl/c/?si=16029&li=1234567&wi=447289&ws=&dl=https%3A%2F%2Fwww.laredoute.nl%2Fppdp%2Fprod-1.aspx';

test('tracking links of Rakuten and Daisycon, and the shop page inside them', () => {
  assert.ok(isRakutenLink(RK_LINK));
  assert.ok(!isRakutenLink('https://cottonon.com/GB/p/1001.html'));
  assert.ok(!isRakutenLink('https://click.linksynergy.com/link?offerid=1'), 'no publisher id');
  assert.ok(isDaisyconLink(DC_LINK));
  assert.ok(isDaisyconLink(DC_LINK, '447289'));
  assert.ok(!isDaisyconLink(DC_LINK, '999999'), 'another publisher\'s click would not pay us');
  assert.ok(!isDaisyconLink('https://www.laredoute.nl/ppdp/prod-1.aspx'));
  assert.equal(pageInLink(RK_LINK), 'https://cottonon.com/GB/p/1001.html');
  assert.equal(pageInLink(DC_LINK), 'https://www.laredoute.nl/ppdp/prod-1.aspx');
  assert.equal(networkOf({ RULES: { network: 'daisycon' } }).file, 'DAISYCON');
  assert.equal(networkOf({ RULES: {} }), null);
  assert.deepEqual(Object.values(NETWORKS).map(n => n.idPrefix), ['cj', 'rk', 'dc', 'bol', 'lw'], 'bol.com from 16 Nov 2026 (chat 9), Linkwise from 19 Nov 2026 (L199)');
});

const dcAnswer = (products, name = 'La Redoute NL') => ({ datafeed: { info: { count: products.length }, programs: [{ program_info: { id: 16029, name, currency: 'EUR' }, products }] } });
const dcProduct = (i, extra = {}) => ({ product_info: { title: `Wollen trui ${i}`, link: DC_LINK.replace('prod-1', `prod-${i}`), price: '39.99', price_old: '59.99',
  brand: 'La Redoute', category: 'Truien', ean: `871000000000${i}`, sku: `LR-${i}`, images: [{ location: `https://img.laredoute.nl/${i}.jpg` }], in_stock: true, ...extra }, update_info: { last_modified: '2026-11-13' } });

function fakeFetch(handler) {
  const calls = [];
  const f = async url => { calls.push(String(url)); const r = handler(new URL(url)); const h = r.headers || {};
    return { status: r.status || 200, headers: { get: k => h[k.toLowerCase()] ?? null }, text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body) }; };
  f.calls = calls;
  return f;
}

test('Daisycon: products found in the answer and turned into feed rows (Awin names, tracking link only when it is ours)', () => {
  const found = dc.findProducts(dcAnswer([dcProduct(1), dcProduct(2)]));
  assert.equal(found.length, 2);
  assert.equal(found[0].program.name, 'La Redoute NL');
  const row = dc.toFeedRow(found[0].product, { programId: 16029, program: found[0].program, mediaId: '447289' });
  assert.equal(row.product_name, 'Wollen trui 1');
  assert.equal(row.search_price, '39.99');
  assert.equal(row.rrp_price, '59.99');
  assert.equal(row.currency, 'EUR');
  assert.equal(row.in_stock, '1');
  assert.equal(row.merchant_image_url, 'https://img.laredoute.nl/1.jpg');
  assert.equal(row.merchant_deep_link, 'https://www.laredoute.nl/ppdp/prod-1.aspx');
  assert.ok(row.aw_deep_link.startsWith('https://ds1.nl/c/'));
  assert.equal(row.merchant_product_id, 'LR-1');
  assert.equal(dc.toFeedRow(found[0].product, { programId: 16029, program: found[0].program, mediaId: '1' }).aw_deep_link, '', 'not our media id');
  assert.equal(dc.toFeedRow(dcProduct(3, { in_stock: false }), { mediaId: '447289' }).in_stock, '0');
});

test('Daisycon: sign-in with PKCE, the feed picked from the API (English first), our media and locale in its address', () => {
  const k = dc.pkce();
  assert.ok(k.verifier.length >= 43 && !/[+/=]/.test(k.verifier));
  const u = new URL(dc.authorizeUrl({ client: 'abc123', challenge: k.challenge, state: k.state }));
  assert.equal(u.origin, 'https://login.daisycon.com');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://login.daisycon.com/oauth/cli');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  const feeds = [{ id: 1, url: 'https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=16029&standard_id=2&language_code=nl&locale_id=#LOCALE_ID#', language_code: 'nl', locale_ids: [1], products: 900 },
    { id: 2, url: 'https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=16029&standard_id=2&language_code=en&locale_id=#LOCALE_ID#', language_code: 'en', locale_ids: [6, 1], products: 800 }];
  assert.equal(dc.pickFeed(feeds).id, 2);
  const a = new URL(dc.feedAddress(dc.pickFeed(feeds), { mediaId: 447289, records: 500 }));
  assert.equal(a.searchParams.get('media_id'), '447289');
  assert.equal(a.searchParams.get('locale_id'), '6');
  assert.equal(a.searchParams.get('type'), 'JSON');
  assert.equal(a.searchParams.get('records'), '500', 'Daisycon pages with "records" and X-Next-Url');
  assert.equal(a.searchParams.get('page'), null);
  assert.equal(dc.pickFeed([{ id: 3 }]), null, 'a feed without an address is not used');
});

// A fake Daisycon: the sign-in, the API and the feed, on one address.
function fakeDaisycon({ refresh = 'R1', products = 3, rotate = 'R2' } = {}) {
  return fakeFetch(u => {
    if (u.pathname === '/oauth/access-token') return { body: { access_token: 'A1', refresh_token: rotate, expires_in: 3600 } };
    if (u.pathname === '/publishers') return { body: [{ id: 777 }] };
    if (u.pathname === '/publishers/777/programs/16029') return { body: { id: 16029, url: 'https://www.laredoute.nl/', supply_locale_ids: [1, 6] } };
    if (u.pathname === '/locales') return { body: [{ id: '1', country_code: 'NL' }, { id: '6', country_code: 'BE' }] };
    if (u.pathname === '/publishers/777/productfeeds.v2/program') {
      const pid = u.searchParams.get('program_id');
      if (pid !== '16029') return { body: [] };
      return { body: [{ id: 5, url: 'https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=16029&standard_id=2&language_code=en&locale_id=#LOCALE_ID#', language_code: 'en', locale_ids: [6], currency_code: 'EUR', products }] };
    }
    if (u.hostname === 'daisycon.io') {
      if (u.searchParams.get('media_id') !== '447289' || u.searchParams.get('locale_id') !== '6') return { status: 400, body: { error: 'Missing the following parameters: locale_id' } };
      // Like Daisycon: "records" products, the next ones at the X-Next-Url address; "page" and "per_page" mean nothing.
      const per = Number(u.searchParams.get('records')) || products;
      const from = Number(u.searchParams.get('offset_test') || 0);
      const n = Math.min(per, products - from);
      const headers = { 'x-total-count': String(products) };
      if (from + n < products) { const next = new URL(u); next.searchParams.set('offset_test', String(from + n)); headers['x-next-url'] = next.toString(); }
      return { headers, body: dcAnswer(Array.from({ length: n }, (_, i) => dcProduct(from + i + 1))) };
    }
    return { status: 404, body: 'not found' };
  });
}

test('Daisycon: probe and download through the API, the new sign-in key handed back, other programmes reported', async () => {
  const f = fakeDaisycon({ products: dc.PER_PAGE + 3 });
  const env = { GW_DC_CLIENT: 'abc123', GW_DC_SECRET: 's3cret', GW_DC_REFRESH: 'R1' };
  const P = await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '16029,22318', '--pause', '0'], f, env);
  assert.equal(P.ok, true);
  assert.equal(P.newRefresh, 'R2');
  assert.equal(P.programs[0].ok, true);
  assert.equal(P.programs[0].language, 'en');
  assert.equal(P.programs[0].samples[0].tracking, 'ds1.nl');
  assert.equal(P.programs[0].shopUrl, 'https://www.laredoute.nl/');
  assert.deepEqual(P.programs[0].ships, ['NL', 'BE']);
  assert.ok(f.calls.some(c => /\/datafeed\/.*records=2/.test(c)), 'the look asks for 2 products only');
  assert.equal(P.programs[1].ok, false);
  assert.match(P.programs[1].error, /no product feed/);
  const tokenCall = f.calls.find(c => c.includes('/oauth/access-token'));
  assert.ok(tokenCall);
  const out = mkdtempSync(join(tmpdir(), 'gw-dc-'));
  const D = await dc.main(['--mode', 'download', '--media', '447289', '--programs', '16029', '--out', out, '--pause', '0'], f, env);
  assert.equal(D.ok, true);
  const A = D.programs[0];
  assert.equal(A.ok, true);
  assert.equal(A.got, dc.PER_PAGE + 3);
  assert.equal(A.total, dc.PER_PAGE + 3);
  assert.equal(A.withTracking, A.got);
  assert.equal(A.withPage, A.got);
  assert.equal(A.newest, '2026-11-13', 'the newest product update, to see a feed that stopped changing');
  assert.deepEqual(A.currencies, ['EUR']);
  const text = gunzipSync(readFileSync(A.file)).toString('utf8');
  assert.ok(text.split('\n')[0].includes('aw_deep_link'));
  assert.ok(text.split('\n')[0].endsWith('"dc_gender","dc_colour","dc_size","dc_delivery","dc_shipping","dc_google_category","dc_condition"'), 'Daisycon fields after the Awin columns');
  assert.equal(text.trim().split('\n').length, A.got + 1);
  assert.equal((await dc.main(['--mode', 'probe', '--media', 'x', '--programs', '1'], f, env)).error, 'wrong media id');
  assert.equal((await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '16029', '--base', 'https://evil.example'], f, env)).error, 'unexpected Daisycon address');
  const bad = fakeFetch(u => u.pathname === '/oauth/access-token' ? { status: 400, body: { error: 'invalid_grant' } } : { body: [] });
  const B = await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '16029'], bad, env);
  assert.equal(B.signIn, true);
  assert.match(B.error, /invalid_grant/);
});

// First real download (14 Nov 2026, lessons L145): Daisycon ignored "page" and sent the whole feed 200 times; its links
// carry the shop page as a bare path (dl=...html).
test('Daisycon: a feed that repeats itself stops with an error, the shop page comes from the link path and the shop address', async () => {
  const link = 'https://fr135.net/c/?si=15514&li=1673121&wi=447289&pid=0a71b186&dl=foco-myst-corner-right-1200_2012r57203.html&ws=';
  assert.equal(dc.pageFromDl(link, 'https://www.bioethanol-fireplace.co.uk'), 'https://www.bioethanol-fireplace.co.uk/foco-myst-corner-right-1200_2012r57203.html');
  assert.equal(dc.pageFromDl(link, 'https://www.shop.example/en-gb/'), 'https://www.shop.example/en-gb/foco-myst-corner-right-1200_2012r57203.html');
  assert.equal(dc.pageFromDl(link.replace('dl=foco', 'dl=%2Ffoco'), 'https://www.shop.example/en-gb/'), 'https://www.shop.example/foco-myst-corner-right-1200_2012r57203.html');
  assert.equal(dc.pageFromDl(link, ''), '', 'no shop address, no page');
  // Programmes that send the click on through Rakuten or Impact: the page is inside that link.
  const viaRakuten = 'https://rkn3.net/c/?si=15019&li=1&wi=447289&dl=' + encodeURIComponent('link?id=p5Zs8TJlngw&offerid=759858.43&type=15&murl=' + encodeURIComponent('https://www.giuseppezanotti.com/fr-fr/products/frankie-sneakers-ru50000003'));
  assert.equal(dc.pageFromDl(viaRakuten, ''), 'https://www.giuseppezanotti.com/fr-fr/products/frankie-sneakers-ru50000003');
  const viaImpact = 'https://bdt9.net/c/?si=18489&li=1&wi=447289&dl=' + encodeURIComponent('c/1418078/2187919/26372?prodsku=T29C7121&u=' + encodeURIComponent('https://eu.eufy.com/products/t29c7121?variant=43198849482904') + '&intsrc=CATF_19945&subId1=%BDCI%&sharedId=%MEDIA_ID%');
  assert.equal(dc.pageFromDl(viaImpact, ''), 'https://eu.eufy.com/products/t29c7121?variant=43198849482904');
  assert.equal(dc.pageFromDl(link.replace(/dl=[^&]*/, 'dl=' + encodeURIComponent('products/sleepbuddy?variant=5473')), 'https://www.shop.example'), 'https://www.shop.example/products/sleepbuddy?variant=5473');
  assert.equal(dc.pageFromDl(link.replace(/dl=[^&]*/, 'dl=%2F%2Fevil.example%2Fx'), 'https://www.shop.example/'), '', 'never another host');
  const row = dc.toFeedRow({ product_info: { title: 'Foco Myst', link, price: '3299', sku: '57203' } }, { programId: 15514, mediaId: '447289', shopUrl: 'https://www.bioethanol-fireplace.co.uk/' });
  assert.equal(row.merchant_deep_link, 'https://www.bioethanol-fireplace.co.uk/foco-myst-corner-right-1200_2012r57203.html');
  assert.equal(row.aw_deep_link, link);
  assert.equal(dc.nextPage('https://daisycon.io/datafeed/?x=2', 'https://daisycon.io/datafeed/?x=1'), 'https://daisycon.io/datafeed/?x=2');
  assert.equal(dc.nextPage('/datafeed/?x=2', 'https://daisycon.io/datafeed/?x=1'), 'https://daisycon.io/datafeed/?x=2');
  assert.equal(dc.nextPage('https://evil.example/?x=2', 'https://daisycon.io/datafeed/?x=1'), '');

  const env = { GW_DC_CLIENT: 'abc123', GW_DC_SECRET: 's3cret', GW_DC_REFRESH: 'R1' };
  const feedUrl = 'https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=15514&locale_id=#LOCALE_ID#';
  const repeating = fakeFetch(u => {
    if (u.pathname === '/oauth/access-token') return { body: { access_token: 'A1', refresh_token: 'R2' } };
    if (u.pathname === '/publishers') return { body: [{ id: 777 }] };
    if (u.pathname === '/publishers/777/programs/15514') return { body: { id: 15514, url: 'https://www.bioethanol-fireplace.co.uk' } };
    if (u.pathname === '/publishers/777/productfeeds.v2/program') return { body: [{ id: 1, url: feedUrl, language_code: 'en', locale_ids: [4], products: 3 }] };
    if (u.hostname === 'daisycon.io') return { headers: { 'x-next-url': u.toString() + '&again=1' }, body: dcAnswer([dcProduct(1), dcProduct(2), dcProduct(3)]) };
    return { status: 404, body: 'not found' };
  });
  const out = mkdtempSync(join(tmpdir(), 'gw-dc-'));
  const D = await dc.main(['--mode', 'download', '--media', '447289', '--programs', '15514', '--out', out, '--pause', '0'], repeating, env);
  assert.equal(D.programs[0].ok, false);
  assert.match(D.programs[0].error, /only products already read/);
  assert.equal(D.programs[0].got, 3, 'each product once');
  assert.ok(repeating.calls.filter(c => c.includes('daisycon.io')).length <= 2, 'stopped at the second page');
});

// First real run (14 Nov 2026, lessons L145): "Invalid URL" from one feed address stopped the whole look of 71 programmes
// right after the sign-in, and the renewed sign-in key was lost with it.
test('Daisycon: an odd feed address is completed or reported for its programme only, and the new sign-in key always comes back', async () => {
  assert.equal(dc.feedUrlOf('//daisycon.io/datafeed/?x=1'), 'https://daisycon.io/datafeed/?x=1');
  assert.equal(dc.feedUrlOf('daisycon.io/datafeed/?x=1'), 'https://daisycon.io/datafeed/?x=1');
  assert.equal(dc.feedUrlOf('/datafeed/?x=1'), 'https://daisycon.io/datafeed/?x=1');
  assert.equal(dc.feedUrlOf({ json: 'https://daisycon.io/datafeed/?type=json' }), 'https://daisycon.io/datafeed/?type=json');
  for (const bad of ['', null, undefined, {}, '[object Object]', 'mailto:x@y.z', 'http://']) assert.equal(dc.feedUrlOf(bad), null, String(bad));
  assert.match(dc.addressShape({ a: 1 }), /^object: \{"a":1\}/);
  assert.equal(dc.addressShape('https://daisycon.io/?k=' + 'a'.repeat(40)), 'https://daisycon.io/?k=***');
  const a = new URL(dc.feedAddress({ url: 'https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&subid=#SUBID#&language_code=#LANGUAGE_CODE#&locale_id=#LOCALE_ID#&program_id=16029', language_code: 'en', locale_ids: [6] }, { mediaId: 447289 }));
  assert.equal(a.hash, '', 'no placeholder left to cut the address');
  assert.equal(a.searchParams.get('program_id'), '16029');
  assert.equal(a.searchParams.get('language_code'), 'en');
  assert.equal(a.searchParams.get('subid'), '');
  assert.equal(dc.feedAddress({ url: {} }, { mediaId: 447289 }), '');

  const env = { GW_DC_CLIENT: 'abc123', GW_DC_SECRET: 's3cret', GW_DC_REFRESH: 'R1' };
  const good = 'https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=16029&standard_id=2&language_code=en&locale_id=#LOCALE_ID#';
  const f = fakeFetch(u => {
    if (u.pathname === '/oauth/access-token') return { body: { access_token: 'A1', refresh_token: 'R2' } };
    if (u.pathname === '/publishers') return { body: [{ id: 777 }] };
    if (u.pathname === '/publishers/777/productfeeds.v2/program') {
      const pid = u.searchParams.get('program_id');
      assert.equal(u.searchParams.get('placeholder_media_id'), '447289');
      if (pid === '11111') return { body: [{ id: 9, url: '[object Object]', language_code: 'en', locale_ids: [6], products: 5 }] };
      if (pid === '22222') return { body: [{ id: 8, url: '//daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=22222&locale_id=#LOCALE_ID#', language_code: 'en', locale_ids: [6], products: 5, subscribed_media_ids: [447289] }] };
      return { body: [{ id: 5, url: good, language_code: 'en', locale_ids: [6], currency_code: 'EUR', products: 3, subscribed_media_ids: [1] }] };
    }
    if (u.hostname === 'daisycon.io') return { body: dcAnswer([dcProduct(1), dcProduct(2)]) };
    return { status: 404, body: 'not found' };
  });
  const P = await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '11111,22222,16029', '--pause', '0'], f, env);
  assert.equal(P.ok, true);
  assert.equal(P.newRefresh, 'R2');
  assert.deepEqual(P.programs.map(x => x.ok), [false, true, true]);
  assert.match(P.programs[0].error, /could not be read: \[object Object\]/);
  assert.equal(P.programs[1].subscribed, true);
  assert.equal(P.programs[2].subscribed, false);
  const out = mkdtempSync(join(tmpdir(), 'gw-dc-'));
  const D = await dc.main(['--mode', 'download', '--media', '447289', '--programs', '11111,16029', '--out', out, '--pause', '0'], f, env);
  assert.deepEqual(D.programs.map(x => x.ok), [false, true]);
  assert.match(D.programs[0].error, /could not be read/);

  // A programme whose answer breaks mid-way is reported, the others still go on.
  const breaking = async url => {
    const u = new URL(url);
    if (u.pathname === '/oauth/access-token') return { status: 200, text: async () => JSON.stringify({ access_token: 'A1', refresh_token: 'R3' }) };
    if (u.pathname === '/publishers') return { status: 200, text: async () => JSON.stringify([{ id: 777 }]) };
    if (u.pathname.endsWith('/program')) return { status: 200, text: async () => JSON.stringify([{ id: 5, url: good.replace('16029', u.searchParams.get('program_id')), language_code: 'en', locale_ids: [6], products: 3 }]) };
    if (u.searchParams.get('program_id') === '33333') return { status: 200, text: async () => { throw new Error('socket hang up'); } };
    return { status: 200, text: async () => JSON.stringify(dcAnswer([dcProduct(1)])) };
  };
  const Q = await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '33333,16029', '--pause', '0'], breaking, env);
  assert.equal(Q.newRefresh, 'R3');
  assert.deepEqual(Q.programs.map(x => x.ok), [false, true]);
  assert.match(Q.programs[0].error, /unexpected: socket hang up/);

  // Even when the whole look breaks, the renewed sign-in key is handed back (else the saved one no longer works).
  const allBreak = async url => new URL(url).pathname === '/oauth/access-token'
    ? { status: 200, text: async () => JSON.stringify({ access_token: 'A1', refresh_token: 'R4' }) }
    : { status: 200, text: async () => { throw new TypeError('Invalid URL'); } };
  const Z = await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '16029', '--pause', '0'], allBreak, env);
  assert.equal(Z.ok, false);
  assert.equal(Z.newRefresh, 'R4');
  assert.match(Z.error, /unexpected: Invalid URL/);
});

const HDR = 'HDR|1606623|Cotton On UK|11/13/2026 06:00:00';
const rkLine = (i, o = {}) => {
  const r = { product_id: `${i}`, name: `Classic Crew Tee ${i}`, sku: `CO-${i}`, primary_category: 'Mens', secondary_category: 'Tops~~T-Shirts', product_url: RK_LINK,
    image_url: `https://cottonon.com/img/${i}.jpg`, buy_url: '', short_description: 'A "classic" tee | soft', long_description: '', discount: '', discount_type: '',
    sale_price: '8.00', retail_price: '12.00', begin_date: '', end_date: '', brand: 'Cotton On', shipping: '', keywords: '', part_number: '', manufacturer: '',
    shipping_info: '', availability: 'in-stock', upc: '9351234567890', class_id: '60', currency: 'GBP', m1: '', pixel: '', ...o };
  return rk.FIELDS.map(k => /\|/.test(r[k]) ? `"${r[k].replace(/"/g, '""')}"` : r[k]).join('|');
};

test('Rakuten: pipe file with header and trailer, a value with a pipe in quotes, the sale price, the tracking link', () => {
  assert.deepEqual(rk.splitPipe('a|"b|c"|d'), ['a', 'b|c', 'd']);
  const text = [HDR, rkLine(1), rkLine(2, { availability: 'out-of-stock', sale_price: '' }), 'TRL|2'].join('\n');
  const R = rk.parsePipe(text);
  assert.equal(R.header.name, 'Cotton On UK');
  assert.equal(R.trailer, 2);
  assert.equal(R.records.length, 2);
  assert.equal(R.records[0].short_description, 'A "classic" tee | soft');
  const row = rk.toFeedRow(R.records[0], { mid: '1606623', name: 'Cotton On UK' });
  assert.equal(row.search_price, '8');
  assert.equal(row.rrp_price, '12');
  assert.equal(row.currency, 'GBP');
  assert.equal(row.in_stock, '1');
  assert.equal(row.merchant_category, 'Mens > Tops > T-Shirts');
  assert.equal(row.merchant_deep_link, 'https://cottonon.com/GB/p/1001.html');
  assert.equal(row.aw_deep_link, RK_LINK);
  assert.equal(row.ean, '9351234567890');
  const row2 = rk.toFeedRow(R.records[1]);
  assert.equal(row2.search_price, '12');
  assert.equal(row2.in_stock, '0');
});

test('Rakuten: the XML layout reads the same fields', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><merchandiser><header><merchantId>1606623</merchantId><merchantName>Cotton On UK</merchantName><createdOn>2026-11-13</createdOn></header>
<product product_id="7" name="Relaxed Hoodie &amp; Co" sku_number="CO-7" manufacturer_name="Cotton On" part_number=""><category><primary>Womens</primary><secondary>Hoodies</secondary></category>
<URL><product>${RK_LINK.replace(/&/g, '&amp;')}</product><productImage>https://cottonon.com/img/7.jpg</productImage></URL><description><short><![CDATA[Soft <b>fleece</b>]]></short><long></long></description>
<price currency="GBP"><sale begin_date="" end_date="">20.00</sale><retail>25.00</retail></price><brand>Cotton On</brand><shipping><availability>in-stock</availability></shipping><upc>9351234567807</upc></product>
<trailer><numberOfProducts>1</numberOfProducts></trailer></merchandiser>`;
  const R = rk.parseCatalog(xml);
  assert.equal(R.format, 'xml');
  assert.equal(R.trailer, 1);
  assert.equal(R.records[0].name, 'Relaxed Hoodie & Co');
  assert.equal(R.records[0].short_description, 'Soft <b>fleece</b>');
  const row = rk.toFeedRow(R.records[0], { mid: R.header.mid });
  assert.equal(row.aw_deep_link, RK_LINK);
  assert.equal(row.search_price, '20');
  assert.equal(row.merchant_category, 'Womens > Hoodies');
});

test('Rakuten: a sample from the first part of a file, and a whole file converted only when the trailer count matches', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw-rk-'));
  const lines = [HDR, ...Array.from({ length: 3000 }, (_, i) => rkLine(i + 1)), 'TRL|3000'].join('\n');
  const gz = gzipSync(Buffer.from(lines));
  const cut = join(dir, 'cut.gz');
  writeFileSync(cut, gz.subarray(0, 4000));
  const S = rk.sample(rk.readGz(cut, { partial: true }));
  assert.equal(S.ok, true);
  assert.equal(S.header.mid, '1606623');
  assert.equal(S.rows[0].tracking, 'click.linksynergy.com');
  const whole = join(dir, 'whole.gz');
  writeFileSync(whole, gz);
  const out = join(dir, 'RAKUTEN_1606623.csv.gz.part');
  const C = await rk.convert(rk.readGz(whole), out);
  assert.equal(C.ok, true);
  assert.equal(C.rows, 3000);
  assert.equal(C.withTracking, 3000);
  assert.ok(existsSync(out));
  const short = [HDR, rkLine(1), rkLine(2), 'TRL|5'].join('\n');
  const B = await rk.convert(short, join(dir, 'bad.part'));
  assert.equal(B.ok, false);
  assert.match(B.error, /trailer says 5/);
  assert.equal((await rk.convert([HDR, rkLine(1)].join('\n'), join(dir, 'bad2.part'))).error, 'no trailer (file cut short?)');
});

test('the import planner finds RAKUTEN_ and DAISYCON_ files and keeps their tracking links', async () => {
  const archive = mkdtempSync(join(tmpdir(), 'gw-net-'));
  for (const f of ['DAISYCON_16029.csv.gz', 'DAISYCON_160290.csv.gz', 'RAKUTEN_1606623.csv.gz', 'CJ_16029.csv.gz', 'AWIN_16029_1.csv.gz']) writeFileSync(join(archive, f), '');
  assert.deepEqual(feedPaths({ archive, rules: { RULES: { network: 'daisycon', advertiserId: 16029 } } }), [join(archive, 'DAISYCON_16029.csv.gz')]);
  assert.deepEqual(feedPaths({ archive, rules: { RULES: { network: 'rakuten', advertiserId: 1606623 } } }), [join(archive, 'RAKUTEN_1606623.csv.gz')]);
  assert.deepEqual(feedPaths({ archive, rules: { RULES: { advertiserId: 16029 } } }), [join(archive, 'AWIN_16029_1.csv.gz')]);
  const out = mkdtempSync(join(tmpdir(), 'gw-net2-'));
  const D = await dc.download({ access: 'A1', mediaId: '447289', programs: ['16029'], out, pauseMs: 0, services: 'https://services.daisycon.com', fetchImpl: fakeDaisycon({ products: 2 }) });
  const archive2 = mkdtempSync(join(tmpdir(), 'gw-net3-'));
  writeFileSync(join(archive2, 'DAISYCON_16029.csv.gz'), readFileSync(D.programs[0].file));
  const R = await readProducts({ archive: archive2, rules: { RULES: { network: 'daisycon', advertiserId: 16029 } } });
  assert.equal(R.products.length, 2);
  assert.ok(isDaisyconLink(R.products[0].tracked, '447289'));
  assert.equal(R.products[0].currency, 'EUR');
});

// TEMU INT (15 Nov 2026, lessons L163): a shop with a feed per country and currency. The owner wants only what the
// sites can show to UK visitors, so the UK feed in pounds, with the UK locale in the address, and a size limit.
test('Daisycon: --country and --currency pick the UK feed in pounds, every feed is listed, -MaxProducts stops a big feed', async () => {
  const us = { id: 11, url: 'https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=18371&locale_id=#LOCALE_ID#', language_code: 'en', locale_ids: [9], countries: ['US'], currency_code: 'USD', products: 900000 };
  const uk = { id: 12, url: 'https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=18371&locale_id=#LOCALE_ID#', language_code: 'en', locale_ids: [4, 3], countries: ['IE', 'GB'], currency_code: 'GBP', products: 1200 };
  const de = { id: 13, url: 'https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=18371&locale_id=#LOCALE_ID#', language_code: 'de', locale_ids: [5], countries: ['DE'], currency_code: 'EUR', products: 5000 };
  assert.equal(dc.pickFeed([us, uk, de]).id, 11, 'without a choice: English first, then the most products (as before)');
  const g = dc.pickFeed([us, uk, de], { country: 'GB', currency: 'GBP' });
  assert.equal(g.id, 12);
  assert.deepEqual(g.locale_ids, [3, 4], 'the UK locale goes first, so it is the one in the address');
  assert.equal(new URL(dc.feedAddress(g, { mediaId: 447289 })).searchParams.get('locale_id'), '3');
  assert.equal(dc.pickFeed([us, de], { country: 'GB' }), null, 'no feed for the UK: nothing, never another country');
  assert.equal(dc.pickFeed([us, { ...uk, currency_code: 'EUR', countries: ['GB'], locale_ids: [3] }, { ...uk, id: 14, countries: ['GB'], locale_ids: [3] }], { country: 'GB', currency: 'GBP' }).id, 14, 'pounds first');
  assert.deepEqual(dc.feedSummary([us, uk]).map(f => `${f.id} ${f.currency} ${f.countries.join('+')}`), ['11 USD US', '12 GBP IE+GB']);

  const fake = fakeFetch(u => {
    if (u.pathname === '/oauth/access-token') return { body: { access_token: 'A1', refresh_token: 'R2', expires_in: 3600 } };
    if (u.pathname === '/publishers') return { body: [{ id: 777 }] };
    if (u.pathname === '/locales') return { body: [{ id: '3', country_code: 'GB' }, { id: '4', country_code: 'IE' }, { id: '9', country_code: 'US' }] };
    if (u.pathname === '/publishers/777/programs/18371') return { body: { id: 18371, url: 'https://www.temu.com/', supply_locale_ids: [3, 4, 9] } };
    if (u.pathname === '/publishers/777/productfeeds.v2/program') return { body: [{ ...us, countries: undefined }, { ...uk, countries: undefined, products: 3 }] };
    if (u.hostname === 'daisycon.io') {
      if (u.searchParams.get('locale_id') !== '3') return { status: 400, body: { error: 'wrong locale' } };
      return { headers: { 'x-total-count': '3' }, body: dcAnswer([dcProduct(1), dcProduct(2), dcProduct(3)]) };
    }
    return { status: 404, body: 'not found' };
  });
  const env = { GW_DC_CLIENT: 'abc123', GW_DC_SECRET: 's3cret', GW_DC_REFRESH: 'R1' };
  const P = await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '18371', '--pause', '0', '--country', 'gb', '--currency', 'gbp'], fake, env);
  assert.equal(P.ok, true);
  assert.equal(P.programs[0].ok, true);
  assert.equal(P.programs[0].currency, 'GBP');
  assert.equal(P.programs[0].feedId, 12);
  assert.deepEqual(P.programs[0].allFeeds.map(f => f.countries.join('+')), ['US', 'IE+GB'], 'the countries come from the locales');
  const out = mkdtempSync(join(tmpdir(), 'gw-dc-temu-'));
  const D = await dc.main(['--mode', 'download', '--media', '447289', '--programs', '18371', '--out', out, '--pause', '0', '--country', 'GB', '--currency', 'GBP', '--max-products', '100'], fake, env);
  assert.equal(D.programs[0].ok, true);
  assert.equal(D.programs[0].got, 3);
  assert.equal(D.programs[0].feedCurrency, 'GBP');
  const T = await dc.main(['--mode', 'download', '--media', '447289', '--programs', '18371', '--out', out, '--pause', '0', '--max-products', '100'], fake, env);
  assert.equal(T.programs[0].ok, false, 'without a country the US feed (900,000) is chosen, and it is too big');
  assert.equal(T.programs[0].tooBig, true);
  assert.match(T.programs[0].error, /more than the 100 allowed/);
  assert.ok(!fake.calls.some(c => c.includes('locale_id=9')), 'the big feed is never read');
  assert.equal((await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '18371', '--country', 'GBR'], fake, env)).error, 'wrong country (two letters, e.g. GB, or a list GB,US,PL)');
  assert.equal((await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '18371', '--currency', '££'], fake, env)).newRefresh, 'R2', 'a wrong option still hands back the new sign-in key');
});

// Owner, 15 Nov 2026 ("to strengthen the USA and Poland"): several countries in one run, each feed in its own money,
// one file per country (lessons L163).
test('Daisycon: --country GB,US,PL gives one file per country in its own currency; a country without a feed is only reported', async () => {
  assert.deepEqual(dc.countryChoices('gb, us,PL'), [{ country: 'GB', currency: 'GBP' }, { country: 'US', currency: 'USD' }, { country: 'PL', currency: 'PLN' }]);
  assert.deepEqual(dc.countryChoices(''), [{ country: '', currency: '' }]);
  const feed = (id, loc, cur) => ({ id, url: `https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=18371&locale_id=#LOCALE_ID#`, language_code: 'en', locale_ids: [loc], currency_code: cur, products: 2 });
  const fake = fakeFetch(u => {
    if (u.pathname === '/oauth/access-token') return { body: { access_token: 'A1', refresh_token: 'R2', expires_in: 3600 } };
    if (u.pathname === '/publishers') return { body: [{ id: 777 }] };
    if (u.pathname === '/locales') return { body: [{ id: '3', country_code: 'GB' }, { id: '9', country_code: 'US' }] };
    if (u.pathname === '/publishers/777/programs/18371') return { body: { id: 18371, url: 'https://www.temu.com/' } };
    if (u.pathname === '/publishers/777/productfeeds.v2/program') return { body: [feed(1, 3, 'GBP'), feed(2, 9, 'USD')] };
    if (u.hostname === 'daisycon.io') return { headers: { 'x-total-count': '2' }, body: dcAnswer([dcProduct(u.searchParams.get('locale_id') * 10 + 1), dcProduct(u.searchParams.get('locale_id') * 10 + 2)]) };
    return { status: 404, body: 'not found' };
  });
  const env = { GW_DC_CLIENT: 'abc123', GW_DC_SECRET: 's3cret', GW_DC_REFRESH: 'R1' };
  const out = mkdtempSync(join(tmpdir(), 'gw-dc-multi-'));
  const D = await dc.main(['--mode', 'download', '--media', '447289', '--programs', '18371', '--out', out, '--pause', '0', '--country', 'GB,US,PL'], fake, env);
  assert.equal(D.ok, true);
  assert.deepEqual(D.programs.map(a => `${a.country} ${a.ok} ${a.feedCurrency || '-'} ${a.file.split(/[\\/]/).pop()}`),
    ['GB true GBP DAISYCON_18371_GB.csv.gz.part', 'US true USD DAISYCON_18371_US.csv.gz.part', 'PL false - DAISYCON_18371_PL.csv.gz.part']);
  assert.equal(D.programs[2].noFeed, true, 'Poland has no feed here: reported, not an error of the run');
  const P = await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '18371', '--pause', '0', '--country', 'GB,PL'], fake, env);
  assert.deepEqual(P.programs.map(x => `${x.country} ${x.ok} ${x.noFeed || false}`), ['GB true false', 'PL false true']);
  assert.equal((await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '18371', '--country', 'GB,USA'], fake, env)).error, 'wrong country (two letters, e.g. GB, or a list GB,US,PL)');
});
