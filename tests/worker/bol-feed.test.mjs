// bol.com Marketing Catalog API -> feed file (chat 9, 16 Nov 2026; lessons L154): one token per run, only the official
// API, the partner link of site ID 1559450, one product (EAN) once, no "was" price, no key or token in any line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { session, download, jobsOf, rowOf, categoryTree, renderDownload, renderCategories, okBase, BOL_COLUMNS } from '../../tools/bol-feed.mjs';
import { bolLink, isBolLink, NETWORKS, pageInLink } from '../../tools/network-links.mjs';
import { feedOf } from '../../tools/feed-profile.mjs';

const ID = 'gwBolClientTest1';
const SECRET = 'gwBolSecretTest123456';
const prod = (n, extra = {}) => ({
  ean: String(8712345000000 + n), bolProductId: String(9300000000000000 + n), title: `Werkschoen S3 model ${n}`,
  description: `<p>Veiligheids<b>schoen</b> ${n}</p>`, url: `https://www.bol.com/nl/nl/p/werkschoen-${n}/${9300000000000000 + n}/`,
  rating: 4.2, image: { url: `https://media.s-bol.com/x/${n}.jpg` }, offer: { price: 50 + n, strikethroughPrice: 99.99, deliveryDescription: 'Morgen in huis' },
  gpc: [{ level: 2, name: 'Werkschoenen' }, { level: 1, name: 'Kleding' }], ...extra
});

// A fake bol.com: /token and the two list endpoints; counts tokens and calls; records the headers.
function fakeBol({ pages = 3, perPage = 50, total = 130, tokenStatus = 200, listStatus = 200, expires = 599, dup = false } = {}) {
  const F = { tokens: 0, calls: 0, seen: [] };
  F.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const h = init.headers || {};
    const send = (status, body, headers = {}) => ({ status, headers: { get: k => headers[k.toLowerCase()] || null }, json: async () => body });
    if (u.pathname === '/token') {
      F.tokens++;
      assert.equal(init.method, 'POST');
      assert.equal(u.searchParams.get('grant_type'), 'client_credentials');
      assert.equal(h.Authorization, 'Basic ' + Buffer.from(`${ID}:${SECRET}`).toString('base64'));
      if (tokenStatus !== 200) return send(tokenStatus, { error: 'x' }, { 'retry-after': '60' });
      return send(200, { access_token: `tok${F.tokens}`, expires_in: expires });
    }
    F.calls++;
    F.seen.push({ path: u.pathname, q: Object.fromEntries(u.searchParams), auth: h.Authorization, lang: h['Accept-Language'] });
    assert.match(h.Authorization, /^Bearer tok\d$/);
    if (listStatus !== 200) return send(listStatus, { title: 'Too Many Requests' }, { 'retry-after': '30' });
    const page = Number(u.searchParams.get('page'));
    const size = Number(u.searchParams.get('page-size'));
    const cat = u.searchParams.get('category-id') || '0';
    const base = Number(cat) * 1000 + (page - 1) * size;
    const n = page < pages ? perPage : Math.max(0, total - (pages - 1) * perPage);
    const results = Array.from({ length: Math.min(n, size) }, (_, i) => prod(dup ? i : base + i));
    if (results[1]) delete results[1].offer;            // not for sale now
    if (results[2]) results[2].url = 'https://example.com/x'; // not a bol.com page
    return send(200, { page, totalPages: pages, totalResults: total, results,
      allRelevantCategories: [{ categoryId: cat, categoryName: cat === '12382' ? 'Auto & Motor' : 'Tuin', productCount: total, subcategories: [{ categoryId: '99', categoryName: 'Sub', productCount: 5 }] }] });
  };
  return F;
}

test('the partner link: site ID 1559450, only a bol.com product page; the import knows the network', () => {
  const l = bolLink('https://www.bol.com/nl/nl/p/werkschoen/9300000000000001/', 'Werkschoen S3  model');
  assert.equal(l, 'https://partner.bol.com/click/click?p=2&t=url&s=1559450&f=TXL&url=https%3A%2F%2Fwww.bol.com%2Fnl%2Fnl%2Fp%2Fwerkschoen%2F9300000000000001%2F&name=Werkschoen%20S3%20model');
  assert.ok(isBolLink(l));
  assert.equal(pageInLink(l), 'https://www.bol.com/nl/nl/p/werkschoen/9300000000000001/');
  assert.equal(bolLink('https://evil.example/p/1'), '');
  assert.equal(bolLink('http://www.bol.com/nl/p/1'), '', 'only https');
  assert.ok(!isBolLink(l.replace('s=1559450', 's=1')), 'another site ID earns nothing for us');
  assert.ok(!isBolLink('https://partner.bol.com/click/click?p=2&t=url&s=1559450&url=https%3A%2F%2Fevil.example%2F'));
  assert.equal(NETWORKS.bol.idPrefix, 'bol');
  assert.deepEqual(feedOf('BOL_12382_NL.csv.gz'), { network: 'bol', advertiserId: 12382, feedId: null, part: 'NL' });
  assert.deepEqual(feedOf('BOL_0_NL-werkschoenen.csv.gz'), { network: 'bol', advertiserId: 0, feedId: null, part: 'NL-werkschoenen' });
});

