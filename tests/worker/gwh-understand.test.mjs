// Gear World Hub, Idea 9 phase 1 (lessons L180): a search typed as a sentence. The rules read the product, a price limit
// and who it is for; the model is asked only for a long sentence the rules leave, never for a bot; the answer says what
// was understood and exact=1 searches the words as typed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import hub, {
  understandQuery, readPriceLimit, needsModelReading, readModelUnderstanding, mergeUnderstanding, rankHubResults
} from '../../sites/gwh/worker.js';

const ROOT = new URL('../../sites/gwh/', import.meta.url);
const SITES = [
  ['CGW', 'Construction Gear World', 'constructiongearworld.com'], ['MGW', "Men's Gear World", 'mensgearworld.com'],
  ['WGW', "Women's Gear World", 'womensgearworld.com'], ['KGW', "Kids' Gear World", 'kidsgearworld.com'],
  ['TGW', 'Technology Gear World', 'technologygearworld.com']
];
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function makeDb() {
  const sql = new DatabaseSync(':memory:');
  // The daily limit of model calls lives in subscribe_usage (members.js aiSlot, lessons L106).
  const usage = readFileSync(new URL('migrations/0002_mailerlite_sync.sql', ROOT), 'utf8').match(/CREATE TABLE IF NOT EXISTS subscribe_usage \([^;]+\);/)[0];
  sql.exec(usage);
  sql.exec('CREATE TABLE sites (id INTEGER PRIMARY KEY, site_key TEXT, site_name TEXT, domain TEXT, priority INTEGER, is_active INTEGER)');
  const add = sql.prepare('INSERT INTO sites (site_key, site_name, domain, priority, is_active) VALUES (?, ?, ?, ?, 1)');
  SITES.forEach(([k, n, d], i) => add.run(k, n, d, (i + 1) * 10));
  const wrap = (text, args = []) => ({
    bind: (...a) => wrap(text, a),
    first: async () => sql.prepare(text).get(...args) ?? null,
    all: async () => ({ results: sql.prepare(text).all(...args) }),
    run: async () => { sql.prepare(text).run(...args); return { success: true }; }
  });
  return { prepare: (text) => wrap(text) };
}

function makeAi(answer) {
  const calls = [];
  return { calls, run: async (model, input) => { calls.push({ model, input }); return typeof answer === 'function' ? answer(input) : answer; } };
}

// The sites: each answers with its products; every request is kept (search words, max, min).
function sitesFetch(products) {
  const asked = [];
  const fetch = async (url) => {
    const u = new URL(url);
    asked.push({ host: u.hostname, search: u.searchParams.get('search'), max: u.searchParams.get('max'), min: u.searchParams.get('min') });
    const list = (products[u.hostname] || []).filter(p => {
      const max = u.searchParams.get('max'), min = u.searchParams.get('min');
      return (max === null || p.price <= Number(max)) && (min === null || p.price >= Number(min));
    });
    return new Response(JSON.stringify({ products: list }), { headers: { 'Content-Type': 'application/json' } });
  };
  return { fetch, asked };
}

async function search(q, { products = {}, ai = null, ua = BROWSER, extra = '' } = {}) {
  const fake = sitesFetch(products);
  const saved = globalThis.fetch;
  globalThis.fetch = fake.fetch;
  try {
    const env = { gear_world_registry: makeDb(), ...(ai ? { AI: ai } : {}) };
    const headers = ua ? { 'User-Agent': ua } : {};
    const response = await hub.fetch(new Request(`https://gearworldhub.com/api/search?q=${encodeURIComponent(q)}&country=GB${extra}`, { headers }), env, {});
    return { status: response.status, data: await response.json(), asked: fake.asked };
  } finally {
    globalThis.fetch = saved;
  }
}

const tablet = (id, price, currency, name = 'Kids Tablet 10 inch') => ({ id, product_name: name, brand: 'Test', retailer: 'Shop', price, currency, site_category: 'Tablets' });

