// L161 (15 Nov 2026): CJ keyword searches. DHgate (CJ 3992613) has 6 million products, mostly in dollars, and its UK
// feed is empty, so a whole download is impossible and useless: tools/cj-feed.mjs --search reads only what CJ's keyword
// search finds (kids' winter boots), only in pounds, each product once, into CJ_<advertiser>_<search>.csv.gz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { run, productQuery, SEARCHES, SEARCH_COLUMNS, SEARCH_MAX, WHOLE_MAX, COLUMNS } from '../../tools/cj-feed.mjs';

const TOKEN = 'cjTestToken_' + 'search987654';
const API = 'http://127.0.0.1:9/query';
const t = (name, kind, ofType = null) => ({ name, kind, ofType });
const ARGS = ['companyId', 'partnerIds', 'limit', 'offset', 'lowPrice', 'highPrice', 'keywords', 'currency', 'serviceableAreas'];
const schemaWith = args => ({ queryType: { fields: [
  { name: 'shoppingProducts', args: args.map(name => ({ name, type: t(/Price$/.test(name) ? 'Float' : name === 'limit' || name === 'offset' ? 'Int' : 'String', 'SCALAR') })), type: t('ShoppingProducts', 'OBJECT') }
] } });
const TYPES = {
  ShoppingProducts: [{ name: 'totalCount', type: t('Int', 'SCALAR') }, { name: 'count', type: t('Int', 'SCALAR') },
    { name: 'resultList', type: t(null, 'LIST', t('ShoppingProduct', 'OBJECT')) }],
  ShoppingProduct: ['id', 'title', 'brand', 'link', 'imageLink', 'availability', 'advertiserId', 'advertiserName', 'itemGroupId', 'targetCountry', 'shipsFromCountry', 'ageGroup', 'gender']
    .map(name => ({ name, args: [], type: t('String', 'SCALAR') }))
    .concat([{ name: 'serviceableAreas', args: [], type: t(null, 'LIST', t('String', 'SCALAR')) },
      { name: 'price', args: [], type: t('Price', 'OBJECT') }, { name: 'linkCode', args: [{ name: 'pid' }], type: t('LinkCode', 'OBJECT') }]),
  Price: [{ name: 'amount', type: t('Float', 'SCALAR') }, { name: 'currency', type: t('String', 'SCALAR') }],
  LinkCode: [{ name: 'clickUrl', type: t('String', 'SCALAR') }]
};

const item = (i, title, currency = 'GBP', over = {}) => ({
  id: String(400000000 + i), title, brand: '', link: `http://www.dhgate.com/product/item-${i}/${400000000 + i}.html`, imageLink: `https://img.dhgate.com/${i}.jpg`,
  availability: 'in stock', advertiserId: '3992613', advertiserName: 'DHgate', itemGroupId: '', targetCountry: currency === 'GBP' ? 'GB' : 'US',
  serviceableAreas: currency === 'GBP' ? ['GB'] : ['US'], shipsFromCountry: 'CN', ageGroup: 'kids', gender: 'unisex',
  price: { amount: 10 + i, currency }, linkCode: { clickUrl: `https://www.jdoqocy.com/click-101917444-1?url=${i}` }, ...over
});

// A fake CJ: keywords = every word in the title (the strict reading), currency and serviceableAreas filter, price bands.
function fakeCj({ products, args = ARGS, total = null }) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const q = JSON.parse(init.body).query;
    calls.push(q);
    const json = x => ({ status: 200, text: async () => JSON.stringify(x) });
    if (init.headers.authorization !== `Bearer ${TOKEN}`) return { status: 401, text: async () => '{"errors":[{"message":"Unauthorized"}]}' };
    if (q.includes('__schema')) return json({ data: { __schema: schemaWith(args) } });
    const ty = /__type\(name: "(\w+)"\)/.exec(q);
    if (ty) return json({ data: { __type: TYPES[ty[1]] ? { fields: TYPES[ty[1]] } : null } });
    const str = k => { const m = new RegExp(`${k}: "((?:[^"\\\\]|\\\\.)*)"`).exec(q); return m ? JSON.parse(`"${m[1]}"`) : ''; };
    const num = k => { const m = new RegExp(`${k}: ([\\d.]+)`).exec(q); return m ? Number(m[1]) : null; };
    const kw = str('keywords'), cur = str('currency'), area = str('serviceableAreas'), lo = num('lowPrice'), hi = num('highPrice');
    const limit = num('limit') ?? 1000, offset = num('offset') ?? 0;
    const list = products.filter(p => (!kw || kw.toLowerCase().split(/\s+/).every(w => p.title.toLowerCase().includes(w)))
      && (!cur || p.price.currency === cur) && (!area || p.serviceableAreas.includes(area))
      && (lo === null || p.price.amount >= lo) && (hi === null || p.price.amount <= hi));
    const n = total !== null && !kw ? total : list.length;
    return json({ data: { shoppingProducts: { totalCount: n, count: Math.min(limit, list.length), resultList: list.slice(offset, offset + limit) } } });
  };
  return { fetchImpl, calls };
}

