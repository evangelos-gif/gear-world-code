// Import rules for MEEDEN (Awin advertiser 98529, meedenart.com, US dollars) on Home Gear World. Wave 3 (approvals file
// of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 186 products: art easels, pochade boxes, sketch boxes,
// art storage, drafting tables, palettes, airbrush kits. HGW keeps art and craft in Home Decor > Craft & Sewing.
// US shop: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'meeden-us',
  advertiserId: 98529,
  retailer: 'MEEDEN',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?meedenart\.com\//i,
  sites: ['hgw'],
  maxPrice: 800,
  minPrice: 10
};

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/replacement|spare|parts?\b|gift ?card|canvas pad|paper\b/i.test(n)) return { reject: 'spare part or paper' };
  if (/easel|pochade|sketch ?box|palette|drafting|drawing table|art (?:desk|table|storage|box|cart|supply)|storage box|airbrush|brush (?:holder|box|washer)|print rack|drying rack|paint/i.test(n)) {
    return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Craft & Sewing', name: n };
  }
  return { reject: 'not art equipment' };
}
