// Lessons L165 (owner, 15 Nov 2026): the shops whose feed is in French, Dutch or German (Zadig&Voltaire, Petit Bateau,
// Teufel, Koffer.de, PUMA) waited, because the sites could not show them only in the countries of their language; and
// the shops that ship only to the US (TEMU US) are seen only by visitors from the US ("Only in the USA").
// A feed language is written in the site config (deliversTo.languages). Such a retailer is shown only to visitors from a
// country it delivers to AND that speaks the language: never in the UK view, never in the all view, never to Google's
// crawlers. The countries that see it get the all view plus that feed (one cached copy per set of countries). Its
// products elsewhere open a true notice ("described in a language other than English ... visitors from these
// countries:"), not "does not deliver to your country". Already on the sites: Reidl (CGW, German), Uhrcenter (MGW and
// WGW, German), VEVOR (AGW, Dutch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker, QA_BOT } from '../../src/engine.js';
import { FEED_LANGUAGES, feedLanguage, shownCountries, deliveryCountries, deliveryConfigProblems } from '../../src/lib/delivery.js';
import { viewFor, hubViewFor, browseView, homeView, countryGroups, hiddenReason, retailerInView, needsUkBar, localOnlyRetailers,
  languageRetailers, LOCAL_ONLY_COUNTRIES, cacheKeyUrl } from '../../src/lib/visibility.js';
import { TEST_DAY } from './test-clock.mjs';

const SITES = readdirSync('sites').filter(n => existsSync(`sites/${n}/site.config.js`) && existsSync(`sites/${n}/public/assets/site.js`));
const config = {};
for (const s of SITES) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const read = f => readFileSync(f, 'utf8');
const NOW = Date.parse(`${TEST_DAY}T12:00:00Z`);
const KEY = '{0} describes this product in a language other than English, so we show it only to visitors from these countries:';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

// A small site: the UK by default, a French feed for the EU, one for everywhere, a German one with Poland too, one that
// also lists the UK, an Italian one, a US-only shop, one for the UK and the US, and an Irish shop in English.
const demo = {
  name: 'Demo', domain: 'demo.example',
  deliversTo: {
    default: ['GB'],
    retailers: { 'Fr EU': ['EU'], 'Fr World': ['WORLD'], 'De Mix': ['DE', 'FR', 'PL'], 'De UK': ['GB', 'DE'], 'It Shop': ['IT', 'CH'], 'Us Only': ['US'], 'Uk Us': ['GB', 'US'], 'Ie Shop': ['IE'] },
    languages: { 'Fr EU': 'fr', 'Fr World': 'fr', 'De Mix': 'de', 'De UK': 'de', 'It Shop': 'it' }
  }
};

test('L165: the countries of each feed language, and the countries a retailer is shown in', () => {
  assert.deepEqual(FEED_LANGUAGES.de, ['DE', 'AT', 'CH', 'LI', 'LU']);
  assert.deepEqual(FEED_LANGUAGES.fr, ['FR', 'BE', 'LU', 'CH', 'CA']);
  assert.deepEqual(FEED_LANGUAGES.nl, ['NL', 'BE']);
  assert.deepEqual(FEED_LANGUAGES.pl, ['PL']);
  for (const [code, list] of Object.entries(FEED_LANGUAGES)) {
    assert.match(code, /^[a-z]{2}$/, code);
    for (const cc of list) assert.ok(deliveryCountries({ deliversTo: { default: [cc] } }, 'x').length === 1, `${code}: ${cc} is a known country`);
  }
  assert.equal(feedLanguage(demo, 'Fr EU'), 'fr');
  assert.equal(feedLanguage(demo, 'Us Only'), '');
  assert.equal(feedLanguage(demo, 'Anyone'), '');
  // The EU code stands for its countries (Switzerland is not one); WORLD for all of them.
  assert.deepEqual(shownCountries(demo, 'Fr EU'), ['FR', 'BE', 'LU']);
  assert.deepEqual(shownCountries(demo, 'Fr World'), ['FR', 'BE', 'LU', 'CH', 'CA']);
  assert.deepEqual(shownCountries(demo, 'De Mix'), ['DE'], 'not France or Poland: German is not spoken there');
  assert.deepEqual(shownCountries(demo, 'De UK'), ['DE'], 'never the UK, even when it delivers there');
  assert.deepEqual(shownCountries(demo, 'It Shop'), ['IT', 'CH']);
  // Without a feed language: where it delivers, as before.
  assert.deepEqual(shownCountries(demo, 'Us Only'), ['US']);
  assert.deepEqual(shownCountries(demo, 'Someone'), ['GB']);
  // The real sites.
  assert.deepEqual(shownCountries(config.cgw, 'Reidl'), ['DE', 'AT']);
  assert.deepEqual(shownCountries(config.agw, 'VEVOR'), ['NL', 'BE']);
  for (const s of ['mgw', 'wgw']) assert.deepEqual(shownCountries(config[s], 'Uhrcenter'), ['DE', 'AT', 'CH', 'LI', 'LU'], s);
  assert.deepEqual(shownCountries(config.vgw, 'VEVOR'), ['EU', 'IS', 'LI', 'NO'], 'VGW: VEVOR in English, where it delivers');
});

