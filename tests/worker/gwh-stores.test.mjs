// Lessons L166 (owner's option B, 16 Nov 2026): the Stores section of the Hub instead of a new site.
// The pages are made by tools/gwh-stores.mjs from sites/gwh/stores/stores.json and link only to Gear World
// pages, so the Hub keeps no affiliate link of its own (L103); codes, sales and banners carry an end date that hides them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { loadData, buildPages, validate, siteLink, SITES, BAD_WORDS, ASSETS } from '../../tools/gwh-stores.mjs';

const PUB = 'sites/gwh/public';
const data = loadData();
const pages = buildPages(data);
const clone = () => JSON.parse(JSON.stringify(data));

test('L166: the committed /stores/ pages are exactly what stores.json makes (run node tools/gwh-stores.mjs build)', () => {
  for (const [rel, html] of Object.entries(pages)) assert.equal(readFileSync(`${PUB}/${rel}`, 'utf8'), html, rel);
  const dirs = readdirSync(`${PUB}/stores`, { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== 'banners').map(e => e.name).sort();
  assert.deepEqual(dirs, data.retailers.map(r => r.slug).sort(), 'no page of a retailer that left stores.json');
});

test('L166: stores.json is valid, and the check refuses what may never go on the page', () => {
  assert.deepEqual(validate(data), []);
  const expired = clone(); expired.retailers[0].offers[0].end = '2026-11-01';
  assert.ok(validate(expired).some(p => p.includes('ended on 2026-11-01')), 'an expired offer is refused');
  const pct = clone(); pct.retailers[0].offers[0].title = 'Up to 70% off';
  assert.ok(validate(pct).some(p => p.includes('L103/L107')), 'a percentage is refused (L107)');
  const shop = clone(); shop.retailers[0].about = 'One of our shops';
  assert.ok(validate(shop).some(p => p.includes('L103/L107')), 'shop words are refused (L103)');
  const site = clone(); site.retailers[0].sites.push('xyz');
  assert.ok(validate(site).some(p => p.includes('sites')));
  const twice = clone(); twice.retailers[1].slug = twice.retailers[0].slug;
  assert.ok(validate(twice).some(p => p.includes('same slug')));
  const bannerOut = clone(); bannerOut.retailers[0].banner = { image: 'x.jpg', alt: 'Joybuy', width: 600, height: 200, href: 'https://homegearworld.com/go/joybuy-baby', end: '2026-12-31', checked: 'Manager 2026-11-16' };
  const bp = validate(bannerOut);
  assert.ok(bp.some(p => p.includes('Gear World page only')), 'a banner may not link to /go/ (an affiliate link on the Hub)');
  assert.ok(bp.some(p => p.includes('public/stores/banners/')), 'a banner picture must be a file of the Hub');
  const unchecked = clone(); unchecked.retailers[0].banner = { image: 'x.jpg', alt: 'Joybuy', width: 600, height: 200, href: 'https://homegearworld.com/discount-codes/joybuy/', end: '2026-12-31' };
  assert.ok(validate(unchecked).some(p => p.includes('checked by the Manager')), 'no banner without the Manager\'s check');
  assert.throws(() => buildPages(expired), /stores\.json/);
});

test('L166: every link goes to a Gear World page, never /out/, /go/, Awin or a retailer (the Hub has no affiliate link, L103)', () => {
  for (const [rel, html] of Object.entries(pages)) {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
    for (const h of hrefs) {
      assert.ok(/^(\/|mailto:contact@gearworldhub\.com$|https:\/\/gearworldhub\.com\/|https:\/\/[a-z]+gearworld\.com\/)/.test(h), `${rel}: ${h}`);
      assert.ok(!/\/(out|go)\/|awin|sovrn|cj\.com|anrdoezrs|joybuy\.co|aliexpress\.com|tooled-up\.com/i.test(h), `${rel}: ${h}`);
    }
    assert.ok(!/<script(?![^>]*(application\/ld\+json|src="\/))/i.test(html), `${rel}: no inline script (CSP of L106)`);
  }
});

test('L166: no shop, partner, sponsor, saving or urgency words in the pages (L103, L107)', () => {
  for (const [rel, html] of Object.entries(pages)) {
    const text = html.replace(/<[^>]+>/g, ' ');
    const bad = text.match(BAD_WORDS);
    assert.ok(!bad, `${rel}: ${bad && bad[0]}`);
    assert.ok(!/\bshops?\b|shopping|\bpartners?\b|partnership|sponsor|our retailers|trusted/i.test(html), rel);
  }
});

test('L166: each retailer page says where it delivers, has its sites in its country\'s view, and its offers with end dates', () => {
  for (const r of data.retailers) {
    const html = pages[`stores/${r.slug}/index.html`];
    assert.match(html, new RegExp(`<link rel="canonical" href="https://gearworldhub.com/stores/${r.slug}/">`));
    assert.match(html, /<meta name="robots" content="index,follow">/);
    const desc = html.match(/<meta name="description" content="([^"]+)">/)[1];
    assert.ok(desc.length >= 100 && desc.length <= 160, `${r.slug}: description of ${desc.length} characters`);
    assert.match(html, /<p class="gd-checked">Delivers to: [A-Z]/);
    assert.ok(html.includes(`<h1><span translate="no">`), `${r.slug}: the retailer name stays untranslated`);
    for (const code of r.sites) {
      const href = siteLink(r, code).replace(/&/g, '&amp;');
      assert.ok(html.includes(`href="${href}"`), `${r.slug}: link to ${code}`);
      assert.ok(href.startsWith(`https://${SITES[code].domain}/search?q=`));
      if (r.deliversTo.includes('GB')) assert.ok(!href.includes('for='), `${r.slug}: the UK view needs no ?for=`);
      else assert.ok(href.endsWith(`for=${r.deliversTo[0].toLowerCase()}`), `${r.slug}: ?for= of its country (L160)`);
    }
    assert.equal((html.match(/class="gd-item rt-item rt-offer" data-end="\d{4}-\d{2}-\d{2}"/g) || []).length, r.offers.length);
    for (const o of r.offers) {
      assert.ok(html.includes(`https://${SITES[o.site].domain}/discount-codes/${r.slug}/`), `${r.slug}: the site page of the offer`);
      if (o.kind === 'code') assert.ok(html.includes(`<strong class="rt-code" translate="no">${o.code}</strong>`));
    }
    if (r.offers.length) assert.match(html, /through its affiliate programme/);
    assert.ok(html.includes(r.deliversTo.includes('GB') ? 'these links may show none' : 'view, with only the products that deliver there'), `${r.slug}: what a visitor from another country sees`);
    assert.ok(!html.includes('rt-banner"'), `${r.slug}: no banner until one is checked`);
  }
  // AliExpress PL delivers only to Poland: the sites open in the Poland view.
  assert.ok(pages['stores/aliexpress-pl/index.html'].includes('https://cargearworld.com/search?q=AliExpress+PL&amp;retailer=AliExpress+PL&amp;for=pl'));
});

test('L166: the list groups the retailers by the country they deliver to, the UK first', () => {
  const html = pages['stores/index.html'];
  const gb = html.indexOf('Stores that deliver to the United Kingdom');
  const pl = html.indexOf('Stores that deliver to Poland');
  assert.ok(gb > 0 && pl > gb);
  for (const r of data.retailers) assert.ok(html.includes(`href="/stores/${r.slug}/"`), r.slug);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.+?)<\/script>/)[1]);
  assert.equal(ld.numberOfItems, data.retailers.length);
  // the order of the list = the order of the page (reviewer 16/11/2026)
  const pageOrder = [...html.matchAll(/<h3><a href="\/stores\/([a-z0-9-]+)\/">/g)].map(m => m[1]);
  assert.deepEqual(ld.itemListElement.map(i => i.url.split('/')[4]), pageOrder);
  // the title names UK retailers (a UK visitor reads it), and no count that could outlive an offer
  assert.match(html, /<title>Stores on Gear World: Joybuy, Tooled Up, PCHUB\.UK and more/);
  assert.ok(!/\d+ (discount codes?|sales?)\b/.test(html), 'no number of codes or sales on the list');
  assert.match(html, /<span data-end="2026-12-06"> · discount codes until 6 Dec 2026<\/span>/);
  assert.ok(!/added every week/.test(html), 'no promise nothing backs up (L107)');
});