const CATALOGUE = [
  item(1, 'Kids Snow Boots Winter Warm Plush Boys Girls'),
  item(2, 'Girls Snow Boots Waterproof Faux Fur'),
  item(3, 'Kids Snow Boots Children Thermal', 'USD'),
  item(4, 'Toddler Winter Boots Baby First Walkers'),
  item(5, 'Kids Rain Boots Wellies Frog Print'),
  item(6, 'Glass Bongs Water Pipe', 'GBP'),
  item(7, 'Children Snow Boots Kids Winter Warm')
];
const base = { cids: ['7806395'], pid: '101917444', advertisers: ['3992613'], token: TOKEN, api: API, pauseMs: 0 };

test('L161: the search is written down, in pounds, and its file columns say where each product is sold and why it came', () => {
  const s = SEARCHES['kids-winter-boots'];
  assert.equal(s.currency, 'GBP');
  assert.ok(s.keywords.includes('kids snow boots') && s.keywords.includes('kids wellies'));
  assert.ok(s.keywords.every(k => /^[a-z ]{5,40}$/.test(k)), 'plain words only');
  for (const c of ['target_country', 'serviceable_areas', 'ships_from', 'age_group', 'search_keyword']) assert.ok(SEARCH_COLUMNS.includes(c), c);
  assert.ok(SEARCH_MAX <= 20000 && WHOLE_MAX < 6000000);
});

test('L161: the query quotes the search words safely and asks for them only when the API has the argument', () => {
  const shape = { qname: 'shoppingProducts', args: ARGS, argTypes: {}, outer: ['totalCount'], fields: [{ name: 'id', args: [] }, { name: 'targetCountry', args: [] }], sub: {} };
  const q = productQuery({ shape, cid: '1', advertiser: '3992613', extra: { keywords: 'kids "snow" boots\n', currency: 'GBP' }, more: ['targetCountry'] });
  assert.match(q, /keywords: "kids \\"snow\\" boots "/);
  assert.match(q, /currency: "GBP"/);
  assert.match(q, /resultList \{ id targetCountry \}/);
  assert.doesNotMatch(productQuery({ shape, cid: '1', advertiser: '2' }), /targetCountry|keywords/, 'a normal download asks for no extra field and no search');
  const old = { ...shape, args: ['companyId', 'partnerIds', 'limit', 'offset'] };
  assert.doesNotMatch(productQuery({ shape: old, cid: '1', advertiser: '2', extra: { keywords: 'x', currency: 'GBP' } }), /keywords|currency/);
});

test('L161: the read-only look counts each keyword in any currency, in pounds and with UK delivery, with samples', async () => {
  const cj = fakeCj({ products: CATALOGUE });
  const out = mkdtempSync(join(tmpdir(), 'gw-cjs-'));
  const S = await run({ ...base, mode: 'probe', out, fetchImpl: cj.fetchImpl, search: 'kids-winter-boots' });
  assert.equal(S.error, undefined, JSON.stringify(S));
  assert.equal(S.search, 'kids-winter-boots');
  const A = S.advertisers[0];
  assert.equal(A.ok, true, A.error);
  const kids = A.searches.find(x => x.keyword === 'kids snow boots');
  assert.deepEqual([kids.all, kids.inCurrency, kids.inArea], [3, 2, 2], 'item 3 is in dollars');
  assert.equal(A.searches.find(x => x.keyword === 'kids wellies').inCurrency, 1);
  assert.ok(A.total >= 5);
  assert.ok(A.samples.length >= 1 && A.samples.every(x => x.currency === 'GBP' && x.target === 'GB' && x.areas === 'GB' && x.keyword === 'kids snow boots'));
  assert.equal(readdirSync(out).length, 0, 'the look writes nothing');
  const asks = cj.calls.filter(q => q.includes('shoppingProducts('));
  assert.match(asks[0], /limit: 1[,)]/, 'only the account check (one product) has no keywords');
  assert.ok(asks.slice(1).every(q => q.includes('keywords: "')), 'never a search without keywords');
});

