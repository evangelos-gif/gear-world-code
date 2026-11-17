// Import rules for BlindsMagic (Awin advertiser 78834, blindsmagic.com, US dollars) on Home Gear World. Wave 3 (approvals
// file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 27 rows, 25 pages: roller, zebra, sheer and outdoor
// shades, plus fabric samples, motors and solar panels (left out). Made to US inch sizes: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'blindsmagic-us',
  advertiserId: 78834,
  retailer: 'BlindsMagic',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?blindsmagic\.com\//i,
  sites: ['hgw'],
  maxPrice: 1500,
  minPrice: 20
};

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/samples?|\bmotor\b|solar panel|remote|\bhub\b|charger|battery|bracket|light blockers?|valance|cassette|resize/i.test(n)) return { reject: 'sample, motor or another part' };
  if (/shades?|blinds?/i.test(n)) return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Blinds', name: n };
  return { reject: 'not a blind' };
}
