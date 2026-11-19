// Import rules for FragranceShop.com (CJ Affiliate advertiser 7287203, US dollars) on Women's Gear World (women's and
// unisex scents) and Men's Gear World (men's colognes). Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171).
// Feed of 17 Nov 2026: 6,346 rows, 3,988 pages: women's perfume (2,610), men's cologne (1,958), "type" perfume oils
// (721) and unboxed testers (573) (both left out), aftershave, unisex. Shared placing in lib/fragrance-us.mjs. At
// most RULES.maxPerSubcategory cards per subcategory (lessons L164: WGW Beauty & Fragrances has about 15,000 products
// and stays under 20,000). US shop: shown only to the US.
import { placeFragrance, withBrand } from './lib/fragrance-us.mjs';

// 19 Nov 2026 (lessons L193): no RULES.maxPerSubcategory any more, the older sites read only the cards they show.
export const RULES = {
  key: 'fragranceshop-us',
  network: 'cj',
  advertiserId: 7287203,
  retailer: 'FragranceShop.com',
  currency: 'USD',
  shop: /^https:\/\/www\.fragranceshop\.com\//i,
  sites: ['wgw', 'mgw'],
  maxPrice: 500,
  minPrice: 8
};

export function classify({ name, feedCategory = '', brand = '', url = '' }) {
  return placeFragrance(name, feedCategory, brand, url);
}

export function displayName(name) { return withBrand(name, ''); }
