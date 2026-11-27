// Import rules for Tushbaby US (Rakuten Advertising MID 53904) — Priority A of «Λείπουν 25-11» (row 105), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 628 rows, 60 pages: hip seat carriers, slings, blankets, teethers, playpens, and personalisation, gift cards, protection. Personalisation, gift cards, package protection, pet and adult bags stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-tushbaby-us', network: 'rakuten', advertiserId: 53904, retailer: 'Tushbaby US', currency: 'USD',
  shop: shopOf('tushbaby.com'), sites: ['kgw'], minPrice: 8, maxPrice: 400 });

export const displayName = name => noSale(name);

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(`${n} | ${feedCategory}`) || /stylux|return|package/i.test(feedCategory)) return { reject: 'personalisation, gift card or protection' };
  if (/\bpet\b|fanny pack|belt bag/i.test(`${n} | ${feedCategory}`)) return { reject: 'pet or adult bag' };
  const place = sub => ({ site: 'kgw', siteCategory: 'Baby & Toddler', subcategory: sub, name: n });
  if (/carrier|sling|hip seat/i.test(n)) return place('Baby Carriers');
  if (/blanket/i.test(n)) return place('Receiving Blankets');
  if (/teether/i.test(n)) return place('Dummies & Teethers');
  if (/toy/i.test(`${n} | ${feedCategory}`)) return place('Baby Activity Toys');
  return { ...place('Baby & Toddler'), doubt: true };
}
