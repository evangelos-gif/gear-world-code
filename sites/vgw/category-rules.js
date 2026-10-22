// Travel Gear World: which feed products belong on this site, and in which category (lessons L14).
//
// How a product is classified (by tools/vgw-import-plan.mjs):
//   1. DENY rules on the PRODUCT NAME reject things that only look like travel products: baby travel gear
//      (Kids' site), cosmetics and hygiene products, clothes and swimwear, pet items, toys and stickers,
//      gun and instrument cases, knives.
//   2. "Travel context": the NAME says travel / luggage / holiday / camping / hiking, or the shop's category is a
//      real camping or luggage section. Generic words such as "backpack", "adapter" or "power bank" count only with it.
//   3. The FIRST rule whose `include` matches the NAME and whose `exclude` does not wins. Order matters:
//      luggage before security ("Suitcase with TSA Lock" is a suitcase), bags before security ("Crossbody Bag
//      with RFID" is a bag).
//   4. The shop's category alone never decides the site category: Joybuy files suitcases under
//      "Shoe Accessories > Shoelaces" and sanitary pads under "Towels". Only a real camping section
//      (VEVOR "Campinguitrusting", Joybuy "Camping & Hiking") puts a product in Camping & Outdoor by itself.
//   5. No match: rejected as "not travel".
// Tuned after the first dry run of 22 Oct 2026 (Joybuy UK 28,990 rows, VEVOR NL 12,223 rows).

import { fixMojibake } from '../../src/db.js';

