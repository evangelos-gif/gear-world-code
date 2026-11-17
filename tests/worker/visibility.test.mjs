// Lessons L107 (Google Ads compliance, 9 Nov 2026): a visitor sees only the retailers that deliver to their country, and
// only prices checked in the last 30 days ("Check price and stock at the retailer" after 14). These tests cover the
// country groups of every site, the page cache key per group, the notice page of a product the visitor may not see
// (200, noindex, no price, no button), /out/, the sitemaps and /api/stats in the UK view, the Hub's ?deliver_to=, the
// list "Below RRP", thin categories, and the D1 cost: with a view every hot query keeps the query plan it has
// without one (the extra term is a filter only), and "similar products" never walks further than without a view and
// shows exactly the first cards of the full filtered query.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker, QA_BOT, QA_COUNTRY_HEADER } from '../../src/engine.js';
import * as db from '../../src/db.js';
import { countryGroups, viewFor, homeView, visibleSql, hiddenReason, needsCheck, cacheKeyUrl, cleanCountry, useClock, needsUkBar,
  strictCountries, EU_COUNTRIES, OWN_VIEW_COUNTRIES, HIDE_AFTER_DAYS, CHECK_AFTER_DAYS, retailerInView, hubViewFor, browseView } from '../../src/lib/visibility.js';
import { OPEN_COUNTRIES, OPEN_RULE, openCheck } from '../../src/lib/open-countries.js';
import { deliveryCountries } from '../../src/lib/delivery.js';
import { deliveryText, UK_BAR_TEXT } from '../../src/pages/layout.js';
import { toString } from '../../src/lib/html.js';
import { MIN_INDEXED_PRODUCTS } from '../../src/pages/listing.js';
import { TEST_DAY } from './test-clock.mjs';

const SITES = readdirSync('sites').filter(n => existsSync(`sites/${n}/site.config.js`) && existsSync(`sites/${n}/public/assets/site.js`));
const config = {};
for (const s of SITES) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const read = f => readFileSync(f, 'utf8');
const NOW = Date.parse(`${TEST_DAY}T12:00:00Z`);

test('country groups (L151): the UK sees only what delivers there, the US its own view (L141), every other or unknown country all the products', () => {
  const agw = config.agw;
  // Ottocast (massive import round 2b, 14 Nov 2026): the European countries of its shipping page, not the UK.
  const OTTOCAST = ['DE', 'FR', 'NL', 'BE', 'AT', 'CH', 'ES', 'IT', 'PT', 'GR', 'PL', 'CZ', 'SK', 'HU', 'SE', 'FI', 'DK', 'NO', 'EE', 'LV', 'LT', 'HR', 'SI', 'BG', 'RO'];
  // Round 2c (14 Nov 2026, L144): the tyre sites of the Pneus.be network, each for its own country.
  // VEVOR's feed on AGW is in Dutch (L165): seen only in the Netherlands and Belgium.
  assert.deepEqual(agw.deliversTo, { default: ['GB'], retailers: { 'AliExpress PL': ['PL'], 'Pneus.be': ['BE'], 'Neumaticos.es': ['ES'], 'Pneumatici.it': ['IT'], 'Tanie-Opony.pl': ['PL'], VEVOR: ['EU', 'IS', 'LI', 'NO'], Ottocast: OTTOCAST, 'ReifenDirekt.at': ['AT'], 'neumaticos-online.es': ['ES'], 'Autobandenmarkt.nl': ['NL'] }, languages: { VEVOR: 'nl' } });
  assert.deepEqual(config.vgw.deliversTo.retailers, { 'AliExpress PL': ['PL'], VEVOR: ['EU', 'IS', 'LI', 'NO'] });
  for (const s of ['cgw', 'bgw', 'pgw']) assert.deepEqual(config[s].deliversTo.retailers.VEVOR, ['EU', 'IS', 'LI', 'NO'], s);
  assert.deepEqual(config.cgw.deliversTo.retailers.Reidl, ['DE', 'AT']);
  assert.deepEqual(config.wgw.deliversTo.retailers['100% PURE'], ['EU', 'CH', 'NO']);
  for (const s of SITES) assert.ok(config[s].deliversTo, `${s}: deliversTo`);
  const g = cc => viewFor(agw, cc, NOW);
  assert.equal(g('GB').group, 'gb');
  assert.deepEqual(g('GB').hidden, ['AliExpress PL', 'Autobandenmarkt.nl', 'Neumaticos.es', 'Ottocast', 'Pneumatici.it', 'Pneus.be', 'ReifenDirekt.at', 'Tanie-Opony.pl', 'VEVOR', 'neumaticos-online.es']);
  assert.equal(g('GB').only, null);
  assert.equal(g('GB').everyRetailer, false);
  // No retailer of AGW ships to the US, so the US gets the UK view there (L141).
  assert.equal(g('US').group, 'gb');
  // Every other country, and an unknown one (lessons L151): ALL the products, one copy ("all") for all of them, but the
  // Dutch feed of VEVOR (L165). The EU, Switzerland, Canada ...
  for (const cc of ['DE', 'IE', 'CH', 'NO', 'IS', ...EU_COUNTRIES.filter(c => !['PL', 'NL', 'BE'].includes(c)), 'CA', 'AU', 'JP', '', 'XX', 'T1', 'gbr', null, undefined]) {
    assert.equal(g(cc).group, 'all', `${cc}: the all view`);
    assert.deepEqual(g(cc).hidden, ['AliExpress PL', 'Tanie-Opony.pl', 'VEVOR'], `${cc}: the Poland-only shops (L157) and the Dutch feed (L165) hidden`);
    assert.equal(g(cc).only, null, `${cc}: every retailer`);
    assert.equal(g(cc).everyRetailer, true, cc);
  }
  // The Netherlands and Belgium (L165): the all view plus VEVOR's Dutch feed, one copy for both. Belgium is still not open
  // (Pneus.be has 92% of what delivers there, 14 Nov 2026).
  for (const cc of ['NL', 'BE']) {
    assert.equal(g(cc).group, 'lang-be-nl', `${cc}: the all view with the Dutch feed`);
    assert.deepEqual(g(cc).hidden, ['AliExpress PL', 'Tanie-Opony.pl'], cc);
    assert.equal(g(cc).everyRetailer, true, cc);
  }
  // Round 2c (L144): Spain and Italy see their tyre shop in the all view, with every other retailer. Poland is open
  // (L157): only what delivers there.
  for (const cc of ['ES', 'IT']) assert.equal(g(cc).group, 'all', `${cc}: the all view`);
  assert.equal(g('PL').group, 'pl');
  assert.deepEqual(g('PL').only, ['AliExpress PL', 'Ottocast', 'Tanie-Opony.pl'], 'Poland: not the Dutch feed of VEVOR (L165)');
  // Construction: Reidl to Germany and Austria; VEVOR the EEA; GRABO worldwide.
  const c = cc => viewFor(config.cgw, cc, NOW);
  assert.deepEqual(c('GB').hidden, ['AliExpress PL', 'Reidl', 'VEVOR']);
  for (const cc of ['FR', 'CH']) assert.equal(c(cc).group, 'all', `CGW ${cc}`);
  // Reidl's feed is in German (L165): Germany and Austria see the all view plus Reidl; the others never see it.
  for (const cc of ['DE', 'AT']) assert.equal(c(cc).group, 'lang-at-de', `CGW ${cc}`);
  assert.ok(c('FR').hidden.includes('Reidl') && !c('DE').hidden.includes('Reidl'));
  // Women's: 100% PURE to the EU, Switzerland and Norway, FOREO to the EU; Jeulia and Dream Pairs to the US only; MASON
  // New York and Needs No Label to the UK and the US (round 2b, 14 Nov 2026).
  // Round 2 of the mass import (15 Nov 2026, L164): TEMU, Dima Eyewear, Grey State and Kixies to the US, Xpluswear to the EU.
  assert.deepEqual(viewFor(config.wgw, 'GB', NOW).hidden, ['100% PURE', 'AliExpress PL', 'Bazta IE', 'Dima Eyewear', 'Dream Pairs', 'FOREO', 'Grey State', 'Invicta Stores', 'Jeulia', 'Kixies', 'Plusshop IE', 'TEMU', 'Uhrcenter', 'Xpluswear']);
  // Uhrcenter's feed is in German (L165): Switzerland, one of its German-speaking countries, sees it; France does not.
  assert.equal(viewFor(config.wgw, 'CH', NOW).group, viewFor(config.wgw, 'DE', NOW).group);
  assert.notEqual(viewFor(config.wgw, 'CH', NOW).group, 'all');
  assert.equal(viewFor(config.wgw, 'FR', NOW).group, 'all');
  assert.equal(viewFor(config.wgw, 'DE', NOW).only, null);
  // The US view (owner, 14 Nov 2026, lessons L141): what ships to the US, nothing else. Before it, Wavytalk was never shown.
  assert.deepEqual(viewFor(config.wgw, 'US', NOW).only, ['Dima Eyewear', 'Dream Pairs', 'Grey State', 'Jeulia', 'Kixies', 'MASON New York', 'Needs No Label', 'TEMU']);
  assert.deepEqual(viewFor(config.mgw, 'US', NOW).only, ['Dream Pairs', 'Jeulia', 'Maceoo', 'TEMU', 'Wavytalk']);
  assert.deepEqual(viewFor(config.mgw, 'GB', NOW).hidden, ['AliExpress PL', 'Bazta IE', 'Dream Pairs', 'Invicta Stores', 'Jeulia', 'Maceoo', 'Plusshop IE', 'TEMU', 'Uhrcenter', 'Wavytalk']);
  // Round 3 (15 Nov 2026, L147): Invicta Stores ships to Europe but Spain and Portugal, and is kept out of the UK view
  // (customs on delivery); HOME-TEX ships to 19 countries, never the UK. The all view (L151) has both, with their badge.
  assert.ok(viewFor(config.hgw, 'GB', NOW).hidden.includes('HOME-TEX'));
  assert.ok(viewFor(config.wgw, 'GB', NOW).hidden.includes('Invicta Stores'));
  assert.deepEqual(deliveryCountries(config.wgw, 'Invicta Stores'), deliveryCountries(config.mgw, 'Invicta Stores'));
  for (const cc of ['FR', 'IE', 'ES']) assert.equal(viewFor(config.mgw, cc, NOW).group, 'all', `MGW ${cc}`);
  const inv = deliveryCountries(config.mgw, 'Invicta Stores');
  for (const cc of ['GB', 'ES', 'PT', 'US']) assert.ok(!inv.includes(cc), `Invicta Stores: not ${cc}`);
  for (const cc of ['DE', 'FR', 'IE', 'NL', 'IT', 'CH', 'NO']) assert.ok(inv.includes(cc), `Invicta Stores: ${cc}`);
  const ht = deliveryCountries(config.hgw, 'HOME-TEX');
  assert.equal(ht.length, 19);
  for (const cc of ['GB', 'IE', 'DK', 'SE', 'NO']) assert.ok(!ht.includes(cc), `HOME-TEX: not ${cc}`);
  assert.deepEqual(viewFor(config.kgw, 'US', NOW).only, ['Diecast Models Wholesale', 'Dream Pairs', 'Kaiya Baby', 'TEMU', 'UPPER']);
  assert.deepEqual(viewFor(config.hgw, 'US', NOW).only, ['Airdog', 'AlorAir', 'Imarku', 'Kincmo', 'LOOMY Home', 'Mosaic Weighted Blankets', 'Rowabi', 'Super Area Rugs', 'TEMU']);
  // Daisycon Wave 3 (chat 9, 17 Nov 2026): France also sees Westwing FR (French names, L165), so HGW has a French view;
  // Ireland still gets the all view.
  assert.equal(viewFor(config.hgw, 'FR', NOW).group, 'lang-fr');
  assert.equal(viewFor(config.hgw, 'IE', NOW).group, 'all');
  assert.deepEqual(viewFor(config.ggw, 'US', NOW).only, ['Click and Grow', 'TEMU']);
  assert.deepEqual(viewFor(config.zgw, 'US', NOW).only, ['ALZOO', 'Bonne et Filou', 'Crown and Paw', 'EcoKind', 'MeoWant', 'RadioFence.com'], 'ALZOO and the US pet shops of wave 3 (L169)');
  assert.deepEqual(viewFor(config.cgw, 'US', NOW).only, ['GRABO']);
  assert.equal(viewFor(config.cgw, 'US', NOW).group, 'us', 'CGW: the US sees GRABO (until L151 it shared the copy of Switzerland)');
  for (const s of ['wgw', 'mgw', 'kgw', 'hgw', 'ggw', 'zgw']) {
    assert.equal(viewFor(config[s], 'US', NOW).group, 'us', s);
    for (const name of viewFor(config[s], 'US', NOW).only) {
      const uk = config[s].deliversTo.retailers[name].includes('GB');
      assert.equal(viewFor(config[s], 'GB', NOW).hidden.includes(name), !uk, `${s} ${name}: ${uk ? 'also' : 'not'} in the UK view`);
    }
  }
  // A site where every retailer delivers to the UK: the UK view filters no retailer (the same lists as before), and it is
  // the all view too (one cached copy, as before L151). TGW is no longer one since round 2c (Back to the Office IE, L144).
  // SGW: every retailer but AliExpress PL (Poland only, L157), which the UK and the all view both leave out.
  for (const s of ['sgw']) {
    const v = viewFor(config[s], 'GB', NOW);
    assert.deepEqual(v.hidden, ['AliExpress PL'], s);
    assert.equal(v.only, null, s);
    assert.equal(countryGroups(config[s]).all, countryGroups(config[s]).home, s);
    for (const cc of ['FR', 'US', '']) {
      assert.equal(viewFor(config[s], cc, NOW).group, 'gb', `${s} ${cc}: the UK copy, which has every retailer`);
      assert.equal(viewFor(config[s], cc, NOW).everyRetailer, false, `${s} ${cc}`);
    }
  }
  // TGW since round 2c (L144): Back to the Office IE (Ireland only) is out of the UK view; MonsGeek ships to the US (its
  // own view there); every other country sees all of them.
  const t = cc => viewFor(config.tgw, cc, NOW);
  assert.deepEqual(t('GB').hidden, ['3DMakerpro', 'AliExpress PL', 'Back to the Office IE', 'Bond Touch', 'Gshopper', 'Mintion', 'Mosnovo', 'Nothingprojector', 'Oukitel', 'Procolored'], 'and the US-only shops of wave 3 (L169)');
  // Poland (open since 15 Nov 2026, L157): AliExpress PL (round 2) and MonsGeek, a copy of its own.
  assert.equal(t('US').group, 'us');
  assert.equal(t('PL').group, 'pl');
  assert.deepEqual(t('PL').only, ['AliExpress PL', 'MonsGeek']);
  assert.deepEqual(t('US').only, ['3DMakerpro', 'Bond Touch', 'Gshopper', 'Mintion', 'MonsGeek', 'Mosnovo', 'Nothingprojector', 'Oukitel', 'Procolored'], 'MonsGeek and the US-only shops of wave 3 (L169)');
  for (const cc of ['IE', 'FR', 'MT', 'CA', '']) assert.equal(t(cc).group, 'all', `TGW ${cc}: the all view`);
  for (const s of ['kgw', 'ggw', 'vgw', 'bgw', 'pgw', 'mgw', 'tgw']) assert.equal(viewFor(config[s], 'FR', NOW).group, 'all', `${s}: France sees all the products`);
  // ZGW (L165): its only shop that does not deliver to the UK, ALZOO, ships only to the US, so the all view is the UK
  // view (one copy, as SGW): France sees the UK retailers (with the bar and each card's delivery line), never ALZOO.
  assert.equal(viewFor(config.zgw, 'FR', NOW).group, 'gb');
  assert.equal(countryGroups(config.zgw).all, countryGroups(config.zgw).home);
  // Few groups per site (one page copy each in the cache): the UK, all, the US, Poland (L157), and one per set of
  // countries that speak the language of a feed (L165), named lang-... HGW has 9 from 17 Nov 2026 (gb, all, us, pl and
  // Westwing in Dutch, German, French, Italian and Spanish, Daisycon Wave 3, chat 9): the limit is 10 now (for chat 4 to confirm).
  for (const s of SITES) {
    const groups = countryGroups(config[s]).list;
    const list = groups.map(x => x.id);
    assert.ok(list.length <= 10 && list[0] === 'gb' && groups.every(x => (x.language ? /^lang-/.test(x.id) : ['gb', 'all', 'us', 'pl', 'pl-us'].includes(x.id))), `${s}: ${list}`);
  }
  assert.deepEqual(OWN_VIEW_COUNTRIES, ['GB', 'PL', 'US']);
  assert.deepEqual(OPEN_COUNTRIES, ['GB', 'PL']);
  assert.equal(cleanCountry(' be '), 'BE');
});

