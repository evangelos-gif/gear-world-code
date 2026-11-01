// L88: Swan & Edgar (CJ 7953236), the second CJ shop, on MGW and WGW (1 Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, RULES } from '../../tools/import-rules/swan-edgar.mjs';

const place = (name, cat = '') => { const c = classify({ name, feedCategory: cat }); return c.reject ? 'out' : `${c.site} ${c.siteCategory}/${c.subcategory}${c.doubt ? ' (doubt)' : ''}`; };

test("L88: men's, unisex and ladies' watches go to places MGW and WGW already have", () => {
  assert.equal(place('Swan & Edgar World Timer Automatic Watch - Blue'), "mgw Watches/Men's Watches");
  assert.equal(place('Horizon Dover Chronograph'), "mgw Watches/Men's Watches");
  assert.equal(place('Unisex Classic Quartz Watch'), 'mgw Watches/Unisex Watches');
  assert.equal(place("Ladies' Mother of Pearl Quartz Watch"), 'wgw Watches/Watches');
  assert.equal(place('Italian Leather Strap 20mm'), 'mgw Watches/Watches');
  assert.equal(place('Single Watch Winder - Black'), 'mgw Watches/Watches');
  assert.equal(place('The Mayfair'), "mgw Watches/Men's Watches (doubt)");
});

test('L88: services and gift cards stay out; CJ shop on swanandedgar.com', () => {
  for (const n of ['Gift Card £50', 'Engraving Service', 'Battery Replacement', 'Extended Warranty']) assert.equal(place(n), 'out', n);
  assert.equal(RULES.network, 'cj');
  assert.equal(RULES.advertiserId, 7953236);
  assert.ok(!RULES.retailer.includes('&'), 'no & in the retailer name (Invoke-Wrangler refuses it)');
  assert.ok(RULES.shop.test('https://swanandedgar.com/products/world-timer'));
});
