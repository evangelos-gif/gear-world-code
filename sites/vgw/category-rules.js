// Travel Gear World: which feed products belong on this site, and in which category (lessons L14).
//
// How a product is classified (by tools/vgw-import-plan.mjs):
//   1. DENY rules on the PRODUCT NAME reject things that only look like travel products: baby travel gear
//      (Kids' site), cosmetics and hygiene products, clothes and swimwear, pet items, toys and stickers,
//      gun and instrument cases, knives.
//   2. "Travel context": the NAME says travel / luggage / holiday / camping / hiking, or the shop's category is a
//      real camping or luggage section, or the whole shop is a travel shop (sources.json "travelShop": true, e.g.
//      Case Luggage, 27 Oct 2026). Generic words such as "backpack", "adapter" or "power bank" count only with it.
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
  { label: 'cosmetics, perfume or hygiene', re: words(['travel[- ]size', 'mini size', 'miniatures?', 'perfumes?', 'fragrances?', 'aftershave', 'eau de (?:toilette|parfum)', 'edt', 'edp', 'shampoo', 'conditioner', 'toothpaste', 'toothbrush(?:es)?', 'deodorants?', 'sun ?cream', 'sunscreen', 'spf ?\\d+', 'moisturi[sz]er', 'make-?up', 'lipstick', 'mascara', 'serum', 'essence', 'lotion', 'cleanser', 'face cream', 'beauty(?! cases?)', 'sanitary', 'incontinence', 'panty ?liners?', 'tampons?', 'pads (?:women|normal|long)']) },
  { label: 'pet item', re: words(['dogs?', 'cats?', 'pets?', 'puppy', 'kitten', 'animal carriers?']) },
  { label: 'toy, book or gift', re: words(['toys?', 'lego', 'puzzles?', 'jigsaws?', '(?<!daypack[^|]{0,40})books?(?! daypack)', 'guide ?books?', 'maps?', 'atlas', 'posters?', 'art prints?', 'mugs?', '(?:greeting|birthday|gift|playing|trading) cards?', 'card game', 'tcg', 'booster box', 'gift cards?', 'vouchers?', 'costumes?', 'fancy dress', 'diecast', 'scale models?', 'stickers?', 'decals?', 'watercolou?rs?', 'felt-?tip', 'pens?', 'pencils?']) },
  { label: 'a service, not a product', re: words(['insurance', 'hotel (?:stay|break|room)s?', 'flight tickets?', 'parking', 'lounge pass', 'esim', 'data plan', 'excursions?', 'tour packages?']) },
  { label: 'clothes or swimwear, not travel gear', re: words(['t-?shirts?', 'shirts?', 'hoodies?', 'sweatshirts?', 'jackets?', 'jas', 'blouson', 'coats?', 'fleece', 'dress(?:es)?', 'jeans', 'trousers', 'pants', 'leggings', 'tights', 'pyjamas', 'lingerie', 'bras?', 'knickers', '(?<!(?:flight|compression) )socks', 'underwear', 'swimsuits?', 'swimwear', 'bikinis?', 'swim(?:ming)? (?:shorts|trunks)', 'board ?shorts', 'cover-?ups?']) },
  { label: 'gun, instrument or tool case', re: words(['pistool\\w*', 'guns?', 'gun cases?', 'rifle\\w*', 'wapen\\w*', 'kluis\\w*', 'safes?', 'gitaar\\w*', 'guitar\\w*', 'violin\\w*', 'viool\\w*', 'cello\\w*', 'contrabas\\w*', 'saxofoon\\w*', 'trompet\\w*', 'instrument\\w*', 'tool ?(?:case|box|kit)e?s?', 'werkzeug\\w*', 'gereedschap\\w*', 'driverset', 'lager\\w*']) },
  { label: 'personal care device', re: words(['shavers?', 'razors?', 'trimmers?', 'groomers?', 'flossers?', 'epilators?', 'straighteners?', 'nail (?:drills?|files?)']) },
  { label: 'not allowed', re: words(['knife', 'knives', 'machete', 'pepper spray', 'stun gun', 'taser', 'vape', 'e-?cig\\w*', 'spy camera', 'hidden camera']) }
];

