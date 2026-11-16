// Lessons L166 (owner's option B, 16 Nov 2026): the Retailers section of the Hub instead of a new site.
// The pages are made by tools/gwh-retailers.mjs from sites/gwh/retailers/retailers.json and link only to Gear World
// pages, so the Hub keeps no affiliate link of its own (L103); codes, sales and banners carry an end date that hides them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { loadData, buildPages, validate, siteLink, SITES, BAD_WORDS, ASSETS } from '../../tools/gwh-retailers.mjs';

const PUB = 'sites/gwh/public';
const data = loadData();
const pages = buildPages(data);
const clone = () => JSON.parse(JSON.stringify(data));

test('L166: the committed /retailers/ pages are exactly what retailers.json makes (run node tools/gwh-retailers.mjs build)', () => {
  for (const [rel, html] of Object.entries(pages)) assert.equal(readFileSync(`${PUB}/${rel}`, 'utf8'), html, rel);
  const dirs = readdirSync(`${PUB}/retailers`, { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== 'banners').map(e => e.name).sort();
  assert.deepEqual(dirs, data.retailers.map(r => r.slug).sort(), 'no page of a retailer that left retailers.json');
});

test('L166: retailers.json is valid, and the check refuses what may never go on the page', () => {
  assert.deepEqual(validate(data), []);
  const expired = clone(); expired.retailers[0].offers[0].end = '2026-11-01';
  assert.ok(validate(expired).some(p => p.includes('end date')), 'an expired offer is refused');
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
  assert.ok(bp.some(p => p.includes('public/retailers/banners/')), 'a banner picture must be a file of the Hub');
  const unchecked = clone(); unchecked.retailers[0].banner = { image: 'x.jpg', alt: 'Joybuy', width: 600, height: 200, href: 'https://homegearworld.com/discount-codes/joybuy/', end: '2026-12-31' };
  assert.ok(validate(unchecked).some(p => p.includes('checked by the Manager')), 'no banner without the Manager\'s check');
  assert.throws(() => buildPages(expired), /retailers\.json/);
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
    const html = pages[`retailers/${r.slug}/index.html`];
    assert.match(html, new RegExp(`<link rel="canonical" href="https://gearworldhub.com/retailers/${r.slug}/">`));
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
    assert.ok(!html.includes('rt-banner"'), `${r.slug}: no banner until one is checked`);
  }
  // AliExpress PL delivers only to Poland: the sites open in the Poland view.
  assert.ok(pages['retailers/aliexpress-pl/index.html'].includes('https://cargearworld.com/search?q=AliExpress+PL&amp;retailer=AliExpress+PL&amp;for=pl'));
});

test('L166: the list groups the retailers by the country they deliver to, the UK first', () => {
  const html = pages['retailers/index.html'];
  const gb = html.indexOf('Retailers that deliver to the United Kingdom');
  const pl = html.indexOf('Retailers that deliver to Poland');
  assert.ok(gb > 0 && pl > gb);
  for (const r of data.retailers) assert.ok(html.includes(`href="/retailers/${r.slug}/"`), r.slug);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.+?)<\/script>/)[1]);
  assert.equal(ld.numberOfItems, data.retailers.length);
});

test('L166: an expired code, sale or banner is hidden by retailers.js (UK day), and "nothing right now" shows', () => {
  const js = readFileSync(`${PUB}/retailers/retailers.js`, 'utf8');
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
  const css = readFileSync(`${PUB}/retailers/retailers.css`, 'utf8');
  assert.match(css, /\[data-end\]\[hidden\][^{]*\{ display: none !important; \}/, 'hidden wins over the grid of .gd-item');
});

test('L166: the home page has the Retailers card after the 13 worlds, in 11 languages, and the 13 world cards stay 13', () => {
  const index = readFileSync(`${PUB}/index.html`, 'utf8');
  assert.equal((index.match(/class="gwh-quick-world gwh-image-world"/g) || []).length, 13);
  assert.equal((index.match(/data-world="RETAILERS"/g) || []).length, 1);
  assert.ok(index.indexOf('data-world="RETAILERS"') > index.indexOf('data-world="ZGW"'));
  assert.match(index, /<a class="gwh-quick-world gwh2-retailers-card" href="\/retailers\/" data-world="RETAILERS">/);
  assert.match(index, /src="\/hub-retailers\.jpg"/);
  assert.ok(!/gwh-image-world-(title|cta|description)[^>]*data-gwh2="retailers/.test(index), 'own classes: the world cards are counted by class');
  assert.match(index, /\/hub-v2\.css\?v=20261116-retailers1/);
  assert.match(index, /\/hub-v2\.js\?v=20261116-retailers1/);
  const hjs = readFileSync(`${PUB}/hub-v2.js`, 'utf8');
  for (const key of ['retailersTitle', 'retailersDesc', 'retailersCta']) {
    const arr = JSON.parse(hjs.match(new RegExp(`${key}: (\\[[^\\]]+\\])`))[1]);
    assert.equal(arr.length, 11, key);
    assert.ok(arr.every(s => s.trim().length > 0 && !/\bshops?\b|partner|sponsor/i.test(s)), key);
  }
  const css = readFileSync(`${PUB}/hub-v2.css`, 'utf8');
  assert.ok(!css.includes('[data-world="ZGW"]{grid-column:1 / -1;}'), '14 cards: none alone on the phone');
  assert.match(css, /\.gwh-image-world,\.gwh2-retailers-card\{display:flex;/);
  assert.ok(existsSync(`${PUB}/hub-retailers.jpg`) && readFileSync(`${PUB}/hub-retailers.jpg`).length < 90000);
});

test('L166: every new file is in the Hub allowlist (L04), and the Hub tool knows the release', () => {
  const allow = readFileSync('sites/gwh/public-allowlist.txt', 'utf8').split(/\r?\n/).map(s => s.trim());
  for (const rel of [...Object.keys(pages), 'retailers/retailers.css', 'retailers/retailers.js', 'hub-retailers.jpg']) assert.ok(allow.includes(rel), rel);
  const tool = readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
  for (const rel of Object.keys(pages)) assert.ok(tool.includes(`'public/${rel}' = `), `report text for ${rel}`);
  assert.ok(tool.includes("href=\"/retailers/\" data-world=\"RETAILERS\"") && tool.includes("'/retailers/'"), 'the live check opens /retailers/');
  assert.match(readFileSync('docs/LESSONS.md', 'utf8'), /\n\| L166 \|/);
  assert.equal(ASSETS.retailersCss.startsWith('/retailers/retailers.css?v='), true);
});
