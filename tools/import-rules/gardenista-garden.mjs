// Import rules for Gardenista (Awin advertiser 37292) garden products on Garden Gear World.
// Gardenista is already on Home Gear World (Hub import router: 238 cushions, recliners and rugs, 23 Oct 2026). This plan
// puts its OUTDOOR products on GGW: garden cushions and seat pads, bench and furniture covers, swing seat pads, outdoor
// rugs and garden furniture. Indoor products stay on HGW only. Gardenista is new on GGW, so this is a normal plan.
// Feed facts (gw-feed-gaps 23 Oct 2026): two feeds, 91771 (1,741 rows, "Home & Garden > Garden", 499 sold out by
// in_stock) and 114613 (1,004 rows, "Furniture" / "Home Accessories"). No currency column (programme in GBP).
// Names like "2 Seater Garden Bench Cover", "3 - Seater Swing Seat Pad 180cm",
// "Water-Resistant Decorative Scatter Cushion Covers Outdoor Printed Cushion Cover - 5pc Set Elephant".
// The product id is the feed's merchant_product_id (the Shopify variant), the same id the router used on HGW; options of one
// page with the same name are joined into one card (joinSameName). The first dry run (23 Oct 2026) left out 1,237 products
// because their link is not on gardenistauk.com: the report now shows which address they have.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
import { gardenPlace, GARDEN_CATEGORIES, NOT_GARDEN, OUTDOOR_HINT, furnitureSub } from './lib/garden.mjs';

export const RULES = {
  key: 'gardenista-garden',
  advertiserId: 37292,
  retailer: 'Gardenista',
  currency: 'GBP',
  // gardenistauk.com, and gardenista-store.myshopify.com (the same Shopify shop; 248 products of the second dry run).
  shop: /^https:\/\/(([a-z0-9-]+\.)?gardenistauk\.com|gardenista-store\.myshopify\.com)\//i,
  sites: ['ggw'],
  maxPrice: 3000,
  keepQuery: true,
  // Two options of one page with the same name ("Replacement Director Chair Covers" twice) are one card.
  joinSameName: true,
  // Checked on the shop's live Shopify site (L39): pages gone or sold out there are left out, the picture and the
  // link are the shop's current ones, an older feed's copy of the same option is left out.
  shopifyCheck: true,
  shopOrigin: 'https://gardenistauk.com'
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
// Soft furnishings that belong in the garden only when the name says outside.
const SOFT = words(['cushion', 'cushions', 'seat pad', 'seat pads', 'bench pad', 'bench pads', 'pad', 'pads', 'pillow', 'pillows', 'rug', 'rugs', 'cushion cover',
  'cushion covers', 'bench cover', 'furniture cover', 'chair cover', 'chair covers', 'cover', 'covers', 'bean bag', 'beanbag', 'pouffe', 'pouf']);
// Indoor words: these stay on Home Gear World.
const INDOOR = words(['indoor', 'bedroom', 'living room', 'sofa bed', 'recliner chair', 'armchair', 'accent chair', 'dining chair', 'office', 'bed', 'headboard', 'duvet',
  'curtain', 'curtains', 'lampshade', 'throw blanket', 'kids', 'children', 'pet', 'dog', 'cat']);

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  if (/\btest product\b|\bgift card\b|\bvoucher\b/i.test(n)) return { reject: 'test product or gift card' };
  if (NOT_GARDEN.test(n.replace(/\bcushion cover for sofa\b/gi, ' ')) && !OUTDOOR_HINT.test(n)) return { reject: 'not a garden product (indoor, kitchen, toy or other)' };
  if (INDOOR.test(n) && !OUTDOOR_HINT.test(n)) return { reject: 'indoor product (stays on Home Gear World)' };
  // Cushions and covers first: "Outdoor Keter Eden Bench Cushions ... Garden Storage Bench" is a cushion, not a storage bench.
  if (SOFT.test(n) && OUTDOOR_HINT.test(n) && !/\b(bbq|barbecues?|barbeques?|grill)\b/i.test(n)) return { site: 'ggw', siteCategory: GARDEN_CATEGORIES.furniture, subcategory: furnitureSub(n) };
  const place = gardenPlace(n, feedCategory);
  if (place && place.siteCategory === GARDEN_CATEGORIES.furniture) return { site: 'ggw', siteCategory: place.siteCategory, subcategory: furnitureSub(n) };
  if (place) return { site: 'ggw', ...place };
  return { reject: 'not an outdoor product (no garden or outdoor word in the name)' };
}