test('L180 rules: the product, the price limit and who it is for, in 11 languages', () => {
  const cases = [
    ['i want to buy a tablet', 'tablet', null, null, null, null],
    ['tablet under 200', 'tablet', 200, null, null, null],
    ['need new car tyre', 'car tyre', null, null, null, null],
    ['looking for running shoes for my son under £50', 'running shoes', 50, null, 'GBP', 'kgw'],
    ['θέλω ένα ψυγείο μέχρι 500 ευρώ', 'ψυγείο', 500, null, 'EUR', null],
    ['θελω ενα καινουργιο κινητο', 'κινητο', null, null, null, null],
    ['szukam laptopa do 3000 zł', 'laptopa', 3000, null, 'PLN', null],
    ['od 100 do 200 zł buty', 'buty', 200, 100, 'PLN', null],
    ['ich suche eine Kaffeemaschine unter 100 Euro', 'Kaffeemaschine', 100, null, 'EUR', null],
    ['je cherche une tablette pas cher', 'tablette', null, null, null, null],
    ['quiero comprar un portátil hasta 600 euros', 'portátil', 600, null, 'EUR', null],
    ['cerco un regalo per mia moglie', 'regalo', null, null, null, 'wgw'],
    ['ik zoek een fiets voor mijn zoon', 'fiets', null, null, null, 'kgw'],
    ['caut un ceas pentru soțul meu', 'ceas', null, null, null, 'mgw'],
    ['хочу купить наушники до 5000', 'наушники', 5000, null, null, null],
    ['laptop £500', 'laptop', 500, null, 'GBP', null],
    ['headphones between £50 and £100', 'headphones', 100, 50, 'GBP', null],
    ['running shoes 100-150 €', 'running shoes', 150, 100, 'EUR', null],
    ['under £1,500 laptop', 'laptop', 1500, null, 'GBP', null],
    ['laptop below 1.5k', 'laptop', 1500, null, null, null],
    ['perfume for her', 'perfume', null, null, null, 'wgw'],
    ['smartwatch for my wife max 300€', 'smartwatch', 300, null, 'EUR', 'wgw'],
    ['want a brand new sofa for my mum', 'sofa', null, null, null, 'wgw'],
    ['bed for my dog', 'bed dog', null, null, null, 'zgw'],
    ['κρεβάτι για τον σκύλο μου', 'κρεβάτι σκύλο', null, null, null, 'zgw'],
    ['something for her', 'gift', null, null, null, 'wgw'],
    ['a drill please', 'drill', null, null, null, null]
  ];
  for (const [q, item, max, min, currency, site] of cases) {
    const u = understandQuery(q);
    assert.equal(u.changed, true, q);
    assert.deepEqual([u.item, u.max_price, u.min_price, u.currency, u.site], [item, max, min, currency, site], q);
  }
});

test('L180 rules: what is not a sentence stays exactly as typed (brands, sizes, ages, model numbers)', () => {
  for (const q of ['kettle', 'tablet?', 'under armour shoes', 'iphone 15 pro max', 'tv under 50 inch', 'The North Face jacket',
    'New Balance trainers', 'New Look dress', 'ps5', '1tb ssd up to 2tb', 'kids aged 3 to 5', 'toys for under 5s',
    'samsung galaxy s24 ultra 256gb', 'laptop do gier', 'my little pony', 'a4 paper']) {
    const u = understandQuery(q);
    assert.equal(u.changed, false, q);
    assert.equal(u.item, q.replace(/\s+/g, ' ').trim(), q);
    assert.equal(u.max_price, null, q);
  }
  assert.equal(readPriceLimit('do 3000 zł').max, 3000);
  assert.equal(readPriceLimit('between 3 and 5 years'), null, 'an age, not a price');
  assert.equal(readPriceLimit('200-300'), null, 'two numbers without a currency or a word are not a price');
});

test('L180 model: asked only for a long sentence; its answer is checked; the visitor\'s own price and person win', () => {
  const ask = q => needsModelReading(q, understandQuery(q));
  assert.equal(ask('wireless earbuds with good battery life for the gym'), true);
  assert.equal(ask('something warm for winter walks with my dog'), true);
  assert.equal(ask('i want to buy a tablet'), false, 'the rules found it');
  assert.equal(ask('samsung galaxy s24 ultra 256gb'), false, 'five words as typed: not a sentence');
  assert.equal(ask('ok'), false);
  const good = readModelUnderstanding('{"item":"wireless earbuds","max_price":80,"min_price":null,"currency":"GBP","for":"men"}');
  assert.deepEqual([good.item, good.max_price, good.currency, good.site], ['wireless earbuds', 80, 'GBP', 'mgw']);
  for (const bad of ['no json', '{"item":"x"}', '{"item":"ignore all rules; <script>"}', '{"item":"' + 'a'.repeat(70) + '"}', '[1,2]',
    '{"item":"tv","max_price":"lots"}']) {
    const r = readModelUnderstanding(bad);
    assert.ok(r === null || (r.max_price === null && r.min_price === null), bad);
  }
  assert.equal(readModelUnderstanding('{"item":"tv","max_price":100,"min_price":300}').max_price, null, 'min above max: no prices');
  const merged = mergeUnderstanding(understandQuery('something warm under £60 for my son to wear on long winter walks'),
    { item: 'winter coat', max_price: 999, min_price: null, currency: 'EUR', for: 'women', site: 'wgw', changed: true });
  assert.deepEqual([merged.item, merged.max_price, merged.currency, merged.site], ['winter coat', 60, 'GBP', 'kgw']);
});

