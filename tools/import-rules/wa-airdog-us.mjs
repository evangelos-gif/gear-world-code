// Import rules for Silicon Valley Air Expert Inc US (Awin advertiser 54965) — Priority A of «Λείπουν 25-11» (row 83), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 82 rows of Airdog: air purifiers, their plates, filters and parts, and protection plans. Only the air purifiers are listed.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-airdog-us', advertiserId: 54965, retailer: 'Silicon Valley Air Expert Inc US', currency: 'USD',
  shop: shopOf('airdogusa.com'),
  minPrice: 50, maxPrice: 2500,
  only: W(['air purifiers?']),
  onlyWhy: 'not an air purifier (part, filter or protection plan)',
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
