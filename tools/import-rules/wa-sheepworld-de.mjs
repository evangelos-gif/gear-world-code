// Import rules for sheepworld DE (Awin advertiser 130165) — Priority A of «Λείπουν 25-11» (row 82), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 17 Nov 2026: 2,801 rows of gifts with sayings: cups, mugs, egg cups, coasters, tin signs, socks, pens, key rings. Only the home products (cups, tableware, signs); socks, pens and key rings stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEuShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEuShop({
  key: 'wa-sheepworld-de', advertiserId: 130165, retailer: 'sheepworld DE', language: 'de',
  shop: shopOf('sheepworld.de'),
  minPrice: 5, maxPrice: 100, maxPerSubcategory: 300,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
