// L86: CJ Affiliate catalogues (first shop XPLORA UK, 31 Oct 2026): a fake CJ API, the feed file in Awin column
// names, the import plan with the CJ tracking link as the card's link, and the token never in the output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { run, toFeedRow, productQuery, isCjLink, makeMask, COLUMNS, FEED_MAX_PAGES, fetchAll, splitPoint, priceLiteral, OFFSET_CAP } from '../../tools/cj-feed.mjs';
import { planLegacyImport } from '../../tools/legacy-import-plan.mjs';
import { classify, RULES } from '../../tools/import-rules/xplora.mjs';
import { planMembership, renderMembershipReport } from '../../tools/awin-membership-plan.mjs';

const TOKEN = 'cjTestToken_' + 'abcdef123456';
const API = 'http://127.0.0.1:9/query';

const t = (name, kind, ofType = null) => ({ name, kind, ofType });
const SCHEMA = {
  queryType: { fields: [
    { name: 'shoppingProducts', args: [{ name: 'companyId' }, { name: 'partnerIds' }, { name: 'limit' }, { name: 'offset' }], type: t('ShoppingProducts', 'OBJECT') },
    { name: 'shoppingProductFeeds', args: [{ name: 'companyId' }], type: t('ShoppingProductFeeds', 'OBJECT') },
    { name: 'travelExperienceProducts', args: [{ name: 'companyId' }], type: t('Travel', 'OBJECT') }
  ] }
};
const TYPES = {
  ShoppingProducts: [{ name: 'totalCount', type: t('Int', 'SCALAR') }, { name: 'count', type: t('Int', 'SCALAR') },
    { name: 'resultList', type: t(null, 'NON_NULL', t(null, 'LIST', t('ShoppingProduct', 'OBJECT'))) }],
  ShoppingProduct: ['id', 'title', 'brand', 'link', 'imageLink', 'availability', 'gtin', 'advertiserId', 'advertiserName', 'itemGroupId']
    .map(name => ({ name, args: [], type: t('String', 'SCALAR') }))
    .concat([{ name: 'productType', args: [], type: t(null, 'LIST', t('String', 'SCALAR')) },
      { name: 'price', args: [], type: t('Price', 'OBJECT') }, { name: 'salePrice', args: [], type: t('Price', 'OBJECT') },
      { name: 'linkCode', args: [{ name: 'pid' }], type: t('LinkCode', 'OBJECT') }]),
  Price: [{ name: 'amount', type: t('Float', 'SCALAR') }, { name: 'currency', type: t('String', 'SCALAR') }],
  LinkCode: [{ name: 'clickUrl', type: t('String', 'SCALAR') }],
  ShoppingProductFeeds: [{ name: 'totalCount', type: t('Int', 'SCALAR') }, { name: 'resultList', type: t(null, 'LIST', t('Feed', 'OBJECT')) }],
  Feed: ['advertiserId', 'advertiserName', 'feedName', 'productCount', 'currency'].map(name => ({ name, args: [], type: t('String', 'SCALAR') }))
};

const product = (i, over = {}) => ({
  id: `XP-${i}`, title: `Xplora X6Play Kids Smartwatch Phone ${i}`, brand: 'Xplora', link: `https://xplora.co.uk/products/x6play-${i}`,
  imageLink: `https://cdn.shopify.com/x6play-${i}.png`, availability: 'in stock', gtin: '5712345678901', advertiserId: '5175167', advertiserName: 'XPLORA UK',
  itemGroupId: '', productType: ['Smartwatches'], price: { amount: 149.99, currency: 'GBP' }, salePrice: { amount: 129.99, currency: 'GBP' },
  linkCode: { clickUrl: `https://www.anrdoezrs.net/click-101917444-15678?url=https%3A%2F%2Fxplora.co.uk%2Fproducts%2Fx6play-${i}` }, ...over
});