test('freshness: hidden after 30 days, "Check price and stock at the retailer" after 14, whole UTC days', () => {
  const v = viewFor(config.mgw, 'GB', Date.parse('2026-11-09T08:00:00Z'));
  assert.equal(v.cutoff, '2026-10-10');
  assert.equal(v.checkFrom, '2026-10-26');
  assert.equal(HIDE_AFTER_DAYS, 30);
  assert.equal(CHECK_AFTER_DAYS, 14);
  const row = day => ({ retailer: 'Coes', last_seen_at: day });
  assert.equal(hiddenReason(v, row('2026-10-09 23:59:59')), 'stale');
  assert.equal(hiddenReason(v, row('2026-10-10 00:00:00')), '');
  assert.equal(hiddenReason(v, row('2026-10-10T08:00:00.000Z')), '', 'ISO dates compare the same way');
  assert.equal(hiddenReason(v, { retailer: 'Coes', last_seen_at: null }), 'stale', 'no date: as NULL in SQL');
  assert.equal(hiddenReason(v, { retailer: 'Wavytalk', last_seen_at: '2026-11-08 10:00:00' }), 'country');
  assert.equal(needsCheck(v, row('2026-10-25 23:00:00')), true);
  assert.equal(needsCheck(v, row('2026-10-26 00:00:01')), false);
  const sql = visibleSql(v);
  assert.equal(sql.sql, 'likelihood(+p.retailer NOT IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AND +p.last_seen_at >= ?, 1.0)');
  assert.deepEqual(sql.binds, ['AliExpress PL', 'Bazta IE', 'Dream Pairs', 'Invicta Stores', 'Jeulia', 'Maceoo', 'Plusshop IE', 'TEMU', 'Uhrcenter', 'Wavytalk', '2026-10-10']);
  assert.equal(visibleSql(viewFor(config.agw, 'BE', NOW)).sql, 'likelihood(+p.retailer NOT IN (?, ?) AND +p.last_seen_at >= ?, 1.0)', 'the all view: without the Poland-only shops (L157)');
  assert.equal(visibleSql(viewFor(config.tgw, 'BE', NOW)).sql, 'likelihood(+p.retailer NOT IN (?, ?, ?, ?, ?, ?, ?, ?, ?) AND +p.last_seen_at >= ?, 1.0)', 'the all view: without AliExpress PL (L157) and the 8 US-only shops of wave 3 (L165, L169)');
  assert.equal(visibleSql(viewFor({ ...config.agw, strictCountries: ['BE'] }, 'BE', NOW)).sql, 'likelihood(+p.retailer IN (?, ?, ?) AND +p.last_seen_at >= ?, 1.0)', 'a country with a view of its own: IN');
  assert.equal(visibleSql(null), null);
});

test('the page cache keeps one copy per country group (lessons L107)', () => {
  const be = viewFor(config.agw, 'FR', NOW);
  const gb = viewFor(config.agw, 'US', NOW);
  assert.equal(cacheKeyUrl('https://cargearworld.com/category/tyres-wheels/?page=2', be), 'https://cargearworld.com/category/tyres-wheels/?page=2&gw-view=all');
  // Belgium and the Netherlands (L165, VEVOR's Dutch feed): a copy of their own.
  assert.equal(cacheKeyUrl('https://cargearworld.com/', viewFor(config.agw, 'BE', NOW)), 'https://cargearworld.com/?gw-view=lang-be-nl');
  assert.equal(cacheKeyUrl('https://cargearworld.com/', gb), 'https://cargearworld.com/?gw-view=gb');
  assert.notEqual(cacheKeyUrl('https://cargearworld.com/', be), cacheKeyUrl('https://cargearworld.com/', gb));
  // The engine passes it to the edge cache of every cached page.
  const engine = read('src/engine.js');
  assert.match(engine, /withEdgeCache\(request, ctx, produce, env, cacheKeyUrl\(request\.url, view\)\)/);
  assert.equal((engine.match(/\}, view\);/g) || []).length, 6, 'home, category, product, deals, a guide and the guides list are cached per group');
});

