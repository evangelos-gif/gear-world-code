// Gear World Group company page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkStats, groupPage, createGroupWorker } from '../../src/group.js';
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
