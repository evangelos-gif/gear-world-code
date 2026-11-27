// Import rules for 1-800Lighting US (Rakuten Advertising MID 47259) — Priority A of «Λείπουν 25-11» (row 38), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 380,467 rows, one page each (lighting fixtures, lamps, ceiling fans, mirrors), $15 to $9,999. Names end with the model number and the style ("... - 623P16-MGLD - Industrial"): the card stops before them. A huge catalogue: at most 250 cards a subcategory. Outdoor lights stay out (Garden Gear World).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-1800lighting-us', network: 'rakuten', advertiserId: 47259, retailer: '1-800Lighting US', currency: 'USD',
  shop: shopOf('1800lighting.com'),
  minPrice: 20, maxPrice: 3000, maxPerSubcategory: 250,
  cut: /\s+-\s+\S*\d\S*\s+-\s+[A-Za-z ,&-]+$/,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
