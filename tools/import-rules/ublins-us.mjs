// Import rules for Ublins (Awin advertiser 60707, ublins.com, US dollars) on Women's Gear World. Wave 3 (approvals file
// of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 222 eyeglass frames ("Rhoda Oval Gray Frame"): WGW's
// Bags & Accessories > Eyeglasses. US shop: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'ublins-us',
  advertiserId: 60707,
  retailer: 'Ublins',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?ublins\.com\//i,
  sites: ['wgw'],
  maxPrice: 200,
  minPrice: 8
};

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|lens(es)? only|case\b|cloth|chain|insurance|shipping/i.test(n)) return { reject: 'gift card or accessory' };
  if (/sunglass/i.test(n)) return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Sunglasses', name: n };
  if (/frame|glasses/i.test(n)) return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Eyeglasses', name: n.replace(/\bFrame$/i, 'Glasses Frame') };
  return { reject: 'not a frame' };
}
