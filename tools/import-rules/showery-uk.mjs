// Import rules for Showery (Adtraction programme 1888673499 "Showery UK", showery.co.uk, pounds) on Home Gear World.
// Massive import, wave 1 UK, Adtraction (chat 7 sheet «Εγκρίσεις», approved 23 Nov 2026, lessons L225).
// Feed of 24 Nov 2026 (tools/adtraction-feed-download.ps1): 133 rows, 50 product pages (Shopify, one row per option), all in
// stock, every name starting with "Showery®": shower heads, hoses, holders, caddies, mats, drain plugs and squeegees.
//  - Shower heads, hoses, holders, caddies, seals and drain plugs to Bedding & Bath > Bathroom Accessories; bath and shower
//    mats to Bath Mat; the drain unblocker, mould gel and cleaners to Cleaning & Laundry.
//  - Replacement filters, filter stones and refills stay out (a refill of a product, not the product); so do the
//    Bluetooth shower speakers (a tech product, not a bathroom one for HGW).
import { clean } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'showery-uk',
  network: 'adtraction',
  advertiserId: 1888673499,
  retailer: 'Showery',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?showery\.co\.uk\//i,
  sites: ['hgw'],
  maxPrice: 500,
  minPrice: 5,
  commonVariantName: true
};

export function displayBrand() { return 'Showery'; }

// "Showery® 4 in 1 High Pressure Shower Head, Silver" -> "4 in 1 High Pressure Shower Head" (brand shown on its own; the
// first option's colour or size after the comma is not the product).
export function displayName(name) {
  const n = clean(name).replace(/^showery\s*(®|\(r\))?\s*/i, '').replace(/[,\s]+$/, '').trim();
  const head = n.split(/,\s+/)[0].trim();
  return head.split(/\s+/).length >= 3 ? head : n;
}

const BATH = { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bathroom Accessories' };

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/\bspeakers?\b|bluetooth/i.test(n)) return { reject: 'a Bluetooth speaker (a tech product, not for Home Gear World)' };
  if (/replacement|refill|cotton filters?|filter stones?/i.test(n)) return { reject: 'a replacement filter or refill, not the product itself' };
  const place = p => ({ ...p, name: n });
  if (/\bmats?\b/i.test(n)) return place({ site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bath Mat' });
  if (/drain weasel|unblock|mould remover|cleaner|squeegee|drying cloth|microfibre/i.test(n)) {
    if (/cloth|microfibre/i.test(n)) return place({ site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: 'Cloths & Sponges' });
    if (/squeegee|electric bathroom cleaner|scrub/i.test(n)) return place({ site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: 'Cleaning Brush' });
    return place({ site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: 'Cleaning Products' });
  }
  if (/shower|hose|holder|bracket|caddy|drain plug|stopper|sealing tape|tap adapter|temperature monitor|water filter/i.test(n)) return place(BATH);
  return { reject: 'not a bathroom product the site has a place for' };
}
