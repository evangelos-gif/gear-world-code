// Import rules for Goally US (Awin advertiser 79880) — Priority A of «Λείπουν 25-11» (row 93), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 2 rows, the Goally learning tablet for children (8 and 10 inch).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-goally-us', advertiserId: 79880, retailer: 'Goally US', currency: 'USD',
  shop: shopOf('getgoally.com'), sites: ['kgw'], minPrice: 50, maxPrice: 800 });

export const displayName = name => noSale(name);

export function classify({ name }) {
  const n = displayName(name);
  if (!/tablet/i.test(n)) return { reject: 'not the tablet' };
  return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: 'Kids Tech', name: n };
}
