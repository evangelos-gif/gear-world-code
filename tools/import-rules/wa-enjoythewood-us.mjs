// Import rules for Enjoy The Wood US (Awin advertiser 80363) — Priority A of «Λείπουν 25-11» (row 51), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 25 rows, wooden world maps for the wall in several sizes.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-enjoythewood-us', advertiserId: 80363, retailer: 'Enjoy The Wood US', currency: 'USD',
  shop: shopOf('enjoythewood.com'),
  minPrice: 20, maxPrice: 600,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
