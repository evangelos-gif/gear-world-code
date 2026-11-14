// Import rules for Dream Interiors (Awin advertiser 72391, feed 91577) on Home Gear World (owner, 8 Nov 2026: "check
// email and download new feeds and import with one go"). New on every site. Feed facts (feed-profile 8 Nov 2026): 2,467
// luxury products, all in stock, GBP 145 to 9,500, shop dreaminteriors.co.uk, categories Lighting (1,082), Tables (435),
// Furniture Accessories (390), Chairs (263), Storage (86), Decorations (79), Sofas (69), House Accessories (63), brand
// Dream Interiors. Names are short ("Luxury Antique Brass Pendant", "Kendrick Console Table Large"): the name decides
// (lib/hgw-home.mjs); when it does not, the shop's category gives a sensible place.
import { homePlace, notHome } from './lib/hgw-home.mjs';

export const RULES = {
  key: 'dreaminteriors',
  advertiserId: 72391,
  retailer: 'Dream Interiors',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?dreaminteriors\.co\.uk\//i,
  sites: ['hgw'],
  maxPrice: 10000,
  keepQuery: true
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

export function displayBrand() {
  return 'Dream Interiors';
}

// The shop's category when the name says nothing more ("Kendrick Large", "Aurora Gold").
const BY_FEED = [
  [/lighting/i, { siteCategory: 'Lighting', subcategory: 'Ceiling Light' }],
  [/tables/i, { siteCategory: 'Furniture', subcategory: 'Side Table' }],
  [/chairs/i, { siteCategory: 'Furniture', subcategory: 'Armchair' }],
  [/sofas/i, { siteCategory: 'Furniture', subcategory: 'Sofa' }],
  [/storage/i, { siteCategory: 'Furniture', subcategory: 'Sideboard' }],
  [/accessories|decorations/i, { siteCategory: 'Home Decor', subcategory: 'Ornament' }]
];

export function classify({ name, feedCategory = '' }) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (!n) return { reject: 'no name' };
  if (notHome(n)) return { reject: 'not a home product' };
  const h = homePlace(n);
  if (h) return { site: 'hgw', ...h, name: n };
  for (const [re, place] of BY_FEED) if (re.test(feedCategory)) return { site: 'hgw', ...place, name: n };
  return { reject: 'no home type in the name or the shop category' };
}
