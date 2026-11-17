// Mega Stores Gear World (megastoresgearworld.com, code OGW): gift guides with links to amazon.co.uk and to the Gear
// World sites. Owner's decision, 17 Nov 2026 (Amazon Associates): no price tracking, no Amazon prices or photos, Amazon
// links straight to amazon.co.uk with the Associates ID only after the owner's phrase (AMAZON_LINKS=on), the Amazon
// statement wherever Amazon links are, and the Google Ads wording rules of the other sites (L101, L103, L107).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import worker from '../../sites/ogw/worker.js';
import site from '../../sites/ogw/site.config.js';
import {
  AMAZON_STATEMENT, amazonMode, amazonUrl, gearWorldUrl, countdown, ukDay, legalPaths, pagePaths
} from '../../src/marketplace-guides.js';
import { GEAR_WORLDS } from '../../promos/network.js';

const LIVE = 'https://megastoresgearworld.com';
const PREVIEW = 'https://mega-stores-gear-world-preview.example.workers.dev';
const ON = { AMAZON_LINKS: 'on' };
const OFF = {};
const PRE = { AMAZON_LINKS: 'preview' };

async function get(path, env = ON, base = LIVE, method = 'GET') {
  const r = await worker.fetch(new Request(base + path, { method }), env);
  return { r, text: method === 'HEAD' ? '' : await r.text() };
}

const ALL_GUIDES = [...site.guides.map(g => g.slug), site.checks.slug];
const ALL_PAGES = ['/', ...ALL_GUIDES.map(s => `/guides/${s}/`), ...legalPaths()];

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
      assert.ok(!/£|\bGBP\b/.test(text), `${p}: no price (the marketplace page has the price)`);
      assert.ok(text.includes('Run by Evangelos Kalogerakis, United Kingdom'), `${p}: who runs the site (L101)`);
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
      const text = (await get(p, env)).text.replace(/<[^>]+>/g, ' ');
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
  assert.equal(countdown(site, at('2026-11-27T00:30:00Z')), 'Black Friday weekend: 27 Nov to 30 Nov');
  assert.equal(countdown(site, at('2026-11-30T22:00:00Z')), 'Black Friday weekend: 27 Nov to 30 Nov');
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
  for (const p of pagePaths(site)) assert.ok(x.text.includes(`<loc>https://megastoresgearworld.com${p}</loc>`), p);
  assert.equal((x.text.match(/<loc>/g) || []).length, ALL_PAGES.length);
  x = await worker.fetch(new Request(`${LIVE}/api/version`), { GW_COMMIT: 'ab'.repeat(20) });
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
  assert.match(money, /no marketplace or retailer pays to be in a guide/);
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
  assert.match(ps, /Πήγαινε στη συζήτηση με το Claude «1 · Gear World Manager» και πάτα Ctrl\+V\./);
});