// ---- The open-country rule (owner, 12 and 14 Nov 2026, lessons L151) ----
test('L151: a country opens with 30,000 fresh products from 4 retailers, none above half; the UK and Poland (L157) are open', () => {
  assert.deepEqual(OPEN_RULE, { products: 30000, retailers: 4, share: 0.5 });
  assert.deepEqual(OPEN_COUNTRIES, ['GB', 'PL']);
  const yes = openCheck({ products: 30000, retailers: 4, top: 15000 });
  assert.equal(yes.meets, true, 'exactly at the rule: open');
  assert.deepEqual(yes.missing, { products: 0, retailers: 0, share: false });
  assert.equal(yes.share, 0.5);
  // Belgium in round numbers (14 Nov 2026: Pneus.be has 92% of what delivers there): waits.
  const be = openCheck({ products: 70000, retailers: 3, top: 64400 });
  assert.equal(be.meets, false);
  assert.deepEqual(be.missing, { products: 0, retailers: 1, share: true });
  assert.deepEqual(openCheck({ products: 29999, retailers: 9, top: 100 }).missing, { products: 1, retailers: 0, share: false });
  assert.deepEqual(openCheck({ products: 40000, retailers: 5, top: 20001 }).missing, { products: 0, retailers: 0, share: true });
  const none = openCheck({});
  assert.equal(none.meets, false);
  assert.deepEqual(none.missing, { products: 30000, retailers: 4, share: false }, 'nothing: no share to complain about');
  assert.equal(openCheck(null).meets, false);
  // Numbers as text, fractions, a negative or too big top: cleaned.
  const odd = openCheck({ products: '31000', retailers: 4.9, top: 99999 });
  assert.equal(odd.products, 31000);
  assert.equal(odd.retailers, 4);
  assert.equal(odd.share, 1);
  assert.equal(openCheck({ products: 31000, retailers: 4, top: -3 }).meets, true);
  // The list is written by hand and used by every site: an open country sees only what delivers there (as a strict
  // country does: the same code path), every other country all the products.
  const vis = read('src/lib/visibility.js');
  assert.match(vis, /import \{ OPEN_COUNTRIES \} from '\.\/open-countries\.js';/);
  assert.match(vis, /const strict = new Set\(\[\.\.\.strictCountries\(site\), \.\.\.OPEN_COUNTRIES\.filter\(c => c !== HOME_COUNTRY\)\]\);/);
  for (const s of SITES) assert.ok(!/openCountries|OPEN_COUNTRIES/.test(read(`sites/${s}/site.config.js`)), `${s}: no list of its own`);
  // A second open country later (here as a strict one, the same code path): only its retailers, no bar; empty when none.
  const be2 = { ...config.agw, strictCountries: ['BE', 'CA'] };
  assert.deepEqual(viewFor(be2, 'BE', NOW).only, ['Ottocast', 'Pneus.be', 'VEVOR']);
  assert.equal(needsUkBar(be2, 'BE'), false);
  assert.deepEqual(viewFor(be2, 'CA', NOW).only, []);
  assert.equal(viewFor(be2, 'DE', NOW).group, 'all');
});

test('L151: the Hub\'s search keeps the views of before L151 (hubViewFor) until its cards say where each retailer delivers', () => {
  const h = (site, cc) => hubViewFor(site, cc, NOW);
  // VEVOR's feed on AGW is in Dutch (L165): the Hub lists it only for the Netherlands and Belgium.
  assert.deepEqual(h(config.agw, 'DE').only, ['Ottocast']);
  assert.deepEqual(h(config.agw, 'BE').only, ['Ottocast', 'Pneus.be', 'VEVOR']);
  assert.deepEqual(h(config.agw, 'NL').only, ['Autobandenmarkt.nl', 'Ottocast', 'VEVOR'], 'wave 3 (L169): the Dutch tyre shop');
  assert.equal(h(config.agw, 'IE').group, 'gb', 'Ireland: no retailer of AGW for it now, the UK view as before L151');
  assert.deepEqual(h(config.agw, 'CH').only, ['Ottocast']);
  assert.deepEqual(h(config.agw, 'ES').only, ['Neumaticos.es', 'Ottocast', 'neumaticos-online.es'], 'round 2c (L144) and wave 3 (L169): the Spanish tyre shops');
  for (const cc of ['GB', 'US', 'CA', 'JP', '']) assert.deepEqual(h(config.agw, cc).hidden, ['AliExpress PL', 'Autobandenmarkt.nl', 'Neumaticos.es', 'Ottocast', 'Pneumatici.it', 'Pneus.be', 'ReifenDirekt.at', 'Tanie-Opony.pl', 'VEVOR', 'neumaticos-online.es'], `AGW ${cc || 'unknown'}: the UK view`);
  assert.deepEqual(h(config.cgw, 'US').only, ['GRABO'], 'the US view of L141');
  assert.deepEqual(h(config.cgw, 'AT').only, ['GRABO', 'Reidl', 'VEVOR']);
  // TGW since round 2c (L144): MonsGeek delivers to Germany (a view of its own, as before L151); nobody to Malta (the UK view).
  assert.deepEqual(h(config.tgw, 'DE').only, ['MonsGeek']);
  assert.deepEqual(h(config.tgw, 'MT').hidden, ['3DMakerpro', 'AliExpress PL', 'Back to the Office IE', 'Bond Touch', 'Gshopper', 'Mintion', 'Mosnovo', 'Nothingprojector', 'Oukitel', 'Procolored'], 'TGW Malta: the UK view (without the US-only shops of wave 3, L169)');
  for (const cc of ['DE', 'CA', 'GB']) assert.equal(h(config.agw, cc).everyRetailer, false, cc);
  // A strict (later: open) country: as on the site.
  assert.deepEqual(h({ ...config.agw, strictCountries: ['BE'] }, 'BE').only, ['Ottocast', 'Pneus.be', 'VEVOR']);
  // A site whose default retailers deliver everywhere, with a US-only shop: the US view is every retailer there, and the
  // Hub keeps it (the US shop stays in, lessons L141; independent review of 14 Nov 2026). Since L165 the all view leaves
  // the US-only shop out, so the US has a copy of its own.
  const world = { ...config.tgw, deliversTo: { default: ['WORLD'], retailers: { Wavytalk: ['US'] } } };
  assert.equal(viewFor(world, 'US', NOW).group, 'us');
  assert.deepEqual(viewFor(world, 'FR', NOW).hidden, ['Wavytalk']);
  assert.equal(h(world, 'US').hidden, null);
  assert.equal(h(world, 'US').only, null);
  assert.deepEqual(h(world, 'GB').hidden, ['Wavytalk']);
  // The engine uses it only for /api/products with ?deliver_to= and without &badges=1.
  assert.match(read('src/engine.js'), /const hubAsk = path === '\/api\/products' && Boolean\(url\.searchParams\.get\('deliver_to'\)\) && url\.searchParams\.get\('badges'\) !== '1';/);
});

