// The showcase of the 7 Greek stores of Linkwise (owner, 23 Nov 2026: "with their official logos, as Kotsovolos, Sephora
// and the rest would go in", "no prices, only bundles and ideas", lessons L221): each store page has the store's programme
// logo of the Linkwise panel, 2 sets and 3 gift ideas, every product found by a search among the store's products on its
// Gear World site and opening its Gear World product page. Never a price, an /out/ or /go/ link, or a sale word.
// Fake fetch, a fixed day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import site from '../../sites/ogw/site.config.js';
import { createGuidesWorker, storeShowcase, showcaseText, showcaseCacheKey, storeCacheKey } from '../../src/marketplace-guides.js';

const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-23T19:00:00Z');
const ON = { AMAZON_LINKS: 'on' };
const BROWSER = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const GREEK = site.stores.filter(s => s.network === 'linkwise');
// Our own texts may never sell or promise (L107); the Greek words too.
const NOT_OURS = /\b(shop|shopping|cart|buy now|official|partner|sale|lowest price|% off|save \d)/i;
const NOT_OURS_EL = /(έκπτωσ|προσφορ|φθηνότερ|χαμηλότερη τιμή|επίσημ|καλάθι αγορών)/i;

// A fake Gear World site: three products per search, named after the search, delivered where it is asked for.
function makeFetch({ empty = [], fail = [], broken = [] } = {}) {
  const calls = [];
  const f = async input => {
    const u = new URL(String(input));
    calls.push(u);
    const q = u.searchParams.get('q') || '';
    if (fail.includes(q)) throw new Error('down');
    const r = u.searchParams.get('retailer');
    const tag = u.hostname.split('.')[0];
    const rows = empty.includes(q) ? [] : [1, 2, 3].map(n => ({
      product_name: `${q || 'Item'} ${n}`, brand: 'Acme', retailer: r, price: 24.9, currency: 'EUR', stock_status: 'in_stock',
      image_url: `https://img.example/${tag}/${encodeURIComponent(q)}-${n}${broken.includes(q) ? '-gone' : ''}.jpg`,
      delivers_to: [u.searchParams.get('deliver_to')], product_url: `https://${u.hostname}/product/${encodeURIComponent(q)}-${n}/`,
      affiliate_url: `https://${u.hostname}/out/${n}`
    }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  f.calls = calls;
  return f;
}

async function get(path, { cc = 'GR', ua = BROWSER, fetch = makeFetch() } = {}) {
  const w = createGuidesWorker(site, { fetch, photoFetch: null, cache: null, now: () => NOW });
  const req = new Request(LIVE + path, { headers: { 'user-agent': ua } });
  if (cc) Object.defineProperty(req, 'cf', { value: { country: cc } });
  const r = await w.fetch(req, ON);
  return { r, text: await r.text(), calls: fetch.calls };
}

const visible = html => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ');
const words = html => visible(html).replace(/\s+/g, ' ');

test('L221: the 7 Greek stores have their Linkwise programme logo (120x60, in public/ and the allowlist), 2 sets and 3 ideas', () => {
  assert.equal(GREEK.length, 7);
  const allowed = readFileSync('sites/ogw/public-allowlist.txt', 'utf8');
  for (const s of GREEK) {
    assert.match(s.logo, new RegExp(`^logos/${s.slug}\\.(png|jpg)$`), `${s.slug}: its logo file`);
    assert.deepEqual(s.logoSize, [120, 60], `${s.slug}: the panel's size`);
    const file = readFileSync(`sites/ogw/public/assets/${s.logo}`);
    assert.ok(statSync(`sites/ogw/public/assets/${s.logo}`).size > 1000 && allowed.includes(`assets/${s.logo}`), `${s.slug}: in public/ and the allowlist`);
    if (s.logo.endsWith('.png')) {
      assert.equal(file.subarray(1, 4).toString('latin1'), 'PNG', `${s.slug}: a PNG`);
      assert.deepEqual([file.readUInt32BE(16), file.readUInt32BE(20)], [120, 60], `${s.slug}: 120x60 as the panel gives it`);
    } else {
      assert.deepEqual([...file.subarray(0, 3)], [0xff, 0xd8, 0xff], `${s.slug}: a JPEG (the panel's file, kept as it is)`);
    }
    const sc = s.showcase;
    assert.equal(sc.sets.length, 2, `${s.slug}: 2 sets`);
    assert.equal(sc.ideas.length, 3, `${s.slug}: 3 ideas`);
    for (const part of [...sc.sets, ...sc.ideas]) {
      for (const v of [part.title, part.line]) {
        assert.ok(v.el && v.en && v.el.length < 90 && v.en.length < 90, `${s.slug}: Greek and English, short`);
        assert.ok(!NOT_OURS.test(v.en) && !NOT_OURS_EL.test(v.el) && !/[€£$]|\d+\s*%/.test(v.el + v.en), `${s.slug}: no price or sale word: ${v.en}`);
      }
      if (part.site) assert.ok(s.sites.includes(part.site), `${s.slug}: a site of the store`);
    }
    for (const set of sc.sets) assert.equal(set.picks.length, 3, `${s.slug}: 3 picks per set`);
    for (const pick of [...sc.sets.flatMap(x => x.picks), ...sc.ideas.map(x => x.pick)]) {
      assert.ok(Array.isArray(pick) && pick.length >= 1 && pick.length <= 3 && pick.every(q => typeof q === 'string' && q.trim() && q.length <= 80), `${s.slug}: 1 to 3 searches`);
    }
  }
  for (const s of site.stores.filter(x => x.network !== 'linkwise')) assert.equal(s.showcase, undefined, `${s.slug}: no showcase`);
});

test('L221: /gr/stores/<store>/ shows the logo, the sets and the ideas, in Greek, each product to its Gear World page, never a price', async () => {
  for (const s of GREEK) {
    const { r, text, calls } = await get(`/gr/stores/${s.slug}/`);
    assert.equal(r.status, 200, s.slug);
    assert.match(text, new RegExp(`<span class="store-logo store-logo-lg"><img src="/assets/${s.logo.replace('.', '\\.')}\\?v=[^"]+" alt="${s.name}" width="120" height="60"`), `${s.slug}: the logo`);
    assert.ok(words(text).includes(`Σετ από το ${s.name}`) && words(text).includes(`Ιδέες δώρου από το ${s.name}`), `${s.slug}: both parts, in Greek`);
    for (const set of s.showcase.sets) assert.ok(text.includes(`<h3>${set.title.el}</h3>`), `${s.slug}: ${set.title.en}`);
    for (const idea of s.showcase.ideas) assert.ok(text.includes(`<h3>${idea.title.el}</h3>`), `${s.slug}: ${idea.title.en}`);
    assert.equal((text.match(/<li class="sc-set">/g) || []).length, 2);
    assert.equal((text.match(/<li class="sc-idea">/g) || []).length, 3);
    assert.equal((text.match(/class="sc-item"/g) || []).length, 9, `${s.slug}: 3 + 3 products and 3 ideas`);
    // Every showcase link is a Gear World product page of one of the store's sites.
    const links = [...text.matchAll(/<a class="sc-(?:photo|link)" href="([^"]+)"/g)].map(m => m[1]);
    assert.equal(links.length, 18);
    for (const l of links) assert.match(l, /^https:\/\/(homegearworld|kidsgearworld|mensgearworld|womensgearworld)\.com\/product\/[^"]+\/(\?|$)/, `${s.slug}: ${l}`);
    assert.ok(!/\/(out|go)\//.test(text), `${s.slug}: no /out/ or /go/`);
    assert.ok(!/24[.,]9/.test(visible(text)) && !/€\s*\d|\d\s*€/.test(visible(text)), `${s.slug}: never a price`);
    // The searches: on the store's own sites, its own products, delivered to Greece.
    const searches = calls.filter(u => u.searchParams.has('q'));
    assert.ok(searches.length >= 9, `${s.slug}: a search per pick`);
    for (const u of searches) {
      assert.equal(u.pathname, '/api/products');
      assert.equal(u.searchParams.get('retailer'), s.name);
      assert.equal(u.searchParams.get('deliver_to'), 'GR');
      assert.equal(u.searchParams.get('limit'), '6');
      assert.equal(u.searchParams.get('translate'), '0', 'no AI translation for our own searches');
    }
    // A next search only for a pick still without a product: here every first search finds one.
    const firsts = new Set([...s.showcase.sets.flatMap(x => x.picks.map(p => p[0])), ...s.showcase.ideas.map(x => x.pick[0])]);
    assert.ok(searches.every(u => firsts.has(u.searchParams.get('q'))), `${s.slug}: no fallback search when not needed`);
    // The list below leaves out what the showcase shows, under its own heading.
    const shownNames = [...text.matchAll(/<p class="sc-name" translate="no">([^<]+)<\/p>/g)].map(m => m[1]);
    const listNames = [...text.matchAll(/<h2 class="pcard-name" translate="no">([^<]+)<\/h2>/g)].map(m => m[1]);
    assert.equal(shownNames.length, 9);
    assert.ok(listNames.length > 0 && listNames.every(n => !shownNames.includes(n)), `${s.slug}: never twice on the page`);
    assert.ok(words(text).includes(`Περισσότερα από το ${s.name}`), `${s.slug}: the list's heading`);
  }
});

test('L221: in English with ?lang=en-GB, and the same on the old address; a UK store page has no showcase', async () => {
  const s = GREEK[0];
  const en = await get(`/gr/stores/${s.slug}/?lang=en-GB`);
  assert.ok(words(en.text).includes(`Sets from ${s.name}`) && en.text.includes(`<h3>${s.showcase.sets[0].title.en}</h3>`) && en.text.includes(`<h3>${s.showcase.ideas[0].title.en}</h3>`));
  assert.ok(!en.text.includes(s.showcase.sets[0].title.el), 'no Greek title in English');
  const old = await get(`/stores/${s.slug}/`);
  assert.equal(old.r.status, 200);
  assert.ok(old.text.includes('class="sc-sets"') && old.text.includes('class="sc-ideas"'), 'the old address too');
  const uk = await get('/stores/joybuy/', { cc: 'GB' });
  assert.equal(uk.r.status, 200);
  assert.ok(!uk.text.includes('sc-set') && !uk.text.includes('sc-idea') && !uk.calls.some(u => u.searchParams.has('q')), 'a UK store: as before, no search');
  const elsewhere = await get(`/stores/${s.slug}/`, { cc: 'DE' });
  assert.ok(!elsewhere.text.includes('sc-set') && !elsewhere.calls.some(u => u.searchParams.has('q')), 'a country it is not listed for: no showcase, no search');
});

test('L221: a pick tries its searches in order and never shows a product twice; a set needs 2 products; a failed site keeps the rest', async () => {
  const s = GREEK.find(x => x.slug === 'kouzinika-gr');
  const [first, second] = s.showcase.ideas[0].pick;
  // The first search of the first idea finds nothing: its second search gives the product.
  let data = await storeShowcase(site, s, { fetch: makeFetch({ empty: [first] }) });
  assert.equal(data.ideas[0].product.name, `${second} 1`);
  // A set whose 3 searches all fail is left out; the rest stays.
  const setQs = s.showcase.sets[1].picks.flat();
  data = await storeShowcase(site, s, { fetch: makeFetch({ fail: setQs }) });
  assert.equal(data.sets.length, 1, 'only the set with products');
  assert.equal(data.ideas.length, 3);
  // The same search twice on a page gives 2 different products.
  const twice = { ...s, showcase: { sets: [{ title: { el: 'Α', en: 'A' }, line: { el: 'Β', en: 'B' }, picks: [['κούπα'], ['κούπα'], ['κούπα']] }], ideas: [] } };
  data = await storeShowcase(site, twice, { fetch: makeFetch() });
  assert.deepEqual(data.sets[0].items.map(p => p.name), ['κούπα 1', 'κούπα 2', 'κούπα 3']);
  // A set with only one product found is not shown.
  const one = { ...s, showcase: { sets: [{ title: { el: 'Α', en: 'A' }, line: { el: 'Β', en: 'B' }, picks: [['x'], ['y'], ['z']] }], ideas: [] } };
  data = await storeShowcase(site, one, { fetch: makeFetch({ empty: ['y', 'z'] }) });
  assert.deepEqual(data.sets, []);
  // Every search failing: nothing, and the page still has the store's products part.
  const page = await get(`/gr/stores/${s.slug}/`, { fetch: makeFetch({ fail: [...s.showcase.sets.flatMap(x => x.picks.flat()), ...s.showcase.ideas.flatMap(x => x.pick)] }) });
  assert.equal(page.r.status, 200);
  assert.ok(!page.text.includes('sc-set') && !page.text.includes('sc-idea') && page.text.includes('class="pcards"'), 'no showcase, the products as before');
});

test('L221: a broken photo leaves its product out; the showcase is kept in the cache apart from the products, for an hour', async () => {
  const s = GREEK.find(x => x.slug === 'parex-gr');
  const q = s.showcase.ideas[1].pick[0];
  const photoFetch = async url => new Response('', { status: String(url).includes('-gone') ? 404 : 200, headers: { 'Content-Type': 'image/jpeg' } });
  let data = await storeShowcase(site, s, { fetch: makeFetch({ broken: [q] }), photoFetch });
  assert.equal(data.ideas.length, 2, 'the idea with a broken photo is left out');
  const store = new Map();
  const cache = {
    match: async k => (store.has(k) ? new Response(store.get(k).body, { headers: { 'Content-Type': 'application/json' } }) : undefined),
    put: async (k, res) => { store.set(k, { body: await res.text(), cc: res.headers.get('Cache-Control') }); }
  };
  const f = makeFetch();
  data = await storeShowcase(site, s, { fetch: f, cache });
  const key = showcaseCacheKey(site, s);
  assert.ok(key.startsWith(storeCacheKey(site, s)) && key !== storeCacheKey(site, s), 'its own key, with the asset version');
  assert.equal(store.get(key).cc, 'public, max-age=3600');
  const n = f.calls.length;
  const again = await storeShowcase(site, s, { fetch: f, cache });
  assert.equal(f.calls.length, n, 'read from the cache');
  assert.deepEqual(again, JSON.parse(JSON.stringify(data)));
  assert.equal(showcaseText({ lang: 'el-GR' }, { el: 'Α', en: 'A' }), 'Α');
  assert.equal(showcaseText({ lang: 'en-GB' }, { el: 'Α', en: 'A' }), 'A');
  assert.equal(showcaseText({ lang: 'de-DE' }, { el: 'Α', en: 'A' }), 'A');
});

test('L221 review: a broken photo gives its place to the next product of the same search, then to the next search', async () => {
  const s = GREEK.find(x => x.slug === 'casualshoes-gr');
  const gone = new Set();
  const fetch = async input => {
    const u = new URL(String(input));
    const q = u.searchParams.get('q');
    const rows = [1, 2, 3].map(n => ({ product_name: `${q} ${n}`, brand: 'Acme', retailer: u.searchParams.get('retailer'), stock_status: 'in_stock',
      image_url: `https://img.example/${encodeURIComponent(q)}-${n}.jpg`, delivers_to: ['GR'], product_url: `https://${u.hostname}/product/${encodeURIComponent(q)}-${n}/` }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const photoFetch = async url => new Response('', { status: [...gone].some(g => decodeURIComponent(url).includes(g)) ? 404 : 200, headers: { 'Content-Type': 'image/jpeg' } });
  // The first bracelet and the first key ring have broken photos (as on 23 Nov 2026): the second of each is shown.
  const [bracelet, keyring] = [s.showcase.sets[0].picks[1][0], s.showcase.sets[0].picks[2][0]];
  gone.add(`${bracelet}-1.jpg`);
  gone.add(`${keyring}-1.jpg`);
  let data = await storeShowcase(site, s, { fetch, photoFetch });
  assert.deepEqual(data.sets[0].items.map(p => p.name), [`${s.showcase.sets[0].picks[0][0]} 1`, `${bracelet} 2`, `${keyring} 2`], 'the set stays whole');
  // Every product of the first search broken: the next search of the pick.
  const wallet = s.showcase.ideas[2].pick;
  for (const n of [1, 2, 3]) gone.add(`${wallet[0]}-${n}.jpg`);
  data = await storeShowcase(site, s, { fetch, photoFetch });
  assert.equal(data.ideas.find(i => i.title.en === s.showcase.ideas[2].title.en).product.name, `${wallet[1]} 1`);
});

test('L221 review: the cache time says what happened, and the key changes with the showcase', async () => {
  const s = GREEK.find(x => x.slug === 'kouzinika-gr');
  const keep = () => {
    const box = {};
    return { box, cache: { match: async () => undefined, put: async (k, res) => { box.cc = res.headers.get('Cache-Control'); } } };
  };
  // A pick whose only search failed: kept 10 minutes.
  const one = { ...s, showcase: { sets: s.showcase.sets, ideas: [{ ...s.showcase.ideas[0], pick: ['κάτι'] }] } };
  let k = keep();
  await storeShowcase(site, one, { fetch: makeFetch({ fail: ['κάτι'] }), cache: k.cache });
  assert.equal(k.box.cc, 'public, max-age=600');
  // A fallback search that is never needed does not shorten it.
  k = keep();
  await storeShowcase(site, s, { fetch: makeFetch({ fail: [s.showcase.ideas[0].pick[1]] }), cache: k.cache });
  assert.equal(k.box.cc, 'public, max-age=3600');
  // Nothing found: 1 minute.
  k = keep();
  await storeShowcase(site, s, { fetch: async () => new Response(JSON.stringify({ ok: true, products: [] }), { status: 200 }), cache: k.cache });
  assert.equal(k.box.cc, 'public, max-age=60');
  const other = { ...s, showcase: { ...s.showcase, ideas: s.showcase.ideas.slice(0, 2) } };
  assert.notEqual(showcaseCacheKey(site, other), showcaseCacheKey(site, s), 'a changed showcase is read again');
  assert.equal(showcaseCacheKey(site, s), showcaseCacheKey(site, { ...s }), 'the same showcase, the same key');
});

test('L221 review: at most 3 searches wait at a time', async () => {
  const s = GREEK.find(x => x.slug === 'katoikein-gr');
  let now = 0;
  let most = 0;
  const base = makeFetch();
  const fetch = async (...a) => {
    now++;
    most = Math.max(most, now);
    await new Promise(r => setTimeout(r, 5));
    try { return await base(...a); } finally { now--; }
  };
  const data = await storeShowcase(site, s, { fetch });
  assert.equal(data.sets.length, 2);
  assert.ok(most <= 3, `${most} at once`);
});
