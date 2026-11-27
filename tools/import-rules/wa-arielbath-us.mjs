// Import rules for ARIEL Bath US (Rakuten Advertising MID 54126) — Priority A of «Λείπουν 25-11» (row 39), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 4,365 rows, bathroom vanities with their tops, base cabinets and linen cabinets, $209 to $3,009. HGW had no bathroom furniture: a new subcategory "Bathroom Furniture" in Bedding & Bath (L56).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-arielbath-us', network: 'rakuten', advertiserId: 54126, retailer: 'ARIEL Bath US', currency: 'USD',
  shop: shopOf('arielbath.com'),
  minPrice: 50, maxPrice: 3500,
  before: [
    ['Bedding & Bath', 'Bathroom Furniture', W(['vanit(?:y|ies)', 'base cabinets?', 'linen cabinets?', 'storage cabinets?', 'countertops?', 'vanity sets?'])]
  ],
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
