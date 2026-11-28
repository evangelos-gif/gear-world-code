// Import rules for Caudalie USA (Rakuten Advertising MID 49183) — Priority A of «Λείπουν 25-11» (row 205), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 93 rows of Caudalie skincare, hair care, fragrances and sets (us.caudalie.com, dollars).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-caudalie-us', network: 'rakuten', advertiserId: 49183, retailer: 'Caudalie USA', currency: 'USD',
  shop: shopOf('us.caudalie.com'), sites: ['wgw'], minPrice: 8, maxPrice: 300 });

export const displayName = name => noSale(name);

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n) || /sample|tester/i.test(n)) return { reject: 'gift card, service or sample' };
  const at = sub => ({ site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub, name: n });
  if (/\b(?:duo|trio|set|kit|gift|collection|routine)\b/i.test(n)) return at('Gift sets');
  if (/fragrance|eau de|parfum|perfume/i.test(n)) return at('Fragrance');
  if (/shampoo|conditioner|hair/i.test(n)) return at('Hair care');
  if (/shower|body|hand cream|bath/i.test(n)) return at('Bath & body');
  return at('Skincare');
}
