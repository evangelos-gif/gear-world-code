// The catalogue of the big Linkwise stores on Mega Stores (owner, 24 Nov 2026, lessons L228): all the products of
// Kotsovolos, Public, Sephora and e-shop.gr in their own categories, one store per page, never compared, each with the
// store's own price (a feed of the last 24 hours) and our Linkwise link to its page; never on the 13 sites, the Hub or
// the app. A real SQLite behind the D1 API (tests/worker/fake-d1.mjs), loaded with the SQL of tools/ogw-catalog.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import site from '../../sites/ogw/site.config.js';
import { createGuidesWorker, mergePrices, priceKey, PRICE_MAX_AGE_MS } from '../../src/marketplace-guides.js';
import { catalogStores, catalogFresh, CATALOG_MAX_AGE_MS, PAGE_SIZE } from '../../src/lib/ogw-catalog.js';
import { MAX_STATEMENT, catSlug, storePage, levels, soldOut, OTHER } from '../../tools/ogw-catalog.mjs';
import { fakeD1, catalogSql, kotsovolosRows } from './fake-d1.mjs';

const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-24T19:00:00Z');
const CODE = 'CD12345';
const BROWSER = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const visible = h => h.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const hrefs = t => [...t.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
const cards = t => [...t.matchAll(/<li class="cat-item">([\s\S]*?)<\/li>/g)].map(m => m[1]);

async function get(path, env, { cc = 'GR', now = NOW } = {}) {
  const fetch = async () => new Response(JSON.stringify({ ok: true, products: [] }), { headers: { 'Content-Type': 'application/json' } });
  const w = createGuidesWorker(site, { fetch, photoFetch: null, cache: null, now: () => now });
  const req = new Request(LIVE + path, { headers: { 'user-agent': BROWSER } });
  if (cc) Object.defineProperty(req, 'cf', { value: { country: cc } });
  const r = await w.fetch(req, env);
  return { r, text: await r.text() };
}
// The catalogue as loaded an hour ago; `ago` moves the time of its feed (the PC tool never loads a feed of 23 hours+).
async function catalogEnv({ ago = 3600000, failOn = null, rows = kotsovolosRows(60) } = {}) {
  const { sql } = await catalogSql({ 138: rows }, NOW, 3600000);
  const db = fakeD1(sql, { failOn });
  db.sqlite.prepare('UPDATE stores SET checked_at = ?').run(new Date(NOW - ago).toISOString());
  return { LINKWISE_CODE: CODE, CATALOG: db };
}
const firstCategory = text => hrefs(text).find(h => /^\/gr\/stores\/kotsovolos-gr\/c\/\d+-/.test(h));

test('L228: the PC tool: the store\'s own pages and photos, in stock, in euros, one product per page, its own categories', async () => {
  assert.equal(storePage('http://kotsovolos.gr/p/1#x', ['www.kotsovolos.gr']), 'https://www.kotsovolos.gr/p/1');
  for (const bad of ['https://evil.example/p', 'https://www.kotsovolos.gr.evil.example/p', 'https://u:p@www.kotsovolos.gr/p', 'https://www.kotsovolos.gr:8443/p', 'javascript:alert(1)']) {
    assert.equal(storePage(bad, ['www.kotsovolos.gr']), '', bad);
  }
  assert.deepEqual(levels('A > B > C > D'), ['A', 'B', 'C']);
  assert.deepEqual(levels(''), [OTHER]);
  // The stores' own stock words (24/11/2026).
  for (const s of ['Αγορά μόνο από κατάστημα', 'Μη Διαθέσιμο', 'MH DIATHESIMO', 'Προσωρινά Εξαντλημένο', 'Εξαντλήθηκε', 'Ουπς, μόλις εξαντλήθηκε!', 'Μη διαθέσιμο για αποστολή', 'Μη διαθέσιμο για αποστολή, Μη διαθέσιμο για παραλαβή', 'Μη διαθέσιμο για αποστολή, Διαθέσιμο μόνο από κατάστημα', 'ERROR: Failed to get Availability']) assert.equal(soldOut(s), true, s);
  for (const s of ['', 'Άμεσα Διαθέσιμο', 'Διαθέσιμο με παραγγελία', 'Κατόπιν Παραγγελίας', 'Προπαραγγελία', 'Διαθέσιμο για αποστολή', 'Μη διαθέσιμο για αποστολή, Διαθέσιμο για παραλαβή', 'Διαθέσιμο για αποστολή, Μη διαθέσιμο για παραλαβή']) assert.equal(soldOut(s), false, s);
  // Public's tree, with " - " (24/11/2026): two levels, the rest whole as the third.
  assert.deepEqual(levels('Βιβλία & Κόμικς - Ξενόγλωσσα - Θετικές - Τεχνολογικές Επιστήμες - Φυσικές Επιστήμες'), ['Βιβλία & Κόμικς', 'Ξενόγλωσσα', 'Θετικές - Τεχνολογικές Επιστήμες - Φυσικές Επιστήμες']);
  assert.deepEqual(levels('Gaming - Nintendo'), ['Gaming', 'Nintendo']);
  assert.deepEqual(levels('Υπολογιστές > Laptops-Tablets- iPad > Laptop - MacBook'), ['Υπολογιστές', 'Laptops-Tablets- iPad', 'Laptop - MacBook'], 'a tree with > keeps its names');
  assert.equal(catSlug('Καφετιέρες & Μηχανές Espresso'), 'kafetieres-michanes-espresso');
  const rows = [
    ...kotsovolosRows(3),
    { product_name: "O'Neil \"x\"", merchant_deep_link: 'https://kotsovolos.gr/p/q', merchant_image_url: 'https://assets.kotsovolos.gr/q.jpg', search_price: '9.90', currency: 'EUR', in_stock: '', merchant_product_id: 'q', merchant_category: '' },
    { product_name: 'Size S', merchant_deep_link: 'https://www.kotsovolos.gr/p/v', merchant_image_url: 'https://assets.kotsovolos.gr/v.jpg', search_price: '10', currency: 'EUR', in_stock: '1', merchant_product_id: 'v1', merchant_category: 'X' },
    { product_name: 'Size M', merchant_deep_link: 'https://www.kotsovolos.gr/p/v', merchant_image_url: 'https://assets.kotsovolos.gr/v.jpg', search_price: '12', currency: 'EUR', in_stock: '1', merchant_product_id: 'v2', merchant_category: 'X' },
    { product_name: 'Same S', merchant_deep_link: 'https://www.kotsovolos.gr/p/s', merchant_image_url: 'https://assets.kotsovolos.gr/s.jpg', search_price: '20', currency: 'EUR', in_stock: '1', merchant_product_id: 's1', merchant_category: 'X' },
    { product_name: 'Same M', merchant_deep_link: 'https://www.kotsovolos.gr/p/s', merchant_image_url: 'https://assets.kotsovolos.gr/s.jpg', search_price: '20', currency: 'EUR', in_stock: '1', merchant_product_id: 's2', merchant_category: 'X' },
    { product_name: 'Gone', merchant_deep_link: 'https://www.kotsovolos.gr/p/g', merchant_image_url: 'https://assets.kotsovolos.gr/g.jpg', search_price: '5', currency: 'EUR', in_stock: '0', merchant_product_id: 'g' },
    { product_name: 'Pounds', merchant_deep_link: 'https://www.kotsovolos.gr/p/l', merchant_image_url: 'https://assets.kotsovolos.gr/l.jpg', search_price: '5', currency: 'GBP', in_stock: '1', merchant_product_id: 'l' },
    { product_name: 'No photo', merchant_deep_link: 'https://www.kotsovolos.gr/p/n', merchant_image_url: 'http://cdn.example.com/n.jpg', search_price: '5', currency: 'EUR', in_stock: '1', merchant_product_id: 'n' },
    // An http photo on the store's own domain (e-shop.gr): moved to https, kept.
    { product_name: 'Http own photo', merchant_deep_link: 'http://www.kotsovolos.gr/p/h', merchant_image_url: 'http://assets.kotsovolos.gr/h.jpg', search_price: '5', currency: 'EUR', in_stock: '', merchant_product_id: 'h', merchant_category: 'Α - Β - Γ - Δ' },
    { product_name: 'Elsewhere', merchant_deep_link: 'https://evil.example/p', merchant_image_url: 'https://assets.kotsovolos.gr/e.jpg', search_price: '5', currency: 'EUR', in_stock: '1', merchant_product_id: 'e' }
  ];
  const { lines, sql } = await catalogSql({ 138: rows, 469: [] }, NOW);
  assert.match(lines[0], /^CATALOG kotsovolos-gr 138 OK 8 \d+ 5 2026-11-24T18:00:00.000Z 1 full 8 -1$/);
  assert.equal(lines[1], 'CATALOG public-gr 469 NONE 0 0 0 2026-11-24T18:00:00.000Z 0 full 0 -1');
  const db = fakeD1(sql).sqlite;
  const pids = db.prepare('SELECT pid FROM products ORDER BY pid').all().map(r => r.pid);
  assert.deepEqual(pids, ['100001', '100002', '100003', '273143', '900001', 'h', 'q', 's1'], 'one product per page, only when its rows agree on the price');
  const h = db.prepare("SELECT image, page, c1, c2, c3 FROM products WHERE pid = 'h'").get();
  assert.equal(h.image, 'https://assets.kotsovolos.gr/h.jpg');
  assert.equal(h.page, 'https://www.kotsovolos.gr/p/h');
  assert.deepEqual([h.c1, h.c2, h.c3].map(id => db.prepare('SELECT name FROM categories WHERE id = ?').get(id).name), ['Α', 'Β', 'Γ - Δ']);
  const q = db.prepare("SELECT name, page, c1, c2 FROM products WHERE pid = 'q'").get();
  assert.equal(q.name, 'O\'Neil "x"');
  assert.equal(q.page, 'https://www.kotsovolos.gr/p/q', 'the store\'s www address');
  assert.equal(db.prepare('SELECT name FROM categories WHERE id = ?').get(q.c1).name, OTHER);
  const store = db.prepare('SELECT * FROM stores').get();
  assert.equal(store.products, 8);
  assert.equal(store.checked_at, '2026-11-24T18:00:00.000Z');
  assert.ok(sql.join('\n').split('\n').every(l => Buffer.byteLength(l) <= MAX_STATEMENT), 'every statement under the D1 limit');
  assert.ok(!/CD\d{3,}|go\.linkwi\.se|aw_deep_link/.test(sql.join('\n')), 'no affiliate code or tracking link in the database');
  // Many products: several INSERT statements, all of them loaded.
  const big = await catalogSql({ 138: kotsovolosRows(2500) }, NOW);
  assert.ok(big.sql.join('\n').split('\n').filter(l => l.startsWith('INSERT OR REPLACE INTO products')).length > 3);
  assert.equal(fakeD1(big.sql).sqlite.prepare('SELECT COUNT(*) AS n FROM products').get().n, 2502);
  // The prices of the sets and ideas of the config, from the same feed.
  const picks = JSON.parse(fakeD1((await catalogSql({ 138: kotsovolosRows(2) }, NOW)).sql).sqlite.prepare('SELECT picks FROM stores').get().picks);
  assert.deepEqual(picks, { [priceKey('https://www.kotsovolos.gr/ProductDisplay?partNumber=273143')]: 359.99 });
});

test('L228 review: one id twice, a store with nothing to load, tracking and our code in an address', async () => {
  const rows = [
    ...kotsovolosRows(2),
    // The same product id on two pages (a colour with its own address): kept once, never a failed load.
    { product_name: 'Red', merchant_deep_link: 'https://www.kotsovolos.gr/p/red', merchant_image_url: 'https://assets.kotsovolos.gr/r.jpg', search_price: '10', currency: 'EUR', in_stock: '1', merchant_product_id: 'SKU1', merchant_category: 'X' },
    { product_name: 'Blue', merchant_deep_link: 'https://www.kotsovolos.gr/p/blue', merchant_image_url: 'https://assets.kotsovolos.gr/b.jpg', search_price: '10', currency: 'EUR', in_stock: '1', merchant_product_id: 'SKU1', merchant_category: 'Y > Sub' },
    // A model name or a photo hash that only looks like a code: kept (second review: the check is upper-case CD, whole).
    { product_name: 'Philips phone', merchant_deep_link: 'https://www.kotsovolos.gr/p/philips-cd1201b-phone', merchant_image_url: 'https://assets.kotsovolos.gr/9f3acd1234e.jpg', search_price: '10', currency: 'EUR', in_stock: '1', merchant_product_id: 'm', merchant_category: 'X' },
    // Tracking parameters go; a parameter with an affiliate code goes; a photo with one: the product is left out.
    { product_name: 'Tracked', merchant_deep_link: `https://www.kotsovolos.gr/p/t?partNumber=7&utm_source=linkwise&aff=CD12345&x=${'CD' + '44444'}`, merchant_image_url: 'https://assets.kotsovolos.gr/t.jpg', search_price: '10', currency: 'EUR', in_stock: '1', merchant_product_id: 't', merchant_category: 'X' },
    { product_name: 'Coded photo', merchant_deep_link: 'https://www.kotsovolos.gr/p/c', merchant_image_url: 'https://assets.kotsovolos.gr/c.jpg?ref=CD12345', search_price: '10', currency: 'EUR', in_stock: '1', merchant_product_id: 'c', merchant_category: 'X' }
  ];
  const { lines, sql } = await catalogSql({ 138: rows, 469: [{ product_name: 'out', merchant_deep_link: 'https://www.public.gr/p', merchant_image_url: 'https://external.webstorage.gr/p.jpg', search_price: '1', currency: 'EUR', in_stock: '0', merchant_product_id: 'p' }] }, NOW);
  assert.match(lines[0], / OK 7 /);
  assert.match(lines[1], / NONE 0 /);
  assert.equal(sql.length, 1, 'only the store that ended OK has a file (the empty one wipes nothing)');
  assert.ok(!sql.join('\n').includes('program = 469'), 'nothing of Public');
  const db = fakeD1(sql).sqlite;
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products WHERE pid = 'SKU1'").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM categories WHERE name IN ('Y', 'Sub')").get().n, 0, 'the second copy makes no empty categories');
  assert.equal(db.prepare("SELECT page FROM products WHERE pid = 'm'").get().page, 'https://www.kotsovolos.gr/p/philips-cd1201b-phone', 'a model name is not a code');
  assert.equal(db.prepare("SELECT page FROM products WHERE pid = 't'").get().page, 'https://www.kotsovolos.gr/p/t?partNumber=7');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products WHERE pid = 'c'").get().n, 0);
  assert.ok(!/CD\d{3,}/.test(sql.join('\n')), 'no affiliate code anywhere in the SQL');
  assert.equal(db.prepare('SELECT loading FROM stores').get().loading, 0, 'loaded: not "loading" any more');
  // Sent twice (a retry after a network error): the same rows.
  const twice = fakeD1([...sql, ...sql]).sqlite;
  assert.equal(twice.prepare('SELECT COUNT(*) AS n FROM products').get().n, 7);
});