// ---- The Car site with a Belgian tyre shop, in memory ----
function memD1(schema, seed) {
  const sql = new DatabaseSync(':memory:');
  for (const t of [schema, seed]) if (t) sql.exec(t);
  const log = [];
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => { log.push({ text, args }); return { results: sql.prepare(text).all(...args).map(r => ({ ...r })) }; },
    first: async () => { log.push({ text, args }); const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  return { sql, log, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const agwSchema = readdirSync('sites/agw/migrations').sort().map(f => read(`sites/agw/migrations/${f}`)).join('\n');
function carShop() {
  const d = memD1(agwSchema, read('tests/fixtures/agw-seed.sql'));
  // 30 Belgian tyres (in euros) and a stale UK product, like the live data of 9 Nov 2026 in miniature.
  const ins = d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name,
    product_slug, price, currency, in_stock, image_url, affiliate_url, gtin, last_seen_at, first_seen_at) VALUES (?, ?, ?, ?, 'tyres-wheels', 'Tyreco', ?, ?, ?, 'EUR', 1,
    'https://img.example/t.jpg', 'https://www.pneus.be/x', NULL, '2026-10-20 06:00:00', '2026-10-20 06:00:00')`);
  for (let i = 1; i <= 30; i++) ins.run(`91001:t${i}`, 91001, `t${i}`, 'Pneus.be', `Tyreco Summer 205/55 R16 ${i}`, `tyreco-summer-205-55-r16-${i}`, 60 + i);
  d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name, product_slug, price,
    currency, in_stock, image_url, affiliate_url, last_seen_at, first_seen_at) VALUES ('90101:old', 90101, 'old', 'Example Motor Parts', 'tyres-wheels', 'Oldco',
    'Oldco Tyre Inflator', 'oldco-tyre-inflator', 30, 'GBP', 1, 'https://img.example/o.jpg', 'https://example.com/o', '2026-09-01 06:00:00', '2026-09-01 06:00:00')`).run();
  d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, brand, product_name, product_slug, price,
    was_price, currency, in_stock, image_url, affiliate_url, last_seen_at, first_seen_at) VALUES ('90101:mid', 90101, 'mid', 'Example Motor Parts', 'tyres-wheels', 'Midco',
    'Midco Tyre Gauge', 'midco-tyre-gauge', 20, 40, 'GBP', 1, 'https://img.example/m.jpg', 'https://example.com/m', '2026-10-01 06:00:00', '2026-10-01 06:00:00')`).run();
  return d;
}
const agwWorker = createWorker(config.agw);
const getAgw = (path, env, country = '', headers = {}) => {
  const req = new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test', ...headers } });
  if (country) Object.defineProperty(req, 'cf', { value: { country } });
  return agwWorker.fetch(req, env, { waitUntil: p => p });
};
const envOf = d => ({ DB: d, CLICK_LOG: 'off', FX_FETCH: async () => { throw new Error('offline'); } });
const idOf = (d, name) => d.sql.prepare('SELECT id FROM products WHERE product_name = ?').get(name).id;

test('AGW: a UK visitor never sees the Belgian tyres; a Belgian visitor sees them and the UK shops, each card with where it delivers (L151)', async () => {
  const d = carShop();
  const env = envOf(d);
  const tyreCount = html => (html.match(/Tyreco Summer/g) || []).length;
  const ukCat = await (await getAgw('/category/tyres-wheels/', env, 'GB')).text();
  assert.equal(tyreCount(ukCat), 0);
  assert.ok(!/Pneus\.be/.test(ukCat), 'not even in the retailer filter');
  const usCat = await (await getAgw('/category/tyres-wheels/', env, 'US')).text();
  assert.equal(tyreCount(usCat), 0, 'a US address gets the UK view on AGW: none of its retailers ships to the US (L141)');
  const beCat = await (await getAgw('/category/tyres-wheels/', env, 'BE')).text();
  assert.ok(tyreCount(beCat) > 0);
  // Belgium is not an open country (L151): all the products, the UK shops too, and every card says where it delivers.
  const beMain = beCat.split('<main')[1];
  assert.ok(/Example Motor Parts|Sample Garage Supplies/.test(beMain), 'the UK shops too');
  assert.ok(beMain.includes('<p class="label-ship" data-ship="BE">'), 'a Pneus.be card says Belgium');
  assert.ok(beMain.includes('<p class="label-ship" data-ship="GB">'), 'a UK shop card says the UK');
  const cards = (beMain.match(/<article class="label-card">/g) || []).length;
  assert.ok(cards > 0);
  assert.equal((beMain.match(/<p class="label-ship"/g) || []).length, cards, 'one delivery line on every card');
  assert.ok(beCat.includes('class="country-bar"'), 'and the bar "We\'re adding retailers for your country"');
  // Home page, search, deals, API: the same rule.
  const ukHome = await (await getAgw('/', env, 'GB')).text();
  assert.ok(!/Pneus\.be|Tyreco Summer/.test(ukHome));
  assert.ok(/Pneus\.be/.test(await (await getAgw('/', env, 'BE')).text()));
  assert.ok(!/Tyreco/.test(await (await getAgw('/search?q=tyreco', env, 'GB')).text()));
  assert.ok(/Tyreco Summer/.test(await (await getAgw('/search?q=tyreco', env, 'BE')).text()));
  // The Hub asks /api/products from its own Worker and passes its visitor's country (deliver_to).
  const api = cc => getAgw(`/api/products?search=tyreco&limit=60${cc ? `&deliver_to=${cc}` : ''}`, env, 'GB').then(r => r.json());
  assert.equal((await api('')).products.length, 0);
  assert.equal((await api('BE')).products.length, 30);
  assert.equal((await api('US')).products.length, 0);
  assert.ok((await api('BE')).products.every(p => p.retailer === 'Pneus.be'));
  // Gear World Hub (?deliver_to= without &badges=1, L151): the views of before L151 until its cards say where each
  // retailer delivers, so the Hub never lists a product without it. With &badges=1: the site's own view, and every
  // product says where its retailer delivers.
  const hub = (cc, extra = '') => getAgw(`/api/products?search=midco&limit=60&deliver_to=${cc}${extra}`, env, 'GB').then(r => r.json());
  assert.equal((await hub('DE')).products.length, 0, 'Germany through the Hub: only what delivers there (Ottocast, VEVOR)');
  assert.equal((await hub('CA')).products.length, 1, 'Canada through the Hub: the UK view, as before');
  const badged = await hub('DE', '&badges=1');
  assert.equal(badged.products.length, 1, 'with badges: the all view');
  assert.deepEqual(badged.products[0].delivers_to, ['GB']);
  const tyres = await (await getAgw('/api/products?search=tyreco&limit=2&deliver_to=BE&badges=1', env, 'GB')).json();
  assert.deepEqual(tyres.products[0].delivers_to, ['BE']);
  // deliver_to counts only on /api/products: a page ignores it.
  assert.equal(tyreCount(await (await getAgw('/category/tyres-wheels/?deliver_to=BE', env, 'GB')).text()), 0);
});

test('AGW: an old link to a product the UK visitor may not see opens a notice (200, noindex, no price, no button); the all view shows it', async () => {
  const d = carShop();
  const env = envOf(d);
  const id = idOf(d, 'Tyreco Summer 205/55 R16 5');
  const path = `/product/tyreco-summer-205-55-r16-5-${id}/`;
  const r = await getAgw(path, env, 'GB');
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/cargearworld\.com\/product\/tyreco-summer-205-55-r16-5-\d+\/">/);
  // The page is cached per country group, and many countries share a group: so the notice names no country, and the
  // line under it says where the retailer delivers.
  assert.match(html, /<span data-i18n="\{0\} does not deliver to your country\." data-i18n-0="Pneus\.be" data-i18n-keep="0"><span translate="no">Pneus\.be<\/span> does not deliver to your country\.<\/span>/);
  assert.match(html, /<span translate="no">Pneus\.be<\/span> delivers to<\/span><\/span>: <span class="ship-names"><span data-country="BE">Belgium<\/span>/);
  assert.ok(!/United Kingdom/.test(html.split('notice-box')[1].split('chip-list')[0]), 'no country named in the notice');
  // A US visitor shares the UK copy: the same words.
  const us = await (await getAgw(path, env, 'US')).text();
  assert.equal(us.split('notice-box')[1].split('chip-list')[0], html.split('notice-box')[1].split('chip-list')[0]);
  assert.ok(!/\/out\/\d/.test(html), 'no button to the retailer');
  assert.ok(!/€\d|data-price=/.test(html.split('<main')[1].split('</main>')[0]), 'no price');
  assert.ok(!/"@type":"Product"/.test(html), 'no product markup');
  // Unknown country (L151): the all view, the normal page, which says where Pneus.be delivers.
  const unknown = await (await getAgw(path, env)).text();
  assert.ok(!/does not deliver to your country/.test(unknown));
  assert.match(unknown, /href="\/out\/\d+"/);
  assert.match(unknown, /<span translate="no">Pneus\.be<\/span> delivers to<\/span><\/dt><dd class="ship-dd">.*<span data-country="BE">Belgium<\/span>/s);
  // The Belgian visitor sees the normal page.
  const be = await (await getAgw(path, env, 'BE')).text();
  assert.match(be, /<meta name="robots" content="index,follow">/);
  assert.match(be, /href="\/out\/\d+"/);
  assert.match(be, /<span translate="no">Pneus\.be<\/span> delivers to<\/span><\/dt><dd class="ship-dd">.*<span data-country="BE">Belgium<\/span>/s, 'the Belgian page says where Pneus.be delivers');
  // A price older than 30 days: hidden for everyone, with its own notice.
  const old = idOf(d, 'Oldco Tyre Inflator');
  const stale = await (await getAgw(`/product/oldco-tyre-inflator-${old}/`, env, 'GB')).text();
  assert.match(stale, /data-i18n="We have no price check for this product from the last 30 days, so we don&#39;t show it\."|data-i18n="We have no price check for this product from the last 30 days, so we don't show it\."/);
  assert.ok(!/more than 30 days ago/.test(stale), 'no claim about when it was last checked');
  assert.match(stale, /<meta name="robots" content="noindex,follow">/);
  assert.ok(!/\/out\/\d/.test(stale));
});

test('AGW: /out/ of a product the visitor may not see goes to its page, never to the retailer', async () => {
  const d = carShop();
  const env = envOf(d);
  const id = idOf(d, 'Tyreco Summer 205/55 R16 5');
  const uk = await getAgw(`/out/${id}`, env, 'GB');
  assert.equal(uk.status, 302);
  assert.equal(uk.headers.get('location'), `https://cargearworld.com/product/tyreco-summer-205-55-r16-5-${id}/`);
  const be = await getAgw(`/out/${id}`, env, 'BE');
  assert.equal(be.status, 302);
  assert.match(be.headers.get('location'), /^https:\/\/www\.pneus\.be\//);
});

test('AGW: a price checked 14-30 days ago says "Check price and stock at the retailer", with its real date', async () => {
  const d = carShop();
  const env = envOf(d);
  const id = idOf(d, 'Midco Tyre Gauge');
  const html = await (await getAgw(`/product/midco-tyre-gauge-${id}/`, env, 'GB')).text();
  assert.match(html, /<dd class="check"><span data-i18n="Check price and stock at the retailer">Check price and stock at the retailer<\/span><\/dd>/);
  assert.ok(!/>In stock</.test(html.split('id="sim-h"')[0]), 'no stock claim');
  assert.match(html, /<dt>Price checked<\/dt><dd><time datetime="2026-10-01">/);
  // The RRP is a plain "RRP £40.00", never a "was" price or "Save n%".
  assert.match(html, /<span class="rrp"><span data-i18n="RRP \{0\}" data-i18n-0="£40\.00" data-i18n-keep="0">RRP <span translate="no">£40\.00<\/span><\/span><\/span>/);
  assert.ok(!/class="was"|tag-save|Save \d+%|previous price/i.test(html));
  const api = await (await getAgw('/api/products?search=midco', env)).json();
  assert.equal(api.products[0].stock_status, 'check_retailer');
});

