// Import rules for Al Jazeera Perfumes UK (Awin advertiser 128425, feed 116358) on Women's Gear World "Beauty &
// Fragrances" > "Fragrance" (owner, 8 Nov 2026: "feed download and import"). New on every site.
// Feed facts (feed-profile 8 Nov 2026): 169 perfumes, GBP, shop uk.aljazeeraperfumes.com, category "Health & Beauty >
// Personal Care > Cosmetics > Perfume & Cologne", brands ALJAZEERA PERFUMES (124), ORYX PERFUMES (24), LUXURY COLLECTION
// (21). The feed names are only the scent ("LOS ANGELES", "MOSCOW", "ONYX"): the card name adds the brand, in normal
// case ("Al Jazeera Perfumes Los Angeles"), so a visitor knows what it is.
export const RULES = {
  key: 'aljazeera',
  advertiserId: 128425,
  retailer: 'Al Jazeera Perfumes',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?aljazeeraperfumes\.com\//i,
  sites: ['wgw'],
  maxPrice: 600,
  keepQuery: true
};

export function productKey(get) {
  return String(get('merchant_product_id') || '').trim();
}

const SMALL = new Set(['and', 'of', 'the', 'de', 'du', 'la', 'le', 'by', 'for', 'with', 'in', 'on']);
export function titleCase(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim().split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w)) ? w : w.replace(/^(\p{L})/u, c => c.toUpperCase()).replace(/-(\p{L})/gu, (m, c) => '-' + c.toUpperCase()))
    .join(' ');
}

export function displayBrand(brand) {
  const b = titleCase(brand);
  if (/^aljazeera perfumes$/i.test(b) || !b) return 'Al Jazeera Perfumes';
  return b;
}

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const NOT_PRODUCT = words(['gift card', 'gift voucher', 'e-gift', 'voucher', 'shipping', 'insurance', 'sample', 'samples', 'tester', 'testers']);

export function classify({ name, brand = '' }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (NOT_PRODUCT.test(n)) return { reject: 'gift card, sample or service, not a product' };
  const b = displayBrand(brand);
  const scent = titleCase(n);
  // "ORYX PERFUMES" + "AMBER" -> "Oryx Perfumes Amber"; a name that already has the brand keeps it once.
  const card = scent.toLowerCase().startsWith(b.toLowerCase()) ? scent : `${b} ${scent}`;
  const sub = /\b(gift set|set|bundle|collection box)\b/i.test(n) ? 'Gift sets' : 'Fragrance';
  return { site: 'wgw', siteCategory: 'Beauty & Fragrances', subcategory: sub, name: card };
}