test('L228: the store page of /gr/ lists the store\'s own categories, the sets first; never without our code or the database', async () => {
  const env = await catalogEnv();
  const { r, text } = await get('/gr/stores/kotsovolos-gr/', env);
  assert.equal(r.status, 200);
  assert.ok(/<ul class="cat-grid"><li><a class="cat-tile" href="#sets-h"><img src="https:\/\/assets\.kotsovolos\.gr\/[^"]+"[^>]*><span class="cat-text"><span class="cat-name">Σετ<\/span><\/span><\/a><\/li>/.test(text), 'the sets are the first category card, with the photo of a product of the first set (L231)');
  const v = visible(text);
  assert.ok(v.includes('Κατηγορίες του καταστήματος Κωτσόβολος'));
  assert.ok(v.includes('Μικροσυσκευές') && v.includes('Εικόνα &amp; Ήχος') && v.includes('61 προϊόντα'), 'the store\'s own names and counts');
  assert.ok(firstCategory(text), 'a link to a category');
  // Without the code, without the database, from the UK address: no catalogue.
  for (const [path, e] of [['/gr/stores/kotsovolos-gr/', { CATALOG: env.CATALOG }], ['/gr/stores/kotsovolos-gr/', { LINKWISE_CODE: CODE }]]) {
    const x = await get(path, e);
    assert.ok(!x.text.includes('cat-grid'), `${path}: no catalogue`);
  }
  const uk = await get('/stores/kotsovolos-gr/', env);
  assert.ok(!uk.text.includes('cat-grid'), 'the UK address: no catalogue');
});

