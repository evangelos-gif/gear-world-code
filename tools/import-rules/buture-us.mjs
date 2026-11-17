// Import rules for Buture (Awin advertiser 83139, ibuture.com, US dollars) on Home Gear World. Wave 3 (approvals file of
// chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 41 products: cordless vacuums (30) and car jump starters
// (11, left out: no car site among the older ones). US plugs: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'buture-us',
  advertiserId: 83139,
  retailer: 'Buture',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?ibuture\.com\//i,
  sites: ['hgw'],
  maxPrice: 600,
  minPrice: 30
};

export function displayName(name) { return clean(name).replace(/ح/g, ', '); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/jump starter|air compressor|tyre|tire|power bank/i.test(n)) return { reject: 'car jump starter (not Home)' };
  if (/filter|battery pack|brush roll|replacement/i.test(n) && !/vacuum/i.test(n)) return { reject: 'spare part' };
  if (/vacuum/i.test(n)) return { site: 'hgw', siteCategory: 'Home Appliances', subcategory: 'Vacuum Cleaner', name: n };
  return { reject: 'not a vacuum' };
}
