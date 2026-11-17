// Import rules for Sleep Zone (Awin advertiser 79814 "SOUTH POINT HOME FASHIONS (Sleep Zone)", sleepzonelife.com, US
// dollars) on Home Gear World. Wave 3 (approvals file of chat 7, 16 Nov 2026, lessons L171). Feed of 17 Nov 2026: 673
// rows, 82 pages: sheets, duvet covers, comforters, toppers, throws, shower curtains. Shown only to the US.
import { homePlace, homeName } from './lib/hgw-home.mjs';
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'sleepzone-us',
  advertiserId: 79814,
  retailer: 'Sleep Zone',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?sleepzonelife\.com\//i,
  sites: ['hgw'],
  maxPrice: 600,
  minPrice: 10
};

export function displayName(name) { return homeName(clean(name)); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  const h = sub => ({ site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: sub, name: n });
  if (/shower curtain/i.test(n)) return h('Bathroom Accessories');
  if (/bed ?skirts?|valances?/i.test(n)) return h('Bed Linen');
  if (/mattress protector|mattress pad|mattress encasement/i.test(n)) return h('Mattress Protector');
  if (/topper/i.test(n)) return h('Mattress Topper');
  if (/comforter|duvet insert|quilt\b|coverlet/i.test(n)) return h('Duvet');
  if (/duvet cover/i.test(n)) return h('Duvet');
  if (/pillow ?cases?|shams?\b/i.test(n)) return h('Pillow');
  if (/sheets?\b|sheet set/i.test(n)) return h('Bed Sheet');
  if (/\btowels?\b/i.test(n)) return h('Towel');
  if (/blanket|throw/i.test(n)) return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Throw', name: n };
  const p = homePlace(n);
  if (!p) return { reject: 'no home place for this name' };
  return { site: 'hgw', ...p, name: n };
}
