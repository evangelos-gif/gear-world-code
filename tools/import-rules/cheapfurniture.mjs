// Import rules for Cheap Furniture Warehouse (Awin advertiser 107998, feeds 99953 and 113623) on Home Gear World, and its
// garden furniture on Garden Gear World (owner, 8 Nov 2026: "check email and download new feeds and import with one go").
// New on every site. Feed facts (feed-profile 8 Nov 2026): 2,000 + 1,884 products, all in stock, GBP, shop
// cheapfurniturewarehouse.co.uk, mostly no category (feed 99953 has a few: Bed Frames, Furniture, Tables, Chairs, Sofas,
// Wardrobes ...), brands Cheap Furniture Warehouse / CFW, Argos, Habitat, Very Home, Littlewoods. Names carry a marketing
// tail ("Cornwall King Bed Frame Grey Elegant and Comfortable Bedroom Furniture"): the card name stops before it
// (lib/hgw-home.mjs trimTail). The two feeds list many of the same products: one card per product page (lessons L63).
// Not home products (a dog house, a basketball hoop, kitchen cabinet doors) stay out.
// Dry run 8 Nov 2026: the two feeds hold the same products under different addresses and prices (one card at £110, one at
// £99.99). Feed 99953 was last refreshed by Awin on 15 May 2026 (stopped feeds, lessons L39), feed 113623 on 30 Aug 2026,
// so only feed 113623 is read. Rotary airers go to HGW laundry, garden sets get their garden subcategory (furnitureSub).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homePlace, notHome, trimTail, OUTDOOR } from './lib/hgw-home.mjs';
import { gardenPlace, furnitureSub, GARDEN_CATEGORIES } from './lib/garden.mjs';

export const RULES = {
  key: 'cheapfurniture',
  advertiserId: 107998,
  retailer: 'Cheap Furniture Warehouse',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?cheapfurniturewarehouse\.co\.uk\//i,
  sites: ['hgw', 'ggw'],
  maxPrice: 2500,
  minPrice: 10,
  keepQuery: true
};

export function feedFiles(archive) {
  return ['AWIN_107998_113623.csv.gz', 'AWIN_107998_113623.csv'].map(f => join(archive, f)).filter(f => existsSync(f));
}

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._-]{2,180}$/.test(path)) return path;
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

export function displayBrand(brand) {
  const b = String(brand || '').trim();
  return !b || /^(cfw|cheap furniture warehouse)$/i.test(b) ? 'Cheap Furniture Warehouse' : b;
}

export function classify({ name, feedCategory = '' }) {
  const n = trimTail(name);
  if (!n) return { reject: 'no name' };
  if (notHome(n)) return { reject: 'not furniture or home (pets, sport, toys, kitchen and bathroom fittings)' };
  if (/\b(rotary airers?|airers?|washing lines?|clothes dryers?)\b/i.test(n)) return { site: 'hgw', siteCategory: 'Cleaning & Laundry', subcategory: 'Clothes Airer', name: n };
  if (OUTDOOR.test(n)) {
    const g = gardenPlace(n, feedCategory);
    if (g && g.siteCategory !== GARDEN_CATEGORIES.furniture) return { site: 'ggw', ...g, name: n };
    return { site: 'ggw', siteCategory: GARDEN_CATEGORIES.furniture, subcategory: furnitureSub(n) || 'Garden furniture', name: n };
  }
  const h = homePlace(n);
  if (!h) return { reject: 'no furniture or home type in the name' };
  return { site: 'hgw', ...h, name: n };
}
