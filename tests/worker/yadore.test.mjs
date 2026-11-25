// Lessons L232 (Manager, 25 Nov 2026): Yadore (pay per click) on the 13 sites, first the Greek market in the categories
// that are empty in the Greek view. Live not before Wed 2 Dec 2026 18:00 (UK), only with the Worker secret YADORE_API_KEY,
// few stores, few and steady clicks a day, the same product of the same store once, never the 5 big Linkwise stores,
// Amazon, Aliexpress or Panora, rel="sponsored nofollow", a note that we are paid for each click, no L107 word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { useClock } from '../../src/lib/visibility.js';
import {
  YADORE_FROM, YADORE_STORES, YADORE_CAPS, useYadoreStores, storeKey, neverStore, storeAllowed, readOffers,
  dedupe, pickOffers, capsFor, yadoreMarket, categoryWords, placementId, linkKey, signLink, readLink, yadoreClick, L107_WORDS,
  CLICK_PREFIX, storeLabel
} from '../../src/lib/yadore.js';
import { YADORE_WORDS } from '../../src/lib/yadore-words.js';
import { yadoreSection } from '../../src/pages/listing.js';
import { translatableTexts } from './i18n-keys.mjs';
import { toString as htmlText } from '../../src/lib/html.js';

const read = f => readFileSync(f, 'utf8');
const SITES = readdirSync('sites').filter(n => existsSync(`sites/${n}/site.config.js`) && existsSync(`sites/${n}/public/assets/site.js`));
const config = {};
for (const s of SITES) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const tgw = config.tgw;
const ggw = config.ggw;

const DAY = Date.parse('2026-12-03T10:00:00Z'); // the day after the start: every seed product is older than 30 days
// The clock moves 30 seconds with every click of click() (at most one Yadore click per site in 10 seconds).
let NOW = DAY;
const clock = () => NOW;
useClock(clock);
const STORES = { gr: ['alpha.gr', 'beta.gr', 'gamma.gr', 'public.gr', 'shopflix.gr', 'amazon.de'] };
useYadoreStores(STORES);

const KEY = 'test-key-0123456789abcdef';
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const QA = 'GearWorldQA-bot/1.0 (+read-only check)';
const L107 = /\bshop|\bcart\b|\bsale\b|\bdeals?\b|\bofficial\b|\bpartner|lowest price|% off|\bsave\b/i;

function memD1(schema, seed) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(schema);
  if (seed) sql.exec(seed);
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: t => stmt(t), batch: async list => Promise.all(list.map(s => s.all())) };
}
const tgwDb = () => memD1(readdirSync('sites/tgw/migrations').sort().map(f => read(`sites/tgw/migrations/${f}`)).join('\n'), read('tests/fixtures/tgw-seed.sql'));
const ggwDb = () => memD1(read('tests/fixtures/ggw-legacy-schema.sql'), read('tests/fixtures/ggw-seed.sql'));

let N = 0;
function offer(store, extra = {}) {
  N++;
  return {
    id: `o${N}`, title: `Laptop Vector ${N} 16GB 512GB`, description: 'x', promoText: 'Black Friday SALE -50%', brand: 'Vector',
    clickUrl: `https://api.yadore.com/v2/r/abc${N}?placementId=x`, availability: 'AVAILABLE',
    merchant: { id: 'f'.repeat(64), name: store, logo: { url: 'https://img.yadore.com/l.png', exists: true } },
    price: { amount: `${500 + N}.90`, currency: 'EUR' }, originalPrice: { amount: '999.00', currency: 'EUR' },
    estimatedCpc: { amount: '0.25', currency: 'EUR' }, thumbnail: { url: `https://img.example.gr/${N}.jpg` }, image: { url: `https://img.example.gr/${N}-big.jpg` },
    ...extra
  };
}
function yadoreApi(answer) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: new URL(url), headers: init && init.headers });
    const a = typeof answer === 'function' ? answer(new URL(url)) : answer;
    if (a instanceof Response) return a;
    return new Response(JSON.stringify(a), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  fn.calls = calls;
  return fn;
}
const fullAnswer = () => ({ count: 9, total: 9, offers: [
  offer('alpha.gr'), offer('alpha.gr'), offer('alpha.gr'), offer('beta.gr'), offer('www.Beta.gr'),
  offer('gamma.gr'), offer('public.gr'), offer('amazon.de'), offer('other.gr'), offer('shopflix.gr')
] });

function request(site, path, { country = 'GR', ua = BROWSER, headers = {}, host = site.domain } = {}) {
  const req = new Request(`https://${host}${path}`, { headers: { 'User-Agent': ua, ...headers } });
  if (country) Object.defineProperty(req, 'cf', { value: { country } });
  return req;
}
async function get(site, env, path, opts) {
  const res = await createWorker(site).fetch(request(site, path, opts), env, { waitUntil: p => p });
  return { res, text: await res.text() };
}
const tokens = text => [...text.matchAll(/href="\/out\/y\/([A-Za-z0-9_.-]+)"/g)].map(m => m[1]);
const box = text => {
  const i = text.indexOf('<section class="yd-box"');
  return i < 0 ? '' : text.slice(i, text.indexOf('</section>', i) + 10);
};

test('L232: the live code ships with no store at all, so nothing shows until the stores are chosen from the read-only plan', () => {
  assert.deepEqual(Object.keys(YADORE_STORES), ['gr']);
  assert.deepEqual([...YADORE_STORES.gr], []);
  assert.equal(new Date(YADORE_FROM).toISOString(), '2026-12-02T18:00:00.000Z', 'Wed 2 Dec 2026 18:00 UK time');
  assert.deepEqual(YADORE_CAPS.map(c => ({ ...c })), [{ from: '2026-12-02', site: 15, store: 5 }], 'few and steady clicks: 15 a day per site, 5 per store');
  assert.equal(capsFor(Date.parse('2026-12-01T23:00:00Z')), null, 'no clicks before the start day');
  assert.equal(capsFor(DAY).site, 15);
});

test('L232: never the 5 big Linkwise stores, Amazon, Aliexpress or Panora, nor a store name with an L107 word', () => {
  for (const n of ['public.gr', 'www.public.gr', 'Public', 'Public GR', 'Public Greece', 'sephora.gr', 'Sephora Greece', 'Kotsovolos GR', 'e-shop.gr', 'ab.gr', 'AB Vasilopoulos', 'ΑΒ Βασιλόπουλος', 'kotsovolos.gr', 'Κωτσόβολος',
    'amazon.de', 'Amazon.co.uk', 'amazon', 'aliexpress.com', 'panora.gr', '']) assert.equal(neverStore(n), true, n);
  for (const n of ['alpha.gr', 'plaisio.gr', 'publicis.gr', 'kotsovolos-fan.example'.replace('kotsovolos', 'kots')]) assert.equal(neverStore(n), false, n);
  const env = {};
  assert.equal(storeAllowed(env, 'gr', 'public.gr'), false, 'on the test list, still never');
  assert.equal(storeAllowed(env, 'gr', 'amazon.de'), false);
  assert.equal(storeAllowed(env, 'gr', 'shopflix.gr'), false, 'a name with "shop" (L107)');
  assert.equal(storeAllowed(env, 'gr', 'other.gr'), false, 'not on the list');
  assert.equal(storeAllowed(env, 'gr', 'WWW.Alpha.GR'), true);
  assert.equal(storeAllowed(env, 'uk', 'alpha.gr'), false, 'the list is per market');
  assert.equal(storeAllowed({ YADORE_PAUSE: 'beta.gr, alpha.gr' }, 'gr', 'alpha.gr'), false, 'paused at once (300-click rule)');
  assert.equal(storeKey(' https://www.Alpha.gr/x '), 'alpha.gr');
  assert.equal(storeLabel('Tsakiris Mallas GR'), storeLabel('tsakirismallas.gr'));
});

