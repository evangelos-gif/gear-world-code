// AliExpress UK on Mega Stores (owner, 28 Nov 2026, lessons L242): «με δικές του κατηγορίες σαν ολοκληρωμένο κατάστημα,
// όχι με μια εικόνα μόνο, και στην κυλιόμενη μπάρα του Hub να είναι δεύτερο μετά το Amazon».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import liveSite from '../../sites/ogw/site.config.js';
import { createGuidesWorker, storeCategories, pagePaths, STORE_CAT_PER_PAGE } from '../../src/marketplace-guides.js';
import { MEGA_BAR_STORES, megaStoresFor } from '../../sites/gwh/worker.js';
import { GEAR_WORLDS } from '../../promos/network.js';

const site = { ...liveSite, hiddenNetworks: [] };
const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-28T12:00:00Z');
const ali = site.stores.find(s => s.slug === 'aliexpress-uk');
const byHost = new Map(GEAR_WORLDS.map(w => [new URL(w.url).hostname, w.code]));

// A fake /api/products of the Gear World sites: `per` rows of AliExpress UK for each site and category asked, and
// every request kept, so the test sees what was asked.
function makeFetch(per = 60) {
  const asked = [];
  const f = async url => {
    const u = new URL(url);
    asked.push(u);
    const code = byHost.get(u.hostname);
    if (!code || u.pathname !== '/api/products') return new Response('no', { status: 404 });
    const cat = u.searchParams.get('category') || 'all';
    const pageNo = Number(u.searchParams.get('page') || '1');
    const limit = Number(u.searchParams.get('limit') || '8');
    const n = Math.min(limit, pageNo >= 3 ? 0 : per);
    const products = Array.from({ length: n }, (_, i) => ({
      id: i + 1, product_name: `${code} ${cat} p${pageNo} item ${i + 1}`, brand: 'Ugreen', retailer: u.searchParams.get('retailer'),
      price: 12.34, currency: 'GBP', stock_status: 'in_stock', image_url: `https://ae.example/${code}/${cat}/${pageNo}/${i}.jpg`, delivers_to: ['GB'],
      product_url: `https://${u.hostname}/product/${cat}-${pageNo}-${i}/`, affiliate_url: `https://${u.hostname}/out/${i}`
    }));
    return new Response(JSON.stringify({ ok: true, products }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { f, asked };
}

test('L242: AliExpress UK is second after Amazon, on Mega Stores and in the Hub\'s bar (the same list)', () => {
  assert.deepEqual(site.stores.slice(0, 3).map(s => s.slug), ['amazon', 'aliexpress-uk', 'joybuy']);
  assert.deepEqual(MEGA_BAR_STORES.slice(0, 3).map(s => s.slug), ['amazon', 'aliexpress-uk', 'joybuy']);
  assert.deepEqual(megaStoresFor('GB').slice(0, 2).map(s => s.name), ['Amazon', 'AliExpress UK']);
  assert.equal(megaStoresFor('GR').some(s => s.slug === 'aliexpress-uk'), false, 'the UK only');
  const hub = readFileSync('sites/gwh/public/index.html', 'utf8');
  // Both copies of the scrolling strip, Amazon then AliExpress UK (a text pill, no logo of our own making).
  const pills = [...hub.matchAll(/data-store="([a-z0-9-]+)"/g)].map(m => m[1]);
  const half = pills.length / 2;
  assert.deepEqual([pills.slice(0, 3), pills.slice(half, half + 3)], [['amazon', 'aliexpress-uk', 'joybuy'], ['amazon', 'aliexpress-uk', 'joybuy']]);
  assert.match(hub, /<span class="gwh2-mega-pill" data-store="aliexpress-uk" data-logo="text-only" translate="no">AliExpress UK<\/span>/);
  assert.ok(hub.includes('Stores: <span translate="no">Amazon, AliExpress UK, Joybuy,'));
});

test('L242: its own categories, each from Gear World sites and categories that exist', () => {
  const cats = storeCategories(ali);
  assert.equal(cats.length, ali.categories.length, 'every category is valid');
  assert.ok(cats.length >= 20);
  assert.equal(new Set(cats.map(k => k.slug)).size, cats.length);
  // Every one of the 13 sites has at least one category.
  assert.deepEqual([...new Set(cats.flatMap(k => k.from.map(x => x[0])))].sort(), [...ali.sites].sort());
  // A category slug of a newer site is one of that site's own (its category-rules.js).
  for (const k of cats) {
    for (const [code, slug] of k.from) {
      if (slug === null) continue;
      const rules = readFileSync(`sites/${code.toLowerCase()}/category-rules.js`, 'utf8');
      assert.ok(rules.includes(`'${slug}'`), `${k.slug}: ${code} has the category ${slug}`);
    }
  }
  // The first page of each category is on the sitemap; the other pages are not.
  const paths = pagePaths(site, 'on');
  for (const k of cats) assert.ok(paths.includes(`/stores/aliexpress-uk/${k.slug}/`), k.slug);
  assert.ok(!paths.some(p => p.includes('?page=')));
});

test('L242: the store page lists the categories; a category page shows 48 products from its sites, with a next page', async () => {
  const { f, asked } = makeFetch();
  const w = createGuidesWorker(site, { fetch: f, cache: null, now: () => NOW });
  const store = await (await w.fetch(new Request(`${LIVE}/stores/aliexpress-uk/`), {})).text();
  assert.match(store, /<h2 id="cats-h">Categories of <span translate="no">AliExpress UK<\/span><\/h2>/);
  for (const k of ali.categories) assert.ok(store.includes(`href="/stores/aliexpress-uk/${k.slug}/"`), k.slug);
  assert.ok(store.includes('<span class="cat-name" translate="no">Phones &amp; Smartwatches</span>'));

  asked.length = 0;
  const r = await w.fetch(new Request(`${LIVE}/stores/aliexpress-uk/car-parts-tools-care/`), {});
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.match(text, /<h1 translate="no">Car Parts, Tools &amp; Care<\/h1>/);
  // The six categories of Car Gear World, one request each, with the store's name and the UK.
  const api = asked.filter(u => u.pathname === '/api/products');
  assert.deepEqual(api.map(u => u.searchParams.get('category')), ['parts-maintenance', 'garage-tools-equipment', 'diagnostics-battery', 'car-care-detailing', 'tyres-wheels', 'safety-winter']);
  assert.ok(api.every(u => u.hostname === 'cargearworld.com' && u.searchParams.get('retailer') === 'AliExpress UK' && u.searchParams.get('deliver_to') === 'GB' && u.searchParams.get('limit') === '8'));
  assert.equal((text.match(/<li class="pcard">/g) || []).length, STORE_CAT_PER_PAGE);
  assert.ok(!/£|12\.34|\/out\/|\/go\//.test(text), 'never a price, /out/ or /go/');
  assert.ok(text.includes('href="/stores/aliexpress-uk/car-parts-tools-care/?page=2" rel="next"'));
  assert.ok(!text.includes('href="/stores/aliexpress-uk/car-parts-tools-care/"'), 'the other categories only, not itself');
  assert.ok(text.includes('href="/stores/aliexpress-uk/phones-smartwatches/"'));
  assert.ok(!/<meta name="robots"[^>]*noindex/.test(text), 'the first page goes to Google');

  // A whole site as one category (null): no category asked; page 2 asks page=2, is noindex and links back.
  asked.length = 0;
  const p2 = await w.fetch(new Request(`${LIVE}/stores/aliexpress-uk/womens-fashion/?page=2`), {});
  assert.equal(p2.status, 200);
  const t2 = await p2.text();
  const a2 = asked.filter(u => u.pathname === '/api/products');
  assert.deepEqual(a2.map(u => [u.hostname, u.searchParams.get('category'), u.searchParams.get('page'), u.searchParams.get('limit')]), [['womensgearworld.com', null, '2', '48']]);
  assert.match(t2, /<meta name="robots" content="noindex, follow">/);
  assert.ok(t2.includes('href="/stores/aliexpress-uk/womens-fashion/">Back to the first page</a>'));
  // After the last page: 404, never an empty page.
  assert.equal((await w.fetch(new Request(`${LIVE}/stores/aliexpress-uk/womens-fashion/?page=3`), {})).status, 404);
  for (const bad of ['?page=0', '?page=21', '?page=x']) assert.equal((await w.fetch(new Request(`${LIVE}/stores/aliexpress-uk/womens-fashion/${bad}`), {})).status, 404, bad);
  assert.equal((await w.fetch(new Request(`${LIVE}/stores/aliexpress-uk/nothing-here/`), {})).status, 404);
  const slash = await w.fetch(new Request(`${LIVE}/stores/aliexpress-uk/gaming`), {});
  assert.equal(slash.status, 301);
  // Another store has no such pages.
  assert.equal((await w.fetch(new Request(`${LIVE}/stores/joybuy/gaming/`), {})).status, 404);
});

test('L242: from a country it does not deliver to, the category page says so and shows no products', async () => {
  const { f, asked } = makeFetch();
  const w = createGuidesWorker(site, { fetch: f, cache: null, now: () => NOW });
  const req = new Request(`${LIVE}/stores/aliexpress-uk/gaming/`);
  Object.defineProperty(req, 'cf', { value: { country: 'DE' } });
  const r = await w.fetch(req, {});
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.ok(!text.includes('<li class="pcard">'));
  assert.equal(asked.filter(u => u.pathname === '/api/products').length, 0, 'nothing read from the sites');
});
