// Import rules for Silver Cloud Beauty (Awin advertiser 102901) on Women's Gear World "Beauty & Fragrances" (owner, 8 Nov
// 2026: "feed download and import"). New on every site. Feed facts (feed-profile 8 Nov 2026): two feeds (97041 "Skincare",
// 97074 "Haircare Products") with the same 51 products, GBP, shop silvercloudbeauty.com, brands "Silver Cloud" and
// "My Store" (6, the shop's default, shown as Silver Cloud). Products: satin pillowcases, sleep masks and gift sets
// infused with silver ions, for skin and hair. One card per product page: the planner joins the two feeds (L63).
export const RULES = {
  key: 'silvercloud',
  advertiserId: 102901,
  retailer: 'Silver Cloud Beauty',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?silvercloudbeauty\.com\//i,
  sites: ['wgw'],
  maxPrice: 300,
  keepQuery: true
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._-]{2,180}$/.test(path)) return path;
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

export function displayBrand(brand) {
  return /^my store$/i.test(String(brand || '').trim()) || !brand ? 'Silver Cloud' : String(brand).trim();
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const NOT_PRODUCT = words(['gift card', 'gift voucher', 'e-gift', 'voucher', 'shipping', 'insurance', 'sample']);

export function classify({ name }) {
  const n = String(name || '');
  if (NOT_PRODUCT.test(n)) return { reject: 'gift card or service, not a product' };
  if (/\b(gift set|set)\b/i.test(n)) return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Gift sets' };
  if (/\b(serum|cream|moisturi[sz]er|cleanser|toner|mask)\b/i.test(n) && !/\b(sleep|eye) mask\b/i.test(n)) {
    return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Skincare' };
  }
  return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: 'Beauty tools' };
}
