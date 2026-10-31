// Import rules for XPLORA UK (CJ Affiliate advertiser 5175167) on Kids' Gear World (31 Oct 2026, lessons L86).
// The first CJ shop: accepted us on 31 Oct 2026 (5% commission, 30-day cookie, parents of children aged 4-11).
// Its catalogue comes from the CJ product search API (tools/cj-feed-download.ps1 -> CJ_5175167.csv.gz, Awin column names).
// The CJ tracking link of each product is the card's link: a product without one stays out (it would not pay).
// KGW already has the places: Kids Tech > Kids Smartwatches (Plusshop, Bazta) and Kids Tech > Kids Tech (lessons L56).
//  - In: kids' smartwatches and watch phones (X6Play, X5 Play, XGO, XJR ...), their straps, chargers and cases.
//  - Out: SIM cards, airtime and data plans, insurance and warranties, gift cards (services, not products).
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'xplora',
  network: 'cj',
  advertiserId: 5175167,
  retailer: 'XPLORA UK',
  currency: 'GBP',
  shop: /^https:\/\/(www\.|shop\.)?xplora\.(co\.uk|com)\//i,
  sites: ['kgw'],
  maxPrice: 500
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const NOT_A_PRODUCT = words(['gift card', 'gift voucher', 'voucher', 'e-gift', 'sim card', 'sim only', 'sim-only', 'nano sim', 'airtime', 'top up', 'top-up',
  'data plan', 'tariff', 'subscription', 'contract', 'insurance', 'warranty', 'extended warranty', 'protection plan', 'care plan', 'gift wrap', 'gift wrapping',
  'donation', 'shipping', 'delivery']);
const ACCESSORY = words(['strap', 'straps', 'band', 'bands', 'charger', 'chargers', 'charging cable', 'charging clip', 'cable', 'case', 'cover', 'bumper',
  'screen protector', 'screen protectors', 'lanyard', 'holder', 'clip', 'dock', 'adapter', 'plug', 'spare']);
const WATCH = /\b(smart ?watch(es)?|watch ?phones?|kids'? watch(es)?|children'?s watch(es)?|gps watch(es)?)\b|\bx[56] ?play\b|\bxgo ?\d*\b|\bxjr\b|\bx6\b|\bx5\b|\bxmove\b|\bxplora ?x\d/i;
const PHONE_OR_TRACKER = words(['phone', 'mobile', 'tracker', 'gps tracker', 'xtag', 'x-tag', 'tag']);
const WATCH_CATEGORY = /watch|wearable/i;
// Models named without a product word (first download, 31 Oct 2026: 9 rows, 4 products): XploraOne and the HMD Fusion X1
// phone that Xplora sells with its parental app. Both go to Kids Tech (no watch is claimed for them).
const OWN_MODELS = /\bxplora ?one\b|\bhmd fusion\b|\bfusion x1\b/i;

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  const cat = String(feedCategory || '');
  if (NOT_A_PRODUCT.test(n)) return { reject: 'a service, plan or gift card, not a product' };
  // "Strap for X6Play" is an accessory even though it names the watch.
  if (ACCESSORY.test(n) && !/\b(with|incl\.?|including|\+)\s+(strap|charger)/i.test(n)) return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: 'Kids Tech' };
  if (WATCH.test(n)) return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: 'Kids Smartwatches' };
  if (OWN_MODELS.test(n)) return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: 'Kids Tech' };
  if (PHONE_OR_TRACKER.test(n)) return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: 'Kids Tech' };
  if (WATCH_CATEGORY.test(cat)) return { site: 'kgw', siteCategory: 'Kids Tech', subcategory: 'Kids Smartwatches', doubt: true };
  return { reject: 'not sure what it is (no watch, phone or accessory word in the name)' };
}
