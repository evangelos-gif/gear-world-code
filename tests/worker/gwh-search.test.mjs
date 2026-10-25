// Gear World Hub cross-site search (/api/search in sites/gwh/worker.js): how the Hub asks the 9 sites.
// On Cloudflare a Worker can wait for at most 6 answers at a time; a 7th fetch waits in a queue. The fake fetch below
// follows the same rule, so these tests show what visitors get when slow sites hold the 6 places (lessons L60).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import hub from '../../sites/gwh/worker.js';

const SITES = [
  ['CGW', 'Construction Gear World', 'constructiongearworld.com'], ['MGW', "Men's Gear World", 'mensgearworld.com'],
  ['WGW', "Women's Gear World", 'womensgearworld.com'], ['KGW', "Kids' Gear World", 'kidsgearworld.com'],
  ['HGW', 'Home Gear World', 'homegearworld.com'], ['GGW', 'Garden Gear World', 'gardengearworld.com'],
  ['TGW', 'Technology Gear World', 'technologygearworld.com'], ['AGW', 'Car Gear World', 'cargearworld.com'],
  ['VGW', 'Travel Gear World', 'travelgearworld.com']
];
const OLD_SIX = new Set(SITES.slice(0, 6).map(s => s[2]));

function makeEnv() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE sites (id INTEGER PRIMARY KEY, site_key TEXT, site_name TEXT, domain TEXT, priority INTEGER, is_active INTEGER)');
  const add = sql.prepare('INSERT INTO sites (site_key, site_name, domain, priority, is_active) VALUES (?, ?, ?, ?, 1)');
  SITES.forEach(([k, n, d], i) => add.run(k, n, d, (i + 1) * 10));
  const wrap = (text, args = []) => ({
    bind: (...a) => wrap(text, a),
    first: async () => sql.prepare(text).get(...args) ?? null,
    all: async () => ({ results: sql.prepare(text).all(...args) }),
    run: async () => { sql.prepare(text).run(...args); return { success: true }; }
  });
  return { gear_world_registry: { prepare: (text) => wrap(text) } };
}

const aborted = () => Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });

// The Cloudflare rule: at most 6 requests waiting for an answer, the others queue. "slow" sites never answer by
// themselves (like an old site scanning its whole table for a product it does not have); the Hub's own timer stops them.
function cloudflareLikeFetch(slowHosts) {
  let waiting = 0;
  let most = 0;
  let queued = 0;
  const queue = [];
  const asked = [];
  const take = (signal) => new Promise((resolve, reject) => {
    const start = () => { waiting++; most = Math.max(most, waiting); resolve(); };
    if (waiting < 6) { start(); return; }
    queued++;
    queue.push(start);
    signal.addEventListener('abort', () => {
      const at = queue.indexOf(start);
      if (at >= 0) { queue.splice(at, 1); reject(aborted()); }
    }, { once: true });
  });
  const give = () => { waiting--; const nextUp = queue.shift(); if (nextUp) nextUp(); };
  const fetch = async (url, init) => {
    const host = new URL(url).hostname;
    const signal = init && init.signal;
    asked.push(host);
    await take(signal);
    try {
      // Like a real fetch: a stopped request never answers, also after it left the queue.
      await new Promise((resolve, reject) => {
        if (signal.aborted) { reject(aborted()); return; }
        signal.addEventListener('abort', () => reject(aborted()), { once: true });
        if (!slowHosts.has(host)) setTimeout(resolve, 15);
      });
      const body = { products: [{ id: 7, product_name: `Dash cam from ${host}`, brand: 'Test', retailer: 'Shop', price: 20 }] };
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    } finally {
      give();
    }
  };
  return { fetch, most: () => most, queued: () => queued, asked };
}

async function search(fake, q = 'dash cam') {
  const saved = globalThis.fetch;
  globalThis.fetch = fake.fetch;
  try {
    const response = await hub.fetch(new Request(`https://gearworldhub.com/api/search?q=${encodeURIComponent(q)}`), makeEnv(), {});
    return { status: response.status, data: await response.json() };
  } finally {
    globalThis.fetch = saved;
  }
}

test('search: all 9 sites answer, never more than 6 asked at once, same answer and order as before', async () => {
  const fake = cloudflareLikeFetch(new Set());
  const { status, data } = await search(fake);
  assert.equal(status, 200);
  assert.equal(fake.most() <= 6, true, `at most 6 at once (was ${fake.most()})`);
  assert.equal(fake.queued(), 0, 'no request had to wait in the Cloudflare queue');
  assert.equal(fake.asked.length, 9);
  assert.equal(data.ok, true);
  assert.equal(data.partial, false);
  assert.deepEqual(data.failed_sites, []);
  assert.equal(data.count, 9);
  assert.deepEqual(data.results.map(r => r.site), SITES.map(s => s[0].toLowerCase()), 'results keep the order of the sites');
  assert.deepEqual(Object.keys(data), ['ok', 'query', 'count', 'sites', 'results', 'country_code', 'partial', 'failed_sites']);
});

test('search: when the 6 old sites are slow, the fast sites at the end of the list still answer (L60)', async () => {
  const fake = cloudflareLikeFetch(OLD_SIX);
  const started = Date.now();
  const { status, data } = await search(fake, 'SJCAM dash cam');
  const took = Date.now() - started;
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.partial, true);
  assert.deepEqual(data.failed_sites, ['cgw', 'mgw', 'wgw', 'kgw', 'hgw', 'ggw'], 'only the slow sites are missing');
  assert.deepEqual(data.results.map(r => r.site), ['tgw', 'agw', 'vgw'], 'Technology, Car and Travel answered');
  assert.equal(fake.most() <= 6, true);
  assert.ok(took < 7000, `the whole search stays short (${took} ms)`);
});
