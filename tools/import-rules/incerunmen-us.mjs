// Import rules for Incerunmen (Awin advertiser 70534, incerunmen.com, US dollars) on Men's Gear World. Wave 3 (approvals
// file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: two feeds, 45,843 rows in dollars and 7,377 in euros
// (the same pages; the euro rows are left out by the currency check), 3,785 pages of men's fashion: shirts, tanks,
// T-shirts, knitwear, two-piece outfits, trousers, shorts. Names end with the shop code and the option ("... SKUL10706 -
// Apricot / S"): the card stops before them. Swimwear briefs, harnesses and sheer underwear left out. At most
// RULES.maxPerSubcategory cards per subcategory (lessons L164). Shown only to the US.
import { clean, menClothSub } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'incerunmen-us',
  advertiserId: 70534,
  retailer: 'Incerunmen',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?incerunmen\.com\//i,
  sites: ['mgw'],
  maxPrice: 150,
  minPrice: 8,
  maxPerSubcategory: 150
};

export function displayName(name) { return clean(name).replace(/\s+SKU[A-Z]?\d{3,}.*$/i, '').replace(/^Mens\b/, "Men's").trim(); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/harness|jockstrap|thong|g-?string|lingerie|briefs?|bikini|sheer|see-?through|mesh underwear|fetish|bondage|costume/i.test(n)) return { reject: 'underwear, swim briefs or costume (left out)' };
  if (/two pieces? outfit|2 pieces? outfit|set\b|suit set/i.test(n)) return { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Clothing', name: n };
  const sub = menClothSub(n, null);
  if (!sub) return { reject: 'not clothing the site lists' };
  return { site: 'mgw', siteCategory: 'Clothing', subcategory: sub, name: n };
}
