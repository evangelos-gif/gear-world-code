// Import rules for Kochblume DE (Awin advertiser 78872) — Priority A of «Λείπουν 25-11» (row 62), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 1,421 rows of silicone kitchen tools in colours (tongs, spatulas, lids, whisks, brushes, coasters). A kitchen shop only: a product no word places goes to Kitchen Utensil and is listed under CHECK.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEuShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEuShop({
  key: 'wa-kochblume-de', advertiserId: 78872, retailer: 'Kochblume DE', language: 'de',
  shop: shopOf('kochblume.de'),
  minPrice: 3, maxPrice: 150, maxPerSubcategory: 300,
  fallback: ['Kitchen & Dining', 'Kitchen Utensil'],
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
