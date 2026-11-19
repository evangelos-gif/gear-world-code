// Import rules for Tameson (Awin advertiser 110596 "Tameson (USA)", tameson.com, US dollars) on Construction Gear World.
// Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 115,726 industrial products (valves
// 44,177, fittings 18,666, electrical 17,517, pneumatics 12,006, sealants and tapes 11,051, measurement, hose). CGW's
// Hand Tools already holds more than 20,000 products, so nothing goes there: valves, fittings, pneumatics, hose and
// gauges go to Site Equipment > Industrial Equipment, sealants, adhesives and tapes to Site Equipment > DIY, and at most
// RULES.maxPerSubcategory cards each, the same ones at every refresh (lessons L146, L164). US shop: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

// 19 Nov 2026 (lessons L193): no RULES.maxPerSubcategory any more, the older sites read only the cards they show.
export const RULES = {
  key: 'tameson-us',
  advertiserId: 110596,
  retailer: 'Tameson',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?tameson\.com\//i,
  sites: ['cgw'],
  maxPrice: 3000,
  minPrice: 5
};

export function classify({ name, feedCategory = '' }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  const cat = clean(feedCategory);
  if (/spare|repair kit|seal kit|coil only|replacement/i.test(n)) return { reject: 'spare part' };
  if (/^(Valves|Fittings|Pneumatics and Compressed Air|Hose and Pipe|Measurement and Control)/i.test(cat)) return { site: 'cgw', siteCategory: 'Site Equipment', subcategory: 'Industrial Equipment', name: n };
  if (/^Sealant, Adhesive and Tape/i.test(cat)) return { site: 'cgw', siteCategory: 'Site Equipment', subcategory: 'DIY', name: n };
  return { reject: `Tameson group "${cat || 'none'}" left out (electrical parts and others)` };
}
