// AliExpress PL and the Poland view (owner, 15 Nov 2026, lessons L157).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ali from '../../tools/import-rules/aliexpress-pl.mjs';
import { OPEN_COUNTRIES } from '../../src/lib/open-countries.js';
import { viewFor, countryGroups, localOnlyRetailers, needsUkBar, isShown } from '../../src/lib/visibility.js';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const site = name => import(`../../sites/${name}/site.config.js`).then(m => m.default);
const c = (name, cat) => ali.classify({ name, feedCategory: cat });

test('L157: Poland is open; AliExpress PL is seen only in the Poland view, never in the UK or the all view', async () => {
  assert.deepEqual(OPEN_COUNTRIES, ['GB', 'PL']);
  for (const s of ['wgw', 'mgw', 'kgw', 'hgw', 'ggw', 'cgw']) {
    const cfg = await site(s);
    assert.deepEqual(cfg.deliversTo.retailers['AliExpress PL'], ['PL'], s);
    assert.ok(cfg.foreignCurrencies.includes('PLN'), `${s}: "≈ £" for zloty prices`);
    assert.ok(localOnlyRetailers(cfg).includes('AliExpress PL'), s);
    const row = { retailer: 'AliExpress PL', last_seen_at: '2026-11-15 10:00:00' };
    assert.equal(isShown(viewFor(cfg, 'GB', NOW), row), false, `${s}: not in the UK view`);
    for (const cc of ['DE', 'FR', 'GR', 'IE', '']) assert.equal(isShown(viewFor(cfg, cc, NOW), row), false, `${s} ${cc || 'unknown'}: not in the all view`);
    assert.equal(isShown(viewFor(cfg, 'US', NOW), row), false, `${s}: not in the US view`);
    assert.equal(isShown(viewFor(cfg, 'PL', NOW), row), true, `${s}: in the Poland view`);
    assert.equal(viewFor(cfg, 'PL', NOW).group, 'pl', s);
    assert.equal(needsUkBar(cfg, 'PL'), false, `${s}: Poland has its own view, no bar`);
    // A UK shop is not in the Poland view; the all view still has every other retailer.
    assert.equal(isShown(viewFor(cfg, 'PL', NOW), { retailer: 'A UK shop', last_seen_at: '2026-11-15 10:00:00' }), false, s);
    assert.equal(isShown(viewFor(cfg, 'DE', NOW), { retailer: 'A UK shop', last_seen_at: '2026-11-15 10:00:00' }), true, s);
  }
  // A shop that delivers to Poland and elsewhere (Invicta Stores) stays in the all view.
  const mgw = await site('mgw');
  assert.ok(!localOnlyRetailers(mgw).includes('Invicta Stores'));
  // A site where nobody delivers to Poland: a visitor from Poland gets the all view (with the bar), not an empty page.
  const bare = { deliversTo: { default: ['GB'], retailers: { Reidl: ['DE', 'AT'] } } };
  assert.equal(viewFor(bare, 'PL', NOW).group, 'all');
  assert.equal(needsUkBar(bare, 'PL'), true);
  assert.ok(countryGroups(bare).list.every(g => g.id === 'gb' || g.id === 'all'));
});