test('L165: the config check names a wrong feed language, one without its own countries, one shown nowhere', () => {
  const bad = { deliversTo: { default: ['GB'], retailers: { A: ['DE'], C: ['PL'], D: ['DE'] }, languages: { A: 'xx', B: 'de', C: 'de', D: 'DE' } } };
  assert.equal(feedLanguage(bad, 'D'), '', 'written in capitals: not a feed language, as the check says');
  assert.deepEqual(shownCountries(bad, 'D'), []);
  assert.deepEqual(deliveryConfigProblems(bad), [
    'A: unknown feed language "xx"',
    "B: a feed language needs the retailer's own countries in deliversTo.retailers",
    'C: none of its countries speaks "de", so it is shown nowhere',
    'D: unknown feed language "DE"'
  ]);
  assert.deepEqual(shownCountries(bad, 'A'), [], 'an unknown language: shown nowhere');
  assert.deepEqual(shownCountries(bad, 'B'), [], 'the default (UK) does not speak German');
  assert.deepEqual(deliveryConfigProblems(demo), []);
  for (const s of SITES) assert.deepEqual(deliveryConfigProblems(config[s]), [], s);
  // Exactly the feeds of 15 Nov 2026 in another language (D1, the product names): Reidl and Uhrcenter in German,
  // VEVOR on AGW in Dutch.
  const all = SITES.flatMap(s => languageRetailers(config[s]).map(n => `${s} ${n} ${feedLanguage(config[s], n)}`));
  // + Westwing on HGW, one shop per country in its language (Daisycon Wave 3, chat 9, 17 Nov 2026), and the other Daisycon home
  // shops of that day: La Redoute NL/DE, Dille & Kamille NL/FR, Miss Towels, WoodWick, Kerstland, Baobab (HGW), Tuinmeubelwereld (GGW).
  // + the Linkwise shops in Greek (Greece and Cyprus, L199: sites/<site>/linkwise-gr.js, tests/worker/linkwise-l199.test.mjs).
  assert.equal(all.filter(x => x.endsWith(' el')).length, 116);
  // + bol.com in Dutch on its 10 sites (L204, sites/_shared/bol.js, tests/worker/bol-sites.test.mjs), and its NL/BE-only line
  // on TGW, BGW and PGW, which list none (review of 6954a135).
  const BOL = ['agw', 'bgw', 'cgw', 'ggw', 'hgw', 'kgw', 'mgw', 'pgw', 'sgw', 'tgw', 'vgw', 'wgw', 'zgw'].map(s => `${s} bol.com nl`);
  assert.deepEqual(all.filter(x => !x.endsWith(' el')).sort(), [...BOL, 'agw VEVOR nl', 'cgw Reidl de', 'ggw Tuinmeubelwereld nl', 'hgw Baobab Collection fr', 'hgw Dille Kamille FR fr',
    'hgw Dille Kamille NL nl', 'hgw Kerstland nl', 'hgw La Redoute DE de', 'hgw La Redoute NL nl', 'hgw Miss Towels nl', 'hgw Westwing DE de', 'hgw Westwing ES es',
    'hgw Westwing FR fr', 'hgw Westwing IT it', 'hgw Westwing NL nl', 'hgw WoodWick NL nl', 'mgw Uhrcenter de', 'tgw refurbed NL nl', 'wgw Uhrcenter de'].sort());
});

