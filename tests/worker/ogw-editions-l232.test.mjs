// Mega Stores in Germany, Austria, the Netherlands, Belgium, the US and Poland (owner, 25 Nov 2026: «να έχουν το δικό
// τους megastore και οι καινούριες και η Πολωνία», lessons L232): each its own edition like /gr/ (L214), in the language
// of the country, with the stores of the Gear World sites listed there, open only with at least 3 of them. Fake fetch,
// a fixed day, never the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import site from '../../sites/ogw/site.config.js';
import {
  createGuidesWorker, deliversHere, awinStores, editionStores, editionOpen, openEditions, pagePaths, storeIn, storeCacheKey,
  productCountry, EDITIONS, MIN_EDITION_STORES, I18N_MISSING
} from '../../src/marketplace-guides.js';

const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-28T12:00:00Z');
const ON = { AMAZON_LINKS: 'on' };
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const GOOGLE = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function makeFetch() {
  const calls = [];
  const f = async input => {
    const u = new URL(String(input));
    calls.push(u);
    const r = u.searchParams.get('retailer');
    const to = u.searchParams.get('deliver_to');
    const rows = u.searchParams.get('q') ? [] : [1, 2, 3].map(n => ({ product_name: `Item ${r} ${to} ${n}`, brand: 'Acme', retailer: r, stock_status: 'in_stock',
      image_url: `https://img.example/${n}.jpg`, delivers_to: [to], product_url: `https://${u.hostname}/product/p-${n}/` }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  f.calls = calls;
  return f;
}

async function get(path, { cc = null, ua = BROWSER, env = ON, s = site } = {}) {
  const fetch = makeFetch();
  const w = createGuidesWorker(s, { fetch, cache: null, now: () => NOW });
  const req = new Request(LIVE + path, { headers: { 'user-agent': ua } });
  if (cc) Object.defineProperty(req, 'cf', { value: { country: cc } });
  const r = await w.fetch(req, env);
  return { r, text: await r.text(), calls: fetch.calls };
}

const NEW = EDITIONS.filter(e => e.minStores);
const UK = awinStores(site).filter(s => deliversHere(s, 'GB'));
const GREEK = awinStores(site).filter(s => deliversHere(s, 'GR'));
const TITLE = { 'de-DE': 'Händler und Geschenkratgeber', 'nl-NL': null, 'pl-PL': 'Sklepy i poradniki prezentowe', 'en-GB': 'Stores and gift guides' };

test('L232: six new editions, each in its country\'s language, its own hreflang, at least 3 stores; Ireland not yet', () => {
  assert.deepEqual(EDITIONS.map(e => [e.prefix, e.country, e.lang, e.hreflang]), [
    ['/gr', 'GR', 'el-GR', 'el-GR'], ['/de', 'DE', 'de-DE', 'de-DE'], ['/at', 'AT', 'de-DE', 'de-AT'], ['/nl', 'NL', 'nl-NL', 'nl-NL'],
    ['/be', 'BE', 'nl-NL', 'nl-BE'], ['/us', 'US', 'en-GB', 'en-US'], ['/pl', 'PL', 'pl-PL', 'pl-PL']]);
  assert.equal(new Set(EDITIONS.map(e => e.hreflang)).size, EDITIONS.length, 'one hreflang per edition');
  const langs = new Set(site.languages.map(l => l.code));
  for (const e of EDITIONS) assert.ok(langs.has(e.lang), `${e.prefix}: a language of the site`);
  assert.equal(MIN_EDITION_STORES, 3);
  assert.deepEqual(NEW.map(e => e.minStores), [3, 3, 3, 3, 3, 3]);
  const counts = Object.fromEntries(NEW.map(e => [e.country, editionStores(site, e).length]));
  assert.deepEqual(counts, { DE: 6, AT: 4, NL: 7, BE: 4, US: 11, PL: 3 });
  assert.deepEqual(openEditions(site).map(e => e.prefix), EDITIONS.map(e => e.prefix), 'every edition is open');
  assert.ok(!EDITIONS.some(e => e.country === 'IE'), 'Ireland waits for its stores (chat 7)');
  // The new stores: Gear World site stores (no network, no logo), listed only for these six countries.
  const fresh = awinStores(site).filter(s => (s.deliversTo || []).some(c => NEW.some(e => e.country === c)));
  assert.equal(fresh.length, 23);
  for (const s of fresh) {
    assert.ok(s.deliversTo.every(c => NEW.some(e => e.country === c)), `${s.slug}: only the six countries`);
    assert.ok(!deliversHere(s, 'GB') && !deliversHere(s, 'GR') && !deliversHere(s, 'CY'), `${s.slug}: never the UK or Greece`);
    assert.ok(s.sites.length >= 1 && s.sites.length <= 6, `${s.slug}: its Gear World sites`);
    assert.ok(!/\b(shop|shopping|cart|sale|official|partner)\b/i.test(s.line), `${s.slug}: L107`);
  }
  assert.equal(new Set(site.stores.map(s => s.slug)).size, site.stores.length, 'every slug once');
});

for (const e of NEW) {
  const own = editionStores(site, e);
  test(`L232: ${e.prefix}/ in ${e.hreflang}: its stores, read for ${e.country}; no UK or Greek store, no Amazon; its canonical and hreflang`, async () => {
    for (const [ua, cc] of [[GOOGLE, null], [BROWSER, 'GB'], [BROWSER, e.country]]) {
      const { r, text, calls } = await get(`${e.prefix}/`, { ua, cc });
      assert.equal(r.status, 200);
      assert.ok(text.startsWith(`<!doctype html>\n<html lang="${e.hreflang}">`), `${e.prefix}: ${e.hreflang}`);
      assert.equal(r.headers.get('Content-Language'), e.hreflang, 'the language of the country (review 25/11/2026)');
      assert.ok(text.includes(`<link rel="canonical" href="${LIVE}${e.prefix}/">`));
      for (const x of EDITIONS) assert.ok(text.includes(`<link rel="alternate" hreflang="${x.hreflang}" href="${LIVE}${x.prefix}/">`), `hreflang ${x.hreflang}`);
      assert.ok(text.includes(`<link rel="alternate" hreflang="en-GB" href="${LIVE}/">`) && text.includes(`<link rel="alternate" hreflang="x-default" href="${LIVE}/">`));
      assert.ok(!text.includes('name="robots"'), 'indexed');
      const title = (text.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
      if (TITLE[e.lang]) assert.ok(title.startsWith(`${TITLE[e.lang]} · `), `the title (${e.lang}): ${title}`);
      assert.ok(title.endsWith(` · ${new Intl.DisplayNames([e.lang], { type: 'region' }).of(e.country)} | Mega Stores Gear World`), `the title names the country: ${title}`);
      for (const s of own) assert.ok(text.includes(`href="${e.prefix}/stores/${s.slug}/"`), s.name);
      for (const s of [...UK, ...GREEK]) assert.ok(!text.includes(`/stores/${s.slug}/`), `no ${s.name}`);
      assert.ok(!/amazon/i.test(text) && !text.includes('£') && !text.includes('class="promo-card"'), 'nothing of the UK');
      assert.ok(!text.includes('stores-none'));
      assert.ok(calls.length > 0 && calls.every(u => u.searchParams.get('deliver_to') === e.country), 'products read for the country');
      assert.deepEqual([...new Set(calls.map(u => u.searchParams.get('retailer')))].sort(), own.map(s => s.name).sort(), 'only its own stores are read');
    }
  });
}

test('L232: a store page of an edition: its products for that country, in its language; another edition\'s store is a 404', async () => {
  for (const e of NEW) {
    for (const s of editionStores(site, e)) {
      const { r, text, calls } = await get(`${e.prefix}/stores/${s.slug}/`, { cc: 'GB' });
      assert.equal(r.status, 200, `${e.prefix} ${s.slug}`);
      assert.ok(text.startsWith(`<!doctype html>\n<html lang="${e.hreflang}">`));
      assert.ok(text.includes(`<link rel="canonical" href="${LIVE}${e.prefix}/stores/${s.slug}/">`));
      assert.ok(text.includes(`<span translate="no">Item ${s.name} ${e.country} 1</span>`) || text.includes(`>Item ${s.name} ${e.country} 1<`), `${s.slug}: products for ${e.country}`);
      assert.ok(calls.length > 0 && calls.every(u => u.searchParams.get('deliver_to') === e.country && u.searchParams.get('retailer') === s.name));
      assert.ok(!text.includes('name="robots"') && !text.includes('store-elsewhere'));
    }
  }
  const other = await get('/pl/stores/westwing-de/', { cc: 'PL' });
  assert.equal(other.r.status, 404, 'Westwing DE is not listed for Poland');
  const uk = await get('/de/stores/joybuy/', { cc: 'DE' });
  assert.equal(uk.r.status, 404, 'no UK store in an edition');
});

test('L232: a store listed for several countries: each country its own products and its own cache copy; Cyprus as before', async () => {
  const reidl = site.stores.find(s => s.slug === 'reidl');
  assert.equal(productCountry(reidl), 'DE');
  assert.equal(storeIn(reidl, 'DE'), reidl, 'its first country: the store itself');
  assert.deepEqual(storeIn(reidl, 'AT').deliversTo, ['AT', 'DE']);
  assert.equal(storeIn(reidl, 'PL'), reidl, 'a country it is not listed for: as it is');
  assert.notEqual(storeCacheKey(site, storeIn(reidl, 'AT')), storeCacheKey(site, reidl));
  assert.ok(storeCacheKey(site, storeIn(reidl, 'AT')).endsWith('&cc=AT'));
  assert.equal(storeCacheKey(site, reidl), `${LIVE}/__cache/stores/reidl?v=${encodeURIComponent(site.assetVersion)}`, 'its first country: the key as every other store\'s');
  // Review 25/11/2026: the UK and Greek keys stay byte for byte (no cold cache for /gr/).
  for (const x of site.stores) assert.ok(!storeCacheKey(site, x).includes('&cc='), `${x.slug}: its key as before`);
  const joybuy = site.stores.find(s => s.slug === 'joybuy');
  assert.equal(storeCacheKey(site, joybuy), `${LIVE}/__cache/stores/joybuy?v=${encodeURIComponent(site.assetVersion)}`, 'the UK keys stay as they were');
  const parex = site.stores.find(s => s.slug === 'parex-gr');
  assert.equal(storeIn(parex, 'CY'), parex, 'Cyprus has no edition: the Greek stores stay read for Greece');
  assert.equal(storeIn({ slug: 'x', sites: ['HGW'], deliversTo: ['WORLD'] }, 'DE').deliversTo[0], 'WORLD', 'WORLD only: as it is');
  const at = await get('/at/stores/reidl/', { cc: 'AT' });
  const de = await get('/de/stores/reidl/', { cc: 'DE' });
  assert.ok(at.calls.every(u => u.searchParams.get('deliver_to') === 'AT') && de.calls.every(u => u.searchParams.get('deliver_to') === 'DE'));
  // A visitor from Austria on the international address: the stores listed for Austria, read for Austria.
  const intl = await get('/', { cc: 'AT' });
  for (const s of editionStores(site, EDITIONS.find(e => e.country === 'AT'))) assert.ok(intl.text.includes(`href="/stores/${s.slug}/"`), s.slug);
  assert.ok(intl.calls.length > 0 && intl.calls.every(u => u.searchParams.get('deliver_to') === 'AT'));
  const page = await get('/stores/reidl/', { cc: 'AT' });
  assert.ok(page.calls.length > 0 && page.calls.every(u => u.searchParams.get('deliver_to') === 'AT'));
  // Review 25/11/2026: its "All … products on …" links ask the Gear World site for the page's country (?for=), never
  // another (the site would keep that country in its gw_for cookie for a day).
  for (const [path, cc, want] of [['/at/stores/reidl/', 'GB', 'at'], ['/de/stores/reidl/', 'GB', 'de'], ['/be/stores/refurbed-nl/', 'GB', 'be'],
    ['/be/stores/vevor/', 'GB', 'be'], ['/pl/stores/home-tex/', 'GB', 'pl'], ['/stores/home-tex/', 'BE', 'be'], ['/stores/reidl/', 'AT', 'at']]) {
    const t = (await get(path, { cc })).text;
    const fors = [...t.matchAll(/[?&](?:amp;)?for=([a-z]{2})/g)].map(m => m[1]);
    assert.ok(fors.length > 0 && fors.every(f => f === want), `${path} from ${cc}: for=${want} (${fors.join(',')})`);
  }
  const elsewhere = await get('/stores/reidl/', { cc: 'GB' });
  assert.ok(elsewhere.text.includes('store-elsewhere') && elsewhere.calls.length === 0, 'from the UK: not listed there, nothing read');
});

test('L232: an edition with fewer than 3 stores is closed: its addresses go to the international page, no sitemap, no hreflang', async () => {
  // Poland with only AliExpress PL and HOME-TEX.
  const s = { ...site, stores: site.stores.filter(x => x.slug !== 'invicta-stores') };
  const pl = EDITIONS.find(e => e.country === 'PL');
  assert.equal(editionStores(s, pl).length, 2);
  assert.equal(editionOpen(s, pl), false);
  assert.ok(editionOpen(s, EDITIONS.find(e => e.country === 'DE')), 'Germany keeps 5');
  const home = await get('/pl/', { s, cc: 'PL' });
  assert.equal(home.r.status, 302);
  assert.equal(home.r.headers.get('Location'), `${LIVE}/`);
  const store = await get('/pl/stores/aliexpress-pl/?lang=pl-PL', { s, cc: 'PL' });
  assert.equal(store.r.status, 302);
  assert.equal(store.r.headers.get('Location'), `${LIVE}/stores/aliexpress-pl/?lang=pl-PL`, 'the same page, the language kept');
  const bare = await get('/pl', { s });
  assert.equal(bare.r.headers.get('Location'), `${LIVE}/`);
  assert.ok(!pagePaths(s, 'on').some(p => p.startsWith('/pl/')), 'not in the sitemap');
  const uk = await get('/', { s, ua: GOOGLE });
  assert.ok(!uk.text.includes('<link rel="alternate" hreflang="pl-PL"') && uk.text.includes('<link rel="alternate" hreflang="de-DE"'), 'no hreflang for Poland, the others stay');
  const intl = await get('/', { s, cc: 'PL' });
  assert.ok(intl.text.includes('href="/stores/aliexpress-pl/"'), 'its stores stay on the international page for Poland (L210)');
  // Greece has no minimum (L214, L215): its addresses never move.
  const noGreek = { ...site, stores: site.stores.filter(x => !deliversHere(x, 'GR')) };
  assert.ok(editionOpen(noGreek, EDITIONS[0]));
  assert.equal((await get('/gr/', { s: noGreek })).r.status, 200);
});

test('L232: the sitemap lists each new edition and its store pages; the UK page names them all', async () => {
  const paths = pagePaths(site, 'on');
  for (const e of NEW) {
    assert.ok(paths.includes(`${e.prefix}/`), e.prefix);
    for (const s of editionStores(site, e)) assert.ok(paths.includes(`${e.prefix}/stores/${s.slug}/`), `${e.prefix} ${s.slug}`);
  }
  assert.equal(new Set(paths).size, paths.length, 'every address once');
  const sm = await get('/sitemap.xml');
  assert.ok(sm.text.includes(`<loc>${LIVE}/at/stores/reidl/</loc>`) && sm.text.includes(`<loc>${LIVE}/us/stores/temu/</loc>`));
  const uk = await get('/', { ua: GOOGLE });
  assert.ok(uk.text.startsWith('<!doctype html>\n<html lang="en-GB">'));
  for (const e of EDITIONS) assert.ok(uk.text.includes(`<link rel="alternate" hreflang="${e.hreflang}" href="${LIVE}${e.prefix}/">`), e.hreflang);
  for (const s of awinStores(site).filter(x => !deliversHere(x, 'GB'))) assert.ok(!uk.text.includes(`/stores/${s.slug}/`), `the UK page: no ${s.slug}`);
});

test('L232: every page of the new editions has all its texts in its language', async () => {
  I18N_MISSING.clear();
  for (const e of NEW) {
    for (const p of [`${e.prefix}/`, ...editionStores(site, e).map(s => `${e.prefix}/stores/${s.slug}/`)]) await get(p, { cc: e.country });
  }
  assert.deepEqual([...I18N_MISSING], []);
});