// A fake CJ API: introspection, a CID that it refuses, products paged by offset. cap: CJ's "Cannot page past 10,000
// records" (offset + limit); lowPrice/highPrice filter the products when the query has them (lessons L129).
function fakeCj({ products, goodCid = '7806395', cap = Infinity, schema = SCHEMA }) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    const q = body.query;
    calls.push({ url, q, auth: init.headers.authorization });
    const json = x => ({ status: 200, text: async () => JSON.stringify(x) });
    if (init.headers.authorization !== `Bearer ${TOKEN}`) return { status: 401, text: async () => '{"errors":[{"message":"Unauthorized"}]}' };
    if (q.includes('__schema')) return json({ data: { __schema: schema } });
    const ty = /__type\(name: "(\w+)"\)/.exec(q);
    if (ty) return json({ data: { __type: TYPES[ty[1]] ? { fields: TYPES[ty[1]] } : null } });
    const cid = (/companyId: "(\d+)"/.exec(q) || [])[1];
    if (cid !== goodCid) return json({ errors: [{ message: `Not authorized for company ${cid}` }] });
    if (q.includes('shoppingProductFeeds')) return json({ data: { shoppingProductFeeds: { totalCount: 1, resultList: [{ advertiserId: '5175167', advertiserName: 'XPLORA UK', feedName: 'UK feed', productCount: String(products.length), currency: 'GBP' },
      { advertiserId: '3773223', advertiserName: 'SHEIN', feedName: 'FR', productCount: '9', currency: 'EUR' }] } } });
    const limit = Number((/limit: (\d+)/.exec(q) || [])[1] || 1000);
    const offset = Number((/offset: (\d+)/.exec(q) || [])[1] || 0);
    if (offset + limit > cap) return { status: 400, text: async () => JSON.stringify({ errors: [{ message: `Cannot page past ${cap} records. The limit and offset parameters may not add up to be greater than ${cap}.` }] }) };
    const lo = /lowPrice: ([\d.]+)/.exec(q);
    const hi = /highPrice: ([\d.]+)/.exec(q);
    const list = products.filter(p => (!lo || p.price.amount >= Number(lo[1])) && (!hi || p.price.amount <= Number(hi[1])));
    return json({ data: { shoppingProducts: { totalCount: list.length, count: Math.max(0, Math.min(limit, list.length - offset)), resultList: list.slice(offset, offset + limit) } } });
  };
  return { fetchImpl, calls };
}

test('L86: probe is read-only, finds the CID that works and shows samples with the CJ link', async () => {
  const cj = fakeCj({ products: [product(1), product(2)] });
  const S = await run({ mode: 'probe', cids: ['8114224', '7806395'], pid: '101917444', advertisers: ['5175167'], token: TOKEN, api: API, fetchImpl: cj.fetchImpl, pauseMs: 0 });
  assert.equal(S.ok, true, JSON.stringify(S));
  assert.equal(S.cid, '7806395');
  assert.match(S.cidTried[0].error, /Not authorized/);
  assert.deepEqual(S.queries, ['shoppingProducts', 'shoppingProductFeeds', 'travelExperienceProducts']);
  assert.equal(S.feeds.length, 1, 'only the feeds of the chosen advertisers');
  assert.equal(S.feeds[0].advertiserName, 'XPLORA UK');
  assert.equal(S.feedsTotal, 2);
  assert.equal(S.advertisers[0].total, 2);
  assert.equal(S.advertisers[0].samples[0].tracking, 'www.anrdoezrs.net');
  assert.equal(S.advertisers[0].samples[0].price, '129.99', 'the lower sale price');
  const q = cj.calls.find(c => c.q.includes('linkCode')).q;
  assert.match(q, /linkCode\(pid: "101917444"\) \{ clickUrl \}/);
  assert.match(q, /price \{ amount currency \}/);
  assert.ok(!JSON.stringify(S).includes(TOKEN), 'the token is never in the summary');
});

