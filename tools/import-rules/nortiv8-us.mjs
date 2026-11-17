// Import rules for NORTIV 8 (Awin advertiser 76026 "NORTIV 8 Shoes", nortiv8.com, US dollars) on Men's Gear World,
// Women's Gear World and Kids Gear World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov
// 2026: 4,382 rows, 147 pages: running and walking shoes, work and hiking boots, snow boots, sandals, water shoes; the
// audience in the name ("Men s", "Women s", "Kids"). Shown only to the US (US sizes).
import { clean, audience, shoeSub } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'nortiv8-us',
  advertiserId: 76026,
  retailer: 'NORTIV 8',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?nortiv8\.com\//i,
  sites: ['mgw', 'wgw', 'kgw'],
  maxPrice: 200,
  minPrice: 12
};

// The feed writes "Men s" and "Women s" (the apostrophe lost).
export function displayName(name) { return clean(name).replace(/\b(Men|Women|Kid)\s+s\b/g, "$1's"); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/socks?|laces?|insoles?|gift ?card|shoe care|cleaner/i.test(n)) return { reject: 'accessory' };
  const who = audience(n);
  if (who === 'kids') {
    const sub = /snow boots?|winter boots?/i.test(n) ? 'Winter Boots' : (/sneakers?|running|trainers?/i.test(n) ? 'Trainers' : 'Shoes');
    return { site: 'kgw', siteCategory: 'Shoes', subcategory: sub, name: n };
  }
  const site = who === 'women' ? 'wgw' : (who === 'men' ? 'mgw' : null);
  if (!site) return { reject: "men's, women's or children's? (not said)" };
  return { site, siteCategory: 'Shoes', subcategory: shoeSub(n, site), name: n };
}
