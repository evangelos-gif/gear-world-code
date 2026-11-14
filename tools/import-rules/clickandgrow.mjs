// Import rules for Click & Grow (CJ Affiliate advertiser 4297609, clickandgrow.com) on Garden Gear World. Joined
// 12-13 Nov 2026. Feed facts (13 Nov 2026): 160 rows in USD, one section "All products": smart indoor gardens, plant
// pod packs, stands and lamps, USD 9.95-299.95. Delivery: the United States (L62 check of 13 Nov 2026): deliversTo US
// on GGW (round 2b, lessons L107).
export const RULES = {
  key: 'clickandgrow',
  network: 'cj',
  advertiserId: 4297609,
  retailer: 'Click and Grow',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?clickandgrow\.com\//i,
  sites: ['ggw'],
  maxPrice: 1500,
  minPrice: 5
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

export function displayBrand() { return 'Click & Grow'; }
export function displayName(name) { return String(name || '').replace(/\s{2,}/g, ' ').trim(); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift card|subscription|membership|shipping protection/i.test(n)) return { reject: 'gift card or subscription' };
  const g = sub => ({ site: 'ggw', siteCategory: 'Plants, Growing & Garden Care', subcategory: sub });
  // Plant pods are seeds in a soil capsule: GGW's "Seeds & bulbs" (dry run of 14 Nov 2026; "Propagation" is trays and
  // propagators).
  if (/pods?|seeds?|plant pack|mix\b/i.test(n)) return g('Seeds & bulbs');
  if (/lamp|light|grow light/i.test(n)) return g('Grow lights');
  return g('Hydroponics');
}
