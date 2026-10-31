// L86: CJ Affiliate catalogues (first shop XPLORA UK, 31 Oct 2026): a fake CJ API, the feed file in Awin column
// names, the import plan with the CJ tracking link as the card's link, and the token never in the output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { run, toFeedRow, productQuery, isCjLink, makeMask, COLUMNS } from '../../tools/cj-feed.mjs';
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

// A fake CJ API: introspection, a CID that it refuses, products paged by offset.
function fakeCj({ products, goodCid = '7806395' }) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    const q = body.query;
    calls.push({ url, q, auth: init.headers.authorization });
    const json = x => ({ status: 200, text: async () => JSON.stringify(x) });
    if (init.headers.authorization !== `Bearer ${TOKEN}`) return { status: 401, text: async () => '{"errors":[{"message":"Unauthorized"}]}' };
    if (q.includes('__schema')) return json({ data: { __schema: SCHEMA } });
    const ty = /__type\(name: "(\w+)"\)/.exec(q);
    if (ty) return json({ data: { __type: TYPES[ty[1]] ? { fields: TYPES[ty[1]] } : null } });
    const cid = (/companyId: "(\d+)"/.exec(q) || [])[1];
    if (cid !== goodCid) return json({ errors: [{ message: `Not authorized for company ${cid}` }] });
    if (q.includes('shoppingProductFeeds')) return json({ data: { shoppingProductFeeds: { totalCount: 1, resultList: [{ advertiserId: '5175167', advertiserName: 'XPLORA UK', feedName: 'UK feed', productCount: String(products.length), currency: 'GBP' },
      { advertiserId: '3773223', advertiserName: 'SHEIN', feedName: 'FR', productCount: '9', currency: 'EUR' }] } } });
    const limit = Number((/limit: (\d+)/.exec(q) || [])[1] || 1000);
    const offset = Number((/offset: (\d+)/.exec(q) || [])[1] || 0);
    return json({ data: { shoppingProducts: { totalCount: products.length, count: Math.min(limit, products.length - offset), resultList: products.slice(offset, offset + limit) } } });
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
