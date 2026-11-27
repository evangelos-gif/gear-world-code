// Import rules for ECKO UNLTD US (Rakuten Advertising MID 50006) — Priority A of «Λείπουν 25-11» (row 111), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 1,007 rows, 211 pages of men's streetwear: T-shirts, hoodies, joggers, cargo pants, jerseys, gloves.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, mgwFashion } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-ecko-us', network: 'rakuten', advertiserId: 50006, retailer: 'ECKO UNLTD US', currency: 'USD',
  shop: shopOf('ecko.com'), sites: ['mgw'], minPrice: 10, maxPrice: 300 });

export const displayName = name => noSale(name);

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (/women|ladies|\bkids?\b|boys?\b|girls?\b/i.test(`${n} ${feedCategory}`)) return { reject: "not men's" };
  const p = mgwFashion(n, feedCategory);
  if (!p) return { reject: "not men's clothing the site lists" };
  return { site: 'mgw', ...p, name: n };
}