test('L165: a feed in another language: only the countries that speak it, never the UK, the all view or Google', () => {
  const v = cc => viewFor(demo, cc, NOW);
  const shows = (cc, name) => retailerInView(v(cc), name);
  for (const n of ['Fr EU', 'Fr World', 'De Mix', 'De UK', 'It Shop', 'Us Only']) {
    assert.equal(shows('GB', n), false, `GB: not ${n}`);
    assert.equal(retailerInView(homeView(demo, NOW), n), false, `sitemaps and /api/stats: not ${n}`);
    for (const cc of ['GR', 'ES', 'AU', '']) assert.equal(shows(cc, n), false, `${cc || 'unknown'}: not ${n}`);
  }
  // Canada speaks French too: the worldwide French feed only.
  assert.equal(shows('CA', 'Fr World'), true);
  assert.equal(shows('CA', 'Fr EU'), false);
  assert.equal(shows('GB', 'Uk Us'), true);
  assert.equal(shows('GR', 'Uk Us'), true, 'a shop for the UK and the US stays in the all view');
  // France: both French feeds; Belgium and Luxembourg the same; Switzerland the worldwide French one and the Italian one.
  for (const cc of ['FR', 'BE', 'LU']) {
    assert.equal(shows(cc, 'Fr EU'), true, cc);
    assert.equal(shows(cc, 'Fr World'), true, cc);
    assert.equal(shows(cc, 'De Mix'), false, `${cc}: not the German feed`);
    assert.equal(shows(cc, 'Someone'), true, `${cc}: and the UK shops (the all view, L151)`);
    assert.equal(v(cc).everyRetailer, true, cc);
    assert.equal(needsUkBar(demo, cc), true, `${cc}: the bar of the all view`);
  }
  assert.equal(v('FR').group, v('BE').group, 'one copy for the countries that see the same feeds');
  assert.equal(shows('CH', 'Fr EU'), false, 'Switzerland is not in the EU');
  assert.equal(shows('CH', 'Fr World'), true);
  assert.equal(shows('CH', 'It Shop'), true);
  assert.equal(shows('DE', 'De Mix'), true);
  assert.equal(shows('DE', 'De UK'), true);
  assert.equal(shows('IT', 'It Shop'), true);
  assert.equal(shows('AT', 'De Mix'), false, 'Austria speaks German, but De Mix does not deliver there');
  // Poland (open): only what delivers there, and the German feed that also delivers to Poland is not for it; with no
  // other retailer for Poland, the all view (L157), not an empty page.
  assert.equal(v('PL').group, 'all');
  assert.equal(shows('PL', 'De Mix'), false);
  assert.equal(shows('GR', 'Ie Shop'), true, 'the Irish shop in English: the all view');
  // The groups: gb, all (Poland too here), us, and one per set of countries with feeds in their language.
  const groups = countryGroups(demo);
  assert.deepEqual(groups.list.map(g => [g.id, g.countries.join(',')]), [['gb', 'GB'], ['all', 'PL'], ['us', 'US'],
    ['lang-be-fr-lu', 'BE,FR,LU'], ['lang-ca', 'CA'], ['lang-ch', 'CH'], ['lang-de', 'DE'], ['lang-it', 'IT']]);
  assert.ok(!groups.byCountry.has('FR'), 'not a view of its own for the Hub (hubViewFor)');
  assert.notEqual(cacheKeyUrl('https://demo.example/', v('FR')), cacheKeyUrl('https://demo.example/', v('GR')));
  // The all view leaves out every feed with a language and the US-only shop.
  assert.deepEqual(groups.all.hidden, ['De Mix', 'De UK', 'Fr EU', 'Fr World', 'It Shop', 'Us Only']);
  assert.deepEqual(localOnlyRetailers(demo), ['De Mix', 'De UK', 'Fr EU', 'Fr World', 'It Shop', 'Us Only']);
  // Gear World Hub (/api/products?deliver_to=, the views of before L151): only what delivers there, by the same rule.
  assert.deepEqual(hubViewFor(demo, 'FR', NOW).only, ['Fr EU', 'Fr World']);
  assert.deepEqual(hubViewFor(demo, 'DE', NOW).only, ['De Mix', 'De UK']);
  assert.equal(hubViewFor(demo, 'GR', NOW).group, 'gb', 'Greece: nobody delivers there, the UK view as before');
  // The Group's country pages (browseView, L160): what that country sees, the same rule.
  assert.deepEqual(browseView(demo, 'FR', NOW).only, ['Fr EU', 'Fr World']);
  assert.deepEqual(browseView(demo, 'AT', NOW).only, [], 'nobody for Austria');
});

