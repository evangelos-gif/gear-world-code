// Import rules for Opulensi Perfumes (Lattafa, Sapil, Anfar; Awin advertiser 123248) on Women's Gear World.
// Opulensi is ALREADY on WGW (29 products) and MGW (44), written by the Hub import router with retailer name
// 'Opulensi Perfumes Lattafa Sapil Anfar', awin_product_id '123248:<merchant_product_id>' (the Shopify variant). So:
//   - the product key is the feed's merchant_product_id, the router's id: a product already on WGW is UPDATED, never added twice;
//   - add-only (addOnly): Opulensi products on WGW that this plan does not cover stay as they are;
//   - keepCategory: a product already on WGW keeps its category; new ones go to "Beauty & Fragrances".
// Women's and unisex fragrances (and those that name no gender, as in the Joybuy rules) go to WGW. Men's go to MGW
// with opulensi-men.mjs, which also takes the unisex ones: a unisex perfume is shown on both sites.
// Feed facts (gw-feed-gaps 23 Oct 2026): 612 rows, GBP, merchant_category "Perfume" (579), "Cosmetics", "Wallets",
// "Backpack" (Riseicon wallets and laptop backpacks are not in this plan).
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
import { FRAGRANCE_NAME, HOME_SCENT, MEN, MEN_LINES, WOMEN, UNISEX, CJK } from './joybuy.mjs';

export const RULES = {
  key: 'opulensi',
  advertiserId: 123248,
  retailer: 'Opulensi Perfumes Lattafa Sapil Anfar',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?opulensi\.com\//i,
  sites: ['wgw'],
  maxPrice: 500,
  addOnly: true,
  keepQuery: true,
  keepCategory: true
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
// Perfume words the Joybuy list does not have (Arabic perfumery).
export const SCENT = words(['attar', 'ittar', 'oud', 'perfume oil', 'concentrated perfume oil', 'roll on perfume', 'perfumed deodorant', 'perfume deodorant',
  'body spray', 'body mist', 'hair mist', 'deodorant', 'eau de parfum', 'eau de toilette', 'extrait de parfum', 'cologne']);
export const NOT_WORN = words(['bakhoor', 'bakhour', 'bukhoor', 'incense', 'oud chips', 'burner', 'oil burner', 'car perfume', 'car freshener', 'air freshener',
  'room spray', 'reed diffuser', 'diffuser', 'candle', 'candles', 'wallet', 'wallets', 'backpack', 'bag', 'passport', 'card holder', 'atomiser', 'atomizer',
  'empty bottle', 'refillable bottle', 'travel bottle', 'sample vial box']);
export const GIFT = words(['gift set', 'gift sets', 'gift box', 'giftset', 'discovery set', 'sample set', 'bundle', 'set of']);
export const BODY = words(['deodorant', 'body spray', 'body lotion', 'shower gel', 'body wash', 'hand cream']);

export function isWornScent(n, feedCategory = '') {
  if (NOT_WORN.test(n) || HOME_SCENT.test(n)) return false;
  return FRAGRANCE_NAME.test(n) || SCENT.test(n) || /^(perfume|fragrance|deodorant)/i.test(String(feedCategory || '').trim());
}
// men | women | unisex | none
export function genderOf(n) {
  const men = MEN.test(n) || MEN_LINES.test(n), women = WOMEN.test(n), unisex = UNISEX.test(n);
  if (unisex || (men && women)) return 'unisex';
  if (men) return 'men';
  if (women) return 'women';
  return 'none';
}

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  if (CJK.test(n)) return { reject: 'name not in English' };
  if (!isWornScent(n, feedCategory)) return { reject: 'not a perfume or body scent (wallets, bags, incense and others are not in this plan)' };
  if (genderOf(n) === 'men') return { reject: "men's fragrance (Men's Gear World, opulensi-men)" };
  const subcategory = GIFT.test(n) ? 'Gift sets' : BODY.test(n) ? 'Bath & body' : 'Fragrance';
  return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory };
}
