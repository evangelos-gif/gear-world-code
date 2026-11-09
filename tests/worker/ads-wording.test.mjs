// Lessons L102: after the Google Ads appeal of 7 Nov 2026 (L101) an independent check still found shop-like words:
// "Delivers to" on every product card as if Gear World delivered, "Christmas offers" over lists that may hold none, the
// Hub's "connected shopping ecosystem" of "specialist shops", and gearworldgroup.com saying its structured data had
// stock. Now every card says "<retailer> delivers to" (the name untranslated), the seasonal banner speaks of gifts or of
// comparing prices and shows only above real codes or price drops, the Hub speaks of product search and price
// comparison in its 11 languages, and the group page says what the structured data really has.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { productCard, deliveryLine, tr } from '../../src/pages/layout.js';
import { seasonsOf } from '../../src/lib/seasons.js';
import { toString } from '../../src/lib/html.js';
import { groupPage, legalPage, legalPaths } from '../../src/group.js';
import group from '../../sites/group/site.config.js';

const CODES = ['agw', 'bgw', 'cgw', 'ggw', 'hgw', 'kgw', 'mgw', 'pgw', 'sgw', 'tgw', 'vgw', 'wgw', 'zgw'];
const card = (site, retailer) => toString(productCard(site, {
  id: 7, product_name: 'Test product', brand: 'Acme', retailer, price: 19.99, was_price: null, currency: 'GBP', in_stock: 1,
  item_condition: 'new', image_url: 'https://img.example/a.jpg', product_slug: 'test-product', offer_count: 1
}));

test('tr(): a kept part stays in its own translate="no" span; the other parts and the attributes stay as before', () => {
  assert.equal(toString(tr('View at {0}', 'Joybuy')), '<span data-i18n="View at {0}" data-i18n-0="Joybuy">View at Joybuy</span>');
  assert.equal(toString(tr('{0} delivers to', { text: 'Very', keep: true })),
    '<span data-i18n="{0} delivers to" data-i18n-0="Very" data-i18n-keep="0"><span translate="no">Very</span> delivers to</span>');
  assert.equal(toString(tr('{0} of {1}', 2, { text: 'B&Q', keep: true })),
    '<span data-i18n="{0} of {1}" data-i18n-0="2" data-i18n-1="B&amp;Q" data-i18n-keep="1">2 of <span translate="no">B&amp;Q</span></span>');
  assert.equal(toString(tr('Until {0}', { text: '24 Dec 2026', date: '2026-12-24' })),
    '<span data-i18n="Until {0}" data-i18n-0="24 Dec 2026" data-i18n-0-date="2026-12-24">Until 24 Dec 2026</span>');
});

test('the 13 sites: every card says "<retailer> delivers to", never a bare "Delivers to"; a site without delivery data shows nothing', async () => {
  for (const c of CODES) {
    const site = (await import(`../../sites/${c}/site.config.js`)).default;
    const retailer = Object.keys((site.deliversTo && site.deliversTo.retailers) || {})[0] || 'Joybuy';
    const html = card(site, retailer);
    assert.ok(!/Delivers to/.test(html), `${c}: no bare "Delivers to"`);
    if (site.deliversTo) {
      assert.ok(html.includes(`<span class="ship-word"><span data-i18n="{0} delivers to" data-i18n-0="${retailer}" data-i18n-keep="0"><span translate="no">${retailer}</span> delivers to</span></span>: `), `${c}: "${retailer} delivers to"`);
    } else {
      assert.ok(!/delivers to|label-ship/.test(html), `${c}: no delivery data, no delivery line`);
      assert.equal(toString(deliveryLine(site, retailer)), '', c);
    }
    assert.match(site.assetVersion, /^(2026-11-08-[a-z]{3}-(cleanup|security)|2026-11-09-[a-z]{3}-compliance)-\d+$/, `${c}: a new asset version for the new dictionaries (L31; -wording- for L102, -cleanup- for L103, -security- for L106)`);
  }
});

