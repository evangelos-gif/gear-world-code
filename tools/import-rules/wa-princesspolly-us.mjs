// Import rules for Princess Polly US (Rakuten Advertising MID 44648) — Priority A of «Λείπουν 25-11» (row 220), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 32,848 rows, 7,502 pages (one per style and colour) of women's fashion: dresses, tops, skirts, pants, swimwear, knitwear, shoes. The shop's folder decides the subcategory when the name does not ("Faubert Mini Dress White" is a dress, "Palladia PU Jordy Corset" a top). At most 400 cards a subcategory.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, wgwFashion } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-princesspolly-us', network: 'rakuten', advertiserId: 44648, retailer: 'Princess Polly US', currency: 'USD',
  shop: shopOf('us.princesspolly.com'), sites: ['wgw'], minPrice: 10, maxPrice: 250, maxPerSubcategory: 400 });

export const displayName = name => noSale(name);

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(`${n} | ${feedCategory}`)) return { reject: 'gift card or service' };
  if (/beauty|fragrance|candle|gift card|home|stickers?|mens\b|men'?s/i.test(feedCategory)) return { reject: "not women's fashion" };
  const p = wgwFashion(n, feedCategory);
  if (!p) return { reject: "not women's fashion the site lists" };
  return { site: 'wgw', ...p, name: n };
}
