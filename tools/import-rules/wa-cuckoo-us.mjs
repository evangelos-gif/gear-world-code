// Import rules for CUCKOO Electronics America (Awin advertiser 61971) — Priority A of «Λείπουν 25-11» (row 47), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 167 rows, rice and pressure cookers, air and water purifiers, pans, tumblers, bidets. Spare inner pots, packings and filters stay out, and so do the refurbished machines and the Canadian pages (cuckooamerica.ca).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { hgwEnShop, shopOf, W } from './lib/wave-a.mjs';

const S = hgwEnShop({
  key: 'wa-cuckoo-us', advertiserId: 61971, retailer: 'CUCKOO Electronics America', currency: 'USD',
  shop: shopOf('cuckooamerica.com'),
  minPrice: 15, maxPrice: 1500,
});
export const RULES = S.RULES;
export const displayName = S.displayName;
export const classify = S.classify;
