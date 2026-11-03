// Google Ads on the 13 sites and the Hub (lessons L93): the Google tag only after "Allow" (consent mode v2), the
// conversion "outbound_click" on /out/ and /go/, and utm_source / utm_campaign passed to Awin as clickref2 / clickref3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker, affiliateTarget } from '../../src/engine.js';
import { GOOGLE_ADS_ID, OUTBOUND_LABEL, GEAR_WORLD_DOMAINS, cleanUtm, campaignRefs } from '../../src/lib/ads.js';

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const FX_FETCH = async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } });
const NOT_SHOPS = new Set(['group', 'gwh', 'posters', 'awin']);
const codes = readdirSync('sites').filter(c => !NOT_SHOPS.has(c) && existsSync(`sites/${c}/site.config.js`));
const NEW_TEXTS = [
  'We would like to use Google cookies to see which of our ads bring visitors to this site. They are set only if you allow them, and you can change your choice at any time.',
  'More about cookies', 'Allow', 'Reject', 'Cookie settings'
];

function fakeD1(code, site) {
  const sql = new DatabaseSync(':memory:');
  const legacy = site.database && site.database.layout === 'legacy';
  sql.exec(readFileSync(legacy ? 'tests/fixtures/ggw-legacy-schema.sql' : `sites/${code}/migrations/0001_init.sql`, 'utf8'));
  const seed = `tests/fixtures/${code}-seed.sql`;
  if (existsSync(seed)) sql.exec(readFileSync(seed, 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => { const r = sql.prepare(text).run(...args); return { meta: { changes: Number(r.changes) } }; }
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}

test('one Google Ads account for the network, every Gear World domain in the linker, the label still empty', () => {
  assert.equal(GOOGLE_ADS_ID, 'AW-18554591090');
  assert.match(OUTBOUND_LABEL, /^[A-Za-z0-9_-]*$/);
  assert.equal(codes.length, 13);
  for (const code of codes) {
    const site = readFileSync(`sites/${code}/site.config.js`, 'utf8').match(/^\s*domain: '([^']+)'/m)[1];
    assert.ok(GEAR_WORLD_DOMAINS.includes(site), `${site} in the linker list`);
  }
  assert.ok(GEAR_WORLD_DOMAINS.includes('gearworldhub.com'));
  const hub = readFileSync('sites/gwh/public/analytics.js', 'utf8');
  assert.match(hub, /const ADS_ID = "AW-18554591090";/);
  for (const d of GEAR_WORLD_DOMAINS.filter(d => d !== 'gearworldhub.com')) assert.ok(hub.includes(`"${d}"`), `Hub knows ${d}`);
});

test('campaign names: only letters, digits, - _ . and up to 40 characters reach Awin', () => {
  assert.equal(cleanUtm('black-friday_2026.uk'), 'black-friday_2026.uk');
  assert.equal(cleanUtm(' google '), 'google');
  assert.equal(cleanUtm('me@example.com'), '');
  assert.equal(cleanUtm('<script>'), '');
  assert.equal(cleanUtm('a b'), '');
  assert.equal(cleanUtm('x'.repeat(60)).length, 40);
  assert.deepEqual(campaignRefs(new URL('https://x.example/out/1?utm_campaign=bf26&utm_source=google')), { clickref2: 'bf26', clickref3: 'google' });
  assert.deepEqual(campaignRefs(new URL('https://x.example/out/1')), {});
});

test('the Awin link gets clickref2 / clickref3 next to our clickref; a plain retailer address gets nothing', () => {
  const refs = { clickref2: 'bf26', clickref3: 'google' };
  const awin = new URL(affiliateTarget('https://www.awin1.com/pclick.php?p=1&a=2&m=3', 'Joybuy', {}, 'tgw-1', refs).toString());
  assert.deepEqual([awin.searchParams.get('clickref'), awin.searchParams.get('clickref2'), awin.searchParams.get('clickref3')], ['tgw-1', 'bf26', 'google']);
  const deep = new URL(affiliateTarget('https://shop.example/p/1', 'Shop', { publisherId: 5, advertisers: { Shop: 7 } }, 'cgw-9', refs).toString());
  assert.equal(deep.hostname, 'www.awin1.com');
  assert.deepEqual([deep.searchParams.get('clickref'), deep.searchParams.get('clickref2'), deep.searchParams.get('clickref3')], ['cgw-9', 'bf26', 'google']);
  const plain = affiliateTarget('https://shop.example/p/1', 'Other', { publisherId: 5, advertisers: {} }, 'cgw-9', refs).toString();
  assert.equal(plain, 'https://shop.example/p/1');
  const kept = new URL(affiliateTarget('https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&clickref2=theirs', 'X', {}, 'tgw-2', refs).toString());
  assert.equal(kept.searchParams.get('clickref2'), 'theirs', 'never over a value the link already has');
  assert.equal(new URL(affiliateTarget('https://www.awin1.com/pclick.php?p=1', 'J', {}, 'tgw-1').toString()).searchParams.has('clickref2'), false);
});

test('TGW: /out/ with a campaign sends it on to Awin, and a bad value is dropped', async () => {
  const site = (await import('../../sites/tgw/site.config.js')).default;
  const worker = createWorker(site);
  const DB = fakeD1('tgw', site);
  const env = { DB, FX_FETCH };
  const go = async q => {
    const r = await worker.fetch(new Request(`https://${site.domain}/out/1${q}`, { headers: { 'User-Agent': PHONE } }), env, { waitUntil() {} });
    assert.equal(r.status, 302);
    return new URL(r.headers.get('Location'));
  };
  const a = await go('?utm_source=google&utm_campaign=black-friday-2026');
  assert.deepEqual([a.searchParams.get('clickref'), a.searchParams.get('clickref2'), a.searchParams.get('clickref3')], ['tgw-1', 'black-friday-2026', 'google']);
  const b = await go('?utm_source=x%40y.com&utm_campaign=%3Cb%3E');
  assert.equal(b.searchParams.has('clickref2') || b.searchParams.has('clickref3'), false);
  const c = await go('');
  assert.equal(c.searchParams.get('clickref'), 'tgw-1');
  assert.equal(c.searchParams.has('clickref2'), false);
});

const tgwConsent = readFileSync('sites/tgw/public/assets/consent.js', 'utf8');

test('consent.js: denied by default, the Google tag only after "Allow", once, no remarketing, conversions only live', () => {
  assert.match(tgwConsent, /gtag\('consent', 'default', \{ ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' \}\)/);
  // The only place that adds the Google tag is loadTag(), called after "Allow" or a saved "granted".
  assert.equal((tgwConsent.match(/googletagmanager\.com\/gtag\/js/g) || []).length, 1);
  assert.match(tgwConsent, /if \(loaded \|\| !\/\^AW-\\d\+\$\/\.test\(ID\)\) return;/);
  assert.match(tgwConsent, /ad_personalization: 'denied', analytics_storage: 'denied' \}\);\n    gtag\('js'/);
  assert.match(tgwConsent, /if \(!loaded \|\| !LABEL \|\| !LIVE\) return;/);
  assert.match(tgwConsent, /if \(choice === 'granted'\) \{ keepUtm\(\); loadTag\(\); \}/);
  assert.match(tgwConsent, /set\('sessionStorage', UTM_KEY/);
  assert.match(tgwConsent, /if \(choice === 'granted' && \(utm\.utm_source \|\| utm\.utm_campaign\)\)/, 'the campaign is kept in the tab only after "Allow"');
});

for (const code of codes) {
  test(`${code.toUpperCase()}: our script once in <head>, no Google request in the page, the banner, Cookie settings, CSP and the texts`, async () => {
    const site = (await import(`../../sites/${code}/site.config.js`)).default;
    assert.notEqual(site.googleAds, false);
    const worker = createWorker(site);
    const DB = fakeD1(code, site);
    const get = path => worker.fetch(new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': PHONE } }), { DB, FX_FETCH }, { waitUntil() {} });
    const home = await get('/');
    const html = await home.text();
    const head = html.slice(0, html.indexOf('</head>'));
    assert.equal((head.match(/\/assets\/consent\.js\?v=/g) || []).length, 1, 'consent.js once, in <head>');
    assert.equal((html.match(/consent\.js/g) || []).length, 1);
    assert.match(head, new RegExp(`<meta name="gw-ads" content="${GOOGLE_ADS_ID}" data-label="${OUTBOUND_LABEL}" data-domain="${site.domain.replace(/\./g, '\\.')}"`));
    assert.doesNotMatch(html, /googletagmanager|googleadservices|doubleclick/, 'nothing from Google in the page itself');
    assert.match(html, /<section class="consent" data-consent hidden aria-label="Cookies">/);
    assert.match(html, /<button type="button" class="consent-btn" data-consent-choice="granted">Allow<\/button>\s*<button type="button" class="consent-btn" data-consent-choice="denied">Reject<\/button>/, 'Allow and Reject look the same');
    assert.match(html, /<button type="button" class="consent-open" data-consent-open hidden>Cookie settings<\/button>/);
    const csp = home.headers.get('Content-Security-Policy');
    assert.match(csp, /script-src [^;]*https:\/\/www\.googletagmanager\.com/);
    assert.match(csp, /connect-src [^;]*https:\/\/www\.google\.com/);
    assert.match(csp, /frame-src [^;]*https:\/\/td\.doubleclick\.net/);
    const cookies = await (await get('/cookies/')).text();
    assert.match(cookies, /Google Ads \(only after &quot;Allow&quot;\)|Google Ads \(only after "Allow"\)/);
    assert.match(cookies, /_gcl_au/);
    assert.doesNotMatch(cookies, /there is no cookie banner/);
    const privacy = await (await get('/privacy/')).text();
    assert.match(privacy, /Google Ads \(Google Ireland Limited\)/);
    assert.match(privacy, /utm_campaign, utm_source/);
    assert.doesNotMatch(privacy, /We do not use advertising or tracking cookies/);
    // The same consent.js as TGW, allowed in public/, with the banner styles, and every new text in every language.
    assert.equal(readFileSync(`sites/${code}/public/assets/consent.js`, 'utf8'), tgwConsent);
    assert.match(readFileSync(`sites/${code}/public-allowlist.txt`, 'utf8'), /^assets\/consent\.js$/m);
    assert.match(readFileSync(`sites/${code}/public/assets/site.css`, 'utf8'), /\.consent-btn \{/);
    for (const f of readdirSync(`sites/${code}/public/assets/i18n`)) {
      const d = JSON.parse(readFileSync(`sites/${code}/public/assets/i18n/${f}`, 'utf8'));
      for (const t of NEW_TEXTS) assert.ok(d[t] && d[t] !== t, `${code} ${f}: "${t.slice(0, 30)}"`);
    }
  });
}

test('Hub: one choice for analytics and ads, Allow and Reject alike, ads only after "Allow", conversions only live with the label', () => {
  const js = readFileSync('sites/gwh/public/analytics.js', 'utf8');
  const index = readFileSync('sites/gwh/public/index.html', 'utf8');
  assert.match(js, /const CONSENT_KEY = "gwh_cookie_consent";/);
  assert.match(js, /if \(savedConsent === "granted"\) \{\s*loadAnalytics\(true\);/);
  assert.match(js, /ad_storage: withAds === true \? "granted" : "denied"/);
  assert.match(js, /ad_personalization: "denied"/);
  assert.doesNotMatch(js, /ad_personalization: "granted"/);
  assert.match(js, /if \(window\.gwhAdsLoaded === true && ADS_LABEL && LIVE\)/);
  assert.match(index, /<script src="\/analytics\.js\?v=20261103-ads1"><\/script>/);
  assert.doesNotMatch(index, /class="secondary"\s*id="gwhAnalyticsReject"/);
  assert.doesNotMatch(index, /googletagmanager/);
  const cookies = readFileSync('sites/gwh/public/cookies/index.html', 'utf8');
  assert.match(cookies, /<code>_gcl_au<\/code>/);
  assert.match(cookies, /<code>gwh_cookie_consent<\/code>/);
  assert.match(readFileSync('sites/gwh/public/privacy/index.html', 'utf8'), /Google Ads \(Google Ireland Limited\)/);
  assert.match(readFileSync('sites/gwh/public/legal/legal.js', 'utf8'), /var KEY = "gwh_cookie_consent";/);
});
