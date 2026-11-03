// L90: Meaco UK (Awin 31711) on Home Gear World (3 Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, displayName, RULES } from '../../tools/import-rules/meaco.mjs';

const place = (name, cat = '') => { const c = classify({ name, feedCategory: cat }); return c.reject ? 'out' : `${c.siteCategory}/${c.subcategory}${c.doubt ? ' (doubt)' : ''}`; };

test('L90: Meaco products go to Home Appliances; spares and storage bags stay out', () => {
  assert.equal(place('Meaco 12L Low Energy Dehumidifier and Air Purifier 2 in 1- Dehumidifier For Medium to Large Size Homes', 'Dehumidifiers, Air Purifiers'), 'Home Appliances/Dehumidifier');
  assert.equal(place('Meaco Portable Dehumidifier DD8L - Compact Desiccant Dehumidifier', 'Dehumidifiers'), 'Home Appliances/Dehumidifier');
  assert.equal(place('12L Low Energy HEPA Filter Pack', 'Filters, Spares'), 'Home Appliances/Dehumidifier');
  assert.equal(place('MeacoCool MC Series 10000 Air Conditioners', 'Dehumidifiers, Air Conditioner, Heater'), 'Home Appliances/Air Conditioner');
  assert.equal(place('Deluxe 202 Humidifier and Air Purifier', 'Humidifiers'), 'Home Appliances/Humidifier');
  assert.equal(place('MeacoFan 1056P Pedestal Air Circulator', 'Cooling, Fans'), 'Home Appliances/Fan');
  assert.equal(place('MeacoFan Sefte® 8" Portable Battery Air Circulator'), 'Home Appliances/Fan');
  for (const n of ['DD8L Wall Mounting Brackets', 'MeacoCool Window Plate', 'MeacoFan 260c Air Circulator Storage Bag', 'Armin® 680 Humidifier Storage Bag'])
    assert.equal(place(n), 'out', n);
});

test('L90: the card name is the part before the selling line', () => {
  assert.equal(displayName('Meaco 12L Low Energy Dehumidifier and Air Purifier 2 in 1- Dehumidifier For Medium to Large Size Homes - Controls Humidity'), 'Meaco 12L Low Energy Dehumidifier and Air Purifier 2 in 1');
  assert.equal(displayName('Meaco Portable Dehumidifier DD8L - Compact Desiccant Dehumidifier'), 'Meaco Portable Dehumidifier DD8L');
  assert.equal(displayName('MeacoFan 1056 Air Circulator'), 'MeacoFan 1056 Air Circulator');
  assert.equal(RULES.advertiserId, 31711);
  assert.ok(RULES.shop.test('https://www.meaco.com/products/meaco-dd8l-dehumidifier?variant=1&country=GB'));
});

test('L90, first dry run: the shop test products stay out, a fan sold with its bag goes in', () => {
  assert.equal(place('Dummy Sub Test (DO NOT PUBLISH PEASE), Alcohol', 'Dehumidifiers, Air Purifiers'), 'out');
  assert.equal(place('Dummy PDP Dev Test, Black / Small'), 'out');
  assert.equal(place('MeacoFan Sefte® 10" Pedestal Air Circulator with Storage Bag'), 'Home Appliances/Fan');
  assert.equal(place('MeacoFan Sefte® 6 Air Circulator Storage Bag', 'Filters, Spares'), 'out');
});