test('L165: one cached copy never holds two different views: the language groups, the browse views (L160), the others', () => {
  const COUNTRIES = ['GB', 'US', 'PL', 'DE', 'AT', 'CH', 'LI', 'LU', 'FR', 'BE', 'NL', 'IT', 'ES', 'PT', 'IE', 'GR', 'CY', 'MT', 'SE', 'DK',
    'FI', 'NO', 'IS', 'CZ', 'SK', 'HU', 'RO', 'BG', 'HR', 'SI', 'EE', 'LV', 'LT', 'AL', 'CA', 'MX', 'AU', 'JP', ''];
  const sig = v => JSON.stringify([v.hidden, v.only]);
  for (const site of [...SITES.map(s => config[s]), demo, { ...demo, deliversTo: { default: ['GB'], retailers: { Solo: ['PT'] }, languages: { Solo: 'pt' } } }]) {
    const seen = new Map();
    for (const cc of COUNTRIES) {
      for (const v of [viewFor(site, cc, NOW), browseView(site, cc, NOW), hubViewFor(site, cc, NOW)]) {
        if (seen.has(v.group)) assert.equal(seen.get(v.group), sig(v), `${site.domain || site.name}: "${v.group}" holds two views (${cc})`);
        else seen.set(v.group, sig(v));
      }
    }
  }
  // The single-country language group of the last site and the browse view of the same country.
  const solo = { ...demo, deliversTo: { default: ['GB'], retailers: { Solo: ['PT'] }, languages: { Solo: 'pt' } } };
  assert.equal(viewFor(solo, 'PT', NOW).group, 'lang-pt');
  assert.equal(browseView(solo, 'PT', NOW).group, 'pt');
});

test('L165: the hidden reason of a feed in another language is "language", not "country"; the US-only shop stays "country"', () => {
  const row = retailer => ({ retailer, last_seen_at: `${TEST_DAY} 06:00:00` });
  assert.equal(hiddenReason(viewFor(demo, 'GB', NOW), row('Fr EU')), 'language');
  assert.equal(hiddenReason(viewFor(demo, 'GR', NOW), row('Fr EU')), 'language');
  assert.equal(hiddenReason(viewFor(demo, 'PL', NOW), row('De Mix')), 'language', 'De Mix delivers to Poland: the notice must not say it does not');
  assert.equal(hiddenReason(viewFor(demo, 'FR', NOW), row('Fr EU')), '');
  assert.equal(hiddenReason(viewFor(demo, 'GR', NOW), row('Us Only')), 'country');
  assert.equal(hiddenReason(viewFor(demo, 'US', NOW), row('Someone')), 'country');
  assert.equal(hiddenReason(viewFor(demo, 'FR', NOW), { retailer: 'Fr EU', last_seen_at: '2026-01-01 00:00:00' }), 'stale');
  assert.equal(viewFor({ ...config.bgw, deliversTo: { default: ['GB'], retailers: {} } }, 'GB', NOW).languages, null, 'a site without feed languages');
  assert.deepEqual(viewFor(config.bgw, 'GB', NOW).languages, ['bol.com'], 'BGW: only the NL/BE-only line of bol.com (review of 6954a135; TGW has refurbed NL too, L194)');
});

