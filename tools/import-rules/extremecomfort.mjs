// Import rules for Extreme Comfort (Awin advertiser 122644, extreme-comfort.co.uk) on Home Gear World (12 Nov 2026,
// lessons L117). New on every site. The feed comes only in the Google format (122644-retail-en_GB.csv.gz, Awin feed
// F2344): 390 rows = one row per size or colour, 371 in stock, prices in pounds; Google categories Mattresses 295,
// Mattress Protectors 54, Mattress Foundations 18, Beds & Bed Frames 5. Names "<product> - <colour> / <size>".
//  - One card per product page, at the lowest in-stock price; the card name is what all options share.
//  - Mattresses: Furniture > Mattress. Toppers: Bedding & Bath > Mattress Topper. Protectors and covers: Bedding & Bath >
//    Mattress Protector. Divan bases and bed frames: Furniture > Bed Frame.
import { googleFeedFiles, googleField, stripOption } from './lib/google-feed.mjs';

export const RULES = {
  key: 'extremecomfort',
  advertiserId: 122644,
  retailer: 'Extreme Comfort',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?extreme-comfort\.co\.uk\//i,
  sites: ['hgw'],
  maxPrice: 2000,
  minPrice: 8,
  commonVariantName: true
};

export const feedFiles = googleFeedFiles(RULES.advertiserId);
export const field = googleField;

export function displayBrand() { return 'Extreme Comfort'; }

export function displayName(name) {
  return stripOption(name);
}

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|voucher/i.test(n)) return { reject: 'gift card' };
  if (/\btopper\b/i.test(n)) return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Mattress Topper' };
  if (/\b(protector|encasement)\b|\bmattress cover\b/i.test(n)) return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Mattress Protector' };
  if (/\b(divan|bed frame|bed base|headboard|ottoman bed|ottoman)\b/i.test(n)) return { site: 'hgw', siteCategory: 'Furniture', subcategory: 'Bed Frame' };
  if (/\bmattress\b/i.test(n) || /mattresses/i.test(feedCategory)) return { site: 'hgw', siteCategory: 'Furniture', subcategory: 'Mattress' };
  if (/foundations|bed frames/i.test(feedCategory)) return { site: 'hgw', siteCategory: 'Furniture', subcategory: 'Bed Frame' };
  if (/mattress protec/i.test(feedCategory)) return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Mattress Protector' };
  if (/\bpillows?\b/i.test(n)) return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Pillow' };
  return { reject: 'no clear place on Home Gear World' };
}
