// Import rules for Jeulia (CJ Affiliate advertiser 4675103, jeulia.com) on Women's and Men's Gear World. Joined 12-13 Nov
// 2026. Feed facts (14 Nov 2026 download, lessons L129 price bands): about 21,000 rows in USD = the metal, carat and size
// options of about 2,500 product pages; sections "Alloy Rings", "Alloy Necklaces", "Jewelry Sets"; names "Jeulia ...".
// Delivery: the United States (L62 check of 13 Nov 2026), so the sites list Jeulia with deliversTo US (massive import,
// round 2b, lessons L107: a UK visitor does not see it).
//  - Men's pieces ("for Men", "Men's", "Mens") -> MGW Men's Jewellery; everything else -> WGW Women's Jewellery.
export const RULES = {
  key: 'jeulia',
  network: 'cj',
  advertiserId: 4675103,
  retailer: 'Jeulia',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?jeulia\.com\//i,
  sites: ['wgw', 'mgw'],
  maxPrice: 6000,
  minPrice: 20
};

// One card per product page (metal, stones, carat and size are options of it).
export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

export function displayBrand() { return 'Jeulia'; }
export function displayName(name) { return String(name || '').replace(/^Jeulia\s+/i, '').replace(/\s{2,}/g, ' ').trim(); }

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const MEN = W(["men'?s", 'mens', 'for men', 'him', 'groom', 'husband', 'boyfriend']);

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/gift card|gift box only|ring sizer|cleaning|polishing/i.test(n)) return { reject: 'gift card, ring sizer or care item' };
  const men = MEN.test(n) && !W(["women'?s", 'womens', 'her', 'couples?', 'his and hers', 'his & hers']).test(n);
  // A "Ring Set" (bridal set, couple rings, "Bezel Set ... Ring") is rings (first plan, 14 Nov 2026: 618 went to "Jewellery").
  const ring = W(['rings?', 'bands?']).test(n) && !W(['earrings?']).test(n);
  const sub = ring ? 'Rings'
    : W(['earrings?', 'studs?', 'hoops?']).test(n) ? 'Earrings'
      : W(['bracelets?', 'bangles?', 'anklets?']).test(n) && !W(['necklaces?', 'pendants?']).test(n) ? 'Bracelets'
        : W(['necklaces?', 'pendants?', 'chokers?', 'chains?', 'lockets?']).test(n) || /necklaces/i.test(feedCategory) ? 'Necklaces'
          : /rings/i.test(feedCategory) ? 'Rings' : 'Jewellery';
  if (men) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: sub === 'Rings' || sub === 'Earrings' ? 'Jewellery' : sub };
  return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: sub };
}
