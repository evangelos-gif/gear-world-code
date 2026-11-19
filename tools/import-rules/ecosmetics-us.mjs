// Import rules for eCosmetics (CJ Affiliate advertiser 5384937 "eCosmetics.com", ecosmetics.com, US dollars) on Women's
// Gear World and Men's Gear World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026:
// 41,506 rows, 29,560 pages with category paths ("Fragrance > Womens Fragrance > Perfume", "Makeup > Face >
// Foundation", "Hair > Shampoo & Conditioner > Shampoo"). Each path has its WGW subcategory (men's fragrance and men's
// hair care go to MGW); clothing, home, candles, wellness and hair extensions left out. At most RULES.maxPerSubcategory
// cards per subcategory, the same ones at every refresh (lessons L164): WGW Beauty & Fragrances has about 15,000
// products and must stay under 20,000. US shop: shown only to the US.
import { clean, CHARACTER, TESTER, FRAGRANCE_COPY, fragranceSub } from './lib/wave3-legacy.mjs';

// 19 Nov 2026 (lessons L193): no RULES.maxPerSubcategory any more, the older sites read only the cards they show.
export const RULES = {
  key: 'ecosmetics-us',
  network: 'cj',
  advertiserId: 5384937,
  retailer: 'eCosmetics',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?ecosmetics\.com\//i,
  sites: ['wgw', 'mgw'],
  maxPrice: 500,
  minPrice: 5
};

// [path start, site, category, subcategory]; the longest matching start wins.
const MAP = [
  ['Fragrance > Womens Fragrance', 'wgw', 'Beauty & Fragrances', null],
  ["Fragrance > Men's", 'mgw', 'Grooming & Fragrances', null],
  ['Fragrance > Gift Sets', 'wgw', 'Beauty & Fragrances', 'Gift sets'],
  ['Makeup', 'wgw', 'Beauty & Fragrances', 'Make-up'],
  ['Skincare > Gift Sets', 'wgw', 'Beauty & Fragrances', 'Gift sets'],
  ['Skincare', 'wgw', 'Beauty & Fragrances', 'Skincare'],
  ["Hair > Men's", 'mgw', 'Grooming & Fragrances', 'Hair care'],
  ['Hair > Hair Accessories', 'wgw', 'Bags & Accessories', 'Hair Accessories'],
  ['Hair > Shampoo & Conditioner', 'wgw', 'Beauty & Fragrances', 'Hair care'],
  ['Hair > Styling Products', 'wgw', 'Beauty & Fragrances', 'Hair care'],
  ['Hair > Color Care', 'wgw', 'Beauty & Fragrances', 'Hair care'],
  ['Hair > Treatments', 'wgw', 'Beauty & Fragrances', 'Hair care'],
  ['Bath & Body > Body Moisturizers', 'wgw', 'Beauty & Fragrances', 'Bath & body'],
  ['Bath & Body > Bath & Shower', 'wgw', 'Beauty & Fragrances', 'Bath & body'],
  ['Bath & Body > Hand & Foot Care', 'wgw', 'Beauty & Fragrances', 'Bath & body'],
  ['Bath & Body > Gift Sets', 'wgw', 'Beauty & Fragrances', 'Gift sets'],
  ['Nails', 'wgw', 'Beauty & Fragrances', 'Nails'],
  ['Tools & Brushes > Makeup Brushes & Tools', 'wgw', 'Beauty & Fragrances', 'Beauty tools'],
  ['Tools & Brushes > Skincare Tools', 'wgw', 'Beauty & Fragrances', 'Beauty tools'],
  ['Tools & Brushes > Hair Styling Tools', 'wgw', 'Beauty & Fragrances', 'Hair tools']
].sort((a, b) => b[0].length - a[0].length);

export function displayName(name) { return clean(name).replace(/\s*\|\s*/g, ' - '); }

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  const path = clean(feedCategory);
  if (TESTER.test(n) || /\bmini\b|travel size|deluxe sample/i.test(n)) return { reject: 'tester, sample or travel mini' };
  if (FRAGRANCE_COPY.test(n) || CHARACTER.test(n)) return { reject: "a copy of a famous scent or a children's character product" };
  const m = MAP.find(x => path === x[0] || path.startsWith(x[0] + ' >'));
  if (!m) return { reject: `eCosmetics group "${path.split(' > ').slice(0, 2).join(' > ')}" is not one our sites show` };
  const [, site, category, sub] = m;
  const fsub = sub || fragranceSub(n);
  return { site, siteCategory: category, subcategory: site === 'mgw' && fsub === 'Bath & body' ? 'Deodorant' : fsub, name: n };
}
