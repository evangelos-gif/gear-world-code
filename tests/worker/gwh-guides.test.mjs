// Gear World Hub gift guides (4/11/2026): the pages are made from sites/gwh/guides/guides.json by tools/gwh-guides.mjs.
// Gear World is the hero (links go to Gear World product pages, never /out/ or /go/), real prices with
// "Prices checked <dates>, may change", no "we tested", no "UK retailers", allow-listed files (L04), small pages (L02),
// no red or green (L35), and the Hub links to every guide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadData, buildPages, renderGuide, dateLabel, money, readProductPage, SITES, checkedText, savingClaims } from '../../tools/gwh-guides.mjs';

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
      assert.ok(!('was' in it), `${it.name}: no "was" price (L107)`);
      if (it.rrp != null) assert.ok(it.rrp > it.price, `${it.name}: the RRP is higher`);
      assert.match(it.checked || '', /^2026-\d{2}-\d{2}$/, `${it.name}: the day it was last checked on its site`);
    }
    // The title promises a price range: it must be true. Rule (L109): whole pounds, the low end rounded DOWN and the high
    // end rounded UP (cheapest £19.95 -> "from £19", dearest £155.95 -> "to £156"), so every product is inside it.
    const prices = g.items.map(i => i.price);
    const lo = Math.floor(Math.min(...prices) + 1e-9);
    const hi = Math.ceil(Math.max(...prices) - 1e-9);
    const nums = [...g.title.matchAll(/£([0-9.]+)/g)].map(m => m[1]);
    assert.deepEqual(nums, [String(lo), String(hi)], `${g.slug}: "from £${lo} to £${hi}" in the title (cheapest ${Math.min(...prices)}, dearest ${Math.max(...prices)})`);
    assert.deepEqual([...g.metaTitle.matchAll(/£([0-9.]+)/g)].map(m => m[1]), [String(lo)], `${g.slug}: "from £${lo}" in the meta title`);
    // A card with offers shows offers[0] at the card's own price: that offer is the card's own product (same id).
    for (const it of g.items.filter(x => x.offers)) {
      assert.equal(it.offers[0].id, Number(it.url.match(/-(\d+)\/$/)[1]), `${it.name}: offers[0] is the product the card links to`);
      assert.equal(it.offers[0].price, it.price, `${it.name}: offers[0] has the card's price`);
    }
  }
});

