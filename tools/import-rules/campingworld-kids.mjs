// Import rules for Camping World UK (Awin advertiser 124426, feed 114026, campingworld.co.uk) children's winter boots and
// wellies on Kids' Gear World: Shoes > Winter Boots (Manager, plan of 14 Nov 2026 17:10). Camping World is on Travel Gear
// World (sources.json, campingShop); on KGW only its children's boots come in. Feed of 9-14 Nov 2026: 33 rows (sizes) of
// about 13 boots: Wild Tribe and VW wellingtons, Olang Zaza and Patty snow boots, Regatta and Hi-Tec walking boots,
// GBP 6.99-20.00. A UK shop (default deliversTo GB on KGW).
export const RULES = {
  key: 'campingworld-kids',
  advertiserId: 124426,
  retailer: 'Camping World UK',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?campingworld\.co\.uk\//i,
  sites: ['kgw'],
  maxPrice: 300,
  minPrice: 3,
  // A new shop on KGW, but only this part of it: nothing else of Camping World is on KGW to hide.
  addOnly: true
};

// One card per product page (".../en/gb/Olang-Zaza-Kids-Snow-Boots/m-6096"): the rows are its sizes. On KGW the
// merchant id is the unique key, so it is the page, the same on every run.
export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const KIDS = W(['kids?', "kid's", 'boys?', "boy's", 'girls?', "girl's", 'junior', 'juniors', 'jnr', 'children', "children's", 'childrens', 'child', 'infants?',
  'toddlers?', 'youth']);
const BOOTS = W(['boots?', 'booties', 'wellies', 'welly', 'wellie', 'wellingtons?', 'snow ?boots?']);
const ADULT = W(["women'?s", 'womens', 'ladies', "men'?s", 'mens']);

export function displayName(name) { return String(name || '').replace(/\bHi Tec\b/g, 'Hi-Tec').replace(/\s{2,}/g, ' ').trim(); }

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (!KIDS.test(n) || ADULT.test(n)) return { reject: 'not for children (only children\'s boots come to KGW)' };
  if (!BOOTS.test(n) || /boot (?:socks?|bags?|dryer|liners?)/i.test(n)) return { reject: 'not a boot or welly (only children\'s boots come to KGW)' };
  return { site: 'kgw', siteCategory: 'Shoes', subcategory: 'Winter Boots' };
}
