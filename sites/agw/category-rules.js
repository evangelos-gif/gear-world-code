// Car Gear World: which feed products belong on this site, and in which category (lessons L14).
//
// How a product is classified (by tools/agw-import-plan.mjs):
//   1. DENY rules on the PRODUCT NAME reject things that only look like car products: toys ("Monster Jam",
//      die-cast), children's car seats (Kids' site), clothes and gifts, motorbike and bicycle parts, garden
//      machines, plain screws ("M 4x4").
//   2. "Car context": the name or the shop's category says car / vehicle / automotive (or the Dutch and German
//      words, for VEVOR NL and Reidl). Generic words such as "wax", "jack" or "charger" count only with it.
//   3. The FIRST rule whose `include` matches and whose `exclude` does not wins. Order matters:
//      EV charging before electronics ("EV charger" is not a phone charger), parts before roof ("roof box gas
//      strut" is a part), and anything in a tool shop's "Automotive Tools" section that is not a battery,
//      tyre, care or EV product ends up in Garage Tools.
//   4. No match: rejected as "not car" (shown apart when the shop category itself says car, so missing
//      rules are easy to spot in the dry-run report).
// Based on the car feed scan of 21 Oct 2026 (Tooled Up, My Tool Shed, SGS Engineering, Joybuy UK, VEVOR NL).

const words = list => new RegExp(`(?:^|[^a-z0-9])(?:${list.join('|')})(?![a-z0-9])`, 'i');

// Shop categories that make a product a car product (top part before ">" or anywhere in the path).
const CAR_FEED = /automotive|vehicles? (?:parts|repairs|accessories)|vehicles & parts|car (?:parts|accessories|care|electronics|audio|cleaning)|motoring|automobiel|autozubeh|kfz|gas strut applications > (?:cars|vans|caravans|motorhomes)/i;
const CAR_WORDS = words(['cars?', 'vehicles?', 'automotive', 'motoring', 'auto', 'van', 'vans', '4x4 vehicle', 'suv', 'campervan', 'motorhome', 'caravan',
  'tyres?', 'tires?', 'dash ?cams?', 'obd2?', 'obdii', 'windscreen', 'windshield', 'number plate', 'tow ?bar', 'tow ball', 'roof box', 'roof bars',
  'ev', 'carplay', 'android auto', 'sat ?nav', 'jump starter', 'jump leads', 'wiper blades?', 'engine oil', 'spark plugs?', 'brake (?:pads|discs)',
  'trolley jack', 'axle stands?', 'gas struts?', 'tailgate', 'bonnet', 'boot', 'dashboard', 'headlights?', 'bumper', 'alloy wheels?',
  // Dutch / German (VEVOR NL, Reidl)
  'autos', 'personenauto', 'laadkabel', 'fietsendrager', 'bandenpomp', 'acculader', 'startbooster', 'krik', 'fahrzeug', 'kfz', 'pkw', 'wagenheber', 'starthilfe']);

export const DENY = [
  { label: 'toy or model', re: words(['toys?', 'monster jam', 'hot wheels', 'die-?cast', 'scale model', 'model cars?', 'rc', 'remote control', 'lego', 'ride-?on', 'playmat', 'puzzle', 'jigsaw', 'kids', "children'?s", 'baby', 'toddler', 'infant']) },
  { label: 'child car seat (Kids\' Gear World)', re: words(['child seat', 'booster seat', 'isofix', 'i-size', 'pushchair', 'pram', 'stroller', 'travel system', 'carrycot', 'car seats? (?!covers?|protectors?|organi[sz]ers?|cushions?|gap)']) },
  { label: 'clothes, gift or home item', re: words(['t-?shirts?', 'hoodie', 'sweatshirt', 'jackets?', '(?:rain|winter|wool|puffer|parka|trench) coats?', 'dress(?:es)?', 'socks', 'pyjamas', 'mugs?', 'posters?', 'art prints?', 'books?', '(?:greeting|birthday|christmas|gift|playing) cards?', 'costume', 'bedding', 'duvet', 'pillowcase', 'hoeslaken', 'cake', 'necklace', 'cufflinks', 'keyrings?', 'diffuser', 'candle']) },
  { label: 'motorbike or bicycle', re: words(['motorbikes?', 'motorcycles?', 'motocross', 'scooters?', 'mopeds?', 'quad bike', 'atv', 'bicycle', 'mtb', 'bike tyres?', 'inner tubes?', '700c', 'golf cart', 'club car']) },
  { label: 'garden or farm machine', re: words(['lawn ?mowers?', 'mowers?', 'strimmers?', 'chainsaws?', 'wheelbarrows?', 'tractors?', 'farm jack', 'horse', 'feed bucket', 'sack trucks?']) },
  { label: 'fixings, not a car product', re: words(['din \\d+', 'iso \\d+', 'gewindestifte', 'set screws?', 'grub screws?', 'gehörschutz', 'ear plugs?', 'säbelsägeblatt', 'saw blades?']) },
  { label: 'not allowed', re: words(['radar detectors?', 'laser jammers?', 'speed camera detector', 'spy camera', 'hidden camera', 'knife', 'knives', 'vape']) }
];

