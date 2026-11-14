// Massive import round 2c (14 Nov 2026, lessons L144): tyres for Spain, Italy and Poland on AGW, Back to the Office IE and
// MonsGeek on TGW and PGW, Bazta IE and Plusshop IE on the five older sites, Uhrcenter on WGW and MGW.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { tyreProduct, tyreBrand, planImport } from '../../tools/tgw-import-plan.mjs';
import * as AGW_RULES from '../../sites/agw/category-rules.js';
import * as baztaIe from '../../tools/import-rules/bazta-ie.mjs';
import * as plusshopIe from '../../tools/import-rules/plusshop-ie.mjs';
import * as plusshop from '../../tools/import-rules/plusshop.mjs';
import * as uc from '../../tools/import-rules/uhrcenter.mjs';
import * as sb from '../../tools/import-rules/switchbot.mjs';
import { SHOP_IMAGES, SHOP_GONE } from '../../tools/import-rules/lib/switchbot-shop.mjs';
import { fixMojibake } from '../../tools/import-rules/lib/plusshop-family.mjs';
import { deliveryCountries } from '../../src/lib/delivery.js';

const config = {};
for (const s of ['agw', 'tgw', 'pgw', 'wgw', 'mgw', 'hgw', 'kgw', 'ggw']) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;
const sources = s => JSON.parse(readFileSync(`sites/${s}/sources.json`, 'utf8')).sources;

test('L144 tyres: brand + model + size, car and van tyres only (no motorbike, quad or old markings, no bare wheel codes)', () => {
  assert.deepEqual(tyreProduct('Alenza 001 RFT', 'Bridgestone', '275/45 R20 110Y', 'tyres'),
    { ok: true, name: 'Bridgestone Alenza 001 RFT 275/45 R20 110Y', brand: 'Bridgestone' });
  assert.equal(tyreProduct('Ventus Prime 4 K135A', 'HANKOOK', '225/55 R19 99V', 'tyres').name, 'Hankook Ventus Prime 4 K135A 225/55 R19 99V');
  assert.equal(tyreProduct('Vansmart MCV3+', 'Maxxis', '185 R14 102/100R', 'tyres').name, 'Maxxis Vansmart MCV3+ 185 R14 102/100R', 'van');
  assert.equal(tyreProduct('N Fera Sport', 'Nexen', '235/35 ZR19 91Y', 'tyres').ok, true);
  assert.equal(tyreProduct('Michelin Pilot Sport 5', 'Michelin', '225/40 ZR18 92Y', 'tyres').name, 'Michelin Pilot Sport 5 225/40 ZR18 92Y', 'the brand once');
  assert.equal(tyreProduct('Trail Terrain T/A', 'BF Goodrich', '31x10.50 R15 109S', 'tyres').ok, true, 'flotation size');
  for (const [model, size] of [['K80', '80/100 D17 53S'], ['D404', '150/80 B16 71H'], ['K530F', '25x8.00 D12 38F'],
    ['ContiRoadAttack 3', '120/70 ZR18 59W'], ['Sprint Classic', '185/70 VR13 86V'], ['Super All Grip', '7.50 R16 112/110N'], ['X', '']]) {
    assert.equal(tyreProduct(model, 'Brand', size, 'tyres').ok, false, `${model} ${size}`);
  }
  assert.match(tyreProduct('RC27', 'Rc Design', '', 'Wheels').reason, /not a tyre/);
  assert.equal(tyreBrand('BKT'), 'BKT');
  assert.equal(tyreBrand('GT Radial'), 'GT Radial');
});

