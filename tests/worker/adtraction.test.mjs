// Adtraction (UK programmes of 23 Nov 2026, massive import wave 1, lessons L221): the click, the feed row in the Awin
// column names, the programme list and the download into ADTRACTION_<programme>.csv.gz (old copy kept, cut answer refused).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NETWORKS, isAdtractionLink, adtractionLink, pageInLink } from '../../tools/network-links.mjs';
import { toAwinRow, programs, downloadProgramme, isToken } from '../../tools/adtraction-feed.mjs';
import { feedOf, parseNetworks } from '../../tools/feed-profile.mjs';

const TOKEN = 'TEST' + 'TOKEN0123456789ABCDEF';

test('L221: an Adtraction click is /t/t with a= and as=; with our channel only ours', () => {
  const l = adtractionLink(1500, 12345, 'https://www.livingchic.co.uk/sofa?x=1');
  assert.equal(l, 'https://track.adtraction.com/t/t?a=1500&as=12345&t=2&tk=1&url=https%3A%2F%2Fwww.livingchic.co.uk%2Fsofa%3Fx%3D1');
  assert.equal(isAdtractionLink(l), true);
  assert.equal(isAdtractionLink(l, '12345'), true);
  assert.equal(isAdtractionLink(l, '99999'), false, 'another partner\'s click does not pay us');
  assert.equal(isAdtractionLink('https://at.livingchic.co.uk/t/t?a=1500&as=12345&t=2&tk=1&url=https%3A%2F%2Fx'), true, 'a shop\'s own tracking domain');
  assert.equal(isAdtractionLink('http://track.adtraction.com/t/t?a=1500&as=12345'), false, 'https only');
  assert.equal(isAdtractionLink('https://www.livingchic.co.uk/t/t'), false);
  assert.equal(pageInLink(l), 'https://www.livingchic.co.uk/sofa?x=1');
  assert.deepEqual([NETWORKS.adtraction.file, NETWORKS.adtraction.idPrefix], ['ADTRACTION', 'at']);
  assert.deepEqual(feedOf('ADTRACTION_1500.csv.gz'), { network: 'Adtraction', advertiserId: 1500, feedId: null, part: '' });
  assert.deepEqual(parseNetworks('adtraction, linkwise'), ['Adtraction', 'Linkwise']);
  assert.equal(isToken(TOKEN), true);
  assert.equal(isToken('short'), false);
});

test('L221: one JSON product -> one Awin row; the feed\'s click when it is ours, else the standard deep link', () => {
  const p = { productName: 'Lisbon 3 Seater Sofa', productPrice: 499, oldPrice: '649.00', currency: 'GBP', productUrl: 'https://www.livingchic.co.uk/lisbon',
    trackingUrl: '', imageUrl: 'https://img.livingchic.co.uk/1.jpg', inStock: true, ean: '5060000000001', sku: 'LS-3', manufacturer: 'Living Chic',
    productCategory: 'Furniture > Sofas', productDescription: 'A sofa' };
  const { row, built } = toAwinRow(p, 1500, '12345');
  assert.equal(built, true);
  assert.equal(row.aw_deep_link, adtractionLink(1500, '12345', 'https://www.livingchic.co.uk/lisbon'));
  assert.equal(row.aw_product_id, 'at1500-LS-3');
  assert.deepEqual([row.search_price, row.rrp_price, row.currency, row.in_stock, row.merchant_category], ['499.00', '649.00', 'GBP', '1', 'Furniture > Sofas']);
  const own = toAwinRow({ ...p, trackingUrl: 'https://at.livingchic.co.uk/t/t?a=1500&as=12345&t=2&tk=1&url=x' }, 1500, '12345');
  assert.equal(own.built, false);
  const other = toAwinRow({ ...p, trackingUrl: 'https://track.adtraction.com/t/t?a=1500&as=777&t=2&tk=1&url=x' }, 1500, '12345');
  assert.match(other.row.aw_deep_link, /as=12345/, 'someone else\'s channel is replaced by ours');
  assert.equal(toAwinRow({ ...p, productUrl: 'http://x', trackingUrl: '' }, 1500, '12345').row.aw_deep_link, '', 'no https page, no link');
  assert.equal(toAwinRow({ ...p, inStock: 'false', oldPrice: 100 }, 1500, '12345').row.in_stock, '0');
  assert.equal(toAwinRow({ ...p, oldPrice: 100 }, 1500, '12345').row.rrp_price, '', 'an old price below the price is not shown');
});

