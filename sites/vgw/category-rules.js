// Travel Gear World: which feed products belong on this site, and in which category (lessons L14).
//
// How a product is classified (by tools/vgw-import-plan.mjs):
//   1. DENY rules on the PRODUCT NAME reject things that only look like travel products: baby travel gear
//      (Kids' site), travel-size cosmetics and perfume, pet carriers, toys, books and maps, school bags.
//   2. "Travel context": the name or the shop's category says travel / luggage / holiday / camping / outdoor.
//      Generic words such as "backpack", "adapter" or "power bank" count only with it.
//   3. The FIRST rule whose `include` matches and whose `exclude` does not wins. Order matters:
//      luggage before bags ("cabin bag" is luggage), documents before accessories ("passport wallet" is not
//      a toiletry bag), camping before beach ("beach tent" is beach, so beach is tested first for shelters).
//   4. No match: rejected as "not travel" (shown apart when the shop category itself says travel, so missing
//      rules are easy to spot in the dry-run report).
// First version, 22 Oct 2026, before the travel feed scan: the rules are tuned after the first dry run.

import { fixMojibake } from '../../src/db.js';

const words = list => new RegExp(`(?:^|[^a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// Shop categories that make a product a travel product.
const TRAVEL_FEED = /luggage|suitcases?|travel (?:bags?|accessories|essentials|gear|goods|adapters?)|travel(?:\s*&|\s+and)\s*luggage|camping|hiking|outdoor (?:gear|equipment|recreation)|beach (?:bags?|towels?|accessories)|backpacks? & luggage|bagage|koffer|reisegep|reisezubeh|equipaje|valises?|bagagli|campingartikel|kamperen/i;
const TRAVEL_WORDS = words(['travel(?:l?ing)?', 'traveller', 'luggage', 'suitcases?', 'cabin', 'carry[- ]on', 'hand luggage', 'holidays?', 'vacation', 'trips?', 'flights?',
  'in-?flight', 'airline', 'airport', 'passport', 'backpacking', 'camping', 'hiking', 'trekking', 'outdoor', 'expedition', 'beach', 'festival', 'getaway', 'jet ?lag',
  // Dutch / German / French / Spanish / Italian shop words
  'reis', 'reise', 'koffer', 'bagage', 'voyage', 'viaje', 'viaggio', 'urlaub', 'vakantie']);

export const DENY = [
  { label: 'baby or child travel gear (Kids\' Gear World)', re: words(['baby', 'babies', 'toddlers?', 'infants?', 'newborn', 'travel cots?', 'travel systems?', 'pushchairs?', 'prams?', 'strollers?', 'buggy', 'buggies', 'car seats?', 'isofix', 'i-size', 'carrycot', 'changing (?:bag|mat)s?', 'nappy', 'nappies', 'kids?', "children'?s", 'school (?:bags?|backpacks?)', 'book bags?', 'lunch (?:bags?|boxes?)']) },
  { label: 'travel-size cosmetics or perfume', re: words(['travel[- ]size', 'mini size', 'miniatures?', 'perfumes?', 'fragrances?', 'aftershave', 'eau de (?:toilette|parfum)', 'edt', 'edp', 'shampoo', 'conditioner', 'toothpaste', 'deodorants?', 'sun ?cream', 'sunscreen', 'spf ?\\d+', 'moisturi[sz]er', 'make-?up', 'lipstick', 'mascara', 'serum']) },
  { label: 'pet item', re: words(['dogs?', 'cats?', 'pets?', 'puppy', 'kitten', 'animal carriers?']) },
  { label: 'toy, book or gift', re: words(['toys?', 'lego', 'puzzles?', 'jigsaws?', 'books?', 'guide ?books?', 'maps?', 'atlas', 'posters?', 'art prints?', 'mugs?', '(?:greeting|birthday|gift|playing) cards?', 'gift cards?', 'vouchers?', 'costumes?', 'fancy dress', 'diecast', 'scale models?']) },
  { label: 'a service, not a product', re: words(['insurance', 'hotel (?:stay|break|room)s?', 'flight tickets?', 'parking', 'lounge pass', 'esim', 'data plan', 'excursions?', 'tour packages?']) },
  { label: 'clothes, not travel gear', re: words(['t-?shirts?', 'hoodies?', 'sweatshirts?', 'dress(?:es)?', 'jeans', 'trousers', 'leggings', 'pyjamas', 'lingerie', 'bras?', 'knickers', '(?<!(?:flight|compression) )socks', 'underwear']) },
  { label: 'not allowed', re: words(['knife', 'knives', 'machete', 'pepper spray', 'stun gun', 'taser', 'vape', 'e-?cig\\w*', 'spy camera', 'hidden camera']) }
];

// ctx: true = only with travel context (step 2).
export const RULES = [
  {
    slug: 'luggage-suitcases',
    include: words(['suitcases?', 'luggage sets?', 'hard ?shell', 'hardside', 'spinners?', 'trolley (?:case|bag)s?', 'cabin (?:case|bag|luggage|trolley)s?', 'carry[- ]on (?:case|bag|luggage|suitcase)s?', 'check[- ]in (?:case|bag|luggage|suitcase)s?', 'hand luggage', 'wheeled (?:bag|duffel|duffle|holdall)s?', 'underseat (?:bag|case)s?', 'under seat (?:bag|case)s?', 'koffer', 'valises?', 'maletas?', 'trolley koffer']),
    exclude: words(['covers?', 'straps?', 'tags?', 'scales?', 'locks?', 'organi[sz]ers?', 'fidget', 'spinner (?:toy|ring)s?', 'salad', 'mop', 'shopping trolley', 'sack trolley'])
  },
  {
    slug: 'documents-security',
    include: words(['passport (?:holders?|covers?|wallets?|cases?)', 'travel wallets?', 'document (?:holders?|wallets?|organi[sz]ers?)', 'rfid', 'money belts?', 'neck wallets?', 'hidden (?:wallet|pouch)', 'tsa (?:locks?|approved)', 'luggage locks?', 'combination (?:locks?|padlocks?)', 'cable locks?', 'anti-?theft', 'luggage trackers?', 'item trackers?', 'bluetooth trackers?', 'smart tags?', 'airtags?']),
    ctx: true
  },
  {
    slug: 'comfort-sleep',
    include: words(['neck pillows?', 'travel pillows?', 'inflatable pillows?', 'eye masks?', 'sleep masks?', 'sleeping masks?', 'ear ?plugs', 'compression socks', 'flight socks', 'travel blankets?', 'foot ?rests?', 'foot hammocks?', 'travel slippers']),
    ctx: true
  },
  {
    slug: 'travel-tech',
    include: words(['travel adapt(?:er|or)s?', 'plug adapt(?:er|or)s?', 'universal adapt(?:er|or)s?', 'world adapt(?:er|or)s?', 'power banks?', 'powerbanks?', 'portable chargers?', 'voltage converters?', 'travel chargers?', 'usb chargers?', 'multi (?:plug|charger)s?', 'charging cables?', 'noise cancell?ing', 'headphones', 'earbuds', 'translators?', 'action cam(?:era)?s?', 'gimbals?', 'selfie sticks?', 'portable speakers?', 'e-?readers?', 'travel routers?', 'mifi', 'luggage scales? digital']),
    ctx: true,
    // Big home audio and phones themselves belong on Technology Gear World.
    exclude: words(['soundbars?', 'tvs?', 'laptops?', 'smartphones?', 'iphone \\d+(?! case)', 'galaxy s\\d+'])
  },
  {
    slug: 'beach-holiday',
    include: words(['beach (?:bags?|towels?|mats?|tents?|shelters?|umbrellas?|chairs?|blankets?)', 'windbreaks?', 'snorkel(?:l?ing)?(?: sets?)?', 'masks? and snorkel', 'swim (?:bags?|shoes?)', 'water shoes', 'aqua shoes', 'flip ?flops', 'sun ?hats?', 'waterproof (?:phone )?(?:pouch|case|bag)(?:es|s)?', 'phone pouch(?:es)?', 'dry ?bags?', 'inflatable (?:lilo|lounger|ring)s?', 'sunglasses']),
    ctx: true
  },
  {
    slug: 'camping-outdoor',
    include: words(['tents?', 'sleeping bags?', 'sleeping (?:mats?|pads?)', 'camping (?:mats?|chairs?|tables?|stoves?|beds?|lanterns?|kitchens?|cookware|gas)', 'roll mats?', 'self-?inflating mats?', 'air ?beds?', 'stoves?', 'cook ?sets?', 'mess tins?', 'head ?torch(?:es)?', 'lanterns?', 'hammocks?', '(?:trekking|walking|hiking) poles?', 'hydration (?:packs?|bladders?|reservoirs?)', 'water filters?', 'bivvy', 'bivy', 'tarps?', 'gazebos?', 'cool ?box(?:es)?', 'cool ?bags?', 'hiking boots?', 'walking boots?', 'compass(?:es)?', 'survival (?:kits?|blankets?)', 'multi-?tools?', 'mosquito nets?', 'camping']),
    ctx: true,
    exclude: words(['garden gazebo', 'party tent', 'pop up gazebo for garden', 'kitchen stove', 'range cooker', 'wood burning stove', 'log burner'])
  },
  {
    slug: 'travel-accessories',
    include: words(['packing cubes?', 'compression (?:bags?|cubes?|sacks?)', 'luggage (?:tags?|straps?|scales?|covers?|organi[sz]ers?)', 'toiletry bags?', 'wash ?bags?', 'dopp kits?', 'travel bottles?', 'liquids? bags?', 'travel (?:organi[sz]ers?|towels?|umbrellas?|kettles?|irons?|hair ?dryers?|mugs?|bottles?|kits?|clotheslines?|laundry bags?|shoe bags?|jewellery (?:case|box|roll)s?)', 'shoe bags?', 'laundry bags?', 'microfib(?:re|er) towels?', 'quick[- ]dry towels?', 'water bottles?']),
    ctx: true
  },
  {
    slug: 'travel-bags-backpacks',
    include: words(['travel (?:backpacks?|rucksacks?|bags?)', 'rucksacks?', 'backpacks?', 'day ?packs?', 'duffel(?: bags?)?', 'duffle(?: bags?)?', 'holdalls?', 'weekend(?:er)? bags?', 'weekenders?', 'garment (?:bags?|carriers?)', 'suit carriers?', 'sling bags?', 'bum bags?', 'waist (?:bags?|packs?)', 'cross ?body bags?', 'messenger bags?', 'packable bags?', 'foldable bags?', 'reisetasche', 'rugzak', 'reistas']),
    ctx: true,
    exclude: words(['laptop sleeve', 'gym bags? for', 'cool bags?', 'nappy', 'golf'])
  }
];

// Category slugs in the order of the site menu (used by the import report).
export const CATEGORY_SLUGS = ['luggage-suitcases', 'travel-bags-backpacks', 'travel-accessories', 'comfort-sleep', 'documents-security', 'travel-tech', 'camping-outdoor', 'beach-holiday'];

// Minimum quality for any product to be imported (L14). Prices in pounds or euros (euro prices get "≈ £").
export const QUALITY = {
  currencies: ['GBP', 'EUR'],
  minPrice: 1,
  maxPrice: 3000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};

export function topCategory(feedCategory) {
  return String(feedCategory || '').split('>')[0].trim();
}

// A luggage or camping shop's own category is enough context for its products.
const SPECIALIST_FEED = /(?:^|\|)\s*(?:luggage|suitcases|travel accessories|camping|tents|sleeping bags|backpacks)\b/i;

// name: product name; feedCategory: merchant category path (and Awin category) as one string.
// paths: every merchant category column of the row (leaf and full path), from the import tool.
export function classify(name, feedCategory = '', paths = '') {
  const n = String(name || '');
  const cat = `${String(feedCategory || '')} | ${String(paths || '')}`;
  for (const d of DENY) if (d.re.test(n)) return { ok: false, reason: d.label };
  const travelFeed = TRAVEL_FEED.test(cat) || SPECIALIST_FEED.test(cat);
  const ctx = travelFeed || TRAVEL_WORDS.test(n);
  for (const r of RULES) {
    if (r.ctx && !ctx) continue;
    // Rules are tested on the name; the shop category helps only inside a travel section.
    const hit = r.include.test(n) || (travelFeed && r.include.test(cat));
    if (hit && !(r.exclude && r.exclude.test(n))) return { ok: true, slug: r.slug };
  }
  return { ok: false, reason: travelFeed ? 'not matched (shop says travel)' : 'not travel' };
}

// Feed names often start with promotions such as "【next day delivery】" or "[Autumn Special]".
export function cleanProductName(name) {
  return fixMojibake(String(name || ''))
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\]|\([^)]*(?:deal|sale|delivery|offer)[^)]*\))\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
