// Import rules for Everywhere Chair (Awin advertiser 88003, everywherechair.com, US dollars) on Garden Gear World. Wave 3
// (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 180 products: folding, director's and
// beach chairs, stools and camp tables of several makers, plus many replacement covers, cushions and cup holders (left
// out). US shop: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'everywherechair-us',
  advertiserId: 88003,
  retailer: 'Everywhere Chair',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?everywherechair\.com\//i,
  sites: ['ggw'],
  maxPrice: 900,
  minPrice: 25
};

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/replacement|cover|covers|cushion|cupholder|cup holder|pouch|bag\b|arms?\b(?! and)|canopy|custom|parts?\b|kit\b|strap|pillow/i.test(n)) return { reject: 'cover, cushion or another part' };
  const g = sub => ({ site: 'ggw', siteCategory: 'Garden Furniture & Outdoor Living', subcategory: sub, name: n });
  if (/chairs?|stools?|chaise|lounger|rocker|seat\b|bench/i.test(n)) return g('Chairs & benches');
  if (/\btables?\b/i.test(n)) return g('Tables');
  return { reject: 'not a chair or table' };
}
