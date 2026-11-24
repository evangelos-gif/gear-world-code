// Import rules for Sheet Story (Adtraction programme 1876393696 "Sheet Story UK", sheetstory.com, pounds) on Home Gear
// World. Massive import, wave 1 UK, Adtraction (chat 7 sheet «Εγκρίσεις», approved 23 Nov 2026, lessons L225).
// Feed of 24 Nov 2026: 236 rows, 99 product pages (Shopify, one row per size), 190 rows in stock: bamboo and cotton bed
// linen. Shop categories: Pillowcases, Fitted Sheet, Flat Sheet, Duvet Cover, duvet cover set, Complete Bed Set, Bedding
// Set, Mattress Protector, Pillow Protector.
//  - The shop's own category decides (HGW Bedding & Bath, subcategories the site already has, L56): sheets to Bed Sheet,
//    pillowcases and pillow protectors to Pillow, duvet covers and duvet cover sets to Duvet, full bedding sets to Bed
//    Linen, mattress protectors (cot and Moses basket ones too) to Mattress Protector.
import { clean } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'sheetstory-uk',
  network: 'adtraction',
  advertiserId: 1876393696,
  retailer: 'Sheet Story',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?sheetstory\.com\//i,
  sites: ['hgw'],
  maxPrice: 600,
  minPrice: 5,
  commonVariantName: true
};

export function displayBrand() { return 'Sheet Story'; }

// "Ackly Bamboo - Beige Fitted Sheet, Double" -> "Ackly Bamboo Beige Fitted Sheet" (the size after the comma is one option).
export function displayName(name) {
  const n = clean(name).replace(/\s+-\s+/, ' ').replace(/[,\s]+$/, '').trim();
  const head = n.split(/,\s+/)[0].trim();
  return head.split(/\s+/).length >= 3 ? head : n;
}

const BED = sub => ({ site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: sub });
const BY_CATEGORY = [
  [/mattress protector/i, 'Mattress Protector'],
  [/pillow/i, 'Pillow'],
  [/fitted sheet|flat sheet/i, 'Bed Sheet'],
  [/complete bed set|bedding set/i, 'Bed Linen'],
  [/duvet/i, 'Duvet']
];
const BY_NAME = [
  [/mattress protector/i, 'Mattress Protector'],
  [/full bedding set|bedding set/i, 'Bed Linen'],
  [/duvet cover/i, 'Duvet'],
  [/pillow ?cases?|pillow protectors?/i, 'Pillow'],
  [/fitted sheet|flat sheet/i, 'Bed Sheet']
];

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|voucher|sample/i.test(n)) return { reject: 'gift card or sample' };
  // A "Duvet Cover Set" filed under "Complete Bed Set" is a duvet cover set: the name says more than the category there.
  for (const [re, sub] of BY_NAME) if (re.test(n)) return { ...BED(sub), name: n };
  for (const [re, sub] of BY_CATEGORY) if (re.test(feedCategory)) return { ...BED(sub), name: n };
  return { reject: 'not bed linen the site has a place for' };
}
