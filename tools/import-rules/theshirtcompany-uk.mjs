// Import rules for The Shirt Company (Awin advertiser 115010, theshirtcompany.com, pounds) on Women's Gear World. Wave 3
// (approvals file of chat 7, 16 Nov 2026, lessons L170; suggested for Men's, but the feed of 17 Nov 2026 is women's
// shirts, blouses and shirt dresses: 627 rows, 98 pages, plus bow ties, collars and sleeve bands). UK shop: the site's
// default (GB).
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'theshirtcompany-uk',
  advertiserId: 115010,
  retailer: 'The Shirt Company',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?theshirtcompany\.com\//i,
  sites: ['wgw'],
  maxPrice: 400,
  minPrice: 15
};

// "CATALINA SHIRT - THE TAILORED - White, Cotton Poplin" -> "Catalina Shirt - The Tailored - White, Cotton Poplin".
export function displayName(name) {
  return clean(name).replace(/\b([A-Z])([A-Z']+)\b/g, (m, a, b) => a + b.toLowerCase());
}

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|collar\b|sleeve bands?|cufflinks?|stays\b/i.test(n)) return { reject: 'gift card or small accessory' };
  if (/bow ?tie|\btie\b/i.test(n)) return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Ties', name: n };
  if (/dress/i.test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Dresses', name: n };
  if (/shirt|blouse|top\b/i.test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Tops & Blouses', name: n };
  if (/trousers|pants/i.test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Trousers', name: n };
  if (/skirt/i.test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Skirts', name: n };
  if (/jacket|blazer|coat/i.test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Jackets & Coats', name: n };
  return { reject: 'not clothing the site lists' };
}