// ctx: true = only with travel context (step 2).
export const RULES = [
  {
    slug: 'luggage-suitcases',
    include: words(['suitcases?', 'luggage sets?', 'luggage \\d+[- ]?piece sets?', '\\d+[- ]?piece (?:luggage|suitcase) sets?', 'cabin (?:case|bag|luggage|suitcase|trolley|holdall|backpack)s?', 'carry[- ]on (?:case|bag|luggage|suitcase|trolley|backpack)s?', 'check(?:ed)?[- ]in (?:case|bag|luggage|suitcase)s?', 'checked luggage', 'hand luggage', 'trolley (?:case|bag)s?', 'spinner (?:case|suitcase|luggage)s?', 'wheeled (?:bag|duffel|duffle|holdall|suitcase)s?', 'rolling (?:duffel|duffle|bag|suitcase)s?', 'underseat (?:bag|case|holdall|backpack)s?', 'under seat (?:bag|case|holdall|backpack)s?', 'luggage(?=[^.]*(?:hard (?:pc )?shell|airline approved|spinner wheels))', 'reiskoffers?', 'handbagage(?:koffers?)?', 'valises?', 'maletas?', 'trolley koffers?',
      // Case Luggage (dry run of 27 Oct 2026): "Full Size Luggage", Tumi "Dual Access Expandable Trunk", "Large Garment Checked".
      'full[- ]size luggage', '(?:expandable|dual access(?: expandable)?) trunks?', '\\d[- ]wheel(?:ed)? packing cases?', 'expandable packing cases?', 'garment (?:checked|check[- ]in)',
      // Second dry run (27 Oct 2026): Tumi names a suitcase by its size and use only ("Front Access Expandable Checked 76cm").
      'expandable (?:checked|check[- ]in|carry[- ]on|cabin)', 'international (?:expandable )?carry[- ]on', '(?:short|extended|long|worldwide) trip (?:expandable )?(?:packing )?cases?',
      '(?:checked|check[- ]in|carry[- ]on|cabin) \\d{2,3}(?:\\.\\d)? ?cm', '\\d{2,3}(?:\\.\\d)? ?cm (?:spinner|trolley|cabin|carry[- ]on|checked|check[- ]in)',
      // Third dry run (27 Oct 2026): "Joules Large Trolley Spinner", "Carl Friedrik The Carry-on".
      'trolley spinners?', '(?:large|medium|small|cabin) (?:trolley )?spinners?', 'the carry[- ]on']),
    // Accessories FOR a suitcase are not a suitcase ("Suitcase Cover", "Luggage Strap").
    exclude: words(['(?:suitcase|luggage) (?:covers?|straps?|tags?|scales?|organi[sz]ers?|belts?|trackers?)', 'packing cubes?', 'fidget', 'salad', 'mop', 'shopping trolley', 'sack trolley', 'wax', 'cosmetic (?:case|bag)s? only', 'umbrellas?'])
  },
  {
    slug: 'travel-bags-backpacks',
    include: words(['travel (?:backpacks?|rucksacks?|bags?)', 'rucksacks?', 'backpacks?', 'day ?packs?', 'duffel(?: bags?)?', 'duffle(?: bags?)?', 'holdalls?', 'weekend(?:er)? bags?', 'weekenders?', 'overnight bags?', 'garment (?:bags?|carriers?)', 'suit carriers?', 'sling bags?', 'bum bags?', 'waist (?:bags?|packs?)', 'cross ?body bags?', 'messenger bags?', 'shoulder bags?', 'packable bags?', 'foldable bags?', 'reisetasche', 'rugzak(?:ken)?', 'reistas(?:sen)?',
      'boarding totes?', 'travel totes?', 'cross ?body', 'just in case (?:totes?|tote bags?|duffels?|backpacks?)', '(?:wheeled|rolling) (?:briefcases?|laptop (?:bags?|cases?|briefcases?))', 'laptop bags? with wheels']),
    ctx: true,
    exclude: words(['laptop sleeve', 'cool(?:er)? bags?', 'cooler', 'insulated', 'nappy', 'golf', 'pet carrier', 'blowers?', 'trimmers?', 'sprayers?'])
  },
  {
    slug: 'documents-security',
    include: words(['passport (?:holders?|covers?|wallets?|cases?)', 'travel wallets?', 'document (?:holders?|wallets?|organi[sz]ers?)', 'rfid (?:wallets?|card holders?|sleeves?|blocking cards?|pouch(?:es)?)', 'money belts?', 'neck wallets?', 'hidden (?:wallet|pouch)', 'tsa (?:locks?|padlocks?)', 'tsa [^|]{0,25}locks?', 'luggage locks?', 'combination (?:locks?|padlocks?)', 'cable locks?', 'luggage trackers?', 'item trackers?', 'bluetooth trackers?', 'smart tags?', 'airtags?']),
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
    include: words(['travel adapt(?:er|or)s?', 'plug adapt(?:er|or)s?', 'worldwide usb(?: earthed)?', 'earthed adapt(?:er|or)s?',
      '(?:uk|eu|euro|usa?|sa|aus?|world(?:wide)?)(?:\\s*(?:-|to|&)\\s*(?:uk|eu|euro|usa?|sa|aus?))?\\s+adapt(?:er|or)s?', 'universal adapt(?:er|or)s?', 'world adapt(?:er|or)s?', 'power banks?', 'powerbanks?', 'portable chargers?', 'voltage converters?', 'travel chargers?', 'usb chargers?', 'multi (?:plug|charger)s?', 'noise cancell?ing (?:headphones|earbuds)', 'translat(?:ors?|ion earbuds)', 'translator earbuds', 'action cam(?:era)?s?', 'gimbals?', 'selfie sticks?', 'portable speakers?', 'e-?readers?', 'travel routers?', 'mifi']),
    ctx: true,
    // Big home audio, phones and car gear belong on Technology or Car Gear World.
    exclude: words(['soundbars?', 'tvs?', 'laptops?', 'smartphones?', 'jump starters?', 'car', 'dash ?cams?', 'gaming', 'heated', 'verwarmde?'])
  },
  {
    slug: 'beach-holiday',
    include: words(['beach (?:bags?|towels?|mats?|tents?|shelters?|umbrellas?|chairs?|blankets?)', 'windbreaks?', 'snorkel(?:l?ing)? (?:sets?|masks?|kits?)', 'snorkel masks?', 'masks? and snorkel', 'water shoes', 'aqua shoes', 'flip ?flops', 'sun ?hats?', 'bucket hats?', 'waterproof phone (?:pouch|case|bag)(?:es|s)?', 'dry ?bags?', 'inflatable (?:lilo|lounger|ring)s?', 'sunglasses']),
    ctx: true,
    exclude: words(['cycling', 'ski', 'snow', 'goggles', 'decor', 'drink cooler', 'sunglasses cases?'])
  },
  {
    slug: 'camping-outdoor',
    include: words(['tents?', 'koepeltent(?:en)?', 'campingtent(?:en)?', 'tunneltent(?:en)?', 'daktent(?:en)?', 'sleeping bags?', 'slaapzak(?:ken)?', 'sleeping (?:mats?|pads?)', 'camping (?:mats?|chairs?|tables?|stoves?|beds?|lanterns?|kitchens?|cookware|gas|wagons?|pegs?|blankets?)', 'campingstoel(?:en)?', 'folding (?:chairs?|tables?)', 'outdoor (?:chairs?|tables?)', 'picnic tables?', 'campingkeukentafel\\w*', 'opvouwbare (?:tafel|stoel)\\w*', 'kampeer\\w*', 'roll mats?', 'self-?inflating (?:mats?|pads?|beds?)', 'air ?beds?', 'luchtbed(?:den)?', 'camping stoves?', 'gas stoves?', 'cook ?sets?', 'mess tins?', 'head ?torch(?:es)?', 'lanterns?', 'flashlights?', 'hammocks?', '(?:trekking|walking|hiking) poles?', 'hydration (?:packs?|bladders?|reservoirs?)', 'water filters?', 'bivvy', 'bivy', 'tarps?', 'cool ?box(?:es)?', 'compressor cooler', 'portable fridges?', 'portable power stations?', 'power stations?', 'hiking boots?', 'walking boots?', 'compass(?:es)?', 'survival (?:kits?|blankets?)', 'mosquito nets?', 'tent pegs?']),
    ctx: true,
    exclude: words(['spuitcabine', 'spray booth', 'paint booth', 'garage tent', 'carport', 'party tent', 'feesttent', 'kitchen stove', 'range cooker', 'wood burning stove', 'log burner', 'pruning', 'saws?', 'cycling', 'ski', 'snowboard'])
  },
  {
    slug: 'travel-accessories',
    include: words(['packing cubes?', 'compression (?:bags?|cubes?|sacks?)', 'luggage (?:tags?|straps?|scales?|covers?|organi[sz]ers?)', 'suitcase (?:covers?|straps?)', 'toiletry bags?', 'wash ?bags?', 'dopp kits?', 'travel bottles?', 'travel bottle (?:pouch|set)', 'liquids? bags?', 'travel (?:organi[sz]ers?|towels?|umbrellas?|kettles?|irons?|hair ?dryers?|mugs?|bottles?|clotheslines?|laundry bags?|shoe bags?|pill (?:boxes|cases)|jewellery (?:case|box|roll)s?|storage bags?)', 'pill box(?:es)?', 'pill cases?', 'toiletry (?:bricks?|cases?|pouch(?:es)?)', 'shoe bags?', 'laundry bags?', 'microfib(?:re|er) towels?', 'quick[- ]dry towels?', 'disposable (?:bath )?towels?',
      // Case Luggage (27 Oct 2026): fashion phone pouches and sunglasses cases are accessories, not beach gear.
      'phone pouch(?:es)?', 'sunglasses cases?', 'travel kits?', 'hanging (?:travel |toiletry )?kits?', 'toiletry kits?',
      '(?:electronics?|tech|cable|cord) (?:cord )?pouch(?:es)?', '(?:electronics?|tech|cable) organi[sz]ers?', 'beauty cases?', 'vanity cases?',
      // Umbrellas only when small enough to travel with (a "Jumbo" or a classic full-size umbrella is not travel gear).
      '(?:mini|compact|folding|foldable|pocket|small)[^|]{0,40}umbrellas?', 'garment covers?', 'suit covers?', 'wash ?kits?']),
    ctx: true,
    exclude: words(['\\d+-tier', 'drawers?', 'jewellery box(?:es)?'])
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
const CAMPING_SECTION_NO = words(['skewers?', 'kebab', 'grill (?:baskets?|pans?|tools?|gloves)', 'bbq (?:tools?|skewers?|gloves|tool set)', 'knife', 'knives', 'axes?', 'hatchets?', 'saws?', 'fishing', 'golf', 'cycling', 'ski', 'snowboard', 'skateboard', 'helmets?', 'shoes', 'boots(?<!hiking boots|walking boots)']);

// name: product name; feedCategory: merchant category path (and Awin category) as one string.
// paths: every merchant category column of the row (leaf and full path), from the import tool.
// source: the shop's entry in sources.json. A travel shop ("travelShop": true) gives every product travel context;
// the DENY rules and each category's own words still decide.
export function classify(name, feedCategory = '', paths = '', source = null) {
  const n = String(name || '');
  const cat = `${String(feedCategory || '')} | ${String(paths || '')}`;
  for (const d of DENY) if (d.re.test(n)) return { ok: false, reason: d.label };
  const campingFeed = CAMPING_FEED.test(cat);
  const ctx = campingFeed || LUGGAGE_FEED.test(cat) || TRAVEL_WORDS.test(n) || Boolean(source && source.travelShop);
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

// Feed segments that are the shop's collection or colour placeholder, not words a visitor needs ("- Travel Accessories -").
const FILLER_SEGMENTS = new Set(['travel accessories', 'luggage accessories', 'flight accessories', 'luggage covers', 'assorted']);

// Feed names often start with promotions such as "【next day delivery】" or "[Autumn Special]".
// source.skuEanInName (Case Luggage, 27 Oct 2026): names end with the shop's code and the EAN
// ("Delsey 76cm Spinner Suitcase - Helium Ultimate - Silver - 828512 - 3219110698428"); those, filler segments and a
// colour written twice ("- Black - Black") come off. Other shops' names are not touched by this.
export function cleanProductName(name, source = null) {
  let n = fixMojibake(String(name || ''))
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\]|\([^)]*(?:deal|sale|delivery|offer)[^)]*\))\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (source && source.skuEanInName) {
    n = n.replace(/\s+-\s+\d{5,7}(?:\s+-\s+\d{8,14})?\s*$/, '');
    const parts = n.split(/\s+-\s+/);
    const kept = [parts[0]];
    for (const p of parts.slice(1)) {
      const k = p.trim().toLowerCase();
      if (!k || FILLER_SEGMENTS.has(k) || k === kept[kept.length - 1].trim().toLowerCase()) continue;
      kept.push(p.trim());
    }
    n = kept.join(' - ');
  }
  return n;
}
