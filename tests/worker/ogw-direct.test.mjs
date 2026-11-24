// The 5 big Greek stores of Linkwise on Mega Stores (owner and Linkwise, 24 Nov 2026, lessons L226): Public, Sephora,
// e-shop.gr, AB Vasilopoulos and Kotsovolos accept no comparison site, so their products are never on the 13 sites, the
// Hub or the app. Julia (Linkwise) agreed to their pages here like the 7 of L221 (the programme logo, sets and gift
// ideas, no prices), with one difference: each idea opens the store's own page through our Linkwise link. Our affiliate
// code is never in the repository: the Worker secret LINKWISE_CODE; without it these stores are on no page.
// Fake fetch, a fixed day, a fake code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import site from '../../sites/ogw/site.config.js';
import {
  createGuidesWorker, isDirectStore, directUrl, linkwiseCode, directStores, shownStores, awinStores, editionStores, pagePaths,
  directPicks, storeCodes, earlyBlackFriday, EDITIONS, directPhotos, directPhotosKey
} from '../../src/marketplace-guides.js';

const LIVE = 'https://megastoresgearworld.com';
const NOW = Date.parse('2026-11-24T19:00:00Z');
const CODE = 'CD12345';
const LW = { LINKWISE_CODE: CODE };
const LW_ON = { AMAZON_LINKS: 'on', LINKWISE_CODE: CODE };
const BROWSER = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const GOOGLE = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const DIRECT = site.stores.filter(s => s.direct);
const SLUGS = ['kotsovolos-gr', 'public-gr', 'sephora-gr', 'e-shop-gr', 'ab-gr'];
const PROGRAMS = { 'kotsovolos-gr': 138, 'public-gr': 469, 'sephora-gr': 13026, 'e-shop-gr': 11754, 'ab-gr': 12158 };
const HOSTS = { 'kotsovolos-gr': 'www.kotsovolos.gr', 'public-gr': 'www.public.gr', 'sephora-gr': 'www.sephora.gr', 'e-shop-gr': 'www.e-shop.gr', 'ab-gr': 'www.ab.gr' };
const IMAGE_HOSTS = { 'kotsovolos-gr': 'assets.kotsovolos.gr', 'public-gr': 'external.webstorage.gr', 'sephora-gr': 'media.sephora.eu', 'e-shop-gr': 'images.e-shop.gr' };
// Our own texts may never sell or promise (L107); the Greek words too. The store's name "e-shop.gr" is its own name.
const NOT_OURS = /\b(shop|shopping|cart|buy now|official|partners?|sale|deals?|lowest price|% off|save \d)\b|[€£$]|\d+\s*%/i;
const NOT_OURS_EL = /(έκπτωσ|προσφορ|φθηνότερ|χαμηλότερη τιμή|επίσημ|καλάθι αγορών)/i;

