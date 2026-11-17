// Import rules for COOFANDY (CJ Affiliate advertiser 7636568, coofandy.com, US dollars) on Men's Gear World. Wave 3
// (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 5,564 rows (one per colour and size), 160
// pages of men's casual and smart clothing: shirts, sweaters, vests, T-shirts, blazers, trousers. Names end with "(US
// Only), <colour> / <size>": the card stops before them and takes the words all options share (lessons L117).
// Shown only to the US.
import { clean, menClothSub } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'coofandy-us',
  network: 'cj',
  advertiserId: 7636568,
  retailer: 'COOFANDY',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?coofandy\.com\//i,
  sites: ['mgw'],
  maxPrice: 200,
  minPrice: 8,
  commonVariantName: true
};

export function displayName(name) { return clean(name).replace(/\s*\(US Only\).*$/i, '').replace(/,\s*[^,]*\/[^,]*$/, '').trim(); }

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/women|ladies|kids?\b/i.test(n)) return { reject: "not men's" };
  if (/swim briefs?|thong|harness|costume/i.test(n)) return { reject: 'swimwear briefs or costume' };
  const sub = menClothSub(`${n} ${/vest/i.test(feedCategory) ? 'vest' : ''}`, null);
  if (!sub) return { reject: 'not clothing the site lists' };
  return { site: 'mgw', siteCategory: 'Clothing', subcategory: sub, name: n };
}
