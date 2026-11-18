// Night import of 18 Nov 2026 (lessons L194): Miscota on Pets Gear World (its feed gives every image as http:// on a host
// that serves the same file over https: httpsImageHosts), Oponytanio PL on Car Gear World (tyreBracket with Polish
// seasons) and refurbed NL on Technology Gear World (Dutch, the Netherlands and Belgium only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstHttpsImage, tyreBracketProduct, CAR_TYRE_CATEGORY } from '../../tools/tgw-import-plan.mjs';
import agw from '../../sites/agw/site.config.js';
import tgw from '../../sites/tgw/site.config.js';
import zgw from '../../sites/zgw/site.config.js';
import * as ZGW_RULES from '../../sites/zgw/category-rules.js';

const sources = s => JSON.parse(readFileSync(new URL(`../../sites/${s}/sources.json`, import.meta.url), 'utf8')).sources;

test('L194: an http:// image becomes https:// only on a host the shop names (httpsImageHosts)', () => {
  const map = { images: [0, 1] };
  const rec = ['', 'http://static.miscota.com/media/1/photos/products/061191/7613034453754-0-67a48326c65e2.webp'];
  assert.equal(firstHttpsImage(rec, map), '', 'without the option: no https image, as before');
  assert.equal(firstHttpsImage(rec, map, { httpsImageHosts: ['static.miscota.com'] }),
    'https://static.miscota.com/media/1/photos/products/061191/7613034453754-0-67a48326c65e2.webp');
  assert.equal(firstHttpsImage(['http://other.example.com/a.jpg'], { images: [0] }, { httpsImageHosts: ['static.miscota.com'] }), '',
    'another http host stays out');
  assert.equal(firstHttpsImage(['http://static.miscota.com/no-image.jpg'], { images: [0] }, { httpsImageHosts: ['static.miscota.com'] }), '',
    'a placeholder stays out after the rewrite');
  assert.equal(firstHttpsImage(['https://a.example.com/x.jpg'], { images: [0] }, null), 'https://a.example.com/x.jpg');
});

test('L194: Oponytanio PL car tyres in Polish seasons; motorbike tyres and inner tubes stay out', () => {
  for (const c of ['Opony letnie', 'Opony zimowe', 'Opony całoroczne']) assert.ok(CAR_TYRE_CATEGORY.test(c), c);
  for (const c of ['Opony motocyklowe', 'Dętki']) assert.ok(!CAR_TYRE_CATEGORY.test(c), c);
  assert.deepEqual(tyreBracketProduct('Kleber Dynaxer SUV ( 215/70 R16 100H osłona felgileiste (FSL) )', 'Kleber', 'Opony letnie'),
    { ok: true, name: 'Kleber Dynaxer SUV 215/70 R16 100H', brand: 'Kleber' });
  assert.equal(tyreBracketProduct('Pirelli Powergy ( 235/45 R18 98Y XL, osłona felgi (MFS) )', 'Pirelli', 'Opony zimowe').name, 'Pirelli Powergy 235/45 R18 98Y XL');
  assert.equal(tyreBracketProduct('Michelin Pilot Road 6 ( 120/70 ZR17 58W )', 'MICHELIN', 'Opony motocyklowe').ok, false);
});

test('L194: the new shops are set up and shown only where they deliver', () => {
  const z = sources('zgw');
  const uk = z.find(s => s.advertiserId === 22091), ie = z.find(s => s.advertiserId === 20805);
  assert.equal(uk.retailer, 'Miscota UK'); assert.equal(uk.currency, 'GBP'); assert.equal(uk.network, 'daisycon');
  assert.equal(ie.retailer, 'Miscota IE'); assert.equal(ie.currency, 'EUR');
  for (const s of [uk, ie]) assert.deepEqual(s.httpsImageHosts, ['static.miscota.com']);
  assert.equal(zgw.deliversTo.retailers['Miscota UK'], undefined, 'Miscota UK: the UK (the default)');
  assert.deepEqual(zgw.deliversTo.retailers['Miscota IE'], ['IE']);
  assert.ok(ZGW_RULES.QUALITY.currencies.includes('EUR'), 'ZGW reads euros');
  const op = sources('agw').find(s => s.advertiserId === 10325);
  assert.equal(op.retailer, 'Oponytanio PL'); assert.equal(op.tyreBracket, true); assert.deepEqual(op.categoryMap, { tyres: 'tyres-wheels' });
  assert.deepEqual(agw.deliversTo.retailers['Oponytanio PL'], ['PL']);
  const rf = sources('tgw').find(s => s.advertiserId === 20160);
  assert.equal(rf.retailer, 'refurbed NL'); assert.equal(rf.condition, 'refurbished'); assert.equal(rf.maxProducts, 20000);
  assert.deepEqual(rf.denyPaths, ['desktopcomputers']);
  assert.deepEqual(tgw.deliversTo.retailers['refurbed NL'], ['NL', 'BE']);
  assert.equal(tgw.deliversTo.languages['refurbed NL'], 'nl');
});
