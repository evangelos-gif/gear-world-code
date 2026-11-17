// Gear World Hub cross-site search (/api/search in sites/gwh/worker.js): how the Hub asks the 9 sites.
// On Cloudflare a Worker can wait for at most 6 answers at a time; a 7th fetch waits in a queue. The fake fetch below
// follows the same rule, so these tests show what visitors get when slow sites hold the 6 places (lessons L74).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import hub, { countryLanguage, COUNTRY_LANGUAGES, MULTI_LANGUAGE_COUNTRIES, HUB_LOCALES, rankHubResults, rankStem, rankTokens } from '../../sites/gwh/worker.js';

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

// Lessons L107 (checker of 9 Nov 2026, items 6, 7, 8 and 15).
async function askAs(country, ua = 'Mozilla/5.0 test') {
  const fake = productsFetch({});
  const saved = globalThis.fetch;
  globalThis.fetch = fake.fetch;
  try {
    const req = new Request('https://gearworldhub.com/api/search?q=watch', { headers: { 'User-Agent': ua } });
    if (country !== undefined) Object.defineProperty(req, 'cf', { value: { country } });
    const response = await hub.fetch(req, makeEnv(), {});
    return { response, asked: fake.asked };
  } finally {
    globalThis.fetch = saved;
  }
}

