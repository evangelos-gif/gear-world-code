// Import rules for Whirlpool USA (Rakuten Advertising MID 53707) — Priority A of «Λείπουν 25-11» (row 89), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 667 rows, refrigerators, ranges, microwaves, dryers, washers, hoods, dishwashers, wall ovens. Commercial (coin) machines, filters and parts stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-whirlpool-us', network: 'rakuten', advertiserId: 53707, retailer: 'Whirlpool USA', currency: 'USD',
  shop: shopOf('whirlpool.com'),
  minPrice: 50, maxPrice: 5000,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
