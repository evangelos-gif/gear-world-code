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
  assert.deepEqual(Object.values(NETWORKS).map(n => n.idPrefix), ['cj', 'rk', 'dc']);
});

const dcAnswer = (products, name = 'La Redoute NL') => ({ datafeed: { info: { count: products.length }, programs: [{ program_info: { id: 16029, name, currency: 'EUR' }, products }] } });
const dcProduct = (i, extra = {}) => ({ product_info: { title: `Wollen trui ${i}`, link: DC_LINK.replace('prod-1', `prod-${i}`), price: '39.99', price_old: '59.99',
  brand: 'La Redoute', category: 'Truien', ean: `871000000000${i}`, sku: `LR-${i}`, images: [{ location: `https://img.laredoute.nl/${i}.jpg` }], in_stock: true, ...extra }, update_info: { last_modified: '2026-11-13' } });

function fakeFetch(handler) {
  const calls = [];
  const f = async url => { calls.push(String(url)); const r = handler(new URL(url)); return { status: r.status || 200, text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body) }; };
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
  const a = new URL(dc.feedAddress(dc.pickFeed(feeds), { mediaId: 447289, page: 3, perPage: 500 }));
  assert.equal(a.searchParams.get('media_id'), '447289');
  assert.equal(a.searchParams.get('locale_id'), '6');
  assert.equal(a.searchParams.get('type'), 'JSON');
  assert.equal(a.searchParams.get('page'), '3');
  assert.equal(dc.pickFeed([{ id: 3 }]), null, 'a feed without an address is not used');
});

// A fake Daisycon: the sign-in, the API and the feed, on one address.
function fakeDaisycon({ refresh = 'R1', products = 3, rotate = 'R2' } = {}) {
  return fakeFetch(u => {
    if (u.pathname === '/oauth/access-token') return { body: { access_token: 'A1', refresh_token: rotate, expires_in: 3600 } };
    if (u.pathname === '/publishers') return { body: [{ id: 777 }] };
    if (u.pathname === '/publishers/777/productfeeds.v2/program') {
      const pid = u.searchParams.get('program_id');
      if (pid !== '16029') return { body: [] };
      return { body: [{ id: 5, url: 'https://daisycon.io/datafeed/?media_id=#MEDIA_ID#&program_id=16029&standard_id=2&language_code=en&locale_id=#LOCALE_ID#', language_code: 'en', locale_ids: [6], currency_code: 'EUR', products }] };
    }
    if (u.hostname === 'daisycon.io') {
      if (u.searchParams.get('media_id') !== '447289' || u.searchParams.get('locale_id') !== '6') return { status: 400, body: { error: 'Missing the following parameters: locale_id' } };
      const per = Number(u.searchParams.get('per_page'));
      const page = Number(u.searchParams.get('page'));
      const n = per === 2 ? 2 : (page === 1 ? Math.min(per, products) : Math.max(0, products - per));
      return { body: dcAnswer(Array.from({ length: n }, (_, i) => dcProduct((page - 1) * per + i + 1))) };
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
  assert.equal(A.withTracking, A.got);
  assert.deepEqual(A.currencies, ['EUR']);
  const text = gunzipSync(readFileSync(A.file)).toString('utf8');
  assert.ok(text.split('\n')[0].includes('aw_deep_link'));
  assert.equal(text.trim().split('\n').length, A.got + 1);
  assert.equal((await dc.main(['--mode', 'probe', '--media', 'x', '--programs', '1'], f, env)).error, 'wrong media id');
  assert.equal((await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '16029', '--base', 'https://evil.example'], f, env)).error, 'unexpected Daisycon address');
  const bad = fakeFetch(u => u.pathname === '/oauth/access-token' ? { status: 400, body: { error: 'invalid_grant' } } : { body: [] });
  const B = await dc.main(['--mode', 'probe', '--media', '447289', '--programs', '16029'], bad, env);
  assert.equal(B.signIn, true);
  assert.match(B.error, /invalid_grant/);
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
