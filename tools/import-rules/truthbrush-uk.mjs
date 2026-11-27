// Import rules for Truthbrush (Awin advertiser 19976 "The Truthbrush", thetruthbrush.com, pounds) on Home Gear World.
// Wave 1 UK of the massive import (chat 7 sheet «Εγκρίσεις» row 902, 22-24 Nov 2026, lessons L224). Feed of 22 Nov 2026:
// 43 rows, all in stock: bamboo toothbrushes (adult and children's), electric toothbrush heads, interdental brushes, travel
// cases, glass storage jars and gift sets, plus toothpaste tablets ("Truthtabs").
//  - Toothbrushes, heads, brushes, cases, jars and the brush sets to HGW Bedding & Bath > Bathroom Accessories (the
//    bathroom subcategory the site already uses, L56).
//  - Toothpaste tablets (a consumable for the mouth, not a home product) stay out.
import { clean } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'truthbrush-uk',
  advertiserId: 19976,
  retailer: 'Truthbrush',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?thetruthbrush\.com\//i,
  sites: ['hgw'],
  maxPrice: 100,
  minPrice: 3
};

export function displayBrand() { return 'Truthbrush'; }

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/\btruthtabs\b|toothpaste|tablets?\b|gift ?card/i.test(n) && !/\bjar\b|\bset\b/i.test(n)) return { reject: 'toothpaste tablets (not a home product)' };
  if (/tooth ?brush|truthbrush|brush heads?|interdental|travel case|apothecary jar|\bjar\b|\bset\b/i.test(n)) {
    return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bathroom Accessories', name: n };
  }
  return { reject: 'not a toothbrush or a bathroom accessory' };
}
