// Import rules for Lensmart (Awin advertiser 93517, lensmartonline.com, US dollars) on Women's Gear World. Wave 3
// (approvals file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 2,090 eyeglass frames named only by the
// model ("Zuri", "Kahlil"): the card says "<model> Glasses" (or sunglasses when the page says so). WGW keeps frames in
// Bags & Accessories > Eyeglasses, at most RULES.maxPerSubcategory per subcategory (lessons L164). US shop: shown only
// to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'lensmart-us',
  advertiserId: 93517,
  retailer: 'Lensmart',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?lensmartonline\.com\//i,
  sites: ['wgw'],
  maxPrice: 200,
  minPrice: 10,
  maxPerSubcategory: 300
};

export function classify({ name, url = '' }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|contact lens|solution|case\b|cloth|chain/i.test(n)) return { reject: 'gift card or accessory' };
  if (/sunglass/i.test(`${n} ${url}`)) return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses', name: /sunglass/i.test(n) ? n : `${n} Sunglasses` };
  return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Eyeglasses', name: /glasses|frame/i.test(n) ? n : `${n} Glasses` };
}