test('L228: a category: its products with the store\'s price and time, our Linkwise link to its page, the next page, nothing compared', async () => {
  const env = await catalogEnv();
  const home = await get('/gr/stores/kotsovolos-gr/', env);
  // The biggest top category is Μικροσυσκευές (61): its page shows Καφές below it and 48 products.
  const link = firstCategory(home.text);
  const { r, text } = await get(link, env);
  assert.equal(r.status, 200);
  const items = cards(text);
  assert.equal(items.length, PAGE_SIZE);
  for (const it of items) {
    const h = hrefs(it);
    assert.ok(h.length === 2 && h.every(x => /^https:\/\/go\.linkwi\.se\/z\/138-0\/CD12345\/\?lnkurl=https%3A%2F%2Fwww\.kotsovolos\.gr%2F/.test(x)), 'two links, both ours to the store\'s page');
    assert.match(it, /rel="sponsored nofollow noopener" target="_blank"/);
    assert.match(it, /<p class="sc-price"><span translate="no">\d+,\d\d\s€<\/span> <span class="sc-when">έλεγχος 24\/11, 20:00<\/span><\/p>/);
  }
  const v = visible(text);
  assert.ok(v.includes('Οι τιμές προέρχονται από το product feed του καταστήματος Κωτσόβολος στη Linkwise'), 'the note of the prices');
  assert.ok(!/σύγκρι|φθηνότερ|έκπτωσ|προσφορ|\d+\s*%/i.test(v), 'no comparison, discount or % words');
  assert.ok(!/amazon|gearworld\.com\/(out|go)\//i.test(text), 'no Amazon and no Gear World /out/ link');
  assert.ok(text.includes('class="cat-grid"') && v.includes('Καφές'), 'the categories below it');
  // The next page: the rest, then no next link; a page after the first is noindex.
  const next = hrefs(text).find(h => h.includes('?after='));
  assert.ok(next, 'a next page');
  const p2 = await get(next, env);
  assert.equal(cards(p2.text).length, 61 - PAGE_SIZE);
  assert.ok(!hrefs(p2.text).some(h => h.includes('?after=')));
  assert.ok(p2.text.includes('<meta name="robots" content="noindex, follow">'));
  assert.ok(visible(p2.text).includes('Πίσω στην πρώτη σελίδα'));
  const all = [...cards(text), ...cards(p2.text)].map(c => c.match(/lnkurl=([^"]+)"/)[1]);
  assert.equal(new Set(all).size, 61, 'every product once');
});

test('L228: an old feed: no prices after 24 hours, no catalogue after 72; a busy database, a wrong address', async () => {
  const stale = await catalogEnv({ ago: PRICE_MAX_AGE_MS + 3600000 });
  const home = await get('/gr/stores/kotsovolos-gr/', stale);
  const link = firstCategory(home.text);
  const { text } = await get(link, stale);
  assert.equal(cards(text).length, PAGE_SIZE, 'the products stay');
  assert.ok(!/€/.test(visible(text)) && !text.includes('sc-price'), 'without prices');
  assert.ok(!visible(text).includes('Οι τιμές προέρχονται'));
  const old = await catalogEnv({ ago: CATALOG_MAX_AGE_MS + 3600000 });
  assert.ok(!(await get('/gr/stores/kotsovolos-gr/', old)).text.includes('cat-grid'), 'no catalogue after 72 hours');
  assert.equal((await get(link, old)).r.status, 404);
  // The database busy with an import: the store page keeps its sets, a category says to try again (503).
  const busy = await catalogEnv({ failOn: /FROM (categories|products)/ });
  const b1 = await get('/gr/stores/kotsovolos-gr/', busy);
  assert.equal(b1.r.status, 200);
  assert.ok(!b1.text.includes('cat-grid') && b1.text.includes('sets-h'));
  const b2 = await get(link, busy);
  assert.equal(b2.r.status, 503);
  assert.equal(b2.r.headers.get('Retry-After'), '300');
  assert.ok(visible(b2.text).includes('ενημερώνεται'));
  // Another name in the address: to the real one; an unknown id: 404; the UK address of a category: 404.
  const id = link.match(/\/c\/(\d+)-/)[1];
  const moved = await get(`/gr/stores/kotsovolos-gr/c/${id}-wrong/`, stale);
  assert.equal(moved.r.status, 301);
  assert.equal(new URL(moved.r.headers.get('location')).pathname, link);
  assert.equal((await get('/gr/stores/kotsovolos-gr/c/123-x/', stale)).r.status, 404);
  assert.equal((await get(link.replace('/gr', ''), stale)).r.status, 404);
  assert.equal((await get(link.replace('kotsovolos-gr', 'kouzinika-gr'), stale)).r.status, 404, 'only the direct stores have a catalogue');
  // The whole database busy (an import): 503 for the category, the store page with its sets; a store in the middle of
  // its load ("loading"): 503 too, never half a store.
  const down = await catalogEnv({ failOn: /FROM stores/ });
  assert.equal((await get(link, down)).r.status, 503);
  const d1 = await get('/gr/stores/kotsovolos-gr/', down);
  assert.equal(d1.r.status, 200);
  assert.ok(!d1.text.includes('cat-grid'));
  const loading = await catalogEnv();
  loading.CATALOG.sqlite.prepare('UPDATE stores SET loading = 1').run();
  assert.equal((await get(link, loading)).r.status, 503);
  assert.ok(!(await get('/gr/stores/kotsovolos-gr/', loading)).text.includes('cat-grid'));
});

test('L228: the prices of the sets come from the catalogue when its feed is newer than the deploy\'s', async () => {
  const key = priceKey('https://www.kotsovolos.gr/ProductDisplay?partNumber=273143');
  const secret = new Map([['138', { t: NOW - 20 * 3600000, p: new Map([[key, 300]]) }]]);
  const cat = new Map([['138', { t: NOW - 3600000, products: 5, picks: new Map([[key, 359.99]]) }]]);
  assert.equal(mergePrices(secret, cat, NOW).get('138').p.get(key), 359.99, 'the newer feed');
  const oldCat = new Map([['138', { t: NOW - 30 * 3600000, products: 5, picks: new Map([[key, 1]]) }]]);
  assert.equal(mergePrices(secret, oldCat, NOW).get('138').p.get(key), 300, 'not an older one');
  assert.equal(mergePrices(new Map(), new Map([['138', { t: NOW - 25 * 3600000, products: 5, picks: new Map([[key, 1]]) }]]), NOW).size, 0, 'never one older than 24 hours');
  // On the page: the set shows the catalogue's price.
  const env = await catalogEnv();
  const { text } = await get('/gr/stores/kotsovolos-gr/', env);
  assert.ok(text.includes('359,99'), 'the price of the set from the catalogue');
  const stores = await catalogStores(env.CATALOG, NOW + 1);
  assert.ok(catalogFresh(stores.get('138'), NOW));
});

test('L233: the sitemap lists the category pages of the catalogue (in /gr/, while it is fresh), each a page that answers 200', async () => {
  const env = await catalogEnv();
  const sm = await get('/sitemap.xml', env, { cc: null });
  assert.equal(sm.r.status, 200);
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(new Set(locs).size, locs.length, 'every address once');
  const cats = locs.filter(l => l.includes('/c/'));
  const want = env.CATALOG.sqlite.prepare('SELECT id, slug FROM categories WHERE program = 138 AND products > 0').all();
  assert.equal(want.length > 3, true);
  assert.deepEqual(cats.slice().sort(), want.map(c => `${LIVE}/gr/stores/kotsovolos-gr/c/${c.id}-${c.slug}/`).sort(), 'every category with products, in the Greek edition');
  assert.ok(locs.includes(`${LIVE}/gr/stores/kotsovolos-gr/`) && locs.includes(`${LIVE}/`), 'the other pages as before');
  for (const loc of cats) {
    const { r, text } = await get(loc.slice(LIVE.length), env);
    assert.equal(r.status, 200, loc);
    assert.ok(text.includes(`<link rel="canonical" href="${loc}">`) && !text.includes('name="robots"'), `${loc}: its own canonical, indexed`);
  }
  // None without our Linkwise code, with a catalogue older than 72 hours or in the middle of a load; the sitemap stays
  // whole when the database does not answer.
  const noCode = { ...(await catalogEnv()), LINKWISE_CODE: '' };
  const stale = await catalogEnv({ ago: CATALOG_MAX_AGE_MS + 3600000 });
  const loading = await catalogEnv();
  loading.CATALOG.sqlite.prepare('UPDATE stores SET loading = 1').run();
  const busy = await catalogEnv({ failOn: /FROM categories/ });
  const down = await catalogEnv({ failOn: /FROM stores/ });
  for (const [name, e] of [['no code', noCode], ['stale', stale], ['loading', loading], ['categories busy', busy], ['database down', down]]) {
    const x = await get('/sitemap.xml', e, { cc: null });
    assert.equal(x.r.status, 200, name);
    assert.ok(!x.text.includes('/c/') && x.text.includes(`<loc>${LIVE}/</loc>`) && x.text.trimEnd().endsWith('</urlset>'), `${name}: no category, the rest as before`);
  }
  const without = await get('/sitemap.xml', {}, { cc: null });
  assert.ok(!without.text.includes('/c/'), 'no CATALOG database: as before');
});