test('guides: Gear World is the hero, honest texts, "Prices checked <dates>, may change"', () => {
  for (const [rel, html] of Object.entries(pages)) {
    const g = data.guides.find(x => rel === `guides/${x.slug}/index.html`);
    const checked = checkedText(g ? g.items : data.guides.flatMap(x => x.items));
    assert.ok(html.includes(`Prices checked ${checked}, may change.`), `${rel}: prices checked line`);
    assert.ok(!/previous price|<s>|<s\s|gd-save|biggest saving|cheapest|% below/i.test(html), `${rel}: no previous price, saving or "cheapest" (L107)`);
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

test('guides: the price check reads the price, the stock and the RRP of a product page', () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"X","offers":{"@type":"Offer","price":"15.40","availability":"https://schema.org/InStock"}}</script>
    <p class="shelf-price"><span class="price" data-price="15.40">£15.40</span> <span class="rrp"><span data-i18n="RRP {0}" data-i18n-0="£22.00" data-i18n-keep="0">RRP <span translate="no">£22.00</span></span></span></p>`;
  assert.deepEqual(readProductPage(html), { price: 15.4, inStock: true, rrp: 22 });
  assert.deepEqual(readProductPage('<script type="application/ld+json">{"@type":"Product","offers":{"price":"9.99","availability":"https://schema.org/OutOfStock"}}</script>'), { price: 9.99, inStock: false, rrp: null });
  assert.equal(money(25), '£25.00');
  assert.equal(dateLabel('2026-11-04'), '4 Nov 2026');
  assert.equal(checkedText([{ checked: '2026-10-26' }, { checked: '2026-10-24' }]), 'between 24 Oct 2026 and 26 Oct 2026');
  assert.equal(checkedText([{ checked: '2026-10-31' }]), '31 Oct 2026');
});

test('guides: no "previous price", <s> or gd-save anywhere in the Hub files (L107)', () => {
  assert.deepEqual(savingClaims(), []);
});

test('guides: the price check reads THIS product from the page when the structured data is an AggregateOffer (L101)', () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"X","offers":{"@type":"AggregateOffer","priceCurrency":"GBP","lowPrice":"12.00","highPrice":"19.99","offerCount":3}}</script>
    <p class="shelf-price"><span class="price" data-price="15.40" data-currency="GBP">£15.40</span><s class="was">£22.00</s></p>
    <div><dt><span data-i18n="Stock at {0}" data-i18n-0="Shop">Stock at Shop</span></dt><dd class="ok">In stock</dd></div>`;
  assert.deepEqual(readProductPage(html), { price: 15.4, inStock: true, rrp: 22 });
  assert.equal(readProductPage(html.replace('<dd class="ok">In stock</dd>', '<dd class="warn">Out of stock</dd>')).inStock, false);
});

test('guides: the price check still reads a product page where "Stock at <retailer>" keeps the name untranslated (L103)', () => {
  const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"X","offers":{"@type":"AggregateOffer","priceCurrency":"GBP","lowPrice":"12.00","highPrice":"19.99","offerCount":3}}</script>
    <p class="shelf-price"><span class="price" data-price="15.40" data-currency="GBP">£15.40</span></p>
    <div><dt><span data-i18n="Stock at {0}" data-i18n-0="Shop" data-i18n-keep="0">Stock at <span translate="no">Shop</span></span></dt><dd class="warn">Out of stock</dd></div>`;
  assert.deepEqual(readProductPage(html), { price: 15.4, inStock: false, rrp: null });
});

test('guides: the live guard plans one SELECT by id per site and finds every product that would show a notice (L107)', async () => {
  const { plan, judge, linkedIds } = await import('../../tools/gwh-guide-guard.mjs');
  const lines = await plan();
  assert.deepEqual(lines.map(l => l[0]).sort(), ['cgw', 'kgw', 'mgw', 'vgw', 'wgw']);
  for (const [, db, sql] of lines) {
    assert.match(db, /^[a-z-]+$/);
    // Plain names and numbers only: the PowerShell tool passes it on one command line (no quote, < > & | ^ %).
    assert.match(sql, /^SELECT [a-z_, ]+ FROM products WHERE id IN \([0-9,]+\)$/);
  }
  assert.equal(lines.find(l => l[0] === 'vgw')[2].includes('last_seen_at'), true, 'VGW: the newer layout');
  assert.equal(lines.find(l => l[0] === 'mgw')[2].includes('updated_at'), true, 'MGW: the older layout');
  const at = Date.parse('2026-11-09T12:00:00Z');
  const items = linkedIds().wgw;
  const row = (it, extra = {}) => ({ id: it.id, retailer: 'Coes', price: it.price, stock_status: 'in stock', is_active: 1, updated_at: '2026-11-08 10:00:00', ...extra });
  const answer = rows => JSON.stringify([{ results: rows, success: true }]);
  let r = await judge('wgw', answer(items.map(it => row(it))), at);
  assert.equal(r.notices, 0);
  assert.equal(r.old, 0);
  assert.equal(r.prices, 0);
  assert.match(r.text, /GUARD wgw checked=12 notices=0 old=0 prices=0$/);
  r = await judge('wgw', answer([
    row(items[0], { updated_at: '2026-10-01 10:00:00' }),          // no price check for 30 days
    row(items[1], { retailer: '100 Percent Pure' }),               // shown as "100% PURE": does not deliver to the UK
    row(items[2], { is_active: 0 }),                                // switched off
    row(items[3], { stock_status: 'out of stock' }),                // out of stock
    row(items[4], { updated_at: '2026-10-20 10:00:00' }),          // 20 days: "Check price and stock at the retailer"
    row(items[5], { price: items[5].price + 1 }),                   // another price: reported, not a notice
    ...items.slice(6, 11).map(it => row(it))                        // items[11] missing
  ]), at);
  assert.equal(r.notices, 5);
  assert.equal(r.old, 1);
  assert.equal(r.prices, 1, 'another price is counted (L109: the live step refuses on it)');
  assert.match(r.text, /GUARD wgw checked=12 notices=5 old=1 prices=1$/);
  assert.match(r.text, /NOTICE wgw \d+ .*no price check for 30 days/);
  assert.match(r.text, /NOTICE wgw \d+ .*100% PURE does not deliver to the UK/);
  assert.match(r.text, /NOTICE wgw \d+ .*switched off/);
  assert.match(r.text, /NOTICE wgw \d+ .*out of stock/);
  assert.match(r.text, /NOTICE wgw \d+ .*not in the database/);
  assert.match(r.text, /OLD    wgw \d+ .*more than 14 days ago/);
  assert.match(r.text, /PRICE  wgw \d+ /);
  // An answer that is not JSON: nothing confirmed, every product counts as a notice.
  assert.equal((await judge('wgw', 'X [ERROR] something', at)).notices, 12);
});

test('guides: the guard counts a PRICE as the preview of 9 Nov 2026 found it, also for another retailer of the card (L109)', async () => {
  const { judge, linkedIds } = await import('../../tools/gwh-guide-guard.mjs');
  const at = Date.parse('2026-11-09T20:28:00Z');
  const answer = rows => JSON.stringify([{ results: rows, success: true }]);
  const row = (id, retailer, price, extra = {}) => ({ id, retailer, price, stock_status: 'In Stock', is_active: 1, updated_at: '2026-11-09 19:48:36', ...extra });
  // The DIY guide before L109: the Makita at £105.95 (and £119.95 at My Tool Shed), while the site said £155.95 at both.
  const makita = 'https://constructiongearworld.com/product/makita-mr009g-40v-max-xgt-cordless-dab-radio-and-work-light-lantern-no-batteries-no-battery-charger-1685/';
  const diy = { guides: [{ slug: 'christmas-gifts-for-diy-lovers', items: [{ url: makita, name: 'Makita MR009G', price: 105.95, offers: [{ retailer: 'Tooled Up', price: 105.95, id: 1685 }, { retailer: 'My Tool Shed', price: 119.95, id: 37787 }] }] }] };
  assert.deepEqual(linkedIds(diy).cgw.map(i => i.id), [1685, 37787], 'the offer at the other retailer is read by its id, the card\'s own id once');
  let r = await judge('cgw', answer([row(1685, 'Tooled Up', 155.95), row(37787, 'My Tool Shed', 155.95)]), at, diy);
  assert.equal(r.notices, 0);
  assert.equal(r.prices, 2);
  assert.match(r.text, /PRICE  cgw 1685 .*£105\.95 in guides\.json, £155\.95 on the site/);
  assert.match(r.text, /PRICE  cgw 37787 .*at My Tool Shed: £119\.95 in guides\.json, £155\.95 on the site/);
  assert.match(r.text, /GUARD cgw checked=2 notices=0 old=0 prices=2$/);
  // The two LEGO sets of the kids' guide (KGW, older layout, "Joybuy UK" shown as Joybuy).
  const kids = { guides: [{ slug: 'christmas-gifts-for-kids', items: [
    { url: 'https://kidsgearworld.com/product/lego-city-vintage-steam-train-60511-4589/', name: 'LEGO City Vintage Steam Train 60511', price: 63.99 },
    { url: 'https://kidsgearworld.com/product/lego-technic-tipping-dump-truck-42203-5164/', name: 'LEGO Technic Tipping Dump Truck 42203', price: 33.74 }
  ] }] };
  r = await judge('kgw', answer([row(4589, 'Joybuy UK', 79.99, { stock_status: 'in stock' }), row(5164, 'Joybuy UK', 44.99, { stock_status: 'in stock' })]), at, kids);
  assert.equal(r.notices, 0);
  assert.equal(r.prices, 2);
  assert.match(r.text, /£63\.99 in guides\.json, £79\.99 on the site/);
  assert.match(r.text, /£33\.74 in guides\.json, £44\.99 on the site/);
  // A price the database does not give (null) is never taken as the same price.
  r = await judge('kgw', answer([row(4589, 'Joybuy UK', null, { stock_status: 'in stock' }), row(5164, 'Joybuy UK', 33.74, { stock_status: 'in stock' })]), at, kids);
  assert.equal(r.prices, 1);
});

test('guides: every product checked within 14 days of the guides date, none from a retailer whose rows no longer refresh, a factual "why" (L109)', () => {
  const day = 86400000;
  // 9 Nov 2026: the legacy feed refresh gives these retailers no new date (Coes: no new price check since 26 Oct;
  // GS Workwear: not refreshed yet), so their products show "Check price and stock at the retailer" and then a notice.
  const notRefreshed = ['Bazta UK', 'Plusshop UK', 'InStock UK', 'Red Gorilla', 'Red Gorilla International', 'GRABO', 'Cronjager', 'GS Workwear', 'Coes'];
  for (const g of data.guides) {
    for (const it of g.items) {
      const age = (Date.parse(data.checked) - Date.parse(it.checked)) / day;
      assert.ok(age >= 0 && age <= 14, `${it.name}: checked ${it.checked}, ${age} days before ${data.checked}`);
      for (const r of [it.retailer, ...(it.offers || []).map(o => o.retailer)]) assert.ok(!notRefreshed.includes(r), `${it.name}: ${r}`);
      assert.ok(!/£|\d\s*%|\bsave\b|saving|price drop|previous price|\bwas\b|\bshop\b|UK retailers|cheap/i.test(it.why), `${it.name}: "${it.why}"`);
      for (const o of it.offers || []) assert.ok(Number.isInteger(o.id), `${it.name}: the offer at ${o.retailer} has its id, so the guard reads its price`);
    }
  }
});

// L109: no saving, urgency or "shop" words in any text of the guides (Google Ads): titles, descriptions, intros, tips and
// the visible text of every page (the list of guides too).
const GUIDE_CLAIM = /\bsav(e|es|ed|ing|ings)\b|%\s*off\b|\bbelow\b|previous price|\bwas\s*£|price drops?\b|\bdeals?\b|black friday|order early|\bhurry|UK retailers|\bshop(s|ping)?\b/i;

test('guides: no saving, urgency or "shop" words in titles, descriptions, intros, tips or page text (L109)', () => {
  // The two sentences the checker of 9 Nov 2026 found would fail.
  assert.match('plus one tip that can save you money on perfume', GUIDE_CLAIM);
  assert.match('Some of these tools are marked "available to order", which usually means delivery takes a few extra days, so order early for Christmas.', GUIDE_CLAIM);
  for (const s of ['20% off', 'Below RRP', 'was £30', 'Price drop', 'Today\'s deals', 'Hurry', 'Shop now', 'Christmas shopping', 'UK retailers', 'savings', 'Black Friday']) assert.match(s, GUIDE_CLAIM, s);
  for (const s of ['Delivery costs can change the total', 'the retailer\'s website', 'Retailer: Tooled Up', 'RRP £22.00', 'a workshop']) assert.doesNotMatch(s, GUIDE_CLAIM, s);
  for (const g of data.guides) {
    const texts = [['title', g.title], ['metaTitle', g.metaTitle], ['description', g.description], ['intro', g.intro],
      ...(g.tips || []).flatMap((t, i) => [[`tips[${i}].label`, t.label], [`tips[${i}].text`, t.text || t.html || '']]),
      ...g.items.map((it, i) => [`items[${i}].why`, it.why])];
    for (const [k, v] of texts) assert.doesNotMatch(String(v), GUIDE_CLAIM, `${g.slug} ${k}: "${v}"`);
  }
  for (const [rel, html] of Object.entries(pages)) {
    const words = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
    const m = words.match(GUIDE_CLAIM);
    assert.equal(m, null, `${rel}: "${m && words.slice(Math.max(0, m.index - 60), m.index + 60)}"`);
  }
});