test('L86: download pages through 1,000 at a time and writes the feed in Awin column names', async () => {
  const many = Array.from({ length: 1003 }, (_, i) => product(i + 1));
  const cj = fakeCj({ products: many });
  const out = mkdtempSync(join(tmpdir(), 'cj-'));
  const S = await run({ mode: 'download', cids: ['7806395'], pid: '101917444', advertisers: ['5175167'], out, token: TOKEN, api: API, fetchImpl: cj.fetchImpl, pauseMs: 0 });
  assert.equal(S.ok, true, JSON.stringify(S));
  assert.equal(S.advertisers[0].got, 1003);
  assert.equal(S.advertisers[0].withTracking, 1003);
  assert.deepEqual(S.advertisers[0].currencies, ['GBP']);
  assert.deepEqual(readdirSync(out), ['CJ_5175167.csv.gz.part']);
  const text = gunzipSync(readFileSync(join(out, 'CJ_5175167.csv.gz.part'))).toString('utf8');
  const lines = text.trim().split('\n');
  assert.equal(lines.length, 1004);
  assert.equal(lines[0], COLUMNS.map(c => `"${c}"`).join(','));
  assert.ok(cj.calls.some(c => /offset: 1000/.test(c.q)), 'second page asked');
});

test('L86: a wrong token or a foreign API address never sends the token anywhere else', async () => {
  const cj = fakeCj({ products: [product(1)] });
  const bad = await run({ mode: 'probe', cids: ['7806395'], pid: '1', advertisers: ['5175167'], token: 'wrongToken_123', api: API, fetchImpl: cj.fetchImpl, pauseMs: 0 });
  assert.equal(bad.ok, false);
  const before = cj.calls.length;
  const away = await run({ mode: 'probe', cids: ['7806395'], pid: '1', advertisers: ['5175167'], token: TOKEN, api: 'https://evil.example.com/query', fetchImpl: cj.fetchImpl, pauseMs: 0 });
  assert.equal(away.error, 'unexpected API address');
  assert.equal(cj.calls.length, before, 'no call made');
  assert.equal(makeMask(TOKEN)(`x ${TOKEN} Bearer abc.def`), 'x *** Bearer ***');
});

