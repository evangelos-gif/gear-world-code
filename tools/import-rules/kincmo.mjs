// Import rules for Kincmo (CJ Affiliate advertiser 7961854, kincmo.com) on Home Gear World. Joined 13 Nov 2026. Feed
// facts (13 Nov 2026): 992 rows in USD = fabric and size options of about 195 pages: motorized, cordless and no-drill
// roller, zebra and cellular shades, USD 76-210; 98 rows "shipping-protection" are not products. Delivery: the United
// States (L62 check of 13 Nov 2026): deliversTo US on HGW (round 2b, lessons L107).
export const RULES = {
  key: 'kincmo',
  network: 'cj',
  advertiserId: 7961854,
  retailer: 'Kincmo',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?kincmo\.com\//i,
  sites: ['hgw'],
  maxPrice: 2000,
  minPrice: 15,
  commonVariantName: true
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

export function displayBrand() { return 'Kincmo'; }
export function displayName(name) { return String(name || '').replace(/\s{2,}/g, ' ').trim(); }

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/shipping-protection/i.test(feedCategory) || /shipping protection|insurance|gift card|sample/i.test(n)) return { reject: 'shipping protection, sample or gift card' };
  if (/remote|hub|charger|bracket|motor kit|battery/i.test(n) && !/shades?|blinds?/i.test(n)) return { site: 'hgw', siteCategory: 'Smart Home', subcategory: 'Smart Home Accessories' };
  if (/curtains?|drapes?/i.test(n)) return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Curtain' };
  return { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Blinds' };
}
