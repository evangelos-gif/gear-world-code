// Import rules for Matten Welt DE (Awin advertiser 22158) — Priority A of «Λείπουν 25-11» (row 69), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24 Nov 2026: 90,111 rows, 5,456 pages of doormats (one page per design, its sizes are options), German names. Doormats are rugs of HGW; at most 300 designs, chosen by the product id (the same ones at every refresh, L164).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEuShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEuShop({
  key: 'wa-mattenwelt-de', advertiserId: 22158, retailer: 'Matten Welt DE', language: 'de',
  shop: shopOf('matten-welt.com'),
  minPrice: 15, maxPrice: 400, maxPerSubcategory: 300,
  notPath: /Gutschein|Serviceleistung/i, notPathWhy: 'voucher or service',
  fallback: ['Home Decor', 'Rug'],
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