test('L86: one CJ product as a feed row; CJ link hosts', () => {
  const r = toFeedRow(product(7, { availability: 'out_of_stock', salePrice: null, linkCode: { clickUrl: 'https://xplora.co.uk/no-tracking' } }));
  assert.equal(r.in_stock, '0');
  assert.equal(r.search_price, '149.99');
  assert.equal(r.aw_deep_link, '', 'a link that is not CJ is not kept as the tracking link');
  assert.equal(r.merchant_category, 'Smartwatches');
  for (const u of ['https://www.anrdoezrs.net/click-1-2', 'http://www.dpbolvw.net/click-1-2', 'https://www.kqzyfj.com/x', 'https://www.jdoqocy.com/x', 'https://www.tkqlhce.com/x'])
    assert.ok(isCjLink(u), u);
  for (const u of ['https://xplora.co.uk/', 'https://anrdoezrs.net.evil.com/', 'javascript:alert(1)', '']) assert.ok(!isCjLink(u), u);
  const q = productQuery({ shape: null, cid: '7806395', pid: '101917444', advertiser: '5175167', limit: 5 });
  assert.match(q, /^\{ shoppingProducts\(companyId: "7806395", partnerIds: \["5175167"\], limit: 5, offset: 0\)/);
});

test('L86: XPLORA rules: watches and accessories into the Kids Tech places KGW has; services out', () => {
  const place = (name, cat = '') => { const c = classify({ name, feedCategory: cat }); return c.reject ? 'out' : `${c.siteCategory}/${c.subcategory}${c.doubt ? ' (doubt)' : ''}`; };
  assert.equal(place('Xplora X6Play Kids Smartwatch Phone - Blue'), 'Kids Tech/Kids Smartwatches');
  assert.equal(place('XPLORA XGO3 Watch Phone for Kids'), 'Kids Tech/Kids Smartwatches');
  assert.equal(place('Xplora X5 Play - Black'), 'Kids Tech/Kids Smartwatches');
  assert.equal(place('Silicone Strap for X6Play - Pink'), 'Kids Tech/Kids Tech');
  assert.equal(place('X6Play Magnetic Charging Cable'), 'Kids Tech/Kids Tech');
  assert.equal(place('Xplora XJR with strap bundle'), 'Kids Tech/Kids Smartwatches');
  assert.equal(place('Limited Edition Blue', 'Wearables > Smartwatches'), 'Kids Tech/Kids Smartwatches (doubt)');
  // First real download (31 Oct 2026): two models named without a product word.
  assert.equal(place('XploraOne', 'Active Product'), 'Kids Tech/Kids Tech');
  assert.equal(place('HMD Fusion X1', 'Active Product'), 'Kids Tech/Kids Tech');
  for (const n of ['Xplora Pay As You Go SIM Card', 'Xplora Gift Card £50', '12 Month Extended Warranty', 'Mystery thing'])
    assert.equal(place(n), 'out', n);
  assert.equal(RULES.network, 'cj');
  assert.equal(RULES.advertiserId, 5175167);
  assert.ok(RULES.shop.test('https://xplora.co.uk/products/x6play'));
});

test('L86: the import plan reads CJ_<id>.csv.gz and puts the CJ tracking link on the card', async () => {
  const cj = fakeCj({ products: [product(1), product(2, { linkCode: null }), product(3, { title: 'Xplora SIM Card', id: 'XP-3' }),
    product(4, { link: 'https://www.amazon.co.uk/x6play' })] });
  const archive = mkdtempSync(join(tmpdir(), 'cjarch-'));
  writeFileSync(join(archive, 'AWIN_30645_1.csv.gz'), '');
  const S = await run({ mode: 'download', cids: ['7806395'], pid: '101917444', advertisers: ['5175167'], out: archive, token: TOKEN, api: API, fetchImpl: cj.fetchImpl, pauseMs: 0 });
  assert.equal(S.ok, true);
  const { renameSync } = await import('node:fs');
  renameSync(join(archive, 'CJ_5175167.csv.gz.part'), join(archive, 'CJ_5175167.csv.gz'));
  const out = mkdtempSync(join(tmpdir(), 'cjplan-'));
  const r = await planLegacyImport({ archive, retailer: 'xplora', outDir: out, now: new Date('2026-10-31T13:00:00Z') });
  assert.deepEqual(r.files, ['CJ_5175167.csv.gz']);
  assert.equal(r.accepted.kgw.length, 1, JSON.stringify(r.rejected ? Object.keys(r.rejected) : r));
  const p = r.accepted.kgw[0];
  assert.equal(p.affiliate_url, product(1).linkCode.clickUrl);
  assert.equal(p.awin_product_id, 'cj5175167:x6play-1');
  assert.equal(p.price, 129.99);
  assert.equal(p.subcategory, 'Kids Smartwatches');
  const reasons = Object.keys(r.rejected).join(' | ');
  assert.match(reasons, /no CJ tracking link/);
  assert.match(reasons, /service/);
  assert.match(reasons, /not the shop's own page/);
  const text = readFileSync(join(out, 'report.txt'), 'utf8');
  assert.match(text, /XPLORA UK - CJ 5175167/);
  const sql = readdirSync(join(out, 'sql', 'kgw')).map(f => readFileSync(join(out, 'sql', 'kgw', f), 'utf8')).join('');
  assert.ok(sql.includes('anrdoezrs.net') && !sql.includes('awin1.com'), 'the SQL has the CJ link, no Awin link');
});

test('L86: the Awin membership check lists CJ shops apart (they pay through CJ)', () => {
  const plan = planMembership({ sites: [{ site: 'kgw', rows: [{ retailer: 'XPLORA UK', n: 12, link: 'https://www.anrdoezrs.net/click-1-2', bad: 0 }] }], list: [] });
  assert.equal(plan.cj.length, 1);
  assert.equal(plan.plain.length, 0);
  assert.match(renderMembershipReport(plan), /Μέσω CJ \(όχι Awin\)[\s\S]*KGW: XPLORA UK \(12\)/);
});

test('L96: list mode pages through every CJ feed (also of shops that never accepted us), downloads nothing', async () => {
  // The first real run stopped at exactly 500 feeds (one page): with "limit" and "offset" the list goes on page by page.
  const feeds = Array.from({ length: 503 }, (_, i) => ({ advertiserId: String(7000000 + i), advertiserName: `Shop ${i}`, feedName: 'UK', productCount: String(i), currency: i % 2 ? 'GBP' : 'USD' }));
  const schema = { queryType: { fields: SCHEMA.queryType.fields.map(f => f.name === 'shoppingProductFeeds'
    ? { ...f, args: [{ name: 'companyId' }, { name: 'limit' }, { name: 'offset' }] } : f) } };
  const calls = [];
  const fetchImpl = async (url, init) => {
    const q = JSON.parse(init.body).query;
    calls.push(q);
    const json = x => ({ status: 200, text: async () => JSON.stringify(x) });
    if (q.includes('__schema')) return json({ data: { __schema: schema } });
    const ty = /__type\(name: "(\w+)"\)/.exec(q);
    if (ty) return json({ data: { __type: TYPES[ty[1]] ? { fields: TYPES[ty[1]] } : null } });
    if (q.includes('shoppingProductFeeds')) {
      const limit = Number((/limit: (\d+)/.exec(q) || [])[1] || 500);
      const offset = Number((/offset: (\d+)/.exec(q) || [])[1] || 0);
      return json({ data: { shoppingProductFeeds: { totalCount: feeds.length, resultList: feeds.slice(offset, offset + limit) } } });
    }
    return json({ data: { shoppingProducts: { totalCount: 0, count: 0, resultList: [] } } });
  };
  const out = mkdtempSync(join(tmpdir(), 'cj-list-'));
  const S = await run({ mode: 'list', cids: ['7806395'], pid: '101917444', advertisers: ['5175167'], out, token: TOKEN, api: API, fetchImpl, pauseMs: 0 });
  assert.equal(S.ok, true);
  assert.equal(S.feedsTotal, 503);
  assert.equal(S.feeds.length, 503, 'list mode keeps every feed, not only the chosen shops');
  assert.ok(calls.some(q => /shoppingProductFeeds\(companyId: "7806395", limit: 500, offset: 500\)/.test(q)), 'second page asked');
  assert.equal(S.advertisers.length, 0, 'no product query per shop in list mode');
  assert.deepEqual(readdirSync(out), [], 'nothing written');
  assert.doesNotMatch(JSON.stringify(S), new RegExp(TOKEN));
});

test('L96: the feed list stops at CJ\'s own total, and says when the page cap cut it (second run stopped at 10,000)', async () => {
  const schema = { queryType: { fields: SCHEMA.queryType.fields.map(f => f.name === 'shoppingProductFeeds'
    ? { ...f, args: [{ name: 'companyId' }, { name: 'limit' }, { name: 'offset' }] } : f) } };
  const mk = total => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      const q = JSON.parse(init.body).query;
      const json = x => ({ status: 200, text: async () => JSON.stringify(x) });
      if (q.includes('__schema')) return json({ data: { __schema: schema } });
      const ty = /__type\(name: "(\w+)"\)/.exec(q);
      if (ty) return json({ data: { __type: TYPES[ty[1]] ? { fields: TYPES[ty[1]] } : null } });
      if (q.includes('shoppingProductFeeds')) {
        calls.push(q);
        const offset = Number((/offset: (\d+)/.exec(q) || [])[1] || 0);
        // Always a full page: only CJ's total (or the cap) can stop the loop.
        const resultList = Array.from({ length: 500 }, (_, i) => ({ advertiserId: String(offset + i), feedName: 'UK', productCount: '1', currency: 'GBP' }));
        return json({ data: { shoppingProductFeeds: { totalCount: total, resultList } } });
      }
      return json({ data: { shoppingProducts: { totalCount: 0, count: 0, resultList: [] } } });
    };
    return { calls, fetchImpl };
  };
  const a = mk(1000);
  const S = await run({ mode: 'list', cids: ['7806395'], pid: '101917444', advertisers: [], out: mkdtempSync(join(tmpdir(), 'cj-list-')), token: TOKEN, api: API, fetchImpl: a.fetchImpl, pauseMs: 0 });
  assert.equal(a.calls.length, 2, 'stops when totalCount is reached, no empty third page');
  assert.equal(S.feedsTotal, 1000);
  assert.equal(S.feedsApiTotal, 1000);
  assert.equal(S.feedsCapped, undefined);
  const b = mk(null);
  const T = await run({ mode: 'list', cids: ['7806395'], pid: '101917444', advertisers: [], out: mkdtempSync(join(tmpdir(), 'cj-list-')), token: TOKEN, api: API, fetchImpl: b.fetchImpl, pauseMs: 0 });
  assert.equal(b.calls.length, FEED_MAX_PAGES, 'no total from CJ: the page cap ends the loop');
  assert.equal(T.feedsTotal, FEED_MAX_PAGES * 500);
  assert.ok(FEED_MAX_PAGES * 500 > 10000, 'the cap is above the 10,000 of the second run');
  assert.equal(T.feedsCapped, true, 'the report can warn that the list was cut');
  assert.equal(T.feedsApiTotal, null);
});

