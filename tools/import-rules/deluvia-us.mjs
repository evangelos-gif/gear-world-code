// Import rules for Deluvia (Awin advertiser 59283 "Deluvia Skincare and Cosmetics", deluviausa.com, US dollars) on
// Women's Gear World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 9 products:
// aloe and manuka honey creams, body kits, a mineral make-up kit. US shop: shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'deluvia-us',
  advertiserId: 59283,
  retailer: 'Deluvia',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?deluviausa\.com\//i,
  sites: ['wgw'],
  maxPrice: 300,
  minPrice: 10
};

export function classify({ name }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  const b = sub => ({ site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub, name: /deluvia/i.test(n) ? n : `Deluvia ${n}` });
  if (/make-?up|foundation|mineral|lip|mascara|eye/i.test(n)) return b('Make-up');
  if (/body/i.test(n)) return b('Bath & body');
  return b('Skincare');
}
