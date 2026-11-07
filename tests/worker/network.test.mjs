// Lessons L99: the "Gear World network" links in the footer come from one shared list (promos/network.js). On 7 Nov 2026
// the live TGW still listed only the Hub and the first 6 sites, because every site had its own list written by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { GEAR_WORLDS, networkFor } from '../../promos/network.js';

const NOT_SHOPS = new Set(['group', 'gwh']);
const codes = readdirSync('sites').filter(c => !NOT_SHOPS.has(c) && existsSync(`sites/${c}/site.config.js`));

test('the shared list has every Gear World site of sites/, with its own name and domain, and nothing else', async () => {
  assert.equal(GEAR_WORLDS.length, codes.length);
  for (const c of codes) {
    const s = (await import(`../../sites/${c}/site.config.js`)).default;
    const w = GEAR_WORLDS.find(x => x.code === s.code);
    assert.ok(w, `${s.code} is missing in promos/network.js`);
    assert.equal(w.name, s.name);
    assert.equal(w.url, `https://${s.domain}/`);
  }
});

test('the order is the order of the Hub home page', () => {
  const hub = readFileSync('sites/gwh/public/index.html', 'utf8');
  const order = [...new Set((hub.match(/https:\/\/[a-z]+gearworld\.com\//g) || []))];
  assert.deepEqual(GEAR_WORLDS.map(w => w.url), order);
});

test('each site lists the 12 others, never itself', async () => {
  for (const c of codes) {
    const s = (await import(`../../sites/${c}/site.config.js`)).default;
    assert.deepEqual(s.network, networkFor(s.code), `${s.code} uses the shared list`);
    assert.equal(s.network.length, GEAR_WORLDS.length - 1);
    assert.ok(!s.network.some(n => n.url === `https://${s.domain}/`), `${s.code} does not link to itself`);
  }
});

// The footer of a real page: the Hub first, then the 12 others, each name kept untranslated.
for (const code of codes) {
  test(`${code.toUpperCase()}: the footer shows the Hub and the 12 other Gear World sites`, async () => {
    const s = (await import(`../../sites/${code}/site.config.js`)).default;
    const sql = new DatabaseSync(':memory:');
    const legacy = s.database && s.database.layout === 'legacy';
    sql.exec(readFileSync(legacy ? 'tests/fixtures/ggw-legacy-schema.sql' : `sites/${code}/migrations/0001_init.sql`, 'utf8'));
    if (existsSync(`tests/fixtures/${code}-seed.sql`)) sql.exec(readFileSync(`tests/fixtures/${code}-seed.sql`, 'utf8'));
    const stmt = (text, args = []) => ({
      bind: (...a) => stmt(text, a),
      all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
      first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
      run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
    });
    const env = { DB: { prepare: t => stmt(t), batch: async l => Promise.all(l.map(x => x.all())) }, CLICK_LOG: 'off',
      FX_FETCH: async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }) };
    const res = await createWorker(s).fetch(new Request(`https://${s.domain}/about/`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } }), env, { waitUntil: p => p });
    const html = await res.text();
    const m = html.match(/<section data-gw-network>\s*<h2>Gear World network<\/h2>[\s\S]*?<\/section>/);
    assert.ok(m, 'the footer network block');
    const links = [...m[0].matchAll(/<a href="([^"]+)" translate="no">([^<]+)<\/a>/g)].map(x => x[1]);
    assert.equal(links[0], s.hub.url, 'the Hub first');
    assert.deepEqual(links.slice(1), GEAR_WORLDS.filter(w => w.code !== s.code).map(w => w.url));
  });
}
