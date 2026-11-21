// Mega Stores Gear World: only product photos that open (owner, 21 Nov 2026, lessons L211: a CasualShoes card showed an
// empty photo, 404 at the store), and the "not listed for your country" pages never in a search engine. Fake fetch, never
// the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import site from '../../sites/ogw/site.config.js';
import { createGuidesWorker, photoOpens, keepOpenPhotos, storeProducts, storeCacheKey } from '../../src/marketplace-guides.js';

const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-21T12:00:00Z');
const ON = { AMAZON_LINKS: 'on' };
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// A photo server: /ok/ 206 image/jpeg, /full/ 200 image/webp, /gone/ 404, /html/ 200 text/html, /down/ a network error,
// /slow/ never answers (until the abort).
function photoServer() {
  const calls = [];
  const f = async (input, init = {}) => {
    const u = new URL(String(input));
    calls.push({ url: u.toString(), init });
    if (u.pathname.startsWith('/down/')) throw new Error('network down');
    if (u.pathname.startsWith('/slow/')) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    if (u.pathname.startsWith('/gone/')) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/html' } });
    if (u.pathname.startsWith('/html/')) return new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
    if (u.pathname.startsWith('/full/')) return new Response(new Uint8Array(4096), { status: 200, headers: { 'Content-Type': 'image/webp' } });
    return new Response(new Uint8Array(1024), { status: 206, headers: { 'Content-Type': 'image/jpeg' } });
  };
  f.calls = calls;
  return f;
}
const product = (n, kind = 'ok') => ({ name: `Item ${n}`, brand: 'Acme', image: `https://img.example/${kind}/${n}.jpg`, url: `https://mensgearworld.com/product/p-${n}/`, site: 'MGW' });

