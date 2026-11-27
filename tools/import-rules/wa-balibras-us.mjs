// Import rules for Bali Bras US (Rakuten Advertising MID 46392) — Priority A of «Λείπουν 25-11» (row 200), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 4,131 rows, 95 pages of Bali bras, bralettes, panties, shapewear and sleepwear. One card a page; the name is what all its sizes and colours share (L117).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, audience, wgwFashion } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-balibras-us', network: 'rakuten', advertiserId: 46392, retailer: 'Bali Bras US', currency: 'USD',
  shop: shopOf('balibras.com'), sites: ['wgw'], minPrice: 5, maxPrice: 150, commonVariantName: true });

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
