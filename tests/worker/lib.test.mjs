import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGtin, gtinSchemaKey } from '../../src/lib/gtin.js';
import { slugify, productPath, savingPercent, truncate, formatPrice } from '../../src/lib/text.js';
import { html, raw, toString, jsonLd, esc } from '../../src/lib/html.js';
import { ftsQuery, normalizeSort } from '../../src/db.js';
import { readListingParams, hasFilters } from '../../src/pages/listing.js';
import { safeEqual } from '../../src/lib/security.js';
import site from '../../sites/tgw/site.config.js';
import { isPreviewHost } from '../../src/engine.js';

test('GTIN: valid codes pass the GS1 check digit (lessons L12)', () => {
  assert.equal(normalizeGtin('4006381333931'), '4006381333931');
  assert.equal(normalizeGtin('5012345678900'), '5012345678900');
  assert.equal(normalizeGtin('036000291452'), '036000291452');
  assert.equal(normalizeGtin('96385074'), '96385074');
  assert.equal(normalizeGtin('4006-3813-3393-1'), '4006381333931');
  assert.equal(gtinSchemaKey('4006381333931'), 'gtin13');
});

test('GTIN: wrong check digit, length or zeros are rejected', () => {
  for (const bad of ['5012345678901', '123', '0000000000000', 'ABC1234567890', '', null, '40063813339310']) {
    assert.equal(normalizeGtin(bad), null, String(bad));
  }
});

test('slugify and product paths', () => {
  assert.equal(slugify('Apple MacBook Air 13" (M3, 2024)'), 'apple-macbook-air-13-m3-2024');
  assert.equal(slugify('Café Écran'), 'cafe-ecran');
  assert.equal(slugify('!!!'), 'product');
  assert.ok(slugify('x'.repeat(200)).length <= 90);
  assert.equal(productPath({ id: 7, product_slug: 'abc' }), '/product/abc-7/');
  assert.equal(productPath({ id: 7, product_name: 'A B' }), '/product/a-b-7/');
});

test('saving percent only for real drops between 5% and 90%', () => {
  assert.equal(savingPercent(80, 100), 20);
  assert.equal(savingPercent(98, 100), 0);
  assert.equal(savingPercent(100, 90), 0);
  assert.equal(savingPercent(5, 100), 0);
  assert.equal(savingPercent(80, null), 0);
});

test('html escapes every value unless raw()', () => {
  const name = '<img src=x onerror=alert(1)> & "q"';
  assert.equal(toString(html`<p>${name}</p>`), '<p>&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;</p>');
  assert.equal(toString(html`<p>${raw('<b>ok</b>')}</p>`), '<p><b>ok</b></p>');
  assert.equal(toString(html`<ul>${['a', '<b>'].map(x => html`<li>${x}</li>`)}</ul>`), '<ul><li>a</li><li>&lt;b&gt;</li></ul>');
  assert.equal(esc("it's"), 'it&#39;s');
});

test('JSON-LD cannot close the script tag', () => {
  const out = toString(jsonLd({ name: '</script><script>alert(1)</script>' }));
  assert.ok(!out.slice(0, -'</script>'.length).includes('</script>'));
});

test('FTS query is built from words only', () => {
  assert.equal(ftsQuery('USB-C "charger"; DROP TABLE'), '"USB"* AND "C"* AND "charger"* AND "DROP"* AND "TABLE"*');
  assert.equal(ftsQuery('***'), '');
  assert.equal(normalizeSort('price-asc'), 'price-asc');
  assert.equal(normalizeSort('id; DROP TABLE products'), 'featured');
});

test('listing params are clamped', () => {
  const p = readListingParams(new URL('https://x/category/a/?page=99999&max=abc&min=10&stock=1&condition=used'));
  assert.equal(p.page, 500);
  assert.ok(Number.isNaN(p.maxPrice));
  assert.equal(p.minPrice, 10);
  assert.equal(p.inStock, true);
  assert.equal(p.condition, '');
  assert.equal(hasFilters(p), true);
  assert.equal(hasFilters(readListingParams(new URL('https://x/category/a/?page=2'))), false);
});

test('safeEqual', () => {
  assert.equal(safeEqual('Bearer abc', 'Bearer abc'), true);
  assert.equal(safeEqual('Bearer abc', 'Bearer abd'), false);
  assert.equal(safeEqual('', ''), false);
});

test('site config: no duplicate slugs, every category has the texts it needs', () => {
  const slugs = site.categories.map(c => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const c of site.categories) {
    assert.match(c.slug, /^[a-z0-9-]+$/);
    assert.ok(c.name && c.nav && c.intro && c.description && c.icon, c.slug);
    assert.ok(c.description.length <= 160, `${c.slug} description too long`);
  }
  assert.ok(formatPrice(1234.5, 'GBP', site.locale).startsWith('£'));
  assert.equal(truncate('one two three four', 9), 'one two…');
});

test('preview hosts are never indexed; the real domain and local development are', () => {
  assert.equal(isPreviewHost('technology-gear-world.example.workers.dev', 'technologygearworld.com'), true);
  assert.equal(isPreviewHost('technologygearworld.com', 'technologygearworld.com'), false);
  assert.equal(isPreviewHost('www.technologygearworld.com', 'technologygearworld.com'), false);
  assert.equal(isPreviewHost('127.0.0.1', 'technologygearworld.com'), false);
  assert.equal(isPreviewHost('localhost', 'technologygearworld.com'), false);
});

test('L24: Product structured data name is at most 150 characters, the page keeps the full name', async () => {
  const { productPage } = await import('../../src/pages/product.js');
  const long = 'Example Brand Mini Projector 720p Native with 1080p Support Wi-Fi 6 Bluetooth 5.4 Android 14 Auto Keystone Correction 180 Degree Rotation Portable Home Cinema Outdoor Movie Projector White';
  assert.ok(long.length > 150);
  const product = { id: 9, product_name: long, brand: 'Example Brand', retailer: 'Sample Store', price: 41.9, currency: 'GBP', in_stock: 1,
    item_condition: 'new', image_url: 'https://example.com/a.jpg', category_slug: site.categories[0].slug, description: 'Test product.', last_seen_at: '2026-10-21 06:00:00' };
  const page = productPage(site, product, site.categories[0], []);
  const out = typeof page === 'string' ? page : toString(page);
  const blocks = [...out.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
  const prod = blocks.flatMap(b => (Array.isArray(b) ? b : [b])).find(b => b['@type'] === 'Product');
  assert.ok(prod, 'Product schema present');
  assert.ok(prod.name.length <= 150, `name is ${prod.name.length} characters`);
  assert.ok(prod.name.endsWith('…'));
  assert.ok(out.includes(`<h1>${long}</h1>`), 'the page shows the full name');
});
