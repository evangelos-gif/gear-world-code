// Import rules for Grey State Apparel (Awin advertiser 59217, feed 106178, greystateapparel.com, US dollars) on Women's
// Gear World (mass import round 2, 15 Nov 2026; owner: "to strengthen the USA"). Feed: 2,376 rows (one per size and
// colour), 275 pages, all "General Clothing"; women's basics with short names ("Mia Dress", "Madison Tee", "Audra Tank").
// A US programme: shown only to the US (deliversTo 'Grey State': ['US']).
export const RULES = {
  key: 'greystate-us',
  advertiserId: 59217,
  retailer: 'Grey State',
  currency: 'USD',
  shop: /^https:\/\/(www\.)?greystateapparel\.com\//i,
  sites: ['wgw'],
  maxPrice: 500,
  minPrice: 15
};

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const KINDS = [[W(['dress', 'dresses', 'maxi', 'midi']), 'Dresses'], [W(['jumpsuits?', 'rompers?']), 'Clothing'], [W(['skirts?']), 'Skirts'], [W(['shorts']), 'Shorts'],
  [W(['joggers?', 'pants', 'trousers', 'leggings']), 'Trousers'], [W(['hoodies?', 'hoody']), 'Hoodies'], [W(['sweatshirts?', 'crew', 'pullover']), 'Sweatshirts'],
  [W(['cardigans?', 'sweaters?', 'knit']), 'Knitwear'], [W(['jackets?', 'coats?', 'blazers?', 'shackets?']), 'Jackets & Coats'],
  [W(['tees?', 't-?shirts?', 'tanks?', 'cami', 'camis']), 'T-Shirts'], [W(['shirts?', 'tops?', 'blouses?', 'tunics?', 'bodysuits?']), 'Tops & Blouses']];

export function classify({ name }) {
  const n = String(name || '').trim();
  if (!n) return { reject: 'no name' };
  if (/gift ?card|bundle|mystery/i.test(n)) return { reject: 'gift card or bundle' };
  for (const [re, sub] of KINDS) if (re.test(n)) return { site: 'wgw', siteCategory: 'Clothing', subcategory: sub };
  return { site: 'wgw', siteCategory: 'Clothing', subcategory: 'Clothing', doubt: true };
}
