// Import rules for Sachin and Babi US (Rakuten Advertising MID 52872) — Priority A of «Λείπουν 25-11» (row 223), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 2,750 rows, 515 pages of evening wear: gowns, dresses, skirts, tops, capes, shoes, earrings, bags. Names are in capitals and some end with "- FINAL SALE": the card is in title case without it (L107).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, wgwFashion } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-sachinbabi-us', network: 'rakuten', advertiserId: 52872, retailer: 'Sachin and Babi US', currency: 'USD',
  shop: shopOf('sachinandbabi.com'), sites: ['wgw'], minPrice: 30, maxPrice: 5000 });

// "MARTA MIDNIGHT BLUE FLORAL MIKADO BALL GOWN - FINAL SALE" -> "Marta Midnight Blue Floral Mikado Ball Gown".
export const displayName = name => noSale(String(name || '').toLowerCase().replace(/(^|[\s(\/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()));

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (/petticoat/i.test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Clothing', name: n };
  const p = wgwFashion(n, feedCategory);
  if (!p) return { reject: "not women's fashion the site lists" };
  return { site: 'wgw', ...p, name: n };
}
