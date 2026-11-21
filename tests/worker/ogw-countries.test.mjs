// Mega Stores Gear World by country (owner, 21 Nov 2026: "they opened Mega Stores from Greece and it shows them all the
// stores it has for England, and the offers: this is wrong" / "can't they be hidden for Greece and the other countries
// they don't deliver to?", lessons L210). Each store, its Black Friday entry, its codes and Amazon UK show only to the
// countries they deliver to; Google and the other crawlers read the UK page. Fake fetch, a fixed day, never the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import site from '../../sites/ogw/site.config.js';
import {
  createGuidesWorker, deliversHere, amazonHere, viewMode, viewCountry, shownStores, storeCodes, earlyBlackFriday, blackFridayParts, awinStores
} from '../../src/marketplace-guides.js';

const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-21T12:00:00Z');
const ON = { AMAZON_LINKS: 'on' };
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const GOOGLE = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const QA = 'GearWorldQA-bot/1.0 (+read-only check)';
const MS = '<span translate="no">Mega Stores</span>';

function makeFetch() {
  const calls = [];
  const f = async input => {
    const u = new URL(String(input));
    calls.push(u);
    const host = u.hostname;
    const r = u.searchParams.get('retailer');
    const to = u.searchParams.get('deliver_to');
    const rows = [1, 2, 3].map(n => ({ product_name: `Item ${host.split('.')[0]} ${n}`, brand: 'Acme', retailer: r, stock_status: 'in_stock',
      image_url: `https://img.example/${n}.jpg`, delivers_to: [to], product_url: `https://${host}/product/p-${n}/` }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  f.calls = calls;
  return f;
}

async function get(path, { cc = null, ua = BROWSER, headers = {}, env = ON, s = site } = {}) {
  const fetch = makeFetch();
  const w = createGuidesWorker(s, { fetch, cache: null, now: () => NOW });
  const req = new Request(LIVE + path, { headers: { 'user-agent': ua, ...headers } });
  if (cc) Object.defineProperty(req, 'cf', { value: { country: cc } });
  const r = await w.fetch(req, env);
  return { r, text: await r.text(), calls: fetch.calls };
}

// Every store and Black Friday name of this site's data: none of them delivers outside the UK today.
const STORE_NAMES = awinStores(site).map(s => s.name);
const BF_NAMES = (site.earlyBlackFriday.started || []).map(r => r.name);
const ALL_NAMES = [...new Set([...STORE_NAMES, ...BF_NAMES])];
const GUIDE_PAGES = site.guides.map(g => `/guides/${g.slug}/`);

test('L210: where an entry delivers: its deliversTo, the UK when it has none, WORLD everywhere', () => {
  assert.equal(deliversHere({ deliversTo: ['GB'] }, 'GB'), true);
  assert.equal(deliversHere({ deliversTo: ['GB'] }, 'GR'), false);
  assert.equal(deliversHere({}, 'GB'), true, 'no deliversTo: the UK');
  assert.equal(deliversHere({}, 'GR'), false);
  assert.equal(deliversHere({ deliversTo: ['gb', 'gr'] }, 'GR'), true, 'any letter case');
  assert.equal(deliversHere({ deliversTo: ['WORLD'] }, 'JP'), true);
  assert.equal(amazonHere(site, 'GB'), true, 'Amazon UK for the UK');
  for (const cc of ['GR', 'CY', 'US', 'DE', 'PL', 'IE', 'XX', 'T1']) {
    assert.equal(amazonHere(site, cc), false, `${cc}: no Amazon UK`);
    assert.equal(viewMode(site, 'on', cc), 'off', `${cc}: the pages of AMAZON_LINKS=off`);
    assert.equal(shownStores(site, 'on', cc).length, 0, `${cc}: no store of this page delivers there`);
    assert.equal(storeCodes(site, NOW, null, cc).length, 0, `${cc}: no store code`);
    assert.equal(earlyBlackFriday(site, NOW, cc).length, 0, `${cc}: no Black Friday store`);
    const b = blackFridayParts(site, NOW, cc);
    assert.ok(b && b.elsewhere > 0, `${cc}: the countdown stays, and the UK entries are counted as elsewhere`);
  }
  assert.equal(viewMode(site, 'on', 'GB'), 'on');
  assert.equal(shownStores(site, 'on', 'GB').length, STORE_NAMES.length + 1, 'the UK: every store and Amazon');
  assert.ok(earlyBlackFriday(site, NOW, 'GB').length >= 1 && storeCodes(site, NOW, null, 'GB').length >= 1);
  assert.equal(blackFridayParts(site, NOW, 'GB').elsewhere, 0);
});

test('L210: the visitor\'s country: Cloudflare, the QA bot\'s header; crawlers and local tests read the UK page', () => {
  const req = (ua, cc, headers = {}) => {
    const r = new Request(LIVE, { headers: { 'user-agent': ua, ...headers } });
    if (cc) Object.defineProperty(r, 'cf', { value: { country: cc } });
    return r;
  };
  assert.equal(viewCountry(req(BROWSER, 'GR')), 'GR');
  assert.equal(viewCountry(req(BROWSER, 'gb')), 'GB');
  assert.equal(viewCountry(req(BROWSER, 'T1')), 'XX', 'Tor is not the UK');
  assert.equal(viewCountry(req(BROWSER, 'XX')), 'XX', 'an unknown country is not the UK');
  assert.equal(viewCountry(req(BROWSER, null)), 'GB', 'no Cloudflare data at all (a local test): the UK page, as before');
  const noCountry = new Request(LIVE, { headers: { 'user-agent': BROWSER } });
  Object.defineProperty(noCountry, 'cf', { value: {} });
  assert.equal(viewCountry(noCountry), 'XX', 'Cloudflare data without a country: not the UK');
  assert.equal(viewCountry(req(GOOGLE, 'GR')), 'GB', 'Google reads the UK page');
  assert.equal(viewCountry(req('facebookexternalhit/1.1', 'GR')), 'GB', 'other crawlers too');
  assert.equal(viewCountry(req(QA, null, { 'X-GW-QA-Country': 'GR' })), 'GR', 'the QA check may ask a country');
  assert.equal(viewCountry(req(BROWSER, 'GB', { 'X-GW-QA-Country': 'GR' })), 'GB', 'a browser cannot');
});

test('L210: the UK home page is as before: every store, Amazon, the Black Friday stores, codes and the Hub page', async () => {
  for (const cc of ['GB', null]) {
    const { r, text, calls } = await get('/', { cc });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Cache-Control'), 'private, max-age=60', 'never kept by a shared cache');
    for (const n of STORE_NAMES) assert.ok(text.includes(`>${n}<`), `${cc}: ${n}`);
    assert.ok(text.includes('href="/stores/amazon/"'), `${cc}: Amazon`);
    assert.ok(text.includes('class="bf-started"') && text.includes('class="promo-card"'), `${cc}: Black Friday stores and codes`);
    assert.ok(text.includes('https://gearworldhub.com/black-friday/'), `${cc}: the Hub's Black Friday page`);
    assert.ok(text.includes('amazon.co.uk'), `${cc}: Amazon UK`);
    assert.ok(!text.includes('stores-none') && !text.includes('bf-none'));
    assert.ok(calls.length > 0, 'the store products are read from the sites');
    assert.ok(calls.every(u => u.searchParams.get('deliver_to') === 'GB'), 'for the UK');
  }
});

for (const [cc, lang, none, noneBf] of [
  ['GR', 'el-GR', `Κανένα κατάστημα του ${MS} δεν εμφανίζεται ακόμα για τη χώρα σας.`, 'Κανένα κατάστημα με κωδικούς Black Friday δεν εμφανίζεται ακόμα για τη χώρα σας.'],
  ['CY', 'el-GR', `Κανένα κατάστημα του ${MS} δεν εμφανίζεται ακόμα για τη χώρα σας.`, null],
  ['DE', 'de-DE', `Noch kein Händler von ${MS} ist für Ihr Land aufgeführt.`, null],
  ['PL', 'pl-PL', `Żaden sklep z ${MS} nie jest jeszcze wyświetlany dla Twojego kraju.`, null],
  ['US', 'en-GB', `No store of ${MS} is listed for your country yet.`, 'No store with Black Friday codes is listed for your country yet.'],
  ['IE', 'en-GB', `No store of ${MS} is listed for your country yet.`, null],
  ['XX', 'en-GB', `No store of ${MS} is listed for your country yet.`, null]
]) {
  test(`L210: ${cc}: no store, Black Friday store, code or Amazon of the UK; a line says so; the guides stay`, async () => {
    const { r, text, calls } = await get('/', { cc });
    assert.equal(r.status, 200);
    assert.ok(text.startsWith(`<!doctype html>\n<html lang="${lang}">`), `${cc}: ${lang}`);
    assert.equal(r.headers.get('Cache-Control'), 'private, max-age=60');
    for (const n of ALL_NAMES) assert.ok(!text.includes(n), `${cc}: no "${n}"`);
    assert.ok(!/amazon/i.test(text), `${cc}: no Amazon at all (as with AMAZON_LINKS=off)`);
    assert.ok(!text.includes('£'), `${cc}: no money of a UK code`);
    assert.ok(!text.includes('/discount-codes/') && !text.includes('class="promo-card"') && !text.includes('class="bf-started"'), `${cc}: no codes`);
    assert.ok(!text.includes('/black-friday/'), `${cc}: no button to the Hub's Black Friday page (the same UK stores)`);
    assert.ok(!text.includes('href="/stores/'), `${cc}: no store links`);
    assert.ok(!text.includes('class="jump" href="/#stores"'), `${cc}: no stores button in the hero`);
    assert.ok(text.includes(none), `${cc}: the line that says so`);
    if (noneBf) assert.ok(text.includes(noneBf), `${cc}: the Black Friday line`);
    assert.ok(text.includes('id="black-friday"') && text.includes('class="bf-count"'), `${cc}: the countdown stays`);
    assert.ok(text.includes('id="guides"') && text.includes('href="/guides/tech-gift-ideas/"'), `${cc}: the gift guides stay`);
    assert.equal(calls.length, 0, `${cc}: no store products read from the sites`);
  });
}

test('L210: a store page from Greece says the store is not listed there: no products, no codes, no links to them', async () => {
  for (const s of awinStores(site)) {
    const { r, text, calls } = await get(`/stores/${s.slug}/`, { cc: 'GR' });
    assert.equal(r.status, 200, s.slug);
    assert.ok(text.includes(`Το κατάστημα <span translate="no">${s.name}</span> δεν εμφανίζεται ακόμα για τη χώρα σας.`), `${s.slug}: the line`);
    assert.ok(!text.includes('class="pcards"') && !text.includes('/discount-codes/') && !text.includes('/search?') && !/amazon/i.test(text), `${s.slug}: nothing to use`);
    assert.ok(!text.includes('£'), s.slug);
    assert.equal(calls.length, 0, `${s.slug}: nothing read from the sites`);
    assert.ok(text.includes('<link rel="canonical" href="https://megastoresgearworld.com/stores/'), `${s.slug}: the same canonical`);
  }
  const uk = await get('/stores/tooled-up/', { cc: 'GB' });
  assert.ok(uk.text.includes('class="pcards"'), 'the UK page has the products');
  const amz = await get('/stores/amazon/', { cc: 'GR' });
  assert.equal(amz.r.status, 404, 'Amazon UK from Greece: the page of AMAZON_LINKS=off');
  assert.ok(!/amazon/i.test(amz.text));
  assert.equal((await get('/stores/amazon/', { cc: 'GB' })).r.status, 200);
});

test('L210: the guides from Greece and the US: Gear World buttons only, and no UK-only advice', async () => {
  for (const cc of ['GR', 'US']) {
    for (const p of GUIDE_PAGES) {
      const { r, text } = await get(p, { cc });
      assert.equal(r.status, 200, `${cc} ${p}`);
      assert.ok(!/amazon/i.test(text), `${cc} ${p}: no Amazon UK`);
      assert.ok(text.includes('class="btn btn-gw"'), `${cc} ${p}: the Gear World buttons`);
      assert.ok(!/\bUK\b|UKCA|ΗΒ\b|Ηνωμένο Βασίλειο/.test(text.slice(0, text.indexOf('<footer'))), `${cc} ${p}: no UK-only advice (the footer names where the operator is)`);
    }
  }
  const gr = await get('/guides/christmas-gift-ideas-for-him/', { cc: 'GR' });
  assert.ok(gr.text.includes('Ελέγξτε τους κανόνες της χώρας σας για τη μεταφορά λάμας σε δημόσιο χώρο'), 'the multi-tool line for abroad');
  const us = await get('/guides/christmas-gift-ideas-for-kids/', { cc: 'US' });
  assert.ok(us.text.includes('Always check the age on the box and the safety marks before you choose.'));
  const uk = await get('/guides/christmas-gift-ideas-for-him/', { cc: 'GB' });
  assert.ok(uk.text.includes('UK law: in public') && uk.text.includes('amazon.co.uk'), 'the UK keeps its own lines and Amazon UK');
});

test('L210: Google from Greece reads the UK page; the QA bot may ask for Greece; the sitemap keeps the Amazon page', async () => {
  const g = await get('/', { cc: 'GR', ua: GOOGLE });
  assert.ok(g.text.startsWith('<!doctype html>\n<html lang="en-GB">'));
  for (const n of STORE_NAMES) assert.ok(g.text.includes(`>${n}<`), `Google: ${n}`);
  const qa = await get('/', { ua: QA, headers: { 'X-GW-QA-Country': 'GR' } });
  assert.ok(qa.text.includes('Κανένα κατάστημα του'), 'the QA check of Greece');
  const sm = await get('/sitemap.xml', { cc: 'GR' });
  assert.ok(sm.text.includes('https://megastoresgearworld.com/stores/amazon/'), 'the sitemap is the same for every country');
});

test('L210: a store that also delivers to Greece shows there, while its UK Black Friday codes stay for the UK', async () => {
  const s = { ...site, stores: site.stores.map(x => (x.slug === 'joybuy' ? { ...x, deliversTo: ['GB', 'GR'] } : x)) };
  const { text, calls } = await get('/', { cc: 'GR', s });
  assert.ok(text.includes('>Joybuy<') && text.includes('href="/stores/joybuy/"'), 'Joybuy for Greece');
  assert.ok(!text.includes('>Tooled Up<'), 'the UK-only stores stay hidden');
  assert.ok(!text.includes('class="bf-started"') && !text.includes('£'), 'black-friday.json and promos.js give Joybuy\'s coupons for the UK: they stay hidden');
  assert.ok(!text.includes('stores-none'));
  assert.ok(calls.length > 0 && calls.every(u => u.searchParams.get('retailer') === 'Joybuy'), 'only Joybuy is read');
  const page = await get('/stores/joybuy/', { cc: 'GR', s });
  assert.ok(page.text.includes('class="pcards"'), 'its page has its products');
});

test('L210: no entry anywhere: the Hub button only for the UK; a code of black-friday.json only for its own countries', async () => {
  const none = { ...site, stores: site.stores.filter(x => x.amazon), earlyBlackFriday: { ...site.earlyBlackFriday, started: [], codes: [] } };
  const gb = await get('/', { cc: 'GB', s: none });
  assert.ok(gb.text.includes('https://gearworldhub.com/black-friday/'), 'the UK: the Hub button as before');
  const gr = await get('/', { cc: 'GR', s: none });
  assert.ok(!gr.text.includes('/black-friday/') && !gr.text.includes('bf-none'), 'Greece: no Hub button and no line when nothing runs anywhere');
  const bf = site.earlyBlackFriday;
  const ie = { ...site, earlyBlackFriday: { ...bf, started: bf.started.map(r => (r.slug === 'joybuy' ? { ...r, deliversTo: ['GB', 'IE'] } : r)) } };
  const x = await get('/', { cc: 'IE', s: ie });
  assert.ok(x.text.includes('>Joybuy<') && x.text.includes('class="bf-started"'), 'an entry listed for Ireland shows there');
  assert.ok(!x.text.includes('class="promo-card"') && !x.text.includes('£'), 'its codes have no deliversTo: the UK only');
});
