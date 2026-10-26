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
