// Import rules for HOMELEADER INC US (Awin advertiser 113628) — Priority A of «Λείπουν 25-11» (row 57), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 767 rows of the AECOJOY brand: sofas, recliners, bar sets, cabinets, and many patio and garden products. Names start with the brand "AECOJOY": the card name stops after it. Patio, garden, awning, coop and pet products stay out (Garden Gear World).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-homeleader-us', advertiserId: 113628, retailer: 'HOMELEADER INC US', currency: 'USD',
  shop: shopOf('aecojoy.store'),
  minPrice: 20, maxPrice: 3000,
  cut: /^AECOJOY\s+/i,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
