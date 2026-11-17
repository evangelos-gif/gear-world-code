// Import rules for GardePro (Awin advertiser 49085, gardeproshop.com, US dollars) on Home Gear World. Wave 3 (approvals
// file of chat 7, 16 Nov 2026, lessons L171; suggested for Garden, but GGW has no camera category and HGW keeps outdoor
// cameras in Smart Home > Security Camera). Feed of 17 Nov 2026: 23 trail cameras (WiFi, with security box, packs).
// US shop: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'gardepro-us',
  advertiserId: 49085,
  retailer: 'GardePro',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?gardeproshop\.com\//i,
  sites: ['hgw'],
  maxPrice: 700,
  minPrice: 30
};

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/sd card|memory card|battery|batteries|solar panel|strap|mount|bracket/i.test(n) && !/camera/i.test(n)) return { reject: 'accessory' };
  if (/camera/i.test(n)) return { site: 'hgw', siteCategory: 'Smart Home', subcategory: 'Security Camera', name: n };
  return { reject: 'not a camera' };
}