test('L232: only offers that may be shown: a Yadore https link, a price, a photo, in stock, a title without an L107 word', () => {
  N = 0;
  const env = {};
  const good = offer('alpha.gr');
  const list = [good,
    offer('alpha.gr', { clickUrl: 'https://evil.example/r' }), offer('alpha.gr', { clickUrl: 'http://api.yadore.com/r' }),
    offer('alpha.gr', { price: { amount: '0', currency: 'EUR' } }), offer('alpha.gr', { price: { amount: 'x', currency: 'EUR' } }),
    offer('alpha.gr', { availability: 'UNAVAILABLE' }), offer('alpha.gr', { availability: 'PREORDER' }),
    offer('alpha.gr', { title: 'Laptop Black Friday SALE' }), offer('alpha.gr', { title: 'Best deals laptop' }), offer('alpha.gr', { title: '' }),
    offer('alpha.gr', { thumbnail: null, image: { url: 'http://img.example.gr/x.jpg' } }),
    offer('other.gr'), offer('public.gr'), null, 'x'];
  const out = readOffers({ offers: list }, env, 'gr');
  assert.equal(out.length, 1);
  assert.deepEqual(Object.keys(out[0]).sort(), ['click', 'cpc', 'currency', 'image', 'price', 'store', 'title']);
  assert.equal(out[0].price, 501.9);
  assert.equal(out[0].image, 'https://img.example.gr/1.jpg', 'the thumbnail');
  assert.equal(readOffers({ offers: [offer('alpha.gr', { availability: 'UNKNOWN' })] }, env, 'gr').length, 1, 'unknown stock is shown (no stock claim on the card)');
  assert.deepEqual(readOffers(null, env, 'gr'), []);
  assert.ok(!JSON.stringify(out).includes('SALE'), 'no promoText');
  assert.ok(!JSON.stringify(out).includes('999'), 'no original price ("Was", L107)');
});

test('L232: the same product of the same store once, with the link that pays more; a product our own retailer lists keeps our card', () => {
  const a = { store: 'alpha.gr', title: 'Laptop X 16GB', cpc: 0.1 };
  const b = { store: 'www.alpha.gr', title: 'LAPTOP  x 16gb', cpc: 0.3 };
  const c = { store: 'beta.gr', title: 'Laptop X 16GB', cpc: 0.2 };
  const d = { store: 'tsakirismallas.gr', title: 'Φόρεμα Μάξι', cpc: 0.5 };
  const kept = dedupe([a, b, c, d], [{ retailer: 'Tsakiris Mallas GR', product_name: 'φορεμα μαξι' }]);
  assert.deepEqual(kept, [b, c]);
});

test('L232: the box takes the words in turn, at most 2 offers per store and 8 in all, and none from a store whose clicks of the day are used up', () => {
  const mk = (s, n) => Array.from({ length: n }, (_, i) => ({ store: s, title: `${s} ${i}` }));
  const cap = { site: 15, store: 5 };
  const none = { total: 0, byStore: new Map() };
  const picked = pickOffers([[...mk('a.gr', 3), ...mk('b.gr', 3)], [...mk('c.gr', 3), ...mk('d.gr', 2), ...mk('e.gr', 2)]], none, cap);
  assert.equal(picked.length, 8);
  for (const s of ['a.gr', 'b.gr', 'c.gr', 'd.gr', 'e.gr']) assert.ok(picked.filter(o => o.store === s).length <= 2, s);
  assert.deepEqual(picked.slice(0, 2).map(o => o.title), ['a.gr 0', 'c.gr 0'], 'the words in turn');
  const full = pickOffers([mk('a.gr', 2), mk('b.gr', 2)], { total: 5, byStore: new Map([['a.gr', 5]]) }, cap);
  assert.deepEqual(full.map(o => o.store), ['b.gr', 'b.gr']);
  assert.deepEqual(pickOffers([mk('a.gr', 2)], { total: 15, byStore: new Map() }, cap), [], 'the site\'s clicks of the day used up');
  assert.deepEqual(pickOffers([mk('a.gr', 2)], none, null), [], 'no cap = before the start');
});

test('L232: the market: the key, the day, a Yadore market of ours, stores on its list and words for the category', () => {
  const cat = tgw.categories[0];
  const env = { YADORE_API_KEY: KEY };
  assert.equal(yadoreMarket(tgw, env, cat, 'GR', DAY), 'gr');
  assert.equal(yadoreMarket(tgw, {}, cat, 'GR', DAY), '', 'no key');
  assert.equal(yadoreMarket(tgw, { YADORE_API_KEY: 'short' }, cat, 'GR', DAY), '', 'not a key');
  assert.equal(yadoreMarket(tgw, env, cat, 'GR', YADORE_FROM - 1), '', 'not before 2 Dec 18:00');
  for (const cc of ['GB', 'CY', 'US', 'DE', '', null]) assert.equal(yadoreMarket(tgw, env, cat, cc, DAY), '', String(cc));
  const agw = config.agw;
  assert.equal(yadoreMarket(agw, env, agw.categories.find(c => c.slug === 'tyres-wheels'), 'GR', DAY), '', 'AGW tyres: no words (Manager, 25 Nov)');
  useYadoreStores({ gr: [] });
  assert.equal(yadoreMarket(tgw, env, cat, 'GR', DAY), '', 'no store on the list: nothing');
  useYadoreStores(STORES);
  assert.equal(placementId(tgw, 'gr', cat), `tgw-gr-${cat.slug}`);
});

test('L232: words exactly for the Manager\'s list (25 Nov): CGW, Pets, Gaming, Biker, Sporty, Travel, Tech, AGW but tyres, GGW furniture/buildings/power tools, Smart Home, Kids Tech', () => {
  const all = s => config[s].categories.map(c => c.slug);
  const expected = {
    cgw: all('cgw'), zgw: all('zgw'), pgw: all('pgw'), bgw: all('bgw'), sgw: all('sgw'), vgw: all('vgw'), tgw: all('tgw'),
    agw: all('agw').filter(x => x !== 'tyres-wheels'),
    ggw: ['power-garden-tools', 'garden-furniture-outdoor-living', 'garden-buildings-fencing-storage'],
    hgw: ['smart-home'], kgw: ['kids-tech']
  };
  assert.deepEqual(Object.keys(YADORE_WORDS.gr).sort(), Object.keys(expected).sort(), 'no words for MGW and WGW (Greek retailers)');
  for (const [s, slugs] of Object.entries(expected)) {
    const site = config[s];
    assert.deepEqual(Object.keys(YADORE_WORDS.gr[s]).sort(), [...slugs].sort(), s);
    for (const c of site.categories) {
      const w = categoryWords(site, c, 'gr');
      if (!slugs.includes(c.slug)) { assert.deepEqual(w, [], `${s}/${c.slug}: no box`); continue; }
      assert.ok(w.length >= 1 && w.length <= 2, `${s}/${c.slug}`);
      for (const x of w) assert.ok(!L107_WORDS.test(x) && x.length <= 60, `${s}/${c.slug}: ${x}`);
    }
  }
  for (const s of ['mgw', 'wgw']) for (const c of config[s].categories) assert.deepEqual(categoryWords(config[s], c, 'gr'), [], `${s}/${c.slug}`);
});

