// Gear World Group company page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkStats, groupPage, legalPage, legalPaths, createGroupWorker } from '../../src/group.js';
import site from '../../sites/group/site.config.js';

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
  assert.match(groupPage(site, stats, 'BR'), /Visiting from Brazil\?<\/strong>\s*48 products from retailers that deliver worldwide\./);
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