function makeFetch() {
  const calls = [];
  const f = async input => {
    const u = new URL(String(input));
    calls.push(u);
    const rows = [1, 2, 3].map(n => ({ product_name: `Item ${n}`, brand: 'Acme', retailer: u.searchParams.get('retailer'), stock_status: 'in_stock', price: 24.9,
      image_url: `https://img.example/${n}.jpg`, delivers_to: [u.searchParams.get('deliver_to')], product_url: `https://${u.hostname}/product/p-${n}/` }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  f.calls = calls;
  return f;
}
async function get(path, { cc = 'GR', ua = BROWSER, env = LW, s = site } = {}) {
  const fetch = makeFetch();
  const w = createGuidesWorker(s, { fetch, photoFetch: null, cache: null, now: () => NOW });
  const req = new Request(LIVE + path, { headers: { 'user-agent': ua } });
  if (cc) Object.defineProperty(req, 'cf', { value: { country: cc } });
  const r = await w.fetch(req, env);
  return { r, text: await r.text(), calls: fetch.calls };
}
const visible = html => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const hrefs = text => [...text.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));

test('L226: the 5 direct stores: Linkwise programme, their own addresses, Greece only, no Gear World site, logo, sets and ideas', () => {
  assert.deepEqual(DIRECT.map(s => s.slug), SLUGS);
  assert.deepEqual(DIRECT.map(s => s.name), ['Κωτσόβολος', 'Public', 'Sephora', 'e-shop.gr', 'ΑΒ Βασιλόπουλος']);
  const allowed = readFileSync('sites/ogw/public-allowlist.txt', 'utf8').split(/\r?\n/).map(x => x.trim());
  for (const s of DIRECT) {
    assert.ok(isDirectStore(s), s.slug);
    assert.equal(s.network, 'linkwise');
    assert.equal(s.direct.program, PROGRAMS[s.slug], `${s.slug}: its Linkwise programme`);
    assert.deepEqual(s.direct.hosts, [HOSTS[s.slug]], `${s.slug}: its own address only`);
    assert.deepEqual(s.deliversTo, ['GR'], `${s.slug}: Greece only`);
    assert.equal(s.sites, undefined, `${s.slug}: on no Gear World site (never read from a Gear World database)`);
    assert.equal(s.showcase, undefined, `${s.slug}: no showcase of L221 (its own sets and ideas)`);
    assert.ok(s.line && s.line.length < 90 && !NOT_OURS.test(s.line), `${s.slug}: one short line of ours`);
    // The logo of the Linkwise panel: 120x60, the panel's pixels, no editor's notes inside the file.
    assert.match(s.logo, new RegExp(`^logos/${s.slug}\\.(png|jpg)$`));
    assert.deepEqual(s.logoSize, [120, 60]);
    assert.ok(allowed.includes(`assets/${s.logo}`), `${s.slug}: in the allowlist (L04)`);
    const file = readFileSync(`sites/ogw/public/assets/${s.logo}`);
    assert.ok(statSync(`sites/ogw/public/assets/${s.logo}`).size > 1000 && file.length < 20000, `${s.slug}: a small logo`);
    if (s.logo.endsWith('.png')) {
      assert.equal(file.subarray(1, 4).toString('latin1'), 'PNG');
      assert.deepEqual([file.readUInt32BE(16), file.readUInt32BE(20)], [120, 60]);
    } else assert.deepEqual([...file.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    assert.ok(!/xmp|exif|photoshop|gimp|did:|iid:/i.test(file.toString('latin1')), `${s.slug}: no editor's notes in the file`);
    // Sets and ideas: Greek and English, short, no price or sale word; every page on the store's own address.
    const d = s.direct;
    assert.equal(d.sets.length, s.slug === 'ab-gr' ? 0 : 2, `${s.slug}: sets`);
    assert.equal(d.ideas.length, s.slug === 'ab-gr' ? 4 : 3, `${s.slug}: ideas`);
    for (const part of [...d.sets, ...d.ideas]) {
      for (const v of [part.title, part.line]) {
        assert.ok(v.el && v.en && v.el.length < 90 && v.en.length < 90, `${s.slug}: Greek and English, short`);
        assert.ok(!NOT_OURS.test(v.en) && !NOT_OURS_EL.test(v.el), `${s.slug}: no price or sale word: ${v.en}`);
      }
    }
    for (const set of d.sets) assert.equal(set.items.length, 3, `${s.slug}: 3 products per set`);
    const items = [...d.sets.flatMap(x => x.items), ...d.ideas.map(x => x.item).filter(Boolean)];
    for (const p of items) {
      assert.ok(p.name && p.name.length <= 140 && !/[€£$]|\d+\s*%|\b(sale|deals?|offer|black friday)\b|προσφορ|έκπτωσ/i.test(p.name), `${s.slug}: a product name as the store gives it: ${p.name}`);
      assert.equal(new URL(p.url).hostname, HOSTS[s.slug], `${s.slug}: ${p.url}`);
      assert.equal(new URL(p.url).protocol, 'https:');
      assert.equal(new URL(p.image).hostname, IMAGE_HOSTS[s.slug], `${s.slug}: its own image server: ${p.image}`);
    }
    assert.equal(new Set(items.map(p => p.url)).size, items.length, `${s.slug}: each product once`);
    if (s.slug === 'ab-gr') {
      // AB has no product feed (0 rows on 24 Nov 2026): its ideas are its own categories, without a photo.
      for (const i of d.ideas) { assert.equal(i.item, undefined); assert.equal(new URL(i.url).hostname, 'www.ab.gr'); }
    } else for (const i of d.ideas) assert.ok(i.item && !i.url, `${s.slug}: an idea is one product`);
  }
});

test('L226: the Linkwise link: only the store\'s own https pages, our code only, nothing else', () => {
  const k = DIRECT[0];
  const page = 'https://www.kotsovolos.gr/ProductDisplay?partNumber=273143';
  assert.equal(directUrl(k, page, CODE), `https://go.linkwi.se/z/138-0/${CODE}/?lnkurl=${encodeURIComponent(page)}`);
  for (const bad of ['http://www.kotsovolos.gr/x', 'https://kotsovolos.gr/x', 'https://www.kotsovolos.gr.evil.example/x', 'https://evil.example/?u=https://www.kotsovolos.gr/',
    'https://user@www.kotsovolos.gr/x', 'https://www.kotsovolos.gr:8443/x', 'javascript:alert(1)', '', 'nope']) {
    assert.equal(directUrl(k, bad, CODE), '', `refused: ${bad}`);
  }
  for (const code of ['', 'CD', 'cd12345', 'CD12345x', 'XX12345', ' CD12345', 'CD1234567890']) assert.equal(directUrl(k, page, code), '', `no link with code "${code}"`);
  assert.equal(directUrl(site.stores.find(s => s.slug === 'parex-gr'), 'https://www.parex.gr/', CODE), '', 'not for a store of the Gear World sites');
  assert.equal(linkwiseCode({ LINKWISE_CODE: ` ${CODE} ` }), CODE);
  for (const env of [undefined, null, {}, { LINKWISE_CODE: '' }, { LINKWISE_CODE: 'CD' }, { LINKWISE_CODE: 'abc' }, { LINKWISE_CODE: 12345 }]) assert.equal(linkwiseCode(env), '');
});

test('L226: without our code the 5 stores are on no page, card, menu or sitemap, and every page is as before', async () => {
  assert.deepEqual(directStores(site, 'GR', ''), []);
  assert.deepEqual(directStores(site, 'GR', CODE).map(s => s.slug), SLUGS);
  assert.ok(!shownStores(site, 'off', 'GR').some(isDirectStore) && shownStores(site, 'off', 'GR', CODE).filter(isDirectStore).length === 5);
  assert.ok(!editionStores(site, EDITIONS[0]).some(isDirectStore) && editionStores(site, EDITIONS[0], CODE).filter(isDirectStore).length === 5);
  assert.ok(!pagePaths(site, 'on').some(p => SLUGS.some(x => p.includes(x))), 'no sitemap address without the code');
  assert.deepEqual(pagePaths(site, 'on', CODE).filter(p => SLUGS.some(x => p.includes(x))), SLUGS.map(x => `/gr/stores/${x}/`), 'with it: only the /gr/ pages (Google reads the UK page, L195)');
  for (const [path, cc] of [['/gr/', 'GR'], ['/', 'GR'], ['/', 'GB'], ['/gr/stores/kouzinika-gr/', 'GR'], ['/how-we-make-money/', 'GR'], ['/privacy/', 'GR'], ['/about/', 'GB']]) {
    const off = await get(path, { cc, env: {} });
    for (const s of DIRECT) assert.ok(!off.text.includes(`/stores/${s.slug}/`) && !off.text.includes(s.direct.hosts[0]), `${path} ${cc}: no ${s.slug}`);
    assert.ok(!/linkwi/i.test(off.text), `${path} ${cc}: no word of Linkwise without the code`);
  }
  for (const s of DIRECT) {
    for (const path of [`/gr/stores/${s.slug}/`, `/stores/${s.slug}/`]) {
      const { r, text } = await get(path, { env: {} });
      assert.equal(r.status, 404, `${path}: 404 without the code`);
      assert.ok(!text.includes(s.direct.hosts[0]) && !text.includes('go.linkwi.se'));
    }
  }
  // With the code, the UK page and every store of the Gear World sites stay exactly as they were; a page that Greece
  // sees changes only in the footer line, which then names Linkwise too.
  const footer = text => text.replace(/<p>&copy; [\s\S]*?<\/p>/, '<p>&copy;</p>');
  for (const [path, cc] of [['/', 'GB'], ['/', 'US'], ['/stores/joybuy/', 'GB'], ['/gr/stores/kouzinika-gr/', 'GR'], ['/guides/christmas-gift-ideas-for-him/', 'GB'], ['/guides/christmas-gift-ideas-for-him/', 'GR']]) {
    const before = await get(path, { cc, env: { AMAZON_LINKS: 'on' } });
    const now = await get(path, { cc, env: LW_ON });
    if (cc === 'GR') {
      assert.equal(footer(now.text), footer(before.text), `${path} ${cc}: the same page with the code, but for the footer line`);
      assert.ok(now.text.includes('και σε μερικά καταστήματα μέσω της Linkwise') && !before.text.includes('Linkwise'), `${path} ${cc}: the footer names Linkwise only with the code`);
    } else assert.equal(now.text, before.text, `${path} ${cc}: the same page with the code`);
  }
});

test('L226: the 5 stores are never read from a Gear World site, and have no codes, Black Friday entry or product list', async () => {
  for (const s of DIRECT) assert.ok(!awinStores(site).includes(s), `${s.slug}: not among the stores read for products`);
  // Even with a code of their own on a Gear World site, or an entry of their own in black-friday.json.
  assert.ok(!storeCodes(site, NOW, null, 'GR').some(c => SLUGS.includes(c.store.slug)), 'no code');
  const bf = { ...site, earlyBlackFriday: { ...site.earlyBlackFriday, started: [{ slug: 'kotsovolos-gr', name: 'Κωτσόβολος', from: '2026-11-20', hide: '2026-12-01', sites: ['TGW'], deliversTo: ['GR'] }], codes: [] } };
  assert.deepEqual(earlyBlackFriday(bf, NOW, 'GR'), [], 'no Black Friday entry for a direct store');
  const home = await get('/gr/');
  for (const u of home.calls) assert.ok(!SLUGS.some(x => (u.searchParams.get('retailer') || '').includes(DIRECT.find(s => s.slug === x).name)), `never read: ${u}`);
  for (const s of DIRECT) {
    const { calls, text } = await get(`/gr/stores/${s.slug}/`);
    assert.equal(calls.length, 0, `${s.slug}: nothing read from a Gear World database`);
    assert.ok(!text.includes('class="pcard"') && !text.includes('store-codes') && !text.includes('site-links'), `${s.slug}: no product list, codes or Gear World searches`);
  }
});

test('L226: /gr/ lists the 5 after the 7, each card with its logo and three of its own photos, opening our page', async () => {
  const { r, text } = await get('/gr/', { cc: 'GB' });
  assert.equal(r.status, 200);
  const cards = text.split('<li class="store-card">').slice(1);
  const order = [...text.matchAll(/<a class="store-link" href="\/gr\/stores\/([a-z0-9-]+)\/">/g)].map(m => m[1]);
  assert.deepEqual(order.slice(-5), SLUGS, 'the 5 after the 7 Greek stores');
  assert.equal(order.length, 12);
  for (const s of DIRECT) {
    const card = cards.find(c => c.includes(`href="/gr/stores/${s.slug}/"`));
    assert.ok(card, s.slug);
    assert.ok(card.includes(`<img src="/assets/${s.logo}?v=${site.assetVersion}" alt="${s.name}" width="120" height="60"`), `${s.slug}: the logo`);
    const photos = [...card.matchAll(/<li><img src="([^"]+)" alt="" width="96" height="96" loading="lazy" decoding="async" referrerpolicy="no-referrer"><\/li>/g)].map(m => m[1].replace(/&amp;/g, '&'));
    assert.deepEqual(photos, directPicks(s).slice(0, 3).map(p => p.image), `${s.slug}: its own photos`);
    assert.ok(!card.includes('go.linkwi.se') && !card.includes(s.direct.hosts[0]), `${s.slug}: the card opens our page, not the store`);
    assert.ok(visible(card).includes(s.slug === 'ab-gr' ? `Ιδέες δώρου από το κατάστημα ${s.name}` : `Σετ και ιδέες δώρου από το κατάστημα ${s.name}`), `${s.slug}: its line under the card`);
  }
  assert.ok(visible(text).includes('για μερικά καταστήματα, ιδέες δώρου που ανοίγουν τη σελίδα του ίδιου του καταστήματος'), 'the lede says so');
  assert.match(text, /<span class="jump-meta">12 καταστήματα<\/span>/, 'the hero button counts them');
  // The UK home page and every other country: none of the 5 (deliversTo GR, L210).
  for (const cc of ['GB', 'CY', 'US']) {
    const other = await get('/', { cc, env: LW_ON });
    for (const s of DIRECT) assert.ok(!other.text.includes(`/stores/${s.slug}/`), `${cc}: no ${s.slug}`);
  }
});

test('L226: a store page: the logo, the sets and the ideas in Greek, each one a Linkwise link to the store\'s own page, never a price', async () => {
  for (const s of DIRECT) {
    const { r, text } = await get(`/gr/stores/${s.slug}/`, { cc: 'GB' });
    assert.equal(r.status, 200, s.slug);
    assert.ok(text.startsWith('<!doctype html>\n<html lang="el-GR">'), `${s.slug}: in Greek`);
    assert.ok(!text.includes('<meta name="robots"'), `${s.slug}: indexed`);
    assert.ok(text.includes(`<link rel="canonical" href="${LIVE}/gr/stores/${s.slug}/">`));
    assert.match(text, new RegExp(`<span class="store-logo store-logo-lg"><img src="/assets/${s.logo.replace('.', '\\.')}\\?v=[^"]+" alt="${s.name}" width="120" height="60"`));
    const words = visible(text);
    assert.ok(words.includes(`μέσω της Linkwise, ενός δικτύου affiliate`) && words.includes('μπορεί να κερδίσουμε προμήθεια'), `${s.slug}: the note says what the links are`);
    const d = s.direct;
    if (d.sets.length) assert.ok(words.includes(`Σετ από το κατάστημα ${s.name}`), `${s.slug}: the sets`);
    else assert.ok(!text.includes('id="sets-h"'), `${s.slug}: no sets part`);
    assert.ok(words.includes(`Ιδέες δώρου από το κατάστημα ${s.name}`), `${s.slug}: the ideas`);
    for (const part of [...d.sets, ...d.ideas]) assert.ok(text.includes(`<h3>${part.title.el}</h3>`), `${s.slug}: ${part.title.en}`);
    assert.equal((text.match(/<li class="sc-set">/g) || []).length, d.sets.length);
    assert.equal((text.match(/<li class="sc-idea">/g) || []).length, d.ideas.length);
    // Every link to the store: our Linkwise link to one of its pages, sponsored and nofollow, in a new tab.
    const outs = [...text.matchAll(/<a class="sc-(?:photo|link)" href="([^"]+)" rel="([^"]+)" target="_blank">/g)];
    const items = [...d.sets.flatMap(x => x.items), ...d.ideas.map(x => x.item).filter(Boolean)];
    assert.equal(outs.length, items.length * 2 + d.ideas.filter(i => !i.item).length, `${s.slug}: photo and button for each product, a button for each category`);
    for (const [, href, rel] of outs) {
      assert.equal(rel, 'sponsored nofollow noopener');
      const u = new URL(href.replace(/&amp;/g, '&'));
      assert.equal(`${u.origin}${u.pathname}`, `https://go.linkwi.se/z/${d.program}-0/${CODE}/`, `${s.slug}: our code, its programme`);
      assert.equal(new URL(u.searchParams.get('lnkurl')).hostname, d.hosts[0], `${s.slug}: its own page`);
    }
    // No other address of another site than the store's (through Linkwise), the Hub, the ICO and this site.
    for (const h of hrefs(text).filter(x => /^https?:/.test(x))) {
      const host = new URL(h).hostname;
      assert.ok(['go.linkwi.se', 'megastoresgearworld.com', 'gearworldhub.com', 'ico.org.uk'].includes(host), `${s.slug}: link ${h}`);
    }
    assert.ok(!/\/(out|go)\//.test(text), `${s.slug}: no /out/ or /go/ of a Gear World site`);
    const shown = visible(text).replace(/e-shop\.gr/g, '');
    // (Model numbers such as "ECAM220.30.SB" are names; a price would carry a currency.)
    assert.ok(!/[€£$]|\bEUR\b|\d\s?%|24[.,]9/.test(shown) && !/\b(sale|deals?|save|shop|cart|buy now|official|partners?|lowest price)\b/i.test(shown), `${s.slug}: never a price or a word of a shop`);
    assert.ok(!/class="(pcard|promo-list|bf-when|site-links)/.test(text), `${s.slug}: no Gear World list, codes or Black Friday`);
    for (const p of items) assert.ok(text.includes(`<img src="${p.image.replace(/&/g, '&amp;')}" alt="${p.name.replace(/&/g, '&amp;').replace(/'/g, '&#39;')}" width="200" height="200" loading="lazy" decoding="async" referrerpolicy="no-referrer">`), `${s.slug}: ${p.name}`);
  }
});

test('L226: the UK address of a direct store: Greece gets the page, every other country the "not listed" page (noindex)', async () => {
  for (const s of DIRECT) {
    const gr = await get(`/stores/${s.slug}/`, { cc: 'GR' });
    assert.equal(gr.r.status, 200);
    assert.ok(gr.text.includes(`https://go.linkwi.se/z/${s.direct.program}-0/${CODE}/`), `${s.slug}: Greece: its ideas`);
    for (const [cc, ua] of [['GB', BROWSER], ['US', BROWSER], [null, GOOGLE]]) {
      const { r, text } = await get(`/stores/${s.slug}/`, { cc, ua, env: LW_ON });
      assert.equal(r.status, 200, `${s.slug} ${cc}`);
      assert.ok(text.includes('<meta name="robots" content="noindex">'), `${s.slug} ${cc}: noindex`);
      assert.ok(!text.includes('go.linkwi.se') && !text.includes(s.direct.hosts[0]), `${s.slug} ${cc}: no link to the store`);
    }
  }
});

test('L226: with the code the legal pages say what the Linkwise links are, in every language', async () => {
  const money = await get('/how-we-make-money/', { cc: 'GB', env: LW_ON });
  const w = visible(money.text).replace(/ ,/g, ',');
  assert.ok(w.includes('The gift ideas on the pages of Κωτσόβολος, Public, Sephora, e-shop.gr, ΑΒ Βασιλόπουλος are our own affiliate links through Linkwise'), 'how we make money: the Linkwise part');
  assert.ok(!w.includes('At the moment this site has no affiliate links of its own'), 'no more "no affiliate links of its own"');
  const privacy = visible((await get('/privacy/', { cc: 'GB', env: LW })).text);
  assert.ok(privacy.includes('first pass through Linkwise (go.linkwi.se), which records the click and may set a cookie'), 'privacy: the click through Linkwise');
  assert.ok(privacy.includes('Last updated: 24 November 2026'));
  const about = visible((await get('/about/', { cc: 'GB', env: LW })).text);
  assert.ok(about.includes('show gift ideas of the store itself, each with a Linkwise link'), 'about');
  const gr = visible((await get('/gr/stores/public-gr/')).text);
  assert.ok(gr.includes('και σε μερικά καταστήματα μέσω της Linkwise'), 'the footer of a Greek page names Linkwise');
  for (const l of ['de-DE', 'fr-FR', 'ru-RU']) {
    const t = visible((await get(`/how-we-make-money/?lang=${l}`, { cc: 'GB', env: LW })).text);
    assert.ok(t.includes('Linkwise') && t.includes('Κωτσόβολος'), `${l}: the Linkwise part, the names as they are`);
  }
});

test('L226: the code is never in the repository, the config or a test fixture other than the fake one', () => {
  const files = ['sites/ogw/site.config.js', 'src/marketplace-guides.js', 'tools/ogw-site.ps1', 'sites/ogw/wrangler.jsonc.example', 'docs/LESSONS.md'];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/\bCD\d{3,9}\b/g)) assert.ok(['CD12345'].includes(m[0]) && f !== 'sites/ogw/site.config.js', `${f}: ${m[0]}`);
  }
  const tool = readFileSync('tools/ogw-site.ps1', 'utf8');
  assert.match(tool, /--secrets-file/, 'the tool gives the code to Cloudflare as a secret');
  assert.match(tool, /linkwise-code\.dat/, 'from the encrypted file of the PC (DPAPI)');
});

test('L226: a hidden network (L215) hides the 5 too, even with the code', async () => {
  const hidden = { ...site, hiddenNetworks: ['linkwise'] };
  assert.deepEqual(directStores(hidden, 'GR', CODE), []);
  assert.ok(!pagePaths(hidden, 'on', CODE).some(p => SLUGS.some(x => p.includes(x))), 'not in the sitemap');
  const home = await get('/gr/', { s: hidden });
  for (const s of DIRECT) assert.ok(!home.text.includes(`/stores/${s.slug}/`) && !home.text.includes('go.linkwi.se'), `/gr/: no ${s.slug}`);
  for (const s of DIRECT) assert.equal((await get(`/gr/stores/${s.slug}/`, { s: hidden })).r.status, 404, `${s.slug}: 404 while hidden`);
});

test('L226 (L211): a photo of a direct store that does not open is left out with its product, and the check is kept', async () => {
  const k = DIRECT.find(s => s.slug === 'kotsovolos-gr');
  const gone = k.direct.sets[0].items[0].image; // the espresso machine of the coffee set
  const goneIdea = k.direct.ideas[0].item.image; // the air fryer
  const asked = [];
  const photoFetch = async (url, init) => {
    asked.push({ url: String(url), init });
    return new Response('x', { status: [gone, goneIdea].includes(String(url)) ? 404 : 206, headers: { 'Content-Type': [gone, goneIdea].includes(String(url)) ? 'text/html' : 'image/jpeg' } });
  };
  const store = new Map();
  const cache = { match: async key => (store.has(key) ? new Response(store.get(key)) : undefined), put: async (key, res) => { store.set(key, await res.text()); } };
  const w = createGuidesWorker(site, { fetch: makeFetch(), photoFetch, cache, now: () => NOW });
  const req = () => { const r = new Request(`${LIVE}/gr/stores/kotsovolos-gr/`, { headers: { 'user-agent': BROWSER } }); Object.defineProperty(r, 'cf', { value: { country: 'GR' } }); return r; };
  const text = await (await w.fetch(req(), LW)).text();
  assert.equal(asked.length, directPicks(k).length, 'every photo checked once');
  for (const a of asked) assert.ok(!/linkwi/.test(a.url) && /^https:\/\/assets\.kotsovolos\.gr\//.test(a.url), `only the store's image server: ${a.url}`);
  assert.ok(!text.includes(gone) && !text.includes(goneIdea), 'the products whose photo does not open are left out');
  assert.equal((text.match(/<li class="sc-set">/g) || []).length, 2, 'the coffee set keeps its 2 other products (a set needs 2)');
  assert.equal((text.match(/<li class="sc-idea">/g) || []).length, 2, 'the idea without its photo goes');
  assert.deepEqual(JSON.parse(store.get(directPhotosKey(site, k))).broken.sort(), [gone, goneIdea].sort(), 'the result is kept');
  await w.fetch(req(), LW);
  assert.equal(asked.length, directPicks(k).length, 'the next visit uses the kept check');
  // The home page uses the kept result for the card, without waiting for a check of its own.
  const home = await (await w.fetch((() => { const r = new Request(`${LIVE}/gr/`, { headers: { 'user-agent': BROWSER } }); Object.defineProperty(r, 'cf', { value: { country: 'GR' } }); return r; })(), LW)).text();
  const card = home.split('<li class="store-card">').find(c => c.includes('href="/gr/stores/kotsovolos-gr/"'));
  assert.ok(card && !card.includes(gone), 'the card leaves the photo out too');
  // A set with only one product left is not shown.
  const twoGone = new Set(k.direct.sets[1].items.slice(0, 2).map(p => p.image));
  const broken = await directPhotos(site, k, { photoFetch: async url => new Response('x', { status: twoGone.has(String(url)) ? 404 : 200, headers: { 'Content-Type': 'image/jpeg' } }) });
  assert.deepEqual([...broken].sort(), [...twoGone].sort());
});

test('L226: no Linkwise affiliate code anywhere in the repository (the only one is the fake of the tests)', () => {
  const roots = ['src', 'sites', 'tools', 'tests', 'docs', 'promos', 'README.md', 'CLAUDE.md', '.github'];
  const text = /\.(m?js|json|jsonc|md|ps1|psm1|txt|html|css|ya?ml|example|toml|cmd|sh|svg|tpl)$/i;
  const found = [];
  const walk = p => {
    let st;
    try { st = statSync(p); } catch { return; }
    if (st.isDirectory()) { for (const n of readdirSync(p)) if (n !== 'node_modules' && n !== '.git') walk(`${p}/${n}`); return; }
    if (!text.test(p)) return;
    for (const m of readFileSync(p, 'utf8').matchAll(/(?<![A-Za-z0-9])CD\d{3,9}(?!\d)/g)) if (m[0] !== 'CD12345') found.push(`${p}: ${m[0]}`);
  };
  for (const r of roots) walk(r);
  assert.deepEqual(found, []);
});