test('L144 tyres: each shop for its own country, prices in its own currency, rates for "≈ £" (zloty, dollars)', async () => {
  const src = sources('agw');
  for (const [id, name, cur] of [[11552, 'Neumaticos.es', 'EUR'], [12716, 'Pneumatici.it', 'EUR'], [82555, 'Tanie-Opony.pl', 'PLN']]) {
    const s = src.find(x => x.advertiserId === id);
    assert.equal(s.retailer, name);
    assert.equal(s.currency, cur);
    assert.equal(s.tyreNames, true);
    assert.equal(s.categoryDefault, 'tyres-wheels');
  }
  assert.deepEqual(deliveryCountries(config.agw, 'Neumaticos.es'), ['ES']);
  assert.deepEqual(deliveryCountries(config.agw, 'Pneumatici.it'), ['IT']);
  assert.deepEqual(deliveryCountries(config.agw, 'Tanie-Opony.pl'), ['PL']);
  assert.ok(AGW_RULES.QUALITY.currencies.includes('PLN'));
  assert.deepEqual(config.agw.foreignCurrencies, ['USD', 'PLN']);

  // The plan with a small feed of the Neumaticos.es layout.
  const dir = mkdtempSync(join(tmpdir(), 'tyres-'));
  const archive = join(dir, 'a');
  mkdirSync(archive);
  const head = 'aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_category,search_price,currency,brand_name,in_stock,ean,description\n';
  const link = p => `https://www.awin1.com/pclick.php?p=${p}&a=1&m=11552`;
  const rows = [
    [link(1), 'Alenza 001 RFT', '1', '9998585', 'https://static.tyres.net/a.jpg', 'tyres', '290.01', 'EUR', 'Bridgestone', '1', '3286341368116', '275/45 R20 110Y'],
    [link(2), 'K80', '2', '9998421', 'https://static.tyres.net/b.jpg', 'tyres', '73.47', 'EUR', 'Heidenau', '1', '4013464000000', '80/100 D17 53S'],
    [link(3), 'RC27', '3', '999578', 'https://static.tyres.net/c.jpg', 'Wheels', '163.23', 'EUR', 'Rc Design', '1', '', ''],
    [link(4), 'Ventus Prime 4 K135A', '4', '9998001', 'https://static.tyres.net/d.jpg', 'tyres', '166.55', 'EUR', 'HANKOOK', '1', '8808563000000', '225/55 R19 99V']
  ];
  writeFileSync(join(archive, 'AWIN_11552_22139.csv.gz'), gzipSync(Buffer.from(head + rows.map(r => r.join(',')).join('\n') + '\n')));
  const sourcesFile = join(dir, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify({ sources: src.filter(x => x.advertiserId === 11552) }));
  const out = join(dir, 'out');
  const { stats, products } = await planImport({ archive, sourcesFile, outDir: out, rules: AGW_RULES, label: 'AGW', now: new Date('2026-11-14T19:00:00Z') });
  assert.equal(stats.accepted, 2, JSON.stringify(stats.rejected));
  assert.deepEqual(products.map(p => p.product_name).sort(), ['Bridgestone Alenza 001 RFT 275/45 R20 110Y', 'Hankook Ventus Prime 4 K135A 225/55 R19 99V']);
  assert.deepEqual([...new Set(products.map(p => p.category_slug))], ['tyres-wheels']);
  assert.equal(products.find(p => p.brand === 'Hankook').product_slug, 'hankook-ventus-prime-4-k135a-225-55-r19-99v');
});

test('L144 TGW and PGW: Back to the Office IE (Ireland, the UK shop\'s rules) and MonsGeek (UK, US, Europe but Malta; no gift cards), in euros', () => {
  for (const s of ['tgw', 'pgw']) {
    const src = sources(s);
    const ie = src.find(x => x.retailer === 'Back to the Office IE');
    assert.equal(ie.advertiserId, 129295);
    assert.equal(ie.rulesFrom, 61655, `${s}: the UK shop's brands and names rules`);
    assert.equal(ie.currency, 'EUR');
    const mg = src.find(x => x.retailer === 'MonsGeek');
    assert.equal(mg.advertiserId, 113754);
    assert.ok(new RegExp(mg.denyNames.join('|'), 'i').test('MonsGeek Gift Card'), s);
    assert.ok(!new RegExp(mg.denyNames.join('|'), 'i').test('MonsGeek M1 V5 TMR Magnetic Keyboard'), s);
    assert.deepEqual(deliveryCountries(config[s], 'Back to the Office IE'), ['IE'], s);
    const m = deliveryCountries(config[s], 'MonsGeek');
    for (const cc of ['GB', 'US', 'DE', 'FR', 'IE', 'CH', 'NO', 'IS', 'HU']) assert.ok(m.includes(cc), `${s} MonsGeek ${cc}`);
    for (const cc of ['MT', 'LI']) assert.ok(!m.includes(cc), `${s} MonsGeek not ${cc}`);
  }
  assert.equal(config.tgw.convertForeignPrices, true, 'TGW: "≈ £" next to the euro prices');
  assert.equal(sources('pgw').find(x => x.retailer === 'MonsGeek').defaultSlug, 'mice-keyboards');
});