test('the site script keeps the retailer name in translate="no" when it translates "<retailer> delivers to"', () => {
  const js = readFileSync('sites/tgw/public/assets/site.js', 'utf8');
  assert.match(js, /function fillKept\(node, s, args, keep\) \{/);
  assert.match(js, /span\.setAttribute\('translate', 'no'\);/);
  assert.match(js, /if \(node\.hasAttribute\('data-i18n-keep'\)\) fillKept\(node, t\(node\.getAttribute\('data-i18n'\)\), args, node\.getAttribute\('data-i18n-keep'\)\.split\(' '\)\);/);
  for (const c of CODES) assert.equal(readFileSync(`sites/${c}/public/assets/site.js`, 'utf8'), js, `${c}: the same site.js (tools/theme-site.mjs)`);
});

test('the 130 dictionaries: the new texts, and no "Quantity", seasonal "offers" or bare "Delivers to" / "Stock" left', () => {
  const NEW = ['Gifts for everyone', 'Compare prices before you buy', 'Stock at the retailer', 'Sold by', '{0} delivers to'];
  const GONE = ['Quantity', 'Christmas offers', 'Black Friday offers', 'Halloween offers', 'Seasonal offers', 'Delivers to', 'Stock'];
  let files = 0;
  for (const c of CODES) {
    const dir = `sites/${c}/public/assets/i18n`;
    const ship = Boolean(readFileSync(`sites/${c}/site.config.js`, 'utf8').match(/\bdeliversTo\s*:/));
    for (const f of readdirSync(dir)) {
      const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
      for (const k of [...NEW, ...(ship ? ['The retailer delivers to'] : [])]) assert.ok(d[k] && d[k].trim() && d[k] !== k, `${c}/${f}: "${k}"`);
      for (const k of GONE) assert.ok(!(k in d), `${c}/${f}: old "${k}"`);
      assert.match(d['{0} delivers to'], /\{0\}/, `${c}/${f}: the retailer name has its place`);
      files++;
    }
  }
  assert.equal(files, 130);
  // Nothing on the sites asks for "Quantity" any more (the saved list has none, L101).
  for (const f of ['src/pages/cart.js', 'src/pages/layout.js', 'src/pages/compare.js', 'sites/tgw/public/assets/site.js']) {
    assert.ok(!/Quantity/.test(readFileSync(f, 'utf8')), `${f}: no "Quantity"`);
  }
});

test('the seasonal banner of the 13 sites never promises offers: gifts at Christmas, comparing prices otherwise', () => {
  for (const year of [2026, 2027, 2028]) {
    for (const s of seasonsOf(year)) {
      assert.ok(!/offer|deal|sale/i.test(s.title), `${year} ${s.id}: "${s.title}"`);
      if (s.id === 'christmas') assert.equal(s.title, 'Gifts for everyone', 'the same idea as the Hub (L101)');
    }
  }
  const src = readFileSync('src/pages/season.js', 'utf8');
  assert.ok(!/Seasonal offers/.test(src), 'the section is named after the season');
  assert.match(src, /if \(!season \|\| !\(Number\(listed\) > 0\)\) return '';/, 'no banner above an empty list');
  assert.match(readFileSync('src/pages/offers.js', 'utf8'), /seasonBanner\(site, 'offers-list', now, promos\.length\)/);
  assert.match(readFileSync('src/pages/listing.js', 'utf8'), /seasonBanner\(site, 'deals-list', now, result\.products\.length\)/);
});

test('the Hub: product search and price comparison in all 11 languages, no shops, no sponsored-card styles', () => {
  const pub = 'sites/gwh/public';
  const index = readFileSync(`${pub}/index.html`, 'utf8');
  const tjs = readFileSync(`${pub}/translations.js`, 'utf8');
  const hjs = readFileSync(`${pub}/hub-v2.js`, 'utf8');
  const css = readFileSync(`${pub}/hub-v2.css`, 'utf8');
  const row = key => JSON.parse(tjs.match(new RegExp(`\\n    ${key}: (\\[[^\\n]*\\]),\\n`))[1]);
  const title = row('aboutTitle');
  const desc = row('aboutDesc');
  assert.equal(title.length, 11);
  assert.equal(desc.length, 11);
  assert.equal(title[0], 'Independent product search and price comparison.');
  assert.ok(index.includes(`<h2>${title[0]}</h2>`), 'the page starts in English with the same title');
  assert.ok(index.includes(desc[0]), 'and the same text');
  assert.ok(new Set(title).size === 11 && new Set(desc).size === 11, 'translated in every language');
  // Words of a shop, in the page, the scripts and the legal pages (the script texts are read by Google too).
  const SHOP = /shopping ecosystem|specialist shopping|specialist shops|shopping sites|shopping worlds|Shopping Discovery|Shop by Interest|Shop sport|Shop →|Einkaufen →|our retailers|Gear World retailers|shopping directory|one complete shop/i;
  const files = ['index.html', 'translations.js', 'hub-v2.js', 'about/index.html', 'about/about.js', 'privacy/index.html', 'terms/index.html',
    'cookies/index.html', 'contact/index.html', 'affiliate-disclosure/index.html', 'guides/index.html'];
  for (const f of files) assert.ok(!SHOP.test(readFileSync(`${pub}/${f}`, 'utf8')), `${f}: no shop wording`);
  assert.equal((index.match(/<span class="gwh-image-world-cta">Explore →<\/span>/g) || []).length, 13, 'the 13 world cards say "Explore"');
  assert.ok(!/Ökosystem|écosystème|ecosistema|ecossistema|ecosysteem|ekosistem|ecosistem|экосистем|οικοσύστημα/i.test(tjs), 'no "ecosystem" in any language');
  // The campaign texts of hub-v2.js: no shops, and Halloween speaks of the Gear Worlds, not of offers.
  const hrow = key => JSON.parse(hjs.match(new RegExp(`\\n    ${key}: (\\[[^\\n]*\\]),\\n`))[1]);
  assert.equal(hrow('allTitle')[0], '13 price-comparison sites, one search');
  assert.equal(hrow('halloweenTitle')[0], 'Halloween across 13 Gear Worlds');
  assert.equal(hrow('halloweenText')[0], 'Discount codes from retailers listed on Gear World, each with its end date.');
  for (const k of ['allTitle', 'halloweenTitle', 'halloweenText', 'fitnessCta']) assert.equal(hrow(k).length, 11, k);
  assert.ok(!/Halloween offers|Christmas offers/.test(hjs));
  // The sponsored card left on 7/11/2026 (L101); its styles go too.
  assert.ok(!/gwh-business|gwh-sponsored|sponsored card/i.test(css));
  // New ?v= for the 3 changed files (L31; -wording1 for L102, -cleanup1 for L103).
  for (const f of ['hub-v2.css', 'translations.js']) assert.ok(index.includes(`/${f}?v=20261108-cleanup1`), f);
});

test('the Hub baseline is the version that runs live since the Google Ads fixes (L101), so the next release can check it', () => {
  const lines = readFileSync('sites/gwh/live-baseline.txt', 'utf8').split('\n');
  const version = lines.find(l => l.startsWith('# version:')) || '';
  assert.match(version, /Google Ads review fixes/);
  const paths = lines.filter(l => l && !l.startsWith('#')).map(l => l.split(' | '));
  for (const p of paths) {
    assert.equal(p.length, 4, p.join(' | '));
    assert.match(p[2], /^[0-9a-f]{64}$/);
    assert.ok(existsSync(`sites/gwh/${p[0]}`), `${p[0]} is in the repo`);
  }
  const names = paths.map(p => p[0]);
  for (const f of ['public/about/index.html', 'public/about/about.js', 'worker.js', 'public/index.html']) assert.ok(names.includes(f), f);
  assert.deepEqual(names.filter(n => n.startsWith('public/')), [...names.filter(n => n.startsWith('public/'))].sort(), 'the public files in path order');
});

test('gearworldgroup.com: the owner\'s headline, structured data as it really is (no stock), no "UK shoppers" anywhere', () => {
  const home = groupPage(group, { products: 1000, retailers: 10 });
  assert.ok(home.includes('<h1>Independent product search and price-comparison sites</h1>'));
  assert.ok(home.includes('<p class="lede">Each product shows the retailer that sells it and where that retailer delivers.</p>'));
  assert.ok(home.includes('<li>Product pages with structured data for search engines: the lowest and highest price across retailers, the number of retailers, and the GTIN when the feed has one.</li>'));
  assert.ok(!/structured data \(price, stock|price, stock, GTIN/.test(home), 'stock is not in the structured data (AggregateOffer, L101)');
  for (const page of [home, ...legalPaths().map(p => legalPage(group, p))]) {
    assert.ok(!/UK shoppers|UK retailers|for UK/.test(page), 'no "UK shoppers" or "UK retailers"');
  }
});
