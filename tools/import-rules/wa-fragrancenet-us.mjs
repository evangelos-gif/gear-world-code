// Import rules for FragranceNet.com US (Rakuten Advertising MID 216) — Priority A of «Λείπουν 25-11» (row 207), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 24-26 Nov 2026: 37,259 rows: fragrances, skincare, hair care, bath and body, gift sets, candles. Women's and unisex scents (men's are not on this line), never a tester, mini, vial or sample (lib/fragrance-us.mjs); skincare and hair care by the shop's folder; candles stay out. At most 400 cards a subcategory.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE, TESTER } from './lib/wave-a.mjs';
import { placeFragrance } from './lib/fragrance-us.mjs';

export const RULES = rulesOf({ key: 'wa-fragrancenet-us', network: 'rakuten', advertiserId: 216, retailer: 'FragranceNet.com US', currency: 'USD',
  shop: shopOf('fragrancenet.com'), sites: ['wgw'], minPrice: 10, maxPrice: 400, maxPerSubcategory: 400 });

export const displayName = name => noSale(String(name || '').replace(/\s*\*TESTER\b/i, ' TESTER'));

export function classify({ name, feedCategory = '', url = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (TESTER.test(n) || /\bmini\b|\bvial\b|on card|travel spray/i.test(n)) return { reject: 'tester, mini, vial or sample' };
  if (/for men\b|\bmen\b$|cologne|after ?shave/i.test(n) && !/women|unisex/i.test(n)) return { reject: "men's (not on this line)" };
  const at = sub => ({ site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub, name: n });
  if (/^candle/i.test(feedCategory)) return { reject: 'candle (home product)' };
  if (/^skincare/i.test(feedCategory)) return at(/body/i.test(feedCategory) ? 'Bath & body' : 'Skincare');
  if (/^haircare/i.test(feedCategory)) return at('Hair care');
  if (/^makeup|^cosmetic/i.test(feedCategory)) return at('Make-up');
  if (/bath & body/i.test(feedCategory)) return at('Bath & body');
  if (/^fragrance/i.test(feedCategory)) {
    const p = placeFragrance(n, feedCategory, '', url);
    if (p.reject) return p;
    if (p.site !== 'wgw') return { reject: "men's (not on this line)" };
    return { ...p, name: n };
  }
  return { reject: 'not a beauty product the site lists' };
}
