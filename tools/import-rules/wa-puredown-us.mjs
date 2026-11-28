// Import rules for Puredown.Inc US (Awin advertiser 91133) — Priority A of «Λείπουν 25-11» (row 77), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 8 rows, one down blanket in 8 sizes and colours.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-puredown-us', advertiserId: 91133, retailer: 'Puredown.Inc US', currency: 'USD',
  shop: shopOf('puredown.com'),
  minPrice: 20, maxPrice: 500,
  cut: /^PUREDOWN\s+/i,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
