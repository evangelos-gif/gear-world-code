// Import rules for Destira (CJ Affiliate advertiser 6153681, destira.com, US dollars) on Kids Gear World. Wave 3
// (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 342 products of girls' gymnastics and
// dance wear: leotards, unitards, shorts, tanks, leggings; doll-size leotards and accessories left out. KGW keeps them
// in Clothing > Dancewear. Shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'destira-us',
  network: 'cj',
  advertiserId: 6153681,
  retailer: 'Destira',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?destira\.com\//i,
  sites: ['kgw'],
  maxPrice: 150,
  minPrice: 8
};

export function classify({ name, feedCategory = '' }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/doll size|doll-size|for dolls?/i.test(n) || /doll/i.test(feedCategory)) return { reject: 'doll-size clothes' };
  if (/gift ?card|bag\b|backpack|scrunchie|hair|bow\b|water bottle|grips?|sticker/i.test(n) || /^Accessories$/i.test(feedCategory)) return { reject: 'accessory' };
  if (/leotard|unitard|biketard|shorts?|tank|leggings|tights|skirt|crop top|sports bra|top\b/i.test(`${n} ${feedCategory}`)) {
    return { site: 'kgw', siteCategory: 'Clothing', subcategory: 'Dancewear', name: /leotard|unitard|shorts?|tank|leggings|top/i.test(n) ? n : `${n} Leotard` };
  }
  return { reject: 'not dance or gym wear' };
}
