// Import rules for WILDGUARDER US (Awin advertiser 126831) — Priority A of «Λείπουν 25-11» (row 37), chat 3, 27 Nov 2026 (lessons L234, L237).
// Feed of 27 Nov 2026: 56 rows, trail and time-lapse cameras, night-vision goggles and binoculars, thermal monoculars, rangefinders. Only the trail and time-lapse cameras for watching wildlife in a garden are listed (a new GGW subcategory "Wildlife cameras", L56); night-vision and thermal devices, scopes and hunting rangefinders stay out.
// The retailer name is the shop's delivery line in sites/_shared/wave-a.js (shown only where the shop delivers).
import { rulesOf, shopOf, noSale, SERVICE } from './lib/wave-a.mjs';

export const RULES = rulesOf({ key: 'wa-wildguarder-us', advertiserId: 126831, retailer: 'WILDGUARDER US', currency: 'USD',
  shop: shopOf('store.wildguarder.com', 'wildguarder.com'), sites: ['ggw'], minPrice: 50, maxPrice: 800 });

// parent_product_id is 0 on every row: one card per product number.
export const productKey = get => get('merchant_product_id');

export const displayName = name => noSale(String(name || '').replace(/®/g, '')).replace(/\s*\|\s*/, ' ');

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (SERVICE.test(n)) return { reject: 'gift card or service' };
  if (/night vision|thermal|rangefinder|scope|goggles?|binoculars?|monocular|hunting|alarm|nvg/i.test(`${n} ${feedCategory}`)) return { reject: 'night-vision, thermal or hunting device (not a garden product)' };
  if (!/trail cam|time ?lapse|game cam|wildlife cam|cellular (?:solar )?trail|camera/i.test(`${n} ${feedCategory}`)) return { reject: 'not a wildlife camera' };
  return { site: 'ggw', siteCategory: 'Outdoor Lighting & Garden Electrical', subcategory: 'Wildlife cameras', name: n };
}
