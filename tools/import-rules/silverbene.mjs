// Import rules for Silverbene (Awin advertiser 91177 "Shenzhen Shibao Jewelry Co., Ltd.", silverbene.com) on Women's and
// Men's Gear World (13 Nov 2026, lessons L117, L120). New on every site. Feed 105959 (13 Nov 2026): 3,649 products, all in
// stock, prices in US dollars ($0.62 to $482.62, middle $6.98), no brand and no category: 925 sterling silver rings,
// earrings, necklaces, pendants and bracelets. The shop's shipping page (13 Nov 2026): ePacket to the United Kingdom,
// the United States and other countries, DHL worldwide.
//  - Women's (and unnamed) jewellery -> WGW "Women's Jewellery"; "men's" in the name -> MGW "Men's Jewellery" (the sites'
//    own names, L56). Subcategory by the name: Rings, Earrings, Necklaces, Bracelets, else Jewellery.
//  - Left out: jewellery-making parts (clasps, jump rings, beads, findings, chain by the metre), boxes and tools, and
//    anything under $8 (tiny wholesale parts and single charms).
export const RULES = {
  key: 'silverbene',
  advertiserId: 91177,
  retailer: 'Silverbene',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?silverbene\.com\//i,
  sites: ['wgw', 'mgw'],
  maxPrice: 600,
  minPrice: 8
};

export function displayBrand() {
  return 'Silverbene';
}

export function displayName(name) {
  let s = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (/[A-Z]{3}/.test(s) && s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  return s;
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const PARTS = W(['findings?', 'clasps?', 'jump rings?', 'split rings?', 'bead caps?', 'spacers?', 'spacer beads?', 'loose beads?', 'beads?(?! (?:bracelets?|necklaces?|earrings?))', 'bails?', 'crimps?',
  'ear ?wires?', 'earring hooks?', 'earring backs?', 'ear nuts?', 'stoppers?', 'blanks?', 'diy', 'jewel(?:le)?ry making', 'by the (?:meter|metre|foot|feet)']);
// "Box Chain Necklace" is a chain style: only jewellery and gift boxes are left out.
const NOT_JEWELLERY = W(['jewel(?:le)?ry box(?:es)?', 'gift box(?:es)?', 'ring box(?:es)?', 'storage box(?:es)?', 'pouch(?:es)?', 'display stands?', 'polishing cloth', 'cleaner', 'tools?', 'pliers', 'gift card']);
const MEN = W(["men'?s", 'mens', 'for men', 'male', 'masculine']);
const SUBS = [
  ['Jewellery', W(['nose', 'belly', 'navel', 'tongue', 'septum', 'cartilage', 'piercing', 'body jewel(?:le)?ry', 'toe rings?', 'jewel(?:le)?ry sets?',
    '(?:necklace|earrings?|ring|bracelet)s? (?:and|&) (?:necklace|earrings?|ring|bracelet)s?'])],
  ['Earrings', W(['earrings?', 'ear cuffs?', 'ear climbers?', 'studs?', 'hoops?', 'huggies?'])],
  ['Rings', W(['rings?', 'band'])],
  ['Necklaces', W(['necklaces?', 'pendants?', 'chokers?', 'chains?', 'lockets?'])],
  ['Bracelets', W(['bracelets?', 'bangles?', 'anklets?', 'cuffs?'])]
];

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (PARTS.test(n)) return { reject: 'jewellery-making part, not jewellery to wear' };
  if (NOT_JEWELLERY.test(n)) return { reject: 'box, tool or gift card, not jewellery' };
  let sub = 'Jewellery';
  for (const [label, re] of SUBS) if (re.test(n)) { sub = label; break; }
  if (sub === 'Jewellery' && !/\b(charms?|brooch(?:es)?|jewel(?:le)?ry|sets?|silver|gold)\b/i.test(n)) return { reject: 'no clear kind of jewellery in the name' };
  if (MEN.test(n)) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: sub };
  return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: sub };
}
