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

// ---- Round 2 (the newer sites' engine, 15 Nov 2026) ----
import { aliexpressSection, SECTION_SITES } from '../../tools/import-rules/lib/aliexpress-sections.mjs';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { planAgwImport } from '../../tools/agw-import-plan.mjs';

test('L157 round 2: the Polish sections go to the newer sites, each to its own categories with an English subcategory', () => {
  const s = (site, n, cat) => aliexpressSection(site, n, cat);
  const CAR = 'Motoryzacja oraz części i akcesoria motoryzacyjne';
  assert.deepEqual(s('AGW', 'Kamera samochodowa DVR 4K', `${CAR} , Elektronika samochodowa , DVR do samochodu`), { ok: true, slug: 'car-electronics', sub: 'Dash Cams', name: 'Kamera samochodowa DVR 4K' });
  assert.match(s('AGW', 'Felgi aluminiowe 17 cali', `${CAR} , Części eksploatacyjne i zamienne , Koła, opony i części`).reason, /tyre/, 'no wheels or tyres until the fix (L146)');
  assert.equal(s('TGW', 'Słuchawki Bluetooth', 'Elektronika użytkowa , Przenośny sprzęt Audio i wideo , Słuchawki douszne i nauszne').sub, 'Headphones & Earbuds');
  assert.equal(s('PGW', 'Pad do PS5', 'Elektronika użytkowa , Gry i akcesoria , Gamepady').slug, 'controllers');
  assert.match(s('TGW', 'Pad do PS5', 'Elektronika użytkowa , Gry i akcesoria , Gamepady').reason, /section of PGW/, 'each section has one site');
  assert.equal(s('SGW', 'Rower elektryczny 250W', 'Sport i rozrywka , Jazda na rowerze , Rower elektryczny').slug, 'cycling');
  assert.equal(s('BGW', 'Hulajnoga elektryczna 350W', 'Sport i rozrywka , Jazda na rowerze , Hulajnogi').slug, 'electric-scooters');
  assert.equal(s('BGW', 'Hulajnoga dla dzieci', 'Sport i rozrywka , Jazda na rowerze , Hulajnogi').slug, 'kick-scooters');
  assert.equal(s('ZGW', 'Legowisko dla psa', 'Dom i ogród , Produkty dla zwierząt domowych , Legowiska i maty dla psów i kotów').slug, 'beds-crates');
  // Never: hunting, survival first aid, a helmet without the ECE test mark, SIM cards, marketplace pet food.
  assert.ok(!s('SGW', 'Torba myśliwska', 'Sport i rozrywka , Polowanie , Torby myśliwskie').ok);
  assert.ok(!s('SGW', 'Opaska uciskowa', 'Sport i rozrywka , Kamping i wędrówki , Bezpieczeństwo i przetrwanie').ok);
  assert.ok(!s('BGW', 'Kask motocyklowy retro', 'Sprzęty i akcesoria motocyklowe , Sprzęt motocyklowy , Kaski i nakrycia głowy').ok);
  assert.equal(s('BGW', 'Kask integralny ECE 22.06', 'Sprzęty i akcesoria motocyklowe , Sprzęt motocyklowy , Kaski i nakrycia głowy').slug, 'helmets');
  assert.ok(!s('TGW', 'Karta SIM', 'Akcesoria do telefonów i telekomunikacji , Karty Sim i akcesoria , Karty SIM dla telefonów mobilnych').ok);
  assert.ok(!s('ZGW', 'Karma dla psa', 'Dom i ogród , Produkty dla zwierząt domowych , Karma dla psów i kotów').ok);
  // A round-1 section is not for these sites.
  assert.match(s('TGW', 'Kubek', 'Dom i ogród , Kuchnia, jadalnia i bar , Naczynia do picia').reason, /round 1/);
  assert.deepEqual(SECTION_SITES.sort(), ['AGW', 'BGW', 'PGW', 'SGW', 'TGW', 'VGW', 'ZGW']);
});

test('L157 round 2: the seven newer sites list AliExpress PL from the Polish feed, Poland only, zloty allowed', async () => {
  for (const s of ['agw', 'tgw', 'sgw', 'bgw', 'pgw', 'zgw', 'vgw']) {
    const src = JSON.parse(readFileSync(`sites/${s}/sources.json`, 'utf8')).sources.find(x => x.retailer === 'AliExpress PL');
    assert.deepEqual(src, { advertiserId: 12044, feedIds: [101519], retailer: 'AliExpress PL', currency: 'PLN', condition: 'new', approved: true, sections: 'aliexpress-pl', joinVariants: true }, s);
    const cfg = await site(s);
    assert.deepEqual(cfg.deliversTo.retailers['AliExpress PL'], ['PL'], s);
    assert.ok(cfg.foreignCurrencies.includes('PLN'), s);
    const rules = await import(`../../sites/${s}/category-rules.js`);
    assert.ok(rules.QUALITY.currencies.includes('PLN'), s);
    assert.equal(isShown(viewFor(cfg, 'GB', NOW), { retailer: 'AliExpress PL', last_seen_at: '2026-11-15 10:00:00' }), false, `${s}: not in the UK view`);
    assert.equal(isShown(viewFor(cfg, 'PL', NOW), { retailer: 'AliExpress PL', last_seen_at: '2026-11-15 10:00:00' }), true, `${s}: in the Poland view`);
  }
});

test('L157 round 2: "joinVariants" makes one card per AliExpress product, at its cheapest colour or size', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ali-plan-'));
  const a = join(dir, 'GW_AWIN_BULK_ARCHIVE');
  mkdirSync(a);
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,parent_product_id,merchant_image_url,merchant_category,search_price,currency,in_stock\n';
  const link = p => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=12044`;
  const cat = '"Motoryzacja oraz części i akcesoria motoryzacyjne , Elektronika samochodowa , DVR do samochodu"';
  writeFileSync(join(a, 'AWIN_12044_101519.csv.gz'), gzipSync(head
    + `${link(1)},Kamera samochodowa DVR 4K,1,12000000000001,1005000000000001,https://img.example/1.jpg,${cat},129.99,PLN,1\n`
    + `${link(2)},Kamera samochodowa DVR 4K,2,12000000000002,1005000000000001,https://img.example/1.jpg,${cat},99.50,PLN,1\n`
    + `${link(3)},Kamera samochodowa DVR 4K,3,12000000000003,1005000000000001,https://img.example/1.jpg,${cat},89.00,PLN,0\n`));
  const sources = join(dir, 'sources.json');
  writeFileSync(sources, JSON.stringify({ sources: [{ advertiserId: 12044, feedIds: [101519], retailer: 'AliExpress PL', currency: 'PLN', condition: 'new', approved: true, sections: 'aliexpress-pl', joinVariants: true }] }));
  const { stats, products } = await planAgwImport({ archive: a, sourcesFile: sources, outDir: join(dir, 'out'), now: new Date('2026-11-15T12:00:00Z') });
  assert.equal(stats.accepted, 1, 'three colours, one card');
  assert.equal(products[0].merchant_product_id, '1005000000000001');
  assert.equal(products[0].price, 99.5, 'the cheapest variant in stock');
  assert.equal(products[0].currency, 'PLN');
  assert.equal(products[0].subcategory, 'Dash Cams');
});