test('one row: Awin names, EUR, the link, no "was" price, no HTML; left out without offer, page or EAN', () => {
  const r = rowOf(prod(7), { country: 'NL', categoryId: '12382', categoryName: 'Auto & Motor', stamp: '2026-11-16T22:00:00Z' }).row;
  assert.equal(r.merchant_name, 'bol.com');
  assert.equal(r.ean, '8712345000007');
  assert.equal(r.search_price, '57.00');
  assert.equal(r.rrp_price, '', 'the strikethrough price stays out (L107)');
  assert.equal(r.currency, 'EUR');
  assert.equal(r.description, 'Veiligheids schoen 7');
  assert.equal(r.category_name, 'Kleding > Werkschoenen');
  assert.ok(isBolLink(r.aw_deep_link));
  assert.equal(r.language, 'nl');
  assert.deepEqual(BOL_COLUMNS.slice(0, 3), ['data_feed_id', 'merchant_id', 'merchant_name']);
  assert.equal(rowOf(prod(1, { offer: null })).why, 'no offer (not for sale now)');
  assert.equal(rowOf(prod(1, { url: 'https://www.example.com/' })).why, 'no bol.com product page');
  assert.equal(rowOf(prod(1, { ean: '' })).why, 'no EAN');
});

test('download: ONE token, pages of 50 until the end, one EAN once in the whole run, old file to _old, report without keys or token', async () => {
  const out = mkdtempSync(join(tmpdir(), 'bol-'));
  writeFileSync(join(out, 'BOL_12382_NL.csv.gz'), 'old');
  const F = fakeBol();
  const api = session({ id: ID, secret: SECRET, loginBase: 'http://127.0.0.1:1', apiBase: 'http://127.0.0.1:1', fetchImpl: F.fetch });
  const jobs = jobsOf({ categories: ['12382=Automotive', '12382', '7'], searches: ['Strauss werkschoenen'], country: 'NL' });
  assert.deepEqual(jobs.map(j => j.file), ['BOL_12382_NL', 'BOL_7_NL', 'BOL_0_NL-strauss-werkschoenen']);
  const results = await download({ api, jobs, country: 'NL', out, max: 1000, pauseMs: 0, oldStamp: '20261116220000' });
  assert.equal(F.tokens, 1, 'one token for the whole run');
  assert.equal(F.calls, 9, '3 pages for each of the 3 jobs');
  assert.ok(F.seen.every(c => c.lang === 'nl' && c.q['country-code'] === 'NL' && c.q['page-size'] === '50' && c.q['include-offer'] === 'true'));
  assert.equal(F.seen.filter(c => c.path.endsWith('/products/lists/popular')).length, 6);
  assert.equal(F.seen.find(c => c.path.endsWith('/products/search')).q['search-term'], 'Strauss werkschoenen');
  const [a, b, c] = results;
  assert.equal(a.name, 'Auto & Motor');
  assert.equal(a.written, 130 - 3 * 2, 'per page one without offer and one without a bol.com page');
  assert.equal(a.left['no offer (not for sale now)'], 3);
  assert.equal(b.written, 124);
  assert.equal(c.written, 124);
  assert.equal(c.name, 'search "Strauss werkschoenen"');
  assert.ok(existsSync(join(out, '_old', '20261116220000', 'BOL_12382_NL.csv.gz')), 'the old copy first');
  const text = gunzipSync(readFileSync(join(out, 'BOL_12382_NL.csv.gz'))).toString('utf8');
  assert.equal(text.split('\n')[0], BOL_COLUMNS.map(x => `"${x}"`).join(','));
  assert.equal(text.trim().split('\n').length, 1 + a.written);
  assert.ok(!readdirSync(out).some(f => f.endsWith('.part')), 'no half files left');
  const rep = renderDownload({ results, country: 'NL', max: 1000, api });
  assert.match(rep, /κατηγορία 12382 «Auto & Motor»: ΕΝΤΑΞΕΙ -> BOL_12382_NL\.csv\.gz \(το παλιό στο _old\)/);
  assert.match(rep, /1 token, 9 κλήσεις API/);
  assert.ok(!rep.includes(SECRET) && !rep.includes(ID) && !/tok\d/.test(rep));
});