// ctx: true = only with car context (step 2). notInToolShop: skipped for a tool shop's "Automotive Tools"
// section (a "brake" product there is a brake TOOL, not a brake part).
export const RULES = [
  {
    slug: 'parts-maintenance', // gas struts first: "Roof Box Gas Strut", "Tailgate Gas Strut"
    include: words(['gas struts?', 'gas springs?', 'boot struts?', 'tailgate struts?', 'bonnet struts?'])
  },
  {
    slug: 'ev-charging',
    include: words(['ev chargers?', 'ev charging', 'ev cables?', 'wallbox(?:es)?', 'type ?2 (?:cable|charg\\w*|lead|socket|plug)s?', 'electric (?:vehicle|car) charg\\w+', 'ev laadkabel', 'laadkabel', 'laadpaal', 'ladestation', 'charging cable bag'])
  },
  {
    slug: 'diagnostics-battery',
    include: words(['obd ?(?:ii|2)?', 'diagnostic(?:s| tool| scanner| device)?', 'code readers?', 'fault code', 'scan tool', 'battery (?:chargers?|testers?|maintainers?|conditioners?|analy[sz]ers?)', 'smart chargers?', 'trickle chargers?',
      'jump starters?', 'jump leads', 'jump packs?', 'booster cables?', 'start(?:ing)? boosters?', 'power packs?', 'acculader', 'startbooster', 'starthilfe\\w*', 'multimeters?', 'circuit testers?', 'test lamps?', 'car batter(?:y|ies)', 'battery terminals?', 'voltage (?:protector|stabili[sz]er)', 'bordnetz']),
    exclude: words(['power stations?', 'laptop', 'phone', 'aa', 'aaa', 'drill', 'cordless'])
  },
  {
    slug: 'tyres-wheels',
    include: words(['tyres?', 'tires?', 'tyre inflators?', 'tire inflators?', 'inflators?', 'tyre (?:pressure|tread|gauge)\\w*', 'tpms', 'puncture', 'alloy wheels?', 'wheel (?:nuts?|bolts?|braces?|trims?|chocks?|dolly|dollies|balancers?|spacers?|locks?)', 'locking wheel nuts', 'wheel nut', 'wheel socket', 'valve (?:caps?|cores?)', 'bandenpomp', 'bead (?:blaster|breaker|seater)']),
    exclude: words(['tyre shine', 'tire shine', 'tyre (?:dressing|gel|cleaner)', 'tire (?:dressing|gel|cleaner)'])
  },
  {
    slug: 'car-care-detailing',
    include: words(['car wash', 'shampoo', 'snow foam', 'wax(?:es)?', 'polish(?:es|er|ers|ing)?', 'microfib(?:re|er)', 'valet(?:ing)?', 'detailing', 'clay bar', 'tyre (?:shine|dressing|gel)', 'tire (?:shine|dressing|gel)', 'glass cleaner', 'air fresheners?', 'scratch remov\\w+', 'ceramic coating', 'headlight restor\\w+', 'drying towels?', 'wash (?:mitt|brush|bucket|kit|set)s?', 'washing brush', 'interior cleaner', 'leather (?:cleaner|conditioner)', 'upholstery cleaner', 'pressure washer (?:brush|kit|set)', 'buffer polisher', 'buffing pads?', 'polishing pads?', 'chamois', 'vent cleaning brush']),
    ctx: true,
    exclude: words(['shoe polish', 'nail polish', 'floor polish', 'furniture polish', 'metal polish', 'dog shampoo', 'hair'])
  },
  {
    slug: 'car-electronics',
    include: words(['dash ?cams?', 'dashcam', 'carplay', 'android auto', 'sat ?navs?', 'gps navigat\\w+', 'car stereos?', 'head units?', 'car radios?', 'dab (?:adapter|radio)', 'reversing cameras?', 'rear ?view cameras?', 'backup cameras?', 'parking sensors?', 'parking (?:aid|assist)', 'car chargers?', 'usb car charger', 'phone (?:holders?|mounts?|cradles?)', 'fm transmitters?', 'car (?:speakers?|amplifiers?|subwoofers?)', 'subwoofers?', 'gps trackers?', 'car (?:led|lights?) strip', 'interior (?:led|light) strip', 'car inverters?', 'power inverters?', '12v (?:sockets?|splitters?|adapters?)']),
    ctx: true,
    exclude: words(['bumper cutter', 'cutter', 'drill', 'hole saw'])
  },
  {
    slug: 'safety-winter',
    include: words(['de-?icers?', 'ice scrapers?', 'snow (?:chains|socks|brush|shovel)', 'snow ?chains', 'warning triangles?', 'first aid', 'emergency (?:kit|hammer|tool|window breaker|opening kit)s?', 'window breakers?', 'seat ?belt cutters?', 'breakdown kits?', 'tow ropes?', 'tow straps?', 'hi-?vis (?:vests?|jackets?)', 'fire extinguishers?', 'breathalysers?', 'screen covers?', 'windscreen covers?', 'frost covers?', 'emergency fuel funnel']),
    ctx: true
  },
  {
    slug: 'roof-towing-exterior',
    include: words(['roof (?:box(?:es)?|bars?|racks?|rails?|carriers?|bags?)', 'bike (?:racks?|carriers?)', 'cycle carriers?', 'fietsendrager', 'tow ?bars?', 'tow balls?', 'towing (?:electrics?|mirrors?|kits?|sockets?|hitch(?:es)?)', 'tow hitch(?:es)?', 'hitch (?:locks?|covers?)', 'trailer (?:boards?|lights?|sockets?|locks?|plugs?)', 'trailers?', 'car covers?', 'half car cover', 'mud ?flaps?', 'number plates?', 'plate (?:holders?|screws?)', 'car awnings?', 'winch(?:es)?', 'ratchet power puller']),
    ctx: true
  },
  {
    slug: 'interior-comfort',
    include: words(['seat covers?', 'car seat covers?', 'seat (?:cushions?|protectors?|organi[sz]ers?|gap fillers?)', 'floor mats?', 'car mats?', 'boot (?:liners?|mats?|organi[sz]ers?|tidy)', 'organi[sz]ers?', 'sun ?shades?', 'sunshades?', 'steering wheel covers?', 'car vacuums?', 'handheld vacuum', 'dustbuster', 'cool ?box(?:es)?', 'car fridges?', 'heated (?:seat|blanket)s?', 'headrest hooks?', 'cup holders?', 'back seat organi[sz]ers?', 'dog (?:guards?|seat covers?)', 'pet seat covers?']),
    ctx: true
  },
  {
    slug: 'parts-maintenance',
    include: words(['wiper blades?', 'windscreen wipers?', 'wipers?', 'bulbs?', 'h(?:1|3|4|7|11)', 'headlights?', 'tail ?lights?', 'oil filters?', 'air filters?', 'cabin filters?', 'pollen filters?', 'fuel filters?', 'engine oils?', 'motor oils?', '[05]w-?\\d{2}', 'brake (?:pads?|discs?|fluid|shoes?|calipers?)',
      'spark plugs?', 'glow plugs?', 'coolant', 'antifreeze', 'screen ?wash', 'timing belts?', 'shock absorbers?', 'suspension (?:springs?|arms?|kits?)', 'exhaust (?:pipes?|clamps?|silencers?|tips?)', 'alternators?', 'starter motors?', 'clutch(?:es| kits?)?', 'fuses?', 'gaskets?', 'radiators?', 'mirror (?:glass|covers?)', 'wing mirrors?', 'fuel additives?', 'oil additives?', 'ball joints?', 'track rod ends?', 'cv boots?', 'dust covers?']),
    ctx: true,
    notInToolShop: true,
    exclude: words(['tools?', 'kits? for', 'sockets?', 'wrench(?:es)?', 'spanners?', 'pullers?', 'gauges?', 'testers?', 'removers?', 'installers?', 'clamps? tool', 'pliers', 'extractors?', 'cleaning brush', 'bleeders?', 'wind ?back', 'spreaders?', 'keys?', 'compressors?', 'lawnmower', 'garden'])
  },
  {
    slug: 'garage-tools-equipment',
    include: words(['trolley jacks?', 'car jacks?', 'bottle jacks?', 'scissor jacks?', 'axle stands?', 'creepers?', 'car ramps?', 'ramps?', 'engine (?:hoists?|cranes?|stands?|supports?)', 'transmission jacks?', 'wheel dolly', 'socket sets?', 'torque wrench(?:es)?', 'impact wrench(?:es)?', 'breaker bars?', 'oil (?:drainers?|drain pans?|extractors?|filter wrench(?:es)?)', 'grease guns?', 'workshop', 'garage', 'mechanics?', 'inspection lamps?', 'work lights?', 'tool (?:chests?|trolleys?|boxes?|kits?)', 'compressors?', 'spark plug sockets?', 'brake (?:tools?|bleeders?|piston)', 'pullers?', 'wagenheber', 'krik']),
    ctx: true
  }
];

