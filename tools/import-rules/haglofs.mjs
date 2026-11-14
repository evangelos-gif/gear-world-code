// Import rules for Haglöfs (CJ Affiliate advertiser 5531758, haglofs.com) on Men's and Women's Gear World (14 Nov 2026,
// lessons L129). Joined 12 Nov 2026 (5%, 30-day cookie). The CJ catalogue has one copy of every product per country
// (72,031 rows: GB in pounds, NL/DE/FR/BE ... in euros); only the British one comes in: pages haglofs.com/en/ in GBP
// (8,980 rows = one row per colour and size, 639 styles, names such as "Korp Proof Jacket Women", "Rosson Down Hood Men").
// The euro copies wait for the sites' delivery countries (deliversTo), like every shop outside the UK.
//  - "Women" in the name -> WGW, "Men" -> MGW; things for both (backpacks, caps, beanies, belts, gloves) -> MGW
//    Bags & Accessories. Children's ("Junior", "Kids") stay out for now (KGW has no outdoor clothing place yet).
//  - One card per style (all colours and sizes), at the lowest in-stock price; the card name without "Men"/"Women".
//  - Out: shoelaces, sleeping bags and other camping gear (Sporty/Travel later), gift cards.
export const RULES = {
  key: 'haglofs',
  network: 'cj',
  advertiserId: 5531758,
  // legacy-import.ps1 takes only A-Z, digits, space, dot and dash in the shop name it hands to wrangler (L63): "Haglofs" in
  // the database; the brand on every card is Haglöfs.
  retailer: 'Haglofs',
  currency: 'GBP',
  shop: /^https:\/\/www\.haglofs\.com\/en\//i,
  sites: ['mgw', 'wgw'],
  maxPrice: 900,
  minPrice: 15
};

// Only the British rows: the same style id is in every country's catalogue, so without this a card could take a euro
// price or a Dutch page (first plan, 14 Nov 2026: 40 cards with a /nl/ or /de/ link). A row of another country gives no
// columns at all, and the planner skips a row without an id.
export function field(c, column) {
  if (!RULES.shop.test(column('merchant_deep_link')) || column('currency').toUpperCase() !== 'GBP') return '';
  return column(c);
}

export function displayBrand() { return 'Haglöfs'; }

