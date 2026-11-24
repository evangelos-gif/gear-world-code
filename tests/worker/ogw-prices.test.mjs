// Prices on the pages of the 5 big Greek stores of Linkwise (owner and Linkwise, 24 Nov 2026, lessons L227): only the
// store's own price from its Linkwise product feed, with the date and time the feed was read, never older than 24
// hours, one store per page (no comparison, no "before", no %), and never on any other page. Fake feeds in a temporary
// folder, a fixed clock, a fake code: never the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, utimesSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import site from '../../sites/ogw/site.config.js';
import { createGuidesWorker, priceKey, linkwisePrices, directPrice, PRICE_MAX_AGE_MS } from '../../src/marketplace-guides.js';
import { pageKey } from '../../src/lib/price-key.js';
import { directStoresFromConfig, buildPrices } from '../../tools/ogw-prices.mjs';

const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-24T18:30:00Z');
const CODE = 'CD12345';
const BROWSER = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const DIRECT = site.stores.filter(s => s.direct);
const KOTS = DIRECT.find(s => s.slug === 'kotsovolos-gr');
const items = s => [...(s.direct.sets || []).flatMap(x => x.items), ...(s.direct.ideas || []).map(x => x.item).filter(Boolean)];
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64');
const visible = html => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\u00a0|\u202f/g, ' ').replace(/\s+/g, ' ').replace(/ ([,:.])/g, '$1');