test('L157: AliExpress PL rules: the Polish shop only, one card per item, sections to the six older sites', () => {
  assert.equal(ali.RULES.currency, 'PLN');
  assert.ok(ali.RULES.shop.test('https://pl.aliexpress.com/item/1005006166388737.html?isdl=y&aff_fsk=x&src=y'));
  assert.ok(!ali.RULES.shop.test('https://www.aliexpress.com/item/1005006166388737.html'), 'the English shop (yuan, dollars) stays out');
  assert.equal(ali.RULES.keepQuery, true);
  assert.equal(ali.productKey(col => (col === 'merchant_deep_link' ? 'https://pl.aliexpress.com/item/1005004581794278.html?isdl=y' : '')), '1005004581794278');
  assert.deepEqual(c('Kubek ceramiczny 350 ml', 'Dom i ogród , Kuchnia, jadalnia i bar , Naczynia do picia'), { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: 'Drinkware' });
  assert.deepEqual(c('Lampa wisząca LED Slim Line do salonu', 'Światła i oświetlenie , Oświetlenie wewnętrzne , Lampy stojące'), { site: 'hgw', siteCategory: 'Lighting', subcategory: 'Pendant Light' }, 'the name says the kind');
  assert.deepEqual(c('Przenośny osuszacz powietrza 2800 ml', 'Sprzęt AGD , Sprzęt AGD , Klimatyzatory przenośne'), { site: 'hgw', siteCategory: 'Home Appliances', subcategory: 'Dehumidifier' });
  assert.deepEqual(c('Kolczyki koła z moissanitami damskie', 'Biżuteria i akcesoria , Ekskluzywna biżuteria , Kolczyki'), { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: 'Earrings' });
  assert.deepEqual(c('Męska bransoletka ze stali', 'Biżuteria i akcesoria , Biżuteria modowa , Bransoletki'), { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Bracelets' });
  assert.deepEqual(c('Dragon Ball Z Son Goku Figurka', 'Zabawki i hobby , Figurki akcji i zabawki , Figurki'), { site: 'kgw', siteCategory: 'Toys & Games', subcategory: 'Action & Toy Figures' });
  assert.deepEqual(c('Szlifierka kątowa 125 mm', 'Narzędzia wspomagające , Kosze , Szlifierki kątowe'), { site: 'cgw', siteCategory: 'Power Tools', subcategory: 'Power Tools' });
  assert.deepEqual(c('Lampa solarna ogrodowa', 'Światła i oświetlenie , Oświetlenie zewnętrzne , Lampy solarne'), { site: 'ggw', siteCategory: 'Outdoor Lighting & Garden Electrical', subcategory: 'Solar lights' });
  // Round 2: the newer engines' sections wait, named in the report.
  assert.match(c('Kamera cofania', 'Motoryzacja oraz części i akcesoria motoryzacyjne , Elektronika samochodowa , Kamery').reject, /round 2: Car Gear World/);
  assert.match(c('Etui na telefon', 'Akcesoria do telefonów i telekomunikacji , Etui i pokrowce na telefony komórkowe , Etui').reject, /round 2: Technology Gear World/);
  assert.match(c('Smycz dla psa', 'Dom i ogród , Produkty dla zwierząt domowych , Psy').reject, /round 2: Pets Gear World/);
});

test('L157: AliExpress PL never lists weapons, adult or medical products, and Kids\' Gear World gets no collectors\' figures', () => {
  const F = 'Zabawki i hobby , Figurki akcji i zabawki , Figurki';
  for (const [n, cat] of [
    ['40-calowy Miecz Vapor Yamato Katana', F],
    ['Gorąca wyprzedaż: celownik taktyczny do polowań', F],
    ['Nóż składany z ostrzem z damażu VG10', 'Narzędzia wspomagające , Narzędzia ręczne , Noże'],
    ['Seksowna bielizna nocna', 'Bielizna , Damska odzież nocna , Seksowna bielizna nocna'],
    ['E-papieros jednorazowy', 'Dom i ogród , Artykuły gospodarstwa domowego , Zapalniczki i akcesoria do palenia'],
    ['Soczewki kontaktowe kolorowe', 'Uroda i zdrowie , Zdrowie , Soczewki kontaktowe']
  ]) assert.ok(c(n, cat).reject, n);
  for (const n of ['FuRyu BiCute Bunnies – figurka anime', 'Figurka anime dziewczyny Date A Live Tokisaki Kurumi', '40cm Honkai Star Rail Anime Girl Figurka',
    'Figurka 1/7 skala PVC statuetka']) assert.match(c(n, F).reject, /adult collectors/, n);
  assert.equal(c('Sukienka Księżniczki dla Dziewczynek, Strój Cosplay', F).site, 'kgw', '"for girls" is fine');
  assert.ok(c('Punk Rock Music Tape Cassettes', F).reject);
  assert.equal(ali.displayName('Dostępne w magazynie: Riot Games Heartsteel Przypinka_yythk'), 'Riot Games Heartsteel Przypinka yythk');
  assert.ok(ali.displayName('a '.repeat(80)).length <= 110);
});
