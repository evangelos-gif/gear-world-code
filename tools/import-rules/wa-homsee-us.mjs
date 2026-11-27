// Import rules for HOMSEE US (CJ Affiliate advertiser 8027729) — Priority A of «Λείπουν 25-11» (row 58), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 358 rows, wardrobes, nightstands, cabinets, bookcases, dressers, dining sets, kitchen islands.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-homsee-us', network: 'cj', advertiserId: 8027729, retailer: 'HOMSEE US', currency: 'USD',
  shop: shopOf('homsee.com'),
  minPrice: 50, maxPrice: 4000,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
