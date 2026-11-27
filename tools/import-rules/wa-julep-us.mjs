// Import rules for Julep US (Rakuten Advertising MID 45313) — Priority A of «Λείπουν 25-11» (row 213), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 257 rows, 60 pages of Julep make-up (eyeshadow sticks, eyeliners, lip crayons, blush, brow), tools and bundles. Test rows, upsells, gift cards and order protection stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-julep-us', network: 'rakuten', advertiserId: 45313, retailer: 'Julep US', currency: 'USD',
  shop: shopOf('julep.com'), sites: ['wgw'], minPrice: 5, maxPrice: 150 });

export const displayName = name => noSale(name);

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(`${n} | ${feedCategory}`) || /^(?:test|upsell)$/i.test(feedCategory)) return { reject: 'test row, upsell, gift card or protection' };
  const at = sub => ({ site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub, name: n });
  if (/bundle|set\b|kit\b|duo|trio|collection/i.test(`${n} | ${feedCategory}`)) return at('Gift sets');
  if (/nail|polish|manicure/i.test(n)) return at('Nails');
  if (/roller|sharpener|brush|sponge|applicator|tool/i.test(n)) return at('Beauty tools');
  if (/serum|cream|moistur|cleanser|mask|oil|spf|treatment|primer/i.test(`${n} | ${feedCategory}`) && !/lip|eye/i.test(feedCategory)) return at('Skincare');
  return at('Make-up');
}