// Category slugs in the order of the site menu (used by the import report).
export const CATEGORY_SLUGS = ['garage-tools-equipment', 'diagnostics-battery', 'parts-maintenance', 'tyres-wheels', 'car-care-detailing', 'car-electronics', 'interior-comfort', 'roof-towing-exterior', 'ev-charging', 'safety-winter'];

// Minimum quality for any product to be imported (L14). Prices in pounds or euros (euro prices get "≈ £").
export const QUALITY = {
  currencies: ['GBP', 'EUR'],
  minPrice: 1,
  maxPrice: 6000,
  requireImage: true,
  requireInStock: true,
  affiliateHosts: ['www.awin1.com', 'awin1.com'],
  maxNameLength: 400
};

export function topCategory(feedCategory) {
  return String(feedCategory || '').split('>')[0].trim();
}

// A tool shop's car section (Tooled Up, My Tool Shed: "Automotive Tools > ...").
const toolShop = feedCategory => /^automotive tools\b/i.test(String(feedCategory || '').trim());

// name: product name; feedCategory: merchant category path (and Awin category) as one string.
export function classify(name, feedCategory = '') {
  const n = String(name || '');
  const cat = String(feedCategory || '');
  for (const d of DENY) if (d.re.test(n)) return { ok: false, reason: d.label };
  const carFeed = CAR_FEED.test(cat);
  const ctx = carFeed || CAR_WORDS.test(n);
  const shop = toolShop(cat);
  for (const r of RULES) {
    if (r.ctx && !ctx) continue;
    if (r.notInToolShop && shop) continue;
    // Rules are tested on the name; the shop category helps only inside a car section.
    const hit = r.include.test(n) || (carFeed && r.include.test(cat));
    if (hit && !(r.exclude && r.exclude.test(n))) return { ok: true, slug: r.slug };
  }
  // Everything else in a tool shop's car section is a garage tool (pullers, brake tools, engine tools ...).
  if (shop) return { ok: true, slug: 'garage-tools-equipment' };
  return { ok: false, reason: carFeed ? 'not matched (shop says car)' : 'not car' };
}

// Feed names often start with promotions such as "【next day delivery】" or "[Autumn Special]".
export function cleanProductName(name) {
  return String(name || '')
    .replace(/^\s*(?:【[^】]{0,40}】|\[[^\]]{0,40}\]|\([^)]*(?:deal|sale|delivery|offer)[^)]*\))\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
