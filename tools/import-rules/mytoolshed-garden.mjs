// Import rules for My Tool Shed (Awin advertiser 49385) garden products on Garden Gear World.
// My Tool Shed is already on GGW (Hub import router: power garden tools, garden tools, watering). The categories
// Garden Furniture & Outdoor Living, BBQ & Outdoor Cooking, Garden Buildings Fencing & Storage and Outdoor Lighting
// were EMPTY on 21 Oct 2026, while the feed has BBQs and BBQ covers, patio heaters, furniture covers, log stores and
// garden floodlights. This plan adds only those (add-only: the other My Tool Shed products on GGW stay as they are).
// GGW keeps products with the unique key (retailer, merchant id); the router's merchant id is the shop's product number
// ("/prod/192418/"), the feed's merchant_product_id. A product already on GGW keeps its category (keepCategory).
// Tooled Up has the same catalogue (same products and prices), so it is not added a second time.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
import { gardenPlace } from './lib/garden.mjs';

export const RULES = {
  key: 'mytoolshed-garden',
  advertiserId: 49385,
  retailer: 'My Tool Shed',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?mytoolshed\.co\.uk\//i,
  sites: ['ggw'],
  maxPrice: 5000,
  addOnly: true,
  keepQuery: true,
  keepCategory: true
};

// The shop's product number (same on both My Tool Shed feeds), the merchant id the router stored on GGW.
export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

// Only these feed categories: BBQs, furniture and covers, patio heaters, log and garden storage, garden/security lighting.
// (Plants & growing are left to the router: compost tumblers and grow bags are already on GGW under Garden Tools.)
const GARDEN_FEED = /(Garden Tools > (BBQs|Gazebos & Furniture|Storage & Covers)|Patio Heaters|Garden Lighting|Security Lighting|Outdoor Lighting|Log Storage|Garden Storage|Garden Furniture)/i;
const NOT_HERE = /(^|> )(Hand Tools|Power Tools|Power Tool Accessories|Automotive|Workwear|Safety)/i;

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const c = String(feedCategory || '');
  if (!GARDEN_FEED.test(c) || NOT_HERE.test(c)) return { reject: 'not one of the empty garden categories (BBQ, furniture, buildings, lighting)' };
  const place = gardenPlace(name, c);
  if (!place || place.siteCategory === 'Plants, Growing & Garden Care') return { reject: 'garden feed category, but the name is not a BBQ, furniture, storage or lighting product' };
  return { site: 'ggw', ...place };
}
