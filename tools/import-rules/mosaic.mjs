// Import rules for Mosaic Weighted Blankets (Awin advertiser 87403, feed 105766, mosaicweightedblankets.com) on Home
// Gear World. Approved 14 Nov 2026. Feed facts (14 Nov 2026): 496 rows in USD = weight and size options of 46 pages,
// USD 10-345: weighted blankets, duvet covers, lap pads. Shipping page (mosaicweightedblankets.com/policies/
// shipping-policy, read 14 Nov 2026): the contiguous United States only: deliversTo US on HGW (round 2b, lessons L107).
export const RULES = {
  key: 'mosaic',
  advertiserId: 87403,
  retailer: 'Mosaic Weighted Blankets',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?mosaicweightedblankets\.com\//i,
  sites: ['hgw'],
  maxPrice: 1000,
  minPrice: 15
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

export function displayBrand() { return 'Mosaic'; }
export function displayName(name) { return String(name || '').replace(/\s{2,}/g, ' ').trim(); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift card|shipping protection|swatch/i.test(n)) return { reject: 'gift card or swatch' };
  if (/duvet cover|cover\b|sheet|pillowcase/i.test(n)) return { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bed Linen' };
  return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Throw' };
}
