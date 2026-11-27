// Import rules for Sebastian Cruz Couture US (Awin advertiser 88999) — Priority A of «Λείπουν 25-11» (row 116), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24 Nov 2026: 12,248 rows, 680 pages of men's couture: loafers and lace-ups, dress shirts, trousers, suits, ties, pocket squares. The feed's links are on the shop's Shopify address (sebastiancruz-pxs.myshopify.com).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, mgwFashion } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-sebastiancruz-us', advertiserId: 88999, retailer: 'Sebastian Cruz Couture US', currency: 'USD',
  shop: shopOf('sebastiancruz-pxs.myshopify.com', 'sebastiancruzcouture.com'), sites: ['mgw'], minPrice: 20, maxPrice: 2500 });

export const displayName = name => noSale(name);

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (/women|ladies/i.test(n)) return { reject: "not men's" };
  const p = mgwFashion(n);
  if (!p) return { reject: "not men's clothing the site lists" };
  return { site: 'mgw', ...p, name: n };
}
