// Import rules for Perfumania (CJ Affiliate advertiser 904674, US dollars) on Women's Gear World (women's and unisex
// scents) and Men's Gear World (men's colognes). Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed
// of 17 Nov 2026: 5,786 rows, 4,240 pages: eau de parfum and eau de toilette, gift sets, body sprays, some skin care
// ("Beauty"); the maker is in brand_name, not always in the name. Shared placing in lib/fragrance-us.mjs. At most
// RULES.maxPerSubcategory cards per subcategory (lessons L164: WGW Beauty & Fragrances has about 15,000 products and
// stays under 20,000). US shop: shown only to the US.
import { placeFragrance, withBrand } from './lib/fragrance-us.mjs';

export const RULES = {
  key: 'perfumania-us',
  network: 'cj',
  advertiserId: 904674,
  retailer: 'Perfumania',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?perfumania\.com\//i,
  sites: ['wgw', 'mgw'],
  maxPrice: 500,
  minPrice: 8,
  maxPerSubcategory: 250
};

export function classify({ name, feedCategory = '', brand = '', url = '' }) {
  return placeFragrance(name, feedCategory, brand, url);
}

export function displayName(name) { return withBrand(name, ''); }
