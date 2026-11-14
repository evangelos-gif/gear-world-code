// Import rules for Needs No Label (Awin advertiser 78586, feed 101189) on Women's Gear World. Approved 14 Nov 2026
// (massive import, round 1). Feed facts (checked 14 Nov 2026 on the downloaded feed): 457 rows = one row per size of
// 151 product pages, GBP 6.49 to 94.99, all in stock, Shopify shop needsnolabel.com, brands "Needs No Label" and
// "Miss Cecilia" (jewellery). Names end in " | Size: 12" / " | Clothing Size: 8".
// Shipping page (needsnolabel.com/policies/shipping-policy, read 14 Nov 2026): a UK shop (mainland UK, Northern
// Ireland, Highlands and Islands, Isle of Man, Channel Islands) that also ships to Ireland, Belgium, Cyprus, Denmark,
// France, Germany, Italy, Malta, Spain, Sweden, USA, Canada, Norway, Australia and New Zealand (lessons L62).
// Sections follow the owner's choice for women's fashion shops (Luxefashion 8 Nov, Public Desire 9 Nov 2026):
// dresses, skirts, jackets & coats and jewellery in; tops, trousers, shorts and jumpsuits stay out.
export const RULES = {
  key: 'needsnolabel',
  advertiserId: 78586,
  retailer: 'Needs No Label',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?needsnolabel\.com\//i,
  sites: ['wgw'],
  maxPrice: 400,
  minPrice: 5
};

// One card per product page (the sizes are options of it).
export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._-]{2,180}$/.test(path)) return path;
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

export function displayName(name) {
  return String(name || '').replace(/\s*\|\s*(?:Clothing\s+)?Size:.*$/i, '').replace(/\s{2,}/g, ' ').trim();
}

// The planner passes the feed brand ("Needs No Label", "Needs no label", "Miss Cecilia").
export function displayBrand(brand) {
  return /^miss cecilia$/i.test(String(brand || '').trim()) ? 'Miss Cecilia' : 'Needs No Label';
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  const c = String(feedCategory || '').split('>').pop().trim();
  if (!n) return { reject: 'no name' };
  if (/gift card|gift voucher|e-?gift/i.test(n)) return { reject: 'gift card' };
  // Jewellery (Miss Cecilia) sits in "General Clothing".
  if (W(['earrings?', 'studs?', 'hoops?']).test(n)) return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: 'Earrings' };
  if (W(['necklaces?', 'pendants?', 'chokers?']).test(n)) return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: 'Necklaces' };
  if (W(['bracelets?', 'bangles?', 'cuffs?']).test(n) && !W(['cuff dress', 'cuff (?:top|blouse|shirt)']).test(n) && !/dress|top|blouse/i.test(n)) return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: 'Bracelets' };
  if (W(['rings?']).test(n) && !/earring/i.test(n)) return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: 'Rings' };
  if (W(['jackets?', 'blazers?', 'coats?']).test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Jackets & Coats' };
  if (W(['skirts?']).test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Skirts' };
  if (W(['dress(?:es)?', 'maxi', 'midaxi', 'midi', 'mini']).test(n) && !W(['tops?', 'blouses?', 'shirts?', 'trousers?', 'shorts', 'jumpsuits?']).test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Dresses' };
  if (W(['shirt dress']).test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Dresses' };
  return { reject: `tops, trousers, shorts or jumpsuits (owner's choice for women's fashion shops; section "${c || 'none'}")` };
}
