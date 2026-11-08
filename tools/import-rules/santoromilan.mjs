// Import rules for Santoro Milan (Awin advertiser 47149, feed 84237) on Men's Gear World (owner, 8 Nov 2026: "check email
// download and import new feeds"). New on every site. Feed facts (feed-profile 8 Nov 2026): 10,000 rows (one per size),
// GBP 9 to 400, shop santoromilan.com, category "Men's Suits", brands Santoro Milan, BYOB, Walter, Santiago; names
// "Diaz Blue Three Piece Suit", "Santoro - Leonardo Tux", "Bromley Sky Waistcoat". One card per product page. MGW already
// has Clothing > Suits; waistcoats get their own subcategory, ties and pocket squares go to Bags & Accessories.
export const RULES = {
  key: 'santoromilan',
  advertiserId: 47149,
  retailer: 'Santoro Milan',
  currency: 'GBP',
  shop: /^https:\/\/([a-z0-9-]+\.)?santoromilan\.com\//i,
  sites: ['mgw'],
  maxPrice: 1500,
  minPrice: 5,
  keepQuery: true
};

export function productKey(get) {
  try {
    const path = new URL(get('merchant_deep_link')).pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._-]{2,180}$/.test(path)) return path;
  } catch { /* no link */ }
  return String(get('merchant_product_id') || '').trim();
}

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const ACCESSORY = [
  ['Ties', W(['ties?', 'bow ties?', 'neck ?ties?', 'cravats?', 'pocket squares?', 'hankies?', 'handkerchiefs?'])],
  ['Accessories', W(['cufflinks?', 'braces', 'suspenders?', 'tie clips?', 'tie pins?', 'lapel pins?', 'belts?', 'socks?'])]
];
const CLOTHES = [
  ['Suits', W(['suits?', 'tux', 'tuxedos?', 'dinner suits?', 'two piece', 'three piece', 'morning suits?'])],
  ['Waistcoats', W(['waistcoats?', 'vests?'])],
  ['Jackets', W(['blazers?', 'jackets?', 'coats?', 'overcoats?', 'sports coats?'])],
  ['Trousers', W(['trousers?', 'pants', 'chinos?'])],
  ['Shirts', W(['shirts?'])],
  ['Knitwear', W(['jumpers?', 'cardigans?', 'knit\\w*', 'sweaters?'])]
];

export function classify({ name }) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').replace(/[.\s]+$/, '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift ?card|gift voucher|e-?gift|alteration|tailoring service/i.test(n)) return { reject: 'gift card or service, not a product' };
  if (/\b(women'?s|ladies|boys?|kids?|children'?s|junior|page ?boy)\b/i.test(n)) return { reject: "women's or children's item (this shop goes to Men's Gear World)" };
  if (/\b(shoes?|boots?|loafers?|brogues?|oxfords?)\b/i.test(n)) return { site: 'mgw', siteCategory: 'Shoes', subcategory: 'Shoes', name: n };
  // A tie sold with a suit is still a suit: the suit words come first for those.
  if (!W(['suits?', 'tux', 'tuxedos?', 'two piece', 'three piece']).test(n)) {
    for (const [sub, re] of ACCESSORY) if (re.test(n)) return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: sub, name: n };
  }
  for (const [sub, re] of CLOTHES) if (re.test(n)) return { site: 'mgw', siteCategory: 'Clothing', subcategory: sub, name: n };
  return { site: 'mgw', siteCategory: 'Clothing', subcategory: 'Suits', name: n };
}
