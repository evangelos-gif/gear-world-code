// Daisycon Wave 3 (chat 9, 17 Nov 2026): the rules of the shops chosen from the profile of 96 feeds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeOf, SHOPS } from '../../tools/import-rules/lib/westwing.mjs';
import * as wwNl from '../../tools/import-rules/westwing-nl.mjs';
import * as wwEs from '../../tools/import-rules/westwing-es.mjs';
import config from '../../sites/hgw/site.config.js';

test('Westwing: the place on HGW comes from the English category path, never from the Dutch/German/... name', () => {
  const at = c => { const p = placeOf(c); return p ? `${p.siteCategory} > ${p.subcategory}` : null; };
  assert.equal(at('Sofas'), 'Furniture > Sofa');
  assert.equal(at('Sofa Accessories|Sectional Sofa Units'), 'Furniture > Sofa');
  assert.equal(at('Decor|Rugs'), 'Home Decor > Rug');
  assert.equal(at('Decor|Throw Pillows'), 'Home Decor > Cushion', 'a throw pillow is a cushion, not a bed pillow');
  assert.equal(at('Beds & Accessories|Beds & Bed Frames'), 'Furniture > Bed Frame');
  assert.equal(at('Linens & Bedding|Bedding|Duvet Covers'), 'Bedding & Bath > Duvet');
  assert.equal(at('Linens & Bedding|Bedding|Bed Sheets'), 'Bedding & Bath > Bed Linen');
  assert.equal(at('Linens & Bedding|Bedding|Pillowcases & Shams'), 'Bedding & Bath > Pillow');
  assert.equal(at('Linens & Bedding|Towels'), 'Bedding & Bath > Towel');
  assert.equal(at('Lighting|Lamps'), 'Lighting > Table Lamp');
  assert.equal(at('Lighting|Lighting Fixtures|Ceiling Light Fixtures'), 'Lighting > Ceiling Light');
  assert.equal(at('Chairs'), 'Furniture > Dining Chair');
  assert.equal(at('Decor|Seasonal & Holiday Decorations'), 'Home Decor > Christmas');
  assert.equal(at('Apparel & Accessories|Jewelry'), null, 'jewellery is not a home product');
  assert.equal(at('Food, Beverages & Tobacco|Food Items'), null);
  assert.equal(at('Kitchen & Dining|Tableware|Dinnerware'), null, 'not sure: left out');
});

test('Westwing: one rules file per country, Daisycon links, the shop page of that country only', () => {
  assert.equal(wwNl.RULES.advertiserId, 17294);
  assert.equal(wwNl.RULES.network, 'daisycon');
  assert.equal(wwNl.RULES.retailer, 'Westwing NL');
  assert.ok(wwNl.RULES.shop.test('https://www.westwing.nl/loungefauteuil-steve-123.html'));
  assert.ok(!wwNl.RULES.shop.test('https://www.westwing.de/x.html'));
  assert.equal(wwEs.RULES.advertiserId, 20708);
  assert.deepEqual(wwNl.classify({ name: 'Bank Stella (3-zits)', feedCategory: 'Sofas', awinCategory: 'Furniture' }),
    { site: 'hgw', siteCategory: 'Furniture', subcategory: 'Sofa', name: 'Bank Stella (3-zits)' });
  assert.ok(wwNl.classify({ name: 'Vergulde armband Jeanne', feedCategory: 'Jewelry', awinCategory: 'Apparel & Accessories' }).reject);
});

test('Westwing: each country shop is seen only in its own country and language (L165)', () => {
  const d = config.deliversTo;
  for (const [code, s] of Object.entries(SHOPS)) {
    assert.deepEqual(d.retailers[`Westwing ${s.country}`], [s.country], code);
    assert.equal(d.languages[`Westwing ${s.country}`], s.language, code);
  }
});
