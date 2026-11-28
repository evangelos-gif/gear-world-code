// Import rules for Profichemie.com DE (Awin advertiser 17412) — Priority A of «Λείπουν 25-11» (row 75), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24 Nov 2026: 78 rows of cleaning products and odour removers (S-Pro, BactoDes). A cleaning shop: a product no word places goes to Cleaning Products and is listed under CHECK; de-icers for cars stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEuShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEuShop({
  key: 'wa-profichemie-de', advertiserId: 17412, retailer: 'Profichemie.com DE', language: 'de',
  shop: shopOf('profichemie.com'),
  minPrice: 4, maxPrice: 150,
  fallback: ['Cleaning & Laundry', 'Cleaning Products'],
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
