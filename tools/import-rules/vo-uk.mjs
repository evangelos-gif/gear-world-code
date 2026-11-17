// Import rules for VO (Awin advertiser 20371, vo.clothing, pounds) on Women's Gear World and Kids Gear World. Wave 3
// (approvals file of chat 7, 16 Nov 2026, lessons L170). Feed of 17 Nov 2026: 10,000 rows (one per size and colour),
// 364 pages: vegan embroidered hoodies, sweatshirts and T-shirts (unisex), and the same for kids and babies. Adult ones
// go to WGW Clothing (the group chat 7 chose), children's ones to KGW Clothing. UK shop: the sites' default (GB).
import { clean } from './lib/wave3-legacy.mjs';

export const RULES = {
  key: 'vo-uk',
  advertiserId: 20371,
  retailer: 'VO',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?vo\.clothing\//i,
  sites: ['wgw', 'kgw'],
  maxPrice: 200,
  minPrice: 8,
  commonVariantName: true
};

export function displayBrand() { return 'VO'; }

export function classify({ name, feedCategory = '' }) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/gift ?card|e-?gift|voucher|sticker|patch\b/i.test(n)) return { reject: 'gift card or sticker' };
  if (/\b(kids?|baby|babies|toddler|children|youth)\b/i.test(`${n} ${feedCategory}`)) {
    return { site: 'kgw', siteCategory: 'Clothing', subcategory: /baby|toddler|romper|bodysuit/i.test(n) ? 'Clothing' : 'Clothing', name: n };
  }
  const w = sub => ({ site: 'wgw', siteCategory: 'Clothing', subcategory: sub, name: n });
  if (/hoodie|hooded/i.test(n)) return w('Hoodies');
  if (/sweatshirt|sweater|jumper|crew\b/i.test(n)) return w('Sweatshirts');
  if (/t-?shirt|\btee\b|vest top|tank/i.test(n)) return w('T-Shirts');
  if (/joggers?|sweatpants|trousers/i.test(n)) return w('Trousers');
  if (/tote|bag\b/i.test(n)) return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Bags', name: n };
  if (/beanie|hat\b|cap\b/i.test(n)) return { site: 'wgw', siteCategory: 'Bags & Accessories', subcategory: 'Hats', name: n };
  return { reject: 'not clothing the site lists' };
}