test('L161: the download keeps only pound products of the keywords, each once, in its own file', async () => {
  const cj = fakeCj({ products: CATALOGUE });
  const out = mkdtempSync(join(tmpdir(), 'gw-cjs-'));
  const S = await run({ ...base, mode: 'download', out, fetchImpl: cj.fetchImpl, search: 'kids-winter-boots' });
  const A = S.advertisers[0];
  assert.equal(A.ok, true, A.error);
  assert.equal(readdirSync(out).join(), 'CJ_3992613_kids-winter-boots.csv.gz.part');
  const text = gunzipSync(readFileSync(join(out, 'CJ_3992613_kids-winter-boots.csv.gz.part'))).toString('utf8').trim().split('\n');
  assert.equal(text[0], COLUMNS.concat(SEARCH_COLUMNS).map(c => `"${c}"`).join(','));
  const ids = text.slice(1).map(l => l.split('","')[3]);
  assert.deepEqual(ids.sort(), ['400000001', '400000002', '400000004', '400000005', '400000007'], 'no dollars, no bongs, no product twice');
  assert.equal(A.got, 5);
  assert.ok(text.slice(1).every(l => l.includes('"GBP"')));
  assert.ok(text[1].includes('"kids snow boots"') || text.some(l => l.includes('"kids snow boots"')), 'the keyword that found it');
  const asks = cj.calls.filter(q => q.includes('shoppingProducts('));
  assert.match(asks[0], /limit: 1[,)]/, 'only the account check (one product) has no keywords');
  assert.ok(asks.slice(1).every(q => q.includes('keywords: "') && q.includes('currency: "GBP"')));
  assert.ok(!JSON.stringify(S).includes(TOKEN));
});

test('L161: a keyword that finds too much is left out; an unknown search, or an API without keyword search, reads nothing', async () => {
  const many = Array.from({ length: 30 }, (_, i) => item(100 + i, `Kids Snow Boots Model ${i}`));
  const cj = fakeCj({ products: many });
  const out = mkdtempSync(join(tmpdir(), 'gw-cjs-'));
  const S = await run({ ...base, mode: 'download', out, fetchImpl: cj.fetchImpl, search: 'kids-winter-boots', searchMax: 20 });
  const kids = S.advertisers[0].searches.find(x => x.keyword === 'kids snow boots');
  assert.equal(kids.tooBroad, true);
  assert.equal(kids.got, 0);
  assert.equal(S.advertisers[0].error, 'no products');
  assert.equal(readdirSync(out).length, 0);
  for (const bad of ['nope', '__proto__', 'constructor']) {
    const B = await run({ ...base, mode: 'download', out, fetchImpl: fakeCj({ products: many }).fetchImpl, search: bad });
    assert.match(B.error, /unknown search/, bad);
  }
  const noKw = fakeCj({ products: many, args: ['companyId', 'partnerIds', 'limit', 'offset', 'lowPrice', 'highPrice', 'currency'] });
  const C = await run({ ...base, mode: 'download', out, fetchImpl: noKw.fetchImpl, search: 'kids-winter-boots' });
  assert.equal(C.error, 'the CJ API has no keyword search (keywords)');
  assert.ok(!noKw.calls.some(q => q.includes('shoppingProducts(')), 'not one product request');
  assert.equal(readdirSync(out).length, 0);
});

test('L161: a whole download of a catalogue with millions of products is refused', async () => {
  const cj = fakeCj({ products: CATALOGUE, total: 6024540 });
  const out = mkdtempSync(join(tmpdir(), 'gw-cjs-'));
  const S = await run({ ...base, mode: 'download', out, fetchImpl: cj.fetchImpl });
  assert.match(S.advertisers[0].error, /too big \(6024540 products\): only a search/);
  assert.equal(readdirSync(out).length, 0);
  assert.ok(cj.calls.filter(q => q.includes('shoppingProducts(')).length <= 2, 'stops after counting');
});