// L128 (13 Nov 2026): the feed list stops at 10,000 of CJ's 16,617 feeds, so five shops that accepted us that day were
// not in it. -Joined asks CJ's Advertiser Lookup API which shops accepted us, then looks at each like "probe".
import { parseLookup, LOOKUP_API } from '../../tools/cj-feed.mjs';

test('L128: joined mode lists the shops that accepted us (Advertiser Lookup) and probes each one, read-only', async () => {
  const cj = fakeCj({ products: [product(1), product(2)] });
  const lookups = [];
  const xml = `<?xml version="1.0"?><cj-api><advertisers total-matched="2" records-returned="2" page-number="1">
<advertiser><advertiser-id>5175167</advertiser-id><advertiser-name>XPLORA UK</advertiser-name><account-status>Active</account-status><relationship-status>joined</relationship-status><primary-category><parent>Electronics</parent><child>Kids</child></primary-category></advertiser>
<advertiser><advertiser-id>4297609</advertiser-id><advertiser-name>Click &amp; Grow</advertiser-name><account-status>Active</account-status><relationship-status>joined</relationship-status></advertiser>
</advertisers></cj-api>`;
  const fetchImpl = async (url, init) => {
    if (String(url).startsWith('http://127.0.0.1:9/lookup')) {
      lookups.push({ url: String(url), auth: init.headers.authorization });
      const cid = new URL(url).searchParams.get('requestor-cid');
      if (cid !== '7806395') return { status: 401, text: async () => '<error>Not authorized</error>' };
      return { status: 200, text: async () => xml };
    }
    return cj.fetchImpl(url, init);
  };
  const S = await run({ mode: 'joined', cids: ['8114224', '7806395'], pid: '101917444', advertisers: ['5175167'], token: TOKEN, api: API, fetchImpl, pauseMs: 0, lookupApi: 'http://127.0.0.1:9/lookup' });
  assert.equal(S.error, undefined);
  assert.deepEqual(S.joined.map(a => [a.id, a.name]), [['5175167', 'XPLORA UK'], ['4297609', 'Click & Grow']]);
  assert.equal(S.joinedTried[0].cid, '8114224');
  assert.ok(lookups.every(l => l.auth === `Bearer ${TOKEN}`) && lookups.some(l => l.url.includes('advertiser-ids=joined')));
  assert.deepEqual(S.advertisers.map(a => a.advertiser), ['5175167', '4297609']);
  assert.equal(S.cid, '7806395');
  assert.ok(!JSON.stringify(S).includes(TOKEN));
  const away = await run({ mode: 'joined', cids: ['7806395'], pid: '1', advertisers: ['5175167'], token: TOKEN, api: API, fetchImpl, pauseMs: 0, lookupApi: 'https://evil.example.com/lookup' });
  assert.equal(away.error, 'unexpected lookup address');
  assert.equal(parseLookup('<cj-api><advertisers total-matched="0"></advertisers></cj-api>').total, 0);
  assert.equal(new URL(LOOKUP_API).hostname, 'advertiser-lookup.api.cj.com');
});