test('L144 Bazta IE and Plusshop IE: the UK rules with euros and their Irish address; Ireland only on the five older sites', () => {
  assert.equal(baztaIe.RULES.currency, 'EUR');
  assert.equal(baztaIe.RULES.advertiserId, 116033);
  assert.equal(plusshopIe.RULES.advertiserId, 29511);
  assert.ok(baztaIe.RULES.shop.test('https://ie.bazta.com/kenzo-flower'));
  assert.ok(!baztaIe.RULES.shop.test('https://bazta.com/kenzo-flower'), 'the UK shop is another retailer');
  assert.ok(plusshopIe.RULES.shop.test('https://ie.plusshop.com/x'));
  assert.equal(plusshop.RULES.currency, 'GBP', 'the UK shop stays in pounds');
  assert.ok(plusshop.RULES.shop.test('https://uk.plusshop.com/x') && plusshop.RULES.shop.test('https://plusshop.com/x'));
  assert.deepEqual(baztaIe.RULES.sites, ['wgw', 'mgw', 'hgw', 'kgw', 'ggw']);
  for (const s of ['wgw', 'mgw', 'hgw', 'kgw', 'ggw']) for (const r of ['Bazta IE', 'Plusshop IE']) assert.deepEqual(deliveryCountries(config[s], r), ['IE'], `${s} ${r}`);
  // The stale feed (not changed since 15 May 2026) is never read: its prices would get today's "Price checked" date.
  const files = plusshopIe.feedFiles('/x').map(f => f.replace(/\\/g, '/'));
  assert.ok(files.includes('/x/AWIN_29511_89816.csv.gz') && files.includes('/x/AWIN_29511_111984.csv.gz'));
  assert.ok(!files.some(f => f.includes('98493')));
});

test('L144 broken characters of the Plusshop feeds are mended; what cannot be told is left out', () => {
  const cases = [
    ['Radox Therapy Stress Relief Bath Soak â 500 ml', 'Radox Therapy Stress Relief Bath Soak – 500 ml'],
    ['Menâs Shaver', 'Men’s Shaver'], ['KâNEX Set', 'K’NEX Set'], ['LâOrÃ©al Paris', 'L’Oréal Paris'],
    ['NonâBio Liquid', 'Non-Bio Liquid'], ['Fairy 250â¯ml', 'Fairy 250 ml'], ['M2 BeautÃ©', 'M2 Beauté'],
    ['Woll Nowo Steel Frying Pan - Ã 28', 'Woll Nowo Steel Frying Pan - Ø 28'], ['Cussons 2âinâ1 Shampoo', 'Cussons 2-in-1 Shampoo'],
    ['Signal Junior 6â13 Years', 'Signal Junior 6–13 Years'], ['Tri-Fold Cover iPad Pro 12.9â³ Black', 'Tri-Fold Cover iPad Pro 12.9″ Black'],
    ['Zoflora Linen Fresh – 120 ml', 'Zoflora Linen Fresh – 120 ml']
  ];
  for (const [raw, want] of cases) assert.equal(fixMojibake(raw), want, raw);
  const col = { product_name: 'Radox Therapy Stress Relief Bath Soak â 500 ml', brand_name: 'M2 BeautÃ©' };
  assert.equal(plusshopIe.field('product_name', c => col[c] || ''), 'Radox Therapy Stress Relief Bath Soak – 500 ml');
  assert.equal(plusshopIe.field('brand_name', c => col[c] || ''), 'M2 Beauté');
  assert.deepEqual(plusshopIe.classify({ name: fixMojibake('Lattafa Ãclair Banoffi Eau de Parfum 100ml'), feedCategory: 'Eau de parfum', awinCategory: 'Women > Personal care > Fragrances || Fragrance' }),
    { reject: 'name with broken characters' });
});

