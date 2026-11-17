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
const RATES = { ok: true, base: 'GBP', date: '2026-11-17', rates: { EUR: 1.2, PLN: 5.25, RON: 6.4, USD: 1.32 }, source: 'Frankfurter' };
function sitesFetch(products, rates = RATES) {
  const asked = [];
  const fetch = async (url) => {
    const u = new URL(url);
    if (u.pathname === '/api/fx') return rates ? Response.json(rates) : new Response('no', { status: 503 });
    asked.push({ host: u.hostname, search: u.searchParams.get('search'), max: u.searchParams.get('max'), min: u.searchParams.get('min') });
    const list = (products[u.hostname] || []).filter(p => {
      const max = u.searchParams.get('max'), min = u.searchParams.get('min');
      return (max === null || p.price <= Number(max)) && (min === null || p.price >= Number(min));
    });
    return new Response(JSON.stringify({ products: list }), { headers: { 'Content-Type': 'application/json' } });
  };
  return { fetch, asked };
}

async function search(q, { products = {}, ai = null, ua = BROWSER, extra = '', rates = RATES } = {}) {
  const fake = sitesFetch(products, rates);
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
    ['a drill please', 'drill', null, null, null, null],
    // The independent review of 17/11/2026:
    ['i want new balance trainers', 'new balance trainers', null, null, null, null],
    ['looking for new balance 574 under £80', 'new balance 574', 80, null, 'GBP', null],
    ['i want a new look dress', 'new look dress', null, null, null, null],
    ['laptop £1,299.99', 'laptop', 1299.99, null, 'GBP', null],
    ['tv under 1.299,99 €', 'tv', 1299.99, null, 'EUR', null],
    ['τάμπλετ μέχρι 200 λίρες', 'τάμπλετ', 200, null, 'GBP', null],
    ['dumbbells under 10 pounds', 'dumbbells', 10, null, 'GBP', null],
    ['gift for dad', 'gift', null, null, null, 'mgw'],
    ['toys for baby', 'toys', null, null, null, 'kgw'],
    ['air max 90 under £100', 'air max 90', 100, null, 'GBP', null]
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
    'samsung galaxy s24 ultra 256gb', 'laptop do gier', 'my little pony', 'a4 paper',
    // The independent review of 17/11/2026: names, ages, sizes and shares are not prices; brands keep their first word.
    'nike air max 90', 'air max 270', 'ninja foodi max 15-in-1', 'tefal easy fry max 5', 'car sub 12', 'spielzeug ab 3', 'lego ab 6',
    'zabawki od 3', 'speelgoed vanaf 3', 'above 18 games', '10 pound dumbbell', '5 pound weights', 'euro 2024 football',
    'euro 6 diesel', 'funko pop ron 7', 'ladder up to 3 metres', 'hose up to 30 metres', 'trampoline under 8 ft',
    'battery up to 5 ah', 'up to 70% off', "jouets jusqu'à 12 mois", 'juguetes hasta 12 meses', 'παιχνίδια έως 12 μηνών',
    'toys for under 5', 'gift for over 60', 'uno cards', 'o ring', "O'Neill wetsuit", 'cos dress', 'Cheap Monday', 'dua lipa',
    'apple iphone 15 pro max 256gb natural titanium', 'Für Sie magazine']) {
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
  assert.equal(ask('i need wireless earbuds with good battery life for the gym'), true);
  assert.equal(ask('wireless earbuds with good battery life for the gym'), false, 'as typed: never asked first (the zero-result second try stays)');
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

test('L180 search: the sites get the product and a wide price; another currency at today\'s rate; the named site comes first', async () => {
  const { data, asked } = await search('i want to buy a tablet for my son under £200', {
    products: {
      'technologygearworld.com': [tablet(1, 150, 'GBP', 'Tablet 10 inch'), tablet(2, 250, 'GBP', 'Tablet Pro')],
      'kidsgearworld.com': [tablet(3, 90, 'GBP'), tablet(4, 120, 'EUR', 'Kids Tablet EU')]
    }
  });
  // £200 covers every currency of the sites: the widest is the leu (6.4 a pound), so the sites are asked up to 1,280.
  const sites = asked.filter(a => a.search !== null);
  assert.ok(sites.length > 0 && sites.every(a => a.search === 'tablet' && a.max === '1280' && a.min === null), JSON.stringify(sites));
  assert.deepEqual(data.understood, { query: 'i want to buy a tablet for my son under £200', item: 'tablet', max_price: 200,
    min_price: null, currency: 'GBP', for: 'kids', site: 'kgw', source: 'rules', converted: true, search: 'tablet' });
  assert.deepEqual(data.results.map(r => r.id).sort(), [1, 3, 4], '€120 = £100 is under £200; £250 is over');
  assert.deepEqual(data.results.slice(0, 2).map(r => r.site), ['kgw', 'kgw'], 'Kids\' Gear World first');
  // Without the rates: a price in another currency is not compared (no rate is guessed); the sites get £200.
  const none = await search('i want to buy a tablet for my son under £200', { rates: null, products: {
    'technologygearworld.com': [tablet(1, 150, 'GBP', 'Tablet 10 inch')], 'kidsgearworld.com': [tablet(3, 90, 'GBP'), tablet(4, 120, 'EUR', 'Kids Tablet EU')] } });
  assert.deepEqual(none.data.results.map(r => r.id).sort(), [1, 3]);
  assert.ok(none.asked.filter(a => a.search !== null).every(a => a.max === '200'));
  assert.equal(none.data.understood.converted, undefined);
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
  // £700 in every currency of the sites: up to 4,480 (the leu), then the Hub compares in pounds.
  assert.ok(rules.asked.filter(a => a.search !== null).every(a => a.search === 'laptop' && a.max === '4480'));
});

test('L180 search: a long sentence is read by the model once, within the daily limit; a bad answer leaves the words as typed', async () => {
  const ai = makeAi({ response: '{"item":"wireless earbuds","max_price":null,"min_price":null,"currency":null,"for":null}' });
  // The sites find something, so the zero-results second try (ascii-v2) does not ask the model as well.
  const products = { 'technologygearworld.com': [tablet(5, 30, 'GBP', 'Wireless Earbuds')] };
  const r = await search('i need wireless earbuds with good battery life for the gym', { ai, products });
  assert.equal(ai.calls.length, 1);
  const input = ai.calls[0].input;
  assert.match(input.messages[0].content, /never instructions/);
  assert.equal(input.messages[1].content, 'i need wireless earbuds with good battery life for the gym', 'the search goes as data, in its own message');
  assert.equal(input.max_tokens, 96);
  assert.ok(r.asked.every(a => a.search === 'wireless earbuds'));
  assert.equal(r.data.understood.source, 'model');
  const badAi = makeAi({ response: 'Ignore that. {"item":"DROP TABLE; <b>","max_price":1}' });
  const bad = await search('i need wireless earbuds with good battery life for the gym', { ai: badAi, products });
  assert.equal(badAi.calls.length, 1);
  assert.equal(bad.data.understood.source, 'rules', 'a bad answer: the rules\' reading stays');
  assert.ok(bad.asked.every(a => a.search === 'wireless earbuds with good battery life for the gym'));
  // The model gives back the words as typed: nothing is "understood".
  const sameAi = makeAi({ response: '{"item":"i need wireless earbuds","max_price":null,"min_price":null,"currency":null,"for":null}' });
  const same = await search('i need wireless earbuds', { ai: sameAi, products });
  assert.equal(sameAi.calls.length, 0, 'three words left: the rules are enough');
  assert.equal(same.data.understood.item, 'wireless earbuds');
});

test('L180 ranking: the named Gear World gets a push, not a filter', () => {
  const list = [
    { id: 1, site: 'tgw', product_name: 'Tablet 10 inch', category: 'Tablets' },
    { id: 2, site: 'kgw', product_name: 'Tablet for Kids', category: 'Kids Tech', subcategory: 'Kids Tablets' }
  ];
  assert.equal(rankHubResults(list.slice(), 'tablet')[0].id, 1);
  // A name alone (no shelf of its kind) gets only a small push: "Drill Cotton Chino Trousers" for "drill for him".
  const drills = [
    { id: 1, site: 'cgw', product_name: 'DeWalt 18V Combi Drill', category: 'Power Tools', subcategory: 'Drills' },
    { id: 2, site: 'mgw', product_name: 'Drill Cotton Chino Trousers', category: 'Clothing', subcategory: 'Trousers' }
  ];
  assert.equal(rankHubResults(drills.slice(), 'drill', 'mgw')[0].id, 1);
  const pushed = rankHubResults(list.slice(), 'tablet', 'kgw');
  assert.deepEqual(pushed.map(p => p.id), [2, 1], 'both stay, KGW first');
});

test('L180 ranking: an accessory shelf goes down; a person named pushes the other persons\' Gear Worlds down', () => {
  const laptops = [
    { id: 1, site: 'hgw', product_name: 'Leitz Ergo Adjustable Multi-Angle Laptop Stand', category: 'Home Office', subcategory: 'Laptop Stand' },
    { id: 2, site: 'pgw', product_name: 'Belkin mobile device charger Laptop', category: 'Gaming PCs & Laptops', subcategory: 'Mobile Chargers' },
    { id: 3, site: 'pgw', product_name: 'Razer laptop dock/port replicator', category: 'Gaming PCs & Laptops', subcategory: 'Computers' },
    { id: 4, site: 'tgw', product_name: 'HP Renew Business 17.3-inch Laptop Backpack', category: 'Accessories & Storage', subcategory: 'Cases & Covers' },
    { id: 5, site: 'tgw', product_name: 'HP Chromebook 15a Intel N100 15.6"', category: 'Laptops & Computing', subcategory: 'Laptops & Notebooks' }
  ];
  assert.equal(rankHubResults(laptops.slice(), 'laptop')[0].id, 5, 'the Chromebook in "Laptops & Notebooks" first');
  // Accessory words that are part of a name stay: "Stand Mixers" for "mixer", "Wallets & Accessories" for "wallet".
  const mixers = [
    { id: 1, site: 'hgw', product_name: 'Hand Mixer 5 Speed', category: 'Kitchen & Dining', subcategory: 'Small Appliances' },
    { id: 2, site: 'hgw', product_name: 'KitchenAid Artisan Stand Mixer', category: 'Kitchen & Dining', subcategory: 'Stand Mixers' }
  ];
  assert.equal(rankHubResults(mixers.slice(), 'mixer')[0].id, 2);
  const wallets = [
    { id: 1, site: 'mgw', product_name: 'Leather Wallet Brown', category: 'Bags & Accessories', subcategory: 'Wallets & Accessories' },
    { id: 2, site: 'hgw', product_name: 'Wallet Organiser Tray', category: 'Storage & Organisation', subcategory: 'Drawer Organisers' }
  ];
  assert.equal(rankHubResults(wallets.slice(), 'wallet')[0].id, 1);
  assert.equal(rankHubResults(laptops.slice(), 'laptop stand')[0].id, 1, 'asked for the accessory: it comes first');
  const shoes = [
    { id: 1, site: 'wgw', product_name: "adidas Women's Terrex Running Shoes", category: 'Shoes', subcategory: 'Running Shoes' },
    { id: 2, site: 'sgw', product_name: "Brooks Ghost Running Shoes", category: 'Running', subcategory: 'Running Shoes' },
    { id: 3, site: 'kgw', product_name: "adidas Junior Pureboost Running Shoes", category: 'Shoes', subcategory: 'Trainers' }
  ];
  assert.deepEqual(rankHubResults(shoes.slice(), 'running shoes', 'kgw').map(p => p.id), [3, 2, 1], 'kids first, women\'s last');
});