test('the same product from two lists is written once (EAN, the first list wins)', async () => {
  const out = mkdtempSync(join(tmpdir(), 'bol-'));
  const F = fakeBol({ pages: 1, total: 10, dup: true });
  const api = session({ id: ID, secret: SECRET, loginBase: 'http://127.0.0.1:1', apiBase: 'http://127.0.0.1:1', fetchImpl: F.fetch });
  const r = await download({ api, jobs: jobsOf({ categories: ['12382', '13000'] }), out, pauseMs: 0 });
  assert.equal(r[0].written, 8);
  assert.equal(r[1].written, 0);
  assert.equal(r[1].left['the same product already in this run (EAN)'], 8);
});

test('the token is asked again only when it has run out, at most 3; 401 and 429 stop at once with no new try', async () => {
  let t = 0;
  const F = fakeBol({ pages: 2, total: 60, expires: 31 });
  const api = session({ id: ID, secret: SECRET, loginBase: 'http://127.0.0.1:1', apiBase: 'http://127.0.0.1:1', fetchImpl: F.fetch, now: () => (t += 40000) });
  await download({ api, jobs: jobsOf({ categories: ['12382'] }), out: mkdtempSync(join(tmpdir(), 'bol-')), pauseMs: 0 });
  assert.equal(F.tokens, 2, 'the clock here jumps 40 s a call, past the token: the second page asks again');
  await assert.rejects(download({ api, jobs: jobsOf({ categories: ['5', '6', '7'] }), out: mkdtempSync(join(tmpdir(), 'bol-')), pauseMs: 0 }), e => e.code === 6 && /3 tokens/.test(e.message));
  const B = fakeBol({ tokenStatus: 401 });
  await assert.rejects(session({ id: ID, secret: SECRET, fetchImpl: B.fetch, loginBase: 'http://127.0.0.1:1' }).token(), e => e.code === 3);
  assert.equal(B.tokens, 1);
  const out = mkdtempSync(join(tmpdir(), 'bol-'));
  const C = fakeBol({ listStatus: 429 });
  const apiC = session({ id: ID, secret: SECRET, loginBase: 'http://127.0.0.1:1', apiBase: 'http://127.0.0.1:1', fetchImpl: C.fetch });
  await assert.rejects(download({ api: apiC, jobs: jobsOf({ categories: ['12382', '7'] }), out, pauseMs: 0 }), e => e.code === 6 && e.results.length === 1);
  assert.equal(C.calls, 1, 'no new try after 429, and the next category is not asked');
  assert.deepEqual(readdirSync(out), [], 'nothing half-written stays');
});

test('the keys and the token go only to bol.com (or the local test server); the categories report', () => {
  assert.ok(okBase('https://login.bol.com', 'login.bol.com'));
  assert.ok(okBase('http://127.0.0.1:8797', 'api.bol.com'));
  assert.ok(!okBase('https://login.bol.com.evil.example', 'login.bol.com'));
  assert.ok(!okBase('http://login.bol.com', 'login.bol.com'));
  assert.ok(!okBase('https://api.bol.com/other', 'api.bol.com'));
  const tree = categoryTree({ allRelevantCategories: [{ categoryId: 12382, categoryName: 'Auto &amp; Motor', productCount: 152000, subcategories: [{ categoryId: 1, categoryName: 'Banden', productCount: 9 }] }, { categoryName: 'no id' }] });
  assert.equal(tree.length, 1);
  assert.equal(tree[0].sub[0].name, 'Banden');
  const rep = renderCategories({ tree, country: 'NL', api: { stats: { tokens: 1, calls: 1 } } });
  assert.match(rep, /^12382 \| Auto &amp; Motor \| 152,000$/m);
  assert.match(rep, /^ {4}1 \| Banden \| 9$/m);
});

test('a short page is not the end when bol.com names more pages (Auto & Motor stopped after 47 of 50 on 17 Nov 2026)', async () => {
  let calls = 0;
  const fetchImpl = async (url) => {
    const u = new URL(url);
    const send = (status, body) => ({ status, headers: { get: () => null }, json: async () => body });
    if (u.pathname === '/token') return send(200, { access_token: 'tok1', expires_in: 599 });
    calls++;
    const page = Number(u.searchParams.get('page'));
    const n = page === 1 ? 47 : page === 2 ? 50 : page === 3 ? 10 : 0;
    return send(200, { totalPages: 3, totalResults: 107, results: Array.from({ length: n }, (_, i) => prod(page * 100 + i)) });
  };
  const api = session({ id: ID, secret: SECRET, loginBase: 'http://127.0.0.1:1', apiBase: 'http://127.0.0.1:1', fetchImpl });
  const [r] = await download({ api, jobs: jobsOf({ categories: ['43646'] }), out: mkdtempSync(join(tmpdir(), 'bol-')), pauseMs: 0 });
  assert.equal(calls, 3, 'pages 1, 2 and 3');
  assert.equal(r.pages, 3);
});
