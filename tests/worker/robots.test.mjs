// Lessons L105: SERankingBacklinksBot (an SEO crawler) opened about 1,000 product pages an hour on cargearworld.com on
// 6-8 Nov 2026. Every site and the Hub now keep it out of the whole site in robots.txt; every other line stays as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createWorker } from '../../src/engine.js';
import { robotsTxt, BLOCKED_CRAWLERS } from '../../src/seo.js';

const NOT_SHOPS = new Set(['group', 'gwh']);
const codes = readdirSync('sites').filter(c => !NOT_SHOPS.has(c) && existsSync(`sites/${c}/site.config.js`));
const BLOCK = 'User-agent: SERankingBacklinksBot\nDisallow: /\n\n';

// The robots.txt of the sites before L105, line for line.
const before = domain => ['User-agent: *', 'Allow: /', 'Disallow: /out/', 'Disallow: /go/', 'Disallow: /api/', 'Disallow: /search',
  'Disallow: /compare/', 'Disallow: /cart/', 'Disallow: /saved/', '', `Sitemap: https://${domain}/sitemap.xml`, ''].join('\n');

test('the 13 sites: SERankingBacklinksBot may read nothing, everything else exactly as before', async () => {
  assert.equal(codes.length, 13);
  assert.deepEqual(BLOCKED_CRAWLERS, ['SERankingBacklinksBot']);
  for (const c of codes) {
    const s = (await import(`../../sites/${c}/site.config.js`)).default;
    assert.equal(robotsTxt(s), BLOCK + before(s.domain), s.code);
  }
});

test('a site serves it at /robots.txt on its domain; a test address still says Disallow: / for everyone', async () => {
  for (const c of ['agw', 'cgw']) {
    const s = (await import(`../../sites/${c}/site.config.js`)).default;
    const w = createWorker(s);
    const env = { DB: null, CLICK_LOG: 'off' };
    const live = await w.fetch(new Request(`https://${s.domain}/robots.txt`), env, { waitUntil: p => p });
    assert.equal(live.status, 200);
    assert.equal(await live.text(), BLOCK + before(s.domain));
    const preview = await w.fetch(new Request(`https://${c}-preview.example.workers.dev/robots.txt`), env, { waitUntil: p => p });
    assert.equal(await preview.text(), 'User-agent: *\nDisallow: /\n');
  }
});

test('the Hub: the same two lines first, its own lines exactly as before', () => {
  const hub = readFileSync('sites/gwh/public/robots.txt', 'utf8');
  assert.equal(hub, BLOCK + 'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://gearworldhub.com/sitemap.xml\n');
});
