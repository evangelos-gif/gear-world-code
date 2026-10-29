// Import rules for Angel Barocco (Awin advertiser 70252) on Women's Gear World, "Women's Jewellery" (29 Oct 2026).
// Owner joined the programme on 29 Oct 2026. The shop (London) makes freshwater pearl and 925 sterling silver jewellery.
// Feed facts (feed sample 29 Oct 2026): one feed (115384), 2,417 rows, one row per option (colour, initial letters), GBP,
// no categories, stock_quantity per option (0 = sold out), links to angel-barocco-8095.myshopify.com (the shop's Shopify
// address, which opens angelbarocco.com). One card per product page, at the lowest in-stock option price.
// WGW's own subcategory names (lessons L56): Earrings, Necklaces, Bracelets, Rings, Jewellery.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'angelbarocco',
  advertiserId: 70252,
  retailer: 'Angel Barocco',
  currency: 'GBP',
  shop: /^https:\/\/(angel-barocco-8095\.myshopify\.com|(www\.)?angelbarocco\.com)\//i,
  sites: ['wgw'],
  maxPrice: 1500
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');

const NOT_PRODUCT = words(['gift card', 'gift voucher', 'e-gift', 'voucher', 'shipping protection', 'insurance', 'jewellery box', 'jewelry box', 'gift box', 'gift bag', 'polishing cloth']);
const MEN = words(['men', "men's", 'mens', 'for him', 'gents']);
const SET = words(['set', 'sets', 'duo', 'trio', 'gift set']);
export const EARRINGS = words(['earring', 'earrings', 'hoop', 'hoops', 'stud', 'studs', 'huggie', 'huggies', 'ear cuff', 'ear cuffs', 'ear climber', 'ear climbers', 'ear jacket', 'ear jackets',
  'threader', 'threaders', 'drops', 'drop earrings']);
export const BRACELETS = words(['bracelet', 'bracelets', 'bangle', 'bangles', 'anklet', 'anklets', 'cuff']);
export const NECKLACES = words(['necklace', 'necklaces', 'pendant', 'pendants', 'choker', 'chokers', 'locket', 'lockets', 'chain', 'chains', 'lariat']);
export const RINGS = words(['ring', 'rings']);
export const JEWELLERY = words(['earring', 'earrings', 'bracelet', 'bracelets', 'bangle', 'anklet', 'necklace', 'pendant', 'choker', 'locket', 'ring', 'rings',
  'brooch', 'charm', 'charms', 'hair pin', 'hair clip', 'jewellery', 'jewelry', 'pearl', 'pearls', 'stud', 'studs', 'hoops', 'chain', 'ear jacket', 'ear jackets',
  'ear cuff', 'ear cuffs', 'huggie', 'huggies', 'threader', 'threaders']);

// The subcategory of one piece: a set of two kinds is "Jewellery"; otherwise the kind the name says first wins in this
// order, so "Pearl Drop Earrings" are earrings and a "Chain Bracelet" is a bracelet.
export function jewellerySub(name) {
  const n = String(name || '');
  const kinds = [EARRINGS, BRACELETS, NECKLACES, RINGS].filter(re => re.test(n)).length;
  if (SET.test(n) && kinds > 1) return 'Jewellery';
  if (EARRINGS.test(n)) return 'Earrings';
  if (BRACELETS.test(n)) return 'Bracelets';
  if (NECKLACES.test(n)) return 'Necklaces';
  if (RINGS.test(n)) return 'Rings';
  return 'Jewellery';
}

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name }) {
  const n = String(name || '');
  if (NOT_PRODUCT.test(n)) return { reject: 'gift card, packaging or service, not jewellery' };
  if (MEN.test(n)) return { reject: "men's jewellery (not in this plan)" };
  if (!JEWELLERY.test(n)) return { reject: 'not sure it is jewellery (no jewellery word in the name)' };
  return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: jewellerySub(n) };
}
