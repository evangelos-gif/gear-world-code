// Mega Stores without the stores of a network until it approves the site (owner, 22 Nov 2026: "we will declare it but
// we will hide it", lessons L215). Linkwise approves every page that shows its stores before any promotion; until its
// email approved megastoresgearworld.com (23 Nov 2026), the 7 Greek (Linkwise) stores were on no page, card, code or
// Black Friday entry, and Greece and Cyprus got the page of a country with no store. The live config hides nothing now;
// HIDDEN (the live config with hiddenNetworks: ['linkwise']) keeps the rule tested for the next network. Fake fetch, a
// fixed day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import site from '../../sites/ogw/site.config.js';
import { createGuidesWorker, storeListed, awinStores, shownStores, earlyBlackFriday, pagePaths } from '../../src/marketplace-guides.js';

const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-22T12:00:00Z');
const ON = { AMAZON_LINKS: 'on' };
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const GOOGLE = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const QA = 'GearWorldQA-bot/1.0 (+read-only check)';
const OPEN = site;
const HIDDEN = { ...site, hiddenNetworks: ['linkwise'] };

function makeFetch() {
  const calls = [];
  const f = async input => {
    const u = new URL(String(input));
    calls.push(u);
    const rows = [1, 2, 3].map(n => ({ product_name: `Item ${n}`, brand: 'Acme', retailer: u.searchParams.get('retailer'), stock_status: 'in_stock',
      image_url: `https://img.example/${n}.jpg`, delivers_to: [u.searchParams.get('deliver_to')], product_url: `https://${u.hostname}/product/p-${n}/` }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  f.calls = calls;
  return f;
}

async function get(path, { cc = null, ua = BROWSER, headers = {}, s = HIDDEN, env = ON } = {}) {
  const fetch = makeFetch();
  const w = createGuidesWorker(s, { fetch, cache: null, now: () => NOW });
  const req = new Request(LIVE + path, { headers: { 'user-agent': ua, ...headers } });
  if (cc) Object.defineProperty(req, 'cf', { value: { country: cc } });
  const r = await w.fetch(req, env);
  return { r, text: await r.text(), calls: fetch.calls };
}

const LINKWISE = site.stores.filter(s => s.network === 'linkwise');
const NAMES = LINKWISE.map(s => s.name);

test('L215: Linkwise approved megastoresgearworld.com (23 Nov 2026): the live config hides no network', () => {
  assert.deepEqual(site.hiddenNetworks, [], 'nothing hidden after the approval');
  for (const s of site.stores) assert.equal(storeListed(site, s), true, s.slug);
  assert.equal(awinStores(site).filter(s => s.network === 'linkwise').length, 7, 'the 7 are read for products again');
  assert.deepEqual(shownStores(site, 'on', 'GR').map(s => s.slug), LINKWISE.map(s => s.slug), 'Greece: the 7');
  assert.deepEqual(shownStores(site, 'on', 'CY').map(s => s.slug), ['parex-gr', 'tsakiris-mallas-gr'], 'Cyprus: Parex and Tsakiris Mallas');
});

test('L215: after the approval Greece and Cyprus get their stores, and a Greek store page exists again', async () => {
  const gr = await get('/', { cc: 'GR', s: site });
  assert.equal(gr.r.status, 200);
  for (const s of LINKWISE) assert.ok(gr.text.includes(`href="/stores/${s.slug}/"`), `Greece: ${s.slug}`);
  assert.ok(!gr.text.includes('stores-none'), 'Greece: not the "no store" line');
  const cy = await get('/', { cc: 'CY', s: site });
  for (const slug of ['parex-gr', 'tsakiris-mallas-gr']) assert.ok(cy.text.includes(`href="/stores/${slug}/"`), `Cyprus: ${slug}`);
  assert.ok(!cy.text.includes('href="/stores/kouzinika-gr/"'), 'Cyprus: not a store listed for Greece only');
  const page = await get('/stores/kouzinika-gr/', { cc: 'GR', s: site });
  assert.equal(page.r.status, 200);
  assert.ok(page.text.includes('Kouzinika GR') && !page.text.includes('<meta name="robots" content="noindex">'), 'its page, indexed');
});

test('L215: the 7 Greek stores are Linkwise stores, and a hidden network is hidden everywhere', () => {
  assert.deepEqual(LINKWISE.map(s => s.slug), ['kouzinika-gr', 'katoikein-gr', 'minipini-gr', 'xxxl-leo-gr', 'casualshoes-gr', 'parex-gr', 'tsakiris-mallas-gr']);
  for (const s of LINKWISE) assert.equal(storeListed(HIDDEN, s), false, s.slug);
  for (const s of site.stores.filter(x => !x.network)) assert.equal(storeListed(HIDDEN, s), true, s.slug);
  assert.ok(!awinStores(HIDDEN).some(s => s.network === 'linkwise'), 'not among the stores read for products');
  for (const cc of ['GR', 'CY']) assert.deepEqual(shownStores(HIDDEN, 'on', cc), [], `${cc}: no store`);
  assert.equal(shownStores(OPEN, 'on', 'GR').length, 7, 'without the hidden list: the 7');
  const bf = { ...HIDDEN, earlyBlackFriday: { ...site.earlyBlackFriday, started: [{ slug: 'parex-gr', name: 'Parex GR', from: '2026-11-20', hide: '2026-12-01', sites: ['MGW'], deliversTo: ['GR'] }], codes: [] } };
  assert.deepEqual(earlyBlackFriday(bf, NOW, 'GR'), [], 'no Black Friday entry of a hidden store either');
  assert.equal(earlyBlackFriday({ ...bf, hiddenNetworks: [] }, NOW, 'GR').length, 1, 'which shows once Linkwise is no longer hidden');
});

for (const cc of ['GR', 'CY']) {
  test(`L215: ${cc}: the site stays open, with no store, the "no store for your country" line and the gift guides`, async () => {
    const { r, text, calls } = await get('/', { cc });
    assert.equal(r.status, 200);
    assert.ok(text.startsWith('<!doctype html>\n<html lang="el-GR">'), 'in Greek');
    for (const n of NAMES) assert.ok(!text.includes(n), `${cc}: no ${n}`);
    assert.ok(!text.includes('href="/stores/'), 'no store link');
    assert.ok(text.includes('stores-none'), 'the line that says no store is listed for the country');
    assert.ok(!/amazon/i.test(text) && !text.includes('£'), 'no Amazon UK, no UK code');
    assert.ok(text.includes('id="guides"') && text.includes('id="black-friday"'), 'the guides and the countdown stay');
    assert.equal(calls.length, 0, 'no product of a hidden store is read from the sites');
  });
}

test('L215: a hidden store has no page for anyone: 404, noindex, without its name', async () => {
  for (const s of LINKWISE) {
    for (const [cc, ua] of [['GR', BROWSER], ['CY', BROWSER], ['GB', BROWSER], [null, GOOGLE]]) {
      const { r, text, calls } = await get(`/stores/${s.slug}/`, { cc, ua });
      assert.equal(r.status, 404, `${s.slug} ${cc}`);
      assert.ok(text.includes('<meta name="robots" content="noindex">'), `${s.slug}: noindex`);
      assert.ok(!text.includes(s.name), `${s.slug}: its name is not on the page`);
      assert.equal(calls.length, 0);
    }
  }
});

test('L215: the UK, Google, the sitemap and every other country are exactly as with the network shown', async () => {
  for (const [path, opts] of [['/', { cc: 'GB' }], ['/', { ua: GOOGLE }], ['/', { cc: 'US' }], ['/', { cc: 'DE' }], ['/stores/joybuy/', { cc: 'GB' }],
    ['/stores/joybuy/', { cc: 'US' }], ['/stores/amazon/', { cc: 'GB' }], ['/guides/christmas-gift-ideas-for-him/', { cc: 'GB' }]]) {
    const now = await get(path, opts);
    const open = await get(path, { ...opts, s: OPEN });
    assert.equal(now.r.status, open.r.status, path);
    assert.equal(now.text, open.text, `${path} ${JSON.stringify(opts)}: the same page as with Linkwise shown`);
  }
  // The sitemap: the same, but the Greece edition (L214) has no page for a hidden store.
  const hiddenPages = LINKWISE.map(s => `/gr/stores/${s.slug}/`);
  assert.deepEqual(pagePaths(HIDDEN, 'on'), pagePaths(OPEN, 'on').filter(p => !hiddenPages.includes(p)), 'only the /gr/ pages of the hidden stores are left out');
  for (const p of hiddenPages) assert.ok(pagePaths(OPEN, 'on').includes(p), `${p} in the sitemap once shown`);
  const ed = await get('/gr/', { cc: 'GR' });
  assert.equal(ed.r.status, 200);
  for (const n of NAMES) assert.ok(!ed.text.includes(n), `/gr/: no ${n} while hidden`);
  const edStore = await get('/gr/stores/kouzinika-gr/', { cc: 'GR' });
  assert.equal(edStore.r.status, 404, '/gr/stores/kouzinika-gr/: no page while hidden');
  // Greece: the menu has no stores link any more (no store for the country), as for the US.
  const g = await get('/guides/christmas-gift-ideas-for-him/', { cc: 'GR' });
  assert.ok(!g.text.includes('class="top-link" href="/#stores"') && g.text.includes('class="top-link" href="/#guides"'), 'Greece: the menu as for a country with no store');
  const qa = await get('/', { ua: QA, headers: { 'X-GW-QA-Country': 'GR' } });
  assert.ok(qa.text.includes('stores-none') && !qa.text.includes('Kouzinika'), 'the QA check of Greece sees the same');
});
