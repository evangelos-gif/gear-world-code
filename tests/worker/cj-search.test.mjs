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
const ARGS = ['companyId', 'partnerIds', 'limit', 'offset', 'lowPrice', 'highPrice', 'keywords', 'currency', 'serviceableAreas', 'googleProductCategoryIds', 'googleProductCategoryNames'];
const schemaWith = args => ({ queryType: { fields: [
  { name: 'shoppingProducts', args: args.map(name => ({ name, type: t(/Price$/.test(name) ? 'Float' : name === 'limit' || name === 'offset' ? 'Int' : 'String', 'SCALAR') })), type: t('ShoppingProducts', 'OBJECT') }
] } });
const TYPES = {
  ShoppingProducts: [{ name: 'totalCount', type: t('Int', 'SCALAR') }, { name: 'count', type: t('Int', 'SCALAR') },
    { name: 'resultList', type: t(null, 'LIST', t('ShoppingProduct', 'OBJECT')) }],
  ShoppingProduct: ['id', 'title', 'brand', 'link', 'imageLink', 'availability', 'advertiserId', 'advertiserName', 'itemGroupId', 'targetCountry', 'shipsFromCountry', 'ageGroup', 'gender']
    .map(name => ({ name, args: [], type: t('String', 'SCALAR') }))
    .concat([{ name: 'serviceableAreas', args: [], type: t(null, 'LIST', t('String', 'SCALAR')) },
      { name: 'price', args: [], type: t('Price', 'OBJECT') }, { name: 'linkCode', args: [{ name: 'pid' }], type: t('LinkCode', 'OBJECT') },
      { name: 'googleProductCategory', args: [], type: t('Gpc', 'OBJECT') }]),
  Gpc: [{ name: 'id', type: t('ID', 'SCALAR') }, { name: 'name', type: t('String', 'SCALAR') }],
  Price: [{ name: 'amount', type: t('Float', 'SCALAR') }, { name: 'currency', type: t('String', 'SCALAR') }],
  LinkCode: [{ name: 'clickUrl', type: t('String', 'SCALAR') }]
};

const item = (i, title, currency = 'GBP', over = {}) => ({
  id: String(400000000 + i), title, brand: '', link: `https://uk.dhgate.com/product/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}/${400000000 + i}.html`, imageLink: `https://img.dhgate.com/${i}.jpg`,
  availability: 'in stock', advertiserId: '3992613', advertiserName: 'DHgate', itemGroupId: '', targetCountry: currency === 'GBP' ? 'GB' : 'US',
  serviceableAreas: currency === 'GBP' ? ['GB'] : ['US'], shipsFromCountry: 'CN', ageGroup: 'kids', gender: 'unisex',
  price: { amount: 10 + i, currency }, linkCode: { clickUrl: `https://www.jdoqocy.com/click-101917444-1?url=${i}` },
  googleProductCategory: { id: '187', name: 'Apparel & Accessories > Shoes' }, ...over
});