test('L165: the shops that ship only to the US are seen only from the US (owner: "Only in the USA")', () => {
  assert.deepEqual(LOCAL_ONLY_COUNTRIES, ['PL', 'US']);
  let count = 0;
  for (const s of SITES) {
    const cfg = config[s];
    for (const [name, list] of Object.entries(cfg.deliversTo.retailers || {})) {
      if (list.join() !== 'US') continue;
      count++;
      assert.equal(retailerInView(viewFor(cfg, 'US', NOW), name), true, `${s} ${name}: the US`);
      for (const cc of ['GB', 'DE', 'FR', 'GR', 'IE', 'CA', '']) assert.equal(retailerInView(viewFor(cfg, cc, NOW), name), false, `${s} ${name}: not ${cc || 'unknown'}`);
    }
    // A shop for the UK and the US stays in the UK view and the all view.
    for (const [name, list] of Object.entries(cfg.deliversTo.retailers || {})) {
      if (list.includes('GB') && list.includes('US')) for (const cc of ['GB', 'FR', 'US']) assert.equal(retailerInView(viewFor(cfg, cc, NOW), name), true, `${s} ${name} ${cc}`);
    }
  }
  assert.ok(count >= 12, `the US-only shops of 15 Nov 2026 (Wavytalk, Jeulia, Dream Pairs ...): ${count}`);
  // MASON New York and Needs No Label (WGW) ship to the UK and the US.
  assert.equal(retailerInView(viewFor(config.wgw, 'FR', NOW), 'MASON New York'), true);
  assert.equal(retailerInView(viewFor(config.wgw, 'FR', NOW), 'Jeulia'), false);
});

test('L165: the Group counts a feed in another language only where it is shown; the About page says the rule', () => {
  assert.match(read('src/db.js'), /countries: shownCountries\(site, x\.name\)/);
  const about = read('src/pages/info.js');
  assert.ok(about.includes('A product described in a language other than English is shown only in the countries where that language is spoken.'));
  assert.ok(about.includes('Everywhere else you see a notice that most of the retailers deliver to the UK only.'));
  assert.ok(!about.includes('Elsewhere you see what UK visitors see'), 'the rule of before L151 is gone');
  // Every dictionary of the 13 sites has the About paragraph and the notice, with the retailer placeholder kept.
  const para = about.match(/<p>(A product whose price has not been checked[^<]+)<\/p>/)[1];
  let files = 0;
  for (const s of SITES) {
    for (const f of readdirSync(`sites/${s}/public/assets/i18n`)) {
      const d = JSON.parse(read(`sites/${s}/public/assets/i18n/${f}`));
      assert.ok(typeof d[para] === 'string' && d[para].length > 200, `${s} ${f}: the About paragraph`);
      assert.ok(typeof d[KEY] === 'string' && d[KEY].includes('{0}') && /:$/.test(d[KEY]), `${s} ${f}: the notice`);
      files++;
    }
  }
  assert.equal(files, 143);
  // One wording per language on all 13 sites.
  for (const f of readdirSync('sites/tgw/public/assets/i18n')) {
    const words = new Set(SITES.map(s => { const d = JSON.parse(read(`sites/${s}/public/assets/i18n/${f}`)); return `${d[para]}|${d[KEY]}`; }));
    assert.equal(words.size, 1, `${f}: the same About paragraph and notice on every site`);
  }
});

