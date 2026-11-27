// Import rules for COSORI DE (Awin advertiser 112896) — Priority A of «Λείπουν 25-11» (row 46), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24 Nov 2026: two feeds (31 and 28 rows) of the same kitchen appliances in German: air fryers, kettles, dehydrators, rice cookers, scales. The two feeds list the same products: one card each.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEuShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEuShop({
  key: 'wa-cosori-de', advertiserId: 112896, retailer: 'COSORI DE', language: 'de',
  shop: shopOf('cosori.de'),
  minPrice: 15, maxPrice: 600,
  joinSameNameAcrossFeeds: true,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
