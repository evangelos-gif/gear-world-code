// Import rules for Swan & Edgar (CJ Affiliate advertiser 7983236) on Men's and Women's Gear World (1 Nov 2026, lessons L88).
// A British watch brand (swanandedgar.com, GBP) that accepted us on CJ on 1 Nov 2026. Its catalogue comes from the CJ
// product search API (tools/cj-feed-download.ps1 -> CJ_7983236.csv.gz); each card's link is its CJ tracking link (L86).
// The places already exist (lessons L56): MGW Watches > Men's Watches / Unisex Watches / Watches, WGW Watches > Watches.
//  - Men's and plain watches -> MGW Men's Watches; "unisex" -> MGW Unisex Watches; ladies' / women's -> WGW Watches.
//  - Straps, winders and watch boxes -> MGW Watches > Watches.
//  - Out: gift cards, engraving and warranty services, spare parts.
// The site name is "Swan and Edgar": the import tools refuse "&" in a database command (Invoke-Wrangler).
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'swan-edgar',
  network: 'cj',
  advertiserId: 7983236,
  retailer: 'Swan and Edgar',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?swanandedgar\.(com|co\.uk)\//i,
  sites: ['mgw', 'wgw'],
  maxPrice: 5000
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const NOT_A_PRODUCT = words(['gift card', 'gift voucher', 'voucher', 'e-gift', 'engraving', 'warranty', 'insurance', 'service', 'servicing', 'repair',
  'battery replacement', 'spare part', 'replacement crown', 'gift wrap', 'gift wrapping', 'shipping', 'delivery']);
const FOR_HER = words(['ladies', "ladies'", "women's", 'womens', 'women', 'woman', 'for her', 'her']);
const UNISEX = words(['unisex']);
const ACCESSORY = words(['strap', 'straps', 'bracelet strap', 'nato', 'winder', 'watch winder', 'watch box', 'watch roll', 'watch case', 'travel case',
  'cufflinks', 'pouch']);
const WATCH = words(['watch', 'watches', 'automatic', 'chronograph', 'quartz', 'mechanical', 'dress watch', 'diver', 'gmt', 'world timer', 'day date', 'skeleton']);

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  const cat = String(feedCategory || '');
  if (NOT_A_PRODUCT.test(n)) return { reject: 'a service, part or gift card, not a product' };
  if (ACCESSORY.test(n) && !WATCH.test(n.replace(/watch (winder|box|roll|case)s?/gi, ' '))) return { site: 'mgw', siteCategory: 'Watches', subcategory: 'Watches' };
  if (FOR_HER.test(n) || FOR_HER.test(cat)) return { site: 'wgw', siteCategory: 'Watches', subcategory: 'Watches' };
  if (UNISEX.test(n) || UNISEX.test(cat)) return { site: 'mgw', siteCategory: 'Watches', subcategory: 'Unisex Watches' };
  if (WATCH.test(n)) return { site: 'mgw', siteCategory: 'Watches', subcategory: "Men's Watches" };
  // A watch brand: a model name without a product word is most likely a watch; listed in the report for checking.
  return { site: 'mgw', siteCategory: 'Watches', subcategory: "Men's Watches", doubt: true };
}
