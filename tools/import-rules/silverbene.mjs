// Import rules for Silverbene (Awin advertiser 91177 "Shenzhen Shibao Jewelry Co., Ltd.", silverbene.com) on Women's and
// Men's Gear World (13 Nov 2026, lessons L117, L120). New on every site. Feed 105959 (13 Nov 2026): 3,649 products, all in
// stock, prices in US dollars ($0.62 to $482.62, middle $6.98), no brand and no category: 925 sterling silver rings,
// earrings, necklaces, pendants and bracelets. The shop's shipping page (13 Nov 2026): ePacket to the United Kingdom,
// the United States and other countries, DHL worldwide.
//  - Women's (and unnamed) jewellery -> WGW "Women's Jewellery"; "men's" in the name -> MGW "Men's Jewellery" (the sites'
//    own names, L56). Subcategory by the name: Rings, Earrings, Necklaces, Bracelets, else Jewellery.
//  - Left out: jewellery-making parts (clasps, jump rings, loose beads, findings, chain by the metre), boxes and tools, and
//    anything under $8 (2,158 of the 3,649 on 13 Nov 2026: tiny wholesale parts and single charms).
//  - Dry run of 13 Nov 2026: the kind named LAST in the name decides ("Men's Chain ... Bracelet" is a bracelet); MGW has
//    no Rings subcategory (its rings are under Men's Jewellery > Jewellery).
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

// Typing slips of the feed: "Fashion n CZ ...", "Fashion nable", "Sterling Sliver", "Pedant".
export function displayName(name) {
  let s = String(name || '').replace(/\s{2,}/g, ' ').trim();
  if (/[A-Z]{3}/.test(s) && s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  return s.replace(/\bFashion nable\b/g, 'Fashionable').replace(/\bFashion n\b\s*/g, 'Fashion ').replace(/\bSliver\b/g, 'Silver').replace(/\bPedant(s?)\b/g, 'Pendant$1').trim();
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const G = re => new RegExp(re.source, 'gi');
// Parts for making jewellery: left out whatever else the name says.
const PARTS = W(['findings?', '(?:lobster|spring ring|toggle|magnetic|bayonet) clasps?', 'clasps? (?:for|only)', 'jump rings?', 'split rings?', 'bead caps?', 'spacer beads?', 'loose beads?', 'ear ?wires?', 'earring hooks?',
  'earring backs?', 'ear nuts?', 'jewel(?:le)?ry making', 'by the (?:meter|metre|foot|feet)']);
const TOOLS = W(['tools?', 'gauges?', 'sizers?', 'pliers', 'polishing cloth', 'cleaner', 'gift card']);
// Left out only when they are the last thing the name names ("Silver Ring Box"), not in "Gift Box ... Studs Earrings" or
// "Bead Flower ... Promise Ring" (dry run of 13 Nov 2026).
const WEAK = W(['clasps?', 'beads?', 'bails?', 'crimps?', 'stoppers?', 'blanks?', 'spacers?', 'connectors?', 'jewel(?:le)?ry box(?:es)?', 'gift box(?:es)?', 'ring box(?:es)?',
  'storage box(?:es)?', 'box(?:es)?$', 'pouch(?:es)?', 'display stands?']);
const MEN = W(["men'?s", 'mens', 'for men', 'male', 'masculine']);
// A bare "Men" ("Skull Pendant Men", "Men Chain Necklace") is men's too, but not "Women/Men" or "Promise Ring/Men Couples"
// (first import, 13 Nov 2026: 2-3 men's pendants and bracelets had gone to WGW).
const BARE_MEN = W(['men']);
const isMen = n => MEN.test(n) || (BARE_MEN.test(n) && !/women|couples?|unisex/i.test(n));
const SPECIAL = W(['nose', 'belly', 'navel', 'tongue', 'septum', 'cartilage', 'piercing', 'body jewel(?:le)?ry', 'toe rings?', 'jewel(?:le)?ry sets?', 'diy',
  '(?:necklace|earrings?|ring|bracelet)s? (?:and|&) (?:necklace|earrings?|ring|bracelet)s?']);
const KINDS = [
  ['Earrings', W(['earrings?', 'ear cuffs?', 'ear climbers?', 'studs?', 'hoops?', 'huggies?'])],
  ['Rings', W(['rings?', 'bands?', 'signet'])],
  ['Necklaces', W(['necklaces?', 'pendants?', 'chokers?', 'chains?', 'lockets?'])],
  ['Bracelets', W(['bracelets?', 'bangles?', 'anklets?', 'cuffs?'])],
  ['Jewellery', W(['charms?', 'brooch(?:es)?'])]
];

// The kind named last in the name is what the piece is ("Ring And Circle Ring ... Men's Necklace" is a necklace); at the
// same end, the longer words win ("Ear Cuff" is earrings, not a bracelet cuff).
export function lastKind(n) {
  let best = null;
  for (const [label, re] of KINDS) {
    for (const m of n.matchAll(G(re))) {
      const end = m.index + m[0].length;
      if (!best || end > best.end || (end === best.end && m[0].length > best.len)) best = { label, end, len: m[0].length };
    }
  }
  return best;
}

function lastEnd(n, re) {
  let end = -1;
  for (const m of n.matchAll(G(re))) end = Math.max(end, m.index + m[0].length);
  return end;
}

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (PARTS.test(n)) return { reject: 'jewellery-making part, not jewellery to wear' };
  if (TOOLS.test(n)) return { reject: 'tool or gift card, not jewellery' };
  const kind = lastKind(n);
  if (!kind) return { reject: WEAK.test(n) ? 'jewellery-making part or box, not jewellery to wear' : 'no clear kind of jewellery in the name' };
  if (lastEnd(n, WEAK) > kind.end) return { reject: 'jewellery-making part or box, not jewellery to wear' };
  // Body jewellery, sets and charms for charm bracelets (DIY) are "Jewellery".
  const sub = SPECIAL.test(n) ? 'Jewellery' : kind.label;
  // Men's Gear World has no Rings or Earrings subcategory: those go under its "Jewellery" (L56).
  if (isMen(n)) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: sub === 'Rings' || sub === 'Earrings' ? 'Jewellery' : sub };
  return { site: 'wgw', siteCategory: "Women's Jewellery", subcategory: sub };
}