test('L232: links are signed with a key made from the API key and the site, carry only a Yadore address, and fail when changed', async () => {
  const key = await linkKey({ YADORE_API_KEY: KEY }, tgw);
  const other = await linkKey({ YADORE_API_KEY: KEY + 'x' }, tgw);
  const pgwKey = await linkKey({ YADORE_API_KEY: KEY }, config.pgw);
  assert.equal(await linkKey({}, tgw), null);
  const payload = { u: 'https://api.yadore.com/v2/r/abc?x=1', m: 'Άλφα.gr', c: 'laptops-computing', k: 'gr', t: Math.floor(DAY / 1000) };
  const token = await signLink(key, payload);
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
  assert.deepEqual(await readLink(key, token), { url: payload.u, store: 'Άλφα.gr', category: 'laptops-computing', market: 'gr', at: payload.t * 1000 });
  assert.equal(await readLink(other, token), null, 'another key');
  assert.equal(await readLink(pgwKey, token), null, 'a TGW link does not work on PGW');
  const flip = (t, i) => t.slice(0, i) + (t[i] === 'A' ? 'B' : 'A') + t.slice(i + 1);
  assert.equal(await readLink(key, flip(token, 20)), null, 'changed in the middle');
  // Every letter of the token changed one by one (the last one has spare bits: only one spelling is accepted).
  for (let i = 0; i < token.length; i++) assert.equal(await readLink(key, flip(token, i)), null, `letter ${i} changed`);
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_') {
    const t2 = token.slice(0, -1) + c;
    if (t2 !== token) assert.equal(await readLink(key, t2), null, `last letter ${c}`);
  }
  // A link of the earlier signed form (body.signature) is refused, and its click goes to the home page.
  assert.equal(await readLink(key, `${'a'.repeat(40)}.${'b'.repeat(32)}`), null);
  assert.equal(await readLink(key, token.slice(0, -4)), null, 'cut short');
  // Encrypted: Yadore's address and the store cannot be read from the token (round 3 of the review).
  const bin = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
  assert.ok(!/yadore|api\.|https|laptops/i.test(bin), 'nothing readable in the token');
  assert.notEqual(await signLink(key, payload), token, 'a new random IV every time');
  const evil = await signLink(key, { ...payload, u: 'https://evil.example/' });
  assert.equal(await readLink(key, evil), null, 'a signed address that is not Yadore');
  assert.equal(await readLink(key, 'not-a-token'), null);
});

test('L232: a Greek visitor on an empty TGW category gets the box: 2 per store, sponsored links, the note and the date', async () => {
  N = 0;
  const api = yadoreApi(fullAnswer);
  const env = { DB: tgwDb(), YADORE_API_KEY: KEY, YADORE_FETCH: api, CLICK_LOG: '', FX_FETCH: async () => { throw new Error('offline'); } };
  const { res, text } = await get(tgw, env, '/category/laptops-computing/');
  assert.equal(res.status, 200);
  const b = box(text);
  assert.ok(b, 'the box');
  assert.match(b, /data-yadore="gr"/);
  assert.match(b, /<h2 id="yd-h"><span data-i18n="More from other stores">More from other stores<\/span> <span class="badge"><span data-i18n="Sponsored">Sponsored<\/span><\/span><\/h2>/);
  assert.match(b, /These offers come through <span translate="no">Yadore<\/span>, which pays us for each click, at no extra cost to you\. Prices checked 3 Dec 2026, may change\./);
  assert.match(b, /data-i18n-1-date="2026-12-03"/);
  const cards = b.split('<article class="label-card">').length - 1;
  assert.equal(cards, 6, 'alpha 2, beta 2 (www.Beta.gr is the same store), gamma 2; public, amazon, other and shopflix never');
  const names = [...b.matchAll(/<span class="retailer" translate="no">([^<]+)<\/span>/g)].map(m => storeKey(m[1]));
  assert.deepEqual(names.slice().sort(), ['alpha.gr', 'alpha.gr', 'beta.gr', 'beta.gr', 'gamma.gr', 'gamma.gr']);
  // Every link: our own /out/y/, sponsored nofollow, a new tab; no Yadore address, no iframe, no L107 word, no old price.
  assert.equal((b.match(/rel="sponsored nofollow noopener" target="_blank"/g) || []).length, cards * 2, 'button and photo');
  assert.ok(!/api\.yadore\.com|<iframe/i.test(b));
  assert.ok(!L107.test(b.replace(/<[^>]+>/g, ' ')), 'no L107 word');
  assert.ok(!/999|SALE|promo/i.test(b));
  assert.equal(tokens(b).length, cards * 2);
  // The page itself: noindex (no own product), the "Coming soon" text after the box.
  assert.match(text, /<meta name="robots" content="noindex,follow">/);
  assert.ok(text.indexOf('yd-box') < text.indexOf('data-empty-category'));
  // What Yadore was asked: the two words of the category, market gr, our placement id, with the key in the header only.
  assert.equal(api.calls.length, 2);
  assert.deepEqual(api.calls.map(c => c.url.searchParams.get('keyword')), ['laptop', 'mini pc']);
  for (const c of api.calls) {
    assert.equal(c.url.origin + c.url.pathname, 'https://api.yadore.com/v2/offer');
    assert.equal(c.url.searchParams.get('market'), 'gr');
    assert.equal(c.url.searchParams.get('placementId'), 'tgw-gr-laptops-computing');
    assert.equal(c.url.searchParams.get('limit'), '30');
    assert.equal(c.headers['API-Key'], KEY);
    assert.ok(!c.url.toString().includes(KEY), 'never in the address');
  }
  assert.ok(!text.includes(KEY), 'never on the page');
});

test('L232: no box for the UK, Cyprus, Google, the Group\'s ?for=GR browsing, before the start, without a key, on page 2 or with filters', async () => {
  const api = yadoreApi(fullAnswer);
  const env = { DB: tgwDb(), YADORE_API_KEY: KEY, YADORE_FETCH: api, FX_FETCH: async () => { throw new Error('offline'); } };
  const path = '/category/laptops-computing/';
  for (const cc of ['GB', 'CY', 'US', 'DE']) assert.equal(box((await get(tgw, env, path, { country: cc })).text), '', cc);
  assert.equal(box((await get(tgw, env, path, { country: 'GR', ua: GOOGLEBOT })).text), '', 'Google counts as the UK');
  assert.equal(box((await get(tgw, env, path, { country: 'GB', headers: { Cookie: 'gw_for=GR' } })).text), '', 'browsing as Greece from the UK');
  assert.equal(box((await get(tgw, env, path, { country: 'GR', headers: { Cookie: 'gw_for=GR' } })).text), '', 'browsing: never');
  for (const q of ['?sort=price_asc', '?brand=Lenovo', '?stock=1', '?page=2']) assert.equal(box((await get(tgw, env, path + q)).text), '', q);
  assert.equal(api.calls.length, 0, 'Yadore was not even asked');
  assert.equal(box((await get(tgw, { ...env, YADORE_API_KEY: '' }, path)).text), '', 'no key');
  useClock(() => YADORE_FROM - 60000);
  assert.equal(box((await get(tgw, env, path)).text), '', 'one minute before the start');
  useClock(clock);
  assert.equal(api.calls.length, 0);
  // The network's own read-only check sees the Greek page (L158), with the box.
  assert.ok(box((await get(tgw, env, path, { country: 'US', ua: QA, headers: { 'X-GW-QA-Country': 'GR' } })).text));
});