// ---- The pages, on AGW (VEVOR's Dutch feed) ----
function memD1(schema, seed) {
  const sql = new DatabaseSync(':memory:');
  for (const t of [schema, seed]) if (t) sql.exec(t);
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const agwSchema = readdirSync('sites/agw/migrations').sort().map(f => read(`sites/agw/migrations/${f}`)).join('\n');
function vevorShop() {
  const d = memD1(agwSchema, read('tests/fixtures/agw-seed.sql'));
  const ins = d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name,
    product_slug, price, currency, in_stock, image_url, affiliate_url, last_seen_at, first_seen_at) VALUES (?, 99001, ?, 'VEVOR', 'tyres-wheels', 'VEVOR', ?, ?, ?, 'EUR', 1,
    'https://img.example/v.jpg', 'https://www.vevor.nl/x', '${TEST_DAY} 06:00:00', '${TEST_DAY} 06:00:00')`);
  for (let i = 1; i <= 25; i++) ins.run(`99001:v${i}`, `v${i}`, `VEVOR hydraulische krik ${i} ton`, `vevor-hydraulische-krik-${i}-ton`, 50 + i);
  return d;
}
const agwWorker = createWorker(config.agw);
const getAgw = (path, env, country = '', ua = 'Mozilla/5.0 test') => {
  const req = new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': ua } });
  if (country) Object.defineProperty(req, 'cf', { value: { country } });
  return agwWorker.fetch(req, env, { waitUntil: p => p });
};
const envOf = d => ({ DB: d, CLICK_LOG: 'off', FX_FETCH: async () => { throw new Error('offline'); } });

test('L165: AGW pages: the Netherlands and Belgium see VEVOR\'s Dutch feed; Germany, Greece, the UK and Google never', async () => {
  const d = vevorShop();
  const env = envOf(d);
  const krik = html => (html.split('<main')[1] || '').match(/VEVOR hydraulische krik/g) || [];
  for (const cc of ['NL', 'BE']) assert.ok(krik(await (await getAgw('/category/tyres-wheels/', env, cc)).text()).length > 0, `${cc}: the Dutch feed`);
  for (const cc of ['GB', 'DE', 'GR', 'FR', 'US', 'PL', '']) assert.equal(krik(await (await getAgw('/category/tyres-wheels/', env, cc)).text()).length, 0, `${cc || 'unknown'}: not the Dutch feed`);
  // Google's crawler, also from the Netherlands: the UK view.
  assert.equal(krik(await (await getAgw('/category/tyres-wheels/', env, 'NL', GOOGLEBOT)).text()).length, 0, 'Googlebot from NL');
  assert.ok(QA_BOT.test('GearWorldQA-bot/1.0 (+read-only check)'));
  // The sitemap (the UK view) never lists them.
  const sitemaps = (await (await getAgw('/sitemap.xml', env, 'NL')).text()).match(/<loc>[^<]+<\/loc>/g) || [];
  for (const loc of sitemaps) {
    const body = await (await getAgw(new URL(loc.slice(5, -6)).pathname, env, 'NL')).text();
    assert.ok(!/vevor-hydraulische-krik/.test(body), `${loc}: no VEVOR product`);
  }
  // A product page: the Dutch visitor gets it; the German visitor a true notice with the countries, no price, no button.
  const id = d.sql.prepare("SELECT id FROM products WHERE product_name = 'VEVOR hydraulische krik 3 ton'").get().id;
  const path = `/product/vevor-hydraulische-krik-3-ton-${id}/`;
  const nl = await (await getAgw(path, env, 'NL')).text();
  assert.ok(!/notice-box/.test(nl));
  assert.match(nl, /href="\/out\/\d+"/);
  for (const cc of ['DE', 'GB']) {
    const r = await getAgw(path, env, cc);
    assert.equal(r.status, 200, cc);
    const html = await r.text();
    assert.match(html, /<meta name="robots" content="noindex,follow">/, cc);
    assert.ok(html.includes(`data-i18n="${KEY}"`), `${cc}: the language notice`);
    assert.ok(!/does not deliver to your country/.test(html), `${cc}: never "does not deliver" (VEVOR delivers to Germany)`);
    assert.match(html, /<p class="notice-ship" data-ship="NL BE">.*<span data-country="NL">Netherlands<\/span>, <span data-country="BE">Belgium<\/span><\/span><\/p>/s, cc);
    assert.ok(!/\/out\/\d/.test(html), `${cc}: no button to the retailer`);
  }
  // /out/ never sends a German visitor to the retailer.
  const out = await getAgw(`/out/${id}`, env, 'DE');
  assert.equal(out.status, 302);
  assert.ok(!/vevor\.nl/.test(out.headers.get('Location') || ''), 'back to the product page, not to VEVOR');
  // /api/stats (the Group's numbers): VEVOR counted only for the Netherlands and Belgium.
  const stats = await (await getAgw('/api/stats', env, 'NL')).json();
  assert.deepEqual(stats.delivery.find(x => x.retailer === 'VEVOR').countries, ['NL', 'BE']);
  assert.ok(!stats.retailer_names.includes('VEVOR'), 'not in the UK numbers');
});
