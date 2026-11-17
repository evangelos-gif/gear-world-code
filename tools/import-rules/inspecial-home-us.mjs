// Import rules for INSPECIAL HOME (Awin advertiser 84569, inspecialhome.com, US dollars) on Home Gear World. Wave 3
// (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 725 rows, 274 pages, no categories;
// whimsical vases, mugs, trays, cushions, bathrobes, a few lamps. US shop: shown only to the US (deliversTo ['US']).
import { homePlace, homeName, notHome } from './lib/hgw-home.mjs';
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'inspecial-home-us',
  advertiserId: 84569,
  retailer: 'INSPECIAL HOME',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?inspecialhome\.com\//i,
  sites: ['hgw'],
  maxPrice: 1000,
  minPrice: 8
};

export function displayName(name) { return homeName(clean(name).replace(/\s*\(\s*\$[\d.]+\s*each\s*[)）]/i, '')); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|shipping|insurance|warranty/i.test(n)) return { reject: 'gift card or service' };
  if (/\bmugs?\b|\bcups?\b|tumblers?/i.test(n)) return { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: 'Drinkware', name: n };
  if (/\bplates?\b|\bfruit bowls?\b|\bdishes\b|\bplatters?\b|\bsalad bowls?\b/i.test(n)) return { site: 'hgw', siteCategory: 'Kitchen & Dining', subcategory: 'Tableware', name: n };
  if (/bathrobes?|\brobes?\b/i.test(n)) return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bathrobe', name: n };
  if (/brush(es)? holders?|toothbrush|soap dish/i.test(n)) return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bathroom Accessories', name: n };
  if (/pillow ?case|throw pillow|pillow cover/i.test(n)) return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Cushion', name: n };
  if (notHome(n)) return { reject: 'not a home product' };
  const p = homePlace(n);
  if (!p) return { reject: 'no home place for this name' };
  return { site: 'hgw', ...p, name: n };
}
