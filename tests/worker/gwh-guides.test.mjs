// Gear World Hub gift guides (4/11/2026): the pages are made from sites/gwh/guides/guides.json by tools/gwh-guides.mjs.
// Gear World is the hero (links go to Gear World product pages, never /out/ or /go/), real prices with
// "Price checked <date>, may change", no "we tested", no "UK retailers", allow-listed files (L04), small pages (L02),
// no red or green (L35), and the Hub links to every guide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadData, buildPages, renderGuide, dateLabel, money, readProductPage, SITES } from '../../tools/gwh-guides.mjs';

const ROOT = new URL('../../sites/gwh/', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');
const data = loadData();
const pages = buildPages(data);
const DOMAINS = Object.values(SITES).map(s => s.domain);

test('guides: the pages in the repo are exactly what guides.json makes (run: node tools/gwh-guides.mjs build)', () => {
  assert.equal(Object.keys(pages).length, 6);
  for (const [rel, html] of Object.entries(pages)) {
    assert.ok(existsSync(new URL('public/' + rel, ROOT)), `${rel} exists`);
    assert.equal(read('public/' + rel), html, `${rel} is up to date`);
  }
});

test('guides: 5 guides, 58 products, real prices checked on one date, every product in stock with an image', () => {
  assert.match(data.checked, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(data.guides.length, 5);
  assert.equal(data.guides.reduce((n, g) => n + g.items.length, 0), 58);
  const slugs = new Set();
  for (const g of data.guides) {
    assert.match(g.slug, /^[a-z0-9-]+$/);
    assert.ok(!slugs.has(g.slug)); slugs.add(g.slug);
    assert.ok(SITES[g.site], `${g.slug}: known site`);
    assert.ok(g.description.length >= 110 && g.description.length <= 165, `${g.slug}: description ${g.description.length} characters`);
    for (const it of g.items) {
      assert.ok(Number.isFinite(it.price) && it.price > 0, `${it.name}: price`);
      assert.match(it.image, /^https:\/\//, `${it.name}: https image`);
      const host = new URL(it.url).hostname;
      assert.ok(DOMAINS.includes(host), `${it.name}: links to a Gear World site (${host})`);
      assert.match(new URL(it.url).pathname, /^\/product\//, `${it.name}: a product page`);
      if (it.offers) assert.equal(it.price, Math.min(...it.offers.map(o => o.price)), `${it.name}: the lowest of the shops`);
      if (it.was != null) assert.ok(it.was > it.price, `${it.name}: the previous price is higher`);
    }
    // The title promises a price range: it must be true (rounded to whole pounds).
    const prices = g.items.map(i => i.price);
    const nums = [...g.title.matchAll(/£([0-9.]+)/g)].map(m => Number(m[1]));
    assert.equal(nums.length, 2, `${g.slug}: from/to in the title`);
    assert.ok(Math.abs(nums[0] - Math.min(...prices)) <= 0.5, `${g.slug}: from ${nums[0]} = ${Math.min(...prices)}`);
    assert.ok(Math.abs(nums[1] - Math.max(...prices)) <= 0.5, `${g.slug}: to ${nums[1]} = ${Math.max(...prices)}`);
  }
});

test('guides: Gear World is the hero, honest texts, "Price checked <date>, may change"', () => {
  const checked = dateLabel(data.checked);
  for (const [rel, html] of Object.entries(pages)) {
    assert.ok(html.includes(`Price checked ${checked}, may change.`), `${rel}: price checked line`);
    assert.ok(!/href="[^"]*\/(out|go)\/[^"]*"/.test(html), `${rel}: no /out/ or /go/ link`);
    assert.ok(!/awin1\.com|cread\.php/.test(html), `${rel}: no retailer affiliate link on the Hub page`);
    const words = html.replace(/<[^>]+>/g, ' ');
    assert.ok(!/\bwe (have )?tested\b(?! these)/i.test(words.replace(/We have not tested/g, '')), `${rel}: no "we tested"`);
    assert.ok(!/\breviewed\b|\bour review\b|★/i.test(words), `${rel}: no reviews or stars`);
    assert.ok(!/UK retailers/i.test(words), `${rel}: no "UK retailers"`);
    assert.ok(!/Black Friday/i.test(words), `${rel}: no Black Friday`);
    assert.ok(html.length < 100 * 1024, `${rel}: under 100 KB (L02)`);
    assert.equal((html.match(/<style/g) || []).length, 0, `${rel}: no inline styles`);
    assert.equal((html.match(/<script(?![^>]*(src=|ld\+json))/g) || []).length, 0, `${rel}: no inline scripts`);
    assert.match(html, /<link rel="canonical" href="https:\/\/gearworldhub\.com\/guides\//);
    assert.ok(html.includes('href="/affiliate-disclosure/"'), `${rel}: link to the affiliate disclosure`);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(ld['@type'], 'ItemList');
    for (const el of ld.itemListElement) assert.ok(el.name.length <= 150, 'name at most 150 characters (L24)');
  }
  // Retailers only in the small print: never in a heading.
  for (const g of data.guides) {
    const html = renderGuide(data, g);
    const retailers = new Set(g.items.flatMap(i => [i.retailer, ...(i.offers || []).map(o => o.retailer)]).filter(Boolean));
    for (const h of html.match(/<h[12]>[^<]*<\/h[12]>/g) || []) for (const r of retailers) assert.ok(!h.includes(r), `${g.slug}: "${r}" not in ${h}`);
  }
  // Titles differ (one page, one title).
  const titles = Object.values(pages).map(h => h.match(/<title>([^<]+)<\/title>/)[1]);
  assert.equal(new Set(titles).size, titles.length);
});

test('guides: allow-listed (L04), the Hub links to each guide, styles without red or green (L35), 44 px buttons', () => {
  const allow = read('public-allowlist.txt').split(/\r?\n/).map(s => s.trim());
  for (const rel of [...Object.keys(pages), 'guides/guides.css']) assert.ok(allow.includes(rel), `allow-list has ${rel}`);
  const index = read('public/index.html');
  for (const g of data.guides) assert.ok(index.includes(`href="/guides/${g.slug}/"`), `the Hub links to ${g.slug}`);
  const css = read('public/guides/guides.css');
  for (const c of css.match(/#[0-9a-f]{6}\b/gi) || []) {
    const [r, gg, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    assert.ok(!(r > 150 && gg < 90 && b < 90), `${c} is not red`);
    assert.ok(!(gg > 150 && r < 110 && b < 110), `${c} is not green`);
  }
  assert.match(css, /\.gd-btn \{[^}]*min-height: 44px/);
  assert.match(read('public/hub-v2.css'), /\.gwh2-guides a\{[^}]*min-height:44px/);
  assert.ok(!/@keyframes|animation:/.test(css), 'nothing moves');
});

test('guides: the price check reads the price, the stock and the previous price of a product page', () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"X","offers":{"@type":"Offer","price":"15.40","availability":"https://schema.org/InStock"}}</script>
    <p class="shelf-price"><span class="price" data-price="15.40">£15.40</span><s class="was">£22.00</s></p>`;
  assert.deepEqual(readProductPage(html), { price: 15.4, inStock: true, was: 22 });
  assert.deepEqual(readProductPage('<script type="application/ld+json">{"@type":"Product","offers":{"price":"9.99","availability":"https://schema.org/OutOfStock"}}</script>'), { price: 9.99, inStock: false, was: null });
  assert.equal(money(25), '£25.00');
  assert.equal(dateLabel('2026-11-04'), '4 Nov 2026');
});
