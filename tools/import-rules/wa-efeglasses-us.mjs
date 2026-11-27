// Import rules for EFE Glasses US (Awin advertiser 52103) — Priority A of «Λείπουν 25-11» (row 112), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: two feeds (127 and 37 rows) of glasses frames with lenses (square, round, aviator, rectangle) and readers. MGW had no glasses: a new subcategory "Eyeglasses" in Bags & Accessories, named as on WGW (L56). Cat-eye frames stay out (women's).
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-efeglasses-us', advertiserId: 52103, retailer: 'EFE Glasses US', currency: 'USD',
  shop: shopOf('efeglasses.com'), sites: ['mgw'], minPrice: 5, maxPrice: 200, joinSameNameAcrossFeeds: true });

// "Square Gradient Gray" -> "Square Gradient Gray Eyeglasses".
export const displayName = name => { const n = noSale(name); return /glasses|readers?/i.test(n) ? n : `${n} Eyeglasses`; };

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (/cat-?eye|women|ladies|kids?\b/i.test(n)) return { reject: "women's or children's frame" };
  if (/case|cloth|cleaner|lens only/i.test(n)) return { reject: 'accessory' };
  return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Eyeglasses', name: n };
}