test('L211: a photo opens when the first KB answers 200 or 206 with an image type; never more than that KB', async () => {
  const f = photoServer();
  assert.equal(await photoOpens('https://img.example/ok/1.jpg', f), true);
  assert.equal(await photoOpens('https://img.example/full/1.jpg', f), true);
  assert.equal(await photoOpens('https://img.example/gone/1.jpg', f), false);
  assert.equal(await photoOpens('https://img.example/html/1.jpg', f), false);
  assert.equal(await photoOpens('https://img.example/down/1.jpg', f), false);
  const t0 = Date.now();
  assert.equal(await photoOpens('https://img.example/slow/1.jpg', f, { timeoutMs: 30 }), false);
  assert.ok(Date.now() - t0 < 1000, 'a slow photo server is given up');
  assert.equal(f.calls[0].init.headers.Range, 'bytes=0-1023');
  assert.match(f.calls[0].init.headers.Accept, /^image\//);
  assert.ok(!('method' in f.calls[0].init) || f.calls[0].init.method === 'GET');
});

test('L211: only the products whose photo opens, in their order, topped up from the rest up to the number kept', async () => {
  const f = photoServer();
  const list = [product(1), product(2, 'gone'), product(3), product(4, 'html'), product(5), product(6, 'down'), product(7), product(8), product(9)];
  const r = await keepOpenPhotos(list, f, 5, { timeoutMs: 50 });
  assert.deepEqual(r.products.map(p => p.name), ['Item 1', 'Item 3', 'Item 5', 'Item 7', 'Item 8']);
  assert.equal(r.blocked, false);
  assert.ok(r.checked <= 9 && r.checked >= 8, 'the first 5, then only as many more as were missing');
  const few = await keepOpenPhotos([product(1, 'gone'), product(2)], f, 5);
  assert.deepEqual(few.products.map(p => p.name), ['Item 2'], 'fewer than wanted: what opens');
});

test('L211: when not one photo of 3 or more opens, the check is taken as blocked: the products stay, kept 10 minutes', async () => {
  const f = photoServer();
  const allGone = [1, 2, 3, 4].map(n => product(n, 'gone'));
  const r = await keepOpenPhotos(allGone, f, 24);
  assert.equal(r.blocked, true);
  assert.equal(r.products.length, 4);
  const two = await keepOpenPhotos([product(1, 'gone'), product(2, 'gone')], f, 24);
  assert.equal(two.blocked, false, 'two broken photos are just broken');
  assert.equal(two.products.length, 0);
});

test('L211: a store page shows no product whose photo does not open; the copy keeps only those', async () => {
  const store = site.stores.find(s => s.slug === 'casualshoes-gr');
  const siteFetch = async input => {
    const u = new URL(String(input));
    const rows = [1, 2, 3, 4, 5].map(n => ({
      product_name: `Παπούτσι ${n}`, brand: 'Acme', retailer: store.name, stock_status: 'in_stock', delivers_to: ['GR'],
      image_url: `https://img.example/${n === 2 ? 'gone' : n === 4 ? 'html' : 'ok'}/${n}.jpg`, product_url: `https://${u.hostname}/product/p-${n}/`
    }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const photos = photoServer();
  const cache = new Map();
  const c = { async match(k) { const r = cache.get(String(k)); return r ? r.clone() : undefined; }, async put(k, r) { cache.set(String(k), r.clone()); } };
  const got = await storeProducts(site, store, { fetch: siteFetch, photoFetch: photos, cache: c });
  assert.deepEqual(got.products.map(p => p.name), ['Παπούτσι 1', 'Παπούτσι 3', 'Παπούτσι 5']);
  const kept = cache.get(storeCacheKey(site, store));
  assert.equal(kept.headers.get('Cache-Control'), 'public, max-age=3600');
  assert.ok(!JSON.stringify(await kept.clone().json()).includes('/gone/'), 'the copy has no broken photo');

  const w = createGuidesWorker(site, { fetch: siteFetch, photoFetch: photoServer(), cache: null, now: () => NOW });
  const r = new Request(`${LIVE}/stores/casualshoes-gr/`, { headers: { 'User-Agent': BROWSER } });
  Object.defineProperty(r, 'cf', { value: { country: 'GR' } });
  const html = await (await w.fetch(r, ON)).text();
  assert.equal((html.match(/<li class="pcard">/g) || []).length, 3);
  assert.ok(!html.includes('/gone/') && !html.includes('/html/'));
});

test('L211: a store whose photo server refuses every check keeps its products, and the copy is kept 10 minutes only', async () => {
  const store = site.stores.find(s => s.slug === 'parex-gr');
  const siteFetch = async input => {
    const u = new URL(String(input));
    const rows = [1, 2, 3, 4].map(n => ({ product_name: `Πορτοφόλι ${n}`, brand: 'Acme', retailer: store.name, stock_status: 'in_stock', delivers_to: ['GR'],
      image_url: `https://img.example/gone/${n}.jpg`, product_url: `https://${u.hostname}/product/p-${n}/` }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const cache = new Map();
  const c = { async match(k) { const r = cache.get(String(k)); return r ? r.clone() : undefined; }, async put(k, r) { cache.set(String(k), r.clone()); } };
  const got = await storeProducts(site, store, { fetch: siteFetch, photoFetch: photoServer(), cache: c });
  assert.equal(got.products.length, 4);
  assert.equal(cache.get(storeCacheKey(site, store)).headers.get('Cache-Control'), 'public, max-age=600');
});

test('L211: the tests\' own site fetch checks no photo unless a photo fetch is given (the live Worker always checks)', async () => {
  const store = site.stores.find(s => s.slug === 'tooled-up');
  const calls = [];
  const siteFetch = async input => {
    calls.push(String(input));
    const u = new URL(String(input));
    const rows = [{ product_name: 'Drill', brand: 'Acme', retailer: store.name, stock_status: 'in_stock', delivers_to: ['GB'], image_url: 'https://img.example/gone/1.jpg', product_url: `https://${u.hostname}/product/p-1/` }];
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  await storeProducts(site, store, { fetch: siteFetch, cache: null });
  assert.ok(calls.every(u => u.includes('/api/products')), 'only the sites were read');
});

test('L211: "not listed for your country" pages are noindex; a store page where the store is listed is not', async () => {
  const siteFetch = async input => {
    const u = new URL(String(input));
    return new Response(JSON.stringify({ ok: true, products: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const w = createGuidesWorker(site, { fetch: siteFetch, cache: null, now: () => NOW });
  const get = async (path, cc) => {
    const r = new Request(LIVE + path, { headers: { 'User-Agent': BROWSER } });
    Object.defineProperty(r, 'cf', { value: { country: cc } });
    return (await w.fetch(r, ON)).text();
  };
  const elsewhere = await get('/stores/joybuy/', 'GR');
  assert.ok(elsewhere.includes('store-elsewhere') && elsewhere.includes('<meta name="robots" content="noindex">'));
  const gr = await get('/stores/kouzinika-gr/', 'GB');
  assert.ok(gr.includes('store-elsewhere') && gr.includes('<meta name="robots" content="noindex">'), 'a Greek store from the UK too');
  for (const [path, cc] of [['/stores/joybuy/', 'GB'], ['/stores/kouzinika-gr/', 'GR'], ['/', 'GR'], ['/', 'GB']]) {
    assert.ok(!(await get(path, cc)).includes('noindex'), `${path} from ${cc}: indexable`);
  }
});
