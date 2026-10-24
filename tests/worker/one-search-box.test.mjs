// Lessons L03: every block of a page appears once, the search box too. On 24 Oct 2026 the search results page and
// "Page not found" showed a second search box under the title, besides the one in the header, on every site of the
// engine (mobile and computer). Every page now has the header's search box only, which keeps the words searched for;
// the home page has the big one of its hero instead (the site's CSS hides the header's there).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { categoryPath } from '../../src/lib/text.js';

// Every shop on the engine (the Hub and the Group page have their own code).
const NOT_SHOPS = new Set(['group', 'gwh']);
const codes = readdirSync('sites').filter(c => !NOT_SHOPS.has(c) && existsSync(`sites/${c}/site.config.js`));

function fakeD1(code, site) {
  const sql = new DatabaseSync(':memory:');
  const legacy = site.database && site.database.layout === 'legacy';
  sql.exec(readFileSync(legacy ? 'tests/fixtures/ggw-legacy-schema.sql' : `sites/${code}/migrations/0001_init.sql`, 'utf8'));
  const seed = `tests/fixtures/${code}-seed.sql`;
  if (existsSync(seed)) sql.exec(readFileSync(seed, 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}

const FX_FETCH = async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } });
const searchBoxes = h => [...h.matchAll(/<form class="search ([\w-]*)"/g)].map(m => m[1]);

test('every shop of the engine is checked', () => {
  for (const c of ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw', 'tgw']) assert.ok(codes.includes(c), c);
});

for (const code of codes) {
  test(`${code.toUpperCase()}: one search box on every page (the header's, or the hero's on the home page)`, async () => {
    const site = (await import(`../../sites/${code}/site.config.js`)).default;
    const worker = createWorker(site);
    const env = { DB: fakeD1(code, site), FX_FETCH, CLICK_LOG: 'off' };
    const get = async path => {
      const r = await worker.fetch(new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });
      return { status: r.status, html: await r.text() };
    };

    const home = await get('/');
    assert.equal(home.status, 200);
    assert.deepEqual(searchBoxes(home.html), ['masthead-search', 'hero-search']);
    assert.match(home.html, /<body class="home"/);
    assert.match(readFileSync(`sites/${code}/public/assets/site.css`, 'utf8'), /\.home \.masthead-search\s*\{\s*display:\s*none;?\s*\}/);

    const pages = [['/search?q=drill', 200], ['/search', 200], ['/no-such-page-qa/', 404]];
    // A category page and, from the test products, one product page.
    let product = null;
    for (const c of site.categories) {
      const r = await get(categoryPath(c.slug));
      if (r.status !== 200) continue;
      if (pages.length === 3) pages.push([categoryPath(c.slug), 200]);
      product = product || (/href="(\/product\/[^"]+)"/.exec(r.html) || [])[1];
      if (product) break;
    }
    assert.equal(pages.length, 4, `${code}: a category page`);
    if (existsSync(`tests/fixtures/${code}-seed.sql`)) assert.ok(product, `${code}: a product page`);
    if (product) pages.push([product, 200]);
    for (const [path, status] of pages) {
      const r = await get(path);
      assert.equal(r.status, status, `${code} ${path}`);
      assert.deepEqual(searchBoxes(r.html), ['masthead-search'], `${code} ${path}`);
    }
    // The header's box keeps the words searched for.
    assert.match((await get('/search?q=drill')).html, /<form class="search masthead-search"[\s\S]*?name="q" type="search" value="drill"/);
  });
}