test('search: every site gets the visitor\'s country; unknown and Google\'s crawlers count as GB; the answer is private', async () => {
  for (const [cc, want] of [['BE', 'BE'], ['US', 'US'], [undefined, 'GB'], ['XX', 'GB'], ['T1', 'GB']]) {
    const { response, asked } = await askAs(cc);
    assert.ok(asked.length > 0 && asked.every(u => u.searchParams.get('deliver_to') === want), `${cc}: deliver_to=${want}`);
    assert.equal(response.headers.get('Cache-Control'), 'private, max-age=60', 'the results depend on the country: no shared cache');
  }
  const bot = await askAs('BE', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
  assert.ok(bot.asked.every(u => u.searchParams.get('deliver_to') === 'GB'), 'a crawler gets the UK view');
});

test('home page: the bar "We\'re adding retailers for your country" outside the UK only, added per answer', async () => {
  const page = '<!doctype html><html><body class="gwh2"><header class="site-header"><nav>menu</nav></header><main>search</main></body></html>';
  const env = { ...makeEnv(), ASSETS: { fetch: async () => new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: '"x"' } }) } };
  const home = async (country, ua = 'Mozilla/5.0 test', path = '/') => {
    const req = new Request(`https://gearworldhub.com${path}`, { headers: { 'User-Agent': ua } });
    if (country !== undefined) Object.defineProperty(req, 'cf', { value: { country } });
    return hub.fetch(req, env, { waitUntil: p => p });
  };
  const gb = await home('GB');
  const gbHtml = await gb.text();
  assert.equal(gbHtml.includes('gwh2-country-bar'), false, 'never for the UK');
  assert.equal(gb.headers.get('ETag'), '"x"');
  for (const cc of ['US', 'BE', undefined]) {
    const r = await home(cc);
    const html = await r.text();
    assert.ok(html.includes('<div class="gwh2-country-bar" role="note"><p class="container" data-gwh2="countryBar">We&#39;re adding retailers for your country. Most retailers below deliver to the UK only. Check delivery before you buy.</p></div><header class="site-header">'), `${cc}: the bar above the header`);
    assert.equal(html.replace(/<div class="gwh2-country-bar"[\s\S]*?<\/div>/, ''), gbHtml, 'the same page plus the bar');
    // The live check of tools/gwh-hub-v2.ps1 takes the bar out before it compares the page (a PC outside the UK).
    const ps1 = (await import('node:fs')).readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
    assert.equal(html.replace(new RegExp(ps1.match(/\$clean = \[regex\]::Replace\(\$clean, '([^']+)', ''\)/)[1]), ''), gbHtml);
    assert.equal(r.headers.get('Cache-Control'), 'private, max-age=60');
  }
  assert.equal((await (await home('US', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).text()).includes('gwh2-country-bar'), false, 'not for a crawler');
  assert.equal((await (await home('US', 'Mozilla/5.0 test', '/about/')).text()).includes('gwh2-country-bar'), false, 'only the home page, where the search results are');
  // The text in the 11 languages of the Hub.
  const js = (await import('node:fs')).readFileSync('sites/gwh/public/hub-v2.js', 'utf8');
  const line = js.match(/\n    countryBar: (\[[^\n]*\]),\n/);
  assert.ok(line, 'countryBar in hub-v2.js');
  const list = JSON.parse(line[1]);
  assert.equal(list.length, 11);
  assert.equal(list[0], "We're adding retailers for your country. Most retailers below deliver to the UK only. Check delivery before you buy.");
  const css = js && (await import('node:fs')).readFileSync('sites/gwh/public/hub-v2.css', 'utf8');
  assert.match(css, /\.gwh2-country-bar\{background:var\(--card\);color:var\(--text\);border-bottom:3px solid var\(--accent\)\}/);
});

// Lessons L150 (owner, 14 Nov 2026): the Impact tag, exactly as Impact gives it, after the Mitgo tag; both from secrets.
test('home page: the Impact tag after the Mitgo tag, exactly as Impact gives it, only with its secret (L150)', async () => {
  const mitgo = ['a1b2c3d4', 'e5f6', 'a7b8', 'c9d0', 'e1f2a3b4c5d6'].join('-');
  const impact = ['0a1b2c3d', '4e5f', '6a7b', '8c9d', '0e1f2a3b4c5d'].join('-');
  const page = '<!doctype html><html><head><meta charset="utf-8"><title>Hub</title></head><body class="gwh2"><header class="site-header"><nav>menu</nav></header><main>search</main></body></html>';
  const assets = { fetch: async () => new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"x"' } }) };
  const ask = async (env, path = '/', country = 'GB') => {
    const req = new Request(`https://gearworldhub.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' } });
    Object.defineProperty(req, 'cf', { value: { country } });
    return (await hub.fetch(req, { ...makeEnv(), ASSETS: assets, ...env }, { waitUntil: p => p })).text();
  };
  const both = await ask({ MITGO_VERIFICATION: mitgo, IMPACT_VERIFICATION: ' ' + impact.toUpperCase() });
  assert.ok(both.includes(`<meta name="mitgo-verification" content="${mitgo}"><meta name='impact-site-verification' value='${impact}'></head>`), 'Mitgo, then Impact, right before </head>');
  assert.equal(both.split('impact-site-verification').length, 2, 'once');
  const only = await ask({ IMPACT_VERIFICATION: impact });
  assert.ok(only.includes(`<meta name='impact-site-verification' value='${impact}'></head>`) && !only.includes('mitgo'), 'Impact alone');
  for (const bad of ['', 'x', impact + "'><script>alert(1)</script>", impact.replace(/-/g, '')]) {
    assert.equal((await ask({ IMPACT_VERIFICATION: bad })).includes('impact-site-verification'), false, `not a code: ${bad.slice(0, 20)}`);
  }
  assert.equal((await ask({ IMPACT_VERIFICATION: impact }, '/about/')).includes('impact-site-verification'), false, 'only the home page');
  // The live checks of the 5 tools take all of it out (with the country bar outside the UK) and find the file again.
  const fs = await import('node:fs');
  const us = await ask({ MITGO_VERIFICATION: mitgo, IMPACT_VERIFICATION: impact }, '/', 'US');
  const plain = await ask({});
  for (const tool of ['gwh-hub-v2.ps1', 'gwh-mailerlite.ps1', 'gwh-photo.ps1', 'gwh-search-labels.ps1', 'poster-setup.ps1']) {
    const ps1 = fs.readFileSync(`tools/${tool}`, 'utf8');
    const rules = [...ps1.matchAll(/\$clean = \[regex\]::Replace\(\$clean, (?:'([^']+)'|"([^"]+)"), ''\)/g)].map(m => new RegExp(m[1] || m[2], 'g'));
    assert.equal(rules.reduce((s, rx) => s.replace(rx, ''), us), plain, `${tool}: the US page without the bar and both tags is the file`);
  }
});

// Lessons L119 (owner, 13 Nov 2026): the Mitgo verification tag. The code is a Worker secret, never in the repo, so the
// test builds a code of the same form at run time (the test runner refuses UUIDs written in files).
test('home page: the Mitgo tag in the <head> only with its secret, only on the home page, the same page plus the tag', async () => {
  const code = ['a1b2c3d4', 'e5f6', 'a7b8', 'c9d0', 'e1f2a3b4c5d6'].join('-');
  const tag = `<meta name="mitgo-verification" content="${code}">`;
  const page = '<!doctype html><html><head><meta charset="utf-8"><title>Hub</title></head><body class="gwh2"><header class="site-header"><nav>menu</nav></header><main>search</main></body></html>';
  const assets = { fetch: async () => new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: '"x"' } }) };
  const ask = async (secret, path = '/', country = 'GB', method = 'GET') => {
    const env = { ...makeEnv(), ASSETS: assets };
    if (secret !== undefined) env.MITGO_VERIFICATION = secret;
    const req = new Request(`https://gearworldhub.com${path}`, { method, headers: { 'User-Agent': 'Mozilla/5.0 test' } });
    Object.defineProperty(req, 'cf', { value: { country } });
    return hub.fetch(req, env, { waitUntil: p => p });
  };
  const plain = await ask(undefined);
  const plainHtml = await plain.text();
  assert.equal(plainHtml.includes('mitgo-verification'), false, 'no secret: no tag');
  assert.equal(plain.headers.get('ETag'), '"x"', 'no secret: the page is the file, untouched');
  for (const path of ['/', '/index.html']) {
    const r = await ask(code, path);
    const html = await r.text();
    assert.ok(html.includes(tag + '</head>'), `${path}: the tag at the end of the <head>`);
    assert.equal(html.split('mitgo-verification').length, 2, `${path}: once`);
    assert.equal(html.replace(tag, ''), plainHtml, `${path}: the same page plus the tag`);
    assert.equal(r.headers.get('ETag'), null, 'another body than the file: no ETag of the file');
  }
  // Upper case or spaces from a paste are fine; anything else is never written into the page.
  assert.ok((await (await ask(' ' + code.toUpperCase() + ' ')).text()).includes(tag));
  for (const bad of ['', 'x', code + '"><script>alert(1)</script>', code.slice(0, -1), code.replace(/-/g, '')]) {
    assert.equal((await (await ask(bad)).text()), plainHtml, `not a code: ${JSON.stringify(bad).slice(0, 30)}`);
  }
  assert.equal((await (await ask(code, '/about/')).text()).includes('mitgo-verification'), false, 'only the home page');
  assert.equal((await (await ask(code, '/', 'GB', 'HEAD')).text()).includes('mitgo-verification'), false, 'GET only');
  // Outside the UK both are added: the country bar above the header and the tag in the <head>.
  const us = await (await ask(code, '/', 'US')).text();
  assert.ok(us.includes(tag + '</head>') && us.includes('<div class="gwh2-country-bar"'));
  // The live checks of the tools take both out before they compare the page with the file (L107, L119).
  const fs = await import('node:fs');
  for (const tool of ['gwh-hub-v2.ps1', 'gwh-mailerlite.ps1', 'gwh-photo.ps1', 'gwh-search-labels.ps1', 'poster-setup.ps1']) {
    const ps1 = fs.readFileSync(`tools/${tool}`, 'utf8');
    const rules = [...ps1.matchAll(/\$clean = \[regex\]::Replace\(\$clean, (?:'([^']+)'|"([^"]+)"), ''\)/g)].map(m => new RegExp(m[1] || m[2], 'g'));
    assert.equal(rules.length, 4, `${tool}: the country bar, the Mitgo tag, the Impact tag (L150) and the country language (L175) are taken out`);
    assert.equal(rules.reduce((s, rx) => s.replace(rx, ''), us), plainHtml, `${tool}: the US page without them is the file`);
  }
});

// Lessons L153 (14 Nov 2026): every card of the Hub says where its retailer delivers. The Hub asks each site with
// badges=1 (since L151 a country that is not open sees all the products there) and passes on delivers_to, cleaned.
test('L153: the Hub asks with badges=1 and passes on where each retailer delivers; the three card renderers show it', async () => {
  const { deliveryCodes } = await import('../../sites/gwh/worker.js');
  const { readFileSync } = await import('node:fs');
  const fake = productsFetch({
    'constructiongearworld.com': [{ id: 1, product_name: 'Cordless drill', retailer: 'Tooled Up', price: 50, delivers_to: ['GB'] },
      { id: 2, product_name: 'Cordless drill set', retailer: 'GRABO', price: 60, delivers_to: ['WORLD', 'GB'] }],
    'cargearworld.com': [{ id: 3, product_name: 'Cordless drill pump', retailer: 'VEVOR', price: 70, delivers_to: ['EU', 'is', 'LI', 'NO', '<b>', 7] },
      { id: 4, product_name: 'Cordless drill old', retailer: 'Old site', price: 80 }]
  });
  const { data } = await searchWith(fake, 'q=cordless%20drill');
  assert.ok(fake.asked.length > 0 && fake.asked.every(u => u.searchParams.get('badges') === '1'), 'every site is asked with badges=1');
  const by = Object.fromEntries(data.results.map(r => [r.id, r.delivers_to]));
  assert.deepEqual(by[1], ['GB']);
  assert.deepEqual(by[2], ['WORLD'], 'worldwide says it all');
  assert.deepEqual(by[3], ['EU', 'IS', 'LI', 'NO'], 'codes cleaned, anything else dropped');
  assert.deepEqual(by[4], [], 'a site of before L151 says nothing: no line on the card');
  assert.deepEqual(deliveryCodes(Array.from({ length: 60 }, (_, i) => String.fromCharCode(65 + (i % 26)) + String.fromCharCode(65 + Math.floor(i / 26)))).length, 40);
  // The cards: the search (app.js), the gift finder (hub-v2.js) and the photo search (gear-world-camera.js) all add the
  // line from translations.js, which keeps the retailer name untranslated and has the words in the 11 languages.
  const pub = f => readFileSync(`sites/gwh/public/${f}`, 'utf8');
  assert.match(pub('app.js'), /\$\{window\.GWH_deliveryHtml \? window\.GWH_deliveryHtml\(product\) : ""\}/);
  assert.match(pub('hub-v2.js'), /<div class="gwh-search-meta">\$\{meta\}<\/div>\$\{window\.GWH_deliveryHtml \? window\.GWH_deliveryHtml\(p\) : ""\}/);
  assert.match(pub('gear-world-camera.js'), /<div class="gwh-search-meta">\$\{meta\}<\/div>\$\{window\.GWH_deliveryHtml \? window\.GWH_deliveryHtml\(product\) : ""\}/);
  const tr = pub('translations.js');
  assert.match(tr, /window\.GWH_deliveryHtml = deliveryHtml;/);
  for (const key of ['deliversTo', 'worldwide']) {
    const m = tr.match(new RegExp(`\\n    ${key}: (\\[[^\\n]+\\]),\\n`));
    assert.ok(m, key);
    const list = JSON.parse(m[1]);
    assert.equal(list.length, 11, `${key}: 11 languages`);
    if (key === 'deliversTo') assert.ok(list.every(s => s.includes('{retailer}')), 'every language names the retailer');
  }
  // The helper itself, in a page-like sandbox: the retailer untranslated and escaped, 3 names then +n, worldwide.
  const { runInNewContext } = await import('node:vm');
  const store = new Map();
  const win = { addEventListener() {}, dispatchEvent() {} };
  const ctx = { window: win, localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) },
    document: { documentElement: {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {}, readyState: 'complete' },
    CustomEvent: class { constructor(n, o) { this.type = n; this.detail = o && o.detail; } }, Intl, setTimeout };
  runInNewContext(tr, ctx);
  const line = win.GWH_deliveryHtml({ retailer: 'Tooled <Up>', delivers_to: ['GB', 'IE', 'FR', 'DE'] });
  assert.match(line, /^<div class="gwh-search-ship" data-ship="GB IE FR DE"><span translate="no">Tooled &lt;Up&gt;<\/span> delivers to: United Kingdom, Ireland, France \+1<\/div>$/);
  assert.match(win.GWH_deliveryHtml({ retailer: 'GRABO', delivers_to: ['WORLD'] }), /delivers to: Worldwide<\/div>$/);
  assert.equal(win.GWH_deliveryHtml({ retailer: 'Old', delivers_to: [] }), '');
  assert.equal(win.GWH_deliveryHtml({ retailer: '', delivers_to: ['GB'] }), '');
});

// Lessons L175 (owner, 17 Nov 2026: "every country opens in its own language"): the home page names the language of the
// visitor's country on <html>; translations.js uses it only without a choice of the visitor's own, and never saves it.
test('home page and /about/: the language of the visitor\'s country on <html>, added per answer; English and crawlers unchanged (L175)', async () => {
  for (const [cc, code] of Object.entries(COUNTRY_LANGUAGES)) assert.equal(countryLanguage(cc), HUB_LOCALES.includes(code) ? code : '', cc);
  assert.equal(countryLanguage('PL'), '', 'no Polish on the Hub (the sites have it)');
  assert.equal(countryLanguage('GR'), 'el-GR');
  assert.equal(countryLanguage('cy'), 'el-GR');
  assert.equal(countryLanguage('BR'), 'pt-PT');
  for (const cc of ['GB', 'IE', 'US', 'UA', 'TR', 'SE', '', null, undefined]) assert.equal(countryLanguage(cc), '', String(cc));
  assert.deepEqual(Object.keys(MULTI_LANGUAGE_COUNTRIES).sort(), ['BE', 'CH', 'LU']);
  assert.equal(countryLanguage('BE', 'fr-BE,fr;q=0.9'), 'fr-FR');
  assert.equal(countryLanguage('BE', 'en-GB,nl;q=0.5'), '');
  assert.equal(countryLanguage('CH', 'it-CH'), 'it-IT');
  assert.equal(countryLanguage('LU', 'lb,de;q=0.7'), 'de-DE');
  assert.equal(countryLanguage('BE', ''), '');

  const page = '<!doctype html><html lang="en-GB"><body class="gwh2"><header class="site-header"><nav>menu</nav></header><main>search</main></body></html>';
  const env = { ...makeEnv(), ASSETS: { fetch: async () => new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: '"x"' } }) } };
  const home = async (country, headers = {}, path = '/') => {
    const req = new Request(`https://gearworldhub.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test', ...headers } });
    if (country !== undefined) Object.defineProperty(req, 'cf', { value: { country } });
    return hub.fetch(req, env, { waitUntil: p => p });
  };
  const gr = await home('GR');
  const grHtml = await gr.text();
  assert.match(grHtml, /<html data-country-lang="el-GR" lang="en-GB">/);
  assert.equal(gr.headers.get('Cache-Control'), 'private, max-age=60');
  // The live check of tools/gwh-hub-v2.ps1 takes the mark out (with the bar) before it compares the page.
  const ps1 = (await import('node:fs')).readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
  const strip = ps1.match(/\$clean = \[regex\]::Replace\(\$clean, ' data-country-lang="([^']+)"', ''\)/);
  assert.ok(strip, 'the live check knows the mark');
  const gbHtml = await (await home('GB')).text();
  const cleaned = grHtml.replace(new RegExp(' data-country-lang="' + strip[1] + '"'), '').replace(/<div class="gwh2-country-bar"[\s\S]*?<\/div>/, '');
  assert.equal(cleaned, gbHtml);
  assert.ok(!gbHtml.includes('data-country-lang'), 'never for the UK');
  assert.match(await (await home('BE', { 'Accept-Language': 'nl-BE' })).text(), /data-country-lang="nl-NL"/);
  assert.ok(!(await (await home('PL')).text()).includes('data-country-lang'), 'Poland: no Polish on the Hub');
  assert.ok(!(await (await home('GR', { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })).text()).includes('data-country-lang'), 'Google reads English');
  assert.match(await (await home('GR', {}, '/about/')).text(), /data-country-lang="el-GR"/, '/about/ too, which reviewers read');
  assert.ok(!(await (await home('GR', {}, '/stores/')).text()).includes('data-country-lang'), 'not the English-only pages');
  for (const path of ['/privacy/', '/cookies/', '/terms/', '/affiliate-disclosure/', '/contact/'])
    assert.match(await (await home('GR', {}, path)).text(), /data-country-lang="el-GR"/, `${path}: translated by legal.js (L176)`);
  assert.ok(!(await (await home('GR', {}, '/guides/')).text()).includes('data-country-lang'), 'the guides stay English');
  assert.ok(!(await (await home('GR', { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13; CUBOT X20 PRO) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' })).text()).includes('data-country-lang') === false, 'a Cubot phone is a person');
  for (const ua of ['Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'facebookexternalhit/1.1'])
    assert.ok(!(await (await home('RU', { 'User-Agent': ua })).text()).includes('data-country-lang'), `no crawler: ${ua}`);

  // translations.js: the visitor's own choice first, then the country, then English; the country is never saved.
  const js = (await import('node:fs')).readFileSync('sites/gwh/public/translations.js', 'utf8');
  assert.match(js, /let chosenLocale = LOCALES\.includes\(currentLocale\) && \(currentLocale !== "en-GB" \|\| chosenMark\);/, 'English saved before L175 is not a choice');
  assert.match(js, /localStorage\.setItem\("gwh-language-chosen", "1"\)/, 'the menu marks a choice');
  assert.match(js, /const byCountry = root && root\.getAttribute \? root\.getAttribute\("data-country-lang"\) : "";/);
  assert.match(js, /if \(save\) \{ try \{ localStorage\.setItem\("gwh-language", locale\); \}/);
  assert.match(js, /applyLanguage\(currentLocale, chosenLocale\);\n\}\)\(\);/);
  assert.match(js, /applyLanguage\(event\.target\.value\);/, 'a choice in the menu is saved');
  const about = (await import('node:fs')).readFileSync('sites/gwh/public/about/about.js', 'utf8');
  assert.match(about, /document\.documentElement\.getAttribute\("data-country-lang"\)/, '/about/ follows the same order');
  assert.match(about, /lang === "en-GB" && !chosen/);
  assert.deepEqual(HUB_LOCALES, JSON.parse(js.match(/const LOCALES = (\[[^\]]+\])/)[1].replace(/\s+/g, '')), 'the same 11 languages as translations.js');
});

// GWH-RANKING-V3 (lessons L177, 17/11/2026): what the product IS (its subcategory, category or the retailer's path)
// counts first, then the name as whole words. The cases are the ones Evangelos and the check of 17/11 found on the live
// Hub (UK view): tablet stands and hi-vis vests before tablets, cufflinks before laptops and headphones, a Kettler bag
// before kettles, trousers in drill cotton before drills, a BBQ sweatshirt before BBQs.
test('search: ranking v3, the product the search names comes before look-alikes and accessories (L177)', async () => {
  const fake = productsFetch({
    'constructiongearworld.com': [
      { id: 1, product_name: 'Sealey Laptop and Tablet Stand Black', site_category: 'Site Equipment', subcategory: 'Site Equipment' },
      { id: 2, product_name: 'Portwest Hi-Vis Tablet Pocket Executive Vest', site_category: 'Workwear', subcategory: 'Hi-Vis' }
    ],
    'homegearworld.com': [{ id: 3, product_name: 'Small Tabletop Water Fountain', site_category: 'Home Decor', subcategory: 'Fountains' }],
    'technologygearworld.com': [
      { id: 4, product_name: 'Lenovo Tab K12 Mediatek 256 GB', site_category: 'Laptops & Computing', subcategory: 'Tablets' },
      { id: 5, product_name: 'Targus tablet case 29.2 cm', site_category: 'Accessories & Storage', subcategory: 'Computers' },
      { id: 6, product_name: 'Apple iPad Air M4 128 GB', site_category: 'Laptops & Computing', subcategory: 'Tablets' }
    ]
  });
  const { data } = await searchWith(fake, 'q=tablet&country=GB');
  const order = data.results.map(r => `${r.site}:${r.id}`);
  assert.deepEqual(order.slice(0, 2).sort(), ['tgw:4', 'tgw:6'], order.join(' '));
  for (const other of ['cgw:1', 'cgw:2', 'hgw:3', 'tgw:5']) assert.ok(order.indexOf(other) > 1, `${other} after the tablets`);
  assert.ok(!order.slice(0, 2).includes('hgw:3'), 'Tabletop is not tablet');
});

test('search: ranking v3, cufflinks, a Kettler bag, drill cotton and a BBQ sweatshirt go below the real thing (L177)', () => {
  const rank = (q, list) => rankHubResults(list.map((p, i) => ({ id: i, ...p })), q).map(p => p.product_name);
  let o = rank('laptop', [
    { site: 'mgw', product_name: 'Laptop Computer Cufflinks', category: "Men's Jewellery", subcategory: 'Cufflinks' },
    { site: 'tgw', product_name: 'HP OmniBook X Flip 2-in-1 Laptop', category: 'Laptops & Computing', subcategory: 'Laptops & Notebooks' }]);
  assert.equal(o[0], 'HP OmniBook X Flip 2-in-1 Laptop');
  o = rank('kettle', [
    { site: 'kgw', product_name: 'Kettler Changing Bag Melange Grey', category: 'Baby & Toddler', subcategory: 'Nappy Bags' },
    { site: 'hgw', product_name: 'DAEWOO Kettle: Sienna Retro 1.7L Jug Kettle', category: 'Home Appliances', subcategory: 'Kettle' }]);
  assert.equal(o[0], 'DAEWOO Kettle: Sienna Retro 1.7L Jug Kettle');
  o = rank('drill', [
    { site: 'mgw', product_name: 'Slim Fatigue (Natural Drill) | 32 | Stan Ray', category: 'Clothing', subcategory: 'Trousers' },
    { site: 'hgw', product_name: 'Adjustable Arm Rest for Office Desk, Clamp-On/No Drill Installation', category: 'Home Office', subcategory: 'Office Desk' },
    { site: 'cgw', product_name: 'Bosch GRD 18V-127 18v Cordless Right Angle Drill No Batteries No Charger No Case', category: 'Power Tools', subcategory: 'Power Tools', merchant_category: 'Power Tools > Drills > Angle Drills' }]);
  assert.equal(o[0], 'Bosch GRD 18V-127 18v Cordless Right Angle Drill No Batteries No Charger No Case', '"No Case" is not a case');
  o = rank('bbq', [
    { site: 'mgw', product_name: 'BBQ Crew (Grey Heather) | S | Stan Ray', category: 'Clothing', subcategory: 'Sweatshirts' },
    { site: 'ggw', product_name: 'Outsunny 2 Burner Gas Barbecue', category: 'BBQ & Outdoor Cooking', subcategory: 'BBQs' }]);
  assert.equal(o[0], 'Outsunny 2 Burner Gas Barbecue', 'BBQs, and barbecue is bbq');
  o = rank('lawn mower', [
    { site: 'cgw', product_name: 'ACEZUK M01 Jump Starter 12V Car Battery', category: 'Site Equipment', subcategory: '' },
    { site: 'ggw', product_name: 'Kärcher LMO 3-18 Battery lawn mower', category: 'Power Garden Tools', subcategory: 'Lawnmowers & Accessories' }]);
  assert.equal(o[0], 'Kärcher LMO 3-18 Battery lawn mower', 'lawn mower = Lawnmowers');
  o = rank('dress', [
    { site: 'kgw', product_name: 'Spider-Man Dress-up Costume for Kids', category: 'Clothing', subcategory: 'Baby & Toddler Dresses' },
    { site: 'wgw', product_name: 'Italy Moda Evening Dress - Brown', category: 'Clothing', subcategory: 'Dresses' }]);
  assert.equal(o[0], 'Italy Moda Evening Dress - Brown');
  // Asking for the accessory still finds it first, and the 3rd copy of one name goes down.
  o = rank('tablet case', [
    { site: 'tgw', product_name: 'Apple iPad Air M4', category: 'Laptops & Computing', subcategory: 'Tablets' },
    { site: 'tgw', product_name: 'Targus tablet case 29.2 cm', category: 'Accessories & Storage', subcategory: 'Computers' }]);
  assert.equal(o[0], 'Targus tablet case 29.2 cm');
  const vests = Array.from({ length: 4 }, () => ({ site: 'cgw', product_name: 'Portwest Hi Vis Vest', category: 'PPE', subcategory: 'Hi-Vis' }));
  o = rank('hi vis', [...vests, { site: 'cgw', product_name: 'Sealey Hi Vis Jacket', category: 'PPE', subcategory: 'Hi-Vis' }]);
  assert.ok(o.indexOf('Sealey Hi Vis Jacket') <= 2, o.join(' / '));
});

test('search: ranking v3 words: plurals, joined words, no prefix match (L177)', () => {
  assert.deepEqual(['dresses', 'watches', 'tablets', 'bbqs', 'batteries', 'boots', 'glass', 'plus'].map(rankStem), ['dress', 'watch', 'tablet', 'bbq', 'battery', 'boot', 'glass', 'plus']);
  const t = rankTokens('Lawnmowers & Accessories');
  assert.ok(t.has('lawnmower') && t.has('accessory'));
  assert.ok(rankTokens('lawn mower').has('lawnmower'));
  assert.ok(!rankTokens('Kettler Changing Bag').has('kettle'));
  assert.ok(!rankTokens('Small Tabletop Fountain').has('tablet'));
});

test('search: ranking v3, a Gear World says some words by itself ("womens boots" = the boots of Women\'s Gear World) (L177)', () => {
  const o = rankHubResults([
    { id: 1, site: 'bgw', product_name: 'Alpinestars Stella Womens Boots', category: 'Motorcycle Clothing', subcategory: 'Riding Boots' },
    { id: 2, site: 'wgw', product_name: 'Solea Heel Boots - Brown', category: 'Shoes', subcategory: 'Boots' },
    { id: 3, site: 'mgw', product_name: 'Diesel Chief Watch', category: 'Watches', subcategory: 'Watches' },
    { id: 4, site: 'wgw', product_name: 'Rose Gold Watch', category: 'Watches', subcategory: 'Watches' }
  ], 'womens boots').map(p => p.id);
  assert.equal(o[0], 2, 'the boots of the women\'s site');
  const m = rankHubResults([
    { id: 4, site: 'wgw', product_name: 'Rose Gold Watch', category: 'Watches', subcategory: 'Watches' },
    { id: 3, site: 'mgw', product_name: 'Diesel Chief Watch', category: 'Watches', subcategory: 'Watches' }
  ], 'mens watch').map(p => p.id);
  assert.equal(m[0], 3, 'mens watch: the men\'s site');
});

test('search check list (L177): 65 searches, 5 for each of the 13 Gear Worlds, read-only, and its rules', async () => {
  const { SEARCHES, judge } = await import('../../tools/gwh-search-check.mjs');
  assert.equal(SEARCHES.length, 65);
  const bySite = {};
  for (const [q, want] of SEARCHES) { assert.ok(q && want.length, q); bySite[want[0]] = (bySite[want[0]] || 0) + 1; }
  assert.deepEqual(Object.values(bySite), Array(13).fill(5), JSON.stringify(bySite));
  const tool = (await import('node:fs')).readFileSync('tools/gwh-search-check.mjs', 'utf8');
  assert.ok(!/method:\s*['"](POST|PUT|DELETE)|\/(go|out)\//.test(tool.replace(/never \/go\/ or \/out\//, '')), 'GET only, never /go/ or /out/');
  const r = s => ({ site: s, delivers_to: ['GB'] });
  assert.equal(judge([r('tgw'), r('tgw'), r('cgw'), r('tgw')], [], ['tgw']).pass, true);
  assert.equal(judge([r('mgw'), r('tgw'), r('tgw'), r('tgw')], [], ['tgw']).pass, false, 'the first result is from another world (cufflinks before laptops)');
  assert.equal(judge([r('tgw'), r('cgw'), r('cgw'), r('cgw'), r('tgw')], [], ['tgw']).pass, false, 'fewer than 3 of the first 5');
  assert.equal(judge([r('tgw'), { site: 'tgw', delivers_to: ['US'] }, r('tgw')], [], ['tgw']).pass, false, 'a product that does not deliver to the UK');
  assert.equal(judge([r('tgw'), r('tgw'), r('tgw')], ['cgw'], ['tgw']).pass, false, 'a site that did not answer');
});
