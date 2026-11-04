// Gear World Hub sitemap (Worker gwh-sitemap, 4/11/2026): the 6 pages of 24/10/2026 stay, and the 6 pages of the gift
// guides come in. before-worker.js is the exact code that ran live before (its sitemap was checked against the live one).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import before from '../../sites/gwh-sitemap/before-worker.js';
import now from '../../sites/gwh-sitemap/worker.js';
import { sitemapBody, sha256 } from '../../tools/gwh-sitemap.mjs';
import { loadData } from '../../tools/gwh-guides.mjs';

const locs = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const OLD = ['/', '/privacy/', '/terms/', '/cookies/', '/contact/', '/affiliate-disclosure/'].map(p => 'https://gearworldhub.com' + p);

test('sitemap: the old version is exactly the one that ran live on 24/10/2026', async () => {
  const body = await sitemapBody('before');
  assert.deepEqual(locs(body), OLD);
  assert.equal(sha256(body), '121319387a663907ebb2d314e89fbadc039643fa1125352cff3bdabd9ea64abf');
});

test('sitemap: the new version keeps the 6 pages and adds /guides/ and every guide of guides.json', async () => {
  const body = await sitemapBody('new');
  const guides = loadData().guides.map(g => `https://gearworldhub.com/guides/${g.slug}/`);
  assert.deepEqual(locs(body), [...OLD, 'https://gearworldhub.com/guides/', ...guides]);
  assert.match(body, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n/);
  assert.ok(body.endsWith('</urlset>\n'));
  assert.equal(new Set(locs(body)).size, locs(body).length, 'no page twice');
  for (const l of locs(body)) assert.ok(!/\/(out|go)\//.test(l));
});

test('sitemap: same answers as before (content type, HEAD without a body, 404 for anything else)', async () => {
  for (const w of [before, now]) {
    const r = await w.fetch(new Request('https://gearworldhub.com/sitemap.xml'));
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/xml; charset=utf-8');
    assert.equal(r.headers.get('cache-control'), 'public, max-age=3600');
    const h = await w.fetch(new Request('https://gearworldhub.com/sitemap.xml', { method: 'HEAD' }));
    assert.equal(await h.text(), '');
    assert.equal((await w.fetch(new Request('https://gearworldhub.com/other'))).status, 404);
  }
});

test('sitemap: gwh-sitemap.toml is the live Worker with its own route, no ids, no workers.dev', () => {
  const toml = readFileSync(new URL('../../sites/gwh-sitemap/gwh-sitemap.toml', import.meta.url), 'utf8');
  assert.match(toml, /^name = "gwh-sitemap"$/m);
  assert.match(toml, /^main = "worker\.js"$/m);
  assert.match(toml, /^compatibility_date = "2026-10-24"$/m);
  assert.match(toml, /^workers_dev = false$/m);
  assert.match(toml, /\{ pattern = "gearworldhub\.com\/sitemap\.xml", zone_name = "gearworldhub\.com" \}/);
  assert.ok(!/[0-9a-f]{32}/.test(toml), 'no Cloudflare ids');
  const ps = readFileSync(new URL('../../tools/gwh-sitemap.ps1', import.meta.url), 'utf8');
  assert.ok(ps.includes("$PreviewName = 'gwh-sitemap-preview'") && ps.includes("$LiveWorker = 'gwh-sitemap'"));
  for (const p of ['ΕΓΚΡΙΝΩ SITEMAP PREVIEW', 'ΕΓΚΡΙΝΩ SITEMAP LIVE', 'ΕΓΚΡΙΝΩ SITEMAP REMOVE PREVIEW']) assert.ok(ps.includes(`'${p}'`), p);
});
