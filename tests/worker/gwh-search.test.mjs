// Gear World Hub cross-site search (/api/search in sites/gwh/worker.js): how the Hub asks the 9 sites.
// On Cloudflare a Worker can wait for at most 6 answers at a time; a 7th fetch waits in a queue. The fake fetch below
// follows the same rule, so these tests show what visitors get when slow sites hold the 6 places (lessons L74).
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

test('search: when the 6 old sites are slow, the fast sites at the end of the list still answer (L74)', async () => {
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

// Gift finder filters and ranking (GWH-GIFT-FILTERS, GWH-RANKING-V2). A plain fake: each host answers its own products.
function productsFetch(byHost) {
  const asked = [];
  const fetch = async (url) => {
    const u = new URL(url);
    asked.push(u);
    const products = byHost[u.hostname] || [];
    return new Response(JSON.stringify({ products }), { headers: { 'Content-Type': 'application/json' } });
  };
  return { fetch, asked };
}

async function searchWith(fake, query) {
  const saved = globalThis.fetch;
  globalThis.fetch = fake.fetch;
  try {
    const response = await hub.fetch(new Request(`https://gearworldhub.com/api/search?${query}`), makeEnv(), {});
    return { status: response.status, data: await response.json() };
  } finally {
    globalThis.fetch = saved;
  }
}

test('search: worlds= asks only those Gear Worlds, in their usual order', async () => {
  const fake = productsFetch({ 'mensgearworld.com': [{ id: 1, product_name: 'Leather watch', price: 40 }], 'technologygearworld.com': [{ id: 2, product_name: 'Smart watch', price: 45 }] });
  const { status, data } = await searchWith(fake, 'q=watch&worlds=tgw,mgw');
  assert.equal(status, 200);
  assert.deepEqual(fake.asked.map(u => u.hostname), ['mensgearworld.com', 'technologygearworld.com']);
  assert.deepEqual(data.filters.worlds, ['mgw', 'tgw']);
  assert.deepEqual(Object.keys(data.sites), ['mgw', 'tgw']);
  assert.equal(data.count, 2);
});

test('search: bad or unknown worlds are refused, and nothing is asked', async () => {
  for (const q of ['q=watch&worlds=xyz', 'q=watch&worlds=mg1', 'q=watch&worlds=' + 'mgw,'.repeat(12)]) {
    const fake = productsFetch({});
    const { status, data } = await searchWith(fake, q);
    assert.equal(status, 400, q);
    assert.equal(data.ok, false);
    assert.equal(fake.asked.length, 0, `no site asked for ${q}`);
  }
});

test('search: max_price and min_price go to the sites as max/min and the Hub drops anything outside the range', async () => {
  const fake = productsFetch({ 'kidsgearworld.com': [
    { id: 1, product_name: 'Toy car', price: 12 }, { id: 2, product_name: 'Toy kitchen', price: 80 }, { id: 3, product_name: 'Toy without price' }
  ] });
  const { status, data } = await searchWith(fake, 'q=toy&worlds=kgw&max_price=25');
  assert.equal(status, 200);
  assert.equal(fake.asked[0].searchParams.get('max'), '25');
  assert.equal(fake.asked[0].searchParams.get('min'), null);
  assert.deepEqual(data.results.map(r => r.id), [1]);
  assert.equal(data.filters.max_price, 25);
  const high = await searchWith(productsFetch({ 'kidsgearworld.com': [{ id: 2, product_name: 'Toy kitchen', price: 180 }, { id: 1, product_name: 'Toy car', price: 12 }] }), 'q=toy&worlds=kgw&min_price=100');
  assert.deepEqual(high.data.results.map(r => r.id), [2]);
  for (const q of ['q=toy&max_price=abc', 'q=toy&max_price=0', 'q=toy&min_price=60&max_price=50', 'q=toy&max_price=999999']) {
    const r = await searchWith(productsFetch({}), q);
    assert.equal(r.status, 400, q);
  }
});

test('search: without the new parameters nothing extra is sent or returned', async () => {
  const fake = productsFetch({ 'kidsgearworld.com': [{ id: 1, product_name: 'Toy car', price: 12 }] });
  const { data } = await searchWith(fake, 'q=toy');
  assert.equal(fake.asked.length, 9);
  assert.equal(fake.asked.every(u => !u.searchParams.has('max') && !u.searchParams.has('min')), true);
  assert.equal('filters' in data, false);
});

test('search: real cordless drills come before a drill brush set from another world (ranking v2)', async () => {
  const fake = productsFetch({
    'cargearworld.com': [{ id: 1, product_name: 'Oxerbog 15-Piece Cordless Drill Brush Set', price: 19.99 }, { id: 2, product_name: 'Car vacuum', price: 30 }],
    'constructiongearworld.com': [
      { id: 10, product_name: 'Bosch GRD 18V-127 18v Cordless Right Angle Drill', price: 314.95, site_category: 'Power Tools', subcategory: 'Drills' },
      { id: 11, product_name: 'Bosch UNIVERSALHAMMER P4A 18v Cordless SDS Drill', price: 183.95, site_category: 'Power Tools', subcategory: 'Drills' },
      { id: 12, product_name: 'Black and Decker BDCIM18 18v Cordless Impact Driver', price: 65.95, site_category: 'Power Tools' },
      { id: 13, product_name: 'Makita Cordless Drill Driver', price: 99, site_category: 'Power Tools', subcategory: 'Drills' }
    ]
  });
  const { data } = await searchWith(fake, 'q=cordless%20drill');
  const order = data.results.map(r => `${r.site}:${r.id}`);
  assert.equal(order[0], 'cgw:13', 'the exact phrase in a drill comes first');
  assert.ok(order.indexOf('cgw:10') < order.indexOf('agw:1'), 'a drill before the brush set');
  assert.ok(order.indexOf('cgw:11') < order.indexOf('agw:1'), 'a drill before the brush set');
  const brushes = await searchWith(productsFetch({ 'cargearworld.com': [{ id: 1, product_name: 'Drill brush set', price: 9 }, { id: 2, product_name: 'Cordless drill', price: 50 }] }), 'q=drill%20brush');
  assert.equal(brushes.data.results[0].id, 1, 'asking for the accessory finds the accessory first');
});