test('"Below RRP": only fresh prices (14 days), never "price drop" wording; the older layout asks nothing', async () => {
  const d = carShop();
  const env = envOf(d);
  const home = await (await getAgw('/', env, 'GB')).text();
  assert.ok(!/price drop|Today's price|previous price|Save \d+%/i.test(home), 'no price-drop words on the home page');
  const deals = await (await getAgw('/deals/', env, 'GB')).text();
  assert.match(deals, /<h1>Below RRP<\/h1>/);
  assert.match(deals, /not an earlier price\. Every price here was checked in the last 14 days\./);
  assert.ok(!/Midco Tyre Gauge/.test(deals), 'checked 20 days ago: not "today"');
  assert.ok(!/price drop|previous price/i.test(deals));
  const cat = await (await getAgw('/category/garage-tools-equipment/', env, 'GB')).text();
  assert.match(cat, /<option value="saving">Furthest below RRP<\/option>/);
  // The older layout has no RRP: no query for it, an empty list.
  const mgw = createWorker(config.mgw);
  const legacy = memD1(read('tests/fixtures/ggw-legacy-schema.sql'), read('tests/fixtures/mgw-seed.sql'));
  const res = await mgw.fetch(new Request('https://mensgearworld.com/deals/'), { DB: legacy }, { waitUntil: p => p });
  assert.equal(res.status, 200);
  assert.ok(!legacy.log.some(q => /was_price > p\.price/.test(q.text)), 'no RRP query on the older layout');
});

test('sitemaps and /api/stats: the UK view for everyone; categories with fewer than 20 visible products are left out', async () => {
  const d = carShop();
  const env = envOf(d);
  const chunk = await (await getAgw('/sitemap-products-1.xml', env, 'BE')).text();
  assert.ok(!/tyreco-summer/.test(chunk), 'no Belgian tyre in the sitemap, even when Belgium asks');
  assert.ok(!/oldco-tyre-inflator/.test(chunk), 'no stale product');
  const total = d.sql.prepare("SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND retailer NOT IN ('Pneus.be', 'VEVOR') AND last_seen_at >= ?").get(viewFor(config.agw, 'GB', NOW).cutoff).n;
  assert.equal((chunk.match(/<url>/g) || []).length, total);
  const stat = await (await getAgw('/sitemap-static.xml', env, 'BE')).text();
  useClock(() => NOW);
  db.useLayout(config.agw);
  const counts = await db.categoryCounts(d, homeView(config.agw));
  for (const c of config.agw.categories) {
    assert.equal(stat.includes(`/category/${c.slug}/<`), (counts[c.slug] || 0) >= MIN_INDEXED_PRODUCTS, c.slug);
  }
  const stats = await (await getAgw('/api/stats', env, 'BE')).json();
  assert.ok(!stats.retailer_names.includes('Pneus.be') && !stats.retailer_names.includes('VEVOR'));
  // L130: the UK number is the sitemap's (the UK view), and every fresh product of every retailer is there too, each
  // retailer with the countries it delivers to, for the group page's countries.
  assert.equal(stats.products, total, 'the UK count is the UK view');
  const fresh = d.sql.prepare('SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND last_seen_at >= ?').get(viewFor(config.agw, 'GB', NOW).cutoff).n;
  assert.equal(stats.all_products, fresh, 'all countries: every fresh product');
  assert.ok(stats.all_products > stats.products, 'the test data has products that do not deliver to the UK');
  const by = Object.fromEntries(stats.delivery.map(x => [x.retailer, x]));
  assert.deepEqual(by['Pneus.be'].countries, ['BE']);
  // VEVOR's feed on AGW is in Dutch (L165): the Group counts it only where its visitors see it.
  assert.deepEqual(by.VEVOR.countries, ['NL', 'BE']);
  assert.equal(stats.delivery.reduce((t, x) => t + x.products, 0), stats.all_products);
  for (const x of stats.delivery) if (x.retailer !== 'Pneus.be' && x.retailer !== 'VEVOR') assert.deepEqual(x.countries, ['GB'], x.retailer);
  // A thin category page: noindex,follow.
  const thin = config.agw.categories.find(c => (counts[c.slug] || 0) > 0 && counts[c.slug] < MIN_INDEXED_PRODUCTS);
  assert.ok(thin, 'a thin category in the test data');
  assert.match(await (await getAgw(`/category/${thin.slug}/`, env, 'GB')).text(), /<meta name="robots" content="noindex,follow">/);
});

test('Women\'s: "Watch Enclave Affiliate Programme" is always shown as "Watch Enclave", also through the filters', async () => {
  const wgw = config.wgw;
  assert.equal(wgw.database.retailerNames['Watch Enclave Affiliate Programme'], 'Watch Enclave');
  const legacy = memD1(read('tests/fixtures/ggw-legacy-schema.sql'), read('tests/fixtures/wgw-seed.sql'));
  legacy.sql.prepare(`INSERT INTO products (awin_product_id, merchant_product_id, retailer, site_category, product_name, price, currency, stock_status, image_url,
    affiliate_url, is_active, updated_at) VALUES ('we1', 'we1', 'Watch Enclave Affiliate Programme', ?, 'Enclave Steel Watch 40mm', 99, 'GBP', 'in stock',
    'https://img.example/w.jpg', 'https://www.awin1.com/cread.php?x=1', 1, '2026-10-20 10:00:00')`).run(Object.values(wgw.database.categories)[0][0]);
  const w = createWorker(wgw);
  const env = { DB: legacy };
  const get = path => w.fetch(new Request(`https://womensgearworld.com${path}`), env, { waitUntil: p => p }).then(r => r.text());
  for (const path of ['/', '/search?q=enclave', `/category/${Object.keys(wgw.database.categories)[0]}/`, '/api/products?search=enclave', '/api/stats']) {
    assert.ok(!/Affiliate Programme/.test(await get(path)), path);
  }
});

// ---- D1 cost: the same plans with a view; similar products bounded ----
const L51_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_products_active_category_price_id ON products(is_active, site_category, price, id);',
  `CREATE INDEX IF NOT EXISTS idx_products_group_key ON products(${db.LEGACY_GROUP_KEY});`,
  'CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(is_active, created_at);'
];
const VIS_TERM = /\s+AND likelihood\((?:[^()]|\([^()]*\))*, 1\.0\)/g;
// The plan of a query, with the index NAME left out: the same constraint on another index of the same table walks the
// same number of index rows (one entry per row), and D1 counts the index rows walked, not the reads of a row by its id
// that follow (measured with the D1 of wrangler, lessons L107). Without its retailer and date, a COUNT can use any index
// that starts with is_active; with them it takes the smallest one, for the same rows. Sorts (TEMP B-TREE) stay in.
const planOf = (sql, text, args) => sql.prepare(`EXPLAIN QUERY PLAN ${text}`).all(...args)
  .map(r => r.detail.replace(/COVERING /, '').replace(/USING INDEX \S+ \(/, 'USING INDEX (').replace(/USING INDEX \S+$/, 'USING INDEX')).join(' | ');

async function plansFor(site, d, view) {
  db.useLayout(site);
  const slugs = site.categories.map(c => c.slug);
  d.log.length = 0;
  await db.homeData(d, slugs, { view });
  for (const c of slugs.slice(0, 3)) {
    await db.listProducts(d, { category: c, view }, { sort: 'featured' });
    await db.listProducts(d, { category: c, view, brand: 'X' }, { sort: 'price-asc' });
    await db.facets(d, c, null, view);
  }
  await db.listProducts(d, { search: 'drill', view }, {});
  await db.searchFacets(d, 'drill', view);
  await db.categoryCounts(d, view);
  await db.stats(d, view);
  await db.sitemapChunk(d, 1, 100, view);
  const p = await db.getProduct(d, d.sql.prepare('SELECT id FROM products WHERE is_active = 1 ORDER BY id LIMIT 1').get().id);
  await db.offersFor(d, p, 12, { view });
  return d.log.map(q => ({ shape: q.text.replace(VIS_TERM, ''), plan: planOf(d.sql, q.text, q.args) }));
}

for (const [code, schema] of [['agw', agwSchema], ['cgw', read('tests/fixtures/ggw-legacy-schema.sql') + '\n' + L51_INDEXES.join('\n')], ['mgw', read('tests/fixtures/ggw-legacy-schema.sql') + '\n' + L51_INDEXES.join('\n')]]) {
  test(`${code.toUpperCase()}: with a view every hot query keeps the plan it has without one (the view only filters)`, async () => {
    const site = config[code];
    const extra = site.database && site.database.groupTable ? 'CREATE TABLE product_group_offers (group_id INTEGER NOT NULL, product_id INTEGER NOT NULL UNIQUE, PRIMARY KEY (group_id, product_id)); CREATE INDEX idx_product_group_offers_group ON product_group_offers(group_id);' : '';
    const d = memD1(schema + '\n' + extra, read(`tests/fixtures/${code}-seed.sql`).replace(/CREATE TABLE product_group_offers[^;]*;/, ''));
    const plain = await plansFor(site, d, null);
    for (const cc of ['GB', 'BE', 'DE']) {
      const view = viewFor(site, cc, NOW);
      const viewed = await plansFor(site, d, view);
      if (view.only) {
        // A view of its own (MGW Germany since Uhrcenter, round 2c, L144): the seed's first product is not in it, so the
        // queries for "the same product at other retailers" do not run; every query that runs keeps its plan.
        const plans = new Map(plain.map(q => [q.shape, q.plan]));
        assert.ok(viewed.length <= plain.length, `${cc}: no more queries than without a view`);
        for (const q of viewed) if (plans.has(q.shape)) assert.equal(q.plan, plans.get(q.shape), `${cc}: ${q.shape.slice(0, 120)}`);
        continue;
      }
      // L159: in fast mode a list the view leaves empty skips its cards query, so a view may run fewer queries; every query
      // it runs keeps the plan of the same query without the view.
      const plans = new Map(plain.map(q => [q.shape, q.plan]));
      assert.ok(viewed.length <= plain.length && viewed.length >= plain.length - 2, `${cc}: the same queries (${viewed.length}, ${plain.length})`);
      for (const q of viewed) if (plans.has(q.shape)) assert.equal(q.plan, plans.get(q.shape), `${cc}: ${q.shape.slice(0, 120)}`);
    }
  });
}

// Random categories where most rows are hidden (the Belgian tyres): similar products read NEAR rows a side, as without a
// view, and their cards are exactly the first cards of the full filtered query (fewer only when the walk ran out).
function random(seed) {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}
test('similar products with a view: a prefix of the full filtered query, never more rows than without a view', async () => {
  const site = config.agw;
  const d = memD1(agwSchema);
  const r = random(107);
  const ins = d.sql.prepare(`INSERT INTO products (stable_key, awin_advertiser_id, merchant_product_id, retailer, category_slug, product_name, product_slug, price,
    currency, in_stock, image_url, affiliate_url, gtin, last_seen_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?, 'GBP', ?, 'https://img.example/x.jpg', 'https://example.com/x', ?, ?)`);
  const eans = Array.from({ length: 300 }, (_, i) => String(5000000000000 + i));
  for (let i = 1; i <= 2500; i++) {
    const retailer = r() < 0.8 ? 'Pneus.be' : r() < 0.5 ? 'VEVOR' : r() < 0.5 ? 'Shop A' : 'Shop B';
    const day = r() < 0.15 ? '2026-09-01 06:00:00' : '2026-10-20 06:00:00';
    ins.run(`k${i}`, `m${i}`, retailer, r() < 0.7 ? 'tyres-wheels' : 'garage-tools-equipment', `P ${i}`, `p-${i}`, [9.99, 10, 25, 49.5, 50, 99][Math.floor(r() * 6)] + Math.floor(r() * 20),
      r() < 0.9 ? 1 : 0, r() < 0.5 ? eans[Math.floor(r() * eans.length)] : null, day);
  }
  db.useLayout(site);
  const ids = d.sql.prepare('SELECT id FROM products ORDER BY id').all().map(x => x.id);
  let checked = 0, shorter = 0;
  for (const cc of ['GB', 'BE', 'FR']) {
    const view = viewFor(site, cc, NOW);
    for (const id of ids.filter((_, i) => i % 23 === 0)) {
      const p = await db.getProduct(d, id);
      if (!p || hiddenReason(view, p)) continue;
      const full = JSON.parse(JSON.stringify(await db.similarProducts(d, p, 8, { full: true, view })));
      d.log.length = 0;
      const got = JSON.parse(JSON.stringify(await db.similarProducts(d, p, 8, { view })));
      assert.deepEqual(got, full.slice(0, got.length), `${cc} ${id}: a prefix of the full query`);
      if (got.length < full.length) shorter++;
      for (const g of got) assert.equal(hiddenReason(view, g), '', `${cc} ${id}: only cards the visitor may see`);
      // Never the full query, and each side asks for NEAR rows, as without a view.
      assert.ok(!d.log.some(q => /ROW_NUMBER\(\) OVER/.test(q.text)), `${cc} ${id}: no full query`);
      const sides = d.log.filter(q => /ORDER BY p\.price (ASC|DESC), p\.id (ASC|DESC)\s+LIMIT \?/.test(q.text));
      assert.equal(sides.length, 2);
      for (const s of sides) assert.equal(s.args[s.args.length - 1], 40);
      checked++;
    }
  }
  assert.ok(checked > 100, `${checked} product pages checked`);
  assert.ok(shorter < checked, 'most pages have their 8 cards');
});

test('the old full listing without a view is unchanged: the same rows as before the view existed (GB on a UK-only site)', async () => {
  // A site where every retailer delivers to the UK and every price is fresh: the UK view shows exactly what no view shows.
  const site = config.tgw;
  const d = memD1(read('sites/tgw/migrations/0001_init.sql'), read('tests/fixtures/tgw-seed.sql'));
  d.sql.prepare("UPDATE products SET last_seen_at = '2026-10-20 06:00:00'").run();
  db.useLayout(site);
  const view = viewFor(site, 'GB', NOW);
  const strip = rows => JSON.parse(JSON.stringify(rows));
  for (const c of site.categories) {
    assert.deepEqual(strip(await db.listProducts(d, { category: c.slug, view }, {})), strip(await db.listProducts(d, { category: c.slug }, {})), c.slug);
    assert.deepEqual(strip(await db.facets(d, c.slug, null, view)), strip(await db.facets(d, c.slug)), c.slug);
  }
  const a = strip(await db.homeData(d, site.categories.map(c => c.slug), { view }));
  const b = strip(await db.homeData(d, site.categories.map(c => c.slug), {}));
  assert.deepEqual({ ...a, deals: [] }, { ...b, deals: [] });
});

test('the Hub passes its visitor\'s country to every site (?deliver_to=), and only a real 2-letter code', () => {
  const hub = read('sites/gwh/worker.js');
  assert.match(hub, /const deliverTo = country \|\| visitorCountry\(request\);/);
  assert.match(hub, /return \/\^\[A-Z\]\{2\}\$\/\.test\(cc\) && cc !== "XX" && cc !== "T1" \? cc : "GB";/, 'unknown: GB');
  assert.match(hub, /if \(deliverTo\) endpoint\.searchParams\.set\("deliver_to", deliverTo\);/);
  assert.match(read('src/engine.js'), /const asked = apiProducts \? url\.searchParams\.get\('deliver_to'\) : '';/);
});

test('the dictionaries of the 13 sites have every new text (lessons L24, L107), and none of the old price-drop words', () => {
  const KEYS = ['RRP {0}', 'RRP', 'Check price and stock at the retailer', 'Below RRP', 'See all below RRP', 'Furthest below RRP',
    '{0} does not deliver to your country.', "We have no price check for this product from the last 30 days, so we don't show it.",
    'No products below their RRP right now', 'In stock, at the joint lowest price.', '{0} sale', UK_BAR_TEXT];
  const OLD = /price drops?|previous price|Save \{0\}%|Biggest saving|^Below RRP today$|^\{0\} does not deliver to \{1\}\.$|^We no longer list this product|^Up to \{0\}% off$|up to \{1\}% off/i;
  let n = 0;
  for (const s of SITES) {
    for (const f of readdirSync(`sites/${s}/public/assets/i18n`)) {
      const dict = JSON.parse(read(`sites/${s}/public/assets/i18n/${f}`));
      for (const k of KEYS) {
        assert.ok(dict[k], `${s}/${f}: ${k}`);
        assert.equal((dict[k].match(/\{\d\}/g) || []).sort().join(), (k.match(/\{\d\}/g) || []).sort().join(), `${s}/${f}: ${k} keeps its placeholders`);
      }
      for (const k of Object.keys(dict)) assert.ok(!OLD.test(k), `${s}/${f}: old key "${k}"`);
      n++;
    }
  }
  assert.equal(n, 143); // 13 sites x 11 languages (pl-PL since L162)
});

// ---- Google's crawlers (item 8 of the checker, 9 Nov 2026) ----
const CRAWLERS = ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'AdsBot-Google (+http://www.google.com/adsbot.html)',
  'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 (compatible; AdsBot-Google-Mobile; +http://www.google.com/mobile/adsbot.html)',
  'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)', 'Mozilla/5.0 (X11; Linux x86_64; Storebot-Google/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  'Mediapartners-Google', 'Mozilla/5.0 (compatible; GoogleOther)'];
test('Google crawlers get the UK view (even from a Belgian address) and no bar; a fake crawler name gains nothing', async () => {
  const d = carShop();
  const env = envOf(d);
  const tyres = html => (html.match(/Tyreco Summer/g) || []).length;
  for (const ua of CRAWLERS) {
    const r = await getAgw('/category/tyres-wheels/', env, 'BE', { 'User-Agent': ua });
    const html = await r.text();
    assert.equal(tyres(html), 0, `${ua.slice(0, 40)}: the UK view`);
    assert.ok(!html.includes('class="country-bar"'), `${ua.slice(0, 40)}: no bar`);
  }
  // A "Googlebot" from the US (a spoofed name or the real one): the UK view, which the US gets anyway, without the bar.
  const spoof = await (await getAgw('/', env, 'US', { 'User-Agent': 'Googlebot' })).text();
  assert.ok(!/Tyreco|Pneus\.be/.test(spoof) && !spoof.includes('class="country-bar"'));
  // Another crawler (or a person) from Belgium: the Belgian view.
  assert.ok(tyres(await (await getAgw('/category/tyres-wheels/', env, 'BE', { 'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0)' })).text()) > 0);
});

// ---- The US view (owner, 14 Nov 2026, lessons L141) ----
// AGW in miniature with Pneus.be shipping to the US as well (no AGW shop does today): a US visitor sees what ships there,
// Google's crawlers from the US still get the UK view, and the sitemaps stay the UK view.
test('L141: a US visitor sees what ships to the US (own cached copy, no bar); Google from the US and the sitemaps: the UK view', async () => {
  const usSite = { ...config.agw, deliversTo: { ...config.agw.deliversTo, retailers: { ...config.agw.deliversTo.retailers, 'Pneus.be': ['BE', 'US'] } } };
  const worker = createWorker(usSite);
  const get = (path, env, country, ua = 'Mozilla/5.0 test') => {
    const req = new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': ua } });
    if (country) Object.defineProperty(req, 'cf', { value: { country } });
    return worker.fetch(req, env, { waitUntil: p => p });
  };
  const d = carShop();
  const env = envOf(d);
  const tyres = html => (html.match(/Tyreco Summer/g) || []).length;
  assert.equal(viewFor(usSite, 'US', NOW).group, 'us');
  assert.deepEqual(viewFor(usSite, 'US', NOW).only, ['Pneus.be']);
  const us = await (await get('/category/tyres-wheels/', env, 'US')).text();
  assert.ok(tyres(us) > 0, 'the US view lists the shop that ships to the US');
  assert.ok(!/Example Motor Parts|Sample Garage Supplies/.test(us.split('<main')[1]), 'and not the UK shops');
  assert.ok(!us.includes('class="country-bar"'), 'no "adding retailers for your country" bar: the US has a view of its own');
  assert.equal(needsUkBar(usSite, 'US'), false);
  assert.equal(cacheKeyUrl('https://cargearworld.com/', viewFor(usSite, 'US', NOW)), 'https://cargearworld.com/?gw-view=us');
  // Google's crawler from a US address: the UK view, no bar.
  const bot = await (await get('/category/tyres-wheels/', env, 'US', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).text();
  assert.equal(tyres(bot), 0, 'Googlebot from the US: the UK view');
  assert.ok(!bot.includes('class="country-bar"'));
  // The UK view and the sitemaps do not change.
  assert.equal(tyres(await (await get('/category/tyres-wheels/', env, 'GB')).text()), 0);
  assert.ok(!/tyreco-summer/.test(await (await get('/sitemap-products-1.xml', env, 'US')).text()), 'no US-only product in the sitemap');
  // The Hub passes ?deliver_to=US: the same US view.
  const api = await (await get('/api/products?search=tyreco&limit=60&deliver_to=US', env, 'GB')).json();
  assert.equal(api.products.length, 30);
  // Canada and every other country without a view of its own: the all view (L151), with the bar.
  const ca = await (await get('/category/tyres-wheels/', env, 'CA')).text();
  assert.ok(tyres(ca) > 0, 'Canada: all the products');
  assert.ok(/Example Motor Parts|Sample Garage Supplies/.test(ca.split('<main')[1]));
  assert.ok(ca.includes('class="country-bar"'));
  // A local test Worker (wrangler dev, the checks): Miniflare's made-up request.cf says "US"; it counts as unknown
  // (CI of 14 Nov 2026: the QA gate of WGW saw an empty US view), so the all view with the bar (L151).
  const localReq = new Request('http://127.0.0.1:8788/category/tyres-wheels/', { headers: { 'User-Agent': 'Mozilla/5.0 test' } });
  Object.defineProperty(localReq, 'cf', { value: { country: 'US' } });
  const local = await (await worker.fetch(localReq, env, { waitUntil: p => p })).text();
  assert.ok(tyres(local) > 0, 'local: the all view');
  assert.ok(local.includes('class="country-bar"'), 'local: the bar, as for an unknown country');
  const localApi = new Request('http://127.0.0.1:8788/api/products?search=tyreco&limit=60&deliver_to=US');
  assert.equal((await (await worker.fetch(localApi, env, { waitUntil: p => p })).json()).products.length, 30, 'local: ?deliver_to= still counts');
});

// ---- The network's own checks from the cloud (chat 2, 15 Nov 2026, lessons L158) ----
// Price and stock checks run in the cloud, where the address is in the US: on a site with a US view they saw only what
// ships to the US. With the name GearWorldQA-bot and the header X-GW-QA-Country they ask the view of one country.
test('L158: GearWorldQA-bot with X-GW-QA-Country gets that country\'s view (pages and API); any other visitor and the cache: no change', async () => {
  const usSite = { ...config.agw, deliversTo: { ...config.agw.deliversTo, retailers: { ...config.agw.deliversTo.retailers, 'Pneus.be': ['BE', 'US'] } } };
  const worker = createWorker(usSite);
  const QA = 'GearWorldQA-bot/1.0 (+read-only check)';
  const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const get = (path, env, country, headers = {}) => {
    const req = new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': BROWSER, ...headers } });
    if (country) Object.defineProperty(req, 'cf', { value: { country } });
    return worker.fetch(req, env, { waitUntil: p => p });
  };
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { if (!key.url.includes('gw-stale=1')) store.set(key.url, res); } // L159: day-long copies apart
  } };
  try {
    const d = carShop();
    const env = envOf(d);
    const tyres = html => (html.match(/Tyreco Summer/g) || []).length;
    const ukShops = html => /Example Motor Parts|Sample Garage Supplies/.test(html.split('<main')[1]);
    const page = async (country, headers) => (await get('/category/tyres-wheels/', env, country, headers)).text();
    const ukPage = await page('GB');
    assert.equal(tyres(ukPage), 0);
    assert.ok(ukShops(ukPage));
    // The check from a US address, as today: the US view.
    const plain = await page('US', { 'User-Agent': QA });
    assert.ok(tyres(plain) > 0 && !ukShops(plain), 'the name alone: the US view, as before');
    // With the header: exactly the UK page, the same cached copy a UK visitor gets (no D1 read, no copy of its own).
    const reads = d.log.length;
    const keys = store.size;
    for (const cc of ['GB', 'gb', ' GB ']) {
      const html = await page('US', { 'User-Agent': QA, [QA_COUNTRY_HEADER]: cc });
      assert.equal(html, ukPage, `X-GW-QA-Country "${cc}": the UK page`);
      assert.ok(!html.includes('class="country-bar"'), 'no bar');
    }
    assert.equal(d.log.length, reads, 'served from the UK copy');
    assert.equal(store.size, keys, 'no cache copy of its own');
    assert.ok(store.has(cacheKeyUrl('https://cargearworld.com/category/tyres-wheels/', viewFor(usSite, 'GB', NOW))));
    // Another country on purpose: Belgium from a UK address, the all view with the bar.
    const be = await page('GB', { 'User-Agent': QA, [QA_COUNTRY_HEADER]: 'BE' });
    assert.ok(tyres(be) > 0 && ukShops(be) && be.includes('class="country-bar"'), 'X-GW-QA-Country BE: the all view');
    // Nobody else: a browser, another bot, a name that only contains it, or a code that is not a country.
    const us = await page('US');
    for (const [headers, what] of [[{ [QA_COUNTRY_HEADER]: 'GB' }, 'a browser with the header'],
      [{ 'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0)', [QA_COUNTRY_HEADER]: 'GB' }, 'another bot'],
      [{ 'User-Agent': `Mozilla/5.0 ${QA}`, [QA_COUNTRY_HEADER]: 'GB' }, 'a name that only contains GearWorldQA-bot'],
      [{ 'User-Agent': QA, [QA_COUNTRY_HEADER]: 'GBR' }, 'GBR'], [{ 'User-Agent': QA, [QA_COUNTRY_HEADER]: 'XX' }, 'XX'],
      [{ 'User-Agent': QA, [QA_COUNTRY_HEADER]: '' }, 'an empty header'], [{ 'User-Agent': QA, 'X-GW-Country': 'GB' }, 'another header']]) {
      const html = await page('US', headers);
      assert.ok(tyres(html) > 0 && !ukShops(html), `${what}: the US view, as before`);
      if (headers['User-Agent'] !== QA) assert.equal(html, us, `${what}: the same page as any US visitor`);
    }
    // A normal US visitor after the checks: still the US view (its own copy), never the UK copy the check read.
    assert.ok(tyres(await page('US')) > 0);
    // /api/products: the header gives the same answer as from the UK; ?deliver_to= (the Hub) still comes first.
    const api = async (path, country, headers) => (await (await get(path, env, country, headers)).json()).products.map(p => p.id).sort();
    const path = '/api/products?search=tyre&limit=60';
    const ukApi = await api(path, 'GB');
    assert.ok(ukApi.length > 0);
    assert.deepEqual(await api(path, 'US', { 'User-Agent': QA, [QA_COUNTRY_HEADER]: 'GB' }), ukApi, 'API with the header: the UK answer');
    assert.notDeepEqual(await api(path, 'US', { 'User-Agent': QA }), ukApi, 'API without it: the US answer, as before');
    assert.deepEqual(await api(`${path}&deliver_to=US`, 'GB', { 'User-Agent': QA, [QA_COUNTRY_HEADER]: 'GB' }), await api(`${path}&deliver_to=US`, 'GB'),
      '?deliver_to= first');
    // Google's crawlers keep the UK view whatever the header says.
    assert.equal(tyres(await page('US', { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', [QA_COUNTRY_HEADER]: 'BE' })), 0);
    assert.equal(QA_COUNTRY_HEADER, 'X-GW-QA-Country');
    assert.ok(QA_BOT.test(QA));
  } finally {
    if (before === undefined) delete globalThis.caches; else globalThis.caches = before;
  }
});

// ---- The bar for visitors outside the UK (item 15, the owner's option A, 9 Nov 2026) ----
test('the UK bar: for the UK view and the all view outside the UK (L151), never for the UK, an own view or a crawler', () => {
  const agw = config.agw;
  assert.equal(needsUkBar(agw, 'GB'), false);
  for (const cc of ['US', 'CA', 'AU', '', 'XX']) assert.equal(needsUkBar(agw, cc), true, `AGW ${cc || 'unknown'}`);
  // Every country that is not open sees all the products since L151, mostly from UK retailers: the bar.
  for (const cc of ['BE', 'NL', 'DE', 'IE', 'NO', 'CH', 'ES', 'IT']) assert.equal(needsUkBar(agw, cc), true, `AGW ${cc}: the all view`);
  // Poland is open since 15 Nov 2026 (L157): its own view where a retailer delivers there, no bar; the all view with the
  // bar where none does.
  assert.equal(needsUkBar(agw, 'PL'), false, 'AGW Poland: Tanie-Opony.pl, VEVOR and Ottocast deliver there');
  assert.equal(needsUkBar(config.wgw, 'PL'), false, 'WGW Poland: AliExpress PL and Invicta Stores');
  assert.equal(needsUkBar({ deliversTo: { default: ['GB'], retailers: {} } }, 'PL'), true, 'no retailer for Poland: the all view, with the bar');
  for (const s of ['tgw', 'sgw', 'kgw']) {
    assert.equal(needsUkBar(config[s], 'FR'), true, `${s}: France`);
    assert.equal(needsUkBar(config[s], 'GB'), false, s);
  }
  assert.equal(needsUkBar(config.tgw, 'MT'), true, 'TGW Malta: the all view');
  assert.equal(needsUkBar(config.hgw, 'FR'), true, 'HGW France: the all view');
  assert.equal(needsUkBar(config.cgw, 'DE'), true, 'CGW Germany: the all view');
  // A country with a view of its own (strict, or open later): only what delivers there, no bar.
  assert.equal(needsUkBar({ ...agw, strictCountries: ['BE'] }, 'BE'), false);
  // The US (L141): a view of its own, no bar, where a retailer ships there; the UK view with the bar where none does.
  // TGW and PGW since round 2c: MonsGeek ships to the US (L144).
  for (const s of ['cgw', 'wgw', 'mgw', 'kgw', 'hgw', 'ggw', 'zgw', 'tgw', 'pgw']) assert.equal(needsUkBar(config[s], 'US'), false, `${s} US: its own view`);
  for (const s of ['agw', 'sgw', 'vgw', 'bgw']) assert.equal(needsUkBar(config[s], 'US'), true, `${s} US: nobody ships there`);
  assert.equal(UK_BAR_TEXT, "We're adding retailers for your country. Most retailers below deliver to the UK only. Check delivery before you buy.");
});

test('the UK bar is added after the page cache: one cached copy for GB and US, no D1 read on a hit, the bar only for the US', async () => {
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { if (!key.url.includes('gw-stale=1')) store.set(key.url, res); } // L159: day-long copies apart
  } };
  try {
    const d = carShop();
    const env = envOf(d);
    const reads = () => d.log.length;
    const r0 = reads();
    const gb = await getAgw('/', env, 'GB');
    const gbHtml = await gb.text();
    const missReads = reads() - r0;
    assert.ok(missReads > 0, 'the first visit reads D1');
    assert.equal(store.size, 1, 'one copy in the cache');
    const cachedHtml = await [...store.values()][0].clone().text();
    assert.ok(!cachedHtml.includes('country-bar'), 'the cached copy has no bar');
    const r1 = reads();
    const us = await getAgw('/', env, 'US');
    const usHtml = await us.text();
    assert.equal(reads() - r1, 0, 'the US visit is a cache hit: no D1 read');
    assert.equal(store.size, 1, 'no copy of its own for the bar');
    assert.equal(cachedHtml, gbHtml, 'GB gets the cached copy as it is');
    assert.ok(usHtml.includes(`<div class="country-bar" role="note"><p class="wrap country-row"><span data-i18n="We&#39;re adding retailers for your country.`) || usHtml.includes('<div class="country-bar" role="note">'));
    assert.equal(usHtml.replace(/<div class="country-bar"[\s\S]*?<\/div>/, ''), cachedHtml, 'the US answer is the same copy plus the bar');
    assert.ok(usHtml.indexOf('class="country-bar"') < usHtml.indexOf('<header class="masthead">'), 'above the header, never over the offer bar or the menu');
    assert.match(us.headers.get('Cache-Control'), /^private/, 'a shared cache never keeps the copy with the bar');
    assert.match(gb.headers.get('Cache-Control'), /^public/);
    // Unknown country and France (L151): the all view, its own copy, with the bar.
    assert.ok((await (await getAgw('/', env)).text()).includes('class="country-bar"'));
    assert.ok((await (await getAgw('/', env, 'FR')).text()).includes('class="country-bar"'));
    assert.equal(store.size, 2, 'one more copy, for the all view (unknown and France share it)');
    assert.ok(store.has('https://cargearworld.com/?gw-view=all'));
    // Not on JSON, XML or a redirect.
    assert.ok(!(await (await getAgw('/sitemap.xml', env, 'US')).text()).includes('country-bar'));
  } finally {
    if (before === undefined) delete globalThis.caches; else globalThis.caches = before;
  }
});

test('strict countries (site.strictCountries, empty on every site today): only what delivers there, an empty view, no bar', () => {
  for (const s of SITES) assert.deepEqual(config[s].strictCountries, [], `${s}: no strict country yet`);
  const site = { ...config.agw, strictCountries: ['US', 'BE'] };
  assert.deepEqual(strictCountries(site), ['US', 'BE']);
  const us = viewFor(site, 'US', NOW);
  assert.equal(us.group, 'us');
  assert.deepEqual(us.only, []);
  assert.equal(hiddenReason(us, { retailer: 'Example Motor Parts', last_seen_at: '2026-10-20 06:00:00' }), 'country');
  assert.match(visibleSql(us).sql, /^likelihood\(0 AND /);
  assert.equal(needsUkBar(site, 'US'), false);
  assert.equal(viewFor(site, 'BE', NOW).group, 'be', 'a strict country with retailers: its own view as before');
  // Without the list nothing changes.
  assert.equal(viewFor(config.agw, 'US', NOW).group, 'gb');
});

test('where the retailers deliver, as every card of the all view says it (L151)', () => {
  const names = (site, r) => toString(deliveryText(site, r)).replace(/<[^>]+>/g, '').trim();
  assert.equal(names(config.agw, 'Pneus.be'), 'Belgium');
  assert.equal(names(config.cgw, 'Reidl'), 'Germany, Austria');
  assert.equal(names(config.wgw, '100% PURE'), 'European Union, Switzerland, Norway');
  for (const s of ['agw', 'vgw', 'cgw']) assert.equal(names(config[s], 'VEVOR'), 'European Union, Iceland, Liechtenstein, Norway', s);
  // The all view lists every retailer, also the UK-only ones: the line under each card is what tells the visitor.
  for (const [s, cc, names] of [['agw', 'FR', ['Ottocast', 'Pneus.be', 'Example Motor Parts']], ['cgw', 'FR', ['GRABO', 'VEVOR', 'Tooled Up']],
    ['wgw', 'FR', ['100% PURE', 'FOREO']], ['vgw', 'FR', ['VEVOR', 'Any UK shop']]]) {
    const v = viewFor(config[s], cc, NOW);
    assert.equal(v.group, 'all', `${s} ${cc}`);
    for (const n of names) assert.equal(retailerInView(v, n), true, `${s} ${cc}: ${n}`);
  }
  // L165: not the feeds in another language (AGW VEVOR in Dutch, CGW Reidl and WGW Uhrcenter in German) nor the shops
  // that ship only to the US (WGW Jeulia); the countries that speak the language see those feeds, with the same line.
  for (const [s, n] of [['agw', 'VEVOR'], ['cgw', 'Reidl'], ['wgw', 'Uhrcenter'], ['wgw', 'Jeulia']]) assert.equal(retailerInView(viewFor(config[s], 'FR', NOW), n), false, `${s} FR: ${n}`);
  for (const [s, cc, n] of [['agw', 'BE', 'VEVOR'], ['cgw', 'AT', 'Reidl'], ['wgw', 'DE', 'Uhrcenter'], ['wgw', 'US', 'Jeulia']]) assert.equal(retailerInView(viewFor(config[s], cc, NOW), n), true, `${s} ${cc}: ${n}`);
  assert.equal(names(config.cgw, 'Tooled Up'), 'United Kingdom');
  // Round 2c (L144): Uhrcenter only where German is spoken (German names), the Irish shops only in Ireland; the line under
  // each card says so in the all view.
  assert.equal(names(config.wgw, 'Uhrcenter'), 'Germany, Austria, Switzerland, Liechtenstein, Luxembourg');
  for (const s of ['wgw', 'mgw', 'hgw', 'kgw', 'ggw']) for (const r of ['Bazta IE', 'Plusshop IE']) assert.equal(names(config[s], r), 'Ireland', `${s} ${r}`);
  assert.equal(names(config.agw, 'Tanie-Opony.pl'), 'Poland');
  // "Europe" is no longer claimed on AGW, VGW and WGW.
  for (const s of ['agw', 'vgw', 'wgw']) assert.equal(config[s].retailersFromEurope, false, s);
});

test('a search with one brand or retailer is counted through that index (INDEXED BY), only on the newer layout (item 14)', async () => {
  // Every newer site's migration has the two indexes the count names (checked on the 7 live databases, 9 Nov 2026).
  for (const s of SITES.filter(n => existsSync(`sites/${n}/migrations/0001_init.sql`))) {
    const m = read(`sites/${s}/migrations/0001_init.sql`);
    assert.match(m, /CREATE INDEX idx_products_brand ON products \(is_active, brand\);/, s);
    assert.match(m, /CREATE INDEX idx_products_retailer ON products \(is_active, retailer\);/, s);
  }
  const d = carShop();
  const env = envOf(d);
  for (const [q, idx] of [['brand=Tyreco', 'idx_products_brand'], ['retailer=Pneus.be', 'idx_products_retailer']]) {
    d.log.length = 0;
    const r = await getAgw(`/search?q=tyreco&${q}`, env, 'BE');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Tyreco Summer/);
    const count = d.log.find(x => /^SELECT COUNT\(DISTINCT/.test(x.text));
    assert.ok(count && count.text.includes(`FROM products p INDEXED BY ${idx} WHERE`), q);
    const plan = d.sql.prepare(`EXPLAIN QUERY PLAN ${count.text}`).all(...count.args).map(x => x.detail).join(' | ');
    assert.match(plan, new RegExp(`USING INDEX ${idx} \\(is_active=\\? AND (brand|retailer)=\\? AND rowid=\\?\\)`), plan);
  }
  // Without a search, or on the older layout: no INDEXED BY.
  d.log.length = 0;
  await getAgw('/category/tyres-wheels/?brand=Tyreco', env, 'BE');
  // (The indexes of L159 that walk a category in its sort's order are named on category pages: not these two.)
  assert.ok(!d.log.some(x => /INDEXED BY idx_products_(brand|retailer)\b/.test(x.text)));
  const mgw = createWorker(config.mgw);
  const legacy = memD1(read('tests/fixtures/ggw-legacy-schema.sql'), read('tests/fixtures/mgw-seed.sql'));
  await mgw.fetch(new Request('https://mensgearworld.com/search?q=watch&brand=Seiko'), { DB: legacy }, { waitUntil: p => p });
  assert.ok(!legacy.log.some(x => /INDEXED BY/.test(x.text)));
});

// ---- Browsing a site as one country from the Group's country pages (owner, 15 Nov 2026, lessons L160) ----
// "When I press a country, show what that country sells; the site links should not take you to the UK" — and a link a
// network (Linkwise for Greece) can open to check its market. ?for=<cc> redirects with a cookie; with the cookie every
// page and the site's own /api/products show only what delivers there, with a bar and a way back.
test('L160: ?for=<cc> from the Group: a cookie, then only what delivers there on every page and in the API, with a bar', async () => {
  const worker = createWorker(config.agw);
  const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const GOOGLE = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  const get = (path, env, country, headers = {}) => {
    const req = new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': BROWSER, ...headers } });
    if (country) Object.defineProperty(req, 'cf', { value: { country } });
    return worker.fetch(req, env, { waitUntil: p => p });
  };
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { if (!key.url.includes('gw-stale=1')) store.set(key.url, res); }
  } };
  try {
    const d = carShop();
    const env = envOf(d);
    const tyres = h => (h.match(/Tyreco Summer/g) || []).length;
    const ukShops = h => /Example Motor Parts|Sample Garage Supplies/.test(h.split('<main')[1]);
    // The link of the Group: a redirect to the same page without ?for=, with the cookie (this site, one day, nothing else).
    const go = await get('/category/tyres-wheels/?for=be&sort=price', env, 'GB');
    assert.equal(go.status, 302);
    assert.equal(go.headers.get('Location'), 'https://cargearworld.com/category/tyres-wheels/?sort=price');
    assert.equal(go.headers.get('Set-Cookie'), 'gw_for=BE; Path=/; Max-Age=86400; Secure; HttpOnly; SameSite=Lax');
    assert.equal(go.headers.get('Cache-Control'), 'no-store');
    // A UK visitor with the cookie: Belgium's products only (the Belgian tyres, no UK-only shop), the bar, a way back.
    const be = await get('/category/tyres-wheels/', env, 'GB', { Cookie: 'other=1; gw_for=BE' });
    assert.equal(be.status, 200);
    const beHtml = await be.text();
    assert.ok(tyres(beHtml) > 0 && !ukShops(beHtml), 'only what delivers to Belgium');
    assert.match(beHtml, /<div class="country-bar browse-bar" role="note">.*You are seeing only the products that deliver to Belgium\..*<a href="\/category\/tyres-wheels\/\?for=off" rel="nofollow">/s);
    assert.ok(beHtml.indexOf('browse-bar') < beHtml.indexOf('<header class="masthead">'), 'the bar above the header');
    assert.ok(!beHtml.includes(UK_BAR_TEXT), 'not the UK bar');
    assert.equal(be.headers.get('Cache-Control'), 'private, no-cache');
    assert.match(be.headers.get('Vary') || '', /Cookie/);
    // Its own cached copy (the Belgian group), never the UK one; the cached copy has no bar.
    const beKey = cacheKeyUrl('https://cargearworld.com/category/tyres-wheels/', browseView(config.agw, 'BE', NOW));
    assert.ok(store.has(beKey) && /gw-view=be/.test(beKey));
    assert.ok(!(await store.get(beKey).clone().text()).includes('browse-bar'));
    // The same visitor without the cookie: the UK page, as before, which tells the browser it depends on the cookie.
    const uk = await get('/category/tyres-wheels/', env, 'GB');
    const ukHtml = await uk.text();
    assert.ok(tyres(ukHtml) === 0 && ukShops(ukHtml) && !ukHtml.includes('browse-bar'));
    assert.match(uk.headers.get('Vary') || '', /Cookie/);
    // A visitor from Belgium itself without the cookie: the all view of L151, with its bar (nothing changes for them).
    const beVisitor = await (await get('/category/tyres-wheels/', env, 'BE')).text();
    assert.ok(tyres(beVisitor) > 0 && ukShops(beVisitor) && beVisitor.includes(UK_BAR_TEXT));
    // The site's own search and filters (/api/products) follow the cookie too; the Hub's ?deliver_to= comes first.
    const api = async (path, headers) => (await (await get(path, env, 'GB', headers)).json()).products;
    const beApi = await api('/api/products?search=tyre&limit=60', { Cookie: 'gw_for=BE' });
    assert.ok(beApi.length > 0 && beApi.every(p => p.retailer !== 'Example Motor Parts' && p.retailer !== 'Sample Garage Supplies'));
    assert.deepEqual((await api('/api/products?search=tyre&limit=60&deliver_to=GB', { Cookie: 'gw_for=BE' })).map(p => p.id),
      (await api('/api/products?search=tyre&limit=60&deliver_to=GB')).map(p => p.id), 'the Hub: ?deliver_to= first');
    // "Show what delivers to my country": the cookie goes; an unknown code does the same.
    for (const v of ['off', 'xyz', '']) {
      const off = await get(`/category/tyres-wheels/?for=${v}`, env, 'GB', { Cookie: 'gw_for=BE' });
      assert.equal(off.status, 302, v);
      assert.equal(off.headers.get('Location'), 'https://cargearworld.com/category/tyres-wheels/');
      assert.equal(off.headers.get('Set-Cookie'), 'gw_for=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax');
    }
    // Google never browses as a country: ?for= only redirects it (no cookie), and a cookie changes nothing.
    const g = await get('/category/tyres-wheels/?for=be', env, 'US', { 'User-Agent': GOOGLE });
    assert.equal(g.status, 302);
    assert.equal(g.headers.get('Set-Cookie'), null);
    const gHtml = await (await get('/category/tyres-wheels/', env, 'US', { 'User-Agent': GOOGLE, Cookie: 'gw_for=BE' })).text();
    assert.ok(tyres(gHtml) === 0 && !gHtml.includes('browse-bar'), 'Google: the UK view');
    // Only a two-letter country in the cookie counts; anything else is ignored.
    const odd = await (await get('/category/tyres-wheels/', env, 'GB', { Cookie: 'gw_for=BEL; xgw_for=BE' })).text();
    assert.equal(tyres(odd), 0);
    // The UK itself from the Group: the UK view (the same rows as any UK visitor), with the bar saying so.
    const gb = await (await get('/category/tyres-wheels/', env, 'US', { Cookie: 'gw_for=GB' })).text();
    assert.ok(tyres(gb) === 0 && ukShops(gb) && gb.includes('deliver to United Kingdom'));
  } finally {
    globalThis.caches = before;
  }
});

test('L160: browseView: only the retailers that deliver to that country, open or not; the UK view for the UK', () => {
  const be = browseView(config.agw, 'BE', NOW);
  assert.equal(be.browse, 'BE');
  assert.deepEqual(be.only, ['Ottocast', 'Pneus.be', 'VEVOR'].filter(r => retailerInView(be, r)));
  assert.ok(!retailerInView(be, 'Example Motor Parts'));
  assert.equal(viewFor(config.agw, 'BE', NOW).group, 'lang-be-nl', 'a visitor from Belgium still gets the all view (L151), with the Dutch feed (L165)');
  assert.equal(browseView(config.agw, 'GB', NOW).group, viewFor(config.agw, 'GB', NOW).group);
  assert.equal(browseView(config.agw, 'BE', NOW).group, browseView(config.agw, 'BE', NOW).group, 'stable');
  assert.deepEqual(browseView(config.agw, 'US', NOW).only, [], 'nobody on AGW ships to the US: an empty view, not the UK one');
});

test('L160: the cookies page names gw_for', () => {
  assert.match(readFileSync('src/pages/info.js', 'utf8'), /the cookie <code>gw_for<\/code> keeps that country \(two letters, nothing else\) for one day/);
});
