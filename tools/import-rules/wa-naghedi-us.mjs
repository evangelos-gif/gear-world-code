// Import rules for Naghedi US (Awin advertiser 96197) — Priority A of «Λείπουν 25-11» (row 218), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24 Nov 2026: 135 rows, 32 bags of woven neoprene (totes, pouches, mini bags) in colours.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-naghedi-us', advertiserId: 96197, retailer: 'Naghedi US', currency: 'USD',
  shop: shopOf('naghedinyc.com'), sites: ['wgw'], minPrice: 20, maxPrice: 600 });

export const displayName = name => noSale(name);

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (/charms?|straps? only|cleaner|care kit/i.test(n)) return { reject: 'bag accessory' };
  return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: /wallet|card case/i.test(n) ? 'Wallets & Purses' : 'Bags', name: n };
}
