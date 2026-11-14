// Import rules for MASON New York Jewelry (Awin advertiser 45949, feed 117810) on Women's Gear World. Approved
// 14 Nov 2026 ("You're Approved to Partner with MASON New York"). Feed facts (checked 14 Nov 2026 on the downloaded
// feed): 475 rows = the metal / ring-size options of 110 product pages, USD 250 to 7,260, one category
// "Women's Jewellery", brand MASON New York, diamond rings, necklaces, earrings, bracelets, sets and charms.
// Shipping page (masonnewyork.com/policies/shipping-policy, read 14 Nov 2026): ships to about 200 countries, the
// United Kingdom and the United States among them (UK duties may be charged at checkout), lessons L62.
export const RULES = {
  key: 'masonnewyork',
  advertiserId: 45949,
  retailer: 'MASON New York',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?masonnewyork\.com\//i,
  sites: ['wgw'],
  maxPrice: 8000,
  minPrice: 50
};

// One card per product page (metal and size are options of it).
export function productKey(get) {
  try {
    // Handles can carry an encoded "™" (%E2%84%A2): without "%" here every option became its own card.
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

export function displayBrand() {
  return 'MASON New York';
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');

export function classify({ name }) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (!n) return { reject: 'no name' };
  if (/gift card|gift voucher|e-?gift|ring sizer|cleaning/i.test(n)) return { reject: 'gift card, ring sizer or care item' };
  const site = 'wgw', siteCategory = "Women's Jewellery";
  // A set (earrings and necklace together) is "Jewellery"; a charm bracelet is a bracelet, a lone charm "Jewellery".
  if (W(['sets?', 'bundles?', 'brooch(?:es)?']).test(n)) return { site, siteCategory, subcategory: 'Jewellery' };
  if (W(['earrings?', 'studs?', 'hoops?', 'huggies?']).test(n)) return { site, siteCategory, subcategory: 'Earrings' };
  if (W(['necklaces?', 'pendants?', 'chokers?', 'chains?']).test(n)) return { site, siteCategory, subcategory: 'Necklaces' };
  if (W(['bracelets?', 'bangles?', 'cuffs?', 'anklets?']).test(n)) return { site, siteCategory, subcategory: 'Bracelets' };
  if (W(['rings?', 'bands?']).test(n)) return { site, siteCategory, subcategory: 'Rings' };
  return { site, siteCategory, subcategory: 'Jewellery' };
}