// The secret for one store: every product of its sets and ideas at `price`, read `ago` ms before NOW.
function secret(stores = DIRECT, { ago = 3600000, price = 399, program = null } = {}) {
  const s = {};
  for (const st of stores) {
    const p = {};
    for (const i of items(st)) p[priceKey(i.url)] = price;
    if (Object.keys(p).length) s[String(program || st.direct.program)] = { t: new Date(NOW - ago).toISOString(), p };
  }
  return b64({ v: 1, s });
}
async function get(path, env, { cc = 'GR', now = NOW } = {}) {
  const fetch = async input => {
    const u = new URL(String(input));
    const rows = [1, 2, 3].map(n => ({ product_name: `Item ${n}`, brand: 'Acme', retailer: u.searchParams.get('retailer'), stock_status: 'in_stock', price: 24.9,
      image_url: `https://img.example/${n}.jpg`, delivers_to: [u.searchParams.get('deliver_to')], product_url: `https://${u.hostname}/product/p-${n}/` }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const w = createGuidesWorker(site, { fetch, photoFetch: null, cache: null, now: () => now });
  const req = new Request(LIVE + path, { headers: { 'user-agent': BROWSER } });
  if (cc) Object.defineProperty(req, 'cf', { value: { country: cc } });
  const r = await w.fetch(req, env);
  return { r, text: await r.text() };
}
const priceTags = text => [...text.matchAll(/<p class="sc-price"><span translate="no">([^<]+)<\/span> <span class="sc-when">([^<]+)<\/span><\/p>/g)];
const withoutPrices = text => text.replace(/<p class="sc-price">[\s\S]*?<\/p>/g, '');

test('L227: the key of a page: the same for the same page, whatever www, a last "/", utm_ or the order of its parameters', () => {
  const k = priceKey('https://www.kotsovolos.gr/ProductDisplay?partNumber=273143');
  assert.match(k, /^[0-9a-f]{8}$/);
  for (const same of ['https://kotsovolos.gr/ProductDisplay?partNumber=273143', 'http://www.kotsovolos.gr/ProductDisplay?partNumber=273143#x',
    'https://WWW.KOTSOVOLOS.GR/ProductDisplay?utm_source=linkwise&partNumber=273143&utm_medium=affiliate', ' https://www.kotsovolos.gr/ProductDisplay?partNumber=273143&gclid=1 ']) {
    assert.equal(priceKey(same), k, same);
  }
  for (const other of ['https://www.kotsovolos.gr/ProductDisplay?partNumber=273144', 'https://www.public.gr/ProductDisplay?partNumber=273143', 'https://www.kotsovolos.gr/productdisplay?partNumber=273143']) {
    assert.notEqual(priceKey(other), k, other);
  }
  assert.equal(pageKey('https://www.sephora.gr/p/a-b/'), 'sephora.gr/p/a-b');
  assert.equal(pageKey('https://www.e-shop.gr/x?b=2&a=1'), 'e-shop.gr/x?a=1&b=2');
  for (const bad of ['', 'nope', 'javascript:alert(1)', 'ftp://www.kotsovolos.gr/x', null]) assert.equal(priceKey(bad), '', String(bad));
});

test('L227: the PC tool finds exactly the products of the config (it reads it as text, with any Node.js)', () => {
  const found = directStoresFromConfig(readFileSync('sites/ogw/site.config.js', 'utf8'));
  assert.deepEqual(found.map(s => [s.slug, s.program, s.hosts]), DIRECT.map(s => [s.slug, s.direct.program, s.direct.hosts]));
  for (const s of DIRECT) {
    const f = found.find(x => x.slug === s.slug);
    assert.deepEqual(f.picks, items(s).map(i => ({ name: i.name, image: i.image, url: i.url })), `${s.slug}: its products, in order`);
  }
  assert.equal(found.find(s => s.slug === 'ab-gr').picks.length, 0, 'AB has no product feed: no products, no prices');
});

// A fake Linkwise feed as chat 3's tool writes it (tools/linkwise-feed.mjs: the Awin column names).
const COLS = ['aw_product_id', 'merchant_id', 'product_name', 'merchant_deep_link', 'aw_deep_link', 'merchant_image_url', 'search_price', 'currency', 'in_stock'];
const csv = rows => [COLS, ...rows.map(r => COLS.map(c => r[c] ?? ''))].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
function archive(files) {
  const dir = mkdtempSync(join(tmpdir(), 'gw-ogw-prices-'));
  for (const [program, { rows, age = 3600000 }] of Object.entries(files)) {
    const f = join(dir, `LINKWISE_${program}.csv.gz`);
    writeFileSync(f, gzipSync(csv(rows)));
    const t = (NOW - age) / 1000;
    utimesSync(f, t, t);
  }
  return dir;
}

test('L227: the PC tool: by page, else photo, else a name only one product has; euros, in stock, fresh feeds only', async () => {
  const k = items(KOTS);
  const rows = [
    { product_name: 'x', merchant_deep_link: `${k[0].url}&utm_source=linkwise`, search_price: '399.00', currency: 'EUR', in_stock: '1' },
    { product_name: 'x', merchant_deep_link: 'https://www.kotsovolos.gr/other', merchant_image_url: k[1].image, search_price: '89.90', currency: 'EUR', in_stock: '' },
    { product_name: `  ${k[2].name.toUpperCase()} `, merchant_deep_link: 'https://www.kotsovolos.gr/renamed', search_price: '1299.00', currency: 'EUR', in_stock: '1' },
    { product_name: 'y', merchant_deep_link: k[3].url, search_price: '59.00', currency: 'EUR', in_stock: '0' },
    { product_name: 'y', merchant_deep_link: k[4].url, search_price: '59.00', currency: 'GBP', in_stock: '1' },
    { product_name: k[5].name, merchant_deep_link: 'https://www.kotsovolos.gr/a', search_price: '10.00', currency: 'EUR', in_stock: '1' },
    { product_name: k[5].name, merchant_deep_link: 'https://www.kotsovolos.gr/b', search_price: '11.00', currency: 'EUR', in_stock: '1' },
    { product_name: 'z', merchant_deep_link: k[6].url, search_price: '0', currency: 'EUR', in_stock: '1' },
    { product_name: 'z', merchant_deep_link: k[7].url, search_price: 'abc', currency: 'EUR', in_stock: '1' }
  ];
  const pub = items(DIRECT.find(s => s.slug === 'public-gr'));
  const dir = archive({
    138: { rows },
    469: { rows: [{ product_name: 'p', merchant_deep_link: pub[0].url, search_price: '25.00', currency: 'EUR', in_stock: '1' }], age: PRICE_MAX_AGE_MS + 60000 },
    13026: { rows: [{ product_name: 'nothing of ours', merchant_deep_link: 'https://www.sephora.gr/p/none', search_price: '5.00', currency: 'EUR', in_stock: '1' }] }
  });
  try {
    const { lines, value } = await buildPrices({ archive: dir, config: 'sites/ogw/site.config.js', now: NOW });
    const iso = new Date(NOW - 3600000).toISOString();
    assert.deepEqual(lines, [
      `PRICES kotsovolos-gr 138 OK 3 9 1 ${iso}`,
      `PRICES public-gr 469 OLD 0 9 0 ${new Date(NOW - PRICE_MAX_AGE_MS - 60000).toISOString()}`,
      `PRICES sephora-gr 13026 NONE 0 9 0 ${iso}`,
      'PRICES e-shop-gr 11754 MISSING 0 9 0 -',
      'PRICES ab-gr 12158 SKIP 0 0 0 -',
      'PRICES-DONE 1 3'
    ]);
    const data = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
    assert.deepEqual(data, { v: 1, s: { 138: { t: iso, p: { [priceKey(k[0].url)]: 399, [priceKey(k[1].url)]: 89.9, [priceKey(k[2].url)]: 1299 } } } });
    // The command line: ASCII on stdout only, the value in --out, nothing on stderr (Windows PowerShell 5.1).
    const out = join(dir, 'prices.b64');
    const r = execFileSync(process.execPath, ['tools/ogw-prices.mjs', '--archive', dir, '--out', out, '--now', new Date(NOW).toISOString()], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.equal(r, lines.join('\n') + '\n');
    assert.match(r, /^[\x20-\x7E\n]+$/);
    assert.equal(readFileSync(out, 'ascii'), value);
    // No prices: no file at all (the Worker keeps nothing new).
    const none = join(dir, 'none.b64');
    execFileSync(process.execPath, ['tools/ogw-prices.mjs', '--archive', join(dir, 'missing'), '--out', none], { stdio: 'ignore' });
    assert.ok(!existsSync(none));
    // A bad call or a broken file: one line on stdout, nothing on stderr.
    writeFileSync(join(dir, 'LINKWISE_11754.csv.gz'), 'not a gzip');
    const bad = execFileSync(process.execPath, ['tools/ogw-prices.mjs', '--archive', dir, '--out', join(dir, 'bad.b64'), '--now', new Date(NOW).toISOString()], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.match(bad, /^PRICES-ERROR /m);
    assert.ok(!existsSync(join(dir, 'bad.b64')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('L227: the secret is read once and checked: programme, key, price and time; anything else is left out', () => {
  const key = priceKey(items(KOTS)[0].url);
  const t = new Date(NOW).toISOString();
  const m = linkwisePrices({ LINKWISE_PRICES: b64({ v: 1, s: { 138: { t, p: { [key]: 399.004, zz: 5, [`${key}0`]: 5, abcdef01: -1, abcdef02: 1e6, abcdef03: '9' } }, x1: { t, p: { [key]: 1 } }, 469: { t: 'nope', p: { [key]: 1 } } } }) });
  assert.deepEqual([...m.keys()], ['138']);
  assert.deepEqual([...m.get('138').p], [[key, 399]]);
  for (const bad of [undefined, '', 'not base64!', b64({ v: 2, s: { 138: { t, p: { [key]: 1 } } } }), b64([1, 2]), Buffer.from('{').toString('base64'), 'A'.repeat(30000)]) {
    assert.equal(linkwisePrices({ LINKWISE_PRICES: bad }).size, 0, String(bad).slice(0, 20));
  }
  const fresh = linkwisePrices({ LINKWISE_PRICES: secret([KOTS], { ago: 1000 }) });
  assert.equal(directPrice(fresh, KOTS, items(KOTS)[0].url, NOW).amount, 399);
  assert.equal(directPrice(fresh, KOTS, items(KOTS)[0].url, NOW + PRICE_MAX_AGE_MS - 1000).amount, 399, 'still fresh at 24 hours');
  assert.equal(directPrice(fresh, KOTS, items(KOTS)[0].url, NOW + PRICE_MAX_AGE_MS), null, 'older than 24 hours: gone');
  assert.equal(directPrice(fresh, KOTS, items(KOTS)[0].url, NOW - 1000 - 11 * 60000), null, 'a time ahead of the clock: not shown');
  assert.equal(directPrice(fresh, DIRECT.find(s => s.slug === 'public-gr'), items(KOTS)[0].url, NOW), null, 'only its own programme');
  assert.equal(directPrice(fresh, site.stores.find(s => s.slug === 'parex-gr'), items(KOTS)[0].url, NOW), null, 'never a store of the Gear World sites');
});

test('L227: the store page shows its own prices with the time they were checked, the note says where they come from', async () => {
  const env = { LINKWISE_CODE: CODE, LINKWISE_PRICES: secret() };
  const { r, text } = await get('/gr/stores/kotsovolos-gr/', env);
  assert.equal(r.status, 200);
  const tags = priceTags(text);
  assert.equal(tags.length, items(KOTS).length, 'one price for each product of the sets and ideas');
  for (const m of tags) {
    assert.equal(m[1].replace(/\s/g, ' '), '399,00 €');
    assert.equal(m[2], 'έλεγχος 24/11, 19:30', 'Greek time (EET) of the feed');
  }
  const v = visible(text);
  assert.ok(v.includes('Οι τιμές προέρχονται από το product feed του καταστήματος Κωτσόβολος στη Linkwise και ελέγχθηκαν στις 24/11, 19:30 (ώρα Ελλάδας).'), 'the note');
  assert.ok(!v.includes('δεν παρακολουθούμε τιμές'), 'not the old "no prices" note');
  // Each price sits under its own product, next to its Linkwise button: one store, no comparison, no other number.
  const its = withoutPrices(text);
  assert.ok(!/€|\d+\s*%/.test(visible(its)), 'no euro sign and no % outside the prices');
  assert.ok(!/πριν|από\s+\d|was|before|έκπτωσ|προσφορ/i.test(tags.map(m => m[0]).join(' ')), 'no "before" price, no word of a discount');
  assert.equal([...text.matchAll(/href="https:\/\/go\.linkwi\.se\/z\/138-0\/CD12345\/\?lnkurl=/g)].length >= tags.length, true, 'the ideas still open the store through Linkwise');
  // English on the same page: the same prices, in English.
  const en = await get('/gr/stores/kotsovolos-gr/?lang=en-GB', env);
  const enTags = priceTags(en.text);
  assert.equal(enTags.length, tags.length);
  assert.equal(enTags[0][1].replace(/\s/g, ' '), '€399.00');
  assert.equal(enTags[0][2], 'checked 24/11, 19:30');
  assert.ok(visible(en.text).includes('The prices come from the product feed of Κωτσόβολος on Linkwise and were checked on 24/11, 19:30 (Greek time). A price older than 24 hours is not shown.'));
});

test('L227: an old, future or foreign price is not shown: the idea stays, without a price, with the old note', async () => {
  for (const [why, value, now] of [
    ['older than 24 hours', secret(DIRECT, { ago: PRICE_MAX_AGE_MS + 60000 }), NOW],
    ['read "in the future"', secret(DIRECT, { ago: -3600000 }), NOW],
    ['the prices of another programme', secret([KOTS], { program: 469 }), NOW],
    ['nothing readable', 'xx', NOW]
  ]) {
    const { r, text } = await get('/gr/stores/kotsovolos-gr/', { LINKWISE_CODE: CODE, LINKWISE_PRICES: value }, { now });
    assert.equal(r.status, 200, why);
    assert.equal(priceTags(text).length, 0, `${why}: no price`);
    assert.ok(!/€/.test(visible(text)), `${why}: no euro sign`);
    assert.ok(visible(text).includes('δεν παρακολουθούμε τιμές') || visible(text).includes('Δεν πουλάμε τίποτα'), `${why}: the note without prices`);
    assert.ok([...text.matchAll(/href="https:\/\/go\.linkwi\.se\//g)].length >= items(KOTS).length, `${why}: every idea is still there`);
  }
});

test('L227: prices only on the pages of the direct stores (/gr/): never Amazon, the UK page, the 7 Greek stores, the home or legal pages, or without the code', async () => {
  const env = { LINKWISE_CODE: CODE, LINKWISE_PRICES: secret(), AMAZON_LINKS: 'on' };
  for (const [path, cc] of [['/', 'GB'], ['/', 'GR'], ['/gr/', 'GR'], ['/gr/stores/kouzinika-gr/', 'GR'], ['/gr/stores/parex-gr/', 'GR'], ['/stores/amazon/', 'GB'],
    ['/about/', 'GB'], ['/how-we-make-money/', 'GR'], ['/stores/kotsovolos-gr/', 'US'], ['/stores/kotsovolos-gr/', 'GB']]) {
    const { text } = await get(path, env, { cc });
    assert.equal(priceTags(text).length, 0, `${path} ${cc}: no price`);
    // (The UK page keeps the retailers' own code lines in pounds, L191: no euro anywhere.)
    assert.ok(!/€/.test(visible(text)), `${path} ${cc}: no euro sign`);
  }
  // Without our Linkwise code there are no direct pages, so no prices either.
  const off = await get('/gr/stores/kotsovolos-gr/', { LINKWISE_PRICES: secret() });
  assert.equal(off.r.status, 404);
  assert.equal(priceTags(off.text).length, 0);
  // Every store with a feed: its own prices; AB (no feed): none.
  for (const s of DIRECT) {
    const { text } = await get(`/gr/stores/${s.slug}/`, env);
    assert.equal(priceTags(text).length, items(s).length, `${s.slug}: ${items(s).length} prices`);
  }
});

test('L227: the legal pages say "prices" only while some are shown, and name only the stores that have them', async () => {
  const kotsOnly = { LINKWISE_CODE: CODE, LINKWISE_PRICES: secret([KOTS]) };
  const about = visible((await get('/about/?lang=en-GB', kotsOnly)).text);
  assert.ok(about.includes('We show prices only on the pages of Κωτσόβολος: each price comes from the store’s own product feed on Linkwise'), 'about, with prices');
  assert.ok(!about.includes('We do not show prices'), 'not the old sentence');
  const money = visible((await get('/how-we-make-money/?lang=en-GB', kotsOnly)).text);
  assert.ok(money.includes('Prices are shown only on the pages of Κωτσόβολος, from each store’s own product feed on Linkwise'), 'how we make money, with prices');
  for (const env of [{ LINKWISE_CODE: CODE }, { LINKWISE_CODE: CODE, LINKWISE_PRICES: secret(DIRECT, { ago: PRICE_MAX_AGE_MS + 1000 }) }]) {
    const a = visible((await get('/about/?lang=en-GB', env)).text);
    assert.ok(a.includes('We do not show prices') && !a.includes('We show prices only'), 'about, without fresh prices');
    const h = visible((await get('/how-we-make-money/?lang=en-GB', env)).text);
    assert.ok(h.includes('We do not show prices') && !h.includes('Prices are shown only'), 'how we make money, without fresh prices');
  }
  const el = visible((await get('/about/', { LINKWISE_CODE: CODE, LINKWISE_PRICES: secret() })).text);
  assert.ok(el.includes('Δείχνουμε τιμές μόνο στις σελίδες των καταστημάτων Κωτσόβολος, Public, Sephora, e-shop.gr:'), 'Greek, the 4 stores with a feed (not AB)');
});
