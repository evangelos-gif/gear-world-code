// Mega Stores Gear World by country (owner, 21 Nov 2026: "they opened Mega Stores from Greece and it shows them all the
// stores it has for England, and the offers: this is wrong" / "can't they be hidden for Greece and the other countries
// they don't deliver to?", lessons L210). Each store, its Black Friday entry, its codes and Amazon UK show only to the
// countries they deliver to; Google and the other crawlers read the UK page. Fake fetch, a fixed day, never the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import liveSite from '../../sites/ogw/site.config.js';
import {
  createGuidesWorker, deliversHere, amazonHere, viewMode, viewCountry, shownStores, storeCodes, earlyBlackFriday, blackFridayParts, awinStores
} from '../../src/marketplace-guides.js';
// The Linkwise stores are hidden until Linkwise approves this site (L215, tests/worker/ogw-hidden.test.mjs): these tests
// check the per-country rules as they will be after the approval (hiddenNetworks empty).
const site = { ...liveSite, hiddenNetworks: [] };

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
    // The showcase's searches (L221, its own tests) find nothing here: this file is about the store's own list.
    const rows = u.searchParams.get('q') ? [] : [1, 2, 3].map(n => ({ product_name: `Item ${host.split('.')[0]} ${n}`, brand: 'Acme', retailer: r, stock_status: 'in_stock',
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

// The UK stores and Black Friday names of this site's data (listed for the UK only), and the Greek stores (owner,
// 21 Nov 2026: the Linkwise offers for Greece, listed for Greece, and two of them for Cyprus too).
const UK_STORES = awinStores(site).filter(s => deliversHere(s, 'GB'));
const GR_STORES = awinStores(site).filter(s => deliversHere(s, 'GR'));
const STORE_NAMES = UK_STORES.map(s => s.name);
const GR_NAMES = GR_STORES.map(s => s.name);
const CY_NAMES = awinStores(site).filter(s => deliversHere(s, 'CY')).map(s => s.name);
const BF_NAMES = (site.earlyBlackFriday.started || []).map(r => r.name);
const UK_NAMES = [...new Set([...STORE_NAMES, ...BF_NAMES])];
const ALL_NAMES = [...UK_NAMES, ...GR_NAMES];
const GUIDE_PAGES = site.guides.map(g => `/guides/${g.slug}/`);

test('L210: where an entry delivers: its deliversTo, the UK when it has none, WORLD everywhere', () => {
  assert.equal(deliversHere({ deliversTo: ['GB'] }, 'GB'), true);
  assert.equal(deliversHere({ deliversTo: ['GB'] }, 'GR'), false);
  assert.equal(deliversHere({}, 'GB'), true, 'no deliversTo: the UK');
  assert.equal(deliversHere({}, 'GR'), false);
  assert.equal(deliversHere({ deliversTo: ['gb', 'gr'] }, 'GR'), true, 'any letter case');
  assert.equal(deliversHere({ deliversTo: ['WORLD'] }, 'JP'), true);
  assert.equal(amazonHere(site, 'GB'), true, 'Amazon UK for the UK');
  // The editions of L232 (25 Nov 2026): Germany 6, Poland 5 (with its 2 tyre stores) and the US 11 stores of the sites.
  const listed = { GR: GR_NAMES.length, CY: CY_NAMES.length, DE: 6, PL: 5, US: 11 };
  assert.deepEqual([GR_NAMES.length, CY_NAMES.length], [7, 2], 'the 7 Greek stores, 2 of them for Cyprus too');
  for (const cc of ['GR', 'CY', 'US', 'DE', 'PL', 'IE', 'JP', 'XX', 'T1']) {
    assert.equal(amazonHere(site, cc), false, `${cc}: no Amazon UK`);
    assert.equal(viewMode(site, 'on', cc), 'off', `${cc}: the pages of AMAZON_LINKS=off`);
    assert.equal(shownStores(site, 'on', cc).length, listed[cc] || 0, `${cc}: only the stores listed there`);
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
    for (const n of GR_NAMES) assert.ok(!text.includes(n), `${cc}: no Greek store "${n}"`);
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
  // Germany, Poland and the US have their stores since L232 (their tests: tests/worker/ogw-editions-l232.test.mjs).
  ['IT', 'it-IT', `Nessun negozio di ${MS} è ancora elencato per il tuo paese.`, null],
  ['ES', 'es-ES', `Todavía no hay ninguna tienda de ${MS} para tu país.`, null],
  ['JP', 'en-GB', `No store of ${MS} is listed for your country yet.`, 'No store with Black Friday codes is listed for your country yet.'],
  ['IE', 'en-GB', `No store of ${MS} is listed for your country yet.`, null],
  ['XX', 'en-GB', `No store of ${MS} is listed for your country yet.`, null]
]) {
  test(`L210: ${cc}: no store, Black Friday store, code or Amazon; a line says so; the guides stay`, async () => {
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
    assert.ok(!text.includes('class="top-link" href="/#stores"'), `${cc}: no stores link in the menu`);
    assert.ok(!text.includes('Stores and gift guides') && !text.includes('Καταστήματα'), `${cc}: titled as gift guides`);
    assert.ok(text.includes(none), `${cc}: the line that says so`);
    if (noneBf) assert.ok(text.includes(noneBf), `${cc}: the Black Friday line`);
    assert.ok(text.includes('id="black-friday"') && text.includes('class="bf-count"'), `${cc}: the countdown stays`);
    assert.ok(text.includes('id="guides"') && text.includes('href="/guides/tech-gift-ideas/"'), `${cc}: the gift guides stay`);
    assert.equal(calls.length, 0, `${cc}: no store products read from the sites`);
  });
}

for (const [cc, names] of [['GR', GR_NAMES], ['CY', CY_NAMES]]) {
  test(`L210: ${cc}: only the Greek stores listed there, with their photos; no UK store, code, Black Friday entry or Amazon`, async () => {
    const { r, text, calls } = await get('/', { cc });
    assert.equal(r.status, 200);
    assert.ok(text.startsWith('<!doctype html>\n<html lang="el-GR">'), `${cc}: Greek`);
    for (const n of names) assert.ok(text.includes(`<span translate="no">${n}</span>`), `${cc}: ${n}`);
    for (const n of [...UK_NAMES, ...GR_NAMES.filter(n => !names.includes(n))]) assert.ok(!text.includes(n), `${cc}: no "${n}"`);
    assert.ok(!/amazon/i.test(text) && !text.includes('£') && !text.includes('class="promo-card"') && !text.includes('class="bf-started"'), `${cc}: nothing of the UK`);
    assert.ok(!text.includes('/black-friday/'), `${cc}: no Hub Black Friday button`);
    assert.ok(text.includes('class="top-link" href="/#stores"') && text.includes('class="jump" href="/#stores"'), `${cc}: the stores in the menu and the hero`);
    assert.ok(!text.includes('stores-none'), `${cc}: no "none" line`);
    assert.ok(text.includes('Κανένα κατάστημα με κωδικούς Black Friday δεν εμφανίζεται ακόμα για τη χώρα σας.'), `${cc}: no Black Friday codes for it`);
    const thumbs = text.match(/<ul class="store-thumbs">/g) || [];
    assert.equal(thumbs.length, names.length, `${cc}: photos on every card`);
    assert.ok(calls.length > 0 && calls.every(u => u.searchParams.get('deliver_to') === 'GR' && GR_NAMES.includes(u.searchParams.get('retailer'))), `${cc}: only the Greek stores read, for Greece`);
    for (const n of names) assert.ok(calls.some(u => u.searchParams.get('retailer') === n), `${cc}: ${n} read`);
  });
}

test('L210: a Greek store page: its products for Greece; for the UK it is "not listed for your country"', async () => {
  for (const s of GR_STORES) {
    const gr = await get(`/stores/${s.slug}/`, { cc: 'GR' });
    assert.equal(gr.r.status, 200, s.slug);
    assert.ok(gr.text.includes('class="pcards"') && !gr.text.includes('store-elsewhere'), `${s.slug}: products for Greece`);
    assert.ok(gr.calls.every(u => u.searchParams.get('deliver_to') === 'GR' && u.searchParams.get('retailer') === s.name), `${s.slug}: read for Greece`);
    assert.ok(!/amazon/i.test(gr.text) && !gr.text.includes('£') && !gr.text.includes('/out/') && !gr.text.includes('/go/'), s.slug);
    const uk = await get(`/stores/${s.slug}/`, { cc: 'GB' });
    assert.ok(uk.text.includes(`<span translate="no">${s.name}</span> is not listed for your country yet.`) && !uk.text.includes('class="pcards"'), `${s.slug}: the UK page`);
    assert.equal(uk.calls.length, 0, `${s.slug}: nothing read for the UK`);
  }
  const cy = await get('/stores/kouzinika-gr/', { cc: 'CY' });
  assert.ok(cy.text.includes('store-elsewhere'), 'Kouzinika is listed for Greece only');
  assert.ok((await get('/stores/parex-gr/', { cc: 'CY' })).text.includes('class="pcards"'), 'Parex is listed for Cyprus too');
});

test('L210: a product name with a Greek offer word is left out', async () => {
  const fetch = async input => {
    const u = new URL(String(input));
    const r = u.searchParams.get('retailer');
    const names = ['ΠΡΟΣΦΟΡΑ Κούπα', 'Ταψί σε έκπτωση', 'Σετ δώρου', 'Κούπα πορσελάνης'];
    const rows = names.map((n, i) => ({ product_name: n, brand: 'Acme', retailer: r, stock_status: 'in_stock', image_url: `https://img.example/${i}.jpg`, delivers_to: ['GR'], product_url: `https://${u.hostname}/product/p-${i}/` }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const w = createGuidesWorker(site, { fetch, cache: null, now: () => NOW });
  const req = new Request(`${LIVE}/stores/kouzinika-gr/`, { headers: { 'user-agent': BROWSER } });
  Object.defineProperty(req, 'cf', { value: { country: 'GR' } });
  const text = await (await w.fetch(req, ON)).text();
  assert.ok(text.includes('Κούπα πορσελάνης'), 'a plain name stays');
  for (const n of ['ΠΡΟΣΦΟΡΑ Κούπα', 'Ταψί σε έκπτωση', 'Σετ δώρου']) assert.ok(!text.includes(n), `left out: ${n}`);
});

test('L210: a store page from Greece says the store is not listed there: no products, no codes, no links to them', async () => {
  for (const s of UK_STORES) {
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
  for (const n of GR_NAMES) assert.ok(!g.text.includes(n), `Google: no ${n}`);
  const qa = await get('/', { ua: QA, headers: { 'X-GW-QA-Country': 'GR' } });
  assert.ok(qa.text.includes('href="/stores/kouzinika-gr/"') && !qa.text.includes('>Joybuy<'), 'the QA check of Greece');
  const qaJp = await get('/', { ua: QA, headers: { 'X-GW-QA-Country': 'JP' } });
  assert.ok(qaJp.text.includes('stores-none'), 'the QA check of Japan (no store listed there)');
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
  assert.ok(calls.some(u => u.searchParams.get('retailer') === 'Joybuy'), 'Joybuy is read');
  assert.ok(calls.every(u => u.searchParams.get('retailer') === 'Joybuy' || GR_NAMES.includes(u.searchParams.get('retailer'))), 'no UK-only store is read');
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
  assert.ok(!x.text.includes('/black-friday/'), 'the Hub\'s Black Friday page (UK stores and codes in pounds): its button only for the UK');
});
