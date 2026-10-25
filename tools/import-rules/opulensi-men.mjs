// Import rules for Opulensi Perfumes (Lattafa, Sapil, Anfar; Awin advertiser 123248) on Men's Gear World.
// Men's and unisex fragrances go to MGW "Grooming & Fragrances" (unisex ones are also on WGW, with opulensi.mjs).
// Opulensi is ALREADY on MGW (44 products, Hub import router, retailer 'Opulensi Perfumes Lattafa Sapil Anfar',
// awin_product_id '123248:<merchant_product_id>'), so this plan is add-only with keepCategory, like opulensi.mjs:
// a product already on MGW is updated, never added twice, and keeps its category; nothing else is hidden.
// Perfumes that name no gender go to WGW only (the same rule as Joybuy), unless the line is a known men's line.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
import { CJK } from './joybuy.mjs';
import { isWornScent, genderOf, headOf, GIFT, BODY } from './opulensi.mjs';

export const RULES = {
  key: 'opulensi-men',
  advertiserId: 123248,
  retailer: 'Opulensi Perfumes Lattafa Sapil Anfar',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?opulensi\.com\//i,
  sites: ['mgw'],
  maxPrice: 500,
  addOnly: true,
  keepQuery: true,
  keepCategory: true
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  if (CJK.test(n)) return { reject: 'name not in English' };
  if (!isWornScent(n, feedCategory)) return { reject: 'not a perfume or body scent (wallets, bags, incense and others are not in this plan)' };
  const g = genderOf(n);
  if (g === 'women') return { reject: "women's fragrance (Women's Gear World, opulensi)" };
  if (g === 'none') return { reject: 'no gender in the name (Women\'s Gear World only, opulensi)' };
  // Everything here is a scent: "Al Rehab Clever Man 6ml Roll-On Oil" and "Ajmal Sacrifice For Him II Eau De Perfum" are fragrances.
  const subcategory = GIFT.test(n) ? 'Gift sets' : BODY.test(headOf(n)) ? 'Deodorant' : 'Fragrance';
  return { site: 'mgw', siteCategory: 'Grooming & Fragrances', subcategory };
}
