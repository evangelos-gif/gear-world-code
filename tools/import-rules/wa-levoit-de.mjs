// Import rules for Levoit DE (Awin advertiser 112902) — Priority A of «Λείπουν 25-11» (row 66), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24 Nov 2026: 72 rows, humidifiers, air purifiers, cordless vacuums, their filters and adapters. Filters, adapters and decalcifying pads stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEuShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEuShop({
  key: 'wa-levoit-de', advertiserId: 112902, retailer: 'Levoit DE', language: 'de',
  shop: shopOf('levoit.de'),
  minPrice: 20, maxPrice: 800,
  notPath: /Bodycare/i, notPathWhy: 'body care appliance (not a home product of HGW)',
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
