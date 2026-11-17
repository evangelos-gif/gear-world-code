// Import rules for Chamaripa (Awin advertiser 90789, chamaripashoes.com, US dollars) on Men's Gear World and Women's Gear
// World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 346 height-increasing
// ("elevator") shoes, boots and sneakers in leather and suede, most for men, some for women. Shown only to the US.
import { clean, audience, shoeSub } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'chamaripa-us',
  advertiserId: 90789,
  retailer: 'Chamaripa',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?chamaripashoes\.com\//i,
  sites: ['mgw', 'wgw'],
  maxPrice: 700,
  minPrice: 50
};

// "elevator boots for women - black leather women ankle boots - 6CM / 2.36 inches taller": capital first letter.
export function displayName(name) { const n = clean(name); return n.charAt(0).toUpperCase() + n.slice(1); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/insoles?|lifts? only|shoe care|polish|gift ?card|belt|socks?/i.test(n)) return { reject: 'accessory' };
  const site = audience(n) === 'women' ? 'wgw' : 'mgw';
  return { site, siteCategory: 'Shoes', subcategory: shoeSub(n, site), name: n };
}