test('L144 Uhrcenter: German names only where German is spoken; watches and jewellery by who they are for; children\'s pieces, straps and clocks out', () => {
  assert.deepEqual(deliveryCountries(config.wgw, 'Uhrcenter'), ['DE', 'AT', 'CH', 'LI', 'LU']);
  assert.deepEqual(deliveryCountries(config.mgw, 'Uhrcenter'), ['DE', 'AT', 'CH', 'LI', 'LU']);
  assert.equal(uc.RULES.currency, 'EUR');
  const c = (name, path) => uc.classify({ name, awinCategory: path });
  assert.deepEqual(c('Boccia 3386-02 Titan-Damenuhr Quarz mit Saphirglas 10 bar', 'Uhren>Boccia>Damenuhren'), { site: 'wgw', siteCategory: 'Watches', subcategory: 'Watches' });
  assert.deepEqual(c('Jacques Lemans 1-2197M Herren-Armbanduhr Derby Braun/Grau', 'Uhren>Jacques Lemans>Herrenuhren'), { site: 'mgw', siteCategory: 'Watches', subcategory: "Men's Watches" });
  assert.deepEqual(c('Casio MTP-1302PE-2AVEF Armbanduhr in Unisexgröße Timeless Hellblau', 'Uhren>Casio>Timeless Collection Uhren'), { site: 'mgw', siteCategory: 'Watches', subcategory: 'Unisex Watches' });
  assert.deepEqual(c('trendor 68692 Damenring 925 Silber Goldplattiert mit Zirkonia', 'Schmuck>trendor>Ringe'), { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: 'Rings' });
  assert.equal(c('Thomas Sabo TR2268-051-14 Damenring Weiße Steine Silber', 'Schmuck>Thomas Sabo>Schmuck').subcategory, 'Rings', 'the name decides when the folder does not');
  assert.equal(c('GLIZZ GL8152 Damen-Ohrringe Gold 333/8K Zirkonia Ohrstecker', 'Schmuck>GLIZZ>Ohrringe').subcategory, 'Earrings');
  assert.deepEqual(c('trendor 85864 Armband für Männer 925 Silber Massiv Panzerkette', 'Schmuck>trendor>Armbänder'), { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Bracelets' });
  assert.equal(c('trendor 35958-21 Gravur-Armband 925 Silber Namensarmband für Herren 21 cm', 'Schmuck>trendor>Gravurschmuck').subcategory, 'Bracelets');
  assert.deepEqual(c('BOSS 50413090-202 Herrengürtel Trilos Dunkelbraun', 'Accessoires>BOSS>Gürtel'), { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Belts' });
  for (const [n, p] of [['trendor 28404 Kinder-Halskette Mit Kreuz 925 Silber', 'Schmuck>trendor>Halsketten'], ['Ice-Watch 022790 Kinder-Smartwatch ICE Smart Two', 'Uhren>Ice-Watch>Smartwatches'],
    ['Tissot T852046781 Uhrenarmband 22 mm Jeans Blau', 'Uhren>Tissot>Uhrenarmbänder'], ['Atlanta 1881/12 Funkwecker im Retro-Design', 'Großuhren>Atlanta>Wecker'],
    ['S.T. Dupont 016284 Feuerzeug Linie 2 Carrée', 'Accessoires>S.T. Dupont>Feuerzeuge Linie 2']]) {
    assert.ok(c(n, p).reject, n);
  }
  assert.equal(uc.productKey(c => (c === 'merchant_deep_link' ? 'https://www.uhrcenter.de/schmuck/trendor-damenring-68692/?size=7' : '')), 'schmuck/trendor-damenring-68692');
});

test('L144 SwitchBot: pictures from the copy of the shop, its prices and stock for two days after it, pages gone from the shop out', () => {
  const row = { merchant_deep_link: 'https://eu.switch-bot.com/products/outdoor-meter-kit', currency: 'EUR', merchant_image_url: '', search_price: '94.97',
    store_price: '94.97', in_stock: '1', merchant_product_id: 'shopify_DE_8745880813733_0' };
  const col = c => row[c] ?? '';
  const night = new Date('2026-11-14T21:00:00Z');
  assert.match(sb.field('merchant_image_url', col, night), /^https:\/\/cdn\.shopify\.com\/.+\.(jpg|png|webp)$/i);
  assert.equal(sb.field('merchant_image_url', col, new Date('2026-12-30T12:00:00Z')), SHOP_IMAGES['outdoor-meter-kit'], 'the picture stays');
  // One option on the page: its price on the shop that evening (69.99), not the feed's 94.97; after two days the feed's.
  assert.equal(sb.field('search_price', col, night), '69.99');
  assert.equal(sb.field('search_price', col, new Date('2026-11-18T12:00:00Z')), '94.97');
  // A renumbered option of a sold-out page: out of stock.
  const k10 = { ...row, merchant_deep_link: 'https://eu.switch-bot.com/products/switchbot-mini-robot-vacuum-k10-pro', merchant_product_id: 'shopify_DE_8790442901669_52324911284594', search_price: '549.99' };
  assert.equal(sb.field('in_stock', c => k10[c] ?? '', night), '0');
  // The US shop and dollar rows give nothing (round 2b).
  assert.equal(sb.field('product_name', c => ({ merchant_deep_link: 'https://www.switch-bot.com/products/x', currency: 'USD', product_name: 'Hub' })[c] || ''), '');
  assert.deepEqual(SHOP_GONE, ['cleaning-combo', 'switchbot-mini-robot-vacuum-k10', 'switchbot-presence-sensor']);
  assert.match(sb.classify({ name: 'SwitchBot Presence Sensor', url: 'https://eu.switch-bot.com/products/switchbot-presence-sensor' }).reject, /not on the shop/);
  assert.equal(sb.classify({ name: 'SwitchBot Outdoor Meter Kit', url: row.merchant_deep_link }).subcategory, 'Smart Sensor');
  assert.equal(Object.keys(SHOP_IMAGES).length, 91);
});