export function displayName(name) {
  return String(name || '').replace(/^Hagl(?:ö|o)fs\s+/i, '').replace(/\s+(?:Men|Women|Unisex)\s*$/i, '').replace(/\s{2,}/g, ' ').trim();
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const WOMEN = /\bWomen\b/;
const MEN = /\bMen\b/;
const KIDS = W(['junior', 'kids?', 'children', 'youth']);
const OUT = W(['shoe ?laces?', 'laces?', 'sleeping bags?', 'tents?', 'sleeping mats?', 'mats?', 'poles?', 'gift ?cards?', 'vouchers?', 'repair kit', 'patch kit']);

function place(women, n, cat) {
  const acc = { siteCategory: 'Bags & Accessories' };
  const garment = W(['jackets?', 'pants?', 'trousers?', 'shorts', 'hood', 'parka', 'vest', 'tee', 'shirt', 'tights']).test(n);
  if (/shoes|boots/i.test(cat) || W(['shoes?', 'boots?', 'trainers?', 'sneakers?', 'sandals?']).test(n) || /\b(?:low|mid) (?:gtx|men|women)?\b/i.test(n) && /shoe|boot/i.test(cat))
    return { siteCategory: 'Shoes', subcategory: W(['boots?', 'mid']).test(n) ? 'Boots' : W(['sandals?']).test(n) ? 'Sandals' : W(['trail', 'running']).test(n) ? 'Trainers' : 'Shoes' };
  // Before the litre test: "Packing cube 12L" goes with "LO Packing cubes" (dry run 14 Nov 2026, L132).
  if (W(['packing cubes?']).test(n)) return { ...acc, subcategory: 'Accessories' };
  if (/backpack|daypack|bags|duffel/i.test(cat) || W(['backpacks?', 'daypack', 'bags?', 'duffel', 'duffle', 'hip ?pack', 'waist ?pack', 'running belt', 'pack \\d+', 'raincover', 'rain cover']).test(n)
    || (!garment && /\b\d{1,2}(?:,\d)?\s?L\b/.test(n))) return { ...acc, subcategory: 'Bags' };
  // The sites' own subcategory names (lessons L56, dry run of 14 Nov 2026: Wallets, Keyrings and Travel Accessories were new).
  if (W(['wallets?']).test(n)) return { ...acc, subcategory: women ? 'Accessories' : 'Wallets & Purses' };
  if (W(['key ?rings?', 'keyrings?']).test(n)) return women ? { ...acc, subcategory: 'Accessories' } : { siteCategory: 'Everyday Carry / EDC', subcategory: 'Everyday Carry / EDC' };
  if (W(['packing cubes?', 'pouch', 'wash ?bag']).test(n)) return { ...acc, subcategory: 'Accessories' };
  if (W(['slippers?']).test(n)) return { siteCategory: 'Shoes', subcategory: 'Shoes' };
  if (W(['multitube', 'tube', 'bandana', 'scarf', 'neck ?warmer']).test(n)) return { ...acc, subcategory: 'Hats' };
  if (/beanies|hats|caps/i.test(cat) || W(['beanie', 'caps?', 'hats?', 'headband', 'neck ?gaiter', 'balaclava', 'buff']).test(n)) return { ...acc, subcategory: 'Hats' };
  if (/gloves/i.test(cat) || W(['gloves?', 'mittens?', 'mitts?']).test(n)) return { ...acc, subcategory: 'Gloves' };
  if (/belts/i.test(cat) || W(['belts?']).test(n)) return { ...acc, subcategory: 'Belts' };
  if (W(['socks?']).test(n)) return { siteCategory: 'Clothing', subcategory: 'Socks' };
  const sub = (() => {
    if (W(['dress(?:es)?']).test(n)) return women ? 'Dresses' : 'Clothing';
    if (W(['skirts?', 'skorts?']).test(n)) return women ? 'Skirts' : 'Shorts';
    if (W(['tights', 'leggings?']).test(n)) return women ? 'Leggings' : 'Trousers';
    if (/jackets|parkas|vests/i.test(cat) || W(['jackets?', 'parka', 'anorak', 'vest', 'gilet', 'shell', 'down hood', 'insulated hood', 'mimic hood', 'coat']).test(n)) return women ? 'Jackets & Coats' : 'Jackets';
    if (W(['shorts']).test(n) || /shorts/i.test(cat)) return 'Shorts';
    if (/trousers|bottoms/i.test(cat) || W(['pants?', 'trousers?', 'bibs?', 'zip-off']).test(n)) return 'Trousers';
    if (W(['hood', 'hoodie']).test(n)) return 'Hoodies';
    if (/fleece|midlayer|pullover/i.test(cat) || W(['fleece', 'half zip', '1\\/2 zip', 'quarter zip', 'mid', 'jumper', 'sweater', 'crew']).test(n)) return 'Sweatshirts';
    if (W(['t-?shirts?', 'tees?', 'tank', 'top', 'long ?sleeve', 'ls', 'ss', 'base ?layer']).test(n) || /t-shirts|baselayers|tops/i.test(cat)) return 'T-Shirts';
    if (W(['shirts?']).test(n)) return women ? 'Tops & Blouses' : 'Shirts';
    return 'Clothing';
  })();
  return { siteCategory: 'Clothing', subcategory: sub };
}

export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  if (!n) return { reject: 'no name' };
  if (OUT.test(n) || /sleeping bags|shoelaces/i.test(feedCategory)) return { reject: 'laces, sleeping bags or camping gear (not clothing)' };
  if (KIDS.test(n) || /kids/i.test(feedCategory)) return { reject: "children's (KGW later)" };
  const women = WOMEN.test(n);
  const site = women ? 'wgw' : 'mgw';
  const p = place(women, n, feedCategory);
  return { site, ...p, ...(MEN.test(n) || women || p.siteCategory === 'Bags & Accessories' ? {} : { doubt: true }) };
}
