// Import rules for Sleep & Beyond (Awin advertiser 91147, sleepandbeyond.com, US dollars; shown as "Sleep and Beyond":
// legacy-import.ps1 hands the name to wrangler, which takes no "&") on Home Gear World. Wave 3
// (approvals file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 274 rows, 42 pages: organic cotton,
// bamboo and wool sheets, blankets, duvet covers, comforters, pillows, toppers and protectors; baby bedding left out
// (Home site). US sizes (Twin, Queen, Cal King): shown only to the US.
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'sleepandbeyond-us',
  advertiserId: 91147,
  retailer: 'Sleep and Beyond',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?sleepandbeyond\.com\//i,
  sites: ['hgw'],
  maxPrice: 1200,
  minPrice: 10
};

export function classify({ name, feedCategory = '' }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/\bbaby\b|crib|toddler/i.test(`${n} ${feedCategory}`)) return { reject: 'baby bedding (not the Home site)' };
  if (/gift ?card|laundry|wash|swatch/i.test(n)) return { reject: 'gift card or care product' };
  const h = sub => ({ site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: sub, name: n });
  if (/protector/i.test(n)) return h('Mattress Protector');
  if (/topper|mattress pad/i.test(n)) return h('Mattress Topper');
  if (/comforter|duvet\b(?! cover)|quilt/i.test(n)) return h('Duvet');
  if (/duvet cover/i.test(n)) return h('Duvet');
  if (/pillow ?cases?|shams?\b/i.test(n)) return h('Pillow');
  if (/pillow/i.test(n)) return h('Pillow');
  if (/sheet/i.test(n)) return h('Bed Sheet');
  if (/towel|bath sheet/i.test(n)) return h('Towel');
  if (/robe/i.test(n)) return h('Bathrobe');
  if (/blanket|throw/i.test(n)) return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Throw', name: n };
  return { reject: 'not bedding the site lists' };
}
