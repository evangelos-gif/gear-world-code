// Import rules for House of Lamps US (Awin advertiser 130277) — Priority A of «Λείπουν 25-11» (row 59), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 476 rows, pendant, wall, ceiling, table and floor lights, ceiling fans, bulbs. Outdoor, path and pillar lights stay out (Garden Gear World).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-houseoflamps-us', advertiserId: 130277, retailer: 'House of Lamps US', currency: 'USD',
  shop: shopOf('houseoflamps.com'),
  minPrice: 8, maxPrice: 4000,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