test('L232: with our own products on the page the box goes above our list, apart from it, and our list keeps its order', async () => {
  N = 0;
  const api = yadoreApi(fullAnswer);
  const DB = tgwDb();
  DB.sql.exec("UPDATE products SET last_seen_at = '2026-12-03 09:00:00'");
  const env = { DB, YADORE_API_KEY: KEY, YADORE_FETCH: api, FX_FETCH: async () => { throw new Error('offline'); } };
  const path = '/category/laptops-computing/';
  const gr = (await get(tgw, env, path)).text;
  const uk = (await get(tgw, env, path, { country: 'GB' })).text;
  const b = box(gr);
  assert.ok(b, 'the box');
  const own = gr.indexOf('<h2 class="visually-hidden">');
  assert.ok(own > 0 && gr.indexOf('yd-box') < own, 'above our list');
  const ownIds = t => [...t.matchAll(/href="\/out\/(\d+)"/g)].map(m => m[1]);
  assert.ok(ownIds(gr).length > 0);
  // Our own list is exactly the list of the same Greek page without the box (no key): same products, same order.
  const plain = (await get(tgw, { ...env, YADORE_API_KEY: '' }, path)).text;
  assert.equal(box(plain), '');
  assert.deepEqual(ownIds(gr), ownIds(plain));
  // Above the results bar ("N products", sort), so it never reads as part of our list.
  assert.ok(gr.includes('<p class="result-count">') && gr.indexOf('yd-box') < gr.indexOf('<p class="result-count">'), 'above "N products"');
  assert.ok(!/href="\/out\/\d/.test(b), 'no card of ours inside the box');
  assert.equal(box(uk), '');
});

test('L232: a category with no words (HGW furniture, every MGW and WGW category) never asks Yadore', async () => {
  const api = yadoreApi(fullAnswer);
  const env = { DB: memD1(read('tests/fixtures/ggw-legacy-schema.sql'), read('tests/fixtures/ggw-seed.sql')), YADORE_API_KEY: KEY, YADORE_FETCH: api, FX_FETCH: async () => { throw new Error('offline'); } };
  for (const [site, slug] of [[config.hgw, 'furniture'], [config.mgw, 'watches'], [config.wgw, 'shoes'], [config.ggw, 'bbq-outdoor-cooking'], [config.agw, 'tyres-wheels']]) {
    const r = await createWorker(site).fetch(request(site, `/category/${slug}/`), env, { waitUntil: p => p });
    assert.equal(box(await r.text()), '', `${site.code} ${slug}`);
  }
  assert.equal(api.calls.length, 0);
});

test('L232: a slow, failing or strange Yadore never breaks the page', async () => {
  const path = '/category/audio/';
  const base = { DB: tgwDb(), YADORE_API_KEY: KEY, FX_FETCH: async () => { throw new Error('offline'); } };
  const answers = [
    new Response('nope', { status: 500 }), new Response('{"errors":{"auth":["bad"]}}', { status: 400 }),
    new Response('not json', { status: 200 }), { offers: 'x' }, { offers: [] }
  ];
  for (const a of answers) {
    const { res, text } = await get(tgw, { ...base, YADORE_FETCH: yadoreApi(() => (a instanceof Response ? a.clone() : a)) }, path);
    assert.equal(res.status, 200);
    assert.equal(box(text), '');
    assert.match(text, /data-empty-category/);
  }
  const thrown = await get(tgw, { ...base, YADORE_FETCH: async () => { throw new Error('network'); } }, path);
  assert.equal(thrown.res.status, 200);
  const slow = await get(tgw, { ...base, YADORE_FETCH: (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) }, path);
  assert.equal(slow.res.status, 200, 'the 2.5 s timeout');
});

test('L232: the Greek copy of the page is kept apart, and Yadore\'s answer is kept an hour, never under a public address', async () => {
  N = 0;
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  try {
    const api = yadoreApi(fullAnswer);
    const env = { DB: tgwDb(), YADORE_API_KEY: KEY, YADORE_FETCH: api, FX_FETCH: async () => { throw new Error('offline'); } };
    const path = '/category/cameras-drones/';
    assert.ok(box((await get(tgw, env, path)).text));
    const keys = [...store.keys()];
    assert.ok(keys.some(k => /\/category\/cameras-drones\/\?gw-view=[^&]+&gw-extra=yd-gr$/.test(k)), keys.join(' '));
    assert.ok(keys.some(k => k.startsWith('https://technologygearworld.com/api/yadore-cache?')));
    // Another country of the same view group gets its own copy, without the box.
    assert.equal(box((await get(tgw, env, path, { country: 'CY' })).text), '');
    assert.equal(box((await get(tgw, env, path, { country: 'GB' })).text), '');
    // A second Greek visitor: the page copy; and once the page copy is gone, Yadore's kept answer (no new question).
    const asked = api.calls.length;
    assert.ok(box((await get(tgw, env, path)).text));
    for (const k of keys) if (k.includes('/category/')) store.delete(k);
    assert.ok(box((await get(tgw, env, path)).text));
    assert.equal(api.calls.length, asked);
    // The kept answer is never a page: /api/yadore-cache answers 404 like any unknown /api/ address.
    const cachePath = new URL(keys.find(k => k.includes('/api/yadore-cache'))).pathname;
    assert.equal((await get(tgw, env, cachePath)).res.status, 404);
  } finally {
    globalThis.caches = before;
  }
});

async function pageTokens(site, env, path) {
  const { text } = await get(site, env, path);
  return tokens(box(text));
}
async function click(site, env, token, opts = {}) {
  NOW += 30000;
  return clickNow(site, env, token, opts);
}
async function clickNow(site, env, token, opts = {}) {
  const res = await createWorker(site).fetch(request(site, `/out/y/${token}`, { ...opts, headers: { Referer: `https://${site.domain}/category/x/`, ...(opts.headers || {}) } }), env, { waitUntil: p => p });
  return res;
}

test('L232: a click goes to the store through Yadore once recorded; a bot, the UK, a test address, a changed link go back to the page', async () => {
  N = 0;
  const env = { DB: tgwDb(), YADORE_API_KEY: KEY, YADORE_FETCH: yadoreApi(fullAnswer), FX_FETCH: async () => { throw new Error('offline'); } };
  const [t] = await pageTokens(tgw, env, '/category/laptops-computing/');
  const res = await click(tgw, env, t);
  assert.equal(res.status, 302);
  assert.match(res.headers.get('Location'), /^https:\/\/api\.yadore\.com\/v2\/r\/abc\d+\?placementId=x$/);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(res.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin', 'Yadore sees our domain');
  const rows = env.DB.sql.prepare('SELECT * FROM affiliate_clicks').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].retailer, `${CLICK_PREFIX}alpha.gr`);
  assert.equal(rows[0].category_slug, 'laptops-computing');
  assert.equal(rows[0].country_code, 'GR');
  assert.equal(rows[0].click_ref, 'tgw-yd-gr-laptops-computing');
  assert.equal(rows[0].page_path, '/category/x/');
  assert.equal(rows[0].product_id, 0);
  const back = '/category/laptops-computing/';
  for (const [name, opts] of [['UK', { country: 'GB' }], ['Cyprus', { country: 'CY' }], ['no country', { country: '' }], ['Googlebot', { ua: GOOGLEBOT }],
    ['a bot', { ua: 'curl/8.0' }], ['no user agent', { ua: '' }], ['QA check', { ua: QA, headers: { 'X-GW-QA-Country': 'GR' } }],
    ['test address', { host: 'technology-gear-world-preview.example.workers.dev' }]]) {
    const r = await click(tgw, env, t, opts);
    assert.equal(r.status, 302, name);
    assert.equal(new URL(r.headers.get('Location')).pathname, back, name);
  }
  assert.equal(new URL((await click(tgw, { ...env, CLICK_LOG: 'off' }, t)).headers.get('Location')).pathname, back, 'CLICK_LOG off');
  assert.equal(new URL((await click(tgw, env, t.slice(0, 30) + (t[30] === 'A' ? 'B' : 'A') + t.slice(31))).headers.get('Location')).pathname, '/', 'changed link');
  assert.equal(new URL((await click(tgw, { ...env, YADORE_API_KEY: '' }, t)).headers.get('Location')).pathname, '/', 'no key');
  assert.equal(new URL((await click(tgw, { ...env, YADORE_PAUSE: 'alpha.gr' }, t)).headers.get('Location')).pathname, back, 'paused store');
  useClock(() => DAY + 27 * 3600 * 1000);
  assert.equal(new URL((await click(tgw, env, t)).headers.get('Location')).pathname, back, 'a link older than 26 hours');
  useClock(clock);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM affiliate_clicks').get().n, 1, 'nothing else recorded');
  // A HEAD request (a link checker) never goes to Yadore either.
  const head = await createWorker(tgw).fetch(Object.defineProperty(new Request(`https://${tgw.domain}/out/y/${t}`, { method: 'HEAD', headers: { 'User-Agent': BROWSER } }), 'cf', { value: { country: 'GR' } }), env, { waitUntil: p => p });
  assert.equal(new URL(head.headers.get('Location')).pathname, back);
});

