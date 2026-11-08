// New Awin feeds of 8 Nov 2026 (owner: "feed download and import, all in one go"): Simply LED -> HGW Lighting and GGW
// outdoor lighting, Silver Cloud Beauty and Al Jazeera Perfumes -> WGW Beauty & Fragrances. Names are from the
// feed-profile report of 8 Nov 2026. 4x4 Predator (AGW) and AKKO (TGW, PGW) are new sources of the new-engine sites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as led from '../../tools/import-rules/simplyled.mjs';
import * as silver from '../../tools/import-rules/silvercloud.mjs';
import * as jaz from '../../tools/import-rules/aljazeera.mjs';

const GGW_LIGHT = 'Outdoor Lighting & Garden Electrical';

test('Simply LED: bulbs and indoor fittings to HGW in its own subcategories, outdoor lights to GGW, parts and trade fittings out', () => {
  const c = (name, feedCategory = 'Home & Garden > Lighting') => led.classify({ name, feedCategory });
  const hgw = [
    ['Crompton GU10 Spotlight LED Light Bulb 5W (50W Eqv) Warm White Clear Halogen Replacement High Performance', 'Light Bulb'],
    ['5-Pack Crompton Candle LED Light Bulbs B22 2.2W (25W Eqv) Warm White Pearl Filament Bayonet Frosted', 'Light Bulb'],
    ['Opus Golfball LED Light Bulb B22 4W Green Round Bayonet Coloured', 'Light Bulb'],
    ['Firstlight Phoenix 2-Light Flush Ceiling Light Contemporary Style in Cream', 'Ceiling Light'],
    ['Firstlight 450mm LED Picture/Mirror Wall Light 8W Contemporary Style Warm White in Brushed Steel', 'Wall Light'],
    ['Firstlight Fusion Pendant Light in Black', 'Pendant Light'],
    ['Spa Pyxis LED Bathroom Ceiling Light IP44 Chrome', 'Ceiling Light']
  ];
  for (const [name, sub] of hgw) assert.deepEqual(c(name), { site: 'hgw', siteCategory: 'Lighting', subcategory: sub }, name);
  const ggw = [
    ['Zink HELIX Up and Down Wall Light in Black Outdoor Lights Exterior Front Door', 'Wall lights'],
    ['Crompton GLS LED Light Bulb B22 1.5W IP65 Amber Bayonet Coloured Garden Festoon', 'String & festoon lights'],
    ['Zink LED Ground Light Stainless Steel IP67', 'Path & spike lights'],
    ['Stanley 20W LED Floodlight with PIR Sensor', 'Floodlights & security lights']
  ];
  for (const [name, sub] of ggw) assert.deepEqual(c(name), { site: 'ggw', siteCategory: GGW_LIGHT, subcategory: sub }, name);
  assert.deepEqual(c('Zink LED Spike Light', 'Home & Garden > Lighting > Landscape Pathway Lighting').site, 'ggw');
  for (const name of ['LED Driver 12V 30W Constant Voltage', 'Emergency LED Bulkhead Maintained 3hr', '150W LED High Bay UFO Light', 'Christmas Star Light'])
    assert.ok(c(name).reject, name);
  assert.ok(c('Round LED Bathroom Mirror 600mm', 'Home & Garden > Decor > Mirrors').reject, 'a mirror is not a light');
  assert.ok(led.RULES.shop.test('https://www.simplyled.co.uk/products/x') && !led.RULES.shop.test('https://www.amazon.co.uk/x'));
});

test('Silver Cloud Beauty: pillowcases and masks are beauty tools, sets are gift sets; "My Store" shows as Silver Cloud', () => {
  const c = name => silver.classify({ name });
  assert.deepEqual(c('White Satin Pillowcase infused with Silver Ions'), { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Beauty tools' });
  assert.equal(c('Heart Print Satin Pillowcase & Sleep Mask Gift Set With Silver Ions').subcategory, 'Gift sets');
  assert.equal(c('Silver Sleep Mask').subcategory, 'Beauty tools');
  assert.ok(c('Silver Cloud e-Gift Card').reject);
  assert.equal(silver.displayBrand('My Store'), 'Silver Cloud');
  assert.equal(silver.displayBrand('Silver Cloud'), 'Silver Cloud');
  // The two feeds list the same products: one key per product page.
  const get = k => ({ merchant_deep_link: 'https://silvercloudbeauty.com/products/white-satin-pillowcase', merchant_product_id: '123' })[k];
  assert.equal(silver.productKey(get), 'products/white-satin-pillowcase');
});

test('Al Jazeera Perfumes: scent-only names get the brand, in normal case; samples and gift cards out', () => {
  const c = (name, brand) => jaz.classify({ name, brand });
  assert.deepEqual(c('LOS ANGELES', 'ALJAZEERA PERFUMES'), { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Fragrance', name: 'Al Jazeera Perfumes Los Angeles' });
  assert.equal(c('AMBER OUD', 'ORYX PERFUMES').name, 'Oryx Perfumes Amber Oud');
  assert.equal(c('ROSE OF THE DESERT', 'LUXURY COLLECTION').name, 'Luxury Collection Rose of the Desert');
  assert.equal(c('Al Jazeera Perfumes Discovery Set', 'ALJAZEERA PERFUMES').subcategory, 'Gift sets');
  assert.equal(c('Al Jazeera Perfumes Discovery Set', 'ALJAZEERA PERFUMES').name, 'Al Jazeera Perfumes Discovery Set');
  for (const n of ['Perfume Samples', 'Gift Card £50']) assert.ok(c(n, 'ALJAZEERA PERFUMES').reject, n);
});

test('new-engine sources: 4x4 Predator on Car Gear World, AKKO on Technology and Gaming Gear World', () => {
  const src = site => { const d = JSON.parse(readFileSync(`sites/${site}/sources.json`, 'utf8').replace(/^﻿/, '')); return d.sources || d; };
  const has = (site, adv, feed, retailer) => src(site).some(s => s.advertiserId === adv && (s.feedIds || []).includes(feed) && s.retailer === retailer && s.approved === true && s.currency === 'GBP');
  assert.ok(has('agw', 104931, 104075, '4x4 Predator'));
  assert.ok(has('tgw', 69178, 94438, 'AKKO'));
  assert.ok(has('pgw', 69178, 94438, 'AKKO'));
});