// L129 (13 Nov 2026): Jeulia 21,905, Haglofs 72,031 and Dream Pairs 58,629 products stopped at CJ's "Cannot page past
// 10,000 records". Each search has its own 10,000, so a bigger catalogue is read in price bands under the cap.
const PRICED = { queryType: { fields: SCHEMA.queryType.fields.map(f => f.name !== 'shoppingProducts' ? f
  : { ...f, args: f.args.concat([{ name: 'lowPrice', type: t('Float', 'SCALAR') }, { name: 'highPrice', type: t('Float', 'SCALAR') }]) }) } };
const shapeOf = async schema => {
  const cj = fakeCj({ products: [product(1)], schema });
  const S = await run({ mode: 'probe', cids: ['7806395'], pid: '101917444', advertisers: ['5175167'], token: TOKEN, api: API, fetchImpl: cj.fetchImpl, pauseMs: 0 });
  return S;
};

test('L129: split points never fall on a real price; price literals follow the argument type', () => {
  assert.equal(splitPoint(0, 1e8), 10000.005);
  assert.equal(splitPoint(0, 100.005), 10.005);
  assert.equal(splitPoint(20, 30), 25.005);
  for (const [lo, hi] of [[0, 1e8], [0, 10.005], [12.345, 13], [99.995, 100.005]]) { const m = splitPoint(lo, hi); assert.ok(m > lo && m < hi, `${lo}-${hi}: ${m}`); }
  assert.equal(priceLiteral(10.005, 'Float'), '10.005');
  assert.equal(priceLiteral(10.005, 'String'), '"10.005"');
  assert.equal(OFFSET_CAP, 10000);
});