const words = list => new RegExp(`(?:^|[^a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// Shop categories that are real camping / luggage sections (context, and for camping also the category).
const CAMPING_FEED = /campinguitrusting|camping|kamperen|campingausr/i;
const LUGGAGE_FEED = /(?:^|>|\|)\s*(?:luggage|suitcases|travel accessories|luggage & bags|bagage|reisgoed)\b/i;
const TRAVEL_WORDS = words(['travel(?:l?ing)?', 'traveller', 'luggage', 'suitcases?', 'cabin', 'carry[- ]on', 'hand luggage', 'holidays?', 'vacation', 'trips?', 'flights?',
  'in-?flight', 'airline', 'airport', 'passport', 'backpacking', 'camping', 'hiking', 'trekking', 'outdoor', 'expedition', 'beach', 'festival', 'getaway', 'jet ?lag', 'ryanair', 'easyjet',
  // Dutch / German / French / Spanish / Italian shop words
  'reis', 'reise', 'reiskoffer', 'handbagage', 'bagage', 'voyage', 'viaje', 'viaggio', 'urlaub', 'vakantie', 'kampeer\\w*', 'camping\\w*']);

export const DENY = [
  { label: 'baby or child travel gear (Kids\' Gear World)', re: words(['baby', 'babies', 'toddlers?', 'infants?', 'newborn', 'travel cots?', 'travel systems?', 'pushchairs?', 'prams?', 'strollers?', 'buggy', 'buggies', 'car seats?', 'isofix', 'i-size', 'carrycot', 'changing (?:bag|mat)s?', 'nappy', 'nappies', 'kids?', "children'?s", 'school (?:bags?|backpacks?)', 'book bags?', 'lunch (?:bags?|boxes?|backpacks?)', 'speelgoed']) },
  { label: 'cosmetics, perfume or hygiene', re: words(['travel[- ]size', 'mini size', 'miniatures?', 'perfumes?', 'fragrances?', 'aftershave', 'eau de (?:toilette|parfum)', 'edt', 'edp', 'shampoo', 'conditioner', 'toothpaste', 'toothbrush(?:es)?', 'deodorants?', 'sun ?cream', 'sunscreen', 'spf ?\\d+', 'moisturi[sz]er', 'make-?up', 'lipstick', 'mascara', 'serum', 'essence', 'lotion', 'cleanser', 'face cream', 'beauty', 'sanitary', 'incontinence', 'panty ?liners?', 'tampons?', 'pads (?:women|normal|long)']) },
  { label: 'pet item', re: words(['dogs?', 'cats?', 'pets?', 'puppy', 'kitten', 'animal carriers?']) },
  { label: 'toy, book or gift', re: words(['toys?', 'lego', 'puzzles?', 'jigsaws?', 'books?', 'guide ?books?', 'maps?', 'atlas', 'posters?', 'art prints?', 'mugs?', '(?:greeting|birthday|gift|playing|trading) cards?', 'card game', 'tcg', 'booster box', 'gift cards?', 'vouchers?', 'costumes?', 'fancy dress', 'diecast', 'scale models?', 'stickers?', 'decals?', 'watercolou?rs?', 'felt-?tip', 'pens?', 'pencils?']) },
  { label: 'a service, not a product', re: words(['insurance', 'hotel (?:stay|break|room)s?', 'flight tickets?', 'parking', 'lounge pass', 'esim', 'data plan', 'excursions?', 'tour packages?']) },
  { label: 'clothes or swimwear, not travel gear', re: words(['t-?shirts?', 'shirts?', 'hoodies?', 'sweatshirts?', 'jackets?', 'jas', 'blouson', 'coats?', 'fleece', 'dress(?:es)?', 'jeans', 'trousers', 'pants', 'leggings', 'tights', 'pyjamas', 'lingerie', 'bras?', 'knickers', '(?<!(?:flight|compression) )socks', 'underwear', 'swimsuits?', 'swimwear', 'bikinis?', 'swim(?:ming)? (?:shorts|trunks)', 'board ?shorts', 'cover-?ups?']) },
  { label: 'gun, instrument or tool case', re: words(['pistool\\w*', 'guns?', 'gun cases?', 'rifle\\w*', 'wapen\\w*', 'kluis\\w*', 'safes?', 'gitaar\\w*', 'guitar\\w*', 'violin\\w*', 'instrument\\w*', 'tool ?(?:case|box|kit)e?s?', 'werkzeug\\w*', 'gereedschap\\w*', 'driverset', 'lager\\w*']) },
  { label: 'not allowed', re: words(['knife', 'knives', 'machete', 'pepper spray', 'stun gun', 'taser', 'vape', 'e-?cig\\w*', 'spy camera', 'hidden camera']) }
];

// ctx: true = only with travel context (step 2).
export const RULES = [
  {
    slug: 'luggage-suitcases',
    include: words(['suitcases?', 'luggage sets?', 'cabin (?:case|bag|luggage|suitcase|trolley|holdall|backpack)s?', 'carry[- ]on (?:case|bag|luggage|suitcase|trolley|backpack)s?', 'check(?:ed)?[- ]in (?:case|bag|luggage|suitcase)s?', 'checked luggage', 'hand luggage', 'trolley (?:case|bag)s?', 'spinner (?:case|suitcase|luggage)s?', 'wheeled (?:bag|duffel|duffle|holdall|suitcase)s?', 'rolling (?:duffel|duffle|bag|suitcase)s?', 'underseat (?:bag|case|holdall|backpack)s?', 'under seat (?:bag|case|holdall|backpack)s?', 'luggage(?=[^.]*(?:hard (?:pc )?shell|airline approved|spinner wheels))', 'reiskoffers?', 'handbagage(?:koffers?)?', 'valises?', 'maletas?', 'trolley koffers?']),
    // Accessories FOR a suitcase are not a suitcase ("Suitcase Cover", "Luggage Strap").
    exclude: words(['(?:suitcase|luggage) (?:covers?|straps?|tags?|scales?|organi[sz]ers?|belts?|trackers?)', 'packing cubes?', 'fidget', 'salad', 'mop', 'shopping trolley', 'sack trolley', 'wax', 'cosmetic (?:case|bag)s? only'])
  },
  {
    slug: 'travel-bags-backpacks',
    include: words(['travel (?:backpacks?|rucksacks?|bags?)', 'rucksacks?', 'backpacks?', 'day ?packs?', 'duffel(?: bags?)?', 'duffle(?: bags?)?', 'holdalls?', 'weekend(?:er)? bags?', 'weekenders?', 'overnight bags?', 'garment (?:bags?|carriers?)', 'suit carriers?', 'sling bags?', 'bum bags?', 'waist (?:bags?|packs?)', 'cross ?body bags?', 'messenger bags?', 'shoulder bags?', 'packable bags?', 'foldable bags?', 'reisetasche', 'rugzak(?:ken)?', 'reistas(?:sen)?']),
    ctx: true,
    exclude: words(['laptop sleeve', 'cool(?:er)? bags?', 'cooler', 'insulated', 'nappy', 'golf', 'pet carrier', 'blowers?', 'trimmers?', 'sprayers?'])
  },
  {
    slug: 'documents-security',
    include: words(['passport (?:holders?|covers?|wallets?|cases?)', 'travel wallets?', 'document (?:holders?|wallets?|organi[sz]ers?)', 'rfid (?:wallets?|card holders?|sleeves?|blocking cards?|pouch(?:es)?)', 'money belts?', 'neck wallets?', 'hidden (?:wallet|pouch)', 'tsa (?:locks?|padlocks?)', 'luggage locks?', 'combination (?:locks?|padlocks?)', 'travel (?:locks?|padlocks?)', 'cable locks?', 'luggage trackers?', 'item trackers?', 'bluetooth trackers?', 'smart tags?', 'airtags?']),
    ctx: true,
    exclude: words(['suitcases?', 'luggage sets?', 'backpacks?', 'rucksacks?', 'crossbody', '(?:shoulder|messenger|travel|duffel|duffle|sling) bags?'])
  },
  {
    slug: 'comfort-sleep',
    include: words(['neck pillows?', 'travel pillows?', 'inflatable pillows?', 'eye masks?', 'sleep masks?', 'sleeping masks?', 'ear ?plugs', 'compression socks', 'flight socks', 'travel blankets?', 'travel foot ?rests?', 'foot hammocks?', 'travel slippers']),
    ctx: true,
    exclude: words(['ottoman', 'storage'])
  },
  {
    slug: 'travel-tech',
    include: words(['travel adapt(?:er|or)s?', 'plug adapt(?:er|or)s?', 'universal adapt(?:er|or)s?', 'world adapt(?:er|or)s?', 'power banks?', 'powerbanks?', 'portable chargers?', 'voltage converters?', 'travel chargers?', 'usb chargers?', 'multi (?:plug|charger)s?', 'noise cancell?ing (?:headphones|earbuds)', 'translat(?:ors?|ion earbuds)', 'translator earbuds', 'action cam(?:era)?s?', 'gimbals?', 'selfie sticks?', 'portable speakers?', 'e-?readers?', 'travel routers?', 'mifi']),
    ctx: true,
    // Big home audio, phones and car gear belong on Technology or Car Gear World.
    exclude: words(['soundbars?', 'tvs?', 'laptops?', 'smartphones?', 'jump starters?', 'car', 'dash ?cams?', 'gaming', 'heated', 'verwarmde?'])
  },
  {
    slug: 'beach-holiday',
    include: words(['beach (?:bags?|towels?|mats?|tents?|shelters?|umbrellas?|chairs?|blankets?)', 'windbreaks?', 'snorkel(?:l?ing)? (?:sets?|masks?|kits?)', 'snorkel masks?', 'masks? and snorkel', 'water shoes', 'aqua shoes', 'flip ?flops', 'sun ?hats?', 'bucket hats?', 'waterproof phone (?:pouch|case|bag)(?:es|s)?', 'phone pouch(?:es)?', 'dry ?bags?', 'inflatable (?:lilo|lounger|ring)s?', 'sunglasses']),
    ctx: true,
    exclude: words(['cycling', 'ski', 'snow', 'goggles', 'decor', 'drink cooler'])
  },
  {
    slug: 'camping-outdoor',
    include: words(['tents?', 'koepeltent(?:en)?', 'campingtent(?:en)?', 'tunneltent(?:en)?', 'daktent(?:en)?', 'sleeping bags?', 'slaapzak(?:ken)?', 'sleeping (?:mats?|pads?)', 'camping (?:mats?|chairs?|tables?|stoves?|beds?|lanterns?|kitchens?|cookware|gas|wagons?|pegs?|blankets?)', 'campingstoel(?:en)?', 'roll mats?', 'self-?inflating (?:mats?|pads?|beds?)', 'air ?beds?', 'luchtbed(?:den)?', 'camping stoves?', 'gas stoves?', 'cook ?sets?', 'mess tins?', 'head ?torch(?:es)?', 'lanterns?', 'flashlights?', 'hammocks?', '(?:trekking|walking|hiking) poles?', 'hydration (?:packs?|bladders?|reservoirs?)', 'water filters?', 'bivvy', 'bivy', 'tarps?', 'cool ?box(?:es)?', 'compressor cooler', 'portable fridges?', 'portable power stations?', 'power stations?', 'hiking boots?', 'walking boots?', 'compass(?:es)?', 'survival (?:kits?|blankets?)', 'mosquito nets?', 'tent pegs?']),
    ctx: true,
    exclude: words(['spuitcabine', 'spray booth', 'paint booth', 'garage tent', 'carport', 'party tent', 'feesttent', 'kitchen stove', 'range cooker', 'wood burning stove', 'log burner', 'pruning', 'saws?', 'cycling', 'ski', 'snowboard'])
  },
  {
    slug: 'travel-accessories',
    include: words(['packing cubes?', 'compression (?:bags?|cubes?|sacks?)', 'luggage (?:tags?|straps?|scales?|covers?|organi[sz]ers?)', 'suitcase (?:covers?|straps?)', 'toiletry bags?', 'wash ?bags?', 'dopp kits?', 'travel bottles?', 'travel bottle (?:pouch|set)', 'liquids? bags?', 'travel (?:organi[sz]ers?|towels?|umbrellas?|kettles?|irons?|hair ?dryers?|mugs?|bottles?|clotheslines?|laundry bags?|shoe bags?|pill (?:boxes|cases)|jewellery (?:case|box|roll)s?|storage bags?)', 'pill box(?:es)?', 'shoe bags?', 'laundry bags?', 'microfib(?:re|er) towels?', 'quick[- ]dry towels?', 'disposable (?:bath )?towels?']),
    ctx: true
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

// Things in a camping section that are not camping gear (Joybuy "Camping Tools" also holds kebab skewers).
const CAMPING_SECTION_NO = words(['skewers?', 'kebab', 'bbq', 'barbecue', 'grill', 'knife', 'knives', 'axes?', 'hatchets?', 'saws?', 'fishing', 'golf', 'cycling', 'ski', 'snowboard', 'skateboard', 'helmets?', 'shoes', 'boots(?<!hiking boots|walking boots)']);

// name: product name; feedCategory: merchant category path (and Awin category) as one string.
// paths: every merchant category column of the row (leaf and full path), from the import tool.
export function classify(name, feedCategory = '', paths = '') {
  const n = String(name || '');
  const cat = `${String(feedCategory || '')} | ${String(paths || '')}`;
  for (const d of DENY) if (d.re.test(n)) return { ok: false, reason: d.label };
  const campingFeed = CAMPING_FEED.test(cat);
  const ctx = campingFeed || LUGGAGE_FEED.test(cat) || TRAVEL_WORDS.test(n);
  for (const r of RULES) {
    if (r.ctx && !ctx) continue;
    if (r.include.test(n) && !(r.exclude && r.exclude.test(n))) return { ok: true, slug: r.slug };
  }
  // A shop's own luggage section: a "koffer" there is a suitcase (gun, tool and instrument cases are denied above).
  if (LUGGAGE_FEED.test(cat) && /koffers?(?![a-z])/i.test(n)) return { ok: true, slug: 'luggage-suitcases' };
  // A real camping section of the shop: the product is camping gear, unless it is clearly something else.
  if (campingFeed && !CAMPING_SECTION_NO.test(n)) return { ok: true, slug: 'camping-outdoor' };
  return { ok: false, reason: campingFeed ? 'not matched (shop says camping)' : 'not travel' };
}

// Feed names often start with promotions such as "【next day delivery】" or "[Autumn Special]".
export function cleanProductName(name) {
  return fixMojibake(String(name || ''))
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\]|\([^)]*(?:deal|sale|delivery|offer)[^)]*\))\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
