// Import rules for Bruno Marc US (Awin advertiser 76024) — Priority A of «Λείπουν 25-11» (row 109), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24 Nov 2026: 7,036 rows, 303 pages of men's shoes (dress shoes, loafers, boots, sneakers) in sizes. Names start with "BRUNO MARC Men s": the card keeps the shoe ("Men's Stylish Suede Chukka Boots").
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, shoeSub } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-brunomarc-us', advertiserId: 76024, retailer: 'Bruno Marc US', currency: 'USD',
  shop: shopOf('brunomarc.com'), sites: ['mgw'], minPrice: 10, maxPrice: 300 });

export const displayName = name => noSale(String(name || '').replace(/^BRUNO MARC\s+/i, '').replace(/\b(Wo)?Men s\b/g, (m, w) => (w ? "Women's" : "Men's")));

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (/women|ladies|kids?\b|boys?\b|girls?\b/i.test(n)) return { reject: "not men's" };
  if (/insoles?|laces|shoe ?care|socks/i.test(n)) return { reject: 'shoe care or accessory' };
  return { site: 'mgw', siteCategory: 'Shoes', subcategory: shoeSub(n, 'mgw'), name: n };
}