const fakeFetch = (handler) => async (url, init) => {
  const body = init && init.body ? JSON.parse(init.body) : null;
  if (init.headers['X-Token'] !== TOKEN) return new Response('{"error":"token"}', { status: 401 });
  const r = handler(new URL(url).pathname, body);
  return new Response(JSON.stringify(r.json), { status: r.status || 200 });
};

test('L221: the approved programmes of a channel, with their feeds', async () => {
  const fetchImpl = fakeFetch((path, body) => {
    assert.equal(path, '/v3/partner/programs/');
    assert.deepEqual(body, { market: 'GB', channelId: 12345, approvalStatus: 1 });
    return { json: [{ programId: 1500, programName: 'Living Chic', market: 'GB', currency: 'GBP', approvalStatus: 1, feeds: [{ feedId: 7, name: 'Main', numberOfProducts: 420, lastUpdated: '2026-11-23T05:00:00Z' }] }] };
  });
  const r = await programs({ token: TOKEN, channel: '12345', market: 'GB', fetchImpl });
  assert.equal(r.ok, true);
  assert.deepEqual([r.list[0].programId, r.list[0].name, r.list[0].currency, r.list[0].feeds[0].products], ['1500', 'Living Chic', 'GBP', 420]);
  const bad = await programs({ token: 'WRONG' + 'TOKEN0123456789ABCD', channel: '12345', market: 'GB', fetchImpl });
  assert.equal(bad.ok, false);
  assert.equal(bad.status, 401);
});

test('L221: the download writes ADTRACTION_<programme>.csv.gz, keeps the old copy, refuses a cut answer', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'at-'));
  let n = 150;
  const fetchImpl = fakeFetch((path, body) => {
    assert.equal(path, '/v3/partner/products/feed/');
    assert.deepEqual(body, { programId: 1500, channelId: 12345 });
    return { json: Array.from({ length: n }, (_, i) => ({ productName: `Sofa ${i}`, productPrice: 100 + i, currency: 'GBP', productUrl: `https://www.livingchic.co.uk/p${i}`, inStock: 1, sku: `S${i}` })) };
  });
  const r = await downloadProgramme({ token: TOKEN, programId: '1500', channel: '12345', archive: dir, stamp: 'A', fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.rows, 150);
  assert.equal(r.built, 150);
  const text = gunzipSync(readFileSync(join(dir, 'ADTRACTION_1500.csv.gz'))).toString('utf8');
  assert.match(text.split('\n')[0], /aw_deep_link/);
  assert.match(text, /track\.adtraction\.com\/t\/t\?a=1500&as=12345/);
  assert.equal(text.includes(TOKEN), false, 'the token is never written into a feed');
  n = 140;
  assert.equal((await downloadProgramme({ token: TOKEN, programId: '1500', channel: '12345', archive: dir, stamp: 'B', fetchImpl })).ok, true);
  assert.equal(existsSync(join(dir, '_old', 'B', 'ADTRACTION_1500.csv.gz')), true, 'old copy moved first');
  n = 20;
  const cut = await downloadProgramme({ token: TOKEN, programId: '1500', channel: '12345', archive: dir, stamp: 'C', fetchImpl });
  assert.equal(cut.ok, false);
  assert.match(cut.why, /kept the old copy/);
  n = 0;
  assert.match((await downloadProgramme({ token: TOKEN, programId: '1500', channel: '12345', archive: dir, stamp: 'D', fetchImpl })).why, /empty feed/);
  const err = await downloadProgramme({ token: TOKEN, programId: '1500', channel: '12345', archive: dir, stamp: 'E', fetchImpl: fakeFetch(() => ({ status: 500, json: { e: 1 } })) });
  assert.match(err.why, /HTTP 500/);
});
