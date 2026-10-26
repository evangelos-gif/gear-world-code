// Import rules for Coes (Awin advertiser 30645) children's products on Kids' Gear World.
// coes.mjs (MGW/WGW) leaves children's items out ("for Kids' Gear World later"); this file places them on KGW.
// Coes is new on KGW, so this is a normal plan (not add-only): a later refresh hides Coes kids products gone from the feed.
// Feed facts (feed sample 20 Oct 2026 and gw-feed-gaps 21 Oct 2026): one row per SIZE, GBP, categories only
// Menswear / Womenswear / Sports / Gifts, so the place comes from the name ("Adidas Copa Pure 3 League Turf Junior Boots").
// KGW keeps products with the unique key (retailer, merchant id): the plan uses the shop's product handle for both ids.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'coes-kids',
  advertiserId: 30645,
  retailer: 'Coes',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?coes\.co\.uk\//i,
  sites: ['kgw'],
  maxPrice: 500
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');

const KIDS = words(['junior', 'juniors', 'jnr', 'kids', "kid's", 'kid', 'boys', "boy's", 'girls', "girl's", 'child', 'children', "children's", 'youth',
  'infant', 'infants', 'baby', 'toddler', 'toddlers']);
// "Nobody's Child" is a women's brand; "baker boy" caps and "boyfriend" jeans are for adults.
const ADULT_NAMES = /nobody'?s child|baker boy|boyfriend/gi;
const NOT_FOR_KGW = words(['gift card', 'gift voucher', 'voucher', 'candle', 'candles', 'diffuser', 'mug', 'mugs', 'laces', 'shoe polish', 'insole', 'insoles',
  'chocolate', 'book', 'greeting card', 'jigsaw', 'notebook', 'pen', 'cleaning', 'protector', 'spray', 'repair kit', 'women', "women's", 'womens', 'ladies', 'men', "men's", 'mens']);
const SHOES = words(['shoe', 'shoes', 'boot', 'boots', 'trainer', 'trainers', 'sneaker', 'sneakers', 'sandal', 'sandals', 'slipper', 'slippers', 'plimsoll', 'plimsolls',
  'wellies', 'welly', 'wellington', 'wellingtons', 'astros', 'clogs', 'flip flops', 'sliders']);
const SPORTS = words(['shin pad', 'shin pads', 'shin guard', 'shin guards', 'goggles', 'swim cap', 'ball', 'balls', 'racket', 'racquet', 'gum shield', 'mouthguard',
  'hockey stick', 'gloves goalkeeper', 'goalkeeper gloves', 'helmet']);
const ACCESSORIES = words(['hat', 'hats', 'beanie', 'cap', 'caps', 'gloves', 'glove', 'mittens', 'scarf', 'scarves', 'snood', 'sunglasses', 'umbrella', 'belt', 'belts',
  'watch', 'wallet', 'purse', 'bracelet', 'necklace', 'earrings', 'hair clip', 'headband', 'socks', 'sock']);
const BAGS = words(['backpack', 'rucksack', 'bag', 'bags', 'gymsack', 'gym sack', 'lunch bag', 'pencil case']);
const CLOTHING = words(['shirt', 'shirts', 't-shirt', 't-shirts', 'tee', 'polo', 'jumper', 'sweater', 'cardigan', 'hoodie', 'hoody', 'sweatshirt', 'jacket', 'coat', 'gilet',
  'fleece', 'parka', 'trousers', 'joggers', 'jogger', 'jeans', 'shorts', 'short', 'leggings', 'dress', 'skirt', 'top', 'pyjamas', 'pyjama', 'dressing gown', 'robe',
  'swimsuit', 'swim shorts', 'swimshorts', 'boardshorts', 'tracksuit', 'base layer', 'baselayer', 'jersey', 'kit', 'vest', 'bodysuit', 'onesie', 'romper', 'dungarees',
  'raincoat', 'rain jacket', 'waterproof', 'puddle suit', 'snowsuit']);

const pick = (n, pairs, fallback) => { for (const [re, sub] of pairs) if (re.test(n)) return sub; return fallback; };

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, brand = '' }) {
  let n = String(name || '');
  const b = String(brand || '').trim();
  if (b.length >= 3 && n.toLowerCase().startsWith(b.toLowerCase() + ' ')) n = n.slice(b.length + 1);
  const kidsText = n.replace(ADULT_NAMES, ' ');
  if (!KIDS.test(kidsText)) return { reject: 'not a children\'s product (Coes adult items go to MGW/WGW with coes.mjs)' };
  if (NOT_FOR_KGW.test(kidsText)) return { reject: 'not clothing, shoes, accessories or sports kit (or an adult size in the name)' };
  if (SHOES.test(n)) {
    // KGW's own subcategory names (lessons L56; dry run of 26 Oct 2026 warned about 10 new ones): Trainers or Shoes.
    return { site: 'kgw', siteCategory: 'Shoes', subcategory: pick(n, [[words(['football boots', 'astros', 'fg', 'ag', 'mg', 'turf', 'firm ground']), 'Shoes'],
      [words(['trainer', 'trainers', 'sneaker', 'sneakers', 'running']), 'Trainers']], 'Shoes') };
  }
  if (SPORTS.test(n)) return { site: 'kgw', siteCategory: 'Sports & Outdoors', subcategory: 'Sports & Outdoors' };
  if (BAGS.test(n)) return { site: 'kgw', siteCategory: 'School & Backpacks', subcategory: /lunch/i.test(n) ? 'Lunch Boxes & Bags' : 'School Bags' };
  if (ACCESSORIES.test(n) && !CLOTHING.test(n.replace(/\b(cap|caps)\b/gi, ' '))) {
    if (words(['socks', 'sock']).test(n)) return { site: 'kgw', siteCategory: 'Clothing', subcategory: 'Socks' };
    return { site: 'kgw', siteCategory: 'Accessories', subcategory: pick(n, [[words(['sunglasses']), 'Sunglasses']], 'Accessories') };
  }
  if (CLOTHING.test(n)) {
    return { site: 'kgw', siteCategory: 'Clothing', subcategory: pick(n, [[words(['jacket', 'coat', 'gilet', 'parka', 'raincoat', 'rain jacket', 'fleece', 'snowsuit', 'puddle suit']), 'Coats & Jackets'],
      [words(['shorts', 'short', 'swim shorts', 'swimshorts', 'boardshorts', 'swimsuit']), 'Clothing'], [words(['trousers', 'joggers', 'jogger', 'jeans', 'leggings', 'tracksuit']), 'Trousers & Jeans'],
      [words(['hoodie', 'hoody', 'sweatshirt', 'jumper', 'sweater', 'cardigan']), 'Clothing'], [words(['dress', 'skirt']), 'Clothing'],
      [words(['pyjamas', 'pyjama', 'dressing gown', 'robe', 'onesie']), 'Nightwear & Loungewear']], 'Shirts & Tops') };
  }
  return { reject: 'not sure what it is (no shoe, clothing, accessory or sports word in the name)' };
}
