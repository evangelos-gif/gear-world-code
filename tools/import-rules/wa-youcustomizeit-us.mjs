// Import rules for YouCustomizeIt US (Awin advertiser 65088) — Priority A of «Λείπουν 25-11» (row 90), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 514 rows of products made with the buyer's own photo or text: duvet covers, throws, plates, tumblers, ornaments, cigar cases, patches. Only home products are listed (bedding, throws, tableware, drinkware, decor).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-youcustomizeit-us', advertiserId: 65088, retailer: 'YouCustomizeIt US', currency: 'USD',
  shop: shopOf('youcustomizeit.com'),
  minPrice: 8, maxPrice: 400,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
