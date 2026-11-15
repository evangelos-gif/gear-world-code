// Import rules for Timberland UK (Daisycon programme 15048 "Timberland (EU)", its English feed in pounds from
// timberland.co.uk) on Men's Gear World (mass import of 15 Nov 2026; Manager: known brands that ship to the UK first).
// Feed facts (15 Nov 2026 download): 4,948 rows, one per size, 579 product pages, all men's ("Man", gender "male"),
// GBP 27-695, every row in stock; names such as "Timberland - Euro Sprint Hiking Boot for Men in Yellow, Man,
// Yellow/Black, Size: 8.5"; pictures on http://assets.timberland.eu (the same address works over https: 200).
// The programme has four feeds (DE, IT, AT in euros and this one in pounds, lessons L163); this file is the pound one.
// A UK shop in pounds: the sites' default delivery (GB) is right, no site setting changes.
//  - boots, hikers, chukkas -> Shoes > Boots; trainers -> Trainers; sandals -> Sandals; slip-ons, shoes, oxfords -> Shoes;
//  - shirts and polos -> Clothing > Shirts; T-shirts -> T-Shirts; hoodies, sweatshirts, jumpers, trousers, chinos, jeans,
//    shorts, jackets and gilets to their own Clothing names; belts, caps, hats, wallets to Bags & Accessories;
//  - watches -> Watches > Men's Watches; shoe care, laces, gift cards and anything not clearly one of these stay out.
import { daisyconField, pageKey } from './lib/daisycon-shop.mjs';

export const RULES = {
  key: 'timberland-uk',
  network: 'daisycon',
  advertiserId: 15048,
  retailer: 'Timberland UK',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?timberland\.co\.uk\//i,
  sites: ['mgw'],
  maxPrice: 1000,
  minPrice: 10
};

export const SHOP_URL = 'https://www.timberland.co.uk/';
const base = daisyconField(SHOP_URL);
// The pictures come as http://assets.timberland.eu/...: the sites show only https pictures (L161).
export function field(c, column) {
  const v = base(c, column);
  if (/image/.test(c)) return String(v || '').replace(/^http:\/\/(assets\.timberland\.eu\/)/i, 'https://$1');
  return v;
}
// One card per product page (each colour has its own page; sizes are options of it).
export const productKey = pageKey;

// "Timberland - Euro Sprint Hiking Boot for Men in Yellow, Man, Yellow/Black, Size: 8.5" -> "Euro Sprint Hiking Boot in Yellow"
export function displayName(name) {
  let n = String(name || '').replace(/[  ]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  n = n.replace(/^Timberland\s*-\s*/i, '').replace(/,\s*(?:Man|Men|Male)\s*,.*$/i, '').replace(/,\s*Size:.*$/i, '');
  n = n.replace(/^Men'?s\s+(?:Timberland\s+)?/i, '').replace(/\s+for\s+men\b/i, '').replace(/\s{2,}/g, ' ').trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export function displayBrand() { return 'Timberland'; }

const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const OUT = W(['watch straps?', 'shoe care', 'cleaner', 'cleaning kit', 'protector', 'laces', 'shoelaces?', 'insoles?', 'gift card', 'brush', 'renewbie']);
// The kind of product: the words before " for Men" / " in <colour>" (the head), checked from the most specific.
const KINDS = [
  [W(['boots?', 'bootie', 'hikers?', 'chukka', 'chukkas', 'wellies']), 'Shoes', 'Boots'],
  [W(['trainers?', 'sneakers?']), 'Shoes', 'Trainers'],
  [W(['sandals?', 'slides?', 'flip-?flops?']), 'Shoes', 'Sandals'],
  [W(['slip-?ons?', 'shoes?', 'oxfords?', 'loafers?', 'boat shoes?', 'derby', 'moccasins?']), 'Shoes', 'Shoes'],
  [W(['t-?shirts?', 'tees?']), 'Clothing', 'T-Shirts'],
  [W(['overshirt', 'shirts?', 'polos?']), 'Clothing', 'Shirts'],
  [W(['hoodies?', 'hoody']), 'Clothing', 'Hoodies'],
  [W(['sweatshirts?', 'crew ?necks?']), 'Clothing', 'Sweatshirts'],
  [W(['jumpers?', 'sweaters?', 'cardigans?', 'knit']), 'Clothing', 'Knitwear'],
  [W(['shorts']), 'Clothing', 'Shorts'],
  [W(['jeans']), 'Clothing', 'Jeans'],
  [W(['trousers?', 'chinos?', 'sweatpants', 'joggers?', 'cargos?', 'pants']), 'Clothing', 'Trousers'],
  [W(['jackets?', 'coats?', 'parkas?', 'gilets?', 'vests?', 'anoraks?', 'bombers?']), 'Clothing', 'Jackets'],
  [W(['fleeces?']), 'Clothing', 'Fleece'],
  [W(['socks?']), 'Clothing', 'Socks'],
  [W(['belts?']), 'Bags & Accessories', 'Belts'],
  [W(['caps?', 'hats?', 'beanies?']), 'Bags & Accessories', 'Hats'],
  [W(['wallets?', 'card holders?', 'cardholders?']), 'Bags & Accessories', 'Wallets & Purses'],
  [W(['backpacks?', 'bags?', 'holdalls?']), 'Bags & Accessories', 'Bags'],
  [W(['scarf', 'scarves']), 'Bags & Accessories', 'Scarves'],
  [W(['gloves?']), 'Bags & Accessories', 'Gloves'],
  [W(['watch', 'watches']), 'Watches', "Men's Watches"]
];

// By where the word ENDS, and the longer word when two end together ("T-Shirt" is a T-shirt, not a shirt).
function lastKind(text) {
  let best = null, end = -1, len = 0;
  for (const k of KINDS) {
    const g = new RegExp(k[0].source, 'gi');
    for (let m = g.exec(text); m; m = g.exec(text)) {
      const e = m.index + m[0].length;
      if (e > end || (e === end && m[0].length > len)) { end = e; len = m[0].length; best = k; }
    }
  }
  return best;
}

// The head of a name: what the product is, without " for Men", the colour, sizes or materials after "With".
export function headOf(name) {
  const n = displayName(name);
  return n.split(/\s+in\s+(?=[A-Z])/)[0].split(/\s+with\s+/i)[0];
}

export function classify({ name, awinCategory = '' }) {
  const n = String(name || '').replace(/[  ]/g, ' ').trim();
  if (!n) return { reject: 'no name' };
  const g = String(awinCategory || '').toLowerCase();
  if (g && g !== 'male' && g !== 'unisex') return { reject: 'not a men\'s product' };
  if (/\b(women|woman|ladies|kids?|junior|youth|toddler)\b/i.test(n)) return { reject: 'not a men\'s product' };
  const head = headOf(n);
  if (OUT.test(head)) return { reject: 'shoe care or another accessory left out' };
  // The LAST kind word of the head is the product ("Baboosic Brook Oxford Polo" is a polo, "Williams River Crewneck
  // Jumper" a jumper, "Mylo Bay Low Slip-on Trainer" a trainer: first dry run, 15 Nov 2026).
  const k = lastKind(head) || lastKind(displayName(n));
  if (k) return { site: 'mgw', siteCategory: k[1], subcategory: k[2], name: displayName(n), ...(lastKind(head) ? {} : { doubt: true }) };
  return { reject: 'not sure what it is' };
}