test('L166: validate refuses an offer that ended on the UK day, so the Hub tool stops the live step (exit 24)', () => {
  assert.deepEqual(validate(data, '2026-12-06'), [], 'the last day still counts');
  const ended = validate(data, '2026-12-07');
  assert.ok(ended.length >= 4 && ended.every(p => /ended on 2026-12-06/.test(p)), ended.join('; '));
  assert.deepEqual(validate(data, '2026-01-01'), [], 'a day before the data\'s own day is the data\'s day');
  const tool = readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
  assert.ok(tool.includes("& node $tool validate") && tool.includes('Finish 24'));
});

test('L166: an expired code, sale or banner is hidden by retailers.js (UK day), and "nothing right now" shows', () => {
  const js = readFileSync(`${PUB}/stores/stores.js`, 'utf8');
  const make = (ends, today) => {
    const items = ends.map(e => ({ hidden: false, getAttribute: () => e, cls: 'rt-offer' }));
    const none = { hidden: true };
    const group = { querySelectorAll: () => items.filter(i => !i.hidden), querySelector: () => none };
    const doc = { querySelectorAll: sel => (sel === '[data-end]' ? items : [group]) };
    const RealDTF = Intl.DateTimeFormat;
    const ctx = { document: doc, Date, Intl: { DateTimeFormat: function () { return { format: () => today }; } } };
    vm.runInNewContext(js, ctx);
    void RealDTF;
    return { items, none };
  };
  let r = make(['2026-12-06', '2026-11-30'], '2026-12-01');
  assert.deepEqual(r.items.map(i => i.hidden), [false, true]);
  assert.equal(r.none.hidden, true);
  r = make(['2026-12-06'], '2026-12-06');
  assert.equal(r.items[0].hidden, false, 'the last day still shows');
  r = make(['2026-12-06'], '2026-12-07');
  assert.equal(r.items[0].hidden, true);
  assert.equal(r.none.hidden, false, 'nothing left: the page says so');
  const css = readFileSync(`${PUB}/stores/stores.css`, 'utf8');
  assert.match(css, /\[data-end\]\[hidden\][^{]*\{ display: none !important; \}/, 'hidden wins over the grid of .gd-item');
});

test('L166: the home page has the Stores card after the 13 worlds, in 11 languages, and the 13 world cards stay 13', () => {
  const index = readFileSync(`${PUB}/index.html`, 'utf8');
  assert.equal((index.match(/class="gwh-quick-world gwh-image-world"/g) || []).length, 13);
  assert.equal((index.match(/data-world="STORES"/g) || []).length, 1);
  assert.ok(index.indexOf('data-world="STORES"') > index.indexOf('data-world="ZGW"'));
  assert.match(index, /<a class="gwh-quick-world gwh2-stores-card" href="\/stores\/" data-world="STORES">/);
  assert.match(index, /src="\/hub-stores\.jpg"/);
  assert.ok(!/gwh-image-world-(title|cta|description)[^>]*data-gwh2="stores/.test(index), 'own classes: the world cards are counted by class');
  assert.match(index, /\/hub-v2\.css\?v=(20261116-stores|20261120-popup|20261123-mega)\d+/);
  assert.match(index, /\/hub-v2\.js\?v=(20261118-bf1|20261123-mega1)/); // L174, L188, L192: the Featured pick, the language of the links, the Black Friday link, the Mega Stores bar
  const hjs = readFileSync(`${PUB}/hub-v2.js`, 'utf8');
  for (const key of ['storesTitle', 'storesDesc', 'storesCta']) {
    const arr = JSON.parse(hjs.match(new RegExp(`${key}: (\\[[^\\]]+\\])`))[1]);
    assert.equal(arr.length, 11, key);
    assert.ok(arr.every(s => s.trim().length > 0 && !/\bshops?\b|partner|sponsor/i.test(s)), key);
    if (key === 'storesDesc') assert.ok(arr.every(s => s.startsWith('Joybuy, Tooled Up, PCHUB.UK') && !/AliExpress/.test(s)), 'the card names UK retailers only');
  }
  const css = readFileSync(`${PUB}/hub-v2.css`, 'utf8');
  assert.ok(!/\[data-world="(ZGW|STORES)"\]\{grid-column:1 \/ -1;\}/.test(css), 'owner 16/11/2026: Pets and Stores small, side by side on the phone');
  assert.ok(css.includes('@media (max-width:379px){.gwh2-world-img{width:40px;height:40px;}.gwh-image-world-title,.gwh2-rc-title{font-size:13px;}}'), 'narrow phones: smaller picture and title, so "Καταστήματα" stays on one line');
  assert.match(css, /\.gwh-image-world,\.gwh2-stores-card\{display:flex;/);
  assert.ok(existsSync(`${PUB}/hub-stores.jpg`) && readFileSync(`${PUB}/hub-stores.jpg`).length < 90000);
});

test('L166: every new file is in the Hub allowlist (L04), and the Hub tool knows the release', () => {
  const allow = readFileSync('sites/gwh/public-allowlist.txt', 'utf8').split(/\r?\n/).map(s => s.trim());
  for (const rel of [...Object.keys(pages), 'stores/stores.css', 'stores/stores.js', 'hub-stores.jpg']) assert.ok(allow.includes(rel), rel);
  const tool = readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
  for (const rel of Object.keys(pages)) assert.ok(tool.includes(`'public/${rel}' = `), `report text for ${rel}`);
  assert.ok(tool.includes("href=\"/stores/\" data-world=\"STORES\"") && tool.includes("'/stores/'"), 'the live check opens /stores/');
  assert.match(readFileSync('docs/LESSONS.md', 'utf8'), /\n\| L166 \|/);
  assert.equal(ASSETS.retailersCss.startsWith('/stores/stores.css?v='), true);
});