test('L232: few and steady clicks: 5 a day per store and 15 per site, then the box leaves that store out and its links go back', async () => {
  N = 0;
  const env = { DB: tgwDb(), YADORE_API_KEY: KEY, YADORE_FETCH: yadoreApi(fullAnswer), FX_FETCH: async () => { throw new Error('offline'); } };
  const ins = env.DB.sql.prepare("INSERT INTO affiliate_clicks (product_id, awin_advertiser_id, retailer, category_slug, page_path, country_code, click_ref, clicked_at) VALUES (0, 0, ?, 'x', '', 'GR', 'x', ?)");
  for (let i = 0; i < 4; i++) ins.run(`${CLICK_PREFIX}alpha.gr`, '2026-12-03 08:00:00');
  ins.run(`${CLICK_PREFIX}alpha.gr`, '2026-12-02 23:59:59');
  const toks = await pageTokens(tgw, env, '/category/laptops-computing/');
  const first = await click(tgw, env, toks[0]);
  assert.match(first.headers.get('Location'), /^https:\/\/api\.yadore\.com\//, 'the 5th click of today (yesterday\'s does not count)');
  const sixth = await click(tgw, env, toks[1]);
  assert.equal(new URL(sixth.headers.get('Location')).pathname, '/category/laptops-computing/', 'the 6th of the same store goes back');
  // A new page copy leaves alpha.gr out of the box.
  const names = [...box((await get(tgw, env, '/category/audio/')).text).matchAll(/<span class="retailer" translate="no">([^<]+)<\/span>/g)].map(m => storeKey(m[1]));
  assert.ok(names.length && !names.includes('alpha.gr'), names.join(','));
  // The site's 15 of the day: no box at all, and every link goes back.
  for (let i = 0; i < 10; i++) ins.run(`${CLICK_PREFIX}beta.gr`, '2026-12-03 09:00:00');
  assert.equal(box((await get(tgw, env, '/category/gaming/')).text), '');
  for (const t of toks) assert.equal(new URL((await click(tgw, env, t)).headers.get('Location')).pathname, '/category/laptops-computing/');
});

test('L232: an older site (GGW, older database layout) shows the box and records the click in its own click table', async () => {
  N = 0;
  const env = { DB: ggwDb(), YADORE_API_KEY: KEY, YADORE_FETCH: yadoreApi(fullAnswer), FX_FETCH: async () => { throw new Error('offline'); } };
  const path = '/category/garden-furniture-outdoor-living/';
  const toks = await pageTokens(ggw, env, path);
  assert.ok(toks.length >= 2);
  const r = await click(ggw, env, toks[0]);
  assert.match(r.headers.get('Location'), /^https:\/\/api\.yadore\.com\//);
  const rows = env.DB.sql.prepare("SELECT retailer, site_category, product_name, country_code, source FROM affiliate_clicks WHERE retailer LIKE 'Yadore%'").all().map(x => ({ ...x }));
  assert.deepEqual(rows, [{ retailer: `${CLICK_PREFIX}alpha.gr`, site_category: 'Garden Furniture & Outdoor Living', product_name: 'Yadore gr', country_code: 'GR', source: 'yadore_click' }], 'its own source: the retailer click reports stay as they were');
});

test('L232: the box\'s texts and the new texts of the about, money, privacy and cookies pages are in all 143 dictionaries', async () => {
  const yd = { market: 'gr', checked: '2026-12-03', offers: [{ title: 'T', store: 'alpha.gr', price: 10, currency: 'EUR', image: 'https://i.example/x.jpg', href: '/out/y/x' }] };
  const keys = new Set(translatableTexts(`<body>${htmlText(yadoreSection(tgw, yd))}</body>`));
  assert.deepEqual([...keys].sort(), ['More from other stores', 'Sponsored', 'These offers come through {0}, which pays us for each click, at no extra cost to you. Prices checked {1}, may change.', 'View at {0}']);
  const { infoPage } = await import('../../src/pages/info.js');
  const NEW = [
    'In some categories, a box marked "Sponsored" shows offers from other stores through Yadore, with the date their prices were checked.',
    'In some categories, a box marked "Sponsored" shows offers from other stores through Yadore (Yadore GmbH, Germany). Those stores pay Yadore for each click, and Yadore pays us a share. You pay the same price as you would if you went to the store directly.',
    'On page 1 of some categories, a box marked "Sponsored" is shown above our own list and does not change it. Its offers come in Yadore\'s order for the words of the category, at most two per store, and when a store\'s offer comes twice we keep the copy that pays more per click.',
    'We do not rank products by commission. The default order mixes products in stock first, and you can sort by price, newest or furthest below RRP at any time. A retailer cannot pay to change a price or a product\'s position in our own list.',
    'Sponsored offers.',
    'When you select a button in the box marked "Sponsored", we record the store, the page you were on, the date and your country in the same way, and you go to the store through Yadore (Yadore GmbH, Germany), which records the click so that the store pays for it. To keep these clicks real, a one-way scrambled (hashed) form of your IP address is kept in our hosting provider\'s cache until the end of that day, only to count your clicks in the box (legitimate interests).',
    'Links in the box marked "Sponsored" go through Yadore (Yadore GmbH, Germany). Yadore and the store may set their own cookies to record the click. Their privacy policies apply on their websites.',
    'Yadore privacy policy',
    'When you select a button in the box marked "Sponsored", Yadore and the store may set cookies on their own websites to record the click.'
  ];
  const texts = new Set();
  for (const p of ['/about/', '/how-we-make-money/', '/privacy/', '/cookies/']) for (const k of translatableTexts(String(infoPage(tgw, p)))) texts.add(k);
  for (const k of NEW) { assert.ok(texts.has(k), k); keys.add(k); }
  assert.match(String(infoPage(tgw, '/privacy/')), /<a href="https:\/\/www\.yadore\.com\/en\/privacy\/">Yadore privacy policy<\/a>/);
  let files = 0;
  for (const s of SITES.filter(x => x !== 'group' && x !== 'ogw')) {
    for (const f of readdirSync(`sites/${s}/public/assets/i18n`)) {
      const d = JSON.parse(read(`sites/${s}/public/assets/i18n/${f}`));
      for (const k of keys) {
        assert.ok(typeof d[k] === 'string' && d[k].trim() && d[k] !== k, `${s}/${f}: ${k}`);
        assert.equal((d[k].match(/\{\d\}/g) || []).sort().join(), (k.match(/\{\d\}/g) || []).sort().join(), `${s}/${f}: placeholders of ${k}`);
        if (/Yadore/.test(k)) assert.match(d[k], /Yadore/, `${s}/${f}: the name stays`);
      }
      // The "Sponsored" word of the badge is the one the sentences quote.
      if (f !== 'en-GB.json') for (const k of NEW.filter(x => x.includes('"Sponsored"'))) assert.ok(d[k].includes(d.Sponsored), `${s}/${f}: "${d.Sponsored}" in ${k}`);
      files++;
    }
  }
  assert.equal(files, 143);
});

test('L232: the Hub search answer never carries Yadore offers, and robots.txt keeps /out/ closed', async () => {
  const env = { DB: tgwDb(), YADORE_API_KEY: KEY, YADORE_FETCH: yadoreApi(fullAnswer), FX_FETCH: async () => { throw new Error('offline'); } };
  const api = await get(tgw, env, '/api/products?deliver_to=GR&category=laptops-computing');
  assert.ok(!/yadore|\/out\/y\//i.test(api.text));
  assert.match((await get(tgw, env, '/robots.txt')).text, /Disallow: \/out\//);
});

test('L232: the click endpoint alone (no page): a store taken off the list since, or a token of another market, goes back', async () => {
  const env = { DB: tgwDb(), YADORE_API_KEY: KEY };
  const key = await linkKey(env, tgw);
  const cats = new Map(tgw.categories.map(c => [c.slug, c]));
  const base = { env, site: tgw, country: 'GR', bot: false, preview: false, at: DAY, categories: cats };
  const t = async p => signLink(key, { u: 'https://api.yadore.com/v2/r/1', m: 'alpha.gr', c: 'audio', k: 'gr', t: Math.floor(DAY / 1000), ...p });
  assert.equal((await yadoreClick({ ...base, token: await t({}) })).to, 'https://api.yadore.com/v2/r/1');
  assert.equal((await yadoreClick({ ...base, token: await t({ m: 'other.gr' }) })).to, '/category/audio/');
  assert.equal((await yadoreClick({ ...base, token: await t({ k: 'uk' }) })).to, '/category/audio/');
  assert.equal((await yadoreClick({ ...base, token: await t({ c: 'not-a-category' }) })).to, 'https://api.yadore.com/v2/r/1', 'an unknown category only changes where "back" is');
  assert.equal((await yadoreClick({ ...base, token: await t({ c: 'not-a-category', m: 'other.gr' }) })).to, '/');
  assert.equal((await yadoreClick({ ...base, token: await t({ t: Math.floor(DAY / 1000) + 3600 }) })).to, '/category/audio/', 'a link from the future');
  useYadoreStores({ gr: ['beta.gr'] });
  assert.equal((await yadoreClick({ ...base, token: await t({}) })).to, '/category/audio/', 'taken off the list since');
  useYadoreStores(STORES);
});

// ---- Independent review, round 1 (25 Nov 2026)

test('L232 review: on CGW and PGW Greece shares the "all" copy with Cyprus and France: the Greek copy stays apart, and no address can name it', async () => {
  const { cacheKeyUrl, viewFor } = await import('../../src/lib/visibility.js');
  const pgw = config.pgw;
  assert.equal(viewFor(pgw, 'GR', DAY).group, viewFor(pgw, 'CY', DAY).group, 'the same view group');
  assert.equal(cacheKeyUrl('https://gaminggearworld.com/category/x/?gw-view=gb&gw-extra=yd-gr&gw-stale=1&page=1', viewFor(pgw, 'CY', DAY)),
    'https://gaminggearworld.com/category/x/?page=1&gw-view=all', 'the visitor\'s own gw-* values are dropped');
  N = 0;
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  try {
    const DB = memD1(readdirSync('sites/pgw/migrations').sort().map(f => read(`sites/pgw/migrations/${f}`)).join('\n'), read('tests/fixtures/pgw-seed.sql'));
    const env = { DB, YADORE_API_KEY: KEY, YADORE_FETCH: yadoreApi(fullAnswer), FX_FETCH: async () => { throw new Error('offline'); } };
    const path = '/category/controllers/';
    // Cyprus first, with a made-up address of the Greek copy: it gets its own page, without the box...
    assert.equal(box((await get(pgw, env, `${path}?gw-view=all&gw-extra=yd-gr`, { country: 'CY' })).text), '');
    // ...and the Greek visitor still gets the box (no copy without it was stored under the Greek key).
    assert.ok(box((await get(pgw, env, path)).text));
    // Greece first, then Cyprus and France with or without the made-up address: never the box.
    for (const [cc, q] of [['CY', ''], ['FR', ''], ['CY', '?gw-view=all&gw-extra=yd-gr'], ['FR', '?gw-extra=yd-gr']]) {
      assert.equal(box((await get(pgw, env, path + q, { country: cc })).text), '', `${cc} ${q}`);
    }
  } finally {
    globalThis.caches = before;
  }
});

test('L232 review: page 2 of a category with our own products never shows the box, and a HEAD or a bot from Greece never asks Yadore', async () => {
  const api = yadoreApi(fullAnswer);
  const DB = tgwDb();
  const cols = 'stable_key, awin_advertiser_id, awin_product_id, merchant_product_id, retailer, category_slug, subcategory, brand, product_name, product_slug, description, price, was_price, currency, in_stock, item_condition, image_url, affiliate_url, merchant_category, gtin, mpn, specs_json, first_seen_at, last_seen_at';
  for (let n = 1; n <= 3; n++) DB.sql.exec(`INSERT INTO products (${cols}) SELECT stable_key || '-c${n}', awin_advertiser_id, awin_product_id || 'c${n}', merchant_product_id, retailer, category_slug, subcategory, brand, product_name || ' ${n}', product_slug || '-${n}', description, price, was_price, currency, in_stock, item_condition, image_url, affiliate_url, merchant_category, '', mpn, specs_json, first_seen_at, last_seen_at FROM products WHERE category_slug = 'laptops-computing' AND stable_key NOT LIKE '%-c%'`);
  DB.sql.exec("UPDATE products SET last_seen_at = '2026-12-03 09:00:00'");
  const env = { DB, YADORE_API_KEY: KEY, YADORE_FETCH: api, FX_FETCH: async () => { throw new Error('offline'); } };
  const p2 = await get(tgw, env, '/category/laptops-computing/?page=2');
  assert.equal(p2.res.status, 200, 'there is a page 2');
  assert.match(p2.text, /<article class="label-card">/);
  assert.equal(box(p2.text), '');
  assert.equal(api.calls.length, 0);
  for (const ua of ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', 'curl/8.4.0', '']) {
    assert.equal(box((await get(tgw, env, '/category/audio/', { ua })).text), '', ua);
  }
  const head = await createWorker(tgw).fetch(request(tgw, '/category/audio/'), env, { waitUntil: p => p });
  await head.text();
  const h = await createWorker(tgw).fetch(Object.defineProperty(new Request(`https://${tgw.domain}/category/audio/`, { method: 'HEAD', headers: { 'User-Agent': BROWSER } }), 'cf', { value: { country: 'GR' } }), env, { waitUntil: p => p });
  assert.equal(h.status, 200);
  const asked = api.calls.length;
  assert.ok(asked >= 1, 'the person\'s GET asked Yadore');
  await createWorker(tgw).fetch(Object.defineProperty(new Request(`https://${tgw.domain}/category/gaming/`, { method: 'HEAD', headers: { 'User-Agent': BROWSER } }), 'cf', { value: { country: 'GR' } }), env, { waitUntil: p => p });
  await get(tgw, env, '/category/gaming/', { host: 'technology-gear-world-preview.example.workers.dev' });
  assert.equal(api.calls.length, asked, 'a HEAD and a test address never ask Yadore');
});

test('L232 review: prefetch, another site\'s page, a failing click log, the same link twice and more than 3 clicks of one person go back to the page', async () => {
  N = 0;
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  try {
    const env = { DB: tgwDb(), YADORE_API_KEY: KEY, YADORE_FETCH: yadoreApi(fullAnswer), FX_FETCH: async () => { throw new Error('offline'); } };
    const toks = [...new Set(await pageTokens(tgw, env, '/category/laptops-computing/'))];
    const back = '/category/laptops-computing/';
    const where = r => { const l = r.headers.get('Location'); return /^https:\/\/api\.yadore\.com\//.test(l) ? 'yadore' : new URL(l).pathname; };
    const ip = a => ({ 'CF-Connecting-IP': a });
    for (const [name, h] of [['prefetch', { 'Sec-Purpose': 'prefetch' }], ['prerender', { 'Sec-Purpose': 'prefetch;prerender' }], ['old prefetch', { Purpose: 'prefetch' }]]) {
      const r = await click(tgw, env, toks[0], { headers: { ...ip('192.0.2.1'), ...h } });
      assert.equal(r.status, 503, `${name}: no answer a browser could keep for the real click`);
      assert.equal(r.headers.get('Cache-Control'), 'no-store');
      assert.equal(r.headers.get('Location'), null);
    }
    for (const [name, h] of [['another site', { 'Sec-Fetch-Site': 'cross-site' }], ['typed or bookmarked', { 'Sec-Fetch-Site': 'none' }]]) {
      assert.equal(where(await click(tgw, env, toks[0], { headers: { ...ip('192.0.2.1'), ...h } })), back, name);
    }
    assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM affiliate_clicks').get().n, 0);
    // A click from our own page, then the same link again from the same person: once.
    assert.equal(where(await click(tgw, env, toks[0], { headers: { ...ip('192.0.2.1'), 'Sec-Fetch-Site': 'same-origin' } })), 'yadore');
    assert.equal(where(await click(tgw, env, toks[0], { headers: ip('192.0.2.1') })), back, 'the same link twice');
    assert.equal(toks.length, 6, '6 offers, one link each (button and photo)');
    assert.equal(where(await click(tgw, env, toks[1], { headers: ip('192.0.2.1') })), 'yadore');
    assert.equal(where(await click(tgw, env, toks[2], { headers: ip('192.0.2.1') })), 'yadore', 'the 3rd click of the day');
    assert.equal(where(await click(tgw, env, toks[3], { headers: ip('192.0.2.1') })), back, 'the 4th of the same person');
    assert.equal(where(await click(tgw, env, toks[3], { headers: ip('192.0.2.2') })), 'yadore', 'another person');
    assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM affiliate_clicks').get().n, 4);
    assert.ok(![...store.keys()].some(k => k.includes('192.0.2')), 'the address is only a one-way hash');
    // The click log fails: the click is not counted, so it does not go to Yadore either.
    const broken = { ...env, DB: { prepare: t => (/^INSERT/i.test(t.trim()) ? { bind: () => ({ run: async () => { throw new Error('D1_ERROR: overloaded'); } }) } : env.DB.prepare(t)) } };
    assert.equal(where(await click(tgw, broken, toks[4], { headers: ip('192.0.2.3') })), back, 'no record, no click');
    assert.equal(where(await click(tgw, env, toks[5], { headers: ip('192.0.2.3') })), 'yadore', 'the same person later, when the log works');
  } finally {
    globalThis.caches = before;
  }
});

// ---- Independent review, round 2 (25 Nov 2026)

test('L232 review 2: clicks at the same moment never pass the caps (one statement with the counts), on both database layouts', async () => {
  for (const [site, mk, path] of [[tgw, tgwDb, '/category/laptops-computing/'], [ggw, ggwDb, '/category/garden-furniture-outdoor-living/']]) {
    N = 0;
    const env = { DB: mk(), YADORE_API_KEY: KEY, YADORE_FETCH: yadoreApi(fullAnswer), FX_FETCH: async () => { throw new Error('offline'); } };
    const toks = [...new Set(await pageTokens(site, env, path))];
    // 24 clicks at the same moment, from 24 people: one goes (no bursts), and it is the one recorded.
    NOW += 30000;
    const burst = await Promise.all(Array.from({ length: 24 }, (_, i) => clickNow(site, env, toks[i % toks.length], { headers: { 'CF-Connecting-IP': `198.51.100.${i + 1}` } })));
    const sent = burst.filter(r => /^https:\/\/api\.yadore\.com\//.test(r.headers.get('Location'))).length;
    const rows = () => env.DB.sql.prepare("SELECT retailer, COUNT(*) AS n FROM affiliate_clicks WHERE retailer LIKE 'Yadore%' GROUP BY retailer").all();
    assert.equal(sent, 1, `${site.code}: one click of the burst`);
    assert.equal(rows().reduce((a, r) => a + r.n, 0), 1);
    // Then steady clicks, 30 seconds apart: at most 5 per store and 15 for the site, every one sent is recorded.
    let more = 0;
    for (let i = 0; i < 40; i++) {
      const r = await click(site, env, toks[i % toks.length], { headers: { 'CF-Connecting-IP': `203.0.113.${i + 1}` } });
      if (/^https:\/\/api\.yadore\.com\//.test(r.headers.get('Location'))) more++;
    }
    const all = rows();
    assert.ok(all.every(r => r.n <= 5), `${site.code}: at most 5 per store (${JSON.stringify(all)})`);
    assert.equal(1 + more, all.reduce((a, r) => a + r.n, 0), `${site.code}: every click sent to Yadore is recorded, none more`);
    assert.equal(1 + more, 15, `${site.code}: 15 for the site`);
  }
});

test('L232 review 2: an IPv6 visitor counts by its /64; the hash is keyed, so an address cannot be found from it', async () => {
  const { visitorAddress, visitorGate } = await import('../../src/lib/yadore.js');
  assert.equal(visitorAddress('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
  assert.equal(visitorAddress('2001:0db8:0001:0002:ffff:1:2:3'), '2001:db8:1:2::/64');
  assert.equal(visitorAddress('2001:db8::5'), '2001:db8:0:0::/64');
  assert.equal(visitorAddress('192.0.2.7'), '192.0.2.7');
  const store = new Map();
  const cache = { match: async k => (store.has(k.url) ? store.get(k.url).clone() : undefined), put: async (k, r) => { store.set(k.url, r); } };
  const base = { origin: 'https://technologygearworld.com', site: tgw, at: DAY, cache, secret: KEY };
  for (let i = 1; i <= 3; i++) {
    const g = await visitorGate({ ...base, ip: `2001:db8:1:2::${i}`, token: `t${i}` });
    assert.equal(g.ok, true, `click ${i}`);
    await g.save();
  }
  assert.equal((await visitorGate({ ...base, ip: '2001:db8:1:2:ffff::9', token: 't9' })).reason, 'visitor', 'another address of the same /64');
  assert.equal((await visitorGate({ ...base, ip: '2001:db8:1:3::1', token: 't9' })).ok, true, 'another /64');
  const other = new Map();
  const c2 = { match: async k => (other.has(k.url) ? other.get(k.url).clone() : undefined), put: async (k, r) => { other.set(k.url, r); } };
  await (await visitorGate({ ...base, cache: c2, secret: 'another-key-0123456789', ip: '2001:db8:1:2::1', token: 't1' })).save();
  assert.notDeepEqual([...other.keys()], [...store.keys()].slice(0, 1), 'the key changes the hash');
});

test('L232 review 2: sale words of a Greek title, a final sigma and "Public-GR" are caught', async () => {
  const { promoTitle } = await import('../../src/lib/yadore.js');
  for (const t of ['ΠΡΟΣΦΟΡΑ Laptop', 'Laptop Προσφορά!', 'Έκπτωση -30% κράνος', 'κράνος -25%', 'κράνος (-15%)', 'Κράνος [-30%]', 'Κράνος /-30%', 'Κράνος *-30%*', 'Κράνος \u201130%', 'Κράνος —30%',
    'Κράνος -30％', 'Κράνος -20€', '30% discount helmet', 'Special offer helmet', 'Clearance helmet', 'Promo helmet', 'Μειωμένη τιμή κράνος', 'Τιμή σοκ!', 'ΕΚΠΤ. 30% κράνος',
    'ξεπούλημα', 'Black Friday laptop', 'BlackFriday laptop', 'black-friday κράνος', 'Black Week', 'Cyber Monday', 'Εκπτωτικό πακέτο', 'Ευκαιρία!', 'Εκκαθάριση αποθήκης', 'Χαμηλότερη τιμή κράνος']) assert.equal(promoTitle(t), true, t);
  for (const t of ['Μπλουζάκι 100% βαμβάκι', '95% βαμβάκι 5% ελαστάνη', 'Γιαούρτι 0% λιπαρά', 'Οινόπνευμα 70% αλκοόλ', '99,9% καθαρό', 'Σοκολάτα 85% κακάο', '100% original',
    'Li-ion 18V -20°C', 'SPF 50', '-10 dB', '−5 °C', 'Black Weekender Bag', 'Υγρασιόμετρο 10 - 99%', 'iPhone – 90% μπαταρία', 'Τροφή σκύλου - 26% πρωτεΐνη', 'Καθαριστής αέρα up to 99.97%',
    'Θερμοστάτης εξοικονόμηση έως 30%', 'Laptop 16GB 512GB', 'Κράνος μηχανής XL', 'Τροφή σκύλου 15kg', 'Φόρμα εργασίας 65/35']) assert.equal(promoTitle(t), false, t);
  N = 0;
  assert.equal(readOffers({ offers: [offer('alpha.gr', { title: 'Laptop ΠΡΟΣΦΟΡΑ' }), offer('alpha.gr', { title: 'Laptop -20%' }), offer('alpha.gr')] }, {}, 'gr').length, 1);
  assert.equal(storeKey('ΚΑΤΑΣΤΗΜΑ ΚΟΣΜΟΣ'), storeKey('κατάστημα κόσμος'.normalize('NFD').replace(/[\u0300-\u036f]/g, '')), 'a final sigma folds to σ');
  assert.equal(storeKey('Κόσμος'), 'κόσμοσ');
  for (const n of ['Public-GR', 'public-gr.example', 'AB-Vasilopoulos', 'e-shop', 'E-Shop Greece', 'e-shop.cy', 'e-shop.gr']) assert.equal(neverStore(n), true, n);
  const { visitorAddress } = await import('../../src/lib/yadore.js');
  assert.equal(visitorAddress('::ffff:192.0.2.9'), '192.0.2.9', 'an IPv4-mapped address counts as its IPv4');
});

test('L232 review 4: one offer link per visitor even across new page copies, and a click sent back costs the visitor nothing', async () => {
  const { visitorAddress } = await import('../../src/lib/yadore.js');
  for (const a of ['::ffff:192.0.2.9', '0:0:0:0:0:ffff:192.0.2.9', '::ffff:c000:209', '::FFFF:C000:0209']) assert.equal(visitorAddress(a), '192.0.2.9', a);
  assert.equal(visitorAddress('fe80::1%eth0'), 'fe80:0:0:0::/64');
  N = 0;
  const store = new Map();
  const before = globalThis.caches;
  const put = (key, res) => { if (!/\/category\//.test(key.url)) store.set(key.url, res); };
  globalThis.caches = { default: { match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined), put: async (k, r) => put(k, r) } };
  try {
    const env = { DB: tgwDb(), YADORE_API_KEY: KEY, YADORE_FETCH: yadoreApi(fullAnswer), FX_FETCH: async () => { throw new Error('offline'); } };
    const where = r => (/^https:\/\/api\.yadore\.com\//.test(r.headers.get('Location')) ? 'yadore' : new URL(r.headers.get('Location')).pathname);
    const ip = { headers: { 'CF-Connecting-IP': '192.0.2.50' } };
    const first = [...new Set(await pageTokens(tgw, env, '/category/laptops-computing/'))];
    const again = [...new Set(await pageTokens(tgw, env, '/category/laptops-computing/'))];
    assert.notEqual(first[0], again[0], 'a new page copy writes new links for the same offers');
    assert.equal(where(await click(tgw, env, first[0], ip)), 'yadore');
    assert.equal(where(await click(tgw, env, again[0], ip)), '/category/laptops-computing/', 'the same offer through a new link: once');
    // A click sent back by the 10-second gap does not use up the visitor's click or that offer.
    await click(tgw, env, first[1], { headers: { 'CF-Connecting-IP': '192.0.2.51' } });
    const r = await clickNow(tgw, env, first[2], ip);
    assert.equal(where(r), '/category/laptops-computing/', 'within 10 seconds of another click');
    NOW += 30000;
    assert.equal(where(await clickNow(tgw, env, first[2], ip)), 'yadore', 'the same offer later: still allowed');
  } finally {
    globalThis.caches = before;
  }
});