test('L129: the summary shows the product search arguments and whether price bands are possible', async () => {
  const S = await shapeOf(PRICED);
  assert.ok(S.productArgs.includes('lowPrice:Float') && S.productArgs.includes('highPrice:Float'), JSON.stringify(S.productArgs));
  assert.equal(S.priceBands, true);
  assert.equal((await shapeOf(SCHEMA)).priceBands, false);
});

test('L129: above the cap the catalogue is read in price bands, every product once, no page past the cap', async () => {
  // 180 products, 40 of them at exactly 30.00 and many at round prices; the fake cap is 50 per search.
  const many = Array.from({ length: 180 }, (_, i) => product(i + 1, { price: { amount: i < 40 ? 30 : [5, 9.99, 10, 49.5, 100, 250, 999.99, 1500][i % 8] + (i % 3), currency: 'USD' } }));
  const cj = fakeCj({ products: many, cap: 50 });
  const shape = { qname: 'shoppingProducts', args: ['companyId', 'partnerIds', 'limit', 'offset', 'lowPrice', 'highPrice'], argTypes: { lowPrice: 'Float', highPrice: 'Float' },
    outer: ['totalCount', 'count'], fields: [{ name: 'id', args: [] }, { name: 'title', args: [] }, { name: 'price', args: [], object: true }], sub: { price: ['amount', 'currency'] } };
  const r = await fetchAll({ shape, cid: '7806395', pid: '101917444', advertiser: '5175167', token: TOKEN, api: API, fetchImpl: cj.fetchImpl, pauseMs: 0, page: 10, cap: 50 });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.split, 'price');
  assert.equal(r.products.length, 180, 'every product, each once');
  assert.equal(new Set(r.products.map(p => p.id)).size, 180);
  assert.equal(r.capped, false);
  assert.ok(r.bands >= 4, `bands: ${r.bands}`);
  assert.ok(cj.calls.every(c => { const l = Number((/limit: (\d+)/.exec(c.q) || [])[1] || 0); const o = Number((/offset: (\d+)/.exec(c.q) || [])[1] || 0); return o + l <= 50; }), 'no request pages past the cap');
  assert.ok(cj.calls.some(c => /lowPrice: \d/.test(c.q) && /highPrice: \d/.test(c.q)));
});

