// Import rules for Mint Outdoor (Awin advertiser 114094) on Garden Gear World.
// Mint Outdoor sells only garden furniture (rattan and aluminium sets, sofas, dining sets, covers). It is new on every
// site, so this is a normal plan (not add-only): a later refresh hides Mint Outdoor products gone from the feed.
// Feed facts (gw-feed-gaps 23 Oct 2026): 253 rows, one row per product option, all "Sheds & Garden Furniture",
// no currency column (the Awin programme is in GBP), names like "Palma Grey Corner Rattan Casual Garden Dining and
// Lounge Set 9 Seater" and "Wren 5 Seater Aluminium Corner Sofa Set With Concrete Table" (£3,999).
// The product id is the feed's merchant_product_id (the shop's variant number), like the Hub router's other shops.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
import { gardenPlace, GARDEN_CATEGORIES, NOT_GARDEN, FURNITURE_PIECE, furnitureSub } from './lib/garden.mjs';

export const RULES = {
  key: 'mintoutdoor',
  advertiserId: 114094,
  retailer: 'Mint Outdoor',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?mint-outdoor\.com\//i,
  sites: ['ggw'],
  maxPrice: 8000,
  keepQuery: true
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name }) {
  const n = String(name || '');
  if (NOT_GARDEN.test(n)) return { reject: 'not a garden product (toy, kitchen, indoor or other)' };
  const place = gardenPlace(n, '');
  if (place && place.siteCategory !== GARDEN_CATEGORIES.furniture && place.siteCategory !== GARDEN_CATEGORIES.plants) return { site: 'ggw', ...place };
  if (place || FURNITURE_PIECE.test(n)) return { site: 'ggw', siteCategory: GARDEN_CATEGORIES.furniture, subcategory: furnitureSub(n) };
  return { reject: 'name is not a garden furniture piece or set' };
}
