// Mega Stores for Greece at its own address (owner, 21 Nov 2026: "yes" to megastoresgearworld.com/gr/ for Google in
// Greece, lessons L214). Google reads the UK page (L195), so it never saw the Greek stores; /gr/ is the page for Greece,
// in Greek, for every visitor and for Google too, with hreflang el-GR next to the UK page. Fake fetch, a fixed day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import site from '../../sites/ogw/site.config.js';
import {
  createGuidesWorker, deliversHere, awinStores, editionFor, editionStores, regionName, pagePaths, EDITIONS, I18N_MISSING
} from '../../src/marketplace-guides.js';

const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-21T12:00:00Z');
const ON = { AMAZON_LINKS: 'on' };
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const GOOGLE = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';

function makeFetch() {
  const calls = [];
  const f = async input => {
    const u = new URL(String(input));
    calls.push(u);
    const r = u.searchParams.get('retailer');
    const to = u.searchParams.get('deliver_to');
    // The showcase's searches (L221, its own tests) find nothing here: this file is about the store's own list.
    const rows = u.searchParams.get('q') ? [] : [1, 2, 3].map(n => ({ product_name: `Item ${n}`, brand: 'Acme', retailer: r, stock_status: 'in_stock',
      image_url: `https://img.example/${n}.jpg`, delivers_to: [to], product_url: `https://${u.hostname}/product/p-${n}/` }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  f.calls = calls;
  return f;
}

async function get(path, { cc = null, ua = BROWSER, env = ON, host = LIVE } = {}) {
  const fetch = makeFetch();
  const w = createGuidesWorker(site, { fetch, cache: null, now: () => NOW });
  const req = new Request(host + path, { headers: { 'user-agent': ua } });
  if (cc) Object.defineProperty(req, 'cf', { value: { country: cc } });
  const r = await w.fetch(req, env);
  return { r, text: await r.text(), calls: fetch.calls };
}

const GR = EDITIONS.find(e => e.country === 'GR');
const GR_STORES = awinStores(site).filter(s => deliversHere(s, 'GR'));
const UK_ONLY = awinStores(site).filter(s => deliversHere(s, 'GB') && !deliversHere(s, 'GR'));

test('L214: one edition, Greece at /gr/ in Greek; its stores are the ones listed for Greece', () => {
  assert.deepEqual(EDITIONS.map(e => [e.prefix, e.country, e.lang]), [['/gr', 'GR', 'el-GR']]);
  assert.equal(editionFor('/gr/'), GR);
  assert.equal(editionFor('/gr'), GR);
  assert.equal(editionFor('/gr/stores/parex-gr/'), GR);
  assert.equal(editionFor('/grill/'), null, 'only the folder itself');
  assert.equal(editionFor('/'), null);
  assert.deepEqual(editionStores(site, GR).map(s => s.slug), GR_STORES.map(s => s.slug));
  assert.equal(GR_STORES.length, 7, 'the 7 Greek stores of L210');
  assert.equal(regionName('el-GR', 'GR'), 'Ελλάδα');
  assert.equal(regionName('en-GB', 'GR'), 'Greece');
});

for (const [who, ua, cc] of [['Google', GOOGLE, null], ['a UK browser', BROWSER, 'GB'], ['a Greek browser', BROWSER, 'GR'], ['a US browser', BROWSER, 'US']]) {
  test(`L214: /gr/ for ${who}: Greek, the 7 Greek stores, no UK store, no Amazon, its own canonical and hreflang`, async () => {
    const { r, text, calls } = await get('/gr/', { ua, cc });
    assert.equal(r.status, 200);
    assert.ok(text.startsWith('<!doctype html>\n<html lang="el-GR">'), `${who}: Greek`);
    assert.equal(r.headers.get('Content-Language'), 'el-GR');
    assert.ok(text.includes(`<link rel="canonical" href="${LIVE}/gr/">`), 'its own canonical');
    assert.ok(text.includes(`<link rel="alternate" hreflang="en-GB" href="${LIVE}/">`), 'the UK page');
    assert.ok(text.includes(`<link rel="alternate" hreflang="el-GR" href="${LIVE}/gr/">`), 'itself');
    assert.ok(text.includes(`<link rel="alternate" hreflang="x-default" href="${LIVE}/">`), 'x-default');
    assert.ok(!text.includes('name="robots"'), 'indexed');
    assert.ok(text.includes('<title>Καταστήματα και οδηγοί δώρων · Ελλάδα | Mega Stores Gear World</title>'), 'the title names Greece');
    for (const s of GR_STORES) assert.ok(text.includes(`href="/gr/stores/${s.slug}/"`), `${who}: ${s.name}`);
    for (const s of UK_ONLY) assert.ok(!text.includes(`>${s.name}<`) && !text.includes(`/stores/${s.slug}/`), `${who}: no ${s.name}`);
    assert.ok(!/amazon/i.test(text), 'no Amazon UK');
    assert.ok(!text.includes('£'), 'no UK code');
    assert.ok(text.includes('href="/gr/#stores"'), 'the stores part of this page');
    assert.ok(text.includes('href="/guides/'), 'the guides keep their one address');
    assert.ok(text.includes('href="/gr/?lang=en-GB"'), 'the language menu stays on /gr/');
    assert.ok(calls.length > 0 && calls.every(u => u.searchParams.get('deliver_to') === 'GR'), 'products read for Greece');
  });
}

test('L214: /gr/ with ?lang=en-GB is in English, still for Greece; a crawler asking for a language gets Greek', async () => {
  const en = await get('/gr/?lang=en-GB', { cc: 'GB' });
  assert.ok(en.text.startsWith('<!doctype html>\n<html lang="en-GB">'));
  assert.ok(en.text.includes('<title>Stores and gift guides · Greece | Mega Stores Gear World</title>'));
  assert.ok(en.text.includes('href="/gr/stores/parex-gr/?lang=en-GB"'), 'the chosen language is kept');
  assert.ok(en.text.includes(`<link rel="canonical" href="${LIVE}/gr/">`), 'the canonical has no ?lang=');
  const g = await get('/gr/?lang=en-GB', { ua: GOOGLE });
  assert.ok(g.text.startsWith('<!doctype html>\n<html lang="el-GR">'), 'Google reads the edition in its own language');
});

test('L214: the UK home page names /gr/ as its Greek page and stays as before', async () => {
  const { text } = await get('/', { ua: GOOGLE });
  assert.ok(text.startsWith('<!doctype html>\n<html lang="en-GB">'));
  assert.ok(text.includes(`<link rel="canonical" href="${LIVE}/">`));
  assert.ok(text.includes(`<link rel="alternate" hreflang="el-GR" href="${LIVE}/gr/">`));
  assert.ok(text.includes('<title>Stores and gift guides | Mega Stores Gear World</title>'), 'no country in the UK title');
  for (const s of UK_ONLY) assert.ok(text.includes(`href="/stores/${s.slug}/"`), s.name);
  for (const s of GR_STORES) assert.ok(!text.includes(s.name), `no ${s.name} on the UK page`);
  const gr = await get('/', { cc: 'GR' });
  assert.ok(gr.text.includes('href="/stores/kouzinika-gr/"'), 'a visitor from Greece on the UK address: as before (L210)');
});

test('L214: a Greek store at /gr/stores/: its products, Greek, own canonical, indexed; the same at the old address', async () => {
  for (const s of GR_STORES) {
    for (const [ua, cc] of [[GOOGLE, null], [BROWSER, 'GB'], [BROWSER, 'GR']]) {
      const { r, text, calls } = await get(`/gr/stores/${s.slug}/`, { ua, cc });
      assert.equal(r.status, 200, s.slug);
      assert.ok(text.startsWith('<!doctype html>\n<html lang="el-GR">'));
      assert.ok(text.includes(`<link rel="canonical" href="${LIVE}/gr/stores/${s.slug}/">`), `${s.slug}: canonical`);
      assert.ok(!text.includes('name="robots"'), `${s.slug}: indexed`);
      assert.ok(text.includes('class="pcards"'), `${s.slug}: products`);
      assert.ok(!text.includes('hreflang="x-default"'), 'hreflang only on the home pages');
      assert.ok(text.includes('href="/gr/#stores"'), 'back to the Greek stores');
      assert.ok(calls.every(u => u.searchParams.get('deliver_to') === 'GR' && u.searchParams.get('retailer') === s.name));
    }
  }
  const old = await get('/stores/kouzinika-gr/', { ua: GOOGLE });
  assert.ok(old.text.includes('store-elsewhere') && old.text.includes('<meta name="robots" content="noindex">'), 'Google at the old address: as before (L211)');
});

test('L214: /gr/stores/ and /gr/guides go to their part of /gr/; Google-InspectionTool reads Greek; no "your country" line', async () => {
  const s = await get('/gr/stores/');
  assert.equal(s.r.status, 302);
  assert.equal(s.r.headers.get('Location'), `${LIVE}/gr/#stores`);
  const g = await get('/gr/guides?lang=de');
  assert.equal(g.r.headers.get('Location'), `${LIVE}/gr/?lang=de-DE#guides`, 'the chosen language is kept');
  const insp = await get('/gr/?lang=en-GB', { ua: 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)' });
  assert.ok(insp.text.startsWith('<!doctype html>\n<html lang="el-GR">'), 'every Google crawler reads the edition in Greek');
  const home = await get('/gr/', { cc: 'GB' });
  assert.ok(home.text.includes('id="black-friday"') && home.text.includes('class="bf-count"'), 'the countdown stays');
  assert.ok(!home.text.includes('class="bf-none"'), 'no line about "your country" on the page for Greece');
  const store = await get('/gr/stores/kouzinika-gr/', { cc: 'GB' });
  assert.ok(/href="https:\/\/homegearworld\.com\/search\?q=Kouzinika\+GR&amp;retailer=Kouzinika\+GR&amp;for=gr"/.test(store.text), 'the Greek view of the site, whoever opens it');
});

test('L214: /gr is sent to /gr/; a UK store, Amazon and any other address under /gr/ do not exist', async () => {
  const r = await get('/gr?lang=el');
  assert.equal(r.r.status, 301);
  assert.equal(r.r.headers.get('Location'), `${LIVE}/gr/?lang=el`);
  const slash = await get('/gr/stores/parex-gr');
  assert.equal(slash.r.status, 301);
  assert.equal(slash.r.headers.get('Location'), `${LIVE}/gr/stores/parex-gr/`);
  for (const p of ['/gr/stores/joybuy/', '/gr/stores/amazon/', '/gr/guides/tech-gift-ideas/', '/gr/privacy/', '/gr/nothing']) {
    const x = await get(p, { cc: 'GR' });
    assert.equal(x.r.status, 404, p);
    assert.ok(x.text.includes('<meta name="robots" content="noindex">'), `${p}: noindex`);
    assert.ok(x.text.startsWith('<!doctype html>\n<html lang="el-GR">'), `${p}: Greek`);
  }
});

test('L214: the sitemap lists /gr/ and the 7 Greek store pages, once each; the test Worker stays out of Google', async () => {
  const { text } = await get('/sitemap.xml');
  assert.ok(text.includes(`<loc>${LIVE}/gr/</loc>`));
  for (const s of GR_STORES) assert.equal(text.split(`<loc>${LIVE}/gr/stores/${s.slug}/</loc>`).length, 2, s.slug);
  for (const s of GR_STORES) assert.ok(!text.includes(`<loc>${LIVE}/stores/${s.slug}/</loc>`), `${s.slug}: not its UK page`);
  const paths = pagePaths(site, 'on');
  assert.equal(new Set(paths).size, paths.length, 'no address twice');
  const preview = await get('/gr/', { host: 'https://mega-stores-gear-world-preview.example.workers.dev' });
  assert.equal(preview.r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
});

test('L214: every text of /gr/ is in the Greek dictionary', async () => {
  I18N_MISSING.clear();
  await get('/gr/', { cc: 'GR' });
  for (const s of GR_STORES) await get(`/gr/stores/${s.slug}/`, { cc: 'GR' });
  await get('/gr/nothing');
  assert.deepEqual([...I18N_MISSING].filter(k => k.startsWith('el-GR\t')), []);
});

test('L214 + L218: /gr/ has the Gear World app row for a visitor from a country of the app, in Greek, never on iPhone', async () => {
  const gr = await get('/gr/', { cc: 'GR', ua: ANDROID });
  assert.ok(gr.text.includes('class="app-bar"'), 'Greece, Android: the row');
  assert.ok(gr.text.includes('Αναζητήστε σε κάθε Gear World από το κινητό σας.'), 'its line in Greek');
  assert.ok(gr.text.includes('aria-label="Αποκτήστε το στο Google Play"') && gr.text.includes('app/google-play-el.png'), 'the Greek badge');
  assert.ok(gr.text.includes('utm_campaign=') || gr.text.includes('play.google.com/store/apps/details?id=com.gearworldhub.app'), 'the Google Play link');
  const de = await get('/gr/', { cc: 'DE', ua: ANDROID });
  assert.ok(!de.text.includes('class="app-bar"'), 'Germany: no row (the app is not on Google Play there)');
  const iphone = await get('/gr/', { cc: 'GR' });
  assert.ok(!iphone.text.includes('class="app-bar"'), 'iPhone: no row');
  const store = await get('/gr/stores/kouzinika-gr/', { cc: 'GR', ua: ANDROID });
  assert.ok(!store.text.includes('class="app-bar"'), 'a store page: no row, as on the old addresses');
});
