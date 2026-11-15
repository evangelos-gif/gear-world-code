// Gear World Group company page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkStats, groupPage, legalPage, legalPaths, createGroupWorker } from '../../src/group.js';
import site from '../../sites/group/site.config.js';
import { readFileSync } from 'node:fs';

const fakeFetch = answers => async url => {
  const host = new URL(url).hostname;
  const a = answers[host];
  if (a === 'down') throw new Error('down');
  if (!a) return new Response('not found', { status: 404 });
  return Response.json(a);
};

test('product numbers are added up; retailers counted once across sites; a site that is down is left out', async () => {
  const s = await networkStats(site, fakeFetch({
    'technologygearworld.com': { products: 2596, retailer_names: ['Joybuy'] },
    'mensgearworld.com': { products: 31726, retailer_names: ['Joybuy UK', 'Finediam'] },
    'gardengearworld.com': 'down',
    'homegearworld.com': { ok: true }
  }));
  assert.equal(s.products, 2596 + 31726);
  assert.equal(s.retailers, 2, 'Joybuy and Joybuy UK are one retailer');
  assert.equal(s.sitesCounted, 2);
});

test('the page lists every site, the hub, what we do and do not do, and the Awin publisher id', () => {
  const page = groupPage({ ...site, contactEmail: 'partners@example.com' }, { products: 34322, retailers: 12, sitesCounted: 2 });
  for (const s of site.sites) assert.ok(page.includes(s.url), s.name);
  assert.ok(page.includes(site.hub.url));
  assert.match(page, /34,322 products listed/);
  assert.match(page, /No paid search bidding/);
  assert.match(page, /Awin publisher ID<\/dt><dd>3057233/);
  assert.match(page, /mailto:partners@example.com/);
  assert.ok(!/<style|style="|<script/.test(page), 'no inline styles or scripts');
});

test('worker: www goes to the apex, preview hosts are hidden from search engines, robots and sitemap', async () => {
  const w = createGroupWorker({ ...site, sites: [] });
  const www = await w.fetch(new Request('https://www.gearworldgroup.com/'), {}, {});
  assert.equal(www.status, 301);
  const prev = await w.fetch(new Request('https://gear-world-group.example.workers.dev/'), {}, {});
  assert.match(prev.headers.get('x-robots-tag') || '', /noindex/);
  assert.match(prev.headers.get('content-security-policy') || '', /default-src 'self'/);
  const robots = await (await w.fetch(new Request('https://gearworldgroup.com/robots.txt'), {}, {})).text();
  assert.match(robots, /Sitemap: https:\/\/gearworldgroup.com\/sitemap.xml/);
});

// Lessons L17: Privacy, Terms, Cookies and the affiliate disclosure, linked from the footer of every page.
const LEGAL = ['/how-we-make-money/', '/privacy/', '/cookies/', '/terms/'];

test('L17: every page links to the four legal pages in its footer, with the year', () => {
  assert.deepEqual(legalPaths().slice().sort(), LEGAL.slice().sort());
  const pages = [groupPage(site, { products: 0, retailers: 0 }), ...LEGAL.map(p => legalPage(site, p))];
  const year = String(new Date().getUTCFullYear());
  for (const page of pages) {
    const foot = page.slice(page.indexOf('<footer'));
    for (const p of LEGAL) assert.ok(foot.includes(`href="${p}"`), `footer links to ${p}`);
    assert.ok(foot.includes(`&copy; ${year}`), 'year in the footer');
    assert.ok(!/<style|style="|<script/.test(page), 'no inline styles or scripts');
  }
});

test('legal pages: own title and canonical, the site name and contact, no other site\'s name', () => {
  for (const p of LEGAL) {
    const page = legalPage({ ...site, contactEmail: 'partners@example.com' }, p);
    assert.match(page, new RegExp(`<link rel="canonical" href="https://gearworldgroup.com${p}">`));
    assert.match(page, /<h1>[^<]+<\/h1>/);
    assert.ok(page.includes('Gear World Group'), p);
    if (p === '/privacy/' || p === '/terms/') assert.ok(page.includes('mailto:partners@example.com'), `${p}: contact`);
    assert.ok(!/Technology Gear World|Sporty Gear World|Hub/.test(page.slice(page.indexOf('<main'), page.indexOf('</main>'))), `${p}: describes this page only`);
    assert.ok(page.includes('href="/#contact"'), `${p}: Contact goes to the home page`);
  }
  assert.equal(legalPage(site, '/nope/'), null);
});

test('worker: legal pages answer 200 as HTML, the address without the slash goes to the one with it', async () => {
  const w = createGroupWorker({ ...site, sites: [] });
  for (const p of LEGAL) {
    const r = await w.fetch(new Request(`https://gearworldgroup.com${p}`), {}, {});
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get('content-type') || '', /text\/html; charset=utf-8/);
    assert.match(r.headers.get('content-security-policy') || '', /default-src 'self'/);
    const noSlash = await w.fetch(new Request(`https://gearworldgroup.com${p.slice(0, -1)}`), {}, {});
    assert.equal(noSlash.status, 301, `${p} without slash`);
    assert.equal(noSlash.headers.get('location'), `https://gearworldgroup.com${p}`);
  }
  const prev = await w.fetch(new Request('https://gear-world-group.example.workers.dev/privacy/'), {}, {});
  assert.match(prev.headers.get('x-robots-tag') || '', /noindex/);
  const other = await w.fetch(new Request('https://gearworldgroup.com/somewhere'), {}, {});
  assert.equal(other.status, 302, 'other addresses still go to the home page');
});

// ---- Lessons L130: every product, by continent and country, with a page per country and the visitor's own country ----
import { countryPage, countryName, COUNTRY_CODES, CONTINENTS } from '../../src/group.js';

const NEW_STATS = {
  'technologygearworld.com': { products: 100, retailer_names: ['Joybuy', 'PCHUB'], all_products: 100,
    delivery: [{ retailer: 'Joybuy', products: 60, countries: ['GB'] }, { retailer: 'PCHUB', products: 40, countries: ['GB'] }] },
  'cargearworld.com': { products: 500, retailer_names: ['Halfords'], all_products: 1530,
    delivery: [{ retailer: 'Halfords', products: 500, countries: ['GB'] }, { retailer: 'Pneus.be', products: 1000, countries: ['BE'] },
      { retailer: 'VEVOR', products: 30, countries: ['EU', 'IS', 'LI', 'NO'] }] },
  'constructiongearworld.com': { products: 248, retailer_names: ['Toolstation', 'GRABO'], all_products: 268,
    delivery: [{ retailer: 'Toolstation', products: 200, countries: ['GB'] }, { retailer: 'GRABO', products: 48, countries: ['WORLD'] },
      { retailer: 'Reidl', products: 20, countries: ['DE', 'AT'] }] },
  // A site still on the older /api/stats: its UK numbers count for the UK only.
  'petsgearworld.com': { products: 10, retailer_names: ['Omlet', 'Joybuy UK'] }
};

test('L130: all products, the UK view, every country from the retailers\' delivery countries, worldwide retailers everywhere', async () => {
  const s = await networkStats(site, fakeFetch(NEW_STATS));
  assert.equal(s.products, 100 + 1530 + 268 + 10, 'all products');
  assert.equal(s.ukProducts, 100 + 500 + 248 + 10, 'the UK view, as the page said before');
  assert.equal(s.sitesCounted, 4);
  assert.equal(s.retailers, 9, 'Joybuy and Joybuy UK once; every retailer of every country');
  assert.equal(s.countries.GB.products, 60 + 40 + 500 + 200 + 48 + 10);
  assert.equal(s.countries.BE.products, 1000 + 30 + 48, 'Belgium: Pneus.be, VEVOR (EU) and GRABO (worldwide)');
  assert.equal(s.countries.DE.products, 30 + 48 + 20);
  assert.equal(s.countries.DE.retailers, 3);
  assert.equal(s.countries.NO.products, 30 + 48, 'Norway is in VEVOR\'s list');
  assert.equal(s.countries.CH.products, 48, 'Switzerland: only the worldwide retailer');
  assert.equal(s.countries.US.products, 48);
  assert.deepEqual(s.worldwide, { products: 48, retailers: 1 });
  assert.deepEqual(s.countries.BE.sites.map(x => x[0]), ['Car Gear World', 'Construction Gear World'], 'each site\'s share, largest first');
  assert.equal(s.countries.BE.sites[0][2], 1030);
  for (const cc of COUNTRY_CODES) assert.ok(s.countries[cc], cc);
  assert.equal(new Set(COUNTRY_CODES).size, COUNTRY_CODES.length, 'no country twice');
  assert.equal(CONTINENTS.length, 4);
  for (const cc of COUNTRY_CODES) assert.notEqual(countryName(cc), cc, `${cc} has an English name`);
});

test('L130: the home page shows all products and the UK, every country as a link, "More coming", and the visitor\'s country', async () => {
  const stats = await networkStats(site, fakeFetch(NEW_STATS));
  const page = groupPage(site, stats, 'DE');
  assert.match(page, /1,908 products listed/);
  assert.match(page, /858 deliver to the UK/);
  assert.match(page, /<h2 id="countries-h">Where the retailers deliver<\/h2>/);
  for (const [name] of CONTINENTS) assert.ok(page.includes(`<h3 class="continent">${name}</h3>`), name);
  for (const cc of COUNTRY_CODES) assert.ok(page.includes(`href="/countries/${cc.toLowerCase()}/"`), cc);
  assert.match(page, /From Germany\?<\/strong>\s*98 products from 3 retailers deliver to Germany\./);
  assert.match(page, /More retailers coming: approved, products being added\./, 'Germany is in the coming list');
  assert.match(page, /href="\/countries\/de\/">See Germany<\/a>/);
  assert.match(page, /Every other country: 48 products from 1 retailer that delivers worldwide\./);
  assert.ok((page.match(/<span class="tag">More coming<\/span>/g) || []).length === site.coming.length, 'one tag per coming country');
  assert.match(groupPage(site, stats, 'GB'), /858 products from 6 retailers deliver to the United Kingdom\./);
  assert.match(groupPage(site, stats, 'BR'), /Visiting from Brazil\?<\/strong>\s*48 products from a retailer that delivers worldwide\./);
  assert.ok(!/class="yours"/.test(groupPage(site, stats, '')), 'no box without a country');
  assert.ok(!/class="yours"/.test(groupPage(site, stats, 'XX')), 'no box for an unknown country');
  assert.ok(!/<style|style="|<script/.test(page), 'no inline styles or scripts');
  assert.ok(!/\b(shop|shopping|cart|UK retailers|our retailers)\b/i.test(page.slice(page.indexOf('id="countries"'), page.indexOf('aria-labelledby="sites-h"'))), 'content rules');
  for (const c of site.coming) assert.ok(COUNTRY_CODES.includes(c), `coming: ${c} is a listed country`);
});

test('L130: a country page: its numbers, each site, every other country; noindex, follow; not in the sitemap', async () => {
  const stats = await networkStats(site, fakeFetch(NEW_STATS));
  const page = countryPage(site, stats, 'BE');
  assert.match(page, /<h1>Gear World in Belgium<\/h1>/);
  assert.match(page, /1,078 products deliver to Belgium/);
  assert.match(page, /<meta name="robots" content="noindex, follow">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/gearworldgroup.com\/countries\/be\/">/);
  assert.match(page, /<a href="https:\/\/cargearworld.com\/">Car Gear World<\/a><span>1,030 products<\/span>/);
  assert.match(page, /<li class="here"><a href="\/countries\/be\/" aria-current="page">/);
  assert.match(page, /href="\/countries\/us\/"/);
  assert.match(countryPage(site, stats, 'GB'), /<h1>Gear World in the United Kingdom<\/h1>/);
  assert.ok(!/<style|style="|<script/.test(page), 'no inline styles or scripts');
  const foot = page.slice(page.indexOf('<footer'));
  for (const p of LEGAL) assert.ok(foot.includes(`href="${p}"`), `footer links to ${p}`);
});

test('L130 worker: /countries/<cc>/ pages, capital letters and no slash redirect, unknown countries go to the list; the home page is private', async () => {
  const w = createGroupWorker(site);
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch(NEW_STATS);
  try {
    const de = await w.fetch(new Request('https://gearworldgroup.com/countries/de/'), {}, {});
    assert.equal(de.status, 200);
    assert.equal(de.headers.get('x-robots-tag'), 'noindex, follow');
    assert.match(await de.text(), /Gear World in Germany/);
    const caps = await w.fetch(new Request('https://gearworldgroup.com/countries/DE'), {}, {});
    assert.equal(caps.status, 301);
    assert.equal(caps.headers.get('location'), 'https://gearworldgroup.com/countries/de/');
    const zz = await w.fetch(new Request('https://gearworldgroup.com/countries/zz/'), {}, {});
    assert.equal(zz.status, 302);
    assert.equal(zz.headers.get('location'), 'https://gearworldgroup.com/#countries');
    const req = new Request('https://gearworldgroup.com/');
    Object.defineProperty(req, 'cf', { value: { country: 'NL' } });
    const home = await w.fetch(req, {}, {});
    assert.equal(home.headers.get('cache-control'), 'private, max-age=60');
    assert.match(await home.text(), /From the Netherlands\?/);
    const sitemap = await (await w.fetch(new Request('https://gearworldgroup.com/sitemap.xml'), {}, {})).text();
    assert.ok(!/countries/.test(sitemap), 'country pages are not in the sitemap');
  } finally {
    globalThis.fetch = real;
  }
});

test('L130 review: no numbers (every site down) means no countries, no box, no zeros; one retailer still "deliver"; the CSS has no "our retailers"', async () => {
  const empty = await networkStats(site, fakeFetch({}));
  assert.equal(empty.sitesCounted, 0);
  const page = groupPage(site, empty, 'GB');
  assert.ok(!/id="countries"|class="yours"|No retailers yet/.test(page), 'no countries section and no box without numbers');
  const cp = countryPage(site, empty, 'DE');
  assert.match(cp, /The numbers are being updated/);
  assert.ok(!/No retailers deliver here yet|Coming soon/.test(cp), 'no untrue zeros');
  const one = await networkStats(site, fakeFetch({ 'cargearworld.com': { products: 5, retailer_names: ['A'], all_products: 1005,
    delivery: [{ retailer: 'A', products: 5, countries: ['GB'] }, { retailer: 'B', products: 1000, countries: ['AL'] }] } }));
  assert.match(groupPage(site, one, 'AL'), /1,000 products from 1 retailer deliver to Albania\./);
  assert.match(countryPage(site, one, 'GB'), /<title>Gear World in the United Kingdom \| Gear World Group<\/title>/);
  assert.ok(!/class="yours"/.test(groupPage(site, one, 'ZZ')), 'no box for a code without a real name');
  assert.ok(!/our retailers/i.test(readFileSync('sites/group/public/assets/group.css', 'utf8')), 'L103 in the stylesheet too');
});

// ---- Lessons L151 and L152: the open-country rule per country, and the world map ----
import { countryState } from '../../src/group.js';
import { MAP_SIZE, MAP_EUROPE, MAP_SHAPES, MAP_DOTS } from '../../src/group-map.js';
import { OPEN_COUNTRIES } from '../../src/lib/open-countries.js';

test('L151: the products of the biggest retailer per country (one retailer across sites), and each country\'s state in words', async () => {
  const stats = await networkStats(site, fakeFetch(NEW_STATS));
  assert.equal(stats.countries.BE.top, 1000, 'Belgium: Pneus.be');
  assert.equal(stats.countries.DE.top, 48, 'Germany: GRABO, more than VEVOR and Reidl');
  assert.equal(stats.countries.GB.top, 500, 'the UK: Halfords');
  // The same retailer on two sites is one retailer, its products added up.
  const two = await networkStats(site, fakeFetch({
    'technologygearworld.com': { products: 30, retailer_names: ['Joybuy'], all_products: 30, delivery: [{ retailer: 'Joybuy', products: 30, countries: ['GB'] }] },
    'homegearworld.com': { products: 50, retailer_names: ['Joybuy UK', 'Dunelm'], all_products: 50,
      delivery: [{ retailer: 'Joybuy UK', products: 25, countries: ['GB'] }, { retailer: 'Dunelm', products: 25, countries: ['GB'] }] }
  }));
  assert.equal(two.countries.GB.top, 55, 'Joybuy 30 + Joybuy UK 25');
  assert.equal(two.countries.GB.retailers, 2);
  assert.equal(two.countries.FR.top, 0);
  // The states.
  assert.deepEqual(OPEN_COUNTRIES, ['GB', 'PL']);
  assert.equal(countryState(site, stats, 'PL').kind, 'open', 'Poland: opened by the owner ahead of the rule (L157)');
  const gb = countryState(site, stats, 'GB');
  assert.equal(gb.kind, 'open');
  assert.equal(gb.short, 'Open');
  assert.equal(gb.missing, '', 'an open country has nothing missing, even below the numbers (the list decides)');
  const be = countryState(site, stats, 'BE');
  assert.equal(be.kind, 'all');
  assert.equal(be.short, 'Shows all with delivery badge');
  assert.equal(be.missing, 'To open: 28,922 more products, 1 more retailer, one retailer has 93% (max 50%)');
  assert.equal(countryState(site, stats, 'US').kind, 'us');
  assert.equal(countryState(site, stats, 'US').short, 'Own view: what ships to the US');
  assert.equal(countryState(site, stats, 'CH').missing, 'To open: 29,952 more products, 3 more retailers, one retailer has 100% (max 50%)');
  // A country that meets the rule but is not on the list yet: it says so, it does not open by itself.
  const big = { countries: { DE: { products: 40000, retailers: 5, top: 12000 } } };
  assert.equal(countryState(site, big, 'DE').missing, 'Meets the rule: can open in a future update of all the sites');
  assert.equal(countryState(site, big, 'DE').kind, 'all');
  // On the page: every country of the list with its state, the rule in words, the country page too.
  const page = groupPage(site, stats, 'GB');
  // L155 (owner, 14 Nov 2026): the rule stays in countryState (the Manager's morning check), never on the public page,
  // where "To open: ..." read as "closed". One true line for every country instead.
  assert.match(page, /<p class="rule">New retailers are added every week\.<\/p>/);
  assert.ok(!/To open|Shows all with delivery badge|cstate|cmiss|A country opens|>Open</.test(page), 'no open-country wording on the page');
  assert.match(page, /<span class="cn">Belgium<\/span>\s*<span class="cnum">1,078 products deliver here<\/span>\s*<span class="cnum">3 retailers<\/span>\s*<span class="tag">More coming<\/span>/);
  const bePage = countryPage(site, stats, 'BE');
  assert.match(bePage, /<p class="lede">Every product shows where its retailer delivers\. New retailers are added every week\.<\/p>/);
  assert.ok(!/To open|Shows all|A country opens|Open:/.test(bePage + countryPage(site, stats, 'GB')), 'L155: no open-country wording on a country page');
  // The Group's own numbers come from the sites every hour: a new key for the cached numbers with "top".
  assert.match(readFileSync('src/group.js', 'utf8'), /__stats-cache-3/);
});

test('L152: the world map and the close-up of Europe: shapes from the repo, blue by products, orange "coming", a link per listed country, all in words', async () => {
  // The drawing: every listed country has a shape or a dot, nothing but path letters and numbers, small enough.
  const codes = new Set([...MAP_SHAPES.map(s => s[0]), ...MAP_DOTS.map(d => d[0])]);
  for (const cc of COUNTRY_CODES) assert.ok(codes.has(cc), `${cc} on the map`);
  for (const [cc, d, eu] of MAP_SHAPES) {
    assert.match(cc, /^([A-Z]{2})?$/);
    assert.match(d, /^(M-?\d+,-?\d+l[-\d, ]+z)+$/, `${cc}: a plain path`);
    assert.ok(eu === 0 || eu === 1);
  }
  assert.ok(!MAP_SHAPES.some(s => s[0] === 'AQ'), 'no Antarctica');
  assert.ok(readFileSync('src/group-map.js', 'utf8').length < 60000, 'the drawing stays light');
  assert.deepEqual(MAP_SIZE.length, 2);
  assert.equal(MAP_EUROPE.length, 4);
  for (const cc of ['GB', 'DE', 'BE', 'IS', 'CY', 'NO', 'PT']) assert.ok(MAP_SHAPES.some(s => s[0] === cc && s[2] === 1) || MAP_DOTS.some(d => d[0] === cc), `${cc} on the close-up`);
  assert.ok(!MAP_SHAPES.some(s => s[0] === 'US' && s[2] === 1), 'not the US');
  const stats = await networkStats(site, fakeFetch(NEW_STATS));
  const page = groupPage(site, stats, 'GB');
  const map = page.slice(page.indexOf('<figure class="gmap">'), page.indexOf('</figure>'));
  assert.ok(map && page.indexOf('<figure class="gmap">') < page.indexOf('<h3 class="continent">'), 'above the list');
  assert.equal((map.match(/<svg class="gmap-svg[^"]*" viewBox="[\d ]+" aria-hidden="true" focusable="false">/g) || []).length, 2, 'the world and Europe');
  assert.ok(!/<script|style=|https?:\/\/|<image|<use/.test(map), 'no script, no style attribute, no file from anywhere (CSP)');
  for (const cc of COUNTRY_CODES) assert.ok(map.includes(`<a href="/countries/${cc.toLowerCase()}/" tabindex="-1"><title>${countryName(cc)}: `), `${cc}: a link with its words`);
  // Words for each colour, and the colour from the numbers: the UK 858 (m1), Belgium 1,078 (m2), and every other country
  // the worldwide retailer (48 products, m1); orange around the coming countries.
  for (const words of ['30,000 products or more', '10,000 to 29,999 products', '1,000 to 9,999 products', 'Fewer than 1,000 products', 'No products yet',
    'Coming: retailers approved, products being added']) assert.ok(map.includes(`</span>${words}</li>`), words);
  assert.match(map, /<a href="\/countries\/be\/" tabindex="-1"><title>Belgium: 1,078 products from 3 retailers\. More retailers coming: approved, products being added\.<\/title><path class="m2 mp mc" d="/);
  assert.match(map, /<a href="\/countries\/gb\/" tabindex="-1"><title>United Kingdom: 858 products from 6 retailers\.<\/title><path class="m1 mp" d="/);
  assert.ok(!/Open:|To open|Shows all/.test(map), 'L155: the map titles do not say open or closed');
  assert.match(map, /<path class="m1" d="[^"]+"><title>Brazil: every other country, 48 products from a retailer that delivers worldwide\.<\/title><\/path>/);
  const big = { ...stats, countries: { ...stats.countries, GB: { ...stats.countries.GB, products: 30000 }, DE: { ...stats.countries.DE, products: 12000 }, FR: { ...stats.countries.FR, products: 0, retailers: 0 } }, worldwide: { products: 0, retailers: 0 } };
  const bigMap = groupPage(site, big, 'GB');
  assert.match(bigMap, /<title>United Kingdom: 30,000 products[^<]*<\/title><path class="m4 mp"/);
  assert.match(bigMap, /<title>Germany: 12,000 products[^<]*<\/title><path class="m3 mp mc"/);
  assert.match(bigMap, /<title>France: no products yet\.[^<]*<\/title><path class="m0 mp mc"/);
  assert.match(bigMap, /<path class="m0" d="[^"]+"><title>Brazil: no products yet\.<\/title>/);
  for (const cc of site.coming) assert.match(map, new RegExp(`<a href="/countries/${cc.toLowerCase()}/" tabindex="-1"><title>[^<]+</title><(path|circle) class="m\\d mp mc"`), `${cc}: orange`);
  // Colours: blue, orange and grey only (the owner's colour vision), each colour of the map also a legend swatch.
  const css = readFileSync('sites/group/public/assets/group.css', 'utf8');
  const block = css.slice(css.indexOf('/* The open-country rule'));
  const hue = hex => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d < 0.12) return 'grey';
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  for (const hex of block.match(/#[0-9a-fA-F]{6}\b/g)) {
    const h = hue(hex);
    assert.ok(h === 'grey' || (h >= 195 && h <= 225) || (h >= 20 && h <= 40), `${hex}: blue, orange or grey (${h})`);
  }
  for (const c of ['m0', 'm1', 'm2', 'm3', 'm4']) {
    const fill = (block.match(new RegExp(`\\.gmap-svg \\.${c} \\{ fill: (#[0-9a-f]{6}); \\}`)) || [])[1];
    assert.ok(fill && block.includes(`.sw.${c} { background: ${fill};`), `${c}: the same colour on the map and in the legend`);
  }
  assert.match(block, /vector-effect: non-scaling-stroke/);
  // Grey and the blues apart by lightness too, not only by colour (the owner's colour vision; review of 14 Nov 2026):
  // a contrast of at least 1.5 between each step, grey < the first blue < ... < the last.
  const lum = hex => {
    const f = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = [1, 3, 5].map(i => f(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const fills = ['m0', 'm1', 'm2', 'm3', 'm4'].map(c => block.match(new RegExp(`\\.gmap-svg \\.${c} \\{ fill: (#[0-9a-f]{6}); \\}`))[1]);
  for (let i = 1; i < fills.length; i++) assert.ok((lum(fills[i]) + 0.05) / (lum(fills[i - 1]) + 0.05) >= 1.5, `${fills[i - 1]} -> ${fills[i]}: lighter by 1.5 or more`);
  // Orange wins over the grey outline of a coming country with no products yet.
  assert.ok(block.indexOf('.gmap-svg path.mc, .gmap-svg circle.mc {') > block.indexOf('.gmap-svg path.m0, .gmap-svg circle.m0 {'));
  assert.notEqual(site.assetVersion, '2026-11-14-group-9', 'a new asset version for the new CSS');
});
