// Mega Stores Gear World (megastoresgearworld.com, code OGW): gift guides with links to amazon.co.uk and to the Gear
// World sites. Owner's decision, 17 Nov 2026 (Amazon Associates): no price tracking, no Amazon prices or photos, Amazon
// links straight to amazon.co.uk with the Associates ID only after the owner's phrase (AMAZON_LINKS=on), the Amazon
// statement wherever Amazon links are, and the Google Ads wording rules of the other sites (L101, L103, L107).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import defaultWorker from '../../sites/ogw/worker.js';
import liveSite from '../../sites/ogw/site.config.js';
import {
  AMAZON_STATEMENT, amazonMode, amazonUrl, gearWorldUrl, countdown, ukDay, legalPaths, pagePaths,
  createGuidesWorker, storeCacheKey, guideImage, storeUserAgent, awinStores, deliversHere, EDITIONS, editionStores
} from '../../src/marketplace-guides.js';
import { GEAR_WORLDS } from '../../promos/network.js';
// The Linkwise stores are hidden until Linkwise approves this site (L215, tests/worker/ogw-hidden.test.mjs): these tests
// check the per-country rules as they will be after the approval (hiddenNetworks empty).
const site = { ...liveSite, hiddenNetworks: [] };

// The stores (lessons L191): a fake /api/products of the Gear World sites, never the network. Every answer also has the
// fields the pages must never show (price, was_price, affiliate_url) and rows that must be left out.
const NOW = Date.parse('2026-11-18T12:00:00Z');
const hostOf = code => new URL(GEAR_WORLDS.find(w => w.code === code).url).hostname;
function fakeRows(host, retailer) {
  const tag = host.split('.')[0];
  const base = (n, extra = {}) => ({
    id: n, product_name: `${retailer} ${tag} item ${n}`, brand: 'Acme', retailer, price: 12.34, was_price: 99.99, currency: 'GBP',
    stock_status: 'in_stock', image_url: `https://img.example/${tag}/${n}.jpg`, delivers_to: ['GB'],
    product_url: `https://${host}/product/${tag}-item-${n}/`, affiliate_url: `https://${host}/out/${n}`, ...extra
  });
  return [
    base(1), base(2, { stock_status: 'check_retailer' }), base(3, { delivers_to: ['WORLD'] }),
    base(4, { product_name: 'Shared name in every site' }),
    base(5, { product_name: 'Christmas Sale bundle' }), base(6, { product_name: 'Cotton tee 100% cotton' }),
    base(7, { product_name: 'Gift box £20' }), base(8, { product_name: 'Works with Amazon Alexa' }),
    base(9, { stock_status: 'out_of_stock' }), base(10, { delivers_to: ['DE'] }),
    base(11, { image_url: `http://img.example/${tag}/11.jpg` }), base(12, { product_url: 'https://evil.example/product/x/' }),
    base(13, { retailer: 'Someone Else' }), base(14, { product_url: `https://${host}/out/14` })
  ];
}
function makeFetch({ fail = [], hang = [], empty = [] } = {}) {
  const calls = [];
  const f = async (input, init = {}) => {
    const u = new URL(String(input));
    calls.push({ url: u, init });
    if (fail.includes(u.hostname)) throw new Error('network down');
    if (hang.includes(u.hostname)) {
      return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    const rows = empty.includes(u.hostname) ? [] : fakeRows(u.hostname, u.searchParams.get('retailer'));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  f.calls = calls;
  return f;
}
function makeCache() {
  const m = new Map();
  return {
    m,
    async match(key) { const r = m.get(String(key)); return r ? r.clone() : undefined; },
    async put(key, res) { m.set(String(key), res.clone()); }
  };
}
const worker = createGuidesWorker(site, { fetch: makeFetch(), cache: null, now: () => NOW });

const LIVE = 'https://megastoresgearworld.com';
const PREVIEW = 'https://mega-stores-gear-world-preview.example.workers.dev';
const ON = { AMAZON_LINKS: 'on' };
const OFF = {};
const PRE = { AMAZON_LINKS: 'preview' };

async function get(path, env = ON, base = LIVE, method = 'GET') {
  const r = await worker.fetch(new Request(base + path, { method }), env);
  return { r, text: method === 'HEAD' ? '' : await r.text() };
}

// The retailers' own code lines ("£50 off when you spend £500", lessons L186, L195) are the only text with £ or %: the
// wording checks read the page without them, and check them on their own (retailerLines).
export const withoutOffers = text => text.replace(/<p class="promo-offer">[\s\S]*?<\/p>/g, '');
export const retailerLines = text => [...text.matchAll(/<p class="promo-offer">([\s\S]*?)<\/p>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
const RETAILER_LINE = /^(£\d+|\d+%) off (when you spend £\d+(, on selected products)?|your order)$|^For [A-Za-z]+ products, when you spend £\d+ or more on [A-Za-z]+$|^On your order, no minimum spend$/;

const ALL_GUIDES = [...site.guides.map(g => g.slug), site.checks.slug];
const STORE_PAGES = awinStores(site).map(s => `/stores/${s.slug}/`);
// The stores of the UK page (L210: the Greek stores show only to visitors from Greece and Cyprus).
const UK_STORES = awinStores(site).filter(s => deliversHere(s, 'GB'));
const UK_STORE_PAGES = UK_STORES.map(s => `/stores/${s.slug}/`);
// The Greek stores of the Linkwise network (owner, 21 Nov 2026, L210), with the countries of the sites' linkwise-gr.js.
const GREEK = { 'kouzinika-gr': ['GR'], 'katoikein-gr': ['GR'], 'minipini-gr': ['GR'], 'xxxl-leo-gr': ['GR'], 'casualshoes-gr': ['GR'], 'parex-gr': ['GR', 'CY'], 'tsakiris-mallas-gr': ['GR', 'CY'] };
// The stores of the editions of Germany, Austria, the Netherlands, Belgium, the US and Poland (L232).
const NEW_STORES = awinStores(site).filter(s => !deliversHere(s, 'GB') && !GREEK[s.slug]);
const ALL_PAGES = ['/', ...ALL_GUIDES.map(s => `/guides/${s}/`), ...legalPaths(), ...STORE_PAGES];

test('every page answers 200 with the security headers, no script, no cookie and no price', async () => {
  for (const env of [ON, OFF, PRE]) {
    for (const p of ALL_PAGES) {
      const { r, text } = await get(p, env);
      assert.equal(r.status, 200, p);
      assert.equal(r.headers.get('Content-Type'), 'text/html; charset=utf-8', p);
      assert.ok(r.headers.get('Content-Security-Policy'), `${p}: CSP`);
      assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff', p);
      assert.ok(!r.headers.get('Set-Cookie'), `${p}: no cookie`);
      assert.ok(!/<script/i.test(text), `${p}: no script`);
      assert.ok(!/£|\bGBP\b/.test(withoutOffers(text)), `${p}: no price (the marketplace page has the price)`);
      for (const l of retailerLines(text)) assert.match(l, RETAILER_LINE, `${p}: only the retailer's own code wording`);
      assert.equal(r.headers.get('Content-Language'), 'en-GB', `${p}: English without ?lang=`);
      assert.ok(text.replace(/<[^>]+>/g, '').includes('Run by Evangelos Kalogerakis, United Kingdom'), `${p}: who runs the site (L101)`);
      for (const href of ['/about/', '/how-we-make-money/', '/privacy/', '/cookies/', '/terms/']) assert.ok(text.includes(`href="${href}"`), `${p}: footer ${href} (L17)`);
      assert.ok(text.includes(`&copy; ${new Date().getUTCFullYear()}`), `${p}: year in the footer (L17)`);
      assert.ok(text.includes(`<link rel="canonical" href="https://megastoresgearworld.com${p}">`), `${p}: canonical`);
    }
  }
});

test('Amazon links only with AMAZON_LINKS=on: amazon.co.uk search with the Associates ID, sponsored, and the statement', async () => {
  assert.equal(amazonMode(ON), 'on');
  assert.equal(amazonMode(PRE), 'preview');
  assert.equal(amazonMode(OFF), 'off');
  assert.equal(amazonMode({ AMAZON_LINKS: 'yes' }), 'off', 'only the exact values');
  assert.equal(amazonUrl(site, 'air fryer', 'on'), 'https://www.amazon.co.uk/s?k=air+fryer&tag=gearworld04-21');
  assert.equal(amazonUrl(site, 'air fryer', 'preview'), 'https://www.amazon.co.uk/s?k=air+fryer', 'the test address links without the ID');
  assert.equal(amazonUrl(site, 'air fryer', 'off'), '');
  assert.equal(amazonUrl({ ...site, amazon: { host: 'www.amazon.co.uk', tag: 'bad tag' } }, 'x', 'on'), '', 'a wrong ID gives no link');
  assert.equal(amazonUrl(site, 'kids & "toys"', 'on'), 'https://www.amazon.co.uk/s?k=kids+%26+%22toys%22&tag=gearworld04-21', 'the words are encoded');

  for (const g of site.guides) {
    const on = (await get(`/guides/${g.slug}/`, ON)).text;
    const links = on.match(/<a class="btn btn-market" href="[^"]*" rel="[^"]*" target="_blank">See prices on Amazon<\/a>/g) || [];
    assert.equal(links.length, g.ideas.length, `${g.slug}: one Amazon button per idea`);
    for (const l of links) {
      assert.match(l, /href="https:\/\/www\.amazon\.co\.uk\/s\?k=[^"&]+&amp;tag=gearworld04-21"/, `${g.slug}: amazon.co.uk with the ID`);
      assert.match(l, /rel="sponsored nofollow noopener"/, `${g.slug}: sponsored link`);
      assert.ok(!/\/out\/|\/go\//.test(l), `${g.slug}: never through a redirect of ours`);
    }
    assert.ok(on.includes(AMAZON_STATEMENT), `${g.slug}: the Amazon statement`);
    assert.ok(on.indexOf(AMAZON_STATEMENT) < on.indexOf('See prices on Amazon'), `${g.slug}: the statement before the first link`);

    const pre = (await get(`/guides/${g.slug}/`, PRE)).text;
    assert.ok(pre.includes('https://www.amazon.co.uk/s?k='), `${g.slug}: the test address shows the buttons`);
    assert.ok(!pre.includes('tag='), `${g.slug}: the test address never carries the Associates ID`);

    const off = (await get(`/guides/${g.slug}/`, OFF)).text;
    assert.ok(!/amazon/i.test(off), `${g.slug}: without the phrase no Amazon at all`);
  }
  for (const p of ALL_PAGES) {
    const on = (await get(p, ON)).text;
    assert.ok(on.includes(AMAZON_STATEMENT), `${p}: the statement in the footer when Amazon links are on`);
    assert.ok(!/amazon/i.test((await get(p, OFF)).text), `${p}: no Amazon text when off`);
    assert.ok(!(await get(p, PRE)).text.includes(AMAZON_STATEMENT), `${p}: no statement on the test address (no Associates link there)`);
  }
});

test('without Amazon links no page says it links to marketplaces (claims that are not true, L107)', async () => {
  for (const p of ALL_PAGES.filter(p => p !== `/guides/${site.checks.slug}/`)) {
    const off = (await get(p, OFF)).text;
    assert.ok(!/marketplace/i.test(off.replace(/<[^>]+>/g, ' ')), `${p}: no "marketplace" when there are no marketplace links`);
    assert.ok(!/#ad/.test(off), `${p}: no #ad when the site has no affiliate links of its own`);
  }
  const home = (await get('/', OFF)).text;
  assert.match(home, /<title>Stores and gift guides \| Mega Stores Gear World<\/title>/);
  assert.match(home, /Every idea opens the matching category of a Gear World site/);
  assert.match((await get('/how-we-make-money/', OFF)).text, /this site has no affiliate links of its own/);
  for (const env of [ON, PRE]) assert.match((await get('/', env)).text, /Every idea opens a search on a big marketplace/);
});

test('every idea links to a category page of a Gear World site that exists in that site\'s config', async () => {
  const configs = {};
  for (const w of GEAR_WORLDS) configs[w.code] = (await import(`../../sites/${w.code.toLowerCase()}/site.config.js`)).default;
  let n = 0;
  for (const g of site.guides) {
    assert.equal(g.ideas.length, 8, `${g.slug}: 8 ideas`);
    for (const i of g.ideas) {
      const s = configs[i.gw];
      assert.ok(s, `${g.slug} / ${i.name}: ${i.gw} is a Gear World site`);
      assert.ok((s.categories || []).some(c => c.slug === i.cat), `${g.slug} / ${i.name}: ${i.gw} has the category ${i.cat}`);
      assert.equal(gearWorldUrl(i.gw, i.cat), `https://${s.domain}/category/${i.cat}/`);
      assert.ok(i.q && i.q.length <= 60 && i.why && i.name, `${g.slug} / ${i.name}: search words, a reason and a name`);
      n++;
    }
    const page = (await get(`/guides/${g.slug}/`, OFF)).text;
    assert.equal((page.match(/class="btn btn-gw"/g) || []).length, g.ideas.length, `${g.slug}: one Gear World button per idea, Amazon or not`);
  }
  assert.equal(n, 80);
  assert.equal(new Set(site.guides.map(g => g.slug)).size, site.guides.length, 'unique guide addresses');
  assert.equal(gearWorldUrl('XYZ', 'audio'), '');
  assert.equal(gearWorldUrl('TGW', '../x'), '', 'only a plain category slug');
});

test('wording: we compare, we do not sell (L101, L103, L107); Black Friday only as a date, never a promise', async () => {
  const BANNED = /\bshop\b|\bshopping\b|\bcart\b|\bbasket\b|buy now|shop now|\bofficial\b|\bpartners?\b|\btrusted\b|free delivery|we deliver|uk retailers|uk sites|compare uk prices|\bdeals?\b|\bsale\b|\bsave\b|\d\s?%|lowest price|best price|price drop|\bwas £|we tested|\bdiscounts?\b|\boffers?\b|\bcheapest\b|\bguaranteed?\b/i;
  for (const env of [ON, OFF]) {
    for (const p of ALL_PAGES) {
      const text = withoutOffers((await get(p, env)).text).replace(/<[^>]+>/g, ' ');
      const m = text.match(BANNED);
      assert.ok(!m, `${p}: "${m && m[0]}"`);
    }
  }
  const css = readFileSync('sites/ogw/public/assets/ogw.css', 'utf8');
  assert.ok(!/#5ee08f|#ff8a98|\bred\b|\bgreen\b/i.test(css), 'no red or green in the styles (L35)');
  for (const g of [...site.guides, site.checks]) assert.ok(!/black friday (deals|discounts|sale|offers)/i.test(JSON.stringify(g)), g.slug);
});

test('countdown: Black Friday, the weekend, then Christmas, by the day in London', () => {
  const at = iso => new Date(iso);
  assert.equal(ukDay(at('2026-11-26T23:30:00Z')), '2026-11-26');
  assert.equal(ukDay(at('2026-06-30T23:30:00Z')), '2026-07-01', 'British Summer Time');
  assert.equal(countdown(site, at('2026-11-17T12:00:00Z')), 'Black Friday: 27 Nov · 10 days to go');
  assert.equal(countdown(site, at('2026-11-26T12:00:00Z')), 'Black Friday: 27 Nov · 1 day to go');
  assert.equal(countdown(site, at('2026-11-27T00:30:00Z')), 'Black Friday and Cyber Monday: 27 Nov to 30 Nov');
  assert.equal(countdown(site, at('2026-11-30T22:00:00Z')), 'Black Friday and Cyber Monday: 27 Nov to 30 Nov');
  assert.equal(countdown(site, at('2026-12-01T09:00:00Z')), 'Christmas: 24 days to go');
  assert.equal(countdown(site, at('2026-12-24T09:00:00Z')), 'Christmas: 1 day to go');
  assert.equal(countdown(site, at('2026-12-25T09:00:00Z')), 'Happy Christmas');
  assert.equal(countdown(site, at('2026-12-26T09:00:00Z')), '');
});

test('addresses: www, final slash, unknown pages, methods, robots, sitemap and version', async () => {
  let x = await get('/guides/tech-gift-ideas/', ON, 'https://www.megastoresgearworld.com');
  assert.equal(x.r.status, 301);
  assert.equal(x.r.headers.get('Location'), 'https://megastoresgearworld.com/guides/tech-gift-ideas/');
  x = await get('/guides/tech-gift-ideas');
  assert.equal(x.r.status, 301);
  assert.equal(x.r.headers.get('Location'), 'https://megastoresgearworld.com/guides/tech-gift-ideas/');
  x = await get('/privacy');
  assert.equal(x.r.status, 301);
  x = await get('/guides/');
  assert.equal(x.r.status, 302);
  assert.equal(x.r.headers.get('Location'), 'https://megastoresgearworld.com/#guides');
  x = await get('/guides/not-a-guide/');
  assert.equal(x.r.status, 404);
  assert.match(x.text, /<meta name="robots" content="noindex">/);
  x = await get('/wp-login.php');
  assert.equal(x.r.status, 404);
  x = await get('/', ON, LIVE, 'POST');
  assert.equal(x.r.status, 405);
  x = await get('/', ON, LIVE, 'HEAD');
  assert.equal(x.r.status, 200);

  x = await get('/robots.txt');
  assert.equal(x.text, 'User-agent: *\nAllow: /\n\nSitemap: https://megastoresgearworld.com/sitemap.xml\n');
  x = await get('/sitemap.xml');
  for (const p of pagePaths(site, 'on')) assert.ok(x.text.includes(`<loc>https://megastoresgearworld.com${p}</loc>`), p);
  // Every page of the UK view and the Amazon page (L210), and the Greek edition: /gr/ and its 7 store pages (L214).
  // Since L232 the six new editions too: each home page and its store pages (tests/worker/ogw-editions-l232.test.mjs).
  const newEditions = EDITIONS.filter(e => e.minStores).reduce((n, e) => n + 1 + editionStores(site, e).length, 0);
  assert.equal(newEditions, 7 + 46);
  assert.equal((x.text.match(/<loc>/g) || []).length, ALL_PAGES.length - NEW_STORES.length - Object.keys(GREEK).length + 1 + 1 + Object.keys(GREEK).length + newEditions
    + site.stores.find(t => t.slug === 'aliexpress-uk').categories.length, 'the UK view, Amazon, /gr/, the editions of L232 and the categories of AliExpress UK (L242)');
  for (const p of UK_STORE_PAGES) assert.ok(x.text.includes(`<loc>https://megastoresgearworld.com${p}</loc>`), `sitemap: ${p}`);
  for (const slug of Object.keys(GREEK)) {
    assert.ok(!x.text.includes(`<loc>https://megastoresgearworld.com/stores/${slug}/</loc>`), `sitemap: not the UK address of ${slug} (Google reads the UK page, L210)`);
    assert.ok(x.text.includes(`<loc>https://megastoresgearworld.com/gr/stores/${slug}/</loc>`), `sitemap: ${slug} at /gr/ (L214)`);
  }
  assert.ok(x.text.includes('<loc>https://megastoresgearworld.com/stores/amazon/</loc>'), 'the Amazon page with Amazon links on');
  for (const env of [OFF, PRE]) {
    const t = (await get('/sitemap.xml', env)).text;
    assert.ok(!/amazon/i.test(t), 'no Amazon page in the sitemap without the live Amazon links');
    assert.equal((t.match(/<loc>/g) || []).length, ALL_PAGES.length - NEW_STORES.length - Object.keys(GREEK).length + 1 + Object.keys(GREEK).length + newEditions
      + site.stores.find(t => t.slug === 'aliexpress-uk').categories.length, 'with /gr/ and its store pages (L214), the editions of L232 and the categories of AliExpress UK (L242)');
  }
  x = await defaultWorker.fetch(new Request(`${LIVE}/api/version`), { GW_COMMIT: 'ab'.repeat(20) });
  assert.deepEqual(await x.json(), { commit: 'ab'.repeat(20) }, 'the version for the live guard (L156)');

  // The test address (*.workers.dev) is never indexed.
  x = await get('/', PRE, PREVIEW);
  assert.equal(x.r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  x = await get('/robots.txt', PRE, PREVIEW);
  assert.equal(x.text, 'User-agent: *\nDisallow: /\n');
  x = await get('/', ON);
  assert.equal(x.r.headers.get('X-Robots-Tag'), null);
});

test('legal pages: UK and EU GDPR, no cookies of our own, the affiliate links explained, who to contact', async () => {
  const privacy = (await get('/privacy/')).text;
  assert.match(privacy, /UK GDPR and the Data Protection Act 2018/);
  assert.match(privacy, /EU General Data Protection Regulation \(GDPR\)/);
  assert.match(privacy, /data protection authority of the country where you live/);
  assert.match(privacy, /mailto:contact@gearworldhub\.com/);
  assert.match((await get('/cookies/')).text, /sets no advertising, analytics or tracking cookies/);
  const money = (await get('/how-we-make-money/')).text;
  assert.ok(money.includes(AMAZON_STATEMENT) && money.includes('Amazon and the Amazon logo are trademarks'));
  assert.match(money, /nobody pays to be in a guide/);
  assert.match((await get('/terms/')).text, /mandatory consumer laws of the country where you live/);
  const about = (await get('/about/')).text;
  assert.match(about, /We do not track prices or send price alerts/, 'Amazon Associates 6(y)');
  const home = (await get('/')).text;
  assert.match(home, /we do not track prices/, 'the home page says it too');
  for (const g of site.guides) assert.match((await get(`/guides/${g.slug}/`)).text, /<strong>#ad<\/strong>/, `${g.slug}: #ad at the top`);
});

test('the site folder: only the allowed public files (L04), no database or test address on the live Worker (L106)', () => {
  const pub = 'sites/ogw/public';
  const walk = d => readdirSync(d).flatMap(n => { const f = join(d, n); return statSync(f).isDirectory() ? walk(f) : [f]; });
  const files = walk(pub).map(f => relative(pub, f).split('\\').join('/')).sort();
  const allowed = readFileSync('sites/ogw/public-allowlist.txt', 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')).sort();
  assert.deepEqual(files, allowed);
  const cfg = readFileSync('sites/ogw/wrangler.jsonc.example', 'utf8');
  assert.match(cfg, /"name": "mega-stores-gear-world",/);
  assert.match(cfg, /"workers_dev": false,/);
  assert.match(cfg, /"preview_urls": false,/);
  assert.match(cfg, /"observability": \{ "enabled": true \}/, 'the tool adds the domains after this line');
  assert.ok(!/d1_databases|kv_namespaces|account_id|routes/.test(cfg));
  assert.ok(!('code' in site), 'no code field: the shop-site lists (tools/gwh-deals.mjs) must not count this site');
});

test('tools/ogw-site.ps1: UTF-8 BOM and CRLF, the four phrases, the live guard, the clean preview before live', () => {
  const buf = readFileSync('tools/ogw-site.ps1');
  assert.deepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM');
  const ps = buf.toString('utf8');
  assert.ok(!/[^\r]\n/.test(ps), 'CRLF only');
  for (const p of ['ΕΓΚΡΙΝΩ OGW PREVIEW', 'ΕΓΚΡΙΝΩ OGW LIVE', 'ΕΓΚΡΙΝΩ OGW AMAZON LINKS', 'ΕΓΚΡΙΝΩ OGW REMOVE PREVIEW']) assert.ok(ps.includes(`'${p}'`), p);
  assert.match(ps, /Assert-GwLiveGuard @\(\$Domain\) \$repo/, 'L156 before an update of a live site');
  assert.match(ps, /if \(\$AfterPreview -and -not \(Test-PreviewReport\)\) \{ Finish 23 \}/);
  assert.match(ps, /--var AMAZON_LINKS:preview/, 'the test Worker links without the ID');
  assert.match(ps, /--var AMAZON_LINKS:\{1\}/);
  assert.ok(!/GW_GUARD_TEST_/.test(ps), 'never the guard test hooks');
  assert.ok(!/\?\?|&&|\|\||-AsHashtable|-Parallel/.test(ps.replace(/'[^'\r\n]*'/g, "''")), 'Windows PowerShell 5.1 syntax');
  // L208: the chat that gave the command (-Chat), the Manager by default.
  assert.ok(ps.includes("[string]$Chat = '1 · Gear World Manager'") && ps.includes('Πήγαινε στη συζήτηση με το Claude «{0}» και πάτα Ctrl+V.'), 'the clipboard line names the chat');
  assert.ok(ps.includes("Get-Page ($base + '/stores/joybuy/')") && ps.includes("Get-Page ($base + '/stores/amazon/')"), 'the store page and the Amazon page in every check (L191)');
  assert.ok(ps.includes('href="[^"]*/(out|go)/') && ps.includes('[char]0x00A3'), 'no /out/, /go/ or £ on the store page');
});

// ---------------- Stores (owner, 18 Nov 2026, «ΕΓΚΡΙΝΩ MEGA STORES ΜΠΑΡΑ», lessons L191) ----------------
const GW_HOSTS = new Set(GEAR_WORLDS.map(w => new URL(w.url).hostname));
const STORE_BANNED = /£|\$|€|\bGBP\b|\d\s?%|12\.34|99\.99|\bdeals?\b|\bsale\b|\bsave\b|\bshop\b|buy now|\bcart\b|\bofficial\b|\bpartners?\b|lowest price|free delivery/i;

test('stores: config, order, logos as the stores give them, the world photos of the Amazon page', () => {
  assert.deepEqual(site.stores.map(s => s.slug), ['amazon', 'aliexpress-uk', 'joybuy', 'tooled-up', 'my-tool-shed', 'pchub-uk', 'gs-workwear', 'back-to-the-office', 'dhgate',
    'kotsovolos-gr', 'public-gr', 'sephora-gr', 'e-shop-gr', 'ab-gr', ...Object.keys(GREEK), ...NEW_STORES.map(s => s.slug)], 'the 5 direct stores of L226 before the 7 Greek stores (owner, 24 Nov 2026), then the stores of the editions of L232');
  assert.deepEqual(site.stores.map(s => s.name), ['Amazon', 'AliExpress UK', 'Joybuy', 'Tooled Up', 'My Tool Shed', 'PCHUB.UK', 'GS Workwear', 'Back to the Office', 'DHgate',
    'Κωτσόβολος', 'Public', 'Sephora', 'e-shop.gr', 'ΑΒ Βασιλόπουλος',
    'Kouzinika GR', 'Katoikein GR', 'Minipini GR', 'XXXL Leo GR', 'CasualShoes GR', 'Parex GR', 'Tsakiris Mallas GR', ...NEW_STORES.map(s => s.name)]);
  const codes = new Set(GEAR_WORLDS.map(w => w.code));
  const allowed = readFileSync('sites/ogw/public-allowlist.txt', 'utf8');
  for (const s of awinStores(site)) {
    assert.ok(s.sites.length && s.sites.every(c => codes.has(c)), `${s.slug}: Gear World sites`);
    if (NEW_STORES.includes(s)) continue;
    assert.deepEqual(s.deliversTo, GREEK[s.slug] || ['GB'], `${s.slug}: ${GREEK[s.slug] ? 'a Greek store, its countries' : 'a UK store'}`);
    assert.ok(s.line && s.line.length < 90, `${s.slug}: one short line`);
    if (s.logo) {
      assert.ok(statSync(`sites/ogw/public/assets/${s.logo}`).size > 0 && allowed.includes(`assets/${s.logo}`), `${s.slug}: logo file in public/ and the allowlist`);
      assert.equal(s.logoSize.length, 2);
    }
  }
  const amazon = site.stores.find(s => s.slug === 'amazon');
  assert.ok(!amazon.logo, 'Amazon: text only (Trademark Guidelines)');
  assert.equal(site.amazon.linkImage, '', 'the Amazon image slot stays empty until Amazon supplies the file');
  assert.equal(site.stores.find(s => s.slug === 'dhgate').logo, '', 'DHgate: text badge');
  // AliExpress UK (L241): the UK only, on all 13 sites, a text badge.
  const ali = site.stores.find(s => s.slug === 'aliexpress-uk');
  assert.deepEqual([ali.name, ali.deliversTo, ali.logo, ali.sites.length], ['AliExpress UK', ['GB'], '', 13]);
  for (const g of site.guides) assert.ok(statSync(`sites/ogw/public/assets/${guideImage(g)}`).size > 0 && allowed.includes(`assets/${guideImage(g)}`), `${g.slug}: its Gear World photo`);
  assert.equal(guideImage(site.guides[0]), 'worlds/mgw.jpg');
});

test('store page: product photos with the Gear World product page, never a price, /out/, /go/ or a word of a shop', async () => {
  const f = makeFetch();
  const w = createGuidesWorker(site, { fetch: f, cache: null, now: () => NOW });
  for (const env of [ON, OFF, PRE]) {
    const r = await w.fetch(new Request(`${LIVE}/stores/joybuy/`), env);
    assert.equal(r.status, 200);
    const text = await r.text();
    assert.match(text, /<h1><span translate="no">Joybuy<\/span> on <span translate="no">Mega Stores Gear World<\/span><\/h1>/);
    assert.match(text, /The buttons on this page open product pages of the Gear World sites/, 'the disclosure note');
    const cards = text.match(/<li class="pcard">[\s\S]*?<\/li>/g) || [];
    assert.equal(cards.length, 6 * 3 + 1, '6 sites read, 3 good rows each, the shared name once');
    for (const c of cards) {
      assert.match(c, /<img src="https:\/\/img\.example\/[^"]+" alt="[^"]+" width="240" height="240" loading="lazy" decoding="async" referrerpolicy="no-referrer">/);
      const hrefs = [...c.matchAll(/href="([^"]+)"/g)].map(m => new URL(m[1].replace(/&amp;/g, '&')));
      assert.equal(hrefs.length, 2);
      for (const h of hrefs) {
        assert.ok(GW_HOSTS.has(h.hostname) && h.pathname.startsWith('/product/'), `a Gear World product page: ${h}`);
      }
      assert.match(c, /<h2 class="pcard-name" translate="no">/);
      assert.match(c, /<p class="pcard-site">On <span translate="no">[^<]+ Gear World<\/span><\/p>/);
      assert.match(c, /><span>See it on <span translate="no">[^<]+ Gear World<\/span><\/span><\/a>/);
    }
    assert.ok(!/\/out\/|\/go\//.test(text), 'never an /out/ or /go/ link');
    const visible = withoutOffers(text).replace(/<[^>]+>/g, ' ');
    const m = visible.match(STORE_BANNED);
    assert.ok(!m, `no price or shop word: "${m && m[0]}"`);
    for (const left of ['Christmas Sale', '100% cotton', 'Gift box', 'Alexa', 'item 9<', 'item 10<', 'item 11', 'item 12', 'item 13', 'item 14', 'evil.example']) assert.ok(!text.includes(left), `left out: ${left}`);
    if (env === OFF) assert.ok(!/amazon/i.test(text), 'with Amazon off no word of Amazon');
    // Every link of the page: this site, a Gear World site or the ICO (legal footer); the round-robin order.
    for (const h of [...text.matchAll(/href="(https?:[^"]+)"/g)].map(x => new URL(x[1].replace(/&amp;/g, '&')))) {
      assert.ok(GW_HOSTS.has(h.hostname) || h.hostname === 'megastoresgearworld.com' || h.hostname === 'gearworldhub.com' || h.hostname === 'ico.org.uk', `link: ${h}`);
    }
    const sites = cards.slice(0, 6).map(c => c.match(/pcard-site">On <span translate="no">([^<]+)<\/span>/)[1]);
    assert.equal(new Set(sites).size, 6, 'the sites one after another');
    // One link per site of the store to its search, filtered by the store.
    for (const code of site.stores.find(s => s.slug === 'joybuy').sites) {
      assert.ok(text.includes(`href="https://${hostOf(code)}/search?q=Joybuy&amp;retailer=Joybuy"`), `search link on ${code}`);
    }
    // Joybuy's Black Friday coupons (16-30 Nov, L187): their cards link to its /discount-codes/ page on Women's Gear
    // World; the site links below list codes to type only, so no "voucher codes" link for Joybuy (L114).
    assert.equal((text.match(/<li class="promo-card" data-end="2026-11-30">/g) || []).length, 2, 'the two Joybuy coupons, until 30 Nov');
    assert.ok(!/voucher codes on/.test(text), 'Joybuy has coupons, not codes to type: no voucher codes link');
    for (const h of [...text.matchAll(/href="([^"]*\/discount-codes\/[^"]*)"/g)].map(m => m[1])) assert.equal(h, 'https://womensgearworld.com/discount-codes/joybuy/');
  }
  // The request to the sites: the store, the UK, the badges, 8 products, our name; at most 6 sites.
  const joy = f.calls.filter(c => c.url.searchParams.get('retailer') === 'Joybuy');
  assert.equal(joy.length, 18, '6 sites per page, 3 pages');
  for (const c of joy) {
    assert.equal(c.url.pathname, '/api/products');
    assert.equal(c.url.searchParams.get('deliver_to'), 'GB');
    assert.equal(c.url.searchParams.get('badges'), '1');
    assert.equal(c.url.searchParams.get('limit'), '8');
    assert.equal(c.init.headers['User-Agent'], 'MegaStoresGearWorld/1.0 (+https://megastoresgearworld.com)');
    assert.equal(storeUserAgent(site), c.init.headers['User-Agent']);
    assert.ok(GW_HOSTS.has(c.url.hostname));
  }
  const tu = await (await w.fetch(new Request(`${LIVE}/stores/tooled-up/`), ON)).text();
  for (const code of ['CGW', 'AGW', 'GGW', 'BGW']) assert.ok(tu.includes(`href="https://${hostOf(code)}/discount-codes/tooled-up/"`), `Tooled Up codes on ${code}`);
  assert.match(tu, /Tooled Up<\/span> voucher codes on <span translate="no">Construction Gear World<\/span>/);
  const pc = await (await w.fetch(new Request(`${LIVE}/stores/pchub-uk/`), ON)).text();
  assert.ok(!pc.includes('/discount-codes/'), 'no codes link without codes');
  const dh = await (await w.fetch(new Request(`${LIVE}/stores/dhgate/`), ON)).text();
  assert.match(dh, /<span class="store-badge" translate="no">DHgate<\/span>|<h1><span translate="no">DHgate<\/span>/);
  // Addresses: without the slash, unknown store, /stores/.
  let x = await w.fetch(new Request(`${LIVE}/stores/joybuy`), ON);
  assert.equal(x.status, 301);
  assert.equal(x.headers.get('Location'), `${LIVE}/stores/joybuy/`);
  x = await w.fetch(new Request(`${LIVE}/stores/nobody/`), ON);
  assert.equal(x.status, 404);
  x = await w.fetch(new Request(`${LIVE}/stores/`), ON);
  assert.equal(x.status, 302);
  assert.equal(x.headers.get('Location'), `${LIVE}/#stores`);
});

test('store page: a failing or slow site does not break the page; nothing at all gives the short line and the links', async () => {
  const joy = site.stores.find(s => s.slug === 'joybuy');
  const hosts = joy.sites.slice(0, 6).map(hostOf);
  const f = makeFetch({ fail: [hosts[0]], hang: [hosts[1]], empty: [hosts[2]] });
  const w = createGuidesWorker(site, { fetch: f, cache: null, now: () => NOW, timeoutMs: 30 });
  const t0 = Date.now();
  const r = await w.fetch(new Request(`${LIVE}/stores/joybuy/`), ON);
  assert.ok(Date.now() - t0 < 2000, 'the slow site is given up');
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.equal((text.match(/<li class="pcard">/g) || []).length, 3 * 3 + 1);
  assert.ok(!text.includes('could not be loaded'));

  const all = joy.sites.slice(0, 6).map(hostOf);
  const w2 = createGuidesWorker(site, { fetch: makeFetch({ fail: all }), cache: null, now: () => NOW });
  const r2 = await w2.fetch(new Request(`${LIVE}/stores/joybuy/`), OFF);
  assert.equal(r2.status, 200);
  const t2 = await r2.text();
  assert.match(t2, /Products could not be loaded just now\./);
  assert.ok(!/class="pcard"/.test(t2));
  for (const code of joy.sites) assert.ok(t2.includes(`https://${hostOf(code)}/search?q=Joybuy`), `still the link to ${code}`);
  const home = await (await w2.fetch(new Request(`${LIVE}/`), OFF)).text();
  assert.match(home, /id="stores"/, 'the home page still shows the stores');
});

test('store data: kept in the cache 1 hour under a synthetic key, read from there the next time', async () => {
  const f = makeFetch();
  const cache = makeCache();
  const w = createGuidesWorker(site, { fetch: f, cache, now: () => NOW });
  const waits = [];
  const ctx = { waitUntil: p => waits.push(p) };
  const first = await (await w.fetch(new Request(`${LIVE}/stores/tooled-up/`), ON, ctx)).text();
  await Promise.all(waits);
  const n = f.calls.length;
  assert.equal(n, 4, 'Tooled Up: its 4 sites');
  const key = storeCacheKey(site, site.stores.find(s => s.slug === 'tooled-up'));
  assert.equal(key, `https://megastoresgearworld.com/__cache/stores/tooled-up?v=${site.assetVersion}`);
  const kept = cache.m.get(key);
  assert.ok(kept, 'kept under the synthetic key');
  assert.equal(kept.headers.get('Cache-Control'), 'public, max-age=3600');
  const data = await kept.clone().json();
  assert.ok(!/price|affiliate|\/out\//.test(JSON.stringify(data)), 'the copy holds no price and no affiliate link');
  const second = await (await w.fetch(new Request(`${LIVE}/stores/tooled-up/`), ON, ctx)).text();
  assert.equal(f.calls.length, n, 'the second visit reads the cache');
  assert.equal(second, first);
  // The home page reads the same copies: every store once, then nothing more.
  await (await w.fetch(new Request(`${LIVE}/`), ON, ctx)).text();
  await Promise.all(waits);
  const afterHome = f.calls.length;
  assert.equal(afterHome - n, UK_STORES.reduce((a, s) => a + Math.min(6, s.sites.length), 0) - 4, 'the UK page reads only the UK stores (L210)');
  await (await w.fetch(new Request(`${LIVE}/`), ON, ctx)).text();
  assert.equal(f.calls.length, afterHome, 'the home page from the cache');
  // Nothing found: kept 1 minute only.
  const c2 = makeCache();
  const w2 = createGuidesWorker(site, { fetch: makeFetch({ fail: ['kidsgearworld.com'] }), cache: c2, now: () => NOW });
  await (await w2.fetch(new Request(`${LIVE}/stores/dhgate/`), ON)).text();
  assert.equal(c2.m.get(storeCacheKey(site, site.stores.find(s => s.slug === 'dhgate'))).headers.get('Cache-Control'), 'public, max-age=60');
});

test('home page: the stores above the gift guides, logos on a tile or a text badge, Amazon text only and only with Amazon links', async () => {
  const w = createGuidesWorker(site, { fetch: makeFetch(), cache: null, now: () => NOW });
  for (const env of [ON, PRE, OFF]) {
    const text = await (await w.fetch(new Request(`${LIVE}/`), env)).text();
    assert.ok(text.indexOf('id="stores"') > 0 && text.indexOf('id="stores"') < text.indexOf('id="guides"'), 'stores above the gift guides');
    assert.match(text, /<a class="top-link" href="\/#stores"><span translate="no">Mega Stores<\/span><\/a>/, 'L208: «Mega Stores», never translated');
    const section = text.slice(text.indexOf('id="stores"'), text.indexOf('id="black-friday"') > 0 ? text.indexOf('id="black-friday"') : text.indexOf('id="guides"'));
    const cards = section.match(/<li class="store-card">[\s\S]*?<p class="store-meta">[^<]*<\/p>\s*<\/li>/g) || [];
    const names = cards.map(c => c.match(/<a class="store-link" href="\/stores\/([a-z0-9-]+)\/">/)[1]);
    const expect = site.stores.filter(s => (s.amazon ? env !== OFF : deliversHere(s, 'GB'))).map(s => s.slug);
    assert.deepEqual(names, expect, 'one card per store, in order');
    for (const c of cards) {
      const slug = c.match(/href="\/stores\/([a-z0-9-]+)\/"/)[1];
      const store = site.stores.find(s => s.slug === slug);
      if (store.amazon) {
        assert.ok(!/<img/.test(c), 'Amazon: text only');
        assert.match(c, /<span class="store-badge" translate="no">Amazon<\/span>/);
        continue;
      }
      if (store.logo) assert.match(c, new RegExp(`<span class="store-logo"><img src="/assets/${store.logo.replace('.', '\\.')}\\?v=[^"]+" alt="${store.name}" width="\\d+" height="\\d+" decoding="async"></span>`));
      else assert.match(c, new RegExp(`<span class="store-badge" translate="no">${store.name}</span>`));
      const thumbs = c.match(/<img src="https:\/\/img\.example[^"]+" alt="" width="96" height="96" loading="lazy"/g) || [];
      assert.equal(thumbs.length, 3, `${slug}: 3 photos`);
    }
    if (env === OFF) assert.ok(!/amazon/i.test(text), 'off: no Amazon anywhere');
  }
});

test('Amazon page: only with Amazon links; the Associates ID only live; our own photos, never an Amazon product photo', async () => {
  const w = createGuidesWorker(site, { fetch: makeFetch(), cache: null, now: () => NOW });
  const on = await (await w.fetch(new Request(`${LIVE}/stores/amazon/`), ON)).text();
  const links = on.match(/<a class="btn btn-market btn-sm" href="[^"]+"[^>]*>See prices on Amazon<\/a>/g) || [];
  assert.equal(links.length, site.guides.reduce((a, g) => a + g.ideas.length, 0), 'every idea of every guide');
  for (const l of links) {
    assert.match(l, /href="https:\/\/www\.amazon\.co\.uk\/s\?k=[^"&]+&amp;tag=gearworld04-21"/);
    assert.match(l, /rel="sponsored nofollow noopener"/);
  }
  assert.ok(on.indexOf(AMAZON_STATEMENT) < on.indexOf('See prices on Amazon'), 'the statement before the first link');
  for (const src of [...on.matchAll(/<img src="([^"]+)"/g)].map(m => m[1])) assert.ok(src.startsWith('/assets/'), `only our own images: ${src}`);
  assert.equal((on.match(/<img class="amz-photo" src="\/assets\/worlds\/[a-z]{3}\.jpg\?v=/g) || []).length, site.guides.length);
  assert.ok(!/\/out\/|\/go\//.test(on));
  assert.ok(!/amz-mark/.test(on), 'no Amazon image while the slot is empty');
  const withMark = createGuidesWorker({ ...site, amazon: { ...site.amazon, linkImage: 'amazon/mark.png' } }, { fetch: makeFetch(), cache: null });
  const marked = await (await withMark.fetch(new Request(`${LIVE}/stores/amazon/`), ON)).text();
  assert.match(marked, /<p class="amz-mark"><img src="\/assets\/amazon\/mark\.png\?v=/, 'the slot, next to the Amazon buttons');
  assert.ok(!/amz-mark/.test(await (await withMark.fetch(new Request(`${LIVE}/stores/amazon/`), PRE)).text()), 'never without the Associates ID');
  assert.ok(!/amz-mark|amazon\/mark/.test(await (await withMark.fetch(new Request(`${LIVE}/`), ON)).text()), 'never on the home page');

  const pre = await (await w.fetch(new Request(`${PREVIEW}/stores/amazon/`), PRE)).text();
  assert.ok(pre.includes('https://www.amazon.co.uk/s?k=') && !pre.includes('tag='), 'the test address: no Associates ID');
  const off = await w.fetch(new Request(`${LIVE}/stores/amazon/`), OFF);
  assert.equal(off.status, 404);
  assert.ok(!/amazon/i.test(await off.text()), 'off: 404 without a word of Amazon');
});