// A fake CJ like the real one (DHgate looks of 15 Nov 2026): keywords = ANY of the words, "+" and quotes ignored;
// currency, serviceableAreas and Google category (id or name) filter; price bands.
function fakeCj({ products, args = ARGS, total = null, busySchema = 0 }) {
  const calls = [];
  let busyLeft = busySchema;
  const fetchImpl = async (url, init) => {
    const q = JSON.parse(init.body).query;
    calls.push(q);
    const json = x => ({ status: 200, text: async () => JSON.stringify(x) });
    if (init.headers.authorization !== `Bearer ${TOKEN}`) return { status: 401, text: async () => '{"errors":[{"message":"Unauthorized"}]}' };
    if (q.includes('__schema') && busyLeft > 0) { busyLeft--; return { status: 429, text: async () => '{"errors":[{"message":"Too Many Requests"}]}' }; }
    if (q.includes('__schema')) return json({ data: { __schema: schemaWith(args) } });
    const ty = /__type\(name: "(\w+)"\)/.exec(q);
    if (ty) return json({ data: { __type: TYPES[ty[1]] ? { fields: TYPES[ty[1]] } : null } });
    const str = k => { const m = new RegExp(`${k}: "((?:[^"\\\\]|\\\\.)*)"`).exec(q); return m ? JSON.parse(`"${m[1]}"`) : ''; };
    const num = k => { const m = new RegExp(`${k}: ([\\d.]+)`).exec(q); return m ? Number(m[1]) : null; };
    const kw = str('keywords'), cur = str('currency'), area = str('serviceableAreas'), lo = num('lowPrice'), hi = num('highPrice');
    const gid = str('googleProductCategoryIds'), gname = str('googleProductCategoryNames');
    const limit = num('limit') ?? 1000, offset = num('offset') ?? 0;
    const t = p => ` ${p.title.toLowerCase()} `;
    const hasWord = (p, w) => t(p).includes(` ${w} `);
    const match = p => !kw || kw.toLowerCase().replace(/["+]/g, ' ').trim().split(/\s+/).some(w => hasWord(p, w));
    const list = products.filter(p => match(p) && (!gid || p.googleProductCategory.id === gid) && (!gname || p.googleProductCategory.name === gname)
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
  item(7, 'Children Snow Boots Kids Winter Warm'),
  item(8, 'Snow Globe Christmas Decoration', 'GBP', { googleProductCategory: { id: '696', name: 'Home & Garden > Decor' } })
];
const base = { cids: ['7806395'], pid: '101917444', advertisers: ['3992613'], token: TOKEN, api: API, pauseMs: 0 };

test('L161: the search is written down, in pounds, and its file columns say where each product is sold and why it came', () => {
  const s = SEARCHES['kids-winter-boots'];
  assert.equal(s.currency, 'GBP');
  assert.ok(s.keywords.includes('snow') && s.keywords.includes('wellies'));
  assert.ok(s.keywords.every(k => /^[a-z]{3,20}$/.test(k)), 'one word each: CJ reads several words as any of them');
  assert.deepEqual(s.narrow.map(n => n.googleProductCategoryIds || n.googleProductCategoryNames || ''), ['187', 'Apparel & Accessories > Shoes', ''], 'shoes first, then every category');
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
  const snow = A.searches.find(x => x.keyword === 'snow');
  // Any currency: items 1, 2, 3, 7 and the snow globe; in pounds and in shoes: 1, 2, 7; in every category the globe too.
  assert.equal(snow.all, 5);
  assert.deepEqual(snow.tries.map(x => x.total), [3, 3, 4]);
  assert.deepEqual([snow.form, snow.used, snow.inArea], ['Shoes (Google 187)', 3, 3], 'the first narrowing that finds something');
  assert.deepEqual([A.searches.find(x => x.keyword === 'wellies').used, A.searches.find(x => x.keyword === 'snowboots').form], [1, '']);
  assert.ok(A.total >= 5);
  assert.match(A.sampleQuery, /keywords=snow \| currency=GBP \| googleProductCategoryIds=187/);
  assert.ok(A.samples.length === 3 && A.samples.every(x => x.currency === 'GBP' && x.target === 'GB' && x.areas === 'GB' && x.gpc === 'Apparel & Accessories > Shoes'));
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
  assert.ok(text.some(l => l.endsWith('"snow"')), 'the keyword that found it');
  assert.equal(A.searches.find(x => x.keyword === 'snow').form, 'Shoes (Google 187)');
  const asks = cj.calls.filter(q => q.includes('shoppingProducts('));
  assert.match(asks[0], /limit: 1[,)]/, 'only the account check (one product) has no keywords');
  assert.ok(asks.slice(1).every(q => q.includes('keywords: "') && q.includes('currency: "GBP"')));
  assert.ok(!asks.some(q => q.includes('lowPrice') && !q.includes('keywords')), 'no price band without the search');
  assert.ok(!JSON.stringify(S).includes(TOKEN));
});

test('L161: a keyword that finds too much is left out; an unknown search, or an API without keyword search, reads nothing', async () => {
  const many = Array.from({ length: 30 }, (_, i) => item(100 + i, `Kids Snow Boots Model ${i}`));
  const cj = fakeCj({ products: many });
  const out = mkdtempSync(join(tmpdir(), 'gw-cjs-'));
  const S = await run({ ...base, mode: 'download', out, fetchImpl: cj.fetchImpl, search: 'kids-winter-boots', searchMax: 20 });
  const snow = S.advertisers[0].searches.find(x => x.keyword === 'snow');
  assert.equal(snow.tooBroad, true);
  assert.equal(snow.got, 0);
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

test('L161: DHgate on Kids\' Gear World: only children\'s winter boots from the search file, no brands, no copies, in pounds', async () => {
  const { planLegacyImport } = await import('../../tools/legacy-import-plan.mjs');
  const R = await import('../../tools/import-rules/dhgate-kids-boots.mjs');
  const ok = n => R.classify({ name: n, info: { target: 'GB', areas: 'GB' } });
  for (const n of ['Kids Snow Boots Winter Warm Plush Boys Girls Waterproof Non-slip', 'Girls Princess Snow Boots Faux Fur Pom Pom', 'Children Rain Boots Wellies Cartoon Dinosaur',
    'Baby Winter Booties Toddler First Walkers Warm Cotton']) assert.deepEqual(ok(n), { site: 'kgw', siteCategory: 'Shoes', subcategory: 'Winter Boots' }, n);
  const why = n => ok(n).reject || '';
  assert.match(why('UGG Style Kids Snow Boots'), /brand/);
  assert.match(why('Frozen Elsa Girls Winter Boots'), /brand or character/);
  assert.match(why('Kids Timberland Winter Boots Waterproof'), /brand/);
  assert.match(why('Kids Snow Boots With Box Top Quality'), /copy/);
  assert.match(why('Men Women Kids Snow Boots Family'), /grown-ups/);
  assert.match(why('10 Pairs Kids Snow Boots Wholesale'), /lot/);
  assert.match(why('Doll Snow Boots for 18 inch Dolls'), /not a child/);
  assert.match(why('Kids Boots Leather Chelsea Ankle Boots'), /not a snow/);
  assert.match(why('Kids Snow Suit Winter Warm'), /not a boot/);
  assert.match(R.classify({ name: 'Kids Snow Boots Warm', info: { target: 'US', areas: 'US' } }).reject, /UK/);
  // Third DHgate look (15 Nov 2026): HTML codes, UGG-style copies, adult boots and a re-used listing.
  assert.match(why('Men&#039;s Winter Snow Boots Kids Fleece Lined'), /grown-ups/);
  assert.match(why('Kids Tasman Slipper Snow Boots Plush'), /brand/);
  assert.match(why('Girls Ultra Mini Platform Snow Boots Warm'), /brand/);
  assert.match(why('Kids Plush Snow Slippers Boots Warm'), /not a child/);
  const page = slug => R.classify({ name: 'Toddler Snow Boots Winter Warm Boy Girl Children', url: `https://uk.dhgate.com/product/${slug}/409610975.html`, info: { target: 'GB', areas: 'JP, GB, US' } });
  assert.match(page('lexington-chronograph-gold-tone-black-dial').reject, /re-used listing/);
  assert.equal(page('trendy-snow-boots-shoes-boots-winter').subcategory, 'Winter Boots');
  assert.equal(R.displayName('Girl&#039;s Snow Boots &amp; Mittens'), "Girl's Snow Boots & Mittens");
  assert.equal(R.productKey(() => 'http://www.dhgate.com/product/kids-snow-boots/402230757.html'), 'dhgate-402230757');
  assert.deepEqual(R.feedFiles('/x').map(f => f.replace(/\\/g, '/')), ['/x/CJ_3992613_kids-winter-boots.csv.gz']);
  assert.equal(R.displayBrand('Shenzhen Happy Shoes Store'), 'DHgate');
  assert.equal(R.displayName('2025 Hot Sale New Kids Snow Boots!! Free Shipping'), 'Kids Snow Boots');

  const products = [item(1, 'Kids Snow Boots Winter Warm Plush Boys Girls'), item(2, 'Girls Snow Boots Waterproof Faux Fur'), item(3, 'Kids Snow Boots UGG Style Winter'),
    item(4, 'Kids Snow Boots Children Thermal', 'USD'), item(5, 'Kids Snow Boots Shoe Covers Waterproof'), item(7, 'Kids Snow Boots Winter Toddler', 'GBP', { linkCode: null })];
  const archive = mkdtempSync(join(tmpdir(), 'gw-dh-'));
  const S = await run({ ...base, mode: 'download', out: archive, fetchImpl: fakeCj({ products }).fetchImpl, search: 'kids-winter-boots' });
  assert.equal(S.advertisers[0].ok, true, S.advertisers[0].error);
  const { renameSync, writeFileSync } = await import('node:fs');
  renameSync(join(archive, 'CJ_3992613_kids-winter-boots.csv.gz.part'), join(archive, R.SEARCH_FILE));
  writeFileSync(join(archive, 'CJ_3992613.csv.gz'), '');
  const out = mkdtempSync(join(tmpdir(), 'gw-dhplan-'));
  const r = await planLegacyImport({ archive, retailer: 'dhgate-kids-boots', outDir: out, now: new Date('2026-11-15T15:00:00Z') });
  assert.deepEqual(r.files, [R.SEARCH_FILE], 'never a whole-catalogue file');
  assert.deepEqual(r.accepted.kgw.map(p => p.product_name).sort(), ['Girls Snow Boots Waterproof Faux Fur', 'Kids Snow Boots Winter Warm Plush Boys Girls']);
  assert.ok(r.accepted.kgw.every(p => p.currency === 'GBP' && p.subcategory === 'Winter Boots' && p.brand === 'DHgate' && /jdoqocy\.com/.test(p.affiliate_url)));
  const reasons = Object.keys(r.rejected).join(' | ');
  assert.match(reasons, /brand/);
  assert.match(reasons, /not a child/);
  assert.match(reasons, /tracking link/);
});

test('L161: a keyword with nothing in shoes falls back to every category', async () => {
  const items = [item(300, 'Wellies Kids Frog', 'GBP', { googleProductCategory: { id: '1604', name: 'Apparel & Accessories > Clothing' } })];
  const S = await run({ ...base, mode: 'probe', fetchImpl: fakeCj({ products: items }).fetchImpl, search: 'kids-winter-boots' });
  const w = S.advertisers[0].searches.find(x => x.keyword === 'wellies');
  assert.deepEqual([w.tries.map(x => x.total), w.form, w.used], [[0, 0, 1], 'every category', 1]);
});

test('L161: a busy CJ (429) is asked again, so a download right after the look still finds the keyword search', async () => {
  const out = mkdtempSync(join(tmpdir(), 'gw-cjs-'));
  const S = await run({ ...base, mode: 'download', out, fetchImpl: fakeCj({ products: CATALOGUE, busySchema: 2 }).fetchImpl, search: 'kids-winter-boots', retryWaitMs: 0 });
  assert.equal(S.error, undefined, S.error);
  assert.equal(S.advertisers[0].ok, true);
  const T = await run({ ...base, mode: 'download', out: mkdtempSync(join(tmpdir(), 'gw-cjs-')), fetchImpl: fakeCj({ products: CATALOGUE, busySchema: 9 }).fetchImpl, search: 'kids-winter-boots', retryWaitMs: 0 });
  assert.match(T.error, /did not describe itself .*run it again/);
});
