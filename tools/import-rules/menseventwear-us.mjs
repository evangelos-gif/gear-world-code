// Import rules for Menseventwear (Awin advertiser 56383 "menseventwear", menseventwear.com, US dollars) on Men's Gear
// World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 1,861 rows (one per size and
// colour), 490 pages: two- and three-piece suits and tuxedos, blazers, waistcoats, coats, trousers. The card takes the
// words all options share (no size or colour, lessons L117). Shown only to the US.
import { clean, menClothSub } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'menseventwear-us',
  advertiserId: 56383,
  retailer: 'Menseventwear',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?menseventwear\.com\//i,
  sites: ['mgw'],
  maxPrice: 400,
  minPrice: 20,
  commonVariantName: true
};

// "Formal Men's Regular Linen Notch Lapel Blazer for Weddings - 3XL / Brown": the option after " - " is not the name.
export function displayName(name) { return clean(name).replace(/\s+-\s+[^-]*\/[^-]*$/, '').replace(/^Menseventwear\s+/i, ''); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/\bwomen|ladies|kids?\b|boys?\b/i.test(n)) return { reject: "not men's adult" };
  if (/tie\b|bow tie|pocket square|cufflinks?|lapel pin|brooch|suspenders?/i.test(n)) return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Ties', name: n };
  // "3 Pieces Mens Suit ... (Blazer+Vest+Pants)" is a suit, though the brackets name a blazer and trousers.
  const head = n.replace(/\(.*?\)/g, ' ');
  const sub = /\bsuits?\b|tuxedos?/i.test(head) ? 'Suits' : menClothSub(head, null);
  if (!sub) return { reject: 'not clothing the site lists' };
  return { site: 'mgw', siteCategory: 'Clothing', subcategory: sub, name: n };
}
