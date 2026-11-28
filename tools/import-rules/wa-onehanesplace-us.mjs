// Import rules for onehanesplace.com US (Rakuten Advertising MID 2856) — Priority A of «Λείπουν 25-11» (row 219), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 13,478 rows, 561 pages of Hanes, Bali, Maidenform and Playtex for women (and some for men and children, left out). One card a page; the name is what all its sizes and colours share (L117).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, audience, wgwFashion } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-onehanesplace-us', network: 'rakuten', advertiserId: 2856, retailer: 'onehanesplace.com US', currency: 'USD',
  shop: shopOf('onehanesplace.com'), sites: ['wgw'], minPrice: 5, maxPrice: 150, commonVariantName: true });

export const displayName = name => noSale(String(name || '').replace(/\s+Women'?s$/i, ''));

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  const who = audience(name);
  if (who === 'men' || who === 'kids') return { reject: "not women's" };
  const p = wgwFashion(n, feedCategory);
  if (!p) return { reject: "not women's clothing the site lists" };
  return { site: 'wgw', ...p, name: n };
}