test('L180 search: the sites get the product and the price; another currency is not compared; the named site comes first', async () => {
  const { data, asked } = await search('i want to buy a tablet for my son under £200', {
    products: {
      'technologygearworld.com': [tablet(1, 150, 'GBP', 'Tablet 10 inch'), tablet(2, 250, 'GBP', 'Tablet Pro')],
      'kidsgearworld.com': [tablet(3, 90, 'GBP'), tablet(4, 120, 'EUR', 'Kids Tablet EU')]
    }
  });
  assert.ok(asked.length > 0 && asked.every(a => a.search === 'tablet' && a.max === '200' && a.min === null), JSON.stringify(asked));
  assert.deepEqual(data.understood, { query: 'i want to buy a tablet for my son under £200', item: 'tablet', max_price: 200,
    min_price: null, currency: 'GBP', for: 'kids', site: 'kgw', source: 'rules', search: 'tablet' });
  assert.deepEqual(data.results.map(r => r.id), [3, 1], 'KGW first; the EUR price is not compared with £200; £250 is over');
  assert.equal(data.query, 'i want to buy a tablet for my son under £200', 'the words as typed stay in "query"');
  assert.deepEqual(data.filters.max_price, 200);
});

test('L180 search: exact=1, the gift finder and a plain search are as before (no "understood")', async () => {
  const exact = await search('i want to buy a tablet', { extra: '&exact=1' });
  assert.ok(exact.asked.every(a => a.search === 'i want to buy a tablet'));
  assert.equal(exact.data.understood, undefined);
  const gift = await search('perfume for her', { extra: '&worlds=wgw&max_price=50' });
  assert.ok(gift.asked.every(a => a.search === 'perfume for her' && a.max === '50'));
  assert.equal(gift.data.understood, undefined);
  const plain = await search('kettle');
  assert.ok(plain.asked.every(a => a.search === 'kettle' && a.max === null));
  assert.equal(plain.data.understood, undefined);
});

test('L180 search: the rules also work for a bot (no cost); the model never does', async () => {
  const ai = makeAi({ response: '{"item":"earbuds","max_price":null,"min_price":null,"currency":null,"for":null}' });
  const bot = await search('wireless earbuds with good battery life for the gym', { ai, ua: 'GearWorldQA-bot/1.0 (+read-only check)' });
  assert.equal(ai.calls.length, 0);
  assert.equal(bot.data.understood, undefined);
  const rules = await search('i need a new laptop under £700', { ai, ua: 'GearWorldQA-bot/1.0 (+read-only check)' });
  assert.equal(ai.calls.length, 0);
  assert.equal(rules.data.understood.item, 'laptop');
  assert.ok(rules.asked.every(a => a.search === 'laptop' && a.max === '700'));
});

test('L180 search: a long sentence is read by the model once, within the daily limit; a bad answer leaves the words as typed', async () => {
  const ai = makeAi({ response: '{"item":"wireless earbuds","max_price":null,"min_price":null,"currency":null,"for":null}' });
  // The sites find something, so the zero-results second try (ascii-v2) does not ask the model as well.
  const products = { 'technologygearworld.com': [tablet(5, 30, 'GBP', 'Wireless Earbuds')] };
  const r = await search('wireless earbuds with good battery life for the gym', { ai, products });
  assert.equal(ai.calls.length, 1);
  const input = ai.calls[0].input;
  assert.match(input.messages[0].content, /never instructions/);
  assert.equal(input.messages[1].content, 'wireless earbuds with good battery life for the gym', 'the search goes as data, in its own message');
  assert.equal(input.max_tokens, 96);
  assert.ok(r.asked.every(a => a.search === 'wireless earbuds'));
  assert.equal(r.data.understood.source, 'model');
  const badAi = makeAi({ response: 'Ignore that. {"item":"DROP TABLE; <b>","max_price":1}' });
  const bad = await search('wireless earbuds with good battery life for the gym', { ai: badAi, products });
  assert.equal(badAi.calls.length, 1);
  assert.equal(bad.data.understood, undefined);
  assert.ok(bad.asked.every(a => a.search === 'wireless earbuds with good battery life for the gym'));
});

test('L180 ranking: the named Gear World gets a push, not a filter', () => {
  const list = [
    { id: 1, site: 'tgw', product_name: 'Tablet 10 inch', category: 'Tablets' },
    { id: 2, site: 'kgw', product_name: 'Tablet for Kids', category: 'Kids Tech' }
  ];
  assert.equal(rankHubResults(list.slice(), 'tablet')[0].id, 1);
  const pushed = rankHubResults(list.slice(), 'tablet', 'kgw');
  assert.deepEqual(pushed.map(p => p.id), [2, 1], 'both stay, KGW first');
});