test('L129: one price with more products than the cap: what fits comes, marked capped', async () => {
  const many = Array.from({ length: 70 }, (_, i) => product(i + 1, { price: { amount: 30, currency: 'USD' } }));
  const cj = fakeCj({ products: many, cap: 50 });
  const shape = { qname: 'shoppingProducts', args: ['companyId', 'partnerIds', 'limit', 'offset', 'lowPrice', 'highPrice'], argTypes: {}, outer: ['totalCount'], fields: [{ name: 'id', args: [] }, { name: 'price', args: [], object: true }], sub: { price: ['amount', 'currency'] } };
  const r = await fetchAll({ shape, cid: '7806395', advertiser: '5175167', token: TOKEN, api: API, fetchImpl: cj.fetchImpl, pauseMs: 0, page: 10, cap: 50 });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.products.length, 50);
  assert.equal(r.capped, true);
});

test('L129: without price arguments the first 10,000 are written (not nothing), marked capped, through run()', async () => {
  const many = Array.from({ length: OFFSET_CAP + 50 }, (_, i) => product(i + 1));
  const cj = fakeCj({ products: many, cap: OFFSET_CAP });
  const out = mkdtempSync(join(tmpdir(), 'cj-'));
  const S = await run({ mode: 'download', cids: ['7806395'], pid: '101917444', advertisers: ['5175167'], out, token: TOKEN, api: API, fetchImpl: cj.fetchImpl, pauseMs: 0 });
  assert.equal(S.ok, true, JSON.stringify(S).slice(0, 400));
  assert.equal(S.priceBands, false);
  const A = S.advertisers[0];
  assert.equal(A.total, OFFSET_CAP + 50);
  assert.equal(A.got, OFFSET_CAP);
  assert.equal(A.capped, true);
  assert.equal(A.split, 'none');
  assert.deepEqual(readdirSync(out), ['CJ_5175167.csv.gz.part']);
  assert.ok(!cj.calls.some(c => /offset: 10000/.test(c.q)), 'never asks past the cap');
});

test('L129: one product id in several country catalogues (Haglofs GB/NL/DE) keeps every catalogue, the very same row once', async () => {
  // Second download of 13 Nov 2026: Haglofs gave 17,906 of 72,031 because rows were kept once per product id, and the
  // same id is in every country catalogue (GBP and EUR): mostly the EUR copy stayed, the GB one went.
  const rows = [];
  for (let i = 1; i <= 60; i++) {
    rows.push(product(i, { adId: 'GB', price: { amount: 20 + i, currency: 'GBP' } }));
    rows.push(product(i, { adId: 'NL', price: { amount: 25 + i, currency: 'EUR' } }));
    rows.push(product(i, { adId: 'DE', price: { amount: 25 + i, currency: 'EUR' } }));
  }
  const cj = fakeCj({ products: rows, cap: 50 });
  const shape = { qname: 'shoppingProducts', args: ['companyId', 'partnerIds', 'limit', 'offset', 'lowPrice', 'highPrice'], argTypes: {}, outer: ['totalCount'],
    fields: [{ name: 'id', args: [] }, { name: 'adId', args: [] }, { name: 'price', args: [], object: true }], sub: { price: ['amount', 'currency'] } };
  const r = await fetchAll({ shape, cid: '7806395', advertiser: '5531758', token: TOKEN, api: API, fetchImpl: cj.fetchImpl, pauseMs: 0, page: 10, cap: 50 });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.products.length, 180, 'all three catalogues of every product');
  assert.equal(r.products.filter(p => p.price.currency === 'GBP').length, 60, 'every GB row');
  assert.equal(r.capped, false);
  assert.match(productQuery({ shape: { ...shape, fields: shape.fields.concat([{ name: 'catalogId', args: [] }]) }, cid: '1', advertiser: '2' }), /resultList \{ id adId catalogId /);
});
