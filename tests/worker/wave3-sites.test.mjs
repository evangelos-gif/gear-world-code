// Wave 3 on the new-engine sites (16-17 Nov 2026, lessons L169): the Delticom tyre names, the per-shop cap and the
// currencies of the US-only shops. The first dry run (17 Nov 2026) found 0 tyres of 104,613 and rejected every US dollar
// row of TGW and PGW.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tyreBracketProduct, keyRank, CAR_TYRE_CATEGORY } from '../../tools/tgw-import-plan.mjs';

const sources = site => JSON.parse(readFileSync(new URL(`../../sites/${site}/sources.json`, import.meta.url), 'utf8')).sources;

test('L169: Delticom tyres - brand, model, size and load/speed from the name, car and van tyres only', () => {
  assert.deepEqual(tyreBracketProduct('Cooper Cobra Radial G/T ( 295/50 R15 105S RWL )', 'Cooper', 'Sommerreifen'),
    { ok: true, name: 'Cooper Cobra Radial G/T 295/50 R15 105S', brand: 'Cooper' });
  assert.equal(tyreBracketProduct('Continental IceContact 8 ( 205/60 R17 97T XL EVc, bespiked )', 'Continental', 'Winterreifen').name,
    'Continental IceContact 8 205/60 R17 97T XL');
  assert.equal(tyreBracketProduct('Nokian Hakkapeliitta C3 ( 215/65 R16C 109/107R 8PR )', 'Nokian', 'Winterbanden').name,
    'Nokian Hakkapeliitta C3 215/65 R16C 109/107R', 'a van tyre (C) with its double load index');
  assert.equal(tyreBracketProduct('Vredestein Quatrac Pro 2 ( 215/55 R17 98W XL EVc, con protector de llantaleiste (FSL) )', 'Vredestein', 'Neumáticos para todas las estaciones').ok, true);
  assert.equal(tyreBracketProduct('Michelin Pilot Road 5 ( 120/70 ZR17 58W )', 'Michelin', 'Motorradreifen').ok, false, 'motorbike category');
  assert.equal(tyreBracketProduct('Michelin Pilot Road 5 ( 120/70 ZR17 58W )', 'Michelin', 'Zomerbanden').ok, false, 'a motorbike size (width ending in 0)');
  assert.equal(tyreBracketProduct('Some Wheel RC27', 'X', 'Sommerreifen').ok, false, 'no size in brackets');
  for (const c of ['Neumáticos para camiones, especiales e industriales', 'Vrachtwagen-, speciale- en industriebanden', 'Motorbanden', '']) assert.equal(CAR_TYRE_CATEGORY.test(c), false, c);
});

test('L169: the three Delticom shops on AGW use tyreBracket, each for its own country, all their tyres since 19 Nov 2026 (L198)', async () => {
  const site = (await import('../../sites/agw/site.config.js')).default;
  const want = { 'ReifenDirekt.at': 'AT', 'neumaticos-online.es': 'ES', 'Autobandenmarkt.nl': 'NL' };
  const s = sources('agw').filter(x => x.retailer in want);
  assert.equal(s.length, 3);
  for (const x of s) {
    assert.equal(x.tyreBracket, true, x.retailer);
    assert.ok(!x.tyreNames, `${x.retailer}: not the Pneus.be network format`);
    assert.deepEqual(site.deliversTo.retailers[x.retailer], [want[x.retailer]], x.retailer);
  }
  // 19 Nov 2026 (lessons L198): no maxProducts any more, Tyres & Wheels reads only the cards it shows (L159).
  for (const x of s) assert.equal(x.maxProducts, undefined, x.retailer);
});

test('L169: the cap keeps the same products every run (stable hash of the key)', () => {
  assert.equal(keyRank('agw-11637-589863'), keyRank('agw-11637-589863'));
  assert.notEqual(keyRank('a'), keyRank('b'));
  const keys = Array.from({ length: 50 }, (_, i) => `k${i}`);
  const pick = list => [...list].sort((a, b) => keyRank(a) - keyRank(b)).slice(0, 10).join();
  assert.equal(pick(keys), pick([...keys].reverse()), 'the feed order does not change which are kept');
});

test('L169: US dollars are allowed where the US-only shops of wave 3 are, and only there', async () => {
  for (const site of ['tgw', 'pgw', 'zgw']) {
    const rules = await import(`../../sites/${site}/category-rules.js`);
    assert.ok(rules.QUALITY.currencies.includes('USD'), site);
    const config = (await import(`../../sites/${site}/site.config.js`)).default;
    assert.ok(config.foreignCurrencies.includes('USD'), `${site}: shown with the pound guide`);
    for (const x of sources(site).filter(x => x.currency === 'USD' && x.approved)) {
      assert.deepEqual(config.deliversTo.retailers[x.retailer], ['US'], `${site} ${x.retailer}: US view only`);
    }
  }
});
