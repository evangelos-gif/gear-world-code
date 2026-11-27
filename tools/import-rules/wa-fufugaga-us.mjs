// Import rules for FUFUandGAGA US (CJ Affiliate advertiser 8004940) — Priority A of «Λείπουν 25-11» (row 54), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 1,196 rows (195 of the Canadian shop, left out), bookcases, dressers, wardrobes, vanities, TV stands, desks. Patio, pet and mailbox products stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-fufugaga-us', network: 'cj', advertiserId: 8004940, retailer: 'FUFUandGAGA US', currency: 'USD',
  shop: shopOf('fufugaga.com'),
  minPrice: 30, maxPrice: 2500,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
