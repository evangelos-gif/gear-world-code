// Import rules for Dream Pairs, Bruno Marc, Nortiv 8 & Allswift Shoes (CJ Affiliate advertiser 6258731, dreampairs.com)
// on Women's, Men's and Kids' Gear World. Joined 12-13 Nov 2026. Feed facts (14 Nov 2026, price bands L129): about
// 45,000-48,000 rows in USD = colour and size options of about 1,850 pages; sections "Heel Sandals", "Pumps", "Kids Boots",
// "Flats", "Wedge Sandals", "Knee-High Boots", "Ankle Boots", "Loafers", "Sneakers", "Snow Boots", "Oxfords" ...;
// names such as "NORTIV 8 Men s Wide Toe Box Insulated Snow Boots" (the feed loses the apostrophe).
// Delivery: the United States (L62 check of 13 Nov 2026): deliversTo US on the three sites (round 2b, lessons L107).
export const RULES = {
  key: 'dreampairs',
  network: 'cj',
  advertiserId: 6258731,
  retailer: 'Dream Pairs',
  currency: 'USD',
  // The feed links four shops: dreampairs.com, brunomarc.com, nortiv8shoes.com and allswifit.com (first plan: 331 left out).
  shop: /^https:\/\/(www\.)?(dreampairs|brunomarc|nortiv8|allswifit|allswift)[a-z]*\.com\//i,
  sites: ['wgw', 'mgw', 'kgw'],
  maxPrice: 400,
  minPrice: 10
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no link */ }
  return String(get('parent_product_id') || get('merchant_product_id') || '').trim();
}

// "Men s", "Women   s" -> "Men's", "Women's"; double spaces out. The brand in capitals at the start ("DREAM PAIRS Ankle
// Strap Sandals", "BRUNO MARC Men s Oxfords") is the card's brand line already, so it leaves the name (dry run of 14 Nov).
const BRAND_PREFIX = /^(?:DREAM PAIRS|BRUNO MARC|NORTIV ?8|ALLSWIFT)\s+/i;
export function displayName(name) {
  return String(name || '').replace(/\b(Men|Women|Kid|Boy|Girl)\s+s\b/gi, "$1's").replace(/\s{2,}/g, ' ').trim().replace(BRAND_PREFIX, '');
}

export function displayBrand(brand) {
  const b = String(brand || '').trim().toUpperCase();
  return b === 'BRUNO MARC' ? 'Bruno Marc' : b === 'NORTIV 8' ? 'Nortiv 8' : b === 'ALLSWIFT' ? 'Allswift' : 'Dream Pairs';
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
// Whole words only: "Western Cowboy Boots" are not boys' boots (local check of 14 Nov 2026: 149 cowboy boots, women's and
// Bruno Marc men's among them, went to KGW by "boy").
const KIDS = W(['kids?', "kid's", 'boys?', "boy's", "boys'", 'girls?', "girl's", "girls'", 'toddlers?', 'little kids?', 'big kids?', 'children', "children's", 'youth']);
// Shoes only: the feed also has Bruno Marc T-shirts, polo shirts, belts, socks and wallets and a tote bag (sections "OTHERS",
// "ACCESSORIES", "Belts", "Wallets", "Bags"). A shoe there keeps its place ("Breathable Casual Sneakers" in "OTHERS"), and so
// does a boot named without the word ("DualStride ... Mid WaterproofPRO" in "Hiking").
const FOOTWEAR = W(['shoes?', 'boots?', 'booties', 'sneakers?', 'trainers?', 'sandals?', 'slides?', 'flip ?flops?', 'slippers?', 'loafers?',
  'oxfords?', 'pumps?', 'heels?', 'wedges?', 'mules?', 'flats?', 'clogs?', 'moccasins?', 'derby', 'brogues?', 'espadrilles?', 'mary ?janes?', 'slip-?ons?', 'cleats?']);
const NOT_FOOTWEAR = W(['belts?', 'wallets?', 't ?-?shirts?', 'shirts?', 'polo', 'tees?', 'socks?', 'bags?', 'totes?', 'hats?', 'caps?', 'jackets?', 'hoodies?', 'pants', 'shorts']);
const OTHER_SECTION = /^(?:accessories|others|belts|wallets|bags)$/i;

function sub(n, c, site) {
  const t = n + ' | ' + c;
  // KGW has no "Slippers" (dry run of 14 Nov 2026, L56): its slippers are in "Shoes" (InStock), so these too.
  if (W(['slippers?']).test(t)) return site === 'kgw' ? 'Shoes' : 'Slippers';
  if (W(['sandals?', 'slides?', 'flip ?flops?']).test(t)) return site === 'kgw' ? 'Shoes' : 'Sandals';
  // KGW: children's boots are "Winter Boots" (Manager, plan of 14 Nov 2026 17:10), next to Coes and Camping World.
  if (W(['boots?', 'booties']).test(t)) return site === 'kgw' ? 'Winter Boots' : 'Boots';
  if (W(['sneakers?', 'trainers?', 'running', 'walking shoes?', 'athletic', 'tennis shoes?']).test(t)) return 'Trainers';
  if (site === 'wgw' && W(['heels?', 'pumps?', 'stilettos?', 'wedges?', 'platform heels?']).test(t)) return 'Heels';
  return 'Shoes';
}

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  const c = String(feedCategory || '');
  if (!n) return { reject: 'no name' };
  if (/gift card|shipping protection|insurance|insoles? only|shoe care|\bshoe ?laces?\b/i.test(n)) return { reject: 'gift card, protection or shoe care' };
  if (!FOOTWEAR.test(n) && (NOT_FOOTWEAR.test(n) || OTHER_SECTION.test(c.trim()))) return { reject: 'not footwear (T-shirts, belts, socks, wallets, bags)' };
  // "Women's Inner Zipper Chelsea Boots" in "Kids Boots" is a women's boot: the name wins over the section.
  if (KIDS.test(n) || (KIDS.test(c) && !/\b(?:wo)?men'?s?\b/i.test(n))) return { site: 'kgw', siteCategory: 'Shoes', subcategory: sub(n, c, 'kgw') };
  if (/\bmen'?s\b|\bmens\b|\bfor men\b/i.test(n) && !/women/i.test(n)) return { site: 'mgw', siteCategory: 'Shoes', subcategory: sub(n, c, 'mgw') };
  if (/^bruno marc/i.test(n) && !/women/i.test(n)) return { site: 'mgw', siteCategory: 'Shoes', subcategory: sub(n, c, 'mgw') };
  return { site: 'wgw', siteCategory: 'Shoes', subcategory: sub(n, c, 'wgw') };
}
